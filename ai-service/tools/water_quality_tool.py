"""
Water Quality Tool — Lấy dữ liệu chất lượng nước từ Java API.

Luồng:
1. Lấy tất cả trạm quan trắc trong DB
2. Lọc theo vị trí + bán kính (Haversine)
3. Lấy dữ liệu mẫu cho từng trạm
4. Lọc thông số theo tên (salinity, pH, DO...)
5. Tính giá trị trung bình có trọng số theo khoảng cách
6. Trả về ToolResult chuẩn
"""
import logging
import os
from datetime import datetime
from typing import Optional
import httpx

from orchestrator.location_resolver import filter_stations_by_location

logger = logging.getLogger(__name__)

JAVA_API = os.getenv("JAVA_API_URL", "http://localhost:8084")
HTTP_TIMEOUT = 15.0

def _get_freshness_string(sample_time_str: str) -> str:
    """Tính độ trễ thời gian (freshness) từ sampleDate."""
    if not sample_time_str:
        return "N/A"
    try:
        sample_time = datetime.fromisoformat(sample_time_str.replace("Z", "+00:00")).replace(tzinfo=None)
        diff = datetime.now() - sample_time
        hours = diff.total_seconds() / 3600
        if hours < 1:
            return "Vừa xong"
        elif hours < 24:
            return f"{int(hours)} giờ trước"
        elif hours < 48:
            return "Hôm qua"
        else:
            return f"{int(hours/24)} ngày trước"
    except:
        return sample_time_str

# Mapping: tên dataset → các tên thông số trong DB
PARAMETER_ALIASES = {
    "salinity": ["Độ mặn", "Salinity", "Cl-", "Clorua", "Chloride", "EC", "TDS", "độ mặn"],
    "ph": ["pH", "ph"],
    "do": ["DO", "Oxy hòa tan", "Dissolved Oxygen"],
    "turbidity": ["Độ đục", "Turbidity", "TSS", "Chất lơ lửng"],
    "coliform": ["Coliform", "E.coli", "Vi khuẩn"],
    "nitrate": ["Nitrate", "NO3", "NH4", "Amoni"],
    "temperature": ["Nhiệt độ", "Temperature"],
}


def _get_all_stations() -> list[dict]:
    """Lấy tất cả trạm quan trắc thủ công."""
    try:
        resp = httpx.get(f"{JAVA_API}/api/gis/manual-stations", timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Lỗi lấy danh sách trạm: {e}")
        return []


def _get_station_samples(station_db_id: int) -> list[dict]:
    """Lấy danh sách mẫu nước của một trạm (không có thông số chi tiết)."""
    try:
        resp = httpx.get(
            f"{JAVA_API}/api/gis/water-quality/station/{station_db_id}",
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Lỗi lấy samples trạm {station_db_id}: {e}")
        return []


def _get_sample_detail(sample_id: int) -> Optional[dict]:
    """Lấy chi tiết một mẫu nước (kèm thông số đo)."""
    try:
        resp = httpx.get(
            f"{JAVA_API}/api/gis/water-quality/sample/{sample_id}",
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Lỗi lấy sample detail {sample_id}: {e}")
        return None


def _match_parameter(param_name: str, dataset_key: str) -> bool:
    """Kiểm tra xem tên thông số có khớp với dataset_key không."""
    if dataset_key == "water_quality":
        return True  # lấy tất cả thông số
    aliases = PARAMETER_ALIASES.get(dataset_key, [])
    param_lower = param_name.lower()
    return any(alias.lower() in param_lower or param_lower in alias.lower() for alias in aliases)


def _distance_weight(distance_km: float, power: float = 2.0) -> float:
    """
    Trọng số dựa trên khoảng cách: Inverse Distance Weighting (IDW).
    distance_km càng lớn, trọng số càng giảm mạnh (tỉ lệ nghịch bình phương).
    """
    epsilon = 0.1 # Tránh chia cho 0 nếu trạm nằm đúng vị trí người dùng
    return 1.0 / ((distance_km + epsilon) ** power)

def get_latest_station_data(dataset_key: str) -> dict:
    """
    Lấy bản ghi mới nhất của TẤT CẢ các trạm (dành cho QUERY_STATION_DATA).
    Không dùng filter location.
    """
    all_stations = _get_all_stations()
    if not all_stations:
        return {"success": False, "error": "Không có dữ liệu trạm quan trắc."}

    results = []
    
    for station in all_stations:
        samples = _get_station_samples(station["id"])
        if not samples:
            continue
            
        # Lấy sample mới nhất (mặc định đã sort giảm dần theo sampleDate từ API Java, lấy index 0)
        # Để an toàn, sort lại
        samples.sort(key=lambda x: x.get("sampleDate", ""), reverse=True)
        latest_sample = samples[0]
        
        detail = _get_sample_detail(latest_sample["id"])
        if not detail or "parameters" not in detail:
            continue
            
        # Tìm parameter phù hợp
        matched_val = None
        matched_unit = ""
        for p in detail["parameters"]:
            if _match_parameter(p.get("parameterName", ""), dataset_key):
                matched_val = p.get("valueNumeric")
                matched_unit = p.get("unit", "")
                break
                
        if matched_val is not None:
            results.append({
                "station_name": station.get("name"),
                "value": matched_val,
                "unit": matched_unit,
                "timestamp": latest_sample.get("sampleDate"),
                "freshness": _get_freshness_string(latest_sample.get("sampleDate"))
            })

    if not results:
        return {"success": False, "error": f"Không có dữ liệu {dataset_key} tại bất kỳ trạm nào."}

    # Tính min, max, avg
    values = [r["value"] for r in results if isinstance(r["value"], (int, float))]
    summary = {}
    if values:
        summary["min"] = min(values)
        summary["max"] = max(values)
        summary["avg"] = round(sum(values) / len(values), 2)
        summary["count"] = len(values)

    return {
        "success": True,
        "stations": results,
        "summary": summary,
        "evidence": {
            "dataset": dataset_key,
            "source": "MySQL All Stations",
            "count": len(results)
        }
    }


def query_water_quality(
    location: dict,
    dataset_key: str,
    time_range: str = "latest",
) -> dict:
    """
    Lấy dữ liệu chất lượng nước theo vị trí.

    Args:
        location: dict từ location_resolver.resolve_location()
        dataset_key: "salinity" | "ph" | "water_quality" | ...
        time_range: "latest" | "year:2025" | "range:2023-2025"

    Returns:
        ToolResult dict với:
        - stations: danh sách trạm và giá trị
        - summary: giá trị tổng hợp (weighted average)
        - evidence: thông tin nguồn dữ liệu
    """
    execution_log = []

    # Bước 1: Lấy danh sách tất cả trạm
    all_stations = _get_all_stations()
    execution_log.append(f"Tìm thấy {len(all_stations)} trạm trong DB")

    if not all_stations:
        return {
            "success": False,
            "error": "Không có dữ liệu trạm quan trắc trong hệ thống",
            "stations": [],
            "summary": None,
        }

    # Bước 2: Lọc theo vị trí với Fallback Radius
    original_radius = location.get('radius_km', 10)
    if not isinstance(original_radius, (int, float)):
        original_radius = 10.0
    radii_to_try = [original_radius, 25.0, 50.0]
    
    nearby_stations = []
    used_radius = original_radius
    
    for r in radii_to_try:
        location['radius_km'] = r
        nearby_stations = filter_stations_by_location(all_stations, location, max_stations=10)
        if nearby_stations:
            used_radius = r
            if r > original_radius:
                execution_log.append(f"Fallback Search: Mở rộng bán kính lên {r} km vì không tìm thấy trạm ở bán kính {original_radius} km.")
            break

    execution_log.append(
        f"Sau lọc vị trí (r={used_radius} km): {len(nearby_stations)} trạm"
    )

    if not nearby_stations:
        return {
            "success": False,
            "error": f"Không tìm thấy trạm quan trắc trong bán kính {location.get('radius_km', 10)} km",
            "stations": [],
            "summary": None,
        }

    # Bước 3 + 4: Lấy mẫu và thông số cho từng trạm
    station_results = []
    latest_date = None

    for station in nearby_stations[:5]:  # giới hạn 5 trạm gần nhất để tránh quá nhiều request
        station_id = station.get("id")
        if not station_id:
            continue

        # Lấy mẫu (không có thông số)
        samples = _get_station_samples(station_id)
        if not samples:
            continue

        # Sắp xếp mẫu theo ngày mới nhất
        samples_sorted = sorted(
            samples,
            key=lambda s: s.get("sampleDate", ""),
            reverse=True,
        )

        # Lọc theo time_range
        filtered_samples = _filter_by_time_range(samples_sorted, time_range)
        if not filtered_samples:
            filtered_samples = samples_sorted[:1]  # fallback: mẫu mới nhất

        # Lấy chi tiết mẫu gần nhất và trích thông số cần thiết
        best_sample = filtered_samples[0]
        sample_detail = _get_sample_detail(best_sample["id"])
        if not sample_detail:
            continue

        params = sample_detail.get("parameters", []) or []
        matched_params = [
            p for p in params
            if p.get("valueNumeric") is not None
            and _match_parameter(p.get("parameterName", ""), dataset_key)
        ]

        if not matched_params and dataset_key != "water_quality":
            continue  # Không có thông số phù hợp

        station_results.append({
            "stationId": station.get("stationId"),
            "stationDbId": station_id,
            "location": station.get("location"),
            "lat": station.get("y"),
            "lon": station.get("x"),
            "distance_km": station.get("distance_km", 0),
            "sampleDate": best_sample.get("sampleDate"),
            "parameters": matched_params if dataset_key != "water_quality" else params,
            "weight": _distance_weight(station.get("distance_km", 1.0)),
        })

        if best_sample.get("sampleDate"):
            if latest_date is None or best_sample["sampleDate"] > latest_date:
                latest_date = best_sample["sampleDate"]

    execution_log.append(f"Thu được dữ liệu từ {len(station_results)} trạm")

    # Bước 5: Tính weighted average cho thông số chính
    summary = _compute_weighted_summary(station_results, dataset_key)

    # Bước 6: Tạo evidence
    evidence = {
        "dataset": f"MySQL — {dataset_key}",
        "source": "MySQL Database",
        "detail": f"{len(station_results)} trạm, bán kính {location.get('radius_km', 10)} km",
        "timestamp": latest_date or datetime.now().date().isoformat(),
        "unit": _get_unit(dataset_key),
        "count": len(station_results),
    }

    return {
        "success": True,
        "dataset_key": dataset_key,
        "stations": station_results,
        "summary": summary,
        "evidence": evidence,
        "execution_log": execution_log,
        "location": location,
    }


def _filter_by_time_range(samples: list[dict], time_range: str) -> list[dict]:
    """Lọc mẫu theo time_range."""
    if time_range == "latest" or not time_range:
        return samples[:3]  # 3 mẫu mới nhất

    if time_range.startswith("year:"):
        year = time_range.split(":")[1].strip()
        return [s for s in samples if str(s.get("sampleDate", "")).startswith(year)]

    if time_range.startswith("range:"):
        parts = time_range.split(":")[1].split("-")
        if len(parts) == 2:
            from_year, to_year = parts[0].strip(), parts[1].strip()
            return [
                s for s in samples
                if from_year <= str(s.get("sampleDate", ""))[:4] <= to_year
            ]

    return samples[:3]


def _compute_weighted_summary(station_results: list[dict], dataset_key: str) -> Optional[dict]:
    """
    Tính giá trị trung bình có trọng số khoảng cách cho thông số chính.
    """
    if not station_results:
        return None

    # Thu thập tất cả giá trị numeric có trọng số
    weighted_values = {}  # param_name → list of (value, weight)

    for sr in station_results:
        weight = sr.get("weight", 1.0)
        for param in sr.get("parameters", []):
            val = param.get("valueNumeric")
            name = param.get("parameterName", "").strip()
            if val is not None and name:
                if name not in weighted_values:
                    weighted_values[name] = []
                weighted_values[name].append((val, weight, param.get("unit", "")))

    if not weighted_values:
        return None

    # Tính weighted average
    summary_params = {}
    for param_name, values in weighted_values.items():
        total_weight = sum(w for _, w, _ in values)
        if total_weight == 0:
            continue
        weighted_avg = sum(v * w for v, w, _ in values) / total_weight
        unit = values[0][2] if values else ""
        summary_params[param_name] = {
            "value": round(weighted_avg, 3),
            "unit": unit,
            "station_count": len(values),
            "min": round(min(v for v, _, _ in values), 3),
            "max": round(max(v for v, _, _ in values), 3),
        }

    return summary_params


def _get_unit(dataset_key: str) -> str:
    units = {
        "salinity": "‰",
        "ph": "",
        "do": "mg/L",
        "turbidity": "NTU",
        "temperature": "°C",
    }
    return units.get(dataset_key, "")

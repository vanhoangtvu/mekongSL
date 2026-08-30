"""
Temporal Analysis Tool — Phân tích chuỗi thời gian, xu hướng và dị thường.
"""
import logging
import httpx
from datetime import datetime, timedelta

from tools.water_quality_tool import _get_all_stations, _distance_weight, PARAMETER_ALIASES, _match_parameter, JAVA_API, HTTP_TIMEOUT
from tools.ecowitt_tool import _get_all_ecowitt_stations, _get_ecowitt_history, _fahrenheit_to_celsius, _inch_to_mm, _mph_to_ms
from orchestrator.location_resolver import filter_stations_by_location, haversine_km
import statistics

logger = logging.getLogger(__name__)

def _get_station_history(station_db_id: int) -> list[dict]:
    """Lấy toàn bộ lịch sử mẫu nước của một trạm."""
    try:
        resp = httpx.get(
            f"{JAVA_API}/api/gis/water-quality/station/{station_db_id}",
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Lỗi lấy lịch sử trạm {station_db_id}: {e}")
        return []

def _get_sample_detail(sample_id: int) -> dict:
    try:
        resp = httpx.get(
            f"{JAVA_API}/api/gis/water-quality/sample/{sample_id}",
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {}

def analyze_temporal_trend(location: dict, dataset_key: str, days: int = 30) -> dict:
    """
    Phân tích xu hướng (Trend) và Dị thường (Anomaly) trong N ngày qua.
    """
    execution_log = []
    # Determine if dataset is water quality or ecowitt
    is_ecowitt = dataset_key in ["temperature", "humidity", "rain", "wind_speed"]
    
    if is_ecowitt:
        all_stations = _get_all_ecowitt_stations()
        if not all_stations:
            return {"success": False, "error": "Không có trạm thời tiết"}
        # Map lat/lon to match filter_stations_by_location or do custom
        for s in all_stations:
            s["id"] = s["device_id"]
        nearby_stations = filter_stations_by_location(all_stations, location, max_stations=1) # Ecowitt usually 1 closest is enough
    else:
        all_stations = _get_all_stations()
        if not all_stations:
            return {"success": False, "error": "Không có trạm quan trắc nước"}
        nearby_stations = filter_stations_by_location(all_stations, location, max_stations=3)
        
    if not nearby_stations:
        return {"success": False, "error": "Không có trạm gần đây"}
        
    cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    historical_data = [] # list of (date, value, weight)
    
    for station in nearby_stations:
        weight = _distance_weight(station.get("distance_km", 1.0))
        
        if is_ecowitt:
            samples = _get_ecowitt_history(station["device_id"], days)
            for s in samples:
                val = None
                unit = ""
                if dataset_key == "temperature":
                    val = _fahrenheit_to_celsius(s.get("tempf_tempf"))
                    unit = "°C"
                elif dataset_key == "humidity":
                    try: val = float(s.get("humidity_humidity"))
                    except: pass
                    unit = "%"
                elif dataset_key == "rain":
                    val = _inch_to_mm(s.get("rain_dailyrainin"))
                    unit = "mm"
                elif dataset_key == "wind_speed":
                    val = _mph_to_ms(s.get("wind_speed_windspeedmph"))
                    unit = "m/s"
                    
                if val is not None:
                    historical_data.append({
                        "date": str(s.get("fetched_at")),
                        "value": val,
                        "weight": weight,
                        "unit": unit
                    })
        else:
            station_id = station.get("id")
            samples = _get_station_history(station_id)
            valid_samples = [s for s in samples if str(s.get("sampleDate", "")) >= cutoff_date]
            
            for sample in valid_samples:
                detail = _get_sample_detail(sample["id"])
                for p in detail.get("parameters", []):
                    val = p.get("valueNumeric")
                    name = p.get("parameterName", "")
                    if val is not None and _match_parameter(name, dataset_key):
                        historical_data.append({
                            "date": sample.get("sampleDate"),
                            "value": val,
                            "weight": weight,
                            "unit": p.get("unit", "")
                        })
                        break # only take one matched param per sample
                    
    if not historical_data:
        return {"success": False, "error": f"Không có dữ liệu {dataset_key} trong {days} ngày qua"}
        
    # Sắp xếp theo ngày
    historical_data.sort(key=lambda x: x["date"])
    
    # Chia làm 2 giai đoạn: Nửa đầu (Quá khứ) và Nửa sau (Gần đây)
    mid_point = len(historical_data) // 2
    if mid_point == 0:
        return {"success": False, "error": "Không đủ dữ liệu để phân tích xu hướng"}
        
    past_data = historical_data[:mid_point]
    recent_data = historical_data[mid_point:]
    
    def calc_weighted_avg(data_list):
        total_w = sum(d["weight"] for d in data_list)
        if total_w == 0: return 0
        return sum(d["value"] * d["weight"] for d in data_list) / total_w
        
    past_avg = calc_weighted_avg(past_data)
    recent_avg = calc_weighted_avg(recent_data)
    current_val = recent_data[-1]["value"]
    unit = historical_data[0]["unit"]
    
    change_pct = ((recent_avg - past_avg) / past_avg * 100) if past_avg != 0 else 0
    
    # Calculate Standard Deviation to understand volatility
    values_only = [d["value"] for d in historical_data]
    std_dev = 0
    if len(values_only) >= 2:
        std_dev = statistics.stdev(values_only)
    
    trend = "STABLE"
    if change_pct > 10: trend = "INCREASING"
    elif change_pct < -10: trend = "DECREASING"
    
    # Anomaly detection (Ví dụ: giá trị hiện tại lệch > 3 std_dev so với trung bình quá khứ)
    anomaly = False
    if std_dev > 0 and abs(current_val - past_avg) > (3 * std_dev):
        anomaly = True
    elif past_avg > 0 and abs((current_val - past_avg) / past_avg) > 0.3:
        anomaly = True # fallback rule
        
    summary = {
        "dataset": dataset_key,
        "past_average": round(past_avg, 2),
        "recent_average": round(recent_avg, 2),
        "current_value": round(current_val, 2),
        "change_percentage": round(change_pct, 1),
        "volatility_std_dev": round(std_dev, 2),
        "trend": trend,
        "anomaly_detected": anomaly,
        "unit": unit,
        "data_points": len(historical_data)
    }
    
    return {
        "success": True,
        "summary": summary,
        "execution_log": [f"Phân tích {len(historical_data)} mẫu trong {days} ngày qua."]
    }

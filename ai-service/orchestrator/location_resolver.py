"""
Location Resolver — Phân giải vị trí từ nhiều dạng đầu vào.

Hỗ trợ:
- GPS tọa độ trực tiếp → Buffer polygon
- Tên địa danh → Nominatim Geocoding
- Tên hành chính (huyện/xã) → Nominatim với filter Mekong Delta
"""
import logging
import math
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# Giới hạn địa lý vùng Mekong Delta (bounding box)
MEKONG_BBOX = {
    "min_lat": 8.5,
    "max_lat": 11.5,
    "min_lon": 104.5,
    "max_lon": 107.0,
}

# Tên tỉnh Mekong Delta để boost geocoding
MEKONG_PROVINCES = [
    "Trà Vinh", "Bến Tre", "Tiền Giang", "Long An", "Đồng Tháp",
    "Vĩnh Long", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau",
    "An Giang", "Kiên Giang", "Cần Thơ",
]

# UTM Zone 48N (EPSG:32648) → WGS84 transformer (lazy-loaded)
_utm_transformer = None


def _get_utm_transformer():
    """Lazy-load pyproj transformer."""
    global _utm_transformer
    if _utm_transformer is None:
        from pyproj import Transformer
        _utm_transformer = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    return _utm_transformer


def utm_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """
    Convert UTM Zone 48N (x=easting, y=northing) → WGS84 (lat, lon).
    Trả về (lat, lon).
    """
    try:
        transformer = _get_utm_transformer()
        lon, lat = transformer.transform(x, y)
        return lat, lon
    except Exception as e:
        logger.error(f"UTM to WGS84 error: {e}")
        return 0.0, 0.0


def is_utm_coordinates(x: float, y: float) -> bool:
    """Phát hiện xem tọa độ có phải UTM không (giá trị lớn > 1000)."""
    return abs(x) > 1000 or abs(y) > 1000



def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Tính khoảng cách giữa 2 điểm (km) theo công thức Haversine."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def create_bbox_from_point(lat: float, lon: float, radius_km: float) -> dict:
    """
    Tạo bounding box từ điểm tâm + bán kính.
    Dùng để query nhanh trước khi Haversine chính xác.
    """
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return {
        "min_lat": lat - delta_lat,
        "max_lat": lat + delta_lat,
        "min_lon": lon - delta_lon,
        "max_lon": lon + delta_lon,
        "center_lat": lat,
        "center_lon": lon,
        "radius_km": radius_km,
    }


def resolve_gps(lat: float, lon: float, radius_km: float = 10.0) -> dict:
    """Phân giải vị trí từ GPS + bán kính."""
    bbox = create_bbox_from_point(lat, lon, radius_km)
    return {
        "type": "point_buffer",
        "lat": lat,
        "lon": lon,
        "radius_km": radius_km,
        "bbox": bbox,
        "display_name": f"Khu vực trong bán kính {radius_km} km",
        "resolved": True,
    }


def resolve_place_name(name: str, radius_km: float = 10.0, user_lat: Optional[float] = None, user_lon: Optional[float] = None) -> dict:
    """
    Geocoding tên địa danh qua Nominatim.
    Giải quyết tên trùng lặp (vd: Châu Thành) bằng cách lấy nhiều kết quả
    và chọn kết quả gần GPS người dùng nhất.
    """
    try:
        from geopy.geocoders import Nominatim
        from geopy.extra.rate_limiter import RateLimiter

        geolocator = Nominatim(user_agent="mekong-ai-service/1.0")
        geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)

        query = f"{name}, Việt Nam"
        logger.info(f"Geocoding query: {query}")
        # Lấy nhiều kết quả thay vì 1
        locations = geocode(query, exactly_one=False, limit=10, timeout=5)

        if not locations:
            logger.warning(f"Không geocode được: '{name}'")
            return {
                "type": "unresolved",
                "query_name": name,
                "resolved": False,
                "error": f"Không tìm thấy địa danh '{name}' trên bản đồ",
            }

        # Nếu có GPS, sắp xếp các kết quả theo khoảng cách tới GPS
        best_loc = locations[0]
        if user_lat is not None and user_lon is not None and len(locations) > 1:
            def haversine(lat1, lon1, lat2, lon2):
                import math
                R = 6371
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            
            locations = sorted(locations, key=lambda loc: haversine(user_lat, user_lon, loc.latitude, loc.longitude))
            best_loc = locations[0]
            logger.info(f"Ambiguous name '{name}', picked closest to user GPS: {best_loc.address} (dist: {haversine(user_lat, user_lon, best_loc.latitude, best_loc.longitude):.1f}km)")

        lat, lon = best_loc.latitude, best_loc.longitude
        # Kiểm tra có trong vùng Mekong Delta không
        in_mekong = (
            MEKONG_BBOX["min_lat"] <= lat <= MEKONG_BBOX["max_lat"]
            and MEKONG_BBOX["min_lon"] <= lon <= MEKONG_BBOX["max_lon"]
        )
        bbox = create_bbox_from_point(lat, lon, radius_km)
        return {
            "type": "resolved",
            "query_name": name,
            "display_name": best_loc.address,
            "lat": lat,
            "lon": lon,
            "radius_km": radius_km,
            "in_mekong": in_mekong,
            "bbox": bbox,
            "resolved": True,
        }
    except Exception as e:
        logger.error(f"Geocoding error for '{name}': {e}")
        return {
            "type": "unresolved",
            "query_name": name,
            "resolved": False,
            "error": f"Lỗi geocoding: {str(e)}",
        }


def resolve_location(intent: dict, user_lat: Optional[float], user_lon: Optional[float]) -> dict:
    """
    Phân giải vị trí từ intent và GPS người dùng.

    Ưu tiên:
    1. GPS người dùng (nếu intent = GPS hoặc "gần tôi")
    2. Tên địa danh từ intent
    3. Không có vị trí → báo lỗi
    """
    location_type = intent.get("location_type", "UNKNOWN")
    location_value = intent.get("location_value")
    radius_km = intent.get("radius_km") or 10.0

    # ── Dạng GPS trực tiếp ──────────────────────────────────────
    if location_type == "GPS":
        # Ưu tiên tọa độ trong intent (frontend gửi), fallback user GPS
        if isinstance(location_value, dict):
            lat = location_value.get("lat") or user_lat
            lon = location_value.get("lon") or user_lon
        else:
            lat, lon = user_lat, user_lon

        if lat is not None and lon is not None:
            return resolve_gps(lat, lon, radius_km)
        else:
            return {
                "type": "unresolved",
                "resolved": False,
                "error": "Cần cung cấp vị trí GPS. Hãy bật GPS hoặc nhập tọa độ.",
            }

    # ── Dạng tên địa danh ───────────────────────────────────────
    elif location_type in ("PLACE_NAME", "DISTRICT", "COMMUNE", "PROVINCE"):
        place_name = None
        if isinstance(location_value, str) and location_value.strip():
            place_name = location_value.strip()
        elif isinstance(location_value, dict):
            place_name = location_value.get("name")

        if place_name:
            res = resolve_place_name(place_name, radius_km, user_lat=user_lat, user_lon=user_lon)
            if res.get("resolved"):
                return res
            # Fallback sang GPS nếu place name không tìm được
            elif user_lat and user_lon:
                logger.info(f"Geocode thất bại cho '{place_name}', fallback về GPS: {user_lat}, {user_lon}")
                gps_res = resolve_gps(user_lat, user_lon, radius_km)
                # Ghi đè display_name để báo cáo việc geocoding thất bại lên UI và LLM
                gps_res["display_name"] = f"Vị trí GPS hiện tại (Không tìm thấy bản đồ cho '{place_name}')"
                gps_res["query_name"] = place_name
                return gps_res
            else:
                return res
        elif user_lat and user_lon:
            # Có GPS người dùng → dùng làm fallback
            logger.info(f"Không có tên địa danh, dùng GPS fallback: {user_lat}, {user_lon}")
            return resolve_gps(user_lat, user_lon, radius_km)
        else:
            return {
                "type": "unresolved",
                "resolved": False,
                "error": f"Không thể xác định vị trí '{place_name or '?'}'. Vui lòng cung cấp GPS.",
            }

    # ── Có GPS người dùng nhưng intent không xác định ───────────
    elif user_lat is not None and user_lon is not None:
        return resolve_gps(user_lat, user_lon, radius_km)

    # ── Không có thông tin vị trí nào ───────────────────────────
    else:
        return {
            "type": "unresolved",
            "resolved": False,
            "error": "Không có thông tin vị trí. Hãy bật GPS hoặc cho biết khu vực bạn muốn phân tích.",
        }


def filter_stations_by_location(stations: list[dict], location: dict, max_stations: int = 10) -> list[dict]:
    """
    Lọc danh sách trạm theo vị trí + bán kính.
    Tự động detect và convert tọa độ UTM Zone 48N → WGS84.
    Trả về danh sách có thêm `distance_km` + `lat_wgs84` + `lon_wgs84`, sắp xếp gần → xa.
    """
    if not location.get("resolved"):
        return stations[:max_stations]

    center_lat = location.get("lat") or location.get("bbox", {}).get("center_lat")
    center_lon = location.get("lon") or location.get("bbox", {}).get("center_lon")
    radius_km = location.get("radius_km", 10.0)

    if center_lat is None or center_lon is None:
        return stations[:max_stations]

    result = []
    for s in stations:
        raw_x = s.get("x")
        raw_y = s.get("y")
        if raw_x is None or raw_y is None:
            continue

        # Auto-detect UTM và convert
        if is_utm_coordinates(raw_x, raw_y):
            lat, lon = utm_to_wgs84(raw_x, raw_y)
        else:
            lat, lon = raw_y, raw_x  # đã là WGS84: y=lat, x=lon

        if lat == 0.0 and lon == 0.0:
            continue  # bỏ qua tọa độ lỗi

        dist = haversine_km(center_lat, center_lon, lat, lon)
        if dist <= radius_km:
            result.append({
                **s,
                "distance_km": round(dist, 2),
                "lat_wgs84": round(lat, 6),
                "lon_wgs84": round(lon, 6),
            })

    result.sort(key=lambda x: x["distance_km"])

    # Fallback: nếu không có trạm nào trong bán kính → lấy 3 trạm gần nhất
    if not result and stations:
        logger.warning(f"Không có trạm trong {radius_km} km. Dùng 3 trạm gần nhất.")
        scored = []
        for s in stations:
            raw_x = s.get("x")
            raw_y = s.get("y")
            if raw_x is None or raw_y is None:
                continue
            if is_utm_coordinates(raw_x, raw_y):
                lat, lon = utm_to_wgs84(raw_x, raw_y)
            else:
                lat, lon = raw_y, raw_x
            if lat == 0.0 and lon == 0.0:
                continue
            dist = haversine_km(center_lat, center_lon, lat, lon)
            scored.append({**s, "distance_km": round(dist, 2), "lat_wgs84": round(lat, 6), "lon_wgs84": round(lon, 6)})
        scored.sort(key=lambda x: x["distance_km"])
        result = scored[:3]

    return result[:max_stations]


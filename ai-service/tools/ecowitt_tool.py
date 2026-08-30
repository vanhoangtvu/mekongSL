import logging
import os
import pymysql
import json
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env variables
load_dotenv()
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '1111')
MYSQL_DB = os.getenv('MYSQL_DB', 'mekong')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))

def get_mysql_connection():
    return pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        port=MYSQL_PORT,
        cursorclass=pymysql.cursors.DictCursor
    )

def _get_all_ecowitt_stations() -> list[dict]:
    """Retrieve all Ecowitt stations with their coordinates."""
    try:
        with get_mysql_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT device_id, name, lat, lng as lon FROM ecowitt_device WHERE lat IS NOT NULL AND lng IS NOT NULL")
                return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error fetching Ecowitt devices: {e}")
        return []

def _get_latest_ecowitt_data(device_id: str) -> dict:
    """Fetch the latest row from ecowitt table for a given device_id."""
    try:
        with get_mysql_connection() as conn:
            with conn.cursor() as cursor:
                # Get the most recent record by fetched_at or record_index
                query = """
                    SELECT fetched_at, tempf_tempf, humidity_humidity, rain_dailyrainin, wind_speed_windspeedmph
                    FROM ecowitt
                    WHERE device_id = %s
                    ORDER BY fetched_at DESC
                    LIMIT 1
                """
                cursor.execute(query, (device_id,))
                return cursor.fetchone()
    except Exception as e:
        logger.error(f"Error fetching latest data for Ecowitt device {device_id}: {e}")
        return None

def _get_ecowitt_history(device_id: str, days: int = 30) -> list[dict]:
    """Fetch historical rows from ecowitt table for temporal analysis."""
    try:
        with get_mysql_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT fetched_at, tempf_tempf, humidity_humidity, rain_dailyrainin, wind_speed_windspeedmph
                    FROM ecowitt
                    WHERE device_id = %s AND fetched_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
                    ORDER BY fetched_at ASC
                """
                cursor.execute(query, (device_id, days))
                return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error fetching history data for Ecowitt device {device_id}: {e}")
        return []

def _fahrenheit_to_celsius(f_str: str) -> float:
    try:
        f = float(f_str)
        return round((f - 32) * 5.0/9.0, 1)
    except:
        return None

def _inch_to_mm(in_str: str) -> float:
    try:
        return round(float(in_str) * 25.4, 1)
    except:
        return None

def _mph_to_ms(mph_str: str) -> float:
    try:
        return round(float(mph_str) * 0.44704, 1)
    except:
        return None

def query_ecowitt_data(location: dict, parameter_key: str) -> dict:
    """
    Fetch Ecowitt weather data for the nearest station to the given location.
    parameter_key can be 'temperature', 'humidity', 'rain', 'wind_speed'.
    """
    if not location.get("bbox") and not (location.get("lat") and location.get("lon")):
        return {"success": False, "error": "Thiếu tọa độ GPS để tìm trạm thời tiết."}

    user_lat = location.get("lat") or location.get("center_lat")
    user_lon = location.get("lon") or location.get("center_lon")

    if not user_lat or not user_lon:
        return {"success": False, "error": "Thiếu tọa độ GPS để tìm trạm thời tiết."}

    from orchestrator.location_resolver import haversine_km
    stations = _get_all_ecowitt_stations()
    
    if not stations:
        return {"success": False, "error": "Không có dữ liệu trạm thời tiết (Ecowitt) trong hệ thống."}

    # Tính khoảng cách và tìm trạm gần nhất
    for s in stations:
        s["distance_km"] = haversine_km(user_lat, user_lon, s["lat"], s["lon"])
    
    stations.sort(key=lambda x: x["distance_km"])
    nearest_station = stations[0]
    
    if nearest_station["distance_km"] > 50.0:
        return {"success": False, "error": f"Không có trạm thời tiết nào trong bán kính 50km (Trạm gần nhất {nearest_station['distance_km']:.1f}km)."}

    device_id = nearest_station["device_id"]
    
    latest_data = _get_latest_ecowitt_data(device_id)
    if not latest_data:
        return {"success": False, "error": f"Không có dữ liệu đo đạc nào cho trạm {nearest_station['name']}."}

    # Extract the requested parameter
    value = 0.0
    unit = ""
    detail_name = ""

    if parameter_key == "temperature":
        # tempf_tempf is in Fahrenheit
        value = _fahrenheit_to_celsius(latest_data.get("tempf_tempf"))
        unit = "°C"
        detail_name = "Nhiệt độ"
    elif parameter_key == "humidity":
        try:
            value = float(latest_data.get("humidity_humidity"))
        except:
            value = None
        unit = "%"
        detail_name = "Độ ẩm"
    elif parameter_key == "rain":
        # rain_dailyrainin is in inches
        value = _inch_to_mm(latest_data.get("rain_dailyrainin"))
        unit = "mm"
        detail_name = "Lượng mưa trong ngày"
    elif parameter_key == "wind_speed":
        # wind_speed_windspeedmph is in mph
        value = _mph_to_ms(latest_data.get("wind_speed_windspeedmph"))
        unit = "m/s"
        detail_name = "Tốc độ gió"
    else:
        return {"success": False, "error": f"Thông số thời tiết '{parameter_key}' không hợp lệ."}

    if value is None:
        return {"success": False, "error": f"Cảm biến {detail_name} tại trạm {nearest_station['name']} bị lỗi (trả về Null)."}

    return {
        "success": True,
        "stations": [nearest_station],
        "value": value,
        "evidence": {
            "dataset": parameter_key,
            "source": f"Trạm thời tiết Ecowitt ({nearest_station['name']})",
            "detail": f"{detail_name}: {value} {unit}. Khoảng cách tới trạm: {nearest_station.get('distance_km', 0):.1f}km",
            "timestamp": latest_data.get("fetched_at").isoformat() if latest_data.get("fetched_at") else "",
            "unit": unit,
            "count": 1
        },
        "summary": {
            parameter_key: {
                "value": value,
                "unit": unit
            }
        }
    }

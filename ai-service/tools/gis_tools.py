from gis_engine.raster_stats import get_raster_stats
from gis_engine.spatial_filter import get_vector_intersections
import logging

logger = logging.getLogger(__name__)

from gis_engine.s3_client import get_latest_file

def query_gis_data(location: dict, plan_item: dict) -> dict:
    """
    Thực thi truy vấn dữ liệu GIS (Raster hoặc Vector) từ S3 dựa trên plan_item.
    
    plan_item format (từ data_catalog):
    {
        'key': 'landuse',
        'source': 's3',
        'spatial_type': 'raster',
        's3_prefix': 'gis-data/landuse/',
        'file_pattern': 'landuse_{year}.tif',
        'latest_year': 2025,
        ...
    }
    """
    if not location.get("bbox"):
        return {"success": False, "error": "Thiếu thông tin bounding box của vị trí."}
    
    bbox = location["bbox"]
    spatial_type = plan_item.get("spatial_type")
    prefix = plan_item.get("s3_prefix", "")
    
    # Định dạng tên file dựa trên năm mới nhất (nếu có {year} placeholder)
    filename = plan_item.get("file_pattern", "")
    if "{year}" in filename:
        filename = filename.replace("{year}", str(plan_item.get("latest_year", 2024)))
    if "{year}" in prefix:
        prefix = prefix.replace("{year}", str(plan_item.get("latest_year", 2024)))
        
    # Nếu file_pattern không chứa {year} và không kết thúc bằng .tif (ví dụ: "salinity", "pH")
    # Chúng ta sẽ tìm file mới nhất trong S3 theo keyword
    if not filename.endswith(".tif") and spatial_type == "raster":
        keyword = filename
        latest_key = get_latest_file(prefix, keyword)
        if latest_key:
            # tách prefix và filename từ latest_key
            # latest_key có dạng: gis-data/.../filename.tif
            # ta gán rỗng cho prefix và dùng toàn bộ key làm filename để hàm get_raster_stats ghép s3://bucket/key
            filename = latest_key
            prefix = ""
        else:
            return {"success": False, "error": f"Không tìm thấy file raster nào chứa keyword '{keyword}'"}

    logger.info(f"Đang query GIS data: {plan_item['key']} | type={spatial_type} | file={filename}")

    if spatial_type == "raster":
        # Xác định cách tính toán. 
        # Landuse -> majority (Mode)
        # Ngập lụt (flood), Độ sâu... -> max hoặc mean
        stat_type = "majority"
        if plan_item["key"] == "flood":
            stat_type = "max"
        elif plan_item["key"] in ["salinity", "ph"]:
            stat_type = "mean"
            
        result = get_raster_stats(prefix, filename, bbox, stat_type=stat_type)
        if result.get("status") == "SUCCESS":
            return {
                "success": True,
                "dataset": plan_item["key"],
                "value": result.get("value"),
                "stat_type": stat_type,
                "summary": {
                    plan_item["key"]: {
                        "value": result.get("value"),
                        "unit": "m" if plan_item["key"] == "flood" else ""
                    }
                },
                "evidence": {
                    "dataset": plan_item["key"],
                    "source": "S3 GIS Storage",
                    "detail": f"File: {filename}, Stat: {stat_type} = {result.get('value')}"
                }
            }
        else:
            return {"success": False, "error": result.get("detail")}
            
    elif spatial_type == "vector":
        result = get_vector_intersections(prefix, filename, bbox)
        if result.get("status") == "SUCCESS":
             return {
                "success": True,
                "dataset": plan_item["key"],
                "count": result.get("count"),
                "features": result.get("features"),
                "summary": {
                    plan_item["key"]: {
                        "value": result.get("count"),
                        "unit": "đối tượng"
                    }
                },
                "evidence": {
                    "dataset": plan_item["key"],
                    "source": "S3 GIS Storage",
                    "detail": f"Tìm thấy {result.get('count')} đối tượng trong file {filename} giao cắt với khu vực."
                }
             }
        else:
             return {"success": False, "error": result.get("detail")}
    
    return {"success": False, "error": f"Loại không gian {spatial_type} chưa được hỗ trợ."}

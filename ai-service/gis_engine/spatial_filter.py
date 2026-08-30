import geopandas as gpd
from shapely.geometry import box
from gis_engine.s3_client import get_rasterio_env
import logging
import os

logger = logging.getLogger(__name__)

S3_BUCKET = os.getenv("S3_BUCKET")

def get_vector_intersections(prefix: str, filename: str, bbox: dict):
    """
    Tải vector (geojson/shp) từ S3 thông qua GDAL /vsis3/ và lọc những đối tượng cắt qua bbox.
    bbox format: {"min_lat": ..., "max_lat": ..., "min_lon": ..., "max_lon": ...}
    """
    # Sử dụng VSI của GDAL
    vsi_path = f"/vsis3/{S3_BUCKET}/{prefix}{filename}"
    env = get_rasterio_env()
    
    # Tạo shapely polygon từ lat/lon bbox (EPSG:4326)
    geom = box(bbox["min_lon"], bbox["min_lat"], bbox["max_lon"], bbox["max_lat"])
    bbox_gdf = gpd.GeoDataFrame({'geometry': [geom]}, crs="EPSG:4326")
    
    try:
        with env:
            # bbox filter lúc đọc: giúp fiona/gdal chỉ tải phần dữ liệu cần thiết nếu file có spatial index
            # Vì ta truyền bbox cho read_file (nó tính bằng bounding box), cần đưa bounding tuple
            bbox_tuple = (bbox["min_lon"], bbox["min_lat"], bbox["max_lon"], bbox["max_lat"])
            
            gdf = gpd.read_file(vsi_path, bbox=bbox_tuple)
            
            if gdf.empty:
                return {"status": "NO_DATA", "detail": "Không có đối tượng nào trong khu vực này."}
            
            # Reproject nếu khác
            if gdf.crs != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            
            # Lọc chính xác theo intersect
            intersected = gpd.sjoin(gdf, bbox_gdf, how="inner", predicate="intersects")
            
            if intersected.empty:
                return {"status": "NO_DATA", "detail": "Không có đối tượng nào giao cắt với khu vực này."}
            
            # Trả về metadata cơ bản của các feature (VD: tên kênh, phân loại...)
            # Ta lấy 5 thuộc tính đầu tiên nếu có để tránh payload quá lớn
            results = []
            for _, row in intersected.iterrows():
                # Lấy tất cả cột ngoại trừ geometry, index_right
                props = {col: row[col] for col in intersected.columns if col not in ['geometry', 'index_right']}
                results.append(props)
                
            return {"status": "SUCCESS", "count": len(results), "features": results[:5]}

    except Exception as e:
        logger.error(f"Lỗi xử lý vector {vsi_path}: {e}")
        return {"status": "ERROR", "detail": str(e)}

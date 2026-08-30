import rasterio
from rasterio.mask import mask
from shapely.geometry import box
import geopandas as gpd
import numpy as np
from gis_engine.s3_client import get_rasterio_env, get_s3_path
import logging
from collections import Counter

logger = logging.getLogger(__name__)

def get_raster_stats(prefix: str, filename: str, bbox: dict, stat_type: str = "majority"):
    """
    Mở file TIFF từ S3, cắt theo bbox và tính thống kê.
    stat_type: 'majority' (cho phân loại đất), 'mean', 'max' (cho ngập lũ)
    bbox format: {"min_lat": ..., "max_lat": ..., "min_lon": ..., "max_lon": ...}
    """
    s3_path = get_s3_path(prefix, filename)
    env = get_rasterio_env()
    
    # Tạo shapely polygon từ lat/lon bbox (EPSG:4326)
    geom = box(bbox["min_lon"], bbox["min_lat"], bbox["max_lon"], bbox["max_lat"])
    gdf = gpd.GeoDataFrame({'geometry': [geom]}, crs="EPSG:4326")
    
    try:
        # Tải file raster vào memory bằng boto3 thay vì /vsis3/
        # Việc này giải quyết lỗi NoSuchKey do gdal chuẩn hóa path chứa ///
        from gis_engine.s3_client import get_boto3_client, S3_BUCKET
        s3 = get_boto3_client()
        s3_key = prefix + filename
        
        logger.info(f"Đang tải S3 Object: Bucket={S3_BUCKET}, Key={s3_key}")
        response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
        file_bytes = response['Body'].read()
        
        with rasterio.MemoryFile(file_bytes) as memfile:
            with memfile.open() as src:
                # Kiểm tra và giả định CRS nếu bị thiếu (Dữ liệu VN2000 thường mất tag)
                raster_crs = src.crs
                if not raster_crs:
                    if src.bounds.left > 1000 or src.bounds.bottom > 1000:
                        raster_crs = "EPSG:32648"
                        logger.warning(f"File {filename} thiếu CRS, đoán là EPSG:32648 (dựa trên bounds {src.bounds.left})")
                    else:
                        raster_crs = "EPSG:4326"
                        logger.warning(f"File {filename} thiếu CRS, đoán là EPSG:4326")
                        
                # Reproject bbox sang CRS của raster
                if raster_crs and raster_crs != "EPSG:4326":
                    gdf = gdf.to_crs(raster_crs)
                
                # Trích xuất hình học để cắt
                geoms = gdf.geometry.values
                logger.info(f"DEBUG: geom bounds = {geoms[0].bounds}")
                logger.info(f"DEBUG: raster bounds = {src.bounds}")
                
                # Thực hiện crop
                out_image, out_transform = mask(src, geoms, crop=True)
                # Loại bỏ nodata
                nodata = src.nodata
                data = out_image[0]
                
                if nodata is not None:
                    valid_data = data[data != nodata]
                else:
                    # Rất nhiều TIF VN thiếu tag nodata, dùng -9999 hoặc 0
                    valid_data = data[data != -9999]
                    if stat_type == "mean":
                        # Đối với pH và Salinity (mean), 0.0 thường là vùng background (nodata)
                        valid_data = valid_data[valid_data != 0]
                
                if len(valid_data) == 0:
                    return {"status": "NO_DATA", "detail": "Khu vực này không có dữ liệu raster hợp lệ"}
                
                valid_data_flat = valid_data.flatten()
                
                if stat_type == "majority":
                    # Tìm giá trị xuất hiện nhiều nhất (Mode)
                    counts = Counter(valid_data_flat)
                    majority_val = counts.most_common(1)[0][0]
                    return {"status": "SUCCESS", "value": float(majority_val)}
                elif stat_type == "mean":
                    mean_val = np.mean(valid_data_flat)
                    return {"status": "SUCCESS", "value": round(float(mean_val), 2)}
                elif stat_type == "max":
                    max_val = np.max(valid_data_flat)
                    return {"status": "SUCCESS", "value": float(max_val)}
                else:
                    return {"status": "ERROR", "detail": f"Unsupported stat_type: {stat_type}"}

    except rasterio.errors.RasterioIOError as e:
        logger.error(f"Không thể đọc file {s3_path}: {e}")
        return {"status": "ERROR", "detail": f"File không tồn tại hoặc lỗi kết nối S3."}
    except Exception as e:
        logger.error(f"Lỗi xử lý raster {s3_path}: {e}")
        return {"status": "ERROR", "detail": str(e)}

import os
import boto3
from dotenv import load_dotenv
import rasterio
from rasterio.session import AWSSession
import logging

logger = logging.getLogger(__name__)

load_dotenv()

S3_ENDPOINT = os.getenv("S3_ENDPOINT")
S3_BUCKET = os.getenv("S3_BUCKET")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

def get_boto3_client():
    """Tạo boto3 client để thao tác cơ bản với S3."""
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION
    )

def get_rasterio_env():
    """
    Khởi tạo Boto3 Session trỏ tới MinIO/S3 
    và cấu hình Rasterio/GDAL Environment để hỗ trợ /vsis3/
    """
    boto_session = boto3.Session(
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION
    )
    
    # Thiết lập biến môi trường cho GDAL/Fiona (đọc GeoJSON qua /vsis3/)
    os.environ['AWS_ACCESS_KEY_ID'] = S3_ACCESS_KEY
    os.environ['AWS_SECRET_ACCESS_KEY'] = S3_SECRET_KEY
    os.environ['AWS_S3_ENDPOINT'] = S3_ENDPOINT.replace("http://", "").replace("https://", "")
    os.environ['AWS_HTTPS'] = 'NO' if 'http://' in S3_ENDPOINT else 'YES'
    os.environ['AWS_VIRTUAL_HOSTING'] = 'FALSE'
    
    # Sử dụng AWSSession với endpoint_url custom
    aws_session = AWSSession(boto_session, endpoint_url=S3_ENDPOINT)
    
    # Các config GDAL cần thiết cho S3
    env = rasterio.Env(
        aws_session,
        AWS_HTTPS="YES" if S3_ENDPOINT.startswith("https") else "NO",
        AWS_VIRTUAL_HOSTING="FALSE",
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"
    )
    return env

def get_s3_path(prefix: str, filename: str) -> str:
    """Trả về S3 URI (s3://bucket/path) cho rasterio."""
    return f"s3://{S3_BUCKET}/{prefix}{filename}"

def get_latest_file(prefix: str, keyword: str) -> str:
    """Tìm file mới nhất trong bucket thỏa mãn keyword (ví dụ 'salinity' hoặc 'pH')."""
    s3 = get_boto3_client()
    try:
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        files = response.get('Contents', [])
        if not files:
            return ""
        
        # Lọc các file chứa keyword (không phân biệt hoa thường) và có đuôi .tif
        matched_files = [f['Key'] for f in files if keyword.lower() in f['Key'].lower() and f['Key'].endswith('.tif')]
        if not matched_files:
            return ""
            
        # Sắp xếp theo tên file (chuỗi ISO/Date) hoặc Key
        matched_files.sort(reverse=True)
        return matched_files[0]
    except Exception as e:
        logger.error(f"Lỗi khi tìm file mới nhất trên S3: {e}")
        return ""

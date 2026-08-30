import boto3
import os
from dotenv import load_dotenv

load_dotenv()
s3 = boto3.client('s3', endpoint_url=os.getenv("S3_ENDPOINT"), aws_access_key_id=os.getenv("S3_ACCESS_KEY"), aws_secret_access_key=os.getenv("S3_SECRET_KEY"))
res = s3.list_objects_v2(Bucket=os.getenv("S3_BUCKET"), Prefix='gis-data/')
for obj in res.get('Contents', []):
    print(obj['Key'])

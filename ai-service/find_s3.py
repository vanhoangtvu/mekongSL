import boto3
import os
from dotenv import load_dotenv

load_dotenv()
s3 = boto3.client('s3', endpoint_url=os.getenv("S3_ENDPOINT"), aws_access_key_id=os.getenv("S3_ACCESS_KEY"), aws_secret_access_key=os.getenv("S3_SECRET_KEY"))

paginator = s3.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket=os.getenv("S3_BUCKET"), Prefix='gis-data/')
for page in pages:
    for obj in page.get('Contents', []):
        key = obj['Key'].lower()
        if 'flood' in key or 'landuse' in key or 'soil' in key or 'channel' in key or 'waterway' in key:
            print(obj['Key'])

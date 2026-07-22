#!/usr/bin/env python3
"""
Download all GIS data files from S3 for the project report.
Target folders: landuse-planning, administration, channel-system (district files)
"""
import boto3
import os
import sys

# S3 config
endpoint = "https://backup.hci.vn"
bucket = "c01-mekong-prod-01"
access_key = "WGU85A069Z04ESKJXYHF"
secret_key = "E9YWIUztSKCGxEtmETrxBPmzl4XCBadOnPMNxTYH"

# Output directory
output_dir = "/home/hv/DuAn/Mekong/docs/gis-files"

# Create S3 client
s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name="us-east-1",
)

# Prefixes to download (district-related data)
prefixes = [
    "gis-data/baseline-environment/landuse-planning/",
    "gis-data/baseline-environment/channel-system/",
    "gis-data/administration/",
]

# Also get overall listing for inventory
all_prefixes = [
    "gis-data/hydrology/",
    "gis-data/landsat-imagery/",
    "gis-data/baseline-environment/landuse-classification/",
    "gis-data/baseline-environment/landuse-planning/",
    "gis-data/baseline-environment/channel-system/",
    "gis-data/administration/",
    "gis-data/flooding-modeling/",
    "gis-data/cog/",
]

def count_files(prefix):
    """Count files under a prefix"""
    total = 0
    total_size = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        if "Contents" in page:
            for obj in page["Contents"]:
                if not obj["Key"].endswith("/"):
                    total += 1
                    total_size += obj["Size"]
    return total, total_size

def download_prefix(prefix):
    """Download all files under a prefix"""
    local_dir = os.path.join(output_dir, prefix.rstrip("/").replace("gis-data/", "").replace("/", "_"))
    count = 0
    errors = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        if "Contents" not in page:
            continue
        for obj in page["Contents"]:
            key = obj["Key"]
            if key.endswith("/"):
                continue
            # Create local path preserving structure
            rel_path = key.replace("gis-data/", "", 1)
            local_path = os.path.join(output_dir, rel_path)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            try:
                s3.download_file(bucket, key, local_path)
                count += 1
                size_kb = obj["Size"] / 1024
                print(f"  ✅ {rel_path} ({size_kb:.1f} KB)")
            except Exception as e:
                errors += 1
                print(f"  ❌ {rel_path}: {e}")
    return count, errors

# Step 1: Inventory all files
print("=" * 70)
print("📊 KIỂM TRA TOÀN BỘ DỮ LIỆU GIS TRÊN S3")
print("=" * 70)
total_files = 0
total_size_bytes = 0
for prefix in all_prefixes:
    n, sz = count_files(prefix)
    total_files += n
    total_size_bytes += sz
    if n > 0:
        print(f"  📁 {prefix}: {n} files, {sz/1024/1024:.1f} MB")

print(f"\n  📊 Tổng cộng: {total_files} files, {total_size_bytes/1024/1024:.1f} MB")
print()

# Step 2: Download district-related files
print("=" * 70)
print("📥 ĐANG TẢI FILE CỦA CÁC HUYỆN (landuse-planning, channel-system, administration)")
print("=" * 70)
for prefix in prefixes:
    print(f"\n📁 {prefix}")
    count, errors = download_prefix(prefix)
    print(f"  → Đã tải: {count} files, Lỗi: {errors}")

print()
print("=" * 70)
print("✅ HOÀN THÀNH!")
print(f"📂 Thư mục đầu ra: {output_dir}")
print("=" * 70)

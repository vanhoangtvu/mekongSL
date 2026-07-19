#!/usr/bin/env python3
"""Batch convert landuse GeoTIFFs to COG and upload to S3."""
import json, os, subprocess, sys, tempfile, time

BACKEND = "http://localhost:8084"
PREFIX = "gis-data/baseline-environment/landuse-classification/"
COG_PREFIX = "gis-data/cog/"
TMP = "/tmp/cog_batch2"
os.makedirs(TMP, exist_ok=True)

def run(cmd, **kw):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)

# Login
r = run(f'curl -s -X POST "{BACKEND}/api/auth/login" -H "Content-Type: application/json" -d \'{{"username":"admin","password":"admin123"}}\'')
token = json.loads(r.stdout).get("token", "")
if not token:
    print("❌ Login failed")
    sys.exit(1)
print(f"✅ Token: {token[:20]}...")

# List files
r = run(f'curl -s "{BACKEND}/api/s3/list?prefix={PREFIX}"')
files = json.loads(r.stdout).get("files", [])
tifs = [f["key"] for f in files if f["key"].endswith(".tif") and "cog" not in f["key"]]
print(f"📋 Found {len(tifs)} files to convert\n")

for i, key in enumerate(tifs):
    fname = key.split("/")[-1]
    cog_key = key.replace("gis-data/", COG_PREFIX, 1).replace(".tif", "_cog.tif")
    local_in = f"{TMP}/{fname}"
    local_out = f"{TMP}/{fname.replace('.tif', '_cog.tif')}"
    
    print(f"[{i+1}/{len(tifs)}] {fname}", flush=True)
    
    # Download
    r = run(f'curl -s -o "{local_in}" "{BACKEND}/api/s3/download?key={key}"')
    if not os.path.exists(local_in) or os.path.getsize(local_in) < 1000:
        print(f"  ⚠ Download failed, skip")
        continue
    
    sz_in = os.path.getsize(local_in)
    print(f"  ⬇ {sz_in:,} bytes", flush=True)
    
    # Convert to COG
    r = run(f'gdal_translate "{local_in}" "{local_out}" -co TILED=YES -co BLOCKXSIZE=256 -co BLOCKYSIZE=256 -co COMPRESS=DEFLATE -co PREDICTOR=2 -co NUM_THREADS=ALL_CPUS -of GTiff 2>/dev/null')
    if not os.path.exists(local_out):
        print(f"  ⚠ Conversion failed")
        os.remove(local_in)
        continue
    
    # Add overviews
    run(f'gdaladdo -r AVERAGE "{local_out}" 2 4 8 16 2>/dev/null')
    
    sz_out = os.path.getsize(local_out)
    pct = (sz_in - sz_out) * 100 / sz_in
    print(f"  ✅ {sz_out:,} bytes ({pct:.0f}% reduction)", flush=True)
    
    # Upload
    r = run(f'curl -s -X POST "{BACKEND}/api/s3/upload?key={cog_key}&overwrite=true" -H "Authorization: Bearer {token}" -F "file=@{local_out}" -F "overwrite=true"')
    resp = json.loads(r.stdout)
    if resp.get("key"):
        print(f"  ☁ Uploaded: S3 OK", flush=True)
    else:
        print(f"  ⚠ Upload: {resp.get('error', 'unknown')}", flush=True)
    
    # Cleanup
    os.remove(local_in)
    os.remove(local_out)
    print()

print(f"✅ Done! Converted {len(tifs)} files")

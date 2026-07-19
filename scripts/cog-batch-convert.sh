#!/bin/bash
# Batch convert all GeoTIFF files from S3 to COG format
# Processes hydrology (salinity, tidal, pH), flooding, and other raster data
#
# Usage: ./scripts/cog-batch-convert.sh [prefix]
#   prefix: gis-data/hydrology/salinity (default: all)
#
# Flow: List S3 → Download → Convert COG → Upload to gis-data-cog/
# Requires: gdal-bin, curl, jq

set -euo pipefail

BACKEND_URL="http://localhost:8084"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load S3 credentials for upload
set -a
source "$PROJECT_DIR/.env"
set +a

PREFIX="${1:-gis-data}"
COG_PREFIX="${PREFIX/gis-data/gis-data-cog}"
TMP_DIR="/tmp/cog-batch-$$"
mkdir -p "$TMP_DIR"

echo "📋 Batch COG Conversion"
echo "   Source: $PREFIX"
echo "   Target: $COG_PREFIX"
echo "   Temp:   $TMP_DIR"
echo ""

# Step 1: List all TIF files from S3
echo "🔍 Listing files from S3..."
FILES_JSON=$(curl -s "$BACKEND_URL/api/s3/list?prefix=$PREFIX")
TIF_KEYS=$(echo "$FILES_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for f in d.get('files', []):
    k = f.get('key', '')
    if k.endswith('.tif') and not k.endswith('_cog.tif'):
        print(k)
")

TIF_COUNT=$(echo "$TIF_KEYS" | wc -l)
echo "   Found $TIF_COUNT TIF files"
echo ""

# Step 2: Process each file
COUNT=0
SUCCESS=0
FAIL=0

for KEY in $TIF_KEYS; do
    COUNT=$((COUNT + 1))
    COG_KEY="${KEY/gis-data/gis-data-cog}"
    COG_KEY="${COG_KEY%.*}_cog.tif"
    
    # Determine CRS based on data type
    CRS_ARGS=""
    if echo "$KEY" | grep -qE "^(gis-data/|gis-data-cog/)"; then
        # All Mekong data is in UTM 48N (EPSG:32648)
        CRS_ARGS="-a_srs EPSG:32648"
    fi
    
    LOCAL_FILE="$TMP_DIR/$(basename "$KEY")"
    LOCAL_COG="$TMP_DIR/$(basename "$COG_KEY")"
    
    echo "[$COUNT/$TIF_COUNT] Processing: $(basename "$KEY")"
    
    # Download
    echo "   ⬇ Downloading..."
    curl -s -o "$LOCAL_FILE" "$BACKEND_URL/api/s3/download?key=$KEY" 2>/dev/null
    if [ ! -f "$LOCAL_FILE" ] || [ ! -s "$LOCAL_FILE" ]; then
        echo "   ⚠ Download failed, skipping"
        FAIL=$((FAIL + 1))
        continue
    fi
    
    SIZE_BEFORE=$(stat -c%s "$LOCAL_FILE" 2>/dev/null || echo 0)
    echo "   📦 Size: $SIZE_BEFORE bytes"
    
    # Convert to COG
    echo "   🔄 Converting to COG..."
    gdal_translate "$LOCAL_FILE" "$LOCAL_COG" \
        $CRS_ARGS \
        -co TILED=YES \
        -co BLOCKXSIZE=256 \
        -co BLOCKYSIZE=256 \
        -co COMPRESS=DEFLATE \
        -co PREDICTOR=2 \
        -co NUM_THREADS=ALL_CPUS \
        -of GTiff 2>/dev/null
    
    if [ ! -f "$LOCAL_COG" ]; then
        echo "   ⚠ Conversion failed, skipping"
        FAIL=$((FAIL + 1))
        rm -f "$LOCAL_FILE"
        continue
    fi
    
    # Add overviews
    echo "   🏔 Adding overviews..."
    gdaladdo -r AVERAGE "$LOCAL_COG" 2 4 8 16 2>/dev/null
    
    SIZE_AFTER=$(stat -c%s "$LOCAL_COG" 2>/dev/null || echo 0)
    PCT=$(( (SIZE_BEFORE - SIZE_AFTER) * 100 / SIZE_BEFORE )) || PCT=0
    echo "   ✅ COG ready: $SIZE_AFTER bytes (${PCT}% reduction)"
    
    # Upload back to S3
    echo "   ⬆ Uploading to S3..."
    UPLOAD_URL="$BACKEND_URL/api/s3/upload?key=$COG_KEY&overwrite=true"
    TOKEN=$(curl -s "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}' 2>/dev/null | python3 -c "
import sys, json
try: print(json.load(sys.stdin).get('token',''))
except: print('')" 2>/dev/null)
    
    if [ -n "$TOKEN" ]; then
        curl -s -X POST "$UPLOAD_URL" \
            -H "Authorization: Bearer $TOKEN" \
            -F "file=@$LOCAL_COG" \
            -F "key=$COG_KEY" \
            -F "overwrite=true" 2>/dev/null | python3 -c "
import sys, json
try: 
    r = json.load(sys.stdin)
    print(f'   ✅ Uploaded: {r.get(\"key\",\"\")}')
except: print('   ⚠ Upload response parse failed')"
    else:
        echo "   ⚠ No auth token, upload skipped"
    fi
    
    # Cleanup
    rm -f "$LOCAL_FILE" "$LOCAL_COG"
    SUCCESS=$((SUCCESS + 1))
    echo ""
done

# Summary
echo "═══════════════════════════════════════"
echo "📊 Kết quả:"
echo "   Tổng:    $TIF_COUNT"
echo "   Thành công: $SUCCESS"
echo "   Lỗi:     $FAIL"
echo "   Thư mục COG: $COG_PREFIX"
echo "═══════════════════════════════════════"

# Cleanup
rm -rf "$TMP_DIR"

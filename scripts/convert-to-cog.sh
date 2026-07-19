#!/bin/bash
# Batch convert GeoTIFF files to Cloud Optimized GeoTIFF (COG)
# Usage: ./scripts/convert-to-cog.sh <input-file-or-dir>
#
# Requires: gdal-bin (apt install gdal-bin)
#
# Example:
#   # Convert single file
#   ./scripts/convert-to-cog.sh input.tif
#
#   # Convert all .tif files in a directory
#   find /path/to/tifs -name "*.tif" -exec ./scripts/convert-to-cog.sh {} \;

set -euo pipefail

INPUT="$1"
if [ -z "$INPUT" ]; then
    echo "Usage: $0 <input.tif>"
    echo "Converts a GeoTIFF to COG format with proper tiling and overviews."
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "Error: File not found: $INPUT"
    exit 1
fi

# Determine output path
DIRNAME=$(dirname "$INPUT")
BASENAME=$(basename "$INPUT")
NAME="${BASENAME%.*}"
EXT="${BASENAME##*.}"

# Output in same directory with _cog suffix
OUTPUT="${DIRNAME}/${NAME}_cog.${EXT}"

echo "Converting: $INPUT → $OUTPUT"

# Step 1: Check if file has valid CRS, default to EPSG:32648 (UTM 48N)
CRS=$(gdalinfo "$INPUT" 2>/dev/null | grep -i "AUTHORITY.*EPSG" | head -1 | grep -oP 'EPSG:\d+' || echo "")
if [ -z "$CRS" ]; then
    echo "  ⚠ No CRS found, assuming EPSG:32648 (UTM 48N)"
    CRS_ARGS="-a_srs EPSG:32648"
else
    CRS_ARGS=""
fi

# Step 2: Convert to COG with tiling
gdal_translate "$INPUT" "$OUTPUT" \
    $CRS_ARGS \
    -co TILED=YES \
    -co BLOCKXSIZE=256 \
    -co BLOCKYSIZE=256 \
    -co COMPRESS=DEFLATE \
    -co PREDICTOR=2 \
    -co NUM_THREADS=ALL_CPUS \
    -of GTiff 2>&1 | sed 's/^/  /'

echo "  → Created: $OUTPUT"

# Step 3: Add overviews (pyramids)
gdaladdo -r AVERAGE "$OUTPUT" 2 4 8 16 2>&1 | sed 's/^/  /'

echo "  → Overviews added"

# Step 4: Verify
SIZE_BEFORE=$(stat -c%s "$INPUT" 2>/dev/null || echo 0)
SIZE_AFTER=$(stat -c%s "$OUTPUT" 2>/dev/null || echo 0)
echo "  → Size: $SIZE_BEFORE → $SIZE_AFTER bytes ($(( (SIZE_BEFORE - SIZE_AFTER) * 100 / SIZE_BEFORE ))% reduction)"

echo "✅ Done: $OUTPUT"

#!/bin/bash
# Auto-optimize GIS data on S3
# - Raster: GeoTIFF → COG (tiled, compressed, overviews)
# Original files are PRESERVED. Optimized versions stored in gis-data/cog/
#
# Usage: ./scripts/auto-cog-watch.sh                         # scan + convert once
# Usage: ./scripts/auto-cog-watch.sh --watch                  # run continuously
# Usage: ./scripts/auto-cog-watch.sh --watch --interval 300  # check every 300s
# Usage: ./scripts/auto-cog-watch.sh --force                 # re-convert all (even if exists)
#
# Add to crontab:
#   */5 * * * * /home/hv/DuAn/Mekong/scripts/auto-cog-watch.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND="http://localhost:8084"
TMP="/tmp/auto-opt-$$"
WATCH_MODE=false
FORCE=false
INTERVAL=300

# Parse args
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH_MODE=true ;;
    --force) FORCE=true ;;
    --interval=*) INTERVAL="${arg#*=}" ;;
  esac
done

mkdir -p "$TMP"

# Login once
TOKEN=$(curl -s -X POST "$BACKEND/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed (check backend is running)"
  exit 1
fi

convert_file() {
  local orig_key="$1"
  local fname=$(basename "$orig_key")
  
  # Build COG key: gis-data/cog/... instead of gis-data/...
  local cog_key="${orig_key/gis-data\//gis-data\/cog\/}"
  cog_key="${cog_key%.tif}_cog.tif"
  
  # Check if COG already exists (use token for auth)
  local check_url="$BACKEND/api/s3/list?prefix=${cog_key%/*}/"
  local exists=$(curl -s -H "Authorization: Bearer $TOKEN" "$check_url" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
for f in d.get('files', []):
    if f['key'] == '$cog_key':
        print('yes')
        break
" 2>/dev/null)
  
  if [ "$exists" = "yes" ] && ! $FORCE; then
    echo "  ⏭ $fname → COG already exists"
    return 0
  fi
  
  local local_file="$TMP/$fname"
  local local_cog="$TMP/${fname%.*}_cog.tif"
  
  echo -n "  🔄 $fname... "
  
  # Download original
  curl -s -o "$local_file" "$BACKEND/api/s3/download?key=$orig_key" 2>/dev/null
  if [ ! -s "$local_file" ]; then echo "❌ download fail"; rm -f "$local_file"; return 1; fi
  
  local size_before=$(stat -c%s "$local_file" 2>/dev/null || echo 0)
  
  # Convert to COG
  gdal_translate "$local_file" "$local_cog" \
    -co TILED=YES \
    -co BLOCKXSIZE=256 \
    -co BLOCKYSIZE=256 \
    -co COMPRESS=DEFLATE \
    -co PREDICTOR=2 \
    -co NUM_THREADS=ALL_CPUS \
    -of GTiff 2>/dev/null
  
  if [ ! -s "$local_cog" ]; then echo "❌ convert fail"; rm -f "$local_file"; return 1; fi
  
  # Add overviews
  gdaladdo -r AVERAGE "$local_cog" 2 4 8 16 2>/dev/null
  
  local size_after=$(stat -c%s "$local_cog" 2>/dev/null || echo 0)
  local pct=$(( (size_before - size_after) * 100 / size_before )) || pct=0
  
  # Upload COG to gis-data/cog/ (NOT overwriting original)
  local resp=$(curl -s -X POST "$BACKEND/api/s3/upload?key=$cog_key&overwrite=false" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$local_cog" \
    -F "overwrite=false" 2>/dev/null)
  
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('key') else 1)" 2>/dev/null; then
    echo "✅ ${size_before}KB → ${size_after}KB (-${pct}%)"
    echo "     Original: $orig_key"
    echo "     COG:      $cog_key"
  else
    # Maybe already exists (overwrite=false)
    if echo "$resp" | grep -qi "already exists"; then
      echo "⏭ already exists"
    else
      echo "❌ upload fail: $(echo $resp | head -c 100)"
    fi
  fi
  
  rm -f "$local_file" "$local_cog"
}

scan_and_convert() {
  echo "🔍 Scanning S3 for files to optimize..."
  echo ""
  
  # ── Phase 1: Raster (GeoTIFF → COG) ──
  echo "📡 Raster: checking landuse-classification TIF files..."
  curl -s "$BACKEND/api/s3/list?prefix=gis-data/baseline-environment/landuse-classification/" 2>/dev/null | \
    python3 -c "
import sys, json
d = json.load(sys.stdin)
files = d.get('files', [])
for f in files:
    key = f['key']
    if key.endswith('.tif') and not key.endswith('_cog.tif') and 'cog' not in key.split('/')[-1]:
        print(key)
" 2>/dev/null | while read key; do
    convert_file "$key"
  done
  
  echo ""
  echo "📡 Raster: checking landsat-imagery TIF files..."
  curl -s "$BACKEND/api/s3/list?prefix=gis-data/landsat-imagery/" 2>/dev/null | \
    python3 -c "
import sys, json
d = json.load(sys.stdin)
files = d.get('files', [])
for f in files:
    key = f['key']
    if key.endswith('.tif') and not key.endswith('_cog.tif') and 'cog' not in key.split('/')[-1]:
        print(key)
" 2>/dev/null | while read key; do
    convert_file "$key"
  done
  
  echo ""
  echo "✅ Scan complete"
}

scan_and_convert

if $WATCH_MODE; then
  echo ""
  echo "👀 Watch mode: checking every ${INTERVAL}s..."
  while true; do
    sleep "$INTERVAL"
    scan_and_convert
  done
fi

rm -rf "$TMP"

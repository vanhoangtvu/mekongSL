#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Dừng backend & frontend ==="
bash "$SCRIPT_DIR/backend/stop.sh" 2>/dev/null || true
bash "$SCRIPT_DIR/frontend/stop.sh" 2>/dev/null || true
sleep 2

echo ""
echo "=== Rebuild backend ==="
cd "$SCRIPT_DIR/backend"
./mvnw -q clean compile -DskipTests -Djansi.tmpdir="$SCRIPT_DIR/backend/target/tmp"
echo "Backend compiled OK"

echo ""
echo "=== Start backend ==="
bash "$SCRIPT_DIR/backend/start.sh"

echo ""
echo "=== Start frontend ==="
bash "$SCRIPT_DIR/frontend/start.sh"

echo ""
echo "=== Done ==="
echo "Backend:  http://14.183.200.227:8084"
echo "Frontend: http://14.183.200.227:3004"

#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"
LOG_FILE="$SCRIPT_DIR/backend.log"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Backend is already running with PID: $OLD_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$SCRIPT_DIR"

# Source environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
fi

# Cấu hình temp dir cho Jansi để tránh lỗi thư mục /tmp bị noexec
export MAVEN_OPTS="-Djansi.tmpdir=$SCRIPT_DIR/target/tmp"
mkdir -p "$SCRIPT_DIR/target/tmp"

echo "Compiling backend..."
./mvnw -q clean compile -DskipTests

echo "Starting backend on 0.0.0.0:8084..."
nohup ./mvnw spring-boot:run > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Backend started with PID: $(cat "$PID_FILE")"
echo "Access at: http://113.170.158.188:8084"
echo "Logs: tail -f $LOG_FILE"

#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.frontend.pid"
LOG_FILE="$SCRIPT_DIR/app.log"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Frontend đang chạy với PID: $OLD_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$SCRIPT_DIR"

echo "Building frontend..."
> "$LOG_FILE"
npm run build >> "$LOG_FILE" 2>&1 || { echo "Build failed!"; tail -20 "$LOG_FILE"; exit 1; }

echo "Starting frontend production server on 0.0.0.0:3004..."
nohup npm start -- -H 0.0.0.0 -p 3004 >> "$LOG_FILE" 2>&1 &
FPID=$!
echo "$FPID" > "$PID_FILE"
disown "$FPID"

for _ in {1..30}; do
  if grep -q "Local:" "$LOG_FILE" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "Frontend đang chạy. PID: $(cat "$PID_FILE")"
echo "Truy cập tại: https://103.54.251.212"
echo "Xem log: tail -f $LOG_FILE"

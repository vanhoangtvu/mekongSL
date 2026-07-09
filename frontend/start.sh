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

echo "Starting frontend dev server on 0.0.0.0:3004..."
:
> "$LOG_FILE"
FRONTEND_PID_FILE="$PID_FILE" setsid sh -c 'echo $$ > "$FRONTEND_PID_FILE"; exec npm run dev -- -H 0.0.0.0 -p 3004' > "$LOG_FILE" 2>&1 &

for _ in {1..20}; do
  if [[ -s "$PID_FILE" ]]; then
    break
  fi
  sleep 1
done

echo "Frontend đang chạy. PID: $(cat "$PID_FILE")"
echo "Truy cập tại: http://123.22.61.134:3004"
echo "Xem log: tail -f $LOG_FILE"

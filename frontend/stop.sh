#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.frontend.pid"
PORT=3004

stop_pid() {
  local target_pid="$1"
  if [[ -z "$target_pid" ]]; then
    return 0
  fi

  if kill -0 "$target_pid" 2>/dev/null; then
    kill -- -"$target_pid" 2>/dev/null || true
    kill "$target_pid" 2>/dev/null || true
  fi
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "Không tìm thấy file .frontend.pid."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "PID file trống, đã dọn."
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "Frontend không chạy, đã dọn PID file."
  exit 0
fi

echo "Đang dừng Mekong Frontend (PID: $PID)..."
stop_pid "$PID"

for _ in {1..20}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Đã dừng thành công."
    exit 0
  fi
  sleep 1
done

LISTENER_PIDS="$(ss -ltnp "( sport = :$PORT )" 2>/dev/null | awk -F'pid=' 'NR > 1 && $0 ~ /pid=/ {split($2, parts, ","); print parts[1]}' | sort -u)"
for listener_pid in $LISTENER_PIDS; do
  echo "Đang dừng tiến trình đang lắng nghe cổng $PORT (PID: $listener_pid)..."
  stop_pid "$listener_pid"
done

sleep 1
LISTENER_PIDS="$(ss -ltnp "( sport = :$PORT )" 2>/dev/null | awk -F'pid=' 'NR > 1 && $0 ~ /pid=/ {split($2, parts, ","); print parts[1]}' | sort -u)"
if [[ -z "$LISTENER_PIDS" ]]; then
  rm -f "$PID_FILE"
  echo "Đã dừng thành công."
  exit 0
fi

echo "Tiến trình chưa dừng, gửi SIGKILL..."
stop_pid "$PID"
for listener_pid in $LISTENER_PIDS; do
  kill -9 -- -"$listener_pid" 2>/dev/null || kill -9 "$listener_pid" 2>/dev/null || true
done
rm -f "$PID_FILE"
echo "Đã dừng thành công."

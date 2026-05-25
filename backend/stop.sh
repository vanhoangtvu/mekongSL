#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Backend is not running."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [[ -z "$PID" ]]; then
  echo "PID file is empty. Removing stale file."
  rm -f "$PID_FILE"
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running. Removing stale PID file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping backend process $PID..."
kill "$PID"

for _ in {1..20}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Backend stopped."
    exit 0
  fi
  sleep 1
done

echo "Process did not stop in time, sending SIGKILL..."
kill -9 "$PID"
rm -f "$PID_FILE"
echo "Backend stopped."

#!/bin/bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"

echo "=== Restarting Mekong Backend ==="

# Kill existing process
if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping backend PID: $OLD_PID..."
    kill "$OLD_PID"
    sleep 3
    if kill -0 "$OLD_PID" 2>/dev/null; then
      echo "Force killing..."
      kill -9 "$OLD_PID"
      sleep 1
    fi
    echo "Stopped."
  fi
  rm -f "$PID_FILE"
else
  echo "No PID file found, checking for running backend..."
  RUNNING_PID=$(ps aux | grep "mekongsaltlab.*\.jar" | grep -v grep | awk '{print $2}')
  if [[ -n "$RUNNING_PID" ]]; then
    echo "Found running backend PID: $RUNNING_PID, stopping..."
    kill "$RUNNING_PID" 2>/dev/null
    sleep 3
    kill -0 "$RUNNING_PID" 2>/dev/null && kill -9 "$RUNNING_PID"
  fi
fi

# Start fresh
echo "Starting..."
bash "$SCRIPT_DIR/start.sh"

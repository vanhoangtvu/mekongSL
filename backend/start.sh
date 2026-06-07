#!/bin/bash

set -uo pipefail

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
  set -a
  source "$SCRIPT_DIR/../.env" || { echo "Warning: failed to source .env file"; }
  set +a
else
  echo "Warning: .env file not found at $SCRIPT_DIR/../.env"
fi

# Cau hinh temp dir cho Jansi de tranh loi thu muc /tmp bi noexec
export MAVEN_OPTS="-Djansi.tmpdir=$SCRIPT_DIR/target/tmp"
mkdir -p "$SCRIPT_DIR/target/tmp"

JAR_FILE=$(ls "$SCRIPT_DIR"/target/*.jar 2>/dev/null | head -1)

if [[ -z "$JAR_FILE" ]]; then
  echo "No jar found, compiling..."
  ./mvnw -q package -DskipTests || { echo "Maven compile failed!"; exit 1; }
  JAR_FILE=$(ls "$SCRIPT_DIR"/target/*.jar 2>/dev/null | head -1)
  if [[ -z "$JAR_FILE" ]]; then
    echo "Still no jar after compile!"
    exit 1
  fi
fi

echo "Starting backend on 0.0.0.0:8084..."
java -jar "$JAR_FILE" > "$LOG_FILE" 2>&1 &
JAVA_PID=$!
disown $JAVA_PID
echo "$JAVA_PID" > "$PID_FILE"

echo "Backend started with PID: $JAVA_PID"
echo "Access at: http://14.227.143.142:8084"
echo "Logs: tail -f $LOG_FILE"
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
set -a; source "$PROJECT_DIR/.env"; set +a
source ~/titiler-env/bin/activate
exec uvicorn titiler.application.main:app \
  --host 0.0.0.0 \
  --port 8001 \
  --workers 2 \
  --log-level info

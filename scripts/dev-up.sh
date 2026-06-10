#!/usr/bin/env bash
# Start Oscorp backend in background (macOS/Linux). Logs under Oscorp/.dev-logs/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

start() {
  local name="$1"
  shift
  echo "→ $name"
  (cd "$ROOT" && "$@") >>"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$LOG_DIR/$name.pid"
}

echo "Oscorp dev-up — logs: $LOG_DIR"
echo "Stop: ./scripts/dev-down.sh"
echo ""

start backend bash -c "cd backend && uvicorn app.api.main:app --reload --port 8000"

echo ""
echo "Waiting for API…"
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "Stack (background):"
echo "  API  http://127.0.0.1:8000"
echo ""
echo "Start frontend in foreground:"
echo "  cd $ROOT/frontend && pnpm install && pnpm dev"
echo ""

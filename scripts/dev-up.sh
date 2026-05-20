#!/usr/bin/env bash
# Start Oscorp dev stack in background (macOS/Linux). Logs under Oscorp/.dev-logs/
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

start x402-payer bash -c "cd x402-payer && npm run dev"
start trend-analyzer bash -c "cd provider-services/trend-analyzer && npm run dev"
start hook-generator bash -c "cd provider-services/hook-generator && npm run dev"
start backend bash -c "cd backend && uvicorn app.api.main:app --reload --port 8000"

if [[ -f "$ROOT/backend/.env" ]] && grep -qE '^TELEGRAM_BOT_TOKEN=.' "$ROOT/backend/.env" 2>/dev/null; then
  start telegram bash -c "cd backend && python -m app.telegram.run_bot"
else
  echo "⊘ telegram skipped (set TELEGRAM_BOT_TOKEN in backend/.env)"
fi

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
echo "  API        http://127.0.0.1:8000"
echo "  x402-payer http://127.0.0.1:8110"
echo "  trend      http://127.0.0.1:8101"
echo "  hook       http://127.0.0.1:8102"
echo ""
echo "Start frontend in foreground:"
echo "  cd $ROOT/frontend && npm run dev"
echo ""
echo "Health: curl http://127.0.0.1:8000/api/agent/stack-health"

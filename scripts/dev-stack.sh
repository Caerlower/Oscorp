#!/usr/bin/env bash
# Oscorp dev stack (no OpenClaw). Run each line in a separate terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Oscorp dev stack — from $ROOT"
echo ""
echo "0) Copy env:  cp $ROOT/backend/.env.example $ROOT/backend/.env  (fill GROQ_API_KEY, TELEGRAM_BOT_TOKEN)"
echo "1) x402-payer:       cd $ROOT/x402-payer && npm install && npm run dev"
echo "2) provider deps:    cd $ROOT/provider-services && npm install"
echo "3) trend-analyzer:   cd $ROOT/provider-services/trend-analyzer && npm install && npm run dev"
echo "4) hook-generator:   cd $ROOT/provider-services/hook-generator && npm install && npm run dev"
echo "5) thread-generator: cd $ROOT/provider-services/thread-generator && npm install && npm run dev"
echo "6) backend:          cd $ROOT/backend && pip install -e . && uvicorn app.api.main:app --reload --port 8000"
echo "7) telegram-bot:     cd $ROOT/backend && python -m app.telegram.run_bot"
echo "8) frontend:         cd $ROOT/frontend && npm install && npm run dev"
echo ""
echo "Web:     http://localhost:8080  (Vite proxies /api -> :8000)"
echo "API:     http://127.0.0.1:8000/health"
echo "Research: Groq (GROQ_API_KEY + OSCORP_GROQ_RESEARCH_ENABLED=true)"

#!/usr/bin/env bash
# Oscorp dev stack. Run each line in a separate terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Oscorp dev stack — from $ROOT"
echo ""
echo "0) Copy env:"
echo "     cp $ROOT/backend/.env.example $ROOT/backend/.env"
echo "     cp $ROOT/frontend/.env.example $ROOT/frontend/.env"
echo "   Fill GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY in backend/.env"
echo ""
echo "1) backend:   cd $ROOT/backend && pip install -e . && uvicorn app.api.main:app --reload --port 8000"
echo "2) frontend:  cd $ROOT/frontend && pnpm install && pnpm dev"
echo ""
echo "Optional x402 Node proxy (server-side only — dashboard does not need it):"
echo "3) x402-payer: cd $ROOT/x402-payer && cp .env.example .env && npm install && npm run dev  # :8110"
echo "   See docs/x402.md"
echo ""
echo "Web:  http://localhost:8080  (Vite proxies /api -> :8000)"
echo "API:  http://127.0.0.1:8000/health"

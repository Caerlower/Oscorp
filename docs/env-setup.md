# Environment variables

## Quick setup

```bash
cd Oscorp/backend
pip install -e .
cp .env.example .env
# Edit: GROQ_API_KEY, TELEGRAM_BOT_TOKEN (optional but recommended)

cd ../frontend
cp .env.example .env

cd ../x402-payer && cp .env.example .env
cd ../provider-services/trend-analyzer && cp .env.example .env
cd ../provider-services/hook-generator && cp .env.example .env
cd ../provider-services/thread-generator && cp .env.example .env
```

See `scripts/dev-stack.sh` for run order.

## `backend/.env` (required)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | Yes | Drafts + Telegram chat |
| `X402_PAYER_URL` | Yes | x402 payment proxy |
| `USDC_ASSET_ID` | Yes | TestNet USDC (`10458941`) |
| `TELEGRAM_BOT_TOKEN` | For Telegram | @BotFather bot token |
| `TELEGRAM_OPERATOR` | — | Keep `oscorp` |
| `OSCORP_GROQ_RESEARCH_ENABLED` | — | `true` (default) — Groq topics before each cycle |

Provider URLs default to localhost `8101`–`8103`, payer `8110`.

## `frontend/.env`

```bash
VITE_API_URL=http://127.0.0.1:8000
VITE_USDC_ASSET_ID=10458941
```

## Research

Pre-cycle research uses **Groq** with your niche + Telegram memory — see [growth-research.md](growth-research.md). No xAI or live X API required.

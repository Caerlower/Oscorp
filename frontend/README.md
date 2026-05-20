# Oscorp Frontend

Web app for Oscorp — connect Algorand wallet, sign growth policy, fund agent wallet, run x402-powered growth cycles.

Built from **oscorp-companion-spark** (TanStack Start + Vite + Tailwind).

## Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://127.0.0.1:5173

## User flow

1. **Connect wallet** (`/auth`) — Pera or Defly on TestNet
2. **Sign policy** (`/onboarding`) — niche, tone, spend cap
3. **Fund agent** (`/agent`) — USDC transfer to agent wallet
4. **Run cycle** — dashboard or agent page → x402 provider payments → draft
5. **Review drafts** (`/drafts`) → Post on X via intent URL

## Backend

Requires Oscorp API at `VITE_API_URL` (default `http://127.0.0.1:8000`).

Also run: `x402-payer`, provider services, `uvicorn app.api.main:app`.

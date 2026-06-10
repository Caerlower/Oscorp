# Oscorp Frontend

React dashboard for the AI CMO terminal — wallet auth, site analysis UI, x402 payments, and agent feed.

**Full setup:** see [../README.md](../README.md).

## Run

```bash
cp .env.example .env   # optional overrides
pnpm install
pnpm dev
```

→ http://localhost:8080 (proxies `/api` → backend `:8000`)

## Stack

React 19 · TanStack Router · TanStack Query · Tailwind · Algorand wallets (Pera / Defly / Lute / Web3Auth) · `@x402-avm` via `../x402-payer`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/auth` | Wallet sign-in |
| `/dashboard` | Mission control |
| `/settings` | Account, payments, websites |

## Key paths

```
src/
  hooks/useX402Fetch.ts       # Browser x402 client + wallet signing
  context/PaymentContext.tsx  # Payment modals + provider
  components/payment/         # x402 confirm, fund wallet, receipts
  components/dashboard/       # Analytics, agents, chat
  constants/payment-constants.ts  # Imports shared/payment-constants.json
```

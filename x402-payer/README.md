# Oscorp x402 payer

Shared **`createX402Fetch()`** library (`src/index.ts`) used by the Oscorp frontend for browser x402 payments.

Optional Hono proxy for **server-side** paid fetch (scripts, agent wallets without a browser):

```bash
cp .env.example .env
npm install
npm run dev   # http://127.0.0.1:8110
```

Uses `@x402-avm/avm`, `@x402-avm/core`, and `@x402-avm/fetch`.

The dashboard does **not** require this proxy or a local `.env` — only run it if you need `POST /fetch` from Node.

See [../docs/x402.md](../docs/x402.md).

# Official x402 on Algorand (implemented in Oscorp)

Oscorp uses the **official x402 TypeScript SDK** on **Algorand TestNet** with the **GoPlausible facilitator**.

References:

- [x402 on Algorand](https://dev.algorand.co/resources/x402-on-algorand/)
- [Network & token support](https://docs.x402.org/core-concepts/network-and-token-support)
- [GoPlausible facilitator](https://facilitator.goplausible.xyz/docs)

## Architecture

```text
Python Backend (FastAPI)
   → x402-payer service (@x402/fetch + ExactAvmScheme)
      → Provider API (@x402/hono + paymentMiddleware)
         → Facilitator (verify + settle USDC on TestNet)
```

| Component | Package | Role |
|-----------|---------|------|
| `x402-payer/` | `@x402/core`, `@x402/fetch`, `@x402/avm` | Official paying client |
| `provider-services/*` | `@x402/core`, `@x402/hono`, `@x402/avm` | Official resource servers |
| Facilitator | `https://facilitator.goplausible.xyz` | Settlement + verification |

## Setup (TestNet)

1. Create **two TestNet accounts**: payer (Oscorp) + receiver (each provider).
2. Fund ALGO via [Lora faucet](https://lora.algokit.io/testnet/fund).
3. Opt into TestNet USDC on both accounts.
4. Fund USDC via [Circle faucet](https://faucet.circle.com/) (Algorand TestNet).
5. Configure env files (see below).

## Run locally

### 1) x402 payer (Oscorp wallet)

```bash
cd x402-payer
cp .env.example .env   # set AVM_MNEMONIC
npm install
npm run dev
```

### 2) Providers (receiver addresses)

Each provider needs its own `AVM_ADDRESS`:

```bash
cd provider-services/trend-analyzer
cp .env.example .env
npm install && npm run dev

cd ../hook-generator
cp .env.example .env
npm install && npm run dev

cd ../thread-generator
cp .env.example .env
npm install && npm run dev
```

### 3) Python backend

```bash
cd backend
cp .env.example .env
pip install -e ../shared -e .
uvicorn app.api.main:app --reload --port 8000
```

Set `X402_PAYER_URL=http://127.0.0.1:8110` in `backend/.env`.

## Env variables

**x402-payer/.env**

- `AVM_MNEMONIC` — payer wallet (25 words)
- `FACILITATOR_URL` — default `https://facilitator.goplausible.xyz`

**provider-services/*/.env**

- `AVM_ADDRESS` — provider receiver address
- `FACILITATOR_URL` — same facilitator URL

**backend/.env**

- `X402_PAYER_URL=http://127.0.0.1:8110`

## Smart contracts

Not required. Official x402 on Algorand uses USDC ASA transfers + facilitator settlement (`exact` scheme).

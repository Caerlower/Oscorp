# Oscorp Backend

Fastify API for deploying and operating Oscorp Algorand applications.

## Endpoints

- `GET /health`
- `POST /v1/oscorp` - deploy + initialize an Oscorp app and create Pulse ASA
- `PATCH /v1/oscorp/policy` - update policy values on an existing Oscorp app
- `GET /v1/oscorp/:appId/state` - read decoded global state from chain
- `POST /v1/oscorp/revenue/distribute` - staged endpoint (accepts payload; grouped on-chain execution is next step)

## Run

1. Copy env:

```bash
cp .env.example .env
```

2. Ensure `Oscorp-contracts` artifacts exist:

```bash
cd ../Oscorp-contracts
pnpm run build
```

3. Start backend:

```bash
cd ../Oscorp-backend
pnpm install
pnpm run dev
```

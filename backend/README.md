# Oscorp Backend

FastAPI orchestrator: **Groq research** → **x402** (provider payments) → **Groq** drafts.

## Run

```bash
cd backend
cp .env.example .env
pip install -e .
uvicorn app.api.main:app --reload --port 8000
```

Requires: `x402-payer`, provider services, `GROQ_API_KEY`.

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/session/connect` | Wallet → user + agent address |
| `POST /api/session/policy` | Sign growth policy |
| `GET /api/agent/fund-info/{user_id}` | Agent wallet funding |
| `POST /api/agent/run-cycle` | Full growth cycle |
| `GET /api/agent/research/status` | Groq research mode / config |
| `GET /api/drafts/{user_id}` | Draft history |

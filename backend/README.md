# Oscorp Backend

FastAPI service — wallet sessions, site analysis, Groq documents, x402 middleware, agent routes, Supabase.

**Full setup:** see [../README.md](../README.md).

## Run

```bash
cp .env.example .env
pip install -e ".[dev]"
uvicorn app.api.main:app --reload --port 8000
```

Run `supabase/schema.sql` in Supabase before first use.

## Layout

```
app/
  api/main.py              # FastAPI entry + x402 response headers
  core/x402_middleware.py  # 402 gate, facilitator verify/settle
  core/payment_constants.py  # Loads shared/payment-constants.json
  routes/agents.py         # Paid agent endpoints
  analytics/               # Scrape, Lighthouse, Groq docs
  chat/                    # AI CMO chat
  db/                      # Supabase client
```

## Paid endpoints

| Route | Agent |
|-------|-------|
| `POST /api/agents/linkedin` | $0.02 USDC |
| `POST /api/agents/articles` | $0.10 USDC |
| `POST /api/agents/hackernews` | $0.02 USDC |

Twitter drafts are free via `POST /api/deliverables/users/{id}/twitter/sync`. Reddit agent returns 503 until shipped.

Prices and treasury: `../shared/payment-constants.json`

## Tests

```bash
pytest tests/test_payment_constants_sync.py -v
```

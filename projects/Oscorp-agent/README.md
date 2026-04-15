# Oscorp Agent

Phase 1 reusable autonomous runtime for Oscorp.

This package is adapted from the existing prime-agent architecture and wired to Oscorp backend endpoints.

## Current capabilities (Phase 3 baseline)

- Fetch Oscorp on-chain state each cycle
- LLM-driven tool calling via Groq (OpenAI-compatible)
- Executable tools:
  - `update_policy`
  - `report_activity`
  - `create_campaign_brief`
  - `draft_social_post`
- Anti-repeat context from recent actions

## Phase 4 (x402 + X posting)

- Register paid services: `PUT /v1/oscorp/:appId/service`
- Discover services: `GET /v1/services`
- Payment challenge: `GET /v1/oscorp/:appId/service` (returns 402)
- Execute autonomous payment: `POST /v1/oscorp/:appId/x402/pay`
- Purchase with tx proof in `X-PAYMENT`: `POST /v1/oscorp/:appId/service`
- Agent tools:
  - `register_service`
  - `discover_services`
  - `purchase_service`
  - `post_to_x` (browser mode supported)

## Setup

```bash
cd /Users/manavgoyal/algorand/Oscorp/projects/Oscorp-agent
pip3 install --user -e .
cp .env.example .env
```

Set:

- `OSCORP_API_KEY` (must match backend `OSCORP_API_KEY`)
- `OSCORP_API_URL` (default `http://127.0.0.1:5050`)
- `OSCORP_ID` (e.g. `1013`)
- `GROQ_API_KEY` (preferred for planning loop)
- `OPENAI_BASE_URL` (default `https://api.groq.com/openai/v1`)
- `OPENAI_MODEL` (default `llama-3.3-70b-versatile`)
- `X_POSTING_MODE` (`browser`, `dry_run`, or `live`)
- `X_USERNAME`, `X_PASSWORD`, `X_EMAIL` (used in `browser` mode)
- `X_ACCESS_TOKEN` (required only when `X_POSTING_MODE=live`)
- `AGENT_MODE` (`plan_only` default, or `tool_use`)
- `AGENT_VERBOSE` (`true` for full cycle logs in terminal)

## Run

```bash
oscorp-agent start
```

Install browser runtime once for browser posting:

```bash
python3 -m playwright install chromium
```

Direct demo post from terminal:

```bash
python3 -m oscorp_agent post-x --text "Hello from Oscorp demo"
```

One-command end-to-end demo (register -> x402 pay -> purchase -> X post):

```bash
python3 -m oscorp_agent demo-cycle
```

Optional:

```bash
python3 -m oscorp_agent demo-cycle --provider-app-id 1013 --price-micro-usdc 50000
```

Create a new company and run full demo cycle automatically:

```bash
python3 -m oscorp_agent demo-new-company
```

For accounts with 2FA/challenges, bootstrap session first:

```bash
python3 -m oscorp_agent x-login
```

Complete login in browser, press Enter in terminal, then run `post-x`.

Attach to your already-open Brave instance:

1. Start Brave with remote debugging:
```bash
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --remote-debugging-port=9222
```
2. Set in `.env`:
```env
BROWSER_CDP_URL=http://127.0.0.1:9222
```
3. Run `x-login` / `post-x` and Oscorp will use that running browser session.

Without `GROQ_API_KEY` / `OPENAI_API_KEY`, it still polls Oscorp state (read-only mode).

You can use Groq via OpenAI-compatible endpoint and client settings as documented in [Groq Overview](https://console.groq.com/docs/overview).

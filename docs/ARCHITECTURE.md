# Oscorp Architecture

Oscorp is an **AI growth operator for X (Twitter)** with a **web control plane** and **Telegram copilot**.

## Product philosophy

- Lightweight, deterministic orchestration (not agent swarms)
- Human approval before any X post
- Specialized providers for capabilities (trends, hooks, threads)
- x402 + Algorand USDC for machine-to-machine provider payments
- [Groq research](growth-research.md) for **pre-cycle topics/angles** — separate from x402 payments

## System layers

| Layer | Role |
|-------|------|
| **Frontend (React)** | Wallet connect, policy signing, fund agent, dashboard, drafts |
| **Backend (FastAPI)** | Session APIs, agent wallets, orchestration, x402 payer proxy |
| **OpenClaw Telegram** | Chat operator via external gateway + `oscorp-growth` skill |
| **Agent loop** | Analyze → trends → strategy → buy providers → draft → notify |
| **Providers** | FastAPI microservices with x402 payment gates |
| **Supabase** | Postgres: users, profiles, posts, payments, analytics |
| **Algorand** | USDC ASA settlement + payment verification |
| **OpenClaw** | Self-hosted gateway: `x_search`, browser, Telegram; backend calls gateway each cycle |

## Core loop

```text
while scheduled:
  load growth_profile
  openclaw_research_x()      # x_search, browser — agent brain
  decide_provider_plan()     # from OpenClaw + policy
  buy_provider_services()    # x402 USDC — agent commerce
  generate_content()         # Groq llama-3.3-70b-versatile, grounded in research + providers
  notify (web / Telegram)
  sleep(interval)
```

## Human-in-the-loop posting

Oscorp **never** auto-posts to X in MVP. Drafts use X intent URLs from the web app (or OpenClaw can summarize them in Telegram).

## x402 provider flow (after OpenClaw research)

```text
OpenClaw → x_research JSON
Oscorp backend → POST /service → 402
x402-payer (agent wallet) → pay USDC → facilitator
Oscorp → retry → 200 (provider output + x_research context)
Store receipt + draft
```

OpenClaw does **not** sign x402 payments; Oscorp's **agent wallet** does via `x402-payer`.

## Repo layout

```text
Oscorp/
├── frontend/
├── backend/              # orchestrator + openclaw client + x402 proxy
├── integrations/openclaw/
├── x402-payer/
├── provider-services/
├── supabase/
├── docker/
└── docs/
```

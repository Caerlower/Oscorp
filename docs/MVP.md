# Oscorp MVP Checklist

## Core flow

- [x] Web app: wallet connect, policy, fund agent
- [x] Groq pre-cycle research wired into orchestrator
- [x] Official x402 provider payments (agent wallet)
- [x] Drafts + Post on X intent URL
- [x] Human approval (no auto-post)
- [ ] Supabase persistence (schema in `supabase/migrations/`)

## Demo script

1. Start OpenClaw + Oscorp stack (`scripts/dev-stack.sh`)
2. Connect wallet → sign policy → fund agent (`/agent`)
3. Run cycle from dashboard
4. Show `x_research.source: groq` + x402 `payment_txs` in response
5. Open draft → Post on X

## Out of scope

- LangChain / agent swarms
- Direct X API posting
- Legacy in-repo Telegram bot (use OpenClaw Telegram channel)

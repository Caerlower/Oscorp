# OpenClaw + Oscorp — one Telegram bot

Use **one** @BotFather token in **OpenClaw only**. OpenClaw handles Telegram conversation, memory, and `x_search`. Oscorp backend handles wallet, x402, and drafts.

Do **not** run `python -m app.telegram.run_bot` at the same time — two processes cannot poll the same bot.

## Architecture

```text
You ↔ Telegram ↔ OpenClaw (conversation + memory + x_search)
                      ↓ skill: oscorp-growth
                 Oscorp backend (run-cycle, x402, Groq draft)
                      ↓ optional sendMessage
                 Same Telegram chat (updates)
```

## 1. Install OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
```

**Onboard choices (recommended):**

| Step | Choice |
|------|--------|
| Setup | QuickStart |
| Model | **Groq** → add `GROQ_API_KEY` when prompted (or set in `~/.openclaw/.env` after) |
| Model id | `groq/llama-3.3-70b-versatile` if manual entry |
| Channel | **Telegram** → paste @BotFather token |
| Skip | Do not run a second Oscorp polling bot |

If wizard warns about `openai/` provider, set Groq API key in `~/.openclaw/.env` and restart gateway.

## 2. Enable HTTP API (for backend research)

Merge `gateway.http-api.example.json5` into `~/.openclaw/openclaw.json`, then:

```bash
openclaw gateway restart
```

Copy `gateway.auth.token` from `~/.openclaw/openclaw.json` into `Oscorp/backend/.env`:

```env
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<token>
OPENCLAW_RESEARCH_ENABLED=true
```

## 3. Oscorp skill + env

```bash
mkdir -p ~/.openclaw/workspace/skills
cp -r /path/to/Oscorp/integrations/openclaw/oscorp-growth ~/.openclaw/workspace/skills/
```

`~/.openclaw/.env` (see `openclaw.env.example`):

```bash
GROQ_API_KEY=...
XAI_API_KEY=...
OSCORP_API_URL=http://127.0.0.1:8000
OSCORP_USER_ID=<from web Settings after wallet connect>
```

## 4. Backend (optional push from web dashboard)

Use the **same** bot token only for outbound alerts (no polling):

```env
TELEGRAM_BOT_TOKEN=<same token as OpenClaw>
TELEGRAM_OPERATOR=openclaw
```

When user links chat via skill (`link-telegram`), running a cycle from the **web** also sends briefing + draft to Telegram.

## 5. Verify

```bash
curl http://127.0.0.1:8000/api/agent/openclaw/status
openclaw skills list | grep oscorp
```

Message your bot on Telegram: *"My Oscorp user id is …"* then *"Run a growth cycle"*.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot not replying | `openclaw gateway restart`, check Telegram token in config |
| No live X trends | Set `XAI_API_KEY`, check `openclaw/status` |
| Cycle 402 | Fund agent wallet on web |
| Two bots fighting | Stop `python -m app.telegram.run_bot` |

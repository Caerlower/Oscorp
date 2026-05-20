# Telegram — Oscorp bot

The built-in Telegram bot (`TELEGRAM_OPERATOR=oscorp`) handles chat, memory, `/run`, and draft buttons.

## Setup

1. **@BotFather** → `/newbot` → copy token into `backend/.env`:
   ```env
   TELEGRAM_OPERATOR=oscorp
   TELEGRAM_BOT_TOKEN=...
   ```
2. **Web:** wallet → policy → fund agent → **Profile** → copy User ID
3. **Start bot:**
   ```bash
   cd Oscorp/backend
   python3 -m app.telegram.run_bot
   ```
4. In Telegram: `/link <user-id>` then `/run`

## Commands

| Command | Action |
|---------|--------|
| `/start` | Help |
| `/link <uuid>` | Link web account |
| `/run` | Growth cycle (Groq research → x402 → draft) |
| `/status` | Funding, drafts, memory |
| `/memory` | What Oscorp remembers |
| `/clear` | Clear chat memory (policy unchanged) |

## Draft buttons

After `/run` or a web cycle (if linked):

- **Post on X** — intent URL
- **Regenerate** — new copy (Groq only, no extra x402)
- **Skip**

## Requirements

- Backend + x402-payer + provider services running
- `GROQ_API_KEY` for chat and research
- Agent wallet funded with TestNet USDC

See [growth-research.md](growth-research.md) for how pre-cycle research works.

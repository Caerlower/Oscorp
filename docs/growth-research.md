# Growth research (Groq)

Before each growth cycle, Oscorp runs a **Groq research pass** that outputs topics, angles, and a provider plan. This feeds x402 trend/hook calls and the final draft.

## What it is / isn't

| Yes | No |
|-----|-----|
| Uses your **niche, policy, Telegram memory, recent posts, prior drafts** | Live X/Twitter API or xAI `x_search` |
| Same `GROQ_API_KEY` as drafts and Telegram chat | Extra API signup |
| `x_research.source: "groq"` in cycle responses | Guaranteed real-time X trends |

## Configuration

In `backend/.env`:

```env
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
OSCORP_GROQ_RESEARCH_ENABLED=true   # false = stub topics only
```

## Health check

```bash
curl http://127.0.0.1:8000/api/agent/research/status
```

Example:

```json
{
  "mode": "groq",
  "groq_configured": true,
  "research_enabled": true,
  "model": "llama-3.3-70b-versatile",
  "note": "Groq synthesizes topics/angles from your niche, posts, and Telegram memory..."
}
```

## Cycle flow

1. **Groq research** → `top_topic`, `trending_topics`, `provider_plan`
2. **x402** → trend-analyzer + hook-generator (paid with agent USDC)
3. **Groq draft** → post copy + reasoning

Improve research quality by chatting in Telegram (`/memory`), pasting posts in policy, and using **Regenerate** on weak drafts.

from __future__ import annotations

from pydantic import ValidationError

from app.agents.hackernews.prompts import SYSTEM_PROMPT
from app.agents.hackernews.schemas import (
    HackerNewsGroqOutput,
    HackerNewsPost,
    HackerNewsRequest,
    HackerNewsResponse,
    word_count,
)
from app.core.groq_client import groq_json_completion

AGENT_NAME = "hackernews"


def _build_user_prompt(body: HackerNewsRequest) -> str:
    competitors = ", ".join(body.competitors) if body.competitors else "none listed"
    return (
        f"Product: {body.productInfo}\n"
        f"Brand voice: {body.brandVoice}\n"
        f"Marketing strategy: {body.marketingStrategy}\n"
        f"Competitors: {competitors}\n"
        f"Product URL: {body.productUrl}\n"
        f"Technical details: {body.technicalDetails}\n"
        "Generate exactly 3 Show HN variations:\n"
        "1) technical angle\n"
        "2) problem_solution angle\n"
        "3) builder_story angle"
    )


async def _groq_validated(user_prompt: str) -> HackerNewsGroqOutput | dict[str, str]:
    for attempt in range(2):
        try:
            raw = await groq_json_completion(
                agent_name=AGENT_NAME,
                system=SYSTEM_PROMPT,
                user=user_prompt,
                max_tokens=4096,
                temperature=0.4,
                strict=attempt > 0,
            )
            return HackerNewsGroqOutput.model_validate(raw)
        except ValidationError as exc:
            if attempt == 0:
                continue
            return {"error": f"Hacker News output validation failed: {exc}"}
        except ValueError as exc:
            return {"error": str(exc)}
        except Exception as exc:
            return {"error": f"Hacker News agent failed: {exc}"}
    return {"error": "Hacker News output validation failed"}


async def run_hackernews_agent(body: HackerNewsRequest) -> HackerNewsResponse | dict[str, str]:
    result = await _groq_validated(_build_user_prompt(body))
    if isinstance(result, dict):
        return result

    posts: list[HackerNewsPost] = []
    for item in result.posts:
        body_text = item.body.strip()
        if not body_text:
            continue
        posts.append(
            HackerNewsPost(
                title=item.title.strip(),
                body=body_text,
                angle=item.angle,
                wordCount=item.wordCount or word_count(body_text),
            )
        )

    if not posts:
        return {"error": "Groq returned no Hacker News posts"}
    return HackerNewsResponse(posts=posts)

from __future__ import annotations

from pydantic import ValidationError

from app.agents.linkedin.prompts import SYSTEM_PROMPT
from app.agents.linkedin.schemas import (
    LinkedInGroqOutput,
    LinkedInRequest,
    LinkedInResponse,
)
from app.core.groq_client import groq_json_completion

AGENT_NAME = "linkedin"


def _word_count(text: str) -> int:
    return len(text.split())


def _build_user_prompt(body: LinkedInRequest) -> str:
    competitors = ", ".join(body.competitors) if body.competitors else "none listed"
    keywords = ", ".join(body.keywords) if body.keywords else "none listed"
    return (
        f"Post type: {body.postType}\n"
        f"Product: {body.productInfo}\n"
        f"Brand voice: {body.brandVoice}\n"
        f"Marketing strategy: {body.marketingStrategy}\n"
        f"Competitors: {competitors}\n"
        f"Keywords: {keywords}\n"
        "Write one high-engagement LinkedIn founder post following the style rules and schema."
    )


async def _groq_validated(user_prompt: str) -> LinkedInGroqOutput | dict[str, str]:
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
            return LinkedInGroqOutput.model_validate(raw)
        except ValidationError as exc:
            if attempt == 0:
                continue
            return {"error": f"LinkedIn output validation failed: {exc}"}
        except ValueError as exc:
            return {"error": str(exc)}
        except Exception as exc:
            return {"error": f"LinkedIn agent failed: {exc}"}
    return {"error": "LinkedIn output validation failed"}


async def run_linkedin_agent(body: LinkedInRequest) -> LinkedInResponse | dict[str, str]:
    result = await _groq_validated(_build_user_prompt(body))
    if isinstance(result, dict):
        return result

    post = result.fullPost.strip()
    if not post:
        return {"error": "Groq returned an empty post"}

    return LinkedInResponse(
        post=post,
        wordCount=result.wordCount or _word_count(post),
        hook=result.hook.strip(),
    )

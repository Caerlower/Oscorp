from __future__ import annotations

from urllib.parse import quote

from pydantic import ValidationError

from app.agents.twitter.prompts import SYSTEM_PROMPT
from app.agents.twitter.schemas import (
    MAX_TWEETS,
    TweetVariation,
    TwitterGroqOutput,
    TwitterRequest,
    TwitterResponse,
)
from app.core.groq_client import groq_json_completion

AGENT_NAME = "twitter"


def _intent_url(text: str) -> str:
    return f"https://twitter.com/intent/tweet?text={quote(text, safe='')}"


def _build_user_prompt(body: TwitterRequest) -> str:
    competitors = ", ".join(body.competitors) if body.competitors else "none listed"
    keywords = ", ".join(body.keywords) if body.keywords else "none listed"
    return (
        f"Tweet type: {body.tweetType}\n"
        f"Product: {body.productInfo}\n"
        f"Brand voice: {body.brandVoice}\n"
        f"Marketing strategy: {body.marketingStrategy}\n"
        f"Competitors: {competitors}\n"
        f"Keywords: {keywords}\n"
        f"Generate exactly {MAX_TWEETS} distinct tweet variations following the style rules and schema."
    )


async def _groq_validated(user_prompt: str) -> TwitterGroqOutput | dict[str, str]:
    for attempt in range(2):
        try:
            raw = await groq_json_completion(
                agent_name=AGENT_NAME,
                system=SYSTEM_PROMPT,
                user=user_prompt,
                max_tokens=2048,
                temperature=0.4,
                strict=attempt > 0,
            )
            tweets = raw.get("tweets")
            if isinstance(tweets, list):
                raw = {**raw, "tweets": tweets[:MAX_TWEETS]}
            return TwitterGroqOutput.model_validate(raw)
        except ValidationError as exc:
            if attempt == 0:
                continue
            return {"error": f"Twitter output validation failed: {exc}"}
        except ValueError as exc:
            return {"error": str(exc)}
        except Exception as exc:
            return {"error": f"Twitter agent failed: {exc}"}
    return {"error": "Twitter output validation failed"}


def _to_api_response(output: TwitterGroqOutput) -> TwitterResponse:
    tweets: list[TweetVariation] = []
    for item in output.tweets[:MAX_TWEETS]:
        text = item.fullTweet.strip()
        if len(text) > 280:
            text = text[:280]
        tweets.append(
            TweetVariation(
                text=text,
                characterCount=len(text),
                intentUrl=_intent_url(text),
            )
        )
    return TwitterResponse(tweets=tweets)


async def run_twitter_agent(body: TwitterRequest) -> TwitterResponse | dict[str, str]:
    result = await _groq_validated(_build_user_prompt(body))
    if isinstance(result, dict):
        return result
    if not result.tweets:
        return {"error": "Groq returned no tweets"}
    return _to_api_response(result)

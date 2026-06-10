from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

TweetType = Literal[
    "product_insight",
    "industry_opinion",
    "engagement_question",
    "milestone",
    "trend_response",
]

MAX_TWEETS = 2


class TwitterRequest(BaseModel):
    """Input for the Twitter/X content agent."""

    productInfo: str = Field(..., min_length=1, description="Product summary and positioning.")
    brandVoice: str = Field(..., min_length=1, description="Brand tone and writing style profile.")
    marketingStrategy: str = Field(..., min_length=1, description="Go-to-market and messaging strategy.")
    competitors: list[str] = Field(default_factory=list, description="Competitor domains or names.")
    keywords: list[str] = Field(default_factory=list, description="SEO and positioning keywords.")
    tweetType: TweetType = Field(..., description="The style of tweet to generate.")


class TweetVariationGroq(BaseModel):
    """Single tweet variation as returned by Groq (counts/URLs computed server-side)."""

    hook: str = Field(..., min_length=1, description="Line 1 only — the scroll-stopping hook.")
    body: str = Field(..., min_length=1, description="1-2 punchy lines after the hook line break.")
    fullTweet: str | None = Field(
        default=None,
        description="Complete tweet: hook + blank line + body. Computed if omitted.",
    )

    @model_validator(mode="after")
    def normalize_full_tweet(self) -> TweetVariationGroq:
        full = (self.fullTweet or "").strip()
        if not full:
            full = f"{self.hook.strip()}\n\n{self.body.strip()}"
        if not full:
            raise ValueError("Tweet must have hook and body")
        object.__setattr__(self, "fullTweet", full)
        return self


class TwitterGroqOutput(BaseModel):
    """Strict Groq JSON output shape for Twitter."""

    tweets: list[TweetVariationGroq] = Field(
        ...,
        min_length=1,
        max_length=MAX_TWEETS,
        description="One or two tweet variations (max 2).",
    )


class TweetVariation(BaseModel):
    """API response tweet — compatible with frontend."""

    text: str = Field(..., description="Full tweet text ready to post.")
    characterCount: int = Field(..., description="Character count of the tweet.")
    intentUrl: str = Field(..., description="Twitter intent URL for one-click posting.")


class TwitterResponse(BaseModel):
    """Twitter agent API response."""

    tweets: list[TweetVariation] = Field(
        default_factory=list,
        description="Up to two tweet variations.",
    )

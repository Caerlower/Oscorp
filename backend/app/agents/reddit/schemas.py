from __future__ import annotations

from pydantic import BaseModel, Field


class RedditRequest(BaseModel):
    """Input for the Reddit opportunity agent."""

    productInfo: str = Field(..., min_length=1, description="Product summary and positioning.")
    brandVoice: str = Field(..., min_length=1, description="Brand tone and writing style profile.")
    marketingStrategy: str = Field(..., min_length=1, description="Go-to-market and messaging strategy.")
    competitors: list[str] = Field(default_factory=list, description="Competitor domains or names.")
    keywords: list[str] = Field(..., min_length=1, description="Keywords to search on Reddit.")


class RedditPostScoreGroq(BaseModel):
    """Groq scoring output for a single Reddit post."""

    score: int = Field(..., ge=1, le=10, description="Opportunity score from 1 (low) to 10 (high).")
    reason: str = Field(..., min_length=1, description="Why this post is a good opportunity.")
    suggestedReply: str = Field(
        ...,
        min_length=1,
        description="Plain paragraph reply — helpful, casual, not salesy.",
    )


class RedditOpportunity(BaseModel):
    """A scored Reddit post opportunity for the API response."""

    title: str = Field(..., description="Reddit post title.")
    subreddit: str = Field(..., description="Subreddit name without r/ prefix.")
    upvotes: int = Field(..., description="Post upvote count.")
    comments: int = Field(..., description="Post comment count.")
    url: str = Field(..., description="Full URL to the Reddit post.")
    score: int = Field(..., description="AI opportunity score (1-10).")
    reason: str = Field(..., description="Why this post is worth engaging.")
    suggestedReply: str = Field(..., description="Suggested reply paragraph.")


class RedditResponse(BaseModel):
    """Reddit agent API response."""

    opportunities: list[RedditOpportunity] = Field(
        default_factory=list,
        description="Scored Reddit opportunities sorted by score.",
    )

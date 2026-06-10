from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LinkedInPostType = Literal[
    "behind_the_scenes",
    "lesson_learned",
    "industry_take",
    "milestone",
    "customer_story",
]


class LinkedInRequest(BaseModel):
    """Input for the LinkedIn content agent."""

    productInfo: str = Field(..., min_length=1, description="Product summary and positioning.")
    brandVoice: str = Field(..., min_length=1, description="Brand tone and writing style profile.")
    marketingStrategy: str = Field(..., min_length=1, description="Go-to-market and messaging strategy.")
    competitors: list[str] = Field(default_factory=list, description="Competitor domains or names.")
    keywords: list[str] = Field(default_factory=list, description="SEO and positioning keywords.")
    postType: LinkedInPostType = Field(..., description="The style of LinkedIn post to generate.")


class LinkedInGroqOutput(BaseModel):
    """Strict Groq JSON output shape for LinkedIn."""

    hook: str = Field(..., min_length=1, description="Line 1 hook before the see-more cutoff.")
    body: str = Field(..., min_length=1, description="Body paragraphs separated by blank lines.")
    closingLine: str = Field(..., min_length=1, description="One strong takeaway sentence.")
    ctaQuestion: str = Field(..., min_length=1, description="Genuine question to drive comments.")
    fullPost: str = Field(..., min_length=1, description="Complete post assembled with proper spacing.")
    wordCount: int = Field(..., ge=1, description="Total word count of fullPost (target 150-250).")


class LinkedInResponse(BaseModel):
    """LinkedIn agent API response — compatible with frontend."""

    post: str = Field(..., description="Full LinkedIn post text.")
    wordCount: int = Field(..., description="Word count of the post.")
    hook: str = Field(..., description="Opening hook line.")

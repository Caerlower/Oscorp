from __future__ import annotations

import re
from pydantic import BaseModel, Field, field_validator


class HackerNewsRequest(BaseModel):
    """Input for the Hacker News Show HN agent."""

    productInfo: str = Field(..., min_length=1, description="Product summary and positioning.")
    brandVoice: str = Field(..., min_length=1, description="Brand tone and writing style profile.")
    marketingStrategy: str = Field(..., min_length=1, description="Go-to-market and messaging strategy.")
    competitors: list[str] = Field(default_factory=list, description="Competitor domains or names.")
    keywords: list[str] = Field(default_factory=list, description="SEO and positioning keywords.")
    productUrl: str = Field(..., min_length=1, description="Product URL for the Show HN post.")
    technicalDetails: str = Field(..., min_length=1, description="Technical implementation details.")


class HackerNewsPostGroq(BaseModel):
    """Single Show HN post as returned by Groq."""

    title: str = Field(..., min_length=1, description="Post title starting with 'Show HN:'.")
    body: str = Field(..., min_length=1, description="Post body — 80-150 words, plain text.")
    angle: str = Field(..., min_length=1, description="Post angle: technical, problem_solution, or builder_story.")

    @field_validator("angle", mode="before")
    @classmethod
    def normalize_angle(cls, value: object) -> str:
        raw = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "technical": "technical",
            "problem_solution": "problem_solution",
            "problemsolution": "problem_solution",
            "builder_story": "builder_story",
            "builderstory": "builder_story",
        }
        return aliases.get(raw, raw or "technical")
    wordCount: int = Field(..., ge=1, description="Word count of the body (target 80-150).")

    @field_validator("title")
    @classmethod
    def ensure_show_hn_prefix(cls, value: str) -> str:
        title = value.strip()
        if not title.lower().startswith("show hn:"):
            title = f"Show HN: {title.removeprefix('Show HN:').strip()}"
        return title


class HackerNewsGroqOutput(BaseModel):
    """Strict Groq JSON output shape for Hacker News."""

    posts: list[HackerNewsPostGroq] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly 3 Show HN post variations.",
    )


class HackerNewsPost(BaseModel):
    """API response post — compatible with frontend."""

    title: str = Field(..., description="Show HN title.")
    body: str = Field(..., description="Post body text.")
    angle: str = Field(..., description="Post angle label.")
    wordCount: int = Field(..., description="Word count of the body.")


class HackerNewsResponse(BaseModel):
    """Hacker News agent API response."""

    posts: list[HackerNewsPost] = Field(default_factory=list, description="Three Show HN variations.")


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))

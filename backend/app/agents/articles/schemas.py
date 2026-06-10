from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

ArticleType = Literal[
    "seo_content",
    "thought_leadership",
    "how_to",
    "comparison",
    "case_study",
    "listicle",
]


class ArticlesRequest(BaseModel):
    """Input for the SEO articles agent."""

    productInfo: str = Field(..., min_length=1, description="Product summary and positioning.")
    brandVoice: str = Field(..., min_length=1, description="Brand tone and writing style profile.")
    marketingStrategy: str = Field(..., min_length=1, description="Go-to-market and messaging strategy.")
    competitors: list[str] = Field(default_factory=list, description="Competitor domains or names.")
    keywords: list[str] = Field(default_factory=list, description="SEO and positioning keywords.")
    articleType: ArticleType = Field(..., description="Type of article to generate.")
    targetKeyword: str = Field(..., min_length=1, description="Primary SEO keyword to target.")


class ArticleSubSectionGroq(BaseModel):
    """H3 subsection within an article section."""

    heading: str = Field(..., min_length=1, description="H3 subsection heading.")
    content: str = Field(..., min_length=1, description="Subsection body content.")


class ArticleSectionGroq(BaseModel):
    """H2 section within the article."""

    heading: str = Field(..., min_length=1, description="Benefit-driven H2 heading.")
    content: str = Field(..., min_length=1, description="Section body with short paragraphs or bullets.")
    subSections: list[ArticleSubSectionGroq] = Field(
        default_factory=list,
        description="Optional H3 subsections — may be empty.",
    )


class ArticlesGroqOutput(BaseModel):
    """Strict Groq JSON output shape for articles."""

    title: str = Field(..., min_length=1, description="SEO-optimized, click-worthy title.")
    slug: str = Field(..., min_length=1, description="URL-friendly slug derived from title.")
    metaDescription: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Meta description targeting 150-160 characters.",
    )
    intro: str = Field(..., min_length=1, description="Opening hook paragraph without heading.")
    sections: list[ArticleSectionGroq] = Field(
        ...,
        min_length=1,
        description="H2 sections with optional H3 subsections.",
    )
    conclusion: str = Field(..., min_length=1, description="Closing insight with soft product mention.")
    wordCount: int = Field(..., ge=1, description="Approximate total word count of the article.")


class ArticlesResponse(BaseModel):
    """Articles agent API response — compatible with frontend."""

    title: str = Field(..., description="Article title.")
    slug: str = Field(..., description="URL slug.")
    content: str = Field(..., description="Full article as markdown.")
    wordCount: int = Field(..., description="Word count of the article.")
    metaDescription: str = Field(..., description="SEO meta description.")


def slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug[:80] or "article"


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CompanyProfileInput(BaseModel):
    site: str = ""
    company_name: str = ""
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    twitter_handle: str = ""
    linkedin_url: str = ""
    competitors: list[str] = Field(default_factory=list)
    team_size: str = ""


def parse_company_profile(raw: dict[str, Any] | None) -> CompanyProfileInput | None:
    if not raw:
        return None
    try:
        return CompanyProfileInput.model_validate(raw)
    except Exception:
        return None


def format_company_context_block(profile: CompanyProfileInput | None) -> str:
    if not profile:
        return ""
    parts: list[str] = []
    if profile.company_name:
        parts.append(f"Company: {profile.company_name}")
    if profile.site:
        parts.append(f"Website: {profile.site}")
    if profile.description:
        parts.append(f"Description: {profile.description}")
    if profile.tags:
        parts.append("Tags: " + ", ".join(profile.tags))
    if profile.team_size:
        parts.append(f"Team size: {profile.team_size}")
    if profile.twitter_handle:
        parts.append(f"X / Twitter: @{profile.twitter_handle.lstrip('@')}")
    if profile.linkedin_url:
        parts.append(f"LinkedIn: {profile.linkedin_url}")
    if not parts:
        return ""
    return "User-provided company profile (authoritative — prefer over generic assumptions):\n" + "\n".join(
        f"- {p}" for p in parts
    )

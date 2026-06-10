from __future__ import annotations

from pydantic import ValidationError

from app.agents.articles.prompts import SYSTEM_PROMPT
from app.agents.articles.schemas import (
    ArticlesGroqOutput,
    ArticlesRequest,
    ArticlesResponse,
    slugify,
    word_count,
)
from app.core.groq_client import groq_json_completion

AGENT_NAME = "articles"


def _build_user_prompt(body: ArticlesRequest) -> str:
    competitors = ", ".join(body.competitors) if body.competitors else "none listed"
    keywords = ", ".join(body.keywords) if body.keywords else "none listed"
    return (
        f"Article type: {body.articleType}\n"
        f"Target keyword: {body.targetKeyword}\n"
        f"Product: {body.productInfo}\n"
        f"Brand voice: {body.brandVoice}\n"
        f"Marketing strategy: {body.marketingStrategy}\n"
        f"Competitors: {competitors}\n"
        f"Keywords: {keywords}\n"
        "Write a complete SEO article (800-1500 words) following the style rules and schema."
    )


def _assemble_markdown(article: ArticlesGroqOutput) -> str:
    parts = [f"# {article.title}", "", article.intro.strip(), ""]
    for section in article.sections:
        parts.append(f"## {section.heading.strip()}")
        parts.append("")
        parts.append(section.content.strip())
        parts.append("")
        for sub in section.subSections:
            parts.append(f"### {sub.heading.strip()}")
            parts.append("")
            parts.append(sub.content.strip())
            parts.append("")
    parts.append(article.conclusion.strip())
    return "\n".join(parts).strip()


async def _groq_validated(user_prompt: str) -> ArticlesGroqOutput | dict[str, str]:
    for attempt in range(2):
        try:
            raw = await groq_json_completion(
                agent_name=AGENT_NAME,
                system=SYSTEM_PROMPT,
                user=user_prompt,
                max_tokens=8000,
                temperature=0.35,
                strict=attempt > 0,
            )
            return ArticlesGroqOutput.model_validate(raw)
        except ValidationError as exc:
            if attempt == 0:
                continue
            return {"error": f"Articles output validation failed: {exc}"}
        except ValueError as exc:
            return {"error": str(exc)}
        except Exception as exc:
            return {"error": f"Articles agent failed: {exc}"}
    return {"error": "Articles output validation failed"}


async def run_articles_agent(body: ArticlesRequest) -> ArticlesResponse | dict[str, str]:
    result = await _groq_validated(_build_user_prompt(body))
    if isinstance(result, dict):
        return result

    content = _assemble_markdown(result)
    if not content.strip():
        return {"error": "Groq returned incomplete article"}

    title = result.title.strip()
    slug = result.slug.strip() or slugify(title)
    meta = result.metaDescription.strip()
    wc = result.wordCount or word_count(content)

    return ArticlesResponse(
        title=title,
        slug=slug,
        content=content,
        wordCount=wc,
        metaDescription=meta,
    )

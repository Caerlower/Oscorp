from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path.home() / ".oscorp-agent"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    oscorp_api_url: str = "http://127.0.0.1:5050"
    oscorp_id: int
    oscorp_api_key: str = "oscorp_dev_key"

    # LLM provider config (Groq OpenAI-compatible by default)
    groq_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "llama-3.3-70b-versatile"

    # X / Twitter credentials (used in Phase 4 posting tools)
    x_username: str = ""
    x_password: str = ""
    x_email: str = ""
    x_posting_mode: str = "browser"
    x_auto_login: bool = False
    x_execution_mode: str = "post"
    x_queue_fee_micro_usdc: int = 10_000
    x_dedup_window_seconds: int = 21_600
    browser_headless: bool = False
    browser_channel: str = "chrome"
    browser_profile_dir: str = ""
    browser_executable_path: str = ""
    browser_cdp_url: str = ""

    # Runtime mode: "plan_only" (default) or "tool_use"
    agent_mode: str = "plan_only"
    agent_verbose: bool = True
    agent_presentation_mode: bool = True

    agent_cycle_interval: int = Field(default=30)
    heartbeat_interval: int = Field(default=60)
    max_iterations: int = Field(default=10)
    tx_explorer_base_url: str = "http://127.0.0.1:8980/v2/transactions"


def ensure_app_dir() -> Path:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    return APP_DIR


def resolve_llm_api_key(settings: Settings) -> str:
    """Prefer GROQ_API_KEY, fallback to OPENAI_API_KEY."""
    return settings.groq_api_key or settings.openai_api_key

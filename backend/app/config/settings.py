from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Oscorp"
    debug: bool = False
    # Persist users/agent wallets across backend restarts (dev default: ./data)
    data_dir: str = Field(default="data", validation_alias="OSCORP_DATA_DIR")
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Groq (OpenAI-compatible API) — draft generation
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    x402_payer_url: str = "http://127.0.0.1:8110"
    # Skip x402 + provider HTTP calls; returns mock provider JSON (Groq draft still runs)
    provider_stub_mode: bool = Field(
        default=False,
        validation_alias="OSCORP_PROVIDER_STUB",
    )

    algod_address: str = "https://testnet-api.algonode.cloud"
    algod_token: str = ""
    usdc_asset_id: int = 10458941
    # Optional: TestNet account with ALGO — auto-funds new agent wallets + USDC opt-in on connect
    dev_faucet_mnemonic: str = ""
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000"

    trend_analyzer_url: str = "http://127.0.0.1:8101"
    hook_generator_url: str = "http://127.0.0.1:8102"
    thread_generator_url: str = "http://127.0.0.1:8103"

    # Pre-cycle research via Groq (policy + memory; not live X API)
    groq_research_enabled: bool = Field(
        default=True,
        validation_alias="OSCORP_GROQ_RESEARCH_ENABLED",
    )

    telegram_operator: str = "oscorp"
    telegram_bot_token: str = ""


settings = Settings()

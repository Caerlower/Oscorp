from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Oscorp"
    debug: bool = False
    data_dir: str = Field(default="data", validation_alias="OSCORP_DATA_DIR")
    api_host: str = "0.0.0.0"
    api_port: int = Field(default=8000, validation_alias=AliasChoices("API_PORT", "PORT"))

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    firecrawl_api_key: str = ""
    pagespeed_api_key: str = ""

    algod_address: str = Field(
        default="https://testnet-api.algonode.cloud",
        validation_alias="ALGORAND_NODE_URL",
    )
    algod_token: str = ""
    usdc_asset_id: int = 10458941
    dev_faucet_mnemonic: str = Field(
        default="",
        validation_alias=AliasChoices("DEV_FAUCET_MNEMONIC", "OSCORP_DEV_FAUCET_MNEMONIC"),
    )
    facilitator_url: str = Field(
        default="https://facilitator.goplausible.xyz",
        validation_alias="FACILITATOR_URL",
    )
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_service_key: str = Field(default="", validation_alias="SUPABASE_SERVICE_KEY")
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:8080,http://localhost:8080"


settings = Settings()

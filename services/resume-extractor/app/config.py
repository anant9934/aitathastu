from pathlib import Path
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    environment: str = 'development'
    extractor_api_token: str = 'development-only-change-me'
    extractor_owner_id: str = 'local-owner'
    extractor_verifier_token: str = ''
    storage_dir: Path = Path('data/private')
    # Keep in sync with RESUME_MAX_UPLOAD_MB in lib/config/upload-limits.ts.
    max_upload_mb: int = Field(default=4, ge=1, le=100)
    max_pages: int = Field(default=15, ge=1, le=200)
    max_ocr_seconds: int = Field(default=35, ge=1, le=120)
    max_processing_seconds: int = Field(default=90, ge=5, le=600)
    retention_days: int = Field(default=7, ge=1, le=365)
    allowed_origin: str = 'http://localhost:3000'
    enable_llm: bool = False
    llm_provider: str = 'disabled'

    @model_validator(mode='after')
    def safe_production(self):
        if self.environment.lower() == 'production' and (
            self.extractor_api_token == 'development-only-change-me'
            or len(self.extractor_api_token) < 32
        ):
            raise ValueError('Production requires a strong EXTRACTOR_API_TOKEN (32+ chars).')
        if self.extractor_verifier_token and self.extractor_verifier_token == self.extractor_api_token:
            raise ValueError('EXTRACTOR_VERIFIER_TOKEN must differ from EXTRACTOR_API_TOKEN.')
        if self.environment.lower() == 'production' and self.extractor_verifier_token and len(self.extractor_verifier_token) < 32:
            raise ValueError('Production requires a strong EXTRACTOR_VERIFIER_TOKEN (32+ chars) when set.')
        return self

settings = Settings()

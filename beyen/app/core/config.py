import os
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to beyen/.env so it is reliably loaded regardless of cwd
ENV_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))

# Placeholder secrets that must never be used to sign real tokens
_WEAK_SECRETS = {"", "change-me", "change-me-in-production", "secret", "changeme"}


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str  # Required — no default. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    STANDARD_MOISTURE_PERCENT: float = 7.0
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12-hour shift session
    STATION_NAME: str = "COMIS Buying Station"
    APP_ENV: str = "development"
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # Google Sign-In: the OAuth client ID the frontend uses. Access tokens issued
    # to any other client are rejected.
    GOOGLE_CLIENT_ID: str = "373563051980-avoohd3l5p9dd25l1aom3pkad0df8nof.apps.googleusercontent.com"

    # First System Admin. Created only when both are set and no admin exists yet.
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    # Marketplace photo/video storage. Local disk by default; on hosts with an
    # ephemeral disk (e.g. Render) point MEDIA_ROOT at a persistent disk.
    MEDIA_ROOT: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../media"))
    MEDIA_URL_PREFIX: str = "/media"
    # Identity documents: private, never served from /media (only via authenticated endpoints)
    PRIVATE_MEDIA_ROOT: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../private_media"))

    # SMS for phone verification codes. "console" prints codes (development only);
    # in production no provider means phone verification is unavailable.
    SMS_PROVIDER: str = "console"
    # Also text members (phone-verified only, max 1 per day) when a new post matches what they need/sell
    MARKET_ALERT_SMS: bool = False

    # Shared rate-limit counters (optional). Without it, limits are kept in memory per process.
    REDIS_URL: str | None = None

    # Photos and videos (listings, profile photos) on Cloudinary. Format:
    #   cloudinary://<api_key>:<api_secret>@<cloud_name>
    # Without it, files are stored on the server's disk under MEDIA_ROOT.
    CLOUDINARY_URL: str | None = None

    # Password-reset emails (read from .env; Render/Docker can also set them as env vars)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"   # base of the reset link in emails

    # Reading the NIN / passport number from ID photos.
    # "local": free offline engine (pip install rapidocr_onnxruntime), run in a child process;
    # "ocrspace": OCR.space cloud API (needs OCR_SPACE_API_KEY; sends the photo to them);
    # "none": members type the number. An admin reviews every document either way.
    OCR_PROVIDER: str = "local"
    OCR_SPACE_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _check_secret_key(self):
        if self.SECRET_KEY.strip().lower() in _WEAK_SECRETS or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be set to a random value of at least 32 characters. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return self


settings = Settings()

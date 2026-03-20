"""
Configuration management for the enterprise mail server.
Loads settings from environment variables and .env file.
"""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


class Config:
    # Base paths
    BASE_DIR: Path = Path(__file__).parent
    LOGS_DIR: Path = BASE_DIR / "logs"
    STATIC_DIR: Path = BASE_DIR / "static"
    DATA_DIR: Path = BASE_DIR / "data"

    # Server identity
    DOMAIN: str = os.getenv("MAIL_DOMAIN", "localhost")
    COMPANY_NAME: str = os.getenv("COMPANY_NAME", "Enterprise Mail")
    SERVER_HOSTNAME: str = os.getenv("SERVER_HOSTNAME", "localhost")

    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "enterprise_mail")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(64))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # Admin credentials
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", f"admin@{DOMAIN}")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@1234!")
    ADMIN_DISPLAY_NAME: str = os.getenv("ADMIN_DISPLAY_NAME", "Administrator")

    # SMTP Server
    SMTP_HOST: str = os.getenv("SMTP_HOST", "0.0.0.0")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "2525"))
    SMTP_SUBMISSION_PORT: int = int(os.getenv("SMTP_SUBMISSION_PORT", "5870"))
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "false").lower() == "true"

    # External SMTP relay (for sending outbound mail)
    RELAY_HOST: str = os.getenv("RELAY_HOST", "")
    RELAY_PORT: int = int(os.getenv("RELAY_PORT", "587"))
    RELAY_USERNAME: str = os.getenv("RELAY_USERNAME", "")
    RELAY_PASSWORD: str = os.getenv("RELAY_PASSWORD", "")
    RELAY_USE_TLS: bool = os.getenv("RELAY_USE_TLS", "true").lower() == "true"

    # IMAP Server
    IMAP_HOST: str = os.getenv("IMAP_HOST", "0.0.0.0")
    IMAP_PORT: int = int(os.getenv("IMAP_PORT", "1430"))
    IMAP_USE_TLS: bool = os.getenv("IMAP_USE_TLS", "false").lower() == "true"

    # Web Server
    WEB_HOST: str = os.getenv("WEB_HOST", "0.0.0.0")
    WEB_PORT: int = int(os.getenv("WEB_PORT", "8080"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # CORS
    CORS_ORIGINS: list = os.getenv(
        "CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080"
    ).split(",")

    # Mail settings
    MAX_EMAIL_SIZE_MB: int = int(os.getenv("MAX_EMAIL_SIZE_MB", "25"))
    MAX_ATTACHMENT_SIZE_MB: int = int(os.getenv("MAX_ATTACHMENT_SIZE_MB", "10"))
    DEFAULT_QUOTA_MB: int = int(os.getenv("DEFAULT_QUOTA_MB", "1024"))

    # Rate limiting
    LOGIN_RATE_LIMIT: int = int(os.getenv("LOGIN_RATE_LIMIT", "10"))  # per minute
    SMTP_RATE_LIMIT: int = int(os.getenv("SMTP_RATE_LIMIT", "100"))  # per hour

    # TLS/SSL certificate paths
    TLS_CERT_FILE: str = os.getenv("TLS_CERT_FILE", str(BASE_DIR / "cert.pem"))
    TLS_KEY_FILE: str = os.getenv("TLS_KEY_FILE", str(BASE_DIR / "key.pem"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = str(LOGS_DIR / "mail_server.log")

    # Features
    ENABLE_SPAM_FILTER: bool = os.getenv("ENABLE_SPAM_FILTER", "true").lower() == "true"
    ENABLE_VIRUS_SCAN: bool = os.getenv("ENABLE_VIRUS_SCAN", "false").lower() == "true"
    REQUIRE_AUTH_FOR_SMTP: bool = (
        os.getenv("REQUIRE_AUTH_FOR_SMTP", "true").lower() == "true"
    )

    # Default folders
    DEFAULT_FOLDERS: list = ["INBOX", "Sent", "Drafts", "Spam", "Trash", "Archive"]

    @classmethod
    def ensure_dirs(cls):
        """Create necessary directories if they don't exist."""
        cls.LOGS_DIR.mkdir(exist_ok=True)
        cls.STATIC_DIR.mkdir(exist_ok=True)
        cls.DATA_DIR.mkdir(exist_ok=True)
        (cls.STATIC_DIR / "css").mkdir(exist_ok=True)
        (cls.STATIC_DIR / "js").mkdir(exist_ok=True)

    @classmethod
    def to_dict(cls) -> dict:
        """Return config as dictionary (excluding secrets)."""
        return {
            "domain": cls.DOMAIN,
            "company_name": cls.COMPANY_NAME,
            "smtp_port": cls.SMTP_PORT,
            "smtp_submission_port": cls.SMTP_SUBMISSION_PORT,
            "imap_port": cls.IMAP_PORT,
            "web_port": cls.WEB_PORT,
            "max_email_size_mb": cls.MAX_EMAIL_SIZE_MB,
            "default_quota_mb": cls.DEFAULT_QUOTA_MB,
        }


config = Config()

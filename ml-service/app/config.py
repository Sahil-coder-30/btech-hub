from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All config comes from environment variables (or a .env file next to the service)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret. The Next.js server sends it as "Authorization: Bearer <token>".
    ml_service_token: str = ""

    # Limits for uploads
    max_file_mb: int = 40
    max_pages: int = 200
    render_scale: float = 2.0  # PDF page render scale for OCR (2.0 is about 144 dpi)
    min_text_chars_per_page: int = 40  # below this a PDF page is treated as scanned

    # Optional Gemini vision fallback for pages local OCR cannot read (handwriting, very noisy scans)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_embedding_model: str = "gemini-embedding-001"
    vision_fallback_confidence: float = 0.55

    # Embeddings. Documents and queries must use the same provider, so the Next.js app reads the same setting.
    embedding_provider: str = "mistral"  # mistral | gemini
    mistral_api_key: str = ""
    mistral_embedding_model: str = "mistral-embed"  # 1024 dims, matches the Pinecone index

    # Indexing targets (same ones the Next.js app reads from)
    pinecone_api_key: str = ""
    pinecone_index: str = "btechhub-vectors"
    pinecone_namespace: str = "study-material-mistral"
    embedding_dimensions: int = 1024
    supabase_url: str = ""
    supabase_secret_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()

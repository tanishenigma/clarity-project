import os


def get_hf_token() -> str | None:
    """Return Hugging Face token from common env vars, if present."""
    return (
        os.getenv("HF_TOKEN")
        or os.getenv("HUGGINGFACEHUB_API_TOKEN")
        or os.getenv("HUGGINGFACE_TOKEN")
    )

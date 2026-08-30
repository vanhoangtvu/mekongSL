"""
LLM Router — Groq key rotation để tránh rate limit 429.
Dùng round-robin, khi một key bị 429 tự động chuyển sang key tiếp theo.
"""
import os
import itertools
import threading
import logging
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from groq import RateLimitError, APIStatusError

logger = logging.getLogger(__name__)


def _load_groq_keys() -> list[str]:
    keys = []
    for i in range(1, 20):  # hỗ trợ tối đa 19 keys
        key = os.getenv(f"GROQ_KEY_{i}")
        if key and key.strip() and not key.startswith("your-"):
            keys.append(key.strip())
    if not keys:
        raise ValueError(
            "Không tìm thấy Groq API key nào. "
            "Hãy set GROQ_KEY_1, GROQ_KEY_2, ... trong .env"
        )
    logger.info(f"Đã load {len(keys)} Groq API key(s)")
    return keys


_keys: list[str] = []
_key_cycle: Optional[itertools.cycle] = None
_lock = threading.Lock()


def init_llm_router():
    """Gọi một lần khi khởi động service."""
    global _keys, _key_cycle
    _keys = _load_groq_keys()
    _key_cycle = itertools.cycle(_keys)


def get_next_key() -> str:
    """Lấy Groq key tiếp theo theo round-robin."""
    with _lock:
        if _key_cycle is None:
            init_llm_router()
        return next(_key_cycle)


def get_groq_llm(temperature: float = 0.1, model: str = None):
    """
    Trả về một ChatGroq instance với key tiếp theo trong vòng.
    temperature thấp (0.0-0.2) để đảm bảo output JSON ổn định.
    """
    from langchain_groq import ChatGroq
    key = get_next_key()
    model_name = model or os.getenv("GROQ_MODEL", "qwen/qwen3-7b-it")
    return ChatGroq(
        api_key=key,
        model=model_name,
        temperature=temperature,
        max_tokens=1500,
    )


def groq_retry_decorator():
    """
    Decorator retry cho các hàm gọi Groq LLM.
    Khi bị 429: đổi key + wait exponential.
    """
    return retry(
        retry=retry_if_exception_type((RateLimitError, APIStatusError)),
        stop=stop_after_attempt(len(_keys) * 2 + 1),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        before_sleep=lambda retry_state: logger.warning(
            f"Groq rate limit, thử lại lần {retry_state.attempt_number}..."
        ),
        reraise=True,
    )

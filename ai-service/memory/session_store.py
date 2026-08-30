"""
In-memory session store dùng LangChain InMemoryChatMessageHistory.
Tắt service → mất toàn bộ (by design, không lưu DB).
"""
import os
import uuid
import threading
import logging
from typing import Optional
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import HumanMessage, AIMessage

logger = logging.getLogger(__name__)

WINDOW_SIZE = int(os.getenv("MEMORY_WINDOW_SIZE", "10"))

# Dict: session_id → InMemoryChatMessageHistory
_sessions: dict[str, InMemoryChatMessageHistory] = {}
_lock = threading.Lock()


def get_or_create_session(session_id: Optional[str]) -> tuple[str, InMemoryChatMessageHistory]:
    """
    Lấy hoặc tạo mới session.
    Trả về (session_id, chat_history).
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    with _lock:
        if session_id not in _sessions:
            _sessions[session_id] = InMemoryChatMessageHistory()
            logger.info(f"Tạo session mới: {session_id}")
        return session_id, _sessions[session_id]


def get_session(session_id: str) -> Optional[InMemoryChatMessageHistory]:
    """Lấy session nếu tồn tại."""
    with _lock:
        return _sessions.get(session_id)


def delete_session(session_id: str) -> bool:
    """Xóa session."""
    with _lock:
        if session_id in _sessions:
            del _sessions[session_id]
            logger.info(f"Đã xóa session: {session_id}")
            return True
        return False


def list_sessions() -> list[str]:
    """Danh sách session IDs đang tồn tại."""
    with _lock:
        return list(_sessions.keys())


def add_to_session(session_id: str, user_msg: str, ai_msg: str):
    """Thêm turn mới vào session, giữ tối đa WINDOW_SIZE turns."""
    with _lock:
        history = _sessions.get(session_id)
        if not history:
            return
        history.add_user_message(user_msg)
        history.add_ai_message(ai_msg)
        # Trim để tránh vượt context window: giữ N turns cuối
        max_messages = WINDOW_SIZE * 2  # mỗi turn = 2 messages
        if len(history.messages) > max_messages:
            history.messages = history.messages[-max_messages:]


def get_session_history(session_id: str) -> list[dict]:
    """Lấy lịch sử chat dạng list dict cho intent analyzer."""
    with _lock:
        history = _sessions.get(session_id)
        if not history:
            return []
        result = []
        for msg in history.messages:
            if isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                result.append({"role": "assistant", "content": msg.content})
        return result


def get_langchain_messages(session_id: str) -> list:
    """Lấy LangChain message objects cho synthesizer."""
    with _lock:
        history = _sessions.get(session_id)
        if not history:
            return []
        # Trả về N turns cuối
        return history.messages[-(WINDOW_SIZE * 2):]

"""
API Routes cho AI Microservice.
POST /chat — gửi câu hỏi, nhận AIResponse
GET /health — health check
GET /sessions/{id} — lịch sử session
DELETE /sessions/{id} — xóa session
GET /profiles — danh sách analysis profiles (Phase 3+)
"""
import logging
from fastapi import APIRouter, HTTPException
from models.response_model import AIResponse, ChatRequest
from memory.session_store import get_session_history, delete_session, list_sessions

logger = logging.getLogger(__name__)
router = APIRouter()


from fastapi.responses import StreamingResponse
from orchestrator.orchestrator import process_message_stream

@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Endpoint chính (Streaming SSE): nhận câu hỏi, trả về stream các event.
    Frontend sẽ đọc các sự kiện: "step", "metadata", "chunk", "end", "error".
    """
    logger.info(
        f"Chat Stream request | session={request.sessionId} | "
        f"lat={request.lat} | lon={request.lon} | "
        f"msg={request.message[:80]}..."
    )
    
    return StreamingResponse(
        process_message_stream(
            message=request.message,
            session_id=request.sessionId,
            lat=request.lat,
            lon=request.lon,
        ),
        media_type="text/event-stream"
    )


@router.get("/health")
async def health():
    """Health check — kiểm tra service và số sessions đang mở."""
    return {
        "status": "ok",
        "service": "Mekong AI Microservice",
        "version": "1.0.0-phase1",
        "active_sessions": len(list_sessions()),
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Lấy lịch sử hội thoại của session."""
    history = get_session_history(session_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return {"sessionId": session_id, "messages": history, "count": len(history)}


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str):
    """Xóa session và toàn bộ lịch sử."""
    deleted = delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return {"deleted": True, "sessionId": session_id}


@router.get("/profiles")
async def get_profiles():
    """Danh sách Analysis Profiles — Phase 3+."""
    return {
        "profiles": [
            {"id": "shrimp_farming", "name": "Nuôi tôm", "status": "coming_soon"},
            {"id": "rice_farming", "name": "Trồng lúa", "status": "coming_soon"},
            {"id": "fish_farming", "name": "Nuôi cá", "status": "coming_soon"},
            {"id": "flood_risk", "name": "Đánh giá ngập", "status": "coming_soon"},
        ]
    }

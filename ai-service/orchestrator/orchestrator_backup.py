"""
AI Orchestrator — Điều phối toàn bộ luồng xử lý.

Phase 1: Intent → Greeting / General
Phase 2: Data Tools (MySQL) → Water Quality Query, Station Query
Phase 3+: Analysis Engine (Suitability, Risk)
"""
import logging
import json
from datetime import datetime
from typing import Optional

from memory.session_store import (
    get_or_create_session, get_session_history,
    add_to_session, get_langchain_messages
)
from orchestrator.intent_analyzer import analyze_intent
from orchestrator.location_resolver import resolve_location
from orchestrator.data_planner import plan_data_requirements
from orchestrator.response_synthesizer import (
    synthesize_greeting,
    synthesize_general_answer,
    synthesize_response,
)
from models.response_model import (
    AIResponse, IntentInfo, ExecutionStep, Evidence
)

logger = logging.getLogger(__name__)

# Intent types xử lý trực tiếp không cần dữ liệu GIS
_DIRECT_INTENTS = {"GREETING", "GENERAL_QUESTION"}

# Intent types cần dữ liệu GIS
_DATA_INTENTS = {
    "QUERY_WATER_QUALITY", "QUERY_SALINITY", "TEMPORAL_ANALYSIS",
    "SITE_SUITABILITY_ANALYSIS", "FLOOD_RISK_ANALYSIS", "LANDUSE_ANALYSIS",
}


def process_message(
    message: str,
    session_id: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
) -> AIResponse:
    """Entry point chính."""
    steps: list[ExecutionStep] = []
    evidences: list[Evidence] = []

    # ── Bước 1: Session ─────────────────────────────────────────
    session_id, _history_obj = get_or_create_session(session_id)
    steps.append(ExecutionStep(
        stepId="step_session",
        title="Khởi tạo phiên",
        detail=f"Session: {session_id[:16]}...",
        status="SUCCESS",
    ))

    # ── Bước 2: Phân tích Intent ────────────────────────────────
    history = get_session_history(session_id)
    try:
        intent_raw = analyze_intent(message, lat, lon, history)
    except Exception as e:
        logger.error(f"Intent analysis failed: {e}")
        intent_raw = {
            "intent_type": "GENERAL_QUESTION",
            "activity": None,
            "location_type": "GPS" if lat else "UNKNOWN",
            "location_value": {"lat": lat, "lon": lon} if lat else None,
            "spatial_scope": "nearby",
            "radius_km": 10.0,
            "time_range": "latest",
            "required_data": [],
            "language": "vi",
            "summary": "Câu hỏi chung",
        }

    intent_type = intent_raw.get("intent_type", "GENERAL_QUESTION")
    steps.append(ExecutionStep(
        stepId="step_intent",
        title="Phân tích câu hỏi",
        detail=f"Intent: {intent_type} | {intent_raw.get('summary', '')}",
        status="SUCCESS",
    ))

    # Build IntentInfo model
    intent_info = IntentInfo(
        type=intent_type,
        activity=intent_raw.get("activity"),
        locationType=intent_raw.get("location_type", "UNKNOWN"),
        locationValue=intent_raw.get("location_value"),
        spatialScope=intent_raw.get("spatial_scope"),
        radiusKm=intent_raw.get("radius_km"),
        timeRange=intent_raw.get("time_range", "latest"),
        requiredData=intent_raw.get("required_data", []),
        summary=intent_raw.get("summary", ""),
    )

    # ── Xử lý theo Intent ───────────────────────────────────────
    response_text: str
    analysis_result: dict = {}

    if intent_type == "GREETING":
        response_text = synthesize_greeting()
        steps.append(ExecutionStep(
            stepId="step_greeting",
            title="Xử lý lời chào",
            detail="Trả về hướng dẫn hệ thống",
            status="SUCCESS",
        ))

    elif intent_type == "GENERAL_QUESTION":
        lc_msgs = get_langchain_messages(session_id)
        response_text = synthesize_general_answer(message, lc_msgs)
        steps.append(ExecutionStep(
            stepId="step_general",
            title="Trả lời câu hỏi chung",
            detail="Không cần dữ liệu GIS",
            status="SUCCESS",
        ))

    elif intent_type in _DATA_INTENTS:
        response_text, analysis_result, steps, evidences = _handle_data_query(
            message, intent_raw, intent_type, lat, lon, steps
        )

    else:
        # Unknown intent → general answer
        lc_msgs = get_langchain_messages(session_id)
        response_text = synthesize_general_answer(message, lc_msgs)
        steps.append(ExecutionStep(
            stepId="step_unknown",
            title="Intent không xác định",
            detail=f"Fallback sang General Answer",
            status="WARNING",
        ))

    # ── Cập nhật Memory ─────────────────────────────────────────
    try:
        add_to_session(session_id, message, response_text)
        current_history = get_session_history(session_id)
    except Exception as e:
        logger.warning(f"Không cập nhật được memory: {e}")
        current_history = []

    steps.append(ExecutionStep(
        stepId="step_memory",
        title="Cập nhật ngữ cảnh",
        detail=f"Session: {len(current_history)} messages",
        status="SUCCESS",
    ))

    return AIResponse(
        success=True,
        sessionId=session_id,
        message=response_text,
        intent=intent_info,
        evidence=evidences,
        executionSteps=steps,
        timestamp=datetime.utcnow().isoformat() + "Z",
        metadata={"analysis_result": analysis_result} if analysis_result else {},
    )


def _handle_data_query(
    message: str,
    intent_raw: dict,
    intent_type: str,
    lat: Optional[float],
    lon: Optional[float],
    steps: list,
) -> tuple[str, dict, list, list]:
    """Xử lý các câu hỏi cần dữ liệu GIS."""
    from tools.water_quality_tool import query_water_quality
    evidences: list[Evidence] = []

    # Bước 3: Phân giải vị trí
    location = resolve_location(intent_raw, lat, lon)
    if location.get("resolved"):
        steps.append(ExecutionStep(
            stepId="step_location",
            title="Xác định vị trí",
            detail=f"{location.get('display_name', '')} | r={location.get('radius_km')} km",
            status="SUCCESS",
        ))
    else:
        steps.append(ExecutionStep(
            stepId="step_location",
            title="Xác định vị trí",
            detail=location.get("error", "Không xác định được vị trí"),
            status="WARNING",
        ))

    # Bước 4: Lập kế hoạch dữ liệu
    data_plan = plan_data_requirements(intent_raw)
    mysql_plan = [p for p in data_plan if p.get("source") == "mysql"]
    s3_plan = [p for p in data_plan if p.get("source") == "s3"]

    steps.append(ExecutionStep(
        stepId="step_data_plan",
        title="Lập kế hoạch thu thập dữ liệu",
        detail=f"MySQL: {[p['key'] for p in mysql_plan]} | S3: {[p['key'] for p in s3_plan]}",
        status="SUCCESS",
    ))

    # Bước 5: Thu thập dữ liệu MySQL
    tool_results: dict = {}
    time_range = intent_raw.get("time_range", "latest")

    for plan_item in mysql_plan[:3]:  # giới hạn 3 datasets MySQL để tránh timeout
        key = plan_item["key"]
        steps.append(ExecutionStep(
            stepId=f"step_tool_{key}",
            title=f"Thu thập dữ liệu: {plan_item['label']}",
            detail=f"Truy vấn MySQL → Java API /api/gis/water-quality",
            status="SUCCESS",
        ))

        result = query_water_quality(location, key, time_range)
        tool_results[key] = result

        if result.get("success") and result.get("evidence"):
            ev = result["evidence"]
            evidences.append(Evidence(
                dataset=ev.get("dataset", key),
                source=ev.get("source", "MySQL Database"),
                detail=ev.get("detail", ""),
                timestamp=str(ev.get("timestamp", "")),
                unit=ev.get("unit", ""),
                count=ev.get("count", 0),
            ))

        log_msg = (
            f"{len(result.get('stations', []))} trạm"
            if result.get("success")
            else result.get("error", "Lỗi")
        )
        steps[-1].detail = f"{steps[-1].detail} → {log_msg}"
        if not result.get("success"):
            steps[-1].status = "WARNING"

    # Bước 6: S3 GIS (Phase 4 — hiện tại stub)
    for plan_item in s3_plan:
        steps.append(ExecutionStep(
            stepId=f"step_s3_{plan_item['key']}",
            title=f"Dữ liệu GIS: {plan_item['label']}",
            detail="Phase 4: S3 GIS Engine đang tích hợp",
            status="SKIPPED",
        ))

    # Bước 7: Phân tích đánh giá chuyên sâu (Analysis Engine)
    from orchestrator.analysis_engine import evaluate_suitability
    activity = intent_raw.get("activity") or ""
    
    steps.append(ExecutionStep(
        stepId="step_analysis",
        title="Đánh giá chuyên sâu",
        detail="Tính toán điểm phù hợp dựa trên tiêu chuẩn chuyên ngành",
        status="SUCCESS",
    ))
    
    evaluation = evaluate_suitability(activity, tool_results)
    if evaluation.get("overall_status") == "NO_DATA":
        steps[-1].status = "WARNING"
        steps[-1].detail = "Không có đủ dữ liệu để đánh giá"
    else:
        steps[-1].detail = f"Trạng thái: {evaluation.get('overall_status')} | Điểm: {evaluation.get('overall_score')}/100"

    # Bước 8: Tổng hợp analysis_result
    analysis_result = {
        "intent": intent_raw,
        "location": location,
        "data_plan": [p["key"] for p in data_plan],
        "tool_results": tool_results,
        "evaluation": evaluation,
        "has_data": any(r.get("success") for r in tool_results.values()),
    }

    # Bước 9: Synthesize câu trả lời
    # Note: Truyền session_id chính xác từ context nếu có, hiện tại stub
    lc_msgs = []
    response_text = synthesize_response(message, intent_raw, analysis_result, lc_msgs)

    steps.append(ExecutionStep(
        stepId="step_synthesize",
        title="Tổng hợp câu trả lời",
        detail="LLM đọc kết quả phân tích → sinh text tiếng Việt",
        status="SUCCESS",
    ))

    return response_text, analysis_result, steps, evidences

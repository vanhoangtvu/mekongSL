"""
AI Orchestrator — Điều phối toàn bộ luồng xử lý.
Phase 4: Streaming API (SSE)
"""
import logging
import json
from datetime import datetime
from typing import Optional, AsyncGenerator

from memory.session_store import (
    get_or_create_session, get_session_history,
    add_to_session, get_langchain_messages
)
from orchestrator.ai_planner import generate_analysis_plan
from orchestrator.location_resolver import resolve_location
from orchestrator.response_synthesizer import (
    synthesize_greeting,
    synthesize_general_answer_stream,
    synthesize_response_stream,
)
from models.response_model import (
    IntentInfo, ExecutionStep, Evidence
)

logger = logging.getLogger(__name__)

_DIRECT_INTENTS = {"GREETING", "GENERAL_QUESTION"}
_DATA_INTENTS = {
    "QUERY_WATER_QUALITY", "QUERY_SALINITY", "TEMPORAL_ANALYSIS",
    "SITE_SUITABILITY_ANALYSIS", "FLOOD_RISK_ANALYSIS", "LANDUSE_ANALYSIS",
}

def _yield_event(event_type: str, data: dict) -> str:
    """Helper format SSE"""
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

async def process_message_stream(
    message: str,
    session_id: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
) -> AsyncGenerator[str, None]:
    """Streaming Entry Point (SSE)"""
    evidences = []
    analysis_result = {}
    full_response_text = ""
    
    try:
        # ── Bước 1: Session ─────────────────────────────────────────
        session_id, _history_obj = get_or_create_session(session_id)
        yield _yield_event("step", {
            "step": {"stepId": "step_session", "title": "Khởi tạo phiên", "detail": f"Session: {session_id[:16]}...", "status": "SUCCESS"}
        })

        # ── Bước 2: Phân tích Intent ────────────────────────────────
        history = get_session_history(session_id)
        try:
            plan_json = generate_analysis_plan(message, lat, lon, history)
        except Exception as e:
            logger.error(f"Planner failed: {e}")
            plan_json = {
                "analysis_mode": "GENERAL", "activity": None,
                "location": {"required": False, "scope": "UNKNOWN", "type": "GPS" if lat else "UNKNOWN", "name": ""},
                "time_range": "latest", "required_data": [], 
                "analysis_requirements": {"run_suitability": False, "run_risk": False}
            }

        analysis_mode = plan_json.get("analysis_mode", "GENERAL")
        activity = plan_json.get("activity")
        
        # Lấy đầy đủ location và requirements mới
        location_raw = plan_json.get("location", {})
        analysis_requirements = plan_json.get("analysis_requirements", {})
        
        intent_raw = {
            "analysis_mode": analysis_mode,
            "intent_type": analysis_mode, # Alias cho tương thích code cũ
            "activity": activity,
            "location_type": location_raw.get("type", "UNKNOWN"),
            "location_value": location_raw.get("name") if location_raw.get("type") != "GPS" else {"lat": lat, "lon": lon},
            "location": location_raw, # Truyền thẳng dict location mới
            "analysis_requirements": analysis_requirements,
            "radius_km": 10.0, # Default radius
            "time_range": plan_json.get("time_range", "latest"),
            "required_data": plan_json.get("required_data", [])
        }

        yield _yield_event("step", {
            "step": {"stepId": "step_intent", "title": "Phân tích kế hoạch", "detail": f"Mode: {analysis_mode} | Dữ liệu cần: {len(intent_raw['required_data'])} nguồn", "status": "SUCCESS"}
        })

        # Build IntentInfo model
        intent_info = IntentInfo(
            type=analysis_mode, activity=activity,
            locationType=intent_raw["location_type"], locationValue=intent_raw["location_value"],
            spatialScope=location_raw.get("scope", "nearby"), radiusKm=10.0,
            timeRange=intent_raw["time_range"], requiredData=intent_raw["required_data"],
            summary=f"Analysis Mode: {analysis_mode}",
        )

        # ── Xử lý theo Intent ───────────────────────────────────────
        if analysis_mode == "GREETING":
            yield _yield_event("step", {"step": {"stepId": "step_greeting", "title": "Xử lý lời chào", "detail": "Trả về hướng dẫn hệ thống", "status": "SUCCESS"}})
            full_response_text = synthesize_greeting()
            for chunk in _chunk_string(full_response_text):
                yield _yield_event("chunk", {"text": chunk})

        elif analysis_mode == "GENERAL" or analysis_mode not in ["QUERY_STATION_DATA", "SPATIAL_QUERY", "SUITABILITY", "RISK", "TREND", "COMPARISON"]:
            yield _yield_event("step", {"step": {"stepId": "step_general", "title": "Trả lời câu hỏi chung", "detail": "Không cần dữ liệu GIS", "status": "SUCCESS"}})
            lc_msgs = get_langchain_messages(session_id)
            # Use stream for general answer
            from orchestrator.response_synthesizer import synthesize_general_answer_stream
            for chunk in synthesize_general_answer_stream(message, lc_msgs):
                full_response_text += chunk
                yield _yield_event("chunk", {"text": chunk})

        else:
            # Data query flow
            from tools.water_quality_tool import query_water_quality
            
            # Bước 3: Phân giải vị trí (Chỉ nếu bắt buộc)
            location = {}
            loc_plan = intent_raw.get("location", {})
            if loc_plan.get("required", True):
                location = resolve_location(intent_raw, lat, lon)
                if location.get("resolved"):
                    yield _yield_event("step", {"step": {"stepId": "step_location", "title": "Xác định vị trí", "detail": f"{location.get('display_name', '')} | r={location.get('radius_km')} km", "status": "SUCCESS"}})
                else:
                    yield _yield_event("step", {"step": {"stepId": "step_location", "title": "Xác định vị trí", "detail": location.get("error", "Không xác định được vị trí"), "status": "WARNING"}})
            else:
                yield _yield_event("step", {"step": {"stepId": "step_location", "title": "Vị trí", "detail": f"Phạm vi: {loc_plan.get('scope', 'ALL_STATIONS')} (Không yêu cầu tọa độ)", "status": "SUCCESS"}})

            # Bước 4: Routing dựa trên required_data của Planner
            yield _yield_event("step", {"step": {"stepId": "step_data_plan", "title": "Kích hoạt Tool Router", "detail": f"Cần lấy: {', '.join(intent_raw['required_data'])}", "status": "SUCCESS"}})

            import yaml
            from pathlib import Path
            catalog_path = Path(__file__).parent.parent / "config" / "data_catalog.yaml"
            with open(catalog_path, "r", encoding="utf-8") as f:
                data_catalog = yaml.safe_load(f).get("datasets", {})
                
            mysql_plan = []
            mysql_ecowitt_plan = []
            s3_plan = []
            
            for key in intent_raw["required_data"]:
                if key in data_catalog:
                    src = data_catalog[key].get("source")
                    plan_item = data_catalog[key]
                    plan_item["key"] = key
                    if src == "mysql":
                        mysql_plan.append(plan_item)
                    elif src == "mysql_ecowitt":
                        mysql_ecowitt_plan.append(plan_item)
                    elif src == "s3":
                        s3_plan.append(plan_item)

            # Khởi tạo variables
            tool_results = {}
            time_range = intent_raw.get("time_range", "latest")
            analysis_mode = intent_raw.get("analysis_mode", "GENERAL")

            if analysis_mode == "QUERY_STATION_DATA":
                from tools.water_quality_tool import get_latest_station_data
                for key in intent_raw["required_data"]:
                    result = get_latest_station_data(key)
                    tool_results[key] = result
                    status = "SUCCESS" if result.get("success") else "WARNING"
                    count_str = f"{len(result.get('stations', []))} trạm" if result.get("success") else "Lỗi"
                    yield _yield_event("step", {"step": {"stepId": f"step_tool_{key}", "title": f"Dữ liệu trạm: {data_catalog.get(key, {}).get('label', key)}", "detail": count_str, "status": status}})
                    
                    if result.get("success") and result.get("evidence"):
                        ev = result["evidence"]
                        evidences.append(Evidence(
                            dataset=ev.get("dataset", key), source=ev.get("source", "MySQL All Stations"), detail="Truy vấn danh sách trạm mới nhất",
                            timestamp="", unit="", count=ev.get("count", 0),
                        ))

            elif analysis_mode == "TREND" or time_range not in ["current", "latest"]:
                from tools.temporal_tool import analyze_temporal_trend
                
                yield _yield_event("step", {"step": {"stepId": "step_temporal", "title": "Phân tích chuỗi thời gian", "detail": "Kích hoạt Temporal AI", "status": "PROCESSING"}})
                
                # Cố gắng tính days từ time_range, mặc định 30 ngày
                days = 30
                if "days" in time_range:
                    try:
                        days = int(time_range.split()[0])
                    except: pass
                    
                for key in intent_raw["required_data"]:
                    if key in data_catalog and data_catalog[key].get("temporal"):
                        result = analyze_temporal_trend(location, key, days=days)
                        tool_results[key] = result
                        status = "SUCCESS" if result.get("success") else "WARNING"
                        yield _yield_event("step", {"step": {"stepId": f"step_temp_{key}", "title": f"Phân tích xu hướng: {data_catalog[key]['label']}", "detail": result.get("summary", {}).get("trend", "Lỗi"), "status": status}})
            else:
                for plan_item in mysql_plan[:3]:
                    key = plan_item["key"]
                    
                    result = query_water_quality(location, key, time_range)
                    tool_results[key] = result
                    
                    log_msg = f"{len(result.get('stations', []))} trạm" if result.get("success") else result.get("error", "Lỗi")
                    status = "SUCCESS" if result.get("success") else "WARNING"
                    
                    yield _yield_event("step", {"step": {"stepId": f"step_tool_{key}", "title": f"Thu thập dữ liệu: {plan_item['label']}", "detail": f"MySQL → {log_msg}", "status": status}})

                    if result.get("success") and result.get("evidence"):
                        ev = result["evidence"]
                        evidences.append(Evidence(
                            dataset=ev.get("dataset", key), source=ev.get("source", "MySQL Database"), detail=ev.get("detail", ""),
                            timestamp=str(ev.get("timestamp", "")), unit=ev.get("unit", ""), count=ev.get("count", 0),
                        ))

                # Bước 5b: Thu thập dữ liệu Thời tiết (MySQL Ecowitt)
                if mysql_ecowitt_plan:
                    from tools.ecowitt_tool import query_ecowitt_data
                    for plan_item in mysql_ecowitt_plan:
                        key = plan_item["key"]
                        result = query_ecowitt_data(location, key)
                        tool_results[key] = result
                        
                        log_msg = f"{len(result.get('stations', []))} trạm" if result.get("success") else result.get("error", "Lỗi")
                        status = "SUCCESS" if result.get("success") else "WARNING"
                        
                        yield _yield_event("step", {"step": {"stepId": f"step_tool_{key}", "title": f"Thu thập dữ liệu: {plan_item['label']}", "detail": f"Ecowitt → {log_msg}", "status": status}})
    
                        if result.get("success") and result.get("evidence"):
                            ev = result["evidence"]
                            evidences.append(Evidence(
                                dataset=ev.get("dataset", key), source=ev.get("source", "Ecowitt Weather Station"), detail=ev.get("detail", ""),
                                timestamp=str(ev.get("timestamp", "")), unit=ev.get("unit", ""), count=ev.get("count", 0),
                            ))
    
                # Bước 6: S3 GIS
                from tools.gis_tools import query_gis_data
                for plan_item in s3_plan:
                    key = plan_item["key"]
                    result = query_gis_data(location, plan_item)
                    tool_results[key] = result
                    
                    if result.get("success"):
                        if plan_item.get("spatial_type") == "raster":
                            val = result.get("value")
                            stat_t = result.get("stat_type")
                            log_msg = f"{stat_t}: {val}"
                        else:
                            count = result.get("count")
                            log_msg = f"{count} đối tượng"
                        status = "SUCCESS"
                    else:
                        log_msg = result.get("error", "Lỗi")
                        status = "WARNING"
                    
                    yield _yield_event("step", {"step": {"stepId": f"step_s3_{key}", "title": f"Dữ liệu GIS: {plan_item['label']}", "detail": log_msg, "status": status}})
                    
                    if result.get("success") and result.get("evidence"):
                        ev = result["evidence"]
                        evidences.append(Evidence(
                            dataset=ev.get("dataset", key), source=ev.get("source", "S3 Storage"), detail=ev.get("detail", ""),
                            timestamp="", unit="", count=result.get("count", 0),
                        ))

            # Bước 7: Phân tích đánh giá (Chỉ chạy khi Required)
            reqs = intent_raw.get("analysis_requirements", {})
            evaluation = {"overall_score": "N/A", "evaluation": "Không yêu cầu đánh giá suitability cho loại truy vấn này."}
            
            if reqs.get("run_suitability"):
                from orchestrator.analysis_engine import evaluate_suitability
                activity = intent_raw.get("activity") or ""
                evaluation = evaluate_suitability(activity, tool_results)
                yield _yield_event("step", {"step": {"stepId": "step_evaluate", "title": "Đánh giá mức độ phù hợp", "detail": f"Điểm phù hợp: {evaluation.get('overall_score')}/100", "status": "SUCCESS"}})
            
            if reqs.get("run_risk"):
                from analysis_engine.risk_engine import compute_risk_score
                risk_info = compute_risk_score(evaluation)
                evaluation["risk"] = risk_info
                yield _yield_event("step", {"step": {"stepId": "step_risk", "title": "Đánh giá chuyên sâu", "detail": f"Rủi ro: {risk_info['risk_level']}", "status": "SUCCESS"}})

            # Bước 8: Sinh câu trả lời & Peer Review
            from orchestrator.response_synthesizer import synthesize_response
            from peer_review.reviewer_ai import peer_review_response
            
            yield _yield_event("step", {"step": {"stepId": "step_synthesize", "title": "Analyst AI", "detail": "Đang viết báo cáo...", "status": "PROCESSING"}})

            # Lược bỏ các dữ liệu thô quá lớn
            compact_tool_results = {}
            for key, val in tool_results.items():
                compact_tool_results[key] = val.copy()
                if "stations" in compact_tool_results[key]: del compact_tool_results[key]["stations"]
                if "features" in compact_tool_results[key]: del compact_tool_results[key]["features"]
                if "execution_log" in compact_tool_results[key]: del compact_tool_results[key]["execution_log"]

            analysis_result = {
                "intent": intent_raw,
                "location": location,
                "tool_results": compact_tool_results,
                "evaluation": evaluation,
                "evidences": [e.dict() for e in evidences]
            }

            # Bắn metadata event
            evidences_dict = [e.dict() for e in evidences]
            metadata_payload = {
                "intent": intent_info.dict(),
                "evidence": evidences_dict,
                "evaluation": evaluation,
                "sessionId": session_id
            }
            yield _yield_event("metadata", metadata_payload)

            # Vòng lặp Self-Correction (Tối đa 2 lần)
            max_retries = 2
            attempts = 0
            reviewer_feedback = None
            
            while attempts < max_retries:
                attempts += 1
                
                # Gọi Analyst AI (Non-streaming)
                lc_msgs = get_langchain_messages(session_id)
                full_response_text = synthesize_response(message, intent_raw, analysis_result, lc_msgs, reviewer_feedback)
                
                yield _yield_event("step", {"step": {"stepId": f"step_review_{attempts}", "title": f"Reviewer AI (Lần {attempts})", "detail": "Kiểm duyệt chống Hallucination...", "status": "PROCESSING"}})
                
                # Gọi Reviewer AI
                review = peer_review_response(analysis_result, full_response_text)
                
                if review.get("pass"):
                    yield _yield_event("step", {"step": {"stepId": f"step_review_{attempts}", "title": f"Reviewer AI (Lần {attempts})", "detail": "Kiểm duyệt: PASS", "status": "SUCCESS"}})
                    # Phân tách chunk để tạo hiệu ứng streaming giả cho frontend
                    for chunk in _chunk_string(full_response_text):
                        yield _yield_event("chunk", {"text": chunk})
                    break
                else:
                    yield _yield_event("step", {"step": {"stepId": f"step_review_{attempts}", "title": f"Reviewer AI (Lần {attempts})", "detail": f"Từ chối: {review.get('reason')}", "status": "WARNING"}})
                    reviewer_feedback = review.get('reason')
                    
                    if attempts < max_retries:
                        yield _yield_event("step", {"step": {"stepId": f"step_re_synthesize_{attempts}", "title": "Analyst AI", "detail": "Đang tự sửa lỗi và viết lại báo cáo...", "status": "PROCESSING"}})
                    else:
                        fail_msg = f"⚠️ **Hệ thống AI tự động đã chặn kết quả này sau {max_retries} lần thử!**\n\nLý do: {reviewer_feedback}\n\nVui lòng thử lại với câu hỏi rõ ràng hơn."
                        full_response_text = fail_msg
                        for chunk in _chunk_string(fail_msg):
                            yield _yield_event("chunk", {"text": chunk})
                    
            yield _yield_event("step", {"step": {"stepId": "step_synthesize", "title": "Hoàn tất luồng xử lý", "detail": "Done", "status": "SUCCESS"}})

        # ── Cập nhật Memory ─────────────────────────────────────────
        try:
            add_to_session(session_id, message, full_response_text)
            current_history = get_session_history(session_id)
        except Exception as e:
            logger.warning(f"Không cập nhật được memory: {e}")
            current_history = []

        yield _yield_event("step", {"step": {"stepId": "step_memory", "title": "Cập nhật ngữ cảnh", "detail": f"Session: {len(current_history)} messages", "status": "SUCCESS"}})
        
        # End event
        yield _yield_event("end", {"sessionId": session_id})

    except Exception as e:
        logger.exception(f"Lỗi process_message_stream: {e}")
        yield _yield_event("error", {"message": f"Lỗi hệ thống: {str(e)}"})
        yield _yield_event("end", {"sessionId": session_id})

def _chunk_string(text: str, chunk_size: int = 10):
    """Giả lập stream cho string tĩnh"""
    for i in range(0, len(text), chunk_size):
        yield text[i:i+chunk_size]

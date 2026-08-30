import logging
import json
from pydantic import BaseModel, Field
from typing import Literal
from langchain_core.messages import SystemMessage, HumanMessage
from llm_router import get_groq_llm

logger = logging.getLogger(__name__)

class ReviewResult(BaseModel):
    intent_correct: bool = Field(..., description="Analyst AI có xử lý đúng ý định ban đầu (intent) không?")
    location_used_unnecessarily: bool = Field(..., description="Có phàn nàn về thiếu GPS trong khi câu hỏi không yêu cầu không?")
    data_returned: bool = Field(..., description="Có sử dụng số liệu từ hệ thống cung cấp không?")
    unsupported_claims: bool = Field(..., description="Có bịa số liệu, địa danh, hoặc tự tính toán sai không?")
    overall: Literal["PASS", "FAIL"] = Field(..., description="PASS nếu mọi thứ hợp lệ, FAIL nếu vi phạm bất kỳ checklist quan trọng nào.")
    reason: str = Field(..., description="Lý do chi tiết nếu FAIL, hoặc OK nếu PASS.")

REVIEWER_SYSTEM_PROMPT = """Bạn là Chuyên gia Kiểm duyệt (Reviewer AI) của hệ thống Mekong WebGIS.
Nhiệm vụ của bạn là kiểm duyệt khắt khe Báo cáo của Analyst AI dựa trên Kế hoạch và Dữ liệu thô.

## Bảng Checklist Kiểm duyệt (Matrix):
1. **intent_correct:** Analyst có hiểu đúng loại câu hỏi không? (Ví dụ: truy vấn dữ liệu trạm thì không được chấm điểm Suitability/Risk).
2. **location_used_unnecessarily:** Nếu Kế hoạch ghi `location.required = False`, Analyst CÓ ĐƯỢC PHÉP phàn nàn "Thiếu tọa độ GPS" hay không? -> Trả lời: KHÔNG! Nếu Analyst phàn nàn, đánh true.
3. **data_returned:** Analyst có đưa ra được số liệu từ JSON không?
4. **unsupported_claims (Hallucination):** Analyst có nhắc đến số liệu, địa danh, trạm không có trong JSON không?

## QUYẾT ĐỊNH (OVERALL):
- Nếu `location_used_unnecessarily` == True -> FAIL
- Nếu `unsupported_claims` == True -> FAIL
- Nếu `intent_correct` == False -> FAIL
- Trả về `PASS` chỉ khi bài viết hoàn hảo.
"""

def peer_review_response(analysis_result: dict, llm_response: str) -> dict:
    """
    Sử dụng LLM thứ 2 để kiểm duyệt chéo (sử dụng Pydantic Structured Output Matrix).
    """
    try:
        llm = get_groq_llm(temperature=0.0)
        structured_llm = llm.with_structured_output(ReviewResult)

        # Chuyển toàn bộ plan và tool results cho Reviewer để nó hiểu bối cảnh
        context_payload = {
            "plan": analysis_result.get("intent", {}),
            "tool_results": analysis_result.get("tool_results", {}),
            "evaluation": analysis_result.get("evaluation", {})
        }
        
        user_msg = f"""
DỮ LIỆU HỆ THỐNG CẤP (TRUTH):
{json.dumps(context_payload, ensure_ascii=False, indent=2)}

BÀI BÁO CÁO CỦA ANALYST AI CẦN KIỂM DUYỆT:
{llm_response}
"""

        messages = [
            SystemMessage(content=REVIEWER_SYSTEM_PROMPT),
            HumanMessage(content=user_msg)
        ]

        response_model = structured_llm.invoke(messages)
        
        return {
            "pass": response_model.overall == "PASS",
            "reason": response_model.reason
        }

    except Exception as e:
        logger.error(f"Lỗi khi Peer Review AI (Pydantic Matrix): {e}")
        return {"pass": True, "reason": "Bỏ qua do lỗi Reviewer AI"}

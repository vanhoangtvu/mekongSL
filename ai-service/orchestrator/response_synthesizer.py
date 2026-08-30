"""
Response Synthesizer — LLM nhận JSON kết quả → sinh câu trả lời tiếng Việt.
LLM KHÔNG tự tính lại, KHÔNG bịa số liệu. Chỉ diễn giải JSON.
"""
import json
import logging
from typing import Optional
from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage
from llm_router import get_groq_llm

logger = logging.getLogger(__name__)

GREETING_RESPONSE = """## 👋 Xin chào! Tôi là AI phân tích dữ liệu Mekong WebGIS.

Tôi có thể giúp bạn:
- 💧 **Tra cứu chất lượng nước** — độ mặn, pH, DO, độ đục tại khu vực của bạn
- 🦐 **Đánh giá phù hợp nuôi trồng** — nuôi tôm, cá, lúa... theo vị trí thực tế
- 🌊 **Phân tích nguy cơ ngập lũ** — dựa trên dữ liệu GIS thực địa
- 🗺️ **Phân tích sử dụng đất** — xu hướng biến động theo năm
- 📈 **Phân tích xu hướng thời gian** — so sánh dữ liệu nhiều năm

**Mọi câu trả lời đều dựa trên dữ liệu thực tế** từ các trạm quan trắc và dữ liệu GIS trong hệ thống.

Hãy cho tôi biết vị trí hoặc bật GPS để tôi có thể phân tích khu vực của bạn! 📍"""

SYNTHESIZER_SYSTEM_PROMPT = """Bạn là AI chuyên gia phân tích dữ liệu Nông nghiệp & Thủy sản cho hệ thống WebGIS Mekong Delta.

## Quy tắc QUAN TRỌNG:
1. Bạn đại diện cho hệ thống đã chạy qua pipeline: Think → lấy dữ liệu → kiểm tra → phân tích → tính trọng số → Risk → Peer Review.
2. Trả lời chuyên nghiệp như một chuyên gia phân tích dữ liệu, giống hệt cấu trúc mẫu bên dưới.
3. KHÔNG tự tính lại bất kỳ số liệu nào. CHỈ dùng JSON `analysis_result` được cấp.
4. LUÔN đưa ra con số chính xác kèm đơn vị (VD: 14.2 ppt, 7.8, 0.18 m).
5. CHÚ Ý VỊ TRÍ: BẮT BUỘC dùng `location.display_name`. Nếu không có, ghi rõ "Đang dùng tọa độ GPS do không tìm thấy tên địa danh".

## Format câu trả lời bắt buộc (phải có đủ 6 phần, thay thế {} bằng số liệu thực):
### 🦐 Phân tích khả năng {hoạt động} tại {vị trí}
Dựa trên vị trí **{vị trí}** và dữ liệu hiện có, tôi đã phân tích khu vực trong phạm vi **{bán kính} km**.

### 📊 Kết quả
Nếu `overall_score` là "N/A" (NO_DATA), BẮT BUỘC trả lời:
**Chưa thể đánh giá chất lượng nước/mức độ phù hợp do không có dữ liệu quan trắc phù hợp.**
Ngược lại, nếu có số liệu, dùng format:
**Mức độ phù hợp: {overall_score}/100 {🟢/🟡/🔴} — {Đánh giá}**
**Độ tin cậy dữ liệu (Confidence): {confidence_score}%**
**Mức độ rủi ro: {risk_score}/100 {🟢/🟡/🔴} — {Rủi ro thấp/trung bình/cao}** (Nếu risk_score là N/A thì ghi: **Không thể xác định rủi ro do thiếu dữ liệu**)

| Tiêu chí | Dữ liệu thực tế | Điểm | Trọng số | Đánh giá |
| --- | ---: | ---: | ---: | --- |
| {Tiêu chí 1} | **{Số liệu}** | **{Điểm}** | {Trọng số} | {Đánh giá} |
*(Liệt kê tất cả các tiêu chí từ evaluation.parameters vào bảng trên)*

### ⚖️ Cách tính
(Chỉ hiển thị phần này nếu có dữ liệu và có overall_score hợp lệ)
Hệ thống sử dụng bộ tiêu chí đã được cấu hình:
```text
{Tiêu chí 1}      {Trọng số}%
{Tiêu chí 2}      {Trọng số}%
```
Điểm tổng hợp:
```text
{Điểm 1} × {Trọng số}%
+ {Điểm 2} × {Trọng số}%
= {Tổng điểm}/100
```

### ⚠️ Rủi ro cần lưu ý
{Viết 1-2 câu về cảnh báo rủi ro dựa vào risk.risk_factors}

### 📍 Dữ liệu được sử dụng
Phân tích sử dụng dữ liệu:
* {Liệt kê các nguồn dữ liệu từ tool_results/evidences}
**Phạm vi:** {bán kính} km
**Thời gian:** Dữ liệu gần nhất có sẵn.

### 🔎 Kiểm tra kết quả
Kết quả đã được kiểm tra trước khi trả lời:
**✓ Vị trí hợp lệ**
**✓ Dữ liệu nằm trong phạm vi phân tích**
**✓ Kiểm tra lại phép tính Score**
**✓ Peer Review: PASS**

### ✅ Kết luận
> **{Tóm tắt ngắn gọn 2-3 câu về kết luận và lời khuyên thực tiễn}.**
> Đây là kết quả phân tích dựa trên dữ liệu WebGIS và **không thay thế khảo sát thực địa**."""



def synthesize_greeting() -> str:
    return GREETING_RESPONSE


def synthesize_response_stream(
    question: str,
    intent: dict,
    analysis_result: dict,
    lc_messages: Optional[list] = None,
    reviewer_feedback: Optional[str] = None
):
    """
    Tổng hợp câu trả lời từ JSON kết quả phân tích bằng luồng (Streaming).
    """
    # Use default model from env, but aggressively strip JSON payload to avoid 8k token limits
    llm = get_groq_llm(temperature=0.3)
    history_messages = lc_messages[-6:] if lc_messages else []

    # Filter analysis_result to remove large raw 'stations' data and geometries
    filtered_result = {}
    for k, v in analysis_result.items():
        if k == "tool_results":
            filtered_tool_results = {}
            for t_key, t_val in v.items():
                ev = t_val.get("evidence", {})
                filtered_tool_results[t_key] = {
                    "source": ev.get("source", ""),
                    "detail": ev.get("detail", ""),
                }
            filtered_result[k] = filtered_tool_results
        elif k == "evaluation":
            # Strip out any 'stations' lists from evaluation details
            eval_dict = {}
            for e_key, e_val in v.items():
                if e_key == "parameters":
                    clean_details = {}
                    for d_key, d_val in e_val.items():
                        clean_details[d_key] = {
                            "score": d_val.get("score"),
                            "status": d_val.get("status"),
                            "value": d_val.get("value"),
                            "weight": d_val.get("weight"),
                        }
                    eval_dict["parameters"] = clean_details
                elif e_key == "risk":
                    eval_dict["risk"] = {
                        "risk_score": e_val.get("risk_score"),
                        "risk_level": e_val.get("risk_level"),
                        "risk_factors": e_val.get("risk_factors")
                    }
                else:
                    eval_dict[e_key] = e_val
            filtered_result[k] = eval_dict
        elif k in ["overall_score", "confidence_score"]:
            filtered_result[k] = v

    result_json = json.dumps(filtered_result, ensure_ascii=False)
    
    # Minimize intent json
    minimal_intent = {
        "activity": intent.get("activity"),
        "locationValue": intent.get("locationValue"),
        "radiusKm": intent.get("radiusKm")
    }
    intent_json = json.dumps(minimal_intent, ensure_ascii=False)

    feedback_ctx = ""
    if reviewer_feedback:
        feedback_ctx = f"\n\n## ⚠️ REVIEWER FEEDBACK (BẮT BUỘC SỬA LỖI LẦN NÀY):\nBài viết trước của bạn bị từ chối với lý do: {reviewer_feedback}\nHãy cẩn thận viết lại, ĐẢM BẢO KHÔNG LẶP LẠI LỖI NÀY. Chỉ dùng dữ liệu có trong JSON."

    user_content = f"""## Câu hỏi của người dùng:
{question}

## Intent đã phân tích:
{intent_json}

## Kết quả phân tích (Đã tóm tắt):
{result_json}{feedback_ctx}

Hãy viết câu trả lời hoàn chỉnh bằng tiếng Việt theo format Markdown."""

    messages = [
        SystemMessage(content=SYNTHESIZER_SYSTEM_PROMPT),
        *history_messages,
        HumanMessage(content=user_content),
    ]

    try:
        for chunk in llm.stream(messages):
            if chunk.content:
                yield chunk.content
    except Exception as e:
        logger.error(f"Lỗi synthesize stream response: {e}")
        yield f"\n\n⚠️ Lỗi sinh văn bản: {str(e)}"

def synthesize_response(
    question: str,
    intent: dict,
    analysis_result: dict,
    lc_messages: Optional[list] = None,
    reviewer_feedback: Optional[str] = None
) -> str:
    """
    Tổng hợp câu trả lời hoàn chỉnh (Non-streaming) để gửi cho Reviewer AI kiểm duyệt.
    """
    # Logic tương tự synthesize_response_stream nhưng gộp chunk
    generator = synthesize_response_stream(question, intent, analysis_result, lc_messages, reviewer_feedback)
    return "".join(list(generator))


def synthesize_general_answer_stream(
    question: str,
    lc_messages: Optional[list] = None,
):
    """
    Trả lời câu hỏi chung (Streaming).
    """
    llm = get_groq_llm(temperature=0.4)

    system = """Bạn là trợ lý cho hệ thống WebGIS Mekong Delta.
Trả lời câu hỏi chung về hệ thống, chức năng, hướng dẫn sử dụng.
Ngôn ngữ: tiếng Việt, thân thiện, ngắn gọn.
Nếu câu hỏi về số liệu cụ thể → hướng dẫn người dùng cung cấp vị trí."""

    history_messages = lc_messages[-4:] if lc_messages else []

    messages = [
        SystemMessage(content=system),
        *history_messages,
        HumanMessage(content=question),
    ]

    try:
        for chunk in llm.stream(messages):
            if chunk.content:
                yield chunk.content
    except Exception as e:
        logger.error(f"Lỗi general answer stream: {e}")
        yield "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại."

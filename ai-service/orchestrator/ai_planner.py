import logging
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from llm_router import get_groq_llm

logger = logging.getLogger(__name__)

class LocationPlan(BaseModel):
    required: bool = Field(..., description="Có bắt buộc phải có thông tin vị trí hay không? (True/False)")
    scope: Literal["ALL_STATIONS", "NEARBY", "SPECIFIC_PLACE", "UNKNOWN"] = Field(..., description="Phạm vi lấy dữ liệu")
    type: Literal["PLACE", "GPS", "UNKNOWN"] = Field(..., description="Loại vị trí được cung cấp: PLACE (địa danh), GPS (tọa độ), UNKNOWN")
    name: Optional[str] = Field(None, description="Tên địa danh nếu type là PLACE")

class AnalysisRequirements(BaseModel):
    run_suitability: bool = Field(default=False, description="Có cần đánh giá mức độ phù hợp canh tác (Suitability) không?")
    run_risk: bool = Field(default=False, description="Có cần đánh giá rủi ro (Risk) không?")

class AnalysisPlan(BaseModel):
    analysis_mode: Literal["QUERY_STATION_DATA", "SPATIAL_QUERY", "SUITABILITY", "RISK", "TREND", "COMPARISON", "GENERAL"] = Field(..., description="Chế độ phân tích chính")
    activity: Optional[str] = Field(None, description="Loại hình canh tác nếu hỏi về sự phù hợp (ví dụ: shrimp_farming, fish_farming)")
    location: LocationPlan = Field(..., description="Thông tin và yêu cầu về vị trí")
    time_range: str = Field(default="latest", description="Khoảng thời gian (latest, 7 days, 30 days, year:2023)")
    required_data: List[str] = Field(default_factory=list, description="Danh sách các bộ dữ liệu cần thiết")
    analysis_requirements: AnalysisRequirements = Field(..., description="Yêu cầu về các bước phân tích sâu")

PLANNER_SYSTEM_PROMPT = """Bạn là Kiến trúc sư Phân tích (AI Planner) của hệ thống Mekong WebGIS.
Nhiệm vụ: Lập Kế hoạch Phân tích (Analysis Plan) chính xác dựa trên ý định thực sự của người dùng.

Hệ thống có nhiều loại công cụ và dữ liệu: salinity, ph, do, temperature, flood, landuse, v.v.

## QUY TRÌNH QUYẾT ĐỊNH (RẤT QUAN TRỌNG):
1. CÂU HỎI TRUY VẤN (QUERY_STATION_DATA):
   Ví dụ: "Độ mặn hiện tại tại các trạm?" hoặc "Danh sách các trạm đo độ mặn?"
   - analysis_mode: QUERY_STATION_DATA
   - location.required: FALSE (Vì lấy tất cả các trạm)
   - location.scope: ALL_STATIONS
   - analysis_requirements: run_suitability=FALSE, run_risk=FALSE
   - time_range: "latest"

2. CÂU HỎI ĐÁNH GIÁ (SUITABILITY / RISK):
   Ví dụ: "Độ mặn ở đây có hợp nuôi tôm không?" hoặc "Đánh giá mức độ rủi ro ngập mặn?"
   - analysis_mode: SUITABILITY hoặc RISK
   - location.required: TRUE (Bắt buộc phải có vị trí để đánh giá)
   - location.scope: NEARBY hoặc SPECIFIC_PLACE
   - analysis_requirements: run_suitability=TRUE (nếu hỏi nuôi trồng), run_risk=TRUE
   - required_data: PHẢI CHỌN ĐẦY ĐỦ (salinity, ph, do, temperature, flood, v.v.)

3. CÂU HỎI XU HƯỚNG (TREND):
   Ví dụ: "Độ mặn 30 ngày qua thay đổi thế nào?"
   - analysis_mode: TREND
   - time_range: "30 days"

TUYỆT ĐỐI không bật run_suitability hoặc run_risk nếu người dùng chỉ hỏi xin số liệu/dữ liệu đơn thuần!
"""

def generate_analysis_plan(question: str, lat: float = None, lon: float = None, history: list = None) -> dict:
    """
    Sử dụng LLM để lập kế hoạch truy vấn dữ liệu và phân tích (với Pydantic schema).
    """
    try:
        llm = get_groq_llm(temperature=0.0)
        structured_llm = llm.with_structured_output(AnalysisPlan)

        location_ctx = f"Tọa độ GPS hiện tại (do hệ thống tự lấy): {lat}, {lon}" if lat and lon else "Người dùng KHÔNG gửi tọa độ GPS."
        
        history_context = ""
        if history:
            history_context = "Lịch sử chat gần đây:\n" + "\n".join([f"{msg.type}: {msg.content}" for msg in history[-4:]])
            
        user_msg = f"{history_context}\n{location_ctx}\n\nCâu hỏi: {question}"

        messages = [
            SystemMessage(content=PLANNER_SYSTEM_PROMPT),
            HumanMessage(content=user_msg)
        ]

        response_model = structured_llm.invoke(messages)
        return response_model.model_dump()

    except Exception as e:
        logger.error(f"Lỗi khi generate_analysis_plan (Pydantic): {e}")
        return {
            "analysis_mode": "GENERAL",
            "activity": None,
            "location": {"required": False, "scope": "UNKNOWN", "type": "UNKNOWN", "name": ""},
            "time_range": "latest",
            "required_data": [],
            "analysis_requirements": {"run_suitability": False, "run_risk": False}
        }

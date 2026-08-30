import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def validate_analysis_result(analysis_result: Dict[str, Any], llm_response: str) -> Dict[str, Any]:
    """
    Peer Review Validator:
    Kiểm tra xem câu trả lời của LLM (llm_response) có mâu thuẫn với 
    kết quả đánh giá kỹ thuật (analysis_result) hay không.
    """
    is_valid = True
    issues = []
    
    # 1. Kiểm tra overall_status
    evaluation = analysis_result.get("evaluation", {})
    overall_status = evaluation.get("overall_status", "UNKNOWN")
    
    llm_lower = llm_response.lower()
    
    if overall_status == "WARNING":
        if "tối ưu" in llm_lower or "rất phù hợp" in llm_lower or "tuyệt vời" in llm_lower:
            is_valid = False
            issues.append(f"LLM đánh giá sai trạng thái (Dữ liệu là WARNING nhưng LLM có từ khóa tích cực mạnh).")
            
    elif overall_status == "OPTIMAL":
        if "cảnh báo" in llm_lower or "nguy hiểm" in llm_lower or "không phù hợp" in llm_lower:
            is_valid = False
            issues.append(f"LLM đánh giá sai trạng thái (Dữ liệu là OPTIMAL nhưng LLM có từ khóa tiêu cực).")
            
    # 2. Kiểm tra việc bịa số liệu (Hallucination check cơ bản)
    # Nếu hệ thống trả về NO_DATA nhưng LLM lại đưa ra số liệu hoặc tính điểm 0/100
    if overall_status == "NO_DATA":
        if "0/100" in llm_response or "0 điểm" in llm_lower:
            issues.append("Hệ thống không có dữ liệu nhưng LLM lại kết luận 0/100. Phải báo cáo là 'N/A' hoặc 'Chưa xác định'.")
            is_valid = False
            
        import re
        # Tìm số trong response
        numbers = re.findall(r'\d+\.\d+|\d+', llm_response)
        if len(numbers) > 5: # Cho phép vài số như 1., 2., 3. trong bullet points
             issues.append("Dữ liệu là NO_DATA nhưng LLM lại đưa ra nhiều số liệu có thể là ảo giác (hallucination).")
             is_valid = False

    return {
        "is_valid": is_valid,
        "issues": issues
    }

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def compute_risk_score(evaluation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tính toán mức độ rủi ro (Risk Assessment) dựa trên evaluation của hệ thống.
    
    Quy tắc:
    - Điểm < 50 hoặc có trạng thái WARNING -> HIGH RISK
    - Điểm 50 - 80 và trạng thái ACCEPTABLE -> MEDIUM RISK
    - Điểm > 80 và trạng thái OPTIMAL -> LOW RISK
    - NO_DATA -> UNKNOWN
    """
    overall_status = evaluation.get("overall_status", "UNKNOWN")
    score = evaluation.get("overall_score", 0)
    parameters = evaluation.get("parameters", {})
    
    if overall_status == "NO_DATA" or score == "N/A":
        return {
            "risk_level": "UNKNOWN",
            "risk_score": "N/A",
            "risk_factors": [],
            "recommendation": "Không thể xác định rủi ro do thiếu dữ liệu quan trắc."
        }
        
    total_weight = 0.0
    total_risk_score = 0.0
    risk_factors = []
    
    for p_name, p_data in parameters.items():
        if "score" not in p_data: continue
        
        weight = p_data.get("weight", 1.0)
        p_score = p_data.get("score", 100.0)
        p_status = p_data.get("status", "INFO")
        
        # Risk of a parameter is inversely proportional to its score
        p_risk = 100.0 - p_score
        
        total_weight += weight
        total_risk_score += (p_risk * weight)
        
        if p_status == "WARNING" or p_risk > 50.0:
            risk_factors.append({
                "factor": p_name,
                "risk": round(p_risk, 1),
                "detail": f"{p_name} đạt {p_data.get('value')} {p_data.get('unit','')}, nằm trong vùng rủi ro."
            })
            
    final_risk_score = round(total_risk_score / total_weight, 1) if total_weight > 0 else 0.0
    
    risk_level = "LOW"
    recommendation = "Khu vực an toàn, rủi ro thấp cho hoạt động sản xuất."
    
    if final_risk_score > 60.0 or overall_status == "WARNING":
        risk_level = "HIGH"
        recommendation = "CẢNH BÁO RỦI RO CAO. Không nên triển khai hoặc cần biện pháp kỹ thuật đặc biệt."
    elif final_risk_score > 30.0 or overall_status == "ACCEPTABLE":
        risk_level = "MEDIUM"
        recommendation = "Rủi ro trung bình. Có thể triển khai nhưng cần theo dõi chặt chẽ các chỉ số cảnh báo."
        
    if risk_factors:
        factors_text = ", ".join([rf["factor"] for rf in risk_factors])
        recommendation += f" Cảnh báo từ các yếu tố: {factors_text}."
        
    return {
        "risk_level": risk_level,
        "risk_score": final_risk_score,
        "risk_factors": risk_factors,
        "recommendation": recommendation
    }

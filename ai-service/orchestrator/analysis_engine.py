"""
Analysis Engine — Tính toán mức độ phù hợp dựa trên Data Tools và Domain Profiles.

Logic:
1. Load Domain Profile tương ứng với activity (shrimp, fish, rice...)
2. Lấy weighted summary từ tool_results.
3. So sánh với optimal / acceptable bounds.
4. Chấm điểm 0-100 và phân loại trạng thái: TỐI ƯU, CHẤP NHẬN, CẢNH BÁO.
"""
import logging
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)

_PROFILES: dict = {}

def _load_profiles() -> dict:
    global _PROFILES
    if _PROFILES:
        return _PROFILES
    profile_path = Path(__file__).parent.parent / "config" / "analysis_profiles.yaml"
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            _PROFILES = yaml.safe_load(f).get("profiles", {})
    except Exception as e:
        logger.error(f"Lỗi load analysis_profiles: {e}")
    return _PROFILES

def evaluate_suitability(activity: str, tool_results: dict) -> dict:
    """
    Đánh giá độ phù hợp của dữ liệu thu thập được so với tiêu chuẩn ngành.
    """
    profiles = _load_profiles()
    
    # Xác định profile
    profile_key = activity if activity in profiles else "water_quality_general"
    profile = profiles.get(profile_key, {})
    indicators = profile.get("indicators", {})
    
    evaluation = {
        "profile_used": profile_key,
        "profile_name": profile.get("name", "Chất lượng nước chung"),
        "overall_status": "UNKNOWN", # OPTIMAL, ACCEPTABLE, WARNING, NO_DATA
        "overall_score": "N/A",      # 0 - 100 or N/A
        "confidence_score": 0,       # 0 - 100
        "parameters": {},            # Chi tiết từng thông số
        "warnings": []
    }
    
    total_weight = 0.0
    total_weighted_score = 0.0
    worst_status = "OPTIMAL" # OPTIMAL > ACCEPTABLE > WARNING
    
    status_order = {"OPTIMAL": 1, "ACCEPTABLE": 2, "WARNING": 3}
    
    # Duyệt qua các kết quả từ Data Tools
    for dataset_key, result in tool_results.items():
        if not result.get("success") or not result.get("summary"):
            continue
            
        summary = result["summary"]
        
        for param_name, param_data in summary.items():
            val = param_data.get("value")
            if val is None:
                continue
                
            # Chuẩn hóa tên parameter để match với rule
            rule_key = _map_param_to_rule_key(dataset_key, param_name)
            if not rule_key or rule_key not in indicators:
                # Thông số không có trong luật đánh giá
                evaluation["parameters"][param_name] = {
                    "value": val,
                    "unit": param_data.get("unit", ""),
                    "status": "INFO"
                }
                continue
                
            rule = indicators[rule_key]
            status, score, warning_msg = _evaluate_value(val, rule)
            
            weight = rule.get("weight", 1.0)
            
            evaluation["parameters"][param_name] = {
                "value": val,
                "unit": param_data.get("unit", ""),
                "status": status,
                "score": score,
                "weight": weight,
                "rule_applied": rule
            }
            
            if warning_msg and status == "WARNING":
                msg = rule.get("warning", warning_msg)
                evaluation["warnings"].append(f"{param_name} ({val} {param_data.get('unit','')}): {msg}")
                
            total_weight += weight
            total_weighted_score += (score * weight)
            
            if status_order.get(status, 0) > status_order.get(worst_status, 0):
                worst_status = status

    if total_weight == 0:
        evaluation["overall_status"] = "NO_DATA"
        evaluation["overall_score"] = "N/A"
        evaluation["confidence_score"] = 0
        return evaluation
        
    # Tính điểm tự tin dựa trên số lượng thông số có dữ liệu so với tổng weight lý thuyết của profile
    theoretical_total_weight = sum(ind.get("weight", 1.0) for ind in indicators.values())
    confidence = (total_weight / theoretical_total_weight) * 100.0 if theoretical_total_weight > 0 else 0
    
    evaluation["overall_score"] = round(total_weighted_score / total_weight, 1)
    evaluation["overall_status"] = worst_status
    evaluation["confidence_score"] = round(confidence, 1)
    
    return evaluation

def _map_param_to_rule_key(dataset_key: str, param_name: str) -> str:
    """Ánh xạ tên param lấy từ DB thành key trong rules."""
    p_lower = param_name.lower()
    if dataset_key in ["salinity", "ph", "do", "temperature", "landuse", "flood", "waterway"]:
        return dataset_key
    
    if "độ mặn" in p_lower or "salinity" in p_lower or "ec" in p_lower:
        return "salinity"
    if "ph" in p_lower:
        return "ph"
    if "oxy" in p_lower or "do" in p_lower:
        return "do"
    if "nhiệt" in p_lower or "temp" in p_lower:
        return "temperature"
    return ""

def _evaluate_value(val: float, rule: dict) -> tuple[str, float, str]:
    """
    So sánh giá trị với rule. Tính toán Continuous Scoring.
    Trả về (Status, Score, WarningMsg)
    Status: OPTIMAL, ACCEPTABLE, WARNING
    """
    opt = rule.get("optimal", [])
    acc = rule.get("acceptable", [])
    
    if not opt or not acc or len(opt) < 2 or len(acc) < 2:
        return "INFO", 50.0, "Luật đánh giá không hợp lệ"
        
    # Nằm trong Optimal -> 100 điểm
    if opt[0] <= val <= opt[1]:
        return "OPTIMAL", 100.0, ""
        
    # Nằm ngoài Acceptable -> rớt điểm rất mạnh về Warning
    if val < acc[0] or val > acc[1]:
        # Phạt điểm dựa trên khoảng cách. 
        # Càng xa khoảng acceptable càng gần 0 điểm.
        span = acc[1] - acc[0] if acc[1] > acc[0] else 1.0
        dist = min(abs(val - acc[0]), abs(val - acc[1]))
        penalty = (dist / span) * 100.0
        score = max(0.0, 40.0 - penalty) # Điểm cảnh báo từ 0 - 40
        return "WARNING", round(score, 1), "Vượt ngưỡng nguy hiểm."
        
    # Nằm trong khoảng Acceptable nhưng không phải Optimal (Tính điểm từ 50 -> 99)
    if val < opt[0]:
        # Vùng nửa dưới (từ acc[0] đến opt[0])
        span = opt[0] - acc[0] if opt[0] > acc[0] else 1.0
        ratio = (val - acc[0]) / span
        score = 50.0 + (ratio * 49.0)
    else:
        # Vùng nửa trên (từ opt[1] đến acc[1])
        span = acc[1] - opt[1] if acc[1] > opt[1] else 1.0
        ratio = (acc[1] - val) / span
        score = 50.0 + (ratio * 49.0)
        
    return "ACCEPTABLE", round(score, 1), ""

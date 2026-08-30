"""
Pydantic models tương thích với frontend TypeScript types (ai-types.ts).
Đảm bảo JSON response giữ nguyên cấu trúc đang dùng.
"""
from __future__ import annotations
from typing import Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ─── Request ────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


# ─── Intent ─────────────────────────────────────────────────────
class IntentInfo(BaseModel):
    type: str  # QUERY_WATER_QUALITY | SITE_SUITABILITY_ANALYSIS | ...
    activity: Optional[str] = None
    locationType: str = "UNKNOWN"
    locationValue: Optional[Any] = None
    spatialScope: Optional[str] = None
    radiusKm: Optional[float] = None
    timeRange: Optional[str] = "latest"
    requiredData: list[str] = Field(default_factory=list)
    summary: str = ""


# ─── Suitability ────────────────────────────────────────────────
class CriterionScore(BaseModel):
    criterion: str
    rawValue: float
    unit: str = ""
    score: float
    weight: float
    weightedScore: float
    classification: str
    dataSource: str = ""
    dataTimestamp: Optional[str] = None


class SuitabilityResult(BaseModel):
    activity: str
    totalScore: float
    classification: str
    hasEnoughData: bool
    totalWeightUsed: float
    criterionScores: list[CriterionScore] = Field(default_factory=list)
    missingData: list[str] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)


# ─── Risk ───────────────────────────────────────────────────────
class RiskFactor(BaseModel):
    factor: str
    factorKey: str
    rawValue: float
    riskScore: float
    weight: float
    description: str


class RiskResult(BaseModel):
    totalRiskScore: float
    riskClassification: str
    riskLevel: str  # VERY_LOW | LOW | MEDIUM | HIGH | CRITICAL
    riskFactors: list[RiskFactor] = Field(default_factory=list)
    hasData: bool = False


# ─── Evidence ───────────────────────────────────────────────────
class Evidence(BaseModel):
    dataset: str
    source: str  # "MySQL Database" | "S3 GeoTIFF" | ...
    detail: str
    timestamp: str
    unit: str = ""
    crs: Optional[str] = None
    count: int = 0


# ─── Execution Steps ────────────────────────────────────────────
class ExecutionStep(BaseModel):
    stepId: str
    title: str
    detail: str
    status: str = "SUCCESS"  # SUCCESS | WARNING | SKIPPED | ERROR


# ─── Validation ─────────────────────────────────────────────────
class ValidationResult(BaseModel):
    passed: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errorCount: int = 0
    warningCount: int = 0
    summary: str = ""


# ─── Chart ──────────────────────────────────────────────────────
class ChartDataset(BaseModel):
    label: str
    data: list[Optional[float]]
    color: Optional[str] = None


class ChartPayload(BaseModel):
    type: str = "bar"  # line | bar | radar
    title: str
    labels: list[str]
    datasets: list[ChartDataset]


# ─── Main Response ──────────────────────────────────────────────
class AIResponse(BaseModel):
    success: bool = True
    sessionId: str
    message: Optional[str] = None
    error: Optional[str] = None
    intent: Optional[IntentInfo] = None
    suitability: Optional[SuitabilityResult] = None
    risk: Optional[RiskResult] = None
    chartData: Optional[ChartPayload] = None
    evidence: list[Evidence] = Field(default_factory=list)
    validation: Optional[ValidationResult] = None
    executionSteps: list[ExecutionStep] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    metadata: dict[str, Any] = Field(default_factory=dict)

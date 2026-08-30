// TypeScript types cho AI Chat feature

export type IntentType =
  | 'QUERY_WATER_QUALITY'
  | 'QUERY_SALINITY'
  | 'QUERY_WEATHER'
  | 'QUERY_MONITORING_DATA'
  | 'SITE_SUITABILITY_ANALYSIS'
  | 'FLOOD_RISK_ANALYSIS'
  | 'LANDUSE_ANALYSIS'
  | 'TEMPORAL_ANALYSIS'
  | 'GENERAL_QUESTION';

export type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  response?: AIResponse;
}

export interface AIResponse {
  success: boolean;
  sessionId: string;
  message: string | null;
  error?: string;
  intent?: IntentInfo;
  suitability?: SuitabilityResult;
  risk?: RiskResult;
  topAreas?: AreaResult[];
  chartData?: ChartPayload;
  geoJson?: GeoJsonLayer;
  evidence?: Evidence[];
  validation?: ValidationResult;
  executionSteps?: ExecutionStep[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStep {
  stepId: string;
  title: string;
  detail: string;
  status: 'SUCCESS' | 'WARNING' | 'SKIPPED';
}

export interface IntentInfo {
  type: IntentType;
  activity: string | null;
  locationType: string;
  locationValue: string | null;
  summary: string;
}

export interface SuitabilityResult {
  activity: string;
  totalScore: number;
  classification: string;
  hasEnoughData: boolean;
  totalWeightUsed: number;
  criterionScores: CriterionScore[];
  missingData: string[];
  weights: Record<string, number>;
}

export interface CriterionScore {
  criterion: string;
  rawValue: number;
  score: number;
  weight: number;
  weightedScore: number;
  classification: string;
}

export interface RiskResult {
  totalRiskScore: number;
  riskClassification: string;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  hasData: boolean;
}

export interface RiskFactor {
  factor: string;
  factorKey: string;
  rawValue: number;
  riskScore: number;
  weight: number;
  description: string;
}

export interface AreaResult {
  areaId: string;
  areaName: string;
  suitabilityScore: number;
  suitabilityClass: string;
  riskScore: number;
  riskLevel: RiskLevel;
  lat?: number;
  lon?: number;
  reasons: string[];
  parameterSummary: Record<string, number>;
  dataTimestamp: string;
}

export interface ChartPayload {
  type: 'line' | 'bar' | 'radar';
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: (number | null)[];
  color?: string;
}

export interface GeoJsonLayer {
  type: string;
  layerName: string;
  colorBy: string;
  geojson: unknown;
}

export interface Evidence {
  dataset: string;
  source: string;
  detail: string;
  timestamp: string;
  unit: string;
  crs?: string;
  count: number;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
  summary: string;
}

export interface ChatSession {
  sessionId: string;
  messages: AIMessage[];
}

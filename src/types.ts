export type ProductType = 'L' | 'M' | 'H'; // Low (50%), Medium (30%), High (20%) quality
import type { ComponentThresholdProfile } from './config/componentThresholds';

export type FailureMode = 'TWF' | 'HDF' | 'PWF' | 'OSF' | 'RNF';

export interface TelemetryState {
  airTemp: number; // Kelvin (295 - 305 K)
  processTemp: number; // Kelvin (305 - 315 K)
  rotationalSpeed: number; // RPM (1100 - 2900 rpm)
  torque: number; // Nm (3 - 80 Nm)
  toolWear: number; // minutes (0 - 250 min)
  type: ProductType;
  productID: string;
  subsystem?: string;
  thresholds?: ComponentThresholdProfile;
}

export interface FailureProbability {
  mode: FailureMode;
  name: string;
  fullName: string;
  probability: number; // 0 to 1
  isTriggered: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  thresholdNote: string;
}

export interface ExplanationStep {
  feature: string;
  label: string;
  actualValue: string;
  referenceValue: string;
  /** Change in risk (percentage points, -100..100) caused by this step. */
  deltaPercentagePoints: number;
  /** Cumulative risk (0..1) after this step. */
  cumulativeRisk: number;
}

export interface ExplanationResult {
  method: string;
  baseRisk: number;
  actualRisk: number;
  steps: ExplanationStep[];
}

export interface PredictionResult {
  machineFailureProbability: number; // Overall risk 0 to 1
  isMachineFailure: boolean;
  predictedClass: 0 | 1;
  confidenceScore: number;
  modelUsed: 'XGBoost' | 'RandomForest' | 'EnsembleGradient';
  failures: Record<FailureMode, FailureProbability>;
  powerWatts: number;
  tempDiffKelvin: number;
  overstrainProduct: number;
  // Legacy hand-formula values, kept for compatibility. They are NOT SHAP
  // values — see computeExplanation() for the computed waterfall instead.
  shapContributions: Array<{
    feature: string;
    label: string;
    value: number; // positive = pushes to failure, negative = pulls to safe
    unit: string;
    actualValue: string | number;
  }>;
  explanation?: ExplanationResult;
  healthIndex: number; // 0 to 100
  estimatedRULHours: number; // Remaining Useful Life in operating hours
  recommendedAction: string;
}

export interface HistoricalTelemetryRecord {
  udi: number;
  productID: string;
  type: ProductType;
  airTemp: number;
  processTemp: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
  machineFailure: number;
  twf: number;
  hdf: number;
  pwf: number;
  osf: number;
  rnf: number;
  timestamp: string;
  siteLocation: string;
  subsystem: string;
  maintenanceStatus: 'Normal' | 'Warning' | 'Failure Tripped' | 'Inspected';
  thresholds?: ComponentThresholdProfile;
}

export interface ModelMetricComparison {
  modelName: string;
  accuracy: number;
  f1Score: number;
  rocAuc: number;
  precision: number;
  recall: number;
  trainingTimeMs: number;
  featureImportances: Array<{ feature: string; importance: number }>;
}

export interface MachineryComponentHotspot {
  id: string;
  name: string;
  relatedFailure: FailureMode;
  xPercent: number;
  yPercent: number;
  tempK: number;
  stressMpa: number;
  vibrationMmS: number;
  status: 'optimal' | 'warning' | 'critical';
  description: string;
}

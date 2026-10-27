import type { HistoricalTelemetryRecord } from '../types';
import { runInference } from './mlEngine';

/**
 * Drift and anomaly detection (Feature 7).
 *
 * Baseline = the 12-row mock AI4I sample shipped with the app.
 * Active = whatever dataset is currently loaded (sample or uploaded CSV).
 * Drift is a simple, labelled mean shift: (active mean − baseline mean) /
 * baseline standard deviation, flagged when |shift| > 1.0 SD. It is not a
 * statistical test, and with only 12 baseline rows it is coarse — the UI
 * says so. Anomalies are rows outside AI4I operating ranges or whose
 * rule-based risk is high while no mode is tripped (a mismatch worth
 * inspecting, not a confirmed fault).
 */

export interface DriftFeature {
  feature: string;
  baselineMean: number;
  activeMean: number;
  shiftSd: number;
  flagged: boolean;
}

export interface AnomalyRow {
  productID: string;
  udi: number;
  reasons: string[];
  riskPct: number;
}

export interface DriftReport {
  baselineCount: number;
  activeCount: number;
  features: DriftFeature[];
  anomalies: AnomalyRow[];
  baselineFailureRate: number;
  activeFailureRate: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const std = (xs: number[], m: number) => Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length));

export function buildDriftReport(
  baseline: HistoricalTelemetryRecord[],
  active: HistoricalTelemetryRecord[],
): DriftReport {
  const featureDefs: Array<{ feature: string; get: (r: HistoricalTelemetryRecord) => number }> = [
    { feature: 'Air Temp (K)', get: (r) => r.airTemp },
    { feature: 'Process Temp (K)', get: (r) => r.processTemp },
    { feature: 'Rotational Speed (RPM)', get: (r) => r.rotationalSpeed },
    { feature: 'Torque (Nm)', get: (r) => r.torque },
    { feature: 'Tool Wear (min)', get: (r) => r.toolWear },
  ];
  const features: DriftFeature[] = featureDefs.map(({ feature, get }) => {
    const base = baseline.map(get);
    const act = active.map(get);
    const baseMean = mean(base);
    const baseStd = std(base, baseMean);
    const actMean = mean(act);
    const shiftSd = baseStd > 0 ? (actMean - baseMean) / baseStd : 0;
    return { feature, baselineMean: baseMean, activeMean: actMean, shiftSd, flagged: Math.abs(shiftSd) > 1 };
  });

  const anomalies: AnomalyRow[] = [];
  for (const row of active) {
    const reasons: string[] = [];
    if (row.torque < 3.5 || row.torque > 75) reasons.push(`Torque ${row.torque} Nm outside AI4I range`);
    if (row.rotationalSpeed < 1200 || row.rotationalSpeed > 3100) reasons.push(`RPM ${row.rotationalSpeed} outside AI4I range`);
    if (row.toolWear < 0 || row.toolWear > 260) reasons.push(`Tool wear ${row.toolWear} min outside AI4I range`);
    if (row.processTemp - row.airTemp < 5) reasons.push(`ΔT ${(row.processTemp - row.airTemp).toFixed(1)} K unusually low`);
    const telemetry = {
      airTemp: row.airTemp,
      processTemp: row.processTemp,
      rotationalSpeed: row.rotationalSpeed,
      torque: row.torque,
      toolWear: row.toolWear,
      type: row.type,
      productID: row.productID,
    };
    const p = runInference(telemetry, 'XGBoost');
    const anyTripped = Object.values(p.failures).some((f) => f.isTriggered);
    if (p.machineFailureProbability >= 0.5 && !anyTripped) {
      reasons.push(`High risk ${(p.machineFailureProbability * 100).toFixed(0)}% but no mode tripped — inspect`);
    }
    if (row.machineFailure === 1 && p.machineFailureProbability < 0.2) {
      reasons.push(`Labelled failure but rule risk only ${(p.machineFailureProbability * 100).toFixed(0)}% — engine missed this row`);
    }
    if (reasons.length > 0) {
      anomalies.push({ productID: row.productID, udi: row.udi, reasons, riskPct: p.machineFailureProbability * 100 });
    }
  }

  return {
    baselineCount: baseline.length,
    activeCount: active.length,
    features,
    anomalies,
    baselineFailureRate: baseline.length > 0 ? baseline.filter((r) => r.machineFailure === 1).length / baseline.length : 0,
    activeFailureRate: active.length > 0 ? active.filter((r) => r.machineFailure === 1).length / active.length : 0,
  };
}

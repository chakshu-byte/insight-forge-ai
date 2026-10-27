import type { HistoricalTelemetryRecord } from '../types';
import { runInference } from './mlEngine';

/**
 * Model transparency / trust card (Feature 8).
 *
 * This evaluates the rule-based engine against the actual labels in the
 * currently loaded dataset — a real confusion matrix, computed here, not
 * the hardcoded MODEL_BENCHMARKS (which are vendor-style claims and are
 * still shown separately in the leaderboard tab). Because the engine is
 * rule-based and the dataset is the same one shipped with the app (or an
 * uploaded CSV evaluated in full), this is NOT a held-out test-set result
 * and must not be presented as one.
 */

export interface TrustCard {
  total: number;
  actualFailures: number;
  predictedFailures: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  perModeActual: Record<string, number>;
  perModePredictedTripped: Record<string, number>;
}

export function buildTrustCard(rows: HistoricalTelemetryRecord[]): TrustCard {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const perModeActual: Record<string, number> = { TWF: 0, HDF: 0, PWF: 0, OSF: 0, RNF: 0 };
  const perModePredictedTripped: Record<string, number> = { TWF: 0, HDF: 0, PWF: 0, OSF: 0, RNF: 0 };
  for (const row of rows) {
    // Pass the row's own subsystem/thresholds, exactly as the UI does
    // when a record is loaded. Old code omitted them, so the trust card
    // always fell back to Primary Crushing and disagreed with the UI on
    // 75/500 rows in the brutal test. With fixed AI4I failure rules the
    // decision no longer depends on subsystem, but the thresholds are
    // still passed for display consistency.
    const p = runInference(
      {
        airTemp: row.airTemp,
        processTemp: row.processTemp,
        rotationalSpeed: row.rotationalSpeed,
        torque: row.torque,
        toolWear: row.toolWear,
        type: row.type,
        productID: row.productID,
        subsystem: row.subsystem,
        thresholds: row.thresholds,
      },
      'XGBoost',
    );
    const predicted = p.isMachineFailure;
    const actual = row.machineFailure === 1;
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && !actual) tn++;
    else fn++;
    if (row.twf) perModeActual.TWF++;
    if (row.hdf) perModeActual.HDF++;
    if (row.pwf) perModeActual.PWF++;
    if (row.osf) perModeActual.OSF++;
    if (row.rnf) perModeActual.RNF++;
    for (const mode of Object.keys(perModePredictedTripped) as Array<keyof typeof perModePredictedTripped>) {
      if (p.failures[mode]?.isTriggered) perModePredictedTripped[mode]++;
    }
  }
  const total = rows.length;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    total,
    actualFailures: tp + fn,
    predictedFailures: tp + fp,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    accuracy,
    precision,
    recall,
    f1,
    perModeActual,
    perModePredictedTripped,
  };
}

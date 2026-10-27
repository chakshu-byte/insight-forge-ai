import React, { useMemo } from 'react';
import type { HistoricalTelemetryRecord } from '../types';
import { HISTORICAL_DATASET } from '../data/mockAi4iData';
import { buildDriftReport } from '../utils/driftDetection';
import { buildTrustCard } from '../utils/trustCard';

interface DriftTrustPanelProps {
  datasetRows: HistoricalTelemetryRecord[];
  activeDatasetName: string;
}

export const DriftTrustPanel: React.FC<DriftTrustPanelProps> = ({ datasetRows, activeDatasetName }) => {
  const drift = useMemo(() => buildDriftReport(HISTORICAL_DATASET, datasetRows), [datasetRows]);
  const trust = useMemo(() => buildTrustCard(datasetRows), [datasetRows]);
  const isBaseline = datasetRows === HISTORICAL_DATASET || datasetRows.length === HISTORICAL_DATASET.length;

  return (
    <div className="space-y-6">
      {/* Feature 7: Drift & anomalies */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          Drift & Anomalies — Active dataset vs 12-row baseline
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Active: {activeDatasetName} ({drift.activeCount} rows) • Baseline: 12-row mock sample •
          Failure rate: baseline {(drift.baselineFailureRate * 100).toFixed(1)}%, active {(drift.activeFailureRate * 100).toFixed(1)}%.
          Drift flag = mean shift &gt; 1.0 baseline SD. This is a coarse shift check, not a statistical test —
          the baseline has only 12 rows.
          {isBaseline && datasetRows.length === 12 && ' The active dataset is the baseline itself, so drift is 0 by construction — upload a CSV to see real drift.'}
        </p>
        <table className="w-full text-xs font-mono text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="p-2">Feature</th>
              <th className="p-2 text-right">Baseline mean</th>
              <th className="p-2 text-right">Active mean</th>
              <th className="p-2 text-right">Shift (SD)</th>
            </tr>
          </thead>
          <tbody>
            {drift.features.map((f) => (
              <tr key={f.feature} className="border-b border-slate-800/60">
                <td className="p-2 text-slate-200">{f.feature}</td>
                <td className="p-2 text-right text-slate-400">{f.baselineMean.toFixed(1)}</td>
                <td className="p-2 text-right text-slate-400">{f.activeMean.toFixed(1)}</td>
                <td className={`p-2 text-right font-bold ${f.flagged ? 'text-amber-300' : 'text-slate-400'}`}>
                  {f.shiftSd >= 0 ? '+' : ''}{f.shiftSd.toFixed(2)} {f.flagged ? '⚠ drift' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1.5">
          <div className="text-xs font-mono font-bold text-slate-300">Anomalous rows ({drift.anomalies.length})</div>
          {drift.anomalies.length === 0 && <p className="text-xs text-slate-500">No anomalous rows in the active dataset.</p>}
          {drift.anomalies.map((a) => (
            <div key={a.udi} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
              <span className="font-mono font-bold text-slate-200">{a.productID} (UDI {a.udi})</span>
              <span className="text-slate-400 font-mono"> — risk {a.riskPct.toFixed(0)}%</span>
              <div className="text-slate-400">{a.reasons.join('; ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 8: Trust card */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          Model Transparency — Computed from the active dataset
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          This card evaluates the rule-based engine against the labels in the active dataset — it is computed
          here, in full, and is <strong className="text-slate-200">not</strong> the hardcoded leaderboard benchmarks
          (XGBoost 99.1%, etc., which are claims, not computed results). It is also <strong className="text-slate-200">not</strong> a
          held-out test result: the engine is rule-based and the dataset is evaluated in full, so treat accuracy
          as a consistency check, not as trained-model performance.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          {[
            ['Accuracy', `${(trust.accuracy * 100).toFixed(1)}%`],
            ['Precision', `${(trust.precision * 100).toFixed(1)}%`],
            ['Recall', `${(trust.recall * 100).toFixed(1)}%`],
            ['F1', trust.f1.toFixed(3)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-slate-500 text-[10px] uppercase">{label}</div>
              <div className="text-slate-100 font-bold text-base">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          {[
            ['True positives', trust.truePositives],
            ['False positives', trust.falsePositives],
            ['True negatives', trust.trueNegatives],
            ['False negatives', trust.falseNegatives],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-slate-500 text-[10px] uppercase">{label}</div>
              <div className="text-slate-100 font-bold">{value}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 font-mono">
          Rows: {trust.total} • Actual failures: {trust.actualFailures} • Predicted failures: {trust.predictedFailures} •
          Per-mode actual vs tripped — TWF {trust.perModeActual.TWF}/{trust.perModePredictedTripped.TWF}, HDF {trust.perModeActual.HDF}/{trust.perModePredictedTripped.HDF}, PWF {trust.perModeActual.PWF}/{trust.perModePredictedTripped.PWF}, OSF {trust.perModeActual.OSF}/{trust.perModePredictedTripped.OSF}, RNF {trust.perModeActual.RNF}/{trust.perModePredictedTripped.RNF}
        </p>
      </div>
    </div>
  );
};

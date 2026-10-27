import React, { useMemo } from 'react';
import type { TelemetryState } from '../types';
import { computeSafeEnvelope } from '../utils/safeEnvelope';

interface SafeEnvelopePanelProps {
  telemetry: TelemetryState;
  modelUsed: 'XGBoost' | 'RandomForest' | 'EnsembleGradient';
  onApplyChange: (changes: Partial<TelemetryState>) => void;
}

export const SafeEnvelopePanel: React.FC<SafeEnvelopePanelProps> = ({
  telemetry,
  modelUsed,
  onApplyChange,
}) => {
  const envelope = useMemo(() => computeSafeEnvelope(telemetry, modelUsed), [telemetry, modelUsed]);

  return (
    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
        <span className="text-slate-300 font-semibold">Counterfactual Safe Envelope</span>
        <span className="text-[10px] text-slate-500">Safe = risk &lt; 50% and no mode tripped</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        What single change, holding everything else fixed, would bring this record into the safe
        envelope? These are what-if slider changes, not repair guarantees. Wear can only be lowered
        by tool replacement.
      </p>

      {envelope.isCurrentlySafe ? (
        <p className="text-xs text-emerald-300">
          Already safe at {(envelope.currentRisk * 100).toFixed(1)}% risk — no counterfactual change needed.
        </p>
      ) : (
        <>
          <p className="text-xs text-rose-300">
            Currently unsafe at {(envelope.currentRisk * 100).toFixed(1)}% risk.
          </p>
          {envelope.singleChanges.length === 0 && (
            <p className="text-xs text-slate-400">
              No single change in the list below reaches safety on its own — try the combined change.
            </p>
          )}
          <div className="space-y-2">
            {envelope.singleChanges.map((change) => (
              <div key={change.label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="text-xs">
                  <span className="text-slate-200 font-bold">{change.label}</span>
                  <span className="text-slate-400"> — {(change.newRisk * 100).toFixed(1)}% risk</span>
                  <div className="text-[11px] text-slate-500">{change.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyChange(change.changes)}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold"
                >
                  Apply to simulator →
                </button>
              </div>
            ))}
            {envelope.combinedChange && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2">
                <div className="text-xs">
                  <span className="text-amber-200 font-bold">{envelope.combinedChange.label}</span>
                  <span className="text-slate-400"> — {(envelope.combinedChange.newRisk * 100).toFixed(1)}% risk</span>
                  <div className="text-[11px] text-slate-500">Combined what-if, when no single change is enough.</div>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyChange(envelope.combinedChange!.changes)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold"
                >
                  Apply combined →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <div className="text-xs text-slate-300 font-semibold">Envelope boundaries (one feature at a time, others fixed)</div>
        {envelope.boundaries.map((b) => (
          <div key={b.feature} className="flex justify-between gap-2 text-[11px]">
            <span className="text-slate-400">{b.feature} — now {b.current}</span>
            <span className="text-slate-200 text-right">{b.boundary}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

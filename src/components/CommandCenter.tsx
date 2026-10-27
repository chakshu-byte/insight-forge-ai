import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetSummary } from '../utils/csvParser';
import type { PredictionResult, TelemetryState } from '../types';
import { computeRulForecast } from '../utils/mlEngine';
import { UiBadge, UiButton } from './ui';

/**
 * Command Center (Part 1 UI, step 1).
 *
 * A single overview at the top of the page: live status, RUL band, triggered
 * modes, dataset summary, and one-click navigation to every section. It
 * introduces no new data — every number comes from the live prediction,
 * the RUL forecast, or the active dataset summary already computed in App.
 */

interface CommandCenterProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
  datasetSummary: DatasetSummary;
  activeDatasetName: string;
  onNavigate: (sectionId: string) => void;
  onOpenAgentCopilot: () => void;
  onOpenCsvUpload: () => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  judgeMode: boolean;
  onToggleJudgeMode: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  telemetry,
  prediction,
  datasetSummary,
  activeDatasetName,
  onNavigate,
  onOpenAgentCopilot,
  onOpenCsvUpload,
  isStreaming,
  onToggleStreaming,
  judgeMode,
  onToggleJudgeMode,
}) => {
  // Count-up, landing style: ease-out quartic over 1.4s, like landing cu().
  // Starts at 0, not at the final value — otherwise it never animates
  // on first load (start === value, so the tick was a no-op).
  const useCountUp = (value: number, decimals = 0) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
      const start = display;
      const t0 = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const r = Math.min(1, (now - t0) / 1400);
        setDisplay(start + (value - start) * (1 - Math.pow(1 - r, 4)));
        if (r < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    return display.toFixed(decimals);
  };
  const riskDisplay = useCountUp(prediction.machineFailureProbability * 100, 1);
  const healthDisplay = useCountUp(prediction.healthIndex, 0);

  // Tilt, SUBTLE version (was wiggly / nauseating):
  // - NO idle drift at all (the sin/cos drift is removed).
  // - Only tilts while the pointer is actually over the panel.
  // - Max angles cut to ±2deg (X) / ±3deg (Y), from 4deg / 14deg before.
  // - Slower lerp (0.04, from 0.06), so it glides, not wobbles.
  // - When the pointer leaves, or after 1s idle, it eases back to flat (0, 0).
  const tiltRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let targetX = 0; let targetY = 0; let rx = 0; let ry = 0; let lastMove = 0; let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = tilt.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) { targetX = 0; targetY = 0; return; }
      lastMove = performance.now();
      const nx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
      const ny = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
      targetY = nx * 6; // ±3deg
      targetX = -ny * 4; // ±2deg
    };
    window.addEventListener('pointermove', onMove);
    const tick = () => {
      if (performance.now() - lastMove > 1000) { targetX = 0; targetY = 0; }
      rx += (targetX - rx) * 0.04;
      ry += (targetY - ry) * 0.04;
      tilt.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);

  const rul = useMemo(
    () => computeRulForecast(telemetry, prediction.machineFailureProbability, prediction.estimatedRULHours),
    [telemetry, prediction],
  );
  const triggeredModes = (['TWF', 'HDF', 'PWF', 'OSF', 'RNF'] as const).filter(
    (m) => prediction.failures[m]?.isTriggered,
  );
  const riskPct = prediction.machineFailureProbability * 100;
  const riskTone = prediction.isMachineFailure
    ? 'text-rose-300 border-rose-500/40 bg-rose-950/40'
    : riskPct >= 30
    ? 'text-amber-300 border-amber-500/40 bg-amber-950/40'
    : 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40';

  const quickActions: Array<{ label: string; section?: string; onClick?: () => void }> = [
    { label: 'CAD Twin', section: 'twin' },
    { label: 'Telemetry HUD', section: 'telemetry' },
    { label: 'What-If Simulator', section: 'simulator' },
    { label: 'Mining Analytics', section: 'analytics' },
    { label: 'Ask the Dataset', section: 'nl-query' },
    { label: 'Field Logs', section: 'logs' },
    { label: 'RCA Report', section: 'rca' },
    { label: 'Agent Copilot', onClick: onOpenAgentCopilot },
    { label: 'Upload CSV', onClick: onOpenCsvUpload },
  ];

  return (
    <section id="command-center" aria-label="Command Center overview" className="forge-tilt-wrap"><div ref={tiltRef} className="forge-tilt"><div className="forge-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <svg className="forge-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--ln)" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={prediction.isMachineFailure ? '#e11d48' : riskPct >= 30 ? '#d97706' : '#059669'} strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - Math.min(1, riskPct / 100))} />
          </svg>
          <div>
          <h2 className="forge-title" style={{ fontSize: 28 }}>Command Center</h2>
          <p className="text-xs text-slate-400">
            {telemetry.productID} • {telemetry.subsystem ?? 'Spindle unit'} • {activeDatasetName} • {datasetSummary.totalRecords} rows{' '}
            <UiBadge tone={prediction.isMachineFailure ? 'rose' : riskPct >= 30 ? 'amber' : 'emerald'}>
              {prediction.isMachineFailure ? 'FAILURE FLAGGED' : riskPct >= 30 ? 'ELEVATED RISK' : 'NOMINAL'}
            </UiBadge>
          </p>
          </div>
        </div>
        <UiButton
          variant={judgeMode ? 'outline' : 'ghost'}
          onClick={onToggleJudgeMode}
          aria-pressed={judgeMode}
        >
          {judgeMode ? 'Judge Mode ON — brief below' : 'Judge Mode — tap for judge brief'}
        </UiButton>
        <UiButton
          variant={isStreaming ? 'outline' : 'ghost'}
          onClick={onToggleStreaming}
          aria-pressed={isStreaming}
        >
          {isStreaming ? '● Live simulation running — tap to pause' : '○ Live simulation paused — tap to run'}
        </UiButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
        <div className={`rounded-xl border p-3 ${riskTone}`} role="status" aria-live="polite">
          <div className="text-[10px] uppercase opacity-80">Machine risk</div>
          <div className="text-base font-bold">{riskDisplay}%</div>
          <div>{prediction.isMachineFailure ? 'Failure flagged' : 'No failure flagged'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase text-slate-500">Health index</div>
          <div className="text-base font-bold text-slate-100">{healthDisplay}/100</div>
          <div className="text-slate-400">Model: {prediction.modelUsed}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase text-slate-500">RUL band</div>
          <div className="text-base font-bold text-amber-300">{rul.lowHours}–{rul.highHours} h</div>
          <div className="text-slate-400">Central ~{rul.centralHours} h</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase text-slate-500">Triggered modes</div>
          <div className="text-base font-bold text-slate-100">
            {triggeredModes.length > 0 ? triggeredModes.join(', ') : 'None'}
          </div>
          <div className="text-slate-400">of TWF, HDF, PWF, OSF, RNF</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase text-slate-500">Dataset failures</div>
          <div className="text-base font-bold text-slate-100">
            {datasetSummary.totalFailures} / {datasetSummary.totalRecords}
          </div>
          <div className="text-slate-400">Top: {datasetSummary.topFailureMode.mode} ({datasetSummary.topFailureMode.count})</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400">Jump to:</span>
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => (action.section ? onNavigate(action.section) : action.onClick?.())}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono"
          >
            {action.label} →
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 font-mono">
        Suggested next step:{' '}
        {prediction.isMachineFailure ? (
          <button type="button" onClick={() => onNavigate('rca')} className="text-rose-300 font-bold underline">
            Open the RCA report and work the triggered-mode SOP actions.
          </button>
        ) : riskPct >= 30 ? (
          <button type="button" onClick={() => onNavigate('simulator')} className="text-amber-300 font-bold underline">
            Open the simulator and check the safe envelope before risk rises further.
          </button>
        ) : (
          <span className="text-slate-200">Monitor — no failure is flagged, and risk is below 30%.</span>
        )}
      </p>

      {judgeMode && (
        <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-4 space-y-3">
          <div className="text-xs font-mono font-bold text-violet-300 uppercase tracking-wider">
            Judge Brief — what this is, honestly, in 60 seconds
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            INSIGHT FORGE AI is a predictive-maintenance and field-return dashboard on the UCI AI4I 2020
            problem. The prediction engine in this build is a <strong>rule-based simulation</strong>, not a trained
            XGBoost/Random Forest model — the original "SHAP" bars and 99.1% leaderboard figures were
            hardcoded claims, and this upgrade replaces them with computed waterfalls, a computed trust card,
            and explicit labels wherever a number is a heuristic, a scenario band, or an assumption.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
              <div className="font-mono font-bold text-slate-200">60-second demo — tap each step</div>
              {[
                { label: '1. Load the HDF preset in the simulator', section: 'simulator' },
                { label: '2. Read the computed waterfall (not SHAP)', section: 'simulator' },
                { label: '3. Trace HDF in the dependency graph', section: 'analytics' },
                { label: '4. Check the safe envelope and Apply one fix', section: 'simulator' },
                { label: '5. Open the multi-agent 8D RCA with row citations', section: 'rca' },
                { label: '6. Ask the dataset a question', section: 'nl-query' },
              ].map((step) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => onNavigate(step.section)}
                  className="w-full text-left rounded-lg border border-slate-800 hover:border-violet-500/50 bg-slate-950/60 px-2.5 py-1.5 text-slate-300"
                >
                  {step.label} →
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
              <div className="font-mono font-bold text-slate-200">Honesty notes for judges</div>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Model: rule-based engine, evaluated in full on the active dataset in the Trust card — not a held-out test.</li>
                <li>RUL band: heuristic, width grows with risk — not a calibrated confidence interval.</li>
                <li>Costs: downtime hours only; currency appears only after you enter your own rate.</li>
                <li>Agent: Gemini function-calling when a server-side key is set, otherwise a labelled local planner.</li>
                <li>Sample data: 12 rows shipped with the app; upload a CSV to see drift, trust, and queries on real data.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div></div></section>
  );
};

import React, { useMemo, useState } from 'react';
import type { PredictionResult, TelemetryState } from '../types';
import { computeRulForecast } from '../utils/mlEngine';

/**
 * Downtime economics (Feature 9).
 *
 * The dataset has no cost data, so this panel invents no currency figure.
 * Every rate is entered by the user, every downtime hour is either the
 * RUL band from the live prediction or an editable assumption labelled
 * as such, and if no rate is entered the panel shows the formula only.
 * Nothing here is a quote, an invoice, or a measured site cost.
 */

interface CostPanelProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
}

export const CostPanel: React.FC<CostPanelProps> = ({ telemetry, prediction }) => {
  const [costPerHour, setCostPerHour] = useState<string>('');
  const [plannedDowntimeHours, setPlannedDowntimeHours] = useState<string>('2');
  const [unplannedDowntimeHours, setUnplannedDowntimeHours] = useState<string>('8');
  const [toolCost, setToolCost] = useState<string>('');

  const rul = useMemo(
    () => computeRulForecast(telemetry, prediction.machineFailureProbability, prediction.estimatedRULHours),
    [telemetry, prediction],
  );

  const rate = Number(costPerHour);
  const plannedHours = Number(plannedDowntimeHours);
  const unplannedHours = Number(unplannedDowntimeHours);
  const tool = Number(toolCost);
  const hasRate = costPerHour.trim() !== '' && Number.isFinite(rate) && rate > 0;
  const hasValidHours = Number.isFinite(plannedHours) && plannedHours >= 0 && Number.isFinite(unplannedHours) && unplannedHours >= 0;
  const toolValid = toolCost.trim() === '' || (Number.isFinite(tool) && tool >= 0);
  const plannedCost = hasRate && hasValidHours && toolValid ? plannedHours * rate + (toolCost.trim() === '' ? 0 : tool) : null;
  const runToFailureCost = hasRate && hasValidHours && toolValid ? unplannedHours * rate + (toolCost.trim() === '' ? 0 : tool) : null;
  const saving = plannedCost !== null && runToFailureCost !== null ? runToFailureCost - plannedCost : null;

  return (
    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
      <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">
        Downtime Economics — {telemetry.productID}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        No cost data exists in the dataset, so no currency figure is claimed from it. Enter your site's
        rates below and the panel computes from them. RUL band: {rul.lowHours}–{rul.highHours} operating
        hours (central ~{rul.centralHours} h). Planned vs unplanned downtime hours are assumptions you
        can change — they are not measured values.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <label className="space-y-1 block">
          <span className="text-slate-400">Cost per operating hour</span>
          <input
            type="number"
            min="0"
            step="any"
            value={costPerHour}
            onChange={(e) => setCostPerHour(e.target.value)}
            placeholder="e.g. 500"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-slate-400">Planned downtime (h) — assumption</span>
          <input
            type="number"
            min="0"
            step="any"
            value={plannedDowntimeHours}
            onChange={(e) => setPlannedDowntimeHours(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-slate-400">Unplanned downtime (h) — assumption</span>
          <input
            type="number"
            min="0"
            step="any"
            value={unplannedDowntimeHours}
            onChange={(e) => setUnplannedDowntimeHours(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-slate-400">Tool replacement cost (optional)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={toolCost}
            onChange={(e) => setToolCost(e.target.value)}
            placeholder="leave blank if unknown"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          />
        </label>
      </div>

      {!hasRate || !hasValidHours || !toolValid ? (
        <p className="text-xs text-amber-300">
          Formula only until you enter a valid cost per hour (and valid hours): planned cost = planned hours × rate
          {toolCost.trim() !== '' ? ' + tool cost' : ''}; run-to-failure cost = unplanned hours × rate
          {toolCost.trim() !== '' ? ' + tool cost' : ''}. No currency is shown without your rate.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-slate-500 uppercase text-[10px]">Planned intervention now</div>
            <div className="text-slate-100 font-bold text-base">{plannedCost!.toFixed(2)}</div>
            <div className="text-slate-400">{plannedHours} h × {rate} + tool {toolCost.trim() === '' ? '0' : tool}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-slate-500 uppercase text-[10px]">Run to failure (unplanned)</div>
            <div className="text-slate-100 font-bold text-base">{runToFailureCost!.toFixed(2)}</div>
            <div className="text-slate-400">{unplannedHours} h × {rate} + tool {toolCost.trim() === '' ? '0' : tool}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="text-slate-500 uppercase text-[10px]">Difference (run-to-failure − planned)</div>
            <div className={`font-bold text-base ${saving! >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {saving!.toFixed(2)}
            </div>
            <div className="text-slate-400">
              {saving! >= 0 ? 'Planned intervention is cheaper under these assumptions.' : 'Planned intervention is more expensive under these assumptions — check the hours/rate.'}
            </div>
          </div>
        </div>
      )}
      <p className="text-[10px] text-slate-500">
        Currency unit is whatever unit your rate is in — the panel does not assume USD, INR, or any other currency.
      </p>
    </div>
  );
};

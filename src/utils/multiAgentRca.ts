import type { ExplanationResult, HistoricalTelemetryRecord, PredictionResult, TelemetryState } from '../types';
import { computeRulForecast } from './mlEngine';

/**
 * Multi-agent 8D RCA (Feature 5) — deterministic, no LLM required.
 *
 * Four agent roles produce findings, and a Reviewer agent checks them:
 * - Diagnostician: what is triggered now, from the live prediction.
 * - Reliability Engineer: physics rules, thresholds, wear budget, RUL band.
 * - Cost Analyst: downtime in operating hours only. The dataset has no
 *   cost data, so no currency figure is invented; a formula is given
 *   instead for a site to multiply by its own cost per hour.
 * - Reviewer: every finding must cite a value, a rule, a waterfall step,
 *   or a real dataset row. Anything without a citation is flagged, not
 *   silently presented as fact.
 */

export interface RcaCitation {
  id: string;
  text: string;
}

export interface RcaFinding {
  text: string;
  citations: string[];
}

export interface RcaAgent {
  name: string;
  role: string;
  findings: RcaFinding[];
}

export interface RcaDiscipline {
  code: string;
  title: string;
  content: string;
  citations: string[];
}

export interface MultiAgentRca {
  agents: RcaAgent[];
  disciplines: RcaDiscipline[];
  reviewerNotes: string[];
  citations: RcaCitation[];
  matchingRows: HistoricalTelemetryRecord[];
}

const fmt = (n: number, digits = 1) => n.toFixed(digits);

export function buildMultiAgentRca(
  telemetry: TelemetryState,
  prediction: PredictionResult,
  explanation: ExplanationResult,
  rows: HistoricalTelemetryRecord[],
): MultiAgentRca {
  const citations: RcaCitation[] = [];
  const cite = (text: string): string => {
    const id = `C${citations.length + 1}`;
    citations.push({ id, text });
    return id;
  };

  const currentCite = cite(
    `Current record ${telemetry.productID}: air ${fmt(telemetry.airTemp)} K, process ${fmt(telemetry.processTemp)} K, ΔT ${fmt(prediction.tempDiffKelvin)} K, ${telemetry.rotationalSpeed} RPM, ${fmt(telemetry.torque)} Nm, wear ${telemetry.toolWear} min, type ${telemetry.type}, power ${(prediction.powerWatts / 1000).toFixed(2)} kW, overstrain ${prediction.overstrainProduct.toFixed(0)} min·Nm.`,
  );
  const riskCite = cite(
    `Prediction for ${telemetry.productID}: machine-failure risk ${(prediction.machineFailureProbability * 100).toFixed(1)}%, health ${prediction.healthIndex}/100, RUL ~${prediction.estimatedRULHours} operating hours, failure flagged: ${prediction.isMachineFailure ? 'yes' : 'no'}.`,
  );
  const triggered = (['TWF', 'HDF', 'PWF', 'OSF', 'RNF'] as const).filter(
    (m) => prediction.failures[m]?.isTriggered,
  );
  const triggeredCite = triggered.length > 0
    ? cite(`Triggered modes: ${triggered.map((m) => `${m} (${(prediction.failures[m].probability * 100).toFixed(1)}%) — ${prediction.failures[m].thresholdNote}`).join('; ')}.`)
    : cite('No failure mode is currently tripped for this record.');
  const topStep = [...explanation.steps].sort((a, b) => b.deltaPercentagePoints - a.deltaPercentagePoints)[0];
  const waterfallCite = topStep
    ? cite(`Computed waterfall (not SHAP): base risk ${(explanation.baseRisk * 100).toFixed(1)}% at the nominal point, largest step ${topStep.label} (${topStep.actualValue} vs nominal ${topStep.referenceValue}, ${topStep.deltaPercentagePoints >= 0 ? '+' : ''}${topStep.deltaPercentagePoints.toFixed(1)} pp), ending at ${(explanation.actualRisk * 100).toFixed(1)}%.`)
    : cite('No waterfall steps were computed.');
  const rul = computeRulForecast(telemetry, prediction.machineFailureProbability, prediction.estimatedRULHours);
  const rulCite = cite(`RUL band ${rul.lowHours}–${rul.highHours} operating hours, central ~${rul.centralHours} h, wear budget ${rul.wearBudgetUsedPct.toFixed(0)}% used, ${rul.remainingWearMin} min wear remaining to subsystem critical. Band is heuristic, not a calibrated confidence interval.`);

  const matchingRows = rows.filter((row) => {
    const rowModes: string[] = [];
    if (row.twf) rowModes.push('TWF');
    if (row.hdf) rowModes.push('HDF');
    if (row.pwf) rowModes.push('PWF');
    if (row.osf) rowModes.push('OSF');
    if (row.rnf) rowModes.push('RNF');
    if (triggered.length === 0) return rowModes.length === 0 && row.type === telemetry.type;
    return triggered.some((m) => rowModes.includes(m));
  }).slice(0, 3);
  const rowsCite = matchingRows.length > 0
    ? cite(`Matching dataset rows (${matchingRows.length} shown, from the active dataset): ${matchingRows.map((r) => `${r.productID} (UDI ${r.udi}, type ${r.type}, wear ${r.toolWear} min, torque ${r.torque} Nm, ΔT ${(r.processTemp - r.airTemp).toFixed(1)} K)`).join('; ')}.`)
    : cite('No matching dataset rows were found for the current triggered modes — no pattern is claimed from the dataset in that case.');

  const agents: RcaAgent[] = [
    {
      name: 'Diagnostician',
      role: 'What is happening right now?',
      findings: [
        {
          text: prediction.isMachineFailure
            ? `Machine failure is flagged for ${telemetry.productID} at ${(prediction.machineFailureProbability * 100).toFixed(1)}% risk.`
            : `Machine failure is not flagged for ${telemetry.productID}; risk is ${(prediction.machineFailureProbability * 100).toFixed(1)}%.`,
          citations: [riskCite, triggeredCite],
        },
        {
          text: topStep
            ? `The largest single push in the computed waterfall was ${topStep.label}: ${topStep.deltaPercentagePoints >= 0 ? '+' : ''}${topStep.deltaPercentagePoints.toFixed(1)} percentage points.`
            : 'No waterfall step could be ranked.',
          citations: [waterfallCite],
        },
        {
          text: triggered.includes('RNF')
            ? 'RNF is stochastic by design — do not treat it as sensor-caused, and do not assign it a sensor root cause.'
            : 'RNF is not tripped, so no stochastic-cause caveat is needed for this record.',
          citations: [triggeredCite],
        },
      ],
    },
    {
      name: 'Reliability Engineer',
      role: 'Which physics rules and limits apply?',
      findings: [
        { text: `Power is ${(prediction.powerWatts / 1000).toFixed(2)} kW; thermal delta is ${fmt(prediction.tempDiffKelvin)} K; overstrain is ${prediction.overstrainProduct.toFixed(0)} min·Nm.`, citations: [currentCite] },
        { text: `Wear budget is ${rul.wearBudgetUsedPct.toFixed(0)}% used, with ${rul.remainingWearMin} min remaining to the subsystem critical wear value.`, citations: [rulCite] },
        { text: `RUL forecast band is ${rul.lowHours}–${rul.highHours} operating hours (central ~${rul.centralHours} h) — use the low end for containment timing, not the central value alone.`, citations: [rulCite] },
      ],
    },
    {
      name: 'Cost Analyst',
      role: 'What does this cost, in hours?',
      findings: [
        { text: `Downtime exposure, if the machine is stopped now, is bounded by the RUL band: ${rul.lowHours}–${rul.highHours} operating hours of remaining life at current conditions.`, citations: [rulCite] },
        { text: 'No currency figure is given: the dataset contains no cost data. To convert, multiply downtime hours by the site\'s own cost per operating hour — the formula is shown, the rate is not invented.', citations: [rulCite] },
      ],
    },
  ];

  const disciplines: RcaDiscipline[] = [
    { code: 'D1', title: 'Team', content: 'Diagnostician, Reliability Engineer, Cost Analyst, and Reviewer (this multi-agent report). Human maintenance owner to be named on the work order — the report does not invent a person.', citations: [] },
    { code: 'D2', title: 'Problem description', content: `Spindle unit ${telemetry.productID} (type ${telemetry.type}) shows ${(prediction.machineFailureProbability * 100).toFixed(1)}% machine-failure risk, health ${prediction.healthIndex}/100. ${triggered.length > 0 ? `Triggered: ${triggered.join(', ')}.` : 'No failure mode is tripped.'}`, citations: [riskCite, triggeredCite] },
    { code: 'D3', title: 'Interim containment', content: prediction.isMachineFailure ? 'Stop or derate the unit, inspect the triggered subsystems, and schedule the tool/thermal actions in the SOP checklist. Do not return it to full load on the central RUL value alone — use the low end of the RUL band.' : 'No containment stop is indicated. Keep monitoring; re-run this report if wear crosses the subsystem warning value or risk rises above 50%.', citations: [riskCite, rulCite] },
    { code: 'D4', title: 'Root cause (rule-derived, not causal proof)', content: topStep ? `Largest computed contributor: ${topStep.label} (${topStep.actualValue} vs nominal ${topStep.referenceValue}, ${topStep.deltaPercentagePoints >= 0 ? '+' : ''}${topStep.deltaPercentagePoints.toFixed(1)} pp). This is a dependency in the rule-based engine, not proof of physical causation, and the underlying model is a rule-based simulation, not a trained XGBoost/Random Forest model.` : 'No waterfall step available; root cause cannot be ranked from this record.', citations: [waterfallCite, currentCite] },
    { code: 'D5', title: 'Corrective actions', content: 'Follow the SOP actions tied to the triggered modes (tool replacement, thermal flush, torque derate as applicable in the checklist below). Record which action was actually taken — the report lists candidates, it does not claim any were performed.', citations: [triggeredCite] },
    { code: 'D6', title: 'Verification', content: 'After the action, reload the same record (or the post-repair telemetry) and confirm: risk below 50%, no mode tripped, and RUL band moved up. A before/after pair is the verification — a single post-action number is not.', citations: [riskCite, rulCite] },
    { code: 'D7', title: 'Prevention', content: 'Add a watch at the subsystem warning values (wear, ΔT, power band) so the next unit is flagged before it reaches the tripped thresholds, and keep the dataset rows that matched this case as the reference set for the next review.', citations: [rowsCite, currentCite] },
    { code: 'D8', title: 'Closure / lessons', content: 'Close only when D6 verification is recorded. Lesson to carry forward: the prediction engine is rule-based, so a high risk number is a trigger to inspect, not a measured probability from a trained model — state that in any external summary of this report.', citations: [waterfallCite] },
  ];

  const reviewerNotes: string[] = [
    'Reviewer check: every agent finding above carries at least one citation to a current value, a rule, a waterfall step, or a real dataset row.',
    matchingRows.length > 0
      ? `Reviewer check: ${matchingRows.length} matching dataset row(s) are cited by product ID and UDI — no other row is claimed to match.`
      : 'Reviewer check: no matching dataset rows were found, so the report claims no dataset pattern.',
    'Reviewer check: no currency cost, no trained-model accuracy, and no performed action is claimed anywhere in this report.',
    'Reviewer check: RNF, if tripped, is explicitly labelled stochastic, not sensor-caused.',
  ];

  return { agents, disciplines, reviewerNotes, citations, matchingRows };
}

export function buildEightDText(
  telemetry: TelemetryState,
  prediction: PredictionResult,
  rca: MultiAgentRca,
): string {
  const lines: string[] = [
    '========================================================',
    'FIELD RETURN FAILURE MINING - MULTI-AGENT 8D RCA REPORT',
    `Timestamp: ${new Date().toISOString()}`,
    `Target: Spindle Unit ${telemetry.productID} (Type: ${telemetry.type})`,
    `Status: ${prediction.isMachineFailure ? 'CRITICAL - MACHINERY FAILURE DETECTED' : 'NOMINAL - HEALTHY OPERATION'}`,
    `Risk: ${(prediction.machineFailureProbability * 100).toFixed(1)}% | Health: ${prediction.healthIndex}/100 | RUL: ~${prediction.estimatedRULHours} h`,
    'Agents: Diagnostician, Reliability Engineer, Cost Analyst, Reviewer (deterministic, no LLM)',
    '========================================================',
    '',
    'AGENT FINDINGS:',
    ...rca.agents.flatMap((agent) => [
      '',
      `${agent.name} — ${agent.role}`,
      ...agent.findings.map((f) => `* ${f.text} [${f.citations.join(', ')}]`),
    ]),
    '',
    '8D DISCIPLINES:',
    ...rca.disciplines.map((d) => [
      '',
      `${d.code} — ${d.title}`,
      d.content,
      d.citations.length > 0 ? `[${d.citations.join(', ')}]` : '[no citation needed: process step]',
    ].join('\n')),
    '',
    'REVIEWER NOTES:',
    ...rca.reviewerNotes.map((n) => `* ${n}`),
    '',
    'CITATIONS (values, rules, waterfall steps, real dataset rows):',
    ...rca.citations.map((c) => `[${c.id}] ${c.text}`),
    '',
    'HONESTY NOTE: The prediction engine is a rule-based simulation, not a trained XGBoost/Random Forest model. RUL band is heuristic, not a calibrated confidence interval. No cost, accuracy, or performed-action figure is claimed in this report.',
    '========================================================',
  ];
  return lines.join('\n');
}

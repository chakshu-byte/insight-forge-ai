import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  Flame,
  Wrench,
  Zap,
  Activity,
  Cpu,
  Printer,
  Copy,
  Check
} from 'lucide-react';
import { TelemetryState, PredictionResult, HistoricalTelemetryRecord } from '../types';
import { soundEngine } from '../utils/audio';
import { computeExplanation } from '../utils/mlEngine';
import { buildMultiAgentRca, buildEightDText } from '../utils/multiAgentRca';
import { CostPanel } from './CostPanel';

interface AiRcaDiagnosticsProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
  datasetRows?: HistoricalTelemetryRecord[];
}

export const AiRcaDiagnostics: React.FC<AiRcaDiagnosticsProps> = ({
  telemetry,
  prediction,
  datasetRows = []
}) => {
  const [copied, setCopied] = useState(false);
  const [copied8d, setCopied8d] = useState(false);

  // Feature 5: multi-agent 8D RCA, recomputed from live telemetry/prediction.
  const explanation = useMemo(
    () => computeExplanation(telemetry, prediction.modelUsed),
    [telemetry, prediction],
  );
  const multiAgentRca = useMemo(
    () => buildMultiAgentRca(telemetry, prediction, explanation, datasetRows),
    [telemetry, prediction, explanation, datasetRows],
  );
  const eightDText = useMemo(
    () => buildEightDText(telemetry, prediction, multiAgentRca),
    [telemetry, prediction, multiAgentRca],
  );

  const getActiveTriggers = () => {
    const list = [];
    if (prediction.failures.TWF.isTriggered) list.push(prediction.failures.TWF);
    if (prediction.failures.HDF.isTriggered) list.push(prediction.failures.HDF);
    if (prediction.failures.PWF.isTriggered) list.push(prediction.failures.PWF);
    if (prediction.failures.OSF.isTriggered) list.push(prediction.failures.OSF);
    if (prediction.failures.RNF.isTriggered) list.push(prediction.failures.RNF);
    return list;
  };

  const activeTriggers = getActiveTriggers();

  const buildReportText = () => `========================================================
FIELD RETURN FAILURE MINING - RCA DIAGNOSTIC REPORT
Timestamp: ${new Date().toISOString()}
Target: Spindle Unit ${telemetry.productID} (Quality Type: ${telemetry.type})
Status: ${prediction.isMachineFailure ? 'CRITICAL - MACHINERY FAILURE DETECTED' : 'NOMINAL - HEALTHY OPERATION'}
Risk Score: ${(prediction.machineFailureProbability * 100).toFixed(1)}% | Health Index: ${prediction.healthIndex}/100
Model: ${prediction.modelUsed} Classifier

OPERATIONAL METRICS:
- Air Temp: ${telemetry.airTemp.toFixed(1)} K
- Process Temp: ${telemetry.processTemp.toFixed(1)} K (ΔT: ${prediction.tempDiffKelvin.toFixed(1)} K)
- Rotational Velocity: ${telemetry.rotationalSpeed} RPM
- Mechanical Torque: ${telemetry.torque.toFixed(1)} Nm
- Tool Wear: ${telemetry.toolWear} min
- Power Draw: ${(prediction.powerWatts / 1000).toFixed(2)} kW
- Overstrain Product: ${prediction.overstrainProduct.toFixed(0)} min·Nm

ROOT CAUSE ANALYSIS:
${activeTriggers.length > 0 ? activeTriggers.map(t => `* [${t.mode}] ${t.fullName}: ${t.description} -> ${t.thresholdNote}`).join('\n') : '* No acute mechanical failure thresholds exceeded.'}

PRESCRIPTIVE ACTION:
${prediction.recommendedAction}
========================================================`;

  const handleCopyReport = () => {
    soundEngine.playClick();
    const textReport = buildReportText();

    navigator.clipboard.writeText(textReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    soundEngine.playClick();
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const lineHeight = 14;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lines = pdf.splitTextToSize(
      buildReportText(),
      pdf.internal.pageSize.getWidth() - margin * 2
    );

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);
    let y = margin;
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    });

    pdf.save(`RCA-Report-${telemetry.productID}.pdf`);
  };

  const handleDownload8dPdf = () => {
    soundEngine.playClick();
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const lineHeight = 14;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lines = pdf.splitTextToSize(
      eightDText,
      pdf.internal.pageSize.getWidth() - margin * 2
    );
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);
    let y = margin;
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    });
    pdf.save(`RCA-8D-${telemetry.productID}.pdf`);
  };

  const handleCopy8d = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(eightDText);
    setCopied8d(true);
    setTimeout(() => setCopied8d(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 md:p-7 backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-100 font-mono">
              AUTOMATED RCA & FIELD RETURN REMEDIATION
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic physics root cause analysis & prescriptive work-order generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Download RCA PDF
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied Report!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                Copy RCA Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Multi-agent 8D RCA (Feature 5) — deterministic, every finding cited */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-cyan-400 font-mono font-semibold uppercase tracking-wider">
              Multi-Agent 8D RCA — Diagnostician • Reliability Engineer • Cost Analyst • Reviewer
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Deterministic, recomputed from the live record. No LLM, no invented costs, no performed actions claimed.
              Matching rows: {multiAgentRca.matchingRows.length > 0
                ? multiAgentRca.matchingRows.map((r) => `${r.productID} (UDI ${r.udi})`).join(', ')
                : 'none found in the active dataset'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload8dPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono"
            >
              <Printer className="w-3.5 h-3.5" />
              Download 8D PDF
            </button>
            <button
              type="button"
              onClick={handleCopy8d}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono"
            >
              {copied8d ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied 8D!</> : <><Copy className="w-3.5 h-3.5 text-cyan-400" /> Copy 8D Report</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {multiAgentRca.agents.map((agent) => (
            <div key={agent.name} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
              <div className="text-xs font-mono font-bold text-slate-200">{agent.name}</div>
              <div className="text-[11px] text-slate-500">{agent.role}</div>
              {agent.findings.map((finding, idx) => (
                <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                  • {finding.text}{' '}
                  <span className="font-mono text-cyan-400">[{finding.citations.join(', ')}]</span>
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {multiAgentRca.disciplines.map((d) => (
            <div key={d.code} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs font-mono font-bold text-cyan-300">{d.code} — {d.title}</div>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">{d.content}</p>
              {d.citations.length > 0 && (
                <p className="text-[11px] font-mono text-cyan-400 mt-1">[{d.citations.join(', ')}]</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
          <div className="text-xs font-mono font-bold text-slate-200">Reviewer notes</div>
          {multiAgentRca.reviewerNotes.map((note, idx) => (
            <p key={idx} className="text-xs text-slate-400 leading-relaxed">• {note}</p>
          ))}
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer font-mono text-cyan-300">Citations — values, rules, waterfall steps, real dataset rows</summary>
          <div className="mt-2 space-y-1">
            {multiAgentRca.citations.map((c) => (
              <p key={c.id} className="text-slate-400 leading-relaxed">
                <span className="font-mono text-cyan-400">[{c.id}]</span> {c.text}
              </p>
            ))}
          </div>
        </details>
      </div>

      {/* Downtime economics (Feature 9) */}
      <CostPanel telemetry={telemetry} prediction={prediction} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Diagnostics Summary */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
            <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Failure Mode Incident Analysis</span>
              <span className="text-[10px] text-slate-500">ID: {telemetry.productID}</span>
            </div>

            {activeTriggers.length > 0 ? (
              <div className="space-y-2">
                {activeTriggers.map((t) => (
                  <div
                    key={t.mode}
                    className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        {t.fullName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/50">
                        P={(t.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans">
                      {t.description}
                    </p>
                    <div className="text-[11px] text-amber-300/90 pt-0.5">
                      Threshold Trigger: <strong>{t.thresholdNote}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-center space-y-1 font-mono">
                <div className="text-emerald-400 font-bold text-sm">
                  ✓ NO ACUTE FAILURE THRESHOLDS BREACHED
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  All 5 failure modes (TWF, HDF, PWF, OSF, RNF) are within acceptable continuous operating bounds.
                </p>
              </div>
            )}
          </div>

          {/* Physics equations explanation */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 font-mono text-xs text-slate-400">
            <div className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Governing AI4I Physics Formulations:
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px]">
              <li>
                <strong className="text-slate-300">Power [W]:</strong> Power = Torque × (RPM × 2π / 60) = {prediction.powerWatts.toFixed(0)} W (Normal: 3,500 - 9,000 W)
              </li>
              <li>
                <strong className="text-slate-300">Thermal Delta:</strong> ΔT = T_process - T_air = {prediction.tempDiffKelvin.toFixed(1)} K (Choke risk if ΔT &lt; 8.6 K and RPM &lt; 1380)
              </li>
              <li>
                <strong className="text-slate-300">Fatigue Strain:</strong> Wear × Torque = {prediction.overstrainProduct.toFixed(0)} min·Nm (Limit for Type {telemetry.type}: {telemetry.type === 'L' ? '11,000' : telemetry.type === 'M' ? '12,000' : '13,000'} min·Nm)
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Prescriptive Maintenance Action Checklist */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs text-cyan-400 font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4" />
              Standard Operating Procedure (SOP) Actions
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <input
                  type="checkbox"
                  defaultChecked={prediction.isMachineFailure}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-slate-200 font-mono">1. Automated Telemetry Alert Dispatch</div>
                  <div className="text-[11px] text-slate-400">
                    Push notification to field maintenance shift supervisor & log into CMMS.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <input
                  type="checkbox"
                  defaultChecked={prediction.failures.TWF.isTriggered || telemetry.toolWear > 180}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-slate-200 font-mono">2. Tool Insert Wear Replacement</div>
                  <div className="text-[11px] text-slate-400">
                    Stage replacement tungsten carbide cutting flutes for next scheduled drill pause.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <input
                  type="checkbox"
                  defaultChecked={prediction.failures.HDF.isTriggered}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-slate-200 font-mono">3. Thermal Exchanger Flush</div>
                  <div className="text-[11px] text-slate-400">
                    Inspect radiator flow rate and purge micro-particulate build-up in coolant sleeve.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <input
                  type="checkbox"
                  defaultChecked={prediction.failures.PWF.isTriggered || prediction.failures.OSF.isTriggered}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-slate-200 font-mono">4. Drive Inverter Torque Derate</div>
                  <div className="text-[11px] text-slate-400">
                    Throttle maximum motor torque output to 52 Nm until next overhaul inspection.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Zap, CheckCircle2, XCircle, Loader2, Wrench, ChevronRight } from 'lucide-react';
import type { DatasetSummary } from '../utils/csvParser';
import type { HistoricalTelemetryRecord, TelemetryState } from '../types';
import {
  describeToolCall,
  filterAgentRecords,
  findAgentRecord,
  isAgentLogMode,
  type AgentLogFilter,
  type AgentPlanResponse,
  type AgentSectionId,
  type AgentTraceStep,
  type AgentToolCall,
} from '../agent/agentContract';
import { soundEngine } from '../utils/audio';

export interface AgentTurn {
  id: string;
  userText: string;
  reply: string;
  model: string;
  trace: AgentTraceStep[];
  timestamp: string;
}

interface AgentCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  datasetSummary: DatasetSummary;
  activeDatasetName: string;
  datasetRecords: HistoricalTelemetryRecord[];
  telemetry: TelemetryState;
  onNavigate: (sectionId: string) => void;
  onApplyPreset: (scenario: 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf') => void;
  onUpdateTelemetry: (updates: Partial<TelemetryState>) => void;
  onLoadRecord: (record: HistoricalTelemetryRecord) => void;
  onAgentFilter: (filter: AgentLogFilter) => void;
}

const QUICK_ACTIONS = [
  'Show HDF failures',
  'Simulate HDF failure',
  'Load first failure',
  'Open RCA report',
  'Summarize this dataset',
];

const SECTION_LABELS: Record<AgentSectionId, string> = {
  twin: 'CAD Twin',
  telemetry: 'Telemetry HUD',
  simulator: 'What-If ML',
  analytics: 'Mining Analytics',
  logs: 'Field Logs',
  rca: 'RCA Report',
};

export const AgentCopilot: React.FC<AgentCopilotProps> = ({
  isOpen,
  onClose,
  datasetSummary,
  activeDatasetName,
  datasetRecords,
  telemetry,
  onNavigate,
  onApplyPreset,
  onUpdateTelemetry,
  onLoadRecord,
  onAgentFilter,
}) => {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, turns, isLoading]);

  const executeTool = (call: AgentToolCall): AgentTraceStep => {
    try {
      if (call.name === 'filter_logs') {
        const mode = isAgentLogMode(call.args.mode) ? call.args.mode : 'failures';
        const search = typeof call.args.search === 'string' ? call.args.search : '';
        const matches = filterAgentRecords(datasetRecords, mode, search);
        onAgentFilter({ mode, search, nonce: Date.now() });
        onNavigate('logs');
        return {
          name: call.name,
          args: call.args,
          status: 'done',
          result: `Filtered Field Logs to ${mode}${search ? ` matching "${search}"` : ''}: ${matches.length} of ${datasetRecords.length} records.`,
        };
      }
      if (call.name === 'load_first_matching_record') {
        const record = findAgentRecord(datasetRecords, call.args);
        if (!record) {
          return { name: call.name, args: call.args, status: 'failed', result: 'No matching record found in the active dataset, so nothing was loaded.' };
        }
        onLoadRecord(record);
        return {
          name: call.name,
          args: call.args,
          status: 'done',
          result: `Loaded ${record.productID} (UDI ${record.udi}, Type ${record.type}) into the twin and HUD.`,
        };
      }
      if (call.name === 'run_what_if') {
        if (typeof call.args.preset === 'string') {
          const preset = call.args.preset as 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf';
          onApplyPreset(preset);
          onNavigate('simulator');
          return { name: call.name, args: call.args, status: 'done', result: `Applied the ${preset.toUpperCase()} what-if preset and opened What-If ML. The prediction below the simulator is computed from those values.` };
        }
        const updates: Partial<TelemetryState> = {};
        if (typeof call.args.airTemp === 'number') updates.airTemp = call.args.airTemp;
        if (typeof call.args.processTemp === 'number') updates.processTemp = call.args.processTemp;
        if (typeof call.args.rotationalSpeed === 'number') updates.rotationalSpeed = call.args.rotationalSpeed;
        if (typeof call.args.torque === 'number') updates.torque = call.args.torque;
        if (typeof call.args.toolWear === 'number') updates.toolWear = call.args.toolWear;
        if (call.args.type === 'L' || call.args.type === 'M' || call.args.type === 'H') updates.type = call.args.type;
        if (Object.keys(updates).length === 0) {
          return { name: call.name, args: call.args, status: 'failed', result: 'No valid telemetry values were supplied, so nothing was changed.' };
        }
        onUpdateTelemetry(updates);
        onNavigate('simulator');
        return { name: call.name, args: call.args, status: 'done', result: `Applied what-if values ${JSON.stringify(updates)} and opened What-If ML.` };
      }
      if (call.name === 'open_section') {
        const section = call.args.section as AgentSectionId;
        onNavigate(section);
        return { name: call.name, args: call.args, status: 'done', result: `Opened ${SECTION_LABELS[section] ?? section}.` };
      }
      if (call.name === 'summarize_dataset') {
        return {
          name: call.name,
          args: call.args,
          status: 'done',
          result: `${datasetSummary.totalRecords} records, ${datasetSummary.totalFailures} failures (${datasetSummary.failureRate}), top mode ${datasetSummary.topFailureMode.mode} (${datasetSummary.topFailureMode.count} units, ${datasetSummary.topFailureMode.percentage}). Computed from the active dataset summary.`,
        };
      }
      return { name: call.name, args: call.args, status: 'failed', result: 'Unknown tool — not executed.' };
    } catch (err) {
      return { name: call.name, args: call.args, status: 'failed', result: `Execution failed: ${err instanceof Error ? err.message : 'unknown error'}` };
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;
    soundEngine.playClick();
    setInput('');
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          datasetContext: {
            activeDatasetName,
            summary: datasetSummary,
            topFailureMode: datasetSummary.topFailureMode,
            paretoBreakdown: datasetSummary.paretoBreakdown,
            averages: datasetSummary.averages,
            ranges: datasetSummary.ranges,
          },
          telemetry: {
            airTemp: telemetry.airTemp,
            processTemp: telemetry.processTemp,
            rotationalSpeed: telemetry.rotationalSpeed,
            torque: telemetry.torque,
            toolWear: telemetry.toolWear,
            type: telemetry.type,
            productID: telemetry.productID,
          },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      const plan = (await response.json()) as AgentPlanResponse;
      const trace = (plan.toolCalls ?? []).map((call) => executeTool(call));
      const failed = trace.filter((t) => t.status === 'failed');
      const reply =
        failed.length > 0
          ? `${plan.reply}\n\nNote: ${failed.length} tool call(s) failed — see the trace below. No failed action was silently reported as done.`
          : plan.reply;
      setTurns((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          userText: text,
          reply,
          model: plan.model,
          trace,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      soundEngine.playAlert('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent request failed.');
      soundEngine.playAlert('critical');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 h-full w-full sm:w-[480px] md:w-[540px] bg-[#090d16]/95 border-l border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-mono text-slate-100">AGENT COPILOT</h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Tool calls execute in the app — trace below is the proof
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                title="Close Agent Copilot"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800/80 space-y-2">
              <p className="text-[11px] font-mono text-slate-400">
                Try one tap — each one really changes the page:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSend(action)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono disabled:opacity-40"
                  >
                    {action}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                Active dataset: {activeDatasetName} • {datasetSummary.totalRecords} records • Current: {telemetry.productID}
              </p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
              {turns.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2 text-slate-300">
                  <p className="font-mono font-bold text-slate-100">How this differs from the chat bubble</p>
                  <p>
                    The old Ask AI only writes an answer. This copilot plans tool calls, the server validates
                    them, and this panel executes them in order — filtering logs, loading a record, running a
                    what-if, or opening a section — then shows whether each call actually succeeded.
                  </p>
                  <p className="text-slate-400">
                    Without a Gemini key, the server uses a labelled local planner, so the tools still work
                    in a demo. With a key, Gemini function-calling proposes the same tools.
                  </p>
                </div>
              )}

              {turns.map((turn) => (
                <div key={turn.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-emerald-600 text-white p-3 font-medium whitespace-pre-wrap">
                      {turn.userText}
                    </div>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-800 p-4 space-y-3 text-slate-200">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                      <Bot className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Agent</span>
                      <span>({turn.model})</span>
                      <span>{turn.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{turn.reply}</p>
                    {turn.trace.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-800 pt-3">
                        <p className="text-[10px] font-mono font-bold text-slate-400">TOOL TRACE — EXECUTED IN ORDER</p>
                        {turn.trace.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
                            {step.status === 'done' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-slate-200">
                                {idx + 1}. {step.name}
                              </p>
                              <p className="text-slate-400">{describeToolCall({ name: step.name, args: step.args })}</p>
                              <p className="text-slate-300">{step.result}</p>
                              <p className="text-[10px] font-mono text-slate-500 break-all">
                                args: {JSON.stringify(step.args)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {turn.trace.length === 0 && (
                      <p className="text-slate-400 border-t border-slate-800 pt-3">
                        No tool call was made for this request — the agent answered in text only.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-[260px]">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-xs font-mono text-emerald-300 animate-pulse">Planning tool calls…</span>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300">
                  Agent request failed: {error}. No tool was executed for that request.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              className="p-3 border-t border-slate-800 bg-slate-950/80 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Try: Show HDF failures, or Simulate HDF failure…"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                aria-label="Agent copilot request"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-mono font-bold disabled:opacity-40 flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" /> Run <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

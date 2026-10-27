import type { HistoricalTelemetryRecord } from '../types';

/**
 * Agent tool contract — shared by the server planner and the client executor.
 *
 * The server only *plans* tool calls (Gemini function-calling, or the local
 * planner when no Gemini key is configured). The client *executes* them, so
 * the trace shown in the UI reflects what actually happened in the app, not
 * what the model claimed would happen. Nothing in this contract ever calls
 * a model itself, and no tool call is executed on the server.
 */

export type AgentSectionId = 'twin' | 'telemetry' | 'simulator' | 'analytics' | 'logs' | 'rca';

export type AgentLogMode =
  | 'all'
  | 'failures'
  | 'normal'
  | 'twf'
  | 'hdf'
  | 'pwf'
  | 'osf'
  | 'rnf';

export type AgentPreset = 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf';

export type AgentToolName =
  | 'filter_logs'
  | 'load_first_matching_record'
  | 'run_what_if'
  | 'open_section'
  | 'summarize_dataset';

export interface AgentToolCall {
  name: AgentToolName;
  args: Record<string, unknown>;
}

export type AgentTraceStatus = 'pending' | 'done' | 'failed';

export interface AgentTraceStep {
  name: AgentToolName;
  args: Record<string, unknown>;
  status: AgentTraceStatus;
  result: string;
}

export interface AgentPlanResponse {
  reply: string;
  model: string;
  toolCalls: AgentToolCall[];
  reasoningSteps: string[];
}

export interface AgentLogFilter {
  mode: AgentLogMode;
  search: string;
  nonce: number;
}

export const AGENT_TOOL_NAMES: AgentToolName[] = [
  'filter_logs',
  'load_first_matching_record',
  'run_what_if',
  'open_section',
  'summarize_dataset',
];

export const AGENT_SECTIONS: AgentSectionId[] = [
  'twin',
  'telemetry',
  'simulator',
  'analytics',
  'logs',
  'rca',
];

export const AGENT_LOG_MODES: AgentLogMode[] = [
  'all',
  'failures',
  'normal',
  'twf',
  'hdf',
  'pwf',
  'osf',
  'rnf',
];

export const AGENT_PRESETS: AgentPreset[] = ['normal', 'twf', 'hdf', 'pwf', 'osf'];

export function isAgentSection(value: unknown): value is AgentSectionId {
  return typeof value === 'string' && (AGENT_SECTIONS as string[]).includes(value);
}

export function isAgentLogMode(value: unknown): value is AgentLogMode {
  return typeof value === 'string' && (AGENT_LOG_MODES as string[]).includes(value);
}

export function isAgentPreset(value: unknown): value is AgentPreset {
  return typeof value === 'string' && (AGENT_PRESETS as string[]).includes(value);
}

export function isAgentToolName(value: unknown): value is AgentToolName {
  return typeof value === 'string' && (AGENT_TOOL_NAMES as string[]).includes(value);
}

/** Clamp a telemetry override to the ranges the existing UI sliders use. */
export function clampTelemetryOverride(
  args: Record<string, unknown>,
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  const num = (key: string, min: number, max: number) => {
    const v = args[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = Math.min(max, Math.max(min, v));
    }
  };
  num('airTemp', 295, 305);
  num('processTemp', 305, 315);
  num('rotationalSpeed', 1100, 2900);
  num('torque', 3, 80);
  num('toolWear', 0, 250);
  if (args.type === 'L' || args.type === 'M' || args.type === 'H') {
    out.type = args.type;
  }
  return out;
}

/** The exact filter logic the Field Logs table applies, reused for counts. */
export function filterAgentRecords(
  records: HistoricalTelemetryRecord[],
  mode: AgentLogMode,
  search: string,
): HistoricalTelemetryRecord[] {
  const q = search.trim().toLowerCase();
  return records.filter((row) => {
    const matchesSearch =
      q.length === 0 ||
      row.productID.toLowerCase().includes(q) ||
      row.siteLocation.toLowerCase().includes(q) ||
      row.subsystem.toLowerCase().includes(q) ||
      String(row.udi).includes(q);
    if (!matchesSearch) return false;
    if (mode === 'failures') return row.machineFailure === 1;
    if (mode === 'normal') return row.machineFailure === 0;
    if (mode === 'twf') return row.twf === 1;
    if (mode === 'hdf') return row.hdf === 1;
    if (mode === 'pwf') return row.pwf === 1;
    if (mode === 'osf') return row.osf === 1;
    if (mode === 'rnf') return row.rnf === 1;
    return true;
  });
}

export function findAgentRecord(
  records: HistoricalTelemetryRecord[],
  args: Record<string, unknown>,
): HistoricalTelemetryRecord | null {
  if (typeof args.productID === 'string' && args.productID.trim().length > 0) {
    const wanted = args.productID.trim().toLowerCase();
    const found = records.find(
      (r) => r.productID.toLowerCase() === wanted,
    );
    if (found) return found;
  }
  const mode = isAgentLogMode(args.mode) ? args.mode : 'failures';
  const matches = filterAgentRecords(records, mode, '');
  return matches[0] ?? records[0] ?? null;
}

export function describeToolCall(call: AgentToolCall): string {
  switch (call.name) {
    case 'filter_logs':
      return `Filter field logs to ${String(call.args.mode ?? 'all')}${call.args.search ? ` matching "${String(call.args.search)}"` : ''}`;
    case 'load_first_matching_record':
      return call.args.productID
        ? `Load record ${String(call.args.productID)} into the twin`
        : `Load first ${String(call.args.mode ?? 'failures')} record into the twin`;
    case 'run_what_if':
      return call.args.preset
        ? `Run what-if preset ${String(call.args.preset).toUpperCase()}`
        : 'Run what-if with the given telemetry values';
    case 'open_section':
      return `Open ${String(call.args.section)} section`;
    case 'summarize_dataset':
      return 'Summarize the active dataset';
    default:
      return 'Unknown tool';
  }
}

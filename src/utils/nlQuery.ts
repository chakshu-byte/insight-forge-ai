import type { HistoricalTelemetryRecord } from '../types';

/**
 * Natural-language dataset query (Feature 10) — deterministic local parser.
 *
 * No LLM is involved, so the parser only understands the patterns it
 * actually implements, and says so when a query does not match. It never
 * invents a count: every number comes from filtering the active dataset
 * rows supplied by the caller.
 *
 * Supported patterns (case-insensitive):
 * - "how many <mode> failures" / "count failures" / "how many failures"
 * - "failures for type L/M/H" / "type L failures"
 * - "average torque / wear / rpm / temperature for <mode> failures"
 * - "highest / lowest tool wear / torque among failures"
 * - "list records with wear > N / torque > N / rpm < N"
 * - "show <mode> failures" (lists up to 20 matching rows)
 */

export interface NlQueryResult {
  answer: string;
  rows: HistoricalTelemetryRecord[];
  matched: boolean;
}

const MODES: Array<{ key: string; flag: (r: HistoricalTelemetryRecord) => boolean; label: string }> = [
  { key: 'twf', flag: (r) => r.twf === 1, label: 'TWF' },
  { key: 'hdf', flag: (r) => r.hdf === 1, label: 'HDF' },
  { key: 'pwf', flag: (r) => r.pwf === 1, label: 'PWF' },
  { key: 'osf', flag: (r) => r.osf === 1, label: 'OSF' },
  { key: 'rnf', flag: (r) => r.rnf === 1, label: 'RNF' },
];

const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function runNlQuery(query: string, rows: HistoricalTelemetryRecord[]): NlQueryResult {
  const q = query.toLowerCase().trim();
  if (!q) {
    return { answer: 'Enter a question, for example "how many HDF failures?"', rows: [], matched: false };
  }
  const mode = MODES.find((m) => q.includes(m.key));
  const typeMatch = q.match(/type\s+([lmh])\b/);
  const type = typeMatch ? typeMatch[1].toUpperCase() : null;

  let filtered = rows;
  if (mode) filtered = filtered.filter(mode.flag);
  else if (q.includes('failure') || q.includes('failures')) filtered = filtered.filter((r) => r.machineFailure === 1);
  if (type) filtered = filtered.filter((r) => r.type === type);

  const thresholdMatch = q.match(/(wear|torque|rpm|rotational speed)\s*(>|<|>=|<=|above|below)\s*(\d+(?:\.\d+)?)/);
  if (thresholdMatch) {
    const [, field, op, raw] = thresholdMatch;
    const value = Number(raw);
    const get = (r: HistoricalTelemetryRecord) =>
      field === 'wear' ? r.toolWear : field === 'torque' ? r.torque : r.rotationalSpeed;
    const isAbove = op === '>' || op === '>=' || op === 'above';
    filtered = filtered.filter((r) => (isAbove ? get(r) >= value : get(r) <= value));
  }

  const scope = [
    mode ? `${mode.label} failures` : q.includes('failure') ? 'failures' : 'records',
    type ? `type ${type}` : null,
    thresholdMatch ? `${thresholdMatch[1]} ${thresholdMatch[2]} ${thresholdMatch[3]}` : null,
  ].filter(Boolean).join(', ');

  if (/\b(average|mean)\b/.test(q)) {
    const field = q.includes('torque') ? 'torque' : q.includes('wear') ? 'toolWear' : q.includes('rpm') || q.includes('rotational') ? 'rotationalSpeed' : q.includes('process') ? 'processTemp' : q.includes('air') ? 'airTemp' : null;
    if (!field) {
      return { answer: 'I can average torque, wear, RPM, air temperature, or process temperature. Try "average torque for HDF failures".', rows: [], matched: false };
    }
    const values = filtered.map((r) => r[field]);
    const label = field === 'toolWear' ? 'tool wear' : field === 'rotationalSpeed' ? 'RPM' : field === 'processTemp' ? 'process temperature' : field === 'airTemp' ? 'air temperature' : 'torque';
    return { answer: `Average ${label} for ${scope}: ${avg(values).toFixed(1)} across ${filtered.length} row(s).`, rows: [], matched: true };
  }

  if (q.includes('highest') || q.includes('maximum') || q.includes('max')) {
    const field = q.includes('wear') ? 'toolWear' : q.includes('torque') ? 'torque' : 'rotationalSpeed';
    const sorted = [...filtered].sort((a, b) => b[field] - a[field]);
    const top = sorted[0];
    if (!top) return { answer: `No rows match (${scope}).`, rows: [], matched: true };
    const label = field === 'toolWear' ? 'tool wear' : field === 'torque' ? 'torque' : 'RPM';
    return { answer: `Highest ${label} for ${scope}: ${top.productID} (UDI ${top.udi}) at ${top[field]}.`, rows: sorted.slice(0, 5), matched: true };
  }

  if (q.includes('lowest') || q.includes('minimum') || q.includes('min')) {
    const field = q.includes('wear') ? 'toolWear' : q.includes('torque') ? 'torque' : 'rotationalSpeed';
    const sorted = [...filtered].sort((a, b) => a[field] - b[field]);
    const top = sorted[0];
    if (!top) return { answer: `No rows match (${scope}).`, rows: [], matched: true };
    const label = field === 'toolWear' ? 'tool wear' : field === 'torque' ? 'torque' : 'RPM';
    return { answer: `Lowest ${label} for ${scope}: ${top.productID} (UDI ${top.udi}) at ${top[field]}.`, rows: sorted.slice(0, 5), matched: true };
  }

  if (q.includes('how many') || q.includes('count') || q.includes('number of')) {
    return { answer: `${filtered.length} row(s) match (${scope}) out of ${rows.length} total rows in the active dataset.`, rows: filtered.slice(0, 20), matched: true };
  }

  if (q.includes('list') || q.includes('show')) {
    return { answer: `${filtered.length} row(s) match (${scope}) — showing up to 20 below.`, rows: filtered.slice(0, 20), matched: true };
  }

  return {
    answer: 'I did not understand that pattern. Try: "how many HDF failures?", "average torque for HDF failures", "list records with wear > 200", or "highest tool wear among failures".',
    rows: [],
    matched: false,
  };
}

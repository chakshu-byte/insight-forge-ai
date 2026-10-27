import React, { useMemo, useState } from 'react';
import type { PredictionResult, TelemetryState } from '../types';
import { buildDependencyGraph, traceGraph, type GraphNode } from '../utils/dependencyGraph';

interface FailureDependencyGraphProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
  onNavigate?: (sectionId: string) => void;
}

const STATUS_STYLES: Record<GraphNode['status'], string> = {
  critical: 'fill-rose-950 stroke-rose-500 text-rose-300',
  warning: 'fill-amber-950 stroke-amber-500 text-amber-300',
  safe: 'fill-slate-900 stroke-slate-700 text-slate-200',
  info: 'fill-slate-900 stroke-cyan-500/50 text-slate-200',
};

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  feature: 'Sensor / input',
  physics: 'Physics quantity',
  failure: 'Failure mode',
  outcome: 'Outcome',
};

export const FailureDependencyGraph: React.FC<FailureDependencyGraphProps> = ({
  telemetry,
  prediction,
  onNavigate,
}) => {
  const graph = useMemo(() => buildDependencyGraph(telemetry, prediction), [telemetry, prediction]);
  const [selectedId, setSelectedId] = useState<string>('mode-HDF');
  const trace = useMemo(() => traceGraph(graph, selectedId), [graph, selectedId]);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? graph.nodes[0];
  const upstreamNodes = graph.nodes.filter((n) => trace.upstream.includes(n.id) && n.id !== selectedId);
  const downstreamNodes = graph.nodes.filter((n) => trace.downstream.includes(n.id) && n.id !== selectedId);

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgePath = (from: GraphNode, to: GraphNode) => {
    const x1 = from.x + 85;
    const y1 = from.y + 22;
    const x2 = to.x - 10;
    const y2 = to.y + 22;
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Dependency graph, <strong className="text-slate-200">not causal inference</strong>: AI4I failure modes are
            rule-derived, so edges show which inputs the rules depend on — not proof that one thing caused
            another. Click any node (or pick from the dropdown) to trace its upstream inputs and downstream
            effects. Values and statuses are computed from the currently loaded telemetry.
          </p>
        </div>
        <label className="text-xs font-mono text-slate-400 flex items-center gap-2">
          Select node:
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 text-xs font-mono"
            aria-label="Select a graph node to trace"
          >
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} — {n.value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
        <svg
          viewBox="0 0 920 580"
          className="min-w-[720px] w-full"
          role="img"
          aria-label="Failure-mode dependency graph: sensor features on the left, physics quantities in the middle, failure modes on the right, machine failure at the far right"
        >
          {graph.edges.map((edge) => {
            const from = nodeById.get(edge.from)!;
            const to = nodeById.get(edge.to)!;
            const highlighted = trace.edges.includes(edge);
            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={edgePath(from, to)}
                fill="none"
                stroke={highlighted ? '#06b6d4' : '#334155'}
                strokeWidth={highlighted ? 2.5 : 1.5}
                opacity={highlighted ? 1 : 0.55}
              >
                <title>{edge.rule}</title>
              </path>
            );
          })}
          {graph.nodes.map((node) => {
            const highlighted = trace.connected.has(node.id);
            const isSelected = node.id === selectedId;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(node.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${node.label}: ${node.value}. ${node.detail}`}
                opacity={highlighted ? 1 : 0.35}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width="170"
                  height="44"
                  rx="10"
                  className={STATUS_STYLES[node.status]}
                  strokeWidth={isSelected ? 3 : 1.5}
                  stroke={isSelected ? '#06b6d4' : undefined}
                />
                <text x="10" y="17" className="fill-slate-100" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  {node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label}
                </text>
                <text x="10" y="34" className="fill-slate-400" fontSize="11" fontFamily="monospace">
                  {node.value}
                </text>
                <title>{`${node.label}: ${node.value}. ${node.detail}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-cyan-500/40 bg-slate-950/70 p-4 space-y-2">
          <p className="font-mono font-bold text-cyan-300">
            Selected: {selected.label} ({KIND_LABEL[selected.kind]})
          </p>
          <p className="text-slate-200 font-mono font-bold">{selected.value}</p>
          <p className="text-slate-400 leading-relaxed">{selected.detail}</p>
          <p className="font-mono text-slate-500">
            Status: {selected.status} • {prediction.isMachineFailure ? 'Machine failure is currently flagged' : 'Machine failure is not currently flagged'}
          </p>
          {onNavigate && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('simulator')}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px]"
              >
                Open What-If simulator →
              </button>
              <button
                type="button"
                onClick={() => onNavigate('twin')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[11px]"
              >
                Open CAD Twin →
              </button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5">
          <p className="font-mono font-bold text-slate-300">Upstream — what feeds it</p>
          {upstreamNodes.length === 0 && <p className="text-slate-500">Nothing upstream in this graph.</p>}
          {upstreamNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              className="w-full text-left rounded-lg border border-slate-800 hover:border-cyan-500/50 bg-slate-900/60 px-2.5 py-1.5"
            >
              <span className="text-slate-200 font-mono">{n.label}</span>
              <span className="text-slate-400 font-mono"> — {n.value}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5">
          <p className="font-mono font-bold text-slate-300">Downstream — what it affects</p>
          {downstreamNodes.length === 0 && <p className="text-slate-500">Nothing downstream in this graph.</p>}
          {downstreamNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              className="w-full text-left rounded-lg border border-slate-800 hover:border-cyan-500/50 bg-slate-900/60 px-2.5 py-1.5"
            >
              <span className="text-slate-200 font-mono">{n.label}</span>
              <span className="text-slate-400 font-mono"> — {n.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import type { FailureMode, PredictionResult, TelemetryState } from '../types';

/**
 * Failure-mode dependency graph (Feature 6) — explicitly NOT causal inference.
 *
 * AI4I failure modes are rule-derived, so this graph shows dependency:
 * which sensor values feed which physics quantities, and which physics
 * quantities feed which failure-mode rules. Every node value and status is
 * computed from the current telemetry and prediction — nothing here is a
 * hardcoded claim about a specific machine.
 */

export type GraphNodeKind = 'feature' | 'physics' | 'failure' | 'outcome';

export type GraphNodeStatus = 'critical' | 'warning' | 'safe' | 'info';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  value: string;
  detail: string;
  status: GraphNodeStatus;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  rule: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const statusFor = (triggered: boolean, warning: boolean): GraphNodeStatus =>
  triggered ? 'critical' : warning ? 'warning' : 'safe';

export function buildDependencyGraph(
  telemetry: TelemetryState,
  prediction: PredictionResult,
): DependencyGraph {
  const thresholds = telemetry.thresholds;
  const powerMinKw = thresholds?.power?.min ?? 3.5;
  const powerMaxKw = thresholds?.power?.max ?? 9.0;
  const powerKw = prediction.powerWatts / 1000;
  const tempDiff = prediction.tempDiffKelvin;
  const overstrain = prediction.overstrainProduct;
  const osfLimit =
    (thresholds?.torque?.critical ?? 70) * (thresholds?.toolWear?.critical ?? 220);
  const wearWarning = thresholds?.toolWear?.warning ?? 200;
  const wearCritical = thresholds?.toolWear?.critical ?? 240;

  const failureNode = (
    mode: FailureMode,
    label: string,
    value: string,
    detail: string,
    x: number,
    y: number,
  ): GraphNode => ({
    id: `mode-${mode}`,
    kind: 'failure',
    label,
    value,
    detail,
    status: prediction.failures[mode]?.isTriggered ? 'critical' : prediction.failures[mode]?.probability > 0.3 ? 'warning' : 'safe',
    x,
    y,
  });

  const nodes: GraphNode[] = [
    { id: 'air-temp', kind: 'feature', label: 'Air Temp', value: `${telemetry.airTemp.toFixed(1)} K`, detail: 'Ambient / coolant inlet temperature.', status: 'info', x: 90, y: 60 },
    { id: 'process-temp', kind: 'feature', label: 'Process Temp', value: `${telemetry.processTemp.toFixed(1)} K`, detail: 'Spindle process temperature.', status: 'info', x: 90, y: 150 },
    { id: 'rpm', kind: 'feature', label: 'Rotational Speed', value: `${telemetry.rotationalSpeed} RPM`, detail: 'Spindle speed; also drives fan airflow and power.', status: telemetry.rotationalSpeed < 1380 ? 'warning' : 'info', x: 90, y: 240 },
    { id: 'torque', kind: 'feature', label: 'Torque', value: `${telemetry.torque.toFixed(1)} Nm`, detail: 'Cutting torque; drives power and overstrain.', status: 'info', x: 90, y: 330 },
    { id: 'tool-wear', kind: 'feature', label: 'Tool Wear', value: `${telemetry.toolWear} min`, detail: `Warning ${wearWarning} min, critical ${wearCritical} min (subsystem profile).`, status: statusFor(telemetry.toolWear >= wearCritical, telemetry.toolWear >= wearWarning), x: 90, y: 420 },
    { id: 'product-type', kind: 'feature', label: 'Product Type', value: `Type ${telemetry.type}`, detail: 'Alloy grade. In this engine it affects risk only via subsystem thresholds.', status: 'info', x: 90, y: 510 },

    { id: 'temp-diff', kind: 'physics', label: 'ΔT = Process − Air', value: `${tempDiff.toFixed(1)} K`, detail: `HDF rule uses ΔT < 8.6 K. Current ΔT is ${tempDiff.toFixed(1)} K.`, status: statusFor(tempDiff < 8.6, tempDiff < 9.5), x: 330, y: 105 },
    { id: 'power', kind: 'physics', label: 'Power = Torque × ω', value: `${powerKw.toFixed(2)} kW`, detail: `PWF safe band ${powerMinKw}–${powerMaxKw} kW (subsystem profile).`, status: statusFor(powerKw < powerMinKw || powerKw > powerMaxKw, powerKw < powerMinKw + 0.5 || powerKw > powerMaxKw - 0.8), x: 330, y: 285 },
    { id: 'overstrain', kind: 'physics', label: 'Overstrain = Wear × Torque', value: `${overstrain.toFixed(0)} min·Nm`, detail: `Limit ${osfLimit} min·Nm from subsystem torque × wear critical values.`, status: statusFor(overstrain > osfLimit, overstrain > osfLimit * 0.85), x: 330, y: 465 },

    failureNode('TWF', 'TWF — Tool Wear', `${(prediction.failures.TWF.probability * 100).toFixed(1)}%`, 'Tool wear reaching 200–240 min in AI4I rules.', 580, 60),
    failureNode('HDF', 'HDF — Heat Dissipation', `${(prediction.failures.HDF.probability * 100).toFixed(1)}%`, 'ΔT < 8.6 K AND speed < 1380 RPM in AI4I rules.', 580, 170),
    failureNode('PWF', 'PWF — Power', `${(prediction.failures.PWF.probability * 100).toFixed(1)}%`, 'Power outside 3.5–9.0 kW in AI4I rules (profile band may differ).', 580, 280),
    failureNode('OSF', 'OSF — Overstrain', `${(prediction.failures.OSF.probability * 100).toFixed(1)}%`, 'Wear × Torque above the type limit (11k/12k/13k min·Nm in AI4I).', 580, 390),
    failureNode('RNF', 'RNF — Random', `${(prediction.failures.RNF.probability * 100).toFixed(1)}%`, 'Stochastic anomaly, ~0.1% background in AI4I. No sensor directly explains it.', 580, 500),

    { id: 'machine-failure', kind: 'outcome', label: 'Machine Failure', value: `${(prediction.machineFailureProbability * 100).toFixed(1)}% risk`, detail: prediction.isMachineFailure ? 'At least one failure mode is tripped, or overall risk is at/above 50%.' : 'No failure mode is tripped and overall risk is below 50%.', status: prediction.isMachineFailure ? 'critical' : 'safe', x: 800, y: 280 },
  ];

  const edges: GraphEdge[] = [
    { from: 'air-temp', to: 'temp-diff', rule: 'ΔT = Process − Air' },
    { from: 'process-temp', to: 'temp-diff', rule: 'ΔT = Process − Air' },
    { from: 'rpm', to: 'power', rule: 'Power = Torque × (RPM × 2π/60)' },
    { from: 'torque', to: 'power', rule: 'Power = Torque × (RPM × 2π/60)' },
    { from: 'torque', to: 'overstrain', rule: 'Overstrain = Wear × Torque' },
    { from: 'tool-wear', to: 'overstrain', rule: 'Overstrain = Wear × Torque' },
    { from: 'tool-wear', to: 'mode-TWF', rule: 'Wear 200–240 min → TWF' },
    { from: 'temp-diff', to: 'mode-HDF', rule: 'ΔT < 8.6 K → HDF (with low RPM)' },
    { from: 'rpm', to: 'mode-HDF', rule: 'RPM < 1380 → HDF (with low ΔT)' },
    { from: 'power', to: 'mode-PWF', rule: 'Power outside safe band → PWF' },
    { from: 'overstrain', to: 'mode-OSF', rule: 'Overstrain above limit → OSF' },
    { from: 'product-type', to: 'mode-OSF', rule: 'Type sets the AI4I overstrain limit (L/M/H)' },
    { from: 'mode-TWF', to: 'machine-failure', rule: 'Any tripped mode raises machine-failure risk' },
    { from: 'mode-HDF', to: 'machine-failure', rule: 'Any tripped mode raises machine-failure risk' },
    { from: 'mode-PWF', to: 'machine-failure', rule: 'Any tripped mode raises machine-failure risk' },
    { from: 'mode-OSF', to: 'machine-failure', rule: 'Any tripped mode raises machine-failure risk' },
    { from: 'mode-RNF', to: 'machine-failure', rule: 'Stochastic contribution, small by design' },
  ];

  return { nodes, edges };
}

/** All nodes that can reach `id` (upstream) plus all nodes reachable from it (downstream), including itself. */
export function traceGraph(graph: DependencyGraph, id: string): { upstream: string[]; downstream: string[]; connected: Set<string>; edges: GraphEdge[] } {
  const upstream = new Set<string>([id]);
  const downstream = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (downstream.has(edge.from) && !downstream.has(edge.to)) {
        downstream.add(edge.to);
        changed = true;
      }
      if (upstream.has(edge.to) && !upstream.has(edge.from)) {
        upstream.add(edge.from);
        changed = true;
      }
    }
  }
  const connected = new Set([...upstream, ...downstream]);
  const edges = graph.edges.filter((e) => connected.has(e.from) && connected.has(e.to));
  return { upstream: [...upstream], downstream: [...downstream], connected, edges };
}

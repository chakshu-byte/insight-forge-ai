import type { TelemetryState } from '../types';
import { runInference } from './mlEngine';

/**
 * Counterfactual safe envelope (Feature 4).
 *
 * "Safe" here means exactly: machine-failure risk below 50% AND no failure
 * mode tripped, under the same rule-based engine. Nothing here is a repair
 * guarantee — these are what-if changes to the live sliders, and the
 * wear change is labelled as tool replacement because wear cannot be
 * turned down by any other means in this model.
 */

export interface Counterfactual {
  label: string;
  description: string;
  changes: Partial<TelemetryState>;
  newRisk: number;
  newState: TelemetryState;
  isSafe: boolean;
}

export interface EnvelopeBoundary {
  feature: string;
  current: string;
  boundary: string;
  direction: string;
}

export interface SafeEnvelope {
  isCurrentlySafe: boolean;
  currentRisk: number;
  singleChanges: Counterfactual[];
  combinedChange: Counterfactual | null;
  boundaries: EnvelopeBoundary[];
}

const isSafe = (state: TelemetryState, model: 'XGBoost' | 'RandomForest' | 'EnsembleGradient') => {
  const p = runInference(state, model);
  const anyTripped = Object.values(p.failures).some((f) => f.isTriggered);
  return !anyTripped && p.machineFailureProbability < 0.5;
};

export function computeSafeEnvelope(
  state: TelemetryState,
  model: 'XGBoost' | 'RandomForest' | 'EnsembleGradient' = 'XGBoost',
): SafeEnvelope {
  const current = runInference(state, model);
  const currentRisk = current.machineFailureProbability;
  const currentlySafe = isSafe(state, model);

  const make = (label: string, description: string, changes: Partial<TelemetryState>): Counterfactual => {
    const newState = { ...state, ...changes };
    const p = runInference(newState, model);
    const anyTripped = Object.values(p.failures).some((f) => f.isTriggered);
    return {
      label,
      description,
      changes,
      newRisk: p.machineFailureProbability,
      newState,
      isSafe: !anyTripped && p.machineFailureProbability < 0.5,
    };
  };

  const candidates: Counterfactual[] = [
    make('Replace tool', 'Tool replacement resets wear — wear cannot be lowered any other way.', { toolWear: 10 }),
    make('Raise RPM to 1500', 'Higher RPM improves fan airflow for HDF.', { rotationalSpeed: 1500 }),
    make('Raise RPM to 1750', 'Nominal safe RPM from the explainability reference.', { rotationalSpeed: 1750 }),
    make('Derate torque −20%', 'Reduce cutting load.', { torque: Math.max(5, Math.round(state.torque * 0.8 * 10) / 10) }),
    make('Derate torque −40%', 'Stronger load reduction.', { torque: Math.max(5, Math.round(state.torque * 0.6 * 10) / 10) }),
    make('Cool air by 2 K', 'Lower air temperature raises ΔT by 2 K.', { airTemp: Math.round((state.airTemp - 2) * 10) / 10 }),
    make('Cool air by 5 K', 'Lower air temperature raises ΔT by 5 K.', { airTemp: Math.round((state.airTemp - 5) * 10) / 10 }),
  ];
  const singleChanges = candidates
    .filter((c) => c.isSafe)
    .sort((a, b) => a.newRisk - b.newRisk);

  const combinedCandidates = currentlySafe
    ? []
    : [
        make('Replace tool + raise RPM to 1750', 'Combined what-if: new tool and nominal safe RPM.', { toolWear: 10, rotationalSpeed: 1750 }),
        make('Replace tool + RPM 1500 + derate torque −20%', 'Combined what-if: new tool, moderate RPM (to avoid power overshoot), and lower torque.', { toolWear: 10, rotationalSpeed: 1500, torque: Math.max(5, Math.round(state.torque * 0.8 * 10) / 10) }),
        make('Replace tool + RPM 1500', 'Combined what-if: new tool and moderate RPM.', { toolWear: 10, rotationalSpeed: 1500 }),
        make('Derate torque −40% + raise RPM to 1750', 'Combined what-if: much lower torque with nominal safe RPM.', { torque: Math.max(5, Math.round(state.torque * 0.6 * 10) / 10), rotationalSpeed: 1750 }),
      ].filter((c) => c.isSafe).sort((a, b) => a.newRisk - b.newRisk);
  const combinedChange = combinedCandidates[0] ?? null;

  // Envelope boundaries: scan one feature at a time, holding the rest fixed.
  const boundaries: EnvelopeBoundary[] = [];
  let minSafeRpm: number | null = null;
  for (let rpm = 1200; rpm <= 3000; rpm += 25) {
    if (isSafe({ ...state, rotationalSpeed: rpm }, model)) {
      minSafeRpm = rpm;
      break;
    }
  }
  boundaries.push({
    feature: 'Rotational Speed',
    current: `${state.rotationalSpeed} RPM`,
    boundary: minSafeRpm !== null ? `≥ ${minSafeRpm} RPM (at current other values)` : 'No RPM in 1200–3000 alone makes it safe',
    direction: 'increase',
  });

  let maxSafeWear: number | null = null;
  for (let wear = 240; wear >= 0; wear -= 5) {
    if (isSafe({ ...state, toolWear: wear }, model)) {
      maxSafeWear = wear;
      break;
    }
  }
  boundaries.push({
    feature: 'Tool Wear',
    current: `${state.toolWear} min`,
    boundary: maxSafeWear !== null ? `≤ ${maxSafeWear} min (at current other values)` : 'No wear in 0–240 alone makes it safe',
    direction: 'decrease (tool replacement)',
  });

  let maxSafeTorque: number | null = null;
  for (let torque = 70; torque >= 5; torque -= 1) {
    if (isSafe({ ...state, torque }, model)) {
      maxSafeTorque = torque;
      break;
    }
  }
  boundaries.push({
    feature: 'Torque',
    current: `${state.torque.toFixed(1)} Nm`,
    boundary: maxSafeTorque !== null ? `≤ ${maxSafeTorque} Nm (at current other values)` : 'No torque in 5–70 alone makes it safe',
    direction: 'decrease',
  });

  let minSafeDeltaT: number | null = null;
  for (let air = state.airTemp; air >= 290; air -= 0.5) {
    if (isSafe({ ...state, airTemp: Math.round(air * 10) / 10 }, model)) {
      minSafeDeltaT = Math.round((state.processTemp - Math.round(air * 10) / 10) * 10) / 10;
      break;
    }
  }
  boundaries.push({
    feature: 'Thermal Delta (ΔT)',
    current: `${(state.processTemp - state.airTemp).toFixed(1)} K`,
    boundary: minSafeDeltaT !== null ? `≥ ${minSafeDeltaT.toFixed(1)} K (by cooling air, at current other values)` : 'No ΔT in the scanned range alone makes it safe',
    direction: 'increase',
  });

  return {
    isCurrentlySafe: currentlySafe,
    currentRisk,
    singleChanges,
    combinedChange: combinedChange && combinedChange.isSafe ? combinedChange : null,
    boundaries,
  };
}

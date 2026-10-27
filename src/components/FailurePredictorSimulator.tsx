import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sliders,
  Cpu,
  Activity,
  AlertOctagon,
  ShieldCheck,
  Zap,
  Flame,
  Wrench,
  Sparkles,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { TelemetryState, PredictionResult, FailureMode, ProductType } from '../types';
import { computeExplanation, computeRulForecast } from '../utils/mlEngine';
import { SafeEnvelopePanel } from './SafeEnvelopePanel';
import { soundEngine } from '../utils/audio';

interface FailurePredictorSimulatorProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
  modelUsed: 'XGBoost' | 'RandomForest' | 'EnsembleGradient';
  onModelChange: (model: 'XGBoost' | 'RandomForest' | 'EnsembleGradient') => void;
  onUpdateTelemetry: (updates: Partial<TelemetryState>) => void;
  onApplyPreset: (scenario: 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf') => void;
}

export const FailurePredictorSimulator: React.FC<FailurePredictorSimulatorProps> = ({
  telemetry,
  prediction,
  modelUsed,
  onModelChange,
  onUpdateTelemetry,
  onApplyPreset
}) => {
  const failureModeIcons: Record<FailureMode, React.ElementType> = {
    TWF: Wrench,
    HDF: Flame,
    PWF: Zap,
    OSF: Activity,
    RNF: AlertOctagon
  };

  // Feature 2: computed waterfall — re-runs the prediction engine, so it
  // changes whenever telemetry or the model selection changes.
  const explanation = useMemo(
    () => computeExplanation(telemetry, modelUsed),
    [telemetry, modelUsed],
  );
  const rulForecast = useMemo(
    () => computeRulForecast(telemetry, prediction.machineFailureProbability, prediction.estimatedRULHours),
    [telemetry, prediction],
  );
  const [plainExplanation, setPlainExplanation] = useState<string | null>(null);
  const [plainExplanationModel, setPlainExplanationModel] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const handleGeneratePlainExplanation = async () => {
    setIsExplaining(true);
    setExplainError(null);
    try {
      const triggeredModes = (['TWF', 'HDF', 'PWF', 'OSF', 'RNF'] as FailureMode[]).filter(
        (mode) => prediction.failures[mode]?.isTriggered,
      );
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry: {
            airTemp: telemetry.airTemp,
            processTemp: telemetry.processTemp,
            rotationalSpeed: telemetry.rotationalSpeed,
            torque: telemetry.torque,
            toolWear: telemetry.toolWear,
            type: telemetry.type,
            productID: telemetry.productID,
          },
          risk: prediction.machineFailureProbability,
          healthIndex: prediction.healthIndex,
          triggeredModes,
          explanation,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      const data = await response.json();
      setPlainExplanation(data.reply || 'No explanation could be generated.');
      setPlainExplanationModel(data.model || null);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Explanation request failed.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSliderChange = (field: keyof TelemetryState, value: number) => {
    soundEngine.playClick();
    onUpdateTelemetry({ [field]: value });
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 md:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header and Model Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
                FAILURE PREDICTOR & WHAT-IF INFERENCE SIMULATOR
              </h2>
              <p className="text-xs text-slate-400">
                Adjust sensor operating metrics to forecast multi-class machinery breakdown risks
              </p>
            </div>
          </div>
        </div>

        {/* Model Selection Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            MODEL:
          </span>
          {(['XGBoost', 'RandomForest', 'EnsembleGradient'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onModelChange(m);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                modelUsed === m
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {m === 'XGBoost' ? 'XGBoost (AUC 0.984)' : m === 'RandomForest' ? 'Random Forest' : 'Gradient Ensemble'}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Quick-Test Scenarios */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Test Bench Presets:
        </span>
        <button
          type="button"
          onClick={() => onApplyPreset('normal')}
          className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800/80 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-500/50 border border-slate-700 text-slate-300 transition-all"
        >
          ✓ Nominal Steady State
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('twf')}
          className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800/80 hover:bg-slate-700 hover:text-cyan-300 hover:border-cyan-500/50 border border-slate-700 text-slate-300 transition-all"
        >
          ⚙ TWF (Tool Wear &gt;200m)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('hdf')}
          className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800/80 hover:bg-amber-950 hover:text-amber-300 hover:border-amber-500/50 border border-slate-700 text-slate-300 transition-all"
        >
          🔥 HDF (Heat Choke ΔT&lt;8.6K)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('pwf')}
          className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-500/50 border border-slate-700 text-slate-300 transition-all"
        >
          ⚡ PWF (Inverter Power Trip)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('osf')}
          className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800/80 hover:bg-purple-950 hover:text-purple-300 hover:border-purple-500/50 border border-slate-700 text-slate-300 transition-all"
        >
          ⛓ OSF (Overstrain Fatigue)
        </button>
      </div>

      {/* Grid: Sliders on Left, Prediction Summary & SHAP on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Feature Sliders */}
        <div className="lg:col-span-7 space-y-4 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
              1. Input Feature Parameter Controls
            </h3>
            {/* Product Type (L/M/H) */}
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 mr-1">Quality Variant:</span>
              {(['L', 'M', 'H'] as ProductType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onUpdateTelemetry({ type: t });
                  }}
                  className={`px-2 py-0.5 text-xs font-mono rounded font-semibold transition-all ${
                    telemetry.type === t
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t} ({t === 'L' ? '50%' : t === 'M' ? '30%' : '20%'})
                </button>
              ))}
            </div>
          </div>

          {/* Slider 1: Air Temp */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Air Temperature [K]</span>
              <span className="text-cyan-400 font-bold">{telemetry.airTemp.toFixed(1)} K ({(telemetry.airTemp - 273.15).toFixed(1)} °C)</span>
            </div>
            <input
              type="range"
              min="295"
              max="305"
              step="0.1"
              value={telemetry.airTemp}
              onChange={(e) => handleSliderChange('airTemp', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>295.0 K (Cold Ambient)</span>
              <span>300.0 K (Std)</span>
              <span>305.0 K (Summer High)</span>
            </div>
          </div>

          {/* Slider 2: Process Temp */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Process Temperature [K]</span>
              <span className="text-cyan-400 font-bold">{telemetry.processTemp.toFixed(1)} K (ΔT: {prediction.tempDiffKelvin.toFixed(1)} K)</span>
            </div>
            <input
              type="range"
              min="305"
              max="315"
              step="0.1"
              value={telemetry.processTemp}
              onChange={(e) => handleSliderChange('processTemp', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>305.0 K (Nominal)</span>
              <span>310.0 K</span>
              <span>315.0 K (Thermal Saturation)</span>
            </div>
          </div>

          {/* Slider 3: Rotational Speed */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Rotational Speed [RPM]</span>
              <span className="text-indigo-400 font-bold">{telemetry.rotationalSpeed} RPM</span>
            </div>
            <input
              type="range"
              min="1100"
              max="2900"
              step="10"
              value={telemetry.rotationalSpeed}
              onChange={(e) => handleSliderChange('rotationalSpeed', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1100 RPM (Heavy Feed)</span>
              <span>1500 RPM (Cruising)</span>
              <span>2900 RPM (High Speed)</span>
            </div>
          </div>

          {/* Slider 4: Torque */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Operational Torque [Nm]</span>
              <span className="text-emerald-400 font-bold">{telemetry.torque.toFixed(1)} Nm</span>
            </div>
            <input
              type="range"
              min="3"
              max="80"
              step="0.5"
              value={telemetry.torque}
              onChange={(e) => handleSliderChange('torque', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>3.0 Nm (Freewheeling)</span>
              <span>40.0 Nm (Normal)</span>
              <span>80.0 Nm (Severe Resistance)</span>
            </div>
          </div>

          {/* Slider 5: Tool Wear */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Tool Wear Accumulation [min]</span>
              <span className={`font-bold ${telemetry.toolWear > 200 ? 'text-rose-400' : 'text-amber-400'}`}>
                {telemetry.toolWear} min / 250 min
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={telemetry.toolWear}
              onChange={(e) => handleSliderChange('toolWear', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 min (Brand New Insert)</span>
              <span className="text-amber-400">200 min (Limit Boundary)</span>
              <span>250 min (Extreme Wear)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Predictive Decision & Confidence Output */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Main Inference Verdict Box */}
          <div className={`p-5 rounded-xl border transition-all ${
            prediction.isMachineFailure
              ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/50'
              : 'bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  prediction.isMachineFailure
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {prediction.isMachineFailure ? (
                    <AlertOctagon className="w-7 h-7 animate-pulse" />
                  ) : (
                    <ShieldCheck className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    INFERENCE CLASSIFICATION
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">
                    {prediction.isMachineFailure ? 'MACHINE FAILURE' : 'NORMAL OPERATION'}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Predicted Class: <strong>[{prediction.predictedClass}]</strong> • Model: {modelUsed}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400">RISK PROBABILITY</div>
                <div className={`text-2xl font-black font-mono ${
                  prediction.machineFailureProbability > 0.5 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {(prediction.machineFailureProbability * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Health & RUL Progress */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80 font-mono">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">HEALTH INDEX</div>
                <div className="text-lg font-bold text-cyan-300">
                  {prediction.healthIndex}/100
                </div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">ESTIMATED R.U.L.</div>
                <div className="text-lg font-bold text-amber-300">
                  ~{prediction.estimatedRULHours} Op Hours
                </div>
                <div className="text-[10px] text-slate-400">
                  Band: {rulForecast.lowHours}–{rulForecast.highHours} h (heuristic, not a calibrated CI)
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="mt-3 text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              <strong className="text-cyan-400">Prescriptive Advisory: </strong>
              {prediction.recommendedAction}
            </div>
          </div>

          {/* Computed contribution waterfall — replaces the old hand-formula "SHAP" bars */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Why this prediction? — Computed Waterfall
              </span>
              <span className="text-[10px] text-slate-500">Change in risk (pp)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Not SHAP. Starts at the nominal operating point ({(explanation.baseRisk * 100).toFixed(1)}%
              risk), then applies each actual feature in turn and re-runs the prediction engine.
              The steps sum to the current risk ({(explanation.actualRisk * 100).toFixed(1)}%).
              A ~0 step means that feature barely changed this prediction.
            </p>
            {explanation.steps.map((step, idx) => {
              const delta = step.deltaPercentagePoints;
              const pushesUp = delta > 0.05;
              const pullsDown = delta < -0.05;
              return (
                <div key={step.feature} className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px] gap-2">
                    <span className="text-slate-400">
                      {idx + 1}. {step.label} ({step.actualValue} vs nominal {step.referenceValue})
                    </span>
                    <span className={pushesUp ? 'text-rose-400 font-semibold shrink-0' : pullsDown ? 'text-emerald-400 font-semibold shrink-0' : 'text-slate-400 shrink-0'}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pp → {(step.cumulativeRisk * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, Math.abs(delta))}%` }}
                      className={`h-full rounded-full ${pushesUp ? 'bg-rose-500 ml-auto' : pullsDown ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleGeneratePlainExplanation}
                disabled={isExplaining}
                className="w-full px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold disabled:opacity-40"
              >
                {isExplaining ? 'Generating explanation…' : 'Generate plain-English explanation'}
              </button>
              {explainError && (
                <p className="text-[11px] text-rose-300">
                  Explanation failed: {explainError}. The waterfall above is still computed from the live prediction.
                </p>
              )}
              {plainExplanation && (
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                  {plainExplanation}
                  {plainExplanationModel && (
                    <p className="mt-2 text-[10px] font-mono text-slate-500">
                      Model: {plainExplanationModel} • Grounded only in the numbers above.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Counterfactual safe envelope (Feature 4) */}
      <SafeEnvelopePanel telemetry={telemetry} modelUsed={modelUsed} onApplyChange={onUpdateTelemetry} />

      {/* 5 Distinct Failure Mode Status Cards (AI4I Schema) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          2. Multi-Class Failure Mode Breakdown (AI4I 2020 Categories)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(['TWF', 'HDF', 'PWF', 'OSF', 'RNF'] as FailureMode[]).map((mode) => {
            const fail = prediction.failures[mode];
            const Icon = failureModeIcons[mode];

            return (
              <motion.div
                key={mode}
                whileHover={{ y: -2 }}
                className={`p-3.5 rounded-xl border transition-all ${
                  fail.isTriggered
                    ? 'bg-rose-950/60 border-rose-500 shadow-md shadow-rose-950/50'
                    : fail.probability > 0.3
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-md ${
                    fail.isTriggered ? 'bg-rose-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                    fail.isTriggered
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {fail.isTriggered ? 'TRIPPED' : 'SAFE'}
                  </span>
                </div>

                <div className="font-mono text-xs font-bold text-slate-200">
                  {mode}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {fail.name}
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-500">Risk:</span>
                    <span className={`font-bold ${
                      fail.probability > 0.5 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {(fail.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      style={{ width: `${fail.probability * 100}%` }}
                      className={`h-full rounded-full ${
                        fail.isTriggered ? 'bg-rose-500' : fail.probability > 0.3 ? 'bg-amber-400' : 'bg-cyan-500'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

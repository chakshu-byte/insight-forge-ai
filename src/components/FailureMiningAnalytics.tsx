import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
  ComposedChart
} from 'recharts';
import { Award, BarChart2, TrendingUp, Grid, ShieldAlert, Sparkles } from 'lucide-react';
import { MODEL_BENCHMARKS } from '../utils/mlEngine';
import { PARETO_DISTRIBUTION_DATA, ROC_CURVE_DATA, CORRELATION_MATRIX } from '../data/mockAi4iData';
import { DatasetSummary } from '../utils/csvParser';
import type { HistoricalTelemetryRecord, PredictionResult, TelemetryState } from '../types';
import { FailureDependencyGraph } from './FailureDependencyGraph';
import { DriftTrustPanel } from './DriftTrustPanel';

interface FailureMiningAnalyticsProps {
  datasetSummary?: DatasetSummary;
  activeDatasetName?: string;
  telemetry?: TelemetryState;
  prediction?: PredictionResult;
  datasetRows?: HistoricalTelemetryRecord[];
  onNavigate?: (sectionId: string) => void;
}

export const FailureMiningAnalytics: React.FC<FailureMiningAnalyticsProps> = ({
  datasetSummary,
  activeDatasetName = 'AI4I 2020 Mining Baseline',
  telemetry,
  prediction,
  datasetRows,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'pareto' | 'roc' | 'correlations' | 'dependency' | 'drift-trust'>('benchmarks');
  const [useActiveDatasetPareto, setUseActiveDatasetPareto] = useState<boolean>(true);

  const selectedModel = MODEL_BENCHMARKS[0]; // XGBoost default

  // Use dynamic Pareto breakdown if available
  const paretoData = (datasetSummary && useActiveDatasetPareto)
    ? datasetSummary.paretoBreakdown
    : PARETO_DISTRIBUTION_DATA;

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 md:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header and Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <BarChart2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 font-mono">
                  FIELD RETURN FAILURE MINING & MODEL BENCHMARKS
                </h2>
                {datasetSummary && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    Live: {activeDatasetName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                AI4I 2020 operational telemetry data • XGBoost vs Random Forest ensemble • Real-time Pareto analysis
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('benchmarks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'benchmarks'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pareto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'pareto'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pareto Failure Modes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'roc'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ROC-AUC Curves
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('correlations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'correlations'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Correlation Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dependency')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'dependency'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dependency Graph
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drift-trust')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'drift-trust'
                ? 'forge-tab-active font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Drift &amp; Trust
          </button>
        </div>
      </div>

      {/* Tab 1: Model Leaderboard & Feature Importances */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MODEL_BENCHMARKS.map((model, idx) => (
              <div
                key={model.modelName}
                className={`p-4 rounded-xl border relative overflow-hidden ${
                  idx === 0
                    ? 'bg-[#191C22] border-[#2A2E36] shadow-lg shadow-black/40'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                {idx === 0 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/40">
                    <Award className="w-3 h-3" /> BEST MODEL
                  </div>
                )}
                <div className="font-mono text-sm font-bold text-slate-100 mb-3">
                  {model.modelName}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">ACCURACY</div>
                    <div className="text-sm font-bold text-cyan-400">{model.accuracy}%</div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">ROC-AUC</div>
                    <div className="text-sm font-bold text-indigo-400">{model.rocAuc}</div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">F1-SCORE</div>
                    <div className="text-sm font-bold text-emerald-400">{model.f1Score}</div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">LATENCY</div>
                    <div className="text-sm font-bold text-amber-400">{model.trainingTimeMs} ms</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Importance Bar Chart */}
          <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Global Gini Feature Importance (XGBoost Classifier)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedModel.featureImportances}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2E36" />
                  <XAxis type="number" domain={[0, 0.4]} tick={{ fill: '#9299A5', fontSize: 12 }} />
                  <YAxis dataKey="feature" type="category" tick={{ fill: '#D8DCE3', fontSize: 13, fontFamily: 'Inter Tight, sans-serif' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#191C22', borderColor: '#2A2E36', borderRadius: '8px' }}
                    formatter={(val: number) => [`${(val * 100).toFixed(1)}% Relative Importance`, 'Feature Gini Weight']}
                  />
                  <Bar dataKey="importance" fill="#D8DCE3" radius={[0, 6, 6, 0]}>
                    {selectedModel.featureImportances.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#F5F6F8' : index === 1 ? '#D8DCE3' : '#9299A5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pareto Failure Modes Analysis */}
      {activeTab === 'pareto' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Pareto Field Breakdown Frequency (80/20 Mining Equipment Rule)
                </h3>
                <p className="text-xs text-slate-400">
                  {datasetSummary
                    ? `Top failure mode: ${datasetSummary.topFailureMode.fullName} (${datasetSummary.topFailureMode.count} units / ${datasetSummary.topFailureMode.percentage})`
                    : 'Heat Dissipation (HDF) and Power Failure (PWF) account for over 61.9% of all mining field breakdowns.'}
                </p>
              </div>

              {datasetSummary && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setUseActiveDatasetPareto(!useActiveDatasetPareto)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
                  >
                    Source: {useActiveDatasetPareto ? 'Uploaded Dataset' : 'UCI 10k Baseline'}
                  </button>
                </div>
              )}
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2E36" />
                  <XAxis dataKey="mode" tick={{ fill: '#9299A5', fontSize: 13, fontFamily: 'Inter Tight, sans-serif' }} />
                  <YAxis yAxisId="left" orientation="left" stroke="#D8DCE3" tick={{ fill: '#9299A5', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" stroke="#f59e0b" tick={{ fill: '#f59e0b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#191C22', borderColor: '#2A2E36', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="Failure Incidents Count" fill="#0284c7" radius={[6, 6, 0, 0]}>
                    {paretoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="cumulativePct" name="Cumulative % (Pareto)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: ROC-AUC Curves */}
      {activeTab === 'roc' && (
        <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
              Receiver Operating Characteristic (ROC-AUC Comparison)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              XGBoost (AUC: 0.984) vs Random Forest (AUC: 0.976)
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ROC_CURVE_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E36" />
                <XAxis dataKey="fpr" label={{ value: 'False Positive Rate (FPR)', position: 'insideBottom', offset: -10, fill: '#9299A5' }} tick={{ fill: '#9299A5', fontSize: 12 }} />
                <YAxis label={{ value: 'True Positive Rate (TPR)', angle: -90, position: 'insideLeft', fill: '#9299A5' }} tick={{ fill: '#9299A5', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#191C22', borderColor: '#2A2E36', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="xgb_tpr" name="XGBoost Classifier (AUC: 0.984)" stroke="#F5F6F8" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="rf_tpr" name="Random Forest Classifier (AUC: 0.976)" stroke="#9299A5" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="baseline" name="Random Guess Baseline (AUC: 0.50)" stroke="#475569" strokeWidth={1.5} strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 4: Correlation Matrix */}
      {activeTab === 'correlations' && (
        <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Grid className="w-4 h-4" />
            Sensor Feature Pearson Correlation Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-2.5">Feature</th>
                  <th className="p-2.5 text-center">Air Temp</th>
                  <th className="p-2.5 text-center">Proc Temp</th>
                  <th className="p-2.5 text-center">Rot Speed</th>
                  <th className="p-2.5 text-center">Torque</th>
                  <th className="p-2.5 text-center">Tool Wear</th>
                  <th className="p-2.5 text-center text-cyan-300">Failure</th>
                </tr>
              </thead>
              <tbody>
                {CORRELATION_MATRIX.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                    <td className="p-2.5 font-semibold text-slate-200">{row.feature}</td>
                    {[row.airTemp, row.processTemp, row.rpm, row.torque, row.wear, row.failure].map((val, idx) => {
                      const isHigh = Math.abs(val) > 0.5;
                      const isPositive = val > 0;
                      return (
                        <td
                          key={idx}
                          className={`p-2.5 text-center font-mono ${
                            isHigh
                              ? isPositive
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                                : 'bg-rose-500/20 text-rose-300 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Drift & trust (Features 7 & 8) */}
      {activeTab === 'drift-trust' && (
        <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-4">
          {datasetRows ? (
            <DriftTrustPanel datasetRows={datasetRows} activeDatasetName={activeDatasetName} />
          ) : (
            <p className="text-xs text-slate-400">Drift and trust need the active dataset rows, which were not supplied to this section.</p>
          )}
        </div>
      )}

      {/* Tab 5: Failure-mode dependency graph (Feature 6) */}
      {activeTab === 'dependency' && (
        <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            Failure-Mode Dependency Graph — Click to Trace Root Cause
          </h3>
          {telemetry && prediction ? (
            <FailureDependencyGraph telemetry={telemetry} prediction={prediction} onNavigate={onNavigate} />
          ) : (
            <p className="text-xs text-slate-400">
              Dependency graph needs the currently loaded telemetry, which was not supplied to this section.
            </p>
          )}
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { motion } from 'motion/react';
import { Thermometer, RotateCw, Gauge, Wrench, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { TelemetryState, PredictionResult } from '../types';

interface TelemetryHudProps {
  telemetry: TelemetryState;
  prediction: PredictionResult;
  onUpdateTelemetry: (updates: Partial<TelemetryState>) => void;
  theme?: 'dark' | 'light';
}

export const TelemetryHud: React.FC<TelemetryHudProps> = ({
  telemetry,
  prediction,
  theme = 'dark',
}) => {
  const kToC = (k: number) => (k - 273.15).toFixed(1);
  const thresholds = telemetry.thresholds;
  const speedWarning = thresholds?.rotationalSpeed?.warning ?? 1380;
  const speedCritical = thresholds?.rotationalSpeed?.critical ?? 1450;
  const torqueWarning = thresholds?.torque?.warning ?? 60;
  const torqueCritical = thresholds?.torque?.critical ?? 70;
  const airTemperatureWarning = thresholds?.airTemperature?.warning ?? 303;
  const airTemperatureCritical = thresholds?.airTemperature?.critical ?? 308;
  const processTemperatureWarning = thresholds?.processTemperature?.warning ?? 315;
  const processTemperatureCritical = thresholds?.processTemperature?.critical ?? 320;
  const deltaTWarning = thresholds?.temperatureDifferential?.warning ?? 9;
  const deltaTCritical = thresholds?.temperatureDifferential?.critical ?? 8.6;
  const toolWearWarning = thresholds?.toolWear?.warning ?? 200;
  const toolWearCritical = thresholds?.toolWear?.critical ?? 240;
  const powerMinimum = thresholds?.power?.min ?? 3.5;
  const powerMaximum = thresholds?.power?.max ?? 9;

  const metrics = [
    {
      id: 'airTemp',
      title: 'AIR TEMPERATURE',
      value: `${telemetry.airTemp.toFixed(1)} K`,
      subValue: `${kToC(telemetry.airTemp)} °C Ambient`,
      icon: Thermometer,
      color: 'text-sky-400',
      borderColor: 'border-sky-500/30',
      bgColor: 'bg-sky-500/5',
      indicatorPct: Math.min(100, Math.max(0, ((telemetry.airTemp - (airTemperatureWarning - 8)) / 10) * 100)),
      range: `${airTemperatureWarning} - ${airTemperatureCritical} K`,
      status: telemetry.airTemp >= airTemperatureCritical ? 'Critical' : telemetry.airTemp >= airTemperatureWarning ? 'Warning' : 'Normal',
      sparkline: [296, 297, 297.5, 298, 298.2, telemetry.airTemp]
    },
    {
      id: 'processTemp',
      title: 'PROCESS TEMP',
      value: `${telemetry.processTemp.toFixed(1)} K`,
      subValue: `${kToC(telemetry.processTemp)} °C (ΔT ${prediction.tempDiffKelvin.toFixed(1)} K)`,
      icon: Thermometer,
      color: prediction.tempDiffKelvin < 8.6 ? 'text-amber-400' : 'text-cyan-400',
      borderColor: prediction.tempDiffKelvin < 8.6 ? 'border-amber-500/40' : 'border-cyan-500/30',
      bgColor: prediction.tempDiffKelvin < 8.6 ? 'bg-amber-500/10' : 'bg-cyan-500/5',
      indicatorPct: Math.min(100, Math.max(0, ((telemetry.processTemp - (processTemperatureWarning - 8)) / 10) * 100)),
      range: `${processTemperatureWarning} - ${processTemperatureCritical} K`,
      status: prediction.tempDiffKelvin < deltaTCritical ? 'HDF Risk' : prediction.tempDiffKelvin < deltaTWarning ? 'Thermal Warning' : 'Optimal',
      sparkline: [306, 307.2, 308, 308.5, 309, telemetry.processTemp]
    },
    {
      id: 'rotationalSpeed',
      title: 'ROTATIONAL SPEED',
      value: `${telemetry.rotationalSpeed} RPM`,
      subValue: `${((telemetry.rotationalSpeed * 2 * Math.PI) / 60).toFixed(1)} rad/s Velocity`,
      icon: RotateCw,
      color: 'text-indigo-400',
      borderColor: 'border-indigo-500/30',
      bgColor: 'bg-indigo-500/5',
      indicatorPct: Math.min(100, Math.max(0, ((telemetry.rotationalSpeed - (speedWarning - 300)) / 500) * 100)),
      range: `${speedWarning} - ${speedCritical} RPM`,
      status: telemetry.rotationalSpeed >= speedCritical ? 'Critical Speed' : telemetry.rotationalSpeed >= speedWarning ? 'Synchronized' : 'Low Speed Risk',
      sparkline: [1450, 1500, 1530, 1490, 1510, telemetry.rotationalSpeed]
    },
    {
      id: 'torque',
      title: 'TORQUE LOAD',
      value: `${telemetry.torque.toFixed(1)} Nm`,
      subValue: `${(telemetry.torque * 0.73756).toFixed(1)} lb-ft Force`,
      icon: Gauge,
      color: telemetry.torque > 60 ? 'text-rose-400' : 'text-emerald-400',
      borderColor: telemetry.torque > 60 ? 'border-rose-500/40' : 'border-emerald-500/30',
      bgColor: telemetry.torque > 60 ? 'bg-rose-500/10' : 'bg-emerald-500/5',
      indicatorPct: Math.min(100, Math.max(0, (telemetry.torque / torqueCritical) * 100)),
      range: `${torqueWarning} - ${torqueCritical} Nm`,
      status: telemetry.torque >= torqueCritical ? 'Critical Strain' : telemetry.torque >= torqueWarning ? 'High Strain' : 'Nominal',
      sparkline: [38, 42, 40, 45, 43, telemetry.torque]
    },
    {
      id: 'toolWear',
      title: 'TOOL WEAR ACCUMULATION',
      value: `${telemetry.toolWear} min`,
      subValue: `Warning: ${toolWearWarning} min (${Math.max(0, toolWearCritical - telemetry.toolWear)} min to critical)`,
      icon: Wrench,
      color: telemetry.toolWear > 200 ? 'text-rose-400' : telemetry.toolWear > 160 ? 'text-amber-400' : 'text-cyan-400',
      borderColor: telemetry.toolWear > 200 ? 'border-rose-500/50' : 'border-cyan-500/30',
      bgColor: telemetry.toolWear > 200 ? 'bg-rose-500/10' : 'bg-cyan-500/5',
      indicatorPct: Math.min(100, Math.max(0, (telemetry.toolWear / toolWearCritical) * 100)),
      range: `0 - ${toolWearCritical} min`,
      status: telemetry.toolWear >= toolWearCritical ? 'TWF Tripped' : telemetry.toolWear >= toolWearWarning ? 'Service Soon' : 'Healthy',
      sparkline: [20, 45, 80, 120, 160, telemetry.toolWear]
    },
    {
      id: 'power',
      title: 'ELECTROMECHANICAL POWER',
      value: `${(prediction.powerWatts / 1000).toFixed(2)} kW`,
      subValue: `${prediction.overstrainProduct.toFixed(0)} min·Nm Strain Prod`,
      icon: Zap,
      color: prediction.powerWatts < 3500 || prediction.powerWatts > 9000 ? 'text-rose-400' : 'text-violet-400',
      borderColor: prediction.powerWatts < 3500 || prediction.powerWatts > 9000 ? 'border-rose-500/50' : 'border-violet-500/30',
      bgColor: prediction.powerWatts < 3500 || prediction.powerWatts > 9000 ? 'bg-rose-500/10' : 'bg-violet-500/5',
      indicatorPct: Math.min(100, Math.max(0, ((prediction.powerWatts / 1000 - powerMinimum) / Math.max(0.1, powerMaximum - powerMinimum)) * 100)),
      range: `${powerMinimum} - ${powerMaximum} kW Safe`,
      status: prediction.powerWatts / 1000 < powerMinimum ? 'PWF Underload' : prediction.powerWatts / 1000 > powerMaximum ? 'PWF Overload' : 'Safe Band',
      sparkline: [4.2, 4.5, 4.8, 5.1, 4.9, prediction.powerWatts / 1000]
    }
  ];

  const isLight = theme === 'light';
  const thresholdRows = [
    ['Speed', thresholds?.rotationalSpeed?.warning, thresholds?.rotationalSpeed?.critical, 'RPM'],
    ['Torque', thresholds?.torque?.warning, thresholds?.torque?.critical, 'Nm'],
    ['Air temperature', thresholds?.airTemperature?.warning, thresholds?.airTemperature?.critical, 'K'],
    ['Process temperature', thresholds?.processTemperature?.warning, thresholds?.processTemperature?.critical, 'K'],
    ['Temperature differential', thresholds?.temperatureDifferential?.warning, thresholds?.temperatureDifferential?.critical, 'K'],
    ['Tool wear', thresholds?.toolWear?.warning, thresholds?.toolWear?.critical, 'min'],
    ['Power safe band', thresholds?.power?.min, thresholds?.power?.max, 'kW']
  ];

  return (
    <div className={`space-y-4 rounded-2xl p-4 transition-colors ${isLight ? 'bg-white/75 border border-sky-100 shadow-lg shadow-slate-200/60' : 'bg-transparent'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className={`text-sm font-semibold font-mono tracking-wider uppercase ${isLight ? 'text-sky-900' : 'text-slate-200'}`}>
            Live Field Telemetry Channel [UCI AI4I 2020 Stream]
          </h2>
        </div>
        <div className={`text-xs font-mono flex items-center gap-3 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
          <span>SAMPLING: 1000 Hz</span>
          <span>•</span>
          <span>PRODUCT ID: <strong className={isLight ? 'text-cyan-800' : 'text-cyan-400'}>{telemetry.productID} ({telemetry.type})</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          const cardBg = isLight ? 'bg-white/80' : m.bgColor;
          const cardBorder = isLight ? 'border-sky-100' : m.borderColor;
          const iconWrap = isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800';
          const titleText = isLight ? 'text-slate-600' : 'text-slate-400';
          const subText = isLight ? 'text-slate-600' : 'text-slate-400';
          const progressTrack = isLight ? 'bg-slate-200' : 'bg-slate-950';
          const sectionDivider = isLight ? 'border-slate-200' : 'border-slate-800/60';
          const statusTone =
            m.status.includes('Risk') || m.status.includes('Tripped') || m.status.includes('High') || m.status.includes('Critical')
              ? 'text-rose-600'
              : m.status.includes('Warning') || m.status.includes('Service')
              ? 'text-amber-600'
              : 'text-emerald-600';

          return (
            <motion.div
              key={m.id}
              whileHover={{ y: -2 }}
              className={`relative rounded-xl border p-4 backdrop-blur-md transition-colors ${cardBg} ${cardBorder} ${isLight ? 'shadow-lg shadow-slate-200/70' : 'shadow-lg shadow-black/20'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-[11px] font-mono uppercase tracking-wider ${titleText}`}>
                    {m.title}
                  </div>
                  <div className={`text-2xl font-bold font-mono tracking-tight mt-1 ${m.color}`}>
                    {m.value}
                  </div>
                  <div className={`text-xs mt-0.5 ${subText}`}>
                    {m.subValue}
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${iconWrap} ${m.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {/* Progress bar representing operating envelope */}
              <div className={`mt-4 pt-3 border-t ${sectionDivider}`}>
                <div className={`flex justify-between items-center text-[10px] font-mono mb-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  <span>Range: {m.range}</span>
                  <span className={`font-semibold ${statusTone}`}>
                    {m.status}
                  </span>
                </div>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${progressTrack}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.indicatorPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      m.indicatorPct > 85 ? 'bg-rose-500' : m.indicatorPct > 65 ? 'bg-amber-400' : 'bg-cyan-500'
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {thresholds && (
        <details className={`rounded-xl border p-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-200 list-none">
            Component Operating Limits: {thresholds.subsystem} <span className="text-slate-400 font-normal">— tap to show / hide</span>
          </summary>
          <div className="mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              Component Operating Limits: {thresholds.subsystem}
            </div>
            <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
              {thresholds.rotationalSpeed?.confidence} • {thresholds.rotationalSpeed?.source}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
            {thresholdRows.map(([label, warning, critical, unit]) => (
              <div key={label} className={`flex justify-between gap-3 text-[11px] font-mono border-b pb-1 ${isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800 text-slate-400'}`}>
                <span>{label}</span>
                <span className={isLight ? 'text-sky-800' : 'text-cyan-300'}>
                  {label === 'Power safe band' ? `${warning}-${critical}` : `W ${warning} / C ${critical}`} {unit}
                </span>
              </div>
            ))}
          </div>
          </div>
        </details>
      )}
    </div>
  );
};

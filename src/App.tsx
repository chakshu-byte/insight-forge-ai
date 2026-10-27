import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TelemetryState, PredictionResult, HistoricalTelemetryRecord } from './types';
import { runInference } from './utils/mlEngine';
import { soundEngine } from './utils/audio';
import { HISTORICAL_DATASET } from './data/mockAi4iData';
import { computeDatasetSummary, ParseCsvResult, DatasetSummary } from './utils/csvParser';
import { ScrollBackground } from './components/ScrollBackground';
import { Header } from './components/Header';
import { MachineDigitalTwin } from './components/MachineDigitalTwin';
import { TelemetryHud } from './components/TelemetryHud';
import { FailurePredictorSimulator } from './components/FailurePredictorSimulator';
import { IncidentLogsTable } from './components/IncidentLogsTable';

// Lazy-loaded heavy sections (Recharts, jsPDF) so the initial page stays lighter.
const FailureMiningAnalytics = lazy(() => import('./components/FailureMiningAnalytics').then((m) => ({ default: m.FailureMiningAnalytics })));
const AiRcaDiagnostics = lazy(() => import('./components/AiRcaDiagnostics').then((m) => ({ default: m.AiRcaDiagnostics })));
import { NlQueryPanel } from './components/NlQueryPanel';
import { LandingPage } from './components/LandingPage';
import { CommandCenter } from './components/CommandCenter';
import { CsvUploadModal } from './components/CsvUploadModal';
import { AiChatDrawer } from './components/AiChatDrawer';
import { AgentCopilot } from './components/AgentCopilot';
import type { AgentLogFilter } from './agent/agentContract';
import { getComponentThresholds } from './config/componentThresholds';
import { AlertOctagon, ArrowUp, Activity, Sparkles, Database, FileSpreadsheet, ShieldAlert } from 'lucide-react';

const INITIAL_TELEMETRY: TelemetryState = {
  airTemp: 298.2,
  processTemp: 308.7,
  rotationalSpeed: 1530,
  torque: 41.5,
  toolWear: 75,
  type: 'M',
  productID: 'M15020',
  subsystem: 'Primary Crushing',
  thresholds: getComponentThresholds('Primary Crushing')
};

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [modelUsed, setModelUsed] = useState<'XGBoost' | 'RandomForest' | 'EnsembleGradient'>('XGBoost');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('twin');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [selectedTelemetryUdi, setSelectedTelemetryUdi] = useState<number | null>(null);
  // Landing-first, ALWAYS: the first screen at `/` is the landing page,
  // exactly as in InsightForge-Landing-REFINED.html. The dashboard is
  // one click away via Launch dashboard, and Header LANDING returns here.
  // No data, API, or feature logic changes with this flag — it only
  // chooses which view is rendered. Default theme is dark, as requested
  // (landing + dashboard both start dark; toggle switches to light).
  // The old `/?view=dashboard` shortcut is REMOVED: it bypassed the
  // landing on fresh open, so opening the combined result went straight
  // to the dashboard and the landing looked disconnected. Fresh open
  // always shows landing now, whatever URL you came in on.
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // Pending dashboard section when navigating from the landing:
  // the section does not exist until the dashboard has rendered, so a
  // fixed 50ms timeout was racy and sometimes scrolled nowhere.
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  // Dig deeper: Ask / Logs / RCA are one tabbed stage now, not three
  // stacked walls of text. Only one is visible at a time, nothing dropped.
  const [digTab, setDigTab] = useState<'ask' | 'logs' | 'rca'>('rca');

  // Open-at-top fix: browsers restore the previous scroll position on
  // reload (e.g. mid-dashboard), which made the landing open in the
  // middle. 'manual' stops that restoration, and this mount scroll
  // guarantees the top, on first open and on landing re-entry.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // Clean an old ?view=dashboard bookmark back to '/', so a reload
    // can never skip the landing again.
    if (window.location.search.includes('view=dashboard') || window.location.hash.includes('dashboard')) {
      window.history.replaceState(null, '', '/');
    }
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (!showLanding && pendingSection) {
      const elem = document.getElementById(pendingSection);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      setPendingSection(null);
    }
  }, [showLanding, pendingSection, digTab]);

  // Landing CSS reads data-theme from <html> (:root), not from a div,
  // so sync the App theme there. Without this, the landing theme
  // toggle and the dark default would not actually change the landing.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const [judgeMode, setJudgeMode] = useState<boolean>(false);

  // Active dataset management
  const [datasetRecords, setDatasetRecords] = useState<HistoricalTelemetryRecord[]>(HISTORICAL_DATASET);
  const [activeDatasetName, setActiveDatasetName] = useState<string>('AI4I 2020 Mining Baseline');
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary>(() => computeDatasetSummary(HISTORICAL_DATASET));

  // Modal & Drawer visibility
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(false);
  const [agentLogFilter, setAgentLogFilter] = useState<AgentLogFilter | null>(null);

  // Compute ML Inference and failure status
  const prediction: PredictionResult = runInference(telemetry, modelUsed);

  // Sound engine sync
  useEffect(() => {
    soundEngine.isMuted = isMuted;
  }, [isMuted]);

  // Audio alert on severe failure trip
  const prevFailureRef = useRef(false);
  useEffect(() => {
    if (prediction.isMachineFailure && !prevFailureRef.current) {
      soundEngine.playAlert('critical');
    }
    prevFailureRef.current = prediction.isMachineFailure;
  }, [prediction.isMachineFailure]);

  // Scroll listener for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live Telemetry Auto-Drift Simulator
  useEffect(() => {
    if (!isStreaming) return;

    let step = 0;
    const interval = setInterval(() => {
      step += 0.05;
      setTelemetry((prev) => {
        // Natural wandering walk around operating conditions
        const deltaRpm = Math.sin(step * 2) * 12 + (Math.random() - 0.5) * 8;
        const deltaTorque = Math.cos(step * 1.5) * 0.4 + (Math.random() - 0.5) * 0.3;
        const deltaAir = Math.sin(step * 0.5) * 0.04;
        const deltaProc = Math.sin(step * 0.5 + 0.3) * 0.05;

        // Tool wear slowly ticks up in live mode
        const newToolWear = Math.min(250, prev.toolWear + 0.08);

        return {
          ...prev,
          airTemp: Math.max(295, Math.min(305, prev.airTemp + deltaAir)),
          processTemp: Math.max(305, Math.min(315, prev.processTemp + deltaProc)),
          rotationalSpeed: Math.max(1100, Math.min(2900, Math.round(prev.rotationalSpeed + deltaRpm))),
          torque: Math.max(3, Math.min(80, prev.torque + deltaTorque)),
          toolWear: Math.round(newToolWear)
        };
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleUpdateTelemetry = (updates: Partial<TelemetryState>) => {
    setTelemetry((prev) => ({ ...prev, ...updates }));
  };

  const handleApplyPreset = (scenario: 'normal' | 'twf' | 'hdf' | 'pwf' | 'osf') => {
    soundEngine.enable();
    soundEngine.playClick();
    // Presets change the physics values only. Subsystem + thresholds are
    // preserved from the current selection, instead of being dropped
    // (which silently fell back to Primary Crushing thresholds).
    const keepSubsystem = (prev: TelemetryState, values: Partial<TelemetryState>): TelemetryState => ({
      ...prev,
      ...values,
      subsystem: prev.subsystem ?? 'Primary Crushing',
      thresholds: prev.thresholds ?? getComponentThresholds(prev.subsystem ?? 'Primary Crushing'),
    });
    if (scenario === 'normal') {
      setTelemetry((prev) => keepSubsystem(prev, {
        airTemp: 298.1,
        processTemp: 308.6,
        rotationalSpeed: 1550,
        torque: 39.5,
        toolWear: 60,
        type: 'M',
        productID: 'M15020'
      }));
    } else if (scenario === 'twf') {
      // Tool Wear Failure (>200 min wear)
      setTelemetry((prev) => keepSubsystem(prev, {
        airTemp: 298.4,
        processTemp: 308.9,
        rotationalSpeed: 1510,
        torque: 44.0,
        toolWear: 218,
        type: 'L',
        productID: 'L48110'
      }));
      soundEngine.playAlert('warning');
    } else if (scenario === 'hdf') {
      // Heat Dissipation Failure (ΔT < 8.6 K & RPM < 1380)
      setTelemetry((prev) => keepSubsystem(prev, {
        airTemp: 299.8,
        processTemp: 307.8, // ΔT = 8.0 K (< 8.6 K)
        rotationalSpeed: 1320, // < 1380 RPM
        torque: 55.2,
        toolWear: 130,
        type: 'L',
        productID: 'L47220'
      }));
      soundEngine.playAlert('warning');
    } else if (scenario === 'pwf') {
      // Power Failure (<3500 W or >9000 W)
      setTelemetry((prev) => keepSubsystem(prev, {
        airTemp: 298.6,
        processTemp: 309.2,
        rotationalSpeed: 2840,
        torque: 5.2, // Freewheeling high RPM low torque stall runaway
        toolWear: 140,
        type: 'H',
        productID: 'H29420'
      }));
      soundEngine.playAlert('warning');
    } else if (scenario === 'osf') {
      // Overstrain Failure (Wear * Torque > limit)
      setTelemetry((prev) => keepSubsystem(prev, {
        airTemp: 299.2,
        processTemp: 309.5,
        rotationalSpeed: 1420,
        torque: 68.5,
        toolWear: 195, // 195 * 68.5 = 13,357 > 11,000 threshold for L
        type: 'L',
        productID: 'L47180'
      }));
      soundEngine.playAlert('warning');
    }
  };

  const handleLoadRecord = (record: HistoricalTelemetryRecord) => {
    soundEngine.enable();
    if (record.machineFailure === 1) {
      soundEngine.playAlert('warning');
    }
    setSelectedTelemetryUdi(record.udi);
    setTelemetry({
      airTemp: record.airTemp,
      processTemp: record.processTemp,
      rotationalSpeed: record.rotationalSpeed,
      torque: record.torque,
      toolWear: record.toolWear,
      type: record.type,
      productID: record.productID,
      subsystem: record.subsystem,
      thresholds: record.thresholds || getComponentThresholds(record.subsystem)
    });

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const handleDatasetLoaded = (result: ParseCsvResult) => {
    setDatasetRecords(result.records);
    setActiveDatasetName(result.filename);
    setDatasetSummary(result.summary);

    // If dataset has records, load the first failure or first row to inspect
    const firstFail = result.records.find(r => r.machineFailure === 1) || result.records[0];
    if (firstFail) {
      setSelectedTelemetryUdi(firstFail.udi);
      setTelemetry({
        airTemp: firstFail.airTemp,
        processTemp: firstFail.processTemp,
        rotationalSpeed: firstFail.rotationalSpeed,
        torque: firstFail.torque,
        toolWear: firstFail.toolWear,
        type: firstFail.type,
        productID: firstFail.productID,
        subsystem: firstFail.subsystem,
        thresholds: firstFail.thresholds || getComponentThresholds(firstFail.subsystem)
      });
    } else {
      setSelectedTelemetryUdi(null);
    }
  };

  const digTabForSection = (sectionId: string): 'ask' | 'logs' | 'rca' | null =>
    sectionId === 'nl-query' ? 'ask' : sectionId === 'logs' ? 'logs' : sectionId === 'rca' ? 'rca' : null;

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const dig = digTabForSection(sectionId);
    if (dig) setDigTab(dig);
    // If the user is on the landing, a dashboard section does not exist
    // yet — exit the landing first; the pendingSection effect above
    // scrolls once the dashboard (and the right dig tab) has rendered.
    if (showLanding) {
      setPendingSection(sectionId);
      setShowLanding(false);
      return;
    }
    if (dig) {
      // Tab switch needs a render before the panel exists.
      setPendingSection(sectionId);
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const showLandingPage = () => {
    setShowLanding(true);
    window.history.replaceState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const launchDashboard = () => {
    setShowLanding(false);
    window.history.replaceState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Forge continuation effects — same as the landing:
  // cursor spotlight (--cx/--cy), card glow (--mx/--my), and scroll
  // reveals (.forge-reveal -> .in). No data or logic changes here.
  const dashboardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showLanding) return;
    const root = dashboardRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }),
      { threshold: 0.15 },
    );
    root.querySelectorAll('.forge-reveal').forEach((e) => io.observe(e));
    const onMove = (e: PointerEvent) => {
      root.style.setProperty('--cx', `${e.clientX}px`);
      root.style.setProperty('--cy', `${e.clientY}px`);
      const c = (e.target as HTMLElement | null)?.closest?.('.forge-card') as HTMLElement | null;
      if (c) {
        const b = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${e.clientX - b.left}px`);
        c.style.setProperty('--my', `${e.clientY - b.top}px`);
      }
    };
    window.addEventListener('pointermove', onMove);
    return () => { io.disconnect(); window.removeEventListener('pointermove', onMove); };
  }, [showLanding]);

  return (
    <div ref={dashboardRef} className={`relative min-h-screen forge-dashboard ${theme === 'light' ? 'forge-light' : 'forge-dark'}`}>
      <a
        href="#command-center"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-cyan-500 focus:text-slate-950 focus:px-3 focus:py-2 focus:font-mono focus:text-xs focus:font-bold"
      >
        Skip to Command Center
      </a>
      {showLanding && (
        <LandingPage
          theme={theme}
          onThemeChange={setTheme}
          onLaunchDashboard={launchDashboard}
          telemetry={telemetry}
          prediction={prediction}
          datasetSummary={datasetSummary}
          activeDatasetName={activeDatasetName}
        />
      )}
      {!showLanding && (
      <>
      {/* Dashboard view — rendered only after Launch dashboard. */}
      {/* Scroll-Reactive 3D/Particle Dynamic Background */}
      <ScrollBackground
        rotationalSpeed={telemetry.rotationalSpeed}
        torque={telemetry.torque}
        isMachineFailure={prediction.isMachineFailure}
      />

      {/* Main Foreground Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Sticky Status & Navigation Bar */}
        <Header
          isStreaming={isStreaming}
          onToggleStreaming={() => setIsStreaming(!isStreaming)}
          isMuted={isMuted}
          onToggleMute={() => {
            if (isMuted) soundEngine.enable();
            setIsMuted(!isMuted);
          }}
          onResetDefaults={() => handleApplyPreset('normal')}
          activeSection={activeSection}
          onNavigate={scrollToSection}
          onOpenCsvUpload={() => setIsCsvModalOpen(true)}
          onOpenAiChat={() => setIsAiChatOpen(true)}
          onOpenAgentCopilot={() => setIsAgentOpen(true)}
          onShowLanding={showLandingPage}
          activeDatasetName={activeDatasetName}
          totalRecordsCount={datasetRecords.length}
          theme={theme}
          onThemeChange={setTheme}
        />

        {/* Global Machine Failure Alert Banner (Appears if failure is triggered) */}
        <AnimatePresence>
          {prediction.isMachineFailure && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-600/90 text-white border-b border-rose-400/50 backdrop-blur-md px-4 py-2.5 shadow-lg shadow-rose-950/50"
            >
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 animate-bounce" />
                  <strong className="tracking-wide">CRITICAL ANOMALY ALERT:</strong>
                  <span>
                    Machine breakdown condition detected (Risk: {(prediction.machineFailureProbability * 100).toFixed(1)}%).
                    Immediate field maintenance required.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection('rca')}
                  className="px-3 py-1 bg-white text-rose-950 font-bold rounded shadow hover:bg-rose-100 transition-all"
                >
                  View RCA Report ➔
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Sections */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-12 flex-1 forge-page-enter">
          <div className="forge-grid" aria-hidden="true" />
          <div className="forge-aurora" aria-hidden="true"><i /><i /><i /></div>
          {/* Stage 1 — Right now: one summary, nothing else above it. */}
          <div className="forge-stage forge-reveal">
            <span className="forge-label">Stage 1 · Right now</span>
            <h2 className="forge-title" style={{ fontSize: 34 }}>What is happening right now?</h2>
            <p>One summary. If you read nothing else, read this.</p>
          </div>
          {/* Command Center (Part 1 UI, step 1) */}
          <CommandCenter
            telemetry={telemetry}
            prediction={prediction}
            datasetSummary={datasetSummary}
            activeDatasetName={activeDatasetName}
            onNavigate={scrollToSection}
            onOpenAgentCopilot={() => setIsAgentOpen(true)}
            onOpenCsvUpload={() => setIsCsvModalOpen(true)}
            isStreaming={isStreaming}
            onToggleStreaming={() => setIsStreaming(!isStreaming)}
            judgeMode={judgeMode}
            onToggleJudgeMode={() => setJudgeMode(!judgeMode)}
          />

          {/* Stage 2 — The machine: twin first, then live numbers. */}
          <div className="forge-stage forge-reveal">
            <span className="forge-label">Stage 2 · The machine</span>
            <h2 className="forge-title" style={{ fontSize: 34 }}>What does the machine look like, live?</h2>
            <p>The twin shows the part. The HUD shows the numbers. Nothing else in this stage.</p>
          </div>
          {/* Section 1: CAD Digital Twin & Inspection */}
          <section id="twin" className="scroll-mt-24 space-y-4 forge-reveal">
            <MachineDigitalTwin
              telemetry={telemetry}
              prediction={prediction}
              isStreaming={isStreaming}
            />
          </section>

          {/* Section 2: Real-time Telemetry HUD */}
          <section id="telemetry" className="scroll-mt-24 space-y-4 forge-reveal">
            <TelemetryHud
              telemetry={telemetry}
              prediction={prediction}
              onUpdateTelemetry={handleUpdateTelemetry}
              theme={theme}
            />
          </section>

          {/* Stage 3 — What if: change one thing, see the risk move. */}
          <div className="forge-stage forge-reveal">
            <span className="forge-label">Stage 3 · What if</span>
            <h2 className="forge-title" style={{ fontSize: 34 }}>What happens if you change something?</h2>
            <p>Move a slider or pick a preset. The risk, health, and RUL answer — the explanation is underneath, not on top of it.</p>
          </div>
          {/* Section 3: Failure Predictor & What-If Simulator */}
          <section id="simulator" className="scroll-mt-24 space-y-4 forge-reveal">
            <FailurePredictorSimulator
              telemetry={telemetry}
              prediction={prediction}
              modelUsed={modelUsed}
              onModelChange={setModelUsed}
              onUpdateTelemetry={handleUpdateTelemetry}
              onApplyPreset={handleApplyPreset}
            />
          </section>

          {/* Stage 4 — The evidence: one tab at a time, never all at once. */}
          <div className="forge-stage forge-reveal">
            <span className="forge-label">Stage 4 · The evidence</span>
            <h2 className="forge-title" style={{ fontSize: 34 }}>What does the field data say?</h2>
            <p>Benchmarks, Pareto, ROC, correlations, dependency, drift &amp; trust — pick one tab. The rest stays hidden until you ask for it.</p>
          </div>
          {/* Section 4: Failure Mining Analytics & Model Benchmarks */}
          <section id="analytics" className="scroll-mt-24 space-y-4 forge-reveal">
            <Suspense fallback={<div className="forge-skeleton" role="status"><span className="forge-label">Loading analytics…</span></div>}>
              <FailureMiningAnalytics
                datasetSummary={datasetSummary}
                activeDatasetName={activeDatasetName}
                telemetry={telemetry}
                prediction={prediction}
                datasetRows={datasetRecords}
                onNavigate={scrollToSection}
              />
            </Suspense>
          </section>

          {/* Stage 5 — Dig deeper: Ask / Logs / RCA, one tab at a time. */}
          <div className="forge-stage forge-reveal">
            <span className="forge-label">Stage 5 · Dig deeper</span>
            <h2 className="forge-title" style={{ fontSize: 34 }}>Want the detail?</h2>
            <p>Ask the dataset a question, read the field logs, or open the full RCA report. One of these at a time — the other two are one tap away, not a wall below.</p>
          </div>
          <section id="dig-deeper" className="scroll-mt-24 space-y-4 forge-reveal">
            <div className="forge-dig-tabs" role="tablist" aria-label="Dig deeper">
              <button type="button" role="tab" aria-selected={digTab === 'ask'} className={digTab === 'ask' ? 'forge-tab-active' : ''} onClick={() => { setDigTab('ask'); setActiveSection('nl-query'); }}>Ask the Dataset</button>
              <button type="button" role="tab" aria-selected={digTab === 'logs'} className={digTab === 'logs' ? 'forge-tab-active' : ''} onClick={() => { setDigTab('logs'); setActiveSection('logs'); }}>Field Logs</button>
              <button type="button" role="tab" aria-selected={digTab === 'rca'} className={digTab === 'rca' ? 'forge-tab-active' : ''} onClick={() => { setDigTab('rca'); setActiveSection('rca'); }}>RCA Report</button>
            </div>
            {digTab === 'ask' && (
              <div id="nl-query" className="space-y-4">
                <NlQueryPanel
                  datasetRows={datasetRecords}
                  activeDatasetName={activeDatasetName}
                  onLoadRecord={handleLoadRecord}
                />
              </div>
            )}
            {digTab === 'logs' && (
              <div id="logs" className="space-y-4">
                <IncidentLogsTable
                  records={datasetRecords}
                  activeDatasetName={activeDatasetName}
                  selectedRecordUdi={selectedTelemetryUdi}
                  onLoadRecord={handleLoadRecord}
                  onOpenUploadModal={() => setIsCsvModalOpen(true)}
                  agentFilter={agentLogFilter}
                />
              </div>
            )}
            {digTab === 'rca' && (
              <div id="rca" className="space-y-4">
                <Suspense fallback={<div className="forge-skeleton" role="status"><span className="forge-label">Loading RCA report…</span></div>}>
                  <AiRcaDiagnostics
                    telemetry={telemetry}
                    prediction={prediction}
                    datasetRows={datasetRecords}
                  />
                </Suspense>
              </div>
            )}
          </section>
        </main>

        <footer className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl py-6 px-4 text-center text-xs font-mono text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Field Return Failure Mining Platform • UCI AI4I 2020 Predictive Maintenance</span>
            </div>
            <div>
              <span>XGBoost Classifier • Random Forest Ensemble • Web Audio Synthesizer • Motion 3D Parallax</span>
            </div>
          </div>
        </footer>
      </div>
      </>
      )}

      {/* CSV Dataset Upload Modal — always mounted, hidden until opened,
          so Agent / AI actions can exit the landing and open a section. */}
      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onDatasetLoaded={handleDatasetLoaded}
        activeDatasetName={activeDatasetName}
        totalRecordsCount={datasetRecords.length}
      />

      {/* Agent Copilot drawer — tool calls that really execute */}
      <AgentCopilot
        isOpen={isAgentOpen}
        onClose={() => setIsAgentOpen(false)}
        datasetSummary={datasetSummary}
        activeDatasetName={activeDatasetName}
        datasetRecords={datasetRecords}
        telemetry={telemetry}
        onNavigate={scrollToSection}
        onApplyPreset={handleApplyPreset}
        onUpdateTelemetry={handleUpdateTelemetry}
        onLoadRecord={handleLoadRecord}
        onAgentFilter={setAgentLogFilter}
      />

      {/* Floating AI Chatbot Icon & Slide-over Right Sidebar */}
      <AiChatDrawer
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        onOpen={() => setIsAiChatOpen(true)}
        datasetSummary={datasetSummary}
        activeDatasetName={activeDatasetName}
        onOpenCsvModal={() => setIsCsvModalOpen(true)}
      />

      {/* Floating Scroll To Top Button (Offset when AI floating button is visible) */}
      <AnimatePresence>
        {showScrollTop && !isAiChatOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 z-40 p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shadow-xl transition-all"
            title="Scroll to Top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}


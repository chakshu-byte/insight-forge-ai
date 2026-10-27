import React, { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';
import {
  Activity,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  BarChart3,
  ListFilter,
  FileCheck,
  FileSpreadsheet,
  Bot,
  Sun,
  Moon
} from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface HeaderProps {
  isStreaming: boolean;
  onToggleStreaming: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetDefaults: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  onOpenCsvUpload: () => void;
  onOpenAiChat: () => void;
  onOpenAgentCopilot: () => void;
  onShowLanding?: () => void;
  activeDatasetName: string;
  totalRecordsCount: number;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isStreaming,
  onToggleStreaming,
  isMuted,
  onToggleMute,
  onResetDefaults,
  activeSection,
  onNavigate,
  onOpenCsvUpload,
  onOpenAiChat,
  onOpenAgentCopilot,
  onShowLanding,
  activeDatasetName,
  totalRecordsCount,
  theme,
  onThemeChange
}) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Scroll-compact header: full size at the top, then slowly shrinks as
  // the user scrolls, so the panel never occupies half the screen.
  // Transition is on the header container, so the shrink is smooth,
  // not a jump. Threshold 40px keeps the full header visible at rest.
  const [compact, setCompact] = useState<boolean>(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { id: 'twin', label: 'CAD Twin', icon: Layers },
    { id: 'telemetry', label: 'Telemetry HUD', icon: Activity },
    { id: 'simulator', label: 'What-If ML', icon: Sparkles },
    { id: 'analytics', label: 'Mining Analytics', icon: BarChart3 },
    { id: 'logs', label: 'Field Logs', icon: ListFilter },
    { id: 'rca', label: 'RCA Report', icon: FileCheck },
  ];

  const logoSrc = theme === 'dark'
    ? '/assets/ChatGPT%20Image%20Aug%2024,%202026%20at%2001_51_57%20PM.png'
    : '/assets/ChatGPT%20Image%20Aug%2024,%202026%20at%2001_51_57%20PM%20copy.png';

  return (
    <header className={`forge-nav sticky top-0 z-50 bg-[#07090e]/80 backdrop-blur-xl border-b border-slate-800/80 transition-all duration-300 ${compact ? 'scrolled' : ''}`}>
      {/* Scroll Progress Bar at the absolute top */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 origin-left z-50"
        style={{ scaleX }}
      />

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-300 ${compact ? 'py-1.5' : 'py-3'}`}>
        <div className={`flex flex-wrap items-center justify-between transition-all duration-300 ${compact ? 'gap-2' : 'gap-4'}`}>
          {/* Brand Logo & Title — explicit small sizes here, so no
              landing hero rule can ever balloon this title again. */}
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt="InsightForge"
              className={`object-contain transition-all duration-300 ${compact ? 'w-7 h-7' : 'w-10 h-10'}`}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`tracking-wider text-slate-100 transition-all duration-300 ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
                  INSIGHT FORGE AI
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  AI4I 2020 ML
                </span>
              </div>
              {/* Subtitle hides when compact, so the header shrinks
                  to a single row instead of two tall rows. */}
              <p className={`text-[11px] text-slate-400 font-mono transition-all duration-300 overflow-hidden ${compact ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100'}`}>
                Predictive Maintenance Engine • XGBoost & Random Forest Ensemble
              </p>
            </div>
          </div>

          {/* Quick Nav Pills (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 font-mono text-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onNavigate(item.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Dataset Upload & AI Copilot & Stream & Sound Controls */}
          <div className="flex items-center gap-2">
            {/* Landing Page — returns to the in-app landing at `/`,
                not to the standalone /landing.html side page. */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onShowLanding?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
              title="Back to the InsightForge landing page"
            >
              <span>LANDING</span>
            </button>
            {/* CSV Dataset Upload Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenCsvUpload();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm transition-all"
              title="Upload CSV failure returns dataset"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>UPLOAD CSV</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px] text-cyan-200">
                {totalRecordsCount}
              </span>
            </button>

            {/* Open Agent Copilot Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenAgentCopilot();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm transition-all"
              title="Agent Copilot: tool calls that really change the app"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>AGENT</span>
            </button>

            {/* Open AI Copilot Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenAiChat();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#191C22] hover:bg-[#2A2E36] text-[#F5F6F8] border border-[#2A2E36] shadow-sm transition-all"
              title="Chat with Dataset AI Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-[#D8DCE3] animate-pulse" />
              <span>ASK AI</span>
            </button>

            {/* Live Auto Simulation Toggle */}
            <button
              type="button"
              onClick={onToggleStreaming}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                isStreaming
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={isStreaming ? 'Pause Live Stream Drift' : 'Start Live Stream Simulation'}
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">LIVE DRIFT</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">SIMULATE</span>
                </>
              )}
            </button>

            {/* Theme Toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                  theme === 'dark'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Dark mode"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                  theme === 'light'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Light mode"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
            </div>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-2 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
              }`}
              title={isMuted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={onResetDefaults}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              title="Reset to Nominal Baseline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};


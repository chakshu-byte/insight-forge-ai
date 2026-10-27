import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  Bot,
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  FileSpreadsheet,
  Database,
  HelpCircle,
  Maximize2,
  Minimize2,
  ChevronRight,
  Lightbulb,
  Zap,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { DatasetSummary } from '../utils/csvParser';
import { soundEngine } from '../utils/audio';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  datasetSummary: DatasetSummary;
  activeDatasetName: string;
  onOpenCsvModal: () => void;
}

const CATEGORIZED_PROMPT_CHIPS = [
  { label: '🛠️ Fix procedure', query: 'Give me a complete corrective action plan for the current failure pattern and required maintenance steps.' },
  { label: '🔥 Top failure mode', query: 'Which failure mode affects the most units and why is it the dominant risk in this dataset?' },
  { label: '⚡ PWF vs HDF physics', query: 'Explain the deterministic physics behind Power Failure (PWF) and Heat Dissipation Failure (HDF) in this operating regime.' },
  { label: '⚙️ Type L/M/H risk', query: 'Compare the risk profile of Type L, M, and H products for wear, torque, and failure propagation.' },
  { label: '🤖 ML benchmark summary', query: 'Explain the XGBoost vs Random Forest benchmark results and which model is most reliable for this fleet.' },
  { label: '📊 Dataset health overview', query: 'Summarize the current dataset health, failure rate, telemetry ranges, and dominant operational risks.' },
  { label: '📈 Pareto analysis', query: 'Run a Pareto analysis for the failure mechanisms and rank the most critical contributors to field returns.' },
  { label: '🧪 Early warning signs', query: 'What early warning signals should operators monitor before a machine reaches a critical failure condition?' },
  { label: '🧰 Maintenance SOP', query: 'Create a preventive maintenance SOP for the most likely failure modes found in the active dataset.' },
  { label: '🦾 Safety actions', query: 'Outline the immediate safety and response actions when a severe machine failure is detected.' },
  { label: '⚠️ High-risk threshold', query: 'What telemetry thresholds indicate the machine is at high risk of TWF, HDF, PWF, OSF, or RNF?' },
  { label: '📉 Sensor insight', query: 'Which sensors or telemetry signatures are most predictive of failure in this fleet?' },
  { label: '🧠 Root cause tracing', query: 'Trace the likely root cause chain from operating conditions to the observed failure mode in the active dataset.' },
  { label: '🛡️ Reliability recommendation', query: 'Recommend a reliability strategy to reduce product field return rates and increase monitoring coverage.' },
  { label: '📦 Product-level summary', query: 'Summarize the product types and show which variant has the highest operational risk and why.' },
  { label: '🔍 Anomaly detection', query: 'Identify the most anomalous telemetry patterns and explain how they correlate with elevated failure probability.' },
  { label: '📐 KPI scorecard', query: 'Create a field reliability scorecard with major KPIs, current risk, and recommended next actions.' },
  { label: '🧭 Action priority', query: 'Prioritize the next engineering and maintenance actions based on the failure severity and occurrence frequency.' }
];

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  isOpen,
  onClose,
  onOpen,
  datasetSummary,
  activeDatasetName,
  onOpenCsvModal
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `### **Gemini Industrial Intelligence** 🤖⚡

Welcome! I am your **AI Failure Mining & Predictive Maintenance Scientist**, directly connected to your active dataset: **${activeDatasetName}** (**${datasetSummary.totalRecords} logged assets**).

#### **Fleet Snapshot at a Glance:**
  modelUsed: 'gemini-3.7-flash'
- **Top Breakdown Risk:** **${datasetSummary.topFailureMode.mode} (${datasetSummary.topFailureMode.fullName})** — ${datasetSummary.topFailureMode.count} units (**${datasetSummary.topFailureMode.percentage}** of failures)
- **Total Fleet Failures:** **${datasetSummary.totalFailures} incidents** (${datasetSummary.failureRate} return rate)
- **Primary Telemetry Driver:** Thermal dissipation ($\\Delta T < 8.6\\text{ K}$) and tool wear degradation ($t_w \\ge 180\\text{ min}$).

---

#### **How I Can Assist You:**
1. 🛠️ **Corrective Action Plans:** Use the quick prompts below for engineering SOPs.
2. 🔬 **First-Principles Physics:** Query any failure condition (**HDF, PWF, OSF, TWF, RNF**).
3. 📈 **Statistical & Pareto Mining:** Uncover correlations between torque, speed, and wear.
4. 💻 **Code & ML Analytics:** Request Python, Pandas, XGBoost scripts or PLC automation logic.

*Choose a quick question below to start the analysis.*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.7-flash'
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend?.trim();
    if (!text || isLoading) return;

    soundEngine.playClick();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare grounding dataset context
      const datasetContext = {
        activeDatasetName,
        summary: datasetSummary,
        topFailureMode: datasetSummary.topFailureMode,
        paretoBreakdown: datasetSummary.paretoBreakdown,
        averages: datasetSummary.averages,
        ranges: datasetSummary.ranges
      };

      // Call server-side API endpoint
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          chatHistory: messages.slice(-6),
          datasetContext
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No analysis could be generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || 'gemini-3.7-flash'
      };

      setMessages((prev) => [...prev, assistantMessage]);
      soundEngine.playAlert('success');
    } catch (err: any) {
      console.error('AI chat request failed:', err);
      // Fallback local response
      const query = text.toLowerCase();
      let fallbackReply = '';

      if (query.includes('helo') || query.includes('hello') || query.includes('hi') || query.includes('hey')) {
        fallbackReply = `### **Hello! 👋 How can I help you?**\n\nI am **Gemini Industrial Intelligence**, connected to your dataset (**${activeDatasetName}**).\n\nYou can ask me:\n- *"How do I fix these issues?"* for step-by-step repair and maintenance SOPs.\n- *"What failure mode affects the most products?"*\n- *"What physics equations cause HDF, PWF, or OSF?"*\n- Or any other engineering or telemetry question!`;
      } else if (query.includes('fix') || query.includes('repair') || query.includes('solution') || query.includes('troubleshoot') || query.includes('what should i do')) {
        fallbackReply = `### **Actionable Remediation & Fix Procedures**\n\nFor your active fleet (**${activeDatasetName}**), here are the immediate corrective actions:\n\n1. **Thermal Choke (HDF - ${datasetSummary.topFailureMode.count} units):**\n   - Clean the ventilation jacket and heat exchanger coils.\n   - Ensure forced-air auxiliary blower kicks in whenever spindle speed falls under $1400\\text{ RPM}$.\n   - Maintain thermal differential $\\Delta T \\ge 10.0\\text{ K}$.\n\n2. **Drive Overload (PWF):**\n   - Calibrate the VFD inverter limiter to prevent power draw from exceeding $8800\\text{ W}$.\n\n3. **Tool Wear (TWF) & Overstrain (OSF):**\n   - Replace cutting inserts at $180\\text{ minutes}$ of use.\n   - Reduce feed rates on Type L components when torque exceeds $50\\text{ Nm}$.`;
      } else {
        fallbackReply = `### **Analysis for: "${text}"**\n\n- **Dataset Top Failure Mode:** **${datasetSummary.topFailureMode.mode} (${datasetSummary.topFailureMode.fullName})** with **${datasetSummary.topFailureMode.count} units** (${datasetSummary.topFailureMode.percentage} of all failures).\n- **Fleet Total:** ${datasetSummary.totalRecords} products with ${datasetSummary.totalFailures} failures (**${datasetSummary.failureRate}** failure rate).\n- **High Risk Group:** Type L products account for the largest proportion of mechanical strain failures.\n\nFeel free to ask for step-by-step fix procedures or failure physics details!`;
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'local-engine'
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setIsCopiedId(id);
    soundEngine.playClick();
    setTimeout(() => setIsCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    soundEngine.playClick();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Chat history cleared. Active dataset is **${activeDatasetName}** (${datasetSummary.totalRecords} records). How can I assist your field failure analysis?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.7-flash'
      }
    ]);
  };

  return (
    <>
      {/* Floating Bottom-Right Trigger Button (when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-3"
          >
            {/* Single circular button only. The wide "Ask AI About Dataset"
                pill used to sit beside it, making a ~350px fixed cluster
                that covered the simulator's RUL panel at the bottom right.
                The header ASK AI button already opens the same chat. */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                soundEngine.playClick();
                onOpen();
              }}
              className="relative p-3.5 rounded-full bg-[#F5F6F8] text-[#08090C] shadow-2xl shadow-black/50 hover:shadow-black/60 transition-all border-2 border-[#D8DCE3] flex items-center justify-center group"
              title="Open AI Dataset Assistant"
            >
              {/* Outer Pulse Ring */}
              <span className="absolute inset-0 rounded-full bg-[#D8DCE3] opacity-30 group-hover:opacity-50 animate-ping pointer-events-none" />

              <Bot className="w-6 h-6 text-[#08090C] relative z-10 transition-transform group-hover:rotate-6" />

              {/* Status Dot */}
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#08090C]" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over Right Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Sidebar Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`relative z-10 h-full bg-[#090d16]/95 border-l border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-col transition-all duration-300 ${
                isExpanded ? 'w-full md:w-[750px]' : 'w-full sm:w-[480px] md:w-[540px]'
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20">
                    <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-400">
                      <Bot className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold font-mono text-slate-100">
                        GEMINI INDUSTRIAL INTELLIGENCE
                      </h2>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        Gemini 3.7
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="truncate max-w-[180px] sm:max-w-[240px]" title={activeDatasetName}>
                        {activeDatasetName}
                      </span>
                      <span>• {datasetSummary.totalRecords} records</span>
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                    title={isExpanded ? 'Collapse width' : 'Expand width'}
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                    title="Clear chat history"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                    title="Close Gemini Assistant"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Active Dataset Overview Ribbon */}
              <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2 overflow-x-auto text-slate-400">
                  <span>Top Mode:</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {datasetSummary.topFailureMode.mode} ({datasetSummary.topFailureMode.percentage})
                  </span>
                  <span>Failures:</span>
                  <span className="text-rose-400 font-bold">{datasetSummary.totalFailures}</span>
                  <span className="text-slate-500">({datasetSummary.failureRate})</span>
                </div>

                <button
                  type="button"
                  onClick={onOpenCsvModal}
                  className="shrink-0 flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Change CSV
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
                {messages.map((msg, messageIndex) => (
                  <React.Fragment key={msg.id}>
                    <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono text-slate-500">
                      {msg.role === 'assistant' ? (
                        <>
                          <Bot className="w-3 h-3 text-cyan-400" />
                          <span className="text-cyan-400 font-bold">Gemini Industrial Intelligence</span>
                          {msg.modelUsed && <span className="text-[9px] text-slate-600">({msg.modelUsed})</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">You</span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`relative group max-w-[92%] sm:max-w-[88%] rounded-2xl p-4 shadow-lg leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-tr-sm font-medium'
                          : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-sm backdrop-blur-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="markdown-body space-y-2 text-slate-200 text-xs">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}

                      {/* Copy Action Button */}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all border border-slate-800"
                          title="Copy response"
                        >
                          {isCopiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    </motion.div>

                  {messageIndex === 0 && (
                    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 px-1">
                        <Lightbulb className="w-3 h-3 text-amber-400" />
                        <span>QUICK DATA QUESTIONS</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {CATEGORIZED_PROMPT_CHIPS.map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(chip.query)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-left text-slate-300 hover:text-cyan-300 border border-slate-800 text-[10px] font-mono transition-all flex items-center gap-1.5 hover:border-cyan-500/50"
                          >
                            <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>{chip.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}
                  </React.Fragment>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-[200px]"
                  >
                    <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-xs font-mono text-cyan-300 animate-pulse">
                      Mining dataset insights...
                    </span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

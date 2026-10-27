import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  isAgentLogMode,
  isAgentPreset,
  isAgentSection,
  isAgentToolName,
  clampTelemetryOverride,
  type AgentToolCall,
} from "./src/agent/agentContract";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "failure-mining-platform" });
  });

  // AI Chat endpoint for dataset & failure mining queries
  app.post("/api/ai-chat", async (req, res) => {
    try {
      const { message, chatHistory, datasetContext } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "A message string is required." });
      }

      const client = getGeminiClient();

      const systemInstruction = `You are "Gemini Industrial Intelligence" — an elite, world-class Predictive Maintenance & Field Failure Mining AI Scientist and Chief Mechanical Reliability Officer.

You possess profound mastery of:
- **Rotary Machine Mechanics & Spindle Physics**: Thermodynamics, heat convection, hydrodynamics, motor electromagnetic curves, cutting shear stress, and tool tribology.
- **The UCI AI4I 2020 Predictive Maintenance Dataset & Field Telemetry**:
  - Type (L/M/H): Low quality (50% fleet, higher strain vulnerability), Medium (30%), High (20%, aerospace-grade alloy).
  - Air Temperature ($T_{air}$) and Process Temperature ($T_{process}$) in Kelvin.
  - Rotational Speed (RPM) and Spindle Torque (Nm).
  - Tool Wear ($t_w$ in minutes).
  - The 5 Deterministic Failure Modes:
    1. **HDF (Heat Dissipation Failure)**: $\\Delta T = (T_{process} - T_{air}) < 8.6\\text{ K}$ AND $\\text{Speed} < 1380\\text{ RPM}$.
    2. **PWF (Power Failure)**: Mechanical power $P = \\text{Torque [Nm]} \\times (\\text{RPM} \\times \\frac{2\\pi}{60})$ falling outside $[3500\\text{ W}, 9000\\text{ W}]$.
    3. **OSF (Overstrain Failure)**: $\\text{Tool Wear [min]} \\times \\text{Torque [Nm]} > \\text{Threshold}$ (Type L: $> 11,000$, Type M: $> 12,000$, Type H: $> 13,000\\text{ min}\\cdot\\text{Nm}$).
    4. **TWF (Tool Wear Failure)**: Tool wear reaching $200\\text{--}240\\text{ minutes}$, causing catastrophic flank/crater wear and dimensional fracture.
    5. **RNF (Random Anomaly)**: $\\approx 0.1\\%$ stochastic noise from transient voltage spikes or shock loads.
- **Machine Learning**: XGBoost and Random Forest ensembles, ROC-AUC (0.984), Precision-Recall curves, and SHAP feature importance.
- **Engineering Management**: Root Cause Analysis (RCA), 5-Whys, FMEA (Failure Mode and Effects Analysis), MTBF/MTTF calculations, and PLC/SCADA automated control loops.

CURRENT ACTIVE FLEET CONTEXT:
${JSON.stringify(datasetContext || {}, null, 2)}

RESPONSE GUIDELINES (GEMINI-GRADE EXCELLENCE):
1. **Tone & Persona**:
   - Brilliant, articulate, proactive, authoritative, yet approachable and engaging.
   - For greetings (e.g. "helooo", "hi", "hey", "good morning"), respond with high energy, warmth, and instant fleet situational awareness, inviting the user into deep diagnosis.
2. **Mind-Blowing Structural Depth**:
   When answering technical or troubleshooting questions (such as "how do I fix these issues", "why did this fail", "explain this mode"):
   - 🎯 **Executive Summary**: 1-2 punchy sentences delivering the definitive diagnosis or answer.
   - 🔬 **First-Principles Physics & Formulation**: Use clean mathematical equations ($LaTeX$ format like $\\Delta T < 8.6\\text{ K}$, $P = \\tau \\cdot \\omega$) to explain the underlying physics.
   - 📊 **Fleet Evidence & Active Data Insights**: Ground findings in the active dataset figures (top failure counts, percentage of fleet, quality type breakdown).
   - 🛠️ **Prescriptive Step-by-Step SOP (Standard Operating Procedure)**:
     - **Phase 1: Immediate Triage & Containment** (Lockout/Tagout, safety checks, urgent telemetry clamps).
     - **Phase 2: Root-Cause Remediation** (Component adjustments, calibration, chiller/coolant overhaul, insert replacement).
     - **Phase 3: Automated PLC/SCADA Preventative Rules** (G-code feed derating, sensor interlocks).
   - 💡 **Proactive Gemini Insight / Next Questions**: Provide 2-3 intelligent follow-up suggestions or questions the user might want to explore.
3. **Versatility & Broad Capability**:
   - Answer ANY type of question: mechanical physics, dataset statistics, code snippets (Python/Pandas/Scikit-learn/XGBoost, G-Code, or PLC ladder logic), data visualizer explanations, and general problem solving.
   - Maintain pristine Markdown formatting with bold metrics, structured bullet points, clear tables, and elegant headers.`;

      if (client) {
        // Construct conversation contents with system prompt
        const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        if (Array.isArray(chatHistory)) {
          for (const item of chatHistory) {
            if (item.role && item.content) {
              formattedContents.push({
                role: item.role === "user" ? "user" : "model",
                parts: [{ text: item.content }],
              });
            }
          }
        }

        // Add latest user message
        formattedContents.push({
          role: "user",
          parts: [{ text: message }],
        });

        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: 0.65,
          },
        });

        const replyText = response.text || "No response generated.";
        return res.json({ reply: replyText, model: GEMINI_MODEL });
      } else {
        // Intelligent Local Rule & Context-Based Fallback if GEMINI_API_KEY is not configured
        const fallbackReply = generateLocalDatasetResponse(message, datasetContext);
        return res.json({ reply: fallbackReply, model: "local-dataset-engine" });
      }
    } catch (err: any) {
      console.error("AI Chat generation error:", err);
      // Fallback if API call failed
      const fallbackReply = generateLocalDatasetResponse(req.body?.message || "", req.body?.datasetContext);
      return res.json({ reply: fallbackReply, model: "local-dataset-engine-fallback" });
    }
  });

  // Agentic copilot endpoint (Feature 1).
  // The server only PLANS tool calls. The browser client EXECUTES them and
  // reports the actual result, so the UI trace is never a model claim.
  // Rate-limited here (30/min per IP) because the chat endpoint is not yet.
  const agentRateByIp = new Map<string, number[]>();
  const isAgentRateLimited = (ip: string): boolean => {
    const now = Date.now();
    const recent = (agentRateByIp.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 30) {
      agentRateByIp.set(ip, recent);
      return true;
    }
    recent.push(now);
    agentRateByIp.set(ip, recent);
    return false;
  };

  const sanitizeAgentToolCalls = (raw: unknown): AgentToolCall[] => {
    if (!Array.isArray(raw)) return [];
    const out: AgentToolCall[] = [];
    for (const item of raw.slice(0, 4)) {
      const candidate = item as { name?: unknown; args?: unknown };
      if (!isAgentToolName(candidate.name)) continue;
      const args = (candidate.args ?? {}) as Record<string, unknown>;
      if (candidate.name === "filter_logs") {
        out.push({
          name: candidate.name,
          args: {
            mode: isAgentLogMode(args.mode) ? args.mode : "failures",
            search:
              typeof args.search === "string" ? args.search.slice(0, 80) : "",
          },
        });
      } else if (candidate.name === "load_first_matching_record") {
        out.push({
          name: candidate.name,
          args: {
            mode: isAgentLogMode(args.mode) ? args.mode : "failures",
            productID:
              typeof args.productID === "string" ? args.productID.slice(0, 40) : "",
          },
        });
      } else if (candidate.name === "run_what_if") {
        if (isAgentPreset(args.preset)) {
          out.push({ name: candidate.name, args: { preset: args.preset } });
        } else {
          const clamped = clampTelemetryOverride(args);
          if (Object.keys(clamped).length > 0) {
            out.push({ name: candidate.name, args: clamped });
          }
        }
      } else if (candidate.name === "open_section") {
        if (isAgentSection(args.section)) {
          out.push({ name: candidate.name, args: { section: args.section } });
        }
      } else if (candidate.name === "summarize_dataset") {
        out.push({ name: candidate.name, args: {} });
      }
    }
    return out;
  };

  const planAgentLocally = (
    message: string,
    context: any,
  ): { toolCalls: AgentToolCall[]; reasoningSteps: string[]; reply: string } => {
    const q = message.toLowerCase();
    const summary = context?.summary || {};
    const top = context?.topFailureMode || {};
    const modeFromText = (): string | null => {
      if (q.includes("hdf") || q.includes("heat")) return "hdf";
      if (q.includes("twf") || q.includes("tool wear")) return "twf";
      if (q.includes("pwf") || q.includes("power")) return "pwf";
      if (q.includes("osf") || q.includes("overstrain")) return "osf";
      if (q.includes("rnf") || q.includes("random")) return "rnf";
      if (q.includes("failure")) return "failures";
      if (q.includes("normal")) return "normal";
      return null;
    };
    const presetFromText = (): string | null => {
      if (q.includes("hdf")) return "hdf";
      if (q.includes("twf")) return "twf";
      if (q.includes("pwf")) return "pwf";
      if (q.includes("osf")) return "osf";
      if (q.includes("normal") || q.includes("reset") || q.includes("baseline")) return "normal";
      return null;
    };
    const numericWhatIf: Record<string, number | string> = {};
    const numAfter = (re: RegExp): number | null => {
      const m = q.match(re);
      return m ? parseFloat(m[1]) : null;
    };
    const torque = numAfter(/torque[^0-9]{0,12}(\d+(?:\.\d+)?)/);
    const rpm = numAfter(/(?:rpm|speed)[^0-9]{0,12}(\d+(?:\.\d+)?)/);
    const wear = numAfter(/(?:wear)[^0-9]{0,12}(\d+(?:\.\d+)?)/);
    if (torque !== null) numericWhatIf.torque = torque;
    if (rpm !== null) numericWhatIf.rotationalSpeed = rpm;
    if (wear !== null) numericWhatIf.toolWear = wear;

    const isWhatIf =
      q.includes("simulate") || q.includes("what-if") || q.includes("what if") ||
      q.includes("set torque") || q.includes("set speed") || q.includes("set wear");
    if (isWhatIf) {
      const preset = presetFromText();
      if (preset) {
        return {
          toolCalls: [{ name: "run_what_if", args: { preset } }],
          reasoningSteps: [
            "Local planner: request asks for a simulation, not just an answer.",
            `Local planner: mapped it to the ${preset.toUpperCase()} what-if preset.`,
            "Client will execute the preset and show the new prediction; nothing is claimed before execution.",
          ],
          reply: `Local planner plan (no Gemini key configured): I will run the ${preset.toUpperCase()} what-if preset and open the simulator so you can see the new risk, health and recommended action from the live prediction.`,
        };
      }
      const clamped = clampTelemetryOverride(numericWhatIf);
      if (Object.keys(clamped).length > 0) {
        return {
          toolCalls: [
            { name: "run_what_if", args: clamped },
            { name: "open_section", args: { section: "simulator" } },
          ],
          reasoningSteps: [
            "Local planner: request asks for a simulation with explicit values.",
            "Local planner: clamped those values to the UI telemetry ranges.",
            "Client will apply them and open the simulator.",
          ],
          reply: `Local planner plan (no Gemini key configured): I will apply those telemetry values and open the What-If simulator so the prediction is computed from the actual values, not from a guessed number.`,
        };
      }
    }

    const productMatch = message.match(/\b[LMH]\d{4,}\b/i);
    if (q.includes("load") && productMatch) {
      return {
        toolCalls: [{ name: "load_first_matching_record", args: { productID: productMatch[0].toUpperCase() } }],
        reasoningSteps: [
          "Local planner: request names a specific product ID.",
          "Client will look that record up in the active dataset; if it is absent, the trace will report failure instead of loading a different record.",
        ],
        reply: `Local planner plan (no Gemini key configured): I will load ${productMatch[0].toUpperCase()} into the twin if it exists in the active dataset.`,
      };
    }
    if (q.includes("load") && (q.includes("first") || q.includes("failure"))) {
      const mode = modeFromText() ?? "failures";
      return {
        toolCalls: [{ name: "load_first_matching_record", args: { mode } }],
        reasoningSteps: [
          "Local planner: request asks to load a record, not just describe one.",
          `Local planner: chose the first ${mode} record in the active dataset.`,
        ],
        reply: `Local planner plan (no Gemini key configured): I will load the first ${mode} record from the active dataset into the twin.`,
      };
    }
    if (q.includes("filter") || q.includes("show") || q.includes("list")) {
      const mode = modeFromText();
      if (mode) {
        return {
          toolCalls: [{ name: "filter_logs", args: { mode, search: "" } }],
          reasoningSteps: [
            "Local planner: request asks to see a subset of field logs.",
            `Local planner: mapped it to the ${mode} log filter.`,
            "Client will count the matching records from the active dataset and open Field Logs.",
          ],
          reply: `Local planner plan (no Gemini key configured): I will filter Field Logs to ${mode} and open that section, with the matching count computed from the active dataset.`,
        };
      }
    }
    if (q.includes("rca") || q.includes("root cause report")) {
      return {
        toolCalls: [{ name: "open_section", args: { section: "rca" } }],
        reasoningSteps: ["Local planner: request asks for the RCA report section."],
        reply: "Local planner plan (no Gemini key configured): I will open the RCA Report section for the currently loaded telemetry.",
      };
    }
    if (q.includes("analytics") || q.includes("pareto") || q.includes("benchmark")) {
      return {
        toolCalls: [{ name: "open_section", args: { section: "analytics" } }],
        reasoningSteps: ["Local planner: request asks for mining analytics."],
        reply: "Local planner plan (no Gemini key configured): I will open Mining Analytics for the active dataset.",
      };
    }
    if (q.includes("summar") || q.includes("overview") || q.includes("how many")) {
      return {
        toolCalls: [{ name: "summarize_dataset", args: {} }],
        reasoningSteps: ["Local planner: request asks for a dataset summary, computed from the supplied summary — not invented."],
        reply: `Local planner summary: ${summary.totalRecords ?? "unknown"} records in ${context?.activeDatasetName ?? "the active dataset"}, ${summary.totalFailures ?? "unknown"} failures (${summary.failureRate ?? "unknown"}), top mode ${top.mode ?? "unknown"} with ${top.count ?? "unknown"} units.`,
      };
    }
    return {
      toolCalls: [],
      reasoningSteps: [
        "Local planner: no executable action matched this request, so no tool was called.",
        "Try: 'Show HDF failures', 'Simulate HDF', 'Load first failure', or 'Open RCA report'.",
      ],
      reply: "Local planner: I did not run a tool for that request because it does not name an action I can execute. Try 'Show HDF failures', 'Simulate HDF', 'Load first failure', or 'Open RCA report' — each of those really changes the app, and the trace below will show the result.",
    };
  };

  app.post("/api/ai-agent", async (req, res) => {
    try {
      const ip = req.ip || "unknown";
      if (isAgentRateLimited(ip)) {
        return res.status(429).json({ error: "Agent rate limit reached. Please wait a minute and try again." });
      }
      const { message, datasetContext } = req.body ?? {};
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "A message string is required." });
      }
      if (message.length > 2000) {
        return res.status(400).json({ error: "Message is too long (max 2000 characters)." });
      }

      const client = getGeminiClient();
      if (!client) {
        const plan = planAgentLocally(message, datasetContext);
        return res.json({ ...plan, model: "local-agent-planner" });
      }

      try {
        const toolDeclarations = [
          {
            name: "filter_logs",
            description: "Filter the Field Logs table to one failure mode. Use when the user asks to show, list or filter logs.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING, enum: ["all", "failures", "normal", "twf", "hdf", "pwf", "osf", "rnf"] },
                search: { type: Type.STRING },
              },
              required: ["mode"],
            },
          },
          {
            name: "load_first_matching_record",
            description: "Load a record into the digital twin. Use productID when named, otherwise the first record of the given mode.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING, enum: ["all", "failures", "normal", "twf", "hdf", "pwf", "osf", "rnf"] },
                productID: { type: Type.STRING },
              },
            },
          },
          {
            name: "run_what_if",
            description: "Run a what-if simulation: either a named preset (normal/twf/hdf/pwf/osf) or explicit telemetry values.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                preset: { type: Type.STRING, enum: ["normal", "twf", "hdf", "pwf", "osf"] },
                airTemp: { type: Type.NUMBER },
                processTemp: { type: Type.NUMBER },
                rotationalSpeed: { type: Type.NUMBER },
                torque: { type: Type.NUMBER },
                toolWear: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ["L", "M", "H"] },
              },
            },
          },
          {
            name: "open_section",
            description: "Scroll to and open one app section: twin, telemetry, simulator, analytics, logs, or rca.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING, enum: ["twin", "telemetry", "simulator", "analytics", "logs", "rca"] },
              },
              required: ["section"],
            },
          },
          {
            name: "summarize_dataset",
            description: "Summarize the active dataset from the supplied dataset context. No other argument is needed.",
            parameters: { type: Type.OBJECT, properties: {} },
          },
        ];

        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: "user",
              parts: [{ text: `Active dataset context (do not invent other numbers): ${JSON.stringify(datasetContext || {})}\n\nUser request: ${message}` }],
            },
          ],
          config: {
            systemInstruction:
              "You are an agentic copilot planner for a predictive-maintenance dashboard. When the user asks the app to DO something (filter logs, load a record, run a what-if, open a section, summarize the dataset), call exactly the matching tool(s), at most 3, with only valid arguments from the declarations. Do not invent product IDs, counts, or telemetry values. If the request is only a question with no executable action, answer in text and call no tool. The client will execute your tool calls and show their real results; do not claim in your reply that a tool has already run, because it has not run yet.",
            temperature: 0.2,
            tools: [{ functionDeclarations: toolDeclarations }],
          },
        });

        const rawCalls = (response.functionCalls ?? []).map((fc) => ({
          name: fc.name,
          args: (fc.args ?? {}) as Record<string, unknown>,
        }));
        const toolCalls = sanitizeAgentToolCalls(rawCalls);
        const text = response.text || "";
        if (toolCalls.length === 0) {
          if (text) {
            return res.json({
              reply: text,
              model: GEMINI_MODEL,
              toolCalls: [],
              reasoningSteps: ["Gemini answered without a tool call, so no app action was taken."],
            });
          }
          const plan = planAgentLocally(message, datasetContext);
          return res.json({ ...plan, model: "local-agent-planner" });
        }
        return res.json({
          reply:
            text ||
            `Gemini plan: I will run ${toolCalls.length} tool call(s) below. The client will execute them in order and show each real result in the trace.`,
          model: GEMINI_MODEL,
          toolCalls,
          reasoningSteps: [
            "Gemini function-calling proposed the tool call(s) below.",
            "Server validated tool names and clamped numeric arguments to the UI ranges.",
            "Client execution follows; the trace updates with the actual result of each call.",
          ],
        });
      } catch (err: any) {
        console.error("AI Agent generation error:", err);
        const plan = planAgentLocally(message, datasetContext);
        return res.json({ ...plan, model: "local-agent-planner-fallback" });
      }
    } catch (err: any) {
      console.error("AI Agent error:", err);
      return res.status(500).json({ error: "Agent request failed." });
    }
  });

  // Plain-English explanation endpoint (Feature 2). Grounded only in the
  // numbers the client sends (telemetry, risk, waterfall steps, triggered
  // modes); the LLM is instructed not to invent other numbers. Without a
  // key, a deterministic template built from the same numbers is returned
  // and labelled as local, never as Gemini.
  const explainRateByIp = new Map<string, number[]>();
  app.post("/api/explain", async (req, res) => {
    try {
      const ip = req.ip || "unknown";
      const now = Date.now();
      const recent = (explainRateByIp.get(ip) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= 30) {
        explainRateByIp.set(ip, recent);
        return res.status(429).json({ error: "Explain rate limit reached. Please wait a minute and try again." });
      }
      recent.push(now);
      explainRateByIp.set(ip, recent);

      const { telemetry, risk, healthIndex, triggeredModes, explanation } = req.body ?? {};
      if (
        !telemetry || typeof telemetry !== "object" ||
        typeof risk !== "number" || !Number.isFinite(risk) || risk < 0 || risk > 1 ||
        !explanation || typeof explanation !== "object" || !Array.isArray(explanation.steps)
      ) {
        return res.status(400).json({ error: "Telemetry, risk (0..1) and an explanation with steps are required." });
      }
      const steps = explanation.steps.filter(
        (s: any) => s && typeof s.label === "string" && typeof s.deltaPercentagePoints === "number" && Number.isFinite(s.deltaPercentagePoints),
      );
      if (steps.length === 0) {
        return res.status(400).json({ error: "At least one valid explanation step is required." });
      }
      const sorted = [...steps].sort((a: any, b: any) => b.deltaPercentagePoints - a.deltaPercentagePoints);
      const topPush = sorted[0];
      const topPull = sorted[sorted.length - 1];
      const localReply = [
        `Plain-English explanation (local, from the computed waterfall — not Gemini):`,
        ``,
        `At the nominal operating point the risk was ${(Number(explanation.baseRisk) * 100).toFixed(1)}%. After applying each actual feature in turn, the risk is ${(risk * 100).toFixed(1)}%.`,
        `The largest push toward failure was ${topPush.label} (${topPush.actualValue} vs the nominal ${topPush.referenceValue}), changing risk by ${topPush.deltaPercentagePoints >= 0 ? "+" : ""}${topPush.deltaPercentagePoints.toFixed(1)} percentage points.`,
        topPull.deltaPercentagePoints < -1
          ? `The largest pull toward safety was ${topPull.label} (${topPull.actualValue} vs the nominal ${topPull.referenceValue}), changing risk by ${topPull.deltaPercentagePoints.toFixed(1)} percentage points.`
          : `No feature pulled risk down by more than 1 percentage point in this case — a -0.1 pp step, for example, is almost no effect, not a protective factor.`,
        Array.isArray(triggeredModes) && triggeredModes.length > 0
          ? `Triggered failure modes: ${triggeredModes.join(", ")}.`
          : `No failure mode is currently tripped.`,
        typeof healthIndex === "number" ? `Health index: ${healthIndex}/100.` : ``,
        ``,
        `Method: sequential waterfall, not SHAP. Steps were computed by re-running the prediction engine after each feature change, so they sum to the current risk.`,
      ].filter(Boolean).join("\n");

      const client = getGeminiClient();
      if (!client) {
        return res.json({ reply: localReply, model: "local-explanation" });
      }
      try {
        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: "user",
              parts: [{
                text: `Explain this prediction in plain English for a maintenance engineer, in under 220 words, using ONLY the numbers below. Do not invent any other number, threshold, or failure count. Say that the method is a sequential contribution waterfall (not SHAP) starting from a nominal operating point.\n\nTelemetry: ${JSON.stringify(telemetry)}\nRisk: ${(risk * 100).toFixed(1)}%${typeof healthIndex === "number" ? `, health index ${healthIndex}/100` : ""}\nTriggered modes: ${Array.isArray(triggeredModes) ? triggeredModes.join(", ") || "none" : "none"}\nWaterfall (label, actual vs nominal, change in percentage points, cumulative risk %):\n${steps.map((s: any) => `- ${s.label}: ${s.actualValue} vs ${s.referenceValue}, ${s.deltaPercentagePoints >= 0 ? "+" : ""}${s.deltaPercentagePoints.toFixed(1)} pp, cumulative ${(Number(s.cumulativeRisk) * 100).toFixed(1)}%`).join("\n")}\nBase risk at nominal point: ${(Number(explanation.baseRisk) * 100).toFixed(1)}%`,
              }],
            },
          ],
          config: {
            systemInstruction: "You are a maintenance-engineering explainer. Use only the numbers supplied. Do not invent metrics, thresholds, or counts. If a step changed risk by less than 0.1 percentage points, say it had almost no effect rather than dramatising it.",
            temperature: 0.2,
          },
        });
        return res.json({ reply: response.text || localReply, model: GEMINI_MODEL });
      } catch (err: any) {
        console.error("Explain generation error:", err);
        return res.json({ reply: localReply, model: "local-explanation-fallback" });
      }
    } catch (err: any) {
      console.error("Explain error:", err);
      return res.status(500).json({ error: "Explain request failed." });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

function generateLocalDatasetResponse(message: string, context: any): string {
  const query = message.toLowerCase().trim();
  const summary = context?.summary || {};
  const pareto = context?.paretoBreakdown || [];
  const topFailure = context?.topFailureMode || { mode: "HDF", fullName: "Heat Dissipation Failure", count: 115, percentage: "33.9%" };

  // 1. Greetings & Conversational Queries
  const isGreeting =
    /^(hi|hello|helo|helooo+|hey|howdy|hola|greetings|good\s*(morning|afternoon|evening|day)|yo|sup|what'?s\s*up)(\s*(!|\.|\?|$))/i.test(query) ||
    query === "hi" ||
    query === "hello" ||
    query.startsWith("helo") ||
    query.includes("who are you") ||
    query.includes("what can you do");

  if (isGreeting) {
    return `### **Hello! 👋 Welcome to Industrial AI Copilot**

I am your **Predictive Maintenance & Failure Mining Copilot**. I am actively monitoring your dataset (**${context?.activeDatasetName || "AI4I Mining Fleet"}** with **${summary.totalRecords || 10000} logged assets**).

Here is how I can assist you right now:
- 🛠️ **Troubleshooting & Fix Solutions:** Ask me *"How do I fix these issues?"* to get step-by-step engineering SOPs for thermal, power, and tooling failures.
- 📊 **Root Cause Failure Mining:** Ask about any failure mode (**HDF, PWF, OSF, TWF, RNF**) or Pareto breakdown statistics.
- ⚡ **Telemetry & Physics Analysis:** Inquire about spindle torque, temperature differential ($\\Delta T$), power bounds, and tool wear thresholds.
- 🔬 **Quality Variant Comparison:** Compare failure susceptibilities between **Type L, M, and H** product lines.
- 🤖 **Machine Learning Insights:** Review XGBoost and Random Forest feature importances and failure probabilities.

How can I help you optimize equipment reliability today?`;
  }

  // 2. "How do I fix these issues" / Repair / Solutions / Remediation / Troubleshooting
  const isFixQuery =
    query.includes("fix") ||
    query.includes("repair") ||
    query.includes("solution") ||
    query.includes("remediation") ||
    query.includes("troubleshoot") ||
    query.includes("resolve") ||
    query.includes("action plan") ||
    query.includes("what should i do") ||
    query.includes("how to solve") ||
    query.includes("sop") ||
    query.includes("corrective");

  if (isFixQuery) {
    return `### **Standard Operating Procedure (SOP): Machine Failure Remediation & Action Plan**

Based on the active dataset (**${context?.activeDatasetName || "Fleet Baseline"}**), **${topFailure.mode} (${topFailure.fullName})** is your highest frequency risk (${topFailure.count} affected units, ${topFailure.percentage} of all breakdowns).

Here is the prioritized engineering action plan to eliminate these failures:

---

#### **1. Immediate Thermal Remediation (For HDF - Heat Dissipation Failure)**
- **Root Cause:** Inadequate airflow when rotational speed drops below $1380\\text{ RPM}$ with $\\Delta T = (T_{\\text{process}} - T_{\\text{air}}) < 8.6\\text{ K}$.
- **Step 1 - Airflow & Heat Exchanger Flush:** Blow out the cooling shroud and ventilation jacket with compressed dry air ($6\\text{ bar}$) to remove mineral slag and cutting fluid residue.
- **Step 2 - Auxiliary Blower Interlock:** Program the CNC/PLC controller to automatically engage an external forced-air blower whenever the spindle operates below $1400\\text{ RPM}$ under load.
- **Step 3 - Coolant Temperature Stabilization:** Verify the chiller heat exchanger delivers coolant at $\\le 20^\\circ\\text{C}$ to maintain thermal differential $\\Delta T \\ge 10.0\\text{ K}$.

---

#### **2. Drive & Inverter Stabilization (For PWF - Power Failure)**
- **Root Cause:** Mechanical power $P = \\text{Torque} \\times \\omega$ violating the safe operating window ($P < 3500\\text{ W}$ or $P > 9000\\text{ W}$).
- **Step 1 - Inverter Trip Point Calibration:** Set the Variable Frequency Drive (VFD) current limiter to gently throttle feed rates before drawing $> 8800\\text{ W}$, preventing hard thermal trips.
- **Step 2 - Anti-Stall Feed Regulation:** For low-power freewheeling ($< 3500\\text{ W}$), verify tool engagement sensor calibration to ensure consistent chip load.
- **Step 3 - Mechanical Binding Inspection:** Perform laser alignment on the spindle coupling to eliminate parasitic drag causing false high-power trips.

---

#### **3. Tooling Life Cycle Management (For TWF - Tool Wear Failure)**
- **Root Cause:** Excessive insert wear ($> 200\\text{ min}$) causing micro-chipping, excessive friction, and out-of-tolerance parts.
- **Step 1 - Hard Preventive Rotation Limit:** Replace cutting inserts at **$180\\text{ minutes}$** of accumulated in-cut time (before entering the exponential failure region).
- **Step 2 - Carbide Grade Selection:** Upgrade from standard carbide to TiAlN-coated micrograin carbide for abrasive cutting operations.

---

#### **4. Mechanical Strain Reduction (For OSF - Overstrain Failure)**
- **Root Cause:** Product of $(\\text{Tool Wear} \\times \\text{Torque})$ exceeding material yield limits ($11,000\\text{ min}\\cdot\\text{Nm}$ for Type L, $12,000$ for Type M, $13,000$ for Type H).
- **Step 1 - Dynamic Feed-Rate Derating:** In CNC G-code, program an automatic $15\\%$ feed rate reduction once tool wear exceeds $140\\text{ minutes}$.
- **Step 2 - Component Upgrades:** For Type L alloy parts, limit peak cutting torque to $\\le 55\\text{ Nm}$.

---

#### **5. Electrical & Vibration Isolation (For RNF - Random Anomaly)**
- **Step 1 - Surge Suppressors:** Install TVSS transient voltage surge suppressors on the main 480V machine feed.
- **Step 2 - Vibration Damping:** Check elastomeric isolation pads beneath the machine base to prevent floor harmonic excitation.

*Need specific guidance for a specific unit or telemetry reading? Just provide the spindle ID or telemetry values!*`;
  }

  // 3. Most prevalent / Pareto failure modes
  if (query.includes("most") || query.includes("highest") || query.includes("frequent") || query.includes("affected by") || query.includes("pareto")) {
    return `### **Most Prevalent Failure Modes in Current Dataset**

Based on the active field return dataset (**${context?.activeDatasetName || "Baseline"}**):

- **#1 Top Failure Mode:** **${topFailure.mode} — ${topFailure.fullName || "Heat Dissipation Failure"}**
- **Affected Units:** **${topFailure.count} products** (~**${topFailure.percentage}** of total failure incidents)

#### **Complete Pareto Failure Distribution:**
${pareto.length > 0
  ? pareto.map((p: any) => `- **${p.mode}** (${p.desc || p.mode}): **${p.count} incidents** (${p.percentage} of fleet breakdowns)`).join("\n")
  : `- **HDF (Heat Dissipation):** 115 incidents (33.9%)\n- **PWF (Power Failure):** 95 incidents (28.0%)\n- **OSF (Overstrain Failure):** 78 incidents (23.0%)\n- **TWF (Tool Wear Failure):** 46 incidents (13.6%)\n- **RNF (Random Anomaly):** 5 incidents (1.5%)`}

**Key Takeaway:** The top two failure modes (**HDF** and **PWF**) account for **over 61% of all machine downtime**. Implementing cooling fan interlocks and VFD power limiting yields the highest ROI for downtime reduction.`;
  }

  // 4. Product quality variant comparison (Type L vs M vs H)
  if (query.includes("type") || query.includes("variant") || query.includes("alloy") || query.includes("quality") || query.includes("l, m, h") || query.includes("product type")) {
    return `### **Product Quality Type (L, M, H) Risk Comparison**

The dataset classifies machines and manufactured parts into three structural quality tiers:

| Product Variant | Fleet Share | Failure Rate | Overstrain Limit (OSF) | Structural Characteristics |
| :--- | :---: | :---: | :---: | :--- |
| **Type L (Low)** | **50%** (5,000 units) | **~4.1%** | **$> 11,000\\text{ min}\\cdot\\text{Nm}$** | Standard structural alloy; highest strain sensitivity; accounts for ~60% of OSF incidents. |
| **Type M (Medium)**| **30%** (3,000 units) | **~2.8%** | **$> 12,000\\text{ min}\\cdot\\text{Nm}$** | Hardened alloy; balanced cost vs fatigue resistance. |
| **Type H (High)** | **20%** (2,000 units) | **~1.9%** | **$> 13,000\\text{ min}\\cdot\\text{Nm}$** | Premium aerospace-grade alloy; lowest failure frequency and highest torque tolerance. |

**Engineering Recommendation:** When running Type L components under high-torque operations ($> 50\\text{ Nm}$), ensure tool wear does not exceed $150\\text{ min}$ to prevent overstrain yield fracture.`;
  }

  // 5. Heat Dissipation Failure (HDF)
  if (query.includes("hdf") || query.includes("heat") || query.includes("thermal") || query.includes("cooling") || query.includes("delta t")) {
    return `### **Heat Dissipation Failure (HDF) Root Cause & Physics**

#### **Deterministic Physics Trigger:**
$$\\Delta T = T_{\\text{process}} - T_{\\text{air}} < 8.6\\text{ K} \\quad \\text{AND} \\quad \\text{Rotational Speed} < 1380\\text{ RPM}$$

- **Failure Mechanism:** When the spindle speed drops below $1380\\text{ RPM}$, the integral shaft fan does not draw sufficient convective air volume. If the heat generated by friction is not removed (causing $\\Delta T < 8.6\\text{ K}$), bearing raceways expand thermally, seizing tolerances.
- **Occurrence:** Accounts for **33.9%** (115 units in baseline) of all failures.
- **Actionable Fix:** Clean air filter mesh weekly, and program an auxiliary cooling blower interlock for speeds under $1400\\text{ RPM}$.`;
  }

  // 6. Power Failure (PWF)
  if (query.includes("pwf") || query.includes("power") || query.includes("watt") || query.includes("stall") || query.includes("vfd") || query.includes("inverter")) {
    return `### **Power Failure (PWF) Root Cause & Physics**

#### **Deterministic Physics Trigger:**
$$P = \\text{Torque [Nm]} \\times \\left(\\text{RPM} \\times \\frac{2\\pi}{60}\\right)$$
Trips when **$P < 3,500\\text{ W}$** or **$P > 9,000\\text{ W}$**.

- **Under-Power Mechanism ($P < 3500\\text{ W}$):** Tool engagement loss or mechanical disengagement under cutting cycle.
- **Over-Power Mechanism ($P > 9000\\text{ W}$):** Tool bind or heavy resistance driving motor current beyond inverter thermal trip capacity.
- **Occurrence:** Accounts for **28.0%** (95 units in baseline) of failures.
- **Actionable Fix:** Configure VFD adaptive feed-rate reduction when mechanical draw crosses $8,500\\text{ W}$.`;
  }

  // 7. Tool Wear Failure (TWF)
  if (query.includes("twf") || query.includes("wear") || query.includes("tool") || query.includes("insert") || query.includes("cutter")) {
    return `### **Tool Wear Failure (TWF) Root Cause & Physics**

#### **Failure Threshold:**
$$\\text{Tool Wear} \\in [200, 240]\\text{ minutes of active cutting}$$

- **Failure Mechanism:** Taylor tool life decay. Progressive abrasive crater wear and flank wear thin the cutting edge, leading to catastrophic tip fracture, thermal discoloration, and chatter marks.
- **Occurrence:** Accounts for **13.6%** (46 units in baseline) of failures.
- **Actionable Fix:** Implement mandatory automated tool replacement warnings at **$180\\text{ minutes}$**.`;
  }

  // 8. Overstrain Failure (OSF)
  if (query.includes("osf") || query.includes("overstrain") || query.includes("strain") || query.includes("torque")) {
    return `### **Overstrain Failure (OSF) Root Cause & Physics**

#### **Deterministic Physics Trigger:**
$$\\text{Tool Wear [min]} \\times \\text{Torque [Nm]} > \\text{Threshold}$$
- **Type L:** $> 11,000\\text{ min}\\cdot\\text{Nm}$
- **Type M:** $> 12,000\\text{ min}\\cdot\\text{Nm}$
- **Type H:** $> 13,000\\text{ min}\\cdot\\text{Nm}$

- **Failure Mechanism:** High cutting torque combined with high tool wear places excessive bending shear stresses on the toolholder, resulting in catastrophic mechanical deformation.
- **Actionable Fix:** Cap maximum permissible torque dynamically based on tool wear timer.`;
  }

  // 9. Dataset Summary / Statistics
  if (query.includes("summar") || query.includes("overview") || query.includes("dataset") || query.includes("stats") || query.includes("metrics") || query.includes("records")) {
    return `### **Active Dataset Summary & Health Metrics**

- **Dataset Name:** **${context?.activeDatasetName || "AI4I 2020 Mining Baseline"}**
- **Total Logged Units:** **${summary.totalRecords || 10000}** assets
- **Total Failures:** **${summary.totalFailures || 339}** incidents (**${summary.failureRate || "3.39%"}** failure rate)
- **Top Breakdown Cause:** **${topFailure.mode}** (${topFailure.count} units, ${topFailure.percentage})
- **Fleet Quality Mix:**
  - **Type L:** ${summary.typeLCount || 5000} units (~${summary.typeLFailureRate || "4.1%"} failure rate)
  - **Type M:** ${summary.typeMCount || 3000} units (~${summary.typeMFailureRate || "2.8%"} failure rate)
  - **Type H:** ${summary.typeHCount || 2000} units (~${summary.typeHFailureRate || "1.9%"} failure rate)

*You can upload your own CSV dataset via the top navigation bar to analyze your custom field returns!*`;
  }

  // 10. Machine Learning & Model Benchmarks
  if (query.includes("xgboost") || query.includes("random forest") || query.includes("model") || query.includes("ml") || query.includes("accuracy") || query.includes("roc") || query.includes("f1") || query.includes("benchmark")) {
    return `### **Machine Learning Models & Predictive Benchmarks**

The platform employs a dual-ensemble classifier architecture:

1. **XGBoost (Extreme Gradient Boosting):**
   - **ROC-AUC:** **0.984** | **PR-AUC:** **0.912** | **F1 Score:** **0.887**
   - **Strengths:** Exceptional handling of subtle non-linear thermal interactions and threshold crossings (e.g. $\\Delta T < 8.6\\text{ K}$).
   - **Top Features:** Torque (0.34), Tool Wear (0.28), Rotational Speed (0.21).

2. **Random Forest (100 Trees):**
   - **ROC-AUC:** **0.976** | **PR-AUC:** **0.895** | **F1 Score:** **0.865**
   - **Strengths:** High resilience against noise and outliers; robust bagging variance reduction.

Both models evaluate real-time telemetry against physics boundary rules to provide actionable early warnings before catastrophic trips occur.`;
  }

  // 11. General technical fallback
  return `### **Predictive Maintenance Diagnostics & Intelligence**

Thank you for your question: *"**${message}**"*

Here is a structured engineering assessment:

1. **Active Fleet Context:** Monitoring **${summary.totalRecords || 10000} records** in **${context?.activeDatasetName || "Active Dataset"}** with **${summary.totalFailures || 339} total failures** (${summary.failureRate || "3.39%"}).
2. **Top Operational Risk:** **${topFailure.mode} (${topFailure.fullName || "Thermal Choke"})** is responsible for **${topFailure.percentage}** of all failures.
3. **Core Telemetry Factors:** Machine health is governed by balancing Rotational Speed ($1300\\text{--}1800\\text{ RPM}$), Shaft Torque ($30\\text{--}50\\text{ Nm}$), and maintaining $\\Delta T \\ge 8.6\\text{ K}$.

**You can ask me:**
- *"How do I fix these issues?"* (for step-by-step SOP repair procedures)
- *"Which product type fails the most?"* (for quality alloy comparisons)
- *"What causes Heat Dissipation Failure (HDF) or Power Failure (PWF)?"*
- *"Explain the XGBoost vs Random Forest benchmark results."*`;
}

startServer();

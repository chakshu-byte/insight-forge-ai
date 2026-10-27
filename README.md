<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a8b63ad5-3d4b-484d-ad16-99429eca07ee

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key. The app defaults to `gemini-3.7-flash`; optionally set `GEMINI_MODEL` to another model available to your API key.
3. Run the app:
   `npm run dev`

## InsightForge upgrade (local branch `feature/wow-upgrade`)

All of the following are on this branch, committed locally only — nothing here
has been pushed, and `main` / `backup_latest` are untouched.

**Routes — landing first**

- `/` — **the landing page first** (React `LandingPage`, ported from
  InsightForge-Landing-REFINED.html: Obsidian + Platinum, Instrument Serif
  / Inter Tight / JetBrains Mono, hero tilt, marquee, bento, Ingest / Mine
  / Decide, "Ship the fix, not the recall."). Its "Launch dashboard"
  buttons render the dashboard in the same app, same state, same APIs.
  Hero / stats / preview numbers on the landing are **live** (active
  dataset, prediction, RUL band), not the standalone HTML's sample
  figures (2.4%, $1.8M, 12 modes, 12,400 units, Batch 7).
- Dashboard (after Launch dashboard) — same app, same backend, reskinned
  to the landing design system (`index.css` `.forge-light` / `.forge-dark`:
  Obsidian/Platinum, landing fonts, cyan/slate mapped to Obsidian/Platinum;
  semantic rose/amber/emerald risk colours kept). Header **LANDING**
  returns to the in-app landing. Default theme is light, matching the
  landing; the theme toggle switches light/dark.
- `/landing.html` — the standalone landing HTML in `public/landing.html`,
  copied to `dist/` on build, kept as a fallback. Its "Launch dashboard"
  buttons point to `/`, the real app.

**Landing page**

Refined replica of the supplied InsightForge landing design: Obsidian +
Platinum palette, Instrument Serif / Inter Tight / JetBrains Mono, hero with
3D-tilt overview panel, marquee, stats, 6-card Capabilities bento,
Ingest / Mine / Decide, "Ship the fix, not the recall.", plus a dashboard
preview section, a theme toggle (Auto / Dark / Light), a skip link, and
mobile fixes for the floating cards. All figures on the landing page are
labelled sample / illustrative.

**Features 1–10 (all working with sample data and uploaded CSVs)**

1. Agentic copilot — tool calls that really filter, load records, run
   what-ifs and open sections (`POST /api/ai-agent`, rate-limited).
2. Explainability waterfall — computed step-by-step risk contributions, not
   SHAP (`POST /api/explain`).
3. RUL band — central estimate with a heuristic band, not a calibrated CI.
4. Safe envelope — changes that actually bring risk below 50% with no mode
   tripped, with Apply buttons for the simulator.
5. Multi-agent 8D RCA — Diagnostician, Reliability Engineer, Cost Analyst,
   Reviewer, with real-row citations and a downloadable 8D PDF.
6. Dependency graph — sensors → physics → failure modes, labelled as
   dependency, not causal inference.
7. Drift / anomaly — active dataset vs the 12-row baseline, shifts in SDs.
8. Trust card — confusion matrix computed from the active dataset, contrasted
   with the hardcoded leaderboard; not a held-out test.
9. Downtime economics — formula only until the user enters their own rate;
   planned / unplanned hours are editable labelled assumptions.
10. Natural-language dataset query — deterministic local parser
    (e.g. "how many HDF failures?", "average torque for HDF").

**Part 1 UI**

Command Center overview (live risk, health, RUL band, triggered modes, jump
buttons), Judge Mode 60-second brief, a lazy-loaded 3D twin (2D SVG twin
stays default), dependency-free UI primitives, and a layout / accessibility /
performance pass (main chunk ~1.42 MB → ~0.63 MB, lazy analytics / RCA /
3D chunks).

**Honesty notes (read before presenting)**

- The XGBoost / Random Forest labels in the original app are a rule-based
  simulation in `src/utils/mlEngine.ts`, not a trained model, and the
  leaderboard benchmarks are hardcoded. The new waterfall, RUL band and trust
  card are labelled accordingly in the UI.
- Gemini paths (`/api/ai-agent`, `/api/explain`) compile but were not
  live-tested with a key in this environment. Without a key they degrade
  gracefully to labelled local engines. A Gemini key stays server-side in
  `.env` only — never in the repo or in chat.
- Visual QA so far is lint / type-check / build plus engine checks; no
  live-browser screenshots were taken in this environment.

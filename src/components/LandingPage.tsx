import React, { useEffect, useRef } from 'react';
import type { DatasetSummary } from '../utils/csvParser';
import type { PredictionResult, TelemetryState } from '../types';
import { computeRulForecast } from '../utils/mlEngine';
// Landing CSS is NOT imported globally here on purpose. The landing's
// h1/h2 rules (clamp 46–96px) leaked into the dashboard Header and made
// it half the screen tall. Instead the CSS is injected only while this
// component is mounted, and removed on unmount (see useEffect below),
// so the dashboard can never inherit landing hero sizes.
import landingCss from '../landing.css?raw';

/**
 * LandingPage — the first screen at `/`, ported from
 * InsightForge-Landing-REFINED.html (the design the user attached).
 *
 * Structure, copy, palette, fonts and animations follow that HTML:
 * nav, hero with 3D-tilt panel, marquee, stats, Capabilities bento,
 * Ingest / Mine / Decide, dashboard preview, "Ship the fix, not the recall."
 *
 * The ONE intentional difference from the standalone HTML: numbers that
 * can come from the live app do. The standalone HTML used sample figures
 * (return rate 2.4%, $1.8M at risk, 12 modes, 12,400 units, Batch 7).
 * Here the hero panel, stats and preview use the active dataset /
 * prediction, labelled "Live". Everything else keeps the landing copy.
 * If the user wants the sample figures back, that is a one-line change
 * in this file, not a redesign.
 */

interface LandingPageProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onLaunchDashboard: () => void;
  telemetry: TelemetryState;
  prediction: PredictionResult;
  datasetSummary: DatasetSummary;
  activeDatasetName: string;
}

const MARQUEE = ['Solder crack', 'Battery swell', 'Connector wear', 'Firmware hang', 'Water ingress', 'Display flicker', 'Hinge fatigue', 'Charging port', 'Sensor drift'];

const ICONS: Record<string, string> = {
  mine: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M8.5 11h5M11 8.5v5"/>',
  alert: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0"/>',
  radar: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>',
  brain: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  ar: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

const iconSvg = (name: string, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

const BENTO: Array<{ title: string; text: string; span: number; icon: string }> = [
  { title: 'Failure mining', text: 'Cluster raw return notes into named failure modes, automatically.', span: 4, icon: 'mine' },
  { title: 'Predictive alerts', text: 'Catch rising failure curves before they become a recall.', span: 2, icon: 'alert' },
  { title: 'Blast radius', text: 'Every unit in the field that shares the same root cause.', span: 2, icon: 'radar' },
  { title: 'Root-cause AI', text: 'Plain-language causes, with evidence you can trace.', span: 2, icon: 'brain' },
  { title: 'Cost impact', text: 'Warranty exposure by mode, model and lot.', span: 2, icon: 'coin' },
  { title: 'Executive briefing', text: 'One-page summaries for the people who sign off.', span: 6, icon: 'doc' },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  theme,
  onThemeChange,
  onLaunchDashboard,
  telemetry,
  prediction,
  datasetSummary,
  activeDatasetName,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Open-at-top: landing must start at the hero, never mid-page
  // (browser scroll restoration on reload, or a previous dashboard
  // scroll position). App also sets scrollRestoration='manual'.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const heroRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const prRef = useRef<HTMLDivElement>(null);

  const rul = computeRulForecast(telemetry, prediction.machineFailureProbability, prediction.estimatedRULHours);
  const riskPct = prediction.machineFailureProbability * 100;
  const liveModes = datasetSummary.paretoBreakdown.filter((p) => p.count > 0).length;
  const failureRateNum = parseFloat(datasetSummary.failureRate) || 0;
  const heroBars = datasetSummary.paretoBreakdown.slice(0, 7).map((p) => {
    const max = Math.max(1, ...datasetSummary.paretoBreakdown.map((q) => q.count));
    return Math.max(12, Math.round((p.count / max) * 90));
  });
  while (heroBars.length < 7) heroBars.push(12);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      (el as HTMLElement).style.scrollMarginTop = '80px';
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Inject landing CSS only while the landing is mounted.
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.forgeLanding = 'true';
    style.textContent = landingCss;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Scroll reveals, progress bar, nav shadow — same behaviour as the HTML.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }),
      { threshold: 0.2 },
    );
    root.querySelectorAll('.rv').forEach((e) => io.observe(e));
    const onScroll = () => {
      const h = document.documentElement;
      if (prRef.current) prRef.current.style.transform = `scaleX(${window.scrollY / Math.max(1, h.scrollHeight - window.innerHeight)})`;
      navRef.current?.classList.toggle('s', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  // Hero spotlight + card glow + 3D tilt (idle drift included, as in the HTML).
  useEffect(() => {
    const hero = heroRef.current;
    const tilt = tiltRef.current;
    if (!hero || !tilt) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lm = 0;
    let nx = 0;
    let ny = 0;
    let rx = 8;
    let ry = -14;
    let visible = true;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      lm = performance.now();
      nx = e.clientX / window.innerWidth - 0.5;
      ny = e.clientY / window.innerHeight - 0.5;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--cx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--cy', `${e.clientY - r.top}px`);
      const c = (e.target as HTMLElement | null)?.closest?.('.bc') as HTMLElement | null;
      if (c) {
        const b = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${e.clientX - b.left}px`);
        c.style.setProperty('--my', `${e.clientY - b.top}px`);
      }
    };
    window.addEventListener('pointermove', onMove);
    const visIo = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
    visIo.observe(hero);
    if (!reduced) {
      const tick = (t: number) => {
        if (visible) {
          const idle = performance.now() - lm > 2500;
          const ty = idle ? Math.sin(t / 2200) * 12 - 8 : nx * 28;
          const tx = idle ? 8 + Math.cos(t / 2800) * 4 : 8 - ny * 20;
          ry += (ty - ry) * 0.06;
          rx += (tx - rx) * 0.06;
          tilt.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => { window.removeEventListener('pointermove', onMove); visIo.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const headlineWords = 'Find the failure before it'.split(' ');

  return (
    <div ref={rootRef} data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--tx)' }}>
      <a className="skip" href="#hero">Skip to content</a>
      <div id="pr" ref={prRef} />
      <header className="nav" ref={navRef}>
        <div className="wrap nv">
          <div className="lg">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 2l9 10-9 10L3 12z" /><path d="M12 2v20M3 12h18" opacity=".45" /></svg>
            InsightForge<small>AI</small>
          </div>
          <nav className="nl" aria-label="Page">
            <button className="tl" type="button" onClick={() => scrollToId('features')}>Features</button>
            <button className="tl" type="button" onClick={() => scrollToId('how')}>How it works</button>
            <button className="tl" type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button className="btn" type="button" onClick={onLaunchDashboard}>
              Launch dashboard<i dangerouslySetInnerHTML={{ __html: iconSvg('ar', 18) }} />
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="hero" ref={heroRef}>
          <div className="gb" />
          <div className="wrap hg">
            <div>
              <span className="eb m"><i />Predictive maintenance</span>
              <h1>
                {headlineWords.map((w, i) => (
                  <span className="w" key={w + i}><span style={{ ['--i' as string]: i }}>{w}</span></span>
                ))}{' '}
                <em>ships.</em>
              </h1>
              <p className="lead">InsightForge AI mines field returns, names the failure modes behind them, and shows exactly how far each one reaches.</p>
              <div className="cta-r">
                <button className="btn" type="button" onClick={onLaunchDashboard}>
                  Launch dashboard<i dangerouslySetInnerHTML={{ __html: iconSvg('ar', 18) }} />
                </button>
                <button className="btn gh" type="button" onClick={() => scrollToId('how')}>See how it works</button>
              </div>
            </div>
            <div className="pf">
              <div className="tilt" ref={tiltRef}>
                <div className="panel">
                  <div className="pt"><i /><i /><i /><span className="m">insightforge / overview · Live</span></div>
                  <div className="kp">
                    <div><span className="m">Return rate</span><b>{failureRateNum.toFixed(1)}%</b></div>
                    <div><span className="m">Units flagged</span><b>{datasetSummary.totalFailures}</b></div>
                    <div><span className="m">Modes</span><b>{liveModes}</b></div>
                  </div>
                  <div className="ch">
                    {heroBars.map((h, i) => (
                      <div className="b" key={i} style={{ ['--h' as string]: `${h}%`, ['--i' as string]: i }} />
                    ))}
                    <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true"><path className="dl" d="M10 90C60 50 90 30 130 22S200 10 290 6" fill="none" stroke="var(--hd)" strokeWidth="1.6" /></svg>
                  </div>
                </div>
                <div className="fc c1"><span className="m">Anomaly</span><b>{datasetSummary.topFailureMode.fullName}</b></div>
                <div className="fc c2"><span className="m">Blast radius</span><b>{datasetSummary.totalFailures} units flagged · {activeDatasetName}</b></div>
              </div>
            </div>
          </div>
        </section>

        <div className="mq" aria-hidden="true"><div className="mt m">{[...MARQUEE, ...MARQUEE].map((s, i) => (<span key={i}>{s}</span>))}</div></div>

        <section className="sec"><div className="wrap">
          <div className="sts" id="sts">
            <div className="rv" style={{ ['--i' as string]: 0 }}><b>{liveModes}</b><span className="m">Failure modes in active dataset</span></div>
            <div className="rv" style={{ ['--i' as string]: 1 }}><b>3</b><span className="m">Predictive signals</span></div>
            <div className="rv" style={{ ['--i' as string]: 2 }}><b>{datasetSummary.totalFailures}</b><span className="m">Units flagged</span></div>
            <div className="rv" style={{ ['--i' as string]: 3 }}><b>1</b><span className="m">Click to a briefing</span></div>
          </div>
          <p className="m fn">Live figures from the active dataset: {activeDatasetName} · {datasetSummary.totalRecords} rows. Current machine risk {riskPct.toFixed(1)}% · RUL band {rul.lowHours}–{rul.highHours} h.</p>
        </div></section>

        <section className="sec" id="features"><div className="wrap">
          <span className="m rv">Capabilities</span>
          <h2 className="rv" style={{ ['--i' as string]: 1 }}>Everything between a return and a root cause.</h2>
          <div className="bn">
            {BENTO.map((c, i) => (
              <article className="bc rv" key={c.title} style={{ ['--s' as string]: c.span, ['--i' as string]: i % 3 }}>
                <div className="ib" dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 22) }} />
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                {i === 0 && (
                  <div className="mv" aria-hidden="true">{[100, 72, 54, 40, 30, 22, 14].map((h, k) => (<i className="b2" key={k} style={{ ['--h' as string]: `${h}%`, ['--i' as string]: k }} />))}</div>
                )}
                {i === 1 && (
                  <svg className="sp" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true"><path className="dp" d="M0 60C30 58 50 50 80 40S130 30 150 14 190 4 200 2" fill="none" stroke="var(--hd)" strokeWidth="2" /></svg>
                )}
              </article>
            ))}
          </div>
        </div></section>

        <section className="sec" id="how"><div className="wrap">
          <span className="m rv">How it works</span>
          <h2 className="rv" style={{ ['--i' as string]: 1 }}>Three steps from raw returns to a decision.</h2>
          <div className="hw rv" style={{ ['--i' as string]: 2 }}><div className="hl"><i /></div>
            <div><div className="sn">01</div><h3>Ingest</h3><p>Bring in field returns and service notes exactly as they arrive.</p></div>
            <div><div className="sn">02</div><h3>Mine</h3><p>AI clusters the noise into named failure modes and traces likely causes.</p></div>
            <div><div className="sn">03</div><h3>Decide</h3><p>Rank by cost and blast radius, then brief the team in one page.</p></div>
          </div>
        </div></section>

        <section className="sec" id="dashboard"><div className="wrap">
          <span className="m rv">Dashboard preview</span>
          <h2 className="rv" style={{ ['--i' as string]: 1 }}>The overview, without leaving this page.</h2>
          <p className="rv" style={{ ['--i' as string]: 2, maxWidth: '560px', color: 'var(--mu)' }}>
            This preview is live, not sample data: it reads the same prediction, RUL band and dataset summary as the dashboard below. The full dashboard adds the simulator, waterfall, dependency graph, safe envelope and 8D report.
          </p>
          <div className="sts" style={{ marginTop: '36px' }}>
            <div className="rv" style={{ ['--i' as string]: 0 }}><b>{datasetSummary.failureRate}</b><span className="m">Return rate, active dataset</span></div>
            <div className="rv" style={{ ['--i' as string]: 1 }}><b>{datasetSummary.totalFailures}</b><span className="m">Units flagged</span></div>
            <div className="rv" style={{ ['--i' as string]: 2 }}><b>{rul.lowHours}–{rul.highHours} h</b><span className="m">RUL band, current machine</span></div>
            <div className="rv" style={{ ['--i' as string]: 3 }}><b>{datasetSummary.topFailureMode.mode}</b><span className="m">Top mode · {datasetSummary.topFailureMode.count} rows</span></div>
          </div>
          <div className="bn" style={{ marginTop: '36px' }}>
            <article className="bc rv" style={{ ['--s' as string]: 3, ['--i' as string]: 0 }}>
              <div className="ib" dangerouslySetInnerHTML={{ __html: iconSvg('alert', 22) }} />
              <h3>{datasetSummary.topFailureMode.fullName}</h3>
              <p>Top mode in the active dataset. In the dashboard, this opens the trace, the blast radius, and the fix.</p>
            </article>
            <article className="bc rv" style={{ ['--s' as string]: 3, ['--i' as string]: 1 }}>
              <div className="ib" dangerouslySetInnerHTML={{ __html: iconSvg('radar', 22) }} />
              <h3>Blast radius</h3>
              <p>{datasetSummary.totalFailures} flagged rows in {datasetSummary.totalRecords}. Batch, model and lot are what size the recall — or avoid it.</p>
            </article>
          </div>
          <div className="cta-r">
            <button className="btn" type="button" onClick={onLaunchDashboard}>Open dashboard<i dangerouslySetInnerHTML={{ __html: iconSvg('ar', 18) }} /></button>
            <button className="btn gh" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</button>
          </div>
        </div></section>

        <section className="sec" style={{ paddingTop: '20px' }}><div className="wrap">
          <div className="cta rv"><span className="m">Ready when you are</span><h2>Ship the fix, not the recall.</h2><button className="btn" type="button" onClick={onLaunchDashboard}>Launch dashboard<i dangerouslySetInnerHTML={{ __html: iconSvg('ar', 18) }} /></button></div>
          <footer className="ft"><span>InsightForge AI</span><span className="m">Live data from the active dataset · Backend: same app, same APIs</span></footer>
        </div></section>
      </main>
    </div>
  );
};

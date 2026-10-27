import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

interface ScrollBackgroundProps {
  rotationalSpeed?: number;
  torque?: number;
  isMachineFailure?: boolean;
}

export const ScrollBackground: React.FC<ScrollBackgroundProps> = ({
  rotationalSpeed = 1500,
  torque = 40,
  isMachineFailure = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { scrollYProgress } = useScroll();

  // Smooth springs for scroll-linked visual transformations
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const gridRotateX = useTransform(smoothProgress, [0, 1], [55, 75]);
  const gridTranslateY = useTransform(smoothProgress, [0, 1], [0, 150]);
  const ringRotate = useTransform(smoothProgress, [0, 1], [0, 360]);
  const ringScale = useTransform(smoothProgress, [0, 0.5, 1], [1, 1.25, 0.95]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const particleCount = 65;
    interface Particle {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
    }

    const particles: Particle[] = [];
    const colors = isMachineFailure
      ? ['#ef4444', '#f97316', '#dc2626']
      : ['#06b6d4', '#0284c7', '#38bdf8', '#10b981'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 800 + 100,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.6 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Speed boost based on simulated machine speed
      const speedMultiplier = (rotationalSpeed / 1500) * (torque / 40);

      // Draw subtle telemetry node connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (isMachineFailure ? 0.9 : 0.6);
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isMachineFailure ? '#ef4444' : '#0ea5e9';
            ctx.globalAlpha = (1 - dist / 110) * 0.15;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [rotationalSpeed, torque, isMachineFailure]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#06080d]">
      {/* Dynamic Animated Canvas for Particles & Constellations */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-70" />

      {/* Isometric Cybernetic CAD Grid with Scroll Transformation */}
      <motion.div
        style={{
          rotateX: gridRotateX,
          translateY: gridTranslateY,
          perspective: 1000,
        }}
        className="absolute inset-0 w-full h-[160%] -top-[30%] opacity-20 origin-center"
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(6, 182, 212, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, #000 60%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, #000 60%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* Floating Animated Geometric Gyroscope / Technical Reticle */}
      <motion.div
        style={{
          rotate: ringRotate,
          scale: ringScale,
        }}
        className="absolute -right-32 top-24 w-96 h-96 rounded-full border border-cyan-500/10 opacity-30 flex items-center justify-center pointer-events-none"
      >
        <div className="w-80 h-80 rounded-full border border-dashed border-cyan-400/20 animate-spin" style={{ animationDuration: '60s' }} />
        <div className="w-60 h-60 rounded-full border border-cyan-500/15" />
        <div className="absolute top-0 bottom-0 w-px bg-cyan-500/10" />
        <div className="absolute left-0 right-0 h-px bg-cyan-500/10" />
        {/* Cardinal tick marks */}
        <span className="absolute top-2 text-[9px] font-mono text-cyan-400/40">000° RAD</span>
        <span className="absolute bottom-2 text-[9px] font-mono text-cyan-400/40">180° RAD</span>
      </motion.div>

      {/* Secondary Left Gyroscope with Counter-rotation */}
      <motion.div
        style={{
          rotate: useTransform(smoothProgress, [0, 1], [360, 0]),
        }}
        className="absolute -left-48 bottom-32 w-[32rem] h-[32rem] rounded-full border border-slate-800/40 opacity-20 pointer-events-none"
      >
        <div className="w-full h-full rounded-full border-2 border-dashed border-slate-700/20 animate-spin" style={{ animationDuration: '90s', animationDirection: 'reverse' }} />
      </motion.div>

      {/* Top Ambient Glow Orb */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none transition-colors duration-700 ${
          isMachineFailure
            ? 'bg-rose-600/20'
            : 'bg-gradient-to-b from-cyan-600/15 via-sky-600/10 to-transparent'
        }`}
      />

      {/* Scanline Texture Overlay */}
      <div className="absolute inset-0 scanline-effect opacity-40 pointer-events-none" />
    </div>
  );
};

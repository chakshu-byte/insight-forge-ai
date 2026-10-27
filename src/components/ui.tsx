import React from 'react';

/**
 * UI primitives — now in the landing language (forge.css), not cyan.
 * Primary = landing .btn (pill, Obsidian/Platinum, shine sweep).
 * Ghost = landing .btn.gh (border, no shine). Outline = soft accent.
 * Badge = landing mono label (JetBrains Mono, uppercase, muted).
 * No logic changes: same props, same callers.
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
}

export const UiButton: React.FC<ButtonProps> = ({ variant = 'primary', className = '', children, ...props }) => {
  const variants: Record<string, string> = {
    primary: 'forge-btn forge-btn-sm',
    ghost: 'forge-btn forge-btn-sm forge-btn-ghost',
    outline: 'forge-btn forge-btn-sm forge-btn-ghost',
  };
  return (
    <button type="button" className={`${variants[variant]} ${className}`} {...props}>
      <span>{children}</span>
      <span className="forge-btn-arrow">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </button>
  );
};

export const UiCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`forge-card p-3 ${className}`} {...props} />
);

export const UiBadge: React.FC<{ tone?: 'cyan' | 'rose' | 'amber' | 'emerald' | 'violet'; children: React.ReactNode }> = ({ tone = 'cyan', children }) => {
  const tones: Record<string, string> = {
    cyan: 'border-current',
    rose: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
    amber: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
    emerald: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
    violet: 'text-violet-500 border-violet-500/30 bg-violet-500/10',
  };
  return (
    <span className={`forge-label inline-block px-2 py-0.5 rounded border ${tones[tone]}`} style={{ fontSize: 10 }}>
      {children}
    </span>
  );
};

/*
 * Small shared primitives: ProgressBar, Stars, StatRow, Glass, Pill, Divider.
 */
import { Star } from 'lucide-react';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import s from './Bits.module.css';

/* ── ProgressBar ─────────────────────────────────────────────── */

interface ProgressProps {
  /** 0..1 */
  value: number;
  tone?: 'red' | 'xp' | 'green' | 'gold' | 'white';
  height?: number;
  /** pulsing spark at the leading edge */
  spark?: boolean;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, tone = 'red', height = 6, spark, className, label }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={[s.track, className].filter(Boolean).join(' ')}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={[s.fill, s[`tone_${tone}`]].join(' ')} style={{ width: `${pct}%` }}>
        {spark && pct > 0 && <span className={s.spark} />}
      </div>
    </div>
  );
}

/* ── Stars (difficulty) ──────────────────────────────────────── */

export function Stars({ value, max = 5, size = 15, className }: { value: number; max?: number; size?: number; className?: string }) {
  return (
    <span className={[s.stars, className].filter(Boolean).join(' ')} role="img" aria-label={`Difficulty ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.5}
          className={i < value ? s.starOn : s.starOff}
          fill={i < value ? 'currentColor' : 'transparent'}
        />
      ))}
    </span>
  );
}

/* ── StatRow ("28 Games · 18 Wins · 64% Win Rate · #352 Rank") ─ */

export interface Stat {
  value: ReactNode;
  label: string;
  accent?: boolean;
}

export function StatRow({ stats, className, compact }: { stats: Stat[]; className?: string; compact?: boolean }) {
  return (
    <dl className={[s.statRow, compact && s.statCompact, className].filter(Boolean).join(' ')}>
      {stats.map((st) => (
        <div key={st.label} className={s.stat}>
          <dt className={s.statLabel}>{st.label}</dt>
          <dd className={[s.statValue, st.accent && s.statAccent].filter(Boolean).join(' ')}>{st.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Glass panel ─────────────────────────────────────────────── */

type GlassProps<T extends ElementType> = {
  as?: T;
  glow?: boolean;
  pad?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'style'>;

export function Glass<T extends ElementType = 'div'>({ as, glow, pad, className, style, children, ...rest }: GlassProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag
      className={['glass', glow && 'neon-border', className].filter(Boolean).join(' ')}
      style={{ padding: pad, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── Pill / chip ─────────────────────────────────────────────── */

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'red' | 'green' | 'amber' | 'gold';
  className?: string;
}) {
  return <span className={[s.pill, s[`pill_${tone}`], className].filter(Boolean).join(' ')}>{children}</span>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={[s.divider, className].filter(Boolean).join(' ')} />;
}

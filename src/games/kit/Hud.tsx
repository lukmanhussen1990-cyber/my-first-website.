/*
 * Shared HUD pieces for the mini-games: a glass stat strip, life pips, a
 * phase banner ("MEMORISE · 3", "WATCH", "REPEAT") and a typewriter line.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from './hooks';
import s from './Hud.module.css';

export function Hud({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[s.hud, className].filter(Boolean).join(' ')}>{children}</div>;
}

interface StatProps {
  label: string;
  value: ReactNode;
  /** denominator, rendered as " / 6" */
  of?: ReactNode;
  /** unit suffix, rendered small after the value */
  unit?: string;
  tone?: 'default' | 'red' | 'green' | 'dim';
  /** accessible text when the visual is not self-explanatory */
  aria?: string;
}

export function HudStat({ label, value, of, unit, tone = 'default', aria }: StatProps) {
  return (
    <div className={s.stat} aria-label={aria}>
      <span className={s.label}>{label}</span>
      <span className={[s.value, s[`tone_${tone}`]].join(' ')}>
        {value}
        {unit && <small className={s.unit}>{unit}</small>}
        {of !== undefined && <small className={s.of}> / {of}</small>}
      </span>
    </div>
  );
}

/** Lives as small crimson pips; spent lives show as hollow sockets. */
export function Pips({ total, left, label = 'Lives' }: { total: number; left: number; label?: string }) {
  return (
    <div className={s.stat} role="img" aria-label={`${label}: ${Math.max(0, left)} of ${total}`}>
      <span className={s.label}>{label}</span>
      <span className={s.pips}>
        {Array.from({ length: Math.max(1, total) }, (_, i) => (
          <span key={i} className={[s.pip, i < left ? s.pipOn : s.pipOff].join(' ')} />
        ))}
        {total === 0 && <span className={s.noLives}>NONE</span>}
      </span>
    </div>
  );
}

export type PhaseTone = 'red' | 'white' | 'green' | 'blue' | 'dim';

/** Central status line under the HUD. Announced politely to screen readers. */
export function Phase({ children, tone = 'white', icon }: { children: ReactNode; tone?: PhaseTone; icon?: ReactNode }) {
  return (
    <div className={[s.phase, s[`phase_${tone}`]].join(' ')} role="status" aria-live="polite">
      {icon ?? <span className={s.dot} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

/**
 * Typewriter text in the mono face. Key it by `text` to restart. Freezes while
 * `paused`; renders instantly when motion is reduced. Screen readers get the
 * full text at once.
 */
export function Typed({
  text,
  cps = 40,
  paused = false,
  className,
  caret = true,
}: {
  text: string;
  cps?: number;
  paused?: boolean;
  className?: string;
  caret?: boolean;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const shown = reduce ? text.length : n;
  const typing = shown < text.length;

  useEffect(() => {
    if (reduce || paused || n >= text.length) return;
    const step = Math.max(1, Math.round(cps / 30));
    const id = window.setTimeout(() => setN((v) => Math.min(text.length, v + step)), (1000 / cps) * step);
    return () => window.clearTimeout(id);
  }, [n, text, cps, paused, reduce]);

  return (
    <span className={[s.typed, className].filter(Boolean).join(' ')}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, shown)}
        {caret && <span className={[s.caret, !typing && s.caretIdle].filter(Boolean).join(' ')} />}
      </span>
    </span>
  );
}

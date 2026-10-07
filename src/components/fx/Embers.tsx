/*
 * Drifting embers — a handful of glowing crimson sparks rising through the
 * frame. Pure CSS: each ember is a full-height "lane" translated upwards (so
 * percentages resolve against the container height) with a swaying core.
 * Only transform and opacity animate. Hidden when reduced motion is on.
 */
import { useMemo, type CSSProperties } from 'react';
import { useSettings } from '../../state/settings';
import s from './Embers.module.css';

interface Props {
  /** number of embers (default 12) */
  count?: number;
  /** how far up the frame they rise before burning out, 0..1 (default 0.6) */
  rise?: number;
  /** layout seed so each screen gets its own stable pattern */
  seed?: number;
  className?: string;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Embers({ count = 12, rise = 0.6, seed = 7, className }: Props) {
  const reduceMotion = useSettings((st) => st.reduceMotion);

  const embers = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => {
      const dur = 7 + r() * 7;
      const reach = rise * (0.55 + r() * 0.45);
      return {
        key: i,
        hot: r() < 0.3,
        style: {
          left: `${4 + r() * 92}%`,
          '--size': `${(1.6 + r() * 2.6).toFixed(2)}px`,
          '--dur': `${dur.toFixed(2)}s`,
          '--delay': `${(-r() * dur).toFixed(2)}s`,
          '--y0': `${(96 + r() * 8).toFixed(1)}%`,
          '--y1': `${(100 - reach * 100).toFixed(1)}%`,
          '--sway': `${(8 + r() * 22).toFixed(1)}px`,
          '--sway-dur': `${(2.2 + r() * 2.6).toFixed(2)}s`,
          '--peak': (0.55 + r() * 0.45).toFixed(2),
        } as CSSProperties,
      };
    });
  }, [count, rise, seed]);

  if (reduceMotion) return null;

  return (
    <div className={[s.embers, className].filter(Boolean).join(' ')} aria-hidden>
      {embers.map((e) => (
        <span key={e.key} className={s.lane} style={e.style}>
          <span className={[s.ember, e.hot && s.hot].filter(Boolean).join(' ')} />
        </span>
      ))}
    </div>
  );
}

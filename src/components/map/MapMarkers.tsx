import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { useAnchor } from './camera';
import s from './MapMarkers.module.css';

/* ── Player position ───────────────────────────────────────────────── */

/** Static dot (legend) — the same visual as the live marker without the halo. */
export function PlayerDot({ className }: { className?: string }) {
  return (
    <span className={[s.playerStatic, className].filter(Boolean).join(' ')} aria-hidden>
      <span className={s.ring} />
      <span className={s.dot} />
    </span>
  );
}

/** Pulsing crimson dot with a soft radius at the player's current zone. */
export function PlayerMarker({ x: xPct, y: yPct }: { x: number; y: number }) {
  const { x, y } = useAnchor(xPct, yPct);
  return (
    <motion.div className={s.anchor} style={{ x, y, zIndex: 1 }} aria-hidden>
      <span className={s.radius} />
      <span className={s.ring} />
      <span className={[s.ring, s.ringLate].join(' ')} />
      <span className={s.dot} />
    </motion.div>
  );
}

/* ── Unknown signal (a hidden zone a scan would reveal) ────────────── */

export function SignalGlyph({ className, live }: { className?: string; live?: boolean }) {
  return (
    <span className={[s.signal, live && s.signalLive, className].filter(Boolean).join(' ')} aria-hidden>
      <span className={s.signalRing} />
      <span className={s.signalQ} data-text="?">
        ?
      </span>
    </span>
  );
}

export function SignalMarker({ x: xPct, y: yPct, index }: { x: number; y: number; index: number }) {
  const { x, y } = useAnchor(xPct, yPct);
  return (
    <motion.div className={s.anchor} style={{ x, y, zIndex: 2 }} aria-hidden>
      <span className={s.signalWrap} style={{ '--d': `${index * 1.3}s` } as CSSProperties}>
        <SignalGlyph live />
      </span>
    </motion.div>
  );
}

/* ── Radar sweep (SCAN) ────────────────────────────────────────────── */

/**
 * One-shot radar pulse from the player marker: a rotating sweep inside a
 * ranged disk plus shock rings that run out past the screen edges.
 * `reach` is the ring radius in px (distance to the farthest viewport corner).
 */
export function RadarSweep({ x: xPct, y: yPct, reach }: { x: number; y: number; reach: number }) {
  const { x, y } = useAnchor(xPct, yPct);
  return (
    <motion.div className={s.anchor} style={{ x, y, zIndex: 3 }} aria-hidden>
      <span className={s.sweep} style={{ '--reach': `${Math.ceil(reach)}px` } as CSSProperties}>
        <span className={s.disk}>
          <span className={s.wedge} />
        </span>
        <span className={s.shock} />
        <span className={[s.shock, s.shock2].join(' ')} />
        <span className={[s.shock, s.shock3].join(' ')} />
        <span className={s.flash} />
      </span>
    </motion.div>
  );
}

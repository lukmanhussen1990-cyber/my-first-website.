import type { RefObject } from 'react';
import s from './HeaderVeil.module.css';

/** Zero-height marker for `useScrolledPast` — the first child of the screen content. */
export function ScrollSentinel({ sentinelRef }: { sentinelRef: RefObject<HTMLSpanElement | null> }) {
  return <span ref={sentinelRef} className={s.sentinel} aria-hidden />;
}

/**
 * Frosted backing for a transparent TopBar, shown while content scrolls
 * beneath it so text slides under glass instead of being sliced by the edge.
 * Place it inside the Screen `header` slot next to the TopBar.
 */
export function HeaderVeil({ show }: { show: boolean }) {
  return <span className={[s.veil, show && s.show].filter(Boolean).join(' ')} aria-hidden />;
}

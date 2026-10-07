import { useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a screen's content has scrolled under its (transparent)
 * header. Render `<ScrollSentinel sentinelRef={sentinelRef} />` as the first
 * child of the screen content: once it leaves the scroll area, `past` is true.
 */
export function useScrolledPast() {
  const sentinelRef = useRef<HTMLSpanElement | null>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    const root = el?.parentElement;
    if (!el || !root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), { root });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { sentinelRef, past };
}

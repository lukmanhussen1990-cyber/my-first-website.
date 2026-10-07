import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Zone } from '../../data/types';
import { useSettings } from '../../state/settings';
import { useAnchor } from './camera';
import { PIN_LABEL, type LabelSide, type PinKind } from './mapModel';
import { PinMarker } from './PinMarker';
import s from './ZonePin.module.css';

interface Props {
  zone: Zone;
  kind: PinKind;
  side: LabelSide;
  /** label folded away to avoid a collision — marker only (label shows on focus / hover / selection) */
  folded?: boolean;
  /** stagger index for the entrance */
  index: number;
  /** the player's current location */
  here?: boolean;
  /** just revealed by a scan — glitch in (read at mount) */
  fresh?: boolean;
  selected?: boolean;
  onOpen: (zone: Zone) => void;
  /** reports the label chip width so labels can be laid out without overlaps */
  onMeasure: (id: string, width: number) => void;
}

/**
 * A zone pin anchored to the art: marker + stem over the exact map point and
 * a label chip to one side. Lives in the unscaled plot layer, so it keeps a
 * constant on-screen size at every zoom level.
 */
export function ZonePin({ zone, kind, side, folded, index, here, fresh, selected, onOpen, onMeasure }: Props) {
  const { x, y } = useAnchor(zone.x, zone.y);
  const chip = useRef<HTMLSpanElement>(null);
  // the entrance is decided once, at mount — swapping it later would replay the animation
  const [glitchIn] = useState(!!fresh);

  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (alive && chip.current) onMeasure(zone.id, chip.current.offsetWidth);
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      alive = false;
    };
  }, [zone.id, zone.name, kind, onMeasure]);

  // label switches sides (after the camera settles): the chip slides out from behind the marker.
  // Skipped while the pin is still making its entrance, and with reduced motion.
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const born = useRef<number | null>(null);
  const lastSide = useRef(side);
  useLayoutEffect(() => {
    const now = performance.now();
    born.current ??= now;
    const prev = lastSide.current;
    lastSide.current = side;
    const el = chip.current;
    if (prev === side || !el || folded || now - born.current < 900) return;
    if (reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { opacity: 0, transform: `translateX(${side === 'left' ? 16 : -16}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [side, folded, reduceMotion]);

  const label = PIN_LABEL[kind];

  return (
    <motion.div className={s.pin} style={{ x, y, zIndex: selected ? 2000 : Math.round(zone.y * 10) }} data-map-ui>
      <button
        type="button"
        className={[s.btn, s[kind], s[side], folded && !selected && s.folded, glitchIn && s.fresh, selected && s.selected]
          .filter(Boolean)
          .join(' ')}
        style={{ '--i': index } as CSSProperties}
        onClick={() => onOpen(zone)}
        aria-label={`${zone.name}. ${label}${here ? '. You are here' : ''}`}
        aria-haspopup="dialog"
      >
        <span className={s.stem} aria-hidden />
        {!here && <span className={s.ground} aria-hidden />}
        {kind === 'available' && (
          <>
            <span className={s.pulse} aria-hidden />
            <span className={[s.pulse, s.pulseLate].join(' ')} aria-hidden />
          </>
        )}
        <PinMarker kind={kind} className={s.marker} />
        <span className={s.chip} ref={chip} aria-hidden>
          <span className={s.name} data-text={zone.name}>
            {zone.name}
          </span>
          <span className={s.status}>{label}</span>
        </span>
      </button>
    </motion.div>
  );
}

/*
 * PlayingCard — the signature object of Border Trials.
 *
 * A 2:3 card that renders the suit's painted face art full-bleed, with HTML
 * corner indices, an inner frame line, a title/caption plate and an optional
 * footer slot layered on top. It can be dealt face-down and flipped in 3D,
 * sweeps a gloss highlight across the face when revealed, glows crimson when
 * selected, and tilts toward the pointer while hovered or pressed.
 */
import { Lock } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ART, SUIT_CARD_ART } from '../assets/art';
import { SUITS } from '../data/suits';
import type { CardRank, SuitId } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useSettings } from '../state/settings';
import { SuitIcon } from './ui/SuitIcon';
import s from './PlayingCard.module.css';

export type CardSize = 'mini' | 'md' | 'lg';

export interface PlayingCardProps {
  suit: SuitId;
  rank?: CardRank;
  size?: CardSize;
  /** show the back; flipping this to false animates the reveal */
  faceDown?: boolean;
  /** start face-down and flip to the face after this many ms */
  revealDelay?: number;
  /** sweep the gloss highlight across the face once, after this many ms (no flip) */
  glintDelay?: number;
  title?: ReactNode;
  caption?: ReactNode;
  selected?: boolean;
  locked?: boolean;
  /** extra content on the face below the title plate (stats strip, etc.) */
  footer?: ReactNode;
  onClick?: () => void;
  /** accessible name; defaults to "<Rank> of <Suit>s" */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const RANK_NAME: Partial<Record<CardRank, string>> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

function Index({ suit, rank, flipped }: { suit: SuitId; rank: CardRank; flipped?: boolean }) {
  return (
    <span className={[s.index, flipped && s.indexFlipped].filter(Boolean).join(' ')} aria-hidden>
      <span className={s.rank}>{rank}</span>
      <SuitIcon suit={suit} finish="solid" className={s.pip} size="100%" />
    </span>
  );
}

export function PlayingCard({
  suit,
  rank = 'A',
  size = 'md',
  faceDown,
  revealDelay,
  glintDelay,
  title,
  caption,
  selected,
  locked,
  footer,
  onClick,
  label,
  className,
  style,
}: PlayingCardProps) {
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const rootRef = useRef<HTMLElement | null>(null);

  // Pending timed reveal: start face-down, flip after `revealDelay` ms.
  const [pending, setPending] = useState(revealDelay !== undefined);
  useEffect(() => {
    if (revealDelay === undefined) return;
    const t = window.setTimeout(() => setPending(false), Math.max(30, revealDelay));
    return () => window.clearTimeout(t);
  }, [revealDelay]);

  const down = !!faceDown || pending;
  const [startedDown] = useState(down);

  // A face-down card's art is never rasterised until it turns, so decode it up
  // front — otherwise the first frames of the flip can show an empty face.
  const artRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!startedDown) return;
    artRef.current?.decode().catch(() => {});
  }, [startedDown]);

  // Fire the reveal sfx + gloss sweep whenever the card turns face-up.
  const [glint, setGlint] = useState(0);
  const wasDown = useRef(down);
  useEffect(() => {
    const turnedUp = wasDown.current && !down;
    wasDown.current = down;
    if (!turnedUp) return;
    audio.play('flip');
    const t = window.setTimeout(() => setGlint((n) => n + 1), 300);
    return () => window.clearTimeout(t);
  }, [down]);

  useEffect(() => {
    if (glintDelay === undefined) return;
    const t = window.setTimeout(() => setGlint((n) => n + 1), glintDelay);
    return () => window.clearTimeout(t);
  }, [glintDelay]);

  const interactive = !!onClick;
  const tone = SUITS[suit].tone;
  const showTitlePlate = title !== undefined || caption !== undefined || footer !== undefined;
  const showBottomIndex = !showTitlePlate && size !== 'mini';

  /* ── Pointer tilt (hover on desktop, press on touch) ───────────── */
  const setTilt = (e: PointerEvent<HTMLElement>) => {
    const el = rootRef.current;
    if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    el.dataset.tilting = '';
  };
  const resetTilt = () => {
    const el = rootRef.current;
    if (!el) return;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    delete el.dataset.tilting;
    delete el.dataset.pressed;
  };

  const classes = [
    s.card,
    s[size],
    tone === 'red' ? s.toneRed : s.toneSilver,
    down && s.down,
    startedDown && !down && s.revealed,
    !showTitlePlate && s.plain,
    selected && s.selected,
    locked && s.locked,
    interactive && s.interactive,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const name = label ?? `${RANK_NAME[rank] ?? rank} of ${SUITS[suit].name}s${locked ? ', locked' : ''}`;

  const inner = (
    <span className={s.tilt}>
      <span className={s.lift}>
        <span className={s.flip}>
          {/* ── Face ─────────────────────────────────────── */}
          <span className={[s.face, s.front].join(' ')}>
            <img ref={artRef} className={s.art} src={SUIT_CARD_ART[suit]} alt="" draggable={false} decoding="async" />
            <span className={s.shade} />
            <span className={s.frame} />
            <Index suit={suit} rank={rank} />
            {showBottomIndex && <Index suit={suit} rank={rank} flipped />}
            {showBottomIndex && (
              <span className={s.engrave} aria-hidden>
                <span className={s.engraveLine} />
                <span className={s.engraveText}>
                  {RANK_NAME[rank] ?? rank} of {SUITS[suit].name}s
                </span>
                <span className={s.engraveLine} />
              </span>
            )}
            {locked && (
              <span className={s.lockMark}>
                <Lock size="42%" strokeWidth={2} />
              </span>
            )}
            {showTitlePlate && (
              <span className={s.plate}>
                {title !== undefined && <span className={s.title}>{title}</span>}
                {caption !== undefined && <span className={s.caption}>{caption}</span>}
                {footer !== undefined && <span className={s.footer}>{footer}</span>}
              </span>
            )}
            <span className={s.glare} />
            {glint > 0 && <span key={glint} className={s.gloss} onAnimationEnd={() => setGlint(0)} />}
          </span>

          {/* ── Back ─────────────────────────────────────── */}
          <span className={[s.face, s.back].join(' ')}>
            <img className={s.art} src={ART.cardBack} alt="" draggable={false} decoding="async" />
            <span className={s.backSheen} />
            <span className={[s.frame, s.backFrame].join(' ')} />
          </span>
        </span>
      </span>
    </span>
  );

  if (!interactive) {
    return (
      <span className={classes} style={style} role="img" aria-label={down ? 'Face-down card' : name}>
        {inner}
      </span>
    );
  }

  return (
    <button
      ref={(el) => {
        rootRef.current = el;
      }}
      type="button"
      className={classes}
      style={style}
      aria-label={name}
      aria-pressed={selected || undefined}
      aria-disabled={locked || undefined}
      onClick={() => {
        audio.unlock();
        audio.play(locked ? 'error' : 'select');
        haptic(locked ? 'warning' : 'light');
        onClick?.();
      }}
      onPointerMove={setTilt}
      onPointerDown={(e) => {
        setTilt(e);
        if (rootRef.current) rootRef.current.dataset.pressed = '';
      }}
      onPointerUp={() => {
        if (rootRef.current) delete rootRef.current.dataset.pressed;
      }}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
    >
      {inner}
    </button>
  );
}

import { useId } from 'react';
import type { SuitId } from '../../data/types';

/*
 * Vector suit symbols with four finishes:
 *   solid  — currentColor, for inline UI
 *   chrome — brushed silver with specular highlight (♠ ♣ cards)
 *   ruby   — glossy crimson with inner glow (♥ ♦ cards)
 *   outline— stroked, for locked / disabled states
 */

export type SuitFinish = 'solid' | 'chrome' | 'ruby' | 'outline';

const HEART =
  'M50 90 C 22 68 5 52 5 32 C 5 17 16 7 30 7 C 39 7 46 12 50 20 C 54 12 61 7 70 7 C 84 7 95 17 95 32 C 95 52 78 68 50 90 Z';
const DIAMOND = 'M50 3 Q 67 29 88 50 Q 67 71 50 97 Q 33 71 12 50 Q 33 29 50 3 Z';
const SPADE =
  'M50 4 C 44 14 8 38 8 60 C 8 74 19 82 31 82 C 39 82 45 78 48 73 C 47 83 42 90 34 95 L 66 95 C 58 90 53 83 52 73 C 55 78 61 82 69 82 C 81 82 92 74 92 60 C 92 38 56 14 50 4 Z';
const CLUB_STEM = 'M46.5 58 C 46.5 76 42 87 33 95 L 67 95 C 58 87 53.5 76 53.5 58 Z';

function Shape({ suit }: { suit: SuitId }) {
  switch (suit) {
    case 'heart':
      return <path d={HEART} />;
    case 'diamond':
      return <path d={DIAMOND} />;
    case 'spade':
      return <path d={SPADE} />;
    case 'club':
      return (
        <>
          <circle cx="50" cy="28" r="19" />
          <circle cx="27" cy="58" r="19" />
          <circle cx="73" cy="58" r="19" />
          <circle cx="50" cy="52" r="12" />
          <path d={CLUB_STEM} />
        </>
      );
  }
}

interface Props {
  suit: SuitId;
  size?: number | string;
  finish?: SuitFinish;
  className?: string;
  title?: string;
}

export function SuitIcon({ suit, size = 24, finish = 'solid', className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const g = `g${uid}`;
  const hi = `h${uid}`;

  let fill = 'currentColor';
  let stroke: string | undefined;
  let defs: React.ReactNode = null;

  if (finish === 'chrome') {
    fill = `url(#${g})`;
    defs = (
      <linearGradient id={g} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.28" stopColor="#c9ced8" />
        <stop offset="0.5" stopColor="#5d6170" />
        <stop offset="0.62" stopColor="#e9ecf2" />
        <stop offset="0.85" stopColor="#7b808e" />
        <stop offset="1" stopColor="#2b2d34" />
      </linearGradient>
    );
  } else if (finish === 'ruby') {
    fill = `url(#${g})`;
    defs = (
      <linearGradient id={g} x1="0.1" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor="#ff6b74" />
        <stop offset="0.3" stopColor="#ff1f2d" />
        <stop offset="0.65" stopColor="#b3000f" />
        <stop offset="1" stopColor="#4d0006" />
      </linearGradient>
    );
  } else if (finish === 'outline') {
    fill = 'none';
    stroke = 'currentColor';
  }

  const glossy = finish === 'chrome' || finish === 'ruby';

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {defs && <defs>{defs}
        {glossy && (
          <linearGradient id={hi} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>}
      <g fill={fill} stroke={stroke} strokeWidth={stroke ? 4 : undefined} strokeLinejoin="round">
        <Shape suit={suit} />
      </g>
      {glossy && (
        <g fill={`url(#${hi})`} style={{ mixBlendMode: 'screen' }} clipPath="none" opacity="0.55">
          <ellipse cx="38" cy="26" rx="18" ry="9" transform="rotate(-24 38 26)" />
        </g>
      )}
    </svg>
  );
}

export const SUIT_GLYPH: Record<SuitId, string> = { spade: '♠', heart: '♥', diamond: '♦', club: '♣' };

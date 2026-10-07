import { useId } from 'react';
import type { PinKind } from './mapModel';

/*
 * Map marker emblem — a bevelled shield (or a diamond for discovered zones)
 * drawn in currentColor, with an engraved status glyph. Size is fixed at
 * 34×40 so the pin geometry in mapModel stays exact.
 */

const SHIELD = 'M17 1.6 L31.2 7.6 V20.4 C31.2 28.6 25 34.4 17 38.6 C9 34.4 2.8 28.6 2.8 20.4 V7.6 Z';
const SHIELD_IN = 'M17 5.2 L28 9.9 V20.2 C28 26.6 23.4 31.2 17 34.8 C10.6 31.2 6 26.6 6 20.2 V9.9 Z';
const RHOMBUS = 'M17 1.2 L32.6 20 L17 38.8 L1.4 20 Z';
const RHOMBUS_IN = 'M17 6.4 L28.4 20 L17 33.6 L5.6 20 Z';

function Glyph({ kind }: { kind: PinKind }) {
  switch (kind) {
    case 'locked':
      return (
        <g>
          <path d="M13.6 17.6 V15.4 a3.4 3.4 0 0 1 6.8 0 V17.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="11.6" y="17.4" width="10.8" height="8.4" rx="1.6" fill="currentColor" />
          <circle cx="17" cy="21.3" r="1.2" fill="#0b0b0e" />
        </g>
      );
    case 'available':
      return (
        <g>
          <path d="M17 11.2 Q19.6 15.6 22.6 19 Q19.6 22.4 17 26.8 Q14.4 22.4 11.4 19 Q14.4 15.6 17 11.2 Z" fill="currentColor" />
          <path d="M17 13.6 Q18.4 16.2 20 18.2 L17 18.6 Z" fill="#fff" opacity="0.55" />
        </g>
      );
    case 'completed':
      return <path d="M11.4 19.4 L15.4 23.2 L22.8 14.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
    case 'discovered':
      return (
        <g>
          <path d="M17 12.4 Q19.2 16.6 21.8 20 Q19.2 23.4 17 27.6 Q14.8 23.4 12.2 20 Q14.8 16.6 17 12.4 Z" fill="currentColor" />
          <path d="M17 14.6 Q18.2 17 19.6 19.2 L17 19.6 Z" fill="#fff" opacity="0.6" />
        </g>
      );
  }
}

export function PinMarker({ kind, className }: { kind: PinKind; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const fill = `pf${uid}`;
  const shine = `ps${uid}`;
  const diamond = kind === 'discovered';
  return (
    <svg viewBox="0 0 34 40" width="34" height="40" className={className} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="1" stopColor="#050506" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={diamond ? RHOMBUS : SHIELD} fill="#08080a" fillOpacity="0.88" />
      <path d={diamond ? RHOMBUS : SHIELD} fill={`url(#${fill})`} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={diamond ? RHOMBUS_IN : SHIELD_IN} fill={`url(#${shine})`} stroke="currentColor" strokeOpacity="0.38" strokeWidth="0.9" strokeLinejoin="round" />
      <Glyph kind={kind} />
    </svg>
  );
}

import React, {useId} from 'react';
import {OUTLINE} from '../lib/theme';
import {P, smoothClosed, smoothOpen} from './geom';

/**
 * Close-up right hand seen from the side, palm up, wrist on the left, fingers to the right.
 * Morphs between a closed fist (open=0) and an open, offering palm (open=1). Exactly five fingers.
 */
const OPEN: P[] = [[-150, -50], [-40, -58], [60, -54], [150, -50], [230, -42], [252, -28], [240, -12], [246, 8], [230, 26], [206, 42], [150, 48], [60, 58], [-60, 60], [-150, 48]];
const FIST: P[] = [[-150, -50], [-40, -62], [40, -68], [92, -60], [124, -38], [138, -12], [136, 8], [128, 30], [110, 50], [84, 62], [50, 66], [10, 64], [-70, 60], [-150, 48]];
const LINES_OPEN: P[][] = [[[74, -26], [160, -26], [238, -18]], [[74, -2], [160, 0], [238, 8]], [[74, 22], [150, 26], [222, 30]]];
const LINES_FIST: P[][] = [[[94, -46], [112, -40], [126, -28]], [[102, -18], [122, -12], [136, -2]], [[100, 14], [118, 20], [130, 26]]];
const THUMB_OPEN: P[] = [[-80, -48], [-62, -98], [-34, -138], [-2, -146], [10, -122], [-4, -86], [16, -54]];
const THUMB_FIST: P[] = [[-52, -54], [0, -74], [62, -76], [106, -58], [110, -40], [52, -38], [-10, -32]];

const mix = (a: P[], b: P[], k: number): P[] => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]);

export const BigHand: React.FC<{open: number; skin: string; skinShade: string; sleeve: string; sleeveShade: string; grains?: boolean; lw?: number}> = ({
  open, skin, skinShade, sleeve, sleeveShade, grains = false, lw = 7,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const k = Math.max(0, Math.min(1, open));
  const over = Math.max(0, open - 1); // overshoot: fingers flick up a touch
  const body = mix(FIST, OPEN, k).map((p, i) => (i >= 3 && i <= 10 ? ([p[0], p[1] - over * 30 * ((p[0] - 60) / 190)] as P) : p));
  const lines = LINES_FIST.map((l, i) => mix(l, LINES_OPEN[i], k));
  const thumb = mix(THUMB_FIST, THUMB_OPEN, k);
  return (
    <g>
      {/* sleeve + wrist */}
      <path d={smoothClosed([[-250, -58], [-140, -52], [-120, 0], [-140, 50], [-250, 56]], 0.6)} fill={skinShade} stroke={OUTLINE} strokeWidth={lw} />
      <path d={smoothClosed([[-440, -112], [-236, -100], [-210, 0], [-236, 100], [-440, 112]], 0.6)} fill={sleeve} stroke={OUTLINE} strokeWidth={lw} />
      <path d={smoothClosed([[-262, -98], [-210, -92], [-190, 0], [-210, 92], [-262, 98], [-240, 0]], 0.6)} fill={sleeveShade} stroke={OUTLINE} strokeWidth={lw} />
      {/* hand body with a one-tone shadow along the bottom */}
      <clipPath id={`bh${uid}`}>
        <path d={smoothClosed(body, 0.8)} />
      </clipPath>
      <g clipPath={`url(#bh${uid})`}>
        <path d={smoothClosed(body, 0.8)} fill={skinShade} />
        <path d={smoothClosed(body, 0.8)} fill={skin} transform="translate(-6,-14)" />
      </g>
      <path d={smoothClosed(body, 0.8)} fill="none" stroke={OUTLINE} strokeWidth={lw} strokeLinejoin="round" />
      {lines.map((l, i) => (
        <path key={i} d={smoothOpen(l)} fill="none" stroke={OUTLINE} strokeWidth={lw * 0.7} strokeLinecap="round" opacity={0.85} />
      ))}
      {/* palm creases when open */}
      <path d="M-100,-24 Q-20,4 46,-30 M-96,18 Q-24,30 44,8" fill="none" stroke={skinShade} strokeWidth={lw * 0.6} strokeLinecap="round" opacity={k} />
      {/* fingernails on the tips when open */}
      {k > 0.6 && [[236, -32], [240, -4], [222, 18]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill="#E7B89A" opacity={(k - 0.6) * 2} />)}
      {grains && k < 0.7 && [[70, -66], [92, -58], [52, -72]].map(([x, y], i) => (
        <ellipse key={'g' + i} cx={x} cy={y} rx={11} ry={7} fill="#F2C35A" stroke={OUTLINE} strokeWidth={lw * 0.4} transform={`rotate(${25 * i - 20} ${x} ${y})`} opacity={1 - k * 1.4} />
      ))}
      <path d={smoothClosed(thumb, 0.85)} fill={skin} stroke={OUTLINE} strokeWidth={lw * 0.9} strokeLinejoin="round" />
    </g>
  );
};

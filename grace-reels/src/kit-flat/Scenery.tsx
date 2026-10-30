import React, {useId} from 'react';
import {random} from 'remotion';
import {C, GROUND_Y, H, OUTLINE, W} from './palette';
import {lerp, sid} from './anim';

export type SkyKind = 'night' | 'storm' | 'dawn' | 'greyDay' | 'darkDay';

const SKY_STOPS: Record<SkyKind, [number, string][]> = {
  night: [
    [0, C.nightTop],
    [0.4, C.nightMid],
    [0.78, C.nightLow],
    [1, C.nightHorizon],
  ],
  storm: [
    [0, C.stormTop],
    [0.45, C.stormMid],
    [0.8, C.stormLow],
    [1, C.stormHorizon],
  ],
  greyDay: [
    [0, '#AEB2BE'],
    [0.6, '#C3C5CD'],
    [1, '#D7D6D8'],
  ],
  darkDay: [
    [0, '#2E2A3B'],
    [0.55, '#463F55'],
    [1, '#6B6276'],
  ],
  dawn: [
    [0, '#EFD7BC'],
    [0.55, C.dawnTop],
    [0.85, C.dawnLow],
    [1, C.dawnHorizon],
  ],
};

export const Stars: React.FC<{frame: number; count?: number; seed?: string; opacity?: number; maxY?: number}> = ({
  frame,
  count = 34,
  seed = 'stars',
  opacity = 1,
  maxY = GROUND_Y - 260,
}) => (
  <g opacity={opacity}>
    {new Array(count).fill(0).map((_, i) => {
      const x = random(`${seed}x${i}`) * W;
      const y = random(`${seed}y${i}`) * maxY;
      const r = 1.4 + random(`${seed}r${i}`) * 2.2;
      const tw = 0.55 + 0.45 * Math.sin(frame / (18 + random(`${seed}t${i}`) * 30) + i);
      return <circle key={i} cx={x} cy={y} r={r} fill={C.star} opacity={tw} />;
    })}
  </g>
);

export const Moon: React.FC<{x: number; y: number; r?: number; glow?: number}> = ({x, y, r = 135, glow = 1}) => {
  const id = sid(useId());
  return (
    <g>
      <defs>
        <radialGradient id={`mg${id}`}>
          <stop offset="0%" stopColor={C.moonGlow} stopOpacity={0.5} />
          <stop offset="38%" stopColor={C.moonGlow} stopOpacity={0.2} />
          <stop offset="100%" stopColor={C.moonGlow} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 3.3} fill={`url(#mg${id})`} opacity={glow} />
      <circle cx={x} cy={y} r={r} fill={C.moon} stroke={C.moonLine} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      {[
        [-0.18, -0.28, 0.22],
        [0.26, -0.05, 0.17],
        [-0.05, 0.32, 0.13],
        [0.2, -0.42, 0.1],
      ].map(([cx, cy, cr], i) => (
        <circle
          key={i}
          cx={x + cx * r}
          cy={y + cy * r}
          r={cr * r}
          fill={C.moonCrater}
          stroke={C.moonLine}
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
};

export const Sky: React.FC<{
  kind: SkyKind;
  frame: number;
  stars?: boolean;
  moon?: {x: number; y: number; r?: number} | null;
  starOpacity?: number;
  height?: number;
}> = ({kind, frame, stars = kind === 'night', moon = null, starOpacity = 1, height = GROUND_Y}) => {
  const id = sid(useId());
  return (
    <g>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          {SKY_STOPS[kind].map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x={-200} y={-400} width={W + 400} height={height + 400} fill={`url(#sky${id})`} />
      {stars ? <Stars frame={frame} opacity={starOpacity} /> : null}
      {moon ? <Moon {...moon} /> : null}
    </g>
  );
};

/** Soft radial light. */
export const Glow: React.FC<{x: number; y: number; r: number; color?: string; opacity?: number; ry?: number}> = ({
  x,
  y,
  r,
  color = '#FFB868',
  opacity = 1,
  ry,
}) => {
  const id = sid(useId());
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={`gl${id}`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="35%" stopColor={color} stopOpacity={0.33} />
          <stop offset="70%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={r} ry={ry ?? r} fill={`url(#gl${id})`} />
    </g>
  );
};

/** Thin dark ground line with tiny grass ticks. */
export const GroundLine: React.FC<{y?: number; grass?: boolean; seed?: string; x1?: number; x2?: number}> = ({
  y = GROUND_Y,
  grass = true,
  seed = 'grass',
  x1 = -200,
  x2 = W + 200,
}) => (
  <g>
    {grass
      ? new Array(70).fill(0).map((_, i) => {
          const x = x1 + (i / 70) * (x2 - x1) + random(`${seed}${i}`) * 14;
          const h = 9 + random(`${seed}h${i}`) * 12;
          const a = (random(`${seed}a${i}`) - 0.3) * 0.7;
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + Math.sin(a) * h}
              y2={y - Math.cos(a) * h}
              stroke={C.grass}
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={0.75}
              vectorEffect="non-scaling-stroke"
            />
          );
        })
      : null}
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.ink} strokeWidth={OUTLINE * 0.9} vectorEffect="non-scaling-stroke" />
  </g>
);

/** Misty white panel under the ground line, with faint dash strokes. */
export const FogPanel: React.FC<{tint?: string; tintAmount?: number; y?: number; seed?: string}> = ({
  tint = C.nightLow,
  tintAmount = 0.7,
  y = GROUND_Y,
  seed = 'fog',
}) => {
  const id = sid(useId());
  return (
    <g>
      <defs>
        <linearGradient id={`fog${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(C.fogMid, tint, tintAmount)} />
          <stop offset="0.1" stopColor={mix(C.fogMid, tint, tintAmount * 0.62)} />
          <stop offset="0.22" stopColor={mix(C.fogMid, tint, tintAmount * 0.25)} />
          <stop offset="0.36" stopColor={C.fogMid} />
          <stop offset="0.72" stopColor={C.fogMid} />
          <stop offset="1" stopColor={C.fogLow} />
        </linearGradient>
      </defs>
      <rect x={-200} y={y} width={W + 400} height={H - y + 400} fill={`url(#fog${id})`} />
      {new Array(34).fill(0).map((_, i) => {
        const dx = random(`${seed}x${i}`) * W;
        const dy = y + 40 + random(`${seed}y${i}`) * (H - y - 40);
        const len = 18 + random(`${seed}l${i}`) * 34;
        return (
          <line
            key={i}
            x1={dx}
            y1={dy}
            x2={dx + len}
            y2={dy}
            stroke={C.fogDash}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}
    </g>
  );
};

const wavePath = (y: number, amp: number, len: number, phase: number, x0 = -200, x1 = W + 200) => {
  let d = '';
  const step = 12;
  for (let x = x0; x <= x1; x += step) {
    const yy = y + Math.sin(((x + phase) / len) * Math.PI * 2) * amp;
    d += `${x === x0 ? 'M' : 'L'} ${x} ${yy.toFixed(1)} `;
  }
  return d;
};

/**
 * Light-blue sea filling the lower panel. `storm` 0..1 blends from calm
 * (thin wavy lines) to stormy (darker water, big flat wave humps).
 */
export const Sea: React.FC<{frame: number; storm?: number; y?: number; reflection?: {x: number; opacity: number}}> = ({
  frame,
  storm = 0,
  y = GROUND_Y,
  reflection,
}) => {
  const id = sid(useId());
  const top = mix(C.seaTop, C.stormSea, storm);
  const low = mix(C.seaLow, C.stormSeaDeep, storm);
  const line = mix(C.seaLine, C.stormSeaLine, storm);
  const amp = lerp(7, 16, storm);
  const speed = lerp(0.6, 3.2, storm);
  const rows = [];
  for (let i = 0; i < 9; i++) {
    const ry = y + 46 + i * 82;
    rows.push(
      <path
        key={i}
        d={wavePath(ry, amp, lerp(150, 120, storm), frame * speed * (i % 2 ? 1 : -1) + i * 37)}
        fill="none"
        stroke={line}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.85}
      />,
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id={`sea${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect x={-200} y={y} width={W + 400} height={H - y + 400} fill={`url(#sea${id})`} />
      {reflection ? <MoonReflection x={reflection.x} y={y} opacity={reflection.opacity} frame={frame} /> : null}
      {rows}
      <line x1={-200} y1={y} x2={W + 200} y2={y} stroke={mix(C.ink, line, 0.35)} strokeWidth={4.5} vectorEffect="non-scaling-stroke" />
    </g>
  );
};

const MoonReflection: React.FC<{x: number; y: number; opacity: number; frame: number}> = ({x, y, opacity, frame}) => (
  <g opacity={opacity}>
    {new Array(7).fill(0).map((_, i) => {
      const w = 150 - i * 14 + Math.sin(frame / 14 + i) * 10;
      return (
        <rect
          key={i}
          x={x - w / 2}
          y={y + 24 + i * 34}
          width={w}
          height={9}
          rx={4.5}
          fill={C.moon}
          opacity={0.85 - i * 0.09}
        />
      );
    })}
  </g>
);

/**
 * Big flat storm waves rising above the sea line: a band of rounded crests
 * (|sin| shape, cusps at the troughs) with foam caps, drifting sideways.
 */
export const StormWaves: React.FC<{frame: number; height: number; y?: number; seed?: string}> = ({
  frame,
  height,
  y = GROUND_Y,
}) => {
  if (height <= 1) return null;
  const len = 300; // crest spacing
  const phase = frame * 3.2;
  const crestH = (i: number) => height * (0.72 + 0.28 * Math.sin(i * 1.7 + frame / 24));
  let d = `M -200 ${y + 4}`;
  const foams: React.ReactNode[] = [];
  const x0 = -200;
  const x1 = W + 200;
  for (let x = x0; x <= x1; x += 8) {
    const u = (x + phase) / len;
    const i = Math.floor(u);
    const k = Math.abs(Math.sin(Math.PI * u)) ** 0.7;
    // lean the crest forward a little
    const lean = Math.sin(Math.PI * 2 * u) * 0.12;
    d += ` L ${x} ${(y - crestH(i) * Math.max(0, k + lean * k)).toFixed(1)}`;
  }
  d += ` L ${x1} ${y + 4} Z`;
  for (let i = Math.floor((x0 + phase) / len); i <= Math.ceil((x1 + phase) / len); i++) {
    const cx = (i + 0.5) * len - phase + len * 0.06;
    const h = crestH(i);
    foams.push(
      <path
        key={i}
        d={`M ${cx - 70} ${y - h * 0.82} Q ${cx - 10} ${y - h * 1.12} ${cx + 52} ${y - h * 0.86}`}
        fill="none"
        stroke={C.foam}
        strokeWidth={6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />,
      <path
        key={`b${i}`}
        d={`M ${cx - 96} ${y - h * 0.34} Q ${cx - 70} ${y - h * 0.5} ${cx - 34} ${y - h * 0.46}`}
        fill="none"
        stroke={C.stormSeaLine}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.8}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return (
    <g>
      <path d={d} fill={C.stormSea} stroke={C.ink} strokeWidth={OUTLINE * 0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {foams}
    </g>
  );
};

/** Cream path drawn on the fog, from bottom-left up to the horizon. */
export const PathFloor: React.FC<{toX?: number; y?: number; opacity?: number; reveal?: number}> = ({
  toX = 820,
  y = GROUND_Y,
  opacity = 1,
  reveal = 1,
}) => {
  const d =
    `M ${-120} ${H} C ${120} ${H - 260}, ${380} ${y + 210}, ${toX - 40} ${y}` +
    ` L ${toX + 40} ${y} C ${560} ${y + 260}, ${520} ${H - 300}, ${560} ${H} Z`;
  const id = sid(useId());
  return (
    <g opacity={opacity}>
      <clipPath id={`pr${id}`}>
        <rect x={-200} y={H - (H - y) * reveal - 2} width={W + 400} height={H} />
      </clipPath>
      <path d={d} fill={C.path} stroke={C.pathLine} strokeWidth={3} clipPath={`url(#pr${id})`} />
    </g>
  );
};

// --- colour helpers ---------------------------------------------------------
const hex = (c: string) => {
  const v = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
export const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  const r = A.map((v, i) => Math.round(v + (B[i] - v) * Math.min(1, Math.max(0, t))));
  return `#${r.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

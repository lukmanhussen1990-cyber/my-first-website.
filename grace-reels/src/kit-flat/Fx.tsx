import React, {useId} from 'react';
import {random} from 'remotion';
import {C, H, OUTLINE, W} from './palette';
import {FONT_SERIF} from './fonts';
import {clamp, pop, sid} from './anim';

const NS = {vectorEffect: 'non-scaling-stroke' as const};

/** Slanted rain lines. `fadeTop` (0..1) clears rain from the top downwards. */
export const Rain: React.FC<{frame: number; opacity?: number; count?: number; clearFromTop?: number; maxY?: number}> = ({
  frame,
  opacity = 1,
  count = 70,
  clearFromTop = 0,
  maxY = H,
}) => (
  <g opacity={opacity}>
    {new Array(count).fill(0).map((_, i) => {
      const speed = 38 + random(`rs${i}`) * 14;
      const len = 46 + random(`rl${i}`) * 30;
      const x0 = random(`rx${i}`) * (W + 300) - 50;
      const y = ((random(`ry${i}`) * maxY + frame * speed) % (maxY + 100)) - 100;
      const x = x0 - (y / maxY) * 180;
      if (y < clearFromTop * maxY) return null;
      return (
        <line
          key={i}
          x1={x}
          y1={y}
          x2={x - len * 0.32}
          y2={y + len}
          stroke="#C9D6E6"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.55}
        />
      );
    })}
  </g>
);

/** Little water splash dots bursting up from a point. */
export const SplashDots: React.FC<{x: number; y: number; frame: number; start: number; seed?: string; size?: number}> = ({
  x,
  y,
  frame,
  start,
  seed = 's',
  size = 1,
}) => {
  const t = (frame - start) / 26;
  if (t <= 0 || t >= 1) return null;
  return (
    <g>
      {new Array(9).fill(0).map((_, i) => {
        const a = -Math.PI / 2 + (random(`${seed}a${i}`) - 0.5) * 2.2;
        const v = (120 + random(`${seed}v${i}`) * 120) * size;
        const px = x + Math.cos(a) * v * t;
        const py = y + Math.sin(a) * v * t + 260 * t * t * size;
        const r = (7 + random(`${seed}r${i}`) * 7) * size * (1 - t * 0.5);
        return <circle key={i} cx={px} cy={py} r={r} fill={C.foam} stroke={C.seaLine} strokeWidth={2.5} opacity={1 - t} {...NS} />;
      })}
      {[0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        const l = 50 * size * Math.sin(t * Math.PI);
        return (
          <line
            key={`l${i}`}
            x1={x + Math.cos(a) * 18}
            y1={y + Math.sin(a) * 18}
            x2={x + Math.cos(a) * (18 + l)}
            y2={y + Math.sin(a) * (18 + l)}
            stroke={C.foam}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={1 - t}
          />
        );
      })}
    </g>
  );
};

export const heartPath = (s = 1) =>
  `M 0 ${18 * s} C ${-6 * s} ${12 * s}, ${-32 * s} ${-4 * s}, ${-32 * s} ${-20 * s} C ${-32 * s} ${-36 * s}, ${-12 * s} ${-42 * s}, 0 ${-26 * s}` +
  ` C ${12 * s} ${-42 * s}, ${32 * s} ${-36 * s}, ${32 * s} ${-20 * s} C ${32 * s} ${-4 * s}, ${6 * s} ${12 * s}, 0 ${18 * s} Z`;

/** Gold outline heart that pops in and floats upward. */
export const Heart: React.FC<{
  x: number;
  y: number;
  frame: number;
  start: number;
  size?: number;
  float?: number; // px of upward drift over 3 s
  fill?: string;
  color?: string;
}> = ({x, y, frame, start, size = 1.6, float = 80, fill = 'none', color = C.gold}) => {
  const s = pop(frame, start, 12);
  if (s <= 0) return null;
  const dy = -float * clamp((frame - start) / 90);
  const sway = Math.sin((frame - start) / 14) * 6;
  return (
    <g transform={`translate(${x + sway},${y + dy}) scale(${s * size})`}>
      <path d={heartPath(1)} fill={fill} stroke={color} strokeWidth={5} strokeLinejoin="round" {...NS} />
    </g>
  );
};

/** Small 4-point sparkles bursting out. */
export const Sparkles: React.FC<{x: number; y: number; frame: number; start: number; count?: number; radius?: number; color?: string; seed?: string}> = ({
  x,
  y,
  frame,
  start,
  count = 10,
  radius = 150,
  color = C.gold,
  seed = 'sp',
}) => {
  const t = (frame - start) / 28;
  if (t <= 0 || t >= 1) return null;
  return (
    <g>
      {new Array(count).fill(0).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + random(`${seed}${i}`) * 0.5;
        const d = radius * (0.4 + 0.6 * Math.sqrt(t)) * (0.7 + random(`${seed}d${i}`) * 0.5);
        const s = (1 - t) * (10 + random(`${seed}s${i}`) * 10);
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        return (
          <path
            key={i}
            d={`M ${px} ${py - s} Q ${px} ${py} ${px + s} ${py} Q ${px} ${py} ${px} ${py + s} Q ${px} ${py} ${px - s} ${py} Q ${px} ${py} ${px} ${py - s} Z`}
            fill={color}
          />
        );
      })}
    </g>
  );
};

/** Floating "z z z". */
export const Zzz: React.FC<{x: number; y: number; frame: number; color?: string}> = ({x, y, frame, color = C.blue}) => (
  <g>
    {[0, 1, 2].map((i) => {
      const t = ((frame + i * 26) % 78) / 78;
      return (
        <text
          key={i}
          x={x + t * 70 + i * 6}
          y={y - t * 150}
          fontFamily={FONT_SERIF}
          fontWeight={900}
          fontSize={46 + t * 34}
          fill={color}
          stroke={C.ink}
          strokeWidth={5}
          strokeLinejoin="round"
          style={{paintOrder: 'stroke'}}
          opacity={Math.sin(t * Math.PI)}
        >
          z
        </text>
      );
    })}
  </g>
);

/** Serif "!" mark that pops in. */
export const Exclaim: React.FC<{x: number; y: number; frame: number; start: number; color?: string; size?: number}> = ({
  x,
  y,
  frame,
  start,
  color = C.red,
  size = 1,
}) => {
  const s = pop(frame, start, 9);
  if (s <= 0) return null;
  const wig = Math.sin((frame - start) / 3) * 3;
  return (
    <g transform={`translate(${x},${y}) rotate(${wig}) scale(${s * size})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fontFamily={FONT_SERIF}
        fontWeight={900}
        fontSize={96}
        fill={color}
        stroke={C.ink}
        strokeWidth={4}
        style={{paintOrder: 'stroke'}}
      >
        !
      </text>
    </g>
  );
};

/** Big "?" in a cream circle with a red outline. */
export const QuestionCircle: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <circle r={104} fill={C.cream} stroke={C.red} strokeWidth={11} {...NS} />
    <text x={0} y={58} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={190} fill={C.red}>
      ?
    </text>
  </g>
);

/** Union-outlined cloud from circles. */
export const cloudCircles = (w: number): [number, number, number][] => [
  [-w * 0.32, 8, w * 0.2],
  [-w * 0.1, -14, w * 0.27],
  [w * 0.17, -8, w * 0.24],
  [w * 0.36, 10, w * 0.17],
  [0, 18, w * 0.25],
];

export const Cloud: React.FC<{x: number; y: number; w?: number; fill?: string; scale?: number; opacity?: number; line?: string}> = ({
  x,
  y,
  w = 260,
  fill = C.cloud,
  scale = 1,
  opacity = 1,
  line = C.ink,
}) => {
  const cs = cloudCircles(w);
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      {cs.map(([cx, cy, r], i) => (
        <circle key={`s${i}`} cx={cx} cy={cy} r={r} fill={line} stroke={line} strokeWidth={OUTLINE * 2} {...NS} />
      ))}
      {cs.map(([cx, cy, r], i) => (
        <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={fill} />
      ))}
    </g>
  );
};

/** Grey rain cloud over a head, with little blue drops. `melt` 0..1 dissolves it into light. */
export const RainCloud: React.FC<{x: number; y: number; frame: number; melt?: number}> = ({x, y, frame, melt = 0}) => (
  <g opacity={1 - melt}>
    <Cloud x={x} y={y} w={230} scale={1 - melt * 0.4} />
    {melt < 0.3
      ? [0, 1, 2].map((i) => {
          const t = ((frame + i * 9) % 26) / 26;
          return (
            <path
              key={i}
              transform={`translate(${x - 50 + i * 50},${y + 50 + t * 70})`}
              d="M 0 -12 Q 7 0 7 6 A 7 7 0 0 1 -7 6 Q -7 0 0 -12 Z"
              fill={C.tear}
              opacity={1 - t}
            />
          );
        })
      : null}
  </g>
);

/** Flat paper plane. */
export const PaperPlane: React.FC<{x: number; y: number; rotate?: number; scale?: number}> = ({x, y, rotate = 0, scale = 1}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    <path d="M 46 0 L -40 -30 L -20 0 L -40 26 Z" fill={C.cream} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" {...NS} />
    <path d="M 46 0 L -20 0 L -26 16 Z" fill="#E6DCC4" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" {...NS} />
  </g>
);

/**
 * Gold dotted motion path with an arrowhead. `d` is any SVG path,
 * `progress` 0..1 draws it on. `len` is the path length (approximate is fine).
 */
export const DottedPath: React.FC<{
  d: string;
  len: number;
  progress: number;
  color?: string;
  arrow?: {x: number; y: number; angle: number} | null;
  gap?: number;
  dot?: number;
}> = ({d, len, progress, color = C.gold, arrow, gap = 17, dot = 8}) => {
  const id = sid(useId());
  if (progress <= 0) return null;
  return (
    <g>
      <defs>
        <mask id={`dp${id}`} maskUnits="userSpaceOnUse" x={-500} y={-500} width={W + 1000} height={H + 1000}>
          <path
            d={d}
            fill="none"
            stroke="#fff"
            strokeWidth={40}
            strokeDasharray={`${len * progress} ${len * 2}`}
          />
        </mask>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={dot}
        strokeLinecap="round"
        strokeDasharray={`0 ${gap}`}
        mask={`url(#dp${id})`}
      />
      {arrow && progress > 0.96 ? (
        <g transform={`translate(${arrow.x},${arrow.y}) rotate(${arrow.angle}) scale(${pop(progress * 30, 28.8, 1.2)})`}>
          <path d="M -26 -20 L 0 0 L -26 20" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
    </g>
  );
};

/** Gold ripple arcs (concentric circle segments). */
export const Ripples: React.FC<{x: number; y: number; frame: number; start: number; color?: string; count?: number; maxR?: number}> = ({
  x,
  y,
  frame,
  start,
  color = C.gold,
  count = 3,
  maxR = 240,
}) => {
  const t = frame - start;
  if (t < 0) return null;
  return (
    <g>
      {new Array(count).fill(0).map((_, i) => {
        const p = ((t / 45 + i / count) % 1);
        const r = 60 + p * maxR;
        return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={4} opacity={(1 - p) * 0.8} {...NS} />;
      })}
    </g>
  );
};

/** Soft white lightning flash overlay (never a hard strobe). */
export const LightningFlash: React.FC<{frame: number; at: number[]}> = ({frame, at}) => {
  let o = 0;
  for (const a of at) {
    const t = frame - a;
    if (t >= 0 && t < 14) o = Math.max(o, t < 2 ? t / 2 : (1 - (t - 2) / 12));
  }
  if (o <= 0) return null;
  return <rect x={-200} y={-400} width={W + 400} height={H + 800} fill="#F4F6FF" opacity={o * 0.38} />;
};

export const Bolt: React.FC<{x: number; y: number; frame: number; at: number}> = ({x, y, frame, at}) => {
  const t = frame - at;
  if (t < 0 || t > 10) return null;
  return (
    <path
      d={`M ${x} ${y} l -40 120 l 34 -8 l -44 140 l 90 -170 l -38 8 l 34 -90 Z`}
      fill="#FFF7D6"
      stroke={C.ink}
      strokeWidth={4}
      strokeLinejoin="round"
      opacity={1 - t / 10}
      {...NS}
    />
  );
};

// Flat kit additions (Angry at God?): jagged↔round bubble morph, rocky hill,
// scroll, stamp, card, board sign, broken heart, music note, harp, light
// column, flat cross, ash patch and the honest-prayers row.
import React, {useId} from 'react';
import {random} from 'remotion';
import {C, OUTLINE} from './palette';
import {FONT_SERIF, FONT_UI} from './fonts';
import {clamp, pop, sid} from './anim';
import {heartPath} from './Fx';
import {Badge} from './Text';

const NS = {vectorEffect: 'non-scaling-stroke' as const};
const ink = (w = OUTLINE) => ({stroke: C.ink, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, ...NS});

const mixHex = (a: string, b: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t)).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Speech bubble that morphs from jagged/red (morph 0) to round/gold (morph 1).
 * Origin = bubble centre, `tail` = tip offset.
 */
export const MorphBubble: React.FC<{
  x: number;
  y: number;
  lines: string[];
  morph?: number;
  size?: number;
  width?: number;
  tail?: {x: number; y: number};
  scale?: number;
  opacity?: number;
  badge?: number;
  from?: string; // colour at morph 0
  to?: string; // colour at morph 1
  seed?: string;
}> = ({x, y, lines, morph = 0, size = 38, width, tail = {x: -40, y: 120}, scale = 1, opacity = 1, badge, from = C.red, to = C.gold, seed = 'mb'}) => {
  const longest = Math.max(...lines.map((l) => l.length));
  const w = width ?? Math.max(240, longest * size * 0.7 + 90);
  const lh = size * 1.12;
  const h = lines.length * lh + 64;
  const col = mixHex(from, to, morph);
  const spike = (1 - morph) * 22;
  const N = 96;
  const P = 6; // points per spike
  const pts: string[] = [];
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const ex = 2 / 5; // superellipse → rounded rectangle
    const bx = (w / 2) * Math.sign(c) * Math.abs(c) ** ex;
    const by = (h / 2) * Math.sign(s) * Math.abs(s) ** ex;
    const tri = 1 - Math.abs(((k % P) / P) * 2 - 1);
    const jitter = 0.7 + 0.6 * random(`${seed}${Math.floor(k / P)}`);
    const off = spike * tri * jitter;
    const len = Math.hypot(bx, by) || 1;
    pts.push(`${(bx + (bx / len) * off).toFixed(1)},${(by + (by / len) * off).toFixed(1)}`);
  }
  const baseY = tail.y > 0 ? h / 2 - 4 : -h / 2 + 4;
  const bx0 = clamp(tail.x * 0.4, -w / 2 + 50, w / 2 - 70);
  const tailPts = `${bx0 - 6},${baseY} ${bx0 + 44},${baseY} ${tail.x},${tail.y}`;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <polygon points={tailPts} fill={C.cream} stroke={col} strokeWidth={4} strokeLinejoin="round" {...NS} />
      <polygon points={pts.join(' ')} fill={C.cream} stroke={col} strokeWidth={4.5} strokeLinejoin="miter" {...NS} />
      <polygon points={tailPts} fill={C.cream} transform={`translate(0,${-Math.sign(tail.y) * 7})`} />
      {morph > 0.4 ? (
        <rect x={-w / 2 + 16} y={-h / 2 + 14} width={w - 32} height={h - 28} rx={18} fill="none" stroke={col} strokeOpacity={0.55 * (morph - 0.4) / 0.6} strokeWidth={3} strokeLinecap="round" strokeDasharray="0.1 9" {...NS} />
      ) : null}
      {lines.map((l, i) => (
        <text key={i} x={0} y={-((lines.length - 1) * lh) / 2 + i * lh + size * 0.36} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={morph > 0.5 ? 700 : 900} fontSize={size} letterSpacing={size * 0.04} fill={col}>
          {l}
        </text>
      ))}
      {badge !== undefined ? <Badge x={-w / 2 + 10} y={-h / 2 + 8} n={badge} /> : null}
    </g>
  );
};

/** Faceted rocky hill. Origin = base centre; the top plateau is at y = -h. */
export const RockyHill: React.FC<{x: number; y: number; w?: number; h?: number; fill?: string}> = ({x, y, w = 520, h = 210, fill = '#5D5A73'}) => {
  const hw = w / 2;
  const d = `M ${-hw} 4 L ${-hw * 0.72} ${-h * 0.55} L ${-hw * 0.38} ${-h * 0.9} L ${-hw * 0.12} ${-h} L ${hw * 0.2} ${-h} L ${hw * 0.46} ${-h * 0.82} L ${hw * 0.74} ${-h * 0.42} L ${hw} 4 Z`;
  return (
    <g transform={`translate(${x},${y})`}>
      <path d={d} fill={fill} {...ink()} />
      <path d={`M ${-hw * 0.38} ${-h * 0.9} L ${-hw * 0.2} ${-h * 0.45} L ${-hw * 0.46} ${-h * 0.1}`} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={3} {...NS} />
      <path d={`M ${hw * 0.46} ${-h * 0.82} L ${hw * 0.3} ${-h * 0.36} L ${hw * 0.5} ${-h * 0.05}`} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={3} {...NS} />
      <path d={`M ${-hw * 0.12} ${-h} L ${hw * 0.2} ${-h}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={5} {...NS} />
    </g>
  );
};

/** Grey ash patch on the ground. Origin = centre on the ground line. */
export const AshPatch: React.FC<{x: number; y: number; w?: number}> = ({x, y, w = 340}) => (
  <g transform={`translate(${x},${y})`}>
    <ellipse cx={0} cy={6} rx={w / 2} ry={22} fill="#8D8A88" stroke={C.ink} strokeWidth={3} {...NS} />
    {new Array(14).fill(0).map((_, i) => (
      <circle key={i} cx={(random(`ash${i}`) - 0.5) * w * 0.85} cy={6 + (random(`ashy${i}`) - 0.5) * 22} r={3 + random(`ashr${i}`) * 3} fill="#5E5B5B" />
    ))}
  </g>
);

/** Parchment scroll that unrolls (0..1). Origin = centre. */
export const Scroll: React.FC<{x: number; y: number; unroll: number; title: string; sub?: string; w?: number; h?: number; scale?: number; rotate?: number; titleColor?: string}> = ({
  x,
  y,
  unroll,
  title,
  sub,
  w = 330,
  h = 420,
  scale = 1,
  rotate = 0,
  titleColor = C.red,
}) => {
  const id = sid(useId());
  const open = h * clamp(unroll);
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
      <defs>
        <clipPath id={`sc${id}`}>
          <rect x={-w / 2} y={-h / 2} width={w} height={open} />
        </clipPath>
      </defs>
      <g clipPath={`url(#sc${id})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#F3E6C8" {...ink()} />
        <text x={0} y={-h / 2 + 92} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={46} letterSpacing={2} fill={titleColor}>
          {title}
        </text>
        {sub ? (
          <text x={0} y={-h / 2 + 136} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={700} fontSize={26} letterSpacing={4} fill={C.ink} opacity={0.7}>
            {sub}
          </text>
        ) : null}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={-w / 2 + 40} y1={-h / 2 + 180 + i * 40} x2={w / 2 - (i === 4 ? 120 : 40)} y2={-h / 2 + 180 + i * 40} stroke="#CDB98F" strokeWidth={8} strokeLinecap="round" />
        ))}
      </g>
      <rect x={-w / 2 - 22} y={-h / 2 - 22} width={w + 44} height={34} rx={17} fill="#D9BE8C" {...ink(OUTLINE * 0.85)} />
      <rect x={-w / 2 - 22} y={-h / 2 + open - 12} width={w + 44} height={34} rx={17} fill="#D9BE8C" {...ink(OUTLINE * 0.85)} />
    </g>
  );
};

/** Red rubber stamp. `t` 0..1 = thump-in progress. Origin = centre. */
export const Stamp: React.FC<{x: number; y: number; text: string; t: number; rotate?: number; color?: string; size?: number}> = ({x, y, text, t, rotate = -10, color = C.red, size = 40}) => {
  if (t <= 0) return null;
  const s = 1.7 - 0.7 * Math.min(1, t);
  const w = text.length * size * 0.72 + 50;
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${s})`} opacity={Math.min(1, t * 2.5)}>
      <rect x={-w / 2} y={-size * 1.05} width={w} height={size * 2.1} rx={10} fill="none" stroke={color} strokeWidth={7} />
      <rect x={-w / 2 + 11} y={-size * 1.05 + 11} width={w - 22} height={size * 2.1 - 22} rx={6} fill="none" stroke={color} strokeWidth={2.5} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={color}>
        {text}
      </text>
    </g>
  );
};

export type Seg = [string, string?]; // [text, colour]

/** Cream verse card: small reference on top, serif lines with coloured segments. Origin = centre. */
export const Card: React.FC<{x: number; y: number; refText?: string; lines: Seg[][]; w?: number; size?: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  refText,
  lines,
  w = 820,
  size = 38,
  scale = 1,
  opacity = 1,
}) => {
  const lh = size * 1.3;
  const h = lines.length * lh + (refText ? 110 : 70);
  const top = -h / 2 + (refText ? 92 : 52);
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={24} fill={C.cream} {...ink(4)} />
      <rect x={-w / 2 + 14} y={-h / 2 + 14} width={w - 28} height={h - 28} rx={16} fill="none" stroke={C.gold} strokeOpacity={0.6} strokeWidth={3} strokeLinecap="round" strokeDasharray="0.1 9" {...NS} />
      {refText ? (
        <text x={0} y={-h / 2 + 56} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={700} fontSize={26} letterSpacing={5} fill={C.red}>
          {refText}
        </text>
      ) : null}
      {lines.map((segs, i) => (
        <text key={i} x={0} y={top + i * lh} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={700} fontSize={size} letterSpacing={size * 0.03} fill={C.captionInk}>
          {segs.map(([t, c], k) => (
            <tspan key={k} fill={c ?? C.captionInk} fontWeight={c ? 900 : 700}>
              {t}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  );
};

/** Wooden board sign on two posts. Origin = ground centre. */
export const BoardSign: React.FC<{x: number; y: number; w?: number; scale?: number; children?: React.ReactNode}> = ({x, y, w = 560, scale = 1, children}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <rect x={-w / 2 + 60} y={-260} width={22} height={260} fill={C.woodDark} {...ink()} />
    <rect x={w / 2 - 82} y={-260} width={22} height={260} fill={C.woodDark} {...ink()} />
    <rect x={-w / 2} y={-400} width={w} height={170} rx={14} fill={C.plank} {...ink()} />
    <rect x={-w / 2 + 16} y={-384} width={w - 32} height={138} rx={8} fill="none" stroke={C.plankLine} strokeWidth={2.5} {...NS} />
    <g transform="translate(0,-315)">{children}</g>
  </g>
);

/** Broken heart: pink halves with a zigzag crack. */
export const BrokenHeart: React.FC<{x: number; y: number; scale?: number; split?: number}> = ({x, y, scale = 1, split = 6}) => {
  const id = sid(useId());
  const crack = 'M 0 -26 L -6 -12 L 5 -2 L -5 8 L 0 18';
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <defs>
        <clipPath id={`bl${id}`}>
          <path d={`${crack} L -40 18 L -40 -40 L 0 -40 Z`} />
        </clipPath>
        <clipPath id={`br${id}`}>
          <path d={`${crack} L 40 18 L 40 -40 L 0 -40 Z`} />
        </clipPath>
      </defs>
      <g transform={`translate(${-split / 2},0) rotate(-6)`} clipPath={`url(#bl${id})`}>
        <path d={heartPath(1)} fill={C.heartPink} stroke={C.red} strokeWidth={4} {...NS} />
      </g>
      <g transform={`translate(${split / 2},0) rotate(6)`} clipPath={`url(#br${id})`}>
        <path d={heartPath(1)} fill={C.heartPink} stroke={C.red} strokeWidth={4} {...NS} />
      </g>
      <path d={crack} fill="none" stroke={C.red} strokeWidth={3} transform={`translate(${-split / 2},0)`} {...NS} />
    </g>
  );
};

/** Gold music note. */
export const MusicNote: React.FC<{x: number; y: number; scale?: number; opacity?: number; rotate?: number}> = ({x, y, scale = 1, opacity = 1, rotate = 0}) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
    <ellipse cx={-10} cy={18} rx={15} ry={11} transform="rotate(-20 -10 18)" fill={C.gold} stroke={C.ink} strokeWidth={3} {...NS} />
    <path d="M 3 14 L 3 -36 Q 22 -26 26 -8" fill="none" stroke={C.ink} strokeWidth={4} strokeLinecap="round" {...NS} />
  </g>
);

/** Small lyre-harp. Origin = base. */
export const Harp: React.FC<{x: number; y: number; scale?: number; pluck?: number}> = ({x, y, scale = 1, pluck = 0}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <path d="M -40 0 Q -62 -70 -30 -120 L 34 -112 Q 56 -60 40 0 Z" fill="none" stroke={C.wood} strokeWidth={12} strokeLinejoin="round" />
    <path d="M -40 0 Q -62 -70 -30 -120 L 34 -112 Q 56 -60 40 0 Z" fill="none" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" {...NS} />
    {[-20, -6, 8, 22].map((sx, i) => (
      <line key={i} x1={sx} y1={-6} x2={sx + 2 + (i === 1 ? Math.sin(pluck * 30) * 3 * pluck : 0)} y2={-110} stroke="#F6E3B4" strokeWidth={2.5} />
    ))}
    <rect x={-46} y={-8} width={92} height={14} rx={6} fill={C.woodDark} {...ink(3)} />
  </g>
);

/** Swirling column of warm gold light (God shown only as light), with wind lines. */
export const LightColumn: React.FC<{x: number; y: number; frame: number; strength?: number; height?: number}> = ({x, y, frame, strength = 1, height = 1180}) => {
  const id = sid(useId());
  if (strength <= 0) return null;
  return (
    <g opacity={strength}>
      <defs>
        <linearGradient id={`lc${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#FFD98A" stopOpacity={0} />
          <stop offset="0.5" stopColor="#FFF1C9" stopOpacity={0.95} />
          <stop offset="1" stopColor="#FFD98A" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={`lg${id}`}>
          <stop offset="0" stopColor="#FFE7AE" stopOpacity={0.9} />
          <stop offset="0.5" stopColor="#FFC96A" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFC96A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y - height * 0.45} rx={520} ry={height * 0.75} fill={`url(#lg${id})`} />
      <rect x={x - 150} y={y - height} width={300} height={height} fill={`url(#lc${id})`} />
      {new Array(7).fill(0).map((_, i) => {
        const yy = y - ((i / 7) * height + frame * 3.2) % height;
        const r = 120 + 40 * Math.sin(i * 1.3);
        const ph = frame / 14 + i;
        return (
          <path
            key={i}
            d={`M ${x - r * Math.cos(ph)} ${yy} Q ${x} ${yy - 36} ${x + r * Math.cos(ph)} ${yy - 8}`}
            fill="none"
            stroke="#E8B24A"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.7}
            {...NS}
          />
        );
      })}
      {new Array(9).fill(0).map((_, i) => {
        const yy = 300 + random(`wl${i}`) * 820;
        const len = 60 + random(`wll${i}`) * 90;
        const xx = ((random(`wlx${i}`) * 1300 + frame * (5 + random(`wls${i}`) * 4)) % 1400) - 160;
        return <line key={`w${i}`} x1={xx} y1={yy} x2={xx + len} y2={yy} stroke="#FFF4D8" strokeWidth={3.5} strokeLinecap="round" opacity={0.75} />;
      })}
    </g>
  );
};

/** Simple flat wooden cross silhouette. Origin = foot of the cross. */
export const FlatCross: React.FC<{x: number; y: number; h?: number; beamY?: number; beamW?: number}> = ({x, y, h = 560, beamY = 440, beamW = 440}) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-22} y={-h} width={44} height={h} fill="#7A5A44" {...ink()} />
    <rect x={-beamW / 2} y={-beamY - 22} width={beamW} height={44} fill="#7A5A44" {...ink()} />
  </g>
);

/** HONEST PRAYERS row: 4 slots, filled gold with a white check. */
export const PrayerRow: React.FC<{
  frame: number;
  fills: (number | null)[]; // frame each slot fills (null = never)
  labels?: string[];
  pulse?: boolean[]; // slots that pulse while empty
  y?: number;
  opacity?: number;
}> = ({frame, fills, labels = ['DAVID', 'JOB', 'JESUS', 'YOU?'], pulse = [false, false, false, true], y = 260, opacity = 1}) => {
  const xs = [270, 430, 590, 750];
  return (
    <g opacity={opacity}>
      <text x={510} y={y - 58} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={20} letterSpacing={3} fill="#FFFFFF" opacity={0.75}>
        HONEST PRAYERS
      </text>
      {xs.map((x, i) => {
        const at = fills[i];
        const on = at !== null && frame >= at;
        const p = on ? pop(frame, at as number, 10) : 0;
        const breathe = !on && pulse[i] ? 1 + 0.06 * Math.sin(frame / 7) : 1;
        const burst = on ? clamp((frame - (at as number)) / 18) : 1;
        return (
          <g key={i} transform={`translate(${x},${y})`}>
            {on && burst < 1 ? <circle r={35 + 40 * burst} fill="none" stroke={C.gold} strokeWidth={4} opacity={1 - burst} /> : null}
            <circle r={35 * breathe} fill={C.cream} {...ink(4.5)} />
            {!on && pulse[i] ? <circle r={35 * breathe} fill={C.gold} opacity={0.15 + 0.15 * Math.sin(frame / 7)} /> : null}
            {on ? (
              <g transform={`scale(${p})`}>
                <circle r={35} fill={C.gold} {...ink(4.5)} />
                <path d="M -13 1 L -3 11 L 15 -10" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : null}
            <text x={0} y={64} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={20} letterSpacing={1.5} fill="#FFFFFF" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>
              {labels[i]}
            </text>
          </g>
        );
      })}
    </g>
  );
};

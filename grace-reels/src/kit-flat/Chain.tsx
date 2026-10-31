// Flat kit additions (Who Made God?): chain cards + arrows, step counter,
// chessboard, easel + painting, burning bush, Α–Ω timeline bar, stable +
// manger, mountains, red X and gold check.
import React, {useId} from 'react';
import {random} from 'remotion';
import {C, OUTLINE} from './palette';
import {FONT_SERIF, FONT_UI} from './fonts';
import {clamp, sid} from './anim';
import {FlatGalaxy, Planet} from './Cosmos';

const NS = {vectorEffect: 'non-scaling-stroke' as const};
const ink = (w = OUTLINE) => ({stroke: C.ink, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, ...NS});

export type ChainIcon = 'you' | 'parents' | 'grand' | 'great' | 'earth' | 'sun' | 'stars' | 'galaxies' | 'universe' | 'phone' | 'house' | 'baby' | 'iam';

const Peg: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M -18 0 L -14 -44 Q -14 -52 -6 -52 L 6 -52 Q 14 -52 14 -44 L 18 0 Z" fill={fill} {...ink(3)} />
    <circle cx={0} cy={-64} r={12} fill={fill} {...ink(3)} />
  </g>
);

const Icon: React.FC<{icon: ChainIcon}> = ({icon}) => {
  switch (icon) {
    case 'you':
      return <Peg x={0} y={30} s={1.1} fill={C.youBlue} />;
    case 'baby':
      return <Peg x={0} y={24} s={0.75} fill={C.robeBlush} />;
    case 'parents':
      return (
        <>
          <Peg x={-20} y={30} fill={C.robeBlue} />
          <Peg x={20} y={30} fill={C.robeBlush} />
        </>
      );
    case 'grand':
      return (
        <>
          <Peg x={-20} y={30} fill={C.robeGrey} />
          <Peg x={20} y={30} fill={C.robeCream} />
        </>
      );
    case 'great':
      return (
        <>
          <Peg x={-26} y={30} s={0.85} fill={C.robeStone} />
          <Peg x={0} y={30} s={0.85} fill={C.robeSage} />
          <Peg x={26} y={30} s={0.85} fill={C.robeRust} />
        </>
      );
    case 'earth':
      return <Planet x={0} y={0} r={40} color="#7FA3D6" />;
    case 'sun':
      return (
        <g>
          {new Array(8).fill(0).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} x1={Math.cos(a) * 46} y1={Math.sin(a) * 46} x2={Math.cos(a) * 58} y2={Math.sin(a) * 58} stroke={C.gold} strokeWidth={6} strokeLinecap="round" />;
          })}
          <circle r={38} fill="#F6C454" {...ink(4)} />
        </g>
      );
    case 'stars':
      return (
        <g fill="#F6E3A4" {...ink(3)}>
          {[[-24, -10, 16], [22, -22, 11], [12, 22, 13]].map(([x, y, r], i) => (
            <path key={i} d={`M ${x} ${y - r} L ${x + r * 0.3} ${y - r * 0.3} L ${x + r} ${y} L ${x + r * 0.3} ${y + r * 0.3} L ${x} ${y + r} L ${x - r * 0.3} ${y + r * 0.3} L ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.3} Z`} />
          ))}
        </g>
      );
    case 'galaxies':
      return <FlatGalaxy x={0} y={0} r={46} color="#E9D9B8" seed="ic" />;
    case 'universe':
      return (
        <g>
          <circle r={46} fill="#2D2B4F" {...ink(4)} />
          {new Array(14).fill(0).map((_, i) => (
            <circle key={i} cx={(random(`u${i}`) - 0.5) * 66} cy={(random(`uy${i}`) - 0.5) * 66} r={2.5} fill="#FFFFFF" />
          ))}
        </g>
      );
    case 'phone':
      return (
        <g>
          <rect x={-26} y={-46} width={52} height={92} rx={10} fill="#2F3442" {...ink(4)} />
          <rect x={-18} y={-34} width={36} height={60} rx={4} fill="#9FC1E6" />
        </g>
      );
    case 'house':
      return (
        <g>
          <rect x={-36} y={-10} width={72} height={50} fill={C.house} {...ink(4)} />
          <path d="M -46 -8 L 0 -48 L 46 -8 Z" fill={C.roof} {...ink(4)} />
          <rect x={-10} y={12} width={20} height={28} fill={C.woodDark} {...ink(3)} />
        </g>
      );
    default:
      return null;
  }
};

/** Rounded cream chain card with an icon and a caps label. `gold` = the uncaused first card. Origin = centre. */
export const ChainCard: React.FC<{x: number; y: number; icon: ChainIcon; label: string; scale?: number; dark?: number; gold?: boolean; opacity?: number; rotate?: number}> = ({
  x,
  y,
  icon,
  label,
  scale = 1,
  dark = 0,
  gold = false,
  opacity = 1,
  rotate = 0,
}) => {
  const w = 190;
  const h = 210;
  const gid = sid(useId());
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
      {gold ? (
        <>
          <defs>
            <radialGradient id={`cg${gid}`}>
              <stop offset="0" stopColor="#FFE7AE" stopOpacity={0.85} />
              <stop offset="0.5" stopColor="#FFD27A" stopOpacity={0.3} />
              <stop offset="1" stopColor="#FFD27A" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle r={260} fill={`url(#cg${gid})`} />
        </>
      ) : null}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} fill={gold ? '#F6D27A' : C.cream} {...ink(4.5)} />
      {icon !== 'iam' ? <g transform="translate(0,-18)">{<Icon icon={icon} />}</g> : null}
      <text x={0} y={icon === 'iam' ? 22 : 78} textAnchor="middle" fontFamily={icon === 'iam' ? FONT_SERIF : FONT_UI} fontWeight={icon === 'iam' ? 900 : 600} fontSize={icon === 'iam' ? 58 : 20} letterSpacing={1} fill={gold ? '#7A4E12' : C.captionInk}>
        {label}
      </text>
      {dark > 0 ? <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} fill="#1B1A2C" opacity={0.75 * dark} /> : null}
    </g>
  );
};

/** Gold arrow from (x1,y1) to (x2,y2) that draws on with `draw` 0..1. */
export const ChainArrow: React.FC<{x1: number; y1: number; x2: number; y2: number; draw?: number; color?: string; opacity?: number; width?: number}> = ({x1, y1, x2, y2, draw = 1, color = C.gold, opacity = 1, width = 7}) => {
  if (draw <= 0) return null;
  const ex = x1 + (x2 - x1) * draw;
  const ey = y1 + (y2 - y1) * draw;
  const a = Math.atan2(y2 - y1, x2 - x1);
  return (
    <g opacity={opacity} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={x1} y1={y1} x2={ex} y2={ey} />
      {draw > 0.95 ? <path d={`M ${ex - Math.cos(a - 0.5) * 22} ${ey - Math.sin(a - 0.5) * 22} L ${ex} ${ey} L ${ex - Math.cos(a + 0.5) * 22} ${ey - Math.sin(a + 0.5) * 22}`} /> : null}
    </g>
  );
};

/** STEPS BACK counter (screen space). */
export const StepCounter: React.FC<{x?: number; y?: number; value: string; opacity?: number; roll?: number}> = ({x = 540, y = 270, value, opacity = 1, roll = 0}) => (
  <g transform={`translate(${x},${y})`} opacity={opacity}>
    <text x={0} y={-58} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={18} letterSpacing={4} fill="#FFFFFF" opacity={0.8}>
      STEPS BACK
    </text>
    <g transform={`translate(0,${roll * -10})`} opacity={1 - roll * 0.6}>
      <text x={0} y={18} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={64} fill={C.ink} stroke={C.ink} strokeWidth={12} strokeLinejoin="round">
        {value}
      </text>
      <text x={0} y={18} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={64} fill={C.cream}>
        {value}
      </text>
    </g>
  </g>
);

/** Flat chessboard with a sliding piece. Origin = board centre. */
export const Chessboard: React.FC<{x: number; y: number; size?: number; piece?: number; scale?: number; wobble?: number}> = ({x, y, size = 300, piece = 1, scale = 1, wobble = 0}) => {
  const c = size / 4;
  return (
    <g transform={`translate(${x},${y}) rotate(${wobble}) scale(${scale})`}>
      <rect x={-size / 2 - 14} y={-size / 2 - 14} width={size + 28} height={size + 28} rx={10} fill={C.woodDark} {...ink()} />
      {new Array(16).fill(0).map((_, i) => (
        <rect key={i} x={-size / 2 + (i % 4) * c} y={-size / 2 + Math.floor(i / 4) * c} width={c} height={c} fill={(i + Math.floor(i / 4)) % 2 ? '#7A5A44' : '#EBDCC0'} />
      ))}
      <rect x={-size / 2} y={-size / 2} width={size} height={size} fill="none" {...ink(3)} />
      <g transform={`translate(${-c * 1.5 + c * 2 * clamp(piece)},${-c * 0.5 - c * 0.5 * clamp(piece)})`}>
        <path d="M -20 30 L 20 30 L 14 0 Q 26 -14 0 -34 Q -26 -14 -14 0 Z" fill="#F7F3EA" {...ink(4)} />
        <circle cx={0} cy={-38} r={9} fill="#F7F3EA" {...ink(3.5)} />
      </g>
      <g transform={`translate(${c * 0.5},${c * 1.5})`}>
        <path d="M -20 30 L 20 30 L 14 0 Q 26 -14 0 -34 Q -26 -14 -14 0 Z" fill="#2F2B33" {...ink(4)} />
      </g>
    </g>
  );
};

/** Easel with a canvas; children are drawn inside the canvas (clipped). Origin = ground centre. */
export const Easel: React.FC<{x: number; y: number; scale?: number; children?: React.ReactNode}> = ({x, y, scale = 1, children}) => {
  const id = sid(useId());
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <line x1={-90} y1={0} x2={-30} y2={-460} {...ink()} stroke={C.woodDark} strokeWidth={10} />
      <line x1={90} y1={0} x2={30} y2={-460} {...ink()} stroke={C.woodDark} strokeWidth={10} />
      <line x1={0} y1={-60} x2={0} y2={-470} {...ink()} stroke={C.woodDark} strokeWidth={10} />
      <defs>
        <clipPath id={`ea${id}`}>
          <rect x={-150} y={-440} width={300} height={240} />
        </clipPath>
      </defs>
      <rect x={-160} y={-450} width={320} height={260} rx={6} fill="#FBF7EE" {...ink()} />
      <g clipPath={`url(#ea${id})`}>
        <rect x={-150} y={-440} width={300} height={240} fill="#CFE0EC" />
        <rect x={-150} y={-300} width={300} height={100} fill="#BFD7A6" />
        <g transform="translate(0,-320)">{children}</g>
      </g>
      <rect x={-170} y={-196} width={340} height={14} rx={5} fill={C.woodDark} {...ink(4)} />
    </g>
  );
};

/** Painter's palette. */
export const PaintPalette: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <path d="M -50 0 Q -50 -36 0 -36 Q 50 -36 50 0 Q 50 30 10 26 Q -6 24 -8 34 Q -12 44 -30 34 Q -50 24 -50 0 Z" fill="#E9D3A6" {...ink(4)} />
    {[['#B4432F', -26, -14], ['#3D6494', -2, -20], ['#C8952E', 22, -12], ['#2F7A68', 24, 10]].map(([c, cx, cy], i) => (
      <circle key={i} cx={cx as number} cy={cy as number} r={7} fill={c as string} />
    ))}
  </g>
);

/** Flat bush with layered gold-white flames that flicker but never burn it. Origin = ground centre. */
export const BurningBush: React.FC<{x: number; y: number; frame: number; scale?: number; glow?: number}> = ({x, y, frame, scale = 1, glow = 1}) => {
  const id = sid(useId());
  const flame = (fx: number, h: number, w: number, fill: string, i: number) => {
    const n = (random(`bb${i}-${Math.floor(frame / 3)}`) - 0.5) * 0.12;
    const s = 1 + Math.sin(frame / 3.3 + i * 1.9) * 0.08 + n;
    return (
      <path
        key={`${fill}${i}`}
        transform={`translate(${fx},-60) scale(1,${s})`}
        d={`M ${-w} 0 C ${-w} ${-h * 0.45}, ${-w * 0.2} ${-h * 0.62}, 0 ${-h} C ${w * 0.2} ${-h * 0.62}, ${w} ${-h * 0.45}, ${w} 0 Q 0 16 ${-w} 0 Z`}
        fill={fill}
        opacity={0.95}
      />
    );
  };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <defs>
        <radialGradient id={`bg${id}`}>
          <stop offset="0" stopColor="#FFF4D2" stopOpacity={0.85} />
          <stop offset="0.45" stopColor="#FFD27A" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFD27A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={0} cy={-120} r={330 * glow} fill={`url(#bg${id})`} />
      {[[-70, 0, 70], [70, 0, 72], [0, -30, 84], [-36, -70, 60], [40, -66, 60]].map(([bx, by, r], i) => (
        <circle key={`o${i}`} cx={bx} cy={by - 50} r={r} fill="#6F8A5B" {...ink()} />
      ))}
      {[[-70, 0, 70], [70, 0, 72], [0, -30, 84], [-36, -70, 60], [40, -66, 60]].map(([bx, by, r], i) => (
        <circle key={`f${i}`} cx={bx} cy={by - 50} r={r} fill="#6F8A5B" />
      ))}
      {flame(-60, 170, 36, '#F7C24E', 0)}
      {flame(60, 180, 38, '#F7C24E', 1)}
      {flame(0, 250, 48, '#FBDD7E', 2)}
      {flame(-28, 160, 28, '#FFF1C2', 3)}
      {flame(28, 170, 28, '#FFF1C2', 4)}
      {flame(0, 130, 22, '#FFFFFF', 5)}
    </g>
  );
};

/** Gold timeline bar with big Α and Ω at the ends. Origin = bar centre. */
export const AlphaOmegaBar: React.FC<{x: number; y: number; w?: number; draw?: number; letters?: number}> = ({x, y, w = 820, draw = 1, letters = 1}) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-w / 2} y={-12} width={w * clamp(draw)} height={24} rx={12} fill={C.gold} {...ink(4)} />
    {[-1, 1].map((s, i) => (
      <g key={i} opacity={letters} transform={`translate(${(s * w) / 2},-60)`}>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={120} fill={C.ink} stroke={C.ink} strokeWidth={14} strokeLinejoin="round">
          {s < 0 ? 'Α' : 'Ω'}
        </text>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={120} fill={C.gold}>
          {s < 0 ? 'Α' : 'Ω'}
        </text>
        <text x={0} y={110} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={20} letterSpacing={2} fill="#FFFFFF">
          {s < 0 ? 'THE BEGINNING' : 'THE END'}
        </text>
      </g>
    ))}
  </g>
);

/** Small stable with a manger and a glowing baby. Origin = ground centre. */
export const Stable: React.FC<{x: number; y: number; scale?: number; glow?: number}> = ({x, y, scale = 1, glow = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <circle cx={0} cy={-80} r={200} fill="#FFE2A0" opacity={0.35 * glow} />
    <path d="M -230 0 L -230 -230 L 0 -340 L 230 -230 L 230 0" fill="#8C6A52" {...ink()} />
    <path d="M -190 0 L -190 -210 L 0 -300 L 190 -210 L 190 0 Z" fill="#3B3044" {...ink(4)} />
    <path d="M -260 -226 L 0 -360 L 260 -226" fill="none" stroke={C.woodDark} strokeWidth={22} strokeLinecap="round" />
    <path d="M -260 -226 L 0 -360 L 260 -226" fill="none" {...ink()} />
    <circle cx={0} cy={-60} r={110} fill="#FFE7AE" opacity={0.55 * glow} />
    <path d="M -90 -70 L 90 -70 L 60 -10 L -60 -10 Z" fill="#C79A5E" {...ink()} />
    <line x1={-70} y1={-10} x2={-90} y2={0} {...ink()} />
    <line x1={70} y1={-10} x2={90} y2={0} {...ink()} />
    <path d="M -80 -72 Q 0 -96 80 -72" fill="#F2D27C" {...ink(3)} />
    <ellipse cx={0} cy={-86} rx={34} ry={18} fill="#FBF5E6" stroke={C.jesusLine} strokeWidth={4} {...NS} />
    <circle cx={34} cy={-90} r={14} fill="#FBF5E6" stroke={C.jesusLine} strokeWidth={4} {...NS} />
  </g>
);

/** Flat mountains rising from the ground line. `rise` 0..1. */
export const Mountains: React.FC<{y: number; rise?: number}> = ({y, rise = 1}) => {
  const peaks: [number, number, number, string][] = [
    [160, 420, 300, '#5B5A7A'],
    [520, 560, 360, '#4C4B6B'],
    [880, 460, 320, '#5B5A7A'],
    [340, 300, 240, '#6A6A88'],
    [720, 320, 260, '#6A6A88'],
  ];
  return (
    <g>
      {peaks.map(([cx, h, hw, fill], i) => {
        const hh = h * clamp(rise * 1.2 - i * 0.05);
        return (
          <g key={i}>
            <path d={`M ${cx - hw} ${y + 2} L ${cx} ${y - hh} L ${cx + hw} ${y + 2} Z`} fill={fill} {...ink()} />
            <path d={`M ${cx - hw * 0.22} ${y - hh * 0.78} L ${cx} ${y - hh} L ${cx + hw * 0.22} ${y - hh * 0.78} L ${cx + hw * 0.08} ${y - hh * 0.72} L ${cx - hw * 0.06} ${y - hh * 0.8} Z`} fill="#F1EEF6" opacity={hh > 40 ? 0.9 : 0} />
          </g>
        );
      })}
    </g>
  );
};

/** Red X mark. */
export const RedX: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) =>
  s <= 0 ? null : (
    <g transform={`translate(${x},${y}) scale(${s})`} stroke={C.red} strokeWidth={12} strokeLinecap="round">
      <line x1={-26} y1={-26} x2={26} y2={26} />
      <line x1={26} y1={-26} x2={-26} y2={26} />
    </g>
  );

/** Gold check mark in a circle. */
export const GoldCheck: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) =>
  s <= 0 ? null : (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle r={34} fill={C.gold} {...ink(4)} />
      <path d="M -15 1 L -4 13 L 17 -12" fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );

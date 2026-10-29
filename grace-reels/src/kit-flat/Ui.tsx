import React, {useId} from 'react';
import {C} from './palette';
import {FONT_CAPTION, FONT_SERIF, FONT_UI} from './fonts';
import {sid} from './anim';

const NS = {vectorEffect: 'non-scaling-stroke' as const};

const serifCaps = (size: number) => ({fontFamily: FONT_SERIF, fontWeight: 900, fontSize: size, letterSpacing: 1.5});

/**
 * FEAR ↔ LOVE slider. `value` 0 = FEAR, 1 = LOVE. Origin = track centre.
 * The track fills from red to gold behind the knob.
 */
export const FearLoveMeter: React.FC<{
  x?: number;
  y?: number;
  width?: number;
  value: number;
  shake?: number; // px of knob jitter
  frame: number;
  scale?: number;
  opacity?: number;
  burst?: number; // 0..1 soft glow burst at LOVE
  labelsAbove?: boolean;
}> = ({x = 540, y = 260, width = 560, value, shake = 0, frame, scale = 1, opacity = 1, burst = 0, labelsAbove = false}) => {
  const id = sid(useId());
  const h = 26;
  const half = width / 2;
  const kx = -half + width * value + Math.sin(frame * 1.9) * shake;
  const ky = Math.cos(frame * 2.3) * shake * 0.4;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <defs>
        <linearGradient id={`mt${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={C.red} />
          <stop offset="1" stopColor={C.gold} />
        </linearGradient>
        <clipPath id={`mc${id}`}>
          <rect x={-half} y={-h / 2} width={Math.max(0, kx + half)} height={h} />
        </clipPath>
        <radialGradient id={`mb${id}`}>
          <stop offset="0" stopColor="#FFE3A3" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FFE3A3" stopOpacity={0} />
        </radialGradient>
      </defs>
      {burst > 0 ? <circle cx={half} cy={0} r={60 + 140 * burst} fill={`url(#mb${id})`} opacity={1 - burst * 0.6} /> : null}
      <rect x={-half} y={-h / 2} width={width} height={h} rx={h / 2} fill={C.cream} stroke={C.ink} strokeWidth={4.5} {...NS} />
      <rect
        x={-half}
        y={-h / 2}
        width={width}
        height={h}
        rx={h / 2}
        fill={`url(#mt${id})`}
        clipPath={`url(#mc${id})`}
        stroke={C.ink}
        strokeWidth={4.5}
        {...NS}
      />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={-half + width * t} y1={-h / 2 + 7} x2={-half + width * t} y2={h / 2 - 7} stroke={C.ink} strokeOpacity={0.25} strokeWidth={3} {...NS} />
      ))}
      <text x={labelsAbove ? -half + 10 : -half - 22} y={labelsAbove ? -36 : 12} textAnchor={labelsAbove ? 'middle' : 'end'} {...serifCaps(32)} fill={C.red} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>
        FEAR
      </text>
      <text x={labelsAbove ? half - 10 : half + 22} y={labelsAbove ? -36 : 12} textAnchor={labelsAbove ? 'middle' : 'start'} {...serifCaps(32)} fill={C.gold} stroke={C.ink} strokeWidth={6} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>
        LOVE
      </text>
      <g transform={`translate(${kx},${ky})`}>
        <circle r={27} fill={C.cream} stroke={C.ink} strokeWidth={5} {...NS} />
        <circle r={10} fill={value > 0.5 ? C.gold : C.red} opacity={0.9} />
      </g>
    </g>
  );
};

/** Two answer buttons (call to action). */
export const AnswerButtons: React.FC<{x: number; y: number; pressed?: 'FEAR' | 'LOVE' | null; scale?: number; pulse?: number}> = ({
  x,
  y,
  pressed = null,
  scale = 1,
  pulse = 0,
}) => {
  const btn = (bx: number, label: 'FEAR' | 'LOVE', col: string) => {
    const on = pressed === label;
    const s = on ? 1 + pulse * 0.06 : 1;
    return (
      <g transform={`translate(${bx},0) scale(${s})`}>
        <rect x={-150} y={-52} width={300} height={104} rx={52} fill={on ? col : C.cream} stroke={C.ink} strokeWidth={5} {...NS} />
        <text x={0} y={16} textAnchor="middle" {...serifCaps(46)} fill={on ? C.cream : col}>
          {label}
        </text>
      </g>
    );
  };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {btn(-170, 'FEAR', C.red)}
      {btn(170, 'LOVE', C.gold)}
    </g>
  );
};

/** Comment box that types `text` (chars shown = `chars`). HTML overlay. */
export const CommentBox: React.FC<{x: number; y: number; text: string; chars: number; frame: number; opacity?: number; scale?: number}> = ({
  x,
  y,
  text,
  chars,
  frame,
  opacity = 1,
  scale = 1,
}) => {
  const shown = Array.from(text).slice(0, Math.max(0, Math.floor(chars))).join('');
  const cursor = Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 640,
        transform: `translate(-50%,-50%) scale(${scale})`,
        opacity,
        background: '#FFFDF8',
        border: `5px solid ${C.ink}`,
        borderRadius: 32,
        padding: '22px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        boxSizing: 'border-box',
      }}
    >
      <div style={{width: 64, height: 64, borderRadius: 32, background: C.youBlue, border: `4px solid ${C.ink}`, flexShrink: 0}} />
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <div style={{fontFamily: FONT_UI, fontWeight: 600, fontSize: 24, color: '#8B8790'}}>you · now</div>
        <div style={{fontFamily: FONT_CAPTION, fontWeight: 700, fontSize: 44, color: C.captionInk, minHeight: 56}}>
          {shown}
          <span style={{opacity: cursor ? 1 : 0, color: C.gold}}>|</span>
        </div>
      </div>
    </div>
  );
};

/** Gold cross logo with three motion lines. Origin = cross centre. `draw` 0..1. */
export const CrossLogo: React.FC<{x: number; y: number; scale?: number; draw?: number; color?: string}> = ({
  x,
  y,
  scale = 1,
  draw = 1,
  color = C.gold,
}) => {
  const seg = (len: number, from: number, to: number) => {
    const p = Math.min(1, Math.max(0, (draw - from) / (to - from)));
    return {strokeDasharray: `${len * p} ${len}`};
  };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} fill="none" stroke={color} strokeLinecap="round">
      <line x1={0} y1={-60} x2={0} y2={70} strokeWidth={13} style={seg(130, 0, 0.45)} />
      <line x1={-38} y1={-22} x2={38} y2={-22} strokeWidth={13} style={seg(76, 0.35, 0.65)} />
      <line x1={-78} y1={-40} x2={-52} y2={-40} strokeWidth={7} style={seg(26, 0.6, 0.75)} />
      <line x1={-92} y1={-8} x2={-56} y2={-8} strokeWidth={7} style={seg(36, 0.68, 0.85)} />
      <line x1={-78} y1={24} x2={-52} y2={24} strokeWidth={7} style={seg(26, 0.78, 1)} />
    </g>
  );
};

/** Small brand mark, top-left, 55% opacity. HTML overlay. */
export const Brand: React.FC<{opacity?: number; onLight?: boolean}> = ({opacity = 0.55, onLight = false}) => (
  <div style={{position: 'absolute', left: 56, top: 150, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 10, opacity}}>
    <svg width={26} height={30} viewBox="-15 -16 30 34">
      <line x1={0} y1={-14} x2={0} y2={16} stroke={C.gold} strokeWidth={4} strokeLinecap="round" />
      <line x1={-9} y1={-5} x2={9} y2={-5} stroke={C.gold} strokeWidth={4} strokeLinecap="round" />
    </svg>
    <span style={{fontFamily: FONT_UI, fontWeight: 600, fontSize: 20, color: onLight ? C.captionInk : '#FFFFFF', textShadow: onLight ? 'none' : '0 1px 2px rgba(0,0,0,0.35)'}}>
      @GraceINMotion616
    </span>
  </div>
);

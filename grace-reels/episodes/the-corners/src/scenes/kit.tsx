import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {OUTLINE} from '../lib/theme';
import {clamp, lerp, noise1, rand, randRange, smooth} from '../lib/anim';
import {GrainHead} from '../chars/props';

// ------------------------------------------------------------------ 2D parallax camera
export type Cam2 = {x: number; y: number; zoom: number; rot?: number};
export const Layer: React.FC<{cam: Cam2; depth: number; children: React.ReactNode; style?: React.CSSProperties}> = ({cam, depth, children, style}) => {
  const s = 1 + (cam.zoom - 1) * depth;
  const tr = `translate(540px, 960px) scale(${s}) rotate(${(cam.rot ?? 0) * depth}deg) translate(${-540 - cam.x * depth}px, ${-960 - cam.y * depth}px)`;
  return (
    <AbsoluteFill style={{transform: tr, transformOrigin: '0 0', ...style}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{overflow: 'visible'}}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};

/** Floating dust motes, lit warm (seeded, pure function of t). */
export const Dust: React.FC<{t: number; n?: number; seed?: number; area?: [number, number, number, number]; color?: string; size?: number; opacity?: number}> = ({
  t, n = 40, seed = 1, area = [0, 0, 1080, 1920], color = '#FFE2A0', size = 4, opacity = 0.8,
}) => {
  const [x0, y0, x1, y1] = area;
  return (
    <g style={{mixBlendMode: 'screen'}}>
      {Array.from({length: n}).map((_, i) => {
        const sp = randRange(seed, i, 6, 22);
        const x = x0 + ((rand(seed + 1, i) * (x1 - x0) + noise1(seed + i, t * 0.3) * 40 + t * sp * 0.6) % (x1 - x0));
        const y = y0 + (((rand(seed + 2, i) * (y1 - y0) - t * sp) % (y1 - y0)) + (y1 - y0)) % (y1 - y0);
        const tw = 0.5 + 0.5 * Math.sin(t * randRange(seed + 3, i, 1, 3) + i);
        const r = size * (0.5 + rand(seed + 4, i));
        return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={opacity * tw} />;
      })}
    </g>
  );
};

/** Soft god-ray beam from (x,y) going down-ish with angle. */
export const Beam: React.FC<{id: string; x: number; y: number; w0: number; w1: number; len: number; angle?: number; opacity?: number; color?: string}> = ({
  id, x, y, w0, w1, len, angle = 0, opacity = 0.5, color = '#FFE0A0',
}) => (
  <g transform={`translate(${x},${y}) rotate(${angle})`} style={{mixBlendMode: 'screen'}}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity={opacity} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </linearGradient>
      <filter id={id + 'b'} x="-50%" y="-10%" width="200%" height="120%">
        <feGaussianBlur stdDeviation={18} />
      </filter>
    </defs>
    <path d={`M${-w0 / 2},0 L${w0 / 2},0 L${w1 / 2},${len} L${-w1 / 2},${len} Z`} fill={`url(#${id})`} filter={`url(#${id}b)`} />
  </g>
);

/** Foreground wheat stalks along the bottom edge (parallax + wind sway). */
export const FgWheat: React.FC<{t: number; y?: number; n?: number; seed?: number; scale?: number; dark?: number; lw?: number}> = ({
  t, y = 1920, n = 18, seed = 3, scale = 1, dark = 0.25, lw = 5,
}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const x = (i / (n - 1)) * 1160 - 40 + randRange(seed, i, -20, 20);
      const h = randRange(seed + 1, i, 260, 480) * scale;
      const sway = noise1(seed + i, t * 0.9) * 10 + Math.sin(t * 1.7 + i) * 4;
      const tipX = x + sway, tipY = y - h;
      return (
        <g key={i} opacity={1}>
          <path d={`M${x},${y + 20} Q${x + sway * 0.3},${y - h * 0.5} ${tipX},${tipY + 30}`} fill="none" stroke="#8A6A2C" strokeWidth={6 * scale} strokeLinecap="round" />
          <GrainHead x={tipX} y={tipY + 30} a={sway * 0.8} s={1.5 * scale} lw={lw} />
        </g>
      );
    })}
    <rect x={-50} y={y - 40} width={1180} height={80} fill={`rgba(60,34,10,${dark})`} />
  </g>
);

/** Grain kernels / heads falling in arcs from (x,y) into a target area, with squash on landing. */
export const GrainFall: React.FC<{t: number; t0: number; t1: number; from: [number, number]; to: [number, number]; n?: number; seed?: number; spread?: number; size?: number}> = ({
  t, t0, t1, from, to, n = 50, seed = 5, spread = 40, size = 7,
}) => {
  if (t < t0) return null;
  return (
    <g>
      {Array.from({length: n}).map((_, i) => {
        const st = lerp(t0, t1, i / n) + rand(seed, i) * 0.05;
        const fall = 0.45 + rand(seed + 1, i) * 0.2;
        const k = (t - st) / fall;
        if (k < 0) return null;
        const landed = k >= 1;
        const kk = clamp(k);
        const ox = randRange(seed + 2, i, -spread, spread);
        const x = lerp(from[0] + ox * 0.2, to[0] + ox, kk);
        const y = from[1] + (to[1] + randRange(seed + 3, i, -10, 10) - from[1]) * kk * kk;
        const sq = landed ? 1 - 0.35 * Math.max(0, 1 - (k - 1) * 6) : 1;
        if (landed && k > 2.2) return null; // settled into the pile
        return <ellipse key={i} cx={x} cy={y} rx={size * (landed ? 1.3 : 0.75) * (2 - sq)} ry={size * sq} fill={i % 3 ? '#F2C35A' : '#D9A23E'} stroke={OUTLINE} strokeWidth={1.4} transform={`rotate(${rand(seed + 4, i) * 180} ${x} ${y})`} />;
      })}
    </g>
  );
};

/** Warm blurred bokeh background (macro shots). */
export const Bokeh: React.FC<{t: number; seed?: number; n?: number}> = ({t, seed = 9, n = 26}) => (
  <g>
    <defs>
      <filter id="bokehblur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={10} />
      </filter>
    </defs>
    {Array.from({length: n}).map((_, i) => (
      <circle key={i} cx={rand(seed, i) * 1080 + noise1(seed + i, t * 0.2) * 30} cy={rand(seed + 1, i) * 1920 + noise1(seed + i + 50, t * 0.2) * 30} r={randRange(seed + 2, i, 30, 110)}
        fill={['#FFD27A', '#F7B455', '#FFE7B0', '#E89A4A'][i % 4]} opacity={randRange(seed + 3, i, 0.12, 0.38)} filter="url(#bokehblur)" />
    ))}
  </g>
);

/** Colour grade + vignette + paper grain over the whole picture. */
export const Grade: React.FC<{tint?: string; tintOpacity?: number; vignette?: number; grain?: number}> = ({tint, tintOpacity = 0, vignette = 0.45, grain = 0.09}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {tint && <AbsoluteFill style={{background: tint, opacity: tintOpacity, mixBlendMode: 'soft-light'}} />}
    <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 60% at 50% 48%, rgba(0,0,0,0) 55%, rgba(20,8,0,${vignette}) 100%)`}} />
    <Img src={staticFile('paper_grain.png')} style={{position: 'absolute', inset: 0, width: 1080, height: 1920, opacity: grain, mixBlendMode: 'overlay'}} />
  </AbsoluteFill>
);

/** Fade helper for scene-internal cross dissolves. */
export const fadeIn = (t: number, t0: number, d = 0.3) => smooth(clamp((t - t0) / d));

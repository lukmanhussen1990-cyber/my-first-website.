import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H, W, rng} from '../lib/anim';

/** Directional motion blur (x and y blur radii in px) applied to its children. */
export const DirBlur: React.FC<{id: string; x?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({id, x = 0, y = 0, children, style}) => {
  const on = x > 0.3 || y > 0.3;
  return (
    <AbsoluteFill style={{filter: on ? `url(#${id})` : undefined, ...style}}>
      {on ? (
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={`${x.toFixed(1)} ${y.toFixed(1)}`} />
          </filter>
        </svg>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

/** Wavy heat distortion over its children. */
export const HeatShimmer: React.FC<{id: string; t: number; amount: number; children: React.ReactNode}> = ({id, t, amount, children}) => {
  if (amount <= 0.01) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{filter: `url(#${id})`}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={`0.004 ${0.018 + 0.002 * Math.sin(t * 3)}`} numOctaves={2} seed={Math.floor(t * 12) % 50} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={amount * 26} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {children}
    </AbsoluteFill>
  );
};

/** Four-point sparkle star. */
export const Sparkle: React.FC<{x: number; y: number; size: number; rot?: number; opacity?: number; color?: string}> = ({x, y, size, rot = 0, opacity = 1, color = '#ffffff'}) => {
  if (size <= 0 || opacity <= 0) return null;
  return (
    <svg width={size * 2} height={size * 2} viewBox="-1 -1 2 2" style={{position: 'absolute', left: x - size, top: y - size, opacity, transform: `rotate(${rot}deg)`, overflow: 'visible'}}>
      <path d="M0,-1 C0.08,-0.2 0.2,-0.08 1,0 C0.2,0.08 0.08,0.2 0,1 C-0.08,0.2 -0.2,0.08 -1,0 C-0.2,-0.08 -0.08,-0.2 0,-1Z" fill={color} />
      <circle r={0.16} fill={color} />
    </svg>
  );
};

/** Puffy cartoon smoke clouds expanding from a point. */
export const Smoke: React.FC<{x: number; y: number; t: number; start: number; seed?: number; n?: number; spread?: number}> = ({x, y, t, start, seed = 4, n = 14, spread = 420}) => {
  const k = t - start;
  if (k < 0 || k > 2.2) return null;
  const r = rng(seed);
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {Array.from({length: n}, (_, i) => {
        const a = Math.PI * (0.05 + 0.9 * r());
        const dir = r() > 0.5 ? 1 : -1;
        const sp = spread * (0.4 + 0.6 * r());
        const e = 1 - Math.exp(-k * 3);
        const cx = x + dir * Math.cos(a) * sp * e;
        const cy = y - Math.sin(a) * sp * 0.25 * e + 20;
        const rad = (40 + r() * 70) * (0.4 + 1.2 * e);
        const o = Math.max(0, 1 - k / 2.2);
        return (
          <g key={i} opacity={o}>
            <circle cx={cx} cy={cy + 10} r={rad} fill="#c9d3e3" />
            <circle cx={cx} cy={cy} r={rad * 0.92} fill="#ffffff" />
          </g>
        );
      })}
    </svg>
  );
};

/** A huge thin orbit ellipse sweeping down past the camera, with a label and the planet sitting on it. */
export const OrbitRing: React.FC<{p: number; label: string; planet: React.ReactNode; color?: string}> = ({p, label, planet, color = '#ffe38a'}) => {
  if (p <= 0 || p >= 1) return null;
  const rx = 1500 + p * 700;
  const ry = 420 + p * 260;
  const top = -150 + p * 2300;
  const cy = top + ry;
  const o = Math.min(1, Math.sin(Math.PI * p) * 1.6);
  const th = (74 * Math.PI) / 180;
  return (
    <AbsoluteFill style={{opacity: o}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <ellipse cx={540} cy={cy} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={16} opacity={0.3} />
        <ellipse cx={540} cy={cy} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={5} strokeDasharray="30 18" />
      </svg>
      <div style={{position: 'absolute', left: 140, width: 640, top: top - 96, textAlign: 'center', fontFamily: 'Lilita One', fontSize: 62, color: '#fff', WebkitTextStroke: '10px #1a0d00', paintOrder: 'stroke fill'}}>
        {label}
      </div>
      <div style={{position: 'absolute', left: 540 + rx * Math.cos(th) * 0.55, top: cy - ry * Math.sin(th), transform: 'translate(-50%,-50%)'}}>{planet}</div>
    </AbsoluteFill>
  );
};

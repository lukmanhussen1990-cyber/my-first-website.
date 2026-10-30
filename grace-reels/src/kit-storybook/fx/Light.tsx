// Light effects: god rays, glowing orbs, bloom flashes, vignette, film grain, colour wash.
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Baked } from '../paint/Baked';
import { mulberry32 } from '../core/random';
import { radial } from '../paint/brush';

// soft diagonal shafts from a source point, baked once
export const GodRays: React.FC<{ id: string; x: number; y: number; angle: number; spread?: number; count?: number; length?: number; color?: string; opacity?: number; seed?: number }> = ({
  id, x, y, angle, spread = 0.5, count = 7, length = 2200, color = '255,224,170', opacity = 0.5, seed = 3,
}) => (
  <Baked
    id={`rays-${id}`}
    pad={200}
    res={0.5}
    blur={22}
    style={{ opacity, mixBlendMode: 'screen' }}
    paint={(ctx) => {
      const r = mulberry32(seed);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < count; i++) {
        const a = angle + (r() - 0.5) * spread;
        const w = 40 + r() * 140;
        const L = length * (0.6 + r() * 0.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, L, 0);
        const al = 0.18 + r() * 0.25;
        g.addColorStop(0, `rgba(${color},${al})`);
        g.addColorStop(0.6, `rgba(${color},${al * 0.4})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -w * 0.15);
        ctx.lineTo(L, -w);
        ctx.lineTo(L, w);
        ctx.lineTo(0, w * 0.15);
        ctx.fill();
        ctx.restore();
      }
    }}
  />
);

// a glowing orb (the fruit, God's light, a lamp) - layered radial gradients, pulsing
export const Orb: React.FC<{ x: number; y: number; r: number; core?: string; glow?: string; intensity?: number; pulse?: number; seed?: number }> = ({
  x, y, r, core = '255,246,220', glow = '255,196,110', intensity = 1, pulse = 0.08, seed = 1,
}) => {
  const frame = useCurrentFrame();
  const p = 1 + pulse * Math.sin(frame * 0.12 + seed) + pulse * 0.5 * Math.sin(frame * 0.31 + seed * 2);
  const I = intensity * p;
  const disc = (rad: number, stops: string) => (
    <div style={{ position: 'absolute', left: x - rad, top: y - rad, width: rad * 2, height: rad * 2, borderRadius: '50%', background: `radial-gradient(circle, ${stops})`, mixBlendMode: 'screen' }} />
  );
  return (
    <>
      {disc(r * 7, `rgba(${glow},${0.22 * I}) 0%, rgba(${glow},${0.08 * I}) 40%, rgba(${glow},0) 70%`)}
      {disc(r * 2.6, `rgba(${glow},${0.55 * I}) 0%, rgba(${glow},${0.25 * I}) 45%, rgba(${glow},0) 72%`)}
      {disc(r * 1.15, `rgba(${core},${Math.min(1, 0.95 * I)}) 0%, rgba(${core},${0.85 * I}) 55%, rgba(${glow},${0.4 * I}) 80%, rgba(${glow},0) 100%`)}
    </>
  );
};

// full-frame flash used for soft "light bloom" transitions
export const BloomFlash: React.FC<{ amount: number; color?: string; x?: number; y?: number }> = ({ amount, color = '255,240,214', x = 50, y = 45 }) =>
  amount <= 0.001 ? null : (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, rgba(${color},${amount}) 0%, rgba(${color},${amount * 0.85}) 45%, rgba(${color},${amount * 0.6}) 100%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );

export const Wash: React.FC<{ color: string; opacity: number; blend?: React.CSSProperties['mixBlendMode'] }> = ({ color, opacity, blend = 'normal' }) =>
  opacity <= 0.001 ? null : <AbsoluteFill style={{ background: color, opacity, mixBlendMode: blend }} />;

export const Vignette: React.FC<{ strength?: number; color?: string }> = ({ strength = 0.55, color = '8,6,14' }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 62% at 50% 46%, rgba(${color},0) 55%, rgba(${color},${strength}) 100%)`, pointerEvents: 'none' }} />
);

// animated grain from a baked noise tile
let grainTile: HTMLCanvasElement | null = null;
function tile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  const r = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(r() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const t = tile();
    const r = mulberry32(frame + 1);
    const ox = Math.floor(r() * 256);
    const oy = Math.floor(r() * 256);
    for (let y = -oy; y < 960; y += 256) for (let x = -ox; x < 540; x += 256) ctx.drawImage(t, x, y);
  }, [frame]);
  return <canvas ref={ref} width={540} height={960} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }} />;
};

// warm light spill (dawn through a window) as a soft parallelogram
export const LightBeam: React.FC<{ id: string; points: [number, number][]; color?: string; opacity?: number; blur?: number }> = ({ id, points, color = '255,214,160', opacity = 0.5, blur = 30 }) => (
  <Baked
    id={`beam-${id}`}
    res={0.5}
    blur={blur}
    pad={100}
    style={{ opacity, mixBlendMode: 'screen' }}
    paint={(ctx) => {
      const [p0, , p2] = points;
      const g = ctx.createLinearGradient(p0[0], p0[1], p2[0], p2[1]);
      g.addColorStop(0, `rgba(${color},0.9)`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.fill();
    }}
  />
);

export { radial };

// Code-drawn props: torch flame, ghost-outline people, phone + message bubble, the glowing fruit.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { noise1 } from '../core/random';
import { Orb } from './Light';

// flicker 0.75..1.15 for lighting things near a flame
export function flicker(frame: number, seed = 1) {
  const t = frame / 30;
  return 0.95 + 0.12 * noise1(t * 6 + seed, seed) + 0.06 * noise1(t * 17 + seed, seed + 3);
}

export const Torch: React.FC<{ x: number; y: number; scale?: number; seed?: number; handle?: boolean }> = ({ x, y, scale = 1, seed = 1, handle = false }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const S = 260;
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, S, S * 1.6);
    const t = frame / 30;
    const cx = S / 2;
    const base = S * 1.25;
    const f = flicker(frame, seed);
    // glow
    const g = ctx.createRadialGradient(cx, base - 60, 0, cx, base - 60, S * 0.6);
    g.addColorStop(0, `rgba(255,170,70,${0.45 * f})`);
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S * 1.6);
    ctx.globalCompositeOperation = 'lighter';
    const layers: [number, string][] = [[1, '255,90,30'], [0.75, '255,150,50'], [0.5, '255,215,120'], [0.28, '255,245,210']];
    for (const [k, col] of layers) {
      const h = 120 * k * f * (1 + 0.15 * noise1(t * 8 + k * 5, seed));
      const w = 34 * (0.55 + k * 0.45);
      const lean = noise1(t * 3 + k, seed + 7) * 14 * k;
      ctx.fillStyle = `rgba(${col},${0.55 + (1 - k) * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(cx - w, base);
      ctx.bezierCurveTo(cx - w * 1.1, base - h * 0.5, cx + lean - w * 0.3, base - h * 0.8, cx + lean * 1.4, base - h);
      ctx.bezierCurveTo(cx + lean + w * 0.3, base - h * 0.8, cx + w * 1.1, base - h * 0.5, cx + w, base);
      ctx.closePath();
      ctx.fill();
    }
    // sparks
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.9 + i * 0.37 + seed) % 1;
      const sx = cx + noise1(i * 9 + t, seed) * 30;
      const sy = base - 60 - ph * 140;
      ctx.fillStyle = `rgba(255,200,120,${(1 - ph) * 0.8})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2 * (1 - ph) + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (handle) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#3a2416';
      ctx.fillRect(cx - 7, base - 4, 14, 110);
    }
  }, [frame]);
  return <canvas ref={ref} width={S} height={S * 1.6} style={{ position: 'absolute', left: x - (S / 2) * scale, top: y - S * 1.25 * scale, width: S * scale, height: S * 1.6 * scale, mixBlendMode: 'screen' }} />;
};

// soft glowing outline people (used for "my parents / my friends / my past")
const FIGURES: Record<string, string> = {
  // simple storybook silhouettes, 200 x 520 box, feet at y=520
  woman:
    'M100 20 C 128 20 140 44 138 70 C 150 82 150 108 140 120 C 132 128 122 132 120 140 C 150 150 164 168 168 200 L 176 300 C 178 318 168 322 162 306 L 150 230 L 160 360 L 172 512 L 112 512 L 104 400 L 96 512 L 36 512 L 44 360 L 52 230 L 38 306 C 32 322 22 318 24 300 L 32 200 C 36 168 50 150 80 140 C 78 132 66 128 60 120 C 50 108 50 82 62 70 C 60 44 72 20 100 20 Z',
  man:
    'M100 14 C 126 14 138 36 136 60 C 136 86 124 104 112 112 L 112 128 C 150 136 170 152 174 190 L 182 310 C 184 330 170 332 166 314 L 156 220 L 152 330 L 146 514 L 108 514 L 100 360 L 92 514 L 54 514 L 48 330 L 44 220 L 34 314 C 30 332 16 330 18 310 L 26 190 C 30 152 50 136 88 128 L 88 112 C 76 104 64 86 64 60 C 62 36 74 14 100 14 Z',
  boy:
    'M100 150 C 122 150 132 168 131 188 C 131 208 121 222 111 228 L 111 238 C 140 244 154 256 157 284 L 163 372 C 164 386 154 388 151 375 L 144 306 L 141 390 L 137 514 L 108 514 L 100 416 L 92 514 L 63 514 L 59 390 L 56 306 L 49 375 C 46 388 36 386 37 372 L 43 284 C 46 256 60 244 89 238 L 89 228 C 79 222 69 208 69 188 C 68 168 78 150 100 150 Z',
};
export const Ghost: React.FC<{ kind: 'woman' | 'man' | 'boy'; x: number; y: number; h: number; opacity?: number; seed?: number; mirror?: boolean }> = ({ kind, x, y, h, opacity = 1, seed = 1, mirror }) => {
  const frame = useCurrentFrame();
  const s = h / 520;
  const bob = noise1(frame / 30 * 0.4 + seed, seed) * 4;
  return (
    <svg width={200 * s} height={520 * s} viewBox="0 0 200 520" style={{ position: 'absolute', left: x - 100 * s, top: y - 520 * s + bob, opacity, overflow: 'visible', transform: mirror ? 'scaleX(-1)' : undefined, filter: 'drop-shadow(0 0 10px rgba(205,200,255,0.55))' }}>
      <path d={FIGURES[kind]} fill="rgba(170,166,210,0.10)" stroke="rgba(236,232,255,0.92)" strokeWidth={2.4 / s} strokeLinejoin="round" />
      <path d={FIGURES[kind]} fill="none" stroke="rgba(190,184,240,0.35)" strokeWidth={9 / s} strokeLinejoin="round" />
    </svg>
  );
};

// phone screen close-up with a message being typed and sent
export const PhoneScreen: React.FC<{ x: number; y: number; w: number; text: string; typed: number; sent: number; glow?: number }> = ({ x, y, w, text, typed, sent, glow = 1 }) => {
  const h = w * 2.05;
  const shown = text.slice(0, Math.round(text.length * Math.min(1, typed)));
  const r = w * 0.12;
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: r, background: '#0d0f16', boxShadow: `0 0 ${80 * glow}px rgba(150,190,255,${0.35 * glow}), inset 0 0 0 ${w * 0.025}px #22252e` }}>
      <div style={{ position: 'absolute', inset: w * 0.04, borderRadius: r * 0.8, background: 'linear-gradient(180deg,#1b2233,#121722)', overflow: 'hidden', fontFamily: 'Montserrat', color: '#fff' }}>
        <div style={{ position: 'absolute', top: w * 0.08, width: '100%', textAlign: 'center', fontSize: w * 0.055, opacity: 0.6, fontWeight: 500 }}>Mom</div>
        {sent > 0 && (
          <div style={{ position: 'absolute', right: w * 0.06, bottom: w * 0.42 + sent * w * 0.08, maxWidth: '72%', padding: `${w * 0.035}px ${w * 0.05}px`, borderRadius: w * 0.06, background: '#3478f6', fontSize: w * 0.062, fontWeight: 500, opacity: Math.min(1, sent * 2), lineHeight: 1.3 }}>
            {text}
          </div>
        )}
        {sent > 0.6 && (
          <div style={{ position: 'absolute', right: w * 0.07, bottom: w * 0.36, fontSize: w * 0.04, opacity: 0.6 }}>Delivered</div>
        )}
        <div style={{ position: 'absolute', left: w * 0.05, right: w * 0.05, bottom: w * 0.12, height: w * 0.13, borderRadius: w * 0.07, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', padding: `0 ${w * 0.04}px`, fontSize: w * 0.058, fontWeight: 500 }}>
          {sent > 0 ? '' : shown}
          {sent <= 0 && <span style={{ display: 'inline-block', width: 2, height: w * 0.07, background: '#8fb4ff', marginLeft: 2, opacity: typed < 1 ? 1 : 0.6 }} />}
          <div style={{ position: 'absolute', right: w * 0.02, width: w * 0.1, height: w * 0.1, borderRadius: '50%', background: typed >= 1 ? '#3478f6' : 'rgba(255,255,255,0.15)', transform: `scale(${1 + (sent > 0 && sent < 0.3 ? 0.25 : 0)})` }} />
        </div>
      </div>
    </div>
  );
};

// the forbidden fruit: never an apple, just a glowing teardrop of light with a halo of sparks
export const GlowFruit: React.FC<{ x: number; y: number; r: number; intensity?: number }> = ({ x, y, r, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      <Orb x={x} y={y} r={r} intensity={intensity} core="255,250,230" glow="255,190,95" seed={3} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = t * 0.6 + (i * Math.PI) / 3;
        const d = r * (1.6 + 0.4 * Math.sin(t * 1.3 + i));
        return (
          <div key={i} style={{ position: 'absolute', left: x + Math.cos(a) * d - 3, top: y + Math.sin(a) * d * 0.8 - 3, width: 6, height: 6, borderRadius: '50%', background: `rgba(255,236,190,${0.7 * intensity})`, boxShadow: `0 0 10px rgba(255,210,140,${intensity})` }} />
        );
      })}
    </>
  );
};

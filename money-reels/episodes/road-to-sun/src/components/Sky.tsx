import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {H, W, clamp, mix, rng} from '../lib/anim';

/** Sky gradient: alt 0 = bright day, 0.5 = navy, 1 = black space. warm 0..1 tints toward the Sun. */
export const Sky: React.FC<{alt: number; warm?: number}> = ({alt, warm = 0}) => {
  const a = clamp(alt);
  const top = a < 0.5 ? mix('#1f80e2', '#0b1b4c', a * 2) : mix('#0b1b4c', '#020309', (a - 0.5) * 2);
  const bot = a < 0.5 ? mix('#8fd2ff', '#2b5ab9', a * 2) : mix('#2b5ab9', '#0b1030', (a - 0.5) * 2);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${bot} 100%)`}}>
      {warm > 0 ? (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #fff2b0 0%, #ffb02a 35%, #e0480f 70%, #4a0d05 100%)',
            opacity: clamp(warm),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

type CloudSpec = {x: number; y: number; s: number; flip: boolean; parts: number[][]};
const makeClouds = (seed: number, n: number, span: number): CloudSpec[] => {
  const r = rng(seed);
  return Array.from({length: n}, (_, i) => ({
    x: r() * (W + 400) - 200,
    y: (i / n) * span + r() * (span / n) * 0.6,
    s: 0.6 + r() * 0.9,
    flip: r() > 0.5,
    parts: Array.from({length: 4 + Math.floor(r() * 3)}, (_, k) => [k * 70 + r() * 30, -r() * 60 - 20, 55 + r() * 45]),
  }));
};

/**
 * Flat cartoon clouds. scrollY moves the whole cloud field down (camera rising),
 * the field repeats every `span` px so it never runs out.
 */
export const Clouds: React.FC<{seed?: number; n?: number; span?: number; scrollY: number; scrollX?: number; opacity?: number; scale?: number; stretch?: number}> = ({
  seed = 1, n = 8, span = 3200, scrollY, scrollX = 0, opacity = 1, scale = 1, stretch = 1,
}) => {
  const clouds = makeClouds(seed, n, span);
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{opacity}}>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {clouds.map((c, i) => {
          const y = ((((c.y + scrollY) % span) + span) % span) - (span - H) / 2 - 200;
          const x = ((((c.x + scrollX) % (W + 600)) + (W + 600)) % (W + 600)) - 300;
          if (y < -300 || y > H + 300) return null;
          const s = c.s * scale;
          const w = c.parts.length * 70 + 60;
          return (
            <g key={i} transform={`translate(${x},${y}) scale(${(c.flip ? -1 : 1) * s},${s * stretch})`}>
              <g transform="translate(0,14)" fill="#cfe5fb">
                {c.parts.map(([px, py, pr], k) => (
                  <circle key={k} cx={px} cy={py} r={pr} />
                ))}
                <rect x={-40} y={-40} width={w} height={60} rx={30} />
              </g>
              <g fill="#ffffff">
                {c.parts.map(([px, py, pr], k) => (
                  <circle key={k} cx={px} cy={py - 6} r={pr} />
                ))}
                <rect x={-40} y={-46} width={w} height={52} rx={26} />
              </g>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Star field drawn on a canvas.
 * - offsetX/offsetY scroll the field (with per-star depth for parallax)
 * - streakX/streakY stretch stars into lines along the motion
 * - radial > 0 switches to a hyperspace tunnel centred on (cx, cy)
 */
export const Stars: React.FC<{
  seed?: number; count?: number; offsetX?: number; offsetY?: number;
  streakX?: number; streakY?: number; radial?: number; radialT?: number; cx?: number; cy?: number;
  opacity?: number; color?: string;
}> = ({seed = 3, count = 260, offsetX = 0, offsetY = 0, streakX = 0, streakY = 0, radial = 0, radialT = 0, cx = W / 2, cy = H * 0.4, opacity = 1, color = '255,255,255'}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (opacity <= 0) return;
    const r = rng(seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const sx = r() * W, sy = r() * H, d = 0.25 + r() * 0.75, size = 0.8 + r() * 2.6 * d, tw = r() * 6.28;
      const alpha = opacity * (0.45 + 0.55 * d) * (0.8 + 0.2 * Math.sin(tw + offsetY * 0.01));
      if (radial > 0) {
        const ang = r() * Math.PI * 2;
        const R = Math.hypot(W, H) * 0.75;
        const base = (r() * R + radialT * (180 + 900 * d)) % R;
        const rr = base * base / R;
        const len = radial * (20 + 260 * d) * (rr / R + 0.15);
        const x0 = cx + Math.cos(ang) * rr, y0 = cy + Math.sin(ang) * rr;
        const x1 = cx + Math.cos(ang) * (rr + len), y1 = cy + Math.sin(ang) * (rr + len);
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.lineWidth = size * (0.5 + rr / R);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        continue;
      }
      const x = (((sx + offsetX * d) % W) + W) % W;
      const y = (((sy + offsetY * d) % H) + H) % H;
      const lx = streakX * d, ly = streakY * d;
      if (Math.hypot(lx, ly) > 2) {
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - lx, y - ly); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        if (size > 2.6) {
          ctx.fillStyle = `rgba(${color},${alpha * 0.25})`;
          ctx.beginPath(); ctx.arc(x, y, size * 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};

/** Anime-style speed lines. angle in degrees is the direction things fly past (e.g. 90 = downward). */
export const SpeedLines: React.FC<{t: number; intensity: number; angle?: number; seed?: number; color?: string; radial?: boolean; cx?: number; cy?: number}> = ({
  t, intensity, angle = 90, seed = 9, color = '255,255,255', radial = false, cx = W / 2, cy = H / 2,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (intensity <= 0.01) return;
    const r = rng(seed);
    const n = Math.round(38 * Math.min(1.5, intensity));
    const a = (angle * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const speed = 2200 + r() * 2600;
      const len = (260 + r() * 700) * intensity;
      const wdt = 2 + r() * 7;
      const alpha = (0.18 + r() * 0.4) * Math.min(1, intensity);
      if (radial) {
        const ang = r() * Math.PI * 2;
        const R = 1300;
        const d0 = 260 + ((r() * R + t * speed) % R);
        const x0 = cx + Math.cos(ang) * d0, y0 = cy + Math.sin(ang) * d0;
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.lineWidth = wdt;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); ctx.stroke();
        continue;
      }
      // lines spread across the screen perpendicular to the motion
      const across = r() * 2600 - 1300;
      const along = ((r() * 4000 + t * speed) % 4000) - 2000;
      const x = W / 2 + across * -dy + along * dx;
      const y = H / 2 + across * dx + along * dy;
      const g = ctx.createLinearGradient(x, y, x - dx * len, y - dy * len);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = wdt;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * len, y - dy * len); ctx.stroke();
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} />;
};

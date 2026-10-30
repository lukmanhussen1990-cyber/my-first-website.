// Floating dust motes and soft bokeh discs, drawn per frame from a seed.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { mulberry32, noise1 } from '../core/random';

type Common = { seed?: number; color?: string; opacity?: number; style?: React.CSSProperties; W?: number; H?: number };

export const Dust: React.FC<Common & { count?: number; size?: [number, number]; rise?: number; region?: [number, number, number, number] }> = ({
  seed = 1, color = '255,226,170', opacity = 1, count = 70, size = [1.5, 4.5], rise = 14, region, style, W = 1080, H = 1920,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const r = mulberry32(seed);
    const t = frame / fps;
    const [rx, ry, rw, rh] = region ?? [0, 0, W, H];
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const x0 = rx + r() * rw;
      const y0 = ry + r() * rh;
      const s = size[0] + r() * (size[1] - size[0]);
      const sp = 0.4 + r();
      const x = x0 + noise1(t * 0.25 * sp + i * 3.1, seed) * 40;
      const y = ry + ((((y0 - ry - t * rise * sp) % rh) + rh) % rh);
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3.2);
      g.addColorStop(0, `rgba(${color},${0.85 * tw * opacity})`);
      g.addColorStop(0.35, `rgba(${color},${0.35 * tw * opacity})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - s * 3.2, y - s * 3.2, s * 6.4, s * 6.4);
    }
  }, [frame]);
  return <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', inset: 0, width: W, height: H, ...style }} />;
};

export const Bokeh: React.FC<Common & { count?: number; size?: [number, number]; drift?: number }> = ({
  seed = 2, color = '255,205,140', opacity = 1, count = 14, size = [30, 90], drift = 10, style, W = 1080, H = 1920,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const r = mulberry32(seed);
    const t = frame / fps;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const s = size[0] + r() * (size[1] - size[0]);
      const x = r() * W + noise1(t * 0.12 + i, seed + 5) * drift * 3;
      const y = r() * H + noise1(t * 0.1 + i * 2, seed + 9) * drift * 2 - t * drift * 0.3;
      const a = (0.1 + r() * 0.22) * (0.75 + 0.25 * Math.sin(t * 0.8 + i)) * opacity;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, `rgba(${color},${a * 0.7})`);
      g.addColorStop(0.75, `rgba(${color},${a})`);
      g.addColorStop(0.92, `rgba(${color},${a * 0.6})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [frame]);
  return <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', inset: 0, width: W, height: H, ...style }} />;
};

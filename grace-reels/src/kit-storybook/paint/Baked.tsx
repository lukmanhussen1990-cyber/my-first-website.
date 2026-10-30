// A canvas painted once (per browser tab) and then only moved by the camera.
// Heavy painting (noise, blur) happens a single time, so frames stay fast.
import React, { useLayoutEffect, useRef } from 'react';
import { useCam, defocus } from '../core/Camera';

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const cache = new Map<string, HTMLCanvasElement>();

export function bake(key: string, w: number, h: number, paint: Painter, blurPx = 0): HTMLCanvasElement {
  const k = `${key}|${w}x${h}|b${blurPx}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  if (blurPx > 0) {
    const b = document.createElement('canvas');
    b.width = w;
    b.height = h;
    const bx = b.getContext('2d')!;
    bx.filter = `blur(${blurPx}px)`;
    bx.drawImage(c, 0, 0);
    c = b;
  }
  cache.set(k, c);
  return c;
}

// pad = world px painted beyond each frame edge so camera moves never show an edge
export const Baked: React.FC<{
  id: string;
  paint: Painter;
  W?: number;
  H?: number;
  pad?: number;
  res?: number; // canvas resolution multiplier (0.5 for soft far layers)
  blur?: number; // baked blur in world px
  style?: React.CSSProperties;
}> = ({ id, paint, W = 1080, H = 1920, pad = 320, res = 1, blur = 0, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.round((W + 2 * pad) * res);
  const ch = Math.round((H + 2 * pad) * res);
  useLayoutEffect(() => {
    const src = bake(id, cw, ch, (ctx, w, h) => {
      ctx.save();
      ctx.scale(res, res);
      ctx.translate(pad, pad);
      paint(ctx, W, H);
      ctx.restore();
    }, blur * res);
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(src, 0, 0);
  }, [id, cw, ch]);
  return (
    <canvas
      ref={ref}
      width={cw}
      height={ch}
      style={{ position: 'absolute', left: -pad, top: -pad, width: W + 2 * pad, height: H + 2 * pad, ...style }}
    />
  );
};

// Sharp + pre-blurred copies of one layer, cross-faded by the camera's focus.
export const FocusBaked: React.FC<{
  id: string;
  paint: Painter;
  depth: number;
  maxBlur?: number;
  pad?: number;
  res?: number;
  baseBlur?: number;
}> = ({ id, paint, depth, maxBlur = 18, pad, res, baseBlur = 0 }) => {
  const cam = useCam();
  const b = Math.min(1, defocus(cam, depth) / maxBlur);
  return (
    <>
      <Baked id={id} paint={paint} pad={pad} res={res} blur={baseBlur} style={{ opacity: 1 - b }} />
      {b > 0.01 && <Baked id={id} paint={paint} pad={pad} res={res} blur={baseBlur + maxBlur} style={{ opacity: b }} />}
    </>
  );
};

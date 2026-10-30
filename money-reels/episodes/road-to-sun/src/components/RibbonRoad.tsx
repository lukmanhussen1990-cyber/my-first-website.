import React, {useLayoutEffect, useRef} from 'react';
import {H, W, img, rng} from '../lib/anim';
import {useImage} from '../lib/useImage';
import {spriteMeta} from './Sprite';

export type Pt = [number, number];

const pathInfo = (pts: Pt[]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (s: number): [number, number, number] => {
    let i = 1;
    while (i < acc.length - 1 && acc[i] < s) i++;
    const seg = acc[i] - acc[i - 1] || 1;
    const k = Math.max(0, Math.min(1, (s - acc[i - 1]) / seg));
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.atan2(y1 - y0, x1 - x0)];
  };
  return {len: acc[acc.length - 1], at};
};

/** Smooth a few control points into a dense polyline (Catmull-Rom). */
export const spline = (ctrl: Pt[], steps = 24): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
};

/**
 * A road of $1 bills laid end to end along a screen-space path that starts at the growing TIP.
 * `scroll` (px) slides the bills from the tip toward the tail, which reads as the rider moving forward.
 */
export const RibbonRoad: React.FC<{
  path: Pt[]; billLen?: number; scroll?: number; glow?: number; persp?: number; seed?: number;
  flutter?: boolean; opacity?: number; maxLen?: number;
}> = ({path, billLen = 170, scroll = 0, glow = 0, persp = 0, seed = 5, flutter = true, opacity = 1, maxLen}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const bill = useImage(img('15_bill'));
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (!bill || opacity <= 0 || path.length < 2) return;
    const m = spriteMeta('15_bill');
    const [bx0, by0, bx1, by1] = m.bbox;
    const sw = bx1 - bx0, sh = by1 - by0;
    const billW = billLen * (sh / sw);
    const {len: full, at} = pathInfo(path);
    const len = Math.min(full, maxLen ?? full);
    ctx.globalAlpha = opacity;
    if (glow > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(61,255,58,${0.35 * glow})`;
      ctx.shadowColor = 'rgba(61,255,58,0.9)';
      ctx.shadowBlur = 60 * glow;
      ctx.lineWidth = billW * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= len; s += 12) {
        const [x, y] = at(s);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    const spacing = billLen * 0.97;
    const shift = ((scroll % spacing) + spacing) % spacing;
    const base = Math.floor(scroll / spacing);
    const count = Math.ceil(len / spacing) + 1;
    for (let k = count; k >= 0; k--) {
      const s = k * spacing + shift;
      if (s > len + spacing) continue;
      const id = k - base;
      const r = rng(seed * 1000 + ((id % 100000) + 100000));
      const [x, y, ang] = at(Math.min(s, len));
      const grow = 1 + persp * (s / Math.max(len, 1));
      const jr = (r() - 0.5) * 0.12;
      const jx = (r() - 0.5) * 8;
      let flip = 1, lift = 0;
      if (flutter && s < spacing * 1.4) {
        const p = s / (spacing * 1.4);
        flip = Math.cos((1 - p) * Math.PI * 0.95);
        lift = Math.sin(p * Math.PI) * 26;
      }
      ctx.save();
      ctx.translate(x + jx * Math.sin(ang), y - jx * Math.cos(ang) - lift);
      ctx.rotate(ang + Math.PI + jr);
      ctx.scale(grow, grow * flip);
      ctx.drawImage(bill, bx0, by0, sw, sh, -spacing / 2 - (billLen - spacing) / 2, -billW / 2, billLen, billW);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};

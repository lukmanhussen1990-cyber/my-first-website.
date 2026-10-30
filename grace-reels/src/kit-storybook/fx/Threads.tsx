// Glowing gold "blame threads": shoot from a fingertip to a target with a spark,
// then hang in the air with a gentle sag and sway. Can later fly to a new end point.
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp01, easeOut, easeInOut, lerp } from '../core/time';
import { noise1 } from '../core/random';

export type ThreadSpec = {
  id: string;
  from: [number, number];
  to: [number, number];
  start: number; // frame the thread fires
  shoot?: number; // frames to reach the target
  sag?: number; // px the hanging thread droops
  // optional flight: both ends travel to `flyTo` between flyStart and flyStart+flyLen, then melt
  flyTo?: [number, number];
  flyStart?: number;
  flyLen?: number;
  meltLen?: number;
  width?: number;
  opacity?: number;
};

const GOLD = '255,214,128';
const CORE = '255,246,214';

function point(t: ThreadSpec, frame: number, fps: number) {
  let a = t.from;
  let b = t.to;
  if (t.flyTo && t.flyStart !== undefined && frame > t.flyStart) {
    const k = easeInOut(clamp01((frame - t.flyStart) / (t.flyLen ?? 24)));
    const k2 = easeInOut(clamp01((frame - t.flyStart - 4) / (t.flyLen ?? 24)));
    a = [lerp(a[0], t.flyTo[0], k2), lerp(a[1], t.flyTo[1], k2)];
    b = [lerp(b[0], t.flyTo[0], k), lerp(b[1], t.flyTo[1], k)];
  }
  return { a, b, time: frame / fps };
}

export const Threads: React.FC<{ threads: ThreadSpec[]; W?: number; H?: number; globalOpacity?: number }> = ({ threads, W = 1080, H = 1920, globalOpacity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', mixBlendMode: 'screen' }}>
      {threads.map((t, i) => {
        if (frame < t.start) return null;
        const shoot = t.shoot ?? 9;
        const grow = easeOut(clamp01((frame - t.start) / shoot));
        const { a, b, time } = point(t, frame, fps);
        let fade = 1;
        if (t.flyTo && t.flyStart !== undefined) {
          const meltAt = t.flyStart + (t.flyLen ?? 24);
          fade = 1 - clamp01((frame - meltAt) / (t.meltLen ?? 16));
          if (fade <= 0) return null;
        }
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const settle = clamp01((frame - t.start - shoot) / 20);
        const sway = noise1(time * 0.6 + i * 7, 11) * 14;
        const sag = (t.sag ?? Math.min(90, len * 0.12)) * settle;
        const cx = (a[0] + b[0]) / 2 - (dy / len) * sway * 0.5;
        const cy = (a[1] + b[1]) / 2 + sag + (dx / len) * sway * 0.5 - (1 - settle) * len * 0.06;
        const path = `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`;
        const L = len * 1.15;
        const dash = { strokeDasharray: L, strokeDashoffset: L * (1 - grow) };
        // tip position along the curve
        const u = grow;
        const tipX = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * cx + u * u * b[0];
        const tipY = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * cy + u * u * b[1];
        const w = t.width ?? 3;
        const op = (t.opacity ?? 1) * globalOpacity * fade;
        const shimmer = 0.85 + 0.15 * Math.sin(time * 3 + i * 1.7);
        return (
          <g key={t.id} opacity={op}>
            <path d={path} fill="none" stroke={`rgba(${GOLD},0.10)`} strokeWidth={w * 9} strokeLinecap="round" style={dash} />
            <path d={path} fill="none" stroke={`rgba(${GOLD},0.22)`} strokeWidth={w * 4.5} strokeLinecap="round" style={dash} />
            <path d={path} fill="none" stroke={`rgba(${GOLD},${0.75 * shimmer})`} strokeWidth={w * 1.6} strokeLinecap="round" style={dash} />
            <path d={path} fill="none" stroke={`rgba(${CORE},0.95)`} strokeWidth={w * 0.6} strokeLinecap="round" style={dash} />
            {grow < 1 && (
              <>
                <circle cx={tipX} cy={tipY} r={w * 10} fill={`url(#spark)`} />
                <circle cx={tipX} cy={tipY} r={w * 1.6} fill={`rgba(${CORE},1)`} />
              </>
            )}
            {frame - t.start - shoot >= 0 && frame - t.start - shoot < 10 && (
              <circle cx={b[0]} cy={b[1]} r={w * 14 * (1 - (frame - t.start - shoot) / 10)} fill="url(#spark)" />
            )}
          </g>
        );
      })}
      <defs>
        <radialGradient id="spark">
          <stop offset="0%" stopColor={`rgba(${CORE},1)`} />
          <stop offset="30%" stopColor={`rgba(${GOLD},0.6)`} />
          <stop offset="100%" stopColor={`rgba(${GOLD},0)`} />
        </radialGradient>
      </defs>
    </svg>
  );
};

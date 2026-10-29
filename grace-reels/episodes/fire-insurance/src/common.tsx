import React from 'react';
import {XF} from './anchors.ts';

/** Camera: world point (x, y) appears at screen (540, y0), zoomed by s. */
export interface Cam {
  s: number;
  x: number;
  y: number;
  y0?: number;
}

export const camTransform = (c: Cam) => `translate(540,${c.y0 ?? c.y}) scale(${c.s}) translate(${-c.x},${-c.y})`;

export const toScreen = (c: Cam, x: number, y: number) => ({
  x: 540 + (x - c.x) * c.s,
  y: (c.y0 ?? c.y) + (y - c.y) * c.s,
});

export const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  s: a.s + (b.s - a.s) * t,
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  y0: (a.y0 ?? a.y) + ((b.y0 ?? b.y) - (a.y0 ?? a.y)) * t,
});

/** Incoming-shot opacity: shots crossfade over XF frames centred on `from`. */
export const shotIn = (frame: number, from: number) => Math.min(1, Math.max(0, (frame - (from - XF / 2)) / XF));

export const shotActive = (frame: number, from: number, to: number) => frame >= from - XF / 2 && frame < to + XF / 2;

export const Layer: React.FC<{opacity: number; children: React.ReactNode}> = ({opacity, children}) =>
  opacity <= 0 ? null : <g opacity={opacity}>{children}</g>;

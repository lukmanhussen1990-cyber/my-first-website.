/*
 * Map camera: three motion values (translate x / y in screen px, zoom) plus
 * the maths that keeps the artwork covering the viewport. Everything here is
 * imperative and frame-cheap — gestures write motion values directly, React
 * never re-renders while the map moves.
 */
import { animate, inertia, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import { createContext, useContext } from 'react';
import { MAP_H, MAP_W, MAX_ZOOM, MIN_ZOOM, TOP_ANCHOR } from './mapModel';

export interface Size {
  w: number;
  h: number;
}

/** A camera position: the image point (fractions 0..1) at the viewport centre, and the zoom. */
export interface View {
  cx: number;
  cy: number;
  z: number;
}

interface Pose {
  tx: number;
  ty: number;
  z: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rubber-band a value past its limits (iOS-style resistance). */
export function rubber(v: number, lo: number, hi: number, k = 0.32): number {
  if (v < lo) return lo - (lo - v) * k;
  if (v > hi) return hi + (v - hi) * k;
  return v;
}

/** Soft limit for pinch zoom: resists past the range instead of stopping dead. */
export function softZoom(z: number): number {
  if (z > MAX_ZOOM) return MAX_ZOOM * Math.pow(z / MAX_ZOOM, 0.3);
  if (z < MIN_ZOOM) return MIN_ZOOM * Math.pow(z / MIN_ZOOM, 0.3);
  return z;
}

export const clampZoom = (z: number) => clamp(z, MIN_ZOOM, MAX_ZOOM);

/**
 * Pins stand ~54px above their anchor. The top-most zone sits close to the
 * art's top edge, so on short viewports near the base zoom the camera may
 * drop a few px past that edge (into the dark top vignette) to keep the marker whole.
 */
const PIN_CLEARANCE = 62;
const MAX_HEADROOM = 16;

/** Base (zoom 1) artwork size: the smallest size that still covers the viewport. */
export function baseSize(size: Size): Size {
  const k = Math.max(size.w / MAP_W, size.h / MAP_H) || 0;
  return { w: MAP_W * k, h: MAP_H * k };
}

export class CameraEngine {
  tx: MotionValue<number>;
  ty: MotionValue<number>;
  z: MotionValue<number>;
  size: Size = { w: 0, h: 0 };
  base: Size = { w: 0, h: 0 };
  reduceMotion = false;
  private anims: AnimationPlaybackControls[] = [];
  private restSubs = new Set<() => void>();

  constructor(tx: MotionValue<number>, ty: MotionValue<number>, z: MotionValue<number>) {
    this.tx = tx;
    this.ty = ty;
    this.z = z;
  }

  setReduceMotion(on: boolean) {
    this.reduceMotion = on;
  }

  /** Subscribe to "the camera came to rest" (a gesture or glide settled, or the geometry changed). */
  onRest(cb: () => void): () => void {
    this.restSubs.add(cb);
    return () => {
      this.restSubs.delete(cb);
    };
  }

  emitRest() {
    for (const cb of this.restSubs) cb();
  }

  /** New viewport geometry; re-poses the camera so `keep` stays centred. */
  setGeometry(size: Size, base: Size, keep: View) {
    this.size = size;
    this.base = base;
    this.stop();
    this.set(this.poseFor(keep));
  }

  get ready(): boolean {
    return this.size.w > 0 && this.size.h > 0;
  }

  limits(z: number) {
    const headroom = clamp(PIN_CLEARANCE - TOP_ANCHOR * this.base.h * z, 0, MAX_HEADROOM);
    return {
      minX: Math.min(0, this.size.w - this.base.w * z),
      maxX: 0,
      minY: Math.min(0, this.size.h - this.base.h * z),
      maxY: headroom,
    };
  }

  /** Pose that puts image point (cx, cy) at viewport fraction (ax, ay), clamped to the bounds. */
  poseFor(v: View, ax = 0.5, ay = 0.5): Pose {
    const z = clampZoom(v.z);
    const L = this.limits(z);
    return {
      z,
      tx: clamp(this.size.w * ax - v.cx * this.base.w * z, L.minX, L.maxX),
      ty: clamp(this.size.h * ay - v.cy * this.base.h * z, L.minY, L.maxY),
    };
  }

  view(): View {
    const z = this.z.get();
    if (!this.ready) return { cx: 0.5, cy: 0.5, z };
    return {
      cx: (this.size.w / 2 - this.tx.get()) / (this.base.w * z),
      cy: (this.size.h / 2 - this.ty.get()) / (this.base.h * z),
      z,
    };
  }

  set(p: Pose) {
    this.z.set(p.z);
    this.tx.set(p.tx);
    this.ty.set(p.ty);
  }

  stop() {
    for (const a of this.anims) a.stop();
    this.anims = [];
  }

  /** Glide to a pose. Translate and zoom share one eased progress so a zoom focal point stays put. */
  tween(to: Pose, duration = 0.5) {
    this.stop();
    if (this.reduceMotion || duration <= 0) {
      this.set(to);
      return;
    }
    const from: Pose = { tx: this.tx.get(), ty: this.ty.get(), z: this.z.get() };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    this.anims = [
      animate(0, 1, {
        duration,
        ease: EASE,
        onUpdate: (t) =>
          this.set({ z: lerp(from.z, to.z, t), tx: lerp(from.tx, to.tx, t), ty: lerp(from.ty, to.ty, t) }),
      }),
    ];
  }

  flyTo(v: View, opts: { duration?: number; ax?: number; ay?: number } = {}) {
    if (!this.ready) return;
    this.tween(this.poseFor(v, opts.ax, opts.ay), opts.duration ?? 0.55);
  }

  /** Zoom to `nz` keeping the screen point (fx, fy) fixed over the same spot of the art. */
  zoomAt(fx: number, fy: number, nz: number, animated: boolean) {
    if (!this.ready) return;
    const z0 = this.z.get();
    const z = clampZoom(nz);
    const px = (fx - this.tx.get()) / z0;
    const py = (fy - this.ty.get()) / z0;
    const L = this.limits(z);
    const pose = { z, tx: clamp(fx - px * z, L.minX, L.maxX), ty: clamp(fy - py * z, L.minY, L.maxY) };
    if (animated) this.tween(pose, 0.42);
    else {
      this.stop();
      this.set(pose);
    }
  }

  zoomBy(factor: number) {
    this.zoomAt(this.size.w / 2, this.size.h / 2, this.z.get() * factor, true);
  }

  panBy(dx: number, dy: number) {
    const z = this.z.get();
    const L = this.limits(z);
    this.tween({ z, tx: clamp(this.tx.get() + dx, L.minX, L.maxX), ty: clamp(this.ty.get() + dy, L.minY, L.maxY) }, 0.3);
  }

  /** Momentum after a drag: inertia that settles (with a bounce) inside the bounds. */
  fling(vx: number, vy: number) {
    this.stop();
    const z = this.z.get();
    const L = this.limits(z);
    const glide = (mv: MotionValue<number>, v: number, min: number, max: number) => {
      const from = mv.get();
      const vel = clamp(v, -4200, 4200);
      const to = clamp(from + vel * 0.4, min, max);
      if (Math.abs(to - from) < 0.5 && from >= min && from <= max) return;
      this.anims.push(
        animate(mv, [from, to], {
          type: inertia,
          velocity: vel,
          min,
          max,
          power: 0.4,
          timeConstant: 340,
          bounceStiffness: 320,
          bounceDamping: 36,
          restDelta: 0.4,
        }),
      );
    };
    glide(this.tx, vx, L.minX, L.maxX);
    glide(this.ty, vy, L.minY, L.maxY);
  }

  /** After a pinch: bring an over-zoomed or over-panned camera back inside its limits. */
  settle(fx: number, fy: number) {
    const z = this.z.get();
    if (z < MIN_ZOOM - 1e-3 || z > MAX_ZOOM + 1e-3) this.zoomAt(fx, fy, z, true);
    else this.fling(0, 0);
  }
}

/* ── Context shared with everything plotted on the map ───────────── */

export interface CameraContextValue {
  z: MotionValue<number>;
  base: Size;
  engine: CameraEngine;
}

export const CameraContext = createContext<CameraContextValue | null>(null);

export function useCamera(): CameraContextValue {
  const cam = useContext(CameraContext);
  if (!cam) throw new Error('useCamera outside <MapViewport>');
  return cam;
}

/** Screen-space offset (inside the translated pin layer) of an image point given in %. */
export function useAnchor(xPct: number, yPct: number): { x: MotionValue<number>; y: MotionValue<number> } {
  const cam = useContext(CameraContext);
  if (!cam) throw new Error('useAnchor outside <MapViewport>');
  const ax = (xPct / 100) * cam.base.w;
  const ay = (yPct / 100) * cam.base.h;
  const x = useTransform(cam.z, (v) => Math.round(v * ax));
  const y = useTransform(cam.z, (v) => Math.round(v * ay));
  return { x, y };
}

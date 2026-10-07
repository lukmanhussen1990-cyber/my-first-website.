/*
 * Cinematic rain overlay.
 *
 * A single <canvas> stretched over its positioned parent. Drops live in three
 * depth layers (far / mid / near) so the rain has parallax; every layer is
 * drawn as one batched path per frame (head + fading tail), which keeps the
 * whole effect to a handful of draw calls. Near drops occasionally splash on
 * the "ground" in the lower part of the frame.
 *
 * - DPR capped at 1.5, sized to the parent with ResizeObserver
 * - pauses while the document is hidden; draws one still frame when the
 *   player asked for reduced motion (in-app setting or the OS preference)
 * - everything (rAF, observers, listeners) is released on unmount
 */
import { useEffect, useRef } from 'react';
import { useSettings } from '../../state/settings';
import s from './Rain.module.css';

interface Props {
  /** 0..1 — density and speed (default 0.6) */
  intensity?: number;
  /** slant in degrees from vertical; positive drifts right while falling (default 10) */
  angle?: number;
  /** streak colour, any CSS colour (per-layer alpha is applied on top) */
  color?: string;
  /** splash dots on the ground near the bottom (default true) */
  splashes?: boolean;
  className?: string;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
  /** y at which a near drop hits the ground (splash + respawn) */
  floor: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  life: number;
  r: number;
}

/* far → near */
const LAYERS = [
  { density: 1.9, width: 0.6, alpha: 0.16, len: [9, 16], speed: [620, 820] },
  { density: 1.0, width: 0.9, alpha: 0.26, len: [16, 28], speed: [900, 1180] },
  { density: 0.42, width: 1.25, alpha: 0.36, len: [28, 46], speed: [1250, 1600] },
] as const;

const MAX_SPLASHES = 28;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Rain({ intensity = 0.6, angle = 10, color = '#cdd6ea', splashes = true, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useSettings((st) => st.reduceMotion);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const k = Math.max(0.05, Math.min(1, intensity));
    const rad = (angle * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    const layers: Drop[][] = LAYERS.map(() => []);
    const pops: Splash[] = [];

    const spawn = (li: number, d: Drop, anywhere: boolean) => {
      const L = LAYERS[li];
      d.len = rand(L.len[0], L.len[1]) * (0.75 + 0.25 * k);
      d.v = rand(L.speed[0], L.speed[1]) * (0.8 + 0.25 * k);
      d.y = anywhere ? rand(-d.len, h) : -d.len - Math.random() * h * 0.25;
      // widen the spawn band so slanted drops also enter from the side
      const drift = h * Math.tan(rad);
      d.x = rand(Math.min(0, -drift), Math.max(w, w - drift));
      if (anywhere) d.x += (d.y / Math.max(1, h)) * drift;
      d.floor = li === 2 ? rand(h * 0.74, h * 1.04) : h + d.len + 4;
      return d;
    };

    const fill = () => {
      const area = (w * h) / 10_000;
      LAYERS.forEach((L, li) => {
        const want = Math.round(area * L.density * k);
        const arr = layers[li];
        while (arr.length < want) arr.push(spawn(li, { x: 0, y: 0, len: 0, v: 0, floor: 0 }, true));
        arr.length = Math.min(arr.length, want);
      });
    };

    const resize = () => {
      // layout size (unaffected by the screen-transition transforms)
      const nw = Math.max(1, host.clientWidth);
      const nh = Math.max(1, host.clientHeight);
      if (nw === w && nh === h) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = nw;
      h = nh;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      layers.forEach((arr, li) => arr.forEach((d) => spawn(li, d, true)));
      fill();
      if (!running) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      LAYERS.forEach((L, li) => {
        const arr = layers[li];
        if (!arr.length) return;
        ctx.lineWidth = L.width;
        // faint tail
        ctx.globalAlpha = L.alpha * 0.45;
        ctx.beginPath();
        for (const d of arr) {
          const mx = d.x - d.len * 0.45 * sin;
          const my = d.y - d.len * 0.45 * cos;
          ctx.moveTo(mx, my);
          ctx.lineTo(d.x - d.len * sin, d.y - d.len * cos);
        }
        ctx.stroke();
        // brighter head
        ctx.globalAlpha = L.alpha;
        ctx.beginPath();
        for (const d of arr) {
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.45 * sin, d.y - d.len * 0.45 * cos);
        }
        ctx.stroke();
      });

      if (pops.length) {
        ctx.lineWidth = 0.8;
        ctx.fillStyle = color;
        for (const p of pops) {
          const t = p.age / p.life;
          const a = (1 - t) * 0.34;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * (0.3 + t), p.r * (0.3 + t) * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
          // two droplets kicked up
          const up = Math.sin(t * Math.PI) * p.r * 1.3;
          ctx.globalAlpha = a * 1.2;
          ctx.fillRect(p.x - p.r * t * 1.1, p.y - up, 1, 1);
          ctx.fillRect(p.x + p.r * t * 0.9, p.y - up * 0.8, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    const step = (dt: number) => {
      LAYERS.forEach((_, li) => {
        for (const d of layers[li]) {
          d.x += d.v * dt * sin;
          d.y += d.v * dt * cos;
          if (d.y >= d.floor) {
            if (li === 2 && splashes && d.floor < h && pops.length < MAX_SPLASHES && Math.random() < 0.55) {
              pops.push({ x: d.x, y: d.floor, age: 0, life: rand(0.22, 0.4), r: rand(3, 6.5) });
            }
            spawn(li, d, false);
          } else if (sin >= 0 ? d.x > w + 60 : d.x < -60) {
            // cull on the leeward side only: drops spawned off-screen on the
            // windward side are still drifting in and must survive
            spawn(li, d, false);
          }
        }
      });
      for (let i = pops.length - 1; i >= 0; i--) {
        pops[i].age += dt;
        if (pops[i].age >= pops[i].life) pops.splice(i, 1);
      }
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    // the OS preference counts too (the in-app setting only defaults to it)
    const osReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => reduceMotion || !!osReduce?.matches;

    const start = () => {
      if (running || still() || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onOsReduce = () => (still() ? stop() : start());

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    draw();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    osReduce?.addEventListener('change', onOsReduce);

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      osReduce?.removeEventListener('change', onOsReduce);
    };
  }, [intensity, angle, color, splashes, reduceMotion]);

  return <canvas ref={ref} className={[s.rain, className].filter(Boolean).join(' ')} aria-hidden />;
}

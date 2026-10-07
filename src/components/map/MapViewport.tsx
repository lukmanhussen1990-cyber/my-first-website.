import { motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { useSettings } from '../../state/settings';
import { baseSize, CameraContext, CameraEngine, rubber, softZoom, type Size, type View } from './camera';
import { MAX_ZOOM, MIN_ZOOM } from './mapModel';
import s from './MapViewport.module.css';

export interface MapViewportHandle {
  /** Glide so image point (cx, cy) sits at viewport fraction (ax, ay). */
  flyTo: (view: View, opts?: { duration?: number; ax?: number; ay?: number }) => void;
  zoomBy: (factor: number) => void;
  view: () => View;
  /** viewport size in px */
  size: () => Size;
}

interface Props {
  image: string;
  /** where the camera starts (and resets to with the 0 key) */
  initialView: View;
  /** screen-space content plotted over the art (pins, markers) */
  children?: ReactNode;
  /** fires when the zoom crosses either end of the range */
  onZoomLimits?: (atMin: boolean, atMax: boolean) => void;
  /** called with the final camera when the viewport unmounts (to restore it later) */
  onLeave?: (view: View) => void;
  label: string;
  ref?: Ref<MapViewportHandle>;
}

interface Pt {
  x: number;
  y: number;
}

const TAP_SLOP = 7;
const DOUBLE_TAP_MS = 320;

/**
 * Pan / zoom viewport for the city map.
 *   - one pointer drags (rubber-band edges, momentum on release)
 *   - two pointers pinch-zoom around their midpoint
 *   - mouse wheel zooms around the cursor, double-tap toggles zoom
 *   - arrow keys pan, + / − zoom, 0 resets
 * The art layer is transformed as a whole (translate + scale); plotted content
 * lives in a translated, unscaled layer so pins keep a constant on-screen size.
 */
export function MapViewport({ image, initialView, children, onZoomLimits, onLeave, label, ref }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const z = useMotionValue(initialView.z);
  const [engine] = useState(() => new CameraEngine(tx, ty, z));
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const base = useMemo(() => baseSize(size), [size]);
  const initial = useRef(initialView);

  // the pin layer snaps to whole pixels so label text stays crisp
  const pinX = useTransform(tx, Math.round);
  const pinY = useTransform(ty, Math.round);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (v, o) => engine.flyTo(v, o),
      zoomBy: (f) => engine.zoomBy(f),
      view: () => engine.view(),
      size: () => engine.size,
    }),
    [engine],
  );

  useEffect(() => {
    engine.setReduceMotion(reduceMotion);
  }, [engine, reduceMotion]);

  const leave = useRef(onLeave);
  useEffect(() => {
    leave.current = onLeave;
  }, [onLeave]);
  useEffect(
    () => () => {
      if (engine.ready) leave.current?.(engine.view());
    },
    [engine],
  );

  /* ── size tracking (layout size — unaffected by screen transitions) ── */
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const read = () => setSize((prev) => (prev.w === node.clientWidth && prev.h === node.clientHeight ? prev : { w: node.clientWidth, h: node.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // apply geometry: first time → initial view; afterwards keep the same view centre
  useLayoutEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    engine.setGeometry(size, base, engine.ready ? engine.view() : initial.current);
    // plotted content (label layout) can settle before the first paint
    engine.emitRest();
  }, [engine, size, base]);

  /* ── zoom-limit notifications, will-change only while moving, rest events ── */
  // pointers currently down (written by the gesture handlers): the camera is
  // never "at rest" under a finger, even when the finger holds still
  const held = useRef(0);
  const kick = useRef<() => void>(() => {});
  useEffect(() => {
    const node = el.current;
    let idle: number | undefined;
    let lastMin: boolean | undefined;
    let lastMax: boolean | undefined;
    const report = (v: number) => {
      const atMin = v <= MIN_ZOOM + 0.01;
      const atMax = v >= MAX_ZOOM - 0.01;
      if (atMin !== lastMin || atMax !== lastMax) {
        lastMin = atMin;
        lastMax = atMax;
        onZoomLimits?.(atMin, atMax);
      }
    };
    report(z.get());
    const settle = () => {
      if (held.current > 0) return; // the release kicks a fresh timer
      node?.removeAttribute('data-moving');
      engine.emitRest();
    };
    const moving = () => {
      if (node && !node.hasAttribute('data-moving')) node.setAttribute('data-moving', '');
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 220);
    };
    kick.current = moving;
    const offs = [tx.on('change', moving), ty.on('change', moving), z.on('change', moving), z.on('change', report)];
    return () => {
      offs.forEach((off) => off());
      window.clearTimeout(idle);
      kick.current = () => {};
    };
  }, [engine, tx, ty, z, onZoomLimits]);

  /* ── gestures ──────────────────────────────────────────────────── */
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const pts = new Map<number, Pt>();
    let rect = node.getBoundingClientRect();
    let mode: 'idle' | 'pan' | 'pinch' = 'idle';
    let start = { x: 0, y: 0, tx: 0, ty: 0 };
    let pinch = { d: 1, mx: 0, my: 0, z: 1, tx: 0, ty: 0 };
    let lastMid: Pt = { x: 0, y: 0 };
    let moved = false;
    let multi = false;
    let suppressClick = false;
    let samples: { t: number; x: number; y: number }[] = [];
    let lastTap = { t: -1e9, x: 0, y: 0 };

    const local = (e: PointerEvent): Pt => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const capture = (id: number) => {
      try {
        node.setPointerCapture(id);
      } catch {
        /* pointer already gone */
      }
    };
    const beginPan = (p: Pt) => {
      mode = 'pan';
      start = { x: p.x, y: p.y, tx: tx.get(), ty: ty.get() };
      samples = [];
    };
    const beginPinch = () => {
      const [a, b] = [...pts.values()];
      mode = 'pinch';
      moved = true;
      multi = true;
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: lastMid.x, my: lastMid.y, z: z.get(), tx: tx.get(), ty: ty.get() };
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pts.size === 0) {
        rect = node.getBoundingClientRect();
        moved = false;
        multi = false;
        suppressClick = false;
      }
      engine.stop();
      const p = local(e);
      pts.set(e.pointerId, p);
      held.current = pts.size;
      if (pts.size === 1) beginPan(p);
      else if (pts.size === 2) {
        for (const id of pts.keys()) capture(id);
        beginPinch();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (mode === 'pan') {
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (!moved) {
          if (Math.hypot(dx, dy) < TAP_SLOP) return;
          moved = true;
          capture(e.pointerId);
          // start from here so the slop does not cause a jump
          start = { x: p.x, y: p.y, tx: tx.get(), ty: ty.get() };
          return;
        }
        const L = engine.limits(z.get());
        tx.set(rubber(start.tx + dx, L.minX, L.maxX));
        ty.set(rubber(start.ty + dy, L.minY, L.maxY));
        samples.push({ t: e.timeStamp, x: p.x, y: p.y });
        while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
      } else if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const nz = softZoom((pinch.z * d) / pinch.d);
        // keep the art point that started under the fingers under their midpoint
        const px = (pinch.mx - pinch.tx) / pinch.z;
        const py = (pinch.my - pinch.ty) / pinch.z;
        const L = engine.limits(nz);
        z.set(nz);
        tx.set(rubber(lastMid.x - px * nz, L.minX, L.maxX));
        ty.set(rubber(lastMid.y - py * nz, L.minY, L.maxY));
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.delete(e.pointerId);
      held.current = pts.size;
      // a drag held still before release produces no further camera change — re-arm the rest timer
      if (pts.size === 0 && moved) kick.current();

      if (mode === 'pinch') {
        if (pts.size >= 2) beginPinch();
        else if (pts.size === 1) {
          beginPan([...pts.values()][0]);
          moved = true;
        } else {
          mode = 'idle';
          suppressClick = true;
          engine.settle(lastMid.x, lastMid.y);
        }
        return;
      }
      if (pts.size > 0) return;
      mode = 'idle';

      if (moved) {
        suppressClick = true;
        if (multi && (z.get() < MIN_ZOOM || z.get() > MAX_ZOOM)) {
          engine.settle(p.x, p.y);
          return;
        }
        let vx = 0;
        let vy = 0;
        const last = samples[samples.length - 1];
        const first = samples[0];
        if (last && first && last !== first && e.timeStamp - last.t < 90) {
          const dt = Math.max(16, last.t - first.t) / 1000;
          vx = (last.x - first.x) / dt;
          vy = (last.y - first.y) / dt;
        }
        engine.fling(vx, vy);
        return;
      }

      // a clean tap — double-tap on open map toggles zoom around the tap point
      if (e.type === 'pointercancel' || multi) return;
      const onUi = (e.target as Element | null)?.closest?.('[data-map-ui]');
      if (onUi) return;
      if (e.timeStamp - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        lastTap = { t: -1e9, x: 0, y: 0 };
        const cur = z.get();
        engine.zoomAt(p.x, p.y, cur < 1.7 ? Math.min(MAX_ZOOM, cur * 1.8) : MIN_ZOOM, true);
      } else {
        lastTap = { t: e.timeStamp, x: p.x, y: p.y };
      }
    };

    // a drag that ends over a pin must not open it
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rect = node.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
      const k = e.ctrlKey ? 0.012 : 0.0018; // ctrl = trackpad pinch
      const f = Math.exp(-e.deltaY * unit * k);
      engine.zoomAt(e.clientX - rect.left, e.clientY - rect.top, z.get() * f, false);
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('click', onClickCapture, true);
    // Tab onto an off-screen pin makes the browser scroll this overflow:hidden box —
    // undo that and glide the camera instead, so the art and the pins stay locked
    const onScroll = () => {
      if (node.scrollLeft || node.scrollTop) {
        node.scrollLeft = 0;
        node.scrollTop = 0;
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('[data-map-ui]') || pts.size > 0) return;
      onScroll();
      const r = t.getBoundingClientRect();
      rect = node.getBoundingClientRect();
      const pad = 20;
      const bottomPad = 140; // keep clear of the HUD
      let dx = 0;
      let dy = 0;
      if (r.left < rect.left + pad) dx = rect.left + pad - r.left;
      else if (r.right > rect.right - pad) dx = rect.right - pad - r.right;
      if (r.top < rect.top + pad) dy = rect.top + pad - r.top;
      else if (r.bottom > rect.bottom - bottomPad) dy = rect.bottom - bottomPad - r.bottom;
      if (dx || dy) engine.panBy(dx, dy);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('scroll', onScroll);
    node.addEventListener('focusin', onFocusIn);
    return () => {
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('click', onClickCapture, true);
      node.removeEventListener('wheel', onWheel);
      engine.stop();
    };
  }, [engine, tx, ty, z]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = 90;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => engine.panBy(step, 0),
      ArrowRight: () => engine.panBy(-step, 0),
      ArrowUp: () => engine.panBy(0, step),
      ArrowDown: () => engine.panBy(0, -step),
      '+': () => engine.zoomBy(1.35),
      '=': () => engine.zoomBy(1.35),
      '-': () => engine.zoomBy(1 / 1.35),
      '0': () => engine.flyTo(initial.current),
    };
    const run = keys[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  const ctx = useMemo(() => ({ z, base, engine }), [z, base, engine]);
  const ready = size.w > 0;

  return (
    <div
      ref={el}
      className={s.viewport}
      tabIndex={0}
      role="region"
      aria-roledescription="map"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className={[s.art, loaded && s.artLoaded].filter(Boolean).join(' ')}
        style={{ x: tx, y: ty, scale: z, width: base.w, height: base.h }}
        aria-hidden
      >
        <img src={image} alt="" draggable={false} decoding="async" onLoad={() => setLoaded(true)} />
        <span className={s.grid} />
      </motion.div>

      <div className={s.fog} aria-hidden>
        <span className={s.fogA} />
        <span className={s.fogB} />
      </div>
      <div className={`${s.lines} scanlines`} aria-hidden />
      <div className={s.vignette} aria-hidden />

      <motion.div className={s.plot} style={{ x: pinX, y: pinY }}>
        {ready && <CameraContext value={ctx}>{children}</CameraContext>}
      </motion.div>
    </div>
  );
}

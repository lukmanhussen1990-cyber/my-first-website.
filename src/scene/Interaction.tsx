import type { CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Raycaster, Vector2, Vector3, type Camera } from 'three';
import { toggleFullscreen } from '../lib/fullscreen';
import { useTorch } from '../state/store';
import { useUi } from '../state/ui';
import { runtime } from './runtime';
import { LENS_Z } from './torch/spec';

type Hit = 'button' | 'body' | null;

interface Drag {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  moved: boolean;
  onButton: boolean;
  yawSign: number;
  pitchSign: number;
  samples: { t: number; yaw: number; pitch: number }[];
}

const CLICK_SLOP_PX = 6;
const MAX_FLICK = 7; // rad/s

const tmpA = new Vector3();
const tmpB = new Vector3();

function lensPoint(yaw: number, pitch: number, out: Vector3) {
  const c = Math.cos(pitch);
  return out.set(c * Math.sin(yaw), Math.sin(pitch), c * Math.cos(yaw)).multiplyScalar(LENS_Z + 0.3);
}

/**
 * "Aim" mapping: whatever the current orientation, dragging moves the torch
 * head in the direction of the pointer on screen.
 */
function aimSigns(camera: Camera) {
  const { yaw, pitch } = runtime.pose;
  const p0 = lensPoint(yaw, pitch, tmpA).project(camera);
  const x0 = p0.x;
  const y0 = p0.y;
  const p1 = lensPoint(yaw + 0.04, pitch, tmpB).project(camera);
  const yawSign = Math.sign(p1.x - x0) || 1;
  const p2 = lensPoint(yaw, pitch + 0.04, tmpB).project(camera);
  const pitchSign = Math.sign(p2.y - y0) || 1;
  return { yawSign, pitchSign };
}

function isEditable(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable) return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'range' && type !== 'radio' && type !== 'checkbox' && type !== 'button';
  }
  return false;
}

/** Elements whose native keyboard behaviour (arrows / space / enter) must win. */
function ownsNavigationKeys(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' || el.getAttribute('role') === 'switch';
}

export function Interaction() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null;

  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.closest<HTMLElement>('[data-viewport]') ?? canvas.parentElement!;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: Drag | null = null;
    let pinch: { ids: [number, number]; dist: number } | null = null;
    let hoverQueued = false;
    let lastHover: { x: number; y: number } | null = null;

    const pick = (clientX: number, clientY: number): Hit => {
      const body = runtime.hitBody;
      const button = runtime.hitButton;
      if (!body || !button) return null;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([button, body], false);
      if (!hits.length) return null;
      return hits[0].object === button ? 'button' : 'body';
    };

    const setHover = (hit: Hit) => {
      runtime.hoverButton = hit === 'button';
      runtime.hoverBody = hit === 'body';
      host.style.cursor = hit === 'button' ? 'pointer' : hit === 'body' ? 'grab' : '';
    };

    const pinchDistance = () => {
      if (!pinch) return 0;
      const a = pointers.get(pinch.ids[0]);
      const b = pointers.get(pinch.ids[1]);
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const finishDrag = (allowClick: boolean) => {
      if (!drag) return;
      const pose = runtime.pose;
      pose.dragging = false;
      if (allowClick && !drag.moved && drag.onButton && performance.now() - drag.startTime < 700) {
        useTorch.getState().toggle('model');
      } else {
        // Flick inertia from the last ~90 ms of motion.
        const now = performance.now();
        const recent = drag.samples.filter((s) => now - s.t < 90);
        if (recent.length >= 2 && now - recent[recent.length - 1].t < 60) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dt = Math.max(0.016, (last.t - first.t) / 1000);
          pose.velocityYaw = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, (last.yaw - first.yaw) / dt));
          pose.velocityPitch = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, (last.pitch - first.pitch) / dt)) * 0.6;
        }
      }
      if (host.hasPointerCapture?.(drag.id)) host.releasePointerCapture(drag.id);
      drag = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag && pointers.size === 2) {
        // A second finger joined an aim gesture: hand over to pinch-zoom.
        const ids = [...pointers.keys()] as [number, number];
        finishDrag(false);
        runtime.pose.velocityYaw = runtime.pose.velocityPitch = 0;
        pinch = { ids, dist: 0 };
        pinch.dist = pinchDistance();
        host.setPointerCapture?.(e.pointerId);
        e.stopPropagation();
        return;
      }
      if (pointers.size > 1 || pinch) return; // camera-controls owns gestures it started
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return; // background: orbit the camera
      e.stopPropagation();
      e.preventDefault();
      host.setPointerCapture?.(e.pointerId);
      const pose = runtime.pose;
      pose.dragging = true;
      pose.velocityYaw = pose.velocityPitch = 0;
      // Start from where the torch visibly is, not from a target still being sprung toward.
      pose.targetYaw = pose.yaw;
      pose.targetPitch = pose.pitch;
      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        startTime: performance.now(),
        moved: false,
        onButton: hit === 'button',
        ...aimSigns(camera),
        samples: [{ t: performance.now(), yaw: pose.targetYaw, pitch: pose.targetPitch }],
      };
      host.style.cursor = hit === 'button' ? 'pointer' : 'grabbing';
      if (hit === 'body') useTorch.getState().markInteracted();
      if (document.activeElement !== host) host.focus({ preventScroll: true });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinch) {
        if (!pinch.ids.includes(e.pointerId)) return;
        const dist = pinchDistance();
        if (dist > 0 && pinch.dist > 0) void controls?.dolly((dist - pinch.dist) * 0.012, true);
        pinch.dist = dist;
        e.stopPropagation();
        return;
      }

      if (drag && e.pointerId === drag.id) {
        e.stopPropagation();
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > CLICK_SLOP_PX) {
          drag.moved = true;
          host.style.cursor = 'grabbing';
          useTorch.getState().markInteracted();
        }
        if (!drag.moved) return;
        const rect = canvas.getBoundingClientRect();
        const k = 4.6 / Math.max(480, Math.min(rect.width, rect.height * 1.6));
        const pose = runtime.pose;
        pose.targetYaw += drag.yawSign * dx * k;
        pose.targetPitch += drag.pitchSign * -dy * k;
        const now = performance.now();
        drag.samples.push({ t: now, yaw: pose.targetYaw, pitch: pose.targetPitch });
        if (drag.samples.length > 12) drag.samples.shift();
        return;
      }

      if (e.pointerType === 'mouse' && e.buttons === 0) {
        lastHover = { x: e.clientX, y: e.clientY };
        if (!hoverQueued) {
          hoverQueued = true;
          requestAnimationFrame(() => {
            hoverQueued = false;
            if (lastHover) setHover(pick(lastHover.x, lastHover.y));
          });
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinch && pinch.ids.includes(e.pointerId)) {
        pinch = null;
        e.stopPropagation();
        return;
      }
      if (drag && e.pointerId === drag.id) {
        e.stopPropagation();
        finishDrag(e.type === 'pointerup');
        if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
        else setHover(null);
      }
    };

    const onPointerLeave = () => {
      if (!drag) setHover(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (isEditable(active)) return;
      const nav = ownsNavigationKeys(active);
      const store = useTorch.getState();
      const pose = runtime.pose;
      const step = e.shiftKey ? 0.3 : 0.1;
      const aim = (dYaw: number, dPitch: number) => {
        const signs = aimSigns(camera);
        pose.velocityYaw = pose.velocityPitch = 0;
        pose.targetYaw += signs.yawSign * dYaw;
        pose.targetPitch += signs.pitchSign * dPitch;
        store.markInteracted();
      };
      switch (e.key) {
        case 'ArrowLeft':
          if (nav) return;
          aim(-step, 0);
          break;
        case 'ArrowRight':
          if (nav) return;
          aim(step, 0);
          break;
        case 'ArrowUp':
          if (nav) return;
          aim(0, step);
          break;
        case 'ArrowDown':
          if (nav) return;
          aim(0, -step);
          break;
        case ' ':
        case 'Enter':
          if (nav || (active !== host && active !== document.body)) return;
          store.toggle('keyboard');
          break;
        case 'l':
        case 'L':
          store.toggle('keyboard');
          break;
        case '+':
        case '=':
          void controls?.dolly(0.5, true);
          store.markInteracted();
          break;
        case '-':
        case '_':
          void controls?.dolly(-0.5, true);
          store.markInteracted();
          break;
        case 'r':
        case 'R':
          store.requestReset();
          break;
        case 'f':
        case 'F':
          void toggleFullscreen();
          break;
        case '1':
          store.setMode('focused');
          break;
        case '2':
          store.setMode('standard');
          break;
        case '3':
          store.setMode('wide');
          break;
        case '?': {
          const ui = useUi.getState();
          ui.setShortcutsOpen(!ui.shortcutsOpen);
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    };

    host.addEventListener('pointerdown', onPointerDown, { capture: true });
    host.addEventListener('pointermove', onPointerMove, { capture: true });
    host.addEventListener('pointerup', onPointerUp, { capture: true });
    host.addEventListener('pointercancel', onPointerUp, { capture: true });
    host.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      host.removeEventListener('pointerdown', onPointerDown, { capture: true });
      host.removeEventListener('pointermove', onPointerMove, { capture: true });
      host.removeEventListener('pointerup', onPointerUp, { capture: true });
      host.removeEventListener('pointercancel', onPointerUp, { capture: true });
      host.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKeyDown);
      host.style.cursor = '';
      runtime.pose.dragging = false;
    };
  }, [gl, camera, controls]);

  return null;
}

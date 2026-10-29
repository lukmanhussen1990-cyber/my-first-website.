import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { useTorch } from '../state/store';
import { useUi } from '../state/ui';

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;

/** Default viewing direction: front-right of the torch, slightly above. */
const AZIMUTH = 30 * DEG;
const ELEVATION = 12 * DEG;
const SMOOTH = 0.32;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/**
 * Lens + distance that keep the torch comfortably framed for any aspect
 * ratio, centred in the area above the bottom control dock.
 */
export function computeFraming(width: number, height: number, insetBottom: number) {
  const aspect = width / Math.max(1, height);
  const t = Math.min(1, Math.max(0, (aspect - 0.55) / (1.45 - 0.55)));
  const fov = 48 - 13 * t;
  const tanV = Math.tan((fov / 2) * DEG);
  const tanH = tanV * aspect;
  const widthShare = 0.5 + 0.3 * (1 - t); // portrait screens let the torch span more of the width
  const dH = 0.82 / (widthShare * tanH);
  const dV = 0.34 / (0.36 * tanV);
  const distance = Math.min(7.5, Math.max(2.7, Math.max(dH, dV)));
  // Shift the view so the torch sits centred in the area above the dock.
  const visibleHeight = 2 * distance * tanV;
  const offsetY = (Math.min(insetBottom, height * 0.6) / Math.max(1, height)) * 0.5 * visibleHeight;
  return { fov, distance, offsetY };
}

function viewPosition(distance: number, azimuth = AZIMUTH, elevation = ELEVATION): [number, number, number] {
  return [
    distance * Math.cos(elevation) * Math.sin(azimuth),
    distance * Math.sin(elevation),
    distance * Math.cos(elevation) * Math.cos(azimuth),
  ];
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const canvas = useThree((s) => s.gl.domElement);
  const insetBottom = useUi((s) => s.insetBottom);
  const userMoved = useRef(false);
  const introDone = useRef(false);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  // Responsive lens and framing.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const { fov, distance, offsetY } = computeFraming(width, height, insetBottom);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    void controls.setFocalOffset(0, offsetY, 0, introDone.current);
    if (!userMoved.current && introDone.current) void controls.dollyTo(distance, true);
  }, [camera, width, height, insetBottom]);

  // Intro glide on first load (skipped for reduced motion).
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const { distance, offsetY } = computeFraming(width, height, useUi.getState().insetBottom);
    void controls.setFocalOffset(0, offsetY, 0, false);
    const end = viewPosition(distance);
    if (prefersReducedMotion()) {
      void controls.setLookAt(...end, 0, 0, 0, false);
      introDone.current = true;
      return;
    }
    const start = viewPosition(distance * 1.65, AZIMUTH + 26 * DEG, ELEVATION + 14 * DEG);
    void controls.setLookAt(...start, 0, 0, 0, false);
    controls.smoothTime = 0.95;
    const id = window.setTimeout(() => {
      void controls.setLookAt(...end, 0, 0, 0, true).then(() => {
        controls.smoothTime = SMOOTH;
      });
      introDone.current = true;
    }, 120);
    return () => window.clearTimeout(id);
    // Run once on mount; later size changes are handled by the framing effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track user camera moves so resizes don't fight them.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const onStart = () => {
      userMoved.current = true;
      controls.smoothTime = SMOOTH;
      useTorch.getState().markInteracted();
    };
    controls.addEventListener('controlstart', onStart);
    // Wheel dolly doesn't emit controlstart.
    canvas.addEventListener('wheel', onStart, { passive: true });
    return () => {
      controls.removeEventListener('controlstart', onStart);
      canvas.removeEventListener('wheel', onStart);
    };
  }, [canvas]);

  // Reset view.
  useEffect(
    () =>
      useTorch.subscribe((s, prev) => {
        if (s.resetNonce === prev.resetNonce) return;
        const controls = ref.current;
        if (!controls) return;
        const { width: w, height: h } = sizeRef.current;
        const { distance, offsetY } = computeFraming(w, h, useUi.getState().insetBottom);
        userMoved.current = false;
        controls.smoothTime = prefersReducedMotion() ? 0.08 : 0.42;
        void controls.setFocalOffset(0, offsetY, 0, true);
        void controls.setLookAt(...viewPosition(distance), 0, 0, 0, true).then(() => {
          controls.smoothTime = SMOOTH;
        });
      }),
    [],
  );

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={1.45}
      maxDistance={9.5}
      minPolarAngle={0.22}
      maxPolarAngle={1.67}
      smoothTime={SMOOTH}
      draggingSmoothTime={0.11}
      azimuthRotateSpeed={0.6}
      polarRotateSpeed={0.55}
      dollySpeed={0.55}
      truckSpeed={0}
      dollyToCursor={false}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.NONE, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE }}
    />
  );
}

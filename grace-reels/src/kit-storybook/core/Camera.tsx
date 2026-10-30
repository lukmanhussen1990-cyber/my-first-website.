// 2.5D camera: layers sit at depths and get parallax + push-in from one camera.
import React, { createContext, useContext } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

export type Cam = {
  x: number; // camera centre offset from frame centre, world px
  y: number;
  zoom: number; // 1 = layer at depth 1 shown at native size
  rot?: number; // degrees, tiny dutch tilts only
  focus?: number; // depth that is in focus
  aperture?: number; // blur px per unit of depth away from focus
};

const CamContext = createContext<Cam>({ x: 0, y: 0, zoom: 1, focus: 1, aperture: 0 });
export const useCam = () => useContext(CamContext);

export const CameraRig: React.FC<{ cam: Cam; children: React.ReactNode }> = ({ cam, children }) => (
  <CamContext.Provider value={{ focus: 1, aperture: 0, rot: 0, ...cam }}>
    <AbsoluteFill style={{ overflow: 'hidden' }}>{children}</AbsoluteFill>
  </CamContext.Provider>
);

// blur (px) a layer at `depth` should get from the current focus setting
export function defocus(cam: Cam, depth: number) {
  return Math.abs(depth - (cam.focus ?? 1)) * (cam.aperture ?? 0);
}

export function layerTransform(cam: Cam, depth: number, W: number, H: number) {
  const s = Math.pow(cam.zoom, depth);
  const ox = cam.x * depth;
  const oy = cam.y * depth;
  return `translate(${W / 2}px, ${H / 2}px) rotate(${(cam.rot ?? 0) * depth}deg) scale(${s}) translate(${-W / 2 - ox}px, ${-H / 2 - oy}px)`;
}

// A full-frame layer at a depth. depth 0 = infinitely far (no motion), 1 = subject plane, >1 = foreground.
export const Layer: React.FC<{
  depth: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  blur?: boolean; // apply CSS defocus (use for small layers only; big canvases use FocusPair)
}> = ({ depth, children, style, blur }) => {
  const cam = useCam();
  const { width, height } = useVideoConfig();
  const b = blur ? defocus(cam, depth) : 0;
  return (
    <AbsoluteFill
      style={{
        transform: layerTransform(cam, depth, width, height),
        transformOrigin: '0 0',
        filter: b > 0.3 ? `blur(${b.toFixed(1)}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

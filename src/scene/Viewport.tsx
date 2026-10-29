import { Canvas } from '@react-three/fiber';
import { Component, type ReactNode } from 'react';
import { useUi } from '../state/ui';
import { Experience } from './Experience';
import { QUALITY } from './quality';

class GlErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    useUi.getState().setGlError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webgl2Available() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function Viewport() {
  const tier = useUi((s) => s.quality);
  const glError = useUi((s) => s.glError);
  const supported = webgl2Available();
  const maxDpr = QUALITY[tier].maxDpr;

  return (
    <div
      className="viewport"
      data-viewport
      tabIndex={0}
      role="application"
      aria-roledescription="interactive 3D viewer"
      aria-label="NYXEN TX-1 flashlight"
      aria-describedby="viewport-help"
    >
      {supported && !glError ? (
        <GlErrorBoundary>
          <Canvas
            dpr={[1, maxDpr]}
            shadows="percentage"
            flat
            gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
            camera={{ fov: 32, near: 0.05, far: 90, position: [2.4, 0.8, 3.6] }}
            onCreated={({ gl }) => {
              if (import.meta.env.DEV) Object.assign(window, { __gl: gl });
              gl.setClearColor('#000000', 1);
              gl.toneMappingExposure = 1;
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                useUi.getState().setGlError('The graphics context was lost.');
              });
            }}
          >
            <Experience />
          </Canvas>
        </GlErrorBoundary>
      ) : (
        <div className="gl-fallback" role="alert">
          <p className="gl-fallback__title">3D view unavailable</p>
          <p>
            {glError ?? 'This experience needs WebGL 2.'} Try a current version of Chrome, Edge, Firefox or Safari with hardware
            acceleration enabled.
          </p>
          {glError && (
            <button type="button" className="chip" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
        </div>
      )}
      <p id="viewport-help" className="sr-only">
        Drag the torch to aim it, drag the background to orbit the camera, scroll or pinch to zoom. Click the round switch on the torch
        head to turn it on or off. Keyboard: arrow keys aim, plus and minus zoom, L or Space toggles the light, 1 to 3 choose the beam
        mode, R resets the view and F toggles full screen.
      </p>
    </div>
  );
}

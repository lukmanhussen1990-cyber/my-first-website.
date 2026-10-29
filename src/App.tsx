import { useEffect } from 'react';
import { Viewport } from './scene/Viewport';
import { useTorch } from './state/store';
import { ControlDock, Hint, LiveRegion, TopBar } from './ui/Hud';

export function App() {
  // Power the torch on shortly after the first frames, as part of the reveal.
  useEffect(() => {
    const id = window.setTimeout(() => useTorch.getState().setOn(true, 'intro'), 1400);
    return () => window.clearTimeout(id);
  }, []);

  // Battery simulation (drain while on, charge while docked).
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      useTorch.getState().tick(Math.min(1, (now - last) / 1000));
      last = now;
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app">
      <Viewport />
      <TopBar />
      <Hint />
      <ControlDock />
      <LiveRegion />
    </div>
  );
}

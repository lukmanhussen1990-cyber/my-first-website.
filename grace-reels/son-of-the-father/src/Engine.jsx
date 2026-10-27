// R3F bridge: owns the World and renders it from a priority-1 useFrame (so R3F never auto-renders).
// ThreeCanvas advances R3F in an effect on every frame change; the frame is read from a ref that is
// set during render, which happens before that effect runs.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { delayRender, continueRender } from 'remotion';
import { fontsReady } from './lib/fonts.js';
import { World } from './three/engine.js';
import { plan } from './lib/planInstance.js';

export const Engine = ({ frame, cam = null }) => {
  const { gl, advance } = useThree();
  const fr = useRef(frame);
  fr.current = frame;
  const world = useMemo(() => new World(gl, plan), [gl]);
  useFrame(() => {
    world.render(fr.current, cam);
  }, 1);
  // canvas text in the 3D world needs the web fonts: once they are in, draw the frame again
  useEffect(() => {
    const h = delayRender('fonts for 3D canvas text', { timeoutInMilliseconds: 600000 });
    fontsReady().then(() => { world.fontsOk = true; advance(performance.now()); continueRender(h); });
  }, [world, advance]);
  return null;
};

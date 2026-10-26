import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Engine } from './Engine.jsx';
import { Overlay } from './overlay/Overlay.jsx';

// frames: optional list of reel frames to show (the Stills composition renders frame i = frames[i])
export const Reel = ({ frames = null, audio = true, overlay = true, debug = false }) => {
  const f = useCurrentFrame();
  const frame = frames ? frames[Math.min(f, frames.length - 1)] : f;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {audio ? <Audio src={staticFile('final_mix.wav')} /> : null}
      <ThreeCanvas width={1080} height={1920} dpr={1} flat linear
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', depth: false, stencil: false }}>
        <Engine frame={frame} />
      </ThreeCanvas>
      {overlay ? <Overlay frame={frame} debug={debug} /> : null}
    </AbsoluteFill>
  );
};

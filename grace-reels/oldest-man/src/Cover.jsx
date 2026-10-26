// The cover (STUB — rebuilt at the end): Methuselah by his lamp at night, giant gold 969, the ark far away.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Engine } from './Engine.jsx';
export const Cover = ({ frame = 60 }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <ThreeCanvas width={1080} height={1920} dpr={1} flat linear gl={{ antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false }}>
      <Engine frame={frame} />
    </ThreeCanvas>
  </AbsoluteFill>
);

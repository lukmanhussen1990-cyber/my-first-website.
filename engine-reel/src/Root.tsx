import React from 'react';
import { Composition } from 'remotion';
import { EngineReel } from './EngineReel';
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="EngineReel"
    component={EngineReel}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);

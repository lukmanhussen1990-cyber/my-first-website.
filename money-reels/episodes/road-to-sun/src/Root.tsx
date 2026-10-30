import React from 'react';
import {Composition} from 'remotion';
import {MoneyRoad} from './MoneyRoad';
import {DURATION, FPS, H, W} from './lib/anim';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="MoneyRoad" component={MoneyRoad} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={W} height={H} />
  </>
);

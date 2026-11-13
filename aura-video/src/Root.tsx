import React from 'react';
import {Composition} from 'remotion';
import {AuraVideo} from './AuraVideo';
import {DURATION, FPS} from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="AuraVideo" component={AuraVideo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);

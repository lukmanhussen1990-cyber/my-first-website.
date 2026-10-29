import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from '../episodes/fire-insurance/src/StyleTest';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="StyleTest" component={StyleTest} width={1080} height={1920} fps={30} durationInFrames={60} />
  </>
);

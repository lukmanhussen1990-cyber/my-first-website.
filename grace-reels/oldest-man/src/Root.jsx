import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel.jsx';
import { Cover } from './Cover.jsx';
import { CastSheet } from './CastSheet.jsx';
import { TIMELINE } from './lib/planInstance.js';

export const Root = () => (
  <>
    <Composition id="OldestMan" component={Reel} width={1080} height={1920} fps={30} durationInFrames={TIMELINE.frames}
      defaultProps={{ frames: null, audio: true, overlay: true, debug: false }} />
    <Composition id="Stills" component={Reel} width={1080} height={1920} fps={30} durationInFrames={1}
      defaultProps={{ frames: [0], audio: false, overlay: true, debug: true }}
      calculateMetadata={({ props }) => ({ durationInFrames: props.frames.length })} />
 <Composition id="CastSheet" component={CastSheet} width={1920} height={1440} fps={30} durationInFrames={1} />
    <Composition id="Cover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{ frame: 150 }} />
  </>
);

import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel.jsx';
import { Cover } from './Cover.jsx';
import { CastSheet, CastCloseup } from './CastSheet.jsx';
import { TIMELINE } from './lib/planInstance.js';

export const Root = () => (
  <>
    <Composition id="SonOfTheFather" component={Reel} width={1080} height={1920} fps={30} durationInFrames={TIMELINE.frames}
      defaultProps={{ frames: null, audio: true, overlay: true, debug: false }} />
    <Composition id="Stills" component={Reel} width={1080} height={1920} fps={30} durationInFrames={1}
      defaultProps={{ frames: [0], audio: false, overlay: true, debug: true }}
      calculateMetadata={({ props }) => ({ durationInFrames: props.frames.length })} />
    <Composition id="CastSheet" component={CastSheet} width={2560} height={1920} fps={30} durationInFrames={1} />
    <Composition id="CastCloseup" component={CastCloseup} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{ view: 'threeQuarter', t: 1.0, lamp: 1 }} />
    <Composition id="Cover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{ frame: 150 }} />
  </>
);

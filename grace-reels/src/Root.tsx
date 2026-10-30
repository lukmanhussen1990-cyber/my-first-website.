import React from 'react';
import { Composition } from 'remotion';
import { StyleTest } from './episodes/adam-silent/StyleTest';
import { AdamSilent } from './episodes/adam-silent/AdamSilent';
import { TOTAL } from './episodes/adam-silent/data';
import { Cover } from './episodes/adam-silent/Cover';

export const Root: React.FC = () => (
  <>
    <Composition id="AdamSilent" component={AdamSilent} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ fx: true }} />
    <Composition id="AdamSilentAnimatic" component={AdamSilent} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ fx: false }} />
    <Composition id="Cover" component={Cover} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="StyleTest" component={StyleTest} durationInFrames={4} fps={30} width={1080} height={1920} />
  </>
);

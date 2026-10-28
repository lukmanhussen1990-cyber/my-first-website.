import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {FieldWorld} from './three/FieldWorld';
import type {Shot} from './three/fieldLayout';

export const FieldTest: React.FC<{shot: Shot; t: number}> = ({shot, t}) => (
  <AbsoluteFill style={{background: '#000'}}>
    <ThreeCanvas width={1080} height={1920} shadows={{type: 2}} gl={{antialias: false, preserveDrawingBuffer: true}}>
      <FieldWorld shot={shot} t={t} />
    </ThreeCanvas>
  </AbsoluteFill>
);

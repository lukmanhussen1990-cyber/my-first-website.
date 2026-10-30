import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SpeedLines} from '../components/Sky';
import {T, prog} from '../lib/anim';
import {SunRoad, hookDist, hookSpeed} from './SunRoad';

/** HOOK: racing along the money road toward the Sun, Elon waiting at the end. */
export const Hook: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill>
    <SunRoad t={t} dist={hookDist(t)} speed={hookSpeed(t)} thumbAt={T.hookThumb} sunScale={1 + 0.22 * prog(t, 0, 4.5)} />
    <SpeedLines t={t} intensity={Math.max(0, 1.1 - t / 3)} radial cx={540} cy={660} color="255,236,180" />
  </AbsoluteFill>
);

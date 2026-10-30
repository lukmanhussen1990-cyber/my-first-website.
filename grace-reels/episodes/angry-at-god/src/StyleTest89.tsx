import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  AshPatch, Brand, BrokenHeart, C, Caption, FogPanel, GROUND_Y, Glow, GroundLine, Jesus, Label, MorphBubble, PegPerson,
  PrayerRow, RainCloud, RockyHill, Sky, loadFonts,
} from '../../../src/kit-flat';

loadFonts();

const DAVID_WRAP = '#3D5A8C';

export const StyleTest89: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Sky kind="night" frame={frame} moon={{x: 790, y: 600, r: 120}} />
        <FogPanel />
        <GroundLine />
        <RockyHill x={300} y={GROUND_Y} w={460} h={170} />
        <PegPerson x={300} y={GROUND_Y - 170} scale={0.85} robe={C.robeRust} wrap beard wrapColor={DAVID_WRAP} pose="armsUp" look={1} tremble={0.6} frame={frame} seed="david" />
        <AshPatch x={640} y={GROUND_Y} w={220} />
        <PegPerson x={640} y={GROUND_Y} scale={0.8} robe={C.robeGrey} wrap beard wrapColor="#8E929C" pose="sitGround" look={-1} frame={frame} seed="job" />
        <RainCloud x={640} y={GROUND_Y - 360} frame={frame} />
        <BrokenHeart x={560} y={GROUND_Y - 300} scale={1.1} />
        <Glow x={900} y={GROUND_Y - 220} r={260} color="#FFD58A" opacity={0.6} />
        <Jesus x={900} y={GROUND_Y} scale={0.8} frame={frame} pose="stand" />
        <MorphBubble x={330} y={540} lines={['HOW LONG?!']} size={46} tail={{x: -6, y: 105}} morph={0} />
        <Label x={540} y={420} text="ANGRY AT GOD?" tone="red" size={64} />
        <PrayerRow frame={frame} fills={[0, null, null, null]} />
      </svg>
      <Brand />
      <Caption
        frame={frame}
        fps={fps}
        words={[
          {text: 'King', start: 0, end: 0.2},
          {text: 'David', start: 0, end: 0.2},
          {text: 'yelled', start: 0, end: 0.2, tone: 'red'},
          {text: 'at', start: 0, end: 0.2},
          {text: 'God…', start: 0, end: 0.2},
          {text: 'and', start: 9, end: 9},
          {text: 'it’s', start: 9, end: 9},
          {text: 'in', start: 9, end: 9},
          {text: 'the', start: 9, end: 9},
          {text: 'Bible.', start: 9, end: 9},
        ]}
      />
    </AbsoluteFill>
  );
};

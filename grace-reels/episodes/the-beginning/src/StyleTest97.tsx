import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, C, Caption, Chalkboard, EvidenceRow, FlatGalaxy, FogPanel, GROUND_Y, GroundLine, Label, PegPerson, Sky, loadFonts} from '../../../src/kit-flat';

loadFonts();

export const EQUATIONS = [
  'M 40 70 q 20 -40 40 0 t 40 0 t 40 0',
  'M 180 60 l 30 0 M 195 45 l 0 30',
  'M 240 50 q 30 -20 40 10 q -20 30 -40 20',
  'M 40 150 l 60 0 M 120 130 q 30 40 60 0 t 60 0',
  'M 60 240 l 250 0 M 290 225 l 25 15 l -25 15',
];

export const StyleTest97: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Sky kind="night" frame={frame} moon={{x: 860, y: 560, r: 95}} />
        <FlatGalaxy x={250} y={520} r={80} rot={-15} seed="a" />
        <FlatGalaxy x={600} y={640} r={60} rot={30} seed="b" />
        <FlatGalaxy x={400} y={760} r={45} rot={10} seed="c" opacity={0.8} />
        <FogPanel />
        <GroundLine />
        <Chalkboard x={420} y={GROUND_Y} strokes={EQUATIONS} draw={1} />
        <PegPerson x={720} y={GROUND_Y} scale={0.9} robe="#2B2830" headColor="#E8DCCB" outfit="priest" pose="write" frame={frame} seed="p" />
        <PegPerson x={900} y={GROUND_Y} scale={0.9} robe="#F4F2EC" headColor="#E6DDCA" outfit="labcoat" pose="stand" frame={frame} seed="s" />
        <Label x={540} y={420} text="NO BEGINNING?" tone="red" size={64} />
        <EvidenceRow frame={frame} fills={[0, null, null]} />
      </svg>
      <Brand />
      <Caption frame={frame} fps={fps} words={[
        {text: 'For', start: 0, end: 0}, {text: 'years,', start: 0, end: 0}, {text: 'many', start: 0, end: 0}, {text: 'great', start: 0, end: 0},
        {text: 'scientists', start: 0, end: 0}, {text: 'believed', start: 9, end: 9}]} />
    </AbsoluteFill>
  );
};

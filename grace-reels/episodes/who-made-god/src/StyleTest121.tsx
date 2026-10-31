import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  BurningBush, C, Caption, ChainArrow, ChainCard, FogPanel, GROUND_Y, GroundLine, Jesus, Label, PegPerson, QuestionCircle, Sky, StepCounter, Brand, loadFonts,
} from '../../../src/kit-flat';

loadFonts();

export const StyleTest121: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Sky kind="night" frame={frame} moon={{x: 880, y: 470, r: 80}} />
        <FogPanel />
        <GroundLine />
        <ChainCard x={180} y={720} icon="iam" label="I AM" gold />
        <ChainArrow x1={290} y1={720} x2={370} y2={720} />
        <ChainCard x={480} y={720} icon="stars" label="STARS" />
        <ChainArrow x1={590} y1={720} x2={670} y2={720} />
        <ChainCard x={780} y={720} icon="parents" label="PARENTS" />
        <QuestionCircle x={210} y={872} scale={0.42} />
        <PegPerson x={210} y={GROUND_Y} scale={0.6} robe={C.youBlue} pose="stand" look={1} frame={frame} seed="you" />
        <BurningBush x={520} y={GROUND_Y} frame={frame} scale={0.55} />
        <PegPerson x={690} y={GROUND_Y} scale={0.7} robe={C.robeBlue} wrap beard wrapColor={C.robeRust} pose="staff" frame={frame} seed="moses" />
        <line x1={757} y1={GROUND_Y} x2={757} y2={GROUND_Y - 320} stroke={C.woodDark} strokeWidth={8} strokeLinecap="round" />
        <Jesus x={890} y={GROUND_Y} scale={0.7} frame={frame} pose="armsOpen" />
        <Label x={540} y={430} text="WHO MADE GOD?" tone="red" size={66} />
        <StepCounter value="∞?" />
      </svg>
      <Brand />
      <Caption frame={frame} fps={fps} words={[
        {text: 'If', start: 0, end: 0}, {text: 'God', start: 0, end: 0}, {text: 'made', start: 0, end: 0}, {text: 'everything…', start: 0, end: 0},
        {text: 'then', start: 9, end: 9}, {text: 'who', start: 9, end: 9}, {text: 'made', start: 9, end: 9}, {text: 'God?', start: 9, end: 9, tone: 'red'}]} />
    </AbsoluteFill>
  );
};

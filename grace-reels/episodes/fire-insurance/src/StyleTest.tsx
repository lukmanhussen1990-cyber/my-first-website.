import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  Brand, C, Caption, FearLoveMeter, Fire, FlameIcon, FogPanel, GROUND_Y, Glow, GroundLine, Jesus, Label,
  PegPerson, Sky, SpeechBubble, ThoughtBubble, Tree, VerseRef, loadFonts,
} from '../../../src/kit-flat';

loadFonts();

// One test frame that puts every core element of the flat style together,
// laid out like the reference's moonlit fire scene for a fair comparison.
export const StyleTest: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <Sky kind="night" frame={frame} moon={{x: 560, y: 520, r: 135}} />
        <Glow x={640} y={GROUND_Y - 60} r={360} color="#F08A52" opacity={0.75} />
        <Tree x={70} y={GROUND_Y} scale={0.95} />
        <FogPanel tint={C.nightLow} />
        <Glow x={640} y={GROUND_Y + 40} r={330} ry={170} color="#E88560" opacity={0.6} />
        <GroundLine />
        <PegPerson x={230} y={GROUND_Y} scale={0.8} robe={C.robeRust} wrap beard frame={frame} seed="a" />
        <Fire x={700} y={GROUND_Y - 4} frame={frame} scale={0.55} />
        <PegPerson x={400} y={GROUND_Y} scale={0.8} robe={C.robeBlue} wrap beard frame={frame} seed="b" pose="stand" />
        <PegPerson x={540} y={GROUND_Y} scale={0.8} robe={C.robeBlush} frame={frame} seed="c" />
        <Jesus x={880} y={GROUND_Y} scale={0.8} frame={frame} pose="armsOpen" />
        <ThoughtBubble x={230} y={640} w={240} tip={{x: -6, y: 190}} fill={C.cloud}>
          <FlameIcon x={0} y={0} scale={0.9} frame={frame} />
        </ThoughtBubble>
        <SpeechBubble x={760} y={700} lines={['PEACE,', 'BE STILL.']} tone="gold" tail={{x: 110, y: 120}} />
        <Label x={540} y={390} text="THE BEGINNING" tone="gold" />
        <VerseRef x={540} y={440} text="PROVERBS 9:10" color={C.cream} />
        <FearLoveMeter value={0.18} frame={frame} />
      </svg>
      <Brand />
      <Caption
        frame={frame}
        fps={fps}
        words={[
          {text: 'Is', start: 0, end: 0.2},
          {text: 'Jesus', start: 0, end: 0.4, tone: 'gold'},
          {text: 'just', start: 0, end: 0.4},
          {text: 'your', start: 0, end: 0.4},
          {text: 'fire', start: 9, end: 9.4, tone: 'red'},
          {text: 'insurance?', start: 9, end: 9.8, tone: 'red'},
        ]}
      />
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {
  C, FearLoveMeter, FlameIcon, FogPanel, GROUND_Y, GroundLine, InsuranceDoc, PegPerson, Sky, ThoughtBubble, VerseRef, loadFonts,
} from '../../../src/kit-flat';
import {FONT_SERIF} from '../../../src/kit-flat/fonts';

loadFonts();

const Title: React.FC<{y: number; text: string; size: number; fill: string}> = ({y, text, size, fill}) => (
  <g>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2}
      fill={C.ink} stroke={C.ink} strokeWidth={size * 0.2} strokeLinejoin="round">
      {text}
    </text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2}
      fill={fill} stroke={C.labelRing} strokeWidth={size * 0.07} strokeLinejoin="round">
      {text}
    </text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={fill}>
      {text}
    </text>
  </g>
);

// Cover: everything important inside y 240–1680 (3:4 profile-grid crop).
export const Cover: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: C.fogMid}}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <Sky kind="night" frame={40} moon={{x: 860, y: 760, r: 92}} />
      <FogPanel />
      <GroundLine />
      <Title y={380} text="JUST FIRE" size={100} fill={C.cream} />
      <Title y={510} text="INSURANCE?" size={122} fill={C.red} />
      <FearLoveMeter x={540} y={630} width={500} value={0.04} frame={0} />
      <PegPerson x={330} y={GROUND_Y} robe={C.youBlue} pose="pray" tremble={0.8} frame={3} seed="cover" />
      <ThoughtBubble x={500} y={790} w={220} tip={{x: -140, y: 170}}>
        <FlameIcon x={0} y={4} scale={0.82} frame={0} />
      </ThoughtBubble>
      <InsuranceDoc x={790} y={1000} rotate={-6} scale={0.62} stamp={1} />
      <VerseRef x={540} y={1610} text="1 JOHN 4:18" color={C.red} ring={false} size={40} />
    </svg>
  </AbsoluteFill>
);

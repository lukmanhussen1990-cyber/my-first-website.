import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FogPanel, GROUND_Y, GroundLine, MorphBubble, PegPerson, RockyHill, Sky, VerseRef, loadFonts} from '../../../src/kit-flat';
import {FONT_SERIF} from '../../../src/kit-flat/fonts';
import {DAVID_WRAP} from './scenes/Worlds.tsx';

loadFonts();

const Title: React.FC<{y: number; text: string; size: number; fill: string}> = ({y, text, size, fill}) => (
  <g>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={C.ink} stroke={C.ink} strokeWidth={size * 0.2} strokeLinejoin="round">{text}</text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={fill} stroke={C.labelRing} strokeWidth={size * 0.07} strokeLinejoin="round">{text}</text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={fill}>{text}</text>
  </g>
);

export const Cover: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: C.fogMid}}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <Sky kind="night" frame={40} moon={{x: 780, y: 760, r: 150}} />
      <FogPanel />
      <GroundLine />
      <Title y={390} text="ANGRY" size={130} fill={C.red} />
      <Title y={510} text="AT GOD?" size={110} fill={C.cream} />
      <RockyHill x={380} y={GROUND_Y} w={560} h={170} />
      <PegPerson x={380} y={GROUND_Y - 170} scale={1.05} robe={C.robeRust} wrap beard wrapColor={DAVID_WRAP} pose="armsUp" look={1} tremble={0.8} frame={3} seed="cover" />
      <MorphBubble x={640} y={680} lines={['HOW LONG?!']} size={52} tail={{x: -170, y: 120}} seed="cv" />
      <VerseRef x={540} y={1610} text="PSALM 13:1" color={C.red} ring={false} size={40} />
    </svg>
  </AbsoluteFill>
);

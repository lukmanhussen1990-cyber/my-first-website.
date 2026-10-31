import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, ChainArrow, ChainCard, FogPanel, GROUND_Y, GroundLine, PegPerson, QuestionCircle, Sky, VerseRef, loadFonts} from '../../../src/kit-flat';
import type {ChainIcon} from '../../../src/kit-flat';
import {FONT_SERIF} from '../../../src/kit-flat/fonts';

loadFonts();

const Title: React.FC<{y: number; text: string; size: number; fill: string}> = ({y, text, size, fill}) => (
  <g>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={C.ink} stroke={C.ink} strokeWidth={size * 0.2} strokeLinejoin="round">{text}</text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={fill} stroke={C.labelRing} strokeWidth={size * 0.07} strokeLinejoin="round">{text}</text>
    <text x={540} y={y} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={size} letterSpacing={2} fill={fill}>{text}</text>
  </g>
);

const chain: [number, number, ChainIcon, string][] = [
  [820, 900, 'parents', 'PARENTS'],
  [610, 820, 'earth', 'EARTH'],
  [400, 740, 'stars', 'STARS'],
];

export const Cover: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: C.fogMid}}>
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <Sky kind="night" frame={40} stars />
      <FogPanel />
      <GroundLine />
      <Title y={380} text="WHO MADE" size={108} fill={C.cream} />
      <Title y={530} text="GOD?" size={150} fill={C.gold} />
      <ChainCard x={190} y={660} icon="iam" label="I AM" gold scale={0.72} />
      <ChainArrow x1={262} y1={680} x2={330} y2={715} />
      {chain.map(([x, y, icon, label], i) => (
        <g key={i}>
          <ChainCard x={x} y={y} icon={icon} label={label} scale={0.62} />
          {i > 0 ? <ChainArrow x1={x + 66} y1={y + 18} x2={chain[i - 1][0] - 66} y2={chain[i - 1][1] - 18} /> : null}
        </g>
      ))}
      <QuestionCircle x={330} y={950} scale={0.62} />
      <PegPerson x={330} y={GROUND_Y} scale={0.8} robe={C.youBlue} pose="stand" look={1} frame={0} seed="cv" />
      <VerseRef x={540} y={1610} text="EXODUS 3:14" color={C.red} ring={false} size={40} />
    </svg>
  </AbsoluteFill>
);

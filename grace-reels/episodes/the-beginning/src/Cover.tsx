import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, Chalkboard, FlatGalaxy, FogPanel, GROUND_Y, GlowPoint, GroundLine, PegPerson, Sky, VerseRef, loadFonts} from '../../../src/kit-flat';
import {FONT_SERIF} from '../../../src/kit-flat/fonts';

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
      <Sky kind="night" frame={40} />
      {[[-1, -0.5], [1, -0.4], [-0.8, 0.6], [0.9, 0.7], [0.1, -1]].map(([dx, dy], i) => (
        <g key={i}>
          {[0, 1, 2].map((k) => (
            <FlatGalaxy key={k} x={540 + dx * (250 + k * 40)} y={700 + dy * (150 + k * 24)} r={46} rot={i * 50 + k * 20} opacity={k === 0 ? 1 : 0.25 - k * 0.07} seed={`cv${i}`} />
          ))}
          <line x1={540 + dx * 230} y1={700 + dy * 140} x2={540 + dx * 80} y2={700 + dy * 48} stroke={C.gold} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 14" />
        </g>
      ))}
      <GlowPoint x={540} y={700} r={12} glow={1.4} />
      <FogPanel />
      <GroundLine />
      <Chalkboard x={400} y={GROUND_Y} draw={1} strokes={['M 40 70 q 20 -40 40 0 t 40 0 t 40 0', 'M 190 58 l 30 0 M 205 43 l 0 30', 'M 60 250 l 250 0 M 290 235 l 25 15 l -25 15']} scale={0.85} />
      <PegPerson x={760} y={GROUND_Y} scale={0.95} robe="#2B2830" headColor="#E8DCCB" outfit="priest" pose="write" look={1} frame={0} seed="cv" />
      <Title y={360} text="THE BIG BANG?" size={104} fill={C.cream} />
      <Title y={480} text="A PRIEST'S IDEA." size={104} fill={C.gold} />
      <VerseRef x={540} y={1610} text="GENESIS 1:1" color={C.red} ring={false} size={40} />
    </svg>
  </AbsoluteFill>
);

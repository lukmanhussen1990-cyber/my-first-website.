import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {FieldWorld} from './three/FieldWorld';
import {useFonts} from './ui/Fonts';
import {CREAM, GOLD, SANS, SERIF} from './lib/theme';
import {Grade} from './scenes/kit';

// Cover: everything important inside y 240–1680 (the 3:4 profile-grid crop).
export const Cover: React.FC = () => {
  useFonts();
  const line = (text: string, size: number, color: string, glow = false): React.ReactNode => (
    <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: size, lineHeight: 1.0, color, letterSpacing: '0.02em', whiteSpace: 'nowrap',
      textShadow: glow ? '0 0 30px rgba(242,181,68,0.6), 0 6px 22px rgba(0,0,0,0.75)' : '0 6px 22px rgba(0,0,0,0.75)'}}>{text}</div>
  );
  return (
    <AbsoluteFill style={{background: '#120A05'}}>
      <ThreeCanvas width={1080} height={1920} shadows={{type: 2}} gl={{antialias: false, preserveDrawingBuffer: true}}>
        <FieldWorld shot="COVER" t={2.45} />
      </ThreeCanvas>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 52% at 50% 62%, rgba(0,0,0,0) 45%, rgba(24,10,2,0.78) 100%)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(18,8,2,0.88) 0%, rgba(18,8,2,0.55) 24%, rgba(18,8,2,0) 40%)'}} />
      <div style={{position: 'absolute', top: 268, left: 0, right: 0, textAlign: 'center'}}>
        {line('IF GOD IS REAL,', 104, CREAM)}
        <div style={{height: 14}} />
        {line('WHY ARE THERE', 112, GOLD, true)}
        {line('POOR PEOPLE?', 126, GOLD, true)}
      </div>
      <div style={{position: 'absolute', top: 1600, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: '0.3em', color: CREAM, textShadow: '0 2px 10px rgba(0,0,0,0.8)'}}>
        LEVITICUS 19:9
      </div>
      <Grade vignette={0.3} grain={0.08} />
    </AbsoluteFill>
  );
};

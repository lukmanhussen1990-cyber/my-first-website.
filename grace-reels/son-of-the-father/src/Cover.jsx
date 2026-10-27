// The cover: Jesus (left, wrists bound, in warm gold light) and Barabbas (right, in chains, under a cold spotlight) side
// by side in the frozen, darkened court (the S9 look); the reel's locked name card "BARABBAS = ???" glowing above them and
// "HIS NAME WILL SHOCK YOU". Everything that matters sits inside the 4:5 grid crop (y 285–1635); the GRACE IN MOTION
// mark stays top-left like the reel.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img, staticFile, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Engine } from './Engine.jsx';
import { fontsReady, SANS, SERIF } from './lib/fonts.js';

// from the palace colonnade (the seat is empty in the freeze): both men full figure side by side, heads ~y 1160
const COVER_CAM = { pos: [13.65, 4.4, 0.0], look: [4.4, 2.25, 0.0], fov: 30, focus: 9.4 };
const GOLD = '#f2c463', CREAM = '#fbf1dc';

export const Cover = ({ frame = 1305 }) => {
  const [h] = useState(() => delayRender('cover fonts', { timeoutInMilliseconds: 600000 }));
  useEffect(() => { fontsReady().then(() => continueRender(h)); }, [h]);
  const shadow = '0 10px 40px rgba(0,0,0,0.65), 0 3px 10px rgba(0,0,0,0.6)';
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <ThreeCanvas width={1080} height={1920} dpr={1} flat linear gl={{ antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false }}>
        <Engine frame={frame} cam={COVER_CAM} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,6,3,0.72) 0%, rgba(10,6,3,0.35) 26%, rgba(10,6,3,0.05) 48%, rgba(10,6,3,0) 62%, rgba(10,6,3,0.4) 100%)' }} />
      {/* HIS NAME / WILL SHOCK YOU */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 318, textAlign: 'center', font: `700 112px/1 ${SERIF}`, letterSpacing: '0.05em', color: CREAM, textShadow: shadow, whiteSpace: 'nowrap' }}>HIS NAME</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 446, textAlign: 'center', font: `italic 700 104px/1 ${SERIF}`, letterSpacing: '0.02em', color: GOLD, whiteSpace: 'nowrap',
        textShadow: '0 0 40px rgba(255,180,70,0.55), 0 8px 30px rgba(0,0,0,0.6)' }}>WILL SHOCK YOU</div>
      <div style={{ position: 'absolute', left: 340, right: 340, top: 586, height: 2, background: `linear-gradient(90deg, rgba(242,196,99,0), ${GOLD}, rgba(242,196,99,0))` }} />
      {/* the locked name card, glowing above the two men */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', padding: '26px 54px 30px', borderRadius: 999, background: 'linear-gradient(180deg, rgba(30,22,15,0.9), rgba(12,9,6,0.92))', border: `4px solid ${GOLD}`,
          boxShadow: '0 22px 60px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,232,180,0.2), 0 0 70px rgba(255,180,70,0.5), 0 0 160px rgba(255,170,60,0.3)', display: 'flex', alignItems: 'center', gap: 26, whiteSpace: 'nowrap' }}>
          <span style={{ font: `700 100px/1 ${SERIF}`, letterSpacing: '0.06em', color: CREAM, textShadow: '0 0 26px rgba(255,190,90,0.5)' }}>BARABBAS</span>
          <span style={{ font: `600 86px/1 ${SERIF}`, color: 'rgba(246,236,216,0.85)' }}>=</span>
          <span style={{ font: `700 100px/1 ${SERIF}`, letterSpacing: '0.04em', color: GOLD, textShadow: '0 0 30px rgba(255,190,80,0.9), 0 0 60px rgba(255,170,60,0.5)' }}>???</span>
          <svg width="56" height="70" viewBox="0 0 62 78" style={{ marginLeft: 4 }}>
            <path d="M 14 34 L 14 22 Q 14 8 31 8 Q 48 8 48 22 L 48 34" stroke="#e9c06a" strokeWidth="7" fill="none" strokeLinecap="round" />
            <rect x="6" y="32" width="50" height="40" rx="8" fill="#c9962e" stroke="#ffe0a0" strokeWidth="2.5" />
            <circle cx="31" cy="49" r="5.5" fill="#5a3a10" /><rect x="28.5" y="51" width="5" height="11" rx="2" fill="#5a3a10" />
          </svg>
        </div>
      </div>
      {/* who is who (small, under the card) */}
      <div style={{ position: 'absolute', left: 240 - 150, width: 300, top: 960, textAlign: 'center', font: `700 30px ${SANS}`, letterSpacing: '0.3em', color: CREAM, textShadow: shadow }}>JESUS</div>
      <div style={{ position: 'absolute', left: 840 - 150, width: 300, top: 960, textAlign: 'center', font: `700 30px ${SANS}`, letterSpacing: '0.3em', color: CREAM, textShadow: shadow }}>BARABBAS</div>
      <div style={{ position: 'absolute', left: 72, top: 215, height: 42, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.95 }}>
        <Img src={staticFile('logo.svg')} style={{ width: 42, height: 42, borderRadius: 21, boxShadow: '0 0 0 1.5px #f2c26a, 0 2px 10px rgba(0,0,0,0.5)' }} />
        <div style={{ font: `700 21px ${SANS}`, letterSpacing: '0.22em', color: CREAM, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>GRACE <span style={{ color: '#f2c26a' }}>IN</span> MOTION</div>
      </div>
    </AbsoluteFill>
  );
};

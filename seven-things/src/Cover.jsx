// The cover: the cracked stone 7 in the desert (a frame of the 3D hook with the dust settled) +
// GOD HATES 7 THINGS and a smaller "#7 SURPRISES EVERYONE". Text kept inside the 4:5 grid crop.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Engine } from './Engine.jsx';
import { fontsReady, SANS } from './lib/fonts.js';

// a wider, lower camera than the reel so the whole cracked 7 sits under the title
const COVER_CAM = { pos: [17.5, 7.4, 46.5], look: [0, 4.6, 0], fov: 24, focus: 50 };
export const Cover = ({ frame = 150 }) => {
  const [h] = useState(() => delayRender('cover fonts', { timeoutInMilliseconds: 240000 }));
  useEffect(() => { fontsReady().then(() => continueRender(h)); }, [h]);
  const shadow = '0 10px 40px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.6)';
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <ThreeCanvas width={1080} height={1920} dpr={1} flat linear gl={{ antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false }}>
        <Engine frame={frame} cam={COVER_CAM} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,6,3,0.55) 0%, rgba(10,6,3,0) 34%, rgba(10,6,3,0) 66%, rgba(10,6,3,0.5) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center' }}>
        <div style={{ font: `800 150px/0.98 ${SANS}`, color: '#fff8ee', textShadow: shadow }}>GOD HATES</div>
        <div style={{ font: `800 150px/1.02 ${SANS}`, color: '#fff8ee', textShadow: shadow }}><span style={{ color: '#f0bf5a', fontSize: 190, textShadow: '0 0 40px rgba(240,170,60,0.8), 0 10px 40px rgba(0,0,0,0.55)' }}>7</span> THINGS</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1460, display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '18px 40px 20px', borderRadius: 999, background: 'rgba(14,10,8,0.72)', border: '3px solid #f0bf5a', font: `800 54px ${SANS}`, letterSpacing: '0.04em', color: '#fff6e6', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
          <span style={{ color: '#f0bf5a' }}>#7</span> SURPRISES EVERYONE
        </div>
      </div>
    </AbsoluteFill>
  );
};

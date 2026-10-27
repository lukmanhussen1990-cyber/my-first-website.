// The cover: old Methuselah beside his oil lamp at night on the hill, a giant gold 969 in the sky behind him, the ark
// far away below; "THE OLDEST MAN…" / "AND THE FLOOD". Everything that matters sits inside the 4:5 grid crop
// (y 285–1635) and the GRACE IN MOTION mark stays top-left like the reel.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img, staticFile, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Engine } from './Engine.jsx';
import { fontsReady, SANS, SERIF } from './lib/fonts.js';

// a slightly wider, lower camera than S1 so he sits in the lower third with the night sky (and the 969) above him
const COVER_CAM = { pos: [4.4, 1.35, 9.4], look: [-0.15, 1.72, -1.0], fov: 30, focus: 9.6 };

export const Cover = ({ frame = 60 }) => {
  const [h] = useState(() => delayRender('cover fonts', { timeoutInMilliseconds: 600000 }));
  useEffect(() => { fontsReady().then(() => continueRender(h)); }, [h]);
  const shadow = '0 10px 40px rgba(0,0,0,0.6), 0 3px 10px rgba(0,0,0,0.6)';
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <ThreeCanvas width={1080} height={1920} dpr={1} flat linear gl={{ antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false }}>
        <Engine frame={frame} cam={COVER_CAM} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(4,6,14,0.55) 0%, rgba(4,6,14,0.1) 30%, rgba(4,6,14,0) 55%, rgba(4,6,14,0.35) 100%)' }} />
      {/* the giant gold 969 hanging in the night sky */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 450, textAlign: 'center', font: `700 430px/0.8 ${SERIF}`, fontVariantNumeric: 'lining-nums', letterSpacing: '-0.02em',
        color: '#f2c26a', textShadow: '0 0 60px rgba(255,180,70,0.75), 0 0 140px rgba(255,160,50,0.45), 0 14px 40px rgba(0,0,0,0.6)' }}>969</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 318, textAlign: 'center', font: `700 94px/1 ${SERIF}`, letterSpacing: '0.04em', color: '#fbf1dc', textShadow: shadow, whiteSpace: 'nowrap' }}>
        THE OLDEST MAN…
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 860, display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '16px 44px 20px', borderRadius: 999, background: 'rgba(10,8,14,0.72)', border: '3px solid #f2c26a', font: `italic 700 74px/1 ${SERIF}`, letterSpacing: '0.04em', color: '#fff6e6', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
          AND THE <span style={{ color: '#f2c26a' }}>FLOOD</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 72, top: 215, height: 42, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.95 }}>
        <Img src={staticFile('logo.svg')} style={{ width: 42, height: 42, borderRadius: 21, boxShadow: '0 0 0 1.5px #f2c26a, 0 2px 10px rgba(0,0,0,0.5)' }} />
        <div style={{ font: `700 21px ${SANS}`, letterSpacing: '0.22em', color: '#fbf1dc', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>GRACE <span style={{ color: '#f2c26a' }}>IN</span> MOTION</div>
      </div>
    </AbsoluteFill>
  );
};

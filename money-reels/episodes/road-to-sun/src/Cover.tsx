import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import '@fontsource/lilita-one/400.css';
import {GREEN} from './lib/anim';
import {SunRoad} from './scenes/SunRoad';

/** Reel cover: Elon on the money road in front of the Sun with the title. */
export const Cover: React.FC = () => {
  const [handle] = useState(() => delayRender('cover font'));
  useEffect(() => {
    document.fonts.load('80px "Lilita One"').then(() => continueRender(handle));
  }, [handle]);
  const line = (text: string, color: string, size: number) => (
    <div style={{fontFamily: 'Lilita One', fontSize: size, lineHeight: 1.02, color, WebkitTextStroke: '18px #0b0b10', paintOrder: 'stroke fill', textShadow: '0 12px 0 rgba(0,0,0,0.45)'}}>{text}</div>
  );
  return (
    <AbsoluteFill>
      <SunRoad t={0.4} dist={11} speed={8} sunScale={1.75} sunY={640} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35) 100%)'}} />
      <div style={{position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center', transform: 'rotate(-4deg)'}}>
        {line("ELON'S", '#ffffff', 170)}
        {line('MONEY ROAD', GREEN, 150)}
      </div>
      <div style={{position: 'absolute', top: 1330, left: 0, right: 0, textAlign: 'center', transform: 'rotate(-3deg)'}}>
        {line('...ALL THE WAY TO THE SUN!', '#ffe14a', 76)}
      </div>
    </AbsoluteFill>
  );
};

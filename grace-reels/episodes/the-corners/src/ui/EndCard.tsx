import React from 'react';
import {GOLD, SANS, SERIF, TEXT} from '../lib/theme';
import {E, SC} from '../lib/timeline';
import {clamp, easeOut, smooth} from '../lib/anim';
import {Logo} from './Logo';

/** Last 3 s: the logo draws itself, name + handle + tagline, then fades to the opening field (loop). */
export const EndCard: React.FC<{t: number}> = ({t}) => {
  if (t < SC.S16.start) return null;
  const bgIn = smooth(clamp((t - SC.S16.start) / 0.3));
  const loop = smooth(clamp((t - E.loopFlow.start) / (E.loopFlow.end - E.loopFlow.start)));
  const draw = easeOut(clamp((t - E.logoDraw.start) / (E.logoDraw.end - E.logoDraw.start)));
  const txt = (d: number) => easeOut(clamp((t - (E.endText + d)) / 0.35));
  const line = (d: number): React.CSSProperties => ({opacity: txt(d), transform: `translateY(${(1 - txt(d)) * 16}px)`});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: bgIn * (1 - loop)}}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 45% at 50% 44%, #3A2410 0%, #1A0F07 60%, #0E0805 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center'}}>
        <Logo size={230} draw={draw} glow={14 * draw} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center'}}>
        <div style={{...line(0), fontFamily: SANS, fontWeight: 600, fontSize: 44, letterSpacing: '0.22em', color: TEXT}}>GRACE IN MOTION</div>
        <div style={{...line(0.15), marginTop: 18, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 50, color: GOLD}}>@GraceINMotion616</div>
        <div style={{...line(0.3), marginTop: 46, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 58, color: TEXT}}>Hard questions. Bible answers.</div>
      </div>
    </div>
  );
};

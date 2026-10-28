import React from 'react';
import {GOLD, SERIF, TEXT} from '../lib/theme';
import {TL, SC} from '../lib/timeline';
import {clamp, easeOut, smooth} from '../lib/anim';

// Opening title, word-synced to the voice: "IF GOD IS REAL," / "WHY ARE THERE" / "POOR PEOPLE?"
const LINES: {words: string[]; size: number; color: string}[] = [
  {words: ['IF', 'GOD', 'IS', 'REAL,'], size: 92, color: TEXT},
  {words: ['WHY', 'ARE', 'THERE'], size: 100, color: GOLD},
  {words: ['POOR', 'PEOPLE?'], size: 112, color: GOLD},
];
const starts = TL.words.filter((w) => w.segment <= 1).map((w) => w.start);

export const Title: React.FC<{t: number}> = ({t}) => {
  const out = smooth(clamp((t - (SC.S2.start - 0.25)) / 0.35));
  if (out >= 1) return null;
  let wi = 0;
  return (
    <div style={{position: 'absolute', left: 60, width: 912, top: 1150 - 155, textAlign: 'center', opacity: 1 - out, transform: `translateY(${-out * 40}px)`}}>
      <div style={{position: 'absolute', left: -200, right: -200, top: -70, bottom: -70, background: 'linear-gradient(180deg, rgba(20,10,3,0) 0%, rgba(20,10,3,0.62) 28%, rgba(20,10,3,0.62) 72%, rgba(20,10,3,0) 100%)'}} />
      {LINES.map((ln, li) => (
        <div key={li} style={{position: 'relative', fontFamily: SERIF, fontWeight: 700, fontSize: ln.size, lineHeight: 1.02, letterSpacing: '0.02em', color: ln.color, whiteSpace: 'nowrap'}}>
          {ln.words.map((w) => {
            const st = wi === 0 ? -1 : starts[wi] - 0.06;
            wi++;
            const k = easeOut(clamp((t - st) / 0.22));
            const edge = '0 0 2px rgba(40,16,2,0.95), 0 3px 0 rgba(50,22,4,0.85), 0 6px 20px rgba(0,0,0,0.65)';
            const glow = ln.color === GOLD ? `${edge}, 0 0 28px rgba(242,181,68,${0.5 * k})` : edge;
            return (
              <span key={w} style={{display: 'inline-block', margin: '0 0.12em', opacity: k, transform: `translateY(${(1 - k) * 18}px) scale(${1.12 - 0.12 * k})`, textShadow: glow}}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

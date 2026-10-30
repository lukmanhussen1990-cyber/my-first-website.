import React from 'react';
import {AbsoluteFill} from 'remotion';
import captions from '../data/captions.json';
import {SpeedLines} from '../components/Sky';
import {Sprite} from '../components/Sprite';
import {DURATION, GREEN, SC, T, breathe, easeIn, pop, prog, squash} from '../lib/anim';
import {SunRoad, hookDist, hookSpeed} from './SunRoad';

const LINES = [['HOW', 'FAR', 'WOULD'], ['YOUR', 'ROAD', 'GO?']];
const phrase = captions.phrases.find((p) => p.words.some((w) => w.text === 'YOUR'))!;
const wordAt = (w: string) => phrase.words.find((x) => x.text.replace('?', '') === w.replace('?', ''))?.start ?? phrase.start;

/** CTA: you point at the viewer, then the screen glows into the opening shot so the reel loops. */
export const Cta: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.cta;
  const ps = pop(t, T.ctaPop, 0.4);
  const [sx, sy] = squash(t, T.ctaPop + 0.25, 0.14);
  const glowIn = easeIn(prog(t, T.ctaGlow, T.ctaGlow + 0.45));
  const reveal = prog(t, T.ctaGlow + 0.4, DURATION - 0.12);
  const bubble = pop(t, T.ctaComments, 0.35);
  const tl = t - DURATION; // runs up to the hook's t = 0 on the last frame
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `repeating-conic-gradient(from ${(t - a) * 25}deg at 50% 46%, #ffd84a 0deg 12deg, #ffb52e 12deg 24deg)`}} />
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 46%, rgba(255,255,255,0.55), rgba(255,255,255,0) 35%, rgba(120,40,0,0.35) 100%)'}} />
      {ps > 0 ? <Sprite name="13_you_point" x={540} y={1925} h={1340 * ps * breathe(t)} sx={sx * (1 + 0.015 * Math.sin(t * 7))} sy={sy} rot={Math.sin(t * 2.2) * 1.5} /> : null}
      <div style={{position: 'absolute', left: 120, right: 120, top: 250, textAlign: 'center'}}>
        {LINES.map((line, i) => (
          <div key={i} style={{display: 'flex', justifyContent: 'center', gap: 26}}>
            {line.map((w) => {
              const s = pop(t, wordAt(w) - 0.05, 0.3, 2.6);
              return (
                <span key={w} style={{display: 'inline-block', fontFamily: 'Lilita One', fontSize: 118, lineHeight: 1.08, color: w === 'YOUR' ? GREEN : '#fff', WebkitTextStroke: '14px #1E1E24', paintOrder: 'stroke fill', transform: `scale(${s}) rotate(${(i ? 3 : -3) * Math.sin(t * 3)}deg)`, filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.35))'}}>
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {bubble > 0 ? (
        <svg width={250} height={210} viewBox="0 0 250 210" style={{position: 'absolute', left: 690, top: 640, transform: `scale(${bubble}) rotate(${Math.sin(t * 4) * 6}deg)`}}>
          <path d="M30,20 H220 Q240,20 240,40 V130 Q240,150 220,150 H110 L60,195 L70,150 H30 Q10,150 10,130 V40 Q10,20 30,20 Z" fill="#fff" stroke="#1E1E24" strokeWidth={9} strokeLinejoin="round" />
          {[75, 125, 175].map((x, i) => (
            <circle key={x} cx={x} cy={85} r={15} fill={i === 1 ? GREEN : '#1E1E24'} />
          ))}
        </svg>
      ) : null}
      {glowIn > 0 ? <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #fffdf0 0%, #ffe9a0 45%, #ffb347 100%)', opacity: glowIn}} /> : null}
      {reveal > 0 ? (
        <AbsoluteFill style={{opacity: reveal}}>
          <SunRoad t={tl} dist={hookDist(tl)} speed={hookSpeed(tl)} sunScale={1} />
          <SpeedLines t={tl} intensity={1.1} radial cx={540} cy={660} color="255,236,180" />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

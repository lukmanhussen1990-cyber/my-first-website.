import React from 'react';
import {GOLD, SERIF, TEXT} from '../lib/theme';
import {TL, SC} from '../lib/timeline';
import {clamp, easeOut, smooth} from '../lib/anim';

// Voice clips whose words are shown elsewhere: the opening title (0,1) and the scripture cards.
export const CARD_SEGMENTS = [4, 6, 10, 14, 21, 23, 24];
const HIDDEN_SEGMENTS = [0, 1, ...CARD_SEGMENTS];

const pages = TL.pages.filter((p) => !HIDDEN_SEGMENTS.includes(TL.words[p.wordStart].segment));

const pageAlpha = (t: number, idx: number) => {
  const p = pages[idx];
  const next = TL.pages.find((q) => q.start > p.start + 0.01);
  const fadeOutAt = Math.min(next ? next.start - 0.05 : Infinity, p.end + 1.5, SC.S16.start);
  const a = smooth(clamp((t - (p.start - 0.18)) / 0.12));
  const b = 1 - smooth(clamp((t - fadeOutAt) / 0.16));
  return Math.min(a, b);
};

export const Captions: React.FC<{t: number}> = ({t}) => {
  const idx = pages.findIndex((p, i) => {
    const nextStart = pages[i + 1]?.start ?? Infinity;
    return t >= p.start - 0.2 && t < nextStart - 0.2;
  });
  if (idx < 0) return null;
  const alpha = pageAlpha(t, idx);
  if (alpha <= 0.001) return null;
  const p = pages[idx];
  const words = TL.words.slice(p.wordStart, p.wordEnd + 1);
  return (
    <>
      {/* soft scrim behind the caption block */}
      <div style={{
        position: 'absolute', left: -60, top: 170, width: 1120, height: 480, opacity: alpha * 0.9,
        background: 'radial-gradient(ellipse 62% 50% at 40% 46%, rgba(18,10,4,0.62) 0%, rgba(18,10,4,0.32) 55%, rgba(18,10,4,0) 100%)',
      }} />
      <div style={{
        position: 'absolute', left: 72, top: 240, width: 888, opacity: alpha,
        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 66, lineHeight: 1.15, color: TEXT,
        textShadow: '0 2px 12px rgba(0,0,0,0.55)',
      }}>
        {words.map((w) => {
          const ghost = t >= w.start - 0.15 && t < w.start;
          const k = easeOut(clamp((t - w.start) / 0.2));
          const o = t < w.start - 0.15 ? 0 : ghost ? 0.25 : 0.25 + 0.75 * k;
          const rise = t < w.start ? 10 : 10 * (1 - k);
          let scale = 1;
          if (w.keyword && t >= w.start) {
            const pk = clamp((t - w.start) / 0.32);
            scale = 1 + 0.14 * Math.sin(pk * Math.PI) * (1 - pk * 0.3);
          }
          const kwOn = w.keyword && t >= w.start;
          return (
            <span key={w.i} style={{
              display: 'inline-block', marginRight: '0.24em', opacity: o, transform: `translateY(${rise}px) scale(${scale})`,
              transformOrigin: '50% 70%',
              ...(w.keyword ? {
                fontStyle: 'normal', fontWeight: 700, letterSpacing: '0.02em', color: kwOn ? GOLD : TEXT,
                textShadow: kwOn ? `0 0 18px rgba(242,181,68,0.55), 0 2px 10px rgba(0,0,0,0.5)` : undefined,
              } : null),
            }}>{w.text}</span>
          );
        })}
      </div>
    </>
  );
};

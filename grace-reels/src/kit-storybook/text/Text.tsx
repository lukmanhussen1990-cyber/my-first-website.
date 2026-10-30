// On-screen text in the storybook style. All HTML (never baked into images or WebGL).
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { CREAM, GOLD, SANS, SERIF, textWidth } from './fonts';
import { clamp01, easeOut } from '../core/time';

const SHADOW = '0 0 26px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.55)';

export type Seg = { t: string; gold?: boolean };

const appear = (frame: number, at: number, len = 10) => easeOut(clamp01((frame - at) / len));

// a line made of segments, ONE of which is usually gold
const SegLine: React.FC<{ segs: Seg[]; size: number; weight?: number; italic?: boolean; letterSpacing?: string }> = ({ segs, size, weight = 500, italic, letterSpacing }) => (
  <div style={{ fontFamily: SERIF, fontSize: size, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', color: CREAM, lineHeight: 1.22, letterSpacing, textShadow: SHADOW }}>
    {segs.map((s, i) => (
      <span key={i} style={s.gold ? { color: GOLD, textShadow: `0 0 18px rgba(226,178,90,0.55), ${SHADOW}` } : undefined}>
        {s.t}
      </span>
    ))}
  </div>
);

// top hook / top quote: 1-2 centred serif lines, each fades up in turn
export const TopText: React.FC<{ lines: Seg[][]; from: number; to: number; y?: number; size?: number; sub?: string; stagger?: number }> = ({ lines, from, to, y = 290, size = 62, sub, stagger = 6 }) => {
  const frame = useCurrentFrame();
  const out = 1 - clamp01((frame - (to - 8)) / 8);
  if (frame < from || frame > to) return null;
  return (
    <AbsoluteFill style={{ alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: y, width: 860, left: 110, textAlign: 'center', opacity: out }}>
        {lines.map((l, i) => {
          const a = appear(frame, from + i * stagger, 10);
          return (
            <div key={i} style={{ opacity: a, transform: `translateY(${(1 - a) * 14}px)`, filter: a < 1 ? `blur(${(1 - a) * 6}px)` : undefined }}>
              <SegLine segs={l} size={size} />
            </div>
          );
        })}
        {sub && (
          <div style={{ marginTop: 18, fontFamily: SERIF, fontSize: 30, fontWeight: 600, letterSpacing: '0.2em', color: 'rgba(243,236,223,0.78)', opacity: appear(frame, from + lines.length * stagger + 4, 12), textShadow: SHADOW }}>
            ✦&nbsp;&nbsp;{sub}&nbsp;&nbsp;✦
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export type Phrase = { id: number; text: string; start: number; end: number; hold: number };

// lower captions: one short phrase at a time, fades in over 4 frames
export const Captions: React.FC<{ phrases: Phrase[]; hidden?: [number, number][]; y?: number; size?: number; offset?: number }> = ({ phrases, hidden = [], y = 1380, size = 48, offset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + offset;
  const p = phrases.find((ph) => t >= ph.start - 0.03 && t < ph.hold);
  if (!p || hidden.some(([a, b]) => frame >= a && frame < b)) return null;
  const inA = clamp01((frame - (p.start - 0.03) * fps) / 4);
  const outA = clamp01((p.hold * fps - frame) / 3);
  const font = `500 ${size}px Montserrat`;
  const w = textWidth(p.text, font);
  const fs = w > 840 ? (size * 840) / w : size;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: y - fs * 0.62, left: 60, width: 960, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: fs, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 0 3px rgba(0,0,0,0.35)', opacity: Math.min(inA, outA), whiteSpace: 'nowrap' }}>
        {p.text}
      </div>
    </AbsoluteFill>
  );
};

// "The Bible says," + a big serif quote that builds word by word in time with the voice
export type QuoteWord = { t: string; at: number; gold?: boolean; br?: boolean };
export const QuoteCard: React.FC<{ words: QuoteWord[]; from: number; to: number; reference: string; y?: number; size?: number; intro?: string }> = ({ words, from, to, reference, y = 360, size = 64, intro = 'The Bible says,' }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const out = 1 - clamp01((frame - (to - 10)) / 10);
  const lastAt = Math.max(...words.map((w) => w.at));
  const lines: QuoteWord[][] = [[]];
  words.forEach((w) => {
    lines[lines.length - 1].push(w);
    if (w.br) lines.push([]);
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: y, left: 100, width: 880, textAlign: 'center', opacity: out }}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 40, color: 'rgba(243,236,223,0.88)', marginBottom: 14, opacity: appear(frame, from, 12), textShadow: SHADOW }}>{intro}</div>
        {lines.map((ln, i) => (
          <div key={i} style={{ fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1.24, color: CREAM, textShadow: SHADOW }}>
            {ln.map((w, j) => {
              const a = appear(frame, w.at, 8);
              return (
                <span key={j} style={{ opacity: a, filter: a < 1 ? `blur(${(1 - a) * 4}px)` : undefined, color: w.gold ? GOLD : undefined, textShadow: w.gold ? `0 0 ${18 + 10 * a}px rgba(226,178,90,0.6), ${SHADOW}` : SHADOW }}>
                  {w.t}{j < ln.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        ))}
        <div style={{ marginTop: 26, fontFamily: SERIF, fontWeight: 600, fontSize: 30, letterSpacing: '0.22em', color: 'rgba(243,236,223,0.72)', opacity: appear(frame, lastAt + 4, 12), textShadow: SHADOW }}>
          ✦&nbsp;&nbsp;{reference}&nbsp;&nbsp;✦
        </div>
      </div>
    </AbsoluteFill>
  );
};

// place / name tag: letter-spaced serif caps, a small rule, an italic subtitle
export const PlaceTag: React.FC<{ title: string; sub?: string; from: number; to: number; y?: number; size?: number }> = ({ title, sub, from, to, y = 300, size = 48 }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const a = appear(frame, from, 14) * (1 - clamp01((frame - (to - 10)) / 10));
  const line = easeOut(clamp01((frame - from - 6) / 16));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: y, left: 90, width: 900, textAlign: 'center', opacity: a }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: size, letterSpacing: '0.16em', color: 'rgba(243,236,223,0.92)', textShadow: SHADOW, transform: `translateY(${(1 - a) * 10}px)` }}>{title}</div>
        <div style={{ margin: '14px auto 12px', width: 170 * line, height: 1.5, background: 'linear-gradient(90deg, rgba(226,178,90,0), rgba(226,178,90,0.9), rgba(226,178,90,0))' }} />
        {sub && <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 32, color: 'rgba(243,236,223,0.8)', textShadow: SHADOW }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

export const Brand: React.FC<{ handle?: string; opacity?: number }> = ({ handle = '@GraceINMotion616', opacity = 0.4 }) => (
  <div style={{ position: 'absolute', left: 52, top: 138, fontFamily: SANS, fontWeight: 500, fontSize: 20, color: '#fff', opacity, letterSpacing: '0.02em', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{handle}</div>
);

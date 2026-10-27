// S15 call to action: a dark glass comment box with a gold border types "Thank You for taking my place 🙏" (two lines,
// typeStart -> typeEnd, one letter per key-tick sound), POSTED, then gold hearts float up (ev.hearts). The glowing
// SON OF THE FATHER name card sits above it (namecard.jsx).
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, SERIF, SANS, EMOJI, SAFE, ease, pop, clamp, lerp, hash01, measure } from './theme.js';

const E = plan.ev;
const S15 = plan.shots.find((s) => s.id === 'S15');
const BOX = { x: 96, w: 840, y: 1210, h: 196 };

export const Cta = ({ t, frame }) => {
  const a = S15.t0 - 0.1, z = E.endCard + 0.2;
  if (t < a || t > z) return null;
  const out = 1 - clamp((t - (E.endCard - 0.3)) / 0.35);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <CommentBox t={t} />
      {E.hearts.map((h, i) => <Heart key={i} t={t - h} i={i} />)}
    </div>
  );
};

// one character per key tick: the audio places tick k at typeStart + k * (typeEnd - typeStart) / (n - 1)
const LINE1 = 'Thank You for taking'.split(''), LINE2 = ['m', 'y', ' ', 'p', 'l', 'a', 'c', 'e', ' ', '\u{1F64F}'];
const TYPED = [...LINE1, ...LINE2];
const typedAt = (i) => E.typeStart + (i / (TYPED.length - 1)) * (E.typeEnd - E.typeStart);
function CommentBox({ t }) {
  const a = S15.t0 + 0.35;
  const k = ease.back((t - a) / 0.5, 1.4);
  if (k <= 0) return null;
  const n = t < E.typeStart ? 0 : Math.min(TYPED.length, 1 + Math.floor(((t - E.typeStart) / (E.typeEnd - E.typeStart)) * (TYPED.length - 1)));
  const posted = t >= E.typeEnd + 0.05;
  const pk = posted ? Math.exp(-3 * (t - E.typeEnd - 0.05)) : 0;
  const caret = Math.floor(t * 2.6) % 2 === 0;
  const heartK = clamp((t - E.hearts[0] + 0.1) / 0.2);
  const { x: bx, w: bw, y: by, h: bh } = BOX;
  return (
    <div style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh, opacity: clamp(k), transform: `translateY(${(1 - k) * 40}px)` }}>
      {/* dark glass with a gold border (our own design, not a cream pill) */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 26, background: 'linear-gradient(180deg, rgba(34,25,17,0.86), rgba(14,10,7,0.88))', border: `1.5px solid rgba(244,199,102,${0.8 + 0.2 * pk})`,
        boxShadow: `0 22px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,232,180,0.2), 0 0 ${8 + 40 * pk}px rgba(255,190,80,${0.25 + 0.6 * pk})` }} />
      <div style={{ position: 'absolute', left: 26, right: 26, top: 0, height: 1.5, background: 'linear-gradient(90deg, rgba(255,226,160,0), rgba(255,226,160,0.5), rgba(255,226,160,0))' }} />
      {/* avatar */}
      <div style={{ position: 'absolute', left: 22, top: 22, width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ffe2a0, #d39a3a 60%, #9c6416)', boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(255,230,170,0.6)' }}>
        <svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="28" r="11" fill="#2a1a10" opacity="0.85" /><path d="M 16 60 Q 18 42 36 42 Q 54 42 56 60 Z" fill="#2a1a10" opacity="0.85" /></svg>
      </div>
      <div style={{ position: 'absolute', left: 118, top: 26, right: 104, whiteSpace: 'nowrap' }}>
        {n === 0 ? <span style={{ font: `italic 600 44px ${SERIF}`, color: 'rgba(251,241,220,0.5)', lineHeight: '64px' }}>Add a comment{'…'}</span> : null}
        {[LINE1, LINE2].map((L, li) => {
          const off = li ? LINE1.length : 0;
          const shown = Math.max(0, Math.min(L.length, n - off));
          if (shown <= 0 && !(li === 1 && n >= LINE1.length)) return null;
          return (
            <div key={li} style={{ height: 66, display: 'flex', alignItems: 'center' }}>
              {L.slice(0, shown).map((ch, i) => {
                const p = ease.back((t - typedAt(off + i)) / 0.16, 2.4);
                const emoji = ch.length > 1;
                return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', font: emoji ? `42px ${EMOJI}` : `700 44px ${SANS}`, letterSpacing: '0.01em', color: '#fbf1dc', marginLeft: emoji ? 6 : 0,
                  transform: `scale(${p})`, transformOrigin: '50% 80%' }}>{ch}</span>;
              })}
              {!posted && ((li === 0 && n < LINE1.length) || (li === 1 && n >= LINE1.length)) ? <span style={{ display: 'inline-block', width: 3, height: 48, marginLeft: 4, background: C.gold, opacity: caret ? 1 : 0 }} /> : null}
            </div>
          );
        })}
      </div>
      {/* heart button */}
      <svg viewBox="0 0 48 48" width="50" height="50" style={{ position: 'absolute', right: 34, top: 73, transform: `scale(${1 + pop(t, E.hearts[0], 0.3, 14, 6)})` }}>
        <path d="M24 41 C 10 31 4 24 4 16 C 4 10 9 6 14 6 C 18 6 22 8 24 12 C 26 8 30 6 34 6 C 39 6 44 10 44 16 C 44 24 38 31 24 41 Z"
          fill={heartK > 0 ? `rgba(244,199,102,${heartK})` : 'none'} stroke={heartK > 0.5 ? C.gold : 'rgba(251,241,220,0.55)'} strokeWidth="3.2" strokeLinejoin="round" />
      </svg>
      {posted && t < E.typeEnd + 1.2 ? (
        <div style={{ position: 'absolute', left: 118, top: -42, font: `700 21px ${SANS}`, letterSpacing: '0.22em', color: C.gold, textShadow: '0 1px 8px rgba(0,0,0,0.6)', opacity: clamp((t - E.typeEnd - 0.05) / 0.2) * clamp((E.typeEnd + 1.2 - t) / 0.3) }}>POSTED</div>
      ) : null}
    </div>
  );
}

// a gold heart floating up from the heart button, with sway; it stays left of the IG buttons
function Heart({ t, i }) {
  if (t < 0 || t > 1.5) return null;
  const u = t / 1.5;
  const sx = BOX.x + BOX.w - 34 - 25, sy = BOX.y + 73;
  const x = sx - 22 + 30 * hash01(i, 3) * u + 14 * Math.sin(u * 7 + i * 1.3), y = sy - 235 * ease.out(u);
  const s = (0.7 + 0.5 * hash01(i, 4)) * ease.back(u * 5, 2.2);
  const hue = i % 2 === 0 ? ['#ffe6a6', '#d9962a'] : ['#ffd88a', '#c98b26'];
  return (
    <svg viewBox="0 0 48 48" width="56" height="56" style={{ position: 'absolute', left: x - 28, top: y - 28, opacity: (1 - u * u), transform: `scale(${s}) rotate(${(hash01(i, 5) - 0.5) * 34}deg)`,
      filter: 'drop-shadow(0 0 8px rgba(255,190,80,0.6))' }}>
      <defs><linearGradient id={`hg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hue[0]} /><stop offset="1" stopColor={hue[1]} /></linearGradient></defs>
      <path d="M24 41 C 10 31 4 24 4 16 C 4 10 9 6 14 6 C 18 6 22 8 24 12 C 26 8 30 6 34 6 C 39 6 44 10 44 16 C 44 24 38 31 24 41 Z" fill={`url(#hg${i})`} />
      <ellipse cx="15" cy="14" rx="5" ry="3.2" fill="rgba(255,255,255,0.55)" transform="rotate(-30 15 14)" />
    </svg>
  );
}

// S14 call to action: world-anchored icon labels COINCIDENCE (under the dice) and TIMING (under the
// hourglass, glowing from ev.hourglass), a comment box that types "TIMING 🙏" (typeStart -> typeEnd)
// and hearts floating up (ev.hearts).
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { anchorAt } from '../lib/director.js';
import { shotAt } from '../plan.js';
import { C, SERIF, SANS, EMOJI, ease, pop, clamp, lerp, hash01, project } from './theme.js';

const E = plan.ev;
const S14 = plan.shots.find((s) => s.id === 'S14');
const LABEL_DY = 150;                    // label sits this far below the projected icon anchor (anchor = icon centre)

function iconLabel(t, cur, name, fallbackX) {
  const A = project(cur, t, anchorAt(plan, 'cta', name, t));
  const x = A && A.on ? A.x : fallbackX, y = A && A.on ? A.y + LABEL_DY : 1010;
  return { x: clamp(x, 250, 830), y: clamp(y, 820, 1120) };
}

export const Cta = ({ t, frame }) => {
  const a = S14.t0 - 0.1, z = E.endCard + 0.2;
  if (t < a || t > z) return null;
  const cur = shotAt(plan, t).shot.id === 'S14' ? shotAt(plan, t).shot : S14;
  const out = 1 - clamp((t - (E.endCard - 0.3)) / 0.35);
  const P1 = iconLabel(t, cur, 'dice', 330), P2 = iconLabel(t, cur, 'hourglass', 750);
  const dK = ease.out((t - E.dice) / 0.45), hK = ease.out((t - E.hourglass) / 0.45);
  const glow = clamp((t - E.hourglass) / 0.4) * (0.8 + 0.2 * Math.sin((t - E.hourglass) * 4));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      {dK > 0 ? <IconLabel x={P1.x} y={P1.y} k={dK} text="COINCIDENCE" color={`rgba(236,228,214,${lerp(0.92, 0.55, hK)})`} glow={0} p={pop(t, E.dice, 0.12, 13, 7)} /> : null}
      {hK > 0 ? <IconLabel x={P2.x} y={P2.y} k={hK} text="TIMING" color={C.gold} glow={glow} p={pop(t, E.hourglass, 0.22, 13, 6)} /> : null}
      <CommentBox t={t} />
      {E.hearts.map((h, i) => <Heart key={i} t={t - h} i={i} />)}
    </div>
  );
};

const IconLabel = ({ x, y, k, text, color, glow, p }) => (
  <div style={{ position: 'absolute', left: x - 260, width: 520, top: y - 30, textAlign: 'center', opacity: k, transform: `translateY(${(1 - k) * 16}px) scale(${1 + p})` }}>
    {glow > 0 ? <div style={{ position: 'absolute', left: 120, right: 120, top: -26, bottom: -26, borderRadius: '50%', background: `radial-gradient(ellipse, rgba(255,190,80,${0.38 * glow}) 0%, rgba(255,190,80,0) 70%)` }} /> : null}
    <div style={{ position: 'relative', font: `700 52px/60px ${SERIF}`, letterSpacing: '0.14em', color, whiteSpace: 'nowrap',
      textShadow: glow > 0 ? `0 0 ${24 * glow}px rgba(255,190,80,${0.9 * glow}), 0 2px 10px rgba(0,0,0,0.6)` : '0 2px 10px rgba(0,0,0,0.6)' }}>{text}</div>
    <div style={{ position: 'relative', margin: '6px auto 0', width: 120 * k, height: 1.5, background: `linear-gradient(90deg, rgba(244,199,102,0), ${glow > 0 ? C.gold : 'rgba(236,228,214,0.6)'}, rgba(244,199,102,0))` }} />
  </div>
);

const TYPED = ['T', 'I', 'M', 'I', 'N', 'G', ' ', '\u{1F64F}'];
function CommentBox({ t }) {
  const a = S14.t0 + 0.35;
  const k = ease.back((t - a) / 0.5, 1.4);
  if (k <= 0) return null;
  const n = t < E.typeStart ? 0 : Math.min(TYPED.length, 1 + Math.floor(((t - E.typeStart) / (E.typeEnd - E.typeStart)) * TYPED.length));
  const posted = t >= E.typeEnd + 0.05;
  const pk = posted ? Math.exp(-3 * (t - E.typeEnd - 0.05)) : 0;
  const caret = Math.floor(t * 2.6) % 2 === 0;
  const heartK = clamp((t - E.hearts[0] + 0.1) / 0.2);
  const bx = 96, bw = 840, by = 1300, bh = 116;
  return (
    <div style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh, opacity: clamp(k), transform: `translateY(${(1 - k) * 40}px)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 58, background: 'linear-gradient(180deg, rgba(252,246,234,0.97), rgba(240,228,206,0.97))',
        boxShadow: `0 22px 50px rgba(0,0,0,0.5), 0 0 0 ${2 + 2 * pk}px rgba(244,199,102,${0.55 + 0.45 * pk}), 0 0 ${40 * pk}px rgba(255,190,80,${0.7 * pk})` }} />
      {/* avatar */}
      <div style={{ position: 'absolute', left: 22, top: 22, width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ffe2a0, #d39a3a 60%, #9c6416)', boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.25)' }}>
        <svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="28" r="11" fill="#fff6e0" opacity="0.92" /><path d="M 16 60 Q 18 42 36 42 Q 54 42 56 60 Z" fill="#fff6e0" opacity="0.92" /></svg>
      </div>
      <div style={{ position: 'absolute', left: 118, top: 0, height: bh, right: 110, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
        {n === 0 ? <span style={{ font: `italic 600 44px ${SERIF}`, color: 'rgba(60,40,24,0.45)' }}>Add a comment{'…'}</span> : null}
        {TYPED.slice(0, n).map((ch, i) => {
          const ti = E.typeStart + (i / TYPED.length) * (E.typeEnd - E.typeStart);
          const p = ease.back((t - ti) / 0.16, 2.4);
          const emoji = ch.length > 1;
          return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', font: emoji ? `44px ${EMOJI}` : `800 46px ${SANS}`, letterSpacing: '0.06em', color: '#2a1a10', marginLeft: emoji ? 6 : 0,
            transform: `scale(${p})`, transformOrigin: '50% 80%' }}>{ch}</span>;
        })}
        {!posted ? <span style={{ display: 'inline-block', width: 3, height: 50, marginLeft: 4, background: C.goldDeep, opacity: caret ? 1 : 0 }} /> : null}
      </div>
      {/* heart button */}
      <svg viewBox="0 0 48 48" width="50" height="50" style={{ position: 'absolute', right: 34, top: 33, transform: `scale(${1 + pop(t, E.hearts[0], 0.3, 14, 6)})` }}>
        <path d="M24 41 C 10 31 4 24 4 16 C 4 10 9 6 14 6 C 18 6 22 8 24 12 C 26 8 30 6 34 6 C 39 6 44 10 44 16 C 44 24 38 31 24 41 Z"
          fill={heartK > 0 ? `rgba(226,58,74,${heartK})` : 'none'} stroke={heartK > 0.5 ? '#c42a3c' : 'rgba(60,40,24,0.55)'} strokeWidth="3.2" strokeLinejoin="round" />
      </svg>
      {posted && t < E.typeEnd + 1.2 ? (
        <div style={{ position: 'absolute', left: 118, top: -40, font: `700 17px ${SANS}`, letterSpacing: '0.22em', color: C.gold, opacity: clamp((t - E.typeEnd - 0.05) / 0.2) * clamp((E.typeEnd + 1.2 - t) / 0.3) }}>POSTED</div>
      ) : null}
    </div>
  );
}

// a heart floating up from the heart button, with sway
function Heart({ t, i }) {
  if (t < 0 || t > 1.7) return null;
  const u = t / 1.7;
  const sx = 96 + 840 - 34 - 25, sy = 1300 + 33;
  const x = sx - 70 * hash01(i, 3) * u + 26 * Math.sin(u * 7 + i * 1.3), y = sy - 470 * ease.out(u);
  const s = (0.7 + 0.5 * hash01(i, 4)) * ease.back(u * 5, 2.2);
  const hue = i % 3 === 0 ? ['#ffd27a', '#e09a2e'] : ['#ff6b7f', '#d42a46'];
  return (
    <svg viewBox="0 0 48 48" width="56" height="56" style={{ position: 'absolute', left: x - 28, top: y - 28, opacity: (1 - u * u), transform: `scale(${s}) rotate(${(hash01(i, 5) - 0.5) * 34}deg)` }}>
      <defs><linearGradient id={`hg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hue[0]} /><stop offset="1" stopColor={hue[1]} /></linearGradient></defs>
      <path d="M24 41 C 10 31 4 24 4 16 C 4 10 9 6 14 6 C 18 6 22 8 24 12 C 26 8 30 6 34 6 C 39 6 44 10 44 16 C 44 24 38 31 24 41 Z" fill={`url(#hg${i})`} />
      <ellipse cx="15" cy="14" rx="5" ry="3.2" fill="rgba(255,255,255,0.55)" transform="rotate(-30 15 14)" />
    </svg>
  );
}

// Header, hook title and the word-timed captions (upcoming words ghosted, keywords pop in gold,
// Scripture quotes set in serif italic). Light/dark caption theme per scene.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, L, SERIF, SANS, ease, win, pop, shake } from './theme.js';
import { clamp, lerp } from '../lib/util.js';

const E = plan.ev;

// caption blocks with display windows
const HIDE = new Set(['B03#0', 'B16#1']);           // shown on the scroll / the Romans card instead
export const BLOCKS = (() => {
  const out = [];
  for (const b of Object.values(plan.beats)) b.blocks.forEach((text, k) => {
    const id = `${b.id}#${k}`; const words = plan.words.filter((w) => w.block === id);
    if (words.length) out.push({ id, beat: b.id, scene: b.scene, text, words });
  });
  out.forEach((bl, i) => {
    bl.t0 = bl.words[0].start - 0.14; const end = bl.words[bl.words.length - 1].end; const nx = out[i + 1];
    bl.t1 = nx && nx.words[0].start - 0.14 - end < 1.3 ? nx.words[0].start - 0.14 : end + 0.75;
  });
  return out.filter((bl) => !HIDE.has(bl.id));
})();

export const Header = ({ t }) => {
  const o = clamp(t / 0.25) * (1 - clamp((t - E.endCard + 0.1) / 0.3)) + clamp((t - E.loopBack - 0.3) / 0.3);
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: L.headerY - 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: o }}>
      <div style={{ width: 64, height: 2, background: `linear-gradient(90deg, rgba(240,191,90,0), ${C.gold})` }} />
      <div style={{ font: `700 30px ${SANS}`, letterSpacing: '0.3em', color: C.warm, textShadow: '0 2px 10px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
        <span style={{ color: C.gold }}>Q.01</span>&nbsp;·&nbsp;SEVEN THINGS
      </div>
      <div style={{ width: 64, height: 2, background: `linear-gradient(90deg, ${C.gold}, rgba(240,191,90,0))` }} />
    </div>
  );
};

// "GOD HATES 7 THINGS" — huge for the first 1.8 s, punched by the impact, then flies into the caption spot
export const HookTitle = ({ t, frame }) => {
  const out = ease.inOut((t - E.hookOut) / 0.35);
  if (t > E.hookOut + 0.45) return null;
  const s = t - E.impact; const [sx, sy] = s > 0 && s < 0.3 ? shake(frame, 3, 14 * (1 - s / 0.3) ** 2) : [0, 0];
  const punch = 1 + pop(t, E.impact, 0.07, 22, 9);
  const y = lerp(1180, 420, out), sc = lerp(1, 0.42, out) * punch, o = 1 - clamp((t - E.hookOut - 0.25) / 0.2);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, transform: `translate(${sx}px, ${sy - 50}%) scale(${sc})`, transformOrigin: '50% 50%', opacity: o, textAlign: 'center' }}>
      <div style={{ font: `800 142px/0.98 ${SANS}`, letterSpacing: '0.01em', color: '#fff8ee', textShadow: '0 10px 40px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.6)' }}>GOD HATES</div>
      <div style={{ font: `800 142px/1.02 ${SANS}`, letterSpacing: '0.01em', color: '#fff8ee', textShadow: '0 10px 40px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.6)' }}>
        <span style={{ color: C.gold, fontSize: 176, textShadow: '0 0 34px rgba(240,170,60,0.75), 0 10px 40px rgba(0,0,0,0.55)' }}>7</span> THINGS
      </div>
    </div>
  );
};

export const Captions = ({ t }) => {
  const bl = BLOCKS.find((b) => t >= b.t0 && t < b.t1);
  if (!bl || t < E.hookOut + 0.2) return null;
  const theme = plan.theme[bl.scene] || 'dark';
  const light = theme === 'light';
  const fin = ease.out((t - bl.t0) / 0.2), fout = clamp((bl.t1 - t) / 0.14);
  const n = bl.text.length; const fs = n <= 28 ? 70 : n <= 52 ? 62 : n <= 80 ? 56 : 52;
  let inQ = false;
  return (
    <div style={{ position: 'absolute', left: (1080 - L.capW) / 2, width: L.capW, top: L.capTop, height: L.capBottom - L.capTop, display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: fin * fout, transform: `translateY(${(1 - fin) * 18 - (1 - fout) * 10}px)` }}>
      <div style={{ padding: '22px 34px 26px', borderRadius: 28, background: light ? C.scrimLight : C.scrimDark, boxShadow: light ? '0 10px 40px rgba(60,30,10,0.25)' : '0 10px 50px rgba(0,0,0,0.35)', textAlign: 'center', maxWidth: L.capW }}>
        {bl.words.map((w, i) => {
          const disp = w.w;
          const opens = disp.startsWith('"') || disp.startsWith('“'); if (opens) inQ = true;
          const q = inQ; const closes = /["”]/.test(disp.slice(1));
          const spoken = t >= w.start - 0.02, cur = t >= w.start - 0.02 && t < w.end + 0.08;
          const kpop = w.kw ? pop(t, w.start, 0.22, 14, 7) : 0;
          const col = w.kw && spoken ? (light ? C.goldDeep : C.gold) : light ? C.ink : C.warm;
          const el = (
            <span key={i} style={{ display: 'inline-block', margin: `0 ${fs * 0.13}px`, opacity: spoken ? 1 : 0.36, color: col,
              font: q ? `italic 600 ${fs * 1.12}px/1.16 ${SERIF}` : `700 ${fs}px/1.2 ${SANS}`,
              transform: `scale(${1 + kpop})`, textShadow: light ? 'none' : `0 2px 10px rgba(0,0,0,0.5)${w.kw && spoken ? ', 0 0 18px rgba(240,170,60,0.55)' : ''}`,
              filter: cur && !w.kw ? 'brightness(1.12)' : 'none' }}>{disp}</span>
          );
          if (closes) inQ = false;
          return el;
        })}
      </div>
    </div>
  );
};

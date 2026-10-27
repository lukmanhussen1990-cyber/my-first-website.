// Header (top right), the hook title and the word-timed captions.
// Captions: Cormorant Garamond Italic, laid out by us word by word (so words can pop without reflow);
// the next word is pre-shown ghosted, keywords land as gold serif caps with a pop + sheen.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { C, L, SAFE, SERIF, SANS, ease, pop, shake, clamp, lerp, layoutWords, popFit, measure, pretty, mixHex } from './theme.js';
import { fullCardCover } from './fullcard.jsx';

const E = plan.ev;
const DUR = plan.dur;

// ------------------------------------------------------------------ caption blocks + display windows
// these blocks are shown by a card instead (the Matthew 27:21 quote, the shouted "Barabbas" slam, the full-screen
// Matthew 27:26 card, the 1 Peter 3:18 card)
const HIDDEN_AT = { 'B07#1': E.card2721, 'B08#1': E.shout, 'B13#0': E.card2726, 'B16#0': E.card318, 'B16#1': E.card318 };
export const BLOCKS = (() => {
  const out = [];
  for (const b of Object.values(plan.beats)) b.blocks.forEach((text, k) => {
    const id = `${b.id}#${k}`;
    const words = plan.words.filter((w) => w.block === id);
    if (words.length) out.push({ id, beat: b.id, scene: b.scene, words, hidden: id in HIDDEN_AT });
  });
  out.forEach((bl, i) => {
    bl.t0 = bl.words[0].start - 0.12;
    const end = bl.words[bl.words.length - 1].end; const nx = out[i + 1];
    bl.t1 = nx && nx.words[0].start - 0.12 - end < 1.3 ? nx.words[0].start - 0.12 : end + 0.7;
    // a caption never crossfades over the card that follows it: it is gone as that arrives
    if (nx && nx.hidden) bl.t1 = Math.min(bl.t1, HIDDEN_AT[nx.id] + 0.04);
    bl.t1 = Math.min(bl.t1, E.endCard - 0.2);
  });
  return out.filter((bl) => !bl.hidden);
})();
export const captionAt = (t) => BLOCKS.find((b) => t >= b.t0 && t < b.t1) || null;

const BASE = 66, LINE = 1.2;
const isNum = (w) => /\d/.test(w.w);
const kwScale = (w) => (isNum(w) ? 1.04 : 0.84);       // keyword words become gold serif caps; numbers stay full size
const fontOf = (w, size) => (w.kw ? `700 ${Math.round(size * kwScale(w))}px ${SERIF}` : `italic 600 ${size}px ${SERIF}`);
const textOf = (w) => (w.kw ? pretty(w.w).toUpperCase() : pretty(w.w));
function layoutBlock(bl) {
  let size = BASE;
  for (let k = 0; k < 4; k++) {
    const lay = layoutWords(bl.words.map((w) => ({ text: textOf(w), font: fontOf(w, size), extra: w.kw ? textOf(w).length * size * 0.02 : 0 })),
      { maxW: L.capW, lineH: size * LINE, space: size * 0.24 });
    if (lay.lines <= 3 || size <= 56) return { ...lay, size };
    size -= 4;
  }
  return null;
}

// ------------------------------------------------------------------ channel watermark (top left): logo + GRACE IN MOTION
// on every frame except the end card (which shows the big logo); same timing as the header
export const Brand = ({ t, ink = 0 }) => {
  const o = 1 - clamp((t - (E.endCard - 0.25)) / 0.25) + clamp((t - (DUR - 0.5)) / 0.42);
  if (o <= 0.001) return null;
  const cream = mixHex('#fbf1dc', '#3a2616', ink), gold = mixHex(C.gold, C.goldInk, ink);
  return (
    <div style={{ position: 'absolute', left: 72, top: L.headerY - 21, height: 42, display: 'flex', alignItems: 'center', gap: 12, opacity: clamp(o) * 0.95 }}>
      <Img src={staticFile('logo.svg')} style={{ width: 42, height: 42, borderRadius: 21, boxShadow: `0 0 0 1.5px ${gold}, 0 2px 10px rgba(0,0,0,0.5)` }} />
      <div style={{ font: `700 21px ${SANS}`, letterSpacing: '0.22em', color: cream, whiteSpace: 'nowrap', textShadow: ink > 0.5 ? 'none' : '0 1px 8px rgba(0,0,0,0.6)' }}>
        GRACE <span style={{ color: gold }}>IN</span> MOTION
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ header (top right)
export const Header = ({ t, ink = 0 }) => {
  // hidden during the end card; visible on frame 0 and back for the last frames (seamless loop)
  const o = 1 - clamp((t - (E.endCard - 0.25)) / 0.25) + clamp((t - (DUR - 0.5)) / 0.42);
  if (o <= 0.001) return null;
  const cream = mixHex('#fbf1dc', '#3a2616', ink), gold = mixHex(C.gold, C.goldInk, ink);
  return (
    <div style={{ position: 'absolute', right: 80, top: L.headerY - 15, height: 30, display: 'flex', alignItems: 'center', gap: 16, opacity: clamp(o) }}>
      <div style={{ width: 46, height: 1.5, background: `linear-gradient(90deg, rgba(244,199,102,0), ${gold})` }} />
      <div style={{ font: `600 21px ${SANS}`, letterSpacing: '0.3em', color: cream, whiteSpace: 'nowrap', textShadow: ink > 0.5 ? 'none' : '0 1px 8px rgba(0,0,0,0.6)', opacity: 0.92 }}>
        <span style={{ color: gold, fontWeight: 700 }}>Q.03</span>
        <span style={{ margin: '0 0.35em', color: gold }}>·</span>SON OF THE FATHER
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ hook title: "ONLY ONE / WALKS FREE"
// Huge over the Jesus hero shot from frame 0 (below His face), punched at hookHit; at hookOut it flies up into the
// caption spot and dissolves there (the word-timed captions run from the first word above it). The last 0.5 s of the
// reel bring it back exactly as frame 0 (seamless loop).
const HOOK = { cy: 1250, a: 132, b: 168 };
export const HookTitle = ({ t, frame }) => {
  const back = ease.sine(clamp((t - (DUR - 0.5)) / 0.45));
  let tt = t, extraO = 1, extraS = 0;
  if (back > 0) { tt = 0; extraO = back; extraS = 0.06 * (1 - back); }
  const fly = ease.inOut((tt - E.hookOut) / 0.5);
  if (tt > E.hookOut + 0.52 && back <= 0) return null;
  const wa = measure(`700 ${HOOK.a}px ${SERIF}`, 'ONLY ONE') + 8 * HOOK.a * 0.12, wb = measure(`italic 700 ${HOOK.b}px ${SERIF}`, 'WALKS FREE') * 1.03;
  const fit = Math.min(1, 950 / Math.max(wa, wb, 1));
  const s0 = tt - E.hookHit;
  const [sx, sy] = s0 > 0 && s0 < 0.3 ? shake(frame, 3, 13 * (1 - s0 / 0.3) ** 2) : [0, 0];
  const punch = 1 + (s0 >= 0 ? pop(tt, E.hookHit, 0.075, 19, 8) : 0);
  const flash = s0 >= 0 ? Math.exp(-5 * s0) : 0;
  const drift = 1 + 0.014 * Math.min(tt, E.hookOut);
  const sc = (fit * punch * drift + extraS) * lerp(1, 0.42, fly);
  const cy = lerp(HOOK.cy, L.capTop + 120, fly);
  const dis = clamp((fly - 0.25) / 0.75);
  const o = extraO * (1 - ease.sine(dis));
  const shadow = '0 10px 40px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.6)';
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: cy, transform: `translate(${sx}px, ${sy}px) translateY(-50%) scale(${sc})`, transformOrigin: '540px 50%', opacity: o, textAlign: 'center', filter: dis > 0.01 ? `blur(${(8 * dis).toFixed(1)}px)` : 'none' }}>
      <div style={{ position: 'absolute', left: -80, right: -80, top: -140, bottom: -140, background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(8,5,3,0.62) 0%, rgba(8,5,3,0.32) 50%, rgba(8,5,3,0) 100%)' }} />
      <div style={{ position: 'relative', font: `700 ${HOOK.a}px/1 ${SERIF}`, color: '#fbf1dc', letterSpacing: '0.12em', marginRight: '-0.12em', whiteSpace: 'nowrap', textShadow: shadow }}>ONLY ONE</div>
      <div style={{ position: 'relative', height: 2, width: 600, margin: '26px auto 20px', background: 'linear-gradient(90deg, rgba(244,199,102,0), rgba(244,199,102,0.95), rgba(244,199,102,0))' }}>
        <div style={{ position: 'absolute', left: '50%', top: -7, width: 14, height: 14, transform: 'translateX(-50%) rotate(45deg)', background: C.gold, boxShadow: '0 0 14px rgba(255,190,80,0.9)' }} />
      </div>
      <div style={{ position: 'relative', font: `italic 700 ${HOOK.b}px/0.95 ${SERIF}`, color: mixHex(C.gold, '#fff4d4', flash * 0.7), letterSpacing: '0.02em', whiteSpace: 'nowrap',
        textShadow: `0 0 ${36 + 60 * flash}px rgba(255,180,70,${0.5 + 0.45 * flash}), ${shadow}` }}>WALKS FREE</div>
    </div>
  );
};

// ------------------------------------------------------------------ captions
export const Captions = ({ t }) => {
  const bl = captionAt(t);
  if (!bl) return null;
  const lay = layoutBlock(bl); if (!lay) return null;
  const light = (plan.theme[bl.scene] || 'dark') === 'light';
  const t0 = bl.t0;
  const fin = ease.out((t - t0) / 0.24), fout = clamp((bl.t1 - t) / 0.22);
  const o = fin * fout;
  const size = lay.size, lineH = size * LINE;
  const top = L.capTop, h = lay.height;
  const ink = light ? C.ink : '#f8f0e0', gold = light ? '#9c5f0c' : C.gold;
  // which word is next (ghosted)
  const nextI = bl.words.findIndex((w) => t < w.start - 0.03);
  // soft band (no plateau, so it never reads as a letterbox slab), strongest behind the left-aligned text,
  // fading out to the right just past the text
  const P = light ? 0.55 : 0.36, rgb = light ? '246,236,214' : '8,6,5';
  const band = `linear-gradient(180deg, rgba(${rgb},0) 0%, rgba(${rgb},${(0.55 * P).toFixed(3)}) 16%, rgba(${rgb},${P}) 34%, rgba(${rgb},${P}) 66%, rgba(${rgb},${(0.55 * P).toFixed(3)}) 84%, rgba(${rgb},0) 100%)`;
  const right = Math.min(1, (L.capX + lay.width + 60) / 1080) * 100;
  const hmask = `linear-gradient(90deg, #000 0%, #000 ${(right - 12).toFixed(0)}%, rgba(0,0,0,0) ${Math.min(100, right + 10).toFixed(0)}%)`;
  const isKw = (j) => !!bl.words[j].kw;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: top - 78, height: h + 150, background: band, opacity: o * (light ? 1 - 0.8 * fullCardCover(t) : 1),
        WebkitMaskImage: hmask, maskImage: hmask }} />
      <div style={{ position: 'absolute', left: L.capX, top, width: L.capW, height: h, opacity: o, transform: `translateY(${(1 - fin) * 14}px)`, fontVariantNumeric: 'lining-nums' }}>
        {lay.items.map((it, i) => {
          const w = bl.words[i];
          const k = clamp((t - (w.start - 0.03)) / 0.12);
          const spoken = k > 0;
          let wo;
          if (spoken) wo = lerp(0.4, 1, k);
          else if (i === nextI) wo = 0.4 * clamp((t - (i > 0 ? bl.words[i - 1].start : t0)) / 0.12 + (i === 0 ? 1 : 0));
          else wo = 0;
          if (wo <= 0) return null;
          const cur = spoken && t < w.end + 0.06;
          // the keyword pop grows only into the free room around the word (never into its neighbours)
          const pf = w.kw ? popFit(lay.items, i, { maxAmp: 0.26, edgeL: L.capX - SAFE.x0, edgeR: SAFE.x1 - L.capX, isPop: isKw }) : null;
          const kp = w.kw && spoken ? pop(t, w.start, pf.amp, 13, 6) : 0;
          const lift = w.kw && spoken ? -7 * Math.exp(-9 * (t - w.start)) * Math.max(0, Math.cos(10 * (t - w.start))) : 0;
          const dy = w.kw ? 0.3185 * (size - size * kwScale(w)) : 0;
          const glow = w.kw && spoken ? (light ? '0 0 14px rgba(240,170,60,0.35)' : `0 0 22px rgba(255,180,70,0.6), 0 2px 10px rgba(0,0,0,0.55)`) : light ? 'none' : '0 2px 12px rgba(0,0,0,0.6)';
          const col = w.kw && spoken ? gold : !spoken ? (light ? '#6b5440' : '#efe6d6') : cur && !light ? '#fffaf0' : ink;
          const sheen = w.kw && spoken ? (t - w.start) / 0.55 : -1;
          const style = { position: 'absolute', left: it.x, top: it.y + dy, height: lineH, font: it.font, lineHeight: `${lineH}px`, whiteSpace: 'nowrap', color: col, opacity: wo,
            letterSpacing: w.kw ? '0.02em' : 0, textShadow: glow, transform: `translateY(${(1 - k) * 6 + lift}px) scale(${1 + kp})`, transformOrigin: pf ? `${pf.ox.toFixed(1)}% 62%` : '50% 60%' };
          return (
            <span key={i} style={style}>
              {it.text}
              {sheen > 0 && sheen < 1 ? (
                <span style={{ position: 'absolute', left: 0, top: 0, color: light ? '#e9b04e' : '#fff6d8', textShadow: 'none', clipPath: `inset(0 ${clamp(100 - (sheen * 140 - 20) - 26, 0, 100)}% 0 ${clamp(sheen * 140 - 20, 0, 100)}%)` }}>{it.text}</span>
              ) : null}
            </span>
          );
        })}
      </div>
    </>
  );
};

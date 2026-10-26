// HTML scenes and cards: the Romans 5:8 card over the darkened 3D scene, the phone chat (S11), the
// cold self-check backdrop (S12), the comment row (S15), the end card (S16), their wipes, and grain.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { C, SANS, SERIF, ease, win, pop, grainURL } from './theme.js';
import { clamp, lerp, hash01 } from '../lib/util.js';

const E = plan.ev;
const shot = (id) => plan.shots.find((s) => s.id === id);
const S11 = shot('S11'), S12 = shot('S12'), S15 = shot('S15'), S16 = shot('S16'), LOOP = shot('LOOP');

// ---------- Romans 5:8, a floating cream card, words warm to ink then gold as they are spoken ----------
const ROM = plan.words.filter((w) => w.block === 'B16#1').map((w) => ({ ...w, text: w.w.replace(/["“”]/g, '').replace(/^love$/i, 'LOVE').replace(/^Christ$/i, 'CHRIST') }));
export const RomansCard = ({ t }) => {
  const o = win(t, E.card, E.cardOut, 0.45, 0.4);
  if (o <= 0) return null;
  const inK = ease.back((t - E.card) / 0.55, 1.2), outK = clamp((t - E.cardOut + 0.4) / 0.4);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, rgba(10,6,3,0.25), rgba(10,6,3,0.6))', opacity: o }} />
      <div style={{ position: 'absolute', left: 80, width: 920, top: 990, opacity: o, transform: `translateY(${(1 - inK) * 50 - outK * 30 + 7 * Math.sin(t * 1.3)}px) rotate(${0.5 * Math.sin(t * 0.7)}deg) scale(${0.94 + 0.06 * inK})` }}>
        <div style={{ padding: '46px 56px 52px', borderRadius: 20, background: 'linear-gradient(170deg, #fbf4e4 0%, #f3e6c8 60%, #ead8b2 100%)', boxShadow: '0 40px 90px rgba(0,0,0,0.5), 0 0 0 2px rgba(190,150,80,0.55), inset 0 0 60px rgba(180,130,60,0.18)', textAlign: 'center' }}>
          <div style={{ font: `700 25px ${SANS}`, letterSpacing: '0.34em', color: C.goldInk }}>ROMANS 5:8 · KJV</div>
          <div style={{ height: 2, width: 220, margin: '18px auto 26px', background: 'linear-gradient(90deg, rgba(184,128,31,0), #c9963e, rgba(184,128,31,0))' }} />
          <div style={{ font: `600 60px/1.24 ${SERIF}`, color: '#3a2414' }}>
            {ROM.map((w, i) => {
              const spoken = t >= w.start - 0.02, cur = spoken && t < w.end + 0.1, key = /LOVE|CHRIST/.test(w.text);
              return <span key={i} style={{ display: 'inline-block', margin: '0 9px', opacity: spoken ? 1 : 0.3, color: key && spoken ? '#b8801f' : '#3a2414', fontWeight: key ? 700 : 600,
                transform: `scale(${1 + (key ? pop(t, w.start, 0.2, 13, 6) : 0)})`, textShadow: cur || (key && spoken) ? '0 0 18px rgba(230,170,60,0.55)' : 'none' }}>{w.text}</span>;
            })}
          </div>
        </div>
      </div>
    </>
  );
};

// ---------- shared: grain + bokeh backgrounds for the HTML-only scenes ----------
export const Grain = ({ frame, opacity = 0.07 }) => (
  <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${grainURL()})`, backgroundPosition: `${Math.round(hash01(frame, 1) * 256)}px ${Math.round(hash01(frame, 2) * 256)}px`, opacity, mixBlendMode: 'overlay' }} />
);
const Bokeh = ({ t, n = 14, seed = 1, color = '255,170,80', y0 = 0, y1 = 1920 }) => (
  <>{Array.from({ length: n }, (_, i) => { const r = 40 + 90 * hash01(i, seed); const x = 1080 * hash01(i, seed + 1) + 30 * Math.sin(t * 0.3 + i); const y = lerp(y0, y1, hash01(i, seed + 2)) + 20 * Math.cos(t * 0.25 + i);
    return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: `radial-gradient(circle, rgba(${color},${0.18 + 0.2 * hash01(i, seed + 3)}) 0%, rgba(${color},0.06) 60%, rgba(${color},0) 72%)` }} />; })}</>
);

// ---------- S11: the whispers become a generic phone chat ----------
const Bubble = ({ t, t0, children, right = false, avatar = '#c9785a' }) => {
  const k = ease.back((t - t0) / 0.32, 2.0); if (k <= 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: right ? 'flex-end' : 'flex-start', margin: '16px 0', transform: `scale(${k})`, transformOrigin: right ? '100% 100%' : '0 100%', opacity: clamp((t - t0) / 0.12) }}>
      {!right && <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(150deg, ${avatar}, #3a2a24)`, flex: 'none' }} />}
      <div style={{ maxWidth: 470, padding: '18px 26px', borderRadius: 28, borderBottomLeftRadius: right ? 28 : 6, background: right ? '#3d6b8f' : '#2c2f36', color: '#eceef2', font: `500 38px/1.3 ${SANS}` }}>{children}</div>
    </div>
  );
};
export const PhoneScene = ({ t, frame }) => {
  const a = S11.t0, push = clamp((t - (S12.t0 - 0.15)) / 0.3);
  if (t < a || push >= 1) return null;
  const inK = ease.out((t - a) / 0.3);
  const dots = [0, 1, 2].map((i) => 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - i * 0.9)));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - push, transform: `scale(${1 + 0.6 * push * push})`, transformOrigin: '50% 60%' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, #2a1c14 0%, #120c09 70%, #080605 100%)' }} />
      <Bokeh t={t} seed={5} />
      <div style={{ position: 'absolute', left: 205, top: 770, width: 670, height: 1060, borderRadius: 76, background: '#0b0b0d', boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 3px #2a2a2e, 0 0 60px rgba(255,160,70,0.12)', transform: `translateY(${(1 - inK) * 120}px) scale(${0.82 + 0.18 * inK}) rotate(${-1.2 + 0.6 * Math.sin(t * 0.8)}deg)`, opacity: inK }}>
        <div style={{ position: 'absolute', inset: 16, borderRadius: 58, overflow: 'hidden', background: 'linear-gradient(180deg, #17191e, #101216)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px 0', font: `600 24px ${SANS}`, color: '#d8dade' }}><span>9:41</span><span style={{ letterSpacing: 4 }}>▮▮▮ ▭</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 30px', borderBottom: '1px solid #262a31' }}>
            <span style={{ font: `600 40px ${SANS}`, color: '#8fa8c8' }}>‹</span>
            <div style={{ position: 'relative', width: 74, height: 50 }}>{['#c9785a', '#7a9a6a', '#8a7ab8'].map((c, i) => <div key={i} style={{ position: 'absolute', left: i * 14, top: 0, width: 48, height: 48, borderRadius: '50%', background: c, border: '3px solid #15171b' }} />)}</div>
            <div><div style={{ font: `700 29px ${SANS}`, color: '#f0f1f3' }}>Friends</div><div style={{ font: `500 21px ${SANS}`, color: '#8b9099' }}>4 members</div></div>
          </div>
          <div style={{ padding: '26px 26px' }}>
            <Bubble t={t} t0={E.bubbles[0]} avatar="#c9785a">did you hear what she…</Bubble>
            <Bubble t={t} t0={E.bubbles[1]} avatar="#8a7ab8">don't tell anyone but…</Bubble>
            <Bubble t={t} t0={E.bubbles[2]} avatar="#7a9a6a"><span style={{ letterSpacing: 6 }}>{dots.map((d, i) => <span key={i} style={{ opacity: d }}>●</span>)}</span></Bubble>
          </div>
        </div>
      </div>
      <Grain frame={frame} />
    </div>
  );
};

// ---------- S12: cold grey backdrop for the self-check ----------
export const CheckBackdrop = ({ t, frame }) => {
  const a = S12.t0 - 0.15; const fade = 1 - clamp((t - (S12.t1 - 0.6)) / 1.2);
  if (t < a || fade <= 0) return null;
  const inK = clamp((t - a) / 0.3);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: inK * fade, transform: `scale(${0.9 + 0.1 * ease.out(inK)})` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 52%, #444a52 0%, #23272c 55%, #101215 100%)' }} />
      <Bokeh t={t} seed={9} color="190,205,225" n={10} />
      <Grain frame={frame} opacity={0.09} />
    </div>
  );
};

// ---------- S15: comment row: "7… 😔" types itself, hearts float up ----------
const TYPED = ['7', '…', ' ', '😔'];
export const CtaScene = ({ t, frame }) => {
  const a = S15.t0 - 0.25; if (t < a || t > S16.t0 + 0.4) return null;
  const p = clamp((t - a) / 0.5) * 130 - 15; // dust-wipe mask progress (%)
  const n = Math.floor(clamp((t - E.typeStart) / (E.typeEnd - E.typeStart)) * TYPED.length + (t >= E.typeEnd ? 1 : 0));
  const typed = TYPED.slice(0, Math.min(TYPED.length, n)).join('');
  const caret = Math.floor(t * 2.4) % 2 === 0;
  return (
    <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: `linear-gradient(35deg, black ${p}%, transparent ${p + 10}%)`, maskImage: `linear-gradient(35deg, black ${p}%, transparent ${p + 10}%)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, #3a2416 0%, #1c120b 60%, #0c0806 100%)' }} />
      <Bokeh t={t} seed={13} />
      <div style={{ position: 'absolute', left: 90, top: 1130, width: 900, height: 112, borderRadius: 56, background: 'rgba(255,248,236,0.08)', border: '2px solid rgba(255,236,200,0.22)', display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(150deg, #f6cf7a, #b8801f)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 30px ${SANS}`, color: '#2a1a10' }}>you</div>
        <div style={{ font: `600 46px ${SANS}`, color: typed ? '#fff6e8' : 'rgba(255,246,232,0.4)', fontFamily: `Inter, "Noto Color Emoji", sans-serif` }}>
          {typed || 'Add a comment…'}{typed && t < E.endCard ? <span style={{ opacity: caret ? 1 : 0, color: C.gold }}>|</span> : null}
        </div>
      </div>
      {E.hearts.map((h, i) => { const u = (t - h) / 1.5; if (u < 0 || u > 1) return null; const x = 860 - 60 * hash01(i, 3) + 40 * Math.sin(u * 6 + i), y = 1120 - 420 * ease.out(u);
        return <div key={i} style={{ position: 'absolute', left: x, top: y, font: `${46 + 16 * hash01(i, 4)}px "Noto Color Emoji"`, opacity: 1 - u * u, transform: `scale(${ease.back(u * 4, 2.2)}) rotate(${(hash01(i, 5) - 0.5) * 30}deg)` }}>❤️</div>; })}
      {p < 115 ? <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(35deg, rgba(0,0,0,0) ${p - 3}%, rgba(225,190,140,0.55) ${p + 2}%, rgba(0,0,0,0) ${p + 9}%)` }} /> : null}
      <Grain frame={frame} />
    </div>
  );
};

// ---------- S16: end card (placeholder logo mark until the real logo is supplied), dissolves into the loop ----------
export const EndCard = ({ t, frame }) => {
  const a = S16.t0 - 0.25; if (t < a) return null;
  const out = clamp((t - (LOOP.t0 - 0.3)) / 0.6);
  if (out >= 1) return null;
  const p = clamp((t - a) / 0.5) * 140 - 20; // flare wipe
  const k1 = ease.back((t - S16.t0 - 0.1) / 0.5, 1.4), k2 = ease.out((t - S16.t0 - 0.35) / 0.45), k3 = ease.out((t - S16.t0 - 0.55) / 0.45);
  const shimmer = ((t - S16.t0 - 0.5) * 75) % 220 - 20; // % across the title, repeats
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, WebkitMaskImage: `linear-gradient(90deg, black ${p}%, transparent ${p + 6}%)`, maskImage: `linear-gradient(90deg, black ${p}%, transparent ${p + 6}%)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 46%, #3a2414 0%, #1a100a 60%, #0a0605 100%)' }} />
      <Bokeh t={t} seed={17} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 500, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 380, height: 380, transform: `scale(${k1})`, filter: 'drop-shadow(0 0 50px rgba(255,190,90,0.5))' }}><Img src={staticFile('logo.svg')} style={{ width: 380, height: 380 }} /></div>
        <div style={{ position: 'relative', marginTop: 56, opacity: k2, transform: `translateY(${(1 - k2) * 24}px)` }}>
          <div style={{ font: `700 100px ${SERIF}`, letterSpacing: '0.1em', color: '#f4e2bf', textShadow: '0 0 30px rgba(240,190,90,0.35), 0 4px 14px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>GRACE IN MOTION</div>
          {/* gold shimmer: a brighter copy revealed through a moving clip band (no background-clip:text) */}
          <div style={{ position: 'absolute', inset: 0, font: `700 100px ${SERIF}`, letterSpacing: '0.1em', color: '#fffbea', textShadow: '0 0 20px rgba(255,226,160,0.95)', whiteSpace: 'nowrap', clipPath: `inset(0 ${clamp(100 - shimmer - 8, 0, 100)}% 0 ${clamp(shimmer, 0, 100)}%)` }}>GRACE IN MOTION</div>
        </div>
        <div style={{ marginTop: 18, height: 2, width: 360 * k3, background: 'linear-gradient(90deg, rgba(240,191,90,0), #f0bf5a, rgba(240,191,90,0))' }} />
        <div style={{ marginTop: 22, font: `600 48px ${SANS}`, letterSpacing: '0.05em', color: C.gold, opacity: k3 }}>@grace_in_motion616</div>
      </div>
      {p < 120 ? <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(255,220,160,0) ${p - 6}%, rgba(255,236,200,0.95) ${p + 2}%, rgba(255,220,160,0) ${p + 8}%)` }} /> : null}
      <Grain frame={frame} />
    </div>
  );
};

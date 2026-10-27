// S15 end card (HTML only): logo placeholder (public/logo.svg), GRACE IN MOTION with a gold shimmer
// (a brighter copy revealed through a moving clip-path band; no background-clip:text) and the handle.
// Flare wipe in from S14; at ev.loopBack it dissolves out to the 3D LOOP shot (the lit lamp of S1).
import React from 'react';
import { Img, staticFile } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { C, SERIF, SANS, ease, clamp, lerp, hash01, grainURL } from './theme.js';

const E = plan.ev;
const S15 = plan.shots.find((s) => s.id === 'S15'), LOOP = plan.shots.find((s) => s.id === 'LOOP');
// the lockup (logo, wordmark, rule, handle) is centred on the frame: logo centre y = CY
const CY = 800, DY = CY - 690;

export const endCover = (t) => clamp((t - (S15.t0 - 0.25)) / 0.5) * (1 - clamp((t - (LOOP.t0 - 0.3)) / 0.6));

export const EndCard = ({ t, frame }) => {
  const a = S15.t0 - 0.25;
  if (t < a) return null;
  const outK = ease.inOut(clamp((t - (LOOP.t0 - 0.3)) / 0.6));
  if (outK >= 1) return null;
  const p = ease.inOut(clamp((t - a) / 0.5));
  const wipe = p * 150 - 25;                                         // % across (tilted)
  const lt = t - S15.t0;
  const k1 = ease.back((lt + 0.05) / 0.55, 1.5), k2 = ease.out((lt - 0.2) / 0.5), k3 = ease.out((lt - 0.45) / 0.5);
  const sh = ((lt - 0.55) / 0.9);                                    // shimmer band 0..1 (repeats once)
  const shimmer = sh > 0 ? (sh % 1.4) : -1;
  const band = (u) => `inset(-20% ${clamp(100 - (u * 130 - 15) - 14, 0, 100)}% -20% ${clamp(u * 130 - 15, 0, 100)}%)`;
  const mask = p < 1 ? `linear-gradient(100deg, #000 ${wipe}%, rgba(0,0,0,0) ${wipe + 8}%)` : 'none';
  const rays = lt * 6;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - outK, transform: `scale(${1 + 0.04 * outK})` }}>
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 70% at 50% 48%, #3c2516 0%, #1c110a 58%, #0a0605 100%)' }} />
        <Bokeh t={t} />
        {/* light rays behind the logo */}
        <div style={{ position: 'absolute', left: 540 - 520, top: CY - 520, width: 1040, height: 1040, borderRadius: '50%', opacity: 0.5 * k2,
          background: `repeating-conic-gradient(from ${rays}deg at 50% 50%, rgba(255,200,110,0.10) 0deg 6deg, rgba(255,200,110,0) 6deg 18deg)`,
          WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 65%)', maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 65%)' }} />
        <div style={{ position: 'absolute', left: 540 - 300, top: CY - 300, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,196,100,0.32) 0%, rgba(255,196,100,0) 65%)', opacity: k2 }} />
        {/* logo */}
        <div style={{ position: 'absolute', left: 540 - 170, top: CY - 170, width: 340, height: 340, transform: `scale(${k1})`, filter: 'drop-shadow(0 0 40px rgba(255,190,90,0.45)) drop-shadow(0 18px 30px rgba(0,0,0,0.5))' }}>
          <Img src={staticFile('logo.svg')} style={{ width: 340, height: 340 }} />
        </div>
        {/* wordmark + shimmer copy */}
        {/* wordmark: 86 px with 0.08em tracking (inside x 60–1000); the negative right margin cancels the trailing tracking */}
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 935 + DY + 6, textAlign: 'center', opacity: k2, transform: `translateY(${(1 - k2) * 22}px)` }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ font: `700 86px/100px ${SERIF}`, letterSpacing: '0.08em', marginRight: '-0.08em', color: '#f3dfb8', whiteSpace: 'nowrap', textShadow: '0 0 30px rgba(240,190,90,0.3), 0 4px 14px rgba(0,0,0,0.55)' }}>GRACE IN MOTION</div>
            {shimmer >= 0 && shimmer <= 1 ? (
              <div style={{ position: 'absolute', inset: 0, font: `700 86px/100px ${SERIF}`, letterSpacing: '0.08em', marginRight: '-0.08em', color: '#fff8e2', whiteSpace: 'nowrap', textShadow: '0 0 18px rgba(255,220,150,0.95)', clipPath: band(shimmer) }}>GRACE IN MOTION</div>
            ) : null}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 540 - 220 * k3, top: 1062 + DY, width: 440 * k3, height: 2, background: 'linear-gradient(90deg, rgba(244,199,102,0), #f4c766, rgba(244,199,102,0))' }} />
        <div style={{ position: 'absolute', left: 540 - 9, top: 1054 + DY, width: 18, height: 18, transform: `rotate(45deg) scale(${k3})`, background: C.gold, boxShadow: '0 0 14px rgba(255,190,80,0.9)' }} />
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 1092 + DY, textAlign: 'center', font: `600 44px ${SANS}`, letterSpacing: '0.04em', color: C.gold, opacity: k3, transform: `translateY(${(1 - k3) * 14}px)`,
          textShadow: '0 0 18px rgba(255,180,70,0.35)' }}>@grace_in_motion616</div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 65% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${grainURL()})`, backgroundPosition: `${Math.round(hash01(frame, 1) * 256)}px ${Math.round(hash01(frame, 2) * 256)}px`, opacity: 0.07, mixBlendMode: 'overlay' }} />
      </div>
      {/* the flare that wipes the card in */}
      {p > 0 && p < 1 ? <Flare wipe={wipe} p={p} /> : null}
    </div>
  );
};

const Flare = ({ wipe, p }) => {
  const x = (wipe + 4) / 100 * 1080;
  const o = Math.sin(Math.PI * p);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, rgba(255,220,160,0) ${wipe - 10}%, rgba(255,236,200,${0.85 * o}) ${wipe + 4}%, rgba(255,220,160,0) ${wipe + 14}%)` }} />
      <div style={{ position: 'absolute', left: x - 700, top: CY - 6, width: 1400, height: 12, borderRadius: 12, background: 'linear-gradient(90deg, rgba(255,220,160,0), rgba(255,246,225,0.95), rgba(255,220,160,0))', opacity: o, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', left: x - 160, top: CY - 160, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,250,235,0.95) 0%, rgba(255,210,130,0.4) 30%, rgba(255,190,90,0) 70%)', opacity: o }} />
    </>
  );
};

const Bokeh = ({ t }) => (
  <>{Array.from({ length: 16 }, (_, i) => {
    const r = 30 + 80 * hash01(i, 17); const x = 1080 * hash01(i, 18) + 24 * Math.sin(t * 0.3 + i); const y = 1920 * hash01(i, 19) + 18 * Math.cos(t * 0.25 + i) - 12 * t;
    return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%',
      background: `radial-gradient(circle, rgba(255,170,80,${0.14 + 0.16 * hash01(i, 20)}) 0%, rgba(255,170,80,0.05) 60%, rgba(255,170,80,0) 72%)` }} />;
  })}</>
);

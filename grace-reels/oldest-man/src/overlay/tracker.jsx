// MATH TRACKER (the retention engine), under the captions from line 5 ("Now watch the math").
//   [187] + [182] + [600] = [ 9 6 9 ]   with tiny labels LAMECH BORN · NOAH BORN · FLOOD · TOTAL
// S5–S7: each term lands with weight on its word (anticipation dip, overshoot, settle) and the total
// rolls up like an odometer 000 -> 187 -> 369 -> 969. S8: the equation is re-built term by term
// (sum187/sum182/sum600 highlight, a gold spark flies into the total, "=" glows on equals) and at the
// slam the 969 locks gold with a flash + tiny shake. Visible through the lamp-out, then fades.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, L, SERIF, SANS, ease, pop, shake, land, clamp, lerp, hash01, mixHex } from './theme.js';

const E = plan.ev;
const PW = 838, PH = 132, PX = (1080 - PW) / 2, PY = L.trackY;
// x centres inside the panel
const X = { t1: 94, p1: 189, t2: 284, p2: 379, t3: 474, eq: 569, tot: 704 };
const TERMS = [
  { n: '187', at: E.n187, sum: E.sum187, x: X.t1, label: 'LAMECH BORN' },
  { n: '182', at: E.n182, sum: E.sum182, x: X.t2, label: 'NOAH BORN' },
  { n: '600', at: E.n600, sum: E.sum600, x: X.t3, label: 'THE FLOOD' },
];
export const TRACK = { t0: E.tracker - 0.05, t1: E.lampOut + 1.15 };

// running total as a pure function of t (eased roll after each landing)
function total(t) {
  const steps = [[E.n187, 0, 187, 0.85], [E.n182, 187, 369, 0.85], [E.n600, 369, 969, 1.0]];
  let v = 0;
  for (const [a, from, to, d] of steps) if (t >= a) v = lerp(from, to, ease.out5((t - a) / d));
  return v;
}
// odometer: digit k shows position floor(v/10^k)%10 + carry fraction
function digitPos(v, k) {
  const p = Math.pow(10, k);
  const base = Math.floor(v / p) % 10;
  const frac = k === 0 ? v - Math.floor(v) : clamp((v % p) - (p - 1));
  return base + frac;
}

export const Tracker = ({ t, frame }) => {
  if (t < TRACK.t0 || t > TRACK.t1) return null;
  const inK = ease.out((t - E.tracker) / 0.5);
  const outK = clamp((t - (E.lampOut + 0.45)) / 0.65);
  const o = clamp((t - TRACK.t0) / 0.2) * (1 - ease.inOut(outK));
  if (o <= 0.001) return null;
  const slamD = t - E.slam;
  const [sx, sy] = slamD > 0 && slamD < 0.32 ? shake(frame, 41, 9 * (1 - slamD / 0.32) ** 2) : [0, 0];
  const locked = slamD >= 0;
  const flash = locked ? Math.exp(-4.5 * slamD) : 0;
  const v = total(t);
  const speed = Math.abs(total(t + 1 / 60) - total(t - 1 / 60)) * 30;
  // S8 focus: which element is highlighted right now
  const inSum = t >= E.sum187 - 0.1;
  const focus = !inSum ? -1 : t < E.sum182 ? 0 : t < E.sum600 ? 1 : t < E.equals ? 2 : t < E.slam ? 3 : 4;
  const dim = (i) => (inSum && focus < 4 && focus !== i ? 0.55 : 1);
  return (
    <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH, opacity: o * (1 - 0.15 * outK),
      transform: `translate(${sx}px, ${sy - 10 * outK}px) scaleX(${lerp(0.55, 1, inK)}) scale(${1 + pop(t, E.slam, 0.04, 18, 8)})`, transformOrigin: '50% 50%' }}>
      {/* panel */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'linear-gradient(180deg, rgba(24,17,11,0.84), rgba(12,9,6,0.84))',
        border: `1.5px solid rgba(244,199,102,${0.42 + 0.4 * flash})`, boxShadow: `0 16px 44px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,232,180,0.16), 0 0 ${40 * flash}px rgba(255,190,80,${0.6 * flash})` }} />
      <div style={{ position: 'absolute', left: 30, right: 30, top: 0, height: 1.5, background: 'linear-gradient(90deg, rgba(255,226,160,0), rgba(255,226,160,0.5), rgba(255,226,160,0))' }} />
      <div style={{ opacity: inK }}>
        {TERMS.map((T, i) => <Term key={i} T={T} i={i} t={t} focus={focus} dim={dim(i)} locked={locked} />)}
        <Op ch="+" x={X.p1} lit={t >= E.n182 - 0.05} t={t} glow={0} dim={inSum && focus < 4 ? 0.6 : 1} />
        <Op ch="+" x={X.p2} lit={t >= E.n600 - 0.05} t={t} glow={0} dim={inSum && focus < 4 ? 0.6 : 1} />
        <Op ch="=" x={X.eq} lit={t >= E.n600 + 0.3} t={t} glow={t >= E.equals ? Math.max(focus === 3 ? 1 : 0, Math.exp(-3 * (t - E.equals))) : 0} dim={inSum && focus < 3 ? 0.6 : 1} pulse={pop(t, E.equals, 0.35, 14, 6)} />
        <Total t={t} v={v} speed={speed} locked={locked} flash={flash} focus={focus} />
        {/* S8: a gold spark flies from each highlighted term into the total */}
        {TERMS.map((T, i) => <Comet key={i} x0={T.x} t={t - T.sum - 0.12} />)}
        {locked && slamD < 0.9 ? <Burst t={slamD} x={X.tot} y={50} /> : null}
      </div>
    </div>
  );
};

function Term({ T, i, t, focus, dim, locked }) {
  const ld = land(t, T.at, { pre: 0.16, dip: 9, drop: 40 });
  const landed = t >= T.at;
  const hl = focus === i;
  const hk = hl ? pop(t, T.sum, 0.22, 13, 6) : 0;
  const ring = t - T.at;
  const gold = landed ? (locked ? C.goldHi : C.gold) : 'rgba(251,241,220,0.25)';
  return (
    <div style={{ position: 'absolute', left: T.x - 70, top: 0, width: 140, height: PH, opacity: dim }}>
      {/* landing flash under the number */}
      {ring > 0 && ring < 0.6 ? <div style={{ position: 'absolute', left: 70 - 60 - 50 * ring, top: 48 - 30 - 18 * ring, width: 120 + 100 * ring, height: 60 + 36 * ring, borderRadius: '50%',
        background: `radial-gradient(ellipse, rgba(255,200,90,${0.55 * (1 - ring / 0.6)}) 0%, rgba(255,200,90,0) 70%)` }} /> : null}
      {!landed && t < T.at - 0.16 ? (
        <div style={{ position: 'absolute', left: 30, right: 30, top: 74, height: 2, borderRadius: 2, background: 'rgba(251,241,220,0.22)' }} />
      ) : null}
      <div style={{ position: 'absolute', left: 0, width: 140, top: 6, textAlign: 'center', font: `700 62px/80px ${SERIF}`, color: gold, opacity: ld.o,
        transform: `translateY(${ld.y}px) scale(${ld.s * (1 + hk)})`, transformOrigin: '50% 70%', fontVariantNumeric: 'lining-nums',
        textShadow: landed ? `0 0 ${hl || locked ? 26 : 14}px rgba(255,180,70,${hl || locked ? 0.85 : 0.5}), 0 2px 8px rgba(0,0,0,0.6)` : 'none' }}>{T.n}</div>
      <div style={{ position: 'absolute', left: -14, width: 168, top: 94, textAlign: 'center', font: `700 16px ${SANS}`, letterSpacing: '0.1em', whiteSpace: 'nowrap',
        color: hl ? C.goldHi : 'rgba(251,241,220,0.62)', opacity: landed ? clamp((t - T.at - 0.1) / 0.3) : 0 }}>{T.label}</div>
    </div>
  );
}

const Op = ({ ch, x, lit, glow, dim, pulse = 0 }) => (
  <div style={{ position: 'absolute', left: x - 25, width: 50, top: 14, textAlign: 'center', font: `600 54px/70px ${SERIF}`, opacity: dim,
    color: glow > 0.05 ? mixHex('#fbf1dc', C.goldHi, glow) : lit ? 'rgba(251,241,220,0.85)' : 'rgba(251,241,220,0.25)', transform: `scale(${1 + pulse})`,
    textShadow: glow > 0.05 ? `0 0 ${24 * glow}px rgba(255,190,80,${0.9 * glow})` : 'none' }}>{ch}</div>
);

function Total({ t, v, speed, locked, flash, focus }) {
  const bw = 196, bh = 82, cell = 44;
  const started = t >= E.n187;
  const settle = [E.n187 + 0.85, E.n182 + 0.85, E.n600 + 1.0].map((a) => pop(t, a, 0.05, 16, 9)).reduce((a, b) => a + b, 0);
  const pulseIn = TERMS.map((T) => pop(t, T.sum + 0.55, 0.06, 15, 8)).reduce((a, b) => a + b, 0);
  const lockPop = pop(t, E.slam, 0.16, 15, 6);
  const face = locked ? 'linear-gradient(165deg, #fff0c4 0%, #f5c45c 45%, #c98a26 100%)' : 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(20,14,9,0.6))';
  const hot = focus === 3 ? 0.6 + 0.4 * Math.sin(t * 9) ** 2 : 0;
  return (
    <div style={{ position: 'absolute', left: X.tot - bw / 2, top: 8, width: bw, height: PH - 8 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: bw, height: bh, borderRadius: 16, background: face, overflow: 'hidden',
        border: `2px solid ${locked ? 'rgba(255,240,200,0.95)' : `rgba(244,199,102,${0.6 + 0.4 * hot})`}`, transform: `scale(${1 + settle + pulseIn + lockPop})`,
        boxShadow: locked ? `0 0 ${26 + 50 * flash}px rgba(255,190,80,${0.55 + 0.4 * flash}), inset 0 2px 0 rgba(255,255,255,0.5)` : `inset 0 3px 10px rgba(0,0,0,0.6), 0 0 ${18 * hot}px rgba(255,190,80,${0.7 * hot})` }}>
        {[2, 1, 0].map((k, j) => {
          const d = digitPos(v, k);
          const sp = speed / Math.pow(10, k);
          const blur = clamp(sp / 30 * 1.2, 0, 5);
          const lead = !locked && k > 0 && v < Math.pow(10, k) - 0.5;   // leading zero
          return (
            <div key={k} style={{ position: 'absolute', left: (bw - 3 * cell) / 2 + j * cell, top: 0, width: cell, height: bh, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: cell, transform: `translateY(${-d * bh}px)`, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none' }}>
                {Array.from({ length: 11 }, (_, n) => (
                  <div key={n} style={{ height: bh, textAlign: 'center', font: `700 66px/${bh}px ${SERIF}`, fontVariantNumeric: 'lining-nums tabular-nums',
                    color: locked ? '#2a1606' : started ? '#fbf1dc' : 'rgba(251,241,220,0.35)', opacity: lead ? 0.28 : 1,
                    textShadow: locked ? '0 1px 0 rgba(255,250,230,0.6)' : '0 0 10px rgba(255,200,120,0.25)' }}>{n % 10}</div>
                ))}
              </div>
            </div>
          );
        })}
        {/* drum shading: the digits roll on a cylinder */}
        <div style={{ position: 'absolute', inset: 0, background: locked ? 'linear-gradient(180deg, rgba(120,70,10,0.25), rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(120,70,10,0.3))'
          : 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0) 32%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.55))' }} />
        {flash > 0.02 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(255,252,235,${0.85 * flash})` }} /> : null}
        {locked ? <Shine t={t - E.slam - 0.15} /> : null}
      </div>
      <div style={{ position: 'absolute', left: 0, width: bw, top: 86, textAlign: 'center', font: `700 16px ${SANS}`, letterSpacing: '0.16em', whiteSpace: 'nowrap',
        color: locked ? C.goldHi : 'rgba(251,241,220,0.62)' }}>
        <span style={{ opacity: 1 - clamp((t - E.slam - 0.2) / 0.25) }}>TOTAL</span>
        <span style={{ position: 'absolute', left: 0, right: 0, opacity: clamp((t - E.slam - 0.2) / 0.25) }}>= HIS AGE</span>
      </div>
    </div>
  );
}

const Shine = ({ t }) => {
  if (t < 0 || t > 0.7) return null;
  const x = lerp(-60, 160, t / 0.7);
  return <div style={{ position: 'absolute', top: '-40%', left: `${x}%`, width: '40%', height: '180%', transform: 'rotate(20deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.8), rgba(255,255,255,0))' }} />;
};

// a gold spark arcing from a term to the total (S8)
function Comet({ x0, t }) {
  if (t < 0 || t > 0.5) return null;
  const u = ease.inOut(t / 0.5);
  const x = lerp(x0, X.tot, u), y = 44 - 70 * Math.sin(Math.PI * u);
  return (
    <>
      {[0, 1, 2, 3, 4].map((k) => {
        const uu = ease.inOut(clamp((t - k * 0.025) / 0.5)); const xx = lerp(x0, X.tot, uu), yy = 44 - 70 * Math.sin(Math.PI * uu); const r = 8 - k * 1.4;
        return <div key={k} style={{ position: 'absolute', left: xx - r, top: yy - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: k === 0 ? '#fff6dc' : '#ffcf6a', opacity: (1 - k / 5) * (1 - clamp((u - 0.85) / 0.15)), boxShadow: '0 0 14px rgba(255,190,80,0.95)' }} />;
      })}
      <div style={{ position: 'absolute', left: x - 2, top: y - 2, width: 4, height: 4 }} />
    </>
  );
}

// slam burst: flash ring + gold sparks
const Burst = ({ t, x, y }) => {
  const u = t / 0.9;
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{ position: 'absolute', left: -120 * (0.4 + 1.6 * ease.out(u)), top: -60 * (0.4 + 1.6 * ease.out(u)), width: 240 * (0.4 + 1.6 * ease.out(u)), height: 120 * (0.4 + 1.6 * ease.out(u)), borderRadius: '50%',
        border: `${3 * (1 - u) + 1}px solid rgba(255,220,140,${1 - u})`, boxShadow: `0 0 30px rgba(255,190,80,${0.8 * (1 - u)})` }} />
      {Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2 + 0.2; const d = (60 + 160 * hash01(k, 5)) * ease.out(u); const r = 3 + 4 * hash01(k, 6);
        return <div key={k} style={{ position: 'absolute', left: Math.cos(a) * d * 1.5 - r, top: Math.sin(a) * d * 0.7 - r + 60 * u * u, width: 2 * r, height: 2 * r, borderRadius: '50%', background: '#ffe2a0', opacity: 1 - u, boxShadow: '0 0 10px rgba(255,190,80,0.9)' }} />;
      })}
    </div>
  );
};

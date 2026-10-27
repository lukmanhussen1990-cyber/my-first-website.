// S11 (HTML only, the 3D is black under it): the full-screen cream card, Matthew 27:26 (KJV, exact) — "Then released
// he BARABBAS unto them…" with BARABBAS in deep gold. The parchment slides in with a dust burst, the words warm from
// ghost to ink as they are spoken (timed from the B13 words), the gold name lands with a pop and a drawn underline;
// the sheet blows away as dust into S12.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, SERIF, SANS, ease, pop, clamp, lerp, hash01, mixHex, parchmentURL, grainURL, layoutBalanced, measure } from './theme.js';
import { prepare } from './cards.jsx';

const E = plan.ev;
const S11 = plan.shots.find((s) => s.id === 'S11'), S12 = plan.shots.find((s) => s.id === 'S12');
const CARD = { beat: 'B13', ref: 'MATTHEW 27:26 · KJV', text: 'Then released he *Barabbas* unto them…', t0: E.card2726, t1: S12.t0 };
CARD.toks = prepare(CARD);
const IN = { t: CARD.t0 - 0.2, d: 0.5 }, OUT = { t: CARD.t1 - 0.18, d: 0.4 };
export const fullCardCover = (t) => clamp((t - IN.t) / IN.d) * (1 - clamp((t - OUT.t) / OUT.d));

const FS = 96, LH = 120, GS = 1.0, PADX = 120, TOP = 760;
const INK = '#2e1c0e', GOLD = '#8a520a', PAPER = '#efe1bf';
const GHOST = mixHex(INK, PAPER, 0.6), GHOST_G = mixHex(GOLD, PAPER, 0.54);
const fontOf = (w) => (w.gold ? `700 ${Math.round(FS * GS)}px ${SERIF}` : `italic 600 ${FS}px ${SERIF}`);

export const FullCard = ({ t, frame }) => {
  if (t < IN.t || t > OUT.t + OUT.d + 0.8) return null;
  const inK = clamp((t - IN.t) / IN.d), outK = clamp((t - OUT.t) / OUT.d);
  const inE = ease.out(inK), outE = ease.in(outK);
  const u = clamp((t - CARD.t0) / (CARD.t1 - CARD.t0));
  const o = clamp(inK * 3) * (1 - outE);
  const lay = layoutBalanced(CARD.toks.map((w, i) => ({ glue: false, text: w.text + w.tail, font: fontOf(w), extra: w.gold ? w.text.length * FS * 0.04 : 0 })), { maxW: 1080 - 2 * PADX, lineH: LH, align: 'center', space: FS * 0.26 });
  const tilt = `perspective(1800px) rotateX(${lerp(5, 2, u)}deg) rotateZ(${lerp(0.8, 0.2, u)}deg) scale(${lerp(1.02, 1.06, ease.sine(u)) * (1 + 0.1 * outE)})`;
  const slide = `translate(${(1 - inE) * -1150}px, ${(1 - inE) * 50}px) rotate(${(1 - inE) * -6}deg)`;
  const gold = CARD.toks.find((w) => w.gold);
  const gi = CARD.toks.indexOf(gold), git = lay.items[gi];
  const gk = clamp((t - (gold.start - 0.03)) / 0.18), ul = ease.out((t - gold.start - 0.05) / 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(10,6,3,${0.6 * inE})` }} />
      <div style={{ position: 'absolute', left: -40, top: -40, width: 1160, height: 2000, transform: `${slide} ${tilt}`, transformOrigin: '50% 45%', filter: outE > 0.02 ? `blur(${(outE * 6).toFixed(1)}px)` : 'none' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${parchmentURL()})`, backgroundSize: '100% 100%', boxShadow: '30px 0 80px rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', left: 40, top: 40, width: 1080, height: 1920, transform: `translate(${-6 * u}px, ${-5 * u}px)` }}>
          {/* kicker: the gold rule with a diamond, the reference */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: TOP - 150, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: ease.out((t - CARD.t0) / 0.5) }}>
            <div style={{ width: 90, height: 1.5, background: 'linear-gradient(90deg, rgba(138,82,10,0), #8a520a)' }} />
            <div style={{ width: 14, height: 14, transform: 'rotate(45deg)', background: '#b07a22' }} />
            <div style={{ width: 90, height: 1.5, background: 'linear-gradient(90deg, #8a520a, rgba(138,82,10,0))' }} />
          </div>
          <div style={{ position: 'absolute', left: PADX, top: TOP, width: 1080 - 2 * PADX, height: lay.height }}>
            {git ? <div style={{ position: 'absolute', left: git.x, top: git.y + LH * 0.86, height: 4, width: (git.w - measure(git.font, CARD.toks[gi].tail)) * ul, borderRadius: 3, background: 'linear-gradient(90deg, #b07a22, #d9a441)' }} /> : null}
            {lay.items.map((it, i) => {
              const w = CARD.toks[i];
              const k = clamp((t - (w.start - 0.03)) / 0.16);
              const col = w.gold ? mixHex(GHOST_G, GOLD, k) : mixHex(GHOST, INK, k);
              const kp = w.gold ? pop(t, w.start, 0.16, 13, 6) : 0;
              return (
                <span key={i} style={{ position: 'absolute', left: it.x, top: it.y, height: LH, font: it.font, lineHeight: `${LH}px`, whiteSpace: 'nowrap', color: col, transform: `scale(${1 + kp})`, transformOrigin: '50% 60%',
                  letterSpacing: w.gold ? '0.04em' : 0, textShadow: w.gold && k > 0 ? `0 0 ${18 * k}px rgba(225,150,40,${0.35 * k}), 0 1px 0 rgba(255,248,228,${0.6 * k})` : 'none' }}>
                  {w.text}{w.tail ? <span style={{ color: mixHex(GHOST, INK, k) }}>{w.tail}</span> : null}
                </span>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: TOP + lay.height + 70, textAlign: 'center', font: `700 26px ${SANS}`, letterSpacing: '0.34em', textIndent: '0.34em', color: '#7a4a12', opacity: ease.out((t - CARD.t0 - 0.35) / 0.5) }}>{CARD.ref}</div>
        </div>
      </div>
      <Motes t={t} />
      <DustBurst t={t - IN.t} edge={(1 - inE) * -1150 + 1060} dir={-1} />
      <DustBurst t={t - OUT.t} edge={null} dir={1} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 60% at 50% 50%, rgba(60,30,10,0) 55%, rgba(40,20,6,0.45) 100%)', opacity: inK }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${grainURL()})`, backgroundPosition: `${Math.round(hash01(frame, 1) * 256)}px ${Math.round(hash01(frame, 2) * 256)}px`, opacity: 0.07, mixBlendMode: 'overlay' }} />
    </div>
  );
};

const Motes = ({ t }) => (
  <>{Array.from({ length: 28 }, (_, i) => {
    const sp = 18 + 30 * hash01(i, 71);
    const x = 1080 * hash01(i, 72) + 30 * Math.sin(t * 0.4 + i * 1.7);
    const y = ((1920 * hash01(i, 73) - sp * t) % 1920 + 1920) % 1920;
    const r = 1.2 + 3.5 * hash01(i, 74) ** 2; const b = hash01(i, 75) < 0.3;
    return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: 'rgba(255,240,205,0.85)',
      opacity: (0.25 + 0.5 * hash01(i, 76)) * (0.6 + 0.4 * Math.sin(t * 1.3 + i)), filter: b ? 'blur(2px)' : 'none', boxShadow: '0 0 6px rgba(255,220,150,0.6)' }} />;
  })}</>
);

// dust burst along a moving paper edge (in) or blown off the whole sheet (out)
function DustBurst({ t, edge, dir }) {
  if (t < 0 || t > 1.1) return null;
  return (
    <>{Array.from({ length: 34 }, (_, i) => {
      const born = hash01(i, 81) * 0.45; const age = (t - born) / 0.65; if (age < 0 || age > 1) return null;
      const y = 1920 * hash01(i, 82);
      const x0 = edge != null ? Math.max(0, Math.min(1080, edge)) : 1080 * hash01(i, 83);
      const x = x0 + dir * (40 + 140 * hash01(i, 84)) * ease.out(age) * (edge != null ? 1 : 1.6), yy = y - 40 * age * hash01(i, 85);
      const r = 18 + 50 * hash01(i, 86) * (0.5 + age);
      return <div key={i} style={{ position: 'absolute', left: x - r, top: yy - r, width: 2 * r, height: 2 * r, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(225,195,145,${0.45 * (1 - age)}) 0%, rgba(225,195,145,0) 70%)` }} />;
    })}</>
  );
}

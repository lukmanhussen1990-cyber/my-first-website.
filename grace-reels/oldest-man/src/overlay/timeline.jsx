// S4 (HTML only, the 3D is black under it): a parchment timeline of the years of the world (anno mundi).
// Bars ADAM 0–930, METHUSELAH 687–1656, NOAH born 1056 -> flood 1656 on a 0..1700 axis, paper-cut
// portrait medallions at the bar starts, overlaps glowing gold (Adam/Methuselah at barAdam,
// Methuselah/Noah at barNoah), FLOOD 1656 marker exactly where Methuselah's bar ends.
// Paper slides in with a dust burst, slow tilt/parallax, dust motes, grain + vignette; blows away into S5.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, SERIF, SANS, ease, pop, clamp, lerp, hash01, parchmentURL, grainURL } from './theme.js';

const E = plan.ev;
const S4 = plan.shots.find((s) => s.id === 'S4'), S5 = plan.shots.find((s) => s.id === 'S5');
const AX0 = 130, AX1 = 930, YMAX = 1700;
const X = (yr) => AX0 + (yr / YMAX) * (AX1 - AX0);
const ROW = { adam: 862, meth: 1076, noah: 1290 }, BH = 36, AXY = 1428;
const INK = '#3a2414', TEAL = '#2e5a66';

// timing (seconds)
const T = {
  axis: S4.t0 + 0.05, adam: S4.t0 + 0.3, title: plan.word('B04', 'Genesis').start - 0.05, noah: plan.word('B04', 'Genesis').start + 0.15,
  flood: plan.word('B04', 'Genesis').start + 0.75, meth: E.barMeth, methDur: 1.0, ovA: E.barAdam, ovN: E.barNoah,
};
export const timelineCover = (t) => {
  const inK = clamp((t - (S4.t0 - 0.25)) / 0.5), outK = clamp((t - (S5.t0 - 0.2)) / 0.42);
  return inK * (1 - outK);
};

export const Timeline = ({ t, frame }) => {
  const a = S4.t0 - 0.25, b = S5.t0 + 0.25;
  if (t < a || t > b) return null;
  const inK = clamp((t - a) / 0.5), outK = clamp((t - (S5.t0 - 0.2)) / 0.42);
  const inE = ease.out(inK), outE = ease.in(outK);
  const u = clamp((t - S4.t0) / (S4.t1 - S4.t0));
  const tilt = `perspective(1700px) rotateX(${lerp(6, 2.5, u)}deg) rotateZ(${lerp(-0.9, -0.25, u)}deg) scale(${lerp(1.03, 1.075, ease.sine(u)) * (1 + 0.12 * outE)})`;
  const slide = `translate(${(1 - inE) * 1150}px, ${(1 - inE) * 60}px) rotate(${(1 - inE) * 7}deg)`;
  const o = clamp(inK * 3) * (1 - outE);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      {/* the 3D is black under S4; during the slide the sheet casts a shadow on the outgoing shot */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(10,6,3,${0.55 * inE})` }} />
      <div style={{ position: 'absolute', left: -40, top: -40, width: 1160, height: 2000, transform: `${slide} ${tilt}`, transformOrigin: '50% 45%', filter: outE > 0.02 ? `blur(${(outE * 6).toFixed(1)}px)` : 'none' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${parchmentURL()})`, backgroundSize: '100% 100%', boxShadow: '-30px 0 80px rgba(0,0,0,0.6)' }} />
        {/* faint ruled guide lines */}
        {[ROW.adam, ROW.meth, ROW.noah].map((y, i) => <div key={i} style={{ position: 'absolute', left: 120, right: 120, top: y + 40 + 40, height: 1, background: 'rgba(120,80,40,0.10)' }} />)}
        <div style={{ position: 'absolute', left: 40, top: 40, width: 1080, height: 1920, transform: `translate(${-8 * u}px, ${-6 * u}px)` }}>
          <Content t={t} />
        </div>
      </div>
      <Motes t={t} />
      <DustBurst t={t - a} edge={(1 - inE) * 1150 + 20} dir={1} />
      <DustBurst t={t - (S5.t0 - 0.2)} edge={null} dir={-1} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 60% at 50% 50%, rgba(60,30,10,0) 55%, rgba(40,20,6,0.45) 100%)', opacity: inK }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${grainURL()})`, backgroundPosition: `${Math.round(hash01(frame, 1) * 256)}px ${Math.round(hash01(frame, 2) * 256)}px`, opacity: 0.07, mixBlendMode: 'overlay' }} />
    </div>
  );
};

function Content({ t }) {
  const axK = ease.inOut((t - T.axis) / 0.8);
  const titleK = ease.out((t - T.title) / 0.5);
  return (
    <>
      {/* small title */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 684, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: titleK, transform: `translateY(${(1 - titleK) * 8}px)` }}>
        <div style={{ width: 70 * titleK, height: 1.5, background: `linear-gradient(90deg, rgba(58,36,20,0), ${INK})` }} />
        <div style={{ font: `700 23px ${SANS}`, letterSpacing: '0.28em', color: INK, whiteSpace: 'nowrap' }}>ADDING THE AGES IN GENESIS 5</div>
        <div style={{ width: 70 * titleK, height: 1.5, background: `linear-gradient(90deg, ${INK}, rgba(58,36,20,0))` }} />
      </div>
      {/* axis */}
      <div style={{ position: 'absolute', left: AX0, top: AXY - 1, width: (AX1 - AX0) * axK, height: 2.2, background: INK, borderRadius: 2 }} />
      {Array.from({ length: 18 }, (_, i) => {
        const yr = i * 100; const x = X(yr); const k = clamp((AX0 + (AX1 - AX0) * axK - x) / 20);
        const big = yr % 500 === 0;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x - 1, top: AXY - (big ? 10 : 5), width: 2, height: big ? 20 : 10, background: INK, opacity: k * (big ? 1 : 0.6) }} />
            {big ? <div style={{ position: 'absolute', left: x - 40, width: 80, top: AXY + 16, textAlign: 'center', font: `600 31px ${SERIF}`, color: INK, opacity: k * 0.85, fontVariantNumeric: 'lining-nums' }}>{yr}</div> : null}
          </React.Fragment>
        );
      })}
      <div style={{ position: 'absolute', left: AX0, top: AXY + 66, font: `600 17px ${SANS}`, letterSpacing: '0.22em', color: 'rgba(58,36,20,0.7)', opacity: axK }}>YEAR OF THE WORLD (ANNO MUNDI)</div>
      <Flood t={t} />
      <Overlap t={t} at={T.ovA} y0={ROW.adam + BH / 2} y1={ROW.meth - BH / 2} x0={X(687)} x1={X(930)} label="243 YEARS WITH ADAM" lx={X(687) - 14} ly={(ROW.adam + ROW.meth) / 2} />
      <Overlap t={t} at={T.ovN} y0={ROW.meth + BH / 2} y1={ROW.noah - BH / 2} x0={X(1056)} x1={X(1656)} label="600 YEARS WITH NOAH" lx={(X(1056) + X(1656)) / 2} ly={(ROW.meth + ROW.noah) / 2 - 12} center />
      <Bar t={t} at={T.adam} dur={0.75} y={ROW.adam} y0={0} y1={930} fill={['#8d9650', '#6c7537']} name="ADAM" born="0" end="930" who="adam" glow={[[687, 930, T.ovA]]} />
      <Bar t={t} at={T.noah} dur={0.6} y={ROW.noah} y0={1056} y1={1656} fill={['#5f8394', '#3f6170']} name="NOAH" born="1056" who="noah" arrow glow={[[1056, 1656, T.ovN]]} />
      <Bar t={t} at={T.meth} dur={T.methDur} y={ROW.meth} y0={687} y1={1656} fill={['#c0583a', '#923a22']} name="METHUSELAH" born="687" who="meth" hero glow={[[687, 930, T.ovA], [1056, 1656, T.ovN]]} />
    </>
  );
}

function Bar({ t, at, dur, y, y0, y1, fill, name, born, end, who, hero, arrow, glow }) {
  const k = ease.inOut((t - at) / dur);
  const medK = ease.back((t - at + 0.05) / 0.45, 2.0);
  if (medK <= 0) return null;
  const x0 = X(y0), x1 = X(y1), xe = lerp(x0, x1, k);
  const nameK = ease.out((t - at - 0.15) / 0.4);
  const endPop = hero ? pop(t, at + dur, 0.5, 14, 6) : 0;
  return (
    <>
      {/* bar shadow + bar (paper strip with ink outline) */}
      <div style={{ position: 'absolute', left: x0, top: y - BH / 2 + 4, width: Math.max(0, xe - x0), height: BH, borderRadius: 8, background: 'rgba(60,30,10,0.22)', filter: 'blur(3px)', transform: 'translate(3px, 2px)' }} />
      <div style={{ position: 'absolute', left: x0, top: y - BH / 2, width: Math.max(0, xe - x0), height: BH, borderRadius: 8, background: `linear-gradient(180deg, ${fill[0]}, ${fill[1]})`,
        border: `2.4px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 4, right: 4, top: 3, height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.22)' }} />
        {glow.map(([g0, g1, ga], i) => {
          const gk = ease.out((t - ga) / 0.45); if (gk <= 0) return null;
          const pulse = 0.85 + 0.15 * Math.sin((t - ga) * 5);
          return <div key={i} style={{ position: 'absolute', left: X(g0) - x0 - 2, width: (X(g1) - X(g0)) * gk, top: 0, bottom: 0, background: 'linear-gradient(180deg, #ffe7a8, #f2b84a 55%, #d18f2a)', opacity: pulse }} />;
        })}
      </div>
      {glow.map(([g0, g1, ga], i) => {
        const gk = ease.out((t - ga) / 0.45); if (gk <= 0 || k < 1) return null;
        return <div key={i} style={{ position: 'absolute', left: X(g0), top: y - BH / 2 - 6, width: (X(g1) - X(g0)) * gk, height: BH + 12, borderRadius: 14, boxShadow: `0 0 26px 6px rgba(255,190,80,${0.55 * gk})`, pointerEvents: 'none' }} />;
      })}
      {/* drawing tip */}
      {k > 0 && k < 1 ? <div style={{ position: 'absolute', left: xe - 18, top: y - 18, width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,200,0.95), rgba(255,200,110,0) 70%)' }} /> : null}
      {arrow && k > 0.98 ? <svg width="30" height="40" style={{ position: 'absolute', left: x1 - 4, top: y - 20, overflow: 'visible' }}><path d="M 0 6 L 16 20 L 0 34" fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" /></svg> : null}
      {hero && t > at + dur - 0.02 ? <SealRing t={t - at - dur} x={x1} y={y} amp={endPop} /> : null}
      {/* name + years */}
      <div style={{ position: 'absolute', left: x0 + 60, top: y - BH / 2 - 58, whiteSpace: 'nowrap', opacity: nameK, transform: `translateX(${(1 - nameK) * -10}px)` }}>
        <span style={{ font: `700 39px ${SERIF}`, letterSpacing: '0.07em', color: INK }}>{name}</span>
      </div>
      {/* birth year under the medallion, end year after the bar (Methuselah and Noah end at the FLOOD line) */}
      <div style={{ position: 'absolute', left: x0 - 60, width: 120, top: y + 56, textAlign: 'center', font: `italic 700 28px ${SERIF}`, color: 'rgba(58,36,20,0.8)', opacity: nameK }}>{born}</div>
      {end ? <div style={{ position: 'absolute', left: x1 + 12, top: y - 20, font: `italic 700 30px/40px ${SERIF}`, color: 'rgba(58,36,20,0.85)', opacity: clamp((k - 0.9) * 10) }}>{end}</div> : null}
      <div style={{ position: 'absolute', left: x0 - 54, top: y - 54, width: 108, height: 108, transform: `scale(${medK}) rotate(${(1 - clamp(medK)) * -20}deg)` }}>
        <Portrait who={who} />
      </div>
    </>
  );
}

const SealRing = ({ t, x, y, amp }) => {
  const u = clamp(t / 0.7);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 20 - 30 * u, top: y - 20 - 30 * u, width: 40 + 60 * u, height: 40 + 60 * u, borderRadius: '50%', border: `${3 * (1 - u) + 0.5}px solid rgba(201,139,38,${1 - u})` }} />
      <div style={{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, borderRadius: '50%', background: '#f4c766', border: `2.4px solid ${INK}`, transform: `scale(${1 + amp})`, boxShadow: '0 0 14px rgba(255,190,80,0.8)' }} />
    </>
  );
};

function Overlap({ t, at, y0, y1, x0, x1, label, lx, ly, center }) {
  const k = ease.out((t - at) / 0.4);
  if (k <= 0) return null;
  const lk = ease.out((t - at - 0.12) / 0.4);
  const h = (y1 - y0) * k;
  const pulse = 0.85 + 0.15 * Math.sin((t - at) * 5);
  return (
    <>
      <div style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: h, background: `linear-gradient(180deg, rgba(244,190,90,${0.42 * pulse}), rgba(244,190,90,${0.22 * pulse}))`, boxShadow: `0 0 30px rgba(255,190,80,${0.35 * k})` }} />
      <div style={{ position: 'absolute', left: x0 - 1, top: y0, width: 2, height: h, background: 'rgba(190,125,30,0.9)' }} />
      <div style={{ position: 'absolute', left: x1 - 1, top: y0, width: 2, height: h, background: 'rgba(190,125,30,0.9)' }} />
      <div style={{ position: 'absolute', ...(center ? { left: lx - 200, width: 400, textAlign: 'center' } : { right: 1080 - lx, textAlign: 'right' }), top: ly - 40, opacity: lk, transform: `translateX(${(1 - lk) * (center ? 0 : 12)}px) scale(${center ? lerp(0.9, 1, lk) : 1})`, whiteSpace: 'nowrap' }}>
        <div style={{ font: `700 52px/48px ${SERIF}`, color: '#9a5f10', textShadow: '0 0 16px rgba(255,200,100,0.5)' }}>{label.split(' ')[0]}</div>
        <div style={{ font: `700 17px/24px ${SANS}`, letterSpacing: '0.18em', color: INK }}>{label.split(' ').slice(1).join(' ')}</div>
      </div>
    </>
  );
}

function Flood({ t }) {
  const k = ease.inOut((t - T.flood) / 0.6);
  if (k <= 0) return null;
  const x = X(1656), yTop = 790, len = AXY + 10 - yTop;
  const lk = ease.out((t - T.flood - 0.2) / 0.4);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 1.25, top: yTop, width: 2.5, height: len * k, backgroundImage: `repeating-linear-gradient(180deg, ${TEAL} 0 12px, rgba(0,0,0,0) 12px 20px)` }} />
      <div style={{ position: 'absolute', right: 1080 - x + 14, top: yTop - 22, whiteSpace: 'nowrap', textAlign: 'right', opacity: lk }}>
        <svg width="44" height="18" style={{ verticalAlign: 'middle', marginRight: 10 }}><path d="M 2 12 Q 8 4 14 12 T 26 12 T 38 12" fill="none" stroke={TEAL} strokeWidth="3" strokeLinecap="round" /></svg>
        <span style={{ font: `700 23px ${SANS}`, letterSpacing: '0.24em', color: TEAL, verticalAlign: 'middle' }}>FLOOD</span>
      </div>
      <div style={{ position: 'absolute', left: x - 50, width: 100, top: AXY + 16, textAlign: 'center', font: `700 32px ${SERIF}`, color: TEAL, opacity: lk }}>1656</div>
    </>
  );
}

// paper-cut portrait medallions (profile, facing right): Adam young dark hair; Methuselah very long white beard; Noah white beard + tiny ark
function Portrait({ who }) {
  const ink = INK, sw = 2.4;
  const P = {
    adam: { bg: '#d9c48f', skin: '#b5733f', robe: '#7d8740', hair: '#2b1b10', beard: null },
    meth: { bg: '#e2c49a', skin: '#c99260', robe: '#9b3d22', hair: '#f3eee4', beard: 'long' },
    noah: { bg: '#c9d2c4', skin: '#a86a3c', robe: '#4b6a7a', hair: '#f3eee4', beard: 'mid' },
  }[who];
  const id = `clip-${who}`;
  return (
    <svg viewBox="0 0 100 100" width="108" height="108" style={{ overflow: 'visible', filter: 'drop-shadow(2px 4px 3px rgba(60,30,10,0.35))' }}>
      <defs><clipPath id={id}><circle cx="50" cy="50" r="46" /></clipPath></defs>
      <circle cx="50" cy="50" r="47" fill="#f4e8cc" stroke={ink} strokeWidth="3" />
      <g clipPath={`url(#${id})`}>
        <circle cx="50" cy="50" r="46" fill={P.bg} />
        {/* robe + shoulders */}
        <path d="M 14 104 Q 16 76 46 72 Q 78 74 84 104 Z" fill={P.robe} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M 40 74 L 50 88 L 58 74" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.6" />
        {/* neck */}
        <path d="M 42 62 L 42 76 L 56 76 L 56 62 Z" fill={P.skin} stroke={ink} strokeWidth={sw} />
        {/* head */}
        <path d="M 30 44 Q 30 22 50 21 Q 68 21 70 40 L 75 47 Q 76 50 71 51 L 70 56 Q 68 66 54 66 Q 34 66 30 44 Z" fill={P.skin} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        {/* hair */}
        {who === 'adam'
          ? <path d="M 28 46 Q 24 18 50 15 Q 70 15 72 34 Q 62 28 52 30 Q 46 38 40 40 Q 38 50 34 54 Z" fill={P.hair} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
          : <path d="M 28 50 Q 22 20 50 17 Q 66 17 70 30 Q 60 26 50 29 Q 44 36 40 42 Q 38 54 32 58 Z" fill={P.hair} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />}
        {who === 'noah' ? <path d="M 31 34 Q 50 25 70 33" fill="none" stroke="#b5562f" strokeWidth="4" strokeLinecap="round" /> : null}
        {/* beard */}
        {P.beard === 'long' ? <path d="M 46 56 Q 56 60 68 54 Q 70 70 64 84 Q 58 100 50 106 Q 46 90 44 78 Q 42 66 46 56 Z" fill={P.hair} stroke={ink} strokeWidth={sw} strokeLinejoin="round" /> : null}
        {P.beard === 'long' ? <path d="M 52 66 Q 54 80 50 94 M 58 64 Q 60 76 57 88" fill="none" stroke={ink} strokeWidth="1.2" opacity="0.55" /> : null}
        {P.beard === 'mid' ? <path d="M 46 55 Q 56 60 69 53 Q 70 66 62 74 Q 54 80 48 76 Q 43 66 46 55 Z" fill={P.hair} stroke={ink} strokeWidth={sw} strokeLinejoin="round" /> : null}
        {/* eye + brow */}
        <path d="M 57 41 Q 61.5 37.6 66 41 Q 61.5 44 57 41 Z" fill="#fbf2e2" stroke={ink} strokeWidth="1.3" />
        <circle cx="62.6" cy="41" r="1.8" fill={ink} />
        <path d="M 56 35.5 Q 61 33 66.5 35" fill="none" stroke={who === 'adam' ? ink : '#9a8f80'} strokeWidth="2" strokeLinecap="round" />
        {/* ear */}
        <path d="M 44 42 Q 40 42 40 47 Q 41 52 45 51" fill={P.skin} stroke={ink} strokeWidth="1.6" />
      </g>
      {who === 'noah' ? (
        <g transform="translate(66 70)">
          <circle cx="12" cy="12" r="15" fill="#f4e8cc" stroke={ink} strokeWidth="2.4" />
          <path d="M 1 13 L 23 13 L 19 19 L 5 19 Z" fill="#8a5a2c" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M 7 13 L 7 8 L 17 8 L 17 13" fill="#a9733c" stroke={ink} strokeWidth="1.6" />
          <path d="M 5 8 L 12 4 L 19 8 Z" fill="#9b3d22" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M 2 22 Q 6 20 10 22 T 18 22 T 24 22" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}

// floating dust motes catching the light
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
      const x0 = edge != null ? Math.min(1080, edge + 2) : 1080 * hash01(i, 83);
      const x = x0 + dir * (40 + 120 * hash01(i, 84)) * ease.out(age) * (edge != null ? 1 : -1.6), yy = y - 40 * age * hash01(i, 85);
      const r = 18 + 50 * hash01(i, 86) * (0.5 + age);
      return <div key={i} style={{ position: 'absolute', left: x - r, top: yy - r, width: 2 * r, height: 2 * r, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(225,195,145,${0.45 * (1 - age)}) 0%, rgba(225,195,145,0) 70%)` }} />;
    })}</>
  );
}

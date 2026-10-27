// The retention engine: the LOCKED NAME CARD and the shout.
//  - From "name" (S2) a dark glass card under the captions reads  BARABBAS = ???  with a soft glow and a tiny lock.
//  - S8: the crowd shouts — a huge shaking BARABBAS slams over the frame (the caption of that word), dust flies.
//  - S9: after 0.8 s of near silence the world freezes; the card flies to the centre and grows, the lock cracks and
//    breaks off, the name splits BAR | ABBA (the S fades), SON appears under BAR, FATHER under ABBA, then the letters
//    re-form into  SON OF THE FATHER  in glowing gold (big hit).
//  - S10: the gold name docks back under the captions; it leaves for the Matthew 27:26 card.
//  - S15: it returns large and glowing above the comment box (call to action).
// Plus the soft cream glow framing the S5 memories. Everything is a pure function of t.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, L, SERIF, SANS, ease, pop, shake, clamp, lerp, hash01, measure, mixHex } from './theme.js';

const E = plan.ev;
const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
const DOCK = { x: 540, y: L.dockY }, CENTER = { x: 540, y: 880 }, CTA_POS = { x: 540, y: 820 };
const NAME = 'BARABBAS', NFS = 118;
const nameFont = `700 ${NFS}px ${SERIF}`, NLS = 0.06;     // letter spacing (em)

// ---------------------------------------------------------------- timeline of the card
function state(t) {
  const st = { o: 0, x: DOCK.x, y: DOCK.y, s: 0.42, locked: 1, crack: 0, split: 0, sFade: 0, son: 0, father: 0, reform: 0, gold: 0, glass: 1, glow: 0.35, shakeK: 0 };
  if (t < E.nameCard - 0.05) return st;
  // appear (pop) at "name"
  const ap = ease.back((t - E.nameCard) / 0.45, 1.6);
  st.o = clamp((t - E.nameCard) / 0.2); st.s = 0.42 * lerp(0.6, 1, ap);
  // hide for the Matthew 27:21 card (S7b) — back for the shout
  st.o *= 1 - clamp((t - (E.card2721 - 0.2)) / 0.2) * (1 - clamp((t - (E.card2721Out - 0.05)) / 0.25));
  // the shout shakes it
  st.shakeK = Math.exp(-3 * Math.max(0, t - E.shout)) * (t > E.shout ? 1 : 0) * (t < E.freeze ? 1 : 0);
  // S9: fly to the centre and grow
  const fly = ease.inOut((t - E.cardCenter) / 0.62);
  st.x = lerp(DOCK.x, CENTER.x, fly); st.y = lerp(DOCK.y, CENTER.y, fly); st.s = lerp(st.s, 1, fly);
  st.glass = 1 - fly; st.glow = lerp(0.35, 1, fly);
  st.crack = clamp((t - (E.lockBreak - 0.18)) / 0.18);
  st.locked = 1 - clamp((t - E.lockBreak) / 0.5);
  st.split = ease.inOut((t - E.splitBar) / 0.55); st.sFade = ease.out((t - E.splitBar) / 0.45);
  st.son = ease.out((t - E.tagSon) / 0.4); st.father = ease.out((t - E.tagFather) / 0.4);
  st.reform = ease.inOut((t - E.reform) / 0.7); st.gold = clamp((t - E.goldName) / 0.35);
  // S10: dock back (small gold) ... leave for the full-screen card
  const dock = ease.inOut((t - (S.S10.t0 + 0.4)) / 0.7);
  if (dock > 0) { st.x = lerp(CENTER.x, DOCK.x, dock); st.y = lerp(CENTER.y, DOCK.y, dock); st.s = lerp(1, 0.42, dock); st.glass = dock; st.glow = lerp(1, 0.5, dock); }
  st.o *= 1 - clamp((t - (E.card2726 - 0.25)) / 0.25);
  // S15: back, large and glowing, above the comment box
  if (t > S.S15.t0 - 0.1) {
    const k = ease.out((t - S.S15.t0 - 0.15) / 0.6);
    Object.assign(st, { o: k * (1 - clamp((t - (E.endCard - 0.3)) / 0.35)), x: CTA_POS.x, y: CTA_POS.y + (1 - k) * 30, s: 0.78, glass: 0, glow: 0.8 + 0.2 * Math.sin((t - S.S15.t0) * 2.4), locked: 0, crack: 1, split: 1, sFade: 1, son: 1, father: 1, reform: 1, gold: 1, shakeK: 0 });
  }
  return st;
}

// letter layout of BARABBAS: intact (centred) and split (BAR left | ABBA right, S gone)
const letters = () => {
  const ws = NAME.split('').map((ch) => measure(nameFont, ch) + NFS * NLS);
  const tot = ws.reduce((a, b) => a + b, 0);
  let x = -tot / 2; const intact = ws.map((w) => { const c = x + w / 2; x += w; return c; });
  const bar = ws.slice(0, 3).reduce((a, b) => a + b, 0), abba = ws.slice(3, 7).reduce((a, b) => a + b, 0);
  const gap = 120, left = -(bar + gap + abba) / 2;
  const split = ws.map((w, i) => {
    if (i < 3) return left + ws.slice(0, i).reduce((a, b) => a + b, 0) + w / 2;
    if (i < 7) return left + bar + gap + ws.slice(3, i).reduce((a, b) => a + b, 0) + w / 2;
    return left + bar + gap + abba + w / 2 + 20;
  });
  return { ws, intact, split, barC: left + bar / 2, abbaC: left + bar + gap + abba / 2, divider: left + bar + gap / 2 };
};

export const NameCard = ({ t, frame }) => {
  const st = state(t);
  if (st.o <= 0.002) return null;
  const Lx = letters();
  const lettersW = Lx.ws.reduce((a, b) => a + b, 0);
  const lockW = 40 + measure(`600 ${NFS * 0.9}px ${SERIF}`, '=') + 22 + measure(`700 ${NFS}px ${SERIF}`, '???') * 1.04 + 22 + 62;
  const goldW = measure(`700 104px ${SERIF}`, 'SON') + measure(`700 104px ${SERIF}`, 'FATHER') + 9 * 104 * 0.06 + measure(`italic 600 62px ${SERIF}`, 'of the') + 52;
  const unlock = ease.inOut((t - E.lockBreak) / 0.6);
  const shift = (lockW / 2) * (1 - unlock);
  // in the centre the locked line must fit the frame; the bare name can be full size
  const fitC = lerp(Math.min(1, 930 / (lettersW + lockW)), 1, unlock);
  const sc = st.s * (st.glass < 0.99 && st.reform < 0.5 ? lerp(1, fitC, 1 - st.glass) : 1);
  const boxW = (st.reform > 0.5 ? goldW : lettersW + lockW) + 150;
  const [jx, jy] = st.shakeK > 0.01 ? shake(frame, 11, 14 * st.shakeK) : [0, 0];
  const goldC = '#f2c463', cream = '#f6ecd8';
  const W = 1000, Hh = 300;
  const reformed = st.reform;
  return (
    <div style={{ position: 'absolute', left: st.x - W / 2 + jx, top: st.y - Hh / 2 + jy, width: W, height: Hh, opacity: st.o, transform: `scale(${sc})`, transformOrigin: '50% 50%' }}>
      {/* soft glow behind */}
      <div style={{ position: 'absolute', left: -120, right: -120, top: -110, bottom: -110, borderRadius: '50%', background: `radial-gradient(ellipse 50% 46% at 50% 50%, rgba(255,186,80,${0.32 * st.glow * (0.6 + 0.4 * st.gold)}) 0%, rgba(255,186,80,0) 70%)` }} />
      <div style={{ position: 'absolute', left: -60, right: -60, top: -80, bottom: -80, borderRadius: '50%', background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(6,4,3,${0.55 * (1 - st.glass)}) 0%, rgba(6,4,3,0) 72%)` }} />
      {/* the glass card (docked) */}
      {st.glass > 0.01 ? (
        <div style={{ position: 'absolute', left: W / 2 - boxW / 2, width: boxW, top: 62, bottom: 62, borderRadius: 88, opacity: st.glass, background: 'linear-gradient(180deg, rgba(30,22,15,0.86), rgba(12,9,6,0.88))',
          border: `3px solid rgba(244,199,102,${0.75 + 0.25 * Math.sin(t * 2.2)})`, boxShadow: `0 22px 60px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,232,180,0.2), 0 0 ${40 + 30 * st.glow}px rgba(255,180,70,0.35)` }} />
      ) : null}
      {/* BARABBAS letters (fade out on the re-form) */}
      <div style={{ position: 'absolute', left: W / 2, top: Hh / 2, opacity: 1 - reformed, filter: reformed > 0.02 ? `blur(${(reformed * 10).toFixed(1)}px)` : 'none', transform: `translateY(${-reformed * 30}px)` }}>
        {NAME.split('').map((ch, i) => {
          const isS = i === 7;
          const x = lerp(Lx.intact[i], Lx.split[i], st.split) - shift;
          const o = isS ? 1 - st.sFade * 0.92 : 1;
          const sc = isS ? 1 - 0.4 * st.sFade : 1;
          const col = mixHex(cream, goldC, (i < 3 ? st.son : i < 7 ? st.father : 0) * 0.8);
          return <span key={i} style={{ position: 'absolute', left: x, top: 0, transform: `translate(-50%, -54%) scale(${sc})`, font: nameFont, color: col, opacity: o, whiteSpace: 'nowrap',
            textShadow: `0 0 26px rgba(255,190,90,${0.35 + 0.3 * st.glow}), 0 4px 16px rgba(0,0,0,0.6)` }}>{ch}</span>;
        })}
        {/* = ??? and the lock (gone when the lock breaks) */}
        {st.locked > 0.01 ? <Locked t={t} k={st.locked} crack={st.crack} x={Lx.intact[7] + Lx.ws[7] / 2 - shift + 40} /> : null}
        {/* the divider + the tags */}
        {st.split > 0.01 ? <div style={{ position: 'absolute', left: Lx.divider - 1.5, top: -78, width: 3, height: 150 * st.split, borderRadius: 2, background: 'linear-gradient(180deg, rgba(244,199,102,0), #f4c766, rgba(244,199,102,0))', opacity: st.split }} /> : null}
        <Tag k={st.son} x={Lx.barC} text="SON" t={t} t0={E.tagSon} />
        <Tag k={st.father} x={Lx.abbaC} text="FATHER" t={t} t0={E.tagFather} />
      </div>
      {/* SON OF THE FATHER (gold) */}
      {reformed > 0.01 ? <Gold k={reformed} gold={st.gold} t={t} cx={W / 2} cy={Hh / 2} /> : null}
    </div>
  );
};

// "= ???" + a tiny padlock; it trembles, cracks and its two halves fly off when the lock breaks
function Locked({ t, k, crack, x }) {
  const age = t - E.lockBreak, fly = clamp(age / 0.5), q = 0.65 + 0.35 * Math.sin(t * 3.1);
  const tr = crack > 0 && crack < 1 ? (hash01(Math.floor(t * 60), 3) - 0.5) * 6 : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: 0, transform: 'translate(0, -54%)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 22 }}>
      <span style={{ font: `600 ${NFS * 0.9}px ${SERIF}`, color: 'rgba(246,236,216,0.85)', opacity: k }}>=</span>
      <span style={{ font: `700 ${NFS}px ${SERIF}`, color: C.gold, opacity: k, letterSpacing: '0.04em', textShadow: `0 0 ${18 + 16 * q}px rgba(255,190,80,${0.5 + 0.4 * q})` }}>???</span>
      <svg width="62" height="78" viewBox="0 0 62 78" style={{ overflow: 'visible', transform: `translate(${tr}px, 6px)` }}>
        {/* shackle halves (fly apart on the break) */}
        <g transform={`translate(${-34 * fly}, ${-40 * fly + 50 * fly * fly}) rotate(${-50 * fly} 18 30)`} opacity={1 - fly}>
          <path d="M 14 34 L 14 22 Q 14 8 31 8" stroke="#e9c06a" strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
        <g transform={`translate(${36 * fly}, ${-36 * fly + 50 * fly * fly}) rotate(${55 * fly} 44 30)`} opacity={1 - fly}>
          <path d="M 31 8 Q 48 8 48 22 L 48 34" stroke="#e9c06a" strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
        <g opacity={1 - fly * 0.9} transform={`translate(0, ${30 * fly * fly})`}>
          <rect x="6" y="32" width="50" height="40" rx="8" fill="#c9962e" stroke="#ffe0a0" strokeWidth="2.5" />
          <circle cx="31" cy="49" r="5" fill="#3a2410" /><rect x="29" y="51" width="4" height="10" rx="2" fill="#3a2410" />
          {crack > 0 ? <path d={`M 31 32 L 27 44 L 34 50 L 28 62 L 33 72`} stroke="#fff4d0" strokeWidth={2 + 2 * crack} fill="none" opacity={crack} /> : null}
        </g>
        {/* the flash of the break */}
        {age > 0 && age < 0.6 ? <circle cx="31" cy="40" r={20 + 120 * age} fill="none" stroke={`rgba(255,236,190,${0.9 * (1 - age / 0.6)})`} strokeWidth={6 * (1 - age / 0.6)} /> : null}
      </svg>
    </div>
  );
}

function Tag({ k, x, text, t, t0 }) {
  if (k <= 0.01) return null;
  const p = pop(t, t0, 0.18, 13, 6);
  return (
    <div style={{ position: 'absolute', left: x, top: 64, transform: `translate(-50%, ${(1 - k) * -18}px) scale(${1 + p})`, opacity: k, textAlign: 'center', whiteSpace: 'nowrap' }}>
      <div style={{ width: 2, height: 22 * k, margin: '0 auto 6px', background: 'linear-gradient(180deg, rgba(244,199,102,0.2), #f4c766)' }} />
      <div style={{ font: `700 62px ${SERIF}`, letterSpacing: '0.12em', marginRight: '-0.12em', color: '#f6c867', textShadow: '0 0 22px rgba(255,180,70,0.75), 0 3px 10px rgba(0,0,0,0.6)' }}>{text}</div>
      <div style={{ font: `700 19px ${SANS}`, letterSpacing: '0.3em', marginRight: '-0.3em', color: 'rgba(246,236,216,0.82)', marginTop: 2 }}>{text === 'SON' ? 'BAR' : 'ABBA'}</div>
    </div>
  );
}

// SON  of the  FATHER — the gold lockup; a sheen + sparks on the big hit
function Gold({ k, gold, t, cx, cy }) {
  const age = t - E.goldName;
  const burst = age > 0 && age < 1.2 ? 1 - age / 1.2 : 0;
  const sheen = (age - 0.15) / 0.8;
  const big = `700 104px ${SERIF}`, small = `italic 600 62px ${SERIF}`;
  const col = mixHex('#f6ecd8', '#f6c867', 0.4 + 0.6 * gold);
  const glow = `0 0 ${30 + 40 * gold + 60 * burst}px rgba(255,180,70,${0.55 + 0.35 * gold}), 0 4px 18px rgba(0,0,0,0.55)`;
  const line = (
    <>
      <span style={{ font: big, letterSpacing: '0.06em' }}>SON</span>
      <span style={{ font: small, margin: '0 26px', color: mixHex('#f6ecd8', '#ffe2a0', gold) }}>of the</span>
      <span style={{ font: big, letterSpacing: '0.06em' }}>FATHER</span>
    </>
  );
  return (
    <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -52%) translateY(${(1 - k) * 34}px) scale(${lerp(0.92, 1, k) * (1 + pop(t, E.goldName, 0.1, 12, 6))})`, opacity: k, whiteSpace: 'nowrap', color: col, textShadow: glow }}>
      <div style={{ position: 'relative' }}>
        {line}
        {sheen > 0 && sheen < 1 ? (
          <div style={{ position: 'absolute', inset: 0, color: '#fffbea', textShadow: 'none', clipPath: `inset(-10% ${clamp(100 - (sheen * 140 - 20) - 18, 0, 100)}% -10% ${clamp(sheen * 140 - 20, 0, 100)}%)` }}>{line}</div>
        ) : null}
      </div>
      {burst > 0 ? Array.from({ length: 18 }, (_, i) => {
        const a = hash01(i, 5) * Math.PI * 2, r = 140 + 420 * (1 - burst) * (0.5 + hash01(i, 6));
        return <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 7, height: 7, borderRadius: 4, background: '#ffe6a6', boxShadow: '0 0 10px rgba(255,200,90,0.95)',
          transform: `translate(${Math.cos(a) * r * 1.4}px, ${Math.sin(a) * r * 0.6}px)`, opacity: burst }} />;
      }) : null}
    </div>
  );
}

// ---------------------------------------------------------------- S8: the shout — a huge shaking BARABBAS
export const BarabbasSlam = ({ t, frame }) => {
  const a = E.shout - 0.06;
  if (t < a || t > E.freeze + 0.4) return null;
  const age = t - E.shout;
  const inK = clamp((t - a) / 0.08), out = clamp((t - E.freeze) / 0.35);
  const sc = age < 0 ? 1.7 : 1 + 0.7 * Math.exp(-14 * age) * Math.cos(9 * age) - 0.06 * clamp(age / 1.2);
  const live = t < E.silence ? 1 : 0.25;                        // the shaking stops in the near silence
  const [sx, sy] = shake(frame, 23, (22 * Math.exp(-2.5 * Math.max(0, age)) + 4) * live);
  const fs = 168, word = 'BARABBAS';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 860, height: 300, opacity: inK * (1 - out), transform: `translate(${sx}px, ${sy}px) scale(${sc})`, transformOrigin: '540px 150px',
      filter: out > 0.02 ? `blur(${(out * 8).toFixed(1)}px)` : 'none' }}>
      <div style={{ position: 'absolute', left: -60, right: -60, top: -60, bottom: -60, background: 'radial-gradient(ellipse 50% 45% at 50% 50%, rgba(20,10,4,0.55) 0%, rgba(20,10,4,0) 75%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 50, textAlign: 'center', whiteSpace: 'nowrap' }}>
        {word.split('').map((ch, i) => {
          const j = shake(frame + i * 7, 29 + i, 5 * live);
          return <span key={i} style={{ display: 'inline-block', font: `800 ${fs}px ${SERIF}`, color: '#fbeedb', letterSpacing: '0.02em', transform: `translate(${j[0]}px, ${j[1]}px) rotate(${(hash01(i, 4) - 0.5) * 6 * live}deg)`,
            WebkitTextStroke: '3px #2a160a', textShadow: `0 0 ${40 * Math.exp(-3 * Math.max(0, age)) + 12}px rgba(255,170,60,0.75), 0 10px 28px rgba(0,0,0,0.7)` }}>{ch}</span>;
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- S5a-c: the memories glow at the edges
export const MemoryGlow = ({ t }) => {
  const a = E.mem1 - 0.15, b = S.S6.t0;
  if (t < a || t > b) return null;
  const k = clamp((t - a) / 0.25) * (1 - clamp((t - (b - 0.12)) / 0.12));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: k }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 62% 54% at 50% 46%, rgba(255,246,226,0) 58%, rgba(255,240,210,0.55) 82%, rgba(255,236,200,0.9) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at ${30 + 20 * Math.sin(t * 0.9)}% 18%, rgba(255,226,170,0.28) 0%, rgba(255,226,170,0) 35%)`, mixBlendMode: 'screen' }} />
    </div>
  );
};

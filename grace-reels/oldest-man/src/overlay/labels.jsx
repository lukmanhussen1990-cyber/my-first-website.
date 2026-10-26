// World-anchored labels with leader lines (projected every frame with the engine's own camera via
// cameraShot), the screen-fixed "some say" note (S10) and the S2 life-ribbon.
// Draw-on: the dot pops, the leader grows, the pill slides out of the line. Pills are clamped inside
// the IG safe zone and kept clear of the captions band and the math tracker.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { anchorAt } from '../lib/director.js';
import { shotAt } from '../plan.js';
import { C, SERIF, SANS, SAFE, ease, pop, clamp, lerp, hash01, measure, project, shotById } from './theme.js';
import { TRACK } from './tracker.jsx';

const E = plan.ev;
const beat = (id) => plan.beats[id];
const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));

// kind: 'pill' (NAME · REF on one line), 'name' (big serif name + small gold line), 'quote' (gold ref + quote line)
export const LABELS = [
  { id: 'name', shots: ['S2'], set: 'hill', anchor: 'methuselahHead', from: E.nameLabel + 0.1, to: S.S2.t1 - 0.12, kind: 'name',
    a: 'METHUSELAH', b: '969 YEARS · GENESIS 5:27', dx: 170, dy: -210, fallback: [540, 980] },
  { id: 'g525', shots: ['S5'], set: 'family', anchor: 'methuselah', from: beat('B06').start + 0.15, to: S.S5.t1 - 0.1, kind: 'pill',
    a: 'METHUSELAH', b: 'GENESIS 5:25', dx: 150, dy: -190, fallback: [540, 1180] },
  { id: 'g528', shots: ['S6'], set: 'family', anchor: 'lamech', from: beat('B07').start + 0.12, to: S.S6.t1 - 0.1, kind: 'pill',
    a: 'LAMECH', b: 'GENESIS 5:28–29', dx: -150, dy: -190, fallback: [540, 1180] },
  { id: 'g76', shots: ['S7'], set: 'ark', anchor: 'noah', from: beat('B08').start + 0.08, to: S.S7.t1 - 0.06, kind: 'pill',
    a: 'NOAH', b: 'GENESIS 7:6', dx: 150, dy: -190, fallback: [540, 1180] },
  { id: 'year', shots: ['S8', 'S9'], set: 'hill', anchor: { S8: 'n969', S9: 'lamp' }, from: E.yearLabel, to: E.lampOut + 0.7, kind: 'pill',
    a: 'THE YEAR HE DIED', b: 'GENESIS 5:27', dx: 0, dy: 300, fallback: [540, 1240] },
  { id: 'heaven', shots: ['S12'], set: 'ark', anchor: 'sky', from: E.floodCrack + 0.3, to: S.S12.t1 - 0.1, kind: 'quote', yMin: 300,
    a: 'GENESIS 7:11', b: '“…THE WINDOWS OF HEAVEN WERE OPENED.”', dx: 0, dy: 210, fallback: [540, 560] },
];

const PILL_A = `700 23px ${SANS}`, PILL_LS = 0.16;
function geom(Lb) {
  if (Lb.kind === 'name') {
    const wa = measure(`700 46px ${SERIF}`, Lb.a) + Lb.a.length * 46 * 0.1, wb = measure(`700 18px ${SANS}`, Lb.b) + Lb.b.length * 18 * 0.2;
    return { w: Math.max(wa, wb) + 60, h: 104 };
  }
  if (Lb.kind === 'quote') {
    const wa = measure(`700 18px ${SANS}`, Lb.a) + Lb.a.length * 18 * 0.28, wb = measure(`600 23px ${SANS}`, Lb.b) + Lb.b.length * 23 * 0.1;
    return { w: Math.max(wa, wb) + 56, h: 92 };
  }
  const txt = `${Lb.a} · ${Lb.b}`;
  return { w: measure(PILL_A, txt) + txt.length * 23 * PILL_LS + 52, h: 54 };
}

export const Labels = ({ t }) => {
  const cur = shotAt(plan, t).shot;
  return <>{LABELS.map((Lb) => (Lb.shots.includes(cur.id) && t > Lb.from - 0.05 && t < Lb.to + 0.3 ? <Label key={Lb.id} Lb={Lb} t={t} cur={cur} /> : null))}</>;
};

function Label({ Lb, t, cur }) {
  const a = Lb.from, z = Lb.to;
  const o = clamp((t - a) / 0.2) * clamp((z - t) / 0.25);
  if (o <= 0) return null;
  const name = typeof Lb.anchor === 'string' ? Lb.anchor : Lb.anchor[cur.id];
  const A = name ? project(cur, t, anchorAt(plan, Lb.set, name, t)) : null;
  const { w, h } = geom(Lb);
  const trackOn = t > TRACK.t0 && t < TRACK.t1;
  const yMin = Lb.yMin ?? (trackOn ? 800 : 660);
  // anchors inside the captions band / tracker zone get no dot or leader (never draw over them)
  const useA = A && A.on && A.y > yMin - 10 && A.y < 1560;
  let cx = useA ? A.x + Lb.dx : Lb.fallback[0], cy = useA ? A.y + Lb.dy : Lb.fallback[1];
  cy = clamp(cy, yMin + h / 2, 1480 - h / 2);
  const inIG = cy + h / 2 > SAFE.igY0;
  cx = clamp(cx, SAFE.x0 + 10 + w / 2, (inIG ? SAFE.igX : SAFE.x1 - 10) - w / 2);
  const bx = cx - w / 2, by = cy - h / 2;
  // nearest point of the pill box towards the anchor
  let ex = cx, ey = cy, line = false;
  if (useA) {
    ex = clamp(A.x, bx + 18, bx + w - 18); ey = clamp(A.y, by, by + h);
    if (A.y > by && A.y < by + h) ex = A.x < cx ? bx : bx + w;
    line = Math.hypot(ex - A.x, ey - A.y) > 40;
  }
  const dotK = ease.back((t - a) / 0.28, 2.2);
  const draw = ease.out((t - a - 0.08) / 0.32);
  const reveal = ease.out((t - a - 0.28) / 0.38);
  const lx = useA ? lerp(A.x, ex, draw) : ex, ly = useA ? lerp(A.y, ey, draw) : ey;
  const ring = ((t - a) * 0.9) % 1;
  // pill slides out of the line end
  const fromSide = !useA ? 'c' : Math.abs(ey - by) < 1 ? 't' : Math.abs(ey - by - h) < 1 ? 'b' : ex <= bx + 1 ? 'l' : 'r';
  const clip = fromSide === 'l' ? `inset(0 ${100 - reveal * 100}% 0 0 round 14px)` : fromSide === 'r' ? `inset(0 0 0 ${100 - reveal * 100}% round 14px)`
    : fromSide === 't' ? `inset(0 ${50 - reveal * 50}% ${100 - reveal * 100}% ${50 - reveal * 50}% round 14px)` : fromSide === 'b' ? `inset(${100 - reveal * 100}% ${50 - reveal * 50}% 0 ${50 - reveal * 50}% round 14px)`
      : `inset(0 ${50 - reveal * 50}% 0 ${50 - reveal * 50}% round 14px)`;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      {useA ? (
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {line ? <line x1={A.x} y1={A.y} x2={lx} y2={ly} stroke="rgba(0,0,0,0.35)" strokeWidth="5" strokeLinecap="round" /> : null}
          {line ? <line x1={A.x} y1={A.y} x2={lx} y2={ly} stroke="rgba(255,240,210,0.95)" strokeWidth="2.2" strokeLinecap="round" /> : null}
          <circle cx={A.x} cy={A.y} r={16 + 22 * ring} fill="none" stroke={`rgba(244,199,102,${0.75 * (1 - ring) * clamp(dotK)})`} strokeWidth="2" />
          <circle cx={A.x} cy={A.y} r={Math.max(0, 8 * dotK)} fill={C.gold} stroke="#fff6e0" strokeWidth="2.5" />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: bx, top: by, width: w, height: h, clipPath: clip, transform: `translate(${(1 - reveal) * (fromSide === 'l' ? -14 : fromSide === 'r' ? 14 : 0)}px, 0)` }}>
        <Plate Lb={Lb} w={w} h={h} t={t} a={a} />
      </div>
    </div>
  );
}

function Plate({ Lb, w, h, t, a }) {
  const base = { position: 'absolute', inset: 0, borderRadius: 14, background: 'linear-gradient(180deg, rgba(26,18,12,0.86), rgba(14,10,7,0.86))', border: '1.5px solid rgba(244,199,102,0.75)',
    boxShadow: '0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,232,180,0.18)' };
  const sheen = (t - a - 0.6) / 0.7;
  const sh = sheen > 0 && sheen < 1 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden' }}><div style={{ position: 'absolute', top: '-60%', left: `${lerp(-40, 130, sheen)}%`, width: '22%', height: '220%', transform: 'rotate(18deg)', background: 'linear-gradient(90deg, rgba(255,240,200,0), rgba(255,240,200,0.22), rgba(255,240,200,0))' }} /></div> : null;
  if (Lb.kind === 'name') return (
    <div style={base}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', font: `700 46px/52px ${SERIF}`, letterSpacing: '0.1em', color: '#fbf1dc', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{Lb.a}</div>
      <div style={{ position: 'absolute', left: '22%', right: '22%', top: 66, height: 1, background: 'linear-gradient(90deg, rgba(244,199,102,0), rgba(244,199,102,0.8), rgba(244,199,102,0))' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 74, textAlign: 'center', font: `700 18px/20px ${SANS}`, letterSpacing: '0.2em', color: C.gold, whiteSpace: 'nowrap' }}>{Lb.b}</div>
      {sh}
    </div>
  );
  if (Lb.kind === 'quote') return (
    <div style={base}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', font: `700 18px/22px ${SANS}`, letterSpacing: '0.28em', color: C.gold, whiteSpace: 'nowrap' }}>{Lb.a}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 46, textAlign: 'center', font: `600 23px/30px ${SANS}`, letterSpacing: '0.1em', color: '#fbf1dc', whiteSpace: 'nowrap' }}>{Lb.b}</div>
      {sh}
    </div>
  );
  return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${PILL_A}`, letterSpacing: `${PILL_LS}em`, whiteSpace: 'nowrap' }}>
      <span style={{ color: '#fbf1dc' }}>{Lb.a}</span><span style={{ color: 'rgba(244,199,102,0.9)', margin: '0 0.5em' }}>{'·'}</span><span style={{ color: C.gold }}>{Lb.b}</span>
      {sh}
    </div>
  );
}

// ------------------------------------------------------------------ S10: "SOME SAY" note (screen-fixed, soft)
const S10 = S.S10;
export const SomeSay = ({ t }) => {
  const a = E.nameMeaning, z = S10.t1 - 0.1;
  if (t < a - 0.05 || t > z + 0.05) return null;
  const o = clamp((t - a) / 0.35) * clamp((z - t) / 0.3);
  const k1 = ease.out((t - a) / 0.5), k2 = ease.out((t - a - 0.25) / 0.6), k3 = ease.out((t - a - 1.0) / 0.6);
  const quote = '“WHEN HE DIES, IT SHALL BE SENT”';
  const qw = Math.min(900, measure(`700 42px ${SERIF}`, quote) + quote.length * 42 * 0.06 + 70);
  const cy = 1200, drift = 6 * Math.sin(t * 0.8);
  return (
    <div style={{ position: 'absolute', left: 540 - qw / 2, top: cy - 100 + drift, width: qw, height: 200, opacity: o }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: 'radial-gradient(ellipse at 50% 50%, rgba(12,14,18,0.78) 0%, rgba(12,14,18,0.62) 60%, rgba(12,14,18,0.0) 100%)', transform: `scaleX(${lerp(0.7, 1, k1)})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, opacity: k1 }}>
        <div style={{ width: 70 * k1, height: 1.5, background: 'linear-gradient(90deg, rgba(244,199,102,0), rgba(244,199,102,0.9))' }} />
        <div style={{ font: `700 19px ${SANS}`, letterSpacing: '0.34em', color: C.gold }}>SOME SAY:</div>
        <div style={{ width: 70 * k1, height: 1.5, background: 'linear-gradient(90deg, rgba(244,199,102,0.9), rgba(244,199,102,0))' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 60, textAlign: 'center', font: `700 42px/56px ${SERIF}`, letterSpacing: '0.06em', color: '#f3efe6', whiteSpace: 'nowrap',
        opacity: k2, transform: `translateY(${(1 - k2) * 10}px)`, textShadow: '0 2px 14px rgba(0,0,0,0.6), 0 0 24px rgba(190,210,235,0.25)' }}>{quote}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 124, textAlign: 'center', font: `italic 600 35px/42px ${SERIF}`, color: 'rgba(243,239,230,0.82)', opacity: k3, transform: `translateY(${(1 - k3) * 8}px)` }}>(meaning debated)</div>
    </div>
  );
};

// ------------------------------------------------------------------ S2: life-ribbon (0 ... 969), synced to "He lived 969 years"
const RB = { x0: 110, x1: 930, y: 1372 };
export const LifeRibbon = ({ t, frame }) => {
  const a = E.ribbon - 0.05, end = S.S2.t1 - 0.05;
  if (t < a || t > end) return null;
  const dEnd = E.ribbon969 + 1.35;                       // the line reaches 969 as the word ends
  const p = ease.inOut((t - E.ribbon) / (dEnd - E.ribbon));
  const o = clamp((t - a) / 0.15) * clamp((end - t) / 0.2);
  const hx = lerp(RB.x0, RB.x1, p);
  const yrs = Math.round(969 * p);
  const done = t >= dEnd;
  const popK = pop(t, dEnd, 0.3, 13, 6);
  const shimmer = ((t - dEnd) / 1.2) % 1;
  const ticks = Array.from({ length: 10 }, (_, i) => i * 100);
  const X = (yr) => lerp(RB.x0, RB.x1, yr / 969);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      {/* soft shadow band so it reads over the close-up */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: RB.y - 90, height: 180, background: 'linear-gradient(180deg, rgba(5,6,12,0), rgba(5,6,12,0.38) 50%, rgba(5,6,12,0))' }} />
      {/* ticks */}
      {ticks.map((yr, i) => {
        const x = X(yr); const vis = clamp((hx - x) / 30);
        return <div key={i} style={{ position: 'absolute', left: x - 0.75, top: RB.y + 8, width: 1.5, height: yr % 500 === 0 ? 16 : 9, background: 'rgba(255,226,160,0.7)', opacity: vis }} />;
      })}
      <div style={{ position: 'absolute', left: RB.x0 - 40, width: 80, top: RB.y + 28, textAlign: 'center', font: `700 16px ${SANS}`, letterSpacing: '0.2em', color: 'rgba(255,236,200,0.75)', opacity: clamp((t - a) / 0.3) }}>BORN</div>
      <div style={{ position: 'absolute', left: X(500) - 40, width: 80, top: RB.y + 28, textAlign: 'center', font: `600 16px ${SANS}`, letterSpacing: '0.12em', color: 'rgba(255,236,200,0.55)', opacity: clamp((hx - X(500)) / 40) }}>500</div>
      {/* the line: wide glow, glow, core */}
      <div style={{ position: 'absolute', left: RB.x0, top: RB.y - 1.5, width: hx - RB.x0, height: 3, borderRadius: 3, background: 'linear-gradient(90deg, rgba(255,214,130,0.55), #ffe6a6 30%, #fff2cf)',
        boxShadow: '0 0 8px 1px rgba(255,200,90,0.9), 0 0 26px 5px rgba(255,170,60,0.4)' }} />
      {done && shimmer > 0 ? <div style={{ position: 'absolute', left: lerp(RB.x0, RB.x1, shimmer) - 60, top: RB.y - 3, width: 120, height: 6, borderRadius: 6, background: 'radial-gradient(ellipse, rgba(255,255,240,0.9), rgba(255,255,240,0) 70%)' }} /> : null}
      {/* the moving head: spark + counter */}
      <div style={{ position: 'absolute', left: hx - 40, top: RB.y - 40, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,250,230,1) 0%, rgba(255,210,120,0.75) 14%, rgba(255,170,60,0.0) 60%)' }} />
      <div style={{ position: 'absolute', left: hx - 70, top: RB.y - 2, width: 140, height: 4, background: 'linear-gradient(90deg, rgba(255,240,200,0), rgba(255,250,230,0.95), rgba(255,240,200,0))' }} />
      {Array.from({ length: 8 }, (_, k) => {
        const age = ((t * 1.6 + hash01(k, 7)) % 1); const x = hx - 30 * age - 10 * hash01(k, 8); const y = RB.y - 6 - 46 * age * (0.6 + hash01(k, 9));
        return p < 0.995 ? <div key={k} style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, borderRadius: 2, background: '#ffe2a0', opacity: (1 - age) * 0.9, boxShadow: '0 0 6px rgba(255,190,80,0.9)' }} /> : null;
      })}
      <div style={{ position: 'absolute', left: Math.min(hx, 850) - 120, width: 240, top: RB.y - 84, textAlign: 'center', whiteSpace: 'nowrap', transform: `scale(${1 + popK})`, transformOrigin: '50% 80%' }}>
        <span style={{ font: `700 52px/56px ${SERIF}`, color: done ? C.gold : '#fff2d6', fontVariantNumeric: 'lining-nums tabular-nums', textShadow: `0 0 ${done ? 26 : 12}px rgba(255,180,70,0.8), 0 2px 8px rgba(0,0,0,0.6)` }}>{yrs}</span>
        <span style={{ font: `700 18px ${SANS}`, letterSpacing: '0.2em', color: 'rgba(255,236,200,0.85)', marginLeft: 10, opacity: done ? 1 : 0.6 }}>YEARS</span>
      </div>
    </div>
  );
};

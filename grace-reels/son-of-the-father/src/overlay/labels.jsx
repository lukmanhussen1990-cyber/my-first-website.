// World-anchored labels with leader lines (projected every frame with the engine's own camera via
// cameraShot). Draw-on: the dot pops, the leader grows, the pill slides out of the line. Pills are clamped inside
// the IG safe zone and kept clear of the captions band and the name card under it.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { anchorAt } from '../lib/director.js';
import { shotAt } from '../plan.js';
import { C, L, SERIF, SANS, SAFE, ease, pop, clamp, lerp, hash01, measure, project } from './theme.js';

const E = plan.ev;
const beat = (id) => plan.beats[id];
const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));

// kind: 'pill' (NAME · REF on one line), 'name' (big serif name + small gold line), 'quote' (gold ref + quote line)
export const LABELS = [
  { id: 'jesus', shots: ['S1'], set: 'court', anchor: 'jesusHead', from: Math.max(E.jesusLabel, E.hookOut + 0.45), to: S.S1.t1 - 0.15, kind: 'name',
    a: 'JESUS', b: 'OF NAZARETH · JOHN 19:19', dx: 0, dy: 0, fallback: [540, 1330], yMin: 1250 },
  { id: 'barabbas', shots: ['S2'], set: 'court', anchor: 'barabbasHead', from: E.barabbasLabel, to: S.S2.t1 - 0.12, kind: 'name',
    a: 'BARABBAS', b: 'A NOTABLE PRISONER · MATTHEW 27:16', dx: 0, dy: 0, fallback: [540, 1330], yMin: 1250 },
  { id: 'passover', shots: ['S3'], set: 'court', anchor: 'crowd', from: E.passover, to: S.S3.t1 - 0.12, kind: 'pill',
    a: 'PASSOVER CUSTOM', b: 'JOHN 18:39', dx: 0, dy: 160, fallback: [540, 1240] },
  { id: 'pilate', shots: ['S4'], set: 'court', anchor: 'pilateHead', from: E.pilateLabel, to: S.S4.t1 - 0.1, kind: 'pill',
    a: 'PONTIUS PILATE', b: 'MATTHEW 27:2', dx: 0, dy: -170, fallback: [540, 900] },
  { id: 'riot', shots: ['S6'], set: 'riot', anchor: 'barabbas', from: E.riotLabel, to: S.S6.t1 - 0.12, kind: 'pill',
    a: 'THE INSURRECTION', b: 'MARK 15:7', dx: 0, dy: 330, fallback: [540, 1300] },
  { id: 'whisper', shots: ['S7b'], set: 'court', anchor: 'whisper', from: E.whisper + 0.3, to: S.S7b.t1 - 0.1, kind: 'pill', yMin: 1000,
    a: 'WHISPERS IN THE CROWD', b: 'MARK 15:11', dx: 0, dy: 260, fallback: [540, 1240] },
];

const PILL_FS = 26, PILL_A = `700 ${PILL_FS}px ${SANS}`, PILL_LS = 0.16;
const NAME_B = 22, QUOTE_A = 22, QUOTE_B = 25;
function geom(Lb) {
  if (Lb.kind === 'name') {
    const wa = measure(`700 46px ${SERIF}`, Lb.a) + Lb.a.length * 46 * 0.1, wb = measure(`700 ${NAME_B}px ${SANS}`, Lb.b) + Lb.b.length * NAME_B * 0.2;
    return { w: Math.max(wa, wb) + 64, h: 110 };
  }
  if (Lb.kind === 'quote') {
    const wa = measure(`700 ${QUOTE_A}px ${SANS}`, Lb.a) + Lb.a.length * QUOTE_A * 0.28, wb = measure(`600 ${QUOTE_B}px ${SANS}`, Lb.b) + Lb.b.length * QUOTE_B * 0.08;
    return { w: Math.max(wa, wb) + 60, h: 98 };
  }
  const txt = `${Lb.a} · ${Lb.b}`;
  return { w: measure(PILL_A, txt) + txt.length * PILL_FS * PILL_LS + 56, h: 54 };
}

export const Labels = ({ t }) => {
  const cur = shotAt(plan, t).shot;
  return <>{LABELS.map((Lb) => (Lb.shots.includes(cur.id) && t > Lb.from - 0.05 && t < Lb.to + 0.3 ? <Label key={Lb.id} Lb={Lb} t={t} cur={cur} /> : null))}</>;
};

// where the pill goes in a given shot at time t (anchor projected with that shot's camera)
function place(Lb, shot, t) {
  const name = typeof Lb.anchor === 'string' ? Lb.anchor : Lb.anchor[shot.id];
  const A = name ? project(shot, t, anchorAt(plan, Lb.set, name, t)) : null;
  const { w, h } = geom(Lb);
  const yMin = Lb.yMin ?? L.labelMinY;
  // anchors inside the captions band / tracker zone get no dot or leader (never draw over them)
  const useA = !!(A && A.on && A.y > yMin - 10 && A.y < 1560);
  let cx = useA ? A.x + Lb.dx : Lb.fallback[0], cy = useA ? A.y + Lb.dy : Lb.fallback[1];
  cy = clamp(cy, yMin + h / 2, (Lb.yMax ?? 1480) - h / 2);
  const inIG = cy + h / 2 > SAFE.igY0;
  cx = clamp(cx, SAFE.x0 + 10 + w / 2, (inIG ? SAFE.igX : SAFE.x1 - 10) - w / 2);
  return { A, useA, cx, cy, w, h };
}

function Label({ Lb, t, cur }) {
  const a = Lb.from, z = Lb.to;
  const o = clamp((t - a) / 0.2) * clamp((z - t) / 0.25);
  if (o <= 0) return null;
  let P = place(Lb, cur, t);
  // the dot + leader draw from the label's start, or (in a later shot of the same label) from that cut,
  // while the pill glides from where it sat at the end of the previous shot
  let aa = a, first = true;
  const si = Lb.shots.indexOf(cur.id);
  if (si > 0 && a < cur.t0) {
    const prev = S[Lb.shots[si - 1]];
    const Q = place(Lb, prev, prev.t1 - 1e-3);
    const g = ease.inOut((t - cur.t0) / 0.42);
    P = { ...P, cx: lerp(Q.cx, P.cx, g), cy: lerp(Q.cy, P.cy, g) };
    aa = Math.max(a, cur.t0 + 0.12); first = false;
  }
  const { A, useA, cx, cy, w, h } = P;
  const bx = cx - w / 2, by = cy - h / 2;
  // nearest point of the pill box towards the anchor (no dot when the anchor sits under the pill)
  const under = useA && A.x > bx - 12 && A.x < bx + w + 12 && A.y > by - 12 && A.y < by + h + 12;
  const showA = useA && !under;
  let ex = cx, ey = cy, line = false;
  if (showA) {
    ex = clamp(A.x, bx + 18, bx + w - 18); ey = clamp(A.y, by, by + h);
    if (A.y > by && A.y < by + h) ex = A.x < cx ? bx : bx + w;
    line = Math.hypot(ex - A.x, ey - A.y) > 40;
  }
  const dotK = ease.back((t - aa) / 0.28, 2.2);
  const draw = ease.out((t - aa - 0.08) / 0.32);
  // without a dot + leader the pill does not wait for them
  const reveal = first ? ease.out((t - a - (showA ? 0.28 : 0.05)) / 0.38) : 1;
  const lx = showA ? lerp(A.x, ex, draw) : ex, ly = showA ? lerp(A.y, ey, draw) : ey;
  const ring = ((t - aa) * 0.9) % 1;
  // pill slides out of the line end
  const fromSide = !showA ? 'c' : Math.abs(ey - by) < 1 ? 't' : Math.abs(ey - by - h) < 1 ? 'b' : ex <= bx + 1 ? 'l' : 'r';
  const clip = fromSide === 'l' ? `inset(0 ${100 - reveal * 100}% 0 0 round 14px)` : fromSide === 'r' ? `inset(0 0 0 ${100 - reveal * 100}% round 14px)`
    : fromSide === 't' ? `inset(0 ${50 - reveal * 50}% ${100 - reveal * 100}% ${50 - reveal * 50}% round 14px)` : fromSide === 'b' ? `inset(${100 - reveal * 100}% ${50 - reveal * 50}% 0 ${50 - reveal * 50}% round 14px)`
      : `inset(0 ${50 - reveal * 50}% 0 ${50 - reveal * 50}% round 14px)`;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o }}>
      {showA && dotK > 0 ? (
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {line && draw > 0 ? <line x1={A.x} y1={A.y} x2={lx} y2={ly} stroke="rgba(0,0,0,0.35)" strokeWidth="5" strokeLinecap="round" /> : null}
          {line && draw > 0 ? <line x1={A.x} y1={A.y} x2={lx} y2={ly} stroke="rgba(255,240,210,0.95)" strokeWidth="2.2" strokeLinecap="round" /> : null}
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
      <div style={{ position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', font: `700 46px/52px ${SERIF}`, letterSpacing: '0.1em', textIndent: '0.1em', color: '#fbf1dc', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{Lb.a}</div>
      <div style={{ position: 'absolute', left: '22%', right: '22%', top: 68, height: 1, background: 'linear-gradient(90deg, rgba(244,199,102,0), rgba(244,199,102,0.8), rgba(244,199,102,0))' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 76, textAlign: 'center', font: `700 ${NAME_B}px/24px ${SANS}`, letterSpacing: '0.2em', textIndent: '0.2em', color: C.gold, whiteSpace: 'nowrap' }}>{Lb.b}</div>
      {sh}
    </div>
  );
  if (Lb.kind === 'quote') return (
    <div style={base}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', font: `700 ${QUOTE_A}px/26px ${SANS}`, letterSpacing: '0.28em', textIndent: '0.28em', color: C.gold, whiteSpace: 'nowrap' }}>{Lb.a}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 50, textAlign: 'center', font: `600 ${QUOTE_B}px/32px ${SANS}`, letterSpacing: '0.08em', textIndent: '0.08em', color: '#fbf1dc', whiteSpace: 'nowrap' }}>{Lb.b}</div>
      {sh}
    </div>
  );
  return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${PILL_A}`, letterSpacing: `${PILL_LS}em`, paddingLeft: `${PILL_LS}em`, boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#fbf1dc' }}>{Lb.a}</span><span style={{ color: 'rgba(244,199,102,0.9)', margin: '0 0.5em' }}>{'·'}</span><span style={{ color: C.gold }}>{Lb.b}</span>
      {sh}
    </div>
  );
}

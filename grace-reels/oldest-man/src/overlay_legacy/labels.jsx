// World-anchored labels with leader lines. Anchors are pure functions of time from the director, and
// are projected with the very camera the 3D engine uses (cameraShot), so they stick during moves.
// Also the NABOTH name tag that cracks in two (1 Kings 21:13).
import React from 'react';
import * as THREE from 'three';
import { plan } from '../lib/planInstance.js';
import { blockingOf, cameraShot, SETS } from '../lib/director.js';
import { shotAt } from '../plan.js';
import { C, SANS, SERIF, ease, win } from './theme.js';
import { clamp, lerp, hash01 } from '../lib/util.js';

const B = blockingOf(plan); const E = plan.ev;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const at = (set, p) => add(SETS[set], p);
const beat = (id) => plan.beats[id];

const LABELS = [
  { text: 'PROVERBS 6:17', shot: 'S3', beat: 'B04', anchor: (t) => add(B.rich(t), [0.14, 2.0, 0]), dx: 150, dy: -170 },
  { text: 'PROVERBS 6:17', shot: 'S4', beat: 'B06', anchor: () => add(B.seller(), [0.12, 1.98, 0]), dx: 120, dy: -150, until: B.rackT + 0.3 },
  { text: 'PROVERBS 6:17', shot: 'S5b', beat: 'B07', anchor: () => add(B.flower(), [0, 0.52, 0]), dx: -170, dy: -190 },
  { text: 'PROVERBS 6:18', shot: 'S6a', beat: 'B08', anchor: () => add(B.benchMan(), [0.1, 1.62, 0]), dx: 150, dy: -170 },
  { text: 'SIN STARTS IN THE MIND', shot: 'S6b', beat: 'B08', anchor: () => at('mind', [0.0, 2.55, 0.25]), dx: -150, dy: 330, from: () => plan.word('B08', 'Sin').start - 0.1 },
  { text: 'PROVERBS 6:18', shot: 'S7', beat: 'B09', anchor: (t) => add(B.runner(t), [0.25, 2.0, 0.4]), dx: 130, dy: -190 },
  { text: 'PROVERBS 6:19', shot: 'S8', beat: 'B10', anchor: () => add(B.accuser(), [0.1, 2.02, 0]), dx: -60, dy: -210, until: B.crackT - 0.4 },
  { text: 'PROVERBS 6:19', shot: 'S10', beat: 'B12', anchor: (t) => add(B.whisperer(t), [0, 2.0, 0]), dx: 140, dy: -170 },
  { text: '1 JOHN 1:9', shot: 'S14b', beat: 'B17', anchor: () => at('village', [0, 1.3, 0]), dx: 150, dy: -220 },
];

const cam = new THREE.PerspectiveCamera(24, 1080 / 1920, 0.1, 1600);
const v = new THREE.Vector3();
export function project(shot, t, p) {
  const c = cameraShot(plan, shot, t);
  cam.fov = c.fov; cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  v.set(...p).project(cam);
  return { x: (v.x + 1) / 2 * 1080, y: (1 - v.y) / 2 * 1920, z: v.z };
}

export const Labels = ({ t }) => {
  const cur = shotAt(plan, t).shot;
  return (
    <>
      {LABELS.map((Lb, i) => {
        if (Lb.shot !== cur.id) return null;
        const b = beat(Lb.beat);
        const a = Math.max(cur.t0, Lb.from ? Lb.from() : b.start) + 0.25;
        const z = Math.min(cur.t1 - 0.05, Lb.until ?? b.end + 0.6);
        const o = win(t, a, z, 0.3, 0.2);
        if (o <= 0) return null;
        const A = project(cur, t, Lb.anchor(t));
        const draw = ease.out((t - a) / 0.35);
        const bw = Lb.text.length * 19 + 48;
        let bx = Lb.dx < 0 ? clamp(A.x + Lb.dx, 60 + bw, 1020) : clamp(A.x + Lb.dx, 60, 1020 - bw), by = clamp(A.y + Lb.dy, 800, 1480);
        const lx = lerp(A.x, bx, draw), ly = lerp(A.y, by, draw);
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: o }}>
            <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
              <line x1={A.x} y1={A.y} x2={lx} y2={ly} stroke="rgba(255,236,200,0.9)" strokeWidth="2.5" />
              <circle cx={A.x} cy={A.y} r={7} fill={C.gold} stroke="#fff6e0" strokeWidth="2" />
              <circle cx={A.x} cy={A.y} r={7 + 18 * ((t * 1.2) % 1)} fill="none" stroke={`rgba(240,191,90,${0.7 * (1 - ((t * 1.2) % 1))})`} strokeWidth="2" />
            </svg>
            <div style={{ position: 'absolute', left: bx, top: by, transform: `translate(${Lb.dx < 0 ? '-100%' : '0'}, -50%) scale(${0.85 + 0.15 * draw})`, transformOrigin: Lb.dx < 0 ? '100% 50%' : '0 50%', opacity: draw,
              padding: '10px 20px 11px', borderRadius: 999, background: 'rgba(14,10,8,0.66)', border: `2px solid ${C.gold}`, font: `700 27px ${SANS}`, letterSpacing: '0.14em', color: '#fff6e6', whiteSpace: 'nowrap', boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}>
              {Lb.text}
            </div>
          </div>
        );
      })}
      <NameTag t={t} cur={cur} />
    </>
  );
};

// NABOTH: a paper name tag hanging on the innocent man; cracks in two as his name is ruined
const NameTag = ({ t, cur }) => {
  if (cur.id !== 'S8') return null;
  const a = B.pointT + 0.15, crack = B.crackT;
  const o = clamp((t - a) / 0.3) * (1 - clamp((t - (cur.t1 - 0.15)) / 0.15));
  if (o <= 0) return null;
  const P = project(cur, t, add(B.innocent(), [0.02, 1.42, 0]));
  const u = clamp((t - crack) / 0.9);
  const crackLine = clamp((t - crack + 0.12) / 0.12);
  const w = 290, h = 92;
  const jag = 'polygon(0 0, 47% 0, 53% 18%, 46% 38%, 55% 60%, 48% 80%, 52% 100%, 0 100%)';
  const jag2 = 'polygon(47% 0, 100% 0, 100% 100%, 52% 100%, 48% 80%, 55% 60%, 46% 38%, 53% 18%)';
  const half = (clip, dir) => (
    <div style={{ position: 'absolute', inset: 0, clipPath: clip, transform: `translate(${dir * 60 * ease.out(u)}px, ${120 * u * u}px) rotate(${dir * 14 * ease.out(u)}deg)`, opacity: 1 - clamp((u - 0.55) / 0.45) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(170deg, #fbf3df, #ead9b4)', border: '2px solid #b8925a', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 54px ${SERIF}`, letterSpacing: '0.12em', color: '#3a2414', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>NABOTH</div>
    </div>
  );
  const sway = Math.sin(t * 2.2) * 3 * (1 - u);
  return (
    <div style={{ position: 'absolute', left: P.x - w / 2, top: P.y + 34, width: w, height: h, opacity: o, transform: `rotate(${sway}deg) scale(${ease.back((t - a) / 0.35)})`, transformOrigin: '50% -34px' }}>
      <svg width={w} height={60} style={{ position: 'absolute', left: 0, top: -40, overflow: 'visible' }}><path d={`M ${w / 2} 0 L ${w * 0.3} 40 M ${w / 2} 0 L ${w * 0.7} 40`} stroke="#d9c49a" strokeWidth="2" fill="none" opacity={1 - u} /></svg>
      {half(jag, -1)}{half(jag2, 1)}
      {crackLine > 0 && u < 0.15 ? <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}><polyline points={`${w * 0.47},0 ${w * 0.53},${h * 0.18} ${w * 0.46},${h * 0.38} ${w * 0.55},${h * 0.6} ${w * 0.48},${h * 0.8} ${w * 0.52},${h}`} fill="none" stroke="#2a1a10" strokeWidth="4" strokeDasharray={`${300 * crackLine} 400`} /></svg> : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: h + 14, textAlign: 'center', font: `700 22px ${SANS}`, letterSpacing: '0.2em', color: '#f4ead6', textShadow: '0 2px 8px rgba(0,0,0,0.7)', opacity: 1 - u }}>1 KINGS 21:13</div>
    </div>
  );
};

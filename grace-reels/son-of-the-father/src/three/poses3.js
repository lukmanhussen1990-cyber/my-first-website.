// Q.03 poses (pure functions of t), added to the shared Poses table: Jesus bound and still, Barabbas in shackles,
// the chanting / exploding crowd, Pilate presenting the two men, the guard unlocking the shackles, the beam carried
// up the hill (far away only). Import once (side effect) before using them.
import { Poses, expr } from './rig.js';
import { hash01, clamp, lerp } from '../lib/util.js';

const TAU = Math.PI * 2;

Object.assign(Poses, {
  // Jesus: perfectly calm and still, wrists bound in front (the set ties a rope loop at the hands).
  // lift 0 = gaze lowered .. 1 = eyes lifted
  bound(t, s = 1, lift = 0.4) {
    const P = Poses.idle(t, s);
    P.aF = [0.235, 1.0, 0.1]; P.aB = [-0.53, 1.48, 0.06]; P.handF = 'open'; P.handB = 'open';   // both wrists meet in front of the belt
    P.dx *= 0.35; P.lean = 0.004 * P.breath; P.look *= 0.15;
    P.lookY = lerp(-0.22, 0.3, lift); P.headTilt = lerp(-0.06, 0.07, lift);
    expr(P, 'peace', 1); P.brow = 0; P.eye = lerp(0.68, 0.8, lift);   // calm, not sad
    return P;
  },
  // Barabbas: heavy and restless, shackled hands low in front; glare 1 = hard eyes .. 0 = softened
  shackled(t, s = 1, glare = 1) {
    const P = Poses.idle(t, s); const ph = hash01(s, 9) * TAU;
    P.aF = [0.2 + 0.03 * Math.sin(TAU * t / 2.7 + ph), 1.02, 0.08]; P.aB = [0.16, 1.12, 0.05]; P.handF = 'grip'; P.handB = 'grip';
    P.lean = 0.05; P.dx = 0.018 * Math.sin(TAU * t / 3.1 + ph);
    if (glare > 0.05) { expr(P, 'angry', 0.5 * glare); P.eye = Math.min(P.eye, lerp(1, 0.78, glare)); }
    else expr(P, 'sadness', 0.5);
    return P;
  },
  // Barabbas freed: hands apart and empty; soft k 0..1 (the hard face softens)
  freed(t, s = 1, soft = 0) {
    const P = Poses.idle(t, s);
    P.aF = [0.12, 0.25]; P.aB = [-0.08, 0.2]; P.handF = 'open'; P.handB = 'open';
    if (soft < 0.5) expr(P, 'angry', 0.35 * (1 - soft * 2)); else expr(P, 'sadness', (soft - 0.5) * 1.4);
    return P;
  },
  // the crowd: k 0 calm .. 0.5 chanting (one fist pumping) .. 1 exploding (both fists up, bouncing)
  chant(t, s = 1, k = 0.5) {
    const P = Poses.idle(t, s); const ph = hash01(s, 21) * TAU, f = 1.5 + 0.6 * hash01(s, 22);
    const pump = 0.5 + 0.5 * Math.sin(TAU * t * f + ph);
    const upF = clamp(k * 1.7) * (0.72 + 0.28 * pump), upB = clamp((k - 0.5) * 2.2) * (0.7 + 0.3 * (1 - pump));
    P.aF = [lerp(0.08, 2.75, upF), lerp(0.1, 0.35, upF), 0]; P.handF = upF > 0.3 ? 'grip' : 'open';
    P.aB = [lerp(-0.05, 2.55, upB), lerp(0.08, 0.42, upB), 0]; P.handB = upB > 0.3 ? 'grip' : 'open';
    P.bob = 0.004 * P.breath + k * 0.045 * pump; P.lean = 0.04 * k + 0.05 * k * pump;
    if (k > 0.2) { expr(P, 'angry', clamp(k * 1.2)); P.mouth = 'open'; P.mo = 0.3 + 0.6 * k * pump; }
    return P;
  },
  // Pilate: raises one hand toward each man (k 0..1)
  present(t, s = 1, k = 1) {
    const P = Poses.idle(t, s);
    P.aF = [lerp(P.aF[0], 1.4, k), lerp(0.08, 0.14, k), 0]; P.aB = [lerp(P.aB[0], -1.15, k), lerp(0.06, 0.12, k), 0];
    P.handF = 'open'; P.handB = 'open'; P.lean = -0.03 * k;
    expr(P, 'worry', 0.7);
    return P;
  },
  // Pilate on the judgment seat, uneasy (glances from side to side)
  seatedUneasy(t, s = 1, seat = 0.55) {
    const P = Poses.sit(t, s, seat);
    P.aF = [0.55, 0.9, 0.2]; P.aB = [0.4, 1.0];
    expr(P, 'worry', 0.75); P.look = 0.45 * Math.sin(TAU * t / 3.4 + 1);
    return P;
  },
  // the guard turning the key in Barabbas's shackles
  unlock(t, s = 1) {
    const P = Poses.idle(t, s);
    P.aF = [0.95 + 0.07 * Math.sin(TAU * t * 1.7), 0.85, 0.2]; P.aB = [0.75, 1.15]; P.handF = 'grip'; P.handB = 'open';
    P.lean = 0.16; P.lookY = -0.55;
    expr(P, 'focus', 0.8);
    return P;
  },
  // carrying the cross beam on the shoulder, slow heavy steps (seen from far away only)
  carryBeam(t, s = 1) {
    const P = Poses.walk(t, s, 0.5, 0.75);
    P.aF = [2.05, 1.95]; P.aB = [1.85, 2.05]; P.handF = 'grip'; P.handB = 'grip'; P.lean = 0.24;
    return P;
  },
});

// static frames for the instanced crowd impostors (rendered once into an atlas): calm, fist half-up, fist up, both up
export function crowdFrame(f, s = 1) {
  const t = 1.1 + hash01(s, 30) * 2;
  const ks = [0, 0.42, 0.6, 1.0];
  const P = Poses.chant(t, s, ks[f]);
  if (f === 1) { P.aF = [1.6, 0.9, 0]; P.handF = 'grip'; }
  if (f === 2) { P.aF = [2.8, 0.25, 0]; P.handF = 'grip'; }
  if (f === 3) { P.aF = [2.75, 0.3, 0]; P.aB = [2.5, 0.4, 0]; P.handF = 'grip'; P.handB = 'grip'; P.bob = 0.03; }
  P.eye = 1;
  return P;
}

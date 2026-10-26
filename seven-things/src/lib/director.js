// The director: pure functions of time for every shot's camera and blocking (who stands where).
// Imported by the 3D engine (to place things) AND the HTML overlay (to project label anchors),
// so labels stay glued to the world during camera moves.
import { clamp, lerp, smooth, invLerp, easeInOut, easeOut, easeIn, hash01, noise2 } from './util.js';
import { shotAt } from '../plan.js';

export const SETS = {
  desert: [0, 0, 0], scroll: [1000, 0, 0], street: [2000, 0, 0], market: [3000, 0, 0], field: [4000, 0, 0],
  bench: [5000, 0, 0], mind: [5000, 0, 300], road: [6000, 0, 0], gate: [7000, 0, 0], village: [8000, 0, 0], hill: [9000, 0, 0],
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const at = (set, p) => add(SETS[set], p);
const sph = (target, yaw, pitch, dist) => [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
const mixv = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ------------------------------------------------------------------ blocking (pure)
export function blocking(plan) {
  const E = plan.ev, W = (b, w, n) => plan.word(b, w, n).start;
  const sh = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const B = {};
  // S1: the falling stone (t = seconds; negative t = the pre-roll at the end of the reel)
  B.stoneY = (t) => {
    if (t < 0) { const u = clamp((t + 0.8) / 0.8); return 14 + 0.9 * Math.sin(Math.PI * u) * (1 - u * 0.3); } // anticipation hover
    if (t < E.impact) { const u = t / E.impact; return 14 * (1 - u * u); }
    return 0;
  };
  // S3: the proud rich man walks past the beggar
  const s3 = sh.S3;
  B.richX = (t) => -3.4 + 0.82 * (t - s3.t0);
  B.rich = (t) => at('street', [B.richX(t), 0, 0.25]);
  B.beggar = () => at('street', [1.15, 0, -1.85]);
  B.richShadow = (t) => lerp(1.25, 3.6, smooth(invLerp(s3.t0 + 0.4, s3.t1, t)));
  B.beggarShadow = (t) => lerp(1.05, 0.38, smooth(invLerp(s3.t0 + 1.0, s3.t1, t)));
  // S4: market
  B.seller = () => at('market', [-0.35, 0, -1.45]);
  B.buyer = () => at('market', [1.25, 0, 0.55]);
  B.wallShadow = () => at('market', [0.55, 0, -2.56]);
  B.rackT = W('B06', 'tongue');                       // focus pulls from the seller to his shadow
  B.swapT = [W('B06', 'Yes'), W('B06', 'small')];
  // S5: field at dusk
  B.brotherA = (t) => at('field', [lerp(-0.2, -3.2, smooth(invLerp(sh.S5.t0 + 0.4, sh.S5.t1, t))), 0, lerp(0, -0.6, smooth(invLerp(sh.S5.t0 + 0.4, sh.S5.t1, t)))]);
  B.brotherB = () => at('field', [0.75, 0, 0.15]);
  B.flower = () => at('field', [0.75, 0, 0.42]);
  B.wiltT = W('B07', 'innocent');
  // S6: bench + mind
  B.benchMan = () => at('bench', [0, 0, 0.12]);
  B.cloud = () => at('mind', [0.15, 2.45, 0]);
  // S7: the runner
  const s7 = sh.S7;
  B.runX = (t) => -27 + 6.1 * (t - s7.t0);
  B.runner = (t) => at('road', [B.runX(t), 0, 0.4]);
  B.crowdX = -27 + 6.1 * (s7.t1 - s7.t0) + 3.5;
  // S8: the city gate
  B.accuser = () => at('gate', [-1.35, 0, -0.9]);
  B.innocent = () => at('gate', [1.05, 0, -0.75]);
  B.pointT = W('B10', 'false');
  B.crackT = W('B10', 'Ruining');
  // S10 / S14: the fire circle
  B.fire = () => at('village', [0, 0, 0]);
  B.seatAngle = (i) => -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / 8);
  B.split = E.split;
  B.groupOf = (i) => (Math.cos(B.seatAngle(i)) < 0 ? -1 : 1);
  B.splitK = (t) => smooth(invLerp(E.split - 0.6, E.split + 0.9, t)) * (1 - smooth(invLerp(E.reunite + 0.4, E.reunite + 2.4, t)));
  B.seat = (i, t) => {
    const a = B.seatAngle(i), r = 2.15;
    const k = B.splitK(t);
    return at('village', [Math.cos(a) * r + B.groupOf(i) * 1.7 * k, 0, Math.sin(a) * r * (1 - 0.25 * k)]);
  };
  // whisperer walks behind the circle to ear after ear
  const targets = [1, 3, 0, 6, 4];
  B.whisperTargets = targets;
  B.whisperer = (t) => {
    const R = 3.05;
    const stops = E.whisperTo.map((tt, i) => ({ t: tt, a: B.seatAngle(targets[i]) }));
    let a = B.seatAngle(2) + 0.4;
    if (t <= stops[0].t - 0.45) a = lerp(B.seatAngle(2) + 0.4, stops[0].a, smooth(invLerp(E.reveal + 0.4, stops[0].t - 0.45, t)));
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i], n = stops[i + 1];
      if (t >= s.t - 0.45) a = s.a;
      if (n && t > s.t + 0.35) a = lerp(s.a, n.a, smooth(invLerp(s.t + 0.35, n.t - 0.45, t)));
    }
    const lean = E.whisperTo.some((tt) => t > tt - 0.3 && t < tt + 0.55) ? 0.55 : 0;
    const r = R - lean;
    return at('village', [Math.cos(a) * r, 0, Math.sin(a) * r]);
  };
  B.whisperK = (t) => Math.max(0, ...E.whisperTo.map((tt) => smooth(invLerp(tt - 0.35, tt - 0.05, t)) * (1 - smooth(invLerp(tt + 0.45, tt + 0.7, t)))));
  // gold threads: neighbours + 3 across; which ones snap (in order) and regrow
  B.threads = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [1, 5], [2, 6]];
  B.snapOrder = [0, 2, 8, 6, 3];      // thread indices broken by each whisper
  // S13: hill
  B.cross = () => at('hill', [0, 5.6, 0]);
  return B;
}

// ------------------------------------------------------------------ camera (pure)
export function cameraAt(plan, t) {
  const B = plan._B || (plan._B = blocking(plan));
  const { shot, lt } = shotAt(plan, t);
  const d = shot.t1 - shot.t0, u = clamp(lt / d);
  let pos, look, fov = 24, roll = 0, focus = null, mblur = 0;
  const E = plan.ev;
  switch (shot.id) {
    case 'S1': case 'LOOP': {
      const tt = shot.id === 'LOOP' ? 0 : t;
      const target = at('desert', [0, lerp(2.6, 3.1, smooth(invLerp(2.0, 5.2, tt))), 0]);
      const push = easeOut(invLerp(0, 1.9, tt));
      const crane = easeInOut(invLerp(1.9, 5.3, tt));
      const yaw = lerp(0.22, 0.52, crane), pitch = lerp(0.47, 0.3, crane), dist = lerp(lerp(46, 37, push), 31, crane);
      pos = sph(target, yaw, pitch, dist); look = target; fov = 24;
      // impact shake: 7 frames, decaying
      const s = t - E.impact;
      if (shot.id === 'S1' && s > 0 && s < 0.3) {
        const k = (1 - s / 0.3) ** 2 * 0.55, f = Math.round(t * 30);
        pos = add(pos, [(hash01(f, 1) - 0.5) * k, (hash01(f, 2) - 0.5) * k, (hash01(f, 3) - 0.5) * k * 0.5]);
      }
      focus = dist;
      break;
    }
    case 'S2': {
      const target = at('scroll', [0, 1.02, lerp(-1.05, -0.35, easeInOut(u))]);
      pos = sph(target, lerp(-0.08, 0.06, u), 0.98, lerp(9.3, 8.6, u)); look = target; fov = 22; focus = 8.9;
      break;
    }
    case 'S3': {
      const p = B.rich(t);
      const crane = easeInOut(invLerp(plan.beats.B05.start - 0.6, shot.t1, t));
      const target = mixv([p[0] + 0.55, 1.15, p[2] - 0.35], [p[0] - 0.4, 0.2, p[2] - 2.3], crane);
      pos = sph(target, lerp(0.16, 0.05, crane), lerp(0.36, 0.98, crane), lerp(13.5, 16.5, crane)); look = target; fov = 24; focus = lerp(13.5, 16.5, crane);
      break;
    }
    case 'S4': {
      const target = at('market', [0.25, 1.35, -1.55]);
      pos = sph(target, lerp(-0.2, -0.1, u), lerp(0.16, 0.12, u), lerp(9.2, 8.4, u)); look = target; fov = 24;
      const rk = smooth(invLerp(B.rackT - 0.2, B.rackT + 0.6, t));
      focus = lerp(8.6, 9.9, rk);
      break;
    }
    case 'S5': {
      const target = mixv(at('field', [0.2, 0.5, 0.1]), at('field', [0.75, 0.25, 0.42]), smooth(invLerp(0.45, 1, u)));
      pos = sph(target, 0.12, lerp(0.66, 0.52, u), lerp(42, 15, easeInOut(u))); look = target; fov = 22; focus = lerp(42, 15, easeInOut(u));
      break;
    }
    case 'S6a': {
      const head = add(B.benchMan(), [0.1, 1.42, 0]);
      const k = easeIn(u);
      const target = mixv(add(B.benchMan(), [0, 1.0, 0]), head, k);
      pos = sph(target, lerp(0.28, 0.08, k), lerp(0.16, 0.05, k), lerp(9.5, 0.55, k)); look = target; fov = 24; focus = lerp(9.5, 0.55, k);
      mblur = u > 0.82 ? 4 : 0;
      break;
    }
    case 'S6b': {
      const c = at('mind', [0.15, 2.3, 0]);
      const k = easeOut(invLerp(0, 0.9, lt));
      pos = sph(c, lerp(0.0, 0.1, u), lerp(0.02, 0.08, u), lerp(1.2, 9.6, k) + lerp(0, 0.8, u)); look = c; fov = 26; focus = 9;
      break;
    }
    case 'S7': {
      const rx = B.runX(t);
      const target = at('road', [rx + 1.3, 1.0, 0.2]);
      pos = add(target, [-1.8 + Math.sin(t * 1.3) * 0.15, 1.2 + noise2(t * 2, 3, 7) * 0.08, 11.5]); look = target; fov = 24; focus = 11.5;
      mblur = 4;
      break;
    }
    case 'S8': {
      const crack = smooth(invLerp(B.crackT - 0.9, B.crackT + 0.2, t));
      const target = mixv(at('gate', [0, 1.45, -1.6]), add(B.innocent(), [0, 1.55, 0]), crack * 0.75);
      pos = sph(target, lerp(-0.06, 0.06, u), lerp(0.2, 0.14, u), lerp(17, 11, crack)); look = target; fov = 24; focus = lerp(17, 11, crack);
      break;
    }
    case 'S9': {
      // dolly-zoom: camera pulls back while the lens tightens — the fire circle keeps its size
      const k = easeInOut(u);
      const target = at('village', [0, 0.9, 0]);
      const dist = lerp(22, 46, k);
      fov = 2 * Math.atan(Math.tan((30 * Math.PI / 180) / 2) * 22 / dist) * 180 / Math.PI;
      pos = sph(target, lerp(-0.3, -0.18, k), lerp(0.42, 0.36, k), dist); look = target; focus = dist;
      break;
    }
    case 'S10': case 'S14b': {
      const target = at('village', [0, 0.85, 0]);
      const orbit = shot.id === 'S10' ? lerp(-0.45, 0.25, easeInOut(u)) : lerp(0.35, -0.2, easeInOut(u));
      const dist = shot.id === 'S10' ? lerp(19.5, 17, u) : lerp(21, 18, u);
      pos = sph(target, orbit, shot.id === 'S10' ? 0.52 : 0.46, dist); look = target; fov = 26; focus = dist;
      const s = t - E.reveal;
      if (shot.id === 'S10' && s >= 0 && s < 0.32) {
        const kk = (1 - s / 0.32) ** 2 * 0.4, f = Math.round(t * 30);
        pos = add(pos, [(hash01(f, 4) - 0.5) * kk, (hash01(f, 5) - 0.5) * kk, 0]);
      }
      break;
    }
    case 'S13': case 'S14a': {
      const tt = t - plan.shots.find((s) => s.id === 'S13').t0;
      const target = at('hill', [0, lerp(3.2, 4.6, smooth(invLerp(0, 12, tt))), 0]);
      pos = sph(target, lerp(0.18, -0.12, smooth(invLerp(0, 14, tt))), lerp(0.1, 0.22, smooth(invLerp(0, 12, tt))), lerp(36, 27, smooth(invLerp(0, 14, tt)))); look = target; fov = 24; focus = 30;
      break;
    }
    default: { // HTML-only scenes keep a neutral camera
      const target = at('village', [0, 1, 0]); pos = sph(target, 0, 0.4, 20); look = target; fov = 24; focus = 20;
    }
  }
  // seeded handheld drift on everything (tiny)
  const hh = [noise2(t * 0.33, 1.3, 11) * 0.06, noise2(t * 0.29, 7.7, 13) * 0.045, noise2(t * 0.27, 3.1, 17) * 0.06];
  pos = add(pos, hh);
  // whip pans: the outgoing shot whips away, the incoming one arrives from the other side
  const { next, prev } = shotAt(plan, t);
  let whip = 0;
  if (next && next.trans === 'whip' && t > next.t0 - 0.2) whip = easeIn(invLerp(next.t0 - 0.2, next.t0, t));
  if (shot.trans === 'whip' && lt < 0.2) whip = -easeOut(1 - lt / 0.2) * 1.0 + 0;
  if (whip !== 0) {
    const yaw = whip * 0.65;
    const dx = look[0] - pos[0], dz = look[2] - pos[2];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    look = [pos[0] + dx * c - dz * s, look[1], pos[2] + dx * s + dz * c];
    mblur = Math.max(mblur, 5);
  }
  return { pos, look, fov, roll, focus, mblur, shot: shot.id, lt, u };
}

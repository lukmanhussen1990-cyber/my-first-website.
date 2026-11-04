// The whole reel as a pure function of time t (seconds of the voiceover).
// Word times come from faster-whisper (word_timestamps) refined with an energy envelope.
import * as THREE from 'three';
import { clamp, lerp, seg, smooth, easeInOut, easeInOutSine, easeOut, easeOutQuart, easeIn, easeInQuad, easeOutBack, easeOutBounce, noise1, fbm, rng, mix3, envelope } from './util.js';
import { ROWS, SEATS_X, SEAT_TOP, ALTAR_Y } from './world.js';

// [word, start, end]
export const CAPTIONS = [
  { words: [["You're", 0.05, 0.38], ['mentally', 0.38, 0.76]] },
  { words: [['unstable.', 0.76, 1.62]] },
  { words: [['And', 2.12, 2.22], ['today', 2.22, 2.56], ['is', 2.56, 2.88]] },
  { words: [['your', 2.88, 3.14], ["crush's", 3.14, 3.6], ['wedding.', 3.6, 3.86]] },
  { words: [['You', 4.15, 4.28], ["weren't", 4.28, 4.54], ['invited.', 4.54, 5.0]] },
  { words: [['You', 5.27, 5.42], ['came', 5.42, 5.62], ['anyway.', 5.62, 6.08]] },
  { words: [['She', 6.44, 6.64], ['looks', 6.64, 6.88], ['beautiful.', 6.88, 7.58]] },
  { words: [['He', 7.98, 8.08], ['looks...', 8.08, 8.63]] },
  { words: [['fine.', 8.91, 9.34]] },
  { words: [['The', 9.7, 9.8], ['priest', 9.8, 10.1], ['asks,', 10.1, 10.75]] },
  { words: [['If', 10.98, 11.1], ['anyone', 11.1, 11.42], ['objects,', 11.42, 12.1]] },
  { words: [['speak', 12.22, 12.52], ['now.', 12.52, 12.92]] },
  { words: [['Silence.', 13.36, 14.05]], big: true },
  { words: [['Then,', 14.4, 14.88]] },
  { words: [['you', 15.25, 15.42], ['poop', 15.42, 15.68]], loud: true },
  { words: [['your', 15.68, 15.92], ['pants.', 15.92, 16.4]], loud: true },
  { words: [['And', 16.7, 16.82], ['you', 16.82, 16.98], ['start', 16.98, 17.28]] },
  { words: [['laughing.', 17.28, 17.84]], loud: true },
  { words: [['You', 18.02, 18.18], ["can't", 18.18, 18.6], ['stop.', 18.6, 18.98]], loud: true },
  { words: [['The', 19.26, 19.42], ['smell', 19.42, 19.72], ['hits', 19.72, 20.0]] },
  { words: [['the', 20.0, 20.28], ['front', 20.28, 20.5], ['row.', 20.5, 20.85]] },
  { words: [['Grandma', 21.02, 21.52], ['faints.', 21.52, 22.0]] },
  { words: [['The', 22.27, 22.38], ['guests', 22.38, 22.7]] },
  { words: [['panic.', 22.7, 23.24]], loud: true },
  { words: [['The', 23.5, 23.72], ['groom', 23.72, 23.94], ['covers', 23.94, 24.4]] },
  { words: [['his', 24.4, 24.64], ['nose.', 24.64, 24.95]] },
  { words: [['Security', 25.16, 25.6], ['grabs', 25.6, 26.08], ['you.', 26.08, 26.36]] },
  { words: [['They', 26.46, 26.62], ['drag', 26.62, 26.96], ['you', 26.96, 27.14]] },
  { words: [['down', 27.14, 27.32], ['the', 27.32, 27.56], ['aisle', 27.56, 27.76]] },
  { words: [['and', 27.76, 28.08], ['throw', 28.08, 28.36]] },
  { words: [['you', 28.36, 28.62], ['out.', 28.62, 28.92]], loud: true },
  { words: [['The', 28.95, 29.12], ['doors', 29.12, 29.48]] },
  { words: [['slam', 29.48, 29.92], ['shut.', 29.92, 30.4]], loud: true },
  { words: [['Then,', 30.62, 30.95], ['from', 31.12, 31.22], ['inside,', 31.22, 31.78]] },
  { words: [['you', 32.1, 32.18], ['hear...', 32.18, 32.55]] },
  { words: [['Wait!', 32.78, 33.21]], loud: true },
  { words: [['I', 33.52, 33.68], ['object!', 33.68, 34.35]], loud: true },
];
CAPTIONS.forEach((c, i) => {
  c.t0 = c.words[0][1];
  const last = c.words[c.words.length - 1][2];
  const next = CAPTIONS[i + 1] ? CAPTIONS[i + 1].words[0][1] : 99;
  c.t1 = next - last < 0.75 ? next : last + 0.4;
  c.wordsT = c.words.map(([w, s]) => ({ w, t: s }));
});
export const DURATION = 34.50775;

// camera shake impulses [time, duration, amplitude]
const SHAKES = [
  [15.42, 0.45, 0.55], [16.98, 1.0, 0.2], [17.28, 0.4, 0.5], [18.02, 0.4, 0.45], [18.25, 1.0, 0.25], [18.78, 0.35, 0.55],
  [22.3, 1.2, 0.2], [22.7, 0.5, 0.65], [28.42, 0.45, 0.75], [28.36, 0.3, 0.4], [29.03, 0.45, 0.9], [29.5, 0.55, 1.0],
  [32.78, 0.4, 0.55], [33.52, 0.45, 0.6], [26.62, 1.1, 0.12],
];

const Z_LIFT = 9.0;
const Z_DRAG_END = 25.0;
const DOOR_BURST = 28.42;
const LAND_T = 29.03;
const SLAM_T = 29.48;
const YOU_SEAT = [SEATS_X[0], 20.45];

// lying on the church steps (root pivot = body centre)
const LIE = { x: 0.6, y: -0.62, z: 37.2, rx: -Math.PI / 2 + 0.31 };

const talkWindows = (t, list) => list.some(([a, b]) => t >= a && t <= b);

export class Story {
  constructor(W, scene, camera, renderer, ctx) {
    this.W = W; this.scene = scene; this.camera = camera; this.renderer = renderer; this.ctx = ctx;
    this.C = W.chars; this.G = W.guests;
    this.v = new THREE.Vector3();
    this.preparePanic();
    this.shots = this.buildShots();
  }

  // ------------------------------------------------------------------ panic paths
  preparePanic() {
    const r = rng(77);
    for (const g of this.G) {
      const zr = ROWS[g.seat.row];
      const p = (g.p = {});
      p.tUp = 22.32 + r() * 0.35;
      p.stand = [g.seat.x + (r() - 0.5) * 0.6, zr - 2.0];
      p.jumper = zr >= 8 ? true : r() < 0.5;
      p.scream = r() < 0.75;
      if (p.jumper) {
        const maxH = Math.floor((25.5 - p.stand[1]) / 6);
        const avail = Math.floor((25.0 - p.tUp - 0.2) / 0.5);
        p.hops = Math.max(0, Math.min(maxH, avail));
        p.dx = (r() - 0.5) * 1.6;
      } else {
        const sx = Math.sign(g.seat.x);
        const ax = sx * (1.0 + r() * 2.6);
        const zf = -30.6 - r() * 3.2;
        const xf = (r() - 0.5) * 26;
        p.path = [p.stand, [p.stand[0], p.stand[1]], [ax, p.stand[1]], [ax, zf + 2.5], [xf, zf]];
        p.speed = 10 + r() * 3;
      }
      p.watchArms = r() < 0.55;
    }
  }

  // ------------------------------------------------------------------ helpers
  faceTo(c, x, z) { c.root.rotation.y = Math.atan2(x - c.root.position.x, z - c.root.position.z); }
  // turn head/torso of a seated or standing char toward a world point (limited)
  lookAt(c, x, z, amt = 1, y = null) {
    const yaw = c.root.rotation.y;
    const dx = x - c.root.position.x, dz = z - c.root.position.z;
    let a = Math.atan2(dx, dz) - yaw;
    while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
    a = clamp(a, -2.3, 2.3) * amt;
    const tor = clamp(a * 0.4, -0.75, 0.75);
    c.torso.rotation.y += tor; c.head.rotation.y += clamp(a - tor, -1.35, 1.35);
    if (y !== null) { const d = Math.hypot(dx, dz); c.head.rotation.x += clamp(-Math.atan2(y - (c.root.position.y + 4.7), d), -0.5, 0.5) * amt; }
  }
  handToFace(c, side, a = 1) {
    // side: 1 = right arm, -1 = left arm
    const A = side > 0 ? c.armR : c.armL;
    A.rotation.x = lerp(A.rotation.x, -2.42, a); A.rotation.z = lerp(A.rotation.z, -0.78 * side, a);
  }
  handsOnCheeks(c, a = 1) {
    c.armL.rotation.x = lerp(c.armL.rotation.x, -2.55, a); c.armL.rotation.z = lerp(c.armL.rotation.z, 0.62, a);
    c.armR.rotation.x = lerp(c.armR.rotation.x, -2.55, a); c.armR.rotation.z = lerp(c.armR.rotation.z, -0.62, a);
  }

  shake(t) {
    let a = 0;
    for (const [s, d, amp] of SHAKES) if (t >= s && t < s + d) a += amp * Math.pow(1 - (t - s) / d, 1.5);
    return a;
  }

  // ------------------------------------------------------------------ base state
  base(t) {
    const { you, bride, groom, priest, grandma, guardL, guardR } = this.C;
    const W = this.W;
    // bride at the altar facing groom (turned toward the church)
    bride.standAt(-2.6, ALTAR_Y, -40, 0.75);
    bride.armL.rotation.set(-0.95, 0, 0.42); bride.armR.rotation.set(-0.8, 0, -0.38);
    bride.head.rotation.z = Math.sin(t * 1.3) * 0.04; bride.head.rotation.y = 0.15 + Math.sin(t * 0.7) * 0.05;
    if (bride.veil) bride.veil.rotation.z = Math.sin(t * 1.7) * 0.03;
    // groom
    groom.standAt(2.6, ALTAR_Y, -40, -0.75);
    groom.armL.rotation.set(-0.35, 0, 0.32); groom.armR.rotation.set(-0.35, 0, -0.32);
    groom.torso.rotation.x = -0.05; groom.head.rotation.x = -0.12 + Math.sin(t * 1.1) * 0.02;
    // priest
    priest.standAt(0, ALTAR_Y, -45, 0);
    priest.armL.rotation.set(-1.15, 0, 0.32);
    priest.head.rotation.x = Math.sin(t * 0.9) * 0.03;
    // grandma fanning in the front row
    grandma.sitAt(-SEATS_X[0], SEAT_TOP, -27.55);
    grandma.armL.rotation.set(-0.55, 0, 0.1);
    grandma.armR.rotation.set(-2.0, 0, -0.45 + Math.sin(t * 10) * 0.22);
    if (grandma.fan) { grandma.fan.rotation.set(0.0, Math.PI / 2, Math.sin(t * 10) * 0.25); grandma.fan.visible = true; }
    grandma.head.rotation.y = 0.15;
    // guards at the back doors
    guardL.standAt(-6.8, 0, 27.4, Math.PI); guardR.standAt(6.8, 0, 27.4, Math.PI);
    for (const g of [guardL, guardR]) { g.armL.rotation.set(-1.35, 0, 0.95); g.armR.rotation.set(-1.25, 0, -0.95); }
    // guests
    for (const g of this.G) this.guestBase(g, t);
    this.youBase(t);
    this.altarBase(t);
    this.guardsBase(t);
    // doors
    let aL = 0, aR = 0;
    if (t > 4.2 && t < 6.2) aR = 0.55 * smooth(seg(t, 4.2, 4.5)) * (1 - smooth(seg(t, 5.5, 6.0)));
    if (t >= DOOR_BURST - 0.02 && t < SLAM_T) { const p = seg(t, DOOR_BURST - 0.02, DOOR_BURST + 0.16); aL = aR = 1.85 * easeOutBack(p, 1.4) + Math.sin(seg(t, DOOR_BURST, DOOR_BURST + 0.9) * 18) * 0.05 * (1 - seg(t, DOOR_BURST, DOOR_BURST + 0.9)); }
    if (t >= SLAM_T) { const p = seg(t, SLAM_T - 0.1, SLAM_T + 0.06); aL = aR = 1.85 * (1 - easeInQuad(p)); const b = seg(t, SLAM_T + 0.06, SLAM_T + 0.4); if (b > 0 && b < 1) aL = aR = Math.abs(Math.sin(b * Math.PI * 2)) * 0.06 * (1 - b); }
    W.setDoors(aL, aR);
  }

  altarBase(t) {
    const { bride, groom, priest } = this.C;
    // priest raises hand and speaks
    const raise = smooth(seg(t, 9.95, 10.35)) * (1 - smooth(seg(t, 13.0, 13.4)));
    priest.armR.rotation.set(lerp(0, -2.95, raise), 0, lerp(0, -0.3, raise));
    const talking = talkWindows(t, [[10.98, 12.1], [12.22, 12.92]]);
    priest.face({ mouth: talking && Math.sin(t * 38) > -0.2 ? 'o' : 'smallsmile' });
    if (t >= 13.36 && t < 14.4) priest.face({ mouth: 'flat' });
    if (t >= 19.9 && t < 23) { priest.face({ eyes: 'squint', mouth: 'wavy' }); priest.green = 0.5; this.handToFace(priest, 1, smooth(seg(t, 20.0, 20.3))); }
    if (t >= 23 && t < 32.7) priest.face({ eyes: 'wide', mouth: 'o' });
    if (t >= 33.3) priest.face({ eyes: 'wide', mouth: 'gasp' });
    // bride
    if (t >= 19.7 && t < 22.5) { bride.face({ eyes: 'squint', mouth: 'wavy' }); bride.green = 0.25; }
    if (t >= 22.5 && t < 32.7) bride.face({ mouth: 'o' });
    if (t >= 32.7) {
      const p = easeOutBack(seg(t, 32.74, 32.98), 1.6);
      bride.root.rotation.y = lerp(0.75, 0.18, smooth(seg(t, 32.7, 32.95)));
      bride.armR.rotation.set(lerp(-0.8, -3.05, p), 0, lerp(-0.38, 0.42, p));
      bride.head.rotation.set(-0.08, 0, 0.05);
      bride.face({ eyes: 'pretty', mouth: t < 33.5 ? 'o' : 'smile', blush: true, brows: 'raised' });
    }
    // groom
    if (t >= 19.8 && t < 23.5) { groom.face({ eyes: 'squint', mouth: 'wavy' }); groom.green = 0.25; }
    if (t >= 23.5 && t < 32.7) {
      const a = smooth(seg(t, 23.5, 23.75));
      this.handToFace(groom, 1, a); groom.head.rotation.x = 0.12 * a; groom.torso.rotation.x = -0.12 * a;
      groom.face({ eyes: 'squint', mouth: 'wavy', tears: t > 24.25 }); groom.green = 0.5;
    }
    if (t >= 32.7) {
      groom.root.rotation.y = lerp(-0.75, -1.2, smooth(seg(t, 32.75, 33.0)));
      groom.face({ eyes: 'wide', mouth: t < 33.3 ? 'flat' : 'drop' });
      if (t >= 33.3) { const k = easeOutBack(seg(t, 33.3, 33.45), 2); groom.torso.rotation.x = -0.18 * k; groom.head.rotation.x = -0.18 * k; groom.armL.rotation.z = 0.12; groom.armR.rotation.z = -0.12; groom.armL.rotation.x = groom.armR.rotation.x = 0; }
    }
  }

  guestBase(g, t) {
    const s = g.seat, zr = ROWS[s.row];
    g.sitAt(s.x, SEAT_TOP, s.z, Math.PI);
    g.armL.rotation.set(-0.55, 0, 0.12); g.armR.rotation.set(-0.55, 0, -0.12);
    const tt = t >= 12.22 && t < 14.4 ? 12.22 : t;
    g.head.rotation.y = noise1(tt * 0.35 + g.seed) * 0.32;
    g.head.rotation.x = noise1(tt * 0.3 + g.seed + 5) * 0.06;
    if (t >= 12.22 && t < 14.4) { g.face({ mouth: 'flat' }); g.noBlink = true; } else g.noBlink = false;
    // turn around to look at the laughing guy behind them
    if (t >= 16.85 && t < 22.3 && zr >= -4) {
      const a = smooth(seg(t, 16.85 + (14 - zr) * 0.02, 17.25 + (14 - zr) * 0.02));
      this.lookAt(g, 2, 19, a * (zr >= 8 ? 1 : 0.6));
      g.face({ eyes: 'wide', mouth: 'flat', sweat: zr >= 8 && g.seed % 2 > 1 });
    }
    // the smell reaches their row
    const tS = Math.min(19.3 + Math.max(0, 17 - zr) / 40, zr <= -28 ? 20.22 : 99);
    if (t >= tS && t < 22.3) {
      const a = smooth(seg(t, tS, tS + 0.2));
      g.face({ eyes: 'squint', mouth: 'wavy', sweat: g.seed % 3 < 1 }); g.green = 0.5 * a;
      if (g.seat.row === 0) { g.torso.rotation.x = -0.3 * a; g.head.rotation.x = -0.25 * a; g.head.rotation.y = (g.seed % 2 > 1 ? 0.5 : -0.5) * a; }
      else this.handToFace(g, g.seed % 2 > 1 ? 1 : -1, a);
      g.torso.rotation.x = -0.12 * a; g.head.rotation.x -= 0.1 * a;
    }
    if (t >= 22.3) this.guestPanic(g, t);
  }

  guestPanic(g, t) {
    const p = g.p;
    const zr = ROWS[g.seat.row];
    g.green = 0.25;
    if (t < p.tUp) { g.face({ eyes: 'wide', mouth: 'gasp' }); return; }
    const standT = p.tUp + 0.18;
    // stand up
    g.resetPose();
    if (t < standT) {
      const a = smooth(seg(t, p.tUp, standT));
      g.root.position.set(lerp(g.seat.x, p.stand[0], a), lerp(SEAT_TOP - 1.5, 0, a) + Math.sin(a * Math.PI) * 0.6, lerp(g.seat.z, p.stand[1], a));
      g.root.rotation.y = Math.PI;
      g.legL.rotation.x = g.legR.rotation.x = lerp(-Math.PI / 2, 0, a);
      if (g.spec.outfit === 'dress') g.skirt.visible = a > 0.5;
      g.armsUpPanic(t, a, g.seed);
      g.face({ eyes: 'wide', mouth: 'scream' });
      return;
    }
    let x = p.stand[0], z = p.stand[1], y = 0, moving = false, yaw = Math.PI, phase = 0;
    let doneAt = standT;
    if (p.jumper) {
      const hd = 0.5;
      const k = Math.floor((t - standT) / hd);
      doneAt = standT + p.hops * hd;
      if (k < p.hops) {
        const f = (t - standT - k * hd) / hd;
        z = p.stand[1] + (k + f) * 6; x = p.stand[0] + p.dx * (k + f) / Math.max(1, p.hops);
        y = 4.4 * 4 * f * (1 - f); moving = true;
        g.legL.rotation.x = -1.1 * Math.sin(f * Math.PI); g.legR.rotation.x = -0.6 * Math.sin(f * Math.PI);
        yaw = 0;
      } else { z = p.stand[1] + p.hops * 6; x = p.stand[0] + p.dx; yaw = p.hops ? 0 : Math.PI; }
    } else {
      const d = (t - standT) * p.speed;
      const [px, pz, dx, dz, done] = pathAt(p.path, d);
      x = px; z = pz; moving = !done; yaw = Math.atan2(dx, dz);
      const L = pathLen(p.path); doneAt = standT + L / p.speed;
      phase = d * 1.3;
    }
    g.root.position.set(x, y, z); g.root.rotation.y = yaw;
    if (g.spec.outfit === 'dress') g.skirt.visible = true;
    if (t < Math.max(doneAt, 25.2) || t < 25.2) {
      if (moving && !p.jumper) g.run(phase, 1);
      if (!moving) { g.hip.position.y = 2 + Math.abs(Math.sin(t * 14 + g.seed)) * 0.25; g.legL.rotation.x = Math.sin(t * 14 + g.seed) * 0.3; g.legR.rotation.x = -Math.sin(t * 14 + g.seed) * 0.3; }
      g.armsUpPanic(t, 1, g.seed);
      g.face({ eyes: p.scream ? 'wide' : 'teary', mouth: 'scream', tears: !p.scream });
      if (!moving && t >= 25.2) { /* fallthrough to watch */ } else return;
    }
    // watching (after the chaos): face the action
    let fx = 0, fz = Z_LIFT;
    if (t >= 25.2 && t < 28.6) { const yz = this.youZ ?? Z_LIFT; fx = 0; fz = yz; }
    if (t >= 28.6 && t < 32.7) { fx = 0; fz = 30; }
    if (t >= 32.7) { fx = -2.6; fz = -40; }
    g.root.rotation.y = lerp(g.root.rotation.y, Math.atan2(fx - x, fz - z), 1);
    g.hip.position.y = 2;
    if (p.watchArms) this.handsOnCheeks(g, 1); else { g.armL.rotation.set(-0.2, 0, 0.25); g.armR.rotation.set(-0.2, 0, -0.25); }
    g.face({ eyes: 'wide', mouth: t >= 33.3 ? 'gasp' : 'o', tears: false });
    if (t >= 33.3) { const k = easeOutBack(seg(t, 33.3 + (g.seed % 1) * 0.1, 33.5 + (g.seed % 1) * 0.1), 2); g.torso.rotation.x = -0.15 * k; g.head.rotation.x = -0.15 * k; }
  }

  guardsBase(t) {
    const { guardL, guardR } = this.C;
    if (t < 23.8) return;
    const pairs = [[guardL, -1], [guardR, 1]];
    for (const [g, sx] of pairs) {
      g.resetPose();
      g.face({ mouth: 'flat' });
      const gx = sx * 2.9;
      if (t < 25.25) {
        const p = easeInOut(seg(t, 23.8, 25.25));
        const x = lerp(sx * 6.8, gx, p), z = lerp(27.4, Z_LIFT, p);
        g.root.position.set(x, 0, z); g.root.rotation.y = Math.atan2(gx - sx * 6.8, Z_LIFT - 27.4);
        g.run(t * 13, 0.9); g.armL.rotation.x = Math.sin(t * 13) * 0.7; g.armR.rotation.x = -Math.sin(t * 13) * 0.7;
        if (t > 25.0) this.faceTo(g, 0, Z_LIFT);
        continue;
      }
      let z = Z_LIFT, yaw = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      const grab = smooth(seg(t, 25.25, 25.5));
      if (t >= 25.9) yaw = lerp(yaw, 0, smooth(seg(t, 25.9, 26.3)));
      if (t >= 26.46) z = lerp(Z_LIFT, Z_DRAG_END, easeInOut(seg(t, 26.46, 27.76)));
      g.root.position.set(gx, 0, z); g.root.rotation.y = yaw;
      // inner arm grabs YOU's arm, outer arm free
      const inner = sx < 0 ? g.armR : g.armL, outer = sx < 0 ? g.armL : g.armR;
      const lift = smooth(seg(t, 25.5, 25.9));
      if (t < 26.3) {
        inner.rotation.set(lerp(0, -1.5, grab) - 0.6 * lift, 0, 0);
        outer.rotation.set(lerp(0, -1.3, grab) - 0.5 * lift, 0, 0);
        g.torso.rotation.x = 0.25 * grab * (1 - lift);
      } else {
        inner.rotation.set(-0.35, 0, -sx * 1.45);
        outer.rotation.set(Math.sin(t * 12) * 0.5, 0, sx * 0.15);
      }
      if (t >= 26.46 && t < 27.76) g.walk(t * 15, 0.9, 0);
      if (t >= 27.76 && t < 28.3) {
        const sw = seg(t, 27.76, 28.08);
        const back = Math.sin(sw * Math.PI) * -0.4;
        g.torso.rotation.x = back + (t > 28.0 ? 0.3 * seg(t, 28.0, 28.15) : 0);
        inner.rotation.set(lerp(-0.35, -2.4, smooth(seg(t, 27.95, 28.12))), 0, -sx * lerp(1.45, 0.3, smooth(seg(t, 27.95, 28.12))));
        g.face({ mouth: 'grit' });
      }
      if (t >= 28.3) { inner.rotation.set(-0.3, 0, 0); outer.rotation.set(-0.2, 0, 0); g.face({ mouth: 'smug' }); }
    }
  }

  youBase(t) {
    const { you } = this.C;
    const F = this.W.fx;
    you.resetPose();
    you.face({ eyes: 'crazy', mouth: 'creepy', brows: 'crazy', blush: false });
    this.youZ = null;
    let stink = 0;
    if (t < 4.15) {
      // outside the church, standing on the landing
      you.standAt(0, 0, 33.6, 0);
      you.head.rotation.z = Math.sin(t * 3.2) * 0.12; you.head.rotation.y = Math.sin(t * 1.7) * 0.15;
      you.armL.rotation.set(-0.15, 0, 0.05); you.armR.rotation.set(-0.15, 0, -0.05);
      if (t > 1.0) { you.armL.rotation.z = -0.25 + Math.sin(t * 6) * 0.1; you.armR.rotation.z = 0.25 - Math.sin(t * 6) * 0.1; }
    } else if (t < 5.27) {
      // sneaking in through the right door
      const p = seg(t, 4.3, 5.27);
      you.standAt(2.2, 0, lerp(32.8, 24.2, p), Math.PI);
      you.walk(t * 17, 0.45, 0); you.torso.rotation.x = 0.35; you.head.rotation.x = -0.3;
      you.armL.rotation.set(-1.45, 0, 0.35); you.armR.rotation.set(-1.45, 0, -0.35);
      you.head.rotation.y = Math.sin(t * 7) * 0.6;
      you.face({ eyes: 'crazy', mouth: 'grin' });
    } else if (t < 5.9) {
      if (t < 5.6) {
        const p = seg(t, 5.27, 5.6);
        you.standAt(lerp(2.2, 3.6, p), 0, lerp(24.2, 18.9, p), Math.PI);
        you.walk(t * 18, 0.5, 0); you.torso.rotation.x = 0.3;
        you.armL.rotation.set(-1.45, 0, 0.35); you.armR.rotation.set(-1.45, 0, -0.35);
      } else {
        // hop sideways into the empty back row
        const p = seg(t, 5.6, 5.9); const e = easeInOut(p);
        const x = lerp(3.6, YOU_SEAT[0], e), z = lerp(18.9, YOU_SEAT[1], e);
        const y = lerp(0, SEAT_TOP - 1.5, e) + Math.sin(p * Math.PI) * 2.6;
        you.root.position.set(x, y, z); you.root.rotation.y = Math.PI;
        you.legL.rotation.x = you.legR.rotation.x = lerp(0, -Math.PI / 2, smooth(seg(p, 0.4, 1)));
        you.armL.rotation.set(-0.4, 0, lerp(0.35, -1.0, Math.sin(p * Math.PI))); you.armR.rotation.set(-0.4, 0, lerp(-0.35, 1.0, Math.sin(p * Math.PI)));
      }
      you.face({ eyes: 'crazy', mouth: 'grin' });
    } else if (t < 18.35) {
      you.sitAt(YOU_SEAT[0], SEAT_TOP, YOU_SEAT[1], Math.PI);
      you.armL.rotation.set(-0.6, 0, 0.1); you.armR.rotation.set(-0.6, 0, -0.1);
      you.head.rotation.z = Math.sin(t * 2.3) * 0.08;
      if (t >= 6.44 && t < 7.98) { you.face({ eyes: 'heart', mouth: 'grin', blush: true, brows: null }); you.head.rotation.z = Math.sin(t * 4) * 0.12; you.armL.rotation.set(-1.9, 0, 0.75); you.armR.rotation.set(-1.9, 0, -0.75); }
      if (t >= 14.4 && t < 15.42) { you.face({ eyes: 'wide', mouth: 'flat', sweat: true, brows: 'worried' }); you.head.rotation.z = 0; }
      if (t >= 15.42 && t < 15.9) { const k = Math.sin(seg(t, 15.42, 15.62) * Math.PI); you.hip.position.y = 2 + 0.5 * k; you.face({ eyes: 'wide', mouth: 'o', sweat: true, brows: 'high' }); }
      if (t >= 15.9 && t < 16.7) you.face({ eyes: 'crazy', mouth: 'creepy', blush: true, brows: 'crazy' });
      if (t >= 15.42) stink = 1;
      if (t >= 16.7) {
        // laughing like crazy on the bench
        const k = smooth(seg(t, 16.7, 16.9)) * (1 + 0.6 * seg(t, 18.0, 18.35));
        you.torso.rotation.x = (-0.35 + Math.sin(t * 15) * 0.22) * k;
        you.head.rotation.x = -0.25 * k + Math.sin(t * 15 + 0.6) * 0.15 * k;
        you.hip.position.y = 2 + Math.abs(Math.sin(t * 15)) * 0.25 * k;
        you.armL.rotation.set(-0.9 + Math.sin(t * 15) * 0.2, 0, 0.75); you.armR.rotation.set(-0.9 + Math.sin(t * 15) * 0.2, 0, -0.75);
        you.legL.rotation.x = -Math.PI / 2 - (0.3 + Math.sin(t * 18) * 0.3) * k; you.legR.rotation.x = -Math.PI / 2 - (0.3 + Math.sin(t * 18 + 2) * 0.3) * k;
        you.face({ eyes: 'happy', mouth: Math.sin(t * 44) > -0.3 ? 'laugh' : 'grin', blush: true, brows: null });
      }
    } else if (t < 25.3) {
      // falls off the bench into the aisle and rolls around laughing
      stink = 1;
      const zf = 19.6 - Math.max(0, t - 18.8) * 1.25;
      const lie = { x: 1.6 + Math.sin(t * 2.2) * 0.4, z: zf };
      if (t < 18.8) {
        const p = seg(t, 18.35, 18.8); const e = easeIn(p);
        // tip over sideways toward the aisle
        you.body.position.y = -2.7;
        you.root.position.set(lerp(YOU_SEAT[0], lie.x, e), lerp(SEAT_TOP - 1.5 + 2.7, 0.55, easeInQuad(p)) + Math.sin(p * Math.PI) * 0.8, lerp(YOU_SEAT[1], lie.z - 2.7, e));
        you.root.rotation.set(lerp(0, -Math.PI / 2, e), lerp(Math.PI, 0, e), Math.sin(p * Math.PI) * 0.9, 'YXZ');
        you.legL.rotation.x = you.legR.rotation.x = lerp(-Math.PI / 2, -0.4, e);
        you.armL.rotation.set(-2.2, 0, -0.6); you.armR.rotation.set(-2.2, 0, 0.6);
      } else {
        you.body.position.y = -2.7;
        const roll = Math.sin(t * 7) * 0.7 * (1 - seg(t, 24.9, 25.3)) * seg(t, 18.8, 19.0);
        you.root.position.set(lie.x, 0.55, lie.z - 2.7);
        you.root.rotation.set(-Math.PI / 2, roll, 0, 'XYZ');
        you.legL.rotation.x = -0.6 - Math.sin(t * 19) * 0.5; you.legR.rotation.x = -0.6 - Math.sin(t * 19 + 2) * 0.5;
        you.armL.rotation.set(-0.9 + Math.sin(t * 15) * 0.3, 0, 0.8); you.armR.rotation.set(-0.9 + Math.sin(t * 15) * 0.3, 0, -0.8);
        you.torso.rotation.x = Math.sin(t * 15) * 0.15;
      }
      you.face({ eyes: 'happy', mouth: Math.sin(t * 44) > -0.3 ? 'laugh' : 'grin', blush: true, brows: null });
      this.youZ = lie.z - 2.7;
      if (t > 25.0) this.youZ = Z_LIFT;
    } else if (t < 28.08) {
      stink = 1;
      // lifted + dragged by security, still laughing and kicking
      you.body.position.y = -2.7; you.root.rotation.order = 'YXZ';
      const zf = 19.6 - (25.3 - 18.8) * 1.25;
      const lift = smooth(seg(t, 25.3, 25.85));
      let z = Z_LIFT;
      if (t >= 26.46) z = lerp(Z_LIFT, Z_DRAG_END, easeInOut(seg(t, 26.46, 27.76)));
      let swing = 0;
      if (t >= 27.76) { const sw = seg(t, 27.76, 28.08); swing = -Math.sin(sw * Math.PI) * 1.2 + sw * 0.6; }
      you.root.position.set(lerp(1.6, 0, lift), lerp(0.55, 4.1, lift), lerp(zf - 2.7, z, lift) + swing);
      you.root.rotation.set(lerp(-Math.PI / 2, 0.15, lift), 0, 0);
      you.armL.rotation.set(-0.2, 0, lerp(0.8, -2.25, lift)); you.armR.rotation.set(-0.2, 0, lerp(-0.8, 2.25, lift));
      you.legL.rotation.x = Math.sin(t * 20) * 0.9; you.legR.rotation.x = Math.sin(t * 20 + 2.5) * 0.9;
      you.torso.rotation.x = Math.sin(t * 15) * 0.12;
      you.face({ eyes: 'happy', mouth: Math.sin(t * 44) > -0.3 ? 'laugh' : 'grin', blush: true, brows: null });
      this.youZ = z;
    } else if (t < LAND_T + 0.3) {
      // thrown: flight through the doors and onto the steps
      stink = 0.6;
      you.body.position.y = -2.7; you.root.rotation.order = 'YXZ';
      if (t < LAND_T) {
        const p = seg(t, 28.08, LAND_T);
        const z = lerp(Z_DRAG_END + 0.6, LIE.z, p);
        const y = (1 - p) * (1 - p) * 4.1 + 2 * (1 - p) * p * 10.5 + p * p * LIE.y;
        you.root.position.set(lerp(0, LIE.x, p), y, z);
        you.root.rotation.set(lerp(0.15, LIE.rx - Math.PI * 4, easeOut(p)), 0, Math.sin(p * 9) * 0.3);
        you.armL.rotation.set(Math.sin(t * 25) * 1.2 - 1.5, 0, -1.2); you.armR.rotation.set(Math.sin(t * 25 + 1) * 1.2 - 1.5, 0, 1.2);
        you.legL.rotation.x = Math.sin(t * 22) * 1.0; you.legR.rotation.x = Math.sin(t * 22 + 2) * 1.0;
        you.face({ eyes: 'happy', mouth: 'laugh', blush: true, brows: null });
      } else {
        const b = seg(t, LAND_T, LAND_T + 0.3);
        you.root.position.set(LIE.x, LIE.y + Math.abs(Math.sin(b * Math.PI * 2)) * 0.5 * (1 - b), LIE.z);
        you.root.rotation.set(LIE.rx, 0, 0);
        you.body.scale.set(1 + 0.15 * (1 - b) * Math.sin(b * 12), 1, 1);
        you.armL.rotation.set(0, 0, -1.5); you.armR.rotation.set(0, 0, 1.5);
        you.legL.rotation.z = -0.3; you.legR.rotation.z = 0.3;
        you.face({ eyes: 'swirl', mouth: 'smile', blush: false, brows: null });
      }
    } else {
      // lying on the church steps
      stink = 0.5;
      you.body.position.y = -2.7; you.root.rotation.order = 'YXZ';
      you.root.position.set(LIE.x, LIE.y, LIE.z); you.root.rotation.set(LIE.rx, 0, 0);
      you.armL.rotation.set(0, 0, -1.5); you.armR.rotation.set(0, 0, 1.5);
      you.legL.rotation.z = -0.3; you.legR.rotation.z = 0.3;
      you.face({ eyes: t < 30.3 ? 'swirl' : 'happy', mouth: 'grin', blush: true, brows: null });
      if (t >= 33.8) {
        const k = easeOutBack(seg(t, 33.8, 34.08), 1.5);
        you.torso.rotation.x = 1.05 * k; you.head.rotation.x = -0.55 * k; you.head.rotation.z = Math.sin(t * 5) * 0.08;
        you.armL.rotation.set(-0.4 * k, 0, -1.5 + 1.0 * k); you.armR.rotation.set(-0.4 * k, 0, 1.5 - 1.0 * k);
        you.face({ eyes: 'crazy', mouth: 'creepy', blush: true, brows: 'crazy' });
      }
    }
    this.stinkAmt = stink;
  }

  // ------------------------------------------------------------------ FX
  fx(t, shot) {
    const F = this.W.fx; const { you, bride, groom, grandma, priest } = this.C;
    F.hide();
    const hp = (c) => c.worldHeadPos(new THREE.Vector3());
    // stink lines around YOU
    if (this.stinkAmt > 0 && t >= 15.42) {
      const base = new THREE.Vector3(); you.hip.getWorldPosition(base);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const ph = ((t - 15.42) * 0.9 + i / n) % 1;
        const a = i * 2.4 + 0.3;
        const r = 1.4 + (i % 3) * 0.35;
        const rise = Math.min(1, (t - 15.42) / 0.4);
        F.put('stink', i, base.x + Math.cos(a) * r, base.y + 0.4 + ph * 4.2 * rise, base.z + Math.sin(a) * r * 0.8, 1.6 + ph * 0.6, Math.sin(ph * Math.PI) * this.stinkAmt * rise, 0, Math.floor(t * 9 + i));
      }
    }
    // swirl above YOU's head (intro) / grandma (fainted)
    if (t < 2.1 && t > 0.55) { const h = hp(you); F.put('swirl', 0, h.x, h.y + 1.35 + Math.sin(t * 5) * 0.06, h.z, 1.15 * easeOutBack(seg(t, 0.55, 0.8), 2), 1, -t * 9); }
    if (t > 21.35 && t < 32.7) { const h = hp(grandma); F.put('swirl', 1, h.x, h.y + 1.5, h.z, 1.0 * easeOutBack(seg(t, 21.35, 21.6), 2), 1, -t * 8); }
    // hearts around YOU
    if (t >= 7.2 && t < 8.0) {
      const h = hp(you);
      for (let i = 0; i < 8; i++) {
        const ph = ((t - 7.2) * 0.8 + i / 8) % 1; const a = i * 0.785 + t * 1.5;
        F.put('heart', i, h.x + Math.cos(a) * 1.25, h.y - 0.3 + ph * 2.4, h.z + Math.sin(a) * 1.0, 0.42 + Math.sin(ph * Math.PI) * 0.18, Math.sin(ph * Math.PI) * 1.2);
      }
    }
    // hearts pop over the bride at the end
    if (t >= 33.05 && t < 33.8) {
      const h = hp(bride);
      for (let i = 0; i < 5; i++) { const ph = seg(t, 33.05 + i * 0.06, 33.75); const a = -1.2 + i * 0.6; F.put('heart', i, h.x + Math.cos(a) * 1.1, h.y + 1.0 + ph * 1.6 + Math.sin(a + 1.57) * 0.2, h.z + 0.5, 0.5 * easeOutBack(clamp(ph * 3), 2.5), 1 - smooth(seg(ph, 0.7, 1))); }
    }
    // sparkles around the bride
    const sparkleOn = (t >= 3.14 && t < 4.15) || (t >= 6.44 && t < 7.3) || (t >= 32.7 && t < 33.3);
    if (sparkleOn) {
      const h = hp(bride); const slow = t >= 6.44 && t < 7.3 ? 0.35 : 1;
      for (let i = 0; i < 22; i++) {
        const r = rng(i * 7 + 1); const ox = (r() - 0.5) * 6.5, oy = (r() - 0.6) * 7, oz = (r() - 0.5) * 3 + 1.0;
        const tw = Math.sin(t * slow * (5 + r() * 4) + i * 1.7);
        F.put('sparkle', i, h.x + ox, h.y + oy + (t * slow * 0.3 % 1) * 0.3, h.z + oz, 0.34 * Math.max(0, tw) + 0.05, Math.max(0, tw), tw * 0.5);
      }
    }
    // sweat drops
    if (t >= 14.6 && t < 15.9) { const h = hp(you); const ph = ((t - 14.6) * 1.6) % 1; F.put('drop', 0, h.x - 0.85, h.y + 0.55 - ph * 0.8, h.z - 0.45, 0.42, 1); }
    // tears of joy flying off YOU while laughing
    if (t >= 16.75 && t < 19.2) {
      const h = hp(you);
      for (let i = 0; i < 6; i++) { const ph = ((t - 16.75) * 2.2 + i / 6) % 1; const s = i % 2 ? 1 : -1; F.put('tear', i, h.x + s * (0.7 + ph * 1.6), h.y + 0.2 + Math.sin(ph * Math.PI) * 0.9 - ph * 0.6, h.z - 0.3, 0.32, 1 - ph); }
    }
    // the smell cloud floats down the aisle
    if (t >= 19.2 && t < 22.2) {
      F.cloud.visible = true;
      const z = Math.max(-29.5, 17 - (t - 19.26) * 40);
      const fade = 1 - smooth(seg(t, 21.2, 22.2));
      F.cloud.position.set(Math.sin(t * 2.1) * 0.8, 3.6 + Math.sin(t * 3.0) * 0.3, z);
      F.cloud.children.forEach((m, i) => { const o = m.userData.o; const s = o[3] * (0.85 + 0.15 * Math.sin(t * 3 + o[4])) * smooth(seg(t, 19.2, 19.45)); m.position.set(o[0] * 1.3, o[1] + Math.sin(t * 2 + o[4]) * 0.3, o[2] * 1.5); m.scale.setScalar(s * 0.85); });
      F.cloudMat.opacity = 0.7 * fade;
    }
    // stink + sweat on the front row (reaction shot)
    if (t >= 20.3 && t < 21.1) {
      let k = 0;
      for (const g of this.G) if (g.seat.row === 0 && g.seat.side > 0) { const h = hp(g); for (let j = 0; j < 2; j++) { const ph = ((t - 20.3) * 1.2 + j * 0.5) % 1; F.put('stink', 8 + k, h.x + (j ? 0.9 : -0.9), h.y + 0.6 + ph * 1.8, h.z, 1.1, Math.sin(ph * Math.PI), 0, Math.floor(t * 9 + k)); k++; } F.put('drop', 1 + k, h.x + 0.8, h.y + 0.5 - ((t * 1.5) % 1) * 0.5, h.z - 0.6, 0.35, 1); }
    }
    // groom: stink + tears
    if (t >= 23.5 && t < 25.2) {
      const h = hp(groom);
      for (let j = 0; j < 3; j++) { const ph = ((t - 23.5) * 1.1 + j / 3) % 1; F.put('stink', 14 + j, h.x + (j - 1) * 0.9, h.y + 0.6 + ph * 2.0, h.z + 0.3, 1.1, Math.sin(ph * Math.PI) * 0.9, 0, Math.floor(t * 9 + j)); }
      if (t > 24.3) for (let i = 0; i < 4; i++) { const ph = ((t - 24.3) * 2 + i / 4) % 1; const s = i % 2 ? 1 : -1; F.put('tear', i, h.x + 0.25 + s * 0.45, h.y - 0.2 - ph * 1.4, h.z + 0.7, 0.26, 1 - ph); }
    }
    // panicking guests' flying tears
    if (t >= 22.6 && t < 24) {
      let i = 0;
      for (const g of this.G) { if (i >= 6) break; if (g.p.scream) continue; const h = hp(g); const ph = (t * 2.5 + i * 0.3) % 1; F.put('tear', i, h.x + (i % 2 ? 0.8 : -0.8) * (1 + ph), h.y + 0.3 - ph * 0.6, h.z, 0.3, 1 - ph); i++; }
    }
    // dust puffs: landing + door slam
    if (t >= LAND_T && t < LAND_T + 0.6) { const p = seg(t, LAND_T, LAND_T + 0.6); for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; F.put('dust', i, LIE.x + Math.cos(a) * (1.5 + p * 2.2), LIE.y + 0.4 + p * 0.8, LIE.z + Math.sin(a) * (2.2 + p * 1.5), 1.2 + p, 1 - p); } }
    if (t >= SLAM_T && t < SLAM_T + 0.6) { const p = seg(t, SLAM_T, SLAM_T + 0.6); for (let i = 0; i < 4; i++) F.put('dust', 4 + i, (i - 1.5) * 2.6 + (i - 1.5) * p * 1.5, 0.6 + p * 0.8, 31.6 + p * 0.6, 1.4 + p, 1 - p); }
    if (t >= 18.78 && t < 19.3) { const p = seg(t, 18.78, 19.3); for (let i = 0; i < 3; i++) F.put('dust', i, 1.6 + (i - 1) * (1.2 + p), 0.5 + p * 0.6, 17.5 + (i - 1) * 1.5, 1.0 + p, 1 - p); }
    // priest glasses glint
    if (t >= 11.05 && t < 11.45) { const h = hp(priest); const p = seg(t, 11.05, 11.45); F.put('sparkle', 0, h.x - 0.35, h.y + 0.15, h.z + 0.72, 0.6 * Math.sin(p * Math.PI), 1, p * 2); }
  }

  // ------------------------------------------------------------------ overlay text (screen space)
  project(v) {
    const p = v.clone().project(this.camera);
    return [(p.x * 0.5 + 0.5) * this.ctx.W, (-p.y * 0.5 + 0.5) * this.ctx.H, p.z];
  }
  overlayItems(t) {
    const O = this.ctx.overlay; const { you, groom, bride } = this.C; const H = this.ctx.H, Wd = this.ctx.W, k = Wd / 1080;
    // HAHAHA bouncing
    if ((t >= 17.0 && t < 19.26) || (t >= 25.6 && t < 28.1)) {
      const h = you.worldHeadPos(new THREE.Vector3());
      const [sx, sy] = this.project(h);
      const items = [[-1.05, -0.75, 0], [1.05, -0.35, 0.33], [0.15, -1.45, 0.66]];
      items.forEach(([dx, dy, off], i) => {
        const ph = ((t * 1.6) + off) % 1;
        const age = t - (t >= 25.6 ? 25.6 : 17.0) - i * 0.12; if (age < 0) return;
        const size = (t >= 18.02 && t < 19.26 ? 96 : 78) * (1 + Math.abs(Math.sin(t * 12 + i)) * 0.15);
        const x = clamp(sx + dx * 270 * k, 250 * k, Wd - 250 * k), y = clamp(sy + dy * 230 * k - Math.abs(Math.sin(t * 9 + i * 2)) * 40 * k, 160 * k, H * 0.45);
        O.comic('HAHAHA', x, y, size, { fill: '#ffe14a', rot: Math.sin(t * 10 + i * 2) * 0.18, scale: easeOutBack(clamp(age / 0.2), 2.5) });
      });
    }
    if (t >= 15.44 && t < 16.2) {
      const age = t - 15.44;
      O.comic('PFFT!', Wd * 0.72, H * 0.27, 110, { fill: '#9be55a', rot: -0.15, scale: easeOutBack(clamp(age / 0.18), 3) * (1 - smooth(seg(t, 15.95, 16.2))) });
    }
    if (t >= 9.0 && t < 9.7) {
      const h = groom.worldHeadPos(new THREE.Vector3()); const [sx, sy] = this.project(h);
      O.label('meh', clamp(sx + 300 * k, 200 * k, Wd - 170 * k), clamp(sy - 260 * k, 180 * k, H * 0.42), 74, t - 9.0);
    }
    if (t >= LAND_T && t < LAND_T + 0.5) O.comic('THUD!', Wd * 0.5, H * 0.3, 150, { fill: '#ffffff', rot: -0.1, scale: easeOutBack(seg(t, LAND_T, LAND_T + 0.15), 3), shadowColor: 'rgba(255,60,40,0.9)' });
    if (t >= SLAM_T && t < SLAM_T + 0.75) O.comic('BANG!', Wd * 0.5, H * 0.24, 170, { fill: '#ffd23a', rot: 0.08, scale: easeOutBack(seg(t, SLAM_T, SLAM_T + 0.15), 3), shadowColor: 'rgba(255,60,40,0.9)' });
    if (t >= 33.32 && t < 33.8) O.comic('GASP!', Wd * 0.3, H * 0.2, 96, { fill: '#9fd8ff', rot: -0.12, scale: easeOutBack(seg(t, 33.32, 33.48), 3) });
    if (t >= 33.36 && t < 33.8) O.comic('?!', Wd * 0.74, H * 0.18, 150, { fill: '#ff5f7a', rot: 0.15, scale: easeOutBack(seg(t, 33.36, 33.5), 3) });
    if (t >= 21.05 && t < 21.5) O.comic('sniff', Wd * 0.7, H * 0.25, 70, { fill: '#c6f59a', rot: 0.1, scale: easeOutBack(seg(t, 21.05, 21.2), 2) });
    if (t >= 13.45 && t < 14.35) O.comic('. . .', Wd * 0.5, H * 0.2, 90, { fill: '#ffffff', scale: easeOutBack(seg(t, 13.45, 13.6), 2) });
    // fades
    if (t > 34.08) O.fadeA = easeInOutSine(seg(t, 34.08, DURATION));
    if (t >= DOOR_BURST && t < DOOR_BURST + 0.12) O.flashA = 0.35 * (1 - seg(t, DOOR_BURST, DOOR_BURST + 0.12));
    if (t < 0.12) O.fadeA = 1 - seg(t, 0, 0.12);
  }

  // ------------------------------------------------------------------ shots
  buildShots() {
    const S = [];
    const add = (t0, t1, o) => S.push(Object.assign({ t0, t1 }, o));
    const P = (p, tg, f, r = 0) => ({ p, t: tg, f, r });
    const youSeatHead = [YOU_SEAT[0], 4.78, YOU_SEAT[1]];
    // 1-2 intro: outside, close on the crazy eyes, swirl above head
    add(0.0, 1.0, { env: 'out', focus: [0, 3, 33, 14], ease: 'linear', a: P([0.15, 4.95, 37.9], [0, 4.62, 33.6], 34, 0.06), b: P([0.1, 4.93, 37.2], [0, 4.62, 33.6], 33, 0.1) });
    add(1.0, 2.1, { env: 'out', focus: [0, 3, 33, 16], a: P([-0.9, 4.95, 40.4], [0, 4.62, 33.6], 38, -0.05), b: P([-0.5, 4.9, 41.4], [0, 4.6, 33.6], 39, -0.02) });
    // 3 wide church
    add(2.1, 3.14, { env: 'in', focus: [0, 3, -10, 46], a: P([0, 9.5, 27.5], [0, 5.5, -40], 52), b: P([0, 8.6, 19], [0, 5.2, -40], 50) });
    // 4 bride at the altar, sparkles
    add(3.14, 4.15, { env: 'in', focus: [-1, 3, -40, 14], a: P([4.6, 5.2, -32.2], [-2.6, 5.0, -40], 36), b: P([3.8, 5.25, -33.0], [-2.6, 5.15, -40], 34) });
    // 5 sneaking in through the back doors
    add(4.15, 5.27, { env: 'in', focus: [1, 3, 24, 20], a: P([0.8, 4.5, 13.8], [2.0, 4.0, 27.5], 40), b: P([1.1, 4.4, 15.8], [2.1, 3.9, 26.0], 38) });
    // 6 slides into the empty back row
    add(5.27, 6.44, { env: 'in', focus: [5, 3, 19, 16], a: P([0.2, 6.2, 13.2], [3.6, 3.4, 20.0], 50), b: P([1.6, 6.0, 13.0], [6.8, 3.6, 20.4], 46) });
    // 7 slow-motion bride close-up
    add(6.44, 7.3, { env: 'in', look: 'dreamy', focus: [-2.6, 4, -40, 10], ease: 'linear', a: P([0.75, 6.1, -36.6], [-2.6, 5.55, -40], 30), b: P([0.15, 6.15, -36.1], [-2.6, 5.6, -40], 28.5) });
    // 8 YOU with hearts
    add(7.3, 7.98, { env: 'in', look: 'dreamy', focus: [6, 3, 20, 12], a: P([YOU_SEAT[0] - 0.4, 5.0, 14.9], [YOU_SEAT[0], 4.45, 20.4], 38), b: P([YOU_SEAT[0] - 0.25, 5.0, 15.4], [YOU_SEAT[0], 4.45, 20.4], 37) });
    // 9-10 groom, flat lighting + meh
    add(7.98, 8.91, { env: 'in', look: 'flat', focus: [2.6, 4, -40, 10], a: P([-3.4, 5.9, -33.6], [2.6, 5.25, -40], 33), b: P([-2.9, 5.9, -34.1], [2.6, 5.3, -40], 32) });
    add(8.91, 9.7, { env: 'in', look: 'flat', focus: [2.6, 4, -40, 8], ease: 'out', a: P([-0.6, 6.1, -36.55], [2.6, 5.58, -40], 30), b: P([-0.35, 6.1, -36.8], [2.6, 5.6, -40], 29) });
    // 11 priest raises hand (low angle)
    add(9.7, 10.98, { env: 'in', focus: [0, 4, -45, 12], a: P([0.4, 3.7, -36.6], [0.0, 5.05, -45], 44), b: P([0.3, 3.8, -37.4], [0.0, 5.2, -45], 42) });
    // 12 priest close-up
    add(10.98, 12.22, { env: 'in', focus: [0, 5, -45, 8], a: P([0.35, 6.3, -40.4], [0, 5.55, -45], 31), b: P([0.25, 6.25, -41.0], [0, 5.6, -45], 30) });
    // 13 church goes quiet: wide from the altar
    add(12.22, 13.36, { env: 'in', look: 'quiet', focus: [0, 3, -10, 46], a: P([0, 9.0, -35], [0, 3.6, 10], 48), b: P([0, 8.6, -32.5], [0, 3.6, 10], 46) });
    // 14 silence: everyone frozen (front row + grandma), locked off
    add(13.36, 14.4, { env: 'in', look: 'frozen', focus: [-9, 3, -26, 16], ease: 'linear', a: P([-4.0, 5.3, -36.2], [-9.5, 4.0, -24], 46), b: P([-4.05, 5.3, -36.0], [-9.5, 4.0, -24], 45.5) });
    // 15 YOU: uh-oh
    add(14.4, 15.25, { env: 'in', focus: [6, 3, 20, 10], a: P([YOU_SEAT[0] - 0.15, 4.95, 15.2], [YOU_SEAT[0], 4.45, 20.4], 36), b: P([YOU_SEAT[0] - 0.15, 4.95, 15.8], [YOU_SEAT[0], 4.45, 20.4], 35) });
    // 16 poop: medium, then quick zoom
    add(15.25, 16.7, { env: 'in', focus: [6, 3, 20, 12], zoom: [15.42, 0.16, 0.74], a: P([YOU_SEAT[0] - 1.6, 5.4, 13.9], [YOU_SEAT[0], 3.9, 20.4], 44), b: P([YOU_SEAT[0] - 1.4, 5.3, 14.2], [YOU_SEAT[0], 4.0, 20.4], 43) });
    // 17 laughing like crazy
    add(16.7, 18.02, { env: 'in', focus: [6, 3, 20, 12], hand: 0.05, a: P([YOU_SEAT[0] - 2.4, 5.6, 13.4], [YOU_SEAT[0], 3.9, 20.4], 42), b: P([YOU_SEAT[0] - 1.9, 5.5, 13.9], [YOU_SEAT[0], 3.9, 20.4], 41) });
    // 18 can't stop: falls off the bench
    add(18.02, 19.26, { env: 'in', focus: [3, 2, 18, 14], hand: 0.05, a: P([-2.2, 6.6, 10.6], [4.6, 2.8, 19.4], 50), b: P([-2.4, 5.8, 10.2], [2.4, 1.6, 17.6], 50) });
    // 19 the smell cloud floats down the aisle (tracking backward)
    add(19.26, 20.28, { env: 'in', focus: [0, 3, 0, 30], ease: 'linear', cloudCam: true });
    // 20 front row reactions: pan across faces
    add(20.28, 21.02, { env: 'in', focus: [11, 3, -27, 14], camFn: (p) => { const xs = [15.2, 11.2, 7.2]; const k = p < 0.3 ? 0 : p < 0.42 ? smooth(seg(p, 0.3, 0.42)) : p < 0.64 ? 1 : p < 0.76 ? 1 + smooth(seg(p, 0.64, 0.76)) : 2; const i = Math.min(1, Math.floor(k)); const x = lerp(xs[i], xs[i + 1], k - i); return { p: [x - 0.3, 5.1, -33.0 + Math.sin(p * 9) * 0.05], t: [x, 4.72, -27.5], f: 33, r: 0 }; } });
    // 21 grandma faints
    add(21.02, 22.27, { env: 'in', focus: [-7, 3, -27, 12], a: P([-5.6, 7.4, -32.6], [-7.2, 4.4, -27.4], 40), b: P([-5.3, 9.6, -31.6], [-7.2, 3.3, -26.6], 42) });
    // 22 guests panic: high wide
    add(22.27, 22.85, { env: 'in', focus: [0, 3, -6, 46], hand: 0.08, a: P([13.5, 12.5, -35.5], [0, 2.5, -2], 50), b: P([12.5, 11.5, -34.0], [0, 2.5, -2], 50) });
    // 23 screaming guests run past the camera
    add(22.85, 23.5, { env: 'in', focus: [0, 3, -8, 20], hand: 0.1, a: P([1.2, 4.6, -17.5], [0, 4.4, -2], 46), b: P([1.4, 4.5, -18.5], [0, 4.6, -2], 46) });
    // 24-25 groom covers his nose
    add(23.5, 24.4, { env: 'in', focus: [2.6, 4, -40, 10], a: P([-2.4, 5.9, -34.6], [2.6, 5.3, -40], 33), b: P([-2.0, 5.9, -35.0], [2.6, 5.35, -40], 32) });
    add(24.4, 25.16, { env: 'in', focus: [2.6, 4, -40, 8], a: P([-0.45, 6.05, -36.7], [2.6, 5.58, -40], 29.5), b: P([-0.3, 6.05, -36.9], [2.6, 5.6, -40], 28.5) });
    // 26 security grabs you
    add(25.16, 26.46, { env: 'in', focus: [0, 3, 10, 16], a: P([-3.4, 6.2, 18.5], [0, 3.4, 9.5], 44), b: P([-2.8, 6.0, 17.0], [0, 3.8, 9.3], 44) });
    // 27 dragged down the aisle (camera tracks ahead of them)
    add(26.46, 27.76, { env: 'in', focus: [0, 3, 18, 22], track: true, hand: 0.05 });
    // 28 thrown at the doors (side view)
    add(27.76, 28.62, { env: 'in', focus: [0, 3, 26, 16], a: P([-2.9, 5.4, 14.4], [0.4, 5.6, 29.5], 52), b: P([-2.5, 5.6, 15.6], [0.4, 6.0, 29.5], 52) });
    // 29 outside: flies out, THUD on the steps
    add(28.62, 29.25, { env: 'out', focus: [0, 0, 35, 18], a: P([11.0, 2.2, 50.0], [0.5, 2.5, 34.5], 42), b: P([10.5, 1.8, 49.0], [0.5, 0.2, 36.0], 42) });
    // 30 doors slam shut
    add(29.25, 30.52, { env: 'out', focus: [0, 2, 34, 18], a: P([-6.4, 1.6, 56], [0, 5.0, 32], 44), b: P([-6.0, 1.7, 54.5], [0, 5.0, 32], 43) });
    // 31-32 slow zooms on the closed doors
    add(30.52, 31.8, { env: 'out', focus: [0, 2, 35, 22], ease: 'linear', a: P([0, 3.0, 62], [0, 6.5, 31], 40), b: P([0, 3.1, 57], [0, 6.5, 31], 39) });
    add(31.8, 32.7, { env: 'out', focus: [0, 4, 32, 14], ease: 'linear', a: P([0.3, 4.6, 50], [0, 6.0, 31], 38), b: P([0.25, 4.7, 46.5], [0, 6.2, 31], 37) });
    // 33 inside: bride raises her hand
    add(32.7, 33.3, { env: 'in', look: 'dreamy2', focus: [-2.6, 4, -40, 12], a: P([-1.0, 5.4, -29.6], [-2.4, 5.4, -40], 39), b: P([-1.2, 5.45, -30.6], [-2.4, 5.5, -40], 38) });
    // 34 groom's jaw drops, guests gasp behind
    add(33.3, 33.8, { env: 'in', focus: [2, 4, -38, 14], zoom: [33.3, 0.12, 0.85], a: P([0.2, 5.9, -34.5], [2.6, 5.45, -40], 34), b: P([0.25, 5.9, -34.7], [2.6, 5.45, -40], 33) });
    // 35 YOU outside, crazy smile, fade out
    add(33.8, 40, { env: 'out', focus: [0, 0, 37, 10], a: P([1.8, 2.2, 45.2], [0.6, 1.3, 37.4], 36), b: P([1.5, 2.1, 44.0], [0.6, 1.35, 37.4], 34) });
    return S;
  }

  shotOverrides(t, i) {
    const { you, bride, groom, grandma } = this.C;
    // grandma faint (global after 21.3)
    if (t >= 20.35) {
      const sn = smooth(seg(t, 20.35, 20.6));
      grandma.face({ eyes: 'squint', mouth: 'wavy' }); grandma.green = 0.5 * sn;
      if (t >= 21.3) {
        const p = easeOutBounce(seg(t, 21.38, 21.85));
        grandma.torso.rotation.x = -1.15 * p; grandma.head.rotation.x = -0.5 * p;
        grandma.legL.rotation.x = -Math.PI / 2 - 0.55 * p; grandma.legR.rotation.x = -Math.PI / 2 - 0.45 * p;
        grandma.armL.rotation.set(-0.6 - 1.6 * p, 0, 0.4 + 0.7 * p); grandma.armR.rotation.set(-2.0 + 0.3 * p, 0, -0.45 - 0.9 * p);
        grandma.face({ eyes: 'swirl', mouth: 'o' });
        if (grandma.fan) grandma.fan.visible = t < 21.42;
        grandma.green = 0.25;
      }
    }
  }

  sprinters(t) {
    // shot 23 (22.85–23.5): two guests run straight at / past the camera in the aisle
    if (t < 22.85 || t >= 23.5) return;
    const p = seg(t, 22.85, 23.5);
    const runners = [this.G[20], this.G[27], this.G[33]];
    const lanes = [[-1.8, 0.0, 0], [2.0, -2.5, 0.15], [-0.2, 4.0, 0.08]];
    runners.forEach((g, i) => {
      if (!g) return;
      const [x, z0, d] = lanes[i];
      const pp = clamp(p - d);
      g.resetPose();
      g.root.position.set(x, 0, lerp(z0, z0 - 15, pp)); g.root.rotation.y = Math.PI;
      if (g.spec.outfit === 'dress') g.skirt.visible = true;
      g.run(t * 16 + i, 1.1); g.armsUpPanic(t, 1, i * 3);
      g.face({ eyes: i === 1 ? 'teary' : 'wide', mouth: 'scream', tears: i === 1 });
    });
  }

  // ------------------------------------------------------------------ frame
  apply(t) {
    const W = this.W, cam = this.camera;
    // reset everyone
    for (const k in this.C) this.C[k].resetPose();
    this.G.forEach((g) => g.resetPose());
    this.base(t);
    let si = this.shots.findIndex((s) => t >= s.t0 && t < s.t1);
    if (si < 0) si = this.shots.length - 1;
    const shot = this.shots[si];
    this.shotOverrides(t, si);
    this.sprinters(t);
    // faces + tints
    for (const k in this.C) this.applyLook(this.C[k], t);
    this.G.forEach((g) => this.applyLook(g, t));

    // camera
    const lp = seg(t, shot.t0, shot.t1);
    const e = shot.ease === 'linear' ? lp : shot.ease === 'out' ? easeOutQuart(lp) : easeInOutSine(lp);
    let A = shot.a, B = shot.b;
    if (shot.track) {
      const gz = this.youZ ?? Z_LIFT;
      const cz = Math.min(gz + 10, 28.6);
      A = B = { p: [-1.6, 6.6, cz], t: [0, 4.6, gz], f: 46, r: 0 };
    }
    if (shot.camFn) { A = B = shot.camFn(lp); }
    if (shot.cloudCam) {
      const cz = Math.max(-29.5, 17 - (t - 19.26) * 40);
      A = B = { p: [1.0, 3.4, cz - 10.5], t: [0, 3.6, cz], f: 58, r: 0 };
    }
    const pos = mix3(A.p, B.p, e), tgt = mix3(A.t, B.t, e);
    let fov = lerp(A.f, B.f, e), roll = lerp(A.r || 0, B.r || 0, e);
    if (shot.zoom) { const [zt, zd, zf] = shot.zoom; if (t >= zt) fov *= lerp(1, zf, easeOutQuart(seg(t, zt, zt + zd))); }
    cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...tgt);
    cam.rotateZ(roll);
    // handheld + shake
    const hand = (shot.hand ?? 0.025);
    const sh = this.shake(t);
    const d = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
    const amp = hand + sh * 0.07;
    cam.translateX(fbm(t * 1.3, 3) * amp * Math.min(d, 12) * 0.25 + noise1(t * 31, 1) * sh * 0.06 * Math.min(d, 10));
    cam.translateY(fbm(t * 1.1, 5) * amp * Math.min(d, 12) * 0.2 + noise1(t * 29, 2) * sh * 0.06 * Math.min(d, 10));
    cam.rotateZ(noise1(t * 23, 4) * sh * 0.025);
    cam.fov = fov; cam.updateProjectionMatrix();
    this.ctx.overlay.shake = [noise1(t * 31, 1) * sh * 16 * (this.ctx.W / 1080), noise1(t * 29, 2) * sh * 16 * (this.ctx.W / 1080)];

    this.environment(shot, t);
    this.fx(t, shot);
    // flames flicker
    W.flames.forEach((f, i) => { const s = 1 + Math.sin(t * 17 + i * 1.3) * 0.08 + Math.sin(t * 29 + i) * 0.05; f.scale.y = f.userData.sy ? f.userData.sy * s : (f.userData.sy = f.scale.y) * s; });
    // dust motes drift
    const pos3 = W.motes.geometry.attributes.position.array, b = W.motesBase;
    for (let i = 0; i < pos3.length; i += 3) { pos3[i] = b[i] + Math.sin(t * 0.3 + i) * 0.4; pos3[i + 1] = b[i + 1] + Math.sin(t * 0.2 + i * 0.7) * 0.5; pos3[i + 2] = b[i + 2] + Math.cos(t * 0.25 + i) * 0.4; }
    W.motes.geometry.attributes.position.needsUpdate = true;
    this.shot = shot; this.shotIndex = si;
    return shot;
  }

  applyLook(c, t) {
    c.applyFace(t);
    const g = c.green || 0;
    const col = new THREE.Color(1, 1, 1).lerp(new THREE.Color('#a8ec7c'), g);
    c.headSideMat.color.copy(col); c.skinMat.color.copy(col);
  }

  environment(shot, t) {
    const W = this.W, L = W.lights, grade = this.ctx.grade.uniforms, bloom = this.ctx.bloom, scene = this.scene;
    this.curFocus = shot.focus;
    const out = shot.env === 'out';
    const doorsOpen = t >= DOOR_BURST - 0.05 && t < SLAM_T + 0.05;
    const seeInside = !out || doorsOpen;
    W.interior.visible = seeInside; W.exterior.visible = out;
    W.outsideGlow.visible = !out;
    W.sky.visible = out;
    for (const g of this.G) g.root.visible = seeInside && g.root.visible;
    for (const k of ['bride', 'groom', 'priest', 'grandma']) this.C[k].root.visible = seeInside;
    // defaults
    grade.sat.value = 1.08; grade.vign.value = 0.32; grade.tint.value.set(1.0, 0.99, 0.97); grade.contrast.value = 1.04; grade.exposure.value = 1.0; grade.lift.value = 0.0;
    bloom.strength = 0.36; bloom.threshold = 0.9; bloom.radius = 0.5;
    if (!out) {
      scene.fog = this.fogIn || (this.fogIn = new THREE.Fog('#f1d2a8', 55, 190));
      scene.background = new THREE.Color('#2a1a10');
      L.hemi.color.set('#fff4e4'); L.hemi.groundColor.set('#8a5a3c'); L.hemi.intensity = 1.55;
      L.key.color.set('#ffe2bc'); L.key.intensity = 2.5;
      L.fill.intensity = 0.55; L.fill.position.set(30, 20, 40);
      L.points.forEach((p) => (p.intensity = 110));
      L.altar.intensity = 260; L.back.intensity = 90;
      const doorOpen = t >= DOOR_BURST && t < SLAM_T + 0.1 ? 1 : 0;
      L.doorway.intensity = doorOpen * 220 + (t > 4.2 && t < 6.0 ? 120 : 0);
      W.glassMats.forEach((m) => (m.emissiveIntensity = 1.6));
      this.fitKey(this.keyDir(0.75, 1.15), shot.focus);
    } else {
      scene.fog = this.fogOut || (this.fogOut = new THREE.Fog('#d8e6f2', 120, 700));
      scene.background = new THREE.Color('#8cc6f2');
      L.hemi.color.set('#e2efff'); L.hemi.groundColor.set('#c8a888'); L.hemi.intensity = 1.9;
      L.key.color.set('#ffdcb0'); L.key.intensity = 3.4;
      L.fill.intensity = 0.7; L.fill.position.set(-40, 15, 80);
      L.points.forEach((p) => (p.intensity = 0));
      L.altar.intensity = 0; L.doorway.intensity = 0; L.back.intensity = 0;
      this.fitKey(this.keyDir(0.6, 0.85), shot.focus);
      bloom.strength = 0.28; bloom.threshold = 0.96;
    }
    if (shot.look === 'dreamy') { grade.tint.value.set(1.05, 0.96, 1.02); bloom.strength = 0.6; bloom.threshold = 0.78; grade.vign.value = 0.45; grade.lift.value = 0.012; }
    if (shot.look === 'dreamy2') { grade.tint.value.set(1.05, 0.98, 1.0); bloom.strength = 0.6; }
    if (shot.look === 'flat') { L.key.intensity = 0.25; L.hemi.intensity = 1.9; L.points.forEach((p) => (p.intensity = 40)); L.altar.intensity = 0; grade.sat.value = 0.5; grade.contrast.value = 0.86; grade.tint.value.set(0.97, 1.0, 1.0); bloom.strength = 0.1; grade.vign.value = 0.1; }
    if (shot.look === 'quiet') { grade.sat.value = 0.9; grade.vign.value = 0.45; }
    if (shot.look === 'frozen') { grade.sat.value = 0.45; grade.vign.value = 0.6; grade.tint.value.set(0.96, 0.98, 1.04); bloom.strength = 0.2; }
  }

  // key light comes from the camera side (rotated left, raised) so faces are always lit
  keyDir(side, up) {
    const c = this.camera.position, f = this.shot0Focus || [0, 0, 0];
    const dx = c.x - this.curFocus[0], dz = c.z - this.curFocus[2];
    const l = Math.hypot(dx, dz) || 1; const hx = dx / l, hz = dz / l;
    // rotate toward camera's left
    const rx = hx * Math.cos(side) - hz * Math.sin(side), rz = hx * Math.sin(side) + hz * Math.cos(side);
    return [rx, up, rz];
  }
  fitKey(dir, focus) {
    const L = this.W.lights.key;
    const [x, y, z, s] = focus;
    const d = new THREE.Vector3(...dir).normalize();
    L.target.position.set(x, y, z);
    L.position.set(x + d.x * 90, y + d.y * 90, z + d.z * 90);
    const c = L.shadow.camera; c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 10; c.far = 200; c.updateProjectionMatrix();
    L.target.updateMatrixWorld();
  }

  captionAt(t) {
    for (const c of CAPTIONS) if (t >= c.t0 - 0.001 && t < c.t1) return { words: c.wordsT, loud: !!c.loud, big: !!c.big };
    return null;
  }
}

function pathLen(path) { let L = 0; for (let i = 0; i < path.length - 1; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); return L; }
function pathAt(path, d) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    if (d <= L) { const f = d / L; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), (b[0] - a[0]) / L, (b[1] - a[1]) / L, false]; }
    d -= L;
  }
  const a = path[path.length - 2], b = path[path.length - 1];
  return [b[0], b[1], b[0] - a[0], b[1] - a[1], true];
}

// The talking dog: low-poly faceted brown dog with floppy ears, pixel eyes,
// a hinged jaw (opens when he talks) and a high-tech collar whose light glows.
import * as THREE from 'three';
import { mat, mesh, bx, faceted } from './chars.js';
import { DT } from './dtex.js';

const BLACK = new THREE.MeshBasicMaterial({ color: 0x0d0d0d });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const CAVITY = new THREE.MeshBasicMaterial({ color: 0x5a1420 });
const TONGUE = new THREE.MeshStandardMaterial({ color: 0xf06a86, roughness: 0.55, flatShading: true });
const NOSE = new THREE.MeshStandardMaterial({ color: 0x1b1214, roughness: 0.25, metalness: 0.1, flatShading: true });
const PAD = new THREE.MeshStandardMaterial({ color: 0x4a2a2e, roughness: 0.7, flatShading: true });
const METAL = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.32, metalness: 0.65, flatShading: true });
const hangBox = (w, h, d, m) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0); return mesh(g, m); };

export class Dog {
  constructor() {
    const fur = mat(DT.fur), dark = mat(DT.furDark), cream = mat(DT.cream);
    this.mats = { fur, dark, cream };
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.body.add(this.hips);
    this.hips.add(mesh(faceted(0.17, 41, [1.0, 0.95, 1.05], 1, 0.08), fur));
    this.spine = new THREE.Group(); this.hips.add(this.spine);
    const torso = mesh(faceted(0.18, 42, [0.95, 0.92, 1.55], 1, 0.08), fur); torso.position.set(0, 0.02, 0.2); this.spine.add(torso);
    const belly = mesh(faceted(0.14, 43, [0.85, 0.7, 1.25], 1, 0.06), cream); belly.position.set(0, -0.07, 0.24); this.spine.add(belly);
    this.chest = new THREE.Group(); this.chest.position.set(0, 0.02, 0.42); this.spine.add(this.chest);
    this.chest.add(mesh(faceted(0.16, 44, [0.95, 1.0, 0.9], 1, 0.08), fur));
    const bib = mesh(faceted(0.12, 45, [0.9, 1.05, 0.6], 1, 0.06), cream); bib.position.set(0, -0.02, 0.1); this.chest.add(bib);

    this.neck = new THREE.Group(); this.neck.position.set(0, 0.07, 0.04); this.chest.add(this.neck);
    const nk = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), fur); nk.position.y = 0.1; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.set(0, 0.22, 0.0); this.neck.add(this.head);
    this.buildHead(fur, dark, cream);
    this.buildCollar();

    this.front = {}; this.rear = {};
    for (const s of ['L', 'R']) { this.front[s] = this.buildFront(s, fur, cream); this.rear[s] = this.buildRear(s, fur, cream); }
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.07, -0.15); this.hips.add(this.tail);
    let parent = this.tail; this.tailSeg = [];
    for (let k = 0; k < 3; k++) {
      const sg = new THREE.Group(); if (k) sg.position.y = 0.085; parent.add(sg);
      const g = new THREE.BoxGeometry(0.065 - k * 0.012, 0.095, 0.065 - k * 0.012); g.translate(0, 0.045, 0);
      sg.add(mesh(g, k === 2 ? cream : fur)); this.tailSeg.push(sg); parent = sg;
    }
    this.reset();
  }

  // ------------------------------------------------------------------ head
  surfZ(x, y) { const R = 0.19, s = this.hs; return s[2] * Math.sqrt(Math.max(0.0004, R * R - (x / s[0]) ** 2 - (y / s[1]) ** 2)); }
  place(m, x, y, dz = 0) { const z = this.surfZ(x, y); m.position.set(x, y, z + dz); m.rotation.y = Math.atan2(x, z) * 0.8; m.rotation.x = -Math.atan2(y, z) * 0.5; this.head.add(m); return m; }

  buildHead(fur, dark, cream) {
    const hs = this.hs = [1.05, 0.95, 0.98];
    this.head.add(mesh(faceted(0.19, 46, hs, 1, 0.08), fur));
    // muzzle (its underside is where the jaw hinges)
    const muz = mesh(faceted(0.105, 47, [1.0, 0.68, 1.05], 1, 0.06), cream); muz.position.set(0, -0.045, 0.155); this.head.add(muz);
    const nose = mesh(faceted(0.042, 48, [1.35, 0.95, 1.0], 0, 0.05), NOSE); nose.position.set(0, -0.012, 0.262); this.head.add(nose);
    const nhl = bx(0.016, 0.01, 0.01, WHITE, false); nhl.position.set(-0.016, 0.006, 0.296); this.head.add(nhl);
    const lip = bx(0.012, 0.035, 0.012, BLACK, false); lip.position.set(0, -0.06, 0.252); this.head.add(lip);
    this.smile = new THREE.Group();
    for (const k of [-1, 1]) { const b = bx(0.05, 0.012, 0.012, BLACK, false); b.position.set(k * 0.026, -0.08, 0.246 - Math.abs(k) * 0.008); b.rotation.z = k * 0.45; b.rotation.y = -k * 0.4; this.smile.add(b); }
    this.head.add(this.smile);
    // mouth cavity (hidden inside the closed jaw) + hinged lower jaw with tongue
    const cav = bx(0.08, 0.03, 0.1, CAVITY, false); cav.position.set(0, -0.1, 0.16); this.head.add(cav);
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.085, 0.075); this.head.add(this.jaw);
    const jm = mesh(faceted(0.085, 55, [0.85, 0.42, 1.05], 1, 0.05), cream, false); jm.position.set(0, -0.022, 0.075); this.jaw.add(jm);
    this.tongue = bx(0.058, 0.012, 0.08, TONGUE, false); this.tongue.position.set(0, 0.008, 0.09); this.jaw.add(this.tongue);
    // pixel eyes, brows
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group(); this.place(g, side * 0.078, 0.035, -0.006);
      const pupil = bx(0.052, 0.072, 0.03, BLACK, false); g.add(pupil);
      const hl = bx(0.018, 0.018, 0.012, WHITE, false); hl.position.set(0.012, 0.02, 0.017); g.add(hl);
      const hl2 = bx(0.01, 0.01, 0.012, WHITE, false); hl2.position.set(-0.012, -0.018, 0.017); g.add(hl2);
      const caret = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.036, 0.013, 0.03, BLACK, false); b.position.set(k * 0.013, 0, 0); b.rotation.z = -k * 0.6; caret.add(b); }
      g.add(caret);
      const brow = bx(0.06, 0.018, 0.03, mat(0x4a2a14), false); this.place(brow, side * 0.075, 0.115, 0.0);
      this.eyes.push({ g, pupil, hl, hl2, caret, brow, side });
    }
    // floppy ears (pivot at the top of the head)
    this.ears = [];
    for (const side of [1, -1]) {
      const e = new THREE.Group(); e.position.set(side * 0.155, 0.1, -0.015); this.head.add(e);
      const m = hangBox(0.045, 0.27, 0.13, dark); m.position.x = side * 0.02; e.add(m);
      const tip = mesh(faceted(0.065, 49 + side, [0.4, 0.5, 1.0], 0, 0.04), dark); tip.position.set(side * 0.02, -0.27, 0); e.add(tip);
      this.ears.push({ e, side });
    }
  }

  buildCollar() {
    const c = this.collar = new THREE.Group(); c.position.y = 0.045; this.neck.add(c);
    const band = mesh(new THREE.TorusGeometry(0.122, 0.028, 6, 16), METAL); band.rotation.x = Math.PI / 2; c.add(band);
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x3dff6a });
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.124, 0.008, 4, 24), this.ledMat); stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.012; c.add(stripe);
    const stripe2 = stripe.clone(); stripe2.position.y = -0.012; c.add(stripe2);
    const dev = bx(0.085, 0.07, 0.04, METAL, false); dev.position.set(0, -0.006, 0.142); c.add(dev);
    const led = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10), this.ledMat); led.rotation.x = Math.PI / 2; led.position.set(0, 0.0, 0.165); c.add(led);
    for (const k of [-1, 1]) { const gr = bx(0.004, 0.03, 0.006, BLACK, false); gr.position.set(k * 0.032, -0.008, 0.163); c.add(gr); }
    const ant = bx(0.008, 0.05, 0.008, METAL, false); ant.position.set(0.032, 0.04, 0.142); c.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), this.ledMat); antTip.position.set(0.032, 0.068, 0.142); c.add(antTip);
    this.led = led;
    this.glowLight = new THREE.PointLight(0x3dff6a, 0, 0.7, 2); this.glowLight.position.set(0, -0.02, 0.3); c.add(this.glowLight);
  }
  // collar light: level 0 (off) .. 1 (bright), color hex
  collarLight(level, color = 0x3dff6a) {
    const col = new THREE.Color(color);
    this.ledMat.color.copy(col).multiplyScalar(0.25 + 0.75 * level);
    this.glowLight.color.copy(col); this.glowLight.intensity = 0.12 * level;
    this.collarLevel = level; this.collarColor = color;
  }
  ledWorld(v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.led.getWorldPosition(v); }

  // ------------------------------------------------------------------ legs
  buildFront(side, fur, cream) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group(); sh.position.set(sx * 0.085, -0.07, 0.03); this.chest.add(sh);
    const leg = new THREE.Group(); sh.add(leg);
    leg.add(hangBox(0.072, 0.3, 0.078, fur));
    const wr = new THREE.Group(); wr.position.y = -0.3; sh.add(wr);
    const paw = bx(0.1, 0.05, 0.125, cream); paw.position.set(0, -0.025, 0.025); wr.add(paw);
    for (let k = -1; k <= 1; k++) { const toe = bx(0.012, 0.03, 0.012, mat(0xc8a878), false); toe.position.set(k * 0.028, -0.02, 0.089); wr.add(toe); }
    const pad = bx(0.06, 0.008, 0.065, PAD, false); pad.position.set(0, -0.052, 0.02); wr.add(pad);
    return { sh, leg, wr, sx, len: 0.3 };
  }
  buildRear(side, fur, cream) {
    const sx = side === 'L' ? 1 : -1;
    const th = new THREE.Group(); th.position.set(sx * 0.12, -0.02, 0.0); this.hips.add(th);
    const thigh = mesh(faceted(0.1, 53 + sx, [0.8, 1.25, 1.1], 1, 0.06), fur); thigh.position.set(0, -0.08, 0.01); th.add(thigh);
    const hk = new THREE.Group(); hk.position.y = -0.17; th.add(hk);
    hk.add(hangBox(0.07, 0.17, 0.08, fur));
    const ft = new THREE.Group(); ft.position.y = -0.17; hk.add(ft);
    const foot = bx(0.09, 0.045, 0.15, cream); foot.position.set(0, -0.02, 0.05); ft.add(foot);
    return { th, hk, ft, sx };
  }

  // ------------------------------------------------------------------ poses
  reset() {
    this.root.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.hips.position.set(0, 0.4, -0.2); this.hips.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.neck.rotation.set(0.55, 0, 0); this.head.rotation.set(-0.55, 0, 0); this.head.scale.setScalar(1);
    for (const s of ['L', 'R']) {
      const f = this.front[s]; f.sh.rotation.set(0, 0, 0); f.wr.rotation.set(0, 0, 0); f.leg.scale.set(1, 1, 1); f.wr.position.y = -0.3;
      const r = this.rear[s]; r.th.rotation.set(0, 0, 0); r.hk.rotation.set(0, 0, 0); r.ft.rotation.set(0, 0, 0);
    }
    this.tail.rotation.set(-0.6, 0, 0); this.tailSeg.forEach(sg => sg.rotation.set(0.25, 0, 0));
    this.jaw.rotation.set(0, 0, 0); this.tongue.scale.set(1, 1, 1); this.tongue.position.z = 0.09;
    this.collar.visible = true;
    this.pitch = 0; this.neckLean = 0.55;
    this.face({});
    this.collarLight(1, 0x3dff6a);
  }
  // world-relative angles: spine pitch s (neg = front up), neck lean n (from vertical, + forward), head pitch h (+ = looking down)
  aim(s, n, h, yaw = 0, roll = 0) {
    this.spine.rotation.x = s; this.pitch = s; this.neckLean = n;
    this.neck.rotation.set(n - s, yaw * 0.4, 0);
    this.head.rotation.set(h - n, yaw * 0.6, roll);
  }
  // stretch a front leg so the paw lands at world height y (paw height 0.05)
  plantFront(side, y) {
    const f = this.front[side];
    this.root.updateMatrixWorld(true);
    const p = f.sh.getWorldPosition(new THREE.Vector3());
    const L = THREE.MathUtils.clamp((p.y - y - 0.05) / this.root.scale.y, 0.15, 0.6);
    f.leg.scale.y = L / 0.3; f.wr.position.y = -L;
  }
  sit(seatY = 0, { s = -0.85, n = 0.3, h = 0.05, yaw = 0 } = {}) {
    this.hips.position.set(0, seatY + 0.13, -0.12);
    this.aim(s, n, h, yaw);
    for (const k of ['L', 'R']) {
      const f = this.front[k]; f.sh.rotation.set(-s - 0.05, 0, 0); f.wr.rotation.set(0, 0, 0);
      const r = this.rear[k]; r.th.rotation.set(-1.75, 0, r.sx * 0.15); r.hk.rotation.set(2.5, 0, 0); r.ft.rotation.set(-0.75, 0, 0);
      this.plantFront(k, seatY);
    }
    this.tail.rotation.set(-1.4, 0, 0); this.tailSeg.forEach(sg => sg.rotation.set(0.2, 0, 0));
  }
  stand({ n = 0.5, h = 0.0, yaw = 0 } = {}) {
    this.hips.position.set(0, 0.4, -0.2);
    this.aim(0, n, h, yaw);
    for (const k of ['L', 'R']) { this.front[k].sh.rotation.set(0, 0, 0); this.front[k].wr.rotation.set(0, 0, 0); this.plantFront(k, 0); }
  }
  walk(phase, amp = 1) {
    const s = Math.sin(phase);
    this.front.L.sh.rotation.x = 0.45 * amp * s; this.front.R.sh.rotation.x = -0.45 * amp * s;
    this.rear.L.th.rotation.x = -0.45 * amp * s; this.rear.R.th.rotation.x = 0.45 * amp * s;
    this.rear.L.hk.rotation.x = 0.35 * amp * Math.max(0, s); this.rear.R.hk.rotation.x = 0.35 * amp * Math.max(0, -s);
    this.body.position.y = 0.02 * amp * Math.abs(Math.cos(phase));
    this.tail.rotation.set(-1.0, 0.5 * Math.sin(phase * 2), 0);
  }
  // lying on the belly (in bed): chin down, front paws forward
  lie(bedY = 0, { n = 1.2, h = 1.35 } = {}) {
    this.hips.position.set(0, bedY + 0.12, -0.2);
    this.aim(0, n, h);
    for (const k of ['L', 'R']) {
      const f = this.front[k]; f.sh.rotation.set(-1.45, 0, 0); f.wr.rotation.set(1.3, 0, 0); f.leg.scale.y = 0.9; f.wr.position.y = -0.27;
      const r = this.rear[k]; r.th.rotation.set(-1.5, 0, r.sx * 0.3); r.hk.rotation.set(2.6, 0, 0); r.ft.rotation.set(-1.0, 0, 0);
    }
    this.tail.rotation.set(-2.6, 0, 0);
  }
  wag(t, amt = 1) { this.tail.rotation.y = 0.7 * amt * Math.sin(t * 14); this.tailSeg.forEach((sg, i) => { sg.rotation.z = 0.25 * amt * Math.sin(t * 14 - i * 0.8); }); }
  earFlop(t, amt = 1, lift = 0) {
    for (const e of this.ears) e.e.rotation.set(0.05 * Math.sin(t * 9 + e.side) * amt, 0, e.side * (0.22 + lift + 0.08 * amt * Math.sin(t * 7 + e.side * 1.3)));
  }

  face({ eyes = 'normal', brows = 'neutral', open = 0, smile = false, look = [0, 0], blink = 0, tongue = false, eyeScale = 1 } = {}) {
    for (const e of this.eyes) {
      const s = e.side;
      e.pupil.visible = eyes !== 'happy' && eyes !== 'closed';
      e.caret.visible = eyes === 'happy' || eyes === 'closed';
      e.caret.rotation.z = eyes === 'closed' ? Math.PI : 0;
      e.caret.scale.set(1, eyes === 'closed' ? 0.6 : 1, 1);
      e.hl.visible = e.pupil.visible; e.hl2.visible = eyes === 'sad' || eyes === 'wide' || eyes === 'sparkle';
      let sy = 1, sx = 1;
      if (eyes === 'wide') { sy = 1.35; sx = 1.2; }
      if (eyes === 'sparkle' || eyes === 'sad') { sy = 1.25; sx = 1.2; }
      if (eyes === 'half') sy = 0.45;
      if (eyes === 'squint') sy = 0.3;
      sy *= Math.max(0.08, 1 - blink);
      e.pupil.scale.set(sx * eyeScale, sy * eyeScale, 1);
      e.pupil.position.set(look[0] * 0.02, look[1] * 0.02 - (eyes === 'half' ? 0.012 : 0), 0);
      e.hl.position.set(0.012 * sx + look[0] * 0.02, 0.02 * sy + look[1] * 0.02, 0.017);
      e.hl.visible = e.hl.visible && blink < 0.6 && eyes !== 'half';
      e.hl2.position.set(-0.012 * sx + look[0] * 0.02, -0.018 * sy + look[1] * 0.02, 0.017);
      let rz = 0, y = 0.115;
      if (brows === 'worried' || eyes === 'sad') { rz = -s * 0.42; y += 0.012; }
      if (brows === 'angry') { rz = s * 0.4; y -= 0.012; }
      if (brows === 'raised') y += 0.03;
      if (brows === 'flat' || eyes === 'half') { y -= 0.02; }
      e.brow.position.y = y; e.brow.rotation.z = rz;
    }
    this.jaw.rotation.x = 0.5 * open;
    this.smile.visible = smile && open < 0.1;
    this.tongue.position.z = tongue ? 0.13 : 0.09;
    this.tongue.scale.set(1, 1, tongue ? 1.4 : 1);
  }

  headWorld(v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.head.getWorldPosition(v); }
  pawWorld(side, v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.front[side].wr.getWorldPosition(v); }
  at(x, z, rotY = 0, y = 0) { this.root.position.set(x, y, z); this.root.rotation.set(0, rotY, 0); return this; }
}

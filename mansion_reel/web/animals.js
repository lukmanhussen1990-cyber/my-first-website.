// Animals: the two male chinstrap penguins (Roy and Silo), the egg + the baby penguin, street pigeons.
// Pure function of p + t. Penguins face +Z at rotY 0.
import * as THREE from 'three';
import { mat, tex, clamp, lerp, smooth, hash1, noise1, v3, rng, canvas } from './lib.js';
import { PENGUINS, STREET } from './layout.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; m.name = n; return m; }

// body texture (lathe UVs: u around, front centre at u = 0.25 because LatheGeometry starts at +Z... see below)
function penguinBodyCanvas(seed) {
  const R = rng(seed), W = 64, H = 64;
  const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;        // v up
    // lathe u = 0 at +Z (front) going around through +X; front belly = |u| near 0 / 1
    const du = Math.min(u, 1 - u);                          // 0 at the front
    const belly = du < 0.12 + 0.035 * Math.sin(v * Math.PI) && v < 0.9;
    let col = belly ? [238, 236, 230] : [28, 30, 36];
    if (!belly && du < 0.15 + 0.035 * Math.sin(v * Math.PI) && v < 0.88) col = [64, 66, 74];  // soft edge
    const n = (R() - 0.5) * 12;
    const i = (y * W + x) * 4; img.data[i] = col[0] + n; img.data[i + 1] = col[1] + n; img.data[i + 2] = col[2] + n; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// head: black cap, white face with the black chinstrap line; eyes drawn per expression
function penguinHeadSet(seed) {
  const cache = new Map();
  return (eyes) => {
    if (cache.has(eyes)) return cache.get(eyes);
    const S = 64, c = canvas(S, S), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const R = rng(seed);
    // sphere UV: u around (u = 0.25 is +Z front for SphereGeometry), v up
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = 1 - (y + 0.5) / S;
      const du = Math.abs(u - 0.25);
      let col = [26, 28, 34];                                   // black cap / back of the head
      const faceWhite = du < 0.17 && v < 0.6;                   // white face (front, below the cap)
      if (faceWhite) col = [240, 238, 232];
      if (du < 0.22 && Math.abs(v - (0.3 + du * 0.6)) < 0.03) col = [24, 24, 28];   // chinstrap line
      if (v < 0.2) col = du < 0.24 ? [236, 234, 228] : [26, 28, 34];                 // throat
      const n = (R() - 0.5) * 10;
      g.fillStyle = `rgb(${col[0] + n},${col[1] + n},${col[2] + n})`; g.fillRect(x, y, 1, 1);
    }
    // eyes (u = 0.25 +- 0.075, v ~ 0.5)
    for (const sd of [-1, 1]) {
      const ex = Math.round((0.25 + sd * 0.07) * S), ey = Math.round((1 - 0.53) * S);
      g.fillStyle = '#100c0c';
      if (eyes === 'happy') { for (let i = -3; i <= 3; i++) g.fillRect(ex + i, ey - 1 + Math.abs(i) * 0.6, 1, 2); }
      else if (eyes === 'closed') g.fillRect(ex - 3, ey, 6, 2);
      else if (eyes === 'heart') { g.fillStyle = '#e83a6a'; g.fillRect(ex - 3, ey - 2, 2, 2); g.fillRect(ex + 1, ey - 2, 2, 2); g.fillRect(ex - 3, ey, 6, 2); g.fillRect(ex - 2, ey + 2, 4, 1); g.fillRect(ex - 1, ey + 3, 2, 1); }
      else { g.fillRect(ex - 2, ey - 3, 5, 6); g.fillStyle = '#ffffff'; g.fillRect(ex - 1, ey - 2, 1, 1); }
    }
    const t = tex(c); t.wrapS = THREE.RepeatWrapping;
    cache.set(eyes, t);
    return t;
  };
}

class Penguin {
  constructor(world, name, o) {
    this.name = name; this.o = o;
    const k = (this.k = o.scale || 1);
    this.root = new THREE.Group(); this.root.name = name; world.scene.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    const bodyM = mat(tex(penguinBodyCanvas(o.seed || 3)), { rough: 0.6 });
    const prof = [[0, 0], [0.1, 0.02], [0.15, 0.12], [0.162, 0.25], [0.15, 0.38], [0.115, 0.48], [0.08, 0.54], [0, 0.56]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
    const bg = new THREE.LatheGeometry(prof, 14); bg.scale(1, 1, 0.86);
    this.bodyMesh = msh(bg, bodyM, `${name}.body`); this.bodyMesh.position.y = 0.035 * k; this.body.add(this.bodyMesh);
    // head
    this.head = new THREE.Group(); this.head.position.set(0, 0.58 * k, 0.015 * k); this.body.add(this.head);
    this.headSet = penguinHeadSet((o.seed || 3) + 7);
    this.headM = mat(this.headSet('open'), { rough: 0.6 });
    const hg = new THREE.SphereGeometry(0.105 * k, 14, 10); hg.scale(1, 1.02, 1.0);
    this.headMesh = msh(hg, this.headM, `${name}.head`); this.head.add(this.headMesh);
    const beakM = mat('#1a1616', { rough: 0.5 });
    const beak = msh(new THREE.ConeGeometry(0.022 * k, 0.07 * k, 5), beakM, `${name}.beak`); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.012 * k, 0.12 * k); this.head.add(beak);
    // flippers (pivot at the shoulder)
    const flM = mat('#1c1e24', { rough: 0.6 });
    this.flips = [-1, 1].map((sd) => {
      const piv = new THREE.Group(); piv.position.set(sd * 0.14 * k, 0.43 * k, 0); this.body.add(piv);
      const fg = new THREE.BoxGeometry(0.03 * k, 0.26 * k, 0.085 * k); fg.translate(0, -0.13 * k, 0);
      const f = msh(fg, flM, `${name}.flipper`); f.rotation.z = sd * 0.12; piv.add(f);
      piv.userData.sd = sd; return piv;
    });
    // feet + tail
    const footM = mat('#e89a8a', { rough: 0.7 });
    this.feet = [-1, 1].map((sd) => { const f = msh(new THREE.BoxGeometry(0.07 * k, 0.025 * k, 0.11 * k), footM, `${name}.foot`); f.position.set(sd * 0.065 * k, 0.012 * k, 0.05 * k); this.root.add(f); return f; });
    const tail = msh(new THREE.ConeGeometry(0.05 * k, 0.1 * k, 4), flM, `${name}.tail`); tail.rotation.x = -2.2; tail.position.set(0, 0.07 * k, -0.15 * k); this.body.add(tail);
    this.p = this.defaults();
  }
  defaults() { return { pos: this.o.pos.slice(), y: this.o.y ?? 0.25, rotY: this.o.rotY ?? 0, visible: false, headYaw: 0, headPitch: 0, headRoll: 0,
    lookAt: null, flapL: 0, flapR: 0, waddle: 0, lean: 0, leanSide: 0, squash: 0, eyes: 'open', hop: 0 }; }
  headPos() { this.head.updateMatrixWorld(true); return V().setFromMatrixPosition(this.head.matrixWorld); }
  beakPos() { this.head.updateMatrixWorld(true); return V(0, -0.012 * this.k, 0.15 * this.k).applyMatrix4(this.head.matrixWorld); }
  flipperTip(side = 1) { const f = this.flips[side > 0 ? 1 : 0]; f.updateMatrixWorld(true); return V(0, -0.24 * this.k, 0).applyMatrix4(f.matrixWorld); }
  solve(t) {
    const p = this.p, k = this.k;
    this.root.visible = p.visible; if (!p.visible) return;
    const wob = Math.sin(p.waddle * Math.PI * 2);
    this.root.position.set(p.pos[0], p.y + Math.abs(wob) * 0.012 * k * (p.waddle ? 1 : 0) + p.hop * 0.08 * k, p.pos[1]);
    this.root.rotation.set(0, p.rotY, 0);
    const breathe = Math.sin(t * 2.1 + k * 5) * 0.01;
    this.body.rotation.set(p.lean, 0, p.leanSide + wob * 0.12);
    this.body.scale.set(1 + p.squash * 0.08, 1 - p.squash * 0.1 + breathe, 1 + p.squash * 0.08);
    let yaw = p.headYaw, pitch = p.headPitch;
    if (p.lookAt) {
      this.root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
      const d = v3(p.lookAt).applyMatrix4(inv).sub(this.head.position);
      yaw += clamp(Math.atan2(d.x, d.z), -1.3, 1.3); pitch += clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.6);
    }
    this.head.rotation.set(-pitch, yaw, p.headRoll, 'YXZ');
    const tx = this.headSet(p.eyes); if (this.headM.map !== tx) { this.headM.map = tx; this.headM.needsUpdate = true; }
    for (const f of this.flips) { const sd = f.userData.sd, fl = sd < 0 ? p.flapL : p.flapR; f.rotation.set(0, 0, sd * (0.08 + fl * 1.25)); }
    this.feet.forEach((f, i) => { f.rotation.x = p.waddle ? Math.max(0, (i ? -wob : wob)) * 0.4 : 0; });
  }
}

// the egg (two halves) + the chick
class Hatch {
  constructor(world) {
    this.name = 'hatch';
    this.root = new THREE.Group(); this.root.name = 'egg'; world.scene.add(this.root);
    const eggM = mat('#f2eee2', { rough: 0.5 });
    const prof = (y0, y1) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = lerp(y0, y1, i / 8); const y = Math.cos(a), r = Math.sin(a); pts.push(new THREE.Vector2(r * 0.055 * (y > 0 ? 0.9 : 1), y * 0.075)); } return pts; };
    this.bottom = msh(new THREE.LatheGeometry(prof(Math.PI, Math.PI * 0.48), 12), eggM, 'egg.bottom'); this.root.add(this.bottom);
    this.top = new THREE.Group(); this.root.add(this.top);
    this.topMesh = msh(new THREE.LatheGeometry(prof(Math.PI * 0.48, 0), 12), eggM, 'egg.top'); this.top.add(this.topMesh);
    for (const m of [this.bottom, this.topMesh]) m.material.side = THREE.DoubleSide;
    // crack line (dark zig-zag ring)
    const crack = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; crack.push(V(Math.cos(a) * 0.056, 0.004 + (i % 2 ? 0.008 : -0.006), Math.sin(a) * 0.056)); }
    this.crack = new THREE.Line(new THREE.BufferGeometry().setFromPoints(crack), new THREE.LineBasicMaterial({ color: '#4a3a2a' })); this.crack.name = 'egg.crack'; this.root.add(this.crack);
    // chick: fluffy grey ball + head + beak + eyes
    this.chick = new THREE.Group(); this.chick.name = 'chick'; this.root.add(this.chick);
    const fluffM = mat(tex(fluffCanvas()), { rough: 0.95 });
    const bg = new THREE.IcosahedronGeometry(0.075, 2); const pp = bg.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const j = 1 + (hash1(x * 91 + y * 37 + z * 13) - 0.5) * 0.18; pp.setXYZ(i, x * j, y * j * 0.95, z * j); }
    bg.computeVertexNormals();
    this.chickBody = msh(bg, fluffM, 'chick.body'); this.chickBody.position.y = 0.07; this.chick.add(this.chickBody);
    this.chickHead = new THREE.Group(); this.chickHead.position.set(0, 0.155, 0.01); this.chick.add(this.chickHead);
    this.chickHeadMesh = msh(new THREE.IcosahedronGeometry(0.05, 2), fluffM, 'chick.head'); this.chickHead.add(this.chickHeadMesh);
    const bk = msh(new THREE.ConeGeometry(0.012, 0.03, 4), mat('#2a2222'), 'chick.beak'); bk.rotation.x = Math.PI / 2; bk.position.set(0, -0.005, 0.055); this.chickHead.add(bk);
    const eyeM = mat('#0c0a0a', { rough: 0.3 });
    for (const sd of [-1, 1]) { const e = msh(new THREE.BoxGeometry(0.011, 0.014, 0.006), eyeM, 'chick.eye', { cast: false }); e.position.set(sd * 0.02, 0.012, 0.045); this.chickHead.add(e); }
    this.p = this.defaults();
  }
  defaults() { return { pos: PENGUINS.nest.slice(), y: 0.27, rotY: 0, visible: false, wobble: 0, crack: 0, open: 0, chick: 0, chickYaw: 0, chickPitch: 0, t0: 0 }; }
  solve(t) {
    const p = this.p; this.root.visible = p.visible; if (!p.visible) return;
    this.root.position.set(p.pos[0], p.y, p.pos[1]); this.root.rotation.set(0, p.rotY, 0);
    const wb = p.wobble * Math.sin(t * 26) * 0.18;
    this.bottom.rotation.set(0, 0, wb); this.top.rotation.set(0, 0, wb);
    this.bottom.position.y = 0.075; this.top.position.y = 0.075; this.crack.position.y = 0.075; this.crack.rotation.z = wb;
    this.crack.visible = p.crack > 0.3 && p.open < 0.05;
    const o = smooth(clamp(p.open));
    this.top.position.set(o * 0.05, 0.075 + o * 0.14, -o * 0.02); this.top.rotation.set(-o * 0.7, 0, wb + o * 0.9);
    this.top.visible = o < 0.98;
    const ch = smooth(clamp(p.chick));
    this.chick.visible = ch > 0.01;
    this.chick.position.set(0, -0.05 + ch * 0.07, 0); this.chick.scale.setScalar(0.7 + ch * 0.3);
    this.chickHead.rotation.set(-p.chickPitch, p.chickYaw, Math.sin(t * 7) * 0.08);
    this.bottom.visible = true;
  }
  chickHeadPos() { this.chickHead.updateMatrixWorld(true); return V().setFromMatrixPosition(this.chickHead.matrixWorld); }
}
function fluffCanvas() {
  const R = rng(77), S = 32, c = canvas(S, S), g = c.getContext('2d');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 150 + Math.floor(R() * 50); g.fillStyle = `rgb(${v - 6},${v - 4},${v})`; g.fillRect(x, y, 1, 1); }
  return c;
}

// street pigeons (pecking)
class Pigeon {
  constructor(world, i) {
    this.name = `pigeon${i}`; this.i = i;
    this.root = new THREE.Group(); this.root.name = this.name; world.scene.add(this.root);
    const grey = mat('#8a8e98', { rough: 0.8 }), dark = mat('#4a4e5a', { rough: 0.8 }), neck = mat('#4a7a6a', { rough: 0.4, metal: 0.3 });
    const body = msh(new THREE.IcosahedronGeometry(0.1, 1), grey, `${this.name}.body`); body.scale.set(0.8, 0.75, 1.35); body.position.y = 0.11; this.root.add(body);
    const wing = msh(new THREE.BoxGeometry(0.17, 0.05, 0.2), dark, `${this.name}.wings`); wing.position.set(0, 0.15, -0.02); this.root.add(wing);
    const tail = msh(new THREE.BoxGeometry(0.07, 0.02, 0.12), dark, `${this.name}.tail`); tail.position.set(0, 0.12, -0.16); tail.rotation.x = 0.3; this.root.add(tail);
    this.head = new THREE.Group(); this.head.position.set(0, 0.2, 0.09); this.root.add(this.head);
    const nk = msh(new THREE.IcosahedronGeometry(0.05, 1), neck, `${this.name}.neck`); nk.position.set(0, -0.03, -0.01); this.head.add(nk);
    const hd = msh(new THREE.IcosahedronGeometry(0.042, 1), grey, `${this.name}.head`); hd.position.set(0, 0.02, 0.02); this.head.add(hd);
    const bk = msh(new THREE.ConeGeometry(0.012, 0.035, 4), mat('#2a2a2a'), `${this.name}.beak`); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.015, 0.07); this.head.add(bk);
    for (const sd of [-1, 1]) { const e = msh(new THREE.BoxGeometry(0.012, 0.012, 0.006), mat('#c84a1a'), `${this.name}.eye`, { cast: false }); e.position.set(sd * 0.03, 0.03, 0.045); this.head.add(e); }
    for (const sd of [-1, 1]) { const l = msh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4), mat('#d07a7a'), `${this.name}.leg`); l.position.set(sd * 0.03, 0.035, 0.0); this.root.add(l); }
    this.p = this.defaults();
  }
  defaults() { const pts = [[-1.2, -1.6, 2.4], [-0.3, -2.1, -0.4], [0.9, -1.4, 3.6]][this.i]; return { pos: [STREET.sit.pos[0] + pts[0], pts[1]], rotY: pts[2], y: STREET.sideY, visible: false, peck: 1, phase: this.i * 0.37 }; }
  solve(t) {
    const p = this.p; this.root.visible = p.visible; if (!p.visible) return;
    this.root.position.set(p.pos[0], p.y, p.pos[1]); this.root.rotation.set(0, p.rotY, 0);
    const ph = (t * 1.3 + p.phase) % 1, pk = p.peck * (ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI) : 0);
    const bob = Math.sin(t * 9 + p.phase * 6) * 0.012;
    this.head.position.set(0, 0.2 - pk * 0.11 + bob, 0.09 + pk * 0.05 + bob * 0.5);
    this.head.rotation.set(pk * 1.1, Math.sin(t * 1.7 + p.phase * 4) * 0.5 * (1 - pk), 0);
  }
}

export function buildAnimals(world) {
  const roy = new Penguin(world, 'roy', { pos: PENGUINS.roy, rotY: Math.PI - 0.3, seed: 3, scale: 1.0 });
  const silo = new Penguin(world, 'silo', { pos: PENGUINS.silo, rotY: Math.PI + 0.3, seed: 5, scale: 0.97 });
  const hatch = new Hatch(world);
  const pigeons = [0, 1, 2].map((i) => new Pigeon(world, i));
  const list = [roy, silo, hatch, ...pigeons];
  return {
    characters: [roy, silo, hatch, ...pigeons], roy, silo, hatch, pigeons,
    reset(t, ctx) {
      for (const a of list) a.p = a.defaults();
      const n = ctx && ctx.shot ? Number(ctx.shot.id.slice(1)) : 0;
      if (n >= 34 && n <= 37) { roy.p.visible = silo.p.visible = true; }
      if (n === 37) hatch.p.visible = true;
      if (n <= 2) for (const pg of pigeons) pg.p.visible = true;
      // idle life
      for (const pg of [roy, silo]) { pg.p.headYaw = noise1(t * 0.6, pg.k * 9) * 0.35; pg.p.flapL = pg.p.flapR = Math.max(0, noise1(t * 0.9, pg.k * 3)) * 0.12; }
      const per = 3.4, ph = ((t + 0.7) % per) / per; if (ph > 0.96) roy.p.eyes = 'closed';
      const ph2 = ((t + 2.1) % 3.9) / 3.9; if (ph2 > 0.965) silo.p.eyes = 'closed';
    },
    commit(ctx) { for (const a of list) a.solve(ctx.t); },
  };
}

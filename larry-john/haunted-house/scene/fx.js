// Stateless particle effects: positions come from seeds + time, so any frame can render alone.
import * as THREE from 'three';
import { clay, glow } from '../../engine/toon/materials.js';
import { mulberry32, clamp, smooth, easeOutCubic, lerp } from '../../engine/toon/anim.js';
import { canvasTex } from './world/common.js';

const _o = new THREE.Object3D();

class Burst {
  // generic ballistic burst: n particles, velocity spread, gravity, spin, lifetime
  constructor(scene, geo, mat, n, { seed = 1, colors = null, shadow = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.castShadow = shadow; this.mesh.frustumCulled = false; this.mesh.userData.noAO = true;
    this.n = n; this.seed = seed;
    if (colors) {
      const rnd = mulberry32(seed + 99), c = new THREE.Color();
      for (let i = 0; i < n; i++) { c.set(colors[Math.floor(rnd() * colors.length)]); this.mesh.setColorAt(i, c); }
      this.mesh.instanceColor.needsUpdate = true;
    }
    scene.add(this.mesh); this.mesh.visible = false;
  }
  reset() { this.mesh.visible = false; }
}

export class Confetti extends Burst {
  constructor(scene) {
    super(scene, new THREE.PlaneGeometry(0.035, 0.022), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, emissive: '#222222' }), 260,
      { seed: 5, colors: ['#ff4d6d', '#ffd23a', '#4cc9f0', '#7ae582', '#b388ff', '#ff9f1c', '#ffffff'] });
    this.streamers = new Burst(scene, new THREE.PlaneGeometry(0.02, 0.18), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), 24,
      { seed: 6, colors: ['#ff4d6d', '#ffd23a', '#4cc9f0', '#7ae582'] });
  }
  reset() { super.reset(); this.streamers.reset(); }
  // origin: world pos; t: time since the pop; dir: main direction
  show(origin, t, dir = [0.3, 1, 0], speed = 4.2) {
    if (t < 0 || t > 3.5) return;
    const O = new THREE.Vector3(...origin), D = new THREE.Vector3(...dir).normalize();
    for (const [sys, drag] of [[this, 2.4], [this.streamers, 1.6]]) {
      sys.mesh.visible = true;
      const rnd = mulberry32(sys.seed);
      for (let i = 0; i < sys.n; i++) {
        const v = D.clone().multiplyScalar(speed * (0.5 + rnd() * 0.7)).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(speed * 0.75));
        const k = (1 - Math.exp(-drag * t)) / drag;            // drag-limited travel
        const p = O.clone().addScaledVector(v, k);
        p.y -= 0.6 * t * t * 0.5 + 0.35 * t;                   // slow flutter down
        p.x += Math.sin(t * 6 + i) * 0.03 * t; p.z += Math.cos(t * 5 + i) * 0.03 * t;
        _o.position.copy(p);
        _o.rotation.set(t * (4 + rnd() * 8), t * (3 + rnd() * 6), rnd() * 6);
        _o.scale.setScalar(t < 0.05 ? t / 0.05 : 1);
        _o.updateMatrix(); sys.mesh.setMatrixAt(i, _o.matrix);
      }
      sys.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export class Crumbs extends Burst {
  constructor(scene) { super(scene, new THREE.IcosahedronGeometry(0.008, 0), clay('#f3c04e', { flatShading: true }), 30, { seed: 7 }); }
  show(origin, t) {
    if (t < 0 || t > 1.2) return;
    this.mesh.visible = true;
    const O = new THREE.Vector3(...origin), rnd = mulberry32(this.seed);
    for (let i = 0; i < this.n; i++) {
      const v = new THREE.Vector3((rnd() - 0.5) * 0.9, 0.3 + rnd() * 0.8, 0.2 + rnd() * 0.6);
      _o.position.set(O.x + v.x * t, O.y + v.y * t - 4.9 * t * t, O.z + v.z * t);
      _o.rotation.set(t * 9, t * 7, 0); _o.scale.setScalar(0.6 + rnd());
      _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// cartoon stars spinning around a head (BONK)
export class DizzyStars {
  constructor(scene) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 });
    geo.center(); geo.scale(0.05, 0.05, 0.05);
    this.mesh = new THREE.InstancedMesh(geo, glow('#ffd84a', 2.2), 5);
    this.mesh.frustumCulled = false; this.mesh.userData.noAO = true; scene.add(this.mesh); this.mesh.visible = false;
  }
  reset() { this.mesh.visible = false; }
  show(center, t, radius = 0.32) {
    if (t < 0) return;
    this.mesh.visible = true;
    const C = new THREE.Vector3(...center);
    const grow = easeOutCubic(clamp(t / 0.15));
    for (let i = 0; i < 5; i++) {
      const a = t * 5.5 + (i / 5) * Math.PI * 2;
      _o.position.set(C.x + Math.cos(a) * radius, C.y + Math.sin(a * 2) * 0.03, C.z + Math.sin(a) * radius * 0.6);
      _o.rotation.set(0.3, t * 4, Math.sin(a) * 0.3); _o.scale.setScalar(grow * (0.9 + 0.2 * Math.sin(t * 9 + i)));
      _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// soft round sprite texture shared by smoke, dust and fog
let _soft = null;
export function softTex() {
  if (!_soft) _soft = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, { srgb: false });
  return _soft;
}

// cartoon puffs: dust clouds behind runners, smoke pops when buildings grow.
// Soft camera-facing billboards that swell, drift and shrink away (never hard white balls).
let _puffTex = null;
function puffTex() {
  if (!_puffTex) _puffTex = canvasTex(128, 128, (c, w, h) => {
    // a cartoon cloud blob: three overlapping soft circles
    for (const [x, y, r] of [[0.38, 0.55, 0.3], [0.62, 0.52, 0.28], [0.5, 0.38, 0.27]]) {
      const g = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x * w, y * h, r * w, 0, 7); c.fill();
    }
  }, { srgb: false });
  return _puffTex;
}
export class Puffs {
  constructor(W, n = 40, color = '#e9e2d6') {
    this.W = W; this.n = n;
    this.mat = new THREE.MeshBasicMaterial({ map: puffTex(), color, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, n);
    this.mesh.frustumCulled = false; this.mesh.userData.noAO = true; this.mesh.renderOrder = 6;
    W.scene.add(this.mesh); this.mesh.visible = false; this.items = [];
  }
  reset() { this.mesh.visible = false; this.items = []; }
  _flush() {
    if (this._queued) return; this._queued = true;
    this.W.after.push(() => {
      this._queued = false;
      const q = this.W.stage.camera.quaternion;
      this.mesh.count = Math.min(this.n, this.items.length);
      this.items.slice(0, this.n).forEach(([p, s, roll], i) => {
        _o.position.copy(p); _o.quaternion.copy(q); _o.rotateZ(roll); _o.scale.setScalar(Math.max(0.0001, s));
        _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix);
      });
      this.mesh.instanceMatrix.needsUpdate = true;
    });
  }
  // a ring of puffs bursting out from a point; t = time since the pop
  pop(center, t, { radius = 1, count = 10, size = 0.35, life = 0.9, up = 0.4, seed = 1, color = null } = {}) {
    if (t < 0 || t > life) return;
    this.mesh.visible = true; if (color) this.mat.color.set(color);
    const C = new THREE.Vector3(...center), rnd = mulberry32(seed);
    const k = easeOutCubic(clamp(t / life));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.5, r1 = 0.7 + rnd() * 0.6, r2 = rnd();
      const p = new THREE.Vector3(C.x + Math.cos(a) * radius * k * r1, C.y + size * 0.4 + up * k * r2, C.z + Math.sin(a) * radius * k * r1);
      const s = size * (0.8 + rnd() * 0.6) * (0.4 + 0.9 * k) * (1 - Math.pow(clamp(t / life), 3));
      this.items.push([p, s * 2.2, rnd() * 6.28]);
    }
    this._flush();
  }
  // a trail of dust puffs left behind a runner: positions sampled along a path function
  trail(pathFn, t, { count = 8, spacing = 0.12, size = 0.18, life = 0.6, seed = 2, color = null } = {}) {
    this.mesh.visible = true; if (color) this.mat.color.set(color);
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const born = t - i * spacing, age = i * spacing, r = [rnd(), rnd(), rnd()];
      if (born < 0 || age > life) continue;
      const p = pathFn(born);
      const q = new THREE.Vector3(p.x + (r[0] - 0.5) * 0.25, 0.12 + age * 0.4, p.z + (r[1] - 0.5) * 0.25);
      this.items.push([q, size * (0.6 + age / life * 1.4) * (1 - Math.pow(age / life, 2)) * 2.4, r[2] * 6.28]);
    }
    this._flush();
  }
}

// Fog: soft billboards drifting inside a box. Oriented toward the camera after the camera is set.
export class FogVolume {
  constructor(W, n = 160, { color = '#a8ffbf', opacity = 0.3, seed = 21 } = {}) {
    this.W = W; this.n = n; this.seed = seed;
    this.mat = new THREE.MeshBasicMaterial({ map: softTex(), color, transparent: true, opacity, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, n);
    this.mesh.frustumCulled = false; this.mesh.userData.noAO = true; this.mesh.renderOrder = 5;
    W.scene.add(this.mesh); this.mesh.visible = false;
    this.baseOpacity = opacity;
  }
  reset() { this.mesh.visible = false; }
  // box: {center:[x,y,z], size:[sx,sy,sz]}; density 0..1 (how many puffs); grow 0..1 (puff size); rise: puffs hug the floor (0) or fill the room (1)
  show(box, t, { density = 1, grow = 1, color = null, opacity = null, drift = 0.25, minS = 0.8, maxS = 1.8, floor = 0 } = {}) {
    this.mesh.visible = true;
    if (color) this.mat.color.set(color);
    this.mat.opacity = opacity ?? this.baseOpacity;
    const rnd = mulberry32(this.seed), C = box.center, S = box.size;
    const count = Math.floor(this.n * density);
    this.mesh.count = Math.max(1, count);
    const items = [];
    for (let i = 0; i < this.n; i++) {
      const r = [rnd(), rnd(), rnd(), rnd(), rnd()];
      if (i >= count) continue;
      let y = C[1] + (r[1] - 0.5) * S[1];
      if (floor) y = C[1] - S[1] / 2 + Math.pow(r[1], 2.2) * S[1];
      const p = new THREE.Vector3(C[0] + (r[0] - 0.5) * S[0] + Math.sin(t * drift + i) * 0.3, y + Math.sin(t * 0.4 + i * 1.7) * 0.05, C[2] + (r[2] - 0.5) * S[2] + Math.cos(t * drift * 0.8 + i * 0.7) * 0.3);
      items.push([p, lerp(minS, maxS, r[3]) * grow, r[4] * 6.28]);
    }
    this.items = items;
    this.W.after.push(() => this.orient());
  }
  orient() {
    const cam = this.W.stage.camera, q = cam.quaternion;
    this.items.forEach(([p, s, roll], i) => {
      // puffs right in front of the lens fade away so they never wash out the frame
      const near = clamp((p.distanceTo(cam.position) - s * 0.6) / (s * 1.2));
      _o.position.copy(p); _o.quaternion.copy(q); _o.rotateZ(roll); _o.scale.setScalar(Math.max(0.0001, s * near));
      _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// flapping bats flying along simple paths (across the moon, around the towers)
export class Bats {
  constructor(scene, n = 14) {
    this.bats = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0.12); s.quadraticCurveTo(0.12, 0.1, 0.18, 0.18); s.quadraticCurveTo(0.3, 0.05, 0.55, 0.12); s.quadraticCurveTo(0.45, 0.0, 0.48, -0.1);
      s.quadraticCurveTo(0.38, -0.05, 0.32, -0.14); s.quadraticCurveTo(0.24, -0.06, 0.16, -0.16); s.quadraticCurveTo(0.08, -0.05, 0, -0.08);
      s.quadraticCurveTo(-0.08, -0.05, -0.16, -0.16); s.quadraticCurveTo(-0.24, -0.06, -0.32, -0.14); s.quadraticCurveTo(-0.38, -0.05, -0.48, -0.1);
      s.quadraticCurveTo(-0.45, 0.0, -0.55, 0.12); s.quadraticCurveTo(-0.3, 0.05, -0.18, 0.18); s.quadraticCurveTo(-0.12, 0.1, 0, 0.12);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 6), new THREE.MeshBasicMaterial({ color: '#120e1a', side: THREE.DoubleSide, fog: false }));
      m.userData.noAO = true; m.visible = false; scene.add(m); this.bats.push(m);
    }
  }
  reset() { this.bats.forEach((b) => { b.visible = false; }); }
  // fly across a point (e.g. the moon) from left to right as seen from `camPos`
  across(center, t, { spread = 30, size = 3, speed = 18, camPos = null, seed = 3, count = null } = {}) {
    const rnd = mulberry32(seed), C = new THREE.Vector3(...center);
    const n = count ?? this.bats.length;
    const right = camPos ? new THREE.Vector3().subVectors(C, new THREE.Vector3(...camPos)).cross(new THREE.Vector3(0, 1, 0)).normalize().negate() : new THREE.Vector3(1, 0, 0);
    this.bats.forEach((b, i) => {
      const r = [rnd(), rnd(), rnd(), rnd()];
      if (i >= n) return;
      b.visible = true;
      const x = -spread + ((t * speed * (0.8 + r[0] * 0.4) + r[1] * spread * 2) % (spread * 2));
      const p = C.clone().addScaledVector(right, x).add(new THREE.Vector3(0, (r[2] - 0.5) * spread * 0.5 + Math.sin(t * 3 + i) * size * 0.3, (r[3] - 0.5) * spread * 0.2));
      b.position.copy(p);
      if (camPos) b.lookAt(...camPos);
      const flap = Math.sin(t * (14 + r[0] * 6) + i);
      b.scale.set(size * (0.75 + 0.25 * Math.abs(flap)), size * (0.6 + 0.4 * flap), size);
    });
  }
}

// a jagged lightning bolt + sky flash
export class Lightning {
  constructor(scene) {
    this.mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 4), fog: false, transparent: true });
    this.group = new THREE.Group(); scene.add(this.group); this.group.visible = false; this.group.userData.noAO = true;
    const rnd = mulberry32(9);
    let p = new THREE.Vector3(0, 0, 0);
    for (let k = 0; k < 14; k++) {
      const q = p.clone().add(new THREE.Vector3((rnd() - 0.5) * 6, -5 - rnd() * 3, (rnd() - 0.5) * 2));
      const len = p.distanceTo(q);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 6), this.mat);
      seg.position.copy(p).add(q).multiplyScalar(0.5); seg.lookAt(q); seg.rotateX(Math.PI / 2);
      this.group.add(seg); p = q;
    }
  }
  reset() { this.group.visible = false; }
  strike(pos, t, W) {
    if (t < 0 || t > 0.35) return;
    const k = t < 0.06 ? 1 : t < 0.12 ? 0.3 : t < 0.18 ? 0.9 : Math.max(0, 1 - (t - 0.18) / 0.17);
    this.group.visible = k > 0.05; this.group.position.set(...pos); this.mat.opacity = k;
    W.stage.grade.uniforms.flash.value = 0.35 * k; W.stage.grade.uniforms.flashColor.value.set('#dfe6ff');
  }
}

export function buildFX(W) {
  const s = W.scene;
  W.fx.confetti = new Confetti(s);
  W.fx.crumbs = new Crumbs(s);
  W.fx.stars = new DizzyStars(s);
  W.fx.puffs = new Puffs(W, 80, '#efe8de');
  W.fx.dust = new Puffs(W, 60, '#d6c3a5');
  W.fog = new FogVolume(W, 170, { color: '#a8ffbf', opacity: 0.3 });
  W.fx.fog = W.fog;
  W.fx.bats = new Bats(s, 16);
  W.fx.lightning = new Lightning(s);
  W.extras.push(W.fx.confetti, W.fx.crumbs, W.fx.stars, W.fx.puffs, W.fx.dust, W.fog, W.fx.bats, W.fx.lightning);
}


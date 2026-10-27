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

// cartoon puffs: dust clouds behind runners, smoke pops when buildings grow
export class Puffs {
  constructor(scene, n = 40, color = '#e9e2d6') {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.92, emissive: color, emissiveIntensity: 0.15 }), n);
    this.mesh.frustumCulled = false; this.mesh.userData.noAO = true; this.mesh.castShadow = false;
    this.n = n; scene.add(this.mesh); this.mesh.visible = false; this.used = 0;
  }
  reset() { this.mesh.visible = false; this.used = 0; this.mesh.count = this.n; for (let i = 0; i < this.n; i++) { _o.scale.setScalar(0); _o.updateMatrix(); this.mesh.setMatrixAt(i, _o.matrix); } this.mesh.instanceMatrix.needsUpdate = true; }
  // a ring of puffs expanding from a point; t = time since the pop
  pop(center, t, { radius = 1, count = 10, size = 0.35, life = 0.9, up = 0.4, seed = 1 } = {}) {
    if (t < 0 || t > life) return;
    this.mesh.visible = true;
    const C = new THREE.Vector3(...center), rnd = mulberry32(seed);
    const k = easeOutCubic(clamp(t / life));
    for (let i = 0; i < count && this.used < this.n; i++, this.used++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.5;
      _o.position.set(C.x + Math.cos(a) * radius * k * (0.7 + rnd() * 0.6), C.y + up * k * rnd() + size * 0.3, C.z + Math.sin(a) * radius * k * (0.7 + rnd() * 0.6));
      const s = size * (0.6 + rnd() * 0.6) * Math.sin(clamp(t / life) * Math.PI) * 1.2;
      _o.rotation.set(0, 0, 0); _o.scale.setScalar(Math.max(0.0001, s));
      _o.updateMatrix(); this.mesh.setMatrixAt(this.used, _o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // a trail of dust puffs left behind a runner: positions sampled along a path function
  trail(pathFn, t, { count = 8, spacing = 0.12, size = 0.18, life = 0.6, seed = 2 } = {}) {
    this.mesh.visible = true;
    const rnd = mulberry32(seed);
    for (let i = 0; i < count && this.used < this.n; i++, this.used++) {
      const born = t - i * spacing; const age = i * spacing;
      if (born < 0 || age > life) { _o.scale.setScalar(0.0001); _o.updateMatrix(); this.mesh.setMatrixAt(this.used, _o.matrix); continue; }
      const p = pathFn(born);
      _o.position.set(p.x + (rnd() - 0.5) * 0.2, 0.1 + age * 0.35, p.z + (rnd() - 0.5) * 0.2);
      _o.scale.setScalar(size * (0.5 + age / life) * (1 - age / life) * 2.2);
      _o.updateMatrix(); this.mesh.setMatrixAt(this.used, _o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
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

export function buildFX(W) {
  const s = W.scene;
  W.fx.confetti = new Confetti(s);
  W.fx.crumbs = new Crumbs(s);
  W.fx.stars = new DizzyStars(s);
  W.fx.puffs = new Puffs(s, 80, '#efe8de');
  W.fx.dust = new Puffs(s, 60, '#cdb89a');
  W.fog = new FogVolume(W, 170, { color: '#a8ffbf', opacity: 0.3 });
  W.fx.fog = W.fog;
  W.extras.push(W.fx.confetti, W.fx.crumbs, W.fx.stars, W.fx.puffs, W.fx.dust, W.fog);
}


// Per-frame effect pools. Every frame: fx.begin(); shots call fx.* to place effects; fx.end().
import * as THREE from 'three';
import { canvasTex, hash, clamp } from './lib.js';

function spriteTex(kind) {
  const S = 128;
  return canvasTex(S, S, (ctx) => {
    const c = S / 2;
    if (kind === 'puff') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    } else if (kind === 'blob') { // cartoon cloud puff with soft edge (for the smell cloud / perfume)
      for (const [x, y, r] of [[64, 70, 40], [40, 64, 28], [88, 62, 30], [62, 44, 30]]) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.75, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    } else if (kind === 'star') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 10 : 60; ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
      ctx.fill();
      const g = ctx.createRadialGradient(c, c, 0, c, c, 30); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    } else if (kind === 'drop') {
      ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#1f6fb0'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(c, 10); ctx.quadraticCurveTo(c + 40, 70, c + 30, 92); ctx.arc(c, 88, 30, 0.15, Math.PI - 0.15); ctx.quadraticCurveTo(c - 40, 70, c, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(c - 16, 72, 10, 16);
    } else if (kind === 'chilli') {
      ctx.lineWidth = 7; ctx.strokeStyle = '#3a0a0a'; ctx.fillStyle = '#e8241c';
      ctx.beginPath(); ctx.moveTo(30, 40); ctx.quadraticCurveTo(70, 30, 100, 60); ctx.quadraticCurveTo(110, 100, 70, 118); ctx.quadraticCurveTo(90, 90, 70, 70); ctx.quadraticCurveTo(50, 55, 30, 58); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(50, 44, 18, 6);
      ctx.fillStyle = '#2f9e2f'; ctx.beginPath(); ctx.moveTo(22, 36); ctx.lineTo(40, 36); ctx.lineTo(36, 62); ctx.lineTo(18, 60); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(14, 18, 8, 22); ctx.strokeRect(14, 18, 8, 22);
    } else if (kind === 'arcs') {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      for (const r of [22, 42, 62]) { ctx.beginPath(); ctx.arc(10, c, r, -0.7, 0.7); ctx.stroke(); }
    } else if (kind === 'heart') {
      ctx.fillStyle = '#ff5d93'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(c, 108); ctx.bezierCurveTo(-10, 60, 20, 4, c, 36); ctx.bezierCurveTo(108, 4, 138, 60, c, 108); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = '#ffd0e0'; ctx.fillRect(36, 34, 14, 14);
    } else if (kind === 'bubble') {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 7; ctx.fillStyle = 'rgba(160,230,255,0.35)';
      ctx.beginPath(); ctx.arc(c, c, 52, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(38, 34, 16, 16);
    } else if (kind === 'note') {
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(70, 20, 12, 70); ctx.fillRect(70, 20, 34, 12); ctx.fillRect(92, 20, 12, 30);
      ctx.fillRect(42, 80, 40, 28); ctx.fillStyle = '#ffd23f'; ctx.fillRect(46, 84, 32, 20);
    } else if (kind === 'flash') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,240,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { ctx.save(); ctx.translate(c, c); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-3, -60, 6, 120); ctx.restore(); }
    } else if (kind === 'square') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(16, 16, 96, 96);
    } else if (kind === 'glow') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
  });
}

const STINK_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const STINK_FS = `
uniform float uTime; uniform float uPhase; uniform float uOpacity; uniform vec3 uColor; uniform float uWidth;
varying vec2 vUv;
void main(){
  float x = 0.5 + 0.26 * sin(vUv.y * 9.0 - uTime * 7.0 + uPhase) * (0.4 + 0.6 * vUv.y);
  float d = abs(vUv.x - x);
  float core = smoothstep(uWidth, uWidth * 0.55, d);
  float edge = smoothstep(uWidth * 1.9, uWidth * 1.35, d);
  float fade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  vec3 col = mix(uColor * 0.45, uColor, core);
  float a = max(core, edge * 0.9) * fade * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group(); scene.add(this.root);
    this.tex = {};
    for (const k of ['puff', 'blob', 'star', 'drop', 'arcs', 'glow', 'heart', 'bubble', 'square', 'note', 'flash']) this.tex[k] = spriteTex(k);
    this.pools = {}; this.used = {};
    this.stinkPool = []; this.stinkUsed = 0;
    // heavenly light cone
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(vUv.y,1.4) * (0.55+0.45*sin(vUv.x*60.0)*sin(vUv.x*23.0)) * uOpacity; gl_FragColor = vec4(1.0,0.93,0.7, a*0.55);} `,
    });
    this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, 5.2, 24, 1, true), coneMat);
    this.cone.visible = false; this.root.add(this.cone);
  }
  begin() {
    for (const k in this.pools) { for (const s of this.pools[k]) s.visible = false; this.used[k] = 0; }
    for (const s of this.stinkPool) s.visible = false; this.stinkUsed = 0;
    this.cone.visible = false;
  }
  sprite(kind, pos, size, opts = {}) {
    if (!this.pools[kind]) { this.pools[kind] = []; this.used[kind] = 0; }
    const pool = this.pools[kind];
    let s = pool[this.used[kind]];
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex[kind], transparent: true, depthWrite: false }));
      pool.push(s); this.root.add(s);
    }
    this.used[kind]++;
    s.visible = true;
    s.position.copy(pos);
    const sx = Array.isArray(size) ? size[0] : size, sy = Array.isArray(size) ? size[1] : size;
    s.scale.set(sx, sy, 1);
    s.material.opacity = opts.opacity ?? 1;
    s.material.color.set(opts.color ?? 0xffffff);
    s.material.rotation = opts.rot ?? 0;
    s.material.blending = opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.material.depthTest = opts.depthTest ?? true;
    s.renderOrder = opts.order ?? 10;
    return s;
  }
  // wavy green stink line, billboarded
  stink(pos, h, t, phase, opacity = 1, color = 0x8fdc3c, width = 0.075) {
    let m = this.stinkPool[this.stinkUsed];
    if (!m) {
      const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color() }, uWidth: { value: width } }, vertexShader: STINK_VS, fragmentShader: STINK_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      this.stinkPool.push(m); this.root.add(m);
    }
    this.stinkUsed++;
    m.visible = true; m.renderOrder = 12;
    m.position.copy(pos); m.scale.set(h * 0.35, h, 1);
    m.quaternion.copy(this.camera.quaternion);
    const u = m.material.uniforms;
    u.uTime.value = t; u.uPhase.value = phase; u.uOpacity.value = opacity; u.uColor.value.set(color); u.uWidth.value = width;
    return m;
  }
  orient() { for (let i = 0; i < this.stinkUsed; i++) this.stinkPool[i].quaternion.copy(this.camera.quaternion); }
  // a rising bundle of 3 stink lines from a point
  stinkBundle(pos, t, intensity = 1, size = 1, seed = 0) {
    for (let i = 0; i < 3; i++) {
      const life = 1.6, ph = ((t * 0.8 + i / 3 + hash(seed + i) * 0.3) % 1);
      const rise = ph * 0.9 * size;
      const op = intensity * Math.sin(ph * Math.PI);
      const p = pos.clone(); p.x += (i - 1) * 0.22 * size; p.y += rise + 0.45 * size;
      this.stink(p, 0.9 * size, t, seed * 3 + i * 2.1, op);
      void life;
    }
  }
  sweat(headWorld, t, n = 1, size = 0.16, seed = 0, f = new THREE.Vector3(0, 0, 1)) {
    const r = new THREE.Vector3(f.z, 0, -f.x);
    for (let i = 0; i < n; i++) {
      const ph = ((t * 0.9 + i / n + hash(seed + i * 7)) % 1);
      const side = i % 2 === 0 ? 1 : -1;
      const p = headWorld.clone().addScaledVector(r, side * (0.27 + hash(seed + i) * 0.05)).addScaledVector(f, 0.28);
      p.y += 0.24 - ph * 0.42 + (i >= 2 ? 0.08 : 0);
      this.sprite('drop', p, size * (0.8 + 0.4 * hash(seed + i * 3)), { opacity: clamp(Math.sin(ph * Math.PI) * 2), order: 20 });
    }
  }
  sparkles(center, spread, t, n = 8, size = 0.25, seed = 0, color = 0xffffff) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.7 + hash(seed + i * 13)) % 1;
      const p = new THREE.Vector3(center.x + (hash(seed + i) - 0.5) * spread[0], center.y + (hash(seed + i * 2 + 1) - 0.5) * spread[1], center.z + (hash(seed + i * 3 + 2) - 0.5) * spread[2]);
      const k = Math.sin(ph * Math.PI);
      this.sprite('star', p, size * (0.3 + k), { opacity: k, rot: t * 1.5 + i, additive: true, color, order: 25 });
    }
  }
  puffCloud(center, radius, t, n, opts = {}) {
    const color = opts.color ?? 0xffffff, op = opts.opacity ?? 0.6, size = opts.size ?? 1, seed = opts.seed ?? 0;
    for (let i = 0; i < n; i++) {
      const a = hash(seed + i) * Math.PI * 2, r = Math.sqrt(hash(seed + i * 5 + 1)) * radius;
      const drift = opts.drift ?? 0.15;
      const p = new THREE.Vector3(center.x + Math.cos(a) * r + Math.sin(t * 0.7 + i) * drift, center.y + (hash(seed + i * 7 + 2) - 0.5) * radius * (opts.flat ?? 0.8) + Math.sin(t * 0.9 + i * 2) * drift, center.z + Math.sin(a) * r * (opts.depth ?? 1));
      this.sprite(opts.kind ?? 'blob', p, size * (0.7 + hash(seed + i * 11) * 0.6), { opacity: op, color, rot: hash(i) * 6 + t * 0.2 * (i % 2 ? 1 : -1), order: opts.order ?? 15 });
    }
  }
  steam(pos, t, n = 6, seed = 0, opacity = 0.6) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.5 + i / n) % 1;
      const p = pos.clone(); p.x += Math.sin(ph * 6 + i) * 0.08 + (hash(seed + i) - 0.5) * 0.2; p.y += ph * 0.7; p.z += (hash(seed + i * 3) - 0.5) * 0.15;
      this.sprite('puff', p, 0.18 + ph * 0.3, { opacity: Math.sin(ph * Math.PI) * opacity, order: 18 });
    }
  }
  tearsFountain(eyeWorld, t, side, intensity = 1, seed = 0, f = new THREE.Vector3(0, 0, 1), size = 0.07) {
    const r = new THREE.Vector3(f.z, 0, -f.x);
    for (let i = 0; i < 9; i++) {
      const ph = (t * 1.6 + i / 9) % 1;
      const p = eyeWorld.clone().addScaledVector(r, side * ph * 0.4).addScaledVector(f, 0.04 + ph * 0.08);
      p.y += 0.18 * ph - 0.75 * ph * ph;
      this.sprite('drop', p, size * (0.8 + 0.4 * hash(seed + i)), { opacity: intensity * (1 - ph * 0.5), rot: -side * (0.3 + ph), order: 22 });
    }
  }
  hearts(center, spread, t, n = 6, size = 0.18, seed = 0, rise = 0.5) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.45 + hash(seed + i * 5)) % 1;
      const side = i % 2 ? 1 : -1, ang = hash(seed + i) * 1.2 - 0.6;   // ring around the head, never on the face
      const p = new THREE.Vector3(center.x + side * spread[0] * (0.35 + 0.15 * hash(seed + i * 4)) * Math.cos(ang) + Math.sin(t * 2 + i) * 0.04, center.y + (hash(seed + i * 2) - 0.3) * spread[1] + ph * rise, center.z + side * spread[2] * (0.35 + 0.15 * hash(seed + i * 5)) * Math.sin(ang + 1.2));
      this.sprite('heart', p, size * (0.6 + 0.6 * Math.sin(ph * Math.PI)), { opacity: Math.min(1, Math.sin(ph * Math.PI) * 1.8), rot: Math.sin(t * 3 + i) * 0.25, order: 26 });
    }
  }
  bubbles(origin, t, n = 10, seed = 0, size = 0.09, height = 0.8) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.9 + i / n + hash(seed + i) * 0.3) % 1;
      const p = origin.clone().add(new THREE.Vector3(Math.sin(t * 4 + i * 2) * 0.12 * ph + (hash(seed + i * 3) - 0.5) * 0.2, ph * height, (hash(seed + i * 7) - 0.5) * 0.15));
      this.sprite('bubble', p, size * (0.6 + hash(seed + i * 9) * 0.8), { opacity: Math.sin(ph * Math.PI), order: 24 });
    }
  }
  mintCloud(center, radius, t, k = 1, seed = 0) {   // blue minty sparkle cloud
    this.puffCloud(center, radius, t, Math.floor(5 + 8 * k), { color: 0x6fd8ff, opacity: 0.42 * k, size: 0.35 + 0.6 * radius, seed, flat: 1, drift: 0.06, order: 20 });
    this.sparkles(center, [radius * 2.4, radius * 2, radius * 1.5], t * 1.4, Math.floor(6 + 8 * k), 0.16 + 0.2 * radius, seed + 7, 0xdff9ff);
  }
  godRays(pos, opacity) {
    this.cone.visible = opacity > 0.001;
    this.cone.position.copy(pos);
    this.cone.material.uniforms.uOpacity.value = opacity;
  }
}

// Visual effects. Everything is evaluated as a pure function of time so frames can be
// rendered in any order (and sub-frames for motion blur stay consistent).
import * as THREE from 'three';
import { softDotTex, smokeTex, canvasTex, textTex } from './tex.js';
import { rng, clamp, smoothstep, lerp, sat } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- thruster jet ----------------
const JET_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const JET_FRAG = /* glsl */`
uniform float uLevel; uniform float uTime; uniform vec3 uCore; uniform vec3 uEdge; uniform float uDiamonds; uniform float uSeed;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  float along = vUv.y;
  float rim = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(rim, 1.8);
  float fade = pow(max(1.0 - along, 0.0), 1.35) * smoothstep(0.0, 0.04, along + 0.02);
  float n = vn(vec2(along * 7.0 - uTime * 26.0, vUv.x * 9.0 + uSeed)) * 0.6 + vn(vec2(along * 19.0 - uTime * 41.0, vUv.x * 23.0)) * 0.4;
  float flick = 0.72 + 0.5 * n;
  float dm = 1.0 + uDiamonds * 1.4 * pow(0.5 + 0.5 * cos(along * 34.0 - 0.6), 8.0) * smoothstep(0.75, 0.05, along);
  vec3 col = mix(uCore, uEdge, smoothstep(0.0, 0.75, along * 1.2 + (1.0 - rim) * 0.6));
  float a = body * fade * flick * dm * uLevel;
  gl_FragColor = vec4(col * a, 1.0);
}`;
function jetMaterial(core, edge, seed) {
  return new THREE.ShaderMaterial({
    vertexShader: JET_VERT, fragmentShader: JET_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uCore: { value: core }, uEdge: { value: edge }, uDiamonds: { value: 0 }, uSeed: { value: seed } },
  });
}
const coneGeo = (() => { const g = new THREE.CylinderGeometry(1.0, 0.32, 1, 20, 10, true); g.translate(0, 0.5, 0); return g; })();
export class Jet {
  constructor(nozzle, opts = {}) {
    this.n = nozzle;
    this.group = new THREE.Group();
    this.group.position.copy(nozzle.exit);
    nozzle.aim.add(this.group);
    const core = new THREE.Color(0.85, 0.93, 1.0).multiplyScalar(opts.coreI ?? 14);
    const edge = new THREE.Color(0.18, 0.45, 1.0).multiplyScalar(opts.edgeI ?? 5);
    this.outer = new THREE.Mesh(coneGeo, jetMaterial(edge.clone().multiplyScalar(0.8), edge, Math.random() * 10));
    this.inner = new THREE.Mesh(coneGeo, jetMaterial(core, edge.clone().lerp(core, 0.4), Math.random() * 10));
    this.outer.renderOrder = 8; this.inner.renderOrder = 9;
    this.outer.frustumCulled = this.inner.frustumCulled = false;
    this.group.add(this.outer, this.inner);
    this.width = (opts.width ?? 0.075) * nozzle.scale;
    this.maxLen = opts.len ?? 1.6;
    this.set(0, 0);
  }
  set(level, time, diamonds = 0, lenMul = 1) {
    const vis = level > 0.002;
    this.group.visible = vis;
    if (!vis) { this.n.glow.material.color.setRGB(0, 0, 0); return; }
    const L = this.maxLen * lenMul * (0.35 + 0.65 * Math.min(1, level));
    const w = this.width * (0.8 + 0.4 * Math.min(1, level));
    this.outer.scale.set(w * 2.2, L, w * 2.2);
    this.inner.scale.set(w * 1.0, L * 0.62, w * 1.0);
    for (const m of [this.outer, this.inner]) {
      m.material.uniforms.uLevel.value = Math.min(1.4, level);
      m.material.uniforms.uTime.value = time;
      m.material.uniforms.uDiamonds.value = diamonds;
    }
    this.n.glow.material.color.setRGB(0.55, 0.8, 1.0).multiplyScalar(18 * Math.min(1, level));
  }
}

// ---------------- billboard particle system ----------------
const BB_VERT = /* glsl */`
attribute vec3 iPos; attribute float iSize; attribute float iRot; attribute vec4 iCol;
varying vec2 vUv; varying vec4 vCol;
void main(){
  vUv = uv; vCol = iCol;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iRot), s = sin(iRot);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iSize;
  vec3 wp = iPos + right * q.x + up * q.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const BB_FRAG = /* glsl */`
uniform sampler2D map; uniform float uAdd;
varying vec2 vUv; varying vec4 vCol;
void main(){
  vec4 t = texture2D(map, vUv);
  float a = t.a * vCol.a;
  vec3 c = t.rgb * vCol.rgb;
  if (uAdd > 0.5) gl_FragColor = vec4(c * a, 1.0); else gl_FragColor = vec4(c, a);
}`;
export class Billboards {
  constructor(max, tex, { additive = false, renderOrder = 7 } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    for (const a of [this.aPos, this.aSize, this.aRot, this.aCol]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iRot', this.aRot); g.setAttribute('iCol', this.aCol);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: BB_VERT, fragmentShader: BB_FRAG, transparent: true, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, uAdd: { value: additive ? 1 : 0 } },
    });
    if (!additive) { this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.SrcAlphaFactor; this.mat.blendDst = THREE.OneMinusSrcAlphaFactor; }
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder;
    this.items = [];
  }
  // items: [{p:Vector3, size, rot, col:[r,g,b], a}]
  commit(items, camera) {
    if (camera && items.length > 1) {
      const cp = camera.position;
      items.sort((a, b) => b.p.distanceToSquared(cp) - a.p.distanceToSquared(cp));
    }
    const n = Math.min(items.length, this.max);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      this.aPos.setXYZ(i, it.p.x, it.p.y, it.p.z); this.aSize.setX(i, it.size); this.aRot.setX(i, it.rot || 0);
      this.aCol.setXYZW(i, it.col[0], it.col[1], it.col[2], it.a);
    }
    this.mesh.geometry.instanceCount = n;
    for (const a of [this.aPos, this.aSize, this.aRot, this.aCol]) a.needsUpdate = true;
  }
}

// deterministic particle emitter definitions -> evaluated at time t
export function makeEmitter({ seed, t0, t1, rate, life, spawn, vel, size0, size1, drag = 1.5, grav = 0, col, alpha = 0.7, spin = 1 }) {
  const R = rng(seed);
  const ps = [];
  const n = Math.round((t1 - t0) * rate);
  for (let i = 0; i < n; i++) {
    const bt = t0 + (i + R() * 0.8) / rate;
    const p = { bt, life: life[0] + R() * (life[1] - life[0]), r: [R(), R(), R(), R(), R(), R()], rot: R() * 6.28, spin: (R() - 0.5) * spin };
    ps.push(p);
  }
  return {
    eval(t, out) {
      for (const p of ps) {
        const age = t - p.bt;
        if (age < 0 || age > p.life) continue;
        const u = age / p.life;
        const s0 = spawn(p.bt, p.r);
        const v0 = vel(p.bt, p.r);
        const k = drag;
        const f = k > 0 ? (1 - Math.exp(-k * age)) / k : age;
        const pos = s0.clone().addScaledVector(v0, f);
        pos.y += 0.5 * grav * age * age;
        const sz = lerp(size0[0] + p.r[3] * (size0[1] - size0[0]), size1[0] + p.r[4] * (size1[1] - size1[0]), 1 - Math.pow(1 - u, 2));
        const a = (typeof alpha === 'function' ? alpha(u, p) : alpha) * smoothstep(0, 0.08, u) * (1 - smoothstep(0.45, 1, u));
        const c = typeof col === 'function' ? col(u, p) : col;
        out.push({ p: pos, size: sz, rot: p.rot + p.spin * age, col: c, a });
      }
    },
  };
}

// 4-point star sparkle texture
export function sparkleTex() {
  return canvasTex(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    for (const [ax, len, wid] of [[0, 1.0, 5], [Math.PI / 2, 1.0, 5], [Math.PI / 4, 0.45, 3], [-Math.PI / 4, 0.45, 3]]) {
      ctx.save(); ctx.translate(c, c); ctx.rotate(ax);
      const lg = ctx.createLinearGradient(-c * len, 0, c * len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, c * len, wid, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, { srgb: false });
}

export function buildFX(ctx) {
  const group = new THREE.Group();
  const smokeT = smokeTex(5);
  const dotT = softDotTex(128);
  const smoke = new Billboards(900, smokeT, { additive: false, renderOrder: 6 });
  const glow = new Billboards(200, dotT, { additive: true, renderOrder: 10 });
  const spark = new Billboards(40, sparkleTex(), { additive: true, renderOrder: 11 });
  group.add(smoke.mesh, glow.mesh, spark.mesh);

  // ---- speed lines (camera space) ----
  const speed = (() => {
    const n = 46; const R = rng(3);
    const g = new THREE.PlaneGeometry(0.012, 1);
    const mats = [];
    const grp = new THREE.Group();
    const lines = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 20;
      let x, y; do { x = (R() - 0.5) * 2.2; y = (R() - 0.5) * 3.6; } while (Math.abs(x) < 0.38 && Math.abs(y) < 0.75);
      lines.push({ mesh, x, y0: y, ph: R(), sp: 2.5 + R() * 2.5, len: 0.25 + R() * 0.55, w: 0.6 + R() * 1.4 });
      grp.add(mesh); mats.push(m);
    }
    return { grp, lines };
  })();

  // ---- dotted arc (launch path preview) ----
  const arcDots = (() => {
    const n = 40;
    const g = new THREE.SphereGeometry(0.16, 12, 8);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.95, 1.0).multiplyScalar(7) });
    const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.renderOrder = 9;
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.95, 1.0).multiplyScalar(5), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 48), ringM); ring.rotation.x = -Math.PI / 2;
    group.add(im, ring);
    return { im, n, ring, ringM };
  })();

  // ---- suction arrows ----
  const arrows = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(-0.28, 0.24); shape.lineTo(-0.2, 0.24); shape.lineTo(0.0, 0.07); shape.lineTo(0.2, 0.24); shape.lineTo(0.28, 0.24); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }); g.center();
    g.rotateZ(Math.PI); // chevron points -Y ... we orient per instance
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 0.95).multiplyScalar(6), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const n = 18;
    const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.renderOrder = 9;
    group.add(im);
    return { im, n, m };
  })();

  // ---- 45 degree indicator ----
  const angle = (() => {
    const grp = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.9, 0.4).multiplyScalar(5), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.022, 6, 32, Math.PI / 4), m);
    arc.rotation.z = Math.PI; // from -X sweeping down to 45 deg below
    const lineG = new THREE.CylinderGeometry(0.014, 0.014, 1.5, 6); lineG.translate(0, 0.75, 0);
    const ref = new THREE.Mesh(lineG, m); ref.rotation.z = Math.PI / 2; // pointing -X
    const dirL = new THREE.Mesh(lineG, m); dirL.rotation.z = Math.PI / 2 + Math.PI / 4;
    const labelM = new THREE.MeshBasicMaterial({ map: textTex('45°', { w: 512, h: 256, font: 'bold 170px DejaVu Sans, sans-serif', fill: '#fff3b0', stroke: '#3a2a00', strokeW: 10 }), transparent: true, depthWrite: false });
    labelM.color.setScalar(3.2);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), labelM);
    grp.add(arc, ref, dirL, label);
    group.add(grp);
    return { grp, m, labelM, label, arc, ref, dirL };
  })();

  // ---- bonk impact star ----
  const impact = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 0.45 : 1.0; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.35).multiplyScalar(5), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), m); mesh.renderOrder = 12;
    group.add(mesh);
    return { mesh, m };
  })();

  // ---- honk rings ----
  const honk = (() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.95, 0.7).multiplyScalar(4), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32, Math.PI * 0.6), m.clone()); r.renderOrder = 12; group.add(r); return r; });
    return { rings };
  })();

  // thruster lights
  const lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(new THREE.Color(0.5, 0.75, 1.0), 0, 18, 1.6); group.add(l); return l; });

  return { group, smoke, glow, spark, speed, arcDots, arrows, angle, impact, honk, lights, dotT, smokeT };
}

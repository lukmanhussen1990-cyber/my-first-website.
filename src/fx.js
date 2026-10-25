// Atmosphere & effects. Everything is a pure function of time t (deterministic).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte, glowMat, radialTex } from './materials.js';
import { hash01, mulberry32, clamp, smooth, invLerp } from './util.js';

// ---------- sky dome ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#9fb6c4') }, horizon: { value: new THREE.Color('#e6d6b0') }, bottom: { value: new THREE.Color('#b8a070') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunGlow: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunGlow; varying vec3 vDir;
      void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-y*4.0,0.0,1.0));
      float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunGlow * (pow(s, 24.0) * 1.2 + pow(s, 4.0) * 0.25);
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ---------- golden light pillar ----------
export function makePillar() {
  const g = new THREE.Group();
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(1.0, 0.86, 0.55) }, strength: { value: 1 }, h: { value: 60 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 wp = modelMatrix * vec4(position,1.0);
      vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float v = smoothstep(0.0, 0.08, vY) * (1.0 - smoothstep(0.55, 1.0, vY)*0.75);
      gl_FragColor = vec4(color * f * v * strength * 0.55, 1.0); }`,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.4, 60, 40, 1, true), coneMat);
  cone.position.y = 30; g.add(cone);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.6, 60, 32, 1, true), coneMat.clone());
  inner.position.y = 30; g.add(inner);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.86, 0.5], 1, { map: radialTex() }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; pool.scale.set(9, 9, 1); g.add(pool);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 48), glowMat([0.9, 0.75, 0.45], 0.25));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  // dust motes
  const N = 220; const pos = new Float32Array(N * 3);
  const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.16, map: radialTex(), color: new THREE.Color(1.6, 1.35, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.frustumCulled = false; g.add(pts);
  const P = { group: g, cone, inner, pool, ring, pts };
  P.set = (t, k = 1, height = 30) => {
    g.visible = k > 0.001;
    cone.material.uniforms.strength.value = 0.85 * k; inner.material.uniforms.strength.value = 0.95 * k;
    pool.material.opacity = 0.55 * k; ring.material.opacity = 0.22 * k;
    pts.material.opacity = k;
    const a = pts.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const life = 6 + 4 * hash01(i, 1); const u = ((t + hash01(i, 2) * life) % life) / life;
      const r = 3.0 * Math.sqrt(hash01(i, 3)) * (0.5 + 0.5 * (u)); const ang = hash01(i, 4) * 6.283 + t * 0.15;
      a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = 0.2 + u * height * 0.6; a[i * 3 + 2] = Math.sin(ang) * r;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  };
  return P;
}

// ---------- chimney smoke (low-poly puffs) ----------
export function makeSmoke(points) {
  const g = new THREE.Group(); const puffs = [];
  points.forEach((p, ci) => {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), matte('#e9e2d4', { unique: true, params: { transparent: true, opacity: 0.5, depthWrite: false } }));
      g.add(m); puffs.push({ m, p, i, ci });
    }
  });
  return {
    group: g, set(t, wind = 1) {
      for (const q of puffs) {
        const life = 4.2; const u = ((t + q.i * life / 7 + q.ci * 0.37) % life) / life;
        q.m.position.set(q.p.x + u * 2.6 * wind + Math.sin(u * 5 + q.ci) * 0.2, q.p.y + u * 4.5, q.p.z - u * 0.8);
        q.m.scale.setScalar(0.35 + u * 1.6);
        q.m.rotation.set(u * 2 + q.i, u * 3, 0);
        q.m.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15));
      }
    },
  };
}

// ---------- birds (flapping V) ----------
export function makeBirds(n = 9, seed = 3) {
  const g = new THREE.Group(); const list = [];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.18, 0, 0.55, 0.22, 0, 0.42]), 3));
  wingGeo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#3a2c22', side: THREE.DoubleSide, fog: true });
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, mat); const r = new THREE.Mesh(wingGeo, mat); r.scale.z = -1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.09), mat);
    b.add(l, r, body); g.add(b); list.push({ b, l, r, i });
  }
  return {
    group: g, set(t, center = new THREE.Vector3(), radius = 30, height = 18) {
      for (const q of list) {
        const sp = 0.08 + 0.05 * hash01(q.i, seed); const a = t * sp + hash01(q.i, seed + 1) * 6.28;
        const rr = radius * (0.6 + 0.6 * hash01(q.i, seed + 2));
        q.b.position.set(center.x + Math.cos(a) * rr, center.y + height + 4 * hash01(q.i, seed + 3) + Math.sin(t * 0.7 + q.i) * 0.6, center.z + Math.sin(a) * rr * 0.6);
        q.b.rotation.y = -a - Math.PI / 2 * Math.sign(sp);
        const f = Math.sin(t * 9 + q.i * 2.1); q.l.rotation.x = 0.7 * f; q.r.rotation.x = -0.7 * f;
        q.b.scale.setScalar(1.3);
      }
    },
  };
}

// ---------- rain streaks (world) ----------
export function makeRain(N = 2600) {
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#c7d2dc', transparent: true, opacity: 0.55, fog: true });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false;
  return {
    group: lines, set(t, center, k = 1, box = 40, wind = 0.35) {
      lines.visible = k > 0.001; mat.opacity = 0.55 * k;
      const H = 30;
      for (let i = 0; i < N; i++) {
        const x = center.x + (hash01(i, 11) - 0.5) * box, z = center.z + (hash01(i, 12) - 0.5) * box;
        const sp = 22 + 8 * hash01(i, 13);
        const y = center.y + H - ((t * sp + hash01(i, 14) * H) % H) - 4;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x - wind * 1.2; pos[i * 6 + 4] = y + 1.3; pos[i * 6 + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- lightning bolt ----------
export function makeBolt(seed = 7) {
  const r = mulberry32(seed);
  const pts = []; let x = 0, y = 0;
  for (let i = 0; i < 14; i++) { pts.push(new THREE.Vector3(x, y, 0)); x += (r() - 0.5) * 3.2; y -= 2.2 + r() * 1.4; }
  const geos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const len = a.distanceTo(b);
    const gg = new THREE.BoxGeometry(0.22, len, 0.22); gg.rotateZ(-Math.atan2(b.x - a.x, a.y - b.y)); gg.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0); geos.push(gg);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.2, 3.8), transparent: true, fog: false }));
  return m;
}

// ---------- storm clouds ----------
export function makeCloud(seed, scale = 1, color = '#5d6068') {
  const r = mulberry32(seed); const geos = [];
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(2 + r() * 2.2, 1);
    g.scale(1, 0.62, 0.9); g.translate((i - n / 2) * 2.4 + r(), r() * 1.2, (r() - 0.5) * 3);
    geos.push(g);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), matte(color, { unique: true, params: { transparent: true, opacity: 1 } }));
  m.scale.setScalar(scale); m.castShadow = true;
  return m;
}

// ---------- sawdust specks ----------
export function makeDust(N = 70) {
  const pos = new Float32Array(N * 3);
  const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.07, color: '#e8d2a0', transparent: true, depthWrite: false, fog: true, map: radialTex() }));
  pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.frustumCulled = false;
  return {
    group: pts, set(t, origin, strikes = [], k = 1) {
      pts.visible = k > 0;
      const a = pos;
      for (let i = 0; i < N; i++) {
        let best = -1;
        for (const s of strikes) if (t >= s && t - s < 1.2) best = s;
        if (best < 0) { a[i * 3 + 1] = -999; continue; }
        const u = t - best; const vx = (hash01(i, 21) - 0.5) * 1.6, vy = 0.6 + hash01(i, 22) * 1.4, vz = 0.3 + hash01(i, 23) * 1.2;
        a[i * 3] = origin.x + vx * u; a[i * 3 + 1] = origin.y + vy * u - 2.4 * u * u; a[i * 3 + 2] = origin.z + vz * u;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- 4-point glint ----------
let _star = null;
function starTex() {
  if (_star) return _star;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,200,0.5)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[128, 5], [5, 128]]) { const l = g.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2); l.addColorStop(0, 'rgba(255,240,200,0)'); l.addColorStop(0.5, 'rgba(255,250,230,1)'); l.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = l; g.fillRect(64 - w / 2, 64 - h / 2, w, h); }
  _star = new THREE.CanvasTexture(c); return _star;
}
export function makeGlint() {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), color: new THREE.Color(2.2, 1.8, 1.1), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  m.renderOrder = 50;
  return { group: m, set(t, t0, pos, size = 1.2) {
    const u = (t - t0) / 0.9; m.visible = u > 0 && u < 1;
    if (!m.visible) return; const k = Math.sin(Math.PI * u);
    m.position.copy(pos); m.scale.setScalar(size * (0.3 + 0.9 * k)); m.material.rotation = u * 0.8; m.material.opacity = k;
  } };
}

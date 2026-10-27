// Atmosphere & effects. Everything is a pure function of time t (deterministic, seeded).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radialTex } from './materials.js';
import { hash01, mulberry32, clamp, smooth, invLerp, lerp, noise2, easeOut } from '../lib/util.js';

// ---------- sky dome: gradient + sun glow/disk + procedural stars + moon ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#9fb6c4') }, horizon: { value: new THREE.Color('#e6d6b0') }, bottom: { value: new THREE.Color('#b8a070') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunGlow: { value: new THREE.Color(0, 0, 0) }, sunDisk: { value: new THREE.Color(0, 0, 0) },
      stars: { value: 0 }, time: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, moon: { value: 0 }, band: { value: new THREE.Color(0, 0, 0) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunGlow; uniform vec3 sunDisk;
      uniform float stars; uniform float time; uniform vec3 moonDir; uniform float moon; uniform vec3 band; varying vec3 vDir;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){ vec3 d = normalize(vDir); float y = d.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(horizon, bottom, clamp(-y * 4.0, 0.0, 1.0));
        c += band * exp(-pow(y / 0.06, 2.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunGlow * (pow(s, 24.0) * 1.2 + pow(s, 4.0) * 0.25) + sunDisk * smoothstep(0.99935, 0.9997, s);
        if (stars > 0.0) {
          float hz = smoothstep(0.0, 0.22, y);
          // dense faint field
          vec3 p = d * 300.0; vec3 cell = floor(p); float h = h3(cell); vec3 f = fract(p) - 0.5 - (vec3(h3(cell + 3.1), h3(cell + 7.7), h3(cell + 1.3)) - 0.5) * 0.5;
          float st = step(0.955, h) * smoothstep(0.2, 0.0, length(f)) * (0.6 + 0.4 * sin(time * (1.5 + h * 3.0) + h * 60.0));
          c += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), fract(h * 7.3)) * st * stars * hz * (0.6 + 1.6 * fract(h * 13.7));
          // fewer bright stars (HDR, a touch of bloom)
          vec3 p2 = d * 110.0; vec3 c2 = floor(p2); float h2 = h3(c2 + 11.0); vec3 f2 = fract(p2) - 0.5 - (vec3(h3(c2 + 5.1), h3(c2 + 2.7), h3(c2 + 9.3)) - 0.5) * 0.6;
          float st2 = step(0.93, h2) * (smoothstep(0.09, 0.0, length(f2)) * 3.5 + smoothstep(0.22, 0.0, length(f2)) * 0.35) * (0.7 + 0.3 * sin(time * (2.0 + h2 * 4.0) + h2 * 40.0));
          c += mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.8), fract(h2 * 5.1)) * st2 * stars * hz;
          // faint milky band
          float mb = exp(-pow(dot(d, normalize(vec3(0.35, 0.25, 0.9))) / 0.18, 2.0));
          c += vec3(0.05, 0.06, 0.09) * mb * stars * hz * (0.6 + 0.8 * h3(floor(d * 60.0)));
        }
        if (moon > 0.0) { float m = dot(d, normalize(moonDir));
          c += moon * (smoothstep(0.99965, 0.99978, m) * vec3(2.2, 2.15, 2.0) + pow(max(m, 0.0), 900.0) * vec3(0.35, 0.42, 0.6) + pow(max(m, 0.0), 40.0) * vec3(0.04, 0.05, 0.08)); }
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  // drawn LAST among opaque objects (depth-tested, never writes depth): early-z skips every pixel the world
  // already covers, so the gradient/stars shader only runs where the sky is actually visible (~130 ms -> a fraction)
  m.renderOrder = 1000; m.frustumCulled = false;
  return m;
}

// ---------- camera-facing sprites (instanced quads; size in world units, any size) ----------
export function makeSprites(N, { additive = false, tex = null, fog = true, depthTest = true, order = 3 } = {}) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  const iSR = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iCol', iCol); geo.setAttribute('iSR', iSR);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest, fog,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
    vertexShader: `attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSR; varying vec2 vUv; varying vec4 vCol;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vCol = iCol; vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
        float c = cos(iSR.y), s = sin(iSR.y); vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
        mvPosition.xy += p * iSR.x; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
      #include <fog_pars_fragment>
      void main(){ float a = texture2D(map, vUv).a * vCol.a; if (a < 0.002) discard; gl_FragColor = vec4(vCol.rgb${additive ? ' * a' : ''}, ${additive ? '1.0' : 'a'});
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.map.value = tex || radialTex();
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order;
  let n = 0;
  return {
    group: mesh, mat,
    begin() { n = 0; },
    add(x, y, z, size, r, g, b, a, rot = 0) {
      if (n >= N || a <= 0.001 || size <= 0) return;
      iPos.setXYZ(n, x, y, z); iCol.setXYZW(n, r, g, b, a); iSR.setXY(n, size, rot); n++;
    },
    end() { geo.instanceCount = n; iPos.needsUpdate = iCol.needsUpdate = iSR.needsUpdate = true; mesh.visible = n > 0; },
  };
}

// ---------- soft procedural textures ----------
const _tex = {};
function canvasTex(key, w, h, draw, srgb = true) {
  if (_tex[key]) return _tex[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  _tex[key] = t; return t;
}
export function puffTex() { // lumpy soft cloud-puff alpha
  return canvasTex('puff', 128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5, v = y / h - 0.5, r = Math.hypot(u, v) * 2;
      const n = 0.5 + 0.5 * (noise2(x * 0.06, y * 0.06, 3) * 0.6 + noise2(x * 0.15, y * 0.15, 5) * 0.4);
      const a = clamp(1 - r) ** 1.6 * (0.55 + 0.6 * n);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * clamp(a));
    }
    g.putImageData(img, 0, 0);
  }, false);
}
export function cloudTex(seed = 1) { // wide soft cloud bank
  return canvasTex('cloud' + seed, 256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const base = Math.sin(Math.PI * u) ** 0.8 * smooth(invLerp(1.0, 0.45, v)) * smooth(invLerp(0.05, 0.4, v));
      let n = 0, a = 0.5, f = 1;
      for (let o = 0; o < 4; o++) { n += a * noise2(u * 6 * f + seed * 7, v * 3 * f, seed + o); a *= 0.5; f *= 2.1; }
      const al = clamp(base * (0.6 + 1.2 * n) - 0.08);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * al);
    }
    g.putImageData(img, 0, 0);
  }, false);
}

// ---------- god rays: soft additive shafts laid along the light direction, turned to the camera ----------
function rayTex() {
  return canvasTex('ray', 64, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = 1 - y / (H - 1);
      const a = Math.pow(Math.sin(Math.PI * u), 2.2) * smooth(invLerp(0.0, 0.45, v)) * (1 - smooth(invLerp(0.8, 1.0, v)));
      const i = (y * W + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
  }, false);
}
export function makeRays(n = 5, seed = 4) {
  const g = new THREE.Group(); const list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rayTex(), color: new THREE.Color(1.0, 0.86, 0.62), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = 5; g.add(m); list.push(m);
  }
  const yA = new THREE.Vector3(), xA = new THREE.Vector3(), zA = new THREE.Vector3(), toCam = new THREE.Vector3(), M = new THREE.Matrix4();
  return {
    group: g,
    // dir: direction the light travels; shafts: [{ p: [x,y,z] lit end, w, len, a }]
    set(t, camera, dir, shafts, k = 1, color = null) {
      list.forEach((m, i) => {
        const S = shafts[i]; m.visible = !!S && k > 0.001; if (!m.visible) return;
        if (color) m.material.color.setRGB(...color);
        yA.set(...dir).normalize().negate();
        m.position.set(...S.p).addScaledVector(yA, S.len / 2);
        toCam.copy(camera.position).sub(m.position).normalize();
        xA.crossVectors(yA, toCam).normalize(); zA.crossVectors(xA, yA);
        M.makeBasis(xA, yA, zA); m.quaternion.setFromRotationMatrix(M);
        m.scale.set(S.w, S.len, 1);
        m.material.opacity = k * S.a * (0.75 + 0.25 * Math.sin(t * (0.35 + 0.3 * hash01(i, seed)) + i * 1.9));
      });
    },
  };
}

// ---------- floating dust motes lit by the light (additive, twinkling) ----------
export function makeMotes(N = 200, seed = 9) {
  const sp = makeSprites(N, { additive: true, fog: false, order: 6 });
  return {
    group: sp.group,
    set(t, center, size = [14, 7, 10], k = 1, tint = [1.0, 0.82, 0.55], pointSize = 0.06) {
      sp.begin();
      if (k > 0.001) for (let i = 0; i < N; i++) {
        const h1 = hash01(i, seed), h2 = hash01(i, seed + 1), h3 = hash01(i, seed + 2), h4 = hash01(i, seed + 3);
        const y = (h2 * size[1] + t * (0.04 + 0.1 * h3)) % size[1];
        const x = center[0] + (h1 - 0.5) * size[0] + 0.4 * Math.sin(t * (0.2 + 0.25 * h2) + i);
        const z = center[2] + (h3 - 0.5) * size[2] + 0.35 * Math.cos(t * (0.15 + 0.2 * h1) + i * 1.7);
        const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + 2.0 * h1) + i * 2.3);
        const b = k * (0.25 + 0.75 * tw) * Math.sin(Math.PI * y / size[1]) * (0.4 + 0.9 * h4);
        sp.add(x, center[1] + y + 0.08 * Math.sin(t * (0.9 + h4) + i * 0.7), z, pointSize * (0.6 + 0.8 * h4), tint[0] * b, tint[1] * b, tint[2] * b, 1);
      }
      sp.end();
    },
  };
}

// ---------- birds (flapping V) ----------
export function makeBirds(n = 9, seed = 3, color = '#3a2c22') {
  const g = new THREE.Group(); const list = [];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.18, 0, 0.55, 0.22, 0, 0.42]), 3));
  wingGeo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true });
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, mat); const r = new THREE.Mesh(wingGeo, mat); r.scale.z = -1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.09), mat);
    b.add(l, r, body); g.add(b); list.push({ b, l, r, i });
  }
  return {
    group: g,
    // path(i, t) -> [x, y, z, heading]; flap speed per bird
    set(t, path, scale = 1.3, flap = 9) {
      for (const q of list) {
        const [x, y, z, hd] = path(q.i, t);
        q.b.position.set(x, y, z); q.b.rotation.y = hd;
        const f = Math.sin(t * flap + q.i * 2.1); q.l.rotation.x = 0.7 * f; q.r.rotation.x = -0.7 * f;
        q.b.scale.setScalar(scale);
      }
    },
  };
}

// ---------- lightning bolt (tiny, for the storm in the mind) ----------
export function makeBolt(seed = 7, steps = 9) {
  const r = mulberry32(seed);
  const pts = []; let x = 0, y = 0;
  for (let i = 0; i < steps; i++) { pts.push(new THREE.Vector3(x, y, 0)); x += (r() - 0.5) * 0.5; y -= 0.22 + r() * 0.16; }
  const geos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const len = a.distanceTo(b);
    const gg = new THREE.BoxGeometry(0.035, len, 0.035); gg.rotateZ(-Math.atan2(b.x - a.x, a.y - b.y)); gg.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0); geos.push(gg);
  }
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 3.1, 4.2), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
}

// ---------- camp fire: shader flames + glow + embers + smoke ----------
export const FLAME_FS = `uniform float time; uniform float seed; uniform float k; varying vec2 vUv;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
void main(){ vec2 uv = vUv;
  float n = fbm(vec2(uv.x * 3.0 + seed, uv.y * 3.5 - time * 2.4));
  float w = mix(0.42, 0.04, pow(uv.y, 0.8));
  float dx = abs(uv.x - 0.5 + (n - 0.5) * 0.42 * uv.y);
  float shape = smoothstep(w, w * 0.25, dx) * smoothstep(1.0, 0.35 + n * 0.35, uv.y) * smoothstep(0.0, 0.06, uv.y);
  vec3 col = mix(vec3(0.95, 0.22, 0.03), vec3(1.0, 0.62, 0.16), smoothstep(0.1, 0.6, shape));
  col = mix(col, vec3(1.0, 0.86, 0.55), smoothstep(0.75, 1.0, shape));
  gl_FragColor = vec4(col * shape * k * 0.95, 1.0); }`;
export function makeFire(seed = 5) {
  const g = new THREE.Group();
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, seed: { value: i * 3.7 + seed }, k: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FLAME_FS,
    }));
    m.renderOrder = 7; g.add(m); flames.push(m);
  }
  // logs + stones ring
  const logMat = new THREE.MeshLambertMaterial({ color: '#4a3020', flatShading: true });
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.95, 6), logMat);
    l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = i / 5 * Math.PI * 2; l.position.set(Math.cos(i * 1.256) * 0.12, 0.16, Math.sin(i * 1.256) * 0.12);
    l.castShadow = true; g.add(l);
  }
  const stoneMat = new THREE.MeshLambertMaterial({ color: '#6d665e', flatShading: true });
  for (let i = 0; i < 11; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + 0.05 * hash01(i, 3), 0), stoneMat); const a = i / 11 * Math.PI * 2; s.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62); s.scale.y = 0.6; g.add(s); }
  const coal = new THREE.Mesh(new THREE.CircleGeometry(0.45, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.32, 0.05), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, map: radialTex() }));
  coal.position.y = 0.03; g.add(coal);
  const glow = makeSprites(3, { additive: true, fog: false, order: 8 });
  const embers = makeSprites(70, { additive: true, fog: false, order: 8 });
  const smoke = makeSprites(16, { tex: puffTex(), order: 4 });
  g.add(glow.group, embers.group, smoke.group);
  const _p = new THREE.Vector3();
  return {
    group: g,
    flicker(t) { return 0.82 + 0.12 * noise2(t * 7.0, 1.3, seed) + 0.06 * noise2(t * 17.0, 4.1, seed); },
    set(t, camera, k = 1) {
      g.visible = k > 0.001; if (!g.visible) return;
      const o = g.getWorldPosition(_p);
      const yaw = Math.atan2(camera.position.x - o.x, camera.position.z - o.z);
      flames.forEach((m, i) => {
        m.material.uniforms.time.value = t + i * 0.37; m.material.uniforms.k.value = k * (0.8 + 0.2 * noise2(t * 3 + i, 2, seed));
        const a = i / flames.length * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.14 * (i % 2), 0.1, Math.sin(a) * 0.14 * (i % 2));
        m.rotation.set(0, yaw + (i - 2.5) * 0.18, 0);
        const s = (i < 2 ? 1.25 : 0.85) * (0.9 + 0.15 * noise2(t * 2.2, i, seed));
        m.scale.set(0.62 * s, 1.15 * s, 1);
      });
      const f = this.flicker(t) * k;
      glow.begin(); glow.add(o.x, o.y + 0.55, o.z, 2.4 * f, 0.55 * f, 0.26 * f, 0.07 * f, 0.5); glow.add(o.x, o.y + 0.35, o.z, 0.8, 0.7 * f, 0.42 * f, 0.15 * f, 0.55); glow.end();
      coal.material.opacity = 0.7 + 0.3 * f;
      embers.begin();
      for (let i = 0; i < 70; i++) {
        const life = 1.4 + 1.6 * hash01(i, 41); const u = ((t + hash01(i, 42) * life) % life) / life;
        const x = o.x + (hash01(i, 43) - 0.5) * 0.5 + 0.35 * noise2(t * 0.8 + i, 3, 9) * u;
        const z = o.z + (hash01(i, 44) - 0.5) * 0.5 + 0.35 * noise2(t * 0.8 + i, 7, 9) * u;
        const y = o.y + 0.25 + u * (1.6 + 1.6 * hash01(i, 45));
        const b = k * (1 - u) * (0.6 + 0.4 * Math.sin(t * 20 + i));
        embers.add(x, y, z, 0.035 + 0.03 * hash01(i, 46), 1.8 * b, 0.7 * b, 0.15 * b, 1);
      }
      embers.end();
      smoke.begin();
      for (let i = 0; i < 16; i++) {
        const life = 4.5; const u = ((t + i * life / 16) % life) / life;
        smoke.add(o.x + 0.6 * u * Math.sin(i), o.y + 1.2 + u * 3.2, o.z + 0.3 * u * Math.cos(i * 1.7), 0.5 + u * 1.6, 0.16, 0.15, 0.17, 0.32 * Math.sin(Math.PI * u) * k, i);
      }
      smoke.end();
    },
  };
}

// ---------- glowing gold threads between people (snap + regrow) ----------
export function makeThreads(n, segs = 26) {
  const V = n * (segs + 1) * 2;
  const pos = new Float32Array(V * 3), col = new Float32Array(V * 4);
  const idx = [];
  for (let k = 0; k < n; k++) for (let i = 0; i < segs; i++) {
    const a = (k * (segs + 1) + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 9;
  const sparks = makeSprites(n * 14, { additive: true, fog: false, order: 10 });
  const g = new THREE.Group(); g.add(mesh, sparks.group);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Vector3();
  const curve = (s, sag, out) => { out.copy(A).lerp(B, s); out.y -= sag * 4 * s * (1 - s); return out; };
  return {
    group: g,
    // list: [{ a:[x,y,z], b:[x,y,z], snap: t|null, regrow: t|null, alpha }], cam: camera
    set(t, cam, list, width = 0.035, color = [1.25, 0.78, 0.22]) {
      sparks.begin();
      for (let k = 0; k < n; k++) {
        const L = list[k]; const base = k * (segs + 1) * 2;
        const vis = L && L.alpha > 0.001;
        if (vis) { A.set(...L.a); B.set(...L.b); }
        // state: intact / snapping / gone / regrowing
        let mode = 'intact', u = 0;
        if (vis && L.snap != null && t >= L.snap) { mode = 'snap'; u = (t - L.snap) / 0.75; if (u >= 1) mode = 'gone'; }
        if (vis && L.regrow != null && t >= L.regrow) { mode = 'regrow'; u = clamp((t - L.regrow) / 0.6); }
        const sag = 0.12;
        for (let i = 0; i <= segs; i++) {
          const s = i / segs; let alpha = 0, w = width;
          if (vis) {
            if (mode === 'intact') { alpha = L.alpha; }
            else if (mode === 'snap') {
              const left = s < 0.5; const sl = left ? s / 0.5 : (1 - s) / 0.5; // 0 at the anchor, 1 at the cut
              const rec = easeOut(u) * 1.05; alpha = L.alpha * (1 - u) ** 2 * (sl < 1 - rec * 0.9 ? 1 : 0.0);
              w = width * (1 + 0.6 * (1 - u));
            } else if (mode === 'regrow') {
              const reach = easeOut(u) * 0.5; alpha = L.alpha * ((s <= reach || s >= 1 - reach) ? 1 : 0);
            }
          }
          curve(s, sag, P);
          if (vis && mode === 'snap') { // recoiling halves whip and curl back toward their anchors
            const left = s < 0.5; const sl = left ? s / 0.5 : (1 - s) / 0.5; const pull = easeOut(u) * sl;
            P.lerp(left ? A : B, pull * 0.85);
            P.y += Math.sin(sl * 9 - u * 22) * 0.09 * (1 - u) * sl - 0.25 * u * u * sl;
          }
          curve(Math.min(1, s + 0.01), sag, T); T.sub(curve(Math.max(0, s - 0.01), sag, C)).normalize();
          S.copy(cam.position).sub(P); S.crossVectors(T, S).normalize().multiplyScalar(w / 2);
          const vi = base + i * 2;
          pos[vi * 3] = P.x + S.x; pos[vi * 3 + 1] = P.y + S.y; pos[vi * 3 + 2] = P.z + S.z;
          pos[vi * 3 + 3] = P.x - S.x; pos[vi * 3 + 4] = P.y - S.y; pos[vi * 3 + 5] = P.z - S.z;
          // a slow pulse of light travels along each thread
          const pulse = 0.65 + 0.35 * Math.sin(s * 12 - t * 3.2 + k * 1.7) + (mode === 'regrow' ? 1.5 * Math.exp(-(((t - L.regrow - 0.6) / 0.18) ** 2)) : 0);
          for (const j of [vi, vi + 1]) { col[j * 4] = color[0] * pulse; col[j * 4 + 1] = color[1] * pulse; col[j * 4 + 2] = color[2] * pulse; col[j * 4 + 3] = alpha; }
        }
        // sparks at the snap point / the join
        if (vis && L.snap != null) {
          const su = (t - L.snap) / 0.6;
          if (su > 0 && su < 1) {
            curve(0.5, sag, C);
            for (let q = 0; q < 14; q++) {
              const vx = (hash01(k * 31 + q, 1) - 0.5) * 1.6, vy = 0.2 + hash01(k * 31 + q, 2) * 1.2, vz = (hash01(k * 31 + q, 3) - 0.5) * 1.6;
              const b = (1 - su) ** 1.5 * L.alpha;
              sparks.add(C.x + vx * su * 0.6, C.y + vy * su * 0.6 - 1.2 * su * su * 0.36, C.z + vz * su * 0.6, 0.05, 2.2 * b, 1.5 * b, 0.6 * b, 1);
            }
            sparks.add(C.x, C.y, C.z, 0.5 * (1 - su), 2.0 * (1 - su), 1.4 * (1 - su), 0.5 * (1 - su), 1);
          }
        }
        if (vis && L.regrow != null) {
          const ju = (t - L.regrow - 0.55) / 0.5;
          if (ju > 0 && ju < 1) { curve(0.5, sag, C); const b = Math.sin(Math.PI * ju) * L.alpha; sparks.add(C.x, C.y, C.z, 0.35 + 0.4 * ju, 2.2 * b, 1.7 * b, 0.8 * b, 1); }
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      sparks.end();
    },
  };
}

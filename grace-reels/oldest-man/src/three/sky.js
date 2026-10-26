// Sky helpers driven by the mood (engine-level, so a set only sets mood keys):
//   - drifting low-poly cloud meshes (flat-shaded puffs, lit by the sun, fading into the horizon)
//   - layered dark storm decks (lumpy undersides, drifting, lit from inside by lightning)
//   - a lightning "crack of light" across the sky (branching, grows from its centre, flashes, can hold open)
// The sky dome itself (gradient, sun disc, glow, stars, moon) is fx.js makeSky().
// Mood keys (under mood.sky): clouds, cloudLit, cloudShade, cloudSpeed, cloudAlt, cloudR, cloudScale, cloudSeed,
//   storm, stormDark, stormLit, stormAlt, stormSpeed, crack { age, pos, size, seed, color, glowColor, glowK, cloudK, hold, hole, flash, tilt, skyColor, hemiK }.
//   crack.hole (default 1) opens a rift in the storm decks where the view ray to the crack crosses them (put the crack ABOVE the decks).
// Everything is a pure function of t.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radialTex } from './materials.js';
import { hash01, mulberry32, clamp, smooth, invLerp, lerp, easeOut } from '../lib/util.js';

const NOISE_GLSL = `
float hs(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), f.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm3(vec2 p){ return vn(p) * 0.55 + vn(p * 2.07 + 7.1) * 0.3 + vn(p * 4.3 + 3.3) * 0.15; }`;

// ---------- low-poly cloud puffs ----------
function cloudGeometry(seed) {
  const R = mulberry32(seed); const parts = [];
  const n = 4 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const r = (0.55 + 0.45 * Math.sin(Math.PI * u)) * (0.75 + R() * 0.45);
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      let y = p.getY(k); if (y < -0.12 * r) y = -0.12 * r - (y + 0.12 * r) * 0.15;   // flat-ish bottom
      p.setXYZ(k, p.getX(k) * (1 + (R() - 0.5) * 0.18), y * (1 + (R() - 0.5) * 0.18), p.getZ(k) * (0.75 + (R() - 0.5) * 0.15));
    }
    g.translate((u - 0.5) * n * 0.95 + (R() - 0.5) * 0.3, (R() - 0.3) * 0.25 * r, (R() - 0.5) * 0.5);
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const m = mergeGeometries(parts); m.computeVertexNormals(); m.computeBoundingSphere();
  return m;
}

const CLOUD_VS = `varying vec3 vWP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const CLOUD_FS = `uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uSun; uniform vec3 uHorizon; uniform vec3 uCam; uniform float uFar;
uniform vec3 uFlashCol; uniform vec3 uFlashPos; uniform float uFlash; varying vec3 vWP;
void main(){
  vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
  if (dot(N, uCam - vWP) < 0.0) N = -N;
  float l = clamp(dot(N, normalize(uSun)) * 0.55 + 0.45, 0.0, 1.0);
  float top = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uShade, uLit, clamp(l * 0.7 + top * 0.3, 0.0, 1.0));
  float d = length(vWP - uCam);
  c = mix(c, uHorizon, clamp(1.0 - exp(-d / uFar), 0.0, 0.9));
  c += uFlashCol * uFlash * exp(-pow(length(vWP - uFlashPos) / 260.0, 2.0));
  gl_FragColor = vec4(c, 1.0);
}`;

export function makeCloudLayer({ n = 48, variants = 6, seed = 11 } = {}) {
  const geos = Array.from({ length: variants }, (_, i) => cloudGeometry(seed * 31 + i));
  const mat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, fog: false,
    uniforms: { uLit: { value: new THREE.Color('#fff6e8') }, uShade: { value: new THREE.Color('#b9b0a4') }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uHorizon: { value: new THREE.Color('#e6d6b0') }, uCam: { value: new THREE.Vector3() }, uFar: { value: 900 },
      uFlashCol: { value: new THREE.Color(0, 0, 0) }, uFlashPos: { value: new THREE.Vector3() }, uFlash: { value: 0 } },
  });
  const g = new THREE.Group(); const list = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geos[i % variants], mat); m.frustumCulled = false; m.renderOrder = 995; g.add(m); list.push(m); }  // after the world (early-z), before the dome
  // order in which clouds appear as coverage grows
  const order = list.map((_, i) => i).sort((a, b) => hash01(a, seed + 5) - hash01(b, seed + 5));
  const rank = new Array(n); order.forEach((i, r) => { rank[i] = r; });
  return {
    group: g, mat,
    // S: resolved mood.sky; center: world point the layer is centred on (set offset + look); sunDir: world dir to the sun
    set(t, S, camera, center, sunDir, flash = null) {
      const cov = S.clouds ?? 0; g.visible = cov > 0.001; if (!g.visible) return;
      const u = mat.uniforms; u.uLit.value.set(S.cloudLit ?? '#fff6e8'); u.uShade.value.set(S.cloudShade ?? '#b9b0a4'); u.uHorizon.value.set(S.horizon);
      u.uSun.value.set(...sunDir).normalize(); u.uCam.value.copy(camera.position); u.uFar.value = S.cloudFade ?? 900;
      if (flash) { u.uFlash.value = flash.k; u.uFlashCol.value.set(flash.color); u.uFlashPos.value.copy(flash.pos); } else u.uFlash.value = 0;
      const [r0, r1] = S.cloudR ?? [140, 520]; const alt = S.cloudAlt ?? 85; const sp = S.cloudSpeed ?? 1.2; const sc = S.cloudScale ?? 14;
      const span = r1 * 2;
      list.forEach((m, i) => {
        const vis = clamp(cov * n - rank[i]);
        if (vis <= 0) { m.visible = false; return; }
        const h1 = hash01(i, seed), h2 = hash01(i, seed + 1), h3 = hash01(i, seed + 2), h4 = hash01(i, seed + 3);
        const a = (S.cloudDir ?? 0) + (h1 - 0.5) * (S.cloudArc ?? Math.PI * 2), r = lerp(r0, r1, Math.sqrt(h2));
        let x = Math.sin(a) * r + sp * (0.7 + 0.6 * h3) * t;
        x = ((x + span / 2) % span + span) % span - span / 2;           // wrap inside the layer
        const edge = smooth(invLerp(span / 2, span / 2 - 60, Math.abs(x)));
        const z = -Math.cos(a) * r;
        m.visible = true;
        m.position.set(center.x + x, alt + (h4 - 0.5) * alt * 0.5 + r * 0.04, center.z + z);
        const s = sc * (0.6 + 0.9 * h3) * vis * edge;
        m.scale.set(s * (1 + h4 * 0.6), s * (0.55 + 0.25 * h1), s);
        m.rotation.y = (h2 - 0.5) * 0.8;
      });
    },
  };
}

// ---------- storm decks: lumpy dark undersides, layered, drifting ----------
const DECK_VS = `uniform float uTime; uniform float uAmt; uniform vec2 uDrift; uniform float uSeed; varying vec3 vWP; varying float vN;
${NOISE_GLSL}
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 q = wp.xz * 0.011 + uDrift * uTime + uSeed;
  float n = fbm3(q); vN = n;
  wp.y -= (n * 22.0 + vn(q * 3.1) * 6.0) * uAmt;
  vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const DECK_FS = `uniform vec3 uDark; uniform vec3 uLit; uniform vec3 uHorizon; uniform vec3 uCam; uniform float uOpen; uniform float uFar;
uniform vec3 uFlashCol; uniform vec3 uFlashPos; uniform float uFlash; uniform vec2 uHoleC; uniform vec2 uHoleA; uniform vec2 uHoleR; uniform float uHoleK; uniform vec3 uHoleCol;
varying vec3 vWP; varying float vN;
void main(){
  if (vN < uOpen) discard;
  // the rift: an elliptical opening where the camera->crack ray crosses this deck (ragged by the deck noise)
  float rim = 0.0;
  if (uHoleK > 0.001) {
    vec2 d = vWP.xz - uHoleC; vec2 A = uHoleA, B = vec2(-A.y, A.x);
    float a = dot(d, A) / max(uHoleR.x * uHoleK, 1e-3), b = dot(d, B) / max(uHoleR.y * uHoleK, 1e-3);
    float e = a * a + b * b + (vN - 0.5) * 0.9;
    if (e < 1.0) discard;
    rim = (1.0 - smoothstep(1.0, 2.6, e)) * uHoleK;
  }
  vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
  if (dot(N, uCam - vWP) < 0.0) N = -N;
  float l = clamp(dot(N, normalize(vec3(-0.4, -0.6, 0.5))) * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uDark, uLit, l * l);
  float d = length(vWP - uCam);
  c = mix(c, uHorizon, clamp(1.0 - exp(-d / uFar), 0.0, 0.95));
  c += uFlashCol * uFlash * exp(-pow(length(vWP - uFlashPos) / 320.0, 2.0)) * (0.6 + 0.6 * l);
  c += uHoleCol * rim * rim * 2.2;                 // cloud edges lit from inside the rift
  gl_FragColor = vec4(c, 1.0);
}`;
export function makeStormDecks({ layers = 3, size = 1800, seg = 64, seed = 4 } = {}) {
  const g = new THREE.Group(); const decks = [];
  for (let i = 0; i < layers; i++) {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: DECK_VS, fragmentShader: DECK_FS, fog: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 1 }, uDrift: { value: new THREE.Vector2(0.004 + i * 0.002, 0.0015) }, uSeed: { value: seed + i * 17.3 },
        uDark: { value: new THREE.Color('#2b3038') }, uLit: { value: new THREE.Color('#5d6670') }, uHorizon: { value: new THREE.Color('#6b6f74') }, uCam: { value: new THREE.Vector3() },
        uOpen: { value: 0 }, uFar: { value: 700 }, uFlashCol: { value: new THREE.Color(0, 0, 0) }, uFlashPos: { value: new THREE.Vector3() }, uFlash: { value: 0 },
        uHoleC: { value: new THREE.Vector2() }, uHoleA: { value: new THREE.Vector2(1, 0) }, uHoleR: { value: new THREE.Vector2(1, 1) }, uHoleK: { value: 0 }, uHoleCol: { value: new THREE.Color(1, 0.95, 0.85) } },
    });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 990 + i; g.add(m); decks.push(m);
  }
  const _r = new THREE.Vector3();
  return {
    group: g,
    // hole = { pos: world Vector3 of the crack, size (m), k 0..1 opening, color } -> a rift where the view ray crosses each deck
    set(t, S, camera, center, flash = null, hole = null) {
      const k = S.storm ?? 0; g.visible = k > 0.001; if (!g.visible) return;
      const alt = S.stormAlt ?? 70;
      decks.forEach((m, i) => {
        const u = m.material.uniforms;
        u.uTime.value = t * (S.stormSpeed ?? 1); u.uAmt.value = 0.6 + 0.6 * k;
        u.uDark.value.set(S.stormDark ?? '#2b3038').multiplyScalar(1 + i * 0.12); u.uLit.value.set(S.stormLit ?? '#5d6670'); u.uHorizon.value.set(S.horizon);
        u.uCam.value.copy(camera.position); u.uFar.value = S.stormFade ?? 700;
        // the lowest deck is solid once the storm is full; upper layers stay broken
        u.uOpen.value = i === 0 ? lerp(0.62, 0.0, smooth(k)) : lerp(0.75, 0.35 - i * 0.05, smooth(k));
        if (flash) { u.uFlash.value = flash.k; u.uFlashCol.value.set(flash.color); u.uFlashPos.value.copy(flash.pos); } else u.uFlash.value = 0;
        m.position.set(center.x, alt + i * 16 + (1 - k) * 25, center.z);
        u.uHoleK.value = 0;
        if (hole && hole.k > 0.001) {
          const cam = camera.position, P = hole.pos, yD = m.position.y - 14 * u.uAmt.value;   // mean underside height
          if (P.y > yD && cam.y < yD) {
            const tt = (yD - cam.y) / (P.y - cam.y);
            _r.copy(P).sub(cam).multiplyScalar(tt).add(cam);
            u.uHoleC.value.set(_r.x, _r.z);
            _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _r.y = 0; if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize();
            u.uHoleA.value.set(_r.x, _r.z);
            // the opening spans the bolt across the view; depth-wise it is stretched by the grazing view angle
            const sz = hole.size * tt, grazing = Math.max(0.25, Math.abs((P.y - cam.y) / P.distanceTo(cam)));
            u.uHoleR.value.set(sz * 0.42, sz * 0.12 / grazing);
            u.uHoleK.value = hole.k; u.uHoleCol.value.set(hole.color || '#fff1d6');
          }
        }
      });
    },
  };
}

// ---------- lightning: a branching crack of light ----------
// Envelope of a strike, `age` seconds after it starts: { grow 0..1, core brightness, flash (for post.flash), glow }
export function crackEnv(age, { hold = true } = {}) {
  if (age == null || age < 0) return { grow: 0, core: 0, flash: 0, glow: 0 };
  const grow = easeOut(clamp(age / 0.32));
  const g = (c, w) => Math.exp(-(((age - c) / w) ** 2));
  const pulses = g(0.04, 0.05) * 1.0 + g(0.2, 0.04) * 0.65 + g(0.42, 0.05) * 0.45;
  const settle = hold ? 0.55 + 0.08 * Math.sin(age * 7.3) * Math.sin(age * 3.1) : Math.exp(-age / 0.6);
  const core = Math.max(pulses * 1.6, smooth(clamp(age / 0.15)) * settle);
  return { grow, core, flash: pulses, glow: Math.max(pulses, settle * 0.8) };
}

function crackGeometry(seed, size) {
  const R = mulberry32(seed); const segs = [];
  const arm = (x, y, dir, len, depth, ord, w) => {
    const steps = depth === 0 ? 14 : 7; const st = len / steps;
    let px = x, py = y, o = ord; let ang = dir;
    for (let i = 0; i < steps; i++) {
      ang = dir + (R() - 0.5) * 1.1;
      const nx = px + Math.cos(ang) * st * (0.7 + 0.6 * R()), ny = py + Math.sin(ang) * st * (0.7 + 0.6 * R());
      const no = o + st / (size * 0.5);
      const ww = w * (1 - 0.65 * i / steps);
      segs.push([px, py, nx, ny, o, no, ww]);
      if (depth < 2 && R() < (depth === 0 ? 0.42 : 0.25)) arm(nx, ny, dir + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.7), len * (0.25 + R() * 0.25), depth + 1, no, ww * 0.55);
      px = nx; py = ny; o = no;
    }
  };
  arm(0, 0, 0.05, size * 0.5, 0, 0, size * 0.006);
  arm(0, 0, Math.PI - 0.05, size * 0.5, 0, 0, size * 0.006);
  arm(0, 0, -Math.PI / 2 - 0.3, size * 0.16, 1, 0.05, size * 0.004);
  const pos = [], ord = [], edge = [];
  for (const [x1, y1, x2, y2, o1, o2, w] of segs) {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w * 3, ny = dx / l * w * 3;
    const ex = dx / l * w * 1.5, ey = dy / l * w * 1.5; // overlap the joints a little
    const a = [x1 - ex + nx, y1 - ey + ny], b = [x1 - ex - nx, y1 - ey - ny], c = [x2 + ex + nx, y2 + ey + ny], d = [x2 + ex - nx, y2 + ey - ny];
    for (const [p, oo, e] of [[a, o1, 1], [b, o1, -1], [c, o2, 1], [b, o1, -1], [d, o2, -1], [c, o2, 1]]) { pos.push(p[0], p[1], 0); ord.push(oo); edge.push(e); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aOrd', new THREE.Float32BufferAttribute(ord, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  return geo;
}
export function makeLightningCrack({ seed = 7, size = 300 } = {}) {
  const geo = crackGeometry(seed, size);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uGrow: { value: 0 }, uCore: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.95, 0.85) } },
    vertexShader: 'attribute float aOrd; attribute float aEdge; varying float vO; varying float vE; void main(){ vO = aOrd; vE = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uGrow; uniform float uCore; uniform vec3 uColor; varying float vO; varying float vE;
      void main(){ float on = smoothstep(vO - 0.015, vO, uGrow);
        float prof = exp(-vE * vE * 9.0) * 1.0 + exp(-vE * vE * 1.5) * 0.25;
        vec3 c = uColor * uCore * (prof * 7.0) * on; gl_FragColor = vec4(c, 1.0); }`,
  });
  const bolt = new THREE.Mesh(geo, mat); bolt.frustumCulled = false; bolt.renderOrder = -3;
  const glowMat = new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color(1, 0.9, 0.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat); glow.renderOrder = -4; glow.frustumCulled = false;
  const g = new THREE.Group(); g.add(glow, bolt);
  return {
    group: g, size,
    // C = mood.sky.crack; worldPos = its world position; returns the envelope (for flashes / lights)
    set(t, C, camera, worldPos) {
      const E = crackEnv(C?.age, { hold: C?.hold ?? true });
      g.visible = E.core > 0.001 || E.glow > 0.001; if (!g.visible) return E;
      g.position.copy(worldPos); g.quaternion.copy(camera.quaternion); g.rotateZ(C.tilt ?? -0.08);
      const s = (C.size ?? size) / size; g.scale.setScalar(s);
      mat.uniforms.uGrow.value = E.grow; mat.uniforms.uCore.value = E.core; mat.uniforms.uColor.value.set(C.color ?? '#fff3dc');
      glow.scale.set(size * 1.1 * (0.35 + 0.65 * E.grow), size * 0.32, 1);
      glowMat.color.set(C.glowColor ?? '#ffe2b8').multiplyScalar(E.glow * (C.glowK ?? 1.1));
      return E;
    },
  };
}

// ---------- everything above, wired to the mood ----------
export function makeSkyFx() {
  const clouds = makeCloudLayer();
  const decks = makeStormDecks();
  const crack = makeLightningCrack();
  const g = new THREE.Group(); g.add(clouds.group, decks.group, crack.group);
  const _c = new THREE.Vector3(), _p = new THREE.Vector3();
  return {
    group: g, clouds, decks, crack,
    // M: resolved mood; c: camera shot { look }; o: set offset. Returns the crack envelope.
    set(t, M, camera, c, o) {
      const S = M.sky;
      _c.set(c.look[0], 0, c.look[2]);
      let E = { grow: 0, core: 0, flash: 0, glow: 0 }, flash = null;
      const C = S.crack;
      let hole = null;
      if (C && C.age != null && C.age >= 0) {
        const p = C.pos || [0, 140, -420];
        _p.set(p[0] + o[0], p[1] + o[1], p[2] + o[2]);
        E = crack.set(t, C, camera, _p);
        flash = { k: E.glow * (C.cloudK ?? 0.55), color: C.color ?? '#fff3dc', pos: _p };
        // the rift in the storm decks ("the windows of heaven were opened"): opens with the bolt, stays open while it holds
        if ((C.hole ?? 1) > 0) hole = { pos: _p, size: C.size ?? crack.size, k: (C.hole ?? 1) * smooth(clamp(C.age / 0.45)) * (C.hold === false ? Math.exp(-C.age / 1.2) : 1), color: C.glowColor ?? '#ffe9c8' };
      } else crack.group.visible = false;
      clouds.set(t, S, camera, _c, M.sunDir, flash);
      decks.set(t, S, camera, _c, flash, hole);
      return E;
    },
  };
}

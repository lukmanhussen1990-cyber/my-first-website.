// Clay oil lamp (pinched-spout saucer lamp) with a layered shader flame that flickers, gutters as the oil
// level drops, dies into a curl of smoke, plus glow sprites (bloom) and the matching point light for the
// mood (it lights the 3D world AND the flat characters through U.uPointPos/uPointColor/uPointRange).
// Everything is a pure function of (t, level, outT).
//
//   const lamp = makeOilLamp({ scale: 1.6 });  group.add(lamp.group); lamp.group.position.set(0.9, 0, 0.3);
//   update(t, cam)  -> lamp.set(t, plan.ev.lampLevel(t), cam, { outT: plan.ev.lampOut + 0.35 });
//   mood(t)         -> { point: lamp.light(t, plan.ev.lampLevel(t), { outT: plan.ev.lampOut + 0.35 }) }
import * as THREE from 'three';
import { makeSprites } from './fx.js';
import { hash01, mulberry32, clamp, smooth, invLerp, lerp, noise2, easeIn, easeOut } from '../lib/util.js';

// ±8 % amber flicker at 6–9 Hz (seeded value noise)
export function lampFlicker(t, seed = 3) {
  return 1 + 0.055 * noise2(t * 7.3, 1.7, seed) + 0.03 * noise2(t * 8.9 + 4.1, 3.3, seed + 1) + 0.02 * noise2(t * 2.1, 7.7, seed + 2);
}

// flame state: k = overall size/brightness 0..1, gutter 0..1, sway, alive, and post-death ages
export function flameState(t, level = 1, { outT = null, seed = 3 } = {}) {
  const gutter = smooth(invLerp(0.42, 0.15, level));
  let k = lerp(0.72, 1.0, smooth(invLerp(0.15, 0.8, level)));
  const fl = lampFlicker(t, seed);
  // guttering: bigger, slower irregular dips (the flame nearly goes out and recovers)
  const dipN = noise2(t * 2.6, 5.1, seed + 7) * 0.5 + 0.5;
  const dip = gutter * smooth(invLerp(0.5, 0.9, dipN));
  k *= (1 - 0.55 * dip) * (1 + (fl - 1) * (1 + 2.2 * gutter));
  let dieU = 0;
  if (outT != null && t >= outT) dieU = clamp((t - outT) / 0.32);
  else if (outT == null && level <= 0.001) dieU = 1;
  k *= 1 - easeIn(dieU);
  const sway = (0.12 + 0.25 * gutter) * noise2(t * 1.7, 2.2, seed + 3) + 0.05 * noise2(t * 6.1, 9.4, seed + 4);
  return {
    k: Math.max(0, k), gutter, sway, fl, dip, alive: dieU < 1,
    blue: 0.6 + 0.6 * gutter + 1.2 * dieU,
    age: outT != null ? t - outT : (level <= 0.001 ? 99 : -1),
  };
}

const FLAME_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FLAME_FS = `uniform float uTime; uniform float uK; uniform float uSway; uniform float uSeed; uniform float uBlue; uniform float uGutter; uniform float uLayer;
varying vec2 vUv;
float hs(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), f.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  float y = vUv.y; vec2 p = vec2(vUv.x - 0.5, y);
  p.x -= uSway * y * y * 0.35;
  float n = vn(vec2(p.x * 5.0 + uSeed, y * 3.2 - uTime * 7.0)) + 0.5 * vn(vec2(p.x * 11.0 - uSeed, y * 6.0 - uTime * 11.0));
  p.x += (n - 0.75) * 0.09 * y * (1.0 + 1.5 * uGutter);
  // teardrop: round belly low, long taper to a soft tip
  float belly = 0.2;
  float w = y < belly ? 0.34 * sqrt(max(y, 0.0) / belly) * (0.85 + 0.15 * y / belly) : 0.34 * pow(1.0 - (y - belly) / (1.0 - belly), 1.35);
  w *= mix(1.0, 0.8, uLayer);
  float d = abs(p.x) / max(w, 1e-3);
  float tip = smoothstep(1.0, 0.7 + 0.15 * n, y);
  float body = smoothstep(1.0, 0.45, d) * tip * smoothstep(0.0, 0.035, y);
  float core = smoothstep(0.75, 0.05, d) * smoothstep(0.62, 0.12, y) * smoothstep(0.02, 0.12, y);
  float blue = smoothstep(0.24, 0.03, y) * smoothstep(1.05, 0.5, d) * smoothstep(0.0, 0.03, y);
  vec3 outer = mix(vec3(1.0, 0.30, 0.05), vec3(1.0, 0.58, 0.16), smoothstep(0.0, 0.6, body));
  vec3 c = outer * body * (1.5 - 0.5 * uGutter)
         + vec3(1.0, 0.86, 0.6) * core * (4.2 - 1.6 * uGutter) * (1.0 - uLayer * 0.6)
         + vec3(0.18, 0.32, 1.0) * blue * 0.9 * uBlue;
  c *= uK * (uLayer > 0.5 ? 0.45 : 1.0);
  gl_FragColor = vec4(c, 1.0);
}`;

const SMOKE_VS = `attribute float aA; attribute float aV; varying float vA; varying float vV; varying vec2 vS;
void main(){ vA = aA; vV = aV; vS = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SMOKE_FS = `uniform vec3 uColor; uniform float uTime; varying float vA; varying float vV;
float hs(float n){ return fract(sin(n) * 43758.5453); }
void main(){ float e = 1.0 - abs(vV * 2.0 - 1.0); float a = vA * smoothstep(0.0, 0.8, e) * (0.75 + 0.25 * sin(vV * 9.0 + uTime * 3.0));
  if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`;

// clay saucer lamp with a pinched spout pointing +x; returns geometry + the local wick tip
function lampGeometry(seed, clay) {
  const prof = [[0.0, 0.0], [0.028, 0.0], [0.034, 0.006], [0.058, 0.016], [0.07, 0.028], [0.073, 0.035], [0.069, 0.038], [0.062, 0.032], [0.05, 0.022], [0.03, 0.014], [0.0, 0.012]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 26);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z), phi = Math.atan2(z, x);
    const g = Math.exp(-((phi / 0.5) ** 2)), s = smooth(invLerp(0.012, 0.036, y)) * smooth(invLerp(0.02, 0.06, r));
    const rr = r * (1 + 0.62 * g * s);
    x = Math.cos(phi) * rr; z = Math.sin(phi) * rr * (1 - 0.55 * g * s);
    y += 0.005 * g * s + 0.0015 * Math.sin(phi * 5 + seed);
    p.setXYZ(i, x, y, z);
  }
  const ng = geo.toNonIndexed(); ng.computeVertexNormals();
  // per-face colour variation (fired clay)
  const R = mulberry32(seed); const base = new THREE.Color(clay); const c = new THREE.Color();
  const col = new Float32Array(ng.attributes.position.count * 3);
  for (let f = 0; f < col.length / 9; f++) {
    const y = ng.attributes.position.getY(f * 3);
    c.copy(base).multiplyScalar((0.88 + R() * 0.2) * (y > 0.03 ? 1.08 : 1));
    for (let k = 0; k < 3; k++) { col[f * 9 + k * 3] = c.r; col[f * 9 + k * 3 + 1] = c.g; col[f * 9 + k * 3 + 2] = c.b; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}

export function makeOilLamp({ scale = 1, seed = 3, clay = '#b5653a', oil = '#24140a', smokeColor = '#a2abb6' } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale);
  const body = new THREE.Mesh(lampGeometry(seed, clay), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  // oil surface (glossy, catches the flame) and the wick lying in the spout
  const oilMat = new THREE.MeshStandardMaterial({ color: oil, roughness: 0.18, metalness: 0.0 });
  const oilM = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), oilMat); g.add(oilM);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 0.06, 6), new THREE.MeshLambertMaterial({ color: '#2b1c12', flatShading: true }));
  wick.position.set(0.085, 0.03, 0); wick.rotation.z = -1.15; g.add(wick);
  const tip = new THREE.Vector3(0.112, 0.041, 0);            // flame base (local)
  // flame: two camera-facing layers (core + soft outer envelope)
  const fmat = (layer) => new THREE.ShaderMaterial({
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uSway: { value: 0 }, uSeed: { value: seed * 1.7 + layer * 5.3 }, uBlue: { value: 1 }, uGutter: { value: 0 }, uLayer: { value: layer } },
  });
  const flameHold = new THREE.Group(); flameHold.position.copy(tip); g.add(flameHold);
  const flames = [0, 1].map((layer) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), fmat(layer)); m.renderOrder = 8 + layer; m.frustumCulled = false; flameHold.add(m); return m; });
  // glow sprites (HDR, feed the bloom) + ember on the dead wick
  const glow = makeSprites(4, { additive: true, fog: false, order: 7 });
  g.add(glow.group);
  // smoke curl ribbon
  const SM = 48;
  const sp = new Float32Array((SM + 1) * 2 * 3), sa = new Float32Array((SM + 1) * 2), sv = new Float32Array((SM + 1) * 2);
  const sidx = []; for (let i = 0; i < SM; i++) { const a = i * 2; sidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (let i = 0; i <= SM; i++) { sv[i * 2] = 0; sv[i * 2 + 1] = 1; }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('aA', new THREE.BufferAttribute(sa, 1)); sgeo.setAttribute('aV', new THREE.BufferAttribute(sv, 1)); sgeo.setIndex(sidx);
  const smat = new THREE.ShaderMaterial({ vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: { uColor: { value: new THREE.Color(smokeColor) }, uTime: { value: 0 }, ...THREE.UniformsLib.fog } });
  smat.fog = false;
  const smoke = new THREE.Mesh(sgeo, smat); smoke.frustumCulled = false; smoke.renderOrder = 6; g.add(smoke);
  const _w = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

  const api = {
    group: g, tip, body,
    // flame base in the lamp's PARENT space (set-local if the lamp is a direct child of the set group)
    flamePos(out = new THREE.Vector3()) { return out.copy(tip).multiply(g.scale).applyQuaternion(g.quaternion).add(g.position); },
    set(t, level, camera, { outT = null } = {}) {
      const F = flameState(t, level, { outT, seed });
      // oil surface follows the level
      const oy = lerp(0.0135, 0.027, clamp(level)), orad = lerp(0.034, 0.058, clamp((oy - 0.012) / 0.02));
      oilM.position.set(-0.004, oy, 0); oilM.scale.setScalar(orad); oilM.visible = level > 0.02;
      // flame faces the camera around its own vertical axis
      g.updateMatrixWorld();
      const wp = flameHold.getWorldPosition(_w);
      _m.copy(g.matrixWorld).invert(); _c.copy(camera.position).applyMatrix4(_m);
      flameHold.rotation.set(0, Math.atan2(_c.x - tip.x, _c.z - tip.z), 0);
      const h = 0.085 * (0.55 + 0.45 * F.k) * (1 + 0.08 * Math.sin(t * 9.1 + seed)), w = 0.034 * (0.75 + 0.25 * F.k);
      flames.forEach((m, i) => {
        const u = m.material.uniforms; u.uTime.value = t; u.uK.value = F.k; u.uSway.value = F.sway; u.uBlue.value = F.blue; u.uGutter.value = F.gutter;
        m.visible = F.k > 0.003;
        m.scale.set(w * (i ? 1.5 : 1), h * (i ? 1.25 : 1), 1);
        m.position.set(0, -0.004, i ? -0.001 : 0);
      });
      // glow (world-space sprites)
      glow.begin();
      if (F.k > 0.003) {
        const s = g.scale.x, k = F.k * F.fl;
        _v.copy(wp); _v.y += 0.04 * s;
        glow.add(_v.x, _v.y, _v.z, 0.5 * s * (0.8 + 0.2 * k), 0.55 * k, 0.24 * k, 0.06 * k, 0.55);
        glow.add(_v.x, _v.y - 0.01 * s, _v.z, 0.16 * s, 1.6 * k, 0.95 * k, 0.4 * k, 0.65);
      }
      const ember = F.age > 0 ? Math.exp(-Math.max(0, F.age - 0.25) / 0.9) * (0.85 + 0.15 * noise2(t * 5, 1, seed)) : 0;
      if (ember > 0.01) { const s = g.scale.x; glow.add(wp.x, wp.y + 0.002 * s, wp.z, 0.035 * s, 2.4 * ember, 0.7 * ember, 0.12 * ember, 1); glow.add(wp.x, wp.y, wp.z, 0.12 * s, 0.5 * ember, 0.12 * ember, 0.02 * ember, 0.6); }
      glow.end();
      // smoke curl: rises from the wick after the flame dies, the bottom lets go first
      const age = F.age;
      smoke.visible = age > 0.12 && age < 7;
      if (smoke.visible) {
        smat.uniforms.uTime.value = t;
        const a = age - 0.12, Hs = 0.11 + 0.32 * (1 - Math.exp(-a / 1.2));
        const release = Math.max(0, (a - 1.3) / 3.2);
        const viewDir = _v.copy(camera.position).applyMatrix4(_m).sub(tip).normalize();
        for (let i = 0; i <= SM; i++) {
          const s = i / SM;
          const amp = 0.008 + 0.05 * s * s;
          const ph = s * 9.5 - a * 1.6 + seed;
          _t.set(tip.x + amp * Math.sin(ph) + 0.02 * s * s, tip.y + 0.004 + s * Hs + 0.03 * release, tip.z + amp * 0.7 * Math.cos(ph * 0.83));
          // tangent by finite difference
          const s2 = Math.min(1, s + 1 / SM), amp2 = 0.008 + 0.05 * s2 * s2, ph2 = s2 * 9.5 - a * 1.6 + seed;
          _s.set(tip.x + amp2 * Math.sin(ph2) + 0.02 * s2 * s2, tip.y + 0.004 + s2 * Hs + 0.03 * release, tip.z + amp2 * 0.7 * Math.cos(ph2 * 0.83)).sub(_t);
          if (_s.lengthSq() < 1e-10) _s.set(0, 1, 0);
          const side = _s.cross(viewDir).normalize().multiplyScalar((0.0025 + 0.022 * s) * 0.5);
          const alpha = 0.42 * smooth(invLerp(0, 0.06, s)) * smooth(invLerp(1, 0.55, s)) * smooth(invLerp(release * 1.15 - 0.15, release * 1.15 + 0.1, s)) * smooth(invLerp(7, 3.5, age)) * smooth(invLerp(0.12, 0.4, age));
          const o = i * 6;
          sp[o] = _t.x + side.x; sp[o + 1] = _t.y + side.y; sp[o + 2] = _t.z + side.z;
          sp[o + 3] = _t.x - side.x; sp[o + 4] = _t.y - side.y; sp[o + 5] = _t.z - side.z;
          sa[i * 2] = sa[i * 2 + 1] = alpha;
        }
        sgeo.attributes.position.needsUpdate = true; sgeo.attributes.aA.needsUpdate = true;
      }
      return F;
    },
    // the mood's point light: { pos (parent space), color, intensity, distance, decay, charColor, charK, charRange }
    light(t, level, { outT = null, intensity = 5.0, distance = 4.5, charK = 1.05, charRange = 2.4, color = '#ff9a48', charColor = '#ffae62' } = {}) {
      const F = flameState(t, level, { outT, seed });
      const k = F.k * F.fl;
      const p = api.flamePos(_w); const s = g.scale.x;
      return { pos: [p.x, p.y + 0.05 * s, p.z], color, intensity: intensity * k, distance, decay: 1.7, charColor, charK: charK * k, charRange };
    },
  };
  return api;
}

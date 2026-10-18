// Atmosphere: drifting dust motes + pink/yellow pixel petals & pollen (one Points draw, motion computed in
// the vertex shader from t), a few butterflies, and warm additive light shafts that fade in with `mood`.
import * as THREE from 'three';
import { rng, clamp, lerp, smoothstep } from '../core/util.js';
import { butterflyTexture } from './textures.js';

// ---------------------------------------------------------------------------------------------
// Motes & petals
// ---------------------------------------------------------------------------------------------
const PT_VS = /* glsl */`
attribute vec4 aSeed;   // xyz: position in box [0,1], w: random
attribute vec3 aColor;
attribute float aKind;  // 0 dust mote, 1 petal / pollen
uniform float uTime, uWind, uScale, uMood;
uniform vec3 uBoxMin, uBoxSize;
varying vec3 vCol;
varying float vAlpha;
varying float vKind;
void main() {
  float r = aSeed.w;
  float t = uTime;
  vec3 p = aSeed.xyz * uBoxSize;
  if (aKind < 0.5) {
    p.x += t * (0.04 + 0.08 * r) * (0.4 + uWind);
    p.y += t * (0.012 + 0.02 * fract(r * 13.7)) + 0.12 * sin(t * (0.35 + 0.3 * r) + r * 40.0);
    p.z += 0.18 * sin(t * (0.27 + 0.2 * r) + r * 23.0);
  } else {
    p.x += t * (0.12 + 0.12 * r) * (0.4 + uWind) + 0.15 * sin(t * (1.1 + r) + r * 9.0);
    p.y -= t * (0.06 + 0.07 * fract(r * 7.3));
    p.z += 0.25 * sin(t * (0.6 + 0.5 * r) + r * 17.0);
  }
  vec3 q = mod(p, uBoxSize);
  vec3 qn = q / uBoxSize;
  vec3 world = uBoxMin + q;
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aKind < 0.5 ? mix(0.008, 0.016, fract(r * 7.13)) : mix(0.014, 0.024, fract(r * 3.71));
  float px = size * uScale / max(0.05, -mv.z);
  gl_PointSize = clamp(px, 1.0, 14.0);
  float edge = min(min(min(qn.x, 1.0 - qn.x), min(qn.y, 1.0 - qn.y)), min(qn.z, 1.0 - qn.z));
  vAlpha = smoothstep(0.0, 0.08, edge) * smoothstep(0.8, 1.7, -mv.z) * clamp(px / 1.5, 0.25, 1.0);
  if (aKind < 0.5) vAlpha *= 0.55 + 0.45 * sin(t * (0.8 + 1.7 * r) + r * 50.0);
  vCol = aColor;
  vKind = aKind;
}`;
const PT_FS = /* glsl */`
uniform vec3 uWarm;
uniform float uMood, uBright;
varying vec3 vCol;
varying float vAlpha;
varying float vKind;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // square pixel with a soft 1-texel rim for motes
  float a = vAlpha;
  if (vKind < 0.5) a *= 1.0 - smoothstep(0.3, 0.5, max(abs(c.x), abs(c.y)));
  if (a < 0.01) discard;
  vec3 col = vCol;
  if (vKind < 0.5) col = mix(col, uWarm, uMood) * uBright;
  else col = mix(col, col * uWarm * 1.2, uMood * 0.5);
  gl_FragColor = vec4(col, a);
}`;

export function buildMotes() {
  const rand = rng(5150);
  const nDust = 300, nPetal = 120;
  const n = nDust + nPetal;
  const seed = new Float32Array(n * 4), color = new Float32Array(n * 3), kind = new Float32Array(n);
  const petalCols = [0xffa3c8, 0xff7fae, 0xffe36a, 0xfff2a0, 0xffffff, 0xffc4dc].map((h) => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    seed.set([rand(), rand(), rand(), rand()], i * 4);
    const isPetal = i >= nDust;
    kind[i] = isPetal ? 1 : 0;
    const c = isPetal ? petalCols[Math.floor(rand() * petalCols.length)] : new THREE.Color(1, 1, 1);
    color.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const uniforms = {
    uTime: { value: 0 }, uWind: { value: 0.5 }, uScale: { value: 800 }, uMood: { value: 0 },
    uBoxMin: { value: new THREE.Vector3(-5.5, 0.05, -3.5) }, uBoxSize: { value: new THREE.Vector3(11, 3.4, 8.5) },
    uWarm: { value: new THREE.Color(1.0, 0.78, 0.42) }, uBright: { value: 1.4 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'motes';
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.domElement.height;
    uniforms.uScale.value = h / (2 * Math.tan((camera.fov || 35) * Math.PI / 360));
  };
  return { points: pts, uniforms };
}

// ---------------------------------------------------------------------------------------------
// Butterflies: body + two hinged wings, deterministic Lissajous flight
// ---------------------------------------------------------------------------------------------
const FLIGHTS = [
  { c: [2.7, 1.05, -0.4], a: [0.9, 0.35, 0.8], f: [0.31, 0.53, 0.23], ph: 0.0, kind: 0 },   // right of Jesus
  { c: [0.2, 0.55, 2.7], a: [2.2, 0.2, 0.55], f: [0.19, 0.61, 0.37], ph: 2.1, kind: 1 },   // over the river
  { c: [-2.4, 1.35, -1.2], a: [0.75, 0.4, 0.9], f: [0.27, 0.47, 0.33], ph: 4.2, kind: 2 },  // left, near bushes
];
export function buildButterflies() {
  const group = new THREE.Group();
  group.name = 'butterflies';
  const items = FLIGHTS.map((F) => {
    const tex = butterflyTexture(F.kind);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    const wingGeo = new THREE.PlaneGeometry(0.05, 0.05);
    wingGeo.rotateX(Math.PI / 2);
    wingGeo.translate(0.025, 0, 0);
    const wingGeoL = wingGeo.clone();
    wingGeoL.scale(-1, 1, 1);
    const root = new THREE.Group();
    const R = new THREE.Mesh(wingGeo, mat), L = new THREE.Mesh(wingGeoL, mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.045), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
    root.add(R, L, body);
    group.add(root);
    return { F, root, R, L };
  });
  const pos = (F, t) => new THREE.Vector3(
    F.c[0] + F.a[0] * Math.sin(t * F.f[0] + F.ph) + 0.25 * Math.sin(t * 0.9 + F.ph * 2),
    F.c[1] + F.a[1] * Math.sin(t * F.f[1] + F.ph * 1.3) + 0.05 * Math.sin(t * 7 + F.ph),
    F.c[2] + F.a[2] * Math.sin(t * F.f[2] + F.ph * 0.7));
  const update = (t) => {
    for (const it of items) {
      const p = pos(it.F, t), p2 = pos(it.F, t + 0.05);
      it.root.position.copy(p);
      const dir = p2.sub(p);
      const yaw = Math.atan2(dir.x, dir.z);
      it.root.rotation.set(clamp(-dir.y * 8, -0.5, 0.5), yaw, 0, 'YXZ');
      const flap = 0.15 + 1.05 * (0.5 + 0.5 * Math.sin(t * 19 + it.F.ph * 5));
      it.R.rotation.z = flap; it.L.rotation.z = -flap;
    }
  };
  return { group, update };
}

// ---------------------------------------------------------------------------------------------
// Light shafts: soft additive quads along the sun direction, billboarded about their own axis.
// ---------------------------------------------------------------------------------------------
const SH_VS = /* glsl */`
attribute vec3 aAnchor;
attribute vec4 aParams;  // halfLength, halfWidth, phase, strength
attribute vec2 aCorner;  // along -1..1, across -1..1
uniform vec3 uSunDir;
uniform float uTime;
varying vec2 vCorner;
varying float vStrength;
varying float vFade;
void main() {
  vec3 axis = normalize(uSunDir);
  vec3 toCam = normalize(cameraPosition - aAnchor);
  vec3 side = cross(axis, toCam);
  float sl = length(side);
  side = sl > 1e-3 ? side / sl : vec3(1.0, 0.0, 0.0);
  vec3 p = aAnchor + axis * aCorner.x * aParams.x + side * aCorner.y * aParams.y * (1.0 + 0.6 * max(aCorner.x, 0.0));
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vCorner = aCorner;
  vStrength = aParams.w * (0.75 + 0.25 * sin(uTime * 0.4 + aParams.z));
  // fade when the camera is near/inside the shaft or looking straight down it
  float camDist = length(cameraPosition - aAnchor);
  vFade = smoothstep(1.2, 3.0, camDist) * (1.0 - smoothstep(0.85, 0.98, abs(dot(toCam, axis))));
}`;
const SH_FS = /* glsl */`
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vCorner;
varying float vStrength;
varying float vFade;
void main() {
  float across = 1.0 - smoothstep(0.0, 1.0, abs(vCorner.y));
  float along = smoothstep(-1.0, -0.55, vCorner.x) * (1.0 - smoothstep(0.35, 1.0, vCorner.x));
  float a = across * across * along * vStrength * vFade * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export function buildShafts() {
  const rand = rng(8080);
  const anchors = [
    [-2.6, 2.4, -1.6], [-1.2, 2.9, -2.4], [0.2, 2.2, -1.2], [1.6, 3.1, -2.0], [2.8, 2.5, -1.0],
    [-3.6, 1.8, 0.2], [3.9, 2.0, 0.5], [-0.5, 3.6, -3.4], [1.0, 1.6, -0.2], [-2.0, 1.4, 1.2], [2.2, 1.7, 1.4],
  ];
  const n = anchors.length;
  const A = [], P = [], C = [], idx = [];
  anchors.forEach((a, i) => {
    const hl = 6 + rand() * 4, hw = 0.25 + rand() * 0.6, ph = rand() * 6.28, st = 0.5 + rand() * 0.5;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { A.push(...a); P.push(hl, hw, ph, st); C.push(cx, cy); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  geo.setAttribute('aAnchor', new THREE.Float32BufferAttribute(A, 3));
  geo.setAttribute('aParams', new THREE.Float32BufferAttribute(P, 4));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(C, 2));
  geo.setIndex(idx);
  const uniforms = { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.75, 0.4) }, uIntensity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SH_VS, fragmentShader: SH_FS, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lightShafts';
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return { mesh, uniforms };
}

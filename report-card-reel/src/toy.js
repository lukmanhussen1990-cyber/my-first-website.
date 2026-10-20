// Toy-character kit shared by kid.js and family.js: soft vinyl-toy materials with
// object-space detail (patterns stick to the moving characters), big glossy eyes
// with lids, mouths, capsule limbs, and small helpers for blinks and poses.
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const sph = (r, ws = 28, hs = 20, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest);
export const cap = (r, l, cs = 6, rs = 16) => new THREE.CapsuleGeometry(r, l, cs, rs);
// point on a sphere of radius R from yaw / pitch (radians), front = +z
export const onSph = (R, yaw, pitch) => V(R * Math.sin(yaw) * Math.cos(pitch), R * Math.sin(pitch), R * Math.cos(yaw) * Math.cos(pitch));
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const col = (hex) => new THREE.Color(hex);
export const std = (hex, rough = 0.55, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });

const NOISE = /* glsl */ `
float chh(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float chn(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(chh(i),chh(i+vec3(1,0,0)),u.x), mix(chh(i+vec3(0,1,0)),chh(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(chh(i+vec3(0,0,1)),chh(i+vec3(1,0,1)),u.x), mix(chh(i+vec3(0,1,1)),chh(i+vec3(1,1,1)),u.x),u.y), u.z); }
// fade object-space detail of frequency f before it aliases
float oaa(float f){ float fw = max(length(fwidth(vOPos)), 1e-6); return 1.0 - smoothstep(0.25, 0.6, fw * f); }
`;
let pid = 0;
// colour and bump functions in the mesh's own (object) space
export function objPatch(mat, { colorFn = '', bumpFn = '', bump = 1, extra = '', key = '' }) {
  const id = key || `toy${pid++}`;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOPos = position;');
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vOPos;\n${NOISE}\n${extra}`);
    if (colorFn) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= ${colorFn}(vOPos);`);
    if (bumpFn) {
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hh = ${bumpFn}(vOPos); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 g = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          vec3 nb = abs(det) * normal - g * ${bump.toFixed(3)};
          if (dot(nb, nb) > 1e-24) normal = normalize(nb); }`);
    }
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

export const skinMat = (hex, key) => objPatch(std(hex, 0.48), { colorFn: 'skinC', key, extra: 'vec3 skinC(vec3 p){ return vec3(0.96 + 0.08 * chn(p * 18.0)); }' });
// soft cotton with a fine weave; `pattern` can modify c (object space p)
export const cottonMat = (hex, key, pattern = '', rough = 0.82) => objPatch(std(hex, rough), {
  colorFn: 'cotC', bumpFn: 'cotB', bump: 1, key,
  extra: `vec3 cotC(vec3 p){
      vec3 c = vec3(0.93 + 0.1 * chn(p * 9.0));
      ${pattern}
      return c; }
    float cotB(vec3 p){ return (0.0011 * chn(p * 160.0) + 0.0005 * sin(p.y * 420.0 + chn(p * 30.0) * 3.0)) * oaa(160.0); }`,
});
// chunky knit: vertical ribs with little stitch bumps
export const knitMat = (hex, key) => objPatch(std(hex, 0.9), {
  colorFn: 'knC', bumpFn: 'knB', bump: 1, key,
  extra: `float knit(vec3 p){ float a = atan(p.x, p.z) * 9.0; float rib = abs(fract(a / 3.14159) - 0.5) * 2.0;
      float st = abs(fract(p.y * 55.0 + 0.5 * step(0.5, fract(a / 6.28318))) - 0.5) * 2.0; return rib * 0.7 + st * 0.3; }
    vec3 knC(vec3 p){ return vec3(0.82 + 0.25 * knit(p) * oaa(55.0) + 0.06 * chn(p * 20.0)); }
    float knB(vec3 p){ return 0.0035 * knit(p) * oaa(55.0); }`,
});
export const furMat = (hex, key, len = 1) => objPatch(std(hex, 0.85), {
  colorFn: 'furC', bumpFn: 'furB', bump: 1, key,
  extra: `vec3 furC(vec3 p){ return vec3(0.86 + 0.2 * chn(p * 45.0) * oaa(45.0)) * (0.94 + 0.1 * chn(p * 6.0)); }
    float furB(vec3 p){ return (${(0.004 * len).toFixed(4)} * chn(p * 70.0) + 0.002 * chn(p * 150.0)) * oaa(70.0); }`,
});
export const hairMat = (hex, key) => objPatch(std(hex, 0.55), {
  colorFn: 'hairC', bumpFn: 'hairB', bump: 1, key,
  extra: `vec3 hairC(vec3 p){ return vec3(0.84 + 0.26 * chn(vec3(p.x * 70.0, p.y * 9.0, p.z * 70.0)) * oaa(70.0)); }
    float hairB(vec3 p){ return 0.002 * chn(vec3(p.x * 90.0, p.y * 12.0, p.z * 90.0)) * oaa(90.0); }`,
});

export function faceMats() {
  return {
    blush: new THREE.MeshStandardMaterial({ color: col('#ff8e8e'), roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false }),
    eyeWhite: std('#fbfbf7', 0.16),
    pupil: std('#0b0a0a', 0.12),
    hl: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2 }),
    mouth: std('#6e2a26', 0.5),
    mouthIn: std('#3e1412', 0.6),
    tongue: std('#e0707a', 0.5),
    teeth: std('#fffdf6', 0.3),
    sweat: new THREE.MeshStandardMaterial({ color: col('#bfe6ff'), roughness: 0.05, transparent: true, opacity: 0.85 }),
  };
}

export function mesh(g, m, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  o.userData.cast = cast;
  return o;
}
// capsule between two points (in the parent's space)
export function limb(a, b, r, m, cast = true) {
  const d = b.clone().sub(a);
  const g = cap(r, Math.max(0.001, d.length()));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
  const o = mesh(g, m, cast);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  return o;
}
export const tube = (pts, r, m, seg = 32) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, false), m, false);

// a big glossy eye: white, iris, pupil, two highlights, upper + lower lids
export function makeEye(r, irisMat, lidMat, F) {
  const g = new THREE.Group();
  g.add(mesh(sph(r, 24, 18), F.eyeWhite, false));
  const look = new THREE.Group(); // gaze: iris + pupil + highlights turn together
  const iris = mesh(sph(r * 0.66, 22, 16), irisMat, false);
  iris.scale.z = 0.42;
  iris.position.z = r * 0.79;
  const pupil = mesh(sph(r * 0.42, 18, 12), F.pupil, false);
  pupil.scale.z = 0.4;
  pupil.position.z = r * 0.86;
  const h1 = mesh(sph(r * 0.17, 12, 8), F.hl, false);
  h1.position.set(-r * 0.27, r * 0.3, r * 1.0);
  const h2 = mesh(sph(r * 0.085, 10, 6), F.hl, false);
  h2.position.set(r * 0.24, -r * 0.2, r * 1.0);
  look.add(iris, pupil, h1, h2);
  g.add(look);
  const lid = mesh(sph(r * 1.07, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, false);
  const lower = mesh(sph(r * 1.06, 26, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), lidMat, false);
  g.add(lid, lower);
  return { g, look, lid, lower, r };
}
// open: 1 = open, 0 = shut; gaze in radians; wide pops the eye a little bigger
export function setEye(e, open, gazeX = 0, gazeY = 0, wide = 0) {
  const o = clamp01(open);
  e.lid.rotation.x = THREE.MathUtils.lerp(1.42, -0.42 - 0.2 * wide, o);
  e.lower.rotation.x = THREE.MathUtils.lerp(-0.25, 0.12 + 0.1 * wide, o);
  e.look.rotation.set(-gazeY, gazeX, 0);
  e.g.scale.setScalar(1 + 0.16 * wide);
}
// an arc across the face (bend > 0 smiles), optional wave
export function arcPts(R, cx, cy, w, bend, n = 9, wav = 0, tilt = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * 2 - 1;
    pts.push(onSph(R, cx + u * w, cy - bend * (1 - u * u) + wav * Math.sin(u * Math.PI * 2.5) + tilt * u));
  }
  return pts;
}
// a set of mouths on a round head of radius R (one shown at a time)
export function makeMouths(head, R, F, cy = -0.33) {
  const mouths = {
    smile: tube(arcPts(R + 0.002, 0, cy, 0.24, 0.07), R * 0.045, F.mouth),
    flat: tube(arcPts(R + 0.002, 0, cy - 0.01, 0.15, 0.0), R * 0.042, F.mouth),
    nervous: tube(arcPts(R + 0.002, 0, cy - 0.01, 0.26, 0.02, 16, 0.025), R * 0.045, F.mouth),
    frown: tube(arcPts(R + 0.002, 0, cy - 0.04, 0.18, -0.05), R * 0.045, F.mouth),
    smirk: tube(arcPts(R + 0.002, 0.06, cy, 0.17, 0.03, 9, 0, 0.05), R * 0.045, F.mouth),
  };
  // open grin: dark half-disc with teeth and tongue
  const g = new THREE.Group();
  const m = mesh(sph(R * 0.4, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), F.mouthIn, false);
  m.scale.set(1, 0.62, 0.35);
  const teeth = mesh(new THREE.BoxGeometry(R * 0.52, R * 0.095, R * 0.1), F.teeth, false);
  teeth.position.set(0, -R * 0.04, R * 0.06);
  const tongue = mesh(sph(R * 0.18, 14, 8), F.tongue, false);
  tongue.scale.set(1.2, 0.45, 0.6);
  tongue.position.set(0, -R * 0.18, 0.0);
  g.add(m, teeth, tongue);
  g.position.copy(onSph(R - 0.006, 0, cy + 0.03));
  g.lookAt(g.position.clone().multiplyScalar(2));
  mouths.grin = g;
  // round open mouth (o), also the talking mouth (scaled)
  const o = mesh(sph(R * 0.17, 18, 12), F.mouthIn, false);
  o.position.copy(onSph(R - 0.004, 0, cy - 0.01));
  o.lookAt(o.position.clone().multiplyScalar(2));
  mouths.o = o;
  for (const k in mouths) head.add(mouths[k]);
  return mouths;
}
export function showMouth(mouths, name) {
  for (const k in mouths) mouths[k].visible = k === name;
}
// ears, cheeks, nose on a round head
export function faceBits(head, R, F, skin) {
  for (const s of [-1, 1]) {
    const ear = mesh(sph(R * 0.24, 14, 10), skin);
    ear.position.copy(onSph(R * 0.96, s * 1.5, 0.0));
    ear.scale.set(0.6, 1, 0.9);
    head.add(ear);
    const bl = mesh(sph(R * 0.22, 16, 10), F.blush, false);
    bl.position.copy(onSph(R * 0.985, s * 0.62, -0.22));
    bl.scale.set(1, 0.62, 0.3);
    bl.lookAt(bl.position.clone().multiplyScalar(2));
    head.add(bl);
  }
  const nose = mesh(sph(R * 0.125, 14, 10), skin);
  nose.position.copy(onSph(R + 0.005, 0, -0.1));
  head.add(nose);
}
// a sweat drop (positioned by the caller)
export function sweatDrop(F, s = 1) {
  const g = new THREE.Group();
  const d = mesh(sph(0.022 * s, 14, 10), F.sweat, false);
  const tip = mesh(new THREE.ConeGeometry(0.0205 * s, 0.04 * s, 14), F.sweat, false);
  tip.position.y = 0.026 * s;
  g.add(d, tip);
  return g;
}

// natural blinks (pure function of time)
export function blinkAt(U, t, period, dur, seed = 0) {
  const x = (t + seed * 1.7) / period;
  const i = Math.floor(x);
  const off = 0.3 + 0.5 * U.hash1(i + seed * 13);
  const u = (x - i - off) * period;
  return u > 0 && u < dur ? Math.sin((u / dur) * Math.PI) : 0;
}
// a stroke round strike time s (wind up, chop, follow through) -> {lift, chop}
export function swing(U, t, list, dur = 0.6) {
  const { clamp, smooth } = U;
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const prev = i > 0 ? list[i - 1] : -1e9, next = i + 1 < list.length ? list[i + 1] : 1e9;
    const d = Math.min(dur, (s - prev) * 0.95, (next - s) * 0.95 + 0.25);
    if (t >= s - d * 0.55 && t <= s + d * 0.45) best = { s, d };
  }
  if (!best) return { lift: 0, chop: 0, on: 0 };
  const u = (t - best.s) / best.d; // -0.55 .. 0.45
  let lift = 0, chop = 0;
  if (u < -0.08) lift = smooth(clamp((u + 0.55) / 0.47));
  else if (u < 0) lift = 1 - smooth(clamp((u + 0.08) / 0.08));
  if (u >= -0.02) chop = Math.sin(clamp(u / 0.45) * Math.PI) * (u < 0.2 ? 1 : 0.6);
  return { lift, chop, on: 1 };
}
// blend pose objects: out = a + (b - a) * k for every numeric (and [a, b] pair) field
export function mixPose(a, b, k) {
  if (k <= 0) return a;
  const o = { ...a };
  for (const key in b) {
    const va = a[key], vb = b[key];
    if (typeof vb === 'number' && typeof va === 'number') o[key] = va + (vb - va) * k;
    else if (Array.isArray(vb) && Array.isArray(va)) o[key] = va.map((x, i) => x + (vb[i] - x) * k);
    else if (k >= 0.5) o[key] = vb;
  }
  return o;
}

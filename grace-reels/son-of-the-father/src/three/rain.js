// Rain kit (everything a pure function of t, seeded):
//   makeRainFx()        engine-level streaks + far sheets + ground splashes, driven by mood.rain (see moods.js BASE.rain)
//   makeRain()          GPU rain streaks (instanced, motion-stretched along the fall velocity, wind slant, world-anchored box)
//   makeRainSheets()    far translucent rain curtains that drift in gusts ("rain fell in sheets")
//   makeSplashes()      small crowns: droplets thrown up + a ground ring, recycled over the ground around a point
//   WET / wetten(mat)   wet ground: mood.wet 0..1 darkens + adds a sky/sun/lamp sheen to any Lambert/Standard material
//   makePuddles()       puddles with soft planar reflections (low-res mirror render), rain ripples, fresnel, soft edges
//   rainRamp()          intensity curve: first light rain -> sheets
//   makeGiantDrop()     the S9 slow-motion raindrop (refractive water) + splash crown, droplets, jet and wet spot
//   makeCrackedGround() dry cracked earth: bevelled curled mud plates over dark cracks (per-plate colour variation)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSprites } from './fx.js';
import { U, radialTex } from './materials.js';
import { hash01, mulberry32, clamp, smooth, invLerp, lerp, easeOut, easeIn, noise2 } from '../lib/util.js';

const GLSL_NOISE = `
float rh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh(i), rh(i + vec2(1.0, 0.0)), f.x), mix(rh(i + vec2(0.0, 1.0)), rh(i + vec2(1.0, 1.0)), f.x), f.y); }`;

// ---------------------------------------------------------------- intensity curve
// 0 before t0, a light drizzle (0.18) by t0 + fadeIn, building to `peak` by t1 (ease-in), optional fade out after t2.
export function rainRamp(t, t0, t1, { drizzle = 0.18, peak = 1, fadeIn = 0.6, t2 = null, fadeOut = 1.5 } = {}) {
  if (t < t0) return 0;
  let k = drizzle * smooth(invLerp(t0, t0 + fadeIn, t));
  if (t > t0 + fadeIn) k = lerp(drizzle, peak, easeIn(invLerp(t0 + fadeIn, t1, t)) ** 0.7);
  if (t2 != null) k *= 1 - smooth(invLerp(t2, t2 + fadeOut, t));
  return k;
}

// ---------------------------------------------------------------- streaks
const RAIN_VS = `attribute vec4 aSeed; uniform float uTime; uniform float uK; uniform float uSpeed; uniform float uLen; uniform float uWidth;
uniform vec3 uCenter; uniform vec3 uBox; uniform vec2 uWind; uniform float uPx; uniform float uFar; uniform float uGround;
uniform vec3 uPointPos; uniform float uPointRange;
varying vec2 vQ; varying float vA; varying float vPt;
void main(){
  if (aSeed.w > uK) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  float sv = fract(aSeed.x * 7.13 + aSeed.z * 3.71);
  float sp = uSpeed * (0.82 + 0.36 * sv);
  float H = uBox.y;
  float ph = fract(aSeed.y + uTime * sp / H);
  float tf = ph * H / sp;                                    // seconds since this drop left the top
  vec3 p = vec3(aSeed.x * uBox.x, uGround + H * (1.0 - ph), aSeed.z * uBox.z);
  p.xz += uWind * tf;
  vec2 lo = uCenter.xz - uBox.xz * 0.5;
  p.xz = lo + mod(p.xz - lo, uBox.xz);                       // world-anchored wrap around the centre
  vec3 vel = vec3(uWind.x, -sp, uWind.y); vec3 vd = normalize(vel);
  vec3 toCam = cameraPosition - p; float dist = length(toCam);
  vec3 side = normalize(cross(vd, toCam));
  float pxw = dist * uPx * 1.15;                             // keep >= ~1 px wide; thinner drops get fainter instead
  float w = max(uWidth, pxw);
  float len = uLen * (0.7 + 0.6 * sv) * (1.0 + dist * 0.004);
  vec3 wp = p + side * position.x * w + vd * (position.y - 1.0) * len;
  vQ = vec2(position.x * 2.0, position.y);
  vA = (uWidth / w) * smoothstep(uFar, uFar * 0.45, dist) * smoothstep(0.6, 2.2, dist) * smoothstep(uGround - 0.05, uGround + 0.15, p.y);
  vPt = pow(1.0 - smoothstep(0.0, uPointRange, distance(p, uPointPos)), 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RAIN_FS = `uniform vec3 uColor; uniform float uAlpha; uniform vec3 uPointColor; uniform vec3 uFlashCol; uniform float uFlash;
varying vec2 vQ; varying float vA; varying float vPt;
void main(){
  float a = vA * uAlpha * (1.0 - vQ.x * vQ.x) * smoothstep(0.0, 0.35, vQ.y) * (0.55 + 0.45 * vQ.y);
  if (a < 0.002) discard;
  vec3 c = uColor + uPointColor * vPt * 2.5 + uFlashCol * uFlash;
  gl_FragColor = vec4(c, clamp(a * (1.0 + vPt * 1.5 + uFlash), 0.0, 1.0));
}`;
// n streaks in a box (w, h, d metres) that follows `center` but is anchored in the world (no swimming)
export function makeRain({ n = 12000, box = [34, 18, 34], seed = 5 } = {}) {
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute('position', base.attributes.position);
  const s = new Float32Array(n * 4); const R = mulberry32(seed);
  for (let i = 0; i < n; i++) { s[i * 4] = R(); s[i * 4 + 1] = R(); s[i * 4 + 2] = R(); s[i * 4 + 3] = R(); }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s, 4)); geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uK: { value: 0 }, uSpeed: { value: 9 }, uLen: { value: 0.5 }, uWidth: { value: 0.01 }, uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...box) }, uWind: { value: new THREE.Vector2(1.2, 0.3) }, uPx: { value: 0.0003 }, uFar: { value: 60 }, uGround: { value: 0 },
      uColor: { value: new THREE.Color('#c4ccd6') }, uAlpha: { value: 0.32 }, uPointPos: U.uPointPos, uPointColor: U.uPointColor, uPointRange: U.uPointRange,
      uFlashCol: { value: new THREE.Color(1, 0.97, 0.9) }, uFlash: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 12;
  return {
    group: mesh, mat,
    // R: { k, speed, len, width, wind:[x,z], color, alpha, far, box:[w,h,d], groundY }, center: world Vector3/array
    set(t, camera, R, center, flash = 0) {
      const k = R.k ?? 0; mesh.visible = k > 0.001; if (!mesh.visible) return;
      const u = mat.uniforms;
      u.uTime.value = t; u.uK.value = clamp(k); u.uSpeed.value = R.speed ?? 9; u.uLen.value = R.len ?? 0.5; u.uWidth.value = R.width ?? 0.009;
      u.uCenter.value.set(center[0] ?? center.x, 0, center[2] ?? center.z); u.uGround.value = R.groundY ?? 0;
      if (R.box) u.uBox.value.set(...R.box);
      const w = R.wind ?? [1.2, 0.3]; u.uWind.value.set(w[0], w[1]);
      u.uPx.value = 2 * Math.tan((camera.fov * Math.PI) / 360) / 1920; u.uFar.value = R.far ?? 70;
      u.uColor.value.set(R.color ?? '#c4ccd6'); u.uAlpha.value = (R.alpha ?? 0.3) * (0.75 + 0.25 * k); u.uFlash.value = flash;
    },
  };
}

// ---------------------------------------------------------------- far rain sheets (curtains)
const SHEET_FS = `uniform float uTime; uniform float uK; uniform vec3 uColor; uniform float uSeed; uniform float uSpeed; uniform float uSlant; uniform vec3 uFlashCol; uniform float uFlash;
varying vec2 vUv;
${GLSL_NOISE}
void main(){
  vec2 p = vUv * vec2(1.0, 1.0);
  float x = p.x + p.y * uSlant;
  float streak = rvn(vec2(x * 260.0 + uSeed, p.y * 2.2 + uTime * uSpeed)) * rvn(vec2(x * 90.0 - uSeed, p.y * 1.3 + uTime * uSpeed * 0.8));
  streak = smoothstep(0.25, 0.85, streak);
  float gust = rvn(vec2(x * 3.0 - uTime * 0.22 + uSeed, 0.5)) * 0.65 + rvn(vec2(x * 7.0 - uTime * 0.4, 3.1 + uSeed)) * 0.35;
  gust = smoothstep(0.32, 0.8, gust);
  float edge = smoothstep(0.0, 0.18, p.x) * smoothstep(1.0, 0.82, p.x) * smoothstep(0.0, 0.25, p.y) * smoothstep(1.0, 0.7, p.y);
  float a = uK * edge * (0.2 + 0.8 * gust) * (0.35 + 0.65 * streak) * 0.42;
  gl_FragColor = vec4(uColor + uFlashCol * uFlash, clamp(a * (1.0 + uFlash), 0.0, 1.0));
}`;
export function makeRainSheets({ n = 5, seed = 9 } = {}) {
  const g = new THREE.Group(); const list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SHEET_FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uColor: { value: new THREE.Color('#9aa4b0') }, uSeed: { value: seed + i * 13.7 }, uSpeed: { value: 2.4 }, uSlant: { value: 0.08 },
        uFlashCol: { value: new THREE.Color(1, 0.97, 0.9) }, uFlash: { value: 0 } },
    }));
    m.frustumCulled = false; m.renderOrder = 2; g.add(m); list.push(m);
  }
  const _f = new THREE.Vector3();
  return {
    group: g,
    // R.sheets 0..1, R.sheetDist [near, far], R.sheetColor; center: world point the camera looks at
    set(t, camera, R, center, flash = 0) {
      const k = (R.sheets ?? 0) * Math.min(1, (R.k ?? 0) * 1.6); g.visible = k > 0.001; if (!g.visible) return;
      const [d0, d1] = R.sheetDist ?? [30, 140];
      camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
      const yaw = Math.atan2(_f.x, _f.z);
      list.forEach((m, i) => {
        const u = i / Math.max(1, list.length - 1), d = lerp(d0, d1, u);
        const side = (hash01(i, seed) - 0.5) * d * 0.9;
        const cx = (center[0] ?? center.x) + _f.x * d * 0.6 + _f.z * side, cz = (center[2] ?? center.z) + _f.z * d * 0.6 - _f.x * side;
        m.position.set(cx, R.groundY ?? 0, cz); m.rotation.set(0, yaw, 0);
        m.scale.set(d * 1.3, d * 0.75, 1);
        const mu = m.material.uniforms; mu.uTime.value = t; mu.uK.value = k * (0.6 + 0.4 * u); mu.uColor.value.set(R.sheetColor ?? R.color ?? '#9aa4b0');
        mu.uSlant.value = (R.wind ? R.wind[0] : 1.2) * 0.04; mu.uSpeed.value = 2.0 + 0.6 * hash01(i, seed + 1); mu.uFlash.value = flash * 0.6;
      });
    },
  };
}

// ---------------------------------------------------------------- splashes (crowns + rings)
const RING_VS = `attribute vec4 iP; attribute vec2 iA; varying vec2 vUv; varying float vU; varying float vK;
void main(){ vUv = position.xz; vU = iA.x; vK = iA.y;
  vec3 p = iP.xyz + vec3(position.x, 0.0, position.z) * iP.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const RING_FS = `uniform vec3 uColor; varying vec2 vUv; varying float vU; varying float vK;
void main(){ float r = length(vUv) * 2.0; float rr = mix(0.15, 0.95, sqrt(vU));
  float ring = exp(-pow((r - rr) / (0.07 + 0.08 * vU), 2.0)) * (1.0 - vU);
  float a = ring * vK; if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`;
export function makeSplashes({ n = 700, seed = 17 } = {}) {
  const drops = makeSprites(n * 5, { order: 13 });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = flat.index; geo.setAttribute('position', flat.attributes.position);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), iA = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  geo.setAttribute('iP', iP); geo.setAttribute('iA', iA); geo.instanceCount = 0;
  const ringMat = new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uColor: { value: new THREE.Color('#d8dee6') } } });
  const rings = new THREE.Mesh(geo, ringMat); rings.frustumCulled = false; rings.renderOrder = 11;
  const g = new THREE.Group(); g.add(rings, drops.group);
  return {
    group: g,
    // R: { k, splash (0..1 density), splashR (radius m), splashSize, color }, center world [x,y,z], height(x,z) -> world y
    set(t, R, center, height = null, camDist = 10) {
      const k = (R.k ?? 0) * (R.splash ?? 1);
      drops.begin(); let m = 0;
      if (k > 0.01 && camDist < (R.splashMaxDist ?? 48)) {
        const rad = R.splashR ?? Math.min(16, 4 + camDist * 0.45), sz = (R.splashSize ?? 1) * (0.7 + camDist * 0.012);
        const col = new THREE.Color(R.splashColor ?? '#dfe5ec');
        const N = Math.floor(n * clamp(k));
        for (let i = 0; i < N; i++) {
          const P = 0.32 + 0.3 * hash01(i, seed), off = hash01(i, seed + 1) * 10;
          const cyc = Math.floor((t + off) / P), lt = (t + off) - cyc * P, dur = 0.24;
          if (lt > dur) continue;
          const u = lt / dur;
          const a = hash01(cyc * 7919 + i, seed + 2) * Math.PI * 2, r = rad * Math.sqrt(hash01(cyc * 7919 + i, seed + 3));
          const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r;
          const y = height ? height(x, z) : (center[1] ?? 0);
          const s = sz * (0.6 + 0.8 * hash01(i, seed + 4));
          if (m < n) { iP.setXYZW(m, x, y + 0.004, z, 0.16 * s); iA.setXY(m, u, 0.55 * (0.5 + 0.5 * k)); m++; }
          // crown: 4-5 droplets thrown up and out on short parabolas
          const nd = 4 + (i % 2);
          for (let j = 0; j < nd; j++) {
            const ang = a * 3 + j * (Math.PI * 2 / nd), v = (0.5 + 0.5 * hash01(i * 5 + j, seed + 5)) * s;
            const tt = lt * 1.0, hx = Math.cos(ang) * v * 0.35 * tt * 3.2, hz = Math.sin(ang) * v * 0.35 * tt * 3.2;
            const hy = v * 1.6 * tt - 9.8 * tt * tt * 0.5;
            if (hy < -0.002) continue;
            const b = (1 - u) * 0.9;
            drops.add(x + hx, y + 0.01 + hy, z + hz, 0.012 * s * (1.2 - 0.5 * u), col.r * b + 0.1, col.g * b + 0.1, col.b * b + 0.1, 0.85 * (1 - u * u));
          }
        }
      }
      geo.instanceCount = m; iP.needsUpdate = iA.needsUpdate = true; rings.visible = m > 0;
      drops.end();
    },
  };
}

// ---------------------------------------------------------------- wet ground
// Shared wetness uniforms: the engine writes mood.wet / mood.wetSheen here every frame.
export const WET = { uWet: { value: 0 }, uWetSheen: { value: new THREE.Color('#a9b6c6') }, uWetDark: { value: 0.45 } };
const WET_NOISE = GLSL_NOISE.replace(/rh\(/g, 'wh(').replace(/rvn\(/g, 'wvn(');
// Patch a Lambert/Phong/Standard material in place so mood.wet darkens it (patchy at low wetness, uniform at 1)
// and adds a wet sheen (sky tint at grazing angles + sun and lamp glints). Clone first if the material is shared.
// opts: { patch: patchiness 0..1, scale: patch size (1/m), k: per-material strength, sheen: sheen strength }
export function wetten(material, { patch = 0.45, scale = 0.35, k = 1, sheen = 1 } = {}) {
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey?.bind(material);
  const local = { uWetK: { value: k }, uWetPatch: { value: patch }, uWetScale: { value: scale }, uWetSheenK: { value: sheen } };
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, WET, local, { uSunDir: U.uSunDir, uSunColor: U.uSunColor, uPointPos: U.uPointPos, uPointColor: U.uPointColor, uPointRange: U.uPointRange });
    sh.vertexShader = 'varying vec3 vWetW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 wetP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      wetP = instanceMatrix * wetP;
      #endif
      vWetW = (modelMatrix * wetP).xyz;`);
    sh.fragmentShader = `varying vec3 vWetW; uniform float uWet; uniform vec3 uWetSheen; uniform float uWetDark; uniform float uWetK; uniform float uWetPatch; uniform float uWetScale; uniform float uWetSheenK;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uPointPos; uniform vec3 uPointColor; uniform float uPointRange;
${WET_NOISE}
float wetMask(){ float w = uWet * uWetK; if (w <= 0.0) return 0.0;
  float n = wvn(vWetW.xz * uWetScale) * 0.65 + wvn(vWetW.xz * uWetScale * 3.1 + 7.0) * 0.35;
  float th = mix(1.0, n, uWetPatch);
  return smoothstep(1.05 - w * 1.25, 1.2 - w * 1.25, th + 0.25) * w; }
` + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float wetM = wetMask();\n  diffuseColor.rgb *= 1.0 - uWetDark * wetM;')
      .replace('#include <opaque_fragment>', `
  if (wetM > 0.001) {
    vec3 Nw = normalize(normal); vec3 Vw = normalize(vViewPosition);
    float ndv = clamp(dot(Nw, Vw), 0.0, 1.0);
    float fr = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    vec3 Rv = reflect(-Vw, Nw);
    vec3 Ls = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
    float spec = pow(max(dot(Rv, Ls), 0.0), 60.0);
    vec3 Lp = (viewMatrix * vec4(uPointPos, 1.0)).xyz + vViewPosition;
    float pd = length(uPointPos - vWetW);
    float specP = pow(max(dot(Rv, normalize(Lp)), 0.0), 30.0) * pow(1.0 - smoothstep(0.0, uPointRange * 1.6, pd), 1.5);
    outgoingLight += wetM * uWetSheenK * (uWetSheen * (0.05 + 0.6 * fr) + uSunColor * spec * 1.2 + uPointColor * specP * 3.0);
  }
  #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|wet';
  material.userData.wet = local;
  material.needsUpdate = true;
  return material;
}

// ---------------------------------------------------------------- puddles with soft reflections
const PUDDLE_VS = `uniform mat4 uTexM; attribute float aEdge; varying vec4 vRefl; varying vec3 vW; varying float vEdge;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vEdge = aEdge; vRefl = uTexM * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const PUDDLE_FS = `uniform sampler2D uMirror; uniform vec3 uWater; uniform vec3 uSky; uniform float uTime; uniform float uRipple; uniform float uReflK; uniform float uOpacity; uniform vec2 uTexel;
varying vec4 vRefl; varying vec3 vW; varying float vEdge;
${GLSL_NOISE}
// rain ripples: one expanding ring per cell per cycle -> height derivative (for the normal)
vec2 ripples(vec2 p, float t){
  vec2 g = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 q = p * (k == 0 ? 3.2 : 5.3) + float(k) * 17.0;
    vec2 c = floor(q);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 cc = c + vec2(float(i), float(j));
      float h = rh(cc + float(k) * 3.1);
      float per = 0.7 + 0.6 * h; float tt = t + h * 10.0; float cyc = floor(tt / per); float u = (tt - cyc * per) / per;
      vec2 ctr = cc + vec2(rh(cc + cyc * 1.37), rh(cc + cyc * 2.11 + 5.0));
      vec2 d = q - ctr; float r = length(d);
      float rr = u * 0.9; float w = 0.08 + 0.05 * u;
      float wave = sin((r - rr) * 42.0) * exp(-pow((r - rr) / w, 2.0)) * (1.0 - u) * (1.0 - u);
      g += normalize(d + 1e-5) * wave;
    }
  }
  return g;
}
void main(){
  vec3 V = normalize(cameraPosition - vW);
  vec2 rg = uRipple > 0.001 ? ripples(vW.xz, uTime) * uRipple : vec2(0.0);
  vec3 N = normalize(vec3(-rg.x * 0.35, 1.0, -rg.y * 0.35));
  float fr = 0.12 + 0.88 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  vec2 uv = vRefl.xy / vRefl.w + rg * 0.02;
  vec3 refl = texture2D(uMirror, uv).rgb * 0.4;
  refl += texture2D(uMirror, uv + vec2(uTexel.x, 0.0) * 1.5).rgb * 0.15 + texture2D(uMirror, uv - vec2(uTexel.x, 0.0) * 1.5).rgb * 0.15;
  refl += texture2D(uMirror, uv + vec2(0.0, uTexel.y) * 1.5).rgb * 0.15 + texture2D(uMirror, uv - vec2(0.0, uTexel.y) * 1.5).rgb * 0.15;
  vec3 c = mix(uWater, refl * uReflK, clamp(fr * 1.15, 0.0, 1.0));
  c += uSky * 0.04 * length(rg);
  float a = uOpacity * smoothstep(0.0, 0.35, vEdge);
  gl_FragColor = vec4(c, a);
}`;
// Irregular blob puddle geometry: list of { x, z, r, seed, stretch, rot } (parent space), merged into one mesh.
function puddleGeometry(list, y) {
  const parts = [];
  for (const P of list) {
    const seg = 28, R = mulberry32(P.seed ?? 1), pos = [0, y, 0], edge = [1], idx = [];
    const ph = R() * 10, ph2 = R() * 10, st = P.stretch ?? 1.3, rot = P.rot ?? R() * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const rr = P.r * (1 + 0.22 * Math.sin(a * 2 + ph) + 0.12 * Math.sin(a * 3 + ph2) + 0.06 * Math.sin(a * 5 + ph));
      let x = Math.cos(a) * rr * st, z = Math.sin(a) * rr;
      const cx = x * Math.cos(rot) - z * Math.sin(rot), cz = x * Math.sin(rot) + z * Math.cos(rot);
      pos.push(cx * 0.6, y, cz * 0.6); edge.push(1);              // inner ring (fully wet)
      pos.push(cx, y, cz); edge.push(0);                         // rim (fades out)
    }
    for (let i = 0; i < seg; i++) {
      const a = 1 + i * 2, b = a + 2;
      idx.push(0, b, a, a, b, a + 1, b, b + 1, a + 1);
    }
    for (let i = 0; i < pos.length; i += 3) { pos[i] += P.x; pos[i + 2] += P.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1)); g.setIndex(idx);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
// makePuddles({ list, y, res, water, reflect }) -> { group (a Mesh; add it to your set), set(t, { k, ripple, sky, opacity, reflK }) }
//   list: [{ x, z, r, seed?, stretch?, rot? }] in the mesh's parent space; y: water height (put it ~1 cm above the ground)
//   res: mirror resolution (fraction of 1080x1920, 0.3 is plenty: the reflection is softened anyway)
//   reflect: true renders a planar mirror of the scene (lamps, people, sky) once per frame; false = sky colour only
export function makePuddles({ list = [], y = 0.012, res = 0.3, water = '#20262c', reflect = true, W = 1080, H = 1920 } = {}) {
  const geo = puddleGeometry(list, y);
  const rt = reflect ? new THREE.WebGLRenderTarget(Math.round(W * res), Math.round(H * res), { type: THREE.HalfFloatType }) : null;
  const texM = new THREE.Matrix4();
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUDDLE_VS, fragmentShader: PUDDLE_FS, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    uniforms: { uMirror: { value: rt ? rt.texture : null }, uTexM: { value: texM }, uWater: { value: new THREE.Color(water) }, uSky: { value: new THREE.Color('#8a96a6') },
      uTime: { value: 0 }, uRipple: { value: 0 }, uReflK: { value: 1 }, uOpacity: { value: 0.92 }, uTexel: { value: new THREE.Vector2(1 / ((W * res) | 0), 1 / ((H * res) | 0)) } },
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 1; mesh.receiveShadow = false;
  if (!reflect) {   // a 1x1 sky-coloured "mirror"
    const d = new THREE.DataTexture(new Uint8Array([140, 150, 166, 255]), 1, 1); d.needsUpdate = true; mat.uniforms.uMirror.value = d;
  }
  const plane = new THREE.Plane(), normal = new THREE.Vector3(), wp = new THREE.Vector3(), cp = new THREE.Vector3(), rot = new THREE.Matrix4();
  const look = new THREE.Vector3(), target = new THREE.Vector3(), view = new THREE.Vector3(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const rcam = new THREE.PerspectiveCamera();
  if (rt) mesh.onBeforeRender = (renderer, scene, camera) => {
    // planar mirror (as three's Reflector, oblique near plane), rendered at low resolution
    mesh.updateMatrixWorld();
    wp.set(0, y, 0).applyMatrix4(mesh.matrixWorld); cp.setFromMatrixPosition(camera.matrixWorld);
    normal.set(0, 1, 0);
    view.subVectors(wp, cp); if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(wp);
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
    target.subVectors(wp, look).reflect(normal).negate().add(wp);
    rcam.position.copy(view); rcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal); rcam.lookAt(target);
    rcam.far = camera.far; rcam.near = camera.near; rcam.updateMatrixWorld(); rcam.projectionMatrix.copy(camera.projectionMatrix);
    texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(rcam.projectionMatrix).multiply(rcam.matrixWorldInverse).multiply(mesh.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, wp).applyMatrix4(rcam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = rcam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + pm[8]) / pm[0], (Math.sign(clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
    mesh.visible = false;
    const cur = renderer.getRenderTarget(), sa = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true); renderer.clear();
    renderer.render(scene, rcam);
    renderer.shadowMap.autoUpdate = sa; renderer.setRenderTarget(cur);
    mesh.visible = true;
  };
  return {
    group: mesh, mat, rt,
    // k: rain intensity (ripples), sky: tint for ripple glints, reflK: reflection strength, opacity
    set(t, { k = 0, ripple = null, sky = null, reflK = 1, opacity = 0.92, water: wc = null } = {}) {
      const u = mat.uniforms; u.uTime.value = t; u.uRipple.value = ripple ?? clamp(k * 1.4); u.uReflK.value = reflK; u.uOpacity.value = opacity;
      if (sky) u.uSky.value.set(sky); if (wc) u.uWater.value.set(wc);
    },
  };
}

// ---------------------------------------------------------------- engine-level rain (mood.rain)
export function makeRainFx() {
  const streaks = makeRain(), sheets = makeRainSheets(), splashes = makeSplashes();
  const g = new THREE.Group(); g.add(streaks.group, sheets.group, splashes.group);
  return {
    group: g, streaks, sheets, splashes,
    // R = mood.rain (k 0 = off); c = camera shot {pos, look}; o = set offset; height(x,z) world ground height (optional)
    set(t, R, camera, c, o, height = null, flash = 0) {
      const k = R?.k ?? 0; g.visible = k > 0.001; if (!g.visible) return;
      const R2 = { ...R, groundY: (R.groundY ?? 0) + o[1] };
      const center = [c.look[0], R2.groundY, c.look[2]];
      const camDist = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);
      // the streak box sits between the camera and the look point so near drops exist in every shot
      const mid = [lerp(c.pos[0], c.look[0], 0.55), 0, lerp(c.pos[2], c.look[2], 0.55)];
      const box = R.box ?? [Math.min(70, 14 + camDist * 0.9), Math.min(40, 10 + camDist * 0.35), Math.min(70, 14 + camDist * 0.9)];
      streaks.set(t, camera, { ...R2, box }, mid, flash);
      sheets.set(t, camera, R2, center, flash);
      splashes.set(t, R2, center, height, camDist);
    },
  };
}

// ---------------------------------------------------------------- the giant slow-motion raindrop (S9)
// Refractive water (MeshPhysicalMaterial transmission: the lamp and the cracked ground bend through it),
// a bright fresnel rim from a cool PMREM studio env, slow wobble while falling; on impact a crown sheet with
// droplet tips, flying droplets, a Worthington jet and a dark wet spot soaking into the dry ground.
function waterEnv(renderer) {
  if (!renderer) return null;
  if (renderer.__waterEnv) return renderer.__waterEnv;
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.06, 0.05, 0.045), vec3(0.32, 0.36, 0.42), smoothstep(-0.1, 0.8, y)); gl_FragColor = vec4(c, 1.0); }' }));
  scene.add(dome);
  const panel = (w, h, rgb, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m); };
  panel(14, 8, [3.2, 3.4, 3.8], [-10, 16, 10]);        // big cool window (the sky)
  panel(3, 3, [6, 4.2, 2.2], [12, 3, 8]);              // warm glint (the dying lamp side)
  panel(20, 1.5, [1.6, 1.7, 1.9], [0, 20, -6]);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(scene, 0.02); pm.dispose();
  return (renderer.__waterEnv = rt.texture);
}
export function waterMaterial(renderer, { env = null, thickness = 0.08 } = {}) {
  if (renderer) renderer.transmissionResolutionScale = Math.min(renderer.transmissionResolutionScale ?? 1, 0.5);
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 1, thickness, ior: 1.333,
    attenuationColor: new THREE.Color('#d6e6f2'), attenuationDistance: 0.6, specularIntensity: 1, clearcoat: 0.6, clearcoatRoughness: 0.05,
    envMap: env || waterEnv(renderer), envMapIntensity: 1.4, transparent: false,
  });
}
function dropGeometry(r) {
  const g = new THREE.SphereGeometry(r, 40, 28);
  g.userData.base = g.attributes.position.array.slice();
  return g;
}
// opts: renderer (for transmission + env), r (drop radius, m), ground (world y of the ground), seed
export function makeGiantDrop({ renderer = null, r = 0.05, seed = 4 } = {}) {
  const g = new THREE.Group();
  const wm = waterMaterial(renderer, { thickness: r * 1.6 });
  const dgeo = dropGeometry(r);
  const drop = new THREE.Mesh(dgeo, wm); drop.castShadow = true; g.add(drop);
  // crown: open tube, top edge with tips (deformed per frame)
  const CS = 48, CH = 8;
  const cgeo = new THREE.CylinderGeometry(1, 1, 1, CS, CH, true).translate(0, 0.5, 0);
  cgeo.userData.base = cgeo.attributes.position.array.slice();
  const crown = new THREE.Mesh(cgeo, wm.clone()); crown.material.side = THREE.DoubleSide; crown.material.thickness = r * 0.25; g.add(crown);
  // droplets (tips that detach + spray) and the jet
  const NT = 14, ND = NT + 22;
  const dmesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), wm, ND); dmesh.frustumCulled = false; g.add(dmesh);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18, 1).translate(0, 0.5, 0), wm); g.add(jet);
  // wet spot on the ground (dark, soaks outward along an irregular edge)
  const spotMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uR: { value: 0 }, uK: { value: 0 }, uSeed: { value: seed }, uCol: { value: new THREE.Color('#1c120a') } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uR; uniform float uK; uniform float uSeed; uniform vec3 uCol; varying vec2 vP;
      ${GLSL_NOISE}
      void main(){ float a = atan(vP.y, vP.x); float r = length(vP);
        float edge = uR * (0.8 + 0.35 * rvn(vec2(a * 2.2 + uSeed, uSeed)) + 0.15 * rvn(vec2(a * 7.0, uSeed + 3.0)));
        float m = smoothstep(edge, edge * 0.82, r) * uK; if (m < 0.003) discard;
        gl_FragColor = vec4(uCol, m * 0.62); }` });
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), spotMat); spot.renderOrder = 2; g.add(spot);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const tips = Array.from({ length: NT }, (_, i) => ({ a: (i / NT) * Math.PI * 2 + (hash01(i, seed) - 0.5) * 0.25, h: 0.75 + 0.5 * hash01(i, seed + 1), v: 0.8 + 0.5 * hash01(i, seed + 2) }));
  const api = {
    group: g, drop, crown, droplets: dmesh, jet, spot, material: wm,
    // fallAge = t - ev.dropFall, fall = seconds to fall (ev.dropSplash - ev.dropFall), from/to = group-local start
    // and impact points ([x,y,z]; to.y = ground), slow = time stretch of the splash (1 = default slow-mo look)
    set(t, { fallAge, fall = 0.75, from = [0, 1.2, 0], to = [0, 0, 0], slow = 1 }) {
      const sAge = (fallAge - fall) / slow;                  // splash age (scaled)
      // --- falling drop
      drop.visible = fallAge >= 0 && sAge < 0;
      if (drop.visible) {
        const u = clamp(fallAge / fall), e = u * u * 0.35 + u * 0.65;   // slow-mo: nearly constant speed, a hint of acceleration
        drop.position.set(lerp(from[0], to[0], e), lerp(from[1], to[1] + r, e), lerp(from[2], to[2], e));
        // wobble: oblate <-> prolate oscillation + flattened bottom (aerodynamic), a slight lean
        const w = Math.sin(fallAge * 2 * Math.PI * 2.6 + seed) * 0.07 + Math.sin(fallAge * 2 * Math.PI * 4.3) * 0.025;
        const pos = dgeo.attributes.position, b = dgeo.userData.base;
        for (let i = 0; i < pos.count; i++) {
          const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2], yn = y / r;
          const flat = yn < 0 ? 1 - 0.18 * yn * yn : 1;     // bottom flattens
          const sy = (1 - w) * (yn < 0 ? 0.88 + 0.12 * (1 + yn) : 1), sxz = (1 + w * 0.5) * (yn < 0 ? flat : 1);
          pos.setXYZ(i, x * sxz, y * sy, z * sxz);
        }
        pos.needsUpdate = true; dgeo.computeVertexNormals();
        drop.rotation.z = 0.05 * Math.sin(fallAge * 3.1);
      }
      // --- splash crown
      const cr = sAge >= 0 && sAge < 1.4;
      crown.visible = cr && sAge < 0.62;
      if (cr) {
        const grow = 1 - Math.exp(-sAge / 0.07);
        const R0 = r * (0.9 + 3.6 * grow);
        const hgt = r * 2.6 * Math.sin(Math.PI * clamp(sAge / 0.6)) * (1 - 0.3 * clamp(sAge / 0.6));
        const thin = clamp(1 - sAge / 0.6);
        crown.position.set(...to);
        const pos = cgeo.attributes.position, b = cgeo.userData.base;
        for (let i = 0; i < pos.count; i++) {
          const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
          const a = Math.atan2(z, x);
          let tipK = 0; for (const T of tips) { let d = Math.abs(a - T.a); d = Math.min(d, Math.PI * 2 - d); tipK = Math.max(tipK, Math.exp(-((d / 0.11) ** 2)) * T.h); }
          const hh = hgt * (0.78 + 0.32 * tipK * y) * y;
          const flare = 1 + 0.55 * y * y * (0.6 + 0.4 * grow);       // walls lean outward at the top
          const rr = R0 * flare * (y < 0.05 ? 1 - 0.15 * (1 - y / 0.05) * 0 : 1);
          pos.setXYZ(i, x * rr, hh, z * rr);
        }
        pos.needsUpdate = true; cgeo.computeVertexNormals();
        crown.material.opacity = thin;
      }
      // droplets: crown tips detach after ~0.12 s and fly out on parabolas; extra fine spray
      let n = 0;
      if (cr) {
        const R0 = r * (0.9 + 3.6 * (1 - Math.exp(-sAge / 0.07)));
        tips.forEach((T, i) => {
          const da = sAge - 0.1 - 0.04 * hash01(i, seed + 3); if (da < -0.1) return;
          const hT = r * 2.6 * Math.sin(Math.PI * clamp((0.1 + Math.max(0, da)) / 0.6)) * T.h;
          const out = Math.max(0, da) * r * 6 * T.v, up = Math.max(0, da) * r * 9 * T.v - 9.8 * 0.05 * Math.max(0, da) ** 2 * 6;
          const x = Math.cos(T.a) * (R0 * 1.5 + out), z = Math.sin(T.a) * (R0 * 1.5 + out), y = hT + up;
          if (y < 0) return;
          const s = r * (0.16 + 0.08 * hash01(i, seed + 4)) * (da < 0 ? 0.7 + 0.3 * (da + 0.1) / 0.1 : 1);
          pv.set(to[0] + x, to[1] + y + s, to[2] + z); sv.set(s, s * (da > 0 && da < 0.1 ? 1.25 : 1), s);
          dmesh.setMatrixAt(n++, m4.compose(pv, q, sv));
        });
        for (let i = 0; i < ND - NT; i++) {
          const da = sAge - 0.02 * hash01(i, seed + 6); if (da < 0) continue;
          const a = hash01(i, seed + 7) * Math.PI * 2, v = r * (8 + 14 * hash01(i, seed + 8)), vy = r * (10 + 16 * hash01(i, seed + 9));
          const x = Math.cos(a) * (r + v * da), z = Math.sin(a) * (r + v * da), y = vy * da - 9.8 * 0.5 * da * da * 0.6;
          if (y < 0) continue;
          const s = r * (0.05 + 0.06 * hash01(i, seed + 10));
          pv.set(to[0] + x, to[1] + y, to[2] + z); sv.set(s, s, s);
          dmesh.setMatrixAt(n++, m4.compose(pv, q, sv));
        }
      }
      // Worthington jet: rises from the centre as the crown collapses, pinches off a droplet on top
      const ja = sAge - 0.42;
      jet.visible = cr && ja > 0 && ja < 0.7;
      if (jet.visible) {
        const hJ = r * 3.2 * Math.sin(Math.PI * clamp(ja / 0.7)), wJ = r * 0.32 * (1 - 0.5 * clamp(ja / 0.7));
        jet.position.set(...to); jet.scale.set(wJ, Math.max(1e-4, hJ), wJ);
        if (ja > 0.18) { const s = r * 0.3; pv.set(to[0], to[1] + hJ + s * (1 + 3 * (ja - 0.18)), to[2]); sv.set(s, s * 1.1, s); dmesh.setMatrixAt(n++, m4.compose(pv, q, sv)); }
      }
      dmesh.count = n; dmesh.instanceMatrix.needsUpdate = true; dmesh.visible = n > 0;
      // wet spot spreading into the dry ground
      spot.visible = sAge >= 0;
      if (spot.visible) {
        const R = r * (2.0 + 5.5 * (1 - Math.exp(-sAge / 0.25)));
        spot.position.set(to[0], to[1] + 0.002, to[2]); spot.scale.set(R * 2.6, 1, R * 2.6);
        spotMat.uniforms.uR.value = 0.5 / 1.3; spotMat.uniforms.uK.value = smooth(clamp(sAge / 0.12));
      }
      return { falling: drop.visible, splash: sAge, impact: sAge >= 0 && sAge < 0.05 };
    },
  };
  return api;
}

// ---------------------------------------------------------------- dry cracked earth
// Voronoi mud plates (bevelled, edges curling up, per-plate colour variation) over a dark crack base.
// opts: size (m, square), cell (plate size, m), height (plate thickness), color, crack, seed, curl (edge lift)
export function makeCrackedGround({ size = 3, cell = 0.16, height = 0.022, gap = 0.012, color = '#b48c5c', crack = '#2e1d12', seed = 7, curl = 0.35, jitter = 0.08 } = {}) {
  const n = Math.ceil(size / cell), R = mulberry32(seed);
  const pts = [];
  for (let j = -2; j < n + 2; j++) for (let i = -2; i < n + 2; i++) pts.push({ i, j, x: (i + 0.15 + 0.7 * hash01(i * 977 + j, seed)) * cell - size / 2, z: (j + 0.15 + 0.7 * hash01(i * 977 + j, seed + 1)) * cell - size / 2 });
  const at = (i, j) => pts[(j + 2) * (n + 4) + (i + 2)];
  const pos = [], col = []; const base = new THREE.Color(color), c = new THREE.Color();
  const tri = (a, b, d, cc) => { pos.push(...a, ...b, ...d); for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const P = at(i, j);
    let poly = [[P.x - cell * 2, P.z - cell * 2], [P.x + cell * 2, P.z - cell * 2], [P.x + cell * 2, P.z + cell * 2], [P.x - cell * 2, P.z + cell * 2]];
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      if (!di && !dj) continue; const Q = at(i + di, j + dj); if (!Q) continue;
      const nx = Q.x - P.x, nz = Q.z - P.z, mx = (P.x + Q.x) / 2, mz = (P.z + Q.z) / 2;
      const side = (p) => (p[0] - mx) * nx + (p[1] - mz) * nz;
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], sa = side(a), sb = side(b);
        if (sa <= 0) out.push(a);
        if ((sa <= 0) !== (sb <= 0)) { const u = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      }
      poly = out; if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
    if (Math.abs(cx) > size / 2 || Math.abs(cz) > size / 2) continue;
    // inset (the crack) — move each vertex toward the centroid by `gap`
    const g2 = gap * (0.7 + 0.6 * hash01(i * 31 + j, seed + 2));
    const ins = poly.map(([x, z]) => { const dx = cx - x, dz = cz - z, l = Math.hypot(dx, dz) || 1; const k = Math.min(g2, l * 0.45) / l; return [x + dx * k, z + dz * k]; });
    const h = height * (0.75 + 0.5 * hash01(i * 13 + j, seed + 3)), lift = curl * h * (0.5 + hash01(i * 7 + j, seed + 4));
    const tiltX = (hash01(i, j + seed) - 0.5) * jitter * h * 4, tiltZ = (hash01(j, i + seed) - 0.5) * jitter * h * 4;
    const yAt = (x, z, edge) => h + edge * lift + (x - cx) * tiltX + (z - cz) * tiltZ;
    c.copy(base).multiplyScalar(0.84 + 0.3 * hash01(i * 101 + j, seed + 5)); c.offsetHSL((hash01(i + j * 53, seed + 6) - 0.5) * 0.02, 0, 0);
    const top = new THREE.Color().copy(c), rim = new THREE.Color().copy(c).multiplyScalar(1.1), side = new THREE.Color().copy(c).multiplyScalar(0.62);
    const C3 = [cx, yAt(cx, cz, 0) - lift * 0.15, cz];
    for (let k = 0; k < ins.length; k++) {
      const a = ins[k], b = ins[(k + 1) % ins.length];
      // two rings: inner (flat) and the curled rim
      const ai = [lerp(cx, a[0], 0.62), lerp(cz, a[1], 0.62)], bi = [lerp(cx, b[0], 0.62), lerp(cz, b[1], 0.62)];
      const A = [a[0], yAt(a[0], a[1], 1), a[1]], B = [b[0], yAt(b[0], b[1], 1), b[1]];
      const Ai = [ai[0], yAt(ai[0], ai[1], 0.25), ai[1]], Bi = [bi[0], yAt(bi[0], bi[1], 0.25), bi[1]];
      tri(C3, Bi, Ai, top);
      tri(Ai, Bi, B, rim); tri(Ai, B, A, rim);
      // side wall down into the crack
      const A0 = [a[0] + (a[0] - cx) * 0.04, 0, a[1] + (a[1] - cz) * 0.04], B0 = [b[0] + (b[0] - cx) * 0.04, 0, b[1] + (b[1] - cz) * 0.04];
      tri(A, B, B0, side); tri(A, B0, A0, side);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const plates = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  plates.castShadow = true; plates.receiveShadow = true;
  const baseM = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.02, size * 1.02).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: crack }));
  baseM.position.y = -0.001; baseM.receiveShadow = true;
  const g = new THREE.Group(); g.add(baseM, plates);
  g.userData.plates = plates; g.userData.base = baseM;
  return g;
}

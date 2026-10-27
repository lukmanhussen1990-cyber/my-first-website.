// The sky and the tornado.
// - Cumulus: real volumetric clouds, raymarched once into a panorama (azimuth x
//   elevation) and cached in build/, then drifted slowly.
// - Every frame (once, at half resolution): the sky gradient, the clouds, the
//   storm's dark base spreading over the sky from the horizon, the lowered wall
//   cloud above the funnel, rain shafts, the dust when the tornado is over the
//   yard, and the clearing afterwards. The sky dome samples that picture.
// - The funnel: two rotating shells round a bending axis (a dark core and a paler
//   sheath), a debris cloud at its foot and debris specks orbiting it, at its real
//   size and distance (so the house, the trees and the fence hide its foot).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE } from './materials.js';

const DEG = Math.PI / 180;
const PANO = { az0: -16 * DEG, az1: 16 * DEG, el0: -0.5 * DEG, el1: 27 * DEG, pxPerDeg: 34 };
const CLOUD_BASE = 1250; // storm base altitude (m)

const BAKE_FS = /* glsl */ `
varying vec2 vUv;
uniform vec4 uRange; uniform vec3 uSun;
${GLSL_NOISE}
float remap(float x, float a, float b, float c, float d){ return c + (x - a) / (b - a) * (d - c); }
const float B0 = 1450.0, B1 = 3700.0;
float blob(vec2 xz, vec2 c, float r){ return 1.0 - smoothstep(0.25, 1.0, length((xz - c) / vec2(r, r * 0.8))); }
float coverage(vec2 xz){
  float n = fbm(xz * 0.00021 + vec2(3.7, 1.2));
  float c = smoothstep(0.4, 0.74, n);
  // a few big cumulus placed where the frame sees sky (right of the storm)
  float b = max(max(blob(xz, vec2(900.0, -6400.0), 1500.0), blob(xz, vec2(-250.0, -4700.0), 1100.0)),
                max(blob(xz, vec2(2400.0, -9800.0), 1900.0), blob(xz, vec2(-1800.0, -11500.0), 2100.0)));
  b = max(b, blob(xz, vec2(1500.0, -3800.0), 800.0));
  return clamp(max(c, b * (0.55 + 0.6 * n)), 0.0, 1.0);
}
float dens(vec3 p, float cov){
  float h = (p.y - B0) / (B1 - B0);
  float topH = 0.28 + 0.72 * cov;
  float grad = smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(topH * 0.5, topH, h));
  if (grad <= 0.0) return 0.0;
  float sh = fbm3(p * 0.00085 + vec3(0.0, 0.0, 5.0)) * 0.75 + fbm3(p * 0.0021 + 3.0) * 0.25;
  float d = remap(sh * grad, 1.0 - cov * 0.85, 1.0, 0.0, 1.0);
  if (d <= 0.0) return 0.0;
  float det = fbm3(p * 0.0055 + 11.0);
  d = remap(d, det * 0.28 * (1.0 - 0.5 * h), 1.0, 0.0, 1.0);
  return clamp(d, 0.0, 1.0);
}
void main(){
  float az = mix(uRange.x, uRange.y, vUv.x), el = mix(uRange.z, uRange.w, vUv.y);
  vec3 d = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
  if (d.y < 0.002) { gl_FragColor = vec4(0.0); return; }
  float t0 = B0 / d.y, t1 = min(B1 / d.y, t0 + 26000.0);
  const int N = 56;
  float dt = (t1 - t0) / float(N);
  float Tr = 1.0; vec3 L = vec3(0.0);
  float jit = h21(gl_FragCoord.xy * 0.731);
  float mu = dot(d, uSun);
  float phase = 0.8 + 0.6 * pow(max(mu, 0.0), 6.0);
  float tHit = 0.0;
  for (int i = 0; i < N; i++) {
    float t = t0 + (float(i) + jit) * dt;
    vec3 p = d * t;
    float cov = coverage(p.xz);
    if (cov < 0.01) continue;
    float dn = dens(p, cov);
    if (dn < 0.003) continue;
    float sig = dn * 0.0065;
    float od = 0.0;
    for (int k = 1; k <= 4; k++) {
      float s0 = float(k * k) * 55.0;
      vec3 q = p + uSun * s0;
      od += dens(q, coverage(q.xz)) * 0.0065 * float(2 * k - 1) * 55.0;
    }
    float Tl = 0.72 * exp(-od) + 0.28 * exp(-od * 0.22);
    float hh = clamp((p.y - B0) / (B1 - B0), 0.0, 1.0);
    float powder = 1.0 - exp(-dn * 6.0);
    vec3 lum = vec3(1.0, 0.95, 0.88) * 3.1 * Tl * phase * (0.55 + 0.45 * powder)
             + vec3(0.42, 0.52, 0.72) * (0.55 + 0.6 * hh) + vec3(0.18, 0.17, 0.14) * (1.0 - hh) * 0.6;
    float a = 1.0 - exp(-sig * dt);
    L += Tr * a * lum;
    if (tHit == 0.0) tHit = t;
    Tr *= 1.0 - a;
    if (Tr < 0.015) break;
  }
  // aerial perspective: far clouds fade into the pale horizon
  float A = 1.0 - Tr;
  float fog = 1.0 - exp(-max(tHit, t0) / 30000.0);
  vec3 haze = vec3(0.62, 0.74, 0.92) * 1.35;
  L = mix(L, haze * A, fog * 0.85);
  gl_FragColor = vec4(L, A);
}`;

const SKY_FS = /* glsl */ `
varying vec2 vUv;
uniform mat4 uProjInv;
uniform sampler2D tPano; uniform vec4 uPanoR;
uniform float uTime, uStorm, uClear, uEngulf, uDrift, uDark;
uniform vec3 uSun;
uniform vec4 uTornA; // azimuth, elevation of the funnel top, distance, form
uniform vec2 uTornP; // the tornado's position (x, z)
uniform vec3 uFront; // storm front edge elevation on the left / right, cleared below this
${GLSL_NOISE}
vec3 gradient(vec3 d){
  float h = max(d.y, 0.0);
  vec3 zen = vec3(0.11, 0.27, 0.78), hor = vec3(0.58, 0.72, 0.92);
  vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.6)) * 1.35;
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.92, 0.78) * (0.25 * pow(s, 5.0) + 1.2 * pow(s, 60.0));
  vec3 cw = mix(vec3(1.12, 0.8, 0.55), vec3(0.34, 0.47, 0.8), pow(smoothstep(0.0, 0.45, h), 0.7)) * 1.3;
  return mix(c, cw, uClear * 0.75);
}
void main(){
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(v.xyz / v.w);
  float az = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
  vec3 c = gradient(d);
  // the clouds, drifting
  vec2 pu = vec2((az - uDrift - uPanoR.x) / (uPanoR.y - uPanoR.x), (el - uPanoR.z) / (uPanoR.w - uPanoR.z));
  vec4 cl = texture2D(tPano, clamp(pu, vec2(0.001), vec2(0.999)));
  // clouds in the storm's shadow turn grey before the base reaches them
  float shade = 1.0 - 0.7 * uStorm;
  c = c * (1.0 - cl.a) + cl.rgb * mix(vec3(1.0), vec3(1.15, 0.9, 0.75), uClear) * shade;
  // the storm's base, below its front edge (which climbs as the storm comes)
  float fe = mix(uFront.x, uFront.y, smoothstep(-0.25, 0.25, az));
  fe += 0.03 * (fbm(vec2(az * 11.0 + uTime * 0.015, 3.0)) - 0.5) + 0.012 * (vnoise(vec2(az * 60.0, 1.0)) - 0.5);
  float deck = smoothstep(fe + 0.012, fe - 0.012, el) * smoothstep(uFront.z - 0.01, uFront.z + 0.035, el);
  if (deck > 0.0) {
    float hy = max(d.y, 0.0025);
    vec2 P = d.xz * (${CLOUD_BASE.toFixed(1)} / hy);
    float dist = length(P);
    vec2 rel = P - uTornP; float r = length(rel);
    // the base turns slowly round the tornado (the mesocyclone)
    float sw = exp(-r / 2600.0);
    float ang = atan(rel.y, rel.x) + uTime * 0.05 * sw + 1.2 * sw;
    vec2 Q = mix(P, uTornP + vec2(cos(ang), sin(ang)) * r, sw);
    float n1 = fbm(Q * 0.00055 + 2.0), n2 = fbm(Q * 0.0022 + 5.0), n3 = fbm(Q * 0.008 + 1.0);
    float tex = n1 * 0.5 + n2 * 0.33 + n3 * 0.17;
    vec3 base = mix(vec3(0.05, 0.065, 0.06), vec3(0.24, 0.285, 0.27), smoothstep(0.25, 0.8, tex));
    base *= vec3(0.86, 1.04, 0.95); // a sick green tint
    base *= mix(0.45, 1.0, smoothstep(250.0, 3200.0, r)); // darkest round the tornado
    // light leaks under its front edge
    float edge = 1.0 - smoothstep(0.0, 0.07, fe - el);
    base = mix(base, base * 1.8 + vec3(0.03, 0.035, 0.035), edge * 0.6);
    float fog = 1.0 - exp(-dist / 30000.0);
    vec3 haze = mix(vec3(0.36, 0.42, 0.44), vec3(0.16, 0.2, 0.19), smoothstep(0.3, 0.9, uStorm));
    base = mix(base, haze, fog * 0.7);
    // under the far edge of the storm the horizon stays lighter (a pale yellow-green slot)
    base = mix(base, vec3(0.5, 0.55, 0.45) * mix(1.0, 0.7, uStorm), smoothstep(0.075, 0.0, el) * 0.75);
    c = mix(c, base, deck);
    // the wall cloud: a dark lowering round the funnel's top
    vec2 wq = vec2((az - uTornA.x) / max(0.07, uTornA.y * 0.9 + 0.03), (el - uTornA.y) / max(0.03, uTornA.y * 0.35));
    float wc = smoothstep(1.2, 0.3, length(wq + vec2(0.0, -0.15)) + 0.25 * (fbm(wq * 3.0 + uTime * 0.1) - 0.5));
    c = mix(c, vec3(0.045, 0.055, 0.05) * mix(1.0, 0.7, uStorm), wc * 0.85 * deck * uTornA.w);
    // rain and hail shafts on the tornado's left, from the horizon up to the base
    float rs = smoothstep(uTornA.x - 0.06, uTornA.x - 0.18, az) * smoothstep(uTornA.x - 0.75, uTornA.x - 0.35, az);
    float streak = fbm(vec2(az * 70.0 + el * 8.0, el * 3.0 - uTime * 0.2));
    float rh = 1.0 - smoothstep(uTornA.y * 0.6, uTornA.y * 1.25 + 0.01, el);
    c = mix(c, mix(vec3(0.3, 0.35, 0.36), vec3(0.17, 0.2, 0.2), uStorm), rs * rh * deck * (0.45 + 0.35 * streak));
  }
  // in the tornado: dark flying dust everywhere, streaming past
  if (uEngulf > 0.0) {
    vec2 q = vec2(az * 5.0 - uTime * 2.2, el * 7.0 + 0.6 * sin(az * 3.0 + uTime));
    float n = fbm(q) * 0.6 + fbm(q * 3.0 + uTime * 0.6) * 0.4;
    vec3 dc = mix(vec3(0.06, 0.055, 0.045), vec3(0.24, 0.21, 0.17), n);
    c = mix(c, dc, uEngulf * (0.75 + 0.25 * n));
  }
  c *= 1.0 - uDark;
  gl_FragColor = vec4(c, 1.0);
}`;

const FUNNEL_VS = /* glsl */ `
uniform vec3 uBase; uniform float uH, uRb, uRt, uTime, uForm, uScale;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){
  float h = position.y;
  float th = uv.x * 6.2831853;
  float r = uRb * (1.0 + 0.45 * exp(-h * 16.0)) + (uRt - uRb) * pow(h, 3.0);
  r *= 1.0 + 0.05 * sin(h * 19.0 - uTime * 1.7) + 0.03 * sin(th * 3.0 + h * 11.0 - uTime * 1.1);
  float hm = 1.0 - uForm;
  r *= mix(0.4, 1.0, uForm) * smoothstep(hm - 0.02, hm + 0.1, h) * uScale;
  vec3 axis = vec3((45.0 * sin(h * 2.6 + uTime * 0.21) + 140.0 * pow(1.0 - h, 2.0)) * (0.6 + 0.4 * uForm), h * uH, 30.0 * sin(h * 3.1 + uTime * 0.17));
  vec3 p = uBase + axis + vec3(cos(th) * r, 0.0, sin(th) * r);
  vW = p;
  vN = normalize(vec3(cos(th), 0.2, sin(th)));
  vUv = vec2(uv.x, h);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FUNNEL_FS = /* glsl */ `
uniform vec3 uCam, uLight, uHaze, uDustC, uCloudC; uniform float uTime, uForm, uAlpha, uLayer, uFogD;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
${GLSL_NOISE}
void main(){
  vec3 V = normalize(uCam - vW);
  vec3 N = normalize(vN);
  float ndv = abs(dot(N, V));
  float h = vUv.y, th = vUv.x * 6.2831853;
  float sp = uLayer > 0.5 ? 0.8 : 1.5;
  float a1 = th * 2.0 - uTime * sp + h * 13.0;
  float n1 = fbm(vec2(a1 * 1.3, h * 4.5));
  float n2 = fbm(vec2(a1 * 4.2 + 7.0, h * 24.0 - uTime * 0.25));
  float dens = clamp(0.5 + 0.55 * n1 + 0.3 * (n2 - 0.5), 0.0, 1.0);
  // the core has a defined silhouette (a soft rim); the sheath is a thin veil
  float a = uLayer > 0.5 ? pow(ndv, 1.4) * dens * 0.6 : smoothstep(0.03, 0.3, ndv) * mix(0.82, 1.0, dens);
  a *= smoothstep(0.0, 0.03, h) * (1.0 - smoothstep(0.8, 1.0, h));
  float hm = 1.0 - uForm;
  a *= smoothstep(hm, hm + 0.07, h);
  vec3 c = mix(uDustC, uCloudC, smoothstep(0.0, 0.3, h));
  float lit = 0.5 + 0.5 * dot(N, uLight);
  c *= (0.45 + 0.75 * lit) * (0.62 + 0.55 * n1) * (0.85 + 0.3 * n2);
  if (uLayer > 0.5) c *= 1.35;
  float dist = length(uCam - vW);
  c = mix(c, uHaze, (1.0 - exp(-dist / uFogD)) * 0.6);
  a = clamp(a * uAlpha, 0.0, 1.0);
  gl_FragColor = vec4(c * a, a);
}`;

export function build(ctx) {
  const { scene, renderer, camera, W, H, WD, T, U, setInst, beginInst, endInst } = ctx;
  const { clamp, lerp, smooth, prog } = U;
  const SUN = ctx.SUN_DIR;

  // ---------------------------------------------------------------- panorama
  const pw = Math.round(((PANO.az1 - PANO.az0) / DEG) * PANO.pxPerDeg), ph = Math.round(((PANO.el1 - PANO.el0) / DEG) * PANO.pxPerDeg);
  const panoTex = new THREE.DataTexture(new Uint16Array(pw * ph * 4), pw, ph, THREE.RGBAFormat, THREE.HalfFloatType);
  panoTex.minFilter = THREE.LinearFilter;
  panoTex.magFilter = THREE.LinearFilter;
  panoTex.wrapS = panoTex.wrapT = THREE.ClampToEdgeWrapping;
  const ready = (async () => {
    const name = `sky_pano_v2_${pw}x${ph}.bin`;
    let ok = false;
    try {
      const r = await fetch('/build/' + name);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength === pw * ph * 8) {
          panoTex.image.data = new Uint16Array(buf);
          ok = true;
        }
      }
    } catch (e) { /* bake below */ }
    if (!ok) {
      const rt = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.FloatType, depthBuffer: false });
      const q = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { uRange: { value: new THREE.Vector4(PANO.az0, PANO.az1, PANO.el0, PANO.el1) }, uSun: { value: SUN.clone() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: BAKE_FS,
      }));
      renderer.setRenderTarget(rt);
      q.render(renderer);
      const f32 = new Float32Array(pw * ph * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, pw, ph, f32);
      renderer.setRenderTarget(null);
      const u16 = new Uint16Array(pw * ph * 4);
      for (let i = 0; i < f32.length; i++) u16[i] = THREE.DataUtils.toHalfFloat(f32[i]);
      panoTex.image.data = u16;
      try { await fetch('/save/' + name, { method: 'POST', body: u16 }); } catch (e) { /* not cached */ }
      rt.dispose();
      q.material.dispose();
    }
    panoTex.needsUpdate = true;
  })();

  // ---------------------------------------------------------------- per-frame sky
  const sw = Math.round(W / 2), sh = Math.round(H / 2);
  const skyRT = new THREE.WebGLRenderTarget(sw, sh, { type: THREE.HalfFloatType, depthBuffer: false });
  skyRT.texture.minFilter = skyRT.texture.magFilter = THREE.LinearFilter;
  const skyU = {
    uProjInv: { value: new THREE.Matrix4() }, tPano: { value: panoTex }, uPanoR: { value: new THREE.Vector4(PANO.az0, PANO.az1, PANO.el0, PANO.el1) },
    uTime: { value: 0 }, uStorm: { value: 0 }, uClear: { value: 0 }, uEngulf: { value: 0 }, uDrift: { value: 0 }, uDark: { value: 0 },
    uSun: { value: SUN.clone() }, uTornA: { value: new THREE.Vector4() }, uTornP: { value: new THREE.Vector2() }, uFront: { value: new THREE.Vector3() },
  };
  const skyQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SKY_FS,
  }));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { tSky: { value: skyRT.texture }, uRes: { value: new THREE.Vector2(W, H) } },
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tSky; uniform vec2 uRes; void main(){ gl_FragColor = vec4(texture2D(tSky, gl_FragCoord.xy / uRes).rgb, 1.0); }',
    })
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // storm front: elevation (radians) of the deck's edge on the left / right of the view
  const frontL = U.track([[0, 13.5 * DEG], [20, 17 * DEG], [40, 27 * DEG], [52, 45 * DEG], [58.5, 90 * DEG]]);
  const frontR = U.track([[0, 1.2 * DEG], [14, 3.5 * DEG], [30, 9 * DEG], [45, 20 * DEG], [55, 40 * DEG], [59.5, 90 * DEG]]);
  const clearEl = U.track([[T.clear0, -2 * DEG], [T.clear0 + 1.6, 4 * DEG], [T.clear1, 30 * DEG], [T.clear1 + 3, 90 * DEG]]);

  // ---------------------------------------------------------------- funnel
  const NS = 72, NR = 64;
  const fg = new THREE.BufferGeometry();
  {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NR; j++) {
      const h = j / NR;
      for (let i = 0; i <= NS; i++) {
        pos.push(0, h, 0);
        uv.push(i / NS, h);
      }
    }
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NS; i++) {
        const a = j * (NS + 1) + i, b = a + NS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
  }
  const shells = [];
  const mkShell = (layer, side, order) => {
    const u = {
      uBase: { value: new THREE.Vector3() }, uH: { value: 1250 }, uRb: { value: 90 }, uRt: { value: 500 }, uTime: { value: 0 }, uForm: { value: 1 }, uScale: { value: layer ? 1.32 : 1.0 },
      uCam: { value: new THREE.Vector3() }, uLight: { value: new THREE.Vector3(-0.5, 0.3, 0.8).normalize() }, uHaze: { value: new THREE.Color() },
      uDustC: { value: new THREE.Color() }, uCloudC: { value: new THREE.Color() }, uAlpha: { value: 1 }, uLayer: { value: layer }, uFogD: { value: 5000 },
    };
    const m = new THREE.Mesh(fg, new THREE.ShaderMaterial({
      uniforms: u, vertexShader: FUNNEL_VS, fragmentShader: FUNNEL_FS, side, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    m.frustumCulled = false;
    m.renderOrder = order;
    scene.add(m);
    shells.push({ m, u, layer });
  };
  mkShell(0, THREE.BackSide, 1);
  mkShell(0, THREE.FrontSide, 2);
  mkShell(1, THREE.BackSide, 3);
  mkShell(1, THREE.FrontSide, 4);

  // the debris cloud at its foot: a squat turning skirt of dust
  const skirtU = {
    uBase: { value: new THREE.Vector3() }, uR: { value: 200 }, uHt: { value: 160 }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uHaze: { value: new THREE.Color() }, uDustC: { value: new THREE.Color() }, uAlpha: { value: 1 }, uFogD: { value: 5000 },
  };
  const skirt = new THREE.Mesh(fg, new THREE.ShaderMaterial({
    uniforms: skirtU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `uniform vec3 uBase; uniform float uR, uHt, uTime; varying vec3 vW; varying vec2 vUv; varying vec3 vN;
      void main(){ float h = position.y, th = uv.x * 6.2831853;
        float r = uR * (0.55 + 0.45 * sin(h * 3.1416)) * (1.0 + 0.12 * sin(th * 4.0 + uTime * 0.9 + h * 5.0));
        vec3 p = uBase + vec3(cos(th) * r, h * uHt, sin(th) * r);
        vW = p; vN = vec3(cos(th), 0.0, sin(th)); vUv = vec2(uv.x, h);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uCam, uHaze, uDustC; uniform float uTime, uAlpha, uFogD; varying vec3 vW; varying vec2 vUv; varying vec3 vN;
      ${GLSL_NOISE}
      void main(){ float h = vUv.y, th = vUv.x * 6.2831853;
        float n = fbm(vec2(th * 3.0 - uTime * 1.1, h * 3.0)) * 0.6 + fbm(vec2(th * 9.0 - uTime * 1.6, h * 9.0)) * 0.4;
        float ndv = abs(dot(normalize(vN), normalize(uCam - vW)));
        float a = smoothstep(0.25, 0.75, n) * pow(ndv, 0.8) * smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.55, 1.0, h)) * uAlpha;
        vec3 c = uDustC * (0.7 + 0.5 * n);
        c = mix(c, uHaze, (1.0 - exp(-length(uCam - vW) / uFogD)) * 0.8);
        gl_FragColor = vec4(c * a, a); }`,
  }));
  skirt.frustumCulled = false;
  skirt.renderOrder = 5;
  scene.add(skirt);

  // debris specks orbiting the funnel
  const speckMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.045, 0.04), side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false });
  const specks = ctx.instanced(new THREE.PlaneGeometry(1, 0.6), speckMat, 420, false);
  specks.receiveShadow = false;
  const SP = Array.from({ length: 420 }, (_, i) => ({ a: U.hash1(i) * 6.283, r: 0.7 + 1.9 * U.hash1(i + 7), y: Math.pow(U.hash1(i + 13), 1.8), w: 0.7 + 0.8 * U.hash1(i + 21), s: 0.5 + U.hash1(i + 33) }));

  const HAZE = new THREE.Color(0.6, 0.68, 0.78), HAZE_S = new THREE.Color(0.22, 0.26, 0.25);
  const DUST = new THREE.Color(0.11, 0.09, 0.07), CLOUD = new THREE.Color(0.16, 0.17, 0.17), CLOUD_S = new THREE.Color(0.09, 0.1, 0.1);
  const tmpC = new THREE.Color();

  let lastT = -1;
  function setTornado(t) {
    const tw = WD.tornado(t), s = WD.storm(t);
    const camP = camera.position;
    const leave = smooth(prog(t, T.passEnd - 0.5, 3.0));
    for (const { u, layer } of shells) {
      u.uBase.value.set(tw.x, -6, tw.z);
      u.uH.value = tw.height;
      u.uRb.value = tw.base * (layer ? 1.0 : 0.85);
      u.uRt.value = tw.top;
      u.uTime.value = t;
      u.uForm.value = tw.form;
      u.uCam.value.copy(camP);
      u.uHaze.value.copy(HAZE).lerp(HAZE_S, s);
      u.uDustC.value.copy(DUST);
      u.uCloudC.value.copy(CLOUD).lerp(CLOUD_S, s);
      u.uAlpha.value = (layer ? 0.55 : 0.95) * (1 - 0.85 * leave) * (t > T.clear1 + 2 ? 0 : 1);
      u.uFogD.value = 14000;
    }
    skirtU.uBase.value.set(tw.x, -8, tw.z);
    skirtU.uR.value = tw.base * 2.3 * smooth(prog(t, T.funnel1 - 0.6, 1.5));
    skirtU.uHt.value = 170;
    skirtU.uTime.value = t;
    skirtU.uCam.value.copy(camP);
    skirtU.uHaze.value.copy(HAZE).lerp(HAZE_S, s);
    skirtU.uDustC.value.copy(DUST).multiplyScalar(1.4);
    skirtU.uAlpha.value = 0.9 * (1 - leave);
    skirtU.uFogD.value = 14000;
    // specks
    beginInst(specks);
    if (tw.form > 0.85 && leave < 1) {
      for (const p of SP) {
        const a = p.a + t * 0.45 * p.w;
        const r = tw.base * p.r * (1 + p.y * 1.5);
        const sz = (1.5 + 3.5 * p.s) * clamp(tw.d / 2500, 0.5, 1.4);
        setInst(specks, tw.x + Math.cos(a) * r, 10 + p.y * 420, tw.z + Math.sin(a) * r, sz, sz, sz, a * 2.0, a * 3.1, p.s * 6.0);
      }
    }
    endInst(specks);
    speckMat.opacity = 0.85 * (1 - leave) * smooth(prog(t, T.funnel1 - 0.4, 1.2));
  }

  return {
    ready,
    prepare(t) {
      // the sky picture for this frame
      const tw = WD.tornado(t), s = WD.storm(t);
      const camP = camera.position;
      skyU.uProjInv.value.copy(camera.projectionMatrixInverse);
      skyU.uTime.value = t;
      skyU.uStorm.value = s;
      skyU.uClear.value = WD.clearK(t);
      skyU.uEngulf.value = WD.engulf(t);
      skyU.uDrift.value = t * 0.012 * DEG;
      const top = new THREE.Vector3(tw.x, tw.height, tw.z).sub(camP);
      skyU.uTornA.value.set(Math.atan2(top.x, -top.z), Math.atan2(top.y, Math.hypot(top.x, top.z)), tw.d, tw.form);
      skyU.uTornP.value.set(tw.x, tw.z);
      const fl = frontL(t), fr = frontR(t);
      skyU.uFront.value.set(fl, fr, clearEl(t));
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(skyRT);
      skyQuad.render(renderer);
      renderer.setRenderTarget(prev);
      lastT = t;
    },
    update(t) {
      dome.position.copy(camera.position);
      setTornado(t);
    },
  };
}

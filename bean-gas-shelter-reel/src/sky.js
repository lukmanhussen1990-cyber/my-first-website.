// The sky: a calm, sunny summer day.
// - Cumulus: real volumetric clouds, raymarched once into a panorama (azimuth x
//   elevation) and cached in build/, then drifted slowly.
// - Every frame (once, at half resolution): the sky gradient and the drifting
//   clouds; the sky dome samples that picture.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE } from './materials.js';

const DEG = Math.PI / 180;
const PANO = { az0: -16 * DEG, az1: 16 * DEG, el0: -0.5 * DEG, el1: 27 * DEG, pxPerDeg: 34 };
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
uniform float uDrift;
uniform vec3 uSun;
${GLSL_NOISE}
vec3 gradient(vec3 d){
  float h = max(d.y, 0.0);
  vec3 zen = vec3(0.11, 0.27, 0.78), hor = vec3(0.58, 0.72, 0.92);
  vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.6)) * 1.35;
  float s = max(dot(d, uSun), 0.0);
  return c + vec3(1.0, 0.92, 0.78) * (0.25 * pow(s, 5.0) + 1.2 * pow(s, 60.0));
}
void main(){
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(v.xyz / v.w);
  float az = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
  vec3 c = gradient(d);
  vec2 pu = vec2((az - uDrift - uPanoR.x) / (uPanoR.y - uPanoR.x), (el - uPanoR.z) / (uPanoR.w - uPanoR.z));
  vec4 cl = texture2D(tPano, clamp(pu, vec2(0.001), vec2(0.999)));
  c = c * (1.0 - cl.a) + cl.rgb;
  gl_FragColor = vec4(c, 1.0);
}`;

export function build(ctx) {
  const { scene, renderer, camera, W, H } = ctx;
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
    uDrift: { value: 0 }, uSun: { value: SUN.clone() },
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

  return {
    ready,
    prepare(t) {
      // the sky picture for this frame
      skyU.uProjInv.value.copy(camera.projectionMatrixInverse);
      skyU.uDrift.value = t * 0.012 * DEG;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(skyRT);
      skyQuad.render(renderer);
      renderer.setRenderTarget(prev);
    },
    update() {
      dome.position.copy(camera.position);
    },
  };
}

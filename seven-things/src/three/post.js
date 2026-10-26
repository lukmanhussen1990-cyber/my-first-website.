// Post chain (deterministic): scene (MSAA, HDR, optional sub-frame accumulation for motion blur)
// -> half/eighth-res blur (depth of field + tilt-shift) + two-level bloom -> composite
// (DOF mix, bloom, ACES filmic, haze, grade, chromatic aberration, vignette, grain) -> sRGB.
// Two shots can be composited separately and joined by a transition (dissolve, dust wipe,
// light-flare wipe, push-through, whip smear).
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BLUR = `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 c = texture2D(tIn, vUv) * 0.2270270270;
  c += texture2D(tIn, vUv + dir * 1.3846153846) * 0.3162162162; c += texture2D(tIn, vUv - dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tIn, vUv + dir * 3.2307692308) * 0.0702702703; c += texture2D(tIn, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c; }`;

const BRIGHT = `uniform sampler2D tIn; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(tIn, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(threshold, threshold + 0.45, l); gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0); }`;

const COPY = 'uniform sampler2D tIn; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tIn, vUv); }';
const ADD = 'uniform sampler2D tIn; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tIn, vUv).rgb * w, 1.0); }';

const COMPOSITE = `
uniform sampler2D tScene; uniform sampler2D tBlur; uniform sampler2D tBlur2; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform sampler2D tDepth;
uniform float near; uniform float far; uniform float focus; uniform float focusRange; uniform float dof;
uniform float tiltTop; uniform float tiltBottom; uniform float tilt;
uniform float bloom; uniform vec3 hazeColor; uniform float haze;
uniform vec3 tint; uniform vec3 lift; uniform float sat; uniform float contrast; uniform float exposure;
uniform float vignette; uniform float grain; uniform float seed; uniform float flash; uniform float ca;
uniform vec3 fadeColor; uniform float fade; uniform float aces;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 acesFilmic(vec3 c){
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = IN * (c / 0.6); c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0);
}
void main(){
  vec2 dq = (vUv - 0.5) * ca * dot(vUv - 0.5, vUv - 0.5) * 4.0;
  vec3 sharp = vec3(texture2D(tScene, vUv + dq).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - dq).b);
  vec3 b1 = texture2D(tBlur, vUv).rgb; vec3 b2 = texture2D(tBlur2, vUv).rgb;
  float d = lin(texture2D(tDepth, vUv).x);
  float cocD = smoothstep(focusRange, focusRange * 3.0, abs(d - focus)) * dof;
  float cocT = (smoothstep(tiltTop, 1.0, vUv.y) + smoothstep(tiltBottom, 0.0, vUv.y)) * tilt;
  float coc = clamp(max(cocD, cocT), 0.0, 1.0);
  vec3 c = mix(sharp, b1, smoothstep(0.0, 0.5, coc));
  c = mix(c, b2, smoothstep(0.5, 1.0, coc));
  c += (texture2D(tBloom, vUv).rgb * 0.65 + texture2D(tBloom2, vUv).rgb * 0.55) * bloom;
  c *= exposure;
  vec3 k = vec3(0.62);
  vec3 roll = mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c));
  c = mix(toSRGB(roll), toSRGB(acesFilmic(c)), aces);
  c = mix(c, hazeColor, haze * smoothstep(0.45, 1.0, vUv.y));
  c = c * tint + lift;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  c += flash * vec3(1.0, 0.92, 0.78);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  c *= mix(1.0, smoothstep(0.85, 0.2, length(q) * 1.12), vignette);
  c = mix(c, fadeColor, fade);
  float n = hash(vUv * vec2(1080.0, 1920.0) + seed * 17.13) - 0.5;
  c += n * grain * (0.55 + 0.45 * (1.0 - l));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const MIX = `uniform sampler2D tA; uniform sampler2D tB; uniform float k; uniform int mode; uniform vec3 color; uniform float seed;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb, c;
  if (mode == 0) { c = mix(a, b, smoothstep(0.0, 1.0, k)); }
  else if (mode == 1) {           // dust wipe: ragged sandy edge sweeping up from the bottom-left
    float d = vUv.x * 0.45 + (1.0 - vUv.y) * 0.55;
    float n = fbm(vUv * vec2(5.0, 9.0) + seed) - 0.5;
    float e = mix(1.3, -0.3, k);
    float m = smoothstep(e - 0.025, e + 0.025, d + n * 0.24);
    c = mix(a, b, m);
    float band = exp(-pow((d + n * 0.24 - e) / 0.05, 2.0));
    float grit = step(0.55, hash(floor(vUv * vec2(360.0, 640.0)) + seed));
    c = mix(c, color, band * (0.45 + 0.4 * grit));
  }
  else if (mode == 2) {           // light-flare wipe: a warm streak sweeps across, new shot behind it
    float x = vUv.x + (vUv.y - 0.5) * 0.22;
    float e = mix(-0.25, 1.25, k);
    float m = smoothstep(e - 0.07, e + 0.07, x);
    c = mix(b, a, m);
    float streak = exp(-pow((x - e) / 0.08, 2.0));
    float glow = sin(3.14159 * clamp(k, 0.0, 1.0));
    c += color * (streak * 0.95 + glow * 0.22);
    c += color * 0.5 * streak * exp(-pow((vUv.y - 0.52) / 0.012, 2.0));
  }
  else if (mode == 3) {           // push-through: zoom into A with a radial blur, flash, B settles in
    vec2 q = vUv - 0.5; vec3 sa = vec3(0.0), sb = vec3(0.0);
    float za = 1.0 + 3.0 * k * k, zb = 1.0 + 0.45 * (1.0 - k);
    for (int i = 0; i < 8; i++) { float f = float(i) / 7.0;
      sa += texture2D(tA, 0.5 + q / (za * (1.0 + 0.14 * k * f))).rgb;
      sb += texture2D(tB, 0.5 + q / (zb * (1.0 + 0.14 * (1.0 - k) * f))).rgb; }
    c = mix(sa / 8.0, sb / 8.0, smoothstep(0.38, 0.62, k));
    c += color * pow(sin(3.14159 * k), 3.0) * 0.75;
  }
  else {                          // whip: horizontal smear across the cut
    float s = sin(3.14159 * k) * 0.08; vec3 sa = vec3(0.0), sb = vec3(0.0);
    for (int i = 0; i < 10; i++) { float f = float(i) / 9.0 - 0.5;
      sa += texture2D(tA, vUv + vec2(f * s, 0.0)).rgb; sb += texture2D(tB, vUv + vec2(f * s, 0.0)).rgb; }
    c = mix(sa, sb, smoothstep(0.4, 0.6, k)) / 10.0;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export const MODES = { dissolve: 0, dust: 1, flare: 2, push: 3, whip: 4 };

export const DEFAULT_POST = {
  focus: 20, focusRange: 6, dof: 0, tiltTop: 0.7, tiltBottom: 0.12, tilt: 0.55,
  bloom: 0.5, bloomThreshold: 0.85, hazeColor: '#d9c497', haze: 0.25,
  tint: '#ffffff', lift: '#000000', sat: 1, contrast: 1, exposure: 1, aces: 1, ca: 0.004,
  vignette: 0.5, grain: 0.03, flash: 0, fadeColor: '#000000', fade: 0,
};

const _c = new THREE.Color();
export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
    const dt = new THREE.DepthTexture(W, H); dt.format = THREE.DepthStencilFormat; dt.type = THREE.UnsignedInt248Type;
    this.rtScene.depthTexture = dt;
    this.rtAccum = new THREE.WebGLRenderTarget(W, H, hdr);
    this.h1 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr); this.h2 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr);
    this.q1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.e1 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr); this.e2 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr);
    this.bl1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr); this.bl2 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.bs1 = new THREE.WebGLRenderTarget(W / 16, H / 16, hdr); this.bs2 = new THREE.WebGLRenderTarget(W / 16, H / 16, hdr);
    this.outA = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false }); this.outB = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mCopy = mk(COPY, { tIn: { value: null } });
    this.mAdd = mk(ADD, { tIn: { value: null }, w: { value: 1 } }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });
    this.mBlur = mk(BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mBright = mk(BRIGHT, { tIn: { value: null }, threshold: { value: 0.9 } });
    const u = { tScene: { value: null }, tBlur: { value: null }, tBlur2: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, tDepth: { value: null }, near: { value: 0.5 }, far: { value: 1000 }, seed: { value: 0 } };
    for (const [k, v] of Object.entries(DEFAULT_POST)) u[k] = { value: typeof v === 'string' ? new THREE.Color(v) : v };
    this.mComp = mk(COMPOSITE, u);
    this.mMix = mk(MIX, { tA: { value: null }, tB: { value: null }, k: { value: 0 }, mode: { value: 0 }, color: { value: new THREE.Color() }, seed: { value: 0 } });
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  blur(src, a, b, w, h, iters = 1, spread = 1) {
    let s = src;
    for (let i = 0; i < iters; i++) {
      this.mBlur.uniforms.tIn.value = s; this.mBlur.uniforms.dir.value.set(spread / w, 0); this.pass(this.mBlur, b);
      this.mBlur.uniforms.tIn.value = b.texture; this.mBlur.uniforms.dir.value.set(0, spread / h); this.pass(this.mBlur, a);
      s = a.texture;
    }
    return a.texture;
  }
  // render the scene once (n = 1) or as n sub-frame samples; draw(i) poses the world for sample i
  // and returns the camera. The last sample is the centre one, so the depth buffer matches it.
  scene(scene, n, draw) {
    const r = this.r;
    if (n <= 1) { const cam = draw(0); r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, cam); this.src = this.rtScene.texture; return cam; }
    r.setRenderTarget(this.rtAccum); r.setClearColor(0x000000, 1); r.clear();
    let cam = null;
    for (let i = 0; i < n; i++) {
      cam = draw(i);
      r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, cam);
      this.mAdd.uniforms.tIn.value = this.rtScene.texture; this.mAdd.uniforms.w.value = 1 / n;
      this.pass(this.mAdd, this.rtAccum);
    }
    this.src = this.rtAccum.texture;
    return cam;
  }
  compose(P, camera, target, frame) {
    const W = this.W, H = this.H, src = this.src;
    this.mCopy.uniforms.tIn.value = src; this.pass(this.mCopy, this.h1);
    const blurHalf = this.blur(this.h1.texture, this.h1, this.h2, W / 2, H / 2, 2, 1.4);
    this.mCopy.uniforms.tIn.value = blurHalf; this.pass(this.mCopy, this.q1);
    this.mCopy.uniforms.tIn.value = this.q1.texture; this.pass(this.mCopy, this.e1);
    const blurE = this.blur(this.e1.texture, this.e1, this.e2, W / 8, H / 8, 2, 1.3);
    this.mBright.uniforms.tIn.value = src; this.mBright.uniforms.threshold.value = P.bloomThreshold ?? DEFAULT_POST.bloomThreshold;
    this.pass(this.mBright, this.bl1);
    const bloomQ = this.blur(this.bl1.texture, this.bl1, this.bl2, W / 4, H / 4, 3, 1.6);
    this.mCopy.uniforms.tIn.value = bloomQ; this.pass(this.mCopy, this.bs1);
    const bloomS = this.blur(this.bs1.texture, this.bs1, this.bs2, W / 16, H / 16, 3, 1.5);
    const u = this.mComp.uniforms;
    u.tScene.value = src; u.tBlur.value = blurHalf; u.tBlur2.value = blurE; u.tBloom.value = bloomQ; u.tBloom2.value = bloomS; u.tDepth.value = this.rtScene.depthTexture;
    u.near.value = camera.near; u.far.value = camera.far; u.seed.value = frame % 997;
    for (const k of Object.keys(DEFAULT_POST)) {
      const v = P[k] ?? DEFAULT_POST[k];
      if (u[k].value && u[k].value.isColor) u[k].value.set(v); else u[k].value = v;
    }
    this.pass(this.mComp, target);
  }
  mix(a, b, mode, k, color = '#ffffff', seed = 0) {
    const u = this.mMix.uniforms; u.tA.value = a.texture; u.tB.value = b.texture; u.k.value = k;
    u.mode.value = MODES[mode] ?? 0; u.color.value.set(color); u.seed.value = seed;
    this.pass(this.mMix, null);
  }
}

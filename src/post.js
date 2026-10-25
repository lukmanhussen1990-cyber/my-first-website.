// Post chain (all deterministic): scene (MSAA, HDR) -> half-res blur (DOF) + quarter-res bloom ->
// composite (DOF mix, bloom, top haze, grade, rain streaks, flash, vignette, grain) -> sRGB.
// Two shots can be composited separately and cross-faded.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BLUR = `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 c = texture2D(tIn, vUv) * 0.2270270270;
  c += texture2D(tIn, vUv + dir * 1.3846153846) * 0.3162162162; c += texture2D(tIn, vUv - dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tIn, vUv + dir * 3.2307692308) * 0.0702702703; c += texture2D(tIn, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c; }`;

const BRIGHT = `uniform sampler2D tIn; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(tIn, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(threshold, threshold + 0.35, l); gl_FragColor = vec4(c * k, 1.0); }`;

const COPY = 'uniform sampler2D tIn; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tIn, vUv); }';

const COMPOSITE = `
uniform sampler2D tScene; uniform sampler2D tBlur; uniform sampler2D tBlur2; uniform sampler2D tBloom; uniform sampler2D tDepth;
uniform float near; uniform float far; uniform float focus; uniform float focusRange; uniform float dof;
uniform float tiltTop; uniform float tiltBottom; uniform float tilt;
uniform float bloom; uniform vec3 hazeColor; uniform float haze;
uniform vec3 tint; uniform vec3 lift; uniform float sat; uniform float contrast; uniform float exposure;
uniform float vignette; uniform float grain; uniform float seed; uniform float rain; uniform float time; uniform float flash;
uniform vec3 fadeColor; uniform float fade;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 sharp = texture2D(tScene, vUv).rgb;
  vec3 b1 = texture2D(tBlur, vUv).rgb; vec3 b2 = texture2D(tBlur2, vUv).rgb;
  float d = lin(texture2D(tDepth, vUv).x);
  float cocD = smoothstep(focusRange, focusRange * 3.0, abs(d - focus)) * dof;
  float cocT = (smoothstep(tiltTop, 1.0, vUv.y) + smoothstep(tiltBottom, 0.0, vUv.y)) * tilt;
  float coc = clamp(max(cocD, cocT), 0.0, 1.0);
  vec3 c = mix(sharp, b1, smoothstep(0.0, 0.5, coc));
  c = mix(c, b2, smoothstep(0.5, 1.0, coc));
  c += texture2D(tBloom, vUv).rgb * bloom;
  c *= exposure;
  // soft highlight roll-off (keeps glows golden instead of clipping to white)
  vec3 k = vec3(0.62);
  c = mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c));
  c = toSRGB(c);
  // atmospheric haze at the top of frame (reference look)
  c = mix(c, hazeColor, haze * smoothstep(0.5, 1.0, vUv.y));
  // grade
  c = c * tint + lift;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  // rain streaks (screen space, slanted)
  if (rain > 0.0) {
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 70.0 : 120.0;
      vec2 p = vec2(vUv.x * sc + vUv.y * sc * 0.12, vUv.y * (k == 0 ? 6.0 : 9.0) + time * (k == 0 ? 3.2 : 4.1));
      vec2 cell = floor(p); vec2 f = fract(p);
      float r = hash(cell + float(k) * 17.0);
      float on = step(0.55, r);
      float w = smoothstep(0.08, 0.0, abs(f.x - 0.5)) * smoothstep(0.0, 0.25, f.y) * smoothstep(1.0, 0.55, f.y);
      c = mix(c, vec3(0.82, 0.86, 0.92), on * w * rain * (k == 0 ? 0.35 : 0.22));
    }
  }
  c += flash * vec3(0.75, 0.8, 0.95);
  // vignette
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.85);
  c *= mix(1.0, smoothstep(0.82, 0.18, length(q) * 1.15), vignette);
  c = mix(c, fadeColor, fade);
  // film grain
  float n = hash(vUv * vec2(1080.0, 1920.0) + seed * 17.13) - 0.5;
  c += n * grain * 0.55 * (0.6 + 0.4 * (1.0 - l));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const MIX = `uniform sampler2D tA; uniform sampler2D tB; uniform float k; uniform vec3 dipColor; uniform float dip; varying vec2 vUv;
void main(){ vec3 a = texture2D(tA, vUv).rgb; vec3 b = texture2D(tB, vUv).rgb; vec3 c = mix(a, b, k);
  c = mix(c, dipColor, dip); gl_FragColor = vec4(c, 1.0); }`;

export const DEFAULT_POST = {
  focus: 20, focusRange: 6, dof: 0, tiltTop: 0.66, tiltBottom: 0.1, tilt: 0.75,
  bloom: 0.45, bloomThreshold: 0.88, hazeColor: new THREE.Color('#d9c497'), haze: 0.35,
  tint: new THREE.Color(1, 1, 1), lift: new THREE.Color(0, 0, 0), sat: 1, contrast: 1, exposure: 1,
  vignette: 0.55, grain: 0.035, rain: 0, flash: 0, fadeColor: new THREE.Color(0, 0, 0), fade: 0,
};

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.rtScene.depthTexture = new THREE.DepthTexture(W, H); this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.h1 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr); this.h2 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr);
    this.q1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr); this.q2 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.e1 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr); this.e2 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr);
    this.bl1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr); this.bl2 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.outA = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false }); this.outB = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.mCopy = mk(COPY, { tIn: { value: null } });
    this.mBlur = mk(BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mBright = mk(BRIGHT, { tIn: { value: null }, threshold: { value: 0.9 } });
    const u = { tScene: { value: null }, tBlur: { value: null }, tBlur2: { value: null }, tBloom: { value: null }, tDepth: { value: null }, near: { value: 0.5 }, far: { value: 1000 }, seed: { value: 0 }, time: { value: 0 } };
    for (const [k, v] of Object.entries(DEFAULT_POST)) u[k] = { value: v.isColor ? v.clone() : v };
    this.mComp = mk(COMPOSITE, u);
    this.mMix = mk(MIX, { tA: { value: null }, tB: { value: null }, k: { value: 0 }, dipColor: { value: new THREE.Color() }, dip: { value: 0 } });
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
  // render one shot fully into `target` (null = screen)
  shot(scene, camera, P, target, t, frame) {
    if (window.__dbg) P = { ...P, dof: 0, tilt: 0, haze: 0 };
    const r = this.r; const W = this.W, H = this.H;
    r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, camera);
    // DOF blur chain (half + eighth)
    this.mCopy.uniforms.tIn.value = this.rtScene.texture; this.pass(this.mCopy, this.h1);
    const blurHalf = this.blur(this.h1.texture, this.h1, this.h2, W / 2, H / 2, 2, 1.4);
    this.mCopy.uniforms.tIn.value = blurHalf; this.pass(this.mCopy, this.q1);
    this.mCopy.uniforms.tIn.value = this.q1.texture; this.pass(this.mCopy, this.e1);
    const blurE = this.blur(this.e1.texture, this.e1, this.e2, W / 8, H / 8, 2, 1.3);
    // bloom (quarter)
    this.mBright.uniforms.tIn.value = this.rtScene.texture; this.mBright.uniforms.threshold.value = P.bloomThreshold ?? 0.88;
    this.pass(this.mBright, this.bl1);
    const bloomTex = this.blur(this.bl1.texture, this.bl1, this.bl2, W / 4, H / 4, 3, 1.6);
    const u = this.mComp.uniforms;
    u.tScene.value = this.rtScene.texture; u.tBlur.value = blurHalf; u.tBlur2.value = blurE; u.tBloom.value = bloomTex; u.tDepth.value = this.rtScene.depthTexture;
    u.near.value = camera.near; u.far.value = camera.far; u.seed.value = frame % 997; u.time.value = t;
    for (const k of Object.keys(DEFAULT_POST)) {
      const v = P[k] ?? DEFAULT_POST[k];
      if (u[k].value && u[k].value.isColor) u[k].value.copy(v.isColor ? v : new THREE.Color(v)); else u[k].value = v;
    }
    this.pass(this.mComp, target);
  }
  mix(a, b, k, dipColor, dip) {
    const u = this.mMix.uniforms; u.tA.value = a.texture; u.tB.value = b.texture; u.k.value = k; u.dipColor.value.copy(dipColor || new THREE.Color(0, 0, 0)); u.dip.value = dip || 0;
    this.pass(this.mMix, null);
  }
}

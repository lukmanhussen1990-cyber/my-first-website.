// Post-processing: HDR scene -> bloom -> filmic tone map -> warm pastel
// grade -> vignette -> film grain -> caption overlay -> fade to black.
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FINAL_FS = `
uniform sampler2D tScene, tBloomA, tBloomB, tOver;
uniform vec2 res;
uniform float time, exposure, sat, contrast, vig, grain, bloomK, black, ca, overlayOn;
uniform vec3 tint, lift, flashCol;
uniform float flash;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 ACES(vec3 c){
  const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = vUv; vec2 d = uv - 0.5;
  vec3 c = vec3(texture2D(tScene, uv - d * ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv + d * ca).b);
  c += (texture2D(tBloomA, uv).rgb * 0.6 + texture2D(tBloomB, uv).rgb * 0.8) * bloomK;
  c += flashCol * flash;
  c = ACES(c * exposure / 0.6);
  c = toSRGB(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  c = c * tint + lift * (1.0 - c);
  float v = smoothstep(0.98, 0.28, length(d * vec2(1.0, 0.8)) * 1.2);
  c *= mix(1.0 - vig, 1.0, v);
  vec2 px = floor(uv * res);
  float f = floor(time * 30.0 + 0.5);
  float n = hash(px + f * 37.0) + hash(px * 1.37 + f * 91.0) - 1.0;
  float nc = hash(floor(px * 0.5) + f * 13.0) - 0.5;
  c += (n * 0.8 + nc * 0.5) * grain * (0.55 + 0.45 * (1.0 - l));
  vec4 o = texture2D(tOver, uv);
  c = mix(c, o.rgb, o.a * overlayOn);
  c *= (1.0 - black);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const POST_DEFAULT = {
  exposure: 1.0, sat: 0.92, contrast: 1.02, vig: 0.28, grain: 0.045, bloomK: 0.35, bloomThr: 0.9, ca: 0.0016,
  tint: [1.03, 1.0, 0.96], lift: [0.035, 0.022, 0.04], flash: 0, flashCol: [1, 1, 1],
};

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer;
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    const o = { type: THREE.HalfFloatType, depthBuffer: false };
    const w4 = Math.round(W / 4), h4 = Math.round(H / 4), w8 = Math.round(W / 8), h8 = Math.round(H / 8);
    this.a1 = new THREE.WebGLRenderTarget(w4, h4, o); this.a2 = new THREE.WebGLRenderTarget(w4, h4, o);
    this.b1 = new THREE.WebGLRenderTarget(w8, h8, o); this.b2 = new THREE.WebGLRenderTarget(w8, h8, o);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sm = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.bright = sm(`uniform sampler2D t; uniform float thr; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(thr * 0.75, thr * 1.6, l); gl_FragColor = vec4(c * k, 1.0); }`,
      { t: { value: null }, thr: { value: 1 } });
    this.blur = sm(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227027;
        c += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.316216;
        c += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.070270;
        gl_FragColor = vec4(c, 1.0); }`,
      { t: { value: null }, dir: { value: new THREE.Vector2() } });
    this.copy = sm(`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }`, { t: { value: null } });
    const U = {};
    for (const k of ['tScene', 'tBloomA', 'tBloomB', 'tOver']) U[k] = { value: null };
    for (const k of ['time', 'exposure', 'sat', 'contrast', 'vig', 'grain', 'bloomK', 'black', 'ca', 'flash', 'overlayOn']) U[k] = { value: 0 };
    U.res = { value: new THREE.Vector2(W, H) };
    U.tint = { value: new THREE.Vector3() }; U.lift = { value: new THREE.Vector3() }; U.flashCol = { value: new THREE.Vector3() };
    this.final = sm(FINAL_FS, U);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qs, this.qc);
  }
  blurPass(src, tmp, w, h) {
    this.blur.uniforms.t.value = src.texture; this.blur.uniforms.dir.value.set(1 / w, 0); this.pass(this.blur, tmp);
    this.blur.uniforms.t.value = tmp.texture; this.blur.uniforms.dir.value.set(0, 1 / h); this.pass(this.blur, src);
  }
  render(scene, camera, p, overlayTex) {
    const P = { ...POST_DEFAULT, ...p };
    this.r.setRenderTarget(this.sceneRT);
    this.r.setClearColor(0x000000, 1);
    this.r.clear();
    this.r.render(scene, camera);
    this.bright.uniforms.t.value = this.sceneRT.texture; this.bright.uniforms.thr.value = P.bloomThr;
    this.pass(this.bright, this.a1);
    this.blurPass(this.a1, this.a2, this.a1.width, this.a1.height);
    this.copy.uniforms.t.value = this.a1.texture; this.pass(this.copy, this.b1);
    this.blurPass(this.b1, this.b2, this.b1.width, this.b1.height);
    this.blurPass(this.b1, this.b2, this.b1.width, this.b1.height);
    const U = this.final.uniforms;
    U.tScene.value = this.sceneRT.texture; U.tBloomA.value = this.a1.texture; U.tBloomB.value = this.b1.texture;
    U.tOver.value = overlayTex; U.overlayOn.value = overlayTex ? 1 : 0;
    for (const k of ['time', 'exposure', 'sat', 'contrast', 'vig', 'grain', 'bloomK', 'black', 'ca', 'flash']) U[k].value = P[k] ?? 0;
    U.tint.value.set(...P.tint); U.lift.value.set(...P.lift); U.flashCol.value.set(...P.flashCol);
    this.pass(this.final, null);
  }
}

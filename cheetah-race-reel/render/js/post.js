import * as THREE from 'three';

// Offline-quality post chain in linear HDR:
//   N jittered sub-frames (anti-aliasing + motion blur + soft shadows) are
//   averaged, then bloom (mip chain), heat shimmer, filmic tone map, grade,
//   vignette and dither produce the 8-bit frame.

const quadVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsMat(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
}

const accumFrag = /* glsl */ `
uniform sampler2D tSrc; uniform float uW; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; c = min(c, vec3(400.0)); gl_FragColor = vec4(c * uW, uW); }`;

// 13-tap downsample (Jimenez 2014); Karis average on the first level
const downFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uKaris; uniform float uThresh; varying vec2 vUv;
vec3 s(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
float w(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main(){
  vec3 a = s(vec2(-2,2)), b = s(vec2(0,2)), c = s(vec2(2,2));
  vec3 d = s(vec2(-2,0)), e = s(vec2(0,0)), f = s(vec2(2,0));
  vec3 g = s(vec2(-2,-2)), h = s(vec2(0,-2)), i = s(vec2(2,-2));
  vec3 j = s(vec2(-1,1)), k = s(vec2(1,1)), l = s(vec2(-1,-1)), m = s(vec2(1,-1));
  vec3 res;
  if (uKaris > 0.5) {
    vec3 g0 = (a+b+d+e)*0.25, g1 = (b+c+e+f)*0.25, g2 = (d+e+g+h)*0.25, g3 = (e+f+h+i)*0.25, g4 = (j+k+l+m)*0.25;
    float w0 = w(g0), w1 = w(g1), w2 = w(g2), w3 = w(g3), w4 = w(g4);
    res = (g0*w0*0.125 + g1*w1*0.125 + g2*w2*0.125 + g3*w3*0.125 + g4*w4*0.5) / (w0*0.125 + w1*0.125 + w2*0.125 + w3*0.125 + w4*0.5);
    // soft-knee threshold: only highlights feed the bloom
    float br = max(res.r, max(res.g, res.b));
    float knee = uThresh * 0.5;
    float soft = clamp(br - uThresh + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - uThresh) / max(br, 1e-4);
    res *= contrib;
  } else {
    res = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  }
  gl_FragColor = vec4(res, 1.0);
}`;

const upFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius; uniform float uW; varying vec2 vUv;
vec3 s(vec2 o){ return texture2D(tSrc, vUv + o * uTexel * uRadius).rgb; }
void main(){
  vec3 r = s(vec2(0,0))*4.0 + (s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.0
         + s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
  gl_FragColor = vec4(r / 16.0 * uW, 1.0);
}`;

const finalFrag = /* glsl */ `
uniform sampler2D tScene, tBloom, tHeat;
uniform vec2 uRes;
uniform float uExposure, uBloom, uBloomNorm, uVignette, uSat, uContrast, uHeat, uSeed, uFade, uACES;
uniform vec3 uLift, uGain;
varying vec2 vUv;

// AgX (Troy Sobotka / Benjamin Wrensch fit) with a gentle punchy look
vec3 agxContrast(vec3 x){ vec3 x2 = x*x, x4 = x2*x2;
  return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 c){
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                      0.0784335999999992, 0.878468636469772, 0.0784336,
                      0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                      -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                      -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  c = m * c;
  c = clamp(log2(max(c, 1e-10)), -12.47393, 4.026069);
  c = (c + 12.47393) / (4.026069 + 12.47393);
  c = agxContrast(c);
  c = mi * c;
  return c; // already display-referred (approx. sRGB-encoded)
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// ACES filmic (Stephen Hill fit) -> linear display, then sRGB encode
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 acesHill(vec3 c){
  const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 o = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = o * RRTAndODTFit(i * c);
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main(){
  vec2 heat = (texture2D(tHeat, vUv).rg - 0.5) * uHeat;
  vec2 uv = vUv + heat;
  vec3 c = texture2D(tScene, uv).rgb;
  vec3 b = texture2D(tBloom, uv).rgb * uBloomNorm;
  c += b * uBloom;
  c *= uExposure;
  // warm/cool split before the curve
  c = c * uGain + uLift * (1.0 - smoothstep(0.0, 0.25, luma(c)));
  vec3 d = uACES > 0.5 ? acesHill(c * 1.6) : agx(c);
  d = clamp(d, 0.0, 1.0);
  // contrast + saturation in display space
  d = mix(vec3(0.5), d, uContrast);
  float l = luma(d);
  d = mix(vec3(l), d, uSat);
  // soft vignette (elliptical for 9:16)
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.9;
  float v = smoothstep(1.25, 0.25, length(q * vec2(1.25, 0.9)));
  d *= mix(1.0 - uVignette, 1.0, v);
  d *= uFade;
  // dither against banding in the sky gradient
  d += (ign(gl_FragCoord.xy + uSeed * 37.0) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(d, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true });
    this.accumRT = new THREE.WebGLRenderTarget(W, H, hf);
    this.outRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.mips = [];
    let w = W, h = H;
    for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); this.mips.push(new THREE.WebGLRenderTarget(w, h, hf)); }
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.accumMat = fsMat(accumFrag, { tSrc: { value: null }, uW: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
    this.downMat = fsMat(downFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 }, uThresh: { value: 1.1 } });
    this.upMat = fsMat(upFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uW: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
    const neutral = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1); neutral.needsUpdate = true;
    this.neutralHeat = neutral;
    this.finalMat = fsMat(finalFrag, {
      tScene: { value: this.accumRT.texture }, tBloom: { value: this.mips[0].texture }, tHeat: { value: neutral },
      uRes: { value: new THREE.Vector2(W, H) }, uExposure: { value: 1 }, uBloom: { value: 0.06 }, uBloomNorm: { value: 1 }, uVignette: { value: 0.28 },
      uSat: { value: 1.12 }, uContrast: { value: 1.06 }, uHeat: { value: 0.0 }, uSeed: { value: 0 }, uFade: { value: 1 }, uACES: { value: 0 },
      uLift: { value: new THREE.Vector3(0.006, 0.003, 0.01) }, uGain: { value: new THREE.Vector3(1.04, 0.99, 0.9) },
    });
    this.pixels = new Uint8Array(W * H * 4);
  }
  pass(mat, target, clear = true) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    // never let render() auto-clear: accumulation and bloom passes add up
    const ac = this.r.autoClear;
    this.r.autoClear = false;
    if (clear) this.r.clear(true, false, false);
    this.r.render(this.qscene, this.cam);
    this.r.autoClear = ac;
  }
  beginAccum() {
    this.r.setRenderTarget(this.accumRT);
    this.r.setClearColor(0x000000, 0); this.r.clear(true, false, false);
  }
  accumulate(w) {
    this.accumMat.uniforms.tSrc.value = this.sceneRT.texture;
    this.accumMat.uniforms.uW.value = w;
    this.pass(this.accumMat, this.accumRT, false);
  }
  finish(o = {}) {
    // bloom mip chain from the averaged HDR image
    let src = this.accumRT;
    for (let i = 0; i < this.mips.length; i++) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.downMat.uniforms.uKaris.value = i === 0 ? 1 : 0;
      this.pass(this.downMat, this.mips[i]);
      src = this.mips[i];
    }
    for (let i = this.mips.length - 1; i > 0; i--) {
      const lo = this.mips[i], hi = this.mips[i - 1];
      this.upMat.uniforms.tSrc.value = lo.texture;
      this.upMat.uniforms.uTexel.value.set(1 / lo.width, 1 / lo.height);
      this.upMat.uniforms.uRadius.value = 1.0;
      this.upMat.uniforms.uW.value = 0.75;
      this.pass(this.upMat, hi, false);
    }
    let norm = 1, w = 1;
    for (let i = 1; i < this.mips.length; i++) { w *= 0.75; norm += w; }
    this.finalMat.uniforms.uBloomNorm.value = 1 / norm;
    const u = this.finalMat.uniforms;
    for (const k of ['uExposure', 'uBloom', 'uVignette', 'uSat', 'uContrast', 'uHeat', 'uSeed', 'uFade', 'uACES']) if (o[k] !== undefined) u[k].value = o[k];
    u.tHeat.value = o.heatTex || this.neutralHeat;
    this.pass(this.finalMat, this.outRT);
  }
  read() {
    this.r.readRenderTargetPixels(this.outRT, 0, 0, this.W, this.H, this.pixels);
    return this.pixels;
  }
}

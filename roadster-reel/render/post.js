// HDR post pipeline:
//   N jittered, time-offset sub-frames are rendered (MSAA) and averaged in an HDR
//   accumulation buffer -> true motion blur + super-sampled anti-aliasing.
//   Then: mip-chain bloom (Jimenez '14 style), exposure, filmic tone map,
//   grading (saturation, contrast, split-tone), soft vignette, dithered 8-bit output.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsMat(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, ...extra,
  });
}

const ACCUM_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform float uWeight; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; c = min(c, vec3(4000.0)); gl_FragColor = vec4(c * uWeight, uWeight); }`;

const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 S(vec2 o){ return texture2D(tSrc, vUv + uTexel * o).rgb; }
void main(){
  vec3 a=S(vec2(-2.,2.)), b=S(vec2(0.,2.)), c=S(vec2(2.,2.));
  vec3 d=S(vec2(-2.,0.)), e=S(vec2(0.,0.)), f=S(vec2(2.,0.));
  vec3 g=S(vec2(-2.,-2.)), h=S(vec2(0.,-2.)), i=S(vec2(2.,-2.));
  vec3 j=S(vec2(-1.,1.)), k=S(vec2(1.,1.)), l=S(vec2(-1.,-1.)), m=S(vec2(1.,-1.));
  vec3 col;
  if (uFirst > 0.5) {
    vec3 g0=(a+b+d+e)*.25, g1=(b+c+e+f)*.25, g2=(d+e+g+h)*.25, g3=(e+f+h+i)*.25, g4=(j+k+l+m)*.25;
    float w0=.125/(1.+lum(g0)), w1=.125/(1.+lum(g1)), w2=.125/(1.+lum(g2)), w3=.125/(1.+lum(g3)), w4=.5/(1.+lum(g4));
    col = (g0*w0+g1*w1+g2*w2+g3*w3+g4*w4)/(w0+w1+w2+w3+w4);
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - uThreshold + uKnee, 0., 2.*uKnee); rq = rq*rq/(4.*uKnee+1e-5);
    col *= max(rq, br - uThreshold) / max(br, 1e-5);
  } else {
    col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const UP_FRAG = /* glsl */`
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 uTexel; uniform float uRadius; uniform float uLowGain;
varying vec2 vUv;
vec3 L(vec2 o){ return texture2D(tLow, vUv + uTexel * o * uRadius).rgb; }
void main(){
  vec3 c = L(vec2(-1.,1.)) + 2.*L(vec2(0.,1.)) + L(vec2(1.,1.))
         + 2.*L(vec2(-1.,0.)) + 4.*L(vec2(0.,0.)) + 2.*L(vec2(1.,0.))
         + L(vec2(-1.,-1.)) + 2.*L(vec2(0.,-1.)) + L(vec2(1.,-1.));
  c /= 16.;
  gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + c * uLowGain, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tHDR; uniform sampler2D tBloom;
uniform float uExposure; uniform float uBloom; uniform float uVignette; uniform float uSat; uniform float uContrast;
uniform vec3 uWB; uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform float uSplit; uniform vec2 uRes;
uniform float uFade; uniform float uFlash;
varying vec2 vUv;
// ACES filmic (Hill fit), as in three.js
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 ACESFilmic(vec3 color){
  const mat3 IN = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 OUT = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  color = IN * color; color = RRTAndODTFit(color); color = OUT * color; return clamp(color, 0.0, 1.0);
}
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tHDR, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c += b * uBloom;
  // soft optical vignette (elliptical for 9:16)
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.55;
  float v = 1.0 - uVignette * smoothstep(0.25, 1.05, dot(q, q));
  c *= v * uExposure * uWB;
  c += uFlash;
  c = ACESFilmic(c);
  // grading in display-referred linear
  float l = lum(c);
  c = mix(vec3(l), c, uSat);
  vec3 s = toSRGB(c);
  // gentle S-curve contrast around mid grey
  s = mix(s, s * s * (3.0 - 2.0 * s), uContrast);
  // split toning: cool shadows, warm highlights
  float ls = lum(s);
  s += uSplit * (uShadowTint * (1.0 - smoothstep(0.0, 0.55, ls)) + uHighTint * smoothstep(0.45, 1.0, ls));
  s *= (1.0 - uFade);
  // dither to avoid banding in the sky gradients (static pattern -> no flicker)
  s += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer, W, H, opts = {}) {
    this.renderer = renderer; this.W = W; this.H = H;
    const msaa = opts.msaa ?? 4;
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: msaa, depthBuffer: true, stencilBuffer: false });
    this.accumRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false, stencilBuffer: false });
    this.finalRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
    this.down = []; this.up = [];
    let w = Math.floor(W / 2), h = Math.floor(H / 2);
    const levels = opts.bloomLevels ?? 7;
    for (let i = 0; i < levels; i++) {
      const o = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.down.push(new THREE.WebGLRenderTarget(Math.max(w, 2), Math.max(h, 2), o));
      this.up.push(new THREE.WebGLRenderTarget(Math.max(w, 2), Math.max(h, 2), o));
      w = Math.floor(w / 2); h = Math.floor(h / 2);
    }
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.quad);

    this.accumMat = fsMat(ACCUM_FRAG, { tSrc: { value: null }, uWeight: { value: 1 } }, {
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, transparent: true,
    });
    this.downMat = fsMat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } });
    this.upMat = fsMat(UP_FRAG, { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 }, uLowGain: { value: 1.0 } });
    this.compMat = fsMat(COMPOSITE_FRAG, {
      tHDR: { value: this.accumRT.texture }, tBloom: { value: null },
      uExposure: { value: 1.0 }, uBloom: { value: 0.12 }, uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uContrast: { value: 0.18 },
      uWB: { value: new THREE.Vector3(1, 1, 1) }, uShadowTint: { value: new THREE.Vector3(-0.012, 0.004, 0.03) },
      uHighTint: { value: new THREE.Vector3(0.025, 0.008, -0.02) }, uSplit: { value: 1.0 }, uRes: { value: new THREE.Vector2(W, H) },
      uFade: { value: 0.0 }, uFlash: { value: 0.0 },
    });
    this.grade = this.compMat.uniforms;
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.cam);
  }

  beginAccum() {
    const r = this.renderer;
    r.setRenderTarget(this.accumRT);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
  }

  accumulate(weight) {
    this.accumMat.uniforms.tSrc.value = this.sceneRT.texture;
    this.accumMat.uniforms.uWeight.value = weight;
    this.pass(this.accumMat, this.accumRT);
  }

  finish(target = this.finalRT) {
    // bloom chain
    const d = this.downMat.uniforms;
    let src = this.accumRT;
    for (let i = 0; i < this.down.length; i++) {
      d.tSrc.value = src.texture;
      d.uTexel.value.set(1 / src.width, 1 / src.height);
      d.uFirst.value = i === 0 ? 1 : 0;
      this.pass(this.downMat, this.down[i]);
      src = this.down[i];
    }
    const u = this.upMat.uniforms;
    let low = this.down[this.down.length - 1];
    for (let i = this.down.length - 2; i >= 0; i--) {
      u.tLow.value = low.texture; u.tHigh.value = this.down[i].texture;
      u.uTexel.value.set(1 / low.width, 1 / low.height);
      u.uLowGain.value = 1.0;
      this.pass(this.upMat, this.up[i]);
      low = this.up[i];
    }
    this.compMat.uniforms.tBloom.value = this.up[0].texture;
    this.pass(this.compMat, target);
  }
}

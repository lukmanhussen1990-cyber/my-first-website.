import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 13-tap downsample (Jimenez 2014) with a soft threshold on the first level.
const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold, knee;
uniform bool first;
varying vec2 vUv;
vec3 s(vec2 o){ return texture2D(tSrc, vUv + texel * o).rgb; }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Karis average: weight each 2x2 group by 1/(1+luma) to suppress fireflies.
void addGroup(inout vec3 acc, inout float wsum, vec3 g, float w){
  float k = w / (1.0 + lum(g));
  acc += g * k;
  wsum += k;
}
void main(){
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col;
  if (first) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    addGroup(acc, wsum, (j + k + l + m) * 0.25, 0.5);
    addGroup(acc, wsum, (a + b + d + e) * 0.25, 0.125);
    addGroup(acc, wsum, (b + c + e + f) * 0.25, 0.125);
    addGroup(acc, wsum, (d + e + g + h) * 0.25, 0.125);
    addGroup(acc, wsum, (e + f + h + i) * 0.25, 0.125);
    col = acc / wsum;
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    rq = rq * rq / (4.0 * knee + 1e-5);
    col *= max(rq, br - threshold) / max(br, 1e-5);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const UP_FS = /* glsl */ `
uniform sampler2D tLow, tHigh;
uniform vec2 texelLow;
uniform float radius, highWeight;
varying vec2 vUv;
void main(){
  vec2 t = texelLow * radius;
  vec3 c = texture2D(tLow, vUv + t * vec2(-1.0, 1.0)).rgb + texture2D(tLow, vUv + t * vec2(1.0, 1.0)).rgb
         + texture2D(tLow, vUv + t * vec2(-1.0, -1.0)).rgb + texture2D(tLow, vUv + t * vec2(1.0, -1.0)).rgb
         + 2.0 * (texture2D(tLow, vUv + t * vec2(0.0, 1.0)).rgb + texture2D(tLow, vUv + t * vec2(0.0, -1.0)).rgb
                + texture2D(tLow, vUv + t * vec2(-1.0, 0.0)).rgb + texture2D(tLow, vUv + t * vec2(1.0, 0.0)).rgb)
         + 4.0 * texture2D(tLow, vUv).rgb;
  c /= 16.0;
  gl_FragColor = vec4(texture2D(tHigh, vUv).rgb * highWeight + c, 1.0);
}
`;

const COMPOSITE_FS = /* glsl */ `
uniform sampler2D tScene, tBloom, tText;
uniform vec2 res;
uniform float exposure, bloomStrength, time;
uniform float zoomBlur;
uniform vec2 zoomCenter;
uniform vec2 whip;
uniform float ca;
uniform vec4 shock;
uniform float flash;
uniform vec3 flashColor;
uniform float fade, fadeAll;
uniform float vignette, grain, saturation, contrast;
uniform vec3 shadowTint, highlightTint;
uniform float textOpacity;
uniform float split;        // >0: vertical split position (uv x) for overlays drawn in the scene
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v){
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color){
  const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  color = inM * color;
  color = RRTAndODTFit(color);
  color = outM * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 sampleScene(vec2 uv){
  vec2 d = (uv - 0.5);
  vec3 c;
  if (ca > 0.0) {
    c.r = texture2D(tScene, uv - d * ca).r;
    c.g = texture2D(tScene, uv).g;
    c.b = texture2D(tScene, uv + d * ca).b;
  } else {
    c = texture2D(tScene, uv).rgb;
  }
  return c + texture2D(tBloom, uv).rgb * bloomStrength;
}
void main(){
  vec2 uv = vUv;
  float aspect = res.x / res.y;
  if (shock.w > 0.0) {
    vec2 p = (uv - shock.xy) * vec2(aspect, 1.0);
    float r = length(p);
    float ring = exp(-pow((r - shock.z) / 0.045, 2.0));
    uv -= normalize(p + 1e-6) * ring * shock.w * vec2(1.0 / aspect, 1.0);
  }
  vec3 col;
  if (zoomBlur > 0.0005 || dot(whip, whip) > 1e-8) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 28; i++) {
      float f = float(i) / 27.0;
      vec2 o = (uv - zoomCenter) * zoomBlur * f + whip * (f - 0.5);
      float w = 1.0 - 0.6 * f;
      acc += sampleScene(uv - o) * w;
      wsum += w;
    }
    col = acc / wsum;
  } else {
    col = sampleScene(uv);
  }
  col *= exposure;
  col += flashColor * flash;
  col = acesFilmic(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col *= mix(shadowTint, vec3(1.0), smoothstep(0.0, 0.35, l));
  col *= mix(vec3(1.0), highlightTint, smoothstep(0.45, 1.0, l));
  vec3 s = toSRGB(clamp(col, 0.0, 1.0));
  s = clamp((s - 0.5) * contrast + 0.5 + (contrast - 1.0) * 0.04, 0.0, 1.0);
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  s *= mix(1.0, smoothstep(1.05, 0.2, length(q * vec2(1.25, 0.95))), vignette);
  s += (hash12(gl_FragCoord.xy + fract(time * 7.13) * 917.0) - 0.5) * grain;
  s *= 1.0 - fade;
  vec4 tx = texture2D(tText, vUv);
  s = s * (1.0 - tx.a * textOpacity) + tx.rgb * textOpacity;
  s *= 1.0 - fadeAll;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

export const POST_DEFAULTS = {
  exposure: 1.0,
  bloomStrength: 0.9,
  bloomThreshold: 0.85,
  bloomKnee: 0.6,
  bloomRadius: 1.0,
  zoomBlur: 0,
  zoomCenter: [0.5, 0.5],
  whip: [0, 0],
  ca: 0.0025,
  shock: [0.5, 0.5, 0, 0],
  flash: 0,
  flashColor: [0.7, 0.85, 1.0],
  fade: 0,
  fadeAll: 0,
  vignette: 0.55,
  grain: 0.022,
  saturation: 1.12,
  contrast: 1.06,
  shadowTint: [0.86, 0.93, 1.12],
  highlightTint: [1.04, 1.0, 0.95],
  textOpacity: 1,
};

export class Post {
  constructor(renderer, W, H) {
    this.renderer = renderer;
    this.W = W;
    this.H = H;
    const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { ...hdr, samples: 4 });
    this.down = [];
    this.up = [];
    let w = W >> 1;
    let h = H >> 1;
    for (let i = 0; i < 7; i++) {
      this.down.push(new THREE.WebGLRenderTarget(w, h, { ...hdr, depthBuffer: false }));
      this.up.push(new THREE.WebGLRenderTarget(w, h, { ...hdr, depthBuffer: false }));
      w = Math.max(2, w >> 1);
      h = Math.max(2, h >> 1);
    }
    this.outRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });

    this.downMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: DOWN_FS,
      uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 }, first: { value: true } },
      depthTest: false,
      depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: UP_FS,
      uniforms: { tLow: { value: null }, tHigh: { value: null }, texelLow: { value: new THREE.Vector2() }, radius: { value: 1 }, highWeight: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    const u = {};
    for (const [k, v] of Object.entries(POST_DEFAULTS)) {
      u[k] = { value: Array.isArray(v) ? (v.length === 2 ? new THREE.Vector2(...v) : v.length === 3 ? new THREE.Vector3(...v) : new THREE.Vector4(...v)) : v };
    }
    Object.assign(u, {
      tScene: { value: this.sceneRT.texture },
      tBloom: { value: this.up[0].texture },
      tText: { value: null },
      res: { value: new THREE.Vector2(W, H) },
      time: { value: 0 },
      split: { value: 0 },
    });
    this.compMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: COMPOSITE_FS, uniforms: u, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.downMat);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  bloom(p) {
    const n = this.down.length;
    let src = this.sceneRT.texture;
    let sw = this.W;
    let sh = this.H;
    for (let i = 0; i < n; i++) {
      this.downMat.uniforms.tSrc.value = src;
      this.downMat.uniforms.texel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.first.value = i === 0;
      this.downMat.uniforms.threshold.value = p.bloomThreshold;
      this.downMat.uniforms.knee.value = p.bloomKnee;
      this.pass(this.downMat, this.down[i]);
      src = this.down[i].texture;
      sw = this.down[i].width;
      sh = this.down[i].height;
    }
    // progressive upsample: up[i] = down[i] + tent(up[i+1])
    let low = this.down[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.upMat.uniforms.tLow.value = low.texture;
      this.upMat.uniforms.tHigh.value = this.down[i].texture;
      this.upMat.uniforms.texelLow.value.set(1 / low.width, 1 / low.height);
      this.upMat.uniforms.radius.value = p.bloomRadius;
      this.upMat.uniforms.highWeight.value = 1.0;
      this.pass(this.upMat, this.up[i]);
      low = this.up[i];
    }
  }

  // p: merged post params; textTexture: CanvasTexture with the caption layer.
  finish(p, time, textTexture) {
    this.bloom(p);
    const u = this.compMat.uniforms;
    for (const k of Object.keys(POST_DEFAULTS)) {
      const v = p[k];
      if (Array.isArray(v)) u[k].value.fromArray(v);
      else u[k].value = v;
    }
    u.bloomStrength.value = p.bloomStrength / this.down.length;
    u.time.value = time;
    u.tText.value = textTexture;
    this.pass(this.compMat, this.outRT);
  }

  readPixels(buf) {
    this.renderer.readRenderTargetPixels(this.outRT, 0, 0, this.W, this.H, buf);
    return buf;
  }
}

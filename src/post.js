// Post-processing: scene (HDR + depth) -> depth of field -> bloom -> final grade
// (chromatic aberration on scares, teal-shadow grade, ACES, vignette, film grain)
// with the caption overlay composited last, in display space.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const DOF_FRAG = `
#include <packing>
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float cameraNear; uniform float cameraFar; uniform float focus; uniform float aperture; uniform float maxBlur;
uniform vec2 resolution;
varying vec2 vUv;
float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
float coc(float z){ return clamp(aperture * 10.0 * abs(z - focus) / max(z, 0.001), 0.0, 1.0); }
void main(){
  vec4 base = texture2D(tColor, vUv);
  if (maxBlur < 0.5) { gl_FragColor = base; return; }
  float z = viewZ(vUv);
  float radius = coc(z) * maxBlur;
  vec3 acc = base.rgb; float wsum = 1.0;
  for (int i = 0; i < 20; i++) {
    float fi = float(i) + 0.5;
    float sr = sqrt(fi / 20.0) * maxBlur;
    float a = fi * 2.39996323;
    vec2 suv = vUv + vec2(cos(a), sin(a)) * sr / resolution;
    float sz = viewZ(suv);
    float wBg = smoothstep(sr - 1.0, sr + 0.5, radius);
    float wFg = sz < z ? smoothstep(sr - 1.0, sr + 0.5, coc(sz) * maxBlur) : 0.0;
    float w = max(wBg, wFg);
    acc += texture2D(tColor, suv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, base.a);
}`;

const FINAL_FRAG = `
uniform sampler2D tColor; uniform sampler2D tOverlay;
uniform vec2 resolution; uniform float exposure; uniform float ca; uniform float vignette;
uniform float grain; uniform float frame; uniform float hasOverlay;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 d = vUv - 0.5;
  vec3 col;
  if (ca > 0.0) {
    vec2 off = d * ca * (1.0 + 2.0 * dot(d, d));
    col.r = texture2D(tColor, vUv + off).r;
    col.g = texture2D(tColor, vUv).g;
    col.b = texture2D(tColor, vUv - off).b;
  } else {
    col = texture2D(tColor, vUv).rgb;
  }
  col *= exposure;
  // grade: shadows sink into deep teal, highlights stay cold white, sodium stays orange
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col * vec3(0.78, 1.0, 1.05), col, smoothstep(0.015, 0.5, l));
  col += vec3(0.0, 0.0045, 0.0065) * (1.0 - smoothstep(0.0, 0.06, l));
  col = aces(col);
  float v = smoothstep(1.0, 0.3, length(d * vec2(1.0, 0.78)) * 1.32);
  col *= mix(1.0, v, vignette);
  col = toSRGB(col);
  // soft film grain: value noise on a 1.6 px lattice (organic, and gentle on the H.264 encoder)
  vec2 gp = vUv * resolution / 1.6 + vec2(frame * 37.13, frame * 19.71);
  vec2 gi = floor(gp); vec2 gf = fract(gp); gf = gf * gf * (3.0 - 2.0 * gf);
  float g = mix(mix(hash(gi), hash(gi + vec2(1.0, 0.0)), gf.x), mix(hash(gi + vec2(0.0, 1.0)), hash(gi + vec2(1.0, 1.0)), gf.x), gf.y) - 0.5;
  col += g * grain * (0.55 + 0.45 * (1.0 - abs(col - 0.5) * 2.0));
  vec4 ov = texture2D(tOverlay, vUv);
  col = mix(col, ov.rgb, ov.a * hasOverlay);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer;
    const depthTexture = new THREE.DepthTexture(W, H);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture });
    this.dofRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.55, 0.9);
    this.dof = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: this.sceneRT.texture },
          tDepth: { value: depthTexture },
          cameraNear: { value: 0.03 },
          cameraFar: { value: 140 },
          focus: { value: 5 },
          aperture: { value: 0 },
          maxBlur: { value: 0 },
          resolution: { value: new THREE.Vector2(W, H) },
        },
        vertexShader: VERT,
        fragmentShader: DOF_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.final = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: this.dofRT.texture },
          tOverlay: { value: null },
          resolution: { value: new THREE.Vector2(W, H) },
          exposure: { value: 1 },
          ca: { value: 0 },
          vignette: { value: 0.5 },
          grain: { value: 0.05 },
          frame: { value: 0 },
          hasOverlay: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FINAL_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.scaleBlur = W / 1080;
  }

  render(scene, camera, p, overlay, frame) {
    const r = this.r;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    const du = this.dof.material.uniforms;
    du.cameraNear.value = camera.near;
    du.cameraFar.value = camera.far;
    du.focus.value = p.focus;
    du.aperture.value = p.aperture;
    du.maxBlur.value = p.maxBlur * this.scaleBlur;
    r.setRenderTarget(this.dofRT);
    this.dof.render(r);
    this.bloom.strength = p.bloom;
    this.bloom.radius = p.bloomRadius;
    this.bloom.threshold = p.bloomThreshold;
    this.bloom.render(r, null, this.dofRT, 0, false);
    const fu = this.final.material.uniforms;
    fu.exposure.value = p.exposure;
    fu.ca.value = p.ca;
    fu.vignette.value = p.vignette;
    fu.grain.value = p.grain;
    fu.frame.value = frame;
    fu.tOverlay.value = overlay.texture;
    fu.hasOverlay.value = overlay.visible ? 1 : 0;
    r.setRenderTarget(null);
    this.final.render(r);
  }
}

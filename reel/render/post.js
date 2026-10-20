// Post-processing: HDR MSAA render -> heat haze -> bloom -> filmic grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const HazeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uStrength: { value: 0 },
    uRegion: { value: new THREE.Vector4(0, 0, 1, 1) }, uAspect: { value: 9 / 16 },
    uStreak: { value: 0 }, uStreakDir: { value: new THREE.Vector2(0, 1) }, uFlash: { value: 0 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uStrength, uAspect, uStreak, uFlash;
    uniform vec4 uRegion; uniform vec2 uStreakDir;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 uv = vUv;
      // Heat haze: rising, wobbling refraction. Strength masked to a screen region.
      float m = smoothstep(uRegion.x, uRegion.x + 0.15, uv.y) * (1.0 - smoothstep(uRegion.z - 0.15, uRegion.z, uv.y));
      float s = uStrength * m;
      if (s > 0.0001) {
        vec2 q = vec2(uv.x * uAspect * 9.0, uv.y * 9.0 - uTime * 1.6);
        vec2 off = vec2(n2(q + vec2(0.0, uTime * 0.7)) - 0.5, n2(q * 1.7 + 13.1 - vec2(0.0, uTime * 1.3)) - 0.5);
        uv += off * s * 0.012;
      }
      vec3 c = min(texture2D(tDiffuse, uv).rgb, vec3(24.0)); // tame specular fireflies before bloom
      // Speed streaks: directional blur toward the travel direction.
      if (uStreak > 0.001) {
        vec3 acc = c; float wsum = 1.0;
        for (int i = 1; i <= 14; i++) {
          float f = float(i) / 14.0;
          float w = 1.0 - f * 0.6;
          acc += texture2D(tDiffuse, uv + uStreakDir * f * uStreak * 0.09).rgb * w;
          wsum += w;
        }
        c = mix(c, acc / wsum, clamp(uStreak * 3.0, 0.0, 1.0));
      }
      c += vec3(1.0, 0.92, 0.75) * uFlash * 6.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1.0 }, uSaturation: { value: 1.08 }, uContrast: { value: 1.04 },
    uVignette: { value: 0.32 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    uAspect: { value: 9 / 16 }, uTime: { value: 0 }, uGrain: { value: 0.004 },
  },
  vertexShader: HazeShader.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uExposure, uSaturation, uContrast, uVignette, uAspect, uTime, uGrain;
    uniform vec3 uTint, uLift; varying vec2 vUv;
    // ACES fitted (Stephen Hill)
    vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 o = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      c = i * c; c = RRTAndODTFit(c); c = o * c; return clamp(c, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure * uTint;
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      c = c + uLift * (1.0 - c);
      vec2 d = (vUv - 0.5) * vec2(uAspect * 1.25, 1.0);
      float v = smoothstep(0.85, 0.2, length(d));
      c *= mix(1.0 - uVignette, 1.0, v);
      c = toSRGB(clamp(c, 0.0, 1.0));

      c += (h(vUv * 1373.0) - 0.5) * uGrain; // static dither against banding (no temporal noise)
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, camera);
  const haze = new ShaderPass(HazeShader);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.55, 3.0);
  const grade = new ShaderPass(GradeShader);
  haze.uniforms.uAspect.value = W / H;
  grade.uniforms.uAspect.value = W / H;
  composer.addPass(renderPass);
  composer.addPass(haze);
  composer.addPass(bloom);
  composer.addPass(grade);
  return {
    composer, haze, bloom, grade, renderPass,
    render() { composer.render(); },
    setCamera(cam) { renderPass.camera = cam; },
  };
}

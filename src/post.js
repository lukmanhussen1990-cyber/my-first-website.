// Post-processing: scene (MSAA + depth) -> DOF -> bloom -> tone map -> final
// (chromatic aberration, grade, vignette, grain, eyelids, glass blur, UI).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class SceneDOFPass extends Pass {
  constructor(scene, camera, w, h, samples = 4) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
    this.rt.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.uniforms = {
      tColor: { value: this.rt.texture },
      tDepth: { value: this.rt.depthTexture },
      near: { value: 0.01 },
      far: { value: 100 },
      focus: { value: 2 },
      aperture: { value: 0.4 },
      maxBlur: { value: 9 },
      resolution: { value: new THREE.Vector2(w, h) },
    };
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: /* glsl */ `
          uniform sampler2D tColor, tDepth;
          uniform float near, far, focus, aperture, maxBlur;
          uniform vec2 resolution;
          varying vec2 vUv;
          float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
          float coc(float d){ return clamp(aperture * abs(d - focus) / max(d, 1e-3), 0.0, 1.0) * maxBlur; }
          void main(){
            float d = lin(texture2D(tDepth, vUv).x);
            float c = coc(d);
            vec3 base = texture2D(tColor, vUv).rgb;
            vec3 sum = base; float wsum = 1.0;
            if (maxBlur > 0.0 && c > 0.6) {
              for (int i = 1; i < 20; i++) {
                float fi = float(i);
                float r = sqrt(fi / 20.0) * c;
                float a = fi * 2.39996;
                vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolution;
                float sd = lin(texture2D(tDepth, uv).x);
                float sc = coc(sd);
                float w = clamp(1.0 + sc - r, 0.0, 1.0);
                if (sd > d) w *= clamp(1.0 + c - r, 0.0, 1.0);
                sum += texture2D(tColor, uv).rgb * w; wsum += w;
              }
            }
            gl_FragColor = vec4(sum / wsum, 1.0);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.uniforms.near.value = this.camera.near;
    this.uniforms.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tInput; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
    c += texture2D(tInput, vUv + dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tInput, vUv - dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tInput, vUv + dir * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tInput, vUv - dir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;

class FinalPass extends Pass {
  constructor(w, h, uiTex, glassTex) {
    super();
    this.needsSwap = true;
    const sw = Math.round(w / 4);
    const sh = Math.round(h / 4);
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.small = [new THREE.WebGLRenderTarget(sw, sh, opt), new THREE.WebGLRenderTarget(sw, sh, opt)];
    this.blurU = { tInput: { value: null }, dir: { value: new THREE.Vector2() } };
    this.blurQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.blurU, vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false }));
    this.copyU = { tInput: { value: null } };
    this.copyQuad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: this.copyU,
        vertexShader: VERT,
        fragmentShader: `uniform sampler2D tInput; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tInput, vUv).rgb, 1.0); }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sw = sw;
    this.sh = sh;
    this.u = {
      tScene: { value: null },
      tBlur: { value: this.small[0].texture },
      tUI: { value: uiTex },
      tGlass: { value: glassTex },
      resolution: { value: new THREE.Vector2(w, h) },
      frame: { value: 0 },
      grain: { value: 0.05 },
      vignette: { value: 0.5 },
      ca: { value: 0 },
      fade: { value: 0 },
      lidGap: { value: 2 },
      lidCenter: { value: 0.5 },
      lidGlow: { value: 0 },
      lidBlur: { value: 0 },
      lift: { value: new THREE.Vector3(0.012, 0.02, 0.034) },
      useBlur: { value: 0 },
      glassOn: { value: 0 },
    };
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: this.u,
        vertexShader: VERT,
        fragmentShader: /* glsl */ `
          uniform sampler2D tScene, tBlur, tUI, tGlass;
          uniform vec2 resolution;
          uniform float frame, grain, vignette, ca, fade, lidGap, lidCenter, lidGlow, lidBlur, useBlur, glassOn;
          uniform vec3 lift;
          varying vec2 vUv;
          float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          float hash1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

          // 0 = open, 1 = eyelid. Includes lashes.
          float lidMask(vec2 uv){
            if (lidGap > 1.25) return 0.0;
            vec2 px = uv * resolution;
            float x = uv.x - 0.5;
            float hg = lidGap * 0.5;
            float shape = 1.0 - 1.15 * x * x * 4.0 * smoothstep(0.0, 0.6, 1.2 - lidGap);
            float top = lidCenter + hg * max(shape, 0.0) + 0.012 * sin(x * 3.0 + 0.4);
            float bot = lidCenter - hg * 0.82 * max(shape, 0.0) + 0.006 * sin(x * 2.0);
            float soft = 0.010 + 0.01 * lidGap;
            float m = max(smoothstep(top - soft, top + soft, uv.y), 1.0 - smoothstep(bot - soft, bot + soft, uv.y));
            // upper lashes hang into the gap, lower lashes point up
            float lash = 0.0;
            float sp = 15.0;
            float cell = floor(px.x / sp);
            for (int k = -2; k <= 2; k++) {
              float i = cell + float(k);
              float bx = (i + 0.5 + (hash1(i) - 0.5) * 0.7) * sp;
              float len = (32.0 + hash1(i + 7.0) * 30.0) * (0.6 + 0.4 * (1.0 - abs(x) * 1.6));
              float d = (top * resolution.y) - px.y;
              float tilt = (bx / resolution.x - 0.5) * 0.9;
              if (d > -2.0 && d < len) {
                float lx = bx + tilt * d + 0.004 * d * d * sign(bx / resolution.x - 0.5);
                float w = 2.6 * (1.0 - d / len) + 0.4;
                lash = max(lash, (1.0 - smoothstep(w * 0.4, w, abs(px.x - lx))) * (1.0 - d / len));
              }
              float lenB = len * 0.45;
              float dB = px.y - (bot * resolution.y);
              if (dB > -2.0 && dB < lenB) {
                float lxB = bx + tilt * dB * 0.8;
                float wB = 2.0 * (1.0 - dB / lenB) + 0.3;
                lash = max(lash, (1.0 - smoothstep(wB * 0.4, wB, abs(px.x - lxB))) * (1.0 - dB / lenB) * 0.8);
              }
            }
            return clamp(max(m, lash * smoothstep(1.2, 0.6, lidGap)), 0.0, 1.0);
          }

          vec3 grade(vec3 c){
            c = c + lift * (1.0 - c);
            float l = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(c, c * vec3(0.86, 1.0, 1.14), (1.0 - l) * 0.35);
            c = (c - 0.5) * 1.06 + 0.5;
            c = mix(vec3(l), c, 1.06);
            return clamp(c, 0.0, 1.0);
          }

          void main(){
            vec2 uv = vUv;
            vec2 dc = uv - 0.5;
            vec3 col;
            if (ca > 0.001) {
              vec2 off = dc * ca * 0.018 + vec2(ca * 0.0015, 0.0);
              col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
            } else {
              col = texture2D(tScene, uv).rgb;
            }
            float lm = lidMask(uv);
            if (useBlur > 0.5 && lidBlur > 0.0) {
              vec3 bl = texture2D(tBlur, uv).rgb;
              float edge = smoothstep(0.0, 0.08, lidGap * 0.5 - abs(uv.y - lidCenter));
              col = mix(col, bl, lidBlur * (1.0 - edge * 0.65));
            }
            col = grade(col);
            float v = length(dc * vec2(1.0, 0.78)) * 1.35;
            col *= 1.0 - vignette * smoothstep(0.35, 1.15, v);
            // eyelids: dark skin with warm translucency when lit
            float dEdge = min(abs(uv.y - lidCenter) - lidGap * 0.5, 0.25);
            float nearEdge = 1.0 - smoothstep(0.0, 0.12, dEdge);
            vec3 lidCol = mix(vec3(0.020, 0.012, 0.014), vec3(0.075, 0.032, 0.03), nearEdge * 0.8);
            lidCol = mix(lidCol, vec3(0.24, 0.06, 0.04), lidGlow * (0.4 + 0.6 * nearEdge));
            col = mix(col, lidCol, lm);
            // glass cards: blurred backdrop + cool tint
            float gm = texture2D(tGlass, uv).r * glassOn;
            if (gm > 0.001 && useBlur > 0.5) {
              vec3 bl = grade(texture2D(tBlur, uv).rgb) * (1.0 - lidMask(uv) * 0.85);
              bl = mix(bl, vec3(0.62, 0.68, 0.76), 0.16) * 0.9;
              col = mix(col, bl, gm);
            }
            float n = hash(gl_FragCoord.xy + vec2(mod(frame * 37.0, 1009.0), mod(frame * 61.0, 997.0))) - 0.5;
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col += n * grain * (0.55 + 0.9 * l * (1.0 - l));
            vec4 ui = texture2D(tUI, uv);
            col = mix(col, ui.rgb, ui.a);
            col += n * grain * 0.25 * ui.a;
            col *= 1.0 - fade;
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }
  setSize() {}

  render(renderer, writeBuffer, readBuffer) {
    if (this.u.useBlur.value > 0.5) {
      this.copyU.tInput.value = readBuffer.texture;
      renderer.setRenderTarget(this.small[0]);
      this.copyQuad.render(renderer);
      for (let it = 0; it < 2; it++) {
        this.blurU.tInput.value = this.small[0].texture;
        this.blurU.dir.value.set(1.6 / this.sw, 0);
        renderer.setRenderTarget(this.small[1]);
        this.blurQuad.render(renderer);
        this.blurU.tInput.value = this.small[1].texture;
        this.blurU.dir.value.set(0, 1.6 / this.sh);
        renderer.setRenderTarget(this.small[0]);
        this.blurQuad.render(renderer);
      }
    }
    this.u.tScene.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

// The 3D layer renders at `scale` of the output size (SwiftShader is CPU-bound);
// the final pass upsamples it and composites the full-resolution UI on top.
export function buildPost(renderer, scene, camera, w, h, uiTex, glassTex, { scale = 1, samples = 4 } = {}) {
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sw, sh, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1);
  composer.setSize(sw, sh);
  const sceneDof = new SceneDOFPass(scene, camera, sw, sh, samples);
  sceneDof.uniforms.maxBlur.value = 9 * scale;
  sceneDof.blurScale = scale;
  const bloom = new UnrealBloomPass(new THREE.Vector2(sw, sh), 0.55, 0.6, 0.82);
  const output = new OutputPass();
  const final = new FinalPass(w, h, uiTex, glassTex);
  final.u.resolution.value.set(w, h);
  composer.addPass(sceneDof);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(final);
  return { composer, sceneDof, bloom, output, final };
}

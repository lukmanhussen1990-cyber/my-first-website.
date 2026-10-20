// Post-processing chain (EffectComposer): render -> depth of field -> bloom -> tone map -> film look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class DOFPass extends Pass {
  constructor(camera, w, h) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        uFocus: { value: 3 }, uAperture: { value: 0.0 }, uMaxBlur: { value: 9 },
        uNear: { value: 0.05 }, uFar: { value: 40 }, uRes: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: VERT,
      fragmentShader: `
        #include <packing>
        uniform sampler2D tColor, tDepth; uniform float uFocus, uAperture, uMaxBlur, uNear, uFar; uniform vec2 uRes; varying vec2 vUv;
        float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
        float coc(float z){ return clamp(abs(1.0/uFocus - 1.0/z) * uAperture, 0.0, 1.0) * uMaxBlur; }
        void main(){
          vec3 base = texture2D(tColor, vUv).rgb;
          float z = vz(vUv); float c = coc(z);
          vec3 acc = base; float ws = 1.0;
          if (c > 0.6) {
            for (int i = 1; i < 18; i++) {
              float fi = float(i); float r = sqrt(fi / 18.0) * c; float a = fi * 2.39996;
              vec2 off = vec2(cos(a), sin(a)) * r / uRes;
              float zs = vz(vUv + off); float cs = coc(zs);
              float w = smoothstep(r - 1.5, r + 0.5, zs >= z ? c : min(cs, c));
              acc += texture2D(tColor, vUv + off).rgb * w; ws += w;
            }
          }
          gl_FragColor = vec4(acc / ws, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tColor.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uNear.value = this.camera.near; u.uFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

class FilmPass extends Pass {
  constructor(w, h) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uCA: { value: 0 }, uGrain: { value: 0.05 }, uVig: { value: 0.35 },
        uFrame: { value: 0 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(w, h) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uCA, uGrain, uVig, uFrame, uFade; uniform vec2 uRes; uniform vec3 uTint; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 d = vUv - 0.5;
          float r = length(d * vec2(uRes.x / uRes.y, 1.0));
          vec2 ca = d * uCA * (0.25 + r);
          vec3 col = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
          col *= uTint;
          float v = smoothstep(0.95, 0.18, length(d * vec2(1.05, 0.82)) * 1.2);
          col *= mix(1.0, v, uVig);
          vec2 gp = gl_FragCoord.xy / 2.2 + vec2(uFrame * 37.13, uFrame * 91.71);
          float g = (vn(gp) - 0.5);
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col += g * uGrain * (1.2 - lum);
          col = mix(col, vec3(0.0), uFade);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

export function buildPost(renderer, scene, camera, W, H, { msaa = 4 } = {}) {
  const depthTexture = new THREE.DepthTexture(W, H);
  depthTexture.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: msaa, depthTexture, depthBuffer: true });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, camera);
  const dof = new DOFPass(camera, W, H);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.55, 0.92);
  const output = new OutputPass();
  const film = new FilmPass(W, H);
  composer.addPass(renderPass);
  composer.addPass(dof);
  composer.addPass(bloom);
  // bloom at half resolution (it is blurred anyway); keep the composer from resizing it back up
  bloom.setSize(W / 2, H / 2);
  bloom.setSize = () => {};
  composer.addPass(output);
  composer.addPass(film);
  return { composer, renderPass, dof, bloom, output, film };
}

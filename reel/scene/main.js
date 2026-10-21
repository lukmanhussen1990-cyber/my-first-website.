// Entry point for the frame-by-frame renderer. Exposes window.setup() and window.renderAt(t).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { buildStory } from './lib/story.js';
import { U } from './lib/materials.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const SS = +(params.get('ss') || 1);          // supersampling factor
const AO = params.get('ao') !== '0';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uAspect; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // gentle filmic grade: warm highlights, slightly cool shadows, a touch more saturation
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.1);
      col += vec3(0.025, 0.012, -0.01) * smoothstep(0.4, 1.0, l);
      col += vec3(-0.008, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.35, l));
      // soft vignette
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 1.25;
      float v = 1.0 - uVig * smoothstep(0.35, 1.05, length(p));
      col *= v;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      col = min(max(col, vec3(0.0)), vec3(24.0));
      gl_FragColor = vec4(col, 1.0); }`,
};

let renderer, composer, story, camera, scene, gtao;

window.setup = async () => {
  renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W * SS, H * SS, false);
  renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 300);
  story = await buildStory({ renderer, scene, camera });
  const rt = new THREE.WebGLRenderTarget(W * SS, H * SS, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W * SS, H * SS);
  composer.addPass(new RenderPass(scene, camera));
  if (AO) {
    gtao = new GTAOPass(scene, camera, Math.round(W * SS / 2), Math.round(H * SS / 2));
    gtao.overrideVisibility = function () { const cache = this._visibilityCache; this.scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (o.material && o.material.transparent)) o.visible = false; }); };
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
  }
  composer.addPass(new ShaderPass(SanitizeShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W * SS, H * SS), 0.5, 0.6, 1.35);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GradeShader));
  window.__bloom = bloom; window.__scene = scene;
  return { W, H, SS };
};

window.renderAt = (t) => {
  U.uTime.value = t;
  story.update(t);
  composer.render();
  return true;
};

// read back the frame as raw RGBA (bottom-up rows)
window.readFrame = () => {
  const gl = renderer.getContext();
  const w = W * SS, h = H * SS;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  return buf;
};

window.postFrame = async (url) => {
  const buf = window.readFrame();
  await fetch(url, { method: 'POST', body: buf });
  return true;
};
window.renderOnly = () => { composer.render(); return true; };

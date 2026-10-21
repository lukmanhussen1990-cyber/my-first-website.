// Entry point: renderer, post-processing and the per-frame render hook used by render.mjs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { Lighting } from './lighting.js';
import { U } from './shaders.js';
import { setAniso } from './textures.js';
import { Director } from './director.js';

const W = 1080, H = 1920, FPS = 30;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.07 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uVig, uSat; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;          // gentle S-curve
      vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.9;
      float v = smoothstep(1.25, 0.25, length(q));
      c *= mix(1.0 - uVig, 1.0, v);
      c += (h(vUv * uRes) - 0.5) / 255.0;                         // dither: no banding
      gl_FragColor = vec4(c, 1.0);
    }`,
};

async function loadFont() {
  try {
    const f = new FontFace('Fredoka', 'url(../assets/fonts/Fredoka-Bold.ttf)', { weight: '700' });
    await f.load(); document.fonts.add(f);
  } catch (e) { console.warn('font load failed', e); }
}

async function init() {
  const qs = new URLSearchParams(location.search);
  await loadFont();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = qs.get('shadow') === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 200);
  scene.add(camera);
  const t0 = performance.now();
  const world = buildWorld(scene);
  const light = new Lighting(scene, renderer, world);
  const director = new Director({ scene, camera, world, light, renderer });
  await director.ready;
  console.log('scene built in', ((performance.now() - t0) / 1000).toFixed(1), 's; grass tufts', world.grassCount);

  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: +(qs.get('msaa') ?? 4) });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  director.post = { bloom, grade };

  window.renderFrame = (frame) => {
    const t = frame / FPS;
    U.uTime.value = t;
    director.update(t);
    composer.render();
    const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // sync
    return true;
  };
  window.grabPNG = () => renderer.domElement.toDataURL('image/png');
  window.sceneInfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
  window.sceneReady = true;
}

init().catch((e) => { console.error('INIT ERROR', e.stack || e); window.sceneError = String(e.stack || e); });

// Entry point: renderer, post-processing and the per-frame API used by render.mjs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld, updateWorld } from './world.js';
import { Gorilla, Kid, Neighbor } from './characters.js';
import { buildProps } from './props.js';
import { buildFX, updateFX } from './fx.js';
import { direct, cameraAt } from './timeline.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920;
const AO = q.get('ao') !== '0';
const MSAA = q.get('msaa') === '0' ? 0 : 4;
const NOGRASS = q.get('grass') === '0', NOFUR = q.get('fur') === '0', NOSHADOW = q.get('shadow') === '0', NOBLOOM = q.get('bloom') === '0';

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, W / H, 0.1, 400);
const world = buildWorld(scene, renderer);
const gor = new Gorilla(); scene.add(gor.root);
const kid = new Kid(); scene.add(kid.root);
const nb = new Neighbor(); scene.add(nb.root);
const P = buildProps(scene, world);
const F = buildFX(scene);
const R = { W: world, P, F, gor, kid, nb };
if (NOGRASS) world.grass.visible = false;
if (NOFUR) scene.traverse((o) => { if (o.renderOrder >= 10 && o.renderOrder < 40) o.visible = false; });
if (NOSHADOW) renderer.shadowMap.enabled = false;

// objects the AO pre-pass should ignore (transparent / shader-animated)
const noAO = [world.grass, world.water.surf, world.water.face, F.puffMesh, F.glintMesh, F.dropMesh, F.crown, F.column, P.stream, P.line.g, P.puddle];
scene.traverse((o) => { if (o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide) noAO.push(o); });

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: MSAA });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (AO) {
  gtao = new GTAOPass(scene, camera, W, H);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 12 });
  const ov = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = function () {
    ov();
    for (const o of noAO) { o.visible = false; }
    scene.traverse((o) => { if (o.material && o.material.transparent && o.isMesh) o.visible = false; });
  };
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.55, 1.05);
if (!NOBLOOM) composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAspect; varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.1);                                  // richer colour
      c += vec3(0.018, 0.004, 0.03) * (1.0 - l) * (1.0 - l);     // cool-violet lift in the shadows
      c *= mix(vec3(1.0), vec3(1.03, 1.0, 0.96), smoothstep(0.4, 1.0, l)); // warm highlights
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 1.6;
      float v = smoothstep(1.15, 0.35, length(p));
      c *= mix(0.74, 1.0, v);
      c += (h12(gl_FragCoord.xy) - 0.5) / 255.0;                 // static dither against banding
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);

const camOverride = q.get('cam') ? q.get('cam').split(',').map(Number) : null;
function renderAt(t) {
  const s = direct(t, R);
  updateWorld(world, s, t);
  cameraAt(t, camera);
  if (camOverride) { camera.position.set(camOverride[0], camOverride[1], camOverride[2]); camera.fov = camOverride[6] || 30; camera.updateProjectionMatrix(); camera.lookAt(camOverride[3], camOverride[4], camOverride[5]); }
  updateFX(F, t, { hose: s.hose, extraPuffs: s.extraPuffs, light: 1 });
  scene.updateMatrixWorld(true);
  composer.render();
}

window.renderFrame = async (t, post) => {
  renderAt(t);
  if (!post) return true;
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const r = await fetch(post, { method: 'POST', body: px });
  return r.ok;
};
window.sceneInfo = () => ({ W, H, AO, renderer: (() => { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() });
renderAt(0);
window.sceneReady = true;

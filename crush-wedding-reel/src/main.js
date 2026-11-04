import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { Story } from './story.js';
import { Overlay } from './overlay.js';
import { setAniso } from './tex.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1080), H = +(qs.get('h') || 1920);
const quality = { shadow: +(qs.get('shadow') || 2048), msaa: +(qs.get('msaa') || 4) };

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1500);
const world = buildWorld(scene, quality);

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1 }, vign: { value: 0.3 }, tint: { value: new THREE.Vector3(1, 1, 1) }, contrast: { value: 1 }, exposure: { value: 1 }, lift: { value: 0 }, aspect: { value: W / H } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vign, contrast, exposure, lift, aspect; uniform vec3 tint; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    vec3 col = c.rgb * exposure * tint;
    float l = dot(col, vec3(0.2126,0.7152,0.0722));
    col = mix(vec3(l), col, sat);
    col = (col - 0.18) * contrast + 0.18;
    col = max(col, 0.0) + lift;
    vec2 d = (vUv - 0.5) * vec2(aspect, 1.0) * 1.9;
    float v = smoothstep(1.25, 0.35, length(d));
    col *= mix(1.0, v, vign);
    gl_FragColor = vec4(col, c.a);
  }`,
};

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: quality.msaa });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.55, 0.8);
composer.addPass(bloom);
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
composer.addPass(new OutputPass());

const ov = document.getElementById('ov');
ov.style.width = W + 'px'; ov.style.height = H + 'px';
const overlay = new Overlay(ov, W, H);
const story = new Story(world, scene, camera, renderer, { bloom, grade, overlay, W, H });

const font = new FontFace('Pixelify Sans', 'url(./fonts/PixelifySans-Bold.ttf)', { weight: '700' });
await font.load(); document.fonts.add(font);

window.renderAt = (t) => {
  overlay.begin();
  story.apply(t);
  composer.render();
  story.overlayItems(t);
  overlay.draw(t, story.captionAt(t));
  const gl = renderer.getContext(); gl.finish();
  return story.shotIndex;
};
// warm up: compile shaders and upload textures for every shot
for (const s of story.shots) { story.apply(Math.min(s.t0 + 0.01, 34.4)); renderer.compile(scene, camera); }
window.ready = true;

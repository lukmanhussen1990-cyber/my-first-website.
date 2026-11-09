// Render engine: builds the worlds, runs the post-processing chain and composites the 2D overlay.
// The page exposes window.setup(timeline) and window.renderFrame(t) for the headless renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildRoom, buildYard } from './sets.js';
import { createDirector } from './director.js';
import * as OV from './overlay.js';

let W = 1080, H = 1920, SC = 1;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, warmth: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float warmth; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(0.75, 1.0);
      float v = smoothstep(0.78, 0.18, length(d));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 1.0, 0.9), warmth);
      c.rgb = (c.rgb - 0.5) * 1.04 + 0.5;
      float n = fract(sin(dot(vUv * vec2(1080.0, 1920.0) + time * 13.0, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.016;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
    }`,
};

let S = null;

async function loadFonts() {
  const base = '/node_modules/@fontsource/fredoka/files/';
  const faces = [
    new FontFace('Fredoka', `url(${base}fredoka-latin-700-normal.woff2)`, { weight: '700' }),
    new FontFace('Fredoka', `url(${base}fredoka-latin-600-normal.woff2)`, { weight: '600' }),
  ];
  for (const f of faces) { await f.load(); document.fonts.add(f); }
}

window.setup = async (timeline, opts = {}) => {
  await loadFonts();
  SC = opts.scale || 1; W = Math.round(1080 * SC); H = Math.round(1920 * SC);
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.03, 900);
  const room = buildRoom(renderer);
  const yard = buildYard(renderer);
  const director = createDirector({ renderer, camera, room, yard, timeline });

  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(room.scene, camera);
  const gtao = new GTAOPass(room.scene, camera, W, H);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 10 });
  const bokeh = new BokehPass(room.scene, camera, { focus: 2.0, aperture: 0.0, maxblur: 0.009 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.32, 0.55, 0.88);
  const output = new OutputPass();
  const grade = new ShaderPass(GradeShader);
  composer.addPass(renderPass); composer.addPass(gtao); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(output); composer.addPass(grade);

  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d');
  const chunks = OV.buildChunks(timeline.words, g);
  S = { renderer, camera, room, yard, director, composer, renderPass, gtao, bokeh, bloom, grade, out, g, chunks, timeline };
  window.__events = director.events;
  window.__shots = director.shots.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1 }));
  return { events: director.events, shots: window.__shots, duration: director.duration };
};

const v3 = new THREE.Vector3();
function toScreen(p) {
  v3.copy(p).project(S.camera);
  return { x: (v3.x + 1) / 2 * 1080, y: (1 - v3.y) / 2 * 1920, behind: v3.z > 1 };
}

function configure(ctx, t) {
  const scene = ctx.world === 'yard' ? S.yard.scene : S.room.scene;
  S.renderPass.scene = scene; S.gtao.scene = scene; S.bokeh.scene = scene;
  S.bokeh.enabled = !!ctx.dof;
  if (ctx.dof) {
    S.bokeh.uniforms.focus.value = ctx.dof.focus;
    S.bokeh.uniforms.aperture.value = ctx.dof.aperture;
    S.bokeh.uniforms.maxblur.value = ctx.dof.maxblur ?? 0.009;
  }
  S.gtao.enabled = ctx.ao !== false;
  S.bloom.strength = ctx.bloom ?? 0.32;
  S.renderer.toneMappingExposure = ctx.exposure ?? 1.0;
  S.grade.uniforms.time.value = t;
  S.grade.uniforms.warmth.value = ctx.warmth ?? 0.0;
  S.grade.uniforms.vignette.value = ctx.vignette ?? 0.32;
}

window.renderFrame = (t, opts = {}) => {
  const { director, composer, g, out } = S;
  let ctx = director.apply(t);
  const n = opts.noBlur ? 1 : Math.max(1, ctx.mb || 1);
  const shutter = (ctx.shutter ?? 0.55) / 30;
  for (let s = 0; s < n; s++) {
    if (n > 1) ctx = director.apply(t + (s / (n - 1) - 0.5) * shutter);
    configure(ctx, t);
    composer.render();
    g.globalAlpha = 1 / (s + 1);
    g.drawImage(S.renderer.domElement, 0, 0);
  }
  g.globalAlpha = 1;
  if (n > 1) ctx = director.apply(t);
  drawOverlay(t, ctx);
  if (opts.raw) return null;
  return out.toDataURL(opts.type || 'image/jpeg', opts.quality ?? 0.93);
};

function drawOverlay(t, ctx) {
  const g = S.g;
  g.setTransform(SC, 0, 0, SC, 0, 0);
  OV.drawSpeedLines(g, t, ctx.speedLines || 0, 3);
  for (const h of ctx.hearts || []) {
    const p = toScreen(h.pos);
    if (!p.behind) OV.drawHeart(g, p.x + h.dx, p.y + h.dy, h.size, h.alpha, h.rot);
  }
  for (const s of ctx.sparkles2d || []) {
    const p = s.pos ? toScreen(s.pos) : s;
    OV.drawSparkle(g, p.x + (s.dx || 0), p.y + (s.dy || 0), s.size, s.alpha);
  }
  OV.drawFlash(g, ctx.flash || 0);
  for (const pop of S.director.pops) OV.drawPop(g, pop, t);
  OV.drawCaptions(g, t, S.timeline.words, S.chunks);
  OV.drawWatermark(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

window.__ready = true;

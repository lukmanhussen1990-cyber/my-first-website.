// Engine: builds the world once, then renders any time t as a pure function of t (frames can render out of order).
// Per frame:  set.reset(t) -> cast.reset(t) -> animals.reset(t) -> fx.reset(t)      (defaults / idle / continuity)
//             shot.update(ctx)                                                       (the shot overrides things)
//             camera -> set.commit -> cast.commit -> animals.commit -> fx.commit     (apply to meshes)
//             render + post overlay (vignette / dim / flash / tint / grey)
import * as THREE from 'three';
import { clamp, v3, shakeOffset, handheld } from './lib.js';
import { PLAN, shotAt } from './plan.js';
import { FPS, DURATION, W as WIDTH, H as HEIGHT } from './layout.js';

const params = new URLSearchParams(location.search);
// ?use=set,cast  -> only these modules load for real, the others use web/stubs/ (default: all).
// A module that fails to load falls back to its stub and the error is printed (the page still renders).
const USE = params.get('use') ? params.get('use').split(',') : null;
async function load(name, stub) {
  if (USE && !USE.includes(name)) return import(stub);
  try { return await import(`./${name}.js`); }
  catch (e) { console.error(`[log] module ${name}.js failed to load: ${e.message}`); return import(stub); }
}
// caption/badge font (Pixelify Sans) must be ready before modules draw text into canvases
try { await document.fonts.load('700 64px "Pixelify Sans"'); } catch (e) { console.error('[log] font load failed', e.message); }

const SHOT_FILES = ['shots_a', 'shots_b', 'shots_c'];
const [mSet, mCast, mAnimals, mFx, ...mShots] = await Promise.all([
  load('set', './stubs/set.js'), load('cast', './stubs/cast.js'), load('animals', './stubs/animals.js'), load('fx', './stubs/fx.js'),
  ...SHOT_FILES.map((f) => load(f, './stubs/shots.js')),
]);
const SHOTS = Object.assign({}, ...mShots.map((m) => m.shots));
// ?test=name -> web/tests/name.js exports update(ctx), called every frame INSTEAD of the shot (module previews)
const TEST = params.get('test');
const mTest = TEST ? await import(`./tests/${TEST}.js`) : null;
const scale = Number(params.get('scale') || 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(Math.round(WIDTH * scale), Math.round(HEIGHT * scale));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.05, 400);
scene.add(camera);

// ---- post overlay drawn on top of the frame (alpha-blended full-screen quad)
//   vignette 0..1, dim 0..1 (black), flash 0..1 (flashColor), tint 0..1 (tintColor, e.g. green stink fog),
//   grey 0..1 (flat grey wash = colours drained)
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { vignette: { value: 0 }, dim: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) },
    tint: { value: 0 }, tintColor: { value: new THREE.Color(0.45, 0.75, 0.2) }, grey: { value: 0 }, aspect: { value: WIDTH / HEIGHT } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float vignette, dim, flash, tint, grey, aspect; uniform vec3 flashColor, tintColor;
    void main(){ vec2 p = vUv - 0.5; p.x *= aspect; float r = length(p) / 0.62;
      float v = smoothstep(0.45, 1.15, r) * vignette;
      // layer: grey wash, then tint (stronger at the edges), then black (vignette + dim), then flash
      vec4 c = vec4(vec3(0.5), grey * 0.55);
      float ta = tint * (0.55 + 0.45 * smoothstep(0.2, 1.1, r));
      c.rgb = mix(c.rgb, tintColor, ta / max(c.a + ta, 1e-4)); c.a = c.a + ta * (1.0 - c.a);
      float k = clamp(v + dim, 0.0, 1.0);
      c.rgb = mix(c.rgb, vec3(0.0), k / max(c.a + k, 1e-4)); c.a = c.a + k * (1.0 - c.a);
      c.rgb = mix(c.rgb, flashColor, flash / max(c.a + flash, 1e-4)); c.a = c.a + flash * (1.0 - c.a);
      gl_FragColor = vec4(c.rgb, clamp(c.a, 0.0, 1.0)); }`,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

// ---- the world (each module owns its file; see CONTRACTS.md)
const world = { THREE, scene, camera, renderer };
world.set = mSet.buildSet(world);
world.cast = mCast.buildCast(world);
world.animals = mAnimals.buildAnimals(world);
world.fx = mFx.buildFX(world);

// ---- voice timing helpers for shots
let VO = null, WORDS = null;
async function loadTiming() {
  VO = await (await fetch('../audio/vo_lines.json')).json();
  try { WORDS = await (await fetch('../audio/voiceover.words.json')).json(); } catch (e) { WORDS = null; }
}

// ---- camera controller used by shots
function makeCam() {
  return {
    spec: { pos: [0, 1.5, 4], target: [0, 1.2, 0], fov: 40, roll: 0 },
    shakeAmp: 0, shakeFreq: 18, punchK: 1, hand: 0.0025,
    set(s) { this.spec = { ...this.spec, ...s }; return this; },
    shake(amp, freq = 18) { this.shakeAmp += amp; this.shakeFreq = freq; return this; },
    punch(k) { this.punchK *= k; return this; },          // k > 1 zooms in (fov / k)
    handheld(a) { this.hand = a; return this; },
  };
}

function applyCamera(ctx) {
  const c = ctx.cam, s = c.spec;
  const pos = v3(s.pos), target = v3(s.target);
  if (c.shakeAmp > 0) { const o = shakeOffset(ctx.t, c.shakeAmp, c.shakeFreq); pos.add(o); target.add(o.multiplyScalar(0.5)); }
  camera.position.copy(pos);
  camera.up.set(...(s.up || [0, 1, 0]));
  camera.lookAt(target);
  const h = handheld(ctx.t, c.hand);
  camera.rotateY(h.yaw); camera.rotateX(h.pitch); camera.rotateZ(h.roll + (s.roll || 0));
  camera.fov = clamp((s.fov || 40) / c.punchK, 3, 110);
  camera.near = s.near ?? 0.05;
  camera.far = s.far ?? 400;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function makeCtx(t) {
  const shot = shotAt(t);
  const dur = shot.t1 - shot.t0, lt = t - shot.t0;
  return {
    t, lt, dur, u: clamp(lt / dur), shot, W: world, THREE, camera,
    cam: makeCam(),
    scene,
    post: { vignette: 0, dim: 0, flash: 0, flashColor: [1, 1, 1], tint: 0, tintColor: [0.45, 0.75, 0.2], grey: 0 },
    line: (i) => VO.lines[i - 1],          // voice line i (1-based): {start, end, text}
    word: (i) => (WORDS ? WORDS[i] : null), // word i (0-based) {w, s, e, line}
    ev: (name) => shot.events?.[name],      // event time(s) from plan.js
  };
}

function renderAt(t, camOverride = null) {
  const ctx = makeCtx(t);
  world.set.reset(t, ctx);
  world.cast.reset(t, ctx);
  world.animals.reset(t, ctx);
  world.fx.reset(t, ctx);
  const impl = SHOTS[ctx.shot.id];
  if (mTest) mTest.update(ctx); else if (impl) impl.update(ctx);
  if (camOverride) { ctx.cam.set(camOverride); ctx.cam.shakeAmp = 0; ctx.cam.punchK = 1; ctx.cam.hand = 0; Object.assign(ctx.post, { vignette: 0, dim: 0, flash: 0, tint: 0, grey: 0 }); }
  applyCamera(ctx);                 // camera first: billboards + face-camera logic need it
  world.set.commit(ctx);
  world.cast.commit(ctx);
  world.animals.commit(ctx);
  world.fx.commit(ctx);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(ctx.scene, camera);
  const p = ctx.post;
  if (p.vignette > 0 || p.dim > 0 || p.flash > 0 || p.tint > 0 || p.grey > 0) {
    const u = postMat.uniforms;
    u.vignette.value = p.vignette; u.dim.value = p.dim; u.flash.value = p.flash; u.flashColor.value.setRGB(...p.flashColor);
    u.tint.value = p.tint; u.tintColor.value.setRGB(...p.tintColor); u.grey.value = p.grey;
    renderer.clearDepth();
    renderer.render(postScene, postCam);
  }
  return ctx;
}

const grab = () => renderer.domElement.toDataURL('image/jpeg', 0.94);

// ---- automatic glitch audit: camera inside things / too close to a surface, characters inside colliders
const ray = new THREE.Raycaster();
function audit(t) {
  const ctx = renderAt(t);
  const issues = [];
  const cp = camera.position.clone();
  for (const c of world.set.colliders || []) if (c.box.containsPoint(cp)) issues.push(`camera inside ${c.name}`);
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]];
  let nearest = 9;
  for (const d of dirs) {
    ray.set(cp, v3(d).normalize()); ray.far = 0.5; ray.camera = camera;
    const hit = ray.intersectObjects(ctx.scene.children, true).find((h) => h.object.visible && h.object.isMesh && !h.object.userData.noAudit && !(h.object.material && h.object.material.transparent));
    if (hit) nearest = Math.min(nearest, hit.distance);
  }
  if (nearest < 0.03) issues.push(`camera only ${nearest.toFixed(3)} m from a surface (may be inside something)`);
  const chars = [...(world.cast.characters || []), ...(world.animals.characters || [])];
  const pv = new THREE.Vector3();
  for (const ch of chars) {
    if (!ch.root || !ch.root.visible) continue;
    ch.root.updateMatrixWorld(true);
    const counts = {};
    ch.root.traverse((m) => {
      if (!m.isMesh || !m.visible || m.userData.noAudit) return;
      const pos = m.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 60));
      for (let i = 0; i < pos.count; i += step) {
        pv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        for (const c of world.set.colliders || []) {
          if (c.allow && c.allow.includes(ch.name)) continue;
          if (c.box.containsPoint(pv)) { const k = `${m.name || 'part'} in ${c.name}`; counts[k] = (counts[k] || 0) + 1; }
        }
      }
    });
    for (const [k, n] of Object.entries(counts)) issues.push(`${ch.name}: ${n} pts of ${k}`);
  }
  return { t, shot: ctx.shot.id, camera: cp.toArray().map((v) => +v.toFixed(3)), nearest: +nearest.toFixed(3), issues };
}

window.WORLD = world;
window.APP = {
  frameCount: () => Math.round(DURATION * FPS),
  renderFrame: (f) => { renderAt(f / FPS); return grab(); },
  renderTime: (t) => { renderAt(t); return grab(); },
  renderView: (t, camSpec) => { renderAt(t, camSpec); return grab(); },   // time t with a camera override {pos,target,fov}
  audit,
  plan: () => PLAN.map(({ id, t0, t1, say }) => ({ id, t0, t1, say })),
};

loadTiming().then(() => { window.APP_READY = true; }).catch((e) => { console.error('timing load failed', e); window.APP_READY = true; });

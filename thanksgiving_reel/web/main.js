// Engine: builds the world once, then renders any time t as a pure function of t.
// Per frame:  set.reset(t) -> cast.reset(t) -> fx.reset(t) -> xray.reset(t)   (defaults / idle)
//             shot.update(ctx)                                                (the shot overrides things)
//             set.commit(ctx) -> cast.commit(ctx) -> fx.commit(ctx) -> xray.commit(ctx)  (apply to meshes)
//             camera controller -> render (+ post overlay: dim / vignette / flash)
import * as THREE from 'three';
import { clamp, lerp, v3, shakeOffset, handheld, deg } from './lib.js';
import { PLAN, shotAt } from './plan.js';
import { FPS, DURATION, W as WIDTH, H as HEIGHT, ROOM } from './layout.js';

const params = new URLSearchParams(location.search);
// ?use=set,characters  -> only these modules are loaded for real, the rest use web/stubs/ (default: all).
// Lets one module be tested while another is still being written. A module that fails to load falls back
// to its stub and the error is printed (so the page still renders).
const USE = params.get('use') ? params.get('use').split(',') : null;
async function load(name, stub) {
  if (USE && !USE.includes(name)) return import(stub);
  try { return await import(`./${name}.js`); }
  catch (e) { console.error(`[log] module ${name}.js failed to load: ${e.message}`); return import(stub); }
}
const [mSet, mCast, mFx, mXray, mA, mB, mC] = await Promise.all([
  load('set', './stubs/set.js'), load('characters', './stubs/characters.js'), load('fx', './stubs/fx.js'), load('xray', './stubs/xray.js'),
  load('shots_a', './stubs/shots.js'), load('shots_b', './stubs/shots.js'), load('shots_c', './stubs/shots.js'),
]);
const SHOTS = { ...mA.shots, ...mB.shots, ...mC.shots };
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
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.03, 60);
scene.add(camera);

// ---- post overlay (dim, vignette, colour flash) drawn on top of the frame
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { vignette: { value: 0 }, dim: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) }, aspect: { value: WIDTH / HEIGHT } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float vignette, dim, flash, aspect; uniform vec3 flashColor;
    void main(){ vec2 p = vUv - 0.5; p.x *= aspect; float r = length(p) / 0.62;
      float v = smoothstep(0.45, 1.15, r) * vignette; float a = clamp(v + dim, 0.0, 1.0);
      vec3 col = mix(vec3(0.0), flashColor, flash / max(a + flash, 1e-4));
      gl_FragColor = vec4(col, clamp(a + flash, 0.0, 1.0)); }`,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

// ---- the world (each module owns its file; see CONTRACTS.md)
const world = { THREE, scene, camera, renderer };
world.set = mSet.buildSet(world);
world.cast = mCast.buildCast(world);
world.fx = mFx.buildFX(world);
world.xray = mXray.buildXray(world);

// ---- voice timing helpers for shots
let VO = null, WORDS = null;
async function loadTiming() {
  VO = await (await fetch('../audio/vo_lines.json')).json();
  try { WORDS = await (await fetch('../audio/words_aligned.json')).json(); } catch (e) { WORDS = null; }
}

// ---- camera controller used by shots
function makeCam() {
  return {
    spec: { pos: [0, 1.4, 3], target: [0, 1, 0], fov: 40, roll: 0 },
    shakeAmp: 0, shakeFreq: 18, punchK: 1, hand: 0.0025, dutch: 0,
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
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  const h = handheld(ctx.t, c.hand);
  camera.rotateY(h.yaw); camera.rotateX(h.pitch); camera.rotateZ(h.roll + (s.roll || 0));
  camera.fov = clamp((s.fov || 40) / c.punchK, 5, 110);
  camera.near = s.near ?? 0.03;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function makeCtx(t) {
  const shot = shotAt(t);
  const dur = shot.t1 - shot.t0, lt = t - shot.t0;
  return {
    t, lt, dur, u: clamp(lt / dur), shot, W: world, THREE, camera,
    cam: makeCam(),
    scene,                   // shots may set ctx.scene = world.xray.scene
    post: { vignette: 0, dim: 0, flash: 0, flashColor: [1, 1, 1] },
    line: (i) => VO.lines[i - 1],          // voice line i (1-based): {start, end, text, who}
    word: (i) => (WORDS ? WORDS[i] : null), // aligned word i (0-based) {w, s, e, line}
    ev: (name) => shot.events?.[name],      // event time(s) from plan.js
  };
}

function renderAt(t, camOverride = null) {
  const ctx = makeCtx(t);
  world.set.reset(t, ctx);
  world.cast.reset(t, ctx);
  world.fx.reset(t, ctx);
  world.xray.reset(t, ctx);
  const impl = SHOTS[ctx.shot.id];
  if (impl) impl.update(ctx);
  if (camOverride) { ctx.cam.set(camOverride); ctx.cam.shakeAmp = 0; ctx.cam.punchK = 1; ctx.cam.hand = 0; ctx.post.vignette = 0; ctx.post.dim = 0; }
  applyCamera(ctx);                 // camera first: fx billboards + face-camera logic need it
  world.set.commit(ctx);
  world.cast.commit(ctx);
  world.fx.commit(ctx);
  world.xray.commit(ctx);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(ctx.scene, camera);
  const p = ctx.post;
  if (p.vignette > 0 || p.dim > 0 || p.flash > 0) {
    postMat.uniforms.vignette.value = p.vignette; postMat.uniforms.dim.value = p.dim;
    postMat.uniforms.flash.value = p.flash; postMat.uniforms.flashColor.value.setRGB(...p.flashColor);
    renderer.clearDepth();
    renderer.render(postScene, postCam);
  }
  return ctx;
}

const grab = () => renderer.domElement.toDataURL('image/jpeg', 0.94);

// ---- automatic glitch audit: camera inside things, body parts inside furniture/walls
const ray = new THREE.Raycaster();
function audit(t) {
  const ctx = renderAt(t);
  const issues = [];
  const cp = camera.position.clone();
  if (ctx.scene === scene) {
    if (cp.x < ROOM.minX + 0.05 || cp.x > ROOM.maxX - 0.05 || cp.z < ROOM.minZ + 0.05 || cp.z > ROOM.maxZ - 0.05 || cp.y < 0.05 || cp.y > ROOM.height - 0.05)
      issues.push(`camera outside room at ${cp.toArray().map((v) => v.toFixed(2))}`);
    for (const c of world.set.colliders || []) if (c.box.containsPoint(cp)) issues.push(`camera inside ${c.name}`);
  }
  // nearest surface around the camera (14 directions)
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]];
  let nearest = 9;
  for (const d of dirs) {
    ray.set(cp, v3(d).normalize()); ray.far = 0.5;
    const hit = ray.intersectObjects(ctx.scene.children, true).find((h) => h.object.visible && h.object.isMesh && !h.object.userData.noAudit);
    if (hit) nearest = Math.min(nearest, hit.distance);
  }
  if (nearest < 0.04) issues.push(`camera only ${nearest.toFixed(3)} m from a surface (may be inside something)`);
  // character vertices inside colliders
  if (ctx.scene === scene && world.cast.characters) {
    const pv = new THREE.Vector3();
    for (const ch of world.cast.characters) {
      if (!ch.root.visible) continue;
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
  }
  return { t, shot: ctx.shot.id, camera: cp.toArray().map((v) => +v.toFixed(3)), nearest: +nearest.toFixed(3), issues };
}

window.APP = {
  frameCount: () => Math.round(DURATION * FPS),
  renderFrame: (f) => { renderAt(f / FPS); return grab(); },
  renderTime: (t) => { renderAt(t); return grab(); },
  // render time t but with a camera override {pos,target,fov} (for inspecting the set / poses)
  renderView: (t, camSpec) => { renderAt(t, camSpec); return grab(); },
  audit,
  plan: () => PLAN.map(({ id, t0, t1, say }) => ({ id, t0, t1, say })),
};

loadTiming().then(() => { window.APP_READY = true; }).catch((e) => { console.error('timing load failed', e); window.APP_READY = true; });

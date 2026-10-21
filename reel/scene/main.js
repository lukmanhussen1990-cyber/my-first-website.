// Renderer, lighting, post-processing and the frame-by-frame render API used by tools/render.mjs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { buildWorld, groundH } from './world.js';
import { Director, tauOf, tOfTau, EVENTS, FPS, DURATION } from './timeline.js';

const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, W / H, 0.3, 4000);

// ---------------------------------------------------------------- golden-hour sky
const SUN_DIR = new THREE.Vector3(-0.78, 0.17, 0.6).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR }, glowDir: { value: new THREE.Vector3(-0.85, 0.06, -0.52).normalize() } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 sunDir; uniform vec3 glowDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.07; a*=0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float e = d.y;
      vec3 zenith = vec3(0.08, 0.12, 0.34);
      vec3 upper  = vec3(0.26, 0.28, 0.60);
      vec3 mid    = vec3(0.92, 0.46, 0.46);
      vec3 horiz  = vec3(1.35, 0.66, 0.30);
      vec3 col = mix(horiz, mid, smoothstep(0.0, 0.10, e));
      col = mix(col, upper, smoothstep(0.05, 0.28, e));
      col = mix(col, zenith, smoothstep(0.35, 0.95, e));
      // warm glow where the sun sets (left of frame) and the direct sun
      float g = max(dot(d, glowDir), 0.0);
      col += vec3(1.6, 0.75, 0.32) * pow(g, 6.0) * (1.0 - smoothstep(0.0, 0.5, e)) * 0.55;
      col += vec3(1.2, 0.55, 0.25) * pow(g, 32.0) * 0.7;
      float s = max(dot(d, sunDir), 0.0);
      col += vec3(2.2, 1.3, 0.7) * pow(s, 400.0) * 6.0 + vec3(1.0, 0.6, 0.3) * pow(s, 24.0) * 0.6;
      // stylised clouds
      vec2 uv = d.xz / (e + 0.12) * 1.3;
      float c = fbm(uv * 0.9 + vec2(3.1, 1.7));
      float band = smoothstep(0.03, 0.12, e) * (1.0 - smoothstep(0.22, 0.5, e));
      float cl = smoothstep(0.52, 0.72, c) * band;
      vec3 cloudCol = mix(vec3(1.25, 0.62, 0.55), vec3(1.7, 0.95, 0.55), pow(g, 2.0));
      cloudCol = mix(cloudCol, vec3(0.62, 0.46, 0.62), smoothstep(0.62, 0.8, c) * 0.5);
      col = mix(col, cloudCol, cl * 0.85);
      // below horizon: warm haze
      col = mix(col, vec3(0.62, 0.40, 0.36), smoothstep(0.0, -0.08, e));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 64, 32), skyMat);
sky.renderOrder = 1000; sky.frustumCulled = false;
scene.add(sky);
scene.fog = new THREE.Fog(0xe4a487, 300, 2600);

// environment (reflections / IBL) from the sky + a warm ground hemisphere
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), skyMat));
  const groundEnv = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: 0x4a3f3d }));
  groundEnv.rotation.x = -Math.PI / 2; groundEnv.position.y = -3; envScene.add(groundEnv);
  // a few bright warm "windows" so chrome has something to sparkle with
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.4), side: THREE.DoubleSide })); const a = i / 6 * Math.PI * 2; b.position.set(Math.cos(a) * 120, 8, Math.sin(a) * 120); b.lookAt(0, 8, 0); envScene.add(b); }
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.55;
}

// lights
const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.66, 0.4), 4.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const SH = 16;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 140 });
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(new THREE.Color(0.5, 0.56, 0.92), new THREE.Color(0.58, 0.4, 0.32), 0.45);
scene.add(hemi);
// soft warm bounce from the side opposite the sun


// ---------------------------------------------------------------- world + director
const world = buildWorld(scene);
const director = new Director({ scene, camera, world });

// ---------------------------------------------------------------- post-processing
const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: true };
const msRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, samples: 4 });
const msRT2 = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, samples: 2 });
const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
const accMat = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: null }, weight: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tSrc; uniform float weight; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, weight); }',
  depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
});
const accQuad = new FullScreenQuad(accMat);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1); composer.setSize(W, H);
// first pass: bring the accumulated HDR image in
const copyIn = new ShaderPass({
  uniforms: { tAcc: { value: accRT.texture }, tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tAcc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tAcc, vUv).rgb, 1.0); }',
});
copyIn.needsSwap = true;
copyIn.uniforms.tAcc.value = accRT.texture;
composer.addPass(copyIn);
const gtao = new GTAOPass(scene, camera, W, H);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 0.85;
gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 10, distanceFallOff: 1.0, screenSpaceRadius: false });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
composer.addPass(gtao);
gtao.setSize(Math.round(W / 2), Math.round(H / 2));
const maskRT = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), { depthBuffer: false });
const maskMat = new THREE.ShaderMaterial({
  uniforms: { tDepth: { value: null }, res: { value: new THREE.Vector2(Math.round(W / 2), Math.round(H / 2)) }, cNear: { value: 0.3 }, cFar: { value: 4000 } },
  vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}',
  fragmentShader: `uniform sampler2D tDepth; uniform vec2 res; uniform float cNear; uniform float cFar;
    float lin(float d){ return cNear * cFar / (cFar - d * (cFar - cNear)); }
    void main(){ float sd = texture2D(tDepth, gl_FragCoord.xy / res).x; if (lin(gl_FragCoord.z) > lin(sd) + 0.25) discard; gl_FragColor = vec4(1.0); }`,
  side: THREE.DoubleSide, depthTest: false, depthWrite: false,
});
const mblur = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, tMask: { value: maskRT.texture }, useMask: { value: 1 }, projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
    vpPrev: { value: new THREE.Matrix4() }, vpNext: { value: new THREE.Matrix4() }, strength: { value: 1.0 }, maxLen: { value: 0.09 }, aspect: { value: W / H }, dbg: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tMask; uniform float useMask; uniform mat4 projInv; uniform mat4 camWorld; uniform mat4 vpPrev; uniform mat4 vpNext; uniform float strength; uniform float maxLen; uniform float dbg; varying vec2 vUv;
    vec3 worldAt(vec2 uv, float d){ vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; return (camWorld * v).xyz; }
    vec2 proj(mat4 m, vec3 p){ vec4 c = m * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
    void main(){
      float d = texture2D(tDepth, vUv).x;
      vec3 wp = worldAt(vUv, d);
      vec2 vel = (proj(vpNext, wp) - proj(vpPrev, wp)) * strength;
      float L = length(vel);
      if (L > maxLen) vel *= maxLen / L;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (dbg > 0.5) { gl_FragColor = vec4(texture2D(tMask, vUv).r, length(vel) * 20.0, d > 0.99999 ? 1.0 : 0.0, 1.0); return; }
      if (useMask > 0.5 && texture2D(tMask, vUv).r > 0.5) { gl_FragColor = vec4(c, 1.0); return; }
      if (length(vel * vec2(${W}.0, ${H}.0)) < 1.0) { gl_FragColor = vec4(c, 1.0); return; }
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = 0; i < 20; i++) {
        float f = (float(i) + 0.5) / 20.0 - 0.5;
        vec2 uv = vUv + vel * f;
        float sd = texture2D(tDepth, uv).x;
        // don't smear nearer (foreground) things onto what is behind them
        float w = (sd < d - 0.0004) ? 0.0 : 1.0;
        if (useMask > 0.5 && texture2D(tMask, uv).r > 0.5) w = 0.0;
        acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
      }
      gl_FragColor = vec4(wsum > 0.0 ? acc / wsum : c, 1.0);
    }`,
});
composer.addPass(mblur);
mblur.uniforms.tMask.value = maskRT.texture;
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.45, 0.55, 1.4);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, aspect: { value: W / H }, vig: { value: 0.32 }, warm: { value: new THREE.Vector3(1.05, 1.0, 0.94) }, sat: { value: 1.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float aspect; uniform float vig; uniform vec3 warm; uniform float sat; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * warm;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, sat), 0.0);
      float sh = 1.0 - smoothstep(0.0, 0.35, l), hi = smoothstep(0.4, 1.6, l);
      c *= mix(vec3(1.0), vec3(0.88, 0.94, 1.12), sh * 0.55);
      c *= mix(vec3(1.0), vec3(1.08, 1.0, 0.88), hi * 0.5);
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * 1.15;
      float v = 1.0 - vig * smoothstep(0.25, 0.85, length(p));
      gl_FragColor = vec4(c * v, 1.0);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- frame rendering
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const proj = new THREE.Vector3();
function screenOf(p) { proj.copy(p).project(camera); return [(proj.x * 0.5 + 0.5) * W, (1 - (proj.y * 0.5 + 0.5)) * H]; }

function setShadowFocus(focus) {
  const f = focus.clone();
  const d = SUN_DIR.clone();
  const texel = (2 * SH) / 4096;
  // snap the light position to texel increments in light space to avoid shimmering
  const lightPos = f.clone().addScaledVector(d, 60);
  sun.position.copy(lightPos); sun.target.position.copy(f);
  sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
  sun.shadow.camera.updateMatrixWorld();
  const m = new THREE.Matrix4().lookAt(lightPos, f, new THREE.Vector3(0, 1, 0));
  const inv = m.clone().invert();
  const ls = f.clone().applyMatrix4(inv);
  ls.x = Math.round(ls.x / texel) * texel; ls.y = Math.round(ls.y / texel) * texel;
  const snapped = ls.applyMatrix4(m);
  const delta = snapped.sub(f);
  sun.position.add(delta); sun.target.position.add(delta);
  sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
}

// estimate on-screen motion over the shutter to choose the sample count
function motionPixels(t, shutter) {
  const pts = [];
  const probe = (tt) => {
    director.update(tauOf(tt), tt);
    scene.updateMatrixWorld(true);
    const st = director.state;
    const P = [st.cartPos.clone().add(new THREE.Vector3(0, 0.5, 0)), director.john.head.getWorldPosition(new THREE.Vector3())];
    // background reference points along the camera view
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    for (const [dist, off] of [[25, 3], [25, -3], [8, 1.5]]) P.push(camera.position.clone().addScaledVector(fwd, dist).addScaledVector(right, off));
    return P;
  };
  const a = probe(t - shutter / 2), aS = a.map((p) => screenOf(p));
  // keep world positions of a's background points, project with camera at b
  const b = probe(t + shutter / 2), bS = b.map((p) => screenOf(p));
  const aInB = a.map((p) => screenOf(p));
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = (i < 2 ? bS[i][0] - aS[i][0] : aInB[i][0] - aS[i][0]), dy = (i < 2 ? bS[i][1] - aS[i][1] : aInB[i][1] - aS[i][1]);
    m = Math.max(m, Math.hypot(dx, dy));
  }
  return m;
}

function renderFrame(frame, opts = {}) {
  const t = frame / FPS;
  const shutter = (opts.shutter ?? 0.5) / FPS;
  let N = opts.samples;
  if (!N) { const m = motionPixels(t, shutter); N = Math.max(opts.minSamples ?? 1, Math.min(opts.maxSamples ?? 14, Math.ceil(m / 3.0))); }
  const rt = N >= 4 ? msRT2 : msRT;
  for (let i = 0; i < N; i++) {
    const ti = N === 1 ? t : t + ((i + 0.5) / N - 0.5) * shutter;
    director.update(tauOf(ti), ti);
    setShadowFocus(director.state.focus || director.state.cartPos);
    const jx = N === 1 ? 0 : halton(i + 1, 2) - 0.5, jy = N === 1 ? 0 : halton(i + 1, 3) - 0.5;
    camera.setViewOffset(W, H, jx, jy, W, H);
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (i === 0);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    // accumulate
    accMat.uniforms.tSrc.value = rt.texture;
    accMat.uniforms.weight.value = 1 / N;
    renderer.setRenderTarget(accRT);
    if (i === 0) { renderer.setClearColor(0x000000, 0); renderer.clear(); }
    accQuad.render(renderer);
  }
  camera.clearViewOffset();
  renderer.shadowMap.autoUpdate = true;
  // camera matrices at the shutter open/close for the reprojection motion blur
  const vpAt = (tt) => { director.update(tauOf(tt), tt); camera.updateMatrixWorld(); return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); };
  const useMB = opts.mblur !== false && N === 1;
  mblur.enabled = useMB;
  if (useMB) { mblur.uniforms.vpPrev.value.copy(vpAt(t - shutter / 2)); mblur.uniforms.vpNext.value.copy(vpAt(t + shutter / 2)); }
  // centre time state for AO
  director.update(tauOf(t), t);
  camera.updateMatrixWorld();
  mblur.uniforms.projInv.value.copy(camera.projectionMatrixInverse); mblur.uniforms.camWorld.value.copy(camera.matrixWorld);
  mblur.uniforms.tDepth.value = gtao.depthTexture;
  setShadowFocus(director.state.focus || director.state.cartPos);
  const hidden = [];
  for (const g of director.fxGroups) { if (g.visible) { hidden.push(g); g.visible = false; } }
  scene.traverse((o) => { if (o.isSprite && o.visible) { hidden.push(o); o.visible = false; } });
  sky.visible = false;
  gtao.enabled = opts.ao !== false;
  // composer: the GTAO pass renders its own G-buffer from the scene (fx hidden)
  renderer.setRenderTarget(null);
  mblur.uniforms.useMask.value = director.state.whip ? 0 : 1;
  mblur.uniforms.dbg.value = opts.dbg ? 1 : 0;
  // G-buffer once (shared by AO, the motion-blur mask and the blur itself)
  if (gtao.enabled) {
    gtao.overrideVisibility(); gtao.renderOverride(renderer, gtao.normalMaterial, gtao.normalRenderTarget, 0x7777ff, 1.0); gtao.restoreVisibility();
    gtao._renderGBuffer = false;
  }
  if (useMB) {
    for (const g of hidden) if (!g.isSprite) g.visible = true;   // fx count as dynamic in the mask
    maskMat.uniforms.tDepth.value = gtao.depthTexture;
    const prevOv = scene.overrideMaterial; scene.overrideMaterial = maskMat;
    camera.layers.set(1);
    renderer.setRenderTarget(maskRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    camera.layers.set(0); scene.overrideMaterial = prevOv;
    for (const g of hidden) g.visible = false;
    renderer.setRenderTarget(null);
  }
  composer.render();
  gtao._renderGBuffer = true;
  for (const g of hidden) g.visible = true;
  sky.visible = true;
  return { N, tau: tauOf(t) };
}

window.renderFrame = renderFrame;
window.profileHide = (tau) => { const d = director; d.update(tau, tOfTau(tau)); setShadowFocus(d.state.focus); const gl = renderer.getContext(); const px = new Uint8Array(4); const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t = () => { sync(); const t0 = performance.now(); renderer.setRenderTarget(msRT); renderer.render(scene, camera); sync(); return Math.round(performance.now() - t0); }; t(); const a = t(); world.cars.forEach(c => c.obj.visible = false); const b = t(); world.cars.forEach(c => c.obj.visible = true); renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); t(); const c = t(); renderer.shadowMap.enabled = true; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); return JSON.stringify({ all: a, noCars: b, noShadows: c, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); };
window.profile = (tau) => {
  const gl = renderer.getContext(); const px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  director.update(tau, tOfTau(tau)); setShadowFocus(director.state.focus);
  const res = {};
  const time = (name, fn) => { sync(); const t0 = performance.now(); fn(); sync(); res[name] = Math.round(performance.now() - t0); };
  renderer.shadowMap.autoUpdate = true;
  time('ms4', () => { renderer.setRenderTarget(msRT); renderer.render(scene, camera); });
  time('ms4b', () => { renderer.setRenderTarget(msRT); renderer.render(scene, camera); });
  time('ms2', () => { renderer.setRenderTarget(msRT2); renderer.render(scene, camera); });
  renderer.shadowMap.autoUpdate = false;
  time('ms4_noShadowUpdate', () => { renderer.setRenderTarget(msRT); renderer.render(scene, camera); });
  time('ms2_noShadowUpdate', () => { renderer.setRenderTarget(msRT2); renderer.render(scene, camera); });
  renderer.shadowMap.autoUpdate = true;
  time('composer_ao', () => { gtao.enabled = true; renderer.setRenderTarget(null); composer.render(); });
  time('composer_noao', () => { gtao.enabled = false; renderer.setRenderTarget(null); composer.render(); });
  time('grab', () => { renderer.domElement.toDataURL('image/png'); });
  return JSON.stringify(res);
};
// debug: render the scene at story time tau from an arbitrary camera
window.renderCustom = ({ tau, pos, target, fov = 30, ao = false, rel = true }) => {
  director.update(tau, tOfTau(tau));
  if (rel) { pos = [pos[0], pos[1] + groundH(pos[0], Math.min(pos[2], 0)), pos[2]]; target = [target[0], target[1] + groundH(target[0], Math.min(target[2], 0)), target[2]]; }
  camera.position.set(...pos); camera.up.set(0, 1, 0); camera.lookAt(...target); camera.fov = fov; camera.updateProjectionMatrix();
  setShadowFocus(new THREE.Vector3(...target));
  renderer.setRenderTarget(msRT); renderer.render(scene, camera);
  accMat.uniforms.tSrc.value = msRT.texture; accMat.uniforms.weight.value = 1;
  renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 0); renderer.clear(); accQuad.render(renderer);
  gtao.enabled = ao; renderer.setRenderTarget(null); composer.render();
  return true;
};
window.getTracks = () => {
  const out = [];
  const dtau = (t) => (tauOf(t + 0.005) - tauOf(t - 0.005)) / 0.01;
  for (let f = 0; f <= DURATION * FPS; f++) {
    const t = f / FPS, tau = tauOf(t), k = dtau(t);
    director.update(tau, t);
    const st = director.state;
    out.push({ t: +t.toFixed(4), tau: +tau.toFixed(4), speed: +(Math.abs(st.speed) * k).toFixed(3), blower: +(st.blower || 0).toFixed(3) * (director.blower.visible ? 1 : 0),
      rival: tau > 43.25 ? +(2.4 * k).toFixed(3) : 0, push: tau > 52.5 && tau < 54.8 ? +((2.45 / 2.3) * 1.5 * Math.sin(Math.PI * Math.min(1, (tau - 52.5) / 2.3)) * k).toFixed(3) : 0, slow: +k.toFixed(3) });
  }
  return out;
};
window.getEvents = () => EVENTS.map(([name, tau]) => ({ name, tau, t: +tOfTau(tau).toFixed(4) }));
window.timing = { tauOf, tOfTau, FPS, DURATION };
window.grab = () => renderer.domElement.toDataURL('image/png');
window.__dir = director; window.__THREE = THREE;
window.ready = true;

// Entry point. Exposes window.ready (assets loaded) and window.renderFrame(t),
// which renders the frame for time t (seconds) without reading any clock.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildCharacters, setPhone } from './characters.js';
import { buildPost } from './post.js';
import { UI } from './ui.js';
import { direct, railBounce } from './shots.js';
import { noise1, fbm1, hash1, clamp } from './util.js';

const W = 1080;
const H = 1920;
const PHONE_HAND = new THREE.Vector3(-0.835, 1.02, -1.02);
const PHONE_CHEST = new THREE.Vector3(-0.8, 0.676, -0.8);

async function loadFonts() {
  const faces = [
    new FontFace('Anton', 'url(/assets/fonts/Anton-Regular.ttf)'),
    new FontFace('Inter', 'url(/assets/fonts/Inter.ttf)', { weight: '100 900' }),
  ];
  for (const f of faces) {
    await f.load();
    document.fonts.add(f);
  }
  await document.fonts.ready;
}

async function init() {
  await loadFonts();
  const tl = await (await fetch('/src/timeline.json', { cache: 'no-store' })).json();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const fog = new THREE.FogExp2(0x0a1322, 0.045);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 140);
  const world = buildWorld(scene);
  world.coach.add(camera);
  const chars = buildCharacters(world.coach);
  const ui = new UI(W, H);
  const q = new URLSearchParams(location.search);
  const quality = { scale: Number(q.get('scale') || 0.75), samples: Number(q.get('msaa') ?? 4) };
  const post = buildPost(renderer, scene, camera, W, H, ui.tex, ui.maskTex, quality);
  // benchmarking switches (?shadow=pcf|basic, ?nodof=1, ?nobloom=1)
  if (q.get('shadow') === 'pcf') renderer.shadowMap.type = THREE.PCFShadowMap;
  if (q.get('shadow') === 'basic') renderer.shadowMap.type = THREE.BasicShadowMap;
  if (q.get('nodof')) post.sceneDof.blurScale = 0;
  if (q.get('nobloom')) post.bloom.enabled = false;

  const m4 = new THREE.Matrix4();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const twistOffsets = chars.sleepers.map((_, i) => ((i * 7) % 5) * 0.06);

  function apply(st, t) {
    // train sway: lateral roll, slow pitch, rail-joint bounce
    const roll = 0.0055 * Math.sin(t * 2 * Math.PI * 0.27) + 0.0028 * Math.sin(t * 2 * Math.PI * 0.61 + 1.3) + 0.0014 * fbm1(t * 1.7, 4);
    world.coach.rotation.set(roll, 0, 0.0012 * Math.sin(t * 2 * Math.PI * 0.19));
    world.coach.position.y = railBounce(t, tl.rail);
    // only the lights a shot needs (each configuration compiles once, then is cached)
    scene.fog = st.fog ? fog : null;
    world.lamps[1].visible = world.lamps[2].visible = !!st.farLamps;
    world.update(t, {
      sway: roll / 0.006,
      shadowFocus: v1.set(...st.shadow.focus),
      shadowSize: st.shadow.size,
      ...st.lights,
    });

    // the woman
    const wmn = st.woman;
    chars.woman.visible = wmn.lying;
    chars.woman.userData.feet.rotation.set(0.04 * (wmn.feetTwitch || 0), 0, 0.03 * (wmn.feetTwitch || 0));
    chars.woman.userData.hairMat.userData.uTime.value = t;
    chars.standing.visible = !!wmn.standing;
    if (wmn.standing) {
      chars.standing.position.set(...wmn.standing.pos);
      chars.standing.rotation.set(wmn.standing.lean * 0.35, wmn.standing.rotY, 0, 'YXZ');
      chars.standing.userData.head.rotation.x = 0.7 + wmn.standing.lean * 0.3;
      chars.standing.userData.hairMat.userData.uTime.value = t;
    }
    chars.face.visible = !!wmn.face;
    if (wmn.face) {
      const f = wmn.face;
      chars.face.position.set(...f.pos);
      m4.lookAt(new THREE.Vector3(...f.look), chars.face.position, new THREE.Vector3(...f.up).normalize());
      chars.face.quaternion.setFromRotationMatrix(m4);
      chars.face.userData.pupil.scale.setScalar(f.pupil);
      chars.face.userData.hairMat.userData.uTime.value = t;
      chars.face.userData.hairMat.userData.uAmp.value = f.hairAmp;
      chars.face.userData.veil.visible = !!f.veil;
    }
    chars.hand.visible = !!wmn.hand;
    if (wmn.hand) {
      chars.hand.position.set(...wmn.hand.pos);
      chars.hand.rotation.set(...wmn.hand.rot);
    }

    // camera
    const c = st.cam;
    const pos = v2.set(...c.pos);
    pos.y += st.breath * 0.0028 * Math.sin(t * 2 * Math.PI * 0.23);
    pos.x += 0.0018 * noise1(t * 0.6, 11);
    const look = v3.set(...c.look);
    if (c.lookAtEye && wmn.face) {
      chars.face.updateMatrix();
      look.copy(chars.face.userData.eye.position).applyMatrix4(chars.face.matrix).add(new THREE.Vector3(...(c.eyeOffset || [0, 0, 0])));
    }
    look.x += 0.006 * noise1(t * 0.35, 12);
    look.y += 0.006 * noise1(t * 0.31, 13);
    const sc = st.scare;
    if (sc > 0.001) {
      pos.x += sc * 0.012 * noise1(t * 38, 1);
      pos.y += sc * 0.012 * noise1(t * 41, 2);
      pos.z += sc * 0.008 * noise1(t * 36, 3);
    }
    camera.position.copy(pos);
    m4.lookAt(pos, look, new THREE.Vector3(...c.up).normalize());
    camera.quaternion.setFromRotationMatrix(m4);
    camera.rotateZ((c.roll || 0) + sc * 0.022 * noise1(t * 33, 4) + 0.0025 * noise1(t * 0.5, 7));
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
    const dof = post.sceneDof.uniforms;
    dof.focus.value = c.focus;
    dof.aperture.value = c.aperture;
    dof.maxBlur.value = c.maxBlur * post.sceneDof.blurScale;

    // phone
    const ph = chars.phone;
    const p = st.phone;
    const jitter = p.buzz ? 0.0016 : 0;
    const fr = Math.round(t * 30);
    const jx = (hash1(fr * 1.3) - 0.5) * 2 * jitter;
    const jy = (hash1(fr * 2.7 + 5) - 0.5) * 2 * jitter;
    if (p.mode === 'hand') {
      ph.position.copy(PHONE_HAND).add(new THREE.Vector3(jx, jy, 0.002 * Math.sin(t * 1.1)));
      m4.lookAt(camera.position, ph.position, new THREE.Vector3(0, 0, -1));
      ph.quaternion.setFromRotationMatrix(m4);
      ph.rotateZ(0.06 + 0.01 * Math.sin(t * 0.8));
    } else {
      ph.position.copy(PHONE_CHEST).add(new THREE.Vector3(jx, 0, jy));
      ph.rotation.set(-Math.PI / 2, 0, 0.18 + Math.PI); // top toward your feet: readable from your eyes
    }
    setPhone(ph, p);
    ph.userData.light.visible = ph.userData.glow.visible = p.on > 0.001;
    ph.userData.light.castShadow = !!p.shadow;
    chars.mats.yourSkin.emissive.setRGB(0.16 * p.on, 0.075 * p.on, 0.035 * p.on);
    chars.yourHand.visible = p.hand;

    // the twist: every sleeper's feet rotate around the leg axis
    chars.sleepers.forEach((s, i) => {
      const k = clamp((st.twist * 1.25 - twistOffsets[i]) / 1.0);
      const e = k * k * (3 - 2 * k);
      for (const f of s.userData.feet) f.rotation.z = f.userData.base + e * Math.PI + (e > 0 && e < 1 ? 0.03 * noise1(t * 20, i) : 0);
    });

    // post
    const fu = post.final.u;
    fu.frame.value = fr;
    fu.grain.value = st.post.grain;
    fu.vignette.value = st.post.vignette;
    fu.fade.value = st.post.fade;
    fu.ca.value = sc;
    fu.lidGap.value = st.lids.gap;
    fu.lidCenter.value = st.lids.center;
    fu.lidGlow.value = st.lids.glow;
    fu.lidBlur.value = st.lids.blur;
    post.bloom.strength = st.post.bloom;
    renderer.toneMappingExposure = st.post.exposure;
  }

  window.renderFrame = (t) => {
    const st = direct(t, tl);
    if (window.__debug?.noLids) st.lids.gap = 2;
    apply(st, t);
    const glass = ui.draw(t, tl, st.sceneIndex);
    post.final.u.useBlur.value = glass || st.lids.blur > 0 ? 1 : 0;
    post.final.u.glassOn.value = glass ? 1 : 0;
    post.composer.render();
    renderer.getContext().finish();
    return { scene: st.scene.id, bounds: ui.bounds };
  };
  window.timeline = tl;
  window.__three = { renderer, scene, camera, world, chars, post };
  return { frames: tl.frames, fps: tl.fps, duration: tl.duration, gl: renderer.getContext().getParameter(renderer.getContext().VERSION) };
}

window.ready = init();

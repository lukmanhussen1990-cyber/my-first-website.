import * as THREE from 'three';
import { buildTextures, buildIcons, TEX } from './lib/pixel.js';
import { buildWorld } from './lib/world.js';
import { Person, Dog, makePhoto } from './lib/characters.js';
import { FX } from './lib/fx.js';
import { Overlay } from './lib/overlay.js';
import { Director } from './director.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920;

await document.fonts.load('32px "Press Start 2P"');
buildTextures();
buildIcons();
const timeline = await (await fetch(q.get('timeline') || '/build/timeline.json')).json();

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c140e);
scene.fog = new THREE.Fog(0x2a1d12, 10, 24);
const camera = new THREE.PerspectiveCamera(45, W / H, 0.03, 60);

const world = buildWorld(scene);

const cast = {
  you: new Person({ skin: 0xd8a074, shirt: TEX.purple, shirtFront: TEX.purpleFront, pants: TEX.jeans, shoes: 0x4a2c1a,
    hair: 'styled', hairColor: 0x3b2414, beard: true, beardColor: 0x6a4428, ring: true, seed: 4, collar: 0x5e2f82 }),
  husband: new Person({ skin: 0xe2ab84, shirt: TEX.vest, pants: TEX.sweat, shoes: 0x2b2b2b, vest: true, bald: true,
    mustache: 'huge', mustacheColor: 0x2a1a10, browColor: 0x3a2a1c, tired: true, scale: 1.15, seed: 9 }),
  officer: new Person({ skin: 0xc48a5e, shirt: TEX.navy, shirtFront: TEX.navyFront, pants: TEX.navyPants, shoes: 0x111111,
    hair: 'buzz', hairColor: 0x1a1410, mustache: 'big', mustacheColor: 0x151010, browColor: 0x151010, cap: true, epaulettes: true, scale: 1.03, seed: 15 }),
  prisoner: new Person({ skin: 0xb98663, shirt: TEX.stripes, pants: TEX.stripes, shoes: 0x555555, longSleeves: true,
    hair: 'buzz', hairColor: 0x221a14, stubble: true, browColor: 0x221a14, scale: 0.98, seed: 21 }),
  dog: new Dog(),
  photo: makePhoto(),
};
for (const k of ['you', 'husband', 'officer', 'prisoner', 'dog']) scene.add(cast[k].root);
scene.add(cast.photo);
// the officer's pen
cast.pen = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.16, 0.018), new THREE.MeshStandardMaterial({ color: 0x1d3f9a, roughness: 0.5 }));
cast.pen.position.set(0, -0.13, 0.03);
cast.pen.rotation.x = 0.5;
cast.officer.arm.R.hand.add(cast.pen);

const fx = new FX(scene);
const overlay = new Overlay(W, H);
const director = new Director({ camera, world, cast, fx, timeline });

const out = document.createElement('canvas');
out.width = W; out.height = H;
const g = out.getContext('2d');
document.body.appendChild(out);

function composite(t, st) {
  const k = W / 1080;
  const sx = st.shake[0] * k, sy = st.shake[1] * k;
  g.save();
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // screen shake: draw the 3D frame slightly enlarged and offset
  const z = st.shakeAmt > 0 ? 1.03 : 1;
  g.filter = st.sat < 1 ? `saturate(${st.sat}) contrast(1.08)` : 'none';
  g.drawImage(renderer.domElement, (W - W * z) / 2 + sx, (H - H * z) / 2 + sy, W * z, H * z);
  g.filter = 'none';
  g.restore();
  // warm grade + vignette
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(255,175,95,0.12)';
  g.fillRect(0, 0, W, H);
  g.restore();
  overlay.vignette(g, st.vignette);
  if (st.speed > 0) overlay.speedLines(g, t, st.speed);
  if (st.streaks) { overlay.motionStreaks(g, W * 0.2, H * 0.36, t, { dir: st.streaks.dir, n: 4 }); overlay.motionStreaks(g, W * 0.82, H * 0.72, t, { dir: st.streaks.dir, n: 4 }); }
  for (const h of st.hearts2D) overlay.heart2D(g, h.x * W, h.y * H, h.size * W, h.alpha, h.rot);
  for (const w of director.sfxWords(t)) overlay.sfxWord(g, w, t);
  const cap = timeline.captions.find(c => t >= c.s && t < c.hide);
  if (cap) overlay.caption(g, cap, t, [sx * 0.6, sy * 0.6]);
  overlay.fill(g, '#ffffff', st.flash);
  overlay.fill(g, '#000000', st.fade);
}

window.renderFrame = (t, quality = 0.92) => {
  const st = director.update(t);
  renderer.render(scene, camera);
  composite(t, st);
  return quality ? out.toDataURL('image/jpeg', quality) : null;
};
window.renderDebug = (t, pos, look, fov = 40) => {
  const st = director.update(t);
  camera.position.set(...pos); camera.lookAt(new THREE.Vector3(...look)); camera.fov = fov; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  composite(t, st);
  return out.toDataURL('image/jpeg', 0.9);
};
window.sceneInfo = (t) => { const c = director.ctxFor(t); const def = director.defs[c.id]; return { id: c.id, shot: director.schedule(def, c) }; };
window.sfxEvents = () => director.events.map(e => ({ t: e.t, type: e.type, gain: e.gain || 0.5, dur: e.dur || 0 }));
window.TIMELINE = timeline;
window.READY = true;

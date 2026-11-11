import * as THREE from './three.module.js';
import { W, H, FPS, noise } from './util.js';
import { Char } from './rig.js';
import { buildOffice, buildCorner, buildFlash, makePlug, makeFlashlight, makeKeys, makeCup, makePapers, gradTex, DH } from './sets.js';
import { mat, ico, box, heartMesh, glowSprite, basic, facet } from './lowpoly.js';
import { makePost } from './post.js';
import { Overlay } from './overlay.js';
import { buildShots, makePhotos } from './shots.js';

await document.fonts.load('100px LG'); await document.fonts.load('600 40px FR');
const data = await (await fetch('data.json')).json();

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 400);
scene.add(camera);

// lights
const hemi = new THREE.HemisphereLight('#ffffff', '#b89a78', 1.2); scene.add(hemi);
const key = new THREE.DirectionalLight('#fff3e2', 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.1, far: 20 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015; key.shadow.radius = 3;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight('#dbe9ff', 0.8); scene.add(fill); scene.add(fill.target);
const pt1 = new THREE.PointLight('#ffffff', 0, 3, 1.5); scene.add(pt1);
const pt2 = new THREE.PointLight('#ffffff', 0, 3, 1.5); scene.add(pt2);
const pt3 = new THREE.PointLight('#ffffff', 0, 3, 1.5); scene.add(pt3);
const spot = new THREE.SpotLight('#fff1c4', 0, 4, 0.36, 0.55, 1.2); spot.castShadow = false; scene.add(spot); scene.add(spot.target);

// sets
const office = buildOffice(); scene.add(office.G);
const corner = buildCorner(); scene.add(corner.G);
const flash = buildFlash(); scene.add(flash.G);

// characters
const chars = { you: new Char('you'), boss: new Char('boss'), cw1: new Char('cw1'), cw2: new Char('cw2'),
  k1: new Char('kid1'), k2: new Char('kid2'), k3: new Char('kid3') };
for (const k in chars) scene.add(chars[k].root);

// props attached to rigs
const plug = makePlug(); plug.rotation.x = -Math.PI / 2; plug.position.set(0, -0.118, 0.025); chars.you.wr.R.add(plug);
const torch = makeFlashlight(); chars.boss.head.add(torch);
torch.position.copy(chars.boss.mouthG.position); torch.position.z += 0.06; torch.quaternion.copy(chars.boss.mouthG.quaternion);
const torchFloor = makeFlashlight(); scene.add(torchFloor);
const keysProp = makeKeys(); keysProp.position.set(0, -0.11, 0.03); chars.boss.wr.L.add(keysProp);
const keyGlow = glowSprite('#ffd36b', 0.5, 0.9); keysProp.add(keyGlow);
const cup = makeCup(); cup.position.set(0, -0.09, 0.03); cup.rotation.x = -Math.PI / 2; chars.cw2.wr.L.add(cup);
const papers = makePapers(8); papers.position.set(0.0, -0.08, 0.06); papers.rotation.x = -Math.PI / 2 + 0.15; chars.cw1.wr.R.add(papers);
// beam cone
const beamGeo = new THREE.ConeGeometry(0.16, 1, 10, 1, true); beamGeo.translate(0, -0.5, 0); beamGeo.rotateX(-Math.PI / 2);
const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fff2c0', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(beam);
const wallPool = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), new THREE.MeshBasicMaterial({ color: '#fff0b8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(wallPool);

// pools
const smoke = [];
for (let i = 0; i < 26; i++) { const m = ico(0.07, 0, '#b9b5bd', { transparent: true, opacity: 0.8, unique: true, cast: false, depthWrite: false }); m.visible = false; scene.add(m); smoke.push(m); }
const drops = [];
for (let i = 0; i < 26; i++) { const m = ico(0.006, 0, '#5b3518', { cast: false }); m.visible = false; scene.add(m); drops.push(m); }
const sheets = [];
for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ color: '#fbfbf7', side: THREE.DoubleSide, roughness: 0.8 })); m.castShadow = true; m.visible = false; scene.add(m); sheets.push(m); }
const hearts3 = [];
for (let i = 0; i < 10; i++) { const h = heartMesh(0.035 + 0.02 * (i % 3) / 2, i % 2 ? '#ff4f8b' : '#ff7aa8'); h.castShadow = false; h.visible = false; scene.add(h); hearts3.push(h); }
const CONF = 260;
const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.05), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF);
const confCols = ['#ffd23f', '#ff4f8b', '#3bceac', '#4d8cff', '#ff8c42', '#ffffff', '#b06cff'];
for (let i = 0; i < CONF; i++) confetti.setColorAt(i, new THREE.Color(confCols[i % confCols.length]));
confetti.visible = false; scene.add(confetti);

const post = makePost(W, H);
const ov = new Overlay(document.getElementById('ov'));
const bg = {
  office: new THREE.Color('#dfe6ea'),
  dusk: gradTex([[0, '#1e2a5a'], [0.35, '#6a4a8c'], [0.62, '#e2787a'], [0.8, '#f7b066'], [1, '#ffd89a']]),
  dream: gradTex([[0, '#7f6bff'], [0.5, '#ff8fc8'], [1, '#ffbf94']]),
  dark: new THREE.Color('#050508'),
};

const ctx = { THREE, renderer, scene, camera, hemi, key, fill, pt1, pt2, pt3, spot, office, corner, flash, chars, plug, torch, torchFloor,
  keysProp, keyGlow, cup, papers, beam, wallPool, smoke, drops, sheets, hearts3, confetti, post, ov, bg, data, DH };
makePhotos(ctx);
const shots = buildShots(ctx);

function reset() {
  for (const k in chars) { chars[k].root.visible = false; chars[k].setXray(false); }
  office.G.visible = corner.G.visible = flash.G.visible = false;
  scene.background = bg.office; scene.fog = null;
  hemi.intensity = 1.35; hemi.color.set('#ffffff'); hemi.groundColor.set('#c9b090');
  key.intensity = 2.4; key.color.set('#fff3e2'); key.castShadow = true;
  fill.intensity = 0.8; fill.color.set('#dbe9ff');
  for (const p of [pt1, pt2, pt3]) { p.intensity = 0; p.distance = 3; }
  spot.intensity = 0;
  torch.visible = false; torchFloor.visible = false; keysProp.visible = false; cup.visible = false; papers.visible = false; plug.visible = false;
  beam.visible = false; wallPool.visible = false;
  smoke.forEach(m => m.visible = false); drops.forEach(m => m.visible = false); sheets.forEach(m => m.visible = false);
  hearts3.forEach(m => m.visible = false); confetti.visible = false;
  office.refs.wallStuff.forEach(o => o.visible = true); office.refs.cables.forEach(o => o.visible = true); office.refs.charger.visible = true;
  office.refs.desk.position.set(0, 0, 0); office.refs.desk.rotation.set(0, 0, 0);
  const mug = office.refs.mug; mug.position.set(0.52, DH + 0.001, -0.9); mug.rotation.set(0, 0, 0);
  office.refs.pens.forEach(pen => { pen.position.set(...pen.userData.home); pen.rotation.set(0, 0, 0); });
  corner.refs.sign.rotation.set(0, 0, 0);
  const u = post.u;
  u.uSwirl.value = 0; u.uFlash.value = 0; u.uFlashCol.value.set(1, 1, 1); u.uVig.value = 0.32; u.uGrain.value = 0.03; u.uCA.value = 0;
  u.uSat.value = 1.2; u.uTint.value.set(1, 1, 1); u.uXray.value = 0; u.uExp.value = 1.3; u.uContrast.value = 1.04; u.uLift.value = 0;
  u.uDark.value = 0; u.uZoomBlur.value = 0; u.uDream.value = 0;
  ov.clear();
}

window.renderFrame = (f) => {
  f = Number(f);
  const t = f / FPS;
  reset();
  post.u.uTime.value = t;
  let shot = shots[0];
  for (const s of shots) if (t >= s.t0) shot = s;
  if (t > 1.6 && ctx.pensFallen) ctx.pensFallen();
  shot.run(t, t - shot.t0, ctx);
  renderer.setRenderTarget(post.rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
  if (shot.after) shot.after(t, t - shot.t0, ctx);
  ov.caption(t);
  return shot.name;
};
window.__ctx = ctx; window.ready = true;
window.debugPos = (f) => {
  window.renderFrame(f);
  const o = {};
  const r3 = v => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  for (const k in chars) if (chars[k].root.visible) {
    const c = chars[k]; const g = (x) => r3(x.getWorldPosition(new THREE.Vector3()));
    o[k] = { head: g(c.head), chest: g(c.chest), hips: g(c.hips), handR: g(c.wr.R), handL: g(c.wr.L), knee: g(c.knee.L), ankle: g(c.ankle.L) };
  }
  o.cam = r3(camera.position);
  return JSON.stringify(o);
};

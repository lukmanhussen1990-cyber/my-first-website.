import * as THREE from 'three';
import { buildTextures, buildIcons } from './lib/pixel.js';
import { DT, buildDogTextures, buildDogIcons } from './lib/dtex.js';
import { buildSets } from './lib/sets.js';
import { Person, mat, bx, mesh, faceted } from './lib/chars.js';
import { Dog } from './lib/dog.js';
import { FX } from './lib/fx.js';
import { Overlay } from './lib/overlay.js';
import { Director } from './director.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920;
await document.fonts.load('32px "Press Start 2P"');
buildTextures(); buildIcons();
buildDogTextures(); buildDogIcons();
const timeline = await (await fetch(q.get('timeline') || '/build/timeline.json')).json();

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d14);
const camera = new THREE.PerspectiveCamera(45, W / H, 0.03, 200);
const world = buildSets(scene);

const P = (o) => new Person(o);
const cast = {
  you: P({ skin: 0xe8b38a, shirt: DT.hoodie, shirtFront: DT.hoodieFront, pants: DT.jeans, shoes: 0xf4f4f4, hair: 'styled', hairColor: 0x4a2e1a, hood: DT.hoodie, seed: 4 }),
  mom: P({ skin: 0xeab894, shirt: DT.momDress, shirtFront: DT.momFront, pants: DT.momDress, hair: 'bun', hairColor: 0x7a5a3a, lashes: true, lipstick: 0xc8526a, apron: DT.apron, shoes: 0x7a4a6a, seed: 8 }),
  dad: P({ skin: 0xe2a882, shirt: DT.dadSweater, shirtFront: DT.dadFront, pants: DT.dadPants, hair: 'short', hairColor: 0x4a3020, glasses: 0x1e1e1e, mustache: true, mustacheColor: 0x3a2416, wide: 1.1, seed: 10 }),
  sis: P({ skin: 0xeeb994, shirt: DT.sisTop, shirtFront: DT.sisFront, pants: DT.leggings, hair: 'long', hairColor: 0x5a3418, lashes: true, blush: true, shortSleeves: true, scale: 0.94, shoes: 0xffffff, seed: 12 }),
  walkers: [
    P({ skin: 0xc68a5c, shirt: DT.walkers[0], pants: 0x2a2a30, hair: 'short', hairColor: 0x111111, seed: 30 }),
    P({ skin: 0xf1c9a5, shirt: DT.walkers[1], pants: DT.walkers[1], skirt: DT.walkers[1], skirtBottom: 0.45, hair: 'long', hairColor: 0xc9a24a, lashes: true, seed: 31 }),
    P({ skin: 0xa86f48, shirt: DT.walkers[2], pants: 0x3a3a46, hair: 'curly', hairColor: 0x1a1a1a, seed: 32 }),
    P({ skin: 0xf4d2b4, shirt: DT.walkers[3], pants: 0x5a4a3a, hair: 'sides', hairColor: 0xdedede, bald: true, glasses: 0x333333, seed: 33 }),
    P({ skin: 0xe0ab84, shirt: DT.walkers[4], pants: 0x2a2a30, hair: 'bun', hairColor: 0x3a2416, lashes: true, seed: 34 }),
    P({ skin: 0x8a5a3c, shirt: DT.walkers[5], pants: 0x1c2740, hair: 'short', hairColor: 0x2a1a10, mustache: true, seed: 35 }),
  ],
};
cast.dog = new Dog();
const all = [cast.you, cast.mom, cast.dad, cast.sis, ...cast.walkers];
all.forEach(p => scene.add(p.root));
scene.add(cast.dog.root);
cast.all = all;

// ---------------------------------------------------------------- props
const props = {};
function collarModel() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.32, metalness: 0.65, flatShading: true });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x3dff6a });
  const band = mesh(new THREE.TorusGeometry(0.12, 0.028, 6, 16), metal); g.add(band);
  for (const z of [0.012, -0.012]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.008, 4, 24), ledMat); s.position.z = z; g.add(s); }
  const dev = bx(0.085, 0.04, 0.07, metal, false); dev.position.set(0, -0.14, 0); g.add(dev);
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10), ledMat); led.position.set(0, -0.163, 0); g.add(led);
  g.userData = { ledMat, led };
  return g;
}
{ // the shiny box with the collar inside (lid hinged at the back)
  const g = new THREE.Group();
  const side = mat(DT.boxSide), top = mat(DT.boxTop), white = mat(0xffffff);
  const BW = 0.42, BH = 0.2, BD = 0.32;
  const sideW = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, 0.012), side); sideW.position.set(0, BH / 2, BD / 2); g.add(sideW);
  const back = sideW.clone(); back.position.z = -BD / 2; back.rotation.y = Math.PI; g.add(back);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.012, BH, BD), top); w.position.set(s * BW / 2, BH / 2, 0); g.add(w); }
  const floor = bx(BW, 0.012, BD, white, false); floor.position.y = 0.006; g.add(floor);
  const cushion = mesh(faceted(0.13, 410, [1.4, 0.35, 1.0], 1, 0.06), mat(0xd94a6a)); cushion.position.y = 0.08; g.add(cushion);
  const lid = new THREE.Group(); lid.position.set(0, BH, -BD / 2); g.add(lid);
  const lt = bx(BW + 0.03, 0.03, BD + 0.03, top); lt.position.set(0, 0.015, BD / 2); lid.add(lt);
  const bowA = mesh(faceted(0.05, 411, [1.6, 0.6, 0.8], 0), mat(0xffffff)); bowA.position.set(0, 0.05, BD / 2); lid.add(bowA);
  const collar = collarModel(); collar.position.set(0, 0.15, 0); collar.rotation.x = -1.1; g.add(collar);
  g.userData = { lid, collar };
  props.box = g;
}
props.collar = collarModel();   // the collar in YOU's hands when it goes on
{ // phone
  const g = new THREE.Group();
  g.add(bx(0.08, 0.16, 0.014, mat(0x1d1f24)));
  const sm = new THREE.MeshBasicMaterial({ map: DT.phoneRec });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.14), sm); s.position.z = 0.0075; g.add(s);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.155), mat(0xff9ec2)); back.position.z = -0.0075; back.rotation.y = Math.PI; g.add(back);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.009, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); lens.position.set(-0.022, 0.06, -0.008); lens.rotation.y = Math.PI; g.add(lens);
  g.userData = { sm };
  props.phone = g;
}
{ // dad's fork with a meatball
  const g = new THREE.Group();
  const steel = mat(0xc8ccd4, { metalness: 0.6, roughness: 0.3 });
  const h = bx(0.016, 0.006, 0.17, steel); h.position.z = -0.06; g.add(h);
  for (let k = -1.5; k <= 1.5; k++) { const t = bx(0.004, 0.005, 0.05, steel); t.position.set(k * 0.007, 0, 0.045); g.add(t); }
  const mb = mesh(faceted(0.032, 98, [1, 0.95, 1], 0, 0.15), mat(0x6a3a1e)); mb.position.set(0, 0.012, 0.05); g.add(mb);
  const sauce = mesh(faceted(0.02, 99, [1.4, 0.5, 1.2], 0, 0.2), mat(0xc8321e)); sauce.position.set(0, 0.04, 0.05); g.add(sauce);
  props.fork = g;
}
{ // mom's spoon
  const g = new THREE.Group();
  const steel = mat(0xc8ccd4, { metalness: 0.6, roughness: 0.3 });
  const h = bx(0.016, 0.006, 0.15, steel); h.position.z = -0.05; g.add(h);
  const b = mesh(new THREE.SphereGeometry(0.028, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel); b.scale.set(1, 0.4, 1.35); b.rotation.x = Math.PI; b.position.z = 0.045; g.add(b);
  props.spoon = g;
}
{ // tea cup
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 12, 1, true), mat(0xffffff, { side: THREE.DoubleSide })));
  const bot = mesh(new THREE.CircleGeometry(0.035, 10), mat(0xffffff)); bot.rotation.x = -Math.PI / 2; bot.position.y = -0.035; g.add(bot);
  const tea = mesh(new THREE.CircleGeometry(0.042, 10), mat(0x9a5a2a)); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.022; g.add(tea);
  const hd = mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), mat(0xffffff)); hd.position.set(0.05, 0, 0); g.add(hd);
  const flower = bx(0.012, 0.012, 0.004, mat(0xff8fb0), false); flower.position.set(0, 0.0, 0.044); g.add(flower);
  props.cup = g;
}
{ // leash (a thin box stretched between hand and collar every frame)
  const g = new THREE.Group();
  const l = bx(0.014, 0.014, 1, mat(0xd9343a), false); l.position.z = 0.5; g.add(l);
  props.leash = g;
}
for (const k of ['box', 'collar', 'phone', 'fork', 'spoon', 'cup', 'leash']) scene.add(props[k]);
cast.props = props;

const fx = new FX(scene);
const overlay = new Overlay(W, H);
const director = new Director({ camera, world, cast, fx, timeline, scene });

const out = document.createElement('canvas'); out.width = W; out.height = H;
const g = out.getContext('2d');
document.body.appendChild(out);
const project = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };

function composite(t, st) {
  const sx = st.shake[0] * W / 1080, sy = st.shake[1] * W / 1080;
  const z = st.shakeAmt > 0 ? 1.05 : 1;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const filters = [];
  if (st.sat !== 1) filters.push(`saturate(${st.sat})`);
  if (st.bright !== 1) filters.push(`brightness(${st.bright})`);
  if (st.blue) filters.push(`hue-rotate(${-18 * st.blue}deg) saturate(${1 - 0.25 * st.blue})`);
  g.filter = filters.length ? filters.join(' ') : 'none';
  g.drawImage(renderer.domElement, (W - W * z) / 2 + sx, (H - H * z) / 2 + sy, W * z, H * z);
  g.filter = 'none';
  g.restore();
  if (st.warm) { g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,170,90,${0.16 * st.warm})`; g.fillRect(0, 0, W, H); g.restore(); }
  if (st.blue) { g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(70,110,255,${0.3 * st.blue})`; g.fillRect(0, 0, W, H); g.restore(); }
  if (st.dream) overlay.dream(g, st.dream);
  overlay.vignette(g, st.vignette);
  if (st.flashWhite) overlay.fill(g, '#fffbe8', st.flashWhite);
  if (st.speed > 0) overlay.speedLines(g, t, st.speed);
  if (st.arcs) { const [x, y] = project(st.arcs.world); overlay.motionArcs(g, x + sx, y + sy, t, st.arcs.strength || 1, st.arcs.r || 150); }
  if (st.rings) { const [x, y] = project(st.rings.world); overlay.soundRings(g, x, y, t, st.rings.strength || 1); }
  if (st.viewfinder) overlay.viewfinder(g, t, st.viewfinder.t0, st.viewfinder.alpha ?? 1);
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
window.renderDebug = (t, pos, look, fov = 40) => { director.forceCam = { pos, look, fov }; const r = window.renderFrame(t, 0.9); director.forceCam = null; return r; };
window.sceneInfo = (t) => { const c = director.ctxFor(t); return { id: c.id, shot: director.schedule(director.defs[c.id], c) }; };
window.sfxEvents = () => director.events.map(e => ({ t: e.t, type: e.type, gain: e.gain || 0.5, dur: e.dur || 0 }));
window.censorInfo = () => null;
window.TIMELINE = timeline; window.__scene = scene;
window.READY = true;

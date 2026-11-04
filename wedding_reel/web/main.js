import * as THREE from 'three';
import { buildTextures, buildIcons } from './lib/pixel.js';
import { WT, buildWeddingTextures, buildWeddingIcons } from './lib/wtex.js';
import { buildSets } from './lib/sets.js';
import { Person, mat, bx, mesh, faceted } from './lib/chars.js';
import { FX } from './lib/fx.js';
import { Overlay } from './lib/overlay.js';
import { Director } from './director.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920;
await document.fonts.load('32px "Press Start 2P"');
buildTextures(); buildIcons();
buildWeddingTextures(); buildWeddingIcons();
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
const fam = (i, o) => P({ skin: [0xf1c9a5, 0xc68a5c, 0xe0ab84, 0xa86f48, 0xf4d2b4, 0x8a5a3c][i], shirt: WT.family[i], pants: i % 2 ? WT.family[i] : 0x2a2a30, seed: 60 + i, ...o });
const cast = {
  you: P({ skin: 0xe2ad85, shirt: WT.tux, shirtFront: WT.tuxFront, pants: WT.tuxPants, shoes: 0x0a0a0a, hair: 'styled', hairColor: 0x3a2416, beard: true, beardColor: 0x4a2e1a, bowtie: 0x0a0a0a, flower: 0xffffff, ring: true, cuffs: 0xf4f4f0, seed: 4 }),
  bride: P({ skin: 0xf2c9a8, shirt: WT.dress, shirtFront: WT.dressFront, pants: WT.dress, skirt: WT.dress, skirtBottom: 0.68, skirtTop: 0.22, bareArms: true, hair: 'long', hairColor: 0x7a4a2a, veil: true, lashes: true, blush: true, lipstick: 0xc8425a, shoes: 0xffffff, ring: true, seed: 7 }),
  mom: P({ skin: 0xeab894, shirt: WT.momDress, pants: WT.momDress, skirt: WT.momDress, skirtBottom: 0.42, shortSleeves: true, hair: 'bun', hairColor: 0x9a7a5a, sunglasses: true, lipstick: 0xd2475a, seed: 8 }),
  priest: P({ skin: 0xe8b894, shirt: WT.robe, shirtFront: WT.robeFront, pants: WT.robe, skirt: WT.robe, skirtBottom: 0.52, hair: 'short', hairColor: 0xb8b8b8, browColor: 0x9a9a9a, glasses: 0x2a2a2a, seed: 9 }),
  fil: P({ skin: 0xd99a74, shirt: WT.greySuit, shirtFront: WT.greySuitFront, pants: WT.greySuit, hair: 'short', hairColor: 0x5a5a5a, mustache: true, mustacheColor: 0x3a3a3a, browColor: 0x2a2a2a, scale: 1.12, wide: 1.28, seed: 10 }),
  grandpa: P({ skin: 0xe6b893, shirt: WT.brownSuit, shirtFront: WT.brownSuitFront, pants: WT.brownSuit, hair: 'sides', hairColor: 0xe0e0e0, browColor: 0xd0d0d0, glasses: 0x1a1a1a, bald: true, scale: 0.96, seed: 11 }),
  girl: P({ skin: 0xf2c9a8, shirt: WT.pinkDress, pants: WT.pinkDress, skirt: WT.pinkDress, skirtBottom: 0.42, skirtTop: 0.2, shortSleeves: true, hair: 'pigtails', hairColor: 0x8a5a2b, blush: true, lashes: true, shoes: 0xffffff, scale: 0.55, seed: 12 }),
  organist: P({ skin: 0xc68a5c, shirt: WT.organist, pants: 0x2a2a30, hair: 'curly', hairColor: 0x2a1a10, glasses: 0x333333, seed: 13 }),
  family: [
    fam(0, { skirt: WT.family[0], skirtBottom: 0.5, hair: 'bun', hairColor: 0xc9a24a, lipstick: 0xc8425a, lashes: true }),
    fam(1, { hair: 'short', hairColor: 0x111111, bowtie: 0x8e2c45 }),
    fam(2, { skirt: WT.family[2], skirtBottom: 0.5, hair: 'long', hairColor: 0x3a2416, lashes: true, lipstick: 0xd2475a }),
    fam(3, { hair: 'short', hairColor: 0x2a1a10, mustache: true }),
    fam(4, { skirt: WT.family[4], skirtBottom: 0.5, hair: 'curly', hairColor: 0x6b4a2e, lashes: true }),
    fam(5, { hair: 'short', hairColor: 0x8a8a8a, glasses: 0x222222 }),
  ],
  kids: [0, 1, 2, 3].map(i => P({ skin: [0xf2c9a8, 0xc68a5c, 0xe0ab84, 0x8a5a3c][i], shirt: [0xff8fb8, 0x4fc3ff, 0xffd23d, 0x7ee05a][i], pants: [0x5a6b8c, 0x3a3a46, 0xe06a4a, 0x5a6b8c][i], hair: ['pigtails', 'short', 'curly', 'short'][i], hairColor: [0x8a5a2b, 0x111111, 0x2a1a10, 0xc9a24a][i], shortSleeves: true, scale: 0.55, seed: 80 + i })),
};
const all = [cast.you, cast.bride, cast.mom, cast.priest, cast.fil, cast.grandpa, cast.girl, cast.organist, ...cast.family, ...cast.kids];
all.forEach(p => scene.add(p.root));
cast.all = all;

// ---------------------------------------------------------------- props
const props = {};
{ // phone
  const g = new THREE.Group();
  g.add(bx(0.075, 0.15, 0.014, mat(0x1d1f24)));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.13), new THREE.MeshBasicMaterial({ map: WT.phone }));
  s.position.z = 0.0075; g.add(s);
  props.phone = g;
}
{ // bible with hinged covers
  const g = new THREE.Group();
  const coverM = mat(0x3a1a12), pageM = mat(0xf6efdc);
  const L = new THREE.Group(), R = new THREE.Group(); g.add(L, R);
  const lc = bx(0.16, 0.012, 0.22, coverM); lc.position.x = -0.08; L.add(lc);
  const lp = bx(0.15, 0.02, 0.2, pageM); lp.position.set(-0.075, 0.016, 0); L.add(lp);
  const rc = bx(0.16, 0.012, 0.22, coverM); rc.position.x = 0.08; R.add(rc);
  const rp = bx(0.15, 0.02, 0.2, pageM); rp.position.set(0.075, 0.016, 0); R.add(rp);
  const cross = bx(0.03, 0.004, 0.09, mat(0xd9b24a)); cross.position.set(0.08, -0.008, 0); R.add(cross);
  g.userData = { L, R };
  props.bible = g;
}
{ // bouquet
  const g = new THREE.Group();
  for (let k = 0; k < 9; k++) { const b = mesh(faceted(0.06, 300 + k, [1, 1, 1], 0), mat([0xffffff, 0xff9ec2, 0xffc6d9][k % 3]), false); const a = k * 0.7; b.position.set(Math.cos(a) * 0.07 * (k % 3), 0.1 + (k % 2) * 0.03, Math.sin(a) * 0.07 * (k % 3)); g.add(b); }
  const st = mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.18, 6), mat(0x4a8a3a)); st.position.y = -0.02; g.add(st);
  const rib = bx(0.07, 0.04, 0.07, mat(0xffffff)); rib.position.y = 0.04; g.add(rib);
  props.bouquet = g;
}
{ // flower basket
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.1, 8), mat(0xc9a06a)));
  const h = mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 10, Math.PI), mat(0xc9a06a)); h.position.y = 0.04; g.add(h);
  for (let k = 0; k < 6; k++) { const p = bx(0.05, 0.02, 0.04, mat([0xff8fb8, 0xffffff][k % 2]), false); p.position.set((k % 3 - 1) * 0.05, 0.055, (k > 2 ? 1 : -1) * 0.03); g.add(p); }
  props.basket = g;
}
props.rolls = [0, 1, 2, 3].map(() => { const r = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), mat(0xffffff)); const sheet = bx(0.1, 0.2, 0.004, mat(0xffffff)); sheet.position.set(0, -0.1, 0.06); r.add(sheet); return r; });
for (const k of ['phone', 'bible', 'bouquet', 'basket']) scene.add(props[k]);
props.rolls.forEach(r => scene.add(r));
cast.props = props;

const fx = new FX(scene);
const overlay = new Overlay(W, H);
const director = new Director({ camera, world, cast, fx, timeline, scene });

const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
const fgx = frame.getContext('2d');
const out = document.createElement('canvas'); out.width = W; out.height = H;
const g = out.getContext('2d');
document.body.appendChild(out);

const project = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };

function composite(t, st) {
  const k = W / 1080;
  const sx = st.shake[0] * k, sy = st.shake[1] * k;
  const z = st.shakeAmt > 0 ? 1.05 : 1;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const filters = [];
  if (st.sepia) filters.push(`sepia(${st.sepia}) saturate(1.1)`);
  if (st.sat !== 1) filters.push(`saturate(${st.sat})`);
  if (st.blue) filters.push(`hue-rotate(${-25 * st.blue}deg) saturate(${1 - 0.35 * st.blue}) brightness(${1 + 0.05 * st.blue})`);
  g.filter = filters.length ? filters.join(' ') : 'none';
  g.drawImage(renderer.domElement, (W - W * z) / 2 + sx, (H - H * z) / 2 + sy, W * z, H * z);
  g.filter = 'none';
  g.restore();
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = st.blue ? 'rgba(80,120,255,0.25)' : 'rgba(255,170,90,0.14)'; g.fillRect(0, 0, W, H); g.restore();
  overlay.vignette(g, st.vignette);
  if (st.flashWhite) { const grd = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, `rgba(255,250,235,${st.flashWhite})`); g.fillStyle = grd; g.fillRect(0, 0, W, H); }
  if (st.speed > 0) overlay.speedLines(g, t, st.speed);
  if (st.rings) { const [x, y] = st.rings.world ? project(st.rings.world) : [W / 2, H * 0.35]; overlay.soundRings(g, x, y, t, st.rings.strength || 1); }
  if (st.arcs) { const [x, y] = project(st.arcs.world); overlay.motionArcs(g, x + sx, y + sy, t, st.arcs.strength || 1, st.arcs.r || 150); }
  if (st.confetti) overlay.confetti(g, t, st.confetti);
  if (st.streaks) overlay.motionStreaks(g, W * 0.5, H * 0.4, t, { dir: st.streaks.dir, n: 6 });
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
window.TIMELINE = timeline;
window.READY = true;

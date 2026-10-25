// Reel entry: builds everything once, then exposes window.renderAt(t) (deterministic, no RAF).
import * as THREE from 'three';
import { U, matte, flat } from './materials.js';
import { buildWorld, groundHeight, makeHookSet } from './world.js';
import { buildArk, ARK } from './ark.js';
import { make, crowdPerson, commuter, CAST, FAMILY, BEARD_GREY, BEARD_WHITE } from './cast.js';
import { Person, CLOTH, HAIR } from './characters.js';
import { makeAnimal } from './animals.js';
import { makeSky, makePillar, makeSmoke, makeBirds, makeRain, makeBolt, makeCloud, makeDust, makeGlint, makeChips, makeMotes, makeRays } from './fx.js';
import { Post } from './post.js';
import { Overlay } from './overlay.js';
import { buildTimeline } from './timeline.js';
import { clamp } from './util.js';

const W = 1080, H = 1920;
const T = await (await fetch('build/timings.json', { cache: 'no-store' })).json();

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor('#1c130d');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e2cfa0', 40, 300);
const camera = new THREE.PerspectiveCamera(32, W / H, 0.4, 1400);
const hemi = new THREE.HemisphereLight('#fff3dc', '#8a7a4a', 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d4', 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
scene.add(sun); scene.add(sun.target);
const sky = makeSky(); scene.add(sky);

// ---------- world ----------
const world = buildWorld(scene);
const ark = buildArk(); scene.add(ark.root);

// ---------- cast ----------
const P = {};
for (const k of FAMILY) P[k] = make(k);
P.crowd = Array.from({ length: 22 }, (_, i) => crowdPerson(i + 1, i === 5 || i === 11 || i === 17 ? { kid: true } : {}));
P.commuters = Array.from({ length: 8 }, (_, i) => commuter(i));
P.seeker = make('seeker');
P.farmer = new Person({ seed: 41, height: 1.74, skin: '#8a552f', hair: 'wrap', wrap: CLOTH.cream, beard: 'short', beardColor: HAIR.black, outfit: 'tunic', cloth: CLOTH.olive, belt: '#d7b484', prop: 'staff' });
P.farmer2 = new Person({ seed: 44, height: 1.6, skin: '#a86a3c', hair: 'veil', hairColor: HAIR.black, wrap: CLOTH.ochre, outfit: 'robe', cloth: CLOTH.brick, belt: '#e2c79a', prop: 'basket', female: true });
P.shepherd = new Person({ seed: 43, height: 1.72, skin: '#7a4a2a', hair: 'wrap', wrap: '#e7dcc4', beard: 'long', beardColor: HAIR.grey, outfit: 'robe', cloth: CLOTH.stone, belt: '#9b3d1f', prop: 'staff', age: 'old' });
const allPeople = [...FAMILY.map((k) => P[k]), ...P.crowd, ...P.commuters, P.seeker, P.farmer, P.farmer2, P.shepherd];
allPeople.forEach((p) => { scene.add(p.root); p.root.visible = false; });
P.noah = P.noah; // (alias for readability in the timeline)
const beardSteps = Array.from({ length: 13 }, (_, i) => '#' + new THREE.Color(BEARD_GREY).lerp(new THREE.Color(BEARD_WHITE), i / 12).getHexString());
let beardIdx = -1;
const noahBeard = (k) => { const i = Math.round(clamp(k) * 12); if (i !== beardIdx) { beardIdx = i; P.noah.setBeardColor(beardSteps[i]); } };

// ---------- animals in pairs + converging paths to the ramp ----------
const kinds = [['elephant', 0.9, 'E'], ['giraffe', 0.95, 'E'], ['lion', 1.0, 'S'], ['camel', 0.9, 'W'], ['deer', 1.0, 'S'], ['sheep', 1.1, 'W'], ['elephant', 0.9, 'E'], ['giraffe', 0.95, 'E'], ['lioness', 1.0, 'S'], ['camel', 0.9, 'W'], ['doe', 1.0, 'S'], ['sheep', 1.1, 'W']];
const AN = [];
for (let i = 0; i < 6; i++) {
  const a = makeAnimal(kinds[i][0], 100 + i), b = makeAnimal(kinds[i + 6][0], 200 + i);
  a.group.scale.setScalar(kinds[i][1]); b.group.scale.setScalar(kinds[i + 6][1]);
  scene.add(a.group, b.group); AN.push({ a, b, dir: kinds[i][2], big: i < 2 || i === 3 });
}
const doves = [makeAnimal('dove', 300), makeAnimal('dove', 301)];
doves.forEach((d) => { d.group.scale.setScalar(2.2); scene.add(d.group); });
const allAnimals = [...AN.flatMap((p) => [p.a, p.b]), ...doves];
const rb = ark.rampBottom, rt = ark.rampTop;
const inside = new THREE.Vector3(rt.x, rt.y, rt.z - 2.2);
const approaches = {
  E: [new THREE.Vector3(46, 0, 16), new THREE.Vector3(22, 0, 14), new THREE.Vector3(rb.x + 0.2, 0, rb.z + 1.6)],
  W: [new THREE.Vector3(-34, 0, 22), new THREE.Vector3(-12, 0, 18), new THREE.Vector3(rb.x - 0.2, 0, rb.z + 1.6)],
  S: [new THREE.Vector3(10, 0, 52), new THREE.Vector3(8, 0, 26), new THREE.Vector3(rb.x, 0, rb.z + 1.6)],
};
function pathFor(dir) {
  const pts = [...approaches[dir], new THREE.Vector3(rb.x, 0, rb.z - 0.1), new THREE.Vector3(rt.x, rt.y, rt.z), inside];
  const seg = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); seg.push(l); tot += l; }
  return { pts, seg, tot };
}
const paths = { E: pathFor('E'), W: pathFor('W'), S: pathFor('S') };
function along(path, d) { // d = distance from the END (inside the door)
  let s = path.tot - d; if (s <= 0) return { p: path.pts[0].clone(), dir: path.pts[1].clone().sub(path.pts[0]).normalize(), idx: 0 };
  for (let i = 0; i < path.seg.length; i++) {
    if (s <= path.seg[i]) { const p = path.pts[i].clone().lerp(path.pts[i + 1], s / path.seg[i]); return { p, dir: path.pts[i + 1].clone().sub(path.pts[i]).normalize(), idx: i }; }
    s -= path.seg[i];
  }
  return { p: path.pts[path.pts.length - 1].clone(), dir: new THREE.Vector3(0, 0, -1), idx: path.seg.length - 1 };
}
// queue order: distance from the door at the start of S10 (pair 0 first through the door)
const queue = [3.0, 9.5, 15.5, 21.0, 27.0, 33.0];
function placeAnimals(tt, rampOnly = false) {
  AN.forEach((pr, i) => {
    const path = paths[pr.dir];
    const speed = 1.15;
    for (const [an, lag, side] of [[pr.a, 0, 1], [pr.b, pr.big ? 3.6 : 0.4, -1]]) {
      const d = queue[i] + lag - speed * tt;
      if (d < 0.4) { an.group.visible = false; continue; }
      const { p, dir, idx } = along(path, d);
      const onRamp = idx >= path.seg.length - 2;
      const lat = pr.big ? 0 : (onRamp ? 0.42 : 0.9) * side;
      const nx = -dir.z, nz = dir.x; const hl = Math.hypot(nx, nz) || 1;
      const x = p.x + nx / hl * lat, z = p.z + nz / hl * lat;
      const y = onRamp ? p.y : groundHeight(x, z);
      if (rampOnly && !onRamp && d > 14) { an.group.visible = false; continue; }
      an.group.visible = true; an.group.position.set(x, y + 0.02, z);
      an.group.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);
      an.body.rotation.z = onRamp && idx === path.seg.length - 2 ? Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) : 0;
      an.update(tt + i * 0.37, 1);
    }
  });
  doves.forEach((dv, i) => {
    const u = clamp((tt - 0.6 - i * 0.35) / 3.2);
    const a = new THREE.Vector3(24 - i * 6, 16 + i * 2, 26), b = ark.doorPos.clone().add(new THREE.Vector3(0.2 * i, 0.4, 0.6));
    const p = a.clone().lerp(b, 1 - Math.pow(1 - u, 1.6)); p.y += Math.sin(u * Math.PI) * 2.5;
    dv.group.visible = u < 0.98; dv.group.position.copy(p);
    const d = b.clone().sub(a); dv.group.rotation.set(0, Math.atan2(-d.z, d.x), -0.25);
    dv.update(tt * 1.0 + i, 0, { glide: u > 0.75 });
  });
}

// ---------- effects ----------
const fx = {
  pillar: makePillar(), smoke: makeSmoke(world.chimneys), birds: makeBirds(9), rain: makeRain(), bolt: makeBolt(),
  clouds: Array.from({ length: 9 }, (_, i) => makeCloud(40 + i, 1.6 + (i % 3) * 0.4, ['#565a62', '#4b5058', '#62666e'][i % 3])),
  dust: makeDust(), glints: Array.from({ length: 5 }, () => makeGlint()),
};
scene.add(fx.pillar.group, fx.smoke.group, fx.birds.group, fx.rain.group, fx.bolt, fx.dust.group, ...fx.clouds, ...fx.glints.map((g) => g.group));
// S1 hook extras (hidden by default; reset() hides every fx group each frame)
fx.chips = makeChips(); fx.motes = makeMotes(); fx.rays = makeRays();
for (const k of ['chips', 'motes', 'rays']) { fx[k].group.visible = false; scene.add(fx[k].group); }

// ---------- close-up props ----------
const props = {};
{ // workbench with nail + hammer (S7a)
  const g = new THREE.Group(); g.position.set(-10.05, 0, 6.5); scene.add(g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.6), matte('#93643a')); top.position.y = 1.0; top.castShadow = top.receiveShadow = true; g.add(top);
  for (const x of [-1.1, 1.1]) for (const z of [-0.22, 0.22]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), matte('#6e4a2b')); l.position.set(x, 0.5, z); g.add(l); }
  const nail = new THREE.Group(); g.add(nail);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), matte('#8a8a90')); shaft.position.y = -0.14; nail.add(shaft);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 10), matte('#9a9aa2')); nail.add(head);
  nail.scale.setScalar(1.6);
  const nailY0 = 1.08 + 0.27; nail.position.set(0, nailY0, 0.05);
  const hammer = new THREE.Group(); hammer.position.set(0.62, nailY0 + 0.22, 0.05); g.add(hammer);
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), matte('#7a5232')); hh.position.x = -0.31; hammer.add(hh);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), matte('#55524e')); hd.position.set(-0.62, -0.02, 0); hammer.add(hd);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flat(CAST.noah.skin)); hand.position.set(0.0, 0, 0); hammer.add(hand);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.7, 8), flat(CAST.noah.sleeve)); sleeve.rotation.z = Math.PI / 2 - 0.25; sleeve.position.set(0.38, 0.08, 0); hammer.add(sleeve);
  g.userData = { nail, hammer, nailY0 };
  props.bench = g;
}
{ // beam lifted overhead (S7b)
  const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.24, 0.26), matte('#9a6838')); b.castShadow = true; scene.add(b); props.beam = b;
}
{ // plank on trestles being sealed with pitch (S7c)
  const g = new THREE.Group(); scene.add(g);
  const x0 = 8.25, len = 2.9, z = 9.25;
  const pl = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5), matte('#a07848')); pl.position.set(x0 + len / 2, 1.02, z); pl.castShadow = pl.receiveShadow = true; g.add(pl);
  for (const x of [x0 + 0.3, x0 + len - 0.3]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.96, 0.6), matte('#6e4a2b')); tr.position.set(x, 0.48, z); g.add(tr); }
  const sg = new THREE.BoxGeometry(1, 0.03, 0.46); sg.translate(0.5, 0, 0);
  const stripe = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: '#1c140e', emissive: '#120c08' })); stripe.position.set(x0, 1.095, z); g.add(stripe);
  g.userData = { stripe, x0, len, z }; props.trestle = g;
}
{ const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), matte('#7a5232')); c.castShadow = true; scene.add(c); props.crate = c; }
{ // S1 hook: warm front fill light (no shadows); hidden (so not even counted) unless S1 shows it
  const fill = new THREE.DirectionalLight('#ffe2b6', 1.0); scene.add(fill, fill.target); props.hookFill = fill;
}
{ const hs = makeHookSet(); scene.add(hs); props.hookSet = hs; } // S1 set dressing (ground props, grass)
Object.values(props).forEach((p) => { p.visible = false; });

const crownPalette = ['#5d6e2c', '#67772f', '#55652a', '#718034'];
const crownMats = crownPalette.map((c) => matte(c));
const crownBase = crownMats.map((m) => m.color.clone());

const post = new Post(renderer, W, H);
const sunDir = new THREE.Vector3(-0.5, 0.6, -0.3).normalize();
const ctx = { T, scene, camera, sun, hemi, sky, U, sunDir, world, ark, P, animals: AN, fx, props, allPeople, allAnimals, placeAnimals, pairPaths: paths, noahBeard, crownMats, crownBase };
const TL = buildTimeline(ctx);

// logo: your PNG if present, else the placeholder mark
let logoUrl = 'assets/logo.svg';
for (const f of ['assets/grace-in-motion-pfp.png', 'assets/logo.png']) { try { const r = await fetch(f, { method: 'HEAD' }); if (r.ok) { logoUrl = f; break; } } catch (e) { /* keep placeholder */ } }
const overlay = new Overlay(document.getElementById('overlay'), T, logoUrl);
await document.fonts.ready;
await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
overlay.measure();
window.__overlay = overlay;

// ---------- render one frame at time t ----------
let lastShot = null;
window.renderAt = (t) => {
  const frame = Math.round(t * 30);
  U.uTime.value = t;
  const act = TL.activeAt(t);
  const render = (a, target) => {
    const P2 = a.shot.apply(a.lt, a.dur, t);
    sky.position.copy(camera.position);
    post.shot(scene, camera, P2, target, t, frame);
  };
  const overlayOnly = act.list.every((a) => a.shot.overlayOnly);
  if (overlayOnly) { renderer.setRenderTarget(null); renderer.clear(); }
  else if (act.list.length === 1) render(act.list[0], null);
  else {
    render(act.list[0], post.outA); render(act.list[1], post.outB);
    const dip = act.trans.type === 'dip' ? Math.sin(Math.PI * act.k) * 0.85 : 0;
    post.mix(post.outA, post.outB, act.trans.type === 'dip' ? (act.k < 0.5 ? 0 : 1) * 0 + act.k : act.k, act.trans.color, dip);
  }
  const dominant = act.list.length === 2 && act.k > 0.5 ? act.list[1].shot : act.list[0].shot;
  lastShot = dominant;
  overlay.update(t, TL.overlayState(t, dominant));
  return dominant.id;
};
window.getCues = () => ({ duration: TL.duration, cues: TL.cues, beds: TL.beds, music: TL.music, shots: TL.shots.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, trans: s.trans.type })) });
window.TL = TL; window.__ctx = ctx;
window.renderAt(0);
window.__ready = true;

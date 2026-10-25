// characters.png — the character sheet (consistency reference for every scene).
// ?mode=sheet&page=1|2|3  (stitched side by side by scripts/make_sheet.sh)
import * as THREE from 'three';
import { make, crowdPerson, commuter, BEARD_WHITE } from './cast.js';
import { Poses } from './characters.js';
import { makeAnimal } from './animals.js';

const page = +(new URLSearchParams(location.search).get('page') || 1);
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4d6bb');
const view = page === 3 ? 3.4 : 8.4; // world units across
const cam = new THREE.OrthographicCamera(-view / 2, view / 2, view * H / W / 2, -view * H / W / 2, 0.1, 100);
cam.position.set(0, 0, 30);
scene.add(new THREE.HemisphereLight('#fff6e6', '#8a6a4a', 2.2));
const sun = new THREE.DirectionalLight('#fff0d8', 2.4); sun.position.set(-3, 6, 8); scene.add(sun);

const ov = document.getElementById('overlay');
const label = (txt, x, y) => {
  const d = document.createElement('div'); d.className = 'lbl'; d.textContent = txt;
  const p = new THREE.Vector3(x, y, 0).project(cam);
  d.style.left = ((p.x + 1) / 2 * W) + 'px'; d.style.top = ((1 - p.y) / 2 * H + 14) + 'px'; ov.appendChild(d);
};
const head = (t, s) => {
  const a = document.createElement('div'); a.className = 'sheet-title'; a.style.left = '60px'; a.style.top = '70px'; a.textContent = t; ov.appendChild(a);
  const b = document.createElement('div'); b.className = 'sheet-sub'; b.style.left = '60px'; b.style.top = '140px'; b.style.width = '960px'; b.textContent = s; ov.appendChild(b);
};
const top = view * H / W / 2;
const Y = (px) => top - px / H * (2 * top); // screen px (from top) -> world y
const X = (px) => -view / 2 + px / W * view;
const put = (p, xpx, ypx, pose, name, facing = 1) => {
  p.place(X(xpx), Y(ypx), 0); p.setFacing(facing); p.pose(pose); scene.add(p.root);
  p.blob.visible = false;
  p.lineMat.userData.uOutline.value = page === 3 ? 0.012 : 0.02;
  if (name) label(name, X(xpx), Y(ypx));
};
const cols = [150, 405, 675, 930];

if (page === 1) {
  head('THE ARK — CHARACTERS I', "Noah's family · flat 2D cut-outs, outline #2b1d14, built from separate parts");
  const noah = make('noah'); put(noah, cols[0], 640, Poses.hammer(0.3, 11), 'NOAH · YEAR 1');
  const noah2 = make('noah'); noah2.setBeardColor(BEARD_WHITE); noah2.setProp(null); put(noah2, cols[1], 640, Poses.preach(0.4, 11), 'NOAH · YEARS LATER');
  put(make('wife'), cols[2], 640, Poses.hold(0, 12), 'HIS WIFE');
  put(make('shem', { prop: 'plank' }), cols[3], 640, Poses.carryOverhead(0, 13), 'SHEM');
  put(make('ham', { prop: 'brush' }), cols[0], 1120, Poses.paint(0.2, 14), 'HAM');
  put(make('japheth'), cols[1], 1120, Poses.liftBeam(0, 15, 0.4), 'JAPHETH');
  put(make('shemWife'), cols[2], 1120, Poses.idle(0, 16), "SHEM'S WIFE");
  put(make('hamWife', { prop: 'basket' }), cols[3], 1120, Poses.idle(0.5, 17), "HAM'S WIFE");
  put(make('japhethWife'), cols[0], 1600, Poses.hold(0, 18), "JAPHETH'S WIFE");
  const n3 = make('noah'); n3.setProp(null); put(n3, cols[1], 1600, Poses.wipeSweat(0, 11, 0.3), 'NOAH · WIPING SWEAT');
  const n4 = make('noah'); n4.setProp(null); put(n4, cols[2], 1600, Poses.lookUp(0, 11, 1), 'NOAH · LOOKING UP');
  const n5 = make('noah'); put(n5, cols[3], 1600, Poses.climb(0.1, 11), 'NOAH · ON LADDER');
} else if (page === 2) {
  head('THE ARK — CHARACTERS II', 'The mocking crowd (reused with colour/hair variation) · modern street · animals in pairs');
  put(crowdPerson(1), cols[0], 560, Poses.laughPoint(0.1, 201), 'MOCKER', -1);
  put(crowdPerson(2), cols[1], 560, Poses.laughCup(0.2, 202), 'WITH CUP', -1);
  put(crowdPerson(3), cols[2], 560, Poses.laughBend(0.3, 203), 'DOUBLED OVER', -1);
  put(crowdPerson(5, { kid: true }), cols[3], 560, Poses.laughPoint(0.25, 205), 'CHILD COPYING', -1);
  put(crowdPerson(4), cols[0], 960, Poses.smirk(0, 204), 'SMIRKING');
  put(crowdPerson(7), cols[1], 960, Poses.dismiss(0.1, 207), 'WALKING PAST');
  put(crowdPerson(9), cols[2], 960, Poses.laughPoint(0.5, 209), 'MOCKER', -1);
  put(crowdPerson(11, { kid: true }), cols[3], 960, Poses.laughCup(0.3, 211), 'CHILD', -1);
  put(commuter(0), cols[0], 1340, Poses.phoneWalk(0.0, 600), 'COMMUTER');
  put(commuter(1), cols[1], 1340, Poses.phoneWalk(0.2, 601), 'COMMUTER', -1);
  put(commuter(3), cols[2], 1340, Poses.walk(0.4, 603), 'COMMUTER');
  put(make('seeker'), cols[3], 1340, Poses.wonder(0.2, 31, 1), 'THE ONE WHO STOPS', -1);
  const an = [['elephant', 150, 0.62], ['giraffe', 405, 0.62], ['lion', 675, 0.85], ['camel', 930, 0.62]];
  for (const [k, x, s] of an) { const a = makeAnimal(k); a.group.position.set(X(x) - 0.3, Y(1640), 0); a.group.scale.setScalar(s); a.group.rotation.y = -0.4; a.update(0.2, 0); scene.add(a.group); label(k.toUpperCase(), X(x), Y(1640)); }
  const sm = [['lioness', 110, 0.8], ['deer', 290, 0.85], ['doe', 470, 0.85], ['sheep', 640, 1.1], ['dove', 820, 1.8], ['dove', 960, 1.8]];
  for (const [k, x, s] of sm) { const a = makeAnimal(k); a.group.position.set(X(x) - 0.25, Y(1850) + (k === 'dove' ? 0.45 : 0), 0); a.group.scale.setScalar(s); a.group.rotation.y = -0.4; a.update(0.3, 0); scene.add(a.group); label(k.toUpperCase(), X(x), Y(1850)); }
} else {
  head('THE ARK — FACES & ACTING', 'Dot eyes, small expressive brows, mouths only for key emotions · blink every 3–5 s');
  const mk = (name, extra) => { const p = make(name, extra); return p; };
  const faces = [
    [mk('noah', { prop: null }), 280, 760, Poses.hammer(0.2, 11), 'NOAH · DETERMINED'],
    [(() => { const p = make('noah', { prop: null }); p.setBeardColor(BEARD_WHITE); return p; })(), 800, 760, Poses.preach(0.33, 11), 'NOAH · PREACHING'],
    [crowdPerson(1), 280, 1500, Poses.laughPoint(0.1, 201), 'MOCKING LAUGH'],
    [make('seeker'), 800, 1500, Poses.wonder(0.2, 31, 1), 'WONDER'],
  ];
  for (const [p, x, y, pose, name] of faces) { put(p, x, y, pose, name, 1); p.root.position.y -= 1.05; }
}

await document.fonts.ready;
renderer.render(scene, cam);
window.__ready = true;

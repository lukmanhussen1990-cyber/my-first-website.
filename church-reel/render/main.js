// Church poop reel: scene + shots.
import { THREE, PI, clamp, lerp, ease, easeOut, RNG, mat, box, cyl, C, Person, StinkLines, makeSweat, noiseTex, bakePerson } from './world.js';
import { buildChurch, ROWS, SEATS } from './church.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';

const SCALE = (new URLSearchParams(location.search)).get('s') ? parseFloat(new URLSearchParams(location.search).get('s')) : 1;
const OW = Math.round(1080 * SCALE), OH = Math.round(1920 * SCALE);
const canvas = document.getElementById('c'); canvas.width = OW; canvas.height = OH;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OW, OH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.03, 200);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2018);
scene.fog = new THREE.Fog(0x4a3a2a, 14, 34);
scene.add(new THREE.HemisphereLight(0xffe6c8, 0x6a4a30, 1.35));
const sun = new THREE.DirectionalLight(0xffe0b0, 1.9);
sun.position.set(-9, 11, 6); sun.target.position.set(0, 0, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const CH = buildChurch(scene);

// ---------- textures ----------
function pixelTex(base, dots, seed, size = 16) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); const r = RNG(seed);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.18; i++) { x.fillStyle = dots[Math.floor(r() * dots.length)]; x.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const flowerMat = new THREE.MeshLambertMaterial({ map: pixelTex('#86c3e6', ['#f27aa8', '#ffffff', '#f6d24a', '#e8457a'], 3) });
flowerMat.userData.hex = 0x86c3e6;

// ---------- characters ----------
const you = new Person({ kind: 'man', skin: C.skinB, hair: 0x4a2e1a, hairStyle: 'slick', top: 0xb7d4ee, bottom: 0x3a3f4a, shoes: 0x241a14, tie: 0xb8322e });
box(0.2, 0.06, 0.05, 0xffffff, 0.1, 0.62, 0.15, you.torso).rotation.z = -0.4; box(0.2, 0.06, 0.05, 0xffffff, -0.1, 0.62, 0.15, you.torso).rotation.z = 0.4;
const mom = new Person({ kind: 'woman', skin: C.skinB, hair: 0x5a3820, hairStyle: 'bun', top: 0x86c3e6, bottom: 0x86c3e6 });
mom.torsoMesh.material = flowerMat; mom.skirt.material = flowerMat; for (const a of mom.arms) a.g.children[0].material = flowerMat;
{ const h = new THREE.Group(); h.position.set(0, 0.5, -0.02); mom.head.add(h);
  cyl(0.44, 0.44, 0.03, 12, mat(0xf2a8c0), 0, 0.02, 0, h); cyl(0.26, 0.28, 0.2, 10, mat(0xf2a8c0), 0, 0.12, 0, h);
  cyl(0.285, 0.285, 0.05, 10, mat(0xffffff), 0, 0.06, 0, h);
  for (let i = 0; i < 4; i++) box(0.07, 0.07, 0.07, mat([0xe8457a, 0xf6d24a, 0xffffff, 0xe8457a][i]), 0.26 + (i % 2) * 0.05, 0.1 + Math.floor(i / 2) * 0.06, 0.05, h); }
const bag = new THREE.Group(); mom.hips.add(bag); bag.position.set(0, 0.16, 0.34);
box(0.36, 0.24, 0.12, mat(0x8a3a5a), 0, 0, 0, bag); box(0.36, 0.06, 0.13, mat(0x6e2a46), 0, 0.09, 0, bag);
{ const hd = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 10, PI), mat(0x6e2a46)); hd.position.y = 0.12; bag.add(hd); }
const priest = new Person({ kind: 'priest', skin: C.skinD, hair: C.hairGrey, hairStyle: 'bald', top: 0xf6f2e8, glasses: true, stole: 0xd8a83a });
box(0.56, 0.06, 0.32, mat(0xd8a83a), 0, 0.64, 0, priest.torso);
const lady = new Person({ kind: 'woman', skin: C.skinD, hair: C.hairGrey, hairStyle: 'bun', top: 0x7a4a9a, bottom: 0x5a3a6a, glasses: 'big' });
{ const h = new THREE.Group(); h.position.set(0, 0.52, 0); lady.head.add(h);
  cyl(0.34, 0.34, 0.03, 10, mat(0x7a3aa0), 0, 0, 0, h); cyl(0.22, 0.24, 0.16, 10, mat(0x7a3aa0), 0, 0.09, 0, h); box(0.08, 0.08, 0.08, mat(0xf2a8c0), 0.22, 0.08, 0.05, h); }
const kid = new Person({ kind: 'boy', scale: 0.62, skin: C.skinC, hair: C.hairBlack, hairStyle: 'short', top: 0x1f2a44, bottom: 0x1f2a44 });
const cast = [you, mom, priest, lady, kid];
for (const p of cast) scene.add(p.group);

// seats
const YOU_P = [SEATS[0], ROWS[0]], MOM_P = [SEATS[1], ROWS[0]], LADY_P = [SEATS[0], ROWS[1]], KID_P = [-SEATS[0], ROWS[3]];
function prayPose(p) { p.pointArm(p.armL, [-0.3, 0.2, 0.93]); p.pointArm(p.armR, [0.3, 0.2, 0.93]); }

// ---------- crowd: baked bodies + live heads ----------
const crowd = [];
{
  const rnd = RNG(42);
  const skins = [C.skinA, C.skinB, C.skinC, C.skinD, 0xa0663e];
  const suits = [0x2a2f45, 0x3b3f4a, 0x4a3a2a, 0x222228, 0x5a5f6a];
  const dresses = [0x9c3b4f, 0x4c8a6a, 0x6b4f9e, 0xd98c3a, 0x3d7fb5, 0xc9568a, 0xe0c25a];
  const hairs = [C.hairBlack, C.hairBrown, C.hairBlond, C.hairGrey, 0x8a3b1e];
  const geos = [];
  const special = new Set([`${YOU_P}`, `${MOM_P}`, `${LADY_P}`, `${KID_P}`]);
  for (const [ri, z] of ROWS.entries()) for (const sx of [1, -1]) for (const sxx of SEATS) {
    const x = sxx * sx; if (special.has(`${[x, z]}`)) continue;
    if (rnd() < 0.08 && ri > 2) continue;
    const woman = rnd() < 0.5;
    const cfg = woman ? { kind: 'woman', skin: skins[Math.floor(rnd() * 5)], top: dresses[Math.floor(rnd() * 7)], bottom: dresses[Math.floor(rnd() * 7)], hair: hairs[Math.floor(rnd() * 5)], hairStyle: rnd() < 0.5 ? 'long' : 'bun' }
      : { kind: 'man', skin: skins[Math.floor(rnd() * 5)], top: suits[Math.floor(rnd() * 5)], bottom: suits[Math.floor(rnd() * 5)], hair: hairs[Math.floor(rnd() * 5)], hairStyle: rnd() < 0.3 ? 'bald' : 'short', tie: [0xb8322e, 0x2f5a9a, 0x3a6a3a][Math.floor(rnd() * 3)], glasses: rnd() < 0.2 };
    const p = new Person(cfg); p.group.position.set(x, 0, z); p.group.rotation.y = PI; p.sit(0.5);
    if (p.skirt) { p.skirt.scale.set(0.8, 0.6, 1.2); p.skirt.position.set(0, -0.08, 0.18); }
    prayPose(p); p.setFace({ eyes: 'closed', mouth: 'flat' });
    scene.add(p.group); p.group.updateMatrixWorld(true);
    const head = p.head; const m = head.matrixWorld.clone();
    p.torso.remove(head); scene.add(head); m.decompose(head.position, head.quaternion, head.scale);
    geos.push(...bakePerson(p, new THREE.Matrix4()));
    scene.remove(p.group);
    crowd.push({ p, head, baseQ: head.quaternion.clone(), x, z, ri, side: sx, ph: rnd() });
  }
  const body = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.08, 8, 5) }));
  body.castShadow = true; body.receiveShadow = true; scene.add(body);
}
const findCrowd = (x, z) => crowd.find(c => Math.abs(c.x - x) < 0.01 && Math.abs(c.z - z) < 0.01);
function crowdFaces(f, eyesOpenT = null, t = 0) { for (const c of crowd) c.p.setFace(f(c)); }
function crowdLook(target, amount, faceFn) {
  const q = new THREE.Quaternion(), up = V(0, 1, 0);
  for (const c of crowd) {
    const d = target.clone().sub(c.head.position); const ang = Math.atan2(d.x, d.z) - Math.atan2(0, -1);
    let a = ((ang + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; a = clamp(a, -1.5, 1.5);
    const pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.6, -0.4, 0.3);
    q.setFromAxisAngle(up, a * amount);
    c.head.quaternion.copy(q).multiply(c.baseQ);
    c.head.rotateX(-pitch * amount);
    if (faceFn) c.p.setFace(faceFn(c));
  }
}

// ---------- effects ----------
const youStink = new StinkLines(you.hips, 5, { spread: 0.3, height: 1.5, radius: 0.028 });
youStink.group.position.set(0, 0.1, -0.35);
const drops = []; for (let i = 0; i < 5; i++) { const d = makeSweat(you.head); d.visible = false; drops.push(d); }
function sweat(t, n, sp = 0.2) {
  const spots = [[-0.2, 0.42, 0.18], [0.21, 0.4, 0.18], [0.24, 0.25, 0.12], [-0.25, 0.28, 0.12], [0.05, 0.48, 0.22]];
  drops.forEach((d, i) => { d.visible = i < n; const [x, y, z] = spots[i]; const ph = (t * sp * (1 + i * 0.2) + i * 0.3) % 1; d.position.set(x, y - ph * 0.3, z); d.scale.setScalar(1 + 0.3 * Math.min(1, ph * 4)); });
}
const cloud = new THREE.Group(); scene.add(cloud);
const puffs = [];
{ const r = RNG(9);
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + r() * 0.2, 1), new THREE.MeshLambertMaterial({ color: 0x8fe03a, emissive: 0x2a5a10, transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }));
    const o = V((r() - 0.5) * 1.6, r() * 0.7, (r() - 0.5) * 1.0); m.position.copy(o); cloud.add(m); puffs.push({ m, o, ph: r() * 6 }); } }
const cloudStink = new StinkLines(cloud, 4, { spread: 0.6, height: 1.0, radius: 0.03, amp: 0.12 });
function cloudAt(p, grow, t) {
  cloud.visible = true; cloud.position.copy(p);
  puffs.forEach(({ m, o, ph }) => { m.position.set(o.x + Math.sin(t * 1.3 + ph) * 0.08, o.y + Math.sin(t * 1.7 + ph) * 0.06, o.z); m.scale.setScalar(Math.max(0.01, grow) * (0.9 + 0.1 * Math.sin(t * 2 + ph))); });
  cloudStink.update(t);
}
const coughPuffs = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshLambertMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(m); coughPuffs.push(m); }

// ---------- helpers ----------
function setCam(pos, look, fov = 42) { camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look); }
function moveCam(u, p0, p1, l0, l1, f0, f1 = f0) { setCam(p0.clone().lerp(p1, u), l0.clone().lerp(l1, u), lerp(f0, f1, u)); }
function aim(target, dir, dist, fov) { setCam(target.clone().add(dir.clone().normalize().multiplyScalar(dist)), target, fov); }
function worldOf(o, l = V(0, 0, 0)) { o.updateWorldMatrix(true, false); return o.localToWorld(l.clone()); }
const FACE = p => worldOf(p.face, V(0, -0.02, 0.05));
function faceDir(p, yaw = 0, pitch = 0) { const q = new THREE.Quaternion(); p.head.getWorldQuaternion(q); return V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(q); }
function camFace(p, dist, fov, yaw = 0, pitch = 0, off = V(0, 0, 0)) { aim(FACE(p).add(off), faceDir(p, yaw, pitch), dist, fov); }
function camHead(c, dist, fov, yaw = 0, pitch = 0) { // crowd head close-up
  const f = worldOf(c.p.face, V(0, -0.02, 0.05)); const q = c.head.quaternion;
  aim(f, V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(q), dist, fov);
}
const talk = (t, rate = 8) => (Math.sin(t * rate * PI) > 0.1 ? 'open' : 'flat');
function seat(p, [x, z], sitY = 0.5) { p.group.visible = true; p.group.position.set(x, 0, z); p.group.rotation.set(0, PI, 0); p.sit(sitY); }

let W = [], T0 = {};
function resetAll(T) {
  for (const p of cast) { p.reset(); p.setFace({}); p.group.visible = true; }
  seat(you, YOU_P); you.pointArm(you.armL, [0.12, -0.55, 0.85]); you.pointArm(you.armR, [-0.12, -0.55, 0.85]);
  you.setFace({ eyes: 'normal', mouth: 'flat', brows: 'normal' });
  seat(mom, MOM_P); mom.skirt.scale.set(0.8, 0.6, 1.2); mom.skirt.position.set(0, -0.08, 0.18);
  mom.pointArm(mom.armL, [-0.3, 0.1, 0.95]); mom.pointArm(mom.armR, [0.3, 0.1, 0.95]); mom.setFace({ eyes: 'closed', mouth: 'smile' });
  seat(lady, LADY_P); lady.skirt.scale.set(0.8, 0.6, 1.2); lady.skirt.position.set(0, -0.08, 0.18); prayPose(lady); lady.setFace({ eyes: 'closed', mouth: 'flat' });
  seat(kid, KID_P, 0.5 / 0.62); prayPose(kid); kid.setFace({ eyes: 'closed', mouth: 'flat' });
  priest.group.position.set(0, 0.45, -1.75); priest.group.rotation.set(0, 0, 0);
  priest.pointArm(priest.armL, [0.25, -0.2, 0.95]); priest.pointArm(priest.armR, [-0.25, -0.2, 0.95]); priest.setFace({ eyes: 'closed', mouth: 'flat' });
  for (const c of crowd) { c.head.quaternion.copy(c.baseQ); c.p.setFace({ eyes: 'closed', mouth: 'flat' }); }
  const pooped = T >= T0.poop;
  youStink.visible = pooped; if (pooped) youStink.update(T);
  drops.forEach(d => (d.visible = false)); cloud.visible = false; coughPuffs.forEach(m => (m.visible = false));
  CH.flames.forEach(({ fl, glow }, i) => { const k = 1 + 0.15 * Math.sin(T * 11 + i * 1.7) + 0.08 * Math.sin(T * 23 + i); fl.scale.set(1, k, 1); glow.scale.setScalar(k); });
}
const youFace = () => FACE(you);

// ---------- shots ----------
const SH = {};
SH['01'] = (t, d) => { you.setFace({ eyes: 'normal', mouth: 'flat' }); camFace(you, lerp(2.3, 2.1, ease(t / d)), 40, 0.3, 0.2, V(0, -0.25, 0)); youStink.visible = false; };
SH['02'] = (t, d, T) => { // freeze + stink lines rise
  you.setFace({ eyes: 'wide', mouth: 'flat', brows: 'raised' }); youStink.visible = true; youStink.update(T);
  youStink.group.scale.setScalar(0.3 + 0.7 * easeOut(t / 0.4));
  camFace(you, 2.1, 40, 0.3, 0.2, V(0, -0.25, 0));
};
SH['03'] = (t, d) => { you.setFace({ eyes: 'wide', mouth: 'flat' }); youStink.group.scale.setScalar(1);
  moveCam(ease(t / d), V(0, 3.4, 14.8), V(0, 3.1, 13.2), V(0, 2.0, -3), V(0, 2.0, -3), 52); };
SH['04'] = (t, d) => { you.setFace({ eyes: 'wide', mouth: 'flat' });
  moveCam(ease(t / d), V(-1.2, 2.1, -0.7), V(-1.0, 2.05, -0.5), V(1.9, 0.9, 3.6), V(1.8, 0.9, 3.4), 52); };
SH['05'] = (t, d) => moveCam(ease(t / d), V(-0.2, 2.65, 1.55), V(-0.2, 2.65, 1.55), V(-1.6, 1.3, 3.25), V(-3.3, 1.3, 3.25), 42);
SH['06'] = (t, d) => { priest.pointArm(priest.armL, [-0.3, 0.25, 0.93]); priest.pointArm(priest.armR, [0.3, 0.25, 0.93]); priest.setFace({ eyes: 'closed', mouth: 'flat' });
  moveCam(ease(t / d), V(0.35, 2.0, 1.7), V(0.3, 2.0, 1.3), V(0, 2.05, -1.6), V(0, 2.1, -1.6), 44); };
SH['07'] = (t, d) => { you.setFace({ eyes: 'normal', mouth: 'flat', brows: 'worried', look: [-0.035 * ease(t / 0.4), 0] }); camFace(you, 1.2, 34, 0.0, 0.0, V(0, 0.03, 0)); };
SH['08'] = (t, d) => { you.setFace({ eyes: 'normal', mouth: 'flat', brows: 'worried', look: [-0.035, 0] });
  const u = ease(t / d); moveCam(u, V(1.3, 1.5, 0.25), V(2.1, 1.5, 0.35), V(1.35, 1.38, 2.0), V(2.1, 1.38, 2.0), 40); };
const eyesCU = (c, open, t, d, yaw = 0) => { c.p.setFace({ eyes: open, mouth: 'flat', brows: 'normal' }); camHead(c, lerp(1.15, 1.05, ease(t / d)), 32, yaw, 0.12); };
SH['09'] = (t, d) => eyesCU(findCrowd(-SEATS[0], ROWS[0]), 'closed', t, d, -0.45);
SH['10'] = (t, d) => eyesCU(findCrowd(SEATS[2], ROWS[0]), 'closed', t, d, 0.25);
SH['11'] = (t, d) => { lady.setFace({ eyes: 'closed', mouth: 'flat' }); camFace(lady, lerp(1.3, 1.2, ease(t / d)), 32, 0.8, 0.12); };
SH['12'] = (t, d) => { you.setFace({ eyes: 'wide', mouth: 'flat', brows: 'worried' }); sweat(t, 1, 0.3); camFace(you, lerp(1.35, 0.95, ease(t / d)), 34, 0.0, 0.02); };
SH['13'] = (t, d) => { you.setFace({ eyes: 'wide', mouth: 'flat', look: [0, 0] }); you.pointArm(you.armL, [0.1, -0.7, 0.7]); you.pointArm(you.armR, [-0.1, -0.7, 0.7]);
  camFace(you, 2.1, 40, 0.0, 0.05, V(0, -0.45, 0)); };
SH['14'] = (t, d) => { you.setFace({ eyes: 'wide', mouth: 'tight', cheeks: true, blush: true, brows: 'raised' }); sweat(t, 2, 0.25);
  you.head.scale.setScalar(1 + 0.02 * Math.sin(t * 30)); camFace(you, lerp(1.25, 1.1, ease(t / d)), 34, 0.1, 0.02); };
SH['15'] = (t, d, T) => { you.setFace({ eyes: 'wide', mouth: 'tight', cheeks: true, blush: true });
  cloudAt(V(1.4, lerp(0.7, 1.15, ease(t / d)), lerp(2.55, 2.8, t / d)), easeOut(t / 0.6), T);
  moveCam(ease(t / d), V(-1.7, 2.0, 4.7), V(-1.6, 2.0, 4.5), V(1.4, 1.0, 2.3), V(1.4, 1.05, 2.4), 46); };
SH['16'] = (t, d, T) => { // cloud drifts back over the rows
  const z = lerp(2.9, 4.6, (T - T0.cloud0) / (T0.cloud1 - T0.cloud0));
  cloudAt(V(1.6, 1.35, z), 1, T);
  moveCam(ease(t / d), V(-3.6, 3.7, 1.4), V(-3.4, 3.6, 1.9), V(1.6, 1.0, 3.6), V(1.6, 1.0, 4.2), 48); };
SH['17'] = (t, d, T) => { lady.setFace({ eyes: 'squint', mouth: 'flat', brows: 'worried' }); lady.noseG.scale.set(1 + 0.2 * Math.max(0, Math.sin(t * 14)), 1, 1);
  cloudAt(V(1.0, 1.55, lerp(3.4, 3.6, t / d)), 0.6, T); camFace(lady, lerp(1.55, 1.4, ease(t / d)), 36, 0.8, 0.12); };
SH['18'] = (t, d, T) => { // coughing
  const k = Math.max(0, Math.sin(t * 13));
  lady.setFace({ eyes: 'tight', mouth: k > 0.3 ? 'o' : 'flat', brows: 'worried' });
  lady.pointArm(lady.armR, [0.3, 0.45, 0.8]); lady.torso.rotation.x = 0.12 * k; lady.head.rotation.x = 0.1 * k;
  lady.glasses.position.set(0.012 * Math.sin(t * 60), -0.02 * k + 0.01 * Math.sin(t * 47), 0); lady.glasses.rotation.z = 0.08 * Math.sin(t * 37);
  cloudAt(V(1.0, 1.4, 3.6), 0.6, T);
  lady.group.updateMatrixWorld(true); const m0 = FACE(lady);
  coughPuffs.forEach((m, i) => { const a = ((t * 2.2 + i * 0.25) % 1); m.visible = true; m.position.copy(m0).add(V(0, -0.05, -0.15 - a * 0.6)); m.scale.setScalar(0.5 + a * 2); m.material.opacity = 0.7 * (1 - a); });
  camFace(lady, 1.45, 38, 0.8, 0.12); };
SH['19'] = (t, d, T) => { kid.setFace({ eyes: 'squint', mouth: 'frown', brows: 'worried' }); kid.noseG.scale.set(1.2, 0.9, 1);
  cloudAt(V(-1.5, 1.3, lerp(5.9, 6.1, t / d)), 0.6, T); camFace(kid, lerp(1.3, 1.15, ease(t / d)), 36, -0.8, 0.15); };
SH['20'] = (t, d, T) => { kid.setFace({ eyes: 'tight', mouth: 'wavy', brows: 'angry' });
  kid.pointArm(kid.armR, [0.33, 0.33, 0.42]); kid.pointArm(kid.armL, [-0.2, -0.7, 0.6]); kid.head.rotation.x = -0.1;
  cloudAt(V(-1.6, 1.3, 6.0), 0.6, T); camFace(kid, lerp(1.15, 1.05, ease(t / d)), 38, -0.75, 0.15); };
SH['21'] = (t, d) => { priest.pointArm(priest.armL, [-0.3, 0.25, 0.93]); priest.pointArm(priest.armR, [0.3, 0.25, 0.93]);
  priest.setFace({ eyes: 'closed', mouth: talk(t, 6) }); camFace(priest, lerp(1.5, 1.4, ease(t / d)), 38, 0.0, -0.05, V(0, -0.15, 0)); };
SH['22'] = (t, d) => { priest.pointArm(priest.armL, [-0.3, 0.25, 0.93]); priest.pointArm(priest.armR, [0.3, 0.25, 0.93]);
  priest.setFace({ eyes: 'closed', mouth: t < 0.25 ? talk(t, 6) : 'o', brows: t < 0.25 ? 'normal' : 'raised' }); camFace(priest, lerp(1.4, 1.2, ease(t / d)), 38, 0.0, -0.05, V(0, -0.1, 0)); };
SH['23'] = (t, d, T) => { priest.pointArm(priest.armL, [-0.3, 0.25, 0.93]); priest.pointArm(priest.armR, [0.3, 0.25, 0.93]);
  const open = T > T0.eyeOpen;
  priest.setFace({ eyes: 'closed', eyeR: open ? 'wide' : 'closed', mouth: 'o', brows: 'normal', look: [0.02, -0.01] });
  camFace(priest, lerp(1.1, 1.0, ease(t / d)), 30, 0.0, -0.02, V(0, 0.05, 0)); };
SH['24'] = (t, d) => { // dramatic zoom: from the priest's eye to you
  priest.setFace({ eyes: 'closed', eyeR: 'wide', mouth: 'o', look: [0.02, -0.01] }); priest.pointArm(priest.armL, [-0.3, 0.25, 0.93]); priest.pointArm(priest.armR, [0.3, 0.25, 0.93]);
  you.setFace({ eyes: 'wide', mouth: 'tight', brows: 'worried' }); sweat(t, 2, 0.3);
  const u = ease(t / d);
  setCam(V(-0.35, 2.45, -1.25), youFace().clone().lerp(V(0, 2.3, -1.0), (1 - u) * 0.0), lerp(40, 9, u));
  camera.lookAt(V(-0.2, 2.3, -1.2).lerp(youFace(), Math.min(1, u * 1.8)));
};
SH['25'] = (t, d) => { const u = easeOut(t / 0.5); priest.pointArm(priest.armL, [0.8 * u + 0.2, 0.5 * u - 0.2, 0.3]); priest.pointArm(priest.armR, [-0.8 * u - 0.2, 0.5 * u - 0.2, 0.3]);
  priest.setFace({ eyes: 'normal', mouth: talk(t, 5), brows: 'raised' });
  moveCam(ease(t / d), V(0.9, 1.6, 1.2), V(0.85, 1.6, 1.0), V(0, 2.2, -1.6), V(0, 2.2, -1.6), 46); };
SH['26'] = (t, d) => { priest.pointArm(priest.armR, [-0.45, 0.05, 0.9]); priest.pointArm(priest.armL, [0.25, -0.6, 0.6]);
  priest.group.rotation.y = 0.35; priest.setFace({ eyes: 'squint', mouth: talk(t, 6), brows: 'angry' });
  moveCam(ease(t / d), V(1.3, 1.5, 1.65), V(1.25, 1.5, 1.5), V(0.1, 2.15, -1.6), V(0.15, 2.2, -1.6), 40); };
const openEyes = (c, t, at = 0.18) => { const k = t - at; return k < 0 ? 'closed' : k < 0.08 ? 'squint' : 'wide'; };
SH['27'] = (t, d) => { const c = findCrowd(-SEATS[1], ROWS[0]); c.p.setFace({ eyes: openEyes(c, t), mouth: 'flat', brows: t > 0.25 ? 'raised' : 'normal' }); camHead(c, 1.05, 32, -0.2, 0.1); };
SH['28'] = (t, d) => { const c = findCrowd(-SEATS[0], ROWS[1]); c.p.setFace({ eyes: openEyes(c, t, 0.1), mouth: 'flat', brows: t > 0.2 ? 'raised' : 'normal' }); camHead(c, 1.15, 32, -0.8, 0.15); };
SH['29'] = (t, d) => { lady.setFace({ eyes: openEyes(null, t, 0.1), mouth: 'flat', brows: 'raised' }); camFace(lady, 1.2, 32, 0.8, 0.12); };
SH['30'] = (t, d, T) => { // every head turns to you at the same time
  const u = easeOut((T - T0.turn) / 0.35);
  crowdLook(youFace(), clamp(u), () => ({ eyes: 'wide', mouth: 'flat', brows: 'raised' }));
  lady.setFace({ eyes: 'wide', mouth: 'flat', brows: 'raised' }); lady.head.rotation.y = 0.3 * clamp(u);
  kid.setFace({ eyes: 'wide', mouth: 'o' }); kid.head.rotation.y = -0.5 * clamp(u);
  you.setFace({ eyes: 'wide', mouth: 'tight', brows: 'worried' });
  moveCam(ease(t / d), V(-0.6, 2.4, -0.6), V(-0.6, 2.35, -0.4), V(0.9, 1.0, 4.6), V(0.9, 1.0, 4.4), 54); };
SH['31'] = (t, d) => { // you turn to mom with puppy eyes
  crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' }));
  const u = ease(t / d); you.head.rotation.y = -0.85 * u;
  you.setFace({ eyes: 'puppy', mouth: 'frown', brows: 'worried', look: [-0.02, 0] }); sweat(t, 1, 0.2);
  setCam(V(1.5, 1.55, 0.55), V(1.6, 1.42, 2.0), 40); };
SH['32'] = (t, d) => { crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' }));
  const u = easeOut(t / 0.45); mom.head.rotation.y = 0.85 * u; you.head.rotation.y = -0.85;
  mom.setFace({ eyes: u < 0.5 ? 'closed' : 'normal', mouth: 'flat', brows: 'normal', look: [0.02, 0] });
  mom.pointArm(mom.armL, [-0.15, -0.5, 0.8]); mom.pointArm(mom.armR, [0.15, -0.5, 0.8]);
  setCam(V(2.0, 1.55, 0.6), V(2.0, 1.45, 2.0), 38); };
const momFacing = () => { mom.head.rotation.y = 0.85; you.head.rotation.y = -0.85; mom.pointArm(mom.armL, [-0.15, -0.5, 0.8]); mom.pointArm(mom.armR, [0.15, -0.5, 0.8]); };
SH['33'] = (t, d) => { crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' })); momFacing();
  mom.setFace({ eyes: 'normal', mouth: 'flat', look: [0.02, 0] }); you.setFace({ eyes: 'puppy', mouth: 'frown', brows: 'worried' });
  camFace(mom, lerp(1.3, 1.2, ease(t / d)), 36, -0.35, 0.02); };
SH['34'] = (t, d) => { crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' })); momFacing();
  const u = ease(t / d); mom.torso.scale.set(1 + 0.08 * u, 1 + 0.05 * u, 1 + 0.12 * u); mom.head.rotation.x = -0.15 * u;
  mom.setFace({ eyes: u > 0.3 ? 'closed' : 'normal', mouth: 'o', brows: 'raised', cheeks: u > 0.6 });
  camFace(mom, lerp(1.25, 0.95, u), 36, -0.35, 0.02); };
SH['35'] = (t, d) => { crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' })); momFacing();
  mom.setFace({ eyes: 'wide', mouth: 'yell', brows: 'angry' }); mom.head.rotation.x = 0.05 * Math.sin(t * 20);
  camFace(mom, 0.95, 36, -0.3, 0.0); };
SH['36'] = (t, d) => { crowdLook(youFace(), 1, () => ({ eyes: 'wide', mouth: 'flat' })); momFacing();
  mom.setFace({ eyes: 'wide', mouth: Math.sin(t * 16) > -0.3 ? 'yell' : 'open', brows: 'angry' }); mom.pointArm(mom.armR, [0.55, 0.3, 0.8]);
  you.setFace({ eyes: 'tight', mouth: 'grimace', brows: 'worried' });
  moveCam(ease(t / d), V(2.9, 1.25, 0.4), V(2.85, 1.25, 0.55), V(1.75, 1.5, 2.0), V(1.75, 1.5, 2.0), 46); };
SH['37'] = (t, d) => { // whole church gasps
  crowdLook(V(1.7, 1.4, 1.8), 1, () => ({ eyes: 'wide', mouth: 'o', brows: 'raised' })); momFacing();
  mom.setFace({ eyes: 'wide', mouth: 'yell', brows: 'angry' }); lady.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' }); kid.setFace({ eyes: 'wide', mouth: 'o' });
  priest.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' }); you.setFace({ eyes: 'tight', mouth: 'grimace' });
  moveCam(ease(t / d), V(-0.8, 2.6, -0.4), V(-0.9, 2.7, -0.6), V(1.2, 1.0, 3.8), V(1.2, 1.0, 3.8), 56); };
SH['38'] = (t, d) => { // you slide down and hide
  crowdLook(V(1.7, 1.2, 1.8), 1, () => ({ eyes: 'wide', mouth: 'o' })); momFacing(); mom.setFace({ eyes: 'normal', mouth: 'flat', brows: 'angry' });
  const u = ease(t / (d * 0.8));
  you.hips.position.y = 0.5 - 0.45 * u; you.hips.position.z = 0.35 * u; you.hips.rotation.x = -0.6 * u; you.torso.rotation.x = 0.2 * u;
  you.head.rotation.y = 0; you.setFace({ eyes: 'tight', mouth: 'wavy', brows: 'worried' });
  setCam(V(1.55, 1.15, 0.0), V(1.5, 0.95, 2.0), 44); };

// ---------- API ----------
window.init = (data) => {
  W = data.words; const sh = Object.fromEntries(data.shots.map(s => [s.id, s]));
  T0 = { poop: W[3].s - 0.03, cloud0: sh['16'].t0, cloud1: sh['16'].t1, eyeOpen: W[66].s, turn: W[86].s - 0.05 };
  return true;
};
window.renderShot = (id, t, d, T) => { resetAll(T); SH[id](t, d, T); renderer.render(scene, camera); return true; };
window.ready = true;

// Scene setup + every shot of the wedding reel.
import {
  THREE, PI, clamp, lerp, ease, easeOut, easeIn, RNG, mat, box, cyl, C, Person, buildGarden, buildGuests,
  StinkLines, Particles, makeTearStream, makeSweat, makeHeart, makeHand, noiseTex,
} from './world.js';

const W_ = 1080, H_ = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W_, H_, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(42, W_ / H_, 0.03, 300);

// ================= GARDEN =================
const garden = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xe3f1ff, 0x7a9a55, 1.7); garden.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(7, 13, 9); sun.target.position.set(0, 0, 1.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 13, bottom: -11, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
garden.add(sun, sun.target);
const GW = buildGarden(garden);
const guests = buildGuests(garden, GW.seats);

// characters
const groom = new Person({ kind: 'groom', skin: C.skinA, hair: C.hairBlack, hairStyle: 'slick', top: C.suit, bottom: C.suit, shoes: 0x0b0b0d });
const bride = new Person({ kind: 'bride', skin: C.skinB, hair: C.hairBrown, hairStyle: 'bun', top: C.dress, sleeve: 0xefebe2 });
const priest = new Person({ kind: 'priest', skin: C.skinD, hair: C.hairGrey, hairStyle: 'bald', top: 0xf1eee6, glasses: true });
const photog = new Person({ kind: 'photog', skin: C.skinC, hair: C.hairBlack, hairStyle: 'cap', top: 0x7d8792, bottom: 0x3d5a8a, shoes: 0xe8e8e8 });
const girl = new Person({ kind: 'girl', scale: 0.6, skin: C.skinD, hair: C.hairBlond, hairStyle: 'pigtails', top: C.pink, bottom: C.pink, sleeve: C.skinD });
const boy = new Person({ kind: 'boy', scale: 0.6, skin: C.skinA, hair: C.hairBrown, hairStyle: 'short', top: 0x1f2a44, bottom: 0x1f2a44 });
const cast = [groom, bride, priest, photog, girl, boy];
for (const p of cast) garden.add(p.group);

// groom: lump + stain + stink lines (shown after the poop)
const lump = new THREE.Group(); groom.hips.add(lump);
const lumpMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshLambertMaterial({ map: noiseTex(C.suit, 0.06, 8, 2), flatShading: true }));
lumpMesh.castShadow = true; lumpMesh.receiveShadow = true;
lumpMesh.scale.set(1.15, 0.95, 1.0); lumpMesh.position.set(0, -0.14, -0.27); lump.add(lumpMesh);
const stain = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mat(C.brownStain, { noise: 0.1 }));
stain.scale.set(1.25, 0.8, 0.3); stain.position.set(0.02, -0.25, -0.53); stain.rotation.x = 0.35; lump.add(stain);
const groomStink = new StinkLines(groom.hips, 4, { spread: 0.28, height: 1.25, radius: 0.026 });
groomStink.group.position.set(0, -0.1, -0.42);
const sweat1 = makeSweat(groom.head), sweat2 = makeSweat(groom.head);

// bride tears
const tearL = makeTearStream(bride, 1), tearR = makeTearStream(bride, -1);
const brideStink = new StinkLines(bride.face, 3, { spread: 0.08, height: 0.32, radius: 0.012, amp: 0.035 });
brideStink.group.position.set(0.0, -0.42, 0.2);

// bouquet
function makeBouquet() {
  const g = new THREE.Group(); const rnd = RNG(77);
  const cols = [0xf4a6c0, 0xffffff, 0xe0566e, 0xf7c59f, 0xfde2ea];
  box(0.06, 0.32, 0.06, mat(0x4e8a3a), 0, -0.2, 0, g);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * PI * 2, r = rnd() * 0.15;
    const b = box(0.09, 0.09, 0.09, mat(cols[i % 5]), Math.cos(a) * r, 0.02 + rnd() * 0.08, Math.sin(a) * r, g);
    b.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(0.1, 0.03, 0.06, mat(0x3f7a35), Math.cos(a) * 0.17, -0.02, Math.sin(a) * 0.17, g).rotation.y = -a; }
  return g;
}
const bouquet = makeBouquet(); bride.torso.add(bouquet);

// priest bible
const bible = new THREE.Group(); priest.torso.add(bible);
box(0.26, 0.04, 0.34, mat(0x5a1f1f), 0, 0, 0, bible);
box(0.24, 0.045, 0.32, mat(0xf3ead2), 0.0, 0.006, 0, bible);
box(0.02, 0.05, 0.18, mat(C.gold), 0, 0.03, 0, bible); box(0.1, 0.05, 0.02, mat(C.gold), 0, 0.03, -0.03, bible);
// girl basket
const basket = new THREE.Group(); girl.armL.g.add(basket);
cyl(0.14, 0.1, 0.13, 8, mat(0xb98a4e), 0, -0.72, 0.06, basket);
for (let i = 0; i < 7; i++) box(0.06, 0.03, 0.06, mat([C.pink, 0xe0566e, 0xffffff][i % 3]), (i % 3 - 1) * 0.06, -0.64, 0.06 + (i % 2 - 0.5) * 0.08, basket);
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 4, 10, PI), mat(0x8a6232)); handle.position.set(0, -0.66, 0.06); basket.add(handle);
// ring pillow
const pillow = new THREE.Group(); garden.add(pillow);
box(0.3, 0.07, 0.24, mat(0xfbf8f2, { noise: 0.03 }), 0, 0, 0, pillow);
for (const [x, z] of [[0.15, 0.12], [-0.15, 0.12], [0.15, -0.12], [-0.15, -0.12]]) box(0.03, 0.03, 0.03, mat(C.gold), x, 0.02, z, pillow);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14), new THREE.MeshLambertMaterial({ color: 0xf2c84b, emissive: 0x6a4a08 }));
ring.position.set(0, 0.075, 0); ring.rotation.x = -0.3; pillow.add(ring);
const gem = box(0.03, 0.03, 0.03, mat(0xd9f3ff, { emissive: 0x88aacc }), 0, 0.125, 0, pillow, false);
const sparkle = new THREE.Group(); pillow.add(sparkle);
const spm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
for (const r of [0, PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.22), spm); m.rotation.z = r; sparkle.add(m); }
sparkle.position.set(0.03, 0.16, 0.03);

// photographer's camera as world object (posed per shot)
const pcam = photog.camera; garden.add(pcam);

// flower girl petals (air) + confetti + big arch stink
const airPetals = new Particles(garden, 70, [0xf4a6c0, 0xe0566e, 0xffffff, 0xf7c0d0], { size: [0.07, 0.055], area: [1.4, 1.3, 0.8], fall: 0.35, spin: 2.5, seed: 8 });
const confetti = new Particles(garden, 420, [0xf25c78, 0xffd34d, 0x5cc8f2, 0x7be07b, 0xffffff, 0xb57bf2, 0xff9a3c], { size: [0.09, 0.05], area: [9, 6, 9], center: [0, 3.2, 1.5], fall: 0.9, spin: 4, seed: 12 });
const archStink = new StinkLines(garden, 7, { spread: 1.7, height: 3.2, radius: 0.06, amp: 0.22, speed: 0.7 });
archStink.group.position.set(0, 3.2, -1.55);
const bigHeart = makeHeart(0xe0304a); garden.add(bigHeart);
const fact = { hand: makeHand(C.skinB) };
garden.add(fact.hand);
const fingerMats = fact.hand.userData.fingers.map(f => (f.material = f.material.clone()));
const thumbMat = fact.hand.children.find(c => c.rotation.z < -0.5); thumbMat.material = thumbMat.material.clone();
const factRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 16), new THREE.MeshLambertMaterial({ color: 0xf2c84b, emissive: 0x7a5a10 }));
fact.hand.add(factRing); factRing.rotation.x = PI / 2;
const fh = fact.hand.userData.fingers[1]; factRing.position.set(fh.position.x, 0.4, 0);
const ringGlow = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 20), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
fact.hand.add(ringGlow); ringGlow.position.set(fh.position.x, 0.4, 0.1);

// ================= ROME (sepia) =================
const rome = new THREE.Scene();
{
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sc = sky.getContext('2d'); const gr = sc.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#b89a6e'); gr.addColorStop(1, '#e9d6b0'); sc.fillStyle = gr; sc.fillRect(0, 0, 4, 256);
  const tx = new THREE.CanvasTexture(sky); tx.colorSpace = THREE.SRGBColorSpace; rome.background = tx;
  rome.fog = new THREE.Fog(0xd9c49c, 14, 45);
  rome.add(new THREE.HemisphereLight(0xfff0d0, 0x8a7350, 1.8));
  const rs = new THREE.DirectionalLight(0xffe2b0, 2.2); rs.position.set(-6, 10, 7); rs.castShadow = true;
  rs.shadow.mapSize.set(2048, 2048); Object.assign(rs.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); rs.shadow.normalBias = 0.02;
  rome.add(rs);
  const gt = noiseTex(0xcdb48a, 0.1, 8, 31).clone(); gt.needsUpdate = true; gt.repeat.set(40, 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = true; rome.add(ground);
  const colM = mat(0xe3d2ad, { noise: 0.05 });
  for (const [x, z] of [[-2.6, -1], [2.6, -1], [-2.6, -4], [2.6, -4], [-2.6, -7], [2.6, -7], [-1.2, -9.5], [1.2, -9.5], [-3.6, -9.5], [3.6, -9.5]]) {
    cyl(0.34, 0.38, 4.6, 8, colM, x, 2.4, z, rome);
    box(0.95, 0.25, 0.95, colM, x, 0.12, z, rome); box(0.95, 0.3, 0.95, colM, x, 4.8, z, rome);
  }
  box(9, 0.5, 1.2, colM, 0, 5.1, -9.5, rome);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5, 1.6, 3), colM); ped.rotation.x = PI / 2; ped.rotation.y = PI;
  ped.scale.set(1, 0.4, 1); ped.position.set(0, 6.1, -9.5); rome.add(ped);
  box(12, 0.4, 0.8, colM, 0, 0.2, -11.5, rome);
}
const roman = new Person({ kind: 'roman', skin: 0xb88d62, hair: 0x4a3420, hairStyle: 'roman', top: 0xe6d7b4, sleeve: 0xb88d62 });
rome.add(roman.group);
const romeHand = makeHand(0xc79a6e); rome.add(romeHand);
const romeRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 16), new THREE.MeshLambertMaterial({ color: 0xd8b86a, emissive: 0x5a4210 }));
romeHand.add(romeRing); romeRing.rotation.x = PI / 2; romeRing.position.set(romeHand.userData.fingers[1].position.x, 0.4, 0);
const romeHeart = makeHeart(0xff2040); rome.add(romeHeart);
const veinPts = [[-0.06, 0.62], [-0.07, 0.2], [0.0, -0.35], [0.05, -0.75], [0.25, -1.1], [0.35, -1.45], [0.35, -1.72]].map(([x, y]) => new THREE.Vector3(x, y, 0.1));
const veinCurve = new THREE.CatmullRomCurve3(veinPts);
const veinGeo = new THREE.TubeGeometry(veinCurve, 120, 0.035, 6, false);
const veinGlowGeo = new THREE.TubeGeometry(veinCurve, 120, 0.09, 6, false);
const vein = new THREE.Mesh(veinGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
const veinGlow = new THREE.Mesh(veinGlowGeo, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false }));
const veinG = new THREE.Group(); veinG.add(vein, veinGlow); rome.add(veinG);

// ================= helpers =================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function setCam(pos, look, fov = 42) {
  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
}
function moveCam(u, p0, p1, l0, l1, f0, f1 = f0) {
  setCam(p0.clone().lerp(p1, u), l0.clone().lerp(l1, u), lerp(f0, f1, u));
}
function worldOf(obj, local = V(0, 0, 0)) { obj.updateWorldMatrix(true, false); return obj.localToWorld(local.clone()); }
function reachTo(p, arm, target) { // point arm toward a world point
  p.group.updateMatrixWorld(true);
  const sh = worldOf(arm.g);
  const dirW = target.clone().sub(sh).normalize();
  const inv = new THREE.Quaternion(); p.torso.getWorldQuaternion(inv); inv.invert();
  arm.g.quaternion.setFromUnitVectors(V(0, -1, 0), dirW.applyQuaternion(inv));
}
function aim(target, dir, dist, fov) { const d = dir.clone().normalize(); setCam(target.clone().add(d.multiplyScalar(dist)), target, fov); }
const FG = V(-0.34, 2.0, -0.3), FB = V(0.34, 2.0, -0.3), FP = V(0, 2.0, -0.99);
const talk = (t, rate = 8, ph = 0) => (Math.sin((t + ph) * rate * PI) > 0.1 ? 'open' : 'flat');
const pulse = (t, at, len = 0.25) => clamp(1 - Math.abs(t - at) / len);
function holdHands() {
  groom.pointArm(groom.armL, [-0.2, -0.45, 0.87]); groom.pointArm(groom.armR, [0.2, -0.45, 0.87]);
  bride.pointArm(bride.armL, [-0.2, -0.45, 0.87]); bride.pointArm(bride.armR, [0.2, -0.45, 0.87]);
}
function noseFaceCam(p, dist, fov, yaw = 0, pitch = 0, lookOff = V(0, 0, 0)) {
  // camera in front of a person's face
  p.group.updateMatrixWorld(true);
  const target = worldOf(p.face, V(0, -0.02, 0.05).add(lookOff));
  const q = new THREE.Quaternion(); p.head.getWorldQuaternion(q);
  const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(q);
  setCam(target.clone().add(dir.multiplyScalar(dist)), target, fov);
}

let STATE = {};
function resetAll(T) {
  for (const p of cast) { p.reset(); p.group.visible = true; p.group.rotation.set(0, 0, 0); p.setFace({}); }
  groom.group.position.set(-0.55, 0.15, -0.3); groom.group.rotation.y = PI / 2;
  bride.group.position.set(0.55, 0.15, -0.3); bride.group.rotation.y = -PI / 2;
  priest.group.position.set(0, 0.15, -1.2);
  photog.group.position.set(5.6, 0, 1.8); photog.group.rotation.y = -PI / 2; photog.crouch(0); photog.group.visible = false;
  girl.group.position.set(1.0, 0, 1.9); girl.group.rotation.y = -0.3; girl.group.visible = false;
  boy.group.position.set(-1.0, 0, 1.9); boy.group.rotation.y = 0.3; boy.group.visible = false;
  holdHands();
  priest.pointArm(priest.armL, [0.12, -0.35, 0.9]); priest.pointArm(priest.armR, [-0.12, -0.35, 0.9]);
  bible.position.set(0, 0.24, 0.42); bible.rotation.set(-0.5, 0, 0);
  bouquet.visible = false;
  pcam.visible = false;
  girl.pointArm(girl.armL, [0.15, -0.95, 0.25]); girl.pointArm(girl.armR, [-0.1, -1, 0.1]);
  boy.pointArm(boy.armL, [-0.25, -0.5, 0.85]); boy.pointArm(boy.armR, [0.25, -0.5, 0.85]);
  // pillow in boy's hands
  boy.group.updateMatrixWorld(true);
  pillow.position.copy(worldOf(boy.torso, V(0, 0.16, 0.5))); pillow.rotation.set(0, boy.group.rotation.y, 0);
  sparkle.visible = false; pillow.visible = false;
  lumpMesh.scale.set(1.15, 0.95, 1.0); ring.position.y = 0.075; ringGlow.visible = false;
  const pooped = T >= STATE.poopT;
  lump.visible = pooped; groomStink.visible = pooped; if (pooped) groomStink.update(T);
  sweat1.visible = false; sweat2.visible = false;
  tearL.set(0); tearR.set(0); brideStink.visible = false;
  guests.normal.visible = true; guests.nose.visible = false;
  airPetals.mesh.visible = false; confetti.mesh.visible = false; archStink.visible = false;
  bigHeart.visible = false; fact.hand.visible = false;
  GW.group.visible = true;
}
function nosePinch(p, arm) { p.pointArm(arm, [arm.sx * -0.33, 0.33, 0.4]); }

// ================= SHOTS =================
// each: (t = seconds into shot, d = shot length, T = global time, ev = word times relative to shot)
const SH = {};
SH['01'] = (t, d) => { // wide: beautiful wedding
  moveCam(ease(t / d), V(0, 3.3, 21), V(0, 2.9, 17.5), V(0, 1.8, -1), V(0, 1.8, -1), 40);
  bride.setFace({ mouth: 'smile', eyes: 'happy' }); groom.setFace({ mouth: 'smile' });
};
SH['02'] = (t, d) => { // guests watching
  moveCam(ease(t / d), V(0.5, 2.1, 0.3), V(0.2, 2.1, 0.5), V(3.2, 0.9, 5.5), V(2.3, 0.9, 7.2), 46);
};
SH['03'] = (t, d) => { // vows two-shot
  moveCam(ease(t / d), V(0, 1.85, 4.3), V(0, 1.9, 3.6), V(0, 1.7, -0.6), V(0, 1.75, -0.6), 44);
  groom.setFace({ mouth: talk(t), look: [0, 0] }); bride.setFace({ mouth: 'smile', blush: true });
  priest.setFace({ mouth: 'smile', eyes: 'happy' });
};
const poopCam = () => setCam(V(-0.72, 1.5, 3.6), V(-0.3, 1.25, -0.3), 46);
SH['04a'] = (t) => {
  poopCam(); groom.setFace({ mouth: talk(t) }); bride.setFace({ mouth: 'smile', blush: true });
};
SH['04b'] = (t, d) => {
  poopCam();
  const u = easeOut(t / 0.25);
  groom.head.rotation.y = -0.75 * u; groom.head.rotation.x = 0.05 * u;
  groom.setFace({ eyes: 'wide', brows: 'raised', mouth: t < 0.6 ? 'o' : 'wavy' });
  lumpMesh.scale.set(1.15 * (0.6 + 0.4 * u), 0.95 * (0.6 + 0.4 * u), 1.0 * (0.6 + 0.4 * u));
  bride.setFace({ mouth: 'smile', blush: true });
  sweat1.visible = t > 0.5; sweat1.position.set(-0.25, 0.42 - (t - 0.5) * 0.08, 0.1);
};
SH['05'] = (t, d) => { // you keep talking
  aim(FG.clone().add(V(0, -0.05, 0)), V(0.75, 0.05, 0.65), lerp(1.4, 1.25, ease(t / d)), 38);
  groom.setFace({ mouth: Math.sin(t * 8 * PI) > 0 ? 'grimace' : 'wavy', brows: 'worried', look: [0.02, 0] });
  sweat1.visible = true; sweat1.position.set(-0.24, 0.4 - t * 0.06, 0.12);
  sweat2.visible = true; sweat2.position.set(0.25, 0.36 - t * 0.04, 0.12);
};
SH['06'] = (t, d) => { // I promise to love you
  aim(FG.clone().add(V(0, -0.02, 0)), V(0.7, 0.03, 0.7), lerp(1.05, 0.95, ease(t / d)), 34);
  groom.head.rotation.z = Math.sin(t * 40) * 0.025;
  groom.setFace({ mouth: talk(t, 7), brows: 'worried', eyes: 'normal', look: [0.03 + Math.sin(t * 30) * 0.008, 0] });
  sweat1.visible = true; sweat1.position.set(-0.24, 0.42 - t * 0.12, 0.12);
};
SH['07'] = (t, d) => { // voice shaking
  aim(FG.clone().add(V(0, -0.06, 0)), V(0.6, 0, 0.8), lerp(0.85, 0.78, ease(t / d)), 32);
  groom.head.rotation.z = Math.sin(t * 55) * 0.05; groom.head.rotation.y = Math.sin(t * 47) * 0.03;
  groom.setFace({ mouth: Math.sin(t * 60) > 0 ? 'wavy' : 'open', brows: 'worried', eyes: 'wide' });
  sweat1.visible = true; sweat1.position.set(-0.24, 0.3 - t * 0.1, 0.12);
  sweat2.visible = true; sweat2.position.set(0.25, 0.4 - t * 0.14, 0.12);
};
SH['08'] = (t, d) => { // ...forever (bride, sweet)
  aim(FB.clone().add(V(0, -0.03, 0)), V(-0.7, 0.03, 0.7), lerp(1.2, 1.1, ease(t / d)), 36);
  bride.setFace({ eyes: 'happy', mouth: 'bigsmile', blush: true, brows: 'raised' });
};
const priestCam = () => setCam(V(0.55, 2.0, 1.05), V(-0.12, 1.85, -1.0), 42);
function priestLean(a) {
  priest.group.rotation.y = -0.57 * clamp(a * 2);
  priest.torso.rotation.x = 0.42 * a;
}
SH['09'] = (t, d) => { // priest leans in
  priestCam(); priestLean(ease(t / d));
  priest.setFace({ eyes: 'squint', brows: 'angry', mouth: 'flat' });
};
SH['10'] = (t, d, T, ev) => { // he sniffs (extreme close-up nose)
  priestLean(1);
  const st = ev.sniff ?? 0.35;
  const s = pulse(t, st, 0.18) + pulse(t, st + 0.28, 0.14) * 0.7;
  priest.noseG.scale.set(1 + 0.25 * s, 1 - 0.1 * s, 1);
  priest.setFace({ eyes: t > st + 0.2 ? 'wide' : 'squint', brows: t > st + 0.2 ? 'raised' : 'angry', mouth: 'flat' });
  groom.group.visible = false;
  noseFaceCam(priest, lerp(0.8, 0.68, ease(t / d)), 32, 0.35, 0.05);
};
SH['11'] = (t, d) => { // leans back, disgusted
  priestCam();
  const u = ease(t / d);
  priest.group.rotation.y = -0.57 * (1 - u);
  priest.torso.rotation.x = lerp(0.42, -0.2, u);
  priest.head.rotation.x = -0.1 * u;
  priest.setFace({ eyes: 'wide', brows: 'raised', mouth: 'grimace' });
  priest.glasses.position.y = -0.05 * u; priest.glasses.rotation.z = 0.12 * u;
};
function photogPose(pos, rotY, crouchA, walkT = 0) {
  photog.group.visible = true; photog.group.position.copy(pos); photog.group.rotation.y = rotY;
  photog.crouch(crouchA);
  if (walkT) {
    const s = Math.sin(walkT * 9);
    photog.legs[0].thigh.rotation.x += s * 0.35; photog.legs[1].thigh.rotation.x -= s * 0.35;
    photog.hips.position.y += Math.abs(Math.cos(walkT * 9)) * 0.05;
  }
}
SH['12'] = (t, d) => { // photographer moves closer
  const u = ease(t / d);
  const p = V(0.55, 0.02, 3.4).lerp(V(0.2, 0.15, 0.55), u);
  photogPose(p, Math.atan2(-0.55 - p.x, -0.3 - p.z), 1, t);
  pcam.visible = true; pcam.position.copy(worldOf(photog.torso, V(0, 0.5, 0.45))); pcam.rotation.set(0, photog.group.rotation.y, 0);
  reachTo(photog, photog.armL, pcam.position); reachTo(photog, photog.armR, pcam.position);
  photog.setFace({ eyes: 'squint', mouth: 'smile' });
  groom.setFace({ eyes: 'wide', mouth: 'wavy', brows: 'worried' });
  moveCam(u, V(-0.85, 2.3, 5.6), V(-0.8, 2.2, 5.0), V(-0.15, 1.05, 0.5), V(-0.15, 1.1, 0.3), 40);
};
function photogClose() {
  const face = V(-0.34, 2.0, -0.3);
  photogPose(V(0.08, 0.15, 0.05), -PI / 2 + 0.25, 1);
  photog.torso.rotation.x = -0.15;
  pcam.visible = true;
  const dir = V(1, 0, 0.12).normalize();
  pcam.position.copy(face.clone().add(dir.clone().multiplyScalar(0.3)).add(V(0, 0.0, 0)));
  pcam.lookAt(face); pcam.rotateY(PI);
  reachTo(photog, photog.armL, pcam.position.clone().add(V(0, -0.05, 0))); reachTo(photog, photog.armR, pcam.position.clone().add(V(0, -0.05, 0)));
  photog.head.rotation.x = -0.4;
  photog.setFace({ eyes: 'closed', mouth: 'smile' });
  return { face, dir };
}
SH['13'] = (t, d) => { // close-up (photographer crouched in his face)
  photogClose();
  groom.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried', look: [0.03, -0.01] });
  sweat1.visible = true; sweat1.position.set(-0.24, 0.42 - t * 0.1, 0.12);
  moveCam(ease(t / d), V(-0.05, 1.7, 2.3), V(-0.05, 1.72, 2.0), V(-0.08, 1.62, -0.2), V(-0.08, 1.65, -0.2), 44);
};
SH['14'] = (t, d, T, ev) => { // click click click (POV)
  const { face, dir } = photogClose();
  pcam.visible = false;
  let since = 99;
  for (const c of ev.clicks) if (t >= c) since = t - c;
  groom.setFace({ eyes: since < 0.22 ? 'tight' : 'wide', mouth: since < 0.22 ? 'grimace' : 'wavy', brows: 'worried' });
  sweat1.visible = true; sweat1.position.set(-0.24, 0.42 - t * 0.08, 0.12);
  sweat2.visible = true; sweat2.position.set(0.25, 0.4 - t * 0.06, 0.12);
  bride.group.visible = false; photog.group.visible = false;
  const cp = face.clone().add(dir.clone().multiplyScalar(0.62)).add(V(0, -0.04, 0));
  setCam(cp, face.clone().add(V(0, -0.04, 0)), 56);
};
SH['15'] = (t, d) => { // holds your hands
  const s = Math.sin(t * 50) * 0.02;
  groom.pointArm(groom.armL, [-0.2, -0.45 + s, 0.87]); groom.pointArm(groom.armR, [0.2, -0.45 - s, 0.87]);
  moveCam(ease(t / d), V(0.0, 1.55, 2.3), V(0.0, 1.5, 2.0), V(0, 1.55, -0.3), V(0, 1.45, -0.3), 38);
  bride.setFace({ mouth: 'smile', blush: true }); groom.setFace({ eyes: 'wide', mouth: 'wavy', brows: 'worried' });
};
const brideCam = (u, f0, f1, y0 = 1.97) => aim(V(0.34, y0, -0.3), V(-0.7, 0.03, 0.7), lerp(1.3, 1.18, u), lerp(f0, f1, u));
SH['16'] = (t, d) => { // starts crying
  brideCam(ease(t / d), 36, 33);
  bride.setFace({ eyes: 'happy', mouth: 'smile', brows: 'worried', blush: true });
  const L = 0.2 * ease(t / d); tearL.set(L); tearR.set(L * 0.9);
};
SH['17'] = (t, d) => { // happy tears
  brideCam(ease(t / d), 32, 28);
  bride.setFace({ eyes: 'happy', mouth: 'bigsmile', brows: 'worried', blush: true });
  tearL.set(0.24, -0.24 - ((t * 0.5) % 0.12)); tearR.set(0.23, -0.23 - ((t * 0.5 + 0.06) % 0.12));
};
SH['18'] = (t, d, T, ev) => { // then she sniffs (zoom on nose)
  const u = ease(t / d);
  const st = ev.sniff ?? 0.7;
  const s = pulse(t, st, 0.16) + pulse(t, st + 0.25, 0.12) * 0.7;
  bride.noseG.scale.set(1 + 0.3 * s, 1 - 0.12 * s, 1);
  bride.setFace({ eyes: 'happy', mouth: 'smile', brows: 'worried', blush: true });
  tearL.set(0.24, -0.24 - ((t * 0.5) % 0.12)); tearR.set(0.23, -0.23 - ((t * 0.5 + 0.06) % 0.12));
  bride.group.updateMatrixWorld(true);
  const nose = worldOf(bride.noseG, V(0, 0, 0.06));
  const c0 = V(0.34, 1.97, -0.3).add(V(-0.7, 0.03, 0.7).normalize().multiplyScalar(1.2));
  const c1 = nose.clone().add(V(-0.75, 0.0, 0.66).normalize().multiplyScalar(0.62));
  moveCam(u, c0, c1, V(0.34, 1.97, -0.3), nose, 30, 22);
};
SH['19'] = (t, d) => { // the tears stop
  brideCam(0.3, 34, 34);
  bride.setFace({ eyes: 'wide', mouth: 'flat', brows: 'normal', look: [0, 0] });
  tearL.set(0.24, -0.27); tearR.set(0.23, -0.25);
  brideStink.visible = true; brideStink.update(t);
  camera.position.x += Math.sin(t * 0.7) * 0.002;
};
SH['20'] = (t, d) => { // flower girl freezes mid-throw
  girl.group.visible = true;
  girl.group.position.set(0, 0.02, 3.6); girl.group.rotation.y = PI;
  girl.pointArm(girl.armR, [-0.6, 0.7, 0.4]);
  girl.pointArm(girl.armL, [0.1, -0.95, 0.3]);
  girl.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' });
  airPetals.mesh.visible = true; airPetals.o.center = [0.05, 1.2, 3.05]; airPetals.update(t, 0.12);
  moveCam(ease(t / d), V(0.4, 1.05, 1.2), V(0.34, 1.0, 1.45), V(0, 0.9, 3.6), V(0, 0.88, 3.6), 44);
  guests.normal.visible = true;
};
function boyPose(t) {
  boy.group.visible = true; pillow.visible = true;
  boy.group.position.set(-0.3, 0.02, 2.6); boy.group.rotation.y = PI;
  nosePinch(boy, boy.armR);
  boy.pointArm(boy.armL, [-0.05 + Math.sin(t * 45) * 0.04, -0.45, 0.88]);
  boy.group.updateMatrixWorld(true);
  pillow.position.copy(worldOf(boy.armL.hand, V(0.05, 0.1, 0.05)));
  pillow.position.x += Math.sin(t * 52) * 0.012; pillow.position.y += Math.sin(t * 61) * 0.01;
  pillow.rotation.set(Math.sin(t * 40) * 0.08, PI, Math.sin(t * 47) * 0.08);
  boy.setFace({ eyes: 'squint', mouth: 'wavy', brows: 'worried' });
}
SH['21'] = (t, d) => { // ring bearer covers his nose
  boyPose(t);
  moveCam(ease(t / d), V(-0.1, 0.98, 0.75), V(-0.16, 0.95, 0.95), V(-0.3, 0.78, 2.6), V(-0.3, 0.78, 2.6), 44);
};
SH['21b'] = (t, d) => { // ring on the shaking pillow
  boyPose(t);
  ring.position.y = 0.075 + Math.abs(Math.sin(t * 30)) * 0.02;
  const p = pillow.position.clone();
  moveCam(ease(t / d), p.clone().add(V(0.22, 0.32, -0.62)), p.clone().add(V(0.16, 0.26, -0.5)), p.clone().add(V(0, 0.03, 0)), p.clone().add(V(0, 0.04, 0)), 38);
};
SH['22'] = (t, d) => { // what you don't know: the giant hand pops in
  fact.hand.visible = true; fact.hand.position.set(0, 2.2, 6.5);
  const k = clamp(t / 0.35); const bounce = k < 1 ? easeOut(k) * 1.15 : 1 + 0.15 * Math.exp(-(t - 0.35) * 8) * Math.cos((t - 0.35) * 20);
  fact.hand.scale.setScalar(Math.max(0.001, bounce));
  fact.hand.rotation.set(0, PI + (1 - easeOut(clamp(t / 0.6))) * 2.5, 0);
  for (const f of [thumbMat, ...fact.hand.userData.fingers]) { f.material.emissive = new THREE.Color(0); f.scale.setScalar(1); }
  setCam(V(0, 2.3, 2.6 + ease(t / d) * 0.3), V(0, 2.3, 6.5), 42);
};
SH['23'] = (t, d) => { // fourth finger (giant hand, counting)
  fact.hand.visible = true; fact.hand.position.set(0, 2.2, 6.5); fact.hand.rotation.set(0, PI, 0); fact.hand.scale.setScalar(1);
  const order = [thumbMat, ...[3, 2, 1].map(i => fact.hand.userData.fingers[i])];
  const step = d * 0.16;
  order.forEach((f, i) => {
    const on = t > 0.15 + i * step;
    const m = f.material; m.emissive = new THREE.Color(on ? (i === 3 ? 0xa07a10 : 0x5a4a20) : 0x000000);
    f.scale.setScalar(on && i < 3 ? 1.0 : (on ? 1.12 : 1));
  });
  const lit = t > 0.15 + 3 * step;
  ringGlow.visible = lit; ringGlow.scale.setScalar(1 + Math.sin(t * 10) * 0.12);
  setCam(V(0, 2.3, 3.9 + ease(t / d) * 0.35), V(0, 2.35, 6.5), 42);
};
SH['24'] = (t, d) => { // ancient Romans believed
  roman.reset(); roman.group.position.set(0, 0, -2.5); roman.group.rotation.y = 0.15;
  roman.pointArm(roman.armR, [-0.2, 0.95, 0.15]);
  roman.pointArm(roman.armL, [0.15, -0.6, 0.7]);
  roman.head.rotation.x = -0.1 + Math.sin(t * 3) * 0.04;
  roman.setFace({ eyes: 'squint', brows: 'raised', mouth: 'smile' });
  romeHand.visible = false; romeHeart.visible = false; veinG.visible = false;
  moveCam(ease(t / d), V(0.6, 2.0, 1.8), V(0.4, 2.05, 1.0), V(0, 1.8, -2.5), V(0, 1.9, -2.5), 42);
};
SH['25'] = (t, d) => { // vein from ring finger to heart
  roman.reset(); roman.group.position.set(-0.75, 0, -1.7); roman.group.rotation.y = 0.5;
  roman.pointArm(roman.armR, [0.35, 0.55, 0.75]); roman.pointArm(roman.armL, [0.1, -0.9, 0.3]);
  roman.setFace({ eyes: 'normal', brows: 'raised', mouth: talk(t, 5), look: [0.03, 0.02] });
  romeHand.visible = true; romeHand.position.set(0.25, 2.75, -2.2); romeHand.rotation.set(0, 0, 0); romeHand.scale.setScalar(0.8);
  veinG.visible = true; veinG.position.copy(romeHand.position); veinG.rotation.copy(romeHand.rotation); veinG.scale.setScalar(0.8);
  const g = ease(clamp((t - 0.2) / (d * 0.62)));
  const n = Math.floor(veinGeo.index.count / 3 * g) * 3;
  veinGeo.setDrawRange(0, n); veinGlowGeo.setDrawRange(0, n);
  romeHeart.visible = true;
  const hp = veinG.localToWorld(veinCurve.getPoint(1).clone());
  romeHeart.position.copy(hp).add(V(0.0, -0.22, 0));
  const beat = g >= 1 ? 1 + 0.12 * Math.abs(Math.sin(t * 7)) : 0.9;
  romeHeart.scale.setScalar(0.62 * beat);
  romeHeart.userData.glow.material.opacity = g >= 1 ? 0.3 : 0.08;
  moveCam(ease(t / d), V(0.05, 1.95, 2.0), V(0.08, 1.95, 1.6), V(0.1, 1.85, -2.2), V(0.12, 1.85, -2.2), 46);
};
SH['26'] = (t, d) => { // her heart is fine
  groom.group.visible = false;
  bride.pointArm(bride.armL, [-0.25, -0.7, 0.65]); bride.pointArm(bride.armR, [0.25, -0.7, 0.65]);
  bouquet.visible = true; bouquet.position.set(0, 0.05, 0.42); bouquet.rotation.set(0.3, 0, 0);
  bride.setFace({ eyes: 'normal', mouth: 'smile', look: [0, 0.01] });
  bigHeart.visible = true;
  bride.group.updateMatrixWorld(true);
  bigHeart.position.copy(worldOf(bride.torso, V(0.08, 0.4, 0.3)));
  bigHeart.rotation.set(0, -PI / 2, 0);
  const b = (t * 1.3) % 1; const beat = 1 + 0.16 * (pulse(b, 0.1, 0.1) + 0.6 * pulse(b, 0.3, 0.1));
  bigHeart.scale.setScalar(0.24 * beat);
  bigHeart.userData.glow.material.opacity = 0.18 + 0.1 * beat;
  moveCam(ease(t / d), V(-1.3, 1.82, 0.3), V(-1.15, 1.82, 0.2), V(0.5, 1.62, -0.3), V(0.5, 1.64, -0.3), 40);
};
SH['27'] = (t, d) => { // her nose is not (twitching)
  const tw = Math.sin(t * 38) > 0.3 ? 1 : 0;
  bride.noseG.scale.set(1 + 0.18 * tw, 1 + 0.1 * Math.sin(t * 23), 1);
  bride.noseG.rotation.z = Math.sin(t * 31) * 0.15; bride.noseG.position.y = -0.03 + tw * 0.012;
  bride.setFace({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
  brideStink.visible = true; brideStink.update(t * 1.5);
  noseFaceCam(bride, lerp(0.85, 0.72, ease(t / d)), 30, 0.55, 0.02);
};
SH['28'] = (t, d) => { // "Do you take this man?"
  priest.pointArm(priest.armR, [0.3, 0.36, 0.42]);
  priest.pointArm(priest.armL, [0.05, -0.4, 0.9]);
  bible.position.set(0.25, 0.25, 0.42);
  priest.setFace({ eyes: 'squint', brows: 'worried', mouth: talk(t, 6) });
  priest.glasses.position.y = -0.04; priest.glasses.rotation.z = 0.1;
  guests.normal.visible = false; guests.nose.visible = true;
  aim(FP.clone().add(V(0, -0.12, 0)), V(0.15, 0.02, 1), lerp(1.6, 1.45, ease(t / d)), 40);
};
SH['29'] = (t, d) => { // long pause... very long pause (slow push-in on her face)
  guests.normal.visible = false; guests.nose.visible = true;
  priest.pointArm(priest.armR, [0.3, 0.36, 0.42]);
  priest.setFace({ eyes: 'squint', brows: 'worried', mouth: 'flat' });
  groom.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
  const blink = (t % 3.1) > 2.95;
  bride.setFace({ eyes: blink ? 'closed' : 'normal', mouth: 'flat', look: [Math.floor(t / 2.2) % 2 ? 0.02 : -0.02, 0] });
  const u = ease(t / d);
  moveCam(u, V(0.0, 1.9, 7.5), V(-0.18, 2.0, 0.42), V(0, 1.6, -0.6), V(0.34, 1.99, -0.3), 40, 32);
};
const farBride = () => {
  bride.group.position.set(0, 0.02, 5.1); bride.group.rotation.y = PI;
  bride.pointArm(bride.armL, [-0.25, 0.3, 0.9]); bride.pointArm(bride.armR, [0.25, 0.3, 0.9]);
  bouquet.visible = true; bouquet.position.set(0, 0.87, 0.36); bouquet.rotation.set(1.35, 0, 0);
  bride.setFace({ eyes: 'squint', brows: 'worried', mouth: 'none' });
};
SH['30'] = (t, d) => { // "I do." (bouquet over nose)
  farBride();
  guests.normal.visible = false; guests.nose.visible = true;
  moveCam(ease(t / d), V(0.2, 1.85, 2.1), V(0.16, 1.85, 2.35), V(0, 1.7, 5.1), V(0, 1.7, 5.1), 40);
};
SH['31'] = (t, d) => { // from five metres away
  farBride();
  guests.normal.visible = false; guests.nose.visible = true;
  nosePinch(priest, priest.armR); priest.setFace({ eyes: 'squint', brows: 'worried', mouth: 'wavy' });
  groom.pointArm(groom.armL, [-0.15, -0.6, 0.78]); groom.pointArm(groom.armR, [0.15, -0.6, 0.78]);
  groom.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
  boy.group.visible = girl.group.visible = true;
  boy.group.position.set(-1.0, 0.02, 1.7); boy.group.rotation.y = 0.5; nosePinch(boy, boy.armR);
  girl.group.position.set(1.0, 0.02, 1.7); girl.group.rotation.y = -0.5; nosePinch(girl, girl.armR);
  moveCam(ease(t / d), V(-0.9, 6.0, -1.45), V(-0.95, 6.3, -1.6), V(-0.1, 0.3, 3.0), V(-0.1, 0.3, 3.0), 56);
};
SH['32'] = (t, d) => { // congratulations
  farBride();
  guests.normal.visible = false; guests.nose.visible = true;
  nosePinch(priest, priest.armR);
  groom.setFace({ eyes: 'wide', mouth: 'smile', brows: 'worried' });
  groom.pointArm(groom.armL, [-0.6, 0.6, 0.3]); groom.pointArm(groom.armR, [0.6, 0.6, 0.3]); // weak "yay"
  confetti.mesh.visible = true; confetti.update(t + 1.2);
  archStink.visible = true; archStink.update(t);
  moveCam(ease(t / d), V(0, 3.6, 10), V(0, 5.2, 13.5), V(0, 2.2, -0.8), V(0, 2.6, -0.8), 44);
};

// ================= API =================
let SHOTS = null;
window.init = (data) => {
  SHOTS = data;
  const W = data.words;
  STATE.poopT = W[15].s - 0.03;
  return true;
};
window.renderShot = (id, t, d, T, ev) => {
  const isRome = id === '24' || id === '25';
  if (!isRome) resetAll(T);
  SH[id](t, d, T, ev || {});
  renderer.render(isRome ? rome : garden, camera);
  return true;
};
window.ready = true;

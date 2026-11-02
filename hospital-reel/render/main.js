// Hospital waiting room reel: scene setup + all shots.
import {
  THREE, PI, clamp, lerp, ease, easeOut, RNG, mat, box, cyl, C, Person, StinkLines, Particles, makeSweat, noiseTex,
} from './world.js';
import { buildClinic, makePlant, plantState, canvasTex, gradientTex, linedPage, scribbles } from './sets.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';

// fonts for the canvas textures
for (const [n, f] of [['Hand', 'Caveat.ttf'], ['Marker', 'PermanentMarker.ttf'], ['Pixel', 'PixelifySans.ttf']]) {
  const ff = new FontFace(n, `url(./fonts/${f})`); await ff.load(); document.fonts.add(ff);
}

const OW = 1080, OH = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OW, OH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(42, OW / OH, 0.03, 400);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ================= CLINIC =================
const clinic = new THREE.Scene();
const SKY_DAY = gradientTex([[0, '#5aa6e8'], [0.6, '#a9d6f5'], [1, '#e8f4fb']]);
const SKY_SUNSET = gradientTex([[0, '#3d3f86'], [0.35, '#b85a86'], [0.62, '#f2874a'], [1, '#ffd98a']]);
const hemi = new THREE.HemisphereLight(0xeef6ff, 0xb8b0a0, 1.9); clinic.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
clinic.add(sun, sun.target);
const CL = buildClinic(clinic);
function setTime(mode) {
  if (mode === 'sunset') {
    clinic.background = SKY_SUNSET; clinic.fog = new THREE.Fog(0xf0a070, 30, 110);
    hemi.color.set(0xffd2b0); hemi.groundColor.set(0x6a5050); hemi.intensity = 1.3;
    sun.color.set(0xffa860); sun.intensity = 2.0; sun.position.set(-26, 7, 18); sun.target.position.set(0, 0, 0);
    CL.upWin.forEach((w, i) => { w.material.color.set(i === 3 ? 0xffe39a : 0x6a7f9a); w.material.emissive.set(i === 3 ? 0xffb040 : 0x1a2a3a); w.material.emissiveIntensity = i === 3 ? 1.2 : 0.4; });
  } else {
    clinic.background = SKY_DAY; clinic.fog = new THREE.Fog(0xd6ecf8, 40, 140);
    hemi.color.set(0xeef6ff); hemi.groundColor.set(0xb8b0a0); hemi.intensity = 1.9;
    sun.color.set(0xfff2dc); sun.intensity = 2.2; sun.position.set(6, 10, 16); sun.target.position.set(0, 0, 0);
    CL.upWin.forEach(w => { w.material.color.set(0x9fd2f0); w.material.emissive.set(0x3a6a8a); w.material.emissiveIntensity = 0.5; });
  }
}

// ---- characters ----
const you = new Person({ kind: 'hoodie', skin: C.skinB, hair: 0x5a3820, hairStyle: 'messy', top: 0x8a8f99, bottom: 0x3d5a8a, shoes: 0xeeeeee });
const friend = new Person({ kind: 'tee', skin: 0xa0663e, hair: C.hairBlack, hairStyle: 'short', top: 0x56a85a, bottom: 0xc8b48a, shoes: 0x7a4a2a });
const doc = new Person({ kind: 'coat', skin: C.skinD, hair: C.hairGrey, hairStyle: 'short', top: 0xf7f7f7, sleeve: 0xf7f7f7, bottom: 0x5a5f6a, shoes: 0x2a2a2a, glasses: true });
const nurse = new Person({ kind: 'scrubs', skin: C.skinC, hair: C.hairBlack, hairStyle: 'bun', top: 0x8fc4e8, bottom: 0x8fc4e8, shoes: 0xf2f2f2 });
const reader = new Person({ kind: 'woman', skin: C.skinA, hair: C.hairBrown, hairStyle: 'long', top: 0xd98c3a, bottom: 0x6b4f9e });
const card1 = new Person({ kind: 'man', skin: C.skinD, hair: C.hairGrey, hairStyle: 'bald', top: 0x6b4f9e, bottom: 0x3b3f4a });
const card2 = new Person({ kind: 'man', skin: 0xa0663e, hair: C.hairGrey, hairStyle: 'short', top: 0x4c8a6a, bottom: 0x4a3a2a, glasses: true });
const waterer = new Person({ kind: 'man', skin: C.skinB, hair: 0x8a3b1e, hairStyle: 'short', top: 0x3d7fb5, bottom: 0x2a2a35 });
const clinicCast = [you, friend, doc, nurse, reader, card1, card2, waterer];
for (const p of clinicCast) clinic.add(p.group);

// props in hands
const book = new THREE.Group(); reader.torso.add(book);
box(0.28, 0.36, 0.05, mat(0x2f6fa8), 0, 0, 0, book); box(0.26, 0.34, 0.052, mat(0xf3eedf), 0.012, 0, 0, book);
const cards = [card1, card2].map(p => { const g = new THREE.Group(); p.torso.add(g); for (let i = 0; i < 4; i++) { const c = box(0.07, 0.1, 0.005, mat(i % 2 ? 0xffffff : 0xf6f0e0), (i - 1.5) * 0.03, 0, 0, g, false); c.rotation.z = (i - 1.5) * 0.25; } return g; });
const can = new THREE.Group(); waterer.torso.add(can);
box(0.24, 0.2, 0.14, mat(0x4fa046), 0, 0, 0, can); const spout = box(0.04, 0.04, 0.3, mat(0x4fa046), 0, 0.05, 0.2, can); spout.rotation.x = -0.6;
const flowers = new THREE.Group(); you.torso.add(flowers);
{ const r = RNG(4); box(0.05, 0.3, 0.05, mat(0x4e8a3a), 0, -0.15, 0, flowers);
  for (let i = 0; i < 9; i++) { const b = box(0.08, 0.08, 0.08, mat([0xf7d046, 0xf28c8c, 0xffffff][i % 3]), (r() - 0.5) * 0.18, 0.02 + r() * 0.08, (r() - 0.5) * 0.18, flowers); b.rotation.set(r() * 3, r() * 3, 0); }
  const paper = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 6, 1, true), mat(0xf6e9d0, { double: true })); paper.rotation.x = PI; paper.position.y = -0.05; flowers.add(paper); }
const magazine = new THREE.Group(); you.torso.add(magazine);
{ const tex = canvasTex(256, 340, (x, w, h) => {
    x.fillStyle = '#ffd35c'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8454f'; x.fillRect(0, h - 60, w, 60);
    x.save(); x.translate(w / 2, h / 2 - 10); x.rotate(PI);
    x.fillStyle = '#e0a070'; x.fillRect(-70, -80, 140, 150); x.fillStyle = '#5a3820'; x.fillRect(-75, -95, 150, 40);
    x.fillStyle = '#111'; x.fillRect(-40, -30, 18, 22); x.fillRect(22, -30, 18, 22);
    x.fillStyle = '#8a2a2a'; x.fillRect(-35, 30, 70, 12); x.fillRect(-45, 20, 12, 12); x.fillRect(33, 20, 12, 12); x.restore();
    for (let i = 0; i < 4; i++) { x.fillStyle = '#ffffffaa'; x.fillRect(20, 30 + i * 18, 120 - i * 20, 8); }
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.02), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), new THREE.MeshLambertMaterial({ map: tex }), mat(0xf0f0f0)]);
  m.castShadow = true; magazine.add(m); }

// lump, stain and stink on you
const lump = new THREE.Group(); you.hips.add(lump);
const lumpMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.29, 1), new THREE.MeshLambertMaterial({ map: noiseTex(0x3d5a8a, 0.06, 8, 2), flatShading: true }));
lumpMesh.castShadow = true; lumpMesh.scale.set(1.15, 0.95, 1.0); lump.add(lumpMesh);
const stain = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), mat(0x6e4320, { noise: 0.1 }));
stain.scale.set(1.25, 0.8, 0.3); stain.position.set(0.02, -0.12, -0.25); stain.rotation.x = 0.35; lump.add(stain);
const youStink = new StinkLines(you.hips, 4, { spread: 0.26, height: 1.3, radius: 0.026 });
const bigStink = new StinkLines(you.hips, 6, { spread: 0.4, height: 2.6, radius: 0.04, amp: 0.15, speed: 0.8 });
function lumpPose(mode) { // 'sit' | 'stand'
  const p = mode === 'sit' ? V(0, 0.12, -0.3) : V(0, -0.14, -0.27);
  lump.position.copy(p);
  youStink.group.position.copy(p).add(V(0, 0.05, -0.18)); bigStink.group.position.copy(youStink.group.position);
}
// wristband on you's left arm
const bandTex = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#16203a'; x.font = 'bold 70px Pixel'; x.textAlign = 'center'; x.fillText('YOU', w / 2, 72); });
const band = new THREE.Group(); you.armL.g.add(band); band.position.y = -0.47;
{ const t = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.022, 6, 18), mat(0xf6f6f6)); t.rotation.x = PI / 2; band.add(t);
  for (const sz of [1, -1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.01), new THREE.MeshLambertMaterial({ map: bandTex })); l.position.z = 0.135 * sz; if (sz < 0) l.rotation.y = PI; band.add(l); } }
// sweat drops on the face
const drops = []; for (let i = 0; i < 7; i++) { const d = makeSweat(you.head); d.visible = false; drops.push(d); }
function sweatAnim(t, n, speed = 0.12, big = 1) {
  const spots = [[-0.2, 0.42, 0.18], [0.21, 0.4, 0.18], [-0.12, 0.47, 0.22], [0.1, 0.46, 0.22], [0.24, 0.25, 0.12], [-0.25, 0.28, 0.12], [0.0, 0.48, 0.22]];
  drops.forEach((d, i) => {
    d.visible = i < n; if (!d.visible) return;
    const [x, y, z] = spots[i]; const ph = (t * speed * (1 + i * 0.13) + i * 0.37) % 1;
    d.position.set(x, y - ph * 0.35, z); d.scale.setScalar(big * (0.8 + 0.4 * Math.min(1, ph * 4)));
  });
}
// sprinkler spray
const sprayN = 420;
const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 5, 4), new THREE.MeshLambertMaterial({ color: 0x9fd8ff, emissive: 0x3a7aa8 }), sprayN);
spray.frustumCulled = false; clinic.add(spray);
function sprayUpdate(t, origin) {
  const m4 = new THREE.Matrix4(); const r = RNG(99);
  for (let i = 0; i < sprayN; i++) {
    const life = 0.7, birth = -life + (i / sprayN) * life * 2; let age = (t - birth) % life; if (age < 0) age += life;
    const tb = t - age; const ang = 0.9 * Math.sin(Math.floor(tb * 9) * 0.55) + (i % 2 ? PI : 0) + (r() - 0.5) * 0.4;
    const sp = 3.8 + r() * 1.4, up = 1.9 + r() * 0.8;
    const p = origin.clone().add(V(Math.sin(ang) * sp * age, up * age - 4.9 * age * age, Math.cos(ang) * sp * age));
    m4.makeTranslation(p.x, p.y, p.z); spray.setMatrixAt(i, m4);
  }
  spray.instanceMatrix.needsUpdate = true;
}
// clipboard (doctor) with scribbles + live underline
const clipTex = canvasTex(512, 680, (x, w, h) => scribbles(x, w, h, 3));
const clip = new THREE.Group(); clinic.add(clip);
box(0.36, 0.5, 0.02, mat(0x9a6a3a), 0, 0, 0, clip);
const clipPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.42), new THREE.MeshLambertMaterial({ map: clipTex })); clipPaper.position.set(0, -0.02, 0.012); clip.add(clipPaper);
box(0.14, 0.05, 0.03, mat(0xb8bec4), 0, 0.23, 0.015, clip);
const pen = new THREE.Group(); clinic.add(pen);
{ const b = cyl(0.008, 0.008, 0.15, 6, mat(0x2a5ad0), 0, 0.075, 0, pen); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 6), mat(0xd0d0d0)); tip.rotation.x = PI; tip.position.y = -0.01; pen.add(tip); }
let clipU = -1;
const penHand = box(0.06, 0.06, 0.07, mat(C.skinD), 0, 0.16, 0, pen); penHand.visible = false;
function clipUnderline(u) {
  if (Math.abs(u - clipU) < 0.004) return; clipU = u;
  const { ctx } = clipTex.userData; scribbles(ctx, 512, 680, 3);
  if (u > 0) {
    ctx.strokeStyle = '#c0262e'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(40, 300); ctx.lineTo(40 + 420 * Math.min(1, u), 296); ctx.stroke();
    if (u > 1.2) { ctx.beginPath(); ctx.moveTo(40, 318); ctx.lineTo(40 + 420 * Math.min(1, u - 1.2), 314); ctx.stroke(); }
  }
  clipTex.needsUpdate = true;
}
const wrist = new THREE.Group(); clinic.add(wrist); // close-up wrist + band (shot 21)
box(0.42, 0.2, 0.22, mat(0x8a8f99), -0.26, 0, 0, wrist); box(0.08, 0.22, 0.24, mat(0x737882), -0.06, 0, 0, wrist);
box(0.16, 0.13, 0.15, mat(C.skinB), 0.06, 0, 0, wrist); box(0.13, 0.15, 0.17, mat(C.skinB), 0.2, 0, 0, wrist);
box(0.1, 0.04, 0.16, mat(C.skinB), 0.31, -0.02, 0, wrist);
const wristBand = new THREE.Group(); wristBand.position.x = 0.04; wrist.add(wristBand);
let bandMesh = null;
const bandLabel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.06), [mat(0xffffff), mat(0xffffff), new THREE.MeshLambertMaterial({ map: bandTex }), mat(0xffffff), mat(0xffffff), mat(0xffffff)]);
wristBand.add(bandLabel);
function bandClose(a) {
  if (bandMesh) { wristBand.remove(bandMesh); bandMesh.geometry.dispose(); }
  bandMesh = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, 20, PI * (1.25 + 0.75 * a)), mat(0xf6f6f6));
  bandMesh.rotation.y = PI / 2; bandMesh.rotation.x = PI * 0.6 * (1 - a); wristBand.add(bandMesh);
  bandLabel.position.set(0, 0.112, 0); bandLabel.visible = a > 0.85;
}
// calendar on the back wall
const cal = new THREE.Group(); cal.position.set(1.0, 1.75, -4.96); clinic.add(cal);
box(0.66, 0.92, 0.03, mat(0xd9d2c4), 0, 0, 0, cal); box(0.66, 0.12, 0.05, mat(0xd2484e), 0, 0.43, 0.02, cal);
const calTex = n => canvasTex(512, 640, (x, w, h) => {
  x.fillStyle = '#fdfdfb'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#e2e2e2'; x.lineWidth = 3; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(0, h * 0.42 + i * 70); x.lineTo(w, h * 0.42 + i * 70); x.stroke(); }
  if (n) { x.fillStyle = '#c8282e'; x.font = '150px Marker'; x.textAlign = 'center'; x.fillText('WEEK', w / 2, h * 0.36); x.font = '260px Marker'; x.fillText(String(n), w / 2, h * 0.8); }
});
const calTexs = [calTex(0), calTex(1), calTex(2), calTex(3)];
const calBase = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.76), new THREE.MeshLambertMaterial({ map: calTexs[1] })); calBase.position.set(0, -0.06, 0.03); cal.add(calBase);
const flyPages = [0, 1, 2].map(() => { const pv = new THREE.Group(); cal.add(pv); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.76), new THREE.MeshLambertMaterial({ map: calTexs[0], side: THREE.DoubleSide })); m.position.y = -0.38; pv.add(m); pv.position.set(0, 0.32, 0.04); pv.userData.m = m; return pv; });
// page flip (shot 36)
const pagesG = new THREE.Group(); clinic.add(pagesG);
box(0.95, 1.3, 0.03, mat(0xd9b77a), 0, 0, -0.03, pagesG);
const pageTexs = [0, 1, 2, 3, 4, 5].map(k => canvasTex(600, 800, (x, w, h) => linedPage(x, w, h, k)));
const basePage = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.18), new THREE.MeshLambertMaterial({ map: pageTexs[0] })); pagesG.add(basePage);
const flipPivot = new THREE.Group(); flipPivot.position.set(-0.43, 0, 0.01); pagesG.add(flipPivot);
const flipPage = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.18), new THREE.MeshLambertMaterial({ map: pageTexs[1], side: THREE.DoubleSide })); flipPage.position.x = 0.43; flipPivot.add(flipPage);
// giant file + paper pile + dust + flying papers
const file = new THREE.Group(); clinic.add(file);
box(0.95, 1.9, 0.5, mat(0xe2c58e), 0, 0, 0, file);
for (let i = 0; i < 9; i++) box(0.9, 1.84, 0.02, mat(i % 2 ? 0xfbfaf3 : 0xeceae2), 0.04, 0, -0.2 + i * 0.05, file);
const pile = (() => { const r = RNG(31); const geos = [];
  for (let i = 0; i < 160; i++) { const a = r() * PI * 2, rad = Math.pow(r(), 0.7) * 1.1, h = (1 - rad / 1.15) * 1.9 * r() + 0.05;
    const g = new THREE.BoxGeometry(0.42, 0.04, 0.32).toNonIndexed(); g.rotateY(r() * PI); g.rotateX((r() - 0.5) * 0.4); g.rotateZ((r() - 0.5) * 0.4);
    g.translate(Math.cos(a) * rad, h, Math.sin(a) * rad * 0.8 - 0.2); const c = new THREE.Color(r() < 0.85 ? 0xfbfaf3 : 0xe2c58e);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); geos.push(g); }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = true; m.receiveShadow = true; clinic.add(m); return m; })();
const heldPage = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), new THREE.MeshLambertMaterial({ map: pageTexs[2], side: THREE.DoubleSide })); clinic.add(heldPage);
const dust = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshLambertMaterial({ color: 0xe8e2d6, transparent: true, opacity: 0.8, depthWrite: false, flatShading: true })); clinic.add(m); dust.push(m); }
const papersN = 60;
const papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xfbfaf3, side: THREE.DoubleSide }), papersN); papers.frustumCulled = false; clinic.add(papers);
function burst(t, center) {
  const r = RNG(7); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  dust.forEach((d, i) => { const a = i / dust.length * PI * 2; const s = 0.3 + easeOut(t / 0.6) * (1.2 + r()); d.position.copy(center).add(V(Math.cos(a) * s * 1.1, 0.15 + r() * 0.6 + t * 0.4, -Math.abs(Math.sin(a)) * s * 0.6)); d.scale.setScalar(0.6 + easeOut(t / 0.5) * (0.8 + r())); d.material.opacity = 0.7 * Math.max(0, 1 - t / 0.9); d.visible = true; });
  for (let i = 0; i < papersN; i++) {
    const a = r() * PI * 2, sp = 1.5 + r() * 2.5, up = 2 + r() * 2.5;
    const tt = Math.min(t, 1.2); const p = center.clone().add(V(Math.cos(a) * sp * tt, up * tt - 3.2 * tt * tt + 0.2, Math.sin(a) * sp * tt * 0.6));
    q.setFromEuler(e.set(r() * 6 + t * 6, r() * 6 + t * 4, r() * 3)); m4.compose(p, q, V(1, 1, 1)); papers.setMatrixAt(i, m4);
  }
  papers.instanceMatrix.needsUpdate = true; papers.visible = true;
}
const winStink = new StinkLines(clinic, 7, { spread: 0.6, height: 4.5, radius: 0.07, amp: 0.25, speed: 0.6 });
winStink.group.position.copy(CL.winStinkAnchor);

// ================= 1973 SETS =================
const seventies = new THREE.Scene();
seventies.background = gradientTex([[0, '#8ab4d8'], [1, '#e8dcc0']]);
seventies.add(new THREE.HemisphereLight(0xfff0d8, 0x8a7350, 1.8));
const s70 = new THREE.DirectionalLight(0xffe2b0, 2.0); s70.position.set(-8, 14, 10); s70.castShadow = true; s70.shadow.mapSize.set(2048, 2048);
Object.assign(s70.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
seventies.add(s70, s70.target);
{ const gt = noiseTex(0x7a9a50, 0.12, 16, 9).clone(); gt.needsUpdate = true; gt.repeat.set(60, 20);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(300, 80), new THREE.MeshLambertMaterial({ map: gt })); g.rotation.x = -PI / 2; g.position.set(60, -0.02, 0); g.receiveShadow = true; seventies.add(g); }
// office (x=0)
box(4, 0.04, 4, mat(0x8a5a3a, { noise: 0.1 }), 0, 0, 0, seventies);
box(4, 3, 0.15, mat(0x9a6a3a), 0, 1.5, -1.8, seventies);
for (let x = -1.9; x <= 1.9; x += 0.3) box(0.03, 3, 0.02, mat(0x6a4422), x, 1.5, -1.72, seventies);
box(0.15, 3, 4, mat(0xd8c8a0), -2, 1.5, 0, seventies);
box(1.8, 0.08, 0.9, mat(0x7a4a24), 0, 0.78, -0.2, seventies); box(1.7, 0.74, 0.8, mat(0x6a3e1c), 0, 0.37, -0.2, seventies);
for (let i = 0; i < 6; i++) box(0.28, 0.01 + i * 0.006, 0.36, mat(0xf3ead2), -0.5 + (i % 3) * 0.06, 0.83 + i * 0.008, -0.05, seventies);
box(0.4, 0.16, 0.3, mat(0x4a6a5a), 0.5, 0.9, -0.25, seventies);
cyl(0.03, 0.03, 0.4, 6, mat(0x222222), -0.75, 1.0, -0.45, seventies); const shade70 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 8, 1, true), mat(0xd47a22, { double: true })); shade70.position.set(-0.75, 1.28, -0.45); seventies.add(shade70);
for (let i = 0; i < 8; i++) box(0.12, 0.38, 0.28, mat([0xa83a2a, 0xd4a017, 0x2e6b6b, 0x6b3e1e][i % 4]), -1.0 + i * 0.13, 2.2, -1.62, seventies);
box(1.3, 0.04, 0.32, mat(0x6a4422), -0.55, 1.99, -1.62, seventies);
const sci = new Person({ kind: 'man', skin: C.skinD, hair: 0x6a4422, hairStyle: 'seventies', top: 0xd8b860, bottom: 0x5a3e22, shoes: 0x3a2a1a, collar: 0xf3ead2, tie: 0x6b3e1e, mustache: true, glasses: 'big', flare: true });
seventies.add(sci.group);
// hospital exterior 70s (x=40)
const brick = mat(0x9a4a32, { noise: 0.12, size: 16 });
box(14, 7, 0.4, brick, 40, 3.5, -0.2, seventies);
for (const x of [-5, -3.5, 3.5, 5]) for (const y of [2, 5]) { box(1.0, 1.3, 0.06, mat(0x2a3440), 40 + x, y, 0.02, seventies); box(1.1, 0.1, 0.12, mat(0xe8dcc0), 40 + x, y - 0.7, 0.05, seventies); }
box(2.2, 2.6, 0.08, mat(0x5a3a22), 40, 1.3, 0.02, seventies); box(0.06, 2.6, 0.1, mat(0xd8c8a0), 40, 1.3, 0.07, seventies);
box(3.0, 0.15, 1.2, mat(0xc8c0b0), 40, 0.07, 0.6, seventies); box(3.6, 0.3, 0.12, mat(0xe8dcc0), 40, 3.0, 0.05, seventies);
box(2.6, 0.03, 14, mat(0xc8c0b0), 40, 0.0, 7.5, seventies);
const extTrees = []; { const r = RNG(12); for (let i = 0; i < 6; i++) tree70(extTrees, 40 + (i < 3 ? -1 : 1) * (5 + r() * 6), 4 + r() * 6, 0.9 + r() * 0.4, r); }
function tree70(geos, x, z, s, rnd) {
  const add = (w, h, d, px, py, pz, col) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(px, py, pz); const c = new THREE.Color(col); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); geos.push(g); };
  add(0.4 * s, 2.4 * s, 0.4 * s, x, 1.2 * s, z, 0x6b4a2e); add(2.2 * s, 1.4 * s, 2.2 * s, x, 2.9 * s, z, 0xd27a2a); add(1.5 * s, 1.0 * s, 1.5 * s, x, 3.9 * s, z, 0xe0a030);
}
const visitors = [
  { skin: C.skinB, hair: 0x3a2a1a, hairStyle: 'afro', top: 0xd2691e, bottom: 0x6b4423, collar: 0xf3ead2 },
  { kind: 'woman', skin: C.skinD, hair: 0xd8b25a, hairStyle: 'long', top: 0x2e8b8b, bottom: 0x8b5a2b },
  { skin: C.skinC, hair: C.hairBlack, hairStyle: 'seventies', top: 0xd4a017, bottom: 0x4a3a2a, collar: 0xffffff, mustache: true },
  { kind: 'woman', skin: C.skinA, hair: 0x6a3a1e, hairStyle: 'afro', top: 0x9a3a4a, bottom: 0x5a3e22 },
  { skin: C.skinD, hair: 0x8a5a2a, hairStyle: 'seventies', top: 0x7a8a3a, bottom: 0x3b3f4a, collar: 0xf3ead2, glasses: 'big' },
].map(o => { const p = new Person(Object.assign({ kind: 'man', shoes: 0x3a2a1a, flare: o.kind !== 'woman' }, o)); seventies.add(p.group); return p; });
const visitors2 = visitors.map(v => { const p = new Person(v.cfg); seventies.add(p.group); return p; });
// reception 70s (x=80)
box(8, 0.04, 6, mat(0xb8a888, { noise: 0.08, size: 16 }), 80, 0, 0, seventies);
box(8, 3.2, 0.15, mat(0xa8c0a0), 80, 1.6, -2.6, seventies); box(8, 0.9, 0.16, mat(0x6a8a6a), 80, 0.45, -2.58, seventies);
box(2.6, 1.05, 0.7, mat(0x7a4a24), 81.6, 0.52, -1.4, seventies); box(2.7, 0.06, 0.8, mat(0x9a6a3a), 81.6, 1.07, -1.4, seventies);
const nurse70 = new Person({ kind: 'woman', skin: C.skinA, hair: 0x3a2a1a, hairStyle: 'bun', top: 0xf6f4ee, bottom: 0xf6f4ee, shoes: 0xffffff });
box(0.34, 0.12, 0.2, mat(0xffffff), 0, 0.56, 0.06, nurse70.head); seventies.add(nurse70.group);
const band70 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), mat(0xffffff)); seventies.add(band70);
// lounge 70s (x=120)
box(5, 0.04, 4, mat(0xa0784a, { noise: 0.1 }), 120, 0, 0, seventies);
{ const wm = mat(0xd8c8a0);
  box(2.1, 3, 0.15, wm, 118.55, 1.5, -1.6, seventies); box(0.9, 3, 0.15, wm, 122.05, 1.5, -1.6, seventies);
  box(2.0, 0.9, 0.15, wm, 120.6, 0.45, -1.6, seventies); box(2.0, 0.5, 0.15, wm, 120.6, 2.75, -1.6, seventies);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 0.02), new THREE.MeshLambertMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.15, depthWrite: false })); gl.position.set(120.6, 1.7, -1.55); seventies.add(gl); }
box(2.2, 0.1, 0.16, mat(0x7a4a24), 120.6, 0.86, -1.48, seventies); box(2.2, 0.1, 0.16, mat(0x7a4a24), 120.6, 2.54, -1.48, seventies);
box(0.08, 1.7, 0.16, mat(0x7a4a24), 119.55, 1.7, -1.48, seventies); box(0.08, 1.7, 0.16, mat(0x7a4a24), 121.65, 1.7, -1.48, seventies); box(0.06, 1.7, 0.12, mat(0x7a4a24), 120.6, 1.7, -1.47, seventies);
tree70(extTrees, 121.2, -4.5, 1.1, RNG(3));
const armchair = new THREE.Group(); armchair.position.set(119.6, 0, -0.5); seventies.add(armchair);
box(0.9, 0.42, 0.8, mat(0xc86a28), 0, 0.21, 0, armchair); box(0.9, 0.7, 0.2, mat(0xc86a28), 0, 0.75, -0.32, armchair);
box(0.15, 0.62, 0.8, mat(0xb85a20), 0.45, 0.4, 0, armchair); box(0.15, 0.62, 0.8, mat(0xb85a20), -0.45, 0.4, 0, armchair);
const bored = new Person({ kind: 'man', skin: C.skinB, hair: 0x5a3a1a, hairStyle: 'afro', top: 0x8a6a3a, bottom: 0x4a3a2a, collar: 0xf3ead2, beard: true, flare: true });
seventies.add(bored.group);
const leaves = new Particles(seventies, 60, [0xd2691e, 0xe0a030, 0xb8481e, 0xf0c050], { size: [0.08, 0.06], area: [3, 3.5, 1.2], center: [120.6, 2.2, -3.0], fall: 0.5, spin: 3, seed: 21 });
{ const m = new THREE.Mesh(mergeGeometries(extTrees), new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.1, 8, 21) })); m.castShadow = true; seventies.add(m); }

// ================= PROJECTOR ROOM =================
const projRoom = new THREE.Scene();
projRoom.background = new THREE.Color(0x0b0a09);
projRoom.add(new THREE.AmbientLight(0x6a5a4a, 0.5));
const pl = new THREE.PointLight(0xffe8b8, 6, 6, 1.5); pl.position.set(0.3, 1.4, 0.4); projRoom.add(pl);
box(1.6, 0.06, 0.9, mat(0x6a4a2a), 0, 0.8, 0, projRoom); for (const [x, z] of [[-0.7, -0.38], [0.7, -0.38], [-0.7, 0.38], [0.7, 0.38]]) box(0.06, 0.8, 0.06, mat(0x5a3a1a), x, 0.4, z, projRoom);
const proj = new THREE.Group(); proj.position.set(0, 0.83, 0); projRoom.add(proj);
box(0.5, 0.34, 0.3, mat(0x3a3f44), 0, 0.17, 0, proj); box(0.12, 0.1, 0.1, mat(0x2a2e33), 0.31, 0.17, 0, proj);
const lens = cyl(0.06, 0.07, 0.14, 12, mat(0x111111), 0.4, 0.17, 0, proj); lens.rotation.z = PI / 2;
const reels = [V(-0.12, 0.62, 0), V(0.18, 0.6, 0)].map(p => { const g = new THREE.Group(); g.position.copy(p); proj.add(g);
  const r = cyl(0.2, 0.2, 0.04, 16, mat(0x8a8f94), 0, 0, 0, g); r.rotation.x = PI / 2; for (let i = 0; i < 3; i++) { const s = box(0.06, 0.3, 0.05, mat(0x2a2e33), 0, 0, 0.0, g); s.rotation.z = i * PI / 3; } return g; });
box(0.04, 0.3, 0.04, mat(0x3a3f44), -0.12, 0.42, 0, proj); box(0.04, 0.28, 0.04, mat(0x3a3f44), 0.18, 0.42, 0, proj);
const beam = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
beam.rotation.z = PI / 2; beam.position.set(0.47 + 3, 1.0, 0); projRoom.add(beam);
const beamDust = new Particles(projRoom, 90, [0xfff4d8], { size: [0.012, 0.012], area: [5, 1.4, 1.4], center: [3.3, 1.0, 0], fall: 0.04, spin: 1, seed: 5 });
beamDust.mesh.material = new THREE.MeshBasicMaterial({ color: 0xfff4d8, side: THREE.DoubleSide });

// ================= helpers =================
function setCam(pos, look, fov = 42) { camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look); }
function moveCam(u, p0, p1, l0, l1, f0, f1 = f0) { setCam(p0.clone().lerp(p1, u), l0.clone().lerp(l1, u), lerp(f0, f1, u)); }
function aim(target, dir, dist, fov) { setCam(target.clone().add(dir.clone().normalize().multiplyScalar(dist)), target, fov); }
function worldOf(obj, local = V(0, 0, 0)) { obj.updateWorldMatrix(true, false); return obj.localToWorld(local.clone()); }
function reachTo(p, arm, target) {
  p.group.updateMatrixWorld(true);
  const sh = worldOf(arm.g); const d = target.clone().sub(sh).normalize();
  const inv = new THREE.Quaternion(); p.torso.getWorldQuaternion(inv); inv.invert();
  arm.g.quaternion.setFromUnitVectors(V(0, -1, 0), d.applyQuaternion(inv));
}
const talk = (t, rate = 8, ph = 0) => (Math.sin((t + ph) * rate * PI) > 0.1 ? 'open' : 'flat');
const pulse = (t, at, len = 0.25) => clamp(1 - Math.abs(t - at) / len);
function walkPose(p, t, rate = 7, amp = 0.5, arms = true) {
  const s = Math.sin(t * rate);
  p.legs[0].thigh.rotation.x = s * amp; p.legs[1].thigh.rotation.x = -s * amp;
  p.legs[0].knee.rotation.x = Math.max(0, -s) * amp; p.legs[1].knee.rotation.x = Math.max(0, s) * amp;
  p.hips.position.y = 0.9 + Math.abs(Math.cos(t * rate)) * 0.03;
  if (arms) { p.pointArm(p.armL, [0.08, -1, -s * 0.45]); p.pointArm(p.armR, [-0.08, -1, s * 0.45]); }
}
function place(p, x, z, ry, y = 0) { p.group.visible = true; p.group.position.set(x, y, z); p.group.rotation.set(0, ry, 0); }
const FACE = (p) => worldOf(p.face, V(0, -0.02, 0.05));
function faceDir(p, yaw = 0, pitch = 0) { const q = new THREE.Quaternion(); p.head.getWorldQuaternion(q); return V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(q); }
function camFace(p, dist, fov, yaw = 0, pitch = 0, off = V(0, 0, 0)) { p.group.updateMatrixWorld(true); aim(FACE(p).add(off), faceDir(p, yaw, pitch), dist, fov); }

let POOP_T = 0, BAND_T = 999, UNDER_T = 999, CUR_T = 0;
const YOU_SEAT = [0, 0.6];
function youSit(x = YOU_SEAT[0], z = YOU_SEAT[1]) { place(you, x, z, PI); you.sit(0.47); lumpPose('sit'); }
function resetClinic(T) {
  setTime('day');
  for (const p of clinicCast) { p.reset(); p.group.visible = false; p.setFace({}); }
  youSit(); you.setFace({ mouth: 'smile' });
  you.pointArm(you.armL, [0.15, -0.55, 0.8]); you.pointArm(you.armR, [-0.15, -0.55, 0.8]);
  flowers.visible = false; flowers.position.set(0, 0.06, 0.45); flowers.rotation.set(-1.1, 0, 0);
  magazine.visible = false; band.visible = T > BAND_T; heldBand.visible = false;
  const pooped = T >= POOP_T;
  lump.visible = pooped; stain.visible = pooped; youStink.visible = pooped; bigStink.visible = false;
  lumpMesh.scale.set(1.15, 0.95, 1.0);
  if (pooped) youStink.update(T);
  drops.forEach(d => (d.visible = false));
  place(reader, 2.5, 0.6, PI); reader.sit(0.47); reader.skirt.scale.set(0.8, 0.6, 1.2); reader.skirt.position.set(0, -0.08, 0.18);
  reader.pointArm(reader.armL, [0.25, -0.2, 0.9]); reader.pointArm(reader.armR, [-0.25, -0.2, 0.9]); book.position.set(0, 0.32, 0.5); book.rotation.set(-0.6, 0, 0);
  reader.setFace({ eyes: 'squint', look: [0, -0.01], mouth: 'smile' }); reader.head.rotation.x = 0.25;
  place(card1, -2.0, 2.5, PI / 2); card1.sit(0.47); place(card2, -0.6, 2.5, -PI / 2); card2.sit(0.47);
  for (const [i, p] of [card1, card2].entries()) {
    p.pointArm(p.armL, [0.1, -0.1, 1]); p.pointArm(p.armR, [-0.1, -0.1, 1]); cards[i].position.set(0, 0.42, 0.5); cards[i].rotation.set(-0.4, 0, 0);
    p.setFace({ eyes: 'squint', mouth: i ? 'smile' : 'flat', look: [0, -0.01] }); p.head.rotation.x = 0.2;
  }
  place(waterer, 4.2, 3.7, 0.3); waterer.pointArm(waterer.armR, [-0.1, -0.2, 1]); can.position.set(-0.3, 0.38, 0.55); can.rotation.set(0.5, 0, 0); waterer.setFace({ mouth: 'smile', eyes: 'happy' });
  place(doc, 1.4, -3.5, -0.33); doc.pointArm(doc.armL, [0.15, -0.3, 0.9]); doc.pointArm(doc.armR, [-0.1, -0.85, 0.3]); doc.setFace({ mouth: 'smile' });
  clip.visible = false; pen.visible = false; penHand.visible = false; wrist.visible = false; pagesG.visible = false; file.visible = false; pile.visible = false;
  heldPage.visible = false; dust.forEach(d => (d.visible = false)); papers.visible = false; spray.visible = false; winStink.visible = false;
  cal.visible = true; flyPages.forEach(p => (p.visible = false)); calBase.material.map = calTexs[1];
  plantState(CL.plantYou, 0, 0); CL.setDoors(0);
}
function docClip(t = 0, writing = false) { // clipboard in doctor's hands
  clipUnderline(CUR_T > UNDER_T ? 2.4 : 0);
  doc.group.updateMatrixWorld(true);
  clip.visible = true; const p = worldOf(doc.torso, V(0.02, 0.36, 0.42));
  clip.position.copy(p); const q = new THREE.Quaternion(); doc.torso.getWorldQuaternion(q); clip.quaternion.copy(q); clip.rotateX(-0.75);
  reachTo(doc, doc.armL, worldOf(clip, V(-0.15, -0.05, 0)));
  pen.visible = true; const pp = worldOf(clip, V(-0.05 + (writing ? 0.12 * Math.sin(t * 9) : 0), 0.02 + (writing ? 0.02 * Math.sin(t * 23) : 0), 0.03));
  pen.position.copy(pp); pen.quaternion.copy(clip.quaternion); pen.rotateX(0.7); pen.rotateZ(-0.4);
  reachTo(doc, doc.armR, pp.clone().add(V(0.05, -0.08, 0.05)));
}

// ================= SHOTS =================
const SH = {};
SH['01'] = (t, d) => { // walks in with flowers
  place(you, 0, lerp(7.2, 3.6, t / d), PI); you.reset(); walkPose(you, t, 7, 0.45, false); lumpPose('stand');
  you.pointArm(you.armL, [0.15, -0.5, 0.85]); you.pointArm(you.armR, [-0.25, -0.75, 0.6]);
  flowers.visible = true; flowers.position.set(-0.05, 0.3, 0.42); flowers.rotation.set(0.1, 0, 0);
  you.setFace({ eyes: 'happy', mouth: 'bigsmile' });
  CL.setDoors(clamp(t / 0.5 + 0.3));
  moveCam(ease(t / d), V(1.6, 1.55, 0.6), V(1.3, 1.55, 0.9), V(0.0, 1.35, 4.5), V(0.0, 1.4, 4.2), 44);
};
SH['02'] = (t, d) => { // wide waiting room, friendly people
  flowers.visible = true; you.setFace({ mouth: 'smile', look: [0.02, 0] });
  card2.pointArm(card2.armR, [-0.1, 0.1 + Math.max(0, Math.sin(t * 3)) * 0.3, 1]);
  moveCam(ease(t / d), V(-5.2, 2.7, -4.3), V(-3.6, 2.7, -4.6), V(0.6, 0.8, 1.6), V(1.6, 0.8, 1.8), 56);
};
const poopCam = () => setCam(V(-2.35, 1.42, 1.15), V(0.0, 0.92, 0.55), 40);
SH['03a'] = (t, d) => { flowers.visible = true; you.setFace({ mouth: 'smile', eyes: 'happy' }); poopCam(); };
SH['03b'] = (t) => {
  flowers.visible = true; poopCam();
  const u = easeOut(t / 0.22);
  you.head.rotation.y = 1.25 * u; you.head.rotation.x = 0.05 * u;
  you.setFace({ eyes: 'wide', brows: 'raised', mouth: t < 0.5 ? 'o' : 'wavy' });
  lumpMesh.scale.set(1.15 * (0.55 + 0.45 * u), 0.95 * (0.55 + 0.45 * u), 1.0 * (0.55 + 0.45 * u));
  drops[0].visible = t > 0.4; drops[0].position.set(0.2, 0.42 - (t - 0.4) * 0.1, 0.18);
};
SH['04'] = (t, d, T) => { // the room notices (politely)
  flowers.visible = true; you.setFace({ eyes: 'wide', mouth: 'wavy', brows: 'worried' });
  youStink.visible = false; bigStink.visible = true; bigStink.update(T);
  const look = ease((t - 0.3) / 0.8);
  card2.pointArm(card2.armL, [0.1, -0.1 - look * 0.6, 1 - look * 0.4]); card2.pointArm(card2.armR, [-0.1, -0.1 - look * 0.6, 1 - look * 0.4]);
  card2.head.rotation.y = 1.1 * look; card2.head.rotation.x = 0.2 * (1 - look);
  card2.setFace({ eyes: look > 0.5 ? 'wide' : 'squint', mouth: 'flat', brows: look > 0.5 ? 'raised' : 'normal', look: [0, 0] });
  moveCam(ease(t / d), V(-0.7, 1.5, -2.2), V(-0.9, 1.6, -2.7), V(-0.55, 1.15, 1.2), V(-0.55, 1.2, 1.2), 50);
};
SH['05'] = (t, d) => { // magazine upside down
  magazine.visible = true; magazine.position.set(0, 0.42, 0.42); magazine.rotation.set(0.1, 0, 0);
  you.pointArm(you.armL, [0.35, 0.05, 0.94]); you.pointArm(you.armR, [-0.35, 0.05, 0.94]);
  you.setFace({ mouth: 'grimace', brows: 'worried', look: [0, 0] });
  drops[0].visible = true; drops[0].position.set(0.2, 0.44 - t * 0.06, 0.18);
  you.group.updateMatrixWorld(true);
  aim(worldOf(you.torso, V(0, 0.62, 0.1)), V(0.25, 0.12, -1), lerp(2.35, 2.1, ease(t / d)), 40);
};
function crab(t, x) {
  place(you, x, -4.45, 0); you.reset(); lumpPose('stand');
  you.torso.rotation.x = -0.12;
  const s = Math.sin(t * 6);
  you.legs[0].thigh.rotation.z = 0.12 + 0.18 * Math.max(0, s); you.legs[1].thigh.rotation.z = -0.12 - 0.18 * Math.max(0, -s);
  you.hips.position.y = 0.88 + 0.02 * Math.abs(s);
  you.pointArm(you.armL, [0.95, 0.1, -0.35]); you.pointArm(you.armR, [-0.95, 0.1, -0.35]);
  you.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried', look: [-0.03, 0] });
}
SH['06'] = (t, d, T) => {
  crab(t, lerp(-2.4, -2.75, t / d)); youStink.update(T);
  moveCam(ease(t / d), V(-0.4, 1.3, -1.6), V(-0.7, 1.3, -1.6), V(-2.4, 0.95, -4.4), V(-2.75, 0.95, -4.4), 46);
};
SH['07'] = (t, d, T) => { // very long hallway, he barely moves
  place(you, lerp(-8.4, -8.5, t / d), -0.92, 0); you.reset(); lumpPose('stand');
  you.pointArm(you.armL, [0.95, 0.1, -0.35]); you.pointArm(you.armR, [-0.95, 0.1, -0.35]); youStink.update(T);
  you.setFace({ eyes: 'wide', mouth: 'grimace' });
  moveCam(ease(t / d), V(-35.2, 1.65, 0.25), V(-35.2, 1.65, 0.25), V(-8.4, 1.0, -0.5), V(-8.4, 1.0, -0.5), 34, 30);
};
SH['08'] = (t, d, T) => { // whisper to yourself
  place(you, -8.5, -0.92, 0); you.reset(); lumpPose('stand'); youStink.update(T);
  you.pointArm(you.armR, [-0.55, 0.75, 0.4]); you.pointArm(you.armL, [0.95, 0.1, -0.35]);
  you.head.rotation.y = -0.25;
  you.setFace({ eyes: 'squint', mouth: Math.sin(t * 22) > 0 ? 'whisper' : 'flat', brows: 'worried', look: [-0.02, 0] });
  sweatAnim(t, 2, 0.15);
  camFace(you, lerp(1.25, 1.1, ease(t / d)), 36, -0.75, 0.0);
};
SH['09'] = (t, d, T, ev) => { // "It's fine. It's fine." eye twitch
  place(you, -8.5, -0.92, 0); you.reset(); lumpPose('stand');
  you.pointArm(you.armL, [0.95, 0.1, -0.35]); you.pointArm(you.armR, [-0.95, 0.1, -0.35]);
  let tw = false; for (const f of ev.fines || []) if (t > f && t < f + 0.35 && Math.sin((t - f) * 70) > 0) tw = true;
  you.setFace({ eyes: 'twitch', tw, mouth: Math.sin(t * 20) > 0.2 ? 'whisper' : 'flat', brows: 'worried' });
  sweatAnim(t, 7, 0.4, 0.75);
  camFace(you, lerp(1.4, 1.25, ease(t / d)), 38, 0.05, 0.02);
};
SH['10'] = (t, d) => { // you sweat
  youSit(); you.setFace({ eyes: 'normal', brows: 'worried', mouth: 'flat', look: [-0.03, 0] });
  sweatAnim(t * 0.6, 4, 0.5, 0.9);
  camFace(you, lerp(1.15, 1.05, ease(t / d)), 36, 0.0, 0.05, V(0, 0.1, 0));
};
SH['11'] = (t, d) => { // a lot: sprinkler
  place(you, -0.05, 0.2, PI); you.reset(); lumpPose('stand');
  you.pointArm(you.armL, [0.25, -1, 0]); you.pointArm(you.armR, [-0.25, -1, 0]);
  you.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried' });
  you.group.updateMatrixWorld(true);
  spray.visible = true; sprayUpdate(t + 2, worldOf(you.head, V(0, 0.4, 0)));
  plantState(CL.plantYou, 0, ease(t / d));
  moveCam(ease(t / d), V(1.9, 1.7, -2.6), V(1.75, 1.7, -2.4), V(0.25, 1.15, 0.3), V(0.25, 1.15, 0.3), 48);
};
SH['12'] = (t, d) => { // doctor watching (over your shoulder)
  you.setFace({ mouth: 'flat', eyes: 'normal' });
  doc.glasses.position.y = -0.045; doc.head.rotation.x = 0.12; doc.setFace({ eyes: 'normal', look: [0, 0.018], mouth: 'flat', brows: 'raised' });
  doc.pointArm(doc.armL, [0.15, -0.3, 0.9]); docClip();
  moveCam(ease(t / d), V(0.42, 1.5, 1.75), V(0.42, 1.5, 1.75), V(1.2, 1.5, -3.4), V(1.38, 1.75, -3.5), 44, 22);
};
SH['13'] = (t, d) => { // writes something down
  doc.setFace({ eyes: 'squint', look: [0, -0.02], mouth: 'flat' }); doc.head.rotation.x = 0.3; docClip(t, true);
  camFace(doc, lerp(1.45, 1.3, ease(t / d)), 40, 0.25, -0.12, V(0, -0.3, 0));
};
SH['14'] = (t, d, T, ev) => { // then he underlines it
  docClip(); doc.group.visible = false; penHand.visible = true;
  const u = (t - (ev.under || 0.4)) / 0.3; clipUnderline(u);
  const a = worldOf(clip, V(-0.115 + 0.21 * clamp(u), 0.005, 0.03)), b = worldOf(clip, V(-0.115 + 0.21 * clamp(u - 1.2), -0.02, 0.03));
  pen.position.copy(u > 1.2 ? b : a);
  const n = V(0, 0, 1).applyQuaternion(clip.quaternion);
  setCam(worldOf(clip, V(0.0, 0.0, 0)).add(n.multiplyScalar(lerp(0.52, 0.46, ease(t / d)))), worldOf(clip, V(0.0, 0.0, 0)), 42);
};
SH['15'] = (t, d) => { // you smile at him
  you.setFace({ mouth: 'smile', brows: 'worried', look: [0.01, 0.01] }); sweatAnim(t, 2, 0.1);
  camFace(you, lerp(1.35, 1.3, ease(t / d)), 38, 0.1, 0.05);
};
SH['16'] = (t, d) => { // that makes it worse
  you.setFace({ mouth: 'creepy', eyes: 'wide', brows: 'high', look: [0.01, 0.01] }); sweatAnim(t, 4, 0.12);
  camFace(you, lerp(1.55, 1.2, Math.pow(ease(t / d), 1.3)), 36, 0.0, 0.03);
};
SH['17'] = (t, d) => { // he walks over
  const u = t / d; place(doc, lerp(1.2, 0.45, u), lerp(-3.2, -1.0, u), -0.25); doc.reset(); walkPose(doc, t, 5.5, 0.35, false);
  doc.pointArm(doc.armL, [0.15, -0.3, 0.9]); doc.setFace({ mouth: 'smile', eyes: 'normal' }); docClip();
  you.group.visible = false;
  moveCam(ease(t / d), V(0.05, 0.95, 0.55), V(0.05, 0.95, 0.5), V(0.7, 1.55, -2.2), V(0.4, 1.7, -1.0), 50);
};
const docNear = () => { place(doc, 0.25, -0.55, -0.15); doc.torso.rotation.x = 0.28; doc.pointArm(doc.armL, [0.15, -0.3, 0.9]); };
SH['18'] = (t, d, T) => { // "How are you feeling today?"
  docNear(); doc.setFace({ mouth: T < (window.__q1 || 999) ? talk(t, 7) : 'smile', eyes: 'normal', brows: 'raised', look: [0, -0.01] }); docClip();
  you.group.visible = false;
  camFace(doc, lerp(1.2, 1.05, ease(t / d)), 38, 0.18, -0.22);
};
SH['19'] = (t, d) => { // "I just need a bathroom."
  you.pointArm(you.armL, [0.32, 0.25, 0.92]); you.pointArm(you.armR, [-0.32, 0.25, 0.92]);
  you.head.rotation.x = -0.18;
  you.setFace({ mouth: talk(t, 8), brows: 'worried', eyes: 'normal', look: [0, 0.02] }); sweatAnim(t, 5, 0.25);
  doc.group.visible = false;
  camFace(you, lerp(1.25, 1.15, ease(t / d)), 38, 0.1, 0.3);
};
SH['20'] = (t, d) => { // he nods, hands you a wristband
  docNear(); doc.head.rotation.x = 0.12 + 0.18 * Math.max(0, Math.sin(t * 9)) * (t < 0.7 ? 1 : 0);
  doc.setFace({ mouth: 'smile', eyes: 'happy' });
  doc.pointArm(doc.armR, [0.25, 0.55, 0.8]); doc.pointArm(doc.armL, [0.15, -0.9, 0.2]);
  doc.group.updateMatrixWorld(true);
  const hp = worldOf(doc.armR.hand, V(0, -0.08, 0));
  band70.visible = false; wristBand.visible = false;
  clinic.add(heldBand); heldBand.visible = true; heldBand.position.copy(hp); heldBand.rotation.set(PI / 2, 0, 0);
  you.group.visible = false;
  moveCam(ease(t / d), V(0.1, 1.45, 1.35), V(0.1, 1.45, 1.2), V(0.2, 1.45, -0.4), V(0.2, 1.45, -0.4), 46);
};
const heldBand = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 18, PI * 1.4), mat(0xf6f6f6)); clinic.add(heldBand);
SH['21'] = (t, d, T, ev) => { // wristband snaps shut (slow-mo)
  you.group.visible = false;
  wrist.visible = true; wristBand.visible = true; wrist.position.set(-0.3, 0.95, 1.4); wrist.rotation.set(0, 0.25, 0);
  const a = easeOut(clamp((t - 0.05) / ((ev.click || 0.6) - 0.05)));
  bandClose(a); wristBand.scale.setScalar(t > (ev.click || 0.6) ? 1 + 0.12 * Math.exp(-(t - ev.click) * 12) : 1);
  setCam(V(-0.18, 1.32, 1.95), V(-0.26, 0.95, 1.4), lerp(30, 27, ease(t / d)));
};
SH['22'] = (t, d) => { // it already has your name on it
  band.visible = true;
  you.pointArm(you.armL, [0.55, 0.62, 0.55]); you.pointArm(you.armR, [-0.2, -0.6, 0.7]);
  you.head.rotation.y = 0.35; you.head.rotation.x = 0.05;
  you.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised', look: [0.035, 0] }); sweatAnim(t, 3, 0.15);
  you.group.updateMatrixWorld(true);
  const mid = FACE(you).lerp(worldOf(band), 0.45);
  aim(mid, faceDir(you, -0.25, 0.05), lerp(1.55, 1.4, ease(t / d)), 40);
};
SH['23'] = (t, d) => { // projector
  reels.forEach((r, i) => (r.rotation.z = -t * (i ? 4 : 3)));
  beamDust.update(t + 3, 1);
  beam.material.opacity = 0.11 + 0.02 * Math.sin(t * 31);
  moveCam(ease(t / d), V(-1.3, 1.35, 1.9), V(-1.0, 1.3, 1.6), V(0.3, 1.05, 0), V(0.4, 1.05, 0), 44);
};
function sun70(x) { s70.target.position.set(x, 0, 0); s70.position.set(x - 8, 14, 10); }
function seventiesReset() { for (const p of [sci, ...visitors, ...visitors2, nurse70, bored]) { p.reset(); p.group.visible = false; p.setFace({}); } band70.visible = false; }
SH['24'] = (t, d) => { // 1973 scientist
  sun70(0); place(sci, 0, -0.75, 0); sci.sit(0.47);
  sci.pointArm(sci.armR, [-0.2, 0.95, 0.25]); sci.pointArm(sci.armL, [0.2, -0.2, 0.95]);
  sci.head.rotation.x = -0.12 + Math.sin(t * 2.5) * 0.04;
  sci.setFace({ eyes: 'normal', brows: 'raised', mouth: 'smile', look: [0, 0.012] });
  moveCam(ease(t / d), V(0.55, 1.55, 2.2), V(0.45, 1.6, 1.75), V(0, 1.3, -0.7), V(0, 1.35, -0.7), 42);
};
SH['25'] = (t, d) => { // healthy people walk into hospitals
  sun70(40); visitors.forEach((p, i) => { const z = lerp(8.0, 3.4, t / d) + i * 1.05; place(p, 40 + Math.sin(i) * 0.15, z, PI); walkPose(p, t + i * 0.4, 6.5, 0.4);
    p.setFace({ mouth: 'smile', eyes: i % 2 ? 'happy' : 'normal' }); });
  moveCam(ease(t / d), V(43.6, 2.3, 14.0), V(43.0, 2.2, 13.2), V(40, 1.6, 4.6), V(40, 1.6, 3.6), 46);
};
SH['26'] = (t, d) => { // they all got admitted
  place(nurse70, 81.6, -1.75, 0); nurse70.skirt.visible = false; nurse70.pointArm(nurse70.armR, [-0.2, -0.05, 1]); nurse70.pointArm(nurse70.armL, [0.25, -0.05, 1]);
  nurse70.setFace({ mouth: 'smile', eyes: 'happy' });
  sun70(80);
  visitors2.forEach((p, i) => { const x = 81.3 - i * 0.8, z = -0.6 + i * 0.25; place(p, x, z, Math.atan2(81.6 - x, -1.75 - z));
    p.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' });
    if (i === 0) p.pointArm(p.armR, [-0.1, -0.2, 1]); });
  visitors2[0].group.updateMatrixWorld(true);
  band70.visible = true; band70.position.copy(worldOf(visitors2[0].armR.g, V(0, -0.5, 0))); band70.rotation.set(0, 0, 0);
  moveCam(ease(t / d), V(83.1, 1.95, -2.35), V(83.0, 1.95, -2.25), V(79.8, 1.3, 0.1), V(79.8, 1.3, 0.1), 56);
};
SH['27'] = (t, d) => { // couldn't get out for almost two months
  sun70(120); place(bored, 119.6, -0.45, 0.25); bored.sit(0.5);
  bored.pointArm(bored.armL, [0.12, 0.42, 0.9]); bored.pointArm(bored.armR, [-0.2, -0.5, 0.7]);
  bored.head.rotation.z = 0.12; bored.head.rotation.y = 0.35;
  bored.setFace({ eyes: 'tired', mouth: 'flat', look: [0.02, 0] });
  leaves.update(t + 2, 0.7);
  moveCam(ease(t / d), V(120.55, 1.6, 3.0), V(120.7, 1.7, 3.6), V(120.0, 1.3, -0.8), V(120.1, 1.35, -0.9), 44);
};
function calendarShot(t, d, week) {
  calBase.material.map = calTexs[week];
  flyPages.forEach((p, k) => {
    const a = (t - k * 0.08) / 0.34;
    p.visible = a < 1;
    p.userData.m.material.map = k === 0 ? calTexs[week - 1] : calTexs[0];
    if (k === 0 && week === 1) p.userData.m.material.map = calTexs[0];
    const e = easeOut(Math.max(0, a));
    p.position.set(e * (k % 2 ? -0.9 : 0.9), 0.32 + e * 0.5, 0.04 + 0.01 * (3 - k) + e * 0.4);
    p.rotation.set(-e * 1.4, 0, e * (k % 2 ? 0.8 : -0.8));
  });
  setCam(V(1.0, 1.72, -3.4), V(1.0, 1.7, -4.96), 44);
}
SH['28'] = (t, d) => calendarShot(t, d, 1);
SH['30'] = (t, d) => calendarShot(t, d, 2);
SH['32'] = (t, d) => calendarShot(t, d, 3);
SH['29'] = (t, d, T) => { // week one: thumbs up to the nurse
  place(you, -0.42, 0.05, PI / 2); you.reset(); lumpPose('stand'); youStink.update(T); band.visible = true;
  you.pointArm(you.armR, [-0.1, 0.35, 0.95]); you.pointArm(you.armL, [0.3, -0.9, 0.2]);
  you.setFace({ mouth: talk(t, 7), eyes: 'wide', brows: 'raised' }); sweatAnim(t, 1, 0.1);
  place(nurse, 0.45, 0.05, -PI / 2); nurse.pointArm(nurse.armL, [0.3, -0.4, 0.85]); nurse.pointArm(nurse.armR, [-0.3, -0.4, 0.85]);
  nurse.setFace({ mouth: 'smile', eyes: 'normal', brows: 'raised' });
  moveCam(ease(t / d), V(0.05, 1.6, -3.4), V(0.05, 1.6, -3.1), V(0.0, 1.3, 0.05), V(0.0, 1.32, 0.05), 46);
};
SH['31'] = (t, d, T) => { // week two: slumped, wilted plant
  youSit(); band.visible = true;
  you.hips.position.z = 0.12; you.hips.rotation.x = -0.25; you.torso.rotation.x = -0.15; you.head.rotation.x = 0.25; you.head.rotation.z = 0.15;
  you.pointArm(you.armL, [0.3, -1, -0.1]); you.pointArm(you.armR, [-0.3, -1, -0.1]);
  you.setFace({ eyes: 'tired', mouth: 'frown', look: [0, -0.01] });
  youStink.visible = false; bigStink.visible = true; bigStink.update(T);
  plantState(CL.plantYou, 1, 0);
  moveCam(ease(t / d), V(-1.7, 1.35, -1.8), V(-1.5, 1.3, -1.55), V(0.25, 0.9, 0.55), V(0.25, 0.9, 0.55), 46);
};
SH['33'] = (t, d) => { // nurse carries a giant file
  you.group.visible = false;
  const w = Math.sin(t * 7);
  place(nurse, lerp(0.6, 1.2, t / d), lerp(-0.6, -1.9, t / d), PI - 0.3); walkPose(nurse, t, 5, 0.25, false);
  nurse.torso.rotation.x = -0.18; nurse.torso.rotation.z = 0.08 * w;
  nurse.setFace({ eyes: 'tight', mouth: 'grimace', brows: 'worried' });
  nurse.group.updateMatrixWorld(true);
  file.visible = true; file.position.copy(worldOf(nurse.torso, V(0, 0.45, 0.62))); file.quaternion.copy(nurse.group.quaternion); file.rotateZ(0.12 * w); file.rotateX(-0.08);
  reachTo(nurse, nurse.armL, worldOf(file, V(0.35, -0.1, 0.2))); reachTo(nurse, nurse.armR, worldOf(file, V(-0.35, -0.1, 0.2)));
  moveCam(ease(t / d), V(4.6, 1.6, 0.1), V(4.6, 1.6, -0.3), V(1.0, 1.2, -1.0), V(1.3, 1.2, -1.7), 46);
};
SH['34'] = (t, d) => { // BOOM on the desk
  you.group.visible = false;
  file.visible = true; file.position.set(3.0, 1.36, -3.85); file.rotation.set(-PI / 2, 0, 0.15);
  place(nurse, 1.5, -3.1, PI * 0.75); nurse.pointArm(nurse.armL, [0.25, 0.05, 0.95]); nurse.pointArm(nurse.armR, [-0.25, 0.05 + 0.15 * Math.sin(t * 30), 0.95]);
  nurse.setFace({ eyes: 'happy', mouth: 'smile' });
  burst(t, V(3.0, 1.4, -3.6));
  doc.group.visible = false;
  moveCam(ease(t / d), V(0.4, 2.2, -0.3), V(0.45, 2.2, -0.4), V(2.7, 1.25, -3.7), V(2.7, 1.25, -3.7), 50);
};
SH['35'] = (t, d) => { // sitting in a pile of paperwork
  pile.visible = true; pile.position.set(-1.6, 0, -1.2);
  place(you, -1.6, -0.75, 0.1); you.reset(); you.sit(0.62); lumpPose('sit'); band.visible = true;
  you.pointArm(you.armL, [0.25, 0.55, 0.8]); you.pointArm(you.armR, [-0.3, -0.8, 0.5]);
  you.setFace({ eyes: 'tired', mouth: 'flat', look: [0.03, 0.02] }); you.head.rotation.x = -0.1; you.head.rotation.y = 0.2;
  you.group.updateMatrixWorld(true);
  heldPage.visible = true; heldPage.position.copy(worldOf(you.armL.hand, V(0, -0.15, 0.05))); heldPage.quaternion.copy(you.group.quaternion); heldPage.rotateY(-0.5); heldPage.rotateX(-0.2);
  moveCam(ease(t / d), V(-0.9, 1.7, 2.0), V(-1.0, 1.6, 1.6), V(-1.5, 1.0, -0.9), V(-1.5, 1.05, -0.9), 46);
};
SH['36'] = (t, d) => { // page flips
  pagesG.visible = true; pagesG.position.set(-3.0, 1.6, -4.7); pagesG.rotation.set(0, 0, 0);
  const flip = 0.45, k = Math.floor(t / flip), a = (t - k * flip) / 0.22;
  basePage.material.map = pageTexs[(k + 1) % 6];
  flipPage.material.map = pageTexs[k % 6];
  flipPivot.visible = a < 1; flipPivot.rotation.y = -PI * easeOut(clamp(a));
  setCam(V(-2.95, 1.62, -3.2), V(-3.0, 1.6, -4.7), 44);
};
SH['37'] = (t, d) => { // friend discharged, walks out into sunshine
  CL.setDoors(1);
  place(friend, lerp(0.0, 0.5, t / d), lerp(4.6, 7.6, t / d), 0.1); walkPose(friend, t, 6, 0.4, false);
  friend.pointArm(friend.armR, [-0.75, 0.6 + 0.2 * Math.sin(t * 14), 0.25]); friend.pointArm(friend.armL, [0.1, -1, 0.1]);
  friend.setFace({ eyes: 'happy', mouth: 'bigsmile' });
  place(you, 0.9, 3.9, 0); you.reset(); lumpPose('stand'); band.visible = true; you.setFace({ mouth: 'frown', eyes: 'tired' });
  moveCam(ease(t / d), V(1.6, 1.6, 12.0), V(1.5, 1.6, 11.5), V(0.2, 1.4, 5.6), V(0.4, 1.45, 7.2), 42);
};
SH['38'] = (t, d, T) => { // you behind the glass, waving sadly
  place(you, 0.1, 4.6, 0); you.reset(); lumpPose('stand'); band.visible = true; youStink.update(T);
  you.pointArm(you.armL, [0.25, 0.35, 0.9]); you.pointArm(you.armR, [-0.55, 0.65 + 0.12 * Math.sin(t * 4), 0.35]);
  you.setFace({ eyes: 'tired', mouth: 'frown', brows: 'worried' }); you.head.rotation.x = 0.08;
  sweatAnim(t, 1, 0.08);
  moveCam(ease(t / d), V(0.45, 1.75, 7.3), V(0.4, 1.75, 6.9), V(0.1, 1.7, 4.6), V(0.1, 1.72, 4.6), 40);
};
SH['39'] = (t, d) => { // sunset, stink from one window, zoom out
  setTime('sunset'); you.group.visible = false;
  winStink.visible = true; winStink.update(t + 1);
  moveCam(ease(t / d), V(-6.5, 4.5, 15.0), V(-12.5, 8.5, 28.0), V(1.0, 4.4, 2.0), V(0.0, 5.2, 0.0), 46, 50);
};

// ================= API =================
const ROOM = { '23': projRoom, '24': seventies, '25': seventies, '26': seventies, '27': seventies };
window.init = (data) => {
  const W = data.words; POOP_T = W[13].s - 0.03; window.__q1 = W[70].e + 0.05; BAND_T = W[84].e - 0.2; UNDER_T = W[53].s + 0.35;
  return true;
};
window.renderShot = (id, t, d, T, ev) => {
  const scn = ROOM[id] || clinic;
  CUR_T = T;
  if (scn === clinic) resetClinic(T); else if (scn === seventies) seventiesReset();
  SH[id](t, d, T, ev || {});
  renderer.render(scn, camera);
  return true;
};
window.ready = true;

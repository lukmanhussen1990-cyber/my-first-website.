import * as THREE from 'three';
import {
  V, CR, CD, CH, CB, CT, ZC, TANK, TUN, NICHE, clamp, lerp, prog, smooth, easeOutCubic, easeInCubic, easeOutBack,
  pop, bounceDrop, rng, noise1, M, reg, setCut, mk, box, cyl,
} from './util.js';
import * as MD from './models.js';

const W = 1080, H = 1920, PI = Math.PI;
const TL = await (await fetch('/build/timeline.json')).json();
const S = TL.S, E = TL.E;
await document.fonts.load('700 100px Fredoka'); await document.fonts.load('600 60px Fredoka');

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfeaf7, 80, 330);
const cam = new THREE.PerspectiveCamera(42, W / H, 0.3, 900);

// ---------------- sky & lights ----------------
const skyGeo = new THREE.SphereGeometry(450, 24, 14);
skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10; scene.add(sky);
function setSky(top, hor) {
  const p = skyGeo.attributes.position, c = skyGeo.attributes.color, ct = new THREE.Color(top), ch = new THREE.Color(hor), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const h = clamp(p.getY(i) / 450); tmp.copy(ch).lerp(ct, Math.pow(h, 0.5)); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  c.needsUpdate = true;
}
const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const partyLight = new THREE.PointLight(0xffd28a, 0, 22, 1.6); partyLight.position.set(8.3, 3.2, 5.5); scene.add(partyLight);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false });
const PH = {
  day: { top: 0x2f8fe6, hor: 0xcdeaf8, sun: 0xfff3dc, sunI: 3.1, hs: 0xe6f4ff, hg: 0x86b860, hi: 1.9, dir: [-14, 30, 20], party: 0, soil: 0xffffff },
  dusk: { top: 0x272c72, hor: 0xff9658, sun: 0xff9a5a, sunI: 3.0, hs: 0xb4aef0, hg: 0x6a8c5e, hi: 1.75, dir: [-30, 13, 16], party: 60, soil: 0xb9a8b5 },
  sunset: { top: 0x45489c, hor: 0xffb46e, sun: 0xffac6a, sunI: 3.2, hs: 0xc4bbf2, hg: 0x73975f, hi: 1.9, dir: [-30, 16, 14], party: 40, soil: 0xb9a8b5 },
};
let curPhase = null;
function setPhase(name) {
  if (name === curPhase) return; curPhase = name; const p = PH[name];
  setSky(p.top, p.hor); scene.fog.color.set(p.hor); sun.color.set(p.sun); sun.intensity = p.sunI;
  hemi.color.set(p.hs); hemi.groundColor.set(p.hg); hemi.intensity = p.hi;
  sun.position.set(p.dir[0] * 2, p.dir[1] * 2, p.dir[2] * 2); partyLight.intensity = p.party; soilMat.color.set(p.soil);
}

// ---------------- ground ----------------
const lawnMat = M(0x47ad2c);
{
  const ls = new THREE.Shape(); ls.moveTo(-320, -320); ls.lineTo(320, -320); ls.lineTo(320, 320); ls.lineTo(-320, 320); ls.closePath();
  const hole = new THREE.Path(); hole.absarc(V.x, -V.z, CR, 0, PI * 2, true); ls.holes.push(hole);
  const g = new THREE.ShapeGeometry(ls, 40); g.rotateX(-PI / 2);
  mk(g, lawnMat, scene, 0, 0, 0, false, true);
}
const plug = mk(new THREE.CircleGeometry(CR, 40), lawnMat, scene, V.x, 0.001, V.z, false, true); plug.rotation.x = -PI / 2;
let plugR = -1;
function setPlug(r) {
  if (r >= CR - 0.001) { plug.visible = false; return; }
  plug.visible = true; if (Math.abs(r - plugR) < 1e-4) return; plugR = r;
  plug.geometry.dispose(); plug.geometry = r <= 0.001 ? new THREE.CircleGeometry(CR, 40) : new THREE.RingGeometry(r, CR, 40, 1);
}

// soil cross-section texture
function soilTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const x = c.getContext('2d'); const r = rng(11);
  const px = (wx) => (wx / 52 + 0.5) * c.width, py = (wy) => (-wy / 26) * c.height;
  const layers = [[0, '#6a4325'], [-1.3, '#93613a'], [-6.4, '#7f512d'], [-10.8, '#6a4630'], [-16, '#584a44']];
  for (const [top, col] of layers) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, c.height);
    for (let wx = -26; wx <= 26; wx += 1) x.lineTo(px(wx), py(top + (top === 0 ? 0 : (r() - 0.5) * 0.7)));
    x.lineTo(c.width, c.height); x.closePath(); x.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const cx = r() * c.width, cy = r() * c.height, s = 14 + r() * 46;
    x.fillStyle = r() > 0.5 ? `rgba(255,225,170,${0.03 + r() * 0.06})` : `rgba(30,12,0,${0.03 + r() * 0.07})`;
    x.beginPath(); for (let k = 0; k < 3; k++) x.lineTo(cx + (r() - 0.5) * s * 2, cy + (r() - 0.5) * s); x.closePath(); x.fill();
  }
  for (let i = 0; i < 230; i++) {
    const cx = r() * c.width, cy = 40 + r() * (c.height - 40), s = 5 + r() * 11; const gcol = 120 + Math.floor(r() * 70);
    x.fillStyle = `rgb(${gcol},${gcol - 12},${gcol - 28})`; x.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; x.lineTo(cx + Math.cos(a) * s * (0.7 + r() * 0.5), cy + Math.sin(a) * s * (0.6 + r() * 0.4)); }
    x.closePath(); x.fill();
  }
  x.fillStyle = '#3a9627'; x.fillRect(0, 0, c.width, py(-0.24)); x.fillStyle = '#2f7d20'; x.fillRect(0, py(-0.24), c.width, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / 52, 1 / 26); t.offset.set(0.5, 1); t.anisotropy = 4;
  return t;
}
const soilTex = soilTexture();
const soilMat = new THREE.MeshBasicMaterial({ map: soilTex });
const cutGroup = new THREE.Group(); scene.add(cutGroup);
{
  const s = new THREE.Shape();
  const x0 = V.x - CR, x1 = V.x + CR, ty0 = TUN.y - TUN.r, ty1 = TUN.y + TUN.r;
  s.moveTo(-70, 0); s.lineTo(x0, 0); s.lineTo(x0, -CD); s.lineTo(x1, -CD); s.lineTo(x1, ty0);
  s.lineTo(NICHE.x0, ty0); s.lineTo(NICHE.x0, NICHE.y0); s.lineTo(NICHE.x1, NICHE.y0); s.lineTo(NICHE.x1, ty0);
  const R = TANK.r + 0.3, a0 = Math.asin(TUN.r / R);
  s.lineTo(TANK.x - R * Math.cos(a0), ty0);
  s.absarc(TANK.x, TANK.y, R, PI + a0, PI - a0 + PI * 2, false);
  s.lineTo(NICHE.x1, ty1); s.lineTo(NICHE.x1, NICHE.y1); s.lineTo(NICHE.x0, NICHE.y1); s.lineTo(NICHE.x0, ty1); s.lineTo(x1, ty1);
  s.lineTo(x1, 0); s.lineTo(70, 0); s.lineTo(70, -45); s.lineTo(-70, -45); s.closePath();
  const face = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), soilMat); face.position.z = ZC - 0.02; cutGroup.add(face);
}
// plugs (undug soil), revealed by moving clip planes
const depthBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);   // keep y < -depth
const depthAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);    // keep y > -depth
const frontLeft = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);    // keep x < front
const frontRight = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);    // keep x > front
function rectShapeGeo(x0, x1, y0, y1) { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return new THREE.ShapeGeometry(s); }
{
  const m1 = soilMat.clone(); m1.clippingPlanes = [depthBelow];
  const p1 = new THREE.Mesh(rectShapeGeo(V.x - CR, V.x + CR, -CD, 0), m1); p1.position.z = ZC - 0.015; cutGroup.add(p1);
  const m2 = soilMat.clone(); m2.clippingPlanes = [frontRight];
  const p2 = new THREE.Mesh(rectShapeGeo(V.x + CR, TUN.x1 - 0.02, NICHE.y0, NICHE.y1), m2); p2.position.z = ZC - 0.015; cutGroup.add(p2);
  soilMat.userData.clones = [m1, m2];
}
// cavity interiors
const cavWall = M(0x6b4526, { side: THREE.BackSide }, true); cavWall.clippingPlanes = [depthAbove];
const cavTun = M(0x5d3b20, { side: THREE.BackSide }, true); cavTun.clippingPlanes = [frontLeft];
const cavDark = M(0x55361e, { side: THREE.BackSide }, true);
const floorMat = M(0x8a5c36, {}, true);
mk(cyl(CR, CR, CD, 28, true), cavWall, scene, V.x, -CD / 2, V.z, false, true);
const floor = mk(new THREE.CircleGeometry(CR, 28), floorMat, scene, V.x, 0, V.z, false, true); floor.rotation.x = -PI / 2;
{
  const len = TUN.x1 - TUN.x0 + 0.4;
  const t = mk(cyl(TUN.r, TUN.r, len, 12, true), cavTun, scene, (TUN.x0 + TUN.x1) / 2, TUN.y, ZC, false, true); t.rotation.z = PI / 2;
  mk(box(NICHE.x1 - NICHE.x0, NICHE.y1 - NICHE.y0, 1.7), cavTun, scene, (NICHE.x0 + NICHE.x1) / 2, (NICHE.y0 + NICHE.y1) / 2, ZC - 0.85, false, true);
  const ch = mk(cyl(TANK.r + 0.3, TANK.r + 0.3, 4.0, 20, true), cavDark, scene, TANK.x, TANK.y, ZC - 2.0, false, true); ch.rotation.x = PI / 2;
  mk(new THREE.CircleGeometry(TANK.r + 0.3, 20), M(0x55361e, {}, true), scene, TANK.x, TANK.y, ZC - 4.0, false, true);
}
const digFace = mk(new THREE.CircleGeometry(TUN.r, 12), M(0x4a2e18, {}, true), scene, 0, TUN.y, ZC - 0.01, false, false); digFace.rotation.y = -PI / 2;

// ---------------- cone ----------------
const SEG = 28;
const coneMat = reg(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
const cone = new THREE.Mesh(new THREE.BufferGeometry(), coneMat); cone.castShadow = true; cone.receiveShadow = true; cone.position.set(V.x, 0, V.z); scene.add(cone);
const capMat = new THREE.MeshBasicMaterial({ color: 0x9c6b3f, side: THREE.DoubleSide });
const capL = new THREE.Mesh(new THREE.BufferGeometry(), capMat), capR = new THREE.Mesh(new THREE.BufferGeometry(), capMat); cutGroup.add(capL, capR);
function coneProfile(s) {
  const Hs = CH * s, Ri = lerp(CR, CT, s), Ro = Ri + 0.55, Rb = lerp(CR + 0.9, CB, s); const pts = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) pts.push([Ro + (Rb - Ro) * Math.pow(1 - f, 1.5), Hs * f]);
  pts.push([Ri, Hs]); pts.push([lerp(CR, Ri, 0.5), Hs * 0.5]); pts.push([CR, 0]); return pts;
}
export const outerR = (f) => (CT + 0.55) + (CB - CT - 0.55) * Math.pow(1 - f, 1.5);
const jr = rng(21); const JIT = []; for (let i = 0; i < SEG * 8; i++) JIT.push(jr() - 0.5);
const cDirt = [new THREE.Color(0x8f5f36), new THREE.Color(0x7d5230), new THREE.Color(0x9a6a3e)], cGrass = [new THREE.Color(0x45a82c), new THREE.Color(0x3d9a28), new THREE.Color(0x52b536)];
const cRim = new THREE.Color(0x6f5a48), cIn = new THREE.Color(0x5e3d22), tmpC = new THREE.Color();
let coneKey = '';
function setCone(s, green) {
  cone.visible = s > 0.01; capL.visible = capR.visible = s > 0.01; if (s <= 0.01) return;
  const key = s.toFixed(3) + '|' + green.toFixed(2); if (key === coneKey) return; coneKey = key;
  const prof = coneProfile(s), rows = prof.length, pos = [], col = [], idx = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c <= SEG; c++) {
    const a = c / SEG * PI * 2, j = (r <= 4 ? 0.2 : 0.06) * JIT[(c % SEG) * 8 + r] * Math.abs(Math.sin(a)) * Math.min(1, s * 2);
    const rad = prof[r][0] + j; pos.push(Math.cos(a) * rad, prof[r][1], Math.sin(a) * rad);
    const k = ((c % SEG) * 7 + r * 3) % 3;
    if (r <= 3) tmpC.copy(cDirt[k]).lerp(cGrass[k], green * (r === 3 ? 0.55 : 1)); else if (r <= 5) tmpC.copy(cDirt[k]).lerp(cRim, 0.35 + green * 0.5); else tmpC.copy(cIn);
    col.push(tmpC.r, tmpC.g, tmpC.b);
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < SEG; c++) { const a = r * (SEG + 1) + c, b = a + SEG + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  cone.geometry.dispose(); cone.geometry = g;
  for (const [cap, sgn] of [[capL, -1], [capR, 1]]) {
    const sh = new THREE.Shape(); prof.forEach(([r, y], i) => (i ? sh.lineTo(V.x + sgn * r, y) : sh.moveTo(V.x + sgn * r, y))); sh.closePath();
    cap.geometry.dispose(); cap.geometry = new THREE.ShapeGeometry(sh); cap.position.z = ZC - 0.012;
  }
}

// ---------------- stone lining ----------------
const rin = (y) => (y <= 0 ? CR : lerp(CR, CT, y / CH));
const stoneData = [];
{ const r = rng(33);
  for (let k = 0; k < 14; k++) { const y = -CD + 0.36 + k * 0.76, rad = rin(y), n = Math.round(2 * PI * rad / 0.84);
    for (let j = 0; j < n; j++) stoneData.push({ k, a: (j + 0.5) / n * PI * 2, y, rad: rad - 0.13, s: 0.85 + r() * 0.3, c: 0.52 + r() * 0.22, rot: r() * 0.5 }); } }
const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.43, 0), M(0xffffff), stoneData.length);
stones.castShadow = true; stones.receiveShadow = true; stones.frustumCulled = false; scene.add(stones);
stoneData.forEach((d, i) => stones.setColorAt(i, new THREE.Color().setRGB(d.c, d.c, d.c * 1.03)));
const dummy = new THREE.Object3D();
function setStones(t) {
  stoneData.forEach((d, i) => {
    const p = pop(t, E.stone_rings[d.k] + (d.a / (PI * 2)) * 0.1, 0.25), drop = (1 - clamp(p)) * 0.8;
    dummy.position.set(V.x + Math.cos(d.a) * d.rad, d.y + drop, V.z + Math.sin(d.a) * d.rad);
    dummy.rotation.set(d.rot, -d.a, d.rot * 0.5); dummy.scale.set(0.62 * d.s * p, 0.86 * d.s * p, 1.0 * d.s * p); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
  });
  stones.instanceMatrix.needsUpdate = true;
}

// ---------------- tank, pipe, pump ----------------
const tank = new THREE.Group(); tank.position.set(TANK.x, TANK.y, ZC); scene.add(tank);
{
  const G = M(0x4d8a63, {}, true), Gd = M(0x3a6b4c, {}, true);
  mk(cyl(TANK.r, TANK.r, 3.4, 22), G, tank, 0, 0, -1.85).rotation.x = PI / 2;
  const cap = mk(new THREE.SphereGeometry(TANK.r, 22, 8, 0, PI * 2, 0, PI / 2), G, tank, 0, 0, -0.15); cap.rotation.x = PI / 2; cap.scale.y = 0.22;
  const tor = mk(new THREE.TorusGeometry(TANK.r - 0.02, 0.1, 6, 24), Gd, tank, 0, 0, -0.15, false);
  mk(cyl(0.34, 0.34, 1.0, 10), Gd, tank, 0, TANK.r + 0.3, -1.2);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.font = '700 120px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SEPTIC', 256, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); lab.position.set(0, 0, 0.27); tank.add(lab);
}
mk(cyl(0.4, 0.4, 0.08, 12), M(0x3a6b4c), scene, TANK.x, 0.04, ZC - 1.2);
const pipeLen = TUN.x1 - TUN.x0 + 0.25, pipeHome = (TUN.x0 + TUN.x1) / 2 - 0.1;
const pipe = new THREE.Group(); pipe.position.set(pipeHome, TUN.y, ZC - 0.45); scene.add(pipe);
{
  const pm = M(0x9ea4ab, {}, true), pd = M(0x7c828a, {}, true); const keep = new THREE.Plane(new THREE.Vector3(-1, 0, 0), TUN.x1 + 0.2);
  pm.clippingPlanes = [keep]; pd.clippingPlanes = [keep];
  mk(cyl(0.4, 0.4, pipeLen, 12), pm, pipe).rotation.z = PI / 2;
  for (let i = 0; i <= 5; i++) mk(cyl(0.5, 0.5, 0.16, 12), pd, pipe, -pipeLen / 2 + 0.1 + i * (pipeLen - 0.2) / 5, 0, 0).rotation.z = PI / 2;
}
const pump = MD.makePump(); const PUMP = new THREE.Vector3((NICHE.x0 + NICHE.x1) / 2, -4.05, ZC + 0.25); scene.add(pump);

// ---------------- environment ----------------
const ourHouse = MD.makeHouse(0xe9d6ae, 0x4a3a35); ourHouse.position.set(-9, 0, -15); scene.add(ourHouse);
const nbHouse = MD.makeHouse(0xd3d6da, 0x3d4148); nbHouse.position.set(9, 0, -15); scene.add(nbHouse);
scene.add(MD.makeFence([[0, -22, 0, 8.4], [0, 9.6, 0, 16], [-20, -22, 20, -22], [-20, -22, -20, 16], [20, -22, 20, 16]]));
for (const [x, z, h, sd] of [[-16, -9, 6.2, 1], [16.5, -8, 5.8, 2], [-18.6, -2.5, 5.2, 3], [17, 13.5, 5.6, 4], [3.5, -19, 6.5, 5]]) { const p = MD.makePalm(h, sd); p.position.set(x, 0, z); scene.add(p); }
{ const r = rng(77);
  for (let i = 0; i < 16; i++) { const b = MD.makeBush(i); const side = i % 4; const u = r();
    if (side === 0) b.position.set(-19.2, 0, -20 + u * 34); else if (side === 1) b.position.set(19.2, 0, -20 + u * 34); else if (side === 2) b.position.set(-18 + u * 36, 0, -21.2); else b.position.set((r() > 0.5 ? 0.8 : -0.8), 0, -20 + u * 14);
    scene.add(b); }
  for (let i = 0; i < 5; i++) { const c = MD.makeCloud(i); c.position.set(-160 + i * 80 + r() * 30, 70 + r() * 30, -260 - r() * 60); c.scale.setScalar(2.2); scene.add(c); } }
const dogHouse = MD.makeDogHouse(); dogHouse.position.set(16.5, 0, 9); dogHouse.rotation.y = -PI / 2; scene.add(dogHouse);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffe1a0, fog: false })); sunDisc.position.set(-150, 26, -400); scene.add(sunDisc);

// golden rings
function makeGlowRing(R) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.RingGeometry(R - 0.075, R + 0.075, 72), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, depthWrite: false, fog: false }));
  const gg = new THREE.RingGeometry(R - 0.55, R + 0.55, 72, 2); const n = gg.attributes.position.count, cols = new Float32Array(n * 3), per = 73;
  for (let j = 0; j < 3; j++) for (let i = 0; i < per; i++) { const k = (j * per + i) * 3, b = j === 1 ? 1 : 0; cols[k] = b; cols[k + 1] = 0.6 * b; cols[k + 2] = 0.04 * b; }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const glow = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.rotation.x = glow.rotation.x = -PI / 2; core.position.y = 0.08; glow.position.y = 0.07; g.add(glow, core); g.position.set(V.x, 0, V.z); g.userData = { core, glow }; scene.add(g); return g;
}
const ring1 = makeGlowRing(CR + 0.22), ring2 = makeGlowRing(CB + 0.25);
function setRing(r, a, t) { r.visible = a > 0.01; if (!r.visible) return; const pulse = 0.85 + 0.15 * Math.sin(t * 7); r.userData.core.material.opacity = a; r.userData.glow.material.opacity = a * pulse; }
// tunnel outline glow
const tunGlow = new THREE.Group(); scene.add(tunGlow);
{ const cm = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, depthWrite: false }), gm = new THREE.MeshBasicMaterial({ color: 0xff9a10, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const x0 = TUN.x0 + 0.1, x1 = TUN.x1 - 0.1, y0 = TUN.y - TUN.r - 0.1, y1 = TUN.y + TUN.r + 0.1;
  for (const [cx, cy, w, h] of [[(x0 + x1) / 2, y0, x1 - x0, 0.1], [(x0 + x1) / 2, y1, x1 - x0, 0.1], [x0, (y0 + y1) / 2, 0.1, y1 - y0], [x1, (y0 + y1) / 2, 0.1, y1 - y0]]) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.02), cm); a.position.set(cx, cy, ZC + 0.05); tunGlow.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, h + 0.42), gm); b.position.set(cx, cy, ZC + 0.04); tunGlow.add(b); }
  tunGlow.userData = { cm, gm }; }
const arrow = MD.makeArrow(); scene.add(arrow);
function setArrow(t, x, y, z, rotZ = 0, since = 0, s = 1) { arrow.visible = true; arrow.position.set(x, y, z); arrow.rotation.z = rotZ; const k = pop(t, since, 0.3) * s; arrow.scale.set(k, k, k); arrow.userData.inner.position.y = 0.18 + 0.22 * Math.sin(t * 9); }

// lawn poops
const LP = [[-3.7, 9.6], [-10.6, 8.0], [-7.4, 11.4], [-12.6, 4.2]];
const lawnPoops = LP.map(([x, z], i) => { const p = MD.makePoop(i === 0 ? 0.95 : 0.9); p.position.set(x, 0, z); p.rotation.y = i * 1.7; p.castShadow = true; scene.add(p); return p; });

// dirt chunks
const NCH = 150; const chunkMat = M(0x8a5a33);
const chunks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.17, 0), chunkMat, NCH); chunks.castShadow = true; chunks.frustumCulled = false; scene.add(chunks);
const CHK = []; { const r = rng(5); const per = Math.ceil(NCH / E.scoops.length);
  for (let i = 0; i < NCH; i++) { const k = Math.min(E.scoops.length - 1, Math.floor(i / per)); const t0 = E.scoops[k] + r() * 0.12;
    const a = r() * PI * 2, rad = CR + 0.9 + r() * 3.6; let lx = V.x + Math.cos(a) * rad, lz = V.z + Math.sin(a) * rad; if (lx > -0.5) lx = -0.5 - r() * 2;
    const p0 = [V.x + (r() - 0.5) * 2.4, -0.4, V.z + (r() - 0.5) * 2.4], Tf = 0.65 + r() * 0.45;
    CHK.push({ t0, p0, L: [lx, 0.1, lz], Tf, s: 0.7 + r() * 0.9, rot: [r() * 6, r() * 6], hop: E.cone_stages[i % 4] - 0.32 + r() * 0.22, hx: (r() - 0.5) * 2, hz: (r() - 0.5) * 2 }); } }
function setChunks(t) {
  const g = 24;
  CHK.forEach((c, i) => {
    let x, y, z, s = c.s; const dt = t - c.t0;
    if (dt < 0) s = 0;
    if (dt < c.Tf) { const u = Math.max(0, dt); x = lerp(c.p0[0], c.L[0], u / c.Tf); z = lerp(c.p0[2], c.L[2], u / c.Tf); const vy = (c.L[1] - c.p0[1] + 0.5 * g * c.Tf * c.Tf) / c.Tf; y = c.p0[1] + vy * u - 0.5 * g * u * u; }
    else { x = c.L[0]; z = c.L[2]; y = c.L[1] + Math.abs(Math.sin((dt - c.Tf) * 14)) * 0.25 * Math.exp(-(dt - c.Tf) * 7); }
    if (t > c.hop) { const u = clamp((t - c.hop) / 0.42); x = lerp(c.L[0], V.x + c.hx, u); z = lerp(c.L[2], V.z + c.hz, u); y = lerp(0.1, 1.2, u) + Math.sin(u * PI) * 3.2; s *= u >= 1 ? 0 : 1; }
    dummy.position.set(x, y, z); dummy.rotation.set(c.rot[0] + dt * 5, c.rot[1] + dt * 3, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); chunks.setMatrixAt(i, dummy.matrix);
  });
  chunks.instanceMatrix.needsUpdate = true;
}
// tunnel dig spray (front of the cut plane)
const NSP = 36; const spray = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.13, 0), M(0x8a5a33, {}, true), NSP); spray.frustumCulled = false; scene.add(spray);
const SPR = []; { const r = rng(9); for (let i = 0; i < NSP; i++) SPR.push({ ph: i / NSP, vx: -(2.5 + r() * 4), vy: 1 + r() * 3.5, s: 0.7 + r() * 0.8 }); }

// excavator
const exc = MD.makeExcavator(); scene.add(exc);
function excPose(yaw, a1, a2, a3) { const u = exc.userData; u.turret.rotation.y = yaw; u.boomP.rotation.z = a1; u.stickP.rotation.z = a2; u.buckP.rotation.z = a3; }

// wheelbarrow + ramp + pusher
const RA = new THREE.Vector2(-14.6, 0), RB = new THREE.Vector2(-7.75, 5.68), rampAng = Math.atan2(RB.y - RA.y, RB.x - RA.x), rampLen = RA.distanceTo(RB);
const ramp = new THREE.Group(); scene.add(ramp);
{ const wm = M(0xa87442), wd = M(0x74471f);
  const pl = mk(box(rampLen + 0.3, 0.12, 1.3), wm, ramp, (RA.x + RB.x) / 2, (RA.y + RB.y) / 2 - 0.07, V.z); pl.rotation.z = rampAng;
  for (const x of [-12.6, -10.4]) { const h = (x - RA.x) * Math.tan(rampAng); for (const dz of [-0.55, 0.55]) mk(box(0.14, h, 0.14), wd, ramp, x, h / 2 - 0.08, V.z + dz); } }
const wb = MD.makeWheelbarrow(); scene.add(wb);
const pusher = MD.makePerson(0x2f6fd0, 0x34495e, 0xf0c39a, 0x5a3a1c); scene.add(pusher);
const NDP = 12; const dumpPoops = new THREE.InstancedMesh(MD.poopGeo(), MD.poopMaterial(), NDP); dumpPoops.castShadow = true; dumpPoops.frustumCulled = false; scene.add(dumpPoops);
// fuel pile
const FUEL = []; { const r = rng(15); const rows = [[7, -1.95, 0.65, -5.0], [5, -1.5, 0.75, -4.42], [3, -0.8, 0.8, -3.84], [1, 0, 0, -3.26]];
  for (const [n, x0, dx, y] of rows) for (let i = 0; i < n; i++) FUEL.push({ x: V.x + x0 + i * dx + (r() - 0.5) * 0.12, y, z: ZC - 0.6 - r() * 0.5, ry: r() * 6, sx: (r() - 0.5) * 1.6 }); }
const fuel = new THREE.InstancedMesh(MD.poopGeo(), MD.poopMaterial(), FUEL.length); fuel.frustumCulled = false; fuel.castShadow = true; scene.add(fuel);

// garden on the hill
const garden = []; {
  const onCone = (ang, f) => new THREE.Vector3(V.x + Math.cos(ang) * outerR(f), CH * f - 0.05, V.z + Math.sin(ang) * outerR(f));
  [[2.2, 0.3, 3.6], [3.5, 0.42, 3.2], [1.1, 0.22, 3.9]].forEach(([a, f, h], i) => { const p = MD.makePalm(h, 20 + i); p.position.copy(onCone(a, f)); scene.add(p); garden.push({ o: p, t: E.palms[i] }); });
  const r = rng(41);
  E.rocks.forEach((t, i) => { const a = 0.9 + i * 0.55 + r() * 0.2, f = i % 2 ? 0.0 : 0.16 + r() * 0.4; const o = MD.makeRock(i, 0.38 + r() * 0.3); o.position.copy(onCone(a, f)); if (f === 0) o.position.addScaledVector(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0.4); scene.add(o); garden.push({ o, t }); });
  E.bushes.forEach((t, i) => { const a = 0.6 + i * 0.5 + r() * 0.2, f = i % 2 ? 0.1 + r() * 0.45 : 0.0; const o = MD.makeBush(30 + i); o.scale.setScalar(0.85); o.position.copy(onCone(a, f)); scene.add(o); garden.push({ o, t, sc: 0.85 }); });
  const fm = [M(0xff6fa8), M(0xffe14a), M(0xffffff)];
  for (let i = 0; i < 14; i++) { const a = 0.5 + r() * 3.4, f = 0.05 + r() * 0.6; const o = mk(new THREE.IcosahedronGeometry(0.13, 0), fm[i % 3], scene); o.position.copy(onCone(a, f)); o.position.y += 0.1; garden.push({ o, t: E.bushes[0] + 0.3 + i * 0.07 }); }
}

// party
const TABLE = new THREE.Vector3(8.8, 0, 5.0), GRILL = new THREE.Vector3(4.7, 0, 7.8);
const grill = MD.makeGrill(); grill.position.copy(GRILL); scene.add(grill);
const table = MD.makeTable(); table.position.copy(TABLE); scene.add(table);
const lights = new THREE.Group(); scene.add(lights); let bulbs;
{ const poles = [[3.0, 10.8], [13.8, 10.8], [13.8, 0.6], [3.0, 0.6]], Hp = 3.5, pm = M(0x5a4632); const pts = [];
  for (const [x, z] of poles) mk(cyl(0.07, 0.09, Hp, 6), pm, lights, x, Hp / 2, z);
  const spans = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]; const sm = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  for (const [a, b] of spans) { const A = new THREE.Vector3(poles[a][0], Hp, poles[a][1]), B = new THREE.Vector3(poles[b][0], Hp, poles[b][1]); const n = Math.round(A.distanceTo(B) / 0.85); const cp = [];
    for (let i = 0; i <= n; i++) { const s = i / n; const p = A.clone().lerp(B, s); p.y -= 0.7 * 4 * s * (1 - s); cp.push(p); if (i > 0 && i < n) pts.push(p.clone()); }
    lights.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), n * 2, 0.022, 4), sm)); }
  bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 1), bulbMat, pts.length); bulbs.frustumCulled = false; lights.add(bulbs); bulbs.userData.pts = pts; }
const PP = [[5.9, 8.1, PI], [7.7, 6.6, -PI / 2], [9.6, 6.7, -PI / 2], [8.3, 3.5, PI / 2], [11.0, 4.7, PI], [6.6, 4.5, 0]];
const PC = [[0xe8553d, 0x34495e], [0x3aa6d0, 0x6b4a2e], [0xf2c14e, 0x2f3b52], [0x9b59b6, 0x444444], [0x2ecc71, 0x5d4037], [0xff8fb1, 0x2c3e50]];
const SKIN = [0xf0c39a, 0xc68c5a, 0xf5d0b0, 0x8d5a3a, 0xf0c39a, 0xd9a273];
const people = PP.map(([x, z, h], i) => { const p = MD.makePerson(PC[i][0], PC[i][1], SKIN[i], [0x3a2a1c, 0x1c1c1c, 0xd9b36a, 0x1c1c1c, 0x7a3b1c, 0x3a2a1c][i]); scene.add(p); return { o: p, x, z, h, i }; });
const dog = MD.makeDog(); scene.add(dog);
const button = MD.makeButton(); button.position.set(-13.5, 0, 9); button.rotation.y = 0.5; scene.add(button);

// cracks
const crackMat = new THREE.MeshBasicMaterial({ color: 0x241509, side: THREE.DoubleSide });
const cracks = []; { const r = rng(61);
  const ribbon = (pts, nrm, w0) => { const pos = [], idx = []; pts.forEach((p, i) => { const w = w0 * (1 - i / pts.length) + 0.03; const n = nrm(p, i); pos.push(p.x + n.x * w, p.y + n.y * w, p.z + n.z * w, p.x - n.x * w, p.y - n.y * w, p.z - n.z * w); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, crackMat); m.userData.n = idx.length; scene.add(m); cracks.push(m); };
  for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2 + r() * 0.3, len = 2.2 + r() * 3.2, pts = []; const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i <= 9; i++) { const d = CB + 0.05 + len * i / 9; pts.push(new THREE.Vector3(V.x, 0.035, V.z).addScaledVector(dir, d).addScaledVector(side, i ? (r() - 0.5) * 0.7 : 0)); }
    ribbon(pts, () => side, 0.13); }
  for (let k = 0; k < 7; k++) { let a = k / 7 * PI * 2 + r() * 0.4; const pts = [], angs = [];
    for (let i = 0; i <= 8; i++) { const f = 0.02 + 0.74 * i / 8; a += (r() - 0.5) * 0.22; const R = outerR(f) + 0.17; pts.push(new THREE.Vector3(V.x + Math.cos(a) * R, CH * f, V.z + Math.sin(a) * R)); angs.push(a); }
    ribbon(pts, (p, i) => new THREE.Vector3(-Math.sin(angs[i]), 0, Math.cos(angs[i])), 0.12); } }

// steam / smoke / lava / splats
const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a9aa8, flatShading: true });
const NST = 40; const steam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 1), puffMat, NST); steam.frustumCulled = false; scene.add(steam);
const STM = []; { const r = rng(71); for (let i = 0; i < NST; i++) STM.push({ ph: r(), dx: (r() - 0.5) * 2.6, dz: (r() - 0.5) * 2.6, s: 0.6 + r() * 0.8, sp: 0.8 + r() * 0.5 }); }
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6e, emissive: 0x2a211c, flatShading: true });
const NSM = 16; const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), smokeMat, NSM); smoke.frustumCulled = false; scene.add(smoke);
const lavaMat = new THREE.MeshStandardMaterial({ color: 0x6f3d17, roughness: 0.18, metalness: 0.05, flatShading: true, emissive: 0x2a1404 });
const NLV = 520; const lava = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.34, 0), lavaMat, NLV); lava.castShadow = true; lava.frustumCulled = false; scene.add(lava);
const splatGeo = (() => { const g = new THREE.CircleGeometry(1, 11); const p = g.attributes.position, r = rng(3); for (let i = 1; i < p.count; i++) { const k = 0.72 + r() * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, 0); } g.rotateX(-PI / 2); return g; })();
const NSPL = 230; const splats = new THREE.InstancedMesh(splatGeo, new THREE.MeshStandardMaterial({ color: 0x6a3a16, roughness: 0.5, flatShading: true }), NSPL); splats.receiveShadow = true; splats.frustumCulled = false; scene.add(splats);
const GL = 30; // lava gravity in eruption time
function warp(dt) { if (dt <= 0) return 0; if (dt < 1.2) return 0.3 * dt; if (dt < 1.8) { const d = dt - 1.2; return 0.36 + 0.3 * d + 0.7 * d * d / 1.2; } return 0.75 + (dt - 1.8); }
const LAV = []; { const r = rng(101); const gauss = () => (r() + r() + r() + r() - 2) / 2;
  for (let i = 0; i < NLV; i++) {
    const t0 = E.boom + (r() < 0.6 ? r() * 0.5 : r() * 2.2), tl = lerp(E.rain_start, E.rain_end + 0.5, Math.pow(r(), 0.85));
    let lx = 7.8 + gauss() * 7.5, lz = 5.5 + gauss() * 8; if (i < 40) { lx = GRILL.x + gauss() * 1.2; lz = GRILL.z + gauss() * 1.2; } else if (i < 80) { lx = TABLE.x + gauss() * 2; lz = TABLE.z + gauss() * 1.5; }
    if (lx < 0.9) lx = 0.9 + r() * 3;
    const tau0 = warp(t0 - E.boom), taul = Math.max(tau0 + 1.1, warp(tl - E.boom)), Tf = taul - tau0;
    const p0 = [V.x + (r() - 0.5) * 1.6, CH - 0.2, V.z + (r() - 0.5) * 1.6];
    LAV.push({ tau0, Tf, p0, L: [lx, 0.05, lz], vy: (0.05 - p0[1] + 0.5 * GL * Tf * Tf) / Tf, s: 0.55 + r() * 1.0, rot: [r() * 6, r() * 6, 2 + r() * 6], ss: 0.5 + r() * 1.0, ry: r() * 6 });
  } }

// ---------------- animation helpers ----------------
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function shot(u, p0, p1, q0, q1, fov = 42, shake = 0, t = 0) {
  const p = v3(p0).lerp(v3(p1), u), q = v3(q0).lerp(v3(q1), u);
  if (shake > 0) { p.x += noise1(t, 1.0) * shake; p.y += noise1(t + 3.3, 1.3) * shake; q.x += noise1(t + 7.1, 1.1) * shake * 0.8; q.y += noise1(t + 1.7, 0.9) * shake * 0.8; }
  cam.position.copy(p); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(q);
}
function setDog(x, y, z, heading, o = {}) {
  dog.visible = true; dog.position.set(x, y, z); dog.rotation.y = -heading; const u = dog.userData; const w = o.walk ?? 0;
  u.body.rotation.z = o.pitch ?? 0; u.body.position.y = 0.44 + (o.walk ? Math.abs(Math.sin(w * 2)) * 0.06 : 0) - (o.squat ?? 0) * 0.1;
  u.legs.forEach((l, i) => { l.rotation.z = o.walk ? Math.sin(w + (i % 3 === 0 ? 0 : PI)) * 0.8 : (o.squat ? (i >= 2 ? 0.9 : -0.2) * o.squat : 0); });
  u.ears.forEach((e) => { e.rotation.z = o.ears ?? 0; }); u.tail.rotation.y = Math.sin((o.wag ?? 0)) * 0.7; u.tail.rotation.z = o.tail ?? 0;
  u.eyes.forEach((e) => e.scale.setScalar(o.eyes ?? 1)); u.head.rotation.z = o.head ?? 0;
}
function setPerson(p, x, y, z, heading, o = {}) {
  const g = p.o ?? p; g.visible = true; g.position.set(x, y, z); g.rotation.y = -heading; const u = g.userData; const s = o.scale ?? 1; g.scale.setScalar(s);
  const w = o.run ?? 0; u.legs[0].rotation.z = o.run ? Math.sin(w) * 0.9 : 0; u.legs[1].rotation.z = o.run ? -Math.sin(w) * 0.9 : 0;
  u.arms[0].rotation.z = o.armL ?? (o.run ? 2.7 + Math.sin(w * 1.3) * 0.3 : 0.1); u.arms[1].rotation.z = o.armR ?? (o.run ? 2.7 - Math.sin(w * 1.3) * 0.3 : 0.1);
  g.rotation.z = o.lean ?? 0; u.splat.scale.setScalar(o.splat ?? 0); u.splat.scale.y *= 0.7;
}
const depthAt = (t) => t < E.dig_start ? 0 : t < E.cut_deeper ? lerp(0.25, 2.5, prog(t, E.dig_start, E.cut_deeper)) : t < E.deeper ? lerp(2.5, 3.3, prog(t, E.cut_deeper, E.deeper)) : lerp(3.3, CD, easeOutCubic(prog(t, E.deeper, E.deeper + 0.75)));
const coneSAt = (t) => { const tg = [0.3, 0.55, 0.8, 1.0]; let s = 0, prev = 0; E.cone_stages.forEach((tk, i) => { s += (tg[i] - prev) * pop(t, tk, 0.36); prev = tg[i]; }); return s; };

// ---------------- overlay ----------------
const capG = document.getElementById('capg'), capT = document.getElementById('capt'), followEl = document.getElementById('follow'), cursorEl = document.getElementById('cursor'), rippleEl = document.getElementById('ripple');
let capWord = null;
function capYAt(t) {
  const sc = sceneAt(t);
  if (sc === 3 && t >= E.cut_deeper) return 0.3;
  if (sc === 5 || sc === 6) return 0.4;
  if (sc === 8) return 0.63;
  if (sc === 13 && t >= E.dial_cut) return 0.72;
  if (sc === 16) return 0.52;
  return 0.5;
}
function setOverlay(t) {
  let w = null; for (const x of TL.words) { if (x.s <= t + 1e-6) w = x; else break; }
  const idx = w ? TL.words.indexOf(w) : -1; const nxt = idx >= 0 ? TL.words[idx + 1] : null;
  if (w && t > w.e + 0.3 && (!nxt || nxt.s - w.e > 0.45)) w = null;
  if (!w) { capG.setAttribute('opacity', 0); capWord = null; } else {
    if (capWord !== w) { capWord = w; capT.textContent = w.t; capT.style.fill = w.hl ? '#ffd931' : '#ffffff'; capT.style.fontSize = '124px'; const bw = capT.getComputedTextLength(); if (bw > 900) capT.style.fontSize = (124 * 900 / bw).toFixed(1) + 'px'; }
    const k = clamp((t - w.s) / 0.12), sc = k < 0.6 ? lerp(0.8, 1.06, k / 0.6) : lerp(1.06, 1.0, (k - 0.6) / 0.4);
    capG.setAttribute('opacity', 1); capG.setAttribute('transform', `translate(540 ${(capYAt(t) * H).toFixed(1)}) scale(${sc.toFixed(4)})`);
  }
  // follow button
  const fp = E.follow_pop, ft = E.follow_tap; const on = t >= ft;
  let fs = pop(t, fp, 0.35); if (t >= ft - 0.02 && t < ft + 0.14) fs *= 0.92; else if (on) fs *= 1 + 0.08 * Math.max(0, 1 - (t - ft - 0.14) / 0.2);
  followEl.style.transform = `translate(-50%, -50%) scale(${fs.toFixed(4)})`; followEl.textContent = on ? 'Following' : 'Follow'; followEl.classList.toggle('on', on);
  const cu = smooth(prog(t, fp + 0.2, ft - 0.03)); const cx = lerp(900, 590, cu), cy = lerp(1960, 1640, cu) + (t > ft + 0.3 ? smooth(prog(t, ft + 0.3, ft + 0.9)) * 120 : 0);
  const cs = (t >= ft - 0.03 && t < ft + 0.12) ? 0.86 : 1;
  cursorEl.style.opacity = t > fp + 0.15 ? 1 : 0; cursorEl.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) scale(${cs})`;
  const ru = prog(t, ft, ft + 0.4); rippleEl.style.opacity = ru > 0 && ru < 1 ? (1 - ru) * 0.9 : 0; rippleEl.style.transform = `scale(${1 + ru * 4})`;
}
function sceneAt(t) { let i = 1; while (i < 16 && t >= S[i + 1]) i++; return i; }

// ---------------- main per-frame update ----------------
function update(t) {
  const sc = sceneAt(t), u = prog(t, S[sc], S[sc + 1]);
  setPhase(t < S[11] ? 'day' : t < S[16] ? 'dusk' : 'sunset');
  const cut = (sc === 3 && t >= E.cut_deeper) || (sc >= 5 && sc <= 8) || (sc === 9 && t >= E.cut_fuel) || (sc === 13 && t >= E.dial_cut);
  setCut(cut); cutGroup.visible = cut;
  sunDisc.visible = t >= S[11];

  // --- dig state
  const depth = depthAt(t);
  depthBelow.constant = -depth; depthAbove.constant = depth; floor.position.y = -depth + 0.01; floor.visible = depth > 0.005;
  setPlug(CR * smooth(prog(t, E.dig_start, E.dig_start + 1.2)));
  const coneS = coneSAt(t), green = smooth(prog(t, S[10] + 0.1, S[10] + 1.7));
  setCone(coneS, green);
  const front = t < E.tunnel_start ? TUN.x0 - 0.02 : lerp(TUN.x0, TUN.x1 + 0.3, prog(t, E.tunnel_start, E.tunnel_end));
  frontLeft.constant = front; frontRight.constant = -front; digFace.position.x = Math.min(front, TUN.x1 + 0.2); digFace.visible = front < TUN.x1;
  // rings
  setRing(ring1, cut ? 0 : pop(t, E.ring1, 0.3) * (1 - prog(t, S[4] - 0.01, S[4])), t); ring1.scale.setScalar(lerp(0.7, 1, clamp(pop(t, E.ring1, 0.3), 0, 1.1)));
  setRing(ring2, pop(t, E.ring2, 0.3) * (1 - smooth(prog(t, E.cone_stages[3], E.cone_stages[3] + 0.5))) * (sc === 4 ? 1 : 0), t); ring2.scale.setScalar(lerp(0.7, 1, clamp(pop(t, E.ring2, 0.3), 0, 1.1)));
  const tg = sc === 5 ? clamp(pop(t, E.tunnel_ring, 0.3)) * (1 - smooth(prog(t, E.tunnel_end - 0.3, E.tunnel_end + 0.2))) : 0;
  tunGlow.visible = tg > 0.01; tunGlow.userData.cm.opacity = tg; tunGlow.userData.gm.opacity = tg * (0.5 + 0.12 * Math.sin(t * 7));
  arrow.visible = false;

  // --- lawn poops
  lawnPoops.forEach((p, i) => { const k = t < S[9] ? pop(t, E.poop_pops[i], 0.4) : 0; p.visible = k > 0.001; const sq = 1 + 0.25 * Math.sin(clamp((t - E.poop_pops[i]) / 0.5) * PI * 2) * (1 - clamp((t - E.poop_pops[i]) / 0.5)); p.scale.set(0.9 * k / Math.sqrt(sq), 0.9 * k * sq, 0.9 * k / Math.sqrt(sq)); });
  setChunks(t);
  // tunnel spray
  SPR.forEach((s, i) => { const active = sc === 5 && t > E.tunnel_start && t < E.tunnel_end; const life = ((t * 2.2 + s.ph) % 1); const dt = life * 0.45;
    dummy.position.set(front - 0.2 + s.vx * dt, TUN.y - 0.2 + s.vy * dt - 9 * dt * dt, ZC + 0.25); dummy.rotation.set(t * 5 + i, t * 3, 0); dummy.scale.setScalar(active ? s.s * (1 - life) : 0); dummy.updateMatrix(); spray.setMatrixAt(i, dummy.matrix); });
  spray.instanceMatrix.needsUpdate = true;
  setStones(t);
  // pipe
  pipe.visible = t >= E.pipe_start; const pk = smooth(prog(t, E.pipe_start, E.pipe_end)); pipe.position.x = pipeHome + (pipeLen + 0.2) * (1 - pk);
  // pump
  { const dropT = E.pump_land - 0.32; pump.visible = t >= dropT; const k = prog(t, dropT, E.pump_land); const big = 1 + 0.38 * pop(t, E.pump_big, 0.4);
    const land = t - E.pump_land; const sq = land > 0 ? 1 - 0.22 * Math.sin(clamp(land / 0.35) * PI) * (1 - clamp(land / 0.35)) : 1;
    pump.position.set(PUMP.x, lerp(4.5, PUMP.y, k * k) + (big - 1) * 0.62, PUMP.z); pump.scale.set(big / sq, big * sq, big);
    let v = 0.25 + 0.06 * noise1(t, 2.0); if (t > E.pump_land) v = 0.45 + 0.1 * noise1(t, 2.2); if (t > S[13]) v = lerp(0.5, 0.97, smooth(prog(t, S[13], E.andthen + 0.5))) + 0.04 * noise1(t, 3.1);
    if (t > E.boom) v = 0.2; MD.setNeedle(pump, clamp(v, 0, 1.02)); }

  // --- excavator
  exc.visible = sc === 3 || sc === 4;
  if (sc === 3) {
    const k = easeOutCubic(prog(t, S[3], E.exc_arrive)); exc.position.set(lerp(-24, -10.2, k), 0.02 * Math.sin(t * 40) * (1 - k), 1.2); exc.rotation.y = 0;
    const ph = ((t - E.dig_start) / 0.5) % 1, df = clamp(depth / CD);
    if (t < E.dig_start) excPose(0, 0.75, -1.4, -0.4);
    else if (ph < 0.4) { const q = smooth(ph / 0.4); excPose(0, lerp(0.6, lerp(0.05, -0.4, df), q), lerp(-1.3, lerp(-1.75, -1.5, df), q), lerp(-0.3, -1.3, q)); }
    else if (ph < 0.72) { const q = smooth((ph - 0.4) / 0.32); excPose(lerp(0, 0.55, q), lerp(lerp(0.05, -0.4, df), 0.8, q), lerp(lerp(-1.75, -1.5, df), -1.5, q), lerp(-1.3, -0.2, q)); }
    else { const q = smooth((ph - 0.72) / 0.28); excPose(lerp(0.55, 0, q), lerp(0.8, 0.6, q), lerp(-1.5, -1.3, q), -0.25); }
  } else if (sc === 4) {
    exc.position.set(-12.4, 0, 2.7); exc.rotation.y = 0.09; let d = 9; for (const p of E.pats) d = Math.min(d, Math.abs(t - p));
    excPose(0, 0.82 + 0.32 * smooth(clamp(d / 0.17)), -1.72, -0.5);
  }

  // --- wheelbarrow
  const wbOn = sc === 9 && t < E.cut_fuel; wb.visible = pusher.visible = ramp.visible = wbOn; dumpPoops.visible = wbOn;
  if (wbOn) {
    const d1 = E.dump1, d2 = E.dump2; let ru, tip = 0, loaded = true;
    if (t < d1) ru = lerp(0.3, 1, smooth(prog(t, S[9], d1 - 0.1))); else if (t < d1 + 0.35) { ru = 1; } else if (t < d1 + 0.95) { ru = lerp(1, 0.35, smooth(prog(t, d1 + 0.35, d1 + 0.95))); loaded = false; } else ru = lerp(0.35, 1, smooth(prog(t, d1 + 0.95, d2 - 0.1)));
    for (const d of [d1, d2]) if (t >= d - 0.1 && t < d + 0.35) tip = smooth(prog(t, d - 0.1, d + 0.06)) * 1.05, loaded = t < d;
    if (t >= d2 + 0.35) { ru = 1; tip = 1.05; loaded = false; }
    const P = RA.clone().lerp(RB, ru), rot = rampAng - tip, c0 = Math.cos(rampAng), s0 = Math.sin(rampAng), c1 = Math.cos(rot), s1 = Math.sin(rot);
    const wx = P.x + c0 * 0.85 - s0 * 0.26, wy = P.y + s0 * 0.85 + c0 * 0.26;
    wb.position.set(wx - (c1 * 0.85 - s1 * 0.26), wy - (s1 * 0.85 + c1 * 0.26), V.z); wb.rotation.z = rot; wb.userData.load.visible = loaded;
    const Q = RA.clone().lerp(RB, ru - 1.75 / rampLen); setPerson(pusher, Q.x, Q.y, V.z, rampAng * 0 , { run: t * 14, armL: 1.25, armR: 1.25, lean: 0 }); pusher.rotation.set(0, 0, 0); pusher.position.y = Q.y; pusher.rotation.z = 0.25;
    for (let i = 0; i < NDP; i++) { const d = i < 6 ? d1 : d2, dt = t - d - (i % 6) * 0.035; let s = 0.62, x, y, z;
      if (dt < 0 || dt > 0.75) s = 0; const q = clamp(dt / 0.5); x = lerp(RB.x + 0.3, V.x + ((i % 6) - 2.5) * 0.25, q); y = lerp(RB.y + 0.9, CH + 0.4, q) + Math.sin(q * PI) * 1.3 - Math.max(0, dt - 0.5) * 14; z = V.z + ((i % 3) - 1) * 0.3;
      dummy.position.set(x, y, z); dummy.rotation.set(dt * 7, i, dt * 5); dummy.scale.setScalar(s); dummy.updateMatrix(); dumpPoops.setMatrixAt(i, dummy.matrix); }
    dumpPoops.instanceMatrix.needsUpdate = true;
  }
  // fuel pile
  FUEL.forEach((f, i) => { const t0 = E.poop_drops[i]; let s = t >= t0 - 0.45 && t < E.boom ? 0.85 : 0; const hgt = bounceDrop(t, t0 - 0.45, 0.45); const land = clamp((t - t0) / 0.3); const sq = 1 - 0.3 * Math.sin(land * PI) * (t >= t0 ? 1 : 0);
    dummy.position.set(f.x + f.sx * hgt * 0.5, f.y + hgt * 11, f.z); dummy.rotation.set(0, f.ry + hgt * 6, hgt * 2); dummy.scale.set(s / Math.sqrt(sq), s * sq, s / Math.sqrt(sq)); dummy.updateMatrix(); fuel.setMatrixAt(i, dummy.matrix); });
  fuel.instanceMatrix.needsUpdate = true;
  // garden
  const quake = t > E.shake_start && t < E.boom + 2.5 ? Math.sin(t * 45) * 0.03 * smooth(prog(t, E.shake_start, E.shake_start + 1)) : 0;
  garden.forEach((gd, i) => { const k = pop(t, gd.t, 0.45) * (gd.sc ?? 1); gd.o.visible = k > 0.001; gd.o.scale.setScalar(Math.max(0.0001, k)); gd.o.rotation.z = quake * (i % 2 ? 1 : -1) * 2; });

  // --- party
  const ppk = [pop(t, E.party_items[0], 0.4), pop(t, E.party_items[1], 0.4), pop(t, E.party_items[2], 0.4)];
  grill.visible = ppk[0] > 0.001; grill.scale.setScalar(Math.max(0.0001, ppk[0])); table.visible = ppk[1] > 0.001; table.scale.setScalar(Math.max(0.0001, ppk[1]));
  lights.visible = ppk[2] > 0.001; lights.scale.set(1, Math.max(0.0001, ppk[2]), 1);
  bulbs.userData.pts.forEach((p, i) => { const k = pop(t, E.party_items[2] + 0.15 + i * 0.008, 0.25); dummy.position.copy(p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(k * (1 + 0.12 * Math.sin(t * 6 + i))); dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix); });
  bulbs.instanceMatrix.needsUpdate = true;
  grill.userData.cover.scale.set(1.15, 0.95, 1.15).multiplyScalar(pop(t, E.grill_hit, 0.35)); table.userData.cover.scale.set(1.9, 0.7, 1.1).multiplyScalar(pop(t, E.table_hit, 0.35));
  people.forEach((p) => {
    const ta = E.people[p.i]; const runT = E.cut14c + 0.1 + p.i * 0.13;
    if (t < ta || t >= S[15]) { p.o.visible = false; return; }
    if (t < runT) { const k = easeOutCubic(prog(t, ta, ta + 0.5)); const hopy = Math.sin(k * PI) * 0.9; const look = t > E.boom + 0.15;
      setPerson(p, lerp(p.x + 5, p.x, k), hopy + Math.abs(Math.sin(t * 5 + p.i)) * 0.05 * (k >= 1 ? 1 : 0), lerp(p.z - 3, p.z, k), look ? PI : p.h, { scale: lerp(0.5, 1, k), armL: look ? 2.9 : 0.15 + 0.5 * Math.max(0, Math.sin(t * 4 + p.i * 2)), armR: look ? 2.9 : 0.1 }); }
    else { const d = (t - runT) * 4.6; const dirx = 0.86, dirz = -0.5 + (p.i % 3 - 1) * 0.25; const n = Math.hypot(dirx, dirz); const hitT = E.rain_start + 0.5 + p.i * 0.33;
      setPerson(p, p.x + dirx / n * d, Math.abs(Math.sin(t * 13 + p.i)) * 0.18, p.z + dirz / n * d, Math.atan2(dirz, dirx), { run: t * 17 + p.i, lean: -0.18, splat: p.i % 3 !== 1 ? pop(t, hitT, 0.3) : 0 }); }
  });
  // dog
  dog.visible = false;
  if (sc === 1) {
    const tp = E.dog_poop, a = tp - 0.3, b = tp + 0.3;
    if (t < a) { const k = prog(t, 0, a); setDog(lerp(6.2, -4.3, k), 0, lerp(9.0, 9.5, smooth(k)), PI, { walk: t * 20, wag: t * 20 }); }
    else if (t < b) setDog(-4.3, 0, 9.5, PI, { squat: smooth(prog(t, a, a + 0.12)) * (1 - smooth(prog(t, b - 0.1, b))), pitch: 0.3 * smooth(prog(t, a, a + 0.12)) * (1 - smooth(prog(t, b - 0.1, b))), tail: 0.6, eyes: 1.2 });
    else if (t < b + 1.0) { const k = prog(t, b, b + 1.0); setDog(lerp(-4.3, 7.5, k), 0, lerp(9.5, 10.6, smooth(k)) - Math.sin(k * PI) * 0.55, 0.05, { walk: t * 26, wag: t * 30 }); }
    else setDog(7.5, 0, 10.6, PI, { wag: t * 16, head: 0.15 });
  } else if (sc >= 11 && sc <= 13) setDog(11.2, 0, 8.4, PI * 0.9, { wag: t * 14, head: 0.1 });
  else if (sc === 15) {
    const k = pop(t, E.dog_peek, 0.3), run = t - E.dog_run;
    if (run < 0) setDog(0.62, lerp(-0.5, 0.62, clamp(k, 0, 1.08)), 12.6, PI, { pitch: 1.2, eyes: 1.5 + 0.2 * Math.sin(t * 20), ears: 0.25, head: -1.0 });
    else { const q = clamp(run / 0.22); const d = Math.max(0, run - 0.15) * 9; setDog(0.9 + d, lerp(0.62, 0, q), 12.6 + d * 0.12, lerp(PI, 0.1, smooth(q)), { walk: t * 30, ears: -1.35, pitch: lerp(1.2, 0, q), tail: -0.9, eyes: 1.5 }); }
  }
  // button
  button.visible = t >= S[12] - 0.01;
  { const bp = E.button_press; const dn = smooth(prog(t, bp - 0.2, bp)) * (1 - smooth(prog(t, bp + 0.25, bp + 0.6))); const press = smooth(prog(t, bp - 0.04, bp + 0.02));
    button.userData.btn.position.y = 1.33 - 0.1 * press * (t < bp + 0.4 ? 1 : 1 - smooth(prog(t, bp + 0.4, bp + 0.6)));
    button.userData.hand.visible = sc === 12; button.userData.hand.position.set(-0.05, lerp(2.6, 1.5, dn) - 0.1 * (dn >= 0.99 ? press : 0), 0); }
  // cracks
  { const k = smooth(prog(t, E.shake_start + 0.15, E.shake_start + 1.7)); cracks.forEach((c, i) => { c.visible = k > 0; c.geometry.setDrawRange(0, Math.floor(c.userData.n / 6 * clamp(k * 1.3 - (i % 4) * 0.08)) * 6); }); }
  // steam
  STM.forEach((s, i) => { const on = t > E.steam_start && t < E.boom + 0.1; const life = ((t - E.steam_start) * s.sp / 1.2 + s.ph) % 1; const born = (t - E.steam_start) * s.sp / 1.2 + s.ph > 1 || s.ph < (t - E.steam_start);
    const inten = lerp(0.6, 1.25, prog(t, E.steam_start, E.boom));
    dummy.position.set(V.x + s.dx * life * 1.3, CH + 0.2 + life * 5.2 * inten, V.z + s.dz * life * 1.3); dummy.rotation.set(i, t + i, 0); dummy.scale.setScalar(on && born ? s.s * inten * (0.45 + life * 1.3) * (1 - Math.pow(life, 3)) : 0); dummy.updateMatrix(); steam.setMatrixAt(i, dummy.matrix); });
  steam.instanceMatrix.needsUpdate = true;
  // smoke after eruption
  for (let i = 0; i < NSM; i++) { const on = t > S[15] - 0.5; const life = ((t * 0.22 + i / NSM) % 1); dummy.position.set(V.x + life * 2.2 + Math.sin(i * 2.4 + life * 3) * 0.5, CH + life * 8.5, V.z + Math.cos(i * 1.7) * 0.4 * life); dummy.rotation.set(i, t * 0.4 + i, 0); dummy.scale.setScalar(on ? (0.5 + life * 1.5) * (1 - Math.pow(life, 2.5)) : 0); dummy.updateMatrix(); smoke.setMatrixAt(i, dummy.matrix); }
  smoke.instanceMatrix.needsUpdate = true;
  // lava + splats
  { const tau = warp(t - E.boom);
    LAV.forEach((l, i) => { const dt = tau - l.tau0; let s = l.s;
      if (t < E.boom || dt < 0 || dt >= l.Tf) s = 0; const q = clamp(dt / l.Tf);
      dummy.position.set(lerp(l.p0[0], l.L[0], q), l.p0[1] + l.vy * dt - 0.5 * GL * dt * dt, lerp(l.p0[2], l.L[2], q)); dummy.rotation.set(l.rot[0] + dt * l.rot[2], l.rot[1] + dt * 3, 0);
      const st = 1 + Math.min(0.9, Math.abs(l.vy - GL * dt) * 0.03); dummy.scale.set(s / Math.sqrt(st), s * st, s / Math.sqrt(st)); dummy.updateMatrix(); lava.setMatrixAt(i, dummy.matrix);
      if (i < NSPL) { const k = t >= E.boom && dt >= l.Tf ? easeOutBack(clamp((dt - l.Tf) / 0.25)) : 0; dummy.position.set(l.L[0], 0.03 + i * 0.0004, l.L[2]); dummy.rotation.set(0, l.ry, 0); dummy.scale.set(l.ss * k * 1.25, 1, l.ss * k * 1.25); dummy.updateMatrix(); splats.setMatrixAt(i, dummy.matrix); } });
    lava.instanceMatrix.needsUpdate = true; splats.instanceMatrix.needsUpdate = true; lava.visible = t >= E.boom; splats.visible = t >= E.boom; }

  // --- cameras
  const shakeA = t < E.shake_start ? 0 : t < E.boom ? lerp(0.03, 0.14, prog(t, E.shake_start, E.boom)) : 0.55 * Math.exp(-(t - E.boom) * 1.3) + (t < E.boom + 3 ? 0.05 : 0);
  if (sc === 1) shot(smooth(u) * 0.5 + u * 0.5, [0, 19.5, 30.5], [-1.4, 16.5, 26.5], [0, 0.5, 3], [-1.6, 0.5, 5.2], 50);
  else if (sc === 2) { const k = smooth(prog(t, S[2] + 0.3, S[3] - 0.35)); shot(k, [-1.6, 1.2, 12.4], [-11, 16, 22], [-3.8, 0.4, 9.7], [-6.2, 0, 3.6], 42); cam.position.x += u * 0.4; cam.lookAt(v3([-3.8, 0.4, 9.7]).lerp(v3([-6.2, 0, 3.6]), k)); }
  else if (sc === 3) {
    if (!cut) { const k = prog(t, S[3], E.cut_deeper); shot(k, [-15, 14.5, 15], [-9.5, 16.5, 17], [-7.2, -0.3, 2.2], [-7, -0.6, 2.2], 42); }
    else { const k = prog(t, E.cut_deeper, S[4]); shot(k, [-6.8, 2.6, ZC + 25], [-6.6, 1.2, ZC + 22.5], [-6.6, -1.2, ZC], [-6.6, -2.3, ZC], 42);
      if (t >= E.deeper - 0.05) setArrow(t, V.x + 0.6, -depth + 0.75, ZC + 0.7, 0, E.deeper - 0.05, 0.95); }
  }
  else if (sc === 4) shot(u, [-23, 11, 18], [-18.5, 13.5, 22.5], [-6, 2.2, 2], [-5.8, 2.6, 2], 42);
  else if (sc === 5) { shot(smooth(u) * 0.6 + u * 0.4, [-4.5, 1.6, ZC + 20], [5.2, 0.4, ZC + 18], [-2.6, -2.6, ZC], [5.4, -3.1, ZC], 42);
    if (t >= E.tank_arrow) setArrow(t, TANK.x, TANK.y + TANK.r + 0.45, ZC + 0.7, 0, E.tank_arrow, 1.0); }
  else if (sc === 6) { shot(smooth(u) * 0.5 + u * 0.5, [6.2, 0.6, ZC + 16], [-3.2, 1.0, ZC + 17], [5.0, -3.0, ZC], [-3.2, -2.8, ZC], 42);
    if (t >= E.pipe_start + 0.1) setArrow(t, pipe.position.x - pipeLen / 2 + 0.25, TUN.y + 0.75, ZC + 0.7, 0, E.pipe_start + 0.1, 0.85); }
  else if (sc === 7) shot(u, [-5.5, -1.0, ZC + 21], [-5.5, 6.5, ZC + 23], [-5.5, -2.4, ZC], [-5.5, 2.4, ZC], 42);
  else if (sc === 8) shot(u, [PUMP.x, -1.4, ZC + 12.5], [PUMP.x, -2.3, ZC + 10], [PUMP.x, -3.3, ZC], [PUMP.x, -3.4, ZC], 42);
  else if (sc === 9) {
    if (!cut) { const k = prog(t, S[9], E.cut_fuel); shot(k, [-19, 10, 15.5], [-16, 11.5, 14.5], [-8.3, 4.4, 2], [-7.8, 4.7, 2], 42); }
    else { const k = prog(t, E.cut_fuel, S[10]); shot(k, [-5.5, 2.5, ZC + 27], [-5.5, 0.2, ZC + 23.5], [-5.5, 0.6, ZC], [-5.5, -1.6, ZC], 42);
      if (t >= E.fuel_arrow) setArrow(t, V.x - 1.5, -2.9, ZC + 0.7, 0.5, E.fuel_arrow, 0.9); }
  }
  else if (sc === 10) shot(u, [-25, 9.5, 19], [-18.5, 11.5, 24], [-5.8, 2.7, 2], [-5.6, 2.9, 2], 42);
  else if (sc === 11) shot(u, [18.5, 7, 21], [16, 6, 18.5], [7.6, 1.5, 5.6], [7.4, 1.5, 5.4], 42);
  else if (sc === 12) shot(u, [-11.3, 2.5, 12.3], [-11.9, 2.25, 11.6], [-13.5, 1.3, 9], [-13.5, 1.25, 9], 42);
  else if (sc === 13) {
    if (t < E.steam_start) { const k = prog(t, S[13], E.steam_start); shot(k, [-22, 5, 16], [-20, 6, 15], [-5.5, 3.0, 2], [-5.5, 3.2, 2], 42, shakeA, t); }
    else if (!cut) { const k = prog(t, E.steam_start, E.dial_cut); shot(k, [-15, 8.5, 12], [-14, 9.5, 11.5], [-5.5, 6.6, 2], [-5.5, 7.0, 2], 42, shakeA, t); }
    else { const k = prog(t, E.dial_cut, E.boom); const dx = PUMP.x - 0.3 * 1.38, dy = PUMP.y + 0.38 * 0.62 + 1.1 * 1.38; shot(k, [dx, dy + 0.5, ZC + 6.2], [dx, dy + 0.3, ZC + 4.6], [dx, dy - 0.35, ZC], [dx, dy - 0.3, ZC], 42, shakeA * 0.35, t); }
  }
  else if (sc === 14) {
    if (t < E.cut14b) { const k = prog(t, E.boom, E.cut14b); shot(k, [-15, 1.0, 12], [-14, 1.3, 13], [-5.5, 6.5, 2], [-5.5, 12.5, 2], 46, shakeA, t); }
    else if (t < E.cut14c) { const k = prog(t, E.cut14b, E.cut14c); shot(k, [-3.5, 21, 31], [-2, 22, 32], [1.8, 3.2, 3], [2.4, 2.8, 3], 46, shakeA, t); }
    else { const k = prog(t, E.cut14c, S[15]); shot(k, [16.5, 5.0, 16.5], [15, 4.4, 15], [6.8, 1.3, 6.6], [6.6, 1.2, 6.6], 44, shakeA, t); }
  }
  else if (sc === 15) shot(u, [-6.2, 3.6, 13.4], [-5.6, 3.9, 13.9], [1.6, 1.0, 12.8], [3.4, 0.8, 13.0], 42);
  else shot(easeOutCubic(u) * 0.6 + u * 0.4, [-3.5, 13, 28], [0, 37, 43], [-1, 2.2, 1], [0.5, 0, -1.5], 42);
  sun.target.position.set(0, 0, 0);
  setOverlay(t);
}

window.renderFrame = (t) => { update(t); renderer.render(scene, cam); return true; };
window.TL = TL;
window.READY = true;

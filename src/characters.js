// Stylized characters built from smooth primitives.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rbox, placed, DIM } from './world.js';
import * as T from './textures.js';
import { mulberry32, smoothstep } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Capsule between two points.
function limb(a, b, r, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
  geo.applyQuaternion(q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

function sphere(r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 16) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

function merge(list) {
  for (const g of list) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
}

function meshOf(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Height-field cloth (blanket / saree) over a lying body. hfn(x, z) -> y.
function clothGrid(x0, x1, z0, z1, nx, nz, hfn) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hfn(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}

function bodyHeight(x, z, L, { chest = 0.17, waist = 0.11, w0 = 0.21, w1 = 0.16, z0 = 0.2 } = {}) {
  const zt = (z - z0) / (L - z0);
  let H = chest - (chest - waist) * smoothstep(0.2, 0.55, zt) + 0.018 * Math.exp(-((zt - 0.8) ** 2) / 0.003) - 0.035 * smoothstep(0.93, 1.0, zt);
  const w = w0 - (w0 - w1) * smoothstep(0.3, 0.7, zt);
  const ax = Math.abs(x);
  let h = H * (1 - smoothstep(w * 0.5, w * 1.35, ax));
  h -= 0.028 * smoothstep(0.45, 0.65, zt) * Math.exp(-(x * x) / 0.0018);
  h *= smoothstep(-0.06, 0.05, z - z0);
  if (ax > 0.29) h -= (ax - 0.29) * 2.4;
  h += 0.006 * Math.sin(z * 23 + x * 7) + 0.004 * Math.sin(z * 41 - x * 13) + 0.003 * Math.sin(x * 60 + z * 5);
  return Math.max(h, -0.09) + 0.012;
}

// ---------------------------------------------------------------- materials
export function makeCharacterMaterials() {
  const saree = T.sareeFabric();
  const hairTex = T.hairStrands();
  const mats = {
    skins: [0x7e4f34, 0x9a6544, 0x6a412c, 0xa87454].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62 })),
    yourSkin: new THREE.MeshStandardMaterial({ color: 0x9c6a4c, roughness: 0.55, emissive: 0x000000 }),
    pale: new THREE.MeshPhysicalMaterial({ color: 0xb6bcb2, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0x8fa6b8), sheenRoughness: 0.6 }),
    paleDark: new THREE.MeshStandardMaterial({ color: 0x55605f, roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false }),
    hair: new THREE.MeshStandardMaterial({ map: hairTex, color: 0x23232a, roughness: 0.38, metalness: 0.08 }),
    hairDark: new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.85 }),
    pillow: new THREE.MeshStandardMaterial({ map: T.pillow(), roughness: 0.85 }),
    blankets: [0, 1, 2, 3].map((v) => new THREE.MeshStandardMaterial({ map: T.blanket(v), roughness: 0.95, side: THREE.DoubleSide })),
    yourBlanket: new THREE.MeshStandardMaterial({ map: T.blanket(2), color: 0xd8c0a8, roughness: 0.95, side: THREE.DoubleSide }),
    saree: new THREE.MeshPhysicalMaterial({ map: saree.map, bumpMap: saree.bump, bumpScale: 0.5, color: 0x9a9a8f, roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(0x8e9fa8), sheenRoughness: 0.5, side: THREE.DoubleSide }),
    sareeBorder: new THREE.MeshStandardMaterial({ map: T.sareeBorder(), color: 0x9a9a8f, roughness: 0.75, side: THREE.DoubleSide }),
    face: new THREE.MeshStandardMaterial({ color: 0x2a1812, roughness: 0.6 }),
    nails: new THREE.MeshPhysicalMaterial({ color: 0x1a0c12, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 }),
    eyeWhite: new THREE.MeshPhysicalMaterial({ color: 0xe6e2d4, emissive: 0x2a2826, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cornea: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.0, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.85 }),
    phoneBody: new THREE.MeshPhysicalMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.32, clearcoat: 0.8 }),
    bangles: [0x1f7a75, 0x2d6e3a, 0xb07a1e, 0x2a3f8f, 0xcfd8dc, 0x6b1f2a, 0x1f7a75, 0xb07a1e].map(
      (c) => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.22, roughness: 0.1, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.9, iridescence: 0.3 }),
    ),
  };
  mats.iris = new THREE.MeshStandardMaterial({ map: irisTexture(), roughness: 0.4 });
  return mats;
}

function irisTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry32(9);
  const grd = g.createRadialGradient(128, 128, 6, 128, 128, 128);
  grd.addColorStop(0, '#0a0a0a');
  grd.addColorStop(0.1, '#1b1814');
  grd.addColorStop(0.16, '#8c8f86');
  grd.addColorStop(0.62, '#6c726c');
  grd.addColorStop(0.86, '#2b2d2a');
  grd.addColorStop(1, '#0c0d0c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2;
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '200,205,195' : '30,32,30'},0.3)`;
    g.lineWidth = 1 + rnd();
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 22, 128 + Math.sin(a) * 22);
    g.lineTo(128 + Math.cos(a) * (70 + rnd() * 30), 128 + Math.sin(a) * (70 + rnd() * 30));
    g.stroke();
  }
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(128, 128, 13, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Hair material whose hanging part (y < uHangY in mesh space) sways with time.
function swayingHair(base, hangY = 0) {
  const mat = base.clone();
  mat.userData.uTime = { value: 0 };
  mat.userData.uAmp = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.uniforms.uAmp = mat.userData.uAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aPhase;\nuniform float uTime;\nuniform float uAmp;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hang = max(0.0, ${hangY.toFixed(3)} - position.y);
        transformed.x += sin(uTime * 1.1 + aPhase) * 0.05 * hang * hang * uAmp;
        transformed.z += sin(uTime * 0.83 + aPhase * 1.7) * 0.09 * hang * hang * uAmp;`,
      );
  };
  mat.customProgramCacheKey = () => `hair${hangY}`;
  mat.userData.noPrepass = true;
  return mat;
}

let _sheetMat = null;
function hairSheetMaterial() {
  if (_sheetMat) return _sheetMat;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry32(5);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 128;
    const len = 120 + rnd() * 136;
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 2 + rnd() * 4, len);
  }
  const t = new THREE.CanvasTexture(c);
  _sheetMat = new THREE.MeshStandardMaterial({ color: 0x101015, alphaMap: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.5 });
  return _sheetMat;
}

function strandGeo(points, r, phase, tubular = 40) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const geo = new THREE.TubeGeometry(curve, Math.max(8, Math.round(tubular * 0.45)), r, 3, false);
  geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(phase), 1));
  return geo;
}

function mergeStrands(list) {
  return mergeGeometries(list);
}

// ---------------------------------------------------------------- sleepers
// A passenger lying along +z (head at z = 0) on a berth whose top is y = 0.
export function makeSleeper(mats, { L = 1.7, skin = 0, blanket = 0, mouth = false, turn = 0, seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const hx = (rnd() - 0.5) * 0.04;
  g.add(meshOf(placed(rbox(0.42, 0.09, 0.27, 0.04, 3), 0, 0.045, 0.14), mats.pillow));
  const head = new THREE.Group();
  head.position.set(hx, 0.17, 0.16);
  head.rotation.z = turn;
  const skinM = mats.skins[skin % mats.skins.length];
  const faceParts = [];
  head.add(meshOf(merge([sphere(0.1, 0, 0, 0, 1, 0.95, 1.08), sphere(0.022, 0.098, -0.005, 0), sphere(0.022, -0.098, -0.005, 0), sphere(0.016, 0, 0.1, 0.012)]), skinM));
  head.add(meshOf(sphere(0.104, 0, -0.018, -0.03, 1.03, 0.97, 1.06), mats.hairDark));
  for (const s of [-1, 1]) {
    const arc = new THREE.TorusGeometry(0.017, 0.003, 6, 16, Math.PI);
    arc.rotateX(Math.PI / 2);
    arc.translate(s * 0.036, 0.093, -0.022);
    faceParts.push(arc);
    const brow = new THREE.CapsuleGeometry(0.004, 0.022, 3, 6);
    brow.rotateZ(Math.PI / 2 + s * 0.15);
    brow.translate(s * 0.038, 0.088, -0.052);
    faceParts.push(brow);
  }
  if (mouth) faceParts.push(sphere(0.012, 0, 0.088, 0.045, 1.3, 0.5, 0.9));
  head.add(meshOf(merge(faceParts), mats.face));
  g.add(head);
  g.add(meshOf(clothGrid(-0.34, 0.34, 0.2, L, 22, 48, (x, z) => bodyHeight(x, z, L)), mats.blankets[blanket % mats.blankets.length]));
  // feet sticking out past the blanket: pivot at the ankle, toes up.
  const feet = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.07, 0.07, L - 0.02);
    const foot = merge([
      limb(V(0, 0, -0.06), V(0, 0, 0.03), 0.034),
      placed(rbox(0.078, 0.2, 0.07, 0.03, 3), 0, 0.075, 0.045),
      ...[0, 1, 2, 3, 4].map((k) => sphere(0.014 - k * 0.0012, (k - 2) * 0.016 * -s, 0.18 - Math.abs(k - 1) * 0.008, 0.06, 1, 1.3, 1)),
    ]);
    pivot.add(meshOf(foot, skinM));
    pivot.scale.setScalar(1.25);
    pivot.rotation.z = (rnd() - 0.5) * 0.25;
    pivot.userData.base = pivot.rotation.z;
    g.add(pivot);
    feet.push(pivot);
  }
  g.userData.feet = feet;
  return g;
}

// ---------------------------------------------------------------- the woman
// Lying on her side at the front edge of the opposite upper berth, facing
// you. Local frame: berth top y = 0, z from the window end (0) to the aisle
// end (1.82), -x is the berth's front edge (x = -0.30).
export function makeWomanLying(mats) {
  const g = new THREE.Group();
  const KZ = 1.76;
  const S = (m, ...a) => g.add(meshOf(sphere(...a), m));
  g.add(meshOf(placed(rbox(0.42, 0.08, 0.26, 0.04, 3), 0.04, 0.04, 0.5), mats.pillow));
  // head, tipped toward the edge
  const head = V(-0.18, 0.15, 0.5);
  S(mats.pale, 0.105, head.x, head.y, head.z, 1, 1.02, 1.06);
  S(mats.hairDark, 0.112, head.x + 0.03, head.y + 0.02, head.z - 0.01, 1.02, 1.03, 1.07);
  // body on its side (saree): shoulder, ribcage, waist, hip, stacked thighs
  S(mats.saree, 0.11, -0.13, 0.27, 0.68, 0.9, 0.85, 1.0);
  S(mats.saree, 0.15, -0.14, 0.17, 0.84, 0.85, 1.05, 1.15);
  g.add(meshOf(limb(V(-0.14, 0.16, 0.92), V(-0.14, 0.17, 1.12), 0.12), mats.saree));
  S(mats.saree, 0.16, -0.14, 0.17, 1.24, 0.9, 1.05, 1.1);
  g.add(meshOf(limb(V(-0.15, 0.2, 1.3), V(-0.19, 0.19, KZ - 0.04), 0.085), mats.saree));
  g.add(meshOf(limb(V(-0.11, 0.08, 1.3), V(-0.15, 0.08, KZ - 0.04), 0.08), mats.saree));
  // saree drape over hip and legs, spilling over the front edge
  const skirt = clothGrid(-0.4, 0.12, 0.98, KZ + 0.04, 20, 36, (x, z) => {
    const zt = (z - 0.98) / (KZ + 0.04 - 0.98);
    const top = 0.34 - 0.1 * smoothstep(0.15, 0.85, zt) + 0.02 * Math.sin(z * 30);
    const c = -0.14;
    const w = 0.15 - 0.03 * zt;
    let y = top * Math.max(0, 1 - ((x - c) / (w * 1.35)) ** 2) ** 0.6;
    if (x < -0.3) y = Math.min(y, -(-0.3 - x) * 2.2);
    return y + 0.005 * Math.sin(x * 70 + z * 9);
  });
  g.add(meshOf(skirt, mats.saree));
  // upper arm reaches over the edge; forearm + hand dangle with bangles
  const sh = V(-0.17, 0.3, 0.7);
  const el = V(-0.36, 0.12, 0.8);
  const wr = V(-0.39, -0.2, 0.84);
  g.add(meshOf(limb(sh, el, 0.042), mats.saree));
  g.add(meshOf(limb(el, wr, 0.033), mats.pale));
  const hand = makeHandGeometry(mats, { curl: 0.35, bangles: true, scale: 0.95 });
  hand.position.copy(wr);
  hand.rotation.set(0.1, 0.35, Math.PI / 2 + 0.15);
  g.add(hand);
  // knees bend over the aisle end: saree drapes over the knees, shins bare
  const drape = new THREE.PlaneGeometry(0.32, 0.22, 10, 8);
  const dp = drape.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i);
    const u = (0.11 - dp.getY(i)) / 0.22;
    dp.setZ(i, 0.02 * Math.sin(x * 40) * u + 0.035 * u - 0.06 * (1 - u) * (1 - u));
  }
  drape.computeVertexNormals();
  const drapeMesh = meshOf(drape, mats.saree);
  drapeMesh.rotation.y = Math.PI;
  drapeMesh.position.set(-0.17, 0.0, KZ + 0.12);
  g.add(drapeMesh);
  const hem = meshOf(new THREE.PlaneGeometry(0.32, 0.05), mats.sareeBorder);
  hem.rotation.y = Math.PI;
  hem.position.set(-0.17, -0.125, KZ + 0.155);
  g.add(hem);
  // backward feet: heels toward the aisle (+z), toes pointing back (-z)
  const feet = new THREE.Group();
  for (const s of [-1, 1]) {
    const ax = -0.17 + s * 0.072;
    g.add(meshOf(limb(V(ax, 0.02, KZ + 0.07), V(ax, -0.38, KZ + 0.08), 0.036), mats.pale));
    g.add(meshOf(sphere(0.047, ax, 0.035, KZ + 0.1, 1, 1.05, 1.05), mats.saree));
    g.add(meshOf(limb(V(ax, -0.06, KZ + 0.055), V(ax, -0.3, KZ + 0.06), 0.04), mats.pale));
    const foot = merge([
      sphere(0.046, 0, 0.004, 0.04, 1, 0.9, 1.15),
      placed(rbox(0.09, 0.07, 0.2, 0.033, 3), 0, -0.004, -0.06),
      placed(rbox(0.1, 0.05, 0.08, 0.024, 3), 0, -0.012, -0.135),
      ...[0, 1, 2, 3, 4].map((k) => sphere(0.0175 - k * 0.0016, (k - 2) * 0.0195 * s, -0.012 + Math.abs(k - 2) * 0.004, -0.19 + Math.abs(k - 2) * 0.009, 1, 0.9, 1.35)),
    ]);
    const fm = meshOf(foot, mats.pale);
    fm.position.set(ax, -0.42, KZ + 0.08);
    fm.rotation.set(0.12, s * 0.18, 0);
    fm.scale.setScalar(1.18);
    feet.add(fm);
    const nails = merge([0, 1, 2, 3, 4].map((k) => sphere(0.0078, (k - 2) * 0.0195 * s, 0.002, -0.205 + Math.abs(k - 2) * 0.009, 1, 0.5, 0.8)));
    const nm = meshOf(nails, mats.nails);
    nm.position.copy(fm.position);
    nm.rotation.copy(fm.rotation);
    nm.scale.copy(fm.scale);
    feet.add(nm);
    const anklet = meshOf(new THREE.TorusGeometry(0.04, 0.0045, 6, 28), mats.silver);
    anklet.rotation.x = Math.PI / 2;
    anklet.position.set(ax, -0.37, KZ + 0.08);
    feet.add(anklet);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      feet.add(meshOf(sphere(0.0062, ax + Math.cos(a) * 0.041, -0.384, KZ + 0.08 + Math.sin(a) * 0.041), mats.silver));
    }
  }
  g.add(feet);
  // pallu hanging over the front edge
  const pallu = new THREE.PlaneGeometry(0.26, 0.6, 8, 16);
  const pp = pallu.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, 0.025 * Math.sin(pp.getX(i) * 30));
  pallu.computeVertexNormals();
  const palluMesh = meshOf(pallu, mats.saree);
  palluMesh.rotation.y = -Math.PI / 2;
  palluMesh.position.set(-0.33, -0.27, 1.08);
  g.add(palluMesh);
  const pb = meshOf(new THREE.PlaneGeometry(0.06, 0.6), mats.sareeBorder);
  pb.rotation.set(0, -Math.PI / 2, 0);
  pb.position.set(-0.334, -0.27, 1.2);
  g.add(pb);
  // hair: clumps of fine strands from the scalp over the face, over the edge, hanging down
  const rnd = mulberry32(17);
  const strands = [];
  for (let c = 0; c < 46; c++) {
    const u = c / 45;
    const zc = head.z + (u - 0.5) * 0.25;
    const len = 0.28 + rnd() * 0.36;
    const sway = (rnd() - 0.5) * 0.05;
    for (let k = 0; k < 4; k++) {
      const j = () => (rnd() - 0.5) * 0.014;
      const zs = zc + (rnd() - 0.5) * 0.018;
      strands.push(
        strandGeo(
          [
            V(head.x + 0.06, head.y + 0.1, zs * 0.85 + head.z * 0.15),
            V(head.x - 0.04, head.y + 0.105 + j(), zs + j()),
            V(head.x - 0.108, head.y + 0.035, zs + j()),
            V(-0.315, head.y - 0.05, zs + j()),
            V(-0.335 + j(), -0.08, zs + j() * 2),
            V(-0.34 + sway * 0.5 + j(), -0.08 - len * 0.6, zs + sway + j() * 3),
            V(-0.34 + sway + j(), -0.08 - len - rnd() * 0.06, zs + sway * 1.5 + j() * 4),
          ],
          0.0032 + rnd() * 0.0028,
          c * 0.7 + rnd(),
        ),
      );
    }
  }
  const hairMat = swayingHair(mats.hair, 0.02);
  g.add(meshOf(mergeStrands(strands), hairMat));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.62, 1, 1), hairSheetMaterial());
  sheet.rotation.y = -Math.PI / 2;
  sheet.position.set(-0.328, -0.32, head.z);
  g.add(sheet);
  g.userData = { hairMat, feet, pallu: palluMesh };
  return g;
}

// Hand + long nails (+ optional bangles) as a group. Fingers point along -x,
// curl bends them down (-y). Origin at the wrist.
export function makeHandGeometry(mats, { curl = 0.6, bangles = true, skin = null, scale = 1, nails = true } = {}) {
  const g = new THREE.Group();
  const sk = skin || mats.pale;
  g.add(meshOf(placed(rbox(0.095, 0.026, 0.075, 0.012, 3), -0.05, 0, 0), sk));
  const fingers = [];
  const nailG = [];
  for (let f = 0; f < 4; f++) {
    const z = (f - 1.5) * 0.019;
    const len = [0.034, 0.038, 0.036, 0.028][f];
    let p = V(-0.095, 0, z);
    let a = 0;
    for (let s = 0; s < 3; s++) {
      a += curl * (s === 0 ? 0.35 : 0.5);
      const q = V(p.x - Math.cos(a) * len * (s === 2 ? 0.8 : 1), p.y - Math.sin(a) * len, z);
      fingers.push(limb(p, q, 0.0085 - s * 0.0009));
      p = q;
    }
    if (nails) {
      const nail = new THREE.ConeGeometry(0.0072, 0.04, 8);
      nail.rotateZ(Math.PI / 2 - a);
      nail.translate(p.x - Math.cos(a) * 0.016, p.y - Math.sin(a) * 0.016 + 0.002, z);
      nailG.push(nail);
    }
  }
  // thumb
  const t0 = V(-0.035, -0.004, 0.04);
  const t1 = V(-0.07, -0.01, 0.058);
  const t2 = V(-0.098, -0.02, 0.062);
  fingers.push(limb(t0, t1, 0.0105), limb(t1, t2, 0.0095));
  if (nails) {
    const tn = new THREE.ConeGeometry(0.008, 0.036, 8);
    tn.rotateZ(Math.PI / 2 - 0.3);
    tn.translate(-0.115, -0.025, 0.063);
    nailG.push(tn);
  }
  g.add(meshOf(merge(fingers), sk));
  if (nails) g.add(meshOf(merge(nailG), mats.nails));
  if (bangles) {
    for (let k = 0; k < 7; k++) {
      const b = meshOf(new THREE.TorusGeometry(0.046 + (k % 3) * 0.002, 0.0055, 8, 32), mats.bangles[k]);
      b.rotation.y = Math.PI / 2;
      b.rotation.x = (k % 2 ? 0.08 : -0.06);
      b.position.set(0.012 + k * 0.0125, -0.004 - (k % 2) * 0.004, 0);
      g.add(b);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

// Hunched, descending silhouette (scenes 7-8). Faces +z, origin at the feet.
export function makeWomanStanding(mats) {
  const g = new THREE.Group();
  g.add(meshOf(new THREE.CylinderGeometry(0.15, 0.27, 0.96, 24, 1, true), mats.saree)).position.y = 0.48;
  const torso = meshOf(new THREE.CapsuleGeometry(0.13, 0.3, 6, 16), mats.saree);
  torso.position.set(0, 1.08, 0.06);
  torso.rotation.x = 0.55;
  g.add(torso);
  const headG = new THREE.Group();
  headG.position.set(0, 1.34, 0.24);
  headG.rotation.x = 0.7;
  headG.add(meshOf(sphere(0.105, 0, 0, 0, 1, 1, 1.05), mats.pale));
  headG.add(meshOf(sphere(0.11, 0, 0.02, -0.02, 1.02, 1.02, 1.06), mats.hairDark));
  g.add(headG);
  const rnd = mulberry32(29);
  const strands = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 39 - 0.5) * 2.6;
    const sx = Math.sin(a) * 0.1;
    const len = 0.5 + rnd() * 0.3;
    const j = () => (rnd() - 0.5) * 0.03;
    strands.push(
      strandGeo(
        [V(sx * 0.6, 1.47, 0.18), V(sx, 1.44, 0.3 + Math.cos(a) * 0.04), V(sx * 1.15 + j(), 1.3, 0.37 + j()), V(sx * 1.2 + j(), 1.1, 0.4 + j()), V(sx * 1.3 + j(), 1.42 - len, 0.38 + j())],
        0.01 + rnd() * 0.006,
        rnd() * 6.28,
        28,
      ),
    );
  }
  const hairMat = swayingHair(mats.hair, 1.28);
  g.add(meshOf(mergeStrands(strands), hairMat));
  for (const s of [-1, 1]) {
    g.add(meshOf(limb(V(s * 0.16, 1.18, 0.12), V(s * 0.19, 0.95, 0.3), 0.035), mats.saree));
    g.add(meshOf(limb(V(s * 0.19, 0.95, 0.3), V(s * 0.16, 0.74, 0.38), 0.028), mats.pale));
    const h = makeHandGeometry(mats, { curl: 0.9, bangles: true, scale: 0.85 });
    h.position.set(s * 0.16, 0.74, 0.38);
    h.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.2);
    g.add(h);
  }
  g.userData = { hairMat, head: headG };
  return g;
}

// Close-up face with one big eye visible through the hair (scene 10).
// Origin at the head centre, face toward +z.
export function makeWomanFace(mats) {
  const g = new THREE.Group();
  g.add(meshOf(sphere(0.105, 0, 0, 0, 0.96, 1.08, 1), mats.pale));
  g.add(meshOf(sphere(0.112, 0, 0.04, -0.05, 1.0, 1.06, 1.0), mats.hairDark));
  g.add(meshOf(sphere(0.036, -0.04, 0.004, 0.07, 1.1, 0.85, 0.45), mats.paleDark));
  g.add(meshOf(limb(V(-0.004, -0.012, 0.1), V(-0.004, -0.032, 0.108), 0.0075), mats.pale));
  g.add(meshOf(sphere(0.022, -0.01, -0.066, 0.094, 1.4, 0.45, 0.6), mats.face));
  g.add(meshOf(sphere(0.007, -0.002, 0.07, 0.1, 1, 1, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.75 })));
  const eye = new THREE.Group();
  eye.position.set(-0.04, 0.01, 0.068);
  eye.add(meshOf(sphere(0.031, 0, 0, 0, 1, 1, 0.9), mats.eyeWhite));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 32), mats.iris);
  iris.position.z = 0.0282;
  eye.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0042, 20), mats.pupil);
  pupil.position.z = 0.0285;
  eye.add(pupil);
  eye.add(meshOf(sphere(0.0325, 0, 0, 0.002, 1, 1, 0.9), mats.cornea, { cast: false }));
  const lid = meshOf(new THREE.SphereGeometry(0.0335, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.27), mats.pale);
  lid.rotation.x = -0.12;
  eye.add(lid);
  const low = meshOf(new THREE.SphereGeometry(0.0332, 24, 12, 0, Math.PI * 2, Math.PI * 0.74, Math.PI * 0.26), mats.pale);
  eye.add(low);
  g.add(eye);
  const other = meshOf(sphere(0.03, 0.04, 0.01, 0.07, 1, 1, 0.9), mats.eyeWhite);
  g.add(other);
  // hair curtain: falls down both sides of the face, the parting shows one eye
  const rnd = mulberry32(41);
  const strands = [];
  for (let c = 0; c < 44; c++) {
    const side = c % 2 ? 1 : -1;
    const k = Math.floor(c / 2) / 21;
    // left side starts past the visible eye, right side covers the other eye
    const xc = side < 0 ? -0.086 - k * 0.07 : 0.028 + k * 0.1;
    const len = 0.22 + rnd() * 0.16;
    for (let n = 0; n < 4; n++) {
      const x = xc + (rnd() - 0.5) * 0.012;
      const zf = 0.112 - x * x * 2.0;
      const j = () => (rnd() - 0.5) * 0.008;
      const drift = side < 0 ? -0.01 : 0.0;
      strands.push(
        strandGeo(
          [V(x * 0.3 + side * 0.01, 0.12, -0.03), V(x * 0.75, 0.112, 0.07), V(x + j() + drift, 0.06, zf + 0.006), V(x + j() + drift, -0.01, zf + 0.012), V(x * 1.04 + j(), -0.1, zf + 0.004 + j()), V(x * 1.1 + j(), -len, zf - 0.02 + j())],
          0.0016 + rnd() * 0.0016,
          c + rnd(),
          32,
        ),
      );
    }
  }
  // a few loose strands across the visible eye ("through her hair")
  for (let i = 0; i < 7; i++) {
    const x = -0.075 + i * 0.016 + (rnd() - 0.5) * 0.01;
    const zf = 0.13;
    strands.push(strandGeo([V(x * 0.4, 0.118, 0.0), V(x * 0.9, 0.1, 0.09), V(x + 0.01 * Math.sin(i), 0.04, zf), V(x - 0.006, -0.03, zf + 0.004), V(x * 1.05, -0.18, zf - 0.01)], 0.0009 + rnd() * 0.0007, rnd() * 6.28, 28));
  }
  const hairMat = swayingHair(mats.hair, 0.0);
  hairMat.userData.uAmp.value = 0.25;
  g.add(meshOf(mergeStrands(strands), hairMat));
  // veil: extra strands that close the parting (scenes 7-8, face hidden)
  const veil = [];
  for (let i = 0; i < 40; i++) {
    const x = -0.09 + (i / 39) * 0.13;
    const zf = 0.125 - x * x * 2.0;
    const j = () => (rnd() - 0.5) * 0.01;
    veil.push(strandGeo([V(x * 0.3, 0.12, -0.01), V(x * 0.8, 0.108, 0.075), V(x + j(), 0.05, zf + 0.008), V(x + j(), -0.04, zf + 0.012), V(x * 1.05 + j(), -0.2 - rnd() * 0.1, zf + j())], 0.0055 + rnd() * 0.003, rnd() * 6.28, 28));
  }
  const veilMesh = meshOf(mergeStrands(veil), hairMat, { cast: false });
  g.add(veilMesh);
  g.children.forEach((c) => {
    if (c.material === hairMat || c.material === mats.hairDark) c.castShadow = false;
  });
  g.userData = { hairMat, eye, pupil, iris, lid, veil: veilMesh };
  return g;
}

// Your POV hand holding the phone (scenes 1-2). Origin at the phone centre,
// the screen faces +z. Fingertips curl round the left edge, thumb on the right.
export function makeYourHand(mats) {
  const g = new THREE.Group();
  g.add(meshOf(placed(rbox(0.088, 0.115, 0.03, 0.014, 3), 0.004, -0.035, -0.026), mats.yourSkin));
  const parts = [];
  for (let f = 0; f < 3; f++) {
    const y = 0.022 - f * 0.024;
    const a = V(-0.03, y, -0.03);
    const b = V(-0.046, y - 0.003, -0.012);
    const c = V(-0.041, y - 0.005, 0.006);
    parts.push(limb(a, b, 0.0098), limb(b, c, 0.0088), sphere(0.0094, b.x, b.y, b.z));
  }
  const t0 = V(0.04, -0.06, -0.024);
  const t1 = V(0.047, -0.03, -0.004);
  const t2 = V(0.042, -0.006, 0.007);
  parts.push(limb(t0, t1, 0.0115), limb(t1, t2, 0.0102));
  g.add(meshOf(merge(parts), mats.yourSkin));
  g.add(meshOf(limb(V(0.01, -0.085, -0.032), V(0.02, -0.125, -0.045), 0.03), mats.yourSkin));
  g.add(meshOf(limb(V(0.02, -0.12, -0.046), V(0.04, -0.34, -0.12), 0.046), mats.sleeve));
  g.scale.setScalar(1.12);
  return g;
}

// Phone: graphite body, emissive screen, warm spot light from the screen.
export function makePhone(mats) {
  const g = new THREE.Group();
  g.add(meshOf(rbox(0.074, 0.156, 0.009, 0.0095, 4), mats.phoneBody));
  const screens = { lock: T.phoneScreen('lock'), alert: T.phoneScreen('alert') };
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screens.lock, emissiveIntensity: 0, roughness: 0.22, metalness: 0 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.148), screenMat);
  screen.position.z = 0.0047;
  g.add(screen);
  const light = new THREE.SpotLight(0xff9450, 0, 3.2, 1.15, 1, 1.4);
  light.position.set(0, 0, 0.02);
  light.target.position.set(0, 0, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0006;
  light.shadow.camera.near = 0.02;
  g.add(light, light.target);
  const glow = new THREE.PointLight(0xffb27e, 0, 1.4, 2);
  glow.position.set(0, 0, -0.045);
  g.add(glow);
  g.userData = { screenMat, screens, light, glow };
  return g;
}

export function setPhone(phone, { on = 0, screen = 'lock', light = 1 }) {
  const { screenMat, screens, light: l } = phone.userData;
  if (screenMat.emissiveMap !== screens[screen]) {
    screenMat.emissiveMap = screens[screen];
    screenMat.needsUpdate = true;
  }
  screenMat.emissiveIntensity = 1.35 * on;
  l.intensity = 2.6 * on * light;
  phone.userData.glow.intensity = 0.3 * on * light;
}

// Your blanket-covered body on the lower berth (no head: that is the camera).
export function makeYourBody(mats) {
  const g = new THREE.Group();
  const L = 1.72;
  g.add(meshOf(placed(rbox(0.42, 0.09, 0.27, 0.04, 3), 0, 0.045, 0.14), mats.pillow));
  g.add(meshOf(clothGrid(-0.34, 0.34, 0.33, L, 22, 44, (x, z) => bodyHeight(x, z, L, { z0: 0.33 })), mats.yourBlanket));
  return g;
}

// All characters, placed in coach space.
export function buildCharacters(coach) {
  const mats = makeCharacterMaterials();
  const sleepers = [];
  const add = (opts, x, y, z, ry) => {
    const s = makeSleeper(mats, opts);
    s.position.set(x, y, z);
    s.rotation.y = ry;
    coach.add(s);
    sleepers.push(s);
    return s;
  };
  const W = DIM.wallZ + 0.07; // window end of transverse berths
  const A = DIM.aisleEnd + 0.03;
  // your bay
  add({ skin: 0, blanket: 1, seed: 3, turn: 0.3 }, DIM.stackA, DIM.middle, W, 0);
  add({ skin: 2, blanket: 3, seed: 4, turn: -0.2, mouth: true }, DIM.stackA, DIM.upper, W, 0);
  add({ skin: 1, blanket: 0, seed: 5, turn: -0.35, mouth: true }, DIM.stackB, DIM.lower, W, 0);
  add({ skin: 3, blanket: 2, seed: 6, turn: 0.4 }, DIM.stackB, DIM.middle, A, Math.PI); // head at the aisle
  add({ skin: 2, blanket: 1, seed: 7, turn: 0.2 }, 0.82, DIM.lower, DIM.sideZ, -Math.PI / 2);
  add({ skin: 0, blanket: 3, seed: 8, turn: -0.3 }, 0.85, DIM.sideUpper, DIM.sideZ, -Math.PI / 2);
  // bays ahead
  for (const [c, n] of [[2.4, 7], [4.8, 5], [7.2, 3]]) {
    const slots = [
      [c + DIM.stackA, DIM.lower, W, 0],
      [c + DIM.stackB, DIM.lower, W, 0],
      [c + DIM.stackB, DIM.middle, W, 0],
      [c + DIM.stackA, DIM.middle, W, 0],
      [c + 0.82, DIM.lower, DIM.sideZ, -Math.PI / 2],
      [c + DIM.stackB, DIM.upper, W, 0],
      [c + 0.85, DIM.sideUpper, DIM.sideZ, -Math.PI / 2],
    ].slice(0, n);
    slots.forEach(([x, y, z, ry], i) => add({ skin: i + Math.round(c), blanket: i + 1, seed: Math.round(c * 10) + i, turn: (i % 2 ? 0.3 : -0.3), mouth: i % 3 === 0 }, x, y, z, ry));
  }

  const woman = makeWomanLying(mats);
  woman.position.set(DIM.stackB, DIM.upper, DIM.wallZ + 0.04);
  coach.add(woman);
  const standing = makeWomanStanding(mats);
  standing.visible = false;
  coach.add(standing);
  const face = makeWomanFace(mats);
  face.visible = false;
  coach.add(face);
  const hand = new THREE.Group();
  const handRig = makeHandGeometry(mats, { curl: 1.25, bangles: true, scale: 1.25 });
  hand.add(handRig);
  const forearm = meshOf(limb(V(0.02, 0, 0), V(0.34, 0, 0), 0.036), mats.pale);
  hand.add(forearm);
  hand.visible = false;
  coach.add(hand);
  const you = makeYourBody(mats);
  you.position.set(DIM.stackA, DIM.lower, W);
  coach.add(you);
  const phone = makePhone(mats);
  coach.add(phone);
  const yourHand = makeYourHand(mats);
  phone.add(yourHand);

  return { mats, sleepers, woman, standing, face, hand, you, phone, yourHand };
}

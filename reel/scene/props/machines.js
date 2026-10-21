// Chunky toy-like construction machines. Each builder returns { root, ...joints, update(params) }.
// Machines face +x; the camera-facing side is +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintMaterial, std, phys, glowMaterial, tex } from '../lib/materials.js';
import { lerp, clamp, fbm2 } from '../lib/util.js';

export const MAT = {};
export function initMachineMaterials() {
  MAT.yellow = paintMaterial('#f2b215', { amount: 0.9, key: 'y' });
  MAT.yellowClean = paintMaterial('#f5b81e', { amount: 0.35, key: 'yc' });
  MAT.dark = paintMaterial('#2c2b2a', { amount: 0.8, rough: 0.55, clearcoat: 0.0, metal: 0.4, key: 'd' });
  MAT.steel = std({ color: 0x8a8d91, metalness: 0.85, roughness: 0.38 }, 'steel');
  MAT.chrome = std({ color: 0xe8ebee, metalness: 1.0, roughness: 0.12 }, 'chrome');
  MAT.rubber = std({ color: 0x1d1c1b, roughness: 0.85 }, 'rubber');
  MAT.trackPad = paintMaterial('#3a3836', { amount: 1.0, rough: 0.6, clearcoat: 0, metal: 0.6, dirtColor: '#5a4532', key: 'tp' });
  MAT.glass = phys({ color: 0x1b2a33, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }, 'glass');
  MAT.black = std({ color: 0x141414, roughness: 0.6 }, 'blk');
  MAT.grille = std({ color: 0x232323, roughness: 0.5, metalness: 0.5 }, 'grille');
  MAT.orange = glowMaterial('#ff8a1e', 1.2, 'beacon');
  MAT.head = glowMaterial('#fff4dc', 0.0, 'head'); // headlights (intensity driven per frame)
  MAT.tail = glowMaterial('#ff2a1a', 1.5, 'tail');
  MAT.dirt = std({ map: tex('soil_albedo', { srgb: true }), normalMap: tex('soil_normal'), color: 0xc9a98a, roughness: 0.95 }, 'load');
  MAT.rock = std({ map: tex('rock_albedo', { srgb: true }), normalMap: tex('rock_normal'), color: 0x9a9a9e, roughness: 0.85 }, 'rockload');
  MAT.seat = std({ color: 0x2b2b2b, roughness: 0.7 }, 'seat');
}

const rbox = (w, h, d, r = 0.06, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(r, h, mat, seg = 24) { const g = new THREE.CylinderGeometry(r, r, h, seg); return g; }

// lumpy dirt mound (for buckets, beds, piles)
export function moundGeometry(rx, ry, rz, seed = 1) {
  const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.82 + 0.36 * fbm2(x * 2.2 + seed * 3.1, z * 2.2 + y * 1.3, 3);
    p.setXYZ(i, x * rx * (0.95 + 0.1 * k), y * ry * k, z * rz * (0.95 + 0.1 * k));
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- crawler track (moving pads)
function trackAssembly(L, H, W, nPads = 34) {
  const g = new THREE.Group();
  const r = H / 2;
  const straight = L - 2 * r;
  const P = 2 * straight + 2 * Math.PI * r;
  const padG = mergeGeometries([rbox(P / nPads * 0.86, 0.09, W, 0.02, 1), rbox(0.06, 0.07, W * 0.95, 0.015, 1).translate(0, 0.07, 0)]);
  const pads = new THREE.InstancedMesh(padG, MAT.trackPad, nPads);
  pads.castShadow = pads.receiveShadow = true;
  g.add(pads);
  // inner frame, sprocket, idler, rollers
  mesh(rbox(straight + 0.1, H * 0.62, W * 0.7, 0.08), MAT.dark, 0, 0, 0, g);
  const sprG = new THREE.CylinderGeometry(r * 0.82, r * 0.82, W * 0.75, 12); sprG.rotateX(Math.PI / 2);
  const spr = mesh(sprG, MAT.dark, -straight / 2, 0, 0, g);
  const idl = mesh(sprG, MAT.dark, straight / 2, 0, 0, g);
  const hubG = new THREE.CylinderGeometry(r * 0.35, r * 0.35, W * 0.8, 10); hubG.rotateX(Math.PI / 2);
  for (const s of [spr, idl]) mesh(hubG, MAT.yellow, 0, 0, 0, s);
  // sprocket teeth so rotation reads
  const toothG = rbox(0.12, 0.12, W * 0.78, 0.02, 1);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const tm = mesh(toothG, MAT.dark, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 0, spr); tm.rotation.z = a; }
  const rolG = new THREE.CylinderGeometry(0.13, 0.13, W * 0.72, 12); rolG.rotateX(Math.PI / 2);
  for (let i = 0; i < 4; i++) mesh(rolG, MAT.steel, lerp(-straight / 2 + 0.35, straight / 2 - 0.35, i / 3), -r + 0.2, 0, g);
  const o = new THREE.Object3D();
  const update = (dist) => {
    for (let i = 0; i < nPads; i++) {
      let s = ((i / nPads) * P + dist) % P; if (s < 0) s += P;
      let x, y, a;
      if (s < straight) { x = straight / 2 - s; y = -r; a = 0; }                        // bottom, moving back
      else if (s < straight + Math.PI * r) { const u = (s - straight) / r; x = -straight / 2 - Math.sin(u) * r; y = -Math.cos(u) * r; a = -u; }
      else if (s < 2 * straight + Math.PI * r) { x = -straight / 2 + (s - straight - Math.PI * r); y = r; a = Math.PI; }
      else { const u = (s - 2 * straight - Math.PI * r) / r; x = straight / 2 + Math.sin(u) * r; y = Math.cos(u) * r; a = Math.PI - u; }
      o.position.set(x, y, 0); o.rotation.set(0, 0, a); o.updateMatrix(); pads.setMatrixAt(i, o.matrix);
    }
    pads.instanceMatrix.needsUpdate = true;
    spr.rotation.z = idl.rotation.z = -dist / (r * 0.82);
  };
  update(0);
  return { group: g, update };
}

// ---------------------------------------------------------------- hydraulic ram between two points (in a common parent space)
function makeRam(rBarrel = 0.09, barrelMat = MAT.yellow) {
  const g = new THREE.Group();
  const barrelG = new THREE.CylinderGeometry(rBarrel, rBarrel, 1, 14); barrelG.translate(0, 0.5, 0);
  const rodG = new THREE.CylinderGeometry(rBarrel * 0.55, rBarrel * 0.55, 1, 12); rodG.translate(0, 0.5, 0);
  const barrel = mesh(barrelG, barrelMat, 0, 0, 0, g);
  const rod = mesh(rodG, MAT.chrome, 0, 0, 0, g);
  const capG = new THREE.SphereGeometry(rBarrel * 1.15, 12, 8);
  const capA = mesh(capG, MAT.dark, 0, 0, 0, g), capB = mesh(capG, MAT.dark, 0, 0, 0, g);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  const set = (A, B) => {
    dir.subVectors(B, A); const len = dir.length(); dir.normalize();
    q.setFromUnitVectors(up, dir);
    const bl = Math.max(0.2, len * 0.58);
    barrel.position.copy(A); barrel.quaternion.copy(q); barrel.scale.set(1, bl, 1);
    rod.position.copy(B); rod.quaternion.setFromUnitVectors(up, dir.clone().negate()); rod.scale.set(1, len * 0.55, 1);
    capA.position.copy(A); capB.position.copy(B);
  };
  return { group: g, set };
}

function headlight(parent, x, y, z, r = 0.11, dir = 'x') {
  const housing = new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.1, 18);
  housing.rotateZ(Math.PI / 2);
  const lensG = new THREE.CircleGeometry(r, 20); lensG.rotateY(Math.PI / 2);
  const h = mesh(housing, MAT.black, x, y, z, parent);
  const l = mesh(lensG, MAT.head, x + 0.052, y, z, parent);
  if (dir === 'z') { h.rotation.y = -Math.PI / 2; l.rotation.y = -Math.PI / 2; l.position.set(x, y, z + 0.052); }
  return l;
}

function cab(w, h, d, { glassFront = true } = {}) {
  const g = new THREE.Group();
  mesh(rbox(w, h, d, 0.12), MAT.yellow, 0, 0, 0, g);
  // windows (slightly proud dark glass panels)
  mesh(rbox(w * 0.78, h * 0.5, 0.04, 0.03), MAT.glass, -w * 0.02, h * 0.12, d / 2 + 0.005, g);
  mesh(rbox(w * 0.78, h * 0.5, 0.04, 0.03), MAT.glass, -w * 0.02, h * 0.12, -d / 2 - 0.005, g);
  if (glassFront) mesh(rbox(0.04, h * 0.55, d * 0.78, 0.03), MAT.glass, w / 2 + 0.005, h * 0.1, 0, g);
  mesh(rbox(0.04, h * 0.45, d * 0.7, 0.03), MAT.glass, -w / 2 - 0.005, h * 0.15, 0, g);
  mesh(rbox(w * 1.08, 0.09, d * 1.08, 0.04), MAT.dark, 0, h / 2 + 0.03, 0, g); // roof cap
  // door outline + handle on the camera side
  mesh(rbox(0.03, h * 0.82, 0.02, 0.01), MAT.dark, w * 0.12, -h * 0.02, d / 2 + 0.02, g);
  mesh(rbox(0.12, 0.03, 0.03, 0.01), MAT.chrome, w * 0.02, -h * 0.12, d / 2 + 0.03, g);
  return g;
}

// ---------------------------------------------------------------- excavator
export function buildExcavator() {
  const root = new THREE.Group();
  const under = new THREE.Group(); root.add(under);
  const trackL = trackAssembly(3.5, 0.82, 0.62), trackR = trackAssembly(3.5, 0.82, 0.62);
  trackL.group.position.set(0, 0.41, 0.95); trackR.group.position.set(0, 0.41, -0.95);
  under.add(trackL.group, trackR.group);
  mesh(rbox(2.2, 0.35, 1.3, 0.08), MAT.dark, 0, 0.62, 0, under);
  const turnG = new THREE.CylinderGeometry(0.85, 0.9, 0.22, 28); mesh(turnG, MAT.dark, 0, 0.88, 0, under);

  const upper = new THREE.Group(); upper.position.y = 0.98; root.add(upper);
  mesh(rbox(2.5, 0.85, 2.0, 0.14), MAT.yellow, -0.15, 0.45, 0, upper);
  // rounded counterweight
  const cwG = new THREE.CylinderGeometry(0.62, 0.62, 2.0, 28, 1, false, Math.PI, Math.PI); cwG.rotateX(Math.PI / 2);
  mesh(cwG, MAT.yellow, -1.35, 0.45, 0, upper).scale.set(0.75, 0.7, 1);
  mesh(rbox(1.2, 0.18, 1.8, 0.06), MAT.dark, -0.75, 0.94, -0.05, upper); // engine hood
  for (let i = 0; i < 6; i++) mesh(rbox(0.06, 0.05, 1.4, 0.02), MAT.grille, -1.2 + i * 0.16, 1.04, -0.05, upper);
  const exG = new THREE.CylinderGeometry(0.07, 0.08, 0.7, 12); mesh(exG, MAT.dark, -0.55, 1.3, -0.65, upper);
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), MAT.black, -0.55, 1.66, -0.65, upper);
  const c = cab(1.15, 1.25, 0.95); c.position.set(0.55, 1.5, 0.5); upper.add(c);
  mesh(new THREE.SphereGeometry(0.11, 14, 10), MAT.orange, 0.3, 2.22, 0.75, upper); // beacon
  const lights = [headlight(upper, 1.15, 2.05, 0.25), headlight(upper, 1.15, 2.05, 0.8)];
  // handrail on the camera side
  const railG = new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8); railG.rotateZ(Math.PI / 2);
  mesh(railG, MAT.yellow, -0.6, 1.25, 0.95, upper);

  // boom (banana shape)
  const boomPivot = new THREE.Group(); boomPivot.position.set(0.95, 0.75, -0.25); upper.add(boomPivot);
  const bs = new THREE.Shape();
  bs.moveTo(-0.15, -0.25); bs.quadraticCurveTo(1.3, 0.25, 2.95, -0.12); bs.lineTo(3.05, 0.18); bs.quadraticCurveTo(1.4, 0.95, -0.1, 0.25); bs.closePath();
  const boomG = new THREE.ExtrudeGeometry(bs, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 16 });
  boomG.translate(0, 0, -0.18);
  const boom = mesh(boomG, MAT.yellow, 0, 0, 0, boomPivot);
  const pinG = new THREE.CylinderGeometry(0.11, 0.11, 0.6, 14); pinG.rotateX(Math.PI / 2);
  mesh(pinG, MAT.steel, 0, 0, 0, boomPivot);
  const boomLight = headlight(boomPivot, 1.5, 0.75, 0.25, 0.09);
  // stick
  const stickPivot = new THREE.Group(); stickPivot.position.set(3.0, 0.02, 0); boomPivot.add(stickPivot);
  const ss = new THREE.Shape();
  ss.moveTo(-0.45, 0.2); ss.lineTo(2.1, 0.12); ss.lineTo(2.15, -0.12); ss.lineTo(-0.3, -0.22); ss.quadraticCurveTo(-0.6, 0.0, -0.45, 0.2);
  const stickG = new THREE.ExtrudeGeometry(ss, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  stickG.translate(0, 0, -0.15);
  mesh(stickG, MAT.yellow, 0, 0, 0, stickPivot);
  mesh(pinG, MAT.steel, 0, 0, 0, stickPivot);
  // bucket
  const bucketPivot = new THREE.Group(); bucketPivot.position.set(2.1, 0, 0); stickPivot.add(bucketPivot);
  const bk = new THREE.Shape();
  bk.moveTo(0, 0.15); bk.quadraticCurveTo(0.9, 0.35, 1.05, -0.55); bk.lineTo(0.92, -0.62); bk.quadraticCurveTo(0.8, 0.12, 0.05, -0.05); bk.closePath();
  const bucketShell = new THREE.ExtrudeGeometry(bk, { depth: 0.86, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 14 });
  bucketShell.translate(0, 0, -0.43);
  const bucket = new THREE.Group(); bucketPivot.add(bucket);
  mesh(bucketShell, MAT.yellow, 0, 0, 0, bucket);
  const sideG = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0.15); s.quadraticCurveTo(0.9, 0.35, 1.05, -0.55); s.lineTo(0.25, -0.35); s.quadraticCurveTo(0.0, -0.1, 0, 0.15); return s; })(), 12);
  for (const z of [0.45, -0.45]) { const sp = mesh(new THREE.ExtrudeGeometry(sideG.parameters.shapes, { depth: 0.05, bevelEnabled: false, curveSegments: 12 }), MAT.dark, 0, 0, z - 0.025, bucket); }
  for (let i = 0; i < 5; i++) { const tg = new THREE.ConeGeometry(0.07, 0.24, 8); tg.rotateZ(Math.PI * 0.62); mesh(tg, MAT.steel, 1.08, -0.62, lerp(-0.34, 0.34, i / 4), bucket); }
  const load = mesh(moundGeometry(0.42, 0.3, 0.38, 3), MAT.dirt, 0.55, -0.12, 0, bucket); load.rotation.z = -0.3;

  // hydraulic rams
  const ramBoom = makeRam(0.1), ramStick = makeRam(0.085), ramBucket = makeRam(0.075);
  upper.add(ramBoom.group); boomPivot.add(ramStick.group); stickPivot.add(ramBucket.group);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  const J = { root, upper, boomPivot, stickPivot, bucketPivot, load, lights: [...lights, boomLight] };
  J.update = ({ drive = 0, swing = 0, boom = 0.2, stick = -1.2, bucketA = 0.4, load: ld = 0, lightsOn = 0, wobble = 0 } = {}) => {
    trackL.update(drive); trackR.update(drive);
    upper.rotation.y = swing;
    upper.rotation.z = wobble;
    boomPivot.rotation.z = boom; stickPivot.rotation.z = stick; bucketPivot.rotation.z = bucketA;
    load.visible = ld > 0.02; load.scale.setScalar(Math.max(0.01, ld));
    root.updateMatrixWorld(true);
    // boom ram: upper body front -> boom underside
    tmp.set(0.75, 0.35, -0.25); tmp2.set(1.25, 0.05, 0).applyMatrix4(boomPivot.matrix);
    ramBoom.set(tmp, tmp2);
    // stick ram: on top of boom -> stick heel (boomPivot space)
    tmp.set(1.5, 0.62, 0); tmp2.set(-0.45, 0.2, 0).applyMatrix4(stickPivot.matrix);
    ramStick.set(tmp, tmp2);
    // bucket ram: along the stick -> bucket linkage (stickPivot space)
    tmp.set(0.35, 0.22, 0); tmp2.set(0.05, 0.22, 0).applyMatrix4(bucketPivot.matrix);
    ramBucket.set(tmp, tmp2);
  };
  // bucket tip in world space (for particles)
  J.bucketTip = (out = new THREE.Vector3()) => { bucket.updateMatrixWorld(true); return out.set(0.95, -0.5, 0).applyMatrix4(bucket.matrixWorld); };
  J.bucketMid = (out = new THREE.Vector3()) => { bucket.updateMatrixWorld(true); return out.set(0.55, -0.1, 0).applyMatrix4(bucket.matrixWorld); };
  J.update({});
  return J;
}

// ---------------------------------------------------------------- bulldozer
export function buildBulldozer() {
  const root = new THREE.Group();
  const tL = trackAssembly(3.0, 0.78, 0.58), tR = trackAssembly(3.0, 0.78, 0.58);
  tL.group.position.set(0, 0.39, 0.86); tR.group.position.set(0, 0.39, -0.86);
  root.add(tL.group, tR.group);
  mesh(rbox(2.6, 0.4, 1.2, 0.08), MAT.dark, 0, 0.7, 0, root);
  mesh(rbox(2.0, 0.85, 1.35, 0.14), MAT.yellow, 0.35, 1.25, 0, root); // engine hood
  mesh(rbox(0.12, 0.62, 1.05, 0.03), MAT.grille, 1.37, 1.2, 0, root);
  for (let i = 0; i < 5; i++) mesh(rbox(0.05, 0.04, 1.0, 0.01), MAT.chrome, 1.43, 0.98 + i * 0.12, 0, root);
  mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.75, 12), MAT.dark, 0.85, 1.95, -0.35, root);
  const lights = [headlight(root, 1.4, 1.62, 0.42), headlight(root, 1.4, 1.62, -0.42)];
  // cab with roll cage
  const c = cab(1.15, 1.2, 1.2); c.position.set(-0.75, 2.15, 0); root.add(c);
  mesh(rbox(1.25, 0.6, 1.4, 0.12), MAT.yellow, -0.75, 1.3, 0, root);
  mesh(new THREE.SphereGeometry(0.1, 14, 10), MAT.orange, -0.75, 2.85, 0.35, root);
  // blade on push arms, raised by rams
  const bladePivot = new THREE.Group(); bladePivot.position.set(-0.2, 0.5, 0); root.add(bladePivot);
  const armG = rbox(2.1, 0.16, 0.16, 0.04);
  for (const z of [0.86, -0.86]) mesh(armG, MAT.yellow, 1.05, 0, z, bladePivot);
  const blade = new THREE.Group(); blade.position.set(2.15, 0.15, 0); bladePivot.add(blade);
  const bsh = new THREE.Shape();
  bsh.moveTo(0, -0.42); bsh.quadraticCurveTo(0.42, 0.1, 0.12, 0.72); bsh.lineTo(0.0, 0.7); bsh.quadraticCurveTo(0.28, 0.1, -0.12, -0.42); bsh.closePath();
  const bladeG = new THREE.ExtrudeGeometry(bsh, { depth: 2.7, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 14 });
  bladeG.translate(0, 0, -1.35);
  mesh(bladeG, MAT.yellow, 0, 0, 0, blade);
  mesh(rbox(0.1, 0.12, 2.74, 0.02), MAT.steel, 0.02, -0.44, 0, blade); // cutting edge
  for (const z of [1.3, -1.3]) mesh(rbox(0.16, 0.2, 0.12, 0.03), MAT.steel, 0.05, -0.38, z, blade);
  const rams = [makeRam(0.08), makeRam(0.08)]; rams.forEach((r) => root.add(r.group));
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const J = { root, blade, bladePivot, lights };
  J.update = ({ drive = 0, bladeLift = 0 } = {}) => {
    tL.update(drive); tR.update(drive);
    bladePivot.rotation.z = bladeLift * 0.32;
    root.updateMatrixWorld(true);
    [0.55, -0.55].forEach((z, i) => {
      tmp.set(1.25, 1.55, z);
      tmp2.set(-0.05, 0.55, z).applyMatrix4(blade.matrix).applyMatrix4(bladePivot.matrix);
      rams[i].set(tmp, tmp2);
    });
  };
  J.bladeFront = (out = new THREE.Vector3()) => { blade.updateMatrixWorld(true); return out.set(0.35, -0.2, 0).applyMatrix4(blade.matrixWorld); };
  J.update({});
  return J;
}

// ---------------------------------------------------------------- dump truck
function tireGeometry(R = 0.55, W = 0.42) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push(new THREE.Vector2(R * 0.62 + Math.cos(a) * (R * 0.38), Math.sin(a) * (W / 2)));
  }
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateX(Math.PI / 2);
  // chunky tread blocks
  const blocks = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    for (const z of [-W * 0.22, W * 0.22]) {
      const b = rbox(0.12, 0.08, W * 0.36, 0.02, 1);
      b.rotateZ(a + (z > 0 ? 0.08 : -0.08));
      b.translate(Math.cos(a + Math.PI / 2) * R * 0.99, Math.sin(a + Math.PI / 2) * R * 0.99, z);
      blocks.push(b);
    }
  }
  return mergeGeometries([g.toNonIndexed(), ...blocks.map((b) => (b.index ? b.toNonIndexed() : b))]);
}

export function buildDumpTruck() {
  const root = new THREE.Group();
  const R = 0.52;
  const tG = tireGeometry(R, 0.4);
  const hubG = new THREE.CylinderGeometry(R * 0.5, R * 0.5, 0.42, 20); hubG.rotateX(Math.PI / 2);
  const nutG = new THREE.CylinderGeometry(0.04, 0.04, 0.44, 6); nutG.rotateX(Math.PI / 2);
  const wheels = [];
  for (const x of [1.25, -0.75, -1.65]) for (const z of [0.82, -0.82]) {
    const w = new THREE.Group(); w.position.set(x, R, z); root.add(w);
    mesh(tG, MAT.rubber, 0, 0, 0, w);
    mesh(hubG, MAT.yellowClean, 0, 0, 0, w);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mesh(nutG, MAT.chrome, Math.cos(a) * R * 0.32, Math.sin(a) * R * 0.32, 0, w); }
    wheels.push(w);
  }
  mesh(rbox(3.7, 0.3, 1.0, 0.06), MAT.dark, -0.15, 0.78, 0, root); // chassis
  for (const x of [1.25, -0.75, -1.65]) mesh(rbox(0.6, 0.38, 1.7, 0.1), MAT.yellow, x, 1.12, 0, root).scale.set(1, 0.6, 1); // fenders
  // cab + hood
  const c = cab(1.0, 1.05, 1.5); c.position.set(0.85, 1.75, 0); root.add(c);
  mesh(rbox(0.75, 0.7, 1.5, 0.14), MAT.yellow, 1.6, 1.28, 0, root);
  mesh(rbox(0.06, 0.5, 1.0, 0.02), MAT.grille, 1.99, 1.25, 0, root);
  for (let i = 0; i < 4; i++) mesh(rbox(0.03, 0.03, 0.95, 0.01), MAT.chrome, 2.03, 1.08 + i * 0.12, 0, root);
  mesh(rbox(0.16, 0.18, 1.7, 0.05), MAT.dark, 2.05, 0.78, 0, root); // bumper
  const lights = [headlight(root, 2.0, 1.42, 0.58, 0.1), headlight(root, 2.0, 1.42, -0.58, 0.1)];
  mesh(new THREE.SphereGeometry(0.08, 12, 8), MAT.orange, 0.85, 2.35, 0.5, root);
  // dump bed tilting about the rear hinge
  const bedPivot = new THREE.Group(); bedPivot.position.set(-2.0, 1.05, 0); root.add(bedPivot);
  const bed = new THREE.Group(); bedPivot.add(bed);
  const L = 2.6, Hh = 0.95, Wd = 1.75;
  mesh(rbox(L, 0.12, Wd, 0.04), MAT.yellow, L / 2, 0.06, 0, bed);
  for (const z of [Wd / 2, -Wd / 2]) {
    mesh(rbox(L, Hh, 0.1, 0.04), MAT.yellow, L / 2, Hh / 2, z, bed);
    for (let i = 0; i < 4; i++) mesh(rbox(0.08, Hh * 0.9, 0.06, 0.02), MAT.yellow, 0.3 + i * 0.7, Hh / 2, z + Math.sign(z) * 0.06, bed);
  }
  mesh(rbox(0.1, Hh + 0.25, Wd, 0.04), MAT.yellow, L, (Hh + 0.25) / 2, 0, bed); // front wall
  mesh(rbox(0.5, 0.08, Wd, 0.03), MAT.yellow, L + 0.2, Hh + 0.25, 0, bed);     // cab protector
  const load = mesh(moundGeometry(1.1, 0.75, 0.72, 5), MAT.dirt, L / 2, 0.12, 0, bed);
  const ram = makeRam(0.09); root.add(ram.group);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const J = { root, bed, bedPivot, load, lights };
  J.update = ({ drive = 0, tip = 0, load: ld = 0, rockLoad = false } = {}) => {
    for (const w of wheels) w.rotation.z = -drive / R;
    bedPivot.rotation.z = -tip * 0.85;
    load.visible = ld > 0.02; load.scale.set(1, Math.max(0.01, ld), 1);
    load.material = rockLoad ? MAT.rock : MAT.dirt;
    root.updateMatrixWorld(true);
    tmp.set(0.2, 0.85, 0); tmp2.set(1.7, 0.0, 0).applyMatrix4(bed.matrix).applyMatrix4(bedPivot.matrix);
    ram.set(tmp, tmp2);
  };
  J.bedLip = (out = new THREE.Vector3()) => { bed.updateMatrixWorld(true); return out.set(-0.1, 0.4, 0).applyMatrix4(bed.matrixWorld); };
  J.bedCenter = (out = new THREE.Vector3()) => { bed.updateMatrixWorld(true); return out.set(L / 2, Hh, 0).applyMatrix4(bed.matrixWorld); };
  J.update({});
  return J;
}

// ---------------------------------------------------------------- tunnel boring machine
export function buildTBM() {
  const root = new THREE.Group(); // origin = tunnel axis at the cutter face; machine extends to -x
  const parts = {};
  const shieldR = 2.42;
  // shield
  const shield = new THREE.Group(); root.add(shield); parts.shield = shield;
  const shG = new THREE.CylinderGeometry(shieldR, shieldR, 4.2, 48, 1, true); shG.rotateZ(Math.PI / 2);
  mesh(shG, MAT.yellow, -2.5, 0, 0, shield);
  const bandG = new THREE.TorusGeometry(shieldR + 0.02, 0.07, 8, 56); bandG.rotateY(Math.PI / 2);
  for (const x of [-0.65, -2.0, -3.3, -4.5]) mesh(bandG, MAT.dark, x, 0, 0, shield);
  const backG = new THREE.RingGeometry(1.0, shieldR, 48); backG.rotateY(-Math.PI / 2);
  mesh(backG, MAT.dark, -4.6, 0, 0, shield);
  // hazard-striped band at the tail
  const hz = document.createElement('canvas'); hz.width = 512; hz.height = 64; const hg = hz.getContext('2d');
  hg.fillStyle = '#f2b215'; hg.fillRect(0, 0, 512, 64); hg.fillStyle = '#1e1e1e';
  for (let i = -2; i < 20; i++) { hg.beginPath(); hg.moveTo(i * 32, 64); hg.lineTo(i * 32 + 16, 64); hg.lineTo(i * 32 + 48, 0); hg.lineTo(i * 32 + 32, 0); hg.closePath(); hg.fill(); }
  const hzT = new THREE.CanvasTexture(hz); hzT.colorSpace = THREE.SRGBColorSpace; hzT.wrapS = THREE.RepeatWrapping; hzT.repeat.set(4, 1);
  const hzG = new THREE.CylinderGeometry(shieldR + 0.025, shieldR + 0.025, 0.45, 64, 1, true); hzG.rotateZ(Math.PI / 2);
  mesh(hzG, std({ map: hzT, roughness: 0.5 }, 'hazard'), -4.3, 0, 0, shield);
  // hatches, pipes and a little side cabin facing the camera
  const hatchG = rbox(0.9, 0.9, 0.12, 0.08);
  for (const [hx, hy] of [[-1.4, 0.6], [-3.0, 0.6]]) { const h = mesh(hatchG, MAT.dark, hx, hy, shieldR - 0.02, shield); mesh(rbox(0.6, 0.06, 0.06, 0.02), MAT.chrome, hx, hy - 0.25, shieldR + 0.06, shield); }
  const pipeG = new THREE.CylinderGeometry(0.06, 0.06, 4.0, 10); pipeG.rotateZ(Math.PI / 2);
  for (const a of [0.55, 0.75, 1.0]) mesh(pipeG, a === 0.75 ? MAT.yellowClean : MAT.steel, -2.4, Math.cos(a) * (shieldR + 0.08), Math.sin(a) * (shieldR + 0.08), shield);
  const cabin = mesh(rbox(1.4, 0.9, 0.7, 0.14), MAT.yellowClean, -2.2, -0.9, shieldR - 0.05, shield);
  mesh(rbox(1.0, 0.45, 0.05, 0.05), MAT.glass, -2.2, -0.82, shieldR + 0.31, shield);
  const sideLights = [];
  for (const sx of [-0.9, -3.6]) sideLights.push(mesh(new THREE.SphereGeometry(0.12, 14, 10), MAT.head, sx, 1.3, shieldR - 0.3, shield));
  // cutterhead
  const head = new THREE.Group(); head.position.x = -0.1; root.add(head); parts.head = head;
  const spin = new THREE.Group(); head.add(spin); parts.spin = spin;
  const discG = new THREE.CylinderGeometry(shieldR + 0.05, shieldR + 0.05, 0.42, 56); discG.rotateZ(Math.PI / 2);
  mesh(discG, MAT.dark, 0, 0, 0, spin);
  const spokeG = rbox(0.24, shieldR * 2 - 0.2, 0.42, 0.06);
  for (let i = 0; i < 3; i++) { const s = mesh(spokeG, MAT.yellow, 0.24, 0, 0, spin); s.rotation.x = i * Math.PI / 3; }
  const coneG = new THREE.ConeGeometry(0.45, 0.7, 24); coneG.rotateZ(-Math.PI / 2);
  mesh(coneG, MAT.steel, 0.55, 0, 0, spin);
  const cutterG = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 18); cutterG.rotateX(Math.PI / 2);
  const cutters = [];
  for (let ring = 0; ring < 4; ring++) {
    const rr = 0.75 + ring * 0.5, n = 6 + ring * 3;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ring * 0.3; cutters.push([rr * Math.cos(a), rr * Math.sin(a), a]); }
  }
  const cutIM = new THREE.InstancedMesh(cutterG, MAT.chrome, cutters.length);
  const o = new THREE.Object3D();
  cutters.forEach(([y, z, a], i) => { o.position.set(0.26, y, z); o.rotation.set(a, 0, 0); o.updateMatrix(); cutIM.setMatrixAt(i, o.matrix); });
  cutIM.castShadow = true; spin.add(cutIM);
  const scrG = rbox(0.22, 0.42, 0.3, 0.05);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const s = mesh(scrG, i % 2 ? MAT.yellow : MAT.dark, 0.14, Math.cos(a) * (shieldR + 0.02), Math.sin(a) * (shieldR + 0.02), spin); s.rotation.x = a; }
  // rim teeth stick out a little so the spin reads from the side
  const toothG = new THREE.ConeGeometry(0.1, 0.3, 8); toothG.rotateZ(-Math.PI / 2);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; mesh(toothG, MAT.chrome, 0.36, Math.cos(a) * (shieldR - 0.25), Math.sin(a) * (shieldR - 0.25), spin); }
  const rimBandG = new THREE.CylinderGeometry(shieldR + 0.08, shieldR + 0.08, 0.16, 48, 1, true); rimBandG.rotateZ(Math.PI / 2);
  for (let i = 0; i < 8; i++) { const segG = new THREE.CylinderGeometry(shieldR + 0.09, shieldR + 0.09, 0.17, 6, 1, true, i / 8 * Math.PI * 2, Math.PI / 8); segG.rotateZ(Math.PI / 2); mesh(segG, MAT.dark, -0.05, 0, 0, spin); }
  // erector arm (places ring segments) at the tail
  const erector = new THREE.Group(); erector.position.x = -4.9; root.add(erector); parts.erector = erector;
  mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 20).rotateZ(Math.PI / 2), MAT.dark, 0, 0, 0, erector);
  const arm = mesh(rbox(0.3, 1.7, 0.35, 0.06), MAT.yellow, 0, 0.95, 0, erector);
  const grip = mesh(rbox(0.7, 0.18, 0.9, 0.05), MAT.dark, 0, 1.85, 0, erector);
  // trailers (gantries) with conveyor + tanks + lights
  const trailers = [];
  for (let k = 0; k < 1; k++) {
    const tr = new THREE.Group(); tr.position.x = -6.5; root.add(tr); trailers.push(tr);
    for (const z of [1.15, -1.15]) for (const x of [-1.15, 1.15]) mesh(rbox(0.2, 3.0, 0.2, 0.05), MAT.yellow, x, -0.05, z, tr);
    for (const z of [1.15, -1.15]) { mesh(rbox(2.6, 0.2, 0.22, 0.05), MAT.yellow, 0, 1.42, z, tr); mesh(rbox(2.6, 0.18, 0.2, 0.05), MAT.yellow, 0, -0.35, z, tr); }
    mesh(rbox(2.6, 0.12, 2.5, 0.04), MAT.dark, 0, 1.58, 0, tr);
    mesh(rbox(2.4, 0.14, 0.9, 0.04), MAT.dark, 0, 0.55, 0, tr); // conveyor
    const tank = new THREE.CylinderGeometry(0.4, 0.4, 1.3, 20); tank.rotateZ(Math.PI / 2);
    mesh(tank, MAT.dark, -0.4, 0.0, -0.7, tr);
    mesh(rbox(0.8, 0.85, 0.75, 0.1), MAT.yellowClean, 0.7, 0.0, -0.68, tr);
    mesh(rbox(0.7, 0.55, 0.5, 0.08), MAT.dark, 0.5, 0.92, 0.55, tr);
    const wheelG = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16); wheelG.rotateX(Math.PI / 2);
    for (const x of [-0.9, 0.9]) for (const z of [0.72, -0.72]) mesh(wheelG, MAT.dark, x, -1.53, z, tr);
    mesh(rbox(0.3, 0.12, 0.3, 0.04), MAT.head, 0, 1.33, 0.95, tr);
  }
  parts.trailers = trailers;
  const lights = [headlight(root, -0.6, 2.3, 0.9, 0.12), headlight(root, -0.6, 2.3, -0.9, 0.12)];
  // a ring segment held by the erector
  const segG = new THREE.CylinderGeometry(2.6, 2.6, 0.85, 24, 1, true, -0.6, 1.2); segG.rotateZ(Math.PI / 2);
  const seg = mesh(segG, std({ color: 0xd9d6cf, roughness: 0.9, side: THREE.DoubleSide, map: tex('concrete_albedo', { srgb: true }) }, 'segment'), -5.45, 0, 0, root);
  parts.seg = seg;

  const J = { root, parts, lights, erector, seg };
  // assemble: 0..1 per part (pops), spinA: cutter angle, erectA: erector angle
  J.update = ({ asm = [1, 1, 1, 1, 1], spinA = 0, erectA = 0, segShow = 0 } = {}) => {
    const [aS, aH, aE, aT1, aT2] = asm;
    shield.visible = aS > 0.001; shield.scale.setScalar(Math.max(0.001, aS)); shield.position.y = (1 - Math.min(1, aS)) * 3;
    head.visible = aH > 0.001; head.scale.setScalar(Math.max(0.001, aH)); head.position.x = -0.1 + (1 - Math.min(1, aH)) * -3;
    erector.visible = aE > 0.001; erector.scale.setScalar(Math.max(0.001, aE));
    trailers[0].visible = aT1 > 0.001; trailers[0].scale.setScalar(Math.max(0.001, aT1)); trailers[0].position.y = (1 - Math.min(1, aT1)) * 4;
    spin.rotation.x = spinA;
    erector.rotation.x = erectA;
    seg.visible = segShow > 0.01; seg.rotation.x = erectA; seg.scale.setScalar(Math.max(0.01, segShow));
  };
  J.update({});
  return J;
}

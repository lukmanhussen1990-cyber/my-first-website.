// Tunnel system: raw bored tube, dig faces, concrete rings, track, lamps, portal, steep first attempt,
// glowing guide dots and the end station. Everything is driven by update(state) from the timeline.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as GEO from './geo.js';
import { earthMaterial, std, phys, glowMaterial, tex, wallMaterial } from '../lib/materials.js';
import { clamp, lerp, smoothstep, pop, ease } from '../lib/util.js';

const { TUBE_Z, R_RAW, R_RING_IN, R_RING_OUT, BED_DROP } = GEO;
const PHI0 = -Math.asin(-TUBE_Z / R_RAW) - 0.02; // where the tube meets the cut plane

// inner surface of a tube cut by the z = 0 plane, swept along y = yFn(x)
function tubeGeometry(yFn, x0, x1, step, radius, inward = true) {
  const pos = [], nrm = [], idx = [];
  const phiA = -Math.asin(-TUBE_Z / radius), phiB = Math.PI + Math.asin(-TUBE_Z / radius);
  const M = 30;
  const cols = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) cols.push(x);
  cols.forEach((x) => {
    const y = yFn(x);
    const a = GEO.slopeAngle(yFn, x);
    const nx = -Math.sin(a), ny = Math.cos(a); // in-plane normal (perpendicular to path)
    for (let k = 0; k <= M; k++) {
      const phi = lerp(phiA, phiB, k / M);
      const cy = Math.cos(phi), cz = -Math.sin(phi);
      pos.push(x + nx * radius * cy, y + ny * radius * cy, TUBE_Z + radius * cz);
      const s = inward ? -1 : 1;
      nrm.push(s * nx * cy, s * ny * cy, s * cz);
    }
  });
  for (let i = 0; i < cols.length - 1; i++) for (let k = 0; k < M; k++) {
    const a = i * (M + 1) + k, b = a + 1, c = a + M + 1, d = c + 1;
    if (inward) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.userData = { x0, step, perCol: M * 6 };
  return g;
}

// generic sweep of a (z, yRel) profile along the tunnel centre line (for bed, rails)
function trackSweep(yFn, x0, x1, step, profile, { uvScale = 0.5 } = {}) {
  const pos = [], uv = [], idx = [];
  const m = profile.length;
  const cols = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) cols.push(x);
  let s = 0, py = yFn(x0);
  cols.forEach((x, i) => {
    const y = yFn(x);
    if (i) s += Math.hypot(step, y - py); py = y;
    const a = GEO.slopeAngle(yFn, x);
    const nx = -Math.sin(a), ny = Math.cos(a);
    let pl = 0;
    profile.forEach(([z, h], k) => {
      if (k) pl += Math.hypot(z - profile[k - 1][0], h - profile[k - 1][1]);
      pos.push(x + nx * h, y + ny * h, z);
      uv.push(s * uvScale, pl * uvScale);
    });
  });
  for (let i = 0; i < cols.length - 1; i++) for (let k = 0; k < m - 1; k++) {
    const a = i * m + k, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData = { x0, step, perCol: (m - 1) * 6 };
  return g;
}

// draw only the part of a swept geometry between xa and xb
function setRange(mesh, xa, xb) {
  const { x0, step, perCol } = mesh.geometry.userData;
  const total = mesh.geometry.index.count;
  const i0 = clamp(Math.floor((xa - x0) / step), 0, total / perCol);
  const i1 = clamp(Math.ceil((xb - x0) / step), 0, total / perCol);
  mesh.geometry.setDrawRange(i0 * perCol, Math.max(0, i1 - i0) * perCol);
  mesh.visible = i1 > i0;
}

// concrete ring segment: annulus cut flat at the slice plane, extruded along x
function ringGeometry() {
  const s = new THREE.Shape();
  const zEnd = -TUBE_Z + 0.02; // reach just in front of the cut plane
  const arc = (r, a, b, n, out) => { for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / n); out.push([r * Math.sin(p), r * Math.cos(p)]); } };
  const po = Math.asin(zEnd / R_RING_OUT), pi = Math.asin(zEnd / R_RING_IN);
  const pts = [];
  arc(R_RING_OUT, -po, Math.PI + po, 48, pts);
  arc(R_RING_IN, Math.PI + pi, -pi, 48, pts);
  // u = r sin(phi) is depth into the hill; front end of the ring sits at u = -zEnd
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.84, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -0.42);
  g.rotateY(Math.PI / 2); // extrusion -> world x, shape u -> world -z
  // UVs: scale so concrete texture has sensible density
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35, uv.getY(i) * 0.35);
  return g;
}

function portalGeometry() {
  // stone headwall facing -x with an arched opening that runs into the cut plane
  const cy = GEO.tunnelY(GEO.PORTAL_X), r = R_RING_OUT + 0.55;
  const zc = TUBE_Z;
  const s = new THREE.Shape();
  const topY = 10.2, back = 7.5;
  const yAtCut = cy + Math.sqrt(r * r - zc * zc);
  const zLeft = zc - Math.sqrt(r * r - cy * cy);
  // shape coords (u, v) = (-z, y): rectangle [0, back] x [0, topY] minus the opening disk
  const uFloor = -zLeft;
  s.moveTo(0, topY); s.lineTo(0, yAtCut);
  const aStart = Math.atan2(yAtCut - cy, 0 - zc), aEnd = Math.atan2(0 - cy, zLeft - zc) + Math.PI * 2;
  const n = 48;
  for (let i = 1; i < n; i++) { const a = lerp(aStart, aEnd, i / n); s.lineTo(-(zc + r * Math.cos(a)), cy + r * Math.sin(a)); }
  s.lineTo(uFloor, 0); s.lineTo(back, 0); s.lineTo(back, topY); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 8 });
  g.rotateY(Math.PI / 2); // local x (u) -> world -z, extrusion -> +x (into the hill): a proper rotation, no mirroring
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4, uv.getY(i) / 2.4);
  const hA = new Float32Array(g.attributes.position.count); for (let i = 0; i < hA.length; i++) hA[i] = g.attributes.position.getY(i);
  g.setAttribute('aH', new THREE.BufferAttribute(hA, 1));
  return g;
}

function pictogramTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = kind === 'end' ? '#1d5c9e' : '#1d5c9e';
  g.beginPath(); g.roundRect(8, 8, 240, 240, 40); g.fill();
  g.fillStyle = '#ffffff';
  // simple train pictogram
  g.beginPath(); g.roundRect(64, 52, 128, 120, 26); g.fill();
  g.fillStyle = '#1d5c9e'; g.beginPath(); g.roundRect(80, 70, 96, 46, 10); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(92, 144, 10, 0, 7); g.arc(164, 144, 10, 0, 7); g.fill();
  g.fillRect(84, 172, 14, 28); g.fillRect(158, 172, 14, 28); g.fillRect(60, 200, 136, 10);
  if (kind === 'end') { g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(196, 30); g.lineTo(236, 48); g.lineTo(196, 66); g.closePath(); g.fill(); g.fillRect(190, 26, 8, 90); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildTunnel(scene, profileTex) {
  const group = new THREE.Group();
  scene.add(group);
  const range = [GEO.X_MIN, GEO.X_MAX];
  const rockMat = earthMaterial(profileTex, range, { key: 'tube', side: THREE.FrontSide, darkDeep: 0.4, inside: 1.0 });
  const rimMat = earthMaterial(profileTex, range, { key: 'rim', darkDeep: 0.4 });
  const concA = tex('concrete_albedo', { srgb: true }), concN = tex('concrete_normal'), concO = tex('concrete_orm');
  const concrete = std({ map: concA, normalMap: concN, roughnessMap: concO, aoMap: concO, color: 0xe8e4dc, roughness: 1 }, 'concrete');
  const concreteRing = std({ map: concA, normalMap: concN, roughnessMap: concO, color: 0xd9d6cf, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8), emissive: new THREE.Color('#ffc27a'), emissiveMap: concA, emissiveIntensity: 0 }, 'ring');
  const dirtMat = std({ map: tex('soil_albedo', { srgb: true }), normalMap: tex('soil_normal'), color: 0xbfa58c, roughness: 0.95 }, 'dirtfloor');
  const steel = std({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.32 }, 'rail');
  const sleeperMat = std({ map: concA, color: 0x9c958a, roughness: 0.9 }, 'sleeper');

  const S = {};
  const END_X = 470;
  // --- main raw tube + dig face
  // pieces before and after the station chamber
  const SEGS = [[GEO.PORTAL_X, GEO.STATION_X0], [GEO.STATION_X1, END_X]];
  S.tubes = SEGS.map(([a, b]) => { const m = new THREE.Mesh(tubeGeometry(GEO.tunnelY, a, b, 0.5, R_RAW), rockMat); m.receiveShadow = true; group.add(m); return m; });
  const capG = new THREE.CircleGeometry(R_RAW + 0.05, 40, Math.PI / 2 + PHI0, Math.PI - 2 * PHI0); // PHI0 < 0: reaches the cut plane
  capG.rotateY(-Math.PI / 2); // faces -x
  S.digFace = new THREE.Mesh(capG, rockMat); S.digFace.receiveShadow = true; group.add(S.digFace);
  // rocky rim around the opening edges (hides the cut boundary and reads as a chiselled lip)
  const rimG = (sign, a, b) => trackSweep(GEO.tunnelY, a, b, 0.5, [[0.12, sign * GEO.OPEN_H - 0.02], [0.0, sign * (GEO.OPEN_H + 0.18)], [-0.1, sign * (GEO.OPEN_H + 0.3)]]);
  S.rims = [];
  for (const [a, b] of SEGS) for (const sg of [1, -1]) { const m = new THREE.Mesh(rimG(sg, a, b), rimMat); group.add(m); S.rims.push(m); }

  // --- floor: dirt work floor (raw) and concrete track bed (finished)
  const floorProf = [[TUBE_Z - 2.1, -BED_DROP - 0.06], [0.05, -BED_DROP - 0.06], [0.05, -GEO.OPEN_H - 0.3]];
  S.dirtFloor = new THREE.Mesh(trackSweep(GEO.tunnelY, 6, END_X, 0.5, floorProf), dirtMat); S.dirtFloor.receiveShadow = true; group.add(S.dirtFloor);
  const bedProf = [[TUBE_Z - 2.1, -BED_DROP], [TUBE_Z - 1.15, -BED_DROP], [TUBE_Z - 1.0, -BED_DROP + 0.08], [TUBE_Z + 1.0, -BED_DROP + 0.08], [TUBE_Z + 1.15, -BED_DROP], [0.08, -BED_DROP], [0.08, -GEO.OPEN_H - 0.25]];
  const railProf = (zc) => [[zc - 0.06, -BED_DROP + 0.08], [zc - 0.06, -BED_DROP + 0.26], [zc + 0.06, -BED_DROP + 0.26], [zc + 0.06, -BED_DROP + 0.08]];
  const slG = new RoundedBoxGeometry(0.34, 0.12, 2.1, 1, 0.03);
  // track in three stretches: valley (A), the last bit by the portal (B), the tunnel (C)
  const trackPiece = (a, b) => {
    const p = { a, b };
    p.bed = new THREE.Mesh(trackSweep(GEO.tunnelY, a, b, 0.5, bedProf, { uvScale: 0.3 }), concrete); p.bed.receiveShadow = true; group.add(p.bed);
    p.rails = [TUBE_Z - 0.72, TUBE_Z + 0.72].map((zc) => { const m = new THREE.Mesh(trackSweep(GEO.tunnelY, a, b, 0.5, railProf(zc)), steel); m.castShadow = true; group.add(m); return m; });
    p.slX = []; for (let x = a + 0.35; x < b; x += 0.7) p.slX.push(x);
    p.sleepers = new THREE.InstancedMesh(slG, sleeperMat, p.slX.length);
    p.slX.forEach((x, i) => { const y = GEO.tunnelY(x) - BED_DROP + 0.12; o.position.set(x, y, TUBE_Z); o.rotation.set(0, 0, GEO.slopeAngle(GEO.tunnelY, x)); o.scale.set(1, 1, 1); o.updateMatrix(); p.sleepers.setMatrixAt(i, o.matrix); });
    p.sleepers.receiveShadow = true; group.add(p.sleepers);
    p.group = [p.bed, ...p.rails, p.sleepers];
    return p;
  };
  const o = new THREE.Object3D();
  S.trackA = trackPiece(-36, 6); S.trackB = trackPiece(6, GEO.PORTAL_X); S.trackC = trackPiece(GEO.PORTAL_X, END_X);
  // track bumper at the valley end
  const stop = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.9, 2.2, 2, 0.08), std({ color: 0xd2232a, roughness: 0.5 }, 'buffer'));
  stop.position.set(-36.3, GEO.tunnelY(-36) - BED_DROP + 0.5, TUBE_Z); stop.castShadow = true; group.add(stop); S.trackA.group.push(stop);

  // --- rings
  const ringG = ringGeometry();
  S.ringX = []; for (let x = GEO.PORTAL_X + 0.5; x < GEO.STATION_X0 - 0.4; x += 1.0) S.ringX.push(x);
  for (let x = GEO.STATION_X1 + 0.5; x < END_X - 2; x += 1.0) S.ringX.push(x);
  S.rings = new THREE.InstancedMesh(ringG, concreteRing, S.ringX.length);
  S.rings.castShadow = false; S.rings.receiveShadow = true; S.rings.frustumCulled = false; group.add(S.rings);

  // --- lamps on the ceiling (back-top of the tube) + a continuous glowing strip
  const lampG = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8); lampG.rotateZ(Math.PI / 2);
  S.lampMat = glowMaterial('#ffe2b0', 6.0, 'lamp');
  S.lampX = []; for (let x = GEO.PORTAL_X + 2.5; x < END_X - 3; x += 4.0) if (x < GEO.STATION_X0 || x > GEO.STATION_X1) S.lampX.push(x);
  S.lamps = new THREE.InstancedMesh(lampG, S.lampMat, S.lampX.length);
  S.lamps.frustumCulled = false; group.add(S.lamps);
  const phiL = 0.75, rL = R_RING_IN - 0.08;
  S.lampPos = (x, stretch = 1) => {
    const y = GEO.tunnelY(x), a = GEO.slopeAngle(GEO.tunnelY, x);
    o.position.set(x - Math.sin(a) * rL * Math.cos(phiL), y + Math.cos(a) * rL * Math.cos(phiL), TUBE_Z - rL * Math.sin(phiL));
    o.rotation.set(0, 0, a); o.scale.set(stretch, 1, 1); o.updateMatrix(); return o.matrix;
  };
  S.lampX.forEach((x, i) => S.lamps.setMatrixAt(i, S.lampPos(x)));
  const stripProf = [[TUBE_Z - (rL - 0.05) * Math.sin(phiL + 0.05), rL * Math.cos(phiL + 0.05)], [TUBE_Z - (rL - 0.05) * Math.sin(phiL - 0.05), rL * Math.cos(phiL - 0.05)]];
  S.stripMat = glowMaterial('#ffd59a', 0.0, 'strip');
  S.strips = SEGS.map(([a, b]) => { const m = new THREE.Mesh(trackSweep(GEO.tunnelY, a, b, 1.0, stripProf), S.stripMat); group.add(m); return m; });

  // --- steep first attempt
  S.steepTube = new THREE.Mesh(tubeGeometry(GEO.steepY, GEO.JUNCTION_X, GEO.STEEP_END, 0.5, R_RAW), rockMat); S.steepTube.receiveShadow = true; group.add(S.steepTube);
  S.steepBed = new THREE.Mesh(trackSweep(GEO.steepY, GEO.JUNCTION_X, GEO.STEEP_END, 0.5, bedProf, { uvScale: 0.3 }), concrete); group.add(S.steepBed);
  S.steepRails = [TUBE_Z - 0.72, TUBE_Z + 0.72].map((zc) => { const m = new THREE.Mesh(trackSweep(GEO.steepY, GEO.JUNCTION_X, GEO.STEEP_END, 0.5, railProf(zc)), steel); group.add(m); return m; });
  S.steepRims = [1, -1].map((sg) => { const m = new THREE.Mesh(trackSweep(GEO.steepY, GEO.JUNCTION_X + 6, GEO.STEEP_END, 0.5, [[0.12, sg * GEO.OPEN_H - 0.02], [0.0, sg * (GEO.OPEN_H + 0.18)], [-0.1, sg * (GEO.OPEN_H + 0.3)]]), rimMat); group.add(m); return m; });
  const steepCap = new THREE.Mesh(capG, rockMat); group.add(steepCap);
  { const x = GEO.STEEP_END; steepCap.position.set(x, GEO.steepY(x), TUBE_Z); steepCap.rotation.z = GEO.slopeAngle(GEO.steepY, x); steepCap.rotation.y = Math.PI; }
  S.steepCap = steepCap;

  // --- glowing guide dots for the gentle deep path
  S.dotX = []; for (let x = GEO.JUNCTION_X + 1; x < 205; x += 2.2) S.dotX.push(x);
  S.dotMat = glowMaterial('#7ff3ff', 5.0, 'dots');
  S.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 14, 10), S.dotMat, S.dotX.length);
  S.dots.frustumCulled = false; group.add(S.dots);

  // --- portal headwall (pops in) + lamps
  S.portal = new THREE.Group();
  const stone = wallMaterial('blocks');
  const pm = new THREE.Mesh(portalGeometry(), stone); pm.castShadow = pm.receiveShadow = true; S.portal.add(pm);
  // arch ring of dressed stone around the opening
  const cyP = GEO.tunnelY(GEO.PORTAL_X), rA = R_RING_OUT + 0.3;
  const phiE = Math.asin(-TUBE_Z / rA);
  const archG = new THREE.TorusGeometry(rA, 0.24, 10, 48, Math.PI + 2 * phiE);
  archG.rotateZ(-(Math.PI / 2 + phiE)); archG.rotateY(Math.PI / 2);
  const archMat = std({ map: tex('concrete_albedo', { srgb: true }), normalMap: tex('concrete_normal'), color: 0xd8cdbb, roughness: 0.85 }, 'arch');
  archG.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(archG.attributes.position.count).fill(2), 1));
  const arch = new THREE.Mesh(archG, stone); arch.position.set(-0.1, cyP, TUBE_Z); arch.scale.set(1.3, 1, 1); arch.castShadow = true; S.portal.add(arch);
  const cornice = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.55, 8.0, 2, 0.12), archMat); cornice.position.set(0.25, 10.3, -3.85); cornice.castShadow = true; S.portal.add(cornice);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), std({ map: pictogramTexture('train'), roughness: 0.4, emissive: 0xffffff, emissiveMap: pictogramTexture('train'), emissiveIntensity: 0.2 }, 'sign'));
  sign.rotation.y = -Math.PI / 2; sign.position.set(-0.13, 7.0, -1.1); S.portal.add(sign);
  S.portalLampMat = glowMaterial('#ffd9a0', 0, 'plamp');
  for (const z of [-4.7]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), S.portalLampMat); l.position.set(-0.35, 5.1, z); S.portal.add(l);
    const br = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.12, 1, 0.03), std({ color: 0x2b2b30, metalness: 0.7, roughness: 0.4 }, 'bracket')); br.position.set(-0.2, 4.85, z); S.portal.add(br);
  }
  // stone reveal inside the arch: hides the hillside behind the opening
  const phiO = -Math.asin(-TUBE_Z / (R_RING_OUT + 0.7));
  const revG = new THREE.RingGeometry(R_RAW - 0.08, R_RING_OUT + 0.7, 48, 1, Math.PI / 2 + phiO, Math.PI - 2 * phiO);
  revG.rotateY(-Math.PI / 2);
  const reveal = new THREE.Mesh(revG, stone); reveal.position.set(0.12, cyP, TUBE_Z); reveal.receiveShadow = true;
  revG.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(revG.attributes.position.count).fill(2), 1));
  S.portal.add(reveal);
  S.portal.position.x = GEO.PORTAL_X;
  group.add(S.portal);

  // --- dirt plug in front of the portal (the hillside before it is dug away)
  S.plug = buildPlug();
  group.add(S.plug.mesh);

  // --- end station
  S.station = buildStation(concrete, rockMat);
  group.add(S.station.group);

  S.concrete = concrete;
  S.ringMat = concreteRing;
  S.group = group;
  return S;
}

function buildPlug() {
  const NX = 16, NZ = 10, NY = 6;
  const geo = new THREE.BoxGeometry(1, 1, 1, NX, NY, NZ);
  const base = geo.attributes.position.array.slice();
  const mat = std({ map: tex('soil_albedo', { srgb: true }), normalMap: tex('soil_normal'), color: 0xd0b8a0, roughness: 0.95 }, 'plug');
  const grassMat = std({ map: tex('grass_albedo', { srgb: true }), color: 0xffffff, roughness: 0.95 }, 'pluggrass');
  const mesh = new THREE.Mesh(geo, [mat, mat, grassMat, mat, mat, mat]);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const uv = geo.attributes.uv;
  const uvBase = uv.array.slice();
  // xFront = current dug position (6 = untouched hillside, 13.2 = fully dug)
  const setFront = (xFront) => {
    const p = geo.attributes.position;
    const x1 = GEO.PORTAL_X + 0.4, z0 = -5.0, z1 = 0.0;
    for (let i = 0; i < p.count; i++) {
      const u = base[i * 3] + 0.5, v = base[i * 3 + 1] + 0.5, w = base[i * 3 + 2] + 0.5;
      const x = lerp(xFront, x1, u), z = lerp(z0, z1, w);
      const top = Math.max(0.05, GEO.groundH(x, z) * smoothstep(xFront - 0.01, xFront + 1.4, x) + 0.05);
      p.setXYZ(i, x, lerp(-0.05, top, v), z);
      uv.setXY(i, uvBase[i * 2] * 2.5, uvBase[i * 2 + 1] * 2.5);
    }
    p.needsUpdate = true; uv.needsUpdate = true; geo.computeVertexNormals();
    mesh.visible = xFront < x1 - 0.3;
  };
  return { mesh, setFront };
}

function buildStation(concrete, rockMat) {
  const g = new THREE.Group();
  const x0 = GEO.STATION_X0, x1 = GEO.STATION_X1, L = x1 - x0;
  const fy = GEO.tunnelY(x0) - GEO.BED_DROP; // track bed level
  const tiles = std({ map: tex('tiles_albedo', { srgb: true }), normalMap: tex('tiles_normal'), roughness: 0.35, color: 0xd8cfc2 }, 'tiles');
  tiles.map.repeat.set(1, 1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(L, 7.2), tiles);
  back.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = i % 2 === 0 ? v * L / 2.0 : v * 7.2 / 2.0; });
  back.position.set((x0 + x1) / 2, fy + 2.7, -4.7); back.receiveShadow = true; g.add(back);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L, 0.35, 0.05), std({ color: 0xc8202a, roughness: 0.35 }, 'stripe')); stripe.position.set((x0 + x1) / 2, fy + 4.4, -4.66); g.add(stripe);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(L + 0.6, 0.5, 5.1), concrete); ceil.position.set((x0 + x1) / 2, fy + 6.45, -2.2); ceil.receiveShadow = true; g.add(ceil);
  for (const ex of [x0 - 0.25, x1 + 0.25]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.2, 5.1), concrete); w.position.set(ex, fy + 2.4, -2.2); w.receiveShadow = true; g.add(w); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.4, 2.4), concrete); floor.position.set((x0 + x1) / 2, fy - 0.15, -3.5); g.add(floor);
  // ceiling light panels
  const panelMat = glowMaterial('#fff1d6', 1.6, 'panel');
  for (let x = x0 + 2.5; x < x1 - 1; x += 5) { const p = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.12, 0.6, 2, 0.04), panelMat); p.position.set(x, fy + 6.15, -1.4); g.add(p); }
  // front platform: protrudes from the slice like a little stage
  const platY = fy + 1.05;
  const plat = new THREE.Mesh(new RoundedBoxGeometry(L - 1.0, platY - (fy - 1.3), 3.2, 2, 0.06), concrete);
  plat.position.set((x0 + x1) / 2, (platY + fy - 1.3) / 2, 0.2 + 1.6); plat.castShadow = plat.receiveShadow = true; g.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(L - 1.0, 0.03, 0.4), std({ color: 0xf2c418, roughness: 0.5 }, 'edge')); edge.position.set((x0 + x1) / 2, platY + 0.005, 0.55); g.add(edge);
  // pictogram sign + clock on the back wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), std({ map: pictogramTexture('end'), roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: pictogramTexture('end') }, 'esign'));
  sign.position.set(x0 + 7, fy + 5.25, -4.62); g.add(sign);
  const clock = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 40), std({ color: 0xffffff, roughness: 0.3 }, 'clockface')); face.rotation.x = Math.PI / 2; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 10, 40), std({ color: 0x222222, metalness: 0.6, roughness: 0.3 }, 'clockrim')); clock.add(rim);
  const handMat = std({ color: 0x111111, roughness: 0.4 }, 'hand');
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.03), handMat); hh.geometry.translate(0, 0.19, 0.08); clock.add(hh);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.03), handMat); mh.geometry.translate(0, 0.29, 0.1); clock.add(mh);
  clock.position.set(x1 - 7, fy + 5.25, -4.55); g.add(clock);
  // bench + plant on the platform (front)
  const benchMat = std({ color: 0x8b5a33, roughness: 0.6 }, 'bench');
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.12, 0.6, 2, 0.04), benchMat); seat.position.y = 0.55; bench.add(seat);
  const backr = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.5, 0.1, 2, 0.04), benchMat); backr.position.set(0, 0.95, -0.27); bench.add(backr);
  for (const bx of [-1.0, 1.0]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.5), std({ color: 0x333333, metalness: 0.7, roughness: 0.4 }, 'leg')); leg.position.set(bx, 0.27, 0); bench.add(leg); }
  bench.position.set(x0 + 4.5, platY, 2.3); bench.traverse((m) => { m.castShadow = true; }); g.add(bench);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.6, 16), std({ color: 0xb5643c, roughness: 0.7 }, 'pot')); pot.position.set(x1 - 3.5, platY + 0.3, 2.4); g.add(pot);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), std({ color: 0x3f7d36, roughness: 0.8 }, 'bush')); bush.position.set(x1 - 3.5, platY + 0.95, 2.4); g.add(bush);
  // a couple of lamp posts on the platform
  const postMat = std({ color: 0x2b2b30, metalness: 0.7, roughness: 0.35 }, 'post');
  const globeMat = glowMaterial('#ffe6bf', 2.2, 'globe');
  for (const px of [x0 + 1.4, x1 - 1.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 10), postMat); post.position.set(px, platY + 1.3, 2.9); post.castShadow = true; g.add(post);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), globeMat); globe.position.set(px, platY + 2.7, 2.9); g.add(globe);
  }
  g.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
  return { group: g, platY, fy, clockHands: [hh, mh] };
}

// per-frame update. st: { digMain, ringsTo, ringPop:[x,t0], trackTo, lampsOn, stripOn, steepDig, dotsT, portalPop, plugFront, rawFloorTo, speedStretch }
export function updateTunnel(S, st, t, cutMat) {
  const PX = GEO.PORTAL_X;
  // cut-face openings
  cutMat.userData.uniforms.uOpenMain.value.set(PX - 0.05, st.digMain);
  if (st.steepDig > GEO.JUNCTION_X + 0.5) cutMat.userData.uniforms.uOpenSteep.value.set(GEO.JUNCTION_X + 4, st.steepDig);
  else cutMat.userData.uniforms.uOpenSteep.value.set(-1e5, -1e5);
  const fy = S.station.fy;
  cutMat.userData.uniforms.uStation.value.set(GEO.STATION_X0 - 0.5, st.stationOpen ? GEO.STATION_X1 + 0.5 : -1e5, fy - 1.3, fy + 6.7);

  const segRange = (m, a, b) => { const g = m.geometry.userData; const x0 = g.x0, x1 = g.x0 + (m.geometry.index.count / g.perCol) * g.step; setRange(m, Math.max(a, x0), Math.min(b, x1)); if (Math.min(b, x1) <= Math.max(a, x0)) m.visible = false; };
  for (const m of S.tubes) segRange(m, PX, st.digMain);
  for (const m of S.rims) segRange(m, PX, st.digMain);
  setRange(S.dirtFloor, 6, st.digMain);
  // track pieces
  const showPiece = (p, k) => { for (const m of p.group) { m.visible = k > 0.001; m.scale.y = 1; } };
  showPiece(S.trackA, st.trackA); showPiece(S.trackB, st.trackB);
  for (const m of [S.trackB.bed, ...S.trackB.rails]) { m.visible = st.trackB > 0.001; }
  S.trackB.sleepers.visible = st.trackB > 0.001;
  S.trackB.bed.position.y = (1 - Math.min(1, st.trackB)) * 0.6; S.trackB.rails.forEach((r) => { r.position.y = (1 - Math.min(1, st.trackB)) * 0.9; });
  const C = S.trackC;
  setRange(C.bed, PX, st.trackTo); C.rails.forEach((r) => setRange(r, PX, st.trackTo));
  const nSl = C.slX.findIndex((x) => x > st.trackTo); C.sleepers.count = nSl < 0 ? C.slX.length : nSl;
  S.digFace.visible = (st.digMain > PX + 0.1 || st.plugFront > 13.2) && st.digMain < GEO.STATION_X0 - 0.5;
  const dx = Math.max(st.digMain, PX + 0.08);
  S.digFace.position.set(dx, GEO.tunnelY(dx), TUBE_Z);
  S.digFace.rotation.z = GEO.slopeAngle(GEO.tunnelY, dx);

  // rings: all rings up to ringsTo; the newest ones snap in with a bounce
  const o = new THREE.Object3D();
  let n = 0;
  for (const x of S.ringX) {
    if (x > st.ringsTo) break;
    const y = GEO.tunnelY(x), a = GEO.slopeAngle(GEO.tunnelY, x);
    let s = 1, lift = 0;
    if (st.ringPop) {
      const t0 = st.ringPop(x);
      if (t0 !== null && t0 !== undefined) {
        const p = pop(t, t0, 0.38);
        if (p <= 0.001) continue;
        s = 0.55 + 0.45 * p; lift = (1 - Math.min(1, (t - t0) / 0.18)) * 0.9;
      }
    }
    o.position.set(x, y + lift, TUBE_Z); o.rotation.set(0, 0, a); o.scale.set(1, s, s); o.updateMatrix();
    S.rings.setMatrixAt(n++, o.matrix);
  }
  S.rings.count = n; S.rings.instanceMatrix.needsUpdate = true;

  // lamps installed with the rings, switched on by the timeline
  let nl = 0;
  for (const x of S.lampX) { if (x > st.ringsTo) break; S.lamps.setMatrixAt(nl++, S.lampPos(x, st.lampStretch || 1)); }
  S.lamps.count = nl; S.lamps.instanceMatrix.needsUpdate = true;
  S.lampMat.emissiveIntensity = st.lampsOn;
  S.stripMat.emissiveIntensity = st.stripOn;
  for (const m of S.strips) { segRange(m, PX, Math.min(st.ringsTo, st.digMain)); m.visible = m.visible && st.stripOn > 0.01; }

  // steep first attempt
  const steepOn = st.steepDig > GEO.JUNCTION_X + 0.5;
  setRange(S.steepTube, GEO.JUNCTION_X, st.steepDig);
  S.steepRims.forEach((m) => setRange(m, GEO.JUNCTION_X + 6, st.steepDig));
  setRange(S.steepBed, GEO.JUNCTION_X, st.steepDig);
  S.steepRails.forEach((m) => setRange(m, GEO.JUNCTION_X, st.steepDig));
  S.steepCap.visible = steepOn && st.steepDig >= GEO.STEEP_END - 0.5;
  for (const m of [S.steepTube, S.steepBed, ...S.steepRails, ...S.steepRims]) m.visible = m.visible && steepOn;

  // guide dots: pop in one after another, then fade when the machine has passed
  let nd = 0;
  for (let i = 0; i < S.dotX.length; i++) {
    const x = S.dotX[i];
    const p = pop(t, st.dotsT + i * 0.012, 0.35);
    if (p <= 0.001 || x < st.dotsClearTo) continue;
    o.position.set(x, GEO.tunnelY(x), 0.55); o.rotation.set(0, 0, 0); o.scale.setScalar(p * (1 + 0.15 * Math.sin(t * 6 - i * 0.5)));
    o.updateMatrix(); S.dots.setMatrixAt(nd++, o.matrix);
  }
  S.dots.count = nd; S.dots.instanceMatrix.needsUpdate = true;
  S.dotMat.emissiveIntensity = 4.0 * st.dotsGlow;

  // portal + plug
  const pp = st.portalPop;
  S.portal.visible = pp > 0.001;
  S.portal.scale.set(1, Math.max(0.001, pp), Math.max(0.001, pp));
  S.portalLampMat.emissiveIntensity = st.portalLamp;
  S.plug.setFront(st.plugFront);

  // station clock hands
  const [hh, mh] = S.station.clockHands;
  hh.rotation.z = -t * 0.9 - 1.0; mh.rotation.z = -t * 10.8;
}

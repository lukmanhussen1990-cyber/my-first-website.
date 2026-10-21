// Wheel, stand, generator (cutaway), belt, gears, battery, cooling system, fishing rod + snack.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wood, brushed, copperWire, noiseTex, boltIcon, frosting } from './textures.js';
import { rng } from './util.js';

const TAU = Math.PI * 2;
export const WHEEL = { pos: new THREE.Vector3(-1.45, 1.3, -0.95), R: 1.15, depth: 0.74, slatR: 1.12, nSlats: 44 };
export const GEN = { pos0: new THREE.Vector3(0.15, 0.45, -1.0), slide: 0.53, beltZ: -0.62 };
export const BATT = { pos: new THREE.Vector3(1.25, 0, -0.35) };

function sh(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function steelMat(color = '#8f979f', rough = 0.35) {
  const b = brushed();
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, roughnessMap: b.roughnessMap, normalMap: b.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
}

// ---------------- Wheel ----------------
export function makeWheel(U) {
  const g = new THREE.Group(); g.position.copy(WHEEL.pos);
  const rot = new THREE.Group(); g.add(rot);
  const w1 = wood(4, [196, 134, 72]);
  const w2 = wood(8, [170, 108, 58]);
  const rimMat = new THREE.MeshPhysicalMaterial({ map: w1.map, normalMap: w1.normalMap, roughnessMap: w1.roughnessMap, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const slatMat = new THREE.MeshPhysicalMaterial({ map: w2.map, normalMap: w2.normalMap, roughnessMap: w2.roughnessMap, roughness: 1, vertexColors: true, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const half = WHEEL.depth / 2;
  for (const z of [-half, half]) {
    const rim = sh(new THREE.Mesh(new THREE.TorusGeometry(WHEEL.R, 0.058, 20, 160), rimMat));
    rim.position.z = z; rot.add(rim);
    const rim2 = sh(new THREE.Mesh(new THREE.TorusGeometry(WHEEL.R - 0.075, 0.03, 12, 160), rimMat));
    rim2.position.z = z; rot.add(rim2);
  }
  // slats (merged, with per-slat angle attribute for the speed-smear shader)
  const R = rng(9);
  const geos = [];
  for (let i = 0; i < WHEEL.nSlats; i++) {
    const a = (i / WHEEL.nSlats) * TAU;
    const geo = new RoundedBoxGeometry(0.1, 0.045, WHEEL.depth + 0.06, 2, 0.012);
    geo.translate(0, WHEEL.slatR, 0);
    geo.rotateZ(a - Math.PI / 2);
    const n = geo.attributes.position.count;
    const ang = new Float32Array(n).fill(a);
    const col = new Float32Array(n * 3);
    const tone = 0.82 + R() * 0.3;
    for (let k = 0; k < n; k++) { col[k * 3] = tone; col[k * 3 + 1] = tone * (0.96 + R() * 0.02); col[k * 3 + 2] = tone * 0.95; }
    geo.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // offset uv so slats don't look identical
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.3 + (i * 0.37) % 1, uv.getY(k) * 2 + i * 0.13);
    geos.push(geo);
  }
  const slatGeo = mergeGeometries(geos);
  slatMat.onBeforeCompile = (s) => {
    s.uniforms.uSmear = U.uSmear;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAng; uniform float uSmear;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float r = length(transformed.xy);
          float th = atan(transformed.y, transformed.x);
          float d = th - aAng; d = mod(d + 3.14159265, 6.2831853) - 3.14159265;
          float hw = 0.046;
          float nth = aAng - hw + (d + hw) * (2.0*hw + uSmear) / (2.0*hw);
          transformed.xy = vec2(cos(nth), sin(nth)) * r;
        }`);
  };
  const slats = sh(new THREE.Mesh(slatGeo, slatMat)); rot.add(slats);
  // back spokes + hub
  const spokeGeos = [];
  for (let i = 0; i < 8; i++) {
    const geo = new RoundedBoxGeometry(0.075, WHEEL.R - 0.16, 0.055, 2, 0.015);
    geo.translate(0, (WHEEL.R - 0.16) / 2 + 0.12, -half);
    geo.rotateZ((i / 8) * TAU);
    spokeGeos.push(geo);
  }
  rot.add(sh(new THREE.Mesh(mergeGeometries(spokeGeos), rimMat)));
  const steel = steelMat();
  const hub = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 32), steel)); hub.rotation.x = Math.PI / 2; hub.position.z = -half - 0.02; rot.add(hub);
  for (let i = 0; i < 6; i++) { const b = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), steel)); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(i) * 0.11, Math.sin(i) * 0.11, -half + 0.05); rot.add(b); }
  // hot glow on hub (scene 8)
  const hotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  const hot = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 32), hotMat); hot.position.z = -half - 0.02; rot.add(hot);
  return { group: g, rot, hotMat, rimMat, slatMat };
}

export function makeStand() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#3a4250', metalness: 0.6, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2, roughnessMap: brushed().roughnessMap });
  const steel = steelMat('#a7aeb6', 0.25);
  const p = WHEEL.pos; const zb = p.z - 0.56;
  const tube = (a, b, r = 0.045, mat = paint) => {
    const v = new THREE.Vector3().subVectors(b, a); const len = v.length();
    const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), mat));
    m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    g.add(m); return m;
  };
  const apex = new THREE.Vector3(p.x, p.y + 0.05, zb);
  const fl = new THREE.Vector3(p.x - 0.95, 0.04, zb), fr = new THREE.Vector3(p.x + 0.95, 0.04, zb);
  tube(fl, apex); tube(fr, apex);
  tube(new THREE.Vector3(p.x - 0.62, 0.48, zb), new THREE.Vector3(p.x + 0.62, 0.48, zb), 0.035);
  // ground feet running along z
  for (const x of [p.x - 0.95, p.x + 0.95]) tube(new THREE.Vector3(x, 0.035, zb - 0.4), new THREE.Vector3(x, 0.035, p.z + 0.35), 0.04);
  tube(new THREE.Vector3(p.x - 0.95, 0.04, zb - 0.38), new THREE.Vector3(p.x + 0.95, 0.04, zb - 0.38), 0.03);
  // bearing housing + axle
  const bear = sh(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.22, 3, 0.05), paint)); bear.position.copy(apex); g.add(bear);
  const axle = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 24), steel)); axle.rotation.x = Math.PI / 2; axle.position.set(p.x, p.y, zb + 0.18); g.add(axle);
  const bolts = new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 1, roughness: 0.3 });
  for (const [x, y] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), bolts); b.rotation.x = Math.PI / 2; b.position.set(apex.x + x, apex.y + y, apex.z + 0.11); g.add(b); }
  return { group: g, apex, paint, steel };
}

// ---------------- Gear geometry ----------------
export function gearGeo(r, teeth, thick, holes = 0) {
  const s = new THREE.Shape();
  const ro = r + 0.045 * (r > 0.2 ? 1 : 0.8), ri = r - 0.04;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU, step = TAU / teeth;
    const pts = [[ri, a0], [ri, a0 + step * 0.18], [ro, a0 + step * 0.32], [ro, a0 + step * 0.58], [ri, a0 + step * 0.72], [ri, a0 + step]];
    pts.forEach(([rr, a], k) => { const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, Math.max(0.03, r * 0.12), 0, TAU, true); s.holes.push(hole);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * TAU + 0.3; const hp = new THREE.Path();
    hp.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, 0, TAU, true); s.holes.push(hp);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -thick / 2);
  return geo;
}

// Rotational motion-blur ghosts for a spinning mesh about its local z.
export function spinGhosts(mesh, n = 5) {
  const ghosts = [];
  for (let i = 1; i < n; i++) {
    const m = mesh.material.clone(); m.transparent = true; m.depthWrite = false; m.opacity = 0;
    const gm = new THREE.Mesh(mesh.geometry, m); gm.position.copy(mesh.position); gm.scale.copy(mesh.scale);
    mesh.parent.add(gm); ghosts.push(gm);
  }
  return {
    update(angle, smear, axisRot = null) {
      mesh.rotation.z = angle;
      const k = Math.min(1, smear / 0.08);
      ghosts.forEach((gm, i) => {
        gm.rotation.z = angle + smear * (i + 1) / ghosts.length;
        gm.material.opacity = k * 0.55 * (1 - i / (ghosts.length + 1));
        gm.visible = k > 0.02 && mesh.visible;
        gm.scale.copy(mesh.scale); gm.position.copy(mesh.position);
      });
    },
  };
}

// ---------------- Generator (cutaway) ----------------
export function makeGenerator() {
  const g = new THREE.Group(); g.position.copy(GEN.pos0);
  const parts = {};
  const paint = new THREE.MeshPhysicalMaterial({ color: '#2f8f6a', metalness: 0.3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const cutEdge = new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 0.9, roughness: 0.3 });
  const steel = steelMat('#9aa2aa', 0.3);
  const iron = new THREE.MeshStandardMaterial({ color: '#3d4148', metalness: 0.8, roughness: 0.5 });
  const cw = copperWire();
  const copper = new THREE.MeshPhysicalMaterial({ map: cw.map, normalMap: cw.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), metalness: 1, roughness: 0.34, color: '#d8d0cc', clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const L = 0.5, Rr = 0.3;
  // base (sits on ground: generator center at y=0.45)
  parts.base = new THREE.Group(); g.add(parts.base);
  parts.base.add(sh(new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.08, 0.68, 3, 0.02), steelMat('#5b636c', 0.4))));
  parts.base.children[0].position.set(0, -0.41, 0);
  for (const s of [-1, 1]) { const c = sh(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.16, 0.08, 2, 0.02), paint)); c.position.set(0, -0.3, s * 0.18); parts.base.add(c); }
  // housing: cylinder along z with a 100° wedge removed (front-top) + open front
  parts.housing = new THREE.Group(); g.add(parts.housing);
  const cut0 = Math.PI * 0.32, cutL = Math.PI * 0.62;
  const outer = new THREE.CylinderGeometry(Rr, Rr, L, 64, 1, true, cut0 + cutL, TAU - cutL);
  outer.rotateX(Math.PI / 2);
  const shell = sh(new THREE.Mesh(outer, paint)); parts.housing.add(shell);
  const innerG = new THREE.CylinderGeometry(Rr - 0.025, Rr - 0.025, L, 64, 1, true, cut0 + cutL, TAU - cutL); innerG.rotateX(Math.PI / 2);
  const innerM = new THREE.Mesh(innerG, new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.6, side: THREE.BackSide })); parts.housing.add(innerM);
  // back cap
  const cap = sh(new THREE.Mesh(new THREE.CircleGeometry(Rr, 48), paint)); cap.position.z = -L / 2; cap.rotation.y = Math.PI; parts.housing.add(cap);
  // front ring lip (cut edge)
  const lip = sh(new THREE.Mesh(new THREE.RingGeometry(Rr - 0.03, Rr + 0.004, 64, 1, cut0 + cutL - Math.PI / 2 + Math.PI / 2, TAU - cutL), cutEdge)); lip.position.z = L / 2; parts.housing.add(lip);
  // cut edges along the wedge
  for (const a of [cut0, cut0 + cutL]) {
    const e = sh(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, L), cutEdge));
    const aa = a + Math.PI / 2; // cylinder theta 0 is +z before rotate -> map
    e.position.set(Math.sin(a) * (Rr - 0.012), Math.cos(a) * (Rr - 0.012), 0);
    parts.housing.add(e);
  }
  // cooling fins on outside
  for (let i = 0; i < 6; i++) {
    const f = sh(new THREE.Mesh(new THREE.TorusGeometry(Rr + 0.012, 0.012, 6, 64, TAU - cutL), paint));
    f.rotation.z = cut0 + cutL + Math.PI / 2; f.position.z = -L / 2 + 0.06 + i * 0.075; parts.housing.add(f);
  }
  // terminal box
  const tb = sh(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.18, 2, 0.02), paint)); tb.position.set(Rr * 0.85, -0.12, -0.05); parts.housing.add(tb);
  parts.terminal = new THREE.Vector3(Rr * 0.85 + 0.08, -0.14, -0.05);
  // stator ring + coils
  parts.coil = new THREE.Group(); g.add(parts.coil);
  const ring = sh(new THREE.Mesh(new THREE.CylinderGeometry(Rr - 0.03, Rr - 0.03, L - 0.04, 48, 1, true), iron)); ring.rotation.x = Math.PI / 2; ring.material.side = THREE.DoubleSide; parts.coil.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const pole = sh(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, L - 0.08), iron));
    const c = new THREE.Group(); c.rotation.z = a; parts.coil.add(c);
    pole.position.set(0, Rr - 0.075, 0); c.add(pole);
    // winding: rounded-rectangle loop tube around the pole
    const pts = [];
    const hw = 0.06, hl = (L - 0.1) / 2;
    for (let k = 0; k <= 40; k++) {
      const t = (k / 40) * TAU;
      const x = Math.sign(Math.cos(t)) * Math.min(1, Math.abs(Math.cos(t)) * 1.6) * hw;
      const z = Math.sign(Math.sin(t)) * Math.min(1, Math.abs(Math.sin(t)) * 1.3) * hl;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    const path = new THREE.CatmullRomCurve3(pts, true);
    for (let layer = 0; layer < 3; layer++) {
      const tg = new THREE.TubeGeometry(path, 80, 0.022, 10, true);
      const wnd = sh(new THREE.Mesh(tg, copper));
      wnd.position.set(0, Rr - 0.085 - layer * 0.0, 0); wnd.scale.set(1 + layer * 0.35, 1, 1 + layer * 0.05);
      wnd.position.y = Rr - 0.07 - layer * 0.03;
      c.add(wnd);
    }
  }
  // rotor: shaft + bar magnet
  parts.rotor = new THREE.Group(); g.add(parts.rotor);
  const shaft = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L + 0.36, 20), steel)); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.12; parts.rotor.add(shaft);
  const magC = document.createElement('canvas'); magC.width = 256; magC.height = 64; const mg = magC.getContext('2d');
  mg.fillStyle = '#d63a2f'; mg.fillRect(0, 0, 128, 64); mg.fillStyle = '#2f5fd6'; mg.fillRect(128, 0, 128, 64);
  mg.fillStyle = '#fff'; mg.font = 'bold 44px sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('N', 64, 34); mg.fillText('S', 192, 34);
  const magT = new THREE.CanvasTexture(magC); magT.colorSpace = THREE.SRGBColorSpace;
  const magMat = new THREE.MeshPhysicalMaterial({ map: magT, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const magGeo = new RoundedBoxGeometry(0.35, 0.13, L - 0.1, 3, 0.025);
  // map uv on front faces: use simple planar uv from x
  const pa = magGeo.attributes.position, uv = magGeo.attributes.uv;
  for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 0.35 + 0.5, pa.getY(i) / 0.13 + 0.5);
  const magnet = sh(new THREE.Mesh(magGeo, magMat)); parts.rotor.add(magnet); parts.magnet = magnet;
  parts.magnetGhosts = spinGhosts(magnet, 6);
  // pulley (jackshaft end) – separate object, stays at pos0 even when the generator slides
  const pulley = new THREE.Group(); pulley.position.set(GEN.pos0.x, GEN.pos0.y, GEN.beltZ);
  const pg = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 40), steel)); pg.rotation.x = Math.PI / 2; pulley.add(pg);
  for (const s of [-1, 1]) { const f = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 40), steel)); f.rotation.x = Math.PI / 2; f.position.z = s * 0.04; pulley.add(f); }
  const spokes = sh(new THREE.Mesh(gearGeo(0.05, 3, 0.075, 0), new THREE.MeshStandardMaterial({ color: '#d33', roughness: 0.4 })));
  pulley.add(spokes); parts.pulleySpokes = spokes;
  const jshaft = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 16), steel)); jshaft.rotation.x = Math.PI / 2; jshaft.position.z = -0.2; pulley.add(jshaft);
  return { group: g, parts, pulley, mats: { paint, copper, magMat } };
}

// big + small gears and a support stand for the jackshaft
export function makeGears() {
  const brass = new THREE.MeshPhysicalMaterial({ color: '#e0b24e', metalness: 0.85, roughness: 0.3, emissive: new THREE.Color('#3a2608'), clearcoat: 0.5, clearcoatRoughness: 0.2, roughnessMap: brushed().roughnessMap });
  const steel = steelMat('#b8c0c8', 0.25);
  const big = sh(new THREE.Mesh(gearGeo(0.4, 30, 0.06, 5), brass));
  const small = sh(new THREE.Mesh(gearGeo(0.13, 10, 0.07, 0), steel));
  const bigG = new THREE.Group(); bigG.position.set(GEN.pos0.x, GEN.pos0.y, GEN.beltZ + 0.075); bigG.add(big);
  const smallG = new THREE.Group(); smallG.add(small);
  const stand = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#c0392b', roughness: 0.4, clearcoat: 0.6 });
  const post = sh(new THREE.Mesh(new RoundedBoxGeometry(0.1, GEN.pos0.y, 0.1, 2, 0.02), paint)); post.position.set(0, GEN.pos0.y / 2, 0); stand.add(post);
  const blk = sh(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.12, 2, 0.03), paint)); blk.position.set(0, GEN.pos0.y, 0); stand.add(blk);
  const foot = sh(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.04, 0.24, 2, 0.01), paint)); foot.position.set(0, 0.02, 0); stand.add(foot);
  stand.position.set(GEN.pos0.x, 0, GEN.beltZ - 0.2);
  return { bigG, smallG, big, small, stand, bigGhosts: null, smallGhosts: null };
}

// open belt between wheel rim (circle 1) and pulley (circle 2) in the plane z = beltZ
export function beltPath(c1, r1, c2, r2) {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  const base = Math.atan2(c2.y - c1.y, c2.x - c1.x);
  const phi = Math.acos((r1 - r2) / d);
  const a1 = base + phi, a2 = base - phi;
  const out = [];
  const P = (c, r, a) => new THREE.Vector3(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0);
  const seg = (p, q, n) => { for (let i = 0; i < n; i++) out.push(p.clone().lerp(q, i / n)); };
  const arcTo = (c, r, from, to, n) => { for (let i = 0; i < n; i++) out.push(P(c, r, from + (to - from) * i / n)); };
  seg(P(c1, r1, a1), P(c2, r2, a1), 30);
  arcTo(c2, r2, a1, a2, 24);
  seg(P(c2, r2, a2), P(c1, r1, a2), 30);
  arcTo(c1, r1, a2, a1 - TAU, 120);
  return { pts: out, len: (2 * Math.sqrt(d * d - (r1 - r2) ** 2)) + r2 * (a1 - a2) + r1 * (TAU - (a1 - a2)) };
}

export function makeBelt(beltZ) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const gg = c.getContext('2d');
  gg.fillStyle = '#1a1b1e'; gg.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 32) { gg.fillStyle = '#3a3c42'; gg.fillRect(0, y, 64, 10); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  const mesh = sh(new THREE.Mesh(new THREE.BufferGeometry(), mat));
  mesh.position.z = beltZ;
  return { mesh, tex: t, mat };
}
// Build a flat ribbon geometry (width along z) from 2D loop points; reveal fraction p
export function ribbonGeo(pts, width, thick, closed = true) {
  const pos = [], uv = [], idx = [];
  const n = pts.length; let acc = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n], o = pts[(i - 1 + n) % n];
    const tx = q.x - o.x, ty = q.y - o.y; const l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l; // outward-ish normal
    if (i > 0) acc += pts[i % n].distanceTo(pts[(i - 1) % n]);
    for (const [s, z] of [[0, -width / 2], [0, width / 2], [1, width / 2], [1, -width / 2]]) {
      pos.push(p.x + nx * thick * s, p.y + ny * thick * s, z); uv.push(z > 0 ? 1 : 0, acc * 3);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4, b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// ---------------- Battery ----------------
export function makeBattery() {
  const g = new THREE.Group(); g.position.copy(BATT.pos);
  const body = new THREE.MeshPhysicalMaterial({ color: '#1f2b45', roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15 });
  const frame = steelMat('#c9cfd6', 0.22);
  const w = 0.55, h = 0.86, d = 0.46;
  const parts = {};
  parts.body = new THREE.Group(); g.add(parts.body);
  parts.body.add(sh(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.06), body)));
  parts.body.children[0].position.y = h / 2;
  for (const y of [0.04, h - 0.04]) { const f = sh(new THREE.Mesh(new RoundedBoxGeometry(w + 0.03, 0.06, d + 0.03, 3, 0.025), frame)); f.position.y = y; parts.body.add(f); }
  // window with energy column
  const win = new THREE.Group(); win.position.set(-0.07, 0.42, d / 2 + 0.002); parts.body.add(win);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.54), new THREE.MeshStandardMaterial({ color: '#0a0f1a', roughness: 0.5 })); win.add(back);
  const energyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 1.3, 0.9) });
  const energy = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.52), energyMat); energy.position.z = 0.003; win.add(energy);
  const surfMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 1.7) });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.012), surfMat); surf.position.z = 0.004; win.add(surf);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.56), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false })); glass.position.z = 0.012; win.add(glass);
  const bezel = sh(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 4), frame)); bezel.rotation.z = Math.PI / 4; bezel.scale.set(0.78, 1.38, 1); bezel.position.z = 0.01; win.add(bezel);
  // meter bars
  const bars = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.05) });
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.075, 0.02, 2, 0.01), m);
    b.position.set(0.17, 0.2 + i * 0.1, d / 2 + 0.005); parts.body.add(b); bars.push(m);
  }
  // bolt icon
  const bolt = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: boltIcon(), transparent: true, color: new THREE.Color(1, 1, 1) }));
  bolt.position.set(0, h - 0.14, d / 2 + 0.004); parts.body.add(bolt);
  // terminals
  parts.top = new THREE.Group(); g.add(parts.top);
  for (const [x, col] of [[-0.14, '#d32f2f'], [0.14, '#222']]) {
    const tm = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 20), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 1 })));
    tm.position.set(x, h + 0.035, 0); parts.top.add(tm);
    const cap = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), frame)); cap.position.set(x, h + 0.08, 0); parts.top.add(cap);
  }
  const handle = sh(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI), frame)); handle.position.set(0, h + 0.0, 0); parts.top.add(handle);
  const glowLight = { intensity: 0 };
  return { group: g, parts, energy, surf, energyMat, surfMat, bars, bolt, glowLight, h };
}

// ---------------- Cooling system ----------------
export function makeCooling() {
  const g = new THREE.Group();
  const p = WHEEL.pos; const zb = p.z - 0.56;
  const parts = {};
  const blue = new THREE.MeshPhysicalMaterial({ color: '#1e88e5', roughness: 0.2, clearcoat: 1, transmission: 0, transparent: true, opacity: 0.75 });
  const water = new THREE.MeshPhysicalMaterial({ color: '#4fc3f7', roughness: 0.1, emissive: new THREE.Color('#0a3a5a'), clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe5ea', metalness: 1, roughness: 0.12 });
  const copperP = new THREE.MeshStandardMaterial({ color: '#d98b5a', metalness: 1, roughness: 0.25 });
  // tank
  parts.tank = new THREE.Group(); parts.tank.position.set(p.x - 1.3, 0, zb - 0.25); g.add(parts.tank);
  const tw = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 32), blue)); tw.position.y = 0.25; parts.tank.add(tw);
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.38, 32), water); tin.position.y = 0.2; parts.tank.add(tin);
  for (const y of [0.01, 0.5]) { const r = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 32), chrome)); r.position.y = y; parts.tank.add(r); }
  // pump
  parts.pump = new THREE.Group(); parts.pump.position.set(p.x - 0.85, 0, zb - 0.4); g.add(parts.pump);
  const pb = sh(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.22, 3, 0.04), new THREE.MeshPhysicalMaterial({ color: '#f9a825', roughness: 0.35, clearcoat: 0.8 }))); pb.position.y = 0.1; parts.pump.add(pb);
  const fan = sh(new THREE.Mesh(gearGeo(0.07, 5, 0.02, 0), chrome)); fan.position.set(0, 0.12, 0.12); parts.pump.add(fan); parts.pumpFan = fan;
  // radiator on the left
  parts.rad = new THREE.Group(); parts.rad.position.set(p.x - 1.38, 0.0, p.z - 0.15); g.add(parts.rad);
  const rframe = new THREE.MeshStandardMaterial({ color: '#2b2f36', metalness: 0.7, roughness: 0.4 });
  const rf = sh(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.7, 0.55, 2, 0.02), rframe)); rf.position.y = 0.75; parts.rad.add(rf);
  for (let i = 0; i < 18; i++) { const fin = sh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.006), chrome)); fin.position.set(0.0, 0.75, -0.24 + i * 0.028); parts.rad.add(fin); }
  for (const z of [-0.2, 0.2]) { const l = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), rframe)); l.position.set(0, 0.2, z); parts.rad.add(l); }
  const rfan = sh(new THREE.Mesh(gearGeo(0.16, 4, 0.02, 0), new THREE.MeshStandardMaterial({ color: '#e0e0e0', metalness: 0.5, roughness: 0.3 })));
  rfan.position.set(0.08, 0.75, 0); rfan.rotation.y = Math.PI / 2; parts.rad.add(rfan); parts.radFan = rfan;
  // pipes (grow-in)
  const pipePaths = [
    [[p.x - 0.85, 0.12, zb - 0.4], [p.x - 0.7, 0.15, zb - 0.15], [p.x - 0.5, 0.6, zb + 0.02], [p.x - 0.2, 1.15, zb + 0.06], [p.x - 0.05, 1.3, zb + 0.13]],
    [[p.x - 1.3, 0.45, zb - 0.25], [p.x - 1.35, 0.55, p.z - 0.42], [p.x - 1.38, 0.6, p.z - 0.27]],
    [[p.x - 1.33, 1.05, p.z - 0.15], [p.x - 0.9, 1.45, zb], [p.x - 0.35, 1.45, zb + 0.08], [p.x - 0.12, 1.36, zb + 0.13]],
    [[p.x - 1.3, 0.12, zb - 0.25], [p.x - 1.1, 0.06, zb - 0.35], [p.x - 0.95, 0.1, zb - 0.4]],
  ];

  parts.pipes = pipePaths.map((pp, i) => {
    const curve = new THREE.CatmullRomCurve3(pp.map((q) => new THREE.Vector3(...q)));
    const geo = new THREE.TubeGeometry(curve, 64, 0.03, 12, false);
    const m = sh(new THREE.Mesh(geo, i % 2 ? chrome : copperP)); g.add(m);
    return { mesh: m, count: geo.index.count };
  });
  // water jacket around axle + nozzles
  parts.jacket = sh(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 12, 32), chrome)); parts.jacket.position.set(p.x, p.y, zb + 0.15); g.add(parts.jacket);
  parts.nozzles = [];
  for (const [dx, dy] of [[0.18, 0.2], [-0.2, 0.18]]) {
    const n = sh(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 12), chrome));
    n.position.set(p.x + dx, p.y + dy, zb + 0.24); n.rotation.x = Math.PI / 2; g.add(n); parts.nozzles.push(n);
  }
  return { group: g, parts };
}

// ---------------- Fishing rod + snack ----------------
export function makeRod() {
  const g = new THREE.Group();
  const p = WHEEL.pos;
  const parts = {};
  const paint = new THREE.MeshPhysicalMaterial({ color: '#3a4250', metalness: 0.6, roughness: 0.38, clearcoat: 0.6 });
  const base = new THREE.Vector3(p.x + 1.42, 0, p.z + 0.82);
  parts.pole = new THREE.Group(); parts.pole.position.copy(base); g.add(parts.pole);
  const pole = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.45, 12), paint)); pole.position.set(0, 1.225, 0); parts.pole.add(pole);
  const foot = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 20), paint)); foot.position.set(0, 0.025, 0); parts.pole.add(foot);
  const clamp = sh(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 0.12, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#f9a825', roughness: 0.4 }))); clamp.position.set(0, 2.4, 0); parts.pole.add(clamp);
  // rod: tapered tube from the clamp, arcing left into the wheel's open front
  const tip = new THREE.Vector3(p.x + 0.6, p.y + 0.66, p.z + 0.27);
  const c0 = base.clone().add(new THREE.Vector3(0.12, 2.36, 0.08));
  const curve = new THREE.CatmullRomCurve3([
    c0, base.clone().add(new THREE.Vector3(0, 2.42, 0)),
    new THREE.Vector3(p.x + 1.0, p.y + 0.97, p.z + 0.72), new THREE.Vector3(p.x + 0.72, p.y + 0.72, p.z + 0.46), tip,
  ]);
  const segs = 80, radial = 10;
  const tg = new THREE.TubeGeometry(curve, segs, 0.022, radial, false);
  const pa = tg.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs); const sc = 1 - (i / segs) * 0.7;
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; const v = new THREE.Vector3(pa.getX(k), pa.getY(k), pa.getZ(k)).sub(c).multiplyScalar(sc).add(c); pa.setXYZ(k, v.x, v.y, v.z); }
  }
  tg.computeVertexNormals();
  parts.rod = new THREE.Group(); g.add(parts.rod);
  parts.rod.add(sh(new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: '#1d4fa0', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }))));
  const cork = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 14), new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.9 })));
  cork.position.copy(curve.getPointAt(0.04)); cork.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(0.04)); parts.rod.add(cork);
  const reel = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#cfd5db', metalness: 1, roughness: 0.25 })));
  reel.position.copy(curve.getPointAt(0.1)).add(new THREE.Vector3(0, -0.07, 0)); reel.rotation.z = Math.PI / 2; parts.rod.add(reel);
  parts.tip = tip;
  // line + donut
  parts.dangle = new THREE.Group(); parts.dangle.position.copy(tip); g.add(parts.dangle);
  const lineLen = 0.5;
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, lineLen, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.95) }));
  line.position.y = -lineLen / 2; parts.dangle.add(line); parts.line = line; parts.lineLen = lineLen;
  const donut = new THREE.Group(); donut.position.y = -lineLen - 0.07; parts.dangle.add(donut); parts.donut = donut;
  const dough = sh(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.038, 20, 40), new THREE.MeshStandardMaterial({ color: '#d79a55', roughness: 0.7 })));
  donut.add(dough);
  const fr = sh(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.041, 20, 40, TAU), new THREE.MeshPhysicalMaterial({ map: frosting(), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
  fr.scale.set(1.02, 1.02, 0.75); fr.position.z = 0.012; donut.add(fr);
  const R = rng(17); const cols = ['#ffeb3b', '#4fc3f7', '#ffffff', '#81c784', '#ff7043', '#ba68c8'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  for (let i = 0; i < 30; i++) {
    const a = R() * TAU, rr = 0.075 + (R() - 0.5) * 0.05;
    const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.012, 3, 6), cols[i % cols.length]);
    s2.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.052); s2.rotation.set(R() * 3, R() * 3, R() * 3); donut.add(s2);
  }
  return { group: g, parts };
}

// The suburban backyard: striped mowed lawn, stepping stones, grass tufts, white picket fence,
// round trees, red-roof houses in the distance, hills, puffy clouds, OUR two-story beige house with
// blue shutters and a red roof, and the little wooden garden shed (it becomes the haunted house).
import * as THREE from 'three';
import { clay, glow, PAL } from '../../../engine/toon/materials.js';
import { roundedBox, blob, cyl, cone, sphere, mergeMeshes } from '../../../engine/toon/geom.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../../engine/toon/anim.js';
import { add, group, canvasTex, instanced } from './common.js';

export const LAYOUT = {
  shed: { pos: [2.6, 0, -4.2], rotY: -0.32 },
  house: { pos: [-2.2, 0, -17.5], rotY: -Math.PI / 2 },     // gable end (attic window, back door) faces the yard
  mansion: { pos: [9.0, 0, -20.0], rotY: -0.2 },
  mainCam: { pos: [-0.7, 1.4, 4.6], target: [1.2, 2.25, -6.0], fov: 64 },
};

// ---- lawn ---------------------------------------------------------------------------------------
function lawnMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cLight = { value: new THREE.Color(PAL.lawnLight) };
    sh.uniforms.cDark = { value: new THREE.Color(PAL.lawnDark) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform vec3 cLight; uniform vec3 cDark;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float sw = 2.4;
        float s = fract((vWP.x + 0.6) / sw);
        float band = smoothstep(0.47, 0.53, s) - smoothstep(0.97, 1.0, s);
        vec3 col = mix(cLight, cDark, band);
        float n = vnoise(vWP.xz * 0.35) * 0.6 + vnoise(vWP.xz * 1.7) * 0.4;
        col *= 0.93 + 0.12 * n;
        diffuseColor.rgb = col;
      }`);
  };
  return m;
}

function tuftGeometry() {
  const blades = [];
  const rnd = mulberry32(5);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ConeGeometry(0.016, 0.13 + rnd() * 0.08, 4);
    g.translate(0, 0.07, 0);
    g.rotateZ((rnd() - 0.5) * 0.7); g.rotateX((rnd() - 0.5) * 0.7);
    g.translate((rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.06);
    blades.push(g);
  }
  return mergeGeometries(blades);
}

// ---- trees ----------------------------------------------------------------------------------------
const TREE_GREENS = ['#5d9e3f', '#4f8f37', '#6aae46', '#58a142'];
export function makeTree(seed = 1, h = 3.2) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  add(g, cyl(0.12, 0.17, h * 0.45, 8), clay('#7a5233'), [0, h * 0.22, 0]);
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = h * (0.24 + rnd() * 0.1);
    // soft lumpy clay balls (no hard facets)
    const geo = blob(Math.round(r * 100) / 100, 3, 0.07, seed * 10 + i);
    const mat = clay(TREE_GREENS[(seed + i) % TREE_GREENS.length], { roughness: 0.85 });
    add(g, geo, mat, [(rnd() - 0.5) * h * 0.35, h * (0.55 + rnd() * 0.3), (rnd() - 0.5) * h * 0.35], [rnd() * 3, rnd() * 3, 0]);
  }
  return g;
}
export function makeBush(seed = 1, r = 0.5) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  for (let i = 0; i < 3; i++) add(g, blob(Math.round(r * (0.6 + rnd() * 0.4) * 100) / 100, 3, 0.08, seed * 7 + i), clay(TREE_GREENS[(seed + i) % 4]),
    [(rnd() - 0.5) * r * 1.2, r * 0.5, (rnd() - 0.5) * r]);
  return g;
}

// ---- houses -------------------------------------------------------------------------------------
function gableRoofGeo(w, d, h, over = 0.35) {
  // a triangular prism along X with overhang, thickness via extrude
  const s = new THREE.Shape();
  s.moveTo(-d / 2 - over, 0); s.lineTo(0, h); s.lineTo(d / 2 + over, 0); s.lineTo(d / 2 + over - 0.25, 0); s.lineTo(0, h - 0.3); s.lineTo(-d / 2 - over + 0.25, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w + over * 2, bevelEnabled: false });
  g.translate(0, 0, -(w + over * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
function gableFillGeo(d, h) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }); g.translate(0, 0, -0.1);
  return g;
}

// window with frame, glass and shutters; `glassMat` lets night scenes light the windows up
function windowUnit(parent, pos, rotY, { w = 0.9, h = 1.15, shutters = true, glassMat, frame = '#fbfaf5', shutter = PAL.shutterBlue } = {}) {
  const g = group(parent, pos, [0, rotY, 0]);
  add(g, roundedBox(w + 0.16, h + 0.16, 0.08, 0.02), clay(frame), [0, 0, 0.0]);
  add(g, roundedBox(w, h, 0.06, 0.01), glassMat || clay('#7fa3d6', { roughness: 0.25 }), [0, 0, 0.03], [0, 0, 0], 1, { shadow: false });
  add(g, roundedBox(w, 0.05, 0.05, 0.01), clay(frame), [0, 0, 0.06]);
  add(g, roundedBox(0.05, h, 0.05, 0.01), clay(frame), [0, 0, 0.06]);
  add(g, roundedBox(w + 0.3, 0.07, 0.16, 0.02), clay(frame), [0, -h / 2 - 0.1, 0.06]);
  if (shutters) for (const s of [-1, 1]) {
    const sh = add(g, roundedBox(w * 0.42, h + 0.1, 0.05, 0.015), clay(shutter), [s * (w / 2 + w * 0.26), 0, 0.02]);
    for (let k = -2; k <= 2; k++) add(g, roundedBox(w * 0.36, 0.025, 0.02, 0.008), clay(new THREE.Color(shutter).multiplyScalar(0.8).getStyle()), [s * (w / 2 + w * 0.26), k * h * 0.17, 0.05]);
  }
  return g;
}

export function makeOurHouse(nightGlass) {
  const g = new THREE.Group(); g.name = 'ourHouse';
  const W = 9, D = 7, H = 5.8, RH = 2.6;
  const beige = clay(PAL.houseBeige), trim = clay('#fbfaf5'), roof = clay(PAL.roofRed, { roughness: 0.8 });
  add(g, roundedBox(W + 0.3, 0.4, D + 0.3, 0.05), clay('#b8b2a6'), [0, 0.2, 0]);               // foundation
  add(g, roundedBox(W, H, D, 0.06), beige, [0, 0.4 + H / 2, 0]);
  add(g, roundedBox(W + 0.06, 0.16, D + 0.06, 0.03), trim, [0, 0.4 + H * 0.5, 0]);                 // floor band
  // roof along X (gables at the ±X ends)
  const r = add(g, gableRoofGeo(W, D, RH), roof, [0, 0.4 + H, 0]);
  r.rotation.y = 0;
  for (const s of [-1, 1]) {
    const gf = add(g, gableFillGeo(D, RH - 0.2), beige, [s * (W / 2 - 0.1), 0.4 + H, 0]);
    gf.rotation.y = Math.PI / 2;
  }
  // roof shingle lines (strips)
  for (let k = 1; k < 6; k++) {
    for (const s of [-1, 1]) {
      const y = 0.4 + H + (k / 6) * RH, z = s * (D / 2 + 0.35) * (1 - k / 6);
      add(g, roundedBox(W + 0.7, 0.05, 0.06, 0.02), clay('#bf4a30'), [0, y + 0.02, z + s * 0.02], [s * -0.62, 0, 0], 1, { shadow: false });
    }
  }
  add(g, roundedBox(0.8, 2.2, 0.8, 0.05), clay('#a85b45'), [W * 0.28, 0.4 + H + RH * 0.75, -D * 0.18]);   // chimney
  add(g, roundedBox(0.95, 0.15, 0.95, 0.03), clay('#8d4a38'), [W * 0.28, 0.4 + H + RH * 0.75 + 1.1, -D * 0.18]);
  // windows on the long +Z wall (the back of the house, facing the yard) and the +X gable end
  const glass = nightGlass || clay('#7fa3d6', { roughness: 0.25 });
  for (const x of [-2.8, 0, 2.8]) {
    windowUnit(g, [x, 0.4 + H * 0.28, D / 2 + 0.03], 0, { glassMat: glass });
    windowUnit(g, [x, 0.4 + H * 0.76, D / 2 + 0.03], 0, { glassMat: glass });
  }
  windowUnit(g, [W / 2 + 0.03, 0.4 + H * 0.76, -1.4], Math.PI / 2, { glassMat: glass });
  windowUnit(g, [W / 2 + 0.03, 0.4 + H * 0.76, 1.4], Math.PI / 2, { glassMat: glass });
  windowUnit(g, [W / 2 + 0.03, 0.4 + H * 0.28, -1.4], Math.PI / 2, { glassMat: glass });
  // round attic window in the +X gable (the hidden ghost peeks here in beat 1)
  const attic = group(g, [W / 2 + 0.06, 0.4 + H + 1.0, 0], [0, Math.PI / 2, 0], 'atticWindow');
  add(attic, new THREE.TorusGeometry(0.42, 0.07, 10, 32), trim, [0, 0, 0.04]);
  const atticGlass = add(attic, new THREE.CircleGeometry(0.42, 32), clay('#2c3550', { roughness: 0.3 }), [0, 0, 0.01], [0, 0, 0], 1, { shadow: false, name: 'atticGlass' });
  add(attic, roundedBox(0.84, 0.04, 0.04, 0.01), trim, [0, 0, 0.06]);
  add(attic, roundedBox(0.04, 0.84, 0.04, 0.01), trim, [0, 0, 0.06]);
  g.userData.atticWindow = attic;
  // back door + porch steps on the +X end
  const door = group(g, [W / 2 + 0.03, 0.4, 2.4], [0, Math.PI / 2, 0]);
  add(door, roundedBox(1.1, 2.15, 0.08, 0.03), clay('#3f6fae'), [0, 1.08, 0]);
  add(door, roundedBox(1.3, 2.3, 0.05, 0.03), trim, [0, 1.12, -0.02]);
  add(door, sphere(0.05, 12, 10), clay('#e3c35a', { roughness: 0.3 }), [0.4, 1.05, 0.07]);
  add(g, roundedBox(1.2, 0.2, 1.6, 0.04), clay('#c9c3b6'), [W / 2 + 0.6, 0.1, 2.4]);
  add(g, roundedBox(1.0, 0.2, 1.6, 0.04), clay('#c9c3b6'), [W / 2 + 1.1, 0.1 - 0.1, 2.4], [0, 0, 0], [1, 0.5, 1]);
  // bushes along the wall
  for (let k = 0; k < 4; k++) { const b = makeBush(70 + k, 0.55); b.position.set(-3.3 + k * 2.2, 0, D / 2 + 0.7); g.add(b); }
  return g;
}

export function makeNeighborHouse(seed) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const W = 6 + rnd() * 3, D = 6 + rnd() * 2, H = 4 + rnd() * 2.2, RH = 2 + rnd() * 1.2;
  const wall = clay(['#f4f1ea', '#f1ebe0', '#eef0f2', '#f5efe3'][seed % 4]);
  const roof = clay(['#d9573b', '#e06a45', '#c94f35', '#d86a3c'][seed % 4]);
  add(g, roundedBox(W, H, D, 0.05), wall, [0, H / 2, 0]);
  add(g, gableRoofGeo(W, D, RH, 0.3), roof, [0, H, 0]);
  for (const s of [-1, 1]) { const gf = add(g, gableFillGeo(D, RH - 0.2), wall, [s * (W / 2 - 0.1), H, 0]); gf.rotation.y = Math.PI / 2; }
  const glass = clay('#5f86c4', { roughness: 0.3 });
  const nx = Math.max(2, Math.floor(W / 2.2));
  for (let i = 0; i < nx; i++) {
    const x = -W / 2 + (i + 0.5) * (W / nx);
    for (const y of H > 5 ? [H * 0.3, H * 0.72] : [H * 0.45]) {
      add(g, roundedBox(0.75, 0.95, 0.06, 0.01), glass, [x, y, D / 2 + 0.02], [0, 0, 0], 1, { shadow: false });
      for (const s of [-1, 1]) add(g, roundedBox(0.3, 1.0, 0.05, 0.01), clay('#4a74b8'), [x + s * 0.55, y, D / 2 + 0.02], [0, 0, 0], 1, { shadow: false });
    }
  }
  if (rnd() > 0.3) add(g, roundedBox(0.6, 1.6, 0.6, 0.04), clay('#b0624a'), [W * 0.25, H + RH * 0.7, 0]);
  return g;
}

// ---- the garden shed ----------------------------------------------------------------------------
function plankTexture(base = '#b5865a') {
  return canvasTex(512, 512, (c, w, h) => {
    const rnd = mulberry32(9);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const col = new THREE.Color(base).offsetHSL(0, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.08);
      c.fillStyle = col.getStyle(); c.fillRect(i * w / n, 0, w / n, h);
      c.fillStyle = 'rgba(60,35,20,0.6)'; c.fillRect(i * w / n, 0, 5, h);
      c.fillStyle = 'rgba(255,240,220,0.12)'; c.fillRect(i * w / n + 6, 0, 3, h);
      // knots
      c.fillStyle = 'rgba(90,55,30,0.35)';
      for (let k = 0; k < 2; k++) { c.beginPath(); c.ellipse(i * w / n + 10 + rnd() * (w / n - 20), rnd() * h, 6, 10, 0, 0, 7); c.fill(); }
    }
  });
}

export function makeShed() {
  const g = new THREE.Group(); g.name = 'shed';
  const W = 2.6, D = 2.2, H = 2.15;
  const wallTex = plankTexture('#b98a5c');
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 });
  const trim = clay('#f1e6d2'), roofMat = clay('#5d4a6e', { roughness: 0.75 });
  // walls (open front gap for the door)
  add(g, new THREE.BoxGeometry(W, H, 0.1), wall, [0, H / 2, -D / 2]);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.1, H, D), wall, [s * W / 2, H / 2, 0]);
  const front = group(g, [0, 0, D / 2]);
  add(front, new THREE.BoxGeometry((W - 1.0) / 2, H, 0.1), wall, [-(W + 1.0) / 4, H / 2, 0]);
  add(front, new THREE.BoxGeometry((W - 1.0) / 2, H, 0.1), wall, [(W + 1.0) / 4, H / 2, 0]);
  add(front, new THREE.BoxGeometry(1.0, H - 1.85, 0.1), wall, [0, 1.85 + (H - 1.85) / 2, 0]);
  // corner trims
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, roundedBox(0.12, H, 0.12, 0.02), trim, [sx * W / 2, H / 2, sz * D / 2]);
  // gable roof (ridge along Z, gables front/back)
  const RH = 1.0;
  const roofG = new THREE.Group(); roofG.position.y = H; g.add(roofG);
  const slope = Math.atan2(RH, W / 2 + 0.25), len = Math.hypot(W / 2 + 0.25, RH) + 0.05;
  for (const s of [-1, 1]) add(roofG, roundedBox(len, 0.1, D + 0.5, 0.03), roofMat, [s * (W / 4 + 0.06), RH / 2, 0], [0, 0, -s * slope]);
  for (const s of [-1, 1]) { const gf = add(roofG, gableFillGeo(W, RH - 0.05), wall, [0, 0, s * (D / 2 - 0.03)]); }
  add(roofG, roundedBox(0.14, 0.14, D + 0.55, 0.04), clay('#4b3b59'), [0, RH + 0.02, 0]);
  // door (hinged on its left edge)
  const doorPivot = group(front, [-0.5, 0, 0.04], [0, 0, 0], 'shedDoor');
  const door = group(doorPivot, [0.5, 0, 0]);
  add(door, new THREE.BoxGeometry(0.98, 1.84, 0.06), new THREE.MeshStandardMaterial({ map: plankTexture('#9c6e45'), roughness: 0.8 }), [0, 0.93, 0]);
  add(door, roundedBox(0.92, 0.08, 0.04, 0.01), clay('#7a5233'), [0, 1.55, 0.04]);
  add(door, roundedBox(0.92, 0.08, 0.04, 0.01), clay('#7a5233'), [0, 0.35, 0.04]);
  add(door, roundedBox(0.08, 1.35, 0.04, 0.01), clay('#7a5233'), [0, 0.95, 0.045], [0, 0, 0.62]);
  add(door, sphere(0.04, 12, 10), clay('#3a3a3a', { roughness: 0.3, metalness: 0.6 }), [0.38, 0.95, 0.07]);
  g.userData.door = doorPivot;
  // side window with cross frame (on the +X wall)
  const win = group(g, [W / 2 + 0.06, 1.35, 0], [0, Math.PI / 2, 0]);
  add(win, roundedBox(0.7, 0.6, 0.06, 0.02), trim, [0, 0, 0]);
  add(win, roundedBox(0.58, 0.48, 0.04, 0.01), clay('#3b4a63', { roughness: 0.2 }), [0, 0, 0.02], [0, 0, 0], 1, { shadow: false, name: 'shedWindowGlass' });
  add(win, roundedBox(0.58, 0.04, 0.05, 0.01), trim, [0, 0, 0.04]);
  add(win, roundedBox(0.04, 0.48, 0.05, 0.01), trim, [0, 0, 0.04]);
  // step + base
  add(g, roundedBox(1.3, 0.14, 0.5, 0.03), clay('#a7a29a'), [0, 0.07, D / 2 + 0.3]);
  add(g, roundedBox(W + 0.15, 0.12, D + 0.15, 0.03), clay('#8f7a62'), [0, 0.06, 0], [0, 0, 0], 1, { shadow: false });
  return g;
}

// "HAUNTED HOUSE – $1" hand-painted cardboard sign on a stake
export function makeDollarSign() {
  const g = new THREE.Group(); g.name = 'dollarSign';
  const card = clay('#b08a55');
  const face = new THREE.MeshStandardMaterial({ map: dollarSignTexture(), roughness: 0.9 });
  add(g, new THREE.BoxGeometry(1.15, 0.72, 0.025), [card, card, card, card, face, card], [0, 1.2, 0], [0, 0, 0.06]);
  add(g, roundedBox(0.07, 1.2, 0.05, 0.015), clay('#8a6238'), [0, 0.6, -0.04]);
  return g;
}
function dollarSignTexture() {
  return canvasTex(1024, 640, (c, w, h) => {
    c.fillStyle = '#c9a46a'; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.07;
    for (let x = 0; x < w; x += 18) { c.fillStyle = x % 36 ? '#000' : '#fff'; c.fillRect(x, 0, 9, h); }
    c.globalAlpha = 0.14; c.fillStyle = '#7a5a2a';
    for (const [x, y, r] of [[0.15, 0.85, 70], [0.88, 0.2, 45], [0.55, 0.92, 35]]) { c.beginPath(); c.arc(x * w, y * h, r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(w / 2, h * 0.3); c.rotate(-0.035);
    c.fillStyle = '#1e1a18'; c.font = '178px "Permanent Marker"'; c.fillText('HAUNTED', 0, 0); c.restore();
    c.save(); c.translate(w * 0.4, h * 0.7); c.rotate(-0.02);
    c.fillStyle = '#1e1a18'; c.font = '150px "Permanent Marker"'; c.fillText('HOUSE –', 0, 0); c.restore();
    c.save(); c.translate(w * 0.8, h * 0.68); c.rotate(-0.1);
    c.fillStyle = '#d32a1f'; c.font = '205px "Permanent Marker"'; c.fillText('$1', 0, 0); c.restore();
    // tape
    c.fillStyle = 'rgba(245,240,225,0.8)';
    for (const [x, y, a] of [[0.06, 0.07, -0.6], [0.94, 0.08, 0.6]]) { c.save(); c.translate(x * w, y * h); c.rotate(a); c.fillRect(-70, -20, 140, 40); c.restore(); }
  });
}

// glass jar with coins, on an upturned bucket
export function makeCoinJar() {
  const g = new THREE.Group(); g.name = 'coinJar';
  add(g, cyl(0.2, 0.17, 0.42, 20), clay('#5b7fa6', { roughness: 0.5 }), [0, 0.21, 0]);
  const jar = add(g, cyl(0.11, 0.11, 0.24, 24, true), new THREE.MeshStandardMaterial({ color: '#dff2ff', roughness: 0.08, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), [0, 0.55, 0], [0, 0, 0], 1, { shadow: false });
  jar.userData.noAO = true;
  add(g, cyl(0.11, 0.11, 0.015, 24), clay('#dff2ff', { roughness: 0.1 }), [0, 0.43, 0]);
  add(g, cyl(0.075, 0.075, 0.03, 20), clay('#d8d8d8', { roughness: 0.3, metalness: 0.7 }), [0, 0.68, 0]);
  const coinMat = clay('#f2c94c', { roughness: 0.3, metalness: 0.8 });
  const rnd = mulberry32(3);
  for (let i = 0; i < 6; i++) add(g, cyl(0.035, 0.035, 0.008, 16), coinMat, [(rnd() - 0.5) * 0.1, 0.445 + i * 0.006, (rnd() - 0.5) * 0.1], [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4]);
  return g;
}
export function makeCoin() {
  const m = new THREE.Mesh(cyl(0.04, 0.04, 0.008, 20), clay('#f2c94c', { roughness: 0.3, metalness: 0.8 }));
  m.castShadow = true;
  return m;
}

export function makePumpkin(r = 0.3, carved = false, seed = 1) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(r, 36, 24);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.x, v.z);
    const k = 1 - 0.08 * Math.pow(Math.abs(Math.cos(th * 4)), 0.5);
    v.x *= k; v.z *= k; v.y *= 0.78;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const body = add(g, geo, clay('#f28a1e', { roughness: 0.6 }), [0, r * 0.78, 0]);
  add(g, cyl(r * 0.08, r * 0.12, r * 0.35, 8), clay('#5d7a2e'), [0, r * 1.62, 0], [0.2, 0, 0.15]);
  if (carved) {
    // glowing carved face: triangle eyes and a toothy grin, plus a candle light inside
    const fg = group(g, [0, r * 0.82, r * 0.92]);
    const lit = glow('#ffb03a', 3.0);
    for (const x of [-0.35, 0.35]) add(fg, new THREE.CircleGeometry(r * 0.2, 3), lit, [x * r, r * 0.18, 0.01], [0, 0, Math.PI / 2], 1, { shadow: false });
    const mouth = new THREE.Shape();
    mouth.moveTo(-0.5, 0); mouth.quadraticCurveTo(0, -0.45, 0.5, 0); mouth.lineTo(0.3, -0.05); mouth.lineTo(0.2, 0.08); mouth.lineTo(0.05, -0.08);
    mouth.lineTo(-0.1, 0.08); mouth.lineTo(-0.25, -0.06); mouth.lineTo(-0.5, 0);
    const mg = new THREE.ShapeGeometry(mouth); mg.scale(r, r, r);
    add(fg, mg, lit, [0, -r * 0.12, 0.01], [0, 0, 0], 1, { shadow: false });
    fg.children.forEach((m) => { m.userData.noAO = true; });
    // the candle sits inside: it warms the ground around the pumpkin without a hot spot on its face
    const L = new THREE.PointLight('#ff9a2e', 0.0, 3.0, 2); L.position.set(0, r * 0.8, 0); g.add(L); g.userData.light = L;
  }
  return g;
}

// ---- sky elements -------------------------------------------------------------------------------
export function makeClouds(seed = 3) {
  const g = new THREE.Group(); g.name = 'clouds';
  const rnd = mulberry32(seed);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.2 });
  g.userData.mat = mat;
  const puff = (r) => {
    const geo = new THREE.IcosahedronGeometry(r, 3);
    return geo;
  };
  const cloud = (w, h) => {
    const parts = [];
    const n = 7 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const u = (k / (n - 1)) * 2 - 1;                     // -1..1 across the cloud
      const r = h * (0.55 + 0.45 * (1 - u * u)) * (0.75 + rnd() * 0.35);
      const geo = puff(r);
      geo.translate(u * w * 0.5 + (rnd() - 0.5) * r * 0.4, r * (0.55 + rnd() * 0.25) * (1 - 0.3 * u * u), (rnd() - 0.5) * r * 0.6);
      parts.push(geo);
    }
    // a few small puffs on top
    for (let k = 0; k < 3; k++) { const geo = puff(h * (0.35 + rnd() * 0.2)); geo.translate((rnd() - 0.5) * w * 0.5, h * (1.1 + rnd() * 0.3), (rnd() - 0.5) * h * 0.4); parts.push(geo); }
    const geo = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      if (y < 0) { y = y * 0.12; pos.setY(i, y); }        // flat bottom
      const k = THREE.MathUtils.clamp(y / (h * 1.2), 0, 1);
      const c = 0.72 + 0.28 * Math.sqrt(k);               // grey underside, bright top
      col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = Math.min(1, c * 1.04);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const spots = [];
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    const d = 170 + rnd() * 200;
    spots.push([Math.cos(a) * d * 1.2, 45 + rnd() * 70, Math.sin(a) * d, 26 + rnd() * 30, 9 + rnd() * 8]);
  }
  // a few small flat cloud strips low on the horizon
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.0, d = 260 + rnd() * 120; spots.push([Math.cos(a) * d, 28 + rnd() * 20, Math.sin(a) * d, 30 + rnd() * 20, 4 + rnd() * 2]); }
  for (const [x, y, z, w, h] of spots) {
    const m = new THREE.Mesh(cloud(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = Math.atan2(-x, -z) + (rnd() - 0.5) * 0.6;
    g.add(m);
  }
  g.traverse((o) => { o.userData.noAO = true; });
  return g;
}

export function makeMoon() {
  const g = new THREE.Group(); g.name = 'moon';
  const tex = canvasTex(512, 512, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#fffbe8'); grd.addColorStop(0.85, '#fff1c4'); grd.addColorStop(1, '#f6e2a6');
    c.fillStyle = grd; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
    c.fillStyle = 'rgba(214,196,150,0.55)';
    for (const [x, y, r] of [[0.35, 0.35, 0.09], [0.62, 0.42, 0.06], [0.45, 0.66, 0.11], [0.7, 0.66, 0.05], [0.28, 0.55, 0.04]]) {
      c.beginPath(); c.arc(x * w, y * h, r * w, 0, 7); c.fill();
    }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false, color: new THREE.Color(1.6, 1.55, 1.4) }));
  g.add(disc);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 256, (c, w, h) => { const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, 'rgba(255,240,200,0.55)'); grd.addColorStop(0.4, 'rgba(200,190,255,0.18)'); grd.addColorStop(1, 'rgba(160,150,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, w, h); }),
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -0.01; g.add(halo);
  g.traverse((o) => { o.userData.noAO = true; });
  g.userData.disc = disc; g.userData.halo = halo;
  return g;
}

export function makeStars(seed = 8) {
  const rnd = mulberry32(seed);
  const n = 1600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, el = Math.asin(0.05 + rnd() * 0.95);
    const d = 700;
    pos[i * 3] = Math.cos(a) * Math.cos(el) * d; pos[i * 3 + 1] = Math.sin(el) * d; pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * d;
    const b = 0.6 + rnd() * 0.8; col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b * (0.9 + rnd() * 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const p = new THREE.Points(geo, mat); p.name = 'stars'; p.frustumCulled = false; p.userData.noAO = true;
  return p;
}

// ---- the whole backyard -------------------------------------------------------------------------
export function buildBackyard(nightGlass) {
  const root = new THREE.Group(); root.name = 'backyard';
  const rnd = mulberry32(11);
  // ground
  const ground = add(root, new THREE.PlaneGeometry(900, 900, 1, 1), lawnMaterial(), [0, 0, 0], [-Math.PI / 2, 0, 0], 1, { shadow: false });
  ground.receiveShadow = true;
  // stepping stones: from near the camera curving to the shed door
  const S = LAYOUT.shed;
  const doorPos = new THREE.Vector3(...S.pos).add(new THREE.Vector3(0, 0, 1.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), S.rotY));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.9, 0, 4.4), new THREE.Vector3(-0.9, 0, -0.6), doorPos);
  const stones = [];
  for (let i = 0; i <= 7; i++) { const p = curve.getPoint(i / 7.8); stones.push([[p.x + (rnd() - 0.5) * 0.15, 0.025, p.z], rnd() * 3, 0.9 + rnd() * 0.25]); }
  const stoneGeo = new THREE.CylinderGeometry(0.34, 0.36, 0.05, 12);
  root.add(instanced(stoneGeo, clay('#d2d4d2', { flatShading: true, roughness: 0.9 }), stones));
  root.userData.stones = stones.map((s) => s[0]);
  // grass tufts (not on the stones)
  const tufts = [];
  for (let i = 0; i < 1400; i++) {
    const x = (rnd() - 0.5) * 60, z = 12 - rnd() * 60;
    if (stones.some(([p]) => Math.hypot(p[0] - x, p[2] - z) < 0.5)) continue;
    if (Math.hypot(x - S.pos[0], z - S.pos[2]) < 2.0) continue;
    tufts.push([[x, 0, z], rnd() * 6, 0.7 + rnd() * 0.8]);
  }
  root.add(instanced(tuftGeometry(), clay('#3f8a32', { roughness: 0.9 }), tufts, { shadow: false }));
  // white daisies
  const daisies = [];
  for (let i = 0; i < 300; i++) daisies.push([[(rnd() - 0.5) * 50, 0.03, 10 - rnd() * 50], 0, 1]);
  root.add(instanced(new THREE.SphereGeometry(0.025, 6, 4), clay('#ffffff'), daisies, { shadow: false }));
  // picket fence: back and sides
  const picket = mergeGeometries([new THREE.BoxGeometry(0.1, 0.9, 0.035).translate(0, 0.45, 0), new THREE.ConeGeometry(0.075, 0.13, 4).rotateY(Math.PI / 4).translate(0, 0.96, 0)]);
  const pickets = [], rails = [];
  const fenceLine = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.19), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    for (let i = 0; i <= n; i++) pickets.push([[x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n], ry, 1]);
    for (const y of [0.28, 0.7]) rails.push([[(x0 + x1) / 2, y, (z0 + z1) / 2], ry, [L, 1, 1]]);
  };
  const fenceMat = clay(PAL.fence, { roughness: 0.7 });
  const fenceMesh = () => {
    const g = new THREE.Group();
    g.add(instanced(picket, fenceMat, pickets.splice(0)));
    g.add(instanced(new THREE.BoxGeometry(1, 0.07, 0.03).translate(0, 0, -0.03), fenceMat, rails.splice(0)));
    root.add(g); return g;
  };
  fenceLine(-24, -42, 24, -42); fenceLine(-24, -42, -24, 14); fenceMesh();
  fenceLine(24, -42, 24, 14);
  const fenceRight = fenceMesh();
  // trees and bushes
  const estateTrees = [];       // hidden when the haunted estate stands there
  for (const [x, z, h, s] of [[-17, -16, 4.2, 3], [-21, -4, 3.6, 4], [14, -14, 4.0, 5], [19, -26, 4.5, 6], [-6, -30, 4.8, 7], [10, -38, 4.0, 8],
    [-14, -37, 4.4, 9], [21, 4, 3.8, 10], [-20, 8, 3.2, 12], [28, -48, 5, 13], [-30, -50, 5.2, 14], [2, -52, 4.6, 15], [40, -20, 5, 16], [-40, -20, 5, 17]]) {
    const t = makeTree(s, h); t.position.set(x, 0, z); root.add(t);
    if (x > 3 && z < -10 && z > -45) estateTrees.push(t);
  }
  for (let i = 0; i < 18; i++) { const b = makeBush(i + 30, 0.4 + rnd() * 0.3); b.position.set(-22 + i * 2.6, 0, -41); root.add(b); }
  // vegetable garden rows in the back corner
  for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) {
    add(root, blob(0.22, 2, 0.1, 50 + k), clay('#4f9a3a'), [-18 + k * 0.7, 0.18, -30 + r * 1.1], [0, k, 0], 1);
  }
  for (let r = 0; r < 4; r++) add(root, roundedBox(6.6, 0.12, 0.7, 0.04), clay('#7a5233'), [-15.2, 0.03, -30 + r * 1.1], [0, 0, 0], 1, { shadow: false });
  // distant houses beyond the fences
  let seed = 1;
  for (const [x, z, ry] of [[-38, -60, 0], [-22, -62, 0.1], [-6, -64, 0], [10, -63, -0.05], [26, -61, 0.05], [42, -58, -0.1],
    [-46, -84, 0], [-28, -88, 0.05], [-10, -90, 0], [8, -92, 0], [26, -89, -0.05], [44, -86, 0], [-36, -20, Math.PI / 2], [-38, 2, Math.PI / 2],
    [38, -10, -Math.PI / 2], [38, 8, -Math.PI / 2], [-60, -40, 0.4], [60, -42, -0.4], [-20, -118, 0], [6, -120, 0], [30, -116, 0]]) {
    const h = makeNeighborHouse(seed++); h.position.set(x, 0, z); h.rotation.y = ry; root.add(h);
  }
  // hills on the horizon
  for (const [x, z, sx, sy] of [[-180, -420, 260, 55], [120, -460, 300, 70], [380, -380, 220, 45], [-420, -360, 220, 50]]) {
    add(root, new THREE.SphereGeometry(1, 48, 24), clay('#c9dcc0', { roughness: 1 }), [x, -sy * 0.35, z], [0, 0, 0], [sx, sy, sx * 0.5], { shadow: false });
  }
  // our house + shed + sign + jar + decorations
  const house = makeOurHouse(nightGlass); house.position.set(...LAYOUT.house.pos); house.rotation.y = LAYOUT.house.rotY; root.add(house);
  const shed = makeShed(); shed.position.set(...S.pos); shed.rotation.y = S.rotY; root.add(shed);
  const sign = makeDollarSign(); root.add(sign);
  sign.position.copy(new THREE.Vector3(...S.pos).add(new THREE.Vector3(1.05, 0, 1.85).applyAxisAngle(new THREE.Vector3(0, 1, 0), S.rotY)));
  sign.rotation.y = S.rotY + 0.25;
  const jar = makeCoinJar(); root.add(jar);
  jar.position.copy(new THREE.Vector3(...S.pos).add(new THREE.Vector3(-0.95, 0, 1.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), S.rotY)));
  const pumpkins = [];
  for (const [dx, dz, r, c] of [[-1.5, 1.4, 0.26, true], [-1.75, 1.0, 0.18, false], [1.55, 1.25, 0.2, true]]) {
    const p = makePumpkin(r, c, Math.round(r * 100)); root.add(p);
    p.position.copy(new THREE.Vector3(...S.pos).add(new THREE.Vector3(dx, 0, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), S.rotY)));
    p.rotation.y = S.rotY + dx * 0.2; pumpkins.push(p);
  }
  root.userData = { ground, house, shed, sign, jar, pumpkins, stones: root.userData.stones, doorPos, estateTrees, fenceRight };
  // the estate shots hide the trees and the side fence that stand where the mansion grows
  root.userData.estateMode = (on) => { estateTrees.forEach((t) => { t.visible = !on; }); fenceRight.visible = !on; };
  root.userData.reset = () => root.userData.estateMode(false);
  return root;
}

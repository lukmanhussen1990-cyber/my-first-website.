// The sleeper coach interior, the night outside and the lights.
// Units are metres. Coach space: x along the coach, y up, z across
// (bay window wall at z = -1.45, side window wall at z = +1.68).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { mulberry32 } from './util.js';

export const BAYS = [-2.4, 0, 2.4, 4.8, 7.2, 9.6];
export const DIM = {
  wallZ: -1.45,
  sideWallZ: 1.68,
  ceil: 2.95,
  berthLen: 1.82,
  berthZ: -0.51, // centre of the transverse berths
  aisleEnd: 0.4,
  lower: 0.48,
  middle: 1.25,
  upper: 2.02,
  stackA: -0.85, // your stack (x offset from bay centre)
  stackB: 0.85, // opposite stack
  sideZ: 1.33,
  sideUpper: 1.85,
  win: { x0: -0.6, x1: 0.6, y0: 0.7, y1: 1.62 },
  sideWin: { x0: -0.6, x1: 0.6, y0: 0.86, y1: 1.6 },
};

// Box-projected UVs so textures keep a constant texel size on any geometry.
export function boxUV(geo, scale = 1) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ax >= ay && ax >= az) [u, v] = [p.getZ(i), p.getY(i)];
    else if (ay >= az) [u, v] = [p.getX(i), p.getZ(i)];
    else [u, v] = [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
  return geo.clone().applyMatrix4(_m);
}

// Collects static geometry per material and merges it into few draw calls.
export class Batch {
  constructor() {
    this.items = new Map();
  }
  add(mat, geo) {
    if (!this.items.has(mat)) this.items.set(mat, []);
    const g = geo.index ? geo.toNonIndexed() : geo; // merge needs a uniform layout
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    this.items.get(mat).push(g);
  }
  build(parent, { cast = true, receive = true } = {}) {
    for (const [mat, geos] of this.items) {
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast && !mat.userData.noCast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
    }
  }
}

export const rbox = (w, h, d, r = 0.02, s = 2) => new RoundedBoxGeometry(w, h, d, Math.min(s, 2), Math.min(r, w / 2, h / 2, d / 2));

function makeMaterials() {
  const rex = T.rexine();
  const rust = T.rustySteel();
  const m = {
    rexine: new THREE.MeshPhysicalMaterial({ map: rex.map, bumpMap: rex.bump, bumpScale: 1.2, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ map: rust.map, roughnessMap: rust.rough, color: 0x9aa2a8, metalness: 0.55, roughness: 0.65 }),
    darkSteel: new THREE.MeshStandardMaterial({ map: rust.map, color: 0x3c4248, metalness: 0.5, roughness: 0.6 }),
    bars: new THREE.MeshStandardMaterial({ map: rust.map, roughnessMap: rust.rough, color: 0xb0a49a, metalness: 0.6, roughness: 0.55 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x8f989e, metalness: 0.75, roughness: 0.38 }),
    wall: new THREE.MeshStandardMaterial({ map: T.wallPanel(), roughness: 0.72 }),
    partition: new THREE.MeshStandardMaterial({ map: T.wallPanel(), color: 0xc9d2c9, roughness: 0.7 }),
    ceiling: new THREE.MeshStandardMaterial({ map: T.ceilingPanel(), roughness: 0.82 }),
    floor: new THREE.MeshStandardMaterial({ map: T.floor(), roughness: 0.82 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0a1420, transparent: true, opacity: 0.22, roughness: 0.06, metalness: 0.1, depthWrite: false }),
    curtain: new THREE.MeshStandardMaterial({ map: T.blanket(0), color: 0xb08890, roughness: 0.92, side: THREE.DoubleSide }),
    curtainTeal: new THREE.MeshStandardMaterial({ map: T.blanket(1), color: 0x8fb0aa, roughness: 0.92, side: THREE.DoubleSide }),
    chainRed: new THREE.MeshStandardMaterial({ color: 0xc8182f, roughness: 0.32, metalness: 0.35, emissive: 0x3a0308, emissiveIntensity: 1 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.3, emissive: 0x0b0f14 }),
    lampDome: new THREE.MeshStandardMaterial({ color: 0x7c8a9a, roughness: 0.4, metalness: 0.5 }),
    lampBulb: new THREE.MeshStandardMaterial({ color: 0x0a1630, emissive: 0x8aa8ff, emissiveIntensity: 5 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.55 }),
    bag: new THREE.MeshStandardMaterial({ map: T.blanket(2), roughness: 0.85 }),
    suitcaseA: new THREE.MeshStandardMaterial({ color: 0x4a1f27, roughness: 0.45, metalness: 0.05 }),
    suitcaseB: new THREE.MeshStandardMaterial({ color: 0x1f3f45, roughness: 0.45, metalness: 0.05 }),
    bottle: new THREE.MeshPhysicalMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.35, roughness: 0.1, clearcoat: 1 }),
    bottleCap: new THREE.MeshStandardMaterial({ color: 0x1c6b74, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.6 }),
  };
  m.glass.userData.noCast = true;
  return m;
}

function buildShell(b, M) {
  const L0 = -3.6;
  const L1 = 10.8;
  const len = L1 - L0;
  const mid = (L0 + L1) / 2;
  b.add(M.floor, boxUV(placed(new THREE.BoxGeometry(len, 0.05, 3.25), mid, -0.025, 0.115), 0.6));
  b.add(M.ceiling, boxUV(placed(new THREE.BoxGeometry(len, 0.04, 3.25), mid, DIM.ceil + 0.02, 0.115), 0.5));
  // coving strips along the walls
  b.add(M.ceiling, boxUV(placed(new THREE.BoxGeometry(len, 0.04, 0.42), mid, DIM.ceil - 0.12, DIM.wallZ + 0.16, -0.6), 0.5));
  b.add(M.ceiling, boxUV(placed(new THREE.BoxGeometry(len, 0.04, 0.42), mid, DIM.ceil - 0.12, DIM.sideWallZ - 0.16, 0.6), 0.5));
  // end walls
  b.add(M.wall, boxUV(placed(new THREE.BoxGeometry(0.06, DIM.ceil, 3.25), L0 - 0.03, DIM.ceil / 2, 0.115), 0.9));
  b.add(M.wall, boxUV(placed(new THREE.BoxGeometry(0.06, DIM.ceil, 3.25), L1 + 0.03, DIM.ceil / 2, 0.115), 0.9));
  b.add(M.black, placed(rbox(0.04, 1.9, 0.75, 0.02), L1, 0.95, 0.72));

  // long walls with window openings
  for (const [zIn, w, sign] of [[DIM.wallZ, DIM.win, -1], [DIM.sideWallZ, DIM.sideWin, 1]]) {
    const z = zIn + sign * 0.03;
    const segs = [];
    let x = L0;
    for (const c of BAYS) {
      segs.push([x, c + w.x0]);
      x = c + w.x1;
      b.add(M.wall, boxUV(placed(new THREE.BoxGeometry(w.x1 - w.x0, w.y0, 0.06), c, w.y0 / 2, z), 0.45));
      b.add(M.wall, boxUV(placed(new THREE.BoxGeometry(w.x1 - w.x0, DIM.ceil - w.y1, 0.06), c, (DIM.ceil + w.y1) / 2, z), 0.45));
      // aluminium frame + sill
      const fw = w.x1 - w.x0;
      const fh = w.y1 - w.y0;
      const fz = zIn - sign * 0.01;
      b.add(M.alu, placed(rbox(fw + 0.06, 0.04, 0.07, 0.01), c, w.y0, fz));
      b.add(M.alu, placed(rbox(fw + 0.06, 0.04, 0.07, 0.01), c, w.y1, fz));
      b.add(M.alu, placed(rbox(0.04, fh, 0.07, 0.01), c + w.x0, (w.y0 + w.y1) / 2, fz));
      b.add(M.alu, placed(rbox(0.04, fh, 0.07, 0.01), c + w.x1, (w.y0 + w.y1) / 2, fz));
      b.add(M.alu, placed(rbox(fw, 0.03, 0.05, 0.01), c, (w.y0 + w.y1) / 2 + 0.06, fz + sign * 0.02));
      // glass (outer) and bars (inner)
      b.add(M.glass, placed(new THREE.PlaneGeometry(fw, fh), c, (w.y0 + w.y1) / 2, zIn + sign * 0.035));
      const n = 6;
      for (let i = 1; i <= n; i++) {
        const y = w.y0 + (fh * i) / (n + 1);
        b.add(M.bars, placed(new THREE.CylinderGeometry(0.009, 0.009, fw, 8), c, y, zIn - sign * 0.04, 0, 0, Math.PI / 2));
      }
      for (const bx of [w.x0 + 0.33, w.x1 - 0.33]) {
        b.add(M.bars, placed(new THREE.CylinderGeometry(0.011, 0.011, fh, 8), c + bx, (w.y0 + w.y1) / 2, zIn - sign * 0.045));
      }
    }
    segs.push([x, L1]);
    for (const [a, bb] of segs) {
      if (bb - a < 0.01) continue;
      b.add(M.wall, boxUV(placed(new THREE.BoxGeometry(bb - a, DIM.ceil, 0.06), (a + bb) / 2, DIM.ceil / 2, z), 0.45));
    }
  }
}

function buildBay(b, M, c, rnd) {
  const L = DIM.berthLen;
  const z = DIM.berthZ;
  // partitions (shared between bays; add the one at c - 1.2 for every bay plus the last)
  for (const px of c === BAYS[BAYS.length - 1] ? [c - 1.2, c + 1.2] : [c - 1.2]) {
    b.add(M.partition, boxUV(placed(rbox(0.05, DIM.ceil, 1.9, 0.015), px, DIM.ceil / 2, z - 0.01), 0.45));
    b.add(M.alu, placed(rbox(0.07, DIM.ceil, 0.05, 0.015), px, DIM.ceil / 2, DIM.aisleEnd + 0.02));
  }
  for (const sx of [DIM.stackA, DIM.stackB]) {
    const x = c + sx;
    const back = Math.sign(sx); // partition side
    for (const y of [DIM.lower, DIM.middle, DIM.upper]) {
      b.add(M.rexine, boxUV(placed(rbox(0.6, 0.09, L, 0.035, 4), x, y - 0.045, z), 1.4));
      b.add(M.darkSteel, placed(rbox(0.6, 0.03, L, 0.008), x, y - 0.105, z));
      b.add(M.steel, placed(new THREE.CylinderGeometry(0.012, 0.012, L, 8), x - back * 0.3, y - 0.1, z, Math.PI / 2));
    }
    // lower berth backrest on the partition + base box
    b.add(M.rexine, boxUV(placed(rbox(0.07, 0.5, L - 0.04, 0.03, 3), x + back * 0.27, 0.8, z), 1.4));
    b.add(M.darkSteel, placed(rbox(0.04, 0.38, 0.04, 0.01), x - back * 0.27, 0.19, DIM.aisleEnd - 0.04));
    b.add(M.darkSteel, placed(rbox(0.04, 0.38, 0.04, 0.01), x - back * 0.27, 0.19, -1.36));
    // middle-berth chains
    for (const cz of [-1.3, 0.3]) {
      b.add(M.steel, placed(new THREE.CylinderGeometry(0.006, 0.006, DIM.upper - DIM.middle - 0.1, 6), x - back * 0.28, (DIM.upper + DIM.middle) / 2 - 0.08, cz));
    }
    // ladder at the aisle end
    for (const ly of [0.95, 1.55]) {
      b.add(M.steel, placed(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), x, ly, DIM.aisleEnd + 0.03, 0, 0, Math.PI / 2));
    }
    b.add(M.steel, placed(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 8), x - 0.24, 1.25, DIM.aisleEnd + 0.03));
    b.add(M.steel, placed(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 8), x + 0.24, 1.25, DIM.aisleEnd + 0.03));
    // luggage under the lower berth
    if (rnd() > 0.3) {
      const mat = rnd() > 0.5 ? M.suitcaseA : M.suitcaseB;
      b.add(mat, placed(rbox(0.42, 0.22, 0.62, 0.04), x - back * 0.04, 0.12, -0.2 + rnd() * 0.3, 0, rnd() * 0.3 - 0.15));
    }
  }
  // side berths
  for (const [y, h] of [[DIM.lower, 0.09], [DIM.sideUpper, 0.08]]) {
    b.add(M.rexine, boxUV(placed(rbox(1.8, h, 0.6, 0.035, 4), c, y - h / 2, DIM.sideZ), 1.4));
    b.add(M.darkSteel, placed(rbox(1.8, 0.03, 0.6, 0.008), c, y - h - 0.015, DIM.sideZ));
  }
  b.add(M.rexine, boxUV(placed(rbox(1.7, 0.4, 0.07, 0.03, 3), c, 0.78, DIM.sideWallZ - 0.06), 1.4));
  // snack table under the bay window
  b.add(M.wood, placed(rbox(0.56, 0.03, 0.26, 0.012), c, DIM.win.y0 - 0.02, DIM.wallZ + 0.14));
  b.add(M.darkSteel, placed(rbox(0.04, 0.12, 0.2, 0.01), c, DIM.win.y0 - 0.09, DIM.wallZ + 0.1));
  // tube light (off) + night-lamp fixture
  b.add(M.tube, placed(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 10), c, DIM.ceil - 0.06, 0.72, 0, 0, Math.PI / 2));
  b.add(M.alu, placed(rbox(1.2, 0.04, 0.08, 0.01), c, DIM.ceil - 0.02, 0.72));
  b.add(M.lampDome, placed(new THREE.CylinderGeometry(0.06, 0.09, 0.05, 16), c, DIM.ceil - 0.03, -0.45));
}

// Ceiling fan: merged static base + cage, merged rotating blades (2 draw calls).
let _fanGeo = null;
function makeFan(M) {
  if (!_fanGeo) {
    const parts = [
      placed(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16), 0, -0.01, 0),
      placed(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), 0, -0.07, 0),
      placed(new THREE.SphereGeometry(0.075, 14, 8), 0, -0.15, 0),
    ];
    const cage = [-0.115, -0.2].map((y) => placed(new THREE.TorusGeometry(0.33, 0.0035, 4, 40), 0, y, 0, Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cage.push(placed(new THREE.CylinderGeometry(0.003, 0.003, 0.33, 4), Math.cos(a) * 0.165, -0.21, Math.sin(a) * 0.165, 0, -a, Math.PI / 2));
    }
    const blades = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      const bl = new THREE.BoxGeometry(0.27, 0.007, 0.075);
      bl.rotateX(0.25);
      bl.rotateY(-a);
      bl.translate(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
      blades.push(bl);
    }
    const nonIdx = (l) => mergeGeometries(l.map((g) => (g.index ? g.toNonIndexed() : g)));
    _fanGeo = { base: nonIdx([...parts, ...cage]), blades: nonIdx(blades) };
  }
  const g = new THREE.Group();
  const base = new THREE.Mesh(_fanGeo.base, M.alu);
  base.castShadow = true;
  g.add(base);
  const blades = new THREE.Mesh(_fanGeo.blades, M.alu);
  blades.position.y = -0.16;
  blades.castShadow = true;
  g.add(blades);
  g.userData.blades = blades;
  return g;
}

// Curtain panel with gathered folds; vertices animated in update().
function makeCurtain(mat, w, h, side) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 14);
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { base, w, h, side };
  return mesh;
}

function updateCurtain(mesh, t, phase, sway) {
  const { base, h, side } = mesh.userData;
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const hang = (h / 2 - y) / h; // 0 at rod, 1 at hem
    const fold = Math.sin(x * 42 + side) * 0.018 * (1 - 0.4 * hang);
    const wave = Math.sin(t * 1.3 + phase + y * 3 + x * 4) * 0.012 * hang + sway * hang * hang * 0.09;
    p.setZ(i, fold + wave + Math.sin(t * 0.7 + phase) * 0.006 * hang);
    p.setX(i, x + Math.sin(t * 0.9 + phase + y * 2) * 0.008 * hang);
  }
  p.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

// Alarm chain: bracket, swinging links and a red pull handle.
function makeAlarmChain(M) {
  const root = new THREE.Group();
  const bracket = new THREE.Mesh(rbox(0.09, 0.05, 0.05, 0.01), M.steel);
  bracket.castShadow = true;
  root.add(bracket);
  const swing = new THREE.Group();
  root.add(swing);
  const linkGeo = new THREE.TorusGeometry(0.0105, 0.0032, 6, 14);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(linkGeo, M.chainRed);
    l.position.y = -0.03 - i * 0.019;
    l.scale.set(1, 1.5, 1);
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    l.castShadow = true;
    swing.add(l);
  }
  const hy = -0.03 - n * 0.019 - 0.03;
  const handle = new THREE.Mesh(rbox(0.13, 0.034, 0.034, 0.015, 3), M.chainRed);
  handle.position.y = hy;
  handle.castShadow = true;
  swing.add(handle);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), M.chainRed);
  knob.position.y = hy + 0.025;
  swing.add(knob);
  root.userData.swing = swing;
  return root;
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { moonDir: { value: new THREE.Vector3(-0.25, 0.42, -1).normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 moonDir;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(vec3(0.05, 0.11, 0.17), vec3(0.012, 0.022, 0.06), smoothstep(0.0, 0.6, h));
        float m = dot(d, moonDir);
        col += vec3(0.55, 0.65, 0.9) * pow(max(m, 0.0), 60.0) * 0.6;
        col += vec3(0.25, 0.32, 0.5) * pow(max(m, 0.0), 8.0) * 0.18;
        col += vec3(2.6, 2.75, 3.0) * smoothstep(0.99975, 0.99985, m);
        vec3 q = floor(d * 420.0);
        float s = hash(q);
        col += vec3(0.7, 0.75, 0.9) * step(0.9975, s) * smoothstep(0.05, 0.3, h) * 0.7;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function buildWorld(scene) {
  const M = makeMaterials();
  const coach = new THREE.Group();
  coach.name = 'coach';
  scene.add(coach);

  const b = new Batch();
  const rnd = mulberry32(5);
  buildShell(b, M);
  for (const c of BAYS) {
    const bb = new Batch();
    buildBay(bb, M, c, rnd);
    bb.build(coach);
  }
  // water bottle + steel tumbler on your bay's table
  b.add(M.bottleCap, placed(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 12), 0.12, DIM.win.y0 + 0.24, DIM.wallZ + 0.12));
  b.add(M.alu, placed(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 16), -0.1, DIM.win.y0 + 0.04, DIM.wallZ + 0.16));
  b.add(M.bag, placed(rbox(0.3, 0.36, 0.14, 0.06), -1.15, 1.62, 0.26, 0, 0, 0.05));
  b.build(coach);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.22, 16), M.bottle);
  bottle.position.set(0.12, DIM.win.y0 + 0.11, DIM.wallZ + 0.12);
  coach.add(bottle);

  // berth number plates
  const plates = [['33', -0.85, DIM.lower], ['34', -0.85, DIM.middle], ['36', 0.85, DIM.lower], ['37', 0.85, DIM.middle], ['38', 0.85, DIM.upper], ['39', 0, DIM.lower]];
  for (const [txt, x, y] of plates) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), new THREE.MeshStandardMaterial({ map: T.numberPlate(txt), roughness: 0.5 }));
    p.position.set(x + Math.sign(x || 1) * 0.39, y + 0.2, DIM.aisleEnd + 0.05);
    coach.add(p);
  }

  // fans
  const fans = [];
  for (const c of BAYS) {
    for (const [fx, fz] of [[c - 0.45, -0.75], [c + 0.45, -0.75], [c, DIM.sideZ - 0.1]]) {
      const f = makeFan(M);
      f.position.set(fx, DIM.ceil, fz);
      f.userData.phase = (fx * 1.7 + fz) % (Math.PI * 2);
      coach.add(f);
      fans.push(f);
    }
  }
  // night lamp bulbs (emissive) in every bay
  for (const c of BAYS) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 10), M.lampBulb);
    bulb.position.set(c, DIM.ceil - 0.075, -0.45);
    coach.add(bulb);
  }
  // curtains on bay windows and side windows
  const curtains = [];
  for (const c of BAYS) {
    for (const s of [-1, 1]) {
      const cu = makeCurtain(M.curtain, 0.34, 0.98, s * 2);
      cu.position.set(c + s * 0.47, (DIM.win.y0 + DIM.win.y1) / 2 + 0.03, DIM.wallZ + 0.07);
      coach.add(cu);
      curtains.push(cu);
      const cs = makeCurtain(M.curtainTeal, 0.3, 0.8, s * 3);
      cs.position.set(c + s * 0.48, (DIM.sideWin.y0 + DIM.sideWin.y1) / 2 + 0.03, DIM.sideWallZ - 0.07);
      cs.rotation.y = Math.PI;
      coach.add(cs);
      curtains.push(cs);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.3, 8), M.alu);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(c, DIM.win.y1 + 0.06, DIM.wallZ + 0.07);
    coach.add(rod);
  }

  // alarm chain above your bay window, on your side
  const chain = makeAlarmChain(M);
  chain.position.set(-0.2, DIM.win.y1 + 0.16, DIM.wallZ + 0.09);
  coach.add(chain);

  // --- outside -----------------------------------------------------------
  const outside = new THREE.Group();
  scene.add(outside);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), skyMaterial());
  sky.frustumCulled = false;
  outside.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 80), new THREE.MeshStandardMaterial({ color: 0x0b1210, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.1;
  ground.receiveShadow = true;
  outside.add(ground);

  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0c1714, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x0a0d0c, roughness: 1 });
  const crown = mergeGeometries([
    placed(new THREE.IcosahedronGeometry(1.6, 1), 0, 4.2, 0),
    placed(new THREE.IcosahedronGeometry(1.2, 1), 0.9, 3.4, 0.3),
    placed(new THREE.IcosahedronGeometry(1.1, 1), -0.8, 3.6, -0.2),
  ]);
  const trunk = placed(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 6), 0, 1.6, 0);
  const trees = [];
  const trng = mulberry32(77);
  const N = 70;
  const crowns = new THREE.InstancedMesh(crown, treeMat, N);
  const trunks = new THREE.InstancedMesh(trunk, trunkMat, N);
  crowns.castShadow = trunks.castShadow = true;
  for (let i = 0; i < N; i++) {
    const sideSign = i % 3 === 0 ? 1 : -1;
    trees.push({
      x0: trng() * 160,
      z: sideSign * (5 + trng() * 12),
      s: 0.8 + trng() * 0.9,
      r: trng() * 6,
      y: -1.1 + trng() * 0.3,
    });
  }
  crowns.frustumCulled = trunks.frustumCulled = false;
  outside.add(crowns, trunks);
  const poleGeo = mergeGeometries([placed(new THREE.BoxGeometry(0.18, 8, 0.18), 0, 4.0, 0), placed(new THREE.BoxGeometry(0.1, 0.1, 3.4), 0, 7.4, 1.5)]);
  const poles = new THREE.InstancedMesh(poleGeo, trunkMat, 6);
  poles.castShadow = true;
  poles.frustumCulled = false;
  outside.add(poles);

  // --- lights ------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x46587a, 0x1a1216, 1.0);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xc6d3f7, 3.4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -4.2;
  sc.right = 4.2;
  sc.top = 4.2;
  sc.bottom = -4.2;
  sc.near = 0.5;
  sc.far = 45;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);
  // night lamps: one per bay we look into (constant light count -> no shader recompiles)
  const lamps = [0, 2.4, 4.8].map((x) => {
    const l = new THREE.PointLight(0x86a2e6, 6, 0, 1.75);
    l.position.set(x, DIM.ceil - 0.12, -0.45);
    coach.add(l);
    return l;
  });
  const [lamp, lamp2, lamp3] = lamps;

  const moonDir = new THREE.Vector3(0.25, -0.42, 1).normalize(); // light travels into the coach (+z)
  const SPEED = 9.5;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  function update(t, opts = {}) {
    // fans
    for (const f of fans) f.userData.blades.rotation.y = t * 7.4 + f.userData.phase;
    // curtains
    const sway = opts.sway || 0;
    curtains.forEach((cu, i) => updateCurtain(cu, t, i * 1.7, sway));
    // alarm chain pendulum (driven by coach roll + a lazy swing)
    const sw = chain.userData.swing;
    sw.rotation.z = -sway * 0.07 + Math.sin(t * 2.1) * 0.05 + Math.sin(t * 0.83 + 1) * 0.03;
    sw.rotation.x = Math.sin(t * 1.7 + 0.5) * 0.05;
    // trees + poles scroll past (deterministic wrap)
    const shift = opts.coachX || 0;
    trees.forEach((tr, i) => {
      let x = ((tr.x0 - t * SPEED) % 160 + 160) % 160 - 60 + shift;
      quat.setFromAxisAngle(up, tr.r);
      m4.compose(new THREE.Vector3(x, tr.y, tr.z), quat, new THREE.Vector3(tr.s, tr.s * 1.1, tr.s));
      crowns.setMatrixAt(i, m4);
      trunks.setMatrixAt(i, m4);
    });
    crowns.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 31 - t * SPEED) % 186 + 186) % 186 - 60;
      m4.makeTranslation(x, -1.1, -3.4);
      poles.setMatrixAt(i, m4);
    }
    poles.instanceMatrix.needsUpdate = true;
    // moon light follows the region of interest so its shadow map stays sharp
    const focus = opts.shadowFocus || new THREE.Vector3(0, 1, -0.5);
    const size = opts.shadowSize || 4.2;
    if (sc.right !== size) {
      sc.left = sc.bottom = -size;
      sc.right = sc.top = size;
      sc.updateProjectionMatrix();
    }
    moon.target.position.copy(focus);
    moon.position.copy(focus).addScaledVector(moonDir, -22);
    moon.intensity = opts.moon ?? 3.4;
    lamp.intensity = opts.lamp ?? 6;
    lamp2.intensity = opts.lamp2 ?? 4;
    lamp3.intensity = opts.lamp3 ?? 4;
    hemi.intensity = opts.hemi ?? 1.0;
  }

  return { coach, outside, M, fans, curtains, chain, lamps, moon, hemi, update };
}

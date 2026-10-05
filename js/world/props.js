// Roadside props placed from a schedule: streetlights, signs, utility poles,
// a flashing beacon, a lonely cabin, and the gas station at the journey's end.

import * as THREE from 'three';
import { ROAD } from '../config.js';
import { RNG } from '../core/rng.js';
import { makeRetroReflective } from './shared.js';
import { grainNormal } from '../core/textures.js';

export class PropSchedule {
  constructor() {
    this.entries = [];
    this.byId = new Map();
  }

  add(entry) {
    this.entries.push(entry);
    this.entries.sort((a, b) => a.s - b.s);
    if (entry.id) this.byId.set(entry.id, entry);
    return entry;
  }

  inRange(s0, s1) {
    return this.entries.filter((e) => e.s >= s0 && e.s < s1);
  }

  get(id) {
    return this.byId.get(id);
  }
}

const SIGN_FONT = '"Overpass", "Arial Narrow", Arial, sans-serif';
const _p = {};
const _f = {};

const mats = {};
function material(key, make) {
  if (!mats[key]) mats[key] = make();
  return mats[key];
}

const metal = () => material('metal', () => new THREE.MeshStandardMaterial({
  color: 0x6d7378, roughness: 0.5, metalness: 0.7, normalMap: grainNormal(5, 128, 900, 1, 2.5, 0.6),
}));
const darkMetal = () => material('darkMetal', () => new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.55, metalness: 0.6 }));
const wood = () => material('wood', () => new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 0.9 }));
const signBack = () => material('signBack', () => new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.45, metalness: 0.8 }));

/** Places an object on the ground at arc length s, lateral d, facing back toward approaching traffic. */
function place(obj, road, s, d, origin, yaw = 0) {
  const fr = road.sample(s, _f);
  const x = fr.x + fr.rx * d;
  const z = fr.z + fr.rz * d;
  const i = Math.max(0, Math.min(road.n - 1, Math.round(s / ROAD.ds)));
  const y = road.surfaceY(i, d, x, z);
  obj.position.set(x - origin.x, y - origin.y, z - origin.z);
  obj.rotation.y = fr.theta + yaw;
  return { x, y, z, fr };
}

const signCache = new Map();
function signTexture(spec) {
  const key = JSON.stringify(spec);
  if (signCache.has(key)) return signCache.get(key);
  const W = spec.w || 512;
  const H = spec.h || 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = 22;
  const rr = (x, y, w, h, rad) => {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  };
  if (spec.kind === 'diamond') {
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(Math.PI / 4);
    const s = W * 0.68;
    rr(-s / 2, -s / 2, s, s, 26);
    g.fillStyle = '#f0b81c';
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#111';
    rr(-s / 2 + 14, -s / 2 + 14, s - 28, s - 28, 18);
    g.stroke();
    g.restore();
    g.fillStyle = '#111';
    g.strokeStyle = '#111';
    if (spec.symbol === 'curveLeft' || spec.symbol === 'curveRight') {
      const dir = spec.symbol === 'curveLeft' ? -1 : 1;
      g.lineWidth = 30;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(W / 2 - dir * 10, H * 0.78);
      g.bezierCurveTo(W / 2 - dir * 10, H * 0.5, W / 2 + dir * 70, H * 0.48, W / 2 + dir * 70, H * 0.33);
      g.stroke();
      g.beginPath();
      g.moveTo(W / 2 + dir * 70 - 40, H * 0.36);
      g.lineTo(W / 2 + dir * 70, H * 0.22);
      g.lineTo(W / 2 + dir * 70 + 40, H * 0.36);
      g.closePath();
      g.fill();
    } else if (spec.symbol === 'deer') {
      g.save();
      g.translate(W / 2, H / 2 + 10);
      g.scale(1.2, 1.2);
      g.beginPath();
      g.ellipse(0, 0, 62, 26, -0.12, 0, Math.PI * 2); // body
      g.fill();
      g.beginPath();
      g.moveTo(48, -14); g.lineTo(78, -62); g.lineTo(96, -56); g.lineTo(66, -6); g.closePath(); g.fill(); // neck
      g.beginPath();
      g.ellipse(92, -64, 18, 10, -0.4, 0, Math.PI * 2); g.fill(); // head
      g.lineWidth = 5;
      g.beginPath(); // antlers
      g.moveTo(84, -72); g.lineTo(74, -104); g.moveTo(78, -88); g.lineTo(60, -98);
      g.moveTo(92, -74); g.lineTo(100, -108); g.moveTo(97, -92); g.lineTo(114, -100);
      g.stroke();
      g.lineWidth = 9;
      g.beginPath(); // legs
      g.moveTo(-40, 12); g.lineTo(-62, 70); g.moveTo(-26, 16); g.lineTo(-20, 72);
      g.moveTo(32, 14); g.lineTo(46, 70); g.moveTo(44, 10); g.lineTo(70, 62);
      g.stroke();
      g.restore();
    }
  } else if (spec.kind === 'green') {
    rr(4, 4, W - 8, H - 8, r);
    g.fillStyle = '#0d5a34';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#e8eee8';
    rr(16, 16, W - 32, H - 32, r - 8);
    g.stroke();
    g.fillStyle = '#eef2ee';
    g.textBaseline = 'middle';
    const lines = spec.lines;
    const lh = (H - 60) / lines.length;
    lines.forEach((ln, k) => {
      const y = 30 + lh * (k + 0.5);
      g.font = `700 ${Math.round(lh * 0.62)}px ${SIGN_FONT}`;
      g.textAlign = 'left';
      g.fillText(ln[0], 44, y);
      if (ln[1] !== undefined) {
        g.textAlign = 'right';
        g.fillText(ln[1], W - 44, y);
      }
    });
  } else if (spec.kind === 'white') {
    rr(4, 4, W - 8, H - 8, r);
    g.fillStyle = '#e9ebe6';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#151515';
    rr(16, 16, W - 32, H - 32, r - 8);
    g.stroke();
    g.fillStyle = '#151515';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = spec.lines;
    const lh = (H - 60) / lines.length;
    lines.forEach((ln, k) => {
      const big = ln.length <= 3;
      g.font = `700 ${Math.round(lh * (big ? 0.85 : 0.5))}px ${SIGN_FONT}`;
      g.fillText(ln, W / 2, 30 + lh * (k + 0.5));
    });
  } else if (spec.kind === 'shield') {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f2f2ee';
    g.beginPath();
    g.moveTo(W * 0.1, H * 0.08);
    g.lineTo(W * 0.9, H * 0.08);
    g.quadraticCurveTo(W * 0.95, H * 0.62, W * 0.5, H * 0.94);
    g.quadraticCurveTo(W * 0.05, H * 0.62, W * 0.1, H * 0.08);
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = '#111';
    g.stroke();
    g.fillStyle = '#111';
    g.font = `800 ${Math.round(H * 0.5)}px ${SIGN_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(spec.text, W / 2, H * 0.46);
  } else if (spec.kind === 'neon') {
    g.fillStyle = '#060606';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.round(H * 0.42)}px ${SIGN_FONT}`;
    g.shadowColor = spec.color;
    g.shadowBlur = 24;
    g.fillStyle = spec.color;
    g.fillText(spec.text, W / 2, H * 0.52);
    g.shadowBlur = 0;
    g.fillStyle = '#fff4e8';
    g.fillText(spec.text, W / 2, H * 0.52);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  signCache.set(key, tex);
  return tex;
}

function signMesh(spec, w, h) {
  const key = `sign-${JSON.stringify(spec)}`;
  const mat = material(key, () => makeRetroReflective(new THREE.MeshStandardMaterial({
    map: signTexture(spec),
    roughness: 0.4,
    alphaTest: spec.kind === 'diamond' || spec.kind === 'shield' ? 0.5 : 0,
  }), 2.2, 'retro-sign'));
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.012;
  face.userData.ownGeometry = true;
  const backShape = spec.kind === 'diamond' ? new THREE.PlaneGeometry(w * 0.69, h * 0.69) : new THREE.PlaneGeometry(w * 0.98, h * 0.98);
  const back = new THREE.Mesh(backShape, signBack());
  back.rotation.y = Math.PI;
  if (spec.kind === 'diamond') back.rotation.z = Math.PI / 4;
  back.userData.ownGeometry = true;
  g.add(face, back);
  face.castShadow = true;
  return g;
}

function signPost(height, x = 0) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.05), metal());
  post.position.set(x, height / 2, -0.03);
  post.castShadow = true;
  post.userData.ownGeometry = true;
  return post;
}

function buildSign(entry, road, origin) {
  const obj = new THREE.Group();
  const p = entry.params || {};
  let w = 1.4;
  let h = 0.8;
  let lift = 2.0;
  const spec = p.spec;
  if (spec.kind === 'diamond') { w = 1.0; h = 1.0; lift = 1.9; }
  if (spec.kind === 'green') { w = p.w || 2.4; h = p.h || 1.2; lift = 2.1; }
  if (spec.kind === 'white') { w = p.w || 0.9; h = p.h || 1.15; lift = 1.7; }
  if (spec.kind === 'shield') { w = 0.65; h = 0.7; lift = 2.0; }
  const face = signMesh(spec, w, h);
  face.position.y = lift + h / 2;
  obj.add(face);
  if (w > 1.6) {
    obj.add(signPost(lift + h * 0.8, -w * 0.32), signPost(lift + h * 0.8, w * 0.32));
  } else {
    obj.add(signPost(lift + h * 0.7));
  }
  // Face the oncoming car, angled slightly toward the road.
  place(obj, road, entry.s, entry.d ?? 6.4, origin, -0.12 * Math.sign(entry.d ?? 1));
  return { object: obj, lamps: [] };
}

function lensMaterial(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.3,
  });
}

function buildStreetlight(entry, road, origin) {
  const obj = new THREE.Group();
  const side = Math.sign(entry.d ?? 1);
  const H = 8.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.13, H, 10), metal());
  pole.position.y = H / 2;
  pole.castShadow = true;
  pole.userData.ownGeometry = true;
  obj.add(pole);
  // Arm curving out over the road (toward -side in local X).
  const reach = 2.6;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, H - 0.4, 0),
    new THREE.Vector3(-side * 0.5, H + 0.15, 0),
    new THREE.Vector3(-side * 1.6, H + 0.35, 0),
    new THREE.Vector3(-side * reach, H + 0.38, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 6), metal());
  arm.castShadow = true;
  arm.userData.ownGeometry = true;
  obj.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), darkMetal());
  head.scale.set(0.55, 0.22, 0.32);
  head.position.set(-side * (reach + 0.3), H + 0.36, 0);
  head.castShadow = true;
  head.userData.ownGeometry = true;
  obj.add(head);
  const color = new THREE.Color(entry.params?.color ?? 0xff9a3c);
  const lens = lensMaterial(color, 0);
  const lensMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), lens);
  lensMesh.scale.set(0.46, 0.2, 0.26);
  lensMesh.position.copy(head.position).add(new THREE.Vector3(0, -0.01, 0));
  lensMesh.userData.ownGeometry = true;
  obj.add(lensMesh);

  const wp = place(obj, road, entry.s, entry.d ?? 6.4, origin);
  obj.updateMatrix();
  const lampLocal = new THREE.Vector3(-side * (reach + 0.3), H + 0.2, 0);
  const lampWorld = lampLocal.clone().applyMatrix4(obj.matrix).add(origin);
  const dir = new THREE.Vector3(-side * 0.18, -1, 0).applyEuler(new THREE.Euler(0, wp.fr.theta, 0)).normalize();
  const lamp = {
    kind: 'street',
    pos: lampWorld,
    dir,
    color,
    intensity: entry.params?.intensity ?? 900,
    angle: 1.05,
    penumbra: 0.65,
    range: 32,
    flicker: entry.params?.flicker || 'none',
    seed: Math.floor(entry.s),
    level: 1,
    enabled: true,
    lensMats: [lens],
    lensIntensity: 30,
    id: entry.id,
  };
  return { object: obj, lamps: [lamp] };
}

function buildBeacon(entry, road, origin) {
  const obj = new THREE.Group();
  const side = Math.sign(entry.d ?? 1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.5, 8), metal());
  pole.position.y = 2.75;
  pole.userData.ownGeometry = true;
  pole.castShadow = true;
  obj.add(pole);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.3), new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.6 }));
  housing.position.set(0, 5.6, 0);
  housing.userData.ownGeometry = true;
  obj.add(housing);
  const color = new THREE.Color(0xffa020);
  const lens = lensMaterial(color, 0);
  const lensMesh = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), lens);
  lensMesh.position.set(0, 5.6, 0.16);
  lensMesh.userData.ownGeometry = true;
  obj.add(lensMesh);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12, 1, true, -Math.PI / 2, Math.PI), housing.material);
  visor.rotation.x = Math.PI / 2;
  visor.position.set(0, 5.62, 0.24);
  visor.userData.ownGeometry = true;
  obj.add(visor);
  place(obj, road, entry.s, entry.d ?? 6.6, origin, -0.15 * side);
  obj.updateMatrix();
  const lamp = {
    kind: 'beacon',
    pos: new THREE.Vector3(0, 5.6, 0.25).applyMatrix4(obj.matrix).add(origin),
    dir: new THREE.Vector3(0, -0.3, 1).applyEuler(obj.rotation).normalize(),
    color,
    intensity: 260,
    angle: 1.2,
    penumbra: 0.8,
    range: 40,
    flicker: 'blink',
    seed: 3,
    level: 1,
    enabled: true,
    lensMats: [lens],
    lensIntensity: 40,
    id: entry.id,
  };
  return { object: obj, lamps: [lamp] };
}

function buildPoleLine(entry, road, origin) {
  // A run of wooden utility poles every `spacing` metres with sagging wires.
  const obj = new THREE.Group();
  const { count = 3, spacing = 46, d = 8.2 } = entry.params || {};
  const tops = [];
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 9.5, 7);
  poleGeo.translate(0, 4.75, 0);
  const armGeo = new THREE.BoxGeometry(1.9, 0.1, 0.1);
  for (let k = 0; k <= count; k++) {
    const s = entry.s + k * spacing;
    const fr = road.sample(s, _f);
    const x = fr.x + fr.rx * d;
    const z = fr.z + fr.rz * d;
    const i = Math.max(0, Math.min(road.n - 1, Math.round(s / ROAD.ds)));
    const y = road.surfaceY(i, d, x, z);
    const top = [];
    for (const off of [-0.8, 0, 0.8]) {
      top.push(new THREE.Vector3(x + fr.rx * off, y + 9.05 + (off === 0 ? 0.25 : 0), z + fr.rz * off));
    }
    tops.push(top);
    if (k === count) break; // the last pole belongs to the next run
    const pole = new THREE.Mesh(poleGeo, wood());
    pole.position.set(x - origin.x, y - origin.y - 0.2, z - origin.z);
    pole.rotation.set(0.02 * Math.sin(s), fr.theta, 0.03 * Math.cos(s));
    pole.castShadow = true;
    obj.add(pole);
    const arm = new THREE.Mesh(armGeo, wood());
    arm.position.set(x - origin.x, y - origin.y + 8.9, z - origin.z);
    arm.rotation.y = fr.theta;
    obj.add(arm);
  }
  const wireMat = material('wire', () => new THREE.MeshBasicMaterial({ color: 0x050607 }));
  for (let k = 0; k < tops.length - 1; k++) {
    for (let w = 0; w < 3; w++) {
      const a = tops[k][w];
      const b = tops[k + 1][w];
      const pts = [];
      for (let t = 0; t <= 12; t++) {
        const u = t / 12;
        const p = a.clone().lerp(b, u);
        p.y -= Math.sin(u * Math.PI) * 0.9;
        pts.push(p.sub(origin));
      }
      const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.018, 3), wireMat);
      wire.userData.ownGeometry = true;
      obj.add(wire);
    }
  }
  return { object: obj, lamps: [] };
}

function buildCabin(entry, road, origin) {
  const obj = new THREE.Group();
  const rng = new RNG(entry.s | 0);
  const wallMat = material('cabinWall', () => new THREE.MeshStandardMaterial({ color: 0x3b3229, roughness: 0.9 }));
  const roofMat = material('cabinRoof', () => new THREE.MeshStandardMaterial({ color: 0x1f1c1a, roughness: 0.8 }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 5.5), wallMat);
  body.position.y = 1.6;
  body.castShadow = true;
  body.userData.ownGeometry = true;
  obj.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4.6, 2.2, 4, 1), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.9);
  roof.position.y = 4.3;
  roof.userData.ownGeometry = true;
  obj.add(roof);
  const color = new THREE.Color(0xffb060);
  const lens = lensMaterial(color, 0);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), lens);
  win.position.set(rng.range(-1.5, 1.5), 1.8, 2.76);
  win.userData.ownGeometry = true;
  obj.add(win);
  const fr = place(obj, road, entry.s, entry.d ?? -42, origin, Math.PI * 0.5 * Math.sign(entry.d ?? -1) + 0.3);
  obj.updateMatrix();
  const lamp = {
    kind: 'window',
    pos: win.position.clone().add(new THREE.Vector3(0, 0, 0.6)).applyMatrix4(obj.matrix).add(origin),
    dir: new THREE.Vector3(0, 0, 1).applyEuler(obj.rotation),
    color,
    intensity: 30,
    angle: 1.3,
    penumbra: 1,
    range: 14,
    flicker: 'none',
    seed: 9,
    level: 1,
    enabled: true,
    lensMats: [lens],
    lensIntensity: 6,
    id: entry.id,
    fogOnly: true,
  };
  void fr;
  return { object: obj, lamps: [lamp] };
}

function buildGasStation(entry, road, origin) {
  const obj = new THREE.Group();
  const lamps = [];
  const side = Math.sign(entry.d ?? 1);
  const off = (entry.d ?? 15) - side * 0; // distance of the forecourt centre from the road centreline
  const concrete = material('concrete', () => new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.55 }));
  const white = material('stationWhite', () => new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.6 }));
  const red = material('stationRed', () => new THREE.MeshStandardMaterial({ color: 0x8a1c18, roughness: 0.5 }));
  const lot = new THREE.Mesh(new THREE.BoxGeometry(34, 0.2, 26), concrete);
  lot.position.set(0, 0.0, 0);
  lot.receiveShadow = true;
  lot.userData.ownGeometry = true;
  obj.add(lot);
  // Canopy on four pillars.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 10), white);
  canopy.position.set(0, 5.4, 0);
  canopy.castShadow = true;
  canopy.userData.ownGeometry = true;
  obj.add(canopy);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(16.05, 0.3, 10.05), red);
  stripe.position.set(0, 5.55, 0);
  stripe.userData.ownGeometry = true;
  obj.add(stripe);
  for (const px of [-6, 6]) {
    for (const pz of [-3.2, 3.2]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), white);
      pil.position.set(px, 2.5, pz);
      pil.castShadow = true;
      pil.userData.ownGeometry = true;
      obj.add(pil);
    }
  }
  const panelColor = new THREE.Color(0xdfeaff);
  const panelMat = lensMaterial(panelColor, 0);
  for (const px of [-4.5, 0, 4.5]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), panelMat);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(px, 4.94, 0);
    panel.userData.ownGeometry = true;
    obj.add(panel);
  }
  // Pumps.
  const pumpMat = material('pump', () => new THREE.MeshStandardMaterial({ color: 0xb8b8b2, roughness: 0.4 }));
  const screenMat = lensMaterial(new THREE.Color(0x7dffb0), 0);
  for (const px of [-3, 3]) {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.6), pumpMat);
    pump.position.set(px, 0.9, 0);
    pump.castShadow = true;
    pump.userData.ownGeometry = true;
    obj.add(pump);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), screenMat);
    scr.position.set(px, 1.4, 0.31);
    scr.userData.ownGeometry = true;
    obj.add(scr);
  }
  // Store with lit windows and a neon OPEN sign.
  const store = new THREE.Mesh(new THREE.BoxGeometry(12, 3.6, 7), white);
  store.position.set(side * 0, 1.8, side * -10.5);
  store.castShadow = true;
  store.userData.ownGeometry = true;
  obj.add(store);
  const winMat = lensMaterial(new THREE.Color(0xfff0d0), 0);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.8), winMat);
  win.position.set(0, 1.6, side * -10.5 + 3.51 * side);
  if (side < 0) win.rotation.y = Math.PI;
  win.userData.ownGeometry = true;
  obj.add(win);
  const neonMat = new THREE.MeshBasicMaterial({ map: signTexture({ kind: 'neon', text: 'OPEN', color: '#ff3b5c', w: 256, h: 96 }), toneMapped: false });
  neonMat.color.setScalar(4);
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), neonMat);
  neon.position.set(3.2, 2.7, side * -10.5 + 3.53 * side);
  if (side < 0) neon.rotation.y = Math.PI;
  neon.userData.ownGeometry = true;
  obj.add(neon);
  // Tall price sign.
  const signPole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), metal());
  signPole.position.set(-side * 0 + 9, 4.5, 6);
  signPole.userData.ownGeometry = true;
  obj.add(signPole);
  const signBoxMat = lensMaterial(new THREE.Color(0xffe6b0), 0);
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.4), signBoxMat);
  signBox.position.set(9, 9.4, 6);
  signBox.userData.ownGeometry = true;
  obj.add(signBox);

  const wp = place(obj, road, entry.s, off, origin, 0);
  obj.updateMatrix();
  const toWorld = (v) => v.clone().applyMatrix4(obj.matrix).add(origin);
  for (const px of [-4.5, 4.5]) {
    lamps.push({
      kind: 'station',
      pos: toWorld(new THREE.Vector3(px, 4.85, 0)),
      dir: new THREE.Vector3(0, -1, 0),
      color: panelColor,
      intensity: 1800,
      angle: 1.2,
      penumbra: 0.7,
      range: 40,
      flicker: 'none',
      seed: px,
      level: 1,
      enabled: true,
      lensMats: px < 0 ? [panelMat, screenMat, winMat, signBoxMat] : [],
      lensIntensity: 18,
      id: px < 0 ? entry.id : undefined,
    });
  }
  void wp;
  return { object: obj, lamps };
}

const builders = {
  sign: buildSign,
  streetlight: buildStreetlight,
  beacon: buildBeacon,
  poles: buildPoleLine,
  cabin: buildCabin,
  station: buildGasStation,
};

export function buildProp(entry, road, origin) {
  const fn = builders[entry.type];
  if (!fn) return null;
  const built = fn(entry, road, origin);
  built.object.traverse((o) => {
    if (o.isMesh) {
      o.receiveShadow = true;
      if (o.geometry && !o.userData.sharedGeometry) o.userData.ownGeometry = o.userData.ownGeometry ?? false;
    }
  });
  if (entry.id) {
    built.object.name = entry.id;
    entry.object = built.object;
    entry.lamps = built.lamps;
  }
  return built;
}

// Toy-like characters with round heads and big friendly eyes.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './lib/util.js';

const toy = (color, rough = 0.55, extra = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: rough, metalness: 0, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), ...extra });

function mesh(geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const group = (parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g); return g;
};

// Eye: white ball, coloured iris, pupil and a highlight; faces +x.
function buildEye(parent, pos, r, iris = 0x4a2a14) {
  const eye = group(parent, pos);
  const white = mesh(new THREE.SphereGeometry(r, 24, 16), toy(0xffffff, 0.25, { clearcoat: 1, clearcoatRoughness: 0.08 }), eye, [0, 0, 0], [0, 0, 0], [0.75, 1.0, 1.0]);
  const pupilG = group(eye, [0, 0, 0]);
  mesh(new THREE.SphereGeometry(r * 0.56, 20, 12), toy(iris, 0.3), pupilG, [r * 0.55, 0, 0], [0, 0, 0], [0.45, 1, 1]);
  mesh(new THREE.SphereGeometry(r * 0.32, 16, 10), toy(0x050505, 0.2), pupilG, [r * 0.72, 0, 0], [0, 0, 0], [0.4, 1, 1]);
  const hl = mesh(new THREE.SphereGeometry(r * 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), pupilG, [r * 0.8, r * 0.22, -r * 0.18]);
  hl.castShadow = false;
  // eyelid for blinking (skin coloured cap, scaled 0..1)
  return { eye, white, pupilG };
}

// ---------------------------------------------------------------- John
export function buildJohn() {
  const skin = toy(0xd9a27b, 0.6);
  const hoodie = toy(0xd42a2a, 0.75);
  const hoodieDark = toy(0xa51e1e, 0.8);
  const hair = toy(0x5a3418, 0.7);
  const pants = toy(0x2b3a55, 0.8);
  const root = new THREE.Group(); root.name = 'john';
  // root sits on the seat (car space): hips at origin, facing +x.
  const body = group(root, [0, 0, 0]);          // leans / turns
  mesh(new THREE.CapsuleGeometry(0.12, 0.2, 6, 16), hoodie, body, [-0.03, 0.2, 0], [0, 0, 0.28]);
  mesh(new THREE.TorusGeometry(0.085, 0.035, 10, 20), hoodieDark, body, [-0.08, 0.36, 0], [Math.PI / 2, 0.3, 0]);
  for (const z of [-0.035, 0.035]) mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), toy(0xffffff, 0.6), body, [0.06, 0.28, z], [0, 0, 0.2]);
  // legs (mostly hidden in the footwell)
  for (const z of [-0.07, 0.07]) {
    mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 10), pants, body, [0.18, 0.02, z], [0, 0, Math.PI / 2 - 0.1]);
    mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), pants, body, [0.34, -0.12, z], [0, 0, 0.3]);
  }
  // head
  const neck = group(body, [-0.05, 0.38, 0]);
  const head = group(neck, [0.02, 0.15, 0]);
  const R = 0.158;
  mesh(new THREE.SphereGeometry(R, 32, 24), skin, head);
  for (const z of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 12, 8), skin, head, [-0.01, 0, z * R * 0.98]);
  mesh(new THREE.SphereGeometry(0.022, 12, 8), skin, head, [R * 0.98, -0.02, 0]); // nose
  const eyes = [buildEye(head, [R * 0.84, 0.035, -0.058], 0.047), buildEye(head, [R * 0.84, 0.035, 0.058], 0.047)];
  // eyebrows
  const brows = [];
  for (const z of [-0.055, 0.055]) brows.push(mesh(new THREE.CapsuleGeometry(0.007, 0.04, 3, 6), hair, head, [R * 0.9, 0.095, z], [Math.PI / 2, 0, 0]));
  // mouth: smile arc + an open mouth for talking
  const smileCurve = new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((u) =>
    new THREE.Vector3(0, -0.012 * (1 - u * u) * 1.6 + 0.004 * u * u, u * 0.045)));
  const smile = mesh(new THREE.TubeGeometry(smileCurve, 16, 0.0065, 6, false), toy(0x5a1a1a, 0.5), head, [R * 0.955, -0.062, 0]);
  const mouthOpen = mesh(new THREE.SphereGeometry(0.03, 16, 10), toy(0x5a1414, 0.5), head, [R * 0.92, -0.055, 0], [0, 0, 0], [0.35, 0.6, 1]);
  mouthOpen.visible = false;
  // cheeks (blush rises with heat)
  const cheekMat = toy(0xff6b6b, 0.6, { transparent: true, opacity: 0.0 });
  for (const z of [-0.085, 0.085]) mesh(new THREE.SphereGeometry(0.03, 12, 8), cheekMat, head, [R * 0.78, -0.02, z], [0, 0, 0], [0.4, 0.7, 1]);
  // messy hair: blobs and tufts on top and back
  const tufts = [[0.0, 0.12, 0.0, 0.07], [0.05, 0.115, -0.05, 0.055], [0.05, 0.11, 0.06, 0.055], [-0.06, 0.1, -0.06, 0.065], [-0.06, 0.1, 0.06, 0.065],
    [-0.1, 0.05, 0.0, 0.07], [0.08, 0.09, 0.0, 0.05], [-0.03, 0.13, 0.03, 0.05], [0.0, 0.08, -0.1, 0.05], [0.0, 0.08, 0.1, 0.05]];
  for (const [x, y, z, r] of tufts) mesh(new THREE.SphereGeometry(r * 1.1, 14, 10), hair, head, [x * 1.12, y * 1.12, z * 1.12]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    mesh(new THREE.ConeGeometry(0.032, 0.1, 8), hair, head, [Math.cos(a) * 0.07 - 0.02, 0.168, Math.sin(a) * 0.09],
      [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.5 - 0.3]);
  }
  // racing goggles: thick leather strap, deep bronze cups, lightly tinted lenses (eyes stay visible)
  const goggles = group(head, [0, 0.035, 0]);
  const leather = toy(0x6b3f22, 0.7);
  mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.04, 40, 1, true), leather, goggles, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xb87a3a, metalness: 0.9, roughness: 0.3 });
  const cupMat = toy(0x3a2416, 0.6);
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffd9a0, roughness: 0.04, transparent: true, opacity: 0.22,
    envMapIntensity: 2.0, clearcoat: 1, depthWrite: false });
  for (const z of [-0.058, 0.058]) {
    const cup = mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.045, 24, 1, true), cupMat, goggles, [R * 0.86, 0, z], [0, 0, Math.PI / 2]);
    cup.material.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(0.052, 0.01, 8, 24), frameMat, goggles, [R * 0.86 + 0.024, 0, z], [0, Math.PI / 2, 0]);
    const lens = mesh(new THREE.CircleGeometry(0.05, 24), lensMat, goggles, [R * 0.86 + 0.026, 0, z], [0, Math.PI / 2, 0]);
    lens.castShadow = false;
  }
  mesh(new THREE.BoxGeometry(0.03, 0.018, 0.03), frameMat, goggles, [R * 0.96, 0, 0]);
  // arms: shoulder -> elbow -> hand (left arm = near the camera, -z)
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = group(body, [-0.06, 0.3, side * 0.125]);
    mesh(new THREE.CapsuleGeometry(0.036, 0.11, 4, 10), hoodie, sh, [0, -0.07, 0]);
    const el = group(sh, [0, -0.14, 0]);
    mesh(new THREE.CapsuleGeometry(0.032, 0.1, 4, 10), hoodie, el, [0, -0.06, 0]);
    const hand = group(el, [0, -0.14, 0]);
    mesh(new THREE.SphereGeometry(0.04, 14, 10), skin, hand);
    const thumb = group(hand, [0.0, 0.02, -side * 0.03]);
    mesh(new THREE.CapsuleGeometry(0.014, 0.035, 3, 8), skin, thumb, [0, 0.025, 0]);
    arms.push({ sh, el, hand, thumb, side });
  }
  // sweat drops (positions animated)
  const sweatMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 });
  const sweat = [];
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.SphereGeometry(0.016, 12, 8), sweatMat, head, [0, 0, 0], [0, 0, 0], [1, 1.4, 1]);
    d.visible = false; d.castShadow = false;
    sweat.push(d);
  }
  // dizzy stars that circle the head
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: new THREE.Color(1.0, 0.8, 0.2), emissiveIntensity: 1.6, roughness: 0.4 });
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.018 : 0.045; const p = [Math.cos(a) * r, Math.sin(a) * r]; i ? starShape.lineTo(...p) : starShape.moveTo(...p); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  starGeo.center();
  const stars = group(head, [0, 0.21, 0]);
  const starList = [];
  for (let i = 0; i < 4; i++) { const s = mesh(starGeo, starMat, stars); s.castShadow = false; starList.push(s); }
  stars.visible = false;

  const api = {
    root, body, neck, head, eyes, brows, smile, mouthOpen, cheekMat, goggles, arms, sweat, stars, starList,
    // Apply a pose; every field optional. Angles in radians.
    pose(p) {
      body.rotation.set(p.bodyRoll ?? 0, p.bodyTurn ?? 0, p.bodyLean ?? 0);
      body.position.set(p.bodyX ?? 0, p.bodyY ?? 0, p.bodyZ ?? 0);
      neck.rotation.set(p.headTilt ?? 0, p.headTurn ?? 0, p.headNod ?? 0);
      goggles.rotation.set(p.goggleTilt ?? 0, 0, p.goggleSlip ?? 0);
      goggles.position.y = 0.035 + (p.goggleUp ?? 0);
      const blink = p.blink ?? 0;
      for (const e of eyes) {
        e.white.scale.set(0.75, Math.max(0.08, 1 - blink), 1);
        e.pupilG.visible = blink < 0.6;
        e.pupilG.rotation.set(p.eyeRoll ?? 0, p.lookSide ?? 0, p.lookUp ?? 0);
      }
      const brow = p.brow ?? 0; // -1 worried, +1 raised
      brows.forEach((b, i) => { b.position.y = 0.095 + brow * 0.012; b.rotation.y = (i ? 1 : -1) * brow * 0.25; });
      const talk = p.talk ?? 0;
      mouthOpen.visible = talk > 0.05;
      mouthOpen.scale.set(0.35, 0.25 + talk * 0.7, 1);
      smile.visible = talk <= 0.05;
      smile.scale.setScalar(p.smile ?? 1);
      cheekMat.opacity = clamp(p.blush ?? 0);
      // arms: [shoulder pitch, shoulder swing, elbow] for left (near) and right
      const A = [p.armL ?? [1.2, -0.3, -1.1], p.armR ?? [1.2, 0.3, -1.1]];
      arms.forEach((a, i) => {
        const [pitch, swing, elbow] = A[i];
        a.sh.rotation.set(swing, 0, pitch);
        a.el.rotation.set(0, 0, elbow);
        a.thumb.rotation.set(0, 0, i === 0 ? (p.thumbL ?? 0) : 0);
        if (i === 0 && p.handL) a.hand.rotation.set(...p.handL); else a.hand.rotation.set(0, 0, 0);
      });
      // sweat drops
      const sw = p.sweat ?? 0;
      sweat.forEach((d, i) => {
        const ph = ((p.time ?? 0) * 0.9 + i * 0.27) % 1;
        d.visible = sw > 0.05 && ph < 0.85;
        const ang = (i - 1.5) * 0.5;
        d.position.set(0.06 + Math.cos(ang) * 0.02, 0.1 - ph * 0.12, Math.sin(ang) * 0.13 * (i % 2 ? 1 : -1));
        d.scale.setScalar(sw * (0.8 + 0.4 * (1 - ph)));
      });
      // stars
      stars.visible = (p.dizzy ?? 0) > 0.05;
      starList.forEach((s, i) => {
        const a = (p.time ?? 0) * 4.0 + (i / starList.length) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.19, Math.sin(a * 2) * 0.015, Math.sin(a) * 0.19);
        s.rotation.set(0, -a, a * 0.5);
        s.scale.setScalar(p.dizzy ?? 0);
      });
    },
  };
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return api;
}

// ---------------------------------------------------------------- tourist
function flowerShirtTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1aa39a'; g.fillRect(0, 0, 512, 512);
  let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const leaf = (x, y, a, s) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#0d6e5c';
    g.beginPath(); g.ellipse(0, 0, 26 * s, 9 * s, 0, 0, Math.PI * 2); g.fill(); g.restore(); };
  const flower = (x, y, s, col) => {
    g.save(); g.translate(x, y);
    for (let k = 0; k < 5; k++) { g.rotate((Math.PI * 2) / 5); g.fillStyle = col; g.beginPath(); g.ellipse(0, -18 * s, 11 * s, 18 * s, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 6 * s, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  for (let i = 0; i < 26; i++) leaf(r() * 512, r() * 512, r() * 6.28, 0.8 + r() * 0.6);
  const cols = ['#ffffff', '#ff6f91', '#ffb347', '#ffffff', '#ff4d6d'];
  for (let i = 0; i < 22; i++) {
    const x = r() * 512, y = r() * 512, s = 0.8 + r() * 0.7, col = cols[i % cols.length];
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) flower(x + dx, y + dy, s, col);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  t.anisotropy = 8;
  return t;
}
function waffleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d99a4e'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#a8692a'; g.lineWidth = 7;
  for (let i = -256; i < 512; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return t;
}

export function buildTourist() {
  const skin = toy(0x9a6644, 0.6);
  const shirt = toy(0xffffff, 0.7, { map: flowerShirtTexture() });
  const shorts = toy(0xc8b48a, 0.8);
  const straw = toy(0xe8cf8a, 0.85);
  const ribbon = toy(0xff6f61, 0.6);
  const root = new THREE.Group(); root.name = 'tourist';
  const body = group(root, [0, 0, 0]);
  // legs + sandals
  for (const z of [-0.09, 0.09]) {
    mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 10), skin, body, [0, 0.22, z]);
    mesh(new THREE.BoxGeometry(0.2, 0.03, 0.1), toy(0x3b6ea8, 0.6), body, [0.04, 0.015, z]);
  }
  mesh(new THREE.CapsuleGeometry(0.16, 0.08, 6, 16), shorts, body, [0, 0.5, 0], [0, 0, 0], [1, 1, 1.15]);
  const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.26, 8, 20), shirt, body, [0, 0.74, 0], [0, 0, 0], [1, 1, 1.12]);
  // collar
  mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20), shirt, body, [0, 0.97, 0], [Math.PI / 2, 0, 0]);
  const neck = group(body, [0, 1.0, 0]);
  const head = group(neck, [0, 0.19, 0]);
  const R = 0.2;
  mesh(new THREE.SphereGeometry(R, 32, 24), skin, head);
  for (const z of [-1, 1]) mesh(new THREE.SphereGeometry(0.045, 12, 8), skin, head, [-0.01, -0.01, z * R * 0.98]);
  mesh(new THREE.SphereGeometry(0.03, 12, 8), skin, head, [R * 0.98, -0.03, 0]);
  const eyes = [buildEye(head, [R * 0.82, 0.04, -0.072], 0.058, 0x3a2410), buildEye(head, [R * 0.82, 0.04, 0.072], 0.058, 0x3a2410)];
  const brows = [];
  for (const z of [-0.075, 0.075]) brows.push(mesh(new THREE.CapsuleGeometry(0.009, 0.05, 3, 6), toy(0x2a1a10, 0.6), head, [R * 0.88, 0.125, z], [Math.PI / 2, 0, 0]));
  const smile = mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 16, Math.PI), toy(0x5a1414, 0.5), head, [R * 0.93, -0.075, 0], [0, Math.PI / 2, Math.PI]);
  const mouthO = mesh(new THREE.SphereGeometry(0.035, 16, 10), toy(0x4a1010, 0.5), head, [R * 0.92, -0.08, 0], [0, 0, 0], [0.4, 1, 0.8]);
  mouthO.visible = false;
  // sun hat: brim + crown + ribbon
  const hat = group(head, [0, 0.13, 0], [0, 0, -0.08]);
  mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.018, 48), straw, hat, [0, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.15, 32), straw, hat, [0, 0.08, 0]);
  mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw, hat, [0, 0.15, 0], [0, 0, 0], [1, 0.4, 1]);
  mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.04, 32, 1, true), ribbon, hat, [0, 0.03, 0]);
  // arms: right hand holds the cone up near the face
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = group(body, [0, 0.9, side * 0.2]);
    mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 10), shirt, sh, [0, -0.09, 0]);
    const el = group(sh, [0, -0.19, 0]);
    mesh(new THREE.CapsuleGeometry(0.048, 0.14, 4, 10), skin, el, [0, -0.08, 0]);
    const hand = group(el, [0, -0.18, 0]);
    mesh(new THREE.SphereGeometry(0.055, 14, 10), skin, hand);
    arms.push({ sh, el, hand, side });
  }
  // ice cream cone in the right hand (+z side)
  const cone = group(arms[1].hand, [0.03, 0.03, 0]);
  const coneGeo = new THREE.ConeGeometry(0.06, 0.2, 24, 1, true); coneGeo.rotateZ(Math.PI); coneGeo.translate(0, 0.1, 0);
  mesh(coneGeo, toy(0xffffff, 0.85, { map: waffleTexture(), side: THREE.DoubleSide }), cone, [0, 0, 0]);
  const scoopMat = toy(0xff9ec4, 0.45, { clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const scoop = mesh(new THREE.SphereGeometry(0.075, 24, 16), scoopMat, cone, [0, 0.215, 0]);
  const drip = mesh(new THREE.SphereGeometry(0.03, 12, 8), scoopMat, scoop, [0.04, -0.05, 0.03]);
  void drip;
  // splat on the sand (shown after the plop)
  const splat = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), scoopMat);
  splat.scale.set(1, 0.35, 1); splat.visible = false; splat.castShadow = true;
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    root, body, head, neck, eyes, brows, smile, mouthO, hat, arms, cone, scoop, splat, scoopMat,
    pose(p) {
      body.rotation.set(0, p.turn ?? 0, p.lean ?? 0);
      neck.rotation.set(p.headTilt ?? 0, p.headTurn ?? 0, p.headNod ?? 0);
      hat.rotation.set(p.hatTilt ?? 0, 0, -0.08 + (p.hatLift ?? 0));
      hat.position.y = 0.13 + (p.hatHop ?? 0);
      const blink = p.blink ?? 0;
      for (const e of eyes) { e.white.scale.set(0.75, Math.max(0.08, (1 - blink) * (p.eyeWide ?? 1)), (p.eyeWide ?? 1)); e.pupilG.visible = blink < 0.6;
        e.pupilG.rotation.set(0, p.lookSide ?? 0, p.lookUp ?? 0); }
      brows.forEach((b) => { b.position.y = 0.125 + (p.brow ?? 0) * 0.02; });
      mouthO.visible = (p.surprise ?? 0) > 0.3; smile.visible = !mouthO.visible;
      mouthO.scale.set(0.4, 0.6 + (p.surprise ?? 0) * 0.5, 0.8);
      const A = [p.armL ?? [0.15, -0.15, -0.2], p.armR ?? [1.9, 0.25, -2.0]];
      arms.forEach((a, i) => { const [pitch, swing, elbow] = A[i]; a.sh.rotation.set(swing * (a.side), 0, pitch); a.el.rotation.set(0, 0, elbow); });
    },
  };
}

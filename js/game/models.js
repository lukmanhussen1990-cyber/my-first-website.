// Models used by scripted events: an exterior sedan (abandoned or passing
// cars), the tall figure, and glowing sprites.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glowSprite } from '../core/textures.js';

const rbox = (w, h, d, r, mat) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export function glow(color, size, intensity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowSprite(),
    color: new THREE.Color(color).multiplyScalar(intensity),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

/**
 * Sedan seen from outside. Returns { group, setHeadlights(on), setHazard(level),
 * setDome(on), setTail(level) } with local -Z forward and origin on the ground.
 */
export function createCarModel({ paint = 0x5a1c1a, envMap = null, doorOpen = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.32, metalness: 0.55, envMap, envMapIntensity: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.05, metalness: 0.2, envMap, envMapIntensity: 1.2, emissive: 0xffc070, emissiveIntensity: 0 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.2, metalness: 1, envMap });

  const lower = rbox(1.8, 0.62, 4.6, 0.16, body);
  lower.position.y = 0.58;
  group.add(lower);
  const hood = rbox(1.72, 0.12, 1.3, 0.06, body);
  hood.position.set(0, 0.88, -1.55);
  hood.rotation.x = 0.06;
  group.add(hood);
  const cabin = rbox(1.56, 0.5, 2.35, 0.2, glass);
  cabin.position.set(0, 1.12, 0.15);
  group.add(cabin);
  const roof = rbox(1.5, 0.08, 1.7, 0.06, body);
  roof.position.set(0, 1.38, 0.2);
  group.add(roof);
  for (const s of [-1, 1]) {
    const pillar = rbox(0.06, 0.48, 0.12, 0.02, body);
    pillar.position.set(s * 0.76, 1.12, 0.15);
    group.add(pillar);
  }
  for (const [x, z] of [[-0.82, -1.45], [0.82, -1.45], [-0.82, 1.45], [0.82, 1.45]]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20), dark);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(x, 0.34, z);
    tyre.castShadow = true;
    group.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16), chrome);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x * 1.01, 0.34, z);
    group.add(rim);
  }
  const bumperF = rbox(1.82, 0.2, 0.18, 0.06, dark);
  bumperF.position.set(0, 0.38, -2.3);
  const bumperR = bumperF.clone();
  bumperR.position.z = 2.3;
  group.add(bumperF, bumperR);

  const lamp = (color, w, h) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0, roughness: 0.3 });
  const headMat = lamp(0xfff2dd);
  const tailMat = lamp(0xff1408);
  const hazMat = lamp(0xff8a10);
  for (const s of [-1, 1]) {
    const h = rbox(0.42, 0.14, 0.06, 0.03, headMat);
    h.position.set(s * 0.6, 0.74, -2.31);
    const t = rbox(0.4, 0.13, 0.05, 0.03, tailMat);
    t.position.set(s * 0.62, 0.78, 2.31);
    const hf = rbox(0.14, 0.08, 0.05, 0.02, hazMat);
    hf.position.set(s * 0.84, 0.66, -2.28);
    const hr = rbox(0.14, 0.08, 0.05, 0.02, hazMat);
    hr.position.set(s * 0.84, 0.66, 2.29);
    group.add(h, t, hf, hr);
  }
  let door = null;
  if (doorOpen) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.9, 0.0, -0.45);
    pivot.rotation.y = -1.0;
    door = rbox(0.08, 0.62, 1.1, 0.04, body);
    door.position.set(0, 0.6, 0.55);
    const win = rbox(0.04, 0.4, 0.9, 0.03, glass);
    win.position.set(0, 1.05, 0.55);
    pivot.add(door, win);
    group.add(pivot);
  }
  // Interior dome glow seen through the glass.
  const domeLight = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.9),
    new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  domeLight.position.set(0, 1.1, 0.15);
  group.add(domeLight);

  group.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return {
    group,
    setHeadlights(level) { headMat.emissiveIntensity = 40 * level; },
    setTail(level) { tailMat.emissiveIntensity = 12 * level; },
    setHazard(level) { hazMat.emissiveIntensity = 30 * level; },
    setDome(level) {
      glass.emissiveIntensity = 0.05 * level;
      domeLight.material.opacity = 0.12 * level;
    },
  };
}

/**
 * The tall figure: long coat, too-long arms, pale face with dark eye hollows.
 * Origin at the feet, facing -Z. `pale` = false gives an all-dark silhouette.
 */
export function createFigure({ pale = true, height = 2.05 } = {}) {
  const k = height / 2.05;
  const group = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: pale ? 0x2b2a28 : 0x050505, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pale ? 0xb9b3a8 : 0x070707, roughness: 0.75 });
  const hollow = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });
  const prof = [
    [0.001, 0.32], [0.29, 0.32], [0.26, 0.6], [0.21, 0.95], [0.19, 1.2], [0.22, 1.45], [0.25, 1.58],
    [0.22, 1.66], [0.1, 1.7], [0.001, 1.71],
  ].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), coat);
  body.scale.z = 0.62;
  body.castShadow = true;
  group.add(body);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * k, 0.3 * k, 4, 8), coat);
    leg.position.set(s * 0.09 * k, 0.2 * k, 0);
    leg.castShadow = true;
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * k, 0.78 * k, 4, 8), coat);
    arm.position.set(s * 0.29 * k, 1.18 * k, 0.02);
    arm.rotation.z = s * 0.05;
    arm.castShadow = true;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.035 * k, 0.12 * k, 4, 8), skin);
    hand.position.set(s * 0.31 * k, 0.7 * k, 0.02);
    group.add(hand);
  }
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.78 * k, 0);
  group.add(headPivot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * k, 0.05 * k, 0.16 * k, 10), skin);
  neck.position.y = -0.04 * k;
  headPivot.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), skin);
  head.scale.set(0.095 * k, 0.135 * k, 0.11 * k);
  head.position.y = 0.1 * k;
  head.castShadow = true;
  headPivot.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022 * k, 10, 8), hollow);
    eye.scale.set(1, 0.7, 0.5);
    eye.position.set(s * 0.035 * k, 0.12 * k, -0.098 * k);
    headPivot.add(eye);
  }
  group.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return { group, headPivot };
}

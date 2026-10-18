// World test scene: the full environment with capsule stand-ins for scale.
// params: shot = wide | medium | reverse | aerial | closeup_seat | hook | establish | sword | final | golden
//         mood = 0..1, wind = 0..1, stand = 1 (proxies standing at the ending spots instead of seated),
//         proxies = 0 (hide), or a free camera: cx,cy,cz,lx,ly,lz,fov (overrides `shot`).
import * as THREE from 'three';
import { buildWorld } from '../world/environment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const SHOTS = {
  wide: { p: [3.2, 1.7, 10.5], l: [0, 0.7, 0], fov: 40, focus: [V(0.3, 0.5, 0.2), 6] },
  medium: { p: [0.2, 1.25, 3.6], l: [0.1, 0.9, 0], fov: 35, focus: [V(0.1, 0.6, 0.1), 3] },
  reverse: { p: [0.0, 1.6, -3.2], l: [2, 1.2, 40], fov: 45, focus: [V(0, 0.6, 0.3), 4] },
  aerial: { p: [-6, 7, 12], l: [0, 0, 0], fov: 40, focus: [V(0, 0.5, 0), 8] },
  closeup_seat: { p: [-0.3, 1.2, 1.6], l: [-0.55, 0.8, 0], fov: 35, focus: [V(-0.5, 0.6, 0.1), 2] },
  // film-like extras (from src/film.js shot list)
  hook: { p: [0.85, 0.42, 5.0], l: [-0.48, 0.92, 0.05], fov: 34, focus: [V(-0.3, 0.5, 0.3), 3] },
  establish: { p: [5.2, 3.2, 12.5], l: [0.9, 0.5, 0.2], fov: 40, focus: [V(1.4, 0.5, 0.4), 6] },
  sword: { p: [0.05, 0.32, 2.05], l: [-0.62, 0.52, 0.42], fov: 40, focus: [V(-0.5, 0.4, 0.5), 2] },
  golden: { p: [1.75, 0.95, 4.0], l: [-0.08, 1.12, 0.6], fov: 36, focus: [V(0, 0.8, 0.6), 2.5] },
  final: { p: [0.5, 1.85, -2.5], l: [-0.2, 1.3, 11], fov: 42, focus: [V(0, 0.8, 0.8), 3] },
  side: { p: [1.42, 1.38, -0.38], l: [-0.62, 1.12, 0.38], fov: 34, focus: [V(0.1, 0.8, 0.1), 2.5] },
  side2: { p: [-1.02, 1.42, -0.32], l: [0.78, 1.24, 0.15], fov: 33, focus: [V(0.1, 0.8, 0.1), 2.5] },
};

function proxy(color, seated) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: color === 0x555a60 ? 0.6 : 0 });
  const add = (geo, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  if (seated) {
    add(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), 0, 0.5 + 0.43, 0);          // torso
    add(new THREE.SphereGeometry(0.12, 12, 8), 0, 1.45, 0.02);                     // head
    for (const sx of [-0.1, 0.1]) {
      add(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), sx, 0.5, 0.2, Math.PI / 2); // thigh
      add(new THREE.CapsuleGeometry(0.065, 0.36, 4, 8), sx, 0.27, 0.42);           // shin
    }
  } else {
    add(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), 0, 1.25, 0);
    add(new THREE.SphereGeometry(0.12, 12, 8), 0, 1.78, 0.02);
    for (const sx of [-0.1, 0.1]) add(new THREE.CapsuleGeometry(0.075, 0.78, 4, 8), sx, 0.47, 0);
  }
  return g;
}

export async function build(stage, params) {
  const world = buildWorld(stage);
  const { scene, camera } = stage;
  const kSeat = proxy(0x555a60, true), jSeat = proxy(0xeee4cc, true);
  kSeat.position.set(world.seats.knight.x, world.seats.knight.y - 0.5, world.seats.knight.z + 0.06);
  kSeat.rotation.y = 14 * Math.PI / 180;
  jSeat.position.set(world.seats.jesus.x, world.seats.jesus.y - 0.5, world.seats.jesus.z + 0.06);
  jSeat.rotation.y = -38 * Math.PI / 180;
  const kStand = proxy(0x555a60, false), jStand = proxy(0xeee4cc, false);
  kStand.position.set(-0.45, 0, 0.55); jStand.position.set(0.35, 0, 0.6);
  scene.add(kSeat, jSeat, kStand, jStand);
  // A sword stand-in (tip on the grass) so the sword shot reads.
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.01), new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.9, roughness: 0.3 }));
  sword.position.set(-0.64, 0.4, 0.5); sword.castShadow = true; scene.add(sword);

  let lastKey = '';
  return {
    duration: 12,
    world,
    update(t) {
      const p = params;
      const stand = p.stand === '1';
      const show = p.proxies !== '0';
      kSeat.visible = jSeat.visible = show && !stand;
      kStand.visible = jStand.visible = show && stand;
      sword.visible = show && !stand;
      let s = SHOTS[p.shot || 'wide'] || SHOTS.wide;
      if (p.cx !== undefined) s = { p: [+p.cx, +p.cy, +p.cz], l: [+(p.lx ?? 0), +(p.ly ?? 0.8), +(p.lz ?? 0)], fov: +(p.fov ?? 40), focus: [V(+(p.lx ?? 0), 0.5, +(p.lz ?? 0)), +(p.fr ?? 4)] };
      camera.position.set(...s.p);
      camera.fov = p.fov && p.cx === undefined ? +p.fov : s.fov;
      camera.lookAt(V(...s.l));
      camera.updateProjectionMatrix();
      world.update(t, { mood: +(p.mood ?? 0), wind: +(p.wind ?? 0.5) });
      const key = JSON.stringify(s.p) + JSON.stringify(s.l);
      if (key !== lastKey) { world.focusShadow(s.focus[0], s.focus[1]); lastKey = key; }
    },
  };
}

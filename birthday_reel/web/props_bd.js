// Small hand props owned by the cast: a full toilet paper ROLL (with a hanging tail), the $5 BILL, Dad's NEWSPAPER and
// Uncle's PLATE of cake. Pure functions of their state p + t.
//   prop.p = { visible, pos:[x,y,z], rot:[x,y,z] (Euler YXZ) | quat, k, scale }   (reset every frame)
// Hands grip them through userData.grip (or userData.grips.L / .R) = { pos, axis, up } in prop space (cast.js gripFrame).
import * as THREE from 'three';
import { paint, tex, hash1 } from './lib.js';

function billCanvas() {   // green $5 bill: border, a portrait oval, a big pixel "5" on each side
  const FIVE = ['111', '100', '111', '001', '111'];
  return paint(48, 20, (x, y) => {
    let c = [128, 176, 120];
    if (x < 2 || y < 2 || x > 45 || y > 17) c = [70, 120, 70];
    if (Math.hypot((x - 24) / 6, (y - 10) / 7) < 1) c = Math.hypot((x - 24) / 3, (y - 8) / 3.2) < 1 ? [80, 110, 80] : [176, 210, 160];
    for (const ox of [5, 37]) { const lx = Math.floor((x - ox) / 2), ly = Math.floor((y - 5) / 2); if (lx >= 0 && lx < 3 && ly >= 0 && ly < 5 && FIVE[ly][lx] === '1') c = [40, 80, 40]; }
    const n = (hash1(x * 7 + y * 13) - 0.5) * 10;
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}
function paperCanvas() {   // newspaper: headline block + text columns + a photo
  return paint(32, 40, (x, y) => {
    let c = [226, 224, 214];
    if (y > 2 && y < 7 && x > 2 && x < 29) c = [40, 40, 44];
    else if (x > 2 && x < 15 && y > 9 && y < 20) c = [120, 130, 140];
    else if (y > 9 && y % 3 === 0 && x > 2 && x < 29 && x !== 16 && !(x < 15 && y < 21)) c = [90, 90, 96];
    const n = (hash1(x * 3 + y * 17) - 0.5) * 8;
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}

export function buildHandheld(world) {
  const group = new THREE.Group(); group.name = 'handheld'; world.scene.add(group);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  // toilet paper roll: axis along local X, the loose tail hangs down from the front (+Z) side
  const roll = new THREE.Group(); roll.name = 'roll';
  { const paperM = std({ color: '#fbfbf6', roughness: 0.95, emissive: '#30302c', emissiveIntensity: 0.25 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 20, 1, true), paperM); body.rotation.z = Math.PI / 2; roll.add(body);
    const ring = new THREE.RingGeometry(0.02, 0.055, 20); const ringM = std({ color: '#f0efe8', side: THREE.DoubleSide });
    for (const sx of [-0.05, 0.05]) { const r = new THREE.Mesh(ring, ringM); r.position.x = sx; r.rotation.y = Math.PI / 2; roll.add(r); }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12, 1, true), std({ color: '#b8915a', side: THREE.DoubleSide })); core.rotation.z = Math.PI / 2; roll.add(core);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.098, 0.16, 1, 4), std({ color: '#fbfbf6', roughness: 0.95, side: THREE.DoubleSide, emissive: '#30302c', emissiveIntensity: 0.25 }));
    { const p = tail.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getY(i) + 0.08) * 20) * 0.006); tail.geometry.computeVertexNormals(); }
    tail.position.set(0, -0.08, 0.056); roll.add(tail); roll.userData.tail = tail;
    roll.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    roll.userData.grip = { pos: [0, -0.06, -0.01], axis: [1, 0, 0], up: [0, 0, 1] }; }
  // the $5 bill (long side along local X); grip at its left end
  const bill = new THREE.Group(); bill.name = 'bill';
  { const g = new THREE.PlaneGeometry(0.156, 0.066, 4, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 30) * 0.004);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ map: tex(billCanvas()), side: THREE.DoubleSide, roughness: 0.9 })); m.castShadow = true; bill.add(m);
    bill.userData.grip = { pos: [-0.06, 0, 0], axis: [0, 1, 0], up: [0, 0, 1] }; }
  // newspaper (open, held with two hands at its sides); faces local +Z
  const paper = new THREE.Group(); paper.name = 'paper';
  { const g = new THREE.PlaneGeometry(0.56, 0.38, 8, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.18 + 0.03);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ map: tex(paperCanvas(), { repeat: [2, 1] }), side: THREE.DoubleSide, roughness: 0.95 })); m.castShadow = true; paper.add(m);
    paper.userData.grips = { L: { pos: [0.27, 0, -0.02], axis: [0, 1, 0], up: [-1, 0, 0] }, R: { pos: [-0.27, 0, -0.02], axis: [0, 1, 0], up: [1, 0, 0] } }; }
  // a plate with a slice of birthday cake + a fork
  const plate = new THREE.Group(); plate.name = 'plate';
  { const pm = std({ color: '#ffffff', roughness: 0.35 });
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.015, 18), pm); plate.add(d);
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8, 1, false, 0, 0.9), std({ color: '#f4d29a', roughness: 0.8 })); slice.position.y = 0.048; plate.add(slice);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.015, 8, 1, false, 0, 0.9), std({ color: '#ff9ec0', roughness: 0.5 })); top.position.y = 0.094; plate.add(top);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.13), std({ color: '#d0d0d4', metalness: 0.8, roughness: 0.3 })); fork.position.set(-0.05, 0.012, 0.0); fork.rotation.y = 0.4; plate.add(fork);
    plate.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    plate.userData.grip = { pos: [0, -0.012, 0.0], axis: [1, 0, 0], up: [0, 1, 0] }; }
  group.add(roll, bill, paper, plate);
  const items = { roll, bill, paper, plate };
  const def = () => ({ visible: false, pos: [0, 0, 0], rot: [0, 0, 0], quat: null, k: 0, scale: 1, t0: 0 });
  for (const it of Object.values(items)) it.p = def();
  const api = {
    group, ...items, items,
    reset() { for (const it of Object.values(items)) { it.p = def(); it.visible = false; } },
    place() {
      for (const it of Object.values(items)) {
        const p = it.p; it.visible = p.visible;
        if (!p.visible) continue;
        it.position.set(...p.pos);
        if (p.quat) it.quaternion.copy(p.quat); else it.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
        it.scale.setScalar(p.scale);
        it.updateMatrixWorld(true);
      }
    },
    commit(t) {
      api.place();
      if (roll.visible) { const tl = roll.userData.tail; tl.rotation.x = Math.sin(t * 3.1) * 0.12 + (roll.p.k || 0) * 0.5; }
    },
  };
  return api;
}

// STUB set: same layout numbers + same API as the real set.js, simple shapes. Used when ?use= excludes 'set'.
import * as THREE from 'three';
import { boxOnFloor, box, cyl, matNoisy, mat } from '../lib.js';
import { TABLE, ROOM, SEATS, CHAIR, PLACE, DISHES } from '../layout.js';

export function buildSet(world) {
  const g = new THREE.Group(); world.scene.add(g);
  const B = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const colliders = [];
  const floor = box(ROOM.maxX - ROOM.minX, 0.02, ROOM.maxZ - ROOM.minZ, matNoisy('#7a5034')); floor.position.y = -0.01; g.add(floor);
  const wallM = matNoisy('#d9c7a6');
  const back = box(6, 2.7, 0.1, wallM); back.position.set(0, 1.35, ROOM.minZ - 0.05); g.add(back);
  const front = box(6, 2.7, 0.1, wallM); front.position.set(0, 1.35, ROOM.maxZ + 0.05); g.add(front);
  const top = box(TABLE.maxX - TABLE.minX, TABLE.clothDrop, TABLE.maxZ - TABLE.minZ, matNoisy('#efe6d6'));
  top.position.set(0, TABLE.topY - TABLE.clothDrop / 2, 0); g.add(top);
  colliders.push({ name: 'tableTop', box: B([TABLE.minX, TABLE.topY - TABLE.clothDrop, TABLE.minZ], [TABLE.maxX, TABLE.topY, TABLE.maxZ]) });
  const chairs = {};
  for (const [name, s] of Object.entries(SEATS)) {
    const c = new THREE.Group();
    const seat = boxOnFloor(CHAIR.seatW, 0.05, CHAIR.seatD, matNoisy('#6b4226')); seat.position.y = CHAIR.seatY - 0.05; c.add(seat);
    const backrest = boxOnFloor(CHAIR.seatW, CHAIR.backTopY - CHAIR.seatY, CHAIR.backThick, matNoisy('#6b4226'));
    backrest.position.set(0, CHAIR.seatY, -CHAIR.seatD / 2 + CHAIR.backThick / 2); c.add(backrest);
    c.position.set(s.pos[0], 0, s.pos[1]); c.rotation.y = s.rotY; g.add(c);
    chairs[name] = c;
    c.updateMatrixWorld(true);
    colliders.push({ name: `chairBack_${name}`, box: new THREE.Box3().setFromObject(backrest) });
    const sb = new THREE.Box3().setFromObject(seat); sb.max.y -= 0.01;
    colliders.push({ name: `chairSeat_${name}`, box: sb });
    const plate = cyl(PLACE.plateR, PLACE.plateR * 0.8, PLACE.plateH, 16, mat('#f4f1ea'));
    plate.position.set(s.plate[0], TABLE.topY, s.plate[1]); g.add(plate);
  }
  const turkey = boxOnFloor(0.3, 0.2, 0.22, matNoisy('#b06a2a')); turkey.position.set(DISHES.turkey.x, TABLE.topY, DISHES.turkey.z); g.add(turkey);
  const mkTool = (len, color) => { const m = box(0.02, 0.008, len, mat(color)); m.geometry.translate(0, 0, len / 2 - 0.03); m.userData.grip = { pos: [0, 0, 0], rot: [0, 0, 0] }; g.add(m); return m; };
  const props = { chairs, turkey, servingFork: mkTool(0.3, '#cccccc'), bigSpoon: mkTool(0.3, '#cccccc'), yourFork: mkTool(0.18, '#dddddd') };
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(-1, 4, 2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 10 }); g.add(sun);
  g.add(new THREE.HemisphereLight(0xfff4e6, 0x6b4a30, 1.0));
  return { group: g, props, colliders, state: {}, anchors: {}, reset() {}, commit() {} };
}

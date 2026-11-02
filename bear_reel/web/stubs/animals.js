// STUB animals: box bear + box dog with the same API as the real animals.js. See CONTRACTS.md.
import * as THREE from 'three';
import { matNoisy } from '../lib.js';
import { BEAR_PATH, COMPARE } from '../layout.js';
function boxAnimal(world, name, size, color, headSize) {
  const root = new THREE.Group(); root.name = name; world.scene.add(root);
  const body = new THREE.Mesh(new THREE.BoxGeometry(...size), matNoisy(color)); body.position.y = size[1] / 2 + 0.3; root.add(body);
  const head = new THREE.Group(); head.position.set(0, size[1] + 0.3, size[2] / 2 + headSize * 0.4); root.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), matNoisy(color)));
  const nose = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.25, headSize * 0.2, headSize * 0.2), matNoisy('#111111')); nose.position.z = headSize * 0.6; head.add(nose);
  const w = (o, l = [0, 0, 0]) => { o.updateMatrixWorld(true); return new THREE.Vector3(...l).applyMatrix4(o.matrixWorld); };
  return { name, root, head, headRadius: headSize / 2, p: {},
    headPos: () => w(head), nosePos: () => w(nose), eyePos: (s = 'L') => w(head, [s === 'L' ? headSize * 0.25 : -headSize * 0.25, headSize * 0.15, headSize * 0.5]),
    mouthPos: () => w(head, [0, -headSize * 0.3, headSize * 0.5]), pawPos: () => w(root, [0, 0, size[2] / 2]),
    eyeLocal: (s = 'L') => new THREE.Vector3(s === 'L' ? headSize * 0.25 : -headSize * 0.25, headSize * 0.15, headSize * 0.5) };
}
export function buildAnimals(world) {
  const bear = boxAnimal(world, 'bear', [1.2, 1.3, 2.6], '#6b4423', 0.75);
  const dog = boxAnimal(world, 'dog', [0.35, 0.45, 0.8], '#b5733f', 0.28);
  const squirrel = boxAnimal(world, 'squirrel', [0.08, 0.08, 0.2], '#b5522a', 0.06);
  const bd = () => ({ pos: BEAR_PATH.stop.slice(), rotY: Math.PI, visible: true, scale: 1 });
  const dd = () => ({ pos: [COMPARE.pos[0] + 1.6, COMPARE.pos[1]], rotY: 0, visible: false });
  const no = () => {};
  const mapBear = { root: new THREE.Group(), p: { visible: false }, nosePos: () => new THREE.Vector3(-6, 12, 88) };
  world.scene.add(mapBear.root);
  return { characters: [bear, dog, squirrel], bear, dog, squirrel, mapBear, birds: { burst: no, flyOff: no, perch: no },
    reset() { bear.p = bd(); dog.p = dd(); squirrel.p = { pos: [0, 0, 0], rotY: 0, visible: false }; mapBear.p = { visible: false }; },
    commit() {
      for (const a of [bear, dog]) { a.root.visible = a.p.visible; a.root.position.set(a.p.pos[0], 0, a.p.pos[1]); a.root.rotation.y = a.p.rotY; a.root.scale.setScalar(a.p.scale || 1); }
      squirrel.root.visible = squirrel.p.visible; squirrel.root.position.set(...squirrel.p.pos);
      mapBear.root.visible = mapBear.p.visible;
    } };
}

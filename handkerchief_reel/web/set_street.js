// PLACEHOLDER (to be replaced): the mansion reel's sunny street + simple lights, so the engine runs.
import * as THREE from 'three';
import { buildCity } from './set_city.js';

export function buildStreet(env, world) {
  const city = buildCity();
  const group = new THREE.Group(); group.name = 'set.street'; group.add(city.group);
  const key = new THREE.DirectionalLight('#ffd2a0', 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.userData.dir = new THREE.Vector3(0.62, 0.5, -0.7);
  group.add(key, key.target);
  group.add(new THREE.HemisphereLight('#c8d4ff', '#403838', 1.4));
  return { name: 'street', group, props: {}, key, defaults: () => ({}), update() {},
    look: { background: '#6a7aa8', fog: { color: '#6a7aa8', near: 30, far: 200 }, exposure: 1.0, shadowCenter: [2, 0.5, -2.5], shadowRadius: 8 } };
}

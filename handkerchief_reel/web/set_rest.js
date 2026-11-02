// The void (brain + stopwatch), the fancy restaurant and the interior wall with the framed handkerchief.
// Each builder follows the place contract in set.js. plainPlace() is also used by set_out.js (placeholders).
import * as THREE from 'three';
import { VOID, RESTAURANT, INTERIOR } from './layout.js';
import { buildVoid as buildVoidPlace } from './set_rest_void.js';

export function plainPlace(name, origin, floor, bg) {
  const group = new THREE.Group(); group.name = `set.${name}`;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.9 }));
  f.rotation.x = -Math.PI / 2; f.position.set(origin[0], 0, origin[1]); f.receiveShadow = true; group.add(f);
  const key = new THREE.DirectionalLight('#fff0dc', 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.userData.dir = new THREE.Vector3(0.3, 1, -0.6);
  group.add(key, key.target, new THREE.HemisphereLight('#ffffff', '#554433', 1.3));
  return { name, group, props: {}, key, defaults: () => ({}), update() {},
    look: { background: bg, fog: null, exposure: 1.0, shadowCenter: [origin[0], 0.8, origin[1]], shadowRadius: 6 } };
}
export const buildVoid = (env, world) => buildVoidPlace(env, world);
export const buildRestaurant = () => plainPlace('restaurant', RESTAURANT.origin, '#7a2a2a', '#8a6a2a');
export const buildInterior = () => plainPlace('interior', INTERIOR.origin, '#6a4a3a', '#a08a7a');

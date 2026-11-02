// The three outdoor places of the handkerchief reel (contract: see set.js header):
//   buildParis   (set_out_paris.js)   sunny golden afternoon park + Eiffel Tower, hollow ring bush (state.bushShake)
//   buildWedding (set_out_wedding.js) garden wedding: flower arch, white chairs, aisle runner (props.seats)
//   buildPorch   (set_out_porch.js)   cosy wooden house with a porch at sunset, porch swing (state.swing)
// Shared pieces: set_out_kit.js (sky, lights, vegetation), set_out_tex.js (pixel textures), set_out_eiffel.js.
import * as THREE from 'three';
import { WEDDING, PORCH } from './layout.js';
export { buildParis } from './set_out_paris.js';

function tmpPlace(name, origin, floor, bg) {
  const group = new THREE.Group(); group.name = `set.${name}`;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.9 }));
  f.rotation.x = -Math.PI / 2; f.position.set(origin[0], 0, origin[1]); f.receiveShadow = true; group.add(f);
  const key = new THREE.DirectionalLight('#fff0dc', 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.userData.dir = new THREE.Vector3(0.3, 1, -0.6).normalize();
  group.add(key, key.target, new THREE.HemisphereLight('#ffffff', '#554433', 1.3));
  return { name, group, props: {}, key, defaults: () => ({}), update() {},
    look: { background: bg, fog: null, exposure: 1.0, shadowCenter: [origin[0], 0.8, origin[1]], shadowRadius: 6 } };
}
export { buildWedding, buildPorch } from './set_out_wp.js';

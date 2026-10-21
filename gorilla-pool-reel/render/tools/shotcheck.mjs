// Samples the real camera path and reports where each moment's key subject
// lands on screen, flagging anything inside the subtitle band / UI zones.
import * as THREE from 'three';
import { cameraAt } from '../scene/timeline.js';
const BAND = [0.368, 0.432];
const checks = [
  [0.5, 'kid face', [-2.0, 1.2, 0.85]], [0.5, 'ground front', [0, 0, 1.6]], [2.0, 'gorilla face (walking)', [2.0, 2.05, -1.6]], [11.2, 'pool bottom', [0, -1.6, 1.6]], [37.0, 'pool bottom', [0, -1.6, 1.6]], [8.5, 'neighbour face', [1.9, 2.3, -5.75]], [3.4, 'gorilla face (pound)', [0.9, 2.0, -1.5]], [1.5, 'gorilla face (walking)', [3.0, 2.05, -1.75]], [3.0, 'gorilla face (huff)', [0.9, 2.05, -1.5]], [7.3, 'neighbour face', [1.9, 2.3, -5.75]], [7.8, 'neighbour face', [1.9, 2.3, -5.75]],
  [3.8, 'gorilla chest (pound)', [0.9, 1.6, -1.3]], [3.8, 'gorilla face (pound)', [0.9, 2.0, -1.5]], [5.3, 'gorilla face (dig)', [0, 1.6, 0.1]],
  [8.0, 'neighbour face', [1.9, 2.3, -5.75]], [9.0, 'neighbour face', [1.9, 2.3, -5.75]], [9.0, 'gorilla face (dig)', [0, 0.0, 0.2]],
  [11.2, 'wheelbarrow', [0.8, 0.45, -2.9]], [11.2, 'gorilla face (scoop)', [0, 0.5, -0.1]], [15.0, 'gorilla deep face', [0, -1.0, -0.1]], [15.0, 'deep bottom', [0, -3.0, 1.6]],
  [17.5, 'map', [-2.0, 1.75, 1.0]], [17.5, 'kid face', [-2.0, 1.2, 0.85]], [17.5, 'depth line', [0, -1.6, 1.6]], [18.0, 'gorilla deep face', [0, -1.0, -0.1]], [18.2, 'gorilla deep face', [0, -1.0, -0.1]], [17.9, 'kid face', [-2.0, 1.2, 0.85]], [17.9, 'map', [-2.0, 1.75, 1.0]], [17.9, 'depth line', [0, -1.6, 1.6]], [9.6, 'neighbour face', [1.9, 2.3, -5.75]], [10.3, 'neighbour face', [1.9, 2.3, -5.75]], [10.0, 'neighbour face', [1.9, 2.3, -5.75]], [10.9, 'neighbour face', [1.9, 2.3, -5.75]], [10.9, 'wheelbarrow', [0.8, 0.45, -2.9]], [12.0, 'gorilla face (scoop)', [0, 0.5, -0.1]], [13.0, 'pool bottom', [0, -1.6, 1.6]], [18.35, 'gorilla deep face', [0, -1.0, -0.1]], [18.1, 'kid face', [-2.0, 1.2, 0.85]], [10.3, 'gorilla face (dig)', [0, 0.1, 0.2]], [38.5, 'kid face (cheer)', [-1.92, 1.35, -0.3]], [36.4, 'gorilla face (scene6)', [1.12, 2.0, -3.25]], [37.5, 'gorilla face (scene6)', [1.12, 2.0, -3.25]], [38.8, 'gorilla face (scene6)', [1.12, 2.0, -3.25]], [36.4, 'kid face (cheer)', [-1.92, 1.35, -0.3]], [38.8, 'kid face (cheer)', [-1.92, 1.35, -0.3]], [33.5, 'gorilla face (hose)', [1.12, 2.0, -3.25]], [39.0, 'pool bottom', [0, -1.6, 1.6]],
  [21.8, 'crumbling wall', [0, -0.8, -1.6]], [23.6, 'gorilla in hole face', [0.1, 0.5, -0.3]], [26.0, 'tiles', [0, -0.8, -1.6]],
  [28.8, 'gorilla face (angry)', [1.12, 2.0, -3.25]], [28.8, 'crossed arms', [1.12, 1.5, -3.0]], [30.4, 'banana pile', [-0.6, 0.45, -2.95]], [30.4, 'kid face (push)', [-1.6, 1.2, -2.95]],
  [31.4, 'gorilla face (smile)', [1.12, 2.0, -3.25]], [33.0, 'pool water', [0, -0.5, 0]], [37.0, 'kid face (cheer)', [-1.92, 1.35, -0.3]], [37.0, 'pool', [0, -0.4, 0.5]],
  [43.3, 'splash', [0.05, 0.6, -0.15]], [46.0, 'kid face (wet)', [-1.92, 1.2, -0.3]], [46.0, 'gorilla floating face', [1.0, 0.2, -0.1]], [49.0, 'kid face (wet)', [-1.92, 1.2, -0.3]],
];
const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 400);
for (const [t, name, p] of checks) {
  cameraAt(t, cam); cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  const x = (v.x + 1) / 2, y = (1 - v.y) / 2;
  const flags = [];
  if (y > BAND[0] - 0.025 && y < BAND[1] + 0.02) flags.push('IN SUBTITLE BAND');
  if (y > 0.8) flags.push('IN BOTTOM UI');
  if (x > 0.85) flags.push('UNDER RIGHT UI');
  if (x < 0.05 || x > 0.95 || y < 0.02 || y > 0.98) flags.push('OFF FRAME');
  console.log(`t=${t.toFixed(1).padStart(5)} ${name.padEnd(24)} x=${x.toFixed(2)} y=${y.toFixed(2)} ${flags.join(', ')}`);
}

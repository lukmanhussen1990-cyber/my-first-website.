// quick framing search: project points from a candidate camera (pos, look, fov)
import * as THREE from 'three';
export function proj(pos, look, fov, pts) {
  const cam = new THREE.PerspectiveCamera(fov, 1080 / 1920, 0.05, 2000);
  cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return pts.map((p) => { const v = new THREE.Vector3(...p).project(cam); return [Math.round((v.x + 1) / 2 * 1080), Math.round((1 - v.y) / 2 * 1920)]; });
}

import * as THREE from 'three';
import { makeCar } from './car.js';
import { makeEnvironment, makeSky, SUN_DIR } from './sky.js';

// Studio preview of the car, from the same angles as the reference photos.
export async function build({ renderer, W, H, Q }) {
  const scene = new THREE.Scene();
  const env = makeEnvironment(renderer);
  scene.environment = env;
  const studio = Q.get('studio') !== '0';
  if (studio) scene.background = new THREE.Color(0.02, 0.022, 0.026);
  else { const sky = makeSky(); scene.add(sky.mesh); }
  const car = makeCar(env);
  scene.add(car.root);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: studio ? 0x101114 : 0xb08850, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const sun = new THREE.DirectionalLight(0xffffff, studio ? 2.2 : 3.0);
  const sd = studio ? new THREE.Vector3(0.6, 0.9, 0.5).normalize() : SUN_DIR.clone();
  sun.position.copy(sd).multiplyScalar(30); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x302018, studio ? 0.25 : 0.6));
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 3000);
  const views = {
    side: { pos: [0.3, 0.9, 9.5], look: [0.3, 0.55, 0], fov: 22 },
    side_close: { pos: [0.9, 0.85, 4.4], look: [0.9, 0.62, 0], fov: 30 },
    front34: { pos: [5.6, 1.15, 4.8], look: [0.3, 0.5, 0.1], fov: 26 },
    rear34: { pos: [-5.2, 1.4, 4.6], look: [-0.3, 0.5, 0], fov: 26 },
    front: { pos: [8, 0.8, 0], look: [0, 0.55, 0], fov: 18 },
    top: { pos: [0.01, 9, 0], look: [0, 0, 0], fov: 32 },
    rear: { pos: [-8, 1.0, 0], look: [0, 0.5, 0], fov: 18 },
  };
  const v = views[Q.get('view') || 'front34'];
  camera.fov = v.fov; camera.position.set(...v.pos); camera.lookAt(...v.look);
  if (Q.get('aspect') === 'land') camera.aspect = W / H;
  return {
    scene, camera, sun, sunSoftness: 0.02,
    update() {},
    postParams: () => ({ uExposure: studio ? 1.4 : 1.0, uBloom: 0.05, uVignette: 0.25 }),
  };
}

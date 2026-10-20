import * as THREE from 'three';
import { makeEnvironment, makeSky, SUN_DIR } from './sky.js';
import { makeCheetah, defaultPose } from './cheetah.js';
import { poseFor } from './poses.js';

// Character turntable/test scene with the film's sunset lighting.
export async function build({ renderer, W, H, Q }) {
  const scene = new THREE.Scene();
  const env = makeEnvironment(renderer);
  scene.environment = env; scene.environmentIntensity = 0.6;
  const sky = makeSky(); scene.add(sky.mesh);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.58, 0.32), roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.56, 0.24), 4.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 2; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 60 });
  sun.position.copy(SUN_DIR).multiplyScalar(30); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(1.0, 0.7, 0.42), 1.7);
  fill.position.set(-0.45, 0.62, 0.65).normalize().multiplyScalar(30); scene.add(fill);
  const cool = new THREE.DirectionalLight(new THREE.Color(0.55, 0.6, 1.0), 0.35);
  cool.position.set(0.7, 0.4, 0.6).normalize().multiplyScalar(30); scene.add(cool);
  scene.add(new THREE.HemisphereLight(new THREE.Color(0.5, 0.45, 0.7), new THREE.Color(0.62, 0.4, 0.18), 0.3));
  const ch = makeCheetah(env);
  scene.add(ch.root);
  const hide = (Q.get('hide') || '').split(',');
  ch.root.traverse((o) => { if (o.isMesh && hide.includes(o.userData.part)) o.visible = false; });
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 2000);
  const views = {
    side: [[0.0, 0.6, 3.6], [0.0, 0.5, 0]], front34: [[1.9, 0.75, 1.9], [0.05, 0.5, 0]], face: [[1.05, 0.95, 0.55], [0.6, 0.86, 0]],
    face_front: [[1.45, 0.82, 0.0], [0.6, 0.8, 0]], back34: [[-1.8, 0.9, 1.8], [0, 0.5, 0]],
    front: [[2.6, 0.5, 0.0], [0, 0.5, 0]], top: [[0.0, 3.2, 0.01], [0, 0.4, 0]],
  };
  const [cp, cl] = views[Q.get('view') || 'side'];
  camera.position.set(...cp); camera.lookAt(...cl);
  camera.fov = +(Q.get('fov') || 30); camera.updateProjectionMatrix();
  const poseName = Q.get('pose') || 'stand';
  return {
    scene, camera, sun, sunSoftness: 0.02,
    update(t) { ch.apply(poseFor(poseName, t, defaultPose()), t); sky.follow(camera); },
    postParams: () => ({ uExposure: 1.0, uBloom: 0.04, uVignette: 0.2, uSat: 1.15, uContrast: 1.08, uACES: 1 }),
  };
}

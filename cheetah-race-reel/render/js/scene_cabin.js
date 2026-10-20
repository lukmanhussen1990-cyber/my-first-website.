import * as THREE from 'three';
import { makeEnvironment, makeSky, SUN_DIR } from './sky.js';
import { makeCar } from './car.js';
import { makeCheetah, defaultPose } from './cheetah.js';
import { makeJohn, defaultJohnPose } from './john.js';
import { poseFor } from './poses.js';

// Car + John + (optionally) the cheetah buckled in: checks the cabin layout.
export async function build({ renderer, W, H, Q }) {
  const scene = new THREE.Scene();
  const env = makeEnvironment(renderer);
  scene.environment = env; scene.environmentIntensity = 0.6;
  const sky = makeSky(); scene.add(sky.mesh);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.58, 0.32), roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.56, 0.24), 4.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 2; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 80 });
  sun.position.copy(SUN_DIR).multiplyScalar(30); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(1.0, 0.7, 0.42), 1.7);
  fill.position.set(-0.45, 0.62, 0.65).normalize().multiplyScalar(30); scene.add(fill);
  const cool = new THREE.DirectionalLight(new THREE.Color(0.55, 0.6, 1.0), 0.35);
  cool.position.set(0.7, 0.4, 0.6).normalize().multiplyScalar(30); scene.add(cool);
  scene.add(new THREE.HemisphereLight(new THREE.Color(0.5, 0.45, 0.7), new THREE.Color(0.62, 0.4, 0.18), 0.3));
  const car = makeCar(env); scene.add(car.root);
  const john = makeJohn(env); car.cabin.add(john.root); john.root.position.set(-0.4, 0.3, 0.42);
  const ch = makeCheetah(env); car.cabin.add(ch.root); ch.root.position.set(-0.42, 0.3, -0.42);
  ch.root.visible = Q.get('cheetah') !== '0';
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 2000);
  const views = {
    side: [[-0.2, 1.3, 5.2], [-0.2, 0.75, 0]], side_close: [[-0.35, 1.05, 2.4], [-0.38, 0.9, 0]],
    front: [[4.2, 1.3, 0.2], [0, 0.85, 0]], frontleft: [[2.8, 1.35, -2.4], [-0.3, 0.88, 0]], top: [[-0.3, 4.5, 0.01], [-0.3, 0.5, 0]],
  };
  const [cp, cl] = views[Q.get('view') || 'side'];
  camera.position.set(...cp); camera.lookAt(...cl); camera.fov = +(Q.get('fov') || 30); camera.updateProjectionMatrix();
  const jp = Q.get('john') || 'drive';
  return {
    scene, camera, sun, sunSoftness: 0.02,
    update(t) {
      const P = defaultJohnPose();
      if (jp === 'cheer') { P.handL.set(0.05, 0.62, -0.25); P.handR.set(0.05, 0.62, 0.25); P.fistL = P.fistR = 1; P.open = 1; P.teeth = 1; P.smile = 1; P.browL = P.browR = 0.8; }
      if (jp === 'stare') { P.headYaw = -0.9; P.gaze.set(0.2, -0.05, -1); P.lidL = P.lidR = 0.0; P.smile = 0; P.oShape = 0.8; P.browL = P.browR = 0.6; }
      john.apply(P, t);
      ch.apply(poseFor('sit', t, defaultPose()), t);
      sky.follow(camera);
    },
    postParams: () => ({ uExposure: 1.0, uBloom: 0.04, uVignette: 0.2, uSat: 1.15, uContrast: 1.08, uACES: 1 }),
  };
}

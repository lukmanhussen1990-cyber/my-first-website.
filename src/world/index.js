// Builds every object used by any scene once; shots.js shows/hides and animates them.
import * as THREE from 'three';
import { createSky } from './sky.js';
import { createMountains } from './mountains.js';
import { createGlacier, LEDGE_Y, wallX, crackCenter } from './glacier.js';
import { createFigure, POSES } from './figures.js';
import { createHeadlamp } from './headlamp.js';
import { createProps } from './props.js';
import { createParticles } from './particles.js';
import { createFrozen } from './frozen.js';
import { createFullFrame } from './fullframe.js';

export function buildWorld(renderer, tex, env, images, envDay) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, renderer.domElement.width / renderer.domElement.height, 0.1, 4000);
  scene.add(camera);

  const sky = createSky();
  scene.add(sky.mesh);
  const mountains = createMountains();
  scene.add(mountains);
  const glacier = createGlacier(tex, env);
  scene.add(glacier);

  // lights
  const hemi = new THREE.HemisphereLight(0x3b5f8f, 0x050a14, 0.35);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9db8ff, 0.8);
  moon.position.set(40, 60, 50);
  moon.target.position.set(0, -20, 0);
  scene.add(moon, moon.target);
  const fill = new THREE.PointLight(0x4a90d0, 0, 6, 1.5); // generic cold fill near the subject
  scene.add(fill);
  const bounce = new THREE.PointLight(0xff9a50, 0, 2.6, 1.6); // headlamp light bouncing off the lit ice back onto Max
  scene.add(bounce);

  // Max
  const max = createFigure({
    jacket: 0xff5a0a, jacket2: 0xe24e08, jacketGlow: 0x1a0700, pants: 0x1b1e25, boots: 0x2b2018, gloves: 0x17191e,
    skin: 0xd8a383, hair: 0x2b1d14, helmet: 0xf4f4f0, headlamp: true, backpack: 0x26303c,
  });
  scene.add(max.root);
  const maxLamp = createHeadlamp(tex, { intensity: 9, angle: 0.36, len: 3.2, seed: 11 });
  max.J.lamp.add(maxLamp.group);

  // Erik (rescuer)
  const erik = createFigure({
    jacket: 0xf2c418, jacket2: 0x16171a, pants: 0x16171a, boots: 0x1b1b1d, gloves: 0x111214, skin: 0xd09a78,
    helmet: 0xd8231f, headlamp: true, harness: true, backpack: 0x1b1d22,
  });
  scene.add(erik.root);
  const erikLamp = createHeadlamp(tex, { intensity: 11, angle: 0.38, len: 4.5, seed: 23, color: 0xfff1dc });
  erik.J.lamp.add(erikLamp.group);

  // friends at camp + extra rescuers
  const friendBlue = createFigure({ jacket: 0x2a6fd6, jacket2: 0x1f56aa, pants: 0x22252c, skin: 0xc98f6a, hat: 0x2b2f38, hair: 0x1a120c, backpack: null });
  const friendGreen = createFigure({ jacket: 0x2e9b58, jacket2: 0x237a45, pants: 0x2a2a2e, skin: 0xe0b08e, hat: 0x8a2f2f, backpack: null });
  const rescuerA = createFigure({ jacket: 0x2b4a7a, jacket2: 0x1d2f4d, pants: 0x1a1c22, skin: 0xcf9c7c, helmet: 0xd8231f, harness: true, backpack: null });
  const rescuerB = createFigure({ jacket: 0x55606e, jacket2: 0x3a424d, pants: 0x1a1c22, skin: 0xb98463, helmet: 0xd8231f, harness: true, backpack: null });
  scene.add(friendBlue.root, friendGreen.root, rescuerA.root, rescuerB.root);

  const frozen = createFrozen(tex, images);
  scene.add(frozen.group);

  const props = createProps(tex, env, envDay);
  scene.add(props.group);
  const particles = createParticles(tex);
  scene.add(particles.group);
  // full-frame image (scene 9 reveal), lives in front of the camera
  const fullframe = createFullFrame(images.crowd);
  camera.add(fullframe.mesh);
  // close-up "cap": closes the open cut face near the ledge so close-ups never see outside the slab
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glacier.userData.wallIce);
  cap.position.set(0, LEDGE_Y + 0.5, 0.02);
  cap.rotation.y = Math.PI; // faces -z (into the crack)
  cap.visible = false;
  const capBack = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), glacier.userData.deep);
  glacier.userData.deep.userData.hook(capBack);
  capBack.position.set(0, LEDGE_Y + 0.5, 2.8);
  capBack.rotation.y = Math.PI;
  capBack.visible = false;
  scene.add(cap, capBack);

  const world = {
    scene, camera, sky, mountains, glacier, hemi, moon, fill, bounce,
    max, maxLamp, erik, erikLamp, friendBlue, friendGreen, rescuerA, rescuerB,
    frozen, props, particles, fullframe, cap, capBack, tex, env, renderer,
    LEDGE_Y, wallX, crackCenter, POSES,
  };
  return world;
}

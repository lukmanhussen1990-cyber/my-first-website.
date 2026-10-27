// Builds every set, prop and character once; each frame starts from reset() so frames are stateless.
import * as THREE from 'three';
import { ZERO_POSE } from '../../../engine/toon/rig.js';
import { clay, glow } from '../../../engine/toon/materials.js';
import { CamRig } from '../camera.js';
import { LOOKS } from '../looks.js';
import { blendLook } from '../../../engine/toon/stage.js';
import { buildBackyard, makeClouds, makeMoon, makeStars, makeCoin, LAYOUT } from './backyard.js';
import { makeLarry, makeChip } from '../../../characters/larry.js';
import { makeJohn } from '../../../characters/john.js';
import { makeGhost } from '../../../characters/ghost.js';
import { makePumpkinKid, makeWitchKid, makeDinoKid, makeZombie, makeWitch, makeVampire, makeChicken, makeCrowdPerson } from '../cast.js';
import { buildFX } from '../fx.js';
import { buildShedInside, makeSpider, makeFogMachine, SHED_IN } from './shed_inside.js';
import { buildEstate, MANSION, SPOOKY } from './mansion.js';
import { buildInterior, HALL } from './interior.js';

export function buildWorld(stage) {
  const W = { stage, scene: stage.scene, sets: {}, cast: {}, props: {}, fx: {}, extras: [], after: [], pre: [] };
  W.cam = new CamRig(stage);
  const scene = stage.scene;

  // night windows glow: one shared material whose emissive follows the look
  W.nightGlass = new THREE.MeshStandardMaterial({ color: '#7fa3d6', roughness: 0.25, emissive: '#ffcf7a', emissiveIntensity: 0 });

  // ---- sky dressing (shared by all exterior sets) ----
  W.sky = new THREE.Group(); W.sky.name = 'skyDressing'; scene.add(W.sky);
  W.clouds = makeClouds(); W.sky.add(W.clouds);
  W.moon = makeMoon(); W.moon.scale.setScalar(26); W.sky.add(W.moon);
  W.stars = makeStars(); W.sky.add(W.stars);

  // ---- sets ----
  W.sets.backyard = buildBackyard(W.nightGlass);
  scene.add(W.sets.backyard);
  W.sets.shedInside = buildShedInside(); scene.add(W.sets.shedInside);
  W.SHED_IN = SHED_IN;
  W.sets.estate = buildEstate(W); scene.add(W.sets.estate);
  W.MANSION = MANSION; W.SPOOKY = SPOOKY;
  W.sets.interior = buildInterior(); scene.add(W.sets.interior);
  W.HALL = HALL;

  // ---- cast ----
  const C = W.cast;
  C.larry = makeLarry(); C.john = makeJohn(); C.ghost = makeGhost();
  C.ghostCameo = makeGhost();
  C.ghostCameo.mat.opacity = 0.32; C.ghostCameo.mat.emissiveIntensity = 0.5; C.ghostCameo.light.intensity = 0;
  C.pumpkinKid = makePumpkinKid(); C.witchKid = makeWitchKid(); C.dinoKid = makeDinoKid();
  C.zombies = [makeZombie(0), makeZombie(1), makeZombie(2)];
  C.witch = makeWitch(); C.vampire = makeVampire(); C.chicken = makeChicken();
  W.characters = [C.larry, C.john, C.pumpkinKid, C.witchKid, C.dinoKid, ...C.zombies, C.witch, C.vampire];
  W.others = [C.ghost, C.ghostCameo, C.chicken, C.witch.broom];
  for (const o of [...W.characters, ...W.others]) { scene.add(o); o.visible = false; }
  C.ghost.traverse((o) => { o.userData.noAO = true; }); C.ghostCameo.traverse((o) => { o.userData.noAO = true; });

  // crowd people (lines of kids / people in costumes) are built on demand and cached
  W.crowd = [];
  W.crowdPerson = (i, adult = false) => {
    const key = i + (adult ? 1000 : 0);
    if (!W.crowd[key]) { const p = makeCrowdPerson(i, adult); scene.add(p); W.crowd[key] = p; }
    return W.crowd[key];
  };

  // ---- small props ----
  W.props.coin = makeCoin(); scene.add(W.props.coin);
  W.props.chip = makeChip(0.035); scene.add(W.props.chip);
  // Larry's hand poking out from under the sheet (close-ups where his short arm can't reach)
  const hand = new THREE.Group(); hand.name = 'larryHand';
  const skin = clay('#f6c8a8');
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.26, 6, 16), skin); fore.position.y = -0.17; hand.add(fore);
  const mit = new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 18), skin); mit.scale.set(0.92, 1.05, 0.72); mit.position.y = 0.04; hand.add(mit);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), skin); thumb.position.set(-0.045, 0.02, 0.025); hand.add(thumb);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 20), clay('#f6f4f1', { roughness: 0.9 })); cuff.position.y = -0.33; hand.add(cuff);
  hand.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  W.props.larryHand = hand; scene.add(hand);

  buildFX(W);

  W.props.spider = makeSpider(1); scene.add(W.props.spider);
  W.props.spider2 = makeSpider(1); scene.add(W.props.spider2);
  W.props.fogMachine = makeFogMachine(); scene.add(W.props.fogMachine);
  W.props.hammer = (() => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.32, 10), clay('#b07a45')); h.position.y = 0.0; g.add(h);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), clay('#8d939c', { roughness: 0.35, metalness: 0.7 })); head.position.y = 0.16; g.add(head);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  })();
  scene.add(W.props.hammer);
  // John's rolled-up blueprint (beat 11)
  W.props.blueprint = (() => {
    const g = new THREE.Group();
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 20), clay('#3f7fd8', { roughness: 0.7 })); g.add(roll);
    for (const y of [-0.12, 0.12]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.015, 20), clay('#f2f2f2')); band.position.y = y; g.add(band); }
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.034, 20), clay('#d9e8ff')); end.position.y = 0.211; end.rotation.x = -Math.PI / 2; g.add(end);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  })();
  scene.add(W.props.blueprint);

  W.registerProp = (name, obj) => { W.props[name] = obj; scene.add(obj); obj.visible = false; return obj; };
  W.registerSet = (name, obj) => { W.sets[name] = obj; scene.add(obj); obj.visible = false; return obj; };

  // ---- per-frame reset ----
  W.reset = () => {
    for (const k in W.sets) W.sets[k].visible = false;
    W.sky.visible = false;
    for (const ch of W.characters) {
      ch.visible = false; ch.position.set(0, 0, 0); ch.rotation.set(0, 0, 0); ch.scale.set(1, 1, 1);
      ch.joints.body.rotation.set(0, 0, 0);
      ch.applyPose(structuredClone(ZERO_POSE));
      ch.joints.spine.scale.set(1, 1, 1);
      ch.setHand('L'); ch.setHand('R');
      if (ch.parent !== scene) scene.add(ch);
    }
    for (const p of W.crowd) if (p) { p.visible = false; p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); p.applyPose(structuredClone(ZERO_POSE)); }
    const L = C.larry;
    L.setSheet(false); L.chips.visible = true;
    if (L.chips.parent !== L.hand('L')) L.hand('L').add(L.chips);
    L.chips.position.set(0, -0.12, 0.05); L.chips.rotation.set(0.1, 0, 0.15); L.chips.scale.setScalar(1);
    L.sheet.position.set(0, 0, 0); L.sheet.rotation.set(0, 0, 0);
    L.sheet.params = { drape: 1, sway: 0, swing: 0, wingL: 0, wingR: 0, wingY: 0.62, mouthPush: 0, flatY: 2.6, flatTilt: 0, snag: null, t: 0, lift: 0 };
    L.sheet.face.set('neutral');
    L.sheet.mat.userData.faceUniforms.faceGlow.value = 0;
    for (const g of [C.ghost, C.ghostCameo]) { g.visible = false; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1); g.params = { t: 0, tailSwish: 1, stretch: 1, armWave: 0, armUp: 0, curl: 1 }; }
    C.chicken.visible = false; C.witch.broom.visible = false;
    if (C.witch.broom.parent !== scene) scene.add(C.witch.broom);
    for (const k in W.props) { W.props[k].visible = false; }
    for (const k of ['hammer', 'blueprint']) { const pr = W.props[k]; if (pr.parent !== scene) scene.add(pr); pr.scale.setScalar(1); }
    for (const f of W.extras) f.reset && f.reset();
    W.cam.reset();
    W.after = [];
    W.pre = [];
    for (const k in W.sets) if (W.sets[k].userData.reset) W.sets[k].userData.reset();
    stage.grade.uniforms.flash.value = 0; stage.grade.uniforms.fade.value = 0;
    W.nightGlass.emissiveIntensity = 0;
  };

  // ---- show a set (and the sky for exteriors) ----
  W.show = (...names) => {
    for (const n of names) { W.sets[n].visible = true; if (['backyard', 'estate'].includes(n)) W.sky.visible = true; }
  };

  // ---- apply a look by name, or blend two looks ----
  W.look = (a, b = null, u = 0) => {
    const L = b ? blendLook(LOOKS[a], LOOKS[b], u) : LOOKS[a];
    stage.applyLook(L);
    const cl = L.clouds || { color: '#ffffff', emissive: 0.2 };
    W.clouds.userData.mat.color.set(cl.color); W.clouds.userData.mat.emissive.set(cl.color); W.clouds.userData.mat.emissiveIntensity = cl.emissive * 1.6;
    W.stars.material.opacity = L.stars ?? 0;
    W.moon.visible = (L.moon ?? 0) > 0.01;
    W.moon.position.set(-150, 150, -520); W.moon.scale.setScalar(26);   // default spot; shots may move it
    W.moon.userData.disc.material.color.setRGB(1.6, 1.55, 1.4);
    W.moon.userData.disc.material.opacity = L.moon ?? 0; W.moon.userData.halo.material.opacity = (L.moon ?? 0) * 0.9;
    W.nightGlass.emissiveIntensity = (L.windows ?? 0) * 1.4;
    for (const p of W.sets.backyard.userData.pumpkins) if (p.userData.light) p.userData.light.intensity = (L.windows ?? 0) * 1.6;
    W.lookNow = L;
    return L;
  };
  W.moonAt = (pos, scale = 26) => { W.moon.position.set(...pos); W.moon.scale.setScalar(scale); W.moon.lookAt(stage.camera.position); };
  W.shadow = (center, r) => stage.setShadowFocus(center, r);
  W.LAYOUT = LAYOUT;
  return W;
}

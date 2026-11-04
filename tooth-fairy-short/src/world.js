// Builds the whole world once; shots then pose it for each frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMaterials } from './materials.js';
import { Man, Officer, Fairy, Kid } from './characters.js';
import { buildProps } from './props.js';
import { buildBedroom, buildKidsRoom, buildJail, setClock, setCurtains, WINDOW, BED } from './sets.js';
import { Dust, Sparkles, Shaft } from './fx.js';
import { wob, clamp } from './util.js';

export const KIDS_X = 40, JAIL_X = 80;

export function buildWorld(renderer, timing, pxScale) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const M = buildMaterials(env);

  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.02, 60);
  scene.add(camera);

  // ---- light rig (fixed light count => no shader recompiles) -------------
  const rig = {};
  rig.hemi = new THREE.HemisphereLight(0xfff1e0, 0x8a7a90, 1);
  rig.key = new THREE.DirectionalLight(0xffe2b8, 2);
  rig.key.castShadow = true;
  rig.key.shadow.mapSize.set(2048, 2048);
  rig.key.shadow.bias = -0.0004;
  rig.key.shadow.normalBias = 0.015;
  const sc = rig.key.shadow.camera;
  sc.left = -3.4; sc.right = 3.4; sc.top = 3.4; sc.bottom = -3.4; sc.near = 0.5; sc.far = 30;
  rig.lamp = new THREE.PointLight(0xffb36b, 0, 6, 2);
  rig.red = new THREE.PointLight(0xff2a3a, 0, 9, 2);
  rig.blue = new THREE.PointLight(0x2a5bff, 0, 9, 2);
  rig.fill = new THREE.PointLight(0xffd7a8, 0, 8, 2);
  for (const k in rig) scene.add(rig[k]);
  scene.add(rig.key.target);

  // ---- sets / characters / props ------------------------------------------
  const bed = buildBedroom(M); scene.add(bed.root);
  const kids = buildKidsRoom(M, KIDS_X); scene.add(kids.root);
  const jail = buildJail(M, JAIL_X); scene.add(jail.root);
  const man = new Man(M); scene.add(man.root);
  const officer = new Officer(M); scene.add(officer.root);
  const extras = [0, 1, 2, 3, 4].map(() => { const o = new Officer(M); scene.add(o.root); return o; });
  const fairy = new Fairy(M); scene.add(fairy.root);
  const kidA = new Kid(M, { hair: '#6b4a2b', seed: 91, pigtails: true });
  const kidB = new Kid(M, { hair: '#e0b24f', seed: 95 });
  scene.add(kidA.root, kidB.root);
  const P = buildProps(M, scene);
  const dust = new Dust(180, pxScale); scene.add(dust.points);
  const spark = new Sparkles(scene, 70);
  const shaft = new Shaft(); scene.add(shaft.mesh);

  const W = {
    scene, camera, rig, M, bed, kids, jail, man, officer, extras, fairy, kidA, kidB, P, dust, spark, shaft, timing,
    post: {}, sets: [bed.root, kids.root, jail.root], camTarget: new THREE.Vector3(),
  };

  W.reset = () => {
    W.post = {};
    W.dustAmt = 0.3; W.dustCol = '#fff0d6'; W.camFill = null;
    for (const s of W.sets) s.visible = false;
    for (const c of [man, officer, fairy, ...extras]) c.reset();
    for (const k of [kidA, kidB]) k.root.visible = false;
    for (const o of P.all) {
      o.visible = false;
      if (o.parent !== scene) scene.add(o);
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    }
    P.chapatiMesh.scale.set(1, 1, 1);
    P.pliers.userData.open(0);
    // bedroom defaults
    bed.bed.visible = true; bed.duvet.visible = true; bed.lump.visible = false; bed.pillow.visible = true;
    bed.pillow.position.copy(BED.pillow); bed.pillow.rotation.set(0, 0, 0);
    bed.stand.visible = true; bed.boatPic.visible = true;
    bed.lump.position.set(BED.x, 0.79, -1.6); bed.lump.scale.set(1, 1, 1);
    bed.rug.visible = true; bed.toothPic.visible = false; bed.clock.visible = true; bed.wardrobe.visible = true;
    bed.doors.forEach((d) => (d.piv.rotation.y = 0));
    setCurtains(bed, 1);
    setClock(bed, 10, 10);
    bed.sky.material = M.skyNight;
    M.shade.emissiveIntensity = 0; M.bulb.emissiveIntensity = 0;
    spark.reset();
    shaft.set(0);
    dust.set(0, new THREE.Vector3(), 0);
    for (const k of ['lamp', 'red', 'blue', 'fill']) rig[k].intensity = 0;
  };

  // ---- lighting presets -------------------------------------------------------
  // focus: point the shadow camera centres on; dir: direction light travels.
  W.light = (preset, o = {}) => {
    const L = PRESETS[preset];
    rig.hemi.color.set(L.sky); rig.hemi.groundColor.set(L.ground); rig.hemi.intensity = L.hemi;
    rig.key.color.set(L.keyCol); rig.key.intensity = L.key;
    const dir = new THREE.Vector3(...(o.dir || L.dir)).normalize();
    const focus = o.focus || new THREE.Vector3(0, 0.8, -1.6);
    rig.key.target.position.copy(focus);
    rig.key.position.copy(focus).addScaledVector(dir, -12);
    rig.key.shadow.camera.updateProjectionMatrix();
    if (L.lamp) { rig.lamp.color.set(L.lamp[0]); rig.lamp.intensity = L.lamp[1]; rig.lamp.position.set(...(o.lampPos || [0.65, 0.84, -2.78])); }
    if (L.fill) { rig.fill.color.set(L.fill[0]); rig.fill.intensity = L.fill[1]; rig.fill.position.set(...(o.fillPos || L.fill[2])); }
    if (L.shade !== undefined) { M.shade.emissiveIntensity = L.shade; M.bulb.emissiveIntensity = L.shade * 2; }
    if (L.sky_) bed.sky.material = M[L.sky_];
    W.post = { ...L.post, ...(o.post || {}) };
    W.camFill = o.camFill || L.camFill || null;
    // window shaft for bedroom presets
    if (L.shaft && !o.noShaft) {
      const x0 = WINDOW.x - WINDOW.w / 2 + 0.02, x1 = WINDOW.x + WINDOW.w / 2 - 0.02, y0 = 1.02, y1 = 2.08, z = -3.0;
      shaft.build([new THREE.Vector3(x0, y0, z), new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(x0, y1, z)], dir, 4.2);
      shaft.set(L.shaft[0], L.shaft[1]);
    }
  };

  // ---- camera ---------------------------------------------------------------
  // c: {pos, target, fov, roll}; hand: handheld amount; t: global time
  W.cam = (c, t, hand = 1) => {
    camera.position.set(...c.pos);
    const tg = new THREE.Vector3(...c.target);
    const dist = camera.position.distanceTo(tg);
    const a = hand * 0.006 * Math.max(0.35, Math.min(dist, 3));
    camera.position.x += wob(t * 0.9, 1) * a;
    camera.position.y += wob(t * 0.8, 2) * a * 0.8;
    camera.position.z += wob(t * 0.7, 3) * a * 0.6;
    camera.up.set(0, 1, 0);
    camera.lookAt(tg);
    camera.rotateY(wob(t * 1.1, 4) * 0.0035 * hand);
    camera.rotateX(wob(t * 1.3, 5) * 0.003 * hand);
    camera.rotateZ((c.roll || 0) + wob(t * 0.6, 6) * 0.004 * hand);
    camera.fov = c.fov || 40;
    camera.updateProjectionMatrix();
    W.camTarget = tg;
    if (W.camFill) {
      const [col, inten, off] = W.camFill;
      rig.fill.color.set(col);
      rig.fill.intensity = inten;
      camera.updateMatrixWorld(true);
      rig.fill.position.copy(camera.localToWorld(new THREE.Vector3(...(off || [0.35, 0.3, -0.2]))));
    }
    dust.mat.uniforms.center.value.copy(tg);
  };
  W.show = (...objs) => objs.forEach((o) => (o.visible = true));
  W.setClock = (h, m) => setClock(bed, h, m);
  W.setCurtains = (open, bulges, gap) => setCurtains(bed, open, bulges, gap);
  // lip-sync openness from the voiceover envelope (dB re peak), 1-frame lead
  W.talk = (t, gain = 1) => {
    const env = timing.env_db;
    const f = Math.round(t * 30) + 1;
    const db = env[clamp(f, 0, env.length - 1)];
    const o = clamp((db + 30) / 22) * gain;
    return o < 0.12 ? 0 : o < 0.4 ? 0.35 : o < 0.7 ? 0.65 : 1;
  };
  return W;
}

// sky/ground/hemi, key colour/intensity/direction, lamp, fill, post grade
const PRESETS = {
  evening: {
    sky: '#ffd9b8', ground: '#6e5a78', hemi: 1.1, keyCol: '#ffcf9a', key: 1.6, dir: [-0.55, -0.5, -0.65],
    lamp: ['#ffb066', 2.2], fill: ['#ffc58f', 1.2, [0.2, 1.6, 0.6]], shade: 1.4, sky_: 'skyDusk',
    post: { exposure: 1.05, tint: [1.05, 0.99, 0.93], bloomK: 0.4 },
  },
  night: {
    camFill: ['#ffcf9e', 2.6],
    sky: '#7b88c4', ground: '#2c2442', hemi: 1.0, keyCol: '#a8bbff', key: 1.7, dir: [-0.35, -0.55, 0.75],
    lamp: ['#ffa85c', 2.0], fill: ['#7f8fd0', 0.6, [0, 1.8, 0.8]], shade: 0.8, sky_: 'skyNight', shaft: [0.05, '#9fb4ff'],
    post: { exposure: 1.0, tint: [0.98, 1.0, 1.06], lift: [0.03, 0.03, 0.06], bloomK: 0.45 },
  },
  trap: {
    camFill: ['#b4c2ff', 6.0, [0.3, 0.4, 0.2]],
    sky: '#6472b4', ground: '#2a2244', hemi: 1.2, keyCol: '#9fb4ff', key: 2.8, dir: [-0.35, -0.55, 0.75],
    lamp: ['#ffa85c', 0], fill: ['#6c7cc8', 0.5, [0, 1.8, 0.8]], shade: 0, sky_: 'skyNight', shaft: [0.09, '#a9bcff'],
    post: { exposure: 1.12, tint: [0.96, 1.0, 1.08], lift: [0.02, 0.025, 0.06], bloomK: 0.5 },
  },
  morning: {
    sky: '#fff2e2', ground: '#c9a28c', hemi: 1.3, keyCol: '#ffd9a0', key: 3.2, dir: [-0.3, -0.5, 0.82],
    lamp: ['#ffb066', 0], fill: ['#ffd2a0', 1.6, [0.4, 1.0, -1.0]], shade: 0, sky_: 'skyDay', shaft: [0.1, '#ffe2b0'],
    post: { exposure: 0.95, tint: [1.04, 1.0, 0.95], bloomK: 0.35 },
  },
  day: {
    sky: '#fff4e8', ground: '#c7a491', hemi: 1.45, keyCol: '#ffe0b0', key: 3.4, dir: [-0.3, -0.62, 0.72],
    lamp: ['#ffb066', 0], fill: ['#ffdcb5', 1.2, [0.6, 1.6, 0.2]], shade: 0, sky_: 'skyDay', shaft: [0.06, '#ffe6bc'],
    post: { exposure: 1.0, tint: [1.03, 1.0, 0.96] },
  },
  kids: {
    camFill: ['#c4cbff', 2.6],
    sky: '#7684c4', ground: '#2a2244', hemi: 1.05, keyCol: '#a9bbff', key: 1.8, dir: [-0.2, -0.55, 0.8],
    lamp: ['#ffb45e', 1.4], fill: ['#8a95d8', 0.4, [40, 1.6, 0.5]],
    post: { exposure: 1.02, tint: [0.98, 1.0, 1.06], lift: [0.03, 0.025, 0.06], bloomK: 0.5 },
  },
  jail: {
    camFill: ['#ffe2c4', 0.9],
    sky: '#c9d6ff', ground: '#3a3240', hemi: 0.75, keyCol: '#ffd29a', key: 3.6, dir: [-0.45, -0.55, -0.7],
    lamp: ['#ffb066', 1.2], fill: ['#8fa3e0', 0.8, [80.4, 1.4, 1.0]],
    post: { exposure: 1.0, tint: [1.0, 0.99, 1.0], sat: 0.85, vig: 0.38 },
  },
  gold: {
    sky: '#fff0d0', ground: '#b98a5a', hemi: 1.3, keyCol: '#ffd590', key: 3.6, dir: [-0.35, -0.55, 0.76],
    lamp: ['#ffb066', 0], fill: ['#ffc65a', 2.4, [0, 1.4, -0.6]], shade: 0, sky_: 'skyDay', shaft: [0.08, '#ffd88f'],
    post: { exposure: 1.02, tint: [1.06, 1.0, 0.9], sat: 0.98, bloomK: 0.55, bloomThr: 0.8 },
  },
  eyes: {
    sky: '#8a90c8', ground: '#2c2442', hemi: 0.8, keyCol: '#a8bbff', key: 1.2, dir: [-0.35, -0.55, 0.75],
    lamp: ['#ffa85c', 1.0], fill: ['#ffc45a', 0.9, [0, 1.4, -2.0]], shade: 1.0, sky_: 'skyNight',
    post: { exposure: 0.98, tint: [1.02, 1.0, 1.0], bloomK: 0.45, bloomThr: 0.85 },
  },
};

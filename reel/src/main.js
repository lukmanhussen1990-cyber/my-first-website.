// Page entry: builds the renderer + compositor and exposes window.APP for the headless driver.
import * as THREE from 'three';
import { Cat } from './cat.js';
import { Human } from './human.js';
import { buildStreet, buildHouse } from './sets.js';
import * as O from './overlay.js';

const W = 1080, H = 1920, RW = 720, RH = 1280;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.createElement('canvas');
out.width = W; out.height = H;
const ctx = out.getContext('2d');
document.body.appendChild(out);

const cam = new THREE.PerspectiveCamera(45, RW / RH, 0.02, 400);
function aim(pos, target, fov = 45) {
  cam.fov = fov; cam.updateProjectionMatrix();
  cam.position.set(...pos);
  cam.lookAt(...target);
  cam.updateMatrixWorld();
}
function toScreen(v) {
  const p = v.clone().project(cam);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
}

// draw the 3D frame into the 1080x1920 canvas with an optional post filter + mood FX
function compose(fx = {}) {
  ctx.save();
  const filters = [];
  if (fx.bw) filters.push('grayscale(1) contrast(1.12) brightness(1.06)');
  if (fx.soft) filters.push(`blur(${fx.soft}px) sepia(0.3) saturate(0.9) brightness(1.08)`);
  ctx.filter = filters.join(' ') || 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  ctx.restore();
  if (fx.bw) O.vignette(ctx, 'rgba(255,255,255,0.95)', 0.5, 1.0, 1);
  if (fx.soft) { O.vignette(ctx, 'rgba(255,244,222,0.95)', 0.42, 0.95, 1); O.grain(ctx, fx.seed || 1, 0.05); }
  if (fx.red) O.vignette(ctx, 'rgba(90,0,0,0.75)', 0.55, 1.0, 1);
}

// ---------------- world ----------------
let world = null;
function getWorld() {
  if (world) return world;
  const street = buildStreet();
  const house = buildHouse();
  const hero = new Cat({ palette: 'orange', seed: 1 });
  const rival = new Cat({ palette: 'gray', seed: 7 });
  const mom = new Cat({ palette: 'cream', seed: 11, socks: false });
  const kitten = new Cat({ palette: 'orange', seed: 1, kitten: true });
  const man = new Human({ shirt: '#3e7d6e', pants: '#3a5684' });
  world = { street, house, hero, rival, mom, kitten, man };
  return world;
}
function place(obj, scene, x, z, rotY = 0, y = 0) {
  scene.add(obj.root);
  obj.root.position.set(x, y, z);
  obj.root.rotation.set(0, rotY, 0);
  obj.root.visible = true;
}
function hideAll(w) { for (const k of ['hero', 'rival', 'mom', 'kitten', 'man']) { w[k].root.visible = false; w[k].root.parent?.remove(w[k].root); } }
const cap = (text, activeIdx) => text.split(' ').map((t, i) => ({ text: t, active: i === activeIdx }));

const STILLS = {
  man_test(w) {
    const S = w.house;
    place(w.man, S.scene, -0.6, -0.6, 0.5);
    w.man.update({ t: 0, walking: true, walkPhase: 0.15 });
    place(w.hero, S.scene, 0.2, -0.4, -0.5);
    w.hero.update({ t: 0.4, tailLift: 1.3 });
    aim([0.4, 1.0, 2.2], [-0.3, 0.8, -0.6], 50);
    renderer.render(S.scene, cam);
    compose();
  },
  man_test2(w) {
    const S = w.house;
    place(w.man, S.scene, -0.6, -0.6, Math.PI / 2);
    w.man.update({ t: 0, walking: true, walkPhase: 0.4 });
    aim([-0.5, 0.9, 2.4], [-0.6, 0.85, -0.6], 50);
    renderer.render(S.scene, cam);
    compose();
  },
  look_street(w) {
    const S = w.street; S.setMood('day');
    place(w.hero, S.scene, -0.2, -2.9, Math.PI / 2);
    place(w.rival, S.scene, 0.24, -2.95, -Math.PI / 2);
    w.hero.update({ t: 0.4, tailLift: 0.35, tailSway: 0.3, earsBack: 0.2 });
    w.rival.update({ t: 0.9, tailLift: 0.2, crouch: 0.3, earsBack: 0.3 });
    aim([0.55, 0.2, -1.95], [0.02, 0.24, -2.95], 42);
    renderer.render(S.scene, cam);
    compose();
    O.drawCaption(ctx, cap('ADULT CATS ALMOST NEVER', 3));
  },
  look_meow(w) {
    const S = w.street; S.setMood('day');
    place(w.hero, S.scene, -0.15, -2.9, 0.9);
    place(w.rival, S.scene, -0.55, -3.25, 1.2);
    place(w.man, S.scene, 0.75, -3.35, -Math.PI / 2 + 0.3);
    w.man.update({ t: 0, walking: true, walkPhase: 0.15 });
    w.hero.update({ t: 0.4, tailLift: 1.45, tailHook: 0.7, mouth: 'open', lookTarget: new THREE.Vector3(0.75, 0.9, -3.35) });
    w.rival.update({ t: 0.9, tailLift: 0.3, sit: 1 });
    aim([-0.45, 0.24, -1.85], [0.15, 0.4, -3.1], 46);
    renderer.render(S.scene, cam);
    compose();
    const hp = toScreen(w.hero.headWorld(new THREE.Vector3(0, 0.05, 0.05)));
    O.drawBurst(ctx, hp[0] + 40, hp[1] - 230, 230, 330, 18, 0.9, 2);
    O.drawBubble(ctx, 'MEOW!', hp[0] + 40, hp[1] - 230, { style: 'comic', size: 120, font: 'Luckiest Guy', tail: [hp[0] + 10, hp[1] - 40], wobble: -0.06 });
    O.drawCaption(ctx, cap("IT'S ONLY FOR YOU", 3));
  },
  look_chips(w) {
    const S = w.house;
    place(w.hero, S.scene, -1.1, -0.7, 0.35);
    place(w.rival, S.scene, -0.55, -0.35, -2.4);
    w.hero.update({ t: 0.4, tailLift: 1.3, tailHook: 0.5, headYaw: 0.4 });
    w.rival.update({ t: 1.4, tailLift: 0.25, crouch: 0.2, earsBack: 0.4 });
    aim([-0.25, 0.32, 0.6], [-0.85, 0.24, -0.55], 46);
    renderer.render(S.scene, cam);
    compose();
    const row = O.chipRow(ctx, [{ text: 'TAIL', color: 'pink' }, { text: 'SMELL', color: 'pink' }, { text: 'STARE', color: 'pink' }, { text: 'HISS', color: 'yellow' }], 300);
    row.forEach((c) => O.drawChip(ctx, c.text, c.x, c.y, { color: c.color }));
    O.drawCaption(ctx, cap('THEY TALK WITH THEIR BODIES', 4));
  },
  look_kitchen(w) {
    const S = w.house;
    S.setKibble(28);
    place(w.hero, S.scene, 3.42, -1.28, 0.75);
    place(w.man, S.scene, 4.3, -0.95, -2.2);
    const bowl = S.bowl.position;
    w.man.update({ t: 0, crouch: 0.3, lean: 0.4, handR: new THREE.Vector3(0.12, 0.55, 0.5), headPitch: -0.5 });
    w.man.root.updateMatrixWorld(true);
    S.bag.visible = true;
    S.bag.position.copy(w.man.arms[1].hand.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.02, 0));
    S.bag.rotation.set(0.9, -2.5, 0);
    w.hero.update({ t: 0.4, sit: 1, lookTarget: new THREE.Vector3(4.1, 0.75, -1.0) });
    aim([2.95, 0.95, 0.35], [3.82, 0.3, -1.3], 50);
    renderer.render(S.scene, cam);
    compose();
    O.drawChip(ctx, 'IT WORKS', 540, 300, { color: 'green', size: 70 });
    O.drawCheck(ctx, 760, 300, 70);
    O.drawCaption(ctx, cap('MEOW... FOOD.', 0));
    S.bag.visible = false;
  },
  look_red(w) {
    const S = w.street; S.setMood('red');
    place(w.rival, S.scene, 0.1, -3.5, 0.5);
    w.rival.update({ t: 0.4, sit: 1, headPitch: -0.3, tailLift: 0.2, earsBack: 0.25 });
    aim([-0.3, 0.22, -2.45], [0.05, 0.62, -3.8], 52);
    renderer.render(S.scene, cam);
    compose({ red: true });
    O.drawCaption(ctx, cap('NOBODY ANSWERS.', 0));
    S.setMood('day');
  },
  look_flashback(w) {
    const S = w.house;
    place(w.mom, S.scene, 1.28, 0.5, 0.35);
    place(w.kitten, S.scene, 0.95, 0.84, -0.4);
    w.mom.update({ t: 0.4, crouch: 1, sit: 0, headYaw: -0.55, headPitch: -0.1, eyes: 'half', tailLift: 0.0, tailCurl: 0.3 });
    w.kitten.update({ t: 0.6, sit: 1, mouth: 'open', headPitch: 0.25, headYaw: 0.3 });
    aim([0.55, 0.22, 1.35], [1.0, 0.13, 0.7], 44);
    renderer.render(S.scene, cam);
    compose({ soft: 2.2, seed: 3 });
    const kp = toScreen(w.kitten.headWorld(new THREE.Vector3(0, 0.07, 0.03)));
    O.drawBubble(ctx, 'mew!', kp[0] + 60, kp[1] - 140, { style: 'rect', size: 60, tail: [kp[0] + 10, kp[1] - 20] });
    O.drawCaption(ctx, cap('KITTENS MEOW TO CALL MOM', 4));
  },
  look_bw(w) {
    const S = w.street; S.setMood('day');
    place(w.rival, S.scene, 0.12, -2.95, -0.5);
    w.rival.update({ t: 0.4, hiss: 1, tailLift: 0.4 });
    const hp = w.rival.headWorld(new THREE.Vector3(0, 0, 0));
    aim([hp.x - 0.12, hp.y + 0.03, hp.z + 0.5], [hp.x, hp.y - 0.04, hp.z], 42);
    renderer.render(S.scene, cam);
    compose({ bw: true });
    O.drawChip(ctx, 'HISS', 540, 300, { color: 'yellow', size: 72 });
    O.drawCaption(ctx, cap('AND IF THAT FAILS... HISS.', 4));
  },
  look_ending(w) {
    const S = w.house;
    place(w.hero, S.scene, -1.0, -1.2, 0.15, 0.4);
    w.hero.update({ t: 0.4, sit: 1, eyes: 'closed', tailLift: 0.4 });
    const hp = w.hero.headWorld(new THREE.Vector3(0, 0, 0));
    aim([hp.x + 0.04, hp.y - 0.005, hp.z + 0.36], [hp.x, hp.y - 0.025, hp.z], 40);
    renderer.render(S.scene, cam);
    compose();
    O.drawHeart(ctx, 800, 520, 150);
    O.drawCaption(ctx, cap('MADE JUST FOR YOU', 3));
  },
};

window.APP = {
  stillNames: () => Object.keys(STILLS),
  renderStill(name) {
    const w = getWorld();
    hideAll(w);
    STILLS[name](w);
    O.drawWatermark(ctx);
    return out.toDataURL('image/jpeg', 0.92);
  },
};

document.fonts.load('88px Anton').then(() => document.fonts.load('88px "Luckiest Guy"')).then(() => { window.APP_READY = true; });

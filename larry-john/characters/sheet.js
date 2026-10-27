// Character sheet renderer: each "frame" is one panel (front/side views and 6 faces per character).
import * as THREE from 'three';
import { Stage } from '../engine/toon/stage.js';
import { POSES, ZERO_POSE, mergePose } from '../engine/toon/rig.js';
import { makeLarry } from './larry.js';
import { makeJohn } from './john.js';
import { makeGhost } from './ghost.js';
import { clay } from '../engine/toon/materials.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1080;
const stage = new Stage({ width: W, height: H, quality: q.get('quality') || 'high', toneMapping: q.get('tm') || 'neutral' });
const { scene, camera } = stage;

const STUDIO = {
  sky: { top: '#8fa6d8', mid: '#b9c8ea', horizon: '#e9e3f0', ground: '#d8d4dc' },
  sun: { color: '#fff3e2', intensity: 2.6, dir: [0.6, 1.0, 0.8] },
  hemi: { sky: '#d6e2ff', ground: '#9c9a8a', intensity: 1.1 },
  fill: { color: '#ffffff', intensity: 0.5 }, rim: { color: '#cfe0ff', intensity: 1.2, dir: [-0.4, 0.7, -1] },
  fog: { color: '#e9e3f0', near: 50, far: 200 }, exposure: 1.0,
  bloom: { strength: 0.25, radius: 0.4, threshold: 0.95 },
  grade: { saturation: 1.08, contrast: 1.04, vignette: 0.12 },
};
stage.applyLook(STUDIO);
stage.setShadowFocus([0, 0.6, 0], 2.5);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), clay('#d9dbe0', { roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const larry = makeLarry(), john = makeJohn(), ghost = makeGhost();
const larrySheet = makeLarry(); larrySheet.setSheet(true);
scene.add(larry, john, ghost, larrySheet);
const CH = { larry, john, ghost, larrySheet };
const HEAD = { larry: 0.94, john: 1.24, ghost: 0.94, larrySheet: 0.95 };
const HEIGHT = { larry: 1.25, john: 1.55, ghost: 1.32, larrySheet: 1.32 };
const FACES = ['happy', 'shocked', 'scared', 'screaming', 'bored', 'annoyed'];
const panels = [];
for (const c of ['larry', 'larrySheet', 'john', 'ghost']) {
  panels.push({ c, view: 'front' }, { c, view: 'side' });
  for (const e of FACES) panels.push({ c, view: 'face', e });
}

function show(p) {
  for (const k in CH) CH[k].visible = k === p.c;
  const ch = CH[p.c];
  const t = 1.3;
  if (p.c === 'ghost') {
    ghost.position.set(0, 0.25, 0);
    ghost.face.set(p.e || 'happy', { blush: 1 });
    ghost.set({ t, armWave: 1, armUp: p.e === 'screaming' || p.e === 'scared' ? 0.6 : 0, stretch: p.e === 'screaming' ? 1.1 : 1 });
  } else {
    const isSheet = p.c === 'larrySheet';
    let pose = mergePose(ZERO_POSE, p.view === 'face' ? {} : {});
    if (isSheet) {
      ch.setFace && ch.sheet.face.set(p.e || 'happy', { mouthPush: p.e === 'screaming' ? 1 : 0 });
      ch.sheet.set({ mouthPush: p.e === 'screaming' ? 1 : 0, sway: 0.6 });
      pose = mergePose(pose, { armL: { fwd: 40, out: 25, elbow: 50 } });
    } else {
      ch.setFace(p.e || 'neutral', {}, null);
      if (p.view !== 'face' && p.c === 'larry') pose = mergePose(pose, { armL: { fwd: 30, out: 12, elbow: 55 } });
    }
    ch.applyPose(pose);
    ch.idle(t, 0.3);
  }
  // camera
  const hh = HEAD[p.c];
  if (p.view === 'front') { camera.fov = 30; camera.position.set(0, HEIGHT[p.c] * 0.55, HEIGHT[p.c] * 3.1); camera.lookAt(0, HEIGHT[p.c] * 0.5, 0); ch.rotation.y = 0; }
  if (p.view === 'side') { camera.fov = 30; camera.position.set(0, HEIGHT[p.c] * 0.55, HEIGHT[p.c] * 3.1); camera.lookAt(0, HEIGHT[p.c] * 0.5, 0); ch.rotation.y = -Math.PI / 2; }
  if (p.view === 'face') { camera.fov = 28; camera.position.set(0, hh + 0.03, 1.45); camera.lookAt(0, hh, 0); ch.rotation.y = 0; }
  camera.aspect = W / H; camera.updateProjectionMatrix();
}

window.APP = {
  ready: false,
  info: () => ({ frames: panels.length, panels }),
  async renderTime(i) { show(panels[Math.round(i)]); stage.renderNow(); },
  async sendPNG(rel) { await stage.sendPNG(rel); },
};
document.fonts.ready.then(() => { window.APP.ready = true; });

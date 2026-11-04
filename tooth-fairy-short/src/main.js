// Entry point: builds the world and exposes a deterministic per-frame API
// (window.renderFrame / window.saveFrame) for the headless render driver.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Post } from './post.js';
import { Overlay } from './overlay.js';
import { FPS, BLACK_FRAME, CUTS, sceneAt } from './timeline.js';
import { SHOTS } from './shots.js';
import { setAniso } from './tex.js';

const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const timing = await (await fetch('../assets/timing.json')).json();
await document.fonts.load('800 66px InterX');
await document.fonts.load('700 116px MontX');

const world = buildWorld(renderer, timing, H / 1920);
if (qs.get('shadow')) { const n = parseInt(qs.get('shadow'), 10); world.rig.key.shadow.mapSize.set(n, n); }
const post = new Post(renderer, W, H);
const overlay = new Overlay(W, H);

function renderFrame(f) {
  const t = f / FPS;
  const i = sceneAt(f);
  const black = f >= BLACK_FRAME;
  world.reset();
  const start = CUTS[i] / FPS, end = CUTS[i + 1] / FPS;
  SHOTS[i](world, t - start, t, end - start);
  if (qs.get('cam')) {
    // debug: ?cam=x,y,z,tx,ty,tz,fov overrides the shot camera
    const c = qs.get('cam').split(',').map(Number);
    world.cam({ pos: c.slice(0, 3), target: c.slice(3, 6), fov: c[6] || 40 }, t, 0);
  }
  world.dust.set(t, world.camTarget, world.dustAmt, world.dustCol);
  overlay.draw(f, i, black);
  post.render(world.scene, world.camera, { ...world.post, time: t, black: black ? 1 : 0 }, qs.get('nocap') ? null : overlay.tex);
}

async function saveFrame(f, type = 'image/jpeg', quality = 0.95) {
  renderFrame(f);
  const blob = await new Promise((r) => renderer.domElement.toBlob(r, type, quality));
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const res = await fetch(`/save?f=${f}&ext=${ext}`, { method: 'POST', body: blob });
  if (!res.ok) throw new Error('save failed ' + res.status);
  return true;
}

window.renderFrame = renderFrame;
window.saveFrame = saveFrame;
window.world = world;
window.ready = true;

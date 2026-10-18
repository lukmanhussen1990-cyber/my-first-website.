import * as THREE from 'three';
import { Post, POST_DEFAULTS } from './core/post.js';
import { Overlay, drawCaption } from './core/overlay.js';
import { loadAssets } from './core/assets.js';
import { buildShots } from './shots/index.js';
import { buildCaptions } from './captions.js';

const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');
const W = Math.round(1080 * SCALE);
const H = Math.round(1920 * SCALE);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);

const assets = await loadAssets(renderer);
const post = new Post(renderer, W, H);
const overlay = new Overlay(W, H, SCALE);
const E = assets.timing.events;
const ctx = { renderer, W, H, SCALE, post, overlay, assets, tex: assets.tex, E };
const shots = await buildShots(ctx);
const captions = buildCaptions(E);
const pixels = new Uint8Array(W * H * 4);

function shotAt(t) {
  for (const s of shots) if (t >= s.t0 && t < s.t1) return s;
  return shots[shots.length - 1];
}

function renderFrame(t) {
  const shot = shotAt(t);
  const p = { ...POST_DEFAULTS, ...(shot.render(t) || {}) };
  overlay.begin();
  shot.overlay?.(overlay.ctx, t, p);
  const shake = p.textShake || [0, 0];
  for (const cap of captions) drawCaption(overlay.ctx, cap, t, shake);
  overlay.end();
  post.finish(p, t, overlay.texture);
}

window.renderFrame = renderFrame;
window.renderAndSend = async (t, idx) => {
  renderFrame(t);
  post.readPixels(pixels);
  const res = await fetch(`/frame?i=${idx}`, { method: 'POST', body: pixels });
  if (!res.ok) throw new Error('frame upload failed');
};
window.__info = { W, H, duration: assets.timing.duration, fps: assets.timing.fps };
window.__ready = true;

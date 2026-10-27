// Page entry: builds the renderer, world and plan, and exposes window.APP for the headless driver.
import * as THREE from 'three';
import { Cat } from './cat.js';
import { Human } from './human.js';
import { buildStreet, buildHouse, ASSETS } from './sets.js';
import { makePlan } from './plan.js';
import { clamp, smooth } from './rig.js';
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
const tmp = document.createElement('canvas');
tmp.width = W; tmp.height = H;
const tctx = tmp.getContext('2d');

const cam = new THREE.PerspectiveCamera(45, RW / RH, 0.02, 400);
const UPV = new THREE.Vector3(0, 1, 0);
function setCam(pos, look, fov = 45, up = UPV) {
  cam.up.copy(up);
  cam.fov = fov; cam.updateProjectionMatrix();
  cam.position.copy(pos);
  cam.lookAt(look);
  cam.updateMatrixWorld();
}
function toScreen(v) {
  const p = v.clone().project(cam);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z];
}

// ---------------------------------------------------------------- world
let world, plan, tl;
function place(obj, set, x, z, rotY = 0, y = 0) {
  set.scene.add(obj.root);
  obj.root.position.set(x, y, z);
  obj.root.rotation.set(0, rotY, 0);
  obj.root.visible = true;
}
function resetWorld() {
  for (const k of ['hero', 'rival', 'mom', 'kitten', 'man']) {
    world[k].root.visible = false;
    world[k].root.parent?.remove(world[k].root);
  }
  world.hero.setAge(1);
  world.street.setMood('day');
  world.house.setKibble(0);
  world.house.setDoor(0);
  world.house.bag.visible = false;
  world.house.clip.visible = false;
}

// ---------------------------------------------------------------- captions
// Split each part into 2-4 word caption chunks: phrases break at punctuation / pauses, then a small DP picks
// natural boundaries (no chunk ending on "at/the/your...", prefer breaking before "at/with/than...").
const BAD_END = { a: 2.2, an: 2.2, the: 2.2, your: 2.2, its: 2.2, their: 2.2, my: 2.2, no: 2, to: 1.6, at: 1.6, of: 1.6, for: 1.6, with: 1.6, and: 1.6, in: 1.6, on: 1.6, that: 1.4, if: 1.4, so: 1.2, than: 1.6 };
const KEEP_TOGETHER = ['made just for you.'];
const GOOD_START = new Set(['at', 'to', 'with', 'for', 'of', 'and', 'but', 'in', 'on', 'than', 'just', 'because']);
const wnorm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
function chunkPhrase(ws) {
  const n = ws.length;
  const best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let sz = 1; sz <= Math.min(4, i); sz++) {
      const j = i - sz;
      const chunk = ws.slice(j, i);
      const txt = chunk.map((w) => w.w).join(' ');
      let c = (sz - 2.6) ** 2 * 0.6;
      if (txt.length > 19) c += (txt.length - 19) * 0.6;
      if (sz === 1 && n > 1 && !(chunk[0].w.length >= 6 && /[.?!…:]$/.test(chunk[0].w))) c += 1.4;
      if (i < n) c += BAD_END[wnorm(chunk[sz - 1].w)] || 0;
      if (i < n && GOOD_START.has(wnorm(ws[i].w))) c -= 0.5;
      for (let k = j + 1; k < i; k++) if (ws[k].s - ws[k - 1].e > 0.35) c += 3;
      if (best[j] + c < best[i]) { best[i] = best[j] + c; prev[i] = j; }
    }
  }
  const out = [];
  for (let i = n; i > 0; i = prev[i]) out.unshift(ws.slice(prev[i], i));
  return out;
}
function chunkWords(words) {
  const phrases = [];
  let cur = [];
  words.forEach((w, i) => {
    const prevW = words[i - 1];
    if (cur.length && prevW && w.s - prevW.e > 0.38) { phrases.push(cur); cur = []; }
    cur.push(w);
    const next = words[i + 1];
    if (/[.?!…:]$/.test(w.w) || (/,$/.test(w.w) && cur.length >= 2 && next)) { phrases.push(cur); cur = []; }
  });
  if (cur.length) phrases.push(cur);
  const split = (ph) => {
    const tail = ph.map((w) => w.w.toLowerCase()).join(' ');
    const keep = KEEP_TOGETHER.find((k) => tail.endsWith(k));
    if (!keep) return chunkPhrase(ph);
    const nk = keep.split(' ').length;
    return [...(ph.length > nk ? chunkPhrase(ph.slice(0, -nk)) : []), ph.slice(-nk)];
  };
  return phrases.flatMap(split).map((c) => ({ words: c, s: c[0].s - 0.06, e: c[c.length - 1].e }));
}
let CHUNKS = [];
function buildCaptions() {
  CHUNKS = [];
  for (const p of tl.parts) {
    const ch = chunkWords(p.words);
    ch.forEach((c, i) => {
      const nxt = ch[i + 1];
      c.end = nxt ? Math.min(nxt.s, c.e + 0.55) : c.e + 0.45;
      if (nxt && nxt.s - c.e < 0.55) c.end = nxt.s;
      CHUNKS.push(c);
    });
  }
}
function drawCaptions(t) {
  const c = CHUNKS.find((c) => t >= c.s && t < c.end);
  if (!c) return;
  let active = -1;
  c.words.forEach((w, i) => { if (t >= w.s - 0.03) active = i; });
  const words = c.words.map((w, i) => ({ text: w.w.toUpperCase(), active: i === active }));
  O.drawCaption(ctx, words, { age: t - c.s });
}

// ---------------------------------------------------------------- overlay events
function anchorPoint(ev) {
  if (ev.at3d) return ev.at3d;
  if (ev.whoMan && world.man.root.visible) return world.man.head.localToWorld(new THREE.Vector3(0, 0.16, 0));
  if (ev.who && world[ev.who] && world[ev.who].root.visible) return world[ev.who].headWorld(new THREE.Vector3(0, 0.06, 0.01));
  return null;
}
function screenAnchor(ev, fallback = [W / 2, 700]) {
  const p = anchorPoint(ev);
  if (!p) return fallback;
  const s = toScreen(p);
  if (s[2] > 1) return fallback;
  return [s[0], s[1]];
}
const clampX = (x, half) => clamp(x, 40 + half, W - 40 - half);
const clampY = (y, half) => clamp(y, 200 + half, 1200 - half);

function drawEvents(t) {
  const rows = {};
  for (const ev of plan.events) if (ev.type === 'chip' && ev.row) (rows[ev.row] ||= []).push(ev);
  for (const ev of plan.events) {
    if (ev.t0 === undefined || t < ev.t0 || t >= ev.t1) continue;
    const age = t - ev.t0;
    if (ev.type === 'chip') {
      let x = W / 2, y = ev.y || 300;
      if (ev.row) {
        const items = rows[ev.row].slice().sort((a, b) => a.idx - b.idx);
        const lay = O.chipRow(ctx, items, ev.y || 300, ev.size || 64);
        const me = lay.find((l) => l.idx === ev.idx);
        x = me.x; y = me.y;
      }
      O.drawChip(ctx, ev.text, x, y, { color: ev.color, size: ev.size || 64, age });
      if (ev.check) {
        const w = O.chipSize(ctx, ev.text, ev.size || 64).w;
        O.drawCheck(ctx, x + w / 2 + 70, y, 80, { age: age - 0.12 });
      }
    } else if (ev.type === 'bubble') {
      const [ax, ay] = screenAnchor(ev);
      ctx.font = `${ev.size || 64}px ${ev.font || 'Anton'}`;
      const half = ctx.measureText(ev.text).width / 2 + (ev.style === 'comic' ? (ev.size || 64) * 0.8 : (ev.size || 64) * 0.45);
      const bx = clampX(ax + (ev.dx || 0), half);
      const by = clampY(ay + (ev.dy || -200), (ev.size || 64) * (ev.style === 'comic' ? 1.1 : 0.75));
      const wob = ev.wobbleAmp ? Math.sin(t * 18) * ev.wobbleAmp : (ev.style === 'comic' ? -0.05 : 0);
      if (ev.burst) O.drawBurst(ctx, bx, by, half * 1.05, half * 1.45, 18, clamp(1 - (age - 0.6) / 0.4, 0, 1) * 0.9, 2);
      O.drawBubble(ctx, ev.text, bx, by, { style: ev.style, size: ev.size || 64, age, font: ev.font || 'Anton', tail: [ax, ay + 10], wobble: wob });
    } else if (ev.type === 'sticker') {
      const [ax, ay] = screenAnchor(ev);
      const x = clampX(ax + (ev.dx || 0), (ev.size || 100) * 0.6);
      const y = clampY(ay + (ev.dy || -180), (ev.size || 100) * 0.6);
      if (ev.kind === 'heart') {
        const float = Math.min(age, 1.2) * -40;
        O.drawHeart(ctx, x, y + float, (ev.size || 110) * (1 + 0.05 * Math.sin(age * 6)), { age });
      } else if (ev.kind === 'q') {
        O.drawMark(ctx, '?', x, y, ev.size || 120, { age, rot: (ev.rot || 0) + Math.sin(age * 7) * 0.12 });
      } else if (ev.kind === 'ex') {
        O.drawMark(ctx, '!', x, y, ev.size || 120, { age, color: ev.color || '#FFD21F', rot: Math.sin(age * 9) * 0.08 });
      } else if (ev.kind === 'check') {
        O.drawCheck(ctx, x, y, ev.size || 100, { age });
      } else if (ev.kind === 'sparkles') {
        for (let i = 0; i < 9; i++) {
          const a = i * 2.39996 + age * 1.5;
          const r = (ev.size || 220) * (0.35 + 0.65 * ((i * 37) % 10) / 10);
          const tw = Math.max(0, Math.sin(age * 9 + i * 1.7));
          O.drawSparkle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 18 + 22 * tw, clamp(1.2 - age, 0, 1));
        }
      }
    }
  }
}
function fxAmount(kind, t) {
  let a = 0;
  for (const ev of plan.events) {
    if (ev.type !== 'fx' || ev.kind !== kind) continue;
    const f = ev.fade || 0.08;
    a = Math.max(a, clamp((t - ev.t0) / f, 0, 1) * clamp((ev.t1 - t) / f, 0, 1));
  }
  return a;
}
function shakeOffset(t) {
  let amp = 0;
  for (const ev of plan.events) if (ev.type === 'shake' && t >= ev.t0 && t < ev.t1) amp = Math.max(amp, ev.amp * (1 - (t - ev.t0) / (ev.t1 - ev.t0)));
  if (!amp) return null;
  return new THREE.Vector3(Math.sin(t * 91.3) * amp, Math.sin(t * 77.1 + 1) * amp, Math.sin(t * 63.7 + 2) * amp * 0.5);
}

// ---------------------------------------------------------------- compositing
function compose(t) {
  const bw = fxAmount('bw', t), soft = fxAmount('soft', t), red = fxAmount('red', t);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  ctx.restore();
  if (soft > 0) {
    tctx.filter = 'blur(2.6px) sepia(0.35) saturate(0.9) brightness(1.08)';
    tctx.drawImage(out, 0, 0);
    tctx.filter = 'none';
    ctx.save(); ctx.globalAlpha = soft; ctx.drawImage(tmp, 0, 0); ctx.restore();
    O.vignette(ctx, 'rgba(255,244,222,0.95)', 0.42, 0.95, soft);
    O.grain(ctx, Math.floor(t * 30), 0.05 * soft);
  }
  if (bw > 0) {
    tctx.filter = 'grayscale(1) contrast(1.15) brightness(1.06)';
    tctx.drawImage(out, 0, 0);
    tctx.filter = 'none';
    ctx.save(); ctx.globalAlpha = bw; ctx.drawImage(tmp, 0, 0); ctx.restore();
    O.vignette(ctx, 'rgba(255,255,255,0.95)', 0.5, 1.0, bw);
  }
  if (red > 0) O.vignette(ctx, 'rgba(80,0,0,0.8)', 0.52, 1.0, red);
}

function renderAt(t) {
  resetWorld();
  let i = 0;
  while (i + 1 < plan.shots.length && plan.shots[i + 1].t0 <= t) i++;
  const s = plan.shots[i];
  const t1 = plan.shots[i + 1] ? plan.shots[i + 1].t0 : tl.total;
  const D = Math.max(0.001, t1 - s.t0), L = Math.max(0, t - s.t0);
  s.run(L, D, clamp(L / D, 0, 1), world);
  const sh = shakeOffset(t);
  if (sh) { cam.position.add(sh); cam.rotation.z += sh.x * 2; cam.updateMatrixWorld(); }
  const set = s.set === 'street' ? world.street : world.house;
  renderer.render(set.scene, cam);
  compose(t);
  drawEvents(t);
  drawCaptions(t);
  for (const ev of plan.events) {
    if (ev.type === 'flash' && t >= ev.t && t < ev.t + ev.dur) O.flash(ctx, 1 - (t - ev.t) / ev.dur, ev.color);
  }
  O.drawWatermark(ctx);
}

async function loadImages() {
  // optional GPT Image swap-ins: assets/images/<key>.png (listed in assets/images/index.json)
  try {
    const list = await (await fetch('assets/images/index.json')).json();
    await Promise.all(list.map((key) => new Promise((res) => {
      const img = new Image();
      img.onload = () => { ASSETS[key] = img; res(); };
      img.onerror = res;
      img.src = `assets/images/${key}.png`;
    })));
  } catch (e) { /* no images: procedural textures */ }
}

async function init() {
  tl = await (await fetch('assets/timeline.json')).json();
  await loadImages();
  world = {
    street: buildStreet(), house: buildHouse(),
    hero: new Cat({ palette: 'orange', seed: 1 }),
    rival: new Cat({ palette: 'gray', seed: 7 }),
    mom: new Cat({ palette: 'cream', seed: 11, socks: false }),
    kitten: new Cat({ palette: 'orange', seed: 1, kitten: true }),
    man: new Human({ shirt: '#3e7d6e', pants: '#3a5684' }),
  };
  plan = makePlan(tl, { cam: setCam, place, camPos: () => cam.position.clone() });
  buildCaptions();
  await document.fonts.load('88px Anton');
  await document.fonts.load('88px "Luckiest Guy"');
  window.APP_READY = true;
}

window.APP = {
  frameCount: () => Math.ceil(tl.total * tl.fps),
  renderFrame(f) { renderAt(f / tl.fps); return out.toDataURL('image/jpeg', 0.93); },
  renderTime(t) { renderAt(t); return out.toDataURL('image/jpeg', 0.92); },
  sfxEvents: () => plan.events.filter((e) => e.type === 'sfx'),
  stillNames: () => [],
};

init();

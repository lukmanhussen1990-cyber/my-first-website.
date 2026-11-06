import * as THREE from 'three';
import { CONFIG } from './config.js';
import { loadStory } from './stories.js';
import { compileTimeline, contentTime, sampleActors, activeShot, shakeAt, inFreeze, activeCaption } from './director.js';
import { buildWorld, WORLD } from './world.js';
import { makeHuman, makeDog } from './characters.js';
import { makeCardboardBox, makeLadder, makeToilet, makePee, makeParticles, LADDER_LEN } from './props.js';
import { drawCaption, drawSfx, drawWatermark } from './captions.js';
import { clamp, lerp, ease, DEG } from './anim.js';

const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');
const DEBUG = params.has('debug');
const RENDER_MODE = params.has('render');
const STORY = await loadStory(params.get('story') || 'ladder');
const TIMELINE = STORY.TIMELINE;
const W = CONFIG.width, H = CONFIG.height, FPS = CONFIG.fps;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);

// ------------------------------------------------------------------ scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.05, 200);
buildWorld(scene, STORY.SET);

const CAST = STORY.CAST || { you: CONFIG.you, friend: { ...CONFIG.friend, brow: '#1d1209' } };
const HUMANS = Object.keys(CAST);
const actors = {
  ...Object.fromEntries(HUMANS.map((n) => [n, makeHuman(CAST[n])])),
  dog: makeDog(),
  ladder: makeLadder(),
  box1: makeCardboardBox(1),
  box2: makeCardboardBox(2),
  box3: makeCardboardBox(3),
};
for (const a of Object.values(actors)) scene.add(a.root);
const toilet = makeToilet();
toilet.position.set(WORLD.toilet.x, WORLD.bathFloor, WORLD.toilet.z);
scene.add(toilet);
const pee = makePee();
scene.add(pee.stream, pee.puddle);
const particles = makeParticles();
scene.add(particles.mesh);

// ------------------------------------------------------------------ timeline
let voTiming = {};
try {
  const r = await fetch(`build/${STORY.id}/vo.json`, { cache: 'no-store' });
  if (r.ok) voTiming = await r.json();
} catch {}
const TL = compileTimeline(TIMELINE, voTiming);
window.TL = TL;

const tmpV = new THREE.Vector3();
const WALL_Z = 0.03;

function applyActors(st, ct) {
  // ladder first (people can stand on it)
  const ls = st.ladder || { vis: false };
  if (ls.wall) {
    const lean = (ls.lean ?? 0) * DEG;
    ls.p = [(ls.p || [0, 0])[0], WALL_Z + LADDER_LEN * Math.sin(lean)];
  }
  actors.ladder.apply(ls);
  for (const name of ['box1', 'box2', 'box3']) actors[name].apply(st[name] || { vis: false });
  for (const name of HUMANS) {
    const s = { ...(st[name] || { vis: false }) };
    if (s.on === 'ladder') {
      actors.ladder.point(s.s ?? 1, s.out ?? 0.16, tmpV);
      const m = clamp(s.onMix ?? 1);
      s.x = lerp(s.x ?? tmpV.x, tmpV.x, m);
      s.y = lerp(s.y ?? tmpV.y, tmpV.y, m);
      s.z = lerp(s.z ?? tmpV.z, tmpV.z, m);
    }
    actors[name].apply(s);
  }
  const ds = st.dog || { vis: false };
  actors.dog.apply(ds);
  pee.apply(ds, ct, (ds.pee ?? 0) > 0 ? actors.dog.rearWorld(new THREE.Vector3()) : null);
  scene.updateMatrixWorld(true);
}

function anchorOf(name, part) {
  const a = actors[name];
  if (part === 'head') return a.head.localToWorld(new THREE.Vector3(0, 0.17, 0));
  if (part === 'hips') return a.hips.getWorldPosition(new THREE.Vector3());
  return a.root.getWorldPosition(new THREE.Vector3());
}

const anchorCache = new Map();
function shotAnchor(shot) {
  if (!shot.track) return null;
  const key = shot.start + shot.track.actor + (shot.track.part || '');
  if (!anchorCache.has(key)) {
    const st = sampleActors(TL, shot.start + (shot.track.at ?? 0));
    applyActors(st, shot.start);
    anchorCache.set(key, anchorOf(shot.track.actor, shot.track.part || 'head'));
  }
  return anchorCache.get(key);
}

function setCamera(shot, t, ct) {
  const c = shot.cam;
  const span = Math.max(0.001, shot.end - shot.start);
  const u = clamp((ct - shot.start) / span);
  const anchor = shotAnchor(shot);
  const off = anchor ? [anchor.x, anchor.y, anchor.z] : [0, 0, 0];
  let pos = c.pos.map((v, i) => v + off[i]);
  let look = c.look.map((v, i) => v + off[i]);
  let fov = c.fov ?? 55;
  if (shot.to) {
    const k = ease(shot.to.e || 'inOut', u);
    if (shot.to.pos) pos = pos.map((v, i) => lerp(v, shot.to.pos[i] + off[i], k));
    if (shot.to.look) look = look.map((v, i) => lerp(v, shot.to.look[i] + off[i], k));
    if (shot.to.fov) fov = lerp(fov, shot.to.fov, k);
  }
  const push = shot.push ?? 0.07; // the slow push-in on every shot
  pos = pos.map((v, i) => lerp(v, look[i], push * u));
  // impact punch-in while frozen
  if (inFreeze(TL, t)) fov *= 0.93;
  const sh = shakeAt(TL, t);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.lookAt(look[0], look[1], look[2]);
  // shake in camera space
  camera.translateX(sh.x);
  camera.translateY(sh.y);
  camera.rotateZ(sh.roll + (c.roll ?? 0) * DEG);
  camera.updateMatrixWorld(true);
}

// ------------------------------------------------------------------ 2D compositing
const out = document.createElement('canvas');
out.width = RW; out.height = RH;
const ctx = out.getContext('2d');

function projectWorld(p) {
  const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
  return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
}

function composite(t, frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(renderer.domElement, 0, 0, RW, RH);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawWatermark(ctx, W, H);
  for (const ev of TL.sfx) {
    if (!ev.word) continue;
    const age = t - ev.t0;
    if (age < 0 || age > (ev.dur ?? CONFIG.sfxText.dur)) continue;
    let [x, y] = ev.world ? projectWorld(ev.world) : [(ev.pos?.[0] ?? 0.5) * W, (ev.pos?.[1] ?? 0.35) * H];
    x += ev.off?.[0] ?? 0;
    y += ev.off?.[1] ?? 0;
    x = clamp(x, 200, W - 200);
    y = clamp(y, 180, H - 260);
    drawSfx(ctx, ev, t, FPS, x, y);
  }
  const cap = activeCaption(TL, t);
  if (cap) drawCaption(ctx, cap, Math.floor((t - cap.start) * FPS + 1e-4), W, H);
  if (DEBUG) {
    const shot = activeShot(TL, t);
    ctx.font = '600 44px monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.textAlign = 'left';
    ctx.fillText(`${t.toFixed(2)}s f${frame} ${shot.beat}`, 30, 70);
  }
}

// ------------------------------------------------------------------ public API
function renderAt(t, frame) {
  const ct = contentTime(TL, t);
  const shot = activeShot(TL, t);
  shotAnchor(shot); // may re-pose actors to find a tracked anchor, so it runs first
  applyActors(sampleActors(TL, ct), ct);
  setCamera(shot, t, ct);
  particles.update(TL.bursts, ct);
  renderer.render(scene, camera);
  composite(t, frame);
}

window.renderFrame = (i, type = 'image/jpeg', q = 0.95) => {
  renderAt(i / FPS, i);
  return out.toDataURL(type, q);
};
window.renderTime = (t, type = 'image/png') => {
  renderAt(t, Math.round(t * FPS));
  return out.toDataURL(type);
};
window.timelineInfo = () => ({ total: TL.total, frames: TL.frames, fps: FPS, voClips: TL.voClips, sfx: TL.sfx.map(({ t0, sound, gain, word }) => ({ t0, sound, gain, word })) });

// fonts must be ready before the first caption is drawn
const font = new FontFace(CONFIG.font, 'url(node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2)');
await font.load();
document.fonts.add(font);
await document.fonts.ready;

// ------------------------------------------------------------------ preview player (non-render mode)
if (!RENDER_MODE) {
  document.body.classList.add('preview');
  document.getElementById('stage').appendChild(out);
  const audio = new Audio(`build/${STORY.id}/audio.wav`);
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('time');
  scrub.max = TL.total;
  let playing = false, t = 0, last = 0;
  const draw = () => { renderAt(t, Math.round(t * FPS)); scrub.value = t; label.textContent = `${t.toFixed(2)} / ${TL.total.toFixed(2)}s`; };
  const loop = (now) => {
    if (playing) {
      t = audio.readyState >= 2 && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
      if (t >= TL.total) { t = 0; audio.currentTime = 0; }
      draw();
    }
    last = now;
    requestAnimationFrame(loop);
  };
  document.getElementById('play').onclick = () => {
    playing = !playing;
    if (playing) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause();
  };
  scrub.oninput = () => { t = parseFloat(scrub.value); audio.currentTime = t; draw(); };
  draw();
  requestAnimationFrame(loop);
}

window.__ready = true;

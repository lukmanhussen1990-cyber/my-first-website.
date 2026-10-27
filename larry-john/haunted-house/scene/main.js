// "Larry's Haunted House" — the 3D reel. Every frame is a pure function of time.
import * as THREE from 'three';
import { Stage } from '../../engine/toon/stage.js';
import { Timeline } from './timeline.js';
import { buildWorld } from './world/index.js';
import { buildShots } from './shots/index.js';
import { coverFrame } from './shots/cover.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920, FPS = +q.get('fps') || 30;
const quality = q.get('quality') || (W >= 1000 ? 'high' : 'preview');
const timingUrl = q.get('timing') || '/haunted-house/build/timing.json';

async function loadFonts() {
  const fonts = [
    ['Permanent Marker', '/assets/fonts/permanent-marker-latin-400-normal.woff2', '400'],
    ['Fredoka', '/assets/fonts/fredoka-latin-600-normal.woff2', '600'],
    ['Fredoka', '/assets/fonts/fredoka-latin-700-normal.woff2', '700'],
    ['Lilita One', '/assets/fonts/lilita-one-latin-400-normal.woff2', '400'],
  ];
  for (const [fam, url, weight] of fonts) {
    const f = new FontFace(fam, `url(${url})`, { weight });
    document.fonts.add(await f.load());
  }
}

async function main() {
  await loadFonts();
  const timing = await (await fetch(timingUrl)).json();
  const T = new Timeline(timing, FPS);
  const stage = new Stage({ width: W, height: H, quality });
  const world = buildWorld(stage);
  const shots = buildShots(T, world);
  shots.sort((a, b) => a.at - b.at);
  shots.forEach((s, i) => { s.end = i + 1 < shots.length ? shots[i + 1].at : T.duration + 0.5; });

  const shotAt = (t) => { let k = 0; for (let i = 0; i < shots.length; i++) if (shots[i].at <= t + 1e-6) k = i; return shots[k]; };

  function pose(t) {
    const s = shotAt(t);
    world.reset();
    const ctx = { t: t - s.at, d: s.end - s.at, abs: t, T, W: world, shot: s };
    ctx.u = Math.min(1, Math.max(0, ctx.t / ctx.d));
    if (s.look) world.look(...(Array.isArray(s.look) ? s.look : [s.look]));
    s.frame(ctx);
    world.cam.apply();
    for (const f of world.after) f();
    for (const f of world.pre) f();      // extra renders (e.g. the selfie on the phone screen)
    // make sure every glow/billboard faces the camera after the camera moved
    if (world.moon.visible) world.moon.lookAt(stage.camera.position);
    return s;
  }

  // motion blur: shots can ask for sub-frames (all frames, or only during fast moves)
  function subframesFor(t) {
    const s = shotAt(t);
    const n = typeof s.blur === 'function' ? s.blur(t - s.at) : (s.blur || 0);
    if (!n || n <= 1 || quality === 'draft') return null;
    const shutter = 0.5 / FPS;          // 180° shutter
    return Array.from({ length: n }, (_, k) => () => pose(t - shutter / 2 + (shutter * (k + 0.5)) / n));
  }

  // where the faces are on screen (so subtitles can step around them): [x, y, r] in frame fractions (y down, r of height)
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _up = new THREE.Vector3();
  function faceBoxes() {
    const cam = stage.camera;
    cam.updateMatrixWorld(); world.scene.updateMatrixWorld();
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const out = [];
    const add = (pos, r) => {
      _q.copy(pos).applyMatrix4(cam.matrixWorldInverse);
      if (_q.z > -cam.near) return;                       // behind the camera
      _p.copy(pos).project(cam);
      _q.copy(pos).addScaledVector(_up, r).project(cam);
      const rr = Math.abs(_q.y - _p.y) / 2;
      const x = (_p.x + 1) / 2, y = (1 - _p.y) / 2;
      if (rr < 0.022 || x < -rr || x > 1 + rr || y < -rr || y > 1 + rr) return;
      out.push([+x.toFixed(3), +y.toFixed(3), +rr.toFixed(3)]);
    };
    for (const ch of [...world.characters, ...world.crowd.filter(Boolean)]) {
      if (!ch.visible || !ch.joints?.skull) continue;
      ch.joints.skull.getWorldPosition(_p); add(_p.clone(), ch.spec.headR * ch.scale.y * 1.05);
    }
    const g = world.cast.ghost;
    if (g.visible) add(g.localToWorld(new THREE.Vector3(0, 0.68, 0)), 0.4 * g.scale.y);
    return out;
  }

  window.APP = {
    getFaces(step = 0.1) {
      const frames = [];
      for (let t = 0; t < T.duration; t += step) { pose(t); frames.push(faceBoxes()); }
      return { step, frames };
    },
    ready: true,
    info: () => ({ frames: T.frames, duration: T.duration, fps: FPS, shots: shots.map((s) => ({ id: s.id, beat: s.beat, at: +s.at.toFixed(3), end: +s.end.toFixed(3) })) }),
    async renderFrame(f) {
      const t = f / FPS;
      const sub = subframesFor(t);
      if (sub) stage.renderNow(sub);
      else { pose(t); stage.renderNow(); }
    },
    async renderTime(t) { pose(t); stage.renderNow(); },
    async sendPixels(f) { await stage.sendPixels(f); },
    async sendPNG(rel) { await stage.sendPNG(rel); },
    // the cover still (render.cjs --mode sheet)
    async renderSheet() {
      world.reset();
      coverFrame(world);
      world.cam.apply();
      for (const f of world.after) f();
      if (world.moon.visible) world.moon.lookAt(stage.camera.position);
      stage.renderNow();
    },
    getCues: () => ({
      duration: T.duration, fps: FPS,
      shots: shots.map((s) => ({ id: s.id, beat: s.beat, at: s.at, end: s.end })),
      sfx: shots.flatMap((s) => (s.sfx || []).map(([name, at, gain = 1, opts = {}]) => ({ name, at: +at.toFixed(3), gain, ...opts, shot: s.id }))).sort((a, b) => a.at - b.at),
      labels: shots.flatMap((s) => (s.labels || []).map((l) => ({ ...l, shot: s.id }))).sort((a, b) => a.at - b.at),
      music: world.music || {},
    }),
  };
}

main().catch((e) => { console.error('main failed', e.stack || e); window.APP = { ready: false, error: String(e) }; });

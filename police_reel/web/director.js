// Scene direction: every frame is a pure function of time t, so frames can
// be rendered in any order / in parallel. Scene boundaries and key actions
// are anchored to the word timings of the voiceover (timeline.json).
import * as THREE from 'three';
import { P, talk, reach, handDir } from './lib/characters.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const sm = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const eo = u => { u = clamp(u); return 1 - (1 - u) ** 3; };
const ei = u => { u = clamp(u); return u * u * u; };
const lin = u => clamp(u);
const seg = (x, a, b) => clamp((x - a) / Math.max(1e-4, b - a));
const vl = (a, b, u) => a.clone().lerp(b, u);
const facing = a => V(Math.sin(a), 0, Math.cos(a));
const leftOf = a => V(Math.cos(a), 0, -Math.sin(a));
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

export class Director {
  constructor({ camera, world, cast, fx, timeline }) {
    Object.assign(this, { camera, world, cast, fx, tl: timeline });
    this.scenes = timeline.scenes.map((sc, i) => {
      const words = timeline.words.filter(w => w.line === i).map(w => ({ t: w.t, s: w.s - sc.start, e: w.e - sc.start }));
      return { ...sc, words };
    });
    this.byId = {};
    this.scenes.forEach(s => { this.byId[s.id] = s; });
    this.defs = makeScenes(this);
    this.events = this.buildEvents();
  }

  // absolute / local time of word i of scene `id`
  W(id, i) { return this.byId[id].start + this.ctxW(id, i); }
  ctxW(id, i) { const s = this.byId[id]; return (s.words[Math.min(i, s.words.length - 1)] || { s: 0 }).s; }

  ctxFor(t) {
    let k = this.scenes.findIndex(s => t >= s.start && t < s.end);
    if (k < 0) k = t < 0 ? 0 : this.scenes.length - 1;
    const sc = this.scenes[k];
    const lt = t - sc.start;
    return {
      t, lt, sc, id: sc.id, dur: sc.dur, u: clamp(lt / sc.dur),
      w: i => (sc.words[Math.min(i, sc.words.length - 1)] || { s: 0 }).s,
      we: i => (sc.words[Math.min(i, sc.words.length - 1)] || { e: 0 }).e,
      find: re => { const i = sc.words.findIndex(w => re.test(w.t)); return i < 0 ? null : sc.words[i].s; },
      speaking: () => sc.words.some(w => lt >= w.s - 0.02 && lt <= w.e + 0.02),
    };
  }

  // shot list for a scene: cuts on chosen words, and never longer than ~1.5 s
  schedule(def, ctx) {
    const dur = ctx.dur;
    let cuts = def.cuts ? def.cuts(ctx).filter(c => c != null && c > 0.35 && c < dur - 0.3) : null;
    if (!cuts) {
      const n = Math.max(1, Math.min(def.shots.length, Math.round(dur / 1.25)));
      cuts = []; for (let i = 1; i < n; i++) cuts.push(dur * i / n);
    }
    const b = [0, ...cuts.sort((a, c) => a - c), dur];
    const segs = [];
    for (let i = 0; i < b.length - 1; i++) {
      const len = b[i + 1] - b[i];
      const parts = len > 1.65 ? Math.ceil(len / 1.35) : 1;
      for (let p = 0; p < parts; p++) segs.push([b[i] + len * p / parts, b[i] + len * (p + 1) / parts]);
    }
    let idx = segs.findIndex(s => ctx.lt >= s[0] && ctx.lt < s[1]);
    if (idx < 0) idx = segs.length - 1;
    const [a, c] = segs[idx];
    return { shot: idx % def.shots.length, seg: idx, nseg: segs.length, su: clamp((ctx.lt - a) / (c - a)), slt: ctx.lt - a, sdur: c - a };
  }

  setCam(pos, look, fov = 40, roll = 0) {
    const c = this.camera;
    c.position.copy(pos);
    c.up.set(0, 1, 0);
    c.lookAt(look);
    if (roll) c.rotateZ(roll);
    c.fov = fov;
    c.updateProjectionMatrix();
  }
  move(su, p1, l1, p2, l2, f1 = 40, f2 = f1, ease = sm, roll = 0) {
    const u = ease(su);
    this.setCam(vl(p1, p2, u), vl(l1, l2, u), lerp(f1, f2, u), roll);
  }

  update(t) {
    const fx = this.fx;
    fx.begin();
    this.state = { shake: [0, 0], shakeAmt: 0, flash: 0, sat: 1, speed: 0, hearts2D: [], fade: 0, vignette: 0.5, streaks: null };
    const ctx = this.ctxFor(t);
    const def = this.defs[ctx.id];
    ctx.shot = this.schedule(def, ctx);
    this.photoPlaced = false;
    this.baseline(ctx);
    def.setup(ctx);
    this.postSetup(ctx);
    def.shots[ctx.shot.shot](ctx, ctx.shot.su, ctx.shot);
    this.camera.updateMatrixWorld(true);
    fx.cullNear(this.camera.position);
    // loud captions shake the screen a little
    const cap = this.tl.captions.find(c => t >= c.s && t < c.hide);
    if (cap && cap.loud) this.state.shakeAmt = Math.max(this.state.shakeAmt, 8 * (0.45 + 0.55 * Math.max(0, 1 - (t - cap.s) / 0.45)));
    const a = this.state.shakeAmt;
    if (a > 0) this.state.shake = [a * (hash(Math.floor(t * 30)) - 0.5) * 2, a * (hash(Math.floor(t * 30) + 77) - 0.5) * 2];
    const end = this.tl.duration;
    this.state.fade = Math.max(this.state.fade, seg(t, end - 0.8, end - 0.04));
    return this.state;
  }

  postSetup() {
    const { you, photo } = this.cast;
    if (photo.visible && !this.photoPlaced) {
      you.root.updateMatrixWorld(true);
      const hp = you.handWorld('R');
      photo.position.copy(hp).add(V(0, -0.2, 0)).addScaledVector(facing(you.root.rotation.y), 0.06);
      photo.rotation.set(0, you.root.rotation.y + Math.PI / 2, 0.1);
    }
  }

  // ------------------------------------------------------------ story state
  baseline(ctx) {
    const rotHint = (p, x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.root.rotation.y);
    const { you, husband, officer, prisoner, dog, photo, pen } = this.cast;
    const Wd = this.world, fx = this.fx, t = ctx.t, id = ctx.id;
    for (const p of [you, husband, officer, prisoner]) p.reset();
    pen.visible = false;
    photo.visible = id >= 5 && id <= 14;

    you.at(1.0, 0.3, Math.PI);
    you.face({ mouth: 'smile' });

    officer.at(1.0, -1.55, 0);
    P.sit(officer, 0.56);
    officer.neck.rotation.x = 0.3;
    P.type(officer, t, id < 6);
    officer.face({ brows: 'angry', mouth: 'flat', look: [0, -0.6] });

    husband.root.visible = id >= 16;
    husband.face({ eyes: 'tired', mouth: 'flat' });

    if (id < 11) {
      prisoner.at(-5.0, -3.4, Math.PI / 2);
      P.sit(prisoner, 0.63);
      prisoner.arm.L.sh.rotation.x = -0.4; prisoner.arm.R.sh.rotation.x = -0.4;
      prisoner.arm.L.el.rotation.x = -0.9; prisoner.arm.R.el.rotation.x = -0.9;
      prisoner.neck.rotation.x = 0.35;
      prisoner.face({ eyes: 'normal', mouth: 'frown', brows: 'worried', look: [0, -0.5] });
    } else {
      prisoner.at(-4.5, -3.05, 0.25);
      P.kneel(prisoner);
      const pa = prisoner.root.rotation.y;
      prisoner.spine.rotation.x = 0.04 * Math.sin(t * 6);
      const pc = prisoner.spine.localToWorld(V(0, 0.5, 0.3));
      reach(prisoner, 'L', pc.clone().addScaledVector(leftOf(pa), 0.035), rotHint(prisoner, 1, -0.7, 0));
      reach(prisoner, 'R', pc.clone().addScaledVector(leftOf(pa), -0.035), rotHint(prisoner, -1, -0.7, 0));
      handDir(prisoner, 'L', V(0, 1, 0).addScaledVector(facing(pa), 0.2), leftOf(pa).negate());
      handDir(prisoner, 'R', V(0, 1, 0).addScaledVector(facing(pa), 0.2), leftOf(pa));
      prisoner.neck.rotation.x = -0.35;
      prisoner.face({ eyes: 'closed', brows: 'worried', mouth: 'open', open: talk(t, 9) * 0.6 });
    }

    dog.root.position.set(3.0, 0, 0.1);
    dog.root.rotation.set(0, -0.75, 0);
    if (id >= 13) {
      const tw = Math.sin(t * 9) * 0.08 * (Math.floor(t * 1.3) % 3 === 0 ? 1 : 0);
      dog.legsUp(tw);
    } else dog.sit();

    Wd.frontDoor.rotation.y = 0;
    Wd.doorLight.intensity = 0;
    Wd.wcDoor.rotation.y = id >= 16 ? -1.35 : 0;
    Wd.wcLight.intensity = id >= 16 ? 1.6 : 0;
    Wd.cellDoor.rotation.y = (id >= 22 && id <= 25) ? 1.5 : 0;
    Wd.keys.position.copy(Wd.keysHome);
    Wd.keys.rotation.set(0, 0, 0);
    Wd.keys.scale.setScalar(1);
    Wd.keys.visible = id < 25;
    Wd.fanBlades.rotation.y = t * (id >= 10 ? 11 : 6);
    Wd.crtScreen.material.map = Wd.crtTex[id < 6 ? Math.floor(t * 5) % 4 : 2];

    // the smell follows YOU around
    if (id >= 2 && id < 24 && !(id >= 16 && id <= 19)) {
      const yp = you.root.position, a = you.root.rotation.y;
      const butt = yp.clone().addScaledVector(facing(a), -0.25).add(V(0, 1.0, 0));
      fx.stinkLines(butt, t, { n: 3, spread: 0.3, height: 1.0, size: 0.42, opacity: 0.9, seed: 5 });
    }
    if (id >= 11 && id < 24) fx.cloud(V(0.2, 1.7, -0.8), 5.2, t, { n: 30, size: 0.5, opacity: 0.16, rise: 2.4, seed: 21 });
    if (id >= 24 && id < 27) fx.cloud(V(-0.6, 1.4, -0.4), 4.0, t, { n: 26, size: 0.6, opacity: 0.24, rise: 2.4, seed: 23 });
  }

  // ------------------------------------------------------------ sound + comic words
  buildEvents() {
    const ev = [];
    const has = id => !!this.byId[id];
    const add = (t, type, word, o = {}) => ev.push({ t: Math.max(0, t), type, word, ...o });
    if (has(1)) add(this.byId[1].start + 0.05, 'creak', { text: 'CREEAK', x: 0.7, y: 0.16, rot: 0.12, color: '#ffe066' }, { dur: 0.9, gain: 0.5 });
    if (has(2)) add(this.W(2, 2), 'scratch', { text: 'PRRRT!', x: 0.68, y: 0.7, rot: -0.15, color: '#9cff57', size: 64 }, { gain: 0.7 });
    if (has(5) && has(6)) {
      const a = this.byId[5].start, b = this.W(6, 2);
      for (let t = a + 0.05; t < b; t += 0.085 + 0.06 * hash(t * 10)) add(t, 'key', null, { gain: 0.32 + 0.18 * hash(t * 7) });
      add(a + 0.15, 'none', { text: 'TAP TAP', x: 0.74, y: 0.16, rot: 0.1, size: 40, color: '#ffffff', dur: 0.9 });
    }
    if (has(7)) add(this.byId[7].start + 0.1, 'none', { text: 'SNIFF', x: 0.74, y: 0.18, rot: 0.15, size: 48, color: '#b8ff7a', dur: 0.8 });
    if (has(12)) add(this.dogImpact(), 'thump', { text: 'THUD!', x: 0.5, y: 0.78, rot: -0.12, size: 72, color: '#ffd93b' }, { gain: 0.9 });
    if (has(15)) add(this.byId[15].start + this.wcOpen(), 'creak', { text: 'CREEEEAK', x: 0.5, y: 0.17, rot: -0.08, color: '#ffe066', wobble: true }, { dur: 1.5, gain: 0.55 });
    if (has(22)) add(this.byId[22].start + 0.1, 'creak', null, { dur: 0.6, gain: 0.25 });
    if (has(24)) add(this.W(24, 1), 'scratch', { text: 'PRRRRT!!', x: 0.5, y: 0.2, rot: 0.1, color: '#9cff57', size: 80 }, { gain: 0.8 });
    if (has(25)) add(this.keyGrab(), 'jingle', { text: 'JINGLE', x: 0.7, y: 0.18, rot: 0.12, size: 44, color: '#ffe066' }, { gain: 0.6 });
    if (has(26)) add(this.lockTime(), 'clank', { text: 'CLANK!', x: 0.5, y: 0.2, rot: -0.1, size: 72, color: '#e8f0ff' }, { gain: 0.8 });
    return ev;
  }
  dogFall() { const s = this.byId[12]; return Math.min(this.ctxW(12, 3) + 0.05, s.dur - 0.6); }
  dogImpact() { const s = this.byId[12]; return s.start + this.dogFall() + 0.32; }
  wcOpen() { const s = this.byId[15]; return Math.min(this.ctxW(15, 4) - 0.05, s.dur - 0.6); }
  keyGrab() { const s = this.byId[25]; return s.start + clamp(this.ctxW(25, 2), 0.45, s.dur - 0.4); }
  lockTime() { const s = this.byId[26]; return s.start + clamp(this.ctxW(26, 2), 0.45, s.dur - 0.3); }

  sfxWords(t) {
    const sceneEnd = tt => { const s = this.scenes.find(x => tt >= x.start && tt < x.end); return s ? s.end : 1e9; };
    return this.events.filter(e => e.word && t >= e.t && t < Math.min(e.t + (e.word.dur || 0.85), sceneEnd(e.t)))
      .map(e => ({ ...e.word, t: e.t, dur: Math.min(e.word.dur || 0.85, sceneEnd(e.t) - e.t) }));
  }
}

// ======================================================================
function makeScenes(D) {
  const { you, husband, officer, prisoner, dog, photo, pen } = D.cast;
  const Wd = D.world, fx = D.fx;
  const S = {};
  const head = p => p.headWorld();
  const st = () => D.state;
  const chest = (p, f = 0.2) => { p.root.updateMatrixWorld(true); return p.spine.localToWorld(V(0, 0.42, f)); };
  const rotHint = (p, x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.root.rotation.y);

  // camera relative to a face: `dist` in front, `ang` around, dy/ldy heights
  const faceCam = (p, dist, { ang = 0, dy = 0, ldy = 0, side = 0 } = {}) => {
    const h = head(p);
    const a = p.root.rotation.y + ang;
    const pos = h.clone().addScaledVector(facing(a), dist).add(V(0, dy, 0)).addScaledVector(leftOf(a), side);
    return [pos, h.clone().add(V(0, ldy, 0))];
  };
  const faceShot = (p, d1, d2, o1 = {}, o2 = o1, f1 = 38, f2 = f1, ease = sm) => (ctx, su) => {
    const [a, b] = faceCam(p, d1, o1), [c, d] = faceCam(p, d2, o2);
    D.move(su, a, b, c, d, f1, f2, ease);
  };

  // ---- YOU's entrance walk (scene 1 -> freeze in scene 2)
  const walkStart = () => D.byId[1].start;
  const freezeT = () => (D.byId[2] ? D.W(2, 2) : 1e9);
  const walkAt = (t) => {
    const d = clamp((t - walkStart() - 0.3) * 1.15, 0, 3.4);
    return { x: 6.5 - d, z: 1.45, phase: d / 0.62 * Math.PI, d };
  };
  const poseWalkYou = (t) => {
    const w = walkAt(t);
    you.at(w.x, w.z, -Math.PI / 2);
    P.walk(you, w.phase, w.d > 0 && w.d < 3.4 ? 1 : 0.2, { swagger: 1 });
    you.face({ mouth: 'grin', brows: 'raised', eyes: 'normal' });
    return w;
  };
  const youSpot = () => { const w = walkAt(freezeT()); return V(w.x, 0, w.z); };

  // ================================================================ 1  walk in
  S[1] = {
    setup(ctx) {
      poseWalkYou(ctx.t);
      Wd.frontDoor.rotation.y = -1.45 * eo(seg(ctx.lt, 0.0, 0.55));
      Wd.doorLight.intensity = 3 * seg(ctx.lt, 0, 0.4);
    },
    shots: [
      (ctx, su) => D.move(su, V(2.3, 1.55, 4.3), V(5.7, 1.25, 1.3), V(2.8, 1.5, 3.8), V(5.6, 1.3, 1.35), 46, 42),
      (ctx, su) => { const x = you.root.position.x; D.move(su, V(x - 2.4, 0.5, 1.95), V(x, 1.5, 1.45), V(x - 2.2, 0.55, 1.9), V(x, 1.55, 1.45), 50, 48); },
    ],
  };

  // ================================================================ 2  freeze frame
  S[2] = {
    cuts: ctx => [ctx.w(2), ctx.w(3)],
    setup(ctx) {
      const fz = freezeT();
      poseWalkYou(Math.min(ctx.t, fz));
      if (ctx.t >= fz) {
        const a = ctx.t - fz;
        you.face({ mouth: 'grin', brows: 'raised', eyes: a > 0.35 ? 'wide' : 'normal' });
        st().sat = 0.55;
        st().flash = Math.max(0, 1 - a / 0.12) * 0.7;
        st().vignette = 0.75;
        st().shakeAmt = 6 * Math.max(0, 1 - a / 0.3);
        const butt = you.root.position.clone().add(V(0.28, 1.0, 0));
        fx.stinkLines(butt, ctx.t, { n: 5, spread: 0.3, height: 1.2, size: 0.5, opacity: 1, seed: 8 });
        fx.cloud(butt.clone().add(V(0.12, -0.05, 0)), 0.18 + 0.14 * eo(a / 0.6), ctx.t, { n: 6, size: 0.14, opacity: 0.55, rise: 0.25, seed: 4 });
      }
    },
    shots: [
      (ctx, su) => { const x = you.root.position.x; D.move(su, V(x - 2.6, 1.6, 2.9), V(x, 1.3, 1.45), V(x - 2.4, 1.6, 2.85), V(x, 1.3, 1.45), 44, 42); },
      (ctx, su) => { const p = youSpot(); D.move(su, V(p.x - 2.8, 1.5, 2.9), V(p.x + 0.05, 1.3, 1.45), V(p.x - 1.9, 1.45, 2.5), V(p.x + 0.1, 1.3, 1.45), 44, 40, eo); },
      (ctx, su) => { const p = youSpot(); D.move(su, V(p.x - 1.3, 1.0, 3.6), V(p.x + 0.3, 1.45, 1.45), V(p.x - 1.0, 1.05, 3.1), V(p.x + 0.3, 1.5, 1.45), 48, 42, eo); },
    ],
  };

  // ================================================================ 3  shocked eyes
  S[3] = {
    setup(ctx) {
      const p = youSpot();
      you.at(p.x, p.z, -Math.PI / 2);
      P.walk(you, walkAt(freezeT()).phase, 1, { swagger: 1 });
      const lk = Math.sin(ctx.lt * 9) > 0 ? 1 : -1;
      you.face({ eyes: 'wide', eyeScale: 1.1, brows: 'worried', mouth: 'wavy', look: [lk * 0.8, 0] });
      const h = head(you);
      const sw = h.clone().addScaledVector(leftOf(-Math.PI / 2), 0.2).add(V(0, 0.12 - 0.12 * sm(ctx.u), 0)).addScaledVector(facing(-Math.PI / 2), 0.2);
      fx.drop(sw, 0.08);
      st().vignette = 0.75;
    },
    shots: [
      faceShot(you, 1.25, 1.0, { dy: 0.12, ldy: 0.1 }, { dy: 0.12, ldy: 0.1 }, 36, 34),
    ],
  };

  // ================================================================ 4  fixes his hair
  S[4] = {
    setup(ctx) {
      const p = youSpot();
      const a = -Math.PI / 2 + 0.5;
      you.at(p.x, p.z, a);
      const fixEnd = Math.min(1.15, ctx.dur * 0.6);
      const fix = seg(ctx.lt, 0.0, fixEnd);
      const up = sm(seg(ctx.lt, 0, 0.25)) * (1 - sm(seg(ctx.lt, fixEnd - 0.15, fixEnd + 0.1)));
      const sw = Math.sin(ctx.lt * 11);
      const h = head(you);
      const rest = you.handWorld('R');
      const top = h.clone().add(V(0, 0.26, 0)).addScaledVector(facing(a), 0.12 - 0.12 * sw).addScaledVector(leftOf(a), -0.12);
      reach(you, 'R', vl(rest, top, up), rotHint(you, -0.8, 0.1, -0.4));
      if (up > 0.3) handDir(you, 'R', facing(a).negate().add(V(0, 0.4, 0)), V(0, -1, 0));
      you.neck.rotation.set(-0.12, 0.25, -0.12 + 0.06 * sw * up);
      if (you.quiff) you.quiff.rotation.z = 0.12 + 0.1 * sw * up;
      const done = fix >= 1;
      you.face({ mouth: done ? 'grin' : 'smile', brows: 'raised', eyes: done && (ctx.lt - fixEnd) % 0.9 < 0.12 ? 'closed' : 'normal', look: [0.5, 0] });
      if (done) {
        const k = seg(ctx.lt, fixEnd, fixEnd + 0.4);
        if (k > 0 && k < 1) fx.sparkle(h.clone().add(V(0, -0.12, 0)).addScaledVector(facing(a), 0.3).addScaledVector(leftOf(a), -0.12), 0.16 * Math.sin(Math.PI * k));
      }
    },
    shots: [
      faceShot(you, 2.1, 1.75, { dy: 0.0, ldy: -0.12, ang: 0.15 }, { dy: 0.0, ldy: -0.1, ang: 0.15 }, 40, 38),
      faceShot(you, 2.6, 2.3, { dy: -0.6, ldy: -0.3, ang: 0.55 }, { dy: -0.55, ldy: -0.28, ang: 0.6 }, 46, 44),
    ],
  };

  // helpers for the desk scenes ------------------------------------------
  const holdPhotoUp = (lift = 1) => {
    const a = you.root.rotation.y;
    const h = head(you);
    const low = you.handWorld('R');
    const up = h.clone().addScaledVector(facing(a), 0.42).addScaledVector(leftOf(a), -0.22).add(V(0, -0.2, 0));
    reach(you, 'R', vl(low, up, lift), rotHint(you, -0.9, -0.6, 0));
    handDir(you, 'R', V(0, 1, 0).addScaledVector(facing(a), 0.3), facing(a));
    const hp = you.handWorld('R');
    photo.position.copy(hp).add(V(0, 0.26, 0)).addScaledVector(facing(a), 0.05);
    photo.rotation.set(0, a + 0.25, 0);
    D.photoPlaced = true;
  };
  const officerNose = () => { P.holdNose(officer, 'L'); officer.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' }); };
  const stopT = () => D.byId[6].start + Math.min(D.ctxW(6, 2), D.byId[6].dur - 0.3);

  // ================================================================ 5  at the desk
  S[5] = {
    cuts: ctx => [ctx.w(2)],
    setup(ctx) {
      holdPhotoUp(sm(seg(ctx.lt, 0, 0.35)));
      reach(you, 'L', chest(you, 0.35).add(V(0.3, -0.25, 0)).setY(1.12), rotHint(you, 0.8, -0.5, 0));
      you.neck.rotation.set(-0.08, 0, 0.06 * Math.sin(ctx.lt * 3));
      you.face({ mouth: ctx.speaking() ? 'open' : 'smile', open: talk(ctx.lt) * 0.7, brows: 'worried', eyes: 'normal' });
    },
    shots: [
      (ctx, su) => D.move(su, V(0.35, 2.0, -2.75), V(1.0, 1.75, 0.3), V(0.4, 2.0, -2.55), V(1.0, 1.8, 0.3), 40, 37),
      (ctx, su) => { const p = photo.position.clone(); D.move(su, p.clone().add(V(-0.3, 0.05, -0.75)), p.clone().add(V(0.0, -0.02, 0)), p.clone().add(V(-0.25, 0.05, -0.6)), p.clone().add(V(0.0, -0.02, 0)), 36, 34); },
      (ctx, su) => D.move(su, V(3.2, 1.65, -0.5), V(1.0, 1.55, -0.6), V(3.0, 1.65, -0.5), V(1.0, 1.55, -0.6), 44, 42),
    ],
  };

  // ================================================================ 6  stops typing
  S[6] = {
    setup(ctx) {
      const stop = stopT() - D.byId[6].start;
      const on = ctx.lt < stop;
      P.type(officer, on ? ctx.t : stopT(), true);
      if (!on) {
        officer.arm.L.fingers.forEach(f => { f.rotation.z *= 1; });
        st().shakeAmt = 4 * Math.max(0, 1 - (ctx.lt - stop) / 0.2);
      }
      holdPhotoUp(1);
    },
    shots: [
      (ctx, su) => D.move(su, V(1.75, 1.55, -0.55), V(1.0, 1.12, -1.15), V(1.55, 1.45, -0.7), V(1.0, 1.12, -1.15), 40, 34),
    ],
  };

  // ================================================================ 7  sniff
  S[7] = {
    setup(ctx) {
      P.type(officer, stopT(), true);
      officer.neck.rotation.x = 0.1;
      const tw = Math.sin(ctx.lt * 38) > 0.2 ? 1 : 0;
      officer.nose.scale.set(1 + 0.15 * tw, 1 - 0.1 * tw, 1 + 0.2 * tw);
      officer.nose.position.y = -0.03 + 0.008 * tw;
      officer.mustache.rotation.z = 0.08 * Math.sin(ctx.lt * 30);
      officer.face({ eyes: 'squint', brows: 'angry', mouth: 'flat' });
      const h = head(officer);
      for (let k = 0; k < 3; k++) {
        const ph = (ctx.lt * 1.5 + k / 3) % 1;
        fx.stink(h.clone().add(V(-0.1 + k * 0.1, -0.2 + ph * 0.12, 0.5 - ph * 0.25)), 0.14, ctx.lt * 2 + k, Math.sin(Math.PI * ph));
      }
      holdPhotoUp(1);
    },
    shots: [faceShot(officer, 1.05, 0.85, { dy: -0.03, ldy: -0.04 }, { dy: -0.03, ldy: -0.05 }, 36, 34)],
  };

  // ================================================================ 8  slowly looks up
  S[8] = {
    cuts: ctx => [ctx.w(1)],
    setup(ctx) {
      P.type(officer, stopT(), true);
      const up = sm(seg(ctx.lt, 0.05, Math.min(1.2, ctx.dur * 0.7)));
      officer.neck.rotation.x = lerp(0.35, -0.12, up);
      officer.face({ eyes: up > 0.6 ? 'wide' : 'squint', brows: 'worried', mouth: ctx.speaking() ? 'open' : 'flat', open: talk(ctx.lt, 8) * 0.4, look: [0, lerp(-0.8, 0.3, up)] });
      const h = head(officer);
      const k = sm(seg(ctx.lt, 0.3, ctx.dur));
      fx.drop(h.clone().add(V(0.3, 0.12 - 0.14 * k, 0.2)), 0.1);
      holdPhotoUp(0.3);
    },
    shots: [
      (ctx, su) => D.move(su, V(1.05, 1.2, -0.2), V(1.0, 1.6, -1.5), V(1.05, 1.25, -0.35), V(1.0, 1.64, -1.5), 46, 42),
      faceShot(officer, 1.35, 1.12, { ang: 0.35, ldy: 0.02 }, { ang: 0.3, ldy: 0.02 }, 38, 36),
    ],
  };

  // ================================================================ 9  LOUD fake crying
  const flail = (ctx) => {
    const w1 = Math.sin(ctx.lt * 14), w2 = Math.sin(ctx.lt * 14 + 1.9);
    for (const s of ['L', 'R']) {
      const a = you.arm[s], w = s === 'L' ? w1 : w2;
      a.sh.rotation.set(-0.6 - 0.5 * w, 0, a.sx * (1.9 + 0.5 * w));
      a.el.rotation.set(-0.6 - 0.4 * w, 0, 0);
    }
    you.spine.rotation.set(-0.05, 0.12 * w1, 0.06 * w2);
    you.neck.rotation.set(-0.25, 0.15 * w2, 0.1 * w1);
    you.face({ eyes: 'closed', brows: 'worried', mouth: 'open', open: 0.6 + 0.3 * Math.abs(w1), tears: 0.7 + 0.3 * Math.abs(w2) });
    photo.visible = false;
  };
  S[9] = {
    cuts: ctx => {
      const ws = ctx.sc.words, i1 = ws.findIndex(w => /^no$/i.test(w.t)), i2 = ws.findIndex((w, i) => i > i1 && /^no$/i.test(w.t));
      return [i1 >= 0 ? ws[i1].s - 0.05 : ctx.dur / 3, i2 >= 0 ? ws[i2].s - 0.05 : ctx.dur * 2 / 3];
    },
    setup(ctx) {
      flail(ctx);
      fx.tearSpray(you, ctx.t, { rate: 1.3, size: 0.06, spread: 0.9 });
      P.type(officer, stopT(), true);
      officer.neck.rotation.x = -0.12;
      officer.face({ eyes: 'squint', brows: 'neutral', mouth: 'flat' });
    },
    shots: [
      (ctx, su) => D.move(su, V(1.05, 1.75, -1.0), V(1.0, 1.55, 0.3), V(1.05, 1.72, -0.8), V(1.0, 1.6, 0.3), 54, 50),
      faceShot(you, 1.45, 1.15, { dy: 0.05, side: 0.12 }, { dy: 0.05, side: 0.1 }, 40, 38),
      (ctx, su) => D.move(su, V(2.3, 1.75, -2.35), V(1.0, 1.55, -0.2), V(2.2, 1.75, -2.2), V(1.0, 1.55, -0.2), 46, 42),
    ],
  };

  // ================================================================ 10  ceiling fan spreads it
  S[10] = {
    cuts: ctx => [ctx.dur * 0.5],
    setup(ctx) {
      you.face({ mouth: 'smile', brows: 'raised' });
      officerNose();
      officer.neck.rotation.x = 0;
      const u = seg(ctx.lt, 0.0, ctx.dur);
      const src = V(1.0, 1.2, 0.3), fan = V(0.4, 2.85, 0.4);
      const N = 40;
      for (let k = 0; k < N; k++) {
        const r = hash(k + 1), a0 = hash(k + 31) * Math.PI * 2;
        const v = seg(u, r * 0.45, 1);
        if (v <= 0) continue;
        const up = sm(seg(v, 0, 0.35));
        const out = eo(seg(v, 0.25, 1));
        const ang = a0 + v * 5.5;
        const rad = 0.3 * up + out * (1.5 + 3.2 * hash(k + 7));
        const p = vl(src, fan, up);
        p.x += Math.cos(ang) * rad; p.z += Math.sin(ang) * rad;
        p.y = lerp(p.y, 2.0 + 0.9 * hash(k + 3) - out * 1.0 * hash(k + 5), out);
        fx.puff(p, 0.12 + 0.3 * v, 0.5, k);
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(-0.3, 1.5, 2.3), V(0.4, 3.0, 0.4), V(-0.2, 1.65, 2.0), V(0.4, 3.0, 0.4), 52, 48),
      (ctx, su) => D.move(su, V(-1.2, 3.25, 4.3), V(0.6, 0.7, -1.2), V(-1.5, 3.25, 4.6), V(0.4, 0.7, -1.3), 60, 64),
    ],
  };

  // ================================================================ 11  prisoner prays
  S[11] = {
    cuts: ctx => [ctx.find(/^starts/i) ?? ctx.dur * 0.55],
    setup(ctx) {
      const t0 = ctx.find(/^starts/i) ?? ctx.dur * 0.55;
      if (ctx.lt < t0 - 0.05) {
        prisoner.reset();
        prisoner.at(-5.0, -3.4, Math.PI / 2);
        P.sit(prisoner, 0.63);
        prisoner.neck.rotation.set(-0.1, 0.0, 0);
        prisoner.arm.L.sh.rotation.x = -0.4; prisoner.arm.R.sh.rotation.x = -0.4;
        prisoner.arm.L.el.rotation.x = -0.9; prisoner.arm.R.el.rotation.x = -0.9;
        prisoner.face({ eyes: 'wide', brows: 'worried', mouth: 'wavy', look: [Math.sin(ctx.lt * 6) > 0 ? 0.8 : -0.8, 0] });
        const h = head(prisoner);
        for (let k = 0; k < 3; k++) fx.stink(h.clone().add(V(0.45, -0.3 + k * 0.12, -0.45 - k * 0.15)), 0.18, ctx.t * 2 + k, 0.9);
      } else {
        const h = head(prisoner);
        fx.beam(V(-5.95, 2.6, -3.4), h.clone().add(V(0, 0.1, 0)), 0.9, 0.16);
        for (let k = 0; k < 3; k++) {
          const ph = (ctx.lt * 0.9 + k / 3) % 1;
          fx.sparkle(h.clone().add(V(-0.35 + 0.35 * k, 0.3 + 0.15 * ph, 0)), 0.13 * Math.sin(Math.PI * ph));
        }
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(-1.9, 1.35, -3.0), V(-5.0, 1.2, -3.4), V(-2.15, 1.35, -3.1), V(-5.0, 1.2, -3.4), 40, 38),
      (ctx, su) => D.move(su, V(-4.25, 0.85, -1.2), V(-4.45, 1.05, -3.0), V(-4.25, 0.9, -1.45), V(-4.45, 1.08, -3.0), 44, 38),
    ],
  };

  // ================================================================ 12  the dog faints
  S[12] = {
    cuts: ctx => [D.dogFall()],
    setup(ctx) {
      const fall = D.dogFall();
      const impact = fall + 0.32;
      dog.root.position.set(3.0, 0, 0.1);
      dog.root.rotation.set(0, -0.75, 0);
      if (ctx.lt < fall) {
        dog.sit();
        const tw = Math.sin(ctx.lt * 40) > 0 ? 1 : 0;
        dog.head.rotation.x = 0.1 + 0.05 * tw;
        dog.eyes.forEach(o => o.e.scale.set(1.4, 1.7, 1));
        const h = dog.head.getWorldPosition(V(0, 0, 0));
        fx.drop(h.clone().add(V(0.12, 0.2, 0.05)), 0.09);
        fx.stinkLines(h.clone().add(V(-0.25, -0.2, 0.3)), ctx.t, { n: 2, spread: 0.15, height: 0.4, size: 0.25, seed: 31 });
      } else if (ctx.lt < impact) {
        dog.sit();
        const u = ei(seg(ctx.lt, fall, impact));
        dog.root.rotateZ(u * Math.PI / 2);
        dog.root.position.y = 0.03 * u;
        dog.xEyes(u > 0.3);
      } else {
        const a = ctx.lt - impact;
        const roll = sm(seg(a, 0.0, 0.22));
        if (roll < 1) {
          dog.sit();
          dog.root.rotateZ(Math.PI / 2 + roll * 0.4);
          dog.xEyes(true);
        } else {
          dog.legsUp(Math.sin(a * 30) * 0.15 * Math.max(0, 1 - a));
        }
        st().shakeAmt = Math.max(st().shakeAmt, 10 * Math.max(0, 1 - a / 0.25));
      }
      officerNose();
    },
    shots: [
      (ctx, su) => D.move(su, V(1.85, 0.78, 1.35), V(3.0, 0.55, 0.12), V(2.0, 0.78, 1.2), V(3.0, 0.58, 0.12), 44, 40),
      (ctx, su) => D.move(su, V(3.75, 1.3, 1.55), V(2.95, 0.25, 0.15), V(3.6, 1.2, 1.4), V(2.95, 0.25, 0.15), 46, 42),
    ],
  };

  // ================================================================ 13  holds his nose, pen ready
  S[13] = {
    setup(ctx) {
      officerNose();
      officer.neck.rotation.x = -0.05;
      reach(officer, 'R', V(1.38, 1.2, -1.02), rotHint(officer, -0.8, -0.6, -0.2));
      handDir(officer, 'R', V(0.2, -0.7, 0.7), V(0, -1, 0.3));
      pen.visible = true;
      officer.face({ eyes: 'squint', brows: 'angry', mouth: ctx.speaking() ? 'open' : 'frown', open: talk(ctx.lt) * 0.4 });
    },
    shots: [
      (ctx, su) => D.move(su, V(1.35, 1.8, 0.15), V(1.1, 1.42, -1.45), V(1.3, 1.78, -0.05), V(1.1, 1.45, -1.45), 46, 42),
    ],
  };

  // ================================================================ 14  hugging the photo
  const hugPhoto = (ctx) => {
    const a = you.root.rotation.y;
    const sway = Math.sin(ctx.lt * 3.2);
    you.spine.rotation.set(0.0, 0, 0.1 * sway);
    you.neck.rotation.set(-0.15, 0, 0.22 * sway);
    const c = chest(you, 0.28);
    photo.position.copy(c).addScaledVector(facing(a), 0.02);
    photo.rotation.set(0.12, a, -0.1 * sway);
    D.photoPlaced = true;
    reach(you, 'L', c.clone().addScaledVector(leftOf(a), -0.05).addScaledVector(facing(a), 0.06).add(V(0, -0.02, 0)), rotHint(you, 1, -0.4, 0));
    reach(you, 'R', c.clone().addScaledVector(leftOf(a), 0.05).addScaledVector(facing(a), 0.08).add(V(0, 0.06, 0)), rotHint(you, -1, -0.4, 0));
    handDir(you, 'L', leftOf(a).negate().add(V(0, 0.3, 0)), facing(a).negate());
    handDir(you, 'R', leftOf(a).add(V(0, 0.3, 0)), facing(a).negate());
    you.face({ eyes: 'happy', brows: 'raised', mouth: ctx.speaking() ? 'open' : 'smile', open: talk(ctx.lt) * 0.5 });
    const h = head(you);
    for (let k = 0; k < 10; k++) {
      const ph = (ctx.lt * 0.55 + k / 10) % 1;
      const side = k % 2 ? 1 : -1;
      const p = h.clone().addScaledVector(leftOf(a), side * (0.45 + 0.25 * hash(k))).addScaledVector(facing(a), -0.1 + 0.2 * hash(k + 4)).add(V(0, -0.7 + ph * 1.3, 0));
      fx.heart(p, 0.12 + 0.05 * hash(k), { opacity: Math.sin(Math.PI * ph) });
    }
  };
  S[14] = {
    cuts: ctx => [ctx.find(/^big/i), ctx.find(/^so+/i)],
    setup(ctx) {
      hugPhoto(ctx);
      officerNose();
      const t4 = ctx.find(/^so+/i) ?? ctx.dur * 0.7;
      const hs = ctx.lt >= t4 ? sm(seg(ctx.lt, t4, t4 + 0.4)) : 0;
      for (let k = 0; k < 5; k++) {
        const ph = (ctx.lt * 0.8 + k / 5) % 1;
        st().hearts2D.push({ x: 0.12 + 0.19 * k, y: 1.05 - ph * 1.2, size: 0.12 + 0.05 * hash(k + 3), alpha: 0.85 * hs, rot: Math.sin(ctx.lt * 3 + k) * 0.2 });
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(1.75, 1.7, -1.2), V(1.0, 1.45, 0.3), V(1.68, 1.7, -1.0), V(1.0, 1.5, 0.3), 46, 44),
      (ctx, su) => { const p = photo.position.clone(); D.move(su, p.clone().add(V(0.1, 0.12, -0.8)), p.clone().add(V(0, 0.1, 0)), p.clone().add(V(0.08, 0.12, -0.65)), p.clone().add(V(0, 0.1, 0)), 42, 40); },
      faceShot(you, 1.4, 1.1, { dy: 0.02, ldy: -0.06 }, { dy: 0.02, ldy: -0.06 }, 38, 36),
    ],
  };

  // ================================================================ 15  the toilet door opens
  S[15] = {
    setup(ctx) {
      const t0 = D.wcOpen();
      const open = sm(seg(ctx.lt, t0, ctx.dur + 0.35));
      Wd.wcDoor.rotation.y = -1.35 * open;
      Wd.wcLight.intensity = 3.5 * open;
      you.at(1.0, 0.3, Math.PI - 0.4);
      you.face({ eyes: 'normal', look: [0.8, 0] });
      officerNose();
      if (open > 0.05) for (let k = 0; k < 6; k++) {
        const ph = (ctx.lt * 0.7 + k / 6) % 1;
        fx.puff(V(3.4 + 0.5 * hash(k), 0.5 + ph * 1.6, -4.85 + ph * 0.6), 0.1 + 0.18 * ph, 0.22 * (1 - ph) * open, k);
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(2.7, 1.55, -0.4), V(3.6, 1.45, -5.0), V(3.1, 1.5, -1.9), V(3.6, 1.4, -5.0), 46, 44, lin),
      (ctx, su) => D.move(su, V(2.75, 0.55, -2.1), V(3.6, 1.6, -5.0), V(2.85, 0.55, -2.45), V(3.6, 1.6, -5.0), 52, 50, lin),
    ],
  };

  // ================================================================ 16  slow-motion entrance
  S[16] = {
    cuts: ctx => [ctx.find(/^bald/i), ctx.find(/^with/i), ctx.find(/^walks/i)].map(x => (x == null ? null : x - 0.05)),
    setup(ctx) {
      const z = lerp(-5.6, -3.5, seg(ctx.lt, 0, Math.max(ctx.dur, 2.2)));
      husband.at(3.6, z, 0);
      P.walk(husband, ctx.lt * 3.2, 0.9);
      husband.face({ eyes: 'tired', mouth: 'flat', brows: 'neutral' });
      st().vignette = 0.7;
      Wd.wcDoor.rotation.y = -1.35;
      Wd.wcLight.intensity = 3.5;
      const h = head(husband);
      const k = (ctx.lt * 1.2) % 1;
      fx.sparkle(h.clone().add(V(0.08, 0.31, 0.1)), 0.2 * Math.sin(Math.PI * k));
      fx.sparkle(h.clone().add(V(-0.12, 0.26, 0.16)), 0.12 * Math.sin(Math.PI * ((k + 0.5) % 1)));
      fx.cloud(V(3.6, 0.2, -4.7), 0.9, ctx.t, { n: 8, size: 0.3, opacity: 0.18, rise: 0.4, seed: 41 });
    },
    shots: [
      (ctx, su) => { const p = husband.root.position; D.move(su, V(4.0, 0.35, p.z + 2.6), V(3.6, 1.8, p.z), V(3.95, 0.35, p.z + 2.4), V(3.6, 1.9, p.z), 54, 50, lin); },
      faceShot(husband, 1.7, 1.45, { dy: 0.28, ldy: 0.1, ang: -0.35 }, { dy: 0.25, ldy: 0.1, ang: -0.25 }, 40, 38, lin),
      faceShot(husband, 1.15, 0.95, { dy: -0.06, ldy: -0.08 }, { dy: -0.06, ldy: -0.08 }, 36, 34, lin),
      (ctx, su) => { const p = husband.root.position; D.move(su, V(2.2, 1.0, p.z + 2.9), V(3.6, 1.15, p.z), V(2.3, 1.0, p.z + 2.7), V(3.6, 1.15, p.z), 52, 50, lin); },
    ],
  };

  // ================================================================ 17  YOU gasps
  const youGaze = () => Math.atan2(3.6 - 1.0, -3.5 - 0.3);
  const husbandFacesYou = () => husband.at(3.6, -3.5, Math.atan2(1.0 - 3.6, 0.3 + 3.5));
  S[17] = {
    setup(ctx) {
      const a = youGaze();
      you.at(1.0, 0.3, a);
      const g = eo(seg(ctx.lt, 0, 0.3));
      you.face({ eyes: 'sparkle', brows: 'raised', mouth: 'o', open: 0.3 + 0.7 * g });
      const h = head(you);
      for (const s of ['L', 'R']) {
        const sx = s === 'L' ? 1 : -1;
        const cheek = h.clone().addScaledVector(leftOf(a), sx * 0.24).addScaledVector(facing(a), 0.12).add(V(0, -0.12, 0));
        reach(you, s, vl(you.handWorld(s), cheek.add(V(0, -0.12, 0)), g), rotHint(you, sx * 0.9, -0.6, 0));
        if (g > 0.5) handDir(you, s, V(0, 1, 0), leftOf(a).multiplyScalar(-sx));
      }
      for (let k = 0; k < 6; k++) {
        const ph = (ctx.lt * 1.1 + k / 6) % 1, an = k * 1.05;
        fx.sparkle(h.clone().addScaledVector(leftOf(a), Math.cos(an) * 0.42).add(V(0, Math.sin(an) * 0.34 + 0.05, 0)).addScaledVector(facing(a), 0.05), 0.12 * Math.sin(Math.PI * ph));
      }
      for (let k = 0; k < 4; k++) {
        const ph = (ctx.lt * 0.9 + k / 4) % 1;
        fx.heart(h.clone().addScaledVector(leftOf(a), -0.42 + k * 0.28).add(V(0, 0.25 + ph * 0.5, 0)), 0.12, { opacity: Math.sin(Math.PI * ph) });
      }
      husbandFacesYou();
    },
    shots: [faceShot(you, 1.7, 1.2, {}, {}, 40, 37, eo)],
  };

  // ================================================================ 18  he sees you (freeze)
  S[18] = {
    setup(ctx) {
      husbandFacesYou();
      husband.face({ eyes: 'wide', brows: 'neutral', mouth: 'flat' });
      const h = head(husband);
      const k = sm(seg(ctx.lt, 0.15, ctx.dur));
      if (ctx.lt > 0.15) fx.drop(h.clone().add(V(0.22, 0.18 - 0.12 * k, 0.2)), 0.1);
      you.at(1.0, 0.3, youGaze());
      you.face({ eyes: 'sparkle', mouth: 'o' });
      st().vignette = 0.72;
    },
    shots: [faceShot(husband, 1.4, 1.15, { dy: 0.02 }, { dy: 0.02 }, 38, 37, eo)],
  };

  // ================================================================ 19  then he smells you
  S[19] = {
    setup(ctx) {
      husbandFacesYou();
      const h = head(husband);
      const reachC = sm(seg(ctx.lt, 0, Math.min(0.9, ctx.dur * 0.6)));
      const water = seg(ctx.lt, Math.min(0.6, ctx.dur * 0.45), Math.min(1.1, ctx.dur * 0.8));
      husband.face({ eyes: water > 0 ? 'squint' : 'wide', brows: 'worried', mouth: 'wavy', tears: water });
      husband.mustache.scale.set(1, 1 - 0.25 * water, 1);
      husband.mustache.rotation.z = 0.06 * Math.sin(ctx.lt * 25) * water;
      husband.nose.scale.set(1 + 0.15 * water, 1 - 0.1 * water, 1);
      const from = h.clone().add(V(-1.6, -0.5, 1.9));
      for (let k = 0; k < 12; k++) {
        const d = clamp(reachC * 1.2 - hash(k) * 0.4);
        const p = vl(from, h.clone().add(V(-0.12 + 0.3 * hash(k + 9), -0.15 + 0.3 * hash(k + 4), 0.25)), d);
        p.y += Math.sin(ctx.t * 2 + k) * 0.05;
        fx.puff(p, 0.1 + 0.1 * hash(k + 2), 0.5, k);
      }
      if (water > 0.4) fx.tearSpray(husband, ctx.t, { rate: 0.8, size: 0.045, spread: 0.5 });
      you.at(1.0, 0.3, youGaze());
    },
    shots: [faceShot(husband, 1.9, 1.45, { ang: -0.45 }, { ang: -0.4 }, 40, 38)],
  };

  // ================================================================ 20  lock me up, please
  const toOfficer = () => Math.atan2(1.0 - 2.55, -1.55 + 2.35);
  const wristsOut = (amt) => {
    const a = husband.root.rotation.y, s = husband.root.scale.x;
    const c = husband.root.position.clone().addScaledVector(facing(a), 0.55 * s).add(V(0, 1.38 * s, 0));
    for (const sd of ['L', 'R']) {
      const sx = sd === 'L' ? 1 : -1;
      const rest = husband.handWorld(sd);
      reach(husband, sd, vl(rest, c.clone().addScaledVector(leftOf(a), sx * 0.05), amt), rotHint(husband, sx * 0.9, -0.5, -0.2));
      if (amt > 0.5) handDir(husband, sd, facing(a), V(0, 1, 0));
    }
  };
  S[20] = {
    cuts: ctx => [ctx.w(1), ctx.find(/^please/i)],
    setup(ctx) {
      husband.at(2.55, -2.35, toOfficer());
      wristsOut(sm(seg(ctx.lt, ctx.w(1) - 0.15, ctx.w(1) + 0.3)));
      husband.neck.rotation.set(0.12, 0, 0);
      husband.face({ eyes: 'tired', brows: 'worried', mouth: ctx.speaking() ? 'open' : 'flat', open: talk(ctx.lt, 7) * 0.35, tears: 0.6 });
      officerNose();
      officer.neck.rotation.set(0, 0.85, 0);
      you.at(1.0, 0.3, youGaze());
      you.face({ eyes: 'wide', brows: 'worried', mouth: 'o', open: 0.3 });
    },
    shots: [
      faceShot(husband, 2.6, 2.3, { ang: 0.55, dy: -0.25, ldy: -0.35 }, { ang: 0.5, dy: -0.25, ldy: -0.33 }, 42, 40),
      faceShot(officer, 1.7, 1.45, { ang: 0.75, dy: 0.05 }, { ang: 0.7, dy: 0.05 }, 40, 38),
      faceShot(husband, 1.4, 1.15, { ang: 0.25 }, { ang: 0.2 }, 38, 36),
    ],
  };

  // ================================================================ 21  LOUD begging on his knees
  const kneelBeg = (ctx, hugLeg) => {
    husband.at(2.55, -2.35, toOfficer() + 0.6);
    wristsOut(1);
    husband.neck.rotation.set(0.35, -0.3, 0);
    husband.face({ eyes: 'tired', brows: 'neutral', mouth: 'frown' });
    const pos = hugLeg ? V(2.6, 0, -1.72) : V(2.75, 0, -1.0);
    const dir = Math.atan2(2.55 - pos.x, -2.35 - pos.z);
    you.at(pos.x, pos.z, dir);
    P.kneel(you);
    const w = Math.sin(ctx.lt * 7);
    if (hugLeg) {
      const leg = husband.root.position.clone().add(V(0, 0.75, 0));
      reach(you, 'L', leg.clone().addScaledVector(leftOf(dir), -0.12).addScaledVector(facing(dir), 0.05), rotHint(you, 1, -0.3, 0));
      reach(you, 'R', leg.clone().addScaledVector(leftOf(dir), 0.12).addScaledVector(facing(dir), 0.05).add(V(0, 0.1, 0)), rotHint(you, -1, -0.3, 0));
      you.spine.rotation.x = 0.25;
      you.neck.rotation.set(-0.5, 0.35, 0.25);
    } else {
      for (const s of ['L', 'R']) { const a = you.arm[s]; a.sh.rotation.set(-1.9 - 0.25 * w, 0, a.sx * (0.35 + 0.15 * w)); a.el.rotation.set(-0.25, 0, 0); }
      you.spine.rotation.x = -0.15;
      you.neck.rotation.set(-0.45, 0.1 * w, 0.1 * w);
    }
    you.face({ eyes: 'closed', brows: 'worried', mouth: 'open', open: 0.55 + 0.35 * Math.abs(Math.sin(ctx.lt * 9)), tears: 1 });
    fx.tearSpray(you, ctx.t, { rate: 1.6, size: 0.065, spread: 1.2 });
  };
  S[21] = {
    cuts: ctx => {
      const ws = ctx.sc.words, out = [];
      ws.forEach((w, i) => { if (i > 0 && /[!,]$/.test(ws[i - 1].t)) out.push(w.s - 0.05); });
      return out;
    },
    setup(ctx) {
      kneelBeg(ctx, ctx.shot.shot === 4);
      officerNose();
      officer.neck.rotation.set(-0.1, 0.9, 0);
      const hs = sm(seg(ctx.lt, 0.1, 0.5));
      for (let k = 0; k < 7; k++) {
        const ph = (ctx.lt * 0.45 + k / 7) % 1;
        st().hearts2D.push({ x: 0.08 + 0.14 * k + 0.04 * Math.sin(ctx.lt + k), y: 1.15 - ph * 1.35, size: 0.2 + 0.1 * hash(k + 1), alpha: 0.85 * hs * Math.min(1, Math.sin(Math.PI * ph) * 2), rot: Math.sin(ctx.lt * 2 + k) * 0.25 });
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(4.4, 0.85, 0.5), V(2.65, 1.15, -1.6), V(4.2, 0.9, 0.3), V(2.65, 1.15, -1.6), 50, 46),
      faceShot(you, 1.5, 1.2, { dy: -0.05 }, { dy: -0.05 }, 40, 38),
      faceShot(husband, 1.6, 1.35, { dy: -0.05, ang: 0.25 }, { dy: -0.05, ang: 0.25 }, 40, 38),
      (ctx, su) => { st().speed = 1; const [a, b] = faceCam(you, 2.0), [c, d] = faceCam(you, 0.9); D.move(su, a, b, c, d, 40, 34, lin, 0.05 * Math.sin(ctx.lt * 3)); },
      (ctx, su) => D.move(su, V(4.4, 1.3, -0.5), V(2.55, 1.15, -2.0), V(4.2, 1.3, -0.7), V(2.55, 1.15, -2.0), 46, 44),
    ],
  };

  // ================================================================ 22  walks into the cell himself
  const cellPath = (u) => {
    const a = V(-1.4, 0, -0.9), b = V(-3.25, 0, -1.25), c = V(-3.5, 0, -2.6);
    return u < 0.6 ? vl(a, b, u / 0.6) : vl(b, c, (u - 0.6) / 0.4);
  };
  S[22] = {
    cuts: ctx => [ctx.find(/^now/i)],
    setup(ctx) {
      const now = ctx.find(/^now/i) ?? ctx.dur * 0.6;
      const u = seg(ctx.lt, 0, Math.max(0.6, now));
      const p = cellPath(u), p2 = cellPath(Math.min(1, u + 0.02));
      husband.at(p.x, p.z, u < 1 ? Math.atan2(p2.x - p.x, p2.z - p.z) : 0);
      if (u < 1) {
        P.walk(husband, ctx.lt * 9, 1);
      } else {
        const a = 0, c = chest(husband, 0.2);
        reach(husband, 'L', c.clone().addScaledVector(leftOf(a), -0.16).addScaledVector(facing(a), 0.12), rotHint(husband, 1, -0.6, 0));
        reach(husband, 'R', c.clone().addScaledVector(leftOf(a), 0.16).addScaledVector(facing(a), 0.16).add(V(0, 0.03, 0)), rotHint(husband, -1, -0.6, 0));
      }
      husband.face({ eyes: 'tired', brows: 'angry', mouth: ctx.speaking() ? 'open' : 'flat', open: 0.35 });
      you.at(0.2, 0.7, Math.atan2(-3.2, -2.0));
      P.kneel(you);
      you.face({ eyes: 'closed', mouth: 'open', tears: 1 });
    },
    shots: [
      (ctx, su) => D.move(su, V(-0.9, 1.65, 1.6), V(-2.9, 1.2, -1.6), V(-1.1, 1.62, 1.3), V(-3.0, 1.2, -1.8), 50, 48),
      (ctx, su) => D.move(su, V(-3.35, 1.75, -0.2), V(-3.55, 1.75, -2.6), V(-3.35, 1.76, -0.45), V(-3.55, 1.78, -2.6), 44, 40, eo),
    ],
  };

  // ================================================================ 23  slow-mo run
  const runDir = Math.atan2(-1.0 - 1.7, -0.35 - 0.9);
  const runPath = (lt, dur) => vl(V(1.7, 0, 0.9), V(-1.0, 0, -0.35), seg(lt, 0, Math.max(dur, 1.8) + 0.8));
  const poseRun = (lt, dur) => {
    const p = runPath(lt, dur);
    you.at(p.x, p.z, runDir);
    P.run(you, lt * 3.5, 1);
    P.armsOpen(you, 1);
    you.face({ eyes: 'happy', brows: 'raised', mouth: 'grin' });
  };
  S[23] = {
    setup(ctx) {
      poseRun(ctx.lt, ctx.dur);
      st().vignette = 0.65;
      const h = head(you);
      for (let k = 0; k < 5; k++) {
        const ph = (ctx.lt * 0.8 + k / 5) % 1;
        fx.sparkle(h.clone().add(V(Math.cos(k * 1.3) * 0.6, -0.3 + ph * 0.8, Math.sin(k * 1.3) * 0.4)), 0.13 * Math.sin(Math.PI * ph));
        fx.heart(h.clone().addScaledVector(facing(runDir), -0.6 - ph * 0.8).add(V(0, -0.1 + 0.3 * Math.sin(k * 2), 0)), 0.12, { opacity: 1 - ph });
      }
      husband.at(-3.6, -2.7, 0);
      husband.face({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
    },
    shots: [
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().addScaledVector(facing(runDir), 2.6).add(V(0, 0.55, 0)), p.clone().add(V(0, 1.4, 0)), p.clone().addScaledVector(facing(runDir), 2.4).add(V(0, 0.55, 0)), p.clone().add(V(0, 1.45, 0)), 46, 44); st().streaks = { dir: 1, x: 0.5 }; },
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().addScaledVector(leftOf(runDir), 2.6).add(V(0, 1.3, 0)), p.clone().add(V(0, 1.3, 0)), p.clone().addScaledVector(leftOf(runDir), 2.5).add(V(0, 1.3, 0)), p.clone().add(V(0, 1.3, 0)), 44, 44); st().streaks = { dir: -1, x: 0.5 }; },
    ],
  };

  // ================================================================ 24  freeze + giant cloud
  S[24] = {
    cuts: ctx => [ctx.w(1)],
    setup(ctx) {
      const fz = ctx.w(1);
      const d23 = D.byId[23] ? D.byId[23].dur : 1.5;
      poseRun(d23 + Math.min(ctx.lt, fz), d23);
      husband.at(-3.6, -2.7, 0);
      husband.face({ eyes: 'wide', brows: 'worried', mouth: 'o' });
      if (ctx.lt >= fz) {
        const a = ctx.lt - fz;
        st().sat = 0.6;
        st().flash = Math.max(0, 1 - a / 0.12) * 0.8;
        st().shakeAmt = 16 * Math.max(0.3, 1 - a / 0.8);
        st().vignette = 0.8;
        you.face({ eyes: 'wide', brows: 'raised', mouth: 'grin' });
        const c = you.root.position.clone().add(V(0, 1.1, 0));
        const g = eo(seg(a, 0, 0.7));
        fx.cloud(c, 0.4 + 2.0 * g, ctx.t, { n: 34, size: 0.3 + 0.4 * g, opacity: 0.7, rise: 1.6 * g + 0.3, seed: 77 });
        fx.stinkLines(c, ctx.t, { n: 6, spread: 0.9, height: 1.6, size: 0.6, seed: 13 });
      } else st().streaks = { dir: 1, x: 0.5 };
    },
    shots: [
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().addScaledVector(facing(runDir), 2.3).add(V(0, 0.6, 0)), p.clone().add(V(0, 1.4, 0)), p.clone().addScaledVector(facing(runDir), 2.2).add(V(0, 0.6, 0)), p.clone().add(V(0, 1.45, 0)), 46, 45); },
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(2.6, 2.2, 4.2)), p.clone().add(V(-0.8, 1.0, -0.6)), p.clone().add(V(3.1, 2.5, 4.9)), p.clone().add(V(-0.8, 1.0, -0.6)), 52, 58, eo); },
    ],
  };

  // ================================================================ 25  grabs the keys
  S[25] = {
    setup(ctx) {
      const g = D.keyGrab() - D.byId[25].start;
      officer.at(1.85, -1.5, 0);
      officer.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
      P.holdNose(officer, 'L');
      const keyP = Wd.keysHome.clone();
      const above = keyP.clone().add(V(0.15, 0.5, -0.15));
      const onKeys = keyP.clone().add(V(0.0, 0.12, -0.06));
      const away = keyP.clone().add(V(0.25, 0.75, -0.35));
      let tgt;
      if (ctx.lt < g) tgt = vl(above, onKeys, sm(seg(ctx.lt, g - 0.45, g)));
      else tgt = vl(onKeys, away, ei(seg(ctx.lt, g + 0.05, g + 0.3)));
      reach(officer, 'R', tgt, V(0.3, -0.2, -1));
      handDir(officer, 'R', V(0, -1, 0.35), V(0, -1, 0));
      const grip = ctx.lt >= g;
      officer.arm.R.fingers.forEach(f => { f.rotation.z = -1 * (grip ? 1.2 : 0.2); });
      Wd.keys.visible = true;
      if (grip) {
        const hp = officer.handWorld('R');
        Wd.keys.position.copy(hp).add(V(0, -0.12, 0.02));
        Wd.keys.rotation.set(1.2 + 0.4 * Math.sin(ctx.lt * 25), 0.3, 0.5 * Math.sin(ctx.lt * 18));
        st().streaks = null;
      }
    },
    shots: [
      (ctx, su) => D.move(su, V(2.08, 1.28, -0.45), V(2.0, 1.14, -1.15), V(2.06, 1.27, -0.55), V(2.0, 1.15, -1.15), 44, 40),
    ],
  };

  // ================================================================ 26  locks the cell
  S[26] = {
    cuts: ctx => [D.lockTime() - D.byId[26].start - 0.05],
    setup(ctx) {
      const lk = D.lockTime() - D.byId[26].start;
      const close = ei(seg(ctx.lt, lk - 0.4, lk));
      Wd.cellDoor.rotation.y = 1.5 * (1 - close);
      officer.at(-3.4, -1.98, 0);
      officer.face({ eyes: 'squint', brows: 'angry', mouth: 'flat' });
      P.holdNose(officer, 'L');
      Wd.cellDoor.updateMatrixWorld(true);
      const lockP = Wd.cellLock.getWorldPosition(V(0, 0, 0));
      const turned = ctx.lt > lk;
      // key goes into the front of the lock; the hand reaches round through the bars
      Wd.keys.visible = true;
      Wd.keys.scale.setScalar(0.7);
      Wd.keys.position.copy(lockP).add(V(0, 0, 0.2));
      Wd.keys.rotation.set(0, Math.PI, turned ? 1.5 : 0);
      reach(officer, 'R', lockP.clone().add(V(-0.02, -0.05, 0.27)), V(-0.8, -0.6, -0.3));
      handDir(officer, 'R', V(0.3, 0, -1), V(0, -1, 0));
      officer.arm.R.fingers.forEach(f => { f.rotation.z = -0.9; });
      husband.at(-3.95, -2.75, 0.2);
      husband.face({ eyes: 'tired', mouth: 'flat' });
      P.holdNose(husband, 'R');
      if (turned) st().shakeAmt = 8 * Math.max(0, 1 - (ctx.lt - lk) / 0.25);
      you.at(-1.4, -0.3, Math.atan2(-2.0, -1.4));
      you.face({ eyes: 'happy', mouth: 'grin' });
    },
    shots: [
      (ctx, su) => D.move(su, V(-2.3, 1.55, 0.3), V(-3.45, 1.2, -1.8), V(-2.4, 1.52, 0.1), V(-3.5, 1.2, -1.8), 46, 42),
      (ctx, su) => D.move(su, V(-3.35, 1.3, -0.85), V(-3.66, 1.1, -1.6), V(-3.4, 1.28, -0.98), V(-3.66, 1.1, -1.6), 38, 34, eo),
    ],
  };

  // ================================================================ 27  the reveal
  S[27] = {
    setup(ctx) {
      Wd.cellDoor.rotation.y = 0;
      officer.at(-3.45, -2.3, 0.1);
      officer.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
      P.holdNose(officer, 'L');
      husband.at(-4.2, -2.75, 0.2);
      husband.face({ eyes: 'tired', brows: 'worried', mouth: 'frown' });
      P.holdNose(husband, 'R');
      prisoner.reset();
      prisoner.at(-5.0, -2.5, 0.3);
      prisoner.face({ eyes: 'squint', brows: 'worried', mouth: 'wavy' });
      P.holdNose(prisoner, 'R');
      const a = 0.37;
      you.at(-1.95, -1.3, a);
      const wv = Math.sin(ctx.lt * 9);
      const R = you.arm.R;
      R.sh.rotation.set(-0.2, 0, -2.6 - 0.25 * wv);
      R.el.rotation.set(-0.3 + 0.3 * wv, 0, 0);
      you.face({ eyes: 'happy', brows: 'raised', mouth: 'grin' });
      fx.cloud(V(-2.1, 0.9, -1.35), 0.75, ctx.t, { n: 12, size: 0.24, opacity: 0.4, rise: 1.6, seed: 88 });
      fx.stinkLines(V(-2.2, 1.3, -1.3), ctx.t, { n: 4, spread: 0.45, height: 1.3, size: 0.48, seed: 14 });
      fx.cloud(V(-2.6, 1.9, -1.4), 1.6, ctx.t, { n: 8, size: 0.35, opacity: 0.12, rise: 1.4, seed: 89 });
    },
    shots: [
      (ctx, su) => D.move(su, V(-1.0, 1.5, 1.7), V(-3.4, 1.35, -2.3), V(-0.7, 1.6, 2.2), V(-3.4, 1.35, -2.3), 46, 48, lin),
    ],
  };

  return S;
}

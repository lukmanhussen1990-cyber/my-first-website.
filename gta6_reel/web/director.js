// Scene direction. Every frame is a pure function of time t; scene cuts and
// key actions are anchored to the word timings of the voiceover.
import * as THREE from 'three';
import { P, talk, reach, handDir } from './lib/chars.js';
import { SET, calendarTex } from './lib/sets.js';
import { textTexture, makeCanvas, toTex, strokeText } from './lib/gfx.js';

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
const R0 = SET.room, PL = SET.plaza, LB = SET.lobby, ST = SET.studio, SK = SET.sky;
const rp = (x, y, z) => V(R0.x + x, R0.y + y, R0.z + z);
const pp = (x, y, z) => V(PL.x + x, PL.y + y, PL.z + z);
const lp = (x, y, z) => V(LB.x + x, LB.y + y, LB.z + z);
const sp = (x, y, z) => V(ST.x + x, ST.y + y, ST.z + z);

export class Director {
  constructor({ camera, world, cast, fx, timeline }) {
    Object.assign(this, { camera, world, cast, fx, tl: timeline });
    this.scenes = timeline.scenes.map((sc, i) => ({ ...sc, words: timeline.words.filter(w => w.line === i).map(w => ({ t: w.t, s: w.s - sc.start, e: w.e - sc.start })) }));
    this.byId = {};
    this.scenes.forEach(s => { this.byId[s.id] = s; });
    this.tex = {
      ticket: ticketTex(), phone: phoneTex(), sold: textTexture('SOLD', { w: 256, h: 128, bg: '#e3182d', fg: '#fff', size: 86, border: '#ffffff' }),
    };
    this.defs = makeScenes(this);
    this.events = this.buildEvents();
  }
  // local time of the first word matching re in scene id (or fallback fraction)
  wt(id, re, frac = 0.5) {
    const s = this.byId[id]; if (!s) return 0;
    const w = s.words.find(w => re.test(w.t));
    return w ? w.s : s.dur * frac;
  }
  abs(id, re, frac) { return this.byId[id].start + this.wt(id, re, frac); }

  ctxFor(t) {
    let k = this.scenes.findIndex(s => t >= s.start && t < s.end);
    if (k < 0) k = t < 0 ? 0 : this.scenes.length - 1;
    const sc = this.scenes[k], lt = t - sc.start;
    return {
      t, lt, sc, id: sc.id, dur: sc.dur, u: clamp(lt / sc.dur),
      w: i => (sc.words[Math.min(i, sc.words.length - 1)] || { s: 0 }).s,
      find: (re, frac = 0.5) => this.wt(sc.id, re, frac),
      speaking: () => sc.words.some(w => lt >= w.s - 0.02 && lt <= w.e + 0.02),
    };
  }
  schedule(def, ctx) {
    const dur = ctx.dur;
    let cuts = def.cuts ? def.cuts(ctx).filter(c => c != null && c > 0.3 && c < dur - 0.3) : null;
    if (!cuts) {
      const n = Math.max(1, Math.min(def.shots.length, Math.round(dur / 1.2)));
      cuts = []; for (let i = 1; i < n; i++) cuts.push(dur * i / n);
    }
    const b = [0, ...cuts.sort((a, c) => a - c), dur];
    const segs = [];
    for (let i = 0; i < b.length - 1; i++) {
      const len = b[i + 1] - b[i];
      const parts = len > 1.6 ? Math.ceil(len / 1.3) : 1;
      for (let p = 0; p < parts; p++) segs.push([b[i] + len * p / parts, b[i] + len * (p + 1) / parts]);
    }
    let idx = segs.findIndex(s => ctx.lt >= s[0] && ctx.lt < s[1]);
    if (idx < 0) idx = segs.length - 1;
    const [a, c] = segs[idx];
    return { shot: idx % def.shots.length, seg: idx, su: clamp((ctx.lt - a) / (c - a)), slt: ctx.lt - a, sdur: c - a };
  }
  setCam(pos, look, fov = 40, roll = 0) {
    const c = this.camera;
    c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(look);
    if (roll) c.rotateZ(roll);
    c.fov = fov; c.updateProjectionMatrix();
  }
  move(su, p1, l1, p2, l2, f1 = 40, f2 = f1, ease = sm, roll = 0) {
    const u = ease(su);
    this.setCam(vl(p1, p2, u), vl(l1, l2, u), lerp(f1, f2, u), roll);
  }

  update(t) {
    this.fx.begin();
    this.state = { shake: [0, 0], shakeAmt: 0, flash: 0, fade: 0, vignette: 0.18, speed: 0, labels: [], stamps: [], bubble: null, banner: null, whoosh: null, tvView: null };
    const ctx = this.ctxFor(t);
    const def = this.defs[ctx.id];
    ctx.shot = this.schedule(def, ctx);
    this.baseline(ctx);
    def.setup(ctx);
    def.shots[ctx.shot.shot](ctx, ctx.shot.su, ctx.shot);
    if (this.forceCam) this.setCam(V(...this.forceCam.pos), V(...this.forceCam.look), this.forceCam.fov);
    this.camera.updateMatrixWorld(true);
    this.fx.cullNear(this.camera.position);
    const cap = this.tl.captions.find(c => t >= c.s && t < c.hide);
    if (cap && cap.loud) this.state.shakeAmt = Math.max(this.state.shakeAmt, 9 * (0.4 + 0.6 * Math.max(0, 1 - (t - cap.s) / 0.4)));
    const a = this.state.shakeAmt;
    if (a > 0) this.state.shake = [a * (hash(Math.floor(t * 30)) - 0.5) * 2, a * (hash(Math.floor(t * 30) + 77) - 0.5) * 2];
    const end = this.tl.duration;
    this.state.fade = Math.max(this.state.fade, seg(t, end - 0.7, end - 0.03));
    return this.state;
  }

  // ------------------------------------------------------------ defaults
  baseline(ctx) {
    const c = this.cast, Wd = this.world, id = ctx.id;
    for (const k of ['you', 'mom', 'recep', 'guard1', 'guard2', 'w1', 'w2', 'w3', 'w4', 'reporter']) { c[k].reset(); c[k].root.visible = false; }
    for (const k in c.props) (Array.isArray(c.props[k]) ? c.props[k] : [c.props[k]]).forEach(p => { p.visible = false; p.scale.setScalar(1); });
    c.you.setNaked(id >= 11);
    c.you.beard(id >= 3 ? 0.4 : 0);
    Wd.faces.forEach(f => { f.visible = false; });
    Wd.tvScreen.material.map = Wd.tvTex.soon;
    Wd.calendar.material.map = Wd.calTex[2026];
    Wd.bike.visible = true; Wd.ps.visible = true;
    Wd.roomDoor.rotation.y = 0;
    Wd.plazaDoors.forEach((d, i) => { d.position.x = (i ? 0.6 : -0.6); });
    Wd.lobbyDoors.forEach((d, i) => { d.position.x = (i ? 0.6 : -0.6); });
    Wd.hemi.intensity = 1.25; Wd.hemi.color.setHex(0xfffbf5); Wd.sun.intensity = 2.1; Wd.sun.color.setHex(0xfff3e2);
    Wd.plane.visible = true;
  }
  inRoom(bg = 0xc8daf2) { this.world.sunAt(R0, 6, [3, 8, 6]); this.scene().background.setHex(bg); }
  scene() { return this.world.sun.parent; }

  // ------------------------------------------------------------ sounds + comic words
  buildEvents() {
    const ev = [];
    const has = id => !!this.byId[id];
    const add = (t, type, word, o = {}) => ev.push({ t: Math.max(0, t), type, word, ...o });
    if (has(4)) { add(this.abs(4, /^check/i, 0.4), 'ding', { text: 'DING!', x: 0.72, y: 0.2, rot: 0.15, color: '#ffd60a', size: 110 }); add(this.abs(4, /^still/i, 0.75), 'stamp', null); }
    if (has(5)) { add(this.abs(5, /^still/i, 0.75), 'stamp', null); add(this.abs(5, /^still/i, 0.75) + 0.05, 'pop', { text: 'POP!', x: 0.3, y: 0.18, rot: -0.15, color: '#ffd60a', size: 110 }); }
    if (has(9)) { add(this.abs(9, /^bike/i, 0.3) + 0.1, 'stamp', null); add(this.abs(9, /^playstation/i, 0.8) + 0.1, 'stamp', null); }
    if (has(10)) add(this.abs(10, /^ticket/i, 0.6), 'sparkle', null, { gain: 0.35 });
    if (has(11)) add(this.byId[11].start + 0.05, 'whoosh', { text: 'WHOOSH!', x: 0.5, y: 0.2, rot: -0.1, color: '#4fc3ff', size: 140, dur: 1.0 }, { dur: 1.1 });
    if (has(14)) add(this.abs(14, /^stops/i, 0.5) - 0.05, 'gasp', { text: 'GASP!', x: 0.5, y: 0.2, rot: 0.08, color: '#ffd60a', size: 150, dur: 1.0 });
    if (has(15)) add(this.byId[15].start + this.splashT(), 'splash', { text: 'SPLASH!', x: 0.5, y: 0.22, rot: -0.1, color: '#ff8a1e', size: 140, dur: 0.9 });
    if (has(22)) add(this.abs(22, /^right/i, 0.6), 'plop', { text: 'PLOP!', x: 0.5, y: 0.42, rot: -0.12, color: '#ff2e2e', size: 190, dur: 1.2 });
    if (has(25)) add(this.byId[25].start + this.faintT() + 0.35, 'thud', { text: 'THUD!', x: 0.5, y: 0.22, rot: 0.1, color: '#ff2e2e', size: 150, dur: 0.9 });
    if (has(29)) add(this.byId[29].start + 0.02, 'jingle', null, { gain: 0.6 });
    if (has(30)) add(this.abs(30, /^delayed/i, 0.5), 'stamp', null);
    return ev;
  }
  splashT() { const s = this.byId[15]; return clamp(this.wt(15, /^coffee/i, 0.7) + 0.35, 0.6, s.dur - 0.25); }
  faintT() { const s = this.byId[25]; return clamp(this.wt(25, /^faints/i, 0.5) - 0.1, 0.2, s.dur - 0.6); }
  comicWords(t) {
    const sceneEnd = tt => { const s = this.scenes.find(x => tt >= x.start && tt < x.end); return s ? s.end : 1e9; };
    return this.events.filter(e => e.word && t >= e.t && t < Math.min(e.t + (e.word.dur || 0.8), sceneEnd(e.t) + 0.15))
      .map(e => ({ ...e.word, t: e.t, dur: e.word.dur || 0.8 }));
  }
}

function ticketTex() {
  const [c, g] = makeCanvas(640, 300);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(0, 0, 640, 300, 26); g.fill();
  g.fillStyle = '#2f6bff'; g.beginPath(); g.roundRect(0, 0, 640, 84, [26, 26, 0, 0]); g.fill();
  strokeText(g, 'BOARDING PASS', 320, 44, 50, { fill: '#fff', lw: 0 });
  strokeText(g, 'ONE WAY', 200, 135, 44, { fill: '#111', lw: 0, weight: 900 });
  strokeText(g, 'TO: ROCKSTAR', 200, 195, 46, { fill: '#e3182d', lw: 0, weight: 900 });
  strokeText(g, 'SEAT 1A', 200, 252, 34, { fill: '#555', lw: 0, weight: 800 });
  g.setLineDash([12, 10]); g.strokeStyle = '#999'; g.lineWidth = 4; g.beginPath(); g.moveTo(450, 95); g.lineTo(450, 290); g.stroke();
  g.fillStyle = '#111'; for (let k = 0; k < 18; k++) g.fillRect(480 + k * 7, 120, k % 3 ? 3 : 5, 140);
  return toTex(c);
}
function phoneTex() {
  const [c, g] = makeCanvas(300, 600);
  g.fillStyle = '#f2f4f8'; g.fillRect(0, 0, 300, 600);
  g.fillStyle = '#2f6bff'; g.fillRect(0, 0, 300, 90);
  strokeText(g, 'GAME NEWS', 150, 48, 34, { fill: '#fff', lw: 0 });
  g.fillStyle = '#ffffff'; g.fillRect(20, 120, 260, 260);
  const grd = g.createLinearGradient(20, 120, 280, 380); grd.addColorStop(0, '#ff7ac6'); grd.addColorStop(1, '#4fc3ff');
  g.fillStyle = grd; g.fillRect(30, 130, 240, 150);
  strokeText(g, 'GTA 6', 150, 205, 64, { fill: '#fff', stroke: '#000', lw: 0.1 });
  strokeText(g, 'STILL', 150, 320, 44, { fill: '#e3182d', lw: 0 });
  strokeText(g, 'DELAYED', 150, 365, 44, { fill: '#e3182d', lw: 0 });
  g.fillStyle = '#d9dde3'; for (let k = 0; k < 4; k++) g.fillRect(20, 410 + k * 44, 260 - k * 30, 24);
  return toTex(c);
}

// ======================================================================
function makeScenes(D) {
  const { you, mom, recep, guard1, guard2, w1, w2, w3, w4, reporter, props } = D.cast;
  const Wd = D.world, fx = D.fx;
  const S = {};
  const st = () => D.state;
  const head = p => p.headWorld();
  const rotHint = (p, x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.root.rotation.y);
  const chest = (p, f = 0.15) => { p.root.updateMatrixWorld(true); return p.spine.localToWorld(V(0, 0.4, f)); };
  const faceCam = (p, dist, { ang = 0, dy = 0, ldy = 0, side = 0 } = {}) => {
    const h = head(p), a = p.root.rotation.y + ang;
    return [h.clone().addScaledVector(facing(a), dist).add(V(0, dy, 0)).addScaledVector(leftOf(a), side), h.clone().add(V(0, ldy, 0))];
  };
  const faceShot = (p, d1, d2, o1 = {}, o2 = o1, f1 = 38, f2 = f1, ease = sm) => (ctx, su) => {
    const [a, b] = faceCam(p, d1, o1), [c, d] = faceCam(p, d2, o2);
    D.move(su, a, b, c, d, f1, f2, ease);
  };
  const show = (...ps) => ps.forEach(p => { p.root.visible = true; });
  const bg = (hex) => { D.scene().background.setHex(hex); };
  const label = (text, x, y, world = null, o = {}) => st().labels.push({ text, x, y, world, ...o });
  const stamp = (text, x, y, t0abs, o = {}) => st().stamps.push({ text, x, y, t: t0abs, ...o });

  // hold the controller in the right hand (or both)
  const holdController = (p, mode = 'lap') => {
    const c = props.controller; c.visible = true;
    const a = p.root.rotation.y;
    if (mode === 'lap') {
      const ch = chest(p, 0.3).add(V(0, -0.33, 0));
      reach(p, 'L', ch.clone().addScaledVector(leftOf(a), 0.09), rotHint(p, 1, -0.5, -0.2));
      reach(p, 'R', ch.clone().addScaledVector(leftOf(a), -0.09), rotHint(p, -1, -0.5, -0.2));
      handDir(p, 'L', facing(a).add(V(0, 0.3, 0)), V(0, -1, 0));
      handDir(p, 'R', facing(a).add(V(0, 0.3, 0)), V(0, -1, 0));
      c.position.copy(ch).addScaledVector(facing(a), 0.04).add(V(0, 0.03, 0));
      c.rotation.set(-0.5, a, 0, 'YXZ');
    } else { // held up high in the right hand
      const hp = p.handWorld('R');
      c.position.copy(hp).addScaledVector(facing(a), 0.06).add(V(0, 0.05, 0));
      c.rotation.set(-1.2, a, 0, 'YXZ');
    }
  };

  // ================================================================ 1
  const youChair = () => { you.at(R0.x, R0.z - 0.5, Math.PI); P.sit(you, 0.54); };
  S[1] = {
    setup(ctx) {
      D.inRoom(); show(you);
      youChair(); holdController(you);
      const twitch = Math.sin(ctx.lt * 31) > 0.85 ? 1 : 0;
      you.face({ eyes: 'wide', eyeScale: 1 + 0.1 * twitch, brows: 'worried', mouth: 'wavy' });
      you.neck.rotation.x = -0.05;
    },
    shots: [
      (ctx, su) => D.move(su, rp(0.55, 1.45, 1.1), rp(0, 1.35, -2.86), rp(0.45, 1.4, 0.7), rp(0, 1.38, -2.86), 46, 42),
      faceShot(you, 1.4, 1.1, { ang: 0.15, dy: 0.02 }, { ang: 0.1, dy: 0.02 }, 38, 36),
    ],
  };

  // ================================================================ 2  years go by
  S[2] = {
    cuts: ctx => [ctx.dur * 0.45],
    setup(ctx) {
      D.inRoom(); show(you);
      youChair(); holdController(you);
      const u = sm(seg(ctx.lt, 0.1, ctx.dur - 0.1));
      const year = 2019 + Math.min(7, Math.floor(u * 8));
      Wd.calendar.material.map = Wd.calTex[year];
      you.beard(0.4 * u);
      you.face({ eyes: 'normal', brows: 'worried', mouth: 'flat' });
      // pages flying off the calendar
      for (let k = 0; k < 7; k++) {
        const t0 = (k / 8) * (ctx.dur - 0.2);
        const a = ctx.lt - t0;
        if (a < 0 || a > 1.0) continue;
        const p = rp(-1.95 + a * (0.8 + k * 0.1), 1.75 + a * 0.6 - a * a * 0.9, -2.9 + a * 1.4);
        fx.card(Wd.calTex[2019 + k], p, 0.62, 0.8, [a * 2.5, a * 3 + k, a * 1.5]);
      }
      label(String(year), 0.5, 0.17, null, { size: 90, color: '#ffffff' });
    },
    shots: [
      (ctx, su) => D.move(su, rp(-1.4, 1.75, -1.0), rp(-1.95, 1.72, -2.98), rp(-1.5, 1.75, -1.3), rp(-1.95, 1.72, -2.98), 46, 42),
      faceShot(you, 1.6, 1.3, { dy: -0.05, ldy: -0.12 }, { dy: -0.05, ldy: -0.14 }, 40, 38),
    ],
  };

  // ================================================================ 3  GTA 5 x40
  S[3] = {
    cuts: ctx => [ctx.find(/^gta/i, 0.3), ctx.find(/^forty/i, 0.6)],
    setup(ctx) {
      D.inRoom(); show(you);
      youChair(); holdController(you);
      Wd.tvScreen.material.map = Wd.tvTex.done;
      const n = Math.min(40, 1 + Math.floor(39 * ei(seg(ctx.lt, 0.2, ctx.find(/^times/i, 0.85) + 0.1))));
      const tw = Math.sin(ctx.lt * 25) * 0.04;
      you.face({ eyes: 'wide', brows: 'raised', mouth: n >= 40 ? 'grin' : 'flat' });
      label('x' + n, 0.5, 0.26, null, { size: 120 + (n >= 40 ? 30 : 0), color: '#ffd60a' });
      for (const s of ['L', 'R']) you.arm[s].hand.position.y = -0.26 + tw * (s === 'L' ? 1 : -1);
    },
    shots: [
      (ctx, su) => D.move(su, rp(0.0, 1.45, -0.9), rp(0, 1.42, -2.86), rp(0.0, 1.43, -1.2), rp(0, 1.42, -2.86), 44, 42),
      (ctx, su) => D.move(su, rp(1.8, 1.6, 1.0), rp(0, 0.9, -1.2), rp(1.6, 1.55, 0.8), rp(0, 0.9, -1.2), 50, 48),
      faceShot(you, 1.3, 1.05, { ang: -0.2 }, { ang: -0.15 }, 38, 36),
    ],
  };

  // ================================================================ 4  morning news
  S[4] = {
    cuts: ctx => [ctx.find(/^check/i, 0.35), ctx.find(/^still/i, 0.7)],
    setup(ctx) {
      D.inRoom(0xd8ecff); show(you);
      Wd.hemi.intensity = 1.4; Wd.sun.color.setHex(0xfff0c8);
      you.at(R0.x + 1.62, R0.z - 0.9, -Math.PI / 2);
      P.sit(you, 0.53);
      const a = -Math.PI / 2;
      const h = head(you);
      const ph = h.clone().addScaledVector(facing(a), 0.46).add(V(0, -0.22, 0));
      reach(you, 'R', ph.clone().add(V(0, -0.05, 0)), rotHint(you, -1, -0.6, 0));
      reach(you, 'L', ph.clone().addScaledVector(leftOf(a), 0.06).add(V(0, -0.08, 0)), rotHint(you, 1, -0.6, 0));
      const phone = props.phone; phone.visible = true;
      phone.position.copy(ph); phone.lookAt(h); phone.rotateX(0);
      fx.card(D.tex.phone, ph.clone().addScaledVector(V().subVectors(h, ph).normalize(), 0.008), 0.068, 0.136, [0, 0, 0]).lookAt(h);
      const still = ctx.find(/^still/i, 0.7);
      you.face({ eyes: ctx.lt > still ? 'wide' : 'squint', brows: 'worried', mouth: ctx.lt > still ? 'o' : 'flat', look: [0, -0.6] });
      you.neck.rotation.x = 0.35;
      if (ctx.lt > still - 0.02) { stamp('DELAYED', 0.5, 0.4, D.byId[4].start + still); st().shakeAmt = Math.max(st().shakeAmt, 10 * Math.max(0, 1 - (ctx.lt - still) / 0.3)); }
      label('7:00 AM', 0.22, 0.12, null, { size: 50, color: '#ffffff' });
    },
    shots: [
      (ctx, su) => D.move(su, rp(-0.4, 1.4, -0.3), rp(1.5, 1.2, -0.95), rp(-0.2, 1.4, -0.4), rp(1.5, 1.2, -0.95), 46, 44),
      (ctx, su) => { const p = props.phone.position.clone(); const n = V().subVectors(head(you), p).normalize(); D.move(su, p.clone().addScaledVector(n, 0.24).add(V(0.02, 0.01, 0)), p, p.clone().addScaledVector(n, 0.19).add(V(0.015, 0.01, 0)), p, 42, 40); },
      faceShot(you, 1.2, 0.95, { dy: -0.05 }, { dy: -0.05 }, 38, 36),
    ],
  };

  // ================================================================ 5  dreams, popped
  S[5] = {
    cuts: ctx => [ctx.find(/^still/i, 0.7)],
    setup(ctx) {
      D.inRoom(0x2a3466); show(you);
      Wd.hemi.intensity = 0.95; Wd.hemi.color.setHex(0xb8c6ff); Wd.sun.intensity = 1.2; Wd.sun.color.setHex(0xaabaff);
      you.at(R0.x + 2.15, R0.z + 0.15, 0, 0.63);
      P.lieBack(you); you.body.position.set(0, 0, 0);
      you.face({ eyes: 'closed', mouth: 'smile', brows: 'neutral' });
      const h = head(you);
      for (let k = 0; k < 3; k++) { const ph = (ctx.lt * 0.6 + k / 3) % 1; fx.z(h.clone().add(V(-0.25 - ph * 0.3, 0.25 + ph * 0.6, 0.1)), 0.12 + ph * 0.1, { opacity: Math.sin(Math.PI * ph) }); }
      const still = ctx.find(/^still/i, 0.7);
      const pop = clamp((ctx.lt - still) / 0.35);
      st().bubble = { x: 0.5, y: 0.25, fx: 0.62, fy: 0.5, scale: eo(seg(ctx.lt, 0.05, 0.45)), pop: ctx.lt >= still ? pop : 0, hearts: true };
      if (ctx.lt >= still) {
        you.face({ eyes: 'wide', mouth: 'o', brows: 'worried' });
        stamp('DELAYED', 0.5, 0.28, D.byId[5].start + still, { rot: 0.18 });
        st().shakeAmt = Math.max(st().shakeAmt, 10 * Math.max(0, 1 - (ctx.lt - still) / 0.3));
      }
    },
    shots: [
      (ctx, su) => D.move(su, rp(0.6, 2.2, -1.0), rp(2.15, 0.7, -1.45), rp(0.8, 2.1, -1.1), rp(2.15, 0.7, -1.45), 50, 46),
      (ctx, su) => D.move(su, rp(1.2, 1.6, -1.4), rp(2.15, 0.75, -1.6), rp(1.3, 1.55, -1.45), rp(2.15, 0.75, -1.6), 46, 42),
    ],
  };

  // ================================================================ 6  mom peeks in
  S[6] = {
    cuts: ctx => [ctx.find(/^if/i, 0.55)],
    setup(ctx) {
      D.inRoom(); show(you, mom);
      youChair(); holdController(you);
      you.face({ eyes: 'wide', brows: 'neutral', mouth: 'flat' });
      Wd.roomDoor.rotation.y = -1.45 * sm(seg(ctx.lt, 0, 0.35));
      mom.at(R0.x + 3.25, R0.z + 2.35, -Math.PI / 2);
      mom.spine.rotation.set(0.15, 0, 0.12);
      mom.neck.rotation.set(0.05, 0, 0.25);
      reach(mom, 'R', rp(2.98, 1.25, 2.82), rotHint(mom, -1, -0.5, 0));
      mom.face({ eyes: 'normal', brows: 'worried', mouth: ctx.speaking() ? 'open' : 'frown', open: talk(ctx.lt, 8) * 0.4 });
    },
    shots: [
      (ctx, su) => D.move(su, rp(1.0, 1.65, 3.15), rp(3.05, 1.6, 2.35), rp(1.3, 1.65, 3.05), rp(3.05, 1.6, 2.35), 40, 38),
      (ctx, su) => D.move(su, rp(-1.2, 1.5, 0.6), rp(1.6, 1.2, 1.6), rp(-1.0, 1.5, 0.5), rp(1.6, 1.2, 1.6), 50, 48),
    ],
  };

  // ================================================================ 7  not okay (crazy eyes)
  S[7] = {
    setup(ctx) {
      D.inRoom(); show(you);
      youChair(); holdController(you);
      const j = Math.floor(ctx.t * 20);
      you.face({ eyes: 'crazy', crazy: hash(j) , look: [(hash(j + 3) - 0.5) * 1.5, (hash(j + 7) - 0.5) * 1.2], brows: 'neutral', mouth: 'wavy' });
      you.head.rotation.set((hash(j + 1) - 0.5) * 0.06, (hash(j + 2) - 0.5) * 0.08, (hash(j + 5) - 0.5) * 0.08);
      st().shakeAmt = 3;
      label('NOT OKAY', 0.27, 0.2, head(you).add(V(0.08, 0.03, -0.15)), { size: 54, gap: 90 });
    },
    shots: [faceShot(you, 0.85, 0.7, { dy: 0.04, ldy: 0.03 }, { dy: 0.04, ldy: 0.03 }, 36, 34, lin)],
  };

  // ================================================================ 8  the plan (slow zoom)
  S[8] = {
    setup(ctx) {
      D.inRoom(0x8a95b8); show(you);
      Wd.hemi.intensity = 0.8; Wd.sun.intensity = 1.0;
      youChair(); holdController(you);
      you.face({ eyes: 'squint', brows: 'angry', mouth: 'grin' });
      st().vignette = 0.55;
    },
    shots: [faceShot(you, 2.2, 0.95, { dy: 0.0 }, { dy: 0.02 }, 40, 36, lin)],
  };

  // ================================================================ 9  SOLD, SOLD
  S[9] = {
    cuts: ctx => [ctx.sc.words.findIndex((w, i) => i > 0 && /^you$/i.test(w.t)) > 0 ? ctx.sc.words.find((w, i) => i > 0 && /^you$/i.test(w.t)).s - 0.05 : ctx.dur / 2],
    setup(ctx) {
      D.inRoom(); show(you);
      const cut = ctx.sc.words.find((w, i) => i > 0 && /^you$/i.test(w.t));
      const second = ctx.lt >= (cut ? cut.s - 0.05 : ctx.dur / 2);
      you.at(R0.x - 1.2, R0.z + 0.8, -Math.PI / 2 - 0.3);
      you.face({ eyes: 'squint', brows: 'angry', mouth: 'grin' });
      const tb = D.abs(9, /^bike/i, 0.3) + 0.1, tp = D.abs(9, /^playstation/i, 0.8) + 0.1;
      if (!second) {
        label('BIKE', 0.3, 0.2, Wd.bike.getWorldPosition(V()).add(V(0, 0.7, 0)), { size: 64 });
        if (ctx.t >= tb) stamp('SOLD', 0.58, 0.42, tb, { rot: -0.15, size: 150 });
      } else {
        label('PLAYSTATION', 0.5, 0.2, Wd.ps.getWorldPosition(V()).add(V(0, 0.12, 0)), { size: 60 });
        if (ctx.t >= tp) stamp('SOLD', 0.5, 0.45, tp, { rot: 0.12, size: 150 });
      }
    },
    shots: [
      (ctx, su) => D.move(su, rp(-2.6, 1.4, 0.3), rp(-4.4, 0.6, 0.3), rp(-2.75, 1.35, 0.3), rp(-4.4, 0.6, 0.3), 46, 40, eo),
      (ctx, su) => D.move(su, rp(0.75, 0.95, -1.7), rp(0.55, 0.6, -2.65), rp(0.7, 0.9, -1.95), rp(0.55, 0.6, -2.65), 44, 40, eo),
    ],
  };

  // ================================================================ 10  one plane ticket
  S[10] = {
    setup(ctx) {
      D.inRoom(); show(you);
      you.at(R0.x, R0.z + 0.6, 0);
      you.face({ eyes: 'wide', brows: 'raised', mouth: 'grin' });
      const a = 0;
      const h = head(you);
      const tk = h.clone().addScaledVector(facing(a), 0.45).add(V(0.0, -0.18, 0));
      reach(you, 'R', tk.clone().add(V(-0.12, -0.04, -0.02)), rotHint(you, -1, -0.6, 0));
      reach(you, 'L', tk.clone().add(V(0.12, -0.04, -0.02)), rotHint(you, 1, -0.6, 0));
      const lift = eo(seg(ctx.lt, 0, 0.3));
      fx.card(D.tex.ticket, tk.clone().add(V(0, -0.15 * (1 - lift), 0)), 0.42, 0.2, [0, 0, -0.06]);
      for (let k = 0; k < 6; k++) { const ph = (ctx.lt * 1.3 + k / 6) % 1, an = k * 1.05; fx.sparkle(tk.clone().add(V(Math.cos(an) * 0.3, Math.sin(an) * 0.17, 0.06)), 0.1 * Math.sin(Math.PI * ph)); }
      label('ONE WAY', 0.73, 0.22, tk.clone().add(V(0.1, 0.06, 0)), { size: 52 });
    },
    shots: [
      (ctx, su) => { const tk = head(you).add(V(0, -0.18, 0.45)); D.move(su, tk.clone().add(V(0.05, 0.05, 0.7)), tk, tk.clone().add(V(0.03, 0.04, 0.5)), tk, 40, 36, eo); },
      faceShot(you, 1.5, 1.2, { dy: -0.1, ldy: -0.12 }, { dy: -0.1, ldy: -0.12 }, 40, 38),
    ],
  };

  // ================================================================ 11  fly (WHOOSH + face on the window)
  const planeWin = 7;
  S[11] = {
    cuts: ctx => [ctx.find(/^rockstar/i, 0.5) - 0.1],
    setup(ctx) {
      bg(Wd.skyBg); Wd.sunAt(SK, 14, [6, 14, 10]);
      const cut = ctx.find(/^rockstar/i, 0.5) - 0.1;
      const flying = ctx.lt < cut;
      Wd.plane.position.set(flying ? lerp(-26, 22, lin(ctx.lt / Math.max(0.5, cut))) : 0, flying ? 2 * Math.sin(ctx.lt * 2) : 0, 0);
      Wd.plane.rotation.set(0, 0, flying ? 0.06 : 0);
      if (flying) { st().whoosh = { dir: 1, y: 0.5 }; st().speed = 0.35; }
      else {
        // YOU inside, face squished against window `planeWin`
        show(you);
        Wd.plane.updateMatrixWorld(true);
        const wp = Wd.plane.localToWorld(Wd.planeWindowPos(planeWin).multiplyScalar(0.97));
        you.at(wp.x, wp.z - 0.17, 0, wp.y - 1.8);
        you.spine.rotation.x = 0.1;
        you.neck.rotation.x = -0.05;
        you.head.scale.set(1.12, 1.0, 0.78);
        you.leg.L.hp.visible = you.leg.R.hp.visible = false;
        reach(you, 'L', wp.clone().add(V(0.2, 0.0, -0.05)), rotHint(you, 1, -0.4, 0));
        reach(you, 'R', wp.clone().add(V(-0.2, 0.0, -0.05)), rotHint(you, -1, -0.4, 0));
        you.face({ eyes: 'wide', brows: 'raised', mouth: 'grin' });
        st().vignette = 0.25;
      }
    },
    shots: [
      (ctx, su) => { const x = Wd.plane.position.x; const c = SK.clone(); D.move(su, c.clone().add(V(x - 6, 1.2, 15)), c.clone().add(V(x, 0.3, 0)), c.clone().add(V(x - 5, 1.2, 14)), c.clone().add(V(x, 0.3, 0)), 48, 46); },
      (ctx, su) => { Wd.plane.updateMatrixWorld(true); const wp = Wd.plane.localToWorld(Wd.planeWindowPos(planeWin)); D.move(su, wp.clone().add(V(0.4, 0.15, 2.6)), wp.clone().add(V(0, -0.05, 0)), wp.clone().add(V(0.25, 0.1, 1.9)), wp.clone().add(V(0, -0.03, 0)), 40, 38, eo); },
    ],
  };
  const atPlaza = (bgc = 0xbfe7ff) => { bg(bgc); Wd.sunAt(PL.clone().add(V(0, 0, -2)), 16, [8, 16, 12]); };
  const atLobby = () => { bg(0xcfeeff); Wd.sunAt(LB, 10, [4, 12, 8]); };

  // ================================================================ 12  CLOTHES: 0
  S[12] = {
    cuts: ctx => [ctx.find(/^pack/i, 0.4), ctx.find(/^like/i, 0.65)],
    setup(ctx) {
      atPlaza(); show(you);
      you.at(PL.x, PL.z + 0.6, 0);
      const a = 0;
      // hands on hips, proud
      for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; reach(you, s, you.root.position.clone().add(V(sx * 0.27, 0.98, 0.02)), rotHint(you, sx * 1, 0.1, -0.3)); }
      you.spine.rotation.x = -0.08; you.neck.rotation.x = -0.12;
      you.face({ eyes: 'normal', brows: 'raised', mouth: 'grin' });
      const tl = ctx.find(/^like/i, 0.65);
      label('CLOTHES: 0', 0.28, 0.2, you.root.position.clone().add(V(-0.12, 1.3, 0.1)), { size: 64, t0: D.byId[12].start + 0.15 });
      if (ctx.lt >= tl) label('BAGS: 0', 0.74, 0.3, you.root.position.clone().add(V(0.32, 0.95, 0.05)), { size: 60, t0: D.byId[12].start + tl });
    },
    shots: [
      (ctx, su) => D.move(su, pp(0.4, 1.3, 4.8), pp(0, 1.15, 0.6), pp(0.35, 1.3, 4.3), pp(0, 1.15, 0.6), 44, 42),
      (ctx, su) => D.move(su, pp(-3.5, 1.2, 9.0), pp(0, 4.0, -3.0), pp(-3.0, 1.2, 8.5), pp(0, 4.0, -3.0), 54, 52),
      (ctx, su) => D.move(su, pp(0.2, 1.5, 4.0), pp(0, 1.4, 0.6), pp(0.1, 1.55, 2.6), pp(0, 1.55, 0.6), 42, 40, eo),
    ],
  };

  // ================================================================ 13  walks in
  S[13] = {
    setup(ctx) {
      atLobby(); show(you, w1, w2, w3, w4, recep);
      lobbyCrowd(ctx, false);
      const open = sm(seg(ctx.lt, 0, 0.35));
      Wd.lobbyDoors.forEach((d, i) => { d.position.x = (i ? 1 : -1) * (0.6 + 1.15 * open); });
      const z = lerp(8.2, 3.9, seg(ctx.lt, 0.05, ctx.dur + 0.3));
      you.at(LB.x, LB.z + z, Math.PI);
      P.walk(you, ctx.lt * 7.5, 0.9, { swagger: 1 });
      you.face({ eyes: 'normal', brows: 'raised', mouth: 'grin' });
    },
    shots: [(ctx, su) => D.move(su, lp(0.6, 1.3, 0.4), lp(0, 1.25, 5.5), lp(0.5, 1.3, 0.8), lp(0, 1.25, 5.0), 46, 44)],
  };

  // the lobby workers
  const lobbyCrowd = (ctx, frozen, react = 0) => {
    const tt = frozen ? D.abs(14, /^stops/i, 0.5) : ctx.t;
    const ws = [[w1, -3.0, 1.2, 0.9], [w2, 3.2, 2.0, -0.9], [w3, -2.4, -0.6, 0.6], [w4, 2.6, -0.4, -0.7]];
    ws.forEach(([p, x, z, ry], i) => {
      const walk = i % 2 === 0;
      p.at(LB.x + x + (walk && !frozen ? 0.25 * Math.sin(ctx.t * 0.8 + i) : 0), LB.z + z, ry);
      if (walk) P.walk(p, tt * 5 + i, frozen ? 0.9 : 0.7);
      const prop = i % 2 === 0 ? props.laptops[i / 2] : props.cups[(i - 1) / 2];
      prop.visible = true;
      const a = ry, c = chest(p, 0.3).add(V(0, -0.15, 0));
      if (i % 2 === 0) {
        reach(p, 'L', c.clone().addScaledVector(leftOf(a), 0.15), rotHint(p, 1, -0.6, 0));
        reach(p, 'R', c.clone().addScaledVector(leftOf(a), -0.15), rotHint(p, -1, -0.6, 0));
        prop.position.copy(c).addScaledVector(facing(a), 0.08).add(V(0, 0.02, 0)); prop.rotation.set(0, a, 0);
      } else {
        const cp = head(p).addScaledVector(facing(a), 0.22).add(V(0, frozen ? -0.08 : -0.25, 0)).addScaledVector(leftOf(a), -0.12);
        reach(p, 'R', cp.clone().add(V(0, -0.06, 0)), rotHint(p, -1, -0.6, 0));
        prop.position.copy(cp); prop.rotation.set(0, 0, frozen ? 0.4 : 0);
      }
      p.face(frozen ? { eyes: 'wide', brows: 'raised', mouth: 'o', open: 0.8 } : { eyes: 'normal', mouth: 'smile' });
      if (frozen) p.neck.rotation.y = Math.atan2(LB.x - p.root.position.x, LB.z + 4.0 - p.root.position.z) - ry;
    });
    recep.at(LB.x, LB.z - 2.95, 0);
  };

  // ================================================================ 14  everyone stops
  S[14] = {
    cuts: ctx => [ctx.find(/^stops/i, 0.5) - 0.05],
    setup(ctx) {
      atLobby(); show(you, w1, w2, w3, w4, recep);
      const stop = ctx.find(/^stops/i, 0.5) - 0.05;
      lobbyCrowd(ctx, true);
      you.at(LB.x, LB.z + 3.9, Math.PI);
      you.face({ eyes: 'normal', brows: 'raised', mouth: 'grin' });
      recep.face({ eyes: 'wide', mouth: 'o', brows: 'raised' });
      reach(recep, 'R', head(recep).add(V(0.12, -0.28, 0.25)), rotHint(recep, -1, -0.6, 0));
      props.cup.visible = true; props.cup.position.copy(recep.handWorld('R')).add(V(0, 0.05, 0.03));
      if (ctx.lt > stop) st().sat = 1;
    },
    shots: [
      (ctx, su) => D.move(su, lp(0, 2.6, -4.6), lp(0, 1.0, 2.5), lp(0, 2.5, -4.2), lp(0, 1.0, 2.5), 50, 48),
      faceShot(w2, 1.25, 1.0, { ang: -0.6 }, { ang: -0.55 }, 38, 36, eo),
      faceShot(w1, 1.25, 1.0, { ang: 0.5 }, { ang: 0.45 }, 38, 36, eo),
    ],
  };

  // ================================================================ 15  coffee drop (slow-mo)
  S[15] = {
    cuts: ctx => [ctx.find(/^drops/i, 0.45), D.splashT() - 0.08],
    setup(ctx) {
      atLobby(); show(you, recep, w1, w3);
      lobbyCrowd(ctx, true);
      w2.root.visible = w4.root.visible = false; props.cups[0].visible = false; props.laptops[1].visible = false;
      you.at(LB.x, LB.z + 2.6, Math.PI);
      recep.at(LB.x, LB.z - 2.95, 0);
      recep.face({ eyes: 'wide', brows: 'raised', mouth: 'o', open: 0.9 });
      const drop = ctx.find(/^drops/i, 0.45), hit = D.splashT();
      const hand0 = head(recep).add(V(0.12, -0.28, 0.25));
      reach(recep, 'R', hand0, rotHint(recep, -1, -0.6, 0));
      if (ctx.lt > drop) recep.arm.R.fingers.forEach(f => { f.rotation.z = 0.6; });
      const cup = props.cup; cup.visible = true;
      const start = recep.handWorld('R').add(V(0, 0.05, 0.03));
      const floorY = 0.07;
      if (ctx.lt < drop) { cup.position.copy(start); cup.rotation.set(0, 0, 0); }
      else {
        const u = clamp((ctx.lt - drop) / Math.max(0.2, hit - drop));
        cup.position.set(start.x, lerp(start.y, floorY, u * u), start.z + 0.15 * u);
        cup.rotation.set(u * 2.2, 0, u * 1.4);
        // coffee leaving the cup
        for (let k = 0; k < 6; k++) fx.coffee(cup.position.clone().add(V((hash(k) - 0.5) * 0.15, 0.08 + k * 0.03 * u, 0.05)), 0.05, { opacity: u > 0.1 ? 1 : 0 });
      }
      if (ctx.lt >= hit) {
        cup.position.y = floorY; cup.rotation.set(Math.PI / 2, 0, 0.4);
        const a = ctx.lt - hit;
        for (let k = 0; k < 18; k++) {
          const an = hash(k) * Math.PI * 2, v = 0.6 + hash(k + 9) * 1.2;
          const p = V(start.x + Math.cos(an) * v * a, floorY + Math.max(0, 2.2 * a - 6 * a * a) * (0.5 + hash(k + 3)), start.z + 0.15 + Math.sin(an) * v * a);
          fx.coffee(p, 0.06 + 0.04 * hash(k + 5), { opacity: Math.max(0, 1 - a / 0.9) });
        }
        const pud = fx.card(puddleTex(), V(start.x, 0.012, start.z + 0.15), 0.6 * eo(a / 0.3) + 0.01, 0.45 * eo(a / 0.3) + 0.01, [-Math.PI / 2, 0, 0]);
      }
    },
    shots: [
      faceShot(recep, 1.5, 1.25, { dy: -0.1, ldy: -0.12 }, { dy: -0.1, ldy: -0.12 }, 40, 38),
      (ctx, su) => { const c = props.cup.position.clone(); D.setCam(c.clone().add(V(0.55, 0.2, -0.75)), c, 40); },
      (ctx, su) => D.move(su, lp(0.9, 0.7, -3.9), lp(0, 0.05, -2.6), lp(0.8, 0.6, -3.7), lp(0, 0.05, -2.6), 46, 42, eo),
    ],
  };

  // ================================================================ 16  "Hi. I'm here to play GTA 6."
  const youAtDesk = (ctx) => {
    you.at(LB.x, LB.z - 1.3, Math.PI);
    recep.at(LB.x, LB.z - 2.95, 0);
  };
  S[16] = {
    cuts: ctx => [ctx.find(/^i'm/i, 0.3), ctx.find(/^gta/i, 0.7)],
    setup(ctx) {
      atLobby(); show(you, recep, w1, w3);
      lobbyCrowd(ctx, true); w2.root.visible = w4.root.visible = false; props.cups[0].visible = false; props.laptops[1].visible = false;
      youAtDesk(ctx);
      const up = eo(seg(ctx.lt, ctx.find(/^i'm/i, 0.3) - 0.2, ctx.find(/^i'm/i, 0.3) + 0.2));
      const h = head(you), a = Math.PI;
      reach(you, 'R', vl(you.handWorld('R'), h.clone().addScaledVector(facing(a), 0.3).addScaledVector(leftOf(a), -0.25).add(V(0, 0.1, 0)), up), rotHint(you, -1, -0.5, 0));
      holdController(you, 'up');
      you.face({ eyes: 'happy', brows: 'raised', mouth: ctx.speaking() ? 'open' : 'grin', open: talk(ctx.lt) * 0.7 });
      recep.face({ eyes: 'wide', brows: 'raised', mouth: 'flat' });
      label('CONTROLLER', 0.72, 0.2, props.controller.position.clone(), { size: 50, t0: D.byId[16].start + ctx.find(/^i'm/i, 0.3) });
    },
    shots: [
      (ctx, su) => D.move(su, lp(0.35, 1.75, -3.6), lp(0, 1.6, -1.3), lp(0.3, 1.72, -3.3), lp(0, 1.62, -1.3), 44, 40),
      faceShot(you, 1.3, 1.05, { ang: 0.2 }, { ang: 0.15 }, 38, 36),
      (ctx, su) => D.move(su, lp(3.2, 1.5, -1.6), lp(0, 1.15, -1.8), lp(2.9, 1.5, -1.6), lp(0, 1.15, -1.8), 48, 46),
    ],
  };

  // ================================================================ 17  "Sir... where are your clothes?"
  S[17] = {
    cuts: ctx => [ctx.find(/^where/i, 0.4)],
    setup(ctx) {
      atLobby(); show(you, recep);
      youAtDesk(ctx);
      const h = head(recep), a = 0;
      const cover = eo(seg(ctx.lt, 0.05, 0.35));
      for (const s of ['L', 'R']) {
        const sx = s === 'L' ? 1 : -1;
        const eye = h.clone().addScaledVector(facing(a), 0.2).addScaledVector(leftOf(a), sx * 0.07).add(V(0, -0.06, 0));
        reach(recep, s, vl(recep.handWorld(s), eye, cover), rotHint(recep, sx, -0.7, 0));
        if (cover > 0.5) handDir(recep, s, V(0, 1, 0).addScaledVector(leftOf(a), -sx * 0.4), facing(a).negate());
      }
      recep.neck.rotation.set(0.1, 0.25, 0);
      recep.face({ eyes: 'closed', brows: 'worried', mouth: ctx.speaking() ? 'open' : 'wavy', open: talk(ctx.lt, 9) * 0.4 });
      you.face({ eyes: 'normal', brows: 'raised', mouth: 'smile', look: [0, -1] });
      you.neck.rotation.x = 0.4;
      holdController(you, 'lap');
    },
    shots: [
      faceShot(recep, 1.5, 1.25, { ang: 0.25, dy: -0.05 }, { ang: 0.2, dy: -0.05 }, 40, 38),
      (ctx, su) => D.move(su, lp(-2.6, 1.6, 0.2), lp(0, 1.1, -1.3), lp(-2.4, 1.6, 0.0), lp(0, 1.1, -1.3), 46, 44),
    ],
  };

  // ================================================================ 18  thumbs up
  S[18] = {
    setup(ctx) {
      atLobby(); show(you, recep);
      youAtDesk(ctx);
      const a = Math.PI, h = head(you);
      const up = eo(seg(ctx.lt, 0, 0.25));
      reach(you, 'R', vl(you.handWorld('R'), h.clone().addScaledVector(facing(a), 0.35).addScaledVector(leftOf(a), -0.18).add(V(0, -0.15, 0)), up), rotHint(you, -1, -0.4, 0));
      if (up > 0.5) {
        handDir(you, 'R', facing(a), leftOf(a));
        you.arm.R.fingers.forEach(f => { f.rotation.z = -1.5; });
        you.arm.R.thumb.rotation.set(-2.9, 0, 0);
      }
      you.face({ eyes: 'happy', brows: 'raised', mouth: ctx.speaking() ? 'open' : 'grin', open: talk(ctx.lt) * 0.6 });
      recep.face({ eyes: 'squint', brows: 'angry', mouth: 'flat' });
      for (let k = 0; k < 3; k++) { const ph = (ctx.lt * 1.4 + k / 3) % 1; fx.sparkle(h.clone().add(V(-0.25 + k * 0.25, 0.32 + ph * 0.1, -0.1)), 0.1 * Math.sin(Math.PI * ph)); }
    },
    shots: [
      faceShot(you, 1.55, 1.3, { ang: -0.2, dy: -0.1, ldy: -0.1 }, { ang: -0.15, dy: -0.1, ldy: -0.1 }, 40, 38),
      (ctx, su) => D.move(su, lp(0.5, 1.6, -3.4), lp(0, 1.55, -1.3), lp(0.45, 1.6, -3.1), lp(0, 1.55, -1.3), 42, 40),
    ],
  };

  // ================================================================ 19  no / beg / no
  S[19] = {
    cuts: ctx => [ctx.find(/^beg/i, 0.4) - 0.3, ctx.sc.words.find((w, i) => i > 3 && /^they/i.test(w.t))?.s - 0.05],
    setup(ctx) {
      atLobby(); show(you, recep, w1, w3);
      recep.at(LB.x, LB.z - 2.95, 0);
      w1.at(LB.x - 1.4, LB.z - 2.6, 0.2); w3.at(LB.x + 1.4, LB.z - 2.6, -0.2);
      for (const p of [recep, w1, w3]) {
        p.neck.rotation.y = 0.45 * Math.sin(ctx.t * 13);
        p.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
        for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; p.arm[s].sh.rotation.set(-0.5, 0, sx * -0.6); p.arm[s].el.rotation.x = -1.5; }
      }
      const beg = ctx.find(/^beg/i, 0.4) - 0.3;
      you.at(LB.x, LB.z - 1.0, Math.PI);
      if (ctx.lt >= beg) {
        P.kneel(you);
        const a = Math.PI, c = chest(you, 0.3).add(V(0, 0.08, 0));
        reach(you, 'L', c.clone().addScaledVector(leftOf(a), 0.035), rotHint(you, 1, -0.7, 0));
        reach(you, 'R', c.clone().addScaledVector(leftOf(a), -0.035), rotHint(you, -1, -0.7, 0));
        handDir(you, 'L', V(0, 1, 0), leftOf(a).negate()); handDir(you, 'R', V(0, 1, 0), leftOf(a));
        you.neck.rotation.x = -0.35;
        you.face({ eyes: 'wide', brows: 'worried', mouth: 'open', open: 0.6, tears: 0.8 });
        fx.drop(head(you).add(V(0.22, 0.08, -0.05)), 0.09);
      } else { you.face({ eyes: 'normal', brows: 'raised', mouth: 'grin' }); holdController(you, 'lap'); }
    },
    shots: [
      (ctx, su) => D.move(su, lp(0.0, 1.7, 0.9), lp(0, 1.55, -2.8), lp(0.0, 1.7, 0.6), lp(0, 1.55, -2.8), 50, 46),
      faceShot(you, 1.5, 1.2, { dy: 0.25, ldy: -0.05 }, { dy: 0.22, ldy: -0.05 }, 42, 40),
      (ctx, su) => D.move(su, lp(-1.8, 1.7, 0.6), lp(0.3, 1.6, -2.7), lp(-1.6, 1.7, 0.4), lp(0.3, 1.6, -2.7), 48, 46),
    ],
  };

  // ================================================================ 20  walk outside
  const topY = 1.1;
  S[20] = {
    setup(ctx) {
      atPlaza(); show(you);
      const open = sm(seg(ctx.lt, 0, 0.4));
      Wd.plazaDoors.forEach((d, i) => { d.position.x = (i ? 1 : -1) * (0.6 + 1.1 * open); });
      const z = lerp(-6.6, -5.25, seg(ctx.lt, 0.1, ctx.dur - 0.2));
      you.at(PL.x, PL.z + z, 0, topY);
      if (ctx.lt < ctx.dur - 0.2) P.walk(you, ctx.lt * 7, 0.85, { swagger: 1 });
      you.face({ eyes: 'normal', brows: 'raised', mouth: 'smile' });
    },
    shots: [
      (ctx, su) => D.move(su, pp(1.2, 1.2, 1.5), pp(0, 2.2, -5.8), pp(1.0, 1.25, 0.8), pp(0, 2.2, -5.8), 48, 46),
      (ctx, su) => D.move(su, pp(-2.2, 2.5, -2.8), pp(0, 2.1, -5.4), pp(-2.0, 2.45, -3.0), pp(0, 2.1, -5.4), 46, 44),
    ],
  };

  // ================================================================ 21  beautiful steps
  S[21] = {
    cuts: ctx => [ctx.find(/^beautiful/i, 0.5)],
    setup(ctx) {
      atPlaza(); show(you);
      you.at(PL.x, PL.z - 5.25, 0, topY);
      you.neck.rotation.x = 0.45;
      for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; reach(you, s, chest(you, 0.28).addScaledVector(leftOf(0), sx * 0.04), rotHint(you, sx, -0.6, 0)); }
      you.face({ eyes: 'happy', brows: 'raised', mouth: 'smile', look: [0, -1] });
      for (let k = 0; k < 14; k++) {
        const ph = (ctx.lt * 1.1 + hash(k)) % 1;
        const step = k % 6;
        fx.sparkle(pp(-5 + hash(k + 4) * 10, topY - step * (topY / 6) + 0.02, -5.5 + step * 0.6 + 0.3), 0.18 * Math.sin(Math.PI * ph));
      }
      label('SHINY', 0.3, 0.24, pp(-0.8, 0.6, -3.6), { size: 64, t0: D.byId[21].start + ctx.find(/^beautiful/i, 0.5) });
    },
    shots: [
      (ctx, su) => D.move(su, pp(-6, 0.7, -1.2), pp(-3, 0.4, -4.2), pp(4, 0.7, -1.2), pp(5, 0.4, -4.2), 44, 44, lin),
      (ctx, su) => D.move(su, pp(0.6, 0.6, -2.0), pp(0, 1.9, -5.25), pp(0.4, 0.65, -2.3), pp(0, 1.95, -5.25), 48, 46),
    ],
  };

  // ================================================================ 22  squat, PLOP!
  S[22] = {
    cuts: ctx => [ctx.find(/^right/i, 0.6) - 0.03],
    setup(ctx) {
      atPlaza(); show(you);
      const sq = eo(seg(ctx.lt, ctx.find(/^poop/i, 0.3) - 0.25, ctx.find(/^poop/i, 0.3) + 0.1));
      you.at(PL.x, PL.z - 5.0, 0, topY);
      P.squat(you, sq);
      for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; you.arm[s].sh.rotation.set(-1.2 * sq, 0, sx * 0.3); you.arm[s].el.rotation.x = -0.4; }
      you.face({ eyes: sq > 0.5 ? 'squint' : 'normal', brows: 'angry', mouth: sq > 0.5 ? 'wavy' : 'grin' });
      const tr = ctx.find(/^right/i, 0.6) - 0.03;
      if (ctx.lt >= tr) {
        const a = ctx.lt - tr;
        fx.stinkLines(pp(0, topY + 0.2, -4.7), ctx.t, { n: 6, spread: 1.1, height: 3.2, size: 1.0, seed: 7 });
        st().shakeAmt = Math.max(st().shakeAmt, 12 * Math.max(0, 1 - a / 0.35));
      }
    },
    shots: [
      (ctx, su) => D.move(su, pp(2.6, 1.6, -2.6), pp(0, 1.45, -5.0), pp(2.3, 1.6, -2.9), pp(0, 1.4, -5.0), 46, 44),
      (ctx, su) => D.move(su, pp(0, 3.0, -0.2), pp(0, 4.4, -6.0), pp(0, 3.1, -0.9), pp(0, 4.45, -6.0), 46, 42, eo),
    ],
  };

  // faces in windows
  const facesOn = (ctx, press = 0, faint = null) => {
    Wd.faces.forEach((f, i) => {
      f.visible = true;
      const b = f.userData.base;
      const pr = press * (0.7 + 0.3 * hash(i));
      f.position.set(b.x, b.y, b.z + 0.36 * pr);
      f.userData.head.scale.set(1 + 0.15 * pr, 1, 1 - 0.35 * pr);
      f.userData.hands.forEach(h => { h.visible = pr > 0.5; });
      f.userData.mouth.scale.set(1 + 0.6 * pr, 1, 1 + 0.6 * pr);
      f.rotation.set(0, 0, 0);
    });
    if (faint) {
      const f = faint.face, u = faint.u;
      f.rotation.x = -1.4 * ei(u);
      f.position.y -= 0.6 * ei(u);
      f.position.z -= 0.5 * ei(u);
      f.userData.eyes.forEach(e => { e.scale.y = u > 0.2 ? 0.15 : 1; });
    } else Wd.faces.forEach(f => f.userData.eyes.forEach(e => { e.scale.y = 1; }));
  };
  const faceAt = (fl, col) => Wd.faces.find(f => f.userData.floor === fl && f.userData.col === col);

  // ================================================================ 23  whole building watching
  S[23] = {
    setup(ctx) {
      atPlaza(); show(you);
      you.at(PL.x, PL.z - 5.0, 0, topY); P.squat(you, 1);
      you.face({ eyes: 'squint', brows: 'angry', mouth: 'wavy' });
      facesOn(ctx, 0);
      fx.stinkLines(pp(0, topY + 0.2, -4.7), ctx.t, { n: 6, spread: 1.1, height: 3.2, size: 1.0, seed: 7 });
      label('EVERYONE', 0.7, 0.14, pp(3, 14, -6.1), { size: 56 });
    },
    shots: [
      (ctx, su) => D.move(su, pp(0, 3.0, 26), pp(0, 13, -6), pp(0, 3.5, 22), pp(0, 13.5, -6), 56, 56, lin),
      (ctx, su) => D.move(su, pp(-6, 1.5, 12), pp(1, 9, -6), pp(-5, 1.5, 11), pp(1, 9.5, -6), 52, 52),
    ],
  };

  // ================================================================ 24  faces squished on the glass
  S[24] = {
    setup(ctx) {
      atPlaza(); facesOn(ctx, eo(seg(ctx.lt, 0.1, 0.7)));
    },
    shots: [
      (ctx, su) => D.move(su, pp(-1.0, 8.6, -2.6), pp(-1, 8.5, -6.1), pp(-1.0, 8.6, -3.3), pp(-1, 8.5, -6.1), 44, 40),
      (ctx, su) => D.move(su, pp(3.0, 11.6, -3.0), pp(3, 11.5, -6.1), pp(3.0, 11.6, -3.6), pp(3, 11.5, -6.1), 42, 40),
    ],
  };

  // ================================================================ 25  one faints
  S[25] = {
    setup(ctx) {
      atPlaza();
      const ft = D.faintT();
      const f = faceAt(2, 4) || Wd.faces[20];
      facesOn(ctx, 1, ctx.lt > ft ? { face: f, u: clamp((ctx.lt - ft) / 0.4) } : null);
      if (ctx.lt > ft + 0.35) st().shakeAmt = Math.max(st().shakeAmt, 10 * Math.max(0, 1 - (ctx.lt - ft - 0.35) / 0.3));
    },
    shots: [
      (ctx, su) => { const f = faceAt(2, 4) || Wd.faces[20]; const b = f.userData.base.clone().add(PL); b.z = PL.z - 6.1; D.move(su, b.clone().add(V(0.4, 0.1, 3.2)), b.clone().add(V(0, -0.1, 0)), b.clone().add(V(0.3, 0.1, 2.6)), b.clone().add(V(0, -0.15, 0)), 44, 42); },
    ],
  };

  // ================================================================ 26-28  security
  const carry = (ctx, kick = 0, yell = 0) => {
    atPlaza(); show(you, guard1, guard2);
    const x = lerp(-1.5, 4.5, seg(ctx.t, D.byId[26].start, D.byId[28].end));
    const a = Math.PI / 2;
    you.at(PL.x + x, PL.z + 0.5, a, 0.28);
    guard1.at(PL.x + x, PL.z + 1.05, a); guard2.at(PL.x + x, PL.z - 0.05, a);
    P.walk(guard1, ctx.t * 6, 0.8, { arms: false }); P.walk(guard2, ctx.t * 6 + Math.PI, 0.8, { arms: false });
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      you.arm[s].sh.rotation.set(-0.2, 0, sx * 1.15);
      you.arm[s].el.rotation.x = -0.2;
    }
    // guards grab YOU's upper arms
    const upL = you.arm.L.el.getWorldPosition(V()), upR = you.arm.R.el.getWorldPosition(V());
    you.root.updateMatrixWorld(true);
    const gL = you.arm.L.el.getWorldPosition(V()), gR = you.arm.R.el.getWorldPosition(V());
    const nearL = gL.distanceTo(guard1.root.position) < gR.distanceTo(guard1.root.position) ? gL : gR;
    const farL = nearL === gL ? gR : gL;
    reach(guard1, 'R', nearL.clone().add(V(0, 0.02, 0)), rotHint(guard1, -1, -0.5, 0));
    reach(guard1, 'L', nearL.clone().add(V(-0.12, -0.12, 0)), rotHint(guard1, 1, -0.5, 0));
    reach(guard2, 'L', farL.clone().add(V(0, 0.02, 0)), rotHint(guard2, 1, -0.5, 0));
    reach(guard2, 'R', farL.clone().add(V(-0.12, -0.12, 0)), rotHint(guard2, -1, -0.5, 0));
    guard1.face({ eyes: 'normal', brows: 'angry', mouth: 'flat' }); guard2.face({ eyes: 'normal', brows: 'angry', mouth: 'flat' });
    guard1.neck.rotation.y = -0.4; guard2.neck.rotation.y = 0.4;
    // legs: dragging, or kicking
    const k1 = Math.sin(ctx.t * 16), k2 = Math.sin(ctx.t * 16 + 2.2);
    you.leg.L.hp.rotation.x = lerp(0.35, -0.9 * k1, kick);
    you.leg.R.hp.rotation.x = lerp(0.45, -0.9 * k2, kick);
    you.leg.L.kn.rotation.x = lerp(0.6, 0.8 + 0.7 * k2, kick);
    you.leg.R.kn.rotation.x = lerp(0.6, 0.8 + 0.7 * k1, kick);
    you.face(yell ? { eyes: 'crazy', crazy: hash(Math.floor(ctx.t * 20)), brows: 'angry', mouth: 'open', open: 0.9 } : { eyes: 'wide', brows: 'worried', mouth: 'open', open: talk(ctx.t, 12) * 0.8 });
    you.neck.rotation.set(-0.2, 0.3 * Math.sin(ctx.t * 9) * kick, 0);
  };
  S[26] = {
    setup(ctx) { carry(ctx, 0); label('SECURITY', 0.7, 0.14, head(guard1).add(V(0, 0.25, 0)), { size: 56 }); },
    shots: [
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(4.6, 1.5, 1.3)), p.clone().add(V(0, 1.25, 0.1)), p.clone().add(V(4.2, 1.5, 1.2)), p.clone().add(V(0, 1.25, 0.1)), 50, 48); },
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(3.0, 0.8, -1.6)), p.clone().add(V(0, 1.3, 0.2)), p.clone().add(V(2.8, 0.8, -1.4)), p.clone().add(V(0, 1.3, 0.2)), 46, 44); },
    ],
  };
  S[27] = {
    setup(ctx) { carry(ctx, 1); },
    shots: [
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(3.4, 0.9, 0.6)), p.clone().add(V(0, 0.9, 0.05)), p.clone().add(V(3.0, 0.95, 0.55)), p.clone().add(V(0, 0.95, 0.05)), 50, 48); },
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(4.5, 2.2, 2.4)), p.clone().add(V(0, 1.1, 0.1)), p.clone().add(V(4.2, 2.1, 2.2)), p.clone().add(V(0, 1.1, 0.1)), 48, 46); },
    ],
  };
  S[28] = {
    setup(ctx) { carry(ctx, 1, 1); st().shakeAmt = Math.max(st().shakeAmt, 11); st().speed = 0.5; },
    shots: [
      (ctx, su) => { const [a, b] = faceCam(you, 1.25, { ang: 0.0, dy: 0.05 }); const [c, d] = faceCam(you, 0.95, { ang: 0.0, dy: 0.05 }); D.move(su, a, b, c, d, 40, 36, lin); },
      (ctx, su) => { const p = you.root.position; D.move(su, p.clone().add(V(3.6, 1.6, 0.5)), p.clone().add(V(0, 1.5, 0.05)), p.clone().add(V(3.0, 1.6, 0.4)), p.clone().add(V(0, 1.5, 0.05)), 46, 44, eo); },
    ],
  };

  // ================================================================ 29  breaking news
  S[29] = {
    cuts: ctx => [ctx.find(/^breaking/i, 0.45)],
    setup(ctx) {
      bg(0x0f2a6b); Wd.sunAt(ST, 8, [3, 8, 6]); show(reporter);
      reporter.at(ST.x, ST.z - 0.3, 0);
      const a = 0, mp = head(reporter).addScaledVector(facing(a), 0.22).add(V(0.05, -0.18, 0));
      reach(reporter, 'R', mp.clone().add(V(-0.02, -0.1, 0)), rotHint(reporter, -1, -0.6, 0));
      props.mic.visible = true; props.mic.position.copy(mp); props.mic.rotation.set(0.4, 0, 0);
      reporter.face({ eyes: 'normal', brows: 'raised', mouth: ctx.speaking() ? 'open' : 'smile', open: talk(ctx.lt, 9) * 0.5 });
      const tb = ctx.find(/^breaking/i, 0.45);
      if (ctx.lt < tb) label('NEXT DAY', 0.5, 0.14, null, { size: 70, color: '#ffffff', t0: D.byId[29].start });
      else st().banner = { t: ctx.lt - tb, text: 'BREAKING NEWS', sub: 'GTA 6 DELAYED AGAIN' };
    },
    shots: [
      (ctx, su) => D.move(su, sp(0, 1.55, 3.6), sp(0, 1.45, -0.3), sp(0, 1.55, 3.2), sp(0, 1.45, -0.3), 40, 38),
      faceShot(reporter, 1.7, 1.4, { dy: -0.05, ldy: -0.18 }, { dy: -0.05, ldy: -0.18 }, 40, 38),
    ],
  };

  // ================================================================ 30  DELAYED again
  S[30] = {
    setup(ctx) {
      atLobby();
      const td = ctx.find(/^delayed/i, 0.5);
      if (ctx.lt >= td) { stamp('DELAYED', 0.5, 0.42, D.byId[30].start + td, { rot: -0.22, size: 140 }); st().shakeAmt = Math.max(st().shakeAmt, 12 * Math.max(0, 1 - (ctx.lt - td) / 0.3)); }
      if (ctx.lt >= td + 0.6) stamp('AGAIN', 0.55, 0.56, D.byId[30].start + td + 0.6, { rot: 0.12, size: 110 });
    },
    shots: [
      (ctx, su) => { const p = Wd.lobbyPoster6; D.move(su, p.clone().add(V(0, 0, 3.0)), p, p.clone().add(V(0, 0, 2.5)), p, 46, 44); },
      (ctx, su) => { const p = Wd.lobbyPoster6; D.move(su, p.clone().add(V(0.6, -0.3, 2.3)), p.clone().add(V(0, -0.1, 0)), p.clone().add(V(0.5, -0.3, 2.0)), p.clone().add(V(0, -0.1, 0)), 44, 42, eo); },
    ],
  };

  // ================================================================ 31  the smell
  const smellView = { pos: pp(0, 6, 34), look: pp(0, 15, -6), fov: 55 };
  const smellCloud = (t) => {
    fx.cloud(pp(0, 26, -9), 11, t, { n: 34, size: 3.2, opacity: 0.85, rise: 8, seed: 31 });
    fx.cloud(pp(0, 10, -4), 9, t, { n: 18, size: 2.2, opacity: 0.55, rise: 10, seed: 32 });
    fx.stinkLines(pp(0, 30, -6), t, { n: 7, spread: 8, height: 8, size: 4.5, seed: 33 });
  };
  S[31] = {
    cuts: ctx => [ctx.sc.words.find((w, i) => i > 1 && /^the$/i.test(w.t))?.s - 0.05],
    setup(ctx) {
      const cut = ctx.sc.words.find((w, i) => i > 1 && /^the$/i.test(w.t));
      const home = ctx.lt >= (cut ? cut.s - 0.05 : ctx.dur * 0.5);
      smellCloud(ctx.t);
      // workers in gas masks on the plaza
      [w1, w2, w3, w4].forEach((p, i) => {
        p.root.visible = true; p.at(PL.x - 2.4 + i * 1.6, PL.z + 1.5 - (i % 2) * 0.6, (i - 1.5) * 0.15);
        p.gasMask.visible = true;
        p.face({ eyes: 'wide', mouth: 'flat' });
        p.neck.rotation.x = -0.25;
        p.arm.L.sh.rotation.set(-0.3, 0, 0.3 + 0.15 * Math.sin(ctx.t * 8 + i)); p.arm.R.sh.rotation.set(-0.3, 0, -0.3 - 0.15 * Math.sin(ctx.t * 8 + i));
      });
      if (!home) {
        atPlaza(0xcfe8c0);
        label('GAS MASKS', 0.3, 0.38, head(w2).add(V(0, 0.1, 0.2)), { size: 58 });
      } else {
        D.inRoom(); show(you);
        youChair();
        you.face({ eyes: 'wide', brows: 'raised', mouth: 'o', open: 1.0 });
        you.spine.rotation.x = 0.15;
        for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.1, 0, (s === 'L' ? 1 : -1) * 0.25); }
        st().tvView = smellView;
      }
    },
    shots: [
      (ctx, su) => D.move(su, pp(1.0, 1.6, 7.5), pp(0, 7.5, -6), pp(1.2, 1.7, 8.3), pp(0, 8.0, -6), 62, 62, lin),
      (ctx, su) => D.move(su, rp(1.45, 1.4, -1.55), rp(-0.15, 1.3, -0.75), rp(1.5, 1.42, -1.65), rp(-0.15, 1.3, -0.75), 48, 50, lin),
    ],
  };

  return S;
}

let _pud = null;
function puddleTex() {
  if (_pud) return _pud;
  const [c, g] = makeCanvas(256, 192);
  g.fillStyle = '#6b3d1a';
  g.beginPath();
  for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2, r = 0.8 + 0.2 * Math.sin(k * 2.7); const x = 128 + Math.cos(a) * 110 * r, y = 96 + Math.sin(a) * 80 * r; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(100, 75, 30, 14, -0.3, 0, 7); g.fill();
  _pud = toTex(c);
  return _pud;
}

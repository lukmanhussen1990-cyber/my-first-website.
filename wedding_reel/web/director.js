// Scene direction for "MOM, I'M DONE". Every frame is a pure function of t;
// cuts and actions are anchored to the voiceover's word timings.
import * as THREE from 'three';
import { P, talk, reach, handDir } from './lib/chars.js';
import { SET, pewZ } from './lib/sets.js';

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
const BA = SET.bath, HA = SET.hall, PK = SET.park, KD = SET.kids;
const bp = (x, y, z) => V(BA.x + x, BA.y + y, BA.z + z);
const hp = (x, y, z) => V(HA.x + x, HA.y + y, HA.z + z);
const pk = (x, y, z) => V(PK.x + x, PK.y + y, PK.z + z);
const kd = (x, y, z) => V(KD.x + x, KD.y + y, KD.z + z);
const ALT = 0.44;

export class Director {
  constructor({ camera, world, cast, fx, timeline, scene }) {
    Object.assign(this, { camera, world, cast, fx, tl: timeline, scene });
    this.scenes = timeline.scenes.map((sc, i) => ({ ...sc, words: timeline.words.filter(w => w.line === i).map(w => ({ t: w.t, s: w.s - sc.start, e: w.e - sc.start })) }));
    this.byId = {}; this.scenes.forEach(s => { this.byId[s.id] = s; });
    // guests whose seats belong to the bride's family
    world.guests.forEach(g => { if (g.row === 1 && g.side === 1 && g.root.position.x < 5.2) g.hidden = true; });
    this.defs = makeScenes(this);
    this.events = this.buildEvents();
  }
  wt(id, re, frac = 0.5) { const s = this.byId[id]; if (!s) return 0; const w = s.words.find(w => re.test(w.t)); return w ? w.s : s.dur * frac; }
  abs(id, re, frac) { return this.byId[id].start + this.wt(id, re, frac); }
  ctxFor(t) {
    let k = this.scenes.findIndex(s => t >= s.start && t < s.end);
    if (k < 0) k = t < 0 ? 0 : this.scenes.length - 1;
    const sc = this.scenes[k], lt = t - sc.start;
    return { t, lt, sc, id: sc.id, dur: sc.dur, u: clamp(lt / sc.dur), find: (re, f = 0.5) => this.wt(sc.id, re, f), speaking: () => sc.words.some(w => lt >= w.s - 0.02 && lt <= w.e + 0.02) };
  }
  schedule(def, ctx) {
    const dur = ctx.dur;
    let cuts = def.cuts ? def.cuts(ctx).filter(c => c != null && c > 0.3 && c < dur - 0.3) : null;
    if (!cuts) { const n = Math.max(1, Math.min(def.shots.length, Math.round(dur / 1.2))); cuts = []; for (let i = 1; i < n; i++) cuts.push(dur * i / n); }
    const b = [0, ...cuts.sort((a, c) => a - c), dur], segs = [];
    for (let i = 0; i < b.length - 1; i++) { const len = b[i + 1] - b[i], parts = len > 1.6 ? Math.ceil(len / 1.3) : 1; for (let p = 0; p < parts; p++) segs.push([b[i] + len * p / parts, b[i] + len * (p + 1) / parts]); }
    for (let i = 0, j = 0; i < segs.length; i++) segs[i][2] = segs[i][2] ?? 0;
    let base = 0, part = 0; const tagged = [];
    for (let i = 0; i < b.length - 1; i++) { const len = b[i + 1] - b[i], parts = len > 1.6 ? Math.ceil(len / 1.3) : 1; for (let p = 0; p < parts; p++) tagged.push([i, p]); }
    let idx = segs.findIndex(s => ctx.lt >= s[0] && ctx.lt < s[1]); if (idx < 0) idx = segs.length - 1;
    const [a, c] = segs[idx];
    let shot = idx % def.shots.length;
    if (def.groups) { const [bi, pi] = tagged[idx]; const grp = def.groups[Math.min(bi, def.groups.length - 1)]; shot = grp[pi % grp.length]; }
    return { shot, seg: idx, su: clamp((ctx.lt - a) / (c - a)), slt: ctx.lt - a, sdur: c - a };
  }
  setCam(pos, look, fov = 40, roll = 0) { const c = this.camera; c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(look); if (roll) c.rotateZ(roll); c.fov = fov; c.updateProjectionMatrix(); }
  move(su, p1, l1, p2, l2, f1 = 40, f2 = f1, ease = sm, roll = 0) { const u = ease(su); this.setCam(vl(p1, p2, u), vl(l1, l2, u), lerp(f1, f2, u), roll); }

  update(t) {
    this.fx.begin();
    this.state = { shake: [0, 0], shakeAmt: 0, flash: 0, fade: 0, vignette: 0.45, speed: 0, sat: 1, sepia: 0, blue: 0, arcs: null, rings: null, confetti: 0, streaks: null, flashWhite: 0 };
    const ctx = this.ctxFor(t);
    this.curId = ctx.id;
    const def = this.defs[ctx.id];
    ctx.shot = this.schedule(def, ctx);
    this.baseline(ctx);
    def.setup(ctx);
    def.shots[ctx.shot.shot](ctx, ctx.shot.su, ctx.shot);
    if (this.forceCam) this.setCam(V(...this.forceCam.pos), V(...this.forceCam.look), this.forceCam.fov);
    this.camera.updateMatrixWorld(true);
    this.fx.cullNear(this.camera.position);
    const cap = this.tl.captions.find(c => t >= c.s && t < c.hide);
    if (cap && cap.loud) this.state.shakeAmt = Math.max(this.state.shakeAmt, 10 * (0.5 + 0.5 * Math.max(0, 1 - (t - cap.s) / 0.4)));
    const a = this.state.shakeAmt;
    if (a > 0) this.state.shake = [a * (hash(Math.floor(t * 30)) - 0.5) * 2, a * (hash(Math.floor(t * 30) + 77) - 0.5) * 2];
    const end = this.tl.duration;
    this.state.fade = Math.max(this.state.fade, seg(t, end - 0.9, end - 0.03));
    return this.state;
  }

  // ------------------------------------------------------------ default positions (the church at rest)
  baseline(ctx) {
    const c = this.cast, Wd = this.world, t = ctx.t;
    c.all.forEach(p => { p.reset(); p.root.visible = false; });
    for (const k of ['phone', 'bible', 'bouquet', 'basket']) c.props[k].visible = false;
    c.props.rolls.forEach(r => { r.visible = false; });
    Wd.guests.forEach((g, i) => {
      g.root.visible = !g.hidden;
      g.neck.rotation.set(0.04 * Math.sin(t * 0.7 + g.phase), 0.08 * Math.sin(t * 0.4 + g.phase), 0);
      g.arms.forEach(a => { a.a.rotation.set(-0.35, 0, 0); a.fo.rotation.set(-0.9, 0, 0); });
      g.eyes.forEach(e => e.scale.set(1, 1, 1)); g.mouth.scale.set(1, 1, 1);
    });
    Wd.chandelier.rotation.set(0, 0, 0);
    Wd.chLight.intensity = 18;
    Wd.sideDoor.rotation.y = 0;
    Wd.stallDoor.rotation.y = 0;
    Wd.wcDoor.rotation.y = 0;
    this.scene.background.setHex(0x2a1d14);
    Wd.hemi.color.setHex(0xffe9cc); Wd.hemi.intensity = 0.85; Wd.sun.color.setHex(0xffdcae); Wd.sun.intensity = 1.5;
    Wd.sunAt(V(0, 0, -10), 16, [6, 14, 4]);
  }
  // seat / stand the church cast in their default places
  churchCast(t, { you = this.curId < 9, bride = true } = {}) {
    const c = this.cast;
    const { priest, fil, grandpa, girl, organist, family } = c;
    priest.root.visible = true; priest.at(0, -19.35, 0, ALT);
    this.bibleAt(priest, 1);
    priest.face({ eyes: 'normal', mouth: 'flat', look: [0, -0.6] }); priest.neck.rotation.x = 0.25;
    if (bride) { const b = c.bride; b.root.visible = true; b.at(0.8, -18.0, -Math.PI / 2, ALT); b.face({ eyes: 'happy', mouth: 'grin', brows: 'raised' }); this.bouquetAt(b); }
    if (you) { const y = c.you; y.root.visible = true; y.at(-0.8, -18.0, Math.PI / 2, ALT); y.face({ eyes: 'normal', mouth: 'flat' }); }
    girl.root.visible = true; girl.at(1.7, -16.3, 0.4); this.basketAt(girl, 1);
    girl.face({ eyes: 'happy', mouth: 'smile' });
    grandpa.root.visible = true; grandpa.at(-3.05, pewZ(0) + 0.05, Math.PI); P.sit(grandpa, 0.5); grandpa.face({ eyes: 'normal', mouth: 'flat' });
    fil.root.visible = true; fil.at(1.75, pewZ(0) + 0.05, Math.PI); P.sit(fil, 0.5); fil.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
    const seats = [[3.05, 0], [4.35, 0], [5.65, 0], [1.75, 1], [3.05, 1], [4.35, 1]];
    family.forEach((p, i) => { p.root.visible = true; p.at(seats[i][0], pewZ(seats[i][1]) + 0.05, Math.PI); P.sit(p, 0.5); p.face({ eyes: 'normal', mouth: 'smile' }); });
    organist.root.visible = true; const os = this.world.organSeat; organist.at(os.x, os.z, -Math.PI / 2); P.sit(organist, 0.52);
    for (const s of ['L', 'R']) { reach(organist, s, V(-6.25, 1.08, -16.5 + (s === 'L' ? -0.25 : 0.25)), V(0, -1, s === 'L' ? -0.5 : 0.5)); handDir(organist, s, V(-1, -0.3, 0), V(0, -1, 0)); }
    organist.face({ eyes: 'normal', mouth: 'flat', look: [0, -0.5] });
  }
  bibleAt(p, open) {
    const b = this.cast.props.bible; b.visible = true;
    const a = p.root.rotation.y;
    p.root.updateMatrixWorld(true);
    const c = p.spine.localToWorld(V(0, 0.32, 0.36));
    reach(p, 'L', c.clone().addScaledVector(leftOf(a), 0.12).add(V(0, -0.03, 0)), V(Math.cos(a), -0.8, 0));
    reach(p, 'R', c.clone().addScaledVector(leftOf(a), -0.12).add(V(0, -0.03, 0)), V(-Math.cos(a), -0.8, 0));
    b.position.copy(c); b.rotation.set(-0.5, a, 0, 'YXZ');
    const ang = (1 - open) * 1.5;
    b.userData.L.rotation.z = -ang; b.userData.R.rotation.z = ang;
  }
  bouquetAt(p) {
    const q = this.cast.props.bouquet; q.visible = true;
    const a = p.root.rotation.y;
    p.root.updateMatrixWorld(true);
    const c = p.spine.localToWorld(V(0, 0.08, 0.3));
    reach(p, 'L', c.clone().addScaledVector(leftOf(a), 0.05), V(Math.cos(a), -0.6, 0));
    reach(p, 'R', c.clone().addScaledVector(leftOf(a), -0.05), V(-Math.cos(a), -0.6, 0));
    q.position.copy(c).add(V(0, 0.02, 0));
  }
  basketAt(p, tilt) {
    const b = this.cast.props.basket; b.visible = true;
    const a = p.root.rotation.y;
    p.root.updateMatrixWorld(true);
    const c = p.spine.localToWorld(V(0.05, 0.15, 0.32));
    reach(p, 'R', c.clone().add(V(0, 0.08, 0)), V(-Math.cos(a), -0.6, 0));
    b.position.copy(c); b.rotation.set(0, a, (1 - tilt) * 1.6);
    b.scale.setScalar(1.0);
  }

  buildEvents() {
    const ev = [], has = id => !!this.byId[id];
    const add = (t, type, word, o = {}) => ev.push({ t: Math.max(0, t), type, word, ...o });
    if (has(4)) add(this.byId[4].start + 0.05, 'organ', null, { dur: 2.2, gain: 0.45 });
    if (has(8)) add(this.abs(8, /^your/i, 0.5), 'rumble', { text: 'RUMBLE', x: 0.5, y: 0.3, rot: -0.1, color: '#9cff57', wobble: true, size: 56, dur: 1.2 }, { dur: 1.3, gain: 0.8 });
    if (has(13)) add(this.byId[13].start - 0.12, 'scratch', null, { gain: 0.7 });
    if (has(19)) { const c0 = this.abs(19, /^cracks/i, 0.5); [0, 0.22, 0.48].forEach((d, i) => add(c0 + d, 'crack', i === 0 ? { text: 'CRACK!', x: 0.7, y: 0.25, rot: 0.15, color: '#ffd93b', size: 60, dur: 0.9 } : null, { gain: 0.8 })); }
    if (has(34)) add(this.byId[34].start + 0.05, 'sadorgan', null, { dur: this.tl.duration - this.byId[34].start, gain: 0.45 });
    return ev;
  }
  sfxWords(t) {
    const end = tt => { const s = this.scenes.find(x => tt >= x.start && tt < x.end); return s ? s.end : 1e9; };
    return this.events.filter(e => e.word && t >= e.t && t < Math.min(e.t + (e.word.dur || 0.85), end(e.t))).map(e => ({ ...e.word, t: e.t, dur: Math.min(e.word.dur || 0.85, end(e.t) - e.t) }));
  }
}

// ======================================================================
function makeScenes(D) {
  const { you, bride, mom, priest, fil, grandpa, girl, organist, family, kids, props } = D.cast;
  const Wd = D.world, fx = D.fx, S = {};
  const st = () => D.state;
  const head = p => p.headWorld();
  const rotHint = (p, x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.root.rotation.y);
  const faceCam = (p, dist, { ang = 0, dy = 0, ldy = 0, side = 0 } = {}) => {
    const h = head(p), a = p.root.rotation.y + ang;
    dist *= 1.5;
    return [h.clone().addScaledVector(facing(a), dist).add(V(0, dy, 0)).addScaledVector(leftOf(a), side), h.clone().add(V(0, ldy, 0))];
  };
  const faceShot = (p, d1, d2, o1 = {}, o2 = o1, f1 = 38, f2 = f1, ease = sm) => (ctx, su) => { const [a, b] = faceCam(p, d1, o1), [c, d] = faceCam(p, d2, o2); D.move(su, a, b, c, d, f1, f2, ease); };
  const bathLight = () => { D.scene.background.setHex(0xe8eef0); Wd.sunAt(BA, 5, [2, 8, 4]); };

  // YOU on the toilet (stall door may be open)
  const onToilet = () => { you.root.visible = true; you.at(BA.x + 1.4, BA.z - 1.38, 0); P.sit(you, 0.47); for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.35, 0, (s === 'L' ? 1 : -1) * 0.1); you.arm[s].el.rotation.set(-1.0, 0, 0); } };
  const breathe = (amt, puff) => {
    you.spine.scale.set(1 + 0.16 * amt, 1 + 0.04 * amt, 1 + 0.22 * amt);
    you.neck.rotation.x = -0.25 * amt;
    you.head.scale.set(1 + 0.1 * puff, 1, 1 + 0.06 * puff);
    for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.2 - 0.3 * amt, 0, (s === 'L' ? 1 : -1) * (0.3 + 0.5 * amt)); you.arm[s].el.rotation.set(-0.6, 0, 0); }
    you.face({ eyes: amt > 0.5 ? 'squint' : 'normal', brows: 'angry', mouth: puff > 0.3 ? 'o' : 'flat', open: 0.2 + 0.4 * (1 - puff) });
  };
  const yell = (ctx, big) => {
    const k = big ? 1.4 : 1;
    you.spine.scale.set(1.05, 1, 1.05);
    you.spine.rotation.x = 0.15;
    you.neck.rotation.x = -0.35 - 0.05 * Math.sin(ctx.t * 40);
    you.head.scale.setScalar(1 + 0.04 * Math.sin(ctx.t * 50));
    for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.4, 0, (s === 'L' ? 1 : -1) * 1.0 * k); you.arm[s].el.rotation.set(-1.4, 0, 0); }
    you.face({ eyes: 'closed', brows: 'angry', mouth: 'open', open: 1.0 * k });
    st().arcs = { world: head(you).add(V(0, 0.02, 0)), strength: big ? 1.3 : 1, r: big ? 170 : 140 };
    st().shakeAmt = Math.max(st().shakeAmt, big ? 22 : 13);
  };
  const stallOutside = (ctx) => {
    bathLight(); onToilet();
    fx.stinkLines(bp(1.4, 2.0, -0.6), ctx.t, { n: 4, spread: 0.5, height: 0.9, size: 0.5, seed: 3 });
  };

  // ================================================================ 1-2
  S[1] = {
    setup(ctx) { D.churchCast(ctx.t); you.face({ eyes: 'normal', mouth: 'flat', blink: Math.sin(ctx.t * 3) > 0.97 ? 1 : 0 }); },
    shots: [faceShot(you, 1.35, 1.05, { ang: 0.15 }, { ang: 0.1 }, 38, 36, lin), faceShot(you, 1.6, 1.3, { ang: -0.35, dy: -0.15, ldy: -0.2 }, { ang: -0.3, dy: -0.15, ldy: -0.2 }, 40, 38)],
  };
  S[2] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      const tw = Math.sin(ctx.t * 34) > 0.55 ? 1 : 0;
      you.face({ eyes: 'nervous', twitch: tw, mouth: 'wavy', brows: 'worried' });
      you.head.rotation.z = 0.04 * tw;
      const h = head(you);
      fx.icon('swirl', h.clone().add(V(0, 0.42, 0)), 0.32, { rot: -ctx.t * 6 });
      fx.drop(h.clone().add(V(0.05, 0.12, 0.26)), 0.1);
    },
    shots: [faceShot(you, 1.25, 1.0, { ang: 0.1, dy: 0.05 }, { ang: 0.1, dy: 0.05 }, 38, 36), faceShot(you, 0.95, 0.85, { ang: -0.2, dy: 0.03 }, { ang: -0.2, dy: 0.03 }, 36, 34)],
  };

  // ================================================================ 3  flashback on the toilet with the phone
  S[3] = {
    cuts: ctx => [ctx.find(/^call/i, 0.35), ctx.find(/^wipe/i, 0.7)],
    groups: [[0], [1], [2]],
    setup(ctx) {
      bathLight(); onToilet();
      st().sepia = 0.75; st().vignette = 0.7; st().flashWhite = 0.35;
      Wd.stallDoor.rotation.y = -1.6;
      const a = 0, h = head(you);
      const ph = h.clone().addScaledVector(facing(a), 0.32).add(V(0.02, -0.12, 0));
      reach(you, 'R', ph.clone().add(V(-0.02, -0.08, -0.02)), rotHint(you, -1, -0.6, 0));
      handDir(you, 'R', V(0, 1, 0), facing(a).negate());
      props.phone.visible = true; props.phone.position.copy(ph); props.phone.lookAt(h);
      you.face({ eyes: 'normal', brows: 'raised', mouth: ctx.speaking() ? 'smile' : 'smile' });
      you.neck.rotation.x = 0.2;
      for (let k = 0; k < 3; k++) { const p = (ctx.lt * 1.3 + k / 3) % 1; fx.heart(ph.clone().add(V(0.1 + 0.05 * k, 0.1 + p * 0.25, 0.05)), 0.07, { opacity: Math.sin(Math.PI * p) }); }
    },
    shots: [
      (ctx, su) => D.move(su, bp(1.55, 1.25, 0.9), bp(1.4, 0.95, -1.35), bp(1.5, 1.25, 0.7), bp(1.4, 0.98, -1.35), 46, 44),
      (ctx, su) => { const p = props.phone.position.clone(); const n = V().subVectors(head(you), p).normalize(); D.move(su, p.clone().addScaledVector(n, 0.24).add(V(0.02, 0.02, 0)), p, p.clone().addScaledVector(n, 0.19), p, 40, 38); },
      faceShot(you, 1.2, 0.95, { ang: 0.25 }, { ang: 0.2 }, 38, 36),
    ],
  };

  // ================================================================ 4-7  the wedding
  S[4] = {
    setup(ctx) { D.churchCast(ctx.t); },
    shots: [(ctx, su) => D.move(su, V(0, 6.2, 11.2), V(0, 1.8, -16), V(0, 5.2, 8.5), V(0, 1.6, -16), 52, 48, lin)],
  };
  S[5] = {
    cuts: ctx => [ctx.find(/^two/i, 0.5)],
    setup(ctx) { D.churchCast(ctx.t); },
    shots: [
      (ctx, su) => D.move(su, V(-7.2, 1.75, pewZ(3) - 1.3), V(-5.2, 1.25, pewZ(3) + 0.3), V(-1.4, 1.75, pewZ(3) - 1.3), V(0.6, 1.25, pewZ(3) + 0.3), 50, 50, lin),
      (ctx, su) => D.move(su, V(7.2, 1.75, pewZ(8) - 1.3), V(5.2, 1.25, pewZ(8) + 0.3), V(1.4, 1.75, pewZ(8) - 1.3), V(-0.6, 1.25, pewZ(8) + 0.3), 50, 50, lin),
      (ctx, su) => D.move(su, V(-6.8, 3.6, -14.8), V(-3, 0.9, 4), V(6.8, 3.6, -14.8), V(3, 0.9, 4), 54, 54, lin),
    ],
  };
  S[6] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      bride.veil.rotation.set(0.12 + 0.05 * Math.sin(ctx.t * 1.5), 0, 0.03 * Math.sin(ctx.t));
      bride.neck.rotation.set(-0.05, -0.2, 0.08 * Math.sin(ctx.t * 0.8));
      const h = head(bride);
      for (let k = 0; k < 7; k++) { const p = (ctx.lt * 0.6 + k / 7) % 1, a = k * 0.9; fx.sparkle(h.clone().add(V(Math.cos(a) * 0.45, -0.2 + p * 0.7, Math.sin(a) * 0.45)), 0.1 * Math.sin(Math.PI * p)); }
      st().flashWhite = 0.2; st().vignette = 0.6;
    },
    shots: [faceShot(bride, 1.45, 1.15, { ang: 0.3, dy: -0.05 }, { ang: 0.25, dy: -0.05 }, 38, 36, lin), faceShot(bride, 2.4, 2.1, { ang: -0.35, dy: -0.4, ldy: -0.45 }, { ang: -0.3, dy: -0.4, ldy: -0.45 }, 42, 40, lin)],
  };
  S[7] = {
    setup(ctx) { D.churchCast(ctx.t); D.bibleAt(priest, eo(seg(ctx.lt, 0.25, ctx.dur - 0.4))); priest.face({ eyes: 'normal', brows: 'raised', mouth: 'smile', look: [0, -0.7] }); },
    shots: [
      (ctx, su) => { const b = props.bible.position.clone(); D.move(su, b.clone().add(V(0.15, 0.6, 0.75)), b, b.clone().add(V(0.1, 0.5, 0.6)), b, 42, 40); },
      faceShot(priest, 1.5, 1.25, { dy: -0.1, ldy: -0.2 }, { dy: -0.1, ldy: -0.2 }, 40, 38),
    ],
  };

  // ================================================================ 8-9  stomach, run
  S[8] = {
    cuts: ctx => [ctx.find(/^your/i, 0.5)],
    setup(ctx) {
      D.churchCast(ctx.t);
      const rum = ctx.lt >= ctx.find(/^your/i, 0.5) ? 1 : 0;
      you.face({ eyes: rum ? 'wide' : 'nervous', brows: 'worried', mouth: 'wavy', twitch: Math.sin(ctx.t * 30) > 0.7 ? 1 : 0 });
      const h = head(you);
      fx.drop(h.clone().add(V(-0.05, 0.12 - 0.08 * ((ctx.lt * 0.8) % 1), 0.26)), 0.1);
      if (rum) {
        const j = Math.sin(ctx.t * 45);
        you.spine.scale.set(1 + 0.06 * j, 1, 1 + 0.08 * Math.abs(j));
        st().arcs = { world: you.spine.localToWorld(V(0, 0.15, 0.2)), strength: 0.8, r: 90 };
        st().shakeAmt = 3;
      }
    },
    shots: [
      faceShot(you, 1.3, 1.05, { ang: 0.2 }, { ang: 0.15 }, 38, 36),
      (ctx, su) => { const b = you.spine.localToWorld(V(0, 0.15, 0.13)); D.move(su, b.clone().add(V(0.9, 0.1, 0.05)), b, b.clone().add(V(0.7, 0.08, 0.05)), b, 40, 38); },
    ],
  };
  S[9] = {
    setup(ctx) {
      D.churchCast(ctx.t, { you: false });
      you.root.visible = true;
      const u = seg(ctx.lt, 0, ctx.dur + 0.2);
      const a = V(-0.8, 0, -18.0), m = V(4.5, 0, -16.2), b = V(8.6, 0, -14.6);
      const p = u < 0.55 ? vl(a, m, u / 0.55) : vl(m, b, (u - 0.55) / 0.45);
      const dir = Math.atan2(b.x - a.x, b.z - a.z);
      you.at(p.x, p.z, dir, u < 0.2 ? ALT * (1 - u / 0.2) : 0);
      P.run(you, ctx.lt * 15, 1);
      you.face({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
      Wd.sideDoor.rotation.y = -1.4 * eo(seg(ctx.lt, 0.4, 0.8));
      [bride, priest, girl].forEach(q => { q.neck.rotation.y = 0.6; });
      bride.face({ eyes: 'wide', mouth: 'o' });
      st().streaks = { dir: 1 };
    },
    shots: [(ctx, su) => { const p = you.root.position; D.setCam(p.clone().add(V(-2.4, 1.5, 2.6)), p.clone().add(V(0.4, 1.0, 0)), 50); }],
  };

  // ================================================================ 10-12  the stall and the first yell
  const stallDoorShot = (ctx, su) => D.move(su, bp(1.0, 1.1, 2.45), bp(1.4, 1.35, 0.3), bp(1.1, 1.05, 2.2), bp(1.4, 1.3, 0.3), 54, 52);
  S[10] = {
    setup(ctx) { stallOutside(ctx); you.face({ eyes: 'squint', brows: 'angry', mouth: 'wavy' }); },
    shots: [stallDoorShot],
  };
  const inStall = (d1, d2, o = {}) => (ctx, su) => { Wd.stallDoor.rotation.y = -1.6; const h = head(you); const k = 1.45; D.move(su, h.clone().add(V((o.x ?? 0.15), (o.y ?? 0.05), Math.min(1.55, d1 * k))), h.clone().add(V(0, (o.ly ?? -0.1), 0)), h.clone().add(V((o.x ?? 0.15) * 0.8, (o.y ?? 0.05), Math.min(1.5, d2 * k))), h.clone().add(V(0, (o.ly ?? -0.1), 0)), 50, 46); };
  S[11] = {
    setup(ctx) { bathLight(); onToilet(); const b = sm(seg(ctx.lt, ctx.find(/^yell/i, 0.6) - 0.6, ctx.dur)); breathe(b, b); },
    shots: [inStall(1.25, 1.0, { ly: -0.15 }), inStall(0.95, 0.8)],
  };
  S[12] = {
    cuts: ctx => [ctx.find(/^i'm/i, 0.5) - 0.03],
    setup(ctx) {
      const cut = ctx.find(/^i'm/i, 0.5) - 0.03;
      if (ctx.lt < cut) { bathLight(); onToilet(); yell(ctx, false); }
      else {
        D.churchCast(ctx.t, { you: false });
        const a = ctx.lt - cut;
        Wd.chandelier.rotation.set(0.04 * Math.sin(a * 30), 0, 0.06 * Math.sin(a * 26));
        Wd.chLight.intensity = 18 + 8 * Math.sin(a * 40);
        st().rings = { world: V(0, 7.4, -5), strength: 1 };
        st().shakeAmt = Math.max(st().shakeAmt, 9);
      }
    },
    groups: [[0], [1, 2]],
    shots: [inStall(1.0, 0.75, { y: 0.0 }), (ctx, su) => D.move(su, V(0.6, 2.4, -1.4), V(0, 7.6, -5), V(0.4, 2.8, -2.0), V(0, 7.6, -5), 50, 46, eo), (ctx, su) => D.move(su, V(0, 5.2, 8.5), V(0, 4.2, -12), V(0, 5.0, 7.2), V(0, 4.2, -12), 54, 52, lin)],
  };

  // ================================================================ 13  Silence.
  S[13] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      [bride, priest, girl, fil, grandpa, ...family].forEach(p => { p.neck.rotation.y = 0; p.face({ eyes: 'wide', mouth: 'flat', brows: 'raised' }); });
      Wd.guests.forEach(g => { g.neck.rotation.set(0, 0, 0); g.eyes.forEach(e => e.scale.set(1.2, 1.4, 1)); });
      st().sat = 0.55; st().vignette = 0.7;
      fx.drop(head(bride).add(V(-0.06, 0.12, 0.22)), 0.1);
    },
    shots: [(ctx, su) => D.move(su, V(0, 4.0, -10.2), V(0, 1.2, -18.5), V(0, 3.6, -11.5), V(0, 1.2, -18.5), 54, 54, lin), faceShot(bride, 1.3, 1.15, { ang: 0.2 }, { ang: 0.2 }, 38, 37, lin)],
  };

  // ================================================================ 14-15  remember: mom is parking
  S[14] = {
    setup(ctx) { bathLight(); onToilet(); const w = eo(seg(ctx.lt, 0.15, 0.6)); you.face({ eyes: w > 0.5 ? 'wide' : 'normal', eyeScale: 1 + 0.25 * w, brows: 'raised', mouth: 'o', open: 0.3 }); fx.drop(head(you).add(V(0.22, 0.14 - 0.12 * w, 0.12)), 0.1); },
    shots: [inStall(0.85, 0.7)],
  };
  S[15] = {
    cuts: ctx => [ctx.find(/^parking/i, 0.5)],
    groups: [[0], [1, 2]],
    setup(ctx) {
      const cut = ctx.find(/^parking/i, 0.5);
      if (ctx.lt < cut) { D.churchCast(ctx.t); }
      else {
        D.scene.background.setHex(0x9fd8ff); Wd.sunAt(PK, 12, [6, 12, 8]);
        Wd.hemi.color.setHex(0xfff6e8); Wd.hemi.intensity = 1.2; Wd.sun.color.setHex(0xfff2dc); Wd.sun.intensity = 2.2;
        const a = ctx.lt - cut;
        const car = Wd.momCar, home = Wd.momCarHome;
        const jerk = Math.sin(a * 5.5);
        car.position.set(home.x - PK.x + 0.4 * Math.sin(a * 2.2), 0, home.z - PK.z + 0.7 * jerk);
        car.rotation.set(0, Math.PI + 0.35 * Math.sin(a * 2.2) + 0.15, 0.02 * Math.sin(a * 20));
        car.userData.wheels.forEach(w => { w.rotation.x = a * 10 * Math.sign(Math.cos(a * 5.5)); });
        Wd.momWheel.rotation.z = 2.5 * Math.sin(a * 4);
        mom.root.visible = true;
        car.updateMatrixWorld(true);
        const seat = car.localToWorld(V(-0.4, 0, -0.25));
        mom.at(seat.x, seat.z, car.rotation.y, 0.1);
        P.sit(mom, 0.55);
        mom.root.updateMatrixWorld(true);
        const wh = car.localToWorld(V(-0.4, 1.1, 0.33));
        reach(mom, 'L', wh.clone().add(V(Math.cos(a * 4) * 0.12, 0.05, 0)), rotHint(mom, 1, -0.6, -0.3));
        reach(mom, 'R', wh.clone().add(V(-Math.cos(a * 4) * 0.12, -0.05, 0)), rotHint(mom, -1, -0.6, -0.3));
        mom.face({ eyes: 'normal', brows: 'worried', mouth: 'wavy' });
        mom.neck.rotation.y = 0.5 * Math.sin(a * 3);
        fx.drop(head(mom).add(V(0.2, 0.14, 0)), 0.1);
      }
    },
    shots: [
      (ctx, su) => { const s = Wd.reservedSign.getWorldPosition(V()); D.move(su, s.clone().add(V(0.3, 0.45, 1.1)), s.clone().add(V(0, 0.05, 0)), s.clone().add(V(0.2, 0.35, 0.8)), s.clone().add(V(0, 0.05, 0)), 42, 38); },
      (ctx, su) => { const c = Wd.momCar.getWorldPosition(V()); D.move(su, c.clone().add(V(-4.2, 2.4, 4.5)), c.clone().add(V(0, 1.0, 0)), c.clone().add(V(-3.6, 2.2, 3.9)), c.clone().add(V(0, 1.0, 0)), 46, 44); },
      (ctx, su) => { const h = head(mom); const c = Wd.momCar; D.move(su, h.clone().add(facing(c.rotation.y).multiplyScalar(2.2)).add(V(0, 0.15, 0)), h, h.clone().add(facing(c.rotation.y).multiplyScalar(1.8)).add(V(0, 0.15, 0)), h, 42, 40); },
    ],
  };

  // ================================================================ 16-20  one reaction shot each
  S[16] = {
    setup(ctx) { D.churchCast(ctx.t); D.bibleAt(priest, 1 - sm(seg(ctx.lt, 0.2, ctx.dur - 0.2))); priest.face({ eyes: 'squint', brows: 'worried', mouth: 'frown', look: [0, -0.6] }); },
    shots: [faceShot(priest, 1.6, 1.3, { dy: -0.18, ldy: -0.25 }, { dy: -0.18, ldy: -0.25 }, 42, 40, lin), (ctx, su) => { const b = props.bible.position.clone(); D.move(su, b.clone().add(V(-0.1, 0.55, 0.65)), b, b.clone().add(V(-0.08, 0.45, 0.55)), b, 42, 40, lin); }],
  };
  S[17] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      const d = sm(seg(ctx.lt, 0.1, 0.8));
      Wd.guests.forEach(g => { g.neck.rotation.set(0.65 * d, 0, 0); g.eyes.forEach(e => e.scale.set(1, 1 - 0.6 * d, 1)); });
      family.forEach(p => { p.neck.rotation.x = 0.6 * d; p.face({ eyes: 'squint', mouth: 'flat' }); });
      fil.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
    },
    shots: [(ctx, su) => D.move(su, V(-4.2, 2.1, -15.2), V(-4.2, 0.9, -6), V(-4.2, 2.1, -14.6), V(-4.2, 0.9, -6), 46, 44), (ctx, su) => D.move(su, V(4.0, 1.25, pewZ(4) - 1.3), V(4.4, 1.15, pewZ(6)), V(4.0, 1.25, pewZ(4) - 1.0), V(4.4, 1.15, pewZ(6)), 46, 44)],
  };
  S[18] = {
    cuts: ctx => [ctx.find(/^drops/i, 0.5) - 0.05],
    setup(ctx) {
      D.churchCast(ctx.t);
      const drop = ctx.find(/^drops/i, 0.5) - 0.05;
      const tilt = ctx.lt > drop ? eo(seg(ctx.lt, drop, drop + 0.5)) : 0;
      D.basketAt(girl, 1 - tilt);
      girl.face({ eyes: 'wide', brows: 'worried', mouth: 'o', open: 0.5 });
      if (ctx.lt > drop) {
        const b = props.basket.position.clone();
        for (let k = 0; k < 16; k++) {
          const a = (ctx.lt - drop) * 0.45 - hash(k) * 0.25; if (a < 0) continue;
          const p = b.clone().add(V((hash(k + 3) - 0.5) * 0.5 + 0.1 * Math.sin(a * 6 + k), -a * 0.9, (hash(k + 7) - 0.5) * 0.4));
          if (p.y < 0.03) p.y = 0.03;
          fx.icon(k % 3 ? 'petal' : 'petal2', p, 0.07, { rot: a * 5 + k });
        }
      }
    },
    shots: [faceShot(girl, 1.0, 0.85, { ang: 0.1, dy: 0.0 }, { ang: 0.1 }, 40, 38), (ctx, su) => { const b = props.basket.position.clone(); D.move(su, b.clone().add(V(0.25, 0.1, 0.9)), b.clone().add(V(0, -0.25, 0)), b.clone().add(V(0.2, 0.05, 0.75)), b.clone().add(V(0, -0.3, 0)), 44, 42, lin); }],
  };
  S[19] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      fil.neck.rotation.x = -0.05;
      fil.root.updateMatrixWorld(true);
      const a = fil.root.rotation.y, c = fil.spine.localToWorld(V(0, 0.32, 0.38));
      reach(fil, 'L', c.clone().addScaledVector(leftOf(a), 0.05), rotHint(fil, 1, -0.6, 0));
      reach(fil, 'R', c.clone().addScaledVector(leftOf(a), -0.05), rotHint(fil, -1, -0.6, 0));
      handDir(fil, 'L', leftOf(a).negate().add(V(0, 0.3, 0)), facing(a).negate());
      handDir(fil, 'R', leftOf(a).add(V(0, 0.3, 0)), facing(a).negate());
      const c0 = D.wt(19, /^cracks/i, 0.5);
      const flex = [0, 0.22, 0.48].some(d => Math.abs(ctx.lt - c0 - d) < 0.06) ? 1 : 0;
      for (const s of ['L', 'R']) fil.arm[s].fingers.forEach(f => { f.rotation.z = fil.arm[s].sx * (0.9 + 0.7 * flex); });
      fil.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
      if (flex) st().shakeAmt = 5;
    },
    shots: [faceShot(fil, 1.7, 1.4, { dy: -0.1, ldy: -0.2 }, { dy: -0.1, ldy: -0.22 }, 40, 38), (ctx, su) => { const c = fil.spine.localToWorld(V(0, 0.32, 0.38)); D.move(su, c.clone().add(V(0.15, 0.25, -0.8)), c, c.clone().add(V(0.12, 0.2, -0.65)), c, 40, 38); }],
  };
  S[20] = {
    setup(ctx) {
      D.churchCast(ctx.t);
      grandpa.neck.rotation.set(0.35, 0, 0.25 + 0.03 * Math.sin(ctx.t * 2));
      grandpa.face({ eyes: 'closed', mouth: 'o', open: 0.25 + 0.15 * Math.sin(ctx.t * 3) });
      const h = head(grandpa);
      for (let k = 0; k < 3; k++) { const p = (ctx.lt * 0.7 + k / 3) % 1; fx.icon('z', h.clone().add(V(0.25 + p * 0.3, 0.25 + p * 0.5, -0.1)), 0.12 + p * 0.1, { opacity: Math.sin(Math.PI * p) }); }
      if (Math.sin(ctx.t * 9) > 0.92) grandpa.face({ eyes: 'normal', look: [0.8, 0], mouth: 'o', open: 0.2 });
    },
    shots: [faceShot(grandpa, 1.3, 1.1, { ang: 0.3, dy: 0.05 }, { ang: 0.25, dy: 0.05 }, 40, 38, lin), faceShot(grandpa, 2.2, 1.9, { ang: -0.4, dy: 0.3, ldy: -0.2 }, { ang: -0.35, dy: 0.3, ldy: -0.2 }, 44, 42)],
  };

  // ================================================================ 21-22  louder
  S[21] = {
    cuts: ctx => [ctx.find(/^louder/i, 0.6)],
    setup(ctx) { bathLight(); onToilet(); const l = ctx.find(/^louder/i, 0.6); const b = ctx.lt < l ? 0.6 * sm(seg(ctx.lt, 0.3, l)) : 0.6 + 0.6 * eo(seg(ctx.lt, l, ctx.dur)); breathe(Math.min(1.3, b), Math.min(1.3, b)); },
    shots: [inStall(1.3, 1.1, { ly: -0.2 }), inStall(0.8, 0.62)],
  };
  S[22] = {
    cuts: ctx => [ctx.find(/^i'm/i, 0.4) - 0.03, ctx.find(/^i'm/i, 0.4) + 0.9],
    groups: [[0], [1], [2]],
    setup(ctx) {
      const cut = ctx.find(/^i'm/i, 0.4) - 0.03;
      if (ctx.lt < cut) { bathLight(); onToilet(); yell(ctx, true); st().speed = 0.6; }
      else {
        D.churchCast(ctx.t, { you: false });
        const a = ctx.lt - cut;
        Wd.chandelier.rotation.set(0.12 * Math.sin(a * 5), 0, 0.42 * Math.sin(a * 4.2) * Math.min(1, a * 3));
        Wd.chLight.intensity = 18 + 10 * Math.sin(a * 37);
        st().rings = { world: V(0, 7.4, -5), strength: 1.3 };
        st().shakeAmt = Math.max(st().shakeAmt, 16);
        [bride, priest, girl, fil, grandpa, ...family].forEach(p => p.face({ eyes: 'squint', mouth: 'wavy', brows: 'worried' }));
        Wd.guests.forEach(g => { g.arms.forEach((ar, i) => { ar.a.rotation.set(-2.6, 0, (i ? -1 : 1) * 0.3); ar.fo.rotation.set(-1.6, 0, 0); }); });
      }
    },
    shots: [
      inStall(0.9, 0.62, { y: 0.0 }),
      (ctx, su) => D.move(su, V(0.8, 2.2, -1.0), V(0, 7.6, -5), V(0.5, 2.6, -1.8), V(0, 7.6, -5), 52, 46, eo),
      (ctx, su) => D.move(su, V(0, 5.5, 9), V(0, 4, -12), V(0, 5.2, 7.5), V(0, 4, -12), 54, 52, lin),
    ],
  };

  // ================================================================ 23-25
  S[23] = {
    setup(ctx) { D.scene.background.setHex(0x1a120c); Wd.sunAt(HA, 8, [3, 10, 2]); Wd.hemi.intensity = 0.6; st().vignette = 0.75; },
    shots: [(ctx, su) => D.move(su, hp(0, 1.6, 1.5), hp(0, 1.45, -12), hp(0, 1.55, -5.5), hp(0, 1.4, -12), 50, 46, lin)],
  };
  S[24] = {
    setup(ctx) {
      D.scene.background.setHex(0xbfe6ff); Wd.sunAt(KD, 6, [3, 9, 6]);
      Wd.hemi.color.setHex(0xffffff); Wd.hemi.intensity = 1.3; Wd.sun.color.setHex(0xfff8ec); Wd.sun.intensity = 2.0;
      st().confetti = 1; st().flashWhite = 0.25; st().vignette = 0.2;
      kids.forEach((k, i) => {
        k.root.visible = true; k.at(KD.x - 1.5 + i * 1.0, KD.z + 0.2 + (i % 2) * 0.3, 0);
        const up = eo(seg(ctx.lt, 0.05 + i * 0.08, 0.35 + i * 0.08));
        const bounce = 0.05 * Math.abs(Math.sin(ctx.t * 7 + i));
        k.body.position.y = bounce;
        for (const s of ['L', 'R']) { k.arm[s].sh.rotation.set(-0.2, 0, (s === 'L' ? 1 : -1) * (0.15 + 2.6 * up)); k.arm[s].el.rotation.set(-0.2, 0, 0); }
        k.face({ eyes: 'happy', mouth: 'grin', brows: 'raised' });
        const r = props.rolls[i]; r.visible = true;
        k.root.updateMatrixWorld(true);
        r.position.copy(k.handWorld(i % 2 ? 'L' : 'R')).add(V(0, 0.12, 0)); r.rotation.set(0, 0, 0.3 * Math.sin(ctx.t * 5 + i));
      });
    },
    shots: [(ctx, su) => D.move(su, kd(0, 1.0, 4.2), kd(0, 0.85, 0), kd(0, 0.95, 3.6), kd(0, 0.85, 0), 50, 48), (ctx, su) => D.move(su, kd(-1.2, 0.7, 1.6), kd(-1.0, 0.75, 0.2), kd(-0.9, 0.7, 1.4), kd(-1.0, 0.8, 0.2), 44, 42)],
  };
  S[25] = {
    setup(ctx) { stallOutside(ctx); },
    shots: [(ctx, su) => D.move(su, bp(0.6, 1.2, 2.45), bp(1.4, 1.4, 0.3), bp(0.7, 1.15, 2.25), bp(1.4, 1.35, 0.3), 54, 50)],
  };

  // ================================================================ 26-30  the circle and rock, paper, scissors
  const CIRC = V(0, 0, -9.6);
  const circleCast = (ctx, { shape = 'rock', shake = 0, brideShape = null } = {}) => {
    D.churchCast(ctx.t, { you: false, bride: false });
    const ring = [...family, fil, bride];
    const n = ring.length;
    ring.forEach((p, i) => {
      p.reset(); p.root.visible = true;
      const a = (i / n) * Math.PI * 2 + 0.2;
      const pos = CIRC.clone().add(V(Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95));
      p.at(pos.x, pos.z, a + Math.PI);
      p.spine.rotation.x = 0.18;
      const hand = CIRC.clone().add(V(Math.sin(a) * 0.32, 1.12 + 0.1 * shake, Math.cos(a) * 0.32));
      reach(p, 'R', hand, V(Math.sin(a), -0.6, Math.cos(a)));
      handDir(p, 'R', V(-Math.sin(a), -0.1, -Math.cos(a)), V(0, -1, 0));
      p.handShape('R', p === bride && brideShape ? brideShape : shape);
      p.face(p === bride ? { eyes: 'normal', mouth: 'smile' } : { eyes: 'squint', brows: 'angry', mouth: 'frown' });
    });
    if (bride.veil) bride.veil.rotation.x = 0.3;
  };
  const topDown = (ctx, su) => D.move(su, CIRC.clone().add(V(0.0, 3.05, 0.02)), CIRC.clone().add(V(0, 1.1, 0)), CIRC.clone().add(V(0.0, 2.75, 0.02)), CIRC.clone().add(V(0, 1.1, 0)), 44, 42, lin);
  S[26] = {
    setup(ctx) { circleCast(ctx, { shape: 'paper' }); [...family, fil].forEach(p => { p.arm.R.sh.rotation.set(0, 0, -0.1); p.arm.R.el.rotation.set(-0.1, 0, 0); p.handShape('R', 'paper'); }); bride.arm.R.sh.rotation.set(0, 0, -0.1); bride.arm.R.el.rotation.set(-0.1, 0, 0); },
    shots: [(ctx, su) => D.move(su, V(3.2, 4.6, -3.2), V(0, 0.9, -9.6), V(2.6, 4.2, -4.2), V(0, 0.9, -9.6), 48, 46), (ctx, su) => D.move(su, V(0.3, 1.5, -4.6), V(0, 1.3, -9.6), V(0.25, 1.5, -5.2), V(0, 1.3, -9.6), 46, 44)],
  };
  const beat = (ctx, times) => { // hands bounce once on each word
    let s = 0;
    for (const tt of times) { const d = ctx.lt - tt; if (d > -0.05 && d < 0.35) s = Math.max(s, Math.sin(Math.PI * clamp((d + 0.05) / 0.4))); }
    return s;
  };
  S[27] = {
    setup(ctx) {
      const ws = ctx.sc.words.map(w => w.s);
      circleCast(ctx, { shape: 'rock', shake: beat(ctx, ws) });
      const i = ws.filter(x => ctx.lt >= x - 0.05).length;
      if (i > 0) st().shakeAmt = Math.max(st().shakeAmt, 4 * beat(ctx, ws));
    },
    shots: [topDown],
  };
  S[28] = { setup(ctx) { circleCast(ctx, { shape: 'rock' }); }, shots: [topDown] };
  S[29] = {
    setup(ctx) { circleCast(ctx, { shape: 'rock' }); bride.face({ eyes: 'wide', brows: 'worried', mouth: 'wavy' }); fx.drop(head(bride).add(V(0.15, 0.14 - 0.1 * ctx.u, 0.15)), 0.1); },
    shots: [faceShot(bride, 1.25, 1.0, { ang: 0.2, dy: 0.05 }, { ang: 0.15, dy: 0.05 }, 38, 36)],
  };
  S[30] = {
    setup(ctx) { circleCast(ctx, { shape: 'rock', brideShape: 'scissors' }); bride.face({ eyes: 'wide', brows: 'worried', mouth: 'wavy' }); },
    shots: [topDown, (ctx, su) => { const h = bride.handWorld('R'); D.move(su, h.clone().add(V(0, 0.9, 0.15)), h, h.clone().add(V(0, 0.7, 0.12)), h, 40, 38); }],
  };

  // ================================================================ 31-33  the bride walks
  S[31] = {
    setup(ctx) {
      D.churchCast(ctx.t, { you: false });
      bride.at(0.2, -12.5, 0.15);
      const u = ctx.u;
      bride.face({ eyes: u > 0.75 ? 'squint' : 'normal', brows: u > 0.4 ? 'worried' : 'raised', mouth: u < 0.33 ? 'grin' : u < 0.66 ? 'smile' : u < 0.85 ? 'flat' : 'frown' });
      D.bouquetAt(bride);
    },
    shots: [faceShot(bride, 1.4, 1.0, { dy: 0.0 }, { dy: 0.0 }, 38, 34, lin)],
  };
  const brideWalk = (ctx, z0, z1) => {
    D.churchCast(ctx.t, { you: false });
    const z = lerp(z0, z1, seg(ctx.lt, 0, ctx.dur));
    bride.at(0, z, 0);
    P.walk(bride, ctx.lt * 4.5, 0.6, { arms: false });
    const a = 0;
    for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; reach(bride, s, bride.root.position.clone().add(V(sx * 0.42, 0.6, 0.12)), rotHint(bride, sx, -0.3, 0)); bride.arm[s].fingers.forEach(f => { f.rotation.z = bride.arm[s].sx * 1.2; }); }
    bride.skirt.position.y = 0.12; bride.skirt.scale.set(1.05, 0.88, 1.05);
    bride.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
    bride.veil.rotation.set(0.35 + 0.08 * Math.sin(ctx.t * 4), 0, 0.05 * Math.sin(ctx.t * 3));
    Wd.guests.forEach(g => { g.neck.rotation.set(0, (g.root.position.x > 0 ? -1 : 1) * 0.9, 0); });
  };
  S[32] = {
    cuts: ctx => [ctx.find(/^and/i, 0.5)],
    groups: [[0], [1]],
    setup(ctx) {
      const cut = ctx.find(/^and/i, 0.5);
      if (ctx.lt < cut) {
        D.churchCast(ctx.t, { you: false });
        bride.at(0, -17.0, 0, 0);
        const lift = eo(seg(ctx.lt, 0.1, 0.8));
        for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; reach(bride, s, bride.root.position.clone().add(V(sx * 0.45, 0.55 + 0.1 * lift, 0.15)), rotHint(bride, sx, -0.3, 0)); bride.arm[s].fingers.forEach(f => { f.rotation.z = bride.arm[s].sx * 1.2 * lift; }); }
        bride.skirt.position.y = 0.04 + 0.1 * lift; bride.skirt.scale.set(1 + 0.05 * lift, 1 - 0.12 * lift, 1 + 0.05 * lift);
        bride.face({ eyes: 'squint', brows: 'angry', mouth: 'frown' });
      } else brideWalk({ ...ctx, lt: ctx.lt - cut, dur: ctx.dur - cut }, -16.5, -13.0);
    },
    shots: [
      (ctx, su) => D.move(su, V(0.9, 0.9, -14.6), V(0, 0.75, -17.0), V(0.75, 0.85, -15.0), V(0, 0.8, -17.0), 46, 44),
      (ctx, su) => { const p = bride.root.position; D.move(su, p.clone().add(V(0.2, 1.7, 3.2)), p.clone().add(V(0, 1.3, 0)), p.clone().add(V(0.15, 1.7, 2.8)), p.clone().add(V(0, 1.3, 0)), 44, 42, lin); },
    ],
  };
  S[33] = {
    setup(ctx) {
      brideWalk(ctx, -12.5, -8.5);
      for (let k = 0; k < 18; k++) {
        const ph = (ctx.lt * 0.8 + hash(k)) % 1;
        const p = bride.root.position.clone().add(V((hash(k + 2) - 0.5) * 3 + Math.sin(ctx.t * 2 + k) * 0.3, 0.1 + ph * 1.8, -0.6 - ph * 2.5));
        fx.icon(k % 3 ? 'petal' : 'petal2', p, 0.08, { rot: ctx.t * 3 + k, opacity: Math.sin(Math.PI * ph) });
      }
      priest.face({ eyes: 'wide', mouth: 'o' });
    },
    shots: [(ctx, su) => D.move(su, V(0, 3.6, -19.6), V(0, 1.0, -6), V(0, 3.4, -19.0), V(0, 1.0, -6), 50, 48, lin)],
  };

  // ================================================================ 34-35  sad ending
  S[34] = {
    setup(ctx) {
      D.churchCast(ctx.t, { you: false, bride: false });
      st().blue = 1; st().vignette = 0.7;
      Wd.hemi.color.setHex(0x9fb2ff); Wd.sun.color.setHex(0xa8b8ff); Wd.chLight.intensity = 6;
      for (const s of ['L', 'R']) organist.arm[s].hand.position.y = -0.27 + 0.02 * Math.max(0, Math.sin(ctx.t * 3 + (s === 'L' ? 0 : 1.6)));
      organist.face({ eyes: 'squint', brows: 'worried', mouth: 'frown', tears: 0.6 + 0.4 * ctx.u, look: [0, -0.5] });
      organist.neck.rotation.set(0.2, 0, 0.12);
      const h = head(organist);
      for (let k = 0; k < 3; k++) { const p = (ctx.lt * 0.6 + k / 3) % 1; fx.icon('note', h.clone().add(V(0.3 + p * 0.4, 0.2 + p * 0.6, 0.3 - k * 0.2)), 0.12, { opacity: Math.sin(Math.PI * p) }); }
    },
    shots: [faceShot(organist, 1.3, 1.05, { ang: 0.5, dy: 0.0 }, { ang: 0.45 }, 40, 38, lin), (ctx, su) => D.move(su, V(-4.4, 2.2, -14.8), V(-6.4, 1.6, -16.5), V(-4.6, 2.1, -15.2), V(-6.4, 1.6, -16.5), 46, 44)],
  };
  S[35] = {
    cuts: ctx => [ctx.find(/^and/i, 0.6)],
    groups: [[0], [1]],
    setup(ctx) {
      const cut = ctx.find(/^and/i, 0.6);
      if (ctx.lt < cut) {
        D.scene.background.setHex(0x1a120c); Wd.sunAt(HA, 8, [3, 10, 2]);
        st().blue = 0.6;
        bride.root.visible = true;
        bride.at(HA.x, HA.z - 11.6, Math.PI);
        const op = eo(seg(ctx.lt, 0.3, cut));
        Wd.wcDoor.rotation.y = 1.2 * op;
        reach(bride, 'R', hp(0.35, 1.05, -12.35), rotHint(bride, -1, -0.5, 0));
        bride.face({ eyes: 'squint', brows: 'worried', mouth: 'frown', tears: 0.7 });
      } else {
        D.churchCast(ctx.t, { you: false, bride: false });
        st().blue = 0.6;
        const c = Math.sin(ctx.t * 4.2);
        Wd.guests.forEach(g => { g.arms.forEach((ar, i) => { ar.a.rotation.set(-1.0, 0, (i ? 1 : -1) * (0.25 + 0.15 * c)); ar.fo.rotation.set(-0.9, (i ? -1 : 1) * 0.5, 0); }); g.mouth.scale.set(0.6, 1, 1); });
        family.forEach(p => { for (const s of ['L', 'R']) { p.arm[s].sh.rotation.set(-1.1, 0, (s === 'L' ? -1 : 1) * (0.3 + 0.15 * c)); p.arm[s].el.rotation.set(-0.9, 0, 0); } p.face({ eyes: 'squint', mouth: 'flat' }); });
      }
    },
    shots: [
      (ctx, su) => { const h = head(bride); D.move(su, h.clone().add(V(1.05, 0.05, -0.55)), h.clone().add(V(0, -0.05, 0)), h.clone().add(V(0.95, 0.05, -0.45)), h.clone().add(V(0, -0.05, 0)), 44, 42, lin); },
      (ctx, su) => D.move(su, V(0, 2.6, -15.0), V(0, 1.1, -2), V(0, 2.4, -14.0), V(0, 1.1, -2), 50, 50, lin),
    ],
  };

  return S;
}

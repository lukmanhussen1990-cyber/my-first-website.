// Scene direction for the talking dog reel. Every frame is a pure function of
// t; cuts and actions are anchored to the voiceover's word timings.
import * as THREE from 'three';
import { P, talk, reach, handDir } from './lib/chars.js';
import { SET, TABLE, DOGHOUSE, BED } from './lib/sets.js';
import { DT } from './lib/dtex.js';

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
const pk = (x, y, z) => V(SET.park.x + x, y, SET.park.z + z);
const yd = (x, y, z) => V(SET.yard.x + x, y, SET.yard.z + z);

export class Director {
  constructor({ camera, world, cast, fx, timeline, scene }) {
    Object.assign(this, { camera, world, cast, fx, tl: timeline, scene });
    this.scenes = timeline.scenes.map((sc, i) => ({ ...sc, words: timeline.words.filter(w => w.line === i).map(w => ({ t: w.t, s: w.s - sc.start, e: w.e - sc.start })) }));
    this.byId = {}; this.scenes.forEach(s => { this.byId[s.id] = s; });
    this.speech = timeline.scenes.map(sc => ({ id: sc.id, who: sc.speaker, s: sc.ws, e: sc.we }));
    this.wordsAbs = timeline.words;
    this.defs = makeScenes(this);
    this.events = this.buildEvents();
  }
  wt(id, re, frac = 0.5) { const s = this.byId[id]; if (!s) return 0; const w = s.words.find(w => re.test(w.t)); return w ? w.s : s.dur * frac; }
  wend(id, re, frac = 0.5) { const s = this.byId[id]; if (!s) return 0; const w = s.words.find(w => re.test(w.t)); return w ? w.e : s.dur * frac; }
  abs(id, re, frac) { return this.byId[id].start + this.wt(id, re, frac); }
  // mouth amount for a speaker at time t (0 when silent)
  mouth(who, t, rate = 13) {
    const w = this.wordsAbs.find(w => this.tl.scenes[w.line].speaker === who && t >= w.s - 0.02 && t <= w.e + 0.02);
    return w ? talk(t, rate) : 0;
  }
  ctxFor(t) {
    let k = this.scenes.findIndex(s => t >= s.start && t < s.end);
    if (k < 0) k = t < 0 ? 0 : this.scenes.length - 1;
    const sc = this.scenes[k], lt = t - sc.start;
    return { t, lt, sc, id: sc.id, dur: sc.dur, u: clamp(lt / sc.dur), find: (re, f = 0.5) => this.wt(sc.id, re, f), fend: (re, f = 0.5) => this.wend(sc.id, re, f), ws: sc.ws - sc.start, we: sc.we - sc.start };
  }
  schedule(def, ctx) {
    const dur = ctx.dur;
    let cuts = def.cuts ? def.cuts(ctx).filter(c => c != null && c > 0.3 && c < dur - 0.3) : null;
    if (!cuts) { const n = Math.max(1, Math.min(def.shots.length, Math.round(dur / 1.2))); cuts = []; for (let i = 1; i < n; i++) cuts.push(dur * i / n); }
    const b = [0, ...cuts.sort((a, c) => a - c), dur], segs = [], tagged = [];
    const maxLen = def.maxShot || 1.6;
    for (let i = 0; i < b.length - 1; i++) { const len = b[i + 1] - b[i], parts = len > maxLen ? Math.ceil(len / 1.3) : 1; for (let p = 0; p < parts; p++) { segs.push([b[i] + len * p / parts, b[i] + len * (p + 1) / parts]); tagged.push([i, p]); } }
    let idx = segs.findIndex(s => ctx.lt >= s[0] && ctx.lt < s[1]); if (idx < 0) idx = segs.length - 1;
    const [a, c] = segs[idx];
    let shot = idx % def.shots.length;
    if (def.groups) { const [bi, pi] = tagged[idx]; const grp = def.groups[Math.min(bi, def.groups.length - 1)]; shot = grp[pi % grp.length]; }
    return { shot, seg: idx, su: clamp((ctx.lt - a) / (c - a)), slt: ctx.lt - a, sdur: c - a, s0: a, s1: c };
  }
  setCam(pos, look, fov = 40, roll = 0) { const c = this.camera; c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(look); if (roll) c.rotateZ(roll); c.fov = fov; c.updateProjectionMatrix(); }
  move(su, p1, l1, p2, l2, f1 = 40, f2 = f1, ease = sm, roll = 0) { const u = ease(su); this.setCam(vl(p1, p2, u), vl(l1, l2, u), lerp(f1, f2, u), roll); }

  update(t) {
    this.fx.begin();
    this.state = { shake: [0, 0], shakeAmt: 0, flash: 0, fade: 0, vignette: 0.42, speed: 0, sat: 1, bright: 1, blue: 0, warm: 1, dream: 0, arcs: null, rings: null, viewfinder: null, flashWhite: 0 };
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
    if (cap && cap.loud) this.state.shakeAmt = Math.max(this.state.shakeAmt, 9 * (0.45 + 0.55 * Math.max(0, 1 - (t - cap.s) / 0.35)));
    const a = this.state.shakeAmt;
    if (a > 0) this.state.shake = [a * (hash(Math.floor(t * 30)) - 0.5) * 2, a * (hash(Math.floor(t * 30) + 77) - 0.5) * 2];
    const end = this.tl.duration;
    this.state.fade = Math.max(this.state.fade, sm(seg(t, end - 1.5, end - 0.05)));
    return this.state;
  }

  // ------------------------------------------------------------ defaults
  baseline(ctx) {
    const c = this.cast, Wd = this.world;
    c.all.forEach(p => { p.reset(); p.root.visible = false; });
    c.dog.reset(); c.dog.root.visible = false;
    for (const k of ['box', 'collar', 'phone', 'fork', 'spoon', 'cup', 'leash']) c.props[k].visible = false;
    Wd.rainAt(ctx.t, 0);
    this.homeLight();
  }
  homeLight() {
    const Wd = this.world;
    this.scene.background.setHex(0x2a1d14); this.scene.fog = null;
    Wd.hemi.color.setHex(0xffe2c0); Wd.hemi.groundColor.setHex(0x5a4030); Wd.hemi.intensity = 0.75;
    Wd.amb.intensity = 0.12;
    Wd.sun.color.setHex(0xffd6a0); Wd.sun.intensity = 1.0;
    Wd.sunAt(SET.home, 4, [0.6, 7, 1.2]);
  }
  parkLight() {
    const Wd = this.world;
    this.scene.background.setHex(0x8fd0ff); this.scene.fog = new THREE.Fog(0x9fd8ff, 22, 70);
    Wd.hemi.color.setHex(0xdff2ff); Wd.hemi.groundColor.setHex(0x5a8a3a); Wd.hemi.intensity = 1.0;
    Wd.amb.intensity = 0.15;
    Wd.sun.color.setHex(0xfff2d6); Wd.sun.intensity = 2.2;
    Wd.sunAt(SET.park, 12, [6, 14, 8]);
    this.state.warm = 0.4;
  }
  yardLight(t) {
    const Wd = this.world;
    this.scene.background.setHex(0x0b1226); this.scene.fog = new THREE.Fog(0x0b1226, 9, 26);
    Wd.hemi.color.setHex(0x6a7ab8); Wd.hemi.groundColor.setHex(0x101820); Wd.hemi.intensity = 0.55;
    Wd.amb.intensity = 0.06;
    Wd.sun.color.setHex(0x9ab0ff); Wd.sun.intensity = 0.55;
    Wd.sunAt(SET.yard.clone().add(V(0, 0, 4)), 8, [-3, 9, 6]);
    Wd.rainAt(t, 1);
    this.state.warm = 0; this.state.blue = 0.6;
  }

  // ------------------------------------------------------------ people at the table
  seat(p, k, back = 0) { const s = TABLE.seat[k]; p.root.visible = true; p.at(s.x - Math.sin(s.rot) * back, s.z - Math.cos(s.rot) * back, s.rot); P.sit(p, 0.48); this.restArms(p); }
  restArms(p) { for (const s of ['L', 'R']) { p.arm[s].sh.rotation.set(-0.55, 0, (s === 'L' ? 1 : -1) * 0.12); p.arm[s].el.rotation.set(-0.85, 0, 0); } }
  // turn a person's head toward a world point
  look(p, target, amt = 1) {
    const h = p.headWorld(), d = target.clone().sub(h);
    let yw = Math.atan2(d.x, d.z) - p.root.rotation.y; yw = Math.atan2(Math.sin(yw), Math.cos(yw));
    yw = clamp(yw, -1.4, 1.4);
    const pitch = clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -0.6, 0.6);
    p.neck.rotation.y = yw * 0.55 * amt; p.head.rotation.y = yw * 0.45 * amt;
    p.head.rotation.x = pitch * 0.7 * amt;
  }
  // the whole family at dinner; YOU at his seat unless told otherwise
  table(t, { you = true, dog = true, eat = true } = {}) {
    const { mom, dad, sis } = this.cast;
    this.seat(dad, 'dad'); this.seat(mom, 'mom'); this.seat(sis, 'sis');
    if (you) { this.seat(this.cast.you, 'you'); this.nervous(t); }
    dad.face({ eyes: 'normal', mouth: 'flat' }); mom.face({ eyes: 'happy', mouth: 'smile' }); sis.face({ eyes: 'normal', mouth: 'flat' });
    if (eat) this.dadFork(t);
    this.momSpoon(0, t);
    this.sisPhone(0, false, t);
    if (dog) this.dogSeat(t);
  }
  nervous(t, amt = 1) {
    const y = this.cast.you;
    y.face({ eyes: 'nervous', twitch: Math.sin(t * 31) > 0.85 ? 1 : 0, mouth: 'wavy', brows: 'worried' });
    if (amt > 0) { const h = y.headWorld(), a = y.root.rotation.y; const ph = (t * 0.9) % 1; this.fx.drop(h.clone().add(V(0, 0.2 - ph * 0.12, 0)).addScaledVector(facing(a), 0.2).addScaledVector(leftOf(a), 0.14), 0.09 * amt, { opacity: Math.min(1, 3 * (1 - ph)) }); }
  }
  dogSeat(t, o = {}) {
    const d = this.cast.dog, s = TABLE.seat.dog;
    d.root.visible = true; d.at(s.x, s.z, s.rot);
    d.sit(0.58, o);
    d.earFlop(t, 0.5, o.ears || 0);
    return d;
  }
  collarGlow(level = 1, size = 0.13, color = 0x3dff6a) {
    const d = this.cast.dog; d.collarLight(level, color);
    if (level > 0.05) this.fx.glow(d.ledWorld(), size * (0.6 + 0.4 * level), color, 0.85 * level);
  }
  // dad's fork: cycles plate -> mouth; freeze holds it up in front of his open mouth
  dadFork(t, freeze = false) {
    const dad = this.cast.dad, fork = this.cast.props.fork, s = TABLE.seat.dad;
    const cyc = (t * 0.55 + 0.3) % 1;
    let u = cyc < 0.3 ? sm(cyc / 0.3) : cyc < 0.55 ? 1 : 1 - sm((cyc - 0.55) / 0.45);
    if (freeze) u = 0.82;
    const h = dad.headWorld();
    const plate = V(s.x + 0.04, 0.83, s.z * 0.42);
    const mouth = h.clone().add(V(0.0, -0.13, 0.24));
    const hand = vl(plate, mouth, u);
    reach(dad, 'R', hand.clone().add(V(-0.05, -0.02, -0.1)), V(-0.7, -1, 0));
    fork.visible = true; fork.position.copy(hand); fork.rotation.set(-0.25 - 0.9 * u, 0.15, 0);
    if (!freeze) dad.face({ eyes: 'normal', mouth: u > 0.85 ? 'o' : (cyc > 0.55 && cyc < 0.8 ? (Math.sin(t * 22) > 0 ? 'flat' : 'smile') : 'flat'), open: 0.5 });
    return u;
  }
  // mom's spoon: 0 = in the soup, 1 = laid down on the table
  momSpoon(u, t) {
    const mom = this.cast.mom, sp = this.cast.props.spoon, s = TABLE.seat.mom;
    const inSoup = V(s.x - 0.02, 0.86 + 0.02 * Math.sin(t * 2), s.z * 0.42 - 0.04);
    const lift = V(s.x + 0.12, 0.95, s.z * 0.42 - 0.12);
    const down = V(s.x + 0.2, 0.772, s.z * 0.42 - 0.05);
    const p = u < 0.5 ? vl(inSoup, lift, sm(u * 2)) : vl(lift, down, sm((u - 0.5) * 2));
    sp.visible = true; sp.position.copy(p); sp.rotation.set(u < 0.75 ? -0.5 : 0, -0.3, 0);
    reach(mom, 'R', p.clone().add(V(0.02, 0.02, -0.12)), V(0.7, -1, 0));
  }
  // mom's tea: 0 = cup on the saucer, 1 = at her lips
  momCup(u) {
    const mom = this.cast.mom, cup = this.cast.props.cup, s = TABLE.seat.mom;
    const h = mom.headWorld();
    const rest = this.world.cupSpot.clone().add(V(0, 0.035, 0));
    const lips = h.clone().add(V(0.03, -0.12, 0.17));
    const p = vl(rest, lips, sm(u));
    cup.visible = true; cup.position.copy(p); cup.rotation.set(-0.55 * sm(u), Math.PI / 2, 0);
    reach(mom, 'L', p.clone().add(V(0.07, -0.02, -0.04)), V(0.8, -1, 0));
  }
  // sister's phone: raise 0 = looking down at it, 1 = up at eye level pointing at the dog
  sisPhone(raise, rec, t) {
    const sis = this.cast.sis, ph = this.cast.props.phone;
    const h = sis.headWorld(), a = sis.root.rotation.y;
    const low = h.clone().addScaledVector(facing(a), 0.3).add(V(0, -0.45, 0));
    const high = h.clone().addScaledVector(facing(a), 0.34).add(V(0, -0.03, 0)).addScaledVector(leftOf(a), -0.05);
    const p = vl(low, high, sm(raise));
    ph.visible = true; ph.position.copy(p); ph.lookAt(h.clone().add(V(0, raise > 0.5 ? 0 : 0.1, 0)));
    ph.userData.sm.map = rec && (Math.floor(t * 2) % 2 === 0) ? DT.phoneRec : DT.phoneIdle;
    const L = leftOf(a);
    reach(sis, 'L', p.clone().addScaledVector(L, 0.05).add(V(0, -0.05, 0)), V(0.6, -1, 0));
    reach(sis, 'R', p.clone().addScaledVector(L, -0.05).add(V(0, -0.05, 0)), V(-0.6, -1, 0));
    sis.neck.rotation.x = raise > 0.5 ? 0.0 : 0.35;
  }

  buildEvents() {
    const ev = [], has = id => !!this.byId[id];
    const add = (t, type, word, o = {}) => ev.push({ t: Math.max(0, t), type, word, ...o });
    if (has(2)) add(this.byId[2].start + this.byId[2].dur * 0.62, 'click', { text: 'CLICK!', x: 0.72, y: 0.3, rot: 0.12, color: '#ffffff', size: 54, dur: 0.6 }, { gain: 0.5 });
    if (has(3)) { const t0 = this.byId[3].we + 0.12; add(t0, 'beep', { text: 'BEEP!', x: 0.5, y: 0.27, rot: -0.08, color: '#5dff7a', size: 92, dur: 0.9, wobble: true }, { gain: 0.55 }); }
    if (has(7)) add(this.byId[7].start - 0.02, 'scratch', null, { gain: 0.75 });
    if (has(11)) add(this.byId[11].we + 0.08, 'recbeep', null, { gain: 0.5 });
    if (has(17)) add(this.byId[17].start + this.byId[17].dur * 0.72, 'clink', null, { gain: 0.45 });
    if (has(20)) add(this.highFiveT, 'clap', { text: 'SLAP!', x: 0.5, y: 0.25, rot: 0.1, color: '#ffd93b', size: 84, dur: 0.8 }, { gain: 0.8 });
    if (has(21)) add(this.byId[21].start, 'rain', null, { dur: this.tl.duration - this.byId[21].start, gain: 0.5 });
    return ev;
  }
  sfxWords(t) {
    const end = tt => { const s = this.scenes.find(x => tt >= x.start && tt < x.end); return s ? s.end : 1e9; };
    return this.events.filter(e => e.word && t >= e.t && t < Math.min(e.t + (e.word.dur || 0.85), end(e.t))).map(e => ({ ...e.word, t: e.t, dur: Math.min(e.word.dur || 0.85, end(e.t) - e.t) }));
  }
}

// ======================================================================
function makeScenes(D) {
  const { you, mom, dad, sis, dog, walkers, props } = D.cast;
  const Wd = D.world, fx = D.fx, S = {};
  const st = () => D.state;
  const head = p => p.headWorld();
  const dogHead = () => dog.headWorld();
  const PK = 1.6, DK = 1.45;   // framing scale for people / the dog
  const faceCam = (p, dist, { ang = 0, dy = 0, ldy = -0.1, side = 0 } = {}) => {
    const h = head(p), a = p.root.rotation.y + ang;
    return [h.clone().addScaledVector(facing(a), dist * PK).add(V(0, dy, 0)).addScaledVector(leftOf(a), side), h.clone().add(V(0, ldy, 0))];
  };
  const dogCam = (dist, { ang = 0, dy = 0, ldy = -0.08, side = 0 } = {}) => {
    const h = dogHead(), a = dog.root.rotation.y + ang;
    return [h.clone().addScaledVector(facing(a), dist * DK).add(V(0, dy, 0)).addScaledVector(leftOf(a), side), h.clone().add(V(0, ldy, 0))];
  };
  const faceShot = (p, d1, d2, o1 = {}, o2 = o1, f1 = 38, f2 = f1, ease = sm) => (ctx, su) => { const [a, b] = faceCam(p, d1, o1), [c, d] = faceCam(p, d2, o2); D.move(su, a, b, c, d, f1, f2, ease); };
  const dogShot = (d1, d2, o1 = {}, o2 = o1, f1 = 38, f2 = f1, ease = sm) => (ctx, su) => { const [a, b] = dogCam(d1, o1), [c, d] = dogCam(d2, o2); D.move(su, a, b, c, d, f1, f2, ease); };
  const sparkles = (c, t, { n = 7, r = 0.28, size = 0.09, y = 0.1, seed = 1, opacity = 1 } = {}) => {
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + t * 0.6 + seed, tw = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.3 + seed);
      fx.sparkle(c.clone().add(V(Math.cos(a) * r, y + 0.08 * Math.sin(t * 2 + k), Math.sin(a) * r)), size * (0.5 + 0.7 * tw), { opacity: opacity * (0.4 + 0.6 * tw), rot: t * 2 + k });
    }
  };
  const burst = (c, u, { n = 12, r = 0.5, size = 0.12 } = {}) => {
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, rr = r * eo(u), up = Math.sin(k * 1.7) * 0.5;
      fx.sparkle(c.clone().add(V(Math.cos(a) * rr * 0.6, up * rr, Math.sin(a) * rr)), size * (1 - 0.5 * u), { opacity: 1 - u * u, rot: u * 4 + k });
    }
  };
  const YS = { x: 1.36, z: 0.66 };
  const youByDog = () => { you.root.visible = true; you.at(YS.x, YS.z, Math.atan2(TABLE.seat.dog.x - 0.15 - YS.x, -YS.z)); };
  const youStanding = () => { const s = TABLE.seat.you; you.root.visible = true; you.at(s.x + 0.05, s.z + 0.34, s.rot); };
  const holdUp = (p, pos, w = 0.12) => { const a = p.root.rotation.y, L = leftOf(a); reach(p, 'L', pos.clone().addScaledVector(L, w).add(V(0, -0.04, 0)), V(0.6, -1, 0)); reach(p, 'R', pos.clone().addScaledVector(L, -w).add(V(0, -0.04, 0)), V(-0.6, -1, 0)); };
  const familyLook = (target, amt = 1, list = [mom, dad, sis]) => list.forEach(p => D.look(p, target, amt));
  const lean = (list, a) => list.forEach(p => { p.spine.rotation.x = a; });
  const youSweat = (t, n = 2) => {
    const h = head(you), a = you.root.rotation.y;
    for (let k = 0; k < n; k++) { const ph = (t * 1.1 + k * 0.5) % 1; fx.drop(h.clone().add(V(0, 0.22 - ph * 0.2, 0)).addScaledVector(facing(a), 0.19).addScaledVector(leftOf(a), (k % 2 ? -0.16 : 0.16)), 0.085, { opacity: Math.min(1, 3 * (1 - ph)) }); }
  };
  const collarPos = () => { dog.root.updateMatrixWorld(true); return dog.collar.getWorldPosition(V(0, 0, 0)); };
  const boxAt = V(1.0, 0.762, 0.34);
  const chairReset = () => { const ch = Wd.chairs.you, s = TABLE.seat.you; ch.position.set(s.x, 0, s.z); ch.rotation.set(0, s.rot, 0); };

  // ================================================================ 1  the shiny box
  S[1] = {
    cuts: ctx => [ctx.find(/^collar/i, 0.35) - 0.12, ctx.find(/^lets/i, 0.6) - 0.08],
    groups: [[0], [1], [2]],
    setup(ctx) {
      D.table(ctx.t, { you: false });
      youByDog();
      const b = props.box; b.visible = ctx.shot.shot !== 2; b.position.copy(boxAt); b.rotation.set(0, -0.35, 0);
      const cutB = ctx.find(/^collar/i, 0.35) - 0.12;
      b.userData.lid.rotation.x = -2.0 * eo(seg(ctx.lt, 0.1, 0.8));
      const inBox = ctx.lt < cutB;
      b.userData.collar.visible = inBox;
      D.collarGlow(0); dog.collar.visible = false;
      fx.glow(boxAt.clone().add(V(0, 0.22, 0)), inBox ? 0.8 : 0.4, 0xfff0a0, 0.5);
      sparkles(boxAt.clone().add(V(0, 0.2, 0)), ctx.t, { n: 9, r: 0.32, size: 0.075 });
      you.face({ eyes: 'sparkle', mouth: 'grin', brows: 'raised' });
      if (!inBox) {
        const h = head(you), a = you.root.rotation.y;
        const c = h.clone().addScaledVector(facing(a), 0.42).add(V(0, -0.34 + 0.03 * Math.sin(ctx.t * 5), 0));
        props.collar.visible = true; props.collar.position.copy(c); props.collar.lookAt(h.clone().add(V(0, -0.2, 0))); props.collar.rotateZ(Math.PI + 0.3 * Math.sin(ctx.t * 2));
        props.collar.userData.ledMat.color.setHex(0x223322);
        holdUp(you, c, 0.14);
        sparkles(c, ctx.t * 1.3, { n: 6, r: 0.24, size: 0.07, y: 0, seed: 3 });
        fx.glow(c, 0.42, 0xfff0a0, 0.35);
        D.look(you, c, 0.5);
        dog.aim(dog.pitch, 0.3, 0.15, 0.95, -0.38); dog.face({ eyes: 'wide', look: [0.6, -0.2] }); dog.earFlop(ctx.t, 0.5, 0.25);
      } else { for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.5, 0, (s === 'L' ? 1 : -1) * 0.2); you.arm[s].el.rotation.set(-0.6, 0, 0); } }
      st().vignette = 0.5;
    },
    shots: [
      (ctx, su) => D.move(su, boxAt.clone().add(V(-1.05, 0.72, 0.62)), boxAt.clone().add(V(0, 0.06, 0)), boxAt.clone().add(V(-0.78, 0.55, 0.47)), boxAt.clone().add(V(0, 0.08, 0)), 38, 36, lin),
      faceShot(you, 1.2, 1.05, { ang: 0.55, dy: 0.05, ldy: -0.25 }, { ang: 0.5, dy: 0.05, ldy: -0.25 }, 40, 38),
      dogShot(1.05, 0.9, { ang: 0.55, dy: 0.22, ldy: -0.08 }, { ang: 0.5, dy: 0.2, ldy: -0.08 }, 38, 36),
    ],
  };

  // ================================================================ 2  the collar goes on (one shot, chin up)
  S[2] = {
    cuts: () => [],
    groups: [[0]],
    maxShot: 2,
    setup(ctx) {
      D.table(ctx.t, { you: false });
      youByDog(); you.face({ eyes: 'normal', mouth: 'smile', brows: 'raised' });
      const click = ctx.dur * 0.62;
      dog.aim(dog.pitch, 0.25, -0.35, 0.15); dog.face({ eyes: 'normal', look: [0.2, -0.5] });
      const cw = collarPos(), cq = dog.collar.getWorldQuaternion(new THREE.Quaternion());
      const fin = cq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
      const h = head(you), a = you.root.rotation.y;
      const start = h.clone().addScaledVector(facing(a), 0.4).add(V(0, -0.3, 0));
      if (ctx.lt < click) {
        const u = sm(seg(ctx.lt, 0, click));
        const p = vl(start, cw, u);
        props.collar.visible = true; props.collar.position.copy(p);
        const q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, h, V(0, 1, 0)));
        props.collar.quaternion.copy(q0).slerp(fin, sm(seg(u, 0.25, 1)));
        props.collar.scale.setScalar(1 + 0.3 * (1 - u));
        props.collar.userData.ledMat.color.setHex(0x223322);
        holdUp(you, p, 0.14);
        dog.collar.visible = false;
      } else {
        props.collar.scale.setScalar(1);
        dog.collar.visible = true; D.collarGlow(0.05, 0.05, 0xff3030);
        reach(you, 'L', cw.clone().add(V(0.08, 0.02, 0.15)), V(0.6, -1, 0)); reach(you, 'R', cw.clone().add(V(0.12, 0.02, -0.12)), V(-0.6, -1, 0));
        const k = seg(ctx.lt, click, click + 0.15);
        dog.face({ eyes: k < 1 ? 'squint' : 'normal', look: [0, -0.6] }); dog.earFlop(ctx.t, 1.4, 0.25 * (1 - k));
      }
    },
    shots: [
      (ctx, su) => { const c = collarPos(), a = dog.root.rotation.y - 0.45; D.move(su, c.clone().addScaledVector(facing(a), 1.7).add(V(0, 0.28, 0)), c.clone().add(V(0, 0.12, 0)), c.clone().addScaledVector(facing(a), 1.35).add(V(0, 0.22, 0)), c.clone().add(V(0, 0.12, 0)), 40, 38); },
    ],
  };

  // ================================================================ 3  the light turns green, BEEP
  S[3] = {
    cuts: ctx => [ctx.we + 0.04],
    groups: [[0], [1]],
    setup(ctx) {
      D.table(ctx.t, { you: false });
      youByDog(); you.face({ eyes: 'wide', mouth: 'o', open: 0.4, brows: 'raised' }); D.look(you, dogHead());
      const green = ctx.fend(/^turns/i, 0.55) + 0.02;
      const beep = ctx.we + 0.12;
      if (ctx.lt < green) {
        const blink = Math.floor(ctx.lt * 5) % 2 ? 1 : 0.2;
        D.collarGlow(0.9 * blink, 0.13, 0xff3030);
        dog.aim(dog.pitch, 0.25, -0.3, 0); dog.face({ eyes: 'normal', look: [0, -0.8] });
      } else {
        const k = 1 + 0.9 * Math.max(0, 1 - (ctx.lt - green) / 0.35) + 0.12 * Math.sin(ctx.t * 12);
        D.collarGlow(Math.min(1.8, k), 0.13 * k, 0x3dff6a);
        const up = sm(seg(ctx.lt, beep - 0.05, beep + 0.12));
        dog.aim(dog.pitch, 0.25 + 0.05 * up, -0.3 + 0.32 * up, 0); dog.face({ eyes: up > 0.3 ? 'wide' : 'normal', look: [0, -0.8 + 0.8 * up] }); dog.earFlop(ctx.t, 1.5 * up, 0.35 * up);
        if (ctx.lt > beep) st().rings = { world: dog.ledWorld(), strength: 0.5 * Math.max(0, 1 - (ctx.lt - beep) / 0.9) };
      }
    },
    shots: [
      (ctx, su) => { const L = dog.ledWorld(), a = dog.root.rotation.y + 0.15; D.move(su, L.clone().addScaledVector(facing(a), 1.75).add(V(0, 0.0, 0)), L.clone().add(V(0, -0.06, 0)), L.clone().addScaledVector(facing(a), 1.45).add(V(0, 0.0, 0)), L.clone().add(V(0, -0.06, 0)), 37, 35, lin); },
      dogShot(1.15, 0.92, { ang: 0.12, ldy: -0.1 }, { ang: 0.1, ldy: -0.1 }, 38, 36, eo),
    ],
  };

  // ================================================================ 4  the whole family is waiting
  const waiting = (ctx, k = 1) => {
    D.table(ctx.t, { eat: false });
    D.dadFork(0, true);
    const tgt = dogHead();
    lean([mom, dad, sis, you], 0.32 * k);
    familyLook(tgt, 1, [mom, dad, sis, you]);
    for (const p of [mom, dad, sis]) p.face({ eyes: 'wide', mouth: 'flat', brows: 'raised' });
    dad.face({ eyes: 'wide', mouth: 'o', open: 0.3, brows: 'raised' });
    you.face({ eyes: 'wide', mouth: 'wavy', brows: 'worried' }); youSweat(ctx.t, 1);
    D.collarGlow(1, 0.12);
    dog.face({ eyes: 'normal', blink: Math.sin(ctx.t * 2.3) > 0.985 ? 1 : 0 });
  };
  S[4] = {
    cuts: ctx => [ctx.dur * 0.5],
    groups: [[0], [1]],
    setup(ctx) { waiting(ctx, sm(seg(ctx.lt, 0, 0.6))); },
    shots: [
      (ctx, su) => D.move(su, V(2.85, 2.2, 0.15), V(-0.1, 0.95, 0.0), V(2.6, 2.1, 0.12), V(-0.1, 0.98, 0.0), 50, 48),
      (ctx, su) => D.move(su, V(-1.55, 1.38, 0.05), V(1.4, 1.22, 0.0), V(-1.35, 1.36, 0.04), V(1.4, 1.22, 0.0), 40, 38),
    ],
  };

  // ================================================================ 5  what will his first words be? (slow zoom)
  S[5] = {
    cuts: ctx => [ctx.dur * 0.58],
    groups: [[0], [1]],
    maxShot: 2,
    setup(ctx) {
      waiting(ctx);
      const open = sm(seg(ctx.lt, ctx.dur - 0.3, ctx.dur));
      dog.face({ eyes: 'normal', open: 0.15 * open, blink: Math.abs(ctx.lt - 0.9) < 0.08 ? 1 : 0 });
      st().vignette = 0.42 + 0.25 * ctx.u;
    },
    shots: [
      dogShot(2.3, 1.45, { ang: 0.04, dy: 0.04, ldy: -0.14 }, { ang: 0.02, dy: 0.02, ldy: -0.12 }, 38, 36, lin),
      dogShot(1.0, 0.8, { ang: 0.0, ldy: -0.08 }, { ang: 0.0, ldy: -0.08 }, 36, 34, lin),
    ],
  };

  // ================================================================ 6  DOG: I know you pooped your pants at the park
  const shocked = (ctx) => {
    D.table(ctx.t, { eat: false }); D.dadFork(0, true);
    for (const p of [mom, dad, sis]) { p.face({ eyes: 'wide', mouth: 'o', open: 0.7, brows: 'raised' }); D.look(p, dogHead()); p.spine.rotation.x = -0.1; }
    you.face({ eyes: 'wide', mouth: 'o', open: 0.9, brows: 'worried' }); D.look(you, dogHead()); you.spine.rotation.x = -0.15; youSweat(ctx.t, 2);
  };
  const dogTalk = (ctx, o = {}) => {
    const m = D.mouth('DOG', ctx.t);
    dog.face({ eyes: o.eyes || 'half', brows: o.brows || 'flat', open: m * 1.25, look: o.look || [0, 0] });
    dog.earFlop(ctx.t, 0.6 + m, o.ears || 0);
    D.collarGlow(0.85 + 0.7 * m, 0.11 + 0.08 * m);
    return m;
  };
  S[6] = {
    cuts: ctx => [ctx.find(/^your/i, 0.5) - 0.04],
    groups: [[0], [1]],
    setup(ctx) {
      shocked(ctx);
      const m = dogTalk(ctx, { eyes: 'half' });
      dog.aim(dog.pitch, 0.3, 0.0 + 0.06 * m, 0);
      if (m > 0) st().rings = { world: dog.ledWorld(), strength: 0.3 };
    },
    shots: [
      dogShot(1.25, 1.0, { ang: 0.08, ldy: -0.12 }, { ang: 0.06, ldy: -0.12 }, 38, 36, eo),
      faceShot(you, 1.15, 0.98, { ang: -0.15, ldy: -0.14 }, { ang: -0.15, ldy: -0.14 }, 38, 36, eo),
    ],
  };

  // ================================================================ 7  Silence. (everyone frozen)
  S[7] = {
    cuts: ctx => [ctx.we - 0.1],
    groups: [[0], [1]],
    maxShot: 2,
    setup(ctx) {
      shocked(ctx);
      for (const p of [mom, sis]) p.face({ eyes: 'normal', mouth: 'flat' });
      dad.face({ eyes: 'wide', mouth: 'o', open: 0.6 });
      you.face({ eyes: 'wide', mouth: 'flat', brows: 'worried' });
      D.collarGlow(0.9, 0.11);
      dog.face({ eyes: 'half', brows: 'flat' });
      st().sat = 0.45; st().vignette = 0.62; st().warm = 0.5;
    },
    shots: [
      (ctx, su) => D.setCam(V(-2.75, 1.95, 0.0), V(0.7, 1.0, 0.0), 44),
      (ctx, su) => { const [p, l] = faceCam(you, 1.05, { ang: 0.0, ldy: -0.12 }); const [p2, l2] = faceCam(you, 0.92, { ang: 0.0, ldy: -0.12 }); D.move(su, p, l, p2, l2, 38, 36, lin); },
    ],
  };

  // ================================================================ 8  flashback: last week at the park
  const PX = { stop: 0 };
  const walkersAt = (t) => {
    walkers.forEach((w, i) => {
      w.root.visible = true;
      const dir = i % 2 ? -1 : 1, lane = [-0.75, -2.3, -0.7, -3.4, -1.9, -2.9][i];
      const x = ((i * 3.9 + t * 1.0 * dir) % 18 + 18) % 18 - 8;
      w.at(SET.park.x + x, lane, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      P.walk(w, t * 6 + i * 2, 0.75);
      w.face({ eyes: 'normal', mouth: 'smile' });
    });
  };
  const leash = () => {
    you.root.updateMatrixWorld(true);
    const a = you.handWorld('L'), b = dog.ledWorld().add(V(0, -0.02, 0));
    const L = props.leash; L.visible = true; L.position.copy(a); L.lookAt(b); L.scale.set(1, 1, a.distanceTo(b));
  };
  const parkWalk = (ctx, stop) => {
    const t8 = ctx.t - D.byId[8].start;
    const wt = Math.min(t8, stop);
    const x0 = -1.6 + wt * 1.15;
    PX.stop = -1.6 + stop * 1.15;
    you.root.visible = true; you.at(SET.park.x + x0, 0.3, Math.PI / 2);
    dog.root.visible = true; dog.at(SET.park.x + x0 + 1.05, -0.2, Math.PI / 2); dog.stand();
    if (t8 < stop) { P.walk(you, wt * 6.2, 0.8); dog.walk(wt * 9.5); dog.face({ eyes: 'happy', tongue: true, open: 0.35 }); dog.wag(ctx.t, 1); you.face({ eyes: 'happy', mouth: 'smile' }); }
    return t8 >= stop;
  };
  const pooped = (ctx, k) => {
    for (const s of ['L', 'R']) { you.leg[s].hp.rotation.set(-0.15, 0, (s === 'L' ? -1 : 1) * 0.08); you.leg[s].kn.rotation.x = 0.3; }
    you.body.position.y = -0.04; you.spine.rotation.x = 0.12;
    you.face({ eyes: 'wide', mouth: 'o', open: 0.6, brows: 'worried' });
    for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(0.2, 0, (s === 'L' ? 1 : -1) * 0.35); you.arm[s].el.rotation.set(-0.3, 0, 0); }
    you.root.updateMatrixWorld(true);
    const hip = you.hips.getWorldPosition(V(0, 0, 0));
    const back = facing(you.root.rotation.y).negate();
    fx.stinkLines(hip.clone().addScaledVector(back, 0.3).add(V(0, 0.1, 0)), ctx.t, { n: 6, spread: 0.45, height: 1.2, size: 0.55, opacity: k, seed: 4 });
    youSweat(ctx.t, 2);
  };
  S[8] = {
    cuts: ctx => [1.25, ctx.find(/^pooped/i, 0.6) + 0.38],
    groups: [[0], [1], [2]],
    setup(ctx) {
      D.parkLight();
      st().dream = 0.5; st().sat = 1.12;
      st().flashWhite = Math.max(0, 1 - ctx.lt / 0.3) * 0.95;
      const stop = ctx.find(/^pooped/i, 0.6) + 0.05;
      walkersAt(ctx.t);
      const stopped = parkWalk(ctx, stop);
      if (stopped) {
        pooped(ctx, sm(seg(ctx.lt, stop, stop + 0.3)));
        dog.aim(0, 0.5, 0, 1.5); dog.face({ eyes: 'normal', look: [0.5, 0] }); dog.tail.rotation.set(-0.5, 0, 0);
        walkers.forEach(w => { if (Math.abs(w.root.position.x - you.root.position.x) < 4) D.look(w, head(you), 0.8); });
      }
      leash();
    },
    shots: [
      (ctx, su) => { const x = you.root.position.x + 0.6; D.move(su, V(x - 0.8, 2.1, 6.4), V(x, 0.75, 0), V(x - 0.2, 2.0, 6.0), V(x + 0.2, 0.75, 0), 44, 42); },
      (ctx, su) => { const h = head(you); D.move(su, h.clone().add(V(1.1, -0.2, 2.9)), h.clone().add(V(0, -0.55, 0)), h.clone().add(V(0.9, -0.2, 2.6)), h.clone().add(V(0, -0.55, 0)), 44, 42); },
      (ctx, su) => { const h = head(you); D.move(su, h.clone().add(V(1.0, 0.05, 2.0)), h.clone().add(V(-0.2, -0.32, 0)), h.clone().add(V(0.85, 0.05, 1.75)), h.clone().add(V(-0.2, -0.32, 0)), 44, 42, eo); },
    ],
  };

  // ================================================================ 9  ...and you told everyone it was the dog
  const holdNose = (w) => { const a = w.root.rotation.y; const n = head(w).addScaledVector(facing(a), 0.24).add(V(0, -0.04, 0)); reach(w, 'R', n, V(-0.6, -1, 0)); handDir(w, 'R', V(0, 1, 0), facing(a).negate()); w.face({ eyes: 'squint', mouth: 'wavy', brows: 'angry' }); };
  S[9] = {
    cuts: ctx => [ctx.find(/^everyone/i, 0.4) + 0.12],
    groups: [[0], [1]],
    setup(ctx) {
      D.parkLight(); st().dream = 0.5; st().sat = 1.12;
      const x0 = PX.stop || 0.3;
      you.root.visible = true; you.at(SET.park.x + x0, 0.3, Math.PI / 2 + 0.25);
      dog.root.visible = true; dog.at(SET.park.x + x0 + 1.15, -0.15, -Math.PI / 2 + 0.35); dog.stand({ n: 0.45, h: -0.05 });
      pooped(ctx, 1);
      you.face({ eyes: 'normal', mouth: 'open', open: 0.5 + 0.35 * Math.abs(Math.sin(ctx.t * 13)), brows: 'angry' });
      const tgt = dogHead();
      const dir = tgt.clone().sub(head(you)).normalize();
      reach(you, 'R', head(you).add(V(0, -0.25, 0)).addScaledVector(dir, 0.62), V(-0.5, -1, 0));
      handDir(you, 'R', dir, V(0, -1, 0)); you.handShape('R', 'scissors');
      D.look(you, tgt);
      const spots = [[0.2, -1.6, 0.1], [1.0, -1.35, -0.5], [-0.7, -1.5, 0.45], [1.7, -0.9, -0.95], [-1.4, -1.9, 0.6], [0.6, -2.3, 0.0]];
      walkers.forEach((w, i) => {
        const [dx, dz, r] = spots[i];
        w.root.visible = true; w.at(dog.root.position.x + dx, dz, r);
        holdNose(w); D.look(w, dogHead(), 0.9);
      });
      dog.face({ eyes: 'wide', brows: 'worried', look: [0.0, 0.2] }); dog.earFlop(ctx.t, 0.3, -0.12); dog.tail.rotation.set(0.3, 0, 0);
      fx.stinkLines(dogHead().add(V(0, 0.12, 0)), ctx.t, { n: 2, spread: 0.2, height: 0.6, size: 0.4, opacity: 0.8, seed: 9 });
      if (ctx.shot.shot === 1) fx.icon('excl', dogHead().add(V(0, 0.45, 0)), 0.3, { opacity: 1 });
    },
    shots: [
      (ctx, su) => { const m = head(you).lerp(dogHead(), 0.5); D.move(su, m.clone().add(V(-0.1, 0.05, 3.1)), m.clone().add(V(0, -0.2, 0)), m.clone().add(V(-0.05, 0.05, 2.75)), m.clone().add(V(0, -0.2, 0)), 48, 46); },
      (ctx, su) => { const d = dogHead(); D.move(su, d.clone().add(V(-0.25, -0.1, 1.5)), d.clone().add(V(0.15, 0.55, -1.2)), d.clone().add(V(-0.2, -0.12, 1.3)), d.clone().add(V(0.15, 0.55, -1.2)), 52, 50); },
    ],
  };

  // ================================================================ 10  Dad stops eating
  S[10] = {
    cuts: ctx => [ctx.find(/^eating/i, 0.6) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      D.table(ctx.t, { eat: false });
      st().flashWhite = Math.max(0, 1 - ctx.lt / 0.25) * 0.85;
      const stop = ctx.find(/^stops/i, 0.5) + 0.05;
      if (ctx.lt < stop) D.dadFork(ctx.t * 1.6); else { D.dadFork(0, true); dad.face({ eyes: 'wide', mouth: 'o', open: 0.55, brows: 'raised' }); }
      D.collarGlow(0.9, 0.11); dog.face({ eyes: 'half', brows: 'flat' });
      for (const p of [mom, sis]) p.face({ eyes: 'normal', mouth: 'flat' });
    },
    shots: [
      faceShot(dad, 1.2, 1.02, { ang: -0.35, ldy: -0.2 }, { ang: -0.3, ldy: -0.2 }, 38, 36),
      (ctx, su) => { const f = props.fork.position.clone().add(V(0, 0.03, 0.05)); D.move(su, f.clone().add(V(0.62, 0.1, 0.38)), f.clone().add(V(-0.05, 0.05, -0.08)), f.clone().add(V(0.52, 0.08, 0.32)), f.clone().add(V(-0.05, 0.05, -0.08)), 36, 34, lin); },
    ],
  };

  // ================================================================ 11  sister starts recording
  const recT0 = D.byId[11] ? D.byId[11].we + 0.08 : 0;
  S[11] = {
    cuts: ctx => [ctx.find(/^starts/i, 0.5) + 0.2],
    groups: [[0], [1]],
    setup(ctx) {
      D.table(ctx.t, { eat: false }); D.dadFork(0, true); dad.face({ eyes: 'wide', mouth: 'o', open: 0.5 });
      const a0 = ctx.find(/^your/i, 0.1) + 0.1, a1 = ctx.find(/^starts/i, 0.4) + 0.3;
      const rec = ctx.t >= recT0 - 0.6;
      D.sisPhone(seg(ctx.lt, a0, a1), rec, ctx.t);
      sis.face({ eyes: 'squint', mouth: 'grin', brows: 'raised' });
      D.collarGlow(0.9, 0.11); dog.face({ eyes: 'half', brows: 'flat' });
      if (ctx.shot.shot === 1) st().viewfinder = { t0: recT0, alpha: 1 };
    },
    shots: [
      faceShot(sis, 1.15, 1.0, { ang: 0.5, ldy: -0.28 }, { ang: 0.45, ldy: -0.28 }, 40, 38),
      (ctx, su) => { const p = props.phone.position.clone(), d = dogHead(); D.move(su, p, d.clone().add(V(0, -0.1, 0)), p.clone().lerp(d, 0.12), d.clone().add(V(0, -0.1, 0)), 38, 36); },
    ],
  };

  // ================================================================ 12  DOG: He blamed me. In front of the whole park.
  S[12] = {
    cuts: ctx => [ctx.find(/^in$/i, 0.45) - 0.05, ctx.find(/^whole/i, 0.75) - 0.05],
    groups: [[0], [1], [2]],
    setup(ctx) {
      D.table(ctx.t, { eat: false }); D.dadFork(0, true); D.sisPhone(1, true, ctx.t); sis.face({ eyes: 'squint', mouth: 'smile' });
      for (const p of [mom, dad]) D.look(p, dogHead());
      const m = dogTalk(ctx, { eyes: 'sad', brows: 'worried', ears: -0.12 });
      dog.aim(dog.pitch, 0.32, 0.15 + 0.05 * m, 0, 0.12);
      const tearT = ctx.find(/^the$/i, 0.75) - 0.05;
      if (ctx.lt > tearT) {
        const u = clamp((ctx.lt - tearT) / 1.0);
        dog.root.updateMatrixWorld(true);
        const e = dog.eyes[0].g.getWorldPosition(V(0, 0, 0)), fwd = facing(dog.root.rotation.y);
        fx.drop(e.clone().addScaledVector(fwd, 0.035).add(V(0, -0.05 - 0.18 * u, 0)), 0.05, { opacity: 1 - u * u * u });
      }
      if (ctx.shot.shot === 1) st().viewfinder = { t0: recT0 };
    },
    shots: [
      dogShot(1.15, 0.98, { ang: 0.12, ldy: -0.1 }, { ang: 0.1, ldy: -0.1 }, 38, 36),
      (ctx, su) => { const p = props.phone.position.clone(), d = dogHead(); D.move(su, p, d.clone().add(V(0, -0.1, 0)), p.clone().lerp(d, 0.15), d.clone().add(V(0, -0.1, 0)), 36, 34); },
      dogShot(0.8, 0.7, { ang: -0.12, ldy: -0.04 }, { ang: -0.12, ldy: -0.04 }, 36, 34, lin),
    ],
  };

  // ================================================================ 13  DOG: I have never worn jeans in my life (paw points at YOU's jeans)
  const pawPoint = (k) => { const f = dog.front.L; f.sh.rotation.set(-dog.pitch - 1.25 * k, 0, 0.7 * k); f.wr.rotation.set(-0.5 * k, 0, 0); };
  S[13] = {
    cuts: ctx => [ctx.find(/^never/i, 0.3) + 0.05, ctx.find(/^in$/i, 0.7) + 0.1],
    groups: [[0], [1], [2]],
    setup(ctx) {
      D.table(ctx.t, { eat: false, you: false }); D.dadFork(0, true); D.sisPhone(1, true, ctx.t);
      D.seat(you, 'you', 0.4); D.look(you, dogHead()); you.face({ eyes: 'wide', mouth: 'wavy', brows: 'worried' }); youSweat(ctx.t, 2);
      for (const s of ['L', 'R']) { you.arm[s].sh.rotation.set(-0.25, 0, (s === 'L' ? 1 : -1) * 0.25); you.arm[s].el.rotation.set(-0.4, 0, 0); }
      for (const p of [mom, dad]) D.look(p, dogHead());
      const k = sm(seg(ctx.lt, ctx.find(/^never/i, 0.3) - 0.1, ctx.find(/^never/i, 0.3) + 0.25));
      const m = D.mouth('DOG', ctx.t);
      dog.aim(dog.pitch, 0.3, 0.12 + 0.2 * k, 0.6 * k);
      dog.face({ eyes: 'half', brows: 'flat', open: m * 1.25, look: [0.5 * k, -0.3 * k] });
      dog.earFlop(ctx.t, 0.6 + m, 0); D.collarGlow(0.85 + 0.7 * m, 0.11 + 0.08 * m);
      pawPoint(k);
    },
    shots: [
      dogShot(1.15, 1.0, { ang: 0.1, ldy: -0.1 }, { ang: 0.08, ldy: -0.1 }, 38, 36),
      (ctx, su) => D.move(su, V(1.15, 1.95, -0.6), V(0.9, 0.66, 1.0), V(1.1, 1.88, -0.45), V(0.9, 0.66, 1.0), 48, 46),
      dogShot(1.0, 0.88, { ang: 0.3, ldy: -0.12 }, { ang: 0.26, ldy: -0.12 }, 38, 36),
    ],
  };

  // ================================================================ 14  everyone looks at you
  S[14] = {
    cuts: ctx => [ctx.find(/^at$/i, 0.6) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      D.table(ctx.t, { eat: false }); D.dadFork(0, true);
      const turn = ctx.find(/^looks/i, 0.4);
      const u = sm(seg(ctx.lt, turn - 0.06, turn + 0.1));
      const tgt = vl(dogHead(), head(you), u);
      familyLook(tgt, 1, [mom, dad, sis]);
      D.sisPhone(1, true, ctx.t);
      for (const p of [mom, dad, sis]) p.face({ eyes: u > 0.5 ? 'squint' : 'normal', mouth: 'flat', brows: u > 0.5 ? 'angry' : 'neutral' });
      D.collarGlow(0.9, 0.11);
      dog.aim(dog.pitch, 0.3, 0.05, 0.9 * u); dog.face({ eyes: u > 0.5 ? 'half' : 'normal', brows: 'flat', look: [0.6 * u, 0] });
      you.face({ eyes: 'nervous', mouth: 'wavy', brows: 'worried', twitch: Math.sin(ctx.t * 30) > 0.7 ? 1 : 0 }); youSweat(ctx.t, 3);
      D.look(you, V(-0.2, 1.3, -0.6));
    },
    shots: [
      (ctx, su) => D.move(su, V(1.15, 2.45, 2.35), V(-0.15, 1.05, -0.45), V(1.05, 2.38, 2.2), V(-0.15, 1.08, -0.45), 46, 44),
      (ctx, su) => { const h = head(you); D.move(su, h.clone().add(V(0, 0.04, -0.34)), V(0.0, 1.32, -0.84), h.clone().add(V(0, 0.04, -0.44)), V(0.0, 1.32, -0.84), 72, 68); },
    ],
  };

  // ================================================================ 15  YOU: He's lying! Dogs can't talk! (stands up, panics)
  const youPanic = (ctx, m) => {
    youStanding();
    const t = ctx.t;
    for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; you.arm[s].sh.rotation.set(-2.5 + 0.35 * Math.sin(t * 17 + sx), 0, sx * (0.55 + 0.25 * Math.sin(t * 13 + sx * 2))); you.arm[s].el.rotation.set(-0.5 - 0.3 * Math.sin(t * 15 + sx), 0, 0); }
    you.spine.rotation.x = -0.08; you.body.position.y = 0.02 * Math.abs(Math.sin(t * 16));
    you.face({ eyes: 'wide', brows: 'worried', mouth: 'open', open: 0.35 + m * 1.1 });
    const h = head(you);
    for (let k = 0; k < 5; k++) { const ph = (t * 2.2 + k * 0.2) % 1, ang = k * 1.26; fx.drop(h.clone().add(V(Math.cos(ang) * (0.22 + ph * 0.35), 0.12 + ph * 0.25 - ph * ph * 0.5, Math.sin(ang) * (0.22 + ph * 0.35))), 0.08, { opacity: 1 - ph }); }
  };
  const chairBack = () => { const ch = Wd.chairs.you; ch.position.set(TABLE.seat.you.x + 0.1, 0, TABLE.seat.you.z + 0.62); ch.rotation.set(-0.3, Math.PI, 0); };
  S[15] = {
    cuts: ctx => [ctx.find(/^dogs/i, 0.5) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      D.table(ctx.t, { eat: false, you: false }); D.dadFork(0, true); D.sisPhone(1, true, ctx.t);
      youPanic(ctx, D.mouth('YOU', ctx.t));
      chairBack();
      familyLook(head(you)); for (const p of [mom, dad, sis]) p.face({ eyes: 'squint', mouth: 'flat', brows: 'neutral' });
      D.collarGlow(0.9, 0.11); dog.aim(dog.pitch, 0.3, 0.05, 0.9); dog.face({ eyes: 'half', brows: 'flat', look: [0.6, 0.1] });
      st().arcs = { world: head(you), strength: 1.1, r: 160 };
      st().shakeAmt = Math.max(st().shakeAmt, 8);
    },
    shots: [
      (ctx, su) => D.move(su, V(0.3, 1.5, -0.95), V(0.62, 1.48, 1.18), V(0.32, 1.5, -0.78), V(0.62, 1.5, 1.18), 48, 46, eo),
      faceShot(you, 1.15, 1.0, { ang: 0.1, ldy: -0.1 }, { ang: 0.08, ldy: -0.1 }, 40, 38, eo),
    ],
  };

  // ================================================================ 16-20 after the panic: YOU stands frozen
  const afterPanic = (ctx) => {
    D.table(ctx.t, { eat: false, you: false }); D.dadFork(0, true); D.sisPhone(1, true, ctx.t);
    chairBack();
    youStanding(); you.face({ eyes: 'wide', mouth: 'o', open: 0.4, brows: 'worried' });
    for (const s of ['L', 'R']) { const sx = s === 'L' ? 1 : -1; you.arm[s].sh.rotation.set(-1.9, 0, sx * 0.5); you.arm[s].el.rotation.set(-0.6, 0, 0); }
    youSweat(ctx.t, 1);
  };
  S[16] = {
    cuts: ctx => [ctx.find(/^literally/i, 0.4) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      afterPanic(ctx);
      familyLook(dogHead()); for (const p of [mom, dad, sis]) p.face({ eyes: 'normal', mouth: 'flat' });
      D.collarGlow(1, 0.12);
      const b0 = ctx.we - 0.3;
      const blink = ctx.lt < b0 ? 0 : ctx.lt < b0 + 0.38 ? sm((ctx.lt - b0) / 0.38) : ctx.lt < b0 + 0.55 ? 1 : 1 - sm((ctx.lt - b0 - 0.55) / 0.38);
      dog.aim(dog.pitch, 0.3, 0.0, 0); dog.face({ eyes: 'half', brows: 'flat', blink });
    },
    shots: [
      dogShot(1.6, 1.4, { ang: 0.0, ldy: -0.12 }, { ang: 0.0, ldy: -0.12 }, 38, 36, lin),
      dogShot(0.82, 0.7, { ang: 0.0, ldy: -0.03 }, { ang: 0.0, ldy: -0.03 }, 34, 32, lin),
    ],
  };

  // ================================================================ 17  Then Mom puts down her spoon
  S[17] = {
    cuts: ctx => [ctx.find(/^down/i, 0.5) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      afterPanic(ctx);
      const u = sm(seg(ctx.lt, ctx.find(/^puts/i, 0.3) - 0.1, ctx.dur * 0.72));
      D.momSpoon(u, ctx.t);
      mom.face({ eyes: ctx.lt > ctx.dur * 0.76 ? 'closed' : 'normal', mouth: 'flat' });
      D.look(mom, ctx.lt > ctx.dur * 0.6 ? head(you) : V(0.55, 0.8, -0.36), 0.8);
      D.collarGlow(1, 0.12); dog.face({ eyes: 'half', brows: 'flat' });
    },
    shots: [
      faceShot(mom, 1.1, 0.95, { ang: -0.22, ldy: -0.2 }, { ang: -0.2, ldy: -0.2 }, 38, 36),
      (ctx, su) => { const s = TABLE.seat.mom; const c = V(s.x + 0.14, 0.8, s.z * 0.42 - 0.06); D.move(su, c.clone().add(V(-0.2, 0.42, 0.62)), c, c.clone().add(V(-0.16, 0.36, 0.52)), c, 36, 34); },
    ],
  };

  // ================================================================ 18  MOM: We knew.
  S[18] = {
    cuts: () => [],
    groups: [[0]],
    maxShot: 2,
    setup(ctx) {
      afterPanic(ctx); D.momSpoon(1, ctx.t);
      const m = D.mouth('MOM', ctx.t, 10);
      mom.face({ eyes: 'closed', mouth: m > 0 ? 'open' : 'smile', open: m * 0.3 });
      D.look(mom, head(you), 0.85);
      dad.face({ eyes: 'normal', mouth: 'flat' }); dad.neck.rotation.x = 0.12 * Math.max(0, Math.sin(ctx.lt * 7));
      D.collarGlow(1, 0.12); dog.face({ eyes: 'half', brows: 'flat' });
    },
    shots: [faceShot(mom, 1.0, 0.86, { ang: 0.22, ldy: -0.18 }, { ang: 0.2, ldy: -0.18 }, 38, 36, lin)],
  };

  // ================================================================ 19  MOM: The dog doesn't wear jeans. (sips tea)
  S[19] = {
    cuts: ctx => [ctx.find(/^wear/i, 0.5) - 0.05],
    groups: [[0], [1]],
    setup(ctx) {
      afterPanic(ctx); D.momSpoon(1, ctx.t);
      const u = sm(seg(ctx.lt, ctx.find(/^doesn/i, 0.4), ctx.we + 0.15));
      D.momCup(u);
      const m = D.mouth('MOM', ctx.t, 10);
      mom.face({ eyes: 'closed', mouth: m > 0 && u < 0.85 ? 'open' : 'smile', open: m * 0.3 });
      D.look(mom, head(you), 0.6 * (1 - u));
      D.collarGlow(1, 0.12); dog.aim(dog.pitch, 0.3, 0.1, -0.5); dog.face({ eyes: 'happy', smile: true });
    },
    shots: [
      faceShot(mom, 1.2, 1.05, { ang: 0.28, ldy: -0.22 }, { ang: 0.25, ldy: -0.22 }, 38, 36),
      faceShot(mom, 1.1, 1.0, { ang: -0.45, ldy: -0.18 }, { ang: -0.42, ldy: -0.18 }, 38, 36, lin),
    ],
  };

  // ================================================================ 20  the dog high-fives Mom (slow motion, sparkles)
  const hf = D.byId[20];
  D.highFiveT = hf ? hf.start + hf.dur * 0.6 : 0;
  const HFP = V(1.08, 1.5, -0.5);
  S[20] = {
    cuts: ctx => [ctx.dur * 0.34],
    groups: [[0], [1]],
    maxShot: 2.2,
    setup(ctx) {
      afterPanic(ctx); D.momSpoon(1, ctx.t);
      const contact = D.highFiveT - hf.start;
      const u = ctx.lt < contact ? eo(seg(ctx.lt, 0.1, contact)) : 1;
      const f = dog.front.R;
      f.sh.rotation.set(-dog.pitch - 2.35 * u, 0, -0.55 * u); f.wr.rotation.set(-1.0 * u, 0, 0);
      dog.aim(dog.pitch - 0.08 * u, 0.3, 0.05, -0.6 * u); dog.face({ eyes: ctx.lt > contact ? 'happy' : 'normal', smile: true, tongue: ctx.lt > contact });
      dog.earFlop(ctx.t, 0.6, 0.15 * u);
      const hp = vl(head(mom).add(V(0.2, -0.3, 0.2)), HFP.clone().add(V(-0.02, 0, 0)), u);
      reach(mom, 'L', hp, V(1, -0.6, 0)); handDir(mom, 'L', V(0.35, 1, 0.1), V(1, 0, 0.3));
      mom.face({ eyes: ctx.lt > contact ? 'happy' : 'normal', mouth: 'smile' });
      D.look(mom, HFP, 0.8);
      D.collarGlow(1, 0.12);
      for (const p of [dad, sis]) D.look(p, HFP, 0.8);
      const cp = dog.pawWorld('R').lerp(mom.handWorld('L'), 0.5); D.hfp = cp;
      if (ctx.lt > contact) {
        const k = clamp((ctx.lt - contact) / 0.9);
        burst(cp, k, { n: 14, r: 0.6, size: 0.12 });
        sparkles(cp, ctx.t, { n: 6, r: 0.25, size: 0.08, y: 0.0, seed: 5, opacity: 1 - k * 0.6 });
        st().flash = Math.max(0, 0.45 * (1 - (ctx.lt - contact) / 0.12));
      } else st().speed = 0.35 * seg(ctx.lt, contact - 0.6, contact);
    },
    shots: [
      (ctx, su) => D.move(su, V(1.15, 2.35, 1.3), V(1.0, 1.2, -0.45), V(1.12, 2.3, 1.15), V(1.0, 1.22, -0.45), 46, 44, lin),
      (ctx, su) => { const c = D.hfp || HFP, a = -0.35 + 0.45 * su; D.setCam(c.clone().add(V(Math.sin(a) * 1.45, 0.05, Math.cos(a) * 1.45)), c.clone().add(V(0, -0.12, 0)), 42); },
    ],
  };

  // ================================================================ 21  ...you're the one who sleeps outside (rain); the dog sleeps in YOUR bed; fade out
  const inKennel = (ctx) => {
    you.root.visible = true; you.at(SET.yard.x + DOGHOUSE.x, DOGHOUSE.z - 0.3, Math.PI);
    you.body.position.y = 0.2 - you.hipY + 0.02;
    for (const s of ['L', 'R']) { const l = you.leg[s]; l.hp.rotation.set(-2.25, 0, (s === 'L' ? 1 : -1) * 0.08); l.kn.rotation.x = 2.65; }
    you.spine.rotation.x = 0.42;
    you.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) { const kn = you.leg[s].kn.getWorldPosition(V(0, 0, 0)); reach(you, s, kn.add(V(0, 0.05, 0.05)), V(s === 'L' ? 0.6 : -0.6, -1, 0)); }
    you.face({ eyes: 'normal', brows: 'worried', mouth: 'frown', tears: 0.4 + 0.2 * Math.sin(ctx.t * 2) });
    you.neck.rotation.x = -0.3;
    for (let k = 0; k < 4; k++) { const ph = (ctx.t * 1.3 + k * 0.27) % 1; fx.drop(V(SET.yard.x + DOGHOUSE.x - 0.45 + k * 0.3, 1.32 - ph * 1.25, DOGHOUSE.z - 1.0), 0.06, { opacity: 0.9 * (1 - ph) }); }
  };
  const dogInBed = (ctx) => {
    dog.root.visible = true; dog.at(SET.yard.x + BED.x - 0.02, BED.z + 0.2, 0.0);
    dog.lie(0.5, { n: 1.1, h: 0.75 });
    dog.aim(0, 1.05, 0.6, 0.0, -0.25);
    dog.face({ eyes: 'closed', smile: true });
    dog.collarLight(0.5);
    const h = dogHead();
    for (let k = 0; k < 3; k++) { const ph = (ctx.t * 0.55 + k / 3) % 1; fx.icon('z', h.clone().add(V(0.3 + ph * 0.2, 0.22 + ph * 0.4, -0.1)), 0.075 + 0.05 * ph, { opacity: Math.sin(Math.PI * ph) }); }
    fx.glow(dog.ledWorld(), 0.09, 0x3dff6a, 0.4);
  };
  S[21] = {
    cuts: ctx => [ctx.find(/^you're/i, 0.3) - 0.02, ctx.we + 0.12, ctx.we + 1.3],
    groups: [[0], [1], [2], [3]],
    maxShot: 2.2,
    setup(ctx) {
      D.yardLight(ctx.t);
      inKennel(ctx); dogInBed(ctx);
    },
    shots: [
      (ctx, su) => D.move(su, yd(-1.9, 1.85, 1.5), yd(1.0, 0.85, 3.7), yd(-1.6, 1.75, 1.65), yd(1.0, 0.85, 3.7), 44, 42, lin),
      faceShot(you, 1.15, 1.0, { ang: 0.15, ldy: -0.3 }, { ang: 0.12, ldy: -0.3 }, 40, 38, lin),
      (ctx, su) => { st().blue = 0.25; st().warm = 0.7; D.move(su, yd(0.18, 1.5, -2.75), yd(0.08, 0.92, 0.6), yd(0.12, 1.38, -2.25), yd(0.08, 0.95, 0.6), 40, 38, lin); },
      (ctx, su) => { const h = head(you); D.move(su, h.clone().add(V(-0.15, 0.1, -1.6)), h.clone().add(V(0, -0.1, 0)), h.clone().add(V(-0.7, 0.9, -4.2)), h.clone().add(V(0, -0.2, 0)), 38, 44, sm); },
    ],
  };

  for (const id of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14]) { const f = S[id].setup; S[id].setup = (ctx) => { chairReset(); f(ctx); }; }
  return S;
}

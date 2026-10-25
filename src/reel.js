import * as THREE from 'three';
import { Compositor } from './post.js';
import { buildCity, buildSinai, buildBedroom, buildUpperRoom, buildVoid, PAL, lerpPal, Pillar, Birds, halo, motes, rock } from './env.js';
import { Character, blendPose, solveArms, blinkAt } from './chars.js';
import { POSES } from './poses.js';
import { MODERN, DOUBTER, MOSES, THOMAS, JESUS, DISCIPLES, israelites } from './cast.js';
import { Overlays } from './overlay.js';
import { clamp, lerp, ramp, smooth, easeInOut, easeOut, easeIn, keys, fbm, hash, noise1, bump, mulberry32 } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');

export class Reel {
  constructor(T, script) { this.T = T; this.script = script; }

  // time of a word in a line (first match), or the line's first word
  w(id, text, which = 's') {
    const L = this.T.lines.find((l) => l.id === id);
    if (!text) return L.words[0][which];
    const k = L.words.find((x) => norm(x.text) === norm(text));
    if (!k) throw new Error(`word ${text} not in ${id}`);
    return k[which];
  }
  lastWord(id) { const L = this.T.lines.find((l) => l.id === id); return L.words[L.words.length - 1].e; }

  async init() {
    this.comp = new Compositor(document.getElementById('gl'));
    const logo = (await fetch('assets/grace-in-motion-pfp.png', { method: 'HEAD' }).then((r) => r.ok).catch(() => false)) ? 'assets/grace-in-motion-pfp.png' : 'assets/logo-placeholder.svg';
    this.logoUrl = logo;
    await new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = logo; });

    // ---- worlds + cast
    this.city = buildCity();
    this.modern = MODERN.map((s) => this.city.addChar(new Character({ ...s, res: 1050 })));
    const cityPos = [[-3.4, 0.6], [-2.5, 1.6], [-1.95, 1.95], [-0.5, 1.2], [2.25, 1.4], [1.55, 0.4], [0.25, 0.0], [2.95, 0.1], [-1.3, 0.2], [0.95, 1.8], [3.6, 1.9]];
    this.cityFace = [1, 1, 1, -1, -1, 1, -1, -1, 1, -1, -1];
    this.modern.forEach((c, i) => c.group.position.set(cityPos[i][0], 0, cityPos[i][1]));
    this.cityHome = cityPos;
    this.cityBirds = new Birds(9, '#3a2a28'); this.city.scene.add(this.cityBirds.group);
    this.skyLight = new THREE.Group(); // strings for the puppet scene
    this.strings = [];
    const strMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.12, 1.05), fog: false });
    for (let i = 0; i < this.modern.length * 2; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 4), strMat); m.visible = false; this.city.scene.add(m);
      const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 4), strMat); m2.visible = false; this.city.scene.add(m2);
      this.strings.push([m, m2]);
    }

    this.sinai = buildSinai();
    this.isr = israelites(26, 7).map((s) => this.sinai.addChar(new Character({ ...s, res: 460 })));
    const r = mulberry32(31);
    this.isrHome = this.isr.map((c, i) => { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 7.5; return [Math.cos(a) * rr * 1.3 + 2, -22 + Math.sin(a) * rr * 0.75]; });
    this.moses = this.sinai.addChar(new Character({ ...MOSES, h: 1.08, res: 640 }), -5, -33);
    this.mosesRock = rock(77, 0.9, '#7a5440'); this.mosesRock.scale.set(1.3, 0.55, 1.1); this.mosesRock.position.set(-5, -0.05, -33); this.sinai.scene.add(this.mosesRock);
    this.sinaiBirds = new Birds(5, '#3a2420'); this.sinai.scene.add(this.sinaiBirds.group);

    this.bed = buildBedroom();
    this.doubter = this.bed.addChar(new Character(DOUBTER), -1.42, 0.15);
    this.bedPillar = new Pillar(0.55, 9, 110); this.bedPillar.group.position.set(-1.25, 0, 0.15); this.bed.scene.add(this.bedPillar.group);
    this.bedMotes = motes(80, [2.2, 3.2, 2.2]); this.bedMotes.position.set(-1.25, 1.6, 0.15); this.bed.scene.add(this.bedMotes);

    this.upper = buildUpperRoom();
    this.thomas = this.upper.addChar(new Character({ ...THOMAS, res: 1300 }), -0.72, 0.35);
    this.jesus = this.upper.addChar(new Character({ ...JESUS, res: 1300, glow: null }), 0.72, 0.2);
    this.disciples = DISCIPLES.map((s, i) => this.upper.addChar(new Character(s), [-0.9, 0.55, 1.55][i], [-2.35, -2.5, -2.3][i]));
    this.jHalo = halo(2.6); this.upper.scene.add(this.jHalo);
    this.upMotes = motes(70, [5, 3, 3], new THREE.Color(1.1, 0.85, 0.55)); this.upMotes.position.set(0, 1.5, -0.5); this.upper.scene.add(this.upMotes);
    this.upPillar = new Pillar(0.7, 9, 60); this.upPillar.group.position.set(0.72, 0, 0.2); this.upper.scene.add(this.upPillar.group);

    this.void = buildVoid();
    this.skyPillar = new Pillar(1.8, 60, 0); // unused placeholder keeps API symmetric

    // ---- timeline
    const L = this.T.lines, first = (id) => this.w(id);
    const cut = (id) => first(id) - 0.22;
    this.outroT0 = this.T.voice_end;
    this.total = this.T.total;
    const S = [
      { id: 'A', lines: 'S1–S2', t0: 0, world: this.city, fn: this.shotA, dis: 0 },
      { id: 'C', lines: 'S3', t0: cut('S3'), world: this.sinai, fn: this.shotC, dis: 0.55 },
      { id: 'D', lines: 'S4', t0: cut('S4'), world: this.sinai, fn: this.shotD, dis: 0.35 },
      { id: 'E', lines: 'S5', t0: cut('S5'), world: this.sinai, fn: this.shotE, dis: 0.35 },
      { id: 'F', lines: 'S6', t0: cut('S6'), world: this.sinai, fn: this.shotF, dis: 0.3 },
      { id: 'G', lines: 'S7', t0: cut('S7'), world: this.sinai, fn: this.shotG, dis: 0.35 },
      { id: 'H', lines: 'S8', t0: cut('S8'), world: this.city, fn: this.shotH, dis: 0.16 },
      { id: 'I', lines: 'S9', t0: cut('S9'), world: this.city, fn: this.shotI, dis: 0.25 },
      { id: 'J', lines: 'S10', t0: cut('S10'), world: this.city, fn: this.shotJ, dis: 0.22 },
      { id: 'K', lines: 'S11', t0: cut('S11'), world: this.city, fn: this.shotK, dis: 0.22 },
      { id: 'L', lines: 'S12–S13', t0: cut('S12') - 0.1, world: this.bed, fn: this.shotL, dis: 0.9 },
      { id: 'M', lines: 'S14–S15', t0: cut('S14'), world: this.upper, fn: this.shotM, dis: 0.55 },
      { id: 'N', lines: 'S16', t0: cut('S16'), world: this.city, fn: this.shotN, dis: 0.6 },
      { id: 'O', lines: 'S17–S18', t0: cut('S17'), world: this.void, fn: this.shotO, dis: 0.55 },
      { id: 'P', lines: 'S19', t0: this.outroT0, world: this.void, fn: this.shotP, dis: 0.3 },
    ];
    S.forEach((s, i) => { s.t1 = i < S.length - 1 ? S[i + 1].t0 : this.total + 1; });
    this.shots = S;

    // ---- overlays
    this.ov = new Overlays(this.T, logo);
    const P = (o) => this.ov.addPill(o);
    P({ text: 'MOUNT SINAI · EXODUS 20', t0: this.w('S4', 'fire') - 0.1, t1: S[3].t0 - 0.05, at: [80, 600], shot: 'D', anchor: () => this.sinai.summit.clone().add(V(0, 2, 0)) });
    P({ text: 'THEY STOOD AFAR OFF · EXODUS 20:18', t0: this.w('S5', 'away') - 0.35, t1: S[4].t0 + 0.05, at: [0, 1372], center: true, shot: 'E' });
    P({ text: 'THE CALF, AND THE DANCING · EXODUS 32:19', t0: this.w('S6', 'dancing') - 0.1, t1: S[5].t0 + 0.4, at: [0, 1372], center: true, shot: 'F' });
    P({ text: 'NO LOVE LEFT', t0: this.w('S10', 'love') - 0.05, t1: S[9].t0 + 0.05, at: [0, 1372], center: true, shot: 'J' });
    P({ text: 'BEHOLD MY HANDS · JOHN 20:27', t0: this.w('S14', 'scars') - 0.2, t1: this.w('S14', 'then') - 0.1, at: [0, 1372], center: true, shot: 'M' });

    this.events = this.buildEvents();
    this.cams = {};
  }

  // ------------------------------------------------------------------ helpers
  face(c, worldX, cam) { // dir from a world-space facing (+1 = +x)
    const right = V(1, 0, 0).applyQuaternion(cam.quaternion);
    return Math.sign(worldX * right.x + 1e-6);
  }
  cam(world, t, k, fov, shake = 0.012) { // k = keyframes [[t,[px,py,pz,tx,ty,tz]]]
    const v = keys(t, k);
    const d = Math.hypot(v[0] - v[3], v[1] - v[4], v[2] - v[5]);
    const a = shake * d;
    world.look([v[0] + fbm(t * 0.22, 1) * a, v[1] + fbm(t * 0.2, 2) * a, v[2]], [v[3] + fbm(t * 0.17, 3) * a * 0.6, v[4] + fbm(t * 0.19, 4) * a * 0.6, v[5]], typeof fov === 'number' ? fov : keys(t, fov));
    return d;
  }
  drawChars(world, chars, cam, opts = {}) { for (const [c, pose, o] of chars) { c.visible = true; c.update(pose, cam, { ...opts, ...o }); } }

  // ------------------------------------------------------------------ shots
  // A: S1–S2  dusk rooftop, crowd looking up at an empty sky; pull back to the whole city, "?" rises
  shotA(t, lt) {
    const w = this.city;
    w.setPalette(PAL.duskCity);
    w.winU.uLit.value = PAL.duskCity.lit; w.winU.uTime.value = t;
    w.skyU.burstI.value = 0;
    const s2 = this.w('S2') - 0.25;
    const k = [
      [0, [0.45, 0.75, 12.6, 0.0, 2.3, -6]],
      [s2, [0.15, 0.85, 11.4, 0.0, 2.45, -6]],
      [s2 + 1.4, [2.2, 4.0, 19, 0, 1.4, -4]],
      [s2 + 4.6, [10, 19, 48, -1.0, 1.0, -14]],
    ];
    this.cam(w, t, k, [[0, 36], [s2, 36], [s2 + 4.6, 38]], 0.008);
    const cam = w.camera;
    w.aimSun(V(0, 0, 0), 14, 50);
    // crowd: look up, phones up, child holds mother's hand, everyone breathes/blinks
    const chars = this.modern.map((c, i) => {
      c.group.position.set(this.cityHome[i][0], 0, this.cityHome[i][1]);
      const dir = this.face(c, this.cityFace[i], cam);
      const sd = i * 17 + 3;
      let p;
      if (c.spec.props?.phone) p = POSES.phoneUp(t, sd, { dir, tilt: 0.5 });
      else if (i === 1) p = POSES.holdHand(t, sd, { dir });
      else if (i === 3) p = POSES.point(t, sd, { dir, brow: 'worried' });
      else p = POSES.lookUp(t, sd, { dir, tilt: 0.42 + hash(i) * 0.25, brow: ['awe', 'worried', 'neutral', 'doubt'][i % 4] });
      return [c, p, {}];
    });
    this.drawChars(w, chars, cam);
    this.cityBirds.update(t, V(-60, 34, -70), V(9, 0.4, 1.5), 8, 1.2);
    this.hideStrings();
    // "?" floats up from the crowd during S2
    const qa = this.w('S2') + 0.3;
    const qk = Math.min(smooth(ramp(t, qa, qa + 0.5)), 1 - smooth(ramp(t, this.w('S2', 'right') - 0.2, this.w('S2', 'right') + 0.6)));
    const qp = V(0.2, 2.6 + easeOut(ramp(t, qa, qa + 3.5)) * 3.2, 0.6).project(cam);
    this.q = { pos: [(qp.x * 0.5 + 0.5) * 1080, (-qp.y * 0.5 + 0.5) * 1920], k: qk };
    return { grade: { sat: 0.95, con: 1.02, exp: 1.0, tint: [1.03, 0.99, 0.93] }, dof: { focus: 10, range: 30, blur: lt < s2 ? 3 : 0 }, bloom: 0.45 };
  }

  // C: S3  match-cut to the Sinai crowd looking up; crane to reveal the huge mountain
  shotC(t, lt) {
    const w = this.sinai;
    this.sinaiBase(t);
    const t1 = this.shots[2].t0 - this.shots[1].t0;
    this.cam(w, lt, [[0, [16, 19, 30, 1.0, 1.0, -26]], [t1 + 0.4, [9, 1.9, -2, -6, 11.7, -100.8]]], [[0, 38], [t1, 44]], 0.01);
    w.aimSun(V(0, 0, -24), 30, 80);
    this.israelitesDo(t, (c, i, dir) => POSES.lookUp(t, i * 7, { dir, tilt: 0.45 + hash(i) * 0.2, brow: i % 3 ? 'awe' : 'worried' }));
    this.mosesDo(t, (dir) => POSES.staffRaise(t, 5, { dir }), 1);
    this.smoke(t, 0.7); this.fire(t, 0.25); this.bolts(t, []);
    return { grade: { sat: 0.95, con: 1.03, tint: [1.02, 0.97, 0.92] }, dof: { blur: 0 }, bloom: 0.5 };
  }

  // D: S4  fire + smoke + lightning on the summit, a whole nation at the base
  shotD(t, lt) {
    const w = this.sinai;
    this.sinaiBase(t);
    this.cam(w, lt, [[0, [12, 3.2, 4, -4.3, 8.8, -95]], [5, [10.5, 3.0, 1, -5, 9.0, -98]]], 44, 0.01);
    w.aimSun(V(0, 0, -24), 30, 80);
    const flashes = [this.w('S4', 'fire') + 0.05, this.w('S4', 'voice') - 0.1, this.w('S4', 'voice') + 0.35];
    this.isrFlinch = flashes;
    this.israelitesDo(t, (c, i, dir) => {
      const fl = flashes.reduce((m, f) => Math.max(m, bump(t, f, f + 0.6)), 0);
      const base = POSES.lookUp(t, i * 7, { dir, tilt: 0.42 + hash(i) * 0.2, brow: fl > 0.3 ? 'fear' : 'awe', mouth: fl > 0.3 ? 'o' : null });
      return i % 4 === 0 ? blendPose(base, POSES.standAfar(t, i * 7, { dir }), fl * 0.8) : base;
    });
    this.mosesDo(t, (dir) => POSES.staffRaise(t, 5, { dir }), 1);
    this.smoke(t, 1); this.fire(t, 1); const f = this.bolts(t, flashes);
    return { grade: { sat: 1.0, con: 1.05, tint: [1.04, 0.96, 0.9] }, dof: { blur: 0 }, bloom: 0.65, flash: f * 0.32 };
  }

  // E: S5  they shrink back and walk away
  shotE(t, lt) {
    const w = this.sinai;
    this.sinaiBase(t);
    this.cam(w, lt, [[0, [11, 2.2, -1, -5.1, 9.2, -99.7]], [4, [10.2, 2.3, -2.6, -5.6, 9.4, -101]]], 40, 0.012);
    w.aimSun(V(5, 0, -20), 22, 70);
    const tw = this.w('S5', 'ran') - 0.4;
    this.israelitesDo(t, (c, i, dir0) => {
      const start = tw + hash(i) * 0.5 - 0.6;
      const u = ramp(t, start, start + 0.5);
      const away = this.face(c, 1, w.camera);
      const back = POSES.standAfar(t, i * 7, { dir: dir0 });
      const walking = POSES.walk(t, i * 7, { dir: away, freq: 1.7, brow: 'fear' });
      walking.head.tilt = 0.12;
      const sp = Math.max(0, t - start) * 1.1;
      c.group.position.x += sp * 0.9; c.group.position.z += sp * 0.25;
      return u < 1 ? blendPose(back, walking, smooth(u)) : walking;
    }, true);
    this.mosesDo(t, (dir) => POSES.staffRaise(t, 5, { dir }), 1);
    this.smoke(t, 1); this.fire(t, 1);
    const f = this.bolts(t, [this.shots[3].t0 + 0.25]);
    return { grade: { sat: 0.96, con: 1.05, tint: [1.03, 0.96, 0.9] }, dof: { focus: 16, range: 40, blur: 4 }, bloom: 0.6, flash: f * 0.25 };
  }

  // F: S6  time-lapse sun arc, then dancing round the golden calf
  shotF(t, lt) {
    const w = this.sinai;
    const tl = 1.9; // time-lapse length
    const u = clamp(lt / tl);
    // a full day: dusk -> night -> dawn -> noon -> back to late afternoon
    const pals = [PAL.sinai, PAL.sinaiNight, PAL.sinai, PAL.sinaiDay, PAL.sinai];
    const seg = u * (pals.length - 1), si = Math.min(pals.length - 2, Math.floor(seg));
    const pal = lerpPal(pals[si], pals[si + 1], seg - si);
    const ang = u * Math.PI * 2 + 0.6;
    pal.sunDir = [Math.cos(ang) * 0.9, Math.max(0.12, Math.sin(ang + 0.5) * 0.9 + 0.2), -0.35];
    this.sinaiBase(t, lt < tl ? pal : PAL.sinai);
    this.cam(w, lt, [[0, [62, 19, 30, 30, 1, -14]], [tl - 0.2, [58, 17, 26, 31, 1, -12]], [tl + 1.6, [44, 5.2, 12, 34, 2.4, -6]], [4.6, [42, 4.8, 9.5, 34, 2.6, -6]]], [[0, 40], [tl, 40], [tl + 1.6, 36]], 0.008);
    w.aimSun(V(34, 0, -6), lt < tl ? 50 : 16, 80);
    this.danceAround(t, lt > tl - 0.4 ? 1 : 0, false);
    this.smoke(t, 0.6); this.fire(t, 0.3); this.bolts(t, []);
    this.sinai.calfLight.intensity = 6;
    return { grade: { sat: 1.02, con: 1.04, tint: [1.04, 0.98, 0.9] }, dof: { focus: 9, range: 18, blur: lt > tl ? 3.5 : 0 }, bloom: 0.55 };
  }

  // G: S7  slow push-in on the calf, the palette drains to grey
  shotG(t, lt) {
    const w = this.sinai;
    this.sinaiBase(t);
    this.cam(w, lt, [[0, [42, 4.8, 9.5, 34, 2.7, -6]], [3.4, [40.2, 4.0, 4.6, 34, 3.0, -6]]], [[0, 36], [3.4, 32]], 0.006);
    w.aimSun(V(34, 0, -6), 14, 60);
    const drain = smooth(ramp(lt, 0.4, 2.4));
    this.danceAround(t, 1 - drain * 0.85, true);
    this.smoke(t, 0.6); this.fire(t, 0.3); this.bolts(t, []);
    this.sinai.calfLight.intensity = 6 * (1 - drain * 0.6);
    return { grade: { sat: lerp(1.02, 0.1, drain), con: lerp(1.04, 1.1, drain), exp: lerp(1, 0.92, drain), tint: [lerp(1.04, 0.98, drain), lerp(0.98, 0.98, drain), lerp(0.9, 1.0, drain)] }, dof: { focus: 6.5, range: 10, blur: 6 }, bloom: lerp(0.55, 0.3, drain) };
  }

  // H: S8  night city; a massive blinding light fills the sky
  shotH(t, lt) {
    const w = this.city;
    const b = smooth(ramp(t, this.w('S8', 'imagine'), this.w('S8', 'tonight', 'e')));
    w.setPalette(lerpPal(PAL.nightCity, PAL.blinding, b * 0.85));
    w.winU.uLit.value = lerp(0.62, 0.3, b); w.winU.uTime.value = t;
    w.skyU.burstI.value = b * 1.05; w.skyU.burstSize.value = 1 + b * 1.4;
    w.bulbMat.color.setRGB(2.4 * (1 - b), 1.6 * (1 - b), 0.8 * (1 - b));
    this.cam(w, lt, [[0, [1.8, 0.7, 11.4, -0.4, 5.1, -20]], [3.4, [1.3, 0.68, 10.2, -0.4, 5.3, -20]]], 44, 0.01);
    w.aimSun(V(0, 0, 0), 14, 50);
    const cam = w.camera;
    const chars = this.modern.map((c, i) => {
      c.group.position.set(this.cityHome[i][0], 0, this.cityHome[i][1]);
      const dir = this.face(c, this.cityFace[i], cam);
      const sd = i * 17 + 3;
      const a = POSES.lookUp(t, sd, { dir, tilt: 0.35, brow: 'neutral' });
      if (c.spec.props?.phone) { a.armF = { sh: 2.2, el: 0.4 }; a.phoneUp = 1; }
      const shield = POSES.standAfar(t, sd, { dir });
      shield.face.mouth = 'o';
      return [c, blendPose(a, shield, smooth(ramp(b, 0.35 + hash(i) * 0.3, 0.75 + hash(i) * 0.25))), { tint: [1 + b * 0.25, 1 + b * 0.22, 1 + b * 0.15] }];
    });
    this.drawChars(w, chars, cam);
    this.hideStrings(); this.cityBirds.update(-100, V(0, -100, 0), V(0, 0, 0));
    return { grade: { sat: lerp(0.95, 0.75, b), con: 1.02, exp: lerp(1, 1.08, b), tint: [1.0, 1.0, lerp(1.06, 0.95, b)] }, dof: { blur: 0 }, bloom: lerp(0.5, 0.9, b), bloomThr: lerp(0.85, 1.1, b), shade: 0.15 + b * 0.6 };
  }

  cityLightState(t) { // shared by I/J/K: light strength + grey drain
    const fade = smooth(ramp(t, this.w('S11', 'prison') - 0.2, this.lastWord('S11') + 0.4));
    return { light: 1 - fade, grey: smooth(ramp(t, this.w('S9') + 0.3, this.w('S10', 'fear'))) };
  }

  // I/J/K: kneel, strings descend, fear, strings snap
  puppetScene(t, lt, view) {
    const w = this.city;
    const { light, grey } = this.cityLightState(t);
    const pal = lerpPal(lerpPal(PAL.nightCity, PAL.blinding, 0.85 * light), PAL.greyFear, grey * light * 0.85);
    w.setPalette(pal);
    w.winU.uLit.value = 0.3; w.winU.uTime.value = t;
    w.skyU.burstI.value = 0.9 * light; w.skyU.burstSize.value = 2.2;
    w.bulbMat.color.setRGB(0, 0, 0);
    if (view === 'I') this.cam(w, lt, [[0, [4.2, 2.6, 9.4, 0.2, 1.3, 0]], [2.2, [3.6, 2.3, 8.4, 0.2, 1.25, 0]]], 36, 0.008);
    if (view === 'J') this.cam(w, lt, [[0, [1.7, 1.45, 8.4, -0.1, 0.95, 0.6]], [3, [1.45, 1.4, 7.6, -0.15, 0.95, 0.6]]], 32, 0.006);
    if (view === 'K') this.cam(w, lt, [[0, [3.4, 2.6, 9.0, 0.1, 1.5, 0]], [4.2, [5.2, 4.2, 13.5, 0.2, 1.6, -0.5]]], 36, 0.008);
    w.aimSun(V(0, 0, 0), 14, 50);
    const cam = w.camera;
    const tDrop = this.w('S9') - 0.1, tStr = this.w('S9', 'obey') - 0.25;
    const snapT0 = this.w('S11'), snapT1 = this.w('S11', 'prison') + 0.2;
    const chars = this.modern.map((c, i) => {
      c.group.position.set(this.cityHome[i][0], 0, this.cityHome[i][1]);
      const dir = this.face(c, this.cityFace[i], cam);
      const sd = i * 17 + 3;
      const kd = smooth(ramp(t, tDrop + hash(i) * 0.35, tDrop + 0.35 + hash(i) * 0.35));
      const stand = POSES.standAfar(t, sd, { dir }); stand.face.mouth = 'o';
      const kneelP = POSES.kneelFear(t, sd, { dir });
      let p = blendPose(stand, kneelP, kd);
      p.kneelW = kd;
      const att = smooth(ramp(t, tStr + 0.25 + hash(i + 3) * 0.4, tStr + 0.6 + hash(i + 3) * 0.4));
      const pup = POSES.puppet(t, sd, { dir });
      pup.face.brow = 'fear'; pup.face.mouth = i % 3 === 0 ? 'open' : 'o';
      p = blendPose(p, pup, att);
      const snap = snapT0 + (i / (this.modern.length - 1)) * (snapT1 - snapT0) + (hash(i + 7) - 0.5) * 0.15;
      const freed = smooth(ramp(t, snap, snap + 0.45));
      if (freed > 0) {
        const after = POSES.pray(t, sd, { dir }); after.face.blink = 0; after.face.brow = 'sad'; after.head.tilt = -0.32; after.armF = { sh: 0.35, el: 0.4 }; after.armB = { sh: 0.25, el: 0.45 };
        p = blendPose(p, after, freed);
      }
      p.face.blink = Math.max(p.face.blink || 0, blinkAt(t, sd));
      this.stringState[i] = { att, snap, descend: ramp(t, tStr + hash(i + 3) * 0.4 - 0.2, tStr + 0.3 + hash(i + 3) * 0.4) };
      const tg = 1 + 0.2 * light * (1 - grey);
      return [c, p, { tint: [tg, tg, tg * 0.97] }];
    });
    this.drawChars(w, chars, cam);
    this.updateStrings(t);
    this.cityBirds.update(-100, V(0, -100, 0), V(0, 0, 0));
    const g = grey;
    return { grade: { sat: lerp(0.75, 0.12, g) + (1 - light) * 0.3, con: lerp(1.02, 1.08, g), exp: lerp(1.14, 1.0, g) - (1 - light) * 0.08, tint: [1, 1, lerp(0.96, 1.02, g)] }, dof: view === 'J' ? { focus: 7.6, range: 6, blur: 5 } : { blur: 0 }, bloom: lerp(0.8, 0.5, g) * (0.5 + 0.5 * light), bloomThr: 1.0, shade: 0.2 + 0.45 * light };
  }
  shotI(t, lt) { return this.puppetScene(t, lt, 'I'); }
  shotJ(t, lt) { return this.puppetScene(t, lt, 'J'); }
  shotK(t, lt) { return this.puppetScene(t, lt, 'K'); }

  hideStrings() { for (const [a, b] of this.strings) { a.visible = false; b.visible = false; } }
  updateStrings(t) {
    const top = 26;
    this.modern.forEach((c, i) => {
      const st = this.stringState[i];
      ['wristF', 'wristB'].forEach((wn, k) => {
        const [up, low] = this.strings[i * 2 + k];
        if (!st || st.descend <= 0) { up.visible = low.visible = false; return; }
        const hand = c.worldPoint(wn);
        const tx = hand.x + (k ? -0.02 : 0.02), tz = hand.z;
        const snapU = ramp(t, st.snap + k * 0.04, st.snap + 0.5 + k * 0.04);
        if (snapU <= 0) {
          const bottom = lerp(top, hand.y, easeOut(st.descend));
          setSeg(up, V(tx, top, tz), V(hand.x, bottom, hand.z)); low.visible = false;
        } else { // snapped: upper part whips up, lower part drops and fades
          const brk = hand.y + 1.2;
          setSeg(up, V(tx, top, tz), V(tx, lerp(brk, top, easeIn(snapU)), tz));
          const lowLen = 1.2 * (1 - snapU);
          if (lowLen > 0.02) setSeg(low, V(hand.x + snapU * 0.15, hand.y + lowLen, hand.z), V(hand.x, hand.y, hand.z)); else low.visible = false;
        }
      });
    });
  }

  // L: S12–S13  quiet bedroom; a gentle light pillar finds him
  shotL(t, lt) {
    const w = this.bed;
    const gold = smooth(ramp(t, this.w('S12', 'wants'), this.w('S12', 'found') + 0.6));
    const pal = { ...PAL.bedroom };
    w.setPalette(pal);
    w.lamp.intensity = 1.6;
    const tS13 = this.w('S13');
    this.cam(w, lt, [[0, [3.4, 2.4, 6.2, -0.9, 1.05, -0.9]], [tS13 - this.shots[10].t0, [2.7, 1.9, 4.9, -1.1, 0.95, -0.4]], [this.shots[11].t0 - this.shots[10].t0 + 0.4, [2.15, 1.5, 3.9, -1.2, 0.9, -0.1]]], [[0, 36], [8, 34]], 0.006);
    w.aimSun(V(-1, 0, 0), 5, 20);
    const cam = w.camera;
    const dir = this.face(this.doubter, 1, cam);
    const lift = smooth(ramp(t, this.w('S13', 'seek') - 0.2, this.w('S13', 'find') + 0.2));
    const hh = POSES.headInHands(t, 21, { dir });
    const up = POSES.liftHead(t, 21, { dir, brow: 'awe' });
    up.face.blink = blinkAt(t, 21) * 0.9;
    const p = blendPose(solveArms(this.doubter.spec, hh), solveArms(this.doubter.spec, up), lift);
    this.drawChars(w, [[this.doubter, p, { tint: [1 + gold * 0.1, 1 + gold * 0.07, 1 + gold * 0.0], shadow: 0.42 }]], cam);
    const pk = gold * (0.75 + 0.25 * lift);
    this.bedPillar.set(t, pk, 0.2);
    this.bedPillar.pool.material.opacity = pk * 0.32;
    this.bedPillar.beams[1].visible = false;
    this.bedMotes.userData.u.time.value = t; this.bedMotes.userData.u.inten.value = 0.25 + pk * 0.9;
    return { grade: { sat: 0.92, con: 1.04, exp: lerp(0.98, 1.06, gold), tint: [lerp(1.04, 1.1, gold), lerp(0.97, 1.0, gold), lerp(0.92, 0.82, gold)], lift: [0.004, 0.002, 0] }, dof: { focus: Math.hypot(cam.position.x + 1.25, cam.position.z - 0.15), range: 2.5, blur: 6, fg: 4 }, bloom: 0.5 + pk * 0.25, vig: 0.5, shade: 0.25 + pk * 0.25 };
  }

  // M: S14–S15  upper room: Thomas doubts, Jesus shows His hands, Thomas falls to his knees
  shotM(t, lt) {
    const w = this.upper;
    w.setPalette(PAL.upperRoom);
    const fl = 0.85 + 0.15 * noise1(t * 7, 2) + 0.05 * Math.sin(t * 23);
    w.lampLight.intensity = 3.2 * fl;
    w.flame.scale.set(1, 0.9 + 0.2 * noise1(t * 9, 5), 1);
    const t0 = this.shots[11].t0;
    const tScars = this.w('S14', 'scars'), tShow = this.w('S14', 'showed'), tThen = this.w('S14', 'then'), t15 = this.w('S15');
    this.cam(w, t, [
      [t0, [0.1, 1.45, 7.8, 0.0, 1.05, 0]],
      [tScars - 0.25, [0.2, 1.38, 6.6, 0.05, 1.05, 0]],
      [tShow + 0.1, [0.7, 1.28, 4.1, 0.42, 1.22, 0.2]],
      [tThen + 0.1, [-0.05, 1.08, 6.4, 0.0, 0.95, 0.0]],
      [t15 + 0.3, [0.0, 1.02, 6.1, 0.0, 0.92, 0.0]],
      [this.shots[12].t0 + 0.4, [0.1, 0.98, 5.5, 0.0, 0.92, 0.0]],
    ], 34, 0.006);
    w.aimSun(V(0, 0, 0), 6, 20);
    const cam = w.camera;
    const kneelU = smooth(ramp(t, tShow + 0.35, tShow + 1.1));
    const thDir = this.face(this.thomas, 1, cam), jDir = this.face(this.jesus, -1, cam);
    const ca = solveArms(this.thomas.spec, POSES.crossArms(t, 31, { dir: thDir }));
    const doubtLook = blendPose(ca, { ...ca, face: { ...ca.face, brow: 'worried' }, head: { tilt: 0.05 } }, smooth(ramp(t, tScars, tScars + 0.4)));
    const kn = solveArms(this.thomas.spec, POSES.thomasKneel(t, 31, { dir: thDir }));
    const th = blendPose(doubtLook, kn, kneelU);
    th.kneelW = kneelU;
    const jp = POSES.showHands(t, 41, { dir: jDir });
    jp.face.blink = blinkAt(t, 41);
    const glow = 0.75 + 0.25 * smooth(ramp(t, t15, t15 + 1));
    const chars = [[this.thomas, th, {}], [this.jesus, jp, { tint: [1.04, 1.02, 0.97] }]];
    this.disciples.forEach((c, i) => {
      const d = this.face(c, i === 2 ? -1 : 1, cam);
      const p = POSES.stand(t, 50 + i, { dir: d, brow: 'awe' });
      p.head.tilt = 0.05;
      chars.push([c, p, { tint: [0.85, 0.8, 0.75] }]);
    });
    this.drawChars(w, chars, cam);
    // warm halo behind Jesus
    const hp = this.jesus.group.position.clone().add(V(0, 1.45, 0));
    this.jHalo.position.copy(hp).addScaledVector(cam.getWorldDirection(V(0, 0, 0)), 0.25);
    this.jHalo.quaternion.copy(cam.quaternion);
    this.jHalo.material.opacity = 0.55 * glow;
    this.upPillar.set(t, 0.35 * glow, 0.8);
    this.upMotes.userData.u.time.value = t; this.upMotes.userData.u.inten.value = 0.35;
    const dJ = cam.position.distanceTo(V(0, 1.1, 0.2));
    return { grade: { sat: 0.95, con: 1.05, exp: 1.02, tint: [1.08, 0.99, 0.86] }, dof: { focus: dJ, range: 2.2, blur: 6.5 }, bloom: 0.55, vig: 0.5, shade: 0.3 };
  }

  // N: S16  dawn over the city; windows light up one by one
  shotN(t, lt) {
    const w = this.city;
    w.setPalette(PAL.dawnCity);
    const tL = this.w('S16', 'light'), tC = this.w('S16', 'choose', 'e');
    w.winU.uLit.value = lerp(0.04, 0.62, smooth(ramp(t, tL - 0.6, tC + 0.4)));
    w.winU.uTime.value = t;
    w.skyU.burstI.value = 0;
    w.bulbMat.color.setRGB(0.6, 0.4, 0.25);
    this.cam(w, lt, [[0, [36, 46, 92, -2, -6, -40]], [5.6, [28, 38, 80, -4, -5, -45]]], 38, 0.006);
    w.aimSun(V(0, 0, 0), 30, 60);
    this.city.hideChars();
    this.hideStrings();
    this.cityBirds.update(t - this.shots[12].t0, V(-50, 30, 10), V(8, 1.2, -2), 9, 1.6);
    return { grade: { sat: 1.0, con: 1.03, exp: 1.04, tint: [1.04, 0.99, 0.95] }, dof: { blur: 0 }, bloom: 0.7, bloomThr: 0.8 };
  }

  // O: S17–S18  ending screen
  shotO(t, lt) {
    const w = this.void;
    w.camera.position.set(0, 0, 5); w.camera.lookAt(0, 0, 0); w.camera.updateMatrixWorld();
    w.voidU.time.value = t;
    const pT = this.w('S17', 'proof'), fT = this.w('S17', 'faith');
    w.voidU.ga.value.setRGB(0.12, 0.14, 0.16).multiplyScalar(smooth(ramp(t, pT, pT + 0.5)));
    w.voidU.gb.value.setRGB(0.42, 0.24, 0.08).multiplyScalar(smooth(ramp(t, fT, fT + 0.5)) * (0.9 + 0.1 * noise1(t * 5, 1)));
    return { grade: { sat: 1, con: 1, exp: 1 }, dof: { blur: 0 }, bloom: 0.4, vig: 0.45 };
  }
  // P: S19  logo outro (dissolves back into the opening shot so the reel loops)
  shotP(t, lt) {
    const w = this.void;
    w.camera.position.set(0, 0, 5); w.camera.lookAt(0, 0, 0); w.camera.updateMatrixWorld();
    w.voidU.time.value = t;
    w.voidU.ga.value.setRGB(0, 0, 0);
    w.voidU.gb.value.setRGB(0.3, 0.2, 0.08).multiplyScalar(bump(lt, 0, 2.2));
    return { grade: { sat: 1, con: 1, exp: 1 }, dof: { blur: 0 }, bloom: 0.5, vig: 0.45 };
  }

  // ------------------------------------------------------------------ Sinai helpers
  sinaiBase(t, pal = PAL.sinai) {
    const w = this.sinai;
    w.setPalette(pal);
    w.calfLight.intensity = 0;
    for (const f of w.flags) { // waving flags
      const pos = f.geometry.attributes.position, base = f.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.setZ(i, Math.sin(x * 5 - t * 7 + f.userData.seed) * 0.12 * x);
        pos.setY(i, base[i * 3 + 1] + Math.sin(x * 3 - t * 5) * 0.03 * x);
      }
      pos.needsUpdate = true;
    }
    for (const p of w.pits) p.scale.set(1, 0.8 + 0.4 * noise1(t * 8, p.id), 1);
    this.sinaiBirds.update(t, V(-80, 30, -60), V(6, 0.3, 1), 10, 1.4);
    w.hideChars();
  }
  israelitesDo(t, fn, keepPos = false) {
    const w = this.sinai, cam = w.camera;
    const list = this.isr.map((c, i) => {
      c.group.position.set(this.isrHome[i][0], 0, this.isrHome[i][1]);
      const toMountain = this.face(c, -1, cam);
      const dir = hash(i + 0.5) < 0.12 ? -toMountain : toMountain; // a few look back at the others
      return [c, fn(c, i, dir), {}];
    });
    this.drawChars(w, list, cam);
  }
  mosesDo(t, fn) {
    const c = this.moses; c.group.position.set(-5, 0.42, -33);
    const dir = this.face(c, 1, this.sinai.camera);
    this.drawChars(this.sinai, [[c, fn(dir), {}]], this.sinai.camera);
  }
  danceAround(t, energy, slow) {
    const w = this.sinai, cam = w.camera;
    const n = 12;
    const list = [];
    for (let i = 0; i < n; i++) {
      const c = this.isr[i];
      const sp = slow ? 0.18 * energy + 0.02 : 0.22;
      const a = (i / n) * Math.PI * 2 + t * sp;
      const rr = 3.7 + (hash(i) - 0.5) * 0.9;
      c.group.position.set(34 + Math.cos(a) * rr, 0, -6 + Math.sin(a) * rr * 0.85);
      const tang = V(-Math.sin(a), 0, Math.cos(a));
      const right = V(1, 0, 0).applyQuaternion(cam.quaternion);
      const dir = Math.sign(tang.dot(right) + 1e-6);
      const d = POSES.dance(t * (slow ? lerp(0.25, 1, energy) : 1), i * 9, { dir });
      const s = POSES.stand(t, i * 9, { dir, brow: 'sad' });
      list.push([c, blendPose(s, d, energy), {}]);
    }
    for (let i = n; i < this.isr.length; i++) { // onlookers around the plaza
      const c = this.isr[i];
      const a = hash(i * 3.1) * Math.PI * 2, rr = 7.5 + hash(i + 2) * 6;
      c.group.position.set(34 + Math.cos(a) * rr * 1.2, 0, -6 + Math.sin(a) * rr);
      const toCalf = Math.sign(V(34 - c.group.position.x, 0, -6 - c.group.position.z).dot(V(1, 0, 0).applyQuaternion(cam.quaternion)) + 1e-6);
      const p = hash(i + 9) < 0.5 ? POSES.dance(t * 0.8, i * 5, { dir: toCalf, freq: 0.9 }) : POSES.point(t, i * 5, { dir: toCalf, tilt: 0.1, brow: 'joy' });
      list.push([c, slow ? blendPose(POSES.stand(t, i, { dir: toCalf, brow: 'sad' }), p, energy) : p, {}]);
    }
    this.drawChars(w, list, cam);
  }
  smoke(t, k) {
    const w = this.sinai, S = w.summit;
    w.smoke.forEach((m, i) => {
      const life = 7 + hash(i) * 3;
      const ph = ((t + hash(i + 1) * life) % life) / life;
      const a = hash(i + 2) * 6.28;
      m.visible = k > 0.01;
      m.position.set(S.x + Math.cos(a) * (2 + ph * 14) + ph * 12, S.y - 2 + ph * 48 * (0.7 + hash(i + 3) * 0.5), S.z + Math.sin(a) * (2 + ph * 10));
      const sc = (2.5 + ph * 11 * (0.7 + hash(i + 4) * 0.6)) * (0.55 + 0.45 * k) * Math.sin(Math.min(1, ph * 6) * Math.PI / 2) * (1 - smooth(ramp(ph, 0.8, 1)) * 0.5);
      m.scale.setScalar(sc);
      m.rotation.set(t * 0.1 + i, t * 0.07 + i * 2, 0);
    });
  }
  fire(t, k) {
    const w = this.sinai, S = w.summit;
    w.fire.forEach((m, i) => {
      const a = hash(i) * 6.28, r = 1 + hash(i + 1) * 5;
      const fl = 0.6 + 0.6 * noise1(t * 6 + i, i);
      m.visible = k > 0.01;
      m.position.set(S.x + Math.cos(a) * r, S.y - 1.5 + fl * 1.2 * k, S.z + Math.sin(a) * r);
      m.scale.set(1.3 * k, (1.5 + fl * 2.2) * k, 1.3 * k);
      m.rotation.y = t * 2 + i;
    });
    w.fireLight.intensity = 900 * k * (0.8 + 0.4 * noise1(t * 8, 4));
  }
  bolts(t, times) {
    const w = this.sinai;
    let flash = 0;
    w.bolts.forEach((b) => (b.visible = false));
    times.forEach((ft, i) => {
      const d = t - ft;
      if (d >= 0 && d < 0.2) {
        const on = d < 0.06 || (d > 0.1 && d < 0.16);
        w.bolts[i % w.bolts.length].visible = on;
        flash = Math.max(flash, on ? 1 : 0.4);
      } else if (d >= 0.2 && d < 0.5) flash = Math.max(flash, 0.4 * (1 - (d - 0.2) / 0.3));
    });
    return flash;
  }

  // ------------------------------------------------------------------ SFX cue list (consumed by tools/audio.py)
  buildEvents() {
    const E = [];
    const ev = (t, type, gain = 1, dur = 0) => E.push({ t: +t.toFixed(3), type, gain, dur });
    const S = this.shots;
    ev(0, 'city_amb', 0.6, this.w('S3') - 0.2);
    ev(S[1].t0 - 0.35, 'whoosh', 0.9);
    ev(S[1].t0, 'rumble', 1.0, S[4].t0 - S[1].t0 + 0.5);
    ev(S[1].t0, 'wind', 0.5, S[6].t0 - S[1].t0);
    for (const ft of [this.w('S4', 'fire') + 0.05, this.w('S4', 'voice') - 0.1, this.w('S4', 'voice') + 0.35, S[3].t0 + 0.25]) ev(ft, 'thunder', 1.0);
    ev(S[2].t0, 'murmur', 0.8, S[4].t0 - S[2].t0 + 1.5);
    ev(S[4].t0, 'timelapse', 0.8, 1.9);
    ev(S[4].t0 + 1.7, 'drums', 0.7, S[6].t0 - S[4].t0 - 1.5);
    ev(S[4].t0 + 1.7, 'murmur', 0.6, S[6].t0 - S[4].t0 - 1.7);
    ev(S[6].t0 - 0.25, 'whoosh', 1.0);
    ev(this.w('S8', 'imagine'), 'swell', 1.0, this.w('S8', 'tonight', 'e') - this.w('S8', 'imagine') + 0.8);
    ev(this.w('S9') - 0.1, 'thud', 0.8);
    ev(this.w('S9', 'obey') - 0.3, 'tension', 0.7, 1.4);
    const snapT0 = this.w('S11'), snapT1 = this.w('S11', 'prison') + 0.2;
    for (let i = 0; i < this.modern.length; i++) ev(snapT0 + (i / (this.modern.length - 1)) * (snapT1 - snapT0) + (hash(i + 7) - 0.5) * 0.15, 'snap', 0.75 + hash(i) * 0.25);
    ev(this.w('S12', 'wants') - 0.1, 'shimmer', 0.9, 2.5);
    ev(this.w('S13') - 0.45, 'paper', 0.9);
    ev(this.w('S15') - 0.45, 'paper', 0.9);
    ev(this.w('S14', 'scars') - 0.3, 'shimmer', 0.5, 1.6);
    ev(this.w('S14', 'showed') + 0.75, 'kneel', 0.7);
    ev(S[12].t0, 'dawn', 0.8, S[13].t0 - S[12].t0);
    ev(S[13].t0 - 0.3, 'whoosh', 0.6);
    ev(this.w('S17', 'proof'), 'chime', 0.7);
    ev(this.w('S17', 'faith'), 'chime2', 0.8);
    const bT = this.w('S18') - 0.1;
    for (let i = 0; i < 'Faith, because…'.length; i++) ev(bT + 0.35 + i * 0.09, 'type', 0.35);
    for (let i = 0; i < 9; i++) ev(bT + 0.9 + i * 0.22, 'heart', 0.4);
    ev(this.outroT0, 'logo', 1.0);
    for (const L of this.T.lines) for (const w of L.words) if (w.hl) ev(w.s, 'pop', 0.45);
    return E.sort((a, b) => a.t - b.t);
  }

  info() {
    const scenes = this.T.lines.map((L) => ({ id: L.id, t0: L.start, still: (L.words[0].s + L.words[L.words.length - 1].e) / 2 + 0.15 }));
    scenes.push({ id: 'S19', t0: this.outroT0, still: this.outroT0 + 1.2 });
    return { total: this.total, events: this.events, scenes, shots: this.shots.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, lines: s.lines })), engine: this.T.engine };
  }

  // ------------------------------------------------------------------ frame
  renderAt(t) {
    this.stringState = this.stringState || [];
    const S = this.shots;
    let i = S.findIndex((s) => t >= s.t0 && t < s.t1);
    if (i < 0) i = S.length - 1;
    const cur = S[i], nxt = S[i + 1];
    let mix = 0, a = cur, b = null;
    // dissolve window is centred on the cut
    if (nxt && nxt.dis > 0 && t > nxt.t0 - nxt.dis / 2) { b = nxt; mix = smooth((t - (nxt.t0 - nxt.dis / 2)) / nxt.dis); }
    else if (cur.dis > 0 && t < cur.t0 + cur.dis / 2 && i > 0) { a = S[i - 1]; b = cur; mix = smooth((t - (cur.t0 - cur.dis / 2)) / cur.dis); }
    // loop: the outro ends back on the opening frame
    let loopMix = 0;
    if (cur.id === 'P') loopMix = smooth(ramp(t, this.total - 0.85, this.total - 0.05));

    this.q = null;
    const look = (shot, which, tt) => {
      const lk = shot.fn.call(this, tt, tt - shot.t0) || {};
      this.comp.setSource(which, shot.world.camera, lk);
      this.comp.renderScene(shot.world.scene, shot.world.camera, which, shot.world);
      this.cams[shot.id] = shot.world.camera.clone();
      return lk;
    };
    let lA, lB = null;
    if (loopMix > 0 && !b) {
      lA = look(cur, 'A', t);
      lB = this.shotA_loop();
      mix = loopMix;
    } else {
      lA = look(a, 'A', t);
      if (b && mix > 0.001) lB = look(b, 'B', t);
      else mix = 0;
    }
    const L = (k, d) => (lB ? lerp(lA[k] ?? d, lB[k] ?? d, mix) : lA[k] ?? d);
    this.shade = L('shade', 0.15);
    this.comp.composite({ mix, bloom: L('bloom', 0.5), bloomThr: L('bloomThr', 0.85), vig: L('vig', 0.38), grain: 0.032, frame: Math.round(t * 30), flash: L('flash', 0) });
    // overlays
    this.ov.qmark(t, this.q ? this.q.pos : [0, 0], this.q ? this.q.k : 0);
    const endT0 = S.find((s) => s.id === 'O').t0;
    this.ov.update(t, {
      cams: this.cams, shade: this.shade,
      end: { t0: endT0 + 0.1, t1: this.outroT0 + 0.05, proofT: this.w('S17', 'proof') - 0.05, faithT: this.w('S17', 'faith') - 0.05, bubbleT: this.w('S18') - 0.1 },
      outro: { t0: this.outroT0, t1: this.total },
    });
    return true;
  }
  shotA_loop() { // opening frame, rendered into slot B
    const A = this.shots[0];
    const lk = A.fn.call(this, 0, 0);
    this.q = null;
    this.comp.setSource('B', A.world.camera, lk);
    this.comp.renderScene(A.world.scene, A.world.camera, 'B', A.world);
    return lk;
  }
}

function setSeg(m, a, b) {
  const L = a.distanceTo(b);
  if (L < 1e-3) { m.visible = false; return; }
  m.visible = true;
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(1, L, 1);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
}

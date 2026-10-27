// The reel's shot list + overlay/sound events, all keyed to the voiceover word timings in timeline.json.
import * as THREE from 'three';
import { lerp, clamp, smooth, easeInOut, easeOut } from './rig.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

export function makePlan(tl, E) {
  // E: engine helpers { cam(pos, look, fov, up), place(obj, scene, x, z, rotY, y) }
  const P = (id) => tl.parts.find((p) => p.id === id);
  const W = (id, key, which = 's', occ = 0) => {
    let n = 0;
    for (const w of P(id).words) if (norm(w.w) === norm(key)) { if (n === occ) return w[which]; n++; }
    console.log('[log] missing word', id, key);
    return P(id).start;
  };
  const PE = (id) => P(id).start + P(id).dur;

  const shots = [];
  const events = [];
  const shot = (t0, set, run) => shots.push({ t0, set, run });
  const sfx = (name, t, gain = 1, pan = 0) => events.push({ type: 'sfx', name, t, gain, pan });
  const chip = (text, color, t0, t1, o = {}) => events.push({ type: 'chip', text, color, t0, t1, ...o });
  const bubble = (text, t0, t1, anchor, o = {}) => events.push({ type: 'bubble', text, t0, t1, anchor, ...o });
  const sticker = (kind, t0, t1, anchor, o = {}) => events.push({ type: 'sticker', kind, t0, t1, anchor, ...o });
  const fx = (kind, t0, t1, fade = 0.08) => events.push({ type: 'fx', kind, t0, t1, fade });
  const flash = (t, dur = 0.3, color = '#fff') => events.push({ type: 'flash', t, dur, color });
  const shake = (t0, t1, amp = 0.01) => events.push({ type: 'shake', t0, t1, amp });

  // camera move helper: interpolate position/target/fov over the shot with easing
  const move = (k, p0, l0, p1, l1, f0 = 45, f1 = f0, up) => {
    const e = easeInOut(k);
    E.cam(p0.clone().lerp(p1, e), l0.clone().lerp(l1, e), lerp(f0, f1, e), up);
  };
  const headOf = (cat, off = V(0, 0, 0)) => cat.headWorld(off);
  // follow a head: camera offset from the head position
  const onHead = (k, cat, o0, o1, f0, f1, lookOff = V(0, 0, 0)) => {
    const h = headOf(cat);
    move(k, h.clone().add(o0), h.clone().add(lookOff), h.clone().add(o1), h.clone().add(lookOff), f0, f1);
  };
  // camera in the head's own frame (+z = in front of the face), looking at the face
  const onFace = (k, cat, o0, o1, f0, f1, look = V(0, -0.012, 0.02)) => {
    const e = easeInOut(k);
    E.cam(cat.headWorld(o0.clone().lerp(o1, e)), cat.headWorld(look), lerp(f0, f1, e));
  };
  const walkPos = (from, to, t, t0, t1) => {
    const k = clamp((t - t0) / (t1 - t0), 0, 1);
    return from.clone().lerp(to, k);
  };
  const above = (cat, dy = 0.075) => () => cat.headWorld(V(0, dy, 0.01));

  // ------------------------------------------------------------------ PART 1: hook (street)
  const p1 = P(1);
  const meowT = W(1, 'other.', 'e') + 0.12;
  shot(0, 'street', (L, D, k, w) => {
    w.street.setMood('day');
    E.place(w.hero, w.street, -0.25, -2.9, Math.PI / 2);
    E.place(w.rival, w.street, 0.27, -2.92, -Math.PI / 2);
    w.hero.update({ t: L + 1, tailLift: 0.4, tailSway: 0.22, earsBack: 0.15 });
    w.rival.update({ t: L + 2.3, tailLift: 0.25, crouch: 0.15, earsBack: 0.2 });
    move(k, V(0.6, 0.19, -1.78), V(0.0, 0.24, -2.92), V(0.44, 0.2, -2.1), V(0.0, 0.25, -2.92), 42, 38);
  });
  shot(W(1, 'meow'), 'street', (L, D, k, w) => {
    E.place(w.hero, w.street, -0.25, -2.9, Math.PI / 2);
    E.place(w.rival, w.street, 0.27, -2.92, -Math.PI / 2);
    w.hero.update({ t: L + 2, tailLift: 0.4 });
    w.rival.update({ t: L + 3, tailLift: 0.25, crouch: 0.15, earsBack: 0.3, headYaw: 0.75, headPitch: 0.03 });
    onFace(k, w.rival, V(0.03, 0.01, 0.31), V(0.02, 0.01, 0.24), 34, 32);
  });
  shot(W(1, 'other.', 'e'), 'street', (L, D, k, w) => {
    const manX = lerp(0.95, 0.42, clamp(L / 1.0, 0, 1));
    E.place(w.man, w.street, manX, -2.78, -Math.PI / 2);
    w.man.update({ t: L, walking: L < 1.0, walkPhase: (1.25 - manX) / 1.25 });
    E.place(w.hero, w.street, -0.2, -2.92, Math.PI / 2 - 0.55 * smooth(L / 0.25));
    E.place(w.rival, w.street, 0.3, -3.05, -Math.PI / 2);
    const look = V(manX, 0.7, -2.78);
    const meowing = L > 0.1 && L < 0.75;
    w.hero.update({ t: L + 3, tailLift: 1.3, tailHook: 0.6, mouth: meowing ? 'open' : 'closed', lookTarget: look, headPitch: meowing ? 0.1 : 0 });
    w.rival.update({ t: L + 4, tailLift: 0.3, lookTarget: look });
    move(k, V(0.45, 0.24, -1.95), V(0.0, 0.36, -2.9), V(0.42, 0.24, -2.02), V(0.0, 0.37, -2.9), 48, 46);
  });
  sfx('meow_hook', meowT, 1.0);
  bubble('MEOW!', meowT + 0.02, W(1, 'sound?') - 0.02, null, { style: 'comic', size: 118, font: 'Luckiest Guy', who: 'hero', dx: 60, dy: -250, burst: true });
  sfx('pop', meowT + 0.02, 0.5);
  shake(meowT, meowT + 0.3, 0.012);
  shot(W(1, 'sound?'), 'street', (L, D, k, w) => {
    E.place(w.hero, w.street, -0.1, -2.82, Math.PI / 2 + 0.25);
    w.hero.update({ t: L + 4, tailLift: 1.45, tailHook: 0.8, tailSway: 0.3, lookTarget: V(0.62, 1.55, -2.62) });
    const h = headOf(w.hero);
    move(k, V(0.5, 0.95, -2.62), h.clone().add(V(0, -0.04, 0)), V(0.36, 0.78, -2.66), h.clone().add(V(0, -0.03, 0)), 46, 42);
  });
  sticker('heart', W(1, 'you.'), PE(1) + 0.25, null, { who: 'hero', dx: 150, dy: -170, size: 120 });
  sfx('sparkle', W(1, 'you.'), 0.35);

  // ------------------------------------------------------------------ PART 2: flashback (soft)
  const p2s = P(2).start - 0.13;
  flash(p2s, 0.35);
  sfx('whoosh_down', p2s - 0.12, 0.55);
  fx('soft', p2s, P(3).start - 0.07, 0.05);
  shot(p2s, 'house', (L, D, k, w) => {
    E.place(w.kitten, w.house, -0.6, -0.42, 0.35);
    w.kitten.update({ t: L, headYaw: 0.55 * Math.sin(L * 2.2), headPitch: 0.05 });
    move(k, V(-0.32, 0.13, 0.6), V(-0.62, 0.08, -0.42), V(-0.38, 0.12, 0.36), V(-0.62, 0.08, -0.42), 46, 44);
  });
  const mewOpen = (t, list) => list.some(([a, b]) => t > a && t < b);
  const mews = [[W(2, 'meow') - 0.02, W(2, 'meow') + 0.32], [W(2, 'cold,') - 0.02, W(2, 'cold,') + 0.3], [W(2, 'hungry,') - 0.02, W(2, 'hungry,') + 0.32], [W(2, 'come') + 0.05, W(2, 'here!', 'e')]];
  shot(W(2, 'They'), 'house', (L, D, k, w) => {
    const t = L + W(2, 'They');
    E.place(w.kitten, w.house, -0.6, -0.42, 0.25);
    const open = mewOpen(t, mews);
    w.kitten.update({ t, mouth: open ? 'open' : 'closed', headPitch: open ? 0.3 : 0.1, headYaw: -0.15 });
    onHead(k, w.kitten, V(0.03, 0.0, 0.24), V(0.02, 0.0, 0.19), 42, 40, V(0, -0.01, 0));
  });
  sfx('kitten_mew', W(2, 'meow') - 0.03, 0.75);
  bubble('mew!', W(2, 'meow'), W(2, "I'm") - 0.05, null, { who: 'kitten', dx: 170, dy: -210, style: 'rect', size: 70 });
  shot(W(2, "I'm"), 'house', (L, D, k, w) => {
    const t = L + W(2, "I'm");
    E.place(w.kitten, w.house, -0.6, -0.42, 0.25);
    const open = mewOpen(t, mews);
    w.kitten.update({ t, mouth: open ? 'open' : 'closed', headPitch: open ? 0.35 : 0.15, headYaw: 0.25 });
    onHead(k, w.kitten, V(-0.16, 0.07, 0.2), V(-0.13, 0.06, 0.16), 42, 40, V(0, -0.01, 0));
  });
  sfx('kitten_mew', W(2, 'cold,') - 0.05, 0.7);
  bubble('mew!', W(2, 'cold,'), W(2, 'hungry,') - 0.05, null, { who: 'kitten', dx: -190, dy: -190, style: 'rect', size: 66 });
  bubble('mew!!', W(2, 'hungry,'), W(2, 'come') + 0.15, null, { who: 'kitten', dx: 190, dy: -230, style: 'rect', size: 74 });
  shot(W(2, 'come'), 'house', (L, D, k, w) => {
    const t = L + W(2, 'come');
    const mp = walkPos(V(0.08, 0, -0.22), V(-0.27, 0, -0.5), L, 0, 0.55);
    E.place(w.mom, w.house, mp.x, mp.z, -2.2 + 0.6 * smooth((L - 0.4) / 0.4));
    w.mom.update({ t, walking: L < 0.55, walkPhase: mp.distanceTo(V(0.08, 0, -0.22)) / 0.2, crouch: smooth((L - 0.5) / 0.35), headYaw: 0.4, lookTarget: headOf(w.kitten) });
    E.place(w.kitten, w.house, -0.6, -0.42, 0.25 + 0.9 * smooth(L / 0.3));
    w.kitten.update({ t, mouth: mewOpen(t, mews) ? 'open' : 'closed', lookTarget: headOf(w.mom) });
    move(k, V(0.12, 0.34, 0.8), V(-0.4, 0.13, -0.42), V(0.04, 0.32, 0.68), V(-0.4, 0.13, -0.42), 46, 44);
  });
  sticker('heart', W(2, 'here!'), P(3).start - 0.1, null, { who: 'kitten', dx: 60, dy: -260, size: 110 });

  // ------------------------------------------------------------------ PART 3: grow up, cats meet (street)
  const p3s = P(3).start - 0.07;
  flash(p3s, 0.3);
  sfx('whoosh', p3s - 0.1, 0.5);
  sfx('sparkle', p3s + 0.15, 0.55);
  shot(p3s, 'street', (L, D, k, w) => {
    w.street.setMood('day');
    E.place(w.hero, w.street, 0.0, -3.0, 0.25);
    w.hero.setAge(easeInOut((L - 0.1) / 0.85));
    w.hero.update({ t: L, tailLift: 1.2 });
    move(k, V(0.12, 0.17, -2.35), V(0.0, 0.15, -3.0), V(0.16, 0.22, -2.0), V(0.0, 0.22, -3.0), 44, 46);
  });
  sticker('sparkles', p3s + 0.08, p3s + 1.1, null, { who: 'hero', dx: 0, dy: -60, size: 260 });
  const rivalIn = W(3, 'they', 's', 1);
  shot(rivalIn, 'street', (L, D, k, w) => {
    w.hero.setAge(1);
    const rp = walkPos(V(1.25, 0, -3.0), V(0.32, 0, -3.0), L, 0, D * 0.85);
    E.place(w.rival, w.street, rp.x, rp.z, -Math.PI / 2);
    w.rival.update({ t: L, walking: L < D * 0.85, walkPhase: (1.25 - rp.x) / 0.2, tailLift: 0.8 });
    E.place(w.hero, w.street, -0.25, -3.0, Math.PI / 2);
    w.hero.update({ t: L + 2, tailLift: 0.9, lookTarget: headOf(w.rival) });
    move(k, V(0.65, 0.19, -2.05), V(0.55, 0.22, -3.0), V(0.3, 0.2, -2.1), V(0.15, 0.24, -3.0), 46, 44);
  });
  shot(W(3, 'at'), 'street', (L, D, k, w) => {
    w.hero.setAge(1);
    E.place(w.hero, w.street, -0.27, -3.0, Math.PI / 2);
    E.place(w.rival, w.street, 0.3, -3.0, -Math.PI / 2);
    w.hero.update({ t: L + 3, tailLift: 0.5, earsBack: 0.1 });
    w.rival.update({ t: L + 1, tailLift: 0.35, earsBack: 0.15 });
    move(k, V(0.04, 0.24, -2.12), V(0.02, 0.24, -3.0), V(0.03, 0.25, -2.3), V(0.02, 0.25, -3.0), 44, 42);
  });
  bubble('…', W(3, 'at') + 0.1, W(3, 'They', 's', 2) - 0.05, null, { at3d: V(0.02, 0.5, -3.0), dx: 0, dy: -20, style: 'dark', size: 100 });
  sfx('pop_lo', W(3, 'at') + 0.1, 0.45);
  shot(W(3, 'They', 's', 2), 'street', (L, D, k, w) => {
    w.hero.setAge(1);
    E.place(w.hero, w.street, -0.27, -3.0, Math.PI / 2);
    E.place(w.rival, w.street, 0.3, -3.0, -Math.PI / 2);
    w.hero.update({ t: L + 3, tailLift: 0.7, tailSway: 0.35 });
    w.rival.update({ t: L + 1.5, tailLift: 0.3, tailSway: 0.4 });
    const a = lerp(-0.5, 0.15, easeInOut(k));
    E.cam(V(0.02, lerp(0.95, 0.82, k), -3.0), V(0.02, 0, -3.0), lerp(44, 40, k), V(Math.sin(a), 0, -Math.cos(a)));
  });

  // ------------------------------------------------------------------ PART 4: body language chips
  const p4s = P(4).start - 0.13;
  const row4 = 'p4';
  chip('TAIL', 'pink', W(4, 'tail.'), PE(4) + 0.15, { row: row4, idx: 0 });
  chip('SMELL', 'pink', W(4, 'sniff.'), PE(4) + 0.15, { row: row4, idx: 1 });
  chip('STARE', 'pink', W(4, 'stare.'), PE(4) + 0.15, { row: row4, idx: 2 });
  chip('HISS', 'yellow', W(4, 'hiss.'), PE(4) + 0.15, { row: row4, idx: 3 });
  for (const key of ['tail.', 'sniff.', 'stare.']) sfx('pop', W(4, key), 0.55);
  shot(p4s, 'street', (L, D, k, w) => {
    E.place(w.hero, w.street, 0.0, -3.0, Math.PI / 2);
    w.hero.update({ t: L, tailLift: 0.95, tailSway: 0.65, tailSpeed: 2.1, tailCurl: 0.2 });
    move(k, V(-0.55, 0.3, -2.72), V(-0.22, 0.34, -3.0), V(-0.48, 0.31, -2.78), V(-0.22, 0.35, -3.0), 40, 37);
  });
  shot(W(4, 'A', 's', 1), 'street', (L, D, k, w) => {
    const c = easeOut(k);
    E.place(w.hero, w.street, lerp(-0.27, -0.235, c), -3.0, Math.PI / 2);
    E.place(w.rival, w.street, lerp(0.29, 0.255, c), -3.0, -Math.PI / 2);
    w.hero.update({ t: L, tailLift: 0.6, headPitch: -0.12 });
    w.rival.update({ t: L + 1, tailLift: 0.3, headPitch: -0.12 + 0.05 * Math.sin(L * 18) });
    move(k, V(0.0, 0.31, -2.6), V(0.0, 0.3, -3.0), V(0.0, 0.31, -2.68), V(0.0, 0.3, -3.0), 32, 30);
  });
  shot(W(4, 'A', 's', 2), 'street', (L, D, k, w) => {
    E.place(w.rival, w.street, 0.3, -3.0, -Math.PI / 2 - 0.7);
    w.rival.update({ t: L * 0.4, tailLift: 0.3, earsBack: 0.15 });
    onFace(k, w.rival, V(0.0, 0.012, 0.3), V(0.0, 0.01, 0.21), 36, 32, V(0, 0.002, 0.02));
  });
  shot(W(4, 'And'), 'street', (L, D, k, w) => {
    E.place(w.rival, w.street, 0.3, -3.0, -Math.PI / 2 - 0.55);
    E.place(w.hero, w.street, -0.3, -3.05, Math.PI / 2);
    w.rival.update({ t: L, crouch: 0.55 * smooth(L / 0.5), earsBack: 0.8, tailLift: 0.15, tailSway: 0.5, tailSpeed: 1.6 });
    w.hero.update({ t: L, tailLift: 0.4 });
    onFace(k, w.rival, V(0.1, 0.03, 0.44), V(0.08, 0.025, 0.35), 40, 38);
  });
  const hissT = W(4, 'hiss.') - 0.04;
  shot(W(4, 'a', 's', 3), 'street', (L, D, k, w) => {
    E.place(w.rival, w.street, 0.3, -3.0, -Math.PI / 2 - 0.55);
    w.rival.update({ t: L, hiss: smooth((L - 0.03) / 0.08), tailLift: 0.4 });
    onFace(k, w.rival, V(0.06, 0.03, 0.33), V(0.05, 0.025, 0.28), 40, 39);
  });
  fx('bw', W(4, 'a', 's', 3), P(5).start - 0.1, 0.06);
  sfx('hiss', hissT, 0.9);
  sfx('hit', hissT, 0.6);
  shake(hissT, hissT + 0.4, 0.014);

  // ------------------------------------------------------------------ PART 5: we answer -> food (kitchen)
  const p5s = P(5).start - 0.1;
  sfx('whoosh', p5s - 0.08, 0.4);
  shot(p5s, 'house', (L, D, k, w) => {
    w.house.setKibble(0);
    E.place(w.hero, w.house, 3.45, -1.25, 0.55);
    w.hero.update({ t: L, sit: 1, lookTarget: V(2.95, 0.58, 0.15) });
    move(k, V(2.9, 0.62, 0.25), V(3.65, 0.2, -1.3), V(2.98, 0.55, 0.05), V(3.65, 0.2, -1.3), 50, 48);
  });
  shot(W(5, 'at'), 'house', (L, D, k, w) => {
    w.house.setKibble(0);
    E.place(w.hero, w.house, 3.45, -1.25, 0.55);
    w.hero.update({ t: L + 1, sit: 1, headRoll: 0.18 * Math.sin(L * 2.5), lookTarget: V(3.62, 0.42, -0.85) });
    onHead(k, w.hero, V(0.12, 0.08, 0.42), V(0.1, 0.06, 0.34), 44, 42, V(0, -0.02, 0));
  });
  sticker('q', W(5, 'at') + 0.08, W(5, 'Scientists') - 0.05, null, { who: 'hero', dx: -170, dy: -190, size: 120, rot: -0.2 });
  sticker('q', W(5, 'at') + 0.35, W(5, 'Scientists') - 0.05, null, { who: 'hero', dx: 160, dy: -230, size: 140, rot: 0.15 });
  sticker('q', W(5, 'at') + 0.62, W(5, 'Scientists') - 0.05, null, { who: 'hero', dx: 10, dy: -330, size: 110, rot: 0 });
  for (const d of [0.08, 0.35, 0.62]) sfx('pop_hi', W(5, 'at') + d, 0.45);
  shot(W(5, 'Scientists'), 'house', (L, D, k, w) => {
    w.house.setKibble(0);
    const mp = walkPos(V(5.0, 0, -0.1), V(4.15, 0, -0.95), L, 0, 1.3);
    E.place(w.man, w.house, mp.x, mp.z, -2.35);
    w.man.update({ t: L, walking: L < 1.3, walkPhase: mp.distanceTo(V(5.0, 0, -0.1)) / 1.25 });
    E.place(w.hero, w.house, 3.45, -1.25, 0.55 + 0.4 * smooth((L - 0.6) / 0.6));
    w.hero.update({ t: L + 2, sit: 1, lookTarget: V(mp.x, 1.2, mp.z) });
    move(k, V(3.0, 0.78, 0.62), V(3.85, 0.38, -1.12), V(3.06, 0.74, 0.5), V(3.85, 0.4, -1.12), 54, 52);
  });
  const meow5 = W(5, 'Meow…') + 0.03;
  shot(W(5, 'Meow…'), 'house', (L, D, k, w) => {
    w.house.setKibble(0);
    E.place(w.man, w.house, 4.15, -0.95, -2.35);
    w.man.update({ t: L, crouch: 0.2 * smooth(L / 0.6), lean: 0.25 * smooth(L / 0.6), headPitch: -0.3 });
    E.place(w.hero, w.house, 3.45, -1.25, 0.95);
    const open = L > 0.03 && L < 0.55;
    w.hero.update({ t: L + 3, sit: 1, mouth: open ? 'open' : 'closed', headPitch: open ? 0.1 : 0, lookTarget: V(4.15, 1.4, -0.95) });
    onHead(k, w.hero, V(0.22, -0.02, 0.24), V(0.18, -0.02, 0.2), 44, 42, V(0, 0.0, 0));
  });
  sfx('meow_soft', meow5, 0.85);
  bubble('meow', meow5 + 0.02, W(5, 'food.') - 0.04, null, { who: 'hero', dx: -150, dy: -200, style: 'rect', size: 68 });
  shot(W(5, 'food.'), 'house', (L, D, k, w) => {
    w.house.setKibble(Math.floor(40 * smooth((L - 0.05) / 0.8)));
    E.place(w.man, w.house, 4.3, -0.95, -2.2);
    w.man.update({ t: L, crouch: 0.3, lean: 0.4, handR: V(0.12, 0.55, 0.5), headPitch: -0.5 });
    w.man.root.updateMatrixWorld(true);
    w.house.bag.visible = true;
    w.house.bag.position.copy(w.man.arms[1].hand.getWorldPosition(V(0, 0, 0))).add(V(0, -0.02, 0));
    w.house.bag.rotation.set(0.9 + 0.25 * smooth(L / 0.3), -2.5, 0);
    E.place(w.hero, w.house, 3.42, -1.28, 0.75);
    w.hero.update({ t: L, sit: 1 - 0.6 * smooth((L - 0.4) / 0.4), lookTarget: V(3.75, 0.0, -1.45) });
    move(k, V(2.95, 0.95, 0.35), V(3.82, 0.3, -1.3), V(3.05, 0.88, 0.2), V(3.82, 0.28, -1.3), 50, 48);
  });
  sfx('kibble', W(5, 'food.') - 0.02, 0.8);
  chip('IT WORKS', 'green', W(5, 'food.') + 0.08, P(6).start - 0.18, { y: 300, size: 70, check: true });
  sfx('ding', W(5, 'food.') + 0.1, 0.5);

  // ------------------------------------------------------------------ PART 6: feral cats, red sky
  const p6s = P(6).start - 0.15;
  sfx('whoosh_down', p6s - 0.12, 0.5);
  fx('red', p6s, P(7).start - 0.08, 0.12);
  shot(p6s, 'street', (L, D, k, w) => {
    w.street.setMood('red');
    E.place(w.rival, w.street, 0.1, -4.9, 0.25, 0.13);
    w.rival.update({ t: L, sit: 1, headPitch: -0.15, tailLift: 0.2 });
    move(k, V(-0.5, 0.3, -2.55), V(0.1, 0.52, -5.6), V(-0.4, 0.3, -2.95), V(0.1, 0.52, -5.6), 62, 56);
  });
  shot(W(6, 'with'), 'street', (L, D, k, w) => {
    w.street.setMood('red');
    E.place(w.rival, w.street, 0.1, -4.9, 0.25, 0.13);
    const yaw = 0.95 * Math.sin(clamp(L / D, 0, 1) * Math.PI * 1.5);
    w.rival.update({ t: L, sit: 1, headYaw: yaw, tailLift: 0.2, earsBack: 0.2 });
    move(k, V(-0.05, 0.42, -3.85), V(0.1, 0.42, -4.9), V(-0.02, 0.43, -4.0), V(0.1, 0.43, -4.9), 46, 44);
  });
  shot(W(6, 'meow'), 'street', (L, D, k, w) => {
    w.street.setMood('red');
    E.place(w.rival, w.street, 0.1, -4.9, 0.25, 0.13);
    const t = L + W(6, 'meow');
    w.rival.update({ t: L * 0.5, sit: 1, headPitch: -0.12, mouth: L > 0.05 && L < 0.5 ? 'open' : 'closed', tears: t > W(6, 'pet') - 0.1, tailLift: 0.15 });
    onHead(k, w.rival, V(0.0, 0.01, 0.34), V(0.0, 0.005, 0.24), 42, 38, V(0, -0.01, 0));
  });
  bubble('…', W(6, 'way'), PE(6) + 0.1, null, { who: 'rival', dx: 170, dy: -120, style: 'dark', size: 96 });
  sfx('pop_lo', W(6, 'way'), 0.4);

  // ------------------------------------------------------------------ PART 7: own meows, at home
  const p7s = P(7).start - 0.07;
  flash(p7s, 0.25, '#fff4d8');
  sfx('whoosh', p7s - 0.1, 0.45);
  const catPath = [V(-0.2, 0, 0.45), V(-1.3, 0, 0.33)];
  shot(p7s, 'house', (L, D, k, w) => {
    E.place(w.man, w.house, -1.85, 0.3, Math.PI / 2);
    w.man.update({ t: L });
    const cp = walkPos(catPath[0], catPath[1], L, 0, D);
    E.place(w.hero, w.house, cp.x, cp.z, -Math.PI / 2 - 0.1);
    w.hero.update({ t: L, walking: true, walkPhase: (catPath[0].x - cp.x) / 0.2, tailLift: 1.4, tailHook: 0.7 });
    E.cam(V(cp.x + 0.12, 0.2, cp.z + 0.78), V(cp.x - 0.2, 0.23, cp.z), 50);
  });
  shot(W(7, 'build'), 'house', (L, D, k, w) => {
    E.place(w.man, w.house, -1.85, 0.3, Math.PI / 2);
    w.man.update({ t: L, headPitch: -0.45 });
    E.place(w.hero, w.house, -1.3, 0.33, -Math.PI / 2 - 0.1);
    const t = L + W(7, 'build');
    const open = t > W(7, 'meows,') && t < W(7, 'meows,') + 0.45;
    w.hero.update({ t, sit: smooth(L / 0.4), tailLift: 1.2, mouth: open ? 'open' : 'closed', lookTarget: V(-1.85, 1.6, 0.3) });
    move(k, V(-0.92, 0.24, 0.66), V(-1.48, 0.45, 0.28), V(-0.97, 0.25, 0.6), V(-1.48, 0.47, 0.28), 52, 50);
  });
  sfx('meow_soft', W(7, 'meows,') + 0.02, 0.75);
  bubble('meow?', W(7, 'meows,') + 0.04, W(7, 'just') - 0.05, null, { who: 'hero', dx: 120, dy: -180, style: 'rect', size: 64 });
  shot(W(7, 'just'), 'house', (L, D, k, w) => {
    E.place(w.hero, w.house, -1.3, 0.33, -Math.PI / 2 - 0.1);
    const happy = L > 0.55;
    w.hero.update({ t: L, sit: 1, eyes: happy ? 'happy' : 'open', tailLift: 1.2, lookTarget: V(-1.85, 1.6, 0.3), headPitch: happy ? -0.1 : 0 });
    E.place(w.man, w.house, -1.85, 0.3, Math.PI / 2);
    const h = headOf(w.hero, V(0, 0.07, 0));
    const reach = smooth(L / 0.6);
    const local = w.man.root.worldToLocal(h.clone());
    const rest = V(0.25, 0.45, 0.03);
    w.man.update({ t: L, crouch: 0.42 * reach, lean: 0.5 * reach, headPitch: -0.5, handR: rest.clone().lerp(local.add(V(0, 0.02 + 0.015 * Math.sin(L * 9), 0)), reach) });
    move(k, V(-0.85, 0.32, 1.05), V(-1.48, 0.36, 0.3), V(-0.9, 0.32, 0.95), V(-1.48, 0.37, 0.3), 52, 50);
  });
  sticker('heart', W(7, 'human.') - 0.05, PE(7) + 0.1, null, { who: 'hero', dx: 110, dy: -200, size: 110 });
  sfx('sparkle', W(7, 'human.') - 0.05, 0.3);

  // ------------------------------------------------------------------ PART 8: food-bowl meow vs door meow
  const p8s = P(8).start - 0.12;
  const longT = W(8, 'bowl…') + 0.2;
  shot(p8s, 'house', (L, D, k, w) => {
    w.house.setKibble(0);
    E.place(w.hero, w.house, 3.55, -1.3, 0.7);
    const t = L + p8s;
    const loud = t > longT && t < longT + 1.15;
    w.hero.update({ t, mouth: loud ? 'wide' : 'closed', headPitch: loud ? 0.25 : 0, tailLift: 1.0, tailSway: 0.5, tailSpeed: 1.4, lookTarget: V(3.2, 0.3, -0.58) });
    const hh = headOf(w.hero);
    move(k, V(3.3, 0.3, -0.5), hh.clone().add(V(0, -0.1, 0)), V(3.36, 0.3, -0.64), hh.clone().add(V(0, -0.09, 0)), 52, 48);
  });
  sfx('meow_long', longT, 1.0);
  bubble('MRRROOOW!', longT + 0.03, W(8, 'a', 's', 1) - 0.02, null, { who: 'hero', dx: 0, dy: -300, style: 'comic', size: 96, font: 'Luckiest Guy', burst: true, wobbleAmp: 0.06 });
  sfx('pop', longT + 0.03, 0.45);
  shake(longT, longT + 0.7, 0.008);
  const chirpT = W(8, 'door.', 'e') + 0.03;
  shot(W(8, 'a', 's', 1), 'house', (L, D, k, w) => {
    E.place(w.hero, w.house, -2.5, 0.0, -Math.PI / 2);
    const t = L + W(8, 'a', 's', 1);
    const open = t > chirpT && t < chirpT + 0.35;
    w.hero.update({ t, sit: 1, tailLift: 0.8, headYaw: 1.2 * smooth((L - 0.3) / 0.4), mouth: open ? 'open' : 'closed', headPitch: open ? 0.12 : 0.05 });
    move(k, V(-1.55, 0.32, 0.6), V(-2.62, 0.4, 0.0), V(-1.7, 0.31, 0.5), V(-2.62, 0.42, 0.0), 48, 46);
  });
  sfx('meow_chirp', chirpT, 0.9);
  bubble('mrrp?', chirpT + 0.02, W(8, 'And') + 0.25, null, { who: 'hero', dx: 140, dy: -170, style: 'rect', size: 62 });
  sfx('pop_hi', chirpT + 0.02, 0.4);
  const doorT = W(8, 'understand') + 0.25;
  shot(W(8, 'And'), 'house', (L, D, k, w) => {
    const t = L + W(8, 'And');
    const mp = walkPos(V(-1.6, 0, 1.45), V(-2.4, 0, 0.62), L, 0, 0.75);
    E.place(w.man, w.house, mp.x, mp.z, -2.35);
    const reach = smooth((t - doorT + 0.25) / 0.3);
    w.man.update({ t: L, walking: L < 0.75, walkPhase: mp.distanceTo(V(-1.6, 0, 1.45)) / 1.25, handR: reach > 0 ? V(0.1, 1.0, 0.5).lerp(V(0.25, 1.0, 0.55), reach) : null });
    w.house.setDoor(smooth((t - doorT) / 0.7));
    E.place(w.hero, w.house, -2.5, -0.05, -Math.PI / 2);
    w.hero.update({ t, sit: 1 - smooth((t - doorT - 0.5) / 0.3), tailLift: 1.3, tailHook: 0.6, lookTarget: t < doorT ? headOf(w.man) : V(-3.4, 0.3, 0) });
    move(k, V(-0.45, 1.0, 0.0), V(-2.9, 1.02, 0.42), V(-0.58, 0.98, -0.02), V(-2.9, 1.03, 0.42), 60, 58);
  });
  sticker('ex', W(8, 'understand'), PE(8) + 0.1, null, { whoMan: true, dx: 0, dy: -150, size: 140, color: '#FFD21F' });
  sfx('pop_hi', W(8, 'understand'), 0.5);
  sfx('door', doorT, 0.7);
  sticker('check', W(8, 'both.'), PE(8) + 0.1, null, { who: 'hero', dx: 120, dy: -170, size: 110 });
  sfx('ding', W(8, 'both.'), 0.45);

  // ------------------------------------------------------------------ PART 9: the 2015 study
  const p9s = P(9).start - 0.14;
  sfx('whoosh', p9s - 0.08, 0.35);
  chip('2015 STUDY', 'blue', W(9, '2015'), W(9, 'A', 's', 1) - 0.08, { y: 300, size: 70 });
  sfx('pop', W(9, '2015'), 0.55);
  const manSofa = (w, L, extra = {}) => {
    E.place(w.man, w.house, -0.78, -1.62, 0);
    w.man.update({ t: L, sit: 1, seatY: 0.6, handL: V(-0.16, 0.75, 0.32), ...extra });
    w.man.root.updateMatrixWorld(true);
    const hand = w.man.arms[0].hand.getWorldPosition(V(0, 0, 0));
    w.house.clip.visible = true;
    w.house.clip.position.copy(hand).add(V(0.05, 0.06, 0.02));
    w.house.clip.rotation.set(-0.5, 0.25, 0);
  };
  shot(p9s, 'house', (L, D, k, w) => {
    manSofa(w, L);
    E.place(w.hero, w.house, -0.62, -0.78, Math.PI + 0.15);
    w.hero.update({ t: L, sit: 1, tailLift: 0.5, lookTarget: headOf(w.man) });
    move(k, V(0.45, 0.88, 0.75), V(-0.72, 0.55, -1.45), V(0.3, 0.85, 0.55), V(-0.72, 0.56, -1.45), 50, 48);
  });
  const meow9 = W(9, 'did') + 0.05;
  shot(W(9, 'owners'), 'house', (L, D, k, w) => {
    manSofa(w, L, { headPitch: -0.35 });
    E.place(w.hero, w.house, -0.62, -0.78, Math.PI + 0.15);
    const t = L + W(9, 'owners');
    const open = t > meow9 && t < meow9 + 0.45;
    w.hero.update({ t, sit: 1, tailLift: 0.8, mouth: open ? 'open' : 'closed', lookTarget: headOf(w.man) });
    move(k, V(-0.45, 0.28, -0.25), V(-0.75, 0.75, -1.55), V(-0.5, 0.29, -0.32), V(-0.75, 0.78, -1.55), 50, 48);
  });
  sfx('meow_soft', meow9, 0.8);
  bubble('meow!', meow9 + 0.02, W(9, 'own') - 0.05, null, { who: 'hero', dx: 130, dy: -160, style: 'rect', size: 64 });
  shot(W(9, 'own'), 'house', (L, D, k, w) => {
    manSofa(w, L, { headPitch: -0.3 + 0.12 * Math.sin(L * 9) * (L < 0.8 ? 1 : 0) });
    E.place(w.hero, w.house, -0.62, -0.78, Math.PI + 0.15);
    w.hero.update({ t: L, sit: 1, tailLift: 1.0 });
    move(k, V(-0.15, 0.95, -0.1), V(-0.78, 0.92, -1.62), V(-0.22, 0.95, -0.25), V(-0.78, 0.93, -1.62), 48, 46);
  });
  sticker('check', W(9, 'own') + 0.08, W(9, 'A', 's', 1) - 0.05, null, { whoMan: true, dx: 240, dy: 230, size: 120 });
  sfx('ding', W(9, 'own') + 0.08, 0.45);
  const meow9b = W(9, 'cat?') + 0.0;
  shot(W(9, 'A', 's', 1), 'house', (L, D, k, w) => {
    const t = L + W(9, 'A', 's', 1);
    const confused = smooth((t - W(9, 'Just')) / 0.3);
    manSofa(w, L, { headRoll: 0.28 * confused, headPitch: -0.25 });
    E.place(w.rival, w.house, -0.95, -0.9, Math.PI - 0.25);
    const open = t > meow9b && t < meow9b + 0.5;
    w.rival.update({ t, sit: 1, tailLift: 0.4, mouth: open ? 'open' : 'closed', lookTarget: headOf(w.man) });
    move(k, V(0.3, 0.95, 0.6), V(-0.85, 0.86, -1.45), V(0.18, 0.93, 0.45), V(-0.85, 0.88, -1.45), 52, 50);
  });
  sfx('meow_hook', meow9b, 0.7);
  bubble('meow!', meow9b + 0.02, W(9, 'Just') + 0.25, null, { who: 'rival', dx: -120, dy: -170, style: 'rect', size: 64 });
  const qs = [[W(9, 'Just'), -150, -50, 0.25], [W(9, 'Just') + 0.25, 160, -100, -0.15], [W(9, 'guessing.'), 10, -210, 0.05]];
  for (const [t, dx, dy, rot] of qs) {
    sticker('q', t, PE(9) + 0.12, null, { whoMan: true, dx, dy, size: 120, rot });
    sfx('pop_hi', t, 0.45);
  }

  // ------------------------------------------------------------------ PART 10: slow blink ending
  const p10s = P(10).start - 0.15;
  sfx('whoosh', p10s - 0.08, 0.3);
  const sofaCat = (w, L, extra = {}) => {
    E.place(w.hero, w.house, -1.52, -1.86, 0.08, 0.6);
    w.hero.update({ t: L, sit: 1, tailLift: 0.4, lookTarget: V(-1.42, 0.88, -1.0), ...extra });
  };
  const meow10 = W(10, 'meows') + 0.05;
  shot(p10s, 'house', (L, D, k, w) => {
    const t = L + p10s;
    const open = t > meow10 && t < meow10 + 0.42;
    sofaCat(w, L, { mouth: open ? 'open' : 'closed' });
    move(k, V(-1.3, 0.88, -0.75), V(-1.52, 0.86, -1.86), V(-1.34, 0.88, -0.95), V(-1.52, 0.87, -1.86), 46, 44);
  });
  sfx('meow_soft', meow10, 0.65);
  bubble('meow', meow10 + 0.02, W(10, "it's") - 0.05, null, { who: 'hero', dx: 140, dy: -170, style: 'rect', size: 62 });
  shot(W(10, "it's"), 'house', (L, D, k, w) => {
    sofaCat(w, L + 3);
    onHead(k, w.hero, V(0.03, 0.0, 0.5), V(0.02, 0.0, 0.42), 42, 40, V(0, -0.02, 0));
  });
  const blinkT = W(10, 'language') + 0.15;
  shot(W(10, "It's", 's', 1), 'house', (L, D, k, w) => {
    const t = L + W(10, "It's", 's', 1);
    const b = t - blinkT;
    const eyes = b < 0 ? 'open' : b < 0.12 ? 'half' : b < 0.95 ? 'closed' : b < 1.07 ? 'half' : 'open';
    sofaCat(w, L + 5, { eyes, headPitch: b > 0 && b < 1.0 ? -0.06 : 0 });
    onHead(Math.min(1, L / 3.0), w.hero, V(0.02, -0.005, 0.37), V(0.015, -0.005, 0.29), 40, 38, V(0, -0.025, 0));
  });
  sfx('purr', blinkT - 0.25, 0.55);
  sticker('heart', W(10, 'you.', 's', 1), tl.total + 1, null, { who: 'hero', dx: 210, dy: -250, size: 150 });
  sfx('sparkle', W(10, 'you.', 's', 1), 0.45);

  shots.sort((a, b) => a.t0 - b.t0);
  return { shots, events };
}

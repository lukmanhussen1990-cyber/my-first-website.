// Scene sets. Each set owns one group in the camera layer and poses its
// puppets/props for whichever scene of the story is playing at time t.

// Puppet lowered quickly on its strings, then a few small bounces.
function dropLift(t, t0, H, T = 0.5) {
  const u = t - t0;
  if (u <= 0) return H;
  if (u < T) { const k = u / T; return H * (1 - k * k); }
  const v = u - T;
  return 22 * Math.exp(-6 * v) * Math.abs(Math.sin(v * 11));
}
// Damped wobble after landing (for dangling limbs).
const settle = (t, t0) => (t < t0 ? 0 : Math.exp(-4 * (t - t0)) * Math.cos((t - t0) * 9));

// Polyline position at arc-length fraction u.
function along(pts, u) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const d = clamp(u) * L[L.length - 1];
  let i = 1;
  while (i < L.length - 1 && L[i] < d) i++;
  const k = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
  return { x: lerp(pts[i - 1][0], pts[i][0], k), y: lerp(pts[i - 1][1], pts[i][1], k), dist: d };
}

function darkMask(id) {
  const m = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1500, height: 2300 }, defs());
  el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#fff' }, m);
  return m;
}
function lightHole(mask, cx, cy, r) {
  return el('ellipse', { cx, cy, rx: r, ry: r, fill: 'url(#holeGrad)' }, mask);
}
function setHole(h, cx, cy, rx, ry, op) {
  h.setAttribute('cx', cx.toFixed(1)); h.setAttribute('cy', cy.toFixed(1));
  h.setAttribute('rx', Math.max(1, rx).toFixed(1)); h.setAttribute('ry', Math.max(1, ry ?? rx).toFixed(1));
  h.setAttribute('opacity', clamp(op).toFixed(3));
}
function darkRect(parent, mask, color = '#04050B') {
  return el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: color, mask: mask ? `url(#${mask.id})` : '' }, parent);
}

function initSharedDefs() {
  radGrad('holeGrad', [['0', '#000', 1], ['0.55', '#000', 0.75], ['1', '#000', 0]]);
  linGrad('beamGrad', [['0', '#FFE9B0', 0.75], ['0.6', '#F7C878', 0.25], ['1', '#F7C878', 0]]);
  radGrad('doorGlow', [['0', '#FFFFFF', 0.9], ['0.3', '#FFF0C0', 0.55], ['1', '#F7C878', 0]]);
  const b = el('filter', { id: 'softBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs());
  el('feGaussianBlur', { stdDeviation: 6 }, b);
  const b2 = el('filter', { id: 'bigBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs());
  el('feGaussianBlur', { stdDeviation: 14 }, b2);
}

// Talk gesture: front arm lifts a little around each key-word time.
function talk(p, t, times) {
  let k = 0;
  for (const tt of times) k = Math.max(k, pulse(t, tt - 0.15, 0.25, 0.5, 0.5));
  blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, POSE.talk, k * 0.75);
  p.head -= 3 * k;
}

// ------------------------------------------------------------ cave inside --
function setCaveIn(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgCaveInside(root);
  const boulder = new Boulder(bg.boulderLayer, 322, true);
  const beams = el('path', { d: '', fill: 'url(#beamGrad)', style: 'mix-blend-mode:screen', opacity: 0 }, root);
  const mBg = darkMask('mCaveBg');
  const holeLamp = lightHole(mBg, 150, 760, 600), holeDoor = lightHole(mBg, 540, 880, 10);
  const bgDark = darkRect(root, mBg);
  const rimGlow = el('path', { d: bg.hole, fill: 'none', stroke: '#FFD98A', 'stroke-width': 9, filter: 'url(#softBlur)', opacity: 0 }, root);
  const duaGlow = el('ellipse', { rx: 260, ry: 420, fill: 'url(#duaGlow)', opacity: 0 }, root);
  const pup = el('g', {}, root);
  const men = ['man1', 'man2', 'man3'].map(k => new Human(pup, k));
  const POS = [[270, 1722, 0.9], [540, 1706, 0.86], [810, 1732, 0.92]];
  const mP = darkMask('mCavePup');
  const pupHoleLamp = lightHole(mP, 150, 760, 520), pupHoleActor = lightHole(mP, 540, 1300, 300);
  const pupHoleDoor = lightHole(mP, 540, 900, 10);
  const pupDark = darkRect(root, mP);
  const lantern = new Lantern(root, 0.95);
  const doorGlow = el('ellipse', { cx: 540, cy: 880, rx: 10, ry: 10, fill: 'url(#doorGlow)', style: 'mix-blend-mode:screen', opacity: 0 }, root);
  const warm = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#F7C878', style: 'mix-blend-mode:soft-light', opacity: 0 }, root);
  root.appendChild(boulder.str); // boulder string over the rock walls
  const drip = el('path', { fill: '#BFD8E8', opacity: 0.85 }, root);
  const ripple = el('path', { fill: 'none', stroke: '#BFD8E8', 'stroke-width': 2, opacity: 0 }, root);

  // boulder offset (px to the right) for the time t
  const OPEN1 = 46, OPEN2 = 132, OPEN3 = 980;
  function boulderState(t) {
    let off = 0, move = 0;
    const m1 = seg(t, ...E.dua1Move), m2 = seg(t, ...E.dua2Move), m3 = seg(t, ...E.dua3Move);
    if (t >= E.dua3Move[0]) { off = lerp(OPEN2, OPEN3, easeIn(m3) * 0.35 + smooth(m3) * 0.65); move = m3 > 0 && m3 < 1 ? 1 : 0; }
    else if (t >= E.dua2Move[0]) { off = lerp(OPEN1, OPEN2, smooth(m2)); move = m2 < 1 ? 1 : 0; }
    else if (t >= E.dua1Move[0]) { off = lerp(0, OPEN1, smooth(m1)); move = m1 < 1 ? 1 : 0; }
    return { off, move };
  }

  function update(t, sc) {
    const id = sc.id, lt = t - sc.s;
    const { off, move } = boulderState(t);
    const jit = move ? 2.5 * noise1(t * 22, 4) : 0;
    boulder.update(HOLE.x + off, HOLE.y + jit, (off / 322) * 57.3 + jit, 1, 0);
    const open = clamp(off / 300);
    const full = clamp((off - OPEN2) / (OPEN3 - OPEN2));
    // light through the gap
    const gapW = off + 8, gx = HOLE.x - HOLE.r + gapW / 2;
    if (off > 2) {
      const x0 = HOLE.x - HOLE.r + 6, x1 = Math.min(HOLE.x + HOLE.r, x0 + gapW);
      const spread = 1 + full * 0.6;
      beams.setAttribute('d', `M${x0} ${HOLE.y - 260}L${x1} ${HOLE.y - 300}L${(x1 - 540) * 1.6 * spread + 540 + 120} 1780L${(x0 - 540) * 1.5 * spread + 540 - 60} 1780Z`);
      beams.setAttribute('opacity', ((0.35 + 0.65 * open) * (1 - 0.45 * full)).toFixed(3));
    } else beams.setAttribute('opacity', 0);
    setHole(holeDoor, gx, HOLE.y, 60 + gapW * 1.6, 360 + gapW * 0.8, open * 1.6);
    setHole(pupHoleDoor, gx, HOLE.y + 400, 120 + gapW * 2, 700, open * 1.4);
    doorGlow.setAttribute('cx', gx); doorGlow.setAttribute('rx', (40 + gapW * 1.1).toFixed(1)); doorGlow.setAttribute('ry', (300 + gapW * 0.4).toFixed(1));
    doorGlow.setAttribute('opacity', (off > 2 ? (0.5 + 0.5 * open) * (1 - 0.6 * full) : 0).toFixed(3));
    bg.rimLight.setAttribute('opacity', (0.15 + 0.85 * open).toFixed(3));

    // lighting per scene
    const hook = id === 'hook';
    const lampOn = hook ? 0 : (id === 'inside' ? smooth(lt / 1.2) : 1);
    lantern.update(t, 150, 600, 2.4 * Math.sin(t * 0.9) + 0.8 * Math.sin(t * 2.3), lampOn * (1 - full * 0.6));
    lantern.wrap.setAttribute('opacity', hook ? 0 : (1 - full * 0.35).toFixed(3));
    setHole(holeLamp, 160, 760, 600, 600, lampOn * (0.9 + 0.08 * Math.sin(t * 7)));
    setHole(pupHoleLamp, 170, 900, 560, 620, lampOn * 0.9);
    bgDark.setAttribute('opacity', lerp(hook ? 0.74 : 0.8, 0.05, full).toFixed(3));
    pupDark.setAttribute('opacity', lerp(hook ? 0.5 : 0.36, 0, full).toFixed(3));
    rimGlow.setAttribute('opacity', (hook || id === 'inside' || id === 'dua1' ? (0.55 + 0.2 * Math.sin(t * 2)) * (1 - open) : 0).toFixed(3));
    warm.setAttribute('opacity', (full * 0.55).toFixed(3));

    // the three men
    const actor = { dua1: 0, dua2: 1, dua3: 2 }[id];
    const raiseT = { dua1: E.dua1Raise, dua2: E.dua2Raise, dua3: E.dua3Raise }[id];
    let actorK = 0;
    men.forEach((m, i) => {
      const p = Human.rest();
      [p.x, p.y, p.s] = POS[i];
      idle(p, t, i * 1.7 + 0.3, 1);
      if (hook) {
        const t0 = E.drops[i];
        p.lift = dropLift(t, t0, 1500);
        const w = settle(t, t0 + 0.5);
        p.armF[0] += -30 * w; p.armB[0] += -24 * w; p.armF[1] += -20 * w;
        p.legF[0] += 10 * w; p.legB[0] -= 8 * w;
        if (t < t0 + 0.5) { const k = clamp((t - t0) / 0.5); p.armF[0] -= 50 * k; p.armB[0] -= 40 * k; }
        p.glow = 0.75;
      }
      if (id === 'inside') {
        const cues = [[TL.at(5, 'ask').s, TL.at(5, 'allah').s], [TL.at(5, 'good').s, TL.at(5, 'deeds').s], [TL.at(5, 'only').s]][i];
        talk(p, t, cues);
        p.head += i === 0 ? 2 : i === 2 ? -2 : 0;
      }
      if (actor === i) {
        const k = smooth((t - raiseT) / 0.8);
        actorK = k;
        blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, POSE.dua, k);
        p.open = k > 0.45;
        p.head -= 7 * k;
        p.glow = 0.42 + 0.5 * k;
        p.sway *= 1 - 0.5 * k;
      }
      if (id === 'dua3' && t > E.hopOut[0]) {
        // hop out into the light, shrinking into the entrance
        const t0 = E.hopOut[0] + i * 0.22, t1 = E.hopOut[1];
        const x1 = 540 + (i - 1) * 70;
        hopWalk(p, t, t0, t1, POS[i][0], x1, { period: 0.34, height: 30 });
        const u = smooth(seg(t, t0, t1));
        p.y = lerp(POS[i][1], 1240, u);
        p.s = lerp(POS[i][2], 0.4, u);
        p.alpha = 1 - smooth(seg(t, t1 - 0.5, t1));
        if (actor === i) { blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, POSE.rest, smooth(seg(t, t0 - 0.3, t0 + 0.2))); p.open = false; }
      }
      m.update(p);
    });
    if (actor !== undefined) {
      const [x, y] = POS[actor];
      duaGlow.setAttribute('cx', x); duaGlow.setAttribute('cy', y - 330);
      duaGlow.setAttribute('opacity', (actorK * (0.8 + 0.2 * Math.sin(t * 2.4))).toFixed(3));
      setHole(pupHoleActor, x, y - 300, 260, 420, actorK);
    } else { duaGlow.setAttribute('opacity', 0); setHole(pupHoleActor, 0, 0, 1, 1, 0); }

    // water drip from a stalactite
    let dd = '', rr = '', rop = 0;
    for (const td of E.drips) {
      const u = t - (td - 0.55);
      if (u >= 0 && u < 0.55) { const y = 340 + 1180 * (u / 0.55) * (u / 0.55); dd += `M930 ${y - 9}Q936 ${y} 930 ${y + 5}Q924 ${y} 930 ${y - 9}Z`; }
      const v = t - td;
      if (v >= 0 && v < 0.8) { const r = 10 + v * 70; rr += `M${930 - r} 1520a${r} ${r * 0.25} 0 1 0 ${2 * r} 0a${r} ${r * 0.25} 0 1 0 ${-2 * r} 0`; rop = 1 - v / 0.8; }
    }
    drip.setAttribute('d', dd); ripple.setAttribute('d', rr); ripple.setAttribute('opacity', (rop * 0.6).toFixed(3));
  }
  return { g: root, update };
}

// ---------------------------------------------------- cave outside (night) --
function setCaveOutNight(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgCaveOutside(root, 'night');
  const stars = new Stars(bg.sky, [[110, 400, 0.8], [330, 300, 0.6], [470, 560, 0.75], [650, 330, 0.9], [800, 470, 0.6], [960, 330, 0.8], [600, 760, 0.55], [380, 860, 0.6], [860, 640, 0.5]], 5);
  const moon = new Moon(bg.sky, 58);
  const clouds = [[300, 560, 560, 4], [790, 430, 480, 9], [560, 760, 420, 2]].map(([x, y, w, s]) => ({ x, y, c: new Cloud(bg.sky, w, s) }));
  const bolt = el('path', { d: '', fill: 'none', stroke: '#FFF6DA', 'stroke-width': 6, 'stroke-linejoin': 'round', filter: 'url(#softBlur)' }, bg.sky);
  const boltCore = el('path', { d: '', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3, 'stroke-linejoin': 'round' }, bg.sky);
  const pup = el('g', {}, root);
  const men = ['man1', 'man2', 'man3'].map(k => new Human(pup, k));
  const boulderLayer = el('g', {}, root);
  const boulder = new Boulder(boulderLayer, 230, false);
  const puffs = el('path', { fill: '#C9B48E', opacity: 0 }, root);
  const rain = el('path', { stroke: '#AFC0DA', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0 }, root);
  const dark = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#060914', opacity: 0.28 }, root);
  const flash = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#DCE6FF', opacity: 0 }, root);
  const R = rng(99);
  const drops = Array.from({ length: 240 }, () => ({ x: R() * 1500 - 200, y: R() * 2000, v: 1700 + R() * 600, l: 30 + R() * 26 }));
  const bolts = [0, 1, 2].map(k => {
    const r = rng(200 + k), pts = [[300 + k * 230, 240]];
    while (pts[pts.length - 1][1] < 980) { const [x, y] = pts[pts.length - 1]; pts.push([x + (r() - 0.45) * 90, y + 50 + r() * 60]); }
    return poly(pts);
  });
  const PATH = [[1260, 420], [1080, 570], [930, 735], [822, 895], [752, 1075], [706, 1236], [610, 1392], [540, 1452]];
  const flashEnv = u => (u < 0 || u > 0.45 ? 0 : 0.85 * Math.exp(-u * 16) + 0.6 * Math.exp(-Math.pow((u - 0.17) / 0.045, 2)));
  // where each man enters the cave mouth
  const arrive = [E.walkIn[1] - 1.15, E.walkIn[1] - 0.65, E.walkIn[1] - 0.15];

  function update(t, sc) {
    const st = S.storm.s;
    stars.update(t, 0, 1 - 0.75 * smooth(seg(t, st, st + 1.6)));
    moon.update(200, 790, 4 * Math.sin(t * 0.7));
    moon.wrap.setAttribute('opacity', (1 - 0.6 * smooth(seg(t, st + 0.5, st + 2))).toFixed(3));
    clouds.forEach((c, i) => {
      const t0 = st - 0.2 + i * 0.3, u = t - t0;
      const y = c.y - 1100 * (1 - smooth(clamp(u / 1.2)));
      const rot = (u > 0 ? 7 * Math.exp(-1.6 * u) * Math.sin(u * 3.2) : 0) + 1.5 * Math.sin(t * 0.8 + i * 2);
      c.c.update(c.x + 14 * Math.sin(t * 0.5 + i), y, rot);
    });
    let f = 0, which = 0;
    E.flashes.forEach((ft, k) => { const v = flashEnv(t - ft); if (v > f) { f = v; which = k % 3; } });
    flash.setAttribute('opacity', (f * 0.42).toFixed(3));
    bolt.setAttribute('d', f > 0.35 ? bolts[which] : ''); boltCore.setAttribute('d', f > 0.35 ? bolts[which] : '');
    const rainK = smooth(seg(t, st + 0.1, st + 1.0));
    let rd = '';
    for (const d of drops) {
      const y = ((d.y + t * d.v) % 2100) - 150, x = d.x - (y + 150) * 0.21;
      rd += `M${x.toFixed(0)} ${y.toFixed(0)}l${(-d.l * 0.21).toFixed(1)} ${d.l.toFixed(0)}`;
    }
    rain.setAttribute('d', rd); rain.setAttribute('opacity', (0.5 * rainK).toFixed(3));
    dark.setAttribute('opacity', (0.22 + 0.12 * rainK).toFixed(3));

    // men hop in from the left and disappear into the mouth
    men.forEach((m, i) => {
      const p = Human.rest();
      p.s = 0.6; p.y = 1722;
      const x0 = -110 - i * 170, x1 = 540 + (1 - i) * 22;
      const t0 = E.walkIn[0] + i * 0.12, t1 = arrive[i];
      idle(p, t, i * 2.1, 0.8);
      hopWalk(p, t, t0, t1, x0, x1, { period: 0.34, height: 20 });
      if (t < t0) p.x = x0;
      // hands up against the storm
      // one arm held over the head against the rain
      const cover = smooth(seg(t, E.flashes[1] - 0.1 + i * 0.1, E.flashes[1] + 0.3 + i * 0.1));
      blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, { armF: [-158, -104, -6], armB: p.armB.slice() }, cover);
      const u = seg(t, t1, t1 + 0.5);
      p.y = lerp(1722, 1676, u); p.s = lerp(0.6, 0.5, u); p.alpha = 1 - smooth(u);
      m.update(p);
    });

    // the boulder rolls down the slope and seals the mouth
    if (t < E.rollStart) boulder.update(1400, 300, 0, 0);
    else {
      const u = seg(t, E.rollStart, E.thud);
      const k = Math.pow(u, 1.7);
      const pos = along(PATH, k);
      let y = pos.y;
      if (t > E.thud) y -= 16 * Math.exp(-7 * (t - E.thud)) * Math.abs(Math.sin((t - E.thud) * 13));
      boulder.update(pos.x, y, -(pos.dist / 230) * 57.3, 1, 0);
    }
    // dust puffs at the thud
    let pd = '', pop = 0;
    const v = t - E.thud;
    if (v >= 0 && v < 1.6) {
      const pr = rng(5);
      for (let i = 0; i < 11; i++) {
        const dir = i < 5 ? -1 : 1, sp = 60 + pr() * 160;
        const x = 540 + dir * (150 + pr() * 120) + dir * sp * v, y = 1660 - pr() * 50 - 40 * v;
        const r = (24 + pr() * 30) * (0.6 + v * 1.3);
        pd += `M${x - r} ${y}a${r} ${r * 0.8} 0 1 0 ${2 * r} 0a${r} ${r * 0.8} 0 1 0 ${-2 * r} 0`;
      }
      pop = 0.6 * (1 - v / 1.6);
    }
    puffs.setAttribute('d', pd); puffs.setAttribute('opacity', pop.toFixed(3));
  }
  return { g: root, update };
}

// ----------------------------------------------------- cave outside (dawn) --
function setCaveOutDawn(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgCaveOutside(root, 'dawn');
  const sun = new Sun(bg.sky, 80);
  const birds = new Birds(bg.sky, 5, 12);
  const boulder = new Boulder(root, 230, false);
  const glow = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#FFD58A', style: 'mix-blend-mode:soft-light', opacity: 0.35 }, root);
  const cur = buildCurtains(root);
  function update(t, sc) {
    const u = seg(t, S.moral.s, E.end);
    sun.update(t, 250, lerp(1300, 1080, u));
    birds.update(t, S.moral.s - 2);
    boulder.update(965, 1452, -212 + 0.6 * Math.sin(t * 0.8), 1, 0);
    const c = smooth(seg(t, ...E.curtain));
    setT(cur.L, `translate(${lerp(-640, -60, c).toFixed(1)} 0)`);
    setT(cur.R, `translate(${lerp(1140, 540, c).toFixed(1)} 0)`);
    setT(cur.v, `translate(0 ${lerp(-360, 0, smooth(seg(t, E.curtain[0] - 0.4, E.curtain[0] + 0.6))).toFixed(1)})`);
    show(cur.g, t > E.curtain[0] - 0.5);
  }
  return { g: root, update };
}

// --------------------------------------------------------- home: man1 ----
function setHomeFirst(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgHome(root, 'night');
  const stars = new Stars(bg.skyObjects, [[440, 640, 0.5], [610, 700, 0.45], [500, 820, 0.4], [650, 860, 0.5]], 9);
  const moon = new Moon(bg.skyObjects, 44);
  const sun = new Sun(bg.skyObjects, 56);
  const shaft = el('path', { d: 'M410 1000L670 1000L900 1680L240 1680Z', fill: 'url(#beamGrad)', style: 'mix-blend-mode:screen', opacity: 0 }, root);
  const pup = el('g', {}, root);
  const bed = new ParentsBed(pup);
  const man = new Human(pup, 'man1', { bowl: true });
  const boy = new Child(pup, false), girl = new Child(pup, true);
  const dark = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#05060C', opacity: 0.3 }, root);
  const lampHalo = el('circle', { cx: 222, cy: 1196, r: 300, fill: 'url(#lampGlow)', opacity: 0.8 }, root);
  const hang = new Lantern(root, 0.72);
  function update(t, sc) {
    hang.update(t, 880, 560, 2.5 * Math.sin(t * 0.8 + 1), 0.8);
    const day = smooth(seg(t, ...E.sunRise));
    bg.dawn.setAttribute('opacity', day.toFixed(3));
    stars.update(t, 0, 1 - day);
    const mu = seg(t, ...E.moonCross);
    moon.update(lerp(330, 760, mu), 760 - 70 * Math.sin(Math.PI * mu), 5 * Math.sin(t * 0.8), 520);
    sun.update(t, 560, lerp(1120, 820, easeOut(seg(t, ...E.sunRise))));
    const fl = 0.85 + 0.15 * Math.sin(t * 8.3) * noise1(t * 3, 1);
    bg.lampGlow.setAttribute('opacity', (fl * (1 - 0.5 * day)).toFixed(3));
    lampHalo.setAttribute('opacity', (0.7 * fl * (1 - 0.6 * day)).toFixed(3));
    shaft.setAttribute('opacity', (day * 0.55).toFixed(3));
    dark.setAttribute('opacity', lerp(0.34, 0.06, day).toFixed(3));
    bed.update(t, 585, 1712, 1.02);
    const p = Human.rest();
    p.x = 310; p.y = 1726; p.s = 0.96;
    idle(p, t, 0.7, 0.55);
    blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, POSE.hold, 1);
    p.armF[0] += 1.2 * Math.sin(t * 1.3); p.armB[0] += 1.2 * Math.sin(t * 1.3 + 0.4);
    p.hold = true;
    // the long night: head droops with tiredness, lifts when morning comes
    p.head += 9 * smooth(seg(t, S.first.s + 4, E.sunRise[0])) * (1 - smooth(seg(t, E.sunRise[0], E.sunRise[0] + 1)));
    man.update(p);
    const cry = smooth(seg(t, E.childCry - 0.6, E.childCry + 0.4));
    boy.update(t, 140, 1752, 0.86, 1, Math.max(0.15, cry), 1.3);
    girl.update(t, 478, 1756, 0.84, -1, Math.max(0.15, cry), 2.9);
  }
  return { g: root, update };
}

// --------------------------------------------------------- home: man2 ----
function setHomeSecond(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgHome(root, 'dim');
  const stars = new Stars(bg.skyObjects, [[450, 660, 0.5], [600, 720, 0.45], [520, 860, 0.4]], 4);
  const moon = new Moon(bg.skyObjects, 40);
  const pup = el('g', {}, root);
  const pouch = new Pouch(pup);
  const man = new Human(pup, 'man2');
  const dark = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#05060C', opacity: 0.42 }, root);
  const lampHalo = el('circle', { cx: 222, cy: 1196, r: 260, fill: 'url(#lampGlow)', opacity: 0.6 }, root);
  const hang = new Lantern(root, 0.72);
  const pouchGlow = el('circle', { cx: 700, cy: 1660, r: 200, fill: 'url(#goldGlow)', style: 'mix-blend-mode:screen', opacity: 0 }, root);
  function update(t, sc) {
    hang.update(t, 200, 560, 2.5 * Math.sin(t * 0.8 + 2), 0.5);
    stars.update(t);
    moon.update(600, 700, 4 * Math.sin(t * 0.7), 520);
    const fl = 0.8 + 0.2 * Math.sin(t * 7.1) * noise1(t * 2.5, 2);
    bg.lampGlow.setAttribute('opacity', (0.55 * fl).toFixed(3));
    lampHalo.setAttribute('opacity', (0.5 * fl).toFixed(3));
    const glint = smooth(seg(t, E.goldGlint - 0.3, E.goldGlint + 0.4));
    pouch.update(t, 660, 1716, 1.05, 0.25 + 0.75 * glint);
    pouchGlow.setAttribute('opacity', (0.15 + 0.6 * glint).toFixed(3));
    const p = Human.rest();
    p.x = 380; p.y = 1726; p.s = 0.96;
    idle(p, t, 1.9, 0.9);
    talk(p, t, [TL.at(8, 'loved').s]);
    // "Fear Allah": he flinches back and lowers his head
    const fear = smooth(seg(t, E.fearAllah[0] - 0.1, E.fearAllah[0] + 0.4));
    p.lean -= 5 * fear; p.head += 10 * fear;
    blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, { armF: [-20, -60, 0], armB: [-10, -50, 0] }, fear * 0.6);
    p.glow = 0.42 + 0.25 * fear;
    // turns his back, then hops out of frame
    const turn = smooth(seg(t, E.turnAway, E.turnAway + 0.35));
    p.dir = lerp(1, -1, turn);
    if (Math.abs(p.dir) < 0.08) p.dir = p.dir < 0 ? -0.08 : 0.08;
    hopWalk(p, t, E.walkOut[0], E.walkOut[1], 380, -260, { period: 0.42, height: 24 });
    if (t > E.walkOut[1]) p.x = -260;
    man.update(p);
  }
  return { g: root, update };
}

// --------------------------------------------------------------- valley ----
function setValley(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgValley(root);
  const sun = new Sun(bg.sky, 86);
  const birds = new Birds(bg.sky, 6, 3);
  const pup = el('g', {}, root);
  // draw order = depth (back row first); drop order: sheep, sheep, cow, camel, more
  const HERD = [
    { k: 'cow', x: 500, y: 1630, s: 0.7, drop: 5 },
    { k: 'camel', x: 845, y: 1626, s: 0.76, drop: 3 },
    { k: 'cow', x: 668, y: 1646, s: 0.76, drop: 2 },
    { k: 'sheep', x: 455, y: 1738, s: 0.84, drop: 0 },
    { k: 'sheep', x: 625, y: 1750, s: 0.86, drop: 1 },
    { k: 'sheep', x: 795, y: 1744, s: 0.84, drop: 4 },
    { k: 'sheep', x: 950, y: 1754, s: 0.82, drop: 6 },
  ].map((a, i) => Object.assign(a, { a: new Animal(pup, a.k, i + 1) }));
  const man = new Human(pup, 'man3');
  const worker = new Human(pup, 'worker');
  const glow = el('rect', { x: -200, y: -200, width: 1500, height: 2300, fill: '#FFD58A', style: 'mix-blend-mode:soft-light', opacity: 0.3 }, root);
  function update(t, sc) {
    const u = seg(t, S.third.s, S.third.e);
    sun.update(t, 690, lerp(1160, 940, easeOut(u)));
    birds.update(t, S.third.s - 3);
    // man3
    const p = Human.rest();
    p.x = 180; p.y = 1730; p.s = 0.92;
    idle(p, t, 2.4, 1);
    talk(p, t, [TL.at(10, 'wage').s, TL.at(10, 'grew').s]);
    const offer = smooth(seg(t, E.offer[0], E.offer[0] + 0.5)) * (1 - smooth(seg(t, E.leadAway[0] + 0.6, E.leadAway[0] + 1.2)));
    blendArms(p, { armF: p.armF.slice(), armB: p.armB.slice() }, POSE.offer, offer);
    p.open = offer > 0.5;
    p.head -= 4 * offer;
    man.update(p);
    // worker: leaves, comes back, leads the herd away
    const w = Human.rest();
    w.s = 0.88; w.y = 1758; w.x = 560;
    idle(w, t, 3.1, 1);
    if (t >= E.workerLeave[0]) hopWalk(w, t, E.workerLeave[0] + 0.2, E.workerLeave[1], 560, 1260, { period: 0.38 });
    if (t >= E.workerLeave[1]) w.x = 1260;
    if (t >= E.workerBack[0]) { w.dir = -1; hopWalk(w, t, E.workerBack[0], E.workerBack[1], 1260, 370, { period: 0.3, height: 22 }); }
    if (t >= E.leadAway[0]) {
      w.dir = lerp(-1, 1, smooth(seg(t, E.leadAway[0], E.leadAway[0] + 0.3)));
      if (Math.abs(w.dir) < 0.08) w.dir = 0.08;
      hopWalk(w, t, E.leadAway[0] + 0.3, E.leadAway[1] + 0.8, 370, 1320, { period: 0.32, height: 22 });
      blendArms(w, { armF: w.armF.slice(), armB: w.armB.slice() }, { armF: [-70, -20, 0], armB: w.armB.slice() }, 0.8);
    }
    worker.update(w);
    // the herd grows, one animal at a time on its strings
    for (const h of HERD) {
      const t0 = lerp(E.herd[0], E.herd[1] - 0.5, h.drop / 6);
      const ap = { x: h.x, y: h.y, s: h.s, dir: 1, walk: -1, step: 0, lift: dropLift(t, t0, 1500, 0.45), alpha: t < t0 ? 0 : 1 };
      if (t > E.leadAway[0] + 0.5) {
        const t0w = E.leadAway[0] + 0.5 + (1 - h.x / 1000) * 0.3;
        const per = 0.34, k = Math.max(0, (t - t0w) / per);
        const i = Math.floor(k), f = k - i;
        ap.x = h.x + (i + smooth(f)) * 120;
        ap.walk = f; ap.step = i; ap.lift = 22 * Math.sin(Math.PI * f);
      }
      h.a.update(t, ap);
    }
  }
  return { g: root, update };
}

// ---------------------------------------------------------------- title ----
function setTitle(parent, TL) {
  const { E, S } = TL;
  const root = el('g', {}, parent);
  const bg = bgTitle(root);
  const stars = new Stars(bg.sky, [[120, 260, 0.7], [960, 240, 0.7], [300, 1280, 0.5], [800, 1320, 0.55], [540, 220, 0.5]], 8);
  const lamps = [new Lantern(root, 0.8), new Lantern(root, 0.8)];
  function update(t, sc) {
    stars.update(t);
    lamps[0].update(t, 150, 330, 3 * Math.sin(t * 0.9));
    lamps[1].update(t, 930, 330, 3 * Math.sin(t * 0.9 + 1.4));
    const t0 = S.title.s + 0.35;
    bg.parts.forEach((p, i) => {
      const k = smooth(seg(t, t0 + i * 0.16, t0 + i * 0.16 + 0.7));
      p.setAttribute('opacity', k.toFixed(3));
      const sc2 = i === 2 ? lerp(0.9, 1, easeOut(k)) : 1;
      setT(p, `translate(540 ${i === 2 ? 760 : 0}) scale(${sc2.toFixed(4)}) translate(-540 ${i === 2 ? -760 : 0}) translate(0 ${((1 - k) * 18).toFixed(1)})`);
    });
  }
  return { g: root, update };
}

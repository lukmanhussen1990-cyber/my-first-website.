/* Rajal Digital Store — motion graphics timeline.
 *
 * Everything on screen is a pure function of time `t`: a paused GSAP master timeline for the
 * scripted animation, plus a small `procedural(t)` for ambient motion (particles, clouds, the
 * plane's flight path, camera shake). tools/render_frames.cjs calls window.renderFrame(t) for
 * every frame and screenshots the page; open index.html in a browser to preview.
 *
 * Narration timing comes from build/timeline.js (tools/make_timeline.py); animation cues are
 * locked to the exact moment each Bengali word is spoken.
 */
(function () {
'use strict';

gsap.registerPlugin(CustomEase, MotionPathPlugin, DrawSVGPlugin);

const TL = window.TIMELINE;
const W = 1920, H = 1080;
const FPS = TL.fps;
const TOTAL = TL.duration;
const TRANS = TL.transition;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
if (RENDER) document.documentElement.classList.add('render');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* ---------------- deterministic random (so every render is identical) ---------------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261008);
const rnd = (a = 0, b = 1) => a + (b - a) * R();
const pick = arr => arr[Math.floor(R() * arr.length)];

/* ---------------- timeline lookups ---------------- */
const clipById = id => TL.clips.find(c => c.id === id);
function wt(clip, word, nth = 0) {                      // absolute time a word starts being spoken
  const ws = clipById(clip).words.filter(w => w.w === word);
  if (!ws[nth]) throw new Error('word not found: ' + clip + ' ' + word);
  return ws[nth].t;
}
const S = id => TL.scenes.find(s => s.id === id).start;
const E = id => TL.scenes.find(s => s.id === id).end;

/* ---------------- sound-effect cues (consumed by tools/build_audio.py) ---------------- */
const SFX = []; window.SFX_EVENTS = SFX;
const sfx = (type, t, g = 1, o = {}) => SFX.push(Object.assign({ type, t: +t.toFixed(3), g }, o));

/* ---------------- master timeline helpers ---------------- */
const master = gsap.timeline({ paused: true });
const ft = (el, from, to, at) => master.fromTo(el, from, Object.assign({ immediateRender: false }, to), at);
const to = (el, vars, at) => master.to(el, vars, at);
const set = (el, vars, at) => master.set(el, vars, at);
const reveal = (sel, at, o = {}) => ft(sel, { yPercent: o.from ?? 240 }, { yPercent: 0, duration: o.dur ?? .62, ease: o.ease ?? 'back.out(1.5)' }, at);
const popIn = (sel, at, o = {}) => ft(sel, Object.assign({ scale: o.s ?? .3, opacity: 0 }, o.from || {}), Object.assign({ scale: 1, opacity: 1, duration: o.dur ?? .55, ease: o.ease ?? 'back.out(2)' }, o.to || {}), at);

/* ---------------- DOM prep ---------------- */
const stage = $('#stage');
const world = document.createElement('div');
world.id = 'world';
world.style.cssText = 'position:absolute;inset:0;transform-origin:50% 50%';
$$('.scene').forEach(s => world.appendChild(s));
stage.insertBefore(world, stage.firstChild);

function layer(camSel, id) {                              // burst layer inside a scene's camera
  let el = $('#' + id);
  if (!el) { el = document.createElement('div'); el.id = id; el.className = 'particles'; $(camSel).appendChild(el); }
  return el;
}

gsap.set('.mask > .w', { yPercent: 240 });
gsap.set('#s-intro', { autoAlpha: 1 });

/* ---------------- generated art: QR, barcode, awning, bulbs ---------------- */
(function buildArt() {
  // QR-like pattern
  const r = rng(7), N = 21; let q = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    if (r() > .5) q += `<rect x="${x}" y="${y}" width="1" height="1" fill="#0B1250"/>`;
  }
  [[0, 0], [14, 0], [0, 14]].forEach(([x, y]) => { q += `<rect x="${x}" y="${y}" width="7" height="7" fill="#0B1250"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0B1250"/>`; });
  $('#pc-qr').innerHTML = q;
  // barcode
  const b = rng(11); let x = 0, bc = '';
  while (x < 150) { const w = [2, 3, 5, 7][Math.floor(b() * 4)]; if (b() > .3) bc += `<rect x="${x}" y="0" width="${w}" height="200" fill="#0B1250"/>`; x += w + [2, 3, 4][Math.floor(b() * 3)]; }
  $('#barcode').innerHTML = bc;
  // awning stripes + sign bulbs
  let st = '';
  for (let i = 0; i < 8; i++) { const sx = 70 + i * 85; st += `<path d="M${sx} 248 h85 v66 a42.5 42.5 0 0 1 -85 0 z" fill="${i % 2 ? '#FFFFFF' : '#2F5BFF'}"/>`; }
  $('#st-stripes').innerHTML = st;
  let bl = '';
  for (let i = 0; i < 14; i++) bl += `<circle class="bulb" cx="${150 + i * 40}" cy="64" r="6.5" fill="#FFE08A"/>`;
  $('#st-bulbs').innerHTML = bl;
  // film grain tile
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256), gr = rng(99);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(gr() * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ---------------- ambient layers ---------------- */
function makeParticles(container, o) {
  const items = [];
  for (let i = 0; i < o.n; i++) {
    const el = document.createElement('i');
    const kind = pick(o.kinds), size = rnd(o.size[0], o.size[1]), color = pick(o.colors);
    el.style.width = el.style.height = size + 'px';
    el.style.opacity = rnd(o.alpha[0], o.alpha[1]).toFixed(2);
    if (kind === 'dot') { el.style.borderRadius = '50%'; el.style.background = color; }
    else if (kind === 'ring') { el.style.borderRadius = '50%'; el.style.border = Math.max(2, size * .14) + 'px solid ' + color; }
    else if (kind === 'plus') el.style.background = `linear-gradient(${color},${color}) center/100% 22% no-repeat,linear-gradient(${color},${color}) center/22% 100% no-repeat`;
    else if (kind === 'sq') { el.style.background = color; el.style.borderRadius = size * .2 + 'px'; }
    else if (kind === 'conf') { el.style.height = size * .5 + 'px'; el.style.background = color; el.style.borderRadius = '2px'; }
    container.appendChild(el);
    items.push({ el, x0: rnd(0, W), y0: rnd(0, H), vy: rnd(o.speed[0], o.speed[1]), amp: rnd(8, 36), fx: rnd(.3, 1.1), ph: rnd(0, 6.28), spin: rnd(-50, 50) });
  }
  return items;
}
function updateParticles(items, t) {
  const span = H + 200;
  for (const p of items) {
    const y = (((p.y0 - p.vy * t) % span) + span) % span - 100;
    const x = p.x0 + Math.sin(t * p.fx + p.ph) * p.amp;
    p.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(p.spin * t).toFixed(1)}deg)`;
  }
}
const PART = {
  intro: makeParticles($('#p-intro'), { n: 46, kinds: ['dot', 'ring', 'plus', 'sq', 'dot'], size: [6, 22], colors: ['#22D3EE', '#FFB020', '#FFFFFF', '#7DD3FC'], alpha: [.25, .75], speed: [12, 46] }),
  pan: makeParticles($('#p-pan'), { n: 34, kinds: ['dot', 'plus', 'ring'], size: [6, 20], colors: ['#7DD3FC', '#FFFFFF', '#22D3EE', '#FFD166'], alpha: [.2, .6], speed: [14, 40] }),
  cta: makeParticles($('#cta-confetti'), { n: 40, kinds: ['conf', 'conf', 'dot', 'sq'], size: [10, 26], colors: ['#0B1250', '#FFFFFF', '#E5303A', '#2F5BFF', '#FFE08A'], alpha: [.55, .95], speed: [-70, -30] }),
  outro: makeParticles($('#p-outro'), { n: 44, kinds: ['dot', 'ring', 'plus', 'sq'], size: [6, 22], colors: ['#22D3EE', '#FFB020', '#FFFFFF', '#7DD3FC'], alpha: [.25, .75], speed: [12, 46] }),
};

// stars
const STARS = [];
(function () {
  const c = $('#fl-stars');
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('i'), s = rnd(2, 5.5);
    el.style.cssText = `position:absolute;left:${rnd(0, W)}px;top:${rnd(0, H * .58)}px;width:${s}px;height:${s}px;border-radius:50%;background:#fff`;
    c.appendChild(el); STARS.push({ el, f: rnd(.8, 3), ph: rnd(0, 6.28), base: rnd(.35, 1) });
  }
})();

// clouds
function makeClouds(svg, specs) {
  return specs.map(sp => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('fill', sp.fill); g.setAttribute('opacity', sp.op);
    g.innerHTML = `<g transform="scale(${sp.s})"><circle cx="0" cy="0" r="62"/><circle cx="78" cy="-28" r="84"/><circle cx="172" cy="-6" r="66"/><circle cx="244" cy="14" r="46"/><rect x="-62" y="0" width="346" height="62" rx="31"/></g>`;
    svg.appendChild(g);
    return Object.assign({ g }, sp);
  });
}
const CLOUDS = [
  ...makeClouds($('#fl-clouds-far'), [
    { x0: 120, y: 470, s: .8, fill: '#FFC2D4', op: .20, speed: 14 }, { x0: 760, y: 560, s: 1.0, fill: '#FFC2D4', op: .22, speed: 18 },
    { x0: 1380, y: 420, s: .7, fill: '#E9B5FF', op: .18, speed: 12 }, { x0: 1900, y: 620, s: 1.2, fill: '#FFC2D4', op: .24, speed: 20 },
    { x0: 420, y: 700, s: 1.1, fill: '#FFD7A8', op: .30, speed: 26 }, { x0: 1180, y: 770, s: 1.3, fill: '#FFD7A8', op: .32, speed: 30 },
  ]),
  ...makeClouds($('#fl-clouds-near'), [
    { x0: 80, y: 1110, s: 1.7, fill: '#FFFFFF', op: .92, speed: 60 }, { x0: 640, y: 1130, s: 2.0, fill: '#FFE9F0', op: .95, speed: 74 },
    { x0: 1240, y: 1100, s: 1.8, fill: '#FFFFFF', op: .92, speed: 66 }, { x0: 1800, y: 1140, s: 2.1, fill: '#FFE9F0', op: .95, speed: 80 },
    { x0: 980, y: 1160, s: 2.4, fill: '#FFFFFF', op: .98, speed: 92 },
  ]),
];

/* ---------------- effects ---------------- */
function burst(container, o) {
  const cont = typeof container === 'string' ? $(container) : container;
  const n = o.n || 16, cols = o.colors || ['#FFB020', '#22D3EE', '#FFFFFF'], dur = o.dur || 1.1;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i'), sz = rnd(o.size ? o.size[0] : 12, o.size ? o.size[1] : 28);
    el.style.cssText = `width:${sz}px;height:${sz}px;opacity:0;margin:${-sz / 2}px 0 0 ${-sz / 2}px;color:${pick(cols)}`;
    const shape = o.shape || 'spark';
    if (shape === 'spark') el.innerHTML = '<svg viewBox="-12 -12 24 24" style="width:100%;height:100%;display:block"><use href="#i-spark"/></svg>';
    else if (shape === 'conf') { el.style.height = sz * .5 + 'px'; el.style.background = 'currentColor'; el.style.borderRadius = '2px'; }
    else { el.style.background = 'currentColor'; el.style.borderRadius = '50%'; }
    cont.appendChild(el);
    const ang = (i / n) * Math.PI * 2 + rnd(-.3, .3), dist = rnd(o.r ? o.r[0] : 120, o.r ? o.r[1] : 380);
    ft(el, { x: o.cx, y: o.cy, scale: 0, opacity: 1, rotation: 0 },
      { x: o.cx + Math.cos(ang) * dist, y: o.cy + Math.sin(ang) * dist * (o.squash || 1) + (o.fall || 0), scale: rnd(.7, 1.3), rotation: rnd(-200, 200), duration: dur, ease: 'power3.out' }, o.at);
    to(el, { opacity: 0, scale: 0, duration: dur * .45, ease: 'power1.in' }, o.at + dur * .6);
  }
}

function circleWipe(sel, at, cx, cy, r1, r2, col1, col2) {
  ft(sel, { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(1950px at ${cx}px ${cy}px)`, duration: TRANS, ease: 'power3.inOut' }, at);
  [[r1, 1.95, 0, col1], [r2, 1.78, .07, col2]].forEach(([ring, end, delay, col]) => {
    set(ring, Object.assign({ x: cx - W / 2, y: cy - H / 2, opacity: 1 }, col ? { borderColor: col, boxShadow: `0 0 60px ${col}, inset 0 0 60px ${col}` } : {}), at + delay);
    ft(ring, { scale: 0 }, { scale: end, duration: TRANS - delay * .5, ease: 'power3.inOut' }, at + delay);
    set(ring, { opacity: 0 }, at + TRANS + .02);
  });
}

function sliceWipe(sel, at, dir, bandsLead, bandsTrail) {
  const A0 = dir > 0 ? 0 : 2340, A1 = dir > 0 ? 2340 : 0;
  const poly = A => dir > 0
    ? `polygon(0px 0px, ${A}px 0px, ${A - 420}px 1080px, 0px 1080px)`
    : `polygon(${A}px 0px, 1920px 0px, 1920px 1080px, ${A - 420}px 1080px)`;
  ft(sel, { clipPath: poly(A0) }, { clipPath: poly(A1), duration: TRANS, ease: 'power3.inOut' }, at);
  const place = (band, width, off) => {                       // band center follows the slanted edge (centre line = A - 210)
    const x = A => A - 210 + off - width / 2;
    set(band, { opacity: 1 }, at);
    ft(band, { x: x(A0) }, { x: x(A1), duration: TRANS, ease: 'power3.inOut' }, at);
    set(band, { opacity: 0 }, at + TRANS + .02);
  };
  place(bandsLead[0], bandsLead[1], dir > 0 ? 70 : -70);
  place(bandsTrail[0], bandsTrail[1], dir > 0 ? -50 : 50);
}
gsap.set('.wipe-band', { skewX: -21, x: -600 });

/* =====================================================================
   SCENE 1 — INTRO
   ===================================================================== */
(function intro() {
  const e = E('intro');
  gsap.set('#intro-logo', { opacity: 0, scale: 0 });
  ft('#fade', { opacity: 1 }, { opacity: 0, duration: .7, ease: 'power2.out' }, 0);
  ft('#cam-intro', { scale: 1 }, { scale: 1.07, duration: e, ease: 'none' }, 0);

  // logo lands
  ft('#intro-logo', { scale: 0, rotation: -150, opacity: 1 }, { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.8)' }, .3);
  ft('#intro-halo', { scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.4, ease: 'power2.out' }, .5);
  ft('#intro-ring1', { scale: .5, opacity: .95 }, { scale: 4.4, opacity: 0, duration: 1.2, ease: 'power2.out' }, .62);
  ft('#intro-ring2', { scale: .5, opacity: .95 }, { scale: 3.2, opacity: 0, duration: 1.0, ease: 'power2.out' }, .78);
  burst('#intro-sparks', { cx: 960, cy: 290, n: 22, at: .62, r: [200, 560], size: [14, 34] });
  sfx('riser', .05, .7, { dur: .55 }); sfx('impact', .62, 1);

  // brand words, locked to the narration
  const a = wt('intro.1', 'রাজাল'), b = wt('intro.1', 'ডিজিটাল'), c = wt('intro.1', 'স্টোরে');
  reveal('#ib1', a - .06); reveal('#ib2', b - .06); reveal('#ib3', c - .06);
  [a, b, c].forEach((t, i) => sfx('tick', t - .04, .85, { n: i }));
  ft('#intro-en', { opacity: 0, letterSpacing: '46px' }, { opacity: 1, letterSpacing: '16px', duration: 1.0, ease: 'power3.out' }, c + .1);

  // welcome pill on "স্বাগতম"
  const w = wt('intro.1', 'স্বাগতম');
  ft('#intro-welcome', { scale: 0, rotation: -14, y: 40, opacity: 1 }, { scale: 1, rotation: -3, y: 0, duration: .8, ease: 'back.out(2.2)' }, w - .1);
  burst('#intro-sparks', { cx: 960, cy: 836, n: 18, at: w + .02, r: [260, 620], size: [12, 30], squash: .55 });
  sfx('ding', w - .04, .9); sfx('sparkle', w + .06, .7);

  // hand over to the PAN scene
  to('#s-intro', { opacity: .4, duration: TRANS, ease: 'power2.in' }, S('pan'));
  set('#s-intro', { autoAlpha: 0 }, e);
})();

/* =====================================================================
   SCENE 2 — PAN CARD
   ===================================================================== */
(function pan() {
  const s = S('pan'), e = E('pan');
  gsap.set('#s-pan', { clipPath: 'circle(0px at 960px 450px)' });
  set('#s-pan', { autoAlpha: 1 }, s);
  circleWipe('#s-pan', s, 960, 450, '#wr1', '#wr2');
  sfx('whoosh', s - .02, 1, { dur: TRANS + .1 });
  ft('#cam-pan', { scale: 1 }, { scale: 1.045, duration: e - s, ease: 'none' }, s);

  // ambience
  ft('#pan-wm', { x: 280 }, { x: -120, duration: e - s, ease: 'power2.out' }, s);
  ft('#pan-wm', { opacity: 0 }, { opacity: 1, duration: 1.2 }, s + .3);
  to('#pan-beam1', { x: 760, duration: e - s, ease: 'none' }, s);
  to('#pan-beam2', { x: -560, duration: e - s, ease: 'none' }, s);

  // title
  const t1 = wt('pan.1', 'প্যান'), t2 = wt('pan.1', 'কার্ড');
  gsap.set(['#pan-tag', '#pan-chips .chip'], { opacity: 0 });
  ft('#pan-tag', { x: -320, opacity: 0 }, { x: 0, opacity: 1, duration: .6, ease: 'back.out(1.5)' }, s + .5);
  reveal('#pt1', t1 - .06); reveal('#pt2', t2 - .06);
  sfx('pop', t1 - .04, 1, { n: 0 }); sfx('pop', t2 - .04, 1, { n: 2 });
  set('#pan-underline', { opacity: 1 }, 0);
  gsap.set('#pan-ul-path', { drawSVG: '0% 0%' });
  ft('#pan-ul-path', { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: .6, ease: 'power2.out' }, t2 + .25);
  sfx('swish', t2 + .25, .6, { dur: .5 });

  // card flies in
  gsap.set('#pan-float', { transformPerspective: 1500, transformOrigin: '50% 50%', opacity: 0 });
  ft('#pan-float', { x: 780, y: 260, rotationY: -88, rotationX: 30, rotation: 26, scale: .45, opacity: 0 },
    { x: 0, y: 0, rotationY: -16, rotationX: 6, rotation: -4, scale: 1, opacity: 1, duration: 1.15, ease: 'back.out(1.25)' }, t1);
  sfx('whoosh', t1 + .02, .75, { dur: .8, lo: 1 });
  ft('#pan-glow', { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, t1 + .2);
  ft('#pan-shadow', { opacity: 0 }, { opacity: 1, duration: 1.0 }, t1 + .4);

  // "?" bubble -> "✓"
  const q = wt('pan.1', 'বানাতে') - .04;
  gsap.set('#pan-q', { transformPerspective: 700, rotationY: 0 });
  ft('#pan-q', { scale: 0, rotation: -30, opacity: 1 }, { scale: 1, rotation: 8, duration: .7, ease: 'elastic.out(1,.45)' }, q);
  to('#pan-q', { rotation: -6, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut' }, q + .75);
  sfx('pop', q, 1, { n: 4 });
  const flip = wt('pan.2', 'কোনো') - .06;
  ft('#pan-q', { rotationY: 0 }, { rotationY: 180, duration: .6, ease: 'back.out(1.5)' }, flip);
  sfx('flip', flip, .8, { dur: .35 }); sfx('ding', flip + .32, .8);

  // "ঝামেলা নেই!" stamp lands on "নেই"
  const nei = wt('pan.2', 'নেই'), hit = nei + .02;
  ft('#pan-stamp', { scale: 2.8, rotation: -24, opacity: 0 }, { scale: 1, rotation: -9, opacity: 1, duration: .24, ease: 'power3.in' }, hit - .24);
  to('#pan-stamp', { scale: 1.07, duration: .08, yoyo: true, repeat: 1, ease: 'sine.inOut' }, hit);
  ft('#pc-shine', { left: '-60%', opacity: 1 }, { left: '150%', duration: .85, ease: 'power2.inOut' }, hit + .05);
  set('#pc-shine', { opacity: 0 }, hit + .95);
  burst(layer('#cam-pan', 'burst-pan'), { cx: 1300, cy: 600, n: 20, at: hit, r: [160, 420], size: [12, 30], colors: ['#2EE59D', '#FFFFFF', '#FFD166', '#7DD3FC'] });
  sfx('stamp', hit, 1.1); sfx('sparkle', hit + .05, .7);

  // chips: "সহজে" / "দ্রুত" / "এখানেই"
  const chips = [['#pc1', wt('pan.3', 'সহজে')], ['#pc2', wt('pan.3', 'দ্রুত')], ['#pc3', wt('pan.3', 'এখানেই')]];
  chips.forEach(([sel, t], i) => {
    ft(sel, { x: -560, opacity: 0 }, { x: 0, opacity: 1, duration: .6, ease: 'back.out(1.4)' }, t - .06);
    ft(sel + ' .ic', { scale: 1 }, { scale: 1.25, duration: .18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t + .35);
    sfx('pop', t - .04, 1, { n: 6 + i * 2 });
  });
  burst(layer('#cam-pan', 'burst-pan'), { cx: 330, cy: 902, n: 14, at: chips[2][1] + .3, r: [120, 300], size: [10, 24], colors: ['#7DD3FC', '#FFFFFF', '#FFD166'] });

  // brand bug + hand over to flight
  ft('#bug', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' }, s + TRANS + .2);
  to('#s-pan', { opacity: .4, duration: TRANS, ease: 'power2.in' }, S('flight'));
  set('#s-pan', { autoAlpha: 0 }, e);
})();

/* =====================================================================
   SCENE 3 — FLIGHT TICKET BOOKING
   ===================================================================== */
const route = $('#route'), routeLen = route.getTotalLength();
const trail = $('#route-trail'), routeMask = $('#route-mask');
const plane = $('#plane');
let FLY0 = 0, FLY1 = 0;
(function flight() {
  const s = S('flight'), e = E('flight');
  gsap.set('#s-flight', { clipPath: 'polygon(0px 0px, 0px 0px, -420px 1080px, 0px 1080px)' });
  set('#s-flight', { autoAlpha: 1 }, s);
  sliceWipe('#s-flight', s, +1, ['#wb1', 150], ['#wb2', 90]);
  sfx('whoosh', s - .02, 1, { dur: TRANS + .1 });
  ft('#cam-flight', { scale: 1 }, { scale: 1.04, duration: e - s, ease: 'none' }, s);
  ft('#fl-sun', { y: 320, opacity: 0 }, { y: 0, opacity: 1, duration: 2.2, ease: 'power2.out' }, s + .2);

  gsap.set(['#fl-tag', '#fl-btn', '#pass-stage', '#plane', '#pin-home', '#pin-dest', '#fl-lab-home', '#fl-lab-dest'], { opacity: 0 });
  routeMask.style.strokeDasharray = routeLen; routeMask.style.strokeDashoffset = routeLen;
  trail.style.strokeDasharray = routeLen; trail.style.strokeDashoffset = routeLen;

  // "কোথাও যাবেন?" — the mystery destination and the route being drawn
  const k1 = wt('flight.1', 'কোথাও'), k2 = wt('flight.1', 'যাবেন');
  gsap.set('#pin-dest', { svgOrigin: '1690 840' });
  ft('#pin-dest', { scale: 0, opacity: 1 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)' }, k1);
  to('#pin-dest', { rotation: 6, duration: .2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, k2 + .3);
  ft(routeMask, { strokeDashoffset: routeLen }, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, k1 + .1);
  sfx('pop', k1 - .02, 1, { n: 3 }); sfx('swish', k1 + .1, .6, { dur: .8 });

  // "ঘরের কাছেই"
  const h1 = wt('flight.2', 'ঘরের'), h2 = wt('flight.2', 'কাছেই');
  gsap.set('#pin-home', { svgOrigin: '260 930' });
  ft('#pin-home', { scale: 0, opacity: 1 }, { scale: 1, duration: .7, ease: 'back.out(2.2)' }, h1 - .05);
  ft('#fl-lab-home', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: .55, ease: 'back.out(1.6)' }, h2 - .05);
  sfx('pop', h1 - .03, 1, { n: 5 }); sfx('pop', h2 - .03, .9, { n: 8 });

  // title on "ফ্লাইট" "টিকিট" "বুক"
  const f1 = wt('flight.2', 'ফ্লাইট'), f2 = wt('flight.2', 'টিকিট'), f3 = wt('flight.2', 'বুক'), f4 = wt('flight.2', 'করুন');
  ft('#fl-tag', { x: -320, opacity: 0 }, { x: 0, opacity: 1, duration: .6, ease: 'back.out(1.5)' }, f1 - .3);
  reveal('#ft1', f1 - .06); reveal('#ft2', f2 - .06); reveal('#ft3', f3 - .06);
  sfx('pop', f1 - .04, 1, { n: 0 }); sfx('pop', f2 - .04, 1, { n: 2 }); sfx('pop', f3 - .04, 1, { n: 4 });

  // boarding pass
  gsap.set('#pass-stage', { transformPerspective: 1600 });
  ft('#pass-stage', { x: 420, y: 520, rotation: 20, rotationY: -40, scale: .6, opacity: 0 },
    { x: 0, y: 0, rotation: 4, rotationY: -8, scale: 1, opacity: 1, duration: 1.0, ease: 'back.out(1.2)' }, f1 - .05);
  sfx('whoosh', f1 - .02, .7, { dur: .8, lo: 1 });

  // booking button, pressed on "করুন"
  ft('#fl-btn', { y: 90, scale: .6, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .55, ease: 'back.out(2)' }, f3 + .1);
  const press = f4 + .02;
  to('#fl-btn', { scale: .93, y: 8, duration: .09, ease: 'power2.in' }, press);
  to('#fl-btn', { scale: 1, y: 0, duration: .35, ease: 'back.out(3)' }, press + .09);
  ft('#fl-tap', { scale: .3, opacity: .9 }, { scale: 3.2, opacity: 0, duration: .6, ease: 'power2.out' }, press);
  ft('#fl-bi', { backgroundColor: '#0B1250' }, { backgroundColor: '#12B76A', duration: .25 }, press + .1);
  ft('#fl-bi .i1', { opacity: 1, scale: 1 }, { opacity: 0, scale: .3, duration: .2 }, press + .1);
  ft('#fl-bi .i2', { opacity: 0, scale: .3 }, { opacity: 1, scale: 1, duration: .35, ease: 'back.out(2.5)' }, press + .18);
  ft('#fl-btn .t1', { opacity: 1, y: 0 }, { opacity: 0, y: -30, duration: .22 }, press + .1);
  ft('#fl-btn .t2', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .3, ease: 'back.out(2)' }, press + .2);
  sfx('click', press, 1); sfx('ding', press + .2, .8);

  // take off on "উড়ে" — plane + trail follow the route (see procedural)
  FLY0 = wt('flight.2', 'উড়ে') - .07; FLY1 = FLY0 + 1.3;
  gsap.set('#plane-art', { svgOrigin: '0 0', scale: 0 });
  set('#plane', { opacity: 1 }, FLY0 - .05);
  ft('#plane-art', { scale: 0 }, { scale: .86, duration: .35, ease: 'back.out(2)' }, FLY0 - .05);
  to('#plane-art', { scale: .3, duration: .28, ease: 'power2.in' }, FLY1 - .02);
  set('#plane', { opacity: 0 }, FLY1 + .28);
  sfx('plane', FLY0 - .05, 1, { dur: 1.5 });
  const d1 = wt('flight.2', 'পছন্দের') - .05;
  ft('#fl-lab-dest', { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: .55, ease: 'back.out(1.6)' }, d1);
  sfx('pop', d1, .9, { n: 7 });

  // arrival: "?" becomes "✓" + confetti on "গন্তব্যে"
  const arr = FLY1 - .02;
  gsap.set(['#pin-q', '#pin-ok'], { svgOrigin: '1690 704' });
  ft('#pin-q', { opacity: 1, scale: 1 }, { opacity: 0, scale: .2, duration: .18 }, arr);
  ft('#pin-ok', { opacity: 0, scale: .2 }, { opacity: 1, scale: 1, duration: .45, ease: 'back.out(3)' }, arr + .1);
  to('#pin-dest', { scale: 1.12, duration: .15, yoyo: true, repeat: 1, ease: 'sine.inOut' }, arr);
  burst(layer('#cam-flight', 'burst-flight'), { cx: 1690, cy: 700, n: 26, at: arr, r: [200, 520], size: [14, 34], colors: ['#FFD166', '#FFFFFF', '#FF8AB0', '#7DD3FC', '#2EE59D'] });
  sfx('ding', arr, 1); sfx('sparkle', arr + .05, .8);

  to('#bug', { opacity: 0, y: -20, duration: .35, ease: 'power2.in' }, S('cta') - .45);
  to('#s-flight', { opacity: .4, duration: TRANS, ease: 'power2.in' }, S('cta'));
  set('#s-flight', { autoAlpha: 0 }, e);
})();

/* =====================================================================
   SCENE 4 — CTA : come to Uttar Fulbari
   ===================================================================== */
(function cta() {
  const s = S('cta'), e = E('cta');
  gsap.set('#s-cta', { clipPath: 'circle(0px at 1400px 700px)' });
  set('#s-cta', { autoAlpha: 1 }, s);
  circleWipe('#s-cta', s, 1400, 700, '#wr1', '#wr2', '#FFFFFF', '#0B1250');
  sfx('whoosh', s - .02, 1, { dur: TRANS + .1 });
  ft('#cam-cta', { scale: 1 }, { scale: 1.04, duration: e - s, ease: 'none' }, s);

  // kicker: "তাহলে আর দেরি কেন?"
  const k = ['তাহলে', 'আর', 'দেরি', 'কেন'].map(w => wt('cta.1', w));
  ['#ck1', '#ck2', '#ck3', '#ck4'].forEach((sel, i) => { reveal(sel, k[i] - .06, { dur: .5 }); sfx('tick', k[i] - .04, .85, { n: i }); });
  gsap.set('#cta-clock', { svgOrigin: '50 56', opacity: 0, scale: 0 });
  ft('#cta-clock', { scale: 0, rotation: -40, opacity: 1 }, { scale: 1, rotation: 0, duration: .6, ease: 'back.out(2.4)' }, s + .55);
  gsap.set(['#clock-hand-m', '#clock-hand-h'], { svgOrigin: '50 56' });
  ft('#clock-hand-m', { rotation: 0 }, { rotation: 1080, duration: 1.2, ease: 'power1.inOut' }, k[0]);
  ft('#clock-hand-h', { rotation: 0 }, { rotation: 90, duration: 1.2, ease: 'power1.inOut' }, k[0]);
  to('#cta-clock', { rotation: 8, duration: .09, yoyo: true, repeat: 7, ease: 'sine.inOut' }, k[2]);

  // storefront builds up
  const parts = [
    ['#st-shadow', s + .35, { x: 0, y: 0, scaleX: .4 }, { scaleX: 1 }],
    ['#st-body', s + .45, { y: 160 }, { y: 0 }],
    ['#st-winL', s + .85, { scale: .4 }, { scale: 1 }],
    ['#st-winR', s + .95, { scale: .4 }, { scale: 1 }],
    ['#st-door', s + 1.05, { scale: .5 }, { scale: 1 }],
    ['#st-awning', s + 1.2, { y: -190 }, { y: 0, ease: 'bounce.out', duration: .8 }],
    ['#st-signwrap', s + 1.55, { scaleY: .05, y: 10 }, { scaleY: 1, y: 0 }],
    ['#st-plantL', s + 1.75, { scale: .2 }, { scale: 1 }],
    ['#st-plantR', s + 1.85, { scale: .2 }, { scale: 1 }],
  ];
  gsap.set(parts.map(p => p[0]), { opacity: 0 });
  gsap.set('#st-winL', { svgOrigin: '206 491' }); gsap.set('#st-winR', { svgOrigin: '614 491' });
  gsap.set('#st-door', { svgOrigin: '410 528' }); gsap.set('#st-signwrap', { svgOrigin: '410 140' });
  gsap.set('#st-plantL', { svgOrigin: '63 746' }); gsap.set('#st-plantR', { svgOrigin: '757 746' });
  gsap.set('#st-shadow', { svgOrigin: '410 748' });
  parts.forEach(([sel, t, from, toV], i) => {
    ft(sel, Object.assign({ opacity: 0 }, from), Object.assign({ opacity: 1, duration: .6, ease: 'back.out(1.7)' }, toV), t);
    sfx('pop', t, .75, { n: 1 + (i % 6) });
  });

  // headline: "আজই চলে আসুন"
  const a = wt('cta.2', 'আজই'), b = wt('cta.2', 'চলে'), c = wt('cta.2', 'আসুন');
  reveal('#cb1', a - .06); reveal('#cb2', b - .06); reveal('#cb3', c - .08, { dur: .7, ease: 'back.out(2.2)' });
  sfx('pop', a - .04, 1, { n: 0 }); sfx('pop', b - .04, 1, { n: 2 }); sfx('impact', c + .06, 1);
  burst(layer('#cam-cta', 'burst-cta'), { cx: 520, cy: 640, n: 22, at: c + .06, r: [220, 560], size: [14, 34], colors: ['#FFFFFF', '#0B1250', '#E5303A', '#FFE08A'], squash: .7 });

  // location: "উত্তর ফুলবাড়ির"
  const u = wt('cta.2', 'উত্তর');
  ft('#cta-loc', { scale: .3, x: -160, opacity: 0 }, { scale: 1, x: 0, opacity: 1, duration: .65, ease: 'back.out(1.8)' }, u - .06);
  to('#cta-loc .li', { y: -16, duration: .2, yoyo: true, repeat: 3, ease: 'sine.out' }, u + .5);
  sfx('pop', u - .04, 1, { n: 6 }); sfx('drop', u + .5, .9);
  gsap.set('#st-pin', { svgOrigin: '410 56', opacity: 0 });
  ft('#st-pin', { y: -520, opacity: 1, scaleY: 1.25 }, { y: 0, scaleY: 1, duration: .75, ease: 'bounce.out' }, u - .05);
  sfx('drop', u + .28, 1);

  // sign lights up on "রাজাল ডিজিটাল স্টোরে", door opens on "স্টোরে"
  const sg = wt('cta.2', 'রাজাল'), dr = wt('cta.2', 'স্টোরে');
  master.to('#st-signglow', { keyframes: [{ opacity: .9, duration: .06 }, { opacity: .2, duration: .06 }, { opacity: 1, duration: .06 }, { opacity: .4, duration: .06 }, { opacity: .95, duration: .12 }], ease: 'none' }, sg - .05);
  sfx('neon', sg - .05, .9);
  gsap.set('#st-doorpanel', { svgOrigin: '340 536' });
  ft('#st-doorpanel', { scaleX: 1 }, { scaleX: .12, duration: .85, ease: 'power2.inOut' }, dr - .25);
  ft('#st-lightbeam', { opacity: 0 }, { opacity: .55, duration: .6, ease: 'power2.out' }, dr - .1);
  gsap.set('#st-open', { svgOrigin: '410 404' });
  to('#st-open', { rotation: 9, duration: .3, yoyo: true, repeat: 7, ease: 'sine.inOut' }, dr - .3);
  sfx('chime', dr - .05, 1);
  burst(layer('#cam-cta', 'burst-cta'), { cx: 1420, cy: 640, n: 28, at: dr + .1, r: [220, 620], size: [14, 34], colors: ['#FFFFFF', '#0B1250', '#E5303A', '#2F5BFF', '#FFE08A'] });
  sfx('sparkle', dr + .12, .9);

  to('#s-cta', { opacity: .4, duration: TRANS, ease: 'power2.in' }, S('outro'));
  set('#s-cta', { autoAlpha: 0 }, e);
})();

/* =====================================================================
   SCENE 5 — OUTRO
   ===================================================================== */
(function outro() {
  const s = S('outro'), e = E('outro');
  gsap.set('#s-outro', { clipPath: 'polygon(2340px 0px, 1920px 0px, 1920px 1080px, 1920px 1080px)' });
  set('#s-outro', { autoAlpha: 1 }, s);
  sliceWipe('#s-outro', s, -1, ['#wb4', 150], ['#wb2', 90]);
  sfx('whoosh', s - .02, 1, { dur: TRANS + .1 });
  ft('#cam-outro', { scale: 1 }, { scale: 1.05, duration: e - s, ease: 'none' }, s);

  gsap.set('#outro-logo', { opacity: 0, scale: 0 });
  ft('#outro-logo', { scale: 0, rotation: -150, opacity: 1 }, { scale: 1, rotation: 0, duration: .9, ease: 'back.out(1.8)' }, s + .45);
  ft('#outro-halo', { scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.3, ease: 'power2.out' }, s + .6);
  burst(layer('#cam-outro', 'burst-outro'), { cx: 960, cy: 240, n: 18, at: s + .7, r: [180, 480], size: [12, 30] });
  sfx('impact', s + .7, .9);

  const brand = ['রাজাল', 'ডিজিটাল', 'স্টোর'].map(w => wt('outro.1', w));
  ['#ob1', '#ob2', '#ob3'].forEach((sel, i) => { reveal(sel, brand[i] - .06); sfx('tick', brand[i] - .04, .85, { n: i }); });

  const tag = ['আপনার', 'বিশ্বস্ত', 'ডিজিটাল', 'সঙ্গী'].map((w, i) => wt('outro.1', w, i === 2 ? 1 : 0));
  ['#tg1', '#tg2', '#tg3', '#tg4'].forEach((sel, i) => { reveal(sel, tag[i] - .06, { ease: 'back.out(1.8)' }); sfx('tick', tag[i] - .04, .9, { n: 3 + i }); });

  // services + location recap after the last word
  const rec = wt('outro.1', 'সঙ্গী') + .5;
  gsap.set(['#sv1', '#sv2', '#sv3'], { opacity: 0 });
  ['#sv1', '#sv2', '#sv3'].forEach((sel, i) => {
    ft(sel, { y: 90, opacity: 0, scale: .8 }, { y: 0, opacity: 1, scale: 1, duration: .6, ease: 'back.out(1.7)' }, rec + i * .22);
    sfx('pop', rec + i * .22, .9, { n: 4 + i * 2 });
  });
  burst(layer('#cam-outro', 'burst-outro'), { cx: 960, cy: 540, n: 26, at: rec - .1, r: [420, 820], size: [12, 30], squash: .55 });
  sfx('ding', rec - .1, 1); sfx('sparkle', rec, .8);

  ft('#fade', { opacity: 0 }, { opacity: 1, duration: .6, ease: 'power2.in' }, TOTAL - .6);
})();

/* =====================================================================
   per-frame ambient motion
   ===================================================================== */
const SHAKES = [{ t: .62, a: 7 }, { t: 7.1, a: 15 }, { t: wt('cta.2', 'আসুন') + .06, a: 17 }, { t: S('outro') + .7, a: 6 }];
const easePlane = gsap.parseEase('power2.inOut');
const rays = $('#cta-rays'), grain = $('#grain');
const bulbs = $$('.bulb');
const pancard = $('#pancard'), panShadow = $('#pan-shadow'), passWrap = $('#pass-wrap'), pinBob = $('#st-pin-bob');

function procedural(t) {
  // particles (only while their scene is on screen)
  if (t < E('intro') + .1) updateParticles(PART.intro, t);
  if (t > S('pan') && t < E('pan') + .1) updateParticles(PART.pan, t);
  if (t > S('cta') && t < E('cta') + .1) updateParticles(PART.cta, t);
  if (t > S('outro')) updateParticles(PART.outro, t);

  // PAN card hover + shadow breathing; boarding pass sway
  const fl = Math.sin(t * 1.7);
  pancard.style.transform = `translateY(${(fl * 11).toFixed(2)}px) rotate(${(Math.sin(t * 1.1) * .9).toFixed(2)}deg)`;
  panShadow.style.transform = `scale(${(1 - fl * .05).toFixed(3)})`;
  passWrap.style.transform = `translateY(${(Math.sin(t * 1.5 + 1) * 9).toFixed(2)}px) rotate(${(Math.sin(t * 1.0) * .7).toFixed(2)}deg)`;

  // flight scene: stars, clouds, plane + trail
  if (t > S('flight') - .1 && t < E('flight') + .1) {
    for (const st of STARS) st.el.style.opacity = (st.base * (.45 + .55 * Math.sin(t * st.f + st.ph))).toFixed(2);
    const span = W + 900;
    for (const c of CLOUDS) {
      const x = (((c.x0 - c.speed * t) % span) + span) % span - 520;
      c.g.setAttribute('transform', `translate(${x.toFixed(1)} ${c.y})`);
    }
    const p = easePlane(clamp((t - FLY0) / (FLY1 - FLY0)));
    const L = routeLen * p;
    const pt = route.getPointAtLength(L), a = route.getPointAtLength(Math.max(0, L - 5)), b = route.getPointAtLength(Math.min(routeLen, L + 5));
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    plane.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${(pt.y + (t < FLY0 ? Math.sin(t * 3) * 4 : 0)).toFixed(2)}) rotate(${ang.toFixed(2)})`);
    trail.style.strokeDashoffset = (routeLen * (1 - p)).toFixed(1);
  }

  // CTA scene: rotating rays, blinking sign bulbs, pin bob
  if (t > S('cta') && t < E('cta') + .1) {
    rays.style.transform = `rotate(${(t * 5).toFixed(2)}deg)`;
    bulbs.forEach((b, i) => b.setAttribute('opacity', (.45 + .55 * Math.max(0, Math.sin(t * 7 + i * .9))).toFixed(2)));
    pinBob.setAttribute('transform', `translate(0 ${(-Math.abs(Math.sin(t * 2.6)) * 10).toFixed(2)})`);
  }

  // screen shake on hits (translate/rotate/zoom the whole world)
  let dx = 0, dy = 0, rot = 0, k = 0;
  for (const sh of SHAKES) {
    const d = t - sh.t;
    if (d >= 0 && d < 1) { const env = Math.exp(-d * 7) * sh.a; dx += env * Math.sin(d * 61); dy += env * .7 * Math.cos(d * 53); rot += env * .012 * Math.sin(d * 47); k += env; }
  }
  world.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(1 + k / 900).toFixed(4)})`;

  // film grain
  const f = Math.floor(t * FPS);
  grain.style.transform = `translate(${(f * 37) % 256}px,${(f * 61) % 256}px)`;
}

/* ---------------- public API ---------------- */
function renderFrame(t) {
  t = clamp(t, .001, TOTAL);
  master.time(t, true);
  procedural(t);
}
window.renderFrame = renderFrame;
window.TOTAL = TOTAL;
window.FPS = FPS;

window.__ready = (async () => {
  const faces = ['800 100px Baloo', '700 40px Baloo', '600 40px Baloo', '700 30px Hind', '600 30px Hind', '500 30px Hind', '800 40px Poppins', '700 40px Poppins', '600 40px Poppins'];
  await Promise.all(faces.map(f => document.fonts.load(f, 'রাজাল ডিজিটাল স্টোর AaXx0123')));
  await document.fonts.ready;
  renderFrame(.001);
  return true;
})();

/* ---------------- browser preview ---------------- */
function fit() {
  if (RENDER) { stage.style.transform = 'none'; return; }
  const s = Math.min(innerWidth / W, (innerHeight - 52) / H);
  stage.style.transform = `scale(${s})`;
}
addEventListener('resize', fit); fit();

if (!RENDER) {
  const ui = { play: $('#ui-play'), seek: $('#ui-seek'), time: $('#ui-time') };
  let playing = false, t0 = 0, base = 0, cur = 0;
  const show = t => { cur = t; renderFrame(t); ui.seek.value = Math.round(t / TOTAL * 3000); ui.time.textContent = t.toFixed(2) + ' / ' + TOTAL.toFixed(2) + ' s'; };
  ui.play.onclick = () => {
    if (playing) { playing = false; ui.play.textContent = 'Play'; return; }
    if (cur >= TOTAL - .05) cur = 0;
    playing = true; base = cur; t0 = performance.now(); ui.play.textContent = 'Pause';
  };
  ui.seek.oninput = () => { playing = false; ui.play.textContent = 'Play'; show(ui.seek.value / 3000 * TOTAL); };
  (function loop(now) {
    if (playing) { const t = base + (now - t0) / 1000; if (t >= TOTAL) { playing = false; ui.play.textContent = 'Play'; show(TOTAL); } else show(t); }
    requestAnimationFrame(loop);
  })(performance.now());
  window.__ready.then(() => show(params.has('t') ? parseFloat(params.get('t')) : 0));
}
})();

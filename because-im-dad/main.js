// main.js — timeline, frame composition, preview player and render hooks.
'use strict';

const CAPTION = 'Because I’m Dad...';
const CHANNEL = ''; // optional watermark in the top-left corner, e.g. 'YOUR CHANNEL'
const FADE_OUT = 0.9; // fade to black at the very end
const TAIL = 0;       // the song ends exactly when the picture fades out

let TL = [];
function buildTimeline() {
  let acc = 0;
  TL = SHOTS.map((s, i) => { const o = Object.assign({}, s, { i, start: acc, dur: s.dur || s.beats * BEAT }); acc += o.dur; return o; });
}
const storyEnd = () => TL[TL.length - 1].start + TL[TL.length - 1].dur;
const totalDur = () => storyEnd() + TAIL;

function picture(t) {
  let i = TL.findIndex(s => t >= s.start && t < s.start + s.dur);
  if (i < 0) i = TL.length - 1;
  const sh = TL[i], lt = t - sh.start;
  let pic = sh.draw(lt, sh.dur);
  if (sh.xin && lt < sh.xin && i > 0) {
    const pv = TL[i - 1];
    pic = pv.draw(t - pv.start, pv.dur) + op(eio(lt / sh.xin), pic);
  }
  return pic;
}
function overlays(t) {
  let s = '';
  for (const f of FLASHES) {
    const k = (t - f.t) / f.dur;
    if (k >= 0 && k <= 1) s += `<rect x="0" y="0" width="720" height="480" fill="${f.col || '#fff'}" opacity="${n2(Math.pow(1 - k, 1.6) * (f.o || 1))}"/>`;
  }
  return s;
}
function compose(pic) {
  let s = '<rect width="720" height="720" fill="#000"/>';
  s += `<g transform="translate(0,${PIC_Y})"><g clip-path="url(#picClip)"><rect width="720" height="480" fill="#000"/>${pic}</g></g>`;
  if (CHANNEL) s += TX(16, PIC_Y + 24, CHANNEL, 21, '#fff', { anchor: 'start', weight: 900, x: 'font-style="italic" opacity="0.5"' });
  s += TX(360, 76, CAPTION, 32, '#fff', { weight: 500 });
  return s;
}
function renderFrame(t) {
  resetDefs();
  let pic = '';
  const end = storyEnd();
  if (t < end) pic = picture(t) + overlays(t);
  const fade = clamp((t - (end - FADE_OUT)) / FADE_OUT);
  if (fade > 0) pic += `<rect x="0" y="0" width="720" height="480" fill="#000" opacity="${n2(fade)}"/>`;
  const svg = compose(pic);
  document.getElementById('dyn-defs').innerHTML = DEFS.join('');
  document.getElementById('frame').innerHTML = svg;
}

/* ---------- test sheets (?test=chars) ---------- */
function renderTest(name, t = 0) {
  resetDefs();
  let pic = `<rect width="720" height="480" fill="#cfd8e3"/>`;
  if (name === 'chars') {
    pic += dad({ x: 90, y: 440, s: 0.95, expr: 'smile', armR: [20, 30] });
    pic += dad({ x: 245, y: 440, s: 0.95, expr: 'tired', hat: false, armL: [150, 20], armR: [10, 60] });
    pic += dad({ x: 400, y: 440, s: 0.95, facing: 'back' });
    pic += kid({ who: 'jake', x: 520, y: 440, s: 1.1, expr: 'happy', armL: [150, 10], armR: [20, 20] });
    pic += kid({ who: 'lily', x: 640, y: 440, s: 1.0, expr: 'smile' });
  } else if (name === 'faces') {
    const ex = ['neutral', 'smile', 'warm', 'tired', 'sad', 'determined', 'shock', 'cheer', 'teary', 'cry', 'strain', 'chew'];
    ex.forEach((e, i) => { pic += dadHeadAt(70 + (i % 6) * 116, 120 + Math.floor(i / 6) * 150, 0.85, { expr: e, hat: i % 2 === 0, mouthOpen: 0.6 }) + TX(70 + (i % 6) * 116, 196 + Math.floor(i / 6) * 150, e, 13, '#333'); });
  } else if (name === 'kids') {
    const ex = ['smile', 'big', 'happy', 'wow', 'sad', 'worried', 'determined', 'sleep', 'cry'];
    ex.forEach((e, i) => { const who = i % 2 ? 'lily' : 'jake'; pic += kidHeadAt(who, 60 + (i % 5) * 140, 110 + Math.floor(i / 5) * 190, 1.0, { expr: e, cap: i === 4 }) + TX(60 + (i % 5) * 140, 185 + Math.floor(i / 5) * 190, e, 13, '#333'); });
    pic += kid({ who: 'jake', outfit: 'pj', x: 560, y: 470, s: 0.9 }) + kid({ who: 'lily', outfit: 'pj', x: 660, y: 470, s: 0.8 });
  } else if (name === 'sit') {
    pic += dad({ x: 200, y: 300, s: 0.9, legs: 'sit', expr: 'chew', mouthOpen: 0.5, armL: [10, 70], armR: [10, 70] });
    pic += dad({ x: 420, y: 300, s: 0.9, legs: 'sit', pal: PAL.co1, expr: 'smile', armR: [20, 120] });
    pic += dad({ x: 600, y: 300, s: 0.9, legs: 'sit', pal: PAL.co2, expr: 'chew', armL: [20, 120] });
    pic += R(0, 300, 720, 30, 0, '#c4553a', 3);
  } else if (typeof PROP_TEST === 'function') {
    pic += PROP_TEST(name, t);
  }
  document.getElementById('dyn-defs').innerHTML = DEFS.join('');
  document.getElementById('frame').innerHTML = compose(pic);
}

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
window.READY = false;
(async function boot() {
  buildTimeline();
  window.TOTAL = totalDur();
  window.renderFrame = renderFrame;
  window.renderTest = renderTest;
  try { await document.fonts.load("20px 'Patrick Hand'"); await document.fonts.load('500 20px Inter'); await document.fonts.ready; } catch (e) { /* fonts optional */ }
  if (params.get('render')) {
    document.body.classList.add('render');
    if (params.get('test')) renderTest(params.get('test'), parseFloat(params.get('t') || '0'));
    else renderFrame(parseFloat(params.get('t') || '0'));
    window.READY = true;
    return;
  }
  // interactive preview player
  const music = document.getElementById('music'), scrub = document.getElementById('scrub'), btn = document.getElementById('play'), lab = document.getElementById('time');
  let playing = false, t0 = 0, base = 0, cur = 0;
  const show = t => { cur = t; renderFrame(t); scrub.value = Math.round((t / window.TOTAL) * 1000); lab.textContent = t.toFixed(1) + 's'; };
  const loop = now => { if (!playing) return; const t = base + (now - t0) / 1000; if (t >= window.TOTAL) { playing = false; btn.textContent = 'Play'; show(0); return; } show(t); requestAnimationFrame(loop); };
  btn.onclick = () => {
    playing = !playing; btn.textContent = playing ? 'Pause' : 'Play';
    if (playing) { base = cur >= window.TOTAL - 0.05 ? 0 : cur; t0 = performance.now(); try { music.currentTime = base; music.play(); } catch (e) {} requestAnimationFrame(loop); }
    else { try { music.pause(); } catch (e) {} }
  };
  scrub.oninput = () => { const t = (scrub.value / 1000) * window.TOTAL; if (playing) { base = t; t0 = performance.now(); try { music.currentTime = t; } catch (e) {} } show(t); };
  show(0);
  window.READY = true;
})();

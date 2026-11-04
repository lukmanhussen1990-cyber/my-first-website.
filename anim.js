/* anim.js — shared, deterministic timeline engine for every scene of a reel.
 *
 * Every CSS animation on the page is paused and driven from ONE clock, and
 * JS "tracks" are pure functions of time t (seconds). So the browser preview
 * and the frame-by-frame render (render.py) always show the same frame for t.
 *
 *   preview:  python3 -m http.server 8000   →  http://localhost:8000/scenes/scene01.html
 *             (click the page to restart with the voice line)
 *   render:   render.py opens  sceneNN.html?render  and calls  window.__reel.seek(t)
 *
 * What a scene gets for free (from scenes.json + script.txt + out/timeline.json):
 *   - CSS vars on <html>:  --dur (scene seconds), --vo (voice start), --vo-end
 *   - the subtitle (its line from script.txt, gold words from scenes.json)
 *   - the hook text on scene 1, inline SVG for [data-char] / [data-prop] elements
 *
 * Scene script:   Reel.scene(async ctx => { ctx.track(t => ...) })
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const sceneNo = +((location.pathname.match(/scene(\d+)\.html/) || [])[1] || params.get('scene') || 1);
  const pad = n => String(n).padStart(2, '0');

  // ---------------------------------------------------------------- maths
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));          // 0→1 while t goes a→b
  const ease = {
    linear: x => x,
    in: x => x * x * x,
    out: x => 1 - Math.pow(1 - x, 3),
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: x => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  };
  function rand(seed) {                                          // mulberry32: same "random" every run
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --------------------------------------------------------------- tracks
  const tracks = [];
  const track = fn => { tracks.push(fn); return fn; };

  function seek(t) {
    for (const fn of tracks) fn(t);
    // getAnimations() flushes style first, so animations created by class
    // changes inside a track are picked up (and synced) in the same frame.
    for (const a of document.getAnimations()) {
      if (a.playState !== 'paused') a.pause();
      a.currentTime = t * 1000;
    }
  }

  // -------------------------------------------------------------- helpers
  /** count a number from→to between t0..t1 (ease-out) */
  const count = (el, from, to, t0, t1, fmt = v => String(v)) => track(t => {
    const v = Math.round(lerp(from, to, ease.out(prog(t, t0, t1))));
    const s = fmt(v);
    if (el.textContent !== s) el.textContent = s;
  });

  /** springy "landing" scale on el at time tl */
  const bounce = (el, tl, amp = 0.22) => track(t => {
    const d = t - tl;
    const s = d < 0 ? 1 : 1 + amp * Math.exp(-6 * d) * Math.sin(16 * d);
    el.style.scale = s.toFixed(4);
  });

  /** flip-card counter: steps = [[time, text], ...] */
  const flip = (el, steps) => track(t => {
    let cur = steps[0][1], ang = 0;
    for (const [ts, txt] of steps) if (t >= ts) cur = txt;
    for (const [ts] of steps.slice(1)) {
      if (t >= ts - 0.16 && t < ts) ang = 90 * ease.in(prog(t, ts - 0.16, ts));
      else if (t >= ts && t < ts + 0.3) ang = -90 * (1 - ease.out(prog(t, ts, ts + 0.3)));
    }
    if (el.textContent !== cur) el.textContent = cur;
    el.style.transform = `perspective(700px) rotateX(${ang.toFixed(2)}deg)`;
  });

  /** floating dust / particles inside container (pure CSS animations) */
  function dust(container, n = 40, seed = 7, o = {}) {
    const r = rand(seed), W = o.w || 720, H = o.h || 1280;
    let html = '';
    for (let i = 0; i < n; i++) {
      const s = (o.min || 1.5) + r() * (o.max || 3.5);
      html += `<i style="left:${(r() * W).toFixed(1)}px;top:${(r() * H).toFixed(1)}px;width:${s.toFixed(1)}px;` +
        `height:${s.toFixed(1)}px;--dx:${((r() - 0.5) * 90).toFixed(1)}px;--dy:${-(120 + r() * 200).toFixed(1)}px;` +
        `--o:${(0.25 + r() * 0.65).toFixed(2)};animation-duration:${(7 + r() * 9).toFixed(2)}s;` +
        `animation-delay:${(-r() * 14).toFixed(2)}s"></i>`;
    }
    container.insertAdjacentHTML('beforeend', html);
  }

  /** a student sitting at a desk. (x, y) = centre of the desk's top edge.
   *  Returns {unit, seat, char}. The seat clips the body at the desk line. */
  function student(parent, o) {
    const s = o.s || 0.5;
    const unit = document.createElement('div');
    unit.className = 'unit ' + (o.cls || '');
    unit.style.cssText = `left:${o.x}px;top:${o.y}px;z-index:${o.z ?? Math.round(o.y)}`;
    const seatH = 430 * s;
    unit.innerHTML =
      (o.char ? `<div class="seat" style="left:${-100 * s}px;top:${-seatH + 8 * s}px;width:${200 * s}px;height:${seatH}px">` +
        `<div class="char ${o.charCls || ''}" data-char="${o.char}" data-expr="${o.expr || 'neutral'}" ` +
        `style="--s:${s};left:0;top:${seatH - 352 * s}px;--blink:${(o.blink ?? (o.x % 7) * 0.53).toFixed(2)};` +
        `--d:${(o.d ?? (o.x % 5) * 0.11).toFixed(2)}"></div></div>` : '') +
      `<div class="prop desk" data-prop="${o.desk || 'desk'}" style="left:${-125 * s}px;top:0;width:${250 * s}px;` +
      `height:${250 * s * 130 / 220}px"></div>`;
    parent.appendChild(unit);
    return { unit, seat: unit.querySelector('.seat'), char: unit.querySelector('.char') };
  }

  // ------------------------------------------------------------ data I/O
  async function text(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.text();
  }
  async function json(url, fallback) {
    try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() : fallback; }
    catch (e) { return fallback; }
  }

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TRAIL = /[।॥,.!?…:;"'“”‘’)\]—–-]+$/u;

  /** wrap the scene's gold words/phrases (from scenes.json) in <span class="gold"> */
  function markGold(line, gold = []) {
    const words = line.trim().split(/\s+/);
    const core = w => w.replace(TRAIL, '');
    const hit = new Array(words.length).fill(false);
    for (const phrase of gold) {
      const p = phrase.normalize('NFC').trim().split(/\s+/);
      for (let i = 0; i + p.length <= words.length; i++)
        if (p.every((w, k) => core(words[i + k]) === w)) p.forEach((_, k) => (hit[i + k] = true));
    }
    return words.map((w, i) => {
      if (!hit[i]) return esc(w);
      const c = core(w);
      return `<span class="gold">${esc(c)}</span>${esc(w.slice(c.length))}`;
    }).join(' ');
  }
  /** "**gold**" markup for free text (hook, labels) */
  const markStars = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="gold">$1</span>');

  const cache = {};
  async function inline(root = document) {
    const els = [...root.querySelectorAll('[data-char]:not([data-done]),[data-prop]:not([data-done])')];
    await Promise.all(els.map(async el => {
      el.dataset.done = '1';
      const url = el.dataset.char ? `../characters/${el.dataset.char}.svg` : `../props/${el.dataset.prop}.svg`;
      cache[url] = cache[url] || text(url);
      el.insertAdjacentHTML('afterbegin', await cache[url]);
    }));
  }

  function fitSubtitles() {
    for (const p of document.querySelectorAll('.subtitle p')) {
      let size = parseFloat(getComputedStyle(p).fontSize);
      const lh = () => parseFloat(getComputedStyle(p).lineHeight) || size * 1.3;
      while (p.offsetHeight > lh() * 2.25 && size > 28) { size -= 2; p.style.fontSize = size + 'px'; }
    }
  }

  // ----------------------------------------------------------------- boot
  let setupFn = null;
  const Reel = (window.Reel = {
    RENDER, sceneNo, clamp, lerp, prog, ease, rand, track, count, bounce, flip, dust, student, markGold,
    scene(fn) { setupFn = fn; },
  });

  async function boot() {
    const plan = await json('../scenes.json', { scenes: [] });
    const lines = (await text('../script.txt').catch(() => ''))
      .split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    const timeline = await json('../out/timeline.json', null);
    const sp = plan.scenes[sceneNo - 1] || {};
    const tl = timeline && timeline.scenes && timeline.scenes[sceneNo - 1];
    const dur = tl ? tl.duration : (sp.min || 6);
    const vo = tl ? tl.vo_at : (sp.vo_at ?? 0.5);
    const voDur = tl ? tl.vo_dur : 2;

    const root = document.documentElement, stage = document.querySelector('.stage');
    root.style.setProperty('--dur', dur);
    root.style.setProperty('--vo', vo);
    root.style.setProperty('--vo-end', +(vo + voDur).toFixed(3));
    for (const [k, v] of Object.entries(sp.beats || {}))          // beats → CSS vars, e.g. --b-land
      if (typeof v === 'number') root.style.setProperty(`--b-${k}`, v);
    document.body.classList.toggle('render', RENDER);

    const line = (lines[sceneNo - 1] || '').normalize('NFC');
    if (line && !stage.querySelector('.subtitle')) {
      const sub = document.createElement('div');
      sub.className = 'subtitle';
      sub.innerHTML = `<p>${markGold(line, sp.gold || [])}</p>`;
      stage.appendChild(sub);
    }
    if (sceneNo === 1 && plan.hook && !stage.querySelector('.hook')) {
      const hook = document.createElement('div');
      hook.className = 'hook';
      hook.innerHTML = `<p>${markStars(plan.hook)}</p>`;
      stage.appendChild(hook);
    }

    const ctx = {
      ...Reel,
      dur, vo, voDur, voEnd: vo + voDur, scene: sp, plan, stage, inline,
      $: s => document.querySelector(s), $$: s => [...document.querySelectorAll(s)],
    };
    if (setupFn) await setupFn(ctx);
    await inline();
    await Promise.all([
      document.fonts.load('italic 48px "Tiro Devanagari Hindi"', 'एक नियम A'),
      document.fonts.load('48px "Tiro Devanagari Hindi"', 'एक नियम'),
      document.fonts.load('italic 700 40px "Playfair Display"', 'DAY 1'),
      document.fonts.load('800 60px Inter', 'DAY 0123456789'),
      document.fonts.load('700 20px Inter', 'STUDENTS'),
    ]).catch(() => {});
    await document.fonts.ready;
    fitSubtitles();
    seek(0);
    window.__reel = { duration: dur, fps: plan.fps || 30, vo, seek, ready: true };
    if (!RENDER) preview(dur, vo);
  }

  // -------------------------------------------------------------- preview
  function preview(dur, vo) {
    const fit = () => { document.body.style.zoom = Math.min(1, innerHeight / 1280, innerWidth / 720); };
    fit();
    addEventListener('resize', fit);
    const voice = new Audio(`../audio/voice/scene${pad(sceneNo)}.mp3`);
    let t0 = performance.now(), sound = false, spoke = false;
    addEventListener('click', () => { sound = true; spoke = false; t0 = performance.now(); });
    const loop = now => {
      let t = (now - t0) / 1000;
      if (t > dur + 0.8) { t0 = now; t = 0; spoke = false; }
      seek(Math.min(t, dur));
      if (sound && !spoke && t >= vo) { spoke = true; voice.currentTime = 0; voice.play().catch(() => {}); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot());
  else setTimeout(boot);
})();

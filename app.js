/* SCP-3143 "Murphy Law" — the still image, cut into layers and driven by the track.
   The motion model here is the same one the MP4 renderer uses. */
(() => {
  'use strict';

  const W = 685, H = 1259;                     // artwork space; everything is in these units
  const HEAD_PIVOT = [352, 458];               // base of the skull, hidden by the collar
  const HAND_PIVOT = [156, 495];               // wrist, hidden by the cuff
  const CIG_TIP    = [243, 396];
  const SMOKE_CYCLE = 8.5;                     // one take-a-drag loop, seconds
  const BPM_FALLBACK = 124;

  const $ = s => document.querySelector(s);
  const stage = $('#stage'), head = $('#head'), hand = $('#hand'),
        smoke = $('#smoke'), puffBox = $('#puffs'),
        playBtn = $('#play'), toggle = $('#toggle');

  const audio = $('#track');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AMP = reduced ? 0.35 : 1;

  /* ------------------------------------------------------------------ maths */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

  function dragCurve(p) {
    if (p < 0.10) return smoothstep(0, 0.10, p);        // pull the cigarette away
    if (p < 0.42) return 1;                              // hold it out
    if (p < 0.52) return 1 - smoothstep(0.42, 0.52, p);  // back to the lips
    return 0;
  }
  const inhaleCurve = p => smoothstep(0.52, 0.58, p) * (1 - smoothstep(0.60, 0.78, p));

  function blinkAt(t) {                                  // irregular, sometimes doubled
    let v = 0;
    for (let i = -1; i < 3; i++) {
      const k = Math.floor(t / 3.7) + i;
      const start = k * 3.7 + hash(k) * 2.6;
      const times = hash(k + 0.5) > 0.55 ? [start, start + 0.22] : [start];
      for (const s of times) {
        if (t >= s && t < s + 0.16) v = Math.max(v, Math.pow(Math.sin((t - s) / 0.16 * Math.PI), 0.6));
      }
    }
    return v;
  }

  /* --------------------------------------------------------------- the beat */
  let ctx = null, analyser = null, freq = null, graphOK = false;
  let pulse = 0, level = 0, avg = 0, lastBeat = -9, sawSignal = 0;
  let bassPeak = 1e-6, midPeak = 1e-6;

  function buildGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      freq = new Float32Array(analyser.frequencyBinCount);
      graphOK = true;
    } catch (e) { graphOK = false; }        // file:// gives an opaque source — fall back
  }

  function readBeat(t, dt) {
    pulse *= Math.exp(-dt / 0.11);
    if (graphOK && !audio.paused) {
      // byte data clips solid at 255 on a track this loud, so read the dB and
      // convert back to amplitude — that keeps the kick's dynamics intact
      analyser.getFloatFrequencyData(freq);
      const binHz = ctx.sampleRate / analyser.fftSize;
      let bass = 0, nb = 0, mid = 0, nm = 0;
      for (let i = 1; i < freq.length; i++) {
        const f = i * binHz, amp = Math.pow(10, freq[i] / 20);
        if (f < 170) { bass += amp; nb++; }
        else if (f < 6000) { mid += amp; nm++; }
      }
      bass = nb ? bass / nb : 0;
      mid = nm ? mid / nm : 0;
      if (bass > 1e-5) sawSignal = 1;
      bassPeak = Math.max(bassPeak * 0.9995, bass, 1e-6);
      midPeak = Math.max(midPeak * 0.9995, mid, 1e-6);
      level = Math.min(1, mid / midPeak);
      avg = avg * 0.985 + bass * 0.015;                  // ~1s running mean
      if (bass > avg * 1.35 && bass > bassPeak * 0.12 && t - lastBeat > 0.15) {
        pulse = 1; lastBeat = t;
      }
    }
    if ((!graphOK || !sawSignal) && !audio.paused) {     // silent analyser: run on the clock
      const beat = 60 / BPM_FALLBACK;
      if (Math.floor(t / beat) !== Math.floor(lastBeat / beat) || lastBeat < 0) { pulse = 1; lastBeat = t; }
      level = 0.6;
    }
    return pulse;
  }

  /* -------------------------------------------------------------- the puffs */
  const POOL = 44;
  const puffs = [];
  for (let i = 0; i < POOL; i++) {
    const el = document.createElement('div');
    el.className = 'puff';
    el.style.opacity = 0;
    puffBox.appendChild(el);
    puffs.push({ el, alive: false });
  }
  function emit(x, y, count, spd = 1, size = 1) {
    for (const p of puffs) {
      if (count <= 0) break;
      if (p.alive) continue;
      p.alive = true; count--;
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = -6 + Math.random() * 10;
      p.vy = -(14 + Math.random() * 16) * spd;
      p.age = 0;
      p.life = 2.2 + Math.random() * 1.4;
      p.size = (10 + Math.random() * 10) * size;
      p.seed = Math.random() * 10;
      p.op = 0.16 + Math.random() * 0.18;
    }
  }
  function stepPuffs(dt, wind) {
    for (const p of puffs) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; p.el.style.opacity = 0; continue; }
      p.x += (p.vx + wind + Math.sin(p.age * 1.7 + p.seed) * 7) * dt;
      p.y += p.vy * dt;
      p.vy *= (1 - 0.35 * dt);
      const k = p.age / p.life;
      const s = p.size * (1 + 2.6 * k) / (W * 0.035);   // .puff is 3.5% of the width
      p.el.style.left = (p.x / W * 100) + '%';
      p.el.style.top = (p.y / H * 100) + '%';
      p.el.style.transform = `scale(${s})`;
      p.el.style.opacity = p.op * Math.sin(Math.min(1, k * 3.2) * Math.PI / 2) * Math.pow(1 - k, 1.4);
    }
  }

  /* ------------------------------------------------------------------ frame */
  const pctX = px => px / W * 100, pctY = px => px / H * 100;
  let prevT = 0, prevDrag = 0, started = false;

  function rotatePoint(px, py, pivot, deg, dx, dy) {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const vx = px - pivot[0], vy = py - pivot[1];
    return [pivot[0] + vx * c - vy * s + dx, pivot[1] + vx * s + vy * c + dy];
  }

  function frame() {
    requestAnimationFrame(frame);
    const t = started ? audio.currentTime : performance.now() / 1000;
    let dt = t - prevT;
    if (dt < 0 || dt > 0.25) dt = 1 / 60;                // loop wrap / tab switch
    prevT = t;

    const pl = readBeat(t, dt) * AMP;
    const breath = Math.sin(t * 2 * Math.PI / 3.4);
    const sway = Math.sin(t * 2 * Math.PI / 5.3);
    const p = (t % SMOKE_CYCLE) / SMOKE_CYCLE;
    const drag = dragCurve(p), inhale = inhaleCurve(p);

    const hRot = (0.75 * breath + 0.5 * sway - 2.1 * pl + 1.3 * inhale) * AMP;
    const hDx = (1.6 * sway + 1.5 * pl) * AMP;
    const hDy = (-1.8 * breath + 7.5 * pl - 2.5 * inhale) * AMP;
    head.style.transform = `translate(${pctX(hDx)}%, ${pctY(hDy)}%) rotate(${hRot}deg)`;

    const aRot = (-7.4 * drag + 0.45 * Math.sin(t * 2.7) + 1.4 * pl) * AMP;
    const aDx = -2.0 * drag * AMP, aDy = (9.0 * drag + 2.0 * pl) * AMP;
    hand.style.transform = `translate(${pctX(aDx)}%, ${pctY(aDy)}%) rotate(${aRot}deg)`;

    const sw = Math.sin(t * 0.9) * 3;
    smoke.style.transform = `translate(${pctX(sw)}%, ${pctY(-sw * 0.6)}%)`;

    head.style.setProperty('--blink', blinkAt(t).toFixed(3));

    const zoom = 1 + (0.017 * pl + 0.004 * level) * AMP;
    stage.style.transform = `scale(${zoom}) rotate(${(0.3 * pl * Math.sin(t * 1.1) * AMP).toFixed(3)}deg)`;

    const [tx, ty] = rotatePoint(CIG_TIP[0], CIG_TIP[1], HAND_PIVOT, aRot, aDx, aDy);
    if (Math.random() < 0.4) emit(tx, ty, 1);
    if (prevDrag > 0.5 && drag <= 0.5) emit(tx, ty - 6, 14, 1.5, 1.6);   // the exhale
    prevDrag = drag;
    stepPuffs(dt, 4 + 3 * Math.sin(t * 0.5));
  }

  /* --------------------------------------------------------------- controls */
  function start() {
    buildGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    audio.play().then(() => {
      started = true;
      playBtn.hidden = true;
      toggle.hidden = false;
    }).catch(() => {                        // no audio (blocked / missing) — animate anyway
      started = false;
      playBtn.hidden = true;
      toggle.hidden = false;
    });
  }
  playBtn.addEventListener('click', start);
  toggle.addEventListener('click', () => {
    if (audio.paused) { audio.play(); toggle.textContent = '❚❚'; }
    else { audio.pause(); toggle.textContent = '▶'; }
  });
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); (playBtn.hidden ? toggle : playBtn).click(); }
  });

  requestAnimationFrame(frame);
})();

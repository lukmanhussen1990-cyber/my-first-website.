// Sun to Sugar: game state, levels, input, HUD and overlay DOM, and the frame loop.
(function () {
  'use strict';

  window.Photosynthesis = window.Photosynthesis || {};
  const P = window.Photosynthesis;
  const content = P.content;
  const render = P.render;
  const ui = content.ui;
  const labels = ui.labels;
  const msg = ui.messages;

  // Every tuning number lives here. Positions are 0..1 of the canvas; sizes and radii are fractions of u.
  const CFG = {
    maxDt: 0.05,
    maxEntities: 90,
    offField: 0.2,
    buttonLockMs: 250,   // ignores a double click on an overlay button
    finishDelay: 0.8,    // wait after a level's last success
    glucoseDelay: 1.5,   // fix the carbon: glucose shows before its overlay
    points: 10,
    streakMin: 3,
    streakBonus: 5,
    hitMinPx: 24,
    hitScale: 1.6,
    psII: { x: 0.28, y: 0.42 },
    station: { x: 0.86, y: 0.46 },
    turbine: { x: 0.60, y: 0.58 },
    ring: { x: 0.50, y: 0.80, r: 0.16 },
    size: {
      photon: 0.014, electron: 0.012, proton: 0.012, water: 0.035, o2: 0.03, co2: 0.04,
      atp: 0.035, nadph: 0.035, sugar: 0.022, glucose: 0.10, burst: 0.08, popup: 0.03
    },
    fx: {
      burstLife: 0.5, popupLife: 0.9, popupRise: 0.12, tapFade: 0.15, missFade: 0.35,
      retireFade: 0.3, decorLife: 0.6, o2Life: 2.0, o2Rise: 0.22, dropSpeed: 0.12,
      dropLife: 1.6, flyLife: 0.35,
      protonVx: 0.18, protonVy: -0.2, electronVx: 0.2, electronVy: 0.1,
      glucoseBursts: [0.09, 0.13, 0.17]
    },
    colors: {
      miss: '#9fbfb0', photon: '#ffd166', split: '#8ecae6', nadph: '#b388eb',
      atp: '#f4a261', co2: '#a7e8a0', glucose: '#ffb703'
    },
    light: {
      focus: 'light', targets: [12], every: 0.7, x0: 0.10, x1: 0.90,
      startY: -0.04, missY: 0.32, fallTime: 4
    },
    split: {
      focus: 'thylakoid', targets: [6], every: 1.2, x0: -0.04, y0: 0.36, y1: 0.56,
      speed: 0.10, missX: 1.04, splitsPerO2: 2
    },
    energy: {
      focus: 'thylakoid', targets: [18, 12], every: 0.9, speed: 0.12, missX: 0.96,
      catchRadius: 0.10, turbinePeriod: 2.2, turbineGlowTime: 1.0, turbineMinGlow: 0.2,
      turbineRadius: 0.06
    },
    carbon: {
      focus: 'stroma', targets: [6], every: 2.5, x0: -0.04, y0: 0.66, y1: 0.92,
      speed: 0.08, missX: 1.04, cost: { atp: 3, nadph: 2 }, calvinDecay: 0.8,
      sugarLife: 1.5, sugarSpin: 2.0
    }
  };
  const LEVELS = [CFG.light, CFG.split, CFG.energy, CFG.carbon];
  const LAST = LEVELS.length - 1;
  const TARGET_KIND = ['photon', 'water', 'electron', 'co2'];
  const SEP = ' · ';

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, key) {
      return vars[key] === undefined ? '' : String(vars[key]);
    });
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function now() { return performance.now(); }
  function byId(id) { return document.getElementById(id); }
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function setHidden(node, flag) { if (node.hidden !== flag) node.hidden = flag; }
  function starsFor(misses) { return misses === 0 ? 3 : misses <= 3 ? 2 : 1; }
  function starGlyphs(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
  function clampIndex(index) { return clamp(Math.floor(Number(index)) || 0, 0, LAST); }

  // Game state. Everything here is reset by enterTitle, enterIntro or goToLevel.
  let ready = false;
  let screen = 'title';     // title | intro | playing | complete | finale
  let level = 0;
  let counts = [];
  let targets = [];
  let misses = 0;          // misses on the current level
  let splits = 0;          // water splits on the current level
  let lastAtpCycle = -1;   // turbine glow window that already made ATP
  let finishing = false;   // a level's last success happened; waiting for its overlay
  let timers = { spawn: 0, finish: 0, turbine: 0 };
  let entities = [];
  let score = 0;
  let streak = 0;
  let stock = { atp: 0, nadph: 0 };
  let stars = [];
  let totals = { o2: 0, atp: 0, nadph: 0, co2: 0 };   // used for the finale stats
  let calvin = 0;          // glow.calvin
  let elapsed = 0;         // scene.t
  let reducedMotion = false;
  let view = { w: 1, h: 1, u: 1 };
  let overlayOpenedAt = 0;
  let canvas = null;
  let hud = null;          // HUD elements, set in init
  let ov = null;           // overlay elements, set in init
  let statusEl = null;
  let stageEls = [];
  let last = 0;
  let paused = false;
  let pausedByTab = false;
  let levelMs = 0;         // time on the current level since play started
  let emitted = { screen: '', level: -1 };

  function resetRun() {
    score = 0;
    streak = 0;
    stock = { atp: 0, nadph: 0 };
    stars = [];
    totals = { o2: 0, atp: 0, nadph: 0, co2: 0 };
  }

  function resetLevel(index) {
    level = index;
    targets = LEVELS[index].targets.slice();
    counts = targets.map(function () { return 0; });
    misses = 0;
    splits = 0;
    lastAtpCycle = -1;
    finishing = false;
    timers = { spawn: 0, finish: 0, turbine: 0 };
    entities = [];
    calvin = 0;
    levelMs = 0;
  }

  resetRun();
  resetLevel(0);

  function entity(kind, x, y, size, extra) {
    const e = { kind: kind, x: x, y: y, size: size, age: 0, alpha: 1, vx: 0, vy: 0, fadeRate: 0, resolved: false };
    return Object.assign(e, extra || {});
  }

  function addEntity(e) {
    if (entities.length >= CFG.maxEntities) return null;
    entities.push(e);
    return e;
  }

  // A resolved entity can no longer be tapped or counted as a miss.
  function retire(e, life) {
    e.resolved = true;
    e.fadeRate = 1 / life;
  }

  function popup(text, x, y, color) {
    addEntity(entity('popup', clamp(x, 0.04, 0.96), clamp(y, 0.04, 0.96), CFG.size.popup, {
      text: text, color: color, vy: -CFG.fx.popupRise, fadeRate: 1 / CFG.fx.popupLife
    }));
  }

  function burst(x, y, color, size) {
    addEntity(entity('burst', x, y, size || CFG.size.burst, { color: color, fadeRate: 1 / CFG.fx.burstLife }));
  }

  function scorePoints(x, y) {
    streak += 1;
    const pts = CFG.points + (streak >= CFG.streakMin ? CFG.streakBonus : 0);
    score += pts;
    popup('+' + pts, x, y);
  }

  function say(text) {
    if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
  }

  // Event bus: each notable change is dispatched on the document as 'photo:event'.
  function emit(type, data) {
    const detail = Object.assign({ type: type }, data || {});
    document.dispatchEvent(new CustomEvent('photo:event', { detail: detail }));
  }

  function registerMiss(x, y, text) {
    misses += 1;
    streak = 0;
    popup(text, x, y, CFG.colors.miss);
    say(text);
    emit('miss', { level: level });
  }

  // Spawning and the per-level clock.
  function spawnPhoton() {
    const c = CFG.light;
    const speed = (c.missY - c.startY) / c.fallTime;
    addEntity(entity('photon', rand(c.x0, c.x1), c.startY, CFG.size.photon, { vy: speed }));
  }

  function spawnWater() {
    const c = CFG.split;
    addEntity(entity('water', c.x0, rand(c.y0, c.y1), CFG.size.water, { vx: c.speed }));
  }

  function spawnElectron() {
    const c = CFG.energy;
    addEntity(entity('electron', CFG.psII.x, CFG.station.y, CFG.size.electron, { vx: c.speed }));
  }

  function spawnCo2() {
    const c = CFG.carbon;
    addEntity(entity('co2', c.x0, rand(c.y0, c.y1), CFG.size.co2, { vx: c.speed }));
  }

  const SPAWN = [spawnPhoton, spawnWater, spawnElectron, spawnCo2];

  function runLevel(dt) {
    const c = LEVELS[level];
    if (level === 2) timers.turbine += dt;
    timers.spawn += dt;
    while (timers.spawn >= c.every) {
      timers.spawn -= c.every;
      const nadphDone = level === 2 && counts[1] >= targets[1];
      if (!nadphDone) SPAWN[level]();
    }
  }

  // Turbine glow: a triangle 0 -> 1 -> 0 over turbineGlowTime, once per turbinePeriod.
  function turbineGlowNow() {
    if (screen !== 'playing' || finishing || level !== 2) return 0;
    const c = CFG.energy;
    const p = (timers.turbine % c.turbinePeriod) / c.turbineGlowTime;
    return p < 1 ? 1 - Math.abs(p - 0.5) * 2 : 0;
  }

  function lightGlow() {
    if (screen === 'title') return 0;
    if (level > 0 || screen === 'finale') return 1;
    return targets[0] ? clamp(counts[0] / targets[0], 0, 1) : 0;
  }

  function focusBand() {
    if (screen === 'title') return null;
    if (screen === 'finale') return CFG.carbon.focus;
    return LEVELS[level].focus;
  }

  function buildScene() {
    return {
      t: elapsed,
      focus: focusBand(),
      glow: { light: lightGlow(), turbine: turbineGlowNow(), calvin: calvin },
      reducedMotion: reducedMotion,
      finale: screen === 'finale',
      entities: entities
    };
  }

  function ringPoint(angle) {
    const r = CFG.ring;
    return {
      x: r.x + (r.r * view.u / view.w) * Math.cos(angle),
      y: r.y + (r.r * view.u / view.h) * Math.sin(angle)
    };
  }

  function addSugar(index) {
    const angle = index * Math.PI / 3;
    const p = ringPoint(angle);
    addEntity(entity('sugar', p.x, p.y, CFG.size.sugar, {
      orbit: true, angle: angle, omega: CFG.carbon.sugarSpin, fadeRate: 1 / CFG.carbon.sugarLife
    }));
  }

  // Misses: an untapped target that crosses its line counts once, then fades.
  function missOn(e) {
    retire(e, CFG.fx.missFade);
    registerMiss(e.x, e.y, msg.missed);
  }

  function checkMiss(e) {
    if (e.kind !== TARGET_KIND[level]) return;
    if (level === 0 && e.y >= CFG.light.missY) return missOn(e);
    if (level === 1 && e.x >= CFG.split.missX) return missOn(e);
    if (level === 2 && e.x >= CFG.energy.missX) {
      if (counts[1] >= targets[1]) retire(e, CFG.fx.missFade);   // NADPH goal already met
      else missOn(e);
      return;
    }
    if (level === 3 && e.x >= CFG.carbon.missX) return missOn(e);
  }

  function updateEntities(dt, live) {
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      e.age += dt;
      if (e.orbit) {
        e.angle += e.omega * dt;
        const p = ringPoint(e.angle);
        e.x = p.x;
        e.y = p.y;
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      if (e.fadeRate) e.alpha = Math.max(0, e.alpha - e.fadeRate * dt);
      if (live && !e.resolved) checkMiss(e);
      const edge = CFG.offField;
      if (e.alpha <= 0 || e.x < -edge || e.x > 1 + edge || e.y < -edge || e.y > 1 + edge) {
        entities.splice(i, 1);
      }
    }
  }

  // Level end: fade the level's field entities (they no longer count), then wait.
  function retireField() {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.resolved && e.kind === TARGET_KIND[level]) retire(e, CFG.fx.retireFade);
    }
  }

  function addGlucose() {
    const r = CFG.ring;
    addEntity(entity('glucose', r.x, r.y, CFG.size.glucose));
    CFG.fx.glucoseBursts.forEach(function (size) {
      burst(r.x, r.y, CFG.colors.glucose, size);
    });
  }

  function completeLevel() {
    finishing = true;
    timers.finish = level === LAST ? CFG.glucoseDelay : CFG.finishDelay;
    stars.push(starsFor(misses));
    emit('level-complete', {
      level: level,
      stars: stars[stars.length - 1],
      misses: misses,
      score: score,
      elapsedMs: Math.round(levelMs)
    });
    retireField();
    if (level === LAST) addGlucose();
  }

  function update(dt) {
    elapsed += dt;                 // ambient clock for the renderer keeps running
    const step = paused ? 0 : dt;  // game time stops while paused
    calvin = Math.max(0, calvin - step / CFG.carbon.calvinDecay);
    const live = screen === 'playing' && !paused && !finishing;
    if (live) {
      levelMs += step * 1000;
      runLevel(step);
    }
    updateEntities(step, live);
    if (screen === 'playing' && !paused && finishing) {
      timers.finish -= step;
      if (timers.finish <= 0) showComplete();
    }
    renderHud();
    renderStages();
  }

  // Input. Taps are in CSS pixels relative to the canvas.
  function canCatch(e, rect) {
    if (counts[1] >= targets[1]) return false;
    const u = Math.min(rect.width, rect.height);
    const dx = (e.x - CFG.station.x) * rect.width;
    const dy = (e.y - CFG.station.y) * rect.height;
    return Math.hypot(dx, dy) <= CFG.energy.catchRadius * u;
  }

  // Returns the nearest tap target: an entity, 'turbine', or null.
  function hitTest(px, py, rect) {
    const u = Math.min(rect.width, rect.height);
    const kind = TARGET_KIND[level];
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.resolved || e.kind !== kind) continue;
      if (kind === 'electron' && !canCatch(e, rect)) continue;
      const d = Math.hypot(e.x * rect.width - px, e.y * rect.height - py);
      if (d <= Math.max(CFG.hitMinPx, CFG.hitScale * e.size * u) && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (level === 2) {
      const t = CFG.turbine;
      const d = Math.hypot(t.x * rect.width - px, t.y * rect.height - py);
      if (d <= Math.max(CFG.hitMinPx, CFG.energy.turbineRadius * u) && d < bestD) return 'turbine';
    }
    return best;
  }

  // Taps count only on an unpaused level with no overlay and no level-end wait.
  function canTap() {
    return ready && ov.overlay.hidden && screen === 'playing' && !finishing && !paused;
  }

  function tapPx(px, py, rect) {
    const hit = hitTest(px, py, rect);
    if (!hit) return false;
    if (hit === 'turbine') tapTurbine();
    else tapEntity(hit);
    return true;
  }

  function onPointerDown(ev) {
    if (!canTap()) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    tapPx(ev.clientX - rect.left, ev.clientY - rect.top, rect);
  }

  // Same as a pointer tap at normalized (x, y) of the canvas. Returns true on a hit.
  function tapAt(x, y) {
    if (!canTap()) return false;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    return tapPx(x * rect.width, y * rect.height, rect);
  }

  function tapEntity(e) {
    if (e.kind === 'photon') tapPhoton(e);
    else if (e.kind === 'water') tapWater(e);
    else if (e.kind === 'electron') tapElectron(e);
    else if (e.kind === 'co2') tapCo2(e);
  }

  function tapPhoton(e) {
    retire(e, CFG.fx.tapFade);
    burst(e.x, e.y, CFG.colors.photon);
    scorePoints(e.x, e.y);
    counts[0] += 1;
    say(msg.photon);
    emit('capture', { level: 0, count: counts[0] });
    if (counts[0] >= targets[0]) completeLevel();
  }

  function tapWater(e) {
    retire(e, CFG.fx.tapFade);
    burst(e.x, e.y, CFG.colors.split);
    scorePoints(e.x, e.y);
    const p = CFG.psII;
    addEntity(entity('proton', p.x, p.y, CFG.size.proton, {
      vx: CFG.fx.protonVx, vy: CFG.fx.protonVy, fadeRate: 1 / CFG.fx.decorLife
    }));
    addEntity(entity('electron', p.x, p.y, CFG.size.electron, {
      vx: CFG.fx.electronVx, vy: CFG.fx.electronVy, fadeRate: 1 / CFG.fx.decorLife
    }));
    splits += 1;
    emit('split', { level: 1, count: splits });
    if (splits % CFG.split.splitsPerO2 === 0) {
      counts[0] += 1;
      totals.o2 += 1;
      addEntity(entity('o2', p.x, p.y, CFG.size.o2, { vy: -CFG.fx.o2Rise, fadeRate: 1 / CFG.fx.o2Life }));
      say(fill(msg.o2, { n: counts[0], total: targets[0] }));
      emit('o2', { level: 1, count: counts[0] });
    } else {
      say(msg.split);
    }
    if (counts[0] >= targets[0]) completeLevel();
  }

  function tapElectron(e) {
    retire(e, CFG.fx.tapFade);
    scorePoints(e.x, e.y);
    counts[1] += 1;
    stock.nadph += 1;
    const s = CFG.station;
    burst(s.x, s.y, CFG.colors.nadph);
    addEntity(entity('nadph', s.x, s.y, CFG.size.nadph, { vy: CFG.fx.dropSpeed, fadeRate: 1 / CFG.fx.dropLife }));
    say(msg.nadph);
    emit('nadph', { level: 2, count: counts[1] });
    if (counts[0] >= targets[0] && counts[1] >= targets[1]) completeLevel();
  }

  function tapTurbine() {
    const t = CFG.turbine;
    if (counts[0] >= targets[0]) return;
    if (turbineGlowNow() <= CFG.energy.turbineMinGlow) {
      registerMiss(t.x, t.y, msg.waitForGlow);
      return;
    }
    const cycle = Math.floor(timers.turbine / CFG.energy.turbinePeriod);
    if (cycle === lastAtpCycle) return;   // one ATP per glow window
    lastAtpCycle = cycle;
    counts[0] += 1;
    stock.atp += 1;
    scorePoints(t.x, t.y);
    burst(t.x, t.y, CFG.colors.atp);
    addEntity(entity('atp', t.x, t.y, CFG.size.atp, { vy: CFG.fx.dropSpeed, fadeRate: 1 / CFG.fx.dropLife }));
    say(msg.atp);
    emit('atp', { level: 2, count: counts[0] });
    if (counts[0] >= targets[0] && counts[1] >= targets[1]) completeLevel();
  }

  function tapCo2(e) {
    const cost = CFG.carbon.cost;
    if (stock.atp < cost.atp || stock.nadph < cost.nadph) {
      retire(e, CFG.fx.missFade);
      registerMiss(e.x, e.y, msg.notEnough);
      return;
    }
    stock.atp -= cost.atp;
    stock.nadph -= cost.nadph;
    totals.atp += cost.atp;
    totals.nadph += cost.nadph;
    totals.co2 += 1;
    counts[0] += 1;
    // Fly into the ring centre and fade out.
    const r = CFG.ring;
    const life = CFG.fx.flyLife;
    e.resolved = true;
    e.vx = (r.x - e.x) / life;
    e.vy = (r.y - e.y) / life;
    e.fadeRate = 1 / life;
    scorePoints(e.x, e.y);
    addSugar(counts[0] - 1);
    calvin = 1;
    say(fill(msg.co2, { n: counts[0], total: targets[0] }));
    emit('fix', { level: 3, count: counts[0] });
    if (counts[0] >= targets[0]) completeLevel();
  }

  // Overlay content. Written only when the screen changes.
  function showLine(node, text) {
    if (text) {
      setText(node, text);
      setHidden(node, false);
    } else {
      setHidden(node, true);
    }
  }

  function fillStats(rows) {
    ov.stats.textContent = '';
    if (rows) {
      rows.forEach(function (row) {
        const div = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = row[0];
        dd.textContent = String(row[1]);
        div.appendChild(dt);
        div.appendChild(dd);
        ov.stats.appendChild(div);
      });
    }
    setHidden(ov.stats, !rows);
  }

  function fillOverlay(m) {
    setText(ov.eyebrow, m.eyebrow);
    setText(ov.title, m.title);
    setText(ov.text, m.text);
    showLine(ov.equation, m.equation);
    showLine(ov.goal, m.goal);
    showLine(ov.fact, m.fact);
    if (m.stars) {
      setText(ov.stars, m.stars.glyphs);
      ov.stars.setAttribute('aria-label', m.stars.label);
    }
    setHidden(ov.stars, !m.stars);
    fillStats(m.stats);
    setText(ov.button, m.button);
    setHidden(ov.overlay, false);
    overlayOpenedAt = now();
    ov.button.focus();
  }

  function goalText(index) {
    const t = LEVELS[index].targets;
    return fill(content.levels[index].goal, { a: t[0], b: t[1] });
  }

  function levelOfText() {
    return fill(ui.levelOf, { n: level + 1, total: content.levels.length });
  }

  function showTitle() {
    fillOverlay({
      eyebrow: ui.eyebrow,
      title: content.title,
      text: content.intro,
      equation: content.equation,
      button: ui.buttons.play
    });
  }

  function showIntro() {
    const info = content.levels[level];
    fillOverlay({
      eyebrow: levelOfText() + SEP + info.place,
      title: info.name,
      text: info.intro,
      goal: ui.goal + ': ' + goalText(level),
      button: ui.buttons.start
    });
  }

  function showComplete() {
    const info = content.levels[level];
    const n = stars[stars.length - 1];
    finishing = false;
    setScreen('complete');
    fillOverlay({
      eyebrow: ui.levelComplete,
      title: info.name,
      text: info.complete,
      fact: ui.didYouKnow + ' ' + info.fact,
      stars: { glyphs: starGlyphs(n), label: n + ' / 3' },
      button: level < LAST ? ui.buttons.next : ui.buttons.seeSugar
    });
    say(ui.levelComplete);
  }

  function showFinale() {
    const f = content.finale;
    const s = f.stats;
    fillOverlay({
      eyebrow: ui.glucoseMade,
      title: f.title,
      text: f.text,
      equation: content.equation,
      stats: [
        [s.o2, totals.o2],
        [s.atp, totals.atp],
        [s.nadph, totals.nadph],
        [s.co2, totals.co2],
        [s.score, score],
        [s.stars, stars.map(function (n) { return starGlyphs(n); }).join(' ')]
      ],
      button: ui.buttons.playAgain
    });
    say(f.title);
  }

  // HUD and stage tracker. Each setter writes only when its value differs.
  function countText() {
    if (level === 0) return counts[0] + ' / ' + targets[0];
    if (level === 1) return labels.o2 + ' ' + counts[0] + ' / ' + targets[0];
    if (level === 2) {
      return labels.atp + ' ' + counts[0] + ' / ' + targets[0] + SEP +
        labels.nadph + ' ' + counts[1] + ' / ' + targets[1];
    }
    return labels.co2 + ' ' + counts[0] + ' / ' + targets[0];
  }

  function progressPct() {
    if (screen === 'title') return 0;
    if (screen === 'finale') return 100;
    let done = 0;
    let total = 0;
    for (let i = 0; i < targets.length; i++) {
      done += counts[i];
      total += targets[i];
    }
    return total ? Math.min(100, Math.round(100 * done / total)) : 0;
  }

  function stockVisible() {
    return level === LAST && screen !== 'title' && screen !== 'finale';
  }

  function renderHud() {
    const onTitle = screen === 'title';
    const info = content.levels[level];
    setText(hud.level, onTitle ? '' : levelOfText());
    setText(hud.name, onTitle ? '' : info.name);
    setText(hud.goal, onTitle ? '' : goalText(level));
    setText(hud.count, onTitle ? '' : countText());
    setText(hud.hint, onTitle ? '' : info.hint);
    const pct = progressPct();
    const width = pct + '%';
    if (hud.bar.style.width !== width) hud.bar.style.width = width;
    if (hud.progress.getAttribute('aria-valuenow') !== String(pct)) {
      hud.progress.setAttribute('aria-valuenow', String(pct));
    }
    setText(hud.score, String(score));
    setHidden(hud.stock, !stockVisible());
    setText(hud.stock, labels.atp + ' ' + stock.atp + SEP + labels.nadph + ' ' + stock.nadph);
  }

  function stageState(i) {
    if (screen === 'title') return 'todo';
    if (screen === 'finale') return 'done';
    if (screen === 'complete') return i <= level ? 'done' : 'todo';
    if (i < level) return 'done';
    return i === level ? 'active' : 'todo';
  }

  function renderStages() {
    for (let i = 0; i < stageEls.length; i++) {
      const s = stageState(i);
      if (stageEls[i].getAttribute('data-state') !== s) stageEls[i].setAttribute('data-state', s);
    }
  }

  // Screen flow. Only the overlay button moves the game between screens.
  // Every screen change goes through setScreen, so the event bus sees each one once.
  function setScreen(name) {
    screen = name;
    if (emitted.screen === name && emitted.level === level) return;
    emitted = { screen: name, level: level };
    emit('screen', { screen: name, level: level });
  }

  function enterTitle() {
    resetRun();
    resetLevel(0);
    setScreen('title');
    showTitle();
  }

  function enterIntro(index) {
    resetLevel(index);
    setScreen('intro');
    showIntro();
  }

  function beginPlaying() {
    setScreen('playing');
    setHidden(ov.overlay, true);
  }

  function enterFinale() {
    setScreen('finale');
    emit('finale', {
      score: score,
      stars: stars.reduce(function (sum, n) { return sum + n; }, 0),
      stats: { o2: totals.o2, atp: totals.atp, nadph: totals.nadph, co2: totals.co2 }
    });
    showFinale();
  }

  // QA entry point: jumps to a level's intro with a fresh score, stock and stars.
  function goToLevel(index) {
    if (!ready) return;
    resetRun();
    enterIntro(clampIndex(index));
  }

  function onOverlayButton() {
    if (now() - overlayOpenedAt < CFG.buttonLockMs) return;   // ignore a double click
    if (screen === 'title') goToLevel(0);
    else if (screen === 'intro') beginPlaying();
    else if (screen === 'complete') {
      if (level < LAST) enterIntro(level + 1);
      else enterFinale();
    } else if (screen === 'finale') goToLevel(0);
  }

  function onRestart() {
    emit('restart', {});
    enterTitle();
  }

  // Pause freezes game time (movement, spawns, timers); rendering continues. Both are idempotent.
  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
    pausedByTab = false;
  }

  // Pause when the tab is hidden. Resume on return only if this handler did the pausing.
  function onVisibility() {
    if (document.hidden) {
      if (!paused) {
        pause();
        pausedByTab = true;
      }
    } else if (pausedByTab) {
      resume();
    }
  }

  function state() {
    return {
      screen: screen,
      level: level,
      paused: paused,
      score: score,
      stars: stars.slice(),
      counts: counts.slice(),
      targets: targets.slice(),
      stock: { atp: stock.atp, nadph: stock.nadph },
      glow: { light: lightGlow(), turbine: turbineGlowNow(), calvin: calvin },
      entities: entities.map(function (e) { return { kind: e.kind, x: e.x, y: e.y }; })
    };
  }

  // Setup, resize and the frame loop.
  function measure() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      view = { w: rect.width, h: rect.height, u: Math.min(rect.width, rect.height) };
    }
  }

  function onResize() {
    render.resize();
    measure();
  }

  function buildStages() {
    hud.stages.textContent = '';
    stageEls = content.levels.map(function (info) {
      const li = document.createElement('li');
      li.className = 'stage';
      li.setAttribute('data-state', 'todo');
      li.textContent = info.stage;
      hud.stages.appendChild(li);
      return li;
    });
  }

  function watchMotion() {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!mq) return;
    reducedMotion = mq.matches;
    const onChange = function (ev) { reducedMotion = ev.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function frame(ts) {
    let dt = (ts - last) / 1000;
    last = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > CFG.maxDt) dt = CFG.maxDt;
    update(dt);
    render.draw(buildScene());
    requestAnimationFrame(frame);
  }

  function init() {
    canvas = byId('scene');
    statusEl = byId('status');
    hud = {
      level: byId('hud-level'),
      name: byId('hud-name'),
      goal: byId('hud-goal'),
      count: byId('hud-count'),
      hint: byId('hud-hint'),
      progress: byId('hud-progress'),
      bar: byId('hud-progress-fill'),
      score: byId('hud-score'),
      stock: byId('hud-stock'),
      stages: byId('hud-stages'),
      restart: byId('btn-restart')
    };
    ov = {
      overlay: byId('overlay'),
      eyebrow: byId('overlay-eyebrow'),
      title: byId('overlay-title'),
      equation: byId('overlay-equation'),
      text: byId('overlay-text'),
      goal: byId('overlay-goal'),
      fact: byId('overlay-fact'),
      stars: byId('overlay-stars'),
      stats: byId('overlay-stats'),
      button: byId('overlay-button')
    };
    buildStages();
    hud.progress.setAttribute('aria-valuemin', '0');
    hud.progress.setAttribute('aria-valuemax', '100');
    render.init(canvas);
    measure();
    watchMotion();
    canvas.addEventListener('pointerdown', onPointerDown);
    ov.button.addEventListener('click', onOverlayButton);
    hud.restart.addEventListener('click', onRestart);
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    ready = true;
    enterTitle();
    last = now();
    requestAnimationFrame(frame);
  }

  P.game = { state: state, goToLevel: goToLevel, tapAt: tapAt, pause: pause, resume: resume };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

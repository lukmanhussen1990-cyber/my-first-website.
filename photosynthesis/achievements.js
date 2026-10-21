(function () {
  'use strict';
  window.Photosynthesis = window.Photosynthesis || {};

  // Player-facing copy for this feature.
  const copy = {
    listLabel: 'Badges earned this run',
    newTag: 'New',
    best: 'Best: {n} of {total} stars',
    encourage: 'You made sugar. Aim for a clean catch or full marks next run.',
    badges: {
      'clean-catch': { name: 'Clean catch', description: 'Finish a level with no misses.' },
      'full-marks': { name: 'Full marks', description: 'Earn 3 stars on one level.' },
      'quick-chemist': { name: 'Quick chemist', description: 'Finish a level in under 40 seconds.' },
      'sugar-maker': { name: 'Sugar maker', description: 'Reach the finale.' },
      'perfect-run': { name: 'Perfect run', description: 'Earn all 12 stars in one run.' }
    }
  };

  const KEY_BADGES = 'photo.badges';
  const KEY_BEST = 'photo.bestStars';
  const MAX_STARS = 12;
  const QUICK_MS = 40000;
  // Sugar maker is always earned at the finale, so the encouraging line checks only these.
  const LEVEL_BADGES = ['clean-catch', 'full-marks', 'quick-chemist'];

  const CSS = [
    '.badges {',
    '  display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;',
    '  padding: 0; list-style: none;',
    '}',
    '.badge-pill {',
    '  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;',
    '  border: 1px solid #52b788; border-radius: 999px;',
    '  background: #1b4332; color: #eaf5ee; font-size: 0.8rem; line-height: 1.3;',
    '}',
    '.badge-pill.is-new { border-color: #ffd166; }',
    '.badge-new {',
    '  padding: 1px 6px; border-radius: 999px; background: #ffd166; color: #0c1a16;',
    '  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;',
    '}',
    '.badges-best { color: #ffd166; font-weight: 700; }',
    '.badges-note { color: #9fbfb0; font-size: 0.9rem; }'
  ].join('\n');

  // Run state lives in memory. `fresh` marks badges whose first-ever unlock happened in this run.
  let run = newRun();
  let mounted = [];

  function newRun() {
    return { levels: {}, earned: {}, fresh: {} };
  }

  function readBadges() {
    try {
      const list = JSON.parse(window.localStorage.getItem(KEY_BADGES));
      return Array.isArray(list) ? list.filter(function (id) { return typeof id === 'string'; }) : [];
    } catch (err) {
      return [];
    }
  }

  function writeBadges(list) {
    try {
      window.localStorage.setItem(KEY_BADGES, JSON.stringify(list));
    } catch (err) {
      // Storage is blocked: badges still show for this run.
    }
  }

  function readBestStars() {
    try {
      const n = Number(JSON.parse(window.localStorage.getItem(KEY_BEST)));
      return Number.isFinite(n) && n > 0 ? Math.min(MAX_STARS, Math.floor(n)) : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeBestStars(n) {
    try {
      window.localStorage.setItem(KEY_BEST, JSON.stringify(n));
    } catch (err) {
      // Storage is blocked: the best score is not kept.
    }
  }

  // Unlock a badge for this run. It is stored once, and a first-ever unlock is marked fresh.
  function earn(id) {
    if (run.earned[id]) return;
    run.earned[id] = true;
    const stored = readBadges();
    if (stored.indexOf(id) === -1) {
      stored.push(id);
      writeBadges(stored);
      run.fresh[id] = true;
    }
  }

  function sumLevelStars() {
    return Object.keys(run.levels).reduce(function (sum, key) {
      return sum + (run.levels[key].stars || 0);
    }, 0);
  }

  function onScreen(d) {
    if (d.screen === 'intro' && d.level === 0) run = newRun();
    if (d.screen !== 'finale') unmount();
  }

  function onLevelComplete(d) {
    run.levels[d.level] = { stars: d.stars, misses: d.misses, elapsedMs: d.elapsedMs };
    if (d.misses === 0) earn('clean-catch');
    if (d.stars === 3) earn('full-marks');
    if (d.elapsedMs < QUICK_MS) earn('quick-chemist');
  }

  function onFinale(d) {
    earn('sugar-maker');
    const stars = typeof d.stars === 'number' ? d.stars : sumLevelStars();
    if (stars === MAX_STARS) earn('perfect-run');
    const previous = readBestStars();
    const best = Math.max(previous, stars);
    if (best !== previous) writeBestStars(best);
    mountFinale(best);
  }

  function onEvent(e) {
    const d = (e && e.detail) || {};
    try {
      if (d.type === 'screen') onScreen(d);
      else if (d.type === 'level-complete') onLevelComplete(d);
      else if (d.type === 'finale') onFinale(d);
    } catch (err) {
      // A badge problem must never stop the game.
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fill(text, values) {
    return text.replace(/\{(\w+)\}/g, function (match, key) {
      return values[key] != null ? String(values[key]) : match;
    });
  }

  function pill(id) {
    const info = copy.badges[id];
    const isNew = !!run.fresh[id];
    const item = el('li', isNew ? 'badge-pill is-new' : 'badge-pill');
    item.setAttribute('data-badge', id);
    item.title = info.description;
    item.appendChild(el('span', '', info.name));
    if (isNew) item.appendChild(el('span', 'badge-new', copy.newTag));
    return item;
  }

  function unmount() {
    mounted.forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    mounted = [];
  }

  // Inserts the best line, an optional encouraging line and the badge list before the finale button.
  function mountFinale(best) {
    unmount();
    const button = document.getElementById('overlay-button');
    const card = button && button.parentNode;
    if (!card || !card.classList || !card.classList.contains('overlay-card')) return;

    const nodes = [el('p', 'badges-best', fill(copy.best, { n: best, total: MAX_STARS }))];
    if (!LEVEL_BADGES.some(function (id) { return run.earned[id]; })) {
      nodes.push(el('p', 'badges-note', copy.encourage));
    }
    const list = el('ul', 'badges');
    list.setAttribute('aria-label', copy.listLabel);
    Object.keys(copy.badges).forEach(function (id) {
      if (run.earned[id]) list.appendChild(pill(id));
    });
    nodes.push(list);

    nodes.forEach(function (node) { card.insertBefore(node, button); });
    mounted = nodes;
  }

  function injectStyle() {
    if (document.querySelector('style[data-feature="achievements"]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-feature', 'achievements');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function start() {
    injectStyle();
    document.addEventListener('photo:event', onEvent);
  }

  window.Photosynthesis.achievements = {
    badges: function () { return readBadges(); },
    bestStars: function () { return readBestStars(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

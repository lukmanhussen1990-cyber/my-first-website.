(function () {
  'use strict';
  window.Photosynthesis = window.Photosynthesis || {};

  // Player-facing strings.
  const copy = {
    help: 'Arrow keys move the cursor, Tab cycles targets, and Enter or Space taps. Escape leaves the scene.'
  };

  const KINDS = ['photon', 'water', 'co2', 'electron'];
  const NADPH = { x: 0.86, y: 0.46 };     // electrons are targets only this close (0.10 u)
  const TURBINE = { x: 0.60, y: 0.58 };   // ATP synthase: a target while it glows
  const TRACK_U = 0.02;                   // a target moves less than this between frames (u)
  const REACQUIRE_U = 0.25;               // how far a target may have moved since last seen (u)

  const CSS = [
    '.kb-cursor {',
    '  display: none; position: absolute; z-index: 2; box-sizing: border-box;',
    '  width: 36px; height: 36px; margin: -18px 0 0 -18px;',
    '  border: 3px solid #eaf5ee; border-radius: 50%;',
    '  box-shadow: 0 0 0 2px #0c1a16, inset 0 0 0 2px #0c1a16;',
    '  pointer-events: none;',
    '}',
    '.kb-cursor.kb-on { display: block; }'
  ].join('\n');

  let scene = null;         // #scene, the canvas
  let wrap = null;          // .scene-wrap, which holds the cursor
  let cursor = null;        // the visible ring
  let overlay = null;       // #overlay
  let pointerMode = false;  // pointer used on the canvas: hidden until the keyboard is used
  let anchor = null;        // target the cursor rides on: { kind, x, y }
  let fresh = true;         // no keyboard placement yet: the first Tab goes to the first target
  let cursorX = 0.5;        // normalized cursor position
  let cursorY = 0.5;
  let frameId = 0;
  let lastPos = '';        // last position written to the DOM

  function game() {
    const g = window.Photosynthesis && window.Photosynthesis.game;
    return g && typeof g.state === 'function' && typeof g.tapAt === 'function' ? g : null;
  }

  function isOpen() {
    return !!overlay && !overlay.hidden;
  }

  function shouldShow() {
    return !!scene && document.activeElement === scene && !pointerMode && !isOpen();
  }

  // Canvas size in CSS pixels, and the canvas origin inside .scene-wrap.
  function metrics() {
    const c = scene.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    return {
      W: c.width,
      H: c.height,
      u: Math.min(c.width, c.height),
      left: c.left - w.left - wrap.clientLeft,
      top: c.top - w.top - wrap.clientTop
    };
  }

  function nearNadph(x, y, m) {
    const dx = (x - NADPH.x) * m.W;
    const dy = (y - NADPH.y) * m.H;
    return Math.sqrt(dx * dx + dy * dy) <= 0.10 * m.u;
  }

  // Live targets from the game, sorted by x and then y.
  function liveTargets() {
    const list = [];
    const g = game();
    if (!g || !scene) return list;
    let st = null;
    try {
      st = g.state();
    } catch (err) {
      st = null;
    }
    if (!st) return list;
    const m = metrics();
    const ents = st.entities || [];
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e || KINDS.indexOf(e.kind) < 0) continue;
      if (e.kind === 'electron' && !nearNadph(e.x, e.y, m)) continue;
      list.push({ kind: e.kind, x: e.x, y: e.y });
    }
    if (st.glow && st.glow.turbine > 0.2) list.push({ kind: 'turbine', x: TURBINE.x, y: TURBINE.y });
    list.sort((a, b) => (a.x - b.x) || (a.y - b.y));
    return list;
  }

  // Index of the same-kind target nearest to a, if it lies within tolU (in u). Otherwise -1.
  function nearestIndex(list, a, tolU) {
    const m = metrics();
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.kind !== a.kind) continue;
      const dx = (t.x - a.x) * m.W;
      const dy = (t.y - a.y) * m.H;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return bestD <= tolU * m.u ? best : -1;
  }

  // Move the cursor to where its anchored target is now. The anchor is dropped if the target is gone.
  function syncAnchor(tolU) {
    if (!anchor) return;
    const list = liveTargets();
    const i = nearestIndex(list, anchor, tolU);
    if (i < 0) {
      anchor = null;
      return;
    }
    anchor = list[i];
    cursorX = anchor.x;
    cursorY = anchor.y;
  }

  function before(ax, ay, bx, by) {
    return ax < bx || (ax === bx && ay < by);
  }

  // First target after the cursor in x-then-y order. Wraps to the first.
  function firstAfter(list) {
    for (let i = 0; i < list.length; i++) {
      if (before(cursorX, cursorY, list[i].x, list[i].y)) return i;
    }
    return 0;
  }

  // Last target before the cursor. Wraps to the last.
  function lastBefore(list) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (before(list[i].x, list[i].y, cursorX, cursorY)) return i;
    }
    return list.length - 1;
  }

  // Tab (dir 1) or Shift+Tab (dir -1). Returns false with no targets, so focus moves as usual.
  function cycle(dir) {
    const list = liveTargets();
    const n = list.length;
    if (!n) return false;
    const i = anchor ? nearestIndex(list, anchor, REACQUIRE_U) : -1;
    let next;
    if (i >= 0) next = (i + dir + n) % n;
    else if (fresh) next = dir > 0 ? 0 : n - 1;
    else next = dir > 0 ? firstAfter(list) : lastBefore(list);
    anchor = list[next];
    cursorX = anchor.x;
    cursorY = anchor.y;
    fresh = false;
    return true;
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Arrow keys move the cursor by hand, so it leaves its target.
  function move(dx, dy) {
    anchor = null;
    fresh = false;
    cursorX = clamp01(cursorX + dx);
    cursorY = clamp01(cursorY + dy);
  }

  // Enter and Space: a tap at the cursor, the same as a pointer tap at that spot.
  function tap() {
    const g = game();
    if (!g) return;
    if (anchor) syncAnchor(REACQUIRE_U);
    try {
      g.tapAt(cursorX, cursorY);
    } catch (err) {
      // The game is not ready for taps. Nothing to do.
    }
  }

  function placeCursor() {
    const m = metrics();
    const left = (m.left + cursorX * m.W).toFixed(1);
    const top = (m.top + cursorY * m.H).toFixed(1);
    const pos = left + ',' + top;
    if (pos === lastPos) return;
    lastPos = pos;
    cursor.style.left = left + 'px';
    cursor.style.top = top + 'px';
  }

  // Re-place the cursor and show or hide it. Runs on focus, keys, resize and pointer use.
  function refresh() {
    if (!scene || !cursor) return;
    placeCursor();
    const show = shouldShow();
    cursor.classList.toggle('kb-on', show);
    if (show && anchor && !frameId) frameId = requestAnimationFrame(frame);
  }

  // While the cursor rides a target, follow it so Enter hits the target as it moves.
  function frame() {
    frameId = 0;
    if (!anchor || !shouldShow()) return;
    syncAnchor(TRACK_U);
    placeCursor();
    if (anchor) frameId = requestAnimationFrame(frame);
  }

  function onKeyDown(e) {
    // Only the canvas itself takes keys, so buttons keep their own Enter and Space.
    if (document.activeElement !== scene || isOpen() || !game()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.shiftKey ? 0.1 : 0.03;
    const key = e.key;
    let handled = true;
    if (key === 'ArrowLeft') move(-step, 0);
    else if (key === 'ArrowRight') move(step, 0);
    else if (key === 'ArrowUp') move(0, -step);
    else if (key === 'ArrowDown') move(0, step);
    else if (key === 'Tab') handled = cycle(e.shiftKey ? -1 : 1);
    else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      if (!e.repeat) tap();
    } else if (key === 'Escape' || key === 'Esc') scene.blur();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    pointerMode = false;
    refresh();
  }

  function onFocus() {
    if (anchor) syncAnchor(REACQUIRE_U);
    refresh();
  }

  function onPointerDown() {
    pointerMode = true;
    refresh();
  }

  // Any key counts as keyboard use, which brings the cursor back after a mouse tap.
  function onAnyKey() {
    if (!pointerMode) return;
    pointerMode = false;
    if (anchor) syncAnchor(REACQUIRE_U);
    refresh();
  }

  // The game announces each screen change. Overlays take focus, so check again after the change.
  function onGameEvent(ev) {
    const d = ev && ev.detail;
    if (d && d.type === 'screen') setTimeout(safe(refresh), 0);
  }

  // Keyboard play must never throw into the page.
  function safe(fn) {
    return function (e) {
      try {
        fn(e);
      } catch (err) {
        // Ignore. The rest of the page keeps working.
      }
    };
  }

  function injectStyle() {
    if (document.querySelector('style[data-feature="keyboard"]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-feature', 'keyboard');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function init() {
    scene = document.getElementById('scene');
    if (!scene || !scene.parentNode || !game() || document.getElementById('kb-help')) return;
    wrap = scene.parentNode;
    overlay = document.getElementById('overlay');
    injectStyle();
    scene.setAttribute('tabindex', '0');

    const help = document.createElement('p');
    help.id = 'kb-help';
    help.className = 'sr-only';
    help.textContent = copy.help;
    wrap.insertBefore(help, scene.nextSibling);

    const ids = (scene.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (ids.indexOf('kb-help') < 0) ids.push('kb-help');
    scene.setAttribute('aria-describedby', ids.join(' '));

    cursor = document.createElement('div');
    cursor.className = 'kb-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(cursor, help.nextSibling);

    scene.addEventListener('keydown', safe(onKeyDown));
    scene.addEventListener('focus', safe(onFocus));
    scene.addEventListener('blur', safe(refresh));
    scene.addEventListener('pointerdown', safe(onPointerDown));
    document.addEventListener('keydown', safe(onAnyKey), true);
    window.addEventListener('resize', safe(refresh));
    document.addEventListener('photo:event', safe(onGameEvent));
    refresh();
  }

  function start() {
    try {
      init();
    } catch (err) {
      // Keyboard play is optional. The page keeps working without it.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Read-only views for tests.
  window.Photosynthesis.keyboard = {
    cursor: () => ({ x: cursorX, y: cursorY }),
    targets: () => (scene ? liveTargets() : [])
  };
})();

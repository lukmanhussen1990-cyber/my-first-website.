/* ==========================================================================
   ArrowGO! by ImranO — app.js
   Screens, board rendering, slide/bump animation, audio, haptics, persistence,
   streaks, premium (demo), ad breaks, league, daily challenge, themes, PWA glue.
   Level generation and collision geometry live in levels.js (window.ArrowLevels).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------- */
  /* Constants                                                               */
  /* ---------------------------------------------------------------------- */
  const VERSION = '1.0.0';
  const STORE_KEY = 'arrowgo.v1';
  const MAX_DROPS = 3;
  const LEAGUE_UNLOCK = 11;
  const DAILY_UNLOCK = 20;
  const AD_EVERY = 3;        // non-premium: an ad break after every 3rd cleared level
  const HINT_EVERY = 5;      // non-premium: +1 free hint every 5 cleared levels
  const START_HINTS = 3;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const PAD = 0.62;          // board padding (cell units) so heads and bumps never clip

  const Levels = window.ArrowLevels;
  const DIRS = Levels.DIRS;

  const THEMES = [
    { id: 'cream', name: 'Cream', premium: false, c: { bg: '#F5EBD8', arrow: '#6E4A2C', primary: '#C77A3A', drop: '#4DA3F0', top: '#F4CFA3' } },
    { id: 'night', name: 'Night', premium: false, c: { bg: '#1D1B2C', arrow: '#EBDDC6', primary: '#EE9A53', drop: '#6FB8FF', top: '#3A2F5E' } },
    { id: 'ocean', name: 'Ocean', premium: true, c: { bg: '#DDEFF3', arrow: '#164D61', primary: '#1F8FA6', drop: '#2F86E0', top: '#A8DCE8' } },
    { id: 'forest', name: 'Forest', premium: true, c: { bg: '#E5EDDB', arrow: '#344F2A', primary: '#4F8A3C', drop: '#4DA3F0', top: '#C5DCA8' } },
  ];

  const TIPS = [
    'Play for 10 minutes daily, your focus will thank you.',
    'Look before you tap: every arrow leaves the way its head points.',
    'Outer arrows usually go first. Work from the edges inward.',
    'Stuck? A hint lights up an arrow that is free to go.',
    'Short daily sessions build the strongest streaks.',
    'Breathe. Calm eyes find the free arrow faster.',
  ];

  const RIVALS = ['Aisha', 'Leo', 'Mateo', 'Yuki', 'Priya', 'Noah', 'Zara', 'Omar', 'Lina', 'Kofi',
    'Sofia', 'Hiro', 'Maya', 'Ivan', 'Nadia', 'Ravi', 'Elena', 'Tariq', 'Chloe', 'Diego', 'Amara',
    'Finn', 'Mei', 'Samir', 'Ines', 'Jonas', 'Leila', 'Kai', 'Rosa', 'Arjun', 'Hana', 'Luca',
    'Fatima', 'Theo', 'Sana', 'Emil', 'Noor', 'Felix', 'Aria', 'Bilal'];
  const AVATAR_COLORS = ['#E07A5F', '#3D8FD1', '#81B29A', '#E9A23B', '#9C6ADE', '#E56B9F', '#4BB3A6', '#C77A3A', '#6C8EAD', '#B5893A'];

  /* ---------------------------------------------------------------------- */
  /* Small helpers                                                           */
  /* ---------------------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const params = new URLSearchParams(location.search);
  const isAndroid = !!window.AndroidBridge;
  const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  };
  const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
  const later = (fn, ms) => setTimeout(fn, ms);

  /* ---------------------------------------------------------------------- */
  /* Calendar helpers (local calendar days as 'YYYY-MM-DD' keys)             */
  /* ---------------------------------------------------------------------- */
  const DAY_MS = 86400000;
  const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function keyOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  /* "?today=YYYY-MM-DD" lets testers simulate other days (streaks, daily challenge, league). */
  function todayKey() {
    const o = params.get('today');
    if (o && /^\d{4}-\d{2}-\d{2}$/.test(o) && !isNaN(keyToUTC(o))) return o;
    return keyOf(new Date());
  }
  function keyToUTC(k) { const p = k.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function dayDiff(a, b) { return Math.round((keyToUTC(b) - keyToUTC(a)) / DAY_MS); }
  function addDays(k, n) {
    const d = new Date(keyToUTC(k) + n * DAY_MS);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function weekdayOf(k) { return new Date(keyToUTC(k)).getUTCDay(); }
  function shortDate(k) { const p = k.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2]; }
  function isoWeek(k) {
    const d = new Date(keyToUTC(k));
    const day = (d.getUTCDay() + 6) % 7;            // Monday = 0
    d.setUTCDate(d.getUTCDate() - day + 3);         // Thursday decides the ISO year
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week = 1 + Math.round(((d - jan4) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return { year, week, key: year + '-W' + pad2(week) };
  }

  /* ---------------------------------------------------------------------- */
  /* Persistence: one JSON object in localStorage                            */
  /* ---------------------------------------------------------------------- */
  function defaults() {
    return {
      v: 1,
      level: 1,
      premium: false,
      hints: START_HINTS,
      theme: 'cream',
      sound: true,
      vibration: true,
      streak: { count: 0, last: null, shown: null, prev: 0 },
      played: [],
      today: { date: null, levels: 0 },
      cleared: 0,
      adDue: false,
      weekly: { week: null, score: 0 },
      daily: {},
      totalScore: 0,
      tutorialDone: false,
      tipIndex: 0,
      stats: { taps: 0, mistakes: 0, hints: 0, seconds: 0 },
    };
  }

  function load() {
    const base = defaults();
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return base;
    const s = Object.assign(base, raw);
    ['streak', 'today', 'weekly', 'stats'].forEach((k) => {
      s[k] = Object.assign(defaults()[k], raw[k] && typeof raw[k] === 'object' ? raw[k] : {});
    });
    s.level = Math.max(1, Math.floor(Number(s.level)) || 1);
    s.hints = Math.max(0, Math.floor(Number(s.hints)) || 0);
    s.cleared = Math.max(0, Math.floor(Number(s.cleared)) || 0);
    s.premium = s.premium === true;
    s.sound = s.sound !== false;
    s.vibration = s.vibration !== false;
    if (!Array.isArray(s.played)) s.played = [];
    if (!s.daily || typeof s.daily !== 'object' || Array.isArray(s.daily)) s.daily = {};
    const theme = THEMES.find((t) => t.id === s.theme);
    if (!theme || (theme.premium && !s.premium)) s.theme = 'cream';
    return s;
  }

  let S = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage full / blocked */ }
  }

  /* ---------------------------------------------------------------------- */
  /* Sound: everything is synthesised with WebAudio (no audio files)         */
  /* ---------------------------------------------------------------------- */
  const Sound = (function () {
    let ctx = null;
    let master = null;
    let noiseBuf = null;

    function ready() {
      if (!S.sound) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain();
        master.gain.value = 0.6;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }

    function tone(o) {
      const c = ready();
      if (!c) return;
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.15;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol == null ? 0.2 : o.vol, t0 + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    function noise(o) {
      const c = ready();
      if (!c) return;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.Q.value = o.q || 1.2;
      f.frequency.setValueAtTime(o.freq || 1000, t0);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    }

    const chord = (notes, gap, o) => notes.forEach((f, i) => tone(Object.assign({ freq: f, delay: i * gap }, o)));

    return {
      unlock: () => { ready(); },
      suspend: () => { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
      resume: () => { if (ctx && S.sound && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
      click: () => tone({ freq: 540, type: 'triangle', dur: 0.07, vol: 0.12 }),
      slide: () => {
        noise({ freq: 700, to: 3800, dur: 0.3, vol: 0.14, q: 0.9 });
        tone({ freq: 480, to: 980, dur: 0.16, type: 'sine', vol: 0.1 });
        tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.05, delay: 0.06 });
      },
      bump: () => {
        tone({ freq: 170, to: 80, dur: 0.16, type: 'square', vol: 0.11 });
        noise({ freq: 320, dur: 0.1, vol: 0.25, filter: 'lowpass' });
      },
      lose: () => tone({ freq: 660, to: 280, dur: 0.4, type: 'sine', vol: 0.15, delay: 0.05 }),
      deny: () => tone({ freq: 300, to: 220, dur: 0.14, type: 'triangle', vol: 0.12 }),
      win: () => {
        chord([523.25, 659.25, 783.99, 1046.5], 0.09, { dur: 0.3, type: 'triangle', vol: 0.15 });
        tone({ freq: 1567.98, dur: 0.6, type: 'sine', vol: 0.09, delay: 0.38 });
      },
      star: (i) => tone({ freq: [880, 1108.73, 1318.51][i] || 880, dur: 0.28, type: 'triangle', vol: 0.15 }),
      hint: () => {
        tone({ freq: 1046.5, dur: 0.12, type: 'sine', vol: 0.12 });
        tone({ freq: 1567.98, dur: 0.22, type: 'sine', vol: 0.1, delay: 0.08 });
      },
      fail: () => chord([392, 329.63, 261.63], 0.14, { dur: 0.32, type: 'triangle', vol: 0.13 }),
      chime: () => chord([659.25, 880, 1318.51], 0.1, { dur: 0.4, type: 'sine', vol: 0.12 }),
      fanfare: () => chord([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.07, { dur: 0.35, type: 'triangle', vol: 0.13 }),
      tick: () => tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.04 }),
      pop: () => tone({ freq: 760, to: 1240, dur: 0.1, type: 'sine', vol: 0.12 }),
    };
  })();

  /* ---------------------------------------------------------------------- */
  /* Haptics: Android bridge inside the APK, navigator.vibrate elsewhere     */
  /* ---------------------------------------------------------------------- */
  function buzz(pattern) {
    if (!S.vibration) return;
    try {
      if (isAndroid && typeof window.AndroidBridge.vibrate === 'function') {
        const arr = Array.isArray(pattern) ? pattern : [pattern];
        let t = 0;
        arr.forEach((ms, i) => {
          if (i % 2 === 0) later(() => { try { window.AndroidBridge.vibrate(ms); } catch (e) { /* ignore */ } }, t);
          t += ms;
        });
      } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) { /* vibration unsupported */ }
  }

  /* ---------------------------------------------------------------------- */
  /* Themes and system bars                                                  */
  /* ---------------------------------------------------------------------- */
  function themeById(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }

  function isLight(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return true;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  }

  function syncBars(color) {
    const bg = color || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F5EBD8';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
    if (isAndroid && typeof window.AndroidBridge.setSystemBars === 'function') {
      try { window.AndroidBridge.setSystemBars(bg, isLight(bg)); } catch (e) { /* ignore */ }
    }
  }

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    syncScreenBars();
  }

  function syncScreenBars() {
    const t = themeById(S.theme);
    if (currentScreen === 'streak') syncBars(t.c.top);
    else if (currentScreen === 'result') syncBars(getComputedStyle(document.documentElement).getPropertyValue('--result-a').trim());
    else syncBars(t.c.bg);
  }

  /* ---------------------------------------------------------------------- */
  /* Screens, overlays and back navigation                                   */
  /* ---------------------------------------------------------------------- */
  let currentScreen = 'splash';
  let returnStack = [];
  const overlayStack = [];
  let afterPremium = null;    // continuation when the premium page was opened from an ad break

  function showScreen(id) {
    const prev = currentScreen;
    if (prev === 'game' && id !== 'game') pauseGame();
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    currentScreen = id;
    syncScreenBars();
    if (id === 'home') renderHome();
    if (id === 'game' && prev !== 'game') onGameShown();
  }

  function openSub(id) {
    closeAllOverlays();
    if (currentScreen !== id) returnStack.push(currentScreen);
    if (id === 'premium') renderPremium();
    if (id === 'league') renderLeague();
    if (id === 'daily') renderDaily();
    if (id === 'themes') renderThemes();
    showScreen(id);
    const body = $('#screen-' + id + ' .subpage-body');
    if (body) body.scrollTop = 0;
  }

  function closeSub() {
    const leaving = currentScreen;
    let to = returnStack.pop() || 'home';
    if (to === 'splash' || to === 'streak') to = 'home';
    showScreen(to);
    if (leaving === 'premium' && afterPremium) {
      const fn = afterPremium;
      afterPremium = null;
      fn();
    }
  }

  function goHome() {
    closeAllOverlays();
    returnStack = [];
    afterPremium = null;
    showScreen('home');
  }

  function openOverlay(id) {
    const el = $('#' + id);
    if (!el) return;
    el.classList.add('show');
    const i = overlayStack.indexOf(id);
    if (i >= 0) overlayStack.splice(i, 1);
    overlayStack.push(id);
    pauseGame();
  }

  function closeOverlay(id) {
    const el = $('#' + id);
    if (el) el.classList.remove('show');
    const i = overlayStack.indexOf(id);
    if (i >= 0) overlayStack.splice(i, 1);
    if (!overlayStack.length) resumeGame();
  }

  function closeAllOverlays() {
    stopAd();
    overlayStack.slice().forEach((id) => { const el = $('#' + id); if (el) el.classList.remove('show'); });
    overlayStack.length = 0;
  }

  /* Called by Android back button (MainActivity) and by browser popstate. */
  function handleBack() {
    if (overlayStack.length) {
      const top = overlayStack[overlayStack.length - 1];
      if (top === 'ad-break') return true;               // ad breaks finish on their own
      if (top === 'fail-overlay') { goHome(); return true; }
      closeOverlay(top);
      return true;
    }
    switch (currentScreen) {
      case 'splash': return true;
      case 'streak': continueFromStreak(); return true;
      case 'home': return false;
      case 'game':
      case 'result': goHome(); return true;
      default: closeSub(); return true;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Toast, modal, confetti                                                  */
  /* ---------------------------------------------------------------------- */
  let toastTimer = 0;
  function toast(msg, opts) {
    opts = opts || {};
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('gold', !!opts.gold);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = later(() => el.classList.remove('show'), opts.ms || 2300);
  }

  function modal(o) {
    $('#modal-title').textContent = o.title;
    $('#modal-text').textContent = o.text || '';
    $('#modal-art').innerHTML = o.art || '';
    const box = $('#modal-actions');
    box.innerHTML = '';
    box.className = o.row ? 'dialog-row' : '';
    (o.actions || [{ label: 'OK' }]).forEach((a) => {
      const b = document.createElement('button');
      b.className = a.cls || 'btn';
      b.textContent = a.label;
      b.addEventListener('click', () => {
        Sound.click();
        closeOverlay('modal');
        if (a.onClick) a.onClick();
      });
      box.appendChild(b);
    });
    openOverlay('modal');
  }

  const Confetti = (function () {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const COLORS = ['#FF7A5C', '#FFB93B', '#4DA3F0', '#7FD3A4', '#C77A3A', '#B07CFF', '#FFE066'];
    let parts = [];
    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;

    function resize() {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(x, y, vx, vy) {
      parts.push({
        x, y, vx, vy,
        g: 0.22 + Math.random() * 0.12,
        s: 6 + Math.random() * 6,
        r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.35,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0,
        max: 120 + Math.random() * 90,
        round: Math.random() < 0.28,
      });
    }

    function burst(n, opts) {
      opts = opts || {};
      resize();
      const ox = opts.x != null ? opts.x : w / 2;
      const oy = opts.y != null ? opts.y : h * 0.3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 9;
        spawn(ox, oy, Math.cos(a) * sp, Math.sin(a) * sp - 6);
      }
      start();
    }

    function rain(n) {
      resize();
      for (let i = 0; i < n; i++) spawn(Math.random() * w, -20 - Math.random() * h * 0.4, (Math.random() - 0.5) * 2, Math.random() * 2);
      start();
    }

    function start() {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    }

    function step(now) {
      const dt = clamp((now - last) / 16.67, 0.2, 3);
      last = now;
      ctx.clearRect(0, 0, w, h);
      parts = parts.filter((p) => p.life < p.max && p.y < h + 40);
      for (const p of parts) {
        p.vy += p.g * dt;
        p.vx *= Math.pow(0.985, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        p.life += dt;
        const alpha = 1 - Math.max(0, (p.life - p.max * 0.7) / (p.max * 0.3));
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.4, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s * 0.28, p.s, p.s * 0.56);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (parts.length) raf = requestAnimationFrame(step);
      else { raf = 0; ctx.clearRect(0, 0, w, h); }
    }

    return { burst, rain, clear: () => { parts = []; } };
  })();

  function countUp(el, from, to, ms) {
    const t0 = performance.now();
    function step(now) {
      const u = Math.min(1, (now - t0) / ms);
      el.textContent = fmtNum(from + (to - from) * easeOutCubic(u));
      if (u < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------------- */
  /* Logo: inline the SVG so the splash can "draw" the three arrows          */
  /* ---------------------------------------------------------------------- */
  let logoMarkup = null;

  function uniquify(svgText, suffix) {
    return svgText
      .replace(/<\?xml[^>]*>/g, '')
      .replace(/\bid="([^"]+)"/g, 'id="$1-' + suffix + '"')
      .replace(/url\(#([^)]+)\)/g, 'url(#$1-' + suffix + ')')
      .replace(/href="#([^"]+)"/g, 'href="#$1-' + suffix + '"');
  }

  function fillLogoSlot(slot, i) {
    if (logoMarkup) {
      slot.innerHTML = uniquify(logoMarkup, 'l' + i);
      const svg = slot.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('logo-svg');
        const drawing = slot.dataset.logo === 'draw';
        svg.classList.add(drawing ? 'pending' : 'static');
        if (drawing && $('#splash-game').classList.contains('in')) svg.classList.add('draw');
      }
    } else {
      slot.innerHTML = '<img src="icons/logo.svg" alt="" style="width:100%;height:100%">';
    }
  }

  function injectLogos() {
    return fetch('icons/logo.svg')
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((txt) => {
        logoMarkup = txt && txt.indexOf('<svg') >= 0 ? txt : null;
        $$('.logo-slot').forEach(fillLogoSlot);
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Splash                                                                  */
  /* ---------------------------------------------------------------------- */
  let streakPending = false;

  function runSplash() {
    $('#splash-tip').textContent = TIPS[S.tipIndex % TIPS.length];
    S.tipIndex = (S.tipIndex + 1) % TIPS.length;
    save();
    let stage = 0;
    let t2 = 0;
    const t1 = later(stageGame, 1550);

    function stageGame() {
      if (stage >= 1) return;
      stage = 1;
      clearTimeout(t1);
      $('#splash-publisher').classList.add('out');
      $('#splash-game').classList.add('in');
      const logo = $('#splash-game .logo-svg');
      if (logo) logo.classList.add('draw');
      t2 = later(finish, 2400);
    }

    function finish() {
      if (stage >= 2) return;
      stage = 2;
      clearTimeout(t1);
      clearTimeout(t2);
      if (streakPending) showStreak();
      else if (!S.tutorialDone && S.level === 1) startPuzzle('level', 1);
      else goHome();
    }

    $('#screen-splash').addEventListener('click', () => {
      Sound.unlock();
      if (stage === 0) stageGame();
      else finish();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Daily streak                                                            */
  /*  - opening the app on a new calendar day counts as playing that day     */
  /*  - consecutive day => streak + 1, a gap of 2+ days => streak resets to 1 */
  /*  - the streak screen shows once per calendar day                        */
  /* ---------------------------------------------------------------------- */
  function updateStreak() {
    const t = todayKey();
    const st = S.streak;
    if (st.last !== t) {
      st.prev = st.count || 0;
      const gap = st.last ? dayDiff(st.last, t) : null;
      if (gap === 1) st.count = (st.count || 0) + 1;
      else if (gap === null || gap > 1) st.count = 1;
      else st.count = Math.max(1, st.count || 1);   // clock moved backwards: keep the streak
      st.last = t;
      if (S.played.indexOf(t) < 0) S.played.push(t);
      if (S.played.length > 120) S.played = S.played.slice(-120);
    }
    if (S.today.date !== t) S.today = { date: t, levels: 0 };
    const show = st.shown !== t;
    if (show) st.shown = t;
    save();
    return show;
  }

  function streakMessage(count, prev) {
    if (count === 1 && prev > 1) return 'Fresh start! A new streak begins today.';
    if (count === 1) return 'You are ready for a great week!';
    if (count === 2) return 'Two days in a row. Nice rhythm!';
    if (count < 7) return count + ' days strong. Keep the flow going!';
    if (count === 7) return 'A perfect week! Your focus is on fire.';
    return count + '-day streak! You are unstoppable.';
  }

  function showStreak() {
    const t = todayKey();
    const count = Math.max(1, S.streak.count);
    const pos = (count - 1) % 7;                     // today's slot in the 7-day row
    const start = addDays(t, -pos);
    const row = $('#week-row');
    row.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i);
      const done = i <= pos;
      const d = document.createElement('div');
      d.className = 'week-day' + (i === pos ? ' today' : '');
      d.setAttribute('role', 'listitem');
      d.setAttribute('aria-label', WD_LONG[weekdayOf(k)] + (done ? ': played' : ''));
      d.innerHTML = '<span>' + WD[weekdayOf(k)] + '</span><div class="week-dot' + (done ? ' done' : '') + '"' +
        (done ? ' style="animation-delay:' + (0.5 + i * 0.08 + (i === pos ? 0.35 : 0)).toFixed(2) + 's"' : '') + '>' +
        (done ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</div>';
      row.appendChild(d);
    }
    $('#streak-msg').textContent = streakMessage(count, S.streak.prev || 0);
    const num = $('#streak-number');
    num.textContent = String(Math.max(0, count - 1));
    num.classList.remove('bump');
    showScreen('streak');
    later(() => {
      num.textContent = String(count);
      num.classList.add('bump');
      Sound.chime();
      buzz(20);
    }, 900);
  }

  function continueFromStreak() {
    Sound.click();
    if (!S.tutorialDone && S.level === 1) startPuzzle('level', 1);
    else goHome();
  }

  /* ---------------------------------------------------------------------- */
  /* Home                                                                    */
  /* ---------------------------------------------------------------------- */
  const LOCK_SVG = '<svg class="icon"><use href="#i-lock"/></svg>';

  function leagueOpen() { return S.premium || S.level >= LEAGUE_UNLOCK; }
  function dailyOpen() { return S.premium || S.level >= DAILY_UNLOCK; }
  function todayLevels() { return S.today.date === todayKey() ? S.today.levels : 0; }

  function renderHome() {
    const t = todayKey();
    $('#home-streak').textContent = String(Math.max(1, S.streak.count));
    $('#chip-premium').hidden = !S.premium;
    $('#play-level').textContent = 'Level ' + S.level;

    const lc = $('#card-league');
    lc.classList.toggle('locked', !leagueOpen());
    $('#cta-league').innerHTML = leagueOpen() ? 'Rank #' + leagueTable().rank : LOCK_SVG + 'Unlock Lv.' + LEAGUE_UNLOCK;

    const dc = $('#card-daily');
    const done = !!S.daily[t];
    dc.classList.toggle('locked', !dailyOpen());
    $('#daily-date').textContent = shortDate(t);
    dc.classList.toggle('done', done && dailyOpen());
    $('#cta-daily').innerHTML = !dailyOpen() ? LOCK_SVG + 'Unlock Lv.' + DAILY_UNLOCK
      : done ? '<svg class="icon"><use href="#i-trophy"/></svg>Completed' : 'Play';

    $('#cta-themes').textContent = themeById(S.theme).name;
    $('#cta-premium').textContent = S.premium ? 'Active' : 'Go Premium';

    const tl = todayLevels();
    $('#home-today').textContent = tl + (tl === 1 ? ' level today' : ' levels today');
    $('#home-hints').textContent = S.premium ? 'Unlimited hints' : S.hints + (S.hints === 1 ? ' hint' : ' hints');
  }

  function lockedTap(card, msg) {
    Sound.deny();
    buzz(15);
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    toast(msg);
  }

  /* ---------------------------------------------------------------------- */
  /* GAME STATE                                                              */
  /* ---------------------------------------------------------------------- */
  const board = $('#board');
  const G = {
    token: 0,
    active: false,
    mode: 'level',
    level: 1,
    dateKey: null,
    puzzle: null,
    size: 0,
    arrows: new Map(),
    grid: null,
    remaining: 0,
    total: 0,
    drops: MAX_DROPS,
    mistakes: 0,
    hintsUsed: 0,
    taps: 0,
    elapsed: 0,
    runningSince: 0,
    paused: true,
    over: false,
    won: false,
    hintId: -1,
    layers: null,
    stroke: 0.16,
    cellPx: 40,
    tutorial: 0,
    result: null,
  };

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  }

  const P = (p) => p[0].toFixed(3) + ' ' + p[1].toFixed(3);
  const center = (cell) => [cell[1] + 0.5, cell[0] + 0.5];   // [x, y] in board units

  function startPuzzle(mode, arg) {
    cancelAnims();
    closeAllOverlays();
    let puzzle;
    try {
      puzzle = mode === 'daily' ? Levels.generateDaily(arg) : Levels.generateLevel(arg);
    } catch (e) {
      console.error('Level generation failed', e);
      toast('Could not build this board. Please try again.');
      goHome();
      return;
    }
    G.token++;
    Object.assign(G, {
      active: true,
      mode,
      level: mode === 'level' ? arg : null,
      dateKey: mode === 'daily' ? arg : null,
      puzzle,
      size: puzzle.size,
      drops: MAX_DROPS,
      mistakes: 0,
      hintsUsed: 0,
      taps: 0,
      elapsed: 0,
      runningSince: 0,
      paused: true,
      over: false,
      won: false,
      hintId: -1,
      tutorial: 0,
      result: null,
    });
    G.arrows = new Map();
    puzzle.arrows.forEach((a) => {
      G.arrows.set(a.id, { id: a.id, cells: a.cells.map((c) => c.slice()), dir: a.dir, state: 'idle', el: null, line: null, head: null, track: null, flash: 0 });
    });
    G.grid = Levels.buildGrid(puzzle.arrows, puzzle.size);
    G.remaining = G.total = puzzle.arrows.length;

    $('#game-title').textContent = mode === 'daily' ? 'Daily · ' + shortDate(arg) : 'Level ' + arg;
    renderDrops();
    renderHintBadge();
    updateLeft();
    $('#game-timer').textContent = '00:00';
    returnStack = [];
    buildBoard();
    showScreen('game');
    layoutBoard();
    G.paused = true;
    resumeGame();
    setupTutorial();
  }

  /* Resume the in-progress board from Home (same level), otherwise start the next one. */
  function playFromHome() {
    Sound.unlock();
    Sound.click();
    if (G.active && G.mode === 'level' && G.level === S.level && !G.won && !G.over && G.remaining > 0) {
      showScreen('game');
      return;
    }
    playNext();
  }

  function playNext() {
    const go = () => startPuzzle('level', S.level);
    if (S.adDue && !S.premium) {
      S.adDue = false;
      save();
      showAd(go);
    } else {
      if (S.adDue) { S.adDue = false; save(); }
      go();
    }
  }

  function onGameShown() {
    layoutBoard();
    if (G.active && G.over && !G.won) {
      renderFail();
      openOverlay('fail-overlay');
    } else {
      resumeGame();
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Board rendering                                                         */
  /* ---------------------------------------------------------------------- */
  function buildBoard() {
    const n = G.size;
    board.innerHTML = '';
    board.setAttribute('viewBox', (-PAD) + ' ' + (-PAD) + ' ' + (n + PAD * 2) + ' ' + (n + PAD * 2));
    const dots = svgEl('g', { class: 'dots' });
    const hint = svgEl('g', { class: 'hint-layer' });
    const arrows = svgEl('g', { class: 'arrows' });
    board.append(dots, hint, arrows);
    G.layers = { dots, hint, arrows };
    let order = 0;
    G.arrows.forEach((a) => {
      const g = svgEl('g', { class: 'arrow', 'data-id': a.id });
      g.style.animationDelay = Math.min(order++ * 18, 520) + 'ms';
      a.line = svgEl('path', { class: 'arrow-line' });
      a.head = svgEl('path', { class: 'arrow-head' });
      g.append(a.line, a.head);
      arrows.appendChild(g);
      a.el = g;
      a.track = buildTrack(a);
      drawArrow(a, 0);
    });
    board.classList.remove('board-enter');
    void board.getBoundingClientRect();
    board.classList.add('board-enter');
  }

  /* Size the board to the free space; keep the stroke ~6.4 CSS px at any board size. */
  function layoutBoard() {
    if (!G.active || !G.layers) return;
    const r = $('#board-wrap').getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const span = G.size + PAD * 2;
    const cell = clamp(Math.min(r.width / span, r.height / span), 8, 66);
    const px = Math.floor(cell * span);
    board.style.width = px + 'px';
    board.style.height = px + 'px';
    G.cellPx = cell;
    G.stroke = clamp(6.4 / cell, 0.1, 0.2);
    G.layers.arrows.setAttribute('stroke-width', G.stroke.toFixed(3));
    G.arrows.forEach((a) => { if (a.state === 'idle') drawArrow(a, 0); });
    if (G.hintId >= 0) drawHint(G.hintId);
    positionTutorial();
  }

  /* ---------------------------------------------------------------------- */
  /* SLIDE GEOMETRY                                                          */
  /*                                                                         */
  /* An arrow moves like a snake. Its "track" is the list of cell centres of */
  /* its own body (tail -> head) followed by the cells straight ahead of the */
  /* head, continuing well past the board edge. Sliding the arrow forward by */
  /* s cells means drawing the window [s, s + len - 1] of that track: the    */
  /* head leads along the exit ray and every body point follows exactly the  */
  /* path of the point in front of it. Because the body only re-visits cells */
  /* the head already passed, the exit ray (levels.js exitRay) is the only    */
  /* place a collision can happen - which is what findBlocker checks.        */
  /* ---------------------------------------------------------------------- */
  function buildTrack(a) {
    const pts = a.cells.map(center);
    const d = DIRS[a.dir];
    const head = a.cells[a.cells.length - 1];
    const extra = G.size + a.cells.length + 3;
    for (let i = 1; i <= extra; i++) pts.push([head[1] + d[1] * i + 0.5, head[0] + d[0] * i + 0.5]);
    return pts;
  }

  function pointAt(track, t) {
    const i = clamp(Math.floor(t), 0, track.length - 2);
    const f = t - i;
    const p = track[i];
    const q = track[i + 1];
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  }

  /* Draw arrow `a` advanced by s cells along its track (s = 0 is its resting place). */
  function drawArrow(a, s) {
    const tr = a.track;
    const len = a.cells.length;
    const t0 = s;
    const t1 = s + len - 1;
    const headPt = pointAt(tr, t1);
    const seg = clamp(Math.ceil(t1) - 1, 0, tr.length - 2);
    const dx = tr[seg + 1][0] - tr[seg][0];
    const dy = tr[seg + 1][1] - tr[seg][1];
    const sw = G.stroke;
    const hl = Math.min(0.5, sw * 2.7);           // arrowhead length
    const hw = hl * 0.6;                           // arrowhead half width
    const back = hl * 0.4;
    const tip = [headPt[0] + dx * hl * 0.6, headPt[1] + dy * hl * 0.6];
    const base = [headPt[0] - dx * back, headPt[1] - dy * back];

    let d = 'M' + P(pointAt(tr, t0));
    for (let k = Math.floor(t0) + 1; k < t1 - back - 1e-6; k++) d += 'L' + P(tr[k]);
    d += 'L' + P(base);
    a.line.setAttribute('d', d);

    const px = -dy * hw;
    const py = dx * hw;
    a.head.setAttribute('d', 'M' + P(tip) + 'L' + P([base[0] + px, base[1] + py]) + 'L' + P([base[0] - px, base[1] - py]) + 'Z');
    a.head.setAttribute('stroke-width', (sw * 0.55).toFixed(3));
  }

  function addDot(cell) {
    if (!G.layers) return;
    const c = center(cell);
    const dot = svgEl('circle', { class: 'dot fresh', cx: c[0], cy: c[1], r: 0.07 });
    G.layers.dots.appendChild(dot);
  }

  /* ---------------------------------------------------------------------- */
  /* Animation engine (one requestAnimationFrame loop for all arrows)        */
  /* ---------------------------------------------------------------------- */
  const anims = new Set();
  let animRaf = 0;

  function animate(spec) {
    spec.t0 = performance.now();
    anims.add(spec);
    if (!animRaf) animRaf = requestAnimationFrame(animTick);
    return spec;
  }

  function animTick(now) {
    animRaf = 0;
    Array.from(anims).forEach((sp) => {
      let alive = false;
      try { alive = sp.update(Math.max(0, (now - sp.t0) / 1000)); } catch (e) { console.error(e); }
      if (!alive) {
        anims.delete(sp);
        if (sp.done) { try { sp.done(); } catch (e) { console.error(e); } }
      }
    });
    if (anims.size) animRaf = requestAnimationFrame(animTick);
  }

  function cancelAnims() {
    anims.clear();
    if (animRaf) cancelAnimationFrame(animRaf);
    animRaf = 0;
  }

  /* ---------------------------------------------------------------------- */
  /* Input                                                                   */
  /* ---------------------------------------------------------------------- */
  function boardPoint(e) {
    const ctm = board.getScreenCTM();
    if (!ctm) return null;
    const pt = board.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(ctm.inverse());
  }

  function distToSegment(px, py, a, b) {
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy || 1;
    const t = clamp(((px - a[0]) * vx + (py - a[1]) * vy) / len2, 0, 1);
    const qx = a[0] + vx * t - px;
    const qy = a[1] + vy * t - py;
    return Math.sqrt(qx * qx + qy * qy);
  }

  /* Tap target: the cell under the finger, or (forgiving) the nearest arrow within 0.6 cell. */
  function pickArrow(x, y) {
    const n = G.size;
    const r = Math.floor(y);
    const c = Math.floor(x);
    if (r >= 0 && r < n && c >= 0 && c < n) {
      const id = G.grid[r][c];
      if (id >= 0) return G.arrows.get(id).state === 'idle' ? id : -1;
    }
    let best = -1;
    let bestD = 0.6;
    G.arrows.forEach((a) => {
      if (a.state !== 'idle') return;
      const pts = a.cells.map(center);
      const head = pts[pts.length - 1];
      const dd = DIRS[a.dir];
      pts.push([head[0] + dd[1] * 0.35, head[1] + dd[0] * 0.35]);   // include the arrowhead
      for (let i = 0; i < pts.length - 1; i++) {
        const dist = distToSegment(x, y, pts[i], pts[i + 1]);
        if (dist < bestD) { bestD = dist; best = a.id; }
      }
    });
    return best;
  }

  board.addEventListener('pointerdown', (e) => {
    if (!G.active || G.paused || G.over || G.won) return;
    if (e.button > 0) return;
    e.preventDefault();
    const p = boardPoint(e);
    if (!p) return;
    const id = pickArrow(p.x, p.y);
    if (id >= 0) tapArrow(id);
  });

  function tapArrow(id) {
    const a = G.arrows.get(id);
    if (!a || a.state !== 'idle' || G.over || G.won) return;
    Sound.unlock();
    G.taps++;
    const block = Levels.findBlocker(a, G.grid, G.size);
    if (!block) leave(a);
    else bump(a, block);
    tutorialAfterTap(!block);
  }

  function removeFromGrid(a) {
    a.cells.forEach((c) => { if (G.grid[c[0]][c[1]] === a.id) G.grid[c[0]][c[1]] = -1; });
  }

  /* A free arrow: it leaves the logical board at once (so the player can keep tapping)
     and its sprite accelerates out along the track, turning green and fading off-board. */
  function leave(a) {
    a.state = 'leaving';
    removeFromGrid(a);
    G.remaining--;
    updateLeft();
    if (G.hintId === a.id) clearHint();
    a.el.classList.remove('bad', 'hinted');
    a.el.classList.add('ok');
    G.layers.arrows.appendChild(a.el);
    Sound.slide();
    buzz(12);
    const len = a.cells.length;
    const ray = Levels.exitRay(a, G.size).length;
    const dist = ray + len + 0.9;
    let vacated = 0;
    const token = G.token;
    animate({
      update(t) {
        if (token !== G.token) return false;
        const s = Math.min(dist, 7 * t + 40 * t * t);
        drawArrow(a, s);
        while (vacated < len && s > vacated + 0.55) { addDot(a.cells[vacated]); vacated++; }
        a.el.style.opacity = String(s < ray + 0.6 ? 1 : clamp(1 - (s - ray - 0.6) / len, 0, 1));
        return s < dist;
      },
      done() {
        if (token !== G.token) return;
        a.state = 'gone';
        a.el.remove();
        checkWin();
      },
    });
  }

  /* A blocked arrow: slide up to the blocker, bump it, bounce back, flash red, lose a drop. */
  function bump(a, block) {
    a.state = 'bumping';
    G.mistakes++;
    G.drops = Math.max(0, G.drops - 1);
    if (G.drops === 0) {
      G.over = true;
      pauseGame();
    }
    a.flash++;
    a.el.classList.remove('ok');
    a.el.classList.add('bad');
    G.layers.arrows.appendChild(a.el);
    const peak = block.distance + 0.32;
    const tFwd = 0.08 + block.distance * 0.045;
    const tHold = 0.05;
    const tBack = 0.24 + block.distance * 0.03;
    let hit = false;
    const token = G.token;
    animate({
      update(t) {
        if (token !== G.token) return false;
        let s;
        if (t < tFwd) {
          const u = t / tFwd;
          s = peak * u * u;                       // accelerate into the obstacle
        } else if (t < tFwd + tHold) {
          s = peak;
          if (!hit) { hit = true; impact(); }
        } else {
          const u = Math.min(1, (t - tFwd - tHold) / tBack);
          s = peak * (1 - easeOutCubic(u));       // bounce back home
        }
        drawArrow(a, s);
        return t < tFwd + tHold + tBack;
      },
      done() {
        if (token !== G.token) return;
        drawArrow(a, 0);
        a.state = 'idle';
        flashRed(a);
        if (G.over) later(() => { if (token === G.token) showFail(); }, 420);
      },
    });

    function impact() {
      Sound.bump();
      buzz([35, 30, 55]);
      const b = G.arrows.get(block.id);
      if (b && b.el && b.el.animate) {
        const dd = DIRS[a.dir];
        const off = 'translate(' + (dd[1] * 0.14).toFixed(2) + 'px,' + (dd[0] * 0.14).toFixed(2) + 'px)';
        b.el.animate([{ transform: 'translate(0px,0px)' }, { transform: off }, { transform: 'translate(0px,0px)' }], { duration: 220, easing: 'ease-out' });
      }
      loseDropUI();
      if (G.mistakes === 1 || (G.mode === 'level' && G.level <= 3)) showBoardToast(G.drops > 0 ? 'Blocked! −1 drop' : 'Out of drops!');
    }
  }

  function flashRed(a) {
    const id = a.flash;
    [true, false, true, false].forEach((on, i) => {
      later(() => { if (a.flash === id && a.el) a.el.classList.toggle('bad', on); }, 90 + i * 120);
    });
  }

  function checkWin() {
    if (G.won || G.remaining > 0) return;
    for (const a of G.arrows.values()) if (a.state === 'leaving') return;
    win();
  }

  /* ---------------------------------------------------------------------- */
  /* HUD: drops, timer, counters, board toast                                */
  /* ---------------------------------------------------------------------- */
  function renderDrops() {
    $$('#drops .drop').forEach((d, i) => {
      d.classList.remove('lose', 'refill');
      d.classList.toggle('empty', i >= G.drops);
    });
    $('#drops').setAttribute('aria-label', 'Water drops left: ' + G.drops);
  }

  function loseDropUI() {
    const d = $$('#drops .drop')[G.drops];
    if (d) {
      d.classList.remove('lose');
      void d.getBoundingClientRect();
      d.classList.add('lose', 'empty');
    }
    $('#drops').setAttribute('aria-label', 'Water drops left: ' + G.drops);
    Sound.lose();
  }

  function updateLeft() { $('#game-left').textContent = G.remaining + ' left'; }

  function renderHintBadge() {
    const b = $('#hint-count');
    b.textContent = S.premium ? '∞' : String(S.hints);
    b.classList.toggle('zero', !S.premium && S.hints <= 0);
  }

  let boardToastTimer = 0;
  function showBoardToast(msg, good) {
    const el = $('#board-toast');
    el.textContent = msg;
    el.classList.toggle('good', !!good);
    el.classList.add('show');
    clearTimeout(boardToastTimer);
    boardToastTimer = later(() => el.classList.remove('show'), 1300);
  }

  function elapsedSec() {
    return (G.elapsed + (G.paused ? 0 : performance.now() - G.runningSince)) / 1000;
  }

  function pauseGame() {
    if (!G.active || G.paused) return;
    G.elapsed += performance.now() - G.runningSince;
    G.paused = true;
  }

  function resumeGame() {
    if (!G.active || !G.paused || G.won || G.over) return;
    if (currentScreen !== 'game' || overlayStack.length || document.hidden) return;
    G.paused = false;
    G.runningSince = performance.now();
  }

  setInterval(() => {
    if (currentScreen === 'game' && G.active) $('#game-timer').textContent = fmtTime(elapsedSec());
  }, 250);

  /* ---------------------------------------------------------------------- */
  /* Hints                                                                   */
  /* ---------------------------------------------------------------------- */
  function freeArrowId() {
    for (const id of G.puzzle.solution) {
      const a = G.arrows.get(id);
      if (a && a.state === 'idle' && !Levels.findBlocker(a, G.grid, G.size)) return id;
    }
    for (const a of G.arrows.values()) {
      if (a.state === 'idle' && !Levels.findBlocker(a, G.grid, G.size)) return a.id;
    }
    return -1;
  }

  function useHint() {
    if (!G.active || G.over || G.won || G.paused) return;
    Sound.unlock();
    const cur = G.hintId >= 0 ? G.arrows.get(G.hintId) : null;
    if (cur && cur.state === 'idle') {
      showBoardToast('Tap the glowing arrow', true);
      return;
    }
    if (!S.premium && S.hints <= 0) {
      Sound.deny();
      modal({
        title: 'Out of hints',
        text: 'You earn a free hint every ' + HINT_EVERY + ' cleared levels. ImranO Premium gives you unlimited hints.',
        art: '<svg class="dialog-art" viewBox="0 0 24 24" style="color:var(--hint)"><use href="#i-bulb" class="icon"/></svg>',
        actions: [
          { label: 'See Premium', cls: 'btn gold', onClick: () => openSub('premium') },
          { label: 'Keep playing', cls: 'btn secondary' },
        ],
      });
      return;
    }
    const id = freeArrowId();
    if (id < 0) return;
    if (!S.premium) S.hints--;
    G.hintsUsed++;
    S.stats.hints++;
    save();
    renderHintBadge();
    G.hintId = id;
    G.arrows.get(id).el.classList.add('hinted');
    drawHint(id);
    Sound.hint();
    buzz(15);
  }

  /* Glow under the hinted arrow plus a flowing dashed line along its exit ray. */
  function drawHint(id) {
    const a = G.arrows.get(id);
    if (!a || !G.layers) return;
    G.layers.hint.innerHTML = '';
    const pts = a.cells.map(center);
    G.layers.hint.appendChild(svgEl('path', {
      class: 'hint-glow',
      d: 'M' + pts.map(P).join('L'),
      'stroke-width': (G.stroke * 3.4).toFixed(3),
    }));
    const head = pts[pts.length - 1];
    const dd = DIRS[a.dir];
    const ray = Levels.exitRay(a, G.size).length;
    const from = [head[0] + dd[1] * 0.55, head[1] + dd[0] * 0.55];
    const to = [head[0] + dd[1] * (ray + 1.1), head[1] + dd[0] * (ray + 1.1)];
    G.layers.hint.appendChild(svgEl('path', {
      class: 'hint-ray',
      d: 'M' + P(from) + 'L' + P(to),
      'stroke-width': (G.stroke * 0.9).toFixed(3),
    }));
  }

  function clearHint() {
    if (G.hintId >= 0) {
      const a = G.arrows.get(G.hintId);
      if (a && a.el) a.el.classList.remove('hinted');
    }
    G.hintId = -1;
    if (G.layers) G.layers.hint.innerHTML = '';
  }

  /* ---------------------------------------------------------------------- */
  /* Tutorial (level 1): speech bubble + tapping hand on a free arrow        */
  /* ---------------------------------------------------------------------- */
  function setupTutorial() {
    const tut = $('#tutorial');
    tut.classList.remove('show');
    G.tutorial = G.mode === 'level' && G.level === 1 ? 1 : 0;
    if (!G.tutorial) return;
    $('#tut-bubble').textContent = 'Tap an arrow';
    const token = G.token;
    later(() => {
      if (token !== G.token || !G.tutorial) return;
      positionTutorial();
      tut.classList.add('show');
    }, 650);
  }

  function hideTutorial() {
    G.tutorial = 0;
    $('#tutorial').classList.remove('show');
  }

  function positionTutorial() {
    if (!G.tutorial || !G.active) return;
    const id = freeArrowId();
    if (id < 0) return;
    const a = G.arrows.get(id);
    const ctm = board.getScreenCTM();
    if (!ctm) return;
    const wrap = $('#board-wrap').getBoundingClientRect();
    const toWrap = (x, y) => {
      const p = board.createSVGPoint();
      p.x = x;
      p.y = y;
      const s = p.matrixTransform(ctm);
      return [s.x - wrap.left, s.y - wrap.top];
    };
    const mid = a.cells[Math.floor((a.cells.length - 1) / 2)];
    const m = toWrap(mid[1] + 0.5, mid[0] + 0.5);
    ['#tut-hand', '#tut-ripple'].forEach((s) => {
      $(s).style.left = m[0] + 'px';
      $(s).style.top = m[1] + 'px';
    });
    $('#tut-hand').style.margin = '-4px 0 0 -20px';
    let minRow = G.size;
    G.arrows.forEach((x) => { if (x.state === 'idle') x.cells.forEach((c) => { minRow = Math.min(minRow, c[0]); }); });
    const top = toWrap(0, minRow)[1];
    $('#tut-bubble').style.top = Math.max(4, top - 62) + 'px';
  }

  function tutorialAfterTap(ok) {
    if (!G.tutorial) return;
    if (ok) {
      if (G.remaining > 0) {
        $('#tut-bubble').textContent = 'Nice! Now this one';
        later(positionTutorial, 380);
      } else {
        hideTutorial();
        S.tutorialDone = true;
        save();
      }
    } else {
      $('#tut-bubble').textContent = 'Blocked! Free its path first';
      later(positionTutorial, 380);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Win / result                                                            */
  /* ---------------------------------------------------------------------- */
  function difficultyLabel() {
    if (G.mode === 'daily') return 'Daily';
    const n = G.level;
    return n <= 1 ? 'Easy' : n <= 12 ? 'Normal' : n <= 35 ? 'Hard' : 'Expert';
  }

  function computeResult(secs) {
    const n = G.total;
    const par = n * 4 + 10;
    const timeBonus = Math.max(0, Math.round((par - secs) * 10));
    const flawless = G.mistakes === 0 && G.hintsUsed === 0 ? 500 : 0;
    const raw = n * 100 + timeBonus + flawless - G.mistakes * 150 - G.hintsUsed * 100;
    const score = Math.max(50, Math.round(raw / 10) * 10);
    const grade = G.mistakes === 0 && G.hintsUsed === 0 ? 'A' : G.mistakes + G.hintsUsed <= 1 ? 'B' : 'C';
    const stars = clamp(3 - G.mistakes, 1, 3);
    const acc = Math.round((n / (n + G.mistakes)) * 100);
    return { secs, score, grade, stars, acc };
  }

  /* Celebration: the dots left behind ripple outward from the board centre. */
  function winWave() {
    if (!G.layers) return;
    const mid = G.size / 2;
    $$('circle.dot', G.layers.dots).forEach((d) => {
      const dist = Math.hypot(Number(d.getAttribute('cx')) - mid, Number(d.getAttribute('cy')) - mid);
      d.classList.remove('fresh');
      d.style.animationDelay = Math.round(dist * 45) + 'ms';
      d.classList.add('wave');
    });
  }

  function win() {
    G.won = true;
    pauseGame();
    clearHint();
    hideTutorial();
    winWave();
    const secs = Math.max(1, Math.round(elapsedSec()));
    const r = computeResult(secs);
    const extras = [];
    const t = todayKey();
    if (S.today.date !== t) S.today = { date: t, levels: 0 };
    S.today.levels++;
    const wk = isoWeek(t).key;
    if (S.weekly.week !== wk) S.weekly = { week: wk, score: 0 };
    S.weekly.score += r.score;
    S.totalScore += r.score;
    S.stats.taps += G.taps;
    S.stats.mistakes += G.mistakes;
    S.stats.seconds += secs;

    if (G.mode === 'level') {
      const before = S.level;
      if (G.level >= S.level) S.level = G.level + 1;
      S.cleared++;
      if (G.level === 1) S.tutorialDone = true;
      if (!S.premium && S.cleared % AD_EVERY === 0) S.adDue = true;
      if (!S.premium && S.cleared % HINT_EVERY === 0) { S.hints++; extras.push('+1 free hint'); }
      if (!S.premium && before < LEAGUE_UNLOCK && S.level >= LEAGUE_UNLOCK) extras.push('Bronze League unlocked!');
      if (!S.premium && before < DAILY_UNLOCK && S.level >= DAILY_UNLOCK) extras.push('Daily Challenge unlocked!');
    } else {
      const prev = S.daily[G.dateKey];
      if (!prev || r.score > prev.score) S.daily[G.dateKey] = { score: r.score, time: secs };
      extras.push(prev ? 'Daily Challenge replayed' : 'Daily trophy earned!');
    }
    if (leagueOpen()) extras.push('+' + fmtNum(r.score) + ' league pts');
    r.extras = extras;
    G.result = r;
    save();
    Sound.win();
    buzz([25, 40, 25, 40, 70]);
    const token = G.token;
    later(() => { if (token === G.token) showResult(r); }, 600);
  }

  function showResult(r) {
    const titles = ['', 'Cleared!', 'Great!', 'Flawless!'];
    $('#result-title').textContent = G.mode === 'daily' ? (r.stars === 3 ? 'Flawless!' : 'Daily cleared!') : titles[r.stars];
    $('#r-diff').textContent = difficultyLabel();
    $('#r-time').textContent = fmtTime(r.secs);
    const gradeEl = $('#r-grade');
    gradeEl.textContent = r.grade;
    gradeEl.className = 'grade grade-' + r.grade;
    $('#r-score').textContent = '0';
    $('#r-today').textContent = String(todayLevels());
    $('#r-acc').textContent = r.acc + '%';
    $('#r-miss').textContent = String(G.mistakes);
    $('#r-hints').textContent = String(G.hintsUsed);
    $('#result-extra').textContent = r.extras.join(' · ');
    $('#btn-next').textContent = G.mode === 'daily' ? 'Back to Home' : 'Next Level';
    const stars = $$('#screen-result .star');
    stars.forEach((s) => s.classList.remove('pop', 'dim'));
    showScreen('result');
    countUp($('#r-score'), 0, r.score, 900);
    stars.forEach((s, i) => {
      later(() => {
        if (currentScreen !== 'result') return;
        s.classList.add('pop');
        if (i >= r.stars) s.classList.add('dim');
        else { Sound.star(i); buzz(12); }
      }, 380 + i * 260);
    });
    later(() => Confetti.burst(r.stars === 3 ? 170 : 110, { y: window.innerHeight * 0.22 }), 300);
  }

  /* ---------------------------------------------------------------------- */
  /* Out of drops                                                            */
  /* ---------------------------------------------------------------------- */
  function renderFail() {
    $('#btn-refill').hidden = !S.premium;
    $('#btn-fail-premium').hidden = S.premium;
    $('#fail-text').textContent = S.premium
      ? 'You used all three water drops. Refill instantly and keep your progress, or start the board again.'
      : 'You used all three water drops. Take a breath and try this board again.';
  }

  function showFail() {
    if (!G.active || G.won || !G.over || currentScreen !== 'game') return;
    Sound.fail();
    buzz([60, 50, 90]);
    renderFail();
    openOverlay('fail-overlay');
  }

  function refillDrops() {
    if (!S.premium) return;
    G.drops = MAX_DROPS;
    G.over = false;
    renderDrops();
    $$('#drops .drop').forEach((d, i) => later(() => d.classList.add('refill'), i * 90));
    closeOverlay('fail-overlay');
    resumeGame();
    Sound.chime();
    showBoardToast('Drops refilled', true);
  }

  function retry() {
    Sound.click();
    if (G.mode === 'daily') startPuzzle('daily', G.dateKey);
    else startPuzzle('level', G.level);
  }

  /* ---------------------------------------------------------------------- */
  /* Ad break (demo interstitial)                                            */
  /* ---------------------------------------------------------------------- */
  const ADS = [
    {
      title: 'Play calmer with Premium',
      text: 'No ad breaks, unlimited hints and every theme. Demo only.',
      art: '<svg class="ad-art" viewBox="0 0 300 150"><defs><linearGradient id="ad-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2672"/><stop offset=".6" stop-color="#5B3A9E"/><stop offset="1" stop-color="#0F9C98"/></linearGradient></defs><rect width="300" height="150" rx="18" fill="url(#ad-g1)"/><use href="#i-crown-art" x="95" y="22" width="110" height="92"/><text x="150" y="136" text-anchor="middle" fill="#FFE59A" font-family="Nunito, sans-serif" font-weight="900" font-size="17">ImranO Premium</text></svg>',
    },
    {
      title: 'A new board every day',
      text: 'The Daily Challenge is a bigger 10×10 puzzle. Collect a trophy for every day you clear it.',
      art: '<svg class="ad-art" viewBox="0 0 300 150"><defs><linearGradient id="ad-g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9653F"/><stop offset="1" stop-color="#E0A06A"/></linearGradient></defs><rect width="300" height="150" rx="18" fill="url(#ad-g2)"/><use href="#i-trophy-art" x="100" y="12" width="100" height="100"/><text x="150" y="136" text-anchor="middle" fill="#FFF4E6" font-family="Nunito, sans-serif" font-weight="900" font-size="17">Daily Challenge</text></svg>',
    },
    {
      title: 'More from ImranO Games',
      text: 'Calm, clever puzzles for curious minds. Thanks for playing ArrowGO!',
      art: '<svg class="ad-art" viewBox="0 0 300 150"><defs><linearGradient id="ad-g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2672"/><stop offset="1" stop-color="#0F9C98"/></linearGradient></defs><rect width="300" height="150" rx="18" fill="url(#ad-g3)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9"><path d="M110 40h80v70" stroke="#FF7A5C"/><path d="M130 60h40v50" stroke="#FFB93B"/><path d="M150 80v30" stroke="#F5EBD8"/></g><text x="150" y="138" text-anchor="middle" fill="#F5EBD8" font-family="Nunito, sans-serif" font-weight="900" font-size="17">ImranO Games</text></svg>',
    },
  ];

  const adState = { timers: [], after: null, open: false };

  function showAd(after) {
    const ad = ADS[Math.floor(S.cleared / AD_EVERY) % ADS.length];
    $('#ad-body').innerHTML = ad.art + '<h3>' + ad.title + '</h3><p>' + ad.text + '</p>';
    const prog = $('#ad-prog');
    prog.style.transition = 'none';
    prog.style.strokeDashoffset = '0';
    $('#ad-count').textContent = '3';
    adState.after = after;
    adState.open = true;
    openOverlay('ad-break');
    syncBars('#1F1A2B');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      prog.style.transition = 'stroke-dashoffset 3s linear';
      prog.style.strokeDashoffset = '100';
    }));
    Sound.tick();
    [1, 2].forEach((i) => adState.timers.push(later(() => { $('#ad-count').textContent = String(3 - i); Sound.tick(); }, i * 1000)));
    adState.timers.push(later(() => finishAd(true), 3000));
  }

  function stopAd() {
    adState.timers.forEach(clearTimeout);
    adState.timers = [];
    adState.open = false;
  }

  function finishAd(run) {
    const fn = adState.after;
    stopAd();
    adState.after = null;
    closeOverlay('ad-break');
    syncScreenBars();
    if (run && fn) fn();
    return fn;
  }

  /* ---------------------------------------------------------------------- */
  /* Premium (demo: no payment is processed)                                 */
  /* ---------------------------------------------------------------------- */
  function renderPremium() {
    $('#premium-body').classList.toggle('is-premium', S.premium);
    $('#sw-premium').checked = S.premium;
    $('#premium-switch-label').firstChild.nodeValue = S.premium ? 'Cancel Premium (demo)' : 'Premium (demo switch)';
    $('#premium-switch-sub').textContent = S.premium
      ? 'On · switch off to cancel Premium and test the free version'
      : 'Off · switch on to unlock Premium instantly';
  }

  function setPremium(on) {
    if (S.premium === on) { renderPremium(); return; }
    S.premium = on;
    if (on) {
      S.adDue = false;
    } else if (themeById(S.theme).premium) {
      S.theme = 'cream';
      applyTheme('cream');
    }
    save();
    renderPremium();
    renderHome();
    renderHintBadge();
    renderSettings();
    renderThemes();
    if (on) {
      toast('Author build: Premium unlocked', { gold: true, ms: 2800 });
      Sound.fanfare();
      Confetti.burst(150, { y: window.innerHeight * 0.25 });
      buzz([20, 40, 20, 40, 60]);
    } else {
      toast('Premium cancelled (demo). Free version restored.');
      Sound.click();
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Bronze League: deterministic weekly rivals                              */
  /* ---------------------------------------------------------------------- */
  function leagueTable() {
    const t = todayKey();
    const wk = isoWeek(t);
    const rng = Levels.mulberry32(Levels.hashString('arrowgo:league:' + wk.key));
    const pool = RIVALS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const dow = (weekdayOf(t) + 6) % 7;                       // Monday = 0
    const now = new Date();
    const hourFrac = params.get('today') ? 0.5 : (now.getHours() + now.getMinutes() / 60) / 24;
    const progress = clamp((dow + hourFrac) / 7, 0.03, 1);
    const rows = pool.slice(0, 19).map((name, i) => {
      const potential = 2500 + Math.pow(rng(), 1.5) * 42000;
      const pace = 0.7 + rng() * 0.9;
      return {
        name,
        score: Math.round((potential * Math.pow(progress, pace)) / 10) * 10,
        color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        me: false,
      };
    });
    const mine = S.weekly.week === wk.key ? S.weekly.score : 0;
    rows.push({ name: 'You', score: mine, color: 'var(--primary)', me: true });
    rows.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
    const hoursLeft = Math.max(1, Math.round((7 - dow - hourFrac) * 24));
    return { rows, wk, mine, rank: rows.findIndex((r) => r.me) + 1, hoursLeft };
  }

  function renderLeague() {
    const L = leagueTable();
    $('#league-rank').textContent = '#' + L.rank;
    $('#league-score').textContent = fmtNum(L.mine);
    $('#league-week').textContent = 'Week ' + L.wk.week + ' · 20 players';
    $('#league-ends').textContent = 'Ends in ' + Math.floor(L.hoursLeft / 24) + 'd ' + (L.hoursLeft % 24) + 'h';
    const list = $('#league-list');
    list.innerHTML = '';
    L.rows.forEach((r, i) => {
      if (i === 5) {
        const z = document.createElement('div');
        z.className = 'lb-zone';
        z.textContent = '▲ Promotion zone above';
        list.appendChild(z);
      }
      const row = document.createElement('div');
      row.className = 'lb-row' + (r.me ? ' me' : '') + (i < 5 ? ' promo' : '') + (i === 0 ? ' top1' : '');
      row.innerHTML = '<span class="rank">' + (i + 1) + '</span><span class="av" style="background:' + r.color + '">' +
        (r.me ? 'You'.charAt(0) : r.name.charAt(0)) + '</span><span class="nm">' + r.name + '</span><span class="sc">' + fmtNum(r.score) + '</span>';
      list.appendChild(row);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Daily Challenge                                                         */
  /* ---------------------------------------------------------------------- */
  function renderDaily() {
    const t = todayKey();
    const wd = weekdayOf(t);
    $('#daily-title').textContent = WD_LONG[wd] + ', ' + shortDate(t);
    const week = $('#daily-week');
    week.innerHTML = '';
    const monday = addDays(t, -((wd + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i);
      const won = !!S.daily[k];
      const d = document.createElement('div');
      if (k === t) d.className = 'today';
      d.innerHTML = '<i class="' + (won ? 'won' : '') + '">' + (won ? '<svg viewBox="0 0 24 24" style="color:#7A4A12"><use href="#i-trophy" class="icon"/></svg>' : '') + '</i>' + WD[weekdayOf(k)];
      week.appendChild(d);
    }
    const res = S.daily[t];
    $('#daily-info').textContent = res
      ? 'Trophy earned! Cleared in ' + fmtTime(res.time) + ' with ' + fmtNum(res.score) + ' points. A new board arrives tomorrow.'
      : 'Clear today\'s big board to earn a trophy. Same puzzle for everyone, all day.';
    $('#btn-daily-start').textContent = res ? 'Play again' : 'Start Challenge';
  }

  /* ---------------------------------------------------------------------- */
  /* Themes                                                                  */
  /* ---------------------------------------------------------------------- */
  function miniArrow(points, color, w) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = Math.sign(last[0] - prev[0]);
    const dy = Math.sign(last[1] - prev[1]);
    const hl = 9;
    const hw = 6;
    const base = [last[0] - dx * 3, last[1] - dy * 3];
    const tip = [last[0] + dx * (hl - 3), last[1] + dy * (hl - 3)];
    const line = points.slice(0, -1).concat([base]).map((p) => p[0] + ' ' + p[1]).join('L');
    return '<path d="M' + line + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M' + tip[0] + ' ' + tip[1] + 'L' + (base[0] - dy * hw) + ' ' + (base[1] + dx * hw) + 'L' + (base[0] + dy * hw) + ' ' + (base[1] - dx * hw) + 'Z" fill="' + color + '" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>';
  }

  function themePreview(t) {
    const c = t.c;
    const drop = (x) => '<path transform="translate(' + x + ' 9) scale(.42)" d="M13 1.8C13 1.8 2.2 15.2 2.2 22.2a10.8 10.8 0 0 0 21.6 0C23.8 15.2 13 1.8 13 1.8z" fill="' + c.drop + '"/>';
    return '<svg viewBox="0 0 120 86" aria-hidden="true"><rect width="120" height="86" rx="12" fill="' + c.bg + '"/>' +
      drop(10) + drop(22) + drop(34) +
      miniArrow([[44, 34], [44, 70], [70, 70]], c.arrow, 4.5) +
      miniArrow([[58, 56], [58, 40], [86, 40]], c.arrow, 4.5) +
      miniArrow([[96, 72], [96, 30]], c.arrow, 4.5) +
      '<rect x="40" y="6" width="40" height="8" rx="4" fill="' + c.primary + '" opacity=".85"/></svg>';
  }

  function renderThemes() {
    const html = THEMES.map((t) => {
      const locked = t.premium && !S.premium;
      const sel = S.theme === t.id;
      const tag = sel ? '<svg class="icon"><use href="#i-check"/></svg>Selected'
        : locked ? '<svg class="icon"><use href="#i-lock"/></svg>Premium' : t.premium ? 'Premium' : 'Free';
      return '<button class="theme-card' + (sel ? ' selected' : '') + (locked ? ' locked' : '') + '" data-theme="' + t.id + '" aria-pressed="' + sel + '">' +
        themePreview(t) + '<h4>' + t.name + '</h4><span class="tag">' + tag + '</span></button>';
    }).join('');
    $('#theme-grid').innerHTML = html;
    $('#theme-grid-sheet').innerHTML = html;
  }

  function chooseTheme(id) {
    const t = themeById(id);
    if (t.premium && !S.premium) {
      Sound.deny();
      modal({
        title: t.name + ' is a Premium theme',
        text: 'Unlock Ocean, Forest and every future theme with ImranO Premium (demo, no payment).',
        art: '<svg class="dialog-art" viewBox="0 0 120 100"><use href="#i-crown-art"/></svg>',
        actions: [
          { label: 'See Premium', cls: 'btn gold', onClick: () => openSub('premium') },
          { label: 'Not now', cls: 'btn secondary' },
        ],
      });
      return;
    }
    S.theme = id;
    save();
    applyTheme(id);
    renderThemes();
    renderSettings();
    renderHome();
    Sound.pop();
    buzz(10);
  }

  /* ---------------------------------------------------------------------- */
  /* Settings, about, reset                                                  */
  /* ---------------------------------------------------------------------- */
  let installPrompt = null;

  function renderSettings() {
    $('#sw-sound').checked = S.sound;
    $('#sw-vibration').checked = S.vibration;
    $('#row-theme-sub').textContent = themeById(S.theme).name;
    $('#row-premium-sub').textContent = S.premium ? 'Active (demo)' : 'Not active';
    $('#row-install').hidden = !installPrompt;
    $('#settings-version').textContent = 'ArrowGO! v' + VERSION + ' · ImranO Games';
  }

  function openSettings() {
    Sound.click();
    renderSettings();
    openOverlay('settings-sheet');
  }

  function showAbout() {
    modal({
      title: 'About ImranO',
      text: 'ArrowGO! v' + VERSION + ' is a calm arrow-untangle puzzle made by ImranO Games. ' +
        'Tap an arrow to slide it off the board, but mind the arrows in its way. ' +
        'Made with care for curious minds. © 2026 ImranO. All rights reserved.',
      art: '<div class="dialog-art logo-slot about-logo"></div>',
      actions: [{ label: 'Close', cls: 'btn secondary' }],
    });
    const slot = $('#modal-art .logo-slot');
    if (slot) fillLogoSlot(slot, 'about');
  }

  function confirmReset() {
    modal({
      title: 'Reset progress?',
      text: 'This clears your level, streak, scores, hints, trophies, theme and Premium (demo) on this device. It cannot be undone.',
      row: true,
      actions: [
        { label: 'Cancel', cls: 'btn secondary' },
        { label: 'Reset', cls: 'btn danger', onClick: resetProgress },
      ],
    });
  }

  function resetProgress() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    cancelAnims();
    S = defaults();
    G.active = false;
    G.token++;
    updateStreak();
    applyTheme(S.theme);
    renderThemes();
    goHome();
    toast('Progress reset. Welcome back to Level 1!');
  }

  /* ---------------------------------------------------------------------- */
  /* Wire up UI events                                                       */
  /* ---------------------------------------------------------------------- */
  function on(sel, ev, fn) {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (el) el.addEventListener(ev, fn);
  }

  function bindUI() {
    on('#btn-streak-continue', 'click', continueFromStreak);

    on('#btn-play', 'click', playFromHome);
    on('#btn-home-settings', 'click', openSettings);
    on('#chip-streak', 'click', () => { Sound.click(); toast(Math.max(1, S.streak.count) + '-day streak. Come back tomorrow to keep it going!'); });
    on('#chip-premium', 'click', () => { Sound.click(); openSub('premium'); });
    on('#card-league', 'click', (e) => {
      if (!leagueOpen()) return lockedTap(e.currentTarget, 'Reach Level ' + LEAGUE_UNLOCK + ' to join the Bronze League, or unlock it with Premium.');
      Sound.click();
      openSub('league');
    });
    on('#card-daily', 'click', (e) => {
      if (!dailyOpen()) return lockedTap(e.currentTarget, 'Reach Level ' + DAILY_UNLOCK + ' to unlock the Daily Challenge, or unlock it with Premium.');
      Sound.click();
      openSub('daily');
    });
    on('#card-themes', 'click', () => { Sound.click(); openSub('themes'); });
    on('#card-premium', 'click', () => { Sound.click(); openSub('premium'); });

    on('#btn-game-back', 'click', () => { Sound.click(); goHome(); });
    on('#btn-game-home', 'click', () => { Sound.click(); goHome(); });
    on('#btn-game-theme', 'click', () => { Sound.click(); renderThemes(); openOverlay('theme-sheet'); });
    on('#btn-game-settings', 'click', openSettings);
    on('#btn-hint', 'click', useHint);
    on('#btn-restart', 'click', () => {
      if (!G.active) return;
      if (G.remaining === G.total && G.mistakes === 0) { Sound.click(); return; }
      modal({
        title: 'Restart level?',
        text: 'The board resets and your drops refill. Hints already used are not refunded.',
        row: true,
        actions: [
          { label: 'Cancel', cls: 'btn secondary' },
          { label: 'Restart', cls: 'btn', onClick: retry },
        ],
      });
    });

    on('#btn-next', 'click', () => {
      Sound.unlock();
      Sound.click();
      if (G.mode === 'daily') goHome();
      else playNext();
    });
    on('#btn-result-home', 'click', () => { Sound.click(); goHome(); });

    on('#btn-retry', 'click', retry);
    on('#btn-refill', 'click', refillDrops);
    on('#btn-fail-premium', 'click', () => { Sound.click(); openSub('premium'); });
    on('#btn-fail-home', 'click', () => { Sound.click(); goHome(); });

    on('#btn-ad-premium', 'click', () => {
      Sound.click();
      const fn = finishAd(false);
      afterPremium = fn;
      openSub('premium');
    });

    $$('[data-back]').forEach((b) => b.addEventListener('click', () => { Sound.click(); closeSub(); }));

    $$('.plan').forEach((p) => p.addEventListener('click', () => {
      Sound.click();
      $$('.plan').forEach((x) => x.classList.toggle('selected', x === p));
    }));
    on('#btn-subscribe', 'click', () => { Sound.unlock(); setPremium(true); });
    on('#sw-premium', 'change', (e) => setPremium(e.target.checked));

    on('#btn-daily-start', 'click', () => { Sound.click(); startPuzzle('daily', todayKey()); });

    const themeClick = (e) => {
      const card = e.target.closest('.theme-card');
      if (card) chooseTheme(card.dataset.theme);
    };
    on('#theme-grid', 'click', themeClick);
    on('#theme-grid-sheet', 'click', themeClick);

    on('#sw-sound', 'change', (e) => {
      S.sound = e.target.checked;
      save();
      if (S.sound) Sound.click(); else Sound.suspend();
    });
    on('#sw-vibration', 'change', (e) => {
      S.vibration = e.target.checked;
      save();
      if (S.vibration) buzz(30);
    });
    on('#row-themes', 'click', () => {
      Sound.click();
      closeOverlay('settings-sheet');
      if (currentScreen === 'game') { renderThemes(); openOverlay('theme-sheet'); }
      else openSub('themes');
    });
    on('#row-premium', 'click', () => { Sound.click(); openSub('premium'); });
    on('#row-about', 'click', () => { Sound.click(); closeOverlay('settings-sheet'); showAbout(); });
    on('#row-reset', 'click', () => { Sound.click(); closeOverlay('settings-sheet'); confirmReset(); });
    on('#row-install', 'click', () => {
      if (!installPrompt) return;
      const p = installPrompt;
      installPrompt = null;
      p.prompt();
      if (p.userChoice) p.userChoice.finally(renderSettings);
      renderSettings();
    });

    /* Tapping the dim area closes sheets and simple dialogs. */
    ['settings-sheet', 'theme-sheet', 'modal'].forEach((id) => {
      on('#' + id, 'click', (e) => { if (e.target.id === id) closeOverlay(id); });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        e.preventDefault();
        handleBack();
      } else if ((e.key === 'h' || e.key === 'H') && currentScreen === 'game') {
        useHint();
      }
    });

    window.addEventListener('resize', () => requestAnimationFrame(layoutBoard));
    if (window.ResizeObserver) new ResizeObserver(() => { if (currentScreen === 'game') layoutBoard(); }).observe($('#board-wrap'));

    document.addEventListener('visibilitychange', () => { if (document.hidden) onPause(); else onResume(); });
  }

  /* ---------------------------------------------------------------------- */
  /* Lifecycle (also called by the Android shell)                            */
  /* ---------------------------------------------------------------------- */
  function onPause() {
    pauseGame();
    Sound.suspend();
  }

  function onResume() {
    Sound.resume();
    resumeGame();
    if (S.streak.last !== todayKey()) {
      const show = updateStreak();
      if (show && currentScreen === 'home') showStreak();
      else if (currentScreen === 'home') renderHome();
    }
  }

  /* ---------------------------------------------------------------------- */
  /* PWA: service worker, install prompt, browser back button                */
  /* ---------------------------------------------------------------------- */
  function setupPWA() {
    if ('serviceWorker' in navigator && !isAndroid && window.isSecureContext && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed', err));
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      renderSettings();
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      renderSettings();
      toast('ArrowGO! installed. Enjoy offline play!');
    });

    /* Browser / installed PWA back button: keep a guard history entry so "back"
       navigates inside the game instead of leaving it. (The APK uses handleBack directly.) */
    if (!isAndroid && window.history && history.pushState) {
      let guard = false;
      const arm = () => {
        if (guard) return;
        try { history.pushState({ arrowgo: 'guard' }, ''); guard = true; } catch (e) { /* ignore */ }
      };
      document.addEventListener('pointerdown', arm, true);
      window.addEventListener('popstate', () => {
        guard = false;
        if (handleBack()) arm();
        else history.back();
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */
  function boot() {
    applyTheme(S.theme);
    bindUI();
    renderThemes();
    renderSettings();
    renderHintBadge();
    streakPending = updateStreak();
    setupPWA();
    injectLogos();
    runSplash();
  }

  /* Public hooks for the Android shell and for automated tests. */
  window.ArrowGO = {
    version: VERSION,
    handleBack,
    onPause,
    onResume,
    debug: {
      state: () => JSON.parse(JSON.stringify(S)),
      screen: () => currentScreen,
      overlays: () => overlayStack.slice(),
      game: () => ({
        mode: G.mode,
        level: G.level,
        size: G.size,
        remaining: G.remaining,
        total: G.total,
        drops: G.drops,
        mistakes: G.mistakes,
        hintsUsed: G.hintsUsed,
        over: G.over,
        won: G.won,
        hintId: G.hintId,
        elapsed: elapsedSec(),
        solution: G.puzzle ? G.puzzle.solution.slice() : [],
        idle: Array.from(G.arrows.values()).filter((a) => a.state === 'idle').map((a) => a.id),
        result: G.result,
      }),
      tap: (id) => tapArrow(id),
      free: () => freeArrowId(),
    },
  };

  boot();
})();

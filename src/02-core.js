/* =========================================================================
   PHANTASY CODEX ADVENTURE
   A compact top-down action RPG. Single file, no external assets:
   every sprite, tile and icon is generated procedurally at boot.
   ========================================================================= */
(function () {

/* ------------------------------ tiny helpers --------------------------- */
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt || false);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const nowMs = () => performance.now();
function fmtTime(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); }
function fmtNum(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k" : String(n); }

/* ------------------------------ seeded RNG ----------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed) {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* A general-purpose RNG object used by both worldgen and art generation. */
function makeRng(seed) {
  const r = mulberry32(seed >>> 0);
  return {
    f: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length) % arr.length],
    /* weighted pick over [{w:number,...}] */
    weighted(arr, wKey) {
      let total = 0;
      for (const it of arr) total += (wKey ? it[wKey] : it.w) || 0;
      let t = r() * total;
      for (const it of arr) { t -= (wKey ? it[wKey] : it.w) || 0; if (t <= 0) return it; }
      return arr[arr.length - 1];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    }
  };
}

/* ------------------------------ value noise ---------------------------- */
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, seed, octaves, lac, gain) {
  octaves = octaves || 4; lac = lac || 2.0; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 7919) * amp;
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
}

/* ------------------------------ storage -------------------------------- */
const Store = {
  read(key, fallback) {
    try { const v = localStorage.getItem("pca." + key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  write(key, val) {
    try { localStorage.setItem("pca." + key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
};

/* ------------------------------ audio ---------------------------------- */
/* Small procedural synth: no audio files, everything is oscillators+noise. */
const Sound = {
  ctx: null, master: null, enabled: Store.read("sound", true), ready: false, noiseBuf: null,
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.32 : 0;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
    } catch (e) { this.ready = false; }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); },
  setEnabled(v) {
    this.enabled = v; Store.write("sound", v);
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.02);
  },
  /* one blip */
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol == null ? 0.25 : vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  /* filtered noise burst — impacts, dashes, deaths */
  noise(dur, vol, freq, q, delay) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq || 900; f.Q.value = q || 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol == null ? 0.25 : vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0); s.stop(t0 + dur + 0.02);
  },
  play(name, param) {
    if (!this.ready || !this.enabled) return;
    switch (name) {
      case "swing":  this.noise(0.10, 0.16, 1500, 0.9); this.tone(340, 0.07, "sawtooth", 0.06, 180); break;
      case "thrust": this.noise(0.13, 0.14, 700, 1.6); this.tone(190, 0.10, "square", 0.07, 120); break;
      case "cast":   this.tone(520, 0.16, "triangle", 0.16, 880); this.tone(780, 0.12, "sine", 0.09, 1250, 0.02); break;
      case "hit":    this.noise(0.08, 0.30, 420 + (param || 0) * 60, 1.0); this.tone(150, 0.07, "square", 0.13, 70); break;
      case "crit":   this.noise(0.13, 0.36, 1100, 0.7); this.tone(880, 0.13, "square", 0.20, 300); this.tone(1320, 0.10, "square", 0.11, 500, 0.03); break;
      case "kill":   this.noise(0.20, 0.26, 300, 0.8); this.tone(240, 0.20, "sawtooth", 0.13, 60); break;
      case "hurt":   this.tone(240, 0.22, "sawtooth", 0.26, 90); this.noise(0.14, 0.22, 260, 0.8); break;
      case "dash":   this.noise(0.16, 0.16, 2200, 0.5); break;
      case "pickup": this.tone(880, 0.07, "square", 0.13); this.tone(1320, 0.08, "square", 0.11, null, 0.05); break;
      case "coin":   this.tone(1050, 0.06, "square", 0.11); this.tone(1560, 0.09, "square", 0.10, null, 0.04); break;
      case "heal":   this.tone(520, 0.13, "sine", 0.18); this.tone(780, 0.15, "sine", 0.15, null, 0.07); this.tone(1040, 0.20, "sine", 0.12, null, 0.14); break;
      case "levelup":
        [523, 659, 784, 1046, 1319].forEach((f, i) => this.tone(f, 0.20, "square", 0.16, null, i * 0.075));
        this.tone(1568, 0.42, "triangle", 0.13, null, 0.38); break;
      case "upgrade":
        [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.16, null, i * 0.06)); break;
      case "combo":  this.tone(600 + Math.min(14, param || 0) * 45, 0.06, "square", 0.10); break;
      case "select": this.tone(660, 0.05, "square", 0.10); break;
      case "open":   this.tone(440, 0.07, "triangle", 0.10, 660); break;
      case "die":
        [440, 349, 262, 196].forEach((f, i) => this.tone(f, 0.34, "sawtooth", 0.18, null, i * 0.15));
        this.noise(0.7, 0.16, 200, 0.6, 0.1); break;
      case "spawn":  this.tone(120, 0.16, "sawtooth", 0.08, 300); break;
      case "block":  this.noise(0.10, 0.22, 2600, 1.4); this.tone(1200, 0.08, "square", 0.10, 700); break;
    }
  }
};

/* ------------------------------ input ---------------------------------- */
const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),   /* edge-triggered, cleared each frame */
  ax: 0, ay: 0,                   /* analog move vector, magnitude <= 1 */
  touch: false,
  bAttack: false, bDash: false,
  init() {
    on(window, "keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].indexOf(e.key) >= 0) e.preventDefault();
      Sound.init(); Sound.resume();
    });
    on(window, "keyup", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = false;
    });
    on(window, "blur", () => { this.keys = Object.create(null); this.ax = this.ay = 0; this.bAttack = this.bDash = false; });
    this.initTouch();
  },
  down(...ks) { for (const k of ks) if (this.keys[k]) return true; return false; },
  hit(...ks) { for (const k of ks) if (this.pressed[k]) return true; return false; },
  endFrame() { this.pressed = Object.create(null); },

  /* analog stick + action buttons */
  initTouch() {
    const stick = $("stick"), knob = $("knob");
    let sid = null, cx = 0, cy = 0, R = 46;
    const setKnob = (dx, dy) => { knob.style.transform = "translate(" + dx + "px," + dy + "px)"; };
    const startStick = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const r = stick.getBoundingClientRect();
      sid = t.identifier == null ? "m" : t.identifier;
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.36;
      moveStick(e); e.preventDefault();
    };
    const moveStick = (e) => {
      if (sid === null) return;
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier == null ? "m" : t.identifier;
        if (id !== sid) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const d = Math.hypot(dx, dy);
        const dead = R * 0.16;
        if (d < dead) { this.ax = this.ay = 0; setKnob(dx * .4, dy * .4); return; }
        const mag = Math.min(1, (d - dead) / (R - dead));
        this.ax = (dx / d) * mag; this.ay = (dy / d) * mag;
        const kd = Math.min(d, R);
        setKnob((dx / d) * kd, (dy / d) * kd);
      }
      e.preventDefault();
    };
    const endStick = (e) => {
      const list = e.changedTouches || [e];
      for (const t of list) {
        const id = t.identifier == null ? "m" : t.identifier;
        if (id === sid) { sid = null; this.ax = this.ay = 0; setKnob(0, 0); }
      }
    };
    on(stick, "touchstart", startStick, { passive: false });
    on(stick, "touchmove", moveStick, { passive: false });
    on(stick, "touchend", endStick); on(stick, "touchcancel", endStick);
    on(stick, "pointerdown", (e) => { if (e.pointerType !== "touch") startStick(e); });
    on(window, "pointermove", (e) => { if (e.pointerType !== "touch" && sid !== null) moveStick(e); });
    on(window, "pointerup", (e) => { if (e.pointerType !== "touch") endStick(e); });

    const bindBtn = (el, downFn, upFn) => {
      const d = (e) => { el.classList.add("held"); downFn(); e.preventDefault(); Sound.init(); Sound.resume(); };
      const u = (e) => { el.classList.remove("held"); if (upFn) upFn(); };
      on(el, "touchstart", d, { passive: false });
      on(el, "touchend", u); on(el, "touchcancel", u);
      on(el, "pointerdown", (e) => { if (e.pointerType !== "touch") d(e); });
      on(el, "pointerup", (e) => { if (e.pointerType !== "touch") u(e); });
      on(el, "pointerleave", (e) => { if (e.pointerType !== "touch") u(e); });
      on(el, "contextmenu", (e) => e.preventDefault());
    };
    bindBtn($("bAtk"), () => { this.bAttack = true; }, () => { this.bAttack = false; });
    bindBtn($("bDash"), () => { this.bDash = true; this.pressed["_dash"] = true; }, () => { this.bDash = false; });
    bindBtn($("bSwap"), () => { this.pressed["_swap"] = true; });

    /* show touch UI as soon as a real touch happens */
    const enableTouch = () => {
      if (this.touch) return;
      this.touch = true;
      $("touch").classList.add("on");
      $("kcaps").style.display = "none";
    };
    on(window, "touchstart", enableTouch, { passive: true });
    if (matchMedia("(hover:none) and (pointer:coarse)").matches) {
      this.touch = true; $("touch").classList.add("on"); $("kcaps").style.display = "none";
    }
  },
  /* unified movement vector: keyboard OR stick */
  moveVec() {
    let x = this.ax, y = this.ay;
    if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) {
      x = (this.down("a", "ArrowLeft") ? -1 : 0) + (this.down("d", "ArrowRight") ? 1 : 0);
      y = (this.down("w", "ArrowUp") ? -1 : 0) + (this.down("s", "ArrowDown") ? 1 : 0);
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
    }
    return { x, y, m: Math.hypot(x, y) };
  },
  attackHeld() { return this.bAttack || this.down(" ", "j", "z"); },
  dashHit() { return this.hit("_dash", "k", "Shift", "x"); },
  swapHit() { return this.hit("_swap", "e", "q"); }
};

/* ------------------------------ display -------------------------------- */
const view = $("view");
const ctx = view.getContext("2d", { alpha: false });
const Display = {
  W: 320, H: 240, scale: 3, dpr: 1,
  resize() {
    const cw = Math.max(240, window.innerWidth), ch = Math.max(200, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pw = cw * dpr, ph = ch * dpr;
    /* Chunky pixels on every device: aim for ~250 virtual px on the short side,
       then back off if the long side would show an unreasonable amount of world. */
    let s = Math.max(1, Math.floor(Math.min(pw, ph) / 250));
    while (s < 14 && Math.max(pw, ph) / s > 640) s++;
    while (s > 1 && Math.min(pw, ph) / s < 150) s--;
    this.scale = s; this.dpr = dpr;
    this.W = Math.ceil(pw / s); this.H = Math.ceil(ph / s);
    view.width = this.W; view.height = this.H;
    view.style.width = cw + "px"; view.style.height = ch + "px";
    ctx.imageSmoothingEnabled = false;
    $("rot").style.display = (cw < 240 || ch < 200) ? "grid" : "none";
  }
};

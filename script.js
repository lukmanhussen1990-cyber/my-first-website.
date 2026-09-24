"use strict";

// ====== Edit these to personalise the page ======
const ENTER_TEXT = "click to enter...";
const BIO_LINES = [
  "forever young.",
  "earned my wings ✦",
  "living fast, dreaming louder.",
  "welcome to my corner of the internet",
];
const TITLE = "@imran";
const START_VOLUME = 0.5;
// ================================================

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const music = $("music");
const video = $("bgVideo");
const player = $("player");
const card = $("card");
const avatar = $("avatar");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Very weak devices start in lite mode straight away
if ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2 ||
    (navigator.connection && navigator.connection.saveData)) {
  root.classList.add("lite");
}
if (isIOS) root.classList.add("no-volume");

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------- Typewriter ---------- */
async function typeText(el, text, speed) {
  const chars = Array.from(text);
  for (let i = 1; i <= chars.length; i++) {
    el.textContent = chars.slice(0, i).join("");
    await sleep(speed);
  }
}

async function typeLoop(el, lines) {
  for (let n = 0; ; n = (n + 1) % lines.length) {
    const chars = Array.from(lines[n]);
    for (let i = 1; i <= chars.length; i++) {
      el.textContent = chars.slice(0, i).join("");
      await sleep(55 + Math.random() * 45);
    }
    await sleep(2200);
    for (let i = chars.length - 1; i >= 0; i--) {
      el.textContent = chars.slice(0, i).join("");
      await sleep(28);
    }
    await sleep(350);
  }
}

/* ---------- Animated tab title ---------- */
(() => {
  const frames = [];
  for (let i = TITLE.length; i > 0; i--) frames.push(TITLE.slice(0, i));
  for (let i = 2; i < TITLE.length; i++) frames.push(TITLE.slice(0, i));
  let i = 0;
  setInterval(() => { document.title = frames[i = (i + 1) % frames.length]; }, 400);
})();

/* ---------- Media embedded in the single-file version ----------
   The one-file build stores the video and song as base64 text. They are
   turned into blob URLs after the enter screen has painted. */
function decodeBase64(b64) {
  if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(b64);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function takeEmbedded(id, type) {
  const el = document.getElementById(id);
  if (!el) return null;
  const url = URL.createObjectURL(new Blob([decodeBase64(el.textContent)], { type }));
  el.remove();
  return url;
}

const afterPaint = () => new Promise((r) => {
  const t = setTimeout(r, 120); // rAF doesn't run in background tabs
  requestAnimationFrame(() => setTimeout(() => { clearTimeout(t); r(); }, 0));
});

async function loadEmbeddedMedia() {
  if (document.readyState === "loading") {
    await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
  }
  if (!document.getElementById("m-audio")) return; // normal multi-file site
  await afterPaint();
  const v = takeEmbedded("m-video", "video/mp4");
  if (v) video.src = v;
  await afterPaint();
  const a = takeEmbedded("m-audio", "audio/mpeg");
  if (a) music.src = a;
}

/* ---------- Enter screen ---------- */
const enter = $("enter");
let ready = false;
let entered = false;

loadEmbeddedMedia()
  .catch(() => {})
  .then(() => {
    ready = true;
    enter.classList.add("is-ready");
    typeText($("enterText"), hasMouse ? ENTER_TEXT : ENTER_TEXT.replace(/^click/i, "tap"), 70);
  });

function doEnter() {
  if (!ready || entered) return;
  entered = true;
  setupAudio(); // has to happen inside the click, or browsers keep audio locked
  startMusic();
  video.play().catch(() => {});
  enter.classList.add("is-gone");
  setTimeout(() => { enter.hidden = true; }, 900);
  document.body.classList.add("entered");
  typeLoop($("bio"), BIO_LINES);
  startEffects();
}
enter.addEventListener("click", doEnter);
enter.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation(); // don't let the same Space press also hit play/pause
    doEnter();
  }
});
enter.focus({ preventScroll: true });

/* ---------- Music ---------- */
const savedVolume = parseFloat(store.get("imran:volume"));
let volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : START_VOLUME;
let muted = false;
let audioCtx = null;
let analyser = null;
let gainNode = null;
let freq = null;

// The visualiser needs to read the song's audio. It is skipped where that
// could silence the music: on iPhone (Web Audio obeys the silent switch)
// and for local files the browser won't let the page read.
function canAnalyse() {
  if (isIOS) return false;
  const src = music.currentSrc || music.src || "";
  return !(location.protocol === "file:" && !src.startsWith("blob:"));
}

function setupAudio() {
  if (audioCtx || !canAnalyse()) return;
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  audioCtx = ctx;
  // Only route the song through Web Audio once it is confirmed running, so a
  // blocked audio context can never mute the music.
  Promise.resolve(ctx.state === "running" ? null : ctx.resume())
    .then(() => {
      if (ctx.state !== "running") return;
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(music.muted ? 0 : music.volume, ctx.currentTime);
      an.connect(gain);
      gain.connect(ctx.destination);
      ctx.createMediaElementSource(music).connect(an); // from here the song plays through Web Audio
      analyser = an;
      gainNode = gain;
      freq = new Uint8Array(analyser.frequencyBinCount);
      // hand the volume over from the <audio> element to the gain node
      music.muted = false;
      music.volume = 1;
      gainNode.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.35);
      avatar.classList.add("live");
    })
    .catch(() => { analyser = gainNode = null; });
}

function applyVolume() {
  if (gainNode) {
    gainNode.gain.setTargetAtTime(muted ? 0 : volume, audioCtx.currentTime, 0.05);
  } else {
    music.muted = muted;
    music.volume = volume;
  }
}

function startMusic() {
  music.volume = 0;
  music.play().catch(() => {});
  const t0 = performance.now();
  const step = (now) => {
    if (gainNode) return; // the gain node took over and fades on its own
    const k = clamp((now - t0) / 1600, 0, 1); // rAF time can be a hair before t0
    music.volume = volume * k;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function togglePlay() {
  if (music.paused) {
    if (audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
    music.play().catch(() => {});
  } else {
    music.pause();
  }
}

const fmt = (s) => {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const seek = $("seek");
const seekFill = $("seekFill");
const volumeInput = $("volume");

function renderProgress() {
  const p = music.duration ? music.currentTime / music.duration : 0;
  seekFill.style.transform = `scaleX(${p.toFixed(4)})`;
  seek.setAttribute("aria-valuenow", Math.round(p * 100));
  $("tCur").textContent = fmt(music.currentTime);
}

function paintVolume() {
  volumeInput.value = volume;
  volumeInput.style.setProperty("--v", `${volume * 100}%`);
}
paintVolume();

music.addEventListener("play", () => {
  player.classList.add("is-playing");
  $("play").setAttribute("aria-label", "Pause");
});
music.addEventListener("pause", () => {
  player.classList.remove("is-playing");
  $("play").setAttribute("aria-label", "Play");
  drawViz(0, true);
});
const showDuration = () => { $("tDur").textContent = fmt(music.duration); };
music.addEventListener("durationchange", showDuration);
if (music.readyState >= 1) showDuration();
music.addEventListener("timeupdate", renderProgress);

$("play").addEventListener("click", togglePlay);
$("back").addEventListener("click", () => { music.currentTime = Math.max(0, music.currentTime - 10); });

$("mute").addEventListener("click", () => {
  muted = !muted;
  player.classList.toggle("is-muted", muted);
  $("mute").setAttribute("aria-label", muted ? "Unmute" : "Mute");
  applyVolume();
});

volumeInput.addEventListener("input", () => {
  volume = Number(volumeInput.value);
  if (muted && volume > 0) {
    muted = false;
    player.classList.remove("is-muted");
  }
  applyVolume();
  paintVolume();
  store.set("imran:volume", String(volume));
});

function seekFrom(e) {
  const r = seek.getBoundingClientRect();
  const k = clamp((e.clientX - r.left) / r.width, 0, 1);
  if (music.duration) {
    music.currentTime = k * music.duration;
    renderProgress();
  }
}
seek.addEventListener("pointerdown", (e) => {
  seekFrom(e);
  seek.setPointerCapture(e.pointerId);
  const move = (ev) => seekFrom(ev);
  seek.addEventListener("pointermove", move);
  seek.addEventListener("pointerup", () => seek.removeEventListener("pointermove", move), { once: true });
});
seek.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") music.currentTime = Math.min(music.duration || 0, music.currentTime + 5);
  if (e.key === "ArrowLeft") music.currentTime = Math.max(0, music.currentTime - 5);
});

// Keyboard: space = play/pause, M = mute
document.addEventListener("keydown", (e) => {
  if (!entered || e.target.closest("input, button, a, [role=slider]")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.key.toLowerCase() === "m") $("mute").click();
});

/* ---------- Music-reactive avatar + mini visualiser ---------- */
const avatarPulse = $("avatarPulse");
const avatarGlow = $("avatarGlow");
const viz = $("viz");
const vctx = viz.getContext("2d");
const BARS = 14;
// log-spaced frequency bands, roughly 90 Hz to 8 kHz
const bands = Array.from({ length: BARS + 1 }, (_, i) => Math.round(2 * Math.pow(85, i / BARS)));
let beat = 0;      // 0..1, jumps up on each kick drum
let energy = 0;    // 0..1, how loud the bass is overall
let prevBass = 0;
let riseAvg = 1;
let lastAnalysis = 0;
let shown = -1;

function updateBeat(now) {
  // analyse at ~60 Hz so it feels the same on 120/144 Hz screens
  if (now - lastAnalysis < 15) return;
  lastAnalysis = now;
  let target = 0;
  if (analyser && !music.paused) {
    analyser.getByteFrequencyData(freq);
    const bass = (freq[1] + freq[2] + freq[3]) / 3; // about 40-170 Hz
    // a kick is a sudden rise in bass, compared with how much it usually rises
    const rise = Math.max(0, bass - prevBass);
    prevBass = bass;
    riseAvg += (rise - riseAvg) * 0.05;
    target = clamp((rise - 1.2 * riseAvg) / (3 * riseAvg + 2), 0, 1);
    energy += (clamp((bass - 110) / 120, 0, 1) - energy) * 0.05;
  } else {
    energy *= 0.95;
  }
  beat += (target - beat) * (target > beat ? 0.7 : 0.16);
  const level = beat + energy * 0.35;
  // only touch the page when the value visibly changes
  if (Math.abs(level - shown) > 0.004) {
    shown = level;
    avatarPulse.style.transform = `scale(${(1 + beat * 0.07).toFixed(4)})`;
    avatarGlow.style.opacity = (0.25 + energy * 0.25 + beat * 0.5).toFixed(3);
  }
}

function drawViz(now, flat) {
  const w = viz.width;
  const h = viz.height;
  const bw = w / BARS;
  vctx.clearRect(0, 0, w, h);
  vctx.fillStyle = "rgba(235, 243, 255, 0.9)";
  for (let i = 0; i < BARS; i++) {
    let v = 0;
    if (flat) {
      v = 0;
    } else if (analyser) {
      let sum = 0;
      let n = 0;
      for (let b = bands[i]; b < Math.max(bands[i + 1], bands[i] + 1); b++) { sum += freq[b]; n++; }
      v = sum / n / 255;
    } else {
      // no audio access (iPhone / local file): a gentle idle wave
      v = 0.35 + 0.22 * Math.sin(now / 260 + i * 0.9) + 0.14 * Math.sin(now / 410 + i * 2.1);
    }
    const bh = Math.max(3, v * h);
    vctx.fillRect(i * bw + 2, h - bh, bw - 4, bh);
  }
}
drawViz(0, true);

/* ---------- Floating light particles (one small canvas) ---------- */
const fx = (() => {
  const canvas = $("fx");
  const ctx = canvas.getContext("2d");
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const sctx = sprite.getContext("2d");
  const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.25, "rgba(235, 244, 255, 0.75)");
  g.addColorStop(1, "rgba(207, 230, 255, 0)");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, 32, 32);

  let W = 0;
  let H = 0;
  let dots = [];
  let on = false;
  let resizeQueued = false;

  const spawn = (anywhere) => ({
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : H + 20,
    s: 4 + Math.random() * 10,
    v: 0.15 + Math.random() * 0.4,
    sway: Math.random() * 6.28,
    a: 0.25 + Math.random() * 0.55,
  });

  function resize() {
    resizeQueued = false;
    // drawn at 1 canvas pixel per CSS pixel: the dots are soft, so this looks
    // the same and costs up to 4x less on sharp screens
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    const n = Math.round(clamp((W * H) / 26000, 16, 56));
    while (dots.length < n) dots.push(spawn(true));
    dots.length = n;
    for (const d of dots) if (d.x > W) d.x = Math.random() * W;
  }
  const queueResize = () => {
    if (!resizeQueued) { resizeQueued = true; requestAnimationFrame(resize); }
  };

  function draw(dt, boost) {
    ctx.clearRect(0, 0, W, H);
    const speed = dt * (1 + boost * 2);
    for (const d of dots) {
      d.y -= d.v * speed;
      d.sway += 0.01 * dt;
      if (d.y < -20) Object.assign(d, spawn(false));
      ctx.globalAlpha = Math.min(1, d.a * (0.75 + 0.25 * Math.sin(d.sway * 3)) * (1 + boost * 0.8));
      ctx.drawImage(sprite, d.x + Math.sin(d.sway) * 12 - d.s / 2, d.y - d.s / 2, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  return {
    get on() { return on; },
    start() {
      if (on) return;
      on = true;
      resize();
      addEventListener("resize", queueResize);
    },
    stop() {
      on = false;
      ctx.clearRect(0, 0, W, H);
      removeEventListener("resize", queueResize);
    },
    draw,
  };
})();

/* ---------- 3D tilt + glare (mouse only) ---------- */
const glare = $("glare");
const tilt = { x: 0, y: 0, tx: 0, ty: 0, gx: 0, gy: 0, moving: false, hover: false, rect: null };

// offsetLeft/Top ignore transforms, so the tilt itself never skews this
function measureCard() {
  let x = 0;
  let y = 0;
  for (let el = card; el; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
  tilt.rect = { x, y, w: card.offsetWidth, h: card.offsetHeight };
}

function onPointerMove(e) {
  if (e.pointerType !== "mouse") return;
  spawnSpark(e.clientX, e.clientY);
  const r = tilt.rect;
  if (!r) return;
  const px = e.clientX - (r.x - scrollX);
  const py = e.clientY - (r.y - scrollY);
  tilt.tx = clamp((px / r.w) * 2 - 1, -1, 1);
  tilt.ty = clamp((py / r.h) * 2 - 1, -1, 1);
  tilt.gx = px;
  tilt.gy = py;
  const inside = px >= 0 && py >= 0 && px <= r.w && py <= r.h;
  if (inside !== tilt.hover) {
    tilt.hover = inside;
    card.classList.toggle("is-hover", inside);
  }
  tilt.moving = true;
}

function resetTilt() {
  tilt.tx = tilt.ty = 0;
  tilt.moving = true;
  tilt.hover = false;
  card.classList.remove("is-hover");
}

function updateTilt(dt) {
  const k = 1 - Math.pow(0.88, dt); // same feel at 60, 120 or 144 Hz
  tilt.x += (tilt.tx - tilt.x) * k;
  tilt.y += (tilt.ty - tilt.y) * k;
  card.style.transform =
    `perspective(1100px) rotateX(${(-tilt.y * 6).toFixed(2)}deg) rotateY(${(tilt.x * 6).toFixed(2)}deg)`;
  glare.style.transform = `translate3d(${tilt.gx.toFixed(1)}px, ${tilt.gy.toFixed(1)}px, 0)`;
  if (Math.abs(tilt.tx - tilt.x) < 0.002 && Math.abs(tilt.ty - tilt.y) < 0.002) tilt.moving = false;
}

/* ---------- Cursor sparkles: 16 reused elements, animated off the main thread ---------- */
const sparks = [];
let sparkIndex = 0;
let lastSpark = 0;

function spawnSpark(x, y) {
  const now = performance.now();
  if (now - lastSpark < 45 || root.classList.contains("lite")) return;
  lastSpark = now;
  let s = sparks[sparkIndex];
  if (!s) {
    s = document.createElement("i");
    s.className = "spark";
    document.body.appendChild(s);
    sparks[sparkIndex] = s;
  }
  sparkIndex = (sparkIndex + 1) % 16;
  if (!s.animate) return;
  const dx = (Math.random() - 0.5) * 30;
  const dy = 12 + Math.random() * 26;
  s.animate(
    [
      { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) scale(0.2)`, opacity: 0 },
    ],
    { duration: 750, easing: "cubic-bezier(.2, .7, .3, 1)" }
  );
}

/* ---------- Frame-rate watchdog: drop to lite mode if the device struggles ---------- */
const perf = { startAt: 0, t0: 0, frames: 0, slow: 0, done: false };

function watchdog(now) {
  if (perf.done || now < perf.startAt) return;
  if (!perf.t0) { perf.t0 = now; perf.frames = 0; return; }
  perf.frames++;
  const span = now - perf.t0;
  if (span < 1500) return;
  const fps = (perf.frames * 1000) / span;
  perf.t0 = now;
  perf.frames = 0;
  if (span > 3000) return; // the tab was hidden; not a real measurement
  perf.slow = fps < 40 ? perf.slow + 1 : 0;
  if (perf.slow >= 2) {
    perf.done = true;
    root.classList.add("lite");
    fx.stop();
  }
}

/* ---------- One animation loop for everything ---------- */
let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame ? Math.min(3, (now - lastFrame) / 16.667) : 1;
  lastFrame = now;
  updateBeat(now);
  if (!music.paused) drawViz(now, false);
  if (tilt.moving) updateTilt(dt);
  if (fx.on) fx.draw(dt, beat);
  watchdog(now);
}

function startEffects() {
  perf.startAt = performance.now() + 2500; // let the intro animation settle first
  requestAnimationFrame(frame);
  if (reduceMotion) return;
  if (!root.classList.contains("lite")) fx.start();
  if (hasMouse) {
    measureCard();
    if (window.ResizeObserver) new ResizeObserver(measureCard).observe(card);
    addEventListener("resize", measureCard);
    if (document.fonts) document.fonts.ready.then(measureCard);
    addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("mouseleave", resetTilt);
  }
}

// Save battery: the background video pauses while the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (!entered) return;
  if (document.hidden) video.pause();
  else video.play().catch(() => {});
});

/* ---------- Live clock ---------- */
function tickClock() {
  $("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
tickClock();
setInterval(tickClock, 10000);

/* ---------- Discord copy + toast ---------- */
const toast = $("toast");
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1800);
}

$("discordBtn").addEventListener("click", async (e) => {
  const name = e.currentTarget.dataset.discord;
  try {
    await navigator.clipboard.writeText(name);
    showToast(`copied discord: ${name}`);
  } catch {
    showToast(`discord: ${name}`);
  }
});

// Social links that still point to "#" shouldn't jump the page
document.querySelectorAll('.social[href="#"]').forEach((a) => {
  a.addEventListener("click", (e) => { e.preventDefault(); showToast("link coming soon"); });
});

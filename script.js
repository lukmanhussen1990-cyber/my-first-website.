// ====== Edit these to personalise the page ======
const ENTER_TEXT = "click to enter...";
const BIO_LINES = [
  "forever young.",
  "let's dance in style, let's dance for a while",
  "living fast, dreaming louder.",
  "welcome to my corner of the internet ✦",
];
const TITLE_FRAMES = ["@imran", "@imra", "@imr", "@im", "@i", "@", "@i", "@im", "@imr", "@imra", "@imran", "✦ imran ✦"];
const START_VOLUME = 0.5;
// ================================================

const $ = (id) => document.getElementById(id);
const music = $("music");
const video = $("bgVideo");
const player = $("player");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

/* ---------- Typewriter helpers ---------- */
function typeOnce(el, text, speed = 70) {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, speed);
      else resolve();
    };
    tick();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeLoop(el, lines) {
  for (let n = 0; ; n = (n + 1) % lines.length) {
    const line = lines[n];
    for (let i = 1; i <= line.length; i++) {
      el.textContent = line.slice(0, i);
      await sleep(55 + Math.random() * 45);
    }
    await sleep(2200);
    for (let i = line.length; i >= 0; i--) {
      el.textContent = line.slice(0, i);
      await sleep(28);
    }
    await sleep(350);
  }
}

/* ---------- Animated tab title ---------- */
let titleIdx = 0;
setInterval(() => {
  document.title = TITLE_FRAMES[titleIdx];
  titleIdx = (titleIdx + 1) % TITLE_FRAMES.length;
}, 450);

/* ---------- Enter screen ---------- */
const enter = $("enter");
typeOnce($("enterText"), ENTER_TEXT, 80);

let entered = false;
function doEnter() {
  if (entered) return;
  entered = true;
  enter.classList.add("is-gone");
  document.body.classList.add("entered");
  video.play().catch(() => {});
  startMusic();
  typeLoop($("bio"), BIO_LINES);
}
enter.addEventListener("click", doEnter);
enter.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doEnter(); }
});
enter.focus();

/* ---------- Music player ---------- */
const fmt = (s) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const volume = $("volume");
let targetVolume = START_VOLUME;
volume.value = START_VOLUME;

function paintVolume() {
  volume.style.setProperty("--v", `${volume.value * 100}%`);
}
paintVolume();

function fadeTo(target, ms = 1600) {
  const from = music.volume;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    music.volume = from + (target - from) * k;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function startMusic() {
  music.volume = 0;
  music.play().then(() => {
    initAnalyser();
    fadeTo(targetVolume);
  }).catch(() => {});
}

function togglePlay() {
  if (music.paused) {
    music.play().then(initAnalyser).catch(() => {});
    if (music.volume === 0 && !music.muted) music.volume = targetVolume;
  } else {
    music.pause();
  }
}

music.addEventListener("play", () => {
  player.classList.add("is-playing");
  $("play").setAttribute("aria-label", "Pause");
});
music.addEventListener("pause", () => {
  player.classList.remove("is-playing");
  $("play").setAttribute("aria-label", "Play");
});
const showDuration = () => { $("tDur").textContent = fmt(music.duration); };
music.addEventListener("durationchange", showDuration);
if (music.readyState >= 1) showDuration();
music.addEventListener("timeupdate", () => {
  const pct = music.duration ? (music.currentTime / music.duration) * 100 : 0;
  $("seekFill").style.width = `${pct}%`;
  $("seek").setAttribute("aria-valuenow", Math.round(pct));
  $("tCur").textContent = fmt(music.currentTime);
});

$("play").addEventListener("click", togglePlay);
$("back").addEventListener("click", () => { music.currentTime = Math.max(0, music.currentTime - 10); });

$("mute").addEventListener("click", () => {
  music.muted = !music.muted;
  player.classList.toggle("is-muted", music.muted);
  $("mute").setAttribute("aria-label", music.muted ? "Unmute" : "Mute");
});

volume.addEventListener("input", () => {
  targetVolume = Number(volume.value);
  music.volume = targetVolume;
  if (music.muted && targetVolume > 0) {
    music.muted = false;
    player.classList.remove("is-muted");
  }
  paintVolume();
});

const seek = $("seek");
function seekFrom(e) {
  const r = seek.getBoundingClientRect();
  const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  if (music.duration) music.currentTime = k * music.duration;
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
  if (!entered || e.target.closest("input, button, [role=slider]")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.key.toLowerCase() === "m") $("mute").click();
});

/* ---------- Audio-reactive visuals ---------- */
let analyser, freq;
function initAnalyser() {
  if (analyser) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(music);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    if (ctx.state === "suspended") ctx.resume();
    requestAnimationFrame(renderViz);
  } catch (err) {
    analyser = null; // visuals are optional; music still plays
  }
}

const viz = $("viz");
const vctx = viz.getContext("2d");
const root = document.documentElement.style;
let bassSmoothed = 0;

function renderViz() {
  requestAnimationFrame(renderViz);
  analyser.getByteFrequencyData(freq);

  // bass drives the avatar pulse + background zoom
  let bass = 0;
  for (let i = 0; i < 6; i++) bass += freq[i];
  bass = Math.max(0, bass / (6 * 255) - 0.45) / 0.55;
  bassSmoothed += (bass - bassSmoothed) * 0.35;
  if (!reduceMotion) root.setProperty("--bass", bassSmoothed.toFixed(3));

  // mini bar visualiser in the player
  const bars = 16;
  const w = viz.width, h = viz.height;
  const bw = w / bars;
  vctx.clearRect(0, 0, w, h);
  vctx.fillStyle = "rgba(235, 243, 255, 0.9)";
  for (let i = 0; i < bars; i++) {
    const v = freq[Math.floor(i * (freq.length * 0.45) / bars)] / 255;
    const bh = Math.max(2, v * h);
    vctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
  }
}

/* ---------- 3D tilt card ---------- */
const card = $("card");
if (finePointer && !reduceMotion) {
  document.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const cx = Math.max(-1, Math.min(1, x * 2 - 1));
    const cy = Math.max(-1, Math.min(1, y * 2 - 1));
    card.style.setProperty("--ry", `${cx * 8}deg`);
    card.style.setProperty("--rx", `${-cy * 8}deg`);
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
  });
  document.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

/* ---------- Cursor sparkle trail ---------- */
if (finePointer && !reduceMotion) {
  let last = 0;
  document.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - last < 35) return;
    last = now;
    const s = document.createElement("span");
    s.className = "spark";
    s.style.left = `${e.clientX - 3}px`;
    s.style.top = `${e.clientY - 3}px`;
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 30}px`);
    s.style.setProperty("--dy", `${10 + Math.random() * 25}px`);
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  });
}

/* ---------- Floating particles ---------- */
(() => {
  if (reduceMotion) return;
  const c = $("particles");
  const ctx = c.getContext("2d");
  let W, H, dots;
  const mouse = { x: -999, y: -999 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = c.width = innerWidth * dpr;
    H = c.height = innerHeight * dpr;
    c.style.width = `${innerWidth}px`;
    c.style.height = `${innerHeight}px`;
    const count = Math.round(Math.min(90, (innerWidth * innerHeight) / 16000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 1.6 + 0.4) * dpr,
      vx: (Math.random() - 0.5) * 0.15 * dpr,
      vy: (Math.random() * 0.35 + 0.1) * dpr,
      a: Math.random() * 0.6 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));
    mouse.dpr = dpr;
  }
  resize();
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX * mouse.dpr; mouse.y = e.clientY * mouse.dpr; });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const boost = 1 + bassSmoothed * 2.5;
    for (const d of dots) {
      d.tw += 0.03;
      d.x += d.vx;
      d.y += d.vy * boost;
      const dx = d.x - mouse.x, dy = d.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110 * mouse.dpr) {
        d.x += (dx / dist) * 1.2;
        d.y += (dy / dist) * 1.2;
      }
      if (d.y > H + 5) { d.y = -5; d.x = Math.random() * W; }
      if (d.x < -5) d.x = W + 5;
      if (d.x > W + 5) d.x = -5;
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(d.tw));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = "#eaf3ff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

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

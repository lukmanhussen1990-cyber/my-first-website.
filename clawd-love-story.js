/* =====================================================================
   Clawd — A Little Pixel Love Story
   A self-contained pixel-art animation: crisp Canvas rendering, a
   parallax world, particle magic, cinematic camera, and chiptune audio.

   Clawd is drawn faithfully to the reference art:
     - flat orange body, roughly square
     - two little ear-bumps on top
     - two black square eyes, spaced apart
     - side arms, three stubby legs
   The "girl" Clawd shares the exact same design, plus a small flower,
   soft blush and tiny eyelashes.
   ===================================================================== */
(function () {
  "use strict";

  // ---- Canvas -------------------------------------------------------
  const canvas = document.getElementById("scene");
  // `g` is the active drawing context. It is normally the main scene canvas,
  // but drawPoster() temporarily repoints it at the start-screen canvas so the
  // same sprite/particle helpers can render the poster.
  let g = canvas.getContext("2d");
  const mainG = g;
  const W = canvas.width;   // 384
  const H = canvas.height;  // 216
  g.imageSmoothingEnabled = false;

  // ---- Palette ------------------------------------------------------
  const ORANGE = "#f15b44";
  const EYE = "#1b1b1b";
  const FLOWER_P = "#ff6fae";
  const FLOWER_P2 = "#ff9ccb";
  const FLOWER_C = "#ffd54a";

  const GROUND_Y = 156;         // world baseline (feet rest here)
  const CELL = 3;               // px per pixel-cell of Clawd

  // ---- Small helpers ------------------------------------------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);                 // smoothstep
  const easeIn = (t) => t * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  // remap x in [a,b] -> [0,1] clamped
  const seg = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  function hex(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // deterministic pseudo-random for scattered props
  function rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ===================================================================
  //  CLAWD SPRITE
  // ===================================================================
  // Body bitmap (14 wide, 9 tall). O = orange, # = eye, . = empty.
  const BODY = [
    "...OO....OO...",
    "...OO....OO...",
    ".OOOOOOOOOOOO.",
    "OOOOOOOOOOOOOO",
    "OOO##OOOO##OOO",
    "OOO##OOOO##OOO",
    "OOOOOOOOOOOOOO",
    "OOOOOOOOOOOOOO",
    ".OOOOOOOOOOOO.",
  ];
  const BODY_W = 14, BODY_H = 9, LEG_ROWS = 3;

  /* Draw Clawd.
     x,y      : world position of the FEET baseline (centre-bottom)
     o.cell   : pixel size
     o.color  : body colour
     o.sx,sy  : horizontal/vertical scale (spin & squash), anchored at feet
     o.legPhase : walk cycle phase (radians); null = standing
     o.armL / o.armR : {ang, len} arm pose. ang in rad (0 = straight out
                       to the side, negative = raised up). len in cells.
     o.expr   : "normal" | "happy" | "surprised"
     o.blush  : 0..1
     o.variant: "girl" adds flower + lashes
     o.alpha  : 0..1
  */
  function drawClawd(x, y, o) {
    o = o || {};
    const cell = o.cell || CELL;
    const color = o.color || ORANGE;
    const sx = o.sx == null ? 1 : o.sx;
    const sy = o.sy == null ? 1 : o.sy;
    const alpha = o.alpha == null ? 1 : o.alpha;

    g.save();
    g.globalAlpha *= alpha;
    g.translate(Math.round(x), Math.round(y));
    g.scale(sx, sy);

    const X0 = -(BODY_W * cell) / 2;
    const Y0 = -(LEG_ROWS + BODY_H) * cell; // top of body

    // cell-based fill relative to body top-left
    const P = (cx, cy, cw, ch, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(X0 + cx * cell), Math.round(Y0 + cy * cell),
                 Math.max(1, Math.round(cw * cell)), Math.max(1, Math.round(ch * cell)));
    };

    // ---- Legs (3), drawn first so body overlaps their tops ----------
    const legCols = [2, 6, 10];
    for (let i = 0; i < 3; i++) {
      let lift = 0, swing = 0;
      if (o.legPhase != null) {
        const ph = o.legPhase + i * (Math.PI * 2 / 3);
        lift = Math.max(0, Math.sin(ph));       // 0..1 foot raised
        swing = Math.cos(ph) * 0.5;             // fore/aft
      }
      const len = 3 - 1.5 * lift;               // cells
      const top = BODY_H;                       // starts at body bottom row
      P(legCols[i] + swing, top, 2, len, color);
    }

    // ---- Arms (drawn behind body edges look fine) -------------------
    drawArm(-1, o.armL, color, cell, X0, Y0, o);
    drawArm(+1, o.armR, color, cell, X0, Y0, o);

    // ---- Body -------------------------------------------------------
    for (let r = 0; r < BODY.length; r++) {
      const row = BODY[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === "O") P(c, r, 1, 1, color);
      }
    }

    // ---- Face -------------------------------------------------------
    const expr = o.expr || "normal";
    drawFace(P, expr);

    if (o.blush) {
      g.globalAlpha *= 0.5 + 0.4 * o.blush;
      P(2, 6, 2, 1, "#ff8f9e");
      P(10, 6, 2, 1, "#ff8f9e");
      g.globalAlpha /= (0.5 + 0.4 * o.blush);
    }

    // ---- Girl accessories (same design, small additions) ------------
    if (o.variant === "girl") {
      // eyelashes (tiny 1-cell ticks at the outer top of each eye)
      P(2, 3, 1, 1, EYE);
      P(11, 3, 1, 1, EYE);
      // little flower above the left ear
      P(3, -2, 1, 1, FLOWER_P);
      P(1, -1, 1, 1, FLOWER_P2);
      P(3, -1, 1, 1, FLOWER_C);
      P(5, -1, 1, 1, FLOWER_P2);
      P(3, 0, 1, 1, FLOWER_P);
      P(2, -1, 1, 1, FLOWER_P);
      P(4, -1, 1, 1, FLOWER_P);
    }

    g.restore();
  }

  function drawFace(P, expr) {
    if (expr === "happy") {
      // upward-arc "^ ^" happy eyes
      const eye = (cx) => { P(cx, 5, 1, 1, EYE); P(cx + 1, 4, 1, 1, EYE); P(cx + 2, 5, 1, 1, EYE); };
      eye(3); eye(9);
    } else if (expr === "surprised") {
      // rounder, taller eyes
      P(3, 3, 2, 3, EYE);
      P(9, 3, 2, 3, EYE);
    } else {
      // reference default: two 2x2 black squares
      P(3, 4, 2, 2, EYE);
      P(9, 4, 2, 2, EYE);
    }
  }

  function drawArm(side, arm, color, cell, X0, Y0, o) {
    // shoulder anchor (in cell coords): left at col 0, right at col 14, row 5
    const shoulderCol = side < 0 ? 0 : BODY_W;
    const ang = (arm && arm.ang != null) ? arm.ang : 0;
    const len = (arm && arm.len != null) ? arm.len : 2;
    const ox = X0 + shoulderCol * cell;
    const oy = Y0 + (5.5) * cell;
    g.save();
    g.translate(ox, oy);
    // side>0 points right (ang 0). side<0 mirror.
    g.rotate(side < 0 ? Math.PI - ang * side : ang);
    g.fillStyle = color;
    // arm as a chunky 2-cell-thick nub of `len` cells
    g.fillRect(0, Math.round(-cell), Math.round(len * cell), Math.round(cell * 1.6));
    g.restore();
  }

  // ===================================================================
  //  CAMERA
  // ===================================================================
  const cam = { focusX: 0, focusY: 135, zoom: 1.6, roll: 0 };
  function w2s(wx, wy, par) {
    par = par == null ? 1 : par;
    return {
      x: (wx - cam.focusX * par) * cam.zoom + W / 2,
      y: (wy - cam.focusY) * cam.zoom + H * 0.55,
    };
  }
  const zsize = (n) => n * cam.zoom;

  // ===================================================================
  //  WORLD  (sky, sun, hills, trees, flowers, glow lights, ground)
  // ===================================================================
  function drawSky(sunset) {
    // sunset 0..1 blends day -> golden evening
    const top = mix("#6fb8ff", "#3a2a6b", sunset);
    const midc = mix("#9fd8ff", "#ff8f6b", sunset);
    const bot = mix("#dff4ff", "#ffd98a", sunset);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, top);
    grd.addColorStop(0.55, midc);
    grd.addColorStop(1, bot);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // Sun / moon glow — rises as a big pixel disc in the evening
    const sun = w2s(600, 40, 0.15);
    const sunR = zsize(sunset > 0.2 ? 34 : 20);
    const sunGlow = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sunR * 3);
    const glowCore = mix("#fff0b4", "#ffbe78", sunset).replace("rgb(", "rgba(").replace(")", ",0.9)");
    sunGlow.addColorStop(0, glowCore);
    sunGlow.addColorStop(1, "rgba(255,220,150,0)");
    g.fillStyle = sunGlow;
    g.beginPath(); g.arc(sun.x, sun.y, sunR * 3, 0, 7); g.fill();
    g.fillStyle = mix("#fff3c4", "#ffcf7a", sunset);
    pixelDisc(sun.x, sun.y, sunR);
  }

  function drawClouds(t, sunset) {
    sunset = sunset || 0;
    const col = mix("#ffffff", "#ffb89a", sunset);
    const a = 0.82 * (1 - 0.6 * sunset);
    g.fillStyle = col.replace("rgb(", "rgba(").replace(")", `,${a})`);
    for (let i = 0; i < 6; i++) {
      const base = i * 260 + 120;
      const wx = base + t * 3;
      const wrapped = ((wx % 1560) + 1560) % 1560;
      const s = w2s(wrapped - 100, 30 + (i % 3) * 22, 0.25);
      cloud(s.x, s.y, zsize(1.1));
    }
  }
  function cloud(x, y, s) {
    const b = (dx, dy, w, h) => g.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.ceil(w * s), Math.ceil(h * s));
    b(0, 0, 22, 6); b(4, -4, 14, 6); b(10, -7, 8, 5);
  }

  function drawHills() {
    // two rolling parallax hill bands
    band(0.4, GROUND_Y - 8, "#8fd77a", 44, 30);
    band(0.65, GROUND_Y - 2, "#6fc85f", 30, 22);
  }
  function band(par, worldY, col, amp, step) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let sxp = -40; sxp <= W + 40; sxp += 6) {
      const wx = (sxp - W / 2) / cam.zoom + cam.focusX * par;
      const y = w2s(0, worldY, 1).y - Math.sin(wx / step) * zsize(amp * 0.12) - zsize(amp * 0.05);
      g.lineTo(sxp, y);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
  }

  function drawGround() {
    const gy = w2s(0, GROUND_Y, 1).y;
    g.fillStyle = "#5fbb4e";
    g.fillRect(0, gy, W, H - gy + 2);
    g.fillStyle = "#4da33f";
    g.fillRect(0, gy, W, zsize(3));
    // grass tufts along the path
    g.fillStyle = "#3f8f34";
    for (let i = -6; i < 60; i++) {
      const wx = i * 34 + 10;
      const s = w2s(wx, GROUND_Y, 1);
      if (s.x < -10 || s.x > W + 10) continue;
      g.fillRect(Math.round(s.x), Math.round(s.y - zsize(3)), Math.ceil(zsize(2)), Math.ceil(zsize(3)));
      g.fillRect(Math.round(s.x + zsize(4)), Math.round(s.y - zsize(2)), Math.ceil(zsize(2)), Math.ceil(zsize(2)));
    }
  }

  function drawTree(wx, scale, par) {
    const base = w2s(wx, GROUND_Y, par);
    const s = zsize(scale) * (par < 1 ? par + 0.3 : 1);
    // trunk
    g.fillStyle = "#8a5a34";
    g.fillRect(Math.round(base.x - s * 3), Math.round(base.y - s * 20), Math.ceil(s * 6), Math.ceil(s * 20));
    // leafy blob (chunky pixels)
    const leaf = "#54c057", leaf2 = "#3fa14b";
    const blob = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(base.x + dx * s), Math.round(base.y + dy * s), Math.ceil(w * s), Math.ceil(h * s)); };
    blob(-16, -40, 32, 20, leaf);
    blob(-12, -46, 24, 12, leaf);
    blob(-20, -34, 40, 12, leaf2);
    blob(-8, -50, 16, 8, leaf);
  }

  const FLOWER_COLS = ["#ff6b8a", "#ffd23f", "#b388ff", "#ff9f45", "#69d2ff"];
  function drawFlower(wx, par, seed) {
    const base = w2s(wx, GROUND_Y - 1, par);
    if (base.x < -8 || base.x > W + 8) return;
    const s = zsize(1);
    const col = FLOWER_COLS[Math.floor(rnd(seed) * FLOWER_COLS.length)];
    g.fillStyle = "#3f8f34";
    g.fillRect(Math.round(base.x), Math.round(base.y - s * 5), Math.ceil(s), Math.ceil(s * 5));
    g.fillStyle = col;
    g.fillRect(Math.round(base.x - s), Math.round(base.y - s * 7), Math.ceil(s * 3), Math.ceil(s * 3));
    g.fillStyle = "#fff2b0";
    g.fillRect(Math.round(base.x), Math.round(base.y - s * 6), Math.ceil(s), Math.ceil(s));
  }

  // glowing magical lights floating in the world
  function drawGlowLights(t) {
    for (let i = 0; i < 26; i++) {
      const wx = i * 90 - 100 + Math.sin(t * 0.4 + i) * 14;
      const wy = GROUND_Y - 40 - (rnd(i) * 60) + Math.sin(t * 0.8 + i * 2) * 8;
      const s = w2s(wx, wy, 0.85);
      if (s.x < -10 || s.x > W + 10) continue;
      const r = zsize(1.5 + rnd(i + 9) * 1.5);
      const a = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      const gl = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
      gl.addColorStop(0, `rgba(255,246,190,${a})`);
      gl.addColorStop(1, "rgba(255,246,190,0)");
      g.fillStyle = gl;
      g.beginPath(); g.arc(s.x, s.y, r * 4, 0, 7); g.fill();
    }
  }

  function pixelDisc(cx, cy, r) {
    // chunky pixel circle
    const step = Math.max(2, Math.round(cam.zoom * 2));
    for (let yy = -r; yy <= r; yy += step) {
      const w = Math.sqrt(Math.max(0, r * r - yy * yy));
      g.fillRect(Math.round(cx - w), Math.round(cy + yy), Math.ceil(w * 2), step);
    }
  }

  // Static-ish world props laid out along the path
  function drawWorldProps(t) {
    // far trees
    for (let i = 0; i < 14; i++) drawTree(i * 240 - 200, 1.1, 0.55);
    // near trees + bushes
    for (let i = 0; i < 20; i++) drawTree(i * 170 - 120 + 60, 1.6, 1);
    // flowers scattered
    for (let i = 0; i < 120; i++) drawFlower(i * 30 - 200, 1, i);
  }

  // ===================================================================
  //  PARTICLES  (hearts, sparkles, stars, rainbow motes, petals, fireflies)
  // ===================================================================
  const parts = [];
  function spawn(p) { parts.push(p); }
  function heart(wx, wy, vy) {
    spawn({ type: "heart", x: wx, y: wy, vx: (Math.random() - 0.5) * 6, vy: vy || -18 - Math.random() * 10,
      life: 0, max: 2.2 + Math.random() * 1.2, size: 2 + Math.random() * 2, sway: Math.random() * 6, hue: Math.random() });
  }
  function sparkle(wx, wy) {
    spawn({ type: "sparkle", x: wx, y: wy, vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24,
      life: 0, max: 0.6 + Math.random() * 0.6, size: 1 + Math.random() * 1.5 });
  }
  function rainbowMote(wx, wy) {
    spawn({ type: "rainbow", x: wx, y: wy, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20,
      life: 0, max: 1.4 + Math.random(), size: 1.5 + Math.random() * 1.5, hue: Math.random() });
  }
  function firefly(wx, wy) {
    spawn({ type: "firefly", x: wx, y: wy, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
      life: 0, max: 4 + Math.random() * 3, size: 1 + Math.random(), ph: Math.random() * 7 });
  }
  function petal(wx, wy) {
    spawn({ type: "petal", x: wx, y: wy, vx: (Math.random() - 0.5) * 18, vy: -6 - Math.random() * 10,
      life: 0, max: 2.5 + Math.random() * 1.5, size: 1.5 + Math.random(), spin: Math.random() * 7, col: FLOWER_COLS[Math.floor(Math.random() * FLOWER_COLS.length)] });
  }

  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === "heart") { p.vy += 4 * dt; p.x += Math.sin(p.life * 4 + p.sway) * 0.4; }
      if (p.type === "rainbow") { p.vy += 6 * dt; }
      if (p.type === "petal") { p.vy += 10 * dt; p.x += Math.sin(p.life * 3 + p.spin) * 0.6; }
      if (p.type === "firefly") { p.vx += (Math.random() - 0.5) * 12 * dt; p.vy += (Math.random() - 0.5) * 12 * dt; p.vx = clamp(p.vx, -12, 12); p.vy = clamp(p.vy, -12, 12); }
    }
  }

  function drawParticles() {
    for (const p of parts) {
      const k = p.life / p.max;
      const s = w2s(p.x, p.y, 1);
      const a = p.type === "firefly" ? (0.4 + 0.6 * Math.abs(Math.sin(p.life * 3 + p.ph))) : (1 - k);
      g.globalAlpha = clamp(a, 0, 1);
      if (p.type === "heart") drawHeart(s.x, s.y, zsize(p.size), `hsl(${lerp(330, 350, p.hue)},90%,65%)`);
      else if (p.type === "sparkle") drawSparkle(s.x, s.y, zsize(p.size), "#fffde0");
      else if (p.type === "rainbow") { g.fillStyle = `hsl(${(p.hue * 360 + p.life * 120) % 360},90%,65%)`; sq(s.x, s.y, zsize(p.size)); }
      else if (p.type === "star") drawSparkle(s.x, s.y, zsize(p.size), "#fff7b0");
      else if (p.type === "petal") { g.fillStyle = p.col; sq(s.x, s.y, zsize(p.size)); }
      else if (p.type === "firefly") { const gl = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, zsize(p.size) * 3); gl.addColorStop(0, "rgba(255,255,180,0.95)"); gl.addColorStop(1, "rgba(255,255,150,0)"); g.fillStyle = gl; g.beginPath(); g.arc(s.x, s.y, zsize(p.size) * 3, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function sq(x, y, s) { g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s))); }
  function drawHeart(x, y, s, col) {
    g.fillStyle = col;
    const b = (dx, dy) => g.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.ceil(s), Math.ceil(s));
    b(-1.5, -1); b(-0.5, -1.5); b(0.5, -1.5); b(1.5, -1);
    b(-1.5, 0); b(-0.5, 0); b(0.5, 0); b(1.5, 0);
    b(-0.5, 1); b(0.5, 1); b(-0.5, 1); b(0, 1.7);
  }
  function drawSparkle(x, y, s, col) {
    g.fillStyle = col;
    g.fillRect(Math.round(x - s * 0.4), Math.round(y - s * 1.4), Math.ceil(s * 0.8), Math.ceil(s * 2.8));
    g.fillRect(Math.round(x - s * 1.4), Math.round(y - s * 0.4), Math.ceil(s * 2.8), Math.ceil(s * 0.8));
  }

  // ===================================================================
  //  BUTTERFLIES  (little wandering sprites in Scene 1)
  // ===================================================================
  const butterflies = [];
  for (let i = 0; i < 5; i++) butterflies.push({ base: i * 150 + 60, y: GROUND_Y - 46 - i * 8, ph: i * 1.7, col: FLOWER_COLS[i % FLOWER_COLS.length] });
  function drawButterflies(t, alpha) {
    for (const b of butterflies) {
      const wx = b.base + Math.sin(t * 0.6 + b.ph) * 40 + t * 6;
      const wy = b.y + Math.sin(t * 3 + b.ph) * 8;
      const s = w2s(wx, wy, 0.95);
      if (s.x < -10 || s.x > W + 10) continue;
      const flap = Math.sin(t * 16 + b.ph) * 0.5 + 0.5;
      const z = zsize(1);
      g.globalAlpha = alpha;
      g.fillStyle = b.col;
      g.fillRect(Math.round(s.x - z * (1 + flap * 2)), Math.round(s.y - z), Math.ceil(z * (1 + flap * 2)), Math.ceil(z * 2));
      g.fillRect(Math.round(s.x + z), Math.round(s.y - z), Math.ceil(z * (1 + flap * 2)), Math.ceil(z * 2));
      g.fillStyle = "#3a2a2a";
      g.fillRect(Math.round(s.x), Math.round(s.y - z), Math.ceil(z), Math.ceil(z * 2));
      g.globalAlpha = 1;
    }
  }

  // ===================================================================
  //  TIMELINE / DIRECTION
  //  Total loop ~ 44s. Positions & camera derived from loop time `T`.
  // ===================================================================
  const LOOP = 44;
  // scene boundaries (seconds)
  const S1 = 12;   // dancing walk
  const S2 = 20;   // meeting
  const S3 = 34;   // falling in love / dance
  const END = 44;  // sunset + loop

  let chapterEl = null;
  let lastChapter = "";
  function setChapter(name) {
    if (name !== lastChapter && chapterEl) { chapterEl.textContent = name; lastChapter = name; }
  }

  // hero (boy) and heroine (girl) world state, filled each frame
  const boy = { x: 0, y: GROUND_Y, expr: "normal", blush: 0, sx: 1, sy: 1, wave: 0, walk: true };
  const girl = { x: 0, y: GROUND_Y, expr: "normal", blush: 0, sx: 1, sy: 1, wave: 0, walk: false, alpha: 0 };

  // meeting point (where they come together), in world coords
  const MEET_X = 12 * 44; // arbitrary far point, ~ where boy arrives by S2

  function direct(T, dt) {
    // ------- default poses -------
    boy.expr = "normal"; boy.blush = 0; boy.sx = 1; boy.sy = 1; boy.wave = 0; boy.alpha = 1;
    girl.alpha = clamp(girl.alpha, 0, 1);
    let sunset = 0;
    const bounce = Math.abs(Math.sin(T * 5)); // shared bouncy timing

    // Boy walks steadily to MEET_X over scenes 1-2
    const walkSpeed = MEET_X / S2;

    if (T < S1) {
      // ---------- SCENE 1 : DANCING WALK ----------
      setChapter("Dancing Walk");
      boy.x = walkSpeed * T;
      boy.walkPhase = T * 9;
      boy.y = GROUND_Y - bounce * 5;           // bouncy hops
      boy.expr = "happy";
      // periodic joyful actions
      const beat = T % 4;
      if (beat > 3.0) {                         // little spin
        const k = seg(beat, 3.0, 3.8);
        boy.sx = Math.cos(k * Math.PI * 2);     // turnaround spin
      } else if (beat > 1.6 && beat < 2.3) {    // wave
        boy.wave = Math.sin(T * 14) * 0.9 + 0.9;
      } else if (beat > 0.7 && beat < 1.1) {    // extra hop
        boy.y = GROUND_Y - 12 * Math.sin(seg(beat, 0.7, 1.1) * Math.PI);
      }
      boy.sy = 1 + 0.08 * Math.sin(T * 10);     // squash & stretch
      // camera follows, framing front/side
      cam.focusX = boy.x;
      cam.focusY = 132 + Math.sin(T * 0.7) * 3;
      cam.zoom = 1.75 + Math.sin(T * 0.5) * 0.08;
      girl.alpha = 0;
      // trailing sparkle from happy feet
      if (Math.random() < 0.5) sparkle(boy.x + (Math.random() - 0.5) * 24, GROUND_Y - 4 - Math.random() * 6);
    } else if (T < S2) {
      // ---------- SCENE 2 : THE MEETING ----------
      setChapter("A Meeting");
      const k = seg(T, S1, S2);
      boy.x = clamp(walkSpeed * T, 0, MEET_X - 44);
      boy.walkPhase = T * 9 * (1 - ease(k)); // slows to a stop
      boy.y = GROUND_Y - Math.abs(Math.sin(T * 5)) * 5 * (1 - ease(k));
      boy.expr = k > 0.5 ? "surprised" : "happy";

      // girl revealed in the distance as camera zooms out
      girl.x = MEET_X + 60;
      girl.y = GROUND_Y - Math.abs(Math.sin(T * 4)) * 4 * (1 - ease(k));
      girl.walkPhase = T * 8 * (1 - ease(k));
      girl.expr = k > 0.55 ? "surprised" : "happy";
      girl.blush = seg(k, 0.5, 1) * 0.6;
      girl.alpha = ease(seg(k, 0.05, 0.5));

      // camera pulls back to reveal both, re-centres between them
      const midX = lerp(boy.x, (boy.x + girl.x) / 2, ease(k));
      cam.focusX = midX;
      cam.focusY = lerp(132, 130, k);
      cam.zoom = lerp(1.75, 1.25, ease(k)); // zoom out
      boy.blush = seg(k, 0.55, 1) * 0.6;
      if (k > 0.5 && Math.random() < 0.25) sparkle((boy.x + girl.x) / 2 + (Math.random() - 0.5) * 40, GROUND_Y - 30);
    } else if (T < S3) {
      // ---------- SCENE 3 : FALLING IN LOVE ----------
      const k = seg(T, S2, S3);
      const mid = (MEET_X - 44 + MEET_X + 60) / 2;
      // Phase A: walk toward each other (0 - 0.35)
      const approach = ease(seg(k, 0, 0.35));
      boy.x = lerp(MEET_X - 44, mid - 20, approach);
      girl.x = lerp(MEET_X + 60, mid + 20, approach);
      girl.alpha = 1;

      if (k < 0.35) {
        setChapter("Falling in Love");
        boy.walkPhase = T * 8; girl.walkPhase = T * 8 + 1;
        boy.y = GROUND_Y - Math.abs(Math.sin(T * 5)) * 3;
        girl.y = GROUND_Y - Math.abs(Math.sin(T * 5 + 1)) * 3;
        boy.expr = girl.expr = "happy";
        boy.blush = girl.blush = 0.7;
      } else {
        // Phase B: hold hands & dance together (0.35 - 1)
        setChapter("A Happy Dance");
        const d = seg(k, 0.35, 1);
        boy.walk = girl.walk = false;
        // gentle synchronised dance: sway + tiny jumps + twirl
        const sway = Math.sin(T * 4) * 10;
        const jump = Math.max(0, Math.sin(T * 4)) * 8;
        boy.x = mid - 22 + sway * 0.4;
        girl.x = mid + 22 + sway * 0.4;
        boy.y = girl.y = GROUND_Y - jump;
        boy.walkPhase = T * 8; girl.walkPhase = T * 8;
        // occasional synchronized twirl (turnaround spin)
        const tw = (T * 0.5) % 1;
        if (tw > 0.7) { const s = Math.cos(seg(tw, 0.7, 1) * Math.PI * 2); boy.sx = s; girl.sx = s; }
        boy.expr = girl.expr = "happy";
        boy.blush = girl.blush = 0.9;
        boy.sy = girl.sy = 1 + 0.06 * Math.sin(T * 8);

        // magic fills the air
        if (Math.random() < 0.7) heart((boy.x + girl.x) / 2 + (Math.random() - 0.5) * 40, GROUND_Y - 24);
        if (Math.random() < 0.6) sparkle(mid + (Math.random() - 0.5) * 70, GROUND_Y - 20 - Math.random() * 40);
        if (Math.random() < 0.4) rainbowMote(mid + (Math.random() - 0.5) * 60, GROUND_Y - 10);

        // camera gently circles the couple, then settles wide
        const circle = seg(d, 0, 0.7);
        const settle = ease(seg(d, 0.7, 1));
        const ang = circle * Math.PI * 2;
        cam.focusX = lerp(mid + Math.sin(ang) * 26, mid, settle);
        cam.zoom = lerp(1.5, 1.15, settle) + Math.sin(ang) * 0.03;
        cam.focusY = 132;
        g.globalAlpha = 1;
      }
      if (k < 0.35) {
        cam.focusX = (boy.x + girl.x) / 2;
        cam.focusY = 131;
        cam.zoom = 1.35;
        if (k > 0.15 && Math.random() < 0.5) heart((boy.x + girl.x) / 2 + (Math.random() - 0.5) * 30, GROUND_Y - 20);
      }
    } else {
      // ---------- ENDING : SUNSET ----------
      setChapter("Happily Ever After");
      const k = seg(T, S3, END);
      sunset = ease(k);
      const mid = (MEET_X - 44 + MEET_X + 60) / 2;
      boy.x = mid - 20; girl.x = mid + 20;
      boy.walk = girl.walk = false;
      boy.walkPhase = girl.walkPhase = null;
      const sway = Math.sin(T * 1.5) * 1.5;
      boy.y = girl.y = GROUND_Y - Math.abs(Math.sin(T * 1.5)) * 1.5;
      boy.x += sway; girl.x += sway;
      boy.expr = girl.expr = "happy";
      boy.blush = girl.blush = 0.9;
      girl.alpha = 1;
      // wide, calm framing
      cam.focusX = mid;
      cam.focusY = 130;
      cam.zoom = 1.2;
      // hearts drift up, fireflies & sparkles appear
      if (Math.random() < 0.5) heart(mid + (Math.random() - 0.5) * 60, GROUND_Y - 30, -12);
      if (Math.random() < 0.4) firefly(mid + (Math.random() - 0.5) * 160, GROUND_Y - 30 - Math.random() * 50);
      if (Math.random() < 0.2) sparkle(mid + (Math.random() - 0.5) * 120, GROUND_Y - 40 - Math.random() * 30);
    }

    boy.sunset = sunset;
    return sunset;
  }

  // ===================================================================
  //  RENDER
  // ===================================================================
  function drawScene(T) {
    const sunset = boy.sunset || 0;
    drawSky(sunset);
    drawClouds(T, sunset);
    drawGlowLights(T);
    drawHills();
    drawWorldProps(T);
    drawGround();

    // Scene-1 butterflies fade out after the meeting
    drawButterflies(T, clamp(1 - seg(T, S1, S2), 0, 1));

    // shadows
    drawShadow(boy.x, boy.alpha == null ? 1 : boy.alpha);
    if (girl.alpha > 0.02) drawShadow(girl.x, girl.alpha);

    // hearts/sparkles behind characters look nicer partly, but draw
    // particles above ground and characters for a dreamy overlay.
    // Characters:
    // pose arms
    poseArms(boy, T);
    poseArms(girl, T);

    drawClawd(...worldToDrawArgs(boy));
    if (girl.alpha > 0.02) drawClawd(...worldToDrawArgs(girl, true));

    // clasped hands when dancing/holding
    drawClaspIfHolding(T);

    drawParticles();

    // sunset warm vignette + firefly glow overlay
    if (sunset > 0.01) {
      g.fillStyle = `rgba(255,150,90,${0.12 * sunset})`;
      g.fillRect(0, 0, W, H);
    }

    // gentle cinematic vignette
    vignette();

    // seamless-loop crossfade: fade out to white at the very end, fade in
    // from white at the very start, so the loop boundary is invisible.
    const fadeOut = seg(T, END - 1.1, END);
    const fadeIn = 1 - seg(T, 0, 1.0);
    const f = Math.max(fadeOut, fadeIn);
    if (f > 0.001) { g.fillStyle = `rgba(255,255,255,${f})`; g.fillRect(0, 0, W, H); }
  }

  function poseArms(c, T) {
    // default: gentle swing while walking; raised & waving when c.wave>0
    if (c.wave && c.wave > 0.05) {
      c.armR = { ang: -1.3 + Math.sin(T * 14) * 0.35, len: 2.4 };
      c.armL = { ang: 0.2, len: 2 };
    } else if (c.walkPhase != null) {
      const s = Math.sin(c.walkPhase) * 0.35;
      c.armR = { ang: s, len: 2 };
      c.armL = { ang: -s, len: 2 };
    } else {
      c.armR = { ang: 0.15, len: 2 };
      c.armL = { ang: 0.15, len: 2 };
    }
  }

  function worldToDrawArgs(c, isGirl) {
    const s = w2s(c.x, c.y, 1);
    return [s.x, s.y, {
      cell: 2 * cam.zoom, // characters scale with the world (so zoom-out shrinks them)
      color: ORANGE,
      sx: (c.sx == null ? 1 : c.sx),
      sy: (c.sy == null ? 1 : c.sy),
      legPhase: c.walkPhase,
      armL: c.armL, armR: c.armR,
      expr: c.expr, blush: c.blush,
      variant: isGirl ? "girl" : "boy",
      alpha: c.alpha == null ? 1 : c.alpha,
    }];
  }

  function drawShadow(wx, alpha) {
    const s = w2s(wx, GROUND_Y + 2, 1);
    g.globalAlpha = 0.22 * (alpha == null ? 1 : alpha);
    g.fillStyle = "#1a3a12";
    const w = zsize(30);
    g.fillRect(Math.round(s.x - w / 2), Math.round(s.y), Math.ceil(w), Math.ceil(zsize(4)));
    g.globalAlpha = 1;
  }

  function drawClaspIfHolding(T) {
    // during dance / ending the two are close: draw joined hands
    if (girl.alpha > 0.9 && Math.abs(boy.x - girl.x) < 70 && (boy.walkPhase == null || T >= S2 + (S3 - S2) * 0.35)) {
      const mx = (boy.x + girl.x) / 2;
      const s = w2s(mx, GROUND_Y - 16, 1);
      g.fillStyle = ORANGE;
      g.fillRect(Math.round(s.x - zsize(3)), Math.round(s.y), Math.ceil(zsize(6)), Math.ceil(zsize(3)));
    }
  }

  function vignette() {
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.22)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  // ===================================================================
  //  CHIPTUNE AUDIO  (Web Audio API — built entirely in code)
  // ===================================================================
  const Audio = (function () {
    let ctx = null, master = null, muted = false, started = false;
    let nextStep = 0, step = 0, timer = null;
    const bpm = 132, stepsPerBeat = 4;
    const stepDur = 60 / bpm / stepsPerBeat;

    // note frequency helper (A4 = 440)
    const N = (semi) => 440 * Math.pow(2, semi / 12);
    // scale degrees relative to C
    const note = { C3: N(-21), E3: N(-17), G3: N(-14), A3: N(-12), C4: N(-9), D4: N(-7), E4: N(-5), F4: N(-4), G4: N(-2), A4: N(0), B4: N(2), C5: N(3), D5: N(5), E5: N(7), G5: N(10) };
    // chord roots for I V vi IV in C
    const bassSeq = [note.C3, note.G3, note.A3, note.F4 / 2];
    const arpChords = [
      [note.C4, note.E4, note.G4, note.E4],
      [note.G3, note.B4 / 2, note.D4, note.B4 / 2],
      [note.A3, note.C4, note.E4, note.C4],
      [note.F4 / 1, note.A4 / 1, note.C5 / 1, note.A4 / 1],
    ];
    // simple cheerful melody (per 16-step bar), C major
    const melody = [
      note.G4, 0, note.C5, 0, note.E5, 0, note.D5, 0, note.C5, 0, note.G4, 0, note.A4, 0, 0, 0,
      note.E4, 0, note.G4, 0, note.C5, 0, note.B4, 0, note.A4, 0, note.G4, 0, note.E4, 0, 0, 0,
    ];

    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
    }

    function osc(freq, t, dur, type, vol, detune) {
      if (!freq) return;
      const o = ctx.createOscillator();
      const gg = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (detune) o.detune.value = detune;
      gg.gain.setValueAtTime(0, t);
      gg.gain.linearRampToValueAtTime(vol, t + 0.008);
      gg.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(gg); gg.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    function noise(t, dur, vol) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const gg = ctx.createGain(); gg.gain.value = vol;
      src.connect(gg); gg.connect(master); src.start(t);
    }

    // scene-aware intensity from global loop time
    function sceneVol() {
      const T = getLoopT();
      if (T < S1) return { mel: 0.10, arp: 0.05, bass: 0.10, drums: true };      // cheerful walk
      if (T < S2) return { mel: 0.06, arp: 0.06, bass: 0.06, drums: false };     // soften at meeting
      if (T < S3) return { mel: 0.09, arp: 0.07, bass: 0.09, drums: true };      // warm romantic
      return { mel: 0.05, arp: 0.06, bass: 0.05, drums: false };                 // tender ending
    }

    function scheduler() {
      while (nextStep < ctx.currentTime + 0.12) {
        const s = step % 16;
        const bar = Math.floor(step / 16) % 4;
        const vol = sceneVol();
        // bass on beats
        if (s % 4 === 0) osc(bassSeq[bar], nextStep, 0.28, "triangle", vol.bass);
        // arpeggio
        osc(arpChords[bar][s % 4], nextStep, 0.16, "square", vol.arp * 0.8);
        // melody (two-bar phrase)
        const mi = (Math.floor(step / 16) % 2) * 16 + s;
        if (melody[mi]) osc(melody[mi], nextStep, 0.22, "square", vol.mel, 4);
        // light drums
        if (vol.drums) {
          if (s % 8 === 0) noise(nextStep, 0.05, 0.05);      // kick-ish
          if (s % 8 === 4) noise(nextStep, 0.03, 0.03);      // snare-ish
        }
        // twinkle in love/ending scenes
        const T = getLoopT();
        if (T >= S2 && Math.random() < 0.04) osc(note.E5 * 2, nextStep, 0.2, "sine", 0.04);

        nextStep += stepDur;
        step++;
      }
    }

    function start() {
      init();
      if (ctx.state === "suspended") ctx.resume();
      if (!started) {
        started = true;
        nextStep = ctx.currentTime + 0.08;
        timer = setInterval(scheduler, 25);
      }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.6, ctx.currentTime + 0.6);
    }
    function setMuted(m) {
      muted = m;
      if (master) master.gain.linearRampToValueAtTime(m ? 0 : 0.6, ctx.currentTime + 0.15);
    }
    // one-shot SFX
    function chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [note.C5, note.E5, note.G5, note.E5 * 2].forEach((f, i) => osc(f, t + i * 0.09, 0.4, "sine", 0.09));
    }
    return { start, setMuted, chime, isMuted: () => muted };
  })();

  // ===================================================================
  //  MAIN LOOP
  // ===================================================================
  let running = false, startClock = 0, prev = 0, chimed = false;
  function getLoopT() { return ((performance.now() - startClock) / 1000) % LOOP; }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const T = ((now - startClock) / 1000) % LOOP;

    // magical chime exactly at the meeting beat
    if (T >= S2 - 4 && T < S2 - 3.9 && !chimed) { Audio.chime(); chimed = true; }
    if (T < 1) chimed = false;

    g.globalAlpha = 1;
    direct(T, dt);
    updateParticles(dt);
    drawScene(T);

    requestAnimationFrame(frame);
  }

  function startAnimation() {
    if (running) return;
    running = true;
    startClock = performance.now();
    prev = startClock;
    requestAnimationFrame(frame);
  }

  // Debug hook (used only for offline screenshot verification): jump to a
  // given loop time. Harmless in normal playback.
  window.__setT = function (t) { startClock = performance.now() - t * 1000; };

  // Deterministic single-frame render at absolute loop time `t`, advancing the
  // particle simulation by `dt`. Used for offline video capture (exact frame
  // pacing, no dropped frames). Not used during normal playback.
  window.__frame = function (t, dt) {
    g.globalAlpha = 1;
    direct(t, dt);
    updateParticles(dt);
    drawScene(t);
  };

  // ===================================================================
  //  POSTER (start-screen mini render of Clawd)
  // ===================================================================
  function drawPoster() {
    const pc = document.getElementById("poster");
    if (!pc) return;
    const pg = pc.getContext("2d");
    pg.imageSmoothingEnabled = false;
    pg.clearRect(0, 0, 96, 96);
    // repoint the active context at the poster canvas, draw, then restore
    g = pg;
    drawClawd(48, 80, { cell: 4.2, expr: "happy", blush: 0.85, armR: { ang: -1.2, len: 2.4 }, armL: { ang: 0.25, len: 2 }, legPhase: 0.6 });
    drawHeart(72, 24, 3, "#ff5a8a");
    drawHeart(22, 34, 2.4, "#ff87a9");
    drawSparkle(78, 52, 2.2, "#fffbdc");
    g = mainG;
  }

  // ---- Controls & bootstrap ----------------------------------------
  window.addEventListener("DOMContentLoaded", () => {
    chapterEl = document.getElementById("chapter");
    const startScreen = document.getElementById("startScreen");
    const controls = document.getElementById("controls");
    const startBtn = document.getElementById("startBtn");
    const startMuteBtn = document.getElementById("startMuteBtn");
    const muteBtn = document.getElementById("muteBtn");
    const fsBtn = document.getElementById("fsBtn");

    try { drawPoster(); } catch (e) { /* non-fatal */ }

    function begin(withSound) {
      startScreen.classList.add("hidden");
      controls.classList.remove("hidden");
      startAnimation();
      Audio.start();
      Audio.setMuted(!withSound);
      updateMuteIcon();
    }
    function updateMuteIcon() { muteBtn.textContent = Audio.isMuted() ? "🔇" : "🔊"; }

    startBtn.addEventListener("click", () => begin(true));
    startMuteBtn.addEventListener("click", () => begin(false));
    muteBtn.addEventListener("click", () => { Audio.setMuted(!Audio.isMuted()); updateMuteIcon(); });
    fsBtn.addEventListener("click", () => {
      const el = document.getElementById("stage");
      if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    });

    // Auto-hide controls after idle
    let idle;
    const showControls = () => { controls.classList.remove("hidden"); clearTimeout(idle); idle = setTimeout(() => controls.classList.add("faded"), 2600); };
    document.addEventListener("mousemove", showControls);
  });
})();

/* ------------------------------------------------------------------
   Dancing Invader
   The sprite in assets/dancer.webp is sliced into torso / arms / legs
   and re-assembled every frame as a rig, so the character can actually
   move its limbs instead of just wobbling as a flat picture.
   Choreography is driven by the beat grid in assets/beatdata.js, which
   was extracted offline from assets/track.mp3 (95.14 BPM, 16-beat
   phrases anchored at 10.08s). Every phrase = a new place + a new move.
------------------------------------------------------------------- */

(() => {
  'use strict';

  const B = window.BEAT_DATA;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('track');
  const gate = document.getElementById('gate');
  const startBtn = document.getElementById('start');
  const placeEl = document.getElementById('place');
  const moveEl = document.getElementById('move');
  const fillEl = document.getElementById('progress-fill');

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  /* ---------------- sprite geometry ----------------
     Measured from the 400x400 source. Origin is the hip line
     (201.5, 276): torso extends up from it, legs hang below it.   */
  const SPR = {
    torso: { sx: 72, sy: 91, sw: 259, sh: 185, dx: -129.5, dy: -185 },
    armL: { sx: 12, sy: 152, sw: 60, sh: 63, px: -129.5, py: -92.5, dx: -60, dy: -31.5 },
    armR: { sx: 331, sy: 152, sw: 58, sh: 63, px: 129.5, py: -92.5, dx: 0, dy: -31.5 },
    legs: [
      { sx: 72, sw: 35, px: -112 },
      { sx: 137, sw: 33, px: -48 },
      { sx: 231, sw: 33, px: 46 },
      { sx: 294, sw: 37, px: 111 }
    ],
    legY: 276, legH: 68,
    eyes: [{ x: -93.5, y: -156, w: 32, h: 32 }, { x: 60.5, y: -156, w: 33, h: 32 }],
    skin: '#f15c45'
  };

  // vertical centre of the assembled sprite, measured from the hip
  const PIVOT_Y = (SPR.torso.dy + SPR.legH) / 2;

  const sprite = new Image();
  sprite.src = 'assets/dancer.webp';

  /* ---------------- virtual stage ----------------
     Height is always 720 units; width stretches with the viewport so
     the scenes fill any aspect ratio without letterboxing.          */
  let VW = 1280, VH = 720, DPR = 1;
  const GROUND = 560;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    VH = 720;
    VW = 720 * (w / h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- music clock ---------------- */
  let ctBase = 0, perfBase = 0, lastCT = -1;

  function musicTime() {
    const now = performance.now() / 1000;
    const ct = audio.currentTime;
    if (ct !== lastCT) {
      lastCT = ct;
      const extrap = ctBase + (now - perfBase);
      // Re-sync hard on a seek, otherwise ease onto the real clock so
      // the beat never visibly stutters between currentTime updates.
      ctBase = Math.abs(extrap - ct) > 0.15 ? ct : lerp(extrap, ct, 0.12);
      perfBase = now;
    }
    if (audio.paused) return ctBase;
    return ctBase + (now - perfBase);
  }

  function beatState(t) {
    const bf = (t - B.beatZero) / B.beatPeriod;
    const i = Math.floor(bf);
    const phase = bf - i;
    const pf = bf / B.phraseBeats;
    return {
      t,
      beatFloat: bf,
      beat: i,
      phase,                                   // 0..1 within the beat
      bar: ((i % 4) + 4) % 4,
      barPhase: (((bf % 4) + 4) % 4) / 4,
      phrase: Math.floor(pf),
      phrasePhase: pf - Math.floor(pf),
      strength: B.strength[clamp(i, 0, B.strength.length - 1)] || 0,
      next: B.strength[clamp(i + 1, 0, B.strength.length - 1)] || 0
    };
  }

  function energyAt(t) {
    const i = t / 0.25;
    const a = B.energy[clamp(Math.floor(i), 0, B.energy.length - 1)] || 0;
    const b = B.energy[clamp(Math.floor(i) + 1, 0, B.energy.length - 1)] || 0;
    return lerp(a, b, i - Math.floor(i));
  }

  /* ---------------- live spectrum (optional garnish) ---------------- */
  let analyser = null, freq = null;

  function initAudioGraph() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      const src = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      analyser.connect(ac.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {
      // file:// or a blocked context — the embedded beat grid carries
      // the whole show on its own, so this is purely cosmetic.
      analyser = null;
    }
  }

  function spectrum(i, n, fallback) {
    if (analyser) {
      analyser.getByteFrequencyData(freq);
      const k = Math.floor((i / n) * (freq.length * 0.7));
      return freq[k] / 255;
    }
    return fallback;
  }

  /* ---------------- deterministic scene furniture ---------------- */
  let seed = 1337;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const stars = Array.from({ length: 260 }, () => ({
    x: rnd(), y: rnd(), r: rnd() * 1.8 + 0.4, tw: rnd() * TAU
  }));
  const buildings = Array.from({ length: 46 }, (_, i) => ({
    x: i, w: rnd() * 60 + 46, h: rnd() * 300 + 90, hue: rnd()
  }));
  const craters = Array.from({ length: 26 }, () => ({
    x: rnd(), y: rnd(), r: rnd() * 46 + 10
  }));
  const crowd = Array.from({ length: 90 }, () => ({
    x: rnd(), s: rnd() * 0.5 + 0.7, o: rnd() * TAU
  }));
  const drops = Array.from({ length: 220 }, () => ({
    x: rnd(), y: rnd(), l: rnd() * 26 + 14, sp: rnd() * 0.6 + 0.9
  }));
  const bubbles = Array.from({ length: 70 }, () => ({
    x: rnd(), y: rnd(), r: rnd() * 12 + 3, sp: rnd() * 0.5 + 0.35
  }));
  const embers = Array.from({ length: 90 }, () => ({
    x: rnd(), y: rnd(), r: rnd() * 3 + 1, sp: rnd() * 0.6 + 0.4
  }));

  /* ---------------- particles ---------------- */
  const parts = [];
  function burst(x, y, n, hue, spread) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, sp = rnd() * spread + spread * 0.3;
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - spread * 0.4,
        life: 1, r: rnd() * 5 + 2, hue
      });
    }
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vy += 26 * dt; p.life -= dt * 0.9;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }
  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.hue;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
    ctx.globalAlpha = 1;
  }

  /* =================================================================
     PLACES — one per 16-beat phrase, all drawn procedurally
     ================================================================= */

  function sky(cols) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function floor(color, y) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, VW, VH - y);
  }

  const PLACES = [
    { // 0 — intro
      name: 'DEEP SPACE',
      draw(s) {
        sky(['#06040f', '#160b2a', '#07050f']);
        for (const st of stars) {
          const tw = 0.55 + 0.45 * Math.sin(s.t * 2 + st.tw);
          ctx.globalAlpha = tw;
          ctx.fillStyle = '#fff';
          ctx.fillRect(st.x * VW, st.y * VH, st.r, st.r);
        }
        ctx.globalAlpha = 1;
        // slow planet
        const px = VW * 0.78, py = VH * 0.26, pr = 130;
        const g = ctx.createRadialGradient(px - 40, py - 40, 10, px, py, pr);
        g.addColorStop(0, '#ff9a76'); g.addColorStop(1, '#7a2d3e');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,170,.28)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 1.7, pr * 0.34, -0.35, 0, TAU);
        ctx.stroke();
      }
    },
    { // 1 — build
      name: 'NEON ROOFTOP',
      draw(s) {
        sky(['#0d0524', '#3b1150', '#7a1d4e']);
        const moon = { x: VW * 0.2, y: 130, r: 62 };
        ctx.fillStyle = '#ffe6c4';
        ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r + 26 + s.energy * 20, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        // skyline
        let x = -60;
        for (const b of buildings) {
          if (x > VW + 60) break;
          const h = b.h * (0.7 + 0.3 * b.hue);
          ctx.fillStyle = '#150a24';
          ctx.fillRect(x, GROUND - h, b.w, h + 200);
          // lit windows blink on the beat
          for (let wy = GROUND - h + 16; wy < GROUND - 20; wy += 26) {
            for (let wx = x + 10; wx < x + b.w - 12; wx += 22) {
              const k = Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453;
              const on = (k - Math.floor(k)) > 0.55 - s.kick * 0.2;
              if (!on) continue;
              ctx.fillStyle = (k % 3 | 0) === 0 ? '#ffd27a' : '#8ff4ff';
              ctx.globalAlpha = 0.55 + s.kick * 0.45;
              ctx.fillRect(wx, wy, 8, 11);
            }
          }
          ctx.globalAlpha = 1;
          x += b.w + 16;
        }
        floor('#0b0416', GROUND);
        ctx.strokeStyle = 'rgba(255,90,140,' + (0.4 + s.kick * 0.6) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(VW, GROUND); ctx.stroke();
      }
    },
    { // 2 — drop A
      name: 'THE CLUB',
      draw(s) {
        sky(['#0a0512', '#1a0a2e', '#0a0512']);
        // sweeping light beams, one per bar
        for (let i = 0; i < 6; i++) {
          const a = Math.sin(s.t * 1.1 + i * 1.05) * 0.7;
          const hue = (i * 60 + s.phrase * 40) % 360;
          ctx.save();
          ctx.translate(VW * (0.1 + i * 0.16), -40);
          ctx.rotate(a);
          const g = ctx.createLinearGradient(0, 0, 0, VH);
          g.addColorStop(0, `hsla(${hue},95%,62%,${0.5 + s.kick * 0.4})`);
          g.addColorStop(1, 'hsla(' + hue + ',95%,62%,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(-120, VH); ctx.lineTo(120, VH);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // checker dance floor in perspective, tiles lighting up on the beat
        floor('#0d0616', GROUND);
        const rows = 12, beatN = Math.floor(s.beatFloat);
        for (let r = 0; r < rows; r++) {
          const y0 = GROUND + (VH - GROUND) * (r / rows) ** 1.7;
          const y1 = GROUND + (VH - GROUND) * ((r + 1) / rows) ** 1.7;
          const cw = 46 + r * r * 4.5;
          const cols = Math.ceil(VW / cw) + 2;
          for (let c = -1; c < cols; c++) {
            if ((c + r + beatN) % 2 !== 0) continue;
            const hue = (beatN * 47 + r * 14) % 360;
            ctx.fillStyle = `hsla(${hue},85%,60%,${0.2 + s.kick * 0.55})`;
            ctx.fillRect(c * cw, y0, cw + 1, y1 - y0 + 1);
          }
        }
        // mirror ball
        const bx = VW / 2, by = 96, br = 46 + s.kick * 8;
        ctx.fillStyle = '#cfd6e6';
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
        for (let i = 0; i < 22; i++) {
          const a = i * 0.9 + s.t * 0.8;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = `hsl(${(i * 30) % 360},90%,70%)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a) * VW, by + Math.abs(Math.sin(a)) * VH);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },
    { // 3 — drop A
      name: 'GRID HORIZON',
      draw(s) {
        sky(['#1a0533', '#5c1160', '#ff4d6d']);
        // retro sun with scanline slots
        const sx = VW / 2, sy = GROUND - 90, sr = 165;
        const g = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
        g.addColorStop(0, '#ffe66d'); g.addColorStop(1, '#ff2e63');
        ctx.save();
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.clip();
        ctx.fillStyle = g; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        ctx.fillStyle = '#1a0533';
        for (let i = 0; i < 9; i++) {
          const yy = sy + i * 19 - 10;
          ctx.fillRect(sx - sr, yy, sr * 2, 4 + i * 1.6);
        }
        ctx.restore();
        floor('#12042a', GROUND);
        // perspective grid scrolling on the beat
        ctx.strokeStyle = `rgba(255,60,160,${0.55 + s.kick * 0.45})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 22; i++) {
          const p = ((i + s.beatFloat * 0.25) % 22) / 22;
          const y = GROUND + (VH - GROUND) * p ** 2.2;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
        }
        for (let i = -14; i <= 14; i++) {
          ctx.beginPath();
          ctx.moveTo(VW / 2 + i * 34, GROUND);
          ctx.lineTo(VW / 2 + i * VW * 0.34, VH);
          ctx.stroke();
        }
      }
    },
    { // 4 — breakdown
      name: 'SUNSET BEACH',
      draw(s) {
        sky(['#2b1055', '#d64161', '#ff9a5c']);
        const sunY = GROUND - 60;
        ctx.fillStyle = '#ffd36e';
        ctx.beginPath(); ctx.arc(VW * 0.62, sunY, 110, 0, TAU); ctx.fill();
        // sea
        const g = ctx.createLinearGradient(0, GROUND - 40, 0, VH);
        g.addColorStop(0, '#3a1e6d'); g.addColorStop(1, '#150a35');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND - 40, VW, VH);
        for (let i = 0; i < 26; i++) {
          const y = GROUND - 34 + i * 8;
          const w = 40 + i * 12;
          ctx.globalAlpha = 0.16 + 0.1 * Math.sin(s.t * 2 + i);
          ctx.fillStyle = '#ffd36e';
          for (let x = -w; x < VW; x += w * 2.2) {
            ctx.fillRect(x + Math.sin(s.t * 1.4 + i) * 26, y, w, 3);
          }
        }
        ctx.globalAlpha = 1;
        // sand
        ctx.fillStyle = '#e8b17a';
        ctx.beginPath();
        ctx.moveTo(0, GROUND + 34);
        ctx.quadraticCurveTo(VW / 2, GROUND + 8, VW, GROUND + 34);
        ctx.lineTo(VW, VH); ctx.lineTo(0, VH); ctx.fill();
        // palm
        ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        const bend = Math.sin(s.t * 0.9) * 16;
        ctx.beginPath();
        ctx.moveTo(VW * 0.12, GROUND + 60);
        ctx.quadraticCurveTo(VW * 0.10, GROUND - 100, VW * 0.15 + bend, GROUND - 210);
        ctx.stroke();
        ctx.fillStyle = '#1f6b3a';
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.44 + Math.sin(s.t + i) * 0.05;
          ctx.save();
          ctx.translate(VW * 0.15 + bend, GROUND - 210);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.ellipse(78, 0, 80, 17, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    },
    { // 5 — build 2
      name: 'RAIN ALLEY',
      draw(s) {
        sky(['#050810', '#0b1524', '#101c2e']);
        // walls
        ctx.fillStyle = '#0a1220';
        ctx.fillRect(0, 0, VW * 0.22, GROUND + 40);
        ctx.fillRect(VW * 0.78, 0, VW * 0.22, GROUND + 40);
        // neon signs pulsing on the beat
        const signs = [
          { x: VW * 0.06, y: 190, w: 120, h: 46, c: '#ff2e63', txt: 'OPEN' },
          { x: VW * 0.03, y: 300, w: 150, h: 40, c: '#33e1ff', txt: 'RAMEN' },
          { x: VW * 0.82, y: 160, w: 130, h: 52, c: '#b967ff', txt: 'BAR' },
          { x: VW * 0.84, y: 320, w: 110, h: 38, c: '#5cff9d', txt: '24H' }
        ];
        for (const sg of signs) {
          const on = 0.45 + s.kick * 0.55;
          ctx.globalAlpha = on;
          ctx.shadowColor = sg.c; ctx.shadowBlur = 34;
          ctx.strokeStyle = sg.c; ctx.lineWidth = 4;
          ctx.strokeRect(sg.x, sg.y, sg.w, sg.h);
          ctx.fillStyle = sg.c;
          ctx.font = 'bold 22px ui-monospace, monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(sg.txt, sg.x + sg.w / 2, sg.y + sg.h / 2);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
        // wet ground with reflections
        floor('#070d16', GROUND);
        ctx.globalAlpha = 0.2;
        for (const sg of signs) {
          ctx.fillStyle = sg.c;
          ctx.fillRect(sg.x, GROUND, sg.w, VH - GROUND);
        }
        ctx.globalAlpha = 1;
        // rain
        ctx.strokeStyle = 'rgba(180,220,255,.42)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (const d of drops) {
          const y = ((d.y + s.t * d.sp * 0.55) % 1) * VH;
          const x = d.x * VW + y * 0.12;
          ctx.moveTo(x, y); ctx.lineTo(x - 4, y + d.l);
        }
        ctx.stroke();
      }
    },
    { // 6 — drop B
      name: 'VOLCANO',
      draw(s) {
        sky(['#1a0405', '#4a0d10', '#8f1d10']);
        // cone
        ctx.fillStyle = '#210708';
        ctx.beginPath();
        ctx.moveTo(VW * 0.5 - 420, GROUND);
        ctx.lineTo(VW * 0.5 - 90, 150);
        ctx.lineTo(VW * 0.5 + 90, 150);
        ctx.lineTo(VW * 0.5 + 420, GROUND);
        ctx.fill();
        // eruption keyed to kick strength
        const jet = s.kick;
        ctx.fillStyle = '#ffb347';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(VW * 0.5 - 70, 150);
        ctx.lineTo(VW * 0.5, 150 - 220 * jet);
        ctx.lineTo(VW * 0.5 + 70, 150);
        ctx.fill();
        ctx.globalAlpha = 1;
        // lava river
        const g = ctx.createLinearGradient(0, GROUND - 20, 0, VH);
        g.addColorStop(0, '#ff8a2b'); g.addColorStop(0.5, '#ff3c14'); g.addColorStop(1, '#7a0d05');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND, VW, VH - GROUND);
        for (let i = 0; i < 9; i++) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#2a0a06';
          const y = GROUND + 20 + i * 22;
          ctx.beginPath();
          ctx.ellipse((i * 260 + s.t * 30) % (VW + 300) - 150, y, 120, 12, 0, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // embers
        for (const e of embers) {
          const y = VH - ((e.y + s.t * e.sp * 0.18) % 1) * VH;
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ffcf6b';
          ctx.fillRect(e.x * VW + Math.sin(s.t + e.y * 9) * 20, y, e.r, e.r);
        }
        ctx.globalAlpha = 1;
      }
    },
    { // 7 — drop B
      name: 'UNDER THE SEA',
      draw(s) {
        sky(['#022a4a', '#023a63', '#01121f']);
        // caustic light shafts
        for (let i = 0; i < 7; i++) {
          const x = VW * (i / 7) + Math.sin(s.t * 0.6 + i) * 40;
          ctx.globalAlpha = 0.12 + 0.08 * Math.sin(s.t * 1.6 + i);
          const g = ctx.createLinearGradient(x, 0, x + 90, VH);
          g.addColorStop(0, '#9ef0ff'); g.addColorStop(1, 'rgba(158,240,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - 40, 0); ctx.lineTo(x + 70, 0);
          ctx.lineTo(x + 190, VH); ctx.lineTo(x - 130, VH);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const b of bubbles) {
          const y = VH - ((b.y + s.t * b.sp * 0.14) % 1) * VH;
          ctx.strokeStyle = 'rgba(190,245,255,.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x * VW + Math.sin(s.t * 1.2 + b.y * 20) * 18, y, b.r, 0, TAU);
          ctx.stroke();
        }
        // seabed
        ctx.fillStyle = '#0a2036';
        ctx.beginPath();
        ctx.moveTo(0, GROUND + 40);
        for (let x = 0; x <= VW; x += 60) {
          ctx.lineTo(x, GROUND + 30 + Math.sin(x * 0.01) * 22);
        }
        ctx.lineTo(VW, VH); ctx.lineTo(0, VH); ctx.fill();
        // seaweed swaying with the beat
        ctx.strokeStyle = '#12704f'; ctx.lineWidth = 11; ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const x = (i + 0.5) * (VW / 9);
          ctx.beginPath();
          ctx.moveTo(x, GROUND + 60);
          ctx.quadraticCurveTo(
            x + Math.sin(s.t * 1.5 + i) * 46, GROUND - 40,
            x + Math.sin(s.t * 1.5 + i) * 76, GROUND - 150
          );
          ctx.stroke();
        }
      }
    },
    { // 8 — drop B
      name: 'MOON SURFACE',
      draw(s) {
        sky(['#02030a', '#080d1c', '#0d1424']);
        for (const st of stars) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 3 + st.tw);
          ctx.fillStyle = '#fff';
          ctx.fillRect(st.x * VW, st.y * GROUND, st.r, st.r);
        }
        ctx.globalAlpha = 1;
        // earthrise
        const ex = VW * 0.8, ey = 160, er = 84;
        const g = ctx.createRadialGradient(ex - 26, ey - 26, 8, ex, ey, er);
        g.addColorStop(0, '#7ec8ff'); g.addColorStop(0.6, '#2a6fd6'); g.addColorStop(1, '#10306a');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,200,140,.55)';
        ctx.beginPath(); ctx.ellipse(ex - 20, ey + 10, 34, 20, 0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex + 30, ey - 24, 22, 14, -0.3, 0, TAU); ctx.fill();
        // regolith
        ctx.fillStyle = '#b9b3ac';
        ctx.beginPath();
        ctx.moveTo(0, GROUND + 20);
        for (let x = 0; x <= VW; x += 80) {
          ctx.lineTo(x, GROUND + 10 + Math.sin(x * 0.006) * 26);
        }
        ctx.lineTo(VW, VH); ctx.lineTo(0, VH); ctx.fill();
        for (const c of craters) {
          const cx = c.x * VW, cy = GROUND + 60 + c.y * (VH - GROUND - 60);
          ctx.fillStyle = '#a29c96';
          ctx.beginPath(); ctx.ellipse(cx, cy, c.r, c.r * 0.36, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#8e8882';
          ctx.beginPath(); ctx.ellipse(cx, cy + 3, c.r * 0.72, c.r * 0.24, 0, 0, TAU); ctx.fill();
        }
      }
    },
    { // 9 — drop B finale
      name: 'MAIN STAGE',
      draw(s) {
        sky(['#0b0416', '#1c0730', '#2a0a3f']);
        // rig lights
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
          const hue = (i * 45 + Math.floor(s.beatFloat) * 30) % 360;
          const x = VW * (i + 0.5) / 8 + Math.sin(s.t * 0.9 + i) * 40;
          const g = ctx.createLinearGradient(x, 40, x, GROUND);
          g.addColorStop(0, `hsla(${hue},95%,65%,${0.32 + s.kick * 0.38})`);
          g.addColorStop(1, `hsla(${hue},95%,65%,0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - 12, 40); ctx.lineTo(x + 12, 40);
          ctx.lineTo(x + 120, GROUND); ctx.lineTo(x - 120, GROUND);
          ctx.fill();
        }
        ctx.restore();
        // truss
        ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(VW, 40); ctx.stroke();
        // stage deck
        floor('#160a22', GROUND);
        ctx.fillStyle = '#241036';
        ctx.fillRect(0, GROUND, VW, 14);
        // crowd silhouettes in the pit, bobbing on the beat
        const bob = Math.abs(Math.sin(s.beatFloat * Math.PI));
        ctx.fillStyle = '#05020a';
        for (const p of crowd) {
          const x = p.x * VW;
          const sc = p.s * 0.62;
          const y = VH + 26 - Math.sin(s.beatFloat * Math.PI + p.o) * bob * 12;
          ctx.beginPath(); ctx.arc(x, y - 130 * sc, 20 * sc, 0, TAU); ctx.fill();
          ctx.fillRect(x - 20 * sc, y - 115 * sc, 40 * sc, 130 * sc);
          const raise = 1 + Math.sin(s.beatFloat * Math.PI + p.o) * 0.35;
          ctx.fillRect(x - 30 * sc, y - 190 * sc * raise, 9 * sc, 90 * sc * raise);
          ctx.fillRect(x + 21 * sc, y - 190 * sc * raise, 9 * sc, 90 * sc * raise);
        }
      }
    },
    { // 10 — outro
      name: 'BACK TO SPACE',
      draw(s) { PLACES[0].draw(s); }
    }
  ];

  /* =================================================================
     MOVES — one per phrase. Each fills the rig for the current frame.
     ================================================================= */

  function blankRig() {
    return {
      x: 0, y: 0, rot: 0, sx: 1, sy: 1, torso: 0,
      armL: 0, armR: 0,
      legRot: [0, 0, 0, 0], legLift: [0, 0, 0, 0],
      blink: 0, glow: 0, flip: 1
    };
  }

  // sharp attack on the beat that decays away — the "thump"
  const thump = p => (1 - p) ** 3;

  const MOVES = [
    { name: 'float', fn(r, s) {                    // 0 intro
      r.y = -Math.sin(s.t * 1.1) * 26 - 40;
      r.rot = Math.sin(s.t * 0.7) * 0.1;
      r.x = Math.sin(s.t * 0.42) * VW * 0.16;
      r.armL = Math.sin(s.t * 1.1) * 0.5 - 0.3;
      r.armR = -Math.sin(s.t * 1.1) * 0.5 + 0.3;
      for (let i = 0; i < 4; i++) r.legRot[i] = Math.sin(s.t * 1.2 + i * 0.7) * 0.24;
    } },
    { name: 'step touch', fn(r, s) {               // 1 build
      const d = s.bar < 2 ? 1 : -1;
      const sw = Math.sin(s.barPhase * TAU);
      r.x = sw * VW * 0.1;
      r.y = -Math.abs(Math.sin(s.beatFloat * Math.PI)) * 26;
      r.rot = sw * 0.12;
      r.torso = -sw * 0.08;
      r.armL = -0.7 + sw * 0.6;
      r.armR = 0.7 + sw * 0.6;
      const lift = Math.max(0, Math.sin(s.beatFloat * Math.PI)) * 26;
      r.legLift[d > 0 ? 0 : 3] = lift;
      r.legLift[d > 0 ? 1 : 2] = lift * 0.5;
      r.glow = thump(s.phase) * s.strength;
    } },
    { name: 'bounce', fn(r, s) {                   // 2 drop A
      const t2 = thump(s.phase) * (0.4 + s.strength);
      r.y = -Math.abs(Math.sin(s.beatFloat * Math.PI)) * 46;
      r.sy = 1 - t2 * 0.2; r.sx = 1 + t2 * 0.16;
      r.rot = Math.sin(s.beatFloat * Math.PI / 2) * 0.16;
      r.torso = -Math.sin(s.beatFloat * Math.PI) * 0.12;
      r.armL = -1.1 - Math.sin(s.beatFloat * Math.PI) * 0.7;
      r.armR = 1.1 + Math.sin(s.beatFloat * Math.PI) * 0.7;
      for (let i = 0; i < 4; i++) {
        r.legRot[i] = Math.sin(s.beatFloat * Math.PI + i * 0.9) * 0.34;
        r.legLift[i] = Math.max(0, Math.sin(s.beatFloat * Math.PI + i * 0.9)) * 22;
      }
      r.x = Math.sin(s.phrasePhase * TAU) * VW * 0.14;
      r.glow = t2;
    } },
    { name: 'spin', fn(r, s) {                     // 3 drop A
      const spinning = s.bar === 3;
      r.rot = spinning ? s.phase * TAU : Math.sin(s.beatFloat * Math.PI) * 0.2;
      r.flip = spinning ? 1 : (Math.floor(s.beatFloat / 2) % 2 ? -1 : 1);
      r.y = -Math.abs(Math.sin(s.beatFloat * Math.PI)) * 34;
      r.armL = -1.5; r.armR = 1.5;
      for (let i = 0; i < 4; i++) {
        r.legRot[i] = Math.sin(s.beatFloat * Math.PI * 2 + i) * 0.4;
        r.legLift[i] = Math.max(0, Math.sin(s.beatFloat * Math.PI * 2 + i)) * 18;
      }
      r.x = Math.sin(s.phrasePhase * TAU * 2) * VW * 0.2;
      r.glow = thump(s.phase) * s.strength;
    } },
    { name: 'moonwalk', fn(r, s) {                 // 4 breakdown
      const dir = s.phrasePhase < 0.5 ? -1 : 1;
      r.flip = dir;
      r.x = lerp(VW * 0.22, -VW * 0.22, s.phrasePhase < 0.5
        ? s.phrasePhase * 2 : 1 - (s.phrasePhase - 0.5) * 2);
      r.y = -6 - Math.abs(Math.sin(s.beatFloat * Math.PI)) * 8;
      r.rot = dir * 0.07;
      r.torso = -dir * 0.1;
      r.armL = -0.5 + Math.sin(s.beatFloat * Math.PI) * 0.3;
      r.armR = 0.5 + Math.sin(s.beatFloat * Math.PI) * 0.3;
      // sliding feet: one drags while the other picks up
      for (let i = 0; i < 4; i++) {
        const ph = s.beatFloat * Math.PI + (i % 2) * Math.PI;
        r.legRot[i] = Math.sin(ph) * 0.45 * dir;
        r.legLift[i] = Math.max(0, Math.sin(ph)) * 14;
      }
      r.glow = thump(s.phase) * 0.3;
    } },
    { name: 'running man', fn(r, s) {              // 5 build 2
      const f = s.beatFloat * 2;
      r.y = -Math.abs(Math.sin(f * Math.PI)) * 30;
      r.rot = Math.sin(f * Math.PI) * 0.1;
      r.torso = 0.14;
      r.armL = -0.9 + Math.sin(f * Math.PI) * 1.1;
      r.armR = 0.9 - Math.sin(f * Math.PI) * 1.1;
      for (let i = 0; i < 4; i++) {
        const ph = f * Math.PI + (i < 2 ? 0 : Math.PI);
        r.legRot[i] = Math.sin(ph) * 0.6;
        r.legLift[i] = Math.max(0, Math.sin(ph)) * 34;
      }
      r.x = Math.sin(s.phrasePhase * TAU) * VW * 0.18;
      r.glow = thump(s.phase) * s.strength;
    } },
    { name: 'headbang', fn(r, s) {                 // 6 drop B
      const t2 = thump(s.phase) * (0.5 + s.strength);
      r.torso = 0.34 * Math.abs(Math.sin(s.beatFloat * Math.PI)) - 0.1;
      r.y = -Math.abs(Math.sin(s.beatFloat * Math.PI)) * 20;
      r.sy = 1 - t2 * 0.26; r.sx = 1 + t2 * 0.2;
      r.rot = Math.sin(s.beatFloat * Math.PI * 0.5) * 0.1;
      r.armL = -2.2 + Math.sin(s.beatFloat * Math.PI) * 0.5;
      r.armR = 2.2 - Math.sin(s.beatFloat * Math.PI) * 0.5;
      for (let i = 0; i < 4; i++) r.legRot[i] = Math.sin(s.beatFloat * Math.PI + i) * 0.16;
      r.x = Math.sin(s.phrasePhase * TAU * 1.5) * VW * 0.12;
      r.glow = t2;
    } },
    { name: 'jellyfish', fn(r, s) {                // 7 drop B
      r.y = -110 - Math.sin(s.beatFloat * Math.PI) * 60;
      r.sy = 1 + Math.sin(s.beatFloat * Math.PI) * 0.18;
      r.sx = 1 - Math.sin(s.beatFloat * Math.PI) * 0.14;
      r.rot = Math.sin(s.t * 1.3) * 0.16;
      r.armL = -1.8 + Math.sin(s.beatFloat * Math.PI) * 1.1;
      r.armR = 1.8 - Math.sin(s.beatFloat * Math.PI) * 1.1;
      for (let i = 0; i < 4; i++) {
        r.legRot[i] = Math.sin(s.beatFloat * Math.PI + i * 0.6) * 0.7;
        r.legLift[i] = Math.sin(s.beatFloat * Math.PI + i * 0.6) * 10;
      }
      r.x = Math.sin(s.phrasePhase * TAU) * VW * 0.22;
      r.glow = thump(s.phase) * s.strength * 0.8;
    } },
    { name: 'low gravity', fn(r, s) {              // 8 drop B
      // one big slow hop every 2 beats
      const h = ((s.beatFloat % 2) + 2) % 2 / 2;
      r.y = -Math.sin(h * Math.PI) * 210;
      r.rot = h * TAU * 0.5 * (Math.floor(s.beatFloat / 2) % 2 ? -1 : 1);
      const land = thump(s.phase) * (h < 0.1 ? 1 : 0);
      r.sy = 1 - land * 0.3; r.sx = 1 + land * 0.24;
      r.armL = -2 - Math.sin(h * Math.PI) * 0.6;
      r.armR = 2 + Math.sin(h * Math.PI) * 0.6;
      for (let i = 0; i < 4; i++) {
        r.legRot[i] = Math.sin(h * Math.PI) * 0.5 * (i < 2 ? 1 : -1);
        r.legLift[i] = Math.sin(h * Math.PI) * 26;
      }
      r.x = Math.sin(s.phrasePhase * TAU) * VW * 0.24;
      r.glow = thump(s.phase) * s.strength;
    } },
    { name: 'go off', fn(r, s) {                   // 9 finale
      const t2 = thump(s.phase) * (0.5 + s.strength);
      const spin = s.bar === 3 ? s.phase * TAU : 0;
      r.y = -Math.abs(Math.sin(s.beatFloat * Math.PI)) * 64;
      r.rot = spin + Math.sin(s.beatFloat * Math.PI) * 0.24;
      r.sy = 1 - t2 * 0.24; r.sx = 1 + t2 * 0.2;
      r.torso = -Math.sin(s.beatFloat * Math.PI * 2) * 0.18;
      r.armL = -2.4 - Math.sin(s.beatFloat * Math.PI * 2) * 0.9;
      r.armR = 2.4 + Math.sin(s.beatFloat * Math.PI * 2) * 0.9;
      for (let i = 0; i < 4; i++) {
        const ph = s.beatFloat * Math.PI * 2 + i * 0.8;
        r.legRot[i] = Math.sin(ph) * 0.65;
        r.legLift[i] = Math.max(0, Math.sin(ph)) * 40;
      }
      r.x = Math.sin(s.phrasePhase * TAU * 2) * VW * 0.26;
      r.glow = t2;
    } },
    { name: 'drifting off', fn(r, s) {             // 10 outro
      const p = clamp(s.phrasePhase * 2, 0, 1);
      r.y = -40 - p * 260 - Math.sin(s.t * 1.1) * 20;
      r.rot = Math.sin(s.t * 0.8) * 0.2;
      r.x = Math.sin(s.t * 0.5) * VW * 0.14;
      r.armL = -0.4 + Math.sin(s.t) * 0.5;
      r.armR = 0.4 - Math.sin(s.t) * 0.5;
      for (let i = 0; i < 4; i++) r.legRot[i] = Math.sin(s.t * 1.4 + i) * 0.3;
    } }
  ];

  /* ---------------- character rendering ---------------- */

  function drawCharacter(r, s, scale) {
    const hipX = VW / 2 + r.x;
    const hipY = GROUND - SPR.legH * scale + r.y;

    // ground shadow — shrinks as the character leaves the floor
    const air = clamp(-r.y / 220, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.34 * (1 - air * 0.75);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(VW / 2 + r.x * 0.9, GROUND + 6,
      120 * scale * (1 - air * 0.4), 20 * scale * (1 - air * 0.5), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.scale(scale * r.sx * r.flip, scale * r.sy);
    // spin around the sprite's own centre rather than the hip, so a full
    // rotation reads as the character spinning instead of swinging
    ctx.translate(0, PIVOT_Y);
    ctx.rotate(r.rot);
    ctx.translate(0, -PIVOT_Y);

    if (r.glow > 0.02) {
      ctx.shadowColor = SPR.skin;
      ctx.shadowBlur = 40 * r.glow;
    }

    // legs first so the torso overlaps the hip joints
    SPR.legs.forEach((lg, i) => {
      ctx.save();
      ctx.translate(lg.px, -r.legLift[i]);
      ctx.rotate(r.legRot[i]);
      ctx.drawImage(sprite, lg.sx, SPR.legY, lg.sw, SPR.legH,
        -lg.sw / 2, 0, lg.sw, SPR.legH);
      ctx.restore();
    });

    // arms
    const arm = (a, ang) => {
      ctx.save();
      ctx.translate(a.px, a.py);
      ctx.rotate(ang);
      ctx.drawImage(sprite, a.sx, a.sy, a.sw, a.sh, a.dx, a.dy, a.sw, a.sh);
      ctx.restore();
    };
    arm(SPR.armL, r.armL);
    arm(SPR.armR, r.armR);

    // torso (leans from the hip)
    ctx.save();
    ctx.rotate(r.torso);
    const T = SPR.torso;
    ctx.drawImage(sprite, T.sx, T.sy, T.sw, T.sh, T.dx, T.dy, T.sw, T.sh);
    // blink: paint over the eyes in body colour, leave a squint line
    if (r.blink > 0.5) {
      ctx.shadowBlur = 0;
      for (const e of SPR.eyes) {
        ctx.fillStyle = SPR.skin;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#111';
        ctx.fillRect(e.x, e.y + e.h * 0.45, e.w, e.h * 0.18);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- main loop ---------------- */

  let prev = performance.now() / 1000;
  let lastBeat = -999, lastPhrase = -999, flash = 0, wipe = 0;
  let blinkUntil = 0, nextBlink = 2;

  let captureMode = false;

  function frame() {
    requestAnimationFrame(frame);
    if (captureMode) return;          // an offline capture owns the canvas
    const now = performance.now() / 1000;
    const dt = Math.min(now - prev, 0.05);
    prev = now;
    renderFrame(musicTime(), dt, now);
  }

  function renderFrame(t, dt, now) {
    const bs = beatState(t);
    const energy = energyAt(t);
    const phraseIdx = clamp(bs.phrase, 0, PLACES.length - 1);
    const place = PLACES[phraseIdx];
    const move = MOVES[clamp(phraseIdx, 0, MOVES.length - 1)];

    // beat events
    if (bs.beat !== lastBeat) {
      lastBeat = bs.beat;
      if (bs.strength > 0.5) flash = Math.min(1, bs.strength);
      if (bs.strength > 0.45) {
        burst(VW / 2, GROUND - 40, Math.round(6 + bs.strength * 16),
          ['#ffd166', '#ff5c45', '#8ff4ff', '#b967ff'][bs.beat % 4], 7);
      }
      if (now > nextBlink) { blinkUntil = now + 0.14; nextBlink = now + 1.6 + rnd() * 3.4; }
    }
    if (bs.phrase !== lastPhrase) {
      lastPhrase = bs.phrase;
      wipe = 1;
    }
    flash = Math.max(0, flash - dt * 3.2);
    wipe = Math.max(0, wipe - dt * 2.4);

    const s = {
      t, beatFloat: bs.beatFloat, phase: bs.phase, bar: bs.bar,
      barPhase: bs.barPhase, phrase: phraseIdx, phrasePhase: bs.phrasePhase,
      strength: bs.strength, energy,
      kick: clamp(thump(bs.phase) * (0.35 + bs.strength) + energy * 0.25, 0, 1)
    };

    // ---- render ----
    ctx.setTransform(DPR * (window.innerHeight / VH), 0, 0,
      DPR * (window.innerHeight / VH), 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    place.draw(s);

    // soft haze on the floor line that swells with the track's energy
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haze = ctx.createLinearGradient(0, GROUND - 90, 0, GROUND + 10);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, `rgba(255,235,220,${0.05 + energy * 0.12 + s.kick * 0.06})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, GROUND - 90, VW, 100);
    ctx.restore();

    const r = blankRig();
    move.fn(r, s);
    r.blink = now < blinkUntil ? 1 : 0;

    const scale = 0.85 * (1 + s.kick * 0.05);
    stepParts(dt);
    drawCharacter(r, s, scale);
    drawParts();

    // beat flash + phrase wipe
    if (flash > 0.01) {
      ctx.globalAlpha = flash * 0.16;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
    if (wipe > 0.01) {
      const w = ease(1 - wipe);
      ctx.fillStyle = '#0b0b10';
      ctx.fillRect(VW * w, 0, VW, VH);
      ctx.fillStyle = SPR.skin;
      ctx.fillRect(VW * w - 14, 0, 14, VH);
    }

    // HUD
    if (placeEl.textContent !== place.name) placeEl.textContent = place.name;
    const label = move.name + '  ·  ' + Math.round(B.bpm) + ' BPM';
    if (moveEl.textContent !== label) moveEl.textContent = label;
    fillEl.style.width = (audio.duration ? (t / audio.duration) * 100 : 0) + '%';
  }

  // Deterministic capture hook — tools/record.js drives this to render
  // the exact same animation frame by frame for the MP4 export.
  window.__renderAt = (t, dt) => {
    captureMode = true;
    renderFrame(t, dt, t);
  };

  /* ---------------- controls ---------------- */

  function start() {
    initAudioGraph();
    audio.currentTime = 0;
    audio.play().catch(() => {});
    gate.classList.add('hidden');
    document.body.classList.add('playing');
  }

  startBtn.addEventListener('click', start);

  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (gate.classList.contains('hidden')) audio.paused ? audio.play() : audio.pause();
      else start();
    }
    if (e.key === 'm' || e.key === 'M') audio.muted = !audio.muted;
  });

  let started = false;
  function boot() {
    if (started) return;
    started = true;
    requestAnimationFrame(frame);
  }
  sprite.onload = boot;
  if (sprite.complete && sprite.naturalWidth) boot();
})();

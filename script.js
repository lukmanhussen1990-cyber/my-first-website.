(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const W = 941;
  const H = 1672;
  const CX = 470;
  const CY = 810;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }

  const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const mirror = ([x, y]) => [940 - x, y];

  // ---------- Thorns and horns on the ring ----------

  // One curved thorn. Base centre at (0,0), pointing up (-y), tip bent by `bend`.
  function thorn(parent, x, y, rotation, len, width, bend) {
    const w = width / 2;
    const tip = [bend, -len];
    const outline = `M${-w},4 Q${-w * 0.35 + bend * 0.15},${-len * 0.55} ${pt(tip)} Q${w * 0.3 + bend * 0.45},${-len * 0.5} ${w},4 Z`;
    const light = `M${-w},4 Q${-w * 0.35 + bend * 0.15},${-len * 0.55} ${pt(tip)} Q${bend * 0.4},${-len * 0.45} 0,4 Z`;
    const g = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)})` }, parent);
    el('path', { d: outline, fill: 'none', stroke: '#ff1a1a', 'stroke-width': 5, filter: 'url(#fGlow)' }, g);
    el('path', { d: outline, fill: 'url(#gFacetDark)' }, g);
    el('path', { d: light, fill: 'url(#gFacetLight)' }, g);
    el('path', { d: outline, fill: 'none', stroke: '#ff5a5a', 'stroke-width': 1.2 }, g);
  }

  // Thorn sitting on the ring's outer edge at screen angle `deg`, leaning by `lean`.
  function ringThorn(parent, deg, len, width, bend, lean) {
    const a = (deg * Math.PI) / 180;
    const r = 322;
    thorn(parent, CX + Math.cos(a) * r, CY + Math.sin(a) * r, deg + 90 + lean, len, width, bend);
  }

  const thorns = document.getElementById('thorns');
  [
    // [angle, length, width, bend, lean] for the left half; mirrored for the right
    [236, 128, 44, -12, 22],
    [252, 64, 26, -4, 4],
    [262, 34, 18, 2, -4],
    [155, 40, 22, 6, 8],
    [104, 44, 22, -6, 10],
    [138, 32, 18, 4, 0],
  ].forEach(([deg, len, w, bend, lean]) => {
    ringThorn(thorns, deg, len, w, bend, lean);
    ringThorn(thorns, 540 - deg, len, w, -bend, -lean);
  });

  // ---------- Chains ----------

  function catmullRom(points, samplesPerSegment) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      for (let s = 0; s < samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([0, 1].map((k) => 0.5 * (
          2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3
        )));
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  // Walk along the spline and return evenly spaced points with tangent angles.
  function spaced(points, step) {
    const dense = catmullRom(points, 40);
    const result = [];
    let travelled = 0;
    let next = 0;
    for (let i = 1; i < dense.length; i++) {
      const [x0, y0] = dense[i - 1];
      const [x1, y1] = dense[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (seg === 0) continue;
      const angle = Math.atan2(y1 - y0, x1 - x0);
      while (next <= travelled + seg) {
        const t = (next - travelled) / seg;
        result.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: angle });
        next += step;
      }
      travelled += seg;
    }
    return result;
  }

  function chainLink(parent, { x, y, a }, faceOn) {
    const g = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI).toFixed(1)})` }, parent);
    if (faceOn) {
      // Ellipse perimeter is ~116 units; dashes place a highlight top-left and a red glint bottom-right
      el('ellipse', { rx: 23, ry: 14, fill: 'none', stroke: '#000', 'stroke-width': 13 }, g);
      el('ellipse', { rx: 23, ry: 14, fill: 'none', stroke: 'url(#gLink)', 'stroke-width': 9 }, g);
      el('ellipse', { rx: 23, ry: 14, fill: 'none', stroke: 'rgba(255,255,255,.9)', 'stroke-width': 2, 'stroke-dasharray': '28 88', 'stroke-dashoffset': -60, 'stroke-linecap': 'round' }, g);
      el('ellipse', { rx: 23, ry: 14, fill: 'none', stroke: '#ff3434', 'stroke-width': 2.2, 'stroke-dasharray': '26 90', 'stroke-dashoffset': -4, 'stroke-linecap': 'round' }, g);
    } else {
      el('rect', { x: -25, y: -7, width: 50, height: 14, rx: 7, fill: 'url(#gLink)', stroke: '#000', 'stroke-width': 2 }, g);
      el('path', { d: 'M-18,-3 L18,-3', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M-16,3.5 L16,3.5', stroke: '#ff3030', 'stroke-width': 1.2, opacity: 0.8, 'stroke-linecap': 'round' }, g);
    }
  }

  const chains = document.getElementById('chains');
  const chainLeft = [
    [282, 512], [220, 584], [168, 672], [140, 772], [138, 878],
    [166, 972], [222, 1040], [290, 1092], [392, 1140],
  ];
  const glowLayer = el('g', { opacity: 0.55, filter: 'url(#fBlur4)' }, chains);
  [chainLeft, chainLeft.map(mirror)].forEach((path) => {
    const d = catmullRom(path, 12).map((p, i) => (i ? 'L' : 'M') + pt(p)).join('');
    el('path', { d, fill: 'none', stroke: '#ff1a1a', 'stroke-width': 22 }, glowLayer);
    spaced(path, 33).forEach((p, i) => chainLink(chains, p, i % 2 === 0));
  });

  // ---------- Star ornaments with gems ----------

  function ornament(parent, center, tips, waist, gem, minorLen) {
    const [cx, cy] = center;
    const sorted = tips
      .map((p) => ({ p, a: Math.atan2(p[1] - cy, p[0] - cx) }))
      .sort((m, n) => m.a - n.a);
    const n = sorted.length;
    const waists = sorted.map((cur, i) => {
      let a0 = cur.a;
      let a1 = sorted[(i + 1) % n].a;
      if (a1 <= a0) a1 += Math.PI * 2;
      const a = (a0 + a1) / 2;
      return { p: [cx + Math.cos(a) * waist, cy + Math.sin(a) * waist], a };
    });

    const g = el('g', {}, parent);

    // Small diagonal spikes between the main points
    if (minorLen) {
      waists.forEach(({ a }) => {
        const tip = [cx + Math.cos(a) * minorLen, cy + Math.sin(a) * minorLen];
        const side = 0.22;
        const l = [cx + Math.cos(a - side) * waist * 0.9, cy + Math.sin(a - side) * waist * 0.9];
        const r = [cx + Math.cos(a + side) * waist * 0.9, cy + Math.sin(a + side) * waist * 0.9];
        const d = `M${pt(l)}L${pt(tip)}L${pt(r)}Z`;
        el('path', { d, fill: 'none', stroke: '#ff1a1a', 'stroke-width': 4, filter: 'url(#fGlow)' }, g);
        el('path', { d, fill: 'url(#gFacetMid)', stroke: '#ff4a4a', 'stroke-width': 1 }, g);
      });
    }

    let outline = '';
    sorted.forEach((t, i) => {
      outline += `${i ? 'L' : 'M'}${pt(t.p)}L${pt(waists[i].p)}`;
    });
    outline += 'Z';

    el('path', { d: outline, fill: 'none', stroke: '#ff1a1a', 'stroke-width': 6, 'stroke-linejoin': 'round', filter: 'url(#fGlow)' }, g);
    sorted.forEach((t, i) => {
      const prev = waists[(i - 1 + n) % n].p;
      const next = waists[i].p;
      el('path', { d: `M${cx},${cy}L${pt(prev)}L${pt(t.p)}Z`, fill: 'url(#gFacetLight)' }, g);
      el('path', { d: `M${cx},${cy}L${pt(t.p)}L${pt(next)}Z`, fill: 'url(#gFacetDark)' }, g);
      el('path', { d: `M${cx},${cy}L${pt(t.p)}`, stroke: 'rgba(255,255,255,.4)', 'stroke-width': 1 }, g);
    });
    el('path', { d: outline, fill: 'none', stroke: '#ff5a5a', 'stroke-width': 1.4, 'stroke-linejoin': 'miter' }, g);

    if (gem) {
      const [gw, gh] = gem;
      const d = `M${cx},${cy - gh}L${cx + gw},${cy}L${cx},${cy + gh}L${cx - gw},${cy}Z`;
      el('path', { d, fill: '#ff1010', filter: 'url(#fGlow)' }, g);
      el('path', { d, fill: 'url(#gGem)', stroke: '#ff8080', 'stroke-width': 1 }, g);
      el('path', { d: `M${cx},${cy - gh}L${cx},${cy + gh}M${cx - gw},${cy}L${cx + gw},${cy}`, stroke: 'rgba(255,220,220,.35)', 'stroke-width': 0.8 }, g);
    }
  }

  const ornaments = document.getElementById('ornaments');
  const sideStar = { c: [106, 808], tips: [[100, 690], [190, 800], [128, 900], [26, 818]] };
  const lowStar = { c: [284, 1080], tips: [[306, 1022], [344, 1092], [278, 1138], [228, 1070]] };
  [sideStar, lowStar].forEach(({ c, tips }, i) => {
    const waist = i === 0 ? 34 : 22;
    const gem = i === 0 ? [16, 24] : [10, 14];
    const minor = i === 0 ? 0 : 30;
    ornament(ornaments, c, tips, waist, gem, minor);
    ornament(ornaments, mirror(c), tips.map(mirror), waist, gem, minor);
  });
  // Centre-bottom ornament that holds the long blade
  ornament(ornaments, [470, 1150], [[470, 1044], [556, 1138], [470, 1204], [384, 1138]], 40, [22, 30], 0);

  // ---------- Blood ----------

  // [x, top, length, width]
  const dripsData = [
    [62, 760, 200, 8], [104, 852, 180, 8], [96, 708, 52, 6], [150, 884, 50, 6],
    [228, 1090, 132, 9], [338, 1196, 36, 6], [536, 1212, 56, 6],
    [712, 1088, 122, 9], [790, 884, 50, 6], [844, 708, 52, 6],
    [836, 852, 180, 8], [878, 760, 200, 8],
  ];
  const drips = document.getElementById('drips');
  const dripGlow = el('g', {}, drips);
  const dripHalo = el('g', { opacity: 0.6, filter: 'url(#fBlur4)' }, drips);
  const dripEnds = [];

  dripsData.forEach(([x, top, len, w]) => {
    const bulbY = top + len;
    const d =
      `M${x - w * 1.5},${top}` +
      ` C${x - w * 0.9},${top + len * 0.18} ${x - w * 0.62},${top + len * 0.4} ${x - w * 0.66},${bulbY - w * 2.1}` +
      ` C${x - w * 1.9},${bulbY - w * 0.7} ${x - w * 1.6},${bulbY + w * 1.7} ${x},${bulbY + w * 1.7}` +
      ` C${x + w * 1.6},${bulbY + w * 1.7} ${x + w * 1.9},${bulbY - w * 0.7} ${x + w * 0.66},${bulbY - w * 2.1}` +
      ` C${x + w * 0.62},${top + len * 0.4} ${x + w * 0.9},${top + len * 0.18} ${x + w * 1.5},${top} Z`;
    el('path', { d, fill: '#ff1010' }, dripHalo);
    el('path', { d, fill: 'url(#gDrip)' }, dripGlow);
    el('path', {
      d: `M${x - w * 0.5},${top + 8} Q${x - w * 0.22},${top + len * 0.45} ${x - w * 0.2},${bulbY - w * 1.7}`,
      fill: 'none', stroke: 'rgba(255,220,220,.5)', 'stroke-width': Math.max(1, w * 0.2), 'stroke-linecap': 'round',
    }, drips);
    el('ellipse', {
      cx: x - w * 0.55, cy: bulbY + w * 0.3, rx: w * 0.32, ry: w * 0.55,
      fill: 'rgba(255,235,235,.7)',
    }, drips);
    dripEnds.push({ x, y: bulbY + w * 1.7, w });
  });

  // ---------- Photo in the circle ----------

  const photo = document.getElementById('photo');
  const photoInput = document.getElementById('photoInput');
  const photoHit = document.getElementById('photoHit');
  const hint = document.getElementById('hint');
  let photoUrl = null;

  function setPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    photo.setAttribute('href', photoUrl);
    photo.style.display = '';
    hint.hidden = true;
  }

  photoHit.addEventListener('click', () => photoInput.click());
  photoHit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      photoInput.click();
    }
  });
  photoInput.addEventListener('change', () => setPhoto(photoInput.files[0]));

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    setPhoto(e.dataTransfer.files[0]);
  });

  // ---------- Embers, falling drops, pulsing glow ----------

  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale = canvas.width / W;
  }

  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  {
    const s = sprite.getContext('2d');
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,235,220,1)');
    g.addColorStop(0.2, 'rgba(255,80,60,.95)');
    g.addColorStop(0.5, 'rgba(255,10,10,.3)');
    g.addColorStop(1, 'rgba(255,0,0,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  function spawnEmber(ember, anywhere) {
    let x;
    let y;
    do {
      const zone = Math.random();
      if (zone < 0.45) {
        x = rand(40, 900); y = rand(110, 600);
      } else if (zone < 0.85) {
        x = rand(90, 850); y = rand(980, 1580);
      } else {
        x = rand(10, 930); y = rand(60, 1640);
      }
    } while (Math.hypot(x - CX, y - CY) < 340);
    if (!anywhere && Math.random() < 0.6) y = Math.min(y + rand(80, 200), 1650);
    Object.assign(ember, {
      x, y,
      r: rand(0.6, 2.6),
      vx: rand(-4, 4),
      vy: rand(-16, -4),
      phase: rand(0, Math.PI * 2),
      speed: rand(1.5, 5),
      life: 0,
      maxLife: rand(5, 14),
    });
    return ember;
  }

  const embers = Array.from({ length: 80 }, () => spawnEmber({}, true));
  embers.forEach((e) => { e.life = rand(0, e.maxLife); });

  const drops = [];
  dripEnds.forEach((end) => { end.next = rand(0.5, 6); });

  function draw(t, dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Breathing neon on the inner ring
    const flicker = Math.random() < 0.015 ? -0.15 : 0;
    const ringAlpha = 0.32 + 0.14 * Math.sin(t * 1.3) + flicker;
    const ring = ctx.createRadialGradient(CX, CY, 262, CX, CY, 330);
    ring.addColorStop(0, 'rgba(255,0,0,0)');
    ring.addColorStop(0.42, 'rgba(255,30,30,.9)');
    ring.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.globalAlpha = Math.max(0, ringAlpha);
    ctx.fillStyle = ring;
    ctx.fillRect(CX - 330, CY - 330, 660, 660);

    // Pulse on the glowing plus of the cross
    const plus = ctx.createRadialGradient(470, 385, 0, 470, 385, 80);
    plus.addColorStop(0, 'rgba(255,190,190,1)');
    plus.addColorStop(0.35, 'rgba(255,40,40,.6)');
    plus.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2.1);
    ctx.fillStyle = plus;
    ctx.fillRect(390, 305, 160, 160);

    // Embers
    embers.forEach((e) => {
      e.life += dt;
      e.x += (e.vx + Math.sin(t * 0.8 + e.phase) * 6) * dt;
      e.y += e.vy * dt;
      if (e.life > e.maxLife || e.y < 20) spawnEmber(e, false);
      const fade = Math.min(1, e.life / 1.2, (e.maxLife - e.life) / 1.5);
      const twinkle = 0.55 + 0.45 * Math.sin(t * e.speed + e.phase);
      ctx.globalAlpha = Math.max(0, fade * twinkle);
      const size = e.r * 7;
      ctx.drawImage(sprite, e.x - size / 2, e.y - size / 2, size, size);
    });

    // Drops that swell at the end of a drip, fall and fade
    dripEnds.forEach((end) => {
      end.next -= dt;
      if (end.next <= 0) {
        drops.push({ x: end.x, y: end.y - end.w * 0.6, r: end.w * 0.9, vy: 0, grow: 0, start: end.y });
        end.next = rand(3, 9);
      }
    });
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (d.grow < 1) {
        d.grow = Math.min(1, d.grow + dt * 1.4);
      } else {
        d.vy += 700 * dt;
        d.y += d.vy * dt;
      }
      const fallen = d.y - d.start;
      const alpha = Math.max(0, 1 - fallen / 260);
      if (alpha <= 0) {
        drops.splice(i, 1);
        continue;
      }
      const r = d.r * (0.4 + 0.6 * d.grow);
      const stretch = 1 + Math.min(d.vy / 500, 0.8);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e0101a';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + r, r, r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,220,.8)';
      ctx.beginPath();
      ctx.ellipse(d.x - r * 0.35, d.y + r * 0.7, r * 0.25, r * 0.4 * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduceMotion) {
    draw(0, 0);
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(now / 1000, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

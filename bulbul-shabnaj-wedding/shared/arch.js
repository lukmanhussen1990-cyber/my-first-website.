// The golden Mughal arch that frames the film: a pointed, cusped (multifoil) arch on two pillars, drawn as fine gold
// line-work that inks itself on from the foot of each pillar up to the apex, then a finial, beads on every cusp and
// filigree vines curling out of the spandrels. Pure geometry + stroke-dash animation.
const GOLD_STOPS = [[0, '#8A6526'], [0.22, '#D9B260'], [0.42, '#FFF0C0'], [0.58, '#E7C072'], [0.8, '#B88A3C'], [1, '#7A5620']];
function goldGradient(defs, id, x1, y1, x2, y2) {
  const g = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, defs);
  GOLD_STOPS.forEach(([o, c]) => svgEl('stop', { offset: o, 'stop-color': c }, g)); return g;
}
const pathD = pts => 'M ' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L ');
class Arch {
  // o: cx, ys (springing line), ya (apex of the inner arch), a (inner half-span), band (arch band width), lobes per side
  constructor(svg, o) {
    this.o = o = Object.assign({ cx: 960, ys: 470, ya: 80, a: 400, band: 48, lobes: 4, depth: 24, bottom: 1110, frame: 78, top: 40 }, o);
    const NS = 'http://www.w3.org/2000/svg';
    const defs = svgEl('defs', {}, svg);
    goldGradient(defs, 'archGold', 300, 0, 1620, 1080);
    defs.innerHTML += `<filter id="archGlow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2" result="b"/>
      <feColorMatrix in="b" type="matrix" values="1 0 0 0 0.1  0 0.85 0 0 0.05  0 0 0.4 0 0  0 0 0 0.75 0" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    this.g = svgEl('g', { filter: 'url(#archGlow)' }, svg);
    const h = o.ys - o.ya, R = (o.a * o.a + h * h) / (2 * o.a);
    this.R = R;
    // left side, from the springing point to the apex, as points on a circle centred on the springing line
    const side = (sgn, off, scallop) => {
      const C = [o.cx - sgn * (o.a - R), o.ys];
      const thA = Math.acos(clamp((C[0] - o.cx) * sgn / R, -1, 1)), pts = [];
      const N = 220;
      for (let i = 0; i <= N; i++) {
        const s = i / N, th = s * thA;
        let r = R + off;
        if (scallop) r += o.depth * Math.pow(Math.abs(Math.sin(Math.PI * o.lobes * s)), 0.8);
        pts.push([C[0] - sgn * r * Math.cos(th), o.ys - r * Math.sin(th)]);
      }
      return pts;
    };
    const pillar = (sgn, x) => [[o.cx - sgn * x, o.bottom], [o.cx - sgn * x, o.ys]];
    this.lines = [];
    const addLine = (pts, w, t0, t1, op = 1) => {
      const p = svgEl('path', { d: pathD(pts), fill: 'none', stroke: 'url(#archGold)', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', opacity: op }, this.g);
      this.lines.push({ p, t0, t1 }); return p;
    };
    for (const sgn of [1, -1]) {
      // inner (cusped) line, the band's fine middle line, the outer line; each runs up its pillar and over the arch
      addLine([...pillar(sgn, o.a), ...side(sgn, 0, true)], 3.4, 0, 1);
      addLine([...pillar(sgn, o.a + o.band * 0.62), ...side(sgn, o.band * 0.62, false)], 1.2, 0.08, 1.04, 0.9);
      addLine([...pillar(sgn, o.a + o.band), ...side(sgn, o.band, false)], 3.0, 0.04, 1.02);
    }
    // glints: a bright dash that runs along the outer lines from the pillar feet to the apex
    this.glints = this.lines.filter((L, i) => i % 3 !== 1).map(L => svgEl('path', { d: L.p.getAttribute('d'), fill: 'none', stroke: '#FFF7DC', 'stroke-width': 5, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '0.035 1.2', opacity: 0 }, this.g));
    // the cusp beads and the band's dot row, the finial, the pillar capitals
    this.beads = [];
    for (const sgn of [1, -1]) {
      const C = [o.cx - sgn * (o.a - R), o.ys], thA = Math.acos(clamp((C[0] - o.cx) * sgn / R, -1, 1));
      for (let k = 1; k < o.lobes; k++) {
        const th = k / o.lobes * thA, r = R - 6;
        this.beads.push({ x: C[0] - sgn * r * Math.cos(th), y: o.ys - r * Math.sin(th), r: 5.2, t: k / o.lobes });
      }
      for (let k = 1; k < 3 * o.lobes; k++) {
        const th = (k + 0.5) / (3 * o.lobes) * thA, r = R + o.band * 0.31;
        this.beads.push({ x: C[0] - sgn * r * Math.cos(th), y: o.ys - r * Math.sin(th), r: 2.3, t: (k + 0.5) / (3 * o.lobes) });
      }
    }
    this.beadEls = this.beads.map(b => svgEl('circle', { cx: b.x, cy: b.y, r: b.r, fill: 'url(#archGold)' }, this.g));
    // finial above the apex: a small onion dome on a stem with a crescent tip
    const fy = o.ya - o.band;
    this.finial = svgEl('g', { transform: `translate(${o.cx} ${fy})` }, this.g);
    svgEl('path', { d: 'M -15 0 C -15 -15 -5 -22 0 -33 C 5 -22 15 -15 15 0 Z', fill: 'none', stroke: 'url(#archGold)', 'stroke-width': 2.4 }, this.finial);
    svgEl('path', { d: 'M -8 -3 C -8 -12 -3 -16 0 -23 C 3 -16 8 -12 8 -3 Z', fill: 'url(#archGold)', opacity: 0.55 }, this.finial);
    svgEl('line', { x1: 0, y1: -33, x2: 0, y2: -44, stroke: 'url(#archGold)', 'stroke-width': 2 }, this.finial);
    svgEl('circle', { cx: 0, cy: -47, r: 3.4, fill: 'url(#archGold)' }, this.finial);
    this.capitals = [1, -1].map(sgn => {
      const g = svgEl('g', {}, this.g), x = o.cx - sgn * (o.a + o.band / 2);
      svgEl('rect', { x: x - o.band / 2 - 12, y: o.ys - 2, width: o.band + 24, height: 10, rx: 5, fill: 'none', stroke: 'url(#archGold)', 'stroke-width': 2 }, g);
      for (let k = -2; k <= 2; k++) svgEl('circle', { cx: x + k * 13, cy: o.ys + 3, r: 2.2, fill: 'url(#archGold)' }, g);
      return g;
    });
    this.vines = [];
  }
  // the alfiz: a rectangular moulding around the arch (Mughal pishtaq), and in each spandrel an arabesque: a rosette
  // with two scrolling stems that curl into spirals, leaves along them
  addFiligree(seed = 7) {
    const o = this.o, rnd = mulberry32(seed);
    const L = o.cx - o.a - o.band - o.frame, Rt = o.cx + o.a + o.band + o.frame, T = o.top;
    const frameLine = (sgn, inset, w, t0, t1) => {
      const x = o.cx - sgn * (o.cx - L - inset);
      const pts = [[o.cx - sgn * (o.a + o.band), o.ys + 14 - inset * 0], [x, o.ys + 14], [x, T + inset], [o.cx, T + inset]];
      const p = svgEl('path', { d: pathD(pts), fill: 'none', stroke: 'url(#archGold)', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, this.g);
      this.vines.push({ p, t0, t1, leaves: [] });
    };
    for (const sgn of [1, -1]) { frameLine(sgn, 0, 2.6, 0.0, 0.42); frameLine(sgn, 9, 1.0, 0.05, 0.47); }
    // a stem: a cubic Bezier into an inward spiral; leaves alternate along the Bezier part
    const bez = (a, b, c, d, t) => { const m = 1 - t; return [m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0], m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1]]; };
    const stem = (P, spiralR, turnSign, w, t0, dur, leafEvery = 0.16) => {
      const pts = []; for (let i = 0; i <= 60; i++) pts.push(bez(P[0], P[1], P[2], P[3], i / 60));
      const nb = pts.length;
      let [x, y] = pts[nb - 1], h = Math.atan2(y - pts[nb - 2][1], x - pts[nb - 2][0]), r = spiralR;
      for (let k = 0; k < 70; k++) { const step = 2; h += turnSign * step / r; r = Math.max(2.5, r * 0.982); x += step * Math.cos(h); y += step * Math.sin(h); pts.push([x, y]); }
      const p = svgEl('path', { d: pathD(pts), fill: 'none', stroke: 'url(#archGold)', 'stroke-width': w, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, this.g);
      const v = { p, t0, t1: t0 + dur, leaves: [] }; this.vines.push(v);
      let side = 1;
      for (let u = leafEvery; u < 0.92; u += leafEvery) {
        const i = Math.round(u * 60), a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) + side * 0.85; side = -side;
        const Lf = 12 + 3 * rnd(), q = pts[i];
        const leaf = svgEl('path', { d: `M 0 0 C ${Lf * 0.35} ${-Lf * 0.34} ${Lf * 0.8} ${-Lf * 0.24} ${Lf} 0 C ${Lf * 0.8} ${Lf * 0.24} ${Lf * 0.35} ${Lf * 0.34} 0 0 Z`, fill: 'url(#archGold)',
          transform: `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)}) rotate(${(a * 180 / Math.PI).toFixed(1)})` }, this.g);
        v.leaves.push({ el: leaf, u: u * 60 / pts.length });
      }
      const bud = svgEl('circle', { cx: x, cy: y, r: 2.6, fill: 'url(#archGold)' }, this.g); v.leaves.push({ el: bud, u: 1 });
    };
    const M = (sgn, q) => [o.cx - sgn * (o.cx - q[0]), q[1]];                  // left-spandrel design, mirrored
    for (const sgn of [1, -1]) {
      const rx = 540, ry = 150;
      const ros = svgEl('g', { transform: `translate(${M(sgn, [rx, ry]).join(' ')})` }, this.g);
      for (let k = 0; k < 8; k++) svgEl('path', { d: 'M 0 -4 C 6 -10 7 -20 0 -27 C -7 -20 -6 -10 0 -4 Z', fill: 'url(#archGold)', opacity: 0.92, transform: `rotate(${k * 45 + 22.5})` }, ros);
      for (let k = 0; k < 8; k++) svgEl('circle', { cx: 0, cy: -33, r: 1.8, fill: 'url(#archGold)', transform: `rotate(${k * 45})` }, ros);
      svgEl('circle', { cx: 0, cy: 0, r: 5.5, fill: 'url(#archGold)' }, ros);
      this.vines.push({ p: null, g: ros, t0: 0.40, t1: 0.62, leaves: [] });
      const S = pts => pts.map(q => M(sgn, q));
      stem(S([[574, 140], [640, 112], [700, 98], [748, 102]]), 13, sgn * 1, 2.0, 0.50, 0.30);      // along the top, toward the apex
      stem(S([[536, 184], [516, 240], [506, 300], [494, 362]]), 12, -sgn * 1, 2.0, 0.54, 0.30);    // down the side
      stem(S([[566, 172], [588, 190], [598, 200], [604, 214]]), 9, -sgn * 1, 1.5, 0.62, 0.22, 0.4); // into the spandrel's middle
      stem(S([[574, 160], [610, 150], [640, 160], [664, 152]]), 8, -sgn * 1, 1.3, 0.66, 0.2, 0.5);
    }
  }
  // p: drawing progress of the main lines 0..1; q: progress of the ornaments (beads, finial, capitals) 0..1;
  // v: progress of the filigree 0..1 (each vine has its own start inside 0..1)
  glint(u) { this.glints.forEach(G => { G.setAttribute('stroke-dashoffset', (0.035 - u * 1.07).toFixed(4)); G.setAttribute('opacity', u > 0 && u < 1 ? Math.sin(Math.PI * u).toFixed(3) : 0); }); }
  render(p, q, v) {
    this.lines.forEach(L => { const u = clamp((p - L.t0) / (L.t1 - L.t0)); L.p.setAttribute('stroke-dashoffset', (1 - u).toFixed(4)); L.p.style.visibility = u > 0 ? 'visible' : 'hidden'; });
    this.beads.forEach((b, i) => { const u = spring((q - b.t * 0.6) * 30, 2.2, 8); this.beadEls[i].setAttribute('r', (b.r * Math.max(0, u)).toFixed(2)); });
    const fu = spring((q - 0.55) * 30, 2.6, 10);
    this.finial.setAttribute('transform', `translate(${this.o.cx} ${this.o.ya - this.o.band}) scale(${Math.max(0, fu).toFixed(3)})`);
    this.capitals.forEach(c => c.style.opacity = clamp(q * 3).toFixed(3));
    this.vines.forEach(V => {
      const u = clamp((v - V.t0) / (V.t1 - V.t0));
      if (V.g) { const k = spring(u * 14, 2.4, 9); V.g.style.transformBox = 'fill-box'; V.g.style.transformOrigin = '50% 50%'; V.g.style.scale = Math.max(0.001, k).toFixed(3); V.g.style.rotate = ((1 - Math.min(1, k)) * -60).toFixed(2) + 'deg'; V.g.style.opacity = clamp(u * 4).toFixed(3); return; }
      V.p.setAttribute('stroke-dashoffset', (1 - u).toFixed(4)); V.p.style.visibility = u > 0 ? 'visible' : 'hidden';
      V.leaves.forEach(L => { const k = clamp((u - L.u + 0.06) / 0.12); L.el.style.opacity = (0.92 * k).toFixed(3);
        L.el.style.transformBox = 'fill-box'; L.el.style.transformOrigin = '0 50%'; L.el.style.scale = Math.max(0.001, k).toFixed(3); });
    });
  }
}

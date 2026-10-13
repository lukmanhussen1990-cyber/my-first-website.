// Title-line animation component: a centred line whose words (or letters) appear one by one.
// Words keep natural spacing; the line re-centres smoothly over the words that have appeared
// ("presence"), the whole line can zoom (S) and blur (pulse), and each unit fades in from a tint
// colour / blur / offset to its final state. All parameters are keyframes in global frames.
//
// new TitleLine(stage, {
//   text: 'Build to move beyond generic', unit: 'word' | 'letter',
//   font: "'Inter'", size: 72.9, weight: 400, tracking: -0.02, // em
//   cx: 955, baseline: 560,                 // stage px of line centre / baseline at S = 1
//   S: [[f, s], ...], X: [[f, dx]], Y: [[f, dy]], blur: [[f, px]], opacity: [[f, a]],
//   layout: 'progressive' | 'full',         // re-centre over appeared units, or full line always
//   presenceDur: 6,                         // frames for a unit's layout presence 0 -> 1
//   units: [{ in: f0, dur: 6, from: [r,g,b], to: [r,g,b], blur0: 10, weight: 400, weightTo: 600,
//             weightAt: f, rise: 0, colorAt: [[f, [r,g,b]], ...] }, ...],
// })
class TitleLine {
  constructor(stage, o) {
    this.o = Object.assign({ unit: 'word', font: "'Inter'", weight: 400, tracking: 0, layout: 'progressive',
      presenceDur: 6, S: [[0, 1]], X: [[0, 0]], Y: [[0, 0]], blur: [[0, 0]], opacity: [[0, 1]] }, o);
    this.el = document.createElement('div');
    Object.assign(this.el.style, { position: 'absolute', left: '0px', top: '0px', width: '1920px', height: '1080px', transformOrigin: `${o.cx}px ${o.baseline}px` });
    stage.appendChild(this.el);
    const toks = this.o.unit === 'letter' ? Array.from(this.o.text) : this.o.text.split(' ');
    this.spans = [];
    this.isSpace = [];
    toks.forEach((t, i) => {
      const s = document.createElement('span');
      s.textContent = t;
      Object.assign(s.style, { position: 'absolute', top: '0px', left: '0px', whiteSpace: 'pre', fontFamily: this.o.font,
        fontSize: this.o.size + 'px', letterSpacing: this.o.tracking + 'em', lineHeight: '1', fontWeight: this.o.weight });
      this.el.appendChild(s);
      this.spans.push(s);
      this.isSpace.push(t === ' ');
    });
    this.units = this.o.units;
    this.measured = false;
  }
  measure() {
    if (this.o.fitWidth) {      // {unit: k | 'all', width: px}: scale the font so that span measures width px
      const fw = this.o.fitWidth;
      this.spans.forEach((s, i) => { const u = this.units[this.uidx(i)] || {}; s.style.fontWeight = u.weightTo || u.weight || this.o.weight; });
      const rs = this.spans.map(s => s.getBoundingClientRect().width);
      const sp = document.createElement('span');
      Object.assign(sp.style, { position: 'absolute', whiteSpace: 'pre', fontFamily: this.o.font, fontSize: this.o.size + 'px', letterSpacing: this.o.tracking + 'em' });
      sp.textContent = ' '; this.el.appendChild(sp); const g = this.o.unit === 'letter' ? 0 : sp.getBoundingClientRect().width; this.el.removeChild(sp);
      const w = fw.unit === 'all' ? rs.reduce((a, b) => a + b, 0) + g * (rs.length - 1) : rs[fw.unit];
      if (fw.by === 'tracking') {   // keep the font size, adjust letter-spacing so the width matches
        const nch = fw.unit === 'all' ? this.o.text.length : this.spans[fw.unit].textContent.length;
        this.o.tracking += (fw.width - w) / (nch * this.o.size);
        this.spans.forEach(s => s.style.letterSpacing = this.o.tracking + 'em');
      } else {
        this.o.size *= fw.width / w;
        this.spans.forEach(s => s.style.fontSize = this.o.size + 'px');
      }
    }
    // widths at final weight; gap = width of a space in this font
    const probe = document.createElement('span');
    Object.assign(probe.style, { position: 'absolute', whiteSpace: 'pre', fontFamily: this.o.font, fontSize: this.o.size + 'px', letterSpacing: this.o.tracking + 'em' });
    probe.textContent = ' '; this.el.appendChild(probe);
    this.gap = this.o.unit === 'letter' ? 0 : probe.getBoundingClientRect().width;
    probe.textContent = 'H'; const r = probe.getBoundingClientRect(); this.asc = r.height;
    this.el.removeChild(probe);
    this.w = this.spans.map((s, i) => {
      const u = this.units[this.uidx(i)] || {};
      s.style.fontWeight = u.weightTo || u.weight || this.o.weight;
      return s.getBoundingClientRect().width;
    });
    // baseline offset of a line box with line-height 1: approximate with font metrics via canvas
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${this.o.weight} ${this.o.size}px ${this.o.font}`;
    const m = c.measureText('Hxg');
    this.ascent = m.fontBoundingBoxAscent; this.descent = m.fontBoundingBoxDescent;
    this.measured = true;
  }
  uidx(i) { // span index -> unit index (letters: spaces get no unit)
    if (this.o.unit !== 'letter') return i;
    let k = -1; for (let j = 0; j <= i; j++) if (!this.isSpace[j]) k++; return this.isSpace[i] ? -1 : k;
  }
  render(f) {
    if (!this.measured) this.measure();
    const o = this.o, n = this.spans.length;
    const pres = this.spans.map((s, i) => {
      if (o.layout === 'full') return 1;
      const k = this.uidx(i), u = this.units[k >= 0 ? k : this.uidx(i + 1)] || {};
      const t0 = u.in === undefined ? -1e9 : u.in;
      return ease.inOutCubic(invlerp(t0, t0 + (u.presenceDur || o.presenceDur), f));
    });
    let total = 0;
    for (let i = 0; i < n; i++) total += pres[i] * (this.w[i] + (i < n - 1 ? this.gap : 0));
    let x = o.cx - total / 2;
    const S = kf(f, o.S), X = kf(f, o.X), Y = kf(f, o.Y);
    this.el.style.transform = `translate(${X}px, ${Y}px) scale(${S})`;
    const gb = kf(f, o.blur);
    this.el.style.filter = gb > 0.05 ? `blur(${gb}px)` : 'none';
    this.el.style.opacity = kf(f, o.opacity);
    for (let i = 0; i < n; i++) {
      const s = this.spans[i], k = this.uidx(i);
      s.style.left = x + 'px';
      s.style.top = (o.baseline - this.ascent) + 'px';
      x += pres[i] * (this.w[i] + (i < n - 1 ? this.gap : 0));
      if (k < 0) { s.style.opacity = 0; continue; }
      const u = this.units[k];
      const p = ease[u.ease || 'outCubic'](invlerp(u.in, u.in + (u.dur || 6), f));
      const to = u.to || [255, 255, 255];
      let col = u.colorAt ? kf(f, u.colorAt) : mixc(u.from || to, to, p);
      s.style.color = rgba(col);
      s.style.opacity = u.opacityAt ? kf(f, u.opacityAt) : p;
      const b = u.blurAt ? kf(f, u.blurAt) : (u.blur0 || 0) * (1 - p);
      s.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : 'none';
      const ry = u.riseAt ? kf(f, u.riseAt) : (u.rise || 0) * (1 - p);
      const sx = u.slide ? u.slide.dx * (1 - ease[u.slide.ease || 'outCubic'](invlerp(u.in, u.in + u.slide.dur, f))) : 0;
      s.style.transform = (ry || sx) ? `translate(${sx}px, ${ry}px)` : '';
      if (u.typeAt) { const t = clamp(kf(f, u.typeAt)); s.style.clipPath = `inset(-30% ${((1 - t) * 100).toFixed(2)}% -30% -10%)`; }
      if (u.weightTo) s.style.fontWeight = Math.round(lerp(u.weight || o.weight, u.weightTo, ease.inOutCubic(invlerp(u.weightAt, u.weightAt + (u.weightDur || 4), f))));
      else s.style.fontWeight = u.weight || o.weight;
    }
  }
}
window.TitleLine = TitleLine;

// The couple's names in gold script, written on by a point of light (the bulbul's song): "Bulbul", an italic "&"
// between fine rules, "Shabnaj"; then a divider and "are getting married". Gold is a clipped gradient with a sheen
// that passes over each name once it is written. The writing is a slanted soft mask that runs left to right in step
// with the pen light (drawn by the scene on its effects canvas).
class Names {
  constructor(parent, o) {
    this.o = o = Object.assign({ cx: 960, b1: 452, amp: 522, b2: 668, size: 150, sub: 772, div: 718 }, o);
    const root = this.root = document.createElement('div'); root.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px';
    parent.appendChild(root);
    const word = (txt, base, cls) => {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font-family:'Vibes';font-size:${o.size}px;line-height:1;padding:0.32em 0.5em 0.42em 0.6em;` +
        `background:linear-gradient(100deg, #A77A33 0%, #E7C47A 22%, #FFF2C8 32%, #E9C67C 42%, #B98C3F 62%, #F3D896 80%, #A77A33 100%);background-size:220% 100%;` +
        `-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 9px rgba(255,196,110,0.32)) drop-shadow(0 3px 4px rgba(10,4,20,0.55))`;
      root.appendChild(el);
      // place by the baseline: measure where the alphabetic baseline falls inside the element
      const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.appendChild(probe);
      const r = el.getBoundingClientRect(), bl = probe.getBoundingClientRect().top - r.top; el.removeChild(probe);
      const padL = 0.6 * o.size, padR = 0.5 * o.size, inkW = r.width - padL - padR;
      el.style.left = (o.cx - r.width / 2 + (padL - padR) / 2).toFixed(1) + 'px'; el.style.top = (base - bl).toFixed(1) + 'px';
      return { el, x0: o.cx - inkW / 2, x1: o.cx + inkW / 2, base, w: r.width, padL };
    };
    this.n1 = word('Bulbul', o.b1); this.n2 = word('Shabnaj', o.b2);
    // the ampersand between two fine rules with diamonds
    const amp = this.amp = document.createElement('div');
    amp.style.cssText = `position:absolute;left:0;top:${o.amp - 56}px;width:1920px;height:112px;display:flex;align-items:center;justify-content:center;gap:18px`;
    amp.innerHTML = `<svg width="112" height="12" style="overflow:visible"><line x1="0" y1="6" x2="100" y2="6" stroke="#D9B566" stroke-width="1.3"/><rect x="102" y="2" width="8" height="8" transform="rotate(45 106 6)" fill="#E8C57A"/></svg>
      <span style="font-family:'Cormorant';font-style:italic;font-weight:400;font-size:104px;line-height:1;color:#F1D99E;text-shadow:0 0 12px rgba(255,200,120,0.35);transform:translateY(-6px)">&amp;</span>
      <svg width="112" height="12" style="overflow:visible"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="#E8C57A"/><line x1="12" y1="6" x2="112" y2="6" stroke="#D9B566" stroke-width="1.3"/></svg>`;
    root.appendChild(amp);
    this.ampParts = Array.from(amp.children);
    // divider + subtitle
    const div = this.div = svgEl('svg', { width: 1920, height: 40, style: `position:absolute;left:0;top:${o.div - 20}px;overflow:visible` });
    root.appendChild(div);
    this.divL = svgEl('line', { x1: 940, y1: 20, x2: 790, y2: 20, stroke: '#D9B566', 'stroke-width': 1.2, pathLength: 1, 'stroke-dasharray': '1 1' }, div);
    this.divR = svgEl('line', { x1: 980, y1: 20, x2: 1130, y2: 20, stroke: '#D9B566', 'stroke-width': 1.2, pathLength: 1, 'stroke-dasharray': '1 1' }, div);
    this.divD = svgEl('g', { transform: 'translate(960 20)' }, div);
    svgEl('path', { d: 'M 0 -9 C 4 -4 6 -2 11 0 C 6 2 4 4 0 9 C -4 4 -6 2 -11 0 C -6 -2 -4 -4 0 -9 Z', fill: '#EFD08A' }, this.divD);
    const sub = this.sub = document.createElement('div'); sub.textContent = 'are getting married';
    sub.style.cssText = `position:absolute;left:0;top:${o.sub - 40}px;width:1920px;text-align:center;font-family:'Cormorant';font-style:italic;font-weight:400;font-size:44px;line-height:52px;letter-spacing:0.02em;color:#F4E8CC;text-shadow:0 2px 6px rgba(10,4,20,0.6)`;
    root.appendChild(sub);
  }
  // w1, w2: writing progress of each name (0..1); a: ampersand 0..1; d: divider 0..1; s: subtitle 0..1; sheen1/2
  render({ w1 = 0, w2 = 0, a = 0, d = 0, s = 0, sheen1 = 0, sheen2 = 0, op = 1 }) {
    this.root.style.opacity = op.toFixed(3);
    const mask = (n, w) => { const p = -8 + 116 * w; const m = `linear-gradient(100deg, #000 ${(p - 7).toFixed(2)}%, rgba(0,0,0,0) ${p.toFixed(2)}%)`;
      n.el.style.webkitMaskImage = m; n.el.style.maskImage = m; n.el.style.visibility = w > 0 ? 'visible' : 'hidden'; };
    mask(this.n1, w1); mask(this.n2, w2);
    this.n1.el.style.backgroundPosition = `${(100 - 100 * sheen1).toFixed(2)}% 0`; this.n2.el.style.backgroundPosition = `${(100 - 100 * sheen2).toFixed(2)}% 0`;
    const [l, amp, r] = this.ampParts;
    amp.style.opacity = clamp(a * 1.6).toFixed(3); amp.style.display = 'inline-block'; amp.style.transform = `scale(${(0.6 + 0.4 * ease.outBack(clamp(a * 1.3))).toFixed(4)})`;
    l.style.opacity = r.style.opacity = clamp(a * 2 - 0.6).toFixed(3);
    l.style.transform = `translateX(${(30 * (1 - ease.outCubic(clamp(a * 1.5 - 0.4)))).toFixed(2)}px)`; r.style.transform = `translateX(${(-30 * (1 - ease.outCubic(clamp(a * 1.5 - 0.4)))).toFixed(2)}px)`;
    const dd = ease.outCubic(d); this.divL.setAttribute('stroke-dashoffset', (1 - dd).toFixed(4)); this.divR.setAttribute('stroke-dashoffset', (1 - dd).toFixed(4));
    this.divD.setAttribute('transform', `translate(960 20) scale(${Math.max(0.001, spring(d * 20, 2.2, 8)).toFixed(4)})`);
    const se = ease.outCubic(s); this.sub.style.opacity = se.toFixed(3); this.sub.style.transform = `translateY(${(14 * (1 - se)).toFixed(2)}px)`;
    this.sub.style.filter = `blur(${(4 * (1 - se)).toFixed(2)}px)`;
  }
  // where the pen light is for a name at writing progress w: along the ink, wavering like a hand
  pen(n, w, f) {
    const x = n.x0 + (n.x1 - n.x0) * w, y = n.base - 0.34 * this.o.size + 0.16 * this.o.size * Math.sin(w * 26 + 0.7) + 0.06 * this.o.size * Math.sin(f * 0.9);
    return [x, y];
  }
}

// the monogram: a double gold ring with a beaded rim and a star, "B & S" in the script inside
class Monogram {
  constructor(parent, o) {
    this.o = o = Object.assign({ x: 960, y: 262, r: 54 }, o);
    const svg = this.svg = svgEl('svg', { width: 1920, height: 1080, style: 'position:absolute;left:0;top:0;overflow:visible' }); parent.appendChild(svg);
    svgEl('defs', {}, svg).innerHTML = `<linearGradient id="monoGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C7330"/><stop offset="0.35" stop-color="#F6DC9A"/><stop offset="0.55" stop-color="#FFF4CF"/><stop offset="0.8" stop-color="#D3A754"/><stop offset="1" stop-color="#8E6528"/></linearGradient>`;
    const g = this.g = svgEl('g', { transform: `translate(${o.x} ${o.y})` }, svg);
    svgEl('circle', { r: o.r + 8, fill: 'rgba(8,10,34,0.55)' }, g);
    this.rings = [o.r, o.r - 6].map((r, i) => svgEl('circle', { r, fill: 'none', stroke: 'url(#monoGold)', 'stroke-width': i ? 1.1 : 2.4, pathLength: 1, 'stroke-dasharray': '1 1', transform: 'rotate(-90)' }, g));
    this.dots = Array.from({ length: 24 }, (_, i) => svgEl('circle', { cx: (o.r + 8) * Math.cos(i / 24 * 6.283 - 1.5708), cy: (o.r + 8) * Math.sin(i / 24 * 6.283 - 1.5708), r: 1.7, fill: 'url(#monoGold)' }, g));
    const star = this.star = svgEl('g', { transform: `translate(0 ${-(o.r + 20)})` }, g);
    let d = ''; for (let i = 0; i < 16; i++) { const rr = i % 2 ? 4 : 10, a = i / 16 * 6.283 - 1.5708; d += (i ? 'L' : 'M') + (rr * Math.cos(a)).toFixed(2) + ' ' + (rr * Math.sin(a)).toFixed(2) + ' '; }
    svgEl('path', { d: d + 'Z', fill: 'url(#monoGold)' }, star);
    this.letters = svgEl('g', {}, g);
    const t = (txt, x, y, size, fam, style = 'normal') => svgEl('text', { x, y, 'font-family': fam, 'font-size': size, 'font-style': style, 'text-anchor': 'middle', fill: 'url(#monoGold)' }, this.letters).textContent = txt;
    t('B', -21, 17, 56, 'Vibes'); t('S', 23, 17, 56, 'Vibes'); t('&', 1, 9, 26, 'Cormorant', 'italic');
  }
  render(u, glint = 0) {   // u: 0..1 build
    this.svg.style.opacity = clamp(u * 6).toFixed(3);
    this.rings.forEach((R, i) => R.setAttribute('stroke-dashoffset', (1 - ease.inOutSine(clamp(u * 2.2 - i * 0.15))).toFixed(4)));
    this.dots.forEach((D, i) => D.setAttribute('r', (1.7 * Math.max(0, spring((u - 0.35 - i * 0.008) * 60, 2, 7))).toFixed(3)));
    const st = spring((u - 0.45) * 40, 2.4, 9); this.star.setAttribute('transform', `translate(0 ${-(this.o.r + 20)}) scale(${Math.max(0.001, st).toFixed(3)}) rotate(${((1 - Math.min(1, st)) * 90).toFixed(1)})`);
    const lu = ease.outCubic(clamp((u - 0.5) * 2.2)); this.letters.style.opacity = lu.toFixed(3); this.letters.setAttribute('transform', `translate(0 ${(8 * (1 - lu)).toFixed(2)})`);
    this.letters.style.filter = `drop-shadow(0 0 ${(4 + 10 * glint).toFixed(1)}px rgba(255,210,130,${(0.3 + 0.5 * glint).toFixed(2)}))`;
  }
}

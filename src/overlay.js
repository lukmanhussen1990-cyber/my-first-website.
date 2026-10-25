// DOM overlays, driven only by t (deterministic). Mirrors the reference system:
// word-by-word serif captions (next word ghosted), Cinzel coral highlights, label pills with leader
// lines, cream Scripture cards, the ending poll + typing comment bubble, logo outro.
import { clamp, smooth, invLerp, easeOutBack, easeOut, hash01 } from './util.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class Overlay {
  constructor(root, timings, logoUrl) {
    this.root = root; this.T = timings;
    // ---- top bar ----
    this.top = el('div', 'topbar', root);
    this.top.innerHTML = `<div class="l"><div class="logo"><img src="${logoUrl}"></div><span>GRACE IN MOTION</span><span class="dot">·</span><span class="dim">HONEST QUESTIONS</span></div><div class="r">THE ARK</div>`;
    // ---- caption band + blocks ----
    this.band = el('div', 'band', root);
    this.capWrap = el('div', '', root); this.capWrap.style.left = '0'; this.capWrap.style.top = '0';
    this.blocks = [];
    for (const ln of timings.lines) {
      if (ln.card) continue;
      let cur = null;
      ln.tokens.forEach((tk, i) => {
        if (!cur || tk.brk) { cur = { line: ln, toks: [], el: null }; this.blocks.push(cur); }
        cur.toks.push({ ...tk, i });
      });
    }
    this.blocks.forEach((b) => { b.start = b.toks[0].start; });
    this.blocks.forEach((b, bi) => {
      const next = this.blocks[bi + 1];
      const sameLineNext = next && next.line === b.line;
      const lineGap = next ? next.start - b.line.end : 1.0;
      b.end = sameLineNext ? next.start - 0.1 : b.line.end + Math.min(0.5, Math.max(0.2, lineGap * 0.75));
      b.el = el('div', 'cap', this.capWrap);
      b.el.style.position = 'absolute'; b.el.style.top = '0px'; b.el.style.display = 'none';
      b.spans = b.toks.map((tk, k) => {
        const s = el('span', 'w' + (tk.hl ? ' hl' : ''), b.el, esc(tk.t));
        if (k < b.toks.length - 1) b.el.appendChild(document.createTextNode(' '));
        tk.reveal = Math.max(0, tk.start - 0.07);
        return s;
      });
      if (b.line.id === 'S1' && b === this.blocks[0]) { b.toks[0].reveal = -0.1; b.start = Math.min(b.start, 0.1); } // hook on screen from frame 1
    });
    this.capTop = 330;
    // ---- pills + leader lines ----
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('class', 'lines'); root.appendChild(this.svg);
    this.pills = [0, 1, 2].map(() => { const p = el('div', 'pill', root); p.style.display = 'none'; return p; });
    this.leaders = [0, 1, 2].map(() => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('stroke', 'rgba(250,244,232,0.9)'); l.setAttribute('stroke-width', '2.2'); this.svg.appendChild(l);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '5.5'); c.setAttribute('fill', '#faf4e8'); this.svg.appendChild(c);
      return { l, c };
    });
    // ---- scripture cards ----
    this.cards = {};
    for (const ln of timings.lines.filter((l) => l.card)) {
      const c = el('div', 'card', root); c.style.display = 'none';
      el('div', 'bar', c);
      const v = el('div', 'v', c);
      const spans = [];
      v.appendChild(document.createTextNode('“'));
      ln.tokens.forEach((tk, k) => {
        const s = el('span', tk.hl ? 'k' : '', v, esc(tk.t)); s.style.display = 'inline-block'; spans.push(s);
        if (k < ln.tokens.length - 1) v.appendChild(document.createTextNode(' '));
      });
      v.appendChild(document.createTextNode('”'));
      el('div', 'ref', c, esc(ln.ref || ''));
      this.cards[ln.id] = { el: c, spans, line: ln };
    }
    // ---- ending: poll ----
    this.end = el('div', 'end', root); this.end.style.display = 'none';
    this.endBg = el('div', '', this.end); Object.assign(this.endBg.style, { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse 75% 55% at 50% 48%, #3a2618 0%, #2a1a10 45%, #160f0a 100%)' });
    this.rings = el('div', '', this.end); Object.assign(this.rings.style, { position: 'absolute', inset: '0', background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,220,170,0.025) 0 2px, rgba(0,0,0,0) 2px 70px)' });
    this.iconJ = el('div', 'icon', this.end); this.iconM = el('div', 'icon', this.end);
    Object.assign(this.iconJ.style, { position: 'absolute', left: '100px', top: '700px', width: '380px' });
    Object.assign(this.iconM.style, { position: 'absolute', left: '575px', top: '700px', width: '370px' });
    this.iconJ.innerHTML = `<div class="halo" style="position:absolute;left:50%;top:150px;width:440px;height:440px;margin:-220px 0 0 -220px;border-radius:50%;background:radial-gradient(circle, rgba(140,160,190,0.28), rgba(140,160,190,0) 65%);"></div>
      <svg width="330" height="305" viewBox="0 0 260 240">
        <g class="rain" stroke="#8fa2b8" stroke-width="7" stroke-linecap="round">
          <line x1="70" y1="150" x2="58" y2="182"/><line x1="112" y1="160" x2="100" y2="192"/><line x1="196" y1="150" x2="184" y2="182"/><line x1="90" y1="196" x2="80" y2="222"/><line x1="176" y1="196" x2="166" y2="222"/>
        </g>
        <path d="M150 128 L126 176 L148 176 L132 226 L182 160 L158 160 L176 128 Z" fill="#e5534b"/>
        <path d="M60 140 C24 140 18 96 52 88 C50 50 96 34 120 58 C138 22 200 30 202 76 C238 74 246 132 206 140 Z" fill="#7d8796" stroke="#2b1d14" stroke-width="7" stroke-linejoin="round"/>
        <path d="M70 118 C92 112 106 120 118 112" stroke="#9aa4b2" stroke-width="7" fill="none" stroke-linecap="round"/>
      </svg><div class="lab">JUDGMENT</div>`;
    this.iconM.innerHTML = `<div class="halo" style="position:absolute;left:50%;top:150px;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;background:radial-gradient(circle, rgba(255,200,110,0.55), rgba(255,190,100,0.12) 45%, rgba(255,190,100,0) 68%);"></div>
      <svg width="330" height="305" viewBox="0 0 260 240">
        <path d="M84 222 L176 222 L230 238 L30 238 Z" fill="rgba(255,206,120,0.45)"/>
        <rect x="80" y="22" width="100" height="200" rx="4" fill="#ffe2a6"/>
        <rect x="80" y="22" width="100" height="200" rx="4" fill="url(#mg)"/>
        <defs><radialGradient id="mg" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff6dc"/><stop offset="1" stop-color="#ffbe62"/></radialGradient></defs>
        <rect x="70" y="12" width="120" height="216" rx="6" fill="none" stroke="#5a3a22" stroke-width="16"/>
        <rect x="70" y="12" width="120" height="216" rx="6" fill="none" stroke="#2b1d14" stroke-width="4"/>
        <path d="M70 22 L34 40 L34 226 L70 222 Z" fill="#7d5230" stroke="#2b1d14" stroke-width="5" stroke-linejoin="round"/>
        <line x1="46" y1="40" x2="46" y2="222" stroke="#5a3a22" stroke-width="4"/><line x1="58" y1="32" x2="58" y2="222" stroke="#5a3a22" stroke-width="4"/>
      </svg><div class="lab">MERCY</div>`;
    this.bubble = el('div', 'bubble', this.end); this.bubble.style.top = '1250px';
    el('div', 'av', this.bubble); this.btext = el('span', '', this.bubble); this.caret = el('span', 'caret', this.bubble);
    this.hearts = [0, 1, 2, 3, 4, 5].map(() => { const h = el('div', '', this.end); h.innerHTML = '<svg class="heart" viewBox="0 0 34 30"><path d="M17 29 C6 20 1 14 1 8.5 C1 4 4.5 1 8.8 1 C12.3 1 15 3 17 6 C19 3 21.7 1 25.2 1 C29.5 1 33 4 33 8.5 C33 14 28 20 17 29 Z" fill="#e5534b"/></svg>'; h.style.position = 'absolute'; return h; });
    // ---- logo outro ----
    this.outro = el('div', 'outro', root); this.outro.style.display = 'none';
    this.outroBg = el('div', '', this.outro); Object.assign(this.outroBg.style, { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse 70% 50% at 50% 46%, #2c1c12 0%, #17100b 60%, #120c08 100%)' });
    const box = el('div', '', this.outro); Object.assign(box.style, { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' });
    this.oMark = el('div', 'mark', box, `<img src="${logoUrl}">`);
    this.oSheen = el('div', 'shimmer', this.oMark);
    this.oName = el('div', 'name', box, 'GRACE IN MOTION');
    this.oName.style.backgroundImage = 'linear-gradient(100deg, #fbf4ee 0%, #fbf4ee 40%, #ffd98a 50%, #fbf4ee 60%, #fbf4ee 100%)';
    this.oName.style.backgroundSize = '300% 100%'; this.oName.style.webkitBackgroundClip = 'text'; this.oName.style.backgroundClip = 'text'; this.oName.style.color = 'transparent';
    this.oHandle = el('div', 'handle', box, '@GRACE_IN_MOTION616');
    this.oSeries = el('div', 'series', box, 'Honest questions about God.');
    this.oGlow = el('div', '', this.outro); Object.assign(this.oGlow.style, { position: 'absolute', left: '50%', top: '42%', width: '700px', height: '700px', margin: '-350px 0 0 -350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,120,0.22), rgba(255,205,120,0) 62%)', pointerEvents: 'none' });
    this.outro.insertBefore(this.oGlow, box);
  }

  measure() { // after fonts load: lay out caption blocks
    for (const b of this.blocks) { b.el.style.display = 'block'; b.h = b.el.offsetHeight; b.el.style.display = 'none'; }
  }

  update(t, S) {
    // ---------- top bar ----------
    this.top.style.opacity = S.topbar ?? 1;
    // ---------- captions ----------
    let active = null, aAlpha = 0;
    for (const b of this.blocks) {
      if (t >= b.start - 0.1 && t < b.end) { active = b; aAlpha = 1 - smooth(invLerp(b.end - 0.18, b.end, t)); }
    }
    if (S.noCaption) active = null;
    for (const b of this.blocks) if (b !== active && b.el.style.display !== 'none') b.el.style.display = 'none';
    const capTop = S.capTop ?? this.capTop;
    if (active) {
      const b = active; b.el.style.display = 'block'; b.el.style.top = capTop + 'px'; b.el.style.opacity = aAlpha;
      b.el.classList.toggle('dark', !!S.darkCaption);
      let ghostDone = false;
      b.toks.forEach((tk, k) => {
        const s = b.spans[k];
        if (t >= tk.reveal) {
          const a = smooth((t - tk.reveal) / 0.08);
          s.style.opacity = (0.4 + 0.6 * a).toFixed(3);
          if (tk.hl) { const u = clamp((t - tk.reveal) / 0.32); const pop = 1 + 0.16 * Math.sin(Math.PI * u) * (1 - u * 0.3); s.style.transform = `scale(${pop.toFixed(4)})`; }
          else s.style.transform = '';
        } else if (!ghostDone) { ghostDone = true; s.style.opacity = '0.4'; s.style.transform = ''; }
        else { s.style.opacity = '0'; }
      });
      this.band.style.top = (capTop - 95) + 'px'; this.band.style.height = (b.h + 190) + 'px';
    }
    const bandA = active ? aAlpha * (S.band ?? 1) : 0;
    this.band.style.opacity = bandA.toFixed(3);
    // ---------- pills ----------
    const pills = S.pills || [];
    this.pills.forEach((p, i) => {
      const P = pills[i]; const L = this.leaders[i];
      if (!P || P.a <= 0.001) { p.style.display = 'none'; L.l.setAttribute('opacity', 0); L.c.setAttribute('opacity', 0); return; }
      p.style.display = 'block'; p.textContent = P.text;
      const a = clamp(P.a); const rise = (1 - easeOut(a)) * 14;
      p.style.opacity = a; p.style.left = P.x + 'px'; p.style.top = (P.y + rise) + 'px';
      if (P.anchor) {
        const w = p.offsetWidth, h = p.offsetHeight;
        const ax = P.anchor.x, ay = P.anchor.y;
        const sx = clamp(ax, P.x + 24, P.x + w - 24), sy = ay > P.y + h ? P.y + h + rise : P.y + rise;
        const draw = clamp((a - 0.2) / 0.8);
        const ex = sx + (ax - sx) * draw, ey = sy + (ay - sy) * draw;
        L.l.setAttribute('x1', sx); L.l.setAttribute('y1', sy); L.l.setAttribute('x2', ex); L.l.setAttribute('y2', ey);
        L.l.setAttribute('opacity', a); L.c.setAttribute('cx', ex); L.c.setAttribute('cy', ey); L.c.setAttribute('opacity', draw * a);
      } else { L.l.setAttribute('opacity', 0); L.c.setAttribute('opacity', 0); }
    });
    // ---------- cards ----------
    for (const [id, C] of Object.entries(this.cards)) {
      const st = S.card && S.card.id === id ? S.card : null;
      if (!st || st.a <= 0.001) { C.el.style.display = 'none'; continue; }
      C.el.style.display = 'block';
      const a = clamp(st.a);
      C.el.style.opacity = a; C.el.style.top = (st.y + (1 - easeOut(a)) * 34) + 'px';
      C.line.tokens.forEach((tk, k) => {
        const s = C.spans[k];
        const spoken = t >= tk.start - 0.05;
        if (tk.hl) {
          const u = clamp((t - tk.start + 0.05) / 0.35);
          s.style.transform = spoken ? `scale(${(1 + 0.12 * Math.sin(Math.PI * u)).toFixed(4)})` : '';
          s.style.textShadow = spoken ? `0 0 ${(14 * Math.sin(Math.PI * u)).toFixed(1)}px rgba(170,40,30,0.35)` : 'none';
        }
        s.style.opacity = spoken ? 1 : 0.82;
      });
    }
    // ---------- ending ----------
    const E = S.ending;
    if (E && E.a > 0.001) {
      this.end.style.display = 'block'; this.end.style.opacity = clamp(E.a);
      const jA = clamp(E.j), mA = clamp(E.m);
      this.iconJ.style.opacity = jA * (1 - 0.35 * clamp(E.pick)); this.iconJ.style.transform = `translateY(${(1 - easeOut(jA)) * 30}px) scale(${0.92 + 0.08 * easeOutBack(jA)})`;
      this.iconM.style.opacity = mA; this.iconM.style.transform = `translateY(${(1 - easeOut(mA)) * 30}px) scale(${(0.92 + 0.08 * easeOutBack(mA)) * (1 + 0.05 * clamp(E.pick))})`;
      const haloM = this.iconM.querySelector('.halo'); haloM.style.opacity = 0.35 + 0.65 * clamp(E.pick) + 0.08 * Math.sin(t * 3);
      haloM.style.transform = `scale(${0.85 + 0.25 * clamp(E.pick)})`;
      const rain = this.iconJ.querySelector('.rain'); rain.setAttribute('transform', `translate(0 ${((t * 40) % 14).toFixed(2)})`);
      this.iconJ.querySelector('.halo').style.opacity = 0.6;
      // bubble
      const bA = clamp(E.bubble);
      this.bubble.style.opacity = bA; this.bubble.style.transform = `translateY(${(1 - easeOut(bA)) * 26}px)`;
      const full = 'Mercy, because…';
      const n = Math.floor(clamp(E.typed) * full.length + 1e-6);
      this.btext.textContent = full.slice(0, n);
      this.caret.style.opacity = (Math.floor(t * 2.2) % 2 === 0 || E.typed < 1) ? 1 : 0;
      this.hearts.forEach((h, i) => {
        const t0 = E.heartsT0 + i * 0.32; const u = (t - t0) / 1.5;
        if (!(u > 0 && u < 1) || bA < 0.5) { h.style.opacity = 0; return; }
        const x = 880 + Math.sin(u * 5 + i) * 18 + (i % 2 ? 14 : -10), y = 1250 - u * 230;
        h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.opacity = (Math.sin(Math.PI * u)).toFixed(3);
        h.style.transform = `scale(${0.6 + 0.5 * u + 0.15 * hash01(i, 3)})`;
      });
    } else this.end.style.display = 'none';
    // ---------- outro ----------
    const O = S.outro;
    if (O && O.a > 0.001) {
      this.outro.style.display = 'flex'; this.outro.style.opacity = clamp(O.a);
      const u = clamp(O.u);
      const k1 = easeOut(clamp(u / 0.35)), k2 = easeOut(clamp((u - 0.18) / 0.35)), k3 = easeOut(clamp((u - 0.3) / 0.35));
      this.oMark.style.opacity = k1; this.oMark.style.transform = `scale(${0.88 + 0.12 * easeOutBack(clamp(u / 0.4))})`;
      this.oName.style.opacity = k2; this.oName.style.transform = `translateY(${(1 - k2) * 18}px)`;
      this.oHandle.style.opacity = k3; this.oSeries.style.opacity = k3 * 0.9;
      const sh = clamp((u - 0.35) / 0.5);
      this.oSheen.style.transform = `translateX(${(-120 + 240 * sh).toFixed(1)}%)`; this.oSheen.style.opacity = Math.sin(Math.PI * sh);
      this.oName.style.backgroundPosition = `${(100 - 100 * sh).toFixed(1)}% 0`;
      this.oGlow.style.opacity = 0.6 + 0.4 * Math.sin(Math.PI * clamp(u));
    } else this.outro.style.display = 'none';
  }
}

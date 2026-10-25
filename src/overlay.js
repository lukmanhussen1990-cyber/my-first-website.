import * as THREE from 'three';
import { clamp, smooth, ramp, easeOut, easeOutBack, bump, noise1, hash, window01 } from './util.js';

// DOM overlays, all driven by t (no CSS animations). Safe zone: x 60–960, y 220–1500.
const $ = (id) => document.getElementById(id);
const CAP_TOP = 300, CAP_LEFT = 60;

export class Overlays {
  constructor(timings, logoUrl) {
    this.T = timings;
    this.logoUrl = logoUrl;
    this.capEl = $('captions');
    this.band = $('band');
    this.pages = [];
    this.cards = [];
    this.pills = [];
    this.buildTopbar();
    this.buildCaptions();
    this.buildCards();
    this.buildEnd();
    this.buildOutro();
    this.leaders = $('leaders');
  }

  buildTopbar() {
    $('topbar').innerHTML = `<div class="l"><img src="${this.logoUrl}"><span>GRACE IN MOTION<span class="sep"> · </span>HONEST QUESTIONS</span></div><div class="r">THE SKY</div>`;
  }

  // ---- captions: one page per spoken line (Scripture lines become cards)
  buildCaptions() {
    const lines = this.T.lines;
    lines.forEach((L, i) => {
      if (L.card) return;
      const page = document.createElement('div');
      page.className = 'page';
      const spans = L.words.map((w, k) => {
        const s = document.createElement('span');
        s.className = 'w' + (w.hl ? ' hl' : '');
        s.textContent = w.text + (k < L.words.length - 1 ? ' ' : '');
        page.appendChild(s);
        return s;
      });
      this.capEl.appendChild(page);
      const next = lines[i + 1];
      const start = i === 0 ? 0 : L.words[0].s - 0.08;
      let end = next ? next.words[0].s - 0.2 : this.T.voice_end + 0.6;
      if (next && next.card) end = next.words[0].s - 0.35;
      this.pages.push({ L, page, spans, start, end, hook: i === 0, h: 0 });
    });
  }

  updateCaptions(t) {
    let bandOp = 0, bandTop = CAP_TOP, bandH = 120;
    const loopIn = smooth(ramp(t, this.T.total - 0.75, this.T.total - 0.1)); // hook returns for a seamless loop
    for (const P of this.pages) {
      const vis = (t >= P.start - 0.01 && t < P.end + 0.2) || (P.hook && loopIn > 0);
      if (!vis) { P.page.style.display = 'none'; continue; }
      P.page.style.display = 'block';
      if (!P.h) P.h = P.page.offsetHeight;
      let op = Math.min(P.hook ? 1 : smooth(ramp(t, P.start, P.start + 0.08)), 1 - smooth(ramp(t, P.end, P.end + 0.18)));
      if (P.hook && t > P.end + 0.2) op = loopIn;
      P.page.style.opacity = op.toFixed(3);
      const ws = P.L.words;
      let lastRevealed = -1;
      if (!(P.hook && t > P.end + 0.2)) ws.forEach((w, k) => { if (t >= w.s - 0.05) lastRevealed = k; });
      ws.forEach((w, k) => {
        const s = P.spans[k];
        let o, y = 0, sc = 1;
        if (k <= lastRevealed) {
          const u = smooth(ramp(t, w.s - 0.05, w.s + 0.1));
          o = 0.4 + 0.6 * u; y = (1 - u) * 5;
          if (w.hl) sc = 1 + 0.13 * bump(t, w.s - 0.02, w.s + 0.3);
        } else if (k === lastRevealed + 1 || P.hook) o = 0.4;
        else o = 0;
        s.style.opacity = o.toFixed(3);
        s.style.transform = `translateY(${y.toFixed(2)}px) scale(${sc.toFixed(3)})`;
      });
      if (op > bandOp) { bandOp = op; bandH = P.h; }
    }
    this.band.style.opacity = (bandOp * 0.95).toFixed(3);
    this.band.style.top = `${bandTop - 70}px`;
    this.band.style.height = `${bandH + 140}px`;
  }

  // ---- Scripture cards
  buildCards() {
    for (const L of this.T.lines) {
      if (!L.card) continue;
      const card = document.createElement('div');
      card.className = 'card';
      const body = document.createElement('div');
      body.className = 'body';
      const keys = new Set(L.card.keys.map((k) => k.toLowerCase()));
      const spans = L.words.map((w, k) => {
        const s = document.createElement('span');
        const isKey = keys.has(w.text.toLowerCase());
        s.className = 'cw' + (isKey ? ' k' : '');
        let txt = isKey ? w.text.toUpperCase() : w.text;
        if (k === 0) txt = '“' + txt;
        if (k === L.words.length - 1) txt = txt + '”';
        s.textContent = txt + (k < L.words.length - 1 ? ' ' : '');
        body.appendChild(s);
        return s;
      });
      const ref = document.createElement('div');
      ref.className = 'ref';
      ref.textContent = L.card.ref;
      card.append(body, ref);
      $('cards').appendChild(card);
      const idx = this.T.lines.indexOf(L);
      const next = this.T.lines[idx + 1];
      const start = L.words[0].s - 0.45;
      const end = next ? next.words[0].s - 0.25 : L.end + 1;
      this.cards.push({ L, card, spans, start, end });
    }
  }
  updateCards(t) {
    for (const C of this.cards) {
      if (t < C.start || t > C.end + 0.05) { C.card.style.display = 'none'; continue; }
      C.card.style.display = 'block';
      const inn = easeOut(ramp(t, C.start, C.start + 0.5));
      const out = smooth(ramp(t, C.end - 0.35, C.end));
      C.card.style.top = `${CAP_TOP - 4 + (1 - inn) * 46 - out * 18}px`;
      C.card.style.opacity = (Math.min(inn, 1 - out)).toFixed(3);
      C.L.words.forEach((w, k) => {
        const u = smooth(ramp(t, w.s - 0.06, w.s + 0.12));
        C.spans[k].style.opacity = (0.34 + 0.66 * u).toFixed(3);
      });
    }
  }
  cardActive(t) { return this.cards.some((C) => t >= C.start && t <= C.end); }

  // ---- label pills: {text, t0, t1, at:[x,y] | anchor(): Vector3, camera, leader}
  addPill(p) {
    const el = document.createElement('div');
    el.className = 'pill';
    el.textContent = p.text;
    $('pills').appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    line.setAttribute('stroke', 'rgba(242,235,221,0.9)'); line.setAttribute('stroke-width', '2.2');
    dot.setAttribute('r', '5.5'); dot.setAttribute('fill', '#f2ebdd');
    $('leaders').append(line, dot);
    this.pills.push({ ...p, el, line, dot, w: 0 });
  }
  updatePills(t, cams) {
    for (const P of this.pills) {
      const k = window01(t, P.t0, P.t1, 0.28, 0.25);
      if (k <= 0) { P.el.style.display = 'none'; P.line.style.display = 'none'; P.dot.style.display = 'none'; continue; }
      P.el.style.display = 'block';
      if (!P.w) { P.w = P.el.offsetWidth; P.h = P.el.offsetHeight; }
      let [x, y] = P.at;
      if (P.center) x = 540 - P.w / 2;
      x = clamp(x, 60, 960 - P.w);
      const rise = (1 - easeOut(ramp(t, P.t0, P.t0 + 0.35))) * 14;
      P.el.style.left = `${x}px`; P.el.style.top = `${y + rise}px`; P.el.style.opacity = k.toFixed(3);
      if (P.anchor && cams[P.shot]) {
        const v = P.anchor().project(cams[P.shot]);
        const ax = (v.x * 0.5 + 0.5) * 1080, ay = (-v.y * 0.5 + 0.5) * 1920;
        const sx = clamp(ax, x + 24, x + P.w - 24), sy = y + rise + (ay > y ? P.h : 0);
        const g = easeOut(ramp(t, P.t0 + 0.12, P.t0 + 0.5));
        const ex = sx + (ax - sx) * g, ey = sy + (ay - sy) * g;
        for (const el of [P.line, P.dot]) { el.style.display = 'block'; el.style.opacity = k.toFixed(3); }
        P.line.setAttribute('x1', sx); P.line.setAttribute('y1', sy); P.line.setAttribute('x2', ex); P.line.setAttribute('y2', ey);
        P.dot.setAttribute('cx', ex); P.dot.setAttribute('cy', ey);
      } else { P.line.style.display = 'none'; P.dot.style.display = 'none'; }
    }
  }

  // ---- floating "?" (S2)
  qmark(t, pos, k) {
    const q = $('qmark');
    if (k <= 0) { q.style.opacity = 0; return; }
    q.style.opacity = k.toFixed(3);
    q.style.left = `${pos[0] - 34}px`; q.style.top = `${pos[1] - 90}px`;
    q.style.transform = `rotate(${(Math.sin(t * 2.1) * 6).toFixed(2)}deg) scale(${(0.8 + 0.2 * easeOutBack(k)).toFixed(3)})`;
  }

  // ---- ending: PROOF vs FAITH, comment bubble, hearts
  buildEnd() {
    const e = $('end');
    e.innerHTML = `
      <div class="icon" id="iProof" style="left:122px; top:640px">
        <svg width="320" height="320" viewBox="0 0 250 250">
          <defs><radialGradient id="gp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#cfe0f0" stop-opacity="0.38"/><stop offset="1" stop-color="#cfe0f0" stop-opacity="0"/></radialGradient></defs>
          <circle cx="125" cy="125" r="122" fill="url(#gp)"/>
          <g transform="translate(58,40)">
            <path d="M0 10 Q0 0 10 0 H88 L118 30 V158 Q118 168 108 168 H10 Q0 168 0 158 Z" fill="#eef1f2" stroke="#c9d3da" stroke-width="3"/>
            <path d="M88 0 V30 H118" fill="#d7dfe5"/>
            <rect x="18" y="44" width="70" height="7" rx="3.5" fill="#9aa8b2"/><rect x="18" y="64" width="82" height="7" rx="3.5" fill="#9aa8b2"/>
            <rect x="18" y="84" width="58" height="7" rx="3.5" fill="#9aa8b2"/><rect x="18" y="104" width="76" height="7" rx="3.5" fill="#9aa8b2"/>
          </g>
          <g id="lens"><circle cx="150" cy="150" r="40" fill="rgba(205,225,240,0.35)" stroke="#3c4a55" stroke-width="12"/>
          <rect x="176" y="183" width="16" height="52" rx="7" transform="rotate(-42 184 209)" fill="#3c4a55"/></g>
        </svg>
        <div class="lbl">PROOF</div>
      </div>
      <div class="icon" id="iFaith" style="left:618px; top:640px">
        <svg width="320" height="320" viewBox="0 0 250 250">
          <defs><radialGradient id="gf" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient>
          <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e5534b"/><stop offset="0.55" stop-color="#f5a03a"/><stop offset="1" stop-color="#ffe7a0"/></linearGradient></defs>
          <circle cx="125" cy="135" r="122" fill="url(#gf)"/>
          <g id="flame" transform="translate(125,200)">
            <path id="fo" d="M0 0 C-48 0 -60 -40 -40 -78 C-30 -98 -12 -110 -8 -150 C18 -122 50 -96 52 -56 C54 -20 34 0 0 0 Z" fill="url(#fl)"/>
            <path id="fi" d="M0 0 C-22 0 -28 -20 -18 -40 C-12 -52 -4 -58 -2 -78 C12 -62 26 -48 26 -28 C26 -10 16 0 0 0 Z" fill="#fff4cf"/>
          </g>
          <rect x="88" y="200" width="74" height="16" rx="8" fill="#6a4a30"/>
        </svg>
        <div class="lbl">FAITH</div>
      </div>
      <div class="bubble" id="bubble"><div class="av"><img src="${this.logoUrl}"></div><span id="btext"></span><span class="caret" id="caret"></span></div>
      <div id="hearts"></div>`;
    this.hearts = [];
    const hs = $('hearts');
    for (let i = 0; i < 9; i++) {
      const h = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      h.setAttribute('viewBox', '0 0 44 40'); h.classList.add('heart');
      h.innerHTML = '<path d="M22 38 C10 28 0 21 0 11 C0 4 5 0 11 0 C16 0 20 3 22 7 C24 3 28 0 33 0 C39 0 44 4 44 11 C44 21 34 28 22 38 Z" fill="#d1453f"/>';
      hs.appendChild(h); this.hearts.push(h);
    }
  }
  updateEnd(t, E) { // E: {t0, t1, proofT, faithT, bubbleT, out}
    const e = $('end');
    const k = Math.min(smooth(ramp(t, E.t0, E.t0 + 0.45)), 1 - smooth(ramp(t, E.t1 - 0.35, E.t1)));
    if (k <= 0) { e.style.display = 'none'; return; }
    e.style.display = 'block'; e.style.opacity = k.toFixed(3);
    const pop = (el, t0) => {
      const u = ramp(t, t0, t0 + 0.45);
      el.style.opacity = smooth(u * 1.6).toFixed(3);
      el.style.transform = `translateY(${((1 - easeOut(u)) * 30).toFixed(1)}px) scale(${(0.82 + 0.18 * easeOutBack(u)).toFixed(3)})`;
    };
    pop($('iProof'), E.proofT); pop($('iFaith'), E.faithT);
    // lens wobble + flame flicker
    const lens = $('lens');
    lens.setAttribute('transform', `translate(${(Math.sin(t * 1.3) * 6).toFixed(2)},${(Math.cos(t * 1.1) * 4).toFixed(2)})`);
    const f = 1 + (noise1(t * 6, 3) - 0.5) * 0.12, sk = (noise1(t * 4, 9) - 0.5) * 0.12;
    $('flame').setAttribute('transform', `translate(125,200) scale(${(1 + (noise1(t * 5, 1) - 0.5) * 0.08).toFixed(3)},${f.toFixed(3)}) skewX(${(sk * 30).toFixed(2)})`);
    // the faith icon warms up once chosen
    const chosen = smooth(ramp(t, E.bubbleT, E.bubbleT + 0.6));
    $('iProof').style.filter = `saturate(${(1 - chosen * 0.6).toFixed(2)}) brightness(${(1 - chosen * 0.25).toFixed(2)})`;
    // comment bubble types "Faith, because…"
    const b = $('bubble');
    const bu = ramp(t, E.bubbleT, E.bubbleT + 0.4);
    b.style.opacity = smooth(bu).toFixed(3);
    b.style.transform = `translateY(${((1 - easeOut(bu)) * 40).toFixed(1)}px)`;
    const msg = 'Faith, because…';
    const n = Math.floor(clamp((t - E.bubbleT - 0.35) / 0.09, 0, msg.length));
    $('btext').textContent = msg.slice(0, n);
    $('caret').style.opacity = (Math.floor(t * 2.2) % 2 === 0 || n < msg.length) ? 1 : 0;
    this.typed = n;
    // hearts rise from the bubble
    this.hearts.forEach((h, i) => {
      const t0 = E.bubbleT + 0.9 + i * 0.22;
      const u = ramp(t, t0, t0 + 1.5);
      if (u <= 0 || u >= 1) { h.style.opacity = 0; return; }
      const x = 840 + Math.sin(u * 6 + i) * 22 + (hash(i) - 0.5) * 40, y = 1170 - u * 260;
      h.style.left = `${x}px`; h.style.top = `${y}px`;
      h.style.opacity = (Math.sin(u * Math.PI) * 0.95).toFixed(3);
      h.style.transform = `scale(${(0.6 + 0.5 * hash(i + 2) + 0.2 * Math.sin(u * 3)).toFixed(3)}) rotate(${((hash(i + 5) - 0.5) * 30).toFixed(1)}deg)`;
    });
  }

  // ---- logo outro
  buildOutro() {
    $('outro').innerHTML = `<div class="logo"><img src="${this.logoUrl}"></div><div class="name">GRACE IN MOTION</div><div class="sub">HONEST QUESTIONS</div>`;
  }
  updateOutro(t, O) { // O: {t0, t1}
    const o = $('outro');
    if (t < O.t0 || t > O.t1) { o.style.display = 'none'; return 0; }
    o.style.display = 'flex';
    const lt = t - O.t0, D = O.t1 - O.t0;
    const inn = smooth(ramp(lt, 0, 0.45)), out = smooth(ramp(lt, D - 0.75, D - 0.1));
    o.style.opacity = Math.min(inn, 1 - out).toFixed(3);
    const logo = o.querySelector('.logo'), name = o.querySelector('.name'), sub = o.querySelector('.sub');
    logo.style.transform = `scale(${(0.9 + 0.1 * easeOutBack(ramp(lt, 0, 0.6)) + 0.02 * lt).toFixed(3)})`;
    name.style.opacity = smooth(ramp(lt, 0.2, 0.65)).toFixed(3);
    name.style.transform = `translateY(${((1 - easeOut(ramp(lt, 0.2, 0.7))) * 18).toFixed(1)}px)`;
    name.style.backgroundPosition = `${(100 - ramp(lt, 0.45, 1.6) * 100).toFixed(1)}% 0`;
    sub.style.opacity = (smooth(ramp(lt, 0.45, 0.9)) * 0.9).toFixed(3);
    logo.style.boxShadow = `0 0 0 3px rgba(233,196,120,0.55), 0 0 ${(60 + 50 * bump(lt, 0.4, 1.8)).toFixed(0)}px rgba(233,180,90,${(0.3 + 0.3 * bump(lt, 0.4, 1.8)).toFixed(2)})`;
    return Math.min(inn, 1 - out);
  }

  setTopbar(k) { $('topbar').style.opacity = k.toFixed(3); $('watermark').style.opacity = k.toFixed(3); }

  update(t, ctx) {
    $('topshade').style.opacity = clamp(ctx.shade ?? 0).toFixed(3);
    this.updateCaptions(t);
    this.updateCards(t);
    this.updatePills(t, ctx.cams);
    this.updateEnd(t, ctx.end);
    const ok = this.updateOutro(t, ctx.outro);
    this.setTopbar(1 - ok);
  }
}

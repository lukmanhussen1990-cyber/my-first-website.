// Screen-space layers: captions, light-slit / dip transitions, floating dust
// and paper grain. Everything is a pure function of t.
const OV = (() => {
  let TL, capRoot, groups = [], fx = {}, dustCtx, specks, source;
  // caption height by script line, so a caption never jumps when a cut lands mid-phrase
  const CAP_Y = { 2: 1236, 12: 560, 13: 860 };

  function initCaptions() {
    capRoot = document.getElementById('captions');
    for (const g of TL.groups) {
      const div = document.createElement('div');
      div.className = 'cap';
      const fear = g.words.some(w => /fear/i.test(w.text));
      if (fear) div.classList.add('fear');
      const spans = [];
      g.words.forEach((w, i) => {
        if (i) div.appendChild(document.createTextNode(' '));
        const s = document.createElement('span');
        s.className = 'w' + (w.hl ? ' hl' : '');
        if (w.text === 'ﷺ') { s.classList.add('pbuh'); s.textContent = 'ﷺ'; }
        else s.textContent = w.text;
        div.appendChild(s);
        spans.push(s);
      });
      div.style.display = 'none';
      capRoot.appendChild(div);
      groups.push({ g, div, spans, fear });
    }
    source = document.createElement('div');
    source.className = 'cap src';
    source.textContent = 'Sahih al-Bukhari 2272 · Sahih Muslim 2743';
    capRoot.appendChild(source);
  }

  function updateCaptions(t, sc) {
    for (const G of groups) {
      const { g, div, spans } = G;
      const on = t >= g.s - 0.05 && t < g.hide;
      if (!on) { if (div.style.display !== 'none') div.style.display = 'none'; continue; }
      div.style.display = '';
      const y = CAP_Y[g.line] || 470;
      const big = g.line >= 12;
      const out = 1 - smooth(seg(t, g.hide - 0.16, g.hide));
      div.style.opacity = out.toFixed(3);
      div.style.fontSize = (G.fear ? 96 : big ? 80 : 70) + 'px';
      div.style.top = y + 'px';
      div.style.transform = 'translateY(-50%)';
      if (G.fear) {
        const k = 0.5 + 0.5 * Math.sin((t - g.s) * 4);
        div.style.filter = `drop-shadow(0 0 ${(10 + 12 * k).toFixed(1)}px rgba(127,216,201,${(0.45 + 0.3 * k).toFixed(2)}))`;
      }
      g.words.forEach((w, i) => {
        const k = clamp((t - (w.s - 0.1)) / 0.3);
        const e = easeOut(k);
        spans[i].style.opacity = e.toFixed(3);
        spans[i].style.transform = `translateY(${((1 - e) * 26).toFixed(1)}px)`;
      });
    }
    const sk = smooth(seg(t, TL.E.curtain[1] - 0.2, TL.E.curtain[1] + 0.6));
    source.style.display = sk > 0 ? '' : 'none';
    source.style.opacity = sk.toFixed(3);
  }

  function initFx() {
    const svg = document.getElementById('fx');
    const f = el('filter', { id: 'slitGlow', x: '-400%', y: '-10%', width: '900%', height: '120%' }, svg);
    el('feGaussianBlur', { stdDeviation: 7 }, f);
    fx.L = el('rect', { x: 0, y: -10, width: 540, height: 1940, fill: '#000' }, svg);
    fx.R = el('rect', { x: 540, y: -10, width: 540, height: 1940, fill: '#000' }, svg);
    fx.glow = el('path', { d: '', stroke: '#FFE3A0', 'stroke-width': 10, filter: 'url(#slitGlow)', fill: 'none' }, svg);
    fx.line = el('path', { d: '', stroke: '#FFF6DE', 'stroke-width': 3, fill: 'none' }, svg);
    fx.dip = el('rect', { x: 0, y: 0, width: 1080, height: 1920, fill: '#000', opacity: 0 }, svg);
  }

  // gap: open width (0..1080); h: line height (0..1920)
  function slit(gap, h, glow) {
    const l = 540 - gap / 2, r = 540 + gap / 2;
    fx.L.setAttribute('width', Math.max(0, l).toFixed(1));
    fx.R.setAttribute('x', r.toFixed(1)); fx.R.setAttribute('width', Math.max(0, 1080 - r).toFixed(1));
    const y0 = 960 - h / 2, y1 = 960 + h / 2;
    const d = gap < 2 ? `M540 ${y0}V${y1}` : `M${l} ${y0}V${y1}M${r} ${y0}V${y1}`;
    fx.line.setAttribute('d', glow > 0 ? d : ''); fx.glow.setAttribute('d', glow > 0 ? d : '');
    fx.line.setAttribute('opacity', glow.toFixed(3)); fx.glow.setAttribute('opacity', glow.toFixed(3));
  }

  function updateFx(t, sc) {
    const { S, E } = TL;
    let black = 0;
    // dip-to-black at plain cuts
    for (const k of ['storm', 'first', 'dua1', 'second', 'dua2', 'third', 'dua3', 'moral']) {
      black = Math.max(black, 1 - clamp(Math.abs(t - S[k].s) / 0.22));
    }
    black = Math.max(black, smooth(seg(t, S.hook.e - 0.45, S.hook.e - 0.05)) * (t < S.hook.e ? 1 : 0));
    if (t >= S.inside.s) black = Math.max(black, 1 - smooth(seg(t, S.inside.s, S.inside.s + 0.5)));
    // the reel opens from black
    black = Math.max(black, 1 - smooth(seg(t, 0, 0.35)));
    // and fades out at the very end
    black = Math.max(black, smooth(seg(t, E.end - 0.5, E.end)));
    fx.dip.setAttribute('opacity', black.toFixed(3));

    if (sc.id === 'title' && t < E.titleOpen[1]) {
      const p = seg(t, ...E.titleOpen);
      if (p < 0.32) slit(0, 1920 * easeOut(p / 0.32), 1);
      else { const g = 1080 * easeInOut((p - 0.32) / 0.68); slit(g, 1920, 1 - smooth(g / 700)); }
    } else if (sc.id === 'rock' && t >= E.slitClose[0]) {
      const p = seg(t, ...E.slitClose);
      if (p < 0.72) { const g = 1080 * (1 - easeInOut(p / 0.72)); slit(g, 1920, 1 - smooth(g / 700)); }
      else slit(0, 1920 * (1 - easeIn((p - 0.72) / 0.28)), 1 - smooth((p - 0.9) / 0.1));
    } else slit(1200, 0, 0);
  }

  function initDust() {
    const c = document.getElementById('dust');
    dustCtx = c.getContext('2d');
    const R = rng(77);
    specks = Array.from({ length: 70 }, () => ({ x: R() * 1080, y: R() * 1920, r: 0.9 + R() * 2.4, sp: 5 + R() * 16, ph: R() * 6.28, a: 0.25 + R() * 0.55 }));
  }
  function updateDust(t) {
    const ctx = dustCtx;
    ctx.clearRect(0, 0, 1080, 1920);
    for (const s of specks) {
      const y = ((s.y - t * s.sp) % 1920 + 1920) % 1920;
      const x = s.x + 22 * Math.sin(t * 0.31 + s.ph) + 8 * Math.sin(t * 0.9 + s.ph * 2);
      const w = 0.25 + 0.75 * Math.exp(-Math.pow((x - 540) / 430, 2) - Math.pow((y - 1080) / 640, 2));
      const a = s.a * (0.55 + 0.45 * Math.sin(t * 1.6 + s.ph)) * w;
      ctx.fillStyle = `rgba(243,230,200,${(a * 0.35).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s.r * 2.6, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,246,222,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
    }
  }

  function initGrain() {
    const c = document.getElementById('grain');
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(1080, 1920);
    const R = rng(4242);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (R() + R() + R() - 1.5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // soft paper blotches from an upscaled low-res noise field
    const s = document.createElement('canvas');
    s.width = 54; s.height = 96;
    const sx = s.getContext('2d'), si = sx.createImageData(54, 96);
    for (let i = 0; i < si.data.length; i += 4) {
      const v = 128 + (R() - 0.5) * 90;
      si.data[i] = si.data[i + 1] = si.data[i + 2] = v; si.data[i + 3] = 255;
    }
    sx.putImageData(si, 0, 0);
    ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, 0, 0, 1080, 1920);
    // fibres
    ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    for (let i = 0; i < 700; i++) {
      const x = R() * 1080, y = R() * 1920, a = R() * 6.28, L = 8 + R() * 30;
      ctx.strokeStyle = R() < 0.5 ? '#fff' : '#000';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * L * 0.5, y + Math.sin(a + 0.6) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
      ctx.stroke();
    }
  }

  return {
    init(tl) { TL = tl; initCaptions(); initFx(); initDust(); initGrain(); },
    update(t, sc) { updateCaptions(t, sc); updateFx(t, sc); updateDust(t); },
    hideCaptions() { capRoot.style.display = 'none'; },
  };
})();

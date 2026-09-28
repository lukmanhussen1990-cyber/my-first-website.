/* renderer.js - composes one frame for any time t.
   Layout: a portrait 1080x1920 frame, black letterbox, and a paper "band"
   in the middle (16:9 for lyrics, 3:2 for illustrations). All band
   drawing happens in a 1080x720 layer space centred in the frame. */
(function () {
  'use strict';
  const BV = window.BV;
  const U = BV.util;
  const B = BV.brush;

  const LW = 1080; // layer width
  const LH = 720; // layer height
  const BAND_TEXT = 608; // 16:9
  const BAND_ART = 720; // 3:2
  const XH = 23; // lyric x-height
  const LINE = 76; // lyric line spacing
  const BASE0 = 150; // first baseline inside the text layer
  const MOVE = 0.12; // seconds for the stack to re-centre
  const ART_DRAW = 1.25; // seconds for an illustration to paint in

  // ---------- procedural paper ----------
  function makePaper(o) {
    const c = U.makeCanvas(LW, LH);
    const x = c.getContext('2d');
    const r = U.rng(o.seed);
    const [br, bg, bb] = o.base;
    x.fillStyle = `rgb(${br},${bg},${bb})`;
    x.fillRect(0, 0, LW, LH);
    // soft mottling
    for (let i = 0; i < 90; i++) {
      const cx = r() * LW, cy = r() * LH, rad = 60 + r() * 300;
      const dark = r() < 0.55;
      const a = o.mottle * (0.3 + r() * 0.7);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, dark ? `rgba(60,40,20,${a})` : `rgba(255,255,250,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // paper fibres
    x.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const px = r() * LW, py = r() * LH, len = 6 + r() * 34, ang = r() * Math.PI * 2;
      const bend = (r() - 0.5) * 10;
      x.strokeStyle = r() < 0.6 ? `rgba(70,50,30,${o.fibres * r()})` : `rgba(255,255,255,${o.fibres * 1.4 * r()})`;
      x.lineWidth = 0.5 + r() * 0.9;
      x.beginPath();
      x.moveTo(px, py);
      x.quadraticCurveTo(px + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend, py + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      x.stroke();
    }
    // tooth: fine per-pixel grain
    const img = x.getImageData(0, 0, LW, LH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * o.tooth;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    // vignette
    const v = x.createRadialGradient(LW / 2, LH / 2, LH * 0.25, LW / 2, LH / 2, LW * 0.72);
    const [er, eg, eb] = o.edge;
    v.addColorStop(0, `rgba(${er},${eg},${eb},0)`);
    v.addColorStop(1, `rgba(${er},${eg},${eb},${o.vignette})`);
    x.fillStyle = v;
    x.fillRect(0, 0, LW, LH);
    return c;
  }

  function makeGrain(seed) {
    const w = LW / 2, h = LH / 2;
    const c = U.makeCanvas(w, h);
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const r = U.rng(seed);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() + r() - 1) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function createRenderer(canvas) {
    const cfg = BV.config;
    const W = cfg.width, H = cfg.height;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const bandCY = H / 2;
    const layerTop = bandCY - LH / 2;

    const paper = makePaper({ base: [243, 248, 242], seed: 11, mottle: 0.012, fibres: 0.045, tooth: 8, edge: [150, 162, 150], vignette: 0.1 });
    // faint watercolour blooms so the plain paper feels hand-painted
    [[140, 120, '#b8ccb4'], [960, 600, '#e9c7ad'], [920, 110, '#c9c3d9'], [170, 610, '#e7cdb4'], [560, 30, '#cfdcc8']].forEach(([x, y, c], i) => {
      B.drawWash(paper.getContext('2d'), B.makeWash(U.arc(x, y, 230, 170, 0, 340, 20), { color: c, alpha: 0.0045, layers: 24, variance: 0.3, seed: 500 + i }), 1);
    });
    const dark = makePaper({ base: [31, 33, 30], seed: 37, mottle: 0.025, fibres: 0.03, tooth: 6, edge: [0, 0, 0], vignette: 0.35 });
    const grains = [101, 102, 103].map(makeGrain);

    const textLayer = U.makeCanvas(LW, LH);
    const tctx = textLayer.getContext('2d');
    const blurLayer = U.makeCanvas(LW, LH);
    const bctx = blurLayer.getContext('2d');
    const artLayer = U.makeCanvas(LW, LH);
    const actx = artLayer.getContext('2d');

    // ---------- lyrics ----------
    const phrases = cfg.phrases.map((p, pi) => {
      const words = p.words.map(([text, t], k) => ({
        text,
        t,
        dur: BV.lettering.writeDuration(text),
        glyphs: BV.lettering.word(text, LW / 2, BASE0 + k * LINE, 1000 + pi * 37 + k * 7, { xh: XH }),
      }));
      return { words, start: words[0].t, end: p.end, dy: p.dy || 0 };
    });

    // Vertical offset that keeps the visible stack centred in the band.
    function stackOffset(ph, t) {
      const centre = LH / 2 + ph.dy;
      let off = centre - (BASE0 - XH * 0.5);
      for (let k = 1; k < ph.words.length; k++) off -= (LINE / 2) * U.easeOut((t - ph.words[k].t) / MOVE);
      return off;
    }

    function drawPhrases(target, t, alphaMul) {
      for (const ph of phrases) {
        if (t < ph.start || t > ph.end) continue;
        const alpha = (1 - U.smooth(ph.end - 0.16, ph.end, t)) * alphaMul;
        if (alpha <= 0) continue;
        tctx.clearRect(0, 0, LW, LH);
        for (const w of ph.words) {
          if (t < w.t) break;
          BV.lettering.drawWord(tctx, w.glyphs, (t - w.t) / w.dur, 1);
        }
        const off = stackOffset(ph, t);
        const shutter = 1 / cfg.fps;
        let src = textLayer;
        if (Math.abs(off - stackOffset(ph, t - shutter)) > 0.5) {
          // motion blur: average several positions across the shutter
          const S = 7;
          bctx.clearRect(0, 0, LW, LH);
          bctx.globalCompositeOperation = 'lighter';
          bctx.globalAlpha = 1 / S;
          for (let j = 0; j < S; j++) bctx.drawImage(textLayer, 0, stackOffset(ph, t - (shutter * j) / (S - 1)) - off);
          bctx.globalCompositeOperation = 'source-over';
          bctx.globalAlpha = 1;
          src = blurLayer;
        }
        target.save();
        target.globalCompositeOperation = 'multiply';
        target.globalAlpha = alpha;
        target.drawImage(src, 0, off);
        target.restore();
      }
    }

    // ---------- illustrations ----------
    const artCache = {};
    function getArt(name) {
      if (!artCache[name]) {
        const a = BV.art.build(name);
        const N = a.lines.length;
        a.lines.forEach((s, i) => {
          s.a0 = 0.15 + (i / Math.max(1, N)) * 0.65;
          s.a1 = s.a0 + 0.2;
        });
        // silhouettes are baked once and ink in with an alpha ramp
        a.fillCanvas = U.makeCanvas(LW, LH);
        const fc = a.fillCanvas.getContext('2d');
        for (const f of a.fills) B.drawWash(fc, f, 1);
        artCache[name] = a;
      }
      return artCache[name];
    }

    function drawArt(target, name, local, alpha) {
      const a = getArt(name);
      const g = local / ART_DRAW;
      let lines;
      if (g >= 1) {
        if (!a.linesCanvas) {
          a.linesCanvas = U.makeCanvas(LW, LH);
          const lc = a.linesCanvas.getContext('2d');
          for (const s of a.lines) B.draw(lc, s, 1);
        }
        lines = a.linesCanvas;
      } else {
        actx.clearRect(0, 0, LW, LH);
        for (const s of a.lines) {
          const p = (g - s.a0) / (s.a1 - s.a0);
          if (p > 0) B.draw(actx, s, Math.min(1, U.easeOut(p)));
        }
        lines = artLayer;
      }
      target.save();
      target.globalAlpha = alpha;
      target.drawImage(a.back, 0, 0);
      target.globalAlpha = alpha * U.easeInOut(U.smooth(0.0, 0.7, g));
      target.drawImage(a.fillCanvas, 0, 0);
      target.globalAlpha = alpha;
      target.drawImage(lines, 0, 0);
      // living light: glows breathe slowly
      target.globalCompositeOperation = 'screen';
      for (const gl of a.glows) {
        const rad = gl.r * (1 + 0.06 * Math.sin(local * 2.6));
        const grd = target.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, rad);
        const v = parseInt(gl.color.slice(1), 16);
        const rgb = `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`;
        grd.addColorStop(0, `rgba(${rgb},${gl.a})`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        target.globalAlpha = alpha * U.smooth(0.2, 1, g);
        target.fillStyle = grd;
        target.fillRect(gl.x - rad, gl.y - rad, rad * 2, rad * 2);
      }
      // keep it on paper: multiply the paper texture back over the painting
      target.globalCompositeOperation = 'multiply';
      target.globalAlpha = alpha * 0.7;
      target.drawImage(paper, 0, 0);
      target.restore();
    }

    function sceneAt(t) {
      for (const s of cfg.scenes) {
        if (t > s.t0 && t < s.t1) return { s, a: U.envelope(t, s.t0, s.t1, 0.4, 0.38), local: t - s.t0 };
      }
      return null;
    }

    // ---------- intro: a glowing brush ring bursts, paper is swept in ----------
    const RING0 = 300; // built at this radius, then scaled
    const introRing = B.make(U.arc(0, 0, RING0, RING0, -80, 262, 4), {
      w: 42, tin: 60, tout: 420, dry: 0.5, color: '#fbfaf0', seed: 5, edge: 0.2,
    });
    function drawIntro(t) {
      const T = cfg.introEnd;
      const k = t / T;
      const R = 40 + 1100 * Math.pow(k, 2.2);
      ctx.save();
      ctx.translate(W / 2, bandCY);
      ctx.scale(R / RING0, R / RING0);
      ctx.shadowColor = 'rgba(255,250,230,0.9)';
      ctx.shadowBlur = 40;
      B.draw(ctx, introRing, U.clamp(k / 0.4, 0, 1), 1 - U.smooth(0.55, 1, k));
      ctx.restore();
      // paper blooms in from a soft flash of light
      const p = U.smooth(0.5, 1, k);
      if (p > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, bandCY - BAND_TEXT / 2, W, BAND_TEXT);
        ctx.clip();
        ctx.globalAlpha = p;
        ctx.drawImage(paper, 0, layerTop);
        ctx.globalAlpha = (1 - p) * p * 2.2;
        ctx.fillStyle = '#fffbee';
        ctx.fillRect(0, layerTop, W, LH);
        ctx.restore();
      }
    }

    // ---------- end card ----------
    const ENSO_R = 78;
    const ensoPts = U.arc(0, 0, ENSO_R, ENSO_R, -70, 262, 5).map((p, i, arr) => {
      const u = i / (arr.length - 1);
      const rr = 1 + 0.04 * Math.sin(u * 9) - 0.05 * u;
      return [p[0] * rr, p[1] * rr];
    });
    const enso = B.make(ensoPts, { w: 17, tin: 10, tout: 140, dry: 0.55, color: '#f3eee2', seed: 77, swell: 0.3, edge: 0.18 });
    const heartPts = [
      [0, -0.3], [-0.2, -0.72], [-0.62, -0.74], [-0.88, -0.34], [-0.72, 0.16], [-0.34, 0.52], [0, 0.86, 1],
      [0.34, 0.52], [0.72, 0.16], [0.88, -0.34], [0.62, -0.74], [0.2, -0.72], [0.03, -0.34],
    ].map((p) => {
      const q = [p[0] * 30, p[1] * 30];
      if (p[2]) q.push(1);
      return q;
    });
    const heart = B.make(heartPts, { w: 7, tin: 6, tout: 30, dry: 0.3, color: '#f3eee2', seed: 88 });
    const handle = cfg.handle ? BV.lettering.word(cfg.handle, 0, 0, 4242, { xh: 17, color: '#e9e4d8', dry: 0.25 }) : null;

    function drawEnd(t, alpha) {
      const cx = W / 2, cy = bandCY - 30;
      const pr = U.easeInOut((t - (cfg.endAt + 0.08)) / 0.6);
      const hp = U.easeInOut((t - (cfg.endAt + 0.45)) / 0.5);
      // colour washes through the ring and back to cream
      const colour = U.envelope(t, cfg.endAt + 0.5, cfg.endAt + 3.1, 0.7, 0.8);
      // gradient lives in stroke space (the ring is centred on 0,0)
      const grad = ctx.createConicGradient(-Math.PI / 2 + t * 1.3, 0, 0);
      ['#ffd27a', '#ff8a5b', '#ff5f7e', '#b06ab3', '#ffd27a'].forEach((c, i, a) => grad.addColorStop(i / (a.length - 1), c));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      if (pr > 0) {
        B.draw(ctx, enso, pr, 1 - colour);
        B.draw(ctx, heart, hp, 1 - colour);
        if (colour > 0) {
          B.draw(ctx, enso, pr, colour, grad);
          B.draw(ctx, heart, hp, colour, grad);
        }
      }
      ctx.restore();
      if (handle) {
        const p = (t - (cfg.endAt + 0.6)) / 0.9;
        if (p > 0) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy + ENSO_R + 62);
          BV.lettering.drawWord(ctx, handle, p, 1);
          ctx.restore();
        }
      }
    }

    // ---------- frame ----------
    function render(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (t < cfg.introEnd) {
        drawIntro(t);
        return;
      }

      const sc = sceneAt(t);
      const mix = sc ? sc.a : 0;
      const bandH = U.lerp(BAND_TEXT, BAND_ART, U.easeInOut(mix));
      const endA = U.smooth(cfg.endAt - 0.05, cfg.endAt + 0.08, t);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, bandCY - bandH / 2, W, bandH);
      ctx.clip();
      ctx.translate(0, layerTop);

      if (endA < 1) {
        ctx.drawImage(paper, 0, 0);
        if (sc) {
          const z = 1 + 0.035 * U.clamp((t - sc.s.t0) / (sc.s.t1 - sc.s.t0), 0, 1);
          ctx.save();
          ctx.translate(LW / 2, LH / 2);
          ctx.scale(z, z);
          ctx.translate(-LW / 2, -LH / 2);
          drawArt(ctx, sc.s.art, sc.local, mix);
          ctx.restore();
        }
        drawPhrases(ctx, t, 1);

        // gentle exposure flicker, like a phone filming paper
        const fl = (U.hash(Math.floor(t * 15), 5) - 0.5) * 0.03;
        ctx.fillStyle = fl > 0 ? `rgba(255,255,255,${fl})` : `rgba(0,0,0,${-fl * 0.7})`;
        ctx.fillRect(0, 0, LW, LH);

        const dim = U.smooth(cfg.dimAt, cfg.dimAt + 0.06, t) * 0.5;
        if (dim > 0) {
          ctx.fillStyle = `rgba(20,24,20,${dim})`;
          ctx.fillRect(0, 0, LW, LH);
        }
      }
      if (endA > 0) {
        ctx.globalAlpha = endA;
        ctx.drawImage(dark, 0, 0);
        ctx.globalAlpha = 1;
        drawPhrases(ctx, t, 0.45 * endA); // the last words linger as a ghost
      }

      // film grain
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.09;
      ctx.drawImage(grains[Math.floor(t * 15) % 3], 0, 0, LW, LH);
      ctx.restore();

      if (endA > 0) drawEnd(t, endA);
    }

    return { render, canvas };
  }

  BV.createRenderer = createRenderer;
})();

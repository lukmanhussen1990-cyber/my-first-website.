// THE SNAIL WITH DISCO EYES: scene choreography.
// Every time is scene-local seconds; s.w('word') = when that word starts in the voiceover.
import { strokePartial, wobblyPath, markerEllipse, xMark, inkText, paperTexture, card } from '../../engine/js/draw.js';
import { glowDot } from '../../engine/js/components.js';
import { FONTS } from '../../engine/js/assets.js';

export default function build(R, { U, W, H }) {
  const { ease, clamp, lerp, prog, rng, COLORS } = U;
  const G = R.geometry;
  const includeOptional = !!R.cfg.includeOptional;
  let fig = 0;
  const S = (id, opts, fn) => {
    if (opts.optional && !includeOptional) return null;
    return R.scene(id, { fig: ++fig, ...opts }, fn);
  };

  // ---- helpers --------------------------------------------------------------
  const P = (sprite, t, pt) => sprite.point(t, pt[0], pt[1]);
  // geometry for a given image (falls back to the shared snail entry)
  const GEO = (key) => ({ ...G.snail, ...(G[key] || {}) });
  const heartbeats = (s, from, to, rate = 1, gain = 0.5) => {
    for (let t = from; t < to - 0.2; t += 1 / rate) s.sfx(t, 'heartbeat', gain);
  };
  // procedural tube network inside the snail body (normalized image coords)
  function tubeNet(g, seed, extra = []) {
    const r = rng(seed);
    const st = g.stomach;
    const targets = [g.shell, [g.shell[0] - 0.12, g.shell[1] + 0.14], [0.12, 0.8], [0.25, 0.86], [0.55, 0.84], [0.72, 0.76], g.head, ...extra];
    return targets.map((tg) => {
      const pts = [st];
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        pts.push([lerp(st[0], tg[0], u) + (r() - 0.5) * 0.035 * Math.sin(u * Math.PI), lerp(st[1], tg[1], u) + (r() - 0.5) * 0.04 * Math.sin(u * Math.PI)]);
      }
      return pts;
    });
  }
  const toWorld = (sprite, t, pts) => pts.map((p) => P(sprite, t, p));
  const stalkPath = (g, k) => {
    const b = g.stalkBases[k], tip = g.stalkTips[k];
    return [g.stomach, [lerp(g.stomach[0], b[0], 0.5), lerp(g.stomach[1], b[1], 0.5) + 0.03], [b[0] - 0.02, b[1] + 0.04], b,
      [lerp(b[0], tip[0], 0.5), lerp(b[1], tip[1], 0.5)], tip];
  };
  function eggsActor(s, sprite, o) {
    const r = rng(o.seed || 3);
    const eggs = Array.from({ length: o.n || 9 }, () => ({ dx: (r() - 0.5) * 120, dy: (r() - 0.5) * 70, rot: r() * 3, k: r() }));
    s.custom({ at: o.at, z: 30 }, (ctx, t) => {
      const [cx, cy] = P(sprite, t, o.g ? o.g.stomach : G.snail.stomach);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      eggs.forEach((e, i) => {
        const a = prog(t, o.at + i * 0.05, 0.25);
        if (a <= 0) return;
        const x = cx + e.dx, y = cy + e.dy;
        if (o.hatch === undefined || t < o.hatch + e.k * 0.25) {
          glowDot(ctx, x, y, 7, a * 0.9);
        } else {
          const h = prog(t, o.hatch + e.k * 0.25, 0.6, ease.outCubic);
          // two shell halves drift apart, a larva wriggles out
          glowDot(ctx, x - 9 * h, y - 4 * h, 5, (1 - h) * 0.8);
          glowDot(ctx, x + 9 * h, y + 4 * h, 5, (1 - h) * 0.8);
          const lt = t - o.hatch;
          const pts = [];
          for (let k = 0; k <= 8; k++) {
            const u = k / 8;
            pts.push([x + (u - 0.5) * 34 + Math.cos(e.rot) * 40 * h, y + Math.sin(lt * 9 + u * 6 + e.rot) * 6 + Math.sin(e.rot) * 30 * h]);
          }
          strokePartial(ctx, pts, h, 7, 'rgba(255,140,60,0.7)', { shadow: 'rgba(255,100,40,0.9)', shadowBlur: 14 });
          strokePartial(ctx, pts, h, 2.5, 'rgba(255,235,200,0.95)');
        }
      });
      ctx.restore();
    });
  }
  // a small cream label card with typed text (like "SPECIMEN 01")
  function labelCard(s, text, o) {
    s.custom({ at: o.at, layer: 'ui', z: 39 }, (ctx, t) => {
      const p = prog(t, o.at, 0.25, ease.outCubic);
      const c = card(o.w || 330, 70, { color: '#ece2cb', seed: 21 });
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(o.x, o.y + (1 - p) * 30); ctx.rotate((o.rot ?? -2) * Math.PI / 180);
      ctx.drawImage(c.canvas, -c.pad, -c.pad);
      ctx.restore();
    });
    s.type(text, { at: o.at + 0.2, x: o.x + 24, y: o.y + 46, size: 26, spacing: 4, rot: o.rot ?? -2, gain: 0.35, soundEvery: 2 });
  }

  // =========================================================== HOOK
  S('S01', { look: 'paper' }, (s) => {
    const snail = s.sprite('snail_infected', { x: 530, y: 1080, w: 900, pulse: { start: 0, rate: 1.0 }, crawl: { stretch: 0.008, freq: 0.6 } });
    const fp = () => P(snail, 0, [lerp(GEO('snail_infected').stalkTips[0][0], GEO('snail_infected').stalkTips[1][0], 0.5), 0.3]);
    const [fx, fy] = fp();
    s.camera([[0, 1.0, fx, fy], [s.dur, 1.16, fx, fy, ease.inOutQuad]]);
    s.title(['ITS EYES', 'ARE A TRAP'], { at: [0, s.w('आँखें')] });
    s.target({ at: s.w('धड़क'), pos: (t) => P(snail, t, GEO('snail_infected').stalkTips[0]), r: 54 });
    s.target({ at: s.w('धड़क') + 0.12, pos: (t) => P(snail, t, GEO('snail_infected').stalkTips[1]), r: 54, sfx: false });
    labelCard(s, 'SPECIMEN No. 01', { at: 0.35, x: 120, y: 1345 });
    heartbeats(s, 0.0, s.dur, 1.0, 0.45);
  });

  S('S02', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.7);
    const snail = s.sprite('snail_infected', { x: 540, y: 1000, w: 980, xray: true });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.08, 640, 900, ease.inOutQuad]]);
    const tub = [stalkPath(GEO('snail_infected'), 0), stalkPath(GEO('snail_infected'), 1)];
    s.glow({ at: s.w('पैरासाइट') - 0.1, paths: [
      ...tubeNet(GEO('snail_infected'), 5).map((p, i) => ({ pts: toWorld(snail, 0, p), at: s.w('पैरासाइट') - 0.1 + i * 0.06, dur: 1.0, width: 10 })),
      ...tub.map((p, i) => ({ pts: toWorld(snail, 0, p), at: s.w('पैरासाइट') + 0.3 + i * 0.1, dur: 1.2, width: 13 })),
    ] });
    s.title(['CONTROLLED', 'FROM INSIDE'], { at: [0.15, s.w('कंट्रोल')] });
    const term = s.terminal('MIND CONTROL', { at: s.w('पैरासाइट') + 0.2, x: 100, y: 1250, cps: 16, barDur: 1.0,
      barAt: Math.max(s.w('पैरासाइट') + 1.0, s.w('कंट्रोल') - 0.2),
      wires: [0, 1].map((k) => () => {
        const [tx, ty] = P(snail, 0, GEO('snail_infected').stalkTips[k]);
        return [[420 + k * 140, 1250], [420 + k * 140, 1180 - k * 30], [tx, 1180 - k * 30], [tx, ty + 30]];
      }) });
    s.target({ at: term.barAt + term.barDur, pos: (t) => P(snail, t, GEO('snail_infected').stalkTips[0]), r: 50, sfx: false });
    s.target({ at: term.barAt + term.barDur + 0.08, pos: (t) => P(snail, t, GEO('snail_infected').stalkTips[1]), r: 50, sfx: false });
  });

  S('S03', { look: 'paper' }, (s) => {
    const snail = s.sprite('snail_infected', { x: 500, y: 1180, w: 860, pulse: { start: 0 }, crawl: { stretch: 0.008 } });
    const tBird = s.w('चिड़िया');
    const tPeck = s.w('नोचकर');
    const BP = G.bird_pecking.beak, CROP = 0.745;
    const tip = () => P(snail, 0, GEO('snail_infected').stalkTips[1]);
    // the bird's shadow sweeps over the snail first
    s.custom({ at: tBird - 0.2, z: 5 }, (ctx, t, sc) => {
      const p = prog(t, tBird - 0.2, 1.0, ease.outCubic);
      const sil = sc.reel.assets.shadow('bird_pecking', 30);
      const a = sc.reel.assets.get('bird_pecking');
      const w = 1500, h = w * a.h / a.w;
      ctx.save(); ctx.globalAlpha = 0.38 * p;
      ctx.translate(lerp(1250, 760, p), lerp(420, 760, p)); ctx.scale(-1, 1);
      ctx.drawImage(sil.canvas, -w / 2, -h / 2, w * 1.12, h * 1.12);
      ctx.restore();
    });
    s.sfx(tBird - 0.15, 'wings', 0.8);
    // mirrored, twig cropped away: head and open beak lunge down-left at the eye stalk
    s.sprite('bird_pecking', { at: tPeck - 0.5, w: 1350, flip: true, crop: [0, 0, 1, CROP], fadeBottom: 70, anchor: [BP[0], BP[1] / CROP], z: 40,
      path: [[tPeck - 0.5, tip()[0] + 470, tip()[1] - 560], [tPeck, tip()[0] + 14, tip()[1] - 10, ease.outExpo], [s.dur, tip()[0] + 30, tip()[1] - 26]],
      enter: { from: 'fade', dur: 0.12, sfx: 'whoosh' }, shadow: { ground: 0, drop: 0.25 } });
    s.sfx(tPeck, 'peck', 0.9);
    s.shake(tPeck, 0.16, 8);
    s.camera([[0, 1.0, 540, 1100], [tPeck - 0.1, 1.04, 600, 1050], [tPeck + 0.15, 1.12, tip()[0], tip()[1], ease.outCubic], [s.dur, 1.14, tip()[0], tip()[1]]]);
    s.title(['BAIT', 'FOR A BIRD'], { at: [0.1, tBird] });
    heartbeats(s, 0.0, tPeck, 1.0, 0.35);
  });

  S('S04', { look: 'paper' }, (s) => {
    const tSent2 = s.w('ये', 1);
    s.ticket({ at: 0.05, until: tSent2, x: 540, y: 960, rot: -5, title: 'HORROR', sub: 'FILM NIGHT', kicker: 'ADMIT ONE', tearAt: tSent2 - 0.42 });
    s.stamp('NOT A MOVIE', { at: s.w('नहीं') - 0.1, until: tSent2, x: 520, y: 1010, rot: -9, size: 96 });
    // beat 2: the real thing
    s.sprite('eyestalk_infected_closeup', { at: tSent2, x: 735, y: 990, h: 860, rot: 8, pulse: { start: tSent2 }, enter: { from: 'right', dur: 0.4, sfx: 'whoosh' } });
    s.title(['NOT', 'FICTION'], { at: [tSent2, s.w('सच')] });
    s.nameTag('GREEN-BANDED BROODSAC', 'LEUCOCHLORIDIUM PARADOXUM', { at: tSent2 + 0.35, x: 100, y: 600, size: 42, latinSize: 21 });
    s.camera([[0, 1.0, 540, 960], [tSent2, 1.03, 540, 960], [tSent2 + 0.01, 1.0, 700, 1000], [s.dur, 1.04, 700, 980]]);
  });

  // =========================================================== MEET THEM
  S('S05', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    s.sfx(0, 'slide', 0.6);
    const tSmall = s.w('छोटा'), tEyes = s.w('और');
    const leaf = s.sprite('leaf_wet', { x: 540, y: 1075, w: 1080, shadow: { ground: 0.2, drop: 0.25 } });
    const top = G.leaf.top;
    const leafTopY = () => P(leaf, 0, [0.5, top])[1];
    const snail = s.sprite('snail_healthy', { at: 0, w: 640, anchor: [0.5, GEO('snail_healthy').foot], z: 5,
      path: [[0, 300, leafTopY() + 6], [s.dur, 640, leafTopY() + 6, ease.linear]], crawl: { stretch: 0.015, freq: 0.7 }, enter: { from: 'left', dur: 0.6, dist: 600, sfx: null } });
    s.title(['AMBER', 'SNAIL'], { at: [s.w('एम्बर'), s.w('स्नेल')] });
    s.nameTag('AMBER SNAIL', 'SUCCINEA PUTRIS', { at: s.w('स्नेल') + 0.25, x: 100, y: 640, size: 50 });
    // ruler under the shell (kept above the watermark band)
    s.ruler({ at: tSmall, x: 130, y: 1310, len: 820, th: 104, unitPx: 120, sub: 10, units: 'CM', span: [1, 2], spanAt: s.w('घोंघा') + 0.1, spanLabel: 'SHELL 1–2 CM', labelSize: 34, labelInside: true, layer: 'ui' });
    // magnifier over the eye tip: lens sits just above-left of the tip, label to its left
    const eye = P(snail, tEyes + 0.6, GEO('snail_healthy').stalkTips[0]);
    const lx = Math.min(760, eye[0] - 20), ly = Math.max(760, eye[1] - 60);
    s.magnifier({ at: tEyes - 0.05, to: [lx, ly], r: 160, image: 'eyestalk_healthy_closeup', region: [0.2, 0.0, 0.8, 0.4], label: 'EYE', labelAt: s.w('आँखें'), labelPos: [lx - 160 - 190, ly - 40] });
    s.camera([[0, 1.0, 540, 1100], [tEyes, 1.04, 540, 1100], [tEyes + 0.6, 1.1, 700, 1000, ease.outCubic], [s.dur, 1.12, 700, 1000]]);
  });

  S('S06', { look: 'paper' }, (s) => {
    const worm = s.sprite('flatworm', { x: 540, y: 960, h: 760, rot: 90, enter: { from: 'scale', dur: 0.4, s0: 0.7, sfx: 'whoosh' }, wobble: 1.2, shadow: { ground: 0, drop: 0.25 } });
    s.title(['THE', 'VILLAIN'], { at: [s.w('असली'), s.w('विलेन')] });
    const tLen = s.w('डेढ़');
    s.ruler({ at: s.w('बड़ा') - 0.1, x: 160, y: 1250, len: 780, th: 104, unitPx: 507, sub: 10, step: 1, units: 'MM', span: [0, 1.5], spanAt: tLen, spanLabel: '1.5 MM', labelSize: 50 });
    s.hangTag('THE PARASITE', { at: s.w('फ्लैटवर्म'), anchor: (t) => P(worm, t, [0.5, 0.86]), len: 80, size: 44, swing: 0.45 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.06, 540, 1050]]);
  });

  S('S07', { look: 'paper' }, (s) => {
    const tBird = s.w('चिड़िया');
    const worm = s.sprite('flatworm', { x: 540, y: 1000, h: 380, rot: 90, wobble: 2, until: tBird + 0.6,
      enter: { from: 'fade', dur: 0.2, sfx: null }, exit: { at: tBird, to: 'fade', dur: 0.5 } });
    s.title(['ONE', 'PROBLEM'], { at: [s.w('एक'), s.w('प्रॉब्लम')] });
    // red question mark next to the worm
    s.custom({ at: s.w('प्रॉब्लम') + 0.2, until: tBird, layer: 'ui', z: 45 }, (ctx, t) => {
      const ink = inkText('?', FONTS.title, 220, COLORS.red);
      ctx.save(); ctx.globalAlpha = prog(t, s.w('प्रॉब्लम') + 0.2, 0.15);
      ctx.drawImage(ink.canvas, 760 - ink.pad, 860 - ink.base + 190); ctx.restore();
    });
    s.sfx(s.w('प्रॉब्लम') + 0.2, 'pop', 0.5);
    const bird = s.sprite('bird_perched', { at: tBird, x: 560, y: 1020, w: 1400, enter: { from: 'right', dur: 0.5, sfx: 'wings' }, bob: { amp: 2, freq: 0.5, rot: 0.3 } });
    s.hangTag('ITS REAL HOME', { at: tBird + 0.45, anchor: (t) => P(bird, t, [0.62, G.bird.twig - 0.01]), len: 100, size: 42, swing: 0.6 });
    s.camera([[0, 1.0, 540, 1000], [tBird, 1.03, 540, 1000], [tBird + 0.01, 1.0, 540, 1000], [s.dur, 1.06, 500, 950]]);
  });

  S('S08', { look: 'paper' }, (s) => {
    s.sprite('flatworm', { x: 560, y: 600, h: 330, rot: 90, wobble: 2.5, enter: { from: 'fade', dur: 0.2, sfx: null } });
    const t1 = 0.1, t2 = s.w('तो'), t3 = s.w('चिड़िया', 1);
    s.checklist({ at: 0.05, x: 160, y: 860, w: 780, header: 'OPTIONS', size: 56, items: [
      { text: 'FLY TO A BIRD?', at: t1 + 0.15, mark: 'x', markAt: s.w('नहीं'), strikeAt: s.w('नहीं') + 0.18 },
      { text: 'WAIT FOR LUCK?', at: t2, mark: 'x', markAt: s.w('शातिर'), strikeAt: s.w('शातिर') + 0.18 },
      { text: 'MAKE THE BIRD COME', at: t3 - 0.1, circleAt: s.w('बुलाता'), color: COLORS.red },
    ] });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1050]]);
  });

  // =========================================================== HOW IT WORKS
  S('S09', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    s.sfx(0, 'slide', 0.6);
    const leaf = s.sprite('leaf_dropping', { x: 540, y: 1120, w: 1180, shadow: { ground: 0.2, drop: 0.25 } });
    s.title(['BIRD', 'POOP'], { at: [s.w('चिड़िया'), s.w('बीट')] });
    s.torn('STEP 1', { at: 0.15, x: 640, y: 300, size: 60, rot: 3 });
    const dp = () => P(leaf, 0, G.leaf.dropping);
    const tEggs = s.w('अंडे');
    s.magnifier({ at: tEggs - 0.3, to: [dp()[0] - 40, dp()[1] - 250], r: 175, zoom: 3.2, focus: dp, label: 'EGGS', labelAt: tEggs + 0.1, labelPos: [130, 760],
      drawInside: (ctx, t, sc, cx, cy, R) => {
        // tiny brown operculate eggs speckled through the dropping
        const r = rng(44), a = prog(t, tEggs - 0.1, 0.4);
        for (let i = 0; i < 26; i++) {
          const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * R * 0.62;
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.8;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(r() * Math.PI);
          const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
          g.addColorStop(0, '#d9b98a'); g.addColorStop(0.6, '#8a6236'); g.addColorStop(1, '#4a2f14');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(40,22,8,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(9, 0, 6, -1.2, 1.2); ctx.stroke();
          ctx.restore();
        }
      } });
    s.camera([[0, 1.0, 540, 1100], [tEggs, 1.05, 600, 1050], [s.dur, 1.1, 640, 1000]]);
  });

  S('S10', { look: 'paper' }, (s) => {
    const tEat = s.w('खा');
    const leafD = s.sprite('leaf_dropping', { x: 540, y: 1120, w: 1180, until: tEat + 0.35, shadow: { ground: 0.2, drop: 0.25 } });
    s.sprite('leaf_wet', { at: tEat + 0.05, x: 540, y: 1120, w: 1180, enter: { from: 'fade', dur: 0.3, sfx: null }, shadow: { ground: 0.2, drop: 0.25 }, z: -1 });
    const dp = P(leafD, 0, G.leaf.dropping);
    const mouthN = GEO('snail_healthy').mouth;
    const snailW = 600;
    const startX = dp[0] - 420, endX = dp[0] - (mouthN[0] - 0.5) * snailW + 10;
    s.sprite('snail_healthy', { w: snailW, anchor: [0.5, GEO('snail_healthy').foot], z: 5, path: [[0, startX, dp[1] + 20], [tEat, endX, dp[1] + 20, ease.outQuad], [s.dur, endX + 10, dp[1] + 20]], crawl: { stretch: 0.02, freq: 1.2 } });
    s.title(['EATEN'], { at: [tEat] });
    s.sfx(tEat, 'squish', 0.8); s.sfx(tEat + 0.25, 'squish', 0.5, { v: 1 });
    s.camera([[0, 1.02, dp[0], dp[1]], [s.dur, 1.18, dp[0] - 60, dp[1] - 40, ease.inOutQuad]]);
  });

  S('S11', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.7);
    const snail = s.sprite('snail_healthy', { x: 540, y: 1020, w: 1000, xray: true });
    const st = P(snail, 0, GEO('snail_healthy').stomach);
    s.camera([[0, 1.0, 540, 1020], [s.dur, 1.22, st[0], st[1], ease.inOutQuad]]);
    s.title(['HATCH', 'INSIDE'], { at: [0.15, s.w('फूट')] });
    eggsActor(s, snail, { g: GEO('snail_healthy'), at: s.w('अंदर'), hatch: s.w('फूट'), n: 9 });
    s.sfx(s.w('अंदर'), 'hum', 0.4); s.sfx(s.w('फूट'), 'pop', 0.6); s.sfx(s.w('फूट') + 0.15, 'squish', 0.5);
    s.target({ at: s.w('फूट') + 0.2, pos: st, r: 120, sfx: false });
  });

  S('S12', { look: 'xray' }, (s) => {
    const snail = s.sprite('snail_healthy', { x: 540, y: 1040, w: 1000, xray: true });
    const tSpread = s.w('पैरासाइट'), tWeight = s.w('वज़न'), tOnly = s.w('सिर्फ़');
    s.bigNumber('1/5', { at: tWeight - 0.2, x: 560, y: 1020, size: 640, alpha: 0.22 });
    s.glow({ at: tSpread, paths: tubeNet(GEO('snail_healthy'), 12).map((p, i) => ({ pts: toWorld(snail, 0, p), at: tSpread + i * 0.18, dur: 1.6, width: 12 })) });
    s.glow({ at: s.w('फैला'), sfx: false, paths: tubeNet(GEO('snail_healthy'), 19, [[0.4, 0.5], [0.6, 0.6]]).map((p, i) => ({ pts: toWorld(snail, 0, p.map(([x, y]) => [x + 0.02, y - 0.02])), at: s.w('फैला') + i * 0.12, dur: 1.4, width: 7 })) });
    s.title(['IT', 'SPREADS'], { at: [0.1, s.w('जाल')] });
    s.type('1/5 OF ITS WEIGHT (OR MORE)', { at: s.w('पाँचवाँ'), x: 104, y: 1420, size: 30, spacing: 3, cps: 28, color: 'rgba(230,225,210,0.9)' });
    s.camera([[0, 1.0, 540, 1040], [tWeight, 1.06, 540, 1040], [tWeight + 0.01, 0.96, 540, 1020], [tOnly, 1.0, 540, 1020], [s.dur, 1.12, 500, 1050]]);
    s.sfx(tOnly, 'hum', 0.45);
  });

  S('S13', { look: 'xray' }, (s) => {
    const snail = s.sprite('snail_healthy', { x: 540, y: 1080, w: 1000, xray: true });
    const tIn = s.w('सीधे');
    s.glow({ at: 0, sfx: false, paths: tubeNet(GEO('snail_healthy'), 12).map((p) => ({ pts: toWorld(snail, 0, p), at: -5, dur: 0.1, width: 12 })) });
    s.glow({ at: tIn - 0.2, paths: [0, 1].map((k) => ({ pts: toWorld(snail, 0, stalkPath(GEO('snail_healthy'), k)), at: tIn - 0.2 + k * 0.15, dur: 1.3, width: 14 })) });
    s.target({ at: s.w('डंडियों'), pos: P(snail, 0, GEO('snail_healthy').stalkTips[0]), r: 48 });
    s.target({ at: s.w('डंडियों') + 0.15, pos: P(snail, 0, GEO('snail_healthy').stalkTips[1]), r: 48, sfx: false });
    s.title(['INTO', 'THE EYES'], { at: [0.1, s.w('आँखों')] });
    const tip = P(snail, 0, [lerp(GEO('snail_healthy').stalkTips[0][0], GEO('snail_healthy').stalkTips[1][0], 0.5), 0.35]);
    s.camera([[0, 1.0, 540, 1080], [tIn, 1.05, 600, 1000], [s.dur, 1.35, tip[0], tip[1], ease.inOutCubic]]);
  });

  S('S14', { look: 'paper', transition: { type: 'whip', dur: 0.25 } }, (s) => {
    s.sfx(0, 'whoosh', 0.6);
    const tSwell = s.w('फूलकर');
    const thin = s.sprite('eyestalk_healthy_closeup', { x: 450, y: 1005, h: 850, until: tSwell + 0.9,
      alphaKeys: [[tSwell, 1], [tSwell + 0.8, 0]], scaleKeys: [[0, 1], [tSwell + 0.8, 1.04]] });
    s.sprite('eyestalk_infected_closeup', { at: tSwell, x: 450, y: 1005, h: 850, z: 2,
      alphaKeys: [[tSwell, 0], [tSwell + 0.7, 1]], scaleKeys: [[tSwell, 0.94], [tSwell + 0.9, 1.0, ease.outBack]], pulse: { start: tSwell + 0.9 } });
    s.sfx(tSwell, 'inflate', 0.8);
    s.title(['SWOLLEN', '& STRIPED'], { at: [tSwell, s.w('धारियों')] });
    s.swatches({ items: [
      { at: s.w('हरी'), x: 830, y: 760, color: '#5f9a3e', label: 'GREEN', rot: -6, size: 150 },
      { at: s.w('सफ़ेद'), x: 820, y: 1010, color: '#ece5c8', label: 'WHITE', rot: 5, size: 150 },
      { at: s.w('धारियों'), x: 835, y: 1260, color: '#7a3f22', label: 'BROWN', rot: -3, size: 150 },
    ] });
    s.camera([[0, 1.0, 470, 1000], [s.dur, 1.06, 470, 950]]);
  });

  S('S15', { look: 'paper' }, (s) => {
    const tBeat = s.w('धड़कने');
    const snail = s.sprite('snail_infected', { x: 560, y: 1110, w: 960, pulse: { start: tBeat, rate: 1.0 } });
    const tip = P(snail, 0, [lerp(GEO('snail_infected').stalkTips[0][0], GEO('snail_infected').stalkTips[1][0], 0.5), 0.3]);
    s.camera([[0, 1.0, 540, 1100], [tBeat, 1.12, tip[0], tip[1] + 100], [s.dur, 1.2, tip[0], tip[1] + 80]]);
    s.title(['IT', 'PULSES'], { at: [0.1, tBeat] });
    s.monitor({ at: s.w('मिनट') - 0.1, x: 110, y: 1180, w: 470, h: 230, rate: 1.0, phase: tBeat, text: '40–80 / MIN' });
    heartbeats(s, tBeat, s.dur, 1.0, 0.65);
  });

  S('S16', { look: 'paper' }, (s) => {
    s.kicker('SCIENTISTS BELIEVE', { at: s.w('वैज्ञानिक') });
    s.title(['LOOKS LIKE', 'A CATERPILLAR'], { at: [s.w('मानते'), s.w('कैटरपिलर')] });
    s.sprite('eyestalk_infected_closeup', { at: 0, x: 540, y: 820, h: 820, rot: -90, pulse: { start: 0 }, enter: { from: 'left', dur: 0.45, sfx: 'whoosh' } });
    const tEq = s.w('बिल्कुल');
    s.custom({ at: tEq, layer: 'ui', z: 45 }, (ctx, t) => {
      const p = prog(t, tEq, 0.25, ease.outBack);
      ctx.save(); ctx.globalAlpha = clamp((t - tEq) / 0.08);
      const eq = inkText('=', FONTS.title, 150, COLORS.red);
      const q = inkText('?', FONTS.title, 150, COLORS.red);
      ctx.translate(540, 1030); ctx.scale(p, p);
      ctx.drawImage(eq.canvas, -eq.width / 2 - eq.pad - 50, -eq.base + 60);
      ctx.drawImage(q.canvas, -q.width / 2 - q.pad + 50, -q.base + 60);
      ctx.restore();
    });
    s.sfx(tEq, 'pop', 0.6);
    s.sprite('caterpillar', { at: s.w('कैटरपिलर') - 0.3, x: 540, y: 1240, w: 820, enter: { from: 'right', dur: 0.45, sfx: 'whoosh' }, crawl: { stretch: 0.02, freq: 1.1 } });
    s.camera([[0, 1.0, 540, 1030], [s.dur, 1.05, 540, 1030]]);
  });

  S('S17', { look: 'paper', optional: true }, (s) => {
    const snail = s.sprite('snail_infected', { x: 520, y: 1100, w: 1060, pulse: { start: 0 } });
    const tBack = s.w('वापस'), tNo = s.w('नहीं');
    for (const k of [0, 1]) {
      s.custom({ at: tBack, layer: 'world', z: 30 }, (ctx, t) => {
        const [x, y] = P(snail, t, GEO('snail_infected').stalkTips[k]);
        const [bx, by] = P(snail, t, GEO('snail_infected').stalkBases[k]);
        const p = prog(t, tBack + k * 0.1, 0.35);
        const pts = wobblyPath([[x + 40, y - 40], [lerp(x, bx, 0.6) + 40, lerp(y, by, 0.6) - 10]], 3 + k, 1.5, 10);
        strokePartial(ctx, pts, p, 6, COLORS.red);
      });
    }
    s.sfx(tBack, 'pen', 0.5);
    s.custom({ at: tNo, layer: 'ui', z: 60 }, (ctx, t) => {
      const [x, y] = P(snail, t, [lerp(GEO('snail_infected').stalkTips[0][0], GEO('snail_infected').stalkTips[1][0], 0.5), 0.3]);
      xMark(ctx, x, y, 220, prog(t, tNo, 0.3), COLORS.red, 16);
    });
    s.sfx(tNo, 'pen', 0.8);
    s.torn("CAN'T RETRACT", { at: tNo + 0.2, x: 110, y: 1330, size: 56, rot: -2 });
    s.title(["CAN’T", 'HIDE THEM'], { at: [0.1, s.w('खींच')] });
    s.camera([[0, 1.0, 540, 1050], [s.dur, 1.08, 640, 950]]);
  });

  S('S18', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const sac = s.sprite('eyestalk_infected_closeup', { x: 520, y: 1010, h: 880, xray: true });
    const tN = s.w('सौ');
    // larvae fill the sac
    const r = rng(77);
    const lar = Array.from({ length: 70 }, () => ({ u: r(), v: r(), ph: r() * 6, k: r() }));
    s.custom({ at: tN - 0.3, z: 30 }, (ctx, t) => {
      const [tx, ty] = P(sac, t, G.stalk_closeup.tip), [bx, by] = P(sac, t, G.stalk_closeup.base);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      lar.forEach((l, i) => {
        const a = prog(t, tN - 0.3 + l.k * 1.6, 0.3);
        if (a <= 0) return;
        const y = lerp(ty + 90, by - 120, l.v), x = lerp(tx, bx, l.v) + (l.u - 0.5) * 170;
        const pts = [];
        for (let k = 0; k <= 5; k++) pts.push([x + (k - 2.5) * 6, y + Math.sin(t * 6 + l.ph + k) * 4]);
        strokePartial(ctx, pts, 1, 6, `rgba(255,130,60,${0.55 * a})`, { shadow: 'rgba(255,100,40,0.9)', shadowBlur: 10 });
        strokePartial(ctx, pts, 1, 2, `rgba(255,236,205,${0.9 * a})`);
      });
      ctx.restore();
    });
    // counter
    const t0 = tN, t1 = s.w('बच्चे');
    s.custom({ at: t0, layer: 'ui', z: 48 }, (ctx, t) => {
      const v = Math.round(250 * prog(t, t0, Math.max(0.6, t1 - t0), ease.outCubic));
      ctx.save(); ctx.globalAlpha = prog(t, t0, 0.15);
      ctx.fillStyle = 'rgba(20,20,16,0.85)'; ctx.strokeStyle = 'rgba(225,220,205,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(650, 1290, 300, 120, 10); ctx.fill(); ctx.stroke();
      ctx.font = `20px "${FONTS.type}"`; ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(225,220,205,0.75)';
      ctx.fillText('LARVAE', 672, 1322);
      ctx.letterSpacing = '0px'; ctx.font = `70px "${FONTS.title}"`; ctx.fillStyle = '#ff7a3d';
      ctx.fillText(String(v).padStart(3, '0'), 672, 1396);
      ctx.restore();
    });
    for (let k = 0; k < 10; k++) s.sfx(t0 + k * Math.max(0.6, t1 - t0) / 10, 'tick', 0.3);
    s.title([{ text: '100–250', red: true, role: 'a', size: 150 }, { text: 'IN EACH ONE', color: COLORS.cream, size: 110 }], { at: [tN, s.w('तक')] });
    s.camera([[0, 1.0, 540, 1040], [s.dur, 1.07, 540, 1000]]);
  });

  S('S19', { look: 'xray', optional: true }, (s) => {
    const snail = s.sprite('snail_infected', { x: 540, y: 1000, w: 980, xray: true });
    const tDark = s.w('अँधेरे'), tStop = s.w('रुक'), tDay = s.w('दिन');
    const stalkGlow = [0, 1].map((k) => ({ pts: toWorld(snail, 0, stalkPath(GEO('snail_infected'), k).slice(2)), at: -5, dur: 0.1, width: 16 }));
    s.glow({ at: 0, until: tStop, sfx: false, paths: stalkGlow });
    s.glow({ at: tDay + 0.2, sfx: false, paths: stalkGlow });
    s.monitor({ at: 0.2, x: 110, y: 1180, w: 470, h: 230, rate: 1.0, offAt: tStop, text: '40–80 / MIN' });
    s.sfx(tDark, 'switch', 0.8);
    s.overlay({ at: tDark, alpha: (t) => (t < tDay ? 0.55 * prog(t, tDark, 0.15) : 0.55 * (1 - prog(t, tDay, 0.3))), color: '#000' });
    s.custom({ at: tDark, until: tDay + 0.3, layer: 'fx', z: 95 }, (ctx, t) => {
      const a = t < tDay ? prog(t, tDark, 0.25) : 1 - prog(t, tDay, 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(820, 640);
      ctx.fillStyle = '#efe6cf'; ctx.shadowColor = 'rgba(255,240,200,0.6)'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(34, -22, 62, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    s.sfx(tDay + 0.1, 'switch', 0.7);
    heartbeats(s, 0.2, tStop, 1.0, 0.45);
    heartbeats(s, tDay + 0.3, s.dur, 1.0, 0.4);
    s.title(['IN THE DARK', 'IT STOPS'], { at: [tDark, tStop] });
  });

  // =========================================================== MIND CONTROL
  S('S20', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    s.sfx(0, 'slide', 0.7);
    s.kicker('NEXT', { at: 0.1 });
    s.title(['THE STRANGEST', 'PART'], { at: [s.w('सबसे'), s.w('हिस्सा')] });
    s.sprite('snail_infected', { w: 760, anchor: [0.5, GEO('snail_infected').foot], pulse: { start: 0 }, path: [[0, 160, 1260], [s.dur, 520, 1260, ease.linear]], crawl: { stretch: 0.015 }, enter: { from: 'left', dur: 0.6, dist: 500, sfx: null } });
    s.camera([[0, 1.0, 540, 1100], [s.dur, 1.04, 540, 1100]]);
  });

  S('S21', { look: 'paper' }, (s) => {
    const tBut = s.w('लेकिन'), tUp = s.w('ऊपर'), tSit = s.w('बैठ');
    // bright light at the top, soft shade at the bottom
    s.custom({ at: 0, layer: 'bg', z: 2 }, (ctx, t) => {
      const a = prog(t, tBut, 1.2);
      const g = ctx.createRadialGradient(760, 430, 40, 760, 430, 800);
      g.addColorStop(0, `rgba(255,248,215,${0.55 * a})`); g.addColorStop(1, 'rgba(255,248,215,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sh = ctx.createLinearGradient(0, 1080, 0, H);
      sh.addColorStop(0, 'rgba(40,28,12,0)'); sh.addColorStop(0.45, 'rgba(40,28,12,0.32)'); sh.addColorStop(1, 'rgba(40,28,12,0.5)');
      ctx.fillStyle = sh; ctx.fillRect(0, 1080, W, H - 1080);
    });
    const stem = s.sprite('plant_stem', { x: 840, y: 960, h: 1320, shadow: { ground: 0, drop: 0.22 } });
    const stemX = P(stem, 0, [G.stem.x, 0.5])[0];
    s.sprite('snail_healthy', { x: 330, y: 1350, w: 420, filter: 'brightness(0.62) saturate(0.8)', crawl: { stretch: 0.01 } });
    s.type('NORMAL SNAIL: LOW, IN THE SHADE', { at: s.w('छाँव'), x: 110, y: 1440, size: 24, spacing: 2, cps: 30 });
    // head up, foot against the left side of the stem
    s.sprite('snail_infected', { at: tBut - 0.1, w: 420, rot: -82, pulse: { start: tBut }, anchor: [0.5, 0.95],
      path: [[tBut - 0.1, stemX - 14, 1380], [tSit, stemX - 14, 1010, ease.inOutQuad]], enter: { from: 'fade', dur: 0.25, sfx: 'slide' }, shadow: { ground: 0, drop: 0.25 } });
    s.ruler({ at: tUp - 0.2, x: 470, y: 1240, len: 700, th: 64, rot: -90, unitPx: 70, sub: 2, units: '', slide: 0 });
    s.torn('1/3 HIGHER', { at: tUp + 0.3, x: 110, y: 820, size: 66, rot: -3 });
    s.title(['INTO', 'THE LIGHT'], { at: [tBut, s.w('रोशनी')] });
    s.camera([[0, 1.0, 540, 1100], [tBut, 1.03, 540, 1100], [s.dur, 1.06, 640, 900]]);
  });

  S('S22', { look: 'paper' }, (s) => {
    const t53 = s.w('तिरेपन'), t28 = s.w('अट्ठाईस');
    s.barChart({ at: 0.05, x: 140, y: 700, w: 800, h: 660, title: 'FULLY IN THE OPEN',
      bars: [{ label: 'INFECTED', value: 53, at: t53 - 0.1 }, { label: 'NORMAL', value: 28, at: t28 - 0.1, color: '#5b4630' }],
      note: 'FIELD STUDY, POLAND, 2014', noteAt: s.w('पोलैंड') + 0.1 });
    s.title([{ text: '53%', red: true, role: 'a', size: 170 }, { text: 'VS 28%', color: COLORS.ink, size: 120 }], { at: [t53, t28] });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  S('S23', { look: 'paper' }, (s) => {
    s.sprite('snail_infected', { w: 700, anchor: [0.5, GEO('snail_infected').foot], pulse: { start: 0 }, path: [[0, 400, 690], [s.dur, 600, 690, ease.linear]], crawl: { stretch: 0.015 } });
    const tAlive = s.w('ज़िंदा'), tEat = s.w('खाता'), tWalk = s.w('चलता'), tHide = s.w('छिपता');
    s.checklist({ at: 0.0, x: 150, y: 820, w: 780, h: 520, header: 'STATUS', size: 58, items: [
      { text: 'ALIVE', at: tAlive, mark: 'check', markAt: tAlive + 0.1 },
      { text: 'EATS', at: tEat, mark: 'check', markAt: tEat + 0.1 },
      { text: 'CRAWLS', at: tWalk, mark: 'check', markAt: tWalk + 0.1 },
      { text: 'HIDES', at: s.w('बस'), mark: 'x', markAt: tHide, strikeAt: tHide + 0.15, bigStrike: true },
    ] });
    // tiny heartbeat squiggle next to ALIVE
    s.custom({ at: tAlive + 0.2, layer: 'ui', z: 43 }, (ctx, t) => {
      const p = prog(t, tAlive + 0.2, 0.5);
      const pts = [[420, 945], [470, 945], [482, 915], [494, 970], [506, 935], [516, 945], [600, 945]];
      ctx.save(); ctx.translate(150, 820); ctx.rotate(-1.2 * Math.PI / 180); ctx.translate(-150, -820);
      strokePartial(ctx, pts, p, 4, COLORS.red); ctx.restore();
    });
    s.stamp('ZOMBIE', { at: s.voEnd - 0.05, x: 690, y: 1240, rot: -10, size: 120 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== THE BIRD
  // bird and snail share the twig in the bird pictures: twig height at a picture x (normalized)
  const twigY = (nx) => {
    const pts = [[0.0, 0.80], [0.1, 0.80], [0.5, 0.781], [0.8, 0.809], [0.95, 0.771], [1.0, 0.77]];
    for (let i = 0; i < pts.length - 1; i++) if (nx >= pts[i][0] && nx <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (nx - pts[i][0]) / (pts[i + 1][0] - pts[i][0]));
    return 0.79;
  };
  const BX = 300, BY = 870, BW = 1300, BH = BW * 755 / 1536;
  const SNX = 789, SNW = 320;
  const snailFootY = () => BY + (twigY((SNX - (BX - BW / 2)) / BW) - 0.5) * BH - 12;

  S('S24', { look: 'paper' }, (s) => {
    const tCome = s.w('आती');
    s.sprite('snail_infected', { x: SNX, y: snailFootY(), w: SNW, flip: true, anchor: [0.5, GEO('snail_infected').foot], pulse: { start: 0 }, z: 6, enter: { from: 'fade', dur: 0.2, sfx: null } });
    s.sprite('bird_perched', { at: tCome - 0.15, x: BX, y: BY, w: BW, z: 2,
      enter: { from: 'drop', dur: 0.5, dist: 700, sfx: 'wings' }, bob: { amp: 2, freq: 0.6, rot: 0.3 } });
    s.sfx(tCome + 0.32, 'thud', 0.5);
    s.title(['THE', 'BIRD'], { at: [0.05, s.w('चिड़िया')] });
    s.nameTag('GREAT TIT', 'PARUS MAJOR', { at: s.w('चिड़िया') + 0.05, x: 100, y: 1170, size: 50 });
    s.camera([[0, 1.0, 600, 1000], [s.dur, 1.05, 620, 980]]);
  });

  S('S25', { look: 'paper', transition: { type: 'whip', dur: 0.2 } }, (s) => {
    const tPeck = s.w('चोंच'), tGone = s.w('ग़ायब');
    const footY = snailFootY();
    const snail = s.sprite('snail_infected', { x: SNX, y: footY, w: SNW, flip: true, anchor: [0.5, GEO('snail_infected').foot], until: tPeck + 0.1, pulse: { start: 0 }, z: 6 });
    s.sprite('snail_after_peck', { at: tPeck + 0.1, x: SNX, y: footY, w: SNW, flip: true, anchor: [0.5, GEO('snail_after_peck').foot], pulse: { start: 0 }, z: 6 });
    const hit = P(snail, 0, GEO('snail_infected').stalkBases[1]);
    const BP = G.bird_pecking.beak;
    const restBeak = [BX + (BP[0] - 0.5) * BW, BY + (BP[1] - 0.5) * BH];
    // same twig in both poses: watching, then a pose swap at the strike (beak lands on the stalk)
    s.sprite('bird_perched', { at: 0, until: tPeck - 0.04, x: BX, y: BY, w: BW, z: 8, bob: { amp: 1.5, freq: 0.9, rot: 0.25 } });
    s.sprite('bird_pecking', { at: tPeck - 0.04, x: BX, y: BY, w: BW, z: 8 });
    s.sfx(tPeck - 0.1, 'whoosh', 0.5);
    s.sfx(tPeck, 'peck', 1.0); s.sfx(tPeck + 0.02, 'crack', 0.6);
    s.cracks({ at: tPeck + 0.04, x: hit[0], y: hit[1], len: 130, count: 8, width: 5 });
    s.overlay({ at: tPeck, until: tPeck + 0.2, alpha: (t) => 0.45 * (1 - prog(t, tPeck, 0.18)), color: '#fff6e4' });
    s.shake(tPeck + 0.02, 0.22, 12);
    s.camera([[0, 1.0, 600, 1000], [tPeck - 0.1, 1.08, hit[0], hit[1]], [tPeck + 0.06, 1.55, hit[0], hit[1], ease.outExpo], [s.dur, 1.5, hit[0], hit[1]]]);
    s.title(['ONE', 'PECK'], { at: [0.05, tPeck] });
    s.sfx(tGone, 'whoosh', 0.4);
  });

  S('S26', { look: 'paper', optional: true }, (s) => {
    const bird = s.sprite('bird_pecking', { x: 470, y: 1000, w: 1500, bob: { amp: 3, freq: 0.7 } });
    const sacScale = (t) => 1 + 0.07 * Math.max(0, Math.sin((t * 1.0) * Math.PI * 2));
    s.custom({ at: 0, z: 45 }, (ctx, t, sc) => {
      const [bx, by] = P(bird, t, G.bird_pecking.beak);
      const a = sc.reel.assets.get('eyestalk_infected_closeup');
      const h = 300 * sacScale(t), w = h * a.w / a.h;
      ctx.save(); ctx.translate(bx + 6, by + 10); ctx.rotate(-1.15);
      ctx.drawImage(a.img, -w / 2, -h * 0.15, w, h);
      ctx.restore();
    });
    heartbeats(s, 0.1, s.dur, 1.0, 0.6);
    s.title(['STILL', 'PULSING'], { at: [0.1, s.w('धड़कती')] });
    const bk = P(bird, 0, G.bird_pecking.beak);
    s.camera([[0, 1.0, bk[0], bk[1]], [s.dur, 1.15, bk[0], bk[1]]]);
  });

  S('S27', { look: 'paper' }, (s) => {
    s.sprite('snail_after_peck', { w: 820, anchor: [0.5, GEO('snail_after_peck').foot], pulse: { start: 0 }, path: [[0, 330, 1250], [s.dur, 660, 1250, ease.linear]], crawl: { stretch: 0.018, freq: 0.7 } });
    s.torn('1 YEAR+', { at: s.w('साल'), x: 620, y: 720, size: 92, rot: 4 });
    s.title(['A LIVING', 'TRAP'], { at: [0.1, s.w('ट्रैप')] });
    s.camera([[0, 1.0, 540, 1100], [s.dur, 1.06, 600, 1100]]);
  });

  // =========================================================== INSIDE THE BIRD
  S('S28', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.7);
    const bird = s.sprite('bird_perched', { x: 540, y: 1000, w: 1360, xray: true });
    const tIn = s.w('अंदर'), tBig = s.w('बड़े'), t13 = s.w('तेरह'), tEgg = s.w('अंडे');
    s.kicker('INSIDE THE BIRD', { at: 0.1, color: 'rgba(225,220,205,0.85)' });
    const gut = toWorld(bird, 0, G.bird.gut);
    s.glow({ at: tIn - 0.2, paths: [{ pts: gut, at: tIn - 0.2, dur: 1.0, width: 9 }], gain: 0.4 });
    s.custom({ at: tIn, z: 31 }, (ctx, t) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const u = clamp((t - tIn - i * 0.12) / Math.max(0.8, tBig - tIn));
        if (u <= 0) continue;
        // position along the gut polyline
        let L = 0; const seg = [];
        for (let k = 1; k < gut.length; k++) { const l = Math.hypot(gut[k][0] - gut[k - 1][0], gut[k][1] - gut[k - 1][1]); seg.push(l); L += l; }
        let d = u * L, k = 0; while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; }
        const f = Math.min(1, d / seg[k]);
        glowDot(ctx, lerp(gut[k][0], gut[k + 1][0], f) + Math.sin(i * 3) * 6, lerp(gut[k][1], gut[k + 1][1], f) + Math.cos(i * 2) * 6, 6 + u * 4, 0.9);
      }
      ctx.restore();
    });
    const cl = P(bird, 0, G.bird.cloaca);
    s.target({ at: tBig, pos: cl, r: 70 });
    s.dayCounter({ at: s.w('एक्सपेरिमेंट') - 0.2, x: 790, y: 470, from: 1, to: 13, countAt: s.w('एक्सपेरिमेंट') + 0.1, countDur: Math.max(0.9, t13 - s.w('एक्सपेरिमेंट') - 0.1) });
    eggsActor(s, { point: () => cl }, { at: tEgg, n: 7, seed: 8 });
    s.title([{ text: '13', red: true, role: 'a', size: 200 }, { text: 'DAYS', color: COLORS.cream, size: 130 }], { at: [t13, s.w('दिन')], y: 280 });
    s.camera([[0, 1.0, 540, 1000], [tBig, 1.08, cl[0], cl[1]], [s.dur, 1.12, cl[0], cl[1]]]);
  });

  S('S29', { look: 'paper' }, (s) => {
    const tFall = s.w('गिरते'), tOther = s.w('दूसरा');
    const leaf = s.sprite('leaf_wet', { x: 540, y: 1150, w: 1180, shadow: { ground: 0.2, drop: 0.25 } });
    const land = tFall + 0.45;
    s.sprite('leaf_dropping', { at: land, x: 540, y: 1150, w: 1180, z: 1, enter: { from: 'fade', dur: 0.08, sfx: null }, shadow: { ground: 0, drop: 0 } });
    const dp = P(leaf, 0, G.leaf.dropping);
    s.custom({ at: tFall - 0.05, until: land, z: 3 }, (ctx, t) => {
      const u = ease.inQuad(prog(t, tFall - 0.05, land - tFall + 0.05));
      const y = lerp(250, dp[1], u);
      ctx.save(); ctx.fillStyle = '#f2efe6'; ctx.strokeStyle = 'rgba(90,80,60,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(dp[0], y, 16, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(90,70,40,0.6)'; ctx.beginPath(); ctx.ellipse(dp[0] + 2, y + 4, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    s.sfx(tFall - 0.05, 'whoosh', 0.35); s.sfx(land, 'splat', 0.8);
    s.sprite('snail_healthy', { at: tOther - 0.3, w: 560, anchor: [0.5, GEO('snail_healthy').foot], z: 5,
      path: [[tOther - 0.3, -300, dp[1] + 20], [s.dur, dp[0] - (GEO('snail_healthy').mouth[0] - 0.5) * 560 - 60, dp[1] + 20, ease.outQuad]], crawl: { stretch: 0.02, freq: 1.1 } });
    s.title(['BACK TO', 'BIRD POOP'], { at: [0.1, s.w('बीट')] });
    s.camera([[0, 1.0, 540, 1100], [land, 1.04, dp[0], dp[1]], [s.dur, 1.1, dp[0] - 60, dp[1]]]);
  });

  // =========================================================== ENDING
  S('S30', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    s.sfx(0, 'slide', 0.6);
    const fx = 120, fy = 560, fw = 840, fh = 900;
    s.custom({ at: 0, z: 0 }, (ctx, t) => {
      const p = prog(t, 0, 0.35, ease.outCubic);
      ctx.save(); ctx.translate(0, (1 - p) * 300); ctx.globalAlpha = clamp(t / 0.15);
      // shadow
      ctx.save(); ctx.filter = 'blur(20px)'; ctx.fillStyle = 'rgba(30,18,6,0.5)'; ctx.fillRect(fx + 14, fy + 24, fw, fh); ctx.restore();
      // wooden frame
      const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
      g.addColorStop(0, '#7a5232'); g.addColorStop(0.5, '#5c3a20'); g.addColorStop(1, '#3e2614');
      ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = 'rgba(255,220,170,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(fx + 4, fy + 4, fw - 8, fh - 8);
      // mounting board
      ctx.drawImage(paperTexture(fw - 80, fh - 80, '#f1ead9', 61, false), fx + 40, fy + 40);
      ctx.strokeStyle = 'rgba(30,18,6,0.45)'; ctx.lineWidth = 6; ctx.strokeRect(fx + 40, fy + 40, fw - 80, fh - 80);
      ctx.restore();
    });
    const items = [
      { key: 'snail_infected', x: 330, y: 760, w: 380, label: 'SNAIL · THE BAIT', at: 0.4 },
      { key: 'bird_perched', x: 740, y: 780, w: 420, label: 'BIRD · THE RIDE', at: 0.7 },
      { key: 'flatworm', x: 540, y: 1150, h: 120, rot: 90, label: 'THE WORM · 1.5 MM', at: s.w('छोटा') },
    ];
    for (const it of items) {
      s.sprite(it.key, { at: it.at, x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot, enter: { from: 'scale', s0: 0.85, dur: 0.25, sfx: 'pop' }, shadow: { ground: 0, drop: 0.3 }, z: 5, pulse: it.key === 'snail_infected' ? { start: 0 } : undefined });
      s.type(it.label, { at: it.at + 0.2, x: it.x, y: it.y + (it.key === 'flatworm' ? 130 : 190), size: 20, spacing: 2, cps: 30, align: 'center', gain: 0.25, soundEvery: 3, layer: 'world' });
    }
    // grain of rice for scale
    s.custom({ at: s.w('चावल'), z: 6 }, (ctx, t) => {
      const p = prog(t, s.w('चावल'), 0.25, ease.outBack);
      ctx.save(); ctx.translate(360, 1160); ctx.rotate(-0.4); ctx.scale(p, p);
      const g = ctx.createLinearGradient(-60, -20, 60, 20);
      g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#efe6d3'); g.addColorStop(1, '#cfc2a6');
      ctx.fillStyle = g; ctx.shadowColor = 'rgba(40,25,10,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    s.type('RICE GRAIN', { at: s.w('चावल') + 0.2, x: 360, y: 1235, size: 20, spacing: 2, cps: 30, align: 'center', gain: 0.25, soundEvery: 3 });
    s.custom({ at: s.w('कीड़ा'), layer: 'ui', z: 60 }, (ctx, t) => markerEllipse(ctx, 540, 1150, 120, 95, prog(t, s.w('कीड़ा'), 0.5, ease.inOutQuad), { width: 7, seed: 12 }));
    s.sfx(s.w('कीड़ा'), 'pen', 0.8);
    s.title([{ text: 'NATURE', red: true }], { at: [0.1] });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1050]]);
  });

  S('S31', { look: 'paper' }, (s) => {
    const cx = 540, cy = 1020, R = 262;
    s.sprite('flatworm', { x: cx, y: cy, h: 200, rot: 90, enter: { from: 'scale', s0: 0.6, dur: 0.3, sfx: null }, wobble: 2, shadow: { ground: 0, drop: 0.25 } });
    const nodes = [
      { key: 'bird_perched', label: 'BIRD', w: 230 },
      { key: 'leaf_dropping', label: 'POOP + EGGS', w: 230 },
      { key: 'snail_healthy', label: 'SNAIL EATS', w: 220 },
      { key: 'snail_healthy', label: 'TUBES INTO EYES', w: 220, xray: true },
      { key: 'snail_infected', label: 'PULSING EYES', w: 220, pulse: true },
      { key: 'bird_pecking', label: 'BIRD EATS', w: 230 },
    ];
    const n = nodes.length, step = Math.min(0.45, (s.voEnd - 0.6) / (n + 1));
    nodes.forEach((nd, i) => {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R * 1.08;
      const at = 0.2 + i * step;
      s.custom({ at, z: 4 }, (ctx, t) => {
        const p = prog(t, at, 0.3, ease.outBack);
        ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha = clamp((t - at) / 0.1);
        ctx.shadowColor = 'rgba(40,25,10,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
        ctx.fillStyle = nd.xray ? '#23231e' : '#f0e7d3';
        ctx.beginPath(); ctx.ellipse(0, 0, 118, 88, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      s.sprite(nd.key, { at, x, y: y - 6, w: nd.w * 0.76, xray: nd.xray, z: 5, enter: { from: 'scale', s0: 0.5, dur: 0.3, sfx: 'pop', gain: 0.4 }, shadow: { ground: 0, drop: 0.15 }, pulse: nd.pulse ? { start: 0 } : undefined });
      s.type(nd.label, { at: at + 0.15, x, y: y + 118, size: 19, spacing: 2, cps: 40, align: 'center', gain: 0.2, soundEvery: 4, layer: 'world' });
      const a0 = ang + 0.42, a1 = ang + (Math.PI * 2) / n - 0.42;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const a = lerp(a0, a1, k / 12); pts.push([cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.1]); }
      s.arrow({ at: at + step * 0.6, pts, dur: 0.35, width: 5, head: 24, gain: 0.25 });
    });
    s.kicker('NEXT SPECIMEN? COMMENT BELOW', { at: s.w('कमेंट') - 0.2, cps: 30 });
    s.title(['HOW', 'STRANGE'], { at: [s.w('कुदरत'), s.w('अजीब')] });
    s.camera([[0, 1.0, 540, 1050], [s.dur, 1.03, 540, 1050]]);
  });
}

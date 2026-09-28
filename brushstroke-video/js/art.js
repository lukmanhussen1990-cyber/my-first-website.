/* art.js - the three illustrated interludes, painted entirely in code:
   a watercolour sky built from hundreds of brush streaks, a glowing light
   source, and ink-brush silhouettes with rim light. Coordinates are in the
   1080x720 band; the centre column is kept open for the lyrics. */
(function () {
  'use strict';
  const BV = window.BV;
  const U = BV.util;
  const B = BV.brush;
  const { arc, cat } = U;

  const W = 1080;
  const H = 720;
  const INK = '#1a100b';

  function rot(pts, cx, cy, deg) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return pts.map((p) => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]);
  }
  function hexA(hex, a) {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  function Scene(seed) {
    const r = U.rng(seed);
    const lines = [];
    const fills = [];
    const glows = [];
    const back = U.makeCanvas(W, H);
    const bx = back.getContext('2d');
    let n = 0;

    const api = {
      r,
      // ---- backdrop painting (baked once) ----
      gradient(stops, y0, y1) {
        const g = bx.createLinearGradient(0, y0, 0, y1);
        for (const [p, c] of stops) g.addColorStop(p, c);
        bx.fillStyle = g;
        bx.fillRect(0, y0, W, y1 - y0);
      },
      // loose horizontal brush streaks: this is what makes it read as paint
      streaks(y0, y1, colors, count, w0, w1, a0, a1, len0, len1) {
        for (let i = 0; i < count; i++) {
          const y = U.lerp(y0, y1, r());
          const len = U.lerp(len0 || 200, len1 || 700, r());
          const x = r() * (W + 200) - 100 - len / 2;
          const tilt = (r() - 0.5) * 14;
          const st = B.make([[x, y], [x + len * 0.5, y + tilt * 0.5 + (r() - 0.5) * 6], [x + len, y + tilt]], {
            w: U.lerp(w0, w1, r()), color: colors[Math.floor(r() * colors.length)], alpha: U.lerp(a0, a1, r()),
            dry: 0.6, edge: 0.3, wobble: 0.35, tin: len * 0.15, tout: len * 0.35, seed: seed * 13 + n++, step: 2,
          });
          B.draw(bx, st, 1);
        }
      },
      radial(x, y, r0, r1, color, a) {
        const g = bx.createRadialGradient(x, y, r0, x, y, r1);
        g.addColorStop(0, hexA(color, a));
        g.addColorStop(1, hexA(color, 0));
        bx.fillStyle = g;
        bx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
      },
      disc(x, y, rad, color, a0, a1) {
        bx.save();
        bx.shadowColor = hexA(color, 0.9);
        bx.shadowBlur = 30;
        bx.fillStyle = color;
        bx.beginPath();
        bx.arc(x, y, rad, ((a0 == null ? 0 : a0) * Math.PI) / 180, ((a1 == null ? 360 : a1) * Math.PI) / 180);
        bx.closePath();
        bx.fill();
        bx.restore();
      },
      paint(pts, o) {
        B.draw(bx, B.make(pts, Object.assign({ seed: seed * 17 + n++ }, o)), 1);
      },
      // ---- animated layers ----
      line(pts, w, o) {
        lines.push(B.make(pts, Object.assign({ w: w || 3, color: INK, dry: 0.4, edge: 0.2, wobble: 0.25, seed: seed * 1000 + n++ }, o)));
      },
      // ink silhouette: many near-opaque layers give a dense body with soft, bleeding edges
      fill(poly, o) {
        fills.push(B.makeWash(poly, Object.assign({ color: INK, alpha: 0.3, layers: 12, variance: 0.018, seed: seed * 91 + fills.length }, o)));
      },
      // brush outline of a silhouette edge, so it gets a painted, dry edge
      edge(pts, w, o) {
        api.line(pts, w || 2.6, Object.assign({ dry: 0.55, tin: 10, tout: 30 }, o));
      },
      // rim light along an edge, nudged inside the silhouette
      rim(pts, dx, dy, color, w, a) {
        api.line(pts.map((p) => [p[0] + dx, p[1] + dy]), w || 2.2, { color: color || '#ffe2b4', alpha: a || 0.75, dry: 0.5, tin: 30, tout: 60, edge: 0.3 });
      },
      // fine hair flicks leaving an edge
      flicks(pts, count, len, dirx, diry, w, o) {
        for (let i = 0; i < count; i++) {
          const p = pts[Math.floor(r() * pts.length)];
          const l = len * (0.5 + r());
          const bend = (r() - 0.5) * l * 0.5;
          const ex = p[0] + dirx * l + (r() - 0.5) * l * 0.4, ey = p[1] + diry * l + (r() - 0.5) * l * 0.4;
          api.line([[p[0] - dirx * 4, p[1] - diry * 4], [(p[0] + ex) / 2 - diry * bend, (p[1] + ey) / 2 + dirx * bend], [ex, ey]], (w || 1.6) * (0.6 + r() * 0.7), Object.assign({ tin: 2, minTip: 0.04, dry: 0.4, alpha: 0.9 }, o));
        }
      },
      glow(x, y, rad, color, a) {
        glows.push({ x, y, r: rad, color, a });
      },
      done() {
        return { back, fills, lines, glows };
      },
    };
    return api;
  }

  // ------------------------------------------------------------------
  // 1. "between you and me?" - two people from behind on a sea wall,
  //    the sun setting in the gap between them.
  // ------------------------------------------------------------------
  function couple() {
    const S = Scene(101);
    const R = S.r;
    const HZ = 300; // horizon

    S.gradient([[0, '#dc8f8a'], [0.35, '#eeae98'], [0.75, '#f8d3a6'], [1, '#fde9c0']], 0, HZ);
    S.gradient([[0, '#f0bf98'], [0.3, '#dc9c86'], [1, '#a9676c']], HZ, H);
    S.streaks(0, HZ - 8, ['#f6c7a4', '#e99f90', '#fbe1b6', '#e28f8a', '#f3b69b'], 70, 10, 40, 0.1, 0.3);
    S.radial(540, HZ, 40, 420, '#fff1d0', 0.75);
    S.disc(540, HZ, 86, '#fff6de', 180, 360);
    S.streaks(HZ + 4, 560, ['#f4c7a2', '#c77f78', '#e5a78c', '#b06b6d', '#f8d9b0'], 110, 4, 16, 0.2, 0.5, 60, 320);
    // the sun's reflection breaking up on the water
    for (let k = 0; k < 52; k++) {
      const y = HZ + 6 + k * 5 + R() * 3;
      const hw = 92 * Math.pow(1 - k / 64, 1.2) * (0.5 + R() * 0.6);
      const cx = 540 + (R() - 0.5) * 24;
      S.paint([[cx - hw, y], [cx, y + (R() - 0.5) * 2], [cx + hw, y]], { w: 2.5 + R() * 3.5, color: '#fff2d2', alpha: 0.45 + R() * 0.45, dry: 0.45, tin: hw * 0.4, tout: hw * 0.5 });
    }
    S.paint([[0, HZ], [360, HZ - 1], [720, HZ + 1], [1080, HZ]], { w: 1.6, color: '#8a5250', alpha: 0.35, dry: 0.5 });
    S.glow(540, HZ - 10, 220, '#ffd9a0', 0.25);

    // birds
    for (const [x, y, s] of [[640, 150, 1], [668, 132, 0.8], [420, 176, 0.7], [700, 170, 0.6]]) {
      S.line([[x - 11 * s, y + 2 * s], [x - 5 * s, y - 3 * s], [x, y + 2 * s, 1], [x + 5 * s, y - 3 * s], [x + 11 * s, y + 2 * s]], 2.2 * s, { alpha: 0.85 });
    }

    // --- him ---
    const himHead = (pts) => rot(pts, 272, 330, 5);
    const head = himHead(arc(272, 212, 76, 88, 158, 382, 6).map((p, i) => {
      const k = 1 + (R() - 0.5) * 0.06 + (i % 3 === 0 ? 0.035 : 0);
      return [272 + (p[0] - 272) * k, 212 + (p[1] - 212) * k];
    }));
    const himPoly = cat(
      [[238, 328], [246, 302]], himHead([[214, 290]]), head, himHead([[330, 290]]), [[298, 302], [306, 328]],
      [[368, 338], [422, 364], [444, 414], [450, 490], [452, 540], [468, 552], [494, 558], [502, 566], [80, 568], [84, 490], [96, 412], [122, 362], [176, 338]]
    );
    S.fill(himPoly);
    S.fill(himHead(arc(196, 238, 10, 17, 0, 360, 30)));
    S.fill(himHead(arc(348, 238, 10, 17, 0, 360, 30)));
    S.edge(head, 3);
    S.flicks(head.slice(4, head.length - 4), 26, 16, 0, -1, 1.7);
    S.flicks(head.slice(0, 8), 8, 12, -1, 0, 1.5);
    S.flicks(head.slice(head.length - 8), 8, 12, 1, 0, 1.5);
    S.rim(head.slice(head.length / 2), -2, 2, '#ffd9a6', 2.2, 0.7);
    S.rim([[308, 330], [368, 340], [420, 366], [442, 414], [448, 490], [450, 540]], -2.5, 1, '#ffd29c', 2.4, 0.75);

    // --- her ---
    const herHead = (pts) => rot(pts, 812, 330, -4);
    const crown = arc(812, 204, 70, 82, 196, 344, 8);
    const hairR = cat(crown.slice(Math.floor(crown.length / 2)), [[884, 200], [880, 272], [892, 350], [900, 438], [906, 500]]);
    const hairL = cat([[726, 500], [726, 438], [734, 350], [746, 272], [742, 200]], crown.slice(0, Math.ceil(crown.length / 2)));
    const tips = [];
    for (let i = 0; i <= 12; i++) {
      const x = 906 - (i * 180) / 12;
      tips.push([x + (R() - 0.5) * 6, 520 + (i % 2 ? 18 : 2) + R() * 10]);
    }
    const hair = herHead(cat(hairR, tips, hairL));
    S.fill([[744, 330], [700, 350], [672, 398], [660, 480], [656, 540], [640, 552], [614, 558], [606, 566], [964, 568], [958, 480], [948, 398], [924, 350], [880, 330]]);
    S.fill(hair);
    S.edge(herHead(hairR), 2.8);
    S.edge(herHead(hairL), 2.8);
    S.flicks(herHead(hairL.slice(0, 5)), 10, 22, -1, 0.4, 1.4);
    S.flicks(herHead(hairR.slice(2)), 10, 22, 1, 0.4, 1.4);
    S.flicks(herHead(tips), 16, 18, 0, 1, 1.4);
    S.flicks(herHead(hairR.slice(0, 3).concat(hairL.slice(4))), 8, 10, 0, -1, 1.2);
    S.rim(herHead(hairL.slice().reverse()), 2, 1, '#ffd9a6', 2.2, 0.7);
    S.rim([[742, 332], [700, 352], [674, 400], [662, 480], [658, 540]], 2.5, 1, '#ffd29c', 2.4, 0.75);

    // the wall they sit on
    const wall = [[0, 566], [300, 563], [620, 567], [1080, 564], [1080, 720], [0, 720]];
    S.fill(wall, { variance: 0.008 });
    S.edge([[0, 566], [300, 563], [620, 567], [1080, 564]], 3.5);
    S.rim([[330, 566], [540, 567], [750, 566]], 0, 2.5, '#ffcf98', 2, 0.5);

    return S.done();
  }

  // ------------------------------------------------------------------
  // 2. "is your eyes" - two profiles facing each other before a full moon.
  // ------------------------------------------------------------------
  function faces() {
    const S = Scene(202);
    const R = S.r;

    S.gradient([[0, '#b98397'], [0.35, '#d99c9f'], [0.7, '#efbfa6'], [1, '#f6d6b0']], 0, H);
    S.streaks(0, H, ['#e3a9a4', '#c78d9c', '#f2c7a9', '#d6969b', '#f7dab6'], 120, 10, 44, 0.08, 0.26);
    S.radial(540, 350, 60, 460, '#fff0d6', 0.7);
    S.disc(540, 350, 128, '#fff5e2');
    // stars
    for (let i = 0; i < 40; i++) {
      const x = R() * W, y = R() * 300;
      if (Math.abs(x - 540) < 200) continue;
      S.paint([[x, y], [x + 1.5, y + 1]], { w: 2 + R() * 2.5, color: '#fff4e0', alpha: 0.5 + R() * 0.5, dry: 0 });
    }
    S.glow(540, 350, 300, '#ffe6c0', 0.3);

    // her profile, facing right
    const herFront = [
      [300, -30], [338, 20], [362, 70], [378, 120], [389, 170], [394, 212], [392, 236], [387, 250],
      [396, 268], [414, 292], [436, 314], [452, 328], [457, 338], [452, 346], [438, 350], [421, 353],
      [421, 366], [431, 376], [434, 382], [426, 388], [419, 392], [428, 399], [429, 406], [421, 414], [413, 421],
      [418, 436], [420, 452], [414, 468], [400, 479], [380, 485], [362, 488],
      [354, 502], [352, 540], [356, 580], [366, 620], [392, 670], [420, 730],
    ];
    const herBack = [[40, 730], [50, 640], [62, 560], [70, 480], [76, 400], [84, 320], [100, 240], [130, 160], [180, 90], [240, 30], [270, -30]];
    S.fill(herFront.concat(herBack));
    S.edge(herFront.slice(2, 31), 2.6);
    S.flicks(herBack.slice(1, 10), 30, 26, -1, 0.3, 1.5);
    S.flicks(herFront.slice(0, 5), 12, 18, 1, -0.2, 1.3);
    // a loose strand falling in front of her neck
    S.line([[330, 160], [360, 300], [352, 420], [372, 520], [360, 620]], 1.6, { alpha: 0.9 });
    // lashes catching the light
    S.line([[392, 262], [402, 256], [410, 257]], 1.4, { alpha: 0.95 });
    S.line([[391, 266], [403, 263], [409, 266]], 1.3, { alpha: 0.9 });
    S.rim(herFront.slice(3, 31), -2.4, 0, '#fff1d6', 2.4, 0.85);

    // his profile, facing left
    const hisFront = [
      [800, -30], [756, 30], [736, 80], [722, 130], [712, 180], [706, 214],
      [702, 232], [696, 246], [700, 256],
      [686, 272], [664, 296], [642, 318], [626, 332], [622, 344], [630, 352], [648, 356], [662, 360],
      [660, 372], [650, 382], [648, 388], [656, 393], [662, 396], [652, 403], [652, 410], [660, 418], [668, 426],
      [664, 442], [662, 462], [668, 478], [688, 490], [716, 494], [736, 496],
      [744, 512], [738, 530], [744, 546], [748, 580], [740, 620], [714, 670], [690, 730],
    ];
    const hisBack = [[1040, 730], [1030, 640], [1000, 560], [970, 500], [962, 440], [972, 380], [990, 300], [1000, 220], [990, 140], [960, 80], [910, 20], [860, -30]];
    S.fill(hisFront.concat(hisBack));
    S.edge(hisFront.slice(3, 32), 2.6);
    S.flicks(hisFront.slice(0, 6), 18, 16, -1, -0.5, 1.6);
    S.flicks(hisBack.slice(6), 22, 14, 1, -0.3, 1.6);
    S.rim(hisFront.slice(4, 32), 2.4, 0, '#fff1d6', 2.4, 0.85);

    return S.done();
  }

  // ------------------------------------------------------------------
  // 3. "is your touch" - two hands reaching, fingertips meeting in light.
  // ------------------------------------------------------------------
  function hands() {
    const S = Scene(303);
    const R = S.r;
    const TX = 544, TY = 472; // where they touch

    S.gradient([[0, '#e7a988'], [0.4, '#f5cc9e'], [0.75, '#f8dcb2'], [1, '#eab58f']], 0, H);
    S.streaks(0, H, ['#f3c39a', '#e8a585', '#fae2b8', '#eeb28e', '#f7d4a8'], 120, 10, 44, 0.1, 0.28);
    S.radial(TX, TY, 20, 520, '#fff4dc', 0.85);
    // light rays
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + R() * 0.2;
      const r0 = 60 + R() * 30, r1 = 300 + R() * 260;
      S.paint([[TX + Math.cos(a) * r0, TY + Math.sin(a) * r0], [TX + Math.cos(a) * r1, TY + Math.sin(a) * r1]], { w: 14 + R() * 30, color: '#fff3d8', alpha: 0.12 + R() * 0.12, dry: 0.7, tin: 20, tout: 200 });
    }
    S.glow(TX, TY, 120, '#fff0cc', 0.5);

    // her hand, from the left, with a ruffled cuff
    const left = [
      [-10, 424], [120, 424], [206, 428],
      [214, 410], [226, 402], [236, 412], [244, 399], [256, 408], [264, 424],
      [300, 428], [345, 424], [384, 428],
      [430, 440], [478, 452], [512, 460], [530, 464], [538, 469], [540, 475], [535, 481], [524, 483],
      [496, 480], [470, 478],
      [492, 488], [506, 495], [510, 502], [505, 508], [492, 509], [462, 503],
      [478, 514], [486, 520], [484, 527], [474, 530], [446, 524],
      [456, 534], [458, 541], [450, 546], [426, 542], [404, 536],
      [360, 538], [310, 536], [266, 532],
      [260, 548], [248, 540], [238, 554], [226, 542], [214, 552], [206, 538],
      [120, 542], [-10, 548],
    ];
    const grow = (pts) => pts.map(([x, y]) => [TX + (x - TX) * 1.22, TY + (y - TY) * 1.22]);
    left.splice(0, left.length, ...grow(left));
    S.fill(left);
    S.edge(left.slice(9, 41), 2.4);
    S.edge(left.slice(2, 10), 2, { alpha: 0.9 });
    S.rim(left.slice(10, 20), 0, 2.4, '#fff3da', 2.4, 0.9);
    S.rim(left.slice(19, 38), -2, -1, '#ffe7c0', 1.8, 0.6);

    // his hand, from the right, in a suit sleeve with a shirt cuff
    const fingers = left.slice(9, 41).map(([x, y], i) => [2 * TX + 6 - x, y - 8 + Math.sin(i * 0.9) * 1.5]);
    const right = cat(
      grow([[1090, 404], [960, 408], [898, 412], [894, 424], [872, 424], [848, 428]]),
      fingers,
      grow([[848, 528], [872, 528], [894, 530], [900, 542], [960, 546], [1090, 552]])
    );
    S.fill(right);
    S.edge(fingers, 2.4);
    S.edge(grow([[898, 412], [894, 424], [894, 530], [900, 542]]), 2.2);
    S.line(grow([[872, 426], [870, 526]]), 1.6, { color: '#3a2a20', alpha: 0.8 });
    S.rim(fingers.slice(1, 11), 0, 2.4, '#fff3da', 2.4, 0.9);
    S.rim(fingers.slice(10, 29), 2, -1, '#ffe7c0', 1.8, 0.6);

    // sparks where they touch
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, d = 18 + Math.pow(R(), 1.6) * 150;
      const x = TX + Math.cos(a) * d, y = TY + Math.sin(a) * d * 0.8;
      const l = 2 + R() * 5;
      S.line([[x - l, y], [x + l, y + (R() - 0.5) * 2]], 2 + R() * 2.5, { color: '#fffaf0', alpha: 0.55 + R() * 0.45, dry: 0.1, tin: 2, tout: 3 });
    }

    return S.done();
  }

  const builders = { couple, faces, hands };
  BV.art = {
    build(name) {
      return builders[name]();
    },
  };
})();

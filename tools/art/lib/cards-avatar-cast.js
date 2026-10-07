/*
 * The twelve Border Trials characters (avatar-00 … avatar-11). Each entry is
 * a spec for paintAvatar(): skin / hair tones, head turn, rim-light side,
 * outfit, and hair / accessory painters. All original designs.
 */
import { rgba, mul, mixc, softEllipse, lockPath, spline } from './cards-avatar.js';

const lerp = (a, b, t) => a + (b - a) * t;

/* ─────────────── shared accessory painters ─────────────── */

/** Thick fabric rim around the face opening of a hood. */
function hoodRim(ctx, g, spec) {
  const half = [
    [0, -170, 34],
    [58, -160, 30],
    [100, -124, 22],
    [120, -64, 14],
    [124, 0, 10],
    [118, 64, 14],
    [102, 124, 22],
    [80, 172, 30],
    [64, 210, 30],
  ];
  const pts = [
    ...half
      .slice(1)
      .reverse()
      .map(([x, y, z]) => g.P(-x, y, z)),
    ...half.map(([x, y, z]) => g.P(x, y, z)),
  ];
  const base = spec.cloth;
  ctx.save();
  ctx.lineJoin = 'round';
  // fabric roll
  ctx.strokeStyle = rgba(mul(base, 1.08));
  ctx.lineWidth = 28;
  ctx.beginPath();
  spline(ctx, pts, false);
  ctx.stroke();
  // inner fold shadow
  const c = [g.hx + g.sn * 30, g.ey + 10];
  ctx.strokeStyle = rgba(mul(base, 0.3), 0.85);
  ctx.lineWidth = 5;
  ctx.beginPath();
  spline(
    ctx,
    pts.map(([x, y]) => [lerp(x, c[0], 0.085), lerp(y, c[1], 0.085)]),
    false,
  );
  ctx.stroke();
  // outer seam highlight
  ctx.strokeStyle = rgba(mul(base, 1.9), 0.35);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  spline(
    ctx,
    pts.map(([x, y]) => [lerp(x, c[0], -0.07), lerp(y, c[1], -0.07)]),
    false,
  );
  ctx.stroke();
  ctx.restore();
}

function hoodBack(ctx, g, spec) {
  const cx = g.hx - g.sn * 10;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 190, g.ey + 230);
  ctx.bezierCurveTo(cx - 175, g.ey + 90, cx - 168, g.ey - 140, cx - 40, g.ey - 186);
  ctx.quadraticCurveTo(cx + 10, g.ey - 202, cx + 60, g.ey - 184);
  ctx.bezierCurveTo(cx + 172, g.ey - 140, cx + 178, g.ey + 90, cx + 190, g.ey + 230);
  ctx.closePath();
  ctx.fillStyle = rgba(spec.cloth);
  ctx.fill();
  ctx.clip();
  // dark interior around the head
  ctx.save();
  ctx.translate(g.hx + g.sn * 20, g.ey - 22);
  ctx.scale(1, 1.3);
  const ig = ctx.createRadialGradient(0, 0, 60, 0, 0, 122);
  ig.addColorStop(0, 'rgba(0,0,0,0.96)');
  ig.addColorStop(0.8, 'rgba(0,0,0,0.85)');
  ig.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ig;
  ctx.fillRect(-200, -200, 400, 400);
  ctx.restore();
  // fold creases
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 3;
  for (const m of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + m * 150, g.ey - 80);
    ctx.quadraticCurveTo(cx + m * 172, g.ey + 40, cx + m * 160, g.ey + 160);
    ctx.stroke();
  }
  ctx.restore();
}

function earLobe(g) {
  // the ear that sticks out (near side)
  const m = g.sn > 0 ? -1 : 1;
  const [x, y] = g.P(m * 86, 14, -8);
  return [x + m * 6, y + 30, m];
}

/** Long hair falling behind the shoulders. */
function longBack(ctx, g, spec, r, H, o = {}) {
  const shapes = [];
  const width = o.width ?? 128;
  const bottom = o.bottom ?? 280;
  shapes.push({
    cap: [
      g.P(-width, -30, -20),
      g.P(-width * 0.8, -140, -20),
      g.P(0, -176, -20),
      g.P(width * 0.8, -140, -20),
      g.P(width, -30, -20),
      g.P(width + 18, bottom * 0.6, -30),
      g.P(width + 10, bottom, -30),
      g.P(0, bottom - 30, -40),
      g.P(-width - 10, bottom, -30),
      g.P(-width - 18, bottom * 0.6, -30),
    ],
  });
  for (let i = 0; i < 14; i++) {
    const m = i % 2 ? 1 : -1;
    const x = m * (width * (0.55 + r() * 0.45));
    const root = g.P(x, -40 + r() * 60, -20);
    const tip = g.P(x + m * (r() * 30), bottom + r() * 40, -30);
    shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 36 + r() * 20, (r() - 0.5) * 30] });
  }
  return H.paintHair(ctx, g, { ...spec, hair: mul(spec.hair, 0.8) }, shapes, r, { sheenY: 60 });
}

/* ─────────────── the cast ─────────────── */

export const CAST = [
  // 00 — The Drifter: hoodie up, messy fringe
  {
    name: 'drifter',
    seed: 11,
    sex: 'm',
    skin: [196, 158, 136],
    hair: [24, 21, 25],
    cloth: [48, 48, 56],
    iris: [60, 40, 32],
    turn: 0.22,
    light: 1,
    outfit: 'hoodie',
    noEars: true,
    browAngle: 2,
    back: (ctx, g, spec) => hoodBack(ctx, g, spec),
    front: (ctx, g, spec, r, H) => {
      const shapes = [
        { cap: H.cap(g, { vol: 6, hairline: -100, bottom: -10 }) },
        ...H.fringe(g, r, { span: 74, len: 92, rootY: -118, w: 40, sweep: -14, mess: 26, n: 11, taper: 0.4 }),
      ];
      // side locks at the temples
      for (const m of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          const root = g.P(m * (82 + i * 6), -70, 10);
          const tip = g.P(m * (86 - i * 10), 4 + i * 26, 20);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 26, -m * 8] });
        }
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g, spec) => hoodRim(ctx, g, spec),
  },

  // 01 — The Medic: short hair, surgical mask pulled down
  {
    name: 'medic',
    cheek: 78,
    seed: 23,
    sex: 'f',
    skin: [214, 176, 154],
    hair: [44, 30, 26],
    cloth: [30, 58, 64],
    iris: [80, 52, 34],
    turn: -0.2,
    light: -1,
    outfit: 'scrubs',
    browArch: 2,
    front: (ctx, g, spec, r, H) => {
      const shapes = [
        { cap: H.cap(g, { vol: 10, hairline: -98, bottom: 0, temple: -30, hairW: 84 }) },
        ...H.fringe(g, r, { span: 60, len: 70, rootY: -120, w: 44, sweep: 52, mess: 10, n: 7, taper: 0.2, bend: 10 }),
      ];
      for (const m of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const root = g.P(m * 90, -66 + i * 12, 0);
          const tip = g.P(m * (96 - i * 2), -12 + i * 14, -6);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 24, -m * 6] });
        }
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g) => {
      // surgical mask pulled under the chin
      const pts = [g.P(-84, 74, 10), g.P(-60, 128, 30), g.P(0, g.chinY + 26, 64), g.P(60, 128, 30), g.P(84, 74, 10)];
      const pts2 = [g.P(84, 74, 10), g.P(64, 168, 10), g.P(0, g.chinY + 70, 40), g.P(-64, 168, 10), g.P(-84, 74, 10)];
      ctx.save();
      ctx.beginPath();
      spline(ctx, pts, false);
      spline(ctx, pts2, false, false);
      ctx.closePath();
      const mg = ctx.createLinearGradient(0, g.ey + 80, 0, g.ey + 190);
      mg.addColorStop(0, 'rgb(150,182,192)');
      mg.addColorStop(1, 'rgb(70,96,108)');
      ctx.fillStyle = mg;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(40,60,70,0.55)';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        spline(
          ctx,
          [g.P(-80, 80 + i * 22, 10), g.P(0, g.chinY + 22 + i * 14, 60), g.P(80, 80 + i * 22, 10)],
          false,
        );
        ctx.stroke();
      }
      ctx.restore();
      // ear loops
      ctx.strokeStyle = 'rgba(200,215,220,0.7)';
      ctx.lineWidth = 2;
      for (const m of [-1, 1]) {
        const a = g.P(m * 84, 80, 10), b = g.P(m * 90, 30, -8);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(a[0] + m * 10, (a[1] + b[1]) / 2, b[0], b[1]);
        ctx.stroke();
      }
    },
  },

  // 02 — The Runner: headband, athletic collar
  {
    name: 'runner',
    jaw: 66,
    cheek: 82,
    seed: 37,
    sex: 'm',
    skin: [152, 104, 78],
    hair: [18, 16, 18],
    cloth: [24, 24, 30],
    iris: [50, 32, 24],
    turn: 0.12,
    light: 1,
    outfit: 'track',
    browT: 7,
    front: (ctx, g, spec, r, H) => {
      const shapes = [
        { cap: H.cap(g, { vol: 10, hairline: -96, bottom: -20 }) },
      ];
      // brushed-up textured quiff: locks rooted at the hairline sweeping up/back
      for (let i = 0; i < 13; i++) {
        const x = lerp(-82, 82, i / 12) + (r() - 0.5) * 6;
        const root = g.P(x, -92 + Math.abs(x) * 0.25, g.zs(x, -92) + 10);
        const tip = g.P(x * 1.14 + 14 + (r() - 0.5) * 12, -150 - (1 - Math.abs(x) / 90) * 10 - r() * 6, -16);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 48 + r() * 10, -12 + (r() - 0.5) * 10] });
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g) => {
      // headband across the forehead
      const top = [], bot = [];
      for (let i = 0; i <= 12; i++) {
        const x = lerp(-96, 96, i / 12);
        top.push(g.P(x, -96 + Math.abs(x) * 0.08, g.zs(x, -96) + 10));
        bot.push(g.P(x, -72 + Math.abs(x) * 0.1, g.zs(x, -72) + 10));
      }
      ctx.save();
      ctx.beginPath();
      spline(ctx, top, false);
      spline(ctx, bot.reverse(), false, false);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, g.ey - 100, 0, g.ey - 68);
      bg.addColorStop(0, 'rgb(236,40,48)');
      bg.addColorStop(0.5, 'rgb(190,16,28)');
      bg.addColorStop(1, 'rgb(110,6,14)');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      spline(ctx, top.map(([x, y]) => [x, y + 13]), false);
      ctx.stroke();
      ctx.restore();
    },
  },

  // 03 — The Hacker: visor glasses with red reflection, headphones round neck
  {
    name: 'hacker',
    chinY: 116,
    eyeTilt: 2,
    seed: 41,
    sex: 'f',
    skin: [228, 192, 172],
    hair: [26, 24, 34],
    cloth: [22, 22, 28],
    turn: -0.12,
    light: 1,
    outfit: 'techjacket',
    back: (ctx, g, spec) => {
      // headphone band behind the neck
      const cx = g.hx - g.sn * 26;
      ctx.strokeStyle = 'rgb(30,30,36)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(cx - 74, g.ey + 168);
      ctx.quadraticCurveTo(cx, g.ey + 120, cx + 74, g.ey + 168);
      ctx.stroke();
    },
    front: (ctx, g, spec, r, H) => {
      const shapes = [{ cap: H.cap(g, { vol: 12, hairline: -100, bottom: -10, temple: -50 }) }];
      // long side-swept curtain over one side (−x), short on the other
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const root = g.P(lerp(20, -70, t), -128 + t * 20, 40);
        const tip = g.P(lerp(-30, -104, t) + (r() - 0.5) * 10, lerp(-20, 110, t) + r() * 20, 30);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 44, -14] });
      }
      for (let i = 0; i < 5; i++) {
        const root = g.P(lerp(30, 86, i / 4), -120 + i * 8, 20);
        const tip = g.P(lerp(60, 100, i / 4), -60 + i * 12, 0);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 30, 6] });
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g) => {
      // visor glasses
      const top = [], bot = [];
      for (let i = 0; i <= 12; i++) {
        const x = lerp(-90, 90, i / 12);
        const z = g.zs(x, -4) + 14;
        top.push(g.P(x, -20 + Math.abs(x) * 0.04, z));
        bot.push(g.P(x, 14 - (Math.abs(x) / 90) ** 2 * 10 + (Math.abs(x) < 10 ? -6 : 0), z));
      }
      ctx.save();
      ctx.beginPath();
      spline(ctx, top, false);
      spline(ctx, bot.reverse(), false, false);
      ctx.closePath();
      const vg = ctx.createLinearGradient(g.hx - 90, g.ey - 22, g.hx + 90, g.ey + 16);
      vg.addColorStop(0, 'rgba(30,4,8,0.96)');
      vg.addColorStop(0.35, 'rgba(120,6,16,0.96)');
      vg.addColorStop(0.48, 'rgba(255,60,70,0.98)');
      vg.addColorStop(0.56, 'rgba(110,6,14,0.96)');
      vg.addColorStop(0.8, 'rgba(40,4,8,0.96)');
      vg.addColorStop(1, 'rgba(160,10,22,0.96)');
      ctx.fillStyle = vg;
      ctx.fill();
      ctx.clip();
      // scanlines + HUD tick
      ctx.strokeStyle = 'rgba(255,120,120,0.18)';
      ctx.lineWidth = 1;
      for (let y = g.ey - 24; y < g.ey + 18; y += 4) {
        ctx.beginPath();
        ctx.moveTo(g.hx - 120, y);
        ctx.lineTo(g.hx + 120, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,200,200,0.7)';
      ctx.fillRect(g.P(-60, 0)[0], g.ey - 6, 14, 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(220,220,230,0.8)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      spline(ctx, top, false);
      ctx.stroke();
      // headphones resting on the collarbones
      const cx = g.hx - g.sn * 26;
      for (const m of [-1, 1]) {
        const x = cx + m * 70, y = g.ey + 184;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(m * 0.5);
        ctx.fillStyle = 'rgb(26,26,32)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgb(140,142,152)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 31, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgb(255,40,50)';
        ctx.beginPath();
        ctx.arc(m * 10, -16, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  },

  // 04 — The Soldier: buzz cut, tactical collar
  {
    name: 'soldier',
    seed: 53,
    sex: 'm',
    skin: [116, 78, 60],
    hair: [14, 12, 12],
    cloth: [38, 40, 34],
    iris: [40, 26, 20],
    turn: 0.2,
    light: -1,
    outfit: 'tactical',
    jaw: 72,
    chinW: 22,
    browT: 7.5,
    browAngle: 3,
    stubble: 0.12,
    front: (ctx, g, spec, r) => {
      // buzz cut: tight cap, stippled
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const a = Math.PI * (1 + i / 20);
        let y = -40 + Math.sin(a) * 110;
        if (i < 3 || i > 17) y = lerp(y, -10, 0.7);
        pts.push(g.P(Math.cos(a) * 94, y, -6));
      }
      for (const [x, y] of [
        [84, -40],
        [56, -88],
        [0, -98],
        [-56, -88],
        [-84, -40],
      ])
        pts.push(g.P(x, y, g.zs(x, y) + 2));
      ctx.save();
      ctx.beginPath();
      spline(ctx, pts, true);
      ctx.fillStyle = rgba(spec.hair, 0.86);
      ctx.fill();
      ctx.clip();
      for (let i = 0; i < 2600; i++) {
        const x = g.hx - 110 + r() * 220, y = g.ey - 160 + r() * 140;
        ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '90,80,80'},${0.2 + r() * 0.3})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
      const sg = ctx.createRadialGradient(g.hx + spec.light * 30, g.ey - 120, 10, g.hx, g.ey - 90, 110);
      sg.addColorStop(0, 'rgba(160,170,190,0.22)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, 512, 512);
      ctx.restore();
    },
    acc: (ctx, g) => {
      // small scar through the brow
      const a = g.P(30, -44), b = g.P(44, -14);
      ctx.strokeStyle = 'rgba(210,160,150,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    },
  },

  // 05 — The Student: bob hair, uniform collar
  {
    name: 'student',
    cheek: 78,
    jaw: 54,
    chinY: 116,
    seed: 67,
    sex: 'f',
    skin: [234, 198, 180],
    hair: [18, 16, 22],
    cloth: [20, 22, 34],
    iris: [60, 36, 30],
    turn: 0.08,
    light: 1,
    outfit: 'uniform',
    noEars: true,
    eyeH: 13,
    back: (ctx, g, spec, r, H) => {
      const shapes = [
        {
          cap: [
            g.P(-116, -60, -20),
            g.P(-96, -136, -20),
            g.P(-50, -170, -20),
            g.P(0, -178, -20),
            g.P(50, -170, -20),
            g.P(96, -136, -20),
            g.P(116, -60, -20),
            g.P(122, 30, -20),
            g.P(112, 108, -20),
            g.P(60, 124, -40),
            g.P(-60, 124, -40),
            g.P(-112, 108, -20),
            g.P(-122, 30, -20),
          ],
        },
      ];
      H.paintHair(ctx, g, { ...spec, hair: mul(spec.hair, 0.7) }, shapes, r);
    },
    front: (ctx, g, spec, r, H) => {
      const shapes = [{ cap: H.cap(g, { vol: 16, hairline: -60, bottom: 40, temple: -30, hairW: 90 }) }];
      // blunt fringe just above the brows
      for (let i = 0; i < 12; i++) {
        const x = lerp(-84, 84, i / 11);
        const root = g.P(x * 0.8, -128 - (1 - (x / 90) ** 2) * 24, g.zs(x * 0.8, -110) + 16);
        const tip = g.P(x + (r() - 0.5) * 3, -32 + Math.abs(x) * 0.1 + (r() - 0.5) * 4, g.zs(x, -34) + 10);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 42, 0] });
      }
      // side curtains to the jaw, curling in
      for (const m of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const root = g.P(m * (70 + i * 7), -100, 20);
          const tip = g.P(m * (100 - i * 4), 104 + (i % 2) * 6, 10 - i * 4);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 34, -m * 12] });
        }
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
  },

  // 06 — The Gambler: slicked-back hair, open collar, earring glint
  {
    name: 'gambler',
    chinY: 130,
    eyeH: 10,
    seed: 79,
    sex: 'm',
    skin: [198, 148, 118],
    hair: [22, 18, 16],
    cloth: [18, 16, 20],
    iris: [70, 44, 26],
    turn: -0.26,
    light: 1,
    outfit: 'opencollar',
    stubble: 0.22,
    smirk: 2.5,
    browArch: 3,
    front: (ctx, g, spec, r, H) => {
      const shapes = [{ cap: H.cap(g, { vol: 16, hairline: -104, bottom: -18, temple: -56, hairW: 82, front: 14 }) }];
      // one loose strand on the forehead
      const a = g.P(-16, -108, 84), b = g.P(-32, -44, 88);
      shapes.push({ lock: [a[0], a[1], b[0], b[1], 12, 10] });
      // combed-back strokes from the hairline over the skull
      const comb = [];
      for (let i = 0; i < 120; i++) {
        const x = (r() - 0.5) * 170;
        const p0 = g.P(x, -100 - r() * 6, g.zs(x, -100) + 8);
        const p1 = g.P(x * 1.12, -168 - r() * 10, -30);
        const pc = g.P(x * 1.05 + 6, -150, 60);
        comb.push([p0[0], p0[1], pc[0], pc[1], p1[0], p1[1]]);
      }
      H.paintHair(ctx, g, spec, shapes, r, { comb, sheen: 1.6 });
    },
    acc: (ctx, g) => {
      const [x, y] = earLobe(g);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(x, y, 0, x, y, 16);
      gg.addColorStop(0, 'rgba(255,240,220,0.95)');
      gg.addColorStop(0.3, 'rgba(255,200,120,0.4)');
      gg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - 16, y - 16, 32, 32);
      ctx.strokeStyle = 'rgba(255,240,210,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.lineTo(x + 14, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgb(240,210,150)';
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  // 07 — The Climber: beanie
  {
    name: 'climber',
    seed: 83,
    sex: 'f',
    skin: [182, 130, 100],
    hair: [64, 32, 24],
    cloth: [28, 30, 36],
    iris: [70, 46, 28],
    turn: 0.24,
    light: -1,
    outfit: 'puffer',
    noEars: true,
    back: (ctx, g, spec, r, H) => longBack(ctx, g, spec, r, H, { width: 112, bottom: 230 }),
    front: (ctx, g, spec, r, H) => {
      const shapes = [];
      for (const m of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const root = g.P(m * (74 + i * 6), -80, 16);
          const tip = g.P(m * (92 + i * 6) + (r() - 0.5) * 10, 70 + i * 22, -10);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 30, -m * 12] });
        }
      }
      shapes.push(...H.fringe(g, r, { span: 50, len: 44, rootY: -96, w: 30, sweep: 18, mess: 14, n: 6 }));
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g, spec, r) => {
      // beanie dome + ribbed cuff
      const dome = [];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (1 + i / 16);
        dome.push(g.P(Math.cos(a) * 112, -70 + Math.sin(a) * 116, 10));
      }
      const base = [118, 18, 28];
      ctx.save();
      ctx.beginPath();
      spline(ctx, dome, false);
      ctx.closePath();
      ctx.fillStyle = rgba(base);
      ctx.fill();
      ctx.clip();
      const sg = ctx.createLinearGradient(g.hx - spec.light * 100, 0, g.hx + spec.light * 100, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0.12)');
      sg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      for (let i = -6; i <= 6; i++) {
        const p0 = g.P(i * 16, -70, 10), p1 = g.P(i * 4, -186, 0);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(lerp(p0[0], p1[0], 0.5) + i * 4, (p0[1] + p1[1]) / 2, p1[0], p1[1]);
        ctx.stroke();
      }
      ctx.restore();
      // cuff
      const top = [], bot = [];
      for (let i = 0; i <= 12; i++) {
        const x = lerp(-116, 116, i / 12);
        top.push(g.P(x, -112 + Math.abs(x) * 0.12, g.zs(x * 0.9, -100) + 22));
        bot.push(g.P(x, -66 + Math.abs(x) * 0.16, g.zs(x * 0.9, -70) + 22));
      }
      ctx.save();
      ctx.beginPath();
      spline(ctx, top, false);
      spline(ctx, bot.reverse(), false, false);
      ctx.closePath();
      ctx.fillStyle = rgba(mul(base, 1.1));
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 26; i++) {
        const x = lerp(-120, 120, i / 26);
        const a = g.P(x, -120, g.zs(x * 0.9, -100) + 22), b = g.P(x, -60, g.zs(x * 0.9, -70) + 22);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const lg = ctx.createLinearGradient(0, g.ey - 120, 0, g.ey - 60);
      lg.addColorStop(0, 'rgba(255,255,255,0.12)');
      lg.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 512, 512);
      ctx.restore();
      void r;
    },
  },

  // 08 — The Engineer: goggles on forehead
  {
    name: 'engineer',
    seed: 97,
    sex: 'm',
    skin: [172, 122, 92],
    hair: [34, 26, 22],
    cloth: [56, 46, 36],
    iris: [60, 40, 26],
    turn: -0.1,
    light: 1,
    outfit: 'jumpsuit',
    stubble: 0.08,
    front: (ctx, g, spec, r, H) => {
      const shapes = [
        { cap: H.cap(g, { vol: 14, hairline: -96, bottom: -14 }) },
        ...H.fringe(g, r, { span: 70, len: 70, rootY: -120, w: 42, sweep: 26, mess: 22, n: 9, taper: 0.45, bend: 10 }),
      ];
      for (const m of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const root = g.P(m * (80 + i * 5), -96 + i * 10, 6);
          const tip = g.P(m * (100 + i * 4) + (r() - 0.5) * 8, -30 + i * 18, -6);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 30, -m * 10] });
        }
      }
      // tousled crown locks flicking back
      for (let i = 0; i < 5; i++) {
        const x = lerp(-80, 80, i / 4);
        const root = g.P(x * 0.7, -140, 20);
        const tip = g.P(x * 1.3 + (r() - 0.5) * 16, -168 - r() * 6, -30);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 56, (x > 0 ? -1 : 1) * 14] });
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g, spec) => {
      // strap
      const strap = [];
      for (let i = 0; i <= 12; i++) {
        const x = lerp(-104, 104, i / 12);
        strap.push(g.P(x, -100 - Math.abs(x) * 0.05, g.zs(x * 0.9, -100) + 16));
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgb(40,32,28)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      spline(ctx, strap, false);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      spline(ctx, strap.map(([x, y]) => [x, y - 5]), false);
      ctx.stroke();
      // lenses
      for (const m of [-1, 1]) {
        const [x, y] = g.P(m * 36, -104, g.zs(m * 36, -100) + 26);
        const rx = 30 * (1 - Math.abs(g.sn) * 0.4 * (m * g.sn > 0 ? 1 : 0.2));
        ctx.fillStyle = 'rgb(20,18,20)';
        ctx.beginPath();
        ctx.ellipse(x, y, rx + 6, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        const rg = ctx.createLinearGradient(x - rx, y - 26, x + rx, y + 26);
        rg.addColorStop(0, 'rgb(220,222,230)');
        rg.addColorStop(0.5, 'rgb(90,92,100)');
        rg.addColorStop(1, 'rgb(170,172,182)');
        ctx.strokeStyle = rg;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, 25, 0, 0, Math.PI * 2);
        ctx.stroke();
        const lg = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, 24);
        lg.addColorStop(0, 'rgba(255,90,90,0.9)');
        lg.addColorStop(0.4, 'rgba(150,10,20,0.9)');
        lg.addColorStop(1, 'rgba(20,4,6,0.95)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(x, y, rx - 3, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.35, y - 9, 6, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // grease smudge
      const [sx, sy] = g.P(-spec.light * 48, 40);
      softEllipse(ctx, sx, sy, 16, 6, [20, 14, 12], 0.4, 'source-over', -0.3);
    },
  },

  // 09 — The Idol: long hair, choker
  {
    name: 'idol',
    jaw: 50,
    chinW: 7,
    eyeTilt: 2,
    seed: 101,
    sex: 'f',
    skin: [236, 202, 186],
    hair: [20, 14, 20],
    cloth: [16, 14, 18],
    iris: [80, 40, 40],
    turn: -0.15,
    light: -1,
    outfit: 'idol',
    noEars: true,
    eyeH: 13,
    eyeW: 33,
    browArch: 3,
    back: (ctx, g, spec, r, H) => longBack(ctx, g, spec, r, H, { width: 130, bottom: 300 }),
    front: (ctx, g, spec, r, H) => {
      const shapes = [{ cap: H.cap(g, { vol: 12, hairline: -96, bottom: 20, temple: -24, hairW: 84 }) }];
      // centre-part curtains framing the face, falling past the shoulders
      for (const m of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const root = g.P(m * (10 + i * 11), -136 + i * 5, 40);
          const tip = g.P(m * (80 + i * 9) + (r() - 0.5) * 12, 160 + i * 18 + r() * 30, 0);
          shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 42, -m * (46 + i * 2)] });
        }
        // wispy curtain bang
        const a = g.P(m * 10, -122, 70), b = g.P(m * 76, -6, 60);
        shapes.push({ lock: [a[0], a[1], b[0], b[1], 26, -m * 22] });
      }
      H.paintHair(ctx, g, spec, shapes, r, { sheenY: 10 });
    },
    acc: (ctx, g) => {
      const cx = lerp(g.hx, g.hx - g.sn * 26, 0.6);
      const y = g.ey + 154;
      ctx.save();
      ctx.strokeStyle = 'rgb(12,10,12)';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(cx - 40, y - 8);
      ctx.quadraticCurveTo(cx, y + 8, cx + 40, y - 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,200,215,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 38, y - 12);
      ctx.quadraticCurveTo(cx, y + 3, cx + 38, y - 12);
      ctx.stroke();
      // ruby pendant
      ctx.fillStyle = 'rgb(220,20,34)';
      ctx.beginPath();
      ctx.moveTo(cx, y + 6);
      ctx.lineTo(cx + 6, y + 14);
      ctx.lineTo(cx, y + 24);
      ctx.lineTo(cx - 6, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(cx, y + 14, 0, cx, y + 14, 16);
      gg.addColorStop(0, 'rgba(255,60,70,0.6)');
      gg.addColorStop(1, 'rgba(255,60,70,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(cx - 16, y - 2, 32, 32);
      ctx.restore();
    },
  },

  // 10 — The Detective: hat brim, trench-coat collar
  {
    name: 'detective',
    chinY: 132,
    jaw: 64,
    eyeH: 10,
    seed: 113,
    sex: 'm',
    skin: [190, 148, 124],
    hair: [52, 46, 44],
    cloth: [70, 58, 44],
    iris: [50, 40, 34],
    turn: 0.18,
    light: 1,
    outfit: 'trench',
    stubble: 0.26,
    browT: 7,
    browAngle: 3,
    front: (ctx, g, spec, r, H) => {
      const shapes = [{ cap: H.cap(g, { vol: 6, hairline: -96, bottom: 0, temple: -40 }) }];
      for (const m of [-1, 1]) {
        const a = g.P(m * 88, -70, 0), b = g.P(m * 92, -6, -4);
        shapes.push({ lock: [a[0], a[1], b[0], b[1], 22, -m * 4] });
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
    acc: (ctx, g, spec) => {
      const cx = g.hx + g.sn * 10;
      const by = g.ey - 96;
      // brim shadow over the upper face
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.filter = 'blur(10px)';
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.beginPath();
      ctx.ellipse(cx + spec.light * 8, by + 60, 128, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // crown
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - 98, by + 4);
      ctx.bezierCurveTo(cx - 104, by - 60, cx - 84, by - 104, cx - 36, by - 106);
      ctx.quadraticCurveTo(cx, by - 92, cx + 36, by - 106);
      ctx.bezierCurveTo(cx + 84, by - 104, cx + 104, by - 60, cx + 98, by + 4);
      ctx.closePath();
      const cg = ctx.createLinearGradient(cx - spec.light * 100, 0, cx + spec.light * 100, 0);
      cg.addColorStop(0, 'rgb(58,54,56)');
      cg.addColorStop(1, 'rgb(16,14,16)');
      ctx.fillStyle = cg;
      ctx.fill();
      // pinch crease
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, by - 92);
      ctx.quadraticCurveTo(cx + 4, by - 60, cx, by - 30);
      ctx.stroke();
      // band
      ctx.fillStyle = 'rgb(110,10,18)';
      ctx.beginPath();
      ctx.moveTo(cx - 99, by - 22);
      ctx.quadraticCurveTo(cx, by - 12, cx + 99, by - 22);
      ctx.lineTo(cx + 98, by + 2);
      ctx.quadraticCurveTo(cx, by + 12, cx - 98, by + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // brim
      ctx.save();
      ctx.translate(cx, by + 6);
      ctx.rotate(-g.sn * 0.25);
      const bg = ctx.createLinearGradient(0, -20, 0, 26);
      bg.addColorStop(0, 'rgb(60,56,58)');
      bg.addColorStop(0.5, 'rgb(26,24,26)');
      bg.addColorStop(1, 'rgb(8,8,10)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 168, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, -6, 104, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // eyes glint through the shadow
      for (const m of [-1, 1]) {
        const [ex, ey] = g.P(m * 31, -2, g.zs(m * 31, 0) - 2);
        ctx.fillStyle = 'rgba(255,70,70,0.55)';
        ctx.beginPath();
        ctx.arc(ex + spec.light * 2, ey - 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  // 11 — The Stray: long hair partly hiding the face
  {
    name: 'stray',
    cheek: 76,
    jaw: 56,
    chinY: 128,
    seed: 127,
    sex: 'm',
    skin: [206, 170, 150],
    hair: [28, 25, 30],
    cloth: [26, 22, 24],
    iris: [60, 50, 50],
    turn: -0.2,
    light: 1,
    outfit: 'leather',
    noEars: true,
    hideEye: -1,
    back: (ctx, g, spec, r, H) => longBack(ctx, g, spec, r, H, { width: 118, bottom: 200 }),
    front: (ctx, g, spec, r, H) => {
      const shapes = [
        { cap: H.cap(g, { vol: 16, hairline: -100, bottom: 10, temple: -40 }) },
        ...H.crownSpikes(g, r, { a0: -Math.PI * 1.1, a1: -Math.PI * 0.4, n: 7, len: 26, w: 46, swirl: -0.3 }),
      ];
      // heavy locks falling across one side of the face
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const root = g.P(lerp(30, -60, t), -130 + t * 10, 60);
        const tip = g.P(lerp(-6, -96, t) + (r() - 0.5) * 16, lerp(46, 140, t) + r() * 20, 50);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 40 + r() * 10, -10 + (r() - 0.5) * 20] });
      }
      for (let i = 0; i < 5; i++) {
        const root = g.P(lerp(40, 90, i / 4), -116 + i * 10, 30);
        const tip = g.P(lerp(64, 104, i / 4) + (r() - 0.5) * 8, lerp(10, 110, i / 4), 0);
        shapes.push({ lock: [root[0], root[1], tip[0], tip[1], 30, 10] });
      }
      H.paintHair(ctx, g, spec, shapes, r);
    },
  },
];

export { mixc };

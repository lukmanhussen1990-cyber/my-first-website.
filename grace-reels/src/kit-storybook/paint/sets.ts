// Painted background sets, split into depth layers. Each painter draws in
// world px (1080 x 1920 frame, may draw beyond the edges for camera moves).
import { canopy, fillRect, glow, haze, leaf, leafFan, linear, meadow, radial, ridge, rgba, trunk, grain, mixHex, tallGrass } from './brush';
import { mulberry32, fbm2 } from '../core/random';
import type { Painter } from './Baked';
import type { SkyLook } from '../gl/Sky';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- EDEN
export type EdenPalette = {
  sky: SkyLook;
  hillFar: string; hillNear: string; hazeC: string;
  treeDark: string; treeMid: string; treeLight: string; rim: string;
  river: [string, string]; ground: [string, string]; grassD: string; grassL: string; flower: string;
  leafDark: string; leafLight: string; leafRim: string; fruitGlow: string; trunkC: string;
};
export const EDEN_DUSK: EdenPalette = {
  sky: { top: '#2a1b40', mid: '#8a4d6c', horizon: '#f4b26a', horizonY: 0.56, glow: '#ffcf8a', glowPos: [0.66, 0.5], glowSize: 0.2, glowStrength: 0.7, clouds: 0.75, cloudDark: '#6b4060', cloudLit: '#ffc49a', cloudY: [0.12, 0.47], stars: 0.15, drift: 0.012 },
  hillFar: '#9a6a84', hillNear: '#6d4766', hazeC: '#f2b08a',
  treeDark: '#2e2232', treeMid: '#4d3a46', treeLight: '#a8786a', rim: '#ffbf7a',
  river: ['#f6c58a', '#7d5a74'], ground: ['#5a4146', '#22181f'], grassD: '#2f2328', grassL: '#8e6a52', flower: '#ffe6c2',
  leafDark: '#1d1820', leafLight: '#46523a', leafRim: '#ffb86e', fruitGlow: '255,200,120', trunkC: '#2c1f24',
};
export const EDEN_EVENING: EdenPalette = {
  sky: { top: '#070b1c', mid: '#18244a', horizon: '#3d5a86', horizonY: 0.56, glow: '#6e8fc8', glowPos: [0.3, 0.42], glowSize: 0.25, glowStrength: 0.25, clouds: 0.5, cloudDark: '#141d3a', cloudLit: '#4f6a9a', cloudY: [0.12, 0.45], stars: 0.6, drift: 0.01, moon: { pos: [0.24, 0.2], r: 0.032, color: '#dfe6f5' } },
  hillFar: '#2c3b5e', hillNear: '#1f2b47', hazeC: '#4b6390',
  treeDark: '#0d1324', treeMid: '#18213a', treeLight: '#3b5078', rim: '#8fb0e6',
  river: ['#9db8e0', '#24314f'], ground: ['#1a2236', '#0b0f1a'], grassD: '#0f1524', grassL: '#33476b', flower: '#cfdcf5',
  leafDark: '#0a0e18', leafLight: '#1f3040', leafRim: '#86a6dc', fruitGlow: '200,215,255', trunkC: '#0e1220',
};

export function edenFar(p: EdenPalette): Painter {
  return (ctx, W) => {
    ridge(ctx, { y: 1015, amp: 70, freq: 0.0032, seed: 4, x0: -400, x1: W + 400, bottom: 1500, fill: linear(ctx, 0, 940, 0, 1200, [[0, p.hillFar], [1, mixHex(p.hillFar, p.hazeC, 0.35)]]), soft: 2 });
    haze(ctx, 960, 1120, W, rgba(p.hazeC, 1), 0.35);
    ridge(ctx, { y: 1070, amp: 50, freq: 0.0045, seed: 9, x0: -400, x1: W + 400, bottom: 1500, fill: p.hillNear, soft: 1.5 });
    const r = mulberry32(12);
    for (let i = 0; i < 16; i++) {
      const x = -300 + i * 110 + r() * 60;
      canopy(ctx, x, 1060 - r() * 30, 36 + r() * 30, { dark: p.treeDark, mid: p.treeMid, light: p.treeLight, seed: 30 + i, blobs: 6, flat: 0.8 });
    }
    haze(ctx, 1030, 1130, W, rgba(p.hazeC, 1), 0.25);
  };
}

export function edenMid(p: EdenPalette): Painter {
  return (ctx, W, H) => {
    // ground plane behind the river
    fillRect(ctx, -400, 1080, W + 800, H - 1080 + 400, linear(ctx, 0, 1080, 0, 1600, [[0, mixHex(p.ground[0], p.hazeC, 0.25)], [1, p.ground[0]]]));
    // river winding from the horizon toward the lower left
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(560, 1082);
    ctx.bezierCurveTo(600, 1160, 360, 1230, 300, 1340);
    ctx.bezierCurveTo(240, 1450, -60, 1520, -400, 1640);
    ctx.lineTo(-400, 1900);
    ctx.bezierCurveTo(60, 1680, 520, 1560, 560, 1380);
    ctx.bezierCurveTo(590, 1260, 660, 1160, 600, 1082);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 1080, 0, 1800, [[0, p.river[0]], [0.5, mixHex(p.river[0], p.river[1], 0.45)], [1, p.river[1]]]);
    ctx.fill();
    ctx.clip();
    const r = mulberry32(5);
    for (let i = 0; i < 140; i++) {
      const y = 1090 + r() * 700;
      const x = -300 + r() * 1000;
      ctx.fillStyle = rgba('#ffffff', 0.12 + r() * 0.25);
      ctx.fillRect(x, y, 8 + r() * 40, 1.5);
    }
    ctx.restore();
    // two framing trees
    trunk(ctx, 150, 1180, 300, 26, { color: p.trunkC, light: p.rim, seed: 2, lean: -0.05 });
    canopy(ctx, 140, 860, 250, { dark: p.treeDark, mid: p.treeMid, light: p.treeLight, rim: p.rim, seed: 21, blobs: 16, leafSize: 8 });
    trunk(ctx, 1020, 1170, 280, 24, { color: p.trunkC, light: p.rim, seed: 3, lean: 0.04 });
    canopy(ctx, 1010, 870, 230, { dark: p.treeDark, mid: p.treeMid, light: p.treeLight, rim: p.rim, seed: 22, blobs: 15, leafSize: 8 });
    haze(ctx, 1040, 1200, W, rgba(p.hazeC, 1), 0.18);
    grain(ctx, ctx.canvas.width, ctx.canvas.height, 3, 0.03);
  };
}

// the glowing fruit tree, framing the right side (its branch hangs where the fruit is)
export function edenFruitTree(p: EdenPalette, branchTip: [number, number] = [930, 560]): Painter {
  return (ctx) => {
    trunk(ctx, 1140, 1900, 1250, 70, { color: p.trunkC, light: p.rim, seed: 7, lean: -0.08, branches: 0, twist: 0.2 });
    ctx.save();
    ctx.strokeStyle = p.trunkC;
    ctx.lineCap = 'round';
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(1110, 760);
    ctx.quadraticCurveTo(1010, 560, branchTip[0] + 30, branchTip[1] - 60);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(branchTip[0] + 40, branchTip[1] - 70);
    ctx.quadraticCurveTo(branchTip[0] + 10, branchTip[1] - 50, branchTip[0], branchTip[1] - 18);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.rim, 0.45);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(1100, 744);
    ctx.quadraticCurveTo(1000, 548, branchTip[0] + 30, branchTip[1] - 76);
    ctx.stroke();
    ctx.restore();
    canopy(ctx, 1100, 380, 380, { dark: p.treeDark, mid: p.treeMid, light: p.treeLight, rim: p.rim, seed: 41, blobs: 22, lightDir: [-0.5, 0.2], leafSize: 11 });
    leafFan(ctx, branchTip[0] + 30, branchTip[1] - 70, 5, 120, 2.2, 3.6, { dark: p.leafDark, light: p.leafLight, rim: p.leafRim, vein: rgba(p.leafRim, 0.25), seed: 8 });
    const r = mulberry32(19);
    for (let i = 0; i < 9; i++) {
      const x = 900 + r() * 360;
      const y = 200 + r() * 360;
      glow(ctx, x, y, 34, `rgba(${p.fruitGlow},0.5)`, 0.8);
      ctx.fillStyle = `rgba(${p.fruitGlow},0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

export function edenGround(p: EdenPalette): Painter {
  return (ctx, W, H) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-400, 1420);
    for (let x = -400; x <= W + 400; x += 20) ctx.lineTo(x, 1400 + (fbm2(x * 0.004, 1, 6) - 0.5) * 70);
    ctx.lineTo(W + 400, H + 400);
    ctx.lineTo(-400, H + 400);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 1380, 0, H, [[0, p.ground[0]], [1, p.ground[1]]]);
    ctx.fill();
    ctx.restore();
    meadow(ctx, -300, W + 300, 1420, H + 250, { dark: p.grassD, light: p.grassL, flower: p.flower, seed: 12, density: 1.1 });
    glow(ctx, 700, 1450, 500, rgba(p.rim, 0.12), 1);
  };
}

// big foreground leaves in the corners (painted, then baked soft)
export function edenForeground(p: EdenPalette, variant = 0): Painter {
  return (ctx, W, H) => {
    const o = { dark: p.leafDark, light: p.leafLight, rim: p.leafRim, vein: rgba(p.leafRim, 0.18), seed: 3 + variant };
    leafFan(ctx, -120, H + 120, 6, 640, -1.45, -0.35, o);
    leafFan(ctx, W + 140, H + 60, 5, 560, -2.75, -1.9, { ...o, seed: 9 + variant });
    if (variant === 1) leafFan(ctx, W + 100, -120, 4, 520, 1.9, 2.8, { ...o, seed: 15 });
  };
}

// foreground grass + flowers that rises to yTop (keeps legs out of wide shots)
export function edenGrass(p: EdenPalette, yTop: number): Painter {
  return (ctx, W, H) => tallGrass(ctx, -400, W + 400, yTop, H + 400, { dark: p.leafDark, mid: p.leafLight, rim: p.leafRim, flower: rgba(p.flower, 0.95), seed: 61 });
}

// huge leaves Adam and Eve hide behind (fills the lower half)
export function edenHideLeaves(p: EdenPalette): Painter {
  return (ctx, W, H) => {
    const o = { dark: mixHex(p.leafDark, p.leafLight, 0.35), light: mixHex(p.leafLight, '#5f8f7c', 0.55), rim: p.leafRim, vein: rgba(p.leafRim, 0.12) };
    leaf(ctx, -120, H - 240, 860, 250, -0.62, { ...o, curl: 0.15 });
    leaf(ctx, W + 140, H - 160, 900, 260, Math.PI + 0.58, { ...o, curl: -0.12 });
    leaf(ctx, 300, H + 200, 980, 290, -1.25, { ...o, curl: 0.08 });
    leaf(ctx, 120, H + 320, 1020, 270, -0.98, { ...o, curl: -0.1 });
    leaf(ctx, 900, H + 280, 960, 260, -2.0, { ...o, curl: 0.12 });
    leaf(ctx, 620, H + 360, 1000, 280, -1.62, { ...o, curl: -0.08 });
    leafFan(ctx, 540, H + 420, 4, 700, -2.3, -0.8, { ...o, seed: 33 });
  };
}

// ---------------------------------------------------------------- BEDROOM
export type RoomTime = 'night' | 'dawn';
export const ROOM_WINDOW = { x0: 600, x1: 1020, y0: 380, y1: 1140 };

export function roomCity(time: RoomTime): Painter {
  return (ctx) => {
    const { x0, x1, y0, y1 } = ROOM_WINDOW;
    const sky = time === 'night'
      ? linear(ctx, 0, y0 - 200, 0, y1, [[0, '#090c1e'], [0.6, '#1c2347'], [1, '#3a3d68']])
      : linear(ctx, 0, y0 - 200, 0, y1, [[0, '#3a3f74'], [0.45, '#c98a8a'], [0.8, '#ffc58c'], [1, '#ffe4b0']]);
    fillRect(ctx, x0 - 300, y0 - 300, x1 - x0 + 700, y1 - y0 + 500, sky);
    if (time === 'dawn') glow(ctx, 860, 1040, 420, 'rgba(255,214,150,0.9)', 0.9);
    const r = mulberry32(time === 'night' ? 4 : 5);
    for (let layer = 0; layer < 2; layer++) {
      let x = x0 - 260;
      while (x < x1 + 260) {
        const w = 50 + r() * 90;
        const h = (layer ? 120 : 220) + r() * (layer ? 200 : 300);
        const base = y1 + 40;
        const col = time === 'night' ? (layer ? '#0b0f1e' : '#141a32') : (layer ? '#3c3150' : '#5c4a68');
        ctx.fillStyle = col;
        ctx.fillRect(x, base - h, w, h + 100);
        for (let wy = base - h + 12; wy < base; wy += 18)
          for (let wx = x + 8; wx < x + w - 8; wx += 14)
            if (r() < (time === 'night' ? 0.32 : 0.08)) {
              ctx.fillStyle = time === 'night' ? `rgba(255,${200 + r() * 40},${120 + r() * 60},${0.55 + r() * 0.45})` : 'rgba(255,226,170,0.6)';
              ctx.fillRect(wx, wy, 6, 8);
            }
        x += w + 6 + r() * 20;
      }
    }
  };
}

export function roomWall(time: RoomTime): Painter {
  return (ctx, W, H) => {
    const { x0, x1, y0, y1 } = ROOM_WINDOW;
    const night = time === 'night';
    ctx.save();
    ctx.beginPath();
    ctx.rect(-400, -400, W + 800, H + 800);
    ctx.rect(x1, y0, x0 - x1, y1 - y0); // window hole (reverse winding)
    ctx.fillStyle = night
      ? linear(ctx, 0, 0, W, 0, [[0, '#0d1120'], [0.55, '#161c33'], [1, '#1d2440']])
      : linear(ctx, 0, 0, W, 0, [[0, '#2a2433'], [0.55, '#4a3a48'], [1, '#6a5058']]);
    ctx.fill('evenodd');
    ctx.restore();
    // window frame + mullions + sill
    ctx.strokeStyle = night ? '#0a0d18' : '#2a2030';
    ctx.lineWidth = 22;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo((x0 + x1) / 2, y0);
    ctx.lineTo((x0 + x1) / 2, y1);
    ctx.moveTo(x0, (y0 + y1) / 2);
    ctx.lineTo(x1, (y0 + y1) / 2);
    ctx.stroke();
    fillRect(ctx, x0 - 40, y1 + 6, x1 - x0 + 80, 26, night ? '#0c1020' : '#3a2c36');
    // curtain on the right
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const x = x1 + 10 + i * 26;
      ctx.fillStyle = linear(ctx, x, 0, x + 26, 0, night ? [[0, '#121733'], [0.5, '#1d2550'], [1, '#0e1229']] : [[0, '#4a3550'], [0.5, '#7a5468'], [1, '#3c2a40']]);
      ctx.fillRect(x, y0 - 120, 27, y1 - y0 + 520);
    }
    ctx.restore();
    // poster frame + shelf on the left wall
    ctx.strokeStyle = night ? '#232a48' : '#5c4858';
    ctx.lineWidth = 6;
    ctx.strokeRect(110, 520, 250, 330);
    fillRect(ctx, 116, 526, 238, 318, night ? '#151b33' : '#4a3a4c');
    fillRect(ctx, 60, 1010, 330, 14, night ? '#0e1324' : '#33283a');
    // floor
    fillRect(ctx, -400, 1560, W + 800, 800, night ? linear(ctx, 0, 1560, 0, 1920, [[0, '#0e1222'], [1, '#070910']]) : linear(ctx, 0, 1560, 0, 1920, [[0, '#3a2e3a'], [1, '#1e1820']]));
    if (!night) glow(ctx, 760, 1660, 520, 'rgba(255,200,150,0.35)', 1);
    grain(ctx, ctx.canvas.width, ctx.canvas.height, 8, 0.025);
  };
}

export function roomBed(time: RoomTime): Painter {
  // bed along the right wall, under the window; its near edge faces the left of the room
  return (ctx) => {
    const night = time === 'night';
    const top = 1330;
    const x0 = 300;
    ctx.fillStyle = night ? '#0a0e1c' : '#2a2030';
    ctx.fillRect(x0 + 10, top + 60, 1400, 700);
    ctx.fillStyle = linear(ctx, 0, top, 0, top + 320, night ? [[0, '#2a3358'], [1, '#121830']] : [[0, '#8a6d82'], [1, '#463646']]);
    ctx.beginPath();
    ctx.moveTo(x0 + 30, top + 10);
    ctx.quadraticCurveTo(x0, top + 20, x0, top + 120);
    ctx.lineTo(x0 + 10, top + 430);
    ctx.lineTo(1500, top + 430);
    ctx.lineTo(1500, top - 10);
    ctx.quadraticCurveTo(900, top - 40, x0 + 30, top + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = night ? 'rgba(130,150,220,0.22)' : 'rgba(255,220,190,0.32)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + 120 + i * 170, top + 20);
      ctx.quadraticCurveTo(x0 + 180 + i * 175, top + 170, x0 + 100 + i * 185, top + 420);
      ctx.stroke();
    }
    ctx.fillStyle = night ? '#38426e' : '#b59aa6';
    ctx.beginPath();
    ctx.ellipse(1180, top - 40, 230, 66, 0.04, 0, Math.PI * 2);
    ctx.fill();
  };
}

// ---------------------------------------------------------------- GETHSEMANE
export const GETH_SKY: SkyLook = { top: '#03050c', mid: '#0b1430', horizon: '#20335a', horizonY: 0.55, glow: '#7d93c8', glowPos: [0.72, 0.17], glowSize: 0.22, glowStrength: 0.35, clouds: 0.35, cloudDark: '#0a1124', cloudLit: '#3a4f7c', cloudY: [0.08, 0.42], stars: 0.9, drift: 0.006, moon: { pos: [0.72, 0.17], r: 0.042, color: '#e9eefa' } };

export const gethFar: Painter = (ctx, W) => {
  ridge(ctx, { y: 1010, amp: 50, freq: 0.003, seed: 14, x0: -400, x1: W + 400, bottom: 1500, fill: linear(ctx, 0, 940, 0, 1200, [[0, '#132040'], [1, '#0c1428']]), soft: 1.5 });
  // city walls of Jerusalem on the far hill (towers, crenellations, a few lit windows)
  const r = mulberry32(31);
  ctx.fillStyle = '#18264a';
  let x = -120;
  while (x < W + 200) {
    const tower = r() < 0.25;
    const w = tower ? 46 : 80 + r() * 60;
    const h = tower ? 120 + r() * 40 : 70;
    ctx.fillRect(x, 1000 - h, w, h + 40);
    for (let cx = x; cx < x + w - 6; cx += 14) ctx.fillRect(cx, 1000 - h - 10, 8, 10);
    if (r() < 0.4) {
      glow(ctx, x + w / 2, 1000 - h * 0.5, 18, 'rgba(255,170,90,0.6)', 0.8);
      ctx.fillStyle = 'rgba(255,190,110,0.9)';
      ctx.fillRect(x + w / 2 - 2, 1000 - h * 0.55, 4, 7);
      ctx.fillStyle = '#18264a';
    }
    x += w;
  }
  ctx.fillStyle = 'rgba(160,185,235,0.18)';
  ctx.fillRect(-120, 928, W + 320, 3);
  haze(ctx, 980, 1100, W, 'rgba(60,84,140,1)', 0.35);
  ridge(ctx, { y: 1100, amp: 40, freq: 0.004, seed: 18, x0: -400, x1: W + 400, bottom: 1500, fill: '#0b1226', soft: 1 });
};

function oliveTree(ctx: Ctx, x: number, base: number, h: number, seed: number, flip = 1) {
  const r = mulberry32(seed);
  // gnarled trunk: several twisting strands
  for (let s = 0; s < 4; s++) {
    ctx.strokeStyle = s % 2 ? '#2a2a30' : '#3b3a40';
    ctx.lineWidth = 34 - s * 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + (s - 1.5) * 18, base);
    ctx.bezierCurveTo(x + flip * (110 + r() * 60), base - h * 0.3, x - flip * (120 + r() * 60), base - h * 0.62, x + flip * (r() * 90 - 10), base - h);
    ctx.stroke();
  }
  // two gnarled limbs
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = '#2f2f36';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x, base - h * 0.8);
    ctx.quadraticCurveTo(x + dir * 90, base - h * 0.95, x + dir * (170 + r() * 60), base - h * 1.05);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(170,190,230,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 30, base);
  ctx.bezierCurveTo(x + flip * 70, base - h * 0.3, x - flip * 20, base - h * 0.6, x + flip * 30, base - h);
  ctx.stroke();
  // silvery canopy clusters
  for (let k = 0; k < 6; k++) {
    canopy(ctx, x + (k / 5 - 0.5) * 420 + (r() - 0.5) * 60, base - h - 50 + (r() - 0.5) * 90, 100 + r() * 50, { dark: '#10161d', mid: '#26333a', light: '#6d8288', rim: '#a9bad8', seed: seed * 7 + k, blobs: 10, lightDir: [0.6, -0.7], leafSize: 5, flat: 0.55 });
  }
}

export const gethMid: Painter = (ctx, W, H) => {
  fillRect(ctx, -400, 1130, W + 800, H, linear(ctx, 0, 1130, 0, 1700, [[0, '#121a2e'], [1, '#0a0e1a']]));
  oliveTree(ctx, 110, 1300, 420, 3, 1);
  oliveTree(ctx, 960, 1260, 380, 7, -1);
  oliveTree(ctx, 600, 1180, 260, 11, 1);
  const r = mulberry32(44);
  for (let i = 0; i < 14; i++) {
    const x = -200 + r() * (W + 400);
    const y = 1260 + r() * 300;
    const w = 40 + r() * 110;
    ctx.fillStyle = radial(ctx, x - w * 0.2, y - w * 0.3, w, [[0, '#3a4560'], [1, '#121827']]);
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  haze(ctx, 1150, 1300, W, 'rgba(70,95,150,1)', 0.15);
  grain(ctx, ctx.canvas.width, ctx.canvas.height, 21, 0.03);
};

export const gethNear: Painter = (ctx, W, H) => {
  ctx.fillStyle = linear(ctx, 0, 1420, 0, H, [[0, '#151c2e'], [1, '#080b14']]);
  ctx.beginPath();
  ctx.moveTo(-400, 1460);
  for (let x = -400; x <= W + 400; x += 20) ctx.lineTo(x, 1440 + (fbm2(x * 0.005, 3, 2) - 0.5) * 60);
  ctx.lineTo(W + 400, H + 400);
  ctx.lineTo(-400, H + 400);
  ctx.fill();
  // moonlit patch of ground where he prays, and a boulder beside him
  glow(ctx, 560, 1660, 420, 'rgba(120,145,210,0.22)', 1);
  ctx.fillStyle = radial(ctx, 170, 1500, 300, [[0, '#4d5a78'], [0.55, '#252e46'], [1, '#121827']]);
  ctx.beginPath();
  ctx.moveTo(-60, 1720);
  ctx.bezierCurveTo(-40, 1520, 60, 1430, 190, 1420);
  ctx.bezierCurveTo(310, 1410, 380, 1500, 390, 1600);
  ctx.bezierCurveTo(400, 1690, 360, 1730, 300, 1740);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,205,240,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, 1500);
  ctx.bezierCurveTo(90, 1440, 160, 1422, 230, 1424);
  ctx.stroke();
  meadow(ctx, -300, W + 300, 1480, H + 200, { dark: '#0c111e', light: '#2c3a58', seed: 7, density: 0.6 });
};

export const gethForeground: Painter = (ctx, W, H) => {
  const o = { dark: '#06080e', light: '#1d2636', rim: '#8ea6d6', vein: 'rgba(140,160,210,0.15)' };
  ctx.strokeStyle = '#07090f';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-200, 120);
  ctx.quadraticCurveTo(160, 220, 420, 160);
  ctx.stroke();
  for (let i = 0; i < 12; i++) leaf(ctx, -100 + i * 44, 150 + Math.sin(i) * 30, 120, 22, 0.6 + Math.sin(i * 1.7) * 0.6, { ...o, curl: 0.2 });
  ctx.fillStyle = radial(ctx, W - 40, H - 40, 420, [[0, '#1a2234'], [1, '#05070c']]);
  ctx.beginPath();
  ctx.ellipse(W + 20, H + 40, 420, 260, -0.3, 0, Math.PI * 2);
  ctx.fill();
};

// ---------------------------------------------------------------- VOID
export const voidSky: SkyLook = { top: '#07050b', mid: '#0d0912', horizon: '#120c16', horizonY: 0.8, glow: '#3a2a20', glowPos: [0.5, 0.45], glowSize: 0.5, glowStrength: 0.25, clouds: 0, stars: 0.35, drift: 0 };

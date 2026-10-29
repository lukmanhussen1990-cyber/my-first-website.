import { CanvasTexture, SRGBColorSpace } from 'three';

type Stroke = [number, number][];

/** Geometric, extended letterforms for the NYXEN wordmark (unit box, y down). */
const GLYPHS: Record<string, Stroke[]> = {
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  Y: [
    [[0, 0], [0.5, 0.52], [1, 0]],
    [[0.5, 0.52], [0.5, 1]],
  ],
  X: [
    [[0, 0], [1, 1]],
    [[1, 0], [0, 1]],
  ],
  E: [
    [[1, 0], [0, 0], [0, 1], [1, 1]],
    [[0, 0.5], [0.8, 0.5]],
  ],
};

function drawWordmark(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, w: number, gap: number, line: number) {
  ctx.lineWidth = line;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 10;
  ctx.lineCap = 'butt';
  let cursor = x;
  const inset = line / 2;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (const stroke of glyph) {
        ctx.beginPath();
        stroke.forEach(([gx, gy], i) => {
          const px = cursor + inset + gx * (w - line);
          const py = y + inset + gy * (h - line);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    }
    cursor += w + gap;
  }
  return cursor - gap;
}

function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return cursor - spacing;
}

function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

/**
 * Laser-etched marking for the body. Canvas X runs along the torch axis
 * (head → tail), canvas Y runs around the tube.
 */
export function createEngravingTexture(): CanvasTexture {
  const W = 1024;
  const H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';

  const glyphH = 132;
  const glyphW = 118;
  const gap = 44;
  const total = 5 * glyphW + 4 * gap;
  const left = (W - total) / 2;
  drawWordmark(ctx, 'NYXEN', left, 58, glyphH, glyphW, gap, 17);

  // Hairline rule + specification line.
  ctx.globalAlpha = 0.9;
  ctx.fillRect(left, 236, total, 3);
  ctx.globalAlpha = 1;
  ctx.font = '600 38px "Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const spec = 'TX-1   ·   1800 LM   ·   IPX8';
  const specW = measureSpaced(ctx, spec, 7);
  spacedText(ctx, spec, left + (total - specW) / 2, 306, 7);
  ctx.font = '500 26px "Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif';
  const serial = 'SN 7Q2-0418-TX';
  const serialW = measureSpaced(ctx, serial, 6);
  ctx.globalAlpha = 0.75;
  spacedText(ctx, serial, left + (total - serialW) / 2, 352, 6);
  ctx.globalAlpha = 1;

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** IEC 60417-5009 style standby/power symbol for the switch cap. */
export function createPowerIconTexture(): CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  const c = S / 2;
  ctx.beginPath();
  ctx.arc(c, c + 8, 62, -Math.PI / 2 + 0.62, -Math.PI / 2 - 0.62 + Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, c - 70);
  ctx.lineTo(c, c + 4);
  ctx.stroke();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

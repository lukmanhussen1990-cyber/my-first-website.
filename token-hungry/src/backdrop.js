// Paper background (world-locked) and the finishing pass (vignette + grain).
import { makePaperTile, makeGrainFrames, makeVignette } from './style.js';

let paperTile = null;
let grain = null;
let vignette = null;

export function initBackdrop() {
  paperTile = makePaperTile();
  grain = makeGrainFrames(4);
  vignette = makeVignette();
}

export function drawPaper(ctx, cam) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = ctx.createPattern(paperTile, 'repeat');
  pat.setTransform(new DOMMatrix([cam.zoom, 0, 0, cam.zoom, 960 - cam.x * cam.zoom, 540 - cam.y * cam.zoom]));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.restore();
}

export function drawFinish(ctx, t, grainAmt = 1) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(vignette, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.13 * grainAmt;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(grain[Math.floor(t * 12) % grain.length], 0, 0, 1920, 1080);
  ctx.restore();
}

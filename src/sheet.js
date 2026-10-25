import { drawFigure, idle, walk, kneel, sit, lookUp, HEAD_IN_HANDS, solveArms, UW, UH } from './chars.js';
import { MODERN, DOUBTER, MOSES, THOMAS, JESUS, DISCIPLES, israelites } from './cast.js';
import { POSES } from './poses.js';

// Character sheet: the whole cast in their default pose, then an acting strip.
export function drawSheet(canvas) {
  const g = canvas.getContext('2d');
  canvas.style.display = 'block';
  canvas.style.position = 'absolute'; canvas.style.left = '0'; canvas.style.top = '0';
  g.fillStyle = '#efe6d4'; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#2b1d14'; g.font = '700 30px Cinzel'; g.fillText('GRACE IN MOTION · THE SKY — CHARACTER SHEET', 40, 62);
  g.font = 'italic 500 24px "Cormorant Garamond"';
  g.fillText('flat 2D figures · #2b1d14 outline · dot eyes + brows · part-based rig (head, hair, torso, upper/lower arms, legs, feet)', 40, 96);

  const cell = (spec, pose, x, y, w, h, label) => {
    const c = document.createElement('canvas');
    c.height = h - 34; c.width = Math.round((c.height * UW) / UH);
    const ctx = c.getContext('2d');
    drawFigure(ctx, spec, pose, c.height / UH, { detail: true, minOutlinePx: 2.2 });
    g.save();
    g.fillStyle = 'rgba(43,29,20,0.12)'; g.beginPath(); g.ellipse(x + w / 2, y + h - 40, w * 0.28, 7, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(c, x + (w - c.width) / 2, y);
    g.fillStyle = '#4a3a2c'; g.font = '700 13px Inter'; g.textAlign = 'center';
    g.fillText(label.toUpperCase(), x + w / 2, y + h - 10);
    g.restore();
  };
  const cast = [...MODERN, DOUBTER, MOSES, THOMAS, JESUS, ...DISCIPLES, ...israelites(8, 7)];
  const cols = 7, w = 1000 / cols, h = 250;
  cast.forEach((spec, i) => {
    const x = 40 + (i % cols) * w, y = 120 + Math.floor(i / cols) * h;
    let p = idle(0.4 + i, i * 13, { dir: i % 2 ? -1 : 1 });
    if (spec.props?.phone) p = POSES.phoneUp(1.2, i * 13, { dir: p.dir });
    if (spec.name === 'Jesus') p = POSES.showHands(1, 3, {});
    if (spec.name === 'Thomas') p = POSES.crossArms(0.5, 5, {});
    if (spec.name === 'Moses') p = POSES.staffRaise(0.5, 5, {});
    cell(spec, p, x, y, w, h, spec.name);
  });
  // acting strip
  const y0 = 120 + Math.ceil(cast.length / cols) * h + 20;
  g.fillStyle = '#2b1d14'; g.font = '700 20px Inter'; g.textAlign = 'left'; g.fillText('ACTING', 40, y0);
  const acts = [
    ['walk', walk(0.2, 1)], ['look up (awe)', lookUp(0, 2, { brow: 'awe', mouth: 'o' })], ['kneel (fear)', POSES.kneelFear(0, 3, {})],
    ['fall back', POSES.cower(0, 4, {})], ['point', POSES.point(0, 5, {})], ['reach', POSES.reach(0, 6, {})], ['cross arms', POSES.crossArms(0, 7, {})],
    ['dance', POSES.dance(0.3, 8, {})], ['head in hands', POSES.headInHands(0, 9, {})], ['look up (hope)', POSES.liftHead(1, 9, {})],
    ['puppet', POSES.puppet(0.5, 10, {})], ['pray', POSES.pray(0, 11, {})], ['hold child', POSES.holdHand(0, 12, {})], ['blink', { ...idle(0, 1), face: { brow: 'soft', blink: 1 } }],
  ];
  const ww = 1000 / 7, hh = 250;
  acts.forEach(([label, pose], i) => {
    const spec = i === 8 || i === 9 ? DOUBTER : i === 6 ? THOMAS : i === 7 ? israelites(3, 4)[1] : MODERN[i % MODERN.length];
    cell(spec, solveArms(spec, pose), 40 + (i % 7) * ww, y0 + 14 + Math.floor(i / 7) * hh, ww, hh, label);
  });
}

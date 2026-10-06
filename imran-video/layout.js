// Measured chat layout (spec §1.8), computed once after fonts load. Shared by chatpage, drop, flight.
(function () {
  window.LAYOUT = null;
  window.SCENE_INIT.push(async () => {
    const c = document.createElement('canvas').getContext('2d');
    const w = (str, fam, wt, size) => { c.font = `${wt} ${size}px "${fam}"`; return c.measureText(str).width; };
    const MSG = 'Imran, I got you!';
    let msgSize = 96;
    let tw = w(MSG, 'Shantell Sans', 700, msgSize);
    if (tw > 900) { msgSize = 96 * 900 / tw; tw = 900; }
    const W = tw + 332, H = 216, cx = 960, cy = 426;
    const Lx = cx - W / 2, Rx = cx + W / 2;
    const textX = Lx + 212;
    const words = MSG.split(' ');
    const wordX = []; let acc = '';
    for (const wd of words) { wordX.push(textX + w(acc, 'Shantell Sans', 700, msgSize)); acc += wd + ' '; }
    const REPLY = 'I’ve got it';
    const replyW = w(REPLY, 'Fraunces', 500, 96);
    const bangX = textX + replyW + 20;
    // per-glyph x positions of the reply (for letter-by-letter typing)
    const glyphX = []; for (let i = 0; i <= REPLY.length; i++) glyphX.push(textX + w(REPLY.slice(0, i), 'Fraunces', 500, 96));
    window.LAYOUT = {
      MSG, msgSize, msgFont: ['Shantell Sans', 700], tw,
      bubble: { W, H, cx, cy, L: Lx, R: Rx, top: cy - H / 2, bottom: cy + H / 2, radius: 76 },
      avatar: { x: Lx + 105, y: 426, r: 63, head: { x: Lx + 105, y: 408, r: 22 }, shoulders: { x: Lx + 105, y: 472, rx: 42, ry: 30 } },
      text: { x: textX, baseline: 458 }, words, wordX,
      REPLY, replyFont: ['Fraunces', 500], replySize: 96, reply: { x: textX, baseline: 690, width: replyW }, glyphX,
      bang: { x: bangX, stemTop: 621, stemBottom: 668, topW: 15, bottomW: 9, tiltDeg: 3, dot: { x: bangX, y: 681, r: 10 } },
      caret: { w: 6, h: 84, top: 612 },
      underline: { gLeft: textX + w('I’ve ', 'Fraunces', 500, 96) - 6, end: bangX + 14, y0: 732, yc: 742, y1: 726, width: 10 },
      chip: { x: Rx - 100, y: 534, w: 168, h: 104, r: 52 },
    };
  });
})();

/* =========================================================================
   PROCEDURAL ART ENGINE
   No image files ship with this game. Every sprite, tile, prop, weapon and
   UI icon below is drawn pixel-by-pixel into an offscreen buffer at boot,
   then cached as a canvas. Pix is a tiny pixel-art rasteriser with the
   primitives a 16x16 sprite actually needs: blobs, ellipses, mirroring,
   automatic outlining and top-light/bottom-shadow rim shading.
   ========================================================================= */

function hexToRgb(h) {
  if (h == null) return [0, 0, 0, 0];
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
}
function shiftColor(hex, dr, dg, db) {
  const c = hexToRgb(hex);
  const f = (v, d) => clamp(Math.round(v + d), 0, 255);
  return "#" + [f(c[0], dr), f(c[1], dg), f(c[2], db)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function lighten(hex, n) { return shiftColor(hex, n, n, n); }
function darken(hex, n) { return shiftColor(hex, -n, -n, -n); }
/* rotate a colour's hue crudely by swapping channel emphasis — used for variants */
function tint(hex, rMul, gMul, bMul) {
  const c = hexToRgb(hex);
  const f = (v, m) => clamp(Math.round(v * m), 0, 255);
  return "#" + [f(c[0], rMul), f(c[1], gMul), f(c[2], bMul)].map(v => v.toString(16).padStart(2, "0")).join("");
}

class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, col, alpha) {
    x |= 0; y |= 0;
    if (!this.inside(x, y) || !col) return;
    const c = typeof col === "string" ? hexToRgb(col) : col;
    const a = alpha == null ? 1 : alpha;
    const i = (y * this.w + x) * 4;
    if (a >= 1) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return; }
    const sa = this.d[i + 3] / 255, na = a + sa * (1 - a);
    if (na <= 0) return;
    this.d[i]     = (c[0] * a + this.d[i]     * sa * (1 - a)) / na;
    this.d[i + 1] = (c[1] * a + this.d[i + 1] * sa * (1 - a)) / na;
    this.d[i + 2] = (c[2] * a + this.d[i + 2] * sa * (1 - a)) / na;
    this.d[i + 3] = na * 255;
  }
  getA(x, y) { return this.inside(x, y) ? this.d[((y * this.w + x) * 4) + 3] : 0; }
  getC(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  clearPx(x, y) { if (!this.inside(x, y)) return; const i = (y * this.w + x) * 4; this.d[i + 3] = 0; }

  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  frameRect(x, y, w, h, c) {
    for (let i = 0; i < w; i++) { this.set(x + i, y, c); this.set(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.set(x, y + j, c); this.set(x + w - 1, y + j, c); }
    return this;
  }
  ell(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + .001), dy = (y - cy) / (ry + .001);
        if (dx * dx + dy * dy <= 1.02) this.set(x, y, c);
      }
    return this;
  }
  ellRing(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + .001), dy = (y - cy) / (ry + .001);
        const v = dx * dx + dy * dy;
        if (v <= 1.05 && v >= 0.45) this.set(x, y, c);
      }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /* organic lump: an ellipse whose radius wobbles with angle */
  blob(cx, cy, rx, ry, c, rng, wob) {
    wob = wob == null ? 0.18 : wob;
    const k = [rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)];
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++)
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const dx = x - cx, dy = y - cy;
        const a = Math.atan2(dy, dx);
        const m = 1 + wob * (Math.sin(a * 2 + k[0] * 3) * .5 + Math.sin(a * 3 + k[1] * 3) * .3 + Math.sin(a + k[2] * 3) * .2);
        const nx = dx / (rx * m + .001), ny = dy / (ry * m + .001);
        if (nx * nx + ny * ny <= 1.0) this.set(x, y, c);
      }
    return this;
  }
  /* copy the left half onto the right half (sprites are symmetric front-on) */
  mirrorX() {
    const half = Math.floor(this.w / 2);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < half; x++) {
        const i = (y * this.w + x) * 4, j = (y * this.w + (this.w - 1 - x)) * 4;
        this.d[j] = this.d[i]; this.d[j + 1] = this.d[i + 1]; this.d[j + 2] = this.d[i + 2]; this.d[j + 3] = this.d[i + 3];
      }
    return this;
  }
  /* 1px outline around every opaque pixel */
  outline(c, diag) {
    const marks = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.getA(x, y) > 8) continue;
        const n = this.getA(x - 1, y) > 8 || this.getA(x + 1, y) > 8 || this.getA(x, y - 1) > 8 || this.getA(x, y + 1) > 8 ||
          (diag && (this.getA(x - 1, y - 1) > 8 || this.getA(x + 1, y - 1) > 8 || this.getA(x - 1, y + 1) > 8 || this.getA(x + 1, y + 1) > 8));
        if (n) marks.push(x, y);
      }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], c);
    return this;
  }
  /* top-light / bottom-shadow: reads the alpha silhouette, so it works on
     anything already drawn and gives every sprite a consistent light source */
  rim(lightAmt, shadeAmt) {
    lightAmt = lightAmt == null ? 34 : lightAmt;
    shadeAmt = shadeAmt == null ? 30 : shadeAmt;
    const src = new Uint8ClampedArray(this.d);
    const A = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : src[((y * this.w + x) * 4) + 3];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (src[i + 3] < 20) continue;
        let d = 0;
        if (A(x, y - 1) < 20 || A(x, y - 2) < 20) d += lightAmt;
        if (A(x, y + 1) < 20) d -= shadeAmt;
        if (A(x - 1, y) < 20) d += Math.round(lightAmt * .4);
        if (d === 0) continue;
        this.d[i] = clamp(src[i] + d, 0, 255);
        this.d[i + 1] = clamp(src[i + 1] + d, 0, 255);
        this.d[i + 2] = clamp(src[i + 2] + d, 0, 255);
      }
    return this;
  }
  /* scatter pixels of colour c inside the existing silhouette */
  speckle(c, n, rng, alpha) {
    let tries = 0;
    while (n > 0 && tries < n * 60) {
      tries++;
      const x = rng.int(0, this.w - 1), y = rng.int(0, this.h - 1);
      if (this.getA(x, y) < 40) continue;
      this.set(x, y, c, alpha == null ? 1 : alpha); n--;
    }
    return this;
  }
  /* ordered-dither wash — the classic retro gradient */
  dither(c, level, x0, y0, w, h) {
    const M = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    x0 = x0 || 0; y0 = y0 || 0; w = w || this.w; h = h || this.h;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        if (this.getA(x, y) > 40 && M[y & 3][x & 3] < level * 16) this.set(x, y, c);
    return this;
  }
  toCanvas() {
    const cv = document.createElement("canvas");
    cv.width = this.w; cv.height = this.h;
    const c2 = cv.getContext("2d");
    const img = c2.createImageData(this.w, this.h);
    img.data.set(this.d);
    c2.putImageData(img, 0, 0);
    return cv;
  }
}

/* build a sprite: fn(p, rng) draws into a Pix, returns a canvas */
let __artSeed = 1337;
function spr(w, h, fn, seed) {
  const p = new Pix(w, h);
  const rng = makeRng(seed == null ? (__artSeed++ * 2654435761) >>> 0 : seed);
  fn(p, rng);
  return p.toCanvas();
}
function flipH(cv) {
  const o = document.createElement("canvas");
  o.width = cv.width; o.height = cv.height;
  const c = o.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0);
  return o;
}
/* recolour a finished canvas (used for hit flashes and elite variants) */
function tintCanvas(cv, color, amount) {
  const o = document.createElement("canvas");
  o.width = cv.width; o.height = cv.height;
  const c = o.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, 0, 0);
  c.globalCompositeOperation = "source-atop";
  c.globalAlpha = amount;
  c.fillStyle = color;
  c.fillRect(0, 0, o.width, o.height);
  return o;
}
/* pure-white silhouette, for the hit flash */
function whiteMask(cv) { return tintCanvas(cv, "#ffffff", 1); }

/* ------------------------------- palettes ------------------------------- */
const PAL = {
  ink: "#140d24",
  grass: ["#4fae46", "#3f9138", "#63c453", "#2f6f2c"],
  meadow: ["#68c05a", "#54a848", "#7ad46a", "#3f8438"],
  forest: ["#2f7a34", "#25612a", "#3c9440", "#1b4a20"],
  sand: ["#e8cf8a", "#d6b76b", "#f2e0a4", "#bd9c55"],
  dirt: ["#8c6a45", "#725436", "#a07f56", "#5b4229"],
  stone: ["#82809a", "#66647c", "#9b99b2", "#4d4b60"],
  snow: ["#e6eef8", "#c9d8ec", "#f6fbff", "#a8bcd8"],
  ash: ["#5a5265", "#453e4f", "#6f6679", "#332d3b"],
  swamp: ["#4a6f3e", "#3a5a30", "#5c8449", "#2b4425"],
  water: ["#2f74cf", "#2560ad", "#4a91e6", "#1a4a8a"],
  deep: ["#1c4a90", "#173d78", "#2a5ea8", "#10305e"],
  lava: ["#e0562a", "#b83c18", "#ffa03c", "#8a2a10"]
};
const BIOME_TINT = {
  meadow: "#7ad46a", forest: "#3c9440", sand: "#f2e0a4", swamp: "#5c8449",
  snow: "#f6fbff", ash: "#6f6679", stone: "#9b99b2", water: "#4a91e6", deep: "#2a5ea8", lava: "#ffa03c"
};

/* ------------------------------ ground tiles ---------------------------- */
const TS = 16; /* tile size in world pixels */

function groundTile(pal, opts) {
  opts = opts || {};
  return spr(TS, TS, (p, rng) => {
    p.rect(0, 0, TS, TS, pal[0]);
    /* patchy noise so large fields never look flat */
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const r = rng.f();
        if (r < 0.16) p.set(x, y, pal[1]);
        else if (r < 0.24) p.set(x, y, pal[2]);
        else if (r < 0.27) p.set(x, y, pal[3]);
      }
    if (opts.blades) {
      for (let i = 0; i < opts.blades; i++) {
        const x = rng.int(1, TS - 2), y = rng.int(2, TS - 2);
        p.set(x, y, pal[3]); p.set(x, y - 1, pal[2]);
      }
    }
    if (opts.pebbles) {
      for (let i = 0; i < opts.pebbles; i++) {
        const x = rng.int(1, TS - 3), y = rng.int(1, TS - 3);
        p.rect(x, y, 2, 1, pal[3]); p.set(x, y - 1, pal[2]);
      }
    }
    if (opts.crack) {
      const x = rng.int(3, TS - 4), y = rng.int(2, TS - 6);
      p.line(x, y, x + rng.int(-3, 3), y + rng.int(3, 6), pal[3]);
    }
    if (opts.sparkle) {
      for (let i = 0; i < 3; i++) p.set(rng.int(0, TS - 1), rng.int(0, TS - 1), "#ffffff", .8);
    }
  });
}

function waterTile(pal, frame, deep) {
  return spr(TS, TS, (p, rng) => {
    p.rect(0, 0, TS, TS, pal[0]);
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const w = Math.sin((x * 0.55) + (y * 0.31) + frame * 1.35) + Math.sin((y * 0.7) - frame * 0.9) * 0.6;
        if (w > 1.05) p.set(x, y, pal[2]);
        else if (w > 0.45) p.set(x, y, pal[0]);
        else if (w < -0.9) p.set(x, y, pal[3]);
        else p.set(x, y, pal[1]);
      }
    /* glinting highlights on the crests */
    for (let i = 0; i < (deep ? 1 : 3); i++) {
      const x = (rng.int(0, TS - 3) + frame * 2) % TS, y = rng.int(0, TS - 1);
      p.rect(x, y, 2, 1, deep ? pal[2] : "#bfe4ff", .75);
    }
  }, 900 + frame * 13 + (deep ? 77 : 0));
}

function lavaTile(frame) {
  return spr(TS, TS, (p, rng) => {
    p.rect(0, 0, TS, TS, PAL.lava[1]);
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const v = fbm((x + frame * 3) / 7, (y - frame * 2) / 7, 55, 3) ;
        if (v > 0.62) p.set(x, y, PAL.lava[2]);
        else if (v > 0.5) p.set(x, y, PAL.lava[0]);
        else if (v < 0.36) p.set(x, y, PAL.lava[3]);
      }
    for (let i = 0; i < 2; i++) p.set(rng.int(0, 15), rng.int(0, 15), "#ffe9a8", .9);
  }, 1200 + frame * 31);
}

/* ------------------------------- props ---------------------------------- */
/* Props are taller than a tile and are drawn with their base on the tile. */
function propTree(leafA, leafB, trunk, tall) {
  const h = tall ? 30 : 24, w = 22;
  return spr(w, h, (p, rng) => {
    const cx = w / 2, baseY = h - 2;
    p.rect(cx - 2, baseY - 9, 4, 9, trunk);
    p.rect(cx - 2, baseY - 9, 1, 9, darken(trunk, 26));
    p.set(cx + 1, baseY - 6, lighten(trunk, 18));
    if (tall) {
      /* conifer: stacked triangles */
      for (let k = 0; k < 4; k++) {
        const ty = 3 + k * 5, rw = 4 + k * 2.6;
        for (let i = 0; i < 6; i++)
          p.rect(cx - (rw * i / 5) - 1, ty + i, (rw * i / 5) * 2 + 2, 1, i > 3 ? leafB : leafA);
      }
    } else {
      p.blob(cx, 10, 9, 8, leafA, rng, .22);
      p.blob(cx - 4, 13, 6, 5, leafB, rng, .25);
      p.blob(cx + 4, 12, 6, 5, leafB, rng, .25);
      p.blob(cx, 7, 6, 4, lighten(leafA, 20), rng, .2);
    }
    p.speckle(darken(leafB, 22), tall ? 8 : 14, rng);
    p.speckle(lighten(leafA, 26), tall ? 6 : 10, rng);
    p.outline(PAL.ink, true).rim(26, 22);
    /* contact shadow */
    for (let x = -6; x <= 6; x++) {
      const a = 0.30 * (1 - Math.abs(x) / 7);
      p.set(cx + x, baseY, "#000000", a); p.set(cx + x, baseY + 1, "#000000", a * .6);
    }
  });
}
function propRock(base, big) {
  const s = big ? 20 : 14;
  return spr(s, s, (p, rng) => {
    const cx = s / 2, cy = s * 0.62;
    p.blob(cx, cy, s * 0.36, s * 0.30, base, rng, .26);
    p.blob(cx - 2, cy - 2, s * 0.20, s * 0.16, lighten(base, 26), rng, .3);
    p.speckle(darken(base, 24), big ? 10 : 6, rng);
    p.outline(PAL.ink, true).rim(24, 20);
    for (let x = -5; x <= 5; x++) p.set(cx + x, s - 2, "#000000", 0.26 * (1 - Math.abs(x) / 6));
  });
}
function propBush(a, b) {
  return spr(16, 14, (p, rng) => {
    p.blob(8, 8, 6, 5, a, rng, .28);
    p.blob(5, 9, 4, 3.4, b, rng, .3);
    p.blob(11, 9, 4, 3.4, b, rng, .3);
    p.speckle(lighten(a, 28), 8, rng);
    if (rng.chance(.5)) { p.set(6, 7, "#ff6f7a"); p.set(10, 9, "#ff6f7a"); }
    p.outline(PAL.ink, true).rim(22, 18);
  });
}
function propCactus() {
  return spr(16, 22, (p, rng) => {
    const g = "#3f9e50";
    p.rect(6, 4, 4, 17, g);
    p.rect(2, 9, 3, 3, g); p.rect(4, 7, 2, 5, g);
    p.rect(11, 12, 3, 3, g); p.rect(10, 10, 2, 5, g);
    p.rect(6, 3, 4, 1, g); p.rect(2, 8, 3, 1, g); p.rect(11, 11, 3, 1, g);
    p.dither(darken(g, 26), .4, 8, 0, 8, 22);
    for (let y = 5; y < 20; y += 3) { p.set(5, y, "#e8e0a0"); p.set(10, y + 1, "#e8e0a0"); }
    if (rng.chance(.6)) { p.rect(7, 2, 2, 2, "#ff7ab0"); }
    p.outline(PAL.ink, true).rim(24, 20);
  });
}
function propCrystal(color) {
  return spr(16, 22, (p, rng) => {
    const c = color || "#7ad4ff";
    p.line(8, 2, 4, 14, c); p.line(8, 2, 12, 14, c);
    for (let y = 2; y < 20; y++) {
      const t = (y - 2) / 18, w = Math.round(1 + t * 5);
      p.rect(8 - w, y, w * 2, 1, c);
    }
    p.dither(lighten(c, 40), .5, 4, 0, 5, 22);
    p.dither(darken(c, 34), .55, 9, 0, 7, 22);
    p.rect(6, 5, 1, 6, "#ffffff", .8);
    p.outline(PAL.ink, true);
    for (let x = -5; x <= 5; x++) p.set(8 + x, 20, "#000000", 0.24 * (1 - Math.abs(x) / 6));
  });
}
function propRuin() {
  return spr(18, 26, (p, rng) => {
    const s = "#9b97ae";
    p.rect(5, 4, 8, 20, s);
    p.rect(3, 2, 12, 3, lighten(s, 14));
    for (let y = 6; y < 24; y += 4) p.rect(5, y, 8, 1, darken(s, 26));
    p.speckle(darken(s, 30), 12, rng);
    p.speckle("#5c8449", 6, rng, .8);
    /* broken chunk out of one side */
    for (let y = 12; y < 18; y++) for (let x = 11; x < 13; x++) if (rng.chance(.6)) p.clearPx(x, y);
    p.outline(PAL.ink, true).rim(24, 20);
    for (let x = -6; x <= 6; x++) p.set(9 + x, 24, "#000000", 0.26 * (1 - Math.abs(x) / 7));
  });
}
function propChest(open) {
  return spr(16, 15, (p, rng) => {
    const w = "#a06a30", d = "#6e4520", g = "#ffcf5c";
    p.rect(2, 6, 12, 7, w);
    p.rect(2, 11, 12, 2, d);
    if (open) { p.rect(2, 1, 12, 4, d); p.rect(3, 2, 10, 2, "#ffe9a8", .85); }
    else { p.rect(2, 3, 12, 4, w); p.rect(2, 6, 12, 1, d); }
    p.rect(7, open ? 6 : 5, 2, 4, g);
    p.set(7, open ? 8 : 7, darken(g, 40));
    p.speckle(darken(w, 22), 8, rng);
    p.outline(PAL.ink, true).rim(24, 20);
    for (let x = -6; x <= 6; x++) p.set(8 + x, 13, "#000000", 0.28 * (1 - Math.abs(x) / 7));
  });
}
function propShrine(frame) {
  return spr(20, 26, (p, rng) => {
    const s = "#b8b0d0";
    p.rect(3, 18, 14, 6, s); p.rect(3, 18, 14, 1, lighten(s, 20));
    p.rect(6, 8, 8, 11, s);
    p.rect(5, 6, 10, 3, lighten(s, 12));
    p.speckle(darken(s, 26), 10, rng);
    const glow = ["#8ef0d0", "#b6ffe8", "#8ef0d0", "#6ad8b8"][frame % 4];
    p.ell(10, 11, 3, 3.4, glow);
    p.ell(10, 10, 1.6, 2, "#ffffff", .9);
    for (let i = 0; i < 4; i++) p.set(rng.int(6, 14), 4 + ((frame + i * 3) % 8), glow, .55);
    p.outline(PAL.ink, true).rim(22, 18);
    for (let x = -8; x <= 8; x++) p.set(10 + x, 24, "#000000", 0.28 * (1 - Math.abs(x) / 9));
  }, 500 + frame);
}
function propObelisk(frame, used) {
  return spr(18, 30, (p, rng) => {
    const s = used ? "#5b5570" : "#3d3564";
    for (let y = 4; y < 27; y++) {
      const t = (y - 4) / 23, w = Math.round(3 + t * 2);
      p.rect(9 - w, y, w * 2, 1, s);
    }
    p.line(9, 1, 5, 6, s); p.line(9, 1, 13, 6, s); p.rect(6, 4, 7, 3, s);
    const glow = used ? "#6b6088" : ["#ffcf5c", "#ffe9a8", "#ffcf5c", "#e0a41c"][frame % 4];
    for (let y = 8; y < 24; y += 4) p.rect(8, y, 2, 2, glow);
    p.rect(8, 3, 2, 3, glow);
    if (!used) for (let i = 0; i < 5; i++) p.set(rng.int(4, 13), 26 - ((frame * 2 + i * 5) % 22), glow, .5);
    p.outline(PAL.ink, true).rim(26, 22);
    for (let x = -7; x <= 7; x++) p.set(9 + x, 28, "#000000", 0.30 * (1 - Math.abs(x) / 8));
  }, 700 + frame + (used ? 90 : 0));
}
function propFlower(c) {
  return spr(10, 10, (p, rng) => {
    p.rect(4, 5, 1, 4, "#3f8438");
    p.set(4, 4, c); p.set(3, 3, c); p.set(5, 3, c); p.set(4, 2, c); p.set(3, 5, c); p.set(5, 5, c);
    p.set(4, 3, lighten(c, 60));
    p.outline(PAL.ink, true);
  });
}
function propTallGrass(a) {
  return spr(16, 12, (p, rng) => {
    for (let i = 0; i < 9; i++) {
      const x = rng.int(1, 14), h = rng.int(4, 8);
      for (let k = 0; k < h; k++) p.set(x + (k > h - 3 ? rng.int(-1, 1) : 0), 11 - k, k > h - 3 ? lighten(a, 22) : a);
    }
    p.outline(PAL.ink, true);
  });
}

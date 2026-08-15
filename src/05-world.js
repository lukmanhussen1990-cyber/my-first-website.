/* ============================ ART REGISTRY =============================== */
const ART = { hero: {}, tiles: {}, props: {}, mon: {}, weapons: {}, icons: {}, boons: {}, bolts: {} };
/* Recolouring a sprite allocates a canvas, so every tint is cached — these are
   asked for every frame while an effect is running. */
const _flash = new Map();
const _tints = new Map();
function flashOf(cv) {
  let f = _flash.get(cv);
  if (!f) { f = whiteMask(cv); _flash.set(cv, f); }
  return f;
}
function tintOf(cv, color, amount) {
  let byCv = _tints.get(cv);
  if (!byCv) { byCv = new Map(); _tints.set(cv, byCv); }
  const key = color + "|" + amount;
  let t = byCv.get(key);
  if (!t) { t = tintCanvas(cv, color, amount); byCv.set(key, t); }
  return t;
}

const MON_TYPES = ["gelmite", "sporling", "prikkle", "fennec", "nightwing", "rattleknight", "grimhound", "emberwisp", "gloomwraith", "stonewarden", "thornmaw"];

function buildHeroArt(tier) {
  const trim = TIER_TRIM[clamp((tier | 0) - 1, 0, 4)];
  const mk = (dir) => [0, 1, 2, 3].map(f => heroSprite(dir, f, trim));
  ART.hero.down = mk("down");
  ART.hero.up = mk("up");
  ART.hero.right = mk("side");
  ART.hero.left = ART.hero.right.map(flipH);
  ART.hero.portrait = heroSprite("down", 0, trim);
  _flash.clear(); _tints.clear();
}

function buildArt() {
  buildHeroArt(1);

  /* ground */
  const mkSet = (pal, opts, n) => { const a = []; for (let i = 0; i < (n || 4); i++) a.push(groundTile(pal, opts)); return a; };
  ART.tiles.meadow = mkSet(PAL.meadow, { blades: 7 });
  ART.tiles.grass = mkSet(PAL.grass, { blades: 5 });
  ART.tiles.forest = mkSet(PAL.forest, { blades: 6 });
  ART.tiles.sand = mkSet(PAL.sand, { pebbles: 3 });
  ART.tiles.dirt = mkSet(PAL.dirt, { pebbles: 2, crack: true });
  ART.tiles.stone = mkSet(PAL.stone, { pebbles: 4, crack: true });
  ART.tiles.snow = mkSet(PAL.snow, { sparkle: true });
  ART.tiles.ash = mkSet(PAL.ash, { pebbles: 3, crack: true });
  ART.tiles.swamp = mkSet(PAL.swamp, { blades: 5, pebbles: 1 });
  ART.tiles.rockwall = mkSet(["#5a5670", "#454258", "#6e6a86", "#332f44"], { pebbles: 6, crack: true });
  ART.tiles.water = [0, 1, 2, 3].map(f => waterTile(PAL.water, f, false));
  ART.tiles.deep = [0, 1, 2, 3].map(f => waterTile(PAL.deep, f, true));
  ART.tiles.lava = [0, 1, 2, 3].map(f => lavaTile(f));

  /* props */
  ART.props.tree = propTree("#3c9440", "#25612a", "#6e4a24", false);
  ART.props.tree2 = propTree("#4faf4a", "#2f7a34", "#7a5228", false);
  ART.props.pine = propTree("#2a6e4a", "#1c4c34", "#5a4020", true);
  ART.props.deadtree = propTree("#6a5a48", "#4e4132", "#4a3a26", true);
  ART.props.rock = propRock("#82809a", false);
  ART.props.bigrock = propRock("#6e6a86", true);
  ART.props.ashrock = propRock("#5a5265", false);
  ART.props.snowrock = propRock("#c9d8ec", false);
  ART.props.bush = propBush("#3f9138", "#2f6f2c");
  ART.props.swampbush = propBush("#4a6f3e", "#33512b");
  ART.props.cactus = propCactus();
  ART.props.crystal = propCrystal("#7ad4ff");
  ART.props.crystalR = propCrystal("#ff7ab0");
  ART.props.ruin = propRuin();
  ART.props.grass = propTallGrass("#3f8438");
  ART.props.flowerR = propFlower("#ff5566");
  ART.props.flowerY = propFlower("#ffcf5c");
  ART.props.flowerB = propFlower("#6cc5ff");
  ART.props.chest = propChest(false);
  ART.props.chestOpen = propChest(true);
  ART.props.shrine = [0, 1, 2, 3].map(f => propShrine(f));
  ART.props.obelisk = [0, 1, 2, 3].map(f => propObelisk(f, false));
  ART.props.obeliskUsed = propObelisk(0, true);

  /* monsters: 4 animation frames, plus a left-facing flip of each */
  for (const t of MON_TYPES) {
    const frames = [0, 1, 2, 3].map(f => MONSTER_ART[t](f, null));
    ART.mon[t] = { r: frames, l: frames.map(flipH) };
  }
  ART.crown = crownSprite();

  /* weapons */
  ART.weapons.sword = [1, 2, 3, 4, 5].map(swordSprite);
  ART.weapons.spear = [1, 2, 3, 4, 5].map(spearSprite);
  ART.weapons.wand = [1, 2, 3, 4, 5].map(wandSprite);

  /* projectiles */
  for (const k of ["arcane", "fire", "frost", "spark"]) ART.bolts[k] = [0, 1].map(f => boltSprite(k, f));

  /* ui */
  ART.icons.book = icoBook();
  ART.icons.pause = icoPause();
  ART.icons.heart = icoHeart(false);
  ART.icons.stam = icoDrop("#39d4c8");
  ART.icons.coin = icoCoin();
  ART.icons.xp = [0, 1].map(f => pickupSprite("xp", f));
  ART.title = titleArt();
  for (const k of ["hp", "sp", "sword", "spear", "wand", "crit", "speed", "lifesteal", "magnet",
    "xp", "shield", "thorns", "dash", "trance", "fire", "frost", "chain", "armor"])
    ART.boons[k] = boonIcon(k);
}

/* =========================== WORLD GENERATION ============================ */
const T = { DEEP: 0, WATER: 1, SAND: 2, MEADOW: 3, GRASS: 4, FOREST: 5, SWAMP: 6, DIRT: 7, STONE: 8, SNOW: 9, ASH: 10, LAVA: 11, ROCKWALL: 12 };
const TILE_ART_KEY = ["deep", "water", "sand", "meadow", "grass", "forest", "swamp", "dirt", "stone", "snow", "ash", "lava", "rockwall"];
const TILE_SOLID = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const TILE_ANIM = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
const BIOME_NAME = ["Sunken Deep", "Shallows", "Dunes", "Meadow", "Green Wold", "Old Forest", "Mire", "Barrens", "Highlands", "Frostcap", "Cinder Waste", "Lavaflow", "Crags"];

/* props catalogue: index 0 = nothing */
const PROPS = [
  null,
  { art: "tree", solid: 1, r: 4.5, oy: 6, sway: 1 },
  { art: "tree2", solid: 1, r: 4.5, oy: 6, sway: 1 },
  { art: "pine", solid: 1, r: 4, oy: 8, sway: 1 },
  { art: "deadtree", solid: 1, r: 4, oy: 8, sway: 1 },
  { art: "rock", solid: 1, r: 5, oy: 2 },
  { art: "bigrock", solid: 1, r: 7, oy: 3 },
  { art: "ashrock", solid: 1, r: 5, oy: 2 },
  { art: "snowrock", solid: 1, r: 5, oy: 2 },
  { art: "bush", solid: 0, r: 0, oy: 2, sway: 1 },
  { art: "swampbush", solid: 0, r: 0, oy: 2, sway: 1 },
  { art: "cactus", solid: 1, r: 4, oy: 4 },
  { art: "crystal", solid: 1, r: 4, oy: 4, glow: "#7ad4ff" },
  { art: "crystalR", solid: 1, r: 4, oy: 4, glow: "#ff7ab0" },
  { art: "ruin", solid: 1, r: 6, oy: 6 },
  { art: "grass", solid: 0, r: 0, oy: 0, sway: 2 },
  { art: "flowerR", solid: 0, r: 0, oy: 0, sway: 2 },
  { art: "flowerY", solid: 0, r: 0, oy: 0, sway: 2 },
  { art: "flowerB", solid: 0, r: 0, oy: 0, sway: 2 }
];

const World = {
  W: 200, H: 200, seed: 1,
  tile: null, prop: null,
  landmarks: [],
  chunks: new Map(),
  spawn: { x: 0, y: 0 },

  generate(seed) {
    this.seed = seed >>> 0;
    const rng = makeRng(this.seed);
    const W = this.W, H = this.H;
    this.tile = new Uint8Array(W * H);
    this.prop = new Uint8Array(W * H);
    this.landmarks = [];
    this.chunks.clear();

    const s1 = this.seed, s2 = (this.seed ^ 0x9e3779b9) >>> 0, s3 = (this.seed * 3 + 77) >>> 0;
    const cx = W / 2, cy = H / 2;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        /* Continent shape: fbm elevation pushed down toward the map edge so the
           playable land is an island ringed by ocean — no invisible walls. */
        let e = fbm(x / 34, y / 34, s1, 5, 2.1, 0.52);
        e = e * 0.72 + fbm(x / 11, y / 11, s1 + 999, 3) * 0.28;
        const dx = (x - cx) / (W * 0.5), dy = (y - cy) / (H * 0.5);
        const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        e -= Math.pow(d, 2.6) * 0.72;
        e += 0.10;

        const m = fbm(x / 26 + 40, y / 26 - 20, s2, 4, 2.0, 0.55);
        const vol = fbm(x / 30 - 60, y / 30 + 15, s3, 3);

        let t;
        if (e < 0.20) t = T.DEEP;
        else if (e < 0.28) t = T.WATER;
        else if (e < 0.325) t = T.SAND;
        else if (e < 0.60) {
          if (vol > 0.70 && e > 0.40) t = (vol > 0.80 && e > 0.46) ? T.LAVA : T.ASH;
          else if (m < 0.30) t = T.SAND;
          else if (m < 0.40) t = T.DIRT;
          else if (m < 0.52) t = T.MEADOW;
          else if (m < 0.63) t = T.GRASS;
          else if (m < 0.76) t = T.FOREST;
          else t = T.SWAMP;
        }
        else if (e < 0.68) t = (vol > 0.72) ? T.ASH : T.STONE;
        else if (e < 0.74) t = T.SNOW;
        else t = T.ROCKWALL;
        this.tile[y * W + x] = t;
      }
    }

    /* props, deterministic per tile so the world is stable without storing much */
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, t = this.tile[i];
        if (TILE_SOLID[t]) continue;
        const h = hash2(x, y, this.seed ^ 0x51ed270b);
        let pr = 0;
        switch (t) {
          case T.FOREST: pr = h < .34 ? 1 : h < .48 ? 2 : h < .56 ? 9 : h < .62 ? 15 : 0; break;
          case T.GRASS: pr = h < .07 ? 1 : h < .13 ? 9 : h < .26 ? 15 : h < .30 ? 16 : h < .33 ? 17 : 0; break;
          case T.MEADOW: pr = h < .04 ? 2 : h < .12 ? 15 : h < .17 ? 17 : h < .21 ? 18 : h < .24 ? 16 : h < .27 ? 9 : 0; break;
          case T.SWAMP: pr = h < .16 ? 4 : h < .30 ? 10 : h < .40 ? 15 : 0; break;
          case T.SAND: pr = h < .07 ? 11 : h < .11 ? 5 : 0; break;
          case T.DIRT: pr = h < .06 ? 5 : h < .10 ? 9 : h < .14 ? 15 : 0; break;
          case T.STONE: pr = h < .13 ? 5 : h < .19 ? 6 : h < .22 ? 14 : 0; break;
          case T.SNOW: pr = h < .16 ? 3 : h < .22 ? 8 : 0; break;
          case T.ASH: pr = h < .10 ? 7 : h < .15 ? 4 : h < .19 ? 12 : h < .22 ? 13 : 0; break;
        }
        this.prop[i] = pr;
      }
    }

    /* landmarks: shrines heal, obelisks temper a weapon, chests drop loot */
    const place = (kind, count, minDist) => {
      let tries = 0;
      while (count > 0 && tries < 4000) {
        tries++;
        const x = rng.int(6, W - 7), y = rng.int(6, H - 7);
        if (!this.walkableTile(x, y)) continue;
        let ok = true;
        for (const L of this.landmarks) if (dist2(L.tx, L.ty, x, y) < minDist * minDist) { ok = false; break; }
        if (!ok) continue;
        /* clear a small pad so the landmark is reachable */
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.prop[(y + j) * W + (x + i)] = 0;
        this.landmarks.push({ kind, tx: x, ty: y, x: x * TS + TS / 2, y: y * TS + TS / 2, used: false, t: 0 });
        count--;
      }
    };
    place("shrine", 14, 16);
    place("obelisk", 12, 18);
    place("chest", 26, 9);

    /* the hero starts at a calm spot near the middle of the island */
    let best = null;
    for (let k = 0; k < 3000; k++) {
      const x = Math.round(cx + rng.range(-26, 26)), y = Math.round(cy + rng.range(-26, 26));
      if (!this.walkableTile(x, y)) continue;
      const t = this.tile[y * W + x];
      if (t !== T.MEADOW && t !== T.GRASS) continue;
      const score = -dist2(x, y, cx, cy);
      if (!best || score > best.s) best = { x, y, s: score };
      if (best && k > 600) break;
    }
    if (!best) best = { x: Math.round(cx), y: Math.round(cy) };
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const xx = best.x + i, yy = best.y + j;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      this.prop[yy * W + xx] = 0;
      if (TILE_SOLID[this.tile[yy * W + xx]]) this.tile[yy * W + xx] = T.MEADOW;
    }
    this.spawn = { x: best.x * TS + TS / 2, y: best.y * TS + TS / 2 };
    /* Clear caches and obelisks off the starting pad. Opening a run standing
       on treasure hands out an instant level-up before the player has moved. */
    this.landmarks = this.landmarks.filter(L =>
      L.kind === "shrine" || dist2(L.tx, L.ty, best.x, best.y) > 7 * 7);
    /* a welcome shrine at the start */
    this.landmarks.push({ kind: "shrine", tx: best.x + 2, ty: best.y - 2, x: (best.x + 2) * TS + TS / 2, y: (best.y - 2) * TS + TS / 2, used: false, t: 0 });
    for (const L of this.landmarks) this.prop[L.ty * W + L.tx] = 0;
  },

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return T.DEEP;
    return this.tile[ty * this.W + tx];
  },
  propAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 0;
    return this.prop[ty * this.W + tx];
  },
  walkableTile(tx, ty) {
    if (tx < 1 || ty < 1 || tx >= this.W - 1 || ty >= this.H - 1) return false;
    if (TILE_SOLID[this.tile[ty * this.W + tx]]) return false;
    const pr = PROPS[this.prop[ty * this.W + tx]];
    return !(pr && pr.solid);
  },
  biomeAt(x, y) { return this.tileAt(Math.floor(x / TS), Math.floor(y / TS)); },

  /* circle-vs-world collision used by every moving entity */
  blocked(x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
        const t = this.tile[ty * this.W + tx];
        const pr = PROPS[this.prop[ty * this.W + tx]];
        const solid = TILE_SOLID[t] || (pr && pr.solid);
        if (!solid) continue;
        if (pr && pr.solid && !TILE_SOLID[t]) {
          /* props block a circle around the tile centre, not the whole tile */
          const cxp = tx * TS + TS / 2, cyp = ty * TS + TS / 2 + 3;
          if (dist2(x, y, cxp, cyp) < (r + pr.r) * (r + pr.r)) return true;
        } else {
          const nx = clamp(x, tx * TS, tx * TS + TS), ny = clamp(y, ty * TS, ty * TS + TS);
          if (dist2(x, y, nx, ny) < r * r) return true;
        }
      }
    return false;
  },
  /* slide along walls: try full move, then each axis alone */
  moveCircle(e, dx, dy, r) {
    let moved = false;
    if (!this.blocked(e.x + dx, e.y + dy, r)) { e.x += dx; e.y += dy; return true; }
    if (dx && !this.blocked(e.x + dx, e.y, r)) { e.x += dx; moved = true; }
    if (dy && !this.blocked(e.x, e.y + dy, r)) { e.y += dy; moved = true; }
    return moved;
  },

  /* ---- chunked ground cache: static tiles baked into 8x8-tile canvases ---- */
  CH: 8,
  chunkAt(cx, cy) {
    const key = cx + "," + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    const CH = this.CH, size = CH * TS;
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    for (let j = 0; j < CH; j++)
      for (let i = 0; i < CH; i++) {
        const tx = cx * CH + i, ty = cy * CH + j;
        const t = this.tileAt(tx, ty);
        if (TILE_ANIM[t]) continue;                    /* animated tiles drawn live */
        const set = ART.tiles[TILE_ART_KEY[t]];
        const v = Math.floor(hash2(tx, ty, 4242) * set.length) % set.length;
        g.drawImage(set[v], i * TS, j * TS);
        /* shoreline / biome fringe: darken the edge facing a different tile */
        if (t !== T.DEEP && t !== T.WATER) {
          const nb = this.tileAt(tx, ty + 1);
          if (nb === T.WATER || nb === T.DEEP) { g.fillStyle = "rgba(20,13,36,.28)"; g.fillRect(i * TS, j * TS + TS - 3, TS, 3); }
        }
      }
    if (this.chunks.size > 260) {
      /* drop the oldest quarter when the cache gets big (long walks) */
      let n = 0; for (const k of this.chunks.keys()) { this.chunks.delete(k); if (++n > 70) break; }
    }
    this.chunks.set(key, cv);
    return cv;
  }
};

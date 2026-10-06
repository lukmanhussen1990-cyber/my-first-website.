/*
 * ArrowGO! by ImranO - levels.js
 * ------------------------------------------------------------------------------------
 * Deterministic, seeded level generator + board geometry helpers. No dependencies.
 *
 * Exposed as `window.ArrowLevels` in the browser and as `module.exports` under Node.
 * The public API is the binding contract of docs/ARCHITECTURE.md:
 *
 *   ArrowLevels.DIRS                            { U:[-1,0], D:[1,0], L:[0,-1], R:[0,1] }
 *   ArrowLevels.levelParams(n)                  { size, arrows, minLen, maxLen }
 *   ArrowLevels.generateLevel(n)                -> Puzzle (same n => same puzzle)
 *   ArrowLevels.generateDaily('YYYY-MM-DD')     -> Puzzle (10x10, seeded by the date)
 *   ArrowLevels.exitRay(arrow, size)            -> [[r,c], ...] head (exclusive) -> edge
 *   ArrowLevels.buildGrid(arrows, size)         -> size x size array of arrow id or -1
 *   ArrowLevels.findBlocker(arrow, grid, size)  -> null | { id, distance, cell }
 *   ArrowLevels.freeArrows(arrows, size)        -> ids of arrows that can leave right now
 *   ArrowLevels.solve(arrows, size)             -> greedy removal order (ids) or null
 *   ArrowLevels.verify(puzzle)                  -> true if puzzle.solution clears the board
 *   ArrowLevels.mulberry32(seed), ArrowLevels.hashString(str)
 *
 * Extras that do not change the contract:
 *   ArrowLevels.dailyParams(date)  { size, arrows, minLen, maxLen } of the daily for `date`
 *   ArrowLevels._debug             { lastAttempt } - which seeded attempt produced the
 *                                  last puzzle (0 = first try, -1 = constructive fallback).
 *                                  Read by tests only; never needed by the game.
 *
 * Puzzle = { key: 'L12' | 'D2026-10-06', level: 12 | null, size, arrows, solution }
 *   arrows[i].id === i (ids 0..k-1), cells are [r, c] pairs tail -> head, and
 *   solution lists every id once, in a valid removal order (= reverse placement order).
 *
 * Determinism rules followed in this file (the same level must be byte-identical on
 * every device, browser and Node version): the only randomness is mulberry32 seeded
 * from hashString(); no Math.random, no Date, nothing depends on object key order; only
 * integer maths and + - * / on doubles (exactly specified by IEEE-754); no
 * transcendental Math functions; no Array#sort.
 * ------------------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* ==================================================================================
   * 1. Constants and small helpers
   * ================================================================================ */

  var DIRS = Object.freeze({
    U: Object.freeze([-1, 0]),
    D: Object.freeze([1, 0]),
    L: Object.freeze([0, -1]),
    R: Object.freeze([0, 1])
  });

  // Internally directions are small integers so they can index typed arrays:
  //   0 = U, 1 = D, 2 = L, 3 = R.   Note that (d ^ 1) is the opposite direction.
  var DNAME = ['U', 'D', 'L', 'R'];
  var DR = [-1, 1, 0, 0];
  var DC = [0, 0, -1, 1];

  // Larger level numbers (and +Infinity) are clamped to this. It is the largest integer a
  // double holds exactly, so every level a player could ever reach keeps its own board and
  // generateLevel(n).level === n for every integer n >= 1 up to it.
  var MAX_LEVEL = 9007199254740991; // Number.MAX_SAFE_INTEGER (spelled out for old engines)
  var MAX_ATTEMPTS = 80; // seeded retries before the constructive fallback kicks in

  var DEBUG = { lastAttempt: 0 };

  /**
   * mulberry32 - tiny, fast, well distributed 32-bit PRNG.
   * Returns a function producing floats in [0, 1). Pure 32-bit integer maths
   * (Math.imul, >>>) so every JS engine yields exactly the same sequence.
   */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * hashString - 32-bit FNV-1a over UTF-16 code units, followed by the murmur3
   * finaliser for better avalanche. Returns an unsigned 32-bit integer.
   * Any value is accepted (it is converted with String()).
   */
  function hashString(str) {
    var s = safeString(str);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** String(x) that never throws (Symbols, objects with a throwing toString...). */
  function safeString(x) {
    try {
      return typeof x === 'string' ? x : String(x);
    } catch (e) {
      return '';
    }
  }

  /** Integer in [lo, hi] (inclusive) drawn from a mulberry32 stream. */
  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  /**
   * Normalise any input to a valid level number: floor(Number(n)), anything < 1 or not a
   * number (NaN, undefined, objects, Symbols...) becomes 1, huge values are clamped.
   */
  function normLevel(n) {
    var v;
    try {
      v = Math.floor(Number(n));
    } catch (e) {
      return 1; // Number(Symbol()) throws
    }
    if (!(v >= 1)) return 1; // NaN, -Infinity, 0, negatives
    if (v > MAX_LEVEL) return MAX_LEVEL; // also +Infinity
    return v;
  }

  /** Linear interpolation between (n0, a0) and (n1, a1), rounded half-up, integers only. */
  function lerpInt(n, n0, n1, a0, a1) {
    var num = (n - n0) * (a1 - a0) * 2 + (n1 - n0);
    return a0 + Math.floor(num / (2 * (n1 - n0)));
  }

  /* ==================================================================================
   * 2. Difficulty ramp (the table in docs/ARCHITECTURE.md)
   * ================================================================================ */

  /**
   * levelParams(n) -> { size, arrows, minLen, maxLen }
   *
   *   level   size  arrows
   *   1       4     2
   *   2       5     4
   *   3-5     5     5..7    (linear in n: 5, 6, 7)
   *   6-12    6     7..11   (linear in n)
   *   13-22   7     11..16  (linear in n)
   *   23-35   8     15..22  (linear in n)
   *   36-60   9     22..32  (linear in n)
   *   61+     9     30..36  (seeded per level: hashString('arrowgo:params:' + n))
   *
   * maxLen ramps 4 (levels 1-6) -> 5 (7-12) -> 6 (13-18) -> 7 (19-24) -> 8 (25+).
   * minLen is always 2 (a single cell would have no direction).
   */
  function levelParams(n) {
    n = normLevel(n);
    var size;
    var arrows;
    if (n === 1) {
      size = 4;
      arrows = 2;
    } else if (n === 2) {
      size = 5;
      arrows = 4;
    } else if (n <= 5) {
      size = 5;
      arrows = lerpInt(n, 3, 5, 5, 7);
    } else if (n <= 12) {
      size = 6;
      arrows = lerpInt(n, 6, 12, 7, 11);
    } else if (n <= 22) {
      size = 7;
      arrows = lerpInt(n, 13, 22, 11, 16);
    } else if (n <= 35) {
      size = 8;
      arrows = lerpInt(n, 23, 35, 15, 22);
    } else if (n <= 60) {
      size = 9;
      arrows = lerpInt(n, 36, 60, 22, 32);
    } else {
      size = 9;
      arrows = 30 + (hashString('arrowgo:params:' + n) % 7);
    }
    var maxLen = Math.min(8, 4 + Math.floor((n - 1) / 6));
    return { size: size, arrows: arrows, minLen: 2, maxLen: maxLen };
  }

  /**
   * Canonical daily key.
   *   - 'YYYY-MM-DD' is used as-is (this is what the game passes).
   *   - Forgiving forms of the same day map to that day: surrounding whitespace
   *     (' 2026-10-06 '), an ISO date-time ('2026-10-06T08:00:00Z' -> '2026-10-06', the
   *     date as written, no timezone maths) and a valid Date object (its LOCAL calendar
   *     day, like the game's own todayKey()). Without this a Date would be keyed by its
   *     toString() text, i.e. a different "daily" every second and per timezone.
   *   - Anything else still gets a deterministic key (so the game never crashes on bad
   *     input): 'X' + the input stripped to [0-9A-Za-z_-] (max 24 chars) + '-' + base36
   *     hash of the raw input.
   */
  function dailyKey(date) {
    if (date instanceof Date) {
      try {
        var t = date.getTime();
        if (t === t) return pad4(date.getFullYear()) + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
      } catch (e) {
        // not a real Date (subclass / prototype trick): use the generic path below
      }
    }
    var s = safeString(date);
    var m = /^\s*(\d{4}-\d{2}-\d{2})(?:[T ][0-9:.]*(?:Z|[+-]\d{2}:?\d{2})?)?\s*$/.exec(s);
    if (m) return m[1];
    var clean = s.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 24);
    return 'X' + (clean || 'invalid') + '-' + hashString(s).toString(36);
  }

  function pad2(v) {
    return (v < 10 ? '0' : '') + v;
  }

  /** Year as 4 digits. Years outside 0..9999 cannot be written as YYYY: they get a
   *  'Y' prefix ('Y10000', 'Y-5') so the key stays deterministic and URL-safe. */
  function pad4(v) {
    if (v < 0 || v > 9999) return 'Y' + v;
    return ('000' + v).slice(-4);
  }

  /** Daily boards: 10x10, 38..42 arrows (seeded by the date), maxLen 8. */
  function dailyParams(date) {
    var key = dailyKey(date);
    return {
      size: 10,
      arrows: 38 + (hashString('arrowgo:dailyparams:' + key) % 5),
      minLen: 2,
      maxLen: 8
    };
  }

  /* ==================================================================================
   * 3. Movement / collision helpers (public)
   * ==================================================================================
   *
   * THE movement rule. Tapping an arrow makes it slide like a snake: each tick the head
   * moves one cell in `dir` and every body cell steps into the cell in front of it.
   * The body therefore only ever re-visits cells the head has already passed through,
   * so the ONLY cells that can ever stop the arrow are the cells straight ahead of the
   * head, from the head (exclusive) to the board edge. We call that list the EXIT RAY.
   *
   *     . . . . .        arrow  a = cells (3,1) (3,2) (2,2), dir 'U'   (head = (2,2))
   *     . . B . .        exit ray of a = (1,2), (0,2)
   *     . . ^ . .        (1,2) is held by arrow B  -> B is the BLOCKER, distance 0
   *     . a a . .        if (1,2) were empty and (0,2) held B -> distance 1: the arrow
   *     . . . . .        slides 1 cell, bumps into B, bounces back (player loses a drop)
   *
   * If every exit-ray cell is empty the arrow slides off the board and is removed.
   */

  /**
   * exitRay(arrow, size) -> [[r, c], ...]
   * The cells from the head (exclusive) straight in arrow.dir up to the board edge, in
   * the order the head would visit them. Empty when the head sits on the edge and
   * points outward.
   */
  function exitRay(arrow, size) {
    var cells = arrow.cells;
    var head = cells[cells.length - 1];
    var d = DIRS[arrow.dir];
    var out = [];
    var r = head[0] + d[0];
    var c = head[1] + d[1];
    while (r >= 0 && r < size && c >= 0 && c < size) {
      out.push([r, c]);
      r += d[0];
      c += d[1];
    }
    return out;
  }

  /** buildGrid(arrows, size) -> size x size array (grid[r][c]) of arrow id or -1. */
  function buildGrid(arrows, size) {
    var grid = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) row.push(-1);
      grid.push(row);
    }
    for (var i = 0; i < arrows.length; i++) {
      var a = arrows[i];
      for (var j = 0; j < a.cells.length; j++) {
        var cell = a.cells[j];
        if (cell[0] >= 0 && cell[0] < size && cell[1] >= 0 && cell[1] < size) {
          grid[cell[0]][cell[1]] = a.id;
        }
      }
    }
    return grid;
  }

  /**
   * findBlocker(arrow, grid, size) -> null when the arrow can leave the board, else
   *   { id, distance, cell }
   *     id       - id of the first arrow found on the exit ray (the blocker)
   *     distance - number of EMPTY ray cells in front of the blocker = how many cells the
   *                arrow slides before it bumps (0 = the blocker touches the head)
   *     cell     - [r, c] of the blocking cell
   *
   * Walks the exit ray outward from the head and stops at the first occupied cell
   * (grid value !== -1). Cells off the ray are irrelevant (see the movement rule).
   * `grid` is a buildGrid() result for the arrows currently on the board.
   *
   * Self-crossing: a long snake could in theory curl around so its own body lies on
   * its exit ray. The generator never creates that, and here such a cell simply counts
   * as a blocker (id = the arrow's own id), which keeps hand-made / corrupted boards on
   * the safe side: an arrow can never pass through itself.
   */
  function findBlocker(arrow, grid, size) {
    var cells = arrow.cells;
    var head = cells[cells.length - 1];
    var d = DIRS[arrow.dir];
    var r = head[0] + d[0];
    var c = head[1] + d[1];
    var distance = 0;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      var v = grid[r][c];
      if (v !== -1 && v !== undefined && v !== null) {
        return { id: v, distance: distance, cell: [r, c] };
      }
      distance++;
      r += d[0];
      c += d[1];
    }
    return null;
  }

  /** freeArrows(arrows, size) -> ids (in array order) of the arrows whose exit ray is clear. */
  function freeArrows(arrows, size) {
    var grid = buildGrid(arrows, size);
    var ids = [];
    for (var i = 0; i < arrows.length; i++) {
      if (!findBlocker(arrows[i], grid, size)) ids.push(arrows[i].id);
    }
    return ids;
  }

  /**
   * Greedy "waves": repeatedly remove every arrow that is currently free.
   * Removing an arrow only ever empties cells, so it can never block another arrow and
   * the greedy strategy is complete: the board is solvable iff this empties it.
   * Returns { order: ids in removal order (each wave in array order), waves } or null.
   */
  function greedyWaves(arrows, size) {
    var grid = buildGrid(arrows, size);
    var remaining = arrows.slice();
    var order = [];
    var waves = 0;
    while (remaining.length) {
      var free = [];
      var rest = [];
      for (var i = 0; i < remaining.length; i++) {
        if (findBlocker(remaining[i], grid, size)) rest.push(remaining[i]);
        else free.push(remaining[i]);
      }
      if (!free.length) return null; // stuck: nothing can move ever again
      for (var j = 0; j < free.length; j++) {
        var cells = free[j].cells;
        for (var q = 0; q < cells.length; q++) grid[cells[q][0]][cells[q][1]] = -1;
        order.push(free[j].id);
      }
      remaining = rest;
      waves++;
    }
    return { order: order, waves: waves };
  }

  /** solve(arrows, size) -> greedy removal order (ids) or null when the board is stuck. */
  function solve(arrows, size) {
    var res = greedyWaves(arrows, size);
    return res ? res.order : null;
  }

  /** Structural sanity check of one arrow (used by verify). */
  function arrowShapeOk(a, size) {
    if (!a || !Array.isArray(a.cells) || a.cells.length < 2 || a.cells.length > 8) return false;
    if (a.dir !== 'U' && a.dir !== 'D' && a.dir !== 'L' && a.dir !== 'R') return false;
    for (var i = 0; i < a.cells.length; i++) {
      var cell = a.cells[i];
      if (!Array.isArray(cell) || cell.length !== 2) return false;
      var r = cell[0];
      var c = cell[1];
      if (!(Number.isInteger(r) && Number.isInteger(c))) return false;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      if (i > 0) {
        var p = a.cells[i - 1];
        if (Math.abs(r - p[0]) + Math.abs(c - p[1]) !== 1) return false; // not adjacent
      }
    }
    var n = a.cells.length;
    var h = a.cells[n - 1];
    var b = a.cells[n - 2];
    var d = DIRS[a.dir];
    return h[0] - b[0] === d[0] && h[1] - b[1] === d[1]; // dir = last segment
  }

  /**
   * verify(puzzle) -> true when playing puzzle.solution tap by tap with the real
   * movement rule (findBlocker must report a clear ray before every removal) removes
   * every arrow and leaves the board empty. Malformed puzzles return false (ids that
   * are not 0..k-1, overlapping / out-of-bounds / non-adjacent cells, a dir that does
   * not match the last segment, a solution with unknown, repeated or missing ids).
   */
  function verify(puzzle) {
    try {
      if (!puzzle || !Array.isArray(puzzle.arrows) || !Array.isArray(puzzle.solution)) return false;
      var size = puzzle.size;
      if (!Number.isInteger(size) || size < 2 || size > 64) return false;
      var arrows = puzzle.arrows;
      var k = arrows.length;
      var byId = [];
      for (var i = 0; i < k; i++) {
        var a = arrows[i];
        if (!a || !Number.isInteger(a.id) || a.id < 0 || a.id >= k || byId[a.id]) return false;
        if (!arrowShapeOk(a, size)) return false;
        byId[a.id] = a;
      }
      var grid = buildGrid([], size);
      for (i = 0; i < k; i++) {
        for (var j = 0; j < arrows[i].cells.length; j++) {
          var cell = arrows[i].cells[j];
          if (grid[cell[0]][cell[1]] !== -1) return false; // overlap (or self-overlap)
          grid[cell[0]][cell[1]] = arrows[i].id;
        }
      }
      if (puzzle.solution.length !== k) return false;
      var removed = [];
      for (var s = 0; s < k; s++) {
        var id = puzzle.solution[s];
        if (!Number.isInteger(id) || id < 0 || id >= k || removed[id]) return false;
        if (findBlocker(byId[id], grid, size)) return false; // this tap would bounce
        var cs = byId[id].cells;
        for (var q = 0; q < cs.length; q++) grid[cs[q][0]][cs[q][1]] = -1;
        removed[id] = true;
      }
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) if (grid[r][c] !== -1) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ==================================================================================
   * 4. The generator
   * ==================================================================================
   *
   * Big picture
   * -----------
   * Arrows are placed ONE AT A TIME on an initially empty board. A candidate arrow is
   * accepted only when its exit ray (head -> edge) crosses NO arrow placed before it
   * and not its own body. That single rule makes every puzzle solvable by construction:
   *
   *   - the LAST placed arrow has a clear ray on the full board, so it can leave first;
   *   - once it is gone, the arrow placed before it has a clear ray (its ray can only
   *     contain cells of arrows placed AFTER it, which are all gone by then), etc.
   *
   * So solution = reverse placement order. The puzzle part comes from LATER arrows
   * landing on the ray of an EARLIER one: the earlier arrow is stuck until they leave.
   * (Ids are shuffled afterwards so the solution is not simply "highest id first".)
   *
   * Why naive random placement fails on dense boards
   * ------------------------------------------------
   * Levels 61+ need 30..36 arrows on 81 cells, dailies 38..42 arrows on 100 cells.
   * Every arrow has >= 2 cells, so these boards end up 75-100% full. Each placed arrow
   * is a wall for the rays of all later arrows and a cell can only become a HEAD while
   * it still sees the edge in a straight line. Random placement quickly leaves pockets
   * of empty cells that no legal arrow can use and stalls well short of the target.
   *
   * The heuristic (one placement step)
   * ----------------------------------
   *   1. clear[d][cell] = "the ray from cell in direction d is empty up to the edge",
   *      computed for all cells with four O(size^2) line sweeps.
   *   2. live[cell] = "some legal 2-cell arrow could still cover this empty cell" (as
   *      head or as tail). The number of live cells is the board's remaining capacity.
   *   3. Pick a target length for this arrow from the spare capacity (see below).
   *   4. Build `candidates` candidate arrows: choose a random legal head (empty head
   *      cell + direction with a clear ray + empty cell behind it), then grow the body
   *      backwards from the tail end in a random style (mostly straight, L, U, S or
   *      zig-zag), never onto its own ray and never touching itself except at the
   *      joint (keeps snakes legible: no 2x2 blobs).
   *   5. Score every candidate, keep the best:
   *        - kills:     -wKill per live cell that would stop being live (the cell gets
   *                     walled in). This is what keeps dense boards fillable;
   *        - capacity:  when the board is nearly full, a greedy matching of legal 2-cell
   *                     arrows estimates how many arrows still fit; a candidate leaving
   *                     fewer slots than arrows still to place is vetoed (-5000);
   *        - depth:     early arrows prefer cells near the centre (inside-out filling),
   *                     so the outer rings stay open for later arrows pointing outward;
   *        - contacts:  touching placed arrows (and, later on, the border) avoids holes;
   *        - blocking:  +wBlock per currently-free arrow whose ray this candidate covers
   *                     (that arrow becomes blocked -> fewer free arrows at the start,
   *                     more removal waves = a more interesting puzzle);
   *        - zero ray:  -wZeroRay when the head sits on the border pointing outward
   *                     (such an arrow can never be blocked, it is a giveaway);
   *        - length:    -wLen per cell away from the target length;
   *        - noise:     a little seeded randomness for variety.
   *   6. Commit the best candidate (every candidate is first re-checked literally
   *      against the acceptance rule by walking its ray). If there is no legal head
   *      or no acceptable candidate, the attempt fails and the caller retries with
   *      the next seed (attempt + 1).
   *
   * Lengths: "spare" = live cells - 2 * (arrows still to place). Minus an allowance for
   * cells that will die before the end, that is the budget for cells beyond 2 per
   * arrow. The first arrow (central) is a long 5..maxLen snake whenever the level allows
   * it, later arrows are long with probability `longChance` while the budget lasts,
   * otherwise their length hovers around the average affordable extra length.
   *
   * After a full placement the layout must also pass the quality gate (qualityOk);
   * a rejected layout is retried deterministically with the next seed.
   */

  // Tuning knobs (see the description above). Frozen: generation must not drift.
  var CFG = Object.freeze({
    candidates: 40, // candidate arrows scored per placement step
    fill: 0.6, // share of the per-arrow budget used for the "normal" length draw
    longChance: 0.12, // chance of a long (5..maxLen) snake when the budget allows
    firstLong: true, // the first (most central) arrow is long whenever possible
    deadRate: 0.05, // budget allowance: cells expected to die per remaining arrow
    deadBase: 1, // budget allowance: fixed number of cells expected to die
    tight: 12, // run the capacity matching when spare live cells drop below this
    styles: Object.freeze([0.85, 0.6, 0.35, 0.15]), // straightness of the body styles
    wKill: 40,
    wBlock: 12,
    wZeroRay: 30,
    wContact: 3,
    wEdge: 2,
    wDepth: 30,
    wLen: 6,
    noise: 12
  });

  /**
   * Fill clear[d][i] = 1 when every cell strictly beyond cell i in direction d (up to
   * the edge) is empty. Each sweep walks a line starting at the edge the ray points
   * to, so every value derives from its neighbour in O(1): O(size^2) in total.
   */
  function computeClear(grid, size, clear) {
    var cU = clear[0];
    var cD = clear[1];
    var cL = clear[2];
    var cR = clear[3];
    var r;
    var c;
    var i;
    for (c = 0; c < size; c++) {
      cU[c] = 1; // top row: nothing above
      for (r = 1; r < size; r++) {
        i = r * size + c;
        cU[i] = cU[i - size] === 1 && grid[i - size] < 0 ? 1 : 0;
      }
      i = (size - 1) * size + c;
      cD[i] = 1; // bottom row: nothing below
      for (r = size - 2; r >= 0; r--) {
        i = r * size + c;
        cD[i] = cD[i + size] === 1 && grid[i + size] < 0 ? 1 : 0;
      }
    }
    for (r = 0; r < size; r++) {
      var b = r * size;
      cL[b] = 1; // left column: nothing to the left
      for (c = 1; c < size; c++) cL[b + c] = cL[b + c - 1] === 1 && grid[b + c - 1] < 0 ? 1 : 0;
      cR[b + size - 1] = 1; // right column: nothing to the right
      for (c = size - 2; c >= 0; c--) cR[b + c] = cR[b + c + 1] === 1 && grid[b + c + 1] < 0 ? 1 : 0;
    }
  }

  /**
   * Mark live cells (heuristic step 2) and return how many there are.
   * Empty cell y is live if, for some direction d:
   *   - y can be a HEAD pointing d: the cell behind it (y - d) is empty and the ray
   *     from y is clear; or
   *   - y can be a TAIL: the cell in front of it (y + d) is empty and the ray from that
   *     cell (the head of the 2-cell arrow y -> y + d) is clear.
   */
  function computeLive(grid, size, clear, live) {
    var count = 0;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var y = r * size + c;
        var ok = 0;
        if (grid[y] < 0) {
          for (var d = 0; d < 4 && !ok; d++) {
            var br = r - DR[d];
            var bc = c - DC[d];
            if (clear[d][y] && br >= 0 && br < size && bc >= 0 && bc < size && grid[br * size + bc] < 0) ok = 1;
            var fr = r + DR[d];
            var fc = c + DC[d];
            if (!ok && fr >= 0 && fr < size && fc >= 0 && fc < size) {
              var f = fr * size + fc;
              if (grid[f] < 0 && clear[d][f]) ok = 1;
            }
          }
        }
        live[y] = ok;
        count += ok;
      }
    }
    return count;
  }

  /**
   * One placement attempt (heuristic steps 1-6 for every arrow).
   * Cells are flat indices (r * size + c) internally.
   * Returns { placed: [{ cells: [idx...] tail -> head, d }], free: [bool] } or null
   * when the board ran out of legal heads before reaching cfg.arrows.
   * free[i] is true when no later arrow landed on arrow i's ray, i.e. arrow i is free
   * in the starting position.
   */
  function tryGenerate(cfg, rng) {
    var size = cfg.size;
    var k = cfg.arrows;
    var maxLen = cfg.maxLen;
    var minLen = cfg.minLen;
    var N = size * size;

    var grid = new Int16Array(N).fill(-1); // placement index or -1
    var clear = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
    var live = new Uint8Array(N);
    var heads = new Int32Array(N * 4); // legal heads, encoded cell * 4 + dir
    var mark = new Int32Array(N); // cell belongs to the current candidate (== stamp)
    var stamp = 0;
    var seen = new Int32Array(N); // dedupe while scanning affected cells
    var seenStamp = 0;
    // Row / column extents of the current candidate (see rayOk)
    var rowMin = new Int32Array(size);
    var rowMax = new Int32Array(size);
    var colMin = new Int32Array(size);
    var colMax = new Int32Array(size);
    var deg = new Int8Array(N); // capacity(): legal partners per cell
    var matched = new Int32Array(N); // capacity(): matched marker (== mStamp)
    var mStamp = 0;

    // ring[i] = distance of cell i to the nearest border (0 = border cell)
    var ring = new Int32Array(N);
    for (var q = 0; q < N; q++) {
      var qr = (q / size) | 0;
      var qc = q % size;
      ring[q] = Math.min(qr, qc, size - 1 - qr, size - 1 - qc);
    }
    var maxRing = (size - 1) >> 1 || 1;

    var placed = []; // { cells, d, hr, hc }
    var isFree = []; // see the function comment
    var cand = new Int32Array(8); // candidate body, head first (cand[0] = head)
    var best = new Int32Array(8);

    for (var step = 0; step < k; step++) {
      // ---- step 1 + 2: rays and live cells for the current board -----------------
      computeClear(grid, size, clear);
      var liveCount = computeLive(grid, size, clear, live);

      // ---- legal heads: empty head, clear ray in d, empty in-bounds cell behind ----
      var nh = 0;
      for (var h = 0; h < N; h++) {
        if (grid[h] >= 0) continue;
        var hr0 = (h / size) | 0;
        var hc0 = h % size;
        for (var d0 = 0; d0 < 4; d0++) {
          if (!clear[d0][h]) continue;
          var br0 = hr0 - DR[d0];
          var bc0 = hc0 - DC[d0];
          if (br0 < 0 || br0 >= size || bc0 < 0 || bc0 >= size) continue;
          if (grid[br0 * size + bc0] >= 0) continue;
          heads[nh++] = h * 4 + d0;
        }
      }
      if (nh === 0) return null; // nothing fits any more -> caller retries

      var remaining = k - step; // arrows still to place, including this one
      var after = remaining - 1; // arrows still to place after this one
      var spare = liveCount - minLen * remaining; // live cells beyond 2 per arrow
      var progress = step / k; // 0 at the start -> ~1 at the end

      // ---- step 3: target length ---------------------------------------------------
      var budget = spare - Math.ceil(cfg.deadRate * after) - cfg.deadBase;
      var extraCap = Math.max(0, Math.min(maxLen - minLen, budget));
      var target = minLen;
      if (extraCap > 0) {
        var avgExtra = (budget * cfg.fill) / remaining;
        var roll = rng();
        if (maxLen >= 5 && extraCap >= 3 && (roll < cfg.longChance || (step === 0 && cfg.firstLong))) {
          target = randInt(rng, 5, minLen + extraCap); // a long snake
        } else {
          target = minLen + Math.min(extraCap, Math.floor(rng() * (2 * avgExtra + 1)));
        }
      }
      // "tight" = little room left: every third candidate is a plain 2-cell arrow so a
      // cheap option always competes, and the capacity matching is enabled (step 5).
      var tightNow = spare < cfg.tight;

      // ---- step 4 + 5: sample and score candidates --------------------------------
      var bestScore = -Infinity;
      var bestLen = 0;
      var bestD = 0;
      for (var t = 0; t < cfg.candidates; t++) {
        var opt = heads[Math.floor(rng() * nh)];
        var hd = opt & 3;
        var hcell = opt >> 2;
        var hr = (hcell / size) | 0;
        var hc = hcell % size;
        stamp++;
        cand[0] = hcell;
        mark[hcell] = stamp;
        // The cell behind the head is forced: dir must equal the last segment.
        var bcell = (hr - DR[hd]) * size + (hc - DC[hd]);
        cand[1] = bcell;
        mark[bcell] = stamp;
        var len = 2;

        var want = target + (rng() < 0.25 ? randInt(rng, -1, 1) : 0);
        if (tightNow && t % 3 === 2) want = minLen;
        if (want > maxLen) want = maxLen;
        if (want < minLen) want = minLen;

        // Grow the body backwards (towards the tail). gd = direction of the last growth
        // step; continuing in gd keeps the snake straight, anything else is a turn.
        // straightBias picks the style: ~0.85 long straight runs / L shapes, ~0.15
        // turns at almost every cell (S, U and zig-zag shapes).
        var gd = hd ^ 1; // first step went from the head backwards = opposite of hd
        var straightBias = cfg.styles[Math.floor(rng() * cfg.styles.length)];
        while (len < want) {
          var tc = cand[len - 1];
          var tr = (tc / size) | 0;
          var tcc = tc % size;
          var oStraight = -1; // option continuing straight
          var oTurn1 = -1; // up to two turning options
          var oTurn2 = -1;
          for (var gdi = 0; gdi < 4; gdi++) {
            var nr = tr + DR[gdi];
            var nc = tcc + DC[gdi];
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            var ncell = nr * size + nc;
            if (grid[ncell] >= 0 || mark[ncell] === stamp) continue; // taken
            if (onRay(nr, nc, hr, hc, hd)) continue; // own body may not block own ray
            if (touchesBody(nr, nc, tc)) continue; // legibility: no 2x2 blobs
            if (gdi === gd) oStraight = ncell;
            else if (oTurn1 < 0) oTurn1 = ncell;
            else oTurn2 = ncell;
          }
          if (oStraight < 0 && oTurn1 < 0) break; // dead end: keep the shorter arrow
          if (cfg.straightOnly && oStraight < 0) break;
          var pick;
          if (oStraight >= 0 && (oTurn1 < 0 || rng() < straightBias)) pick = oStraight;
          else if (oTurn2 < 0 || rng() < 0.5) pick = oTurn1;
          else pick = oTurn2;
          var pr = (pick / size) | 0;
          var pc = pick % size;
          gd = pr < tr ? 0 : pr > tr ? 1 : pc < tcc ? 2 : 3;
          cand[len++] = pick;
          mark[pick] = stamp;
        }

        // THE acceptance rule, checked literally: walk the exit ray from the head to the
        // edge and reject the candidate if it meets any previously placed arrow or the
        // candidate's own body. (Head selection uses clear[][] and body growth skips
        // ray cells, so this never fires in practice; it is the safety net that keeps
        // the solvability guarantee independent of the heuristics.)
        if (!rayIsClear(hr, hc, hd)) continue;

        var score = scoreCandidate(len, hd, hr, hc, liveCount, after, progress, target);
        if (score > bestScore) {
          bestScore = score;
          bestLen = len;
          bestD = hd;
          for (var m = 0; m < len; m++) best[m] = cand[m];
        }
      }

      if (bestLen === 0) return null; // no acceptable candidate -> caller retries

      // ---- step 6: commit ------------------------------------------------------------
      var cellsTH = [];
      for (var m2 = bestLen - 1; m2 >= 0; m2--) cellsTH.push(best[m2]); // tail -> head
      var head = best[0];
      var arrow = { cells: cellsTH, d: bestD, hr: (head / size) | 0, hc: head % size };
      // Earlier arrows whose ray the new arrow covers are blocked from now on.
      for (var pj = 0; pj < placed.length; pj++) {
        if (isFree[pj] && coversRay(best, bestLen, placed[pj])) isFree[pj] = false;
      }
      for (var m3 = 0; m3 < bestLen; m3++) grid[best[m3]] = step;
      placed.push(arrow);
      isFree.push(true);
    }
    return { placed: placed, free: isFree };

    /* ---- helpers (closures over the attempt's state) ------------------------------ */

    // Is cell (r, c) on the exit ray that starts at head (hr, hc) and points d?
    function onRay(r, c, hr2, hc2, d) {
      if (d < 2) return c === hc2 && (r - hr2) * DR[d] > 0;
      return r === hr2 && (c - hc2) * DC[d] > 0;
    }

    // Acceptance rule: is every cell from head (hr, hc) exclusive, in direction d, up
    // to the edge free of placed arrows (grid) and of the candidate itself (mark)?
    function rayIsClear(hr2, hc2, d) {
      for (var r = hr2 + DR[d], c = hc2 + DC[d]; r >= 0 && r < size && c >= 0 && c < size; r += DR[d], c += DC[d]) {
        var x = r * size + c;
        if (grid[x] >= 0 || mark[x] === stamp) return false;
      }
      return true;
    }

    // Would the new body cell (r, c) touch the candidate anywhere but the current tail?
    function touchesBody(r, c, tail) {
      for (var a = 0; a < 4; a++) {
        var xr = r + DR[a];
        var xc = c + DC[a];
        if (xr < 0 || xr >= size || xc < 0 || xc >= size) continue;
        var x = xr * size + xc;
        if (x !== tail && mark[x] === stamp) return true;
      }
      return false;
    }

    // Does the arrow body cells[0..len) lie on the exit ray of placed arrow P?
    function coversRay(cells, len, P) {
      for (var i = 0; i < len; i++) {
        var x = cells[i];
        if (onRay((x / size) | 0, x % size, P.hr, P.hc, P.d)) return true;
      }
      return false;
    }

    // Step 5: score the candidate currently held in cand[0..len) / marked with stamp.
    function scoreCandidate(len, hd, hr, hc, liveCount, after, progress, target) {
      // Row / column extents of the candidate. A ray running along row r (or column c)
      // is cut by the candidate exactly when the candidate has a cell in that line
      // beyond the ray's start; rayOk() answers that in O(1) from these four arrays.
      for (var z = 0; z < size; z++) {
        rowMin[z] = size;
        rowMax[z] = -1;
        colMin[z] = size;
        colMax[z] = -1;
      }
      var depth = 0;
      var contactOcc = 0;
      var contactEdge = 0;
      var liveUsed = 0;
      var m;
      for (m = 0; m < len; m++) {
        var x = cand[m];
        var xr = (x / size) | 0;
        var xc = x % size;
        if (xc < rowMin[xr]) rowMin[xr] = xc;
        if (xc > rowMax[xr]) rowMax[xr] = xc;
        if (xr < colMin[xc]) colMin[xc] = xr;
        if (xr > colMax[xc]) colMax[xc] = xr;
        depth += ring[x];
        liveUsed += live[x];
        for (var a = 0; a < 4; a++) {
          var yr = xr + DR[a];
          var yc = xc + DC[a];
          if (yr < 0 || yr >= size || yc < 0 || yc >= size) contactEdge++;
          else if (grid[yr * size + yc] >= 0) contactOcc++;
        }
      }

      // Live cells this candidate would kill. Only cells sharing a row or a column
      // with a candidate cell can change: their rays run through the candidate, or
      // their neighbour (always in the same row/column) is taken.
      seenStamp++;
      var killed = 0;
      for (m = 0; m < len; m++) {
        var x2 = cand[m];
        var lr = (x2 / size) | 0;
        var lc = x2 % size;
        for (var s = 0; s < size; s++) {
          var y1 = lr * size + s; // along the row
          if (seen[y1] !== seenStamp) {
            seen[y1] = seenStamp;
            if (live[y1] && mark[y1] !== stamp && !stillLive(y1)) killed++;
          }
          var y2 = s * size + lc; // along the column
          if (seen[y2] !== seenStamp) {
            seen[y2] = seenStamp;
            if (live[y2] && mark[y2] !== stamp && !stillLive(y2)) killed++;
          }
        }
      }
      var liveAfter = liveCount - liveUsed - killed;

      // Free arrows whose ray this candidate covers (they would become blocked).
      var blocks = 0;
      for (var pj = 0; pj < placed.length; pj++) {
        if (isFree[pj] && coversRay(cand, len, placed[pj])) blocks++;
      }

      var score = -cfg.wKill * killed;
      // Plainly not enough live cells left for the remaining arrows.
      if (liveAfter < minLen * after) score -= 1000 + 100 * (minLen * after - liveAfter);
      // Capacity check near the end: live cells can still be useless in practice
      // (several live cells competing for the same partner), so count the arrows
      // that really still fit with a greedy matching and veto candidates that would
      // leave fewer slots than arrows still to place.
      if (after > 0 && liveAfter - minLen * after < cfg.tight) {
        var cap = capacity();
        if (cap < after) score -= 5000 + 500 * (after - cap);
      }
      score += cfg.wBlock * blocks;
      // Head on the border pointing outward: the ray is empty forever, the arrow can
      // never be blocked (a giveaway). One cell from the border is half as bad.
      var rayLen = hd === 0 ? hr : hd === 1 ? size - 1 - hr : hd === 2 ? hc : size - 1 - hc;
      if (rayLen === 0) score -= cfg.wZeroRay;
      else if (rayLen === 1) score -= cfg.wZeroRay / 2;
      score += cfg.wContact * contactOcc + cfg.wEdge * contactEdge * progress;
      score += (cfg.wDepth * (1 - progress) * depth) / (len * maxRing);
      score -= cfg.wLen * Math.abs(len - target);
      score += cfg.noise * rng();
      return score;
    }

    // Is the ray from (r, c) in direction d free of CANDIDATE cells? (Placed arrows are
    // covered by clear[][].) Uses the candidate's row / column extents.
    function rayOk(r, c, d) {
      if (d === 0) return colMin[c] > r; // no candidate cell above in column c
      if (d === 1) return colMax[c] < r; // ... below
      if (d === 2) return rowMin[r] > c; // ... left in row r
      return rowMax[r] < c; // ... right
    }

    // Liveness of empty cell y AFTER the current candidate would be placed: the same
    // test as computeLive, with candidate cells counted as occupied.
    function stillLive(y) {
      var r = (y / size) | 0;
      var c = y % size;
      for (var d = 0; d < 4; d++) {
        // y as the head of a 2-cell arrow pointing d (tail behind it)
        var br = r - DR[d];
        var bc = c - DC[d];
        if (br >= 0 && br < size && bc >= 0 && bc < size) {
          var b = br * size + bc;
          if (grid[b] < 0 && mark[b] !== stamp && clear[d][y] && rayOk(r, c, d)) return true;
        }
        // y as the tail, head in front of it pointing d
        var fr = r + DR[d];
        var fc = c + DC[d];
        if (fr >= 0 && fr < size && fc >= 0 && fc < size) {
          var f = fr * size + fc;
          if (grid[f] < 0 && mark[f] !== stamp && clear[d][f] && rayOk(fr, fc, d)) return true;
        }
      }
      return false;
    }

    // Greedy maximal matching of legal 2-cell arrows on the board as it would be after
    // the current candidate. Neighbours y, z form a legal pair when the arrow y -> z
    // (head z) or z -> y (head y) has a clear exit ray. Cells with the fewest partners
    // are matched first, which keeps the greedy result close to the true maximum.
    // The count is a practical estimate of how many more arrows still fit.
    function capacity() {
      mStamp++;
      var y;
      for (y = 0; y < N; y++) {
        deg[y] = 0;
        if (grid[y] >= 0 || mark[y] === stamp) continue;
        var r = (y / size) | 0;
        var c = y % size;
        for (var d = 0; d < 4; d++) {
          var nr = r + DR[d];
          var nc = c + DC[d];
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          var z = nr * size + nc;
          if (grid[z] >= 0 || mark[z] === stamp) continue;
          if ((clear[d][z] && rayOk(nr, nc, d)) || (clear[d ^ 1][y] && rayOk(r, c, d ^ 1))) deg[y]++;
        }
      }
      var total = 0;
      for (var wantDeg = 1; wantDeg <= 4; wantDeg++) {
        for (y = 0; y < N; y++) {
          if (deg[y] !== wantDeg || matched[y] === mStamp) continue;
          var yr = (y / size) | 0;
          var yc = y % size;
          var bestZ = -1;
          var bestDeg = 9;
          for (var d2 = 0; d2 < 4; d2++) {
            var zr = yr + DR[d2];
            var zc = yc + DC[d2];
            if (zr < 0 || zr >= size || zc < 0 || zc >= size) continue;
            var z2 = zr * size + zc;
            if (deg[z2] === 0 || matched[z2] === mStamp) continue;
            if (grid[z2] >= 0 || mark[z2] === stamp) continue;
            if (!((clear[d2][z2] && rayOk(zr, zc, d2)) || (clear[d2 ^ 1][y] && rayOk(yr, yc, d2 ^ 1)))) continue;
            if (deg[z2] < bestDeg) {
              bestDeg = deg[z2];
              bestZ = z2;
            }
          }
          if (bestZ >= 0) {
            matched[y] = mStamp;
            matched[bestZ] = mStamp;
            total++;
          }
        }
      }
      return total;
    }
  }

  /* ==================================================================================
   * 5. Quality gate, id shuffling, fallback and the public generators
   * ================================================================================ */

  /** Internal placement records -> public arrows (id = placement index for now). */
  function toArrows(placed, size) {
    var out = [];
    for (var i = 0; i < placed.length; i++) {
      var cells = [];
      for (var j = 0; j < placed[i].cells.length; j++) {
        var x = placed[i].cells[j];
        cells.push([(x / size) | 0, x % size]);
      }
      out.push({ id: i, cells: cells, dir: DNAME[placed[i].d] });
    }
    return out;
  }

  /**
   * Quality gate (deterministic, so a rejected layout is always rejected):
   *   - level 1 (tutorial, see generateLevel): exactly one of the two arrows is free
   *     and the other is blocked by it;
   *   - every other board: at least one arrow is blocked at the start;
   *   - boards with >= 15 arrows: at most 45% of the arrows free at the start and at
   *     least 3 greedy removal waves.
   */
  function qualityOk(free, arrows, cfg) {
    var k = arrows.length;
    var nFree = 0;
    for (var i = 0; i < free.length; i++) if (free[i]) nFree++;
    if (cfg.tutorial ? nFree !== 1 : nFree >= k) return false;
    if (k >= 15) {
      if (nFree * 100 > 45 * k) return false;
      var g = greedyWaves(arrows, cfg.size);
      if (!g || g.waves < 3) return false;
    }
    return true;
  }

  /**
   * Shuffle ids deterministically so the solution is not visible as "highest id
   * first", order the arrows by their new id (arrows[i].id === i) and map the solution
   * (reverse placement order) to the new ids.
   */
  function finalize(arrows, rng) {
    var k = arrows.length;
    var perm = [];
    var i;
    for (i = 0; i < k; i++) perm.push(i);
    for (i = k - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    var out = new Array(k);
    for (i = 0; i < k; i++) out[perm[i]] = { id: perm[i], cells: arrows[i].cells, dir: arrows[i].dir };
    var solution = [];
    for (i = k - 1; i >= 0; i--) solution.push(perm[i]);
    return { arrows: out, solution: solution };
  }

  /**
   * Constructive fallback, used only if MAX_ATTEMPTS seeded attempts all fail (never
   * happens for levels 1..4000 or the 2026-2027 dailies; it exists so ANY input still
   * yields a valid puzzle with the exact arrow count). Rows of 2-cell arrows, even rows
   * pointing right, odd rows left, placed from the far end of each row towards its exit
   * so every ray is clear at placement time. 9x9 holds 36, 10x10 holds 50.
   */
  function fallbackLayout(cfg) {
    var size = cfg.size;
    var placed = [];
    var per = size >> 1;
    for (var r = 0; r < size && placed.length < cfg.arrows; r++) {
      var right = r % 2 === 0;
      for (var p = 0; p < per && placed.length < cfg.arrows; p++) {
        var c0 = right ? 2 * p : size - 1 - 2 * p;
        var c1 = right ? c0 + 1 : c0 - 1;
        placed.push({ cells: [r * size + c0, r * size + c1], d: right ? 3 : 2 });
      }
    }
    return placed;
  }

  function makeCfg(params, tutorial) {
    var cfg = Object.assign({}, CFG); // plain copy; key order plays no role anywhere
    cfg.size = params.size;
    cfg.arrows = params.arrows;
    cfg.minLen = params.minLen;
    cfg.maxLen = params.maxLen;
    cfg.tutorial = tutorial;
    cfg.straightOnly = false;
    if (tutorial) {
      // Level 1: two short, perfectly straight arrows.
      cfg.maxLen = 3;
      cfg.longChance = 0;
      cfg.firstLong = false;
      cfg.styles = [1];
      cfg.straightOnly = true;
    }
    return cfg;
  }

  /**
   * Shared driver: attempt 0, 1, 2... each seeded with hashString(seedPrefix + attempt)
   * until a layout reaches the exact arrow count AND passes the quality gate.
   */
  function buildPuzzle(params, seedPrefix, tutorial) {
    var cfg = makeCfg(params, tutorial);
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var rng = mulberry32(hashString(seedPrefix + attempt));
      var res = tryGenerate(cfg, rng);
      if (!res || res.placed.length !== cfg.arrows) continue;
      var arrows = toArrows(res.placed, cfg.size);
      if (!qualityOk(res.free, arrows, cfg)) continue;
      DEBUG.lastAttempt = attempt;
      return finalize(arrows, rng);
    }
    DEBUG.lastAttempt = -1;
    return finalize(toArrows(fallbackLayout(cfg), cfg.size), mulberry32(hashString(seedPrefix + 'fallback')));
  }

  /**
   * generateLevel(n) -> Puzzle. Same n => byte-identical puzzle. Invalid n (NaN, < 1,
   * non-integer, non-number) is normalised: floor, then at least 1.
   *
   * Level 1 is the tutorial: a 4x4 board with two short straight arrows where exactly
   * one is free and the other is blocked by it. The first tap always works, and the
   * second arrow shows the core rule "clear the path first" without any guesswork
   * (tapping the blocked one first demonstrates the bump-and-bounce).
   */
  function generateLevel(n) {
    n = normLevel(n);
    var params = levelParams(n);
    var res = buildPuzzle(params, 'arrowgo:level:' + n + ':', n === 1);
    return { key: 'L' + n, level: n, size: params.size, arrows: res.arrows, solution: res.solution };
  }

  /**
   * generateDaily('YYYY-MM-DD') -> Puzzle on a 10x10 board, seeded by the date.
   * ' YYYY-MM-DD ', an ISO date-time string or a Date object give that day's daily; any
   * other argument still yields a valid, deterministic puzzle (see dailyKey).
   */
  function generateDaily(date) {
    var key = dailyKey(date);
    var params = dailyParams(key);
    var res = buildPuzzle(params, 'arrowgo:daily:' + key + ':', false);
    return { key: 'D' + key, level: null, size: params.size, arrows: res.arrows, solution: res.solution };
  }

  var API = {
    DIRS: DIRS,
    levelParams: levelParams,
    dailyParams: dailyParams,
    generateLevel: generateLevel,
    generateDaily: generateDaily,
    exitRay: exitRay,
    buildGrid: buildGrid,
    findBlocker: findBlocker,
    freeArrows: freeArrows,
    solve: solve,
    verify: verify,
    mulberry32: mulberry32,
    hashString: hashString,
    _debug: DEBUG
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  root.ArrowLevels = API;
})(typeof self !== 'undefined' ? self : globalThis);

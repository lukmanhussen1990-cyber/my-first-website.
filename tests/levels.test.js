#!/usr/bin/env node
/*
 * ArrowGO! - tests/levels.test.js
 * Plain Node test for levels.js (no dependencies). Run:  node tests/levels.test.js
 * Exit code 0 = all checks passed, 1 = at least one failure.
 *
 * Checks levels 1..2000 and every daily from 2026-01-01 to 2027-12-31:
 *   determinism (generated twice, JSON-equal), exact size / arrow count vs levelParams /
 *   dailyParams, ids 0..k-1, cells in bounds, no overlaps, adjacency, length bounds, dir =
 *   last segment, verify() true, solve() non-null, the placement property (walking
 *   reverse(solution) as placement order, every ray avoids all earlier arrows and its own
 *   body), the quality rules and generation time. Plus unit tests of the helpers, input
 *   normalisation and a golden fingerprint that detects any change of generated levels.
 *
 * Options (environment variables):
 *   ARROWGO_SKIP_TIMING=1   do not fail on the timing budget (slow CI machines)
 *   ARROWGO_LEVELS=500      test levels 1..500 only (quick run; golden check skipped)
 *   ARROWGO_DAILIES=30      test the first 30 dailies only (quick run; golden check skipped)
 */
'use strict';

const path = require('path');
const AL = require(path.join(__dirname, '..', 'levels.js'));

const LEVEL_COUNT = Number(process.env.ARROWGO_LEVELS) || 2000;
const DAILY_LIMIT = Number(process.env.ARROWGO_DAILIES) || 0; // 0 = all 730
const SKIP_TIMING = process.env.ARROWGO_SKIP_TIMING === '1';
const AVG_BUDGET_MS = 30;
const WORST_BUDGET_MS = 250;
// FNV-1a fingerprint over the JSON of levels 1..2000 and all 2026-2027 dailies.
// If this changes, existing players would see different levels: only update it when the
// change of every generated puzzle is intentional.
const GOLDEN = { levels: '2a0e25b6', daily: 'b53b45c0' };

let failures = 0;
const failLog = [];
function fail(msg) {
  failures++;
  if (failLog.length < 40) failLog.push(msg);
}
function check(cond, msg) {
  if (!cond) fail(msg);
  return !!cond;
}
function fnv(str, h) {
  h = h === undefined ? 0x811c9dc5 : h;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

/* ---------------------------------------------------------------------------------- *
 * Independent re-implementation of the movement rule (does not use levels.js helpers) *
 * ---------------------------------------------------------------------------------- */
const D = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
function rayOf(arrow, size) {
  const h = arrow.cells[arrow.cells.length - 1];
  const [dr, dc] = D[arrow.dir];
  const out = [];
  for (let r = h[0] + dr, c = h[1] + dc; r >= 0 && r < size && c >= 0 && c < size; r += dr, c += dc) out.push([r, c]);
  return out;
}
/** ids free in the given set of arrows. */
function freeSet(arrows, size) {
  const occ = new Map();
  for (const a of arrows) for (const [r, c] of a.cells) occ.set(r * size + c, a.id);
  const free = [];
  for (const a of arrows) if (rayOf(a, size).every(([r, c]) => !occ.has(r * size + c))) free.push(a.id);
  return free;
}
/** number of greedy waves to clear the board, -1 if stuck. */
function waveCount(arrows, size) {
  let rem = arrows.slice();
  let waves = 0;
  while (rem.length) {
    const f = new Set(freeSet(rem, size));
    if (!f.size) return -1;
    rem = rem.filter((a) => !f.has(a.id));
    waves++;
  }
  return waves;
}

/* ---------------------------------------------------------------------------------- *
 * Full validation of one puzzle                                                       *
 * ---------------------------------------------------------------------------------- */
function validatePuzzle(p, params, label, opts) {
  const size = p.size;
  const k = p.arrows.length;
  check(size === params.size, `${label}: size ${size} != ${params.size}`);
  check(k === params.arrows, `${label}: ${k} arrows != target ${params.arrows}`);
  check(Array.isArray(p.solution) && p.solution.length === k, `${label}: solution length`);

  // ids, shape
  const occ = new Map();
  let lenSum = 0;
  let maxLen = 0;
  for (let i = 0; i < k; i++) {
    const a = p.arrows[i];
    check(a.id === i, `${label}: arrows[${i}].id = ${a.id}`);
    check(['U', 'D', 'L', 'R'].includes(a.dir), `${label}: arrow ${a.id} bad dir ${a.dir}`);
    const n = a.cells.length;
    lenSum += n;
    maxLen = Math.max(maxLen, n);
    check(n >= params.minLen && n <= params.maxLen, `${label}: arrow ${a.id} length ${n} not in ${params.minLen}..${params.maxLen}`);
    for (let j = 0; j < n; j++) {
      const [r, c] = a.cells[j];
      check(Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < size && c >= 0 && c < size, `${label}: arrow ${a.id} cell out of bounds`);
      const key = r * size + c;
      check(!occ.has(key), `${label}: overlap at ${r},${c} (arrows ${occ.get(key)} and ${a.id})`);
      occ.set(key, a.id);
      if (j > 0) {
        const [pr, pc] = a.cells[j - 1];
        check(Math.abs(r - pr) + Math.abs(c - pc) === 1, `${label}: arrow ${a.id} cells ${j - 1},${j} not adjacent`);
      }
    }
    const h = a.cells[n - 1];
    const b = a.cells[n - 2];
    check(h[0] - b[0] === D[a.dir][0] && h[1] - b[1] === D[a.dir][1], `${label}: arrow ${a.id} dir ${a.dir} != last segment`);
  }

  // solution is a permutation of the ids
  const solSet = new Set(p.solution);
  check(solSet.size === k && p.solution.every((id) => Number.isInteger(id) && id >= 0 && id < k), `${label}: solution is not a permutation of ids`);

  check(AL.verify(p) === true, `${label}: verify() is false`);
  const solved = AL.solve(p.arrows, size);
  check(Array.isArray(solved) && solved.length === k, `${label}: solve() returned ${solved === null ? 'null' : 'bad order'}`);

  // independent replay of the solution with the movement rule
  {
    const left = new Map(occ);
    let ok = true;
    for (const id of p.solution) {
      const a = p.arrows[id];
      if (!a || rayOf(a, size).some(([r, c]) => left.has(r * size + c))) {
        ok = false;
        break;
      }
      for (const [r, c] of a.cells) left.delete(r * size + c);
    }
    check(ok && left.size === 0, `${label}: independent replay of solution failed`);
  }

  // placement property: reverse(solution) = placement order; each ray avoids every
  // earlier-placed arrow and its own body
  {
    const placed = new Set();
    let ok = true;
    for (let s = p.solution.length - 1; s >= 0 && ok; s--) {
      const a = p.arrows[p.solution[s]];
      const own = new Set(a.cells.map(([r, c]) => r * size + c));
      for (const [r, c] of rayOf(a, size)) {
        const key = r * size + c;
        if (placed.has(key) || own.has(key)) ok = false;
      }
      for (const key of own) placed.add(key);
    }
    check(ok, `${label}: placement property violated`);
  }

  // quality rules
  const free = freeSet(p.arrows, size).length;
  const waves = waveCount(p.arrows, size);
  check(waves > 0, `${label}: greedy waves stuck`);
  if (opts.level === 1) check(free === 1, `${label}: tutorial must have exactly 1 free arrow, has ${free}`);
  if (opts.level === null || opts.level >= 3) check(free < k, `${label}: no blocked arrow at the start`);
  if (k >= 15) {
    check(free * 100 <= 45 * k, `${label}: ${free}/${k} free at start (> 45%)`);
    check(waves >= 3, `${label}: only ${waves} waves`);
  }
  // ids must not reveal the solution as "highest id first" / "lowest id first"
  if (k >= 11) {
    const desc = p.solution.every((id, i) => id === k - 1 - i);
    const asc = p.solution.every((id, i) => id === i);
    check(!desc && !asc, `${label}: solution order is trivially visible from the ids`);
  }
  return { free, waves, avgLen: lenSum / k, maxLen, fill: lenSum / (size * size) };
}

/* ---------------------------------------------------------------------------------- *
 * 1. API surface and helper unit tests                                                *
 * ---------------------------------------------------------------------------------- */
function unitTests() {
  const fns = ['levelParams', 'generateLevel', 'generateDaily', 'exitRay', 'buildGrid', 'findBlocker', 'freeArrows', 'solve', 'verify', 'mulberry32', 'hashString'];
  for (const f of fns) check(typeof AL[f] === 'function', `API: ${f} missing`);
  check(JSON.stringify(AL.DIRS) === JSON.stringify({ U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] }), 'API: DIRS');
  check(globalThis.ArrowLevels === AL, 'API: UMD global ArrowLevels not set');

  // RNG / hash: deterministic, in range, pinned values (cross-platform drift detector)
  const r1 = AL.mulberry32(12345);
  const r2 = AL.mulberry32(12345);
  const seq = [];
  for (let i = 0; i < 1000; i++) {
    const v = r1();
    check(v === r2() && v >= 0 && v < 1, 'mulberry32: not deterministic / out of range');
    if (i < 3) seq.push(v);
  }
  check(JSON.stringify(seq) === JSON.stringify([0.9797282677609473, 0.3067522644996643, 0.484205421525985]), 'mulberry32: pinned sequence changed ' + JSON.stringify(seq));
  check(AL.hashString('arrowgo') === AL.hashString('arrowgo') && AL.hashString('a') !== AL.hashString('b'), 'hashString basic');
  check(AL.hashString('arrowgo:level:1:0') === 1203191103, 'hashString pinned value changed: ' + AL.hashString('arrowgo:level:1:0'));
  check(Number.isInteger(AL.hashString(undefined)) && AL.hashString({}) >= 0, 'hashString: non-string input');

  // exitRay / buildGrid / findBlocker on a hand-made 5x5 board
  //   . . . . .
  //   . . b > .      b = id 1: cells (1,2),(1,3), dir R   (free: ray = (1,4))
  //   . . ^ . .      a = id 0: cells (3,1),(3,2),(2,2), dir U
  //   . a a . .      a's ray = (1,2),(0,2): blocked by b at distance 0
  //   . . . . .
  const a = { id: 0, cells: [[3, 1], [3, 2], [2, 2]], dir: 'U' };
  const b = { id: 1, cells: [[1, 2], [1, 3]], dir: 'R' };
  check(JSON.stringify(AL.exitRay(a, 5)) === '[[1,2],[0,2]]', 'exitRay a');
  check(JSON.stringify(AL.exitRay(b, 5)) === '[[1,4]]', 'exitRay b');
  check(JSON.stringify(AL.exitRay({ id: 9, cells: [[0, 1], [0, 0]], dir: 'L' }, 5)) === '[]', 'exitRay at edge');
  const g = AL.buildGrid([a, b], 5);
  check(g.length === 5 && g[0].length === 5 && g[3][1] === 0 && g[1][3] === 1 && g[0][0] === -1, 'buildGrid');
  const blk = AL.findBlocker(a, g, 5);
  check(blk && blk.id === 1 && blk.distance === 0 && JSON.stringify(blk.cell) === '[1,2]', 'findBlocker distance 0: ' + JSON.stringify(blk));
  check(AL.findBlocker(b, g, 5) === null, 'findBlocker free');
  const b2 = { id: 1, cells: [[0, 2], [0, 3]], dir: 'R' }; // blocker one cell further
  const blk2 = AL.findBlocker(a, AL.buildGrid([a, b2], 5), 5);
  check(blk2 && blk2.id === 1 && blk2.distance === 1 && JSON.stringify(blk2.cell) === '[0,2]', 'findBlocker distance 1: ' + JSON.stringify(blk2));
  check(JSON.stringify(AL.freeArrows([a, b], 5)) === '[1]', 'freeArrows');
  check(JSON.stringify(AL.solve([a, b], 5)) === '[1,0]', 'solve order');
  check(AL.verify({ key: 't', level: 1, size: 5, arrows: [a, b], solution: [1, 0] }) === true, 'verify good');
  check(AL.verify({ key: 't', level: 1, size: 5, arrows: [a, b], solution: [0, 1] }) === false, 'verify wrong order');
  check(AL.verify({ key: 't', level: 1, size: 5, arrows: [a, b], solution: [1] }) === false, 'verify incomplete');
  check(AL.verify({ key: 't', level: 1, size: 5, arrows: [a, { id: 1, cells: [[3, 2], [3, 3]], dir: 'R' }], solution: [1, 0] }) === false, 'verify overlap');
  check(AL.verify({ key: 't', level: 1, size: 5, arrows: [{ id: 0, cells: [[0, 0], [0, 1]], dir: 'U' }], solution: [0] }) === false, 'verify dir mismatch');
  check(AL.verify(null) === false && AL.verify({}) === false, 'verify garbage');
  // deadlock: two arrows facing each other -> unsolvable
  const x = { id: 0, cells: [[2, 0], [2, 1]], dir: 'R' };
  const y = { id: 1, cells: [[2, 4], [2, 3]], dir: 'L' };
  check(AL.solve([x, y], 5) === null, 'solve deadlock -> null');
  check(AL.freeArrows([x, y], 5).length === 0, 'freeArrows deadlock');

  // levelParams follows the ARCHITECTURE.md table
  const P = AL.levelParams;
  const band = [[1, 1, 4, 2, 2], [2, 2, 5, 4, 4], [3, 5, 5, 5, 7], [6, 12, 6, 7, 11], [13, 22, 7, 11, 16], [23, 35, 8, 15, 22], [36, 60, 9, 22, 32]];
  for (const [n0, n1, size, lo, hi] of band) {
    check(P(n0).arrows === lo && P(n1).arrows === hi, `levelParams band ${n0}-${n1} endpoints`);
    for (let n = n0; n <= n1; n++) {
      check(P(n).size === size && P(n).arrows >= lo && P(n).arrows <= hi, `levelParams(${n})`);
      if (n > n0) check(P(n).arrows >= P(n - 1).arrows, `levelParams(${n}) not monotonic in band`);
    }
  }
  const seen61 = new Set();
  for (let n = 61; n <= 3000; n++) {
    const q = P(n);
    check(q.size === 9 && q.arrows >= 30 && q.arrows <= 36 && q.maxLen === 8, `levelParams(${n})`);
    seen61.add(q.arrows);
  }
  check(seen61.size === 7, 'levelParams 61+: not all of 30..36 used');
  check(P(1).maxLen === 4 && P(2).maxLen === 4 && P(25).maxLen === 8 && P(1).minLen === 2, 'maxLen ramp');
  for (let n = 2; n <= 60; n++) check(P(n).maxLen >= P(n - 1).maxLen, `maxLen ramp monotonic at ${n}`);
  check(JSON.stringify(P(1)) === JSON.stringify(P(1)) && JSON.stringify(P(99)) === JSON.stringify(P(99)), 'levelParams deterministic');

  // invalid input normalisation
  const L1 = JSON.stringify(AL.generateLevel(1));
  for (const bad of [0, -3, NaN, undefined, null, 'abc', {}, -Infinity, Symbol('x')]) {
    let p;
    try {
      p = AL.generateLevel(bad);
    } catch (e) {
      fail(`generateLevel(${String(bad)}) threw ${e.message}`);
      continue;
    }
    check(JSON.stringify(p) === L1 && p.level === 1, `generateLevel(${String(bad)}) should be level 1`);
  }
  check(JSON.stringify(AL.generateLevel(7.9)) === JSON.stringify(AL.generateLevel(7)), 'generateLevel(7.9) == level 7');
  check(JSON.stringify(AL.generateLevel('12')) === JSON.stringify(AL.generateLevel(12)), "generateLevel('12') == level 12");
  for (const bad of ['garbage', '', undefined, null, 20261006, '2026-1-1', '<script>', {}]) {
    let p;
    let q;
    try {
      p = AL.generateDaily(bad);
      q = AL.generateDaily(bad);
    } catch (e) {
      fail(`generateDaily(${String(bad)}) threw ${e.message}`);
      continue;
    }
    check(JSON.stringify(p) === JSON.stringify(q), `generateDaily(${String(bad)}) not deterministic`);
    check(AL.verify(p) && p.size === 10 && p.arrows.length >= 38 && p.arrows.length <= 42 && p.level === null, `generateDaily(${String(bad)}) invalid`);
    check(/^D[0-9A-Za-z_-]+$/.test(p.key), `generateDaily(${String(bad)}) unsafe key ${p.key}`);
  }
  const d = AL.generateDaily('2026-10-06');
  check(d.key === 'D2026-10-06' && d.level === null && d.size === 10, 'daily key/level/size');
  const l12 = AL.generateLevel(12);
  check(l12.key === 'L12' && l12.level === 12, 'level key/level');
}

/* ---------------------------------------------------------------------------------- *
 * 2. Bulk generation                                                                  *
 * ---------------------------------------------------------------------------------- */
function dailyDates() {
  const out = [];
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function groupOf(n) {
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  if (n <= 12) return '6-12';
  if (n <= 22) return '13-22';
  if (n <= 35) return '23-35';
  if (n <= 60) return '36-60';
  return '61-' + LEVEL_COUNT;
}

function newGroup() {
  return { count: 0, sizes: new Set(), minA: 99, maxA: 0, freeSum: 0, minWaves: 99, lenSum: 0, longBoards: 0, fillSum: 0, msSum: 0, msMax: 0 };
}
function addToGroup(G, p, m, t) {
  G.count++;
  G.sizes.add(p.size);
  G.minA = Math.min(G.minA, p.arrows.length);
  G.maxA = Math.max(G.maxA, p.arrows.length);
  G.freeSum += m.free / p.arrows.length;
  G.minWaves = Math.min(G.minWaves, m.waves);
  G.lenSum += m.avgLen;
  if (m.maxLen >= 5) G.longBoards++;
  G.fillSum += m.fill;
  G.msSum += t;
  G.msMax = Math.max(G.msMax, t);
}

function pad(s, n, right) {
  s = String(s);
  return right ? s.padEnd(n) : s.padStart(n);
}

function main() {
  const tStart = process.hrtime.bigint();
  unitTests();
  const unitFailures = failures;

  const groups = new Map();
  const samples = new Map();
  const SAMPLE_LEVELS = [1, 2, 5, 10, 20, 30, 40, 60, 100, 500];
  const attempts = {};
  let fallbacks = 0;
  let levelMsSum = 0;
  let levelMsMax = 0;
  let levelMsMaxN = 0;
  let hLevels = 0x811c9dc5;

  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const t0 = process.hrtime.bigint();
    const p = AL.generateLevel(n);
    const t = ms(t0);
    const at = AL._debug ? AL._debug.lastAttempt : 0;
    attempts[at] = (attempts[at] || 0) + 1;
    if (at < 0) fallbacks++;
    levelMsSum += t;
    if (t > levelMsMax) {
      levelMsMax = t;
      levelMsMaxN = n;
    }
    const json = JSON.stringify(p);
    check(JSON.stringify(AL.generateLevel(n)) === json, `L${n}: not deterministic`);
    check(p.key === 'L' + n && p.level === n, `L${n}: key/level`);
    hLevels = fnv(json, hLevels);
    const m = validatePuzzle(p, AL.levelParams(n), 'L' + n, { level: n });
    const gName = groupOf(n);
    if (!groups.has(gName)) groups.set(gName, newGroup());
    addToGroup(groups.get(gName), p, m, t);
    if (SAMPLE_LEVELS.includes(n)) samples.set('L' + n, { p, m, t });
  }

  const allDates = dailyDates();
  check(allDates.length === 730, 'daily date range should be 730 days');
  const dates = DAILY_LIMIT ? allDates.slice(0, DAILY_LIMIT) : allDates;
  let dailyMsSum = 0;
  let dailyMsMax = 0;
  let hDaily = 0x811c9dc5;
  const dailyG = newGroup();
  for (const date of dates) {
    const t0 = process.hrtime.bigint();
    const p = AL.generateDaily(date);
    const t = ms(t0);
    const at = AL._debug ? AL._debug.lastAttempt : 0;
    attempts[at] = (attempts[at] || 0) + 1;
    if (at < 0) fallbacks++;
    dailyMsSum += t;
    dailyMsMax = Math.max(dailyMsMax, t);
    const json = JSON.stringify(p);
    check(JSON.stringify(AL.generateDaily(date)) === json, `D${date}: not deterministic`);
    check(p.key === 'D' + date && p.level === null, `D${date}: key/level`);
    hDaily = fnv(json, hDaily);
    const params = AL.dailyParams(date);
    check(params.size === 10 && params.arrows >= 38 && params.arrows <= 42, `D${date}: dailyParams outside the table`);
    const m = validatePuzzle(p, params, 'D' + date, { level: null });
    addToGroup(dailyG, p, m, t);
    if (date === '2026-10-06' || (dates.length < 279 && date === dates[0])) samples.set('D' + date, { p, m, t });
  }
  groups.set('daily', dailyG);

  // budgets / fingerprints
  check(fallbacks === 0, `${fallbacks} puzzles needed the constructive fallback`);
  const levelAvg = levelMsSum / LEVEL_COUNT;
  if (!SKIP_TIMING) {
    check(levelAvg < AVG_BUDGET_MS, `generateLevel average ${levelAvg.toFixed(2)} ms >= ${AVG_BUDGET_MS} ms`);
    check(levelMsMax < WORST_BUDGET_MS, `generateLevel worst ${levelMsMax.toFixed(1)} ms (L${levelMsMaxN}) >= ${WORST_BUDGET_MS} ms`);
    check(dailyMsMax < WORST_BUDGET_MS, `generateDaily worst ${dailyMsMax.toFixed(1)} ms >= ${WORST_BUDGET_MS} ms`);
  }
  const fpLevels = hLevels.toString(16).padStart(8, '0');
  const fpDaily = hDaily.toString(16).padStart(8, '0');
  if (LEVEL_COUNT === 2000) {
    check(fpLevels === GOLDEN.levels, `golden fingerprint of levels 1..2000 changed: ${fpLevels} (expected ${GOLDEN.levels})`);
  }
  if (dates.length === 730) {
    check(fpDaily === GOLDEN.daily, `golden fingerprint of dailies changed: ${fpDaily} (expected ${GOLDEN.daily})`);
  }

  /* ---- report ---------------------------------------------------------------------- */
  console.log('\nArrowGO! levels.js test  -  levels 1..' + LEVEL_COUNT + ' + ' + dates.length + ' dailies (2026-01-01..2027-12-31)\n');
  console.log(
    [pad('group', 9, true), pad('boards', 6), pad('size', 5), pad('arrows', 7), pad('free%', 6), pad('minWav', 6), pad('avgLen', 6), pad('long5+', 6), pad('fill%', 6), pad('avgMs', 6), pad('maxMs', 6)].join(' ')
  );
  for (const [name, G] of groups) {
    console.log(
      [
        pad(name, 9, true),
        pad(G.count, 6),
        pad([...G.sizes].join('/'), 5),
        pad(G.minA === G.maxA ? G.minA : G.minA + '-' + G.maxA, 7),
        pad(((100 * G.freeSum) / G.count).toFixed(1), 6),
        pad(G.minWaves, 6),
        pad((G.lenSum / G.count).toFixed(2), 6),
        pad(Math.round((100 * G.longBoards) / G.count) + '%', 6),
        pad(((100 * G.fillSum) / G.count).toFixed(1), 6),
        pad((G.msSum / G.count).toFixed(2), 6),
        pad(G.msMax.toFixed(1), 6)
      ].join(' ')
    );
  }

  console.log('\nsample puzzles');
  console.log([pad('key', 12, true), pad('size', 4), pad('arrows', 6), pad('free', 5), pad('waves', 5), pad('avgLen', 6), pad('maxLen', 6), pad('ms', 6)].join(' '));
  for (const [key, s] of samples) {
    console.log(
      [pad(key, 12, true), pad(s.p.size, 4), pad(s.p.arrows.length, 6), pad(s.m.free, 5), pad(s.m.waves, 5), pad(s.m.avgLen.toFixed(2), 6), pad(s.m.maxLen, 6), pad(s.t.toFixed(2), 6)].join(' ')
    );
  }

  console.log('\ntiming   generateLevel avg ' + levelAvg.toFixed(2) + ' ms, worst ' + levelMsMax.toFixed(1) + ' ms (L' + levelMsMaxN + ')' + '  |  generateDaily avg ' + (dailyMsSum / dates.length).toFixed(2) + ' ms, worst ' + dailyMsMax.toFixed(1) + ' ms' + (SKIP_TIMING ? '  (budget not enforced)' : '  (budget avg < ' + AVG_BUDGET_MS + ', worst < ' + WORST_BUDGET_MS + ')'));
  console.log('attempts ' + JSON.stringify(attempts) + '  (attempt index -> puzzles; -1 = fallback)');
  console.log('golden   levels ' + fpLevels + '  daily ' + fpDaily);
  console.log('unit     ' + (unitFailures ? unitFailures + ' failure(s)' : 'ok'));
  console.log('total    ' + (ms(tStart) / 1000).toFixed(1) + ' s');

  if (failures) {
    console.log('\nFAIL: ' + failures + ' check(s) failed');
    for (const f of failLog) console.log('  - ' + f);
    if (failures > failLog.length) console.log('  ... ' + (failures - failLog.length) + ' more');
    process.exit(1);
  }
  console.log('\nPASS: all checks passed');
}

try {
  main();
} catch (e) {
  console.error('FAIL: test crashed:', e && e.stack ? e.stack : e);
  process.exit(1);
}

/* ══════════════════════════════════════════════════════════
   world.js — procedural track: obstacles, coins, pickups,
   scenery, and all of the environment drawing.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const C = SS.C;
  const { rand, randInt, pick, chance, clamp, lerp, mix, css, hex, TAU } = U;

  const LANES = C.LANES;
  const COIN_GAP = 2.3;

  /* liveries for trains */
  const LIVERY = [
    { body: hex('#c9d3e2'), stripe: hex('#e8433f') },
    { body: hex('#f2c33d'), stripe: hex('#2a2f3d') },
    { body: hex('#4a9be8'), stripe: hex('#d8e6f7') },
    { body: hex('#8ee06a'), stripe: hex('#25402a') },
    { body: hex('#e26fb0'), stripe: hex('#37223a') },
    { body: hex('#8b93a6'), stripe: hex('#ff7a2f') },
  ];

  const BARRIER_COL = hex('#ff8f2e');
  const RAMP_COL = hex('#3ddcff');
  const PILLAR_COL = hex('#7d8798');

  const PICKUPS = [
    { type: 'magnet', col: hex('#ff3d94'), icon: '🧲' },
    { type: 'jetpack', col: hex('#22e6ff'), icon: '🚀' },
    { type: 'sneakers', col: hex('#7dff8a'), icon: '👟' },
    { type: 'x2', col: hex('#ffce3d'), icon: '✖' },
    { type: 'warp', col: hex('#9a6bff'), icon: '⏳' },
  ];

  const W = {
    obstacles: [],
    coins: [],
    pickups: [],
    buildings: [],
    gantries: [],
    genZ: 0,
    lastPickupZ: 0,
    lastBoardZ: 0,
    rain: 0,

    reset() {
      this.obstacles.length = 0;
      this.coins.length = 0;
      this.pickups.length = 0;
      this.gantries.length = 0;
      this.genZ = 90;                 // calm opening stretch
      this.lastPickupZ = 120;
      this.lastBoardZ = 0;
      this.rain = 0;
      this.buildings.length = 0;
      for (let i = 0; i < 46; i++) this.buildings.push(this.newBuilding(rand(-30, 320)));
      this.gantryZ = 120;
    },

    newBuilding(z) {
      const side = chance(0.5) ? -1 : 1;
      const far = chance(0.5);
      const dist = far ? rand(26, 54) : rand(12, 22);
      const h = far ? rand(16, 54) : rand(5, 15);
      const g = rand(0.16, 0.34);
      return {
        x: side * (dist + rand(0, 4)),
        z: z,
        w: rand(6, 15),
        d: rand(7, 20),
        h: h,
        col: [g * 255 * rand(0.8, 1.15), g * 255 * rand(0.85, 1.1), g * 255 * rand(1.05, 1.4)],
        rows: randInt(3, 9),
        cols: randInt(2, 5),
        seed: (Math.random() * 1000) | 0,
        lit: rand(0.25, 1),
        roof: chance(0.4),
      };
    },

    /* ── generation ─────────────────────────────────────── */

    update(dt, travel, diff) {
      /* advance dynamic obstacles */
      const obs = this.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        if (o.vz) o.z -= o.vz * dt;
      }

      /* cull behind */
      const cut = travel + C.MINZ - 6;
      for (let i = obs.length - 1; i >= 0; i--) if (obs[i].z + obs[i].l < cut) obs.splice(i, 1);
      for (let i = this.coins.length - 1; i >= 0; i--) if (this.coins[i].z < cut) this.coins.splice(i, 1);
      for (let i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].z < cut) this.pickups.splice(i, 1);
      for (let i = this.gantries.length - 1; i >= 0; i--) if (this.gantries[i] < cut) this.gantries.splice(i, 1);

      /* recycle scenery */
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        if (b.z + b.d < cut) {
          const nb = this.newBuilding(travel + C.FAR + rand(0, 60));
          this.buildings[i] = nb;
        }
      }
      while (this.gantryZ < travel + C.FAR) {
        this.gantries.push(this.gantryZ);
        this.gantryZ += rand(70, 150);
      }

      /* generate ahead */
      let guard = 0;
      while (this.genZ < travel + C.FAR && guard++ < 40) {
        this.genZ += this.emit(this.genZ, diff, travel);
      }
    },

    /* helpers used by patterns */
    addTrain(lane, z, len, tall, moving) {
      const liv = pick(LIVERY);
      this.obstacles.push({
        kind: 'train', lane: lane, x: LANES[lane], y: 0, z: z,
        w: 2.35, h: tall ? 3.6 : 2.25, l: len,
        col: liv.body, stripe: liv.stripe, ride: true,
        vz: moving ? rand(16, 26) : 0, tall: tall, moving: !!moving,
      });
      return this.obstacles[this.obstacles.length - 1];
    },

    addBarrier(lane, z, mode) {
      // mode: 'jump' (low), 'roll' (overhead), 'block' (solid)
      const o = { kind: 'barrier', lane: lane, x: LANES[lane], z: z, w: 2.5, l: 0.9, col: BARRIER_COL, ride: false, mode: mode };
      if (mode === 'jump') { o.y = 0; o.h = 1.05; }
      else if (mode === 'roll') { o.y = 1.72; o.h = 1.9; o.legs = true; }
      else { o.y = 0; o.h = 3.5; }
      this.obstacles.push(o);
      return o;
    },

    addRamp(lane, z) {
      this.obstacles.push({
        kind: 'ramp', lane: lane, x: LANES[lane], y: 0, z: z,
        w: 2.4, h: 1.5, l: 4.4, col: RAMP_COL, ride: false, launch: true,
      });
    },

    addPillar(lane, z) {
      this.obstacles.push({
        kind: 'pillar', lane: lane, x: LANES[lane] + rand(-0.3, 0.3), y: 0, z: z,
        w: 1.05, h: 5.4, l: 1.05, col: PILLAR_COL, ride: false,
      });
    },

    addCoins(lane, z, n, y, arc) {
      for (let i = 0; i < n; i++) {
        let yy = y || 0.95;
        if (arc) yy = 0.95 + Math.sin((i / (n - 1 || 1)) * Math.PI) * 2.35;
        this.coins.push({ x: LANES[lane], y: yy, z: z + i * COIN_GAP, taken: false, ph: (z + i) * 0.7, mag: 0 });
      }
      return n * COIN_GAP;
    },

    addCoinsWave(z, n) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1 || 1);
        const x = Math.sin(t * Math.PI * 2) * C.LANE;
        this.coins.push({ x: x, y: 0.95, z: z + i * COIN_GAP, taken: false, ph: i * 0.7, mag: 0 });
      }
    },

    addPickup(lane, z, type, y) {
      this.pickups.push({
        type: type || pick(PICKUPS).type,
        x: LANES[lane], y: y == null ? 1.5 : y, z: z, taken: false, ph: rand(0, TAU),
      });
    },

    /** Emit one pattern at z; returns the length consumed. */
    emit(z, diff, travel) {
      const freeLane = randInt(0, 2);

      /* occasional guaranteed pickup */
      if (z - this.lastPickupZ > lerp(340, 220, diff)) {
        this.lastPickupZ = z;
        this.addPickup(randInt(0, 2), z + 14, null, 1.6);
      }

      const table = [
        { w: 26 - diff * 16, k: 'breather' },
        { w: 16, k: 'gates' },
        { w: 14, k: 'slalom' },
        { w: 16 + diff * 6, k: 'trains' },
        { w: 10 + diff * 8, k: 'convoy' },
        { w: 9 + diff * 5, k: 'rideTrain' },
        { w: 8 + diff * 4, k: 'rollTunnel' },
        { w: 7 + diff * 4, k: 'pillars' },
        { w: 5 + diff * 10, k: 'moving' },
        { w: 8, k: 'rampAir' },
        { w: 6 + diff * 8, k: 'gauntlet' },
      ];
      const kind = U.weighted(table).k;

      switch (kind) {
        /* ── open run with a coin treat ── */
        case 'breather': {
          const len = rand(34, 54);
          if (chance(0.55)) this.addCoinsWave(z + 6, 14);
          else this.addCoins(randInt(0, 2), z + 8, randInt(6, 12));
          if (chance(0.3)) this.addCoins(randInt(0, 2), z + 8, 7, 0, true);
          return len;
        }

        /* ── jump / roll gates across two or three lanes ── */
        case 'gates': {
          const mode = chance(0.55) ? 'jump' : 'roll';
          const all = chance(0.4 + diff * 0.4);
          for (let i = 0; i < 3; i++) {
            if (!all && i === freeLane) continue;
            this.addBarrier(i, z + 12, mode);
          }
          this.addCoins(all ? randInt(0, 2) : freeLane, z + 16, 7, mode === 'jump' ? undefined : 0.95, mode === 'jump');
          return rand(40, 52);
        }

        /* ── weave between solid blocks ── */
        case 'slalom': {
          let lane = freeLane;
          let zz = z + 10;
          const steps = randInt(3, 4 + (diff * 2) | 0);
          for (let i = 0; i < steps; i++) {
            const blocked = [0, 1, 2].filter((l) => l !== lane);
            for (const b of blocked) {
              if (chance(0.82)) this.addBarrier(b, zz, chance(0.35) ? 'jump' : 'block');
            }
            this.addCoins(lane, zz - 1, 3);
            const nexts = [0, 1, 2].filter((l) => Math.abs(l - lane) === 1);
            lane = pick(nexts);
            zz += rand(15, 20);
          }
          return zz - z + 12;
        }

        /* ── one or two stationary trains ── */
        case 'trains': {
          const len = rand(20, 34);
          const n = chance(0.45 + diff * 0.3) ? 2 : 1;
          const lanes = U.shuffle([0, 1, 2]).slice(0, n);
          for (const l of lanes) this.addTrain(l, z + 12, len, chance(0.55));
          const open = [0, 1, 2].filter((l) => lanes.indexOf(l) < 0);
          this.addCoins(pick(open), z + 12, Math.floor(len / COIN_GAP));
          return len + rand(26, 40);
        }

        /* ── long two-lane convoy: the classic squeeze ── */
        case 'convoy': {
          const len = rand(34, 56);
          const blocked = U.shuffle([0, 1, 2]).slice(0, 2);
          const open = [0, 1, 2].filter((l) => blocked.indexOf(l) < 0)[0];
          blocked.forEach((l, i) => this.addTrain(l, z + 12 + i * rand(0, 8), len, chance(0.6)));
          this.addCoins(open, z + 12, Math.floor(len / COIN_GAP));
          if (chance(0.4)) this.addBarrier(open, z + 12 + len * 0.55, chance(0.5) ? 'jump' : 'roll');
          return len + rand(30, 46);
        }

        /* ── low train you're meant to run along the top of ── */
        case 'rideTrain': {
          const len = rand(26, 42);
          const lane = randInt(0, 2);
          this.addRamp(lane, z + 8);
          const t = this.addTrain(lane, z + 15, len, false);
          this.addCoins(lane, z + 17, Math.floor((len - 4) / COIN_GAP), t.h + 0.85);
          if (chance(0.6)) {
            const other = pick([0, 1, 2].filter((l) => l !== lane));
            this.addTrain(other, z + 15, len * 0.8, true);
          }
          if (chance(0.4)) this.addPickup(lane, z + 18 + len * 0.5, null, t.h + 1.5);
          return len + rand(30, 44);
        }

        /* ── overhead bars: stay low ── */
        case 'rollTunnel': {
          let zz = z + 12;
          const n = randInt(3, 5);
          for (let i = 0; i < n; i++) {
            for (let l = 0; l < 3; l++) this.addBarrier(l, zz, 'roll');
            zz += rand(9, 13);
          }
          this.addCoins(randInt(0, 2), z + 12, Math.floor((zz - z - 12) / COIN_GAP), 0.75);
          return zz - z + 22;
        }

        /* ── narrow pillars ── */
        case 'pillars': {
          let zz = z + 12;
          const n = randInt(3, 5);
          for (let i = 0; i < n; i++) {
            const l = randInt(0, 2);
            this.addPillar(l, zz);
            const open = pick([0, 1, 2].filter((x) => x !== l));
            this.addCoins(open, zz - 2, 3);
            zz += rand(13, 19);
          }
          return zz - z + 18;
        }

        /* ── oncoming train, telegraphed ── */
        case 'moving': {
          const lane = randInt(0, 2);
          this.addTrain(lane, z + 90, rand(26, 44), true, true);
          const open = [0, 1, 2].filter((l) => l !== lane);
          this.addCoins(pick(open), z + 14, 10);
          return rand(46, 62);
        }

        /* ── ramp into a coin arc ── */
        case 'rampAir': {
          const lane = randInt(0, 2);
          this.addRamp(lane, z + 10);
          for (let i = 0; i < 12; i++) {
            this.coins.push({
              x: LANES[lane], y: 1.2 + Math.sin((i / 11) * Math.PI) * 4.4,
              z: z + 15 + i * COIN_GAP, taken: false, ph: i, mag: 0,
            });
          }
          if (chance(0.5)) this.addBarrier(lane, z + 22, 'roll');
          return rand(46, 60);
        }

        /* ── everything at once ── */
        case 'gauntlet': {
          let zz = z + 12;
          const len = rand(30, 44);
          const trainLane = randInt(0, 2);
          this.addTrain(trainLane, zz, len, chance(0.5));
          const rest = [0, 1, 2].filter((l) => l !== trainLane);
          let step = 0;
          for (let s = zz; s < zz + len; s += rand(12, 17)) {
            const l = rest[step % 2];
            this.addBarrier(l, s, pick(['jump', 'roll', 'block']));
            const other = rest[(step + 1) % 2];
            this.addCoins(other, s - 1, 3);
            step++;
          }
          return len + rand(30, 42);
        }
      }
      return 40;
    },

    /** Highest rideable surface under a point, 0 = ground. */
    supportAt(x, z, maxY) {
      let best = 0;
      const obs = this.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        if (!o.ride) continue;
        if (z < o.z - 0.5 || z > o.z + o.l + 0.5) continue;
        if (Math.abs(x - o.x) > o.w / 2 + 0.45) continue;
        const top = o.y + o.h;
        if (top <= maxY + 0.35 && top > best) best = top;
      }
      return best;
    },

    /* ══════════════ drawing ══════════════ */

    drawTrack(R, travel, time) {
      const th = R.theme;
      const SLAB = [C.MINZ, -2, 4, 11, 19, 29, 42, 60, 84, 116, 158, 205, C.FAR];

      /* gravel bed */
      for (let i = 0; i < SLAB.length - 1; i++) {
        const z0 = SLAB[i], z1 = SLAB[i + 1];
        const f = R.fogAt((z0 + z1) * 0.5);
        R.ground(-C.TRACK_HALF - 1.6, C.TRACK_HALF + 1.6, 0, z0, z1, R.col(th.gravel, 1, f));
      }

      /* sleepers */
      const tieGap = 2.6;
      const start = Math.ceil((travel + C.MINZ) / tieGap) * tieGap;
      const tieFar = 96;
      for (let wz = start; wz < travel + tieFar; wz += tieGap) {
        const z = wz - travel;
        if (z + 0.9 <= C.MINZ) continue;
        const f = R.fogAt(z);
        const fill = R.col(th.tie, 1, f);
        for (let l = 0; l < 3; l++) {
          R.ground(LANES[l] - 1.22, LANES[l] + 1.22, 0.03, z, z + 0.95, fill);
        }
      }

      /* rails + lane paint */
      for (let i = 0; i < SLAB.length - 1; i++) {
        const z0 = SLAB[i], z1 = SLAB[i + 1];
        const f = R.fogAt((z0 + z1) * 0.5);
        if (f >= 1) continue;
        const railTop = R.col(th.rail, 1.25, f);
        const railSide = R.col(th.rail, 0.55, f);
        for (let l = 0; l < 3; l++) {
          for (let s = -1; s <= 1; s += 2) {
            const rx = LANES[l] + s * 0.78;
            R.ground(rx - 0.09, rx + 0.09, 0.16, z0, z1, railTop);
            R.wall(rx + 0.09 * (LANES[l] > R.camX ? 1 : -1), 0, 0.16, z0, z1, railSide);
          }
        }
        /* hazard edge stripes */
        const edge = R.col(mix(hex('#f0d24a'), th.gravel, 0.35), 1, f);
        R.ground(-C.TRACK_HALF - 0.28, -C.TRACK_HALF, 0.05, z0, z1, edge);
        R.ground(C.TRACK_HALF, C.TRACK_HALF + 0.28, 0.05, z0, z1, edge);
      }

      /* side walls */
      for (let i = 0; i < SLAB.length - 1; i++) {
        const z0 = SLAB[i], z1 = SLAB[i + 1];
        const f = R.fogAt((z0 + z1) * 0.5);
        if (f >= 1) continue;
        for (let s = -1; s <= 1; s += 2) {
          const x = s * C.WALL_X;
          R.wall(x, 0, C.WALL_H, z0, z1, R.col(th.wall, s < 0 ? 0.86 : 0.7, f));
          R.wall(x, C.WALL_H - 0.32, C.WALL_H, z0, z1, R.col(th.wall, 1.5, f));
          R.ground(x - 0.55 * s, x, C.WALL_H, z0, z1, R.col(th.wall, 1.25, f));
        }
      }

      /* wall panels + lamps */
      const panelGap = 11;
      const p0 = Math.ceil((travel + C.MINZ) / panelGap) * panelGap;
      for (let wz = p0; wz < travel + 150; wz += panelGap) {
        const z = wz - travel;
        const f = R.fogAt(z);
        if (f >= 0.98) continue;
        const seed = ((wz / panelGap) | 0) * 2654435761 % 997;
        for (let s = -1; s <= 1; s += 2) {
          const x = s * (C.WALL_X - 0.02);
          const kind = (seed + (s > 0 ? 7 : 0)) % 5;
          if (kind === 0) {
            const g = mix(hex('#22e6ff'), hex('#ff3d94'), ((seed % 10) / 10));
            R.wall(x, 1.1, 3.0, z + 1.2, z + panelGap - 1.6, R.col(mix(th.wall, g, 0.25 + th.neon * 0.35), 1, f));
          } else if (kind === 1) {
            R.wall(x, 0.8, 2.6, z + 2, z + panelGap - 3, R.col(th.wall, 0.55, f));
          } else if (kind === 2 && th.neon > 0.2) {
            /* neon sign strip */
            const g = [34, 230, 255];
            R.wall(x, 2.6, 3.2, z + 1.5, z + panelGap - 2, css(mix(g, th.fog, f * f), 0.35 + th.neon * 0.55));
          }
        }

        /* lamp posts every other panel */
        if (((wz / panelGap) | 0) % 2 === 0) {
          for (let s = -1; s <= 1; s += 2) {
            const x = s * (C.WALL_X - 0.35);
            R.box(x, 0, z, 0.16, 4.9, 0.16, mix(th.wall, [40, 44, 60], 0.5), { amb: 0.8 });
            R.box(x - s * 0.35, 4.55, z - 0.1, 0.9, 0.22, 0.5, [70, 76, 92], {});
            const lampOn = th.neon > 0.18;
            if (lampOn && f < 0.9) {
              const p = R.project(x - s * 0.35, 4.5, z + 0.15);
              R.glow(p.x, p.y, p.s * 2.6, [255, 214, 140], (1 - f) * (0.12 + th.neon * 0.4));
            }
          }
        }
      }

      /* overhead gantries */
      for (let i = 0; i < this.gantries.length; i++) {
        const z = this.gantries[i] - travel;
        if (z < C.MINZ || z > C.FAR) continue;
        const gcol = mix(th.wall, [60, 66, 84], 0.6);
        R.box(0, 6.2, z, C.WALL_X * 2 + 1, 0.55, 0.7, gcol, {});
        R.box(-C.WALL_X - 0.2, 0, z, 0.35, 6.4, 0.5, gcol, {});
        R.box(C.WALL_X + 0.2, 0, z, 0.35, 6.4, 0.5, gcol, {});
        if (th.neon > 0.2 && R.fogAt(z) < 0.85) {
          const p = R.project(0, 5.95, z);
          R.glow(p.x, p.y, p.s * 1.4, [255, 90, 90], th.neon * 0.35);
        }
      }
    },

    drawBuildings(R, travel) {
      const th = R.theme;
      const B = this.buildings;
      /* far to near */
      const list = B.slice().sort((a, b) => b.z - a.z);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const z = b.z - travel;
        if (z + b.d < C.MINZ || z > C.FAR) continue;
        const f = R.fogAt(Math.max(z, 0));
        if (f >= 1) continue;
        const base = mix(b.col, th.wall, 0.35);
        const g = R.box(b.x, 0, z, b.w, b.h, b.d, base, { amb: 0.9 });
        if (b.roof) R.box(b.x, b.h, z + b.d * 0.3, b.w * 0.35, 1.8, b.d * 0.3, mix(base, [30, 34, 48], 0.4), {});
        /* windows on the near face */
        if (g && th.neon > 0.15 && R.quality === 'high' && f < 0.75 && z > 0) {
          const A = g.A, Bp = g.B, D = g.D;
          const wpx = Bp.x - A.x, hpx = D.y - A.y;
          if (wpx > 14 && Math.abs(hpx) > 14) {
            const cols = b.cols, rows = b.rows;
            const cw = wpx / (cols * 2 + 1), ch = hpx / (rows * 2 + 1);
            const ctx = R.ctx;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (((b.seed + r * 13 + c * 7) % 7) > 3) continue;
                const on = 0.25 + ((b.seed + r * 5 + c * 3) % 10) / 10 * 0.75;
                ctx.fillStyle = css(mix([255, 220, 150], th.fog, f * f), th.neon * on * 0.85 * b.lit);
                ctx.fillRect(A.x + cw * (c * 2 + 1), A.y + ch * (r * 2 + 1), cw, ch);
              }
            }
          }
        }
      }
    },

    /** Draw obstacles/coins/pickups whose relative z falls in [lo,hi), far→near. */
    drawEntities(R, travel, time, lo, hi) {
      const items = [];
      const obs = this.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const z = obs[i].z - travel;
        if (z + obs[i].l < lo || z >= hi) continue;
        items.push({ z: z, o: obs[i], t: 0 });
      }
      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (c.taken) continue;
        const z = c.z - travel;
        if (z < lo || z >= hi) continue;
        items.push({ z: z, o: c, t: 1 });
      }
      for (let i = 0; i < this.pickups.length; i++) {
        const p = this.pickups[i];
        if (p.taken) continue;
        const z = p.z - travel;
        if (z < lo || z >= hi) continue;
        items.push({ z: z, o: p, t: 2 });
      }
      items.sort((a, b) => b.z - a.z);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.t === 0) this.drawObstacle(R, it.o, it.z, time);
        else if (it.t === 1) this.drawCoin(R, it.o, it.z, time);
        else this.drawPickup(R, it.o, it.z, time);
      }
    },

    drawObstacle(R, o, z, time) {
      const th = R.theme;
      if (o.kind === 'train') {
        const f = R.fogAt(Math.max(z, 0));
        R.box(o.x, o.y, z, o.w, o.h, o.l, o.col, { amb: 1, outline: true });
        /* livery stripe down the side + a dark window band on the front */
        if (f < 0.9) {
          const y0 = o.h * 0.52, y1 = o.h * 0.72;
          const sideX = R.camX > o.x + o.w / 2 ? o.x + o.w / 2 : (R.camX < o.x - o.w / 2 ? o.x - o.w / 2 : null);
          if (sideX !== null) R.wall(sideX, y0, y1, Math.max(z, C.MINZ), z + o.l, R.col(o.stripe, 0.75, f));
          /* front windshield */
          R.face(o.x - o.w * 0.36, o.x + o.w * 0.36, o.h * 0.55, o.h * 0.84, Math.max(z, C.MINZ + 0.01),
            R.col(mix(o.stripe, [12, 18, 34], 0.75), 1, f));
          /* head/tail lights */
          if (z > 0 && f < 0.8) {
            const lc = o.moving ? [255, 240, 210] : [255, 90, 80];
            for (let s = -1; s <= 1; s += 2) {
              const p = R.project(o.x + s * o.w * 0.34, o.h * 0.28, z);
              R.glow(p.x, p.y, p.s * (o.moving ? 1.2 : 0.55), lc, o.moving ? 0.85 : 0.4 + th.neon * 0.3);
            }
          }
          /* roof detail */
          R.box(o.x, o.h, z + 1.2, o.w * 0.5, 0.28, Math.max(1, o.l - 2.4), mix(o.col, [20, 24, 34], 0.5), { amb: 0.9 });
        }
        return;
      }

      if (o.kind === 'barrier') {
        if (o.mode === 'roll') {
          R.box(o.x, o.y, z, o.w, o.h, o.l, o.col, { outline: true });
          /* legs */
          const legc = mix(o.col, [40, 40, 50], 0.6);
          R.box(o.x - o.w / 2 + 0.14, 0, z + 0.2, 0.22, o.y, 0.24, legc, {});
          R.box(o.x + o.w / 2 - 0.14, 0, z + 0.2, 0.22, o.y, 0.24, legc, {});
          this.hazardStripes(R, o, z, o.y + 0.15, o.y + o.h - 0.15);
        } else if (o.mode === 'block') {
          R.box(o.x, o.y, z, o.w, o.h, o.l, mix(o.col, [70, 74, 90], 0.55), { outline: true });
          this.hazardStripes(R, o, z, 0.3, o.h - 0.3);
        } else {
          R.box(o.x, o.y, z, o.w, o.h, o.l, o.col, { outline: true });
          this.hazardStripes(R, o, z, 0.15, o.h - 0.15);
        }
        return;
      }

      if (o.kind === 'ramp') {
        /* wedge: rising quad + sides */
        const zn = Math.max(z, C.MINZ);
        const f = R.fogAt(Math.max(z, 0));
        if (z + o.l <= C.MINZ) return;
        const a = R.project(o.x - o.w / 2, 0, zn + o.l);
        const b = R.project(o.x + o.w / 2, 0, zn + o.l);
        const c = R.project(o.x + o.w / 2, o.h, zn);
        const d = R.project(o.x - o.w / 2, o.h, zn);
        R.quad(a, b, c, d, R.col(o.col, 1.05, f));
        R.face(o.x - o.w / 2, o.x + o.w / 2, 0, o.h, zn, R.col(o.col, 0.55, f));
        const ctx = R.ctx;
        ctx.strokeStyle = R.col(o.col, 1.7, f, 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        if (f < 0.7) { const p = R.project(o.x, o.h, zn); R.glow(p.x, p.y, p.s * 0.9, o.col, 0.35); }
        return;
      }

      if (o.kind === 'pillar') {
        R.box(o.x, o.y, z, o.w, o.h, o.l, o.col, { outline: true });
        this.hazardStripes(R, o, z, 0.4, 2.2);
        return;
      }
    },

    hazardStripes(R, o, z, y0, y1) {
      const f = R.fogAt(Math.max(z, 0));
      if (f > 0.7 || z <= C.MINZ) return;
      const ctx = R.ctx;
      const A = R.project(o.x - o.w / 2, y1, Math.max(z, C.MINZ));
      const B = R.project(o.x + o.w / 2, y0, Math.max(z, C.MINZ));
      const w = B.x - A.x, h = B.y - A.y;
      if (w < 6 || h < 4) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(A.x, A.y, w, h); ctx.clip();
      ctx.fillStyle = R.col([28, 30, 40], 1, f, 0.85);
      const step = Math.max(6, w / 5);
      for (let x = -h; x < w + h; x += step * 2) {
        ctx.beginPath();
        ctx.moveTo(A.x + x, A.y + h);
        ctx.lineTo(A.x + x + step, A.y + h);
        ctx.lineTo(A.x + x + step + h, A.y);
        ctx.lineTo(A.x + x + h, A.y);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },

    drawCoin(R, c, z, time) {
      if (z <= C.MINZ + 0.2) return;
      const f = R.fogAt(Math.max(z, 0));
      if (f > 0.96) return;
      const p = R.project(c.x, c.y, z);
      const r = p.s * 0.42;
      if (r < 0.6) return;
      const spin = time * 5 + c.ph;
      const wx = Math.max(0.7, Math.abs(Math.cos(spin)) * r + r * 0.12);
      const ctx = R.ctx;
      const a = 1 - f;

      if (r > 2.5) {
        ctx.globalCompositeOperation = 'lighter';
        R.glow(p.x, p.y, r * 2.6, [255, 200, 60], 0.3 * a);
        ctx.globalCompositeOperation = 'source-over';
      }

      const ff = f * f;
      ctx.fillStyle = css(mix([228, 166, 30], R.theme.fog, ff), a);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, wx, r, 0, 0, TAU);
      ctx.fill();
      if (r > 3) {
        ctx.fillStyle = css(mix([255, 226, 120], R.theme.fog, ff), a);
        ctx.beginPath();
        ctx.ellipse(p.x - wx * 0.18, p.y - r * 0.14, wx * 0.62, r * 0.66, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(mix([176, 112, 12], R.theme.fog, ff), 0.75 * a);
        ctx.lineWidth = Math.max(0.8, r * 0.1);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, wx, r, 0, 0, TAU);
        ctx.stroke();
      }
    },

    drawPickup(R, pu, z, time) {
      if (z <= C.MINZ + 0.2) return;
      const f = R.fogAt(Math.max(z, 0));
      if (f > 0.96) return;
      const def = PICKUPS.find((d) => d.type === pu.type) || PICKUPS[0];
      const bob = Math.sin(time * 2.4 + pu.ph) * 0.22;
      const p = R.project(pu.x, pu.y + bob, z);
      const r = p.s * 0.62;
      if (r < 1) return;
      const ctx = R.ctx;
      const a = 1 - f;
      const rot = time * 2 + pu.ph;

      ctx.globalCompositeOperation = 'lighter';
      R.glow(p.x, p.y, r * 3.2, def.col, 0.4 * a);
      ctx.globalCompositeOperation = 'source-over';

      /* spinning capsule */
      ctx.save();
      ctx.translate(p.x, p.y);
      const sx = Math.cos(rot);
      ctx.scale(Math.max(0.16, Math.abs(sx)), 1);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, css(mix(def.col, [255, 255, 255], 0.55), a));
      g.addColorStop(1, css(U.shade(def.col, 0.55), a));
      ctx.fillStyle = g;
      const rr = r * 0.42;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-r, -r, r * 2, r * 2, rr);
      else ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = css([255, 255, 255], 0.5 * a);
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.stroke();
      ctx.restore();

      if (r > 7 && Math.abs(sx) > 0.35) {
        ctx.save();
        ctx.globalAlpha = a * Math.abs(sx);
        ctx.font = (r * 1.05 | 0) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, p.x, p.y + r * 0.06);
        ctx.restore();
      }
    },

    PICKUPS: PICKUPS,
  };

  SS.World = W;
})();

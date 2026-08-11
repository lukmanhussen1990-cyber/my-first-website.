/* ══════════════════════════════════════════════════════════
   player.js — runner physics + the articulated character
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const C = SS.C;
  const { clamp, lerp, damp, css, mix, hex, TAU } = U;

  /* ── unlockable runners ────────────────────────────────── */
  const CHARS = SS.CHARS = [
    {
      id: 'jet', name: 'Jet', cost: 0, blurb: 'Yard veteran. Balanced, fearless, always first through the gate.',
      perk: null, perkText: '',
      col: { shirt: '#22e6ff', pants: '#1b2440', skin: '#f2bb8d', hair: '#242a3d', shoe: '#ff3d94', pack: '#ff3d94', trim: '#0f6f8a' },
    },
    {
      id: 'nova', name: 'Nova', cost: 1500, blurb: 'Runs the drains for scrap. Somehow every coin is worth more to her.',
      perk: 'coin', perkText: '+15% coin value',
      col: { shirt: '#ff3d94', pants: '#2b1636', skin: '#8d5a3c', hair: '#ffce3d', shoe: '#22e6ff', pack: '#9a6bff', trim: '#7d1f52' },
    },
    {
      id: 'rook', name: 'Rook', cost: 3000, blurb: 'Never leaves the depot without a board strapped to his back.',
      perk: 'board', perkText: 'Free hoverboard each run',
      col: { shirt: '#7dff8a', pants: '#1a2b1e', skin: '#5c3a24', hair: '#131a14', shoe: '#ffce3d', pack: '#2f7d3c', trim: '#2f7d3c' },
    },
    {
      id: 'vex', name: 'Vex', cost: 5000, blurb: 'Counts the run in points, not metres. The score just moves faster.',
      perk: 'mult', perkText: '+1 base multiplier',
      col: { shirt: '#9a6bff', pants: '#160f2c', skin: '#efd7c2', hair: '#c94fff', shoe: '#22e6ff', pack: '#ffce3d', trim: '#4a2c8a' },
    },
    {
      id: 'zed', name: 'Zed', cost: 8000, blurb: 'Tinkers with everything he picks up. His power-ups just keep going.',
      perk: 'power', perkText: 'Power-ups last 30% longer',
      col: { shirt: '#ffce3d', pants: '#2c2411', skin: '#c98a5a', hair: '#5a3a18', shoe: '#7dff8a', pack: '#22e6ff', trim: '#8a6a12' },
    },
  ];
  SS.charById = (id) => CHARS.find((c) => c.id === id) || CHARS[0];

  /* ── physics ───────────────────────────────────────────── */
  const GRAV = 60;
  const JUMP_V = 19;
  const ROLL_TIME = 0.52;

  const P = {
    lane: 1, x: 0, y: 0, vy: 0,
    support: 0, onGround: true,
    state: 'run',              // run | air | roll
    rollT: 0, runPhase: 0,
    lean: 0, tilt: 0, squash: 1,
    coyote: 0, buffer: 0,
    height: 1.85,
    jumps: 0, rolls: 0, laneChanges: 0,
    board: false, boardT: 0,
    jet: false, jetT: 0,
    sneak: 0,
    invuln: 0,
    dead: false, deathT: 0, deathSpin: 0,
    char: CHARS[0],
    landedRecently: 0,

    reset(char) {
      this.lane = 1; this.x = 0; this.y = 0; this.vy = 0;
      this.support = 0; this.onGround = true;
      this.state = 'run'; this.rollT = 0; this.runPhase = 0;
      this.lean = 0; this.tilt = 0; this.squash = 1;
      this.coyote = 0; this.buffer = 0;
      this.jumps = this.rolls = this.laneChanges = 0;
      this.board = false; this.boardT = 0;
      this.jet = false; this.jetT = 0;
      this.sneak = 0; this.invuln = 0;
      this.dead = false; this.deathT = 0; this.deathSpin = 0;
      this.char = char || CHARS[0];
      this.height = 1.85;
    },

    get bodyH() { return this.state === 'roll' ? 0.95 : 1.85; },
    get halfW() { return 0.58; },

    /* ── intents ── */
    moveLane(dir) {
      if (this.dead) return;
      const n = clamp(this.lane + dir, 0, 2);
      if (n === this.lane) { this.tilt = dir * 0.16; return; }
      this.lane = n;
      this.laneChanges++;
      this.lean = dir * 1;
      SS.Audio.play('lane');
    },

    jump(force) {
      if (this.dead) return false;
      if (this.jet) return false;
      if (!this.onGround && this.coyote <= 0 && !force) { this.buffer = 0.16; return false; }
      const boost = this.sneak > 0 ? 1.36 : 1;
      this.vy = JUMP_V * boost;
      this.y += 0.02;
      this.onGround = false;
      this.coyote = 0;
      this.state = 'air';
      this.rollT = 0;
      this.squash = 0.78;
      this.jumps++;
      SS.Audio.play('jump');
      SS.FX.dust(this.x, this.support, 0, 8);
      return true;
    },

    roll() {
      if (this.dead || this.jet) return;
      if (this.onGround) {
        this.state = 'roll';
        this.rollT = ROLL_TIME;
        this.squash = 1.15;
        this.rolls++;
        SS.Audio.play('roll');
        SS.FX.dust(this.x, this.support, 0, 10);
      } else {
        // dive: slam down and roll on impact
        this.vy = Math.min(this.vy, -8) - 22;
        this.rollT = ROLL_TIME;
      }
    },

    launch(v) {
      this.vy = v;
      this.onGround = false;
      this.state = 'air';
      this.squash = 0.7;
      SS.FX.sparks(this.x, 1.2, 0, [60, 220, 255], 20, 1.3);
      SS.Audio.play('jump');
    },

    /* ── per-frame ── */
    update(dt, world, speed) {
      const targetX = C.LANES[this.lane];

      if (this.dead) {
        this.deathT += dt;
        this.deathSpin += dt * 7;
        this.y += this.vy * dt;
        this.vy -= GRAV * 0.6 * dt;
        if (this.y < 0) { this.y = 0; this.vy *= -0.3; }
        this.x = damp(this.x, targetX, 4, dt);
        return;
      }

      /* lateral */
      this.x = damp(this.x, targetX, this.jet ? 9 : 14, dt);
      const dx = targetX - this.x;
      this.lean = damp(this.lean, clamp(dx * 0.9, -1, 1), 11, dt);
      this.tilt = damp(this.tilt, 0, 8, dt);

      /* timers */
      if (this.invuln > 0) this.invuln -= dt;
      if (this.sneak > 0) this.sneak -= dt;
      if (this.landedRecently > 0) this.landedRecently -= dt;

      if (this.jet) {
        /* jetpack: hover at altitude */
        const target = 8.6;
        this.y = damp(this.y, target, 3.4, dt);
        this.vy = 0;
        this.state = 'air';
        this.onGround = false;
        this.runPhase += dt * 6;
        if (Math.random() < dt * 26) SS.FX.smoke(this.x, this.y - 0.1, 0.1, [255, 170, 80], 1);
        return;
      }

      /* vertical */
      const support = world.supportAt(this.x, 0, this.y + 0.6);
      this.support = support;

      if (!this.onGround) {
        this.vy -= GRAV * dt;
        this.y += this.vy * dt;
        if (this.y <= support && this.vy <= 0) {
          this.y = support;
          this.vy = 0;
          this.onGround = true;
          this.squash = 1.22;
          this.landedRecently = 0.2;
          SS.Audio.play('land');
          SS.FX.dust(this.x, support, 0, 7);
          if (this.rollT > 0) { this.state = 'roll'; this.rolls++; SS.Audio.play('roll'); }
          else this.state = 'run';
        }
        this.coyote = 0;
      } else {
        if (this.y > support + 0.12) {
          /* ran off the end of a train */
          this.onGround = false;
          this.coyote = 0.1;
          this.state = 'air';
          this.vy = 0;
        } else {
          this.y = support;
          if (this.coyote > 0) this.coyote -= dt;
        }
      }

      /* buffered jump */
      if (this.buffer > 0) {
        this.buffer -= dt;
        if (this.onGround) { this.buffer = 0; this.jump(); }
      }

      /* roll timer */
      if (this.state === 'roll') {
        this.rollT -= dt;
        if (this.rollT <= 0) { this.state = this.onGround ? 'run' : 'air'; this.rollT = 0; }
      } else if (this.onGround) {
        this.state = 'run';
      }

      /* animation */
      const cadence = clamp(speed / 34, 0.8, 2.3);
      if (this.state === 'run') this.runPhase += dt * 10.5 * cadence;
      else if (this.state === 'roll') this.runPhase += dt * 16;
      this.squash = damp(this.squash, 1, 12, dt);

      /* board / running dust */
      if (this.onGround && Math.random() < dt * 22) {
        SS.FX.dust(this.x + (Math.random() - 0.5) * 0.4, this.y, -0.3, 1);
      }
      if (this.board) {
        this.boardT -= dt;
        SS.FX.spawn(1, (p) => {
          p.x = this.x + (Math.random() - 0.5) * 0.7; p.y = this.y + 0.08; p.z = -0.4;
          p.vx = 0; p.vy = 1.2; p.vz = -10;
          p.life = 0.35; p.size = 0.13; p.add = true;
          p.col = [154, 107, 255];
        });
        if (this.boardT <= 0) { this.board = false; SS.FX.sparks(this.x, this.y + 0.2, 0, [154, 107, 255], 16, 1); }
      }
    },

    die(dir) {
      if (this.dead) return;
      this.dead = true;
      this.deathT = 0;
      this.vy = 9;
      this.state = 'air';
    },

    /* ══════════ drawing ══════════ */

    draw(R, time) {
      const s = R.scaleAt(0);
      const p = R.project(this.x, this.y, 0);
      const ctx = R.ctx;

      /* shadow */
      const shadowY = this.support;
      const sp = R.project(this.x, shadowY, 0.2);
      const lift = clamp((this.y - shadowY) / 5, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.4 * (1 - lift * 0.8)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, s * 0.62 * (1 - lift * 0.35), s * 0.2 * (1 - lift * 0.35), 0, 0, TAU);
      ctx.fill();

      /* magnet aura / invuln flicker */
      if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0 && !this.dead) {
        ctx.globalAlpha = 0.45;
      }

      const opts = {
        s: s, x: p.x, y: p.y,
        phase: this.runPhase,
        lean: this.lean * 0.34 + this.tilt,
        pose: this.dead ? 'dead' : (this.jet ? 'jet' : this.state),
        squash: this.squash,
        col: this.char.col,
        spin: this.deathSpin,
        board: this.board,
        time: time,
      };
      drawRunner(ctx, opts);
      ctx.globalAlpha = 1;
    },

    /** The inspector + hound looming in the foreground. */
    drawChaser(R, time, closeness) {
      if (closeness <= 0.01) return;
      const z = -4.4 - (1 - closeness) * 1.4;
      const s = R.scaleAt(z);
      const gx = lerp(this.chaseX == null ? this.x : this.chaseX, this.x, 0.2);
      this.chaseX = gx;
      const p = R.project(gx * 0.8 - 1.15, 0, z);
      const ctx = R.ctx;
      ctx.save();
      ctx.globalAlpha = clamp(closeness, 0, 1) * 0.95;
      drawRunner(ctx, {
        s: s, x: p.x, y: p.y,
        phase: this.runPhase * 0.92 + 1.1,
        lean: Math.sin(time * 2) * 0.06,
        pose: 'run', squash: 1,
        col: { shirt: '#1d2740', pants: '#12182a', skin: '#d8a67e', hair: '#0d1120', shoe: '#0b0f1c', pack: '#243354', trim: '#0b1230' },
        cap: true, time: time,
      });
      /* hound */
      const dp = R.project(gx * 0.8 + 2.3, 0, z + 0.6);
      const ds = R.scaleAt(z + 0.6);
      drawHound(ctx, dp.x, dp.y, ds, this.runPhase * 1.3);
      ctx.restore();
    },
  };

  /* ── character renderer ────────────────────────────────── */

  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawRunner(ctx, o) {
    const s = o.s, c = o.col;
    if (s < 2) return;
    const shirt = c.shirt, pants = c.pants, skin = c.skin, shoe = c.shoe, hair = c.hair, pack = c.pack;

    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.lean) ctx.rotate(o.lean * 0.35);

    if (o.pose === 'dead') {
      ctx.rotate(o.spin);
      ctx.translate(0, -0.5 * s);
    }

    const sq = o.squash || 1;
    ctx.scale(1 / Math.sqrt(sq), sq);

    /* hoverboard under the feet */
    if (o.board) {
      const bw = s * 0.95, bh = s * 0.16;
      const g = ctx.createLinearGradient(0, -bh, 0, bh);
      g.addColorStop(0, '#c9a6ff'); g.addColorStop(1, '#5a2fa8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.06, bw * 0.5, bh, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(154,107,255,.55)';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.2, bw * 0.42, bh * 1.5, 0, 0, TAU);
      ctx.fill();
      ctx.translate(0, -s * 0.16);
    }

    const P_ = {
      hipY: -0.92 * s,
      shoY: -1.44 * s,
      headY: -1.68 * s,
      hw: 0.17 * s,   // half hip width
      sw: 0.24 * s,   // half shoulder width
    };
    const legW = 0.19 * s, armW = 0.145 * s;

    if (o.pose === 'roll') {
      /* tucked ball */
      const r = 0.47 * s;
      ctx.save();
      ctx.translate(0, -r);
      ctx.rotate(o.phase * 0.85);
      /* curled torso */
      ctx.fillStyle = tint(shirt, 0.9);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      /* tucked legs wrap the lower half */
      ctx.fillStyle = pants;
      ctx.beginPath(); ctx.arc(0, 0, r, 0.35, Math.PI * 1.05); ctx.fill();
      /* backpack rides the shoulders */
      ctx.fillStyle = pack;
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, -r * 0.5, r * 0.46, r * 0.34, -0.7, 0, TAU);
      ctx.fill();
      /* head tucked in, shoes out front */
      ctx.fillStyle = tint(skin, 0.95);
      ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.44, r * 0.31, 0, TAU); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(r * 0.58, -r * 0.55, r * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = shoe;
      ctx.beginPath(); ctx.ellipse(r * 0.52, r * 0.5, r * 0.26, r * 0.19, 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.18, r * 0.72, r * 0.24, r * 0.18, 0.9, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }

    const air = o.pose === 'air' || o.pose === 'jet' || o.pose === 'dead';
    const ph = o.phase;
    const bob = air ? 0 : Math.sin(ph * 2) * 0.03 * s;

    ctx.translate(0, bob);

    /* ── legs (back view: lift + slight splay) ── */
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const lp = ph + (i === 0 ? 0 : Math.PI);
      let lift, splay, fwd;
      if (air) {
        lift = i === 0 ? 0.75 : 0.25;
        splay = side * 0.5;
        fwd = 0;
      } else {
        lift = Math.max(0, Math.sin(lp));
        splay = side * (0.5 + lift * 0.35);
        fwd = Math.sin(lp) * 0.09 * s;
      }
      const hx = side * P_.hw, hy = P_.hipY;
      const kneeX = hx + splay * 0.16 * s + fwd * 0.4;
      const kneeY = hy + 0.5 * s * (1 - 0.42 * lift);
      const footX = kneeX + splay * 0.06 * s + fwd * 0.5;
      const footY = kneeY + 0.46 * s * (1 - 0.55 * lift);
      const back = i === 0;
      const shade = back ? 0.72 : 1;
      limb(ctx, hx, hy, kneeX, kneeY, legW, tint(pants, shade));
      limb(ctx, kneeX, kneeY, footX, footY, legW * 0.86, tint(pants, shade * 0.94));
      /* shoe */
      ctx.fillStyle = tint(shoe, shade);
      ctx.beginPath();
      ctx.ellipse(footX, footY + legW * 0.16, legW * 0.62, legW * 0.44, 0, 0, TAU);
      ctx.fill();
    }

    /* ── torso ── */
    const torsoW = 0.5 * s, torsoH = 0.6 * s;
    const grad = ctx.createLinearGradient(-torsoW / 2, 0, torsoW / 2, 0);
    grad.addColorStop(0, tint(shirt, 0.75));
    grad.addColorStop(0.45, shirt);
    grad.addColorStop(1, tint(shirt, 0.6));
    ctx.fillStyle = grad;
    roundRect(ctx, -torsoW / 2, P_.shoY, torsoW, torsoH + 0.1 * s, 0.16 * s);
    ctx.fill();

    /* backpack */
    ctx.fillStyle = pack;
    roundRect(ctx, -0.2 * s, P_.shoY + 0.08 * s, 0.4 * s, 0.44 * s, 0.1 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    roundRect(ctx, -0.2 * s, P_.shoY + 0.26 * s, 0.4 * s, 0.09 * s, 0.04 * s);
    ctx.fill();

    /* jetpack flames */
    if (o.pose === 'jet') {
      ctx.fillStyle = 'rgba(255,180,60,.9)';
      for (let i = -1; i <= 1; i += 2) {
        const fl = (0.4 + Math.random() * 0.5) * s;
        ctx.beginPath();
        ctx.moveTo(i * 0.16 * s - 0.06 * s, P_.shoY + 0.5 * s);
        ctx.lineTo(i * 0.16 * s + 0.06 * s, P_.shoY + 0.5 * s);
        ctx.lineTo(i * 0.16 * s, P_.shoY + 0.5 * s + fl);
        ctx.closePath(); ctx.fill();
      }
    }

    /* ── arms ── */
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const ap = ph + (i === 0 ? Math.PI : 0);
      let sw;
      if (air) sw = -0.7 - (i === 0 ? 0.2 : 0);
      else sw = Math.sin(ap);
      const shx = side * P_.sw, shy = P_.shoY + 0.06 * s;
      const elX = shx + side * 0.1 * s;
      const elY = shy + 0.3 * s - sw * 0.1 * s;
      const hX = elX + side * (0.08 + Math.abs(sw) * 0.05) * s;
      const hY = elY + 0.3 * s - sw * 0.24 * s;
      const shade = i === 0 ? 0.72 : 1;
      limb(ctx, shx, shy, elX, elY, armW * 1.12, tint(shirt, shade * 0.92));
      limb(ctx, elX, elY, hX, hY, armW, tint(skin, shade));
    }

    /* ── head ── */
    const hr = 0.2 * s;
    ctx.fillStyle = tint(skin, 0.95);
    ctx.beginPath(); ctx.arc(0, P_.headY, hr, 0, TAU); ctx.fill();
    /* hair / cap from behind */
    ctx.fillStyle = o.cap ? '#16213c' : hair;
    ctx.beginPath();
    ctx.arc(0, P_.headY - hr * 0.12, hr * 1.02, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, P_.headY - hr * 0.05, hr * 1.0, hr * 0.8, 0, 0, TAU);
    ctx.fill();
    if (o.cap) {
      ctx.fillStyle = '#0e1730';
      roundRect(ctx, -hr * 1.15, P_.headY - hr * 0.15, hr * 2.3, hr * 0.3, hr * 0.14);
      ctx.fill();
    } else {
      /* headphones */
      ctx.fillStyle = c.trim || '#222';
      ctx.beginPath(); ctx.arc(-hr * 0.95, P_.headY, hr * 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hr * 0.95, P_.headY, hr * 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = c.trim || '#222';
      ctx.lineWidth = hr * 0.18;
      ctx.beginPath();
      ctx.arc(0, P_.headY, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    /* neck shadow */
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(0, P_.shoY + 0.01 * s, hr * 0.5, hr * 0.2, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawHound(ctx, x, y, s, ph) {
    if (s < 2) return;
    ctx.save();
    ctx.translate(x, y);
    const body = '#3a2b22', dark = '#241a14';
    const bob = Math.sin(ph * 2) * 0.03 * s;
    ctx.translate(0, bob);
    /* legs */
    for (let i = 0; i < 4; i++) {
      const lx = (i < 2 ? -1 : 1) * 0.18 * s;
      const lp = ph + i * 1.6;
      const lift = Math.max(0, Math.sin(lp)) * 0.2 * s;
      limb(ctx, lx, -0.42 * s, lx + (i % 2 ? 0.05 : -0.05) * s, -lift, 0.1 * s, dark);
    }
    ctx.fillStyle = body;
    roundRect(ctx, -0.26 * s, -0.72 * s, 0.52 * s, 0.36 * s, 0.14 * s);
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.86 * s, 0.19 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(-0.17 * s, -0.96 * s); ctx.lineTo(-0.06 * s, -1.12 * s); ctx.lineTo(-0.02 * s, -0.93 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.17 * s, -0.96 * s); ctx.lineTo(0.06 * s, -1.12 * s); ctx.lineTo(0.02 * s, -0.93 * s); ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const tintCache = Object.create(null);
  function tint(hexcol, m) {
    if (m === 1) return hexcol;
    const k = hexcol + '|' + m.toFixed(2);
    let v = tintCache[k];
    if (!v) {
      const c = hex(hexcol);
      v = tintCache[k] = css(U.shade(c, m));
    }
    return v;
  }

  SS.Player = P;
  SS.drawRunner = drawRunner;
})();

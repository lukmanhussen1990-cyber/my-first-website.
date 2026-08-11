/* ══════════════════════════════════════════════════════════
   particles.js — pooled 3D particle system + screen FX
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const { rand, css, clamp, TAU } = U;

  const MAX = 900;

  function Particle() {
    this.on = false;
    this.x = this.y = this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.life = this.max = 0;
    this.size = 1; this.grav = 0; this.drag = 0;
    this.col = [255, 255, 255];
    this.kind = 'dot';
    this.spin = 0; this.rot = 0;
    this.add = false;
  }

  const P = {
    pool: [],
    head: 0,
    budget: 1,

    init() {
      for (let i = 0; i < MAX; i++) this.pool.push(new Particle());
    },

    setQuality(q) {
      this.budget = q === 'low' ? 0.35 : q === 'med' ? 0.7 : 1;
    },

    alloc() {
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[(this.head + i) % MAX];
        if (!p.on) { this.head = (this.head + i + 1) % MAX; p.on = true; return p; }
      }
      return null;
    },

    clear() {
      for (let i = 0; i < MAX; i++) this.pool[i].on = false;
    },

    spawn(n, fn) {
      n = Math.max(1, Math.round(n * this.budget));
      for (let i = 0; i < n; i++) {
        const p = this.alloc();
        if (!p) return;
        p.kind = 'dot'; p.grav = 0; p.drag = 0; p.spin = 0; p.rot = 0; p.add = false; p.dim = 1;
        fn(p, i, n);
        p.max = p.life;
      }
    },

    /* ── presets ── */
    dust(x, y, z, amount) {
      this.spawn(amount || 6, (p) => {
        p.x = x + rand(-0.4, 0.4); p.y = y + rand(0, 0.2); p.z = z + rand(-0.4, 0.4);
        p.vx = rand(-2, 2); p.vy = rand(0.6, 3.4); p.vz = rand(-3, 1);
        p.life = rand(0.2, 0.42); p.size = rand(0.04, 0.11);
        p.grav = -7; p.drag = 2.6; p.dim = 0.4;
        p.col = [186, 196, 216];
      });
    },

    sparks(x, y, z, col, amount, power) {
      power = power || 1;
      this.spawn(amount || 14, (p) => {
        const a = rand(0, TAU), e = rand(-0.4, 1.2);
        p.x = x; p.y = y; p.z = z;
        p.vx = Math.cos(a) * rand(2, 9) * power;
        p.vy = (0.6 + e) * rand(3, 11) * power;
        p.vz = Math.sin(a) * rand(2, 9) * power - 4;
        p.life = rand(0.3, 0.8); p.size = rand(0.06, 0.2);
        p.grav = -16; p.drag = 1.1; p.add = true;
        p.col = col || [255, 210, 90];
      });
    },

    coinBurst(x, y, z) {
      this.spawn(10, (p) => {
        const a = rand(0, TAU);
        p.x = x; p.y = y; p.z = z;
        p.vx = Math.cos(a) * rand(1, 4.5);
        p.vy = rand(2, 7);
        p.vz = Math.sin(a) * rand(1, 4);
        p.life = rand(0.25, 0.5); p.size = rand(0.07, 0.16);
        p.grav = -14; p.add = true;
        p.col = [255, 216, 90];
      });
    },

    ring(x, y, z, col) {
      const p = this.alloc();
      if (!p) return;
      p.kind = 'ring'; p.x = x; p.y = y; p.z = z;
      p.vx = p.vy = p.vz = 0; p.grav = 0; p.drag = 0;
      p.life = p.max = 0.5; p.size = 0.4; p.add = true; p.col = col || [120, 230, 255];
    },

    smoke(x, y, z, col, amount) {
      this.spawn(amount || 5, (p) => {
        p.kind = 'smoke';
        p.x = x + rand(-0.22, 0.22); p.y = y; p.z = z;
        p.vx = rand(-0.8, 0.8); p.vy = rand(-1.4, 0.6); p.vz = rand(-1, 1);
        p.life = rand(0.22, 0.5); p.size = rand(0.16, 0.34);
        p.grav = 1.5; p.drag = 1.8;
        p.col = col || [230, 240, 255];
      });
    },

    confetti(x, y, z, amount) {
      this.spawn(amount || 22, (p) => {
        const a = rand(0, TAU);
        p.kind = 'flake';
        p.x = x; p.y = y; p.z = z;
        p.vx = Math.cos(a) * rand(2, 8); p.vy = rand(5, 13); p.vz = Math.sin(a) * rand(1, 6);
        p.life = rand(0.8, 1.5); p.size = rand(0.12, 0.26);
        p.grav = -13; p.drag = 0.6; p.spin = rand(-14, 14);
        p.col = U.pick([[255, 61, 148], [34, 230, 255], [255, 206, 61], [125, 255, 138], [154, 107, 255]]);
      });
    },

    rain(camZ) {
      this.spawn(3, (p) => {
        p.kind = 'rain';
        p.x = rand(-14, 14); p.y = rand(9, 16); p.z = rand(2, 90);
        p.vx = -1.5; p.vy = -44; p.vz = -8;
        p.life = 0.5; p.size = 0.5;
        p.col = [180, 210, 255];
      });
    },

    /* ── sim ── */
    update(dt, worldDz) {
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[i];
        if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt - worldDz;
        p.vy += p.grav * dt;
        if (p.drag) {
          const k = 1 - Math.min(1, p.drag * dt);
          p.vx *= k; p.vz *= k;
        }
        p.rot += p.spin * dt;
        if (p.y < 0 && p.kind !== 'smoke' && p.kind !== 'ring') {
          p.y = 0; p.vy *= -0.32; p.vx *= 0.7; p.vz *= 0.7;
          if (Math.abs(p.vy) < 0.6) p.vy = 0;
        }
        if (p.z < SS.C.MINZ - 2) p.on = false;
      }
    },

    draw(R) {
      const ctx = R.ctx;
      // draw additive particles last so glows stack nicely
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 1) ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < MAX; i++) {
          const p = this.pool[i];
          if (!p.on || (p.add ? 0 : 1) !== pass) continue;
          // near the camera the projection blows small sprites up to
          // screen-filling blobs — retire them before that happens
          if (p.z <= -2.6) continue;
          const s = R.project(p.x, p.y, p.z);
          if (s.x < -60 || s.x > R.W + 60 || s.y > R.H + 60) continue;
          const t = p.life / p.max;
          const f = R.fogAt(p.z);
          if (f > 0.94) continue;
          const a = clamp(t, 0, 1) * (1 - f);

          if (p.kind === 'ring') {
            const rr = (1 - t) * 2.6 * s.s * p.size;
            ctx.strokeStyle = css(p.col, a * 0.8);
            ctx.lineWidth = Math.max(1, s.s * 0.06 * t);
            ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.stroke();
          } else if (p.kind === 'rain') {
            ctx.strokeStyle = css(p.col, 0.3 * (1 - f));
            ctx.lineWidth = Math.max(0.7, s.s * 0.012);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x + s.s * 0.02, s.y + s.s * 0.34);
            ctx.stroke();
          } else if (p.kind === 'flake') {
            const w = p.size * s.s;
            ctx.save();
            ctx.translate(s.x, s.y); ctx.rotate(p.rot);
            ctx.fillStyle = css(p.col, a);
            ctx.fillRect(-w * 0.5, -w * 0.22, w, w * 0.44);
            ctx.restore();
          } else if (p.kind === 'smoke') {
            const rr = Math.min(70, p.size * s.s * (1.4 - t * 0.6));
            ctx.fillStyle = css(p.col, a * 0.22);
            ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.fill();
          } else {
            const rr = clamp(p.size * s.s * (0.6 + t * 0.6), 0.6, 40);
            ctx.fillStyle = css(p.col, a * (p.dim || 1));
            ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.fill();
          }
        }
        if (pass === 1) ctx.globalCompositeOperation = 'source-over';
      }
    },
  };

  P.init();
  SS.FX = P;
})();

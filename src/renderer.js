/**
 * Canvas renderer: pitch, stadium, players, ball and in-world overlays.
 * Everything is drawn in world metres and projected through a chase camera.
 */

import { BALL, PITCH, PLAYER, STATE } from './constants.js';
import { clamp, hashRandom, lerp } from './math.js';

const CROSSBAR = 2.44;
const GOAL_Y = PITCH.width / 2;

export class Renderer {
  constructor(canvas, match) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.match = match;
    this.camera = { x: PITCH.length / 2, y: GOAL_Y, scale: 16, targetScale: 16 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.showRadar = true;
    this.showNames = true;
    this.crowd = null;
    this.time = 0;
    this.shake = 0;
    this.resize();
  }

  setMatch(match) {
    this.match = match;
    this.camera.x = PITCH.length / 2;
    this.camera.y = GOAL_Y;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(240, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.width = w;
    this.height = h;
    // On a portrait screen the pitch is turned side-on so its length runs down
    // the display — otherwise a phone shows a sliver of grass and nothing else.
    this.rotated = h > w * 1.12;
    this.viewW = this.rotated ? h : w;
    this.viewH = this.rotated ? w : h;
    this.buildCrowd();
  }

  /**
   * Draws text upright even when the world is rotated for a portrait screen.
   */
  text(str, px, py, style = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(px, py);
    if (this.rotated) ctx.rotate(Math.PI / 2);
    ctx.font = style.font || '600 12px system-ui, sans-serif';
    ctx.textAlign = style.align || 'center';
    ctx.textBaseline = style.baseline || 'middle';
    if (style.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
    }
    if (style.alpha !== undefined) ctx.globalAlpha = style.alpha;
    ctx.fillStyle = style.fill || '#fff';
    ctx.fillText(str, 0, style.dy || 0);
    ctx.restore();
  }

  /** Static speckled crowd texture, generated once per resize. */
  buildCrowd() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#0b1220';
    g.fillRect(0, 0, 128, 128);
    const palette = ['#1c2740', '#243352', '#2f3f63', '#3b2c46', '#43384f', '#16203a'];
    for (let i = 0; i < 1400; i++) {
      const r = hashRandom(i * 3.1);
      const x = hashRandom(i * 7.7) * 128;
      const y = hashRandom(i * 11.3) * 128;
      g.fillStyle = palette[Math.floor(r * palette.length)];
      g.globalAlpha = 0.5 + r * 0.5;
      g.fillRect(x, y, 2.2, 2.2);
    }
    g.globalAlpha = 1;
    this.crowd = this.ctx.createPattern(c, 'repeat');
  }

  /** Metres → pixels for the current camera, in the (possibly rotated) view. */
  project(x, y) {
    const { camera } = this;
    return [
      (x - camera.x) * camera.scale + this.viewW / 2,
      (y - camera.y) * camera.scale + this.viewH / 2,
    ];
  }

  updateCamera(dt) {
    const { match, camera } = this;
    const ball = match.ball;
    const user = match.users[0];

    // Look slightly ahead of the ball so play comes towards the viewer.
    let tx = ball.x + clamp(ball.vx * 0.28, -7, 7);
    let ty = ball.y + clamp(ball.vy * 0.22, -5, 5);
    if (user && user.active) {
      tx = lerp(tx, user.active.x, 0.22);
      ty = lerp(ty, user.active.y, 0.22);
    }

    // Zoom: enough pitch on screen to read the shape of both teams, tighter
    // for set pieces and big moments.
    const fitScale = Math.min(this.viewW / 82, this.viewH / 50);
    let target = clamp(fitScale, 7, 26);
    if (match.state === STATE.PENALTY || match.state === STATE.GOAL) target *= 1.22;
    else if (match.state !== STATE.PLAYING) target *= 1.08;
    camera.targetScale = target;
    camera.scale += (camera.targetScale - camera.scale) * Math.min(1, dt * 3.2);

    const halfW = this.viewW / 2 / camera.scale;
    const halfH = this.viewH / 2 / camera.scale;
    const limitX = PITCH.length + PITCH.margin * 1.6;
    const limitY = PITCH.width + PITCH.margin * 1.6;
    const minX = -PITCH.margin * 1.6 + halfW;
    const maxX = limitX - halfW;
    const minY = -PITCH.margin * 1.6 + halfH;
    const maxY = limitY - halfH;
    tx = minX > maxX ? PITCH.length / 2 : clamp(tx, minX, maxX);
    ty = minY > maxY ? GOAL_Y : clamp(ty, minY, maxY);

    const follow = Math.min(1, dt * 4.5);
    camera.x += (tx - camera.x) * follow;
    camera.y += (ty - camera.y) * follow;

    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.time += dt;
  }

  draw() {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 6, (Math.random() - 0.5) * this.shake * 6);
    }

    ctx.save();
    if (this.rotated) {
      // Turn the world a quarter turn so +x runs up the screen.
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-this.viewW / 2, -this.viewH / 2);
    }
    this.drawStadium();
    this.drawPitch();
    this.drawGoals();
    this.drawEffects(false);
    this.drawSetPieceHints();
    this.drawPlayers();
    this.drawBall();
    this.drawEffects(true);
    ctx.restore();

    // Overlays live in true screen space, never rotated.
    this.drawOverlays();
    ctx.restore();
  }

  drawStadium() {
    const { ctx } = this;
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (!this.crowd) return;
    const [x0, y0] = this.project(-PITCH.margin * 1.7, -PITCH.margin * 1.7);
    const [x1, y1] = this.project(PITCH.length + PITCH.margin * 1.7, PITCH.width + PITCH.margin * 1.7);
    ctx.save();
    ctx.fillStyle = this.crowd;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    // Darken the stands so the pitch reads as the bright focus.
    ctx.fillStyle = 'rgba(6, 10, 20, 0.55)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();

    // Concrete apron between crowd and grass.
    ctx.fillStyle = '#132033';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  drawPitch() {
    const { ctx, camera } = this;
    const s = camera.scale;
    const [ox, oy] = this.project(0, 0);
    const w = PITCH.length * s;
    const h = PITCH.width * s;
    const m = PITCH.margin * s;

    // Grass surround.
    ctx.fillStyle = '#1f6b34';
    ctx.fillRect(ox - m, oy - m, w + m * 2, h + m * 2);

    // Mown stripes.
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2a7d3f' : '#24713a';
      ctx.fillRect(ox + (w / stripes) * i, oy, w / stripes + 1, h);
    }

    // Subtle light falloff towards the corners.
    const grad = ctx.createRadialGradient(
      ox + w / 2,
      oy + h / 2,
      Math.min(w, h) * 0.2,
      ox + w / 2,
      oy + h / 2,
      Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(ox - m, oy - m, w + m * 2, h + m * 2);

    // Markings.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.5, 0.12 * s);
    ctx.lineJoin = 'round';

    const line = (x1, y1, x2, y2) => {
      const [ax, ay] = this.project(x1, y1);
      const [bx, by] = this.project(x2, y2);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    const rect = (x, y, rw, rh) => {
      const [ax, ay] = this.project(x, y);
      ctx.strokeRect(ax, ay, rw * s, rh * s);
    };
    const circle = (x, y, r, fill = false) => {
      const [ax, ay] = this.project(x, y);
      ctx.beginPath();
      ctx.arc(ax, ay, r * s, 0, Math.PI * 2);
      if (fill) ctx.fill();
      else ctx.stroke();
    };

    rect(0, 0, PITCH.length, PITCH.width);
    line(PITCH.length / 2, 0, PITCH.length / 2, PITCH.width);
    circle(PITCH.length / 2, GOAL_Y, PITCH.centreCircle);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    circle(PITCH.length / 2, GOAL_Y, 0.2, true);

    for (const near of [true, false]) {
      const x = near ? 0 : PITCH.length - PITCH.penaltyAreaDepth;
      rect(x, GOAL_Y - PITCH.penaltyAreaWidth / 2, PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth);
      const gx = near ? 0 : PITCH.length - PITCH.goalAreaDepth;
      rect(gx, GOAL_Y - PITCH.goalAreaWidth / 2, PITCH.goalAreaDepth, PITCH.goalAreaWidth);
      const spotX = near ? PITCH.penaltySpot : PITCH.length - PITCH.penaltySpot;
      circle(spotX, GOAL_Y, 0.2, true);

      // The 'D': the part of the 9.15 m arc that sits outside the box.
      const [cx, cy] = this.project(spotX, GOAL_Y);
      const cut = Math.acos(
        clamp((PITCH.penaltyAreaDepth - PITCH.penaltySpot) / PITCH.centreCircle, -1, 1)
      );
      ctx.beginPath();
      const start = near ? -cut : Math.PI - cut;
      const end = near ? cut : Math.PI + cut;
      ctx.arc(cx, cy, PITCH.centreCircle * s, start, end, false);
      ctx.stroke();
    }

    // Corner arcs and flags.
    for (const [cx, cy, a0] of [
      [0, 0, 0],
      [PITCH.length, 0, Math.PI / 2],
      [PITCH.length, PITCH.width, Math.PI],
      [0, PITCH.width, -Math.PI / 2],
    ]) {
      const [px, py] = this.project(cx, cy);
      ctx.beginPath();
      ctx.arc(px, py, PITCH.cornerArc * s, a0, a0 + Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, 0.18 * s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGoals() {
    const { ctx, camera } = this;
    const s = camera.scale;
    for (const goalX of [0, PITCH.length]) {
      const dir = goalX === 0 ? -1 : 1;
      const [bx, by] = this.project(goalX, PITCH.goalTop);
      const [, by2] = this.project(goalX, PITCH.goalBottom);
      const depth = PITCH.goalDepth * s * dir;

      // Net.
      ctx.save();
      ctx.fillStyle = 'rgba(240, 248, 255, 0.14)';
      ctx.fillRect(bx, by, depth, by2 - by);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      const step = Math.max(4, 0.5 * s);
      ctx.beginPath();
      for (let x = 0; Math.abs(x) <= Math.abs(depth); x += step) {
        const px = bx + x * dir;
        ctx.moveTo(px, by);
        ctx.lineTo(px, by2);
      }
      for (let y = by; y <= by2; y += step) {
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + depth, y);
      }
      ctx.stroke();
      ctx.restore();

      // Posts and bar.
      ctx.strokeStyle = '#f2f6ff';
      ctx.lineWidth = Math.max(2.5, 0.2 * s);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by2);
      ctx.stroke();
    }
  }

  drawSetPieceHints() {
    const { ctx, match, camera } = this;
    const sp = match.setPiece;
    if (!sp) return;
    const s = camera.scale;
    const [x, y] = this.project(sp.x, sp.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, sp.keepOut * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawShadow(x, y, r, z = 0) {
    const { ctx, camera } = this;
    const s = camera.scale;
    const [px, py] = this.project(x, y);
    const spread = 1 + z * 0.16;
    ctx.save();
    ctx.globalAlpha = clamp(0.34 - z * 0.03, 0.08, 0.34);
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.ellipse(px + r * s * 0.35, py + r * s * 0.5, r * s * spread, r * s * 0.62 * spread, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayers() {
    const { ctx, match, camera } = this;
    const s = camera.scale;
    const all = [...match.home.players, ...match.away.players].sort((a, b) => a.y - b.y);

    for (const p of all) {
      const kit = p.isKeeper ? p.team.keeperKit : p.team.activeKit;
      const [px, py] = this.project(p.x, p.y);
      if (px < -60 || px > this.viewW + 60 || py < -60 || py > this.viewH + 60) continue;
      // Drawn a touch larger than the physical radius, and never so small the
      // shirt colour stops reading at a wide zoom.
      const r = Math.max(8, p.radius * s * 1.45);

      this.drawShadow(p.x, p.y, (p.radius * 1.45 * s < 8 ? 8 / s : p.radius * 1.45), 0);

      ctx.save();
      ctx.translate(px, py);

      // Control ring for the human-controlled player.
      if (p.controlledByUser) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
        ctx.save();
        ctx.strokeStyle = p.userIndex === 0 ? 'rgba(120, 230, 255, 0.95)' : 'rgba(255, 214, 102, 0.95)';
        ctx.lineWidth = Math.max(1.6, 0.08 * s);
        ctx.beginPath();
        ctx.ellipse(0, r * 0.5, r * (1.5 + pulse * 0.12), r * (0.9 + pulse * 0.08), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(p.heading);

      if (p.isSliding) {
        // Lying down: stretch the body along the direction of travel.
        ctx.save();
        ctx.fillStyle = kit.shirt;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.7, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = kit.shorts;
        ctx.beginPath();
        ctx.ellipse(-r * 0.85, 0, r * 0.7, r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Legs (little animated pistons so running reads clearly).
        const stride = Math.sin(this.time * 14 + p.id) * Math.min(p.speed / 8, 1);
        ctx.fillStyle = kit.shorts;
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 0.45, r * 0.34, r * 0.22, stride * 0.5, 0, Math.PI * 2);
        ctx.ellipse(r * 0.15, r * 0.45, r * 0.34, r * 0.22, -stride * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Torso.
        ctx.fillStyle = kit.shirt;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.95, r * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Shoulders / sleeves.
        ctx.fillStyle = kit.trim;
        ctx.beginPath();
        ctx.ellipse(-r * 0.05, -r * 0.72, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(-r * 0.05, r * 0.72, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head.
        ctx.fillStyle = '#e8b58c';
        ctx.beginPath();
        ctx.arc(r * 0.28, 0, r * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(20,12,8,0.75)';
        ctx.beginPath();
        ctx.arc(r * 0.16, 0, r * 0.36, -Math.PI / 2, Math.PI / 2, true);
        ctx.fill();
      }

      ctx.restore();

      // Shirt number.
      if (s > 9 && !p.isSliding) {
        this.text(String(p.number), px, py, {
          fill: kit.number,
          font: `700 ${Math.max(8, r * 0.72)}px "Segoe UI", system-ui, sans-serif`,
          alpha: 0.9,
        });
      }

      // Stamina arc for the controlled player.
      if (p.controlledByUser && s > 10) {
        const pct = p.stamina / PLAYER.staminaMax;
        ctx.save();
        ctx.strokeStyle = pct > 0.35 ? 'rgba(140, 240, 160, 0.9)' : 'rgba(255, 130, 110, 0.95)';
        ctx.lineWidth = Math.max(1.8, 0.07 * s);
        ctx.beginPath();
        ctx.arc(px, py, r * 1.9, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();
      }

      if (this.showNames && p.controlledByUser) {
        const label = p.name.split(' ').pop();
        const offset = r * 2.3;
        const [nx, ny] = this.rotated ? [px + offset, py] : [px, py - offset];
        this.text(label, nx, ny, {
          font: `600 ${Math.max(10, s * 0.5)}px "Segoe UI", system-ui, sans-serif`,
          fill: 'rgba(255,255,255,0.94)',
          shadow: true,
        });
      }
    }

    // Shot charge meter under the striker.
    for (const user of match.users) {
      if (!user.charging || !user.active) continue;
      const [px, py] = this.project(user.active.x, user.active.y);
      const w = 44;
      ctx.save();
      ctx.translate(px, py);
      if (this.rotated) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-w / 2, 22, w, 6);
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, '#7dd3fc');
      g.addColorStop(0.6, '#fbbf24');
      g.addColorStop(1, '#ef4444');
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2 + 1, 23, (w - 2) * user.charge, 4);
      ctx.restore();
    }
  }

  drawBall() {
    const { ctx, match, camera } = this;
    const ball = match.ball;
    const s = camera.scale;

    this.drawShadow(ball.x, ball.y, BALL.radius * 2.2, ball.z);

    // Motion trail.
    if (ball.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, BALL.radius * s);
      ctx.beginPath();
      for (let i = 0; i < ball.trail.length; i++) {
        const t = ball.trail[i];
        const [tx, ty] = this.project(t.x, t.y - t.z * 0.55);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.restore();
    }

    const [px, py] = this.project(ball.x, ball.y - ball.z * 0.55);
    const r = Math.max(4.2, BALL.radius * s * (1 + ball.z * 0.06) * 2.8);
    ctx.save();
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, r * 0.15, px, py, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.75, '#f0f0f0');
    g.addColorStop(1, '#b9c0c8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 22, 14, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Panel hint that spins with travel.
    ctx.fillStyle = 'rgba(20,24,32,0.8)';
    for (let i = 0; i < 3; i++) {
      const a = ball.rotation + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * r * 0.42, py + Math.sin(a) * r * 0.42, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEffects(foreground) {
    const { ctx, camera } = this;
    const s = camera.scale;
    for (const e of this.match.effects) {
      const alpha = clamp(e.life / e.maxLife, 0, 1);
      const [px, py] = this.project(e.x, e.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (e.type === 'ring' && !foreground) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, (1 - alpha) * 1.8 * s + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'burst' && !foreground) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const d = (1 - alpha) * 1.4 * s;
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, 2.2 * alpha + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'confetti' && foreground) {
        ctx.fillStyle = e.colour || '#fff';
        ctx.fillRect(px, py, 3.5, 5.5);
      }
      ctx.restore();
    }
  }

  drawOverlays() {
    if (this.showRadar && !this.rotated) this.drawRadar();
  }

  drawRadar() {
    const { ctx, match } = this;
    const w = Math.min(190, this.width * 0.26);
    const h = (w * PITCH.width) / PITCH.length;
    const x = this.width - w - 16;
    const y = this.height - h - 16;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(8, 20, 14, 0.78)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();

    const toRadar = (wx, wy) => [x + (wx / PITCH.length) * w, y + (wy / PITCH.width) * h];
    for (const team of match.teams) {
      ctx.fillStyle = team.activeKit.shirt;
      for (const p of team.players) {
        const [rx, ry] = toRadar(p.x, p.y);
        ctx.beginPath();
        ctx.arc(rx, ry, p.controlledByUser ? 3.4 : 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (p.controlledByUser) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }
    const [bx, by] = toRadar(match.ball.x, match.ball.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

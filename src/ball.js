import { BALL, PITCH } from './constants.js';
import { clamp } from './math.js';

/**
 * The ball is simulated in 3D: x/y across the pitch, z for height. Height
 * matters for lofted passes, keeper claims and whether a shot clears the bar.
 */
export class Ball {
  constructor() {
    this.reset(PITCH.length / 2, PITCH.width / 2);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.spin = 0;
    this.rotation = 0;
    this.owner = null;
    this.lastTouch = null;
    this.lastTouchSide = null;
    this.lastShooter = null;
    this.trail = [];
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get airborne() {
    return this.z > 0.02;
  }

  /** Apply an impulse in world units. `spin` curls the flight sideways. */
  kick(vx, vy, vz = 0, spin = 0) {
    const speed = Math.hypot(vx, vy);
    if (speed > BALL.maxSpeed) {
      const s = BALL.maxSpeed / speed;
      vx *= s;
      vy *= s;
    }
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.spin = spin;
    this.owner = null;
  }

  stop() {
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.spin = 0;
  }

  update(dt) {
    // Curl: accelerate perpendicular to travel, proportional to spin & speed.
    const speed = this.speed;
    if (Math.abs(this.spin) > 0.001 && speed > 0.5) {
      const nx = -this.vy / speed;
      const ny = this.vx / speed;
      const magnus = BALL.curl * this.spin * speed;
      this.vx += nx * magnus * dt;
      this.vy += ny * magnus * dt;
      this.spin -= this.spin * BALL.spinDecay * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.z > 0 || this.vz !== 0) {
      this.vz -= BALL.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        if (Math.abs(this.vz) > 0.6) {
          this.vz = -this.vz * BALL.bounce;
          // Bouncing scrubs some horizontal pace off the ball.
          this.vx *= 0.86;
          this.vy *= 0.86;
        } else {
          this.vz = 0;
        }
      }
    }

    const drag = this.airborne ? BALL.airDrag : BALL.drag;
    const decay = Math.exp(-drag * dt * (this.airborne ? 1 : 1 + 0.6 / (1 + speed)));
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) < 0.08 && !this.airborne) {
      this.vx = 0;
      this.vy = 0;
      this.spin = 0;
    }

    this.rotation += speed * dt * 1.6;

    this.trail.push({ x: this.x, y: this.y, z: this.z, life: 0.28 });
    if (this.trail.length > 24) this.trail.shift();
    for (const t of this.trail) t.life -= dt;
    while (this.trail.length && this.trail[0].life <= 0) this.trail.shift();
  }

  /** Keep the ball inside a generous box; the match rules handle real outs. */
  clampToWorld() {
    const m = PITCH.margin;
    this.x = clamp(this.x, -m, PITCH.length + m);
    this.y = clamp(this.y, -m, PITCH.width + m);
  }
}

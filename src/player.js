import { PLAYER, KEEPER, PITCH } from './constants.js';
import { clamp, normalise, turnTowards } from './math.js';

let nextId = 1;

export class Player {
  constructor(spec, side, team) {
    this.id = nextId++;
    this.side = side;
    this.team = team;
    this.name = spec.name;
    this.number = spec.number;
    this.role = spec.role;
    this.tag = spec.tag;
    this.slot = spec.slot;
    this.attributes = spec.attributes;
    this.isKeeper = spec.role === 'GK';
    this.radius = this.isKeeper ? KEEPER.radius : PLAYER.radius;

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.heading = side === 0 ? 0 : Math.PI;
    this.stamina = PLAYER.staminaMax;
    this.kickCooldown = 0;
    this.tackleCooldown = 0;
    this.slideTimer = 0;
    this.diveTimer = 0;
    this.diveCooldown = 0;
    this.diveDir = 0;
    this.holdTimer = 0;
    this.stunTimer = 0;
    this.celebrateTimer = 0;
    this.controlledByUser = false;
    this.userIndex = -1;
    this.aiTimer = 0;
    this.aiTargetX = 0;
    this.aiTargetY = 0;
    this.aiSprint = false;
    this.markTarget = null;
    this.runBias = 0;
    this.intent = { mx: 0, my: 0, sprint: false };
    this.stats = { goals: 0, assists: 0, passes: 0, tackles: 0, saves: 0, shots: 0 };
  }

  get pace() {
    return 0.86 + (this.attributes.pace / 100) * 0.28;
  }

  get maxSpeed() {
    const staminaFactor = 0.82 + 0.18 * (this.stamina / PLAYER.staminaMax);
    const base = this.intent.sprint ? PLAYER.sprintSpeed : PLAYER.runSpeed;
    return base * this.pace * staminaFactor;
  }

  get isSliding() {
    return this.slideTimer > 0;
  }

  get isDiving() {
    return this.diveTimer > 0;
  }

  get isActive() {
    return this.stunTimer <= 0;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  reachRadius(ball) {
    if (this.isKeeper) {
      // Keepers can claim high balls with their hands inside their own area.
      const inBox = this.isInsideOwnBox();
      const base = inBox ? KEEPER.reach : PLAYER.reach;
      return this.isDiving ? base + 0.75 : base;
    }
    if (this.isSliding) return PLAYER.reach + 0.85;
    // Slightly shorter reach for balls above head height.
    return ball && ball.z > 1.9 ? PLAYER.reach * 0.7 : PLAYER.reach;
  }

  isInsideOwnBox() {
    const inY =
      this.y > PITCH.width / 2 - PITCH.penaltyAreaWidth / 2 &&
      this.y < PITCH.width / 2 + PITCH.penaltyAreaWidth / 2;
    if (!inY) return false;
    return this.side === 0 ? this.x < PITCH.penaltyAreaDepth : this.x > PITCH.length - PITCH.penaltyAreaDepth;
  }

  startSlide() {
    if (this.isKeeper || this.tackleCooldown > 0 || this.isSliding || this.stunTimer > 0) return false;
    const [dx, dy] = normalise(Math.cos(this.heading), Math.sin(this.heading));
    this.slideTimer = PLAYER.slideDuration;
    this.tackleCooldown = PLAYER.tackleCooldown + PLAYER.slideDuration;
    this.vx = dx * PLAYER.slideSpeed;
    this.vy = dy * PLAYER.slideSpeed;
    this.stamina = Math.max(0, this.stamina - 6);
    return true;
  }

  startDive(dirY, power = 1) {
    if (!this.isKeeper || this.diveCooldown > 0) return false;
    this.diveTimer = KEEPER.diveDuration;
    this.diveCooldown = KEEPER.diveDuration + KEEPER.diveCooldown;
    this.diveDir = Math.sign(dirY) || 1;
    this.vy = this.diveDir * KEEPER.diveSpeed * power;
    return true;
  }

  update(dt) {
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    this.tackleCooldown = Math.max(0, this.tackleCooldown - dt);
    this.diveCooldown = Math.max(0, this.diveCooldown - dt);
    this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vx *= Math.exp(-6 * dt);
      this.vy *= Math.exp(-6 * dt);
    } else if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      const decay = Math.exp(-3.4 * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (this.slideTimer <= 0) {
        // Getting back up costs a beat.
        this.stunTimer = 0.28;
      }
    } else if (this.diveTimer > 0) {
      this.diveTimer -= dt;
      this.vx *= Math.exp(-2.2 * dt);
      this.vy *= Math.exp(-1.4 * dt);
    } else {
      const wantMag = Math.hypot(this.intent.mx, this.intent.my);
      const max = this.maxSpeed;
      if (wantMag > 0.05) {
        const [nx, ny] = normalise(this.intent.mx, this.intent.my);
        const targetSpeed = max * Math.min(1, wantMag);
        const desiredVx = nx * targetSpeed;
        const desiredVy = ny * targetSpeed;
        const ax = desiredVx - this.vx;
        const ay = desiredVy - this.vy;
        const aMag = Math.hypot(ax, ay);
        const maxAccel = PLAYER.accel * dt * (0.75 + 0.25 * (this.attributes.physical / 100));
        if (aMag > maxAccel) {
          this.vx += (ax / aMag) * maxAccel;
          this.vy += (ay / aMag) * maxAccel;
        } else {
          this.vx = desiredVx;
          this.vy = desiredVy;
        }
        this.heading = turnTowards(this.heading, Math.atan2(ny, nx), PLAYER.turnRate * dt);
      } else {
        const decay = PLAYER.decel * dt;
        const s = this.speed;
        if (s > 0) {
          const f = Math.max(0, s - decay) / s;
          this.vx *= f;
          this.vy *= f;
        }
      }
      if (this.speed > 0.4) {
        this.heading = turnTowards(this.heading, Math.atan2(this.vy, this.vx), PLAYER.turnRate * dt);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const sprinting = this.intent.sprint && this.speed > PLAYER.runSpeed * 0.7;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    } else {
      const rate = this.speed < 1.5 ? PLAYER.staminaRegen * 1.6 : PLAYER.staminaRegen * 0.5;
      this.stamina = Math.min(PLAYER.staminaMax, this.stamina + rate * dt);
    }

    // Players may leave the pitch a little but not disappear into the stands.
    const m = PITCH.margin - 1;
    this.x = clamp(this.x, -m, PITCH.length + m);
    this.y = clamp(this.y, -m, PITCH.width + m);
  }

  /** Send the player towards a world point; returns distance remaining. */
  seek(x, y, speedScale = 1, sprint = false) {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.25) {
      this.intent.mx = 0;
      this.intent.my = 0;
      this.intent.sprint = false;
      return d;
    }
    const slow = clamp(d / 2.2, 0.25, 1);
    this.intent.mx = (dx / d) * speedScale * slow;
    this.intent.my = (dy / d) * speedScale * slow;
    this.intent.sprint = sprint && this.stamina > 8;
    return d;
  }

  idle() {
    this.intent.mx = 0;
    this.intent.my = 0;
    this.intent.sprint = false;
  }
}

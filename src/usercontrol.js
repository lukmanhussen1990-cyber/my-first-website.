/**
 * Translates a Controller into football: player switching, passing, shooting
 * with a charge meter, through balls, tackles and slides.
 */

import { PITCH, PLAYER, STATE } from './constants.js';
import { clamp, dist, lerp, normalise } from './math.js';
import { evaluatePasses, timeToBall } from './ai.js';
import { passBall, shootBall } from './actions.js';

const GOAL_Y = PITCH.width / 2;
const MAX_CHARGE = 1.05;

export class UserController {
  constructor(team, controller, match, index = 0) {
    this.team = team;
    this.controller = controller;
    this.match = match;
    this.index = index;
    this.active = null;
    this.switchLock = 0;
    this.charge = 0;
    this.chargeKind = null;
    this.lastSwitchTime = 0;
  }

  get charging() {
    return this.chargeKind !== null;
  }

  /** Selects the player the human is steering. */
  pickActive(preferBall = true) {
    const ball = this.match.ball;
    const carrier = this.match.carrier;
    if (carrier && carrier.team === this.team && !carrier.isKeeper) return carrier;
    const candidates = this.team.players.filter((p) => !p.isKeeper && p.isActive);
    if (!candidates.length) return this.team.keeper;
    if (!preferBall && this.active) return this.active;
    candidates.sort((a, b) => timeToBall(a, ball) - timeToBall(b, ball));
    return candidates[0];
  }

  setActive(player) {
    if (this.active === player) return;
    if (this.active) {
      this.active.controlledByUser = false;
      this.active.userIndex = -1;
    }
    this.active = player;
    if (player) {
      player.controlledByUser = true;
      player.userIndex = this.index;
    }
  }

  /** Cycle to the next sensible player (nearest to ball, then by distance). */
  switchPlayer() {
    const ball = this.match.ball;
    const options = this.team.players
      .filter((p) => p.isActive && p !== this.active)
      .sort((a, b) => timeToBall(a, ball) - timeToBall(b, ball));
    if (!options.length) return;
    // Prefer an outfielder unless the keeper is genuinely the closest by far.
    const outfield = options.filter((p) => !p.isKeeper);
    const pick = outfield.length ? outfield[0] : options[0];
    this.setActive(pick);
    this.switchLock = 0.35;
    this.match.audio.play('switch');
  }

  update(dt) {
    const { match, controller } = this;
    const ball = match.ball;
    this.switchLock = Math.max(0, this.switchLock - dt);

    const playable = match.state === STATE.PLAYING || match.isSetPieceFor(this.team);

    // Auto-switch to whoever is best placed, unless the human is on the ball.
    const carrier = match.carrier;
    if (!this.active || !this.active.isActive) {
      this.setActive(this.pickActive());
    } else if (carrier && carrier.team === this.team && carrier !== this.active && !carrier.isKeeper) {
      this.setActive(carrier);
    } else if (!carrier && this.switchLock <= 0) {
      const best = this.pickActive();
      const activeTime = timeToBall(this.active, ball);
      const bestTime = timeToBall(best, ball);
      if (best !== this.active && bestTime < activeTime - 0.55 && !this.active.isSliding) {
        this.setActive(best);
      }
    }

    const p = this.active;
    if (!p) return;

    if (!playable) {
      p.idle();
      this.charge = 0;
      this.chargeKind = null;
      return;
    }

    const hasBall = carrier === p;

    // ---- movement -------------------------------------------------
    if (p.isActive && !p.isSliding) {
      p.intent.mx = controller.x;
      p.intent.my = controller.y;
      p.intent.sprint = controller.sprint.down && p.stamina > 2;
      if (!controller.hasDirection) {
        p.intent.mx = 0;
        p.intent.my = 0;
      }
    }

    // ---- charging -------------------------------------------------
    if (this.chargeKind) {
      this.charge = clamp(this.charge + dt / MAX_CHARGE, 0, 1);
    }

    if (hasBall) {
      if (controller.shoot.pressed && p.kickCooldown <= 0) {
        this.chargeKind = 'shoot';
        this.charge = 0.12;
      }
      if (controller.shoot.released && this.chargeKind === 'shoot') {
        this.releaseShot(p, ball);
      }
      if (controller.pass.pressed && p.kickCooldown <= 0) {
        this.playPass(p, ball, false);
      }
      if (controller.through.pressed && p.kickCooldown <= 0) {
        this.playPass(p, ball, true);
      }
    } else {
      this.chargeKind = null;
      this.charge = 0;
      if (controller.pass.pressed && this.switchLock <= 0) this.switchPlayer();
      if (controller.shoot.pressed) this.tryStandingTackle(p);
      if (controller.through.pressed) this.trySlide(p);
    }
  }

  releaseShot(player, ball) {
    const charge = clamp(this.charge, 0.18, 1);
    this.chargeKind = null;
    this.charge = 0;
    if (this.match.carrier !== player) return;

    const goalX = this.team.goalX;
    // The stick nudges the aim within the goal frame.
    const aimY = clamp(
      GOAL_Y + this.controller.y * (PITCH.goalWidth / 2 + 1.1),
      PITCH.goalTop + 0.35,
      PITCH.goalBottom - 0.35
    );
    const d = dist(ball.x, ball.y, goalX, aimY);
    const skill = player.attributes.shooting / 100;
    // Long shots and shots taken at full sprint are harder to keep down.
    const accuracy = clamp(
      0.94 - Math.max(0, d - 16) * 0.008 - Math.min(player.speed, 9) * 0.006 + skill * 0.06,
      0.55,
      0.985
    );
    const curl = clamp(this.controller.x * (this.team.attackDir > 0 ? 1 : -1) * -1.6, -2.2, 2.2);
    shootBall(player, ball, goalX, aimY, { charge, accuracy, curl });
    this.team.stats.shots++;
    player.stats.shots++;
    this.match.onShot(player, { x: goalX, y: aimY, distance: d });
  }

  playPass(player, ball, through) {
    const { match } = this;
    const options = evaluatePasses(player, ball, this.team, match.opponentOf(this.team), match.difficulty);
    if (!options.length) return;

    let chosen = options[0];
    if (this.controller.hasDirection) {
      const [dx, dy] = normalise(this.controller.x, this.controller.y);
      let best = null;
      let bestScore = -Infinity;
      for (const opt of options) {
        const [ox, oy] = normalise(opt.tx - player.x, opt.ty - player.y);
        const alignment = ox * dx + oy * dy;
        if (alignment < 0.1) continue;
        const score = alignment * 2.6 + opt.score * 0.55 - opt.distance * 0.012;
        if (score > bestScore) {
          bestScore = score;
          best = opt;
        }
      }
      if (best) chosen = best;
    }

    const accuracy = clamp(0.8 + (player.attributes.passing / 100) * 0.22, 0.6, 0.99);
    this.team.stats.passes++;
    player.stats.passes++;

    if (through) {
      // Play it into the space the receiver is running into.
      const dir = this.team.attackDir;
      const mate = chosen.mate;
      const runX = mate.x + dir * clamp(6 + Math.hypot(mate.vx, mate.vy) * 1.4, 6, 16);
      const runY = mate.y + mate.vy * 0.6;
      const target = {
        x: clamp(runX, 1, PITCH.length - 1),
        y: clamp(runY, 1, PITCH.width - 1),
      };
      const blocked = chosen.clearance < 1.6;
      passBall(player, ball, target, { lofted: blocked, accuracy: accuracy * 0.95, power: 1.1 });
      match.onPass(player, mate, true);
    } else {
      passBall(player, ball, { x: chosen.tx, y: chosen.ty }, {
        lofted: chosen.lofted,
        accuracy,
        power: 1,
      });
      match.onPass(player, chosen.mate);
    }
  }

  tryStandingTackle(player) {
    const carrier = this.match.carrier;
    if (!carrier || carrier.team === this.team) return;
    if (dist(player.x, player.y, carrier.x, carrier.y) > PLAYER.reach + 1.4) return;
    this.match.attemptTackle(player, carrier, false, true);
  }

  trySlide(player) {
    if (player.startSlide()) this.match.audio.play('slide');
  }
}

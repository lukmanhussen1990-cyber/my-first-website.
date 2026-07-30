/**
 * The match: rules, restarts, clock, fouls, goals and the simulation loop that
 * ties players, ball and AI together.
 */

import {
  BALL,
  DIFFICULTY,
  KEEPER,
  MATCH,
  PITCH,
  PLAYER,
  SIDE,
  STATE,
} from './constants.js';
import { clamp, dist, lerp, normalise, rand, noise } from './math.js';
import { Ball } from './ball.js';
import { Team } from './team.js';
import { resolveKits } from './teams.js';
import { updateTeamAI, timeToBall, predictBall, evaluatePasses } from './ai.js';
import { UserController } from './usercontrol.js';
import { clearBall, dribble, passBall, shootBall, strikeBall, groundPassSpeed } from './actions.js';

const GOAL_Y = PITCH.width / 2;
const CROSSBAR = 2.44;

export class Match {
  constructor(config) {
    this.config = config;
    this.audio = config.audio;
    this.difficulty = DIFFICULTY[config.difficulty] || DIFFICULTY.normal;
    this.rules = { offside: true, fouls: true, ...(config.rules || {}) };
    this.halfSeconds = config.halfSeconds || MATCH.halfSecondsOptions[1];

    this.ball = new Ball();
    this.home = new Team(config.homeTeam, SIDE.HOME, { isUser: config.userSides.includes(0) });
    this.away = new Team(config.awayTeam, SIDE.AWAY, { isUser: config.userSides.includes(1) });
    this.teams = [this.home, this.away];
    this.home.match = this;
    this.away.match = this;
    // Change strip if the two first-choice kits would be hard to tell apart.
    this.away.activeKit = resolveKits(config.homeTeam, config.awayTeam);

    this.users = config.userSides.map(
      (side, i) => new UserController(this.teams[side], config.controllers[i], this, i)
    );

    this.state = STATE.KICKOFF;
    this.stateTimer = 0;
    this.half = 1;
    this.clock = 0;
    this.stoppage = 0;
    this.running = true;
    this.paused = false;
    this.events = [];
    this.banner = null;
    this.setPiece = null;
    this.lastGoal = null;
    this.kickoffSide = SIDE.HOME;
    this.replayFocus = null;
    this.effects = [];
    this.commentary = [];
    this.shootout = null;
    this.finished = false;
    this.onFinish = config.onFinish || (() => {});
    this.excitement = 0.25;
    this.possessionTicks = [0, 0];
    this.lastPassBy = null;
    this.lastPassTime = -99;

    for (const t of this.teams) {
      for (const p of t.players) p.runBias = ((p.id * 37) % 100) / 260;
    }

    this.prepareKickoff(SIDE.HOME, true);
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  get carrier() {
    return this.ball.owner;
  }

  opponentOf(team) {
    return team === this.home ? this.away : this.home;
  }

  /**
   * `side` is geometric: side 0 attacks +x. Teams swap sides at half time, so
   * this resolves through the team's current side rather than home/away.
   */
  teamBySide(side) {
    return this.home.side === side ? this.home : this.away;
  }

  isUserTeam(team) {
    return this.users.some((u) => u.team === team);
  }

  userFor(team) {
    return this.users.find((u) => u.team === team) || null;
  }

  isSetPieceFor(team) {
    return Boolean(
      this.setPiece && this.setPiece.side === team.side && this.setPiece.ready
    );
  }

  get displayMinute() {
    const perHalf = MATCH.displayMinutesPerHalf;
    const base = (this.half - 1) * perHalf;
    const played = (this.clock / this.halfSeconds) * perHalf;
    return Math.min(base + played, base + perHalf + this.stoppage);
  }

  formattedClock() {
    const total = this.displayMinute;
    const mins = Math.floor(total);
    const secs = Math.floor((total - mins) * 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  notify(text, options = {}) {
    this.banner = { text, timer: options.duration || 2.4, kind: options.kind || 'info' };
  }

  logEvent(type, text, side = null) {
    const entry = { minute: Math.floor(this.displayMinute), type, text, side };
    this.events.push(entry);
    this.commentary.unshift(entry);
    if (this.commentary.length > 5) this.commentary.pop();
  }

  addEffect(effect) {
    this.effects.push({ life: effect.life ?? 0.6, maxLife: effect.life ?? 0.6, ...effect });
  }

  /* ---------------------------------------------------------------- */
  /* Restarts                                                          */
  /* ---------------------------------------------------------------- */

  prepareKickoff(side, initial = false) {
    this.state = STATE.KICKOFF;
    this.kickoffSide = side;
    this.holdingKeeper = null;
    this.pendingOffsideCheck = null;
    this.pendingAssist = null;
    this.lastPassBy = null;
    this.lastShot = null;
    this.ball.reset(PITCH.length / 2, GOAL_Y);
    if (initial) this.firstKickoffTeam = this.teamBySide(side);
    for (const team of this.teams) team.resetPlayers(this.ball, side);
    const taker = this.teamBySide(side).nearestTo(PITCH.length / 2, GOAL_Y, (p) => !p.isKeeper);
    this.setPiece = {
      type: 'kickoff',
      side,
      x: PITCH.length / 2,
      y: GOAL_Y,
      taker,
      timer: initial ? 1.4 : 1.8,
      ready: false,
      keepOut: MATCH.kickoffRestartDistance,
    };
    const user = this.userFor(this.teamBySide(side));
    if (user && taker) user.setActive(taker);
  }

  setupRestart(type, side, x, y, extra = {}) {
    const team = this.teamBySide(side);
    this.holdingKeeper = null;
    this.pendingOffsideCheck = null;
    this.lastShot = null;
    this.state =
      type === 'throw_in'
        ? STATE.THROW_IN
        : type === 'goal_kick'
        ? STATE.GOAL_KICK
        : type === 'corner'
        ? STATE.CORNER
        : type === 'penalty'
        ? STATE.PENALTY
        : STATE.FREE_KICK;

    this.ball.reset(x, y);
    this.ball.lastTouchSide = null;

    let taker;
    if (type === 'goal_kick') {
      taker = team.keeper;
    } else if (type === 'penalty') {
      taker = team.players
        .filter((p) => !p.isKeeper)
        .sort((a, b) => b.attributes.shooting - a.attributes.shooting)[0];
    } else {
      taker = team.nearestTo(x, y, (p) => !p.isKeeper);
    }

    this.setPiece = {
      type,
      side,
      x,
      y,
      taker,
      timer: type === 'penalty' ? 2.4 : 1.5,
      ready: false,
      keepOut: type === 'throw_in' ? 4 : MATCH.restartDistance,
      ...extra,
    };

    const user = this.userFor(team);
    if (user && taker) user.setActive(taker);
  }

  /**
   * Shape both teams up for a restart: formation positions, plus bodies in the
   * box when there is a delivery coming in.
   */
  positionForRestart() {
    const sp = this.setPiece;
    if (!sp) return;
    for (const team of this.teams) {
      const attacking = sp.side === team.side;
      const inFinalThird =
        Math.abs(sp.x - team.goalX) < PITCH.length * 0.3 ||
        Math.abs(sp.x - team.ownGoalX) < PITCH.length * 0.3;
      const crowdBox = (sp.type === 'corner' || sp.type === 'free_kick') && inFinalThird;
      let boxIndex = 0;
      for (const p of team.players) {
        if (p === sp.taker) continue;
        let x;
        let y;
        if (crowdBox && !p.isKeeper && p.slot.x > 0.12) {
          // Attackers arrive in the box; defenders drop in to mark them.
          const goalX = attacking ? team.goalX : team.ownGoalX;
          const dir = attacking ? team.attackDir : -team.attackDir;
          const depth = 5 + (boxIndex % 4) * 3.1 + (attacking ? 0 : 1.4);
          const spread = ((boxIndex % 5) - 2) * 3.6;
          x = goalX - dir * depth;
          y = GOAL_Y + spread;
          boxIndex++;
        } else {
          [x, y] = team.shapePosition(p, this.ball, attacking);
        }
        p.seek(x, y, 0.85, false);
      }
    }
  }

  /** Position players sensibly while a restart is being set up. */
  updateRestart(dt) {
    const sp = this.setPiece;
    if (!sp) return;
    sp.timer -= dt;

    const takingTeam = this.teamBySide(sp.side);
    const other = this.opponentOf(takingTeam);
    const taker = sp.taker;

    // The ball stays put until it is struck.
    this.ball.x = sp.x;
    this.ball.y = sp.y;
    this.ball.z = 0;
    this.ball.stop();
    this.ball.owner = null;

    // Everyone else keeps their distance.
    for (const team of this.teams) {
      for (const p of team.players) {
        if (p === taker) continue;
        const d = dist(p.x, p.y, sp.x, sp.y);
        const keepOut = team === other ? sp.keepOut : sp.type === 'penalty' ? sp.keepOut : 1.6;
        if (d < keepOut) {
          const [nx, ny] = normalise(p.x - sp.x || rand(1, -1), p.y - sp.y || rand(1, -1));
          p.seek(sp.x + nx * (keepOut + 1.2), sp.y + ny * (keepOut + 1.2), 1, false);
        }
      }
    }

    if (sp.type === 'penalty') {
      // Everyone except taker and keeper waits outside the box.
      for (const team of this.teams) {
        for (const p of team.players) {
          if (p === taker || p.isKeeper) continue;
          const outX = sp.side === SIDE.HOME
            ? PITCH.length - PITCH.penaltyAreaDepth - 4
            : PITCH.penaltyAreaDepth + 4;
          const spread = ((p.id % 7) - 3) * 3.2;
          p.seek(outX, GOAL_Y + spread, 0.8, false);
        }
      }
      const keeper = other.keeper;
      keeper.seek(other.ownGoalX + other.attackDir * 0.4, GOAL_Y, 0.6, false);
    }

    if (taker) {
      // Stand just behind the ball, facing the direction of play.
      const dir = takingTeam.attackDir;
      let standX = sp.x - dir * 1.4;
      let standY = sp.y;
      if (sp.type === 'corner') {
        standX = sp.x - dir * 0.9;
        standY = sp.y + (sp.y < GOAL_Y ? -0.9 : 0.9);
      } else if (sp.type === 'throw_in') {
        standY = sp.y + (sp.y < GOAL_Y ? -0.7 : 0.7);
        standX = sp.x;
      } else if (sp.type === 'penalty') {
        standX = sp.x - dir * 2.4;
      }
      const d = taker.seek(standX, standY, 1, false);
      if (d < 1.0 && sp.timer <= 0) sp.ready = true;
      if (sp.timer < -2.5) sp.ready = true; // never stall the game
    } else {
      sp.ready = sp.timer <= 0;
    }

    if (sp.ready && !this.isUserTeam(takingTeam)) {
      sp.aiDelay = (sp.aiDelay ?? rand(1.1, 0.35)) - dt;
      if (sp.aiDelay <= 0) this.executeSetPiece();
    }
  }

  executeSetPiece() {
    const sp = this.setPiece;
    if (!sp || !sp.taker) return;
    const taker = sp.taker;
    const team = this.teamBySide(sp.side);
    const opp = this.opponentOf(team);
    const ball = this.ball;
    const dir = team.attackDir;

    if (sp.type === 'penalty') {
      const side = Math.random() < 0.5 ? -1 : 1;
      const aimY = GOAL_Y + side * (PITCH.goalWidth / 2 - rand(1.5, 0.4));
      shootBall(taker, ball, team.goalX, aimY, {
        charge: 0.85,
        accuracy: clamp(0.8 + taker.attributes.shooting / 400, 0.7, 0.97),
      });
      this.audio.play('shot');
      this.onShot(taker, { x: team.goalX, y: aimY, distance: PITCH.penaltySpot });
    } else if (sp.type === 'corner') {
      const targetY = GOAL_Y + noise() * 5;
      const targetX = team.goalX - dir * rand(9, 4);
      passBall(taker, ball, { x: targetX, y: targetY }, {
        lofted: true,
        accuracy: clamp(0.7 + taker.attributes.passing / 350, 0.6, 0.95),
      });
      this.audio.play('kick');
    } else if (sp.type === 'goal_kick') {
      const options = evaluatePasses(taker, ball, team, opp, this.difficulty);
      const target = options.find((o) => Math.abs(o.tx - taker.x) > 18) || options[0];
      if (target) {
        passBall(taker, ball, { x: target.tx, y: target.ty }, {
          lofted: target.distance > 24,
          accuracy: 0.82,
        });
      } else {
        clearBall(taker, ball);
      }
      this.audio.play('kick');
    } else {
      const options = evaluatePasses(taker, ball, team, opp, this.difficulty);
      const shotRange = Math.abs(team.goalX - ball.x) < 26 && sp.type === 'free_kick';
      if (shotRange && Math.random() < 0.55) {
        const aimY = GOAL_Y + noise() * 2.6;
        shootBall(taker, ball, team.goalX, aimY, {
          charge: 0.95,
          accuracy: clamp(0.72 + taker.attributes.shooting / 340, 0.6, 0.95),
          curl: noise() * 2.4,
        });
        this.onShot(taker, { x: team.goalX, y: aimY, distance: Math.abs(team.goalX - ball.x) });
        this.audio.play('shot');
      } else if (options.length) {
        const pick = options[0];
        passBall(taker, ball, { x: pick.tx, y: pick.ty }, {
          lofted: sp.type === 'throw_in' ? false : pick.lofted,
          accuracy: 0.85,
        });
        this.audio.play('kick');
      } else {
        clearBall(taker, ball);
        this.audio.play('kick');
      }
    }

    if (sp.type === 'throw_in') {
      // A throw is not a kick: no shot allowed, gentler delivery.
      ball.vz = Math.max(ball.vz, 3.2);
    }

    this.state = STATE.PLAYING;
    this.setPiece = null;
  }

  /* ---------------------------------------------------------------- */
  /* Events from actions                                               */
  /* ---------------------------------------------------------------- */

  onShot(player, shot) {
    this.audio.play('shot', 0.9);
    this.excitement = Math.max(this.excitement, 0.75);
    this.lastShot = { player, time: this.clock };
    this.addEffect({ type: 'burst', x: this.ball.x, y: this.ball.y, life: 0.3 });
  }

  onPass(player, target, through = false) {
    this.audio.play('kick', through ? 0.8 : 0.55);
    this.lastPassBy = player;
    this.lastPassTime = this.elapsedTotal();
    this.addEffect({ type: 'ring', x: this.ball.x, y: this.ball.y, life: 0.24 });
  }

  onClearance(player) {
    this.audio.play('kick', 0.7);
  }

  elapsedTotal() {
    return (this.half - 1) * this.halfSeconds + this.clock;
  }

  /* ---------------------------------------------------------------- */
  /* Tackles and fouls                                                 */
  /* ---------------------------------------------------------------- */

  attemptTackle(tackler, carrier, sliding, isUser = false) {
    if (!carrier || carrier.team === tackler.team) return false;
    const d = dist(tackler.x, tackler.y, carrier.x, carrier.y);
    if (d > PLAYER.reach + (sliding ? 1.8 : 1.5)) return false;

    if (sliding && !tackler.startSlide()) return false;
    if (!sliding) tackler.tackleCooldown = 0.55;

    const skill = tackler.attributes.defending / 100;
    const control = (carrier.attributes.pace + carrier.attributes.physical) / 200;
    const fromBehind =
      Math.cos(carrier.heading - Math.atan2(carrier.y - tackler.y, carrier.x - tackler.x)) > 0.55;
    let chance = clamp(0.46 + (skill - control) * 1.1 - (fromBehind ? 0.16 : 0), 0.12, 0.92);
    if (sliding) chance += 0.14;
    if (isUser) chance += 0.05;

    if (Math.random() < chance) {
      // Won the ball: knock it away from the carrier.
      const [nx, ny] = normalise(
        tackler.x - carrier.x + tackler.vx * 0.2,
        tackler.y - carrier.y + tackler.vy * 0.2
      );
      this.ball.owner = null;
      this.ball.kick(nx * rand(7, 3.5), ny * rand(7, 3.5), sliding ? 1.6 : 0.4);
      this.ball.lastTouch = tackler;
      this.ball.lastTouchSide = tackler.side;
      carrier.kickCooldown = 0.45;
      carrier.stunTimer = sliding ? 0.35 : 0.18;
      tackler.stats.tackles++;
      this.audio.play('tackle');
      this.addEffect({ type: 'burst', x: carrier.x, y: carrier.y, life: 0.35 });
      return true;
    }

    // Missed. Contact from a slide is usually a foul.
    const foulChance = sliding ? 0.72 : 0.22;
    if (this.rules.fouls && d < PLAYER.reach + 1.1 && Math.random() < foulChance) {
      this.awardFoul(tackler, carrier, sliding);
      return false;
    }
    carrier.stunTimer = Math.max(carrier.stunTimer, sliding ? 0.12 : 0);
    return false;
  }

  awardFoul(offender, victim, sliding) {
    const team = offender.team;
    const victimTeam = victim.team;
    team.stats.fouls++;
    offender.stunTimer = 0.6;
    victim.stunTimer = 0.5;
    this.audio.play('whistleShort');

    const inBox =
      offender.isInsideOwnBox() &&
      Math.abs(victim.x - team.ownGoalX) < PITCH.penaltyAreaDepth + 1;

    // Cards: reckless slides and repeated fouls get punished.
    let card = null;
    const severity = (sliding ? 0.35 : 0.12) + (inBox ? 0.15 : 0) + Math.random() * 0.4;
    if (severity > 0.72) {
      offender.yellowCards = (offender.yellowCards || 0) + 1;
      // Keepers stay on: sending one off would leave the goal unmanned.
      card = offender.yellowCards >= 2 && !offender.isKeeper ? 'red' : 'yellow';
      if (card === 'red') {
        team.sendOff(offender);
        this.logEvent('red', `${offender.name} is sent off!`, team.side);
      } else {
        this.logEvent('yellow', `${offender.name} booked for the challenge`, team.side);
      }
    }

    if (inBox) {
      const spotX = team.ownGoalX + team.attackDir * PITCH.penaltySpot;
      this.notify('PENALTY!', { duration: 2.6, kind: 'alert' });
      this.logEvent('penalty', `Penalty to ${victimTeam.name}`, victimTeam.side);
      this.setupRestart('penalty', victimTeam.side, spotX, GOAL_Y);
    } else {
      this.notify(card === 'red' ? 'RED CARD' : 'FREE KICK', { duration: 1.8 });
      this.setupRestart('free_kick', victimTeam.side, this.ball.x, this.ball.y);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ball / player interaction                                         */
  /* ---------------------------------------------------------------- */

  resolveBallControl(dt) {
    const ball = this.ball;
    const keeperHolding = this.holdingKeeper;

    if (keeperHolding) {
      this.updateKeeperHold(dt);
      return;
    }

    // Keep the current owner if they still have it at their feet.
    if (ball.owner) {
      const o = ball.owner;
      const d = dist(o.x, o.y, ball.x, ball.y);
      if (!o.isActive || d > o.reachRadius(ball) + 1.1 || o.kickCooldown > 0) {
        ball.owner = null;
      }
    }

    let best = null;
    let bestScore = Infinity;
    for (const team of this.teams) {
      for (const p of team.players) {
        if (p.kickCooldown > 0) continue;
        if (!p.isActive && !p.isSliding && !p.isDiving) continue;
        const d = dist(p.x, p.y, ball.x, ball.y);
        const reach = p.reachRadius(ball);
        if (d > reach) continue;
        const heightLimit = p.isKeeper && p.isInsideOwnBox() ? 2.6 : 2.1;
        if (ball.z > heightLimit) continue;
        // Prefer whoever is closest, with a small edge to the current owner.
        const score = d - (p === ball.owner ? 0.5 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }

    if (!best) {
      if (ball.owner) ball.owner = null;
      return;
    }

    // Goalkeeper handling inside their own box.
    if (best.isKeeper && best.isInsideOwnBox()) {
      this.keeperClaim(best);
      return;
    }

    if (best !== ball.owner) {
      const previous = ball.owner;
      const contested = ball.speed > 9;
      if (previous && previous.team !== best.team) {
        this.logInterception(best);
      } else if (!previous && ball.lastTouchSide !== null && ball.lastTouchSide !== best.side) {
        this.logInterception(best);
      } else if (!previous && this.lastPassBy && this.lastPassBy.team === best.team) {
        best.team.stats.passesCompleted++;
        this.registerAssistCandidate(best);
      }
      if (contested && !best.isSliding) {
        // A fast ball takes a heavy first touch.
        const [nx, ny] = normalise(ball.vx, ball.vy);
        ball.vx = nx * Math.min(ball.speed * 0.35, 5);
        ball.vy = ny * Math.min(ball.speed * 0.35, 5);
      }
      ball.owner = best;
      ball.lastTouch = best;
      ball.lastTouchSide = best.side;
    }

    if (ball.owner && !ball.owner.isSliding) {
      dribble(ball.owner, ball, dt, { sprinting: ball.owner.intent.sprint });
    } else if (ball.owner && ball.owner.isSliding) {
      // A sliding player pokes the ball on rather than controlling it.
      const slider = ball.owner;
      const [nx, ny] = normalise(slider.vx, slider.vy);
      ball.kick(nx * 9, ny * 9, 0.6); // clears ball.owner
      ball.lastTouch = slider;
      ball.lastTouchSide = slider.side;
      slider.kickCooldown = 0.4;
    }
  }

  registerAssistCandidate(receiver) {
    if (this.lastPassBy && this.lastPassBy.team === receiver.team) {
      this.pendingAssist = { player: this.lastPassBy, time: this.elapsedTotal() };
    }
  }

  logInterception(player) {
    this.lastPassBy = null;
    this.pendingAssist = null;
    if (this.excitement < 0.5) this.excitement = 0.45;
  }

  keeperClaim(keeper) {
    const ball = this.ball;
    const speed = ball.speed;
    const shotAtGoal = this.lastShot && this.elapsedTotal() - this.lastShot.time < 3;
    const skill = this.difficulty.keeperSkill * (0.7 + keeper.attributes.keeper / 300);
    const catchChance = clamp(1.15 - speed / 34 - (ball.airborne ? 0.12 : 0), 0.25, 0.97) * skill;

    if (shotAtGoal && speed > 8) {
      keeper.stats.saves++;
      keeper.team.stats.saves++;
      this.audio.play('save');
      this.logEvent('save', `${keeper.name} makes the save`, keeper.side);
      this.addEffect({ type: 'burst', x: ball.x, y: ball.y, life: 0.4 });
      this.excitement = Math.max(this.excitement, 0.6);
    }

    if (Math.random() < catchChance) {
      this.holdingKeeper = keeper;
      keeper.holdTimer = KEEPER.holdTime;
      ball.owner = keeper;
      ball.stop();
      ball.lastTouch = keeper;
      ball.lastTouchSide = keeper.side;
      this.lastShot = null;
    } else {
      // Parry it away from the middle.
      const dirY = ball.y < GOAL_Y ? -1 : 1;
      const away = keeper.team.attackDir;
      ball.kick(away * rand(9, 4), dirY * rand(7, 2), rand(3, 1));
      ball.lastTouch = keeper;
      ball.lastTouchSide = keeper.side;
      keeper.kickCooldown = 0.35;
      ball.owner = null;
    }
  }

  updateKeeperHold(dt) {
    const keeper = this.holdingKeeper;
    const ball = this.ball;
    keeper.holdTimer -= dt;
    const hx = keeper.x + Math.cos(keeper.heading) * 0.5;
    const hy = keeper.y + Math.sin(keeper.heading) * 0.5;
    ball.x = hx;
    ball.y = hy;
    ball.z = 1.1;
    ball.stop();
    ball.owner = keeper;

    // Walk out of the six-yard box while holding.
    const targetX = keeper.team.ownGoalX + keeper.team.attackDir * 5.5;
    keeper.seek(targetX, GOAL_Y, 0.55, false);

    const user = this.userFor(keeper.team);
    if (user) user.setActive(keeper);

    const wantsRelease = keeper.holdTimer <= 0;
    const userRelease =
      user &&
      (user.controller.pass.pressed || user.controller.shoot.pressed || user.controller.through.pressed);

    if (wantsRelease || userRelease) {
      this.keeperDistribute(keeper, user && userRelease ? user : null);
    }
  }

  keeperDistribute(keeper, user) {
    const ball = this.ball;
    const team = keeper.team;
    const opp = this.opponentOf(team);
    this.holdingKeeper = null;
    keeper.holdTimer = 0;
    ball.z = 1.0;

    const options = evaluatePasses(keeper, ball, team, opp, this.difficulty);
    let target = options[0];
    if (user && user.controller.hasDirection) {
      const [dx, dy] = normalise(user.controller.x, user.controller.y);
      let best = null;
      let bestScore = -Infinity;
      for (const o of options) {
        const [ox, oy] = normalise(o.tx - keeper.x, o.ty - keeper.y);
        const score = ox * dx + oy * dy + o.score * 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = o;
        }
      }
      target = best || target;
    }
    const longKick = user ? user.controller.shoot.down : !target || target.distance > 30;

    if (target && !longKick) {
      passBall(keeper, ball, { x: target.tx, y: target.ty }, {
        lofted: target.distance > 20,
        accuracy: 0.88,
      });
    } else {
      const dir = team.attackDir;
      const tx = keeper.x + dir * 46;
      const ty = clamp(GOAL_Y + noise() * 18, 3, PITCH.width - 3);
      strikeBall(keeper, ball, tx, ty, { speed: 24, vz: 9.5, accuracy: 0.75, cooldown: 0.6 });
    }
    this.audio.play('kick');
    keeper.kickCooldown = 0.7;
    ball.owner = null;
    if (user) {
      // Hand control back to an outfielder after the distribution.
      user.setActive(user.pickActive());
      user.switchLock = 0.4;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Collisions                                                        */
  /* ---------------------------------------------------------------- */

  resolvePlayerCollisions() {
    const all = [...this.home.players, ...this.away.players];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d >= min || d < 1e-4) continue;
        const overlap = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        // The stronger player gives less ground.
        const aWeight = a.attributes.physical + (a.isSliding ? 40 : 0);
        const bWeight = b.attributes.physical + (b.isSliding ? 40 : 0);
        const total = aWeight + bWeight;
        const aPush = (bWeight / total) * 2 * overlap;
        const bPush = (aWeight / total) * 2 * overlap;
        a.x -= nx * aPush;
        a.y -= ny * aPush;
        b.x += nx * bPush;
        b.y += ny * bPush;
      }
    }
  }

  /** Ball bouncing off posts and the crossbar. */
  resolveGoalFrame() {
    const ball = this.ball;
    for (const goalX of [0, PITCH.length]) {
      if (Math.abs(ball.x - goalX) > 1.5) continue;
      for (const postY of [PITCH.goalTop, PITCH.goalBottom]) {
        const dx = ball.x - goalX;
        const dy = ball.y - postY;
        const d = Math.hypot(dx, dy);
        const min = PITCH.postRadius + BALL.radius;
        if (d < min && d > 1e-5 && ball.z < CROSSBAR) {
          const nx = dx / d;
          const ny = dy / d;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
          ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
          ball.x = goalX + nx * min * 1.02;
          ball.y = postY + ny * min * 1.02;
          this.audio.play('post');
          this.notify('OFF THE POST!', { duration: 1.4, kind: 'alert' });
          this.excitement = 1;
        }
      }
      // Crossbar
      if (
        ball.y > PITCH.goalTop &&
        ball.y < PITCH.goalBottom &&
        Math.abs(ball.z - CROSSBAR) < BALL.radius + 0.06 &&
        ball.vz > -0.2
      ) {
        const crossing = (goalX === 0 && ball.vx < 0) || (goalX === PITCH.length && ball.vx > 0);
        if (crossing) {
          ball.vz = -Math.abs(ball.vz) * 0.6 - 1.5;
          ball.vx *= 0.55;
          this.audio.play('post');
          this.notify('OFF THE BAR!', { duration: 1.4, kind: 'alert' });
          this.excitement = 1;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Boundaries, goals                                                 */
  /* ---------------------------------------------------------------- */

  checkBoundaries() {
    const ball = this.ball;
    if (this.state !== STATE.PLAYING) return;

    // Goal line.
    if (ball.x < -BALL.radius || ball.x > PITCH.length + BALL.radius) {
      const goalX = ball.x < 0 ? 0 : PITCH.length;
      const inMouth = ball.y > PITCH.goalTop && ball.y < PITCH.goalBottom && ball.z < CROSSBAR;
      if (inMouth && ball.x > -PITCH.goalDepth && ball.x < PITCH.length + PITCH.goalDepth) {
        this.scoreGoal(goalX);
        return;
      }
      if (Math.abs(ball.x - goalX) < 0.2) return;

      const defendingSide = goalX === 0 ? SIDE.HOME : SIDE.AWAY;
      const lastSide = ball.lastTouchSide;
      const attackerTouchedLast = lastSide !== null && lastSide !== defendingSide;
      if (attackerTouchedLast) {
        const cornerY = ball.y < GOAL_Y ? PITCH.cornerArc * 0.5 : PITCH.width - PITCH.cornerArc * 0.5;
        const cornerX = goalX === 0 ? 0.6 : PITCH.length - 0.6;
        const attackingSide = defendingSide === SIDE.HOME ? SIDE.AWAY : SIDE.HOME;
        this.teamBySide(attackingSide).stats.corners++;
        this.audio.play('whistleShort');
        this.notify('Corner', { duration: 1.4 });
        this.setupRestart('corner', attackingSide, cornerX, cornerY);
      } else {
        const spotX = goalX === 0 ? PITCH.goalAreaDepth : PITCH.length - PITCH.goalAreaDepth;
        this.audio.play('whistleShort');
        this.notify('Goal kick', { duration: 1.4 });
        this.setupRestart('goal_kick', defendingSide, spotX, GOAL_Y);
      }
      return;
    }

    // Touchlines.
    if (ball.y < -BALL.radius || ball.y > PITCH.width + BALL.radius) {
      const y = ball.y < 0 ? 0 : PITCH.width;
      const lastSide = ball.lastTouchSide;
      const side = lastSide === null ? SIDE.HOME : lastSide === SIDE.HOME ? SIDE.AWAY : SIDE.HOME;
      this.audio.play('whistleShort');
      this.notify('Throw-in', { duration: 1.2 });
      this.setupRestart('throw_in', side, clamp(ball.x, 1, PITCH.length - 1), y);
    }
  }

  scoreGoal(goalX) {
    const scoringSide = goalX === 0 ? SIDE.AWAY : SIDE.HOME;
    const team = this.teamBySide(scoringSide);
    const conceding = this.opponentOf(team);
    team.score++;
    team.stats.onTarget++;

    const scorer = this.ball.lastTouch;
    let assist = null;
    if (
      this.pendingAssist &&
      this.pendingAssist.player !== scorer &&
      this.elapsedTotal() - this.pendingAssist.time < 8
    ) {
      assist = this.pendingAssist.player;
    }
    const ownGoal = scorer && scorer.team !== team;
    if (scorer && !ownGoal) scorer.stats.goals++;
    if (assist && !ownGoal) assist.stats.assists++;

    this.lastGoal = { team, scorer, assist, ownGoal, minute: Math.floor(this.displayMinute) };
    const label = ownGoal
      ? `${scorer.name} (own goal)`
      : scorer
      ? scorer.name
      : team.name;
    this.logEvent('goal', `GOAL! ${label} — ${this.home.score}-${this.away.score}`, team.side);

    this.state = STATE.GOAL;
    this.stateTimer = MATCH.ceremonyGoal;
    this.audio.play('goal');
    this.audio.play('whistle');
    this.excitement = 1;
    this.notify('GOAL!', { duration: 2.6, kind: 'goal' });
    this.pendingAssist = null;
    this.lastPassBy = null;

    // Ball settles in the net.
    this.ball.vx *= 0.15;
    this.ball.vy *= 0.15;
    for (const p of team.players) p.celebrateTimer = MATCH.ceremonyGoal;

    for (let i = 0; i < 30; i++) {
      this.addEffect({
        type: 'confetti',
        x: this.ball.x,
        y: this.ball.y,
        vx: noise() * 8,
        vy: noise() * 8,
        life: rand(1.8, 0.9),
        colour: i % 2 ? team.kit.shirt : team.kit.trim,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Offside                                                           */
  /* ---------------------------------------------------------------- */

  checkOffside() {
    // Offside is judged at the moment the ball is played, so we snapshot the
    // attackers' positions each time a pass leaves a foot.
    if (!this.rules.offside) return;
    const ball = this.ball;
    if (!this.pendingOffsideCheck) return;
    const { receiverSide, positions } = this.pendingOffsideCheck;
    const owner = ball.owner;
    if (!owner) return;
    if (owner.side !== receiverSide) {
      // The other side got there first — nothing to call.
      this.pendingOffsideCheck = null;
      return;
    }
    const snapshot = positions.get(owner.id);
    this.pendingOffsideCheck = null;
    if (!snapshot || !snapshot.offside) return;

    const team = this.teamBySide(receiverSide);
    const other = this.opponentOf(team);
    this.audio.play('whistleShort');
    this.notify('Offside', { duration: 1.8 });
    this.logEvent('offside', `Offside against ${owner.name}`, team.side);
    this.setupRestart('free_kick', other.side, snapshot.x, snapshot.y);
  }

  snapshotOffside(passer) {
    if (!this.rules.offside) return;
    const team = passer.team;
    const opp = this.opponentOf(team);
    const lineX = opp.offsideLineX();
    const positions = new Map();
    const dir = team.attackDir;
    for (const p of team.players) {
      if (p === passer) continue;
      const beyondLine = dir > 0 ? p.x > lineX + 0.25 : p.x < lineX - 0.25;
      const beyondBall = dir > 0 ? p.x > this.ball.x + 0.25 : p.x < this.ball.x - 0.25;
      const ownHalf = dir > 0 ? p.x < PITCH.length / 2 : p.x > PITCH.length / 2;
      positions.set(p.id, {
        x: p.x,
        y: p.y,
        offside: beyondLine && beyondBall && !ownHalf,
      });
    }
    this.pendingOffsideCheck = { receiverSide: team.side, positions };
  }

  /* ---------------------------------------------------------------- */
  /* Clock and phases                                                  */
  /* ---------------------------------------------------------------- */

  advanceClock(dt) {
    if (this.state === STATE.FULL_TIME || this.state === STATE.HALF_TIME) return;
    // The clock keeps ticking during restarts, like the real thing.
    this.clock += dt;
    if (this.clock >= this.halfSeconds + this.stoppage) {
      if (this.state === STATE.PLAYING || this.state === STATE.KICKOFF) {
        this.endHalf();
      }
    }
  }

  endHalf() {
    if (this.half === 1) {
      this.state = STATE.HALF_TIME;
      this.stateTimer = MATCH.ceremonyHalf;
      this.audio.play('whistleLong');
      this.notify('HALF TIME', { duration: 2.6, kind: 'alert' });
      this.logEvent('half', 'Half time', null);
    } else {
      this.state = STATE.FULL_TIME;
      this.stateTimer = 2.4;
      this.audio.play('whistleLong');
      this.notify('FULL TIME', { duration: 3, kind: 'alert' });
      this.logEvent('full', 'Full time', null);
      this.finished = true;
      this.onFinish(this);
    }
  }

  startSecondHalf() {
    this.half = 2;
    this.clock = 0;
    // Teams change ends. Only the geometric side flips; home/away identity
    // (and therefore the scoreboard) stays put.
    for (const team of this.teams) {
      team.side = team.side === SIDE.HOME ? SIDE.AWAY : SIDE.HOME;
      for (const p of team.players) p.side = team.side;
    }
    const secondHalfKickoff = this.firstKickoffTeam === this.home ? this.away : this.home;
    this.prepareKickoff(secondHalfKickoff.side);
    this.notify('SECOND HALF', { duration: 2 });
  }

  /* ---------------------------------------------------------------- */
  /* Main update                                                       */
  /* ---------------------------------------------------------------- */

  update(dt) {
    if (this.paused) return;

    // Track who was on the ball before this tick so we can spot passes leaving.
    const previousOwner = this.ball.owner;

    if (this.state === STATE.GOAL) {
      this.updateCelebration(dt);
    } else if (this.state === STATE.HALF_TIME || this.state === STATE.FULL_TIME) {
      for (const team of this.teams) for (const p of team.players) p.idle();
    } else if (this.state !== STATE.PLAYING && this.setPiece) {
      // During a restart nobody chases: they take up positions and wait.
      for (const user of this.users) user.update(dt);
      this.positionForRestart();
    } else {
      for (const user of this.users) user.update(dt);
      updateTeamAI(this.home, this.away, this, dt);
      updateTeamAI(this.away, this.home, this, dt);
    }

    // A pass has just left someone's boot: snapshot positions for offside
    // before anybody moves, which is how the real call is judged.
    if (previousOwner && !this.ball.owner && this.ball.speed > 3 && this.state === STATE.PLAYING) {
      this.snapshotOffside(previousOwner);
    }

    for (const team of this.teams) {
      for (const p of team.players) p.update(dt);
    }
    this.resolvePlayerCollisions();

    const playing = this.state === STATE.PLAYING;

    if (playing) {
      this.ball.update(dt);
      this.resolveGoalFrame();
      this.resolveBallControl(dt);
      this.checkOffside();
      this.checkBoundaries();
      const owner = this.ball.owner;
      if (owner) this.possessionTicks[owner.team === this.home ? 0 : 1] += dt;
    } else if (this.setPiece) {
      this.updateRestart(dt);
      // The AI may have taken the restart inside updateRestart, clearing it.
      if (this.setPiece) {
        // Let the human strike a set piece with the normal controls.
        const takingTeam = this.teamBySide(this.setPiece.side);
        const user = this.userFor(takingTeam);
        if (user && this.setPiece.ready) {
          const c = user.controller;
          if (c.pass.pressed || c.through.pressed || c.shoot.released) {
            this.takeUserSetPiece(user, c);
          }
        }
      }
    } else {
      this.ball.update(dt);
    }

    this.ball.clampToWorld();
    this.advanceClock(dt);
    this.updateTimers(dt);
    this.updateEffects(dt);
    this.updateAtmosphere(dt);
  }

  takeUserSetPiece(user, controller) {
    const sp = this.setPiece;
    if (!sp || !sp.taker) return;
    const taker = sp.taker;
    const team = taker.team;
    const ball = this.ball;

    if (sp.type === 'penalty' || (sp.type === 'free_kick' && controller.shoot.released)) {
      const aimY = clamp(
        GOAL_Y + controller.y * (PITCH.goalWidth / 2 + 0.6),
        PITCH.goalTop + 0.4,
        PITCH.goalBottom - 0.4
      );
      const charge = sp.type === 'penalty' ? clamp(controller.shoot.heldOnRelease / 0.9, 0.35, 1) : clamp(controller.shoot.heldOnRelease / 1.05, 0.3, 1);
      shootBall(taker, ball, team.goalX, aimY, {
        charge,
        accuracy: clamp(0.86 + taker.attributes.shooting / 500, 0.7, 0.98),
        curl: clamp(controller.x * -1.8, -2.2, 2.2),
      });
      this.onShot(taker, { x: team.goalX, y: aimY, distance: dist(ball.x, ball.y, team.goalX, aimY) });
    } else {
      // Pass it: reuse the normal passing brain with the stick direction.
      const opp = this.opponentOf(team);
      const options = evaluatePasses(taker, ball, team, opp, this.difficulty);
      let pick = options[0];
      if (controller.hasDirection && options.length) {
        const [dx, dy] = normalise(controller.x, controller.y);
        let best = null;
        let bestScore = -Infinity;
        for (const o of options) {
          const [ox, oy] = normalise(o.tx - taker.x, o.ty - taker.y);
          const s = ox * dx + oy * dy + o.score * 0.3;
          if (s > bestScore) {
            bestScore = s;
            best = o;
          }
        }
        pick = best || pick;
      }
      if (pick) {
        const lofted = sp.type === 'corner' || controller.through.pressed || pick.lofted;
        passBall(taker, ball, { x: pick.tx, y: pick.ty }, { lofted, accuracy: 0.9 });
      } else {
        clearBall(taker, ball);
      }
      this.audio.play('kick');
    }

    if (sp.type === 'throw_in') ball.vz = Math.max(ball.vz, 3);
    this.state = STATE.PLAYING;
    this.setPiece = null;
  }

  /** Scorers wheel away to the corner; the conceders trudge back. */
  updateCelebration(dt) {
    const goal = this.lastGoal;
    if (!goal) return;
    const scoring = goal.team;
    const conceding = this.opponentOf(scoring);
    const cornerX = scoring.goalX;
    const cornerY = this.ball.y < GOAL_Y ? 4 : PITCH.width - 4;
    for (const p of scoring.players) {
      if (p.isKeeper) {
        p.seek(p.x, p.y, 0.3, false);
        continue;
      }
      const target = p === goal.scorer ? [cornerX - scoring.attackDir * 6, cornerY] : null;
      if (target) p.seek(target[0], target[1], 1, true);
      else p.seek(goal.scorer ? goal.scorer.x : cornerX, goal.scorer ? goal.scorer.y : cornerY, 0.9, true);
    }
    for (const p of conceding.players) {
      const [x, y] = conceding.kickoffPosition(p, false);
      p.seek(x, y, 0.55, false);
    }
  }

  updateTimers(dt) {
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }

    if (this.state === STATE.GOAL) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        const conceded = this.lastGoal.team === this.home ? SIDE.AWAY : SIDE.HOME;
        if (this.clock >= this.halfSeconds + this.stoppage) this.endHalf();
        else this.prepareKickoff(this.teamBySide(conceded).side);
      }
    } else if (this.state === STATE.HALF_TIME) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.startSecondHalf();
    } else if (this.state === STATE.FULL_TIME) {
      this.stateTimer = Math.max(0, this.stateTimer - dt);
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.life -= dt;
      if (e.type === 'confetti') {
        e.x += (e.vx || 0) * dt;
        e.y += (e.vy || 0) * dt;
        e.vx *= 0.97;
        e.vy *= 0.97;
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
  }

  updateAtmosphere(dt) {
    // Excitement rises near the goals and with big moments, and decays slowly.
    const attackingThird =
      this.ball.x < PITCH.length * 0.25 || this.ball.x > PITCH.length * 0.75;
    const target = attackingThird ? 0.55 : 0.28;
    this.excitement = Math.max(target, this.excitement - dt * 0.22);
    this.audio.setExcitement(this.excitement);
  }

  possessionPercent() {
    const total = this.possessionTicks[0] + this.possessionTicks[1];
    if (total < 1) return [50, 50];
    const home = Math.round((this.possessionTicks[0] / total) * 100);
    return [home, 100 - home];
  }
}

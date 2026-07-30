/**
 * Penalty shootout. Runs on top of a Match so it reuses the same pitch,
 * players, ball physics and renderer — only the rules change.
 */

import { KEEPER, PITCH } from './constants.js';
import { clamp, dist, noise, rand } from './math.js';
import { shootBall } from './actions.js';

const GOAL_Y = PITCH.width / 2;
const CROSSBAR = 2.44;

export class Shootout {
  constructor(match, onFinish) {
    this.match = match;
    this.onFinish = onFinish;
    this.teams = [...match.teams];
    // Whoever is nominally at home takes the first kick.
    this.order = [match.home, match.away];
    this.scores = [0, 0];
    this.taken = [0, 0];
    this.results = [[], []];
    this.turn = 0;
    this.phase = 'intro';
    this.timer = 1.8;
    this.kickers = this.order.map((team) =>
      [...team.players].sort((a, b) => b.attributes.shooting - a.attributes.shooting)
    );
    this.finished = false;
    this.winner = null;
    match.notify('PENALTY SHOOTOUT', { duration: 2.2, kind: 'alert' });
  }

  get attackingTeam() {
    return this.order[this.turn];
  }

  get defendingTeam() {
    return this.order[1 - this.turn];
  }

  currentTaker() {
    const list = this.kickers[this.turn];
    return list[this.taken[this.turn] % list.length];
  }

  /** Standard "can the trailing side still catch up" check. */
  checkDecided() {
    const [a, b] = this.scores;
    const [ta, tb] = this.taken;
    const bestOf = 5;
    const remainingA = Math.max(0, bestOf - ta);
    const remainingB = Math.max(0, bestOf - tb);
    if (ta <= bestOf || tb <= bestOf) {
      if (a > b + remainingB) return 0;
      if (b > a + remainingA) return 1;
    }
    // Sudden death: decided once both have taken the same number of kicks.
    if (ta >= bestOf && tb >= bestOf && ta === tb && a !== b) return a > b ? 0 : 1;
    return null;
  }

  setupKick() {
    const match = this.match;
    const attacking = this.attackingTeam;
    const defending = this.defendingTeam;
    const taker = this.currentTaker();
    const keeper = defending.keeper;
    const spotX = attacking.goalX - attacking.attackDir * PITCH.penaltySpot;

    match.ball.reset(spotX, GOAL_Y);
    match.ball.owner = null;
    this.spotX = spotX;
    this.taker = taker;
    this.keeper = keeper;
    this.saved = false;
    this.resultText = null;

    // Everyone not involved waits around the centre circle.
    for (const team of this.teams) {
      for (const p of team.players) {
        if (p === taker || p === keeper) continue;
        const angle = (p.id * 2.4) % (Math.PI * 2);
        p.x = PITCH.length / 2 + Math.cos(angle) * (PITCH.centreCircle + 1.5);
        p.y = GOAL_Y + Math.sin(angle) * (PITCH.centreCircle + 1.5);
        p.vx = 0;
        p.vy = 0;
        p.idle();
      }
    }

    taker.x = spotX - attacking.attackDir * 2.6;
    taker.y = GOAL_Y;
    taker.vx = 0;
    taker.vy = 0;
    taker.heading = attacking.attackDir > 0 ? 0 : Math.PI;
    taker.kickCooldown = 0;
    taker.stunTimer = 0;

    keeper.x = defending.ownGoalX + defending.attackDir * 0.35;
    keeper.y = GOAL_Y;
    keeper.vx = 0;
    keeper.vy = 0;
    keeper.diveTimer = 0;
    keeper.diveCooldown = 0;
    keeper.heading = defending.attackDir > 0 ? 0 : Math.PI;

    const user = match.userFor(attacking);
    if (user) user.setActive(taker);
    const defUser = match.userFor(defending);
    if (defUser) defUser.setActive(keeper);

    this.phase = 'ready';
    this.timer = match.userFor(attacking) ? 6.0 : rand(1.6, 0.9);
    match.notify(
      `${attacking.short} ${this.scores[this.turn]} – ${this.scores[1 - this.turn]} ${defending.short}`,
      { duration: 1.4 }
    );
  }

  takeKick(aimY, charge, accuracy, curl = 0) {
    const attacking = this.attackingTeam;
    const ball = this.match.ball;
    shootBall(this.taker, ball, attacking.goalX, aimY, { charge, accuracy, curl });
    this.match.audio.play('shot');
    this.phase = 'flight';
    this.timer = 3.2;
    this.diveDecided = false;
  }

  decideDive() {
    if (this.diveDecided) return;
    this.diveDecided = true;
    const keeper = this.keeper;
    const ball = this.match.ball;
    const defUser = this.match.userFor(this.defendingTeam);
    let dir;
    if (defUser) {
      // The defending human picks a side by holding a direction.
      dir = Math.sign(defUser.controller.y) || (Math.random() < 0.5 ? -1 : 1);
    } else {
      // The AI reads the ball a little, better at higher difficulty.
      const read = this.match.difficulty.keeperSkill;
      const actual = Math.sign(ball.vy) || (Math.random() < 0.5 ? -1 : 1);
      dir = Math.random() < 0.35 + read * 0.35 ? actual : -actual;
    }
    keeper.startDive(dir, 1);
  }

  update(dt) {
    const match = this.match;
    const ball = match.ball;
    this.timer -= dt;

    if (this.phase === 'intro') {
      if (this.timer <= 0) this.setupKick();
      for (const team of this.teams) for (const p of team.players) p.update(dt);
      return;
    }

    if (this.phase === 'ready') {
      const user = match.userFor(this.attackingTeam);
      ball.x = this.spotX ?? ball.x;
      ball.stop();
      // Small run-up so it doesn't look frozen.
      const dir = this.attackingTeam.attackDir;
      this.taker.seek(ball.x - dir * 2.2, GOAL_Y, 0.5, false);
      this.keeper.seek(this.keeper.x, GOAL_Y + Math.sin(match.elapsedTotal() * 2) * 1.2, 0.6, false);

      if (user) {
        const c = user.controller;
        if (c.shoot.released || c.pass.pressed) {
          const charge = clamp((c.shoot.heldOnRelease || 0.5) / 0.9, 0.35, 1);
          const aimY = clamp(
            GOAL_Y + c.y * (PITCH.goalWidth / 2 + 0.4),
            PITCH.goalTop + 0.3,
            PITCH.goalBottom - 0.3
          );
          this.takeKick(aimY, charge, clamp(0.9 + this.taker.attributes.shooting / 800, 0.8, 0.97), clamp(c.x * -1.4, -2, 2));
        } else if (this.timer <= 0) {
          // Ran out of time: a nervous, mishit penalty.
          this.takeKick(GOAL_Y + noise() * 4, 0.6, 0.6);
        }
      } else if (this.timer <= 0) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const aimY = GOAL_Y + side * (PITCH.goalWidth / 2 - rand(1.6, 0.3));
        const skill = this.taker.attributes.shooting / 100;
        this.takeKick(aimY, 0.8, clamp(0.72 + skill * 0.22, 0.7, 0.96));
      }
      for (const team of this.teams) for (const p of team.players) p.update(dt);
      return;
    }

    if (this.phase === 'flight') {
      ball.update(dt);
      const attacking = this.attackingTeam;
      const goalX = attacking.goalX;

      // The keeper commits once the ball is on its way.
      if (ball.speed > 2) this.decideDive();
      for (const team of this.teams) for (const p of team.players) p.update(dt);

      // Save?
      const keeper = this.keeper;
      const reach = KEEPER.reach + (keeper.isDiving ? 0.8 : 0);
      if (!this.saved && dist(keeper.x, keeper.y, ball.x, ball.y) < reach && ball.z < 2.6) {
        this.saved = true;
        const away = this.defendingTeam.attackDir;
        ball.kick(away * rand(9, 5), Math.sign(keeper.vy || 1) * rand(5, 1), rand(3, 1));
        match.audio.play('save');
        this.finishKick(false, 'SAVED!');
        return;
      }

      const crossed = attacking.attackDir > 0 ? ball.x > goalX : ball.x < goalX;
      if (crossed) {
        const inGoal = ball.y > PITCH.goalTop && ball.y < PITCH.goalBottom && ball.z < CROSSBAR;
        this.finishKick(inGoal, inGoal ? 'SCORED' : 'MISSED!');
        return;
      }
      if (
        this.timer <= 0 ||
        ball.y < -1 ||
        ball.y > PITCH.width + 1 ||
        (ball.speed < 0.5 && !ball.airborne)
      ) {
        this.finishKick(false, 'MISSED!');
      }
      return;
    }

    if (this.phase === 'result') {
      for (const team of this.teams) for (const p of team.players) p.update(dt);
      if (this.timer <= 0) this.nextKick();
    }
  }

  finishKick(scored, text) {
    const match = this.match;
    if (scored) {
      this.scores[this.turn]++;
      match.audio.play('goal');
      match.excitement = 1;
    } else {
      match.audio.play('whistleShort');
    }
    this.results[this.turn].push(scored);
    this.taken[this.turn]++;
    this.resultText = text;
    match.notify(text, { duration: 1.6, kind: scored ? 'goal' : 'alert' });
    this.phase = 'result';
    this.timer = 2.0;
  }

  nextKick() {
    const decided = this.checkDecided();
    if (decided !== null) {
      this.finished = true;
      this.winner = this.order[decided];
      this.match.notify(`${this.winner.name} win the shootout`, { duration: 3, kind: 'goal' });
      this.match.audio.play('whistleLong');
      this.onFinish(this.winner, this.scores.slice());
      return;
    }
    this.turn = 1 - this.turn;
    this.setupKick();
  }

  /** Scoreline used by the HUD, always in home–away order. */
  displayScores() {
    const homeIndex = this.order[0] === this.match.home ? 0 : 1;
    return [this.scores[homeIndex], this.scores[1 - homeIndex]];
  }
}

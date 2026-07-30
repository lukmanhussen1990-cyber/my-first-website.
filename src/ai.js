/**
 * Team intelligence: who presses, who marks, who makes the run, and what the
 * player on the ball decides to do with it.
 *
 * Movement targets are recomputed every frame so motion stays smooth, while
 * discrete choices (shoot / pass / clear) are gated behind a per-player
 * reaction timer so the AI does not think at 60 Hz.
 */

import { BALL, KEEPER, PITCH, PLAYER, STATE } from './constants.js';
import { clamp, dist, lerp, noise, normalise, pointSegmentDistance, rand } from './math.js';
import { clearBall, dribble, passBall, shootBall } from './actions.js';

const GOAL_Y = PITCH.width / 2;

/** Where the ball will be in `t` seconds, assuming it keeps rolling. */
export function predictBall(ball, t) {
  const k = ball.airborne ? BALL.airDrag : BALL.drag;
  const f = (1 - Math.exp(-k * t)) / k;
  return { x: ball.x + ball.vx * f, y: ball.y + ball.vy * f };
}

/** Rough seconds for a player to intercept the ball, Infinity if hopeless. */
export function timeToBall(player, ball, speedScale = 1) {
  const speed = Math.max(2, player.maxSpeed * speedScale);
  for (let t = 0; t <= 3.2; t += 0.12) {
    const p = predictBall(ball, t);
    const d = Math.hypot(p.x - player.x, p.y - player.y) - player.reachRadius(ball);
    if (d <= speed * t) return t + (player.stunTimer > 0 ? player.stunTimer : 0);
  }
  return 3.2 + dist(player.x, player.y, ball.x, ball.y) / speed;
}

/** Distance from (x, y) to the nearest player in `list`. */
function nearestDistance(x, y, list, exclude = null) {
  let best = Infinity;
  for (const p of list) {
    if (p === exclude || !p.isActive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * How safe a passing lane is: the smallest clearance any opponent has to the
 * line, weighted so opponents near the receiving end matter more.
 */
function laneClearance(ax, ay, bx, by, opponents, ignore = null) {
  let worst = Infinity;
  for (const p of opponents) {
    if (p === ignore || !p.isActive) continue;
    const { distance, t } = pointSegmentDistance(p.x, p.y, ax, ay, bx, by);
    if (t <= 0.02 || t >= 0.99) continue;
    // An opponent can step into the lane while the ball travels, so scale by
    // how much time they have.
    const effective = distance - t * 1.8;
    if (effective < worst) worst = effective;
  }
  return worst === Infinity ? 12 : worst;
}

/** Advancement of an x coordinate in a team's attacking direction, 0..1. */
function advancement(team, x) {
  return team.side === 0 ? x / PITCH.length : 1 - x / PITCH.length;
}

/* ------------------------------------------------------------------ */
/* Shooting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Picks the best aim point in the goal mouth and scores how good the chance
 * is, from 0 (hopeless) to ~1 (tap-in).
 */
export function evaluateShot(player, ball, team, opp, difficulty) {
  const goalX = team.goalX;
  const d = Math.hypot(goalX - ball.x, GOAL_Y - ball.y);
  if (d > 34) return null;
  // Behind the goal line or at an impossible angle.
  const forward = team.side === 0 ? goalX - ball.x : ball.x - goalX;
  if (forward < 1.2) return null;

  const keeper = opp.keeper;
  const defenders = opp.players;
  const inset = 0.55;
  let best = null;
  for (let i = 0; i <= 6; i++) {
    const ty = lerp(PITCH.goalTop + inset, PITCH.goalBottom - inset, i / 6);
    const clearance = laneClearance(ball.x, ball.y, goalX, ty, defenders, keeper);
    if (clearance < 0.55) continue;
    const keeperDist = Math.hypot(keeper.x - goalX, keeper.y - ty);
    const travel = d / (shotFlightSpeed(player) || 20);
    const keeperReach = keeper.maxSpeed * travel + KEEPER.reach * (0.7 + difficulty.keeperSkill * 0.5);
    const keeperGap = keeperDist - keeperReach;
    const angleQuality = clamp(1 - Math.abs(ty - ball.y) / (d + 6), 0.15, 1);
    const distQuality = clamp(1 - (d - 5) / 32, 0.05, 1);
    const score =
      distQuality * 0.9 +
      clamp(keeperGap / 6, -1, 1) * 0.6 +
      clamp(clearance / 4, 0, 1) * 0.5 +
      angleQuality * 0.35;
    if (!best || score > best.score) best = { x: goalX, y: ty, score, distance: d, clearance };
  }
  if (!best) return null;
  const finishing = 0.55 + (player.attributes.shooting / 100) * 0.75;
  best.score *= finishing;
  return best;
}

function shotFlightSpeed(player) {
  return 19 + (player.attributes.shooting / 100) * 13;
}

/* ------------------------------------------------------------------ */
/* Passing                                                             */
/* ------------------------------------------------------------------ */

export function evaluatePasses(player, ball, team, opp, difficulty) {
  const options = [];
  const myAdv = advancement(team, player.x);
  const pressure = nearestDistance(player.x, player.y, opp.players, null);

  for (const mate of team.players) {
    if (mate === player || !mate.isActive) continue;
    if (mate.isKeeper && myAdv > 0.42) continue;
    const lead = clamp(Math.hypot(mate.vx, mate.vy) * 0.28, 0, 1.1);
    const tx = mate.x + mate.vx * lead;
    const ty = mate.y + mate.vy * lead;
    const d = Math.hypot(tx - ball.x, ty - ball.y);
    if (d < 3 || d > 48) continue;

    const openness = clamp(nearestDistance(tx, ty, opp.players) / 7, 0, 1.6);
    const clearance = laneClearance(ball.x, ball.y, tx, ty, opp.players);
    const progression = advancement(team, mate.x) - myAdv;
    const goalDistance = Math.hypot(team.goalX - tx, GOAL_Y - ty);
    const dangerBonus = clamp((32 - goalDistance) / 32, 0, 1) * 0.5;
    const backwardsPenalty = progression < 0 ? Math.abs(progression) * 0.7 : 0;
    const lengthPenalty = (d / 48) * 0.45;
    const riskyZone = advancement(team, ball.x) < 0.3 && Math.abs(progression) < 0.05 ? 0.25 : 0;

    let lofted = false;
    let score =
      openness * 0.85 +
      clamp(clearance / 3.5, -1.5, 1.2) * 1.0 +
      progression * 1.7 +
      dangerBonus -
      backwardsPenalty -
      lengthPenalty -
      riskyZone;

    // A blocked lane can still be played over the top.
    if (clearance < 1.4 && d > 12 && openness > 0.6) {
      lofted = true;
      score += 0.55;
    }
    if (pressure < 3.2 && progression >= 0) score += 0.5;
    if (mate.isKeeper) score -= 0.9;
    // Offside-aware: don't feed a runner who is already beyond the line.
    if (isOffside(mate, team, opp, ball)) score -= 3;

    options.push({ mate, tx, ty, score, lofted, distance: d, clearance });
  }
  options.sort((a, b) => b.score - a.score);
  return options;
}

export function isOffside(player, team, opp, ball) {
  if (!team.match || !team.match.rules.offside) return false;
  if (player.isKeeper) return false;
  const adv = advancement(team, player.x);
  if (adv < 0.5) return false; // Can't be offside in your own half.
  const lineX = opp.offsideLineX();
  const lineAdv = advancement(team, lineX);
  const ballAdv = advancement(team, ball.x);
  return adv > lineAdv + 0.004 && adv > ballAdv + 0.004;
}

/* ------------------------------------------------------------------ */
/* Off-ball movement                                                   */
/* ------------------------------------------------------------------ */

function separation(player, team, tx, ty) {
  // Nudge apart from team-mates converging on the same patch of grass.
  let ox = 0;
  let oy = 0;
  for (const mate of team.players) {
    if (mate === player) continue;
    const d = Math.hypot(mate.x - player.x, mate.y - player.y);
    if (d < 4.5 && d > 0.001) {
      const push = (4.5 - d) / 4.5;
      ox += ((player.x - mate.x) / d) * push * 2.6;
      oy += ((player.y - mate.y) / d) * push * 2.6;
    }
  }
  return [tx + ox, ty + oy];
}

function attackingMovement(player, ctx) {
  const { ball, team, opp, carrier } = ctx;
  let [tx, ty] = team.shapePosition(player, ball, true);
  const adv = advancement(team, ball.x);
  const dir = team.attackDir;

  const distToBall = dist(player.x, player.y, ball.x, ball.y);
  const isNearBall = distToBall < 22;

  if (player.role === 'FWD' || (player.role === 'MID' && player.slot.x > 0.5)) {
    // Attackers push the line and look to run in behind.
    const lineX = opp.offsideLineX();
    const maxX = team.match && team.match.rules.offside
      ? lineX - dir * 0.8
      : team.goalX - dir * 6;
    const wantX = tx + dir * (adv > 0.45 ? 7 : 2) * (0.6 + player.runBias);
    tx = dir > 0 ? Math.min(wantX, maxX) : Math.max(wantX, maxX);
    // Stretch runs wide when a team-mate is carrying it centrally.
    if (carrier && carrier.team === team && Math.abs(carrier.y - GOAL_Y) < 12) {
      ty += Math.sign(player.slot.y - 0.5) * 2.4;
    }
  }

  if (carrier && carrier.team === team && carrier !== player && isNearBall) {
    // Offer a simple angle: ahead-and-wide, or a bail-out behind.
    const supportAhead = advancement(team, player.x) > advancement(team, carrier.x);
    const angle = supportAhead ? 0.6 : -0.5;
    tx += dir * angle * 3.2;
    ty += Math.sign(player.y - carrier.y || 1) * 1.6;
  }

  if (ctx.match.state === STATE.CORNER || ctx.match.state === STATE.FREE_KICK) {
    const setPiece = ctx.match.setPiece;
    if (setPiece && setPiece.side === team.side && ballInFinalThird(team, ball)) {
      // Pile into the box for an attacking set piece.
      const boxX = team.goalX - dir * (6 + (player.id % 4) * 2.2);
      const boxY = GOAL_Y + ((player.id % 5) - 2) * 3.4;
      if (player.role !== 'GK' && player.slot.x > 0.14) {
        tx = boxX;
        ty = boxY;
      }
    }
  }

  [tx, ty] = separation(player, team, tx, ty);
  const sprint =
    player.stamina > 25 &&
    (dist(player.x, player.y, tx, ty) > 7 || (player.role === 'FWD' && adv > 0.55));
  player.seek(tx, ty, 1, sprint);
}

function ballInFinalThird(team, ball) {
  return advancement(team, ball.x) > 0.62;
}

function defensiveMovement(player, ctx, assignment) {
  const { ball, team, opp, difficulty } = ctx;
  const dir = team.attackDir;

  if (assignment === 'press') {
    const t = timeToBall(player, ball, difficulty.aiSpeed);
    const p = predictBall(ball, clamp(t, 0, 1.6));
    const carrier = ctx.carrier;
    let tx = p.x;
    let ty = p.y;
    if (carrier && carrier.team !== team) {
      // Approach on the goal side so the carrier is shepherded away.
      const gx = team.ownGoalX;
      const [nx, ny] = normalise(carrier.x - gx, carrier.y - GOAL_Y);
      const standoff = clamp(dist(player.x, player.y, carrier.x, carrier.y) * 0.12, 0.35, 1.1);
      tx = carrier.x + nx * standoff * 0.6 + carrier.vx * 0.18;
      ty = carrier.y + ny * standoff * 0.6 + carrier.vy * 0.18;
    }
    player.seek(tx, ty, 1, player.stamina > 12);
    return;
  }

  if (assignment === 'cover' && ctx.carrier) {
    // Second man: sit between the ball and our goal, cutting the next pass.
    const gx = team.ownGoalX;
    const tx = lerp(ctx.carrier.x, gx, 0.3);
    const ty = lerp(ctx.carrier.y, GOAL_Y, 0.25);
    const [sx, sy] = separation(player, team, tx, ty);
    player.seek(sx, sy, 1, dist(player.x, player.y, sx, sy) > 6);
    return;
  }

  let [tx, ty] = team.shapePosition(player, ball, false);
  const mark = player.markTarget;
  if (mark && mark.isActive) {
    const gx = team.ownGoalX;
    const [nx, ny] = normalise(gx - mark.x, GOAL_Y - mark.y);
    const tight = clamp(1.4 + (1 - difficulty.aiPressure) * 1.6, 1.2, 3.4);
    const mx = mark.x + nx * tight + mark.vx * 0.2;
    const my = mark.y + ny * tight + mark.vy * 0.2;
    // Blend between holding shape and tracking the runner.
    const blend = clamp(1 - dist(mark.x, mark.y, ball.x, ball.y) / 40, 0.25, 0.85);
    tx = lerp(tx, mx, blend);
    ty = lerp(ty, my, blend);
  }

  // Defenders squeeze up to keep a compact line with the deepest team-mate.
  if (player.role === 'DEF') {
    const lineX = team.defensiveLineX;
    if (lineX !== undefined) {
      tx = dir > 0 ? Math.max(tx, lineX) : Math.min(tx, lineX);
    }
  }

  [tx, ty] = separation(player, team, tx, ty);
  player.seek(tx, ty, 1, dist(player.x, player.y, tx, ty) > 8 && player.stamina > 20);
}

/* ------------------------------------------------------------------ */
/* On-ball decisions                                                   */
/* ------------------------------------------------------------------ */

function carryMovement(player, ctx) {
  const { ball, team, opp } = ctx;
  const dir = team.attackDir;
  const goalX = team.goalX;
  // Sample candidate directions and take the one with the most space that
  // still makes progress towards goal.
  const base = Math.atan2(GOAL_Y - player.y, goalX - player.x);
  let bestAngle = base;
  let bestScore = -Infinity;
  for (let i = -4; i <= 4; i++) {
    const angle = base + (i / 4) * 1.15;
    const px = player.x + Math.cos(angle) * 6;
    const py = player.y + Math.sin(angle) * 6;
    if (py < -1 || py > PITCH.width + 1) continue;
    const space = nearestDistance(px, py, opp.players);
    const progress = advancement(team, px) - advancement(team, player.x);
    const centrality = 1 - Math.abs(py - GOAL_Y) / PITCH.width;
    const score = clamp(space / 8, 0, 1.4) * 1.4 + progress * 3.4 + centrality * 0.35 - Math.abs(i) * 0.045;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  const tx = player.x + Math.cos(bestAngle) * 5;
  const ty = player.y + Math.sin(bestAngle) * 5;
  const pressure = nearestDistance(player.x, player.y, opp.players);
  player.seek(tx, ty, 1, pressure > 2.5 && player.stamina > 18);
}

function decideOnBall(player, ctx) {
  const { ball, team, opp, difficulty, match } = ctx;
  const pressure = nearestDistance(player.x, player.y, opp.players);
  const adv = advancement(team, player.x);

  const shot = evaluateShot(player, ball, team, opp, difficulty);
  const passes = evaluatePasses(player, ball, team, opp, difficulty);
  const bestPass = passes[0];

  const shotThreshold = 0.72 + (pressure > 5 ? 0.16 : 0) - (difficulty.aiPressure - 0.8) * 0.1;
  if (shot && shot.score > shotThreshold) {
    team.stats.shots++;
    player.stats.shots++;
    const accuracy = clamp(
      0.72 + (player.attributes.shooting / 100) * 0.3 - difficulty.aiShotError - pressure_penalty(pressure),
      0.35,
      0.99
    );
    shootBall(player, ball, shot.x, shot.y, {
      charge: clamp(0.55 + shot.distance / 40, 0.5, 1),
      accuracy,
      curl: noise() * 1.4,
    });
    match.onShot(player, shot);
    return;
  }

  const dribbleScore =
    clamp(pressure / 5, 0, 1.2) * 1.1 +
    (player.attributes.pace / 100) * 0.5 +
    (adv > 0.55 ? 0.25 : 0) -
    (adv < 0.28 ? 0.6 : 0);

  if (bestPass && bestPass.score > dribbleScore) {
    const accuracy = clamp(
      0.7 + (player.attributes.passing / 100) * 0.32 - difficulty.aiPassError - pressure_penalty(pressure),
      0.4,
      0.99
    );
    team.stats.passes++;
    player.stats.passes++;
    passBall(player, ball, { x: bestPass.tx, y: bestPass.ty }, {
      lofted: bestPass.lofted,
      accuracy,
      power: bestPass.distance > 22 ? 1.05 : 0.95,
    });
    match.onPass(player, bestPass.mate);
    return;
  }

  if (pressure < 2.4 && adv < 0.3 && (!bestPass || bestPass.score < 0.2)) {
    clearBall(player, ball);
    match.onClearance(player);
  }
}

function pressure_penalty(pressure) {
  return clamp((4 - pressure) / 4, 0, 1) * 0.22;
}

/* ------------------------------------------------------------------ */
/* Goalkeeper                                                          */
/* ------------------------------------------------------------------ */

function updateKeeper(keeper, ctx) {
  const { ball, team, opp, difficulty, match, dt } = ctx;
  const goalX = team.ownGoalX;
  const dir = team.attackDir;

  if (keeper.holdTimer > 0) {
    keeper.idle();
    return;
  }

  const ballDist = dist(keeper.x, keeper.y, ball.x, ball.y);
  const shotAtUs =
    (dir > 0 ? ball.vx < -3 : ball.vx > 3) &&
    Math.abs(ball.x - goalX) < 40;

  // Line position: on the arc between the ball and the centre of the goal.
  const [nx, ny] = normalise(ball.x - goalX, ball.y - GOAL_Y);
  const ballToGoal = Math.hypot(ball.x - goalX, ball.y - GOAL_Y);
  let advance = clamp(ballToGoal * 0.16, 0.6, 5.5);
  if (ballToGoal > 34) advance = clamp(ballToGoal * 0.1, 2.5, 9);

  let tx = goalX + nx * advance;
  let ty = GOAL_Y + ny * advance * 0.72;
  ty = clamp(ty, PITCH.goalTop - 3.2, PITCH.goalBottom + 3.2);

  // Come and claim loose balls in the box, or sweep behind a high line.
  const looseInBox =
    !ball.owner &&
    Math.abs(ball.x - goalX) < PITCH.penaltyAreaDepth + 2 &&
    Math.abs(ball.y - GOAL_Y) < PITCH.penaltyAreaWidth / 2 + 1;
  const nearestOpp = opp.nearestTo(ball.x, ball.y, (p) => !p.isKeeper);
  const oppTime = nearestOpp ? timeToBall(nearestOpp, ball) : Infinity;
  const myTime = timeToBall(keeper, ball, difficulty.keeperSkill);

  if (looseInBox && myTime < oppTime + 0.12) {
    const p = predictBall(ball, clamp(myTime, 0, 1));
    keeper.seek(p.x, p.y, 1, true);
  } else if (
    !ball.owner &&
    myTime < oppTime - 0.25 &&
    Math.abs(ball.x - goalX) < KEEPER.maxRush + 6 &&
    ball.z < 2.2
  ) {
    const p = predictBall(ball, clamp(myTime, 0, 1.2));
    keeper.seek(p.x, p.y, 1, true);
  } else {
    keeper.seek(tx, ty, ballDist < 22 ? 1 : 0.7, ballDist < 26 && dist(keeper.x, keeper.y, tx, ty) > 3);
  }

  // Dive at shots heading for the frame.
  if (shotAtUs && ball.speed > 9 && keeper.diveCooldown <= 0) {
    const t = (goalX - ball.x) / (ball.vx || 0.001);
    if (t > 0 && t < 1.1) {
      const cy = ball.y + ball.vy * t;
      const cz = ball.z + ball.vz * t - 0.5 * BALL.gravity * t * t;
      const onTarget = cy > PITCH.goalTop - 1.2 && cy < PITCH.goalBottom + 1.2 && cz < 3.2;
      const reactTime = 0.09 + (1 - difficulty.keeperSkill) * 0.22;
      if (onTarget && t < 0.85 && t > reactTime) {
        const gap = cy - keeper.y;
        if (Math.abs(gap) > KEEPER.reach * 0.55) {
          keeper.startDive(gap, clamp(Math.abs(gap) / 4, 0.55, 1));
        } else {
          keeper.seek(keeper.x, cy, 1, true);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Team update                                                         */
/* ------------------------------------------------------------------ */

function assignRoles(team, ctx) {
  const { ball, carrier } = ctx;
  const hasBall = carrier && carrier.team === team;

  // Reset assignments.
  for (const p of team.players) p.aiAssignment = null;

  if (!hasBall) {
    const candidates = team.players.filter((p) => !p.isKeeper && p.isActive);
    candidates.sort((a, b) => timeToBall(a, ball) - timeToBall(b, ball));
    if (candidates[0]) candidates[0].aiAssignment = 'press';
    if (candidates[1] && dist(candidates[1].x, candidates[1].y, ball.x, ball.y) < 26) {
      candidates[1].aiAssignment = 'cover';
    }

    // Man-marking: hand each defender/midfielder the nearest dangerous
    // opponent, closest-to-our-goal first so the biggest threats get picked up.
    const threats = ctx.opp.players
      .filter((p) => !p.isKeeper)
      .sort((a, b) => Math.abs(a.x - team.ownGoalX) - Math.abs(b.x - team.ownGoalX));
    const markers = team.players.filter(
      (p) => !p.isKeeper && !p.aiAssignment && (p.role === 'DEF' || p.role === 'MID')
    );
    const taken = new Set();
    for (const threat of threats) {
      let best = null;
      let bestD = Infinity;
      for (const m of markers) {
        if (taken.has(m)) continue;
        const d = dist(m.x, m.y, threat.x, threat.y);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (best && bestD < 26) {
        best.markTarget = threat;
        taken.add(best);
      }
    }
    for (const m of markers) if (!taken.has(m)) m.markTarget = null;

    // Compact defensive line: the deepest defender sets the reference.
    const defenders = team.players.filter((p) => p.role === 'DEF');
    if (defenders.length) {
      const ballAdv = advancement(team, ball.x);
      const lineAdv = clamp(ballAdv - 0.2, 0.08, 0.52);
      team.defensiveLineX =
        team.side === 0 ? lineAdv * PITCH.length : PITCH.length - lineAdv * PITCH.length;
    }
  } else {
    for (const p of team.players) p.markTarget = null;
    team.defensiveLineX = undefined;
  }
}

function tryTackle(player, ctx) {
  const { ball, carrier, match, difficulty } = ctx;
  if (!carrier || carrier.team === player.team) return;
  if (player.tackleCooldown > 0 || player.isSliding || !player.isActive) return;
  const d = dist(player.x, player.y, carrier.x, carrier.y);
  if (d > PLAYER.reach + 1.3) return;

  const skill = player.attributes.defending / 100;
  const evade = carrier.attributes.pace / 100;
  const chance = clamp(0.35 + (skill - evade) * 0.9, 0.08, 0.85) * difficulty.aiPressure;
  if (Math.random() < chance * 0.14) {
    match.attemptTackle(player, carrier, false);
  } else if (d < 2.6 && Math.random() < 0.006 * difficulty.aiPressure && advancementSafe(player, ctx)) {
    match.attemptTackle(player, carrier, true);
  }
}

function advancementSafe(player, ctx) {
  // Don't slide inside our own box unless it's a genuine emergency.
  return !player.isInsideOwnBox();
}

export function updateTeamAI(team, opp, match, dt) {
  const ctx = {
    ball: match.ball,
    team,
    opp,
    match,
    difficulty: match.difficulty,
    carrier: match.carrier,
    dt,
  };
  team.match = match;
  opp.match = match;

  assignRoles(team, ctx);

  const hasBall = ctx.carrier && ctx.carrier.team === team;

  for (const player of team.players) {
    if (player.controlledByUser) continue;
    if (!player.isActive) {
      player.idle();
      continue;
    }

    if (player.isKeeper) {
      updateKeeper(player, ctx);
      continue;
    }

    player.aiTimer -= dt;

    if (player === ctx.carrier) {
      carryMovement(player, ctx);
      if (player.aiTimer <= 0 && player.kickCooldown <= 0) {
        player.aiTimer = match.difficulty.aiReaction * rand(1.35, 0.7);
        decideOnBall(player, ctx);
      }
    } else if (hasBall) {
      attackingMovement(player, ctx);
    } else if (player.aiAssignment) {
      defensiveMovement(player, ctx, player.aiAssignment);
      tryTackle(player, ctx);
    } else {
      defensiveMovement(player, ctx, 'shape');
      tryTackle(player, ctx);
    }
  }
}

/**
 * Off-ball AI for a human-controlled side: everyone except the controlled
 * player still needs to behave like a team.
 */
export function updateAssistedTeammates(team, opp, match, dt) {
  updateTeamAI(team, opp, match, dt);
}

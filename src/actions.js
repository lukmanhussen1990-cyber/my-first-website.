/**
 * Everything that puts boot to ball. Both the AI and the human controller go
 * through these helpers so a 25-yard screamer behaves the same either way.
 */

import { BALL, PITCH } from './constants.js';
import { clamp, noise, normalise } from './math.js';

/** Initial ground speed needed to reach `d` metres with a bit of pace left. */
export function groundPassSpeed(d, power = 1) {
  return clamp(d * 0.95 * power + 3.2, 5, 30);
}

/** Vertical launch speed for a lofted ball that lands around `d` metres away. */
export function loftFor(d) {
  return clamp(3.6 + d * 0.2, 3.6, 10.5);
}

/**
 * Core kick. Aims from the ball towards (tx, ty), with optional loft and spin.
 * Returns the resulting flight so callers can log a shot, pass, etc.
 */
export function strikeBall(player, ball, tx, ty, opts = {}) {
  const {
    speed = 14,
    vz = 0,
    spin = 0,
    accuracy = 1, // 1 = perfect, lower spreads the aim
    cooldown = 0.42,
  } = opts;

  const dx = tx - ball.x;
  const dy = ty - ball.y;
  let [nx, ny] = normalise(dx, dy);
  if (nx === 0 && ny === 0) {
    nx = Math.cos(player.heading);
    ny = Math.sin(player.heading);
  }

  // Aim error grows as accuracy drops, and with how fast the striker is moving.
  const spread = (1 - clamp(accuracy, 0, 1)) * 0.34 + Math.min(player.speed, 9) * 0.004;
  const angle = Math.atan2(ny, nx) + noise() * spread;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  ball.kick(vx, vy, vz, spin);
  ball.x += Math.cos(angle) * (player.radius * 0.4);
  ball.y += Math.sin(angle) * (player.radius * 0.4);
  ball.lastTouch = player;
  ball.lastTouchSide = player.side;
  ball.owner = null;
  player.kickCooldown = cooldown;
  player.heading = angle;
  return { angle, speed, vz };
}

export function passBall(player, ball, target, opts = {}) {
  const { lofted = false, power = 1, accuracy = 1, lead = 0 } = opts;
  let tx = target.x;
  let ty = target.y;
  if (lead > 0 && target.vx !== undefined) {
    tx += target.vx * lead;
    ty += target.vy * lead;
  }
  const d = Math.hypot(tx - ball.x, ty - ball.y);
  if (lofted) {
    const vz = loftFor(d);
    const flight = (2 * vz) / BALL.gravity;
    const speed = clamp(d / Math.max(flight, 0.35), 5, 26);
    return strikeBall(player, ball, tx, ty, { speed, vz, accuracy, cooldown: 0.45 });
  }
  return strikeBall(player, ball, tx, ty, {
    speed: groundPassSpeed(d, power),
    accuracy,
    cooldown: 0.34,
  });
}

/** Shot power in m/s for a player at a given charge (0..1). */
export function shotSpeed(player, charge) {
  const base = 19 + (player.attributes.shooting / 100) * 13;
  return base * (0.62 + 0.38 * clamp(charge, 0, 1));
}

export function shootBall(player, ball, tx, ty, opts = {}) {
  const { charge = 1, accuracy = 1, curl = 0, chip = false } = opts;
  const d = Math.hypot(tx - ball.x, ty - ball.y);
  const speed = shotSpeed(player, charge);
  // Long-range efforts naturally rise; close range stays low and hard.
  let vz = chip ? clamp(5.5 + d * 0.12, 5.5, 9) : clamp((d - 8) * 0.06, 0, 2.6) * (0.5 + charge * 0.8);
  if (!chip && charge > 0.85 && d > 18) vz += 0.9;
  return strikeBall(player, ball, tx, ty, {
    speed: chip ? speed * 0.62 : speed,
    vz,
    spin: curl,
    accuracy,
    cooldown: 0.5,
  });
}

/** Hoof it: away from our own goal, towards the nearest touchline if panicking. */
export function clearBall(player, ball, opts = {}) {
  const dir = player.side === 0 ? 1 : -1;
  const towardsY = ball.y < PITCH.width / 2 ? -1 : 1;
  const tx = ball.x + dir * 34;
  const ty = clamp(ball.y + towardsY * 16, -2, PITCH.width + 2);
  return strikeBall(player, ball, tx, ty, {
    speed: 21 + Math.random() * 4,
    vz: 7.5,
    accuracy: 0.7 + (player.attributes.passing / 100) * 0.2,
    cooldown: 0.5,
    ...opts,
  });
}

/**
 * Dribble touch: nudge the ball to stay just ahead of the carrier's feet.
 * Called every frame while a player is in control.
 */
export function dribble(player, ball, dt, opts = {}) {
  const { touchDistance = 0.85, sprinting = false } = opts;
  const ahead = touchDistance + (sprinting ? 0.65 : 0) + Math.min(player.speed, 9) * 0.075;
  const tx = player.x + Math.cos(player.heading) * ahead;
  const ty = player.y + Math.sin(player.heading) * ahead;
  const dx = tx - ball.x;
  const dy = ty - ball.y;
  // Spring the ball towards the target touch point rather than snapping it,
  // which is what makes heavy touches and tight control feel different.
  const stiffness = sprinting ? 11 : 17;
  ball.vx += dx * stiffness * dt;
  ball.vy += dy * stiffness * dt;
  const damp = Math.exp(-6 * dt);
  ball.vx *= damp;
  ball.vy *= damp;
  ball.z *= Math.exp(-9 * dt);
  if (ball.z < 0.05) ball.z = 0;
  ball.vz = Math.min(ball.vz, 0);
  ball.lastTouch = player;
  ball.lastTouchSide = player.side;
}

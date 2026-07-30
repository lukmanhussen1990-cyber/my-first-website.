import { PITCH, SIDE, attackDir, ownGoalX, targetGoalX } from './constants.js';
import { clamp, lerp } from './math.js';
import { Player } from './player.js';
import { FORMATIONS, buildSquad } from './teams.js';

/** How strongly each role follows the block up and down the pitch. */
const DEPTH_FACTOR = { GK: 0.12, DEF: 1.0, MID: 0.92, FWD: 0.62 };
/** How strongly each role slides across towards the ball. */
const LATERAL_FACTOR = { GK: 0.1, DEF: 0.34, MID: 0.3, FWD: 0.18 };

export class Team {
  constructor(data, side, options = {}) {
    this.data = data;
    this.side = side;
    this.name = data.name;
    this.short = data.short;
    this.kit = data.kit;
    // Swapped for a change strip by the match if the two sides clash.
    this.activeKit = data.kit;
    this.altKit = data.altKit || data.kit;
    this.keeperKit = data.keeperKit;
    this.style = data.style;
    this.formationKey = options.formation || data.formation;
    this.formation = FORMATIONS[this.formationKey];
    this.isUser = Boolean(options.isUser);
    this.userSlots = [];
    this.mentality = 0; // -1 defensive .. +1 chasing the game
    this.players = buildSquad({ ...data, formation: this.formationKey }).map(
      (spec) => new Player(spec, side, this)
    );
    // `players` only ever holds those on the pitch; `squad` keeps everyone for
    // post-match stats, so a red card is just a removal from `players`.
    this.squad = [...this.players];
    this.sentOff = [];
    this.keeper = this.players.find((p) => p.isKeeper);
    this.defensiveLineX = undefined;
    this.score = 0;
    this.stats = { shots: 0, onTarget: 0, possessionTicks: 0, passes: 0, passesCompleted: 0, fouls: 0, corners: 0, saves: 0 };
  }

  get attackDir() {
    return attackDir(this.side);
  }

  get goalX() {
    return targetGoalX(this.side);
  }

  get ownGoalX() {
    return ownGoalX(this.side);
  }

  /**
   * Normalised ball position in this team's frame of reference:
   * x = 0 at our own goal line, 1 at the opponent's.
   */
  toTeamFrame(x, y) {
    if (this.side === SIDE.HOME) return [x / PITCH.length, y / PITCH.width];
    return [1 - x / PITCH.length, 1 - y / PITCH.width];
  }

  toWorld(nx, ny) {
    if (this.side === SIDE.HOME) return [nx * PITCH.length, ny * PITCH.width];
    return [(1 - nx) * PITCH.length, (1 - ny) * PITCH.width];
  }

  /**
   * The position a player should hold when they are not doing anything more
   * interesting: the formation slot, shifted by ball position and mentality.
   */
  shapePosition(player, ball, hasPossession) {
    const [bx, by] = this.toTeamFrame(ball.x, ball.y);
    const depth = DEPTH_FACTOR[player.role];
    const lateral = LATERAL_FACTOR[player.role];

    const line = this.style.line;
    const aggression = clamp(line + this.mentality * 0.12 + (hasPossession ? 0.06 : -0.04), 0.28, 0.78);
    // The whole block slides between a deep shell and a high line.
    const push = lerp(-0.13, 0.32, clamp(bx * 0.75 + aggression * 0.35, 0, 1));

    let sx = player.slot.x + push * depth;
    if (player.role === 'FWD' && !hasPossession) sx -= 0.05;
    if (player.role === 'DEF' && hasPossession) sx += 0.03;
    sx = clamp(sx, player.isKeeper ? 0.012 : 0.06, 0.95);

    let sy = player.slot.y + (by - 0.5) * lateral;
    const widthScale = this.style.width * (hasPossession ? 1.05 : 0.86);
    sy = 0.5 + (sy - 0.5) * widthScale;
    sy = clamp(sy, 0.045, 0.955);

    const [wx, wy] = this.toWorld(sx, sy);
    return [wx, wy];
  }

  /** x of the second-rearmost outfield defender — the offside line. */
  offsideLineX() {
    const xs = this.players
      .filter((p) => !p.isKeeper)
      .map((p) => (this.side === SIDE.HOME ? p.x : PITCH.length - p.x))
      .sort((a, b) => a - b);
    const keeperX = this.side === SIDE.HOME ? this.keeper.x : PITCH.length - this.keeper.x;
    const all = [keeperX, ...xs].sort((a, b) => a - b);
    const second = all.length > 1 ? all[1] : all[0];
    return this.side === SIDE.HOME ? second : PITCH.length - second;
  }

  /** Remove a player from the pitch after a red card. */
  sendOff(player) {
    const i = this.players.indexOf(player);
    if (i === -1) return;
    this.players.splice(i, 1);
    this.sentOff.push(player);
    player.isSentOff = true;
    // Park them off the field of play so nothing tries to interact with them.
    player.x = this.toWorld(0.5, -0.02)[0];
    player.y = -PITCH.margin + 1;
    player.vx = 0;
    player.vy = 0;
  }

  nearestTo(x, y, filter = () => true) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!filter(p)) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  resetPlayers(ball, kickoffSide) {
    for (const p of this.players) {
      const [x, y] = this.kickoffPosition(p, kickoffSide === this.side);
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.slideTimer = 0;
      p.diveTimer = 0;
      p.stunTimer = 0;
      p.kickCooldown = 0;
      p.holdTimer = 0;
      p.heading = this.attackDir > 0 ? 0 : Math.PI;
    }
  }

  kickoffPosition(player, taking) {
    // Everyone in their own half; the side kicking off puts two in the circle.
    let sx = clamp(player.slot.x * 0.92, 0.012, 0.47);
    let sy = player.slot.y;
    if (taking && player.role === 'FWD') {
      const centreish = Math.abs(player.slot.y - 0.5) < 0.2;
      sx = centreish ? 0.478 : 0.44;
      sy = centreish ? 0.5 + (player.slot.y - 0.5) * 0.12 : player.slot.y;
    }
    const [wx, wy] = this.toWorld(sx, sy);
    return [wx, wy];
  }
}

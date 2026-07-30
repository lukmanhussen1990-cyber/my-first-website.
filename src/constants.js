/**
 * Tunable constants. All world units are metres and seconds, matching a real
 * pitch, so physics numbers can be reasoned about against real football.
 */

export const PITCH = {
  length: 105,
  width: 68,
  // Distance of playable margin drawn around the pitch (grass runoff).
  margin: 6,
  goalWidth: 7.32,
  goalDepth: 2.0,
  postRadius: 0.06,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpot: 11,
  centreCircle: 9.15,
  cornerArc: 1,
};

PITCH.goalTop = PITCH.width / 2 - PITCH.goalWidth / 2;
PITCH.goalBottom = PITCH.width / 2 + PITCH.goalWidth / 2;

export const BALL = {
  radius: 0.11,
  mass: 0.43,
  // Rolling friction as a fraction of speed lost per second.
  drag: 0.42,
  // Extra drag applied while airborne (air resistance is far lower).
  airDrag: 0.06,
  gravity: 9.81,
  bounce: 0.62,
  spinDecay: 1.6,
  // Magnus-ish sideways acceleration per unit spin per unit speed.
  curl: 0.055,
  maxSpeed: 42,
};

export const PLAYER = {
  radius: 0.55,
  reach: 1.05,
  // Base movement, scaled per-player by the pace attribute.
  walkSpeed: 3.2,
  runSpeed: 7.0,
  sprintSpeed: 9.1,
  accel: 26,
  decel: 32,
  turnRate: 11,
  staminaMax: 100,
  staminaDrain: 13,
  staminaRegen: 9,
  // Seconds a player cannot re-collect the ball after kicking it.
  kickCooldown: 0.42,
  tackleCooldown: 1.1,
  slideDuration: 0.55,
  slideSpeed: 11.5,
};

export const KEEPER = {
  radius: 0.62,
  reach: 1.9,
  diveSpeed: 10.5,
  diveDuration: 0.7,
  diveCooldown: 0.9,
  // How far off the line the keeper is willing to stray.
  maxRush: 15,
  holdTime: 1.6,
};

export const MATCH = {
  // Real seconds per half, chosen in the menu; the clock displays 45 in-game
  // minutes compressed into that window.
  halfSecondsOptions: [90, 150, 240],
  displayMinutesPerHalf: 45,
  restartDistance: 9.15,
  kickoffRestartDistance: 9.15,
  ceremonyGoal: 3.4,
  ceremonyHalf: 3.0,
};

export const DIFFICULTY = {
  easy: {
    label: 'Amateur',
    aiSpeed: 0.9,
    aiReaction: 0.34,
    aiPassError: 0.16,
    aiShotError: 0.14,
    aiPressure: 0.6,
    keeperSkill: 0.72,
  },
  normal: {
    label: 'Semi-Pro',
    aiSpeed: 0.97,
    aiReaction: 0.22,
    aiPassError: 0.1,
    aiShotError: 0.09,
    aiPressure: 0.8,
    keeperSkill: 0.85,
  },
  hard: {
    label: 'Professional',
    aiSpeed: 1.0,
    aiReaction: 0.14,
    aiPassError: 0.06,
    aiShotError: 0.055,
    aiPressure: 1.0,
    keeperSkill: 0.94,
  },
  legend: {
    label: 'World Class',
    aiSpeed: 1.04,
    aiReaction: 0.08,
    aiPassError: 0.035,
    aiShotError: 0.035,
    aiPressure: 1.15,
    keeperSkill: 1.0,
  },
};

export const STATE = {
  KICKOFF: 'kickoff',
  PLAYING: 'playing',
  THROW_IN: 'throw_in',
  GOAL_KICK: 'goal_kick',
  CORNER: 'corner',
  FREE_KICK: 'free_kick',
  PENALTY: 'penalty',
  GOAL: 'goal',
  HALF_TIME: 'half_time',
  FULL_TIME: 'full_time',
  SHOOTOUT: 'shootout',
};

export const SIDE = { HOME: 0, AWAY: 1 };

/** Direction a side attacks in: home attacks +x, away attacks -x. */
export const attackDir = (side) => (side === SIDE.HOME ? 1 : -1);

/** x coordinate of the goal line a side is attacking towards. */
export const targetGoalX = (side) => (side === SIDE.HOME ? PITCH.length : 0);

/** x coordinate of the goal line a side is defending. */
export const ownGoalX = (side) => (side === SIDE.HOME ? 0 : PITCH.length);

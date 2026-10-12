// Cursed Floating Eyeball Guardian - shared constants.
// Every identifier here must match docs/SPEC.md (entity, items, properties,
// particles, sounds, UI icons). Gameplay tuning numbers live here too, so the
// other modules never hard-code magic values.

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------
export const GUARDIAN_ID = 'ceg:eyeball_guardian';
export const GUARDIAN_FAMILY = 'ceg_guardian';
export const PLAYER_TYPE_ID = 'minecraft:player';

export const ITEM_SUMMONER = 'ceg:eyeball_summoner';
export const ITEM_UPGRADE = 'ceg:eyeball_upgrade';
export const ITEM_CONTROLLER = 'ceg:eyeball_controller';

/** Player dynamic property holding the JSON save data. */
export const DP_PLAYER_DATA = 'ceg:data';
/** Guardian dynamic property: owner player id. */
export const DP_OWNER = 'ceg:owner';
/** Guardian dynamic property: spawn token (must equal the owner's current token). */
export const DP_TOKEN = 'ceg:token';

export const PROP_RAGE = 'ceg:rage';
export const PROP_SKIN = 'ceg:skin';
export const PROP_LEVEL = 'ceg:level';
export const PROP_MODE = 'ceg:mode';

export const EVENT_DESPAWN = 'ceg:despawn';
export const EVENT_RAGE_ON = 'ceg:rage_on';
export const EVENT_RAGE_OFF = 'ceg:rage_off';

/**
 * Entity event that swaps the health component group for a level.
 * @param {number} level 1-5
 */
export function levelEvent(level) {
  return `ceg:set_level_${level}`;
}

export const ANIM_ATTACK = 'animation.ceg.eyeball_guardian.attack';

export const DIMENSION_IDS = ['overworld', 'nether', 'the_end'];

// ---------------------------------------------------------------------------
// Modes (entity property ceg:mode)
// ---------------------------------------------------------------------------
export const MODE = Object.freeze({ FOLLOW: 0, ATTACK: 1, SHIELD: 2, DESTROY: 3, PASSIVE: 4 });
export const MODE_KEYS = ['follow', 'attack', 'shield', 'destroy', 'passive'];
export const MODE_LABELS = ['Follow', 'Attack', 'Shield', 'Destroy', 'Passive'];
export const MODE_HINTS = [
  'Guards you, zaps mobs within 10 blocks',
  'Hunts every hostile within 20 blocks',
  'Hovers overhead, shields you from damage',
  'Follows you and blasts blocks on command',
  'Just floats along, never attacks',
];
/** Auto-target scan radius (blocks, measured from the owner) per mode. */
export const MODE_SCAN_RANGE = [10, 20, 4, 10, 0];

// ---------------------------------------------------------------------------
// Skins (entity property ceg:skin) - colours are the SPEC "primary" colours
// ---------------------------------------------------------------------------
export const SKINS = [
  { key: 'crimson', label: 'Crimson', text: '§c', button: '§4', primary: { red: 1.0, green: 0.08, blue: 0.08 } },
  { key: 'void', label: 'Void', text: '§d', button: '§5', primary: { red: 0.72, green: 0.2, blue: 1.0 } },
  { key: 'frost', label: 'Frost', text: '§b', button: '§3', primary: { red: 0.15, green: 0.6, blue: 1.0 } },
  { key: 'toxic', label: 'Toxic', text: '§a', button: '§2', primary: { red: 0.25, green: 1.0, blue: 0.3 } },
];

// ---------------------------------------------------------------------------
// Levels & laser
// ---------------------------------------------------------------------------
export const MAX_LEVEL = 5;
export const LEVEL_HEALTH = [40, 55, 70, 85, 100];
export const LASER_DAMAGE = [6, 8, 10, 12, 15];
export const LASER_COOLDOWN = [30, 26, 22, 18, 14];
export const LASER_RANGE = [16, 17, 18, 19, 20];

export const LASER = Object.freeze({
  KNOCKBACK_H: 0.6,
  KNOCKBACK_V: 0.25,
  SEGMENT_STEP: 0.35,
  MAX_SEGMENTS: 48,
  /** Lens sits ~0.53 blocks in front of the eye centre (SPEC locator "lens"). */
  LENS_FORWARD: 0.55,
  /**
   * Mobs ignore new damage for ~10 ticks after being hurt (hurt invulnerability),
   * so a faster rage cooldown would waste shots. Never fire faster than this.
   */
  MIN_COOLDOWN: 10,
  /** Commanded shots may reach as far as the command ray. */
  COMMAND_RANGE: 48,
  /** Auto targets that stay out of sight for this many attempts are dropped. */
  MAX_BLOCKED_SHOTS: 6,
});

export const RAGE = Object.freeze({
  DURATION: 200,
  DAMAGE_MULT: 1.5,
  COOLDOWN_MULT: 0.5,
  SPEED_MULT: 1.6,
  SPLASH_RADIUS: 2.5,
  SPLASH_FACTOR: 0.5,
  SPLASH_MAX: 6,
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------
export const MOVE = Object.freeze({
  /** Collision box is 1.0 tall; the eye centre is 0.5 above the entity origin. */
  EYE_OFFSET: 0.5,
  SHOULDER_RIGHT: 1.4,
  SHOULDER_UP: 1.9,
  SHOULDER_BACK: 0.45,
  BOB_AMPLITUDE: 0.18,
  ORBIT_AMPLITUDE: 0.3,
  SHIELD_UP: 2.7,
  SHIELD_ORBIT: 0.35,
  ATTACK_DISTANCE: 5,
  ATTACK_HEIGHT: 2.5,
  LEASH: 18,
  /** Desired velocity = (anchor - position) * GAIN, clamped to MAX_SPEED. */
  GAIN: 0.22,
  MAX_SPEED: 0.45,
  /** Blend factor between the current and the desired velocity. */
  SMOOTHING: 0.5,
  ARRIVE_EPSILON: 0.04,
  /** Owner yaw smoothing (so the guardian swoops instead of snapping when you turn). */
  YAW_FOLLOW: 0.12,
  TELEPORT_DISTANCE: 24,
  STUCK_DISTANCE: 2.5,
  STUCK_MOVE_EPSILON: 0.035,
  STUCK_TICKS: 30,
  ANCHOR_CHECK_INTERVAL: 2,
  LOOK_AHEAD: 8,
});

// ---------------------------------------------------------------------------
// Timing (ticks unless noted)
// ---------------------------------------------------------------------------
export const TIMING = Object.freeze({
  SCAN_INTERVAL: 4,
  SLOW_INTERVAL: 20,
  SWEEP_INTERVAL: 200,
  SWEEP_RADIUS: 48,
  MISSING_RESPAWN_DELAY: 60,
  JOIN_RESPAWN_DELAY: 40,
  DIMENSION_RESPAWN_DELAY: 30,
  MAX_RESPAWN_BACKOFF_STEPS: 4,
  SHORT_LIFE: 100,
  STABLE_LIFE: 200,
  ORPHAN_GRACE: 200,
  DOOMED_MEMORY: 600,
  REVENGE_DURATION: 200,
  GUARDIAN_REVENGE_DURATION: 120,
  REVENGE_MAX_DISTANCE: 40,
  COMMAND_DURATION: 400,
  ASSIST_DURATION: 200,
  ITEM_DEBOUNCE: 8,
  KILL_CREDIT: 100,
  TELEPORT_FX_COOLDOWN: 40,
  /** Wall-clock milliseconds a dead guardian needs before it can be summoned again. */
  DEATH_COOLDOWN_MS: 30000,
  UI_BUSY_RETRIES: 8,
  UI_RETRY_DELAY: 10,
  MAX_LEVEL_FIXES: 3,
});

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------
export const SHIELD = Object.freeze({
  RESIST_INTERVAL: 40,
  RESIST_DURATION: 60,
  RESIST_AMPLIFIER: 1,
  DOME_INTERVAL: 20,
  REFUND: 0.25,
});

export const HEAL = Object.freeze({
  CHECK_INTERVAL: 10,
  THRESHOLD: 0.4,
  REGEN_DURATION: 120,
  REGEN_AMPLIFIER: 1,
  INSTANT: 4,
  BASE_COOLDOWN_SECONDS: 30,
  PER_LEVEL_SECONDS: 4,
});

export const NIGHT_VISION = Object.freeze({ INTERVAL: 100, DURATION: 420 });

export const GUARDIAN_REGEN = Object.freeze({ INTERVAL: 40, AMOUNT: 1, OUT_OF_COMBAT: 100 });

export const DESTROY = Object.freeze({ COOLDOWN: 20, MAX_DISTANCE: 48 });

export const BIND_RADIUS = 32;

/** "monster" family members that are only attacked after they hurt the owner. */
export const NEUTRAL_HOSTILES = [
  'minecraft:enderman',
  'minecraft:zombie_pigman',
  'minecraft:piglin',
  'minecraft:warden',
];

/** Types never picked by the automatic hostile scan. */
export const AUTO_EXCLUDED_TYPES = [...NEUTRAL_HOSTILES, GUARDIAN_ID];

/**
 * Blocks the destroy laser never breaks. Names that do not exist in the running
 * game version are filtered out at first use (see combat.js), so the list can
 * safely include ids from newer versions (light_block_N).
 */
export const PROTECTED_BLOCKS = [
  'minecraft:bedrock',
  'minecraft:invisible_bedrock',
  'minecraft:barrier',
  'minecraft:command_block',
  'minecraft:chain_command_block',
  'minecraft:repeating_command_block',
  'minecraft:structure_block',
  'minecraft:structure_void',
  'minecraft:jigsaw',
  'minecraft:end_portal',
  'minecraft:end_portal_frame',
  'minecraft:portal',
  'minecraft:end_gateway',
  'minecraft:reinforced_deepslate',
  'minecraft:light_block',
  'minecraft:border_block',
  'minecraft:allow',
  'minecraft:deny',
  ...Array.from({ length: 16 }, (_, i) => `minecraft:light_block_${i}`),
];

// ---------------------------------------------------------------------------
// Particles, sounds, UI icons
// ---------------------------------------------------------------------------
export const PARTICLES = Object.freeze({
  LASER_SEGMENT: 'ceg:laser_segment',
  LASER_CHARGE: 'ceg:laser_charge',
  IMPACT: 'ceg:impact',
  RAGE_BURST: 'ceg:rage_burst',
  SHIELD_DOME: 'ceg:shield_dome',
  SHIELD_HIT: 'ceg:shield_hit',
  HEAL: 'ceg:heal',
  TELEPORT: 'ceg:teleport',
  SUMMON: 'ceg:summon',
  BLOCK_BREAK: 'ceg:block_break',
  LEVEL_UP: 'ceg:level_up',
});

export const SOUNDS = Object.freeze({
  SUMMON: 'ceg.guardian.summon',
  LASER: 'ceg.guardian.laser',
  IMPACT: 'ceg.guardian.impact',
  RAGE: 'ceg.guardian.rage',
  TELEPORT: 'ceg.guardian.teleport',
  SHIELD: 'ceg.guardian.shield',
  SHIELD_HIT: 'ceg.guardian.shield_hit',
  HEAL: 'ceg.guardian.heal',
  DESTROY: 'ceg.guardian.destroy',
  LEVEL_UP: 'ceg.guardian.levelup',
  MODE: 'ceg.guardian.mode',
  MENU: 'ceg.guardian.menu',
});

/**
 * UI button icon path (RP/textures/ceg/ui/<name>.png, referenced without extension).
 * @param {string} name
 */
export function uiIcon(name) {
  return `textures/ceg/ui/${name}`;
}

export const MODE_ICONS = ['follow', 'attack', 'shield', 'destroy', 'passive'];

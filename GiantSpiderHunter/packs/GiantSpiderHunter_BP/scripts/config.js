// Giant Spider Hunter - tunables.
//
// Every value here can be overridden in game with
//   /scriptevent gsh:config <key> <value>
// Overrides are stored in the world dynamic property "gsh:config" (only the keys that differ
// from these defaults) and survive restarts. `/scriptevent gsh:config reset` clears them.
// This module is pure JavaScript (no engine imports) so it can be unit tested in Node.

export const VERSION = '1.0.0';

// Each entry: [default, type, min, max, description]
//   type: 'num' (float), 'int', 'bool', or an array of allowed strings.
const SCHEMA = {
  // ---------------------------------------------------------------- general
  autoSpawn: [true, 'bool', 0, 0, 'Auto spawner enabled (one auto-managed hunter at a time).'],
  debug: [false, 'bool', 0, 0, 'Debug logging to the console and a debug action bar for players.'],
  messages: [true, 'bool', 0, 0, 'Flavour action-bar messages (being hunted / escaped).'],

  // ---------------------------------------------------------------- size / health
  smallScale: [0.075, 'num', 0.02, 0.5, 'Model scale of the small stalker form (horror:small_scale).'],
  giantScale: [1.4, 'num', 0.25, 3.0, 'Model scale of the giant form (horror:giant_scale); also scales reach.'],
  growTime: [4.0, 'num', 0.5, 20.0, 'Client-side visual growth time in seconds (horror:grow_time).'],
  health: [300, 'num', 1, 500, 'Real hit points of a new spider (health buffer: entity health = 500 + this).'],

  // ---------------------------------------------------------------- idle / stalking
  idleRange: [64, 'num', 8, 128, 'An eligible player within this range wakes an idle spider into stalking.'],
  stalkMinDistance: [14, 'num', 2, 64, 'Stalker relocates when it is closer than this (horizontally) to its focus (while unseen).'],
  stalkMaxDistance: [56, 'num', 8, 128, 'Stalker relocates when it is farther than this (horizontally) from its focus (while unseen).'],
  relocateSettleSeconds: [10, 'num', 0, 600, 'A stalker does not relocate during its first seconds of stalking.'],
  relocateMinDistance: [20, 'num', 4, 64, 'Minimum distance of a hidden relocation spot from the focus player.'],
  relocateMaxDistance: [32, 'num', 6, 96, 'Maximum distance of a hidden relocation spot from the focus player.'],
  relocateIntervalMin: [15, 'num', 2, 600, 'Minimum seconds between routine relocations.'],
  relocateIntervalMax: [30, 'num', 2, 600, 'Maximum seconds between routine relocations.'],
  viewConeDegrees: [70, 'num', 10, 180, 'Half angle of a player view cone: the stalker only relocates while outside every cone (or hidden by blocks).'],
  maxTurnDegreesPerTick: [15, 'num', 1, 180, 'Maximum stalker body turn rate while facing its focus.'],
  lookAngleDegrees: [12, 'num', 1, 45, 'Look trigger: view direction within this angle of the spider body centre.'],
  lookRange: [56, 'num', 4, 128, 'Look trigger: maximum distance.'],
  lookSeconds: [0.6, 'num', 0.05, 10, 'Look trigger: accumulated seconds of being looked at (with line of sight).'],
  approachRange: [10, 'num', 1, 64, 'Approach trigger: an eligible player within this distance.'],
  stalkTimeoutSeconds: [90, 'num', 5, 3600, 'Timeout trigger: seconds of stalking before the timeout action.'],
  stalkTimeoutAction: ['hunt', ['hunt', 'vanish'], 0, 0, "Timeout action: 'hunt' (grow and hunt) or 'vanish' (despawn)."],
  restalkLockSeconds: [10, 'num', 0, 600, 'After cooldown -> stalking, no trigger can fire for this many seconds.'],
  ambientIntervalMin: [8, 'num', 1, 600, 'Minimum seconds between stalker chitter sounds.'],
  ambientIntervalMax: [20, 'num', 1, 600, 'Maximum seconds between stalker chitter sounds.'],
  autoIdleDespawnSeconds: [120, 'num', 10, 3600, 'An auto-managed spider that stays idle (nobody within idleRange) this long despawns and ends the encounter.'],

  // ---------------------------------------------------------------- growth
  growthDurationSeconds: [4.5, 'num', 0.5, 20, 'Seconds the spider stays in the growing state before hunting.'],
  roarVolume: [4.0, 'num', 0, 10, 'Volume of the roar played to the world.'],
  shakeRadius: [48, 'num', 0, 256, 'Players within this distance get a camera shake when it grows.'],
  shakeIntensity: [0.6, 'num', 0, 4, 'Camera shake intensity at point blank (fades with distance).'],
  shakeSeconds: [3.0, 'num', 0.1, 20, 'Camera shake duration in seconds.'],

  // ---------------------------------------------------------------- strikes
  strikeDamage: [6, 'num', 0, 200, 'Damage of a leg strike (ground stab or high reach) before the difficulty multiplier.'],
  biteDamage: [8, 'num', 0, 200, 'Damage of a point-blank bite before the difficulty multiplier.'],
  damageMultEasy: [0.6, 'num', 0, 10, 'Damage multiplier when horror:difficulty = 1 (easy).'],
  damageMultNormal: [1.0, 'num', 0, 10, 'Damage multiplier when horror:difficulty = 2 (normal).'],
  damageMultHard: [1.5, 'num', 0, 10, 'Damage multiplier when horror:difficulty = 3 (hard).'],
  strikeWindupSeconds: [0.35, 'num', 0, 3, 'Seconds between strike start (animation) and the damage check.'],
  attackCooldownSeconds: [1.8, 'num', 0.1, 30, 'Seconds between strikes.'],
  reachTolerance: [1.15, 'num', 1, 3, 'Reach multiplier used for the re-check at impact time.'],
  bodyCenterHeight: [13, 'num', 0, 40, 'Body centre height above the feet in blocks at giant scale 1.'],
  groundReachRadius: [7, 'num', 0, 40, 'Ground strike: horizontal reach all around (x giant scale).'],
  frontReachRadius: [12.5, 'num', 0, 40, 'Ground strike: horizontal reach inside the front arc (x giant scale).'],
  frontArcDegrees: [120, 'num', 0, 360, 'Ground strike: width of the front arc in degrees.'],
  verticalReach: [4, 'num', 0, 40, 'Ground strike: maximum vertical offset (x giant scale).'],
  airReachRadius: [9.5, 'num', 0, 40, 'High strike: reach from the body centre for airborne/elevated targets (x giant scale).'],
  elevatedHeight: [3, 'num', 0, 40, 'A target more than this many blocks above the ground counts as airborne/elevated.'],
  biteRange: [2.5, 'num', 0, 10, 'Point-blank distance (blocks) that turns a strike into a bite.'],
  knockbackHorizontal: [1.4, 'num', 0, 10, 'Strike knockback horizontal strength.'],
  knockbackVertical: [0.45, 'num', -5, 5, 'Strike knockback vertical strength (high strikes on gliding targets knock down instead).'],

  // ---------------------------------------------------------------- chase
  chaseSpeedMultiplier: [1.0, 'num', 0.25, 3, 'Chase speed multiplier, applied as Speed (+20%/level) or Slowness (-15%/level) effects.'],
  catchUpDistance: [40, 'num', 0, 256, 'Beyond this distance from its focus the hunter gets catchUpMultiplier on top.'],
  catchUpMultiplier: [1.2, 'num', 1, 3, 'Extra speed multiplier while the focus is beyond catchUpDistance.'],
  heartbeat: [true, 'bool', 0, 0, 'Play a heartbeat to the hunted player (faster when closer).'],
  huntTargetRange: [72, 'num', 8, 128, 'Range used to pick a focus when hunting starts without one.'],
  stuckSeconds: [2, 'int', 1, 30, 'Seconds without progress (target away) before the giant steps over the obstacle.'],
  stepOverDistance: [4, 'int', 2, 8, 'Maximum length of a step-over hop toward the target (blocks).'],

  // ---------------------------------------------------------------- escape
  contactRange: [24, 'num', 1, 128, 'Contact: always in contact within this distance.'],
  losRange: [72, 'num', 1, 128, 'Contact: in contact within this distance when the body centre sees the player.'],
  escapeDistance: [64, 'num', 8, 256, 'Escape: distance that counts as far away.'],
  escapeDistanceSeconds: [3, 'num', 0, 600, 'Escape: seconds the player must stay beyond escapeDistance.'],
  breakContactSeconds: [15, 'num', 1, 600, 'Escape: seconds without contact.'],
  maxChaseSeconds: [240, 'num', 10, 7200, 'Escape: maximum chase duration.'],
  relentless: [false, 'bool', 0, 0, 'Disable escape (only death, leaving, dimension change or creative/spectator end a chase).'],

  // ---------------------------------------------------------------- cooldown / death
  postChaseCooldownSeconds: [45, 'num', 1, 3600, 'Seconds of harmless cooldown (small form, walks away) after a chase.'],
  cooldownRestalkRange: [48, 'num', 1, 256, 'After cooldown: stalk again if an eligible player is within this range, else despawn.'],
  deathLootDelaySeconds: [3, 'num', 0, 7, 'Seconds after dying starts until loot, XP and despawn.'],
  deathXpOrbs: [25, 'int', 0, 200, 'Number of experience orbs dropped at death.'],

  // ---------------------------------------------------------------- terrain
  terrainSampleIntervalTicks: [6, 'int', 1, 100, 'Ticks between terrain samples of a giant.'],
  terrainMoveThreshold: [0.75, 'num', 0, 16, 'Resample only after moving more than this many blocks...'],
  terrainTurnThreshold: [10, 'num', 0, 180, '...or turning more than this many degrees.'],
  terrainBlockBudget: [120, 'int', 8, 1000, 'Maximum getBlock calls per terrain update.'],
  terrainCacheSeconds: [5, 'num', 0, 60, 'Per-column ground height cache lifetime.'],

  // ---------------------------------------------------------------- auto spawner
  firstEncounterMinSeconds: [60, 'num', 0, 36000, 'Minimum overworld seconds a player must play before being chosen.'],
  firstEncounterMaxSeconds: [120, 'num', 0, 36000, 'Maximum overworld seconds a player must play before being chosen.'],
  spawnMinDistance: [32, 'num', 8, 96, 'Spawn search: minimum distance from the player.'],
  spawnMaxDistance: [48, 'num', 8, 128, 'Spawn search: maximum distance from the player.'],
  spawnCandidatesPerSecond: [4, 'int', 1, 40, 'Spawn search: candidate columns tested per second.'],
  spawnMaxCandidates: [40, 'int', 1, 400, 'Spawn search: candidates per search before backing off.'],
  spawnSearchBackoffSeconds: [10, 'num', 1, 600, 'Back-off after a failed search.'],
  spawnForestPreference: [0.6, 'num', 0, 1, 'Fraction of the attempts that require forest (leaves/logs) before any land is accepted.'],
  spawnColumnBudget: [48, 'int', 8, 200, 'getBlock calls per candidate column scan.'],
  spawnMinOtherPlayerDistance: [24, 'num', 0, 128, 'A spawn spot must be at least this far from every player.'],
  encounterCooldownMin: [300, 'num', 0, 36000, 'Minimum seconds between encounters (counts down while an eligible player is online).'],
  encounterCooldownMax: [480, 'num', 0, 36000, 'Maximum seconds between encounters.'],
  respawnGraceSeconds: [90, 'num', 0, 3600, 'No new encounter for the focus player for this long after they die.'],
  peacefulBackoffSeconds: [120, 'num', 1, 3600, 'Back-off after an auto spider despawned because of peaceful difficulty.'],
  orphanMissingSeconds: [60, 'num', 5, 3600, 'An active encounter whose spider is not found for this long is retired (if its focus is far away).'],
  orphanFarDistance: [128, 'num', 16, 1024, 'Focus distance from the last known spider position that counts as far away.'],
  orphanMaxMissingSeconds: [300, 'num', 30, 36000, 'An active encounter whose spider is missing this long is retired regardless of distance.'],

  // ---------------------------------------------------------------- challenge mode
  challengeMode: [false, 'bool', 0, 0, 'Optional challenge mode: elytra + fireworks, lives, flight only while chased.'],
  challengeLives: [3, 'int', 1, 100, 'Challenge mode: lives per player before becoming a spectator.'],
  challengeFireworks: [32, 'int', 0, 64, 'Challenge mode: firework rockets given with the elytra.'],
};

export const DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(SCHEMA).map(([k, v]) => [k, v[0]])));

/** The live configuration (defaults + overrides). Mutated in place by applyOverrides/setConfigValue. */
export const CONFIG = Object.assign({}, DEFAULTS);

/** Current overrides (only keys that differ from DEFAULTS). */
let overrides = {};

export function configKeys() {
  return Object.keys(SCHEMA);
}

export function describeKey(key) {
  const s = SCHEMA[key];
  if (!s) return undefined;
  const type = Array.isArray(s[1]) ? s[1].join('|') : s[1];
  const range = s[1] === 'num' || s[1] === 'int' ? ` [${s[2]}..${s[3]}]` : '';
  return { key, default: s[0], type, range, description: s[4] };
}

/** Resolve a key case-insensitively. Returns the canonical key or undefined. */
export function resolveKey(key) {
  if (typeof key !== 'string') return undefined;
  if (SCHEMA[key]) return key;
  const low = key.toLowerCase();
  return Object.keys(SCHEMA).find((k) => k.toLowerCase() === low);
}

/** Parse and validate a raw value for a key. Returns {ok, value, error}. */
export function parseValue(key, raw) {
  const s = SCHEMA[key];
  if (!s) return { ok: false, error: `unknown key '${key}'` };
  const type = s[1];
  if (type === 'bool') {
    if (typeof raw === 'boolean') return { ok: true, value: raw };
    const t = String(raw).trim().toLowerCase();
    if (['true', 'on', '1', 'yes'].includes(t)) return { ok: true, value: true };
    if (['false', 'off', '0', 'no'].includes(t)) return { ok: true, value: false };
    return { ok: false, error: `${key} expects true/false` };
  }
  if (Array.isArray(type)) {
    const t = String(raw).trim().toLowerCase();
    if (type.includes(t)) return { ok: true, value: t };
    return { ok: false, error: `${key} expects one of ${type.join(', ')}` };
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return { ok: false, error: `${key} expects a number` };
  const v = type === 'int' ? Math.round(n) : n;
  if (v < s[2] || v > s[3]) return { ok: false, error: `${key} must be within [${s[2]}, ${s[3]}]` };
  return { ok: true, value: v };
}

/** Pairs whose min must not exceed max; fixed up after every change. */
const PAIRS = [
  ['stalkMinDistance', 'stalkMaxDistance'],
  ['relocateMinDistance', 'relocateMaxDistance'],
  ['relocateIntervalMin', 'relocateIntervalMax'],
  ['ambientIntervalMin', 'ambientIntervalMax'],
  ['firstEncounterMinSeconds', 'firstEncounterMaxSeconds'],
  ['spawnMinDistance', 'spawnMaxDistance'],
  ['encounterCooldownMin', 'encounterCooldownMax'],
];

function normalisePairs() {
  for (const [a, b] of PAIRS) {
    if (CONFIG[a] > CONFIG[b]) CONFIG[b] = CONFIG[a];
  }
}

/** Replace all overrides with the given object (invalid entries are dropped). Returns dropped keys. */
export function applyOverrides(obj) {
  const dropped = [];
  overrides = {};
  Object.assign(CONFIG, DEFAULTS);
  if (obj && typeof obj === 'object') {
    for (const [k, raw] of Object.entries(obj)) {
      const key = resolveKey(k);
      const r = key ? parseValue(key, raw) : { ok: false };
      if (!r.ok) {
        dropped.push(k);
        continue;
      }
      if (r.value !== DEFAULTS[key]) {
        overrides[key] = r.value;
        CONFIG[key] = r.value;
      }
    }
  }
  normalisePairs();
  return dropped;
}

/** Set one value. Returns {ok, key, value, error}. */
export function setConfigValue(rawKey, raw) {
  const key = resolveKey(rawKey);
  if (!key) return { ok: false, error: `unknown key '${rawKey}'` };
  const r = parseValue(key, raw);
  if (!r.ok) return { ok: false, key, error: r.error };
  if (r.value === DEFAULTS[key]) delete overrides[key];
  else overrides[key] = r.value;
  CONFIG[key] = r.value;
  normalisePairs();
  return { ok: true, key, value: CONFIG[key] };
}

/** Remove one override (or all when key is omitted). */
export function resetConfig(rawKey) {
  if (rawKey === undefined) {
    applyOverrides({});
    return { ok: true };
  }
  const key = resolveKey(rawKey);
  if (!key) return { ok: false, error: `unknown key '${rawKey}'` };
  delete overrides[key];
  CONFIG[key] = DEFAULTS[key];
  normalisePairs();
  return { ok: true, key, value: CONFIG[key] };
}

export function getOverrides() {
  return Object.assign({}, overrides);
}

export function serializeOverrides() {
  return JSON.stringify(overrides);
}

/** Damage multiplier for the horror:difficulty property value (0 peaceful .. 3 hard). */
export function difficultyMultiplier(difficulty) {
  switch (difficulty) {
    case 1:
      return CONFIG.damageMultEasy;
    case 2:
      return CONFIG.damageMultNormal;
    case 3:
      return CONFIG.damageMultHard;
    default:
      return 0;
  }
}

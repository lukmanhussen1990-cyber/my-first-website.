// Move table — the single source of truth shared by gameplay (hitboxes, timing)
// and the character rigs (poses). Owner: Gameplay agent. Characters agent reads it.
//
// Timing is normalised: u = elapsed / dur (0..1).
//   keys.windup  – u where the wind-up ends and the strike motion starts
//   keys.strike  – u where the strike motion ends and recovery starts
//   keys.extra   – optional array of extra key u's for multi-strike moves (see each move's comment)
// Every hit window [t0, t1] (normalised) lies inside the strike motion(s) so what you
// see is what you hit. Poses must reach full extension / sweep midpoint inside the hit window.
//
// Hit shapes (relative to the attacker's position & facing at the time of the hit):
//   arc:    range (m), angle (deg, total, centred on facing) — angle 360 = circle
//   line:   range (m) forward, width (m)
//   circle: radius (m) around the attacker (+ offset forward `fwd` m)
// react:  'flinch' (stagger in place), 'push' (slide back), 'launch' (pop straight up),
//         'blow' (knocked flying away)
// tick:   0 = each enemy is hit at most once per hit entry; >0 = can re-hit the same enemy
//         every `tick` seconds while the window is open (flurries, spins).

export const SOLDIER_ANIMS = [
  'idle', 'walk', 'run', 'windup', 'attack', 'guard', 'block', 'shoot',
  'flinch', 'air', 'down', 'getup', 'dead', 'cheer',
];

export const SOLDIER_TIMING = {
  windup: 0.5,  // telegraph before a strike
  attack: 0.35, // strike (damage lands at ~40%)
  flinch: 0.35,
  block: 0.3,
  shoot: 1.6,   // archer draw (0-1.2) + release (1.2) + recover
  getup: 0.7,
};

export const MOVES = {
  // ── Normal string (attack button) ──────────────────────────────────────
  // N1: fast straight thrust
  N1: { dur: 0.42, keys: { windup: 0.22, strike: 0.45 }, cancel: 0.42, lunge: 0.7, sfx: 'thrust',
    hits: [{ t0: 0.24, t1: 0.42, shape: 'arc', range: 3.1, angle: 60, dmg: 30, react: 'flinch' }] },
  // N2: horizontal sweep right → left
  N2: { dur: 0.46, keys: { windup: 0.2, strike: 0.5 }, cancel: 0.45, lunge: 0.5, sfx: 'swing',
    hits: [{ t0: 0.22, t1: 0.46, shape: 'arc', range: 3.1, angle: 160, dmg: 28, react: 'flinch' }] },
  // N3: backhand sweep left → right with a step
  N3: { dur: 0.46, keys: { windup: 0.2, strike: 0.5 }, cancel: 0.45, lunge: 0.6, sfx: 'swing',
    hits: [{ t0: 0.22, t1: 0.46, shape: 'arc', range: 3.3, angle: 160, dmg: 30, react: 'push' }] },
  // N4: double thrust — keys.extra = [second windup end, second strike end]
  N4: { dur: 0.56, keys: { windup: 0.16, strike: 0.34, extra: [0.44, 0.62] }, cancel: 0.6, lunge: 0.8, sfx: 'thrust',
    hits: [
      { t0: 0.18, t1: 0.32, shape: 'arc', range: 3.4, angle: 50, dmg: 22, react: 'flinch' },
      { t0: 0.46, t1: 0.6, shape: 'arc', range: 3.5, angle: 50, dmg: 24, react: 'push' },
    ] },
  // N5: full 360° spinning sweep (one full turn during the strike)
  N5: { dur: 0.62, keys: { windup: 0.2, strike: 0.62 }, cancel: 0.6, lunge: 0.3, sfx: 'swingHeavy',
    hits: [{ t0: 0.22, t1: 0.6, shape: 'circle', radius: 3.3, dmg: 34, react: 'push', tick: 0 }] },
  // N6: overhead slam finisher (spear comes down in front, ground impact at keys.strike)
  N6: { dur: 0.82, keys: { windup: 0.36, strike: 0.5 }, cancel: 0.9, lunge: 1.2, sfx: 'swingHeavy', shake: 0.35,
    hits: [{ t0: 0.4, t1: 0.52, shape: 'arc', range: 3.9, angle: 120, dmg: 60, react: 'blow' }] },

  // ── Charge attacks (charge button). C1 from neutral, Cn after N(n-1) ──
  // C1: rising upward slash that launches enemies
  C1: { dur: 0.7, keys: { windup: 0.3, strike: 0.5 }, cancel: 0.8, lunge: 0.6, sfx: 'swingHeavy',
    hits: [{ t0: 0.3, t1: 0.48, shape: 'arc', range: 3.3, angle: 110, dmg: 45, react: 'launch' }] },
  // C2: piercing dash thrust (hero travels `lunge` metres during the strike)
  C2: { dur: 0.78, keys: { windup: 0.25, strike: 0.6 }, cancel: 0.85, lunge: 3.5, sfx: 'thrust', shake: 0.2,
    hits: [{ t0: 0.25, t1: 0.58, shape: 'line', range: 3.6, width: 1.6, dmg: 55, react: 'blow', tick: 0 }] },
  // C3: rising spin (launch) then slam down with shockwave — keys.extra = [slam windup end, slam impact]
  C3: { dur: 1.1, keys: { windup: 0.12, strike: 0.45, extra: [0.62, 0.72] }, cancel: 0.9, lunge: 0.4, sfx: 'swingHeavy', shake: 0.4,
    hits: [
      { t0: 0.14, t1: 0.45, shape: 'circle', radius: 3.2, dmg: 16, react: 'launch', tick: 0.12 },
      { t0: 0.7, t1: 0.78, shape: 'circle', radius: 5.2, dmg: 50, react: 'blow' },
    ] },
  // C4: huge 360° crescent sweep with ground shockwave
  C4: { dur: 0.95, keys: { windup: 0.3, strike: 0.55 }, cancel: 0.9, lunge: 0.2, sfx: 'swingHeavy', shake: 0.45,
    hits: [{ t0: 0.3, t1: 0.52, shape: 'circle', radius: 6.0, dmg: 55, react: 'blow' }] },
  // C5: flurry of rapid thrusts (keys.windup → keys.strike), then a final blast thrust (keys.extra = [blast windup end, blast end])
  C5: { dur: 1.45, keys: { windup: 0.1, strike: 0.62, extra: [0.72, 0.82] }, cancel: 0.95, lunge: 1.0, sfx: 'thrust', shake: 0.35,
    hits: [
      { t0: 0.1, t1: 0.62, shape: 'arc', range: 3.7, angle: 70, dmg: 9, react: 'flinch', tick: 0.07 },
      { t0: 0.72, t1: 0.8, shape: 'arc', range: 4.8, angle: 80, dmg: 55, react: 'blow' },
    ] },
  // C6: dragon leap — jump forward and dive the spear into the ground (impact at keys.strike)
  C6: { dur: 1.25, keys: { windup: 0.25, strike: 0.62 }, cancel: 0.95, lunge: 5.0, sfx: 'swingHeavy', shake: 0.7,
    hits: [{ t0: 0.6, t1: 0.7, shape: 'circle', radius: 7.0, dmg: 85, react: 'blow' }] },

  // ── Air & defence ───────────────────────────────────────────────────
  // JA: air attack — plunge down with the spear; gameplay holds u < keys.strike until landing
  JA: { dur: 0.55, keys: { windup: 0.2, strike: 0.55 }, cancel: 1, lunge: 0, sfx: 'swingHeavy', shake: 0.25,
    hits: [{ t0: 0.5, t1: 0.62, shape: 'circle', radius: 3.6, dmg: 40, react: 'blow' }] },
  // DODGE: quick roll/dash, invulnerable for u < 0.75
  DODGE: { dur: 0.42, keys: { windup: 0.0, strike: 0.75 }, cancel: 0.7, lunge: 5.0, sfx: 'dodge', invuln: 0.75, hits: [] },

  // ── Musou (special) ─────────────────────────────────────────────────
  // MUSOU_START: cinematic pose while the world is frozen (spear raised, cape flowing)
  MUSOU_START: { dur: 1.1, keys: { windup: 0.5, strike: 1 }, cancel: 1, lunge: 0, sfx: 'musouStart', hits: [] },
  // MUSOU_FLURRY: looping storm of thrusts & sweeps. Pose loops internally every 0.18 s of real time
  // (use the `time` argument); u is overall progress. Player can steer slowly.
  MUSOU_FLURRY: { dur: 2.6, keys: { windup: 0, strike: 1 }, cancel: 1, lunge: 0, sfx: 'musouHit',
    hits: [{ t0: 0.0, t1: 1.0, shape: 'arc', range: 4.4, angle: 120, dmg: 14, react: 'flinch', tick: 0.09 }] },
  // MUSOU_FINALE: giant spinning dragon sweep (the huge white arc in the reference)
  MUSOU_FINALE: { dur: 1.0, keys: { windup: 0.28, strike: 0.55 }, cancel: 1, lunge: 0, sfx: 'musouFinale', shake: 1.0,
    hits: [{ t0: 0.3, t1: 0.52, shape: 'circle', radius: 10.5, dmg: 150, react: 'blow' }] },
};

// Chain rules: pressing attack in [cancel, 1] of Nn → N(n+1). Pressing charge → C(n+1).
export const NORMAL_CHAIN = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
export const CHARGE_AFTER = { none: 'C1', N1: 'C2', N2: 'C3', N3: 'C4', N4: 'C5', N5: 'C6' };

// Officers — gameplay tunes stats; characters agent builds looks from `look`.
export const OFFICERS = {
  xiahouen: {
    zh: '夏侯恩', en: 'XIAHOU EN', hp: 900, weapon: 'sword',
    look: 'Wei officer in black lacquered armour with gold trim, red cape, tall red-plumed helmet, carries the straight Qinggang sword (青釭劍) with a blue-steel glow',
  },
  yanming: {
    zh: '晏明', en: 'YAN MING', hp: 1300, weapon: 'halberd',
    look: 'burly Wei officer, dark bronze armour, red scarf, big square helmet, heavy three-pointed halberd (三尖刀)',
  },
  zhanghe: {
    zh: '張郃', en: 'ZHANG HE', hp: 2200, weapon: 'claws',
    look: 'elegant Wei general, purple-and-black armour with gold, long black hair tied up with a feather ornament, twin steel claws',
  },
};

// Officer attacks (normalised like MOVES). Gameplay uses these for hitboxes vs the player.
export const OFFICER_MOVES = {
  atk1: { dur: 0.75, keys: { windup: 0.45, strike: 0.65 }, hits: [{ t0: 0.45, t1: 0.62, shape: 'arc', range: 3.0, angle: 100, dmg: 70, react: 'flinch' }] },
  atk2: { dur: 1.0, keys: { windup: 0.4, strike: 0.7, extra: [0.5, 0.7] }, hits: [
    { t0: 0.4, t1: 0.5, shape: 'arc', range: 3.2, angle: 140, dmg: 55, react: 'flinch' },
    { t0: 0.58, t1: 0.7, shape: 'arc', range: 3.2, angle: 140, dmg: 65, react: 'flinch' }] },
  atk3: { dur: 1.1, keys: { windup: 0.55, strike: 0.72 }, hits: [{ t0: 0.55, t1: 0.7, shape: 'circle', radius: 3.8, dmg: 110, react: 'blow' }] },
  special: { dur: 1.6, keys: { windup: 0.5, strike: 0.85 }, hits: [{ t0: 0.5, t1: 0.85, shape: 'line', range: 9, width: 2.2, dmg: 140, react: 'blow' }] },
  taunt: { dur: 1.2, keys: { windup: 0.5, strike: 1 }, hits: [] },
};

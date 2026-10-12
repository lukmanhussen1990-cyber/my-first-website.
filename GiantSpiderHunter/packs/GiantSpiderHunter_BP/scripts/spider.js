// Per-spider controller: idle -> stalking -> growing -> hunting -> cooldown -> (stalking | despawn),
// plus dying. One controller per loaded horror:giant_spider (auto-managed or manual).
//
// The entity's own behavior JSON owns locomotion/targeting (component groups per state); this
// controller decides state transitions, facing/relocation while stalking, the aggression
// triggers, strikes (the ONLY source of damage), escape, chase speed, terrain sampling for the
// legs, sounds/particles and the death sequence.
import { EntityDamageCause } from '@minecraft/server';
import { CONFIG, difficultyMultiplier } from './config.js';
import {
  heightAboveGround,
  lineOfSight,
  surfaceSpot,
  woodNearby,
} from './blocks.js';
import {
  KIND_BITE,
  KIND_HIGH,
  bodyCenter,
  escapeStep,
  hasContact,
  heartbeatInterval,
  inViewCone,
  isElevated,
  knockbackFor,
  maxStrikeRadius,
  relocationCandidate,
  shakeIntensityAt,
  speedEffectFor,
  strikeKind,
  viewYaw,
} from './geometry.js';
import {
  PARTICLE,
  SOUND,
  actionBar,
  cameraShake,
  debug,
  errorText,
  particle,
  particleRing,
  playPlayerSound,
  playWorldSound,
  warn,
} from './effects.js';
import { OVERWORLD, eligibleNear, eligiblePlayers, findPlayerById, isEligible } from './players.js';
import { AUTO_TAG, DP_ENCOUNTER, DP_FOCUS, DP_HP_INIT, DP_LOOT_DONE } from './state.js';
import { TerrainSampler } from './terrain.js';
import { TPS, dist, randRange, stepYaw, yawTo } from './util.js';

export const STATES = ['idle', 'stalking', 'growing', 'hunting', 'cooldown', 'dying'];
const HEALTH_BUFFER = 500;
const EVENT_FOR = {
  idle: 'horror:to_idle',
  stalking: 'horror:to_stalking',
  growing: 'horror:to_growing',
  hunting: 'horror:to_hunting',
  cooldown: 'horror:to_cooldown',
  dying: 'horror:to_dying',
};

/** Hooks provided by the encounter manager (avoids an import cycle). */
export const hooks = {
  /** (controller, reason) -> void : an auto encounter's spider is gone for good */
  encounterEnded: () => {},
  /** (playerId) -> boolean : player is in respawn grace and must be ignored */
  inGrace: () => false,
};

/** Players currently being chased (focus of a growing/hunting spider or in its contact range). */
export const chasedPlayers = new Set();

const rng = Math.random;

function secs(ticks) {
  return ticks / TPS;
}

function getProp(entity, id, def) {
  try {
    const v = entity.getProperty(id);
    return v === undefined ? def : v;
  } catch (e) {
    return def;
  }
}

function setProp(entity, id, value) {
  try {
    if (entity.getProperty(id) !== value) entity.setProperty(id, value);
    return true;
  } catch (e) {
    return false;
  }
}

function eligibleFree(player) {
  return isEligible(player) && !hooks.inGrace(player.id);
}

export class SpiderController {
  constructor(entity, now) {
    this.entity = entity;
    this.id = entity.id;
    this.auto = false;
    this.serial = 0;
    this.focusId = '';
    this.state = 'idle';
    this.stateSince = now;
    this.terrain = new TerrainSampler();
    this.lookAcc = new Map(); // playerId -> seconds looked at
    this.lockUntil = 0;
    this.stalkStart = now;
    this.nextRelocate = now + randRange(CONFIG.relocateIntervalMin, CONFIG.relocateIntervalMax, rng) * TPS;
    this.nextRelocateTry = now;
    this.nextAmbient = now + randRange(CONFIG.ambientIntervalMin, CONFIG.ambientIntervalMax, rng) * TPS;
    this.growEnd = 0;
    this.cooldownEnd = 0;
    this.deathAt = 0;
    this.idleSince = now;
    this.esc = { huntStart: 0, lastContact: 0, farSince: null };
    this.pendingStrike = null;
    this.nextStrike = 0;
    this.nextHeartbeat = 0;
    this.nextSpeedRefresh = 0;
    this.speedKey = '';
    this.lastLosCheck = 0;
    this.lastLos = true;
    this.removed = false;
    this.syncHoldUntil = 0;
    this.attach(entity, now);
  }

  // ------------------------------------------------------------------ setup / persistence
  attach(entity, now) {
    this.entity = entity;
    try {
      this.auto = entity.hasTag(AUTO_TAG);
      const s = entity.getDynamicProperty(DP_ENCOUNTER);
      this.serial = typeof s === 'number' ? s : 0;
      const f = entity.getDynamicProperty(DP_FOCUS);
      this.focusId = typeof f === 'string' ? f : '';
    } catch (e) {
      // keep defaults
    }
    const st = getProp(entity, 'horror:state', 'idle');
    this.state = STATES.includes(st) ? st : 'idle';
    this.stateSince = now;
    this.terrain.syncFrom(entity);
    this.applyVisualConfig();
    this.initHealth();
    // Resume timers relative to now (absolute ticks are not persisted).
    switch (this.state) {
      case 'stalking':
        this.stalkStart = now;
        break;
      case 'growing':
        this.growEnd = now + CONFIG.growthDurationSeconds * TPS;
        break;
      case 'hunting':
        this.beginHuntBookkeeping(now);
        break;
      case 'cooldown':
        this.cooldownEnd = now + CONFIG.postChaseCooldownSeconds * TPS;
        break;
      case 'dying':
        this.deathAt = now + CONFIG.deathLootDelaySeconds * TPS;
        break;
      default:
        this.idleSince = now;
    }
  }

  /** Push size/growth config into the client-synced properties. */
  applyVisualConfig() {
    const e = this.entity;
    setProp(e, 'horror:small_scale', CONFIG.smallScale);
    setProp(e, 'horror:giant_scale', CONFIG.giantScale);
    setProp(e, 'horror:grow_time', Math.min(CONFIG.growTime, CONFIG.growthDurationSeconds));
  }

  /** Health buffer: real HP = health - 500. Done once per spider. */
  initHealth() {
    try {
      if (this.entity.getDynamicProperty(DP_HP_INIT) === true) return;
      const h = this.entity.getComponent('minecraft:health');
      if (h) h.setCurrentValue(HEALTH_BUFFER + CONFIG.health);
      this.entity.setDynamicProperty(DP_HP_INIT, true);
    } catch (e) {
      // retried on next attach
    }
  }

  setFocus(player) {
    this.focusId = player ? player.id : '';
    try {
      this.entity.setDynamicProperty(DP_FOCUS, this.focusId || undefined);
    } catch (e) {
      // ignore
    }
  }

  focus() {
    const p = this.focusId ? findPlayerById(this.focusId) : undefined;
    return p && eligibleFree(p) ? p : undefined;
  }

  isValid() {
    try {
      return !this.removed && this.entity.isValid();
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------ transitions
  go(state, now, why = '') {
    if (!STATES.includes(state)) return;
    const prev = this.state;
    try {
      this.entity.triggerEvent(EVENT_FOR[state]);
    } catch (e) {
      warn(`triggerEvent ${state} failed: ${e}`);
      return;
    }
    this.state = state;
    this.stateSince = now;
    this.syncHoldUntil = now + 10;
    debug(`spider ${this.id} ${prev} -> ${state}${why ? ` (${why})` : ''}`);
    this.lookAcc.clear();
    this.pendingStrike = null;
    if (state !== 'hunting' && state !== 'growing') this.clearSpeed();
    if (state === 'stalking') {
      this.stalkStart = now;
      this.nextRelocate = now + randRange(CONFIG.relocateIntervalMin, CONFIG.relocateIntervalMax, rng) * TPS;
    }
    if (state === 'idle') this.idleSince = now;
    if (state === 'cooldown' || state === 'stalking' || state === 'idle') this.terrain.reset(this.entity);
  }

  /** Small form provoked by `player`: grow, then hunt. */
  aggress(player, now, why) {
    if (this.state === 'growing' || this.state === 'hunting' || this.state === 'dying') return;
    if (player) this.setFocus(player);
    this.go('growing', now, why);
    this.growEnd = now + CONFIG.growthDurationSeconds * TPS;
    const e = this.entity;
    const loc = e.location;
    const dim = e.dimension;
    playWorldSound(SOUND.roar, loc, CONFIG.roarVolume, 0.9 + rng() * 0.15);
    playWorldSound(SOUND.grow, loc, Math.max(1, CONFIG.roarVolume * 0.75), 1);
    if (player) {
      playPlayerSound(player, SOUND.roar, 0.7, 0.95, player.location);
      actionBar(player, '§4§lIt has seen you. RUN.');
      this.face(player, 180);
    }
    particle(dim, PARTICLE.roar, { x: loc.x, y: loc.y + 0.6, z: loc.z });
    particleRing(dim, PARTICLE.dust, loc, 1.5, 8, 0.2);
    for (const { player: p, d } of eligibleNear(dim.id, loc, CONFIG.shakeRadius)) {
      const k = shakeIntensityAt(d, CONFIG);
      if (k > 0) cameraShake(p, k, CONFIG.shakeSeconds);
    }
  }

  beginHuntBookkeeping(now) {
    const t = secs(now);
    this.esc = { huntStart: t, lastContact: t, farSince: null };
    this.nextStrike = now + Math.round(0.6 * TPS);
    this.nextHeartbeat = now;
    this.nextSpeedRefresh = now;
    this.speedKey = '';
  }

  // ------------------------------------------------------------------ external events
  onAttacked(player, now) {
    if (!player || !isEligible(player)) return;
    if (this.state === 'idle' || this.state === 'stalking' || this.state === 'cooldown') {
      this.aggress(player, now, 'attacked');
    } else if (this.state === 'hunting' && !this.focus()) {
      this.setFocus(player);
    }
  }

  onStartDying(now) {
    if (this.deathAt > 0 && this.state === 'dying') return;
    this.state = 'dying';
    this.stateSince = now;
    this.pendingStrike = null;
    this.deathAt = now + CONFIG.deathLootDelaySeconds * TPS;
    this.clearSpeed();
    const loc = this.entity.location;
    playWorldSound(SOUND.death, loc, Math.max(1.5, CONFIG.roarVolume * 0.8), 0.85);
    particle(this.entity.dimension, PARTICLE.roar, { x: loc.x, y: loc.y + 1, z: loc.z });
    debug(`spider ${this.id} dying`);
  }

  onFocusLost(playerId, now, why) {
    if (this.focusId !== playerId) return;
    if (this.state === 'hunting' || this.state === 'growing') {
      const next = this.pickTarget(CONFIG.huntTargetRange, playerId);
      if (next) {
        this.setFocus(next);
        return;
      }
      this.toCooldown(now, why);
    } else {
      this.setFocus(undefined);
    }
  }

  // ------------------------------------------------------------------ helpers
  pickTarget(range, excludeId) {
    const loc = this.entity.location;
    for (const { player } of eligibleNear(this.entity.dimension.id, loc, range)) {
      if (player.id !== excludeId && !hooks.inGrace(player.id)) return player;
    }
    return undefined;
  }

  face(player, maxStep) {
    try {
      const e = this.entity;
      const cur = e.getRotation();
      const target = yawTo(e.location, player.location);
      const y = stepYaw(cur.y, target, maxStep);
      if (Math.abs(y - cur.y) > 0.5) e.setRotation({ x: cur.x, y });
    } catch (e) {
      // ignore
    }
  }

  clearSpeed() {
    if (!this.speedKey) return;
    try {
      this.entity.removeEffect('speed');
      this.entity.removeEffect('slowness');
    } catch (e) {
      // ignore
    }
    this.speedKey = '';
  }

  applySpeed(now, distance) {
    if (now < this.nextSpeedRefresh) return;
    this.nextSpeedRefresh = now + 2 * TPS;
    let mult = CONFIG.chaseSpeedMultiplier;
    if (distance > CONFIG.catchUpDistance) mult *= CONFIG.catchUpMultiplier;
    const fx = speedEffectFor(mult);
    const key = fx.effect ? `${fx.effect}:${fx.amplifier}` : '';
    if (key !== this.speedKey) this.clearSpeed();
    if (!fx.effect) return;
    try {
      this.entity.addEffect(fx.effect, 6 * TPS, { amplifier: fx.amplifier, showParticles: false });
      this.speedKey = key;
    } catch (e) {
      // ignore
    }
  }

  /** Players looking at the spider (within any player's view cone and not hidden by blocks). */
  seenByAnyPlayer(point) {
    const dim = this.entity.dimension;
    for (const p of eligiblePlayers()) {
      try {
        const eye = p.getHeadLocation();
        if (!inViewCone(eye, p.getViewDirection(), point, CONFIG.viewConeDegrees, 96)) continue;
        if (lineOfSight(dim, eye, point)) return true;
      } catch (e) {
        // ignore this player
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ main update (every 2 ticks)
  update(now) {
    if (!this.isValid()) return false;
    const e = this.entity;
    let loc;
    try {
      loc = e.location;
    } catch (err) {
      return false;
    }
    // keep the logical state in sync with the entity (e.g. the entity's own fallback timers)
    const st = now >= this.syncHoldUntil ? getProp(e, 'horror:state', this.state) : this.state;
    if (st !== this.state && STATES.includes(st)) {
      const prev = this.state;
      this.state = st;
      this.stateSince = now;
      if (st === 'hunting' && prev !== 'hunting') this.beginHuntBookkeeping(now);
      if (st === 'dying') this.onStartDying(now);
    }
    const inOverworld = e.dimension.id === OVERWORLD;
    switch (this.state) {
      case 'idle':
        this.updateIdle(now, loc, inOverworld);
        break;
      case 'stalking':
        this.updateStalking(now, loc, inOverworld);
        break;
      case 'growing':
        this.updateGrowing(now, loc);
        break;
      case 'hunting':
        this.updateHunting(now, loc);
        break;
      case 'cooldown':
        this.updateCooldown(now, loc, inOverworld);
        break;
      case 'dying':
        this.updateDying(now, loc);
        break;
      default:
        break;
    }
    return true;
  }

  updateIdle(now, loc, inOverworld) {
    if (!inOverworld) return;
    if (now % 10 !== 0 && now % 10 !== 1) return;
    const p = this.pickTarget(CONFIG.idleRange);
    if (p) {
      this.setFocus(p);
      this.go('stalking', now, 'player nearby');
      return;
    }
    if (this.auto && now - this.idleSince > CONFIG.autoIdleDespawnSeconds * TPS) {
      this.despawn(now, 'idle too long');
    }
  }

  updateStalking(now, loc, inOverworld) {
    const e = this.entity;
    if (!inOverworld) {
      this.go('idle', now, 'not in overworld');
      return;
    }
    let focus = this.focus();
    if (!focus) {
      focus = this.pickTarget(CONFIG.idleRange);
      if (!focus) {
        this.setFocus(undefined);
        this.go('idle', now, 'no player');
        return;
      }
      this.setFocus(focus);
    }
    const pl = focus.location;
    const d = dist(loc, pl);
    this.face(focus, CONFIG.maxTurnDegreesPerTick * 2);
    const locked = now < this.lockUntil;
    const center = bodyCenter(loc, CONFIG.smallScale, CONFIG);

    // (b) approach and (a) look triggers - checked every 4 ticks
    if (!locked && now % 4 < 2) {
      for (const { player, d: pd } of eligibleNear(e.dimension.id, loc, Math.max(CONFIG.lookRange, CONFIG.approachRange))) {
        if (hooks.inGrace(player.id)) continue;
        if (pd <= CONFIG.approachRange) {
          this.aggress(player, now, 'approached');
          return;
        }
        if (pd > CONFIG.lookRange) continue;
        let looking = false;
        try {
          const eye = player.getHeadLocation();
          looking =
            inViewCone(eye, player.getViewDirection(), center, CONFIG.lookAngleDegrees, CONFIG.lookRange) &&
            lineOfSight(e.dimension, eye, center);
        } catch (err) {
          looking = false;
        }
        const acc = Math.max(0, (this.lookAcc.get(player.id) || 0) + (looking ? 0.2 : -0.1));
        this.lookAcc.set(player.id, acc);
        if (acc >= CONFIG.lookSeconds) {
          this.aggress(player, now, 'looked at');
          return;
        }
      }
    }
    // (d) timeout
    if (!locked && now - this.stalkStart >= CONFIG.stalkTimeoutSeconds * TPS) {
      if (CONFIG.stalkTimeoutAction === 'vanish') {
        this.despawn(now, 'stalk timeout (vanish)');
      } else {
        this.aggress(focus, now, 'stalk timeout');
      }
      return;
    }
    // relocation while unseen
    const tooClose = d < CONFIG.stalkMinDistance;
    const tooFar = d > CONFIG.stalkMaxDistance;
    if ((tooClose || tooFar || now >= this.nextRelocate) && now >= this.nextRelocateTry) {
      this.nextRelocateTry = now + 2 * TPS;
      if (!this.seenByAnyPlayer(center)) {
        if (this.relocate(focus, now)) {
          this.nextRelocate = now + randRange(CONFIG.relocateIntervalMin, CONFIG.relocateIntervalMax, rng) * TPS;
        }
      }
    }
    // ambient chitter
    if (now >= this.nextAmbient) {
      this.nextAmbient = now + randRange(CONFIG.ambientIntervalMin, CONFIG.ambientIntervalMax, rng) * TPS;
      playWorldSound(SOUND.ambient, loc, 0.9, 0.9 + rng() * 0.25);
    }
  }

  /** Teleport to a hidden surface spot behind the focus player's view. */
  relocate(player, now) {
    const dim = this.entity.dimension;
    let view;
    try {
      view = player.getViewDirection();
    } catch (e) {
      return false;
    }
    const pl = player.location;
    const vy = viewYaw(view);
    let best = null;
    for (let i = 0; i < 4; i++) {
      const c = relocationCandidate(rng, pl, vy, CONFIG);
      const budget = { n: CONFIG.spawnColumnBudget };
      const spot = surfaceSpot(dim, c.x, c.z, Math.floor(pl.y) + 16, Math.floor(pl.y) - 16, 2, budget);
      if (!spot.ok) continue;
      const pos = { x: c.x + 0.5, y: spot.groundY + 1, z: c.z + 0.5 };
      // never reappear inside another player's view or too close to anyone
      let ok = true;
      for (const p of eligiblePlayers()) {
        try {
          if (dist(p.location, pos) < CONFIG.stalkMinDistance) ok = false;
        } catch (e) {
          // ignore
        }
      }
      if (!ok) continue;
      const forest = spot.forest || woodNearby(dim, c.x, spot.groundY + 1, c.z, 2, budget);
      if (this.seenByAnyPlayer({ x: pos.x, y: pos.y + 0.5, z: pos.z })) continue;
      best = pos;
      if (forest) break; // prefer spots next to trees
    }
    if (!best) return false;
    try {
      const ok = this.entity.tryTeleport(best, { checkForBlocks: true, facingLocation: pl, keepVelocity: false });
      if (ok) debug(`stalker relocated to ${Math.round(best.x)} ${Math.round(best.y)} ${Math.round(best.z)}`);
      return ok;
    } catch (e) {
      return false;
    }
  }

  updateGrowing(now, loc) {
    const focus = this.focus();
    if (focus) this.face(focus, 20);
    const e = this.entity;
    const t = now - this.stateSince;
    if (t % 10 === 0) {
      const r = 1 + Math.min(1, t / (CONFIG.growthDurationSeconds * TPS)) * 6 * CONFIG.giantScale;
      particleRing(e.dimension, PARTICLE.dust, loc, r, 10, 0.2);
      if (t % 30 === 0) particle(e.dimension, PARTICLE.campfireSmoke, { x: loc.x, y: loc.y + 1, z: loc.z });
    }
    if (now >= this.growEnd) {
      if (!focus && !this.pickTarget(CONFIG.huntTargetRange)) {
        this.toCooldown(now, 'no target after growing');
        return;
      }
      this.go('hunting', now, 'grown');
      this.beginHuntBookkeeping(now);
      this.terrain.update(e, now, CONFIG.giantScale, true);
    }
  }

  updateHunting(now, loc) {
    const e = this.entity;
    const dim = e.dimension;
    let focus = this.focus();
    if (!focus) {
      focus = this.pickTarget(CONFIG.huntTargetRange);
      if (!focus) {
        this.toCooldown(now, 'lost target');
        return;
      }
      this.setFocus(focus);
    }
    const s = CONFIG.giantScale;
    const d = dist(loc, focus.location);
    chasedPlayers.add(focus.id);

    // strikes: impact of a pending strike, then look for a new one
    this.updateStrikes(now, loc, s, focus);
    if (!this.isValid()) return;

    // escape bookkeeping every 10 ticks
    if (now - this.lastLosCheck >= 10) {
      this.lastLosCheck = now;
      const center = bodyCenter(loc, s, CONFIG);
      let los = false;
      if (d <= CONFIG.losRange) {
        try {
          los = lineOfSight(dim, center, focus.getHeadLocation());
        } catch (err) {
          los = false;
        }
      }
      let contact = hasContact(d, los, CONFIG);
      if (!contact) {
        // another eligible player right next to it keeps the chase going (and becomes the focus)
        const other = this.pickTarget(CONFIG.contactRange, focus.id);
        if (other) {
          this.setFocus(other);
          contact = true;
        }
      }
      const reason = escapeStep(this.esc, secs(now), d, contact, CONFIG);
      if (reason) {
        if (CONFIG.messages) actionBar(focus, '§7The footsteps fade... you escaped. For now.');
        this.toCooldown(now, `escape: ${reason}`);
        return;
      }
    }
    this.applySpeed(now, d);
    this.terrain.update(e, now, s);
    if (CONFIG.heartbeat && now >= this.nextHeartbeat) {
      this.nextHeartbeat = now + Math.round(heartbeatInterval(d) * TPS);
      playPlayerSound(focus, SOUND.heartbeat, d < 24 ? 1 : 0.7, 1, focus.location);
    }
  }

  updateStrikes(now, loc, s, focus) {
    const e = this.entity;
    const dim = e.dimension;
    let yaw = 0;
    try {
      yaw = TerrainSampler.heading(e);
    } catch (err) {
      yaw = 0;
    }
    // impact
    const ps = this.pendingStrike;
    if (ps && now >= ps.impactTick) {
      this.pendingStrike = null;
      const target = findPlayerById(ps.playerId);
      if (target && eligibleFree(target)) {
        const tl = target.location;
        const elevated = isElevated(loc.y, tl.y, heightAboveGround(dim, tl, 8), CONFIG);
        const kind = strikeKind(loc, yaw, s, tl, elevated, CONFIG, CONFIG.reachTolerance);
        if (kind >= 0) this.hit(target, kind, loc);
      }
    }
    if (this.pendingStrike || now < this.nextStrike) return;
    // new strike: candidates within the maximum reach, focus first
    const range = maxStrikeRadius(s, CONFIG) + CONFIG.bodyCenterHeight * s;
    const cands = eligibleNear(dim.id, loc, range).filter(({ player }) => !hooks.inGrace(player.id));
    cands.sort((a, b) => (a.player.id === focus.id ? -1 : b.player.id === focus.id ? 1 : a.d - b.d));
    for (const { player } of cands) {
      const tl = player.location;
      const hag = heightAboveGround(dim, tl, 8);
      const elevated = isElevated(loc.y, tl.y, hag, CONFIG);
      const kind = strikeKind(loc, yaw, s, tl, elevated, CONFIG, 1);
      if (kind < 0) continue;
      this.startStrike(player, kind, now, loc);
      return;
    }
  }

  startStrike(player, kind, now, loc) {
    const e = this.entity;
    let id = getProp(e, 'horror:attack_id', 0) + 1;
    if (id > 1000000) id = 1;
    setProp(e, 'horror:attack_kind', kind);
    setProp(e, 'horror:attack_id', id);
    this.pendingStrike = { playerId: player.id, kind, impactTick: now + Math.round(CONFIG.strikeWindupSeconds * TPS) };
    this.nextStrike = now + Math.round(CONFIG.attackCooldownSeconds * TPS);
    playWorldSound(kind === KIND_BITE ? SOUND.bite : SOUND.attack, loc, 2.5, 0.9 + rng() * 0.2);
    debug(`strike kind ${kind} on ${player.name}`);
  }

  hit(player, kind, loc) {
    const e = this.entity;
    const diff = getProp(e, 'horror:difficulty', 2);
    const base = kind === KIND_BITE ? CONFIG.biteDamage : CONFIG.strikeDamage;
    const amount = base * difficultyMultiplier(diff);
    if (amount <= 0) return;
    try {
      player.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
    } catch (err) {
      return;
    }
    try {
      const pl = player.location;
      let dx = pl.x - loc.x;
      let dz = pl.z - loc.z;
      const h = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= h;
      dz /= h;
      let gliding = false;
      try {
        gliding = player.isGliding;
      } catch (err) {
        gliding = false;
      }
      const kb = knockbackFor(kind, gliding, CONFIG);
      player.applyKnockback(dx, dz, kb.h, kb.v);
    } catch (err) {
      // knockback is cosmetic
    }
    const pl = player.location;
    particle(e.dimension, PARTICLE.crit, { x: pl.x, y: pl.y + 1, z: pl.z });
    if (kind === KIND_HIGH) particle(e.dimension, PARTICLE.dust, { x: pl.x, y: pl.y + 0.5, z: pl.z });
  }

  toCooldown(now, why) {
    if (this.state === 'cooldown' || this.state === 'dying') return;
    this.go('cooldown', now, why);
    this.cooldownEnd = now + CONFIG.postChaseCooldownSeconds * TPS;
  }

  updateCooldown(now, loc, inOverworld) {
    if (now < this.cooldownEnd) return;
    const p = inOverworld ? this.pickTarget(CONFIG.cooldownRestalkRange) : undefined;
    if (p) {
      this.setFocus(p);
      this.go('stalking', now, 'cooldown over');
      this.lockUntil = now + CONFIG.restalkLockSeconds * TPS;
    } else if (this.auto) {
      this.despawn(now, 'cooldown over, nobody near');
    } else {
      this.setFocus(undefined);
      this.go('idle', now, 'cooldown over');
    }
  }

  updateDying(now, loc) {
    if (this.deathAt === 0) this.deathAt = now + CONFIG.deathLootDelaySeconds * TPS;
    const e = this.entity;
    const t = now - this.stateSince;
    if (t % 8 === 0) particle(e.dimension, PARTICLE.smoke, { x: loc.x + (rng() - 0.5) * 3, y: loc.y + 1, z: loc.z + (rng() - 0.5) * 3 });
    if (now < this.deathAt) return;
    this.dropLoot(loc);
    particle(e.dimension, PARTICLE.deathExplosion, { x: loc.x, y: loc.y + 1, z: loc.z });
    particle(e.dimension, PARTICLE.hugeExplosion, { x: loc.x, y: loc.y + 1.5, z: loc.z });
    this.despawn(now, 'died');
  }

  dropLoot(loc) {
    const e = this.entity;
    try {
      if (e.getDynamicProperty(DP_LOOT_DONE) === true) return;
      e.setDynamicProperty(DP_LOOT_DONE, true);
    } catch (err) {
      return;
    }
    const dim = e.dimension;
    const x = loc.x.toFixed(2);
    const y = (loc.y + 0.5).toFixed(2);
    const z = loc.z.toFixed(2);
    try {
      dim.runCommandAsync(`loot spawn ${x} ${y} ${z} loot "entities/giant_spider"`).catch(() => {});
    } catch (err) {
      // loot is a bonus
    }
    for (let i = 0; i < CONFIG.deathXpOrbs; i++) {
      try {
        dim.spawnEntity('minecraft:xp_orb', { x: loc.x + (rng() - 0.5) * 2, y: loc.y + 0.8, z: loc.z + (rng() - 0.5) * 2 });
      } catch (err) {
        break;
      }
    }
  }

  despawn(now, why) {
    if (this.removed) return;
    this.removed = true;
    this.clearSpeed();
    debug(`spider ${this.id} despawn: ${why}`);
    try {
      this.entity.triggerEvent('horror:despawn');
    } catch (e) {
      try {
        this.entity.remove();
      } catch (err) {
        // already gone
      }
    }
    if (this.auto) hooks.encounterEnded(this, why);
  }
}

// ------------------------------------------------------------------ registry
export const controllers = new Map(); // entity id -> SpiderController

export function register(entity, now) {
  let c = controllers.get(entity.id);
  if (c) {
    c.attach(entity, now);
    c.removed = false;
    return c;
  }
  c = new SpiderController(entity, now);
  controllers.set(entity.id, c);
  return c;
}

export function unregister(id) {
  controllers.delete(id);
}

/** Update every controller; never throws. */
export function updateAll(now) {
  chasedPlayers.clear();
  for (const [id, c] of controllers) {
    try {
      if (!c.update(now)) controllers.delete(id);
    } catch (e) {
      warn(`spider ${id} update failed: ${errorText(e)}`);
    }
  }
}

/** Re-push visual config to every loaded spider (after a config change). */
export function refreshVisualConfig() {
  for (const c of controllers.values()) {
    try {
      if (c.isValid()) c.applyVisualConfig();
    } catch (e) {
      // ignore
    }
  }
}

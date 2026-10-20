// Realistic Guns - gameplay script (stable @minecraft/server 2.0.0, Minecraft Bedrock 1.21.100)
//
// Controls
//   Use (tap / hold, or the "Fire" touch button) ... shoot; hold for full-auto guns
//   Sneak + Use .................................... reload (uses one magazine)
//   Sneak with AWP / Barrett ....................... scope zoom (Use fires while scoped,
//                                                    these two reload automatically when empty)
//   /scriptevent rg:blockdamage off|on ............. toggle bullet block damage
//
// Gun stats, muzzle offsets and item ids live in the generated ./gun_data.js.

import {
  world,
  system,
  MolangVariableMap,
  EntityDamageCause,
  GameMode,
  Player,
} from "@minecraft/server";
import { NS, GUNS, BLOCK_TOUGHNESS, BLOCK_TOUGHNESS_DEFAULT, IMMUNE_BLOCKS } from "./gun_data.js";

const COOLDOWN_KICK = `${NS}_kick`;
const COOLDOWN_RELOAD = `${NS}_reload`;
const COOLDOWN_CYCLE = `${NS}_cycle`;
const PROP_BLOCK_DAMAGE = `${NS}:block_damage`;
const PULSE_WINDOW = 5; // ticks a single "use" pulse keeps the trigger down (fallback mode)
const HURT_IMMUNITY_TICKS = 10;
const BLOCK_DAMAGE_MEMORY = 600; // ticks before partial block damage is forgotten
const MAX_BULLETS = 400;

/** @type {Map<string, any>} per-player runtime state */
const states = new Map();
/** @type {Map<string, any>} live bullets by entity id */
const bullets = new Map();
/** @type {Map<string, {tick:number, amount:number}>} last gun hit per target (hurt immunity) */
const hurtLog = new Map();
/** @type {Array<{target:any, shooter:any, due:number}>} lethal hits waiting for immunity to end */
const finishers = [];
/** @type {Map<string, {dmg:number, type:string, last:number}>} accumulated block damage */
const blockDamage = new Map();

// ---------------------------------------------------------------------------
// small vector helpers
// ---------------------------------------------------------------------------
const v = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  norm: (a) => {
    const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
};
const UP = { x: 0, y: 1, z: 0 };

/** Camera basis for a view direction: right, up, forward (world space). */
function basis(dir) {
  let right = v.cross(dir, UP);
  if (v.len(right) < 1e-4) right = { x: 1, y: 0, z: 0 };
  right = v.norm(right);
  const up = v.norm(v.cross(right, dir));
  return { right, up, fwd: dir };
}

/** Rotate a direction randomly inside a cone of `deg` degrees (gaussian-ish). */
function spreadDir(dir, deg) {
  if (deg <= 0) return dir;
  const b = basis(dir);
  const r = Math.tan((deg * Math.PI) / 180) * Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * 0.55;
  const a = Math.random() * Math.PI * 2;
  return v.norm(v.add(dir, v.add(v.mul(b.right, Math.cos(a) * r), v.mul(b.up, Math.sin(a) * r))));
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// state / ammo helpers
// ---------------------------------------------------------------------------
function getState(player) {
  let st = states.get(player.id);
  if (!st) {
    st = {
      triggerDown: false,
      chargeMode: false,
      pulseUntil: 0,
      pressTick: -1,
      nextShot: {}, // earliest tick each gun may fire again (per gun, so switching is fair)
      reload: null,
      gunKey: "",
      slot: -1,
      scoped: false,
      hudTick: 0,
      magCount: 0,
      magScanTick: -100,
      lastShot: -100,
    };
    states.set(player.id, st);
  }
  return st;
}

function heldGun(player) {
  const inv = player.getComponent("minecraft:inventory");
  const item = inv?.container?.getItem(player.selectedSlotIndex);
  if (!item) return undefined;
  const gun = GUNS[item.typeId];
  return gun ? { gun, item } : undefined;
}

function ammoKey(gun) {
  return `${NS}:ammo_${gun.id}`;
}

function getAmmo(player, gun) {
  const val = player.getDynamicProperty(ammoKey(gun));
  if (typeof val !== "number") {
    player.setDynamicProperty(ammoKey(gun), gun.capacity);
    return gun.capacity;
  }
  return val;
}

function setAmmo(player, gun, n) {
  player.setDynamicProperty(ammoKey(gun), Math.max(0, Math.min(gun.capacity, n)));
}

function isCreative(player) {
  return safe(() => player.getGameMode()) === GameMode.Creative;
}

function countItem(player, typeId) {
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it && it.typeId === typeId) n += it.amount;
  }
  return n;
}

function consumeItem(player, typeId) {
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!c) return false;
  for (let i = c.size - 1; i >= 0; i--) {
    const it = c.getItem(i);
    if (it && it.typeId === typeId) {
      if (it.amount > 1) {
        it.amount -= 1;
        c.setItem(i, it);
      } else {
        c.setItem(i, undefined);
      }
      return true;
    }
  }
  return false;
}

function startCooldown(player, category, ticks) {
  safe(() => player.startItemCooldown(category, Math.max(1, Math.round(ticks))));
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function bar(frac, n = 10) {
  const full = Math.round(frac * n);
  return "§a" + "|".repeat(full) + "§8" + "|".repeat(n - full);
}

function updateHud(player, gun, st, force = false) {
  const now = system.currentTick;
  if (!force && now - st.hudTick < 5) return;
  st.hudTick = now;
  if (now - st.magScanTick >= 10 || force) {
    st.magCount = countItem(player, gun.mag);
    st.magScanTick = now;
  }
  const ammo = getAmmo(player, gun);
  const ammoColor = ammo === 0 ? "§c" : ammo <= Math.ceil(gun.capacity * 0.25) ? "§6" : "§e";
  const reserveLabel = gun.shellReload ? "Shells" : "Mags";
  const reserve = isCreative(player) ? "INF" : String(st.magCount);
  let text = `§l§f${gun.name}§r  ${ammoColor}${ammo}§7/${gun.capacity}  §8|  §7${reserveLabel}: §f${reserve}`;
  if (st.reload) {
    const total = st.reload.end - st.reload.start;
    const frac = Math.min(1, Math.max(0, (now - st.reload.start) / total));
    text = `§l§f${gun.name}§r  §6Reloading ${bar(frac)}`;
  } else if (ammo === 0) {
    text += gun.zoomFov ? "  §c(empty)" : "  §c(Sneak + Use to reload)";
  }
  safe(() => player.onScreenDisplay.setActionBar(text));
}

// ---------------------------------------------------------------------------
// zoom (sniper rifles)
// ---------------------------------------------------------------------------
function setZoom(player, gun, st, on) {
  if (st.scoped === on) return;
  st.scoped = on;
  if (on) {
    safe(() => player.runCommand(`camera @s fov_set ${gun.zoomFov} 0.15 out_quad`));
  } else {
    safe(() => player.runCommand("camera @s fov_clear 0.12 out_quad"));
  }
}

function showReticle(player) {
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  let dist = 4;
  const hit = safe(() =>
    player.dimension.getBlockFromRay(eye, dir, { maxDistance: 4, includePassableBlocks: false })
  );
  if (hit) {
    const p = v.add(hit.block.location, hit.faceLocation);
    dist = Math.max(0.6, v.len(v.sub(p, eye)) - 0.15);
  }
  const vars = new MolangVariableMap();
  vars.setFloat("variable.rsize", 0.045 * dist);
  safe(() => player.spawnParticle(`${NS}:reticle`, v.add(eye, v.mul(dir, dist)), vars));
}

// ---------------------------------------------------------------------------
// reloading
// ---------------------------------------------------------------------------
function startReload(player, gun, st, quiet = false) {
  if (st.reload) return;
  const ammo = getAmmo(player, gun);
  if (ammo >= gun.capacity) {
    if (!quiet) {
      const what = gun.shellReload ? "tube" : "magazine";
      safe(() => player.onScreenDisplay.setActionBar(`§7${gun.name}: ${what} is full`));
    }
    return;
  }
  const creative = isCreative(player);
  if (!creative && countItem(player, gun.mag) <= 0) {
    if (!quiet) {
      safe(() =>
        player.onScreenDisplay.setActionBar(`§cNo ${gun.magName} left! §7Craft it from ${gun.ammoName}.`)
      );
      safe(() => player.playSound(`${NS}.dry`, { volume: 0.8 }));
    }
    st.hudTick = system.currentTick + 30; // keep the message visible for a moment
    return;
  }
  const now = system.currentTick;
  st.reload = { start: now, end: now + gun.reloadTicks, gunKey: st.gunKey, slot: st.slot, stage: 0 };
  st.triggerDown = false;
  setZoom(player, gun, st, false);
  startCooldown(player, COOLDOWN_RELOAD, gun.reloadTicks);
  const loc = player.location;
  if (gun.shellReload) {
    safe(() => player.dimension.playSound(`${NS}.shell_in`, loc, { volume: 0.8, pitch: 0.95 + Math.random() * 0.1 }));
  } else {
    safe(() => player.dimension.playSound(`${NS}.mag_out`, loc, { volume: 0.9 }));
  }
}

function tickReload(player, gun, st) {
  const r = st.reload;
  const now = system.currentTick;
  const total = r.end - r.start;
  if (!gun.shellReload) {
    if (r.stage === 0 && now - r.start >= total * 0.55) {
      r.stage = 1;
      safe(() => player.dimension.playSound(`${NS}.mag_in`, player.location, { volume: 0.9 }));
    } else if (r.stage === 1 && now - r.start >= total * 0.8) {
      r.stage = 2;
      safe(() => player.dimension.playSound(`${NS}.charge`, player.location, { volume: 0.9 }));
    }
  }
  if (now < r.end) return;
  const creative = isCreative(player);
  st.reload = null;
  if (!creative && !consumeItem(player, gun.mag)) return;
  if (gun.shellReload) {
    setAmmo(player, gun, getAmmo(player, gun) + 1);
    // keep loading shells one by one while there is room and the trigger is idle
    if (getAmmo(player, gun) < gun.capacity && !st.triggerDown) {
      startReload(player, gun, st, true);
    } else {
      safe(() => player.dimension.playSound(`${NS}.pump`, player.location, { volume: 0.9 }));
      startCooldown(player, COOLDOWN_CYCLE, gun.cycleTicks || 10);
    }
  } else {
    setAmmo(player, gun, gun.capacity);
  }
  updateHud(player, gun, st, true);
}

function cancelReload(player, st) {
  if (!st.reload) return;
  st.reload = null;
  startCooldown(player, COOLDOWN_RELOAD, 1);
}

// ---------------------------------------------------------------------------
// shooting
// ---------------------------------------------------------------------------
function worldOffset(origin, b, off) {
  return v.add(origin, v.add(v.add(v.mul(b.right, off.x), v.mul(b.up, off.y)), v.mul(b.fwd, off.z)));
}

function isOpen(dim, pos) {
  const block = safe(() => dim.getBlock(pos));
  return !block || block.isAir || block.isLiquid;
}

function particle(target, id, pos, vars) {
  safe(() => target.spawnParticle(id, pos, vars));
}

function fireShot(player, gun, st) {
  const dim = player.dimension;
  const now = system.currentTick;
  const eye = player.getHeadLocation();
  const look = player.getViewDirection();
  const cam = basis(look);
  const scoped = st.scoped;

  // spread: hip fire, moving and airborne penalties, scoped snipers are precise
  let spread = gun.spread;
  if (scoped && gun.spreadScoped !== undefined) spread = gun.spreadScoped;
  const vel = player.getVelocity();
  const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  if (speed > 0.12) spread *= 1.35;
  if (!player.isOnGround) spread *= 1.8;

  // first person muzzle (what the shooter sees) and third person muzzle (others)
  let muzzle = worldOffset(eye, cam, gun.muzzleFP);
  if (!isOpen(dim, muzzle)) muzzle = eye;
  const flat = v.norm({ x: look.x, y: 0, z: look.z });
  const bodyBasis = { right: v.norm(v.cross(flat, UP)), up: UP, fwd: flat };
  const muzzleTP = worldOffset(player.location, bodyBasis, gun.muzzleTP);
  const others = dim.getPlayers({ location: eye, maxDistance: 96 }).filter((p) => p.id !== player.id);

  for (let i = 0; i < gun.pellets; i++) {
    const dir = spreadDir(look, spread);
    // converge on whatever the crosshair ray hits
    let aimDist = gun.range;
    const hit = safe(() =>
      dim.getBlockFromRay(eye, dir, { maxDistance: gun.range, includeLiquidBlocks: false, includePassableBlocks: false })
    );
    if (hit) aimDist = Math.max(0.5, v.len(v.sub(v.add(hit.block.location, hit.faceLocation), eye)));
    const aim = v.add(eye, v.mul(dir, aimDist));
    const start = aimDist < 1.6 ? eye : muzzle;
    const travel = v.norm(v.sub(aim, start));

    const bullet = safe(() => dim.spawnEntity(`${NS}:bullet`, start));
    if (bullet) {
      const proj = bullet.getComponent("minecraft:projectile");
      if (proj) {
        safe(() => {
          proj.owner = player;
        });
        safe(() => proj.shoot(v.mul(travel, gun.velocity), { uncertainty: 0 }));
      }
      bullets.set(bullet.id, {
        entity: bullet,
        shooter: player,
        shooterId: player.id,
        gun,
        start,
        expire: now + Math.ceil(gun.range / gun.velocity) + 2,
      });
    }

    // tracer for the shooter (from the first person muzzle) ...
    const tracerSpeed = Math.min(gun.velocity * 20, 90);
    const tv = new MolangVariableMap();
    tv.setVector3("variable.dir", travel);
    tv.setFloat("variable.speed", tracerSpeed);
    tv.setFloat("variable.life", Math.min(2.5, v.len(v.sub(aim, start)) / tracerSpeed));
    particle(player, `${NS}:tracer`, start, tv);
    // ... and for everybody else (from the third person muzzle)
    if (others.length) {
      const tdir = v.norm(v.sub(aim, muzzleTP));
      const tv2 = new MolangVariableMap();
      tv2.setVector3("variable.dir", tdir);
      tv2.setFloat("variable.speed", tracerSpeed);
      tv2.setFloat("variable.life", Math.min(2.5, v.len(v.sub(aim, muzzleTP)) / tracerSpeed));
      for (const o of others) particle(o, `${NS}:tracer`, muzzleTP, tv2);
    }
  }

  // muzzle flash + smoke + ejected shell
  const fv = new MolangVariableMap();
  fv.setFloat("variable.flash", gun.flash);
  fv.setVector3("variable.dir", look);
  particle(player, `${NS}:muzzle_flash`, muzzle, fv);
  particle(player, `${NS}:muzzle_smoke`, muzzle, fv);
  const sv = new MolangVariableMap();
  sv.setVector3("variable.right", cam.right);
  sv.setFloat("variable.shotgun", gun.shellReload ? 1 : 0);
  if (!gun.cycleTicks) particle(player, `${NS}:shell`, worldOffset(eye, cam, gun.portFP), sv);
  for (const o of others) {
    particle(o, `${NS}:muzzle_flash`, muzzleTP, fv);
    particle(o, `${NS}:muzzle_smoke`, muzzleTP, fv);
  }

  // sound (heard by everyone nearby)
  safe(() =>
    dim.playSound(gun.sound, muzzle, { volume: gun.volume, pitch: 0.95 + Math.random() * 0.1 })
  );

  // client side kick / bolt / pump animations
  startCooldown(player, COOLDOWN_KICK, gun.kickTicks);
  if (gun.cycleTicks) {
    startCooldown(player, COOLDOWN_CYCLE, gun.cycleTicks);
    system.runTimeout(() => {
      if (!player.isValid) return;
      safe(() =>
        player.dimension.playSound(gun.shellReload ? `${NS}.pump` : `${NS}.bolt`, player.location, { volume: 0.9 })
      );
      const sv2 = new MolangVariableMap();
      const c2 = basis(player.getViewDirection());
      sv2.setVector3("variable.right", c2.right);
      sv2.setFloat("variable.shotgun", gun.shellReload ? 1 : 0);
      particle(player, `${NS}:shell`, worldOffset(player.getHeadLocation(), c2, gun.portFP), sv2);
    }, Math.max(2, Math.round(gun.cycleTicks * 0.35)));
  }

  // recoil: kick the aim upwards plus a little random sideways drift
  const k = scoped ? 0.65 : 1.0;
  const rot = player.getRotation();
  const pitch = Math.max(-89.9, rot.x - gun.recoilPitch * k * (0.8 + Math.random() * 0.4));
  const yaw = rot.y + (Math.random() * 2 - 1) * gun.recoilYaw * k;
  safe(() => player.setRotation({ x: pitch, y: yaw }));
  if (gun.shake > 0 && (gun.auto ? now - st.lastShot > 3 || Math.random() < 0.35 : true)) {
    safe(() => player.runCommand(`camerashake add @s ${gun.shake.toFixed(3)} 0.12 rotational`));
  }
  st.lastShot = now;
}

function tryFire(player, gun, st) {
  const now = system.currentTick;
  if (st.reload) {
    // a shotgun can interrupt its shell-by-shell reload to fire
    if (gun.shellReload && getAmmo(player, gun) > 0) cancelReload(player, st);
    else return false;
  }
  if (now < (st.nextShot[gun.id] ?? 0)) return false;
  const ammo = getAmmo(player, gun);
  if (ammo <= 0) {
    safe(() => player.dimension.playSound(`${NS}.dry`, player.location, { volume: 0.8 }));
    st.nextShot[gun.id] = now + 6;
    st.triggerDown = false;
    startReload(player, gun, st);
    return false;
  }
  fireShot(player, gun, st);
  setAmmo(player, gun, ammo - 1);
  st.nextShot[gun.id] = Math.max(st.nextShot[gun.id] ?? 0, now) + gun.interval;
  if (ammo - 1 <= 0 && gun.zoomFov) {
    // bolt-action / heavy snipers reload by themselves when empty
    system.runTimeout(() => {
      if (!player.isValid) return;
      const s2 = getState(player);
      const h = heldGun(player);
      if (h && h.gun === gun && !s2.reload) startReload(player, gun, s2, true);
    }, 10);
  }
  updateHud(player, gun, st, true);
  return true;
}

// ---------------------------------------------------------------------------
// trigger handling (works with "chargeable" use events and plain use pulses)
// ---------------------------------------------------------------------------
function onTriggerPress(player, typeId, source) {
  const gun = GUNS[typeId];
  if (!gun) return;
  const st = getState(player);
  const now = system.currentTick;
  if (source === "start") st.chargeMode = true;
  if (source === "use") st.pulseUntil = now + PULSE_WINDOW;
  if (st.triggerDown) {
    // several events can report the same press; in pulse mode (no charge events) every
    // further "use" pulse is a new trigger pull for semi-automatic guns
    if (source === "use" && !st.chargeMode && !gun.auto && now !== st.pressTick) tryFire(player, gun, st);
    return;
  }
  st.triggerDown = true;
  st.pressTick = now;
  if (player.isSneaking && !gun.zoomFov) {
    st.triggerDown = false;
    startReload(player, gun, st);
    return;
  }
  tryFire(player, gun, st);
}

function onTriggerRelease(player) {
  const st = states.get(player.id);
  if (!st) return;
  st.triggerDown = false;
  st.chargeMode = false;
}

world.afterEvents.itemStartUse.subscribe((ev) => {
  if (ev.source && ev.itemStack) onTriggerPress(ev.source, ev.itemStack.typeId, "start");
});
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.source && ev.itemStack) onTriggerPress(ev.source, ev.itemStack.typeId, "use");
});
// using the gun while the crosshair is on a nearby block reports "use on" events instead
world.afterEvents.itemStartUseOn.subscribe((ev) => {
  if (ev.source && ev.itemStack) onTriggerPress(ev.source, ev.itemStack.typeId, "use");
});
world.afterEvents.itemStopUseOn.subscribe((ev) => {
  const st = states.get(ev.source.id);
  if (st && !st.chargeMode) onTriggerRelease(ev.source);
});
world.afterEvents.itemStopUse.subscribe((ev) => onTriggerRelease(ev.source));
world.afterEvents.itemReleaseUse.subscribe((ev) => onTriggerRelease(ev.source));
world.afterEvents.itemCompleteUse.subscribe((ev) => onTriggerRelease(ev.source));

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------
function canBeHurtDirectly(target) {
  if (target.typeId === "minecraft:player") {
    const gm = safe(() => target.getGameMode());
    if (gm === GameMode.Creative || gm === GameMode.Spectator) return false;
  }
  return true;
}

/** Apply gun damage, working around the 10 tick hurt immunity so fast guns count every hit. */
function dealDamage(target, amount, shooter) {
  const now = system.currentTick;
  const opts = { cause: EntityDamageCause.projectile, damagingEntity: shooter };
  const health = target.getComponent("minecraft:health");
  if (!health) {
    safe(() => target.applyDamage(amount, opts));
    return;
  }
  const before = health.currentValue;
  const ok = safe(() => target.applyDamage(amount, opts));
  if (!target.isValid) return;
  if (ok && before - health.currentValue > 0.01) {
    hurtLog.set(target.id, { tick: now, amount });
    return;
  }
  const rec = hurtLog.get(target.id);
  if (rec && now - rec.tick < HURT_IMMUNITY_TICKS) {
    // Bedrock lets a stronger hit through during immunity (it deals the difference)
    const b2 = health.currentValue;
    const ok2 = safe(() => target.applyDamage(rec.amount + amount, opts));
    if (!target.isValid) return;
    if (ok2 && b2 - health.currentValue > 0.01) {
      rec.amount += amount;
      return;
    }
    if (!canBeHurtDirectly(target)) return;
    // last resort: take the health directly, finish the kill once immunity ends
    const left = health.currentValue - amount;
    if (left > 0.5) {
      safe(() => health.setCurrentValue(left));
    } else {
      safe(() => health.setCurrentValue(0.5));
      finishers.push({ target, shooter, due: rec.tick + HURT_IMMUNITY_TICKS });
    }
  }
}

function onBulletHitEntity(ev) {
  const id = safe(() => ev.projectile.id);
  const info = id ? bullets.get(id) : undefined;
  if (!info) return;
  bullets.delete(id);
  const target = safe(() => ev.getEntityHit()?.entity);
  if (!target || !target.isValid || target.id === info.shooterId) return;
  if (target.typeId === "minecraft:player" && !world.gameRules.pvp) return;
  const gun = info.gun;
  let dmg = gun.damage;
  if (gun.pellets > 1) {
    const dist = v.len(v.sub(ev.location, info.start));
    dmg *= Math.max(0.35, 1 - dist / gun.range);
  }
  let headshot = false;
  const head = safe(() => target.getHeadLocation());
  if (head && Math.abs(ev.location.y - head.y) < 0.3) {
    dmg *= gun.headshot;
    headshot = true;
  }
  dealDamage(target, dmg, info.shooter);
  safe(() => ev.dimension.spawnParticle(`${NS}:blood`, ev.location));
  if (info.shooter?.isValid) {
    safe(() =>
      info.shooter.playSound(`${NS}.hitmarker`, { volume: headshot ? 0.9 : 0.6, pitch: headshot ? 1.45 : 1.0 })
    );
    if (headshot) safe(() => info.shooter.onScreenDisplay.setActionBar("§c§lHEADSHOT"));
  }
}

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  try {
    onBulletHitEntity(ev);
  } catch (e) {
    console.warn(`[RealisticGuns] hit entity: ${e}`);
  }
});

// ---------------------------------------------------------------------------
// block damage
// ---------------------------------------------------------------------------
const FACE_NORMAL = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

function blockDamageEnabled() {
  return world.getDynamicProperty(PROP_BLOCK_DAMAGE) !== false;
}

function toughnessOf(typeId) {
  const id = typeId.startsWith("minecraft:") ? typeId.slice(10) : typeId;
  if (IMMUNE_BLOCKS.includes(id)) return Infinity;
  for (const [pattern, value] of BLOCK_TOUGHNESS) {
    if (id.includes(String(pattern))) return Number(value);
  }
  return BLOCK_TOUGHNESS_DEFAULT;
}

function hitSound(typeId) {
  if (/glass|ice/.test(typeId)) return "random.glass";
  if (/leaves|grass|flower|vine|sapling|bush|fern|kelp|moss/.test(typeId)) return "hit.grass";
  if (/wool|carpet/.test(typeId)) return "hit.cloth";
  if (/sand/.test(typeId) && !/sandstone/.test(typeId)) return "hit.sand";
  if (/gravel|dirt|mud|clay|farmland|podzol|mycelium/.test(typeId)) return "hit.gravel";
  if (/snow/.test(typeId)) return "hit.snow";
  if (/plank|log|wood|stem|hyphae|fence|door|trapdoor|bookshelf|sign/.test(typeId)) return "hit.wood";
  if (/iron|gold|copper|anvil|chain|bars/.test(typeId)) return "hit.iron";
  return "hit.stone";
}

function damageBlock(block, amount, shooter) {
  if (!blockDamageEnabled()) return;
  if (shooter && safe(() => shooter.getGameMode()) === GameMode.Adventure) return;
  if (block.typeId === "minecraft:tnt") {
    // a bullet sets TNT off
    const center = block.center();
    safe(() => block.setType("minecraft:air"));
    safe(() => block.dimension.spawnEntity("minecraft:tnt", center));
    return;
  }
  const tough = toughnessOf(block.typeId);
  if (!Number.isFinite(tough)) return;
  const { x, y, z } = block.location;
  const key = `${block.dimension.id}|${x}|${y}|${z}`;
  const now = system.currentTick;
  let rec = blockDamage.get(key);
  if (!rec || rec.type !== block.typeId) rec = { dmg: 0, type: block.typeId, last: now };
  rec.dmg += amount;
  rec.last = now;
  if (rec.dmg >= tough) {
    blockDamage.delete(key);
    safe(() => block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`));
  } else {
    blockDamage.set(key, rec);
  }
}

function onBulletHitBlock(ev) {
  const id = safe(() => ev.projectile.id);
  const info = id ? bullets.get(id) : undefined;
  if (!info) return;
  bullets.delete(id);
  const hit = safe(() => ev.getBlockHit());
  if (!hit) return;
  const block = hit.block;
  const nrm = FACE_NORMAL[hit.face] ?? UP;
  const pos = v.add(ev.location, v.mul(nrm, 0.03));
  const vars = new MolangVariableMap();
  vars.setVector3("variable.nrm", nrm);
  safe(() => ev.dimension.spawnParticle(`${NS}:impact`, pos, vars));
  safe(() => ev.dimension.playSound(hitSound(block.typeId), pos, { volume: 0.7, pitch: 0.9 + Math.random() * 0.25 }));
  const gun = info.gun;
  let amount = gun.damage * gun.blockDamage;
  if (gun.pellets > 1) amount *= Math.max(0.35, 1 - v.len(v.sub(ev.location, info.start)) / gun.range);
  damageBlock(block, amount, info.shooter);
}

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  try {
    onBulletHitBlock(ev);
  } catch (e) {
    console.warn(`[RealisticGuns] hit block: ${e}`);
  }
});

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== `${NS}:blockdamage`) return;
  const arg = ev.message.trim().toLowerCase();
  const on = arg === "on" || arg === "true" || arg === "1";
  const off = arg === "off" || arg === "false" || arg === "0";
  if (on || off) world.setDynamicProperty(PROP_BLOCK_DAMAGE, on);
  const msg = `§7[Realistic Guns] Bullet block damage is ${blockDamageEnabled() ? "§aON" : "§cOFF"}`;
  const src = ev.sourceEntity;
  if (src instanceof Player) safe(() => src.sendMessage(msg));
  else world.sendMessage(msg);
});

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
function tickPlayer(player) {
  const st = getState(player);
  const held = heldGun(player);
  const slot = player.selectedSlotIndex;
  const key = held ? held.item.typeId : "";
  if (key !== st.gunKey || slot !== st.slot) {
    // switched weapon: drop the trigger, cancel reload, zoom out
    if (st.reload) cancelReload(player, st);
    st.triggerDown = false;
    st.chargeMode = false;
    const prevGun = GUNS[st.gunKey];
    if (st.scoped && prevGun) setZoom(player, prevGun, st, false);
    st.scoped = false;
    st.gunKey = key;
    st.slot = slot;
    if (held) {
      const id = held.gun.id;
      st.nextShot[id] = Math.max(st.nextShot[id] ?? 0, system.currentTick + 4); // equip time
      updateHud(player, held.gun, st, true);
    }
  }
  if (!held) return;
  const gun = held.gun;
  const now = system.currentTick;

  if (st.triggerDown && !st.chargeMode && now > st.pulseUntil) st.triggerDown = false;
  if (st.reload) tickReload(player, gun, st);
  if (st.triggerDown && gun.auto && !st.reload) tryFire(player, gun, st);

  if (gun.zoomFov) {
    const want = player.isSneaking && !st.reload;
    setZoom(player, gun, st, want);
    if (st.scoped) showReticle(player);
  }
  updateHud(player, gun, st);
}

function tickBullets(now) {
  for (const [id, b] of bullets) {
    if (now > b.expire || !b.entity.isValid) {
      if (b.entity.isValid) safe(() => b.entity.remove());
      bullets.delete(id);
    }
  }
  if (bullets.size > MAX_BULLETS) {
    const extra = bullets.size - MAX_BULLETS;
    let i = 0;
    for (const [id, b] of bullets) {
      if (i++ >= extra) break;
      if (b.entity.isValid) safe(() => b.entity.remove());
      bullets.delete(id);
    }
  }
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    try {
      tickPlayer(player);
    } catch (e) {
      console.warn(`[RealisticGuns] tick: ${e}`);
    }
  }
  tickBullets(now);
  for (let i = finishers.length - 1; i >= 0; i--) {
    const f = finishers[i];
    if (now < f.due) continue;
    finishers.splice(i, 1);
    if (f.target.isValid) {
      safe(() =>
        f.target.applyDamage(1000, { cause: EntityDamageCause.projectile, damagingEntity: f.shooter?.isValid ? f.shooter : undefined })
      );
    }
  }
  if (now % 100 === 0) {
    for (const [k, rec] of hurtLog) if (now - rec.tick > 40) hurtLog.delete(k);
    for (const [k, rec] of blockDamage) if (now - rec.last > BLOCK_DAMAGE_MEMORY) blockDamage.delete(k);
  }
}, 1);

world.afterEvents.playerLeave.subscribe((ev) => {
  states.delete(ev.playerId);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  const st = states.get(ev.player.id);
  if (st) {
    st.scoped = false;
    st.reload = null;
    st.triggerDown = false;
  }
  // make sure nobody is stuck zoomed in (e.g. after /reload or a crash while scoped)
  safe(() => ev.player.runCommand("camera @s fov_clear"));
});

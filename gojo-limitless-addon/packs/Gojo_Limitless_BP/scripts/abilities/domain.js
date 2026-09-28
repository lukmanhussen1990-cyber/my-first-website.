import { EntityDamageCause, world } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { addTask } from "../core/tasks.js";
import { refreshBuffs } from "../core/buffs.js";
import { hurt, effect } from "../core/combat.js";
import { targetsNear, bodyCenter, PROJECTILES } from "../core/targets.js";
import { qualitySuffix } from "../core/settings.js";
import { particle, sound, shake, pose, playersNear, cinematicTitle, screenFlash } from "../lib/fx.js";
import { alive, logError } from "../lib/util.js";
import { distance, distanceSq } from "../lib/vec.js";

const RADIUS = 14;
const OPEN_TICKS = 16;
const ACTIVE_TICKS = 240; // 12 seconds
const FOG_ID = "gojo_unlimited_void";
const PARALYSIS = ["slowness", "weakness", "mining_fatigue", "darkness", "nausea"];

registerAbility("unlimited_void", (player, st) => {
  if (st.domain) {
    flash(st, "§dYour domain is already expanded", 30);
    return false;
  }
  const center = player.location;
  const dim = player.dimension;
  st.busy = "Unlimited Void";
  st.domain = { center, radius: RADIUS, endTick: 0 };
  pose(player, "animation.gojo.domain");
  sound(dim, "gojo.domain.open", center, { radius: 64 });
  particle(dim, "gojo:void_open", { x: center.x, y: center.y + 1, z: center.z });
  for (const p of playersNear(dim, center, RADIUS + 8)) {
    cinematicTitle(p, "§f§lDOMAIN EXPANSION", "§b§oUnlimited Void", 45);
  }
  shake(playersNear(dim, center, RADIUS + 8), 0.35, 0.8);
  addTask(domainTask(player, st, center));
  return true;
});

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("../core/state.js").PlayerState} st
 * @param {import("@minecraft/server").Vector3} feet
 * @returns {import("../core/tasks.js").Task}
 */
function domainTask(player, st, feet) {
  const dim = player.dimension;
  const dimId = dim.id;
  const center = { x: feet.x, y: feet.y + 1, z: feet.z };
  const floor = { x: feet.x, y: feet.y + 0.15, z: feet.z };
  const suffix = qualitySuffix();
  let age = 0;
  /** @type {Map<string, import("@minecraft/server").Vector3>} captured entity -> lock position */
  const locked = new Map();
  /** @type {Set<string>} players with the void fog pushed */
  const fogged = new Set();

  return {
    name: "domain",
    ownerId: player.id,
    update(tick) {
      age++;
      if (!alive(player)) return false;
      if (player.dimension.id !== dimId) return false;
      if (distance(player.location, feet) > RADIUS + 6) return false;
      if (age === 8) {
        for (const p of playersNear(dim, center, RADIUS + 2)) screenFlash(p, { red: 0, green: 0, blue: 0.02 }, 0.2, 0.35, 0.9);
      }
      if (age < OPEN_TICKS) return true;
      const active = age - OPEN_TICKS;
      if (active === 0) {
        st.busy = "";
        if (st.domain) st.domain.endTick = tick + ACTIVE_TICKS;
        refreshBuffs(player, st, true);
        flash(st, "§d§lUnlimited Void §7» §fsure-hit active", 50);
      }
      if (active >= ACTIVE_TICKS) return false;
      // Visuals are re-emitted every 2 s so they vanish quickly if the domain ends early.
      if (active % 40 === 0) {
        particle(dim, "gojo:void_dome" + suffix, center);
        particle(dim, "gojo:void_stars" + suffix, center);
        particle(dim, "gojo:void_galaxy", floor);
      }
      if (active % 40 === 20) sound(dim, "gojo.domain.ambient", center, { radius: RADIUS + 10, volume: 0.9 });
      if (active % 5 === 0) paralyse(active);
      if (active % 10 === 0) fog();
      return true;
    },
    end() {
      st.domain = null;
      if (st.busy === "Unlimited Void") st.busy = "";
      if (alive(player)) {
        refreshBuffs(player, st, true);
        flash(st, "§7Domain collapsed", 40);
      }
      particle(dim, "gojo:void_collapse", center);
      sound(dim, "gojo.domain.close", center, { radius: 48 });
      release();
    },
  };

  /** @param {number} active ticks since the domain opened */
  function paralyse(active) {
    const inside = targetsNear(dim, center, RADIUS, player);
    let glyphs = 0;
    for (const e of inside) {
      const isPlayer = e.typeId === "minecraft:player";
      effect(e, "slowness", 20, 255);
      effect(e, "weakness", 20, 255);
      effect(e, "mining_fatigue", 20, 2);
      if (isPlayer) {
        effect(e, "darkness", 40, 0);
        effect(e, "nausea", 60, 0);
      }
      let lock = locked.get(e.id);
      if (!lock) {
        lock = e.location;
        locked.set(e.id, lock);
      } else {
        try {
          if (distanceSq(e.location, lock) > 0.36) e.teleport(lock, { keepVelocity: false });
          else e.clearVelocity();
        } catch {
          // players cannot have velocity cleared; teleport covers them
        }
      }
      if (active % 10 === 0 && glyphs < 12) {
        glyphs++;
        const head = bodyCenter(e);
        particle(dim, "gojo:void_glyph", { x: head.x, y: head.y + 1.2, z: head.z });
      }
      if (active % 20 === 0) hurt(e, 2, player, EntityDamageCause.magic);
    }
    // Hostile projectiles dissolve inside the domain.
    try {
      for (const e of dim.getEntities({ location: center, maxDistance: RADIUS })) {
        if (!PROJECTILES.has(e.typeId)) continue;
        const proj = /** @type {import("@minecraft/server").EntityProjectileComponent | undefined} */ (
          e.getComponent("minecraft:projectile")
        );
        let ownerId;
        try {
          ownerId = proj?.owner?.id;
        } catch {
          ownerId = undefined;
        }
        if (ownerId === player.id || e.typeId === "minecraft:thrown_trident") continue;
        particle(dim, "gojo:infinity_ripple", e.location);
        e.remove();
      }
    } catch (err) {
      logError("domain.projectiles", err);
    }
  }

  function fog() {
    const now = new Set();
    for (const p of playersNear(dim, center, RADIUS)) {
      now.add(p.id);
      if (fogged.has(p.id)) continue;
      fogged.add(p.id);
      p.runCommandAsync(`fog @s push gojo:unlimited_void ${FOG_ID}`).catch(() => {});
    }
    for (const id of [...fogged]) {
      if (now.has(id)) continue;
      fogged.delete(id);
      clearFog(id);
    }
  }

  /** @param {string} id */
  function clearFog(id) {
    const p = world.getEntity(id);
    if (!p || !alive(p)) return;
    try {
      p.runCommandAsync(`fog @s remove ${FOG_ID}`).catch(() => {});
    } catch {
      // ignore
    }
  }

  function release() {
    for (const id of locked.keys()) {
      const e = world.getEntity(id);
      if (!e || !alive(e)) continue;
      for (const eff of PARALYSIS) {
        try {
          const cur = e.getEffect(eff);
          if (cur && cur.duration <= 60) e.removeEffect(eff);
        } catch {
          // ignore
        }
      }
    }
    locked.clear();
    for (const id of fogged) clearFog(id);
    fogged.clear();
  }
}

/** Remove a leftover void fog (e.g. the world closed during a domain). */
export function clearVoidFog(/** @type {import("@minecraft/server").Player} */ player) {
  try {
    player.runCommandAsync(`fog @s remove ${FOG_ID}`).catch(() => {});
  } catch {
    // ignore
  }
}

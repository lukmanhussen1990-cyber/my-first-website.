import { system } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { hurt, knock, effect } from "../core/combat.js";
import { isHostileTarget, lookTarget, coneTarget, bodyCenter } from "../core/targets.js";
import { particle, sound, shake, pose, playersNear, cinematicTitle } from "../lib/fx.js";
import { addScaled, distance } from "../lib/vec.js";

const REACH = 7; // dash range when tapping at an enemy
const BASE_DAMAGE = 16;
const ZONE_WINDOW = 160; // 8 s to chain the next Black Flash
const MAX_STACKS = 3;

registerAbility("black_flash", (player, st, ctx) => {
  const dim = player.dimension;
  let target = ctx.target && isHostileTarget(ctx.target, player) ? ctx.target : undefined;
  if (!target) target = lookTarget(player, REACH) ?? coneTarget(player, 5.5, 0.8);
  pose(player, "animation.gojo.black_flash");

  if (!target) {
    // Whiff: a short lunge that still crackles with black sparks.
    const dir = player.getViewDirection();
    const eye = player.getHeadLocation();
    try {
      player.tryTeleport(addScaled(player.location, { x: dir.x, y: 0, z: dir.z }, 2.5), { checkForBlocks: true, keepVelocity: false });
    } catch {
      // stay in place
    }
    particle(dim, "gojo:black_flash_whiff", addScaled(eye, dir, 1.5));
    sound(dim, "gojo.black_flash.whiff", eye, { radius: 16 });
    flash(st, "§4Black Flash §8» §7no target in reach", 30);
    return true;
  }

  // Dash in front of the target if it is out of arm's reach.
  const tc = bodyCenter(target);
  const here = player.location;
  const d = distance(here, target.location);
  if (d > 3) {
    const dx = here.x - target.location.x;
    const dz = here.z - target.location.z;
    const l = Math.sqrt(dx * dx + dz * dz) || 1;
    const spot = { x: target.location.x + (dx / l) * 1.4, y: target.location.y, z: target.location.z + (dz / l) * 1.4 };
    try {
      player.tryTeleport(spot, { checkForBlocks: true, facingLocation: tc, keepVelocity: false });
    } catch {
      // fall back to striking from where we are
    }
  }

  // The Zone: consecutive Black Flashes grow stronger.
  const now = system.currentTick;
  st.flowStacks = now - st.lastBlackFlashTick <= ZONE_WINDOW ? Math.min(MAX_STACKS, st.flowStacks + 1) : 0;
  st.lastBlackFlashTick = now;
  const multiplier = 1 + st.flowStacks * 0.25;

  hurt(target, BASE_DAMAGE * multiplier, player);
  const p = player.location;
  const kx = target.location.x - p.x;
  const kz = target.location.z - p.z;
  const kl = Math.sqrt(kx * kx + kz * kz) || 1;
  knock(target, kx / kl, kz / kl, 2.2 + st.flowStacks * 0.3, 0.45);
  effect(target, "slowness", 30, 2);

  particle(dim, "gojo:black_flash", tc);
  sound(dim, "gojo.black_flash", tc, { radius: 48 });
  shake(playersNear(dim, tc, 12), 0.35 + st.flowStacks * 0.1, 0.35);
  if (st.flowStacks >= MAX_STACKS) {
    cinematicTitle(player, "§4§lBLACK FLASH", "§c§oYou are in the Zone", 20);
  }
  const chain = st.flowStacks > 0 ? ` §cx${st.flowStacks + 1}` : "";
  flash(st, `§4§lBLACK FLASH!${chain} §7(${Math.round(BASE_DAMAGE * multiplier)} dmg)`, 40);
  return true;
});

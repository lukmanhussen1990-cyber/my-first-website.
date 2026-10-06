// @ts-check
// /scriptevent pas:outbreak <status|pause|resume|cleanup|cure|start> (SPEC §7).
// Needs cheats (as every /scriptevent). Replies go to the player who ran it,
// otherwise to everyone (command blocks / server console).

import { world, system } from "@minecraft/server";
import { safe, tell } from "../lib/util.js";
import * as api from "./api.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Player} Player */

export const COMMAND_ID = "pas:outbreak";
export const COMMAND_USAGE = "Usage: /scriptevent pas:outbreak <status|pause|resume|cleanup|cure|start>";

/**
 * Multi-line status text.
 * @returns {string}
 */
export function statusText() {
  const st = api.getState();
  const cfg = api.getConfig();
  const s = api.getStatus();
  const mode = !st.active ? "inactive" : st.paused ? "PAUSED" : "ACTIVE";
  return [
    `☣ Outbreak: ${mode} | Generation ${st.generation} | Next ${Math.max(0, Math.ceil(st.ticksToNext / 20))}s`,
    `Parasites ${s.parasites} | Infected ${s.infected} | Incubating ${s.incubating} | Infected players ${s.infectedPlayers} | Population ${s.total}/${cfg.populationCap}`,
    `Config: replication ${cfg.replicationSeconds}s, incubation ${cfg.incubationSeconds}s, player incubation ${cfg.playerIncubationSeconds}s, infect players ${cfg.infectPlayers}, HUD ${cfg.showHud}`,
    `Stats: births ${st.stats.births}, infections ${st.stats.infections}, conversions ${st.stats.conversions}, deaths ${st.stats.deaths} | epoch ${st.epoch}`,
  ].join("\n");
}

/**
 * Execute one sub-command.
 * @param {string} message e.g. "pause"
 * @param {{sourceEntity?: Entity, sourceBlock?: Block}} [source]
 * @returns {string} reply text
 */
export function runCommand(message, source = {}) {
  const sub = String(message ?? "").trim().split(/\s+/)[0].toLowerCase();
  switch (sub) {
    case "status":
      return statusText();
    case "pause":
      return api.pause() ? "☣ Outbreak paused." : "☣ Nothing to pause (inactive or already paused).";
    case "resume":
      return api.resume() ? "☣ Outbreak resumed." : "☣ Nothing to resume (inactive or not paused).";
    case "cleanup":
      return `☣ Outbreak cleaned up (${api.cleanup()} loaded entities).`;
    case "cure":
      return `☣ Everything cured (${api.cure()} loaded entities).`;
    case "start": {
      const ent = source.sourceEntity;
      const blk = source.sourceBlock;
      let e;
      if (ent && ent.isValid()) {
        const player = ent.typeId === "minecraft:player" ? /** @type {Player} */ (ent) : undefined;
        e = api.startOutbreak(ent.dimension, ent.location, player);
      } else if (blk) {
        e = api.startOutbreak(blk.dimension, { x: blk.x + 0.5, y: blk.y + 1, z: blk.z + 0.5 });
      } else {
        return "☣ 'start' needs a source (run it as a player or from a command block).";
      }
      return e ? `☣ Parasite released (population ${api.hordeCount()}).` : "☣ No parasite released (cap reached or invalid location).";
    }
    default:
      return COMMAND_USAGE;
  }
}

let initialized = false;

/** Subscribe the scriptevent handler (idempotent). */
export function initCommands() {
  if (initialized) return;
  initialized = true;
  system.afterEvents.scriptEventReceive.subscribe(
    safe((ev) => {
      if (ev.id !== COMMAND_ID) return;
      const reply = runCommand(ev.message, { sourceEntity: ev.sourceEntity, sourceBlock: ev.sourceBlock });
      const src = ev.sourceEntity;
      if (src && src.typeId === "minecraft:player") tell(/** @type {Player} */ (src), reply);
      else world.sendMessage(reply);
    }, "outbreak.command"),
    { namespaces: ["pas"] },
  );
}

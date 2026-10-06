// Shared helpers for the torchlight reload scenarios (child processes run by
// tests/torch_reload.test.mjs through tests/mock/harness.mjs). Not a test file itself.

import { scenario } from "../mock/harness.mjs";

export const OW = "minecraft:overworld";
export const LIGHT = "minecraft:light_block";
/** Two dark rooms: one at the origin (chunks -1..0) and one far away around x=200 (chunk 12). */
export const ROOMS = [
  { min: { x: -10, y: 60, z: -10 }, max: { x: 10, y: 70, z: 10 } },
  { min: { x: 190, y: 60, z: -10 }, max: { x: 210, y: 70, z: 10 } },
];
/** Chunk of the far room. */
export const FAR_CHUNK = { cx: 12, cz: 0 };

/**
 * Start a scenario with only the torchlight subsystem (plus the shared item dispatcher it
 * registers with), like main.js does for it.
 * @param {{before?: (mock: any) => void}} [opts]
 */
export async function beginTorchScenario(opts = {}) {
  const sc = await scenario.begin({ importAddon: false, ...opts });
  const torch = await import("../../addon/behavior_pack/scripts/torchlight/index.js");
  const util = await import("../../addon/behavior_pack/scripts/lib/util.js");
  const ids = await import("../../addon/behavior_pack/scripts/lib/ids.js");
  torch.initTorchlight();
  const { mock, server } = sc;
  return {
    sc,
    mock,
    world: server.world,
    torch,
    ITEMS: ids.ITEMS,
    PROPS: ids.PROPS,
    /** Every light block of the overworld, loaded or not: {"x,y,z": level}. */
    lights() {
      const out = {};
      for (const b of mock.listBlocks(OW, LIGHT)) out[`${b.x},${b.y},${b.z}`] = b.states.block_light_level;
      return out;
    },
    /** The persisted cell list (or null when absent). */
    stored() {
      const raw = server.world.getDynamicProperty(ids.PROPS.TORCH_CELLS);
      return raw === undefined ? null : JSON.parse(raw);
    },
    /** Errors the torch code logged and swallowed. */
    torchErrors() {
      return [...util.getErrorCounts()].filter(([k]) => k.startsWith("torch"));
    },
  };
}

/** Hollow stone room. */
export function room(mock, min, max) {
  mock.fill(OW, min, max, "minecraft:stone");
  mock.fill(OW, { x: min.x + 1, y: min.y + 1, z: min.z + 1 }, { x: max.x - 1, y: max.y - 1, z: max.z - 1 }, "minecraft:air");
}

// Child-process side of the outbreak reload tests (not a test file).
// Starts the mock world (optionally loading PAS_SCENARIO_IN) and the outbreak
// subsystem only (items dispatcher + outbreak), like a game start.

import { scenario } from "../mock/harness.mjs";

const ROOT = new URL("../../addon/behavior_pack/scripts/", import.meta.url);

export async function startOutbreakWorld() {
  const sc = await scenario.begin({ importAddon: false, startup: false });
  const items = await import(new URL("lib/items.js", ROOT).href);
  const outbreak = await import(new URL("outbreak/index.js", ROOT).href);
  const api = await import(new URL("outbreak/api.js", ROOT).href);
  const util = await import(new URL("lib/util.js", ROOT).href);
  items.initItems();
  outbreak.initOutbreak();
  sc.mock.startup();
  const world = sc.server.world;
  const overworld = world.getDimension("overworld");
  const count = (type) => overworld.getEntities({ type }).length;
  const storedState = () => JSON.parse(world.getDynamicProperty("pas:outbreak") ?? "null");
  const outbreakErrors = () => [...util.getErrorCounts().keys()].filter((k) => k.startsWith("outbreak"));
  return { sc, mock: sc.mock, world, overworld, api, count, storedState, outbreakErrors };
}

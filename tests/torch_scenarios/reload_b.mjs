// Session 2: the world from the crash is loaded with the far room's chunk unloaded.
// Startup must clear every recorded light block it can reach and keep the rest pending.
import { beginTorchScenario, OW, FAR_CHUNK } from "./common.mjs";

const t = await beginTorchScenario({ before: (m) => m.unloadChunk(OW, FAR_CHUNK.cx, FAR_CHUNK.cz) });
const { mock, sc, torch } = t;
mock.tick(1); // startup cleanup runs on the first tick
const afterStartup = { lights: t.lights(), pending: torch.__torchInternals.pendingCount(), stone: mock.blockName(OW, { x: 0, y: 62, z: 3 }) };
mock.tick(45); // pending retries (chunk still unloaded) + throttled save
sc.end({
  afterStartup,
  lights: t.lights(),
  pending: torch.__torchInternals.pendingCount(),
  stored: t.stored(),
  errors: t.torchErrors(),
});

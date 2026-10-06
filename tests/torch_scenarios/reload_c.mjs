// Session 3: a second reload while the far chunk is still unloaded - the pending cells must
// still be known (persisted) - then the chunk loads and they are cleared; finally the torch
// works normally again.
import { beginTorchScenario, OW, FAR_CHUNK } from "./common.mjs";

const t = await beginTorchScenario();
const { mock, sc, torch, world, ITEMS } = t;
mock.tick(2);
const atStart = { lights: t.lights(), pending: torch.__torchInternals.pendingCount(), loaded: mock.isChunkLoaded(OW, { x: 200, y: 0, z: 0 }) };
mock.loadChunk(OW, FAR_CHUNK.cx, FAR_CHUNK.cz);
mock.tick(41); // next maintenance pass
const afterLoad = { lights: t.lights(), pending: torch.__torchInternals.pendingCount() };
mock.tick(21); // throttled save
const storedAfterCleanup = t.stored();

const alpha = world.getAllPlayers().find((p) => p.name === "Alpha");
mock.setView(alpha, { rotation: { x: 0, y: -90 } }); // look east
mock.setMainhand(alpha, ITEMS.TORCH_ON);
mock.tick(2);
const relit = t.lights();
mock.tick(21);
sc.end({ atStart, afterLoad, storedAfterCleanup, relit, storedRelit: t.stored(), errors: t.torchErrors() });

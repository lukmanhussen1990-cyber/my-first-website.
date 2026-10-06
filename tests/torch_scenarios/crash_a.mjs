// Session 1: two players light up two rooms, then the game "crashes": the world is saved
// with the light blocks and the persisted cell list, and no cleanup code runs. Before the
// crash a player replaced one light block with stone, and both players had already put the
// torch away (inventory saved, but the torch code never got to react).
import { beginTorchScenario, room, ROOMS, OW } from "./common.mjs";

const t = await beginTorchScenario();
const { mock, sc, ITEMS } = t;
for (const r of ROOMS) room(mock, r.min, r.max);
const alpha = mock.addPlayer({ name: "Alpha", location: { x: 0.5, y: 61, z: 0.5 }, rotation: { x: 0, y: 0 } });
const bravo = mock.addPlayer({ name: "Bravo", location: { x: 200.5, y: 61, z: 0.5 }, rotation: { x: 0, y: 0 } });
mock.setMainhand(alpha, ITEMS.TORCH_ON);
mock.setMainhand(bravo, ITEMS.TORCH_ON);
mock.tick(45); // lights placed and the throttled save written
const lights = t.lights();
const stored = t.stored();

// unnoticed edits right before the crash
mock.setBlock(OW, { x: 0, y: 62, z: 3 }, "minecraft:stone");
mock.setMainhand(alpha, undefined);
mock.setMainhand(bravo, undefined);
// crash: snapshot now, no tick, no cleanup
sc.end({ lights, stored, errors: t.torchErrors() });

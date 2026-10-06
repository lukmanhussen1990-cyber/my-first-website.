// Entry point for tests: the mock control objects.
//   import { mock, ui } from "./mock/testkit.mjs";
// `mock` controls @minecraft/server (ticks, world, players, events, save/reload),
// `ui` controls @minecraft/server-ui (queued form responses, shown forms).
// Both are the same module instances the add-on gets from "@minecraft/server".
export { __mock as mock } from "./server.mjs";
export { __ui as ui } from "./server-ui.mjs";
export * as mc from "./server.mjs";
export * as mcui from "./server-ui.mjs";
export { buildMcstructure, readNbt, writeNbt, T as nbt } from "./nbt.mjs";
export { hasVanillaRef, refPath, REPO_ROOT, BP_DIR, RP_DIR } from "./vanilla.mjs";

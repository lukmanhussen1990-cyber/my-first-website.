// PAS engine test pack (test-only, never shipped). Registers GameTests "pas:<name>"
// that tools/engine/run_engine.py runs one by one with
//   execute positioned <x> <y> <z> run gametest run pas:<name>
// Importing @minecraft/server-gametest only works in a world with the "Beta APIs"
// experiment, so the PASTEST_READY line is also the proof that it is enabled.
import { world, system } from "@minecraft/server";
import { printRegistry, out } from "./harness.js";
import "./tests_basic.js";
import "./tests_torch.js";
import "./tests_house.js";
import "./tests_outbreak.js";
import "./tests_player.js";
import "./tests_reload.js";

world.afterEvents.worldInitialize.subscribe(() => {
  system.runTimeout(() => {
    printRegistry();
    out(`PASTEST_READY|tick=${system.currentTick}`);
  }, 10);
});

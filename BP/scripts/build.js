// The Hollow Bride - staggered world build.
// Bedrock cannot ship a .mcstructure as text, so the manor is emitted from
// .mcfunction files instead - one file per room, each well under 300 commands,
// one file per build tick so no single tick ever spikes.

import { system } from "@minecraft/server";
import { BUILD_STEPS, RUIN_STEPS, TICKING_AREA } from "./config.js";
import { dim, runCmd, log, players, hint } from "./util.js";
import { gget, gset } from "./state.js";

const BUILD_SPACING = 20; // ticks between build steps

function setupWorldRules() {
  const d = dim();
  if (!d) return;
  runCmd(d, "gamerule keepinventory true");
  runCmd(d, "gamerule doimmediaterespawn false");
  runCmd(d, "gamerule showcoordinates false");
  runCmd(d, "gamerule domobspawning false");
  runCmd(d, "gamerule dodaylightcycle false");
  runCmd(d, "gamerule doweathercycle false");
  runCmd(d, "gamerule commandblockoutput false");
  runCmd(d, "gamerule sendcommandfeedback false");
  runCmd(d, "gamerule naturalregeneration true");
  runCmd(d, "time set 16000");
  runCmd(d, "weather rain 999999");
}

function setupTickingArea() {
  const d = dim();
  if (!d) return;
  // Exactly one ticking area for the entire run.
  runCmd(d, "tickingarea remove_all");
  runCmd(
    d,
    "tickingarea add circle " +
      TICKING_AREA.center.x +
      " " +
      TICKING_AREA.center.y +
      " " +
      TICKING_AREA.center.z +
      " " +
      TICKING_AREA.chunkRadius +
      " " +
      TICKING_AREA.name
  );
}

function runSteps(steps, onDone) {
  let i = 0;
  let handle = -1;
  const tick = () => {
    try {
      const d = dim();
      if (!d) return;
      if (i >= steps.length) {
        try {
          system.clearRun(handle);
        } catch (e) {
          // ignore
        }
        if (onDone) onDone();
        return;
      }
      const step = steps[i];
      i++;
      const ok = runCmd(d, "function " + step);
      if (!ok) log("build step failed: " + step);
      for (const p of players()) {
        hint(p, "Building the manor " + i + "/" + steps.length);
      }
    } catch (e) {
      log("build tick failed: " + (e && e.message ? e.message : e));
    }
  };
  try {
    handle = system.runInterval(tick, BUILD_SPACING);
  } catch (e) {
    log("could not start build interval");
  }
}

export function ensureBuilt() {
  if (gget("built", false) === true) {
    setupTickingArea();
    return;
  }
  setupWorldRules();
  setupTickingArea();
  runSteps(BUILD_STEPS, () => {
    gset("built", true);
    log("manor build complete");
    for (const p of players()) {
      hint(p, "The manor is finished. Walk north.");
    }
  });
}

export function buildRuin(onDone) {
  if (gget("ruined", false) === true) {
    if (onDone) onDone();
    return;
  }
  gset("ruined", true);
  runSteps(RUIN_STEPS, onDone);
}

export function resetBuildFlag() {
  gset("built", false);
  gset("ruined", false);
}

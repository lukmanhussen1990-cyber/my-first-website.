// The Hollow Bride - act logic, hunters, puzzles and endings.
// Hard rule enforced here: never more than three entities with active AI.

import { world, system, ItemStack } from "@minecraft/server";
import {
  PROPS,
  PAGES,
  MELODY,
  PORTRAIT_ORDER,
  CELLAR_ANSWER,
  CELLAR_NAMES,
  NOISE,
  TELL_TICKS,
  MIRROR_WING_CENTRE_X
} from "./config.js";
import {
  dist,
  distFlat,
  hint,
  sound,
  worldSound,
  titleCard,
  spawn,
  despawnAll,
  entitiesOfType,
  getBlockAt,
  getState,
  setBlockState,
  runCmd,
  clamp,
  norm,
  sub,
  particle,
  log,
  dim
} from "./util.js";
import {
  pget,
  pset,
  pnum,
  pbool,
  pstr,
  gget,
  gset,
  giveKeyFlag,
  hasKey,
  keyCount,
  addPage,
  shotsTaken,
  addShot,
  clearShots
} from "./state.js";
import {
  isObserved,
  observation,
  damageScaled,
  sendToCheckpoint,
  tell,
  canScare,
  markScare,
  lightCandle,
  refuelCandle,
  litWallCandleNear,
  isLightSafe
} from "./systems.js";
import { showWill, showJournal, showPhoto, showBellRiddle, showBellHint, showEnding, confirmStay } from "./ui.js";

const HUNTERS = [
  "ag:nanny",
  "ag:reflection",
  "ag:watcher",
  "ag:hollow_bride",
  "ag:hollow_child",
  "ag:drowned_wraith"
];

// Keep the AI budget honest: anything not wanted in this room is removed.
function keepOnly(allowed) {
  for (const t of HUNTERS) {
    if (allowed.indexOf(t) !== -1) continue;
    if (entitiesOfType(t).length > 0) despawnAll(t);
  }
}

function firstOf(typeId) {
  const list = entitiesOfType(typeId);
  return list.length > 0 ? list[0] : undefined;
}

function giveItem(player, typeId, amount) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return false;
    inv.container.addItem(new ItemStack(typeId, amount || 1));
    return true;
  } catch (e) {
    return false;
  }
}

function hasItem(player, typeId) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return false;
    const c = inv.container;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it && it.typeId === typeId) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function consumeItem(player, typeId) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return false;
    const c = inv.container;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it && it.typeId === typeId) {
        if (it.amount > 1) {
          it.amount = it.amount - 1;
          c.setItem(i, it);
        } else {
          c.setItem(i, undefined);
        }
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ---- Act 0: The Approach ----------------------------------------------------

function tickAct0(player) {
  keepOnly([]);
  if (!pbool(player, "read_will", false)) {
    hint(player, "Tap the mailbox by the gate.");
    return;
  }
  if (!pbool(player, "crossed", false)) {
    hint(player, "The door is open. It should not be.");
    if (distFlat(player.location, PROPS.frontDoor) < 2.0) crossThreshold(player);
  }
}

function crossThreshold(player) {
  pset(player, "crossed", true);
  pset(player, "act", 1);
  worldSound("ag.door_slam", player.location, 0.6, 1.0);
  titleCard(player, "The Hollow Bride", "Five keys. One night.");
  sound(player, "ag.title", 0.55, 0.9);
  // One-way barrier: the way back seals until the last act.
  for (const b of PROPS.threshold) setBlockState(b, "ag:threshold_barrier", {});
  runCmd(player, "fog @s push ag:manor_fog ag_room");
}

// ---- Act 1: The Foyer -------------------------------------------------------

function tickAct1(player, loopCount) {
  keepOnly(["ag:tutorial_ghost"]);
  if (!pbool(player, "got_candle", false)) {
    pset(player, "got_candle", true);
    pset(player, "candle_fuel", 1200);
    giveItem(player, "ag:tallow_candle", 1);
    giveItem(player, "ag:manor_journal", 1);
    giveItem(player, "ag:salt_pouch", 12);
    giveItem(player, "ag:tallow", 2);
    lightCandle(player);
    titleCard(player, "Tallow Candle", "Light is safe. Dark is watched.");
  }
  if (entitiesOfType("ag:tutorial_ghost").length === 0 && !pbool(player, "ghost_done", false)) {
    spawn("ag:tutorial_ghost", PROPS.ghostSpawn);
  }
  const ghost = firstOf("ag:tutorial_ghost");
  if (ghost && dist(player.location, ghost.location) < 3.0 && !pbool(player, "ghost_done", false)) {
    pset(player, "ghost_done", true);
    runCmd(ghost, "dialogue open @s @p ag_wick_intro");
  }
  if (!isLightSafe(player, undefined)) hint(player, "Relight it. Tap the candle.");
  else hint(player, "North wing: nursery. West door.");
}

// The grandfather clock is the in-world clock: one chime per in-game hour.
export function tickClock(loopCount) {
  const hour = Math.floor(loopCount / 120) % 12;
  const last = gget("clock_hour", -1);
  if (hour === last) return;
  gset("clock_hour", hour);
  const chimes = hour === 0 ? 12 : hour;
  worldSound("ag.clock_chime", PROPS.clock, 0.6, 1.0);
  gset("clock_chimes", chimes);
  for (const p of world.getAllPlayers()) {
    try {
      if (dist(p.location, PROPS.clock) < 30) hint(p, "The clock strikes " + chimes + ".");
    } catch (e) {
      // ignore
    }
  }
}

// ---- Act 2: The Nursery -----------------------------------------------------

function tickAct2(player, loopCount) {
  keepOnly(["ag:nanny"]);
  if (hasKey(player, 1)) {
    despawnAll("ag:nanny");
    hint(player, "Key I is yours. Down to the cellar.");
    return;
  }
  let nanny = firstOf("ag:nanny");
  if (!nanny) {
    nanny = spawn("ag:nanny", PROPS.nannySpawn);
    if (nanny) tell(player, "Floorboards, two rooms over.");
    return;
  }
  if (pbool(player, "hiding", false)) {
    try {
      nanny.triggerEvent("ag:set_calm");
    } catch (e) {
      // ignore
    }
    hint(player, "She is listening. Stay still.");
    return;
  }
  const noise = pnum(player, "noise", 0);
  const wanted = noise >= NOISE.frenzyAt ? "ag:set_frenzy" : noise >= NOISE.alertAt ? "ag:set_alert" : "ag:set_calm";
  const prev = pstr(player, "nanny_state", "");
  if (wanted !== prev) {
    pset(player, "nanny_state", wanted);
    try {
      nanny.triggerEvent(wanted);
    } catch (e) {
      // ignore
    }
    if (wanted === "ag:set_frenzy") tell(player, "She heard that.");
  }
  const d = dist(player.location, nanny.location);
  if (d < 1.8) {
    damageScaled(player, 3);
    markScare(player);
  } else if (d < 6 && loopCount % 6 === 0) {
    sound(player, "ag.floor_creak", 0.6, 0.7);
  }
  if (!pbool(player, "puzzle_nursery", false)) hint(player, "Five toys. One tune. Walk, do not run.");
  else hint(player, "The pedestal is awake. Take Key I.");
}

function checkToyPuzzle(player) {
  const notes = [];
  for (const p of PROPS.toyBlocks) {
    const b = getBlockAt(p);
    if (!b || b.typeId !== "ag:toy_block") return false;
    notes.push(getState(b, "ag:note"));
  }
  for (let i = 0; i < MELODY.length; i++) {
    if (notes[i] !== MELODY[i]) return false;
  }
  pset(player, "puzzle_nursery", true);
  gset("puzzle_nursery", true);
  worldSound("ag.clock_chime", PROPS.toyBlocks[2], 1.4, 0.9);
  titleCard(player, "The tune completes", "Something unlocks upstairs of you");
  return true;
}

// ---- Act 3: The Cellar of Names ---------------------------------------------

function tickAct3(player, loopCount) {
  keepOnly(["ag:drowned_wraith"]);
  if (hasKey(player, 2)) {
    despawnAll("ag:drowned_wraith");
    hint(player, "Key II. The mirrors are east.");
    return;
  }
  const wraiths = entitiesOfType("ag:drowned_wraith");
  if (wraiths.length > 3) {
    for (let i = 3; i < wraiths.length; i++) {
      try {
        wraiths[i].triggerEvent("ag:despawn");
      } catch (e) {
        // ignore
      }
    }
  }
  for (const w of wraiths) {
    try {
      if (dist(player.location, w.location) < 1.8) {
        damageScaled(player, 2);
        markScare(player);
      }
    } catch (e) {
      // ignore
    }
  }
  if (loopCount % 8 === 0) sound(player, "ag.step_wet", 0.9, 0.4);
  hint(player, "Six names. Ring the bell on one.");
}

function raiseWraiths(player) {
  tell(player, "The water remembers wrong.");
  system.runTimeout(() => {
    try {
      const existing = entitiesOfType("ag:drowned_wraith").length;
      const toSpawn = clamp(3 - existing, 0, 3);
      for (let i = 0; i < toSpawn; i++) {
        // Never behind the player inside three blocks.
        const angle = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * 3;
        spawn("ag:drowned_wraith", {
          x: player.location.x + Math.cos(angle) * r,
          y: player.location.y,
          z: player.location.z + Math.sin(angle) * r
        });
      }
      sound(player, "ag.wraith", 0.8, 0.9);
      markScare(player);
    } catch (e) {
      log("wraith spawn failed");
    }
  }, TELL_TICKS);
}

// ---- Act 4: The Mirror Wing -------------------------------------------------

const REAL_MIRROR = 2;

function tickAct4(player, loopCount) {
  keepOnly(["ag:reflection"]);
  if (hasKey(player, 3)) {
    despawnAll("ag:reflection");
    hint(player, "Key III. The stairs go up.");
    return;
  }
  let refl = firstOf("ag:reflection");
  if (!refl) {
    refl = spawn("ag:reflection", { x: MIRROR_WING_CENTRE_X, y: 65, z: 1037 });
    if (!refl) return;
  }
  const huntUntil = pnum(player, "refl_hunt_until", 0);
  const now = system.currentTick;
  if (huntUntil > now) {
    // Twenty seconds of pursuit, then it goes back into the glass.
    try {
      const dir = norm(sub(player.location, refl.location));
      refl.teleport({
        x: refl.location.x + dir.x * 0.9,
        y: player.location.y,
        z: refl.location.z + dir.z * 0.9
      });
      if (dist(player.location, refl.location) < 1.6) {
        damageScaled(player, 3);
        markScare(player);
      }
      if (loopCount % 4 === 0) sound(player, "ag.watcher_move", 0.7, 0.6);
    } catch (e) {
      // ignore
    }
    hint(player, "Twenty seconds. Break line of sight.");
    return;
  }
  if (huntUntil !== 0 && huntUntil <= now) {
    pset(player, "refl_hunt_until", 0);
    try {
      refl.triggerEvent("ag:stop_hunt");
    } catch (e) {
      // ignore
    }
  }
  // Mirrored movement: inverted across the wing's centre line.
  try {
    const cx = MIRROR_WING_CENTRE_X;
    refl.teleport(
      { x: 2 * cx - player.location.x, y: player.location.y, z: player.location.z + 2 },
      { facingLocation: player.location }
    );
  } catch (e) {
    // ignore
  }
  hint(player, "One glass is not a mirror. Tap it.");
}

function tapMirror(player, block, index) {
  if (hasKey(player, 3)) return;
  if (index === REAL_MIRROR) {
    worldSound("ag.mirror_break", block.location, 1.2, 1.0);
    setBlockState(PROPS.mirrors[index], "ag:mirror", { "ag:broken": true });
    gset("puzzle_mirror", true);
    pset(player, "puzzle_mirror", true);
    titleCard(player, "It did not follow", "Take Key III");
    despawnAll("ag:reflection");
    return;
  }
  setBlockState(PROPS.mirrors[index], "ag:mirror", { "ag:broken": true });
  worldSound("ag.mirror_break", block.location, 0.8, 1.0);
  tell(player, "It leans out of the frame.");
  const refl = firstOf("ag:reflection");
  system.runTimeout(() => {
    try {
      if (refl) refl.triggerEvent("ag:start_hunt");
      pset(player, "refl_hunt_until", system.currentTick + 400);
      sound(player, "ag.scare", 1.0, 0.8);
      markScare(player);
    } catch (e) {
      // ignore
    }
  }, TELL_TICKS);
}

// ---- Act 5: The Portrait Gallery --------------------------------------------

function tickAct5(player, loopCount) {
  keepOnly(["ag:watcher"]);
  if (hasKey(player, 4)) {
    despawnAll("ag:watcher");
    hint(player, "Key IV. The attic hatch is open.");
    return;
  }
  let w = firstOf("ag:watcher");
  if (!w) {
    w = spawn("ag:watcher", PROPS.watcherSpawn);
    if (w) tell(player, "A frame is empty that was not.");
    return;
  }
  const watched = isObserved(player, w.location);
  if (!watched) {
    try {
      const dir = norm(sub(player.location, w.location));
      const step = 0.85;
      w.teleport({
        x: w.location.x + dir.x * step,
        y: w.location.y,
        z: w.location.z + dir.z * step
      });
      if (loopCount % 3 === 0) sound(player, "ag.watcher_move", 0.6, 0.5);
    } catch (e) {
      // ignore
    }
  }
  try {
    if (dist(player.location, w.location) < 1.6) {
      damageScaled(player, 3);
      w.teleport(PROPS.watcherSpawn);
      markScare(player);
    }
  } catch (e) {
    // ignore
  }
  // Portraits go wrong-er the moment nobody is looking.
  if (loopCount % 3 === 0) {
    for (let i = 0; i < PROPS.portraits.length; i++) {
      const at = PROPS.portraits[i];
      if (isObserved(player, at)) continue;
      if (Math.random() > 0.12) continue;
      const b = getBlockAt(at);
      if (!b || b.typeId !== "ag:portrait") continue;
      const wrong = getState(b, "ag:wrong") === true;
      setBlockState(at, "ag:portrait", { "ag:index": i, "ag:wrong": !wrong });
    }
  }
  const shots = shotsTaken(player);
  hint(player, "Photograph them in order of death. " + shots.length + "/5");
}

function photographPortrait(player, index) {
  const shots = addShot(player, index);
  sound(player, "ag.camera", 1.5, 0.9);
  const step = shots.length - 1;
  if (PORTRAIT_ORDER[step] !== index) {
    clearShots(player);
    hint(player, "The plate fogs. Start again.");
    sound(player, "ag.candle_out", 0.8, 0.6);
    return;
  }
  if (shots.length === PORTRAIT_ORDER.length) {
    gset("puzzle_gallery", true);
    pset(player, "puzzle_gallery", true);
    titleCard(player, "Five plates, five deaths", "Take Key IV");
    worldSound("ag.key_get", player.location, 0.9, 0.8);
    return;
  }
  hint(player, "Held. " + shots.length + " of 5.");
}

// ---- Act 6: The Attic Heart -------------------------------------------------

function litWallCandles() {
  let n = 0;
  for (const c of PROPS.wallCandles) {
    const b = getBlockAt(c);
    if (b && b.typeId === "ag:wall_candle" && getState(b, "ag:lit") === true) n++;
  }
  return n;
}

function tickAct6(player, loopCount) {
  const phase = pnum(player, "boss_phase", 0);
  if (hasKey(player, 5)) {
    keepOnly([]);
    hint(player, "Dawn. Get out or stay.");
    return;
  }
  let bride = firstOf("ag:hollow_bride");
  if (!bride) {
    keepOnly(["ag:hollow_bride"]);
    bride = spawn("ag:hollow_bride", PROPS.brideSpawn);
    if (bride) {
      pset(player, "boss_phase", 1);
      tell(player, "The veil moves before she does.");
      system.runTimeout(() => {
        titleCard(player, "Phase I - Veil", "Light the four wall candles");
        worldSound("ag.bride_tell", PROPS.brideSpawn, 0.7, 1.0);
      }, TELL_TICKS);
    }
    return;
  }

  if (phase === 1) {
    keepOnly(["ag:hollow_bride"]);
    const lit = litWallCandles();
    hint(player, "Candles lit: " + lit + " / 4");
    if (dist(player.location, bride.location) < 1.8) {
      damageScaled(player, 3);
      markScare(player);
    }
    if (lit >= 4) startChorus(player, bride);
    return;
  }

  if (phase === 2) {
    // Bride is frozen during Chorus, so the AI budget stays at three children.
    const kids = entitiesOfType("ag:hollow_child");
    if (kids.length > 3) {
      for (let i = 3; i < kids.length; i++) {
        try {
          kids[i].triggerEvent("ag:despawn");
        } catch (e) {
          // ignore
        }
      }
    }
    for (const k of kids) {
      try {
        if (saltBlocks(k.location, 1.6)) {
          const away = norm(sub(k.location, player.location));
          k.teleport({
            x: k.location.x + away.x * 2,
            y: k.location.y,
            z: k.location.z + away.z * 2
          });
          particle("ag:salt_glow", k.location);
          continue;
        }
        if (dist(player.location, k.location) < 1.5) {
          damageScaled(player, 2);
          markScare(player);
        }
      } catch (e) {
        // ignore
      }
    }
    const killed = pnum(player, "children_killed", 0);
    if (killed >= 3 && kids.length === 0) {
      startHollowing(player, bride);
      return;
    }
    if (kids.length < 3 && loopCount % 16 === 0 && killed < 3) {
      summonChild(player);
    }
    hint(player, "Children down: " + killed + " / 3");
    return;
  }

  if (phase === 3) {
    const nearCandle = litWallCandleNear(bride.location, 6);
    const nextTp = pnum(player, "bride_next_tp", 0);
    const now = system.currentTick;
    if (now >= nextTp) {
      pset(player, "bride_next_tp", now + 100);
      tell(player, "Behind you, in five.");
      system.runTimeout(() => {
        try {
          const b = firstOf("ag:hollow_bride");
          if (!b) return;
          const view = player.getViewDirection();
          // Five blocks behind, never inside the three block no-spawn shell.
          b.teleport({
            x: player.location.x - view.x * 5,
            y: player.location.y,
            z: player.location.z - view.z * 5
          });
          worldSound("ag.bride_tell", b.location, 0.6, 1.0);
        } catch (e) {
          // ignore
        }
      }, TELL_TICKS);
    }
    if (dist(player.location, bride.location) < 1.8) {
      damageScaled(player, 4);
      markScare(player);
    }
    hint(player, nearCandle ? "She burns. Hit her now." : "Light a candle beside her.");
    return;
  }
}

function saltBlocks(loc, radius) {
  const r = Math.ceil(radius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const b = getBlockAt({
        x: Math.floor(loc.x) + dx,
        y: Math.floor(loc.y) - 1,
        z: Math.floor(loc.z) + dz
      });
      if (b && b.typeId === "ag:salt_line") return true;
    }
  }
  return false;
}

function startChorus(player, bride) {
  pset(player, "boss_phase", 2);
  pset(player, "children_killed", 0);
  tell(player, "She opens her mouth and it is a choir.");
  system.runTimeout(() => {
    try {
      bride.triggerEvent("ag:to_chorus");
      titleCard(player, "Phase II - Chorus", "Salt holds them. Three of them.");
      worldSound("ag.child_giggle", bride.location, 1.9, 0.8);
    } catch (e) {
      // ignore
    }
  }, TELL_TICKS);
}

function summonChild(player) {
  try {
    const angle = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 2;
    const at = {
      x: player.location.x + Math.cos(angle) * r,
      y: player.location.y,
      z: player.location.z + Math.sin(angle) * r
    };
    spawn("ag:hollow_child", at);
    worldSound("ag.child_giggle", at, 1.8, 0.6);
  } catch (e) {
    // ignore
  }
}

function startHollowing(player, bride) {
  pset(player, "boss_phase", 3);
  pset(player, "bride_next_tp", system.currentTick + 100);
  tell(player, "Every wick in the attic leans away.");
  system.runTimeout(() => {
    try {
      bride.triggerEvent("ag:to_hollowing");
      for (const c of PROPS.wallCandles) setBlockState(c, "ag:wall_candle", { "ag:lit": false });
      titleCard(player, "Phase III - Hollowing", "She only burns beside a flame");
      worldSound("ag.bride_tell", bride.location, 0.5, 1.0);
    } catch (e) {
      // ignore
    }
  }, TELL_TICKS);
}

export function onBrideDown(player) {
  pset(player, "boss_phase", 4);
  despawnAll("ag:hollow_bride");
  despawnAll("ag:hollow_child");
  gset("puzzle_attic", true);
  pset(player, "puzzle_attic", true);
  titleCard(player, "The veil falls empty", "Take Key V");
  worldSound("ag.key_get", player.location, 0.8, 1.0);
}

// ---- Act 7: Dawn ------------------------------------------------------------

export function startDawn(player, buildRuin) {
  if (pbool(player, "dawn_started", false)) return;
  pset(player, "dawn_started", true);
  pset(player, "act", 7);
  pset(player, "dawn_deadline", system.currentTick + 1800);
  // The one-way barrier lifts: no softlocks, the front door reopens.
  for (const b of PROPS.threshold) setBlockState(b, "minecraft:air", {});
  titleCard(player, "Dawn", "Ninety seconds. You know the way.");
  worldSound("ag.collapse", player.location, 0.55, 1.0);
  buildRuin(() => {
    log("ruin variant loaded");
  });
}

function tickAct7(player, loopCount) {
  keepOnly([]);
  const left = Math.max(0, Math.floor((pnum(player, "dawn_deadline", 0) - system.currentTick) / 20));
  hint(player, "Get out: " + left + "s");
  if (loopCount % 4 === 0) worldSound("ag.collapse", player.location, 0.5, 0.5);
  if (left <= 0) {
    pset(player, "dawn_deadline", system.currentTick + 1800);
    sendToCheckpoint(player, "The house held on. Go again.");
    return;
  }
  if (distFlat(player.location, PROPS.escapeExit) < 2.0 && player.location.z <= PROPS.escapeExit.z) {
    finishRun(player, "escape");
  }
}

function finishRun(player, which) {
  if (pstr(player, "ending", "") !== "") return;
  pset(player, "ending", which);
  worldSound("ag.title", player.location, 0.55, 1.0);
  system.run(() => {
    showEnding(player, which).catch(() => {});
  });
}

// ---- Dispatch ---------------------------------------------------------------

export function tickAct(player, room, loopCount) {
  const act = pnum(player, "act", 0);
  if (pstr(player, "ending", "") !== "") return;
  if (act >= 7) return tickAct7(player, loopCount);
  if (!room) return;
  switch (room.id) {
    case "approach":
      return tickAct0(player);
    case "foyer":
      return tickAct1(player, loopCount);
    case "nursery":
      return tickAct2(player, loopCount);
    case "cellar":
      return tickAct3(player, loopCount);
    case "mirror_wing":
      return tickAct4(player, loopCount);
    case "gallery":
      return tickAct5(player, loopCount);
    case "attic":
      return tickAct6(player, loopCount);
    default:
      return;
  }
}

// ---- Interactions -----------------------------------------------------------

function indexOfProp(list, loc) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.x === loc.x && p.y === loc.y && p.z === loc.z) return i;
  }
  return -1;
}

export function onBlockTap(player, block, heldTypeId) {
  const id = block.typeId;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };

  if (id === "ag:mailbox") {
    pset(player, "read_will", true);
    setBlockState(loc, "ag:mailbox", { "ag:opened": true });
    sound(player, "ag.page", 1.0, 0.8);
    system.run(() => {
      showWill(player).catch(() => {});
    });
    return true;
  }

  if (id === "ag:grandfather_clock") {
    const chimes = gget("clock_chimes", 12);
    hint(player, "It reads " + chimes + " o'clock.");
    sound(player, "ag.clock_tick", 0.7, 0.6);
    return true;
  }

  if (id === "ag:wardrobe" || id === "ag:under_bed") {
    if (pbool(player, "hiding", false)) {
      return "exit_hide";
    }
    return { hide: loc };
  }

  if (id === "ag:toy_block") {
    const cur = getState(block, "ag:note");
    const next = (typeof cur === "number" ? cur + 1 : 0) % 5;
    setBlockState(loc, "ag:toy_block", { "ag:note": next });
    sound(player, "ag.clock_tick", 0.8 + next * 0.15, 0.8);
    checkToyPuzzle(player);
    return true;
  }

  if (id === "ag:name_plaque") {
    const idx = indexOfProp(PROPS.plaques, loc);
    if (heldTypeId !== "ag:seance_bell") {
      hint(player, CELLAR_NAMES[idx] || "The letters have swum.");
      return true;
    }
    ringPlaque(player, idx);
    return true;
  }

  if (id === "ag:mirror") {
    const idx = indexOfProp(PROPS.mirrors, loc);
    if (idx >= 0) tapMirror(player, block, idx);
    return true;
  }

  if (id === "ag:portrait") {
    const idx = indexOfProp(PROPS.portraits, loc);
    if (heldTypeId !== "ag:bone_camera") {
      hint(player, "Hold the Bone Camera to shoot.");
      return true;
    }
    if (idx >= 0) photographPortrait(player, idx);
    return true;
  }

  if (id === "ag:wall_candle") {
    const lit = getState(block, "ag:lit") === true;
    if (lit) {
      hint(player, "It is already burning.");
      return true;
    }
    if (!pbool(player, "candle_lit", false)) {
      hint(player, "Your own wick is cold.");
      return true;
    }
    setBlockState(loc, "ag:wall_candle", { "ag:lit": true });
    sound(player, "ag.candle_light", 1.0, 0.9);
    particle("ag:candle_flame", { x: loc.x + 0.5, y: loc.y + 1.0, z: loc.z + 0.5 });
    return true;
  }

  if (id === "ag:key_pedestal") {
    return takeKey(player, block, loc);
  }

  if (id === "ag:story_page") {
    const idx = indexOfProp(PAGES.map((p) => p.at), loc);
    if (idx >= 0) {
      if (addPage(player, PAGES[idx].id)) {
        sound(player, "ag.page", 1.2, 0.8);
        titleCard(player, PAGES[idx].title, "Added to the journal");
      } else {
        hint(player, "You already have this one.");
      }
    }
    return true;
  }

  return false;
}

function takeKey(player, block, loc) {
  const keyId = getState(block, "ag:key_id");
  if (typeof keyId !== "number") return true;
  if (hasKey(player, keyId)) {
    hint(player, "Key " + keyId + " is already yours.");
    return true;
  }
  const gates = {
    1: "puzzle_nursery",
    2: "puzzle_cellar",
    3: "puzzle_mirror",
    4: "puzzle_gallery",
    5: "puzzle_attic"
  };
  if (!pbool(player, gates[keyId], false)) {
    hint(player, "The room is not finished with you.");
    sound(player, "ag.candle_out", 0.8, 0.5);
    return true;
  }
  giveKeyFlag(player, keyId);
  giveItem(player, "ag:bone_key", 1);
  setBlockState(loc, "ag:key_pedestal", { "ag:key_id": keyId, "ag:taken": true });
  sound(player, "ag.key_get", 0.9, 1.0);
  titleCard(player, "Bone Key " + keyId, keyCount(player) + " of 5");
  if (keyCount(player) >= 5) pset(player, "act", 7);
  return true;
}

function ringPlaque(player, idx) {
  sound(player, "ag.bell", 1.2, 0.9);
  if (idx === CELLAR_ANSWER) {
    gset("puzzle_cellar", true);
    pset(player, "puzzle_cellar", true);
    despawnAll("ag:drowned_wraith");
    titleCard(player, "The name holds", "Take Key II");
    return;
  }
  raiseWraiths(player);
}

export function onItemUse(player, itemStack) {
  const id = itemStack ? itemStack.typeId : "";

  if (id === "ag:tallow_candle") {
    if (pbool(player, "candle_lit", false)) {
      if (hasItem(player, "ag:tallow") && pnum(player, "candle_fuel", 0) < 900) {
        consumeItem(player, "ag:tallow");
        refuelCandle(player, 600);
        hint(player, "Fed. The flame steadies.");
        sound(player, "ag.candle_light", 0.9, 0.7);
      } else {
        hint(player, "Burning. Tap tallow to feed it.");
      }
    } else if (hasItem(player, "ag:tallow") && pnum(player, "candle_fuel", 0) <= 0) {
      consumeItem(player, "ag:tallow");
      refuelCandle(player, 600);
      lightCandle(player);
    } else {
      lightCandle(player);
    }
    return true;
  }

  if (id === "ag:manor_journal") {
    system.run(() => {
      showJournal(player).catch(() => {});
    });
    return true;
  }

  if (id === "ag:cracked_monocle") {
    revealWithMonocle(player);
    return true;
  }

  if (id === "ag:bone_camera") {
    photographRoom(player);
    return true;
  }

  if (id === "ag:seance_bell") {
    useBell(player);
    return true;
  }

  return false;
}

function revealWithMonocle(player) {
  sound(player, "ag.bell", 1.6, 0.4);
  const room = pstr(player, "room", "approach");
  const notes = {
    approach: "Ghost-writing on the gate: SHE SIGNED FIRST",
    foyer: "Above the clock: THE HOUR IS NOT THE POINT",
    nursery: "Under the cot: SHE HEARS FEET, NOT FACES",
    cellar: "On the water: THE FOURTH PLAQUE IS WARM",
    mirror_wing: "On the third frame: NO BREATH ON THIS ONE",
    gallery: "Behind the frames: SHORTEST FIRST",
    attic: "On the veil: A FLAME BESIDE HER, NOT IN HER"
  };
  hint(player, notes[room] || "Nothing written here.");
  const list = entitiesOfType("ag:hallucination");
  for (const h of list) {
    try {
      particle("ag:salt_glow", h.location);
    } catch (e) {
      // ignore
    }
  }
}

function photographRoom(player) {
  sound(player, "ag.camera", 1.5, 0.9);
  const room = pstr(player, "room", "approach");
  const bodies = {
    approach: "Rain. A gate. A mailbox with the flag up.",
    foyer: "A clock. A candle. A man who is not standing on the floor.",
    nursery: "Five toys. A wardrobe with the door ajar. A woman, blurred, mid-stride.",
    cellar: "Water to the knee. Six plaques. One of them is dry.",
    mirror_wing: "Five mirrors. Four of them contain you. One does not.",
    gallery: "Five portraits. In the plate, they are shorter than they were.",
    attic: "A veil. Four candles. Something kneeling that is taller than the room."
  };
  const objective = {
    approach: "Open the mailbox.",
    foyer: "Take the candle. Go west.",
    nursery: "Set the toys to the tune, quietly.",
    cellar: "Ring on the dry plaque.",
    mirror_wing: "Tap the mirror without a reflection.",
    gallery: "Shoot them shortest to tallest.",
    attic: "Light four, break three, burn her once."
  };
  system.run(() => {
    showPhoto(player, bodies[room] || "Grain and dark.", objective[room] || "Keep moving.").catch(
      () => {}
    );
  });
}

function useBell(player) {
  const charges = pnum(player, "bell_charges", 0);
  if (charges <= 0) {
    hint(player, "The clapper is gone.");
    sound(player, "ag.candle_out", 0.9, 0.5);
    return;
  }
  pset(player, "bell_charges", charges - 1);
  sound(player, "ag.bell", 1.0, 1.0);
  const room = pstr(player, "room", "approach");
  if (room === "cellar") {
    system.run(() => {
      showBellRiddle(
        player,
        "Which of us went under and stayed dry?",
        (choice) => {
          if (choice === CELLAR_ANSWER) {
            hint(player, "The house agrees. Ring her plaque.");
            sound(player, "ag.key_get", 1.2, 0.7);
          } else {
            hint(player, "The house lies for free.");
            raiseWraiths(player);
          }
        }
      ).catch(() => {});
    });
    return;
  }
  const riddles = {
    approach: "It asks: who reads a will and does not weep?",
    foyer: "It answers: the hour is a door, not a number.",
    nursery: "It answers: she counts steps, not people.",
    mirror_wing: "It answers: the honest glass is the third one.",
    gallery: "It answers: they fell shortest to tallest.",
    attic: "It answers: her veil is a lid. Lift it with fire."
  };
  system.run(() => {
    showBellHint(player, riddles[room] || "The bell rings flat. Nothing answers.").catch(() => {});
  });
}

export { finishRun, confirmStay };

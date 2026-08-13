/**
 * The mansion: deployment, smart-home behaviour, and the lockdown transition
 * that turns a luxury house into a fortified headquarters.
 *
 * Two performance decisions shape this file:
 *
 *  - Every bulk operation goes through `enqueue`, which drains a few commands
 *    per tick instead of thousands in one frame. Deploying the building and
 *    flipping every light in it are both large jobs; neither is allowed to
 *    stall a phone.
 *  - The alarm and emergency-lighting systems are *stateless while idle*. They
 *    are a handful of `fill ... replace` sweeps at the moment lockdown toggles,
 *    not a ticking light controller. Idle cost is genuinely zero.
 */

import { BlockPermutation, system, world } from "@minecraft/server";
import { ANCHORS, BOUNDS, CLEAR_PARTS, PARTS, SEALS } from "./mansion_data.js";
import { getGlobal, getOrigin, playerState, runCmd, setGlobal, setOrigin } from "./state.js";
import { safeBlock } from "./infection.js";
import { threatLabel } from "./ui.js";

// Bedrock's own per-fill cap is 32768, but a phone cannot absorb that in one
// frame. Match the mansion generator's tighter budget so the lockdown light
// sweep costs about as much per tick as one part of the build does.
const FILL_LIMIT = 8192;
const AUTO_DOOR_RADIUS = 45;
const DOOR_HOLD_TICKS = 60;

// ------------------------------------------------------- command pacing ---

let queue = null;

/** Drains `perTick` commands per tick so bulk work never lands in one frame. */
export function enqueue(dimension, commands, { perTick = 4, label, onDone } = {}) {
  if (queue) {
    queue.commands.push(...commands);
    return false;
  }
  queue = { dimension, commands, index: 0, perTick, label, onDone, lastPercent: -1 };
  system.runTimeout(pump, 1);
  return true;
}

export function isBusy() {
  return queue !== null;
}

function pump() {
  if (!queue) return;
  const job = queue;
  for (let i = 0; i < job.perTick && job.index < job.commands.length; i++) {
    const command = job.commands[job.index++];
    try {
      job.dimension.runCommandAsync(command).catch(() => {});
    } catch {
      /* dimension unavailable */
    }
  }

  if (job.label) {
    const percent = Math.floor((job.index / job.commands.length) * 100);
    if (percent >= job.lastPercent + 20) {
      job.lastPercent = percent;
      world.sendMessage(`§b[${job.label}] §7${percent}%`);
    }
  }

  if (job.index >= job.commands.length) {
    queue = null;
    job.onDone?.();
  } else {
    system.runTimeout(pump, 1);
  }
}

// ----------------------------------------------------------- deployment ---

export function anchorWorld(name) {
  const origin = getOrigin();
  const offset = ANCHORS[name];
  if (!origin || !offset) return undefined;
  return {
    x: origin.x + offset[0],
    y: origin.y + offset[1],
    z: origin.z + offset[2],
  };
}

export function buildMansion(player, { instant = false } = {}) {
  if (PARTS.length === 0) {
    player.sendMessage("§cMansion data is missing from this pack build.");
    return;
  }
  if (isBusy()) {
    player.sendMessage("§eAnother large operation is already running. Try again in a moment.");
    return;
  }

  const location = player.location;
  const origin = {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
  setOrigin(origin.x, origin.y, origin.z);
  setGlobal("built", 1);
  setGlobal("lockdown", 0);

  const commands = PARTS.map(
    (part) => `execute positioned ${origin.x} ${origin.y} ${origin.z} run function ${part}`
  );

  world.sendMessage("§b§l[TECH MANSION] §r§7Deploying structure — hold still.");
  // Each part is budgeted to ~12k blocks, so perTick is a direct multiplier on
  // per-frame cost. Keep "fast" modest: this build crashes phones if rushed.
  enqueue(player.dimension, commands, {
    perTick: instant ? 3 : 1,
    label: "TECH MANSION",
    onDone: () => {
      world.sendMessage("§a§l[TECH MANSION] §r§aDeployment complete. Systems online.");
      runCmd("playsound myc.build @a");
    },
  });
}

export function clearMansion(player) {
  const origin = getOrigin();
  if (!origin) {
    player.sendMessage("§cNo mansion has been deployed yet.");
    return;
  }
  if (isBusy()) {
    player.sendMessage("§eAnother large operation is already running. Try again in a moment.");
    return;
  }
  // Clearing the envelope is ~426k blocks. Paced exactly like the build.
  const commands = CLEAR_PARTS.map(
    (part) => `execute positioned ${origin.x} ${origin.y} ${origin.z} run function ${part}`
  );
  enqueue(player.dimension, commands, {
    perTick: 1,
    label: "TECH MANSION",
    onDone: () => world.sendMessage("§7[TECH MANSION] Structure removed."),
  });
  setGlobal("built", 0);
  setGlobal("lockdown", 0);
}

// -------------------------------------------------------------- lockdown --

/** Splits an axis-aligned box into sub-boxes under Bedrock's fill limit. */
function splitBox(from, to) {
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;
  const width = Math.abs(x2 - x1) + 1;
  const depth = Math.abs(z2 - z1) + 1;
  const layer = width * depth;
  const maxHeight = Math.max(1, Math.floor(FILL_LIMIT / Math.max(1, layer)));

  const boxes = [];
  const lowY = Math.min(y1, y2);
  const highY = Math.max(y1, y2);
  for (let y = lowY; y <= highY; y += maxHeight) {
    boxes.push([
      [Math.min(x1, x2), y, Math.min(z1, z2)],
      [Math.max(x1, x2), Math.min(y + maxHeight - 1, highY), Math.max(z1, z2)],
    ]);
  }
  return boxes;
}

function boundsCommands(replacements) {
  const origin = getOrigin();
  if (!origin) return [];
  const from = [
    origin.x + BOUNDS.from[0],
    origin.y + BOUNDS.from[1],
    origin.z + BOUNDS.from[2],
  ];
  const to = [
    origin.x + BOUNDS.to[0],
    origin.y + BOUNDS.to[1],
    origin.z + BOUNDS.to[2],
  ];
  const commands = [];
  for (const [target, source] of replacements) {
    for (const [a, b] of splitBox(from, to)) {
      commands.push(
        `fill ${a[0]} ${a[1]} ${a[2]} ${b[0]} ${b[1]} ${b[2]} ${target} replace ${source}`
      );
    }
  }
  return commands;
}

function sealCommands(block) {
  const origin = getOrigin();
  if (!origin) return [];
  const commands = [];
  for (const seal of SEALS) {
    const a = [
      origin.x + seal.from[0],
      origin.y + seal.from[1],
      origin.z + seal.from[2],
    ];
    const b = [origin.x + seal.to[0], origin.y + seal.to[1], origin.z + seal.to[2]];
    for (const [p, q] of splitBox(a, b)) {
      commands.push(`fill ${p[0]} ${p[1]} ${p[2]} ${q[0]} ${q[1]} ${q[2]} ${block}`);
    }
  }
  return commands;
}

export function lockdown(player) {
  const origin = getOrigin();
  if (!origin) {
    player?.sendMessage("§cDeploy the mansion first with §e/function tech_house§c.");
    return;
  }
  if (getGlobal("lockdown") === 1) {
    player?.sendMessage("§eThe mansion is already sealed.");
    return;
  }
  setGlobal("lockdown", 1);

  const commands = [
    ...sealCommands("myc:clean_panel"),
    ...boundsCommands([
      ["myc:alarm_light_on", "myc:alarm_light"],
      ["myc:emergency_light", "minecraft:redstone_lamp"],
    ]),
  ];

  world.sendMessage("§c§l[SECURITY] §r§cLOCKDOWN ENGAGED. Sealing the envelope.");
  runCmd("playsound myc.lockdown @a");
  runCmd("playsound myc.alarm @a");
  enqueue(player?.dimension ?? world.getDimension("overworld"), commands, { perTick: 2 });

  quarantineInfected();
}

export function unlock(player) {
  const origin = getOrigin();
  if (!origin) {
    player?.sendMessage("§cDeploy the mansion first with §e/function tech_house§c.");
    return;
  }
  if (getGlobal("lockdown") === 0) {
    player?.sendMessage("§eThe mansion is already open.");
    return;
  }
  setGlobal("lockdown", 0);

  const commands = [
    ...sealCommands("minecraft:air"),
    ...boundsCommands([
      ["myc:alarm_light", "myc:alarm_light_on"],
      ["minecraft:redstone_lamp", "myc:emergency_light"],
    ]),
  ];

  world.sendMessage("§a§l[SECURITY] §r§aLockdown released. The mansion is open.");
  runCmd("playsound myc.lockdown @a");
  enqueue(player?.dimension ?? world.getDimension("overworld"), commands, { perTick: 2 });
}

/** Anyone critical gets moved into the sealed quarantine cell. */
function quarantineInfected() {
  const cell = anchorWorld("quarantine");
  if (!cell) return;
  for (const player of world.getAllPlayers()) {
    const record = playerState(player);
    if (record.infection < 75) continue;
    try {
      player.teleport({ x: cell.x + 0.5, y: cell.y, z: cell.z + 0.5 }, {
        dimension: player.dimension,
      });
      player.sendMessage(
        "§c§l[QUARANTINE] §r§7Critical infection detected. You have been isolated in the medical cell."
      );
    } catch {
      /* teleport blocked */
    }
  }
}

// ---------------------------------------------------------- smart doors ---

const openDoors = new Map();

function setDoorOpen(block, open) {
  try {
    const states = block.permutation.getAllStates();
    if (states.open_bit === open) return false;
    states.open_bit = open;
    block.setPermutation(BlockPermutation.resolve(block.typeId, states));
    return true;
  } catch {
    return false;
  }
}

function doorKey(dimensionId, x, y, z) {
  return `${dimensionId}:${x},${y},${z}`;
}

function autoDoors(player) {
  const origin = getOrigin();
  if (!origin) return;
  const location = player.location;
  if (
    Math.abs(location.x - origin.x) > AUTO_DOOR_RADIUS ||
    Math.abs(location.z - origin.z) > AUTO_DOOR_RADIUS ||
    Math.abs(location.y - origin.y) > 40
  ) {
    return;
  }

  const dimension = player.dimension;
  const bx = Math.floor(location.x);
  const by = Math.floor(location.y);
  const bz = Math.floor(location.z);

  for (const [dx, dz] of [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]) {
    const x = bx + dx;
    const z = bz + dz;
    const block = safeBlock(dimension, { x, y: by, z });
    if (!block || !block.typeId.endsWith("_door")) continue;
    if (setDoorOpen(block, true)) {
      // Bedrock stores open_bit on both halves; keep them in sync.
      const upper = safeBlock(dimension, { x, y: by + 1, z });
      if (upper?.typeId === block.typeId) setDoorOpen(upper, true);
      try {
        player.playSound("myc.scanner.ping", { volume: 0.2, pitch: 1.8 });
      } catch {}
    }
    openDoors.set(doorKey(dimension.id, x, by, z), {
      dimension,
      x,
      y: by,
      z,
      tick: system.currentTick,
    });
  }
}

function closeIdleDoors(players) {
  if (openDoors.size === 0) return;
  const now = system.currentTick;
  for (const [key, door] of openDoors) {
    if (now - door.tick < DOOR_HOLD_TICKS) continue;

    const occupied = players.some(
      (player) =>
        player.dimension.id === door.dimension.id &&
        Math.abs(player.location.x - door.x) < 3 &&
        Math.abs(player.location.y - door.y) < 3 &&
        Math.abs(player.location.z - door.z) < 3
    );
    if (occupied) {
      door.tick = now;
      continue;
    }

    const block = safeBlock(door.dimension, { x: door.x, y: door.y, z: door.z });
    if (block?.typeId.endsWith("_door")) {
      setDoorOpen(block, false);
      const upper = safeBlock(door.dimension, { x: door.x, y: door.y + 1, z: door.z });
      if (upper?.typeId === block.typeId) setDoorOpen(upper, false);
    }
    openDoors.delete(key);
  }
}

// --------------------------------------------------------- room systems ---

function near(location, anchor, radius) {
  if (!anchor) return false;
  return (
    Math.abs(location.x - anchor.x) <= radius &&
    Math.abs(location.y - anchor.y) <= radius &&
    Math.abs(location.z - anchor.z) <= radius
  );
}

/**
 * Room-specific behaviour, evaluated once per second per player. Each check is
 * three float comparisons against a cached anchor — no block or entity reads.
 */
export function tickRooms(players, second) {
  const origin = getOrigin();
  if (!origin) return;

  const control = anchorWorld("control_panel");
  const security = anchorWorld("security_room");
  const lab = anchorWorld("laboratory");
  const bunker = anchorWorld("bunker");
  const quarantine = anchorWorld("quarantine");

  const outbreak = getGlobal("outbreak") === 1;
  const level = getGlobal("level");
  const day = getGlobal("day");

  for (const player of players) {
    const location = player.location;
    const record = playerState(player);

    // The bunker is sealed air: nothing gets in while you are inside it.
    if (near(location, bunker, 14)) {
      record.sealedUntil = system.currentTick + 40;
    }

    // The quarantine cell actively treats whoever is inside it.
    if (near(location, quarantine, 5) && record.infection > 0) {
      record.infection = Math.max(0, record.infection - 0.6);
      if (second % 5 === 0) {
        player.onScreenDisplay.setActionBar(
          `§b[QUARANTINE] §7Decontaminating — §f${Math.round(record.infection)}%`
        );
      }
    }

    // Control room and security desk read out the outbreak state.
    if (near(location, control, 6) || near(location, security, 6)) {
      if (second % 2 === 0) {
        player.onScreenDisplay.setActionBar(
          outbreak
            ? `§c[CONTROL] §7Threat ${threatLabel(level)} §8| §7Day §f${day} §8| §7Lockdown ${
                getGlobal("lockdown") ? "§cON" : "§aOFF"
              }`
            : "§a[CONTROL] §7All systems nominal. No outbreak detected."
        );
      }
    }

    // The laboratory runs a free continuous assay on whoever stands in it.
    if (near(location, lab, 6) && second % 10 === 0) {
      player.sendMessage(
        `§d[LAB] §7Assay complete — infection §f${Math.round(record.infection)}%§7, ` +
          `stage §f${["healthy", "exposed", "infected", "critical"][record.stage] ?? "?"}§7.`
      );
    }
  }
}

export function tickDoors(players) {
  const origin = getOrigin();
  if (!origin) return;
  for (const player of players) {
    try {
      autoDoors(player);
    } catch {
      /* player left */
    }
  }
  closeIdleDoors(players);
}

/**
 * Automatic defence: if the outbreak reaches level 3+ and infected are pressing
 * close to the mansion while a player is home, seal up without being asked.
 */
export function considerAutoLockdown(players, infectedNearMansion) {
  if (getGlobal("built") !== 1) return;
  if (getGlobal("lockdown") === 1) return;
  if (getGlobal("outbreak") !== 1) return;
  if (getGlobal("level") < 3) return;
  if (infectedNearMansion < 6) return;

  const origin = getOrigin();
  const home = players.find(
    (player) =>
      Math.abs(player.location.x - origin.x) < 40 &&
      Math.abs(player.location.z - origin.z) < 40
  );
  if (!home) return;

  world.sendMessage(
    "§c§l[SECURITY] §r§cPerimeter breach detected — automatic lockdown engaging."
  );
  lockdown(home);
}

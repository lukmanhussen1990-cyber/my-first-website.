// Red Light, Green Light - a Squid Game minigame for Minecraft Bedrock 1.21
// Uses only the stable Script API (@minecraft/server 1.10.0) and no commands,
// so it works in survival without cheats.

import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

// =====================================================================
// SETTINGS - change these to fit your world.
// Turn on "Show Coordinates" in your world settings to see x, y, z.
// All positions are block positions (the numbers shown on screen).
// =====================================================================
const CONFIG = {
  // Where players line up. Players within joinDistance blocks of it join the game.
  startPos: { x: 0, y: -60, z: 0 },
  joinDistance: 30,

  // Where the doll (an armor stand) stands. It always turns toward the start.
  dollPos: { x: 0, y: -60, z: 50 },

  // The finish area is the box between these two corners (both corners count).
  finishArea: {
    corner1: { x: -15, y: -61, z: 44 },
    corner2: { x: 15, y: -55, z: 48 },
  },

  // Where players are sent when they are out.
  outPos: { x: -25, y: -60, z: 0 },

  // How long each light lasts, in seconds (a random time between min and max).
  greenLightSeconds: { min: 4, max: 8 },
  redLightSeconds: { min: 2, max: 5 },

  // After RED LIGHT is called, players get this many seconds to stop before moving counts.
  // (Players slide a little after letting go, and a jump takes about 0.6 seconds.)
  reactionSeconds: 0.75,

  // Moving less than this many blocks during red light does not count.
  moveTolerance: 0.1,

  // true  = give the whistle on every spawn (also after dying), if the player does not have one.
  // false = only give it on the first spawn after joining the world.
  giveWhistleOnEverySpawn: true,
};
// =====================================================================

const WHISTLE_ID = "squidgame:game_whistle";
const DOLL_TAG = "squidgame_doll"; // marks our doll so we can find it again
const LOOP_TICKS = 4; // check players every 4 ticks (5 times a second) to stay light on phones

let game = null; // the running game, or null when no game is running
const lastWhistleUse = new Map(); // player id -> tick of their last whistle use

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

// The middle of a block, so nobody stands on a block edge.
function middleOf(pos) {
  return { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// The turn angle (yaw) needed to look from one position toward another.
function yawToward(from, to) {
  return (-Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI;
}

// The opposite direction of a yaw angle.
function turnAround(yaw) {
  return yaw > 0 ? yaw - 180 : yaw + 180;
}

// A random time between min and max seconds, in ticks (20 ticks = 1 second).
function randomTicks(range) {
  return Math.round((range.min + Math.random() * (range.max - range.min)) * 20);
}

function isInFinishArea(location) {
  const a = CONFIG.finishArea.corner1;
  const b = CONFIG.finishArea.corner2;
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  return (
    x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) &&
    y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y) &&
    z >= Math.min(a.z, b.z) && z <= Math.max(a.z, b.z)
  );
}

// Everyone who joined this game and is still in the world (out players too).
function gamePlayers() {
  return game.allPlayers.filter((player) => player.isValid());
}

function getDolls(dimension) {
  return dimension.getEntities({ type: "minecraft:armor_stand", tags: [DOLL_TAG] });
}

// ---------------------------------------------------------------------
// 1. Give the whistle when a player spawns
// ---------------------------------------------------------------------

function hasWhistle(container) {
  for (let slot = 0; slot < container.size; slot++) {
    if (container.getItem(slot)?.typeId === WHISTLE_ID) return true;
  }
  return false;
}

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn && !CONFIG.giveWhistleOnEverySpawn) return;

  const player = event.player;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container || hasWhistle(container)) return; // never give a second whistle

  const whistle = new ItemStack(WHISTLE_ID, 1);
  whistle.keepOnDeath = true; // stays with you when you die, so it can't drop and become a duplicate
  whistle.setLore(["§7Use it to start or stop", "§7Red Light, Green Light"]);

  const leftover = container.addItem(whistle);
  if (leftover) player.dimension.spawnItem(leftover, player.location); // inventory full: drop it at their feet
});

// ---------------------------------------------------------------------
// 2. Use the whistle to start or stop the game
// ---------------------------------------------------------------------

function onWhistleUsed(player) {
  // One tap can send more than one event (and holding sends many),
  // so ignore uses that come less than 1 second after the last one.
  const now = system.currentTick;
  const last = lastWhistleUse.get(player.id) ?? -100;
  lastWhistleUse.set(player.id, now);
  if (now - last < 20) return;

  if (game) {
    // Only the player who started the game can stop it (anyone can if that player left).
    if (game.host.isValid() && game.host.id !== player.id) {
      player.sendMessage(`§cA game is already running. Only ${game.host.name} can stop it.`);
      return;
    }
    world.sendMessage(`§e${player.name} stopped Red Light, Green Light.`);
    endGame();
  } else {
    startGame(player);
  }
}

// itemUse = tap while looking at the air, itemUseOn = tap while looking at a block.
world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack.typeId === WHISTLE_ID) onWhistleUsed(event.source);
});
world.afterEvents.itemUseOn.subscribe((event) => {
  if (event.itemStack.typeId === WHISTLE_ID) onWhistleUsed(event.source);
});

// ---------------------------------------------------------------------
// 3. The game
// ---------------------------------------------------------------------

// Place the doll: an armor stand with a pumpkin head, so you can see where it looks.
function placeDoll(dimension) {
  for (const oldDoll of getDolls(dimension)) oldDoll.remove(); // left over from an old game

  let doll;
  try {
    doll = dimension.spawnEntity("minecraft:armor_stand", middleOf(CONFIG.dollPos));
  } catch {
    return false; // the spot is not loaded (too far from players) or outside the world
  }
  doll.addTag(DOLL_TAG);

  try {
    doll.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Head, new ItemStack("minecraft:carved_pumpkin"));
  } catch {
    // No pumpkin head. The game still works without it.
  }
  return true;
}

function startGame(host) {
  const dimension = world.getDimension("overworld");

  // Only players near the start join the game.
  const players = dimension.getPlayers({ location: CONFIG.startPos, maxDistance: CONFIG.joinDistance });
  if (players.length === 0) {
    const s = CONFIG.startPos;
    host.sendMessage(`§cNobody is within ${CONFIG.joinDistance} blocks of the start (${s.x}, ${s.y}, ${s.z}).`);
    return;
  }

  if (!placeDoll(dimension)) {
    host.sendMessage("§cCould not place the doll. Check dollPos in main.js (it must be near the start).");
    return;
  }

  // Line everyone up at the start, looking at the doll.
  const lookAtDoll = { x: 0, y: yawToward(CONFIG.startPos, CONFIG.dollPos) };
  for (const player of players) {
    player.teleport(middleOf(CONFIG.startPos), { dimension, rotation: lookAtDoll });
  }

  game = {
    dimension,
    host, // the player who started the game
    allPlayers: players, // everyone who joined (they see the titles and are reset at the end)
    alive: [...players], // players who are not out yet
    light: "green",
    lightEndTick: 0, // when the current light ends
    checkStartTick: 0, // when red light starts checking for movement
    stopSpots: new Map(), // player id -> where they stood when red light checking started
    loopId: system.runInterval(gameLoop, LOOP_TICKS),
  };

  const names = players.map((player) => player.name).join(", ");
  world.sendMessage(`§e${host.name} started Red Light, Green Light! Players: ${names}`);
  setLight("green");
}

// Change the light: turn the doll, show the title and play a sound.
function setLight(light) {
  const now = system.currentTick;
  const isGreen = light === "green";
  game.light = light;
  game.lightEndTick = now + randomTicks(isGreen ? CONFIG.greenLightSeconds : CONFIG.redLightSeconds);
  game.checkStartTick = now + Math.round(CONFIG.reactionSeconds * 20);
  game.stopSpots.clear();

  // GREEN: the doll looks away from the players. RED: the doll looks at them.
  const lookAtPlayers = yawToward(CONFIG.dollPos, CONFIG.startPos);
  for (const doll of getDolls(game.dimension)) {
    doll.teleport(doll.location, { rotation: { x: 0, y: isGreen ? turnAround(lookAtPlayers) : lookAtPlayers } });
  }

  for (const player of gamePlayers()) {
    player.onScreenDisplay.setTitle(isGreen ? "§aGREEN LIGHT" : "§cRED LIGHT", {
      subtitle: isGreen ? "Go!" : "Don't move!",
      fadeInDuration: 0,
      stayDuration: 30,
      fadeOutDuration: 10,
    });
    player.playSound(isGreen ? "note.pling" : "block.bell.hit", { pitch: isGreen ? 1.5 : 1 });
  }
}

// Runs every few ticks while a game is running.
function gameLoop() {
  if (!game) return;
  const now = system.currentTick;

  // Forget players who left the world.
  game.alive = game.alive.filter((player) => player.isValid());

  // RED LIGHT: after the reaction time, anyone who moves is out.
  if (game.light === "red" && now >= game.checkStartTick) {
    for (const player of [...game.alive]) {
      const spot = game.stopSpots.get(player.id);
      if (!spot) {
        game.stopSpots.set(player.id, player.location); // remember where they stopped
      } else if (distance(player.location, spot) >= CONFIG.moveTolerance) {
        knockOut(player);
      }
    }
  }

  // The first player inside the finish area wins.
  const winner = game.alive.find((player) => isInFinishArea(player.location));
  if (winner) {
    announceWinner(winner);
    endGame();
    return;
  }

  if (game.alive.length === 0) {
    world.sendMessage("§cEveryone is out! Nobody wins this time.");
    endGame();
    return;
  }

  // Time to change the light?
  if (now >= game.lightEndTick) setLight(game.light === "green" ? "red" : "green");
}

// The player moved during red light: send them to the "out" spot.
function knockOut(player) {
  game.alive = game.alive.filter((other) => other.id !== player.id);
  player.teleport(middleOf(CONFIG.outPos), { dimension: game.dimension });
  player.sendMessage("§cYou moved! You are out.");
  player.playSound("note.bass", { pitch: 0.5 });

  for (const other of gamePlayers()) {
    if (other.id !== player.id) other.sendMessage(`§7${player.name} is out.`);
  }
}

function announceWinner(winner) {
  world.sendMessage(`§6${winner.name} reached the finish and wins Red Light, Green Light!`);
  for (const player of gamePlayers()) {
    player.onScreenDisplay.setTitle(`§6${winner.name} wins!`, { fadeInDuration: 0, stayDuration: 60, fadeOutDuration: 20 });
    player.playSound("random.levelup");
  }
}

// End the game and reset everything, ready for the next round.
function endGame() {
  const oldGame = game;
  game = null; // reset first, so a new game can always be started

  system.clearRun(oldGame.loopId);
  for (const doll of getDolls(oldGame.dimension)) doll.remove();

  // Send everyone who played back to the start.
  for (const player of oldGame.allPlayers) {
    if (player.isValid()) player.teleport(middleOf(CONFIG.startPos), { dimension: oldGame.dimension });
  }
}

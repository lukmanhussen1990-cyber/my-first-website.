// Chase Cam: a Sonic Adventure 2 style chase camera for Minecraft Bedrock.
//
// Bedrock has no setting for a far, smooth third-person camera, so every tick
// this script places the "minecraft:free" camera behind and above the player
// and lets the client glide (ease) to that spot. Only stable APIs are used, so
// it runs on phones without any experimental toggles.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const REMOTE_ID = "chasecam:remote";
const SETTINGS_PROP = "chasecam:settings";
const GOT_REMOTE_TAG = "chasecam_got_remote";

// The client glides to each new camera spot over this long. Slightly longer
// than one tick (0.05 s) so the camera never pauses between updates.
const GLIDE_SECONDS = 0.1;
// Aim this many ticks of movement ahead to make up for that glide.
const LEAD_TICKS = 2;
// Moving farther than this in one tick is a teleport: jump there, don't glide.
const TELEPORT_BLOCKS = 16;
// How far the camera stays in front of a wall that blocks its view.
const WALL_GAP = 0.3;
const MIN_REACH = 0.5;

const STYLES = [
  { id: "sa2", name: "SA2 Chase Cam (like the video)", distance: 5, height: 0.4, tilt: 10, side: 0, smooth: 3 },
  { id: "close", name: "Close Chase", distance: 3, height: 0.3, tilt: 8, side: 0, smooth: 2 },
  { id: "far", name: "Far Chase", distance: 8, height: 0.8, tilt: 15, side: 0, smooth: 4 },
  { id: "shoulder", name: "Over the Shoulder", distance: 3, height: 0.2, tilt: 3, side: 0.8, smooth: 1 },
  { id: "cinematic", name: "Cinematic (extra smooth)", distance: 7, height: 0.6, tilt: 12, side: 0, smooth: 8 },
];

function styleSettings(style) {
  const { distance, height, tilt, side, smooth } = style;
  return { style: style.id, distance, height, tilt, side, smooth };
}

const DEFAULTS = { on: true, collision: true, speedometer: true, ...styleSettings(STYLES[0]) };
const LIMITS = { distance: [2, 12], height: [0, 3], tilt: [-10, 40], side: [-1.5, 1.5], smooth: [0, 10] };

const states = new Map();
const warned = new Set();
let tick = 0;

// ---------------------------------------------------------------- camera

system.runInterval(() => {
  tick++;
  for (const player of world.getAllPlayers()) {
    try {
      update(player);
    } catch (err) {
      warnOnce(err);
    }
  }
}, 1);

function update(player) {
  const st = getState(player);
  const s = st.settings;
  const dim = player.dimension.id;
  const teleported = trackMovement(st, player.location, dim);

  if (s.on) followPlayer(player, st, s, dim, teleported);
  else if (st.active) stopCamera(player, st);

  if (s.speedometer && tick % 2 === 0 && tick >= st.hudPausedUntil) showSpeed(player, st);

  // Backup way to open the menu: start crouching while holding the remote.
  const sneaking = player.isSneaking === true;
  if (sneaking && !st.wasSneaking && holdingRemote(player)) openMenuFor(player);
  st.wasSneaking = sneaking;
}

// Keeps a smoothed velocity (blocks per tick) from how far the player moved.
// Returns true when the player teleported, respawned or changed dimension.
function trackMovement(st, pos, dim) {
  const last = st.lastPos;
  const sameDim = st.lastDim === dim;
  st.lastPos = { x: pos.x, y: pos.y, z: pos.z };
  st.lastDim = dim;
  const step = last && sameDim ? sub(pos, last) : undefined;
  if (!step || length(step) > TELEPORT_BLOCKS) {
    st.vel = { x: 0, y: 0, z: 0 };
    return true;
  }
  st.vel = lerp(st.vel, step, 0.5);
  return false;
}

function followPlayer(player, st, s, dim, teleported) {
  const head = player.getHeadLocation();
  const look = player.getRotation(); // x = pitch (+ is down), y = yaw
  const target = add(head, scale(st.vel, LEAD_TICKS));

  let cam = st.cam;
  const snap = teleported || !cam || cam.dim !== dim;
  if (snap) {
    cam = st.cam = { dim, pivot: target, yaw: look.y, pitch: look.x, reach: undefined };
  } else {
    const move = followFactor(s.smooth);
    const turn = followFactor(s.smooth / 2);
    cam.pivot = lerp(cam.pivot, target, move);
    // Yaw is kept unwrapped (it can go past 180) so the glide never spins the long way round.
    cam.yaw += wrapDegrees(look.y - cam.yaw) * turn;
    cam.pitch += (look.x - cam.pitch) * turn;
  }

  const pitch = clamp(cam.pitch + s.tilt, -89, 89);
  const forward = direction(pitch, cam.yaw);
  const right = rightOf(cam.yaw);
  const aim = { x: cam.pivot.x + right.x * s.side, y: cam.pivot.y + s.height, z: cam.pivot.z + right.z * s.side };
  let spot = sub(aim, scale(forward, s.distance));
  if (s.collision) spot = keepOutOfWalls(player.dimension, head, spot, cam, snap);

  setCamera(player, spot, { x: pitch, y: cam.yaw }, snap ? 0 : GLIDE_SECONDS);
  st.active = true;
}

// Like vanilla third person: if a block is between your head and the camera,
// pull the camera in front of it. It moves in at once and eases back out.
function keepOutOfWalls(dimension, head, spot, cam, snap) {
  const offset = sub(spot, head);
  const full = length(offset);
  if (full < 0.01) return spot;
  const dir = scale(offset, 1 / full);
  let free = full;
  try {
    const hit = dimension.getBlockFromRay(head, dir, {
      maxDistance: full + WALL_GAP,
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
    if (hit) free = Math.max(MIN_REACH, length(sub(add(hit.block.location, hit.faceLocation), head)) - WALL_GAP);
  } catch {
    // The ray reached unloaded chunks; nothing to bump into there.
  }
  cam.reach = snap || cam.reach === undefined || free < cam.reach ? free : cam.reach + (free - cam.reach) * 0.25;
  return cam.reach >= full ? spot : add(head, scale(dir, cam.reach));
}

function setCamera(player, location, rotation, glide) {
  const camera = player.camera;
  if (camera && typeof camera.setCamera === "function") {
    const options = { location, rotation };
    if (glide > 0) options.easeOptions = { easeTime: glide, easeType: "Linear" };
    camera.setCamera("minecraft:free", options);
    return;
  }
  const ease = glide > 0 ? `ease ${glide} linear ` : "";
  const pos = `${num(location.x)} ${num(location.y)} ${num(location.z)}`;
  run(player, `camera @s set minecraft:free ${ease}pos ${pos} rot ${num(rotation.x)} ${num(rotation.y)}`);
}

function stopCamera(player, st) {
  st.active = false;
  st.cam = undefined;
  const camera = player.camera;
  if (camera && typeof camera.clear === "function") camera.clear();
  else run(player, "camera @s clear");
}

// ---------------------------------------------------------------- speed meter

function showSpeed(player, st) {
  const kmh = Math.round(length(st.vel) * 72); // 1 block = 1 m, 20 ticks a second
  const text = `§b${movementLabel(player, st)}  ${kmh} km/h`;
  const screen = player.onScreenDisplay;
  if (screen && typeof screen.setActionBar === "function") screen.setActionBar(text);
}

function movementLabel(player, st) {
  const grounded = typeof player.isOnGround === "boolean" ? player.isOnGround : Math.abs(st.vel.y) < 0.01;
  if (player.getComponent("minecraft:riding")) return "RIDE";
  if (player.isGliding) return "GLIDE";
  if (player.isFlying) return "FLY";
  if (player.isSwimming || (player.isInWater && !grounded)) return "SWIM";
  if (player.isClimbing) return "CLIMB";
  return grounded ? "GROUND" : "AIR";
}

// ---------------------------------------------------------------- remote & menus

subscribe(world.afterEvents.itemUse, (ev) => {
  if (ev.itemStack?.typeId === REMOTE_ID && ev.source?.typeId === "minecraft:player") openMenuFor(ev.source);
});

subscribe(world.afterEvents.itemUseOn, (ev) => {
  if (ev.itemStack?.typeId === REMOTE_ID && ev.source?.typeId === "minecraft:player") openMenuFor(ev.source);
});

subscribe(system.afterEvents?.scriptEventReceive, (ev) => {
  const player = ev.sourceEntity;
  if (!ev.id.startsWith("chasecam:") || player?.typeId !== "minecraft:player") return;
  if (ev.id === "chasecam:on") setOn(player, true);
  else if (ev.id === "chasecam:off") setOn(player, false);
  else if (ev.id === "chasecam:toggle") setOn(player, !getState(player).settings.on);
  else if (ev.id === "chasecam:menu") openMenuFor(player);
  else if (ev.id === "chasecam:remote") giveRemote(player);
});

subscribe(world.afterEvents.playerSpawn, (ev) => {
  const player = ev.player;
  const st = getState(player);
  st.cam = undefined; // joined or respawned: jump straight to the new spot
  if (!ev.initialSpawn) return;
  if (!player.hasTag(GOT_REMOTE_TAG) && giveRemote(player)) player.addTag(GOT_REMOTE_TAG);
  if (st.settings.on) {
    player.sendMessage("§b[Chase Cam]§r Chase cam is ON. Tap with the §eChase Cam Remote§r to turn it off or pick another view.");
  }
});

subscribe(world.afterEvents.playerLeave, (ev) => states.delete(ev.playerId));

function openMenuFor(player) {
  const st = getState(player);
  // One tap can fire more than one use event; only open a single menu.
  if (st.menuOpen || tick < st.menuReadyAt) return;
  st.menuOpen = true;
  mainMenu(player)
    .catch(warnOnce)
    .finally(() => {
      st.menuOpen = false;
      st.menuReadyAt = tick + 10;
    });
}

async function mainMenu(player) {
  const st = getState(player);
  const s = st.settings;
  const style = STYLES.find((x) => x.id === s.style);
  const form = new ActionFormData()
    .title("Chase Cam")
    .body(
      `Camera: ${s.on ? "§aON" : "§cOFF"}§r\nStyle: ${style ? style.name : "Custom"}\n\n` +
        "Tip: turn it off while building, then back on to run around.",
    )
    .button(s.on ? "Turn chase cam OFF" : "Turn chase cam ON", "textures/items/chasecam_remote")
    .button("Camera style", "textures/items/spyglass")
    .button("Fine-tune camera", "textures/items/redstone_dust")
    .button(`Speed meter: ${s.speedometer ? "ON" : "OFF"}`, "textures/items/sugar")
    .button("Reset to default", "textures/items/ender_pearl");
  const res = await show(player, form);
  if (!res || res.canceled) return;
  if (res.selection === 0) setOn(player, !s.on);
  else if (res.selection === 1) await styleMenu(player);
  else if (res.selection === 2) await tuneMenu(player);
  else if (res.selection === 3) {
    s.speedometer = !s.speedometer;
    saveSettings(player, s);
    notify(player, `§bSpeed meter ${s.speedometer ? "§aON" : "§cOFF"}`);
  } else if (res.selection === 4) {
    st.settings = { ...DEFAULTS };
    saveSettings(player, st.settings);
    notify(player, "§bChase Cam§r reset to default");
  }
}

async function styleMenu(player) {
  const st = getState(player);
  const form = new ActionFormData().title("Camera style").body("How should the camera follow you?");
  for (const style of STYLES) form.button(style.id === st.settings.style ? `${style.name}\n§2(current)` : style.name);
  const res = await show(player, form);
  const style = res && !res.canceled ? STYLES[res.selection] : undefined;
  if (!style) return;
  Object.assign(st.settings, styleSettings(style), { on: true });
  saveSettings(player, st.settings);
  notify(player, `§bChase Cam:§r ${style.name}`);
}

async function tuneMenu(player) {
  const st = getState(player);
  const s = st.settings;
  const form = new ModalFormData()
    .title("Fine-tune camera")
    .slider("Distance behind you (blocks)", 2, 12, 1, Math.round(s.distance))
    .slider("Height above your head (10 = 1 block)", 0, 30, 1, Math.round(s.height * 10))
    .slider("Look-down angle (degrees)", -10, 40, 1, Math.round(s.tilt))
    .slider("Side offset (10 = 1 block, + is right)", -15, 15, 1, Math.round(s.side * 10))
    .slider("Smoothness (0 = snappy, 10 = floaty)", 0, 10, 1, Math.round(s.smooth))
    .toggle("Stop camera going through walls", s.collision)
    .toggle("Speed meter", s.speedometer);
  const res = await show(player, form);
  if (!res || res.canceled || !res.formValues) return;
  const [distance, height, tilt, side, smooth, collision, speedometer] = res.formValues;
  st.settings = sanitize({
    on: true,
    style: "custom",
    distance,
    height: height / 10,
    tilt,
    side: side / 10,
    smooth,
    collision,
    speedometer,
  });
  saveSettings(player, st.settings);
  notify(player, "§bChase Cam:§r custom view saved");
}

// Forms can't open while another screen (like chat) is up, so retry for a bit.
async function show(player, form) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await form.show(player);
    if (res.cancelationReason !== "UserBusy") return res;
    await new Promise((resolve) => system.runTimeout(resolve, 5));
  }
  return undefined;
}

function setOn(player, on) {
  const s = getState(player).settings;
  s.on = on;
  saveSettings(player, s);
  notify(player, on ? "§bChase Cam §aON" : "§bChase Cam §cOFF");
}

function notify(player, text) {
  getState(player).hudPausedUntil = tick + 40;
  player.onScreenDisplay.setActionBar(text);
  try {
    player.playSound("random.click");
  } catch {
    // Sound is only a nicety.
  }
}

function holdingRemote(player) {
  const slot = typeof player.selectedSlot === "number" ? player.selectedSlot : player.selectedSlotIndex;
  if (typeof slot !== "number") return false;
  return player.getComponent("minecraft:inventory")?.container?.getItem(slot)?.typeId === REMOTE_ID;
}

function giveRemote(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;
    const leftover = inventory.addItem(new ItemStack(REMOTE_ID, 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    return true;
  } catch (err) {
    warnOnce(err);
    return false;
  }
}

// ---------------------------------------------------------------- per-player state

function getState(player) {
  let st = states.get(player.id);
  if (!st) {
    st = {
      settings: loadSettings(player),
      cam: undefined,
      active: false,
      vel: { x: 0, y: 0, z: 0 },
      lastPos: undefined,
      lastDim: undefined,
      hudPausedUntil: 0,
      wasSneaking: false,
      menuOpen: false,
      menuReadyAt: 0,
    };
    states.set(player.id, st);
  }
  return st;
}

function loadSettings(player) {
  try {
    const raw = player.getDynamicProperty(SETTINGS_PROP);
    if (typeof raw === "string") return sanitize(JSON.parse(raw));
  } catch {
    // Nothing saved yet (or unreadable): use the defaults.
  }
  return { ...DEFAULTS };
}

function saveSettings(player, settings) {
  try {
    player.setDynamicProperty(SETTINGS_PROP, JSON.stringify(settings));
  } catch (err) {
    warnOnce(err);
  }
}

function sanitize(raw) {
  const s = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof raw?.[key] === typeof DEFAULTS[key]) s[key] = raw[key];
  }
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    s[key] = Number.isFinite(s[key]) ? clamp(s[key], lo, hi) : DEFAULTS[key];
  }
  return s;
}

// ---------------------------------------------------------------- helpers

function subscribe(signal, callback) {
  if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
}

function run(player, command) {
  if (typeof player.runCommand === "function") player.runCommand(command);
  else player.runCommandAsync(command).catch(warnOnce);
}

function warnOnce(err) {
  const text = String(err);
  if (warned.has(text)) return;
  warned.add(text);
  console.warn(`[Chase Cam] ${text}`);
}

const RAD = Math.PI / 180;
const num = (n) => n.toFixed(3);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
const length = (a) => Math.hypot(a.x, a.y, a.z);
const wrapDegrees = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// Minecraft angles: yaw 0 faces south (+z) and 90 faces west (-x); pitch 90 looks straight down.
function direction(pitch, yaw) {
  const flat = Math.cos(pitch * RAD);
  return { x: -Math.sin(yaw * RAD) * flat, y: -Math.sin(pitch * RAD), z: Math.cos(yaw * RAD) * flat };
}

function rightOf(yaw) {
  return { x: -Math.cos(yaw * RAD), y: 0, z: -Math.sin(yaw * RAD) };
}

// Share of the remaining gap to close each tick (smooth 0 = follow instantly).
function followFactor(smooth) {
  const seconds = smooth * 0.03;
  return seconds > 0 ? 1 - Math.exp(-0.05 / seconds) : 1;
}

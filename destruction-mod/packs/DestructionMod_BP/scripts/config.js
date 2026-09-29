// @ts-check
// Item ids, weapon list and target modes. Names/colours here are what the
// menus show; the item JSON files carry the same names for the inventory.

export const TABLET_ID = "destruct:control_tablet";
export const MARKER_ID = "destruct:target_marker";
export const KIT_TAG = "destruct_kit_given";

/** @param {string} key */
const ICON = (key) => `textures/items/destruct/${key}`;

/**
 * @typedef {Object} Weapon
 * @property {string} key       effect key, also the item name after "destruct:"
 * @property {string} id        item identifier
 * @property {string} name
 * @property {string} color     § colour code used in chat / action bar
 * @property {string} blurb     one line shown on menu buttons
 * @property {number} cooldown  ticks between uses
 * @property {string} icon      texture path for menu buttons
 */

/** key, name, colour, blurb, cooldown (ticks) @type {[string, string, string, string, number][]} */
const LIST = [
  ["mega_tnt_wand", "Mega TNT Wand", "§c", "Giant blast + ring of explosions", 60],
  ["meteor_staff", "Meteor Staff", "§6", "Fiery meteors rain from the sky", 80],
  ["thunder_staff", "Thunder Staff", "§e", "A storm of lightning strikes", 60],
  ["black_hole_orb", "Black Hole Orb", "§5", "Sucks in mobs and eats the ground", 120],
  ["earthquake_hammer", "Earthquake Hammer", "§g", "Cracks the ground, bounces mobs", 100],
  ["tornado_wand", "Tornado Wand", "§f", "A tornado that rips up the land", 120],
  ["sky_beam_staff", "Sky Beam Staff", "§b", "A beam from the sky drills a pit", 100],
  ["tnt_rain_wand", "TNT Rain Wand", "§4", "Lit TNT falls from the sky", 80],
  ["shockwave_core", "Shockwave Core", "§9", "Rings of force blast outward", 60],
  ["crater_wand", "Crater Wand", "§d", "Erases a perfect ball of terrain", 30],
];

/** @type {Weapon[]} */
export const WEAPONS = LIST.map(([key, name, color, blurb, cooldown]) => ({
  key,
  id: `destruct:${key}`,
  name,
  color,
  blurb,
  cooldown,
  icon: ICON(key),
}));

/** @type {Map<string, Weapon>} */
export const WEAPON_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));

/**
 * The "where" choices. `look` is the default for every weapon.
 * @typedef {"look" | "marker" | "coords" | "player" | "random"} ModeId
 * @type {{id: ModeId, label: string, hint: string, icon: string}[]}
 */
export const MODES = [
  { id: "look", label: "Where I'm looking", hint: "The block under your crosshair", icon: "textures/ui/destruct/eye" },
  { id: "marker", label: "My Target Marker", hint: "The spot saved with the marker", icon: ICON("target_marker") },
  { id: "coords", label: "Type coordinates", hint: "Enter X Y Z (~ works too)", icon: "textures/ui/destruct/coords" },
  { id: "player", label: "On a player", hint: "Wherever they are standing", icon: "textures/ui/destruct/player" },
  { id: "random", label: "Random spot near me", hint: "Somewhere 14-36 blocks away", icon: "textures/ui/destruct/dice" },
];

export const UI_ICON = {
  launch: ICON("mega_tnt_wand"),
  marker: ICON("target_marker"),
  gear: "textures/ui/destruct/gear",
  kit: "textures/ui/destruct/kit",
  stop: "textures/ui/destruct/stop",
  help: "textures/ui/destruct/help",
  tablet: ICON("control_tablet"),
};

/** @param {string} id */
export function modeLabel(id) {
  return MODES.find((m) => m.id === id)?.label ?? MODES[0].label;
}

/* ============================== WEAPONS ================================== */
/* Three answers to the same question. The sword is safe, the spear is
   committal but reaches, the wand trades stamina for distance. Tier upgrades
   raise numbers AND unlock a behaviour, so a tempered weapon feels different. */
const WEAPONS = {
  sword: {
    name: "Sword", kind: "melee", icon: "sword",
    dmg: 9, cd: 0.30, stam: 5, range: 26, arc: 1.75, knock: 74, windup: 0.06, moveMul: 0.55,
    trait: (t) => t >= 4 ? "3rd hit becomes a full spin" : t >= 3 ? "Wider sweep" : t >= 2 ? "Faster recovery" : "Quick arcing sweep"
  },
  spear: {
    name: "Spear", kind: "melee", icon: "spear",
    dmg: 16, cd: 0.50, stam: 11, range: 42, arc: 0.5, knock: 130, windup: 0.13, moveMul: 0.32,
    trait: (t) => t >= 5 ? "Impales everything in line" : t >= 3 ? "Lunges forward on thrust" : t >= 2 ? "Pierces 3 foes" : "Long piercing thrust"
  },
  wand: {
    name: "Wand", kind: "cast", icon: "wand",
    dmg: 11, cd: 0.42, stam: 14, range: 150, knock: 40, windup: 0.10, moveMul: 0.7,
    trait: (t) => t >= 5 ? "Three seeking sparks that pierce" : t >= 4 ? "Casts three bolts" : t >= 3 ? "Casts two bolts" : t >= 2 ? "Sharper homing" : "A seeking arcane bolt"
  }
};
const WEAPON_ORDER = ["sword", "spear", "wand"];
const BOLT_KIND_BY_TIER = ["arcane", "arcane", "frost", "fire", "spark"];

function weaponStats(P, key) {
  const W = WEAPONS[key], t = P.tiers[key];
  const tierMul = 1 + (t - 1) * 0.38;
  return {
    dmg: W.dmg * tierMul * P.wdmg[key] * P.dmgMul,
    cd: W.cd * (key === "sword" && t >= 2 ? 0.88 : 1) * P.atkSpeed,
    stam: Math.max(2, W.stam * P.stamCost),
    range: W.range + (key === "spear" ? (t - 1) * 3 : key === "sword" ? (t - 1) * 1.5 : 0) + P.rangeBonus,
    arc: (W.arc || 0) * (key === "sword" && t >= 3 ? 1.28 : 1),
    knock: W.knock * P.knockMul,
    pierce: key === "spear" ? (t >= 5 ? 99 : 1 + t) : key === "wand" ? (t >= 5 ? 3 : 1) : 1,
    bolts: key === "wand" ? (t >= 4 ? 3 : t >= 3 ? 2 : 1) : 0,
    homing: key === "wand" ? (0.9 + t * 0.55) : 0,
    lunge: key === "spear" && t >= 3
  };
}

/* =============================== BOONS =================================== */
/* Level-up choices. Each may be taken up to `max` times; the pool reweights
   toward what the player is actually using. */
const BOONS = [
  { id: "vigor", name: "Vigor", icon: "hp", rar: "common", max: 8, desc: "+16 max health, and heal that much now.",
    apply(P) { P.maxHp += 16; P.hp = Math.min(P.maxHp, P.hp + 16); } },
  { id: "wind", name: "Second Wind", icon: "sp", rar: "common", max: 8, desc: "+18 max stamina.",
    apply(P) { P.maxSp += 18; P.sp = P.maxSp; } },
  { id: "recovery", name: "Deep Breath", icon: "sp", rar: "common", max: 5, desc: "+22% stamina recovery.",
    apply(P) { P.spRegen *= 1.22; } },
  { id: "keen", name: "Keen Edge", icon: "sword", rar: "common", max: 6, desc: "+18% sword damage.",
    apply(P) { P.wdmg.sword *= 1.18; }, fav: "sword" },
  { id: "reach", name: "Long Reach", icon: "spear", rar: "common", max: 6, desc: "+18% spear damage.",
    apply(P) { P.wdmg.spear *= 1.18; }, fav: "spear" },
  { id: "focus", name: "Arcane Focus", icon: "wand", rar: "common", max: 6, desc: "+18% wand damage.",
    apply(P) { P.wdmg.wand *= 1.18; }, fav: "wand" },
  { id: "swift", name: "Fleetfoot", icon: "speed", rar: "common", max: 5, desc: "+8% movement speed.",
    apply(P) { P.moveSpeed *= 1.08; } },
  { id: "thrift", name: "Efficient Form", icon: "sp", rar: "common", max: 4, desc: "Attacks cost 12% less stamina.",
    apply(P) { P.stamCost *= 0.88; } },
  { id: "hunger", name: "Hungry Blade", icon: "xp", rar: "common", max: 5, desc: "+15% XP from every kill.",
    apply(P) { P.xpMul += 0.15; } },
  { id: "reachcharm", name: "Charm of Reach", icon: "magnet", rar: "common", max: 3, desc: "Pickups are drawn from much further away.",
    apply(P) { P.magnetR += 44; } },

  { id: "crit", name: "Critical Eye", icon: "crit", rar: "rare", max: 6, desc: "+7% critical chance.",
    apply(P) { P.critChance += 0.07; } },
  { id: "brutal", name: "Brutal Strikes", icon: "crit", rar: "rare", max: 4, desc: "+35% critical damage.",
    apply(P) { P.critMul += 0.35; } },
  { id: "leech", name: "Bloodthirst", icon: "lifesteal", rar: "rare", max: 4, desc: "Heal for 5% of the damage you deal.",
    apply(P) { P.lifesteal += 0.05; } },
  { id: "trance", name: "Battle Trance", icon: "trance", rar: "rare", max: 4, desc: "Every kill restores 8 stamina.",
    apply(P) { P.killStam += 8; } },
  { id: "swiftblade", name: "Swiftblade", icon: "speed", rar: "rare", max: 4, desc: "Attack 10% faster.",
    apply(P) { P.atkSpeed *= 0.90; } },
  { id: "thorns", name: "Bramble Hide", icon: "thorns", rar: "rare", max: 4, desc: "Attackers take 8 damage back.",
    apply(P) { P.thorns += 8; } },
  { id: "hide", name: "Toughened Hide", icon: "armor", rar: "rare", max: 5, desc: "Reduce all damage taken by 2.",
    apply(P) { P.armor += 2; } },
  { id: "dasher", name: "Windstep", icon: "dash", rar: "rare", max: 2, desc: "+1 dash charge and faster recharge.",
    apply(P) { P.dashMax += 1; P.dashRate *= 1.2; } },
  { id: "force", name: "Heavy Impact", icon: "armor", rar: "rare", max: 3, desc: "+40% knockback, and hits stagger longer.",
    apply(P) { P.knockMul += 0.4; P.stagger += 0.1; } },

  { id: "ward", name: "Aegis Ward", icon: "shield", rar: "epic", max: 3, desc: "A ward blocks one hit, recharging every 14s.",
    apply(P) { P.wardMax += 1; P.ward = P.wardMax; } },
  { id: "ember", name: "Emberbrand", icon: "fire", rar: "epic", max: 3, desc: "Hits set foes alight for 40% damage over 3s.",
    apply(P) { P.burn += 0.4; } },
  { id: "rime", name: "Rimebite", icon: "frost", rar: "epic", max: 3, desc: "Hits chill foes, slowing them by 30%.",
    apply(P) { P.chill += 0.3; } },
  { id: "arcstorm", name: "Arc Storm", icon: "chain", rar: "epic", max: 3, desc: "Hits arc to a nearby foe for 45% damage.",
    apply(P) { P.chain += 0.45; } },
  { id: "temper_sword", name: "Temper: Sword", icon: "sword", rar: "epic", max: 4, desc: "Raise the sword a full tier.",
    apply(P) { upgradeWeapon(P, "sword"); }, req: (P) => P.tiers.sword < 5, fav: "sword" },
  { id: "temper_spear", name: "Temper: Spear", icon: "spear", rar: "epic", max: 4, desc: "Raise the spear a full tier.",
    apply(P) { upgradeWeapon(P, "spear"); }, req: (P) => P.tiers.spear < 5, fav: "spear" },
  { id: "temper_wand", name: "Temper: Wand", icon: "wand", rar: "epic", max: 4, desc: "Raise the wand a full tier.",
    apply(P) { upgradeWeapon(P, "wand"); }, req: (P) => P.tiers.wand < 5, fav: "wand" }
];
const RAR_W = { common: 62, rare: 30, epic: 12 };

/* build titles: flavour derived from what the player actually leaned into */
const TITLES = [
  { t: "Stormcaller", test: (P) => P.tiers.wand >= 4 && P.chain > 0 },
  { t: "Emberlance", test: (P) => P.tiers.spear >= 4 && P.burn > 0 },
  { t: "Frostblade", test: (P) => P.tiers.sword >= 3 && P.chill > 0 },
  { t: "Bloodletter", test: (P) => P.lifesteal >= 0.10 },
  { t: "Bramble Knight", test: (P) => P.thorns >= 16 },
  { t: "Warden of the Codex", test: (P) => P.wardMax >= 2 },
  { t: "Duelist", test: (P) => P.critChance >= 0.28 },
  { t: "Spearmaster", test: (P) => P.tiers.spear >= 4 },
  { t: "Blademaster", test: (P) => P.tiers.sword >= 4 },
  { t: "Archmage", test: (P) => P.tiers.wand >= 4 },
  { t: "Windrunner", test: (P) => P.moveSpeed >= 1.25 || P.dashMax >= 3 },
  { t: "Ironhide", test: (P) => P.armor >= 6 },
  { t: "Wayfarer", test: () => true }
];
function buildTitle(P) {
  const base = TITLES.find(x => x.test(P)).t;
  const rank = P.level >= 25 ? "Legendary " : P.level >= 16 ? "Veteran " : P.level >= 8 ? "Seasoned " : P.level >= 4 ? "Journeyman " : "Novice ";
  return rank + base;
}

/* ============================== MONSTERS ================================= */
/* `passive` creatures ignore the player until struck; everything else hunts.
   `tier` gates which biomes and which point in the run they show up in. */
const MONSTERS = {
  gelmite: { name: "Gelmite", art: "gelmite", passive: true, hp: 16, dmg: 5, speed: 20, r: 6, xp: 7, det: 46, atkR: 13, atkCd: 1.5, tier: 1,
    biomes: [T.MEADOW, T.GRASS, T.SWAMP, T.FOREST], note: "A placid ooze. It only fights back." },
  sporling: { name: "Sporling", art: "sporling", passive: true, hp: 22, dmg: 6, speed: 17, r: 6, xp: 9, det: 44, atkR: 13, atkCd: 1.6, tier: 1,
    biomes: [T.FOREST, T.SWAMP, T.GRASS], note: "Bursts a cloud of spores when angered." },
  prikkle: { name: "Prikkle", art: "prikkle", passive: true, hp: 26, dmg: 8, speed: 15, r: 6, xp: 11, det: 40, atkR: 13, atkCd: 1.5, tier: 1,
    biomes: [T.SAND, T.DIRT], note: "All needles, no temper — until you poke it." },
  fennec: { name: "Fennec", art: "fennec", passive: true, hp: 18, dmg: 6, speed: 40, r: 6, xp: 10, det: 70, atkR: 12, atkCd: 1.1, tier: 1, skittish: true,
    biomes: [T.SAND, T.MEADOW, T.GRASS, T.DIRT], note: "Bolts at the first sign of trouble." },

  nightwing: { name: "Nightwing", art: "nightwing", hp: 20, dmg: 7, speed: 46, r: 6, xp: 13, det: 130, atkR: 14, atkCd: 1.0, tier: 1, erratic: true, flier: true,
    biomes: [T.FOREST, T.SWAMP, T.STONE, T.ASH, T.GRASS], note: "Dives in loops. Hard to pin down." },
  thornmaw: { name: "Thornmaw", art: "thornmaw", hp: 40, dmg: 11, speed: 0, r: 7, xp: 16, det: 46, atkR: 22, atkCd: 1.3, tier: 1, rooted: true,
    biomes: [T.SWAMP, T.FOREST, T.MEADOW], note: "Rooted, patient, and always hungry." },
  rattleknight: { name: "Rattleknight", art: "rattleknight", hp: 46, dmg: 10, speed: 30, r: 6, xp: 20, det: 120, atkR: 17, atkCd: 1.3, tier: 2,
    biomes: [T.DIRT, T.STONE, T.ASH, T.SAND, T.FOREST], note: "Raises its shield the moment you close in." },
  grimhound: { name: "Grimhound", art: "grimhound", hp: 38, dmg: 12, speed: 58, r: 7, xp: 22, det: 165, atkR: 16, atkCd: 0.9, tier: 2, lunger: true,
    biomes: [T.GRASS, T.FOREST, T.SNOW, T.STONE, T.MEADOW], note: "Hunts in a straight, committed charge." },
  emberwisp: { name: "Emberwisp", art: "emberwisp", hp: 34, dmg: 9, speed: 26, r: 6, xp: 26, det: 175, atkR: 120, atkCd: 1.9, tier: 2, ranged: true, keepAt: 86, flier: true,
    biomes: [T.ASH, T.STONE, T.SWAMP, T.SNOW], note: "Keeps its distance and throws cinders." },
  gloomwraith: { name: "Gloomwraith", art: "gloomwraith", hp: 44, dmg: 14, speed: 70, r: 6, xp: 32, det: 190, atkR: 16, atkCd: 1.1, tier: 3, phaser: true,
    biomes: [T.ASH, T.SNOW, T.SWAMP, T.STONE], note: "Slips through the world to reach you." },
  stonewarden: { name: "Stonewarden", art: "stonewarden", hp: 150, dmg: 22, speed: 24, r: 11, xp: 90, det: 150, atkR: 26, atkCd: 1.8, tier: 3, elite: true, slam: true,
    biomes: [T.STONE, T.ASH, T.SNOW, T.DIRT], note: "A mountain that decided to walk." }
};
const MON_KEYS = Object.keys(MONSTERS);

/* which monsters may appear on a given tile, weighted by run difficulty */
function spawnTableFor(tileKind, diffTier) {
  const out = [];
  for (const k of MON_KEYS) {
    const M = MONSTERS[k];
    if (M.biomes.indexOf(tileKind) < 0) continue;
    if (M.tier > diffTier) continue;
    let w = 10;
    if (M.elite) w = 1.1;
    else if (M.tier < diffTier - 1) w = 5;          /* early beasts thin out later */
    else if (M.tier === diffTier) w = 13;
    out.push({ k, w });
  }
  return out;
}

// Static checks: every file the game loads must be valid and every
// cross-reference (textures, names, recipes, cooldowns, UUIDs) must line up.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "packs");
const BP = join(root, "ArcaneArsenal_BP");
const RP = join(root, "ArcaneArsenal_RP");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const files = (d) => readdirSync(d).map((f) => join(d, f));
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  assert.ok(cond, msg);
};

// manifests
const bpm = json(join(BP, "manifest.json"));
const rpm = json(join(RP, "manifest.json"));
ok(bpm.dependencies.some((d) => d.uuid === rpm.header.uuid), "BP depends on RP");
ok(bpm.dependencies.some((d) => d.module_name === "@minecraft/server" && d.version === "1.10.0"), "script API 1.10.0");
const uuids = [bpm.header.uuid, rpm.header.uuid, ...bpm.modules.map((m) => m.uuid), ...rpm.modules.map((m) => m.uuid)];
ok(new Set(uuids).size === uuids.length, "unique UUIDs");
ok(existsSync(join(BP, bpm.modules.find((m) => m.type === "script").entry)), "script entry exists");

// items <-> textures <-> names
const atlas = json(join(RP, "textures", "item_texture.json")).texture_data;
const lang = Object.fromEntries(
  readFileSync(join(RP, "texts", "en_US.lang"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const itemIds = new Set();
const weaponsJs = readFileSync(join(BP, "scripts", "weapons.js"), "utf8");
for (const f of files(join(BP, "items"))) {
  const item = json(f)["minecraft:item"];
  const id = item.description.identifier;
  const c = item.components;
  itemIds.add(id);
  const tex = c["minecraft:icon"].texture;
  ok(atlas[tex] && existsSync(join(RP, atlas[tex].textures + ".png")), `${id}: texture`);
  ok(lang[c["minecraft:display_name"].value], `${id}: name in en_US.lang`);
  const cd = c["minecraft:cooldown"];
  const m = weaponsJs.match(new RegExp(`"${id}": (\\d+)`));
  ok(m && Number(m[1]) === Math.round(cd.duration * 20), `${id}: cooldown matches weapons.js`);
  ok(c["minecraft:max_stack_size"] === 1, `${id}: not stackable`);
}
ok(itemIds.size === 9, "9 items");

// recipes
for (const f of files(join(BP, "recipes"))) {
  const r = json(f)["minecraft:recipe_shaped"];
  ok(itemIds.has(r.result.item), `${f}: result is one of our items`);
  const used = new Set(r.pattern.join("").replace(/ /g, ""));
  ok([...used].every((k) => r.key[k]), `${f}: every pattern symbol has a key`);
  for (const k of Object.values(r.key)) {
    ok(!k.item.startsWith("arcane:") || itemIds.has(k.item), `${f}: ingredient ${k.item} exists`);
  }
}

// particles
const atlasPng = join(RP, "textures", "particle", "arcane_particles.png");
ok(existsSync(atlasPng), "particle atlas");
const used = new Set([...weaponsJs.matchAll(/"(arcane:[a-z_]+(?:_mote|_burst|_rune|_shards|_pillar|_cloud|_flame|_ember|_smoke|_streak|_spark))"/g)].map((m) => m[1]));
const defined = new Set();
for (const f of files(join(RP, "particles"))) {
  const p = json(f).particle_effect;
  defined.add(p.description.identifier);
  ok(p.description.basic_render_parameters.material === "particles_alpha", `${f}: material`);
  const uv = p.components["minecraft:particle_appearance_billboard"].uv;
  ok(uv.uv[0] + uv.uv_size[0] <= uv.texture_width && uv.uv[1] + uv.uv_size[1] <= uv.texture_height, `${f}: uv inside atlas`);
}
for (const id of used) ok(defined.has(id), `particle ${id} is defined`);
for (const el of ["frost", "fire", "venom", "storm", "shadow", "arcane", "wind", "holy"]) {
  ok(defined.has(`arcane:${el}_mote`) && defined.has(`arcane:${el}_rune`) && defined.has(`arcane:${el}_glint`),
    `${el} mote + rune + glint particles`);
}

// PNGs are real PNGs
for (const f of [...files(join(RP, "textures", "items")), atlasPng, join(RP, "pack_icon.png"), join(BP, "pack_icon.png")]) {
  ok(readFileSync(f).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${f}: PNG`);
}

console.log(`  ✔ pack files: ${checks} cross-checks passed`);

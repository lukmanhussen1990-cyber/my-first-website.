// Deep validation of the add-on against Mojang's own data for 1.21.0.26: engine docs (allowed Molang
// queries/math), the bundled JSON schemas for item components, vanilla recipe/item ids, sounds and particles.
//
//     BEDROCK_SAMPLES=/path/to/bedrock-samples node tools/deep_validate.mjs
//
// BEDROCK_SAMPLES is a checkout of https://github.com/Mojang/bedrock-samples at tag v1.21.0.26-preview.
// Needs `npm install` in tools/ (ajv, molang). Exits non-zero on any error. The dependency-free
// tools/validate.py (run by build_addon.py) covers the basics; this one is the stricter, optional check.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { Molang } = require('molang');
const Ajv2020 = require('ajv/dist/2020.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BP = path.join(ROOT, 'behavior_pack'), RP = path.join(ROOT, 'resource_pack');
const SAMPLES = process.env.BEDROCK_SAMPLES;
if (!SAMPLES || !fs.existsSync(path.join(SAMPLES, 'documentation', 'Molang.html'))) {
  console.error('Set BEDROCK_SAMPLES to a checkout of https://github.com/Mojang/bedrock-samples (tag v1.21.0.26-preview).');
  process.exit(2);
}
let errors = 0, warns = 0;
const err = (m) => { errors++; console.log('  ERROR ', m); };
const warn = (m) => { warns++; console.log('  warn  ', m); };
const ok = (m) => console.log('  ok    ', m);

function walk(dir, ext) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p, ext)); else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p);
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(`${rel(p)}: invalid JSON (${e.message})`); return null; } };

// ------------------------------------------------------------------ allowed vocab from the engine docs
function docLines(file) {
  let t = fs.readFileSync(path.join(SAMPLES, 'documentation', file), 'utf8');
  t = t.replace(/<[^>]+>/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  return t.split('\n').map((l) => l.trim()).filter(Boolean);
}
const lines = docLines('Molang.html');
const QUERIES = new Set(lines.filter((l) => /^query\.[a-z_0-9]+$/.test(l)).map((l) => l.slice(6)));
const MATH = new Set(lines.map((l) => (l.match(/^`math\.([a-z_0-9]+)\(/) || [])[1]).filter(Boolean));
['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'exp', 'floor', 'mod', 'pow', 'random', 'round', 'sqrt', 'pi', 'random_integer', 'min', 'max', 'clamp', 'lerp', 'sin', 'trunc', 'ln', 'hermite_blend', 'lerprotate', 'min_angle', 'die_roll', 'die_roll_integer'].forEach((m) => MATH.add(m));
console.log(`engine vocabulary: ${QUERIES.size} queries, ${MATH.size} math functions`);

// ------------------------------------------------------------------ 1. every JSON parses
console.log('\n[1] JSON syntax');
const jsonFiles = [...walk(BP, '.json'), ...walk(RP, '.json')];
const J = {};
for (const f of jsonFiles) J[f] = readJson(f);
ok(`${jsonFiles.length} JSON files parsed`);

// ------------------------------------------------------------------ 2. Molang
console.log('\n[2] Molang expressions');
const ml = new Molang({}, { useCache: false, useOptimizer: false });
let molangCount = 0;
function checkMolang(expr, where) {
  if (typeof expr !== 'string') return;
  molangCount++;
  const s = expr.replace(/this\b/g, '1');
  try { ml.parse(s); } catch (e) { err(`${where}: Molang parse error in "${expr.slice(0, 90)}": ${e.message}`); }
  for (const m of s.matchAll(/\b(?:q|query)\.([a-z_0-9]+)/gi)) if (!QUERIES.has(m[1].toLowerCase())) err(`${where}: unknown query.${m[1]}`);
  for (const m of s.matchAll(/\bmath\.([a-z_0-9]+)/gi)) if (!MATH.has(m[1].toLowerCase())) err(`${where}: unknown math.${m[1]}`);
  for (const m of s.matchAll(/\b(?:c|context)\.([a-z_]+)/gi)) if (!['is_first_person', 'item_slot', 'owning_entity', 'other'].includes(m[1].toLowerCase())) err(`${where}: unknown context.${m[1]}`);
  let paren = 0; for (const ch of s.replace(/'[^']*'/g, '')) { if (ch === '(') paren++; if (ch === ')') paren--; if (paren < 0) break; }
  if (paren !== 0) err(`${where}: unbalanced parentheses in "${expr.slice(0, 80)}"`);
}
function walkStrings(o, where, fn) {
  if (typeof o === 'string') fn(o, where);
  else if (Array.isArray(o)) o.forEach((v, i) => walkStrings(v, `${where}[${i}]`, fn));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walkStrings(v, `${where}.${k}`, fn);
}
for (const f of walk(RP, '.json')) {
  const d = J[f]; if (!d) continue;
  if (f.includes('/animations/')) for (const [id, a] of Object.entries(d.animations || {})) {
    if (a.anim_time_update) checkMolang(a.anim_time_update, `${rel(f)} ${id}.anim_time_update`);
    for (const [b, ch] of Object.entries(a.bones || {})) for (const [cn, cv] of Object.entries(ch)) walkStrings(cv, `${rel(f)} ${id}.${b}.${cn}`, checkMolang);
  }
  if (f.includes('/attachables/')) {
    const sc = d['minecraft:attachable'].description.scripts || {};
    for (const [k, list] of Object.entries(sc)) walkStrings(list, `${rel(f)} scripts.${k}`, (s, w) => { if (!/^[a-z_]+$/.test(s)) checkMolang(s, w); });
  }
  if (f.includes('/render_controllers/')) walkStrings(d.render_controllers, rel(f), (s, w) => { if (/[.?]|\|/.test(s) && !s.startsWith('geometry.') && !s.startsWith('texture.') ) checkMolang(s, w); });
}
ok(`${molangCount} Molang expressions parsed`);

// ------------------------------------------------------------------ 3. item component schemas
console.log('\n[3] Item components vs Mojang schemas');
const schemaDir = path.join(SAMPLES, 'metadata/json_schemas');
const schemaFile = {
  'minecraft:icon': 'Icon v1.20.60.json', 'minecraft:cooldown': 'Cooldown v1.20.50.json', 'minecraft:damage': 'Damage v1.20.50.json',
  'minecraft:durability': 'Durability v1.20.50.json', 'minecraft:enchantable': 'Enchantable v1.20.50.json',
  'minecraft:hand_equipped': 'HandEquipped v1.20.50.json', 'minecraft:display_name': 'DisplayName v1.20.50.json',
  'minecraft:max_stack_size': 'MaxStackSize v1.20.50.json', 'minecraft:repairable': 'Repairable v1.20.50.json',
  'minecraft:allow_off_hand': 'AllowOffHand v1.20.50.json', 'minecraft:can_destroy_in_creative': 'CanDestroyInCreative v1.20.50.json',
};
const allowedComponents = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(schemaDir, 'Components v1.20.80.json'), 'utf8')).properties));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validators = {};
for (const [c, file] of Object.entries(schemaFile)) validators[c] = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8')));
const itemIds = [];
for (const f of walk(path.join(BP, 'items'), '.json')) {
  const it = J[f]['minecraft:item']; itemIds.push(it.description.identifier);
  if (!['1.20.50', '1.20.60', '1.20.70', '1.20.80', '1.21.0'].includes(J[f].format_version)) err(`${rel(f)}: format_version ${J[f].format_version}`);
  for (const [c, v] of Object.entries(it.components)) {
    if (!allowedComponents.has(c)) { err(`${rel(f)}: component ${c} not valid at 1.20.80`); continue; }
    if (!validators[c]) { warn(`${rel(f)}: no schema checked for ${c}`); continue; }
    if (!validators[c](v)) err(`${rel(f)}: ${c} fails schema: ${JSON.stringify(validators[c].errors.slice(0, 2).map((e) => e.instancePath + ' ' + e.message))}`);
  }
  if (!it.description.identifier.startsWith('mw:')) err(`${rel(f)}: identifier not namespaced`);
}
ok(`${itemIds.length} items checked: ${itemIds.join(', ')}`);

// ------------------------------------------------------------------ 4. recipes
console.log('\n[4] Recipes');
const vanillaItems = new Set();
for (const f of walk(path.join(SAMPLES, 'behavior_pack/recipes'), '.json')) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/"item"\s*:\s*"(minecraft:[a-z_0-9]+)"/g)) vanillaItems.add(m[1]);
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/"identifier"\s*:\s*"(minecraft:[a-z_0-9]+)"/g)) vanillaItems.add(m[1]);
}
for (const f of walk(path.join(BP, 'recipes'), '.json')) {
  const r = J[f]['minecraft:recipe_shaped'];
  const keys = new Set(Object.keys(r.key));
  const used = new Set(r.pattern.join('').replace(/ /g, '').split(''));
  for (const k of used) if (!keys.has(k)) err(`${rel(f)}: pattern uses undefined key '${k}'`);
  for (const k of keys) if (!used.has(k)) warn(`${rel(f)}: key '${k}' unused`);
  const w = new Set(r.pattern.map((x) => x.length)); if (w.size !== 1) err(`${rel(f)}: pattern rows differ in width`);
  if (r.pattern.length > 3 || r.pattern[0].length > 3) err(`${rel(f)}: pattern bigger than 3x3`);
  for (const v of Object.values(r.key)) if (!vanillaItems.has(v.item)) err(`${rel(f)}: ingredient ${v.item} not found in vanilla recipe data`);
  if (!vanillaItems.has(r.unlock[0].item)) err(`${rel(f)}: unlock item ${r.unlock[0].item} unknown`);
  if (!itemIds.includes(r.result.item)) err(`${rel(f)}: result ${r.result.item} is not one of our items`);
  if (r.description.identifier !== r.result.item) warn(`${rel(f)}: recipe id differs from result`);
}
ok('recipes checked');

// ------------------------------------------------------------------ 5. resource pack cross-references
console.log('\n[5] Resource pack cross-references');
const itemTex = J[path.join(RP, 'textures/item_texture.json')].texture_data;
const animIds = new Set(), geoIds = {};
for (const f of walk(path.join(RP, 'animations'), '.json')) Object.keys(J[f].animations).forEach((k) => animIds.add(k));
for (const f of walk(path.join(RP, 'models'), '.json')) for (const g of J[f]['minecraft:geometry']) geoIds[g.description.identifier] = { g, file: f };
const pngSize = (p) => { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const f of walk(path.join(RP, 'attachables'), '.json')) {
  const d = J[f]['minecraft:attachable'].description;
  if (!itemIds.includes(d.identifier)) err(`${rel(f)}: identifier ${d.identifier} has no item`);
  const geo = geoIds[d.geometry.default]; if (!geo) { err(`${rel(f)}: geometry ${d.geometry.default} missing`); continue; }
  const texPath = path.join(RP, d.textures.default + '.png');
  if (!fs.existsSync(texPath)) { err(`${rel(f)}: texture ${d.textures.default} missing`); continue; }
  const [tw, th] = pngSize(texPath), gd = geo.g.description;
  if (tw !== gd.texture_width || th !== gd.texture_height) err(`${rel(f)}: texture is ${tw}x${th} but geometry declares ${gd.texture_width}x${gd.texture_height}`);
  const bones = new Map(geo.g.bones.map((b) => [b.name.toLowerCase(), b]));
  // geometry sanity
  const roots = geo.g.bones.filter((b) => b.binding);
  if (roots.length !== 1) err(`${rel(geo.file)}: expected exactly one bound bone, found ${roots.length}`);
  for (const b of geo.g.bones) {
    if (b.parent && !bones.has(b.parent.toLowerCase())) err(`${rel(geo.file)}: bone ${b.name} parent ${b.parent} missing`);
    for (const c of b.cubes || []) for (const [face, uv] of Object.entries(c.uv)) {
      const [u, v] = uv.uv, [w, h] = uv.uv_size;
      if (u < 0 || v < 0 || u + w > tw || v + h > th) err(`${rel(geo.file)}: ${b.name} face ${face} UV outside texture`);
      if (!['north', 'south', 'east', 'west', 'up', 'down'].includes(face)) err(`${rel(geo.file)}: bad face ${face}`);
    }
  }
  // animations referenced exist and only touch real bones
  for (const [k, id] of Object.entries(d.animations)) {
    if (!animIds.has(id)) err(`${rel(f)}: animation ${id} missing`);
  }
  for (const af of walk(path.join(RP, 'animations'), '.json')) for (const [id, a] of Object.entries(J[af].animations)) {
    if (!Object.values(d.animations).includes(id)) continue;
    for (const b of Object.keys(a.bones)) if (!bones.has(b.toLowerCase())) err(`${rel(af)}: ${id} animates unknown bone ${b}`);
  }
  // animate list entries refer to declared short names
  for (const e of d.scripts.animate) { const n = typeof e === 'string' ? e : Object.keys(e)[0]; if (!d.animations[n]) err(`${rel(f)}: animate refers to undeclared '${n}'`); }
  // render controllers exist
  const rcs = J[path.join(RP, 'render_controllers/mw.render_controllers.json')].render_controllers;
  for (const rc of d.render_controllers) if (!rcs[rc]) err(`${rel(f)}: render controller ${rc} missing`);
  // glow bones must exist for part_visibility to be meaningful
  if (![...bones.keys()].some((k) => k.startsWith('glow'))) warn(`${rel(f)}: no glow* bones`);
  // item icon
  const key = itemIds.includes(d.identifier) ? 'mw_' + d.identifier.split(':')[1] : null;
  if (key && !itemTex[key]) err(`item texture key ${key} missing in item_texture.json`);
  if (key && !fs.existsSync(path.join(RP, itemTex[key].textures + '.png'))) err(`icon file for ${key} missing`);
  else if (key) { const [iw, ih] = pngSize(path.join(RP, itemTex[key].textures + '.png')); if (iw !== 16 || ih !== 16) warn(`icon ${key} is ${iw}x${ih}`); }
}
ok('attachables, geometry, textures, animations and icons cross-checked');

// ------------------------------------------------------------------ 6. manifests + scripts
console.log('\n[6] Manifests and scripts');
const bpm = J[path.join(BP, 'manifest.json')], rpm = J[path.join(RP, 'manifest.json')];
const uuids = [bpm.header.uuid, ...bpm.modules.map((m) => m.uuid), rpm.header.uuid, ...rpm.modules.map((m) => m.uuid)];
if (new Set(uuids).size !== uuids.length) err('duplicate UUIDs in manifests');
if (!bpm.dependencies.some((d) => d.uuid === rpm.header.uuid)) err('BP does not depend on RP');
const sm = bpm.dependencies.find((d) => d.module_name === '@minecraft/server');
if (!sm || sm.version !== '1.11.0') err('script module dependency missing/unexpected');
const entry = bpm.modules.find((m) => m.type === 'script').entry;
if (!fs.existsSync(path.join(BP, entry))) err(`script entry ${entry} missing`);
const soundDefs = Object.keys(JSON.parse(fs.readFileSync(path.join(SAMPLES, 'resource_pack/sounds/sound_definitions.json'), 'utf8')).sound_definitions || {});
const sdSet = new Set(soundDefs.length ? soundDefs : Object.keys(JSON.parse(fs.readFileSync(path.join(SAMPLES, 'resource_pack/sounds/sound_definitions.json'), 'utf8'))));
const particleIds = new Set();
for (const f of walk(path.join(SAMPLES, 'resource_pack/particles'), '.json')) { try { particleIds.add(JSON.parse(fs.readFileSync(f, 'utf8')).particle_effect.description.identifier); } catch { /* skip */ } }
// Script API surface: only what @minecraft/server 1.11.0 (the module version the manifest asks for) offers, taken
// from Mojang's own metadata for this build. Anything beta-only would fail to load without the Beta APIs experiment.
const apiMeta = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'metadata/script_modules/@minecraft/server_1.11.0.json'), 'utf8'));
const stableTop = new Set([...apiMeta.classes, ...apiMeta.interfaces, ...apiMeta.enums, ...apiMeta.objects, ...apiMeta.constants, ...apiMeta.functions].map((x) => x.name));
const membersOf = (cls) => {
  const c = apiMeta.classes.find((k) => k.name === cls) || {};
  return new Set([...(c.properties || []), ...(c.functions || []), ...(c.constants || [])].map((x) => x.name));
};
const EVENT_HOLDERS = { 'world.afterEvents': 'WorldAfterEvents', 'world.beforeEvents': 'WorldBeforeEvents', 'system.afterEvents': 'SystemAfterEvents', 'system.beforeEvents': 'SystemBeforeEvents' };
const jsFiles = walk(path.join(BP, 'scripts'), '.js');
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/sfx\([^;]*?'([a-z_.0-9]+)'/g)) if (!sdSet.has(m[1])) err(`${rel(f)}: sound '${m[1]}' not in this build's sound definitions`);
  for (const m of src.matchAll(/'(minecraft:[a-z_0-9]+)'/g)) { const id = m[1]; if (/particle|emitter|endrod|large_explosion|dust_plume|smash_ground|soul_particle|electric_spark|falling_dust|basic_|glow/.test(id) && !particleIds.has(id)) err(`${rel(f)}: particle '${id}' not found in vanilla particle files`); }
  for (const m of src.matchAll(/from '(\.\/[a-z_]+\.js)'/g)) if (!fs.existsSync(path.join(path.dirname(f), m[1]))) err(`${rel(f)}: import ${m[1]} missing`);
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@minecraft\/server'/g)) {
    for (const name of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!stableTop.has(name)) err(`${rel(f)}: ${name} is not exported by @minecraft/server 1.11.0`);
  }
  for (const m of src.matchAll(/\b(world|system)\.(afterEvents|beforeEvents)\.([A-Za-z]+)/g)) {
    const holder = EVENT_HOLDERS[`${m[1]}.${m[2]}`];
    if (!membersOf(holder).has(m[3])) err(`${rel(f)}: ${m[1]}.${m[2]}.${m[3]} does not exist in @minecraft/server 1.11.0 (beta-only?)`);
  }
  for (const [obj, cls] of [['world', 'World'], ['system', 'System']]) {
    for (const m of src.matchAll(new RegExp(`\\b${obj}\\.([A-Za-z]+)`, 'g'))) if (!membersOf(cls).has(m[1])) err(`${rel(f)}: ${obj}.${m[1]} does not exist in @minecraft/server 1.11.0 (beta-only?)`);
  }
}
ok(`scripts checked (${jsFiles.length} files); ${sdSet.size} sounds and ${particleIds.size} particles known`);

console.log(`\n${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);

#!/usr/bin/env node
// Mechanical verification that SCP096_BP/scripts/main.js only uses API that exists in the
// STABLE @minecraft/server 1.11.0 module, and when each member first became stable.
//
// Evidence source: Mojang's script_modules metadata (bedrock-samples, tag v1.21.0.3).
//   MOJANG_SAMPLES=/path/to/bedrock-samples node tools/typecheck/verify_api.mjs [--out DIR]
//
// Checks
//   1. main.js parses as an ES2019 module (acorn) - no optional chaining / nullish coalescing /
//      class fields / top-level await, no TypeScript syntax.
//   2. The only import is `import { world, system } from "@minecraft/server"`; no require(),
//      no dynamic import().
//   3. Every `.member` token in the code (comments and strings removed) is classified as
//      API (must exist in server_1.11.0.json with the right kind), JS built-in, or local
//      property. An unclassified token fails the check, so new API use cannot slip in unreviewed.
//   4. For every API member: first STABLE module version (server_*.json without "-beta").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON = path.resolve(HERE, "..", "..");
const MAIN = process.env.SCP096_MAIN ? path.resolve(process.env.SCP096_MAIN) : path.join(ADDON, "SCP096_BP", "scripts", "main.js");
const SAMPLES = process.env.MOJANG_SAMPLES || "/home/user/mojang/bedrock-samples";
const SCRIPT_MODULES = path.join(SAMPLES, "metadata", "script_modules", "@minecraft");

/** API members main.js is allowed to use: [class, member, kind, how it is used]. */
export const API_USED = [
  ["System", "runInterval", "function", "registers the pass callback (every 3 ticks)"],
  ["World", "gameRules", "property", "read mobGriefing"],
  ["World", "getDimension", "function", "overworld / nether / the_end"],
  ["GameRules", "mobGriefing", "property", "respect the game rule"],
  ["Dimension", "getEntities", "function", "{ type: 'scp:scp096' } query"],
  ["Dimension", "getBlock", "function", "probe box cells"],
  ["Dimension", "runCommand", "function", "setblock x y z air destroy"],
  ["Entity", "isValid", "function", "skip removed entities"],
  ["Entity", "location", "property", "feet position"],
  ["Entity", "getViewDirection", "function", "heading"],
  ["Entity", "getComponent", "function", "minecraft:variant"],
  ["EntityVariantComponent", "value", "property", "state number (3 = rage run)"],
  ["Block", "typeId", "property", "allow/deny decision"],
  ["Block", "setType", "function", "fallback when the command fails"],
  ["Block", "isAir", "property", "skip air without further calls (stable on preview 26)"],
  ["Block", "isLiquid", "property", "skip liquids (stable on preview 26)"],
  ["Block", "getItemStack", "function", "block id fallback via ItemStack.typeId when Block.typeId is Beta-only (stable on preview 26)"],
  ["ItemStack", "typeId", "property", "item id used as block id fallback"],
  ["CommandResult", "successCount", "property", "command success"],
  ["Vector3", "x", "property", "block / entity coordinates"],
  ["Vector3", "y", "property", "block / entity coordinates"],
  ["Vector3", "z", "property", "block / entity coordinates"],
];

/** `.name` tokens that are plain JavaScript built-ins (not Minecraft API). */
const JS_BUILTIN_MEMBERS = new Set([
  "freeze", "concat", "map", "has", "add", "sort", "endsWith", "test", "warn", "hypot", "floor",
  "ceil", "min", "abs", "isFinite", "length", "push", "name", "message", "constructor",
]);
/** `.name` tokens that are properties of main.js's own objects (PROBE, LIMITS, cells, ...). */
const LOCAL_MEMBERS = new Set([
  "forward", "lateral", "halfWidth", "minForward", "maxForward", "height", "feetEpsilon",
  "minHorizontalView",
  "maxBreaksPerEntity", "maxBreaksPerPass", "maxRagingEntitiesPerPass",
  "maxEntitiesExaminedPerDimension",
]);

function versionKey(file) {
  const m = /server_(\d+)\.(\d+)\.(\d+)\.json$/.exec(file);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function cmp(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function loadModules() {
  const files = fs
    .readdirSync(SCRIPT_MODULES)
    .filter((f) => /^server_\d+\.\d+\.\d+\.json$/.test(f)) // stable only: no "-beta"
    .sort((a, b) => cmp(versionKey(a), versionKey(b)));
  return files.map((f) => ({
    version: f.replace(/^server_/, "").replace(/\.json$/, ""),
    json: JSON.parse(fs.readFileSync(path.join(SCRIPT_MODULES, f), "utf8")),
  }));
}

function findMember(json, className, member, kind) {
  const pools = [json.classes, json.interfaces];
  for (const pool of pools) {
    const c = (pool || []).find((x) => x.name === className);
    if (!c) continue;
    const list = kind === "function" ? c.functions || [] : c.properties || [];
    const m = list.find((x) => x.name === member);
    if (m) return { owner: c, member: m };
    // inherited from base types (e.g. EntityVariantComponent -> EntityComponent)
    for (const base of c.base_types || []) {
      const r = findMember(json, base.name, member, kind);
      if (r) return r;
    }
  }
  return null;
}

/** Strips comments and string/template literal contents so only code tokens remain. */
function codeOnly(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      i++;
      out += '""';
    } else if (c === "`") {
      // keep ${...} expressions (they are code), drop the literal text
      i++;
      out += '""';
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") {
          i += 2;
        } else if (src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          out += " ";
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            if (src[i] === "}") depth--;
            if (depth > 0) out += src[i];
            i++;
          }
          out += " ";
        } else {
          i++;
        }
      }
      i++;
    } else if (c === "/" && d !== "/" && d !== "*" && regexAllowedAfter(out)) {
      // regular expression literal
      i++;
      while (i < n && src[i] !== "/" && src[i] !== "\n") i += src[i] === "\\" ? 2 : src[i] === "[" ? skipClass(src, i) : 1;
      i++;
      while (/[a-z]/.test(src[i] || "")) i++;
      out += "/re/";
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
/** A `/` starts a regular expression literal when the previous token cannot end an operand. */
function regexAllowedAfter(out) {
  const prev = out.replace(/\s+$/, "");
  return prev === "" || /[=(,:;!&|?{}]$/.test(prev) || /\breturn$/.test(prev);
}
function skipClass(src, i) {
  let j = i + 1;
  while (j < src.length && src[j] !== "]") j += src[j] === "\\" ? 2 : 1;
  return j - i + 1;
}

export async function verifyApi() {
  const lines = [];
  const failures = [];
  const say = (s = "") => lines.push(s);
  const fail = (s) => {
    failures.push(s);
    say("  FAIL: " + s);
  };

  if (!fs.existsSync(SCRIPT_MODULES)) {
    fail(`metadata not found: ${SCRIPT_MODULES} (set MOJANG_SAMPLES)`);
    return { lines, failures, table: [] };
  }
  const src = fs.readFileSync(MAIN, "utf8");
  const mods = loadModules();
  const m111 = mods.find((m) => m.version === "1.11.0");
  say("== API verification of SCP096_BP/scripts/main.js against @minecraft/server 1.11.0 ==");
  say(`metadata: ${SCRIPT_MODULES} (stable modules: ${mods.map((m) => m.version).join(", ")})`);
  say(`module json: version=${m111.json.version} minecraft_version=${m111.json.minecraft_version}`);

  // 1. syntax level
  say("");
  say("-- 1. syntax level (acorn, ecmaVersion 2019, sourceType module) --");
  const require = createRequire(import.meta.url);
  const acorn = require("acorn");
  let ast = null;
  try {
    ast = acorn.parse(src, { ecmaVersion: 2019, sourceType: "module" });
    say("  parses as ES2019 module: OK");
  } catch (e) {
    fail("does not parse as ES2019 module: " + e.message);
  }

  // 2. imports
  say("");
  say("-- 2. imports --");
  if (ast) {
    const imports = ast.body.filter((n) => n.type === "ImportDeclaration");
    const spec = imports.map((n) => `${n.source.value}: {${n.specifiers.map((s) => s.imported ? s.imported.name : s.type).join(", ")}}`);
    say("  " + spec.join("; "));
    if (imports.length !== 1 || imports[0].source.value !== "@minecraft/server") {
      fail("expected exactly one import, from @minecraft/server");
    }
    const names = imports.length ? imports[0].specifiers.map((s) => s.imported && s.imported.name) : [];
    if (names.sort().join() !== "system,world") fail("expected import { world, system }, got " + names.join());
  }
  const code = codeOnly(src);
  if (/\brequire\s*\(/.test(code)) fail("require() used");
  if (/\bimport\s*\(/.test(code)) fail("dynamic import() used");

  // 3. member tokens
  say("");
  say("-- 3. every .member token in the code is classified --");
  const tokens = new Map();
  for (const m of code.matchAll(/\.([A-Za-z_$][\w$]*)/g)) tokens.set(m[1], (tokens.get(m[1]) || 0) + 1);
  const apiNames = new Set(API_USED.map((a) => a[1]));
  const unclassified = [];
  for (const [name] of tokens) {
    if (apiNames.has(name) || JS_BUILTIN_MEMBERS.has(name) || LOCAL_MEMBERS.has(name)) continue;
    unclassified.push(name);
  }
  say(`  distinct .member tokens: ${tokens.size}`);
  say(`  API:      ${[...tokens.keys()].filter((t) => apiNames.has(t)).sort().join(", ")}`);
  say(`  built-in: ${[...tokens.keys()].filter((t) => JS_BUILTIN_MEMBERS.has(t) && !apiNames.has(t)).sort().join(", ")}`);
  say(`  local:    ${[...tokens.keys()].filter((t) => LOCAL_MEMBERS.has(t) && !apiNames.has(t)).sort().join(", ")}`);
  if (unclassified.length) fail("unclassified member tokens (review them!): " + unclassified.join(", "));
  else say("  unclassified: none");
  for (const a of API_USED) {
    if (!tokens.has(a[1]) && a[0] !== "Vector3") say(`  note: ${a[0]}.${a[1]} is declared as used but does not appear as a .member token`);
  }
  // identifiers used as bare globals
  const globalsUsed = ["world", "system", "console"].filter((g) => new RegExp(`\\b${g}\\b`).test(code));
  say(`  bare globals/imports used: ${globalsUsed.join(", ")}`);

  // 4. existence + first stable version
  say("");
  say("-- 4. existence in 1.11.0 and first stable module version --");
  const table = [];
  for (const [cls, member, kind, use] of API_USED) {
    const inLatest = findMember(m111.json, cls, member, kind);
    let first = null;
    for (const m of mods) {
      if (findMember(m.json, cls, member, kind)) {
        first = m.version;
        break;
      }
    }
    // Block.typeId: stable only from 1.11.0 (Block.id earlier). Report what the data says.
    const row = { cls, member, kind, use, exists111: !!inLatest, firstStable: first };
    table.push(row);
    say(`  ${(cls + "." + member).padEnd(34)} ${kind.padEnd(9)} exists in 1.11.0: ${inLatest ? "yes" : "NO "}  first stable: ${first || "-"}   (${use})`);
    if (!inLatest) fail(`${cls}.${member} (${kind}) is not in @minecraft/server 1.11.0`);
  }
  // privilege / error notes straight from the metadata
  say("");
  say("-- 5. privilege + error notes from the metadata (1.11.0) --");
  for (const [cls, fn] of [["Dimension", "getBlock"], ["Dimension", "runCommand"], ["Block", "setType"], ["Dimension", "getEntities"], ["System", "runInterval"], ["Entity", "getViewDirection"]]) {
    const hit = findMember(m111.json, cls, fn, "function");
    if (!hit) continue;
    const rt = hit.member.return_type || {};
    const errs = (rt.error_types || []).map((e) => e.name).join(", ") || "-";
    say(`  ${cls}.${fn}: privilege=${hit.member.privilege} throws=[${errs}]`);
  }
  const dep = (m111.json.dependencies || []).map((d) => `${d.name}@${d.version}`).join(", ");
  say(`  module dependencies declared by 1.11.0 metadata: ${dep}`);
  say("");
  say(failures.length ? `RESULT: FAIL (${failures.length})` : "RESULT: PASS");
  return { lines, failures, table };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { lines, failures } = await verifyApi();
  console.log(lines.join("\n"));
  const i = process.argv.indexOf("--out");
  if (i >= 0) {
    const dir = path.resolve(process.argv[i + 1]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "api_verification.txt"), lines.join("\n") + "\n");
  }
  process.exit(failures.length ? 1 : 0);
}

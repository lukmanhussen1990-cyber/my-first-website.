#!/usr/bin/env python3
"""Cross-check the add-on scripts against @minecraft/server 1.10.0 as shipped in Bedrock 1.21.0.26.

Source of truth: bedrock-samples tag v1.21.0.26-preview,
metadata/script_modules/@minecraft/server_1.10.0.json (override with --meta).

Checks
  1. every name imported from '@minecraft/server' is exported by 1.10.0
  2. world.afterEvents.X / world.beforeEvents.X / system.afterEvents.X exist in 1.10.0
  3. every called member `.name(` is a 1.10.0 class/interface function, a JavaScript built-in
     method, or a function/method defined in the add-on's own scripts
  4. members known to exist only in newer/beta versions are not used at all
  5. enum members used as Enum.Member exist (GameMode, EquipmentSlot, EntityDamageCause, ...)
Exit code 0 when clean.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "packs", "GiantSpiderHunter_BP", "scripts")
META = "/tmp/claude-0/scratch/bedrock-samples/metadata/script_modules/@minecraft/server_1.10.0.json"
if "--meta" in sys.argv:
    META = sys.argv[sys.argv.index("--meta") + 1]

JS_BUILTIN_METHODS = {
    # Object / Array / Map / Set / String / Number / Math / JSON / Promise / console / RegExp
    "push", "pop", "shift", "unshift", "slice", "splice", "map", "filter", "forEach", "find", "findIndex",
    "some", "every", "reduce", "includes", "indexOf", "join", "sort", "concat", "keys", "values", "entries",
    "get", "set", "has", "delete", "clear", "add", "split", "trim", "toLowerCase", "toUpperCase", "replace",
    "startsWith", "endsWith", "padStart", "toFixed", "test", "exec", "match", "then", "catch", "finally",
    "log", "warn", "error", "info", "stringify", "parse", "assign", "freeze", "fromEntries", "isArray",
    "isFinite", "isInteger", "floor", "ceil", "round", "abs", "min", "max", "sqrt", "atan2", "sin", "cos",
    "acos", "asin", "hypot", "sign", "random", "pow", "trunc", "call", "apply", "bind", "toString", "fill",
    "flat", "flatMap", "reverse", "at", "charAt", "substring", "lastIndexOf", "localeCompare",
}

# Members that are NOT in 1.10.0 (newer stable or beta) and must never appear as calls/accesses.
FORBIDDEN = {
    "getGameMode": "Player.getGameMode is 1.11.0+ (use player.matches({gameMode}))",
    "setGameMode": "Player.setGameMode is 1.11.0+ (use a command)",
    "getDifficulty": "World.getDifficulty does not exist in 1.10.0",
    "getTopmostBlock": "Dimension.getTopmostBlock is beta in 1.21.0",
    "findClosestBiome": "beta only (and crashes BDS 1.21.0.26)",
    "gameRules": "World.gameRules is 1.11.0+",
    "getItemCooldown": "1.11.0+",
    "startItemCooldown": "1.11.0+",
    "isSolid": "Block.isSolid is beta",
    "getEntitiesInBox": "not in 1.10.0",
}


def load_meta():
    with open(META) as fh:
        d = json.load(fh)
    funcs, props, classes = set(), set(), {}
    for c in d["classes"]:
        names = set()
        for f in c.get("functions", []):
            funcs.add(f["name"])
            names.add(f["name"])
        for p in c.get("properties", []):
            props.add(p["name"])
            names.add(p["name"])
        classes[c["name"]] = names
    for i in d["interfaces"]:
        for p in i.get("properties", []):
            props.add(p["name"])
    exports = set(classes) | {e["name"] for e in d["enums"]} | {o["name"] for o in d.get("objects", [])}
    exports |= {c["name"] for c in d.get("constants", [])} | {i["name"] for i in d["interfaces"]}
    enums = {e["name"]: {c["name"] for c in e["constants"]} for e in d["enums"]}
    return funcs, props, classes, exports, enums


def main():
    funcs, props, classes, exports, enums = load_meta()
    errors = []
    files = sorted(f for f in os.listdir(SCRIPTS) if f.endswith(".js"))
    sources = {f: open(os.path.join(SCRIPTS, f), encoding="utf-8").read() for f in files}
    # own definitions: functions, methods, exported names
    own = set()
    for src in sources.values():
        own |= set(re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)", src))
        own |= set(re.findall(r"^\s+(?:static\s+|async\s+|get\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{", src, re.M))
        own |= set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>", src))
        own |= set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>", src))
    used_calls = set()
    for f, src in sources.items():
        code = re.sub(r"//[^\n]*", "", src)
        code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
        code_nostr = re.sub(r"`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|\"(?:\\.|[^\"])*\"", "''", code)
        for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*'@minecraft/server'", code):
            for name in [n.strip().split(" as ")[0] for n in m.group(1).split(",") if n.strip()]:
                if name not in exports:
                    errors.append(f"{f}: '{name}' is not exported by @minecraft/server 1.10.0")
        for m in re.finditer(r"from\s*'(@minecraft/[^']+)'", code):
            if m.group(1) != "@minecraft/server":
                errors.append(f"{f}: imports {m.group(1)} (only @minecraft/server 1.10.0 is a dependency)")
        for obj, cls in (("world.afterEvents", "WorldAfterEvents"), ("world.beforeEvents", "WorldBeforeEvents"),
                         ("system.afterEvents", "SystemAfterEvents")):
            for m in re.finditer(re.escape(obj) + r"\.([A-Za-z_]\w*)", code_nostr):
                if m.group(1) not in classes.get(cls, set()):
                    errors.append(f"{f}: {obj}.{m.group(1)} does not exist in 1.10.0")
        for m in re.finditer(r"\bsystem\.([A-Za-z_]\w*)", code_nostr):
            if m.group(1) not in classes["System"]:
                errors.append(f"{f}: system.{m.group(1)} does not exist in 1.10.0")
        for m in re.finditer(r"\bworld\.([A-Za-z_]\w*)", code_nostr):
            if m.group(1) not in classes["World"]:
                errors.append(f"{f}: world.{m.group(1)} does not exist in 1.10.0")
        for m in re.finditer(r"\.([A-Za-z_$][\w$]*)\s*\(", code_nostr):
            name = m.group(1)
            used_calls.add(name)
            if name in funcs or name in JS_BUILTIN_METHODS or name in own:
                continue
            errors.append(f"{f}: call .{name}() is not a 1.10.0 API, a JS built-in or an own function")
        for name, why in FORBIDDEN.items():
            if re.search(r"\." + re.escape(name) + r"\b", code_nostr):
                errors.append(f"{f}: uses {name}: {why}")
        for m in re.finditer(r"\b([A-Z][A-Za-z]+)\.([A-Za-z_]\w*)", code_nostr):
            en, member = m.group(1), m.group(2)
            if en in enums and member not in enums[en]:
                errors.append(f"{f}: {en}.{member} is not a member of enum {en} in 1.10.0")
    api_calls = sorted(n for n in used_calls if n in funcs and n not in JS_BUILTIN_METHODS)
    print(f"checked {len(files)} files against {os.path.basename(META)}; engine calls used: {', '.join(api_calls)}")
    for e in errors:
        print("ERROR", e)
    print("OK" if not errors else f"{len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
The Hollow Bride - pre-ship validator.

Checks the things a Bedrock content log would otherwise shout about, plus the
mobile performance budget:

  * every .json parses, with no trailing commas or comments
  * the six UUIDs are unique and RFC 4122 version 4
  * format_version is exactly what the spec calls for, per file type
  * every namespaced block / item / entity has an en_US.lang entry
  * every block and item carries a menu_category
  * every texture short name referenced resolves to a PNG on disk
  * no texture above 128x128; entities capped at 64x64
  * nothing uses the minecraft: namespace for custom content

Exit code is non-zero if anything fails.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "BP")
RP = os.path.join(ROOT, "RP")

errors = []
warnings = []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # noqa: BLE001 - report anything at all
        fail("%s: %s" % (os.path.relpath(path, ROOT), exc))
        return None


def walk(root, suffix=".json"):
    for base, _dirs, files in os.walk(root):
        for name in sorted(files):
            if name.endswith(suffix):
                yield os.path.join(base, name)


# ---- manifests --------------------------------------------------------------

UUID_V4 = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)

seen_uuids = {}
for pack in (BP, RP):
    mf = load(os.path.join(pack, "manifest.json"))
    if not mf:
        continue
    label = os.path.basename(pack)
    if mf.get("format_version") != 2:
        fail("%s/manifest.json: format_version must be 2" % label)
    ids = [mf["header"]["uuid"]] + [m["uuid"] for m in mf.get("modules", [])]
    for u in ids:
        if not UUID_V4.match(u):
            fail("%s/manifest.json: %s is not a v4 UUID" % (label, u))
        if u in seen_uuids:
            fail("%s/manifest.json: UUID %s reused from %s" % (label, u, seen_uuids[u]))
        seen_uuids[u] = label
    if mf["header"].get("min_engine_version") != [1, 21, 0]:
        fail("%s/manifest.json: min_engine_version must be [1,21,0]" % label)

bp_manifest = load(os.path.join(BP, "manifest.json"))
rp_manifest = load(os.path.join(RP, "manifest.json"))
if bp_manifest and rp_manifest:
    deps = bp_manifest.get("dependencies", [])
    rp_uuid = rp_manifest["header"]["uuid"]
    if not any(d.get("uuid") == rp_uuid for d in deps):
        fail("BP/manifest.json: missing dependency on the RP header UUID")
    mods = {d.get("module_name"): d.get("version") for d in deps if "module_name" in d}
    if mods.get("@minecraft/server") != "1.11.0":
        fail("BP/manifest.json: @minecraft/server must be 1.11.0")
    if mods.get("@minecraft/server-ui") != "1.2.0":
        fail("BP/manifest.json: @minecraft/server-ui must be 1.2.0")
    script_mods = [m for m in bp_manifest["modules"] if m.get("type") == "script"]
    if len(script_mods) != 1:
        fail("BP/manifest.json: expected exactly one script module")
    elif script_mods[0].get("entry") != "scripts/main.js":
        fail("BP/manifest.json: script entry must be scripts/main.js")

# ---- format versions --------------------------------------------------------

EXPECTED = [
    (os.path.join(BP, "entities"), "minecraft:entity", "1.21.0"),
    (os.path.join(BP, "blocks"), "minecraft:block", "1.21.0"),
    (os.path.join(BP, "items"), "minecraft:item", "1.21.0"),
    (os.path.join(BP, "dialogue"), "minecraft:npc_dialogue", "1.17.0"),
    (os.path.join(RP, "entity"), "minecraft:client_entity", "1.10.0"),
    (os.path.join(RP, "models"), "minecraft:geometry", "1.16.0"),
    (os.path.join(RP, "animations"), "animations", "1.8.0"),
    (os.path.join(RP, "animation_controllers"), "animation_controllers", "1.10.0"),
    (os.path.join(RP, "render_controllers"), "render_controllers", "1.10.0"),
    (os.path.join(RP, "particles"), "particle_effect", "1.10.0"),
    (os.path.join(RP, "fogs"), "minecraft:fog_settings", "1.16.100"),
]

for folder, key, want in EXPECTED:
    if not os.path.isdir(folder):
        fail("missing folder %s" % os.path.relpath(folder, ROOT))
        continue
    for path in walk(folder):
        doc = load(path)
        if doc is None:
            continue
        got = doc.get("format_version")
        if got != want:
            fail(
                "%s: format_version %r, expected %r"
                % (os.path.relpath(path, ROOT), got, want)
            )
        if key not in doc:
            fail("%s: missing top level key %s" % (os.path.relpath(path, ROOT), key))

sd = load(os.path.join(RP, "sounds", "sound_definitions.json"))
if sd and sd.get("format_version") != "1.14.0":
    fail("RP/sounds/sound_definitions.json: format_version must be 1.14.0")

# ---- identifiers, menu categories, lang -------------------------------------

lang_path = os.path.join(BP, "texts", "en_US.lang")
lang_keys = set()
if os.path.isfile(lang_path):
    with open(lang_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            lang_keys.add(line.split("=", 1)[0].strip())
else:
    fail("missing BP/texts/en_US.lang")

block_ids = []
item_ids = []
entity_ids = []

for path in walk(os.path.join(BP, "blocks")):
    doc = load(path) or {}
    desc = doc.get("minecraft:block", {}).get("description", {})
    ident = desc.get("identifier", "")
    block_ids.append(ident)
    if not ident.startswith("ag:"):
        fail("%s: identifier %r must use the ag: namespace" % (path, ident))
    if "menu_category" not in desc:
        fail("%s: block %s has no menu_category" % (os.path.basename(path), ident))
    if ("tile.%s.name" % ident) not in lang_keys:
        fail("no lang entry tile.%s.name" % ident)

for path in walk(os.path.join(BP, "items")):
    doc = load(path) or {}
    desc = doc.get("minecraft:item", {}).get("description", {})
    ident = desc.get("identifier", "")
    item_ids.append(ident)
    if not ident.startswith("ag:"):
        fail("%s: identifier %r must use the ag: namespace" % (path, ident))
    if "menu_category" not in desc:
        fail("%s: item %s has no menu_category" % (os.path.basename(path), ident))
    if ("item.%s.name" % ident) not in lang_keys:
        fail("no lang entry item.%s.name" % ident)

for path in walk(os.path.join(BP, "entities")):
    doc = load(path) or {}
    ident = doc.get("minecraft:entity", {}).get("description", {}).get("identifier", "")
    entity_ids.append(ident)
    if not ident.startswith("ag:"):
        fail("%s: identifier %r must use the ag: namespace" % (path, ident))
    if ("entity.%s.name" % ident) not in lang_keys:
        fail("no lang entry entity.%s.name" % ident)

if len(entity_ids) > 8:
    fail("%d custom entities defined; the budget is 8" % len(entity_ids))

# ---- textures ---------------------------------------------------------------


def texture_map(path, kind):
    doc = load(path)
    if not doc:
        return {}
    return doc.get("texture_data", {})


short_to_file = {}
for tj, kind in (
    (os.path.join(RP, "textures", "terrain_texture.json"), "block"),
    (os.path.join(RP, "textures", "item_texture.json"), "item"),
):
    for short, entry in texture_map(tj, kind).items():
        tex = entry.get("textures")
        if isinstance(tex, list):
            tex = tex[0]
        short_to_file[short] = tex
        png = os.path.join(RP, tex + ".png")
        if not os.path.isfile(png):
            fail("%s references %s.png which does not exist" % (short, tex))

referenced = set()
for path in walk(os.path.join(BP, "blocks")):
    raw = open(path, encoding="utf-8").read()
    for m in re.finditer(r'"texture"\s*:\s*"([^"]+)"', raw):
        referenced.add(m.group(1))
for path in walk(os.path.join(BP, "items")):
    raw = open(path, encoding="utf-8").read()
    for m in re.finditer(r'"texture"\s*:\s*"([^"]+)"', raw):
        referenced.add(m.group(1))

for short in sorted(referenced):
    if short not in short_to_file:
        fail("texture short name %r is not registered in an atlas json" % short)

try:
    from PIL import Image

    for base, _dirs, files in os.walk(os.path.join(RP, "textures")):
        for name in files:
            if not name.endswith(".png"):
                continue
            full = os.path.join(base, name)
            with Image.open(full) as im:
                w, h = im.size
            rel = os.path.relpath(full, ROOT)
            if w > 128 or h > 128:
                fail("%s is %dx%d, over the 128 cap" % (rel, w, h))
            if os.sep + "entity" + os.sep in full and (w > 64 or h > 64):
                fail("%s is %dx%d, over the 64 entity cap" % (rel, w, h))
except ImportError:
    warn("Pillow not installed; skipped texture size checks")

# ---- resource pack size -----------------------------------------------------

rp_bytes = 0
for base, _dirs, files in os.walk(RP):
    for name in files:
        rp_bytes += os.path.getsize(os.path.join(base, name))
if rp_bytes > 20 * 1048576:
    fail("resource pack is %.1f MB, over the 20 MB budget" % (rp_bytes / 1048576.0))

# ---- fog: distance only -----------------------------------------------------

for path in walk(os.path.join(RP, "fogs")):
    doc = load(path) or {}
    settings = doc.get("minecraft:fog_settings", {})
    if "volumetric" in settings:
        fail("%s declares volumetric fog" % os.path.relpath(path, ROOT))

# ---- particles: emitter and lifetime caps -----------------------------------

for path in walk(os.path.join(RP, "particles")):
    doc = load(path) or {}
    comps = doc.get("particle_effect", {}).get("components", {})
    inst = comps.get("minecraft:emitter_rate_instant", {})
    n = inst.get("num_particles", 0)
    if n > 30:
        fail("%s emits %d particles, cap is 30" % (os.path.relpath(path, ROOT), n))
    life = comps.get("minecraft:particle_lifetime_expression", {}).get("max_lifetime", 0)
    if isinstance(life, (int, float)) and life > 3:
        fail("%s particle lifetime %.1fs, cap is 3s" % (os.path.relpath(path, ROOT), life))
    if "minecraft:emitter_lifetime_looping" in comps:
        warn("%s uses a looping emitter" % os.path.relpath(path, ROOT))

# ---- mcfunction command budget ----------------------------------------------

for base in (os.path.join(BP, "functions", "ag_build"), os.path.join(BP, "functions", "ag_ruin")):
    for path in walk(base, ".mcfunction"):
        with open(path, encoding="utf-8") as fh:
            cmds = [
                line.strip()
                for line in fh
                if line.strip() and not line.strip().startswith("#")
            ]
        if len(cmds) > 300:
            fail(
                "%s has %d commands, cap is 300"
                % (os.path.relpath(path, ROOT), len(cmds))
            )

# ---- scripts: no banned Java-isms -------------------------------------------

BANNED = ["execute if data", "/data ", "scoreboard objectives", "tick.json"]
for path in walk(os.path.join(BP, "scripts"), ".js"):
    raw = open(path, encoding="utf-8").read()
    for token in BANNED:
        if token in raw:
            fail("%s contains banned construct %r" % (os.path.relpath(path, ROOT), token))

# ---- report -----------------------------------------------------------------

for w in warnings:
    print("WARN  " + w)
for e in errors:
    print("FAIL  " + e)

print()
print(
    "blocks=%d items=%d entities=%d textures_ok=%d rp=%.2fMB"
    % (
        len(block_ids),
        len(item_ids),
        len(entity_ids),
        len(short_to_file),
        rp_bytes / 1048576.0,
    )
)
print("%d error(s), %d warning(s)" % (len(errors), len(warnings)))
sys.exit(1 if errors else 0)

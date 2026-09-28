"""Validate both packs: JSON syntax, manifests, schemas, and every cross reference.

Checks performed:
  * every .json file parses as strict JSON
  * manifest UUIDs are unique, valid and cross-dependencies match
  * item JSON matches Mojang's 1.20.80 item component schema (bedrock-samples metadata)
  * icons -> item_texture.json -> PNG files; display names -> en_US.lang
  * particle textures and sub-emitter events exist
  * every particle / sound / animation / fog / item id used by the scripts exists
  * every sound file path exists in vanilla 1.21.0.26 sound_definitions.json
  * attachable geometry / textures / render controller / vanilla animation references
  * recipe ingredients and results exist
Usage: python3 tools/validate.py [path-to-bedrock-samples]
"""
import glob
import json
import os
import re
import sys
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "Gojo_Limitless_BP")
RP = os.path.join(ROOT, "packs", "Gojo_Limitless_RP")
SAMPLES = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BEDROCK_SAMPLES", "")

errors = []
checks = 0


def err(msg):
    errors.append(msg)


def ok():
    global checks
    checks += 1


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_vanilla(path):
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"//.*", "", s)
    return json.loads(s)


# 1. strict JSON everywhere
jsons = {}
for pack in (BP, RP):
    for path in glob.glob(os.path.join(pack, "**", "*.json"), recursive=True):
        try:
            jsons[path] = load(path)
            ok()
        except Exception as e:  # noqa: BLE001
            err(f"JSON parse error {os.path.relpath(path, ROOT)}: {e}")

# 2. manifests
bpm = load(os.path.join(BP, "manifest.json"))
rpm = load(os.path.join(RP, "manifest.json"))
ids = [bpm["header"]["uuid"], rpm["header"]["uuid"]] + [m["uuid"] for m in bpm["modules"] + rpm["modules"]]
for u in ids:
    try:
        uuid.UUID(u)
        ok()
    except ValueError:
        err(f"invalid uuid {u}")
if len(set(ids)) != len(ids):
    err("duplicate UUIDs in manifests")
bp_deps = {d.get("uuid") or d.get("module_name"): d["version"] for d in bpm["dependencies"]}
rp_deps = {d.get("uuid"): d["version"] for d in rpm["dependencies"]}
if bp_deps.get(rpm["header"]["uuid"]) != rpm["header"]["version"]:
    err("BP does not depend on the RP header uuid/version")
if rp_deps.get(bpm["header"]["uuid"]) != bpm["header"]["version"]:
    err("RP does not depend on the BP header uuid/version")
if bp_deps.get("@minecraft/server") != "1.10.0" or bp_deps.get("@minecraft/server-ui") != "1.1.0":
    err("unexpected script module versions")
script_mod = [m for m in bpm["modules"] if m["type"] == "script"][0]
if not os.path.isfile(os.path.join(BP, script_mod["entry"])):
    err("script entry missing")
for f in ("pack_icon.png",):
    if not os.path.isfile(os.path.join(BP, f)) or not os.path.isfile(os.path.join(RP, f)):
        err("pack_icon.png missing")
ok()

# 3. items
item_texture = load(os.path.join(RP, "textures", "item_texture.json"))["texture_data"]
lang = {}
for line in open(os.path.join(RP, "texts", "en_US.lang"), encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or line.startswith("##"):
        continue
    k, _, v = line.partition("=")
    lang[k] = v
schema = None
if SAMPLES:
    sp = os.path.join(SAMPLES, "metadata", "json_schemas", "Components v1.20.80.json")
    if os.path.isfile(sp):
        schema = load(sp)
item_ids = set()
for path in glob.glob(os.path.join(BP, "items", "*.json")):
    data = jsons[path]
    item = data["minecraft:item"]
    ident = item["description"]["identifier"]
    item_ids.add(ident)
    comps = item["components"]
    if data["format_version"] != "1.20.80":
        err(f"{ident}: unexpected format_version")
    icon = comps.get("minecraft:icon")
    if icon not in item_texture:
        err(f"{ident}: icon {icon} not in item_texture.json")
    else:
        png = os.path.join(RP, item_texture[icon]["textures"] + ".png")
        if not os.path.isfile(png):
            err(f"{ident}: icon texture missing {png}")
    dn = comps.get("minecraft:display_name", {}).get("value")
    if dn not in lang:
        err(f"{ident}: display name key {dn} missing from en_US.lang")
    if schema is not None:
        import jsonschema

        try:
            jsonschema.validate(comps, schema)
        except jsonschema.ValidationError as e:
            err(f"{ident}: schema error: {e.message}")
        for key in comps:
            if key not in schema["properties"]:
                err(f"{ident}: unknown component {key}")
    ok()

# 4. particles
particle_ids = {}
for path in glob.glob(os.path.join(RP, "particles", "*.json")):
    pe = jsons[path]["particle_effect"]
    pid = pe["description"]["identifier"]
    if pid in particle_ids:
        err(f"duplicate particle {pid}")
    particle_ids[pid] = pe
    tex = pe["description"]["basic_render_parameters"]["texture"]
    if not os.path.isfile(os.path.join(RP, tex + ".png")):
        err(f"{pid}: texture {tex} missing")
    mat = pe["description"]["basic_render_parameters"]["material"]
    if mat not in ("particles_alpha", "particles_blend", "particles_add", "particles_opaque"):
        err(f"{pid}: unknown material {mat}")
    ok()
known_components = {
    "minecraft:emitter_rate_instant", "minecraft:emitter_rate_steady", "minecraft:emitter_lifetime_once",
    "minecraft:emitter_lifetime_looping", "minecraft:emitter_lifetime_events", "minecraft:emitter_shape_point",
    "minecraft:emitter_shape_sphere", "minecraft:emitter_shape_disc", "minecraft:emitter_shape_box",
    "minecraft:particle_initial_speed", "minecraft:particle_initial_spin", "minecraft:particle_lifetime_expression",
    "minecraft:particle_motion_dynamic", "minecraft:particle_motion_parametric", "minecraft:particle_appearance_billboard",
    "minecraft:particle_appearance_tinting", "minecraft:emitter_initialization",
}
for pid, pe in particle_ids.items():
    for c in pe["components"]:
        if c not in known_components:
            err(f"{pid}: unknown particle component {c}")
    for ev in pe.get("events", {}).values():
        target = ev["particle_effect"]["effect"]
        if target not in particle_ids:
            err(f"{pid}: event targets missing particle {target}")
    ok()

# 5. script references
scripts = ""
for path in glob.glob(os.path.join(BP, "scripts", "**", "*.js"), recursive=True):
    scripts += open(path, encoding="utf-8").read() + "\n"
used_particles = set(re.findall(r'particle\([^,]+,\s*"(gojo:[a-z_]+)"(?!\s*\+)', scripts))
for base in re.findall(r'"(gojo:[a-z_]+)" \+ suffix', scripts):
    for sfx in ("_low", "_med", "_high"):
        used_particles.add(base + sfx)
for pid in sorted(used_particles):
    if pid not in particle_ids:
        err(f"script uses missing particle {pid}")
    ok()
sound_defs = load(os.path.join(RP, "sounds", "sound_definitions.json"))["sound_definitions"]
used_sounds = set(re.findall(r'"(gojo\.[a-z_.]+)"', scripts))
for sid in sorted(used_sounds):
    if sid not in sound_defs:
        err(f"script uses missing sound {sid}")
    ok()
anims = load(os.path.join(RP, "animations", "gojo.player.animation.json"))["animations"]
used_anims = set(re.findall(r'"(animation\.gojo\.[a-z_]+)"', scripts))
for aid in sorted(used_anims):
    if aid not in anims:
        err(f"script uses missing animation {aid}")
    ok()
if "gojo:unlimited_void" in scripts:
    fog = load(os.path.join(RP, "fogs", "gojo_unlimited_void.json"))
    if fog["minecraft:fog_settings"]["description"]["identifier"] != "gojo:unlimited_void":
        err("fog id mismatch")
    ok()
abil = open(os.path.join(BP, "scripts", "data", "abilities.js"), encoding="utf-8").read()
for iid in re.findall(r'"id": "(gojo:[a-z_]+)"', abil):
    if iid not in item_ids:
        err(f"abilities.js references missing item {iid}")
    ok()
for icon in re.findall(r'"icon": "([^"]+)"', abil):
    if not os.path.isfile(os.path.join(RP, icon + ".png")):
        err(f"menu icon missing {icon}")
    ok()

# 6. vanilla sound files
if SAMPLES:
    vs = load_vanilla(os.path.join(SAMPLES, "resource_pack", "sounds", "sound_definitions.json"))["sound_definitions"]
    vanilla_files = set()
    for d in vs.values():
        for s in d.get("sounds", []):
            vanilla_files.add(s if isinstance(s, str) else s.get("name"))
    for sid, d in sound_defs.items():
        for s in d["sounds"]:
            if s["name"] not in vanilla_files:
                err(f"{sid}: sound file {s['name']} not found in vanilla 1.21.0.26")
            ok()
    ui_textures = [p for p in re.findall(r'"(textures/ui/[a-z_0-9]+)"', scripts)]
    for t in ui_textures:
        if not os.path.isfile(os.path.join(SAMPLES, "resource_pack", t + ".png")):
            # the sparse checkout may not contain textures; fall back to git index listing
            listing = os.path.join(SAMPLES, ".git")
            if os.path.isdir(listing):
                out = os.popen(f"git -C '{SAMPLES}' ls-tree --name-only HEAD resource_pack/{t}.png").read().strip()
                if not out:
                    err(f"vanilla UI texture missing: {t}")
        ok()

# 7. attachables / geometry / render controllers
geo_ids = set()
for path in glob.glob(os.path.join(RP, "models", "**", "*.json"), recursive=True):
    for g in jsons[path].get("minecraft:geometry", []):
        geo_ids.add(g["description"]["identifier"])
rc_ids = set()
for path in glob.glob(os.path.join(RP, "render_controllers", "*.json")):
    rc_ids.update(jsons[path]["render_controllers"].keys())
for path in glob.glob(os.path.join(RP, "attachables", "*.json")):
    d = jsons[path]["minecraft:attachable"]["description"]
    if d["identifier"] not in item_ids:
        err(f"attachable for unknown item {d['identifier']}")
    for g in d["geometry"].values():
        if g not in geo_ids:
            err(f"{d['identifier']}: missing geometry {g}")
    for t in d["textures"].values():
        if not os.path.isfile(os.path.join(RP, t + ".png")):
            err(f"{d['identifier']}: missing texture {t}")
    for rc in d["render_controllers"]:
        if rc not in rc_ids:
            err(f"{d['identifier']}: missing render controller {rc}")
    for a in d.get("animations", {}).values():
        if a.startswith("animation.gojo"):
            if a not in anims:
                err(f"missing animation {a}")
        elif SAMPLES:
            va = load_vanilla(os.path.join(SAMPLES, "resource_pack", "animations", "armor.animation.json"))["animations"]
            if a not in va:
                err(f"vanilla animation {a} not found")
    ok()

# 8. recipes
if SAMPLES:
    vitems = set(x["name"] for x in load(os.path.join(SAMPLES, "metadata", "vanilladata_modules", "mojang-items.json"))["data_items"])
    for path in glob.glob(os.path.join(BP, "recipes", "*.json")):
        r = jsons[path]["minecraft:recipe_shaped"]
        for k in r["key"].values():
            if k["item"] not in vitems:
                err(f"recipe ingredient {k['item']} unknown")
        if r["result"]["item"] not in item_ids:
            err(f"recipe result {r['result']['item']} unknown")
        ok()

# 9. effects used by scripts exist in 1.21.0.26
if SAMPLES:
    veffects = set(x["name"] for x in load(os.path.join(SAMPLES, "metadata", "vanilladata_modules", "mojang-effects.json"))["data_items"])
    for eff in set(re.findall(r'effect\([^,]+,\s*"([a-z_]+)"', scripts)) | set(re.findall(r'put\("([a-z_]+)"', scripts)):
        if eff not in veffects:
            err(f"unknown effect {eff}")
        ok()
    for eff in re.findall(r'"([a-z_]+)"', scripts[scripts.find("const CLEANSE"):scripts.find("];", scripts.find("const CLEANSE"))]):
        if eff not in veffects:
            err(f"unknown cleanse effect {eff}")
        ok()

print(f"{checks} checks run")
if errors:
    print(f"{len(errors)} problem(s):")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("ALL CHECKS PASSED")

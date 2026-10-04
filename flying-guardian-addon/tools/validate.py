"""Static validation of the Flying Guardian add-on.

    python3 tools/validate.py [path-to-vanilla-bedrock-samples]

Checks that every JSON file parses strictly, and cross-references every identifier: entity ids,
geometry, textures, bones, locators, animations, controllers, particles, sounds, lang keys,
component groups, events, items, families, manifests and the script's API usage.

If a checkout of Mojang/bedrock-samples (tag v1.21.0.26-preview) is given, the add-on is also
checked against the vanilla data of that exact game version (items, families, sound files,
Molang queries, script module versions and API surface).
"""

import glob
import json
import os
import re
import sys
import uuid

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP = os.path.join(ADDON, "FlyingGuardian_BP")
RP = os.path.join(ADDON, "FlyingGuardian_RP")
VANILLA = sys.argv[1] if len(sys.argv) > 1 else None

errors = []
notes = []


def err(msg):
    errors.append(msg)


def load(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        err(f"{os.path.relpath(path, ADDON)}: invalid JSON: {e}")
        return None


def vload(path):
    """Vanilla files may contain // comments."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(re.sub(r"(?<!:)//.*", "", text))


# ---------------------------------------------------------------------------------------------
# 1. Every JSON file must parse strictly
# ---------------------------------------------------------------------------------------------
all_json = {}
for path in glob.glob(os.path.join(ADDON, "FlyingGuardian_*", "**", "*.json"), recursive=True):
    data = load(path)
    if data is not None:
        all_json[os.path.relpath(path, ADDON)] = data

# ---------------------------------------------------------------------------------------------
# 2. Manifests
# ---------------------------------------------------------------------------------------------
bp_man = all_json["FlyingGuardian_BP/manifest.json"]
rp_man = all_json["FlyingGuardian_RP/manifest.json"]
uuids = [bp_man["header"]["uuid"], rp_man["header"]["uuid"]] + [m["uuid"] for m in bp_man["modules"] + rp_man["modules"]]
for u in uuids:
    uuid.UUID(u)
if len(set(uuids)) != len(uuids):
    err("manifest UUIDs are not unique")
dep_uuids = [d["uuid"] for d in bp_man["dependencies"] if "uuid" in d]
if rp_man["header"]["uuid"] not in dep_uuids:
    err("behavior pack does not depend on the resource pack")
script_mods = [m for m in bp_man["modules"] if m["type"] == "script"]
script_deps = {d["module_name"]: d["version"] for d in bp_man["dependencies"] if "module_name" in d}
for m in script_mods:
    if not os.path.exists(os.path.join(BP, m["entry"])):
        err(f"script entry {m['entry']} missing")
for man in (bp_man, rp_man):
    if man["header"]["min_engine_version"] > [1, 21, 0]:
        err("min_engine_version is newer than 1.21.0")

# ---------------------------------------------------------------------------------------------
# 3. Behavior entity
# ---------------------------------------------------------------------------------------------
ENTITY_ID = "fguard:flying_guardian"
ent = all_json["FlyingGuardian_BP/entities/flying_guardian.json"]["minecraft:entity"]
if ent["description"]["identifier"] != ENTITY_ID:
    err("BP entity identifier mismatch")
groups = ent["component_groups"]
events = ent["events"]
properties = ent["description"].get("properties", {})


def walk(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield path + "/" + k, k, v
            yield from walk(v, path + "/" + k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")


for name, ev in events.items():
    for op in ("add", "remove"):
        for g in ev.get(op, {}).get("component_groups", []):
            if g not in groups:
                err(f"event {name} {op}s unknown component group {g}")
    for k in ev:
        if k not in ("add", "remove", "sequence", "randomize", "trigger", "set_property", "filters"):
            err(f"event {name} uses unexpected response {k}")

# every "event" referenced by a component must exist
referenced_events = set()
for p, k, v in walk({"components": ent["components"], "component_groups": groups}):
    if k == "event" and isinstance(v, str):
        referenced_events.add(v)
for e in referenced_events:
    if e not in events:
        err(f"component references unknown event {e}")
for name in events:
    if name != "minecraft:entity_spawned" and name not in referenced_events:
        notes.append(f"event {name} is only triggered externally")

# no component may live in both the base components and a component group
for g, comps in groups.items():
    for c in comps:
        if c in ent["components"]:
            err(f"component {c} is in base components and in group {g}")

loot = ent["components"]["minecraft:loot"]["table"]
if not os.path.exists(os.path.join(BP, loot)):
    err(f"loot table {loot} missing")

# items used for taming / healing
items_used = set()
for g in groups.values():
    t = g.get("minecraft:tameable")
    if t:
        items_used.update(t["tame_items"] if isinstance(t["tame_items"], list) else [t["tame_items"]])
    h = g.get("minecraft:healable")
    if h:
        items_used.update(i["item"] for i in h["items"])
lt = all_json["FlyingGuardian_BP/loot_tables/entities/flying_guardian.json"]
for pool in lt["pools"]:
    for entry in pool["entries"]:
        items_used.add(entry["name"])

families_used = set()
for p, k, v in walk(ent):
    if isinstance(v, dict) and v.get("test") == "is_family":
        families_used.add(v["value"])
filter_tests = {v["test"] for p, k, v in walk(ent) if isinstance(v, dict) and "test" in v}

spawn = all_json["FlyingGuardian_BP/spawn_rules/flying_guardian.json"]["minecraft:spawn_rules"]
if spawn["description"]["identifier"] != ENTITY_ID:
    err("spawn rules identifier mismatch")

# ---------------------------------------------------------------------------------------------
# 4. Resource pack: geometry, textures, client entity
# ---------------------------------------------------------------------------------------------
geo_file = all_json["FlyingGuardian_RP/models/entity/flying_guardian.geo.json"]
geo = geo_file["minecraft:geometry"][0]
geo_id = geo["description"]["identifier"]
tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
bone_names = [b["name"] for b in geo["bones"]]
if len(set(bone_names)) != len(bone_names):
    err("duplicate bone names in geometry")
locators = set()
for b in geo["bones"]:
    if b.get("parent") and b["parent"] not in bone_names:
        err(f"bone {b['name']} has unknown parent {b['parent']}")
    for loc in b.get("locators", {}):
        if loc in locators:
            err(f"duplicate locator {loc}")
        locators.add(loc)
    for c in b.get("cubes", []):
        for face, f in c["uv"].items():
            u, v = f["uv"]
            w, h = f["uv_size"]
            if u < 0 or v < 0 or u + w > tw or v + h > th or w <= 0 or h <= 0:
                err(f"bone {b['name']} face {face} UV out of bounds")

client = all_json["FlyingGuardian_RP/entity/flying_guardian.entity.json"]["minecraft:client_entity"]["description"]
if client["identifier"] != ENTITY_ID:
    err("client entity identifier mismatch")
if client["geometry"]["default"] != geo_id:
    err("client entity geometry id mismatch")
for key, tex in client["textures"].items():
    if not any(os.path.exists(os.path.join(RP, tex + ext)) for ext in (".png", ".tga")):
        err(f"texture {tex} missing")
for mat in client["materials"].values():
    if mat not in ("entity_emissive_alpha", "entity_alphatest", "entity", "entity_emissive_alpha_one_sided"):
        err(f"unexpected material {mat}")

# the texture size must match the geometry's texture size
from PIL import Image  # noqa: E402

tex_img = Image.open(os.path.join(RP, client["textures"]["default"] + ".tga"))
if tex_img.size != (tw, th):
    err(f"texture size {tex_img.size} != geometry texture size {(tw, th)}")
alpha = tex_img.getchannel("A")
lo, hi = alpha.getextrema()
if lo < 60:
    err("entity texture contains near-transparent pixels; glow pixels must keep alpha >= 60")

# spawn egg
egg = client["spawn_egg"]
item_tex = all_json["FlyingGuardian_RP/textures/item_texture.json"]["texture_data"]
if egg["texture"] not in item_tex:
    err("spawn egg texture key missing from item_texture.json")
else:
    p = item_tex[egg["texture"]]["textures"]
    if not os.path.exists(os.path.join(RP, p + ".png")):
        err(f"spawn egg texture file {p}.png missing")

# animations & controllers
anim_file = all_json["FlyingGuardian_RP/animations/flying_guardian.animation.json"]["animations"]
ctrl_file = all_json["FlyingGuardian_RP/animation_controllers/flying_guardian.animation_controllers.json"]["animation_controllers"]
amap = client["animations"]
for short, full in amap.items():
    if full not in anim_file and full not in ctrl_file:
        err(f"client animation {short} -> {full} not defined")
for a in client["scripts"]["animate"]:
    name = a if isinstance(a, str) else list(a)[0]
    if name not in amap:
        err(f"animate entry {name} not in animations map")
pmap = client.get("particle_effects", {})
smap = client.get("sound_effects", {})
rc = all_json["FlyingGuardian_RP/render_controllers/flying_guardian.render_controllers.json"]["render_controllers"]
for r in client["render_controllers"]:
    if r not in rc:
        err(f"render controller {r} missing")

particle_ids = {}
for path, data in all_json.items():
    if path.startswith("FlyingGuardian_RP/particles/"):
        particle_ids[data["particle_effect"]["description"]["identifier"]] = data
for short, pid in pmap.items():
    if pid not in particle_ids:
        err(f"particle {short} -> {pid} not defined")

sound_defs = all_json["FlyingGuardian_RP/sounds/sound_definitions.json"]["sound_definitions"]
for short, sid in smap.items():
    if sid not in sound_defs:
        err(f"sound effect {short} -> {sid} not defined")
sounds_json = all_json["FlyingGuardian_RP/sounds.json"]["entity_sounds"]["entities"][ENTITY_ID]["events"]
for ev, sid in sounds_json.items():
    if sid not in sound_defs:
        err(f"entity sound event {ev} -> {sid} not defined")


def check_effects(where, fx_list):
    for fx in fx_list:
        if "locator" in fx and fx["locator"] not in locators:
            err(f"{where}: unknown locator {fx['locator']}")


for name, anim in anim_file.items():
    for bone in anim.get("bones", {}):
        if bone not in bone_names:
            err(f"animation {name} animates unknown bone {bone}")
    for t, fx in anim.get("particle_effects", {}).items():
        fx = fx if isinstance(fx, list) else [fx]
        check_effects(name, fx)
        for f in fx:
            if f["effect"] not in pmap:
                err(f"animation {name} uses unknown particle {f['effect']}")
    for t, fx in anim.get("sound_effects", {}).items():
        for f in (fx if isinstance(fx, list) else [fx]):
            if f["effect"] not in smap:
                err(f"animation {name} uses unknown sound {f['effect']}")

for cname, ctrl in ctrl_file.items():
    states = ctrl["states"]
    if ctrl["initial_state"] not in states:
        err(f"{cname}: initial state missing")
    for sname, st in states.items():
        for a in st.get("animations", []):
            a = a if isinstance(a, str) else list(a)[0]
            if a not in amap:
                err(f"{cname}.{sname}: unknown animation {a}")
        for tr in st.get("transitions", []):
            for target in tr:
                if target not in states:
                    err(f"{cname}.{sname}: transition to unknown state {target}")
        check_effects(f"{cname}.{sname}", st.get("particle_effects", []))
        for f in st.get("particle_effects", []):
            if f["effect"] not in pmap:
                err(f"{cname}.{sname}: unknown particle {f['effect']}")
        for f in st.get("sound_effects", []):
            if f["effect"] not in smap:
                err(f"{cname}.{sname}: unknown sound {f['effect']}")

# properties used on the client must exist and be client-synced
for path, data in all_json.items():
    text = json.dumps(data)
    for prop in re.findall(r"query\.property\('([^']+)'\)", text):
        if prop not in properties:
            err(f"{path}: unknown property {prop}")
        elif not properties[prop].get("client_sync"):
            err(f"{path}: property {prop} is not client_sync")

# lang
for lang in ("en_US", "en_GB"):
    with open(os.path.join(RP, "texts", f"{lang}.lang"), encoding="utf-8") as f:
        keys = dict(line.strip().split("=", 1) for line in f if "=" in line)
    for k in (f"entity.{ENTITY_ID}.name", f"item.spawn_egg.entity.{ENTITY_ID}.name"):
        if k not in keys:
            err(f"{lang}.lang missing {k}")

# ---------------------------------------------------------------------------------------------
# 5. Script: identifiers it uses must exist in the packs
# ---------------------------------------------------------------------------------------------
script_path = os.path.join(BP, "scripts", "main.js")
with open(script_path, encoding="utf-8") as f:
    script = f.read()
# Code with comments and string literals removed, for member-access scanning.
script_code = re.sub(r"//[^\n]*", "", script)
script_code = re.sub(r"/\*.*?\*/", "", script_code, flags=re.S)
script_code = re.sub(r'"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`', '""', script_code)
for pid in set(re.findall(r'"(fguard:[a-z_]+)"', script)):
    if pid == ENTITY_ID or pid in events or pid in properties or pid in groups or pid == "fguard:owner":
        continue
    if pid not in particle_ids:
        err(f"script references unknown id {pid}")
for sid in set(re.findall(r'"(fguard\.[a-z_]+)"', script)):
    if sid not in sound_defs:
        err(f"script plays unknown sound {sid}")
for ev in re.findall(r'eventTypes:\s*\["([^"]+)"\]', script):
    if ev not in events:
        err(f"script listens for unknown event {ev}")

# ---------------------------------------------------------------------------------------------
# 6. Checks against the vanilla data of the exact game version
# ---------------------------------------------------------------------------------------------
if VANILLA:
    meta = os.path.join(VANILLA, "metadata")
    version = json.load(open(os.path.join(VANILLA, "version.json")))["latest"]["version"]
    notes.append(f"vanilla reference version: {version}")

    items = {i["name"] for i in json.load(open(os.path.join(meta, "vanilladata_modules", "mojang-items.json")))["data_items"]}
    for it in items_used:
        full = it if ":" in it else "minecraft:" + it
        if full not in items:
            err(f"unknown item {it}")

    vfamilies = set()
    vtests = set()
    vqueries = set()
    vcomponents = set()
    for f in glob.glob(os.path.join(VANILLA, "behavior_pack", "entities", "*.json")):
        d = vload(f)
        for p, k, v in walk(d):
            if k == "minecraft:type_family":
                vfamilies.update(v["family"])
            if isinstance(v, dict) and "test" in v:
                vtests.add(v["test"])
            if k.startswith("minecraft:"):
                vcomponents.add(k)
    for f in glob.glob(os.path.join(VANILLA, "resource_pack", "**", "*.json"), recursive=True):
        try:
            with open(f, encoding="utf-8") as fh:
                vqueries.update(re.findall(r"(query\.[a-z_]+|math\.[a-z_]+)", fh.read()))
        except UnicodeDecodeError:
            pass
    for fam in families_used - {"flying_guardian"}:
        if fam not in vfamilies:
            err(f"family {fam} is not used by any vanilla entity")
    for t in filter_tests:
        if t not in vtests:
            err(f"filter test {t} is not used by any vanilla entity")
    ours = set()
    for p, k, v in walk(ent):
        if k.startswith("minecraft:") and not k.startswith("minecraft:entity"):
            ours.add(k)
    ours -= {"minecraft:entity_spawned"}
    for c in sorted(ours):
        if c not in vcomponents:
            err(f"component {c} is not used by any vanilla entity in this version")

    used_q = set()
    for path, data in all_json.items():
        if path.startswith("FlyingGuardian_RP/"):
            used_q.update(re.findall(r"(query\.[a-z_]+|math\.[a-z_]+)", json.dumps(data)))
    for q in sorted(used_q):
        if q not in vqueries:
            err(f"Molang {q} not found anywhere in the vanilla resource pack")

    vsounds = vload(os.path.join(VANILLA, "resource_pack", "sounds", "sound_definitions.json"))["sound_definitions"]
    vfiles = set()
    for d in vsounds.values():
        for s in d.get("sounds", []):
            vfiles.add(s if isinstance(s, str) else s["name"])
    for sid, d in sound_defs.items():
        for s in d["sounds"]:
            n = s if isinstance(s, str) else s["name"]
            if n not in vfiles:
                err(f"sound {sid} references unknown file {n}")

    for path, data in all_json.items():
        if not path.startswith("FlyingGuardian_RP/particles/"):
            continue
        tex = data["particle_effect"]["description"]["basic_render_parameters"]["texture"]
        if not glob.glob(os.path.join(VANILLA, "resource_pack", tex + ".*")):
            err(f"{path}: texture {tex} not in vanilla resource pack")
        vcomps = set()
        for f in glob.glob(os.path.join(VANILLA, "resource_pack", "particles", "*.json")):
            vcomps.update(vload(f)["particle_effect"]["components"].keys())
        for c in data["particle_effect"]["components"]:
            if c not in vcomps:
                err(f"{path}: particle component {c} unused by vanilla")

    mod_dir = os.path.join(meta, "script_modules", "@minecraft")
    for name, ver in script_deps.items():
        short = name.split("/")[1]
        mfile = os.path.join(mod_dir, f"{short}_{ver}.json")
        if not os.path.exists(mfile):
            err(f"script module {name} {ver} is not available in this game version")
            continue
        if "beta" in ver:
            err(f"script module {name} {ver} is a beta (experimental) module")
        api = json.load(open(mfile))
        members = set()
        for cls in api["classes"] + api.get("interfaces", []):
            members.update(p["name"] for p in cls.get("properties", []))
            members.update(f["name"] for f in cls.get("functions", []))
        members.update(o["name"] for o in api.get("objects", []))
        used = set(re.findall(r"\.([a-zA-Z_]+)\s*\(", script_code)) | set(re.findall(r"\.([a-zA-Z_]+)\b(?!\s*\()", script_code))
        js_builtin = {"push", "set", "get", "has", "delete", "some", "min", "max", "sqrt", "hypot", "atan2", "random",
                      "PI", "sin", "cos", "id", "foe", "seenTick", "foeTick", "nextDive", "endTick", "guardian",
                      "value", "x", "y", "z", "horizontal", "vertical", "minDistance", "maxDistance", "speed",
                      "impactDistance", "maxTicks", "cooldownTicks", "bonusDamage", "shockRadius", "shockDamage",
                      "length", "subscribe"}
        for m in sorted(used - js_builtin):
            if m not in members:
                err(f"script uses .{m} which is not part of {name} {ver}")

# ---------------------------------------------------------------------------------------------
# 7. Optional: every component parameter must be documented for this game version
#    (pass the bedrock.dev entity docs page for 1.21.0 as the second argument)
# ---------------------------------------------------------------------------------------------
DOCS = sys.argv[2] if len(sys.argv) > 2 else None
if DOCS:
    import html as _html

    with open(DOCS, encoding="utf-8") as f:
        doc_text = _html.unescape(re.sub(r"<[^>]+>", " ", f.read()))
    doc_text = re.sub(r"\s+", " ", doc_text)
    heads = [(m.start(), m.group(1)) for m in re.finditer(r"(minecraft:[a-z_.]+) # ", doc_text)]
    doc_params = {}
    for (start, name), nxt in zip(heads, heads[1:] + [(len(doc_text), None)]):
        body = doc_text[start:nxt[0]]
        doc_params.setdefault(name, set()).update(re.findall(r" ([a-z_]+) (?:Boolean|Decimal|Integer|List|String|JSON Object|Trigger|Minecraft Filter|Range \[a, b\]|Vector \[a, b, c\]|Array|Item Description Properties|Molang) ", body))
    # Attribute components are documented separately (their vanilla usage is checked above), and
    # "priority" is the common goal parameter that the per-behavior tables omit.
    attributes = {"minecraft:health", "minecraft:movement", "minecraft:follow_range", "minecraft:knockback_resistance"}
    checked = 0
    for gname, comps in [("components", ent["components"])] + list(groups.items()):
        for comp, val in comps.items():
            if not isinstance(val, dict) or not val or comp in attributes:
                continue
            if comp not in doc_params:
                err(f"{comp} is not documented for this version")
                continue
            for param in val:
                if param == "priority" and comp.startswith("minecraft:behavior."):
                    continue
                checked += 1
                if param not in doc_params[comp]:
                    err(f"{gname}/{comp}: parameter '{param}' is not documented for this version")
    notes.append(f"{checked} component parameters checked against the version docs")

# ---------------------------------------------------------------------------------------------
print(f"checked {len(all_json)} JSON files, {len(bone_names)} bones, {len(particle_ids)} particles, "
      f"{len(sound_defs)} sound definitions")
for n in notes:
    print("note:", n)
if errors:
    print(f"\n{len(errors)} problem(s):")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("ALL CHECKS PASSED")

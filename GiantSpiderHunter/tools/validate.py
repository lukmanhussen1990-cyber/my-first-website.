#!/usr/bin/env python3
"""Static validator for the Giant Spider Hunter add-on.

Checks JSON syntax, manifests/UUIDs/dependencies, cross references between the behavior pack,
resource pack and scripts (geometry, textures, animations, controllers, render controllers,
sounds, particles, loot tables, events, component groups, entity properties), Molang query and
math names against the names compiled into Bedrock 1.21.0.26, Script API usage against the
@minecraft/server 1.10.0 metadata, JavaScript syntax (node --check) and the packaged archives.

Exit code 0 = no errors. Warnings do not fail the run.
Usage: python3 tools/validate.py [--archives]
"""
import json
import os
import re
import struct
import subprocess
import sys
import uuid
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "GiantSpiderHunter_BP")
RP = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP")
DATA = os.path.join(ROOT, "tools", "data")
SAMPLES = "/tmp/claude-0/scratch/bedrock-samples"
BDS_STRINGS = "/tmp/claude-0/bds/strings.txt"
ENTITY_ID = "horror:giant_spider"

errors, warnings, notes = [], [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def note(msg):
    notes.append(msg)


def rel(p):
    return os.path.relpath(p, ROOT)


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        err(f"missing file: {rel(path)}")
    except json.JSONDecodeError as e:
        err(f"invalid JSON {rel(path)}: {e}")
    return None


def walk(base, exts):
    for dp, dn, fn in os.walk(base):
        dn[:] = [d for d in dn if d not in ("node_modules", "__pycache__")]
        for f in fn:
            if f.lower().endswith(exts):
                yield os.path.join(dp, f)


# --------------------------------------------------------------------------- reference data
def read_lines(path):
    try:
        with open(path) as fh:
            return {l.strip() for l in fh if l.strip()}
    except FileNotFoundError:
        warn(f"reference list missing: {path}")
        return set()


MOLANG_QUERIES = {q.split(".", 1)[1] for q in read_lines(os.path.join(DATA, "molang_queries.txt"))}
MOLANG_MATH = {q.split(".", 1)[1] for q in read_lines(os.path.join(DATA, "molang_math.txt"))}
BDS = ""
if os.path.exists(BDS_STRINGS):
    with open(BDS_STRINGS, errors="ignore") as fh:
        BDS = fh.read()
else:
    warn("BDS strings dump not found; component-name checks skipped")

VANILLA_PARTICLES = set()
pdir = os.path.join(SAMPLES, "resource_pack", "particles")
if os.path.isdir(pdir):
    for f in walk(pdir, (".json",)):
        try:
            d = json.load(open(f))
            VANILLA_PARTICLES.add(d["particle_effect"]["description"]["identifier"])
        except Exception:
            pass
VANILLA_MATERIALS = {"spider", "spider_invisible", "entity", "entity_alphatest", "entity_alphablend",
                     "entity_emissive", "entity_emissive_alpha", "entity_nocull", "entity_change_color",
                     "entity_alphatest_change_color", "entity_custom", "entity_alphatest_glint"}

# --------------------------------------------------------------------------- manifests
def check_uuid(u, where):
    try:
        uuid.UUID(u)
        return True
    except Exception:
        err(f"{where}: invalid UUID {u!r}")
        return False


def check_manifests():
    bpm = load_json(os.path.join(BP, "manifest.json"))
    rpm = load_json(os.path.join(RP, "manifest.json"))
    if not bpm or not rpm:
        return
    seen = {}
    for name, m in (("BP", bpm), ("RP", rpm)):
        if m.get("format_version") != 2:
            err(f"{name} manifest: format_version must be 2")
        h = m.get("header", {})
        for key in ("name", "description", "uuid", "version", "min_engine_version"):
            if key not in h:
                err(f"{name} manifest header missing {key}")
        if h.get("min_engine_version") != [1, 21, 0]:
            warn(f"{name} min_engine_version is {h.get('min_engine_version')} (expected [1,21,0])")
        ids = [h.get("uuid")] + [mod.get("uuid") for mod in m.get("modules", [])]
        for u in ids:
            if u and check_uuid(u, f"{name} manifest"):
                if u in seen:
                    err(f"duplicate UUID {u} ({seen[u]} and {name})")
                seen[u] = name
        for mod in m.get("modules", []):
            if not isinstance(mod.get("version"), list):
                err(f"{name} module version must be [x,y,z]")
    bp_types = {mod["type"] for mod in bpm.get("modules", [])}
    if bp_types != {"data", "script"}:
        err(f"BP module types {bp_types} != {{data, script}}")
    rp_types = {mod["type"] for mod in rpm.get("modules", [])}
    if rp_types != {"resources"}:
        err(f"RP module types {rp_types} != {{resources}}")
    for mod in bpm.get("modules", []):
        if mod["type"] == "script":
            if mod.get("language") != "javascript":
                err("script module language must be javascript")
            entry = os.path.join(BP, mod.get("entry", ""))
            if not os.path.isfile(entry):
                err(f"script entry missing: {rel(entry)}")
    deps = bpm.get("dependencies", [])
    rp_dep = [d for d in deps if d.get("uuid") == rpm["header"]["uuid"]]
    if not rp_dep or rp_dep[0].get("version") != rpm["header"]["version"]:
        err("BP must depend on RP header uuid/version")
    srv = [d for d in deps if d.get("module_name") == "@minecraft/server"]
    if not srv:
        err("BP missing @minecraft/server dependency")
    else:
        ver = srv[0].get("version")
        meta = os.path.join(SAMPLES, "metadata", "script_modules", "@minecraft", f"server_{ver}.json")
        if "beta" in str(ver):
            err(f"@minecraft/server {ver} is a beta module (needs experiments)")
        if not os.path.isfile(meta):
            err(f"@minecraft/server {ver} not present in 1.21.0.26 metadata")
        else:
            note(f"@minecraft/server {ver} is listed in bedrock-samples v1.21.0.26 metadata")
    other = [d for d in deps if d.get("module_name") not in (None, "@minecraft/server")]
    if other:
        err(f"unexpected module dependencies: {other}")
    rdeps = rpm.get("dependencies", [])
    if not any(d.get("uuid") == bpm["header"]["uuid"] and d.get("version") == bpm["header"]["version"] for d in rdeps):
        warn("RP does not depend on BP (optional)")


# --------------------------------------------------------------------------- molang
MOLANG_TOKEN = re.compile(r"\b(q|query|math|v|variable|t|temp|c|context)\.([A-Za-z_][A-Za-z0-9_]*)")
PROPERTY_CALL = re.compile(r"\b(?:q|query)\.(?:property|has_property)\(\s*'([^']+)'\s*\)")


def molang_strings(obj, path=""):
    """Yield (path, string) for every string value that looks like Molang."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from molang_strings(v, f"{path}/{k}")
            if isinstance(k, str) and MOLANG_TOKEN.search(k):
                yield (f"{path}/<key>", k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from molang_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        if MOLANG_TOKEN.search(obj) or any(op in obj for op in ("==", "&&", "||")):
            yield (path, obj)


def check_molang(src_name, obj, entity_props, assigned_vars, used_vars):
    for path, s in molang_strings(obj):
        if s.count("(") != s.count(")"):
            err(f"{src_name}{path}: unbalanced parentheses in Molang: {s[:90]}")
        if s.count("{") != s.count("}"):
            err(f"{src_name}{path}: unbalanced braces in Molang: {s[:90]}")
        if s.count("'") % 2:
            err(f"{src_name}{path}: unbalanced quotes in Molang: {s[:90]}")
        for ns, name in MOLANG_TOKEN.findall(s):
            low = name.lower()
            if ns in ("q", "query"):
                if low not in MOLANG_QUERIES:
                    err(f"{src_name}{path}: unknown query '{ns}.{name}' (not in 1.21.0.26)")
            elif ns == "math":
                if low not in MOLANG_MATH:
                    err(f"{src_name}{path}: unknown math function 'math.{name}'")
            elif ns in ("v", "variable"):
                # assignment detection: v.name = (not ==)
                if re.search(rf"\b{ns}\.{re.escape(name)}\s*=(?!=)", s):
                    assigned_vars.add(low)
                used_vars.add(low)
        for prop in PROPERTY_CALL.findall(s):
            if entity_props is not None and prop not in entity_props:
                err(f"{src_name}{path}: q.property('{prop}') is not a defined entity property")
        if re.search(r"\b(?:v|variable)\.[A-Za-z_0-9]+\s*(\+=|-=|\*=|/=|\+\+|--)", s):
            err(f"{src_name}{path}: compound assignment operators are not Molang: {s[:90]}")


# --------------------------------------------------------------------------- behavior pack
def check_bp():
    ent = load_json(os.path.join(BP, "entities", "giant_spider.json"))
    if not ent:
        return None, set(), set()
    if ent.get("format_version") != "1.21.0":
        warn(f"BP entity format_version {ent.get('format_version')} (expected 1.21.0)")
    e = ent.get("minecraft:entity", {})
    desc = e.get("description", {})
    if desc.get("identifier") != ENTITY_ID:
        err("BP entity identifier mismatch")
    for k in ("is_spawnable", "is_summonable"):
        if desc.get(k) is not True:
            err(f"BP description.{k} must be true")
    props = desc.get("properties", {})
    if len(props) > 32:
        err("more than 32 entity properties")
    for name, p in props.items():
        t = p.get("type")
        if t not in ("bool", "int", "float", "enum"):
            err(f"property {name}: bad type {t}")
        d = p.get("default")
        if t in ("int", "float"):
            rng = p.get("range")
            if not (isinstance(rng, list) and len(rng) == 2 and rng[0] < rng[1]):
                err(f"property {name}: invalid range {rng}")
            elif isinstance(d, (int, float)) and not (rng[0] <= d <= rng[1]):
                err(f"property {name}: default {d} outside range {rng}")
            if t == "int" and isinstance(d, float):
                err(f"property {name}: int default is float")
        if t == "enum":
            vals = p.get("values", [])
            if d not in vals:
                err(f"property {name}: default {d!r} not in values")
            if len(vals) > 16:
                err(f"property {name}: too many enum values")
        if t == "bool" and not isinstance(d, (bool, str)):
            err(f"property {name}: bool default {d!r}")
    groups = e.get("component_groups", {})
    base = e.get("components", {})
    events = e.get("events", {})
    # component names exist in this server build
    def comp_names(dct):
        return [k for k in dct.keys()]
    all_comps = set(comp_names(base))
    for g, comps in groups.items():
        all_comps.update(comp_names(comps))
        dup = set(comps) & set(base)
        for c in dup:
            err(f"component {c} defined in base components AND group {g} (removing the group deletes it)")
    if BDS:
        for c in sorted(all_comps):
            if c not in BDS:
                err(f"component {c} not found in BDS 1.21.0.26 binary strings")
    # events referenced anywhere must exist
    def find_event_refs(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("event",) and isinstance(v, str):
                    yield v
                elif k in ("time_down_event", "on_damage", "on_attack", "on_kill", "on_start", "on_end"):
                    if isinstance(v, dict) and isinstance(v.get("event"), str):
                        yield v["event"]
                    yield from find_event_refs(v)
                else:
                    yield from find_event_refs(v)
        elif isinstance(obj, list):
            for v in obj:
                yield from find_event_refs(v)
    for ref in set(find_event_refs({"c": base, "g": groups, "e": events})):
        if ref not in events and not ref.startswith("minecraft:"):
            err(f"event referenced but not defined: {ref}")
    # event bodies: groups exist, set_property values valid
    def check_event(name, ev):
        if not isinstance(ev, dict):
            return
        for key in ("add", "remove"):
            if key in ev:
                for g in ev[key].get("component_groups", []):
                    if g not in groups:
                        err(f"event {name}: {key} unknown group {g}")
        if "set_property" in ev:
            for pk, pv in ev["set_property"].items():
                if pk not in props:
                    err(f"event {name}: set_property unknown property {pk}")
                    continue
                t = props[pk]["type"]
                if t == "enum" and isinstance(pv, str) and not MOLANG_TOKEN.search(pv) and pv not in props[pk]["values"]:
                    err(f"event {name}: {pk} value {pv!r} not an enum value")
        if "trigger" in ev:
            trig = ev["trigger"] if isinstance(ev["trigger"], str) else ev["trigger"].get("event")
            if trig and trig not in events:
                err(f"event {name}: trigger unknown event {trig}")
        for key in ("sequence", "randomize", "first_valid"):
            for sub in ev.get(key, []):
                check_event(name, sub)
    for n, ev in events.items():
        check_event(n, ev)
    for g in groups:
        used = any(g in json.dumps(ev) for ev in events.values())
        if not used:
            warn(f"component group {g} is never added by any event")
    loot = base.get("minecraft:loot", {}).get("table")
    for comps in groups.values():
        loot = loot or comps.get("minecraft:loot", {}).get("table")
    if loot:
        lp = os.path.join(BP, loot)
        if not os.path.isfile(lp):
            err(f"loot table missing: {loot}")
        else:
            load_json(lp)
    return ent, set(props), set(events)


# --------------------------------------------------------------------------- resource pack
def check_rp(prop_names):
    ce = load_json(os.path.join(RP, "entity", "giant_spider.entity.json"))
    geo = load_json(os.path.join(RP, "models", "entity", "giant_spider.geo.json"))
    anims = load_json(os.path.join(RP, "animations", "giant_spider.animation.json"))
    ctrls = load_json(os.path.join(RP, "animation_controllers", "giant_spider.animation_controllers.json"))
    rcs = load_json(os.path.join(RP, "render_controllers", "giant_spider.render_controllers.json"))
    sdefs = load_json(os.path.join(RP, "sounds", "sound_definitions.json"))
    sounds = load_json(os.path.join(RP, "sounds.json"))
    sound_ids = set((sdefs or {}).get("sound_definitions", {}).keys())
    bones, locators = set(), set()

    # geometry
    if geo:
        gl = geo.get("minecraft:geometry", [])
        ids = [g["description"]["identifier"] for g in gl]
        if "geometry.horror.giant_spider" not in ids:
            err("geometry.horror.giant_spider not defined")
        for g in gl:
            d = g["description"]
            tw, th = d.get("texture_width"), d.get("texture_height")
            for k in ("visible_bounds_width", "visible_bounds_height", "visible_bounds_offset"):
                if k not in d:
                    err(f"geometry missing {k}")
            names = [b["name"] for b in g.get("bones", [])]
            if len(names) != len(set(names)):
                err("duplicate bone names in geometry")
            bones.update(names)
            ncubes = 0
            for b in g.get("bones", []):
                if b.get("parent") and b["parent"] not in names:
                    err(f"bone {b['name']} parent {b['parent']} missing")
                locators.update((b.get("locators") or {}).keys())
                for c in b.get("cubes", []):
                    ncubes += 1
                    uv = c.get("uv")
                    if isinstance(uv, dict):
                        for face, f in uv.items():
                            u, v = f.get("uv", [0, 0])
                            w, h = f.get("uv_size", [0, 0])
                            for x in (u, u + w):
                                if not (0 <= x <= tw):
                                    err(f"bone {b['name']} {face} uv x {x} out of 0..{tw}")
                            for y in (v, v + h):
                                if not (0 <= y <= th):
                                    err(f"bone {b['name']} {face} uv y {y} out of 0..{th}")
            note(f"geometry: {len(names)} bones, {ncubes} cubes, {len(locators)} locators")
            if ncubes > 120:
                warn(f"geometry has {ncubes} cubes (phone budget ~90)")

    # client entity
    anim_map, ctrl_ids, anim_ids = {}, set(), set()
    if anims:
        anim_ids = set(anims.get("animations", {}).keys())
        for aid, a in anims.get("animations", {}).items():
            for bn in a.get("bones", {}):
                if bones and bn not in bones:
                    err(f"{aid}: animates unknown bone {bn}")
            for se in a.get("sound_effects", {}).values() if isinstance(a.get("sound_effects"), dict) else []:
                pass
    if ctrls:
        ctrl_ids = set(ctrls.get("animation_controllers", {}).keys())
    assigned_vars, used_vars = set(), set()
    if ce:
        if ce.get("format_version") != "1.10.0":
            warn(f"client entity format {ce.get('format_version')}")
        d = ce.get("minecraft:client_entity", {}).get("description", {})
        if d.get("identifier") != ENTITY_ID:
            err("client entity identifier mismatch")
        for k, m in d.get("materials", {}).items():
            if m not in VANILLA_MATERIALS:
                warn(f"material {m} not in known vanilla list")
        for k, t in d.get("textures", {}).items():
            if not any(os.path.isfile(os.path.join(RP, t + ext)) for ext in (".png", ".tga")):
                err(f"texture missing: {t}")
        for k, g in d.get("geometry", {}).items():
            if geo and g not in [x["description"]["identifier"] for x in geo.get("minecraft:geometry", [])]:
                err(f"geometry {g} not defined")
        anim_map = d.get("animations", {})
        for short, full in anim_map.items():
            if full.startswith("controller.animation."):
                if full not in ctrl_ids:
                    err(f"client entity animation {short} -> unknown controller {full}")
            elif full not in anim_ids:
                err(f"client entity animation {short} -> unknown animation {full}")
        scripts = d.get("scripts", {})
        for entry in scripts.get("animate", []):
            names = entry.keys() if isinstance(entry, dict) else [entry]
            for n in names:
                if n not in anim_map:
                    err(f"scripts.animate references unknown animation short name {n}")
        for rc in d.get("render_controllers", []):
            rcid = rc if isinstance(rc, str) else list(rc.keys())[0]
            if rcs and rcid not in rcs.get("render_controllers", {}):
                err(f"render controller {rcid} not defined")
        for short, sid in (d.get("sound_effects") or {}).items():
            if sid not in sound_ids:
                err(f"client sound_effect {short} -> undefined sound {sid}")
        for short, pid in (d.get("particle_effects") or {}).items():
            if VANILLA_PARTICLES and pid not in VANILLA_PARTICLES:
                err(f"particle effect {short} -> unknown particle {pid}")
        egg = d.get("spawn_egg")
        if not egg:
            err("client entity has no spawn_egg (Creative spawn egg would be missing)")
        check_molang("client_entity", d, prop_names, assigned_vars, used_vars)
        # short names used by controllers / sound / particle effects
        sfx = set((d.get("sound_effects") or {}).keys())
        pfx = set((d.get("particle_effects") or {}).keys())
        if ctrls:
            for cid, c in ctrls.get("animation_controllers", {}).items():
                states = c.get("states", {})
                init = c.get("initial_state", "default")
                if init not in states:
                    err(f"{cid}: initial_state {init} missing")
                for sn, st in states.items():
                    for a in st.get("animations", []):
                        n = a if isinstance(a, str) else list(a.keys())[0]
                        if n not in anim_map:
                            err(f"{cid}.{sn}: animation short name {n} not in client entity")
                    for tr in st.get("transitions", []):
                        for target in tr.keys():
                            if target not in states:
                                err(f"{cid}.{sn}: transition to unknown state {target}")
                    for se in st.get("sound_effects", []):
                        if se.get("effect") not in sfx:
                            err(f"{cid}.{sn}: sound effect {se.get('effect')} not in client entity sound_effects")
                    for pe in st.get("particle_effects", []):
                        if pe.get("effect") not in pfx:
                            err(f"{cid}.{sn}: particle effect {pe.get('effect')} not in client entity particle_effects")
                        loc = pe.get("locator")
                        if loc and locators and loc not in locators:
                            err(f"{cid}.{sn}: locator {loc} not in geometry")
                if cid not in anim_map.values():
                    warn(f"controller {cid} not referenced by client entity")
            check_molang("controllers", ctrls, prop_names, assigned_vars, used_vars)
        if anims:
            for aid, a in anims.get("animations", {}).items():
                for t, se in (a.get("sound_effects") or {}).items():
                    for x in (se if isinstance(se, list) else [se]):
                        if x.get("effect") not in sfx:
                            err(f"{aid}: sound effect {x.get('effect')} not in client entity")
                for t, pe in (a.get("particle_effects") or {}).items():
                    for x in (pe if isinstance(pe, list) else [pe]):
                        if x.get("effect") not in pfx:
                            err(f"{aid}: particle effect {x.get('effect')} not in client entity")
            check_molang("animations", anims, prop_names, assigned_vars, used_vars)
            for aid in anim_ids:
                if aid not in anim_map.values():
                    warn(f"animation {aid} defined but not referenced by client entity")
    if rcs:
        check_molang("render_controllers", rcs, prop_names, assigned_vars, used_vars)
    never_set = sorted(v for v in used_vars - assigned_vars
                       if v not in ("attack_time", "is_brandishing_spear", "is_holding_spear"))
    if never_set:
        warn(f"Molang variables read but never assigned (default 0): {never_set}")

    # sounds
    if sdefs:
        if not sdefs.get("format_version"):
            warn("sound_definitions.json has no format_version")
        for sid, sd in sdefs.get("sound_definitions", {}).items():
            for s in sd.get("sounds", []):
                name = s if isinstance(s, str) else s.get("name")
                if not os.path.isfile(os.path.join(RP, name + ".ogg")) and not os.path.isfile(os.path.join(RP, name + ".wav")):
                    err(f"sound {sid}: file missing {name}.ogg")
    if sounds:
        ent_sounds = sounds.get("entity_sounds", {}).get("entities", {}).get(ENTITY_ID, {})
        if not ent_sounds:
            err("sounds.json has no entity_sounds for horror:giant_spider")
        for ev, sid in ent_sounds.get("events", {}).items():
            sid = sid if isinstance(sid, str) else sid.get("sound")
            if sid and sid not in sound_ids:
                err(f"sounds.json event {ev} -> undefined sound {sid}")
    # lang
    lang = os.path.join(RP, "texts", "en_US.lang")
    if os.path.isfile(lang):
        text = open(lang, encoding="utf-8").read()
        for key in (f"entity.{ENTITY_ID}.name=Giant Spider Hunter",
                    f"item.spawn_egg.entity.{ENTITY_ID}.name=Giant Spider Hunter"):
            if key not in text:
                err(f"RP en_US.lang missing '{key}'")
    else:
        err("RP texts/en_US.lang missing")
    if not os.path.isfile(os.path.join(RP, "texts", "languages.json")):
        warn("RP texts/languages.json missing")
    # texture alpha sanity
    tex = os.path.join(RP, "textures", "entity", "giant_spider", "giant_spider.png")
    if os.path.isfile(tex):
        try:
            from PIL import Image
            im = Image.open(tex).convert("RGBA")
            alphas = {}
            for a in im.getchannel("A").getdata():
                alphas[a] = alphas.get(a, 0) + 1
            note(f"texture {im.size}, alpha histogram {dict(sorted(alphas.items()))}")
            if set(alphas) - {0, 3, 255}:
                warn(f"texture has unexpected alpha values {sorted(set(alphas) - {0, 3, 255})}")
        except Exception as e:
            warn(f"could not inspect texture: {e}")
    for icon in (os.path.join(BP, "pack_icon.png"), os.path.join(RP, "pack_icon.png")):
        if not os.path.isfile(icon):
            warn(f"missing {rel(icon)}")
    return sound_ids, anim_map


# --------------------------------------------------------------------------- scripts
def check_scripts(event_names, prop_names, sound_ids):
    sdir = os.path.join(BP, "scripts")
    files = list(walk(sdir, (".js",)))
    if not files:
        err("no scripts found")
        return
    for f in files:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if r.returncode != 0:
            err(f"node --check failed for {rel(f)}: {r.stderr.strip()[:300]}")
        src = open(f, encoding="utf-8").read()
        for m in re.finditer(r"from\s+['\"](\.[^'\"]+)['\"]", src):
            target = os.path.normpath(os.path.join(os.path.dirname(f), m.group(1)))
            if not os.path.isfile(target):
                err(f"{rel(f)}: import {m.group(1)} does not resolve")
        for m in re.finditer(r"from\s+['\"](@[^'\"]+)['\"]", src):
            if m.group(1) != "@minecraft/server":
                err(f"{rel(f)}: imports {m.group(1)} which is not a declared dependency")
        for m in re.finditer(r"['\"](horror:[a-z0-9_]+)['\"]", src):
            name = m.group(1)
            if name == ENTITY_ID or name in event_names or name in prop_names:
                continue
            if name.startswith("horror:") and not name.startswith(("horror:giant_spider_spawn_egg",)):
                err(f"{rel(f)}: '{name}' is neither a defined event nor a property")
        for m in re.finditer(r"['\"](mob\.giant_spider\.[a-z_0-9]+)['\"]", src):
            if m.group(1) not in sound_ids:
                err(f"{rel(f)}: sound {m.group(1)} not defined in sound_definitions.json")
        for m in re.finditer(r"['\"](minecraft:[a-z_0-9]+(?:_emitter|_particle|_plume))['\"]", src):
            if VANILLA_PARTICLES and m.group(1) not in VANILLA_PARTICLES:
                err(f"{rel(f)}: particle {m.group(1)} not a vanilla particle in 1.21.0.26")
    checker = os.path.join(ROOT, "tools", "check_script_api.py")
    if os.path.isfile(checker):
        r = subprocess.run([sys.executable, checker], capture_output=True, text=True)
        if r.returncode != 0:
            err(f"check_script_api.py failed:\n{(r.stdout + r.stderr)[-1500:]}")
        else:
            note("check_script_api.py: OK")
    else:
        warn("tools/check_script_api.py not found")


# --------------------------------------------------------------------------- archives
def check_archives():
    dist = os.path.join(ROOT, "dist")
    addon = os.path.join(dist, "GiantSpiderHunter.mcaddon")
    if not os.path.isfile(addon):
        err("dist/GiantSpiderHunter.mcaddon missing (run tools/build.py)")
        return
    with zipfile.ZipFile(addon) as z:
        names = z.namelist()
        packs = [n for n in names if n.endswith(".mcpack")]
        if sorted(packs) != ["GiantSpiderHunter_BP.mcpack", "GiantSpiderHunter_RP.mcpack"]:
            err(f"mcaddon contents unexpected: {names}")
        for p in packs:
            import io
            inner = zipfile.ZipFile(io.BytesIO(z.read(p)))
            inames = inner.namelist()
            if "manifest.json" not in inames:
                err(f"{p}: manifest.json not at archive root")
            bad = inner.testzip()
            if bad:
                err(f"{p}: corrupt member {bad}")
            src_dir = BP if "_BP" in p else RP
            expected = sorted(os.path.relpath(f, src_dir).replace(os.sep, "/")
                              for f in walk(src_dir, ("",)) if not os.path.basename(f).startswith("."))
            if sorted(inames) != expected:
                missing = set(expected) - set(inames)
                extra = set(inames) - set(expected)
                err(f"{p}: archive out of date (missing {sorted(missing)[:5]}, extra {sorted(extra)[:5]})")
            note(f"{p}: {len(inames)} files")
    src = os.path.join(dist, "GiantSpiderHunter-source.zip")
    if not os.path.isfile(src):
        err("source zip missing")


def main():
    check_manifests()
    ent, prop_names, event_names = check_bp()
    sound_ids, _ = check_rp(prop_names)
    check_scripts(event_names, prop_names, sound_ids)
    if "--archives" in sys.argv:
        check_archives()
    for n in notes:
        print("NOTE   ", n)
    for w in warnings:
        print("WARNING", w)
    for e in errors:
        print("ERROR  ", e)
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

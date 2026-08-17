#!/usr/bin/env python3
"""Full pre-packaging audit for Lost Island: Abandoned.

Fails the build on anything that would produce a Minecraft content error, a
broken reference, a command that does not exist in Bedrock 1.21.0, or a
performance problem. Run: python3 tools/validate.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
RP = os.path.join(ROOT, "build", "Lost_Island_RP")

ERR = []
WARN = []
INFO = {}


def err(msg):
    ERR.append(msg)


def warn(msg):
    WARN.append(msg)


# ---------------------------------------------------------------------------
# commands that exist in Bedrock 1.21.0 and are used by this pack
ALLOWED_COMMANDS = {
    "scoreboard", "execute", "tag", "tellraw", "titleraw", "title", "effect",
    "give", "clear", "summon", "kill", "playsound", "stopsound", "particle",
    "weather", "fog", "time", "gamerule", "tp", "teleport", "spawnpoint",
    "setworldspawn", "function", "loot", "setblock", "fill", "damage",
    "ride", "camerashake", "music", "difficulty", "structure", "event",
    "inputpermission", "dialogue", "replaceitem", "item", "spreadplayers",
}
# commands that do NOT exist in Bedrock, or not until after 1.21.0
BANNED_COMMANDS = {
    "data", "advancement", "attribute", "bossbar", "datapack", "forceload",
    "place", "random", "return", "schedule", "team", "trigger", "worldborder",
    "recipe", "jfr", "perf", "debug", "hud", "waypoint",
}
BANNED_TEXT = [
    ("@minecraft/server", "Script API import"),
    ("minecraft:custom_components", "1.21.10+ item component"),
    ("execute if items", "1.21.20+ execute subcommand"),
    ("minecraft:liquid_detection", "1.21.60+ block component"),
    ("minecraft:item_visual", "1.21.30+ block component"),
    ("minecraft:rarity", "post-1.21.0 item component"),
    ("minecraft:storage_item", "post-1.21.0 item component"),
    ("minecraft:dyeable", "post-1.21.0 item component"),
    ("limit=", "Java-only selector argument (use c=)"),
    ("distance=", "Java-only selector argument (use r=)"),
    ("selector=", "Java-only rawtext key"),
    ("nbt=", "Java-only selector argument"),
]
# vanilla sound events referenced by the pack (SPEC.md section 0)
ALLOWED_SOUNDS = {
    "ambient.cave", "ambient.weather.thunder", "ambient.weather.rain",
    "mob.wolf.growl", "mob.wolf.bark", "mob.wolf.hurt", "mob.wolf.death",
    "mob.husk.ambient", "mob.zombie.say", "mob.zombie.hurt",
    "mob.zombie.death", "mob.spider.say", "mob.spider.death",
    "mob.silverfish.say", "mob.silverfish.hurt", "mob.enderman.idle",
    "mob.enderman.portal", "mob.enderman.scream", "mob.ravager.ambient",
    "mob.ravager.roar", "mob.ravager.hurt", "mob.ravager.death",
    "mob.warden.heartbeat", "mob.warden.nearby_close", "mob.warden.listening",
    "mob.villager.idle", "mob.villager.hurt", "mob.pig.say", "mob.pig.death",
    "mob.chicken.say", "mob.chicken.hurt", "mob.cow.say", "mob.rabbit.hurt",
    "random.click", "random.pop", "random.burp", "random.drink", "random.eat",
    "random.orb", "random.levelup", "random.anvil_use", "random.break",
    "random.explode", "random.fizz", "random.glass", "random.bowhit",
    "note.bass", "note.harp", "note.pling", "beacon.activate",
    "beacon.deactivate", "beacon.ambient", "portal.portal", "portal.travel",
    "fire.ignite", "fire.fire", "bucket.fill_water", "bucket.empty_water",
    "item.trident.thunder", "dig.stone", "dig.wood", "dig.gravel", "dig.grass",
    "step.stone", "use_attack.nodamage", "open.iron_door", "close.iron_door",
    "raid.horn", "conduit.activate", "record.13", "record.11",
    "respawn_anchor.charge",
}
VALID_EFFECTS = {
    "speed", "slowness", "haste", "mining_fatigue", "strength",
    "instant_health", "instant_damage", "jump_boost", "nausea",
    "regeneration", "resistance", "fire_resistance", "water_breathing",
    "invisibility", "blindness", "night_vision", "hunger", "weakness",
    "poison", "wither", "health_boost", "absorption", "saturation",
    "levitation", "fatal_poison", "slow_falling", "conduit_power",
    "village_hero", "darkness", "clear",
}


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:                     # noqa: BLE001
        err("JSON parse failure in %s: %s" % (rel(path), e))
        return None


def rel(p):
    return os.path.relpath(p, ROOT)


def walk(root, ext):
    for d, _sub, files in os.walk(root):
        for fn in files:
            if fn.endswith(ext):
                yield os.path.join(d, fn)


# ===========================================================================
def check_json_parses():
    n = 0
    for pack in (BP, RP):
        for p in walk(pack, ".json"):
            if load_json(p) is not None:
                n += 1
            if os.path.getsize(p) == 0:
                err("empty JSON file: %s" % rel(p))
    INFO["json_files"] = n


def check_manifests():
    ids = {}
    for pack, kind in ((BP, "data"), (RP, "resources")):
        m = load_json(os.path.join(pack, "manifest.json"))
        if not m:
            err("missing manifest in %s" % rel(pack))
            continue
        if m.get("format_version") != 2:
            err("%s manifest format_version must be 2" % rel(pack))
        h = m.get("header", {})
        if h.get("min_engine_version") != [1, 21, 0]:
            err("%s min_engine_version must be [1,21,0], got %r"
                % (rel(pack), h.get("min_engine_version")))
        for u, where in [(h.get("uuid"), "header")] + \
                [(mod.get("uuid"), "module") for mod in m.get("modules", [])]:
            if not u or not re.fullmatch(
                    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-"
                    r"[0-9a-f]{12}", u or ""):
                err("%s %s uuid malformed: %r" % (rel(pack), where, u))
            elif u in ids:
                err("duplicate UUID %s in %s and %s" % (u, ids[u], rel(pack)))
            else:
                ids[u] = rel(pack)
        mods = m.get("modules", [])
        if len(mods) != 1 or mods[0].get("type") != kind:
            err("%s must declare exactly one '%s' module" % (rel(pack), kind))
        for mod in mods:
            if mod.get("type") == "script":
                err("%s declares a script module (banned)" % rel(pack))
        if "dependencies" not in m or not m["dependencies"]:
            err("%s has no dependencies entry" % rel(pack))
    # BP <-> RP dependency wiring
    bp = load_json(os.path.join(BP, "manifest.json")) or {}
    rp = load_json(os.path.join(RP, "manifest.json")) or {}
    bp_h = bp.get("header", {}).get("uuid")
    rp_h = rp.get("header", {}).get("uuid")
    bp_deps = [d.get("uuid") for d in bp.get("dependencies", [])]
    rp_deps = [d.get("uuid") for d in rp.get("dependencies", [])]
    if rp_h not in bp_deps:
        err("BP does not depend on the RP header UUID")
    if bp_h not in rp_deps:
        err("RP does not depend on the BP header UUID")
    for pack in (BP, RP):
        if not os.path.exists(os.path.join(pack, "pack_icon.png")):
            err("%s is missing pack_icon.png" % rel(pack))
    INFO["uuids"] = len(ids)


def check_items():
    atlas = load_json(os.path.join(RP, "textures", "item_texture.json")) or {}
    tex_keys = set(atlas.get("texture_data", {}).keys())
    for k, v in atlas.get("texture_data", {}).items():
        pth = os.path.join(RP, v["textures"] + ".png")
        if not os.path.exists(pth):
            err("item_texture.json key %s points at missing %s"
                % (k, v["textures"]))
    ids = set()
    converts = []
    for p in walk(os.path.join(BP, "items"), ".json"):
        d = load_json(p)
        if not d:
            continue
        it = d.get("minecraft:item", {})
        desc = it.get("description", {})
        ident = desc.get("identifier")
        ids.add(ident)
        if d.get("format_version") != "1.20.50":
            warn("%s item format_version %r" % (rel(p), d.get("format_version")))
        comp = it.get("components", {})
        icon = comp.get("minecraft:icon")
        if not isinstance(icon, dict) or "texture" not in icon:
            err("%s minecraft:icon must be {\"texture\": ...} on 1.21.0"
                % rel(p))
        elif icon["texture"] not in tex_keys:
            err("%s icon '%s' is not registered in item_texture.json"
                % (rel(p), icon["texture"]))
        food = comp.get("minecraft:food", {})
        if "using_converts_to" in food:
            converts.append((rel(p), food["using_converts_to"]))
        cat = desc.get("menu_category", {}).get("category")
        if cat not in ("construction", "equipment", "items", "nature", "none"):
            err("%s invalid menu_category %r" % (rel(p), cat))
    for src, target in converts:
        if target not in ids:
            err("%s using_converts_to '%s' does not exist" % (src, target))
    INFO["items"] = len(ids)
    return ids


def check_blocks():
    atlas = load_json(os.path.join(RP, "textures", "terrain_texture.json")) or {}
    keys = set(atlas.get("texture_data", {}).keys())
    for k, v in atlas.get("texture_data", {}).items():
        if not os.path.exists(os.path.join(RP, v["textures"] + ".png")):
            err("terrain_texture.json key %s points at missing %s"
                % (k, v["textures"]))
    ids = set()
    for p in walk(os.path.join(BP, "blocks"), ".json"):
        d = load_json(p)
        if not d:
            continue
        b = d.get("minecraft:block", {})
        ids.add(b.get("description", {}).get("identifier"))
        mats = b.get("components", {}).get("minecraft:material_instances", {})
        for inst in mats.values():
            t = inst.get("texture")
            if t not in keys:
                err("%s material texture '%s' missing from terrain_texture.json"
                    % (rel(p), t))
        le = b.get("components", {}).get("minecraft:light_emission")
        if le is not None and not (isinstance(le, int) and 0 <= le <= 15):
            err("%s light_emission must be an int 0-15" % rel(p))
    INFO["blocks"] = len(ids)
    return ids


def check_entities():
    bp_ids, loot_refs = set(), []
    for p in walk(os.path.join(BP, "entities"), ".json"):
        d = load_json(p)
        if not d:
            continue
        e = d.get("minecraft:entity", {})
        desc = e.get("description", {})
        bp_ids.add(desc.get("identifier"))
        if desc.get("is_experimental"):
            err("%s is_experimental must be false" % rel(p))
        comp = e.get("components", {})
        t = comp.get("minecraft:loot", {}).get("table")
        if t:
            loot_refs.append((rel(p), t))
        # every component group referenced by an event must exist
        groups = set(e.get("component_groups", {}).keys())
        for ev, body in (e.get("events") or {}).items():
            for action in ("add", "remove"):
                for g in (body.get(action) or {}).get("component_groups", []):
                    if g not in groups:
                        err("%s event %s references unknown group %s"
                            % (rel(p), ev, g))
        # events referenced by environment_sensor / timer must exist
        evs = set((e.get("events") or {}).keys())
        for trig in comp.get("minecraft:environment_sensor", {}).get(
                "triggers", []):
            if trig.get("event") and trig["event"] not in evs:
                err("%s environment_sensor fires undefined event %s"
                    % (rel(p), trig["event"]))
        for g in e.get("component_groups", {}).values():
            tdown = g.get("minecraft:timer", {}).get("time_down_event", {})
            if tdown.get("event") and tdown["event"] not in evs:
                err("%s timer fires undefined event %s"
                    % (rel(p), tdown["event"]))
    for src, t in loot_refs:
        if not os.path.exists(os.path.join(BP, t)):
            err("%s loot table missing: %s" % (src, t))

    # spawn rules
    for p in walk(os.path.join(BP, "spawn_rules"), ".json"):
        d = load_json(p)
        if not d:
            continue
        sr = d.get("minecraft:spawn_rules", {})
        ident = sr.get("description", {}).get("identifier")
        if ident not in bp_ids:
            err("%s spawn rule for unknown entity %s" % (rel(p), ident))
        for cond in sr.get("conditions", []):
            dl = cond.get("minecraft:density_limit", {})
            for k, v in dl.items():
                if v > 4:
                    warn("%s density_limit %s=%d is high for mobile"
                         % (rel(p), k, v))

    # client entities
    geos, anims, acs, rcs = set(), set(), set(), set()
    for p in walk(os.path.join(RP, "models"), ".json"):
        d = load_json(p) or {}
        for g in d.get("minecraft:geometry", []):
            geos.add(g["description"]["identifier"])
    for p in walk(os.path.join(RP, "animations"), ".json"):
        anims |= set((load_json(p) or {}).get("animations", {}).keys())
    for p in walk(os.path.join(RP, "animation_controllers"), ".json"):
        acs |= set((load_json(p) or {}).get("animation_controllers", {}).keys())
    for p in walk(os.path.join(RP, "render_controllers"), ".json"):
        rcs |= set((load_json(p) or {}).get("render_controllers", {}).keys())

    rp_ids = set()
    for p in walk(os.path.join(RP, "entity"), ".json"):
        d = load_json(p)
        if not d:
            continue
        desc = d.get("minecraft:client_entity", {}).get("description", {})
        rp_ids.add(desc.get("identifier"))
        for g in desc.get("geometry", {}).values():
            if g not in geos:
                err("%s references missing geometry %s" % (rel(p), g))
        for a in desc.get("animations", {}).values():
            if a.startswith("controller."):
                if a not in acs:
                    err("%s references missing animation controller %s"
                        % (rel(p), a))
            elif a not in anims:
                err("%s references missing animation %s" % (rel(p), a))
        for t in desc.get("textures", {}).values():
            if not os.path.exists(os.path.join(RP, t + ".png")):
                err("%s references missing texture %s.png" % (rel(p), t))
        for r in desc.get("render_controllers", []):
            name = r if isinstance(r, str) else list(r.keys())[0]
            if name not in rcs:
                err("%s references missing render controller %s"
                    % (rel(p), name))
        # animate scripts must name a declared animation key
        for entry in desc.get("scripts", {}).get("animate", []):
            key = entry if isinstance(entry, str) else list(entry.keys())[0]
            if key not in desc.get("animations", {}):
                err("%s animate '%s' is not in the animations map"
                    % (rel(p), key))
    for i in bp_ids:
        if i not in rp_ids:
            err("entity %s has no client entity definition" % i)
    for i in rp_ids:
        if i not in bp_ids:
            err("client entity %s has no behaviour definition" % i)

    # UV bounds must fit the declared texture
    for p in walk(os.path.join(RP, "models"), ".json"):
        d = load_json(p) or {}
        for g in d.get("minecraft:geometry", []):
            tw = g["description"].get("texture_width", 64)
            th = g["description"].get("texture_height", 64)
            for b in g.get("bones", []):
                for c in b.get("cubes", []):
                    u, v = c["uv"]
                    wd, ht, dp = c["size"]
                    if u + 2 * (wd + dp) > tw or v + ht + dp > th:
                        err("%s bone %s cube UV overflows the texture"
                            % (rel(p), b["name"]))
    INFO["entities"] = len(bp_ids)
    return bp_ids


def check_loot_and_recipes(item_ids, block_ids):
    for p in walk(os.path.join(BP, "loot_tables"), ".json"):
        d = load_json(p)
        if not d:
            continue
        if "pools" not in d:
            err("%s loot table has no pools" % rel(p))
            continue
        for pool in d["pools"]:
            if "entries" not in pool:
                err("%s pool without entries" % rel(p))
            for e in pool.get("entries", []):
                if e.get("type") == "item":
                    nm = e.get("name", "")
                    if nm.startswith("li:") and nm not in item_ids \
                            and nm not in block_ids:
                        err("%s references unknown item %s" % (rel(p), nm))
                elif e.get("type") not in ("empty", "loot_table"):
                    err("%s unknown entry type %r" % (rel(p), e.get("type")))
    for p in walk(os.path.join(BP, "recipes"), ".json"):
        d = load_json(p)
        if not d:
            continue
        for key, body in d.items():
            if not key.startswith("minecraft:recipe"):
                continue
            refs = []
            if "ingredients" in body:
                refs += [i.get("item") for i in body["ingredients"]]
            if "key" in body:
                refs += [v.get("item") for v in body["key"].values()]
            if "input" in body:
                refs.append(body["input"] if isinstance(body["input"], str)
                            else body["input"].get("item"))
            res = body.get("result")
            if isinstance(res, dict):
                refs.append(res.get("item"))
            elif isinstance(res, str):
                refs.append(res)
            for r in refs:
                if r and r.startswith("li:") and r not in item_ids \
                        and r not in block_ids:
                    err("%s references unknown item %s" % (rel(p), r))
            if not body.get("tags"):
                err("%s recipe has no tags (crafting_table/furnace)" % rel(p))


# ===========================================================================
FILL_RE = re.compile(r"^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) "
                     r"(\S+)")
SETBLOCK_RE = re.compile(r"^setblock (-?\d+) (-?\d+) (-?\d+) (\S+)")


def check_functions(item_ids, entity_ids, block_ids):
    fn_root = os.path.join(BP, "functions")
    have = set()
    for p in walk(fn_root, ".mcfunction"):
        have.add(os.path.relpath(p, fn_root)[:-len(".mcfunction")]
                 .replace(os.sep, "/"))
    INFO["functions"] = len(have)

    tick = load_json(os.path.join(fn_root, "tick.json")) or {}
    for v in tick.get("values", []):
        if v not in have:
            err("tick.json references missing function %s" % v)

    max_vol, worst = 0, None
    max_cmds, worst_f = 0, None
    valid_blocks = set(P.WHITELIST) | block_ids
    sounds_used, effects_used = set(), set()

    for p in walk(fn_root, ".mcfunction"):
        with open(p, encoding="utf-8") as f:
            lines = [ln.strip() for ln in f]
        cmds = [ln for ln in lines if ln and not ln.startswith("#")]
        if len(cmds) > max_cmds:
            max_cmds, worst_f = len(cmds), rel(p)
        for ln in cmds:
            for bad, why in BANNED_TEXT:
                if bad in ln:
                    err("%s uses banned %s (%s)" % (rel(p), bad, why))
            # the leading command, after stripping execute subcommands
            body = ln
            while body.startswith("execute "):
                m = re.search(r"\brun\s+(.*)$", body)
                if not m:
                    break
                body = m.group(1).strip()
            head = body.split()[0] if body.split() else ""
            if head in BANNED_COMMANDS:
                err("%s uses command '%s' which is not valid Bedrock 1.21.0"
                    % (rel(p), head))
            elif head and head not in ALLOWED_COMMANDS:
                err("%s uses unrecognised command '%s'" % (rel(p), head))
            # function references resolve
            for m in re.finditer(r"\bfunction ([A-Za-z0-9_/]+)", ln):
                if m.group(1) not in have:
                    err("%s calls missing function %s" % (rel(p), m.group(1)))
            # loot tables resolve
            for m in re.finditer(r'loot "([^"]+)"', ln):
                t = os.path.join(BP, "loot_tables", m.group(1) + ".json")
                if not os.path.exists(t):
                    err("%s references missing loot table %s"
                        % (rel(p), m.group(1)))
            # summoned entities exist
            for m in re.finditer(r"\bsummon (li:[a-z_]+)", ln):
                if m.group(1) not in entity_ids:
                    err("%s summons unknown entity %s" % (rel(p), m.group(1)))
            # give/clear items exist
            for m in re.finditer(r"\b(?:give|clear) \S+ (li:[a-z_]+)", ln):
                if m.group(1) not in item_ids:
                    err("%s gives/clears unknown item %s"
                        % (rel(p), m.group(1)))
            for m in re.finditer(r"hasitem=\{item=(li:[a-z_]+)", ln):
                if m.group(1) not in item_ids:
                    err("%s hasitem on unknown item %s" % (rel(p), m.group(1)))
            # sounds
            for m in re.finditer(r"\bplaysound (\S+)", ln):
                sounds_used.add(m.group(1))
            # effects
            m = re.search(r"\beffect @\S+ ([a-z_]+)", ln)
            if m:
                effects_used.add(m.group(1))
            # fill volume + block ids
            fm = FILL_RE.match(body)
            if fm:
                x0, y0, z0, x1, y1, z1 = (int(fm.group(i)) for i in range(1, 7))
                vol = (abs(x1 - x0) + 1) * (abs(y1 - y0) + 1) * \
                      (abs(z1 - z0) + 1)
                if vol > 32768:
                    err("%s fill volume %d exceeds the 32768 Bedrock limit"
                        % (rel(p), vol))
                if vol > max_vol:
                    max_vol, worst = vol, rel(p)
                blk = fm.group(7).split("[")[0]
                if blk not in valid_blocks:
                    err("%s fill uses unverified block id %s" % (rel(p), blk))
            sm = SETBLOCK_RE.match(body)
            if sm:
                blk = sm.group(4).split("[")[0]
                if blk not in valid_blocks:
                    err("%s setblock uses unverified block id %s"
                        % (rel(p), blk))
            # selector hygiene
            for m in re.finditer(r"@e\[([^\]]*)\]", ln):
                a = m.group(1)
                if not any(k in a for k in ("type=", "family=", "r=", "c=")):
                    err("%s unbounded @e selector: @e[%s]" % (rel(p), a))
            for m in re.finditer(r"\br=(\d+)", ln):
                if int(m.group(1)) > 64:
                    warn("%s uses a large radius r=%s" % (rel(p), m.group(1)))

    for s in sorted(sounds_used):
        if s not in ALLOWED_SOUNDS:
            err("unverified sound event '%s'" % s)
    for e in sorted(effects_used):
        if e not in VALID_EFFECTS:
            err("unknown effect '%s'" % e)
    INFO["max_fill_volume"] = "%d (%s)" % (max_vol, worst)
    INFO["max_cmds_per_function"] = "%d (%s)" % (max_cmds, worst_f)
    if max_cmds > 200:
        err("function %s has %d commands; keep build steps under 200"
            % (worst_f, max_cmds))


def check_sounds_json():
    p = os.path.join(RP, "sounds.json")
    if not os.path.exists(p):
        warn("no sounds.json")
        return
    d = load_json(p) or {}
    for ident, body in d.get("entity_sounds", {}).get("entities", {}).items():
        for ev, snd in body.get("events", {}).items():
            name = snd if isinstance(snd, str) else snd.get("sound")
            if name not in ALLOWED_SOUNDS:
                err("sounds.json %s/%s uses unverified sound '%s'"
                    % (ident, ev, name))
    # this pack intentionally ships no audio files
    sd = os.path.join(RP, "sounds", "sound_definitions.json")
    if os.path.exists(sd):
        defs = load_json(sd) or {}
        for name, body in defs.get("sound_definitions", {}).items():
            for s in body.get("sounds", []):
                fn = s if isinstance(s, str) else s.get("name")
                if fn and not any(
                        os.path.exists(os.path.join(RP, fn + e))
                        for e in (".ogg", ".fsb")):
                    err("sound_definitions '%s' points at missing audio %s"
                        % (name, fn))


def check_fogs():
    for p in walk(os.path.join(RP, "fogs"), ".json"):
        d = load_json(p) or {}
        ident = d.get("minecraft:fog_settings", {}).get(
            "description", {}).get("identifier")
        if not ident:
            err("%s fog has no identifier" % rel(p))
    # every fog pushed by a function must be defined
    defined = set()
    for p in walk(os.path.join(RP, "fogs"), ".json"):
        d = load_json(p) or {}
        defined.add(d["minecraft:fog_settings"]["description"]["identifier"])
    for p in walk(os.path.join(BP, "functions"), ".mcfunction"):
        with open(p, encoding="utf-8") as f:
            for ln in f:
                m = re.search(r"fog \S+ push (\S+)", ln)
                if m and m.group(1) not in defined:
                    err("%s pushes undefined fog %s" % (rel(p), m.group(1)))


def check_textures():
    from PIL import Image
    n = 0
    for p in walk(RP, ".png"):
        try:
            im = Image.open(p)
            im.verify()
            im = Image.open(p)
            w, h = im.size
            if w > 256 or h > 256:
                warn("%s is %dx%d - large for mobile" % (rel(p), w, h))
            if w & (w - 1) or h & (h - 1):
                warn("%s is %dx%d (not a power of two)" % (rel(p), w, h))
            n += 1
        except Exception as e:                 # noqa: BLE001
            err("invalid PNG %s: %s" % (rel(p), e))
    INFO["textures"] = n


def check_lang():
    for pack in (BP, RP):
        for f in ("texts/en_US.lang", "texts/languages.json"):
            if not os.path.exists(os.path.join(pack, f)):
                err("%s missing %s" % (rel(pack), f))


def check_world_geometry():
    """Simulate the staged build and verify the world is actually traversable.

    The build is a long sequence of overlapping fills, so a structure poured
    later can silently seal a ladder shaft or a spawn point built earlier.
    This replays the commands in execution order and checks the routes.
    """
    fn = os.path.join(BP, "functions", "li_build")
    files = sorted(walk(os.path.join(fn, "t"), ".mcfunction")) + \
        sorted(walk(os.path.join(fn, "l"), ".mcfunction"))
    ops = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            for ln in fh:
                ln = ln.strip()
                m = FILL_RE.match(ln)
                if m:
                    a = [int(m.group(i)) for i in range(1, 7)]
                    ops.append((min(a[0], a[3]), max(a[0], a[3]),
                                min(a[1], a[4]), max(a[1], a[4]),
                                min(a[2], a[5]), max(a[2], a[5]),
                                m.group(7).split("[")[0]))
                    continue
                m = SETBLOCK_RE.match(ln)
                if m:
                    x, y, z = (int(m.group(i)) for i in range(1, 4))
                    ops.append((x, x, y, y, z, z, m.group(4).split("[")[0]))
    INFO["build_commands"] = len(ops)

    # candidate ladder columns
    cols = {}
    for ax, bx, ay, by, az, bz, blk in ops:
        if blk != "minecraft:ladder":
            continue
        for x in range(ax, bx + 1):
            for z in range(az, bz + 1):
                cols.setdefault((x, z), set()).update(range(ay, by + 1))
    cols = {k: v for k, v in cols.items() if len(v) >= 4}

    def column(x, z, y0, y1):
        out = {y: None for y in range(y0, y1 + 1)}
        for ax, bx, ay, by, az, bz, blk in ops:
            if ax <= x <= bx and az <= z <= bz:
                for y in range(max(ay, y0), min(by, y1) + 1):
                    out[y] = blk
        return out

    blocked = 0
    for (x, z), ys in sorted(cols.items()):
        y0, y1 = min(ys), max(ys)
        final = column(x, z, y0, y1)
        bad = [(y, b) for y, b in sorted(final.items())
               if b not in (None, "minecraft:ladder", "minecraft:air")]
        if bad:
            blocked += 1
            err("ladder shaft at x=%d z=%d is sealed at %s"
                % (x, z, ", ".join("y=%d by %s" % t for t in bad[:3])))
    INFO["ladder_shafts"] = "%d checked, %d blocked" % (len(cols), blocked)

    # the spawn point the build teleports players to must be breathable
    sx, sy, sz = 6, 64, 146
    col = column(sx, sy - 1, sz) if False else column(sx, sz, sy - 1, sy + 1)
    if col[sy] not in (None, "minecraft:air") or \
            col[sy + 1] not in (None, "minecraft:air"):
        err("spawn point %d %d %d is not clear: feet=%s head=%s"
            % (sx, sy, sz, col[sy], col[sy + 1]))
    if col[sy - 1] in (None, "minecraft:air", "minecraft:water"):
        err("spawn point %d %d %d has no solid ground (%s)"
            % (sx, sy, sz, col[sy - 1]))

    # every progression barricade must exist as a solid block before unlocking
    lp = os.path.join(ROOT, "tools", "out", "locked_areas.json")
    if os.path.exists(lp):
        with open(lp) as f:
            locks = json.load(f)
        for lk in locks:
            b = lk["box"]
            cx, cy, cz = (b[0] + b[3]) // 2, (b[1] + b[4]) // 2, \
                (b[2] + b[5]) // 2
            c = column(cx, cz, cy, cy)
            if c[cy] in (None, "minecraft:air"):
                err("locked area '%s' has no barricade block at its centre"
                    % lk["id"])
        INFO["locked_areas"] = len(locks)


def main():
    check_json_parses()
    check_manifests()
    item_ids = check_items()
    block_ids = check_blocks()
    entity_ids = check_entities()
    check_loot_and_recipes(item_ids, block_ids)
    check_functions(item_ids, entity_ids, block_ids)
    check_sounds_json()
    check_fogs()
    check_textures()
    check_lang()
    check_world_geometry()

    print("=" * 66)
    print("LOST ISLAND: ABANDONED - validation")
    print("=" * 66)
    for k, v in INFO.items():
        print("  %-24s %s" % (k, v))
    print("-" * 66)
    for wmsg in WARN:
        print("  WARN  %s" % wmsg)
    for e in ERR:
        print("  ERROR %s" % e)
    print("-" * 66)
    print("  %d error(s), %d warning(s)" % (len(ERR), len(WARN)))
    return 1 if ERR else 0


if __name__ == "__main__":
    sys.exit(main())

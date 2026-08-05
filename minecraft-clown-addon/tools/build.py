#!/usr/bin/env python3
"""Validate the Horror Clown packs and zip them into dist/HorrorClown.mcaddon.

Catches the mistakes that make a Bedrock addon load with no visible error but
a mob that is invisible, silent or missing: a geometry identifier that does not
match, a texture path that points nowhere, an animation that is listed but not
defined, a UV island that runs off the texture.
"""

import json
import os
import struct
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
BP = os.path.join(ROOT, "HorrorClown_BP")
RP = os.path.join(ROOT, "HorrorClown_RP")
PACKS = ["HorrorClown_BP", "HorrorClown_RP"]
OUT = os.path.join(REPO, "dist", "HorrorClown.mcaddon")


def fail(msg):
    print("ERROR: " + msg)
    return 1


def load(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as fh:
        return json.load(fh)


def png_size(path):
    with open(path, "rb") as fh:
        head = fh.read(24)
    return struct.unpack(">II", head[16:24])


def check_json():
    errors = 0
    for pack in PACKS:
        for dirpath, _dirs, files in os.walk(os.path.join(ROOT, pack)):
            for name in files:
                if name.endswith(".json"):
                    path = os.path.join(dirpath, name)
                    try:
                        load(path)
                    except ValueError as exc:
                        errors += fail("%s: %s" % (os.path.relpath(path, REPO), exc))
    return errors


def check_manifests():
    errors = 0
    uuids = set()
    for pack in PACKS:
        m = load(ROOT, pack, "manifest.json")
        uuids.add(m["header"]["uuid"])
        for mod in m["modules"]:
            uuids.add(mod["uuid"])
        if not os.path.exists(os.path.join(ROOT, pack, "pack_icon.png")):
            errors += fail("%s is missing pack_icon.png" % pack)
    if len(uuids) != 4:
        errors += fail("manifest UUIDs are not unique: %s" % sorted(uuids))
    bp = load(BP, "manifest.json")
    rp = load(RP, "manifest.json")
    if bp["dependencies"][0]["uuid"] != rp["header"]["uuid"]:
        errors += fail("BP dependency does not point at the RP header UUID")
    return errors


def check_client_entity():
    """The client entity is where an addon most often silently falls apart."""
    errors = 0
    desc = load(RP, "entity", "clown.entity.json")["minecraft:client_entity"]["description"]

    bp_id = load(BP, "entities", "clown.json")["minecraft:entity"]["description"]["identifier"]
    if desc["identifier"] != bp_id:
        errors += fail("client entity id %s != behaviour entity id %s" % (desc["identifier"], bp_id))

    for path in desc["textures"].values():
        if not os.path.exists(os.path.join(RP, path + ".png")):
            errors += fail("texture %s.png does not exist" % path)

    geo_ids = set()
    geo_by_id = {}
    for dirpath, _dirs, files in os.walk(os.path.join(RP, "models")):
        for name in files:
            if not name.endswith(".json"):
                continue
            data = load(dirpath, name)
            for geo in data.get("minecraft:geometry", []):
                ident = geo["description"]["identifier"]
                geo_ids.add(ident)
                geo_by_id[ident] = geo
    for ident in desc["geometry"].values():
        if ident not in geo_ids:
            errors += fail("geometry '%s' is referenced but not defined" % ident)

    anim_ids = set()
    for dirpath, _dirs, files in os.walk(os.path.join(RP, "animations")):
        for name in files:
            if name.endswith(".json"):
                anim_ids.update(load(dirpath, name).get("animations", {}))
    for key, ident in desc["animations"].items():
        # Vanilla animations live outside this pack; only check our own.
        if ident.startswith("animation.ssgm_") and ident not in anim_ids:
            errors += fail("animation '%s' (key %s) is not defined in this pack" % (ident, key))
    for key in desc["scripts"]["animate"]:
        key = list(key)[0] if isinstance(key, dict) else key
        if key not in desc["animations"]:
            errors += fail("scripts.animate lists '%s' which is not in animations" % key)

    rc_ids = set()
    for dirpath, _dirs, files in os.walk(os.path.join(RP, "render_controllers")):
        for name in files:
            if name.endswith(".json"):
                rc_ids.update(load(dirpath, name).get("render_controllers", {}))
    for ident in desc["render_controllers"]:
        ident = list(ident)[0] if isinstance(ident, dict) else ident
        if ident not in rc_ids:
            errors += fail("render controller '%s' is not defined" % ident)

    return errors, geo_by_id, desc


def check_geometry_uvs(geo_by_id, desc):
    """Every box UV island must fit inside the declared texture size."""
    errors = 0
    for ident, geo in geo_by_id.items():
        d = geo["description"]
        tw, th = d["texture_width"], d["texture_height"]
        for path in desc["textures"].values():
            pw, ph = png_size(os.path.join(RP, path + ".png"))
            if (pw, ph) != (tw, th):
                errors += fail(
                    "%s declares %dx%d but %s.png is %dx%d" % (ident, tw, th, path, pw, ph)
                )
        for bone in geo["bones"]:
            for cube in bone.get("cubes", []):
                u, v = cube["uv"]
                w, h, dep = cube["size"]
                need_w, need_h = 2 * dep + 2 * w, dep + h
                if u + need_w > tw or v + need_h > th:
                    errors += fail(
                        "bone %s cube at uv [%d,%d] needs %dx%d and runs off the %dx%d texture"
                        % (bone["name"], u, v, need_w, need_h, tw, th)
                    )
        names = [b["name"] for b in geo["bones"]]
        if len(names) != len(set(names)):
            errors += fail("%s has duplicate bone names" % ident)
        for bone in geo["bones"]:
            if "parent" in bone and bone["parent"] not in names:
                errors += fail("bone %s has unknown parent %s" % (bone["name"], bone["parent"]))
    return errors


def check_behaviour():
    errors = 0
    ent = load(BP, "entities", "clown.json")["minecraft:entity"]
    comps = ent["components"]

    table = comps["minecraft:loot"]["table"]
    if not os.path.exists(os.path.join(BP, table)):
        errors += fail("loot table %s does not exist" % table)

    spawn_id = load(BP, "spawn_rules", "clown.json")["minecraft:spawn_rules"]["description"]["identifier"]
    if spawn_id != ent["description"]["identifier"]:
        errors += fail("spawn rules id %s != entity id %s" % (spawn_id, ent["description"]["identifier"]))

    # Every event a component points at must actually be defined.
    events = set(ent.get("events", {}))
    timer_event = comps.get("minecraft:timer", {}).get("time_down_event", {}).get("event")
    if timer_event and timer_event not in events:
        errors += fail("minecraft:timer fires '%s' but no such event is defined" % timer_event)

    # Priorities must be distinct or the AI ordering is undefined.
    prios = {}
    for name, body in comps.items():
        if name.startswith("minecraft:behavior.") and isinstance(body, dict):
            prios.setdefault(body.get("priority"), []).append(name)
    for prio, names in prios.items():
        if len(names) > 1:
            errors += fail("behaviours share priority %s: %s" % (prio, names))

    sounds = load(RP, "sounds.json")["entity_sounds"]["entities"]
    if ent["description"]["identifier"] not in sounds:
        errors += fail("sounds.json has no entry for %s" % ent["description"]["identifier"])
    ambient = comps.get("minecraft:ambient_sound_interval", {}).get("event_name")
    if ambient and ambient not in sounds[ent["description"]["identifier"]]["events"]:
        errors += fail("ambient_sound_interval uses '%s' which sounds.json does not map" % ambient)

    return errors


def check_functions():
    errors = 0
    fdir = os.path.join(BP, "functions")
    names = set()
    for dirpath, _dirs, files in os.walk(fdir):
        for name in files:
            if name.endswith(".mcfunction"):
                rel = os.path.relpath(os.path.join(dirpath, name), fdir)
                names.add(rel[: -len(".mcfunction")].replace(os.sep, "/"))
    for dirpath, _dirs, files in os.walk(fdir):
        for name in files:
            if not name.endswith(".mcfunction"):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding="utf-8") as fh:
                for lineno, line in enumerate(fh, 1):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split()
                    if "function" in parts:
                        target = parts[parts.index("function") + 1]
                        if target not in names:
                            errors += fail("%s:%d calls missing function '%s'"
                                           % (os.path.relpath(path, REPO), lineno, target))
    return errors


def build():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACKS:
            base = os.path.join(ROOT, pack)
            for dirpath, _dirs, files in os.walk(base):
                for name in sorted(files):
                    path = os.path.join(dirpath, name)
                    arc = os.path.join(pack, os.path.relpath(path, base))
                    zf.write(path, arc.replace(os.sep, "/"))
    print("built %s (%d bytes)" % (os.path.relpath(OUT, REPO), os.path.getsize(OUT)))


def main():
    errors = check_json() + check_manifests()
    client_errors, geo_by_id, desc = check_client_entity()
    errors += client_errors
    errors += check_geometry_uvs(geo_by_id, desc)
    errors += check_behaviour()
    errors += check_functions()
    if errors:
        print("%d problem(s) found - not building." % errors)
        return 1
    print("all checks passed")
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())

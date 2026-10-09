#!/usr/bin/env python3
"""
Validates the Perfect Disguises packs and packages them for Minecraft.

  python3 tools/build_mcaddon.py

Outputs (in perfect-disguises/dist/):
  PerfectDisguises.mcaddon      <- open this on Android/Windows/iOS to install both packs
  PerfectDisguises_BP.mcpack    <- behavior pack only (fallback)
  PerfectDisguises_RP.mcpack    <- resource pack only (fallback)

The checks are static: valid strict JSON, manifests/UUIDs/dependencies, and
that every geometry, texture, render controller, animation, particle, sound
event and entity event referenced by one file exists in another.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "PerfectDisguises_BP")
RP = os.path.join(ROOT, "packs", "PerfectDisguises_RP")
DIST = os.path.join(ROOT, "dist")

errors = []


def fail(msg):
    errors.append(msg)
    print("  ERROR:", msg)


def ok(msg):
    print("  ok:", msg)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
def check_json_files():
    count = 0
    for base in (BP, RP):
        for dirpath, _, files in os.walk(base):
            for name in files:
                if name.endswith(".json"):
                    path = os.path.join(dirpath, name)
                    try:
                        load(path)
                        count += 1
                    except Exception as e:  # noqa: BLE001
                        fail(f"{os.path.relpath(path, ROOT)} is not valid JSON: {e}")
    ok(f"{count} JSON files parse as strict JSON")


def check_manifests():
    bp, rp = load(os.path.join(BP, "manifest.json")), load(os.path.join(RP, "manifest.json"))
    uuids = [bp["header"]["uuid"], rp["header"]["uuid"]] + [m["uuid"] for m in bp["modules"] + rp["modules"]]
    uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
    if len(set(uuids)) != len(uuids):
        fail("manifest UUIDs are not unique")
    for u in uuids:
        if not uuid_re.match(u):
            fail(f"bad UUID {u}")
    deps = {d.get("uuid") for d in bp["dependencies"]}
    if rp["header"]["uuid"] not in deps:
        fail("BP does not depend on the RP")
    if bp["header"]["uuid"] not in {d.get("uuid") for d in rp["dependencies"]}:
        fail("RP does not depend on the BP")
    modules = {d.get("module_name"): d.get("version") for d in bp["dependencies"] if "module_name" in d}
    if modules != {"@minecraft/server": "1.10.0", "@minecraft/server-ui": "1.1.0"}:
        fail(f"unexpected script module versions {modules}")
    script = [m for m in bp["modules"] if m["type"] == "script"]
    if not script or not os.path.isfile(os.path.join(BP, script[0]["entry"])):
        fail("script entry file missing")
    for m in (bp, rp):
        if m["header"]["min_engine_version"] != [1, 21, 0]:
            fail("min_engine_version should be 1.21.0")
    for icon in (os.path.join(BP, "pack_icon.png"), os.path.join(RP, "pack_icon.png")):
        if not os.path.isfile(icon):
            fail(f"missing {icon}")
    ok("manifests, UUIDs, dependencies and pack icons")


# ---------------------------------------------------------------------------
def geometry_ids():
    ids = {}
    folder = os.path.join(RP, "models", "entity")
    for name in os.listdir(folder):
        doc = load(os.path.join(folder, name))
        if "minecraft:geometry" in doc:
            for g in doc["minecraft:geometry"]:
                ids[g["description"]["identifier"]] = [b["name"] for b in g["bones"]]
        else:
            for k, v in doc.items():
                if k != "format_version":
                    ids[k.split(":")[0]] = [b["name"] for b in v["bones"]]
    return ids


def check_resource_pack():
    entity = load(os.path.join(RP, "entity", "player.entity.json"))["minecraft:client_entity"]["description"]
    geos = geometry_ids()
    anims = load(os.path.join(RP, "animations", "pd_disguises.animation.json"))["animations"]
    rcs = load(os.path.join(RP, "render_controllers", "pd_disguises.render_controllers.json"))["render_controllers"]

    for short, gid in entity["geometry"].items():
        if short.startswith("pd_"):
            if gid not in geos:
                fail(f"geometry {gid} not found")
            else:
                names = [n.lower() for n in geos[gid]]
                if len(names) != len(set(names)):
                    fail(f"{gid} has duplicate bone names")
                if "pd_hidden" not in names:
                    fail(f"{gid} lacks the pd_hidden bone")
    ok("disguise geometries exist with unique bone names")

    # animations used by the entity exist and animate bones that exist
    all_pd_bones = set()
    for gid, names in geos.items():
        all_pd_bones.update(n.lower() for n in names)
    for short, aid in entity["animations"].items():
        if short.startswith("pd_"):
            if aid not in anims:
                fail(f"animation {aid} missing")
                continue
            for bone in anims[aid]["bones"]:
                if bone.lower() not in all_pd_bones:
                    fail(f"{aid} animates unknown bone {bone}")
    used = set()
    for entry in entity["scripts"]["animate"]:
        short = entry if isinstance(entry, str) else next(iter(entry))
        used.add(short)
        if short not in entity["animations"]:
            fail(f"animate list uses unknown short name {short}")
    for short in entity["animations"]:
        if short.startswith("pd_") and short not in used:
            fail(f"animation {short} is declared but never played")
    ok("animations exist, are played, and target existing bones")

    # render controllers
    mats, texs = entity["materials"], entity["textures"]
    vanilla_rcs = {"controller.render.player.first_person", "controller.render.player.third_person",
                   "controller.render.player.first_person_spectator",
                   "controller.render.player.third_person_spectator", "controller.render.player.map"}
    for entry in entity["render_controllers"]:
        name = entry if isinstance(entry, str) else next(iter(entry))
        if name not in rcs and name not in vanilla_rcs:
            fail(f"render controller {name} missing")
    for name, rc in rcs.items():
        g = rc["geometry"].split(".", 1)[1]
        if g not in entity["geometry"]:
            fail(f"{name}: unknown geometry {g}")
        for m in rc["materials"]:
            for v in m.values():
                if v.split(".", 1)[1] not in mats:
                    fail(f"{name}: unknown material {v}")
        for t in rc["textures"]:
            if t.split(".", 1)[1] not in texs:
                fail(f"{name}: unknown texture {t}")
    ok("render controllers reference declared geometry/materials/textures")

    # item + ui textures
    item_tex = load(os.path.join(RP, "textures", "item_texture.json"))["texture_data"]
    item = load(os.path.join(BP, "items", "disguise_wand.json"))["minecraft:item"]
    icon = item["components"]["minecraft:icon"]["texture"]
    if icon not in item_tex:
        fail(f"item icon {icon} not in item_texture.json")
    elif not os.path.isfile(os.path.join(RP, item_tex[icon]["textures"] + ".png")):
        fail("wand texture file missing")
    ok("Disguise Wand icon resolves to a texture")


def check_behavior_pack():
    player = load(os.path.join(BP, "entities", "player.json"))["minecraft:entity"]
    groups, events = player["component_groups"], player["events"]

    def walk(node):
        if isinstance(node, dict):
            for key in ("add", "remove"):
                if key in node:
                    for g in node[key].get("component_groups", []):
                        yield g
            for v in node.values():
                yield from walk(v)
        elif isinstance(node, list):
            for v in node:
                yield from walk(v)

    for name, ev in events.items():
        for g in walk(ev):
            if g not in groups:
                fail(f"event {name} uses missing group {g}")

    def sensor_events(node):
        if isinstance(node, dict):
            if "event" in node and isinstance(node["event"], str):
                yield node["event"]
            for v in node.values():
                yield from sensor_events(v)
        elif isinstance(node, list):
            for v in node:
                yield from sensor_events(v)

    for ev in sensor_events(player["components"]):
        if ev not in events:
            fail(f"component triggers unknown event {ev}")
    ok("player.json events and groups are consistent")

    scripts_text = ""
    for name in os.listdir(os.path.join(BP, "scripts")):
        with open(os.path.join(BP, "scripts", name), encoding="utf-8") as f:
            scripts_text += f.read()
    disguise_text = open(os.path.join(BP, "scripts", "disguises.js"), encoding="utf-8").read()
    keys = re.findall(r'key: "([a-z_]+)",\s*\n\s*id: (\d+),', disguise_text)
    if len(keys) != 12:
        fail(f"expected 12 disguises, found {len(keys)}")
    for key, did in keys:
        if f"pd:set_{key}" not in events:
            fail(f"no event pd:set_{key}")
        elif groups[f"pd:{key}"]["minecraft:variant"]["value"] != int(did):
            fail(f"{key}: script id {did} != player.json variant")
        icon = os.path.join(RP, "textures", "pd", "ui", key + ".png")
        if not os.path.isfile(icon):
            fail(f"missing menu icon for {key}")
    for ev in set(re.findall(r'triggerEvent\("(pd:[a-z_0-9]+)"\)', scripts_text)):
        if ev not in events:
            fail(f"script triggers unknown event {ev}")
    ok("script disguise ids, events and menu icons match the packs")

    particles = set()
    for name in os.listdir(os.path.join(RP, "particles")):
        particles.add(load(os.path.join(RP, "particles", name))["particle_effect"]["description"]["identifier"])
    for pid in set(re.findall(r'"(pd:[a-z_]+)"', scripts_text)):
        if pid.startswith("pd:") and ("poof" in pid or "sparkle" in pid or "burst" in pid) and pid not in particles:
            fail(f"script uses missing particle {pid}")
    for icon in set(re.findall(r'"(textures/pd/ui/[a-z_]+)"', scripts_text)):
        if not os.path.isfile(os.path.join(RP, icon + ".png")):
            fail(f"script uses missing icon {icon}")
    ok("particles and icons used by scripts exist")

    functions = os.path.join(BP, "functions", "pd")
    for dirpath, _, files in os.walk(functions):
        for name in files:
            with open(os.path.join(dirpath, name), encoding="utf-8") as f:
                for line in f:
                    m = re.match(r"\s*(?:execute .* run )?scriptevent (pd:[a-z_]+)(?: ([a-z]+))?", line)
                    if m and m.group(2) and m.group(1) == "pd:disguise" and m.group(2) not in dict(keys):
                        fail(f"{name}: unknown disguise {m.group(2)}")
    ok("functions reference known disguises")


def check_scripts_syntax():
    node = shutil.which("node")
    if not node:
        print("  skip: node not installed, JS syntax not checked")
        return
    with tempfile.TemporaryDirectory() as tmp:
        for name in os.listdir(os.path.join(BP, "scripts")):
            src = os.path.join(BP, "scripts", name)
            dst = os.path.join(tmp, name.replace(".js", ".mjs"))
            shutil.copy(src, dst)
            r = subprocess.run([node, "--check", dst], capture_output=True, text=True)
            if r.returncode != 0:
                fail(f"{name}: {r.stderr.strip()}")
    ok("JavaScript syntax")


# ---------------------------------------------------------------------------
def zip_folder(zf, folder, prefix):
    for dirpath, dirnames, files in os.walk(folder):
        dirnames.sort()
        for name in sorted(files):
            path = os.path.join(dirpath, name)
            arc = os.path.join(prefix, os.path.relpath(path, folder)).replace(os.sep, "/")
            info = zipfile.ZipInfo(arc, date_time=(2024, 5, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(path, "rb") as f:
                zf.writestr(info, f.read())


def package():
    os.makedirs(DIST, exist_ok=True)
    outputs = {
        "PerfectDisguises.mcaddon": [(BP, "PerfectDisguises_BP"), (RP, "PerfectDisguises_RP")],
        "PerfectDisguises_BP.mcpack": [(BP, "")],
        "PerfectDisguises_RP.mcpack": [(RP, "")],
    }
    for name, parts in outputs.items():
        path = os.path.join(DIST, name)
        with zipfile.ZipFile(path, "w") as zf:
            for folder, prefix in parts:
                zip_folder(zf, folder, prefix)
        print(f"  built dist/{name} ({os.path.getsize(path) // 1024} KB)")


def main():
    print("Validating packs...")
    check_json_files()
    check_manifests()
    check_resource_pack()
    check_behavior_pack()
    check_scripts_syntax()
    if errors:
        print(f"\n{len(errors)} problem(s) found - not packaging.")
        sys.exit(1)
    print("Packaging...")
    package()
    print("Done.")


if __name__ == "__main__":
    main()

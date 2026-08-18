#!/usr/bin/env python3
"""Sanity checks for the Amusement Park addon before packaging."""
import json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "addon")
BP = os.path.join(ROOT, "behavior_packs", "amusement_park_bp")
RP = os.path.join(ROOT, "resource_packs", "amusement_park_rp")
errors, checked = [], 0


def load(path):
    global checked
    with open(path) as fh:
        checked += 1
        return json.load(fh)


for base, _, files in os.walk(ROOT):
    for name in files:
        if name.endswith(".json"):
            try:
                load(os.path.join(base, name))
            except Exception as exc:
                errors.append(f"invalid JSON: {os.path.join(base, name)}: {exc}")

bp = load(os.path.join(BP, "manifest.json"))
rp = load(os.path.join(RP, "manifest.json"))
if bp["dependencies"][0]["uuid"] != rp["header"]["uuid"]:
    errors.append("behaviour pack does not depend on the resource pack UUID")
if rp["dependencies"][0]["uuid"] != bp["header"]["uuid"]:
    errors.append("resource pack does not depend on the behaviour pack UUID")

uuids = [bp["header"]["uuid"], rp["header"]["uuid"]] + [m["uuid"] for m in bp["modules"] + rp["modules"]]
if len(set(uuids)) != len(uuids):
    errors.append("duplicate UUIDs across manifests")

tex = load(os.path.join(RP, "textures", "item_texture.json"))["texture_data"]
lang = open(os.path.join(BP, "texts", "en_US.lang")).read()

item_ids = []
for name in sorted(os.listdir(os.path.join(BP, "items"))):
    item = load(os.path.join(BP, "items", name))["minecraft:item"]
    ident = item["description"]["identifier"]
    item_ids.append(ident)
    icon = item["components"]["minecraft:icon"]["texture"]
    if icon not in tex:
        errors.append(f"{ident}: icon '{icon}' missing from item_texture.json")
    else:
        png = os.path.join(RP, tex[icon]["textures"] + ".png")
        if not os.path.exists(png):
            errors.append(f"{ident}: texture file {png} not found")
    if f"item.{ident}=" not in lang:
        errors.append(f"{ident}: no en_US.lang display name")

for name in sorted(os.listdir(os.path.join(BP, "recipes"))):
    result = load(os.path.join(BP, "recipes", name))["minecraft:recipe_shapeless"]["result"]["item"]
    if result not in item_ids:
        errors.append(f"recipe {name}: result {result} is not an item in this pack")

script = open(os.path.join(BP, "scripts", "main.js")).read()
for ident in item_ids:
    if ident not in script:
        errors.append(f"{ident}: no handler in scripts/main.js")

for png in ("pack_icon.png",):
    for pack in (BP, RP):
        if not os.path.exists(os.path.join(pack, png)):
            errors.append(f"missing {png} in {pack}")

print(f"checked {checked} JSON files, {len(item_ids)} items")
if errors:
    print("\n".join("  FAIL " + e for e in errors))
    sys.exit(1)
print("all checks passed")

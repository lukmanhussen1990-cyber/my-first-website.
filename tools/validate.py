#!/usr/bin/env python3
"""Sanity check the addon before it ships.

Catches the mistakes that are invisible until you are standing in the world:
a /fill bigger than the 32768 block limit, a typo'd block id, a function that
calls a file that does not exist, a broken manifest.

Run:  python3 tools/validate.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "behavior_packs", "luxury_house_bp")
RP = os.path.join(ROOT, "resource_packs", "luxury_house_rp")
FUNCTIONS = os.path.join(BP, "functions")

FILL_LIMIT = 32768
KNOWN_COMMANDS = {"fill", "setblock", "function", "tellraw", "titleraw", "playsound"}
FILL_MODES = {"destroy", "hollow", "keep", "outline", "replace"}

# Vanilla block ids used by this pack; all of them exist in Bedrock 1.21+.
ALLOWED_BLOCKS = {
    "minecraft:air", "minecraft:water", "minecraft:stone", "minecraft:dirt",
    "minecraft:grass_block", "minecraft:oak_log", "minecraft:oak_leaves",
    "minecraft:quartz_block", "minecraft:smooth_quartz", "minecraft:quartz_pillar",
    "minecraft:chiseled_quartz_block", "minecraft:quartz_stairs", "minecraft:quartz_slab",
    "minecraft:white_concrete", "minecraft:black_concrete", "minecraft:light_gray_carpet",
    "minecraft:red_carpet", "minecraft:polished_blackstone", "minecraft:gold_block",
    "minecraft:glass", "minecraft:glass_pane", "minecraft:sea_lantern", "minecraft:lantern",
    "minecraft:dark_oak_planks", "minecraft:dark_oak_stairs", "minecraft:dark_oak_slab",
    "minecraft:dark_oak_fence", "minecraft:dark_oak_door", "minecraft:bed",
    "minecraft:chest", "minecraft:barrel", "minecraft:furnace", "minecraft:blast_furnace",
    "minecraft:smoker", "minecraft:crafting_table", "minecraft:cauldron",
    "minecraft:brewing_stand", "minecraft:enchanting_table", "minecraft:bookshelf",
    "minecraft:jukebox", "minecraft:campfire", "minecraft:flower_pot", "minecraft:ladder",
}

COORD = re.compile(r"^~(-?\d+)?$")

errors = []
warnings = []


def coord(token, where):
    match = COORD.match(token)
    if not match:
        errors.append("%s: coordinate %r is not a tilde coordinate" % (where, token))
        return None
    return int(match.group(1) or 0)


def check_block(token, where):
    if token not in ALLOWED_BLOCKS:
        errors.append("%s: unknown block id %r" % (where, token))


def split_command(line):
    """Split a command into tokens, keeping a [..state..] argument in one piece."""
    tokens = []
    depth = 0
    current = ""
    for char in line:
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
        if char == " " and depth == 0:
            if current:
                tokens.append(current)
            current = ""
        else:
            current += char
    if current:
        tokens.append(current)
    return tokens


def check_function(path, all_names):
    name = os.path.relpath(path, FUNCTIONS)[: -len(".mcfunction")].replace(os.sep, "/")
    with open(path) as handle:
        lines = handle.read().splitlines()

    count = 0
    for number, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        count += 1
        where = "%s:%d" % (name, number)
        tokens = split_command(line)
        command = tokens[0]

        if command not in KNOWN_COMMANDS:
            errors.append("%s: unknown command %r" % (where, command))
            continue

        if command == "function":
            target = tokens[1]
            if target not in all_names:
                errors.append("%s: calls missing function %r" % (where, target))

        elif command == "setblock":
            if len(tokens) < 5:
                errors.append("%s: setblock needs x y z block" % where)
                continue
            for token in tokens[1:4]:
                coord(token, where)
            check_block(tokens[4], where)

        elif command == "fill":
            if len(tokens) < 8:
                errors.append("%s: fill needs two corners and a block" % where)
                continue
            box = [coord(token, where) for token in tokens[1:7]]
            if None in box:
                continue
            check_block(tokens[7], where)
            rest = [t for t in tokens[8:] if not t.startswith("[")]
            for token in rest:
                if token not in FILL_MODES:
                    errors.append("%s: unknown fill mode %r" % (where, token))
            volume = 1
            for axis in range(3):
                volume *= abs(box[axis + 3] - box[axis]) + 1
            if volume > FILL_LIMIT:
                errors.append("%s: fill covers %d blocks, the game allows %d"
                              % (where, volume, FILL_LIMIT))

    if count > 10000:
        errors.append("%s: %d commands, a function may hold at most 10000" % (name, count))
    return count


def check_manifests():
    with open(os.path.join(BP, "manifest.json")) as handle:
        bp = json.load(handle)
    with open(os.path.join(RP, "manifest.json")) as handle:
        rp = json.load(handle)

    uuids = [bp["header"]["uuid"], bp["modules"][0]["uuid"],
             rp["header"]["uuid"], rp["modules"][0]["uuid"]]
    if len(set(uuids)) != 4:
        errors.append("manifests: uuids must all be different")

    dependency = bp.get("dependencies", [{}])[0].get("uuid")
    if dependency != rp["header"]["uuid"]:
        errors.append("manifests: the behaviour pack does not depend on the resource pack uuid")

    for pack, path in ((bp, BP), (rp, RP)):
        if not os.path.exists(os.path.join(path, "pack_icon.png")):
            warnings.append("%s: no pack_icon.png" % os.path.basename(path))


def main():
    check_manifests()

    paths = []
    for directory, _, files in os.walk(FUNCTIONS):
        for filename in sorted(files):
            if filename.endswith(".mcfunction"):
                paths.append(os.path.join(directory, filename))
    paths.sort()

    names = set()
    for path in paths:
        relative = os.path.relpath(path, FUNCTIONS)[: -len(".mcfunction")]
        names.add(relative.replace(os.sep, "/"))

    total = sum(check_function(path, names) for path in paths)

    for warning in warnings:
        print("warning: %s" % warning)
    for error in errors:
        print("ERROR:   %s" % error)

    print("%d functions, %d commands" % (len(paths), total))
    if errors:
        print("FAILED with %d error(s)" % len(errors))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

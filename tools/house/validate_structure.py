#!/usr/bin/env python3
"""Independent validator for addon/behavior_pack/structures/pas/luxury_base.mcstructure.

It does NOT import the generator (blueprint.py / blocks.py / nbt_le.py).  It parses the
file with ``nbtlib`` (little-endian) when installed, otherwise with the small reader in
this file, and re-derives every orientation rule from PocketMine-MP 5.16.0 itself.

Checks
  1. NBT layout + tag types (root, size, block_indices, palette, block_position_data,
     structure_world_origin), flat index order ZYX (z fastest).
  2. Palette: names exist in mojang-blocks.json (1.21.0.26), FULL state sets, valid
     values, correct tag types (bool->Byte, int->Int, string->String), version
     18153475; optional cross-check against PocketMine BedrockData 1.21.0
     canonical_block_states.nbt (--canonical PATH).
  3. Block entities: every bed / chest / flower pot has block_entity_data matching the
     block (id, x/y/z = local position, colour, Items with valid item names ...).
  4. Semantics: bed foot/head pairs, door lower/upper pairs + doorway sanity + mirrored
     double doors, lantern supports, carpets/pots/doors/beds supported, chests openable,
     enchanting table power (Bedrock bookshelf rule) >= 15.
  5. Walkability: BFS for a 0.6x1.8 player (step-up <= 0.5625, drops <= 3, stairs
     directional, doors passable, open trapdoors block their face) from HOUSE.entrance;
     every door, every bed and work block usable, both floors, the stairs and the
     balcony reached; every reached spot can walk back to the entrance.
  6. Lighting: block-light BFS (sources: lantern 15, sea_lantern 15, glowstone 15,
     torch 14, end_rod 14, soul_lantern 10; light passes only through air-like blocks
     listed in LIGHT_PASS, -1 per step, everything else opaque = conservative);
     every reachable standing spot >= 8 and every spawnable surface in the box >= 8.

Exit code 0 = pass.  ``--json`` prints a machine-readable summary.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import struct
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_STRUCT = ROOT / "addon" / "behavior_pack" / "structures" / "pas" / "luxury_base.mcstructure"
DEFAULT_META = ROOT / "addon" / "behavior_pack" / "scripts" / "house" / "blueprint_meta.js"
DEFAULT_REF = ("/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/"
               "scratchpad/ref/bedrock-samples-1.21.0.26")
EXPECTED_VERSION = 18153475  # (1<<24)|(21<<16)|(0<<8)|3

# ---------------------------------------------------------------- typed NBT model
# every tag is a tuple (type_name, value); lists are ("list", (elem_type_name, [tags]))


def _from_nbtlib(tag):
    from nbtlib import tag as T
    if isinstance(tag, T.Compound):
        return ("compound", {str(k): _from_nbtlib(v) for k, v in tag.items()})
    if isinstance(tag, T.List):
        sub = getattr(tag, "subtype", None)
        sub_name = _NBTLIB_NAMES.get(sub, "end") if sub is not None else "end"
        return ("list", (sub_name, [_from_nbtlib(v) for v in tag]))
    for cls, name in ((T.Byte, "byte"), (T.Short, "short"), (T.Int, "int"), (T.Long, "long"),
                      (T.Float, "float"), (T.Double, "double"), (T.String, "string")):
        if isinstance(tag, cls):
            return (name, str(tag) if name == "string" else (float(tag) if name in ("float", "double") else int(tag)))
    raise TypeError(type(tag))


try:
    import nbtlib  # type: ignore
    from nbtlib import tag as _T

    _NBTLIB_NAMES = {_T.End: "end", _T.Byte: "byte", _T.Short: "short", _T.Int: "int", _T.Long: "long",
                     _T.Float: "float", _T.Double: "double", _T.String: "string", _T.List: "list",
                     _T.Compound: "compound"}
except ImportError:  # pragma: no cover
    nbtlib = None
    _NBTLIB_NAMES = {}

_TYPE_NAMES = {0: "end", 1: "byte", 2: "short", 3: "int", 4: "long", 5: "float", 6: "double",
               7: "byte_array", 8: "string", 9: "list", 10: "compound", 11: "int_array", 12: "long_array"}


class _LEReader:
    """Fallback little-endian NBT reader (independent of tools/house/nbt_le.py)."""

    def __init__(self, data: bytes):
        self.d, self.i = data, 0

    def _u(self, fmt):
        v = struct.unpack_from("<" + fmt, self.d, self.i)
        self.i += struct.calcsize("<" + fmt)
        return v[0]

    def _str(self):
        n = self._u("H")
        s = self.d[self.i:self.i + n].decode("utf-8")
        self.i += n
        return s

    def payload(self, t):
        name = _TYPE_NAMES[t]
        if t == 1:
            return (name, self._u("b"))
        if t == 2:
            return (name, self._u("h"))
        if t == 3:
            return (name, self._u("i"))
        if t == 4:
            return (name, self._u("q"))
        if t == 5:
            return (name, self._u("f"))
        if t == 6:
            return (name, self._u("d"))
        if t == 8:
            return (name, self._str())
        if t == 9:
            et = self._u("b")
            n = self._u("i")
            return (name, (_TYPE_NAMES[et], [self.payload(et) for _ in range(n)]))
        if t == 10:
            out = {}
            while True:
                ct = self._u("b")
                if ct == 0:
                    return (name, out)
                key = self._str()
                out[key] = self.payload(ct)
        if t == 7:
            n = self._u("i")
            v = list(self.d[self.i:self.i + n])
            self.i += n
            return (name, v)
        if t == 11:
            n = self._u("i")
            return (name, [self._u("i") for _ in range(n)])
        raise ValueError(f"tag type {t}")

    def root(self):
        t = self._u("b")
        name = self._str()
        return name, self.payload(t)


def load_structure(path: Path):
    data = path.read_bytes()
    # always run the strict fallback reader too: it proves there is no trailing garbage
    rd = _LEReader(data)
    root_name, root = rd.root()
    trailing = len(data) - rd.i
    reader = "builtin"
    if nbtlib is not None:
        f = nbtlib.load(str(path), byteorder="little")
        root2 = _from_nbtlib(f)
        if root2 != root:
            raise SystemExit("nbtlib and builtin reader disagree")
        reader = f"nbtlib {nbtlib.__version__} + builtin"
    return root_name, root, trailing, reader


# ---------------------------------------------------------------- reference data
def load_vanilla(ref: Path):
    blocks = json.loads((ref / "metadata" / "vanilladata_modules" / "mojang-blocks.json").read_text())
    props = {p["name"]: (p["type"], [v["value"] for v in p["values"]]) for p in blocks["block_properties"]}
    bmap = {it["name"]: {p["name"]: props[p["name"]] for p in it.get("properties", [])} for it in blocks["data_items"]}
    items = json.loads((ref / "metadata" / "vanilladata_modules" / "mojang-items.json").read_text())
    imap = {it["name"] for it in items["data_items"]}
    return bmap, imap


def load_canonical(path: Path):
    """PocketMine BedrockData canonical_block_states.nbt (network NBT, varints)."""
    b = path.read_bytes()

    def uv(i):
        r = s = 0
        while True:
            x = b[i]
            i += 1
            r |= (x & 0x7F) << s
            s += 7
            if not x & 0x80:
                return r, i

    def zz(v):
        return (v >> 1) ^ -(v & 1)

    def rd(i, t):
        if t == 1:
            return ("byte", struct.unpack_from("<b", b, i)[0]), i + 1
        if t == 3:
            v, i = uv(i)
            return ("int", zz(v)), i
        if t == 8:
            n, i = uv(i)
            return ("string", b[i:i + n].decode()), i + n
        if t == 10:
            out = {}
            while True:
                ct = b[i]
                i += 1
                if ct == 0:
                    return ("compound", out), i
                n, i = uv(i)
                k = b[i:i + n].decode()
                i += n
                out[k], i = rd(i, ct)
        raise ValueError(t)

    states = set()
    i = 0
    while i < len(b):
        t = b[i]
        i += 1
        n, i = uv(i)
        i += n
        (_, root), i = rd(i, t)
        st = tuple(sorted((k, v) for k, v in root["states"][1].items()))
        states.add((root["name"][1], st, root["version"][1]))
    return states


# ---------------------------------------------------------------- semantics (from PocketMine 5.16.0)
OFF = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
OPP = {"north": "south", "south": "north", "west": "east", "east": "west"}
# Facing::rotateY(f, clockwise=true)
CWISE = {"north": "east", "east": "south", "south": "west", "west": "north"}
CCWISE = {v: k for k, v in CWISE.items()}
# BlockStateReader::readLegacyHorizontalFacing   (beds, fence gates, loom)
LEGACY = {0: "south", 1: "west", 2: "north", 3: "east"}
# BlockStateReader::readWeirdoHorizontalFacing   (stairs)
WEIRDO = {0: "east", 1: "west", 2: "south", 3: "north"}
# BlockStateReader::read5MinusHorizontalFacing   (trapdoors)
FIVE_MINUS = {0: "east", 1: "west", 2: "south", 3: "north"}
# BlockStateReader::readFacingDirection          (barrel)
FACING6 = {0: "down", 1: "up", 2: "north", 3: "south", 4: "west", 5: "east"}


def door_facing(d):  # BlockStateDeserializerHelper::decodeDoor
    return CCWISE[LEGACY[d]]


def is_stairs(n):
    return n.endswith("_stairs")


def is_slab(n, st):
    return ("minecraft:vertical_half" in st) and (n.endswith("_slab") or n.startswith("minecraft:stone_block_slab"))


def is_door(n):
    return n.endswith("_door")


def is_trapdoor(n):
    return n.endswith("_trapdoor")


def is_carpet(n):
    return n.endswith("_carpet")


PLANTS = {"minecraft:fern", "minecraft:short_grass", "minecraft:poppy", "minecraft:dandelion",
          "minecraft:white_tulip", "minecraft:lily_of_the_valley", "minecraft:cornflower", "minecraft:oxeye_daisy"}
THIN_LIGHT = {"minecraft:air", "minecraft:light_block", "minecraft:glass", "minecraft:glass_pane",
              "minecraft:lantern", "minecraft:soul_lantern", "minecraft:flower_pot", "minecraft:torch",
              "minecraft:structure_void"}
EMISSION = {"minecraft:lantern": 15, "minecraft:sea_lantern": 15, "minecraft:glowstone": 15,
            "minecraft:torch": 14, "minecraft:end_rod": 14, "minecraft:soul_lantern": 10}
NO_SPAWN_SURFACE = {"minecraft:glass", "minecraft:barrier", "minecraft:sea_lantern", "minecraft:glowstone"}


def light_passes(name):
    return (name in THIN_LIGHT or name in PLANTS or is_carpet(name) or is_door(name) or is_trapdoor(name)
            or name.endswith("_fence") or name.endswith("_fence_gate") or name.endswith("stained_glass_pane"))


def body_passable(name, st):
    """Cells a player body may occupy (doors count: the player opens them)."""
    if name in ("minecraft:air", "minecraft:light_block") or name in PLANTS or is_carpet(name) or is_door(name):
        return True
    if is_trapdoor(name):
        return bool(st["open_bit"]) or not st["upside_down_bit"]
    return False


def full_cube(name, st):
    """Solid 1x1x1 collision cube."""
    if body_passable(name, st) or name in THIN_LIGHT:
        return False
    if is_stairs(name) or is_slab(name, st) or is_trapdoor(name) or name.endswith("_fence") \
            or name.endswith("_fence_gate") or name.endswith("glass_pane"):
        return False
    return name not in {"minecraft:bed", "minecraft:chest", "minecraft:enchanting_table", "minecraft:anvil",
                        "minecraft:stonecutter_block", "minecraft:cauldron", "minecraft:flower_pot",
                        "minecraft:lantern", "minecraft:lectern"}


def support_up(name, st):
    """Center support on the TOP face (PocketMine getSupportType(UP).hasCenterSupport())."""
    if full_cube(name, st):
        return True
    if is_slab(name, st):
        return st["minecraft:vertical_half"] == "top"
    if is_stairs(name):
        return bool(st["upside_down_bit"])
    return name.endswith("_fence")


def support_down(name, st):
    """Center support on the BOTTOM face."""
    if full_cube(name, st):
        return True
    if is_slab(name, st):
        return st["minecraft:vertical_half"] == "bottom"
    if is_stairs(name):
        return not st["upside_down_bit"]
    return name.endswith("_fence")


# ---------------------------------------------------------------- validator
class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.info: dict = {}

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def parse_meta(path: Path):
    text = path.read_text()

    def vec(key):
        m = re.search(key + r"\s*:\s*Object\.freeze\(\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*z:\s*(-?\d+)\s*\}\)", text)
        return tuple(int(v) for v in m.groups()) if m else None

    def num(key):
        m = re.search(key + r"\s*:\s*(-?[\d.]+)", text)
        return float(m.group(1)) if m else None

    def strv(key):
        m = re.search(key + r"\s*:\s*\"([^\"]*)\"", text)
        return m.group(1) if m else None

    return {"structureId": strv("structureId"), "size": vec("size"), "entrance": vec("entrance"),
            "entranceSide": strv("entranceSide"), "floorY": num("floorY"), "supportRatio": num("supportRatio"),
            "buildSeconds": num("buildSeconds"), "probeCell": vec("probeCell")}


def validate(struct_path: Path, meta_path: Path, ref: Path, canonical: Path | None) -> Report:
    R = Report()
    bmap, imap = load_vanilla(ref)
    root_name, root, trailing, reader = load_structure(struct_path)
    R.info["reader"] = reader
    R.info["bytes"] = struct_path.stat().st_size
    if trailing:
        R.err(f"{trailing} trailing bytes after the root compound")
    if root_name != "":
        R.warn(f"root tag name is {root_name!r} (vanilla uses an empty name)")

    def need(comp, key, typ, where):
        if comp[0] != "compound":
            R.err(f"{where} is not a compound")
            return None
        v = comp[1].get(key)
        if v is None:
            R.err(f"{where}.{key} missing")
            return None
        if v[0] != typ:
            R.err(f"{where}.{key} is {v[0]}, expected {typ}")
            return None
        return v

    # ---- 1. layout
    if root[0] != "compound":
        R.err("root is not a compound")
        return R
    keys = set(root[1])
    exp = {"format_version", "size", "structure", "structure_world_origin"}
    if keys != exp:
        R.err(f"root keys {sorted(keys)} != {sorted(exp)}")
    fv = need(root, "format_version", "int", "root")
    if fv and fv[1] != 1:
        R.err("format_version != 1")
    size = need(root, "size", "list", "root")
    sx = sy = sz = 0
    if size:
        et, vals = size[1]
        if et != "int" or len(vals) != 3:
            R.err("size must be List<Int> of 3")
        else:
            sx, sy, sz = (v[1] for v in vals)
    origin = need(root, "structure_world_origin", "list", "root")
    if origin and (origin[1][0] != "int" or len(origin[1][1]) != 3):
        R.err("structure_world_origin must be List<Int> of 3")
    st = need(root, "structure", "compound", "root")
    if st is None:
        return R
    if set(st[1]) != {"block_indices", "entities", "palette"}:
        R.err(f"structure keys {sorted(st[1])}")
    bi = need(st, "block_indices", "list", "structure")
    ents = need(st, "entities", "list", "structure")
    if ents and ents[1][1]:
        R.err("entities list is not empty")
    pal = need(st, "palette", "compound", "structure")
    default = need(pal, "default", "compound", "structure.palette") if pal else None
    bp = need(default, "block_palette", "list", "palette.default") if default else None
    bpd = need(default, "block_position_data", "compound", "palette.default") if default else None
    n = sx * sy * sz
    R.info["size"] = [sx, sy, sz]
    if not (sx <= 19 and sz <= 15 and sy <= 14):
        R.err(f"size {sx}x{sy}x{sz} exceeds footprint 19x15 / height 14")
    layers = []
    if bi:
        et, ll = bi[1]
        if et != "list" or len(ll) != 2:
            R.err("block_indices must be a list of exactly two lists")
        for k, layer in enumerate(ll):
            let, vals = layer[1]
            if let != "int":
                R.err(f"block_indices[{k}] element type {let}")
            if len(vals) != n:
                R.err(f"block_indices[{k}] has {len(vals)} entries, size product is {n}")
            layers.append([v[1] for v in vals])
    if bp is None or len(layers) != 2:
        return R
    if any(v != -1 for v in layers[1]):
        R.err("secondary layer must be all -1")

    # ---- 2. palette
    palette = []
    seen = set()
    canon = load_canonical(canonical) if canonical and canonical.exists() else None
    R.info["canonical_crosscheck"] = bool(canon)
    if bp[1][0] != "compound":
        R.err("block_palette element type is not compound")
    for idx, entry in enumerate(bp[1][1]):
        where = f"palette[{idx}]"
        if set(entry[1]) != {"name", "states", "version"}:
            R.err(f"{where} keys {sorted(entry[1])}")
        name = need(entry, "name", "string", where)
        states = need(entry, "states", "compound", where)
        ver = need(entry, "version", "int", where)
        if not (name and states and ver):
            palette.append(("?", {}))
            continue
        name = name[1]
        if ver[1] != EXPECTED_VERSION:
            R.err(f"{where} {name}: version {ver[1]} != {EXPECTED_VERSION}")
        spec = bmap.get(name)
        st_py = {}
        if spec is None:
            R.err(f"{where}: unknown block {name}")
        else:
            if set(states[1]) != set(spec):
                R.err(f"{where} {name}: states {sorted(states[1])} != required {sorted(spec)}")
            for key, (ttyp, tval) in states[1].items():
                if key not in spec:
                    continue
                typ, allowed = spec[key]
                want = {"bool": "byte", "int": "int", "string": "string"}[typ]
                if ttyp != want:
                    R.err(f"{where} {name}.{key}: tag {ttyp}, expected {want}")
                    continue
                val = bool(tval) if typ == "bool" else tval
                if typ == "bool" and tval not in (0, 1):
                    R.err(f"{where} {name}.{key}: byte {tval} not 0/1")
                if val not in allowed:
                    R.err(f"{where} {name}.{key}={val!r} not in {allowed}")
                st_py[key] = val
        key = (name, tuple(sorted(st_py.items())))
        if key in seen:
            R.err(f"{where}: duplicate palette entry {name}")
        seen.add(key)
        if canon is not None:
            ck = (name, tuple(sorted(states[1].items())), ver[1])
            if ck not in canon:
                R.err(f"{where}: {name} {st_py} is not a canonical 1.21.0 state (PocketMine BedrockData)")
        palette.append((name, st_py))
    R.info["palette_entries"] = len(palette)
    used = set(v for v in layers[0] if v >= 0)
    for v in layers[0]:
        if v < -1 or v >= len(palette):
            R.err(f"block index {v} out of range")
            break
    unused = set(range(len(palette))) - used
    if unused:
        R.warn(f"unused palette entries {sorted(unused)}")

    # ---- grid
    def idx(x, y, z):
        return (x * sy + y) * sz + z  # ZYX: z fastest, then y, then x

    grid: dict[tuple, tuple] = {}
    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                v = layers[0][idx(x, y, z)]
                if v >= 0:
                    grid[(x, y, z)] = palette[v]
    R.info["placed_cells"] = len(grid)
    R.info["void_cells"] = n - len(grid)

    def at(x, y, z):
        return grid.get((x, y, z))

    def name_at(p):
        b = grid.get(p)
        return b[0] if b else None

    # ---- 3. block entities
    bedata: dict[tuple, dict] = {}
    for key, val in bpd[1].items():
        if not re.fullmatch(r"\d+", key) or int(key) >= n:
            R.err(f"block_position_data key {key!r} invalid")
            continue
        i = int(key)
        x, y, z = i // (sy * sz), (i // sz) % sy, i % sz
        if val[0] != "compound" or "block_entity_data" not in val[1]:
            R.err(f"block_position_data[{key}] lacks block_entity_data")
            continue
        bed = val[1]["block_entity_data"]
        if bed[0] != "compound":
            R.err(f"block_entity_data[{key}] not a compound")
            continue
        d = bed[1]
        for k2, t2 in (("id", "string"), ("x", "int"), ("y", "int"), ("z", "int"), ("isMovable", "byte")):
            if k2 not in d or d[k2][0] != t2:
                R.err(f"block_entity_data@{(x, y, z)}: {k2} missing or not {t2}")
        if all(k2 in d for k2 in "xyz") and (d["x"][1], d["y"][1], d["z"][1]) != (x, y, z):
            R.err(f"block_entity_data@{(x, y, z)}: x/y/z {d['x'][1], d['y'][1], d['z'][1]} != index position")
        bedata[(x, y, z)] = d

    def check_item(it, where, slots):
        if it[0] != "compound":
            R.err(f"{where}: item not a compound")
            return
        d = it[1]
        for k2, t2 in (("Name", "string"), ("Count", "byte"), ("Damage", "short"), ("Slot", "byte"),
                       ("WasPickedUp", "byte")):
            if k2 not in d or d[k2][0] != t2:
                R.err(f"{where}: {k2} missing or not {t2}")
                return
        if d["Name"][1] not in imap:
            R.err(f"{where}: unknown item {d['Name'][1]}")
        if not 1 <= d["Count"][1] <= 64:
            R.err(f"{where}: Count {d['Count'][1]}")
        if not 0 <= d["Slot"][1] < 27 or d["Slot"][1] in slots:
            R.err(f"{where}: bad/duplicate Slot {d['Slot'][1]}")
        slots.add(d["Slot"][1])
        if "Block" in d:
            check_block_ref(d["Block"], where + ".Block")

    def check_block_ref(tag, where):
        if tag[0] != "compound" or set(tag[1]) != {"name", "states", "version"}:
            R.err(f"{where}: must be {{name, states, version}}")
            return
        nm, sts, ver = tag[1]["name"], tag[1]["states"], tag[1]["version"]
        spec = bmap.get(nm[1])
        if nm[0] != "string" or spec is None:
            R.err(f"{where}: unknown block {nm}")
            return
        if ver != ("int", EXPECTED_VERSION):
            R.err(f"{where}: version {ver}")
        if set(sts[1]) != set(spec):
            R.err(f"{where}: {nm[1]} states {sorted(sts[1])} != {sorted(spec)}")
        for k2, (tt, tv) in sts[1].items():
            if k2 in spec:
                typ, allowed = spec[k2]
                want = {"bool": "byte", "int": "int", "string": "string"}[typ]
                v2 = bool(tv) if typ == "bool" else tv
                if tt != want or v2 not in allowed:
                    R.err(f"{where}: {nm[1]}.{k2} bad ({tt} {tv})")

    counts: dict[str, int] = {}
    for p, (nm, _) in grid.items():
        counts[nm] = counts.get(nm, 0) + 1
    need_be = {"minecraft:bed": "Bed", "minecraft:chest": "Chest", "minecraft:flower_pot": "FlowerPot"}
    for p, (nm, _) in grid.items():
        if nm in need_be:
            d = bedata.get(p)
            if d is None:
                if nm != "minecraft:flower_pot":
                    R.err(f"{nm} at {p} has no block_entity_data")
                continue
            if d.get("id", ("", ""))[1] != need_be[nm]:
                R.err(f"{nm} at {p}: block entity id {d.get('id')}")
    for p, d in bedata.items():
        nm = name_at(p)
        ident = d.get("id", ("", ""))[1]
        expect = {v: k for k, v in need_be.items()}.get(ident)
        if expect is None:
            R.warn(f"block entity {ident} at {p} not checked")
        elif nm != expect:
            R.err(f"block entity {ident} at {p} sits on {nm}")
        if ident == "Bed":
            c = d.get("color")
            if not c or c[0] != "byte" or not 0 <= c[1] <= 15:
                R.err(f"Bed at {p}: color must be Byte 0..15")
        if ident == "Chest":
            if d.get("Findable", (None,))[0] != "byte":
                R.err(f"Chest at {p}: Findable Byte missing")
            items = d.get("Items")
            if not items or items[0] != "list" or items[1][0] not in ("compound", "end"):
                R.err(f"Chest at {p}: Items must be List<Compound>")
            else:
                slots: set = set()
                for k, it in enumerate(items[1][1]):
                    check_item(it, f"Chest@{p}.Items[{k}]", slots)
                if not items[1][1]:
                    R.warn(f"Chest at {p} is empty")
        if ident == "FlowerPot" and "PlantBlock" in d:
            check_block_ref(d["PlantBlock"], f"FlowerPot@{p}.PlantBlock")

    # ---- 4. semantics
    beds = 0
    for p, (nm, s) in grid.items():
        x, y, z = p
        if nm == "minecraft:bed":
            f = LEGACY[s["direction"]]
            dx, dz = OFF[f]
            other = (x + dx, y, z + dz) if not s["head_piece_bit"] else (x - dx, y, z - dz)
            ob = at(*other)
            if not ob or ob[0] != "minecraft:bed" or ob[1]["direction"] != s["direction"] \
                    or ob[1]["head_piece_bit"] == s["head_piece_bit"]:
                R.err(f"bed half at {p} ({'head' if s['head_piece_bit'] else 'foot'}, facing {f}) has no matching other half at {other}")
            elif bedata.get(p) and bedata.get(other) and bedata[p].get("color") != bedata[other].get("color"):
                R.err(f"bed at {p}: halves have different colours")
            if not s["head_piece_bit"]:
                beds += 1
            below = at(x, y - 1, z)
            if not below or not full_cube(*below):
                R.err(f"bed at {p} not on a full block")
        if is_door(nm):
            other = (x, y + 1, z) if not s["upper_block_bit"] else (x, y - 1, z)
            ob = at(*other)
            if not ob or ob[0] != nm or ob[1]["upper_block_bit"] == s["upper_block_bit"] \
                    or ob[1]["direction"] != s["direction"] or ob[1]["door_hinge_bit"] != s["door_hinge_bit"] \
                    or ob[1]["open_bit"] != s["open_bit"]:
                R.err(f"door at {p} has no consistent other half at {other}")
            if not s["upper_block_bit"]:
                below = at(x, y - 1, z)
                if not below or not support_up(*below):
                    R.err(f"door at {p} has no support below")
        if nm in ("minecraft:lantern", "minecraft:soul_lantern"):
            if s["hanging"]:
                ab = at(x, y + 1, z)
                if not ab or not support_down(*ab):
                    R.err(f"hanging lantern at {p}: block above {ab and ab[0]} gives no support")
            else:
                bl = at(x, y - 1, z)
                if not bl or not support_up(*bl):
                    R.err(f"standing lantern at {p}: block below {bl and bl[0]} gives no support")
        if nm == "minecraft:flower_pot" or is_carpet(nm):
            bl = at(x, y - 1, z)
            if not bl or bl[0] == "minecraft:air" or (nm == "minecraft:flower_pot" and not support_up(*bl)):
                R.err(f"{nm} at {p} unsupported (below: {bl and bl[0]})")
        if nm == "minecraft:chest":
            ab = at(x, y + 1, z)
            if ab and full_cube(*ab):
                R.err(f"chest at {p} cannot open: {ab[0]} above")
            for f, (dx, dz) in OFF.items():
                nb = at(x + dx, y, z + dz)
                if nb and nb[0] == "minecraft:chest":
                    R.warn(f"chests at {p} and {(x + dx, y, z + dz)} are adjacent (pairing not set)")
    R.info["beds"] = beds
    R.info["counts"] = {k.split(':')[1]: v for k, v in sorted(counts.items())}

    # doors: doorway sanity + double doors
    lower_doors = [p for p, (nm, s) in grid.items() if is_door(nm) and not s["upper_block_bit"]]
    R.info["doors"] = len(lower_doors)
    for p in lower_doors:
        nm, s = grid[p]
        f = door_facing(s["direction"])
        x, y, z = p
        left, right = CCWISE[f], CWISE[f]
        for side in (left, right):
            dx, dz = OFF[side]
            nb = at(x + dx, y, z + dz)
            if not nb or not (full_cube(*nb) or is_door(nb[0]) or nb[0].endswith("glass_pane")):
                R.err(f"door at {p} (facing {f}): {side} jamb is {nb and nb[0]}, door is not in a wall opening")
        # mirrored hinges for side-by-side leaves with the same facing
        dx, dz = OFF[right]
        nb = at(x + dx, y, z + dz)
        if nb and is_door(nb[0]) and door_facing(nb[1]["direction"]) == f:
            if not (s["door_hinge_bit"] is False and nb[1]["door_hinge_bit"] is True):
                R.err(f"double door at {p}/{(x + dx, y, z + dz)} (facing {f}): hinges not mirrored "
                      f"(left hinge_right={s['door_hinge_bit']}, right hinge_right={nb[1]['door_hinge_bit']})")
            else:
                R.info.setdefault("double_doors", []).append([list(p), [x + dx, y, z + dz], f])

    # enchanting tables (Bedrock bookshelf rule, minecraft.wiki "Enchanting table mechanics")
    for p, (nm, s) in grid.items():
        if nm != "minecraft:enchanting_table":
            continue
        x, y, z = p
        shelves = 0
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                if max(abs(dx), abs(dz)) != 2:
                    continue
                # cell between table and shelf: next to the shelf unless diagonal
                bx = x + (dx - (1 if dx > 0 else -1 if dx < 0 else 0)) if abs(dx) == 2 else x + dx
                bz = z + (dz - (1 if dz > 0 else -1 if dz < 0 else 0)) if abs(dz) == 2 else z + dz
                if abs(dx) == 2 and abs(dz) == 2:
                    bx, bz = x + dx // 2, z + dz // 2
                clear = all(name_at((bx, y + h, bz)) == "minecraft:air" for h in (0, 1))
                for h in (0, 1):
                    if name_at((x + dx, y + h, z + dz)) == "minecraft:bookshelf" and clear:
                        shelves += 1
        R.info.setdefault("enchanting_bookshelves", []).append(shelves)
        if shelves < 15:
            R.err(f"enchanting table at {p}: only {shelves} effective bookshelves (need 15)")

    # ---- 5. walkability
    meta = parse_meta(meta_path)
    R.info["meta"] = meta
    if meta["size"] != (sx, sy, sz):
        R.err(f"blueprint_meta size {meta['size']} != structure size {(sx, sy, sz)}")
    if meta["structureId"] != "pas:luxury_base" or meta["entranceSide"] != "south" or meta["supportRatio"] != 0.8:
        R.err(f"blueprint_meta fields wrong: {meta}")
    pc = meta["probeCell"]
    if pc is None or name_at(pc) != "minecraft:air":
        R.err(f"probeCell {pc} is not air in the structure")

    def blk(x, y, z):
        if not (0 <= x < sx and 0 <= y < sy and 0 <= z < sz):
            return ("minecraft:air", {})  # outside the box: assume open air
        return grid.get((x, y, z), ("minecraft:air", {}))  # void = untouched world, assume air

    def passable(x, y, z):
        nm, s = blk(x, y, z)
        return body_passable(nm, s)

    # standing nodes: (x, z, h, part) ; part in {"", "low", "high"}
    nodes = {}

    def clear_column(x, z, h_own, h_top):
        """Body cells above a standing height ``h_own`` up to a head at ``h_top`` + 1.8 are free."""
        start = int(round(h_own)) if abs(h_own - round(h_own)) < 1e-6 else math.floor(h_own) + 1
        end = math.floor(h_top + 1.8 - 1e-6)
        return all(passable(x, y, z) for y in range(start, end + 1))

    for (x, y, z), (nm, s) in grid.items():
        surfaces = []
        if is_stairs(nm) and not s["upside_down_bit"]:
            surfaces = [(y + 0.5, "low"), (y + 1.0, "high")]
        elif is_slab(nm, s) and s["minecraft:vertical_half"] == "bottom":
            surfaces = [(y + 0.5, "")]
        elif is_carpet(nm):
            surfaces = [(y + 1 / 16, "")]
        elif is_trapdoor(nm) and not s["open_bit"] and not s["upside_down_bit"]:
            surfaces = [(y + 3 / 16, "")]
        elif support_up(nm, s) and not body_passable(nm, s):
            surfaces = [(y + 1.0, "")]
        for h, part in surfaces:
            if clear_column(x, z, h, h):
                nodes[(x, z, h, part)] = (x, y, z)

    stair_up = {}
    for (x, z, h, part), cell in nodes.items():
        nm, s = blk(*cell)
        if part:
            stair_up[(x, z, h, part)] = WEIRDO[s["weirdo_direction"]]
    by_col: dict[tuple, list] = {}
    for k in nodes:
        by_col.setdefault((k[0], k[1]), []).append(k)

    def face_blocked(x, y_lo, y_hi, z, side):
        """Open trapdoor panel lying against ``side`` face of cell column (x, z)."""
        for y in range(y_lo, y_hi + 1):
            nm, s = blk(x, y, z)
            if is_trapdoor(nm) and s["open_bit"]:
                if OPP[FIVE_MINUS[s["direction"]]] == side:
                    return True
        return False

    def edges(node):
        x, z, h, part = node
        out = []
        if part:  # within a stair cell
            other = (x, z, h + 0.5, "high") if part == "low" else (x, z, h - 0.5, "low")
            if other in nodes:
                out.append(other)
        for move, (dx, dz) in OFF.items():
            nx, nz = x + dx, z + dz
            if part:  # leaving a stair: forward over the high half, backward over the low half
                up = stair_up[node]
                if move == up and part != "high":
                    continue
                if move == OPP[up] and part != "low":
                    continue
            for cand in by_col.get((nx, nz), []):
                h2, part2 = cand[2], cand[3]
                if h2 - h > 0.5625 + 1e-6 or h - h2 > 3.0 + 1e-6:
                    continue
                if part2:
                    up2 = stair_up[cand]
                    if move == up2 and part2 != "low":
                        continue
                    if move == OPP[up2] and part2 != "high":
                        continue
                lo, hi = min(h, h2), max(h, h2)
                if not clear_column(x, z, h, hi) or not clear_column(nx, nz, h2, hi):
                    continue
                ylo, yhi = int(lo + 0.01), int(hi + 1.79)
                if face_blocked(x, ylo, yhi, z, move) or face_blocked(nx, ylo, yhi, nz, OPP[move]):
                    continue
                out.append(cand)
        return out

    ex, ey, ez = meta["entrance"]
    start = [k for k in by_col.get((ex, ez), []) if ey <= k[2] < ey + 1]
    if not start:
        R.err(f"entrance {meta['entrance']} is not a standing spot")
        return R
    start = min(start, key=lambda k: k[2])
    adj = {k: edges(k) for k in nodes}
    seen_n = {start}
    dq = deque([start])
    while dq:
        cur = dq.popleft()
        for nb in adj[cur]:
            if nb not in seen_n:
                seen_n.add(nb)
                dq.append(nb)
    radj: dict = {k: [] for k in nodes}
    for k, vs in adj.items():
        for v in vs:
            radj[v].append(k)
    back = {start}
    dq = deque([start])
    while dq:
        cur = dq.popleft()
        for nb in radj[cur]:
            if nb not in back:
                back.add(nb)
                dq.append(nb)
    traps = [k for k in seen_n if k not in back]
    if traps:
        R.err(f"{len(traps)} reachable spots cannot walk back to the entrance, e.g. {sorted(traps)[:5]}")
    reach = seen_n & back
    R.info["standing_spots_reachable"] = len(reach)

    reached_cells = {(k[0], int(k[2] + 0.5), k[1]) for k in reach}
    reached_levels = sorted({round(k[2], 3) for k in reach})
    floor_y = meta["floorY"]
    up_spots = [k for k in reach if k[2] >= floor_y + 4.9]
    if not any(abs(k[2] - floor_y) < 0.2 for k in reach):
        R.err("ground floor not reached")
    if not up_spots:
        R.err("upper floor not reached")
    stair_spots = [k for k in reach if k[3]]
    if not stair_spots or max(k[2] for k in stair_spots) - min(k[2] for k in stair_spots) < 3.5:
        R.err("no staircase between the floors is walkable")
    R.info["stairs_heights"] = sorted({k[2] for k in stair_spots})

    # usable blocks: horizontally adjacent to a reached feet cell, from one below the feet
    # up to two above them (eye height 1.62; Bedrock survival reach is several blocks)
    def usable(p):
        x, y, z = p
        for dx, dz in OFF.values():
            for dy in (-2, -1, 0, 1):
                if (x + dx, y + dy, z + dz) in reached_cells:
                    return True
        return False

    must_use = {"minecraft:bed", "minecraft:chest", "minecraft:barrel", "minecraft:crafting_table",
                "minecraft:furnace", "minecraft:blast_furnace", "minecraft:smoker", "minecraft:stonecutter_block",
                "minecraft:anvil", "minecraft:loom", "minecraft:smithing_table", "minecraft:enchanting_table",
                "minecraft:cauldron"}
    unusable = []
    for p, (nm, s) in grid.items():
        if nm in must_use and not usable(p):
            if nm == "minecraft:bed":
                fdx, fdz = OFF[LEGACY[s["direction"]]]
                sign = -1 if s["head_piece_bit"] else 1
                if usable((p[0] + sign * fdx, p[1], p[2] + sign * fdz)):
                    continue
            if nm == "minecraft:barrel" and p[1] > floor_y + 0.5 and usable((p[0], p[1] - 1, p[2])):
                continue  # stacked barrel: reachable from the spot next to the one below
            unusable.append((nm.split(":")[1], p))
    if unusable:
        R.err(f"blocks not usable from any reachable spot: {unusable}")
    for p in lower_doors:
        if p not in reached_cells:
            R.err(f"door at {p} not reached")
        f = door_facing(grid[p][1]["direction"])
        dx, dz = OFF[f]
        for q in ((p[0] + dx, p[1], p[2] + dz), (p[0] - dx, p[1], p[2] - dz)):
            if q not in reached_cells:
                R.err(f"door at {p} (facing {f}) does not connect two reachable spots: {q} not reached")
    for need_name in ("minecraft:bed", "minecraft:crafting_table", "minecraft:furnace", "minecraft:blast_furnace",
                      "minecraft:smoker", "minecraft:stonecutter_block", "minecraft:anvil", "minecraft:loom",
                      "minecraft:smithing_table", "minecraft:enchanting_table", "minecraft:cauldron",
                      "minecraft:chest", "minecraft:barrel"):
        if counts.get(need_name, 0) == 0:
            R.err(f"required block {need_name} missing")

    # indoor / outdoor: flood the outside air from the box boundary through cells that are
    # not walls (closed doors and glass count as walls)
    def wallish(p):
        nm, s = blk(*p)
        if nm in ("minecraft:air", "minecraft:light_block") or nm in PLANTS or is_carpet(nm):
            return False
        return True

    outside = set()
    dq = deque()
    for x in range(-1, sx + 1):
        for y in range(0, sy + 1):
            for z in range(-1, sz + 1):
                if x in (-1, sx) or z in (-1, sz) or y == sy:
                    outside.add((x, y, z))
                    dq.append((x, y, z))
    while dq:
        x, y, z = dq.popleft()
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            q = (x + dx, y + dy, z + dz)
            if q in outside or not (-1 <= q[0] <= sx and 0 <= q[1] <= sy and -1 <= q[2] <= sz):
                continue
            if 0 <= q[0] < sx and 0 <= q[2] < sz and q[1] < sy and wallish(q):
                continue
            outside.add(q)
            dq.append(q)
    indoor_spots = [k for k in reach if (k[0], int(k[2] + 0.5), k[1]) not in outside]
    outdoor_spots = [k for k in reach if (k[0], int(k[2] + 0.5), k[1]) in outside]
    balcony = [k for k in outdoor_spots if k[2] >= floor_y + 4.9]
    if not balcony:
        R.err("no balcony (outdoor upper-floor spot) reachable")
    R.info["balcony_spots"] = len(balcony)
    R.info["indoor_spots"] = len(indoor_spots)
    R.info["outdoor_spots"] = len(outdoor_spots)
    # doors: interior doors = both sides indoor; balcony doors = upper floor, one side outdoor
    interior_doors, balcony_doors, front_doors = [], [], []
    for p in lower_doors:
        nm, s = grid[p]
        f = door_facing(s["direction"])
        dx, dz = OFF[f]
        a = (p[0] + dx, p[1], p[2] + dz)
        b2 = (p[0] - dx, p[1], p[2] - dz)
        sides = [q in outside for q in (a, b2)]
        if not any(sides):
            interior_doors.append(p)
        elif p[1] >= floor_y + 4:
            balcony_doors.append(p)
        else:
            front_doors.append(p)
    R.info["interior_doors"] = len(interior_doors)
    R.info["balcony_doors"] = len(balcony_doors)
    R.info["front_doors"] = len(front_doors)
    if len(interior_doors) + len(balcony_doors) < 3:
        R.err("fewer than 3 interior/balcony doors")
    south_pair = [d for d in R.info.get("double_doors", []) if tuple(d[0]) in front_doors and d[0][2] >= sz - 5]
    if not south_pair:
        R.err("no mirrored front double door on the south side")
    else:
        dz_ = south_pair[0][0][2]
        if not (abs(ez - dz_) == 1 and ex in (south_pair[0][0][0], south_pair[0][1][0])):
            R.err(f"entrance {meta['entrance']} is not the cell in front of the front door")
        mid2 = south_pair[0][0][0] + south_pair[0][1][0]  # = 2 * door centre
        if abs(mid2 - (sx - 1)) > 1:
            R.err(f"front door not centred on the south side (door centre {mid2 / 2}, box centre {(sx - 1) / 2})")
    # beds must be indoors (a bedroom open to the outside would let mobs in)
    for p, (nm, s) in grid.items():
        if nm == "minecraft:bed" and (p[0], p[1] + 1, p[2]) in outside:
            R.err(f"bed at {p} is not enclosed (outside air reaches it)")

    def bbox(spots):
        if not spots:
            return None
        xs, hs, zs = [k[0] for k in spots], [k[2] for k in spots], [k[1] for k in spots]
        return [[min(xs), round(min(hs), 2), min(zs)], [max(xs), round(max(hs), 2), max(zs)]]

    R.info["outdoor_bbox_floor1"] = bbox([k for k in outdoor_spots if k[2] < floor_y + 4.9])
    R.info["outdoor_bbox_balcony"] = bbox(balcony)

    # ---- 6. lighting
    light: dict[tuple, int] = {}
    pq = [deque() for _ in range(16)]
    for p, (nm, s) in grid.items():
        e = EMISSION.get(nm, 0)
        if e:
            light[p] = e
            pq[e].append(p)
    for lvl in range(15, 0, -1):
        q = pq[lvl]
        while q:
            p = q.popleft()
            if light.get(p, 0) != lvl:
                continue
            for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                r = (p[0] + dx, p[1] + dy, p[2] + dz)
                b3 = grid.get(r)
                if b3 is None or not light_passes(b3[0]):
                    continue  # void / outside the box treated as opaque (conservative)
                if light.get(r, 0) < lvl - 1:
                    light[r] = lvl - 1
                    pq[lvl - 1].append(r)
    spot_light = {k: light.get((k[0], int(k[2] + 0.5), k[1]), 0) for k in reach}
    dark = sorted((v, k) for k, v in spot_light.items() if v < 8)
    if dark:
        R.err(f"{len(dark)} reachable spots darker than 8, e.g. {[(v, (k[0], round(k[2], 2), k[1])) for v, k in dark[:6]]}")
    R.info["min_light_reachable"] = min(spot_light.values())
    R.info["dimmest_spots"] = [[v, [k[0], round(k[2], 2), k[1]]] for v, k in
                               sorted((v, k) for k, v in spot_light.items())[:8]]
    R.info["min_light_indoor"] = min(spot_light[k] for k in indoor_spots) if indoor_spots else None
    R.info["light_histogram"] = {str(v): sum(1 for x in spot_light.values() if x == v) for v in range(16)
                                 if any(x == v for x in spot_light.values())}
    # spawnable surfaces anywhere in the box
    bad_spawn = []
    for (x, y, z), (nm, s) in grid.items():
        if not full_cube(nm, s) or nm in NO_SPAWN_SURFACE or nm.endswith("_leaves") or "glass" in nm:
            continue
        a1, a2 = blk(x, y + 1, z), blk(x, y + 2, z)
        if not (a1[0] in ("minecraft:air",) and a2[0] in ("minecraft:air",)):
            continue
        if (x, y + 1, z) not in grid:
            continue  # void above: terrain-level spot outside the house, not ours
        lv = light.get((x, y + 1, z), 0)
        if lv < 8:
            bad_spawn.append((lv, (x, y + 1, z)))
    if bad_spawn:
        R.err(f"{len(bad_spawn)} spawnable cells darker than 8, e.g. {sorted(bad_spawn)[:8]}")
    R.info["spawnable_dark_cells"] = len(bad_spawn)
    R.info["reached_levels"] = reached_levels[:12]
    return R


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("structure", nargs="?", default=str(DEFAULT_STRUCT))
    ap.add_argument("--meta", default=str(DEFAULT_META))
    ap.add_argument("--ref", default=os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))
    ap.add_argument("--canonical", default=str(Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF)).parent
                                                / "bedrockdata-1.21.0" / "canonical_block_states.nbt"))
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    R = validate(Path(args.structure), Path(args.meta), Path(args.ref), Path(args.canonical))
    if args.json:
        print(json.dumps({"ok": not R.errors, "errors": R.errors, "warnings": R.warnings, "info": R.info},
                         indent=1, default=str))
    else:
        for k, v in R.info.items():
            print(f"  {k}: {v}")
        for w in R.warnings:
            print("WARN ", w)
        for e in R.errors:
            print("ERROR", e)
        print("PASS" if not R.errors else f"FAIL ({len(R.errors)} errors)")
    return 0 if not R.errors else 1


if __name__ == "__main__":
    sys.exit(main())

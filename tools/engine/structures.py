"""GameTest structure templates for the engine harness (.mcstructure writer).

Every GameTest needs a structure (`structureName`), loaded from the test pack's
`structures/<namespace>/<name>.mcstructure`.  The templates are generated at
install time (never committed as binaries):

    pastest:flat            12 x 6 x 12   stone floor, air above (generic player tests)
    pastest:dark_room       15 x 8 x 15   stone floor, walls and roof, dark air interior (torch)
    pastest:grass_platform  24 x 16 x 24  grass floor, 15 layers of air (luxury base)
    pastest:arena           24 x 8 x 24   grass floor, 4-high stone walls, glass roof (outbreak)

Format (verified against tools/house and the Bedrock-OSS wiki): little-endian
NBT root {format_version: Int 1, size: List<Int>[3], structure: {block_indices:
[List<Int>, List<Int>], entities: [], palette: {default: {block_palette: [...],
block_position_data: {}}}}, structure_world_origin: List<Int>[3]}; flat index
(x*sy + y)*sz + z; palette entries {name, states, version Int 18153475}.
Block states are complete sets validated against mojang-blocks.json of 1.21.0.26
when the reference is available (PAS_VANILLA_REF).

    python3 tools/engine/structures.py OUT_DIR     # writes OUT_DIR/pastest/*.mcstructure
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import nbt

PALETTE_VERSION = 18153475  # (1<<24)|(21<<16)|(0<<8)|3 = 1.21.0.3, see docs/SPEC.md §0
DEFAULT_REF = "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"
NAMESPACE = "pastest"


def _load_block_defs() -> dict | None:
    ref = Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))
    f = ref / "metadata" / "vanilladata_modules" / "mojang-blocks.json"
    if not f.is_file():
        return None
    d = json.loads(f.read_text(encoding="utf-8"))
    props = {p["name"]: p for p in d.get("block_properties", [])}
    out = {}
    for b in d["data_items"]:
        out[b["name"]] = {p["name"]: [v["value"] for v in props.get(p["name"], {}).get("values", [])]
                          for p in b.get("properties", [])}
    return out


_DEFS = _load_block_defs()


def _state_tag(v):
    if isinstance(v, bool):
        return nbt.Byte(1 if v else 0)
    if isinstance(v, int):
        return nbt.Int(v)
    return nbt.String(v)


def check_block(name: str, states: dict) -> None:
    if _DEFS is None:
        return
    if name not in _DEFS:
        raise ValueError(f"{name} is not a 1.21.0.26 block")
    want = _DEFS[name]
    if set(states) != set(want):
        raise ValueError(f"{name}: states {sorted(states)} != {sorted(want)}")
    for k, v in states.items():
        if want[k] and v not in want[k]:
            raise ValueError(f"{name}: {k}={v!r} not in {want[k]}")


class Template:
    def __init__(self, sx: int, sy: int, sz: int, fill: tuple[str, dict] = ("minecraft:air", {})):
        self.size = (sx, sy, sz)
        self.palette: list[tuple[str, tuple]] = []
        self.index: dict[tuple[str, tuple], int] = {}
        self.cells = [self._pal(*fill)] * (sx * sy * sz)

    def _pal(self, name: str, states: dict) -> int:
        check_block(name, states)
        key = (name, tuple(sorted(states.items())))
        if key not in self.index:
            self.index[key] = len(self.palette)
            self.palette.append(key)
        return self.index[key]

    def set(self, x: int, y: int, z: int, name: str, states: dict | None = None) -> None:
        sx, sy, sz = self.size
        if not (0 <= x < sx and 0 <= y < sy and 0 <= z < sz):
            raise IndexError((x, y, z))
        self.cells[(x * sy + y) * sz + z] = self._pal(name, states or {})

    def fill(self, x1, y1, z1, x2, y2, z2, name: str, states: dict | None = None) -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            for y in range(min(y1, y2), max(y1, y2) + 1):
                for z in range(min(z1, z2), max(z1, z2) + 1):
                    self.set(x, y, z, name, states)

    def to_nbt(self) -> nbt.Compound:
        pal = nbt.List(nbt.TAG_COMPOUND, [
            nbt.Compound({"name": nbt.String(n), "states": nbt.Compound({k: _state_tag(v) for k, v in st}),
                          "version": nbt.Int(PALETTE_VERSION)}) for n, st in self.palette])
        layer0 = nbt.List(nbt.TAG_INT, [nbt.Int(i) for i in self.cells])
        layer1 = nbt.List(nbt.TAG_INT, [nbt.Int(-1)] * len(self.cells))
        return nbt.Compound({
            "format_version": nbt.Int(1),
            "size": nbt.List(nbt.TAG_INT, [nbt.Int(v) for v in self.size]),
            "structure": nbt.Compound({
                "block_indices": nbt.List(nbt.TAG_LIST, [layer0, layer1]),
                "entities": nbt.List(nbt.TAG_COMPOUND, []),
                "palette": nbt.Compound({"default": nbt.Compound({
                    "block_palette": pal,
                    "block_position_data": nbt.Compound(),
                })}),
            }),
            "structure_world_origin": nbt.List(nbt.TAG_INT, [nbt.Int(0)] * 3),
        })

    def to_bytes(self) -> bytes:
        return nbt.write(self.to_nbt(), "")


def flat() -> Template:
    t = Template(12, 6, 12)
    t.fill(0, 0, 0, 11, 0, 11, "minecraft:stone")
    return t


def dark_room() -> Template:
    t = Template(15, 8, 15)
    t.fill(0, 0, 0, 14, 0, 14, "minecraft:stone")
    t.fill(0, 7, 0, 14, 7, 14, "minecraft:stone")
    for y in range(1, 7):
        for i in range(15):
            for (x, z) in ((0, i), (14, i), (i, 0), (i, 14)):
                t.set(x, y, z, "minecraft:stone")
    return t


def grass_platform() -> Template:
    t = Template(24, 16, 24)
    t.fill(0, 0, 0, 23, 0, 23, "minecraft:grass_block")
    return t


def arena() -> Template:
    t = Template(24, 8, 24)
    t.fill(0, 0, 0, 23, 0, 23, "minecraft:grass_block")
    for y in range(1, 5):
        for i in range(24):
            for (x, z) in ((0, i), (23, i), (i, 0), (i, 23)):
                t.set(x, y, z, "minecraft:stone")
    t.fill(0, 5, 0, 23, 5, 23, "minecraft:glass")
    return t


TEMPLATES = {"flat": flat, "dark_room": dark_room, "grass_platform": grass_platform, "arena": arena}


def write_all(structures_dir: Path) -> list[Path]:
    out_dir = structures_dir / NAMESPACE
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, fn in TEMPLATES.items():
        p = out_dir / f"{name}.mcstructure"
        p.write_bytes(fn().to_bytes())
        written.append(p)
    return written


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    for p in write_all(Path(sys.argv[1])):
        print(p, p.stat().st_size)
    if _DEFS is None:
        print("warning: mojang-blocks.json not found; block states were not validated")

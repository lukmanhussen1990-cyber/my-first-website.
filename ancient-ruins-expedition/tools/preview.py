"""Print ASCII slices of a .mcstructure file (one map per Y layer) for review."""
import sys

from nbt import loads

GLYPHS = {
    "minecraft:air": ".", "minecraft:water": "~", "minecraft:chest": "C", "minecraft:dispenser": "D",
    "minecraft:lever": "L", "minecraft:stone_pressure_plate": "_", "minecraft:wooden_pressure_plate": "_",
    "minecraft:command_block": "!", "minecraft:ladder": "H", "minecraft:lantern": "*",
    "minecraft:soul_lantern": "*", "minecraft:sea_lantern": "*", "minecraft:gold_block": "$",
    "minecraft:emerald_block": "$", "minecraft:web": "w", "minecraft:vine": "v",
    "minecraft:jungle_leaves": "&", "minecraft:sea_pickle": "p",
}
CUSTOM = {
    "vault_seal": "V", "trap_mechanism": "T", "miasma_vent": "m", "dormant_altar": "A",
}


def glyph(name):
    if name in GLYPHS:
        return GLYPHS[name]
    if name.startswith("ancient_ruins:"):
        short = name.split(":", 1)[1]
        if short in CUSTOM:
            return CUSTOM[short]
        if "glyph" in short:
            return short[-1]
        if "altar" in short:
            return "A"
        if "crumbling" in short or "rotten" in short:
            return "x"
        if "floor" in short:
            return ","
        return "?"
    if "stairs" in name:
        return "/"
    if "fence" in name:
        return "|"
    return "#"


def main(path):
    root = loads(open(path, "rb").read())
    sx, sy, sz = [int(v) for v in root["size"]]
    st = root["structure"]
    prim = st["block_indices"][0]
    pal = st["palette"]["default"]["block_palette"]
    for y in range(sy - 1, -1, -1):
        print(f"--- y={y} (x ->, z down)")
        for z in range(sz):
            row = []
            for x in range(sx):
                idx = prim[(x * sy + y) * sz + z]
                row.append(" " if idx < 0 else glyph(pal[idx]["name"]))
            print(f"{z:2d} " + "".join(row))


if __name__ == "__main__":
    main(sys.argv[1])

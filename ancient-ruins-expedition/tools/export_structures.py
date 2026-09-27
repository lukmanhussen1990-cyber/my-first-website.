"""Dump the generated .mcstructure files to JSON for the script test harness."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nbt import loads  # noqa: E402


def export(path):
    root = loads(open(path, "rb").read())
    sx, sy, sz = [int(v) for v in root["size"]]
    st = root["structure"]
    pal = st["palette"]["default"]["block_palette"]
    prim, water = st["block_indices"]
    blocks = []
    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                i = (x * sy + y) * sz + z
                if prim[i] < 0:
                    continue
                p = pal[prim[i]]
                states = {k: (bool(v) if type(v).__name__ == "Byte" else (int(v) if type(v).__name__ == "Int" else str(v)))
                          for k, v in p["states"].items()}
                blocks.append([x, y, z, str(p["name"]), states, water[i] >= 0])
    entities = [{"identifier": str(e["identifier"]), "pos": [float(v) for v in e["Pos"]]} for e in st["entities"]]
    return {"size": [sx, sy, sz], "blocks": blocks, "entities": entities}


if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for fn in sorted(os.listdir(src)):
        if fn.endswith(".mcstructure"):
            data = export(os.path.join(src, fn))
            with open(os.path.join(out, fn.replace(".mcstructure", ".json")), "w") as f:
                json.dump(data, f)
            print(fn, len(data["blocks"]), "blocks")

#!/usr/bin/env python3
"""Merge every generated display name into the BP and RP language files."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "out")
PACKS = {
    "Lost_Island_BP": "Lost Island: Abandoned [BP]",
    "Lost_Island_RP": "Lost Island: Abandoned [RP]",
}


def main():
    lines = []
    for src in ("item_lang.txt", "block_lang.txt", "entity_lang.txt"):
        p = os.path.join(OUT, src)
        if os.path.exists(p):
            with open(p) as f:
                lines += [ln.rstrip("\n") for ln in f if ln.strip()]
    for pack, name in PACKS.items():
        d = os.path.join(ROOT, "build", pack, "texts")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "languages.json"), "w") as f:
            json.dump(["en_US"], f)
        with open(os.path.join(d, "en_US.lang"), "w", encoding="utf-8") as f:
            f.write("pack.name=%s\n" % name)
            f.write("pack.description=Survive. Discover what happened. "
                    "Find a way home.\n")
            f.write("\n## items, blocks and creatures\n")
            f.write("\n".join(sorted(set(lines))) + "\n")
    print("lang entries   : %d (x2 packs)" % len(set(lines)))


if __name__ == "__main__":
    main()

"""Partial cut of an episode (usage: partial_cut.py <episode number> <out_dir>): rendered frames where they exist (holding the last one in a partly rendered shot),
otherwise the 3 preview stills; everything resized to 720x1280."""
import sys, os, glob
EP = sys.argv[1]
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", f"ep{EP}"))
from cuts import CUTS
from PIL import Image
OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
W = os.path.join(os.environ.get("LARRY_WORK", os.path.expanduser("~/larry_work")), f"ep{EP}")
k = 0; kinds = {}; cache = {}
def get(p):
    if p not in cache:
        cache.clear()
        im = Image.open(p).convert("RGB")
        cache[p] = im if im.size == (720, 1280) else im.resize((720, 1280), Image.BICUBIC)
    return cache[p]
for i, (sh, t) in enumerate(CUTS[:-1]):
    n = round(CUTS[i + 1][1] * 24) - round(t * 24)
    full = {int(os.path.basename(f)[2:6]): f for f in glob.glob(f"{W}/frames/{sh}/f_*.png")}
    pre = sorted(glob.glob(f"{W}/preview/{sh}_p*.png"))
    kinds[sh] = "full" if len(full) >= n else ("part" if full else "stills")
    last = None
    for f in range(1, n + 1):
        if f in full:
            p = full[f]
        elif full and last:
            p = last
        else:
            fr = [int(x[-7:-4]) for x in pre]
            p = pre[max(j for j, v in enumerate(fr) if v <= f)]
        last = p
        k += 1
        get(p).save(f"{OUT}/frame_{k:05d}.png", compress_level=1)
print(k, "frames;", {v: [s for s in kinds if kinds[s] == v] for v in ("full", "part", "stills")})

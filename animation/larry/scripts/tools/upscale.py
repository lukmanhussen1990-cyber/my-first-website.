# HANDOFF step 7: upscale MODE=fast frames (540x960) to 720x1280 with Lanczos + a light unsharp mask.
# Usage: python3 upscale.py <frames_dir> <out_dir>      (keeps the <shot>/f_XXXX.png layout for assemble.sh FRAMES=)
import sys, os, glob
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageFilter

SRC, DST = sys.argv[1], sys.argv[2]


def one(p):
    q = os.path.join(DST, os.path.relpath(p, SRC))
    if os.path.exists(q) and os.path.getmtime(q) >= os.path.getmtime(p):
        return 0
    os.makedirs(os.path.dirname(q), exist_ok=True)
    im = Image.open(p).convert("RGB")
    if im.size != (720, 1280):
        im = im.resize((720, 1280), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    im.save(q)
    return 1


if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(SRC, "sh*", "f_*.png")))
    with ProcessPoolExecutor(4) as ex:
        done = sum(ex.map(one, files, chunksize=16))
    print(len(files), "frames,", done, "upscaled ->", DST)

"""Inspect official brand SVGs: validate engine/svg.py against librsvg and
build a per-shape atlas (index, color, bbox) so rig parts can be identified.

usage: .venv/bin/python -I tools/inspect_brand.py <svg> <out_prefix>
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import svg  # noqa: E402

FONT = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 14)
STAGE = (6, 10, 12)


def librsvg(path, w, h, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-c:v", "librsvg", "-width", str(w), "-height", str(h),
                    "-i", str(path), str(out)], check=True)
    return np.asarray(Image.open(out).convert("RGBA")).astype(np.float32) / 255.0


def main(src, prefix):
    src, prefix = Path(src), Path(prefix)
    doc = svg.load(src)
    vb = doc.viewbox
    scale = 900 / max(vb[2], vb[3])
    w, h = int(round(vb[2] * scale)), int(round(vb[3] * scale))
    M = np.array([[scale, 0, -vb[0] * scale], [0, scale, -vb[1] * scale], [0, 0, 1.0]])
    ours = svg.render(doc.shapes, M, (h, w), ss=4)
    ref = librsvg(src, w, h, prefix.with_name(prefix.name + "_librsvg.png"))
    # compare premultiplied colour over the stage
    def over(img):
        return img[..., :3] * img[..., 3:4] + np.array(STAGE, np.float32) / 255 * (1 - img[..., 3:4])
    diff = np.abs(over(ours) - over(ref)) * 255
    print(f"{src.name}: {len(doc.shapes)} shapes, viewBox {vb}, render {w}x{h}")
    print(f"  vs librsvg: mean |diff| {diff.mean():.3f} levels, 99.9th pct {np.percentile(diff, 99.9):.1f}, max {diff.max():.1f}")
    Image.fromarray(svg.to_uint8(ours, STAGE)).save(prefix.with_name(prefix.name + "_ours.png"))
    Image.fromarray(np.clip(diff * 4, 0, 255).astype(np.uint8)).save(prefix.with_name(prefix.name + "_diff_x4.png"))

    # per-shape atlas
    cols, cell = 5, 260
    rows = (len(doc.shapes) + cols - 1) // cols
    atlas = Image.new("RGB", (cols * cell, rows * (cell + 40)), (40, 44, 48))
    d = ImageDraw.Draw(atlas)
    full = svg.render(doc.shapes, svg.fit_matrix((vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]), (cell - 20, cell - 20)), (cell - 20, cell - 20))
    ghost = svg.to_uint8(full, STAGE).astype(np.float32) * 0.25
    for i, sh in enumerate(doc.shapes):
        x, y = (i % cols) * cell, (i // cols) * (cell + 40)
        one = svg.render([sh], svg.fit_matrix((vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]), (cell - 20, cell - 20)), (cell - 20, cell - 20))
        hi = one.copy()
        hi[..., :3] = np.where(np.array(sh.fill) > 200, hi[..., :3], hi[..., :3])
        img = ghost.copy()
        a = one[..., 3:4]
        img = img * (1 - a) + np.array([255, 70, 200], np.float32) * a
        atlas.paste(Image.fromarray(img.astype(np.uint8)), (x + 10, y + 10))
        x0, y0, x1, y1 = sh.bbox
        d.text((x + 10, y + cell - 6), f"#{sh.index} {sh.hex()} a={sh.alpha:g} {sh.rule[:3]}", font=FONT, fill=(235, 235, 235))
        d.text((x + 10, y + cell + 12), f"bbox {x0:.0f},{y0:.0f} {x1:.0f},{y1:.0f}  n={len(sh.contours)}", font=FONT, fill=(170, 180, 185))
    atlas.save(prefix.with_name(prefix.name + "_atlas.png"))
    for sh in doc.shapes:
        x0, y0, x1, y1 = sh.bbox
        print(f"  #{sh.index:2d} {sh.tag:7s} {sh.hex()} a={sh.alpha:.2f} {sh.rule:8s} contours={len(sh.contours)} "
              f"bbox=({x0:7.1f},{y0:7.1f})-({x1:7.1f},{y1:7.1f}) c=({(x0 + x1) / 2:6.1f},{(y0 + y1) / 2:6.1f})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

"""Consistency pass: mobs, worn armour, and the coloured particle sprites get the same
film grade as the blocks/items, so the whole frame matches (otherwise a vivid golden apple
would sit next to a visibly duller pig).

Safety rules (same as gen_textures): alpha is never changed, fully transparent texels are
untouched, size / extension / TGA origin are preserved, and greyscale masks (dye masks,
banner patterns, tint layers) stay exactly neutral because the grade only adds chroma to
colours that already have some.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from common import Grade, rgb_to_oklab, smoothstep, save_image, tga_orientation_of, map_toward, limit_delta
from gen_textures import MAX_DELTA

ENTITY_GRADE = Grade(chroma=1.10, contrast=0.06, lift=0.010, warm=0.6)
ARMOR_GRADE = Grade(chroma=1.10, contrast=0.07, lift=0.012, warm=0.6)
FLAME_GRADE = Grade(chroma=1.15, contrast=0.08, lightness=0.025, warm=0.0)
PARTICLE_GRADE = Grade(chroma=1.25, contrast=0.05, lightness=0.01, warm=0.0)


def _grade_file(src: Path, dst: Path, grade: Grade, only_colored=False, skip_neutral=False):
    """Returns False when the file was deliberately left alone."""
    im = Image.open(src)
    arr = np.array(im.convert("RGBA"))
    rgb = arr[..., :3].astype(np.float64) / 255.0
    lab_v = rgb_to_oklab(rgb)
    if skip_neutral:
        vis = arr[..., 3] > 0
        # pure-greyscale textures are almost always masks that the engine tints (banner / shield patterns,
        # tropical-fish and horse markings, dyed armour): keep them bit-exact
        if not vis.any() or np.hypot(lab_v[..., 1], lab_v[..., 2])[vis].max() < 0.02:
            return False
    out_rgb = grade.apply_rgb(rgb)
    if only_colored:                       # leave grey / white / black sprites (tinted by emitters) untouched
        c0 = np.hypot(lab_v[..., 1], lab_v[..., 2])
        m = smoothstep(0.04, 0.09, c0)[..., None]
        out_rgb = rgb * (1 - m) + out_rgb * m
    out_rgb = map_toward(lab_v, limit_delta(lab_v, rgb_to_oklab(out_rgb), MAX_DELTA))   # same safety cap as gen_textures
    res = np.clip(np.round(out_rgb * 255), 0, 255).astype(np.uint8)
    out = arr.copy()
    out[..., :3] = np.where((arr[..., 3] > 0)[..., None], res, arr[..., :3])
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() == ".tga":
        save_image(out, dst, tga_orientation=tga_orientation_of(src))
    elif im.mode in ("RGB", "L", "P") and (arr[..., 3] == 255).all():
        Image.fromarray(out[..., :3], "RGB").save(dst, optimize=True)
    else:
        save_image(out, dst)
    return True


def _tree(vanilla: Path, out_dir: Path, sub: str, grade: Grade, skip=None, only_colored=False):
    n = 0
    for f in sorted((vanilla / "textures" / sub).rglob("*")):
        if not f.is_file() or f.suffix.lower() not in (".png", ".tga"):
            continue
        if skip and skip.search(f.stem):
            continue
        if _grade_file(f, out_dir / f.relative_to(vanilla), grade, only_colored, skip_neutral=True):
            n += 1
    return n


def generate(vanilla: Path, out_dir: Path, log=print):
    n_ent = _tree(vanilla, out_dir, "entity", ENTITY_GRADE)
    n_arm = _tree(vanilla, out_dir, "models", ARMOR_GRADE)
    # flame / particle atlases: coloured sprites only (the white/grey ones are tinted by the emitters)
    _grade_file(vanilla / "textures" / "flame_atlas.png", out_dir / "textures" / "flame_atlas.png", FLAME_GRADE)
    _grade_file(vanilla / "textures" / "particle" / "particles.png",
                out_dir / "textures" / "particle" / "particles.png", PARTICLE_GRADE, only_colored=True)
    log(f"consistency pass: {n_ent} entity, {n_arm} armour textures graded (pure-grey tint masks left untouched) + flame/particle atlases")

"""Film-style grading of the terrain / item textures.

The grade is a pure colour function applied in OKLab (see common.Grade): vibrance +
gentle S-curve + split-tone.  Alpha channels, image sizes, file names and file
extensions are preserved exactly, so atlas / flipbook / UV layouts keep working.
Special passes:
  * ores            -> their coloured flecks get brighter ("glint")
  * light emitters  -> a touch brighter so they read as luminous
  * leaves          -> stronger contrast (more depth in the canopy)
  * *_carried       -> use the same grade as the biome colormaps (matches in-world tint)
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
from PIL import Image

from common import (Grade, rgb_to_oklab, smoothstep, save_image, tga_orientation_of, map_toward, limit_delta)
import gen_atmosphere

BLOCK_GRADE = Grade(chroma=1.12, contrast=0.09, lift=0.015, warm=1.0)
ITEM_GRADE = Grade(chroma=1.16, contrast=0.10, lift=0.012, warm=0.8)
LEAF_GRADE = Grade(chroma=1.10, contrast=0.20, lift=0.0, warm=0.0)
LAVA_GRADE = Grade(chroma=1.18, contrast=0.10, lightness=0.02, warm=0.0)

SKIP = re.compile(
    r"(_mipmap$|_placeholder$|^missing_tile$|^barrier$|^structure_|^build_(allow|deny)$|^border$|^camera_"
    r"|^water_|^cauldron_water|^bubble_column_|^end_portal|^end_gateway|^destroy_stage|^itemframe_background$"
    # command blocks: terrain_texture.json points at the *_mipmap files, so graded twins would be dead/inconsistent
    r"|^(chain_|repeating_)?command_block"
    # pure-grey masks that the engine tints (power level, growth stage, dye, potion/egg colour): leave exactly neutral
    r"|^redstone_dust_|^(pumpkin|melon)_stem_|^spawn_egg|^potion_overlay$|^tipped_arrow_head$|^fireworks_charge$"
    r"|^leather_(helmet|chestplate|leggings|boots|horse_armor)$|^wolf_armor_dyed$)")
CARRIED = re.compile(r"(_carried$|^carried_)")
LEAVES = re.compile(r"(^leaves_|_leaves(_opaque|_flowers|_flowers_opaque)?$|^azalea_leaves)")
ORES = re.compile(r"(_ore$|^ancient_debris|^gilded_blackstone$)")
# textures whose ALPHA is the biome-tint mask (alpha 0 = still opaque dirt, not "transparent")
MASK_ALPHA = re.compile(r"^grass_side(_snowed)?$")
EMISSIVE = re.compile(
    r"(froglight|^glowstone$|^sea_lantern$|^shroomlight$|^redstone_lamp_on$|^magma$|^pumpkin_face_on$|torch|lantern"
    r"|campfire.*_lit$|^fire_|^soul_fire|^beacon$|^end_rod$|_lit($|_)|^crying_obsidian$|^glowing_obsidian$"
    r"|^respawn_anchor_(top|side)|furnace_front_on$|smoker_front_on$|^portal$|^glow_lichen$|^glow_item_frame$)")


RELIEF_K, RELIEF_CLAMP = 0.45, 0.06


def relief_shade(rgb_out, arr):
    """Baked 'bump' lighting (light from the top-left): luminance is treated as a height
    map and its slope along the light direction nudges lightness by a few percent.
    Only for fully opaque, square, non-animated block textures; edges are replicated
    (not wrapped) so frames / borders of e.g. bookshelves don't bleed into each other."""
    lab0 = rgb_to_oklab(rgb_out)
    L = lab0[..., 0]
    P = np.pad(L, 1, mode="edge")
    nw, se = P[:-2, :-2], P[2:, 2:]
    n, s_ = P[:-2, 1:-1], P[2:, 1:-1]
    w, e = P[1:-1, :-2], P[1:-1, 2:]
    d = (nw - se) * 0.5 + ((n - s_) + (w - e)) * 0.25
    lab = lab0.copy()
    lab[..., 0] = L + np.clip(d * RELIEF_K, -RELIEF_CLAMP, RELIEF_CLAMP)
    return map_toward(lab0, lab)


MAX_DELTA = 0.085      # OKLab distance a texel may move from the vanilla colour (all passes together)


def _grade_special(arr, base_grade, name, relief=False, special=True):
    """arr: (H,W,4) uint8 -> graded (H,W,4) uint8."""
    a = arr.astype(np.float64) / 255.0
    rgb = a[..., :3]
    alpha = arr[..., 3]
    mask_alpha = bool(MASK_ALPHA.search(name))
    lab_vanilla = rgb_to_oklab(rgb)
    g = base_grade
    if special and LEAVES.search(name) and not CARRIED.search(name):     # carried leaves keep the colormap grade
        g = LEAF_GRADE
    out_rgb = g.apply_rgb(rgb)

    if special and ORES.search(name):
        # glint = flecks that are more colourful than the stone/netherrack around them (relative to the
        # texture's own median chroma, otherwise a red netherrack background would "glint" as a whole)
        c0 = np.hypot(lab_vanilla[..., 1], lab_vanilla[..., 2])
        vis_ = (alpha > 0) | mask_alpha
        ref = np.median(c0[vis_]) if vis_.any() else 0.0
        mask = smoothstep(0.035, 0.085, c0 - ref)
        lab0 = rgb_to_oklab(out_rgb)
        lab = lab0.copy()
        lab[..., 0] += 0.055 * mask
        lab[..., 1] *= 1 + 0.20 * mask
        lab[..., 2] *= 1 + 0.20 * mask
        out_rgb = map_toward(lab0, lab)
    elif special and EMISSIVE.search(name):
        lab0 = rgb_to_oklab(out_rgb)
        lab = lab0.copy()
        lab[..., 0] += 0.030
        lab[..., 1] *= 1.10
        lab[..., 2] *= 1.10
        out_rgb = map_toward(lab0, lab)

    if relief and arr.shape[0] == arr.shape[1] and ((alpha == 255).all() or mask_alpha):
        shaded = relief_shade(out_rgb, arr)
        # the tinted fringe of grass_side (alpha 255) is multiplied by the biome colour at run time, exactly like
        # grass_top; shading it here as well made the fringe visibly lighter than the top face, so only the dirt
        # part of such a texture gets the baked relief
        out_rgb = np.where(((alpha == 255) & mask_alpha)[..., None], out_rgb, shaded)

    # final safety net: no texel may drift further than MAX_DELTA from its vanilla colour
    lab_fin = rgb_to_oklab(out_rgb)
    out_rgb = map_toward(lab_vanilla, limit_delta(lab_vanilla, lab_fin, MAX_DELTA))

    out = arr.copy()
    res = np.clip(np.round(out_rgb * 255), 0, 255).astype(np.uint8)
    visible = (alpha > 0) | mask_alpha                   # never touch fully transparent texels (but alpha-as-tint-mask is not transparency)
    out[..., :3] = np.where(visible[..., None], res, arr[..., :3])
    return out


def process_dir(vanilla: Path, out_dir: Path, sub: str, grade: Grade, log=print, relief=False):
    src_root = vanilla / "textures" / sub
    stats = dict(done=0, skipped=0)
    carried_grade = gen_atmosphere.preset_grade("standard")
    for f in sorted(src_root.rglob("*")):
        if f.suffix.lower() not in (".png", ".tga") or not f.is_file():
            continue
        name = f.stem
        if SKIP.search(name):
            stats["skipped"] += 1
            continue
        im = Image.open(f)
        arr = np.array(im.convert("RGBA"))
        g = carried_grade if CARRIED.search(name) else (LAVA_GRADE if name.startswith("lava") else grade)
        out = _grade_special(arr, g, name, relief=relief)
        # keep the original colour mode (RGB images stay RGB so the engine sees the same format)
        rel = f.relative_to(vanilla)
        dst = out_dir / rel
        if f.suffix.lower() == ".tga":
            save_image(out, dst, tga_orientation=tga_orientation_of(f))
        else:
            if im.mode in ("RGB", "L", "P") and (arr[..., 3] == 255).all():
                dst.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(out[..., :3], "RGB").save(dst, optimize=True)
            else:
                save_image(out, dst)
        stats["done"] += 1
    return stats


def generate(vanilla: Path, out_dir: Path, log=print):
    s1 = process_dir(vanilla, out_dir, "blocks", BLOCK_GRADE, log, relief=True)
    s2 = process_dir(vanilla, out_dir, "items", ITEM_GRADE, log)
    log(f"textures graded: blocks {s1}, items {s2}")

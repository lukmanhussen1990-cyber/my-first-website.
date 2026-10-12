#!/usr/bin/env python3
"""Generate the particle atlas and the 13 particle effect files (SPEC section 8).

Usage (from the repo root, i.e. the `cursed-eyeball-guardian` folder):

    python3 tools/gen_particles.py              # write atlas + particles/*.json
    python3 tools/gen_particles.py --check      # only validate the Molang (no writes)
    python3 tools/gen_particles.py --sim DIR    # also render approximate previews to DIR

Outputs (resource pack):
    textures/particle/ceg_particles.png   64x64, 4x4 grid of 16x16 white/greyscale sprites
    particles/<name>.json                 one file per effect id `ceg:<name>`

Everything is deterministic (no randomness except a fixed-seed RNG for the smoke
sprite), so re-running produces byte-identical files.

Design notes
------------
* format_version "1.10.0"; only components/fields that the vanilla 1.21.0.26 particle
  files use (plus the `particles_add` material for glows).
* Every effect is a *single* emitter.  Effects that need several looks (flash + sparks +
  ring + shards) give each particle a "role" chosen from `variable.particle_random_1`
  (the same trick vanilla uses in portal_east_west / electric_spark).  The role picks the
  atlas cell, lifetime, speed, acceleration, size and colour.
* Script-spawned effects tint from `variable.color.r/g/b` (MolangVariableMap.setColorRGB);
  if no colour was supplied (e.g. `/particle ceg:impact ~ ~ ~`) they fall back to crimson.
  "hot" and "dark" shades are derived from the supplied primary colour.
* Entity-bound effects (aura, rage_aura) read `variable.skin` (set by the client entity's
  pre_effect_script) and map it to the SPEC skin palette; undefined -> 0 -> crimson.
* Billboard `size` is the half extent of the quad (vanilla convention).
"""
from __future__ import annotations

import json
import math
import random
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "packs" / "Cursed_Eyeball_Guardian_RP"
ATLAS_PATH = RP / "textures" / "particle" / "ceg_particles.png"
PARTICLE_DIR = RP / "particles"
TEXTURE_REF = "textures/particle/ceg_particles"

# --------------------------------------------------------------------------------------
# Atlas (64x64, 16x16 cells).  Sprites are white / greyscale so the tint sets the colour.
# --------------------------------------------------------------------------------------
CELL = 16
UV = {
    "glow": (0, 0),     # (0,0) soft round glow
    "spark": (16, 0),   # (1,0) 4-point spark / star
    "ring": (32, 0),    # (2,0) thin ring
    "heart": (48, 0),   # (3,0) pixel heart
    "cube": (0, 16),    # (0,1) voxel cube shard
    "smoke": (16, 16),  # (1,1) smoke puff
    "rune": (32, 16),   # (2,1) rune circle
    "pixel": (48, 16),  # (3,1) small square energy pixel
}


def _grid():
    """Pixel-centre coordinates relative to the cell centre (8, 8)."""
    ys, xs = np.mgrid[0:CELL, 0:CELL].astype(np.float64)
    return xs + 0.5 - 8.0, ys + 0.5 - 8.0


def _cell(lum, alpha):
    lum = np.clip(lum, 0, 1)
    alpha = np.clip(alpha, 0, 1)
    out = np.zeros((CELL, CELL, 4), dtype=np.float64)
    out[..., 0] = out[..., 1] = out[..., 2] = lum
    out[..., 3] = alpha
    out[alpha <= 0] = 0
    return out


def _q(a, steps):
    return np.round(np.clip(a, 0, 1) * steps) / steps


def sprite_glow():
    dx, dy = _grid()
    d = np.hypot(dx, dy) / 7.0
    a = _q(np.clip(1.0 - d, 0, 1) ** 1.6, 8)
    a[(np.abs(dx) < 1) & (np.abs(dy) < 1)] = 1.0
    lum = 0.82 + 0.18 * np.clip(1.0 - d * 1.4, 0, 1)
    return _cell(lum, a)


def sprite_spark():
    dx, dy = _grid()
    ax, ay = np.abs(dx), np.abs(dy)
    a = np.zeros_like(dx)
    # main 4 arms, 2 px wide, fading to the tips
    arm_h = (ay < 1) & (ax < 7.5)
    arm_v = (ax < 1) & (ay < 7.5)
    a = np.where(arm_h, np.maximum(a, 1.0 - (ax / 8.0) ** 1.4), a)
    a = np.where(arm_v, np.maximum(a, 1.0 - (ay / 8.0) ** 1.4), a)
    # short diagonal glints
    diag = (np.abs(ax - ay) < 0.6) & (ax < 3.2)
    a = np.where(diag, np.maximum(a, 0.7), a)
    # bright 4x4 core with a soft 6x6 halo
    core = (ax < 2) & (ay < 2)
    halo = (ax < 3) & (ay < 3) & ~core
    a = np.where(core, 1.0, a)
    a = np.where(halo, np.maximum(a, 0.45), a)
    a = _q(a, 8)
    lum = np.where(core, 1.0, 0.9)
    return _cell(lum, a)


def sprite_ring():
    dx, dy = _grid()
    d = np.hypot(dx, dy)
    a = np.clip(1.0 - np.abs(d - 6.0) / 1.15, 0, 1)
    inner = np.where(d < 6.0, 0.14 * (d / 6.0) ** 2, 0)
    a = _q(np.maximum(a, inner), 8)
    return _cell(np.ones_like(a), a)


HEART = [
    "..XXX...XXX..",
    ".XXXXX.XXXXX.",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    ".XXXXXXXXXXX.",
    "..XXXXXXXXX..",
    "...XXXXXXX...",
    "....XXXXX....",
    ".....XXX.....",
    "......X......",
]


def sprite_heart():
    mask = np.zeros((CELL, CELL), dtype=bool)
    ox, oy = 1, 2
    for r, row in enumerate(HEART):
        for c, ch in enumerate(row):
            if ch == "X":
                mask[oy + r, ox + c] = True
    lum = np.zeros((CELL, CELL))
    alpha = mask.astype(float)
    for y in range(CELL):
        for x in range(CELL):
            if not mask[y, x]:
                continue
            nb = [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)]
            edge = any(not (0 <= j < CELL and 0 <= i < CELL and mask[j, i]) for j, i in nb)
            if edge:
                lum[y, x] = 0.42
                continue
            lum[y, x] = 0.86
            # darker lower-right body
            down_right = [(y + 1, x + 1), (y + 2, x + 1), (y + 1, x + 2)]
            if any(not (0 <= j < CELL and 0 <= i < CELL and mask[j, i]) for j, i in down_right):
                lum[y, x] = 0.66
    # glossy highlight on the left lobe
    for (x, y) in [(3, 4), (4, 4), (3, 5), (5, 3), (4, 3)]:
        if mask[y, x]:
            lum[y, x] = 1.0
    return _cell(lum, alpha)


def _poly_mask(points):
    img = Image.new("L", (CELL, CELL), 0)
    ImageDraw.Draw(img).polygon(points, fill=255)
    return np.array(img) > 0


def sprite_cube():
    top = _poly_mask([(8, 2), (14, 5), (8, 8), (2, 5)])
    left = _poly_mask([(2, 5), (8, 8), (8, 14), (2, 11)]) & ~top
    right = _poly_mask([(8, 8), (14, 5), (14, 11), (8, 14)]) & ~top & ~left
    lum = np.zeros((CELL, CELL))
    lum[top] = 1.0
    lum[left] = 0.74
    lum[right] = 0.52
    alpha = (top | left | right).astype(float)
    # crisp darker silhouette edge + a highlight pixel on the top face
    m = alpha > 0
    for y in range(CELL):
        for x in range(CELL):
            if not m[y, x]:
                continue
            nb = [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)]
            if any(not (0 <= j < CELL and 0 <= i < CELL and m[j, i]) for j, i in nb):
                lum[y, x] *= 0.72
    lum[4, 6] = lum[4, 7] = 1.0
    return _cell(lum, alpha)


def sprite_smoke():
    """Chunky cloud puff: bumpy outline, bright core, darker rim and underside."""
    rng = random.Random(1337)
    dx, dy = _grid()
    blobs = [(-2.4, 1.6, 4.0), (2.4, 1.8, 3.8), (0.0, -1.2, 4.2), (-4.0, -0.6, 2.6), (4.1, -0.2, 2.5),
             (-1.8, -4.0, 2.4), (2.2, -3.6, 2.4)]
    field = np.zeros_like(dx)
    for (bx, by, br) in blobs:
        field = np.maximum(field, 1.0 - np.hypot(dx - bx, dy - by) / br)
    inside = field > 0.0
    alpha = np.where(inside, np.where(field > 0.3, 0.88, 0.5), 0.0)
    noise = np.array([[rng.random() for _ in range(CELL)] for _ in range(CELL)])
    shade = 0.55 + 0.35 * np.clip(field * 1.6, 0, 1) - 0.12 * np.clip(dy / 7.0, 0, 1) + (noise - 0.5) * 0.06
    return _cell(_q(shade, 8), alpha)


def sprite_rune():
    """Summoning sigil: outer ring, inscribed diamond, four rune dots and a central eye."""
    dx, dy = _grid()
    d = np.hypot(dx, dy)
    manhattan = np.abs(dx) + np.abs(dy)
    a = np.zeros_like(d)
    lum = np.zeros_like(d)
    outer = (d >= 6.45) & (d < 7.6)
    diamond = (np.abs(manhattan - 6.0) < 0.1) & ~outer
    dots = (np.abs(np.abs(dx) - 4.5) < 0.1) & (np.abs(np.abs(dy) - 4.5) < 0.1)
    eye = (manhattan <= 3.0) & ~((np.abs(dx) < 1) & (np.abs(dy) < 1))
    for mask, l in ((outer, 1.0), (diamond, 0.85), (dots, 1.0), (eye, 1.0)):
        a[mask] = 1.0
        lum[mask] = l
    return _cell(lum, a)


def sprite_pixel():
    dx, dy = _grid()
    cheb = np.maximum(np.abs(dx), np.abs(dy))
    a = np.where(cheb < 2, 1.0, np.where(cheb < 3, 0.6, np.where(cheb < 4, 0.18, 0.0)))
    lum = np.where(cheb < 1, 1.0, np.where(cheb < 2, 0.95, 0.88))
    return _cell(lum, a)


SPRITES = {
    "glow": sprite_glow,
    "spark": sprite_spark,
    "ring": sprite_ring,
    "heart": sprite_heart,
    "cube": sprite_cube,
    "smoke": sprite_smoke,
    "rune": sprite_rune,
    "pixel": sprite_pixel,
}


def build_atlas() -> Image.Image:
    atlas = np.zeros((64, 64, 4), dtype=np.float64)
    for name, fn in SPRITES.items():
        u, v = UV[name]
        atlas[v:v + CELL, u:u + CELL] = fn()
    return Image.fromarray(np.round(atlas * 255).astype(np.uint8), "RGBA")


# --------------------------------------------------------------------------------------
# Molang helpers used to build the effect files
# --------------------------------------------------------------------------------------
R1, R2, R3, R4 = (f"variable.particle_random_{i}" for i in range(1, 5))
AGE = "variable.particle_age"
LIFE = "variable.particle_lifetime"
LT = "variable.lt"  # 0..1 life fraction, set in per_render_expression

# Script colour: primary from MolangVariableMap.setColorRGB('variable.color', ...),
# crimson fallback; hot = primary pushed 72% to white, dark = primary * 0.45.
SCRIPT_COLOURS = (
    "variable.ok = variable.color.r + variable.color.g + variable.color.b > 0.01;"
    " variable.pr = variable.ok ? variable.color.r : 1.0;"
    " variable.pg = variable.ok ? variable.color.g : 0.08;"
    " variable.pb = variable.ok ? variable.color.b : 0.08;"
    " variable.hr = variable.pr + (1 - variable.pr) * 0.72;"
    " variable.hg = variable.pg + (1 - variable.pg) * 0.72;"
    " variable.hb = variable.pb + (1 - variable.pb) * 0.72;"
    " variable.dr = variable.pr * 0.45;"
    " variable.dg = variable.pg * 0.45;"
    " variable.db = variable.pb * 0.45;"
)

# SPEC section 6 skin table: idx -> (primary, dark, hot)
SKINS = [
    ((1.00, 0.08, 0.08), (0.45, 0.00, 0.02), (1.00, 0.75, 0.65)),  # 0 crimson
    ((0.72, 0.20, 1.00), (0.30, 0.00, 0.50), (0.95, 0.80, 1.00)),  # 1 void
    ((0.15, 0.60, 1.00), (0.00, 0.22, 0.55), (0.80, 0.95, 1.00)),  # 2 frost
    ((0.25, 1.00, 0.30), (0.00, 0.40, 0.08), (0.85, 1.00, 0.70)),  # 3 toxic
]


def _skin_pick(values):
    """Nested ternary on variable.sk returning values[sk]; 0 (crimson) is the fallback."""
    v0, v1, v2, v3 = (f"{x:g}" for x in values)
    return f"(variable.sk == 1 ? {v1} : (variable.sk == 2 ? {v2} : (variable.sk == 3 ? {v3} : {v0})))"


def _skin_colours():
    parts = ["variable.sk = math.round(variable.skin);"]
    for slot, prefix in ((0, "p"), (1, "d"), (2, "h")):
        for ch, chname in enumerate("rgb"):
            vals = [SKINS[i][slot][ch] for i in range(4)]
            parts.append(f" variable.{prefix}{chname} = {_skin_pick(vals)};")
    return "".join(parts)


SKIN_COLOURS = _skin_colours()


def mix(a, b, t):
    return f"({a} + ({b} - {a}) * {t})"


def col(prefix):
    return tuple(f"variable.{prefix}{c}" for c in "rgb")


def mixc(pa, pb, t):
    """Mix two colour prefixes ('p', 'h', 'd') channel-wise by molang t."""
    return tuple(mix(a, b, t) for a, b in zip(col(pa), col(pb)))


def scale(c, k):
    return tuple(f"{x} * {k}" for x in c)


def chain(roles, key, default=None):
    """Nested ternary over role thresholds on particle_random_1 (role[key] or default)."""
    vals = [r.get(key, default) for r in roles]
    if any(v is None for v in vals):
        raise KeyError(key)
    if all(str(v) == str(vals[0]) for v in vals):
        return vals[0] if isinstance(vals[0], (int, float)) else str(vals[0])
    expr = str(vals[-1])
    for role, val in zip(reversed(roles[:-1]), reversed(vals[:-1])):
        expr = f"({R1} < {role['p']} ? ({val}) : {expr})"
    return expr


def role_components(roles, colour_setup, extra_render=""):
    """per_render_expression computing size + rgba per role, plus uv expressions."""
    rgba = {}
    for i, ch in enumerate("rgba"):
        rgba[ch] = chain([{**r, "c": r["col"][i]} for r in roles], "c")
    render = (
        f"variable.lt = {AGE} / {LIFE}; " + colour_setup + extra_render +
        f" variable.sz = {chain(roles, 'size')};"
        f" variable.cr = {rgba['r']};"
        f" variable.cg = {rgba['g']};"
        f" variable.cb = {rgba['b']};"
        f" variable.ca = {rgba['a']};"
    )
    us = chain([{**r, "u": UV[r["sprite"]][0]} for r in roles], "u")
    vs = chain([{**r, "v": UV[r["sprite"]][1]} for r in roles], "v")
    return render, [us, vs]


def billboard(uv):
    return {
        "size": ["variable.sz", "variable.sz"],
        "facing_camera_mode": "lookat_xyz",
        "uv": {
            "texture_width": 64,
            "texture_height": 64,
            "uv": uv,
            "uv_size": [CELL, CELL],
        },
    }


TINT = {"color": ["variable.cr", "variable.cg", "variable.cb", "variable.ca"]}


def effect(name, material, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": f"ceg:{name}",
                "basic_render_parameters": {"material": material, "texture": TEXTURE_REF},
            },
            "components": components,
        },
    }


def assemble(name, material, roles, colours, emitter, motion=None, spin=True, extra_render=""):
    render, uv = role_components(roles, colours, extra_render)
    comps = dict(emitter)
    comps["minecraft:particle_lifetime_expression"] = {"max_lifetime": chain(roles, "life")}
    if motion is not None:
        comps.update(motion)
    if spin:
        comps["minecraft:particle_initial_spin"] = {
            "rotation": chain(roles, "rot", "math.random(0, 360)"),
            "rotation_rate": chain(roles, "spin", "math.random(-120, 120)"),
        }
    comps["minecraft:particle_initialization"] = {"per_render_expression": render}
    comps["minecraft:particle_appearance_billboard"] = billboard(uv)
    comps["minecraft:particle_appearance_tinting"] = TINT
    return effect(name, material, comps)


def fade_out(power=2):
    return f"(1 - math.pow({LT}, {power}))"


def dynamic(roles, drag):
    return {
        "minecraft:particle_initial_speed": chain(roles, "speed"),
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [0, chain(roles, "ay"), 0],
            "linear_drag_coefficient": drag,
        },
    }


# --------------------------------------------------------------------------------------
# The 13 effects
# --------------------------------------------------------------------------------------

def fx_aura():
    hot_to_p = mixc("h", "p", f"math.min({LT} * 2, 1)")
    roles = [
        dict(p=0.55, sprite="pixel", life="math.random(0.9, 1.4)",
             size=f"(0.13 + {R2} * 0.07) * (1 - {LT} * 0.6)",
             col=(*hot_to_p, fade_out(2))),
        dict(p=0.85, sprite="glow", life="math.random(0.8, 1.2)",
             size=f"(0.12 + {R2} * 0.06) * (1 - {LT} * 0.5)",
             col=(*hot_to_p, f"0.85 * {fade_out(2)}")),
        dict(p=1, sprite="cube", life="math.random(1.0, 1.4)",
             size=f"(0.07 + {R2} * 0.03)",
             col=(*mixc("p", "d", LT), fade_out(3))),
    ]
    emitter = {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 6, "max_particles": 12},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.55, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.15, 0.4)",
    }
    motion = {"minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.35, 0], "linear_drag_coefficient": 1.5}}
    return assemble("aura", "particles_add", roles, SKIN_COLOURS, emitter, motion)


def fx_rage_aura():
    roles = [
        dict(p=0.35, sprite="smoke", life="math.random(0.9, 1.3)", speed="math.random(0.2, 0.5)", ay=0.9,
             size=f"(0.2 + {R2} * 0.1) * (0.7 + {LT} * 0.8)",
             col=(*scale(col("d"), 0.8), f"0.8 * (1 - {LT})")),
        dict(p=0.75, sprite="spark", life="math.random(0.35, 0.7)", speed="math.random(1.2, 2.4)", ay=1.6,
             size=f"(0.12 + {R2} * 0.07) * (1 - {LT} * 0.7)",
             col=(*mixc("h", "p", LT), fade_out(2))),
        dict(p=1, sprite="pixel", life="math.random(0.4, 0.8)", speed="math.random(0.8, 1.8)", ay=2.0,
             size=f"(0.1 + {R2} * 0.05) * (1 - {LT} * 0.5)",
             col=(*mixc("p", "h", f"{R3} * 0.6"), fade_out(2))),
    ]
    emitter = {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 20, "max_particles": 30},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "surface_only": True, "direction": "outwards"},
    }
    return assemble("rage_aura", "particles_blend", roles, SKIN_COLOURS, emitter, dynamic(roles, 2.2))


def fx_laser_segment():
    roles = [
        dict(p=0.45, sprite="glow", life=0.25,
             size=f"(0.14 + {R2} * 0.04) * (1 - {LT} * 0.5)",
             col=(*col("h"), fade_out(3))),
        dict(p=1, sprite="glow", life=0.25,
             size=f"(0.34 + {R2} * 0.08) * (1 - {LT} * 0.4)",
             col=(*col("p"), f"0.7 * {fade_out(2)}")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 2},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {
            "offset": ["math.random(-0.03, 0.03)", "math.random(-0.03, 0.03)", "math.random(-0.03, 0.03)"],
        },
    }
    return assemble("laser_segment", "particles_add", roles, SCRIPT_COLOURS, emitter, None, spin=False)


def fx_laser_charge():
    x = (f"variable.k = {R1} < 0.2 ? 0 : (1 - {AGE} / {LIFE}) * (0.8 + {R4} * 0.45);"
         f" variable.y0 = {R3} * 2 - 1;"
         f" variable.h = math.sqrt(1 - variable.y0 * variable.y0);"
         f" variable.a = {R2} * 360 + {AGE} * 300;"
         f" return variable.k * variable.h * math.cos(variable.a);")
    roles = [
        dict(p=0.2, sprite="glow", life=0.3, rot=0,
             size=f"0.08 + {LT} * 0.3",
             col=(*col("h"), LT)),
        dict(p=0.6, sprite="spark", life=0.3,
             size=f"(0.06 + {R2} * 0.04) * (0.6 + {LT} * 0.4)",
             col=(*mixc("p", "h", LT), f"0.4 + {LT} * 0.6")),
        dict(p=1, sprite="pixel", life=0.3,
             size=f"(0.08 + {R2} * 0.04)",
             col=(*mixc("p", "h", LT), f"0.4 + {LT} * 0.6")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {},
    }
    motion = {"minecraft:particle_motion_parametric": {"relative_position": [
        x, "variable.k * variable.y0", "variable.k * variable.h * math.sin(variable.a)"]}}
    return assemble("laser_charge", "particles_add", roles, SCRIPT_COLOURS, emitter, motion)


def fx_impact():
    roles = [
        dict(p=0.1, sprite="glow", life=0.22, speed=0, ay=0, spin=0, rot=0,
             size=f"(0.75 + {R2} * 0.3) * (1 - {LT} * 0.5)",
             col=(*col("h"), f"math.pow(1 - {LT}, 2)")),
        dict(p=0.2, sprite="ring", life=0.4, speed=0, ay=0, spin=0, rot=0,
             size=f"0.2 + {LT} * 1.3",
             col=(*mixc("h", "p", LT), f"1 - {LT}")),
        dict(p=0.62, sprite="spark", life="math.random(0.3, 0.55)", speed="math.random(5, 9)", ay=-3,
             spin="math.random(-360, 360)",
             size=f"(0.09 + {R2} * 0.05) * (1 - {LT} * 0.7)",
             col=(*mixc("h", "p", LT), fade_out(2))),
        dict(p=1, sprite="cube", life="math.random(0.55, 0.9)", speed="math.random(2.5, 5)", ay=-14,
             spin="math.random(-540, 540)",
             size=f"(0.07 + {R2} * 0.05) * (1 - {LT} * 0.4)",
             col=(*mixc("p", "d", LT), fade_out(3))),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 32},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {
            "direction": ["math.random(-1, 1)", "math.random(-0.4, 1)", "math.random(-1, 1)"],
        },
    }
    return assemble("impact", "particles_add", roles, SCRIPT_COLOURS, emitter, dynamic(roles, 2.5))


def fx_rage_burst():
    roles = [
        dict(p=0.06, sprite="glow", life=0.3, speed=0, ay=0, spin=0, rot=0,
             size=f"(1.0 + {R2} * 0.3) * (1 - {LT} * 0.4)",
             col=(*col("h"), f"math.pow(1 - {LT}, 2)")),
        dict(p=0.16, sprite="ring", life=0.55, speed=0, ay=0, spin=0, rot=0,
             size=f"0.3 + {LT} * (1.5 + {R2} * 0.6)",
             col=(*mixc("h", "p", LT), f"1 - {LT}")),
        dict(p=0.72, sprite="spark", life="math.random(0.45, 0.8)", speed="math.random(6, 11)", ay=-2,
             spin="math.random(-360, 360)",
             size=f"(0.1 + {R2} * 0.06) * (1 - {LT} * 0.6)",
             col=(*mixc("h", "p", LT), fade_out(2))),
        dict(p=1, sprite="pixel", life="math.random(0.8, 1.3)", speed="math.random(0.6, 1.6)", ay=1.5,
             spin="math.random(-180, 180)",
             size=f"(0.1 + {R2} * 0.06) * (1 - {LT} * 0.5)",
             col=(*mixc("p", "d", f"{LT} * 0.6"), fade_out(2))),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 40},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {
            "direction": ["math.random(-1, 1)", "math.random(-1, 1)", "math.random(-1, 1)"],
        },
    }
    return assemble("rage_burst", "particles_add", roles, SCRIPT_COLOURS, emitter, dynamic(roles, 2.5))


def fx_shield_dome():
    pulse = f"(0.85 + 0.15 * math.sin({AGE} * 720 + {R3} * 360))"
    fade = f"math.sin({LT} * 180)"
    roles = [
        dict(p=0.55, sprite="pixel", life="math.random(0.85, 1.0)",
             size=f"(0.1 + {R2} * 0.05) * {pulse}",
             col=(*mixc("p", "h", f"{R3} * 0.5"), f"0.9 * {fade}")),
        dict(p=0.85, sprite="glow", life="math.random(0.85, 1.0)",
             size=f"(0.12 + {R2} * 0.06) * {pulse}",
             col=(*col("p"), f"0.7 * {fade}")),
        dict(p=1, sprite="spark", life="math.random(0.6, 0.9)",
             size=f"(0.08 + {R2} * 0.05) * {pulse}",
             col=(*col("h"), fade)),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 30},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_sphere": {"radius": 1.4, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.02, 0.12)",
    }
    motion = {"minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0, 0], "linear_drag_coefficient": 0.5}}
    return assemble("shield_dome", "particles_add", roles, SCRIPT_COLOURS, emitter, motion)


def _sphere_dir(radius):
    """Uniform point on a sphere from particle randoms 2/3 (consistent across x/y/z)."""
    hz = f"math.sqrt(1 - math.pow({R3} * 2 - 1, 2))"
    return [f"{radius} * {hz} * math.cos({R2} * 360)",
            f"{radius} * ({R3} * 2 - 1)",
            f"{radius} * {hz} * math.sin({R2} * 360)"]


def fx_shield_hit():
    roles = [
        dict(p=0.1, sprite="glow", life=0.25, speed=0, ay=0, spin=0, rot=0,
             size=f"(0.6 + {R2} * 0.2) * (1 - {LT} * 0.3)",
             col=(*col("h"), f"0.35 * math.pow(1 - {LT}, 2)")),
        dict(p=0.25, sprite="ring", life=0.35, speed=0, ay=0, spin=0, rot=0,
             size=f"0.7 + {LT} * 1.0",
             col=(*mixc("h", "p", LT), f"0.75 * (1 - {LT})")),
        dict(p=1, sprite="spark", life="math.random(0.3, 0.5)", speed="math.random(1.5, 3.5)", ay=0,
             spin="math.random(-360, 360)",
             size=f"(0.08 + {R2} * 0.05) * (1 - {LT} * 0.6)",
             col=(*mixc("h", "p", LT), fade_out(2))),
    ]
    off = _sphere_dir(1.4)
    dirs = _sphere_dir(1)
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {
            "offset": [f"{R1} < 0.25 ? 0 : {o}" for o in off],
            "direction": [f"{R1} < 0.25 ? {d0} : {d}" for d, d0 in zip(dirs, (0, 1, 0))],
        },
    }
    return assemble("shield_hit", "particles_add", roles, SCRIPT_COLOURS, emitter, dynamic(roles, 3))


def fx_heal():
    sway = f"math.sin({AGE} * 360 + {R2} * 360) * 0.6"
    sway_z = f"math.cos({AGE} * 360 + {R2} * 360) * 0.6"
    roles = [
        dict(p=0.55, sprite="heart", life="math.random(1.0, 1.4)",
             size=f"(0.14 + {R2} * 0.05) * math.min(1, {LT} * 6)",
             col=(*mixc("p", "h", "0.15"), f"{LT} < 0.7 ? 1 : (1 - {LT}) / 0.3")),
        dict(p=0.8, sprite="spark", life="math.random(0.6, 1.0)",
             size=f"(0.07 + {R2} * 0.04) * (1 - {LT} * 0.5)",
             col=(*col("h"), f"1 - {LT}")),
        dict(p=1, sprite="pixel", life="math.random(0.7, 1.1)",
             size=f"(0.08 + {R2} * 0.04)",
             col=(*mixc("p", "h", "0.5"), f"1 - {LT}")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_box": {
            "offset": [0, 0.9, 0],
            "half_dimensions": [0.45, 0.9, 0.45],
            "direction": ["math.random(-0.2, 0.2)", 1, "math.random(-0.2, 0.2)"],
        },
        "minecraft:particle_initial_speed": "math.random(0.4, 0.9)",
    }
    motion = {"minecraft:particle_motion_dynamic": {"linear_acceleration": [sway, 0.8, sway_z], "linear_drag_coefficient": 1.2}}
    return assemble("heal", "particles_blend", roles, SCRIPT_COLOURS, emitter, motion, spin=False)


def fx_teleport():
    x = (f"variable.f = 1 - {AGE} / {LIFE};"
         f" variable.r = {R1} < 0.1 ? 0 : variable.f * (0.9 + {R4} * 0.5);"
         f" variable.a = {R2} * 360 + (1 - variable.f) * 540;"
         f" return variable.r * math.cos(variable.a);")
    y = f"{R1} < 0.1 ? 0 : ({R3} * 2 - 1) * 1.1 * variable.f"
    z = "variable.r * math.sin(variable.a)"
    roles = [
        dict(p=0.1, sprite="glow", life=0.8,
             size=f"0.15 + 0.45 * math.sin({LT} * 180)",
             col=(*col("h"), f"math.sin({LT} * 180)")),
        dict(p=0.5, sprite="smoke", life="math.random(0.55, 0.8)",
             size=f"(0.16 + {R2} * 0.08) * (1 - {LT} * 0.5)",
             col=(*scale(col("d"), 0.5), f"0.85 * {fade_out(2)}")),
        dict(p=1, sprite="pixel", life="math.random(0.5, 0.75)",
             size=f"(0.08 + {R2} * 0.04)",
             col=(*mixc("p", "h", LT), "1")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 30},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {},
    }
    motion = {"minecraft:particle_motion_parametric": {"relative_position": [x, y, z]}}
    return assemble("teleport", "particles_blend", roles, SCRIPT_COLOURS, emitter, motion)


def fx_summon():
    x = (f"variable.f = {AGE} / {LIFE};"
         f" variable.a = {R2} * 360 + variable.f * 200;"
         f" variable.rr = {R1} < 0.08 ? 0 : ({R1} < 0.45 ? 1.0 : 0.15 + {R4} * 0.3);"
         f" return variable.rr * math.cos(variable.a);")
    y = f"{R1} < 0.08 ? 0 : ({R1} < 0.45 ? -0.6 + variable.f * 0.2 : -0.8 + variable.f * (1.6 + {R3} * 0.8))"
    z = "variable.rr * math.sin(variable.a)"
    roles = [
        dict(p=0.08, sprite="rune", life=1.4, rot=0, spin=90,
             size=f"0.85 * math.min(1, {LT} * 4)",
             col=(*mixc("p", "h", "0.2"), f"0.4 * math.min(1, (1 - {LT}) * 3)")),
        dict(p=0.45, sprite="glow", life=1.2, spin=0,
             size=f"(0.08 + {R3} * 0.04)",
             col=(*mixc("h", "p", LT), f"math.min(1, (1 - {LT}) * 3)")),
        dict(p=1, sprite="spark", life="math.random(0.7, 1.2)", spin="math.random(-180, 180)",
             size=f"(0.06 + {R2} * 0.04) * (1 - {LT} * 0.5)",
             col=(*mixc("h", "p", LT), f"1 - {LT}")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 36},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_point": {},
    }
    motion = {"minecraft:particle_motion_parametric": {"relative_position": [x, y, z]}}
    return assemble("summon", "particles_add", roles, SCRIPT_COLOURS, emitter, motion)


def fx_block_break():
    roles = [
        dict(p=0.25, sprite="smoke", life="math.random(0.7, 1.1)", speed="math.random(0.4, 1.0)", ay=0.8,
             size=f"(0.18 + {R2} * 0.1) * (0.7 + {LT} * 0.6)",
             col=(*scale(col("d"), 0.6), f"0.65 * (1 - {LT})")),
        dict(p=1, sprite="cube", life="math.random(0.6, 1.0)", speed="math.random(1.5, 4)", ay=-15,
             size=f"(0.07 + {R2} * 0.06)",
             col=(*mixc("p", "d", f"{R3} * 0.7"), f"{LT} < 0.75 ? 1 : (1 - {LT}) / 0.25")),
    ]
    emitter = {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {},
        "minecraft:emitter_shape_box": {
            "half_dimensions": [0.35, 0.35, 0.35],
            "direction": "outwards",
        },
    }
    return assemble("block_break", "particles_blend", roles, SCRIPT_COLOURS, emitter, dynamic(roles, 1.5))


def fx_level_up():
    x = (f"variable.f = {AGE} / {LIFE};"
         f" variable.a = ({R1} < 0.5 ? 0 : 180) + variable.f * 540;"
         f" variable.rr = 0.75 - variable.f * 0.45 + ({R3} - 0.5) * 0.12;"
         f" return variable.rr * math.cos(variable.a);")
    y = f"-0.6 + variable.f * 2.2 + ({R4} - 0.5) * 0.1"
    z = "variable.rr * math.sin(variable.a)"
    roles = [
        dict(p=0.3, sprite="spark", life=1.0, spin="math.random(-180, 180)",
             size=f"(0.08 + {R2} * 0.04) * (1 - {LT} * 0.5)",
             col=(*mixc("p", "h", LT), fade_out(3))),
        dict(p=1, sprite="pixel", life=1.0, spin="math.random(-90, 90)",
             size=f"(0.09 + {R2} * 0.04) * (1 - {LT} * 0.5)",
             col=(*mixc("p", "h", LT), fade_out(3))),
    ]
    emitter = {
        "minecraft:emitter_rate_steady": {"spawn_rate": 32, "max_particles": 40},
        "minecraft:emitter_lifetime_once": {"active_time": 0.9},
        "minecraft:emitter_shape_point": {},
    }
    motion = {"minecraft:particle_motion_parametric": {"relative_position": [x, y, z]}}
    return assemble("level_up", "particles_add", roles, SCRIPT_COLOURS, emitter, motion)


EFFECTS = {
    "aura": fx_aura,
    "rage_aura": fx_rage_aura,
    "laser_segment": fx_laser_segment,
    "laser_charge": fx_laser_charge,
    "impact": fx_impact,
    "rage_burst": fx_rage_burst,
    "shield_dome": fx_shield_dome,
    "shield_hit": fx_shield_hit,
    "heal": fx_heal,
    "teleport": fx_teleport,
    "summon": fx_summon,
    "block_break": fx_block_break,
    "level_up": fx_level_up,
}

# --------------------------------------------------------------------------------------
# Minimal Molang parser / evaluator (validation + preview simulation)
# --------------------------------------------------------------------------------------
TOKEN_RE = re.compile(
    r"\s*(?:(?P<num>\d+\.\d*f?|\.\d+f?|\d+f?)|(?P<id>[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)"
    r"|(?P<op>==|!=|<=|>=|&&|\|\||[-+*/()<>?:!,;=]))")

MATH_FUNCS = {
    "math.random": 2, "math.sin": 1, "math.cos": 1, "math.sqrt": 1, "math.pow": 2, "math.min": 2,
    "math.max": 2, "math.round": 1, "math.abs": 1, "math.clamp": 3, "math.mod": 2, "math.floor": 1,
    "math.ceil": 1, "math.lerp": 3, "math.exp": 1,
}
BUILTIN_VARS = {
    "variable.particle_age", "variable.particle_lifetime", "variable.emitter_age",
    "variable.emitter_lifetime",
    *(f"variable.particle_random_{i}" for i in range(1, 5)),
    *(f"variable.emitter_random_{i}" for i in range(1, 5)),
}
EXTERNAL_VARS = {"variable.color.r", "variable.color.g", "variable.color.b", "variable.skin"}


class MolangError(Exception):
    pass


def _norm_id(name):
    low = name.lower()
    for short, full in (("v.", "variable."), ("q.", "query."), ("t.", "temp.")):
        if low.startswith(short):
            low = full + low[len(short):]
    return low


def tokenize(src):
    pos, out = 0, []
    src = src.rstrip()
    while pos < len(src):
        m = TOKEN_RE.match(src, pos)
        if not m or m.end() == pos:
            raise MolangError(f"bad token at {pos}: {src[pos:pos + 12]!r}")
        pos = m.end()
        if m.group("num"):
            out.append(("num", float(m.group("num").rstrip("f"))))
        elif m.group("id"):
            ident = _norm_id(m.group("id"))
            out.append(("kw", ident) if ident == "return" else ("id", ident))
        else:
            out.append(("op", m.group("op")))
    out.append(("end", None))
    return out


class Parser:
    def __init__(self, src):
        self.toks = tokenize(src)
        self.i = 0

    def peek(self, kind=None, val=None):
        t = self.toks[self.i]
        if kind and t[0] != kind:
            return False
        if val is not None and t[1] != val:
            return False
        return t

    def take(self, kind=None, val=None):
        t = self.peek(kind, val)
        if not t:
            raise MolangError(f"expected {kind} {val!r}, got {self.toks[self.i]}")
        self.i += 1
        return t

    def program(self):
        stmts = []
        while not self.peek("end"):
            if self.peek("kw", "return"):
                self.take()
                stmts.append(("return", self.expr()))
            else:
                stmts.append(("stmt", self.expr()))
            if self.peek("op", ";"):
                self.take()
            elif not self.peek("end"):
                raise MolangError(f"expected ';' got {self.toks[self.i]}")
        return stmts

    def expr(self):
        left = self.ternary()
        if self.peek("op", "="):
            if left[0] != "var":
                raise MolangError("assignment to non-variable")
            self.take()
            return ("assign", left[1], self.expr())
        return left

    def ternary(self):
        cond = self.binary(0)
        if self.peek("op", "?"):
            self.take()
            a = self.expr()
            self.take("op", ":")
            b = self.expr()
            return ("tern", cond, a, b)
        return cond

    LEVELS = [("||",), ("&&",), ("==", "!="), ("<", ">", "<=", ">="), ("+", "-"), ("*", "/")]

    def binary(self, lvl):
        if lvl == len(self.LEVELS):
            return self.unary()
        left = self.binary(lvl + 1)
        while self.peek("op") and self.toks[self.i][1] in self.LEVELS[lvl]:
            op = self.take()[1]
            left = ("bin", op, left, self.binary(lvl + 1))
        return left

    def unary(self):
        if self.peek("op", "-"):
            self.take()
            return ("neg", self.unary())
        if self.peek("op", "!"):
            self.take()
            return ("not", self.unary())
        return self.primary()

    def primary(self):
        if self.peek("num"):
            return ("num", self.take()[1])
        if self.peek("op", "("):
            self.take()
            e = self.expr()
            self.take("op", ")")
            return e
        if self.peek("id"):
            name = self.take()[1]
            if self.peek("op", "("):
                self.take()
                args = []
                if not self.peek("op", ")"):
                    args.append(self.expr())
                    while self.peek("op", ","):
                        self.take()
                        args.append(self.expr())
                self.take("op", ")")
                if name not in MATH_FUNCS:
                    raise MolangError(f"unknown function {name}")
                if MATH_FUNCS[name] != len(args):
                    raise MolangError(f"{name} expects {MATH_FUNCS[name]} args, got {len(args)}")
                return ("call", name, args)
            if not name.startswith(("variable.", "query.", "temp.")):
                raise MolangError(f"unknown identifier {name}")
            return ("var", name)
        raise MolangError(f"unexpected token {self.toks[self.i]}")


_PARSE_CACHE = {}


def parse(src):
    src = str(src)
    if src not in _PARSE_CACHE:
        _PARSE_CACHE[src] = Parser(src).program()
    return _PARSE_CACHE[src]


def _walk(node, reads, writes):
    kind = node[0]
    if kind == "var":
        reads.add(node[1])
    elif kind == "assign":
        writes.add(node[1])
        _walk(node[2], reads, writes)
    elif kind in ("neg", "not"):
        _walk(node[1], reads, writes)
    elif kind == "bin":
        _walk(node[2], reads, writes)
        _walk(node[3], reads, writes)
    elif kind == "tern":
        for n in node[1:]:
            _walk(n, reads, writes)
    elif kind == "call":
        for a in node[2]:
            _walk(a, reads, writes)


class Ctx:
    def __init__(self, vars_, rng):
        self.vars = vars_
        self.rng = rng


def _ev(node, ctx):
    k = node[0]
    if k == "num":
        return node[1]
    if k == "var":
        return float(ctx.vars.get(node[1], 0.0))
    if k == "assign":
        val = _ev(node[2], ctx)
        ctx.vars[node[1]] = val
        return val
    if k == "neg":
        return -_ev(node[1], ctx)
    if k == "not":
        return 0.0 if _ev(node[1], ctx) else 1.0
    if k == "tern":
        return _ev(node[2], ctx) if _ev(node[1], ctx) else _ev(node[3], ctx)
    if k == "bin":
        op = node[1]
        if op == "&&":
            return 1.0 if (_ev(node[2], ctx) and _ev(node[3], ctx)) else 0.0
        if op == "||":
            return 1.0 if (_ev(node[2], ctx) or _ev(node[3], ctx)) else 0.0
        a, b = _ev(node[2], ctx), _ev(node[3], ctx)
        if op == "+": return a + b
        if op == "-": return a - b
        if op == "*": return a * b
        if op == "/": return a / b if b else 0.0
        if op == "<": return float(a < b)
        if op == ">": return float(a > b)
        if op == "<=": return float(a <= b)
        if op == ">=": return float(a >= b)
        if op == "==": return float(a == b)
        if op == "!=": return float(a != b)
    if k == "call":
        name, args = node[1], [_ev(a, ctx) for a in node[2]]
        if name == "math.random":
            return ctx.rng.uniform(args[0], args[1])
        if name == "math.sin": return math.sin(math.radians(args[0]))
        if name == "math.cos": return math.cos(math.radians(args[0]))
        if name == "math.sqrt": return math.sqrt(max(args[0], 0.0))
        if name == "math.pow": return math.pow(args[0], args[1]) if args[0] >= 0 or float(args[1]).is_integer() else 0.0
        if name == "math.min": return min(args)
        if name == "math.max": return max(args)
        if name == "math.round": return float(math.floor(args[0] + 0.5))
        if name == "math.abs": return abs(args[0])
        if name == "math.clamp": return min(max(args[0], args[1]), args[2])
        if name == "math.mod": return math.fmod(args[0], args[1]) if args[1] else 0.0
        if name == "math.floor": return float(math.floor(args[0]))
        if name == "math.ceil": return float(math.ceil(args[0]))
        if name == "math.lerp": return args[0] + (args[1] - args[0]) * args[2]
        if name == "math.exp": return math.exp(args[0])
    raise MolangError(f"cannot evaluate {node}")


def run(src, ctx):
    """Evaluate a Molang value: numbers pass through; complex expressions need `return`."""
    if isinstance(src, (int, float)) and not isinstance(src, bool):
        return float(src)
    stmts = parse(src)
    if len(stmts) == 1 and stmts[0][0] == "stmt" and ";" not in str(src):
        return _ev(stmts[0][1], ctx)
    for kind, node in stmts:
        val = _ev(node, ctx)
        if kind == "return":
            return val
    return 0.0


# Where each Molang-bearing field lives in a component, and whether it must return a value.
def molang_fields(comps):
    """Yield (path, value, kind) for every Molang string/number in the effect.
    kind: 'value' (single expression or complex with return) or 'script' (statements)."""
    def walk(obj, path):
        if isinstance(obj, dict):
            for k, v in obj.items():
                yield from walk(v, path + [k])
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                yield from walk(v, path + [str(i)])
        else:
            yield path, obj

    for path, val in walk(comps, []):
        key = path[-1] if not path[-1].isdigit() else path[-2]
        if key in ("facing_camera_mode", "texture_width", "texture_height") or isinstance(val, bool):
            continue
        if key == "direction" and isinstance(val, str) and val in ("outwards", "inwards"):
            continue
        kind = "script" if key in ("per_render_expression", "per_update_expression", "creation_expression") else "value"
        yield "/".join(path), val, kind


def validate(name, data):
    errors = []
    pe = data["particle_effect"]
    comps = pe["components"]
    assigned = set()
    reads_all = set()
    for path, val, kind in molang_fields(comps):
        if isinstance(val, (int, float)):
            continue
        try:
            stmts = parse(val)
        except MolangError as e:
            errors.append(f"{name}:{path}: {e}")
            continue
        has_semicolon = ";" in val
        if kind == "value" and has_semicolon and not any(s[0] == "return" for s in stmts):
            errors.append(f"{name}:{path}: complex expression without return")
        if kind == "script" and not val.rstrip().endswith(";"):
            errors.append(f"{name}:{path}: statement list should end with ';'")
        r, w = set(), set()
        for _, node in stmts:
            _walk(node, r, w)
        assigned |= w
        reads_all |= r
    unknown = reads_all - assigned - BUILTIN_VARS - EXTERNAL_VARS
    if unknown:
        errors.append(f"{name}: reads undefined variables {sorted(unknown)}")
    shadow = assigned & (BUILTIN_VARS | EXTERNAL_VARS | {"variable.color"})
    if shadow:
        errors.append(f"{name}: overwrites engine/script variables {sorted(shadow)}")
    # budget checks (SPEC section 8)
    inst = comps.get("minecraft:emitter_rate_instant")
    if inst and isinstance(inst["num_particles"], (int, float)) and inst["num_particles"] > 40:
        errors.append(f"{name}: emitter_rate_instant > 40")
    steady = comps.get("minecraft:emitter_rate_steady")
    if steady and steady["max_particles"] > 40:
        errors.append(f"{name}: steady max_particles > 40")
    if pe["description"]["identifier"] != f"ceg:{name}":
        errors.append(f"{name}: identifier mismatch")
    return errors


def max_lifetime_bound(data, samples=400):
    """Monte-Carlo upper bound of the particle lifetime expression."""
    comps = data["particle_effect"]["components"]
    expr = comps["minecraft:particle_lifetime_expression"]["max_lifetime"]
    rng = random.Random(7)
    hi = 0.0
    for _ in range(samples):
        v = {f"variable.particle_random_{i}": rng.random() for i in range(1, 5)}
        hi = max(hi, run(expr, Ctx(v, rng)))
    return hi


# --------------------------------------------------------------------------------------
# Preview simulator (approximate, orthographic front view) - verification only
# --------------------------------------------------------------------------------------
def simulate(name, data, atlas, colour=(1.0, 0.08, 0.08), skin=0, times=(0.05, 0.15, 0.3, 0.5, 0.8, 1.2),
             px_per_block=72, size=300, seed=3, bg=(14, 12, 22), emitters=((0.0, 0.0, 0.0),)):
    comps = data["particle_effect"]["components"]
    material = data["particle_effect"]["description"]["basic_render_parameters"]["material"]
    rng = random.Random(seed)
    evars = {
        "variable.color.r": colour[0], "variable.color.g": colour[1], "variable.color.b": colour[2],
        "variable.skin": skin, "variable.emitter_age": 0.0,
        **{f"variable.emitter_random_{i}": rng.random() for i in range(1, 5)},
    }
    dt = 1 / 30
    parts = []
    inst = comps.get("minecraft:emitter_rate_instant")
    steady = comps.get("minecraft:emitter_rate_steady")
    once = comps.get("minecraft:emitter_lifetime_once")
    active = 99.0
    if once is not None:
        active = float(once.get("active_time", 0.0) or 0.0)
    frames = {}
    t = 0.0
    spawn_acc = 0.0
    atlas_np = np.asarray(atlas).astype(np.float64) / 255.0

    def spawn(origin=(0.0, 0.0, 0.0)):
        pv = dict(evars)
        for i in range(1, 5):
            pv[f"variable.particle_random_{i}"] = rng.random()
        ctx = Ctx(pv, rng)
        off = np.zeros(3)
        direction = np.array([0.0, 1.0, 0.0])
        if "minecraft:emitter_shape_point" in comps:
            sh = comps["minecraft:emitter_shape_point"]
            if "offset" in sh:
                off = np.array([run(e, ctx) for e in sh["offset"]])
            if "direction" in sh:
                direction = np.array([run(e, ctx) for e in sh["direction"]])
        elif "minecraft:emitter_shape_sphere" in comps:
            sh = comps["minecraft:emitter_shape_sphere"]
            rad = run(sh["radius"], ctx)
            v = np.array([rng.gauss(0, 1) for _ in range(3)])
            v /= np.linalg.norm(v) or 1
            off = v * (rad if sh.get("surface_only") else rad * rng.random() ** (1 / 3))
            d = sh.get("direction", "outwards")
            direction = v if d == "outwards" else (-v if d == "inwards" else np.array([run(e, ctx) for e in d]))
        elif "minecraft:emitter_shape_box" in comps:
            sh = comps["minecraft:emitter_shape_box"]
            hd = np.array([run(e, ctx) for e in sh["half_dimensions"]])
            o = np.array([run(e, ctx) for e in sh.get("offset", [0, 0, 0])])
            rel = np.array([rng.uniform(-1, 1) for _ in range(3)]) * hd
            off = o + rel
            d = sh.get("direction", "outwards")
            direction = rel if d == "outwards" else (-rel if d == "inwards" else np.array([run(e, ctx) for e in d]))
        n = np.linalg.norm(direction)
        direction = direction / n if n > 1e-9 else direction
        speed = run(comps.get("minecraft:particle_initial_speed", 0), ctx)
        life = run(comps["minecraft:particle_lifetime_expression"]["max_lifetime"], ctx)
        pv["variable.particle_lifetime"] = life
        pv["variable.particle_age"] = 0.0
        spin = comps.get("minecraft:particle_initial_spin")
        rot = run(spin["rotation"], ctx) if spin else 0.0
        rrate = run(spin["rotation_rate"], ctx) if spin else 0.0
        base = off.astype(float) + np.array(origin)
        parts.append(dict(v=pv, pos=base.copy(), vel=direction * speed, rot=rot, rrate=rrate, base=base))

    def step():
        for p in parts:
            ctx = Ctx(p["v"], rng)
            p["v"]["variable.emitter_age"] = t
            if "minecraft:particle_motion_parametric" in comps:
                rp = comps["minecraft:particle_motion_parametric"]["relative_position"]
                p["pos"] = np.array([run(e, ctx) for e in rp]) + p["base"]
            elif "minecraft:particle_motion_dynamic" in comps:
                md = comps["minecraft:particle_motion_dynamic"]
                acc = np.array([run(e, ctx) for e in md.get("linear_acceleration", [0, 0, 0])])
                drag = run(md.get("linear_drag_coefficient", 0), ctx)
                p["vel"] = p["vel"] + (acc - drag * p["vel"]) * dt
                p["pos"] = p["pos"] + p["vel"] * dt
            p["rot"] += p["rrate"] * dt
            p["v"]["variable.particle_age"] += dt

    def render():
        canvas = np.zeros((size, size, 3)) + np.array(bg) / 255.0
        # reference: faint 1-block grid and the eyeball body (r = 0.45 blocks) at the origin
        yy, xx = np.mgrid[0:size, 0:size]
        wx, wy = (xx - size / 2) / px_per_block, (size / 2 - yy) / px_per_block
        canvas[(np.abs(wx - np.round(wx)) < 0.5 / px_per_block) | (np.abs(wy - np.round(wy)) < 0.5 / px_per_block)] += 0.06
        canvas[np.abs(np.hypot(wx, wy) - 0.45) < 0.7 / px_per_block] += 0.18
        order = sorted(parts, key=lambda p: p["pos"][2], reverse=True)
        for p in order:
            ctx = Ctx(p["v"], rng)
            pi = comps.get("minecraft:particle_initialization", {})
            if "per_render_expression" in pi:
                run(pi["per_render_expression"], ctx)
            bb = comps["minecraft:particle_appearance_billboard"]
            sx = run(bb["size"][0], ctx)
            u = int(round(run(bb["uv"]["uv"][0], ctx)))
            v = int(round(run(bb["uv"]["uv"][1], ctx)))
            tint = [run(e, ctx) for e in comps["minecraft:particle_appearance_tinting"]["color"]]
            w = max(1, int(round(2 * sx * px_per_block)))
            spr = atlas.crop((u, v, u + CELL, v + CELL)).resize((w, w), Image.NEAREST)
            if p["rot"]:
                spr = spr.rotate(p["rot"], resample=Image.NEAREST, expand=True)
            s = np.asarray(spr).astype(np.float64) / 255.0
            rgb = s[..., :3] * np.clip(tint[:3], 0, 1)
            a = s[..., 3] * np.clip(tint[3], 0, 1)
            cx = size / 2 + p["pos"][0] * px_per_block - s.shape[1] / 2
            cy = size / 2 - p["pos"][1] * px_per_block - s.shape[0] / 2
            x0, y0 = int(round(cx)), int(round(cy))
            x1, y1 = x0 + s.shape[1], y0 + s.shape[0]
            cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x1, size), min(y1, size)
            if cx0 >= cx1 or cy0 >= cy1:
                continue
            sub_rgb = rgb[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
            sub_a = a[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0][..., None]
            dst = canvas[cy0:cy1, cx0:cx1]
            if material == "particles_add":
                dst += sub_rgb * sub_a
            elif material == "particles_alpha":
                m = sub_a >= 0.5
                dst[:] = np.where(m, sub_rgb, dst)
            else:
                dst[:] = dst * (1 - sub_a) + sub_rgb * sub_a
        return Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), "RGB")

    end = max(times) + 1e-6
    if inst:
        n = int(run(inst["num_particles"], Ctx(dict(evars), rng)))
        for o in emitters:
            for _ in range(n):
                spawn(o)
    while t < end:
        if steady and t < active:
            spawn_acc += run(steady["spawn_rate"], Ctx(dict(evars), rng)) * dt
            while spawn_acc >= 1 and len(parts) < steady["max_particles"] * len(emitters):
                spawn_acc -= 1
                for o in emitters:
                    spawn(o)
            spawn_acc = min(spawn_acc, 1.0)
        step()
        parts[:] = [p for p in parts if p["v"]["variable.particle_age"] < p["v"]["variable.particle_lifetime"]]
        t += dt
        for tt in times:
            if tt not in frames and t >= tt:
                frames[tt] = render()
    return [frames[tt] for tt in times]


def sim_sheet(out_dir, effects, atlas):
    """One PNG per effect: crimson on a night sky (top row), void on a day sky (bottom row)."""
    from PIL import ImageFont
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    times = (0.05, 0.15, 0.3, 0.6, 1.0)
    variants = [("crimson / night", (1.0, 0.08, 0.08), 0, (14, 12, 22)),
                ("void / day", (0.72, 0.2, 1.0), 1, (120, 150, 185))]
    paths = []
    fw = 300
    for name, data in effects.items():
        emitters = ((0.0, 0.0, 0.0),)
        if name == "laser_segment":  # the script spawns many along the beam
            emitters = tuple((x * 0.3 - 1.8, x * 0.05, 0.0) for x in range(13))
        sheet = Image.new("RGB", (fw * len(times), 2 * (fw + 22)), (30, 30, 30))
        d = ImageDraw.Draw(sheet)
        for r, (vname, colour, skin, bg) in enumerate(variants):
            frames = simulate(name, data, atlas, colour=colour, skin=skin, times=times, bg=bg, emitters=emitters)
            y = r * (fw + 22)
            d.text((4, y + 3), f"ceg:{name} [{vname}]  t = " + ", ".join(f"{t:g}s" for t in times),
                   fill=(235, 235, 235), font=font)
            for c, fr in enumerate(frames):
                sheet.paste(fr, (c * fw, y + 22))
        p = out_dir / f"sim_{name}.png"
        sheet.save(p)
        paths.append(p)
    return paths


# --------------------------------------------------------------------------------------
def build_effects():
    return {name: fn() for name, fn in EFFECTS.items()}


def main(argv):
    check_only = "--check" in argv
    sim_dir = None
    if "--sim" in argv:
        sim_dir = argv[argv.index("--sim") + 1]
    atlas = build_atlas()
    effects = build_effects()
    errors = []
    for name, data in effects.items():
        errors += validate(name, data)
        hi = max_lifetime_bound(data)
        if hi > 1.5 + 1e-9:
            errors.append(f"{name}: particle lifetime up to {hi:.2f}s > 1.5s")
    if errors:
        print("\n".join(errors))
        return 1
    if not check_only:
        ATLAS_PATH.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(ATLAS_PATH, optimize=True)
        PARTICLE_DIR.mkdir(parents=True, exist_ok=True)
        for name, data in effects.items():
            (PARTICLE_DIR / f"{name}.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {ATLAS_PATH.relative_to(ROOT)} and {len(effects)} particle files in {PARTICLE_DIR.relative_to(ROOT)}")
    else:
        print(f"ok: {len(effects)} effects validated")
    if sim_dir:
        for p in sim_sheet(sim_dir, effects, atlas):
            print("preview", p)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

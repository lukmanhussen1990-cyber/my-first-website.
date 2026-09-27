#!/usr/bin/env python3
"""Build script for the Lumina Graphics add-on (Minecraft Bedrock 1.21+).

Generates every texture, fog, particle and manifest file into packs/, then zips
both packs into dist/Lumina_Graphics_v<version>.mcaddon.

The only hand-written file inside the packs is
packs/Lumina_Graphics_BP/scripts/main.js; everything else is produced here, so
edit this file (not the generated JSON/PNG) and re-run:

    pip install pillow numpy
    python3 build.py
"""

import json
import math
import shutil
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

VERSION = [1, 0, 0]
VERSION_STR = ".".join(map(str, VERSION))
MIN_ENGINE = [1, 21, 0]
SCRIPT_API = "1.11.0"  # ships with 1.21.0 (incl. preview 1.21.0.26); no experiments needed

RP_UUID = "d4151798-2725-4028-b368-04a99c84f6be"
RP_MODULE_UUID = "172910e4-8498-45fc-a728-1dd1082d8d78"
BP_UUID = "203a492d-6545-4a12-ae9c-831c765028be"
BP_DATA_UUID = "09065080-bf11-400b-bfe0-cef892483e75"
BP_SCRIPT_UUID = "b2dbc0d4-33a9-4c41-8bb0-c35dc91b7da8"

ROOT = Path(__file__).resolve().parent
PACKS = ROOT / "packs"
RP = PACKS / "Lumina_Graphics_RP"
BP = PACKS / "Lumina_Graphics_BP"
DIST = ROOT / "dist"

rng = np.random.default_rng(1337)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_png(path, arr, mode):
    path.parent.mkdir(parents=True, exist_ok=True)
    arr = np.clip(np.rint(arr), 0, 255).astype(np.uint8)
    Image.fromarray(arr, mode).save(path, optimize=True)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def value_noise(size, cells):
    """Tileable value noise on a size x size grid with `cells` lattice cells."""
    lat = rng.random((cells, cells))
    c = np.arange(size) * cells / size
    i0 = np.floor(c).astype(int)
    f = c - i0
    i1 = (i0 + 1) % cells
    s = f * f * (3 - 2 * f)
    sx, sy = s[None, :], s[:, None]
    a = lat[np.ix_(i0, i0)]
    b = lat[np.ix_(i0, i1)]
    cc = lat[np.ix_(i1, i0)]
    d = lat[np.ix_(i1, i1)]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (cc * (1 - sx) + d * sx) * sy


def fbm(size, cells, octaves, persistence=0.5):
    total, amp, norm = 0.0, 1.0, 0.0
    for _ in range(octaves):
        total = total + amp * value_noise(size, cells)
        norm += amp
        amp *= persistence
        cells *= 2
    return total / norm


def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(float)
    return x + 0.5, y + 0.5


def premult(intensity, color=(1.0, 1.0, 1.0)):
    """RGBA where RGB is already multiplied by intensity (safe for additive)."""
    i = np.clip(intensity, 0, 1)
    rgb = np.stack([i * c for c in color], axis=-1)
    return np.concatenate([rgb, i[..., None]], axis=-1) * 255


# --------------------------------------------------------------------------
# sky textures
# --------------------------------------------------------------------------

def make_sun():
    """Round sun with a hot core and a two-layer bloom halo (additive blend)."""
    s = 128
    x, y = grid(s, s)
    cx, cy = s * 0.5, s * 0.375  # vanilla places the sun slightly above centre
    r = np.hypot(x - cx, y - cy) / s
    disc_r = 0.105
    disc = smoothstep(disc_r + 0.01, disc_r - 0.01, r)
    limb = 1.0 - 0.18 * np.clip(r / disc_r, 0, 1) ** 2
    outside = np.clip(r - disc_r, 0, None)
    halo = 0.62 * np.exp(-outside / 0.028) + 0.30 * np.exp(-outside / 0.09)
    halo *= smoothstep(0.37, 0.22, r)  # must reach black before the quad edge
    disc_col = np.array([1.0, 0.98, 0.9])
    halo_col = np.array([1.0, 0.8, 0.5])
    rgb = disc[..., None] * limb[..., None] * disc_col + (1 - disc[..., None]) * halo[..., None] * halo_col
    rgba = np.concatenate([np.clip(rgb, 0, 1) * 255, np.full((s, s, 1), 255.0)], axis=-1)
    save_png(RP / "textures/environment/sun.png", rgba, "RGBA")


def make_moon():
    """8 moon phases (4x2 grid) with maria, craters, soft terminator and glow."""
    cell = 64
    w, h = cell * 4, cell * 2
    out = np.zeros((h, w, 3))
    x, y = grid(cell, cell)
    radius = 0.135 * cell
    u = (x - cell / 2) / radius
    v = (y - cell / 2) / radius
    rr = np.hypot(u, v)
    inside = rr < 1
    z = np.sqrt(np.clip(1 - u * u - v * v, 0, 1))
    edge = smoothstep(1.06, 0.94, rr)
    # surface albedo: dark maria + a few craters
    maria = fbm(cell, 4, 4)
    albedo = 0.9 - 0.32 * smoothstep(0.45, 0.7, maria)
    for _ in range(6):
        ccx, ccy = rng.uniform(-0.6, 0.6, 2)
        d = np.hypot(u - ccx, v - ccy) / rng.uniform(0.1, 0.18)
        albedo -= 0.07 * np.exp(-d * d)
    albedo = np.clip(albedo, 0.45, 1)
    moon_col = np.array([0.88, 0.92, 1.0])
    glow_col = np.array([0.55, 0.65, 0.95])
    dist = np.hypot(x - cell / 2, y - cell / 2) / cell
    outside = np.clip(dist - 0.135, 0, None)
    for phase in range(8):
        a = math.radians(phase * 45)
        lx, lz = -math.sin(a), math.cos(a)
        ndl = u * lx + z * lz
        lit = np.clip(ndl * 3.0 + 0.1, 0, 1) ** 0.9
        light = (0.03 + 0.97 * lit) * albedo * edge * inside
        frac = (1 + math.cos(a)) / 2
        halo = frac * (0.28 * np.exp(-outside / 0.03) + 0.12 * np.exp(-outside / 0.1))
        halo *= smoothstep(0.48, 0.3, dist) * (1 - edge)
        img = light[..., None] * moon_col + halo[..., None] * glow_col
        cx0, cy0 = (phase % 4) * cell, (phase // 4) * cell
        out[cy0:cy0 + cell, cx0:cx0 + cell] = img
    save_png(RP / "textures/environment/moon_phases.png", np.clip(out, 0, 1) * 255, "RGB")


def make_clouds():
    """Puffier, more natural cloud map (tileable, same format as vanilla)."""
    s = 256
    large = fbm(s, 5, 2)
    detail = fbm(s, 12, 2, 0.45)
    field = 0.6 * large + 0.4 * detail
    mask = field > np.quantile(field, 0.78)

    def neighbours(m):
        return sum(np.roll(np.roll(m, dy, 0), dx, 1)
                   for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)

    # smooth the outline: fill small gaps, then drop specks
    for _ in range(2):
        mask = mask | (neighbours(mask) >= 5)
        mask = mask & (neighbours(mask) >= 4)
    rgba = np.full((s, s, 4), 255.0)
    rgba[..., 3] = np.where(mask, 255, 1)
    save_png(RP / "textures/environment/clouds.png", rgba, "RGBA")


def make_end_sky():
    """Tileable purple nebula with stars for the End."""
    s = 128
    n1 = fbm(s, 4, 5)
    n2 = fbm(s, 8, 4)
    deep = np.array([42, 26, 70])
    magenta = np.array([128, 62, 150])
    teal = np.array([48, 104, 132])
    t1 = smoothstep(0.35, 0.75, n1)[..., None]
    t2 = smoothstep(0.45, 0.8, n2)[..., None]
    rgb = deep * (1 - t1) + magenta * t1
    rgb = rgb * (1 - t2 * 0.6) + teal * t2 * 0.6
    stars = rng.random((s, s))
    rgb[stars > 0.994] = [235, 230, 255]
    rgb[(stars > 0.985) & (stars <= 0.994)] += 45
    save_png(RP / "textures/environment/end_sky.png", np.clip(rgb, 0, 255), "RGB")


# --------------------------------------------------------------------------
# water (greyscale, tinted by the biome water colour)
# --------------------------------------------------------------------------

def make_water():
    frames = 32
    # still water: 16x16 frames, calm interference ripples with soft highlights
    s = 16
    x, y = grid(s, s)
    waves = [(1, 0, 1, 0.9), (0, 1, 1, 0.8), (1, 1, 2, 0.6), (2, -1, 1, 0.5),
             (-1, 2, 2, 0.45), (2, 1, 3, 0.3), (3, -2, 2, 0.2)]
    phases = rng.uniform(0, 2 * math.pi, len(waves))
    n1, n2 = value_noise(s, 4) - 0.5, value_noise(s, 4) - 0.5
    still = []
    for f in range(frames):
        t = f / frames
        hgt = sum(a * np.sin(2 * math.pi * (kx * x / s + ky * y / s - w * t) + p)
                  for (kx, ky, w, a), p in zip(waves, phases))
        # looping noise layer breaks up the regular wave pattern
        hgt = hgt / np.abs(hgt).max() + 1.2 * (n1 * math.cos(2 * math.pi * t) + n2 * math.sin(2 * math.pi * t))
        hgt /= np.abs(hgt).max()
        v = 0.75 + 0.07 * hgt + 0.3 * np.clip(hgt - 0.45, 0, None) ** 2
        still.append(v)
    still = np.clip(np.concatenate(still, axis=0), 0, 1) * 255
    rgba = np.stack([still] * 3 + [np.full_like(still, 240)], axis=-1)
    save_png(RP / "textures/blocks/water_still_grey.png", rgba, "RGBA")

    # flowing water: 32x32 frames spanning 2x2 blocks, scrolls 1px/frame down
    s = 32
    x, y = grid(s, s)
    streaks = [(3, 1, 1, 0.8), (5, 2, 1, 0.5), (2, 3, 2, 0.6), (7, 1, 1, 0.3),
               (1, 2, 1, 0.5), (4, 4, 2, 0.25)]
    phases = rng.uniform(0, 2 * math.pi, len(streaks))
    flow = []
    for f in range(frames):
        hgt = sum(a * np.sin(2 * math.pi * (kx * x / s + ky * (y - f * sp) / s) + p)
                  for (kx, ky, sp, a), p in zip(streaks, phases))
        hgt /= np.abs(hgt).max()
        v = 0.72 + 0.09 * hgt + 0.5 * np.clip(hgt - 0.4, 0, None) ** 2
        flow.append(v)
    flow = np.clip(np.concatenate(flow, axis=0), 0, 1) * 255
    rgba = np.stack([flow] * 3 + [np.full_like(flow, 255)], axis=-1)
    save_png(RP / "textures/blocks/water_flow_grey.png", rgba, "RGBA")


# --------------------------------------------------------------------------
# particle textures (white, tinted per particle)
# --------------------------------------------------------------------------

def make_particle_textures():
    base = RP / "textures/particle/lumina"
    # soft bloom glow
    s = 32
    x, y = grid(s, s)
    r = np.hypot(x - s / 2, y - s / 2) / (s / 2)
    glow = (0.75 * np.exp(-r * r * 5.0) + 0.25 * np.exp(-r * r * 22.0)) * smoothstep(1.0, 0.8, r)
    save_png(base / "glow.png", premult(glow / glow.max()), "RGBA")
    # four-point sparkle for water glints
    u = (x - s / 2) / (s / 2)
    v = (y - s / 2) / (s / 2)
    core = np.exp(-(u * u + v * v) / 0.03)
    rays = (np.exp(-v * v / 0.004) * np.clip(1 - np.abs(u), 0, 1) ** 2.2
            + np.exp(-u * u / 0.004) * np.clip(1 - np.abs(v), 0, 1) ** 2.2)
    du, dv = (u + v) / math.sqrt(2), (u - v) / math.sqrt(2)
    diag = (np.exp(-dv * dv / 0.003) * np.clip(1 - np.abs(du) * 1.8, 0, 1) ** 2
            + np.exp(-du * du / 0.003) * np.clip(1 - np.abs(dv) * 1.8, 0, 1) ** 2)
    spark = np.clip(core + 0.85 * rays + 0.3 * diag, 0, 1) * smoothstep(1.0, 0.9, np.hypot(u, v))
    save_png(base / "spark.png", premult(spark), "RGBA")
    # tiny soft dot for dust / plankton
    s = 8
    x, y = grid(s, s)
    r = np.hypot(x - s / 2, y - s / 2) / (s / 2)
    save_png(base / "mote.png", premult(np.exp(-r * r * 3.0) * smoothstep(1.0, 0.7, r)), "RGBA")
    # two 8x8 pixel-art leaves (greyscale, tinted green in the particle)
    leaf_a = ["......##", "....####", "...####.", "..#####.",
              ".#####..", ".####...", ".##.....", "#......."]
    leaf_b = ["...##...", "..####..", ".######.", ".######.",
              ".######.", "..####..", "...##...", "....#..."]
    img = np.zeros((8, 16, 4))
    for ox, rows, rib in ((0, leaf_a, lambda cx, cy: cx + cy == 7),
                          (8, leaf_b, lambda cx, cy: cx == 3 or cx == 4 and cy >= 6)):
        for cy, row in enumerate(rows):
            for cx, ch in enumerate(row):
                if ch == "#":
                    shade = 175 if rib(cx, cy) else 235 - 12 * ((cx * 7 + cy * 3) % 3)
                    img[cy, ox + cx] = [shade, shade, shade, 255]
    save_png(base / "leaf.png", img, "RGBA")


# --------------------------------------------------------------------------
# pack icon
# --------------------------------------------------------------------------

def make_icon():
    s = 256
    x, y = grid(s, s)
    t = y / s
    top = np.array([0.10, 0.16, 0.38])
    mid = np.array([0.55, 0.42, 0.62])
    hor = np.array([1.0, 0.68, 0.38])
    k1 = smoothstep(0.0, 0.45, t)[..., None]
    k2 = smoothstep(0.35, 0.62, t)[..., None]
    img = top * (1 - k1) + mid * k1
    img = img * (1 - k2) + hor * k2
    # sun + bloom
    sx, sy = 168, 132
    r = np.hypot(x - sx, y - sy)
    img += (np.exp(-r / 14) * 0.9 + np.exp(-r / 55) * 0.35)[..., None] * np.array([1.0, 0.85, 0.55])
    img[r < 17] = [1.0, 0.97, 0.88]
    # blocky hills, far (hazy) and near (dark)
    far = np.zeros(s)
    near = np.zeros(s)
    for col in range(0, s, 16):
        far[col:col + 16] = 150 + 18 * math.sin(col * 0.035 + 1.2) + 10 * math.sin(col * 0.11)
        near[col:col + 16] = 176 + 16 * math.sin(col * 0.05 + 3.0) + 8 * math.cos(col * 0.13)
    far = (np.round(far / 8) * 8)[None, :]
    near = (np.round(near / 8) * 8)[None, :]
    img = np.where((y > far)[..., None], img * 0.35 + np.array([0.36, 0.3, 0.5]) * 0.65, img)
    img = np.where((y > near)[..., None], np.array([0.12, 0.2, 0.16]), img)
    grass = (y > near) & (y < near + 8)
    img[grass] = [0.26, 0.42, 0.22]
    # water with sun reflection and sparkles
    water = y > 212
    refl = np.exp(-np.abs(x - sx) / 18) * (0.6 + 0.4 * np.sin(y * 1.3))
    wcol = np.array([0.12, 0.3, 0.55]) + refl[..., None] * np.array([0.8, 0.55, 0.3])
    img = np.where(water[..., None], wcol, img)
    for _ in range(14):
        px, py = int(rng.normal(sx, 20)), int(rng.uniform(216, 250))
        img[py, max(px - 3, 0):px + 4] = [1, 1, 0.9]
        img[max(py - 3, 0):py + 4, px] = [1, 1, 0.9]
    # fireflies
    for _ in range(9):
        px, py = int(rng.uniform(20, 120)), int(rng.uniform(150, 200))
        d = np.hypot(x - px, y - py)
        img += (np.exp(-d / 2.5) * 0.9)[..., None] * np.array([0.8, 1.0, 0.35])
    img = np.clip(img, 0, 1) * 255
    save_png(RP / "pack_icon.png", img, "RGB")
    BP.mkdir(parents=True, exist_ok=True)
    shutil.copy(RP / "pack_icon.png", BP / "pack_icon.png")


# --------------------------------------------------------------------------
# fog + biome client (water colours)
# --------------------------------------------------------------------------

def water_fog(color, end):
    return {
        "fog_start": 0.0,
        "fog_end": float(end),
        "fog_color": color,
        "render_distance_type": "fixed",
        "transition_fog": {
            "init_fog": {"fog_start": 0.0, "fog_end": 0.01, "fog_color": color,
                         "render_distance_type": "fixed"},
            "min_percent": 0.25, "mid_seconds": 5, "mid_percent": 0.6, "max_seconds": 30,
        },
    }


def dist(start, end, color, kind="render"):
    return {"fog_start": start, "fog_end": end, "fog_color": color, "render_distance_type": kind}


# name: (air, weather, water fog colour, water fog end, surface colour, surface transparency, biomes)
FOG_GROUPS = {
    "default": (dist(0.62, 1.0, "#B4D3F5"), dist(0.2, 0.75, "#8A96A4"), "#2F8FDB", 64, "#3FA6EE", 0.55,
                ["default", "plains", "sunflower_plains", "meadow", "river", "beach", "stone_beach",
                 "extreme_hills", "extreme_hills_edge", "extreme_hills_mutated", "extreme_hills_plus_trees",
                 "extreme_hills_plus_trees_mutated", "stony_peaks"]),
    "forest": (dist(0.58, 1.0, "#AECDEA"), dist(0.18, 0.72, "#84948F"), "#2A86CF", 60, "#3A9BE0", 0.55,
               ["forest", "forest_hills", "flower_forest", "birch_forest", "birch_forest_hills",
                "birch_forest_mutated", "birch_forest_hills_mutated"]),
    "dark_forest": (dist(0.45, 1.0, "#9DB5A6"), dist(0.15, 0.65, "#76857C"), "#2B7AB8", 52, "#3B8DD0", 0.6,
                    ["roofed_forest", "roofed_forest_mutated"]),
    "cold": (dist(0.55, 1.0, "#C4D9EE"), dist(0.12, 0.6, "#C3CAD4"), "#2F6FC0", 56, "#3D7FD6", 0.6,
             ["taiga", "taiga_hills", "taiga_mutated", "mega_taiga", "mega_taiga_hills", "mega_taiga_mutated",
              "mega_spruce_taiga", "mega_spruce_taiga_mutated", "cold_taiga", "cold_taiga_hills",
              "cold_taiga_mutated", "ice_plains", "ice_plains_spikes", "ice_mountains", "cold_beach",
              "frozen_river", "grove", "snowy_slopes", "jagged_peaks", "frozen_peaks"]),
    "jungle": (dist(0.45, 1.0, "#A7C7BA"), dist(0.12, 0.6, "#7C8C86"), "#1591B5", 56, "#16A6C9", 0.55,
               ["jungle", "jungle_hills", "jungle_edge", "jungle_mutated", "jungle_edge_mutated",
                "bamboo_jungle", "bamboo_jungle_hills"]),
    "swamp": (dist(0.3, 0.95, "#96A58E"), dist(0.1, 0.55, "#6E796B"), "#3A5A45", 18, "#5A7A5A", 0.85,
              ["swampland", "swampland_mutated"]),
    "mangrove": (dist(0.3, 0.95, "#93A596"), dist(0.1, 0.55, "#6E7A70"), "#3A6E5E", 16, "#4A8070", 0.8,
                 ["mangrove_swamp"]),
    "desert": (dist(0.55, 1.0, "#E6D6B8"), dist(0.2, 0.7, "#B3A58E"), "#2E8FD0", 56, "#32A8E0", 0.55,
               ["desert", "desert_hills", "desert_mutated"]),
    "mesa": (dist(0.55, 1.0, "#E6C2A0"), dist(0.2, 0.7, "#B39680"), "#3A7FC0", 56, "#4E9AD8", 0.55,
             ["mesa", "mesa_bryce", "mesa_mutated", "mesa_plateau", "mesa_plateau_stone",
              "mesa_plateau_mutated", "mesa_plateau_stone_mutated"]),
    "savanna": (dist(0.6, 1.0, "#DCD6B6"), dist(0.2, 0.72, "#A8A48E"), "#2C8BC8", 56, "#2C9AD6", 0.55,
                ["savanna", "savanna_mutated", "savanna_plateau", "savanna_plateau_mutated"]),
    "cherry": (dist(0.55, 1.0, "#F0D2E1"), dist(0.2, 0.72, "#B3A0AC"), "#4AA3E0", 60, "#5DB7EF", 0.5,
               ["cherry_grove"]),
    "mushroom": (dist(0.5, 1.0, "#CBBCD9"), dist(0.18, 0.7, "#9A8FA6"), "#6A6FC0", 48, "#8A7FD0", 0.6,
                 ["mushroom_island", "mushroom_island_shore"]),
    "ocean": (dist(0.65, 1.0, "#A9CFF3"), dist(0.2, 0.75, "#8594A6"), "#155FB5", 80, "#1B7FD1", 0.5,
              ["ocean", "deep_ocean"]),
    "warm_ocean": (dist(0.65, 1.0, "#ABD5F3"), dist(0.2, 0.75, "#8798A6"), "#169FC8", 96, "#2BC6E0", 0.4,
                   ["warm_ocean", "deep_warm_ocean"]),
    "lukewarm_ocean": (dist(0.65, 1.0, "#AAD2F3"), dist(0.2, 0.75, "#8696A6"), "#1580C0", 84, "#1F9ED8", 0.45,
                       ["lukewarm_ocean", "deep_lukewarm_ocean"]),
    "cold_ocean": (dist(0.62, 1.0, "#B6D3EE"), dist(0.18, 0.7, "#8C98A8"), "#1F4E9E", 64, "#2D68C4", 0.55,
                   ["cold_ocean", "deep_cold_ocean"]),
    "frozen_ocean": (dist(0.58, 1.0, "#C4D9EE"), dist(0.12, 0.6, "#C3CAD4"), "#28488F", 56, "#3A5EB5", 0.6,
                     ["frozen_ocean", "deep_frozen_ocean"]),
    "lush_caves": (dist(0.35, 1.0, "#34503A"), dist(0.35, 1.0, "#34503A"), "#2D8C9A", 48, "#3AA8B8", 0.5,
                   ["lush_caves"]),
    "dripstone_caves": (dist(0.35, 1.0, "#3E352D"), dist(0.35, 1.0, "#3E352D"), "#2A6FA0", 40, "#3A82B8", 0.6,
                        ["dripstone_caves"]),
    "deep_dark": (dist(0.1, 0.7, "#0D131A"), dist(0.1, 0.7, "#0D131A"), "#0F3050", 24, "#1E4A70", 0.7,
                  ["deep_dark"]),
    "nether": (dist(4.0, 72.0, "#3F0D08", "fixed"), dist(4.0, 72.0, "#3F0D08", "fixed"), "#905957", 15,
               "#905957", 0.65, ["hell"]),
    "crimson": (dist(4.0, 64.0, "#4C0808", "fixed"), dist(4.0, 64.0, "#4C0808", "fixed"), "#905957", 15,
                "#905957", 0.65, ["crimson_forest"]),
    "warped": (dist(4.0, 64.0, "#0F3634", "fixed"), dist(4.0, 64.0, "#0F3634", "fixed"), "#905957", 15,
               "#905957", 0.65, ["warped_forest"]),
    "soulsand": (dist(4.0, 64.0, "#1C3A3D", "fixed"), dist(4.0, 64.0, "#1C3A3D", "fixed"), "#905957", 15,
                 "#905957", 0.65, ["soulsand_valley"]),
    "basalt": (dist(3.0, 56.0, "#4E4650", "fixed"), dist(3.0, 56.0, "#4E4650", "fixed"), "#905957", 15,
               "#905957", 0.65, ["basalt_deltas"]),
    "end": (dist(0.4, 1.0, "#150E1F"), dist(0.4, 1.0, "#150E1F"), "#62529E", 15, "#62529E", 0.65,
            ["the_end"]),
}

# morning-mist layers pushed by the behavior pack script (`/fog push`)
MIST_LEVELS = {1: (0.5, 1.0), 2: (0.36, 0.92), 3: (0.24, 0.82), 4: (0.14, 0.72)}


def make_fogs():
    biomes = {}
    for group, (air, weather, wfog, wend, surf, transp, names) in FOG_GROUPS.items():
        ident = f"lumina:fog_{group}"
        write_json(RP / f"fogs/lumina_{group}.json", {
            "format_version": "1.16.100",
            "minecraft:fog_settings": {
                "description": {"identifier": ident},
                "distance": {"air": air, "weather": weather, "water": water_fog(wfog, wend)},
            },
        })
        for name in names:
            biomes[name] = {
                "fog_identifier": ident,
                "fog_ids_to_merge": [ident],
                "inherit_from_prior_fog": False,
                "remove_all_prior_fog": False,
                "water_surface_color": surf,
                "water_surface_transparency": transp,
            }
    write_json(RP / "biomes_client.json", {"biomes": dict(sorted(biomes.items()))})
    for level, (start, end) in MIST_LEVELS.items():
        write_json(RP / f"fogs/lumina_mist_{level}.json", {
            "format_version": "1.16.100",
            "minecraft:fog_settings": {
                "description": {"identifier": f"lumina:mist_{level}"},
                "distance": {"air": dist(start, end, "#E2E7EC")},
            },
        })


# --------------------------------------------------------------------------
# particles
# --------------------------------------------------------------------------

def particle(ident, material, texture, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": ident,
                "basic_render_parameters": {"material": material, "texture": texture},
            },
            "components": components,
        },
    }


def fade(fade_in, fade_out):
    return (f"math.clamp(v.particle_age / {fade_in}, 0, 1)"
            f" * math.clamp((v.particle_lifetime - v.particle_age) / {fade_out}, 0, 1)")


def billboard(size, tex_w, tex_h, uv=(0, 0), uv_size=None):
    return {
        "size": [size, size],
        "facing_camera_mode": "lookat_xyz",
        "uv": {"texture_width": tex_w, "texture_height": tex_h,
               "uv": list(uv), "uv_size": list(uv_size or (tex_w, tex_h))},
    }


def count_expr(density):
    if density < 1:
        return f"math.random(0, 1) < {density} ? 1 : 0"
    return int(density)


# Bloom glow around light sources: (colour, half-size, alpha, flicker)
GLOWS = {
    "warm": ((1.0, 0.6, 0.24), 0.55, 0.42, True),
    "fire": ((1.0, 0.55, 0.2), 0.8, 0.34, True),
    "soul": ((0.35, 0.85, 1.0), 0.55, 0.4, True),
    "red": ((1.0, 0.18, 0.12), 0.32, 0.45, False),
    "candle": ((1.0, 0.66, 0.3), 0.3, 0.4, True),
    "gold": ((1.0, 0.78, 0.42), 1.05, 0.3, False),
    "cool": ((0.72, 0.92, 1.0), 1.0, 0.28, False),
    "green": ((0.62, 1.0, 0.55), 1.0, 0.28, False),
    "pink": ((1.0, 0.72, 0.92), 1.0, 0.28, False),
    "white": ((0.95, 0.92, 1.0), 0.45, 0.35, False),
    "purple": ((0.72, 0.38, 1.0), 0.8, 0.22, False),
    "portal": ((0.6, 0.25, 1.0), 0.9, 0.2, False),
    "magma": ((1.0, 0.38, 0.08), 0.95, 0.18, False),
}
GLOW_PERIOD = 1.0  # the script re-spawns every glow once per second
GLOW_FADE = 0.3    # cross-fade overlap so consecutive glows sum to a steady light


def glow_particles():
    out = {}
    life = GLOW_PERIOD + GLOW_FADE
    for kind, ((r, g, b), size, alpha, flicker) in GLOWS.items():
        a = f"{alpha} * {fade(GLOW_FADE, GLOW_FADE)}"
        if flicker:
            a += " * (0.9 + 0.1 * math.sin(v.particle_age * 900 + v.particle_random_1 * 360))"
        out[f"lumina_glow_{kind}"] = particle(
            f"lumina:glow_{kind}", "particles_add", "textures/particle/lumina/glow", {
                "minecraft:emitter_rate_instant": {"num_particles": 1},
                "minecraft:emitter_lifetime_once": {"active_time": life},
                "minecraft:emitter_shape_point": {},
                "minecraft:particle_lifetime_expression": {"max_lifetime": life},
                "minecraft:particle_initial_speed": 0,
                "minecraft:particle_appearance_billboard": billboard(
                    f"{size} * (0.97 + 0.03 * math.sin(v.particle_age * 200 + v.particle_random_2 * 360))",
                    32, 32),
                "minecraft:particle_appearance_tinting": {"color": [r, g, b, a]},
            })
    return out


def ambient_particles(density):
    n = count_expr(density)
    out = {}

    # fireflies: blinking additive dots that wander at night
    out["lumina_firefly"] = particle("lumina:firefly", "particles_add", "textures/particle/lumina/glow", {
        "minecraft:emitter_rate_instant": {"num_particles": n},
        "minecraft:emitter_lifetime_once": {"active_time": 7},
        "minecraft:emitter_shape_sphere": {"radius": 0.8, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "4 + v.particle_random_1 * 3"},
        "minecraft:particle_initial_speed": 0.08,
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [
                "math.sin(v.particle_age * 67 + v.particle_random_2 * 360) * 0.6",
                "math.sin(v.particle_age * 53 + v.particle_random_3 * 360) * 0.35",
                "math.cos(v.particle_age * 71 + v.particle_random_4 * 360) * 0.6"],
            "linear_drag_coefficient": 1.2,
        },
        "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0.4,
                                                "collision_drag": 0, "expire_on_contact": False},
        "minecraft:particle_appearance_billboard": billboard("0.07 + v.particle_random_2 * 0.02", 32, 32),
        "minecraft:particle_appearance_tinting": {"color": [
            0.78, 1.0, 0.35,
            f"{fade(0.6, 1.0)} * math.clamp(math.sin(v.particle_age * 80 + v.particle_random_1 * 360)"
            " * 1.6 - 0.1, 0.08, 1)"]},
    })

    # falling leaves (lit by world light, drift and settle on the ground)
    for name, (r, g, b) in {"leaf": (0.42, 0.6, 0.24), "leaf_pale": (0.56, 0.68, 0.32),
                            "leaf_dark": (0.28, 0.43, 0.2)}.items():
        out[f"lumina_{name}"] = particle(f"lumina:{name}", "particles_alpha", "textures/particle/lumina/leaf", {
            "minecraft:emitter_rate_instant": {"num_particles": n},
            "minecraft:emitter_lifetime_once": {"active_time": 11},
            "minecraft:emitter_shape_box": {"half_dimensions": [0.42, 0, 0.42], "direction": "outwards"},
            "minecraft:particle_lifetime_expression": {"max_lifetime": "7 + v.particle_random_1 * 3"},
            "minecraft:particle_initial_speed": 0,
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)",
                                                "rotation_rate": "math.random(-90, 90)"},
            "minecraft:particle_motion_dynamic": {
                "linear_acceleration": [
                    "math.sin(v.particle_age * 110 + v.particle_random_3 * 360) * 1.3 + 0.25",
                    -1.2,
                    "math.cos(v.particle_age * 85 + v.particle_random_4 * 360) * 1.3"],
                "linear_drag_coefficient": 1.6,
                "rotation_acceleration": "math.sin(v.particle_age * 120) * 40",
            },
            "minecraft:particle_motion_collision": {"collision_radius": 0.04, "coefficient_of_restitution": 0,
                                                    "collision_drag": 8, "expire_on_contact": False},
            "minecraft:particle_appearance_billboard": billboard(
                "0.075 * math.clamp((v.particle_lifetime - v.particle_age) / 1.0, 0, 1)", 16, 8,
                uv=("math.floor(v.particle_random_2 * 2) * 8", 0), uv_size=(8, 8)),
            "minecraft:particle_appearance_lighting": {},
            "minecraft:particle_appearance_tinting": {"color": [
                f"{r} + (v.particle_random_4 - 0.5) * 0.1", f"{g} + (v.particle_random_3 - 0.5) * 0.1", b, 1]},
        })

    # sun / moon glints on the water surface (fake specular highlights)
    for name, (r, g, b, alpha, size) in {"water_glint": (1.0, 0.98, 0.9, 0.95, 0.11),
                                         "water_glint_warm": (1.0, 0.72, 0.42, 0.95, 0.11),
                                         "water_glint_moon": (0.7, 0.82, 1.0, 0.6, 0.08)}.items():
        out[f"lumina_{name}"] = particle(f"lumina:{name}", "particles_add", "textures/particle/lumina/spark", {
            "minecraft:emitter_rate_instant": {"num_particles": n},
            "minecraft:emitter_lifetime_once": {"active_time": 1},
            "minecraft:emitter_shape_disc": {"radius": 0.5, "plane_normal": "y", "direction": "outwards"},
            "minecraft:particle_lifetime_expression": {"max_lifetime": "0.35 + v.particle_random_1 * 0.45"},
            "minecraft:particle_initial_speed": 0,
            "minecraft:particle_appearance_billboard": billboard(
                f"({size} * (0.6 + v.particle_random_2 * 0.6))"
                " * math.sin(v.particle_age / v.particle_lifetime * 180)", 32, 32),
            "minecraft:particle_appearance_tinting": {"color": [r, g, b, alpha]},
        })

    # floating dust motes in sunlight
    out["lumina_dust"] = particle("lumina:dust", "particles_add", "textures/particle/lumina/mote", {
        "minecraft:emitter_rate_instant": {"num_particles": n},
        "minecraft:emitter_lifetime_once": {"active_time": 10},
        "minecraft:emitter_shape_sphere": {"radius": 1.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "6 + v.particle_random_1 * 3"},
        "minecraft:particle_initial_speed": 0.03,
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [
                "math.sin(v.particle_age * 40 + v.particle_random_2 * 360) * 0.06",
                "0.01 + math.sin(v.particle_age * 33 + v.particle_random_3 * 360) * 0.03",
                "math.cos(v.particle_age * 45 + v.particle_random_4 * 360) * 0.06"],
            "linear_drag_coefficient": 0.8,
        },
        "minecraft:particle_appearance_billboard": billboard("0.018 + v.particle_random_2 * 0.014", 8, 8),
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.93, 0.75, f"0.4 * {fade(1.5, 1.5)}"]},
    })

    # underwater particulate (lit, so it darkens with depth)
    out["lumina_plankton"] = particle("lumina:plankton", "particles_blend", "textures/particle/lumina/mote", {
        "minecraft:emitter_rate_instant": {"num_particles": n},
        "minecraft:emitter_lifetime_once": {"active_time": 9},
        "minecraft:emitter_shape_sphere": {"radius": 1.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "5 + v.particle_random_1 * 3"},
        "minecraft:particle_initial_speed": 0.02,
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [
                "math.sin(v.particle_age * 30 + v.particle_random_2 * 360) * 0.05",
                "math.sin(v.particle_age * 25 + v.particle_random_3 * 360) * 0.03 - 0.005",
                "math.cos(v.particle_age * 35 + v.particle_random_4 * 360) * 0.05"],
            "linear_drag_coefficient": 1.0,
        },
        "minecraft:particle_appearance_billboard": billboard("0.016 + v.particle_random_2 * 0.012", 8, 8),
        "minecraft:particle_appearance_lighting": {},
        "minecraft:particle_appearance_tinting": {"color": [0.86, 0.95, 1.0, f"0.6 * {fade(1.0, 1.5)}"]},
    })
    return out


SUBPACKS = [("performance", "§aPerformance §7(fewer particles)", 0.5),
            ("balanced", "§eBalanced §7(recommended)", 1),
            ("ultra", "§dUltra §7(more particles)", 2)]


def make_particles():
    for name, data in glow_particles().items():
        write_json(RP / f"particles/{name}.json", data)
    for name, data in ambient_particles(1).items():
        write_json(RP / f"particles/{name}.json", data)
    for folder, _, density in SUBPACKS:
        for name, data in ambient_particles(density).items():
            write_json(RP / f"subpacks/{folder}/particles/{name}.json", data)


# --------------------------------------------------------------------------
# manifests + packaging
# --------------------------------------------------------------------------

def make_manifests():
    write_json(RP / "manifest.json", {
        "format_version": 2,
        "header": {
            "name": "§6Lumina Graphics §f(Visuals)",
            "description": f"PC-style visuals for mobile: cinematic fog, clear water, glowing sun & moon. §7v{VERSION_STR}",
            "uuid": RP_UUID,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": RP_MODULE_UUID, "version": VERSION}],
        "subpacks": [{"folder_name": f, "name": n, "memory_tier": 0} for f, n, _ in SUBPACKS],
    })
    write_json(BP / "manifest.json", {
        "format_version": 2,
        "header": {
            "name": "§6Lumina Graphics §f(Effects)",
            "description": f"Light bloom, fireflies, falling leaves, water glints & morning mist. §7v{VERSION_STR}",
            "uuid": BP_UUID,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": BP_DATA_UUID, "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": BP_SCRIPT_UUID,
             "entry": "scripts/main.js", "version": VERSION},
        ],
        "dependencies": [
            {"uuid": RP_UUID, "version": VERSION},
            {"module_name": "@minecraft/server", "version": SCRIPT_API},
        ],
    })


def package():
    DIST.mkdir(exist_ok=True)
    for old in DIST.glob("*.mcaddon"):
        old.unlink()
    target = DIST / f"Lumina_Graphics_v{VERSION_STR}.mcaddon"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in (RP, BP):
            for f in sorted(pack.rglob("*")):
                if f.is_file():
                    zf.write(f, f.relative_to(PACKS).as_posix())
    return target


def main():
    if RP.exists():
        shutil.rmtree(RP)  # fully generated
    for sub in ("manifest.json", "pack_icon.png"):
        (BP / sub).unlink(missing_ok=True)
    if not (BP / "scripts/main.js").exists():
        raise SystemExit("missing packs/Lumina_Graphics_BP/scripts/main.js")
    make_sun()
    make_moon()
    make_clouds()
    make_end_sky()
    make_water()
    make_particle_textures()
    make_icon()
    make_fogs()
    make_particles()
    make_manifests()
    print("built", package().relative_to(ROOT))


if __name__ == "__main__":
    main()

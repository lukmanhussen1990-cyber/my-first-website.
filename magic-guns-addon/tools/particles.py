"""
particles.py - draws the Magic Guns particle sprite sheet and writes every
particle effect JSON (format 1.10.0, same schema as the vanilla effects).

    python3 particles.py <resource_pack_dir>

Sprites are white and tinted per effect; most effects read their colour from
`variable.color` (set by the script with MolangVariableMap.setColorRGB).
No lighting component -> particles are full-bright, so magic glows at night.
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image

TEX = "textures/particle/magic_guns"
SHEET = 64
CELL = 16

# sprite name -> (u, v) top-left in the sheet
SPRITES = {
    "glow": (0, 0), "star": (16, 0), "ring": (32, 0), "snow": (48, 0),
    "spark": (0, 16), "wisp": (16, 16), "skull": (32, 16), "rune": (48, 16),
    "bolt": (0, 32), "ember": (16, 32), "shard": (32, 32), "smoke": (48, 32),
}


# ------------------------------------------------------------------ sprites

def _grid():
    y, x = np.mgrid[0:CELL, 0:CELL]
    return (x + 0.5 - CELL / 2) / (CELL / 2), (y + 0.5 - CELL / 2) / (CELL / 2)


def sprite(name):
    x, y = _grid()
    r = np.sqrt(x * x + y * y)
    a = np.zeros((CELL, CELL))
    if name == "glow":
        a = np.exp(-(r ** 2) / 0.22)
    elif name == "star":
        a = np.maximum(np.exp(-(x ** 2) / 0.006) * np.clip(1 - np.abs(y), 0, 1) ** 1.5,
                       np.exp(-(y ** 2) / 0.006) * np.clip(1 - np.abs(x), 0, 1) ** 1.5)
        a += np.exp(-(r ** 2) / 0.04)
    elif name == "ring":
        a = np.exp(-((r - 0.75) ** 2) / 0.012)
    elif name == "snow":
        a = np.exp(-(r ** 2) / 0.03)
        for k in range(6):
            th = k * math.pi / 3
            c, s_ = math.cos(th), math.sin(th)
            along = x * c + y * s_
            perp = np.abs(-x * s_ + y * c)
            arm = (perp < 0.075) & (along > 0) & (along < 0.92)
            tick = (np.abs(along - 0.6) < 0.06) & (perp < 0.2) & (along > 0)
            a = np.maximum(a, (arm | tick) * 1.0)
    elif name == "spark":
        a = np.exp(-(r ** 2) / 0.04) + 0.6 * np.exp(-(x ** 2) / 0.003 - y ** 2 / 0.4) + 0.6 * np.exp(-(y ** 2) / 0.003 - x ** 2 / 0.4)
    elif name == "wisp":
        # tear-drop flame tongue pointing up
        w = 0.55 * np.clip((y + 1) / 1.6, 0, 1) ** 0.6 * np.clip(1 - y, 0, 1) ** 0.5
        a = np.exp(-(x ** 2) / (2 * np.maximum(w, 1e-3) ** 2 * 0.25)) * (y > -0.95) * np.clip(1.4 - r, 0, 1)
    elif name == "skull":
        img = [
            "................",
            "....########....",
            "...##########...",
            "..############..",
            "..############..",
            "..##..####..##..",
            "..#....##....#..",
            "..#....##....#..",
            "..##..####..##..",
            "..######..####..",
            "...####....###..",
            "....##########..",
            "....#.#.##.#.#..",
            "....##########..",
            ".....########...",
            "................",
        ]
        a = np.array([[1.0 if c == "#" else 0.0 for c in row] for row in img])
    elif name == "rune":
        img = [
            "................",
            "...##########...",
            "...#........#...",
            "...#..####..#...",
            "......#..#......",
            "......#..#......",
            "...####..####...",
            "......#..#......",
            "......#..#......",
            "...#..####..#...",
            "...#........#...",
            "...##########...",
            "................",
            "................",
            "................",
            "................",
        ]
        a = np.array([[1.0 if c == "#" else 0.0 for c in row] for row in img])
        a = np.roll(a, 2, axis=0)
    elif name == "bolt":
        pts = [(0.1, -1), (-0.35, -0.2), (0.15, -0.1), (-0.25, 1)]
        a = np.zeros((CELL, CELL))
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for t in np.linspace(0, 1, 60):
                px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                a = np.maximum(a, np.exp(-((x - px) ** 2 + (y - py) ** 2) / 0.012))
    elif name == "ember":
        a = np.exp(-(r ** 2) / 0.08) ** 0.6 * (r < 0.6)
    elif name == "shard":
        a = np.clip(1 - (np.abs(x) * 2.2 + np.abs(y) * 0.95), 0, 1) ** 0.5
    elif name == "smoke":
        rng = np.random.default_rng(7)
        n = rng.random((4, 4))
        n = np.kron(n, np.ones((4, 4)))
        a = np.exp(-(r ** 2) / 0.35) * (0.6 + 0.4 * n)
    return np.clip(a, 0, 1)


def draw_sheet(path):
    img = np.zeros((SHEET, SHEET, 4))
    for name, (u, v) in SPRITES.items():
        a = sprite(name)
        img[v:v + CELL, u:u + CELL, :3] = 1.0
        img[v:v + CELL, u:u + CELL, 3] = a
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA").save(path)


# ------------------------------------------------------------ effect helper

def uv_of(*names):
    """uv expression picking one of several sprites at random per particle."""
    if len(names) == 1:
        u, v = SPRITES[names[0]]
        return [u, v]
    n = len(names)

    def pick(axis):
        # explicit parentheses: never rely on Molang ternary associativity
        expr = str(SPRITES[names[-1]][axis])
        for i in range(n - 2, -1, -1):
            expr = "(variable.particle_random_2 < %.3f ? %d : %s)" % ((i + 1) / n, SPRITES[names[i]][axis], expr)
        return expr
    return [pick(0), pick(1)]


COLOR = ["variable.color.r", "variable.color.g", "variable.color.b"]
FADE = "1 - variable.particle_age / variable.particle_lifetime"


def effect(ident, *, count, lifetime, size, sprites, speed=0.0, radius=0.0, direction="outwards",
           accel=(0, 0, 0), drag=0.0, color=None, alpha=FADE, spin=None, material="particles_blend",
           offset=(0, 0, 0)):
    shape = {"offset": list(offset), "radius": radius, "direction": direction} if radius else \
        {"offset": list(offset), "direction": [0, 0, 0] if direction == "outwards" else direction}
    if radius:
        shape_key = "minecraft:emitter_shape_sphere"
    else:
        shape_key = "minecraft:emitter_shape_point"
        if direction == "outwards":
            shape = {"offset": list(offset)}
    comps = {
        "minecraft:emitter_rate_instant": {"num_particles": count},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        shape_key: shape,
        "minecraft:particle_initial_speed": speed,
        "minecraft:particle_lifetime_expression": {"max_lifetime": lifetime},
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": list(accel),
            "linear_drag_coefficient": drag,
        },
        "minecraft:particle_appearance_billboard": {
            "size": [size, size],
            "facing_camera_mode": "lookat_xyz",
            "uv": {"texture_width": SHEET, "texture_height": SHEET, "uv": uv_of(*sprites), "uv_size": [CELL, CELL]},
        },
    }
    if spin:
        comps["minecraft:particle_initial_spin"] = {"rotation": spin[0], "rotation_rate": spin[1]}
    if isinstance(color, dict):
        comps["minecraft:particle_appearance_tinting"] = {"color": color}
    else:
        rgb = color or COLOR
        comps["minecraft:particle_appearance_tinting"] = {"color": list(rgb) + [alpha]}
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": ident,
                "basic_render_parameters": {"material": material, "texture": TEX},
            },
            "components": comps,
        },
    }


def gradient(stops):
    return {"gradient": stops, "interpolant": "variable.particle_age / variable.particle_lifetime"}


def effects():
    shrink = lambda s: "%s * (1 - variable.particle_age / variable.particle_lifetime * 0.8)" % s
    grow = lambda a, b: "%s + %s * variable.particle_age / variable.particle_lifetime" % (a, b)
    rnd = lambda a, b: "Math.random(%s, %s)" % (a, b)
    E = {}
    # ---- generic
    E["muzzle_flash"] = effect("magic_guns:muzzle_flash", count=5, lifetime="variable.particle_random_1 < 0.3 ? 0.08 : 0.2",
                               size="variable.particle_random_1 < 0.3 ? 0.45 * (1 - variable.particle_age / variable.particle_lifetime) : 0.08",
                               sprites=("glow", "star"), speed=rnd(0.5, 2.0), radius=0.05, drag=6)
    E["break_burst"] = effect("magic_guns:break_burst", count=14, lifetime=rnd(0.3, 0.6), size="0.07", sprites=("spark", "ember"),
                              speed=rnd(1.5, 3.5), radius=0.1, accel=(0, -6, 0), drag=2, color=[0.75, 0.75, 0.8])
    # ---- arcane (purple, sparkly, runes)
    E["arcane_trail"] = effect("magic_guns:arcane_trail", count=2, lifetime=rnd(0.25, 0.5), size=shrink("(variable.particle_random_1 * 0.12 + 0.1)"),
                               sprites=("glow", "star", "rune"), speed=rnd(0.05, 0.4), radius=0.06, drag=3, spin=(rnd(0, 360), rnd(-90, 90)))
    E["arcane_impact"] = effect("magic_guns:arcane_impact", count=16, lifetime=rnd(0.35, 0.7), size=shrink("(variable.particle_random_1 * 0.1 + 0.08)"),
                                sprites=("star", "glow", "rune"), speed=rnd(1.5, 4.0), radius=0.15, drag=5, spin=(rnd(0, 360), rnd(-180, 180)))
    # ---- fire (embers rising and cooling into smoke)
    fire_grad = gradient([[1.0, 0.95, 0.55, 1.0], [1.0, 0.55, 0.08, 0.95], [0.75, 0.16, 0.03, 0.7], [0.22, 0.2, 0.2, 0.0]])
    E["fire_trail"] = effect("magic_guns:fire_trail", count=3, lifetime=rnd(0.35, 0.8), size=grow("0.12", "0.22"),
                             sprites=("glow", "ember", "smoke"), speed=rnd(0.1, 0.5), radius=0.08, accel=(0, 1.6, 0), drag=1.5,
                             color=fire_grad, spin=(rnd(0, 360), rnd(-60, 60)))
    E["fire_impact"] = effect("magic_guns:fire_impact", count=22, lifetime=rnd(0.4, 1.0), size=grow("0.15", "0.35"),
                              sprites=("glow", "ember", "smoke"), speed=rnd(2.0, 6.0), radius=0.3, accel=(0, 2.5, 0), drag=4,
                              color=fire_grad, spin=(rnd(0, 360), rnd(-90, 90)))
    # ---- frost (snowflakes drifting down, ice shards)
    E["frost_trail"] = effect("magic_guns:frost_trail", count=2, lifetime=rnd(0.4, 0.9), size=shrink("(variable.particle_random_1 * 0.08 + 0.08)"),
                              sprites=("snow", "glow", "shard"), speed=rnd(0.05, 0.3), radius=0.05, accel=(0, -0.8, 0), drag=2,
                              spin=(rnd(0, 360), rnd(-120, 120)))
    E["frost_impact"] = effect("magic_guns:frost_impact", count=18, lifetime=rnd(0.5, 1.1), size=shrink("(variable.particle_random_1 * 0.12 + 0.07)"),
                               sprites=("snow", "shard", "star"), speed=rnd(1.5, 4.0), radius=0.2, accel=(0, -3, 0), drag=3,
                               spin=(rnd(0, 360), rnd(-200, 200)))
    # ---- storm (crackling sparks and bolts)
    E["storm_trail"] = effect("magic_guns:storm_trail", count=2, lifetime=rnd(0.08, 0.22), size="variable.particle_random_1 * 0.12 + 0.08",
                              sprites=("spark", "bolt", "glow"), speed=rnd(0.2, 1.2), radius=0.12, drag=4, spin=(rnd(0, 360), 0),
                              alpha="variable.particle_random_3 > 0.3 ? 1 : 0.4")
    E["storm_impact"] = effect("magic_guns:storm_impact", count=14, lifetime=rnd(0.1, 0.35), size="variable.particle_random_1 * 0.2 + 0.1",
                               sprites=("bolt", "spark", "glow"), speed=rnd(2.0, 6.0), radius=0.2, drag=6, spin=(rnd(0, 360), 0))
    # ---- soul (wisps and skulls rising)
    E["soul_trail"] = effect("magic_guns:soul_trail", count=2, lifetime=rnd(0.3, 0.7), size=shrink("(variable.particle_random_1 * 0.1 + 0.1)"),
                             sprites=("wisp", "glow"), speed=rnd(0.05, 0.2), radius=0.05, accel=(0, 0.9, 0), drag=2)
    E["soul_impact"] = effect("magic_guns:soul_impact", count=10, lifetime=rnd(0.5, 1.1), size="variable.particle_random_1 * 0.15 + 0.14",
                              sprites=("wisp", "skull", "glow"), speed=rnd(0.6, 1.8), radius=0.25, accel=(0, 1.8, 0), drag=3)
    # ---- void (dark swirling motes that collapse inwards)
    void_grad = gradient([["variable.color.r", "variable.color.g", "variable.color.b", 1.0], [0.25, 0.02, 0.35, 0.9], [0.05, 0.0, 0.08, 0.0]])
    E["void_trail"] = effect("magic_guns:void_trail", count=3, lifetime=rnd(0.25, 0.6), size=shrink("(variable.particle_random_1 * 0.12 + 0.08)"),
                             sprites=("glow", "star", "ring"), speed=rnd(0.2, 0.6), radius=0.35, direction="inwards", drag=1, color=void_grad,
                             spin=(rnd(0, 360), rnd(-240, 240)))
    E["void_impact"] = effect("magic_guns:void_impact", count=24, lifetime=rnd(0.3, 0.55), size="variable.particle_random_1 * 0.12 + 0.08",
                              sprites=("star", "glow", "ring"), speed=rnd(2.5, 4.0), radius=1.3, direction="inwards", drag=0.5, color=void_grad,
                              spin=(rnd(0, 360), rnd(-240, 240)))
    # ---- holy (golden stars, halo rings)
    E["holy_trail"] = effect("magic_guns:holy_trail", count=3, lifetime=rnd(0.3, 0.7), size=shrink("(variable.particle_random_1 * 0.18 + 0.12)"),
                             sprites=("glow", "star", "ring"), speed=rnd(0.05, 0.5), radius=0.15, drag=2, spin=(rnd(0, 360), rnd(-60, 60)))
    E["holy_impact"] = effect("magic_guns:holy_impact", count=30, lifetime=rnd(0.5, 1.2), size="variable.particle_random_1 * 0.3 + 0.12",
                              sprites=("star", "ring", "glow"), speed=rnd(2.0, 7.0), radius=0.4, accel=(0, 1.0, 0), drag=4,
                              spin=(rnd(0, 360), rnd(-90, 90)))
    return E


def main(rp_dir):
    draw_sheet(os.path.join(rp_dir, TEX + ".png"))
    out = os.path.join(rp_dir, "particles")
    os.makedirs(out, exist_ok=True)
    for name, data in effects().items():
        with open(os.path.join(out, "magic_guns_%s.json" % name), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print("particle", data["particle_effect"]["description"]["identifier"])


if __name__ == "__main__":
    main(sys.argv[1])

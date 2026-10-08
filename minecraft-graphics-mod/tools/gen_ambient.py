"""Optional add-on pack: ambient particles (daytime dust motes, night fireflies, underwater
plankton).  Separate from the main pack on purpose: to emit particles around the camera it
has to override Mojang's client entity file for the player (entity/player.entity.json),
which is tied to the game version it was made from (1.21.0.x).

Mechanism (all vanilla features, no scripting):
  * player.entity.json  +  "particle_effects" short names + an extra looping animation
  * animations/hg_ambient.animation.json  fires an emitter every ~0.25-0.5 s; a
    `pre_effect_script` decides *how many* particles (0 when the condition is false)
  * particles/hg_*.json  box-shaped instant emitters around the player.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from common import smoothstep, load_json_lenient, write_json, save_image, periodic_noise

AMBIENT_RP_NAME = "HorizonGlow_AmbientFX_RP"
AMBIENT_UUID = "5c0e7f31-2d8a-4b96-a1c4-8e3f60d9b712"
AMBIENT_MODULE_UUID = "b7a4d2e9-13c5-4f08-9a6b-4d1e82c7f035"
VERSION = [1, 0, 1]

# ----------------------------------------------------------------------------- conditions
# `query.time_of_day`: midnight 0.0, sunrise 0.25, noon 0.5, sunset 0.75 (Molang docs 1.21.0.26)
# `query.is_in_ui` keeps the inventory / paper-doll / map-icon passes of the player from emitting.
NEAR = "query.distance_from_camera < 8 && !query.is_in_ui"    # local player (any camera) + very close friends only
SURFACE = "query.position(1) > 56 && !query.is_in_water"      # not deep underground, not in water
DAY = "query.time_of_day > 0.26 && query.time_of_day < 0.74"
NIGHT = "(query.time_of_day < 0.20 || query.time_of_day > 0.80)"


def _script(cond, n):
    return f"variable.hg_n = ({cond}) ? {n} : 0;"


def animation():
    kf = {
        "0.0":  {"effect": "hg_dust",     "pre_effect_script": _script(f"{NEAR} && {SURFACE} && {DAY}", 3)},
        "0.25": {"effect": "hg_plankton", "pre_effect_script": _script(f"{NEAR} && query.is_in_water", 3)},
        "0.5":  {"effect": "hg_firefly",  "pre_effect_script": _script(f"{NEAR} && {SURFACE} && {NIGHT}", 2)},
        "0.75": {"effect": "hg_plankton", "pre_effect_script": _script(f"{NEAR} && query.is_in_water", 3)},
        "1.0":  {"effect": "hg_dust",     "pre_effect_script": _script(f"{NEAR} && {SURFACE} && {DAY}", 3)},
        "1.25": {"effect": "hg_plankton", "pre_effect_script": _script(f"{NEAR} && query.is_in_water", 3)},
        "1.5":  {"effect": "hg_firefly",  "pre_effect_script": _script(f"{NEAR} && {SURFACE} && {NIGHT}", 2)},
        "1.75": {"effect": "hg_plankton", "pre_effect_script": _script(f"{NEAR} && query.is_in_water", 3)},
    }
    return {"format_version": "1.10.0",
            "animations": {"animation.hg.ambient": {"loop": True, "animation_length": 2.0, "particle_effects": kf}}}


# ----------------------------------------------------------------------------- particles
def _particle(ident, material, half_dims, offset, life, size, color, accel, drag, lighting, only_in_blocks=None):
    comps = {
        "minecraft:emitter_rate_instant": {"num_particles": "variable.hg_n"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_box": {"offset": offset, "half_dimensions": half_dims},
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": accel, "linear_drag_coefficient": drag},
        "minecraft:particle_appearance_billboard": {
            "size": [size, size],
            "facing_camera_mode": "lookat_xyz",
            "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]},
        },
        "minecraft:particle_appearance_tinting": {"color": color},
    }
    if only_in_blocks:      # vanilla bubble pattern (basic_bubble.json): vanish outside these blocks
        comps["minecraft:particle_expire_if_not_in_blocks"] = list(only_in_blocks)
    if lighting:
        comps["minecraft:particle_appearance_lighting"] = {}
    return {"format_version": "1.10.0",
            "particle_effect": {"description": {"identifier": ident,
                                                 "basic_render_parameters": {"material": material,
                                                                             "texture": "textures/particle/hg_glow"}},
                                "components": comps}}


# clamped like vanilla's shriek/warden particles: the last frame must never give a negative alpha
FADE = "Math.sin(Math.clamp(variable.particle_age / variable.particle_lifetime, 0, 1) * 180)"


def particles():
    wob = lambda a, f, r: f"{a} * Math.sin(variable.particle_age * {f} + variable.particle_random_{r} * 360)"
    dust = _particle(
        "hg:ambient_dust", "particles_blend", [9, 3.6, 9], [0, 2.6, 0],      # y -1.0 .. 6.2 around the feet
        "6 + variable.particle_random_1 * 5",
        "0.030 + variable.particle_random_2 * 0.035",
        [1.0, 0.95, 0.80, f"{FADE} * 0.55"],
        [wob(0.07, 40, 2), wob(0.035, 55, 3), wob(0.07, 33, 4)], 0.9, True)
    firefly = _particle(
        "hg:ambient_firefly", "particles_blend", [10, 2.4, 10], [0, 1.6, 0],  # y -0.8 .. 4.0 around the feet
        "7 + variable.particle_random_1 * 5",
        "0.060 + variable.particle_random_2 * 0.040",
        [0.80, 1.0, 0.30,
         f"{FADE} * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(variable.particle_age * (140 + 220 * variable.particle_random_3) + variable.particle_random_4 * 360)))"],
        [wob(0.45, 45, 2), wob(0.30, 60, 3), wob(0.45, 38, 4)], 2.0, False)
    plankton = _particle(
        "hg:ambient_plankton", "particles_blend", [7, 4.0, 7], [0, 1.4, 0],
        "8 + variable.particle_random_1 * 5",
        "0.028 + variable.particle_random_2 * 0.030",
        [0.86, 0.96, 1.0, f"{FADE} * 0.50"],
        [wob(0.05, 36, 2), 0.012, wob(0.05, 30, 4)], 0.9, True,
        only_in_blocks=("minecraft:water", "minecraft:flowing_water", "minecraft:bubble_column"))
    return {"hg_dust.json": dust, "hg_firefly.json": firefly, "hg_plankton.json": plankton}


def glow_texture(n=16):
    """16x16 white soft round sprite, alpha = radial falloff (tinted by the particle)."""
    c = (n - 1) / 2
    y, x = np.mgrid[0:n, 0:n].astype(float)
    r = np.hypot(x - c, y - c) / (n / 2)
    a = np.exp(-(r / 0.42) ** 2.0) * (1 - smoothstep(0.75, 1.0, r))
    out = np.zeros((n, n, 4), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    return out


def icon(size=256, seed=3):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size].astype(float)
    t = y / size
    top, bot = np.array([0.02, 0.04, 0.12]), np.array([0.07, 0.16, 0.20])
    img = top + (bot - top) * t[..., None]
    # ground silhouette
    ridge = 0.78 + 0.04 * (periodic_noise(1, size, beta=2.4, seed=seed)[0] - 0.5) * 2
    img = np.where((y / size >= np.tile(ridge, (size, 1)))[..., None], np.array([0.01, 0.03, 0.04]), img)
    for _ in range(46):
        px, py = rng.uniform(0.05, 0.95) * size, rng.uniform(0.25, 0.8) * size
        r = np.hypot(x - px, y - py)
        g = np.exp(-(r / rng.uniform(3, 7)) ** 1.6) * rng.uniform(0.5, 1.0)
        img += g[..., None] * np.array([0.8, 1.0, 0.3])
    out = np.clip(np.round(img * 255), 0, 255).astype(np.uint8)
    return np.dstack([out, np.full((size, size), 255, np.uint8)])


def manifest():
    return {
        "format_version": 2,
        "header": {
            "name": "§bHorizon Glow§r Ambient FX §7(optional)",
            "description": "§7Fireflies at night, sunlit dust by day, plankton underwater. Made for 1.21.0.x only - "
                           "replaces the player client entity file.",
            "uuid": AMBIENT_UUID,
            "version": VERSION,
            "min_engine_version": [1, 21, 0],
        },
        "modules": [{"description": "Horizon Glow ambient particles", "type": "resources",
                     "uuid": AMBIENT_MODULE_UUID, "version": VERSION}],
        "metadata": {"authors": ["Horizon Glow (generated with Claude Code)"],
                     "license": "Personal use. player.entity.json is a modified copy of Mojang's file (c) Mojang AB."},
    }


def patch_player(vanilla: Path):
    """Vanilla client entity + three additions (everything else byte-for-byte semantics)."""
    d = load_json_lenient(vanilla / "entity" / "player.entity.json")
    desc = d["minecraft:client_entity"]["description"]
    assert "particle_effects" not in desc, "vanilla player already has particle_effects; merge needed"
    desc["particle_effects"] = {"hg_dust": "hg:ambient_dust", "hg_firefly": "hg:ambient_firefly",
                                "hg_plankton": "hg:ambient_plankton"}
    desc["animations"]["hg_ambient"] = "animation.hg.ambient"
    assert desc["scripts"]["animate"] == ["root"]
    desc["scripts"]["animate"] = ["root", "hg_ambient"]
    return d


def generate(vanilla: Path, out_dir: Path):
    write_json(out_dir / "manifest.json", manifest())
    write_json(out_dir / "entity" / "player.entity.json", patch_player(vanilla))
    write_json(out_dir / "animations" / "hg_ambient.animation.json", animation())
    for name, obj in particles().items():
        write_json(out_dir / "particles" / name, obj)
    save_image(glow_texture(), out_dir / "textures" / "particle" / "hg_glow.png")
    save_image(icon(), out_dir / "pack_icon.png")

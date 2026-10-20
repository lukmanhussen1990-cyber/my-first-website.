"""Particle effects (JSON) and their procedural textures."""
import math
import numpy as np
from PIL import Image

from .specs import NS

TEX = f"textures/{NS}/particle"


def _effect(ident, material, texture, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": f"{NS}:{ident}",
                "basic_render_parameters": {"material": material, "texture": f"{TEX}/{texture}"},
            },
            "components": components,
        },
    }


def _uv(w, h, u=0, v=0, us=None, vs=None):
    return {"texture_width": w, "texture_height": h, "uv": [u, v], "uv_size": [us or w, vs or h]}


AGE = "variable.particle_age / variable.particle_lifetime"


def effects():
    out = {}
    # ---- muzzle flash: bright star, random frame and rotation -----------------
    out["muzzle_flash"] = _effect("muzzle_flash", "particles_add", "muzzle_flash", {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "offset": ["variable.dir.x * variable.particle_random_3 * 0.12",
                       "variable.dir.y * variable.particle_random_3 * 0.12",
                       "variable.dir.z * variable.particle_random_3 * 0.12"],
            "direction": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.035, 0.065)"},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 0},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {
            "size": [f"(variable.flash > 0 ? variable.flash : 0.12) * (0.65 + variable.particle_random_1 * 0.6) * (1.0 - {AGE} * 0.35)",
                     f"(variable.flash > 0 ? variable.flash : 0.12) * (0.65 + variable.particle_random_1 * 0.6) * (1.0 - {AGE} * 0.35)"],
            "facing_camera_mode": "rotate_xyz",
            "uv": {"texture_width": 128, "texture_height": 32,
                   "uv": ["math.floor(variable.particle_random_2 * 3.99) * 32", 0], "uv_size": [32, 32]},
        },
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.92, 0.75, f"1.0 - {AGE} * 0.5"]},
    })
    # ---- muzzle smoke -------------------------------------------------------
    out["muzzle_smoke"] = _effect("muzzle_smoke", "particles_blend", "smoke", {
        "minecraft:emitter_rate_instant": {"num_particles": 4},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "offset": [0, 0, 0],
            "direction": ["variable.dir.x + math.random(-0.3, 0.3)", "variable.dir.y + math.random(0.0, 0.4)",
                          "variable.dir.z + math.random(-0.3, 0.3)"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.45, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(0.4, 1.4)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-40, 40)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.35, 0], "linear_drag_coefficient": 2.6},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.04 + {AGE} * 0.16", f"0.04 + {AGE} * 0.16"],
            "facing_camera_mode": "rotate_xyz",
            "uv": _uv(16, 16),
        },
        "minecraft:particle_appearance_tinting": {"color": [0.72, 0.72, 0.72, f"0.42 * (1.0 - {AGE})"]},
    })
    # ---- tracer: a short comet of dots travelling with the bullet ---------------
    out["tracer"] = _effect("tracer", "particles_add", "tracer", {
        "minecraft:emitter_rate_instant": {"num_particles": 9},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "offset": ["-variable.dir.x * variable.particle_random_1 * 1.1",
                       "-variable.dir.y * variable.particle_random_1 * 1.1",
                       "-variable.dir.z * variable.particle_random_1 * 1.1"],
            "direction": ["variable.dir.x", "variable.dir.y", "variable.dir.z"]},
        "minecraft:particle_lifetime_expression": {
            "max_lifetime": "variable.life > 0 ? variable.life : 0.5"},
        "minecraft:particle_initial_speed": "variable.speed > 0 ? variable.speed : 80",
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_motion_collision": {"collision_radius": 0.03, "expire_on_contact": True},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.028 * (1.0 - variable.particle_random_1 * 0.75)",
                     "0.028 * (1.0 - variable.particle_random_1 * 0.75)"],
            "facing_camera_mode": "lookat_xyz",
            "uv": _uv(8, 8),
        },
        "minecraft:particle_appearance_tinting": {
            "color": [1.0, "0.92 - variable.particle_random_1 * 0.35", "0.55 - variable.particle_random_1 * 0.4", 1.0]},
    })
    # ---- bullet trail (emitted by the bullet entity) ------------------------------
    out["bullet_trail"] = _effect("bullet_trail", "particles_blend", "smoke", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 90, "max_particles": 60},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0], "direction": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.18, 0.32)"},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.2, 0]},
        "minecraft:particle_appearance_billboard": {
            "size": [f"0.022 + {AGE} * 0.03", f"0.022 + {AGE} * 0.03"],
            "facing_camera_mode": "lookat_xyz",
            "uv": _uv(16, 16),
        },
        "minecraft:particle_appearance_tinting": {"color": [0.86, 0.84, 0.8, f"0.5 * (1.0 - {AGE})"]},
    })
    # ---- impact sparks + dust -------------------------------------------------
    out["impact"] = _effect("impact", "particles_blend", "spark", {
        "minecraft:emitter_rate_instant": {"num_particles": 10},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "offset": [0, 0, 0],
            "direction": ["variable.nrm.x + math.random(-0.8, 0.8)", "variable.nrm.y + math.random(-0.5, 0.9)",
                          "variable.nrm.z + math.random(-0.8, 0.8)"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.15, 0.45)"},
        "minecraft:particle_initial_speed": "math.random(1.5, 5.0)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_motion_collision": {"collision_radius": 0.02, "coefficient_of_restitution": 0.3,
                                                "collision_drag": 4},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.025 + variable.particle_random_2 * 0.03", "0.025 + variable.particle_random_2 * 0.03"],
            "facing_camera_mode": "lookat_xyz",
            "uv": _uv(8, 8),
        },
        "minecraft:particle_appearance_tinting": {
            "color": ["variable.particle_random_3 > 0.45 ? 1.0 : 0.55",
                      "variable.particle_random_3 > 0.45 ? 0.75 : 0.52",
                      "variable.particle_random_3 > 0.45 ? 0.35 : 0.48",
                      f"1.0 - {AGE} * 0.6"]},
    })
    # ---- hit on a living target -----------------------------------------------------
    out["blood"] = _effect("blood", "particles_alpha", "spark", {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.08, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.55)"},
        "minecraft:particle_initial_speed": "math.random(0.8, 2.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.035 + variable.particle_random_1 * 0.035", "0.035 + variable.particle_random_1 * 0.035"],
            "facing_camera_mode": "lookat_xyz",
            "uv": _uv(8, 8),
        },
        "minecraft:particle_appearance_tinting": {"color": [0.62, 0.05, 0.05, 1.0]},
        "minecraft:particle_appearance_lighting": {},
    })
    # ---- ejected shell casing -------------------------------------------------------
    out["shell"] = _effect("shell", "particles_alpha", "shell", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {
            "offset": [0, 0, 0],
            "direction": ["variable.right.x + math.random(-0.15, 0.15)", "0.9 + math.random(0.0, 0.4)",
                          "variable.right.z + math.random(-0.15, 0.15)"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.4},
        "minecraft:particle_initial_speed": "math.random(2.2, 3.4)",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-900, 900)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_motion_collision": {"collision_radius": 0.03, "coefficient_of_restitution": 0.35,
                                                "collision_drag": 3},
        "minecraft:particle_appearance_billboard": {
            "size": [0.022, 0.045],
            "facing_camera_mode": "rotate_xyz",
            "uv": {"texture_width": 16, "texture_height": 8,
                   "uv": ["variable.shotgun > 0 ? 8 : 0", 0], "uv_size": [8, 8]},
        },
        "minecraft:particle_appearance_lighting": {},
    })
    # ---- scope reticle (spawned on the aim line while scoped) -----------------------------
    out["reticle"] = _effect("reticle", "particles_alpha", "reticle", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0], "direction": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.07},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": {
            "size": ["variable.rsize > 0 ? variable.rsize : 0.08", "variable.rsize > 0 ? variable.rsize : 0.08"],
            "facing_camera_mode": "rotate_xyz",
            "uv": _uv(64, 64),
        },
    })
    return out


# --------------------------------------------------------------------------
# textures
# --------------------------------------------------------------------------
def _img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def tex_muzzle_flash(seed=7):
    rng = np.random.default_rng(seed)
    W = 32
    frames = []
    for f in range(4):
        yy, xx = np.mgrid[0:W, 0:W] + 0.5
        cx = cy = W / 2
        dx, dy = xx - cx, yy - cy
        r = np.hypot(dx, dy) / (W / 2)
        ang = np.arctan2(dy, dx)
        n = 4 + f % 3
        spikes = np.abs(np.cos(ang * n / 2 + rng.uniform(0, 3))) ** 6
        lobes = 0.35 + 0.65 * spikes * rng.uniform(0.7, 1.0)
        core = np.exp(-(r / 0.28) ** 2)
        star = np.clip(1.0 - r / lobes, 0, 1) ** 1.6
        a = np.clip(core * 1.0 + star * 0.95, 0, 1)
        rgb = np.zeros((W, W, 3))
        rgb[..., 0] = 255
        rgb[..., 1] = 170 + 85 * core
        rgb[..., 2] = 60 + 190 * core ** 2
        img = np.concatenate([rgb, (a * 255)[..., None]], axis=2)
        frames.append(img)
    return _img(np.concatenate(frames, axis=1))


def tex_round(size=16, soft=True, color=(255, 255, 255)):
    yy, xx = np.mgrid[0:size, 0:size] + 0.5
    r = np.hypot(xx - size / 2, yy - size / 2) / (size / 2)
    a = np.clip(1.0 - r, 0, 1) ** (1.4 if soft else 0.2)
    img = np.zeros((size, size, 4))
    img[..., :3] = color
    img[..., 3] = a * 255
    return _img(img)


def tex_smoke():
    rng = np.random.default_rng(3)
    size = 16
    yy, xx = np.mgrid[0:size, 0:size] + 0.5
    r = np.hypot(xx - size / 2, yy - size / 2) / (size / 2)
    n = rng.normal(0, 0.12, (size, size))
    a = np.clip((1.0 - r) * 1.3 + n, 0, 1) ** 1.3
    img = np.zeros((size, size, 4))
    img[..., :3] = 235
    img[..., 3] = a * 255
    return _img(img)


def tex_spark():
    size = 8
    img = np.zeros((size, size, 4))
    img[2:6, 2:6] = (255, 255, 255, 255)
    img[3:5, 1:7] = (255, 255, 255, 255)
    img[1:7, 3:5] = (255, 255, 255, 255)
    return _img(img)


def tex_shell():
    img = np.zeros((8, 16, 4))
    # brass casing (left 8x8) and red shotgun shell (right 8x8), drawn vertically
    for x0, body, head in ((0, (206, 166, 74), (230, 200, 120)), (8, (196, 34, 30), (206, 168, 76))):
        img[0:8, x0 + 2:x0 + 6, :3] = body
        img[0:8, x0 + 2:x0 + 6, 3] = 255
        img[6:8, x0 + 2:x0 + 6, :3] = head
        img[0:8, x0 + 2, :3] = np.array(body) * 1.15
        img[0:8, x0 + 5, :3] = np.array(body) * 0.7
    return _img(img)


def tex_reticle():
    S = 64
    img = np.zeros((S, S, 4))
    c = S // 2
    black = (8, 8, 8, 255)
    for i in range(S):
        d = abs(i + 0.5 - c)
        if d <= 3:
            continue
        th = 1 if d < 20 else 3
        lo = c - th // 2 - (1 if th == 1 else 0)
        img[lo:lo + max(th, 2), i] = black
        img[i, lo:lo + max(th, 2)] = black
    img[c - 1:c + 1, c - 1:c + 1] = (220, 30, 30, 255)
    for m in (9, 15):
        for sgn in (-1, 1):
            p = c + sgn * m
            img[c - 2:c + 2, p - 1:p + 1] = black
            img[p - 1:p + 1, c - 2:c + 2] = black
    return _img(img)


def textures():
    return {
        "muzzle_flash": tex_muzzle_flash(),
        "smoke": tex_smoke(),
        "tracer": tex_round(8, soft=True),
        "spark": tex_spark(),
        "shell": tex_shell(),
        "reticle": tex_reticle(),
    }

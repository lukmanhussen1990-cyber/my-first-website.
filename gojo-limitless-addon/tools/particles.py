"""Generate every particle effect (RP/particles/*.json) for the Limitless Addon.

All effects use the 1.10.0 particle format that Minecraft 1.21.0.26 ships with.
Heavy effects (domain) have _low/_med/_high variants selected by the in-game
"Particle quality" setting so older Android phones keep a good frame rate.

Run:  python3 tools/particles.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "packs", "Gojo_Limitless_RP", "particles")
TEX = "textures/particle/gojo/"

AGE = "(variable.particle_age / variable.particle_lifetime)"
FADE = f"math.clamp(1 - {AGE}, 0, 1)"
FADE_INOUT = f"math.clamp(math.min({AGE} * 5, (1 - {AGE}) * 2.5), 0, 1)"

TEXTURES = {
    "glow": (32, 32), "core": (32, 32), "spark": (16, 16), "star": (16, 16), "ring": (64, 64),
    "ripple": (32, 32), "smoke": (32, 32), "bolt": (128, 32), "glyph": (64, 16), "eye": (64, 32),
    "cell": (16, 16), "streak": (16, 64), "shard": (8, 8),
}

effects = {}


def uv_full(tex):
    w, h = TEXTURES[tex]
    return {"texture_width": w, "texture_height": h, "uv": [0, 0], "uv_size": [w, h]}


def uv_random_frame(tex, frames, fw, fh):
    w, h = TEXTURES[tex]
    return {
        "texture_width": w,
        "texture_height": h,
        "uv": [f"math.floor(variable.particle_random_4 * {frames}) * {fw}", 0],
        "uv_size": [fw, fh],
    }


def color(r, g, b, a=FADE):
    return {"color": [r, g, b, a]}


def effect(ident, tex, material, components, events=None):
    data = {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": ident,
                "basic_render_parameters": {"material": material, "texture": TEX + tex},
            },
            "components": components,
        },
    }
    if events:
        data["particle_effect"]["events"] = {
            name: {"particle_effect": {"effect": target, "type": "emitter"}} for name, target in events.items()
        }
        data["particle_effect"]["components"]["minecraft:emitter_lifetime_events"] = {
            "creation_event": list(events.keys())
        }
    effects[ident] = data


def billboard(size_w, size_h, tex, facing="lookat_xyz", uv=None, direction=None):
    bb = {"size": [size_w, size_h], "facing_camera_mode": facing, "uv": uv or uv_full(tex)}
    if direction:
        bb["direction"] = direction
    return bb


# ---------------------------------------------------------------- building blocks

def glow(ident, tex, rgb, size, life, material="particles_add", alpha=FADE, pulse=None):
    """A single glowing sprite (spawned once, or every tick by scripts)."""
    size_expr = f"{size} * (0.85 + 0.3 * {FADE})" if pulse is None else pulse
    effect(ident, tex, material, {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-90, 90)"},
        "minecraft:particle_appearance_billboard": billboard(size_expr, size_expr, tex),
        "minecraft:particle_appearance_tinting": color(*rgb, alpha),
    })


def burst(ident, tex, rgb, count, speed, life, size, drag=3.0, gravity=0.0, material="particles_add",
          radius=0.2, shape="sphere", events=None, color_expr=None, spin=True):
    comps = {
        "minecraft:emitter_rate_instant": {"num_particles": count},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:particle_initial_speed": speed,
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, gravity, 0], "linear_drag_coefficient": drag},
        "minecraft:particle_appearance_billboard": billboard(f"{size} * {FADE}", f"{size} * {FADE}", tex),
        "minecraft:particle_appearance_tinting": color_expr or color(*rgb),
    }
    if shape == "sphere":
        comps["minecraft:emitter_shape_sphere"] = {"radius": radius, "direction": "outwards"}
    elif shape == "up":
        comps["minecraft:emitter_shape_disc"] = {"radius": radius, "plane_normal": "y", "direction": [0, 1, 0]}
    if spin:
        comps["minecraft:particle_initial_spin"] = {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-200, 200)"}
    effect(ident, tex, material, comps, events)


def ring(ident, rgb, start, end, life, facing="lookat_xyz", material="particles_add", tex="ring", alpha=FADE):
    size = f"{start} + ({end} - {start}) * math.pow({AGE}, 0.6)"
    effect(ident, tex, material, {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_appearance_billboard": billboard(size, size, tex, facing),
        "minecraft:particle_appearance_tinting": color(*rgb, alpha),
    })


def flash(ident, rgb, size, life, tex="glow"):
    size_expr = f"{size} * (0.4 + 0.6 * math.sin(math.min({AGE} * 3, 1) * 90)) * (1.15 - {AGE} * 0.4)"
    glow(ident, tex, rgb, size, life, pulse=size_expr)


# ---------------------------------------------------------------- colours
BLUE = (0.25, 0.55, 1.0)
BLUE_L = (0.65, 0.88, 1.0)
CYAN = (0.4, 0.92, 1.0)
RED = (1.0, 0.16, 0.14)
RED_L = (1.0, 0.62, 0.45)
PURPLE = (0.66, 0.2, 1.0)
PURPLE_L = (0.96, 0.72, 1.0)
WHITE = (1.0, 1.0, 1.0)
GREEN = (0.35, 1.0, 0.55)
VOID_DARK = (0.06, 0.02, 0.16)

# ---------------------------------------------------------------- Lapse: Blue
glow("gojo:blue_core", "core", BLUE_L, 1.6, 4.0,
     pulse="1.5 + 0.28 * math.sin(variable.particle_age * 900) + 0.4 * math.clamp(1 - variable.particle_age * 3, 0, 1)",
     alpha="math.clamp(math.min(variable.particle_age * 8, (4 - variable.particle_age) * 2), 0, 1)")
glow("gojo:blue_halo", "ring", BLUE, 3.4, 4.0,
     pulse="3.2 + 0.4 * math.sin(variable.particle_age * 400)",
     alpha="0.7 * math.clamp(math.min(variable.particle_age * 6, (4 - variable.particle_age) * 2), 0, 1)")
effect("gojo:blue_singularity", "spark", "particles_add", {
    "minecraft:emitter_rate_steady": {"spawn_rate": 34, "max_particles": 60},
    "minecraft:emitter_lifetime_once": {"active_time": 3.9},
    "minecraft:emitter_shape_sphere": {"radius": "5.5 + variable.particle_random_1", "surface_only": True, "direction": "inwards"},
    "minecraft:particle_initial_speed": "math.random(5, 7)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.85},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.6},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 360},
    "minecraft:particle_appearance_billboard": billboard(f"0.28 * {FADE_INOUT}", f"0.28 * {FADE_INOUT}", "spark"),
    "minecraft:particle_appearance_tinting": color("0.45 + variable.particle_random_2 * 0.5", "0.75 + variable.particle_random_2 * 0.25", 1.0, FADE_INOUT),
}, events={"core": "gojo:blue_core", "halo": "gojo:blue_halo"})
ring("gojo:blue_pulse", BLUE, 5.5, 0.8, 0.45)
burst("gojo:blue_spark", "spark", BLUE_L, 6, "math.random(2, 4)", "math.random(0.25, 0.45)", 0.22)
flash("gojo:blue_flash", BLUE_L, 5.0, 0.35)
burst("gojo:blue_collapse", "spark", BLUE_L, 28, "math.random(7, 12)", "math.random(0.4, 0.7)", 0.35, drag=3.5,
      events={"flash": "gojo:blue_flash"})

# ---------------------------------------------------------------- Reversal: Red
glow("gojo:red_charge", "core", RED_L, 0.55, 0.1)
glow("gojo:red_orb", "core", RED_L, 1.0, 0.13)
burst("gojo:red_trail", "spark", RED, 3, "math.random(0.5, 1.5)", "math.random(0.25, 0.4)", 0.25, drag=2.0,
      color_expr=color(1.0, "0.2 + variable.particle_random_2 * 0.5", "0.1 + variable.particle_random_2 * 0.2"))
flash("gojo:red_flash", RED_L, 7.0, 0.35)
ring("gojo:red_shockwave", RED, 1.0, 15.0, 0.55, facing="emitter_transform_xz")
effect("gojo:red_smoke", "smoke", "particles_blend", {
    "minecraft:emitter_rate_instant": {"num_particles": 8},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(1, 3)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.9, 1.4)"},
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.5},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-40, 40)"},
    "minecraft:particle_appearance_billboard": billboard(f"1.6 + {AGE} * 2", f"1.6 + {AGE} * 2", "smoke"),
    "minecraft:particle_appearance_tinting": color(0.35, 0.05, 0.05, f"0.6 * {FADE}"),
})
burst("gojo:red_explosion", "spark", RED, 40, "math.random(10, 18)", "math.random(0.5, 0.9)", 0.45, drag=3.0, gravity=-3,
      color_expr=color(1.0, "0.25 + variable.particle_random_2 * 0.55", "0.1 + variable.particle_random_2 * 0.3"),
      events={"flash": "gojo:red_flash", "wave": "gojo:red_shockwave", "smoke": "gojo:red_smoke"})

# ---------------------------------------------------------------- Hollow Purple
glow("gojo:purple_charge_blue", "core", BLUE_L, 0.8, 0.1)
glow("gojo:purple_charge_red", "core", RED_L, 0.8, 0.1)
glow("gojo:purple_charge_core", "core", PURPLE_L, 1.2, 0.1)
flash("gojo:purple_flash_small", PURPLE_L, 3.2, 0.3)
ring("gojo:purple_ring_small", PURPLE, 0.6, 4.0, 0.35)
burst("gojo:purple_merge", "spark", PURPLE_L, 30, "math.random(4, 9)", "math.random(0.3, 0.6)", 0.3, drag=3,
      events={"flash": "gojo:purple_flash_small", "ring": "gojo:purple_ring_small"})
glow("gojo:purple_haze", "glow", PURPLE, 6.0, 0.16, alpha=f"0.55 * {FADE}")
glow("gojo:purple_core_white", "core", WHITE, 1.6, 0.12)
effect("gojo:purple_orb", "core", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.16},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 120},
    "minecraft:particle_appearance_billboard": billboard("3.4", "3.4", "core"),
    "minecraft:particle_appearance_tinting": color(0.78, 0.38, 1.0, FADE),
}, events={"haze": "gojo:purple_haze", "white": "gojo:purple_core_white"})
burst("gojo:purple_trail", "spark", PURPLE, 6, "math.random(1, 3.5)", "math.random(0.5, 0.9)", 0.35, drag=2.2, radius=1.2,
      color_expr=color("0.7 + variable.particle_random_2 * 0.3", "0.25 + variable.particle_random_3 * 0.7", 1.0))
ring("gojo:purple_ring", PURPLE, 2.5, 7.5, 0.35)
flash("gojo:purple_flash_big", PURPLE_L, 13.0, 0.55)
ring("gojo:purple_shockwave", PURPLE, 2.0, 26.0, 0.7, facing="emitter_transform_xz")
effect("gojo:purple_smoke", "smoke", "particles_blend", {
    "minecraft:emitter_rate_instant": {"num_particles": 10},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 2.0, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(1.5, 4)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.6)"},
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 1.4},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-30, 30)"},
    "minecraft:particle_appearance_billboard": billboard(f"2.2 + {AGE} * 3", f"2.2 + {AGE} * 3", "smoke"),
    "minecraft:particle_appearance_tinting": color(0.22, 0.05, 0.35, f"0.6 * {FADE}"),
})
burst("gojo:purple_burst", "spark", PURPLE_L, 60, "math.random(14, 24)", "math.random(0.6, 1.1)", 0.55, drag=2.8,
      color_expr=color("0.75 + variable.particle_random_2 * 0.25", "0.3 + variable.particle_random_3 * 0.7", 1.0),
      events={"flash": "gojo:purple_flash_big", "wave": "gojo:purple_shockwave", "smoke": "gojo:purple_smoke"})

# ---------------------------------------------------------------- Unlimited Void
flash("gojo:void_flash", WHITE, 7.0, 0.35)
effect("gojo:void_open", "star", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 70},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 1.0, "surface_only": True, "direction": "outwards"},
    "minecraft:particle_initial_speed": "math.random(17, 21)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.9},
    "minecraft:particle_appearance_billboard": billboard(f"0.45 * {FADE}", f"0.45 * {FADE}", "star"),
    "minecraft:particle_appearance_tinting": color("0.75 + variable.particle_random_2 * 0.25", "0.65 + variable.particle_random_2 * 0.35", 1.0),
}, events={"flash": "gojo:void_flash"})
effect("gojo:void_collapse", "star", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 70},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 14.0, "surface_only": True, "direction": "inwards"},
    "minecraft:particle_initial_speed": 19,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_appearance_billboard": billboard(f"0.4 * {FADE}", f"0.4 * {FADE}", "star"),
    "minecraft:particle_appearance_tinting": color(0.85, 0.75, 1.0),
}, events={"flash": "gojo:void_flash"})

for suffix, dome_rate, star_rate in (("_low", 22, 26), ("_med", 42, 48), ("_high", 70, 80)):
    effect("gojo:void_dome" + suffix, "smoke", "particles_blend", {
        "minecraft:emitter_rate_steady": {"spawn_rate": dome_rate, "max_particles": int(dome_rate * 2.4)},
        "minecraft:emitter_lifetime_once": {"active_time": 2.2},
        "minecraft:emitter_shape_sphere": {"radius": 14.0, "surface_only": True, "direction": "inwards"},
        "minecraft:particle_initial_speed": 0.3,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.6, 2.2)"},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-20, 20)"},
        "minecraft:particle_appearance_billboard": billboard("1.6 + variable.particle_random_1", "1.6 + variable.particle_random_1", "smoke"),
        "minecraft:particle_appearance_tinting": color("0.05 + variable.particle_random_2 * 0.12", "0.02 + variable.particle_random_2 * 0.05",
                                                       "0.14 + variable.particle_random_2 * 0.25", f"0.8 * {FADE_INOUT}"),
    })
    effect("gojo:void_stars" + suffix, "star", "particles_add", {
        "minecraft:emitter_rate_steady": {"spawn_rate": star_rate, "max_particles": int(star_rate * 2.2)},
        "minecraft:emitter_lifetime_once": {"active_time": 2.2},
        "minecraft:emitter_shape_sphere": {"radius": 13.0, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.15,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.0)"},
        "minecraft:particle_appearance_billboard": billboard(
            "(0.1 + variable.particle_random_1 * 0.2) * (0.6 + 0.4 * math.sin(variable.particle_age * 700))",
            "(0.1 + variable.particle_random_1 * 0.2) * (0.6 + 0.4 * math.sin(variable.particle_age * 700))", "star"),
        "minecraft:particle_appearance_tinting": color("0.8 + variable.particle_random_2 * 0.2", "0.75 + variable.particle_random_3 * 0.25", 1.0, FADE_INOUT),
    })

effect("gojo:void_galaxy", "spark", "particles_add", {
    "minecraft:emitter_rate_steady": {"spawn_rate": 26, "max_particles": 60},
    "minecraft:emitter_lifetime_once": {"active_time": 2.2},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 2.0},
    "minecraft:particle_motion_parametric": {
        "relative_position": [
            "(1 + variable.particle_random_1 * 12) * math.cos(variable.particle_random_2 * 360 + variable.particle_age * 45)",
            "0.05 + variable.particle_random_3 * 0.2",
            "(1 + variable.particle_random_1 * 12) * math.sin(variable.particle_random_2 * 360 + variable.particle_age * 45)",
        ]
    },
    "minecraft:particle_appearance_billboard": billboard("0.2", "0.2", "spark"),
    "minecraft:particle_appearance_tinting": color("0.55 + variable.particle_random_3 * 0.45", "0.35 + variable.particle_random_2 * 0.4", 1.0, FADE_INOUT),
})
effect("gojo:void_glyph", "glyph", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 2},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": 0.8,
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.0},
    "minecraft:particle_appearance_billboard": billboard("0.32", "0.32", "glyph", uv=uv_random_frame("glyph", 4, 16, 16)),
    "minecraft:particle_appearance_tinting": color(0.7, 0.95, 1.0, FADE),
})

# ---------------------------------------------------------------- Six Eyes
effect("gojo:six_eyes_open", "eye", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.2},
    "minecraft:particle_appearance_billboard": billboard(f"1.5 + {AGE} * 0.6", f"0.75 + {AGE} * 0.3", "eye"),
    "minecraft:particle_appearance_tinting": color(1, 1, 1, FADE_INOUT),
}, events={"rays": "gojo:six_eyes_rays"})
burst("gojo:six_eyes_rays", "spark", CYAN, 20, "math.random(3, 6)", "math.random(0.4, 0.8)", 0.22, drag=2.5)
burst("gojo:six_eyes_trail", "glow", CYAN, 2, "math.random(0.1, 0.4)", "math.random(0.25, 0.4)", 0.07, drag=1.0, radius=0.03)
for ident, w, life in (("gojo:six_eyes_mark", 0.5, 1.0), ("gojo:six_eyes_focus", 0.75, 0.6)):
    effect(ident, "eye", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_initial_speed": 0.0,
        "minecraft:particle_lifetime_expression": {"max_lifetime": life},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.35, 0]},
        "minecraft:particle_appearance_billboard": billboard(str(w), str(w / 2), "eye"),
        "minecraft:particle_appearance_tinting": color(1, 1, 1, FADE_INOUT),
    })

# ---------------------------------------------------------------- Teleport
effect("gojo:teleport_streak", "streak", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
    "minecraft:particle_appearance_billboard": billboard(f"0.7 * {FADE}", "2.8", "streak", facing="lookat_y"),
    "minecraft:particle_appearance_tinting": color(*BLUE_L),
})
ring("gojo:teleport_ring", CYAN, 0.4, 2.8, 0.35, facing="emitter_transform_xz")
burst("gojo:teleport_burst", "spark", CYAN, 24, "math.random(3, 6)", "math.random(0.3, 0.6)", 0.28, drag=3, radius=0.5,
      events={"streak": "gojo:teleport_streak", "ring": "gojo:teleport_ring"})

# ---------------------------------------------------------------- Reverse Cursed Technique
effect("gojo:rct_aura", "cell", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 3},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_disc": {"radius": 0.6, "plane_normal": "y", "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": "math.random(1.0, 1.8)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.2)"},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
    "minecraft:particle_appearance_billboard": billboard(f"0.14 * {FADE_INOUT}", f"0.14 * {FADE_INOUT}", "cell"),
    "minecraft:particle_appearance_tinting": color("0.5 + variable.particle_random_2 * 0.5", 1.0, "0.6 + variable.particle_random_2 * 0.4", FADE_INOUT),
})
burst("gojo:rct_heal", "spark", GREEN, 6, "math.random(1, 2.5)", "math.random(0.3, 0.6)", 0.2, drag=2, radius=0.4, gravity=1.5)
ring("gojo:rct_ring", GREEN, 0.5, 3.2, 0.45, facing="emitter_transform_xz")
burst("gojo:rct_burst", "spark", GREEN, 16, "math.random(2, 4)", "math.random(0.4, 0.7)", 0.25, drag=2.5, gravity=1.0,
      events={"ring": "gojo:rct_ring"})

# ---------------------------------------------------------------- Black Flash
effect("gojo:black_flash_arcs", "bolt", "particles_blend", {
    "minecraft:emitter_rate_instant": {"num_particles": 7},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_sphere": {"radius": 0.9, "direction": "outwards"},
    "minecraft:particle_initial_speed": 0.5,
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.18, 0.3)"},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 0},
    "minecraft:particle_appearance_billboard": billboard("1.2 + variable.particle_random_1 * 1.2", "0.6 + variable.particle_random_1 * 0.6", "bolt",
                                                        uv=uv_random_frame("bolt", 4, 32, 32)),
    "minecraft:particle_appearance_tinting": color(1, 1, 1, FADE),
})
ring("gojo:black_flash_ring", (0.9, 0.1, 0.12), 0.8, 5.5, 0.3)
flash("gojo:black_flash_flash", RED, 3.0, 0.2)
burst("gojo:black_flash", "spark", RED, 30, "math.random(8, 15)", "math.random(0.25, 0.5)", 0.3, drag=4,
      color_expr=color(1.0, "variable.particle_random_2 * 0.35", "variable.particle_random_2 * 0.2"),
      events={"arcs": "gojo:black_flash_arcs", "ring": "gojo:black_flash_ring", "flash": "gojo:black_flash_flash"})
burst("gojo:black_flash_whiff", "spark", RED, 12, "math.random(4, 8)", "math.random(0.2, 0.4)", 0.22, drag=4,
      events={"arcs": "gojo:black_flash_arcs"})

# ---------------------------------------------------------------- Infinity
effect("gojo:infinity_ripple", "ripple", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
    "minecraft:particle_appearance_billboard": billboard(f"0.5 + {AGE} * 1.1", f"0.5 + {AGE} * 1.1", "ripple"),
    "minecraft:particle_appearance_tinting": color(0.7, 0.95, 1.0, f"0.9 * {FADE}"),
})
ring("gojo:infinity_ring", CYAN, 0.6, 4.5, 0.5, facing="emitter_transform_xz")
burst("gojo:infinity_toggle", "spark", CYAN, 18, "math.random(1.5, 3)", "math.random(0.5, 0.9)", 0.22, drag=1.5, gravity=1.2,
      radius=0.8, events={"ring": "gojo:infinity_ring"})
ring("gojo:infinity_off", (0.55, 0.7, 0.85), 3.5, 0.4, 0.35, facing="emitter_transform_xz")

# ---------------------------------------------------------------- Transformation
effect("gojo:aura", "glow", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 3},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_disc": {"radius": 0.55, "plane_normal": "y", "direction": [0, 1, 0]},
    "minecraft:particle_initial_speed": "math.random(0.6, 1.2)",
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.2)"},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.6},
    "minecraft:particle_appearance_billboard": billboard(f"0.16 * {FADE_INOUT}", f"0.16 * {FADE_INOUT}", "glow"),
    "minecraft:particle_appearance_tinting": color("0.7 + variable.particle_random_2 * 0.3", "0.9 + variable.particle_random_2 * 0.1", 1.0, f"0.8 * {FADE_INOUT}"),
})
flash("gojo:transform_flash", WHITE, 4.5, 0.4)
effect("gojo:transform_pillar", "streak", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
    "minecraft:particle_appearance_billboard": billboard(f"1.4 * {FADE}", "9", "streak", facing="lookat_y"),
    "minecraft:particle_appearance_tinting": color(0.75, 0.92, 1.0),
})
burst("gojo:transform_burst", "spark", BLUE_L, 40, "math.random(3, 8)", "math.random(0.6, 1.1)", 0.3, drag=2, gravity=2.5,
      radius=0.6, events={"flash": "gojo:transform_flash", "pillar": "gojo:transform_pillar"})


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".json"):
            os.remove(os.path.join(OUT, f))
    for ident, data in effects.items():
        name = ident.split(":")[1] + ".json"
        with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
    print("particles generated:", len(effects))


if __name__ == "__main__":
    main()

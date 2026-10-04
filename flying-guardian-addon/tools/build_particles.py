"""Writes the Flying Guardian particle effects (RP/particles/*.json).

Only vanilla textures are used (textures/particle/particles and textures/flame_atlas), with UV
coordinates copied from vanilla particle definitions of the same game version.
"""

import json
import os

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ADDON, "FlyingGuardian_RP", "particles")

PARTICLES_TEX = "textures/particle/particles"
FLAME_TEX = "textures/flame_atlas"

AGE = "variable.particle_age / variable.particle_lifetime"

# Sprites (vanilla UVs)
EMBER_UV = {"texture_width": 128, "texture_height": 128, "uv": [10, 26], "uv_size": [4, 4]}
HEART_UV = {"texture_width": 128, "texture_height": 128, "uv": [0, 40], "uv_size": [8, 8]}
SMOKE_UV = {
    "texture_width": 128,
    "texture_height": 128,
    "flipbook": {"base_UV": [56, 0], "size_UV": [8, 8], "step_UV": [-8, 0], "frames_per_second": 8,
                 "max_frame": 8, "stretch_to_lifetime": True, "loop": False},
}
CRIT_UV = {
    "texture_width": 128,
    "texture_height": 128,
    "flipbook": {"base_UV": [0, 72], "size_UV": [8, 8], "step_UV": [8, 0], "frames_per_second": 8,
                 "max_frame": 8, "stretch_to_lifetime": True, "loop": False},
}
FLAME_UV = {
    "texture_width": 1,
    "texture_height": 32,
    "flipbook": {"base_UV": [0, 0], "size_UV": [1, 1], "step_UV": [0, 1], "frames_per_second": 32,
                 "max_frame": 32, "stretch_to_lifetime": True, "loop": False},
}

FIRE_GRADIENT = {
    "gradient": [[1.0, 0.92, 0.45, 1.0], [1.0, 0.45, 0.08, 1.0], [0.55, 0.06, 0.02, 1.0]],
    "interpolant": AGE,
}


def effect(identifier, texture, components, material="particles_alpha"):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
                "basic_render_parameters": {"material": material, "texture": texture},
            },
            "components": components,
        },
    }


def billboard(size, uv, mode="lookat_xyz"):
    return {"size": [size, size], "facing_camera_mode": mode, "uv": uv}


def shrink(start, end=0.0):
    """Size that interpolates linearly from start to end over the particle's life."""
    return f"({start}) + (({end}) - ({start})) * ({AGE})"


EFFECTS = {
    # Slow embers rising around the body (looping, bound to the "core" locator).
    "aura_embers": effect("fguard:aura_embers", PARTICLES_TEX, {
        "minecraft:emitter_rate_steady": {"spawn_rate": 7, "max_particles": 24},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 1.1, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.1, 0.4)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.9, 1.7)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.1, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.09 + variable.particle_random_1 * 0.05", "0.01"), EMBER_UV),
        "minecraft:particle_appearance_tinting": {"color": FIRE_GRADIENT},
    }),
    # Wisps of dark smoke drifting off the creature (looping).
    "aura_smoke": effect("fguard:aura_smoke", PARTICLES_TEX, {
        "minecraft:emitter_rate_steady": {"spawn_rate": 3, "max_particles": 12},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.9, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.05, 0.25)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.2)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.35, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": billboard("0.22 + variable.particle_random_1 * 0.12", SMOKE_UV),
        "minecraft:particle_appearance_tinting": {"color": [0.14, 0.08, 0.1, 0.9]},
        "minecraft:particle_appearance_lighting": {},
    }),
    # Embers shed from the wing tips during fast flight (looping while flying fast).
    "wing_embers": effect("fguard:wing_embers", PARTICLES_TEX, {
        "minecraft:emitter_rate_steady": {"spawn_rate": 9, "max_particles": 20},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.1, 0.5)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.8)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -1.5, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.07", "0.01"), EMBER_UV),
        "minecraft:particle_appearance_tinting": {"color": FIRE_GRADIENT},
    }),
    # Burst of hot sparks from the claws when the guardian swings.
    "claw_slash": effect("fguard:claw_slash", PARTICLES_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 12},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(2.0, 4.5)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2, 0.45)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 4},
        "minecraft:particle_appearance_billboard": billboard("0.11 + variable.particle_random_1 * 0.05", CRIT_UV),
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.36, 0.08, 1.0]},
    }),
    # Impact sparks where a claw strike lands (spawned by the script).
    "claw_impact": effect("fguard:claw_impact", PARTICLES_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 18},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(3.0, 6.5)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.5)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 5},
        "minecraft:particle_appearance_billboard": billboard("0.13 + variable.particle_random_1 * 0.06", CRIT_UV),
        "minecraft:particle_appearance_tinting": {"color": {
            "gradient": [[1.0, 0.85, 0.4, 1.0], [1.0, 0.25, 0.05, 1.0]], "interpolant": AGE}},
    }),
    # Hearts when the guardian is tamed.
    "tame_hearts": effect("fguard:tame_hearts", PARTICLES_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 1.0, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.4, 1.2)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.8)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": billboard("0.24 + variable.particle_random_1 * 0.1", HEART_UV),
    }),
    # Ring of infernal fire that bursts outward when tamed.
    "tame_ring": effect("fguard:tame_ring", FLAME_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 36},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.4, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(2.5, 3.5)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 0.9)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.35", "0.1"), FLAME_UV),
    }),
    # Fire trail while performing the Infernal Dive.
    "dive_trail": effect("fguard:dive_trail", FLAME_TEX, {
        "minecraft:emitter_rate_steady": {"spawn_rate": 28, "max_particles": 40},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.0, 0.3)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.35, 0.6)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.0, 0]},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.5", "0.15"), FLAME_UV),
    }),
    # Fire burst when a dive starts or the guardian teleports to its owner (script).
    "dive_burst": effect("fguard:dive_burst", FLAME_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 20},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "surface_only": False, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(1.5, 3.0)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.7)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.5, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.45", "0.1"), FLAME_UV),
    }),
    # Expanding ring of fire on dive impact (script).
    "shockwave": effect("fguard:shockwave", FLAME_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 48},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.5, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(7.0, 9.0)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.6)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 4.5},
        "minecraft:particle_appearance_billboard": billboard(shrink("0.55", "0.2"), FLAME_UV),
    }),
    # Dark smoke ring that follows the shockwave (script).
    "shockwave_smoke": effect("fguard:shockwave_smoke", PARTICLES_TEX, {
        "minecraft:emitter_rate_instant": {"num_particles": 24},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.8, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(4.0, 6.0)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.1)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 3.5},
        "minecraft:particle_appearance_billboard": billboard("0.4 + variable.particle_random_1 * 0.2", SMOKE_UV),
        "minecraft:particle_appearance_tinting": {"color": [0.16, 0.1, 0.11, 0.95]},
        "minecraft:particle_appearance_lighting": {},
    }),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, data in EFFECTS.items():
        with open(os.path.join(OUT, f"{name}.json"), "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    print(f"wrote {len(EFFECTS)} particle effects")


if __name__ == "__main__":
    main()

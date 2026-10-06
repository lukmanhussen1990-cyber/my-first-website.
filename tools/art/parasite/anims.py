"""pas:parasite animations, animation controllers and client-entity script data.

Only Molang queries/functions that appear in the 1.21.0.26 documentation
(Molang.html) or in that build's vanilla resource-pack files are used:
query.anim_time, query.life_time, query.modified_distance_moved,
query.modified_move_speed, query.target_x_rotation, query.target_y_rotation,
query.has_target, query.hurt_time, query.is_alive, query.all_animations_finished,
variable.attack_time (engine variable; vanilla hoglin/zoglin/zombie use it),
math.sin/cos/abs/clamp/min/max/pow.

Rotation signs (tools/georender/README.md):
  x +  : bone front pitches down (jaw opens, head nods down)
  y +  : right legs' tips swing backward, left legs' tips swing forward
  z +  : right legs' tips rise, left legs' tips sink
"""
from __future__ import annotations

LEGS = ("fr", "fl", "br", "bl")

# ---------------------------------------------------------------------------
# client entity script data
# ---------------------------------------------------------------------------

PRE_ANIMATION = [
    "variable.pas_hurt = math.clamp(query.hurt_time / 10.0, 0.0, 1.0);",
    "variable.pas_twitch = math.pow(math.max(0.0, math.sin(query.life_time * 97.0)), 24.0);",
    "variable.pas_walk = math.min(1.0, query.modified_move_speed * 1.4);",
]

ENTITY_ANIMATIONS = {
    "idle": "animation.pas_parasite.idle",
    "walk": "animation.pas_parasite.walk",
    "look_at_target": "animation.pas_parasite.look_at_target",
    "hunt": "animation.pas_parasite.hunt",
    "attack": "animation.pas_parasite.attack",
    "hurt": "animation.pas_parasite.hurt",
    "death": "animation.pas_parasite.death",
    "move_controller": "controller.animation.pas_parasite.move",
    "attack_controller": "controller.animation.pas_parasite.attack",
    "life_controller": "controller.animation.pas_parasite.life",
}


def _f(x: float) -> str:
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


# ---------------------------------------------------------------------------
# walk: angular alternating crawl, diagonal pairs (fr+bl) / (fl+br)
# ---------------------------------------------------------------------------
WALK_FREQ = 45.0          # degrees of gait phase per unit of modified_distance_moved (period 8 units)
SWEEP = 24.0              # forward/back sweep of the upper legs (degrees)
LIFT = 20.0               # lift of the upper legs during the swing
KNEE = 16.0               # extra knee fold during the swing
PHASE = {"fr": 0.0, "bl": 0.0, "fl": 180.0, "br": 180.0}


def _theta(phase: float) -> str:
    return f"(query.anim_time * {_f(WALK_FREQ)} + {_f(phase)})" if phase else f"(query.anim_time * {_f(WALK_FREQ)})"


def walk_animation():
    bones = {}
    for leg in LEGS:
        th = _theta(PHASE[leg])
        right = leg[1] == "r"
        sgn = 1 if right else -1
        # 'fwd' holds at the ends of the stroke (clamped) -> jerky, insect-like strokes
        fwd = f"math.clamp(math.cos{th} * 1.5, -1.0, 1.0)"
        lift = f"math.clamp(-math.sin{th} * 1.8, 0.0, 1.0)"
        bones[f"leg_{leg}_upper"] = {
            "rotation": [0.0, f"{_f(-SWEEP * sgn)} * {fwd}", f"{_f(LIFT * sgn)} * {lift}"],
        }
        bones[f"leg_{leg}_lower"] = {
            "rotation": [0.0, 0.0, f"{_f(-KNEE * sgn)} * {lift}"],
        }
        bones[f"leg_{leg}_claw"] = {
            "rotation": [f"{lift} * -25.0" if leg[0] == "f" else f"{lift} * 25.0", 0.0, 0.0],
        }
    th = _theta(0.0)
    bones["body"] = {
        "rotation": [f"math.sin(query.anim_time * {_f(2 * WALK_FREQ)}) * 1.5", f"math.cos{th} * 4.0", f"math.sin{th} * 3.5"],
        "position": [0.0, f"-math.abs(math.cos{th}) * 0.6", 0.0],
    }
    bones["head"] = {"rotation": [f"math.abs(math.sin{th}) * 3.0", f"-math.cos{th} * 3.0", f"-math.sin{th} * 2.5"]}
    bones["jaw"] = {"rotation": [f"math.abs(math.sin{th}) * 5.0", 0.0, 0.0]}
    bones["drips"] = {"rotation": [f"math.cos{th} * 10.0", 0.0, f"math.sin{th} * 6.0"]}
    return {"loop": True, "anim_time_update": "query.modified_distance_moved", "bones": bones}


def idle_animation():
    tw = "variable.pas_twitch"
    return {
        "loop": True,
        "bones": {
            # slow breathing heave of the body (carries the head)
            "body": {
                "rotation": ["math.sin(query.life_time * 110.0) * 1.2", 0.0, 0.0],
                "position": [0.0, "math.sin(query.life_time * 110.0) * 0.25", 0.0],
                "scale": [1.0, "1.0 + math.sin(query.life_time * 110.0 + 40.0) * 0.025", 1.0],
            },
            # sudden head twitches every ~3.7 s plus a constant small shiver
            "head": {
                "rotation": [
                    f"math.sin(query.life_time * 1430.0) * 0.6 - {tw} * 9.0",
                    f"{tw} * math.sin(query.life_time * 47.0) * 14.0",
                    f"{tw} * math.cos(query.life_time * 31.0) * 16.0 + math.sin(query.life_time * 70.0) * 2.0",
                ],
            },
            # mouth hangs open and trembles
            "jaw": {"rotation": ["11.0 + math.sin(query.life_time * 1900.0) * 1.0 + math.sin(query.life_time * 130.0) * 2.5", 0.0, 0.0]},
            "drips": {"rotation": ["math.sin(query.life_time * 150.0) * 5.0", 0.0, "math.sin(query.life_time * 113.0) * 4.0"]},
            # restless claws
            "leg_fr_claw": {"rotation": ["math.sin(query.life_time * 260.0) * 4.0", 0.0, 0.0]},
            "leg_fl_claw": {"rotation": ["math.sin(query.life_time * 260.0 + 120.0) * 4.0", 0.0, 0.0]},
            "leg_fr_upper": {"rotation": [0.0, 0.0, "math.sin(query.life_time * 90.0) * 1.5"]},
            "leg_fl_upper": {"rotation": [0.0, 0.0, "math.sin(query.life_time * 90.0 + 90.0) * -1.5"]},
        },
    }


def look_animation():
    return {
        "loop": True,
        "bones": {
            "head": {"rotation": [
                "math.clamp(query.target_x_rotation, -35.0, 25.0)",
                "math.clamp(query.target_y_rotation, -50.0, 50.0)",
                0.0,
            ]},
        },
    }


def hunt_animation():
    """Stance while the parasite has a target: low, head up, mouth wider, front legs spread."""
    return {
        "loop": True,
        "bones": {
            "body": {"rotation": [6.0, 0.0, 0.0], "position": [0.0, -0.8, 0.0]},
            "head": {"rotation": [-10.0, 0.0, 0.0]},
            "jaw": {"rotation": ["10.0 + math.sin(query.life_time * 2600.0) * 2.0", 0.0, 0.0]},
            "leg_fr_upper": {"rotation": [0.0, -6.0, 6.0]},
            "leg_fl_upper": {"rotation": [0.0, 6.0, -6.0]},
            "leg_br_upper": {"rotation": [0.0, 4.0, -3.0]},
            "leg_bl_upper": {"rotation": [0.0, -4.0, 3.0]},
        },
    }


def _kf(pairs):
    """{time: value} keyframes; values are [x, y, z]."""
    return {_f(t): v for t, v in pairs}


ATTACK_LEN = 0.55


def attack_animation():
    """Lunge: rear back (0.12 s), strike forward with the jaw wide and the front
    talons slamming down (0.26 s), recover (0.55 s)."""
    z3 = [0.0, 0.0, 0.0]
    return {
        "loop": False,
        "animation_length": ATTACK_LEN,
        "bones": {
            "body": {
                "rotation": _kf([(0, z3), (0.12, [-14.0, 0.0, 0.0]), (0.26, [7.0, 0.0, 0.0]), (0.4, [4.0, 0.0, 0.0]), (ATTACK_LEN, z3)]),
                "position": _kf([(0, z3), (0.12, [0.0, 1.2, 1.5]), (0.26, [0.0, -0.2, -3.5]), (0.4, [0.0, 0.0, -2.0]), (ATTACK_LEN, z3)]),
            },
            "head": {
                "rotation": _kf([(0, z3), (0.12, [-24.0, 0.0, 0.0]), (0.26, [8.0, 0.0, 0.0]), (0.4, [4.0, 0.0, 0.0]), (ATTACK_LEN, z3)]),
            },
            # gape during the lunge, snap shut on contact (bite), relax
            "jaw": {
                "rotation": _kf([(0, z3), (0.1, [34.0, 0.0, 0.0]), (0.2, [40.0, 0.0, 0.0]), (0.26, [-9.0, 0.0, 0.0]),
                                 (0.36, [8.0, 0.0, 0.0]), (ATTACK_LEN, z3)]),
            },
            "leg_fr_upper": {
                "rotation": _kf([(0, z3), (0.12, [0.0, -22.0, 42.0]), (0.26, [0.0, -34.0, -2.0]), (0.4, [0.0, -18.0, -2.0]), (ATTACK_LEN, z3)]),
                "position": _kf([(0, z3), (0.26, [0.0, 0.0, -2.5]), (ATTACK_LEN, z3)]),
            },
            "leg_fl_upper": {
                "rotation": _kf([(0, z3), (0.12, [0.0, 22.0, -42.0]), (0.26, [0.0, 34.0, 2.0]), (0.4, [0.0, 18.0, 2.0]), (ATTACK_LEN, z3)]),
                "position": _kf([(0, z3), (0.26, [0.0, 0.0, -2.5]), (ATTACK_LEN, z3)]),
            },
            "leg_fr_lower": {
                "rotation": _kf([(0, z3), (0.12, [0.0, 0.0, -30.0]), (0.26, [0.0, 0.0, 12.0]), (ATTACK_LEN, z3)]),
            },
            "leg_fl_lower": {
                "rotation": _kf([(0, z3), (0.12, [0.0, 0.0, 30.0]), (0.26, [0.0, 0.0, -12.0]), (ATTACK_LEN, z3)]),
            },
            "leg_fr_claw": {"rotation": _kf([(0, z3), (0.12, [-30.0, 0.0, 0.0]), (0.26, [20.0, 0.0, 0.0]), (ATTACK_LEN, z3)])},
            "leg_fl_claw": {"rotation": _kf([(0, z3), (0.12, [-30.0, 0.0, 0.0]), (0.26, [20.0, 0.0, 0.0]), (ATTACK_LEN, z3)])},
            # back legs shove
            "leg_br_upper": {"rotation": _kf([(0, z3), (0.26, [0.0, 10.0, -5.0]), (ATTACK_LEN, z3)])},
            "leg_bl_upper": {"rotation": _kf([(0, z3), (0.26, [0.0, -10.0, 5.0]), (ATTACK_LEN, z3)])},
        },
    }


def hurt_animation():
    """Flinch, weighted by variable.pas_hurt (hurt_time 10 -> 0 ticks)."""
    return {
        "loop": True,
        "bones": {
            "body": {"rotation": [-7.0, 0.0, 4.0], "position": [0.0, 0.4, 1.0]},
            "head": {"rotation": [-14.0, 6.0, -8.0]},
            "jaw": {"rotation": [20.0, 0.0, 0.0]},
            "leg_fr_upper": {"rotation": [0.0, 0.0, 10.0]},
            "leg_fl_upper": {"rotation": [0.0, 0.0, -10.0]},
        },
    }


DEATH_LEN = 0.6


def death_animation():
    """Legs curl in like a dead insect, mouth gapes; the engine's default death
    roll (90 degrees onto the side) is applied on top."""
    bones = {}
    for leg in LEGS:
        sgn = 1 if leg[1] == "r" else -1
        bones[f"leg_{leg}_upper"] = {"rotation": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [0.0, 0.0, 12.0 * sgn])])}
        bones[f"leg_{leg}_lower"] = {"rotation": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [0.0, 0.0, -85.0 * sgn])])}
        bones[f"leg_{leg}_claw"] = {"rotation": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [0.0, 0.0, -50.0 * sgn])])}
    bones["jaw"] = {"rotation": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [26.0, 0.0, 0.0])])}
    bones["head"] = {"rotation": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [-6.0, 0.0, 12.0])])}
    bones["body"] = {"position": _kf([(0, [0.0, 0.0, 0.0]), (DEATH_LEN, [0.0, -3.5, 0.0])])}
    return {"loop": "hold_on_last_frame", "animation_length": DEATH_LEN, "bones": bones}


def animation_file():
    return {
        "format_version": "1.8.0",
        "animations": {
            "animation.pas_parasite.idle": idle_animation(),
            "animation.pas_parasite.walk": walk_animation(),
            "animation.pas_parasite.look_at_target": look_animation(),
            "animation.pas_parasite.hunt": hunt_animation(),
            "animation.pas_parasite.attack": attack_animation(),
            "animation.pas_parasite.hurt": hurt_animation(),
            "animation.pas_parasite.death": death_animation(),
        },
    }


ATTACK_START = "variable.attack_time > 0.0"


def controller_file():
    return {
        "format_version": "1.10.0",
        "animation_controllers": {
            "controller.animation.pas_parasite.move": {
                "initial_state": "default",
                "states": {
                    "default": {
                        "animations": ["idle", {"walk": "variable.pas_walk"}, "look_at_target"],
                    },
                },
            },
            "controller.animation.pas_parasite.attack": {
                "initial_state": "default",
                "states": {
                    "default": {
                        "transitions": [{"attack": ATTACK_START}, {"hunting": "query.has_target"}],
                        "blend_transition": 0.3,
                    },
                    "hunting": {
                        "animations": ["hunt"],
                        "transitions": [{"attack": ATTACK_START}, {"default": "!query.has_target"}],
                        "blend_transition": 0.3,
                    },
                    "attack": {
                        "animations": ["attack"],
                        "transitions": [
                            {"hunting": "query.all_animations_finished && query.has_target"},
                            {"default": "query.all_animations_finished && !query.has_target"},
                        ],
                        "blend_transition": 0.1,
                    },
                },
            },
            "controller.animation.pas_parasite.life": {
                "initial_state": "alive",
                "states": {
                    "alive": {
                        "animations": [{"hurt": "variable.pas_hurt"}],
                        "transitions": [{"dead": "!query.is_alive"}],
                    },
                    "dead": {
                        "animations": ["death"],
                        "transitions": [{"alive": "query.is_alive"}],
                        "blend_transition": 0.2,
                    },
                },
            },
        },
    }

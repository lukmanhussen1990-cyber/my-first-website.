"""Writes the Flying Guardian client animations and animation controllers.

Procedural channels are written with a tiny expression DSL so the very same expressions can be
(a) emitted as Molang for the game and (b) evaluated in Python to render preview poses.

Client variables (set in the client entity's pre_animation script):
    variable.flap_phase  wing-beat phase in degrees, advancing faster in fast flight
    variable.fly_amount  0 = hovering in place, 1 = fast flight (smoothed modified_move_speed)
Engine-provided: variable.attack_time (0..1 during a melee swing), query.* values.
"""

import json
import math
import os

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RP = os.path.join(ADDON, "FlyingGuardian_RP")
PREFIX = "animation.fguard.flying_guardian"
CTRL = "controller.animation.fguard.flying_guardian"


# ---------------------------------------------------------------------------------------------
# Expression DSL
# ---------------------------------------------------------------------------------------------
class E:
    def __add__(self, o):
        return Op("+", self, lift(o))

    def __radd__(self, o):
        return Op("+", lift(o), self)

    def __sub__(self, o):
        return Op("-", self, lift(o))

    def __rsub__(self, o):
        return Op("-", lift(o), self)

    def __mul__(self, o):
        return Op("*", self, lift(o))

    def __rmul__(self, o):
        return Op("*", lift(o), self)

    def __neg__(self):
        return Op("*", Const(-1), self)


def lift(v):
    return v if isinstance(v, E) else Const(v)


class Const(E):
    def __init__(self, v):
        self.v = float(v)

    def molang(self):
        v = round(self.v, 4)
        return str(int(v)) if v == int(v) else str(v)

    def eval(self, env):
        return self.v


class Var(E):
    def __init__(self, name):
        self.name = name

    def molang(self):
        return self.name

    def eval(self, env):
        return env[self.name]


class Op(E):
    def __init__(self, op, a, b):
        self.op, self.a, self.b = op, a, b

    def molang(self):
        return f"({self.a.molang()} {self.op} {self.b.molang()})"

    def eval(self, env):
        a, b = self.a.eval(env), self.b.eval(env)
        return a + b if self.op == "+" else a - b if self.op == "-" else a * b


class Fn(E):
    def __init__(self, name, arg):
        self.name, self.arg = name, lift(arg)

    def molang(self):
        return f"math.{self.name}({self.arg.molang()})"

    def eval(self, env):
        x = self.arg.eval(env)
        return math.sin(math.radians(x)) if self.name == "sin" else math.cos(math.radians(x))


def sin(x):
    return Fn("sin", x)


def cos(x):
    return Fn("cos", x)


P = Var("variable.flap_phase")
F = Var("variable.fly_amount")
T = Var("query.life_time")


def vec(x=0, y=0, z=0):
    return [lift(x), lift(y), lift(z)]


def mol(v):
    out = []
    for e in v:
        if isinstance(e, Const):
            out.append(round(e.v, 4) if e.v != int(e.v) else int(e.v))
        else:
            out.append(e.molang())
    return out


def mirror(v):
    """Left-side channel from a right-side rotation: Y and Z rotations flip sign."""
    x, y, z = v
    return [x, -y if not isinstance(y, Const) or y.v != 0 else y, -z if not isinstance(z, Const) or z.v != 0 else z]


def sym(channels, name, rotation=None, position=None):
    """Add a right-side bone channel and its mirrored left-side twin."""
    if rotation is not None:
        channels.setdefault(name, {})["rotation"] = rotation
        channels.setdefault(name.replace("right", "left"), {})["rotation"] = mirror(rotation)
    if position is not None:
        channels.setdefault(name, {})["position"] = position
        x, y, z = position
        channels.setdefault(name.replace("right", "left"), {})["position"] = [-x, y, z]


# ---------------------------------------------------------------------------------------------
# Procedural (looping) animations
# ---------------------------------------------------------------------------------------------
def flight_channels():
    s, c = sin(P), cos(P)
    ch = {}
    ch["root"] = {"position": vec(0, -0.9 * s * (1 - 0.5 * F), 0)}
    ch["body"] = {"rotation": vec(6 + 24 * F + 2.5 * c, 0, 0)}
    ch["head"] = {"rotation": vec(-4 - 18 * F - 2 * c, 0, 0)}
    ch["jaw"] = {"rotation": vec(2 + 2 * sin(T * 60), 0, 0)}
    sym(ch, "right_wing", rotation=vec(6 * c - 6 * F, 0, -(30 + 10 * F) * s - 4))
    sym(ch, "right_wing_tip", rotation=vec(0, 0, -(22 + 8 * F) * sin(P - 45) - 2))
    sym(ch, "right_arm", rotation=vec(-12 - 28 * F + 5 * c, 0, -3 - 3 * s))
    sym(ch, "right_forearm", rotation=vec(-10 - 25 * F - 4 * c, 0, 0))
    sym(ch, "right_hand", rotation=vec(-6 - 10 * F, 0, 0))
    ch["right_leg"] = {"rotation": vec(12 + 42 * F + 5 * sin(P + 40), 0, -2)}
    ch["left_leg"] = {"rotation": vec(12 + 42 * F + 5 * sin(P + 80), 0, 2)}
    ch["right_shin"] = {"rotation": vec(8 + 20 * F + 4 * sin(P + 100), 0, 0)}
    ch["left_shin"] = {"rotation": vec(8 + 20 * F + 4 * sin(P + 140), 0, 0)}
    sym(ch, "right_foot", rotation=vec(10 * F, 0, 0))
    ch["tail"] = {"rotation": vec(18 * F + 4 * s, 10 * sin(T * 110), 0)}
    ch["tail2"] = {"rotation": vec(6 * F + 5 * sin(P - 60), 12 * sin(T * 110 - 50), 0)}
    ch["tail3"] = {"rotation": vec(4 * sin(P - 120), 14 * sin(T * 110 - 100), 0)}
    ch["tail_tip"] = {"rotation": vec(0, 10 * sin(T * 110 - 150), 0)}
    return ch


def sit_channels():
    breathe = sin(T * 80)
    ch = {}
    ch["root"] = {"position": vec(0, 0.7 * breathe, 0)}
    ch["body"] = {"rotation": vec(12 + 1.5 * breathe, 0, 0)}
    ch["head"] = {"rotation": vec(-8, 0, 0)}
    ch["jaw"] = {"rotation": vec(1 + 2 * sin(T * 60), 0, 0)}
    sym(ch, "right_wing", rotation=vec(28, 0, 40 + 3 * breathe))
    sym(ch, "right_wing_tip", rotation=vec(0, 0, 70))
    sym(ch, "right_arm", rotation=vec(-18 + 2 * breathe, 0, 6))
    sym(ch, "right_forearm", rotation=vec(-32, 0, 0))
    sym(ch, "right_hand", rotation=vec(-12, 0, 0))
    sym(ch, "right_leg", rotation=vec(-38, 0, -6))
    sym(ch, "right_shin", rotation=vec(68, 0, 0))
    sym(ch, "right_foot", rotation=vec(-20, 0, 0))
    ch["tail"] = {"rotation": vec(28, 6 * sin(T * 50), 0)}
    ch["tail2"] = {"rotation": vec(18, 8 * sin(T * 50 - 40), 0)}
    ch["tail3"] = {"rotation": vec(16, 0, 0)}
    return ch


def dive_channels():
    flutter = sin(T * 900)
    ch = {}
    ch["body"] = {"rotation": vec(55, 0, 0)}
    ch["head"] = {"rotation": vec(-45, 0, 0)}
    ch["jaw"] = {"rotation": vec(22, 0, 0)}
    sym(ch, "right_wing", rotation=vec(35, 0, 24 + 4 * flutter))
    sym(ch, "right_wing_tip", rotation=vec(0, 0, 32))
    sym(ch, "right_arm", rotation=vec(-115, 0, -10))
    sym(ch, "right_forearm", rotation=vec(-15, 0, 0))
    sym(ch, "right_hand", rotation=vec(-25, 0, 0))
    sym(ch, "right_leg", rotation=vec(50, 0, -4))
    sym(ch, "right_shin", rotation=vec(35, 0, 0))
    ch["tail"] = {"rotation": vec(40, 0, 0)}
    ch["tail2"] = {"rotation": vec(10, 0, 0)}
    ch["tail3"] = {"rotation": vec(5, 0, 0)}
    return ch


def to_bones(channels):
    bones = {}
    for bone, props in channels.items():
        bones[bone] = {k: mol(v) for k, v in props.items()}
    return bones


# ---------------------------------------------------------------------------------------------
# Keyframed animations
# ---------------------------------------------------------------------------------------------
def kf(frames):
    def key(t):
        s = f"{t:.2f}".rstrip("0")
        return s + "0" if s.endswith(".") else s

    return {key(t): v for t, v in frames}


def mirror_kf(frames):
    return [(t, [x, -y if y else 0, -z if z else 0]) for t, (x, y, z) in frames]


ATTACK_RIGHT_ARM = [(0.0, [0, 0, 0]), (0.2, [-150, 0, -30]), (0.45, [-45, 0, 25]), (0.7, [-35, 0, 15]), (1.0, [0, 0, 0])]
ATTACK_LEFT_ARM_R = [(0.0, [0, 0, 0]), (0.3, [-140, 0, -30]), (0.55, [-40, 0, 25]), (0.8, [-30, 0, 10]), (1.0, [0, 0, 0])]


def attack_animation():
    return {
        "loop": True,
        "animation_length": 1.0,
        "anim_time_update": "math.clamp(variable.attack_time, 0.0, 1.0)",
        "bones": {
            "right_arm": {"rotation": kf(ATTACK_RIGHT_ARM)},
            "right_forearm": {"rotation": kf([(0.0, [0, 0, 0]), (0.2, [-40, 0, 0]), (0.45, [10, 0, 0]), (1.0, [0, 0, 0])])},
            "left_arm": {"rotation": kf(mirror_kf(ATTACK_LEFT_ARM_R))},
            "left_forearm": {"rotation": kf([(0.0, [0, 0, 0]), (0.3, [-40, 0, 0]), (0.55, [10, 0, 0]), (1.0, [0, 0, 0])])},
            "body": {"rotation": kf([(0.0, [0, 0, 0]), (0.2, [-8, 0, 0]), (0.5, [18, 0, 0]), (1.0, [0, 0, 0])])},
            "head": {"rotation": kf([(0.0, [0, 0, 0]), (0.2, [-15, 0, 0]), (0.5, [12, 0, 0]), (1.0, [0, 0, 0])])},
            "jaw": {"rotation": kf([(0.0, [0, 0, 0]), (0.25, [28, 0, 0]), (0.6, [20, 0, 0]), (1.0, [0, 0, 0])])},
            "right_wing": {"rotation": kf([(0.0, [0, 0, 0]), (0.2, [0, 0, -25]), (0.5, [0, 0, 15]), (1.0, [0, 0, 0])])},
            "left_wing": {"rotation": kf(mirror_kf([(0.0, [0, 0, 0]), (0.2, [0, 0, -25]), (0.5, [0, 0, 15]), (1.0, [0, 0, 0])]))},
        },
    }


def tame_animation():
    wing = [(0.0, [0, 0, 0]), (0.3, [0, 0, -32]), (1.4, [0, 0, -30]), (2.0, [0, 0, 0])]
    arm = [(0.0, [0, 0, 0]), (0.3, [-20, 0, -45]), (1.4, [-20, 0, -40]), (2.0, [0, 0, 0])]
    return {
        "loop": False,
        "animation_length": 2.0,
        "bones": {
            "head": {"rotation": kf([(0.0, [0, 0, 0]), (0.3, [-28, 0, 0]), (1.3, [-22, 0, 0]), (2.0, [0, 0, 0])])},
            "jaw": {"rotation": kf([(0.0, [0, 0, 0]), (0.3, [35, 0, 0]), (1.3, [30, 0, 0]), (2.0, [0, 0, 0])])},
            "body": {"rotation": kf([(0.0, [0, 0, 0]), (0.3, [-10, 0, 0]), (1.4, [-8, 0, 0]), (2.0, [0, 0, 0])])},
            "right_wing": {"rotation": kf(wing)},
            "left_wing": {"rotation": kf(mirror_kf(wing))},
            "right_arm": {"rotation": kf(arm)},
            "left_arm": {"rotation": kf(mirror_kf(arm))},
        },
        "particle_effects": {
            "0.0": [{"effect": "tame_hearts", "locator": "core"}, {"effect": "tame_ring", "locator": "core"}],
            "0.7": [{"effect": "tame_hearts", "locator": "eyes"}],
        },
        "sound_effects": {
            "0.0": [{"effect": "tame"}],
            "0.15": [{"effect": "roar"}],
        },
    }


def animations():
    return {
        "format_version": "1.8.0",
        "animations": {
            f"{PREFIX}.look_at_target": {
                "loop": True,
                "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}},
            },
            f"{PREFIX}.flight": {"loop": True, "bones": to_bones(flight_channels())},
            f"{PREFIX}.sit": {"loop": True, "bones": to_bones(sit_channels())},
            f"{PREFIX}.dive": {"loop": True, "bones": to_bones(dive_channels())},
            f"{PREFIX}.attack": attack_animation(),
            f"{PREFIX}.tame_celebration": tame_animation(),
        },
    }


def controllers():
    diving = "query.property('fguard:diving')"
    return {
        "format_version": "1.10.0",
        "animation_controllers": {
            f"{CTRL}.move": {
                "initial_state": "flying",
                "states": {
                    "flying": {
                        "animations": ["flight"],
                        "transitions": [{"sitting": "query.is_sitting"}, {"diving": diving}],
                        "blend_transition": 0.35,
                    },
                    "sitting": {
                        "animations": ["sit"],
                        "transitions": [{"flying": "!query.is_sitting"}],
                        "blend_transition": 0.5,
                    },
                    "diving": {
                        "animations": ["dive"],
                        "particle_effects": [{"effect": "dive_trail", "locator": "core"}],
                        "transitions": [{"flying": f"!{diving}"}],
                        "blend_transition": 0.2,
                    },
                },
            },
            f"{CTRL}.attack": {
                "initial_state": "default",
                "states": {
                    "default": {"transitions": [{"attacking": "variable.attack_time > 0.0"}]},
                    "attacking": {
                        "animations": ["attack"],
                        "particle_effects": [
                            {"effect": "claw_slash", "locator": "right_claws"},
                            {"effect": "claw_slash", "locator": "left_claws"},
                        ],
                        "sound_effects": [{"effect": "claw"}],
                        "transitions": [{"default": "variable.attack_time <= 0.0"}],
                        "blend_transition": 0.15,
                    },
                },
            },
            f"{CTRL}.aura": {
                "initial_state": "default",
                "states": {
                    "default": {
                        "particle_effects": [
                            {"effect": "aura_embers", "locator": "core"},
                            {"effect": "aura_smoke", "locator": "core"},
                        ]
                    }
                },
            },
            f"{CTRL}.wing_fx": {
                "initial_state": "calm",
                "states": {
                    "calm": {"transitions": [{"fast": "variable.fly_amount > 0.6 && !query.is_sitting"}]},
                    "fast": {
                        "particle_effects": [
                            {"effect": "wing_embers", "locator": "right_wing_end"},
                            {"effect": "wing_embers", "locator": "left_wing_end"},
                        ],
                        "transitions": [{"calm": "variable.fly_amount < 0.4 || query.is_sitting"}],
                    },
                },
            },
            f"{CTRL}.flap_sound": {
                "initial_state": "up",
                "states": {
                    "up": {"transitions": [{"down": "math.sin(variable.flap_phase) < -0.2 && !query.is_sitting"}]},
                    "down": {
                        "sound_effects": [{"effect": "flap"}],
                        "transitions": [{"up": "math.sin(variable.flap_phase) > 0.2"}],
                    },
                },
            },
            f"{CTRL}.tame": {
                "initial_state": "init",
                "states": {
                    "init": {"transitions": [{"tamed": "query.is_tamed"}, {"wild": "!query.is_tamed"}]},
                    "wild": {"transitions": [{"celebrate": "query.is_tamed"}]},
                    "celebrate": {
                        "animations": ["tame_celebration"],
                        "transitions": [{"tamed": "query.all_animations_finished"}],
                        "blend_transition": 0.3,
                    },
                    "tamed": {},
                },
            },
        },
    }


# ---------------------------------------------------------------------------------------------
# Pose evaluation for previews
# ---------------------------------------------------------------------------------------------
def evaluate(channels, env):
    pose = {}
    for bone, props in channels.items():
        pose[bone] = {k: tuple(lift(e).eval(env) for e in v) for k, v in props.items()}
    return pose


def keyframe_pose(anim, t):
    pose = {}
    for bone, props in anim["bones"].items():
        for key, frames in props.items():
            times = sorted((float(k), v) for k, v in frames.items())
            if t <= times[0][0]:
                val = times[0][1]
            elif t >= times[-1][0]:
                val = times[-1][1]
            else:
                for (t0, v0), (t1, v1) in zip(times, times[1:]):
                    if t0 <= t <= t1:
                        a = (t - t0) / (t1 - t0)
                        val = [v0[i] + (v1[i] - v0[i]) * a for i in range(3)]
                        break
            pose.setdefault(bone, {})[key] = tuple(val)
    return pose


def combine(*poses):
    out = {}
    for pose in poses:
        for bone, props in pose.items():
            for key, v in props.items():
                cur = out.setdefault(bone, {}).get(key, (0, 0, 0))
                out[bone][key] = tuple(a + b for a, b in zip(cur, v))
    return out


def main():
    os.makedirs(os.path.join(RP, "animations"), exist_ok=True)
    os.makedirs(os.path.join(RP, "animation_controllers"), exist_ok=True)
    with open(os.path.join(RP, "animations", "flying_guardian.animation.json"), "w") as f:
        json.dump(animations(), f, indent=2)
        f.write("\n")
    with open(os.path.join(RP, "animation_controllers", "flying_guardian.animation_controllers.json"), "w") as f:
        json.dump(controllers(), f, indent=2)
        f.write("\n")
    print("animations + controllers written")


if __name__ == "__main__":
    main()

"""Flying Guardian model definition.

Coordinates are Bedrock geometry units (1/16 block), origin at the feet, Y up.
The creature faces -Z (north); wings, spine spikes and tail are on the +Z side.

Rotation conventions verified against vanilla files:
  * X rotation: positive tilts an upward-pointing part forward (toward -Z);
    zombie arms point forward with X = -90.
  * Z rotation: right-handed in file space; a negative value swings a part on the -X side
    further out (vanilla humanoid "bob" uses negative Z on the right arm).
  * Y rotations are avoided entirely in the bind pose so the result does not depend on it.

Every cube carries a material key used by the texture painter. Parts on the +X side are
generated as mirror copies of the -X side ("right") parts.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Cube:
    lo: tuple  # (x0, y0, z0)
    hi: tuple  # (x1, y1, z1)
    mat: str
    pivot: Optional[tuple] = None
    rotation: Optional[tuple] = None
    faces: tuple = ("north", "east", "south", "west", "up", "down")
    tag: str = ""  # painter hint, e.g. "face", "chest"

    @property
    def size(self):
        return tuple(round(h - l, 4) for l, h in zip(self.lo, self.hi))


@dataclass
class Bone:
    name: str
    parent: Optional[str]
    pivot: tuple
    rotation: Optional[tuple] = None
    cubes: list = field(default_factory=list)
    locators: dict = field(default_factory=dict)


def box(x0, y0, z0, x1, y1, z1, mat, **kw):
    return Cube((x0, y0, z0), (x1, y1, z1), mat, **kw)


def plane_z(x0, y0, x1, y1, z, mat, **kw):
    """Zero-thickness membrane facing north/south. Only one face is emitted: the materials
    used are double sided, so a single face avoids z-fighting between two coplanar faces."""
    return Cube((x0, y0, z), (x1, y1, z), mat, faces=("north",), **kw)


def right_side_bones():
    """Bones on the -X side. Mirrored copies are created for +X."""
    bones = []

    # ---------------- arm ----------------
    arm = Bone("right_arm", "body", (-7.0, 29.5, 0.0), rotation=(-8.0, 0.0, -6.0))
    arm.cubes += [
        box(-10, 21, -2, -6, 30, 2, "skin", tag="limb"),
    ]
    bones.append(arm)

    forearm = Bone("right_forearm", "right_arm", (-8.0, 21.5, 0.0), rotation=(-14.0, 0.0, 0.0))
    forearm.cubes += [
        box(-10.5, 13, -2.5, -5.5, 22, 2.5, "skin", tag="forearm"),
        # elbow spike pointing back
        box(-8.5, 19, 2.5, -7.5, 20, 6.5, "horn", pivot=(-8, 19.5, 2.5), rotation=(15, 0, 0)),
        # blade-like spikes along the outer forearm
        box(-11.5, 16, -0.5, -10.5, 20, 0.5, "horn", pivot=(-11, 16, 0), rotation=(0, 0, -15)),
        box(-11.5, 13.5, -1.0, -10.5, 16.5, 0.0, "horn", pivot=(-11, 13.5, -0.5), rotation=(0, 0, -15)),
    ]
    bones.append(forearm)

    hand = Bone("right_hand", "right_forearm", (-8.0, 13.5, -0.5), rotation=(-10.0, 0.0, 0.0))
    hand.cubes += [
        box(-10.5, 10, -2.5, -5.5, 13, 1.5, "skin", tag="hand"),
    ]
    # Three long talons, curving forward, plus a thumb claw.
    for cx in (-10.0, -8.0, -6.0):
        hand.cubes.append(
            box(cx - 0.5, 4, -2.5, cx + 0.5, 10, -1.5, "claw", pivot=(cx, 10, -2), rotation=(-28, 0, 0), tag="talon")
        )
    hand.cubes.append(
        box(-5.5, 8, -3.5, -4.5, 12, -2.5, "claw", pivot=(-5, 12, -3), rotation=(-35, 0, 18), tag="talon")
    )
    hand.locators["right_claws"] = (-8.0, 6.0, -5.0)
    bones.append(hand)

    # ---------------- leg ----------------
    leg = Bone("right_leg", "body", (-3.0, 14.0, 0.0), rotation=(-18.0, 0.0, -4.0))
    leg.cubes += [box(-5.5, 8, -2.5, -0.5, 15, 2.5, "skin", tag="limb")]
    bones.append(leg)

    shin = Bone("right_shin", "right_leg", (-3.0, 8.5, 0.0), rotation=(40.0, 0.0, 0.0))
    shin.cubes += [
        box(-5.0, 2, -2.0, -1.0, 9, 2.0, "skin", tag="shin"),
        # bony knee spike
        box(-3.5, 7.5, -2.5, -2.5, 10.5, -1.5, "horn", pivot=(-3, 8, -2), rotation=(25, 0, 0)),
    ]
    bones.append(shin)

    foot = Bone("right_foot", "right_shin", (-3.0, 2.5, 0.0), rotation=(-12.0, 0.0, 0.0))
    foot.cubes += [box(-5.0, 0, -3.5, -1.0, 2, 1.5, "skin", tag="foot")]
    for cx in (-4.5, -3.0, -1.5):
        foot.cubes.append(box(cx - 0.5, 0, -5.5, cx + 0.5, 1, -3.5, "claw", tag="toe"))
    foot.cubes.append(box(-3.5, 0, 1.5, -2.5, 1, 3.0, "claw", tag="toe"))
    bones.append(foot)

    # ---------------- horns ----------------
    # Big crescent horns: out to the side, sweeping up and back, tips curling in and forward.
    h1 = Bone("right_horn", "head", (-3.5, 38.5, -1.5), rotation=(-25.0, 0.0, 58.0))
    h1.cubes += [box(-5, 38, -3, -2, 42, 0, "horn", tag="horn")]
    bones.append(h1)
    h2 = Bone("right_horn2", "right_horn", (-3.5, 41.5, -1.5), rotation=(-15.0, 0.0, -40.0))
    h2.cubes += [box(-4.5, 41, -2.5, -2.5, 45.5, -0.5, "horn", tag="horn")]
    bones.append(h2)
    h3 = Bone("right_horn3", "right_horn2", (-3.5, 45.0, -1.5), rotation=(-5.0, 0.0, -35.0))
    h3.cubes += [box(-4.5, 44.5, -2.5, -2.5, 48, -0.5, "horn", tag="horn")]
    bones.append(h3)
    h4 = Bone("right_horn4", "right_horn3", (-3.5, 47.5, -1.5), rotation=(30.0, 0.0, -28.0))
    h4.cubes += [box(-4, 47, -2, -3, 50.5, -1, "horn", tag="horn_tip")]
    bones.append(h4)

    # ---------------- wing ----------------
    wing = Bone("right_wing", "body", (-2.0, 29.0, 4.0), rotation=(20.0, 0.0, -18.0))
    wing.cubes += [
        # wing "humerus"
        box(-16, 28, 3, -2, 30, 5, "wingbone", tag="wingbone"),
        # spur where the wing meets the back
        box(-3, 30, 3.5, -2, 32, 4.5, "horn", pivot=(-2.5, 30, 4), rotation=(0, 0, 20)),
    ]
    # Inner membrane: strips from the body to the wing elbow with a gently scalloped edge.
    inner_bottoms = [(-4, -2, 16), (-6, -4, 15), (-8, -6, 14), (-10, -8, 14), (-12, -10, 15), (-14, -12, 15), (-16, -14, 14)]
    for x0, x1, yb in inner_bottoms:
        wing.cubes.append(plane_z(x0, yb, x1, 29, 4.0, "membrane", tag="membrane_inner"))
    wing.locators["right_wing_root"] = (-3.0, 29.0, 4.0)
    bones.append(wing)

    tip = Bone("right_wing_tip", "right_wing", (-16.0, 29.0, 4.0), rotation=(0.0, 0.0, -14.0))
    tip.cubes += [
        # outer wing bar (the long finger along the leading edge)
        box(-36, 28.5, 3.5, -16, 29.5, 4.5, "wingbone", tag="wingbone"),
        # thumb claw at the wing joint
        box(-16.5, 29.5, 3.5, -15.5, 33.5, 4.5, "claw", pivot=(-16, 29.5, 4), rotation=(10, 0, 25), tag="talon"),
        # finger bones radiating down/outward from the joint
        box(-16.5, 12, 3.5, -15.5, 29, 4.5, "wingbone", pivot=(-16, 29, 4), rotation=(0, 0, -17), tag="finger"),
        box(-16.5, 11, 3.5, -15.5, 29, 4.5, "wingbone", pivot=(-16, 29, 4), rotation=(0, 0, -41), tag="finger"),
        box(-16.5, 12, 3.5, -15.5, 29, 4.5, "wingbone", pivot=(-16, 29, 4), rotation=(0, 0, -62), tag="finger"),
        # hooked claw at the very tip
        box(-38, 28, 3.5, -35, 29, 4.5, "claw", pivot=(-36, 28.5, 4), rotation=(0, 0, 35), tag="talon"),
    ]
    # Outer membrane strips: scalloped trailing edge between the fingers.
    outer = [
        (-18, -16, 13), (-20, -18, 13), (-22, -20, 13),
        (-24, -22, 15), (-26, -24, 16), (-28, -26, 15),
        (-30, -28, 16), (-31, -30, 18), (-32, -31, 20), (-33, -32, 22), (-34, -33, 24), (-35, -34, 26), (-36, -35, 27),
    ]
    for x0, x1, yb in outer:
        tip.cubes.append(plane_z(x0, yb, x1, 29, 4.0, "membrane", tag="membrane_outer"))
    tip.locators["right_wing_end"] = (-35.0, 29.0, 4.0)
    bones.append(tip)

    return bones


def center_bones():
    bones = []
    root = Bone("root", None, (0.0, 0.0, 0.0))
    bones.append(root)

    body = Bone("body", "root", (0.0, 15.0, 0.0))
    body.cubes += [
        box(-4.5, 13, -3, 4.5, 17, 3, "skin", tag="pelvis"),
        box(-4, 17, -2.5, 4, 22, 2.5, "skin", tag="abdomen"),
        box(-6.5, 22, -4, 6.5, 31, 4, "skin", tag="chest"),
        # pectoral / rib armor plate on the front of the chest
        box(-5.5, 24, -5, 5.5, 30, -4, "plate", tag="chest_plate"),
        # neck
        box(-2.5, 30, -3.5, 2.5, 33, 1.5, "skin", tag="neck"),
        # shoulder pauldrons
        box(-9.5, 28, -3, -5.5, 32, 3, "plate", tag="pauldron"),
        box(5.5, 28, -3, 9.5, 32, 3, "plate", tag="pauldron"),
        # pauldron spikes
        box(-9, 31, -0.5, -8, 35, 0.5, "horn", pivot=(-8.5, 31, 0), rotation=(0, 0, 30)),
        box(8, 31, -0.5, 9, 35, 0.5, "horn", pivot=(8.5, 31, 0), rotation=(0, 0, -30)),
        # spine spikes
        box(-0.5, 28, 4, 0.5, 30, 7, "horn", pivot=(0, 29, 4), rotation=(20, 0, 0)),
        box(-0.5, 24.5, 4, 0.5, 26.5, 6.5, "horn", pivot=(0, 25.5, 4), rotation=(20, 0, 0)),
        box(-0.5, 19, 2.5, 0.5, 21, 5, "horn", pivot=(0, 20, 2.5), rotation=(20, 0, 0)),
    ]
    body.locators.update({"chest": (0.0, 26.0, -5.0), "core": (0.0, 24.0, 0.0), "back": (0.0, 26.0, 5.0)})
    bones.append(body)

    head = Bone("head", "body", (0.0, 32.0, -1.0))
    head.cubes += [
        box(-4, 32, -5, 4, 39, 2, "skin", tag="skull"),
        # stepped, angry brow ridge (V shape)
        box(-4, 37.5, -6, -2, 38.5, -5, "plate", tag="brow"),
        box(-2, 37, -6, 0, 38, -5, "plate", tag="brow"),
        box(0, 37, -6, 2, 38, -5, "plate", tag="brow"),
        box(2, 37.5, -6, 4, 38.5, -5, "plate", tag="brow"),
        # muzzle
        box(-3, 33, -7, 3, 36, -5, "skin", tag="muzzle"),
        # upper fangs hanging over the jaw
        box(-2.5, 31, -7, -1.5, 33, -6, "tooth"),
        box(1.5, 31, -7, 2.5, 33, -6, "tooth"),
        # cheek spikes
        box(-5, 33.5, -2, -4, 36.5, -1, "horn", pivot=(-4.5, 34, -1.5), rotation=(0, 0, 35)),
        box(4, 33.5, -2, 5, 36.5, -1, "horn", pivot=(4.5, 34, -1.5), rotation=(0, 0, -35)),
    ]
    head.locators.update({"eyes": (0.0, 36.5, -5.5), "mouth": (0.0, 32.5, -7.5)})
    bones.append(head)

    jaw = Bone("jaw", "head", (0.0, 33.0, -1.0), rotation=(10.0, 0.0, 0.0))
    jaw.cubes += [
        box(-3, 31, -6, 3, 33, -1, "skin", tag="jaw"),
        # lower tusks rising beside the muzzle
        box(-4, 32, -5.5, -3, 35, -4.5, "tooth", pivot=(-3.5, 32, -5), rotation=(10, 0, 10)),
        box(3, 32, -5.5, 4, 35, -4.5, "tooth", pivot=(3.5, 32, -5), rotation=(10, 0, -10)),
    ]
    bones.append(jaw)

    tail = Bone("tail", "body", (0.0, 15.0, 3.0), rotation=(-35.0, 0.0, 0.0))
    tail.cubes += [box(-1.5, 13.5, 2.5, 1.5, 16.5, 9, "skin", tag="tail")]
    bones.append(tail)
    tail2 = Bone("tail2", "tail", (0.0, 15.0, 8.5), rotation=(-15.0, 0.0, 0.0))
    tail2.cubes += [box(-1, 14, 8, 1, 16, 15, "skin", tag="tail")]
    bones.append(tail2)
    tail3 = Bone("tail3", "tail2", (0.0, 15.0, 14.5), rotation=(25.0, 0.0, 0.0))
    tail3.cubes += [box(-0.5, 14.5, 14, 0.5, 15.5, 20, "skin", tag="tail")]
    bones.append(tail3)
    tail_tip = Bone("tail_tip", "tail3", (0.0, 15.0, 20.0), rotation=(20.0, 0.0, 0.0))
    tail_tip.cubes += [
        box(-2.5, 14.5, 19.5, 2.5, 15.5, 21.5, "spade", tag="spade"),
        box(-1.5, 14.5, 21.5, 1.5, 15.5, 23, "spade", tag="spade"),
        box(-0.5, 14.5, 23, 0.5, 15.5, 24.5, "spade", tag="spade"),
    ]
    tail_tip.locators["tail_tip"] = (0.0, 15.0, 23.0)
    bones.append(tail_tip)
    return bones


def mirror_name(name):
    return name.replace("right", "left")


def mirror_cube(c: Cube) -> Cube:
    lo = (-c.hi[0], c.lo[1], c.lo[2])
    hi = (-c.lo[0], c.hi[1], c.hi[2])
    pivot = (-c.pivot[0], c.pivot[1], c.pivot[2]) if c.pivot else None
    rotation = (c.rotation[0], -c.rotation[1], -c.rotation[2]) if c.rotation else None
    m = Cube(lo, hi, c.mat, pivot=pivot, rotation=rotation, faces=c.faces, tag=c.tag)
    m.mirror_of = c
    return m


def mirror_bone(b: Bone) -> Bone:
    rot = (b.rotation[0], -b.rotation[1], -b.rotation[2]) if b.rotation else None
    parent = mirror_name(b.parent) if b.parent and "right" in b.parent else b.parent
    mb = Bone(mirror_name(b.name), parent, (-b.pivot[0], b.pivot[1], b.pivot[2]), rotation=rot)
    mb.cubes = [mirror_cube(c) for c in b.cubes]
    mb.locators = {mirror_name(k): (-v[0], v[1], v[2]) for k, v in b.locators.items()}
    return mb


def build_model():
    bones = center_bones()
    right = right_side_bones()
    bones += right
    bones += [mirror_bone(b) for b in right]
    return bones

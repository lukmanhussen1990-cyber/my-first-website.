#!/usr/bin/env python3
"""Hold poses for the tactical torchlight attachable: vanilla-derived binding math, the
desired poses, a solver that turns them into animation values, and the writer for

  addon/resource_pack/animations/pas_torchlight.animation.json
  addon/resource_pack/attachables/pas_tactical_torchlight.json
  addon/resource_pack/attachables/pas_tactical_torchlight_on.json

Binding model (derived from bedrock-samples v1.21.0.26, see docs/TORCHLIGHT_MODEL.md):
  A root bone with "binding": "q.item_slot_to_bone_name(c.item_slot)" uses the holder's
  rightItem / leftItem bone as its root transform.  The attachable's model space is placed
  so that its point (0, 24, 0) sits on that bone's pivot and follows the bone's rotation:

      world(p) = J . ( pivot - (0,24,0) + anim_position + R(anim_rotation) . S . (p - pivot) )

  J = the hand bone's joint frame (origin at its pivot, rotated with the arm).
  Checks: vanilla shield third person puts its handle 0.6 units from the hand pivot with the
  plate just outside the arm; spyglass scoping lands at the right eye; first-person main- and
  off-hand shields come out as exact mirror images (x = +7.0 / -7.3, same y, z, orientation).

First-person camera model (approximate): the body is rotated with the view
(animation.player.first_person.base_pose), and the vanilla first-person data only make sense
with model +Z as the view direction and +X to the right of the screen.  The eye is at
(0, 1.62 * 16 / 0.9375, 0) = (0, 27.65, 0) in model units (player scale 0.9375).

Usage: python3 tools/art/torchlight/hold.py        (prints the solved values, writes the JSON)
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import torch_model as tm  # noqa: E402

RP = tm.ROOT / "addon" / "resource_pack"
ANIM_PATH = RP / "animations" / "pas_torchlight.animation.json"
ATT_OFF = RP / "attachables" / "pas_tactical_torchlight.json"
ATT_ON = RP / "attachables" / "pas_tactical_torchlight_on.json"

# --- vanilla constants (geometry.humanoid.custom in models/mobs.json, player animations) -----
BIND_ORIGIN = np.array((0.0, 24.0, 0.0))     # attachable root bones are measured from here
RIGHT_ARM_PIVOT = np.array((-5.0, 22.0, 0.0))
LEFT_ARM_PIVOT = np.array((5.0, 22.0, 0.0))
RIGHT_ITEM_PIVOT = np.array((-6.0, 15.0, 1.0))
LEFT_ITEM_PIVOT = np.array((6.0, 15.0, 1.0))
# animation.player.first_person.empty_hand (applied whenever no map is held)
FP_RIGHT_ARM_POS = (13.5, -10.0, 12.0)
FP_RIGHT_ARM_ROT = (95.0, -45.0, 115.0)
# rightitem/leftitem position: [0, pivot(arm).y - pivot(item).y - 7, -pivot(item).z] = [0, 0, -1]
FP_ITEM_POS = (0.0, 22.0 - 15.0 - 7.0, -1.0)
# animation.player.holding: arm x = -this*0.5 - 18 while holding (this = 0 standing still)
TP_HOLD_ARM_X = -18.0
EYE = np.array((0.0, 1.62 * 16.0 / 0.9375, 0.0))


# --- rotation helpers (geo space; Bedrock rotation = Rz(-rz) . Ry(ry) . Rx(-rx)) -------------
def _rx(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)


def _ry(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)


def _rz(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)


def rot(r) -> np.ndarray:
    rx, ry, rz = (math.radians(float(v)) for v in r)
    return _rz(-rz) @ _ry(ry) @ _rx(-rx)


def euler(R: np.ndarray) -> tuple[float, float, float]:
    """Inverse of rot(): Bedrock [rx, ry, rz] in degrees."""
    beta = math.asin(max(-1.0, min(1.0, -R[2, 0])))
    alpha = math.atan2(R[2, 1], R[2, 2])
    gamma = math.atan2(R[1, 0], R[0, 0])
    return (-math.degrees(alpha), math.degrees(beta), -math.degrees(gamma))


def bone_local(pivot, pos=(0, 0, 0), r=(0, 0, 0)) -> np.ndarray:
    """T(pivot) . T(pos) . R . T(-pivot) as a 4x4 (Bedrock bone transform, geo space)."""
    m = np.eye(4)
    m[:3, :3] = rot(r)
    p = np.asarray(pivot, float)
    m[:3, 3] = p + np.asarray(pos, float) - m[:3, :3] @ p
    return m


def joint_frame(slot: str, first_person: bool) -> np.ndarray:
    """4x4 joint frame of the hand bone (origin = item bone pivot) in the body frame."""
    if slot == "main_hand":
        arm_pivot, item_pivot = RIGHT_ARM_PIVOT, RIGHT_ITEM_PIVOT
        arm = bone_local(arm_pivot, FP_RIGHT_ARM_POS, FP_RIGHT_ARM_ROT) if first_person \
            else bone_local(arm_pivot, (0, 0, 0), (TP_HOLD_ARM_X, 0, 0))
    else:
        arm_pivot, item_pivot = LEFT_ARM_PIVOT, LEFT_ITEM_PIVOT
        arm = np.eye(4) if first_person else bone_local(arm_pivot, (0, 0, 0), (TP_HOLD_ARM_X, 0, 0))
    item = bone_local(item_pivot, FP_ITEM_POS if first_person else (0, 0, 0))
    T = np.eye(4)
    T[:3, 3] = item_pivot
    return arm @ item @ T


def world_of(slot: str, first_person: bool, pos, r, p_geo, geo_pivot=tm.PIVOT, scale: float = 1.0) -> np.ndarray:
    """Body-frame position of attachable point p_geo for the given animation values."""
    J = joint_frame(slot, first_person)
    piv = np.asarray(geo_pivot, float)
    local = piv - BIND_ORIGIN + np.asarray(pos, float) + rot(r) @ (scale * (np.asarray(p_geo, float) - piv))
    return (J @ np.append(local, 1.0))[:3]


def frame_from(direction, roll_deg: float) -> np.ndarray:
    """Rotation whose local -Z (the lens) points along ``direction`` and whose local +Y (the
    clip side) is as close to world up as possible, then rolled by roll_deg about the lens axis
    (positive = top leans toward local +X)."""
    ez = -np.asarray(direction, float)
    ez /= np.linalg.norm(ez)
    up = np.array((0.0, 1.0, 0.0))
    ey = up - (up @ ez) * ez
    ey /= np.linalg.norm(ey)
    ex = np.cross(ey, ez)
    a = math.radians(roll_deg)
    ex2 = math.cos(a) * ex - math.sin(a) * ey
    ey2 = math.sin(a) * ex + math.cos(a) * ey
    return np.column_stack([ex2, ey2, ez])


def solve(slot: str, first_person: bool, centre, A: np.ndarray) -> tuple[tuple, tuple]:
    """Animation (position, rotation) that puts the grip centre at ``centre`` (body frame) with
    orientation ``A`` (columns = where local x, y, z go)."""
    J = joint_frame(slot, first_person)
    Wl, Wt = J[:3, :3], J[:3, 3]
    pos = Wl.T @ (np.asarray(centre, float) - Wt)
    R = Wl.T @ A
    return tuple(float(v) for v in pos), euler(R)


# --- desired poses ---------------------------------------------------------------------------
# First person (body frame = camera frame; +Z forward, +X screen right, eye at EYE).
# The grip centre sits where vanilla puts held items (lower right, beside the shield/trident
# hand region), the lens aims at the crosshair AIM_DISTANCE units ahead, the clip side is
# rolled a little toward the screen centre so the top and the tail switch stay visible.
FP_MAIN_CENTRE = (10.0, 21.0, 18.5)
FP_AIM_DISTANCE = 64.0          # 4 blocks
FP_ROLL = 25.0                  # degrees, top leans toward the screen centre
FP_SCALE = 1.25                 # vanilla first-person items read larger than in third person
# Third person, relative to the hand bone: grip centre 1.5 below the item pivot and centred in
# the fist (z 0), lens forward, x +18 cancels the vanilla holding pose (-18) so the light is level.
TP_POS = (0.0, -1.5, -1.0)
TP_ROT = (18.0, 0.0, 0.0)


def first_person_pose(slot: str) -> tuple[tuple, tuple]:
    sx = 1.0 if slot == "main_hand" else -1.0
    c = np.array((sx * FP_MAIN_CENTRE[0], FP_MAIN_CENTRE[1], FP_MAIN_CENTRE[2]))
    aim = EYE + np.array((0.0, 0.0, FP_AIM_DISTANCE))
    A = frame_from(aim - c, sx * -FP_ROLL)
    return solve(slot, True, c, A)


def solved() -> dict:
    out = {}
    for slot, tag in (("main_hand", "main"), ("off_hand", "off")):
        pos, r = first_person_pose(slot)
        out[f"fp_{tag}"] = (pos, r)
        out[f"tp_{tag}"] = (TP_POS, TP_ROT)
    return out


# --- JSON writers ----------------------------------------------------------------------------
def _n(v: float, nd: int = 2) -> float:
    v = round(float(v), nd)
    return 0.0 if v == 0 else v


def variables_init() -> list[str]:
    s = solved()
    lines = []
    for key in ("fp_main", "fp_off", "tp_main", "tp_off"):
        pos, r = s[key]
        for axis, v in zip("xyz", pos):
            lines.append(f"variable.pas_{key}_pos_{axis} = {_n(v)};")
        for axis, v in zip("xyz", r):
            lines.append(f"variable.pas_{key}_rot_{axis} = {_n(v)};")
    lines.append(f"variable.pas_fp_scale = {_n(FP_SCALE)};")
    return lines


def _hold_anim(key: str, scale: bool = False) -> dict:
    bone = {
        "position": [f"variable.pas_{key}_pos_{a}" for a in "xyz"],
        "rotation": [f"variable.pas_{key}_rot_{a}" for a in "xyz"],
    }
    if scale:
        bone["scale"] = "variable.pas_fp_scale"
    return {"loop": True, "bones": {tm.BONE: bone}}


def animation_json() -> dict:
    return {
        "format_version": "1.10.0",
        "animations": {
            "animation.pas.torchlight.first_person_main_hand": _hold_anim("fp_main", True),
            "animation.pas.torchlight.first_person_off_hand": _hold_anim("fp_off", True),
            "animation.pas.torchlight.third_person_main_hand": _hold_anim("tp_main"),
            "animation.pas.torchlight.third_person_off_hand": _hold_anim("tp_off"),
        },
    }


def attachable_json(identifier: str, on: bool) -> dict:
    tex = "textures/entity/pas/tactical_torchlight_on" if on else "textures/entity/pas/tactical_torchlight"
    # ON: vanilla "spider" material = opaque, texture alpha is an emissive mask (lens alpha 3).
    mat = "spider" if on else "entity_alphatest"
    return {
        "format_version": "1.10.0",
        "minecraft:attachable": {
            "description": {
                "identifier": identifier,
                "materials": {"default": mat, "enchanted": mat},
                "textures": {"default": tex, "enchanted": "textures/misc/enchanted_item_glint"},
                "geometry": {"default": tm.GEO_ID},
                "animations": {
                    "hold_first_person_main_hand": "animation.pas.torchlight.first_person_main_hand",
                    "hold_first_person_off_hand": "animation.pas.torchlight.first_person_off_hand",
                    "hold_third_person_main_hand": "animation.pas.torchlight.third_person_main_hand",
                    "hold_third_person_off_hand": "animation.pas.torchlight.third_person_off_hand",
                },
                "scripts": {
                    "initialize": variables_init(),
                    "animate": [
                        {"hold_first_person_main_hand": "c.is_first_person && c.item_slot == 'main_hand'"},
                        {"hold_first_person_off_hand": "c.is_first_person && c.item_slot != 'main_hand'"},
                        {"hold_third_person_main_hand": "!c.is_first_person && c.item_slot == 'main_hand'"},
                        {"hold_third_person_off_hand": "!c.is_first_person && c.item_slot != 'main_hand'"},
                    ],
                },
                "render_controllers": ["controller.render.item_default"],
            }
        },
    }


def write_all() -> list[Path]:
    out = []
    for path, data in (
        (ANIM_PATH, animation_json()),
        (ATT_OFF, attachable_json("pas:tactical_torchlight", False)),
        (ATT_ON, attachable_json("pas:tactical_torchlight_on", True)),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(tm.dumps_compact(data) + "\n", encoding="utf-8")
        out.append(path)
    return out


def report() -> None:
    s = solved()
    for key, (pos, r) in s.items():
        print(f"  {key:8s} position {tuple(_n(v) for v in pos)}  rotation {tuple(_n(v) for v in r)}")
    # where the lens and tail end up (body frame) for each pose
    tail = (0.0, 24.0, tm.GRIP_L + 0.5)
    lens = (0.0, 24.0, tm.GRIP_L - 10.5)
    for slot, tag in (("main_hand", "main"), ("off_hand", "off")):
        for fp in (True, False):
            pos, r = s[("fp_" if fp else "tp_") + tag]
            sc = FP_SCALE if fp else 1.0
            t = world_of(slot, fp, pos, r, tail, scale=sc)
            l = world_of(slot, fp, pos, r, lens, scale=sc)
            extra = ""
            if fp:
                def ang(p):
                    rel = p - EYE
                    return (math.degrees(math.atan2(rel[0], rel[2])), math.degrees(math.atan2(rel[1], rel[2])))
                extra = f"  screen deg tail {tuple(round(v, 1) for v in ang(t))} lens {tuple(round(v, 1) for v in ang(l))}"
            print(f"  {slot:9s} {'1st' if fp else '3rd'}: tail {np.round(t, 2)} lens {np.round(l, 2)}{extra}")


def main() -> int:
    report()
    for p in write_all():
        print(f"wrote {p.relative_to(tm.ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

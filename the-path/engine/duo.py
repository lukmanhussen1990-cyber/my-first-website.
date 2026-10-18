"""Duo rig on the official artwork.

Only the brief's four kinds of motion are possible, and all of them transform
existing shapes of the official SVG; nothing is redrawn or recolored:
  * squash / stretch  - whole body, volume preserving, pivot on the feet
  * blink             - each eye group (white, pupil, highlight) scales vertically
  * wings             - each wing rotates about its shoulder
  * beak              - the lower beak drops on its hinge
plus rigid translation of the whole character (hops, falls, landings).

The 30%-alpha ground ellipse (#0) belongs to the app's path context, not to
Duo; the film uses its own contact shadow, so it is excluded.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from engine import svg

ROOT = Path(__file__).resolve().parents[1]
DUO_SVG = ROOT / "assets/brand/duo_standing_front.svg"  # restore with tools/fetch_brand.sh

PARTS = {
    "app_shadow": [0],
    "feet": [1, 2],
    "body": [3],
    "wing_l": [4],
    "wing_r": [5],
    "mask": [6],
    "belly": [7, 8, 9],
    "beak_lower": [10],
    "beak_upper": [11, 12],
    "eye_l": [13, 14, 15],
    "eye_r": [16, 17, 18],
}
EXCLUDED = set(PARTS["app_shadow"])

# pivots in the artwork's own units (1080 x 1080 viewBox)
FEET = np.array([540.8, 709.3])        # contact point between the feet
SHOULDER_L = np.array([392.0, 488.0])  # just inside the wing's top point
SHOULDER_R = np.array([687.6, 488.0])  # mirrored about the body centre x = 539.8
EYE_L = np.array([462.9, 547.7])       # eye-white centres
EYE_R = np.array([618.9, 547.7])
BEAK_DROP = 10.0                        # lower-beak travel at beak = 1
HEAD_TOP = 315.6                        # top of the body shape


@dataclass
class Pose:
    squash: float = 1.0   # vertical scale; horizontal = 1/squash (volume preserving)
    wing_l: float = 0.0   # degrees, positive = outward / up
    wing_r: float = 0.0
    blink: float = 0.0    # 0 open .. 1 closed (eyes scale to 8%)
    beak: float = 0.0     # 0 closed .. 1 open
    lift: float = 0.0     # artwork units up (hop / fall); applied by world placement, not by render()


def _T(tx, ty):
    return np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1.0]])


def _S(sx, sy, about):
    return _T(*about) @ np.diag([sx, sy, 1.0]) @ _T(*-about)


def _R(deg, about):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return _T(*about) @ np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]]) @ _T(*-about)


def part_transforms(p: Pose) -> dict[int, np.ndarray]:
    """Shape index -> 3x3 transform in artwork units (y down)."""
    body = _S(1.0 / p.squash, p.squash, FEET)
    local = {i: np.eye(3) for i in range(19)}
    # y is down: a positive screen-clockwise angle swings the left wing out and up
    for i in PARTS["wing_l"]:
        local[i] = _R(p.wing_l, SHOULDER_L)
    for i in PARTS["wing_r"]:
        local[i] = _R(-p.wing_r, SHOULDER_R)
    sy = 1.0 - 0.92 * p.blink
    for i in PARTS["eye_l"]:
        local[i] = _S(1.0, sy, EYE_L)
    for i in PARTS["eye_r"]:
        local[i] = _S(1.0, sy, EYE_R)
    for i in PARTS["beak_lower"]:
        local[i] = _T(0, BEAK_DROP * p.beak)
    return {i: body @ m for i, m in local.items()}


_DOC = None


def shapes():
    global _DOC
    if _DOC is None:
        _DOC = svg.load(DUO_SVG)
    return [s for s in _DOC.shapes if s.index not in EXCLUDED]


def posed_bounds(p: Pose):
    """Bounding box (artwork units) of the posed character."""
    pts = []
    tf = part_transforms(p)
    for sh in shapes():
        m = tf[sh.index]
        for c in sh.contours:
            pts.append((np.c_[c, np.ones(len(c))] @ m.T)[:, :2])
    pts = np.vstack(pts)
    return pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()


def render(p: Pose, height_px: float, ss: int = 4, pad_px: int = 4):
    """Render Duo so the standing body (head top to feet, 315.6..709.3 units) is
    `height_px` tall at squash 1.  Returns (rgba float32, feet_xy) where feet_xy
    is the feet contact point in image pixels, used to place Duo in the world."""
    s = height_px / (FEET[1] - HEAD_TOP)
    x0, y0, x1, y1 = posed_bounds(p)
    ox, oy = math.floor(x0 * s) - pad_px, math.floor(y0 * s) - pad_px
    w = int(math.ceil(x1 * s)) + pad_px - ox
    h = int(math.ceil(y1 * s)) + pad_px - oy
    M = np.array([[s, 0, -ox], [0, s, -oy], [0, 0, 1.0]])
    img = svg.render(shapes(), M, (h, w), ss=ss, part_transforms=part_transforms(p))
    return img, (FEET[0] * s - ox, FEET[1] * s - oy)

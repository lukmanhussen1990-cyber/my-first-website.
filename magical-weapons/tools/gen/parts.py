"""Reusable model-building helpers (rings, arcs, crystals, orbiters)."""
import math

from .modelkit import *  # noqa: F401,F403


def ring(m, bone, y, half, h, mat, depth=None):
    """Square band around a shaft: half = half-width in X, depth = half-width in Z."""
    depth = half if depth is None else depth
    m.box(bone, (-half, y, -depth), (2 * half, h, 2 * depth), x=mat, z=mat, y=mat)


def shaft(m, bone, y0, y1, half, mat_side, mat_cap=None):
    mat_cap = mat_cap or mat_side
    m.box(bone, (-half, y0, -half), (2 * half, y1 - y0, 2 * half), x=mat_side, z=mat_side, y=mat_cap)


def arc_segments(m, bone_prefix, parent, center, radius, a0, a1, n, size, mats, plane='yz'):
    """Place n cubes along an arc in the YZ plane (angle 0 = +Z direction towards the back, 90 = up).

    Each segment is its own bone (rotated about X) so the cubes can be tilted along the arc.
    size = (thick_x, seg_len, width_z) of an upright segment before rotation.
    Returns list of bone names.
    """
    names = []
    cy, cz = center
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        # position on the arc (y up, z back)
        py = cy + radius * math.sin(math.radians(a))
        pz = cz + radius * math.cos(math.radians(a))
        name = '%s_%d' % (bone_prefix, i)
        # segment points along the tangent; rotation about X tilts +Y towards -Z (positive rot X = forward)
        tilt = a - 90.0
        m.bone(name, parent, (0, py, pz), rotation=[-tilt, 0, 0])
        sx, sy, sz = size
        m.box(name, (-sx / 2, py - sy / 2, pz - sz / 2), (sx, sy, sz), **mats)
        names.append(name)
    return names


def orbiter(m, name, parent, center, offset, size, mat):
    """A small glow cube that can orbit `center` when the bone is spun (animate rotation Y)."""
    m.bone(name, parent, center)
    ox, oy, oz = offset
    sx, sy, sz = size
    m.box(name, (center[0] + ox - sx / 2, center[1] + oy - sy / 2, center[2] + oz - sz / 2), (sx, sy, sz),
          x=mat, z=mat, y=mat)


def diamond(m, name, parent, center, size, mat):
    """Cube rotated 45 deg about two axes (octahedron-ish gem). Needs its own bone."""
    m.bone(name, parent, center, rotation=[45, 0, 45])
    s = size
    m.box(name, (center[0] - s / 2, center[1] - s / 2, center[2] - s / 2), (s, s, s), x=mat, z=mat, y=mat)

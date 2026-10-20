"""Solve attachable hold animations (first and third person) for a gun.

Poses are specified in intuitive spaces and converted into the Bedrock
position/rotation values for the bound "gun" bone using the vanilla
player rig (see rig.py for the conventions).
"""
import math
import numpy as np

from .rig import (player_rig_matrices, binding_matrix, first_person_camera, solve_hold,
                  rx, ry, rz)


def _norm(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


def _axis_angle(axis, deg):
    axis = _norm(axis)
    a = math.radians(deg)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * (K @ K)


def camera_orientation(forward, roll=0.0):
    """Columns = images of the gun's internal X (right), Y (up), Z (back)
    expressed in camera coordinates (x right, y up, z forward)."""
    d = _norm(forward)
    right = _norm(np.cross([0, 1, 0], d))
    up = np.cross(d, right)
    Rr = _axis_angle(d, roll)
    right, up = Rr @ right, Rr @ up
    return np.stack([right, up, -d], axis=1)


def first_person_pose(player, grip_cam, aim_dist=96.0, bore_height=1.9, roll=0.0,
                      yaw_extra=0.0, pitch_extra=0.0):
    """grip_cam: where the grip reference point sits in camera space.
    The bore line (grip + bore_height along gun-up) is aimed at a point on the
    view axis aim_dist px ahead (converging on the crosshair)."""
    grip_cam = np.asarray(grip_cam, dtype=float)
    bore = grip_cam + np.array([0, bore_height, 0])
    target = np.array([0.0, 0.0, aim_dist])
    fwd = _norm(target - bore)
    if yaw_extra or pitch_extra:
        fwd = _axis_angle([0, 1, 0], yaw_extra) @ fwd
        fwd = _axis_angle(np.cross([0, 1, 0], fwd), -pitch_extra) @ fwd
    R_cam = camera_orientation(fwd, roll)
    # place the grip so that the bore line passes where requested
    mats = player_rig_matrices(player, True)
    A = first_person_camera() @ binding_matrix(mats, player)
    return solve_hold(A, grip_cam, R_cam)


def third_person_pose(player, grip_offset=(0.0, -0.6, 0.6), pitch=0.0, yaw=0.0):
    """Gun level and pointing straight ahead of the player model, the grip
    sitting in the right fist (rightItem pivot + offset in model space)."""
    mats = player_rig_matrices(player, False)
    B = binding_matrix(mats, player)
    ri = player.bones["rightItem"].pivot
    hand = (mats["rightItem"] @ np.append(ri, 1.0))[:3] + np.asarray(grip_offset)
    # internal frame: gun axes aligned with the model (forward = -Z)
    R = rx(pitch) @ ry(-yaw)
    return solve_hold(B, hand, R)


def fmt(v, nd=3):
    out = []
    for x in v:
        x = round(float(x), nd)
        if x == 0:
            x = 0.0
        out.append(x)
    return out

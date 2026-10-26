"""Assemble a rig from src/characters/rigs.json into a PNG (same math as the Remotion rig).

Usage: python tools/rig_preview.py <char> <out.png> [pose.json]
pose.json: {"part": angleDegrees, ...}; positive = counter-clockwise on screen.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

EP = Path(__file__).resolve().parent.parent
RIGS = json.loads((EP / 'src' / 'characters' / 'rigs.json').read_text())


def mat(tx, ty, deg):
    # y-down image space; positive degrees rotate counter-clockwise on screen
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return np.array([[c, s, tx], [-s, c, ty], [0, 0, 1]], float)


def world_transforms(rig, pose):
    parts = rig['parts']
    out = {}

    def get(name):
        if name in out:
            return out[name]
        p = parts[name]
        local = mat(p['at'][0], p['at'][1], pose.get(name, 0.0)) @ mat(-p['pivot'][0], -p['pivot'][1], 0)
        out[name] = (get(p['parent']) if p['parent'] else np.eye(3)) @ local
        return out[name]

    for n in parts:
        get(n)
    return out


def render(char, pose=None, pad=60):
    rig = RIGS[char]
    pose = pose or {}
    T = world_transforms(rig, pose)
    imgs = {n: Image.open(EP / 'public' / 'sprites' / f"{rig['parts'][n]['sprite']}.png").convert('RGBA') for n in rig['parts']}
    corners = []
    for n, im in imgs.items():
        w, h = im.size
        for x, y in [(0, 0), (w, 0), (0, h), (w, h)]:
            corners.append((T[n] @ np.array([x, y, 1]))[:2])
    corners = np.array(corners)
    x0, y0 = corners.min(0) - pad
    x1, y1 = corners.max(0) + pad
    canvas = Image.new('RGBA', (int(x1 - x0), int(y1 - y0)), (0, 0, 0, 0))
    for n in rig['order']:
        M = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1]]) @ T[n]
        inv = np.linalg.inv(M)
        layer = imgs[n].transform(canvas.size, Image.AFFINE, tuple(inv[:2].ravel()), resample=Image.BICUBIC)
        canvas.alpha_composite(layer)
    return canvas


if __name__ == '__main__':
    char, out = sys.argv[1], sys.argv[2]
    pose = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else {}
    render(char, pose).save(out)

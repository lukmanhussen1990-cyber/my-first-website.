#!/usr/bin/env python3
"""Generate the graphics pack icon: a sunset sky gradient over a dark horizon.

Run from the repo root:  python3 tools/make_graphics_icon.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngwrite import write_png  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 128

# Matches the sunset keyframe in atmospherics.json.
ZENITH = (16, 48, 96)
HORIZON = (255, 106, 72)
GROUND = (18, 16, 24)
SUN = (255, 226, 168)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def main():
    horizon_y = int(N * 0.66)
    sun_x, sun_y, sun_r = N * 0.5, horizon_y - 6, N * 0.11

    rows = []
    for y in range(N):
        row = []
        for x in range(N):
            if y >= horizon_y:
                # water below the horizon, with a reflected sun column
                depth = (y - horizon_y) / max(1, N - horizon_y)
                c = lerp(lerp(HORIZON, GROUND, 0.55), GROUND, depth)
                if abs(x - sun_x) < sun_r * (1.0 - depth * 0.4) and (y // 3) % 2 == 0:
                    c = lerp(c, SUN, 0.45 * (1.0 - depth))
            else:
                t = (y / horizon_y) ** 1.5
                c = lerp(ZENITH, HORIZON, t)
                d = ((x - sun_x) ** 2 + (y - sun_y) ** 2) ** 0.5
                if d < sun_r:
                    c = SUN
                elif d < sun_r * 3.2:
                    c = lerp(c, SUN, (1.0 - (d - sun_r) / (sun_r * 2.2)) * 0.7)
            row.append((c[0], c[1], c[2], 255))
        rows.append(row)

    path = os.path.join(ROOT, "VIS_RP", "pack_icon.png")
    write_png(path, rows)
    print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()

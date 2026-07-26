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

    atmos()


def atmos():
    """Atmos pack icon: hills fading into layered haze."""
    sky_top = (110, 150, 190)
    haze = (168, 200, 232)
    ridge = (46, 62, 58)

    rows = [[(0, 0, 0, 0)] * N for _ in range(N)]
    for y in range(N):
        t = (y / N) ** 0.8
        base = lerp(sky_top, haze, t)
        for x in range(N):
            rows[y][x] = (base[0], base[1], base[2], 255)

    # four ridgelines, each hazier than the one behind it
    for i, (offset, amp, fade) in enumerate(((0.46, 10, 0.72), (0.58, 14, 0.52),
                                             (0.72, 18, 0.30), (0.88, 22, 0.10))):
        colour = lerp(haze, ridge, 1.0 - fade)
        phase = i * 1.7
        for x in range(N):
            import math
            h = offset * N - amp * (math.sin(x / 26.0 + phase) * 0.6
                                    + math.sin(x / 11.0 + phase * 2) * 0.4)
            for y in range(int(h), N):
                rows[y][x] = (colour[0], colour[1], colour[2], 255)

    path = os.path.join(ROOT, "ATM_RP", "pack_icon.png")
    write_png(path, rows)
    print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()

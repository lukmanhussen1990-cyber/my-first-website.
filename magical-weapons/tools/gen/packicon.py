"""Pack icon: the seven weapons arranged in a ring around the Flamebrand, over a night-sky gradient."""
import math

from .pngkit import Canvas, ramp, hex_rgb, mix, rng_for

HALO = {
    'flamebrand': (255, 140, 40), 'frostbite': (120, 210, 255), 'storm_staff': (130, 170, 255),
    'arcane_wand': (190, 120, 255), 'shadow_dagger': (150, 70, 230), 'earth_hammer': (255, 180, 60),
    'soul_scythe': (80, 255, 160),
}


def glow(cv, cx, cy, r, color, amax):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x - cx, y - cy) / r
            if d < 1:
                a = int(amax * (1 - d) ** 2)
                if a > 0:
                    cv.over(x, y, (color[0], color[1], color[2], a))


def build(icons):
    """icons: dict id -> 16x16 Canvas"""
    size = 256
    cv = Canvas(size, size)
    top, bot = hex_rgb('#1a1238'), hex_rgb('#0b2a45')
    for y in range(size):
        row = mix(top, bot, y / (size - 1))
        for x in range(size):
            vig = math.hypot(x - 128, y - 128) / 181.0
            cv.set(x, y, tuple(int(c * (1.0 - 0.35 * vig ** 2)) for c in row))
    rg = rng_for('packicon')
    for _ in range(46):
        sx, sy = rg.randrange(4, size - 4), rg.randrange(4, size - 4)
        if math.hypot(sx - 128, sy - 128) < 62:
            continue
        b = rg.choice([120, 170, 230])
        cv.set(sx, sy, (b, b, 255, 255))
        if rg.random() < 0.3:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                cv.over(sx + dx, sy + dy, (b, b, 255, 110))
    order = ['frostbite', 'storm_staff', 'arcane_wand', 'shadow_dagger', 'earth_hammer', 'soul_scythe']
    glow(cv, 128, 128, 74, HALO['flamebrand'], 120)
    for i, wid in enumerate(order):
        th = -math.pi / 2 + i * (2 * math.pi / 6)
        cx, cy = 128 + 92 * math.cos(th), 128 + 92 * math.sin(th)
        glow(cv, cx, cy, 34, HALO[wid], 105)
    for i, wid in enumerate(order):
        th = -math.pi / 2 + i * (2 * math.pi / 6)
        cx, cy = 128 + 92 * math.cos(th), 128 + 92 * math.sin(th)
        cv.blit(icons[wid].scaled(3), int(cx - 24), int(cy - 24), skip_transparent=True)
    cv.blit(icons['flamebrand'].scaled(6), 128 - 48, 128 - 48, skip_transparent=True)
    return cv

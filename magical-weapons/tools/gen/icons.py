"""16x16 inventory icons, painted with a few primitives (+ automatic dark outline)."""
from .pngkit import Canvas, hex_rgb, mix, shade, ramp
from .modelkit import STEEL, GOLD, LEATHER, FIRE, ICE, WOOD, EBONY, ARCANE, STORM, SHADOW, VIOLET_GLOW, STONE, AMBER, SOUL, BONE, CRIMSON, DARKSTEEL, FROST

OUTLINE = hex_rgb('#140e1c')


def _finish(cv, outline=OUTLINE):
    cv.outline(outline)
    return cv


def diag(cv, x0, y0, x1, y1, cols, width=1):
    """Draw a diagonal strip; cols = (light, body, shade) painted across the strip width."""
    dx = 1 if x1 > x0 else -1
    n = abs(x1 - x0)
    dy = (y1 - y0) / float(n) if n else 0
    for i in range(n + 1):
        x = x0 + i * dx
        y = int(round(y0 + i * dy))
        if width == 1:
            cv.set(x, y, cols[1])
        elif width == 2:
            cv.set(x, y, cols[0])
            cv.set(x + 1, y, cols[1]) if dx > 0 and dy < 0 else cv.set(x, y + 1, cols[1])
        else:
            cv.set(x, y, cols[0])
            cv.set(x + 1, y, cols[1])
            cv.set(x + 1, y + 1, cols[2])


def sword_icon(blade_pal, glow_pal=None, guard_pal=GOLD, grip_pal=LEATHER, gem=None, aura=None, wide=True):
    cv = Canvas(16, 16)
    # blade: diagonal from (6,9) to (14,1), 3 px wide strip
    for i in range(0, 9):
        x, y = 6 + i, 9 - i
        cv.set(x, y, ramp(blade_pal, 0.95))             # lit upper edge
        cv.set(x + 1, y, ramp(blade_pal, 0.72))         # body
        if wide:
            cv.set(x + 1, y + 1, ramp(blade_pal, 0.35)) # shaded lower edge
        if glow_pal and i in (2, 4, 6):
            cv.set(x + 1, y, ramp(glow_pal, 0.9))
    cv.set(15, 0, ramp(blade_pal, 1.0))                  # tip
    if aura:
        for (x, y, t) in ((14, 0, 0.9), (15, 2, 0.7), (13, 0, 0.55), (15, 1, 0.8), (12, 1, 0.5)):
            cv.set(x, y, ramp(aura, t))
    # guard: anti-diagonal bar
    for k in range(-2, 3):
        cv.set(5 + k, 10 + k, ramp(guard_pal, 0.8 if k % 2 == 0 else 0.55))
    cv.set(4, 9, ramp(guard_pal, 0.95)); cv.set(7, 12, ramp(guard_pal, 0.4))
    if gem:
        cv.set(5, 10, ramp(gem, 0.9))
    # grip + pommel
    diag(cv, 4, 11, 2, 13, (ramp(grip_pal, 0.7), ramp(grip_pal, 0.5), ramp(grip_pal, 0.3)))
    cv.set(4, 11, ramp(grip_pal, 0.6)); cv.set(3, 12, ramp(grip_pal, 0.45)); cv.set(2, 13, ramp(grip_pal, 0.35))
    cv.set(1, 14, ramp(guard_pal, 0.8)); cv.set(2, 14, ramp(guard_pal, 0.5)); cv.set(1, 13, ramp(guard_pal, 0.55))
    return _finish(cv)


def staff_icon(shaft_pal, orb_pal, trim_pal):
    cv = Canvas(16, 16)
    # shaft: diagonal from (3,14) to (11,6)
    for i in range(0, 9):
        x, y = 3 + i, 14 - i
        cv.set(x, y, ramp(shaft_pal, 0.55)); cv.set(x + 1, y, ramp(shaft_pal, 0.35))
        if i % 3 == 1:
            cv.set(x, y, ramp(trim_pal, 0.8)); cv.set(x + 1, y, ramp(trim_pal, 0.5))
    # crown prongs
    for (x, y) in ((10, 5), (12, 7), (11, 4), (13, 6)):
        cv.set(x, y, ramp(trim_pal, 0.85))
    # orb
    for (x, y, t) in ((12, 3, 0.95), (13, 3, 0.8), (12, 4, 0.8), (13, 4, 0.6), (11, 3, 0.7), (12, 2, 0.75), (13, 2, 0.6), (14, 3, 0.5), (14, 4, 0.4), (13, 5, 0.45)):
        cv.set(x, y, ramp(orb_pal, t))
    cv.set(12, 3, ramp(orb_pal, 1.0)); cv.set(15, 1, ramp(orb_pal, 0.9)); cv.set(10, 1, ramp(orb_pal, 0.8)); cv.set(15, 5, ramp(orb_pal, 0.8))
    cv.set(2, 15, ramp(trim_pal, 0.7))
    return _finish(cv)


def wand_icon(shaft_pal, gem_pal, trim_pal):
    cv = Canvas(16, 16)
    for i in range(0, 9):
        x, y = 3 + i, 13 - i
        cv.set(x, y, ramp(shaft_pal, 0.6)); cv.set(x + 1, y, ramp(shaft_pal, 0.38))
        if i in (0, 4, 7):
            cv.set(x, y, ramp(trim_pal, 0.85)); cv.set(x + 1, y, ramp(trim_pal, 0.55))
    cv.set(2, 14, ramp(trim_pal, 0.7))
    for (x, y, t) in ((12, 3, 0.95), (13, 2, 0.8), (12, 2, 0.85), (11, 3, 0.7), (13, 3, 0.6), (12, 4, 0.55), (11, 2, 0.6)):
        cv.set(x, y, ramp(gem_pal, t))
    for (x, y) in ((10, 1), (14, 1), (14, 5), (9, 4)):
        cv.set(x, y, ramp(gem_pal, 0.95))
    return _finish(cv)


def dagger_icon(blade_pal, glow_pal, guard_pal):
    cv = Canvas(16, 16)
    pts = [(6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (10, 5), (11, 4), (11, 3), (12, 2), (12, 1)]
    for i, (x, y) in enumerate(pts):
        cv.set(x, y, ramp(blade_pal, 0.5)); cv.set(x + 1, y, ramp(blade_pal, 0.3))
        cv.set(x - 1, y, ramp(glow_pal, 0.85))
    cv.set(13, 1, ramp(blade_pal, 0.45)); cv.set(12, 0, ramp(glow_pal, 0.95))
    for k in range(-2, 3):
        cv.set(5 + k, 10 + k, ramp(guard_pal, 0.75 if k % 2 == 0 else 0.5))
    cv.set(5, 10, ramp(glow_pal, 0.95))
    for (x, y, t) in ((4, 11, 0.45), (3, 12, 0.35), (2, 13, 0.3)):
        cv.set(x, y, ramp(guard_pal, t))
    cv.set(1, 14, ramp(glow_pal, 0.9)); cv.set(2, 14, ramp(guard_pal, 0.55)); cv.set(1, 13, ramp(guard_pal, 0.5))
    return _finish(cv)


def hammer_icon(stone_pal, rune_pal, wood_pal, metal_pal):
    cv = Canvas(16, 16)
    for i in range(0, 9):
        x, y = 2 + i, 14 - i
        cv.set(x, y, ramp(wood_pal, 0.6)); cv.set(x + 1, y, ramp(wood_pal, 0.38))
    cv.set(2, 14, ramp(metal_pal, 0.6)); cv.set(3, 14, ramp(metal_pal, 0.4))
    # head: rotated block near the top-right
    for yy in range(2, 8):
        for xx in range(8, 15):
            if abs((xx - 8) - (yy - 2)) <= 4:
                t = 0.62 - 0.05 * ((xx + yy) % 3) + (0.12 if yy < 4 else 0) - (0.15 if xx > 12 else 0)
                cv.set(xx, yy, ramp(stone_pal, t))
    for (x, y) in ((10, 4), (11, 4), (11, 5), (12, 5), (10, 3)):
        cv.set(x, y, ramp(rune_pal, 0.9))
    for (x, y) in ((8, 2), (9, 2), (14, 7), (13, 7)):
        cv.set(x, y, ramp(metal_pal, 0.7))
    return _finish(cv)


def scythe_icon(blade_pal, glow_pal, shaft_pal, bone_pal):
    cv = Canvas(16, 16)
    for i in range(0, 11):
        x, y = 2 + i, 15 - i
        cv.set(x, y, ramp(shaft_pal, 0.6)); cv.set(x + 1, y, ramp(shaft_pal, 0.35))
        if i in (1, 5, 8):
            cv.set(x, y, ramp(bone_pal, 0.8)); cv.set(x + 1, y, ramp(bone_pal, 0.5))
    arc = [(12, 4), (13, 3), (13, 2), (12, 1), (11, 1), (10, 1), (9, 1), (8, 2), (7, 3), (7, 4)]
    for (x, y) in arc:
        cv.set(x, y, ramp(blade_pal, 0.55))
        cv.set(x, y + 1, ramp(blade_pal, 0.4))
    for (x, y) in ((8, 3), (9, 2), (10, 2), (11, 2), (12, 2), (7, 5)):
        cv.set(x, y, ramp(glow_pal, 0.9))
    cv.set(12, 3, ramp(glow_pal, 1.0))
    return _finish(cv)


def preview_sheet(icons, scale=10, cols=4):
    n = len(icons)
    rows = (n + cols - 1) // cols
    sheet = Canvas(cols * (16 * scale + 8) + 8, rows * (16 * scale + 8) + 8, (52, 59, 74, 255))
    for i, ic in enumerate(icons):
        big = ic.scaled(scale)
        sheet.blit(big, 8 + (i % cols) * (16 * scale + 8), 8 + (i // cols) * (16 * scale + 8), skip_transparent=True)
    return sheet

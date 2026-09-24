"""Generate every PNG used by the Arcane Arsenal resource/behavior packs.

Run:  python3 tools/make_textures.py
No third-party libraries needed.
"""
import math
import os
import random

from pixelart import Canvas, hex_rgba, sprite
from sprites import SPRITES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "ArcaneArsenal_RP")
BP = os.path.join(ROOT, "packs", "ArcaneArsenal_BP")

# 8x8 particle cells laid out in a 32x16 atlas. Uppercase = full white,
# lowercase = dimmer (the particle tint multiplies these values).
PARTICLE_CELLS = {
    # name: (column, row, rows, palette)
    "sparkle": (0, 0, [
        "...W....",
        "...W....",
        "..wWw...",
        "WWWWWWW.",
        "..wWw...",
        "...W....",
        "...W....",
        "........",
    ], {"W": "#ffffff", "w": "#c8c8c8"}),
    "dot": (1, 0, [
        "........",
        "..wwww..",
        ".wWWWWw.",
        ".wWWWWw.",
        ".wWWWWw.",
        ".wWWWWw.",
        "..wwww..",
        "........",
    ], {"W": "#ffffff", "w": "#bdbdbd"}),
    "ember": (2, 0, [
        "........",
        "........",
        "...ww...",
        "..wWWw..",
        "..wWWw..",
        "...ww...",
        "........",
        "........",
    ], {"W": "#ffffff", "w": "#9a9a9a"}),
    "flame": (3, 0, [
        "...r....",
        "...ro...",
        "..royr..",
        "..oyWo..",
        ".royWyr.",
        ".oyWWyo.",
        "..oyyo..",
        "...oo...",
    ], {"W": "#fffbe0", "y": "#ffd23f", "o": "#ff8a1e", "r": "#d9361c"}),
    "smoke": (0, 1, [
        "........",
        "..ggg...",
        ".gGGGg..",
        ".gGGGGg.",
        ".gGGGGg.",
        "..gGGg..",
        "...gg...",
        "........",
    ], {"G": "#8a8a8a", "g": "#5c5c5c"}),
    "streak": (1, 1, [
        "........",
        "......W.",
        ".....Ww.",
        "...WWw..",
        "..Ww....",
        ".Ww.....",
        "........",
        "........",
    ], {"W": "#ffffff", "w": "#b0b0b0"}),
    "rune": (2, 1, [
        "..WWWW..",
        ".W....W.",
        "W..WW..W",
        "W.W..W.W",
        "W.W..W.W",
        "W..WW..W",
        ".W....W.",
        "..WWWW..",
    ], {"W": "#ffffff"}),
    "shard": (3, 1, [
        "...W....",
        "..WWw...",
        "..WWw...",
        ".WWWww..",
        "..WWw...",
        "..Ww....",
        "...w....",
        "........",
    ], {"W": "#ffffff", "w": "#b8b8b8"}),
}


def build_particle_atlas():
    atlas = Canvas(32, 16)
    for name, (col, row, grid, pal) in PARTICLE_CELLS.items():
        cell = sprite(grid, pal)
        atlas.paste(cell, col * 8, row * 8)
    return atlas


def lerp(a, b, t):
    return a + (b - a) * t


def build_pack_icon(size=256):
    """Godslayer over a night-sky gradient with a golden halo."""
    icon = Canvas(size, size)
    top = hex_rgba("#1b0b33")
    bottom = hex_rgba("#08142e")
    for y in range(size):
        t = y / (size - 1)
        col = tuple(int(lerp(top[i], bottom[i], t)) for i in range(3)) + (255,)
        for x in range(size):
            icon.set(x, y, col)
    # stars
    rng = random.Random(7)
    for _ in range(70):
        x, y = rng.randrange(size), rng.randrange(size)
        b = rng.randint(120, 255)
        icon.set(x, y, (b, b, min(255, b + 20), 255))
    # halo
    cx, cy = size * 0.5, size * 0.5
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / (size * 0.48)
            if d < 1:
                a = int(150 * (1 - d) ** 2)
                icon.blend(x, y, (255, 200, 80, a))
    # the Mythic weapon, scaled up pixel-perfect
    grid, pal, outline, no = SPRITES["celestial_godslayer"]
    art = sprite(grid, pal, outline, no)
    scale = size // 16 - 3
    offset = (size - 16 * scale) // 2
    icon.paste(art, offset, offset, scale)
    # thin golden frame
    gold = hex_rgba("#ffd23f")
    dark = hex_rgba("#2c1a00")
    for i in range(size):
        for w, c in ((0, dark), (1, dark), (2, gold), (3, dark)):
            icon.set(i, w, c)
            icon.set(i, size - 1 - w, c)
            icon.set(w, i, c)
            icon.set(size - 1 - w, i, c)
    return icon


def main():
    items_dir = os.path.join(RP, "textures", "items")
    particle_dir = os.path.join(RP, "textures", "particle")
    os.makedirs(items_dir, exist_ok=True)
    os.makedirs(particle_dir, exist_ok=True)
    for name, (grid, pal, outline, no_outline) in SPRITES.items():
        sprite(grid, pal, outline, no_outline).save(os.path.join(items_dir, name + ".png"))
    build_particle_atlas().save(os.path.join(particle_dir, "arcane_particles.png"))
    icon = build_pack_icon()
    icon.save(os.path.join(RP, "pack_icon.png"))
    icon.save(os.path.join(BP, "pack_icon.png"))
    print("textures written:", len(SPRITES), "items + particle atlas + pack icons")


if __name__ == "__main__":
    main()

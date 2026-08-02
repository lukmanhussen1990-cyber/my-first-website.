"""Generates every PNG in the NPC Kingdom resource pack."""

import os

from pngwrite import Canvas, grain, rgb, shade
from skinbuild import build_skin, faces

SKIN_LIGHT = rgb(0xE4B38A)
SKIN_MID = rgb(0xC98C5E)
SKIN_TAN = rgb(0xA9713F)
SKIN_DARK = rgb(0x7A4E29)
SKIN_UNDEAD = rgb(0x6E8B5A)
SKIN_BONE = rgb(0xDCD6C2)

IRON = rgb(0xB4B4BE)
IRON_DARK = rgb(0x7C7C88)
GOLD = rgb(0xF0C64A)
GOLD_DARK = rgb(0xB08A16)
LEATHER = rgb(0x8A5A32)
CLOTH_BROWN = rgb(0x6B4A2E)
CLOTH_GREY = rgb(0x4A4A52)


def _white_beard(s):
    s.face_features(beard=rgb(0xE6E6E6), brow=rgb(0xD8D8D8))


def _glow_eyes(color):
    def apply(s):
        f = faces("head")["front"]
        s.rect(f[0] + 1, f[1] + 3, 2, 1, color)
        s.rect(f[0] + 5, f[1] + 3, 2, 1, color)
    return apply


def _apron(s):
    x, y, w, h = faces("jacket")["front"]
    s.rect(x + 2, y + 2, w - 4, h - 3, rgb(0x3A2A20))
    s.rect(x + 3, y + 6, 2, 2, rgb(0x2A1E16))


def _red_cross(s):
    x, y, w, h = faces("body")["front"]
    s.rect(x + 3, y + 2, 2, 6, rgb(0xC63A32))
    s.rect(x + 1, y + 4, 6, 2, rgb(0xC63A32))


def _straw_hat(s):
    for name in ("top", "front", "back", "right", "left"):
        x, y, w, h = faces("hat")[name]
        if name == "top":
            s.rect(x, y, w, h, rgb(0xD9BE6A))
        else:
            s.rect(x, y, w, 4, rgb(0xD9BE6A))
            s.rect(x, y + 3, w, 1, rgb(0xA98F44))


def _miner_lamp(s):
    x, y, w, h = faces("hat")["front"]
    s.rect(x + 3, y + 1, 2, 2, rgb(0xFFF3A8))
    s.rect(x + 3, y + 1, 2, 1, rgb(0xFFFFD8))


def _plaid(s):
    x, y, w, h = faces("body")["front"]
    for i in range(0, w, 3):
        s.rect(x + i, y, 1, h, rgb(0x7A1F1F))
    for j in range(0, h, 3):
        s.rect(x, y + j, w, 1, rgb(0x7A1F1F))
    x, y, w, h = faces("body")["back"]
    for i in range(0, w, 3):
        s.rect(x + i, y, 1, h, rgb(0x7A1F1F))


def _chain_mail(s):
    for part in ("body", "arm_r", "arm_l"):
        for name in ("front", "back", "right", "left"):
            x, y, w, h = faces(part)[name]
            for j in range(h):
                for i in range(w):
                    if (i + j) % 2 == 0:
                        s.set(x + i, y + j, shade(s.get(x + i, y + j), 0.86))


def _torn_robe(s):
    x, y, w, h = faces("jacket")["front"]
    for i in range(w):
        if i % 3 != 1:
            s.rect(x + i, y + h - 3, 1, 3, (0, 0, 0, 0))


def _rot(s):
    for part in ("head", "body", "arm_r", "arm_l", "leg_r", "leg_l"):
        for name, (x, y, w, h) in faces(part).items():
            for j in range(h):
                for i in range(w):
                    if ((i * 7 + j * 13) % 11) == 0:
                        s.set(x + i, y + j, shade(s.get(x + i, y + j), 0.7))


# --------------------------------------------------------------------------
# Friendly kingdom NPCs
# --------------------------------------------------------------------------
ROLE_SKINS = {
    "builder": dict(
        skin=SKIN_MID, shirt=rgb(0x9A6B3A), pants=rgb(0x5A4630), hair=rgb(0x3A2A18),
        belt=rgb(0x3A2A18), buckle=GOLD, boots=rgb(0x4A3A28), gloves=rgb(0x6B4A2E),
        helmet=rgb(0xE0A81E), helmet_trim=rgb(0xB07E10), salt=1,
    ),
    "farmer": dict(
        skin=SKIN_LIGHT, shirt=rgb(0x7FA24A), pants=rgb(0x6B5432), hair=rgb(0x8A6A32),
        belt=rgb(0x4A3620), boots=rgb(0x54402A), extras=[_straw_hat], salt=2,
    ),
    "miner": dict(
        skin=SKIN_TAN, shirt=rgb(0x4A4A56), pants=rgb(0x39496B), hair=rgb(0x2A2018),
        belt=rgb(0x2E2620), buckle=IRON, boots=rgb(0x33302C), gloves=rgb(0x5A4A38),
        helmet=rgb(0xC24A22), helmet_trim=rgb(0x8E3216), extras=[_miner_lamp], salt=3,
    ),
    "lumberjack": dict(
        skin=SKIN_MID, shirt=rgb(0xB0392F), pants=rgb(0x4A5A38), hair=rgb(0x5A3A1A),
        beard=rgb(0x5A3A1A), belt=rgb(0x3A2A18), boots=rgb(0x4A3A28),
        extras=[_plaid], salt=4,
    ),
    "guard": dict(
        skin=SKIN_LIGHT, shirt=IRON, pants=IRON_DARK, hair=rgb(0x4A3A22),
        helmet=IRON, helmet_trim=rgb(0x8C8C98), tabard=rgb(0x2F5BA8), emblem=GOLD,
        belt=rgb(0x3A3A42), boots=rgb(0x5A5A66), gloves=IRON_DARK,
        pads=IRON, extras=[_chain_mail], salt=5,
    ),
    "archer": dict(
        skin=SKIN_TAN, shirt=rgb(0x3E6B38), pants=rgb(0x4A3A26), hair=rgb(0x3A2A18),
        hood=rgb(0x2F5A2C), belt=rgb(0x54402A), boots=rgb(0x40301E),
        gloves=rgb(0x6B4A2E), salt=6,
    ),
    "knight": dict(
        skin=SKIN_LIGHT, shirt=rgb(0xC6C6D2), pants=rgb(0x9A9AA8), hair=rgb(0x3A2A18),
        helmet=rgb(0xD2D2DE), helmet_trim=rgb(0x8C8C98), visor=True,
        tabard=rgb(0xB0302A), emblem=GOLD, pads=rgb(0xD2D2DE),
        belt=GOLD_DARK, boots=rgb(0x8C8C98), gloves=rgb(0x9A9AA8),
        extras=[_chain_mail], salt=7,
    ),
    "healer": dict(
        skin=SKIN_LIGHT, shirt=rgb(0xEFEFE6), pants=rgb(0xD8D8CC), hair=rgb(0x8A6A32),
        sleeve_len=10, belt=rgb(0xC63A32), boots=rgb(0xBEBEB2),
        extras=[_red_cross], salt=8,
    ),
    "merchant": dict(
        skin=SKIN_DARK, shirt=rgb(0x6B3E8E), pants=rgb(0x4A2A62), hair=rgb(0x241810),
        beard=rgb(0x241810), sleeve_len=8, belt=GOLD_DARK, buckle=GOLD,
        boots=rgb(0x54402A), tabard=rgb(0x8E5AB8), emblem=GOLD, salt=9,
    ),
    "blacksmith": dict(
        skin=SKIN_TAN, shirt=rgb(0x8A5A2E), pants=rgb(0x3A2E24), hair=rgb(0x2A1E14),
        beard=rgb(0x2A1E14), belt=rgb(0x2A1E14), boots=rgb(0x3A2E24),
        gloves=rgb(0x4A3626), extras=[_apron], salt=10,
    ),
    "royal_guard": dict(
        skin=SKIN_MID, shirt=GOLD, pants=GOLD_DARK, hair=rgb(0x3A2A18),
        helmet=GOLD, helmet_trim=rgb(0x8A6A10), visor=True,
        tabard=rgb(0x6B2A8E), emblem=rgb(0xFFF0A0), pads=GOLD,
        belt=rgb(0x4A2A62), boots=GOLD_DARK, gloves=GOLD_DARK,
        extras=[_chain_mail], salt=11,
    ),
    "general": dict(
        skin=SKIN_LIGHT, shirt=rgb(0x7A1E1E), pants=rgb(0x3A2A2A), hair=rgb(0x50402A),
        beard=rgb(0x50402A), helmet=rgb(0x8A2222), helmet_trim=GOLD,
        tabard=rgb(0x501414), emblem=GOLD, pads=GOLD_DARK,
        belt=GOLD_DARK, buckle=GOLD, boots=rgb(0x2A2020), gloves=rgb(0x4A3030),
        crown=True, salt=12,
    ),
    "advisor": dict(
        skin=SKIN_LIGHT, shirt=rgb(0x2F4A8E), pants=rgb(0x24386B), hair=rgb(0xE6E6E6),
        sleeve_len=11, belt=GOLD_DARK, boots=rgb(0x2A2438),
        tabard=rgb(0x3A5AA8), emblem=GOLD, extras=[_white_beard], salt=13,
    ),
}

# --------------------------------------------------------------------------
# Enemies and bosses
# --------------------------------------------------------------------------
ENEMY_SKINS = {
    "bandit": dict(
        skin=SKIN_TAN, shirt=rgb(0x4A3A2A), pants=rgb(0x33281E), hair=rgb(0x1E1610),
        belt=rgb(0x1E1610), boots=rgb(0x2A2018), gloves=rgb(0x3A2E22),
        hood=rgb(0x2E2418), salt=21,
    ),
    "raider": dict(
        skin=SKIN_MID, shirt=rgb(0x54324A), pants=rgb(0x2E2436), hair=rgb(0x1A1A1A),
        beard=rgb(0x1A1A1A), belt=rgb(0x1A1A1A), boots=rgb(0x24202A),
        pads=IRON_DARK, tabard=rgb(0x7A2A2A), emblem=rgb(0x1A1A1A), salt=22,
    ),
    "dark_knight": dict(
        skin=rgb(0x3A3A44), shirt=rgb(0x2A2A34), pants=rgb(0x1E1E26),
        helmet=rgb(0x24242E), helmet_trim=rgb(0x7A1414), visor=True,
        tabard=rgb(0x5A1414), emblem=rgb(0x1A1A1A), pads=rgb(0x1E1E26),
        belt=rgb(0x141418), boots=rgb(0x1A1A22), gloves=rgb(0x24242E),
        extras=[_glow_eyes(rgb(0xE03A2A)), _chain_mail], salt=23,
    ),
    "undead_soldier": dict(
        skin=SKIN_UNDEAD, shirt=rgb(0x5A6B4A), pants=rgb(0x3E4A36), hair=rgb(0x2A3020),
        helmet=rgb(0x6B6B60), helmet_trim=rgb(0x4A4A42), belt=rgb(0x3A3A30),
        boots=rgb(0x33332C), extras=[_rot, _torn_robe, _glow_eyes(rgb(0xC8D86A))],
        salt=24,
    ),
    "enemy_archer": dict(
        skin=SKIN_TAN, shirt=rgb(0x2E3A2A), pants=rgb(0x28241C), hair=rgb(0x1E1610),
        hood=rgb(0x1E2A1A), belt=rgb(0x2A2018), boots=rgb(0x241C14),
        gloves=rgb(0x33281E), salt=25,
    ),
    "enemy_wizard": dict(
        skin=rgb(0xB8A88E), shirt=rgb(0x46226B), pants=rgb(0x30164A),
        hood=rgb(0x3A1A5A), sleeve_len=11, belt=GOLD_DARK,
        boots=rgb(0x241038), tabard=rgb(0x5A2A8E), emblem=rgb(0x9AE0FF),
        extras=[_glow_eyes(rgb(0x9AE0FF))], salt=26,
    ),
    "bandit_king": dict(
        skin=SKIN_TAN, shirt=rgb(0x6B4A22), pants=rgb(0x3E2E1A), hair=rgb(0x2A1A10),
        beard=rgb(0x2A1A10), crown=True, tabard=rgb(0x8A5A18), emblem=GOLD,
        pads=GOLD_DARK, belt=GOLD_DARK, buckle=GOLD, boots=rgb(0x2E2418),
        gloves=rgb(0x4A3626), salt=27,
    ),
    "dark_wizard": dict(
        skin=rgb(0x8E7A9A), shirt=rgb(0x1E1030), pants=rgb(0x140A22),
        hood=rgb(0x24123A), sleeve_len=11, belt=rgb(0x7A1E9A),
        boots=rgb(0x100818), tabard=rgb(0x3A1A5A), emblem=rgb(0xD86AFF),
        crown=(rgb(0x9A4ADA), rgb(0x5A1E8A), rgb(0x2AF0C8)),
        extras=[_glow_eyes(rgb(0xD86AFF))], salt=28,
    ),
    "undead_emperor": dict(
        skin=SKIN_BONE, shirt=rgb(0x4A4438), pants=rgb(0x33302A),
        crown=True, tabard=rgb(0x2A2A24), emblem=GOLD, pads=GOLD_DARK,
        belt=GOLD_DARK, buckle=GOLD, boots=rgb(0x2A2822), gloves=rgb(0x3A3830),
        extras=[_rot, _torn_robe, _glow_eyes(rgb(0x6AE0D8))], salt=29,
    ),
}

# --------------------------------------------------------------------------
# 16x16 item art
# --------------------------------------------------------------------------
P = {
    "K": rgb(0x101018),   # outline
    "g": rgb(0xF2D45C),   # gold light
    "G": rgb(0xC9A02A),   # gold
    "d": rgb(0x8A6A10),   # gold dark
    "b": rgb(0x3A6BD8),   # blue
    "B": rgb(0x21418E),   # blue dark
    "c": rgb(0x7FE8FF),   # cyan glow
    "r": rgb(0xD03A32),   # red
    "R": rgb(0x8E1E18),   # red dark
    "p": rgb(0x8A4ACA),   # purple
    "P": rgb(0x552A8A),   # purple dark
    "w": rgb(0xEFEFE6),   # white
    "s": rgb(0xB4B4BE),   # steel
    "S": rgb(0x70707C),   # steel dark
    "n": rgb(0x8A5A32),   # wood
    "N": rgb(0x5A3A1E),   # wood dark
    "e": rgb(0x3ED66E),   # emerald
    "E": rgb(0x1E8E46),   # emerald dark
    "k": rgb(0x2A2430),   # dark cloth
    "y": rgb(0xFFF6C0),   # highlight
}

ITEM_ART = {
    "kingdom_core": [
        "................",
        "......KKKK......",
        ".....KggggK.....",
        "....KgGddGgK....",
        "...KGdBbbBdGK...",
        "...KdBbccbBdK...",
        "..KGdBcyycBdGK..",
        "..KgdBcyycBdgK..",
        "..KGdBcyycBdGK..",
        "...KdBbccbBdK...",
        "...KGdBbbBdGK...",
        "....KgGddGgK....",
        ".....KggggK.....",
        "......KKKK......",
        "................",
        "................",
    ],
    "command_staff": [
        ".........KKK....",
        "........KgcgK...",
        ".......KgcccgK..",
        ".......KccyccK..",
        ".......KgcccgK..",
        "........KgcgK...",
        ".......KGKKKG...",
        "......KGnNK.....",
        ".....KGnNK......",
        "....KGnNK.......",
        "...KGnNK........",
        "..KGnNK.........",
        ".KGnNK..........",
        ".KnNK...........",
        "KNK.............",
        "KK..............",
    ],
    "command_banner": [
        "..KKKKKKKKKK....",
        "..KggggggggK....",
        "..KrRrRrRrRK.K..",
        "..KrggggggrK.K..",
        "..KrgGddGgrK.K..",
        "..KrgdyydgrK.K..",
        "..KrgGddGgrK.K..",
        "..KrggggggrK.K..",
        "..KrRrRrRrRK.K..",
        "..KrKrKrKrKK.K..",
        "...K.K.K.K...K..",
        ".............K..",
        ".............K..",
        ".............K..",
        ".............K..",
        "..............K.",
    ],
    "royal_ledger": [
        "................",
        "..KKKKKKKKKKK...",
        "..KnNNNNNNNNK...",
        "..KNwwwwwwwNK...",
        "..KNwKKKKKwNK...",
        "..KNwwwwwwwNK...",
        "..KNwKKKKKwNK...",
        "..KNwwwwwwwNK...",
        "..KNwKKKwwwNK...",
        "..KNwwwwwwwNK...",
        "..KNwKKKKKwNK...",
        "..KNwwwwwwwNK...",
        "..KnNNNNNNNNK...",
        "..KKKKKKKKKKK...",
        "....KGggGK......",
        ".....KddK.......",
    ],
    "celebration_horn": [
        "................",
        "...........KKK..",
        "..........KgggK.",
        ".........KgGyGK.",
        "........KgGKKgK.",
        ".......KgGK.KgK.",
        "......KgGK..KgK.",
        ".....KgGK...KgK.",
        "....KgGK...KgK..",
        "...KgGK...KgK...",
        "..KgGK..KKgK....",
        "..KgKKKKGgK.....",
        "..KdGggggK......",
        "...KddddK.......",
        "....KKKK........",
        "................",
    ],
    "war_horn": [
        "................",
        "...........KKK..",
        "..........KrRrK.",
        ".........KrRKRK.",
        "........KrRK.KK.",
        ".......KrRK.....",
        "......KrRK......",
        ".....KrRK.......",
        "....KrRK........",
        "...KrRK.........",
        "..KrRK..........",
        "..KRKKKKK.......",
        "..KkRrrrRK......",
        "...KkkkkK.......",
        "....KKKK........",
        "................",
    ],
    "royal_crown": [
        "................",
        "................",
        "..K..K..K..K....",
        ".KgK.KgK.KgK....",
        ".KgKKKgKKKgK....",
        ".KggggggggggK...",
        ".KgGrGgGbGgGK...",
        ".KGddddddddGK...",
        ".KdddddddddK....",
        "..KKKKKKKKK.....",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    "royal_chestplate": [
        "................",
        "..KKK....KKK....",
        ".KgGK....KGgK...",
        ".KgGKKKKKKGgK...",
        ".KgGgggggggGgK..",
        ".KgGgpppppgGgK..",
        ".KgGgpGGGpgGgK..",
        ".KgGgpGyGpgGgK..",
        ".KgKgpGGGpgKgK..",
        "..K.gpppppg.K...",
        "....gggggggK....",
        "....KdddddK.....",
        "....KGgggGK.....",
        "....KKKKKKK.....",
        "................",
        "................",
    ],
    "royal_leggings": [
        "................",
        "................",
        "..KKKKKKKKKKK...",
        "..KgggggggggK...",
        "..KgGdGdGdGgK...",
        "..KgpppppppgK...",
        "..KgpGgggGpgK...",
        "..KgpgKKKgpgK...",
        "..KgpgK.KgpgK...",
        "..KggK...KggK...",
        "..KgGK...KGgK...",
        "..KgGK...KGgK...",
        "..KddK...Kddk...",
        "..KKK.....KKK...",
        "................",
        "................",
    ],
    "royal_boots": [
        "................",
        "................",
        "................",
        "................",
        "..KKK.....KKK...",
        "..KgK.....KgK...",
        "..KgK.....KgK...",
        "..KgGK...KGgK...",
        "..KgGK...KGgK...",
        ".KKgGKK.KKGgKK..",
        ".KggGGK.KGGggK..",
        ".KGdddK.KdddGK..",
        ".KKKKKK.KKKKKK..",
        "................",
        "................",
        "................",
    ],
}


def _tile_texture(name):
    """Textures for the kingdom core entity (64x64) and the crown model (32x32)."""
    c = Canvas(32, 32)
    if name == "kingdom_core_entity":
        c = Canvas(64, 64)
        base = rgb(0x3A3550)
        c.rect(0, 0, 64, 64, base)
        for j in range(64):
            for i in range(64):
                if (i // 4 + j // 4) % 2 == 0:
                    c.set(i, j, shade(base, 1.12))
        # gold trim across the plinth region (uv 0,0)
        c.rect(0, 4, 48, 2, rgb(0xC9A02A))
        c.rect(0, 12, 48, 2, rgb(0xC9A02A))
        # shaft region (uv 0,16)
        c.rect(0, 20, 32, 2, rgb(0xC9A02A))
        c.rect(0, 30, 32, 2, rgb(0xC9A02A))
        # glowing gem region (uv 32,16 -> 24x12)
        c.rect(32, 16, 24, 12, rgb(0x2E86C8))
        c.rect(32, 18, 24, 8, rgb(0x63D8FF))
        c.rect(32, 20, 24, 4, rgb(0xCFF6FF))
        # cap region (uv 0,36 -> 40x12)
        c.rect(0, 36, 40, 12, rgb(0xC9A02A))
        c.rect(0, 40, 40, 4, rgb(0xF2D45C))
        grain(c, 0, 0, 64, 64, 0.10, 5)
    elif name == "crown_model":
        c.rect(0, 0, 32, 32, rgb(0xE7C43F))
        for j in range(32):
            for i in range(32):
                if (i * 5 + j * 3) % 9 == 0:
                    c.set(i, j, rgb(0xF7E58A))
                elif (i * 3 + j * 7) % 11 == 0:
                    c.set(i, j, rgb(0xB0870F))
        c.rect(4, 4, 3, 3, rgb(0xD0332F))
        c.rect(14, 6, 3, 3, rgb(0x2F5BD8))
        c.rect(24, 3, 3, 3, rgb(0x3ED66E))
        grain(c, 0, 0, 32, 32, 0.08, 6)
    return c


def _royal_armor_texture():
    """64x32 armour sheet shared by the chestplate / leggings / boots models."""
    c = Canvas(64, 32)
    gold = rgb(0xE7C43F)
    gold_d = rgb(0xB0870F)
    purple = rgb(0x6B2A8E)

    def block(ox, oy, w, h, d, primary, accent=None, only=None):
        regions = {
            "top": (ox + d, oy, w, d),
            "bottom": (ox + d + w, oy, w, d),
            "right": (ox, oy + d, d, h),
            "front": (ox + d, oy + d, w, h),
            "left": (ox + d + w, oy + d, d, h),
            "back": (ox + d + w + d, oy + d, w, h),
        }
        for name, (x, y, rw, rh) in regions.items():
            if only and name not in only:
                continue
            c.rect(x, y, rw, rh, primary)
            if accent:
                c.rect(x, y + rh - 1, rw, 1, accent)

    # helmet block unused (crown has its own model) - leave transparent
    block(16, 16, 8, 12, 4, gold, gold_d)      # body
    block(40, 16, 4, 12, 4, gold, gold_d)      # arm
    block(0, 16, 4, 12, 4, gold, gold_d)       # leg
    # purple surcoat down the chest
    c.rect(22, 22, 4, 9, purple)
    c.rect(38, 22, 4, 9, purple)
    grain(c, 0, 0, 64, 32, 0.09, 7)
    return c


def _pack_icon(primary, secondary, letter_art):
    c = Canvas(64, 64)
    for j in range(64):
        for i in range(64):
            t = (i + j) / 128.0
            c.set(i, j, shade(primary, 0.75 + t * 0.6))
    c.outline(0, 0, 64, 64, rgb(0x101018))
    c.outline(2, 2, 60, 60, secondary)
    # a simple crown emblem
    crown = [
        "..K...K...K..",
        ".KgK.KgK.KgK.",
        ".KgKKKgKKKgK.",
        ".KggggggggggK",
        ".KgGrGgGbGgGK",
        ".KGddddddddGK",
        "..KKKKKKKKK..",
    ]
    c.blit_art(24, 20, crown, P)
    for j, row in enumerate(letter_art):
        for i, ch in enumerate(row):
            if ch == "#":
                c.set(14 + i, 42 + j, rgb(0xF5EFD0))
    return c


def _blank(size=8):
    return Canvas(size, size)


def generate(rp_root):
    """Write every texture into the resource pack tree."""
    ent_dir = os.path.join(rp_root, "textures", "entity", "npck")
    item_dir = os.path.join(rp_root, "textures", "items", "npck")
    armor_dir = os.path.join(rp_root, "textures", "models", "armor")
    for d in (ent_dir, item_dir, armor_dir):
        os.makedirs(d, exist_ok=True)

    written = []
    for name, spec in list(ROLE_SKINS.items()) + list(ENEMY_SKINS.items()):
        path = os.path.join(ent_dir, name + ".png")
        build_skin(spec).save(path)
        written.append(path)

    _tile_texture("kingdom_core_entity").save(os.path.join(ent_dir, "kingdom_core.png"))
    _tile_texture("crown_model").save(os.path.join(armor_dir, "npck_crown.png"))
    _royal_armor_texture().save(os.path.join(armor_dir, "npck_royal_armor.png"))
    _blank().save(os.path.join(ent_dir, "invisible.png"))

    for name, art in ITEM_ART.items():
        c = Canvas(16, 16)
        c.blit_art(0, 0, art, P)
        grain(c, 0, 0, 16, 16, 0.06, 3)
        c.save(os.path.join(item_dir, name + ".png"))

    _pack_icon(rgb(0x2F5BA8), rgb(0xE7C43F),
               ["#..#.###.", "##.#.#.#.", "#.##.###.", "#..#.#..."]).save(
        os.path.join(rp_root, "pack_icon.png"))
    return written


def generate_bp_icon(bp_root):
    _pack_icon(rgb(0x6B2A8E), rgb(0xE7C43F),
               ["###.###.", "#.#.#..", "###.###", "#...#.."]).save(
        os.path.join(bp_root, "pack_icon.png"))

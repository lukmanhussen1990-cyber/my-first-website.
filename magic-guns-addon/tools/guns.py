"""
guns.py - the seven magical guns, authored as boxes in Blockbench space.

Conventions (units = model pixels, 16 per block):
  * the barrel points to -Z, +Y is up, the model is centred on x = 0
  * the shooting hand wraps the grip just below the origin: (0, 0, 0) is the
    top-centre of the grip where the web of the thumb sits
  * every gun has a root bone "magic_gun" (bound to the hand in game) and a
    child "body" bone; some have extra animated bones (spinning cylinder,
    floating orb, halo...)
"""

from gunsmith import (Model, metal, wood, leather_wrap, knurl, bone, obsidian, patina,
                      trimmed, glow, runes, coil, skull_face, flat)

# ------------------------------------------------------------------ palette

GUNMETAL = metal((0.22, 0.24, 0.28), (0.55, 0.60, 0.68))
DARK_STEEL = metal((0.11, 0.11, 0.13), (0.38, 0.38, 0.44), band=0.18)
BLUED = metal((0.13, 0.17, 0.27), (0.42, 0.52, 0.70))
FROST_STEEL = metal((0.70, 0.78, 0.85), (0.95, 0.98, 1.0), streak=0.07)
SILVER = metal((0.70, 0.71, 0.75), (0.98, 0.98, 1.0), band=0.3)
GOLD = metal((0.80, 0.58, 0.16), (1.0, 0.90, 0.50), streak=0.08, band=0.35)
BRASS = metal((0.72, 0.53, 0.25), (0.98, 0.84, 0.52), streak=0.08, band=0.3)
COPPER = metal((0.72, 0.42, 0.28), (0.98, 0.72, 0.55), streak=0.08, band=0.3)
WHITE_PLATE = metal((0.86, 0.85, 0.80), (1.0, 1.0, 0.97), streak=0.04, band=0.15)
EBONY = wood((0.20, 0.12, 0.09), (0.09, 0.05, 0.04))
WALNUT = wood((0.36, 0.22, 0.12), (0.18, 0.10, 0.05))
BIRCH = wood((0.84, 0.78, 0.64), (0.62, 0.55, 0.42))
LEATHER = leather_wrap((0.38, 0.22, 0.12), (0.16, 0.09, 0.05))
GRIP = knurl((0.10, 0.10, 0.11), (0.30, 0.30, 0.33))
BONE = bone()
OBSIDIAN = obsidian()
PATINA = patina()

ARCANE = (0.72, 0.32, 1.0)
FIRE = (1.0, 0.52, 0.08)
FROST = (0.52, 0.93, 1.0)
STORM = (0.36, 0.66, 1.0)
SOUL = (0.30, 0.96, 0.92)
VOID = (0.85, 0.28, 1.0)
HOLY = (1.0, 0.88, 0.42)


GLOVE = leather_wrap((0.12, 0.10, 0.10), (0.05, 0.04, 0.04), period=4)
KNUCKLE = metal((0.16, 0.15, 0.17), (0.45, 0.44, 0.50), band=0.2)
COAT = wood((0.20, 0.10, 0.32), (0.13, 0.06, 0.22), rings=2.0)  # woven-cloth look


def palette(**extra):
    p = {
        "glove": GLOVE, "knuckle": KNUCKLE, "coat": COAT,
        "gunmetal": GUNMETAL, "dark_steel": DARK_STEEL, "blued": BLUED,
        "frost_steel": FROST_STEEL, "silver": SILVER, "gold": GOLD, "brass": BRASS,
        "copper": COPPER, "white_plate": WHITE_PLATE, "ebony": EBONY, "walnut": WALNUT,
        "birch": BIRCH, "leather": LEATHER, "grip": GRIP, "bone": BONE,
        "obsidian": OBSIDIAN, "patina": PATINA,
    }
    p.update(extra)
    return p


# ------------------------------------------------------------- the arsenal

def arcane_revolver():
    m = Model("arcane_revolver", palette(
        engraved=trimmed(GUNMETAL, GOLD),
        rune_barrel=runes(GUNMETAL, ARCANE),
        cyl=runes(DARK_STEEL, ARCANE, 0.7),
        amethyst=glow(ARCANE, (0.36, 0.12, 0.62)),
    ))
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("cylinder", "body", pivot=(0, 1.75, -1.0))
    b = "body"
    # grip (ebony, raked back) + gold butt cap
    grip = m.box(b, (-0.75, -4.6, 0.1), (0.75, 0.2, 2.1), "ebony", rotation=(-14, 0, 0), pivot=(0, 0, 1.1))
    m.box(b, (-0.85, -5.0, 0.5), (0.85, -4.4, 2.6), "gold", rotation=(-14, 0, 0), pivot=(0, 0, 1.1))
    # frame
    m.box(b, (-0.75, -0.2, -2.9), (0.75, 1.0, 2.1), "engraved")
    m.box(b, (-0.7, 1.0, 0.4), (0.7, 2.7, 2.3), "engraved")
    m.box(b, (-0.6, 2.7, -2.7), (0.6, 3.15, 0.9), "gunmetal")
    # hammer
    m.box(b, (-0.3, 2.4, 1.9), (0.3, 3.2, 2.8), "gold", rotation=(25, 0, 0), pivot=(0, 2.4, 2.2))
    # trigger + guard
    m.box(b, (-0.15, -1.1, -0.7), (0.15, -0.2, -0.35), "gold")
    m.box(b, (-0.25, -1.5, -1.7), (0.25, -1.1, 0.4), "gold")
    m.box(b, (-0.25, -1.1, -1.7), (0.25, -0.2, -1.3), "gold")
    # cylinder: octagonal prism (two boxes, one turned 45 degrees about the barrel axis)
    m.box("cylinder", (-1.15, 0.6, -2.5), (1.15, 2.9, 0.4), "cyl")
    m.box("cylinder", (-1.15, 0.6, -2.45), (1.15, 2.9, 0.35), "cyl", rotation=(0, 0, 45), pivot=(0, 1.75, -1.0))
    m.box("cylinder", (-0.45, 1.3, -2.6), (0.45, 2.2, -2.45), "amethyst")
    # barrel with glowing sigils, ejector housing, muzzle crown
    m.box(b, (-0.62, 1.35, -8.6), (0.62, 2.6, -2.5), "rune_barrel")
    m.box(b, (-0.48, 0.7, -7.6), (0.48, 1.35, -2.5), "gunmetal")
    m.box(b, (-0.82, 1.18, -9.1), (0.82, 2.78, -8.4), "gold")
    m.box(b, (-0.38, 1.6, -9.16), (0.38, 2.35, -9.1), "amethyst")
    m.box(b, (-0.14, 2.6, -8.4), (0.14, 3.15, -7.9), "gold")
    # floating amethyst shard over the frame
    m.box(b, (-0.35, 3.5, -1.6), (0.35, 4.2, -0.9), "amethyst", rotation=(45, 0, 45), pivot=(0, 3.85, -1.25))
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {"cylinder": "z"}, "grip": grip}


def inferno_blaster():
    m = Model("inferno_blaster", palette(
        magma=glow(FIRE, (0.75, 0.16, 0.02), lines=(1.0, 0.95, 0.6)),
        vent=coil(DARK_STEEL, FIRE, 2),
        rune_brass=runes(BRASS, FIRE),
    ))
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("core", "body", pivot=(0, 1.55, -1.6))
    b = "body"
    grip = m.box(b, (-0.8, -4.7, 0.1), (0.8, 0.2, 2.2), "leather", rotation=(-12, 0, 0), pivot=(0, 0, 1.1))
    m.box(b, (-0.9, -5.1, 0.4), (0.9, -4.5, 2.6), "brass", rotation=(-12, 0, 0), pivot=(0, 0, 1.1))
    m.box(b, (-1.1, -0.3, -3.2), (1.1, 1.1, 2.4), "dark_steel")
    m.box(b, (-1.0, 1.1, 0.0), (1.0, 2.9, 2.5), "rune_brass")
    m.box(b, (-0.3, 2.6, 2.1), (0.3, 3.4, 3.0), "brass", rotation=(30, 0, 0), pivot=(0, 2.6, 2.4))
    # magma chamber caged in brass
    m.box("core", (-1.25, 0.35, -3.0), (1.25, 2.75, -0.2), "magma")
    m.box("core", (-1.25, 0.35, -2.95), (1.25, 2.75, -0.25), "magma", rotation=(0, 0, 45), pivot=(0, 1.55, -1.6))
    for z in (-3.15, -1.85, -0.5):
        m.box(b, (-1.4, 0.2, z), (1.4, 2.9, z + 0.4), "brass")
    # barrel, heat vents, fin
    m.box(b, (-0.9, 0.55, -8.2), (0.9, 2.35, -3.1), "vent")
    m.box(b, (-0.08, 2.35, -7.6), (0.08, 3.0, -3.4), "brass")
    # flared bell muzzle
    m.box(b, (-1.2, 0.25, -9.0), (1.2, 2.65, -8.2), "brass")
    m.box(b, (-1.5, -0.05, -9.7), (1.5, 2.95, -9.0), "brass")
    m.box(b, (-1.1, 0.35, -9.78), (1.1, 2.55, -9.7), "magma")
    # trigger + guard
    m.box(b, (-0.15, -1.1, -0.8), (0.15, -0.3, -0.45), "brass")
    m.box(b, (-0.25, -1.55, -1.9), (0.25, -1.15, 0.4), "brass")
    m.box(b, (-0.25, -1.15, -1.9), (0.25, -0.3, -1.5), "brass")
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {}, "grip": grip}


def frostbite_rifle():
    m = Model("frostbite_rifle", palette(
        ice=glow(FROST, (0.20, 0.55, 0.85)),
        frost_coil=coil(FROST_STEEL, FROST, 2),
        rune_frost=runes(FROST_STEEL, FROST, 0.4),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    # stock (birch) with silver butt plate
    m.box(b, (-0.85, -2.0, 2.4), (0.85, 1.1, 8.6), "birch", rotation=(-6, 0, 0), pivot=(0, 1.0, 2.4))
    m.box(b, (-0.95, -2.5, 8.4), (0.95, 1.2, 9.0), "silver", rotation=(-6, 0, 0), pivot=(0, 1.0, 2.4))
    # pistol grip
    grip = m.box(b, (-0.7, -3.6, 0.6), (0.7, 0.2, 2.3), "birch", rotation=(-16, 0, 0), pivot=(0, 0, 1.4))
    # receiver
    m.box(b, (-0.95, -0.1, -4.4), (0.95, 2.2, 3.0), "rune_frost")
    # ice crystal magazine (raked forward)
    m.box(b, (-0.55, -2.8, -2.8), (0.55, 0.0, -1.2), "ice", rotation=(10, 0, 0), pivot=(0, 0, -2.0))
    # handguard
    m.box(b, (-0.8, 0.1, -10.0), (0.8, 1.1, -4.4), "birch")
    # barrel + frost coils
    m.box(b, (-0.5, 1.0, -16.0), (0.5, 1.95, -4.4), "frost_steel")
    for z in (-8.0, -10.2, -12.4):
        m.box(b, (-0.78, 0.72, z), (0.78, 2.23, z + 1.2), "frost_coil")
    # muzzle + crystal spike
    m.box(b, (-0.72, 0.78, -16.8), (0.72, 2.17, -15.8), "silver")
    m.box(b, (-0.45, 1.02, -17.5), (0.45, 1.92, -16.8), "ice", rotation=(0, 0, 45), pivot=(0, 1.47, -17.1))
    # scope
    m.box(b, (-0.55, 2.75, -4.8), (0.55, 3.85, 1.6), "silver")
    m.box(b, (-0.7, 2.6, -5.6), (0.7, 4.0, -4.6), "silver")
    m.box(b, (-0.55, 2.75, -5.66), (0.55, 3.85, -5.6), "ice")
    m.box(b, (-0.25, 2.2, -3.6), (0.25, 2.75, -2.9), "gunmetal")
    m.box(b, (-0.25, 2.2, -0.2), (0.25, 2.75, 0.5), "gunmetal")
    # trigger + guard
    m.box(b, (-0.15, -1.0, -0.4), (0.15, -0.1, -0.05), "silver")
    m.box(b, (-0.25, -1.45, -1.5), (0.25, -1.05, 0.7), "silver")
    hands(m, grip, fore=(0.1, -7.2, 0.8))
    return m, {"kind": "rifle", "spin": {}, "grip": grip}


def stormcaller():
    m = Model("stormcaller", palette(
        tesla=coil(COPPER, STORM, 2),
        rune_patina=runes(PATINA, STORM, 0.5),
        spark=glow(STORM, (0.10, 0.25, 0.75), lines=(0.95, 0.98, 1.0)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    # walnut stock + copper butt plate
    m.box(b, (-0.9, -2.3, 2.2), (0.9, 1.0, 8.0), "walnut", rotation=(-8, 0, 0), pivot=(0, 1.0, 2.2))
    m.box(b, (-1.0, -2.9, 7.8), (1.0, 1.1, 8.4), "copper", rotation=(-8, 0, 0), pivot=(0, 1.0, 2.2))
    grip = m.box(b, (-0.72, -3.4, 0.6), (0.72, 0.2, 2.3), "walnut", rotation=(-14, 0, 0), pivot=(0, 0, 1.4))
    # receiver with storm runes + capacitor cell
    m.box(b, (-1.1, -0.3, -2.0), (1.1, 1.9, 2.6), "rune_patina")
    m.box(b, (-1.3, 0.25, -1.4), (1.3, 1.35, 0.9), "spark")
    # side-by-side barrels
    m.box(b, (-1.1, 0.15, -13.0), (-0.05, 1.55, -2.0), "blued")
    m.box(b, (0.05, 0.15, -13.0), (1.1, 1.55, -2.0), "blued")
    m.box(b, (-1.2, 0.05, -13.5), (1.2, 1.65, -12.9), "copper")
    m.box(b, (-0.85, 0.4, -13.56), (-0.3, 1.3, -13.5), "spark")
    m.box(b, (0.3, 0.4, -13.56), (0.85, 1.3, -13.5), "spark")
    # tesla coils wrapping both barrels
    for z in (-4.5, -7.2, -9.9):
        m.box(b, (-1.35, -0.1, z), (1.35, 1.8, z + 1.1), "tesla")
    # forend
    m.box(b, (-1.0, -0.6, -8.0), (1.0, 0.15, -2.0), "walnut")
    # lightning rod rib with glowing tip
    m.box(b, (-0.15, 1.55, -12.5), (0.15, 1.95, -2.0), "copper")
    m.box(b, (-0.22, 1.55, -13.0), (0.22, 2.25, -12.5), "spark")
    # trigger + guard
    m.box(b, (-0.15, -1.0, -0.4), (0.15, -0.3, -0.05), "copper")
    m.box(b, (-0.25, -1.45, -1.5), (0.25, -1.05, 0.7), "copper")
    hands(m, grip, fore=(-0.6, -5.3, 1.0))
    return m, {"kind": "rifle", "spin": {}, "grip": grip}


def soul_reaper():
    m = Model("soul_reaper", palette(
        soulfire=glow(SOUL, (0.05, 0.45, 0.50)),
        skull=skull_face(BONE, SOUL),
        rune_obsidian=runes(OBSIDIAN, SOUL, 0.5),
    ))
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    grip = m.box(b, (-0.72, -4.4, 0.2), (0.72, 0.2, 2.1), "bone", rotation=(-14, 0, 0), pivot=(0, 0, 1.1))
    m.box(b, (-0.85, -0.2, -4.2), (0.85, 1.9, 2.8), "rune_obsidian")
    # skull on the back of the receiver (eyes glow with soul fire)
    m.box(b, (-1.0, 1.4, 0.9), (1.0, 3.2, 2.9), "skull")
    # spine ridges
    for z in (-3.6, -2.4, -1.2):
        m.box(b, (-0.15, 1.9, z), (0.15, 2.6, z + 0.6), "bone")
    # soul vials on both flanks
    m.mirror_x(b, (0.85, 0.45, -3.6), (1.2, 1.35, 0.2), "soulfire")
    # barrel with bone fangs
    m.box(b, (-0.5, 0.75, -8.4), (0.5, 1.7, -4.2), "obsidian")
    m.box(b, (-0.62, 0.62, -8.9), (0.62, 1.83, -8.3), "bone")
    m.box(b, (-0.3, 0.95, -8.95), (0.3, 1.5, -8.9), "soulfire")
    m.mirror_x(b, (0.25, 0.25, -9.5), (0.5, 0.75, -8.6), "bone")
    # scythe blade below the barrel
    m.box(b, (-0.08, -0.9, -8.0), (0.08, 0.0, -4.4), "silver", rotation=(-18, 0, 0), pivot=(0, 0, -4.4))
    m.box(b, (-0.08, -1.5, -8.5), (0.08, -0.7, -7.7), "silver", rotation=(-18, 0, 0), pivot=(0, 0, -4.4))
    # soul-lantern magazine
    m.box(b, (-0.55, -2.9, -2.6), (0.55, -0.2, -1.2), "soulfire")
    m.box(b, (-0.65, -3.2, -2.7), (0.65, -2.9, -1.1), "dark_steel")
    m.box(b, (-0.15, -1.0, -0.4), (0.15, -0.2, -0.05), "bone")
    m.box(b, (-0.25, -1.45, -1.3), (0.25, -1.05, 0.6), "dark_steel")
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {}, "grip": grip}


def void_phaser():
    m = Model("void_phaser", palette(
        void_glow=glow(VOID, (0.30, 0.05, 0.45)),
        pearl=glow((0.62, 0.30, 0.95), (0.12, 0.04, 0.22), lines=(0.95, 0.75, 1.0)),
        rune_void=runes(OBSIDIAN, VOID, 0.6),
        prong=metal((0.16, 0.10, 0.22), (0.55, 0.40, 0.70)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("orb", "body", pivot=(0, 1.2, -9.4))
    b = "body"
    grip = m.box(b, (-0.62, -3.6, 1.2), (0.62, 0.2, 2.9), "obsidian", rotation=(-14, 0, 0), pivot=(0, 0, 2.0))
    m.box(b, (-1.0, -0.3, -6.2), (1.0, 2.0, 3.8), "rune_void")
    m.box(b, (-0.32, 2.0, -6.0), (0.32, 2.35, 3.2), "void_glow")
    # skeletal stock
    m.box(b, (-0.5, 0.6, 3.8), (0.5, 1.6, 8.2), "prong")
    m.box(b, (-0.5, -1.9, 3.8), (0.5, -1.0, 7.4), "prong", rotation=(-8, 0, 0), pivot=(0, -1.0, 3.8))
    m.box(b, (-0.6, -2.2, 7.6), (0.6, 1.8, 8.6), "prong")
    # emitter core + three prongs
    m.box(b, (-0.45, 0.65, -7.8), (0.45, 1.75, -6.2), "dark_steel")
    m.box(b, (-0.2, 2.0, -11.6), (0.2, 2.45, -6.2), "prong")
    m.mirror_x(b, (1.0, 0.95, -11.6), (1.45, 1.45, -6.2), "prong")
    m.box(b, (-0.24, 2.0, -12.0), (0.24, 2.5, -11.6), "void_glow")
    m.mirror_x(b, (1.0, 0.92, -12.0), (1.5, 1.48, -11.6), "void_glow")
    # floating ender orb between the prongs
    m.box("orb", (-0.7, 0.5, -10.1), (0.7, 1.9, -8.7), "pearl")
    m.box("orb", (-0.5, 0.7, -10.3), (0.5, 1.7, -8.5), "void_glow", rotation=(45, 45, 0), pivot=(0, 1.2, -9.4))
    # magazine + trigger
    m.box(b, (-0.5, -2.6, -2.4), (0.5, -0.3, -0.9), "void_glow")
    m.box(b, (-0.15, -1.0, 0.4), (0.15, -0.3, 0.75), "prong")
    m.box(b, (-0.25, -1.45, -0.6), (0.25, -1.05, 1.5), "prong")
    hands(m, grip, fore=(-0.3, -4.6, 1.0))
    return m, {"kind": "rifle", "spin": {"orb": "y"}, "grip": grip}


def celestial_cannon():
    m = Model("celestial_cannon", palette(
        gilded=trimmed(WHITE_PLATE, GOLD),
        sun=glow(HOLY, (0.85, 0.55, 0.10)),
        rune_white=runes(WHITE_PLATE, HOLY, 0.6),
        halo=glow((1.0, 0.95, 0.70), (0.95, 0.70, 0.25), facets=False),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("halo", "body", pivot=(0, 1.2, -12.2))
    b = "body"
    grip = m.box(b, (-0.75, -3.8, 0.4), (0.75, 0.2, 2.3), "leather", rotation=(-12, 0, 0), pivot=(0, 0, 1.3))
    m.box(b, (-1.35, -0.4, -6.0), (1.35, 2.6, 4.0), "gilded")
    m.box(b, (-1.0, -1.4, 4.0), (1.0, 2.0, 7.4), "gilded")
    m.box(b, (-1.1, -1.7, 7.2), (1.1, 2.3, 7.8), "gold")
    # wide barrel with radiant runes, gold rings
    m.box(b, (-1.05, 0.05, -12.0), (1.05, 2.3, -6.0), "rune_white")
    for z in (-7.0, -9.4):
        m.box(b, (-1.2, -0.1, z), (1.2, 2.45, z + 0.6), "gold")
    m.box(b, (-1.3, -0.2, -12.6), (1.3, 2.55, -11.9), "gold")
    m.box(b, (-0.8, 0.35, -12.66), (0.8, 2.0, -12.6), "sun")
    # sun crystal on top
    m.box(b, (-0.7, 2.75, -3.2), (0.7, 4.15, -1.8), "sun", rotation=(0, 0, 45), pivot=(0, 3.45, -2.5))
    m.box(b, (-0.5, 2.6, -3.6), (0.5, 2.85, -1.4), "gold")
    # little angel wings on the flanks
    m.mirror_x(b, (1.35, 0.6, -1.0), (1.6, 2.9, 2.6), "white_plate", rotation=(0, 0, -18), pivot=(1.35, 0.6, 0.8))
    m.mirror_x(b, (1.35, 1.6, 0.2), (1.55, 3.5, 2.2), "gold", rotation=(0, 0, -28), pivot=(1.35, 1.6, 1.2))
    # front handle (two-handed)
    m.box(b, (-0.55, -2.9, -5.2), (0.55, -0.4, -4.1), "leather")
    # halo ring floating around the muzzle (spins)
    m.box("halo", (-2.0, 3.0, -12.4), (2.0, 3.4, -12.0), "halo")
    m.box("halo", (-2.0, -1.0, -12.4), (2.0, -0.6, -12.0), "halo")
    m.box("halo", (-2.0, -0.6, -12.4), (-1.6, 3.0, -12.0), "halo")
    m.box("halo", (1.6, -0.6, -12.4), (2.0, 3.0, -12.0), "halo")
    # trigger + guard
    m.box(b, (-0.15, -1.0, -0.4), (0.15, -0.4, -0.05), "gold")
    m.box(b, (-0.25, -1.45, -1.4), (0.25, -1.05, 0.6), "gold")
    hands(m, grip, handle=(0.0, -1.65, -4.65))
    return m, {"kind": "rifle", "spin": {"halo": "z"}, "grip": grip}


# --------------------------------------------------------- first-person hands
#
# Bedrock hides the player's own arm in first person while an item is held,
# so each gun carries a gloved hand + coat sleeve that is only shown in first
# person (the attachable scales the "fp_hands" bone to 0 in third person).

def hands(m, grip, fore=None, handle=None):
    from gunsmith import cube_center
    m.bone("fp_hands", "body")
    h = "fp_hands"
    c = cube_center(grip)
    rake = grip.rotation[0] if grip.rotation else 0
    x, y, z = c
    # right fist wrapped around the grip
    m.box(h, (x - 1.15, y - 1.7, z - 1.45), (x + 1.15, y + 1.45, z + 1.45), "glove",
          rotation=(rake, 0, 0), pivot=tuple(c), name="fist")
    m.box(h, (x - 1.2, y - 1.75, z - 1.65), (x + 1.2, y + 1.0, z - 1.15), "knuckle",
          rotation=(rake, 0, 0), pivot=tuple(c))
    # thumb along the left of the frame, trigger finger on the trigger
    m.box(h, (x - 1.45, y + 1.0, z - 1.9), (x - 0.95, y + 1.6, z + 0.6), "glove")
    m.box(h, (0.12, -0.75, -1.45), (0.62, -0.25, -0.2), "glove")
    _forearm(m, h, (x + 0.2, y - 0.5, z + 1.2), rot=(30, 14, 0))
    if fore is not None:
        yb, zf, hw = fore
        w = hw + 0.35
        m.box(h, (-w, yb - 1.25, zf - 1.4), (w, yb + 0.15, zf + 1.4), "glove")
        m.box(h, (w - 0.45, yb - 0.2, zf - 1.3), (w, yb + 1.1, zf + 1.3), "glove")
        m.box(h, (-w, yb - 0.2, zf - 1.0), (-w + 0.45, yb + 0.9, zf + 0.6), "glove")
        _forearm(m, h, (-0.4, yb - 0.9, zf + 1.0), rot=(38, -40, 0))
    if handle is not None:
        hx, hy, hz = handle
        m.box(h, (hx - 1.15, hy - 1.5, hz - 1.45), (hx + 1.15, hy + 1.3, hz + 1.45), "glove")
        m.box(h, (hx - 1.2, hy - 1.55, hz - 1.65), (hx + 1.2, hy + 1.0, hz - 1.15), "knuckle")
        _forearm(m, h, (hx - 0.3, hy - 0.4, hz + 1.2), rot=(34, -38, 0))


def _forearm(m, h, wrist, rot, length=12.0):
    wx, wy, wz = wrist
    m.box(h, (wx - 1.35, wy - 1.35, wz), (wx + 1.35, wy + 1.35, wz + 1.2), "glove",
          rotation=rot, pivot=wrist)
    m.box(h, (wx - 1.6, wy - 1.6, wz + 1.2), (wx + 1.6, wy + 1.6, wz + 2.0), "gold",
          rotation=rot, pivot=wrist)
    m.box(h, (wx - 1.5, wy - 1.5, wz + 2.0), (wx + 1.5, wy + 1.5, wz + length), "coat",
          rotation=rot, pivot=wrist)


ALL = [arcane_revolver, inferno_blaster, frostbite_rifle, stormcaller,
       soul_reaper, void_phaser, celestial_cannon]

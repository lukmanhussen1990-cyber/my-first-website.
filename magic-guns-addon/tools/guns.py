"""
guns.py - the seven magical guns, authored as boxes in Blockbench space.

Conventions (units = model pixels, 16 per block):
  * the barrel points to -Z, +Y is up, the model is centred on x = 0
  * the shooting hand wraps the grip just below the origin: (0, 0, 0) is the
    top-centre of the grip where the web of the thumb sits
  * every gun has a root bone "magic_gun" (bound to the hand in game) and a
    child "body" bone; some have extra animated bones (spinning cylinder,
    floating orb, halo...)
  * +X (the "east" face) is the right-hand flank, the side the inventory icon
    shows; decals given in east orientation are mirrored onto the west face
"""

from gunsmith import (Model, metal, wood, leather_wrap, leather, cloth, knurl, bone, obsidian, patina,
                      trimmed, glow, runes, coil, skull_face, flat, slots, inset, holes, rail, screws,
                      feathers)

# ------------------------------------------------------------------ palette

GUNMETAL = metal((0.22, 0.24, 0.28), (0.55, 0.60, 0.68))
DARK_STEEL = metal((0.11, 0.11, 0.13), (0.38, 0.38, 0.44), band=0.18)
BLUED = metal((0.13, 0.17, 0.27), (0.42, 0.52, 0.70))
FROST_STEEL = metal((0.70, 0.78, 0.85), (0.95, 0.98, 1.0), streak=0.07)
SILVER = metal((0.70, 0.71, 0.75), (0.98, 0.98, 1.0), band=0.3)
GOLD = metal((0.80, 0.58, 0.16), (1.0, 0.90, 0.50), streak=0.08, band=0.35)
BRASS = metal((0.72, 0.53, 0.25), (0.98, 0.84, 0.52), streak=0.08, band=0.3)
COPPER = metal((0.72, 0.42, 0.28), (0.98, 0.72, 0.55), streak=0.08, band=0.3)
WHITE_PLATE = metal((0.86, 0.85, 0.80), (1.0, 1.0, 0.97), streak=0.04, band=0.15, wear=0.25)
EBONY = wood((0.20, 0.12, 0.09), (0.09, 0.05, 0.04))
PURPLEHEART = wood((0.40, 0.17, 0.30), (0.17, 0.06, 0.15), rings=4.0)
WALNUT = wood((0.40, 0.25, 0.14), (0.18, 0.10, 0.05))
BIRCH = wood((0.86, 0.80, 0.66), (0.62, 0.55, 0.42), rings=6.0, pores=0.5)
LEATHER = leather_wrap((0.42, 0.24, 0.13), (0.16, 0.09, 0.05), period=5)
GRIP = knurl((0.10, 0.10, 0.11), (0.30, 0.30, 0.33))
RUBBER = knurl((0.09, 0.09, 0.10), (0.22, 0.22, 0.25), cell=3)
CHECKERED_WALNUT = knurl((0.30, 0.18, 0.10), (0.56, 0.37, 0.21))
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


GLOVE = leather((0.13, 0.11, 0.11), (0.05, 0.04, 0.04), stitch=(0.30, 0.26, 0.22))
KNUCKLE = metal((0.16, 0.15, 0.17), (0.45, 0.44, 0.50), band=0.2)
COAT = cloth((0.22, 0.11, 0.34), (0.12, 0.05, 0.20))


def palette(**extra):
    p = {
        "glove": GLOVE, "knuckle": KNUCKLE, "coat": COAT,
        "gunmetal": GUNMETAL, "dark_steel": DARK_STEEL, "blued": BLUED,
        "frost_steel": FROST_STEEL, "silver": SILVER, "gold": GOLD, "brass": BRASS,
        "copper": COPPER, "white_plate": WHITE_PLATE, "ebony": EBONY, "walnut": WALNUT,
        "birch": BIRCH, "leather": LEATHER, "grip": GRIP, "bone": BONE,
        "obsidian": OBSIDIAN, "patina": PATINA, "rubber": RUBBER,
    }
    p.update(extra)
    return p


# ---------------------------------------------------------- shared parts

def trigger_group(m, b, mat, z_front, z_back, y_top, y_bot, trig, trig_mat=None, front=True):
    """Curved trigger blade + a trigger guard with a chamfered front corner."""
    t0, t1 = trig
    m.box(b, (-0.15, y_top - 0.85, t0), (0.15, y_top, t1), trig_mat or mat,
          rotation=(14, 0, 0), pivot=(0, y_top, (t0 + t1) / 2))
    m.box(b, (-0.25, y_bot, z_front + 0.3), (0.25, y_bot + 0.38, z_back), mat)
    if front:
        m.box(b, (-0.25, y_bot + 0.3, z_front), (0.25, y_top, z_front + 0.38), mat)
        m.box(b, (-0.25, y_bot + 0.08, z_front + 0.08), (0.25, y_bot + 0.53, z_front + 0.53), mat,
              rotation=(45, 0, 0))


def notch(paint):
    """Rear sight block: a U notch cut through the front and back faces."""
    return inset(paint, (0.35, 0.0, 0.65, 0.6), faces=("north", "south"))


def bore(paint, rgb, size=3):
    """Muzzle face with a glowing bore."""
    return holes(paint, ((0.5, 0.5),), size=size, faces=("north",), glow_rgb=rgb)


# ------------------------------------------------------------- the arsenal

def arcane_revolver():
    m = Model("arcane_revolver", palette(
        engraved=screws(trimmed(GUNMETAL, GOLD), spots=((0.1, 0.62), (0.88, 0.62))),
        frame_top=trimmed(GUNMETAL, GOLD, scroll=False),
        recoil_shield=trimmed(GUNMETAL, GOLD, gem=ARCANE),
        grip_wood=PURPLEHEART,
        rune_barrel=runes(BLUED, ARCANE),
        cyl=holes(runes(DARK_STEEL, ARCANE, 0.8), ((0.13, 0.5), (0.87, 0.5)), faces=("north",), glow_rgb=ARCANE),
        cyl_b=holes(DARK_STEEL, ((0.5, 0.14), (0.5, 0.86)), faces=("north",), glow_rgb=ARCANE),
        cyl_c=holes(GUNMETAL, ((0.2, 0.2), (0.8, 0.2), (0.2, 0.8), (0.8, 0.8)), faces=("north",), glow_rgb=ARCANE),
        crown=bore(GOLD, ARCANE),
        sight=notch(GUNMETAL),
        spur=knurl((0.62, 0.45, 0.13), (1.0, 0.86, 0.45)),
        medallion=inset(GOLD, (0.3, 0.3, 0.7, 0.7), faces=("east", "west"), glow_rgb=ARCANE),
        amethyst=glow(ARCANE, (0.36, 0.12, 0.62)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("cylinder", "body", pivot=(0, 1.75, -1.0))
    b = "body"
    rake = dict(rotation=(-14, 0, 0), pivot=(0, 0, 1.1))
    # purpleheart grip, gold backstrap + flared butt cap, amethyst medallions
    grip = m.box(b, (-0.75, -4.6, 0.1), (0.75, 0.2, 2.1), "grip_wood", **rake)
    m.box(b, (-0.5, -4.45, 2.1), (0.5, 0.0, 2.45), "gold", **rake)
    m.box(b, (-0.85, -5.0, 0.4), (0.85, -4.4, 2.6), "gold", **rake)
    m.mirror_x(b, (0.75, -2.55, 0.75), (1.0, -1.8, 1.5), "medallion", **rake)
    # frame: engraved lower frame, recoil shield, top strap + rear sight
    m.box(b, (-0.75, -0.2, -2.9), (0.75, 1.0, 2.1), "engraved")
    m.box(b, (-0.7, 1.0, 0.4), (0.7, 2.7, 2.3), "recoil_shield")
    m.box(b, (-0.6, 2.7, -2.7), (0.6, 3.15, 0.9), "frame_top")
    m.box(b, (-0.38, 3.15, 0.35), (0.38, 3.5, 0.9), "sight")
    # hammer: body + knurled spur, cocked back
    m.box(b, (-0.28, 2.2, 1.95), (0.28, 3.3, 2.55), "gold", rotation=(24, 0, 0), pivot=(0, 2.2, 2.25))
    m.box(b, (-0.34, 3.0, 2.35), (0.34, 3.4, 3.3), "spur", rotation=(24, 0, 0), pivot=(0, 2.2, 2.25))
    trigger_group(m, b, "gold", -1.85, 0.35, -0.2, -1.6, (-0.75, -0.4))
    # cylinder: stepped 12-sided drum, glowing chambers in front
    m.box("cylinder", (-1.2, 1.05, -2.5), (1.2, 2.45, 0.4), "cyl")
    m.box("cylinder", (-0.7, 0.55, -2.45), (0.7, 2.95, 0.35), "cyl_b")
    m.box("cylinder", (-1.0, 0.75, -2.4), (1.0, 2.75, 0.3), "cyl_c")
    # barrel with glowing sigils, full-length underlug, vent rib, front sight
    m.box(b, (-0.62, 1.35, -8.6), (0.62, 2.6, -2.5), "rune_barrel")
    m.box(b, (-0.5, 0.75, -8.0), (0.5, 1.4, -2.5), "gunmetal")
    m.box(b, (-0.25, 0.85, -8.35), (0.25, 1.3, -8.0), "gold")
    m.box(b, (-0.3, 2.6, -8.4), (0.3, 2.95, -2.6), "gunmetal")
    m.box(b, (-0.15, 2.95, -8.4), (0.15, 3.45, -7.75), "gold")
    # gold muzzle crown with a burning bore
    m.box(b, (-0.82, 1.18, -9.1), (0.82, 2.78, -8.4), "crown")
    # floating amethyst shard over the frame
    m.box(b, (-0.4, 3.75, -1.65), (0.4, 4.55, -0.85), "amethyst", rotation=(45, 0, 45), pivot=(0, 4.15, -1.25))
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {"cylinder": "z"}, "grip": grip}


def inferno_blaster():
    m = Model("inferno_blaster", palette(
        magma=glow(FIRE, (0.75, 0.16, 0.02), lines=(1.0, 0.95, 0.6)),
        frame=screws(DARK_STEEL, spots=((0.1, 0.55), (0.62, 0.55))),
        shroud=slots(slots(DARK_STEEL, n=4, rect=(0.12, 0.3, 0.88, 0.72), glow_rgb=FIRE),
                     n=4, rect=(0.28, 0.1, 0.72, 0.9), faces=("up",), along="v", glow_rgb=FIRE),
        rune_brass=runes(BRASS, FIRE),
        bell=bore(BRASS, FIRE, size=5),
        sight=notch(BRASS),
        spur=knurl((0.55, 0.40, 0.18), (0.98, 0.84, 0.52)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("core", "body", pivot=(0, 1.55, -1.6))
    b = "body"
    rake = dict(rotation=(-12, 0, 0), pivot=(0, 0, 1.1))
    grip = m.box(b, (-0.8, -4.7, 0.1), (0.8, 0.2, 2.2), "leather", **rake)
    m.box(b, (-0.52, -4.55, 2.2), (0.52, 0.0, 2.5), "brass", **rake)
    m.box(b, (-0.9, -5.1, 0.35), (0.9, -4.5, 2.65), "brass", **rake)
    # frame + rune-etched brass breech, hammer and rear sight
    m.box(b, (-1.1, -0.3, -3.2), (1.1, 1.1, 2.4), "frame")
    m.box(b, (-1.0, 1.1, 0.0), (1.0, 2.9, 2.5), "rune_brass")
    m.box(b, (-0.42, 2.9, 0.05), (0.42, 3.25, 0.6), "sight")
    m.box(b, (-0.3, 2.5, 2.05), (0.3, 3.5, 2.65), "brass", rotation=(28, 0, 0), pivot=(0, 2.5, 2.35))
    m.box(b, (-0.36, 3.2, 2.4), (0.36, 3.6, 3.35), "spur", rotation=(28, 0, 0), pivot=(0, 2.5, 2.35))
    # magma chamber (stepped glass drum) caged in brass
    m.box("core", (-1.25, 0.75, -3.0), (1.25, 2.35, -0.2), "magma")
    m.box("core", (-0.8, 0.3, -2.95), (0.8, 2.8, -0.25), "magma")
    m.box("core", (-1.05, 0.5, -2.9), (1.05, 2.6, -0.3), "magma")
    for z in (-3.15, -1.85, -0.5):
        m.box(b, (-1.4, 0.2, z), (1.4, 2.9, z + 0.4), "brass")
    m.mirror_x(b, (1.25, 1.35, -3.0), (1.5, 1.75, -0.3), "brass")
    # vented barrel shroud (fire shows through the slots), brass bands, rib
    m.box(b, (-0.9, 0.55, -8.0), (0.9, 2.35, -3.2), "shroud")
    m.box(b, (-1.05, 0.4, -3.65), (1.05, 2.5, -3.15), "brass")
    m.box(b, (-1.05, 0.4, -8.2), (1.05, 2.5, -7.7), "brass")
    m.box(b, (-0.25, 2.35, -7.7), (0.25, 2.65, -3.65), "brass")
    m.box(b, (-0.15, 2.65, -7.7), (0.15, 3.2, -7.1), "brass")
    # pilot-light tube under the barrel
    m.box(b, (-0.4, -0.15, -7.9), (0.4, 0.55, -3.2), "dark_steel")
    m.box(b, (-0.28, 0.0, -8.3), (0.28, 0.4, -7.9), "magma")
    # flared bell muzzle
    m.box(b, (-1.2, 0.25, -9.0), (1.2, 2.65, -8.2), "brass")
    m.box(b, (-1.5, -0.05, -9.7), (1.5, 2.95, -9.0), "bell")
    trigger_group(m, b, "brass", -1.95, 0.4, -0.3, -1.65, (-0.85, -0.5))
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {}, "grip": grip}


def frostbite_rifle():
    m = Model("frostbite_rifle", palette(
        ice=glow(FROST, (0.20, 0.55, 0.85)),
        frost_coil=coil(FROST_STEEL, FROST, 4),
        rune_frost=inset(runes(FROST_STEEL, FROST, 0.4), (0.62, 0.08, 0.82, 0.3)),
        barrel=inset(FROST_STEEL, (0.03, 0.4, 0.97, 0.6), inner=(0.25, 0.32, 0.40)),
        brake=slots(SILVER, n=3, rect=(0.15, 0.3, 0.85, 0.7), glow_rgb=FROST),
        rail=rail(GUNMETAL),
        objective=holes(SILVER, ((0.5, 0.5),), size=4, faces=("north",), glow_rgb=FROST),
        ocular=holes(SILVER, ((0.5, 0.5),), size=4, faces=("south",), inner=(0.10, 0.22, 0.32)),
        turret=knurl((0.22, 0.24, 0.28), (0.55, 0.60, 0.68)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    # birch stock with raised cheek comb, silver butt plate + rubber pad
    srake = dict(rotation=(-6, 0, 0), pivot=(0, 1.0, 2.4))
    m.box(b, (-0.85, -2.0, 2.4), (0.85, 1.1, 8.5), "birch", **srake)
    m.box(b, (-0.7, 1.1, 3.6), (0.7, 1.55, 7.9), "birch", **srake)
    m.box(b, (-0.95, -2.3, 8.4), (0.95, 1.2, 8.75), "silver", **srake)
    m.box(b, (-0.95, -2.3, 8.75), (0.95, 1.2, 9.15), "rubber", **srake)
    m.box(b, (-0.15, -2.55, 6.8), (0.15, -2.0, 7.3), "silver", **srake)
    # pistol grip + cap
    grip = m.box(b, (-0.7, -3.6, 0.6), (0.7, 0.2, 2.3), "birch", rotation=(-16, 0, 0), pivot=(0, 0, 1.4))
    m.box(b, (-0.76, -3.95, 0.75), (0.76, -3.5, 2.45), "silver", rotation=(-16, 0, 0), pivot=(0, 0, 1.4))
    # receiver (runes + ejection port), top rail, bolt handle with knob
    m.box(b, (-0.95, -0.1, -4.4), (0.95, 2.2, 3.0), "rune_frost")
    m.box(b, (-0.55, 2.2, -4.3), (0.55, 2.45, 2.0), "rail")
    m.box(b, (0.95, 1.3, 1.0), (1.75, 1.6, 1.3), "silver")
    m.box(b, (1.5, 0.85, 0.85), (2.0, 1.45, 1.45), "gunmetal")
    # ice crystal magazine (raked forward) + silver floor plate
    mrake = dict(rotation=(10, 0, 0), pivot=(0, 0, -2.0))
    m.box(b, (-0.55, -2.8, -2.8), (0.55, 0.0, -1.2), "ice", **mrake)
    m.box(b, (-0.66, -3.12, -2.92), (0.66, -2.8, -1.08), "silver", **mrake)
    # handguard + front sling swivel
    m.box(b, (-0.8, 0.1, -10.0), (0.8, 1.1, -4.4), "birch")
    m.box(b, (-0.15, -0.4, -9.6), (0.15, 0.1, -9.1), "silver")
    # fluted barrel, frost coils, ported muzzle brake, ice spike
    m.box(b, (-0.5, 1.0, -16.0), (0.5, 1.95, -4.4), "barrel")
    for z in (-11.6, -13.1, -14.6):
        m.box(b, (-0.78, 0.72, z), (0.78, 2.23, z + 1.0), "frost_coil")
    m.box(b, (-0.72, 0.78, -17.0), (0.72, 2.17, -15.8), "brake")
    m.box(b, (-0.45, 1.02, -17.9), (0.45, 1.92, -17.0), "ice", rotation=(0, 0, 45), pivot=(0, 1.47, -17.45))
    # scope: tube, objective bell with frost lens, ocular, turrets, rings
    m.box(b, (-0.55, 2.75, -4.8), (0.55, 3.85, 1.4), "frost_steel")
    m.box(b, (-0.75, 2.55, -5.9), (0.75, 4.05, -4.7), "objective")
    m.box(b, (-0.68, 2.62, 1.3), (0.68, 3.98, 2.3), "ocular")
    m.box(b, (-0.3, 3.85, -2.0), (0.3, 4.35, -1.3), "turret")
    m.box(b, (0.55, 3.0, -2.0), (1.0, 3.6, -1.3), "turret")
    for z in (-3.7, -0.1):
        m.box(b, (-0.7, 2.45, z), (0.7, 4.0, z + 0.6), "gunmetal")
    trigger_group(m, b, "silver", -1.55, 0.7, -0.1, -1.45, (-0.45, -0.1))
    hands(m, grip, fore=(0.1, -7.2, 0.8))
    return m, {"kind": "rifle", "spin": {}, "grip": grip}


def stormcaller():
    m = Model("stormcaller", palette(
        tesla=coil(COPPER, STORM, 4),
        rune_patina=screws(runes(PATINA, STORM, 0.5), spots=((0.08, 0.2), (0.92, 0.2), (0.08, 0.8), (0.92, 0.8))),
        spark=glow(STORM, (0.10, 0.25, 0.75), lines=(0.95, 0.98, 1.0), style="bolt"),
        muzzle=holes(COPPER, ((0.27, 0.5), (0.73, 0.5)), size=3, faces=("north",), glow_rgb=STORM),
        grip_check=CHECKERED_WALNUT,
        tower=coil(COPPER, STORM, 3, axis=1),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    # walnut stock + copper butt plate + sling swivel
    srake = dict(rotation=(-8, 0, 0), pivot=(0, 1.0, 2.2))
    m.box(b, (-0.9, -2.3, 2.2), (0.9, 1.0, 8.0), "walnut", **srake)
    m.box(b, (-1.0, -2.6, 7.8), (1.0, 1.15, 8.4), "copper", **srake)
    m.box(b, (-0.15, -2.85, 6.4), (0.15, -2.3, 6.9), "copper", **srake)
    grip = m.box(b, (-0.72, -3.4, 0.6), (0.72, 0.2, 2.3), "grip_check", rotation=(-14, 0, 0), pivot=(0, 0, 1.4))
    # action: rune-etched patina receiver, hinge pin, twin hammers, top lever
    m.box(b, (-1.1, -0.3, -2.0), (1.1, 1.9, 2.6), "rune_patina")
    m.box(b, (-1.15, -0.35, -2.5), (1.15, 0.3, -1.85), "copper")
    m.mirror_x(b, (0.3, 1.45, 1.9), (0.7, 2.55, 2.45), "copper", rotation=(26, 0, 0), pivot=(0.5, 1.6, 2.2))
    m.box(b, (-0.3, 1.9, 1.3), (0.3, 2.15, 2.5), "copper")
    # capacitor cells on both flanks: storm glass between copper caps
    m.mirror_x(b, (1.1, 0.4, -1.6), (1.55, 1.3, 1.2), "spark")
    m.mirror_x(b, (1.05, 0.28, -1.95), (1.65, 1.42, -1.55), "copper")
    m.mirror_x(b, (1.05, 0.28, 1.15), (1.65, 1.42, 1.55), "copper")
    # tesla tower on the action: coiled post + storm orb
    m.box(b, (-0.3, 1.9, -1.15), (0.3, 2.85, -0.55), "tower")
    m.box(b, (-0.5, 2.7, -1.35), (0.5, 3.6, -0.35), "spark")
    m.box(b, (-0.5, 2.75, -1.35), (0.5, 3.55, -0.35), "spark", rotation=(0, 45, 0), pivot=(0, 3.15, -0.85))
    # side-by-side barrels, rib with glowing bead, double muzzle
    m.box(b, (-1.1, 0.15, -13.0), (-0.05, 1.55, -2.0), "blued")
    m.box(b, (0.05, 0.15, -13.0), (1.1, 1.55, -2.0), "blued")
    m.box(b, (-0.2, 1.55, -12.6), (0.2, 1.9, -2.0), "copper")
    m.box(b, (-0.22, 1.55, -13.05), (0.22, 2.2, -12.6), "spark")
    m.box(b, (-1.2, 0.05, -13.5), (1.2, 1.65, -12.9), "muzzle")
    # tesla coils wrapping both barrels
    for z in (-8.9, -10.35, -11.8):
        m.box(b, (-1.35, -0.1, z), (1.35, 1.8, z + 1.0), "tesla")
    # walnut forend with copper tip
    m.box(b, (-1.0, -0.6, -8.0), (1.0, 0.15, -2.0), "walnut")
    m.box(b, (-1.05, -0.65, -8.45), (1.05, 0.2, -8.0), "copper")
    # double triggers + guard
    m.box(b, (-0.15, -1.0, -0.85), (0.15, -0.3, -0.55), "copper", rotation=(14, 0, 0), pivot=(0, -0.3, -0.7))
    trigger_group(m, b, "copper", -1.55, 0.75, -0.3, -1.45, (-0.25, 0.05))
    hands(m, grip, fore=(-0.6, -5.3, 1.0))
    return m, {"kind": "rifle", "spin": {}, "grip": grip}


def soul_reaper():
    m = Model("soul_reaper", palette(
        soulfire=glow(SOUL, (0.05, 0.45, 0.50)),
        lantern=slots(glow(SOUL, (0.05, 0.45, 0.50)), n=3, rect=(0.0, 0.0, 1.0, 1.0), faces=("east", "west", "north", "south"),
                      inner=(0.06, 0.07, 0.09)),
        skull=skull_face(BONE, SOUL),
        rune_obsidian=runes(OBSIDIAN, SOUL, 0.5),
        muzzle=bore(BONE, SOUL),
        blade=trimmed(DARK_STEEL, SILVER, scroll=False),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    b = "body"
    rake = dict(rotation=(-14, 0, 0), pivot=(0, 0, 1.1))
    grip = m.box(b, (-0.72, -4.4, 0.2), (0.72, 0.2, 2.1), "bone", **rake)
    m.box(b, (-0.82, -4.8, 0.4), (0.82, -4.3, 2.4), "dark_steel", **rake)
    m.box(b, (-0.85, -0.2, -4.2), (0.85, 1.9, 2.8), "rune_obsidian")
    # skull on the back of the receiver (eyes burn with soul fire)
    m.box(b, (-1.1, 1.5, 0.6), (1.1, 3.6, 3.0), "skull")
    # vertebra spikes raked back along the spine
    for z, hgt in ((-3.7, 0.75), (-2.6, 0.9), (-1.5, 1.05)):
        m.box(b, (-0.2, 1.85, z), (0.2, 1.9 + hgt, z + 0.55), "bone", rotation=(-28, 0, 0), pivot=(0, 1.9, z + 0.3))
    # soul vials on both flanks, capped in steel
    m.mirror_x(b, (0.85, 0.45, -3.4), (1.25, 1.35, -0.2), "soulfire")
    m.mirror_x(b, (0.8, 0.32, -3.8), (1.32, 1.48, -3.4), "dark_steel")
    m.mirror_x(b, (0.8, 0.32, -0.2), (1.32, 1.48, 0.2), "dark_steel")
    # obsidian barrel ringed with vertebrae, bone muzzle with fangs
    m.box(b, (-0.5, 0.75, -8.4), (0.5, 1.7, -4.2), "obsidian")
    for z in (-5.4, -6.8):
        m.box(b, (-0.66, 0.6, z), (0.66, 1.85, z + 0.4), "bone")
    m.box(b, (-0.66, 0.58, -8.9), (0.66, 1.87, -8.3), "muzzle")
    m.mirror_x(b, (0.25, 0.25, -9.6), (0.52, 0.75, -8.7), "bone", rotation=(-14, 0, 0), pivot=(0.38, 0.5, -8.7))
    m.mirror_x(b, (0.25, 1.7, -9.45), (0.52, 2.15, -8.7), "bone", rotation=(14, 0, 0), pivot=(0.38, 1.9, -8.7))
    # scythe blade below the barrel (dark steel, honed silver edge)
    m.box(b, (-0.3, -0.25, -5.0), (0.3, 0.75, -4.2), "dark_steel")
    m.box(b, (-0.125, -0.9, -8.0), (0.125, 0.0, -4.4), "blade", rotation=(-18, 0, 0), pivot=(0, 0, -4.4))
    m.box(b, (-0.125, -1.5, -8.6), (0.125, -0.7, -7.7), "blade", rotation=(-18, 0, 0), pivot=(0, 0, -4.4))
    m.box(b, (-0.125, -1.3, -9.4), (0.125, -0.8, -8.4), "blade", rotation=(-48, 0, 0), pivot=(0, -1.0, -8.4))
    # soul-lantern magazine: caged glass between steel collar and floor plate
    m.box(b, (-0.55, -2.9, -2.6), (0.55, -0.45, -1.2), "lantern")
    m.box(b, (-0.66, -3.22, -2.72), (0.66, -2.9, -1.08), "dark_steel")
    m.box(b, (-0.66, -0.5, -2.72), (0.66, -0.15, -1.08), "dark_steel")
    trigger_group(m, b, "dark_steel", -1.3, 0.6, -0.2, -1.5, (-0.45, -0.1), trig_mat="bone", front=False)
    hands(m, grip)
    return m, {"kind": "pistol", "spin": {}, "grip": grip}


def void_phaser():
    m = Model("void_phaser", palette(
        void_glow=glow(VOID, (0.30, 0.05, 0.45)),
        pearl=glow((0.62, 0.30, 0.95), (0.12, 0.04, 0.22), lines=(0.95, 0.75, 1.0)),
        rune_void=runes(OBSIDIAN, VOID, 0.6),
        prong=metal((0.16, 0.10, 0.22), (0.55, 0.40, 0.70)),
        heatsink=slots(metal((0.16, 0.10, 0.22), (0.55, 0.40, 0.70)), n=4, rect=(0.1, 0.22, 0.9, 0.78), glow_rgb=VOID),
        collar=coil(DARK_STEEL, VOID, 3),
        cell=inset(metal((0.16, 0.10, 0.22), (0.55, 0.40, 0.70)), (0.22, 0.1, 0.78, 0.85), glow_rgb=VOID),
        rail=rail(DARK_STEEL),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("orb", "body", pivot=(0, 1.2, -9.4))
    b = "body"
    grip = m.box(b, (-0.62, -3.6, 1.2), (0.62, 0.2, 2.9), "obsidian", rotation=(-14, 0, 0), pivot=(0, 0, 2.0))
    m.box(b, (-1.0, -0.3, -6.2), (1.0, 2.0, 3.8), "rune_void")
    m.box(b, (-0.5, 2.0, -5.9), (0.5, 2.3, 3.2), "rail")
    m.box(b, (-1.15, 0.25, -6.0), (1.15, 1.55, -3.6), "heatsink")
    # reflex sight: base, hood posts + top bar, glowing void lens
    m.box(b, (-0.5, 2.3, -1.3), (0.5, 2.6, 0.5), "prong")
    m.mirror_x(b, (0.3, 2.6, -1.2), (0.55, 3.5, -0.75), "prong")
    m.box(b, (-0.55, 3.5, -1.2), (0.55, 3.8, -0.75), "prong")
    m.box(b, (-0.3, 2.6, -1.05), (0.3, 3.5, -0.8), "void_glow")
    # skeletal stock + rubber pad
    m.box(b, (-0.5, 0.6, 3.8), (0.5, 1.6, 8.2), "prong")
    m.box(b, (-0.5, -1.9, 3.8), (0.5, -1.0, 7.4), "prong", rotation=(-8, 0, 0), pivot=(0, -1.0, 3.8))
    m.box(b, (-0.6, -2.2, 7.6), (0.6, 1.8, 8.6), "prong")
    m.box(b, (-0.65, -2.3, 8.6), (0.65, 1.9, 9.0), "rubber")
    # emitter core + coiled collar, three claw prongs bending toward the orb
    m.box(b, (-0.45, 0.65, -7.8), (0.45, 1.75, -6.2), "dark_steel")
    m.box(b, (-0.75, 0.42, -7.3), (0.75, 1.98, -6.5), "collar")
    m.box(b, (-0.22, 2.0, -10.6), (0.22, 2.45, -6.2), "prong")
    m.box(b, (-0.2, 1.95, -12.2), (0.2, 2.35, -10.5), "void_glow", rotation=(-16, 0, 0), pivot=(0, 2.2, -10.55))
    m.mirror_x(b, (1.0, 0.95, -10.6), (1.45, 1.45, -6.2), "prong")
    m.mirror_x(b, (0.95, 1.0, -12.2), (1.35, 1.4, -10.5), "void_glow", rotation=(0, -16, 0), pivot=(1.2, 1.2, -10.55))
    # floating ender orb between the prongs
    m.box("orb", (-0.7, 0.5, -10.1), (0.7, 1.9, -8.7), "pearl")
    m.box("orb", (-0.5, 0.7, -10.3), (0.5, 1.7, -8.5), "void_glow", rotation=(45, 45, 0), pivot=(0, 1.2, -9.4))
    # energy-cell magazine with a glowing window
    m.box(b, (-0.5, -2.6, -2.4), (0.5, -0.3, -0.9), "cell")
    m.box(b, (-0.6, -2.9, -2.5), (0.6, -2.6, -0.8), "prong")
    trigger_group(m, b, "prong", -0.7, 1.5, -0.3, -1.45, (0.3, 0.65))
    hands(m, grip, fore=(-0.3, -4.6, 1.0))
    return m, {"kind": "rifle", "spin": {"orb": "y"}, "grip": grip}


def celestial_cannon():
    m = Model("celestial_cannon", palette(
        gilded=trimmed(WHITE_PLATE, GOLD, gem=HOLY),
        gilded_stock=trimmed(WHITE_PLATE, GOLD),
        sun=glow(HOLY, (0.85, 0.55, 0.10)),
        rune_white=runes(WHITE_PLATE, HOLY, 0.6),
        crown=bore(GOLD, HOLY, size=5),
        halo=glow((1.0, 0.95, 0.70), (0.95, 0.70, 0.25), facets=False),
        feather=feathers((0.97, 0.96, 0.92), (0.66, 0.64, 0.62), tip=(0.93, 0.72, 0.25)),
    ), atlas_width=256)
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    m.bone("halo", "body", pivot=(0, 1.2, -12.9))
    b = "body"
    rake = dict(rotation=(-12, 0, 0), pivot=(0, 0, 1.3))
    grip = m.box(b, (-0.75, -3.8, 0.4), (0.75, 0.2, 2.3), "leather", **rake)
    m.box(b, (-0.8, -4.15, 0.55), (0.8, -3.7, 2.45), "gold", **rake)
    m.box(b, (-1.35, -0.4, -6.0), (1.35, 2.6, 4.0), "gilded")
    m.box(b, (-1.0, -1.4, 4.0), (1.0, 2.0, 7.4), "gilded_stock")
    m.box(b, (-1.1, -1.7, 7.2), (1.1, 2.3, 7.8), "gold")
    # wide barrel with radiant runes, gold rings, gold crown with a sun bore
    m.box(b, (-1.05, 0.05, -12.0), (1.05, 2.3, -6.0), "rune_white")
    for z in (-7.0, -9.4):
        m.box(b, (-1.2, -0.1, z), (1.2, 2.45, z + 0.6), "gold")
    m.box(b, (-1.3, -0.2, -12.6), (1.3, 2.55, -11.9), "crown")
    # sun crystal held in a gold claw setting
    m.box(b, (-0.75, 2.6, -3.3), (0.75, 2.95, -1.7), "gold")
    m.box(b, (-0.55, 2.85, -3.05), (0.55, 4.35, -1.95), "sun", rotation=(0, 45, 0), pivot=(0, 3.6, -2.5))
    m.box(b, (-0.32, 4.3, -2.82), (0.32, 4.9, -2.18), "sun", rotation=(0, 45, 0), pivot=(0, 4.6, -2.5))
    m.mirror_x(b, (0.5, 2.9, -2.68), (0.78, 3.55, -2.32), "gold")
    # angel wings: gold shoulder + three fanned feathers per side
    m.mirror_x(b, (1.35, 0.7, -0.4), (1.7, 1.9, 1.9), "gold")
    for i, (ang, ln) in enumerate(((62, 4.4), (40, 3.9), (18, 3.3))):
        x0 = 1.4 + 0.07 * i
        m.mirror_x(b, (x0, 1.3, 0.3), (x0 + 0.25, 1.3 + ln, 1.25), "feather",
                   rotation=(ang, 0, 0), pivot=(x0 + 0.12, 1.3, 0.8))
    # front handle (two-handed) with gold mount and cap
    m.box(b, (-0.55, -2.9, -5.2), (0.55, -0.4, -4.1), "leather")
    m.box(b, (-0.65, -0.72, -5.4), (0.65, -0.4, -3.9), "gold")
    m.box(b, (-0.62, -3.2, -5.28), (0.62, -2.9, -4.02), "gold")
    # octagonal halo floating ahead of the muzzle (spins)
    cy, z0, z1, a, t = 1.2, -13.1, -12.7, 2.2, 0.42
    half = 0.95
    for rot in (0, 45, 90, 135, 180, 225, 270, 315):
        m.box("halo", (-half, cy + a - t, z0), (half, cy + a, z1), "halo",
              rotation=(0, 0, rot) if rot else None, pivot=(0, cy, (z0 + z1) / 2))
    trigger_group(m, b, "gold", -1.45, 0.6, -0.4, -1.5, (-0.45, -0.1))
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

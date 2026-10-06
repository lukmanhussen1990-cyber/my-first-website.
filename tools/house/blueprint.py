#!/usr/bin/env python3
"""Procedural blueprint of the Parasite Apocalypse "Luxury Base".

Run:  python3 tools/house/blueprint.py            (writes structure, meta JS, preview PNGs)
      python3 tools/house/blueprint.py --no-images

Canonical orientation: +x = east, +z = south, +y = up.  The entrance faces SOUTH.

Box: X=18 (x 0..17) * Y=13 (y 0..12) * Z=15 (z 0..14)
  y 0      foundation / ground-floor floor (sits on the terrain surface)
  y 1..4   ground floor (walking surface y=1 = HOUSE.floorY)
  y 5      ground-floor ceiling = upper-floor floor
  y 6..9   upper floor
  y 10     roof deck + loggia canopy
  y 11..12 dark oak slab roof inside a quartz parapet, raised skylight, green roof edge

Legend of rooms (ground floor, feet y=1):
  foyer      x 7..10  z 8..10   double front door at x 8,9 z 11
  staircase  x 8..9   z 3..7    dark-oak stairs rising NORTH, y 1..5
  back hall  x 7..10  z 1..2
  living     x 1..6   z 6..10   sofa, coffee table, rug, bookshelves, plants
  crafting   x 1..6   z 1..5    enchanting table (3,3) + 16 bookshelves, stations
  kitchen    x 11..16 z 6..10   smoker, furnace, cauldron sink, counters, dining
  storage    x 12..16 z 1..4    chests + barrels, door at x 11 z 3
Upper floor (feet y=6):
  hall       x 7..10  z 1..10   gallery around the stairwell, lounge at the front
  guest bed  x 1..5   z 1..10   door at x 6 z 8
  master bed x 12..16 z 1..10   door at x 11 z 8
  balcony    x 1..16  z 12..13  French doors at x 8,9 z 11 + bedroom doors at x 3 / x 14
Front loggia: covered terrace (GF, z 12..13) and balcony share a quartz pillar frame;
front steps and moss/azalea planters on z 14.  See docs/HOUSE.md for the full write-up.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import blocks as B  # noqa: E402
import nbt_le as N  # noqa: E402

ROOT = HERE.parent.parent
STRUCTURE_PATH = ROOT / "addon" / "behavior_pack" / "structures" / "pas" / "luxury_base.mcstructure"
META_PATH = ROOT / "addon" / "behavior_pack" / "scripts" / "house" / "blueprint_meta.js"
IMAGES = ROOT / "docs" / "images"

X, Y, Z = 18, 13, 15  # y 0..12
FLOOR_Y = 1
UPPER_Y = 6
ENTRANCE = (9, 1, 12)  # porch cell in front of the east leaf of the front door

# (label, walking y, x0, z0, x1, z1) - used for plan labels and docs only
ROOMS = [
    ("LIVING", 1, 1, 6, 6, 10), ("CRAFTING", 1, 1, 1, 6, 5), ("FOYER", 1, 7, 8, 10, 10),
    ("STAIRS", 1, 8, 3, 9, 7), ("BACK HALL", 1, 7, 1, 10, 2), ("KITCHEN", 1, 11, 6, 16, 10),
    ("STORAGE", 1, 12, 1, 16, 4), ("TERRACE", 1, 1, 12, 16, 13),
    ("GUEST", 6, 1, 1, 5, 10), ("MASTER", 6, 12, 1, 16, 10), ("HALL", 6, 7, 1, 10, 10),
    ("BALCONY", 6, 1, 12, 16, 13),
]

# ------------------------------------------------------------------ palette
SQ = B.quartz("smooth")                 # smooth quartz
QB = B.quartz("default")                # plain quartz block
QP = B.quartz("lines", "y")             # quartz pillar (vertical)
QPX = B.quartz("lines", "x")
QPZ = B.quartz("lines", "z")
QC = B.quartz("chiseled")
DOP = B.simple("dark_oak_planks")
SDO_Y = B.log("stripped_dark_oak_log", "y")
GLASS = B.simple("glass")
PANE = B.simple("glass_pane")
SEA = B.simple("sea_lantern")
BOOK = B.simple("bookshelf")
CRAFT = B.simple("crafting_table")
SMITH = B.simple("smithing_table")
ENCH = B.simple("enchanting_table")
DO_SLAB_TOP = B.slab("dark_oak_slab", top=True)
DO_SLAB = B.slab("dark_oak_slab")
SQ_SLAB = B.slab("smooth_quartz_slab")
Q_SLAB = B.slab("quartz_slab")
MOSS = B.simple("moss_block")
AZALEA = B.simple("flowering_azalea")
AZALEA_PLAIN = B.simple("azalea")
LANTERN_HANG = B.lantern(True)
LANTERN_STAND = B.lantern(False)
POT = B.flower_pot()
CARPET_LG = B.simple("light_gray_carpet")
CARPET_W = B.simple("white_carpet")
CARPET_G = B.simple("gray_carpet")
AIR = B.AIR


def be_base(ident: str, x: int, y: int, z: int) -> dict:
    """Common block-actor tags (Bedrock 1.21 world format: id, isMovable, x, y, z)."""
    return {"id": N.String(ident), "isMovable": N.Byte(1),
            "x": N.Int(x), "y": N.Int(y), "z": N.Int(z)}


def item(name: str, count: int, slot: int, block: B.Block | None = None) -> N.Compound:
    """Item stack NBT as PocketMine SavedItemStackData/SavedItemData write it."""
    entries = {
        "Name": N.String("minecraft:" + name),
        "Damage": N.Short(0),
        "Count": N.Byte(count),
        "Slot": N.Byte(slot),
        "WasPickedUp": N.Byte(0),
    }
    if block is not None:
        entries["Block"] = state_compound(block)
    return N.Compound(entries)


def state_compound(block: B.Block) -> N.Compound:
    return N.Compound({
        "name": N.String(block.name),
        "states": N.Compound({k: N.from_state_value(v) for k, v in block.states}),
        "version": N.Int(B.BLOCK_VERSION),
    })


# ------------------------------------------------------------------ canvas
class Canvas:
    def __init__(self):
        self.cells: dict[tuple[int, int, int], B.Block] = {}
        self.entities: dict[tuple[int, int, int], dict] = {}

    def inside(self, x, y, z):
        return 0 <= x < X and 0 <= y < Y and 0 <= z < Z

    def set(self, x, y, z, block: B.Block, entity: dict | None = None):
        if not self.inside(x, y, z):
            raise IndexError((x, y, z))
        self.cells[(x, y, z)] = block
        if entity is not None:
            self.entities[(x, y, z)] = entity
        else:
            self.entities.pop((x, y, z), None)

    def get(self, x, y, z):
        return self.cells.get((x, y, z))

    def fill(self, x0, y0, z0, x1, y1, z1, block: B.Block):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.set(x, y, z, block)

    # --- composite helpers ------------------------------------------------
    def door_pair(self, x, y, z, facing, hinge_right):
        self.set(x, y, z, B.door(facing, hinge_right, upper=False))
        self.set(x, y + 1, z, B.door(facing, hinge_right, upper=True))

    def bed(self, foot, facing, color):
        fx, fy, fz = foot
        dx, dz = B.OFFSET[facing]
        hx, hz = fx + dx, fz + dz
        for (x, z, head) in ((fx, fz, False), (hx, hz, True)):
            ent = be_base("Bed", x, fy, z)
            ent["color"] = N.Byte(B.DYE[color])
            self.set(x, fy, z, B.bed(facing, head), ent)

    def chest(self, x, y, z, facing, items):
        ent = be_base("Chest", x, y, z)
        ent["Findable"] = N.Byte(0)
        ent["Items"] = N.List(N.TAG_COMPOUND, [item(*it) if len(it) == 3 else item(*it) for it in items])
        self.set(x, y, z, B.cardinal("chest", facing), ent)

    def potted(self, x, y, z, plant: B.Block):
        ent = be_base("FlowerPot", x, y, z)
        ent["PlantBlock"] = state_compound(plant)
        self.set(x, y, z, POT, ent)


# ------------------------------------------------------------------ build
def build() -> Canvas:
    c = Canvas()

    # 1. clear the whole house volume (explicit air: removes grass / snow layers)
    c.fill(0, 0, 0, 17, 11, 11, AIR)
    c.fill(0, 0, 12, 17, 11, 14, AIR)

    shell(c)
    ground_floor(c)
    upper_floor(c)
    staircase(c)                                         # last: carves the stairwell
    porch_and_balcony(c)
    roof(c)
    return c


def shell(c: Canvas):
    # ---- floors
    c.fill(0, 0, 0, 17, 0, 11, SQ)              # foundation / GF floor (smooth quartz)
    c.fill(1, 0, 6, 6, 0, 10, DOP)              # living room: dark oak floor
    c.fill(1, 0, 1, 6, 0, 5, DOP)               # crafting room: dark oak floor
    c.fill(12, 0, 1, 16, 0, 4, DOP)             # storage: dark oak floor
    c.fill(0, 5, 0, 17, 5, 11, SQ)              # GF ceiling / upper floor
    c.fill(1, 5, 1, 5, 5, 10, DOP)              # guest bedroom floor
    c.fill(12, 5, 1, 16, 5, 10, DOP)            # master bedroom floor
    c.fill(0, 10, 0, 17, 10, 11, SQ)            # roof deck

    # ---- exterior walls: white quartz ground floor, dark-oak clad upper storey
    for y in range(1, 10):
        if y == 5:
            continue
        mat = SQ if y < 5 else DOP
        c.fill(0, y, 0, 17, y, 0, mat)
        c.fill(0, y, 11, 17, y, 11, mat)
        c.fill(0, y, 0, 0, y, 11, mat)
        c.fill(17, y, 0, 17, y, 11, mat)
    # quartz floor-line belt (y 5) and cornice (y 10)
    for y in (5, 10):
        c.fill(1, y, 0, 16, y, 0, QPX)
        c.fill(1, y, 11, 16, y, 11, QPX)
        c.fill(0, y, 1, 0, y, 10, QPZ)
        c.fill(17, y, 1, 17, y, 10, QPZ)
    # quartz corner pillars
    for (x, z) in ((0, 0), (17, 0), (0, 11), (17, 11)):
        c.fill(x, 0, z, x, 10, z, QP)

    # ---- front facade (z = 11)
    for x in (7, 10):                            # door pilasters
        c.fill(x, 0, 11, x, 4, 11, QP)
    window(c, (2, 5), 1, 4, z=11)                # living room glass wall
    window(c, (12, 15), 1, 4, z=11)              # kitchen glass wall
    c.fill(8, 3, 11, 9, 4, 11, PANE)             # transom over the front door
    # upper storey front (behind the balcony): glass, French doors, dark oak mullions
    c.fill(1, 6, 11, 16, 9, 11, PANE)
    c.fill(8, 8, 11, 9, 9, 11, PANE)             # transom over the balcony doors
    for x in (1, 5, 6, 11, 12, 16):              # mullions
        c.fill(x, 6, 11, x, 9, 11, SDO_Y)
    for x in (1, 6, 11, 16):                     # ground-floor mullions
        c.fill(x, 1, 11, x, 4, 11, SDO_Y)

    # ---- back facade (z = 0): double-height stairwell glass + bedroom windows
    for x in range(7, 11):
        c.fill(x, 1, 0, x, 4, 0, PANE)
        c.fill(x, 6, 0, x, 9, 0, PANE)
    c.fill(6, 1, 0, 6, 9, 0, QP)
    c.fill(11, 1, 0, 11, 9, 0, QP)
    window(c, (2, 4), 6, 9, z=0)
    window(c, (13, 15), 6, 9, z=0)
    c.fill(13, 3, 0, 15, 4, 0, PANE)             # storage clerestory above the shelving
    c.fill(2, 4, 0, 4, 4, 0, PANE)               # crafting clerestory above the bookshelves

    # ---- west facade (x = 0)
    window_x(c, 0, (7, 9), 1, 4)                 # living room
    window_x(c, 0, (2, 4), 4, 4)                 # crafting: high strip over the bookshelves
    window_x(c, 0, (1, 2), 6, 9)                 # guest bedroom
    window_x(c, 0, (7, 9), 6, 9)
    # ---- east facade (x = 17)
    window_x(c, 17, (7, 9), 2, 4)                # kitchen window over the counter
    window_x(c, 17, (1, 2), 6, 9)                # master bedroom
    window_x(c, 17, (8, 9), 6, 9)


def window(c: Canvas, xr, y0, y1, z):
    c.fill(xr[0], y0, z, xr[1], y1, z, PANE)


def window_x(c: Canvas, x, zr, y0, y1):
    c.fill(x, y0, zr[0], x, y1, zr[1], PANE)


def ground_floor(c: Canvas):
    y = FLOOR_Y
    # ---------------- front door (double, mirrored hinges; placed as if walking in = facing north)
    c.door_pair(8, y, 11, "north", hinge_right=False)   # west leaf: hinge on the west jamb
    c.door_pair(9, y, 11, "north", hinge_right=True)    # east leaf: hinge on the east jamb

    # ---------------- foyer
    c.fill(8, 0, 8, 9, 0, 10, QC)                        # chiseled quartz inlay
    c.set(8, 0, 9, SEA)                                  # glowing floor tiles
    c.set(9, 0, 9, SEA)
    c.potted(7, y, 10, AZALEA)
    c.potted(10, y, 10, AZALEA)

    # ---------------- living room  x1..6 z6..10
    # L-shaped sofa (smooth quartz stairs, backrest against the walls; the corner piece
    # auto-shapes into an inner corner), dark oak armrest panels
    for z in (7, 8, 9, 10):
        c.set(1, y, z, B.stairs("smooth_quartz_stairs", up="west"))
    for x in (2, 3):
        c.set(x, y, 10, B.stairs("smooth_quartz_stairs", up="south"))
    c.set(1, y, 6, B.trapdoor("north", open_=True))      # panel on the south face of (1,1,6)
    c.set(4, y, 10, B.trapdoor("east", open_=True))      # panel on the west face of (4,1,10)
    for (x, z) in ((2, 7), (3, 7), (4, 7), (2, 8), (4, 8), (2, 9), (3, 9), (4, 9)):
        c.set(x, y, z, CARPET_LG)                        # rug
    c.set(3, y, 8, DO_SLAB_TOP)                          # coffee table
    c.set(3, y + 1, 8, LANTERN_STAND)                    # table lamp
    # media wall facing the sofa: bookshelves with a lamp and plants on top
    for z in (7, 8, 9):
        c.set(6, y, z, BOOK)
        c.set(6, y + 1, z, BOOK)
    c.set(6, y + 2, 8, LANTERN_STAND)
    c.potted(6, y + 2, 7, B.simple("fern"))
    c.potted(6, y + 2, 9, B.simple("fern"))
    c.set(5, y, 8, B.stairs("dark_oak_stairs", up="east"))  # reading chair
    c.potted(5, y, 10, B.simple("white_tulip"))
    c.potted(6, y, 10, AZALEA)

    # ---------------- crafting room  x1..6 z1..5  (enchanting table + 16 bookshelves)
    for yy in (1, 2, 3):
        for x in range(1, 6):
            c.set(x, yy, 1, BOOK)                        # back row (dz = -2)
        for z in (2, 3, 4):
            c.set(1, yy, z, BOOK)                        # side column (dx = -2)
    c.set(3, y, 3, ENCH)
    c.set(6, y, 1, CRAFT)
    c.set(6, y, 2, B.cardinal("furnace", "west"))
    c.set(6, y, 3, B.cardinal("blast_furnace", "west"))
    c.set(6, y, 4, B.cardinal("stonecutter_block", "west"))
    c.set(1, y, 5, SMITH)
    c.set(2, y, 5, B.loom("north"))
    c.set(3, y, 5, B.anvil("north"))
    c.chest(4, y, 5, "north", [
        ("lapis_lazuli", 32, 0), ("experience_bottle", 16, 1), ("book", 8, 2),
        ("iron_ingot", 12, 3), ("coal", 16, 4),
    ])
    c.set(6, y + 1, 1, LANTERN_STAND)                    # lamp on the crafting table
    c.potted(1, y + 1, 5, B.simple("azalea"))            # plant on the smithing table

    # ---------------- kitchen + dining  x11..16 z6..10
    c.set(16, y, 6, B.cardinal("smoker", "west"))
    c.set(16, y, 7, B.barrel("west"))
    c.set(16, y, 8, B.cauldron_water())                  # sink
    c.set(16, y, 9, B.barrel("west"))
    c.set(16, y, 10, B.cardinal("furnace", "west"))
    for z in (6, 10):                                    # upper cabinets
        c.set(16, 3, z, B.barrel("west"))
        c.set(16, 4, z, B.trapdoor("west", open_=True))
    c.potted(16, y + 1, 7, B.simple("fern"))             # herbs on the counter
    c.set(16, y + 1, 9, LANTERN_STAND)
    # dining table 1x2 with four chairs
    for z in (8, 9):
        c.set(13, y, z, DO_SLAB_TOP)
        c.set(12, y, z, B.stairs("dark_oak_stairs", up="west"))   # chair, backrest west
        c.set(14, y, z, B.stairs("dark_oak_stairs", up="east"))   # chair, backrest east
    c.set(13, y + 1, 8, LANTERN_STAND)
    c.potted(13, y + 1, 9, B.simple("lily_of_the_valley"))
    for x in (12, 13, 14):
        c.set(x, y, 7, CARPET_W)
        c.set(x, y, 10, CARPET_W)

    # ---------------- storage  x12..16 z1..4, walls x11 / z5, door at (11, 3)
    for yy in range(1, 5):
        c.fill(11, yy, 1, 11, yy, 5, SQ)
        c.fill(11, yy, 5, 16, yy, 5, SQ)
    c.door_pair(11, y, 3, "east", hinge_right=False)
    chest_items = [
        [("bread", 16, 0), ("cooked_beef", 12, 1), ("apple", 8, 2), ("golden_carrot", 8, 3),
         ("baked_potato", 12, 4)],
        [("torch", 32, 0, B.make("torch", torch_facing_direction="unknown")),
         ("oak_log", 16, 1, B.log("oak_log", "y")),
         ("cobblestone", 32, 2, B.simple("cobblestone")), ("coal", 16, 3)],
        [("oak_sapling", 4, 0, B.make("oak_sapling", age_bit=False)), ("wheat_seeds", 16, 1),
         ("bucket", 1, 2), ("arrow", 32, 3), ("string", 8, 4), ("iron_ingot", 8, 5)],
        [("bread", 8, 0), ("cooked_porkchop", 8, 1), ("carrot", 12, 2), ("torch", 16, 3,
                                                                          B.make("torch", torch_facing_direction="unknown"))],
    ]
    c.chest(12, y, 1, "south", chest_items[0])
    c.set(13, y, 1, B.barrel("south"))
    c.chest(14, y, 1, "south", chest_items[1])
    c.set(15, y, 1, B.barrel("south"))
    c.set(16, y, 1, SDO_Y)                               # corner post with a lamp
    c.set(16, y + 1, 1, LANTERN_STAND)
    c.chest(16, y, 2, "west", chest_items[2])
    c.set(16, y, 3, B.barrel("west"))
    c.chest(16, y, 4, "west", chest_items[3])
    for (x, z) in ((13, 1), (15, 1), (16, 3)):
        c.set(x, 2, z, B.barrel("up"))                  # second tier on barrels only
    c.set(14, 4, 3, LANTERN_HANG)

    # ---------------- pendant lights under the y 5 ceiling (leave 3 free cells below)
    for (x, z) in ((3, 3), (3, 8), (13, 8), (8, 2), (10, 4), (7, 5), (14, 6)):
        c.set(x, 4, z, LANTERN_HANG)

    # ---------------- back hall behind the stairs
    c.fill(7, 0, 1, 10, 0, 2, QC)
    c.potted(8, y, 1, AZALEA)
    c.potted(9, y, 1, AZALEA)


def staircase(c: Canvas):
    # five dark oak steps rising north: (z, y) = (7,1) (6,2) (5,3) (4,4) (3,5)
    for k in range(5):
        z, y = 7 - k, 1 + k
        for x in (8, 9):
            c.set(x, y, z, B.stairs("dark_oak_stairs", up="north"))
            if y - 1 >= 1:                               # quartz soffit under each step
                c.set(x, y - 1, z, B.stairs("smooth_quartz_stairs", up="north", upside_down=True))
    # stairwell opening in the y 5 ceiling: the head clears 1.8 above every step and every
    # step-up transition (validator models the 0.6-wide body overlapping both columns)
    for x in (8, 9):
        for z in (4, 5, 6):
            c.set(x, 5, z, AIR)
    # upper-floor railing: glass across the south end (z 6, above step k=1 whose head
    # height never exceeds 5.3) and thin open trapdoor panels on the outer faces of the
    # opening along the side walkways (they leave the body space over the steps free)
    c.set(8, 6, 6, PANE)
    c.set(9, 6, 6, PANE)
    for z in (4, 5):
        c.set(8, 6, z, B.trapdoor("east", open_=True))   # panel on the west face of (8,6,z)
        c.set(9, 6, z, B.trapdoor("west", open_=True))   # panel on the east face of (9,6,z)


def upper_floor(c: Canvas):
    y = UPPER_Y
    # ---------------- partitions (bedroom walls)
    for yy in range(6, 10):
        c.fill(6, yy, 1, 6, yy, 10, SQ)
        c.fill(11, yy, 1, 11, yy, 10, SQ)
    c.door_pair(6, y, 8, "west", hinge_right=False)      # guest bedroom
    c.door_pair(11, y, 8, "east", hinge_right=True)      # master bedroom
    c.fill(6, 6, 1, 6, 9, 1, QP)
    c.fill(11, 6, 1, 11, 9, 1, QP)

    # ---------------- hall / lounge
    c.door_pair(8, y, 11, "south", hinge_right=True)     # French doors to the balcony
    c.door_pair(9, y, 11, "south", hinge_right=False)
    c.door_pair(3, y, 11, "south", hinge_right=False)    # guest bedroom -> balcony
    c.door_pair(14, y, 11, "south", hinge_right=True)    # master bedroom -> balcony
    c.fill(7, 5, 7, 10, 5, 10, QC)
    c.set(8, 5, 8, SEA)
    c.set(9, 5, 8, SEA)
    c.set(7, y, 9, B.stairs("smooth_quartz_stairs", up="west"))   # lounge chairs
    c.set(10, y, 9, B.stairs("smooth_quartz_stairs", up="east"))
    c.potted(7, y, 10, AZALEA)
    c.potted(10, y, 10, AZALEA)
    c.potted(7, y, 1, B.simple("fern"))
    c.potted(10, y, 1, B.simple("fern"))
    c.set(7, 9, 2, LANTERN_HANG)                         # landing pendants
    c.set(10, 9, 2, LANTERN_HANG)
    for (x, z) in ((8, 9), (9, 9), (8, 10), (9, 10), (8, 7), (9, 7)):
        c.set(x, y, z, CARPET_G)

    # ---------------- master bedroom  x12..16 z1..10  (two beds + nightstands)
    c.bed((15, y, 4), "east", "light_gray")
    c.bed((15, y, 5), "east", "light_gray")
    for z in (3, 6):                                     # nightstands with lamps
        c.set(16, y, z, B.barrel("up"))
        c.set(16, y + 1, z, LANTERN_STAND)
    for z in (4, 5):                                     # headboard panels on the wall
        c.set(16, y + 1, z, B.trapdoor("west", open_=True))
        c.set(16, y + 2, z, B.trapdoor("west", open_=True))
    for x in (12, 13):
        for z in (3, 4, 5, 6):
            c.set(x, y, z, CARPET_W)
    c.set(14, y, 4, SQ_SLAB)                             # bench at the foot of the beds
    c.set(14, y, 5, SQ_SLAB)
    c.set(12, y, 7, B.barrel("east"))                    # wardrobe
    c.set(12, y + 1, 7, B.barrel("east"))
    c.set(12, y, 9, B.barrel("east"))
    c.set(12, y + 1, 9, B.barrel("east"))
    c.set(14, 10, 7, SEA)                                # flush ceiling light
    c.set(14, 9, 5, LANTERN_HANG)                        # pendant over the bed area
    c.set(14, 9, 9, LANTERN_HANG)
    c.chest(12, y, 1, "south", [("bread", 8, 0), ("book", 4, 1), ("arrow", 16, 2)])
    c.set(13, y, 1, B.barrel("south"))
    c.set(14, y, 1, BOOK)
    c.set(15, y, 1, BOOK)
    c.set(16, y, 1, B.barrel("south"))
    c.set(14, y + 1, 1, BOOK)
    c.set(15, y + 1, 1, BOOK)
    # desk with a lamp in front of the window
    c.set(16, y, 9, DO_SLAB_TOP)
    c.set(15, y, 9, B.stairs("dark_oak_stairs", up="west"))
    c.set(16, y + 1, 9, LANTERN_STAND)
    c.potted(16, y, 10, B.simple("azalea"))
    c.potted(12, y, 10, B.simple("white_tulip"))

    # ---------------- guest bedroom  x1..5 z1..10
    c.bed((2, y, 4), "west", "gray")
    c.set(1, y, 3, B.barrel("up"))
    c.set(1, y + 1, 3, LANTERN_STAND)
    c.set(1, y + 1, 4, B.trapdoor("east", open_=True))  # headboard
    c.set(1, y, 5, B.barrel("up"))                       # second nightstand
    c.potted(1, y + 1, 5, B.simple("lily_of_the_valley"))
    c.set(5, y, 3, B.barrel("west"))                     # wardrobe
    c.set(5, y + 1, 3, B.barrel("west"))
    c.set(5, y, 5, B.barrel("west"))
    c.set(5, y + 1, 5, B.barrel("west"))
    c.set(3, 10, 6, SEA)                                 # flush ceiling light
    c.set(3, 9, 4, LANTERN_HANG)
    c.set(3, 9, 8, LANTERN_HANG)
    for (x, z) in ((3, 3), (3, 4), (3, 5), (2, 5)):
        c.set(x, y, z, CARPET_LG)
    c.chest(5, y, 1, "south", [("bread", 8, 0), ("torch", 16, 1, B.make("torch", torch_facing_direction="unknown"))])
    c.set(4, y, 1, BOOK)
    c.set(3, y, 1, BOOK)
    c.set(4, y + 1, 1, BOOK)
    c.set(3, y + 1, 1, BOOK)
    c.set(1, y, 9, DO_SLAB_TOP)                          # desk
    c.set(2, y, 9, B.stairs("dark_oak_stairs", up="east"))
    c.set(1, y + 1, 9, LANTERN_STAND)
    c.potted(1, y, 10, B.simple("fern"))
    c.potted(5, y, 10, AZALEA)


def porch_and_balcony(c: Canvas):
    """Full-width double loggia: covered terrace (GF), balcony (upper floor), canopy."""
    # terrace floor and entrance path
    c.fill(1, 0, 12, 16, 0, 13, SQ)
    c.fill(7, 0, 12, 10, 0, 13, QC)
    for x in range(6, 12):                               # front steps up to the terrace
        c.set(x, 0, 14, B.stairs("quartz_stairs", up="north"))
    # planters: moss beds with azalea shrubs along the front and the open sides
    for x in list(range(1, 5)) + list(range(13, 17)):
        c.set(x, 0, 14, MOSS)
        c.set(x, 1, 14, AZALEA_PLAIN if x % 2 else AZALEA)
    for x in (0, 17):
        for z in (12, 13):
            c.set(x, 0, z, MOSS)
            c.set(x, 1, z, AZALEA if z == 12 else AZALEA_PLAIN)
    # quartz frame: pillars at the corners and flanking the steps
    for x in (0, 5, 12, 17):
        c.fill(x, 0, 14, x, 9, 14, QP)
    # balcony slab (= terrace ceiling) and canopy roof, with quartz edge beams
    c.fill(0, 5, 12, 17, 5, 14, SQ)
    c.fill(1, 5, 14, 16, 5, 14, QPX)
    c.fill(0, 5, 12, 0, 5, 13, QPZ)
    c.fill(17, 5, 12, 17, 5, 13, QPZ)
    c.fill(0, 10, 12, 17, 10, 14, SQ)
    c.fill(1, 10, 14, 16, 10, 14, QPX)
    c.fill(0, 10, 12, 0, 10, 13, QPZ)
    c.fill(17, 10, 12, 17, 10, 13, QPZ)
    # balcony floor finish + glass railing
    c.fill(1, 5, 12, 16, 5, 13, DOP)
    for x in range(1, 17):
        if x not in (5, 12):
            c.set(x, 6, 14, PANE)
    for z in (12, 13):
        c.set(0, 6, z, PANE)
        c.set(17, 6, z, PANE)
    # lights: hanging lanterns under the balcony slab and under the canopy
    for x in (2, 6, 11, 15):
        c.set(x, 4, 13, LANTERN_HANG)
        c.set(x, 9, 13, LANTERN_HANG)
    # balcony lounge corners (door fronts at x 3, 8, 9, 14 stay free)
    c.set(1, 6, 12, B.stairs("dark_oak_stairs", up="west"))      # chair facing east
    c.set(2, 6, 12, DO_SLAB_TOP)
    c.potted(2, 7, 12, B.simple("white_tulip"))
    c.set(16, 6, 12, B.stairs("dark_oak_stairs", up="east"))     # chair facing west
    c.set(15, 6, 12, DO_SLAB_TOP)
    c.potted(15, 7, 12, B.simple("fern"))


def roof(c: Canvas):
    # slab-covered deck (bottom slabs: no mob spawning) inside a quartz parapet
    c.fill(0, 11, 0, 17, 11, 14, DO_SLAB)
    for x in range(0, 18):
        c.set(x, 11, 0, QB)
        c.set(x, 11, 14, QB)
    for z in range(0, 15):
        c.set(0, 11, z, QB)
        c.set(17, 11, z, QB)
    for (x, z) in ((0, 0), (17, 0), (0, 14), (17, 14)):
        c.set(x, 11, z, QP)
    # parapet cap: quartz slabs so nothing can spawn on top
    for x in range(0, 18):
        for z in (0, 14):
            c.set(x, 12, z, Q_SLAB)
    for z in range(1, 14):
        for x in (0, 17):
            c.set(x, 12, z, Q_SLAB)
    # skylight strip over the stairwell / landing, framed in white quartz
    c.fill(8, 10, 1, 9, 10, 6, AIR)
    c.fill(8, 11, 1, 9, 11, 6, GLASS)
    c.fill(7, 11, 1, 7, 11, 7, SQ_SLAB)
    c.fill(10, 11, 1, 10, 11, 7, SQ_SLAB)
    c.fill(8, 11, 7, 9, 11, 7, SQ_SLAB)
    # green roof edge above the loggia: moss beds with azalea shrubs
    for x in range(1, 17):
        c.set(x, 11, 13, MOSS)
        c.set(x, 12, 13, AZALEA_PLAIN if x % 3 else AZALEA)
    c.fill(1, 11, 12, 16, 11, 12, SQ_SLAB)              # white walkway strip in front of it


# ------------------------------------------------------------------ output
def palette_and_indices(c: Canvas):
    palette: list[B.Block] = []
    index_of: dict[B.Block, int] = {}
    layer0 = []
    # flat index = (x * Y + y) * Z + z  (ZYX order: z fastest, then y, then x)
    for x in range(X):
        for y in range(Y):
            for z in range(Z):
                blk = c.cells.get((x, y, z))
                if blk is None:
                    layer0.append(-1)
                    continue
                if blk not in index_of:
                    index_of[blk] = len(palette)
                    palette.append(blk)
                layer0.append(index_of[blk])
    return palette, layer0


def flat_index(x, y, z):
    return (x * Y + y) * Z + z


def to_nbt(c: Canvas) -> N.Compound:
    palette, layer0 = palette_and_indices(c)
    layer1 = [-1] * len(layer0)
    block_palette = N.List(N.TAG_COMPOUND, [state_compound(b) for b in palette])
    pos_data = {}
    for (x, y, z), ent in sorted(c.entities.items(), key=lambda kv: flat_index(*kv[0])):
        pos_data[str(flat_index(x, y, z))] = N.Compound({"block_entity_data": N.Compound(dict(ent))})
    root = N.Compound({
        "format_version": N.Int(1),
        "size": N.List(N.TAG_INT, [N.Int(X), N.Int(Y), N.Int(Z)]),
        "structure": N.Compound({
            "block_indices": N.List(N.TAG_LIST, [
                N.List(N.TAG_INT, [N.Int(v) for v in layer0]),
                N.List(N.TAG_INT, [N.Int(v) for v in layer1]),
            ]),
            "entities": N.List(N.TAG_COMPOUND, []),
            "palette": N.Compound({
                "default": N.Compound({
                    "block_palette": block_palette,
                    "block_position_data": N.Compound(pos_data),
                }),
            }),
        }),
        "structure_world_origin": N.List(N.TAG_INT, [N.Int(0), N.Int(0), N.Int(0)]),
    })
    return root


def write_meta(c: Canvas, build_seconds: int = 7):
    px, py, pz = (1, 4, 6)  # living room air cell under the ceiling, far from furniture
    assert c.cells.get((px, py, pz)) == AIR, c.cells.get((px, py, pz))
    ex, ey, ez = ENTRANCE
    text = f"""// @ts-check
// GENERATED by tools/house/blueprint.py — do not edit by hand.
// Geometry of the Luxury Base structure in its canonical orientation
// (+x east, +z south, +y up; entrance on the SOUTH side).

/**
 * @typedef {{{{ x: number, y: number, z: number }}}} Vec3i
 * @typedef {{{{
 *   structureId: string,
 *   size: Vec3i,
 *   entrance: Vec3i,
 *   entranceSide: "south",
 *   floorY: number,
 *   supportRatio: number,
 *   buildSeconds: number,
 *   probeCell: Vec3i,
 * }}}} HouseMeta
 */

/**
 * - `structureId`: id of `structures/pas/luxury_base.mcstructure`.
 * - `size`: structure size in blocks (x, y, z).
 * - `entrance`: local cell just OUTSIDE the front door, where the player stands
 *   (porch, in front of the east door leaf); `y` is the walking level.
 * - `entranceSide`: side of the box the front door faces in canonical orientation.
 * - `floorY`: local y of the ground-floor walking surface (feet level); local y 0 is
 *   the foundation layer that sits on top of the terrain.
 * - `supportRatio`: minimum fraction of footprint cells that must have solid ground below.
 * - `buildSeconds`: animationSeconds for the layer-by-layer placement.
 * - `probeCell`: a local cell that is plain air in the finished house (living room,
 *   under the ceiling) — safe scratch cell for the rotation calibration probe.
 * @type {{Readonly<HouseMeta>}}
 */
export const HOUSE = Object.freeze({{
  structureId: "pas:luxury_base",
  size: Object.freeze({{ x: {X}, y: {Y}, z: {Z} }}),
  entrance: Object.freeze({{ x: {ex}, y: {ey}, z: {ez} }}),
  entranceSide: "south",
  floorY: {FLOOR_Y},
  supportRatio: 0.8,
  buildSeconds: {build_seconds},
  probeCell: Object.freeze({{ x: {px}, y: {py}, z: {pz} }}),
}});
"""
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(text)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-images", action="store_true")
    args = ap.parse_args(argv)
    c = build()
    root = to_nbt(c)
    data = N.dumps(root)
    STRUCTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STRUCTURE_PATH.write_bytes(data)
    write_meta(c)
    palette, layer0 = palette_and_indices(c)
    print(f"wrote {STRUCTURE_PATH.relative_to(ROOT)} ({len(data)} bytes, {len(palette)} palette entries, "
          f"{sum(1 for v in layer0 if v >= 0)} placed cells, {len(c.entities)} block entities)")
    print(f"wrote {META_PATH.relative_to(ROOT)}")
    if not args.no_images:
        import render
        render.render_all(c, IMAGES)
    return c


if __name__ == "__main__":
    main()

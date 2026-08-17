#!/usr/bin/env python3
"""Abandoned locations for Lost Island: Abandoned.

Builds all 26 anchors from SPEC.md section 2 as /fill + /setblock + /loot steps.
Every building is a real structure with an interior: floors, walls, doorways,
windows, furniture, barricades, rubble, overgrowth, lighting and loot.

Also emits, for the story system:
  tools/out/note_spots.json      readable-note trigger volumes
  tools/out/locked_areas.json    progression-gated barricades
  tools/out/discover_zones.json  "location discovered" trigger volumes
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP_DIR = os.path.join(ROOT, "build", "Lost_Island_BP", "functions",
                        "li_build", "l")
OUT = os.path.join(ROOT, "tools", "out")

MAX_FILL = 32768
MAX_CMDS = 150
MAX_STEP_VOLUME = 140000
R = 168
Y_MIN, Y_MAX = 12, 140
SEED = 77042

rnd = random.Random(SEED)

NOTES = []
LOCKED = []
ZONES = []


class Sink:
    def __init__(self):
        self.cmds = []
        self.labels = {}
        self.pending = None
        self.max_vol = 0

    def label(self, t):
        self.pending = t

    def _add(self, cmd, vol):
        if self.pending is not None:
            self.labels[len(self.cmds)] = self.pending
            self.pending = None
        self.cmds.append((cmd, vol))

    def fill(self, x0, y0, z0, x1, y1, z1, block):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        vol = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1)
        assert vol <= MAX_FILL, vol
        assert Y_MIN <= y0 and y1 <= Y_MAX, (y0, y1)
        assert -R <= x0 and x1 <= R and -R <= z0 and z1 <= R, (x0, x1, z0, z1)
        self.max_vol = max(self.max_vol, vol)
        self._add("fill %d %d %d %d %d %d %s"
                  % (x0, y0, z0, x1, y1, z1, block), vol)

    def sb(self, x, y, z, block):
        assert Y_MIN <= y <= Y_MAX, y
        assert -R <= x <= R and -R <= z <= R, (x, z)
        self._add("setblock %d %d %d %s" % (x, y, z, block), 1)

    def loot(self, x, y, z, table):
        self.sb(x, y, z, P.CHEST)
        self._add('loot replace block %d %d %d slot.container 0 loot "chests/%s"'
                  % (x, y, z, table), 1)

    def big_fill(self, x0, y0, z0, x1, y1, z1, block):
        for xa in range(x0, x1 + 1, 32):
            xb = min(x1, xa + 31)
            for za in range(z0, z1 + 1, 32):
                zb = min(z1, za + 31)
                for ya in range(y0, y1 + 1, 31):
                    yb = min(y1, ya + 30)
                    self.fill(xa, ya, za, xb, yb, zb, block)

    def steps(self):
        out, cur, vol = [], [], 0
        for c, v in self.cmds:
            if cur and (len(cur) >= MAX_CMDS or vol + v > MAX_STEP_VOLUME):
                out.append(cur)
                cur, vol = [], 0
            cur.append(c)
            vol += v
        if cur:
            out.append(cur)
        return out


S = Sink()


# ---------------------------------------------------------------------------
# building primitives
# ---------------------------------------------------------------------------
def site(x, y, z, w, d, surface=None, up=22, off=(0, 0)):
    """Level a build site. The terrain pass only flattens 40x40 around each
    anchor, so anything larger levels its own footprint here."""
    surface = surface or P.GRASS
    x0 = max(-R, x + off[0] - w // 2)
    x1 = min(R, x + off[0] + w // 2)
    z0 = max(-R, z + off[1] - d // 2)
    z1 = min(R, z + off[1] + d // 2)
    S.big_fill(x0, y + 1, z0, x1, min(Y_MAX, y + up), z1, P.AIR)
    S.big_fill(x0, max(Y_MIN, y - 3), z0, x1, y - 1, z1, P.DIRT)
    S.big_fill(x0, y, z0, x1, y, z1, surface)


def clear(x, y, z, w, h, d):
    S.fill(x, y, z, x + w - 1, y + h - 1, z + d - 1, P.AIR)


def shell(x, y, z, w, d, h, wall, floor=None, roof=None, hollow=True):
    """Walled box with a floor and optional roof; interior left empty."""
    S.fill(x, y, z, x + w - 1, y + h - 1, z + d - 1, wall)
    if hollow:
        S.fill(x + 1, y + 1, z + 1, x + w - 2, y + h - 2, z + d - 2, P.AIR)
    if floor:
        S.fill(x, y, z, x + w - 1, y, z + d - 1, floor)
    if roof:
        S.fill(x, y + h - 1, z, x + w - 1, y + h - 1, z + d - 1, roof)


def doorway(x, y, z, axis="z", wide=1, height=2):
    if axis == "z":
        S.fill(x, y + 1, z, x + wide - 1, y + height, z, P.AIR)
    else:
        S.fill(x, y + 1, z, x, y + height, z + wide - 1, P.AIR)


def window_row(x, y, z, count, step, axis="x", pane=None, broken=0.35):
    pane = pane or P.GLASS_PANE
    for i in range(count):
        wx = x + i * step if axis == "x" else x
        wz = z if axis == "x" else z + i * step
        S.sb(wx, y, wz, P.AIR if rnd.random() < broken else pane)
        S.sb(wx, y + 1, wz, P.AIR if rnd.random() < broken else pane)


def collapse_roof(x, y, z, w, d, holes=3):
    """Punch holes in a roof and drop rubble below them."""
    for _ in range(holes):
        hx = x + rnd.randint(1, max(1, w - 2))
        hz = z + rnd.randint(1, max(1, d - 2))
        S.fill(hx, y, hz, min(x + w - 1, hx + 1), y, min(z + d - 1, hz + 1),
               P.AIR)
        S.sb(hx, y - 3, hz, P.COBBLE)


def rubble(x, y, z, w, d, n=6, blocks=None):
    blocks = blocks or [P.COBBLE, P.MOSSY_COBBLE, P.GRAVEL, P.LI_CONCRETE]
    for _ in range(n):
        rx = x + rnd.randint(0, max(0, w - 1))
        rz = z + rnd.randint(0, max(0, d - 1))
        S.sb(rx, y, rz, rnd.choice(blocks))


def overgrow(x, y, z, w, d, h, amount=10):
    """Vines and moss creeping over a structure."""
    for _ in range(amount):
        side = rnd.randint(0, 3)
        if side == 0:
            vx, vz = x + rnd.randint(0, w - 1), z
        elif side == 1:
            vx, vz = x + rnd.randint(0, w - 1), z + d - 1
        elif side == 2:
            vx, vz = x, z + rnd.randint(0, d - 1)
        else:
            vx, vz = x + w - 1, z + rnd.randint(0, d - 1)
        vy = y + rnd.randint(1, max(1, h - 1))
        S.sb(vx, vy, vz, P.VINE)
    for _ in range(amount // 2):
        S.sb(x + rnd.randint(0, w - 1), y, z + rnd.randint(0, d - 1),
             P.MOSS_CARPET)


def barricade(x, y, z, w, d, h=2, block=None):
    block = block or P.OAK_PLANKS
    S.fill(x, y + 1, z, x + w - 1, y + h, z + d - 1, block)


def furnish(x, y, z, w, d, style="house"):
    """Interior props built from blocks. Placed just inside the walls."""
    ix, iz, iw, id_ = x + 1, z + 1, w - 2, d - 2
    if iw < 2 or id_ < 2:
        return
    picks = {
        "house": [P.CRAFTING_TABLE, P.BARREL, P.FURNACE, P.BOOKSHELF,
                  P.WHITE_WOOL, P.OAK_SLAB, P.CAULDRON],
        "medical": [P.WHITE_WOOL, P.LI_PANEL, P.BARREL, P.CAULDRON,
                    P.LI_VENT],
        "office": [P.BOOKSHELF, P.OAK_SLAB, P.BARREL, P.LECTERN,
                   P.CARTOGRAPHY],
        "shop": [P.BARREL, P.OAK_SLAB, P.LI_RUSTED, P.BARREL],
        "lab": [P.LI_PANEL, P.LI_VENT, P.GLASS, P.BARREL, P.CAULDRON,
                P.NOTEBLOCK],
        "military": [P.LI_RUSTED, P.BARREL, P.ANVIL, P.GRAY_CONCRETE],
        "camp": [P.CAMPFIRE, P.BARREL, P.BROWN_WOOL, P.OAK_FENCE],
    }[style]
    for _ in range(max(3, (iw * id_) // 8)):
        fx = ix + rnd.randint(0, iw - 1)
        fz = iz + rnd.randint(0, id_ - 1)
        S.sb(fx, y + 1, fz, rnd.choice(picks))


def light(x, y, z, kind=None):
    S.sb(x, y, z, kind or P.LI_LIGHT)


def note(nid, name, x, y, z, r=3):
    NOTES.append({"id": nid, "name": name, "pos": [x, y, z],
                  "box": [x - r, y - 1, z - r, x + r, y + 3, z + r]})


def zone(zid, name, x, y, z, r=10):
    ZONES.append({"id": zid, "name": name, "pos": [x, y, z],
                  "box": [x - r, y - 3, z - r, x + r, y + 12, z + r]})


def lock(lid, item, box, hint, block=None):
    S.fill(box[0], box[1], box[2], box[3], box[4], box[5],
           block or P.IRON_BARS)
    LOCKED.append({"id": lid, "item": item, "box": list(box), "hint": hint})


# ---------------------------------------------------------------------------
# 1  starter beach: wrecked boat, luggage, campfire, footprints
# ---------------------------------------------------------------------------
def loc_wreck_beach(x, y, z):
    site(x, y, z, 28, 20, P.SAND, off=(0, 0))
    S.label("Beaching the wreck")
    zone(1, "Wreck Beach", x, y, z, 14)
    # hull, listing to port and half buried in the sand
    S.fill(x - 5, y, z - 2, x + 5, y, z + 3, P.OAK_PLANKS)
    S.fill(x - 5, y + 1, z - 2, x - 4, y + 2, z + 3, P.OAK_PLANKS)
    S.fill(x + 4, y + 1, z - 2, x + 5, y + 1, z + 3, P.OAK_PLANKS)
    S.fill(x - 3, y + 1, z - 2, x + 3, y + 1, z - 2, P.OAK_PLANKS)
    # snapped mast and torn rigging
    S.fill(x, y + 1, z, x, y + 5, z, P.OAK_LOG)
    S.sb(x, y + 6, z, P.OAK_FENCE)
    S.sb(x + 1, y + 4, z, P.WEB)
    # blown-out midships
    S.fill(x - 1, y + 1, z + 1, x + 2, y + 2, z + 2, P.AIR)
    rubble(x - 6, y, z - 4, 13, 9, 10, [P.OAK_PLANKS, P.OAK_SLAB, P.GRAVEL])
    # scattered luggage
    for (dx, dz, tbl) in ((-7, 2, "survivor_stash"), (6, -3, "empty"),
                          (-3, 5, "empty")):
        S.loot(x + dx, y + 1, z + dz, tbl)
    S.sb(x + 8, y + 1, z + 1, P.BARREL)
    # driftwood
    for i in range(7):
        S.sb(x - 9 + i * 3, y + 1, z + 5 + (i % 3), P.OAK_LOG)
    # dead campfire someone else left
    S.sb(x - 10, y + 1, z - 5, P.CAMPFIRE)
    S.fill(x - 12, y + 1, z - 7, x - 8, y + 1, z - 3, P.MOSS_CARPET)
    for d in range(4):
        S.sb(x - 12 + d, y + 1, z - 7, P.OAK_FENCE)
    # the warning sign on a post
    S.sb(x + 2, y + 1, z - 6, P.OAK_FENCE)
    S.sb(x + 2, y + 2, z - 6, P.LI_SIGN_HAND)
    note(1, "beach_warning", x + 2, y + 1, z - 6, 3)
    note(2, "wreck_manifest", x, y + 1, z + 1, 3)
    # footprint path leading inland (north)
    for i in range(22):
        px = x + int(3 * math.sin(i * 0.4))
        S.fill(px - 1, y, z - 8 - i, px + 1, y, z - 8 - i, P.COARSE_DIRT)


# ---------------------------------------------------------------------------
# small survivor camps and shacks
# ---------------------------------------------------------------------------
def loc_camp(x, y, z, zid, name, tents=3, table="survivor_stash"):
    S.label("Pitching " + name)
    zone(zid, name, x, y, z, 12)
    for t in range(tents):
        tx = x + (t - 1) * 6
        tz = z + rnd.randint(-4, 4)
        # A-frame tent from wool
        for i in range(4):
            S.fill(tx - 2 + i, y + 1 + i, tz - 2, tx - 2 + i, y + 1 + i,
                   tz + 2, P.BROWN_WOOL if t % 2 else P.GREEN_WOOL)
            S.fill(tx + 2 - i, y + 1 + i, tz - 2, tx + 2 - i, y + 1 + i,
                   tz + 2, P.BROWN_WOOL if t % 2 else P.GREEN_WOOL)
        S.fill(tx - 1, y + 1, tz - 1, tx + 1, y + 1, tz + 1, P.WHITE_WOOL)
        if t == 0:
            S.loot(tx, y + 1, tz + 2, table)
    S.sb(x, y + 1, z + 6, P.CAMPFIRE)
    # drying rack
    S.fill(x - 3, y + 1, z + 7, x + 3, y + 1, z + 7, P.OAK_FENCE)
    S.fill(x - 3, y + 2, z + 7, x + 3, y + 2, z + 7, P.OAK_FENCE)
    S.sb(x + 1, y + 2, z + 7, P.LI_NOTICE)
    S.sb(x - 4, y + 1, z + 6, P.BARREL)
    note(zid + 20, name + "_note", x, y + 1, z + 6, 4)


def loc_fishing_shacks(x, y, z):
    site(x, y, z, 32, 16, P.SAND)
    S.label("Raising the fishing shacks")
    zone(3, "Fishing Shacks", x, y, z, 14)
    for i in range(3):
        sx = x + (i - 1) * 9
        w, d, h = 7, 6, 5
        shell(sx - 3, y, z - 3, w, d, h, P.OAK_PLANKS, P.OAK_PLANKS,
              P.OAK_SLAB)
        doorway(sx, y, z - 3)
        window_row(sx - 3, y + 2, z, 1, 1)
        window_row(sx + 3, y + 2, z, 1, 1)
        collapse_roof(sx - 3, y + h - 1, z - 3, w, d, 2)
        furnish(sx - 3, y, z - 3, w, d, "house")
        overgrow(sx - 3, y, z - 3, w, d, h, 8)
        if i == 1:
            S.loot(sx, y + 1, z, "common_house")
    # jetty out over the water
    S.fill(x - 1, y, z + 4, x + 1, y, z + 16, P.OAK_PLANKS)
    for i in range(0, 13, 3):
        S.fill(x - 1, y - 3, z + 4 + i, x - 1, y - 1, z + 4 + i, P.OAK_LOG)
        S.fill(x + 1, y - 3, z + 4 + i, x + 1, y - 1, z + 4 + i, P.OAK_LOG)
    S.sb(x, y + 1, z + 15, P.BARREL)
    note(23, "fisher_log", x, y + 1, z + 14, 3)


# ---------------------------------------------------------------------------
# village + civic buildings
# ---------------------------------------------------------------------------
def house(x, y, z, w, d, h, style="house", overgrown=False, table=None):
    wall = P.MOSSY_COBBLE if overgrown else P.COBBLE
    shell(x, y, z, w, d, h, wall, P.OAK_PLANKS, P.OAK_PLANKS)
    doorway(x + w // 2, y, z)
    window_row(x + 1, y + 2, z, max(1, (w - 2) // 2), 2)
    window_row(x + 1, y + 2, z + d - 1, max(1, (w - 2) // 2), 2)
    # interior partition wall with a gap
    if w > 7:
        S.fill(x + w // 2, y + 1, z + 1, x + w // 2, y + h - 2, z + d - 2,
               P.OAK_PLANKS)
        S.fill(x + w // 2, y + 1, z + d // 2, x + w // 2, y + 2, z + d // 2,
               P.AIR)
    collapse_roof(x, y + h - 1, z, w, d, 2 if overgrown else 1)
    furnish(x, y, z, w, d, style)
    rubble(x + 1, y + 1, z + 1, w - 2, d - 2, 4)
    if overgrown:
        overgrow(x, y, z, w, d, h, 14)
        S.fill(x + 1, y, z + 1, x + 2, y, z + 2, P.MOSS)
    if table:
        S.loot(x + 1, y + 1, z + d - 2, table)


def loc_village(x, y, z):
    S.label("Clearing the village site")
    site(x, y, z, 42, 40)
    S.label("Rebuilding the village")
    zone(5, "Abandoned Village", x, y, z, 18)
    plots = [(-14, -12, 9, 8, 5, True), (-2, -13, 8, 7, 5, False),
             (9, -11, 10, 8, 6, True), (-15, 1, 8, 8, 5, False),
             (10, 2, 9, 7, 5, True), (-13, 11, 10, 8, 6, False),
             (0, 12, 8, 7, 5, True), (11, 12, 8, 8, 5, False),
             (-4, 0, 7, 6, 5, True)]
    for i, (dx, dz, w, d, h, og) in enumerate(plots):
        house(x + dx, y, z + dz, w, d, h, "house", og,
              "common_house" if i % 2 == 0 else ("empty" if i % 3 else None))
    # well in the square
    S.fill(x - 1, y, z - 1, x + 1, y + 1, z + 1, P.COBBLE)
    S.fill(x, y - 4, z, x, y + 1, z, P.WATER)
    S.fill(x - 1, y + 3, z - 1, x + 1, y + 3, z + 1, P.OAK_SLAB)
    S.sb(x - 1, y + 2, z - 1, P.OAK_FENCE)
    S.sb(x + 1, y + 2, z + 1, P.OAK_FENCE)
    # overgrown garden plots and a notice board
    S.fill(x + 4, y, z + 4, x + 8, y, z + 7, P.COARSE_DIRT)
    for i in range(6):
        S.sb(x + 4 + i % 5, y + 1, z + 4 + i % 4, P.TALLGRASS)
    S.sb(x + 2, y + 1, z - 3, P.LI_NOTICE)
    note(3, "village_notice", x + 2, y + 1, z - 3, 3)
    note(4, "village_diary", x - 13, y + 1, z - 10, 4)
    note(5, "village_evac", x + 10, y + 1, z + 14, 4)


def loc_supermarket(x, y, z):
    site(x, y, z, 30, 26)
    S.label("Opening the supermarket")
    zone(6, "Supermarket", x, y, z, 16)
    w, d, h = 21, 16, 6
    shell(x - 10, y, z - 8, w, d, h, P.LI_CONCRETE, P.LIGHT_GRAY_CONCRETE,
          P.LI_CONCRETE)
    doorway(x - 1, y, z - 8, "z", 3)
    window_row(x - 8, y + 2, z - 8, 3, 2)
    window_row(x + 4, y + 2, z - 8, 3, 2)
    # shelving rows
    for r in range(4):
        rz = z - 5 + r * 4
        S.fill(x - 8, y + 1, rz, x + 4, y + 2, rz, P.OAK_PLANKS)
        for i in range(0, 13, 4):
            S.sb(x - 8 + i, y + 2, rz, P.BARREL)
        # knocked-over section
        if r == 2:
            S.fill(x - 3, y + 1, rz, x, y + 2, rz, P.AIR)
            rubble(x - 3, y + 1, rz, 4, 1, 4, [P.OAK_SLAB, P.LI_CONCRETE])
    # checkouts
    S.fill(x - 8, y + 1, z + 5, x + 2, y + 1, z + 5, P.LI_PANEL)
    # storeroom behind a barricade
    S.fill(x + 6, y + 1, z - 7, x + 6, y + h - 2, z + 6, P.LI_CONCRETE)
    doorway(x + 6, y, z + 2, "x", 2)
    barricade(x + 6, y, z + 2, 1, 2, 2, P.OAK_PLANKS)
    for i in range(3):
        S.loot(x + 8, y + 1, z - 4 + i * 4, "supermarket")
    S.loot(x - 6, y + 1, z + 6, "empty")
    S.loot(x + 2, y + 1, z - 6, "supermarket")
    light(x - 2, y + h - 2, z - 4)
    light(x - 2, y + h - 2, z + 3)
    overgrow(x - 10, y, z - 8, w, d, h, 16)
    note(6, "market_note", x + 8, y + 1, z, 4)


def loc_gas_station(x, y, z):
    site(x, y, z, 24, 40, P.GRAVEL, off=(0, 4))
    S.label("Building the gas station")
    zone(7, "Gas Station", x, y, z, 14)
    shell(x - 6, y, z - 5, 11, 9, 5, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    doorway(x - 1, y, z + 3, "z", 2)
    window_row(x - 5, y + 2, z + 3, 2, 2)
    furnish(x - 6, y, z - 5, 11, 9, "shop")
    S.loot(x - 4, y + 1, z - 3, "gas_station")
    S.loot(x + 2, y + 1, z - 3, "empty")
    # canopy and pumps
    S.fill(x - 8, y + 5, z + 7, x + 8, y + 5, z + 13, P.LI_RUSTED)
    for px_ in (x - 6, x, x + 6):
        S.fill(px_, y + 1, z + 10, px_, y + 4, z + 10, P.LI_RUSTED)
        S.sb(px_, y + 1, z + 9, P.LI_PANEL)
        S.sb(px_, y + 2, z + 9, P.LI_RUSTED)
    # wrecked pickup
    S.fill(x + 4, y + 1, z + 2, x + 6, y + 2, z + 5, P.RED_CONCRETE)
    S.fill(x + 4, y + 3, z + 3, x + 6, y + 3, z + 4, P.GLASS)
    S.sb(x + 4, y + 1, z + 1, P.BLACK_CONCRETE)
    S.sb(x + 6, y + 1, z + 1, P.BLACK_CONCRETE)
    S.sb(x - 7, y + 1, z + 8, P.LI_SIGN_KEEP)
    note(7, "gas_note", x - 4, y + 1, z - 3, 3)


def loc_motel(x, y, z):
    site(x, y, z, 30, 30, P.GRAVEL)
    S.label("Opening the motel")
    zone(8, "Motel", x, y, z, 16)
    for row in (0, 1):
        rz = z - 6 + row * 12
        S.fill(x - 12, y, rz, x + 12, y + 4, rz + 5, P.LI_CONCRETE)
        for r in range(5):
            rx = x - 11 + r * 5
            S.fill(rx, y + 1, rz + 1, rx + 3, y + 3, rz + 4, P.AIR)
            doorway(rx + 1, y, rz, "z", 2)
            window_row(rx + 3, y + 2, rz, 1, 1)
            S.fill(rx, y + 1, rz + 3, rx + 1, y + 1, rz + 4, P.WHITE_WOOL)
            if r == 2 and row == 0:
                S.loot(rx + 2, y + 1, rz + 1, "common_house")
            if r == 4 and row == 1:
                S.loot(rx + 2, y + 1, rz + 1, "empty")
        S.fill(x - 12, y + 5, rz, x + 12, y + 5, rz + 5, P.LI_RUSTED)
        overgrow(x - 12, y, rz, 25, 6, 5, 18)
    # office
    shell(x - 4, y, z + 1, 9, 5, 5, P.LI_CONCRETE, P.OAK_PLANKS, P.LI_RUSTED)
    doorway(x, y, z + 1)
    furnish(x - 4, y, z + 1, 9, 5, "office")
    S.loot(x - 2, y + 1, z + 3, "common_house")
    note(8, "motel_register", x - 2, y + 1, z + 3, 3)


def loc_hospital(x, y, z):
    site(x, y, z, 30, 26)
    S.label("Building the hospital")
    zone(9, "Hospital", x, y, z, 18)
    w, d = 23, 17
    for fl in (0, 1):
        fy = y + fl * 5
        shell(x - 11, fy, z - 8, w, d, 6, P.LI_CONCRETE, P.WHITE_CONCRETE,
              P.LI_CONCRETE)
        if fl == 0:
            doorway(x - 1, fy, z - 8, "z", 3)
        window_row(x - 9, fy + 2, z - 8, 4, 2)
        window_row(x + 3, fy + 2, z - 8, 3, 2)
        # ward beds
        for b in range(5):
            bx = x - 9 + b * 4
            S.fill(bx, fy + 1, z - 5, bx + 1, fy + 1, z - 3, P.WHITE_WOOL)
            S.sb(bx, fy + 1, z - 6, P.LI_PANEL)
        # corridor wall
        S.fill(x - 11, fy + 1, z, x + 11, fy + 4, z, P.LI_PANEL)
        S.fill(x - 2, fy + 1, z, x, fy + 2, z, P.AIR)
        furnish(x - 11, fy, z + 1, w, 8, "medical")
        light(x - 6, fy + 4, z - 2)
        light(x + 6, fy + 4, z - 2)
        light(x, fy + 4, z + 5)
    # stairwell
    S.fill(x + 8, y + 1, z + 5, x + 9, y + 9, z + 6, P.AIR)
    for i in range(8):
        S.sb(x + 8, y + 1 + i, z + 5, P.LADDER)
    # pharmacy: crowbar-gated
    S.fill(x - 10, y + 1, z + 2, x - 6, y + 4, z + 6, P.AIR)
    S.fill(x - 6, y + 1, z + 2, x - 6, y + 4, z + 6, P.LI_PANEL)
    lock("hospital_pharmacy", "li:crowbar",
         (x - 6, y + 1, z + 3, x - 6, y + 2, z + 4),
         "The pharmacy door is buckled shut. Something heavy could pry it.")
    S.loot(x - 9, y + 1, z + 3, "medical")
    S.loot(x - 8, y + 1, z + 5, "medical")
    S.loot(x + 4, y + 6, z - 4, "medical")
    overgrow(x - 11, y, z - 8, w, d, 6, 20)
    note(9, "hospital_triage", x - 1, y + 1, z - 6, 4)
    note(10, "hospital_quarantine", x - 9, y + 1, z + 3, 3)


def loc_police(x, y, z):
    site(x, y, z, 24, 20, P.GRAVEL)
    S.label("Building the police station")
    zone(10, "Police Station", x, y, z, 14)
    w, d, h = 17, 13, 6
    shell(x - 8, y, z - 6, w, d, h, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_CONCRETE)
    doorway(x - 1, y, z - 6, "z", 3)
    window_row(x - 6, y + 2, z - 6, 2, 2)
    furnish(x - 8, y, z - 6, w, 7, "office")
    # holding cells
    for c in range(3):
        cx = x - 6 + c * 5
        S.fill(cx, y + 1, z + 2, cx + 3, y + h - 2, z + 5, P.AIR)
        S.fill(cx, y + 1, z + 2, cx, y + h - 2, z + 5, P.IRON_BARS)
        S.fill(cx + 3, y + 1, z + 2, cx + 3, y + h - 2, z + 5, P.IRON_BARS)
        S.fill(cx, y + 1, z + 2, cx + 3, y + h - 2, z + 2, P.IRON_BARS)
        S.fill(cx + 1, y + 1, z + 2, cx + 2, y + 2, z + 2, P.AIR)
        S.fill(cx + 1, y + 1, z + 4, cx + 1, y + 1, z + 5, P.WHITE_WOOL)
    # armoury: crowbar-gated
    S.fill(x + 4, y + 1, z - 5, x + 7, y + 4, z - 1, P.AIR)
    S.fill(x + 4, y + 1, z - 5, x + 4, y + 4, z - 1, P.IRON_BLOCK)
    lock("police_armoury", "li:crowbar",
         (x + 4, y + 1, z - 4, x + 4, y + 2, z - 3),
         "The armoury door is locked. The frame looks weak.")
    S.loot(x + 6, y + 1, z - 4, "police")
    S.loot(x + 6, y + 1, z - 2, "police")
    S.loot(x - 6, y + 1, z - 4, "empty")
    light(x, y + h - 2, z - 3)
    light(x, y + h - 2, z + 4)
    note(11, "police_report", x + 6, y + 1, z - 3, 3)
    note(12, "police_radio", x - 6, y + 1, z - 4, 3)


def loc_fire_station(x, y, z):
    site(x, y, z, 22, 20, P.GRAVEL)
    S.label("Building the fire station")
    zone(11, "Fire Station", x, y, z, 14)
    w, d, h = 15, 13, 9
    shell(x - 7, y, z - 6, w, d, h, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    # engine bay opening
    S.fill(x - 5, y + 1, z - 6, x + 5, y + 4, z - 6, P.AIR)
    # the engine itself, half dismantled
    S.fill(x - 4, y + 1, z - 4, x - 1, y + 3, z + 2, P.RED_CONCRETE)
    S.fill(x - 4, y + 4, z - 3, x - 1, y + 4, z - 1, P.GLASS)
    S.sb(x - 4, y + 1, z + 3, P.BLACK_CONCRETE)
    S.sb(x - 1, y + 1, z + 3, P.BLACK_CONCRETE)
    # upper dormitory on a mezzanine
    S.fill(x + 1, y + 5, z - 5, x + 6, y + 5, z + 5, P.OAK_PLANKS)
    # opening in the mezzanine so the ladder actually gets you up there
    S.sb(x + 6, y + 5, z + 5, P.AIR)
    for i in range(5):
        S.sb(x + 6, y + 1 + i, z + 5, P.LADDER)
    for b in range(3):
        S.fill(x + 2, y + 6, z - 4 + b * 3, x + 3, y + 6, z - 3 + b * 3,
               P.WHITE_WOOL)
    S.loot(x + 5, y + 6, z + 2, "common_house")
    S.loot(x + 3, y + 1, z + 4, "key_crowbar")
    furnish(x - 7, y, z + 1, w, 6, "shop")
    light(x, y + h - 2, z)
    overgrow(x - 7, y, z - 6, w, d, h, 12)
    note(13, "fire_log", x + 5, y + 6, z + 2, 3)


def loc_ranger_station(x, y, z):
    site(x, y, z, 28, 22)
    S.label("Building the ranger station")
    zone(4, "Ranger Station", x, y, z, 13)
    shell(x - 5, y, z - 4, 11, 9, 5, P.SPRUCE_PLANKS, P.OAK_PLANKS,
          P.OAK_SLAB)
    doorway(x, y, z + 4)
    window_row(x - 4, y + 2, z - 4, 3, 2)
    furnish(x - 5, y, z - 4, 11, 9, "office")
    S.loot(x - 3, y + 1, z - 2, "common_house")
    # lookout tower
    S.fill(x + 7, y, z, x + 8, y + 10, z + 1, P.OAK_LOG)
    S.fill(x + 5, y + 11, z - 2, x + 10, y + 11, z + 3, P.OAK_PLANKS)
    S.fill(x + 5, y + 12, z - 2, x + 10, y + 13, z + 3, P.OAK_FENCE)
    S.fill(x + 6, y + 12, z - 1, x + 9, y + 13, z + 2, P.AIR)
    # hatch through the platform for the ladder
    S.sb(x + 7, y + 11, z + 2, P.AIR)
    for i in range(11):
        S.sb(x + 7, y + 1 + i, z + 2, P.LADDER)
    S.loot(x + 9, y + 12, z + 2, "survivor_stash")
    S.sb(x + 6, y + 12, z + 1, P.LI_NOTICE)
    note(14, "ranger_log", x + 8, y + 12, z + 1, 3)
    note(15, "ranger_map", x - 3, y + 1, z - 2, 3)


# ---------------------------------------------------------------------------
# radio tower, lighthouse
# ---------------------------------------------------------------------------
def loc_radio_tower(x, y, z):
    site(x, y, z, 28, 22, P.GRAVEL, up=36, off=(-3, 0))
    S.label("Erecting the radio tower")
    zone(12, "Radio Tower", x, y, z, 16)
    # lattice mast
    for lv in range(0, 30, 3):
        s = 3 if lv < 12 else 2
        S.fill(x - s, y + lv, z - s, x - s, y + lv, z + s, P.IRON_BARS)
        S.fill(x + s, y + lv, z - s, x + s, y + lv, z + s, P.IRON_BARS)
        S.fill(x - s, y + lv, z - s, x + s, y + lv, z - s, P.IRON_BARS)
        S.fill(x - s, y + lv, z + s, x + s, y + lv, z + s, P.IRON_BARS)
    for (cx, cz) in ((-3, -3), (-3, 3), (3, -3), (3, 3)):
        S.fill(x + cx, y, z + cz, x + cx, y + 30, z + cz, P.LI_RUSTED)
    S.sb(x, y + 31, z, P.LI_LIGHT)
    for i in range(28):
        S.sb(x, y + 1 + i, z + 2, P.LADDER)
    # equipment shack with the console
    shell(x - 11, y, z - 5, 10, 10, 5, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    doorway(x - 7, y, z + 4)
    window_row(x - 10, y + 2, z - 5, 3, 2)
    S.fill(x - 10, y + 1, z - 4, x - 4, y + 1, z - 3, P.LI_PANEL)
    S.fill(x - 10, y + 2, z - 4, x - 8, y + 2, z - 4, P.LI_PANEL)
    S.sb(x - 9, y + 2, z - 3, P.NOTEBLOCK)
    S.sb(x - 6, y + 2, z - 3, P.LEVER)
    light(x - 6, y + 4, z)
    light(x - 9, y + 4, z + 2)
    furnish(x - 11, y, z, 10, 5, "office")
    S.loot(x - 9, y + 1, z + 2, "part_radio")
    S.loot(x - 5, y + 1, z + 2, "military")
    note(16, "radio_tower_log", x - 7, y + 1, z - 3, 4)
    note(17, "radio_tower_last", x - 5, y + 1, z + 2, 3)


def loc_lighthouse(x, y, z):
    site(x, y, z, 20, 20, P.SAND, up=34)
    S.label("Raising the lighthouse")
    zone(15, "Lighthouse", x, y, z, 16)
    H = 26
    # round-ish tower
    for lv in range(H):
        r = 4 if lv < 20 else 5
        for dz in range(-r, r + 1):
            dx = int(math.sqrt(max(0, r * r - dz * dz)))
            S.fill(x - dx, y + lv, z + dz, x + dx, y + lv, z + dz,
                   P.WHITE_CONCRETE if (lv // 4) % 2 == 0 else P.RED_CONCRETE)
    # hollow the shaft, then run a ladder the whole way up. A spiral of single
    # stair blocks cannot be climbed at this radius, so the ladder is the real
    # route and the stairs are decoration at the base.
    S.fill(x - 3, y + 1, z - 3, x + 3, y + H - 2, z + 3, P.AIR)
    for i in range(6):
        a = i * 0.9
        sx = x + int(2.4 * math.cos(a))
        sz = z + int(2.4 * math.sin(a))
        S.sb(sx, y + 1 + i, sz, P.STONE_BRICK_STAIRS)
    S.fill(x + 3, y + 1, z, x + 3, y + H + 1, z, P.LADDER)
    doorway(x, y, z + 4, "z", 2)
    # lamp room: the escape radio bench
    S.fill(x - 4, y + H - 1, z - 4, x + 4, y + H - 1, z + 4, P.LI_PANEL)
    # hatch so the ladder actually reaches the lamp room
    S.fill(x + 2, y + H - 1, z - 1, x + 3, y + H - 1, z + 1, P.AIR)
    S.fill(x - 3, y + H, z - 3, x + 3, y + H + 3, z + 3, P.AIR)
    S.fill(x - 4, y + H, z - 4, x + 4, y + H + 3, z + 4, P.GLASS)
    S.fill(x - 3, y + H, z - 3, x + 3, y + H + 2, z + 3, P.AIR)
    S.fill(x - 4, y + H + 4, z - 4, x + 4, y + H + 4, z + 4, P.LI_RUSTED)
    S.fill(x - 1, y + H, z - 2, x + 1, y + H + 1, z - 1, P.REDSTONE_LAMP)
    # the bench the player repairs
    S.fill(x - 3, y + H, z + 2, x + 3, y + H, z + 3, P.LI_PANEL)
    S.sb(x - 1, y + H + 1, z + 3, P.NOTEBLOCK)
    S.sb(x + 1, y + H + 1, z + 3, P.LEVER)
    S.sb(x, y + H + 1, z + 3, P.LI_PANEL)
    S.loot(x - 3, y + 1, z, "harbour")
    S.loot(x + 3, y + H, z - 2, "research")
    light(x - 3, y + 6, z)
    light(x - 3, y + 14, z)
    note(18, "lighthouse_keeper", x, y + H, z + 2, 4)
    note(19, "lighthouse_bench", x, y + H + 1, z + 3, 3)


# ---------------------------------------------------------------------------
# swamp, bridge, dam, mine
# ---------------------------------------------------------------------------
def loc_swamp_huts(x, y, z):
    site(x, y, z, 26, 26, P.MUD, up=14)
    S.label("Sinking the swamp huts")
    zone(13, "Swamp Huts", x, y, z, 15)
    for i in range(4):
        hx = x + (i % 2) * 11 - 5
        hz = z + (i // 2) * 11 - 5
        # stilts
        for (sx, sz) in ((0, 0), (5, 0), (0, 5), (5, 5)):
            S.fill(hx + sx, y - 2, hz + sz, hx + sx, y + 1, hz + sz,
                   P.MANGROVE_LOG)
        S.fill(hx, y + 2, hz, hx + 5, y + 2, hz + 5, P.DARK_OAK_PLANKS)
        shell(hx, y + 2, hz, 6, 6, 5, P.DARK_OAK_PLANKS, P.DARK_OAK_PLANKS,
              P.OAK_SLAB)
        doorway(hx + 2, y + 2, hz)
        collapse_roof(hx, y + 6, hz, 6, 6, 2)
        overgrow(hx, y + 2, hz, 6, 6, 5, 14)
        furnish(hx, y + 2, hz, 6, 6, "camp")
        if i == 0:
            S.loot(hx + 3, y + 3, hz + 3, "common_house")
        if i == 3:
            S.loot(hx + 3, y + 3, hz + 3, "empty")
    # walkways
    S.fill(x - 3, y + 2, z - 3, x + 3, y + 2, z - 3, P.DARK_OAK_PLANKS)
    S.fill(x - 3, y + 2, z - 3, x - 3, y + 2, z + 3, P.DARK_OAK_PLANKS)
    note(24, "swamp_hut_note", x - 2, y + 3, z - 2, 4)


def loc_broken_bridge(x, y, z):
    S.label("Breaking the bridge")
    zone(16, "Destroyed Bridge", x, y, z, 14)
    # abutments and deck, centre span gone
    for side in (-1, 1):
        S.fill(x - 3, y - 4, z + side * 9, x + 3, y, z + side * 5, P.STONEBRICK)
        S.fill(x - 2, y + 1, z + side * 9, x + 2, y + 1, z + side * 5,
               P.LI_CONCRETE)
        S.fill(x - 3, y + 2, z + side * 9, x - 3, y + 2, z + side * 5,
               P.OAK_FENCE)
        S.fill(x + 3, y + 2, z + side * 9, x + 3, y + 2, z + side * 5,
               P.OAK_FENCE)
    # rubble in the river
    for _ in range(14):
        S.sb(x + rnd.randint(-4, 4), y - 4, z + rnd.randint(-4, 4),
             rnd.choice([P.LI_CONCRETE, P.STONEBRICK, P.COBBLE]))
    # a failed rope-and-plank detour
    S.fill(x + 5, y + 1, z - 4, x + 5, y + 1, z - 1, P.OAK_PLANKS)
    S.fill(x + 5, y + 1, z + 2, x + 5, y + 1, z + 4, P.OAK_PLANKS)
    S.sb(x + 5, y + 2, z - 4, P.OAK_FENCE)
    S.sb(x + 5, y + 2, z + 4, P.OAK_FENCE)
    S.sb(x - 5, y + 1, z - 6, P.LI_SIGN_HAND)
    note(20, "bridge_note", x - 5, y + 1, z - 6, 3)


def loc_dam(x, y, z):
    site(x, y, z, 34, 24, P.GRAVEL, off=(0, 6))
    S.label("Pouring the dam")
    zone(17, "Dam", x, y, z, 18)
    # dam wall across the valley
    S.fill(x - 14, y - 16, z, x + 14, y + 4, z + 3, P.LI_CONCRETE)
    S.fill(x - 14, y + 5, z, x + 14, y + 5, z + 3, P.GRAY_CONCRETE)
    # sluice gates
    for g in (-8, 0, 8):
        S.fill(x + g - 1, y - 8, z, x + g + 1, y - 2, z + 3, P.AIR)
        S.fill(x + g - 1, y - 2, z, x + g + 1, y - 2, z + 3, P.IRON_BARS)
        S.sb(x + g, y + 1, z + 1, P.LI_PANEL)
    # walkway with railing
    S.fill(x - 14, y + 6, z, x + 14, y + 6, z + 3, P.AIR)
    S.fill(x - 14, y + 6, z, x + 14, y + 6, z, P.OAK_FENCE)
    S.fill(x - 14, y + 6, z + 3, x + 14, y + 6, z + 3, P.OAK_FENCE)
    # service building + maintenance corridor
    shell(x + 10, y + 6, z + 4, 9, 8, 5, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    doorway(x + 14, y + 6, z + 4)
    furnish(x + 10, y + 6, z + 4, 9, 8, "military")
    S.fill(x + 2, y - 2, z + 1, x + 9, y + 1, z + 2, P.AIR)
    S.fill(x + 2, y - 3, z + 1, x + 9, y - 3, z + 2, P.LI_PANEL)
    for i in range(0, 8, 3):
        light(x + 2 + i, y + 1, z + 1)
    S.loot(x + 13, y + 7, z + 6, "military")
    S.loot(x + 4, y - 1, z + 1, "mine")
    S.sb(x - 12, y + 7, z, P.LI_SIGN_KEEP)
    note(21, "dam_note", x + 13, y + 7, z + 6, 4)


def loc_mine(x, y, z):
    S.label("Timbering the mine")
    zone(18, "Abandoned Mine", x, y, z, 16)
    # headframe
    S.fill(x - 4, y, z - 4, x + 4, y + 1, z + 4, P.LI_CONCRETE)
    for (cx, cz) in ((-4, -4), (4, -4), (-4, 4), (4, 4)):
        S.fill(x + cx, y + 1, z + cz, x + cx, y + 9, z + cz, P.LI_RUSTED)
    S.fill(x - 4, y + 10, z - 4, x + 4, y + 10, z + 4, P.LI_RUSTED)
    # adit heading into the hillside, then down
    S.fill(x - 2, y + 1, z - 5, x + 2, y + 4, z - 30, P.AIR)
    for i in range(0, 26, 4):
        tz = z - 6 - i
        S.fill(x - 2, y + 1, tz, x - 2, y + 4, tz, P.OAK_LOG)
        S.fill(x + 2, y + 1, tz, x + 2, y + 4, tz, P.OAK_LOG)
        S.fill(x - 2, y + 4, tz, x + 2, y + 4, tz, P.OAK_LOG)
        S.sb(x, y + 1, tz, P.RAIL)
        if i % 8 == 0:
            S.sb(x + 1, y + 3, tz, P.TORCH)
        if i % 12 == 0:
            S.sb(x - 1, y + 2, tz, P.WEB)
    # collapsed section
    S.fill(x - 2, y + 1, z - 20, x + 2, y + 4, z - 18, P.COBBLE)
    S.fill(x - 2, y + 1, z - 19, x + 1, y + 2, z - 19, P.AIR)
    # descending shaft to the deep tunnels
    S.fill(x - 2, y - 26, z - 32, x + 2, y + 4, z - 28, P.AIR)
    for i in range(30):
        S.sb(x - 2, y + 3 - i, z - 31, P.LADDER)
    # lower gallery, linking toward the buried complex
    S.fill(x - 2, y - 26, z - 32, x + 2, y - 22, z - 46, P.AIR)
    for i in range(0, 14, 4):
        S.sb(x, y - 25, z - 34 - i, P.RAIL)
        light(x + 2, y - 23, z - 34 - i)
    S.loot(x + 1, y + 1, z - 12, "mine")
    S.loot(x - 1, y + 1, z - 24, "mine")
    S.loot(x + 1, y - 25, z - 44, "mine")
    S.sb(x - 5, y + 2, z - 4, P.LI_SIGN_KEEP)
    note(22, "mine_note", x + 1, y + 1, z - 12, 4)
    note(25, "mine_deep_note", x + 1, y - 25, z - 44, 4)


# ---------------------------------------------------------------------------
# harbour, shipwreck
# ---------------------------------------------------------------------------
def loc_harbour(x, y, z):
    site(x, y, z, 42, 24, P.GRAVEL, off=(0, -2))
    S.label("Building the harbour")
    zone(19, "Harbour", x, y, z, 22)
    # concrete piers
    S.fill(x - 18, y - 4, z - 6, x + 18, y + 1, z + 4, P.LI_CONCRETE)
    S.fill(x - 14, y - 4, z + 5, x - 6, y + 1, z + 18, P.LI_CONCRETE)
    S.fill(x + 6, y - 4, z + 5, x + 14, y + 1, z + 18, P.LI_CONCRETE)
    # cranes
    for cx in (x - 12, x + 10):
        S.fill(cx, y + 2, z - 2, cx, y + 14, z - 2, P.LI_RUSTED)
        S.fill(cx, y + 14, z - 2, cx, y + 14, z + 8, P.LI_RUSTED)
        S.sb(cx, y + 13, z + 8, P.IRON_BARS)
        S.sb(cx, y + 12, z + 8, P.IRON_BARS)
    # cargo containers
    cols = [P.RED_CONCRETE, P.BLUE_CONCRETE, P.YELLOW_CONCRETE,
            P.GRAY_CONCRETE]
    for i in range(7):
        bx = x - 16 + i * 5
        by = y + 2 + (3 if i % 3 == 0 else 0)
        c = cols[i % 4]
        S.fill(bx, by, z - 5, bx + 3, by + 2, z - 1, c)
        S.fill(bx + 1, by, z - 4, bx + 2, by + 1, z - 2, P.AIR)
        S.fill(bx, by, z - 5, bx + 3, by + 2, z - 5, P.LI_RUSTED)
        S.fill(bx + 1, by, z - 5, bx + 2, by + 1, z - 5, P.AIR)
        if i % 2 == 0:
            S.loot(bx + 1, by + 1, z - 3, "harbour" if i % 4 else "empty")
    # checkpoint booth + crowd barriers facing the ferry: the evacuation failed
    shell(x - 3, y + 2, z + 6, 7, 6, 5, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    doorway(x, y + 2, z + 6)
    window_row(x - 2, y + 4, z + 6, 2, 2)
    furnish(x - 3, y + 2, z + 6, 7, 6, "military")
    for i in range(12):
        bx = x - 12 + i * 2
        S.fill(bx, y + 2, z + 13, bx, y + 3, z + 13, P.IRON_BARS)
        if i in (4, 5, 9):
            S.fill(bx, y + 2, z + 13, bx, y + 3, z + 13, P.AIR)
            S.sb(bx, y + 2, z + 12, P.LI_RUSTED)
    # abandoned luggage everywhere
    for _ in range(16):
        S.sb(x + rnd.randint(-14, 14), y + 2, z + rnd.randint(6, 17),
             rnd.choice([P.BARREL, P.OAK_SLAB, P.BROWN_WOOL]))
    # the half-sunk ferry
    S.fill(x - 6, y - 3, z + 20, x + 6, y + 1, z + 34, P.LIGHT_GRAY_CONCRETE)
    S.fill(x - 5, y - 2, z + 21, x + 5, y + 1, z + 33, P.AIR)
    S.fill(x - 4, y + 2, z + 24, x + 4, y + 5, z + 30, P.LIGHT_GRAY_CONCRETE)
    S.fill(x - 3, y + 3, z + 25, x + 3, y + 4, z + 29, P.AIR)
    S.fill(x - 4, y + 4, z + 24, x + 4, y + 4, z + 24, P.GLASS)
    doorway(x, y + 2, z + 24, "z", 2)
    S.loot(x + 2, y + 3, z + 27, "part_mech")
    S.loot(x - 3, y - 1, z + 30, "harbour")
    light(x, y + 4, z + 27)
    S.sb(x - 8, y + 2, z + 12, P.LI_SIGN_QUAR)
    note(26, "harbour_manifest", x, y + 3, z + 7, 4)
    note(27, "harbour_evac_fail", x - 8, y + 2, z + 12, 4)
    note(28, "ferry_log", x + 2, y + 3, z + 27, 4)


def loc_shipwreck(x, y, z):
    S.label("Sinking the freighter")
    zone(20, "Shipwreck", x, y, z, 18)
    # capsized hull, listing hard to starboard
    S.fill(x - 7, y - 8, z - 16, x + 7, y + 3, z + 16, P.LI_RUSTED)
    S.fill(x - 6, y - 7, z - 15, x + 6, y + 2, z + 15, P.AIR)
    # a dry air pocket inside
    S.fill(x - 5, y - 2, z - 6, x + 5, y + 1, z + 6, P.AIR)
    S.fill(x - 6, y - 3, z - 7, x + 6, y - 3, z + 7, P.LI_RUSTED)
    # torn opening in the side
    S.fill(x + 6, y - 2, z - 2, x + 7, y + 1, z + 2, P.AIR)
    for i in range(0, 12, 3):
        light(x - 4, y + 1, z - 6 + i)
    furnish(x - 5, y - 3, z - 6, 11, 13, "military")
    S.loot(x - 3, y - 2, z + 2, "part_nav")
    S.loot(x + 3, y - 2, z - 3, "harbour")
    S.loot(x, y - 2, z + 5, "empty")
    note(29, "shipwreck_log", x - 3, y - 2, z + 2, 4)


# ---------------------------------------------------------------------------
# military
# ---------------------------------------------------------------------------
def loc_checkpoint(x, y, z):
    site(x, y, z, 38, 24, P.GRAVEL, off=(0, 3))
    S.label("Manning the checkpoint")
    zone(21, "Military Checkpoint", x, y, z, 16)
    # concrete barrier wall across the road with a gated opening
    S.fill(x - 16, y + 1, z, x + 16, y + 4, z + 2, P.LI_CONCRETE)
    S.fill(x - 2, y + 1, z, x + 2, y + 4, z + 2, P.AIR)
    lock("checkpoint_gate", "li:crowbar",
         (x - 2, y + 1, z + 1, x + 2, y + 3, z + 1),
         "The gate is chained and welded. It could be forced open.")
    # sandbags
    for i in range(10):
        bx = x - 14 + i * 3
        S.fill(bx, y + 1, z - 2, bx + 1, y + 2, z - 1, P.SAND)
    # guard towers
    for tx in (x - 12, x + 12):
        S.fill(tx, y + 1, z + 4, tx + 3, y + 6, z + 7, P.LI_CONCRETE)
        S.fill(tx + 1, y + 1, z + 5, tx + 2, y + 5, z + 6, P.AIR)
        S.fill(tx, y + 6, z + 4, tx + 3, y + 6, z + 7, P.LI_RUSTED)
        window_row(tx + 1, y + 4, z + 4, 2, 1)
        for i in range(4):
            S.sb(tx + 1, y + 1 + i, z + 6, P.LADDER)
        S.sb(tx + 2, y + 5, z + 5, P.LI_LIGHT)
    S.sb(x - 4, y + 4, z, P.LI_SIGN_QUAR)
    S.sb(x + 4, y + 4, z, P.LI_SIGN_KEEP)
    S.loot(x - 11, y + 2, z + 5, "military")
    S.loot(x + 13, y + 2, z + 5, "empty")
    note(30, "checkpoint_order", x - 4, y + 3, z - 1, 4)


def loc_military_camp(x, y, z):
    site(x, y, z, 40, 32, P.GRAVEL)
    S.label("Pitching the military camp")
    zone(22, "Military Camp", x, y, z, 20)
    # perimeter
    for i in range(0, 36, 2):
        S.fill(x - 18 + i, y + 1, z - 14, x - 18 + i, y + 3, z - 14,
               P.IRON_BARS)
        S.fill(x - 18 + i, y + 1, z + 14, x - 18 + i, y + 3, z + 14,
               P.IRON_BARS)
    S.fill(x - 4, y + 1, z + 14, x + 4, y + 3, z + 14, P.AIR)
    # barracks
    for i in range(3):
        bx = x - 14 + i * 11
        shell(bx, y, z - 10, 9, 7, 5, P.GRAY_CONCRETE, P.LIGHT_GRAY_CONCRETE,
              P.LI_RUSTED)
        doorway(bx + 4, y, z - 4)
        window_row(bx + 1, y + 2, z - 10, 3, 2)
        for b in range(3):
            S.fill(bx + 1, y + 1, z - 9 + b * 2, bx + 2, y + 1, z - 9 + b * 2,
                   P.WHITE_WOOL)
        furnish(bx, y, z - 10, 9, 7, "military")
        if i == 1:
            S.loot(bx + 6, y + 1, z - 6, "military")
    # command tent + comms mast
    S.fill(x - 6, y + 1, z + 2, x + 6, y + 5, z + 10, P.GREEN_WOOL)
    S.fill(x - 5, y + 1, z + 3, x + 5, y + 4, z + 9, P.AIR)
    doorway(x, y + 1, z + 2, "z", 3)
    furnish(x - 6, y + 1, z + 2, 13, 9, "military")
    S.fill(x + 8, y + 1, z + 6, x + 8, y + 16, z + 6, P.LI_RUSTED)
    S.sb(x + 8, y + 17, z + 6, P.LI_LIGHT)
    S.loot(x - 3, y + 2, z + 7, "military")
    S.loot(x + 3, y + 2, z + 7, "key_keycard")
    # vehicles
    for i in range(2):
        vx = x - 12 + i * 20
        S.fill(vx, y + 1, z + 4, vx + 2, y + 3, z + 9, P.GREEN_WOOL)
        S.fill(vx, y + 1, z + 4, vx + 2, y + 1, z + 4, P.BLACK_CONCRETE)
    S.sb(x - 2, y + 3, z + 13, P.LI_SIGN_QUAR)
    note(31, "camp_order", x - 3, y + 2, z + 7, 4)
    note(32, "camp_last_transmission", x + 3, y + 2, z + 7, 4)


def loc_airstrip(x, y, z):
    site(x, y, z, 84, 24, P.GRAVEL)
    site(x, y, z, 52, 24, P.GRAVEL, off=(12, 18))
    S.label("Paving the airstrip")
    zone(23, "Airstrip", x, y, z, 24)
    # runway
    S.fill(x - 40, y, z - 5, x + 40, y, z + 5, P.GRAY_CONCRETE)
    for i in range(-38, 39, 8):
        S.fill(x + i, y, z - 1, x + i + 3, y, z + 1, P.WHITE_CONCRETE)
    # hangar
    S.fill(x + 10, y, z + 8, x + 34, y + 11, z + 28, P.LI_RUSTED)
    S.fill(x + 11, y + 1, z + 9, x + 33, y + 10, z + 27, P.AIR)
    S.fill(x + 16, y + 1, z + 8, x + 28, y + 7, z + 8, P.AIR)
    # wrecked aircraft
    S.fill(x + 18, y + 1, z + 14, x + 26, y + 3, z + 18, P.LIGHT_GRAY_CONCRETE)
    S.fill(x + 12, y + 2, z + 15, x + 32, y + 2, z + 16,
           P.LIGHT_GRAY_CONCRETE)
    S.fill(x + 26, y + 3, z + 15, x + 28, y + 6, z + 17,
           P.LIGHT_GRAY_CONCRETE)
    S.fill(x + 20, y + 3, z + 15, x + 24, y + 3, z + 17, P.GLASS)
    rubble(x + 12, y + 1, z + 12, 20, 10, 12,
           [P.LI_RUSTED, P.LIGHT_GRAY_CONCRETE, P.GRAVEL])
    furnish(x + 11, y, z + 20, 22, 8, "military")
    # control shack
    shell(x - 8, y, z + 10, 9, 8, 8, P.LI_CONCRETE, P.GRAY_CONCRETE,
          P.LI_RUSTED)
    doorway(x - 4, y, z + 10)
    window_row(x - 7, y + 5, z + 10, 3, 2)
    S.fill(x - 7, y + 6, z + 11, x - 1, y + 6, z + 16, P.LI_PANEL)
    for i in range(6):
        S.sb(x - 7, y + 1 + i, z + 16, P.LADDER)
    light(x - 4, y + 6, z + 14)
    S.loot(x - 6, y + 6, z + 13, "key_bunker")
    # fuel depot
    for i in range(3):
        S.fill(x - 26 + i * 6, y + 1, z + 12, x - 22 + i * 6, y + 4, z + 16,
               P.LI_RUSTED)
        S.sb(x - 24 + i * 6, y + 5, z + 14, P.LI_VENT)
    S.loot(x - 24, y + 1, z + 18, "part_fuel")
    S.loot(x + 20, y + 1, z + 22, "military")
    S.sb(x - 20, y + 1, z + 10, P.LI_SIGN_KEEP)
    note(33, "airstrip_manifest", x - 6, y + 6, z + 13, 4)
    note(34, "airstrip_grounded", x - 24, y + 1, z + 18, 4)


# ---------------------------------------------------------------------------
# the research complex: surface lab -> bunker -> deep complex
# ---------------------------------------------------------------------------
def loc_lab(x, y, z):
    site(x, y, z, 48, 36, P.COARSE_DIRT)
    S.label("Sealing the laboratory")
    zone(24, "Research Laboratory", x, y, z, 24)
    # perimeter fence with quarantine signage
    for i in range(0, 44, 2):
        S.fill(x - 22 + i, y + 1, z - 16, x - 22 + i, y + 3, z - 16,
               P.IRON_BARS)
        S.fill(x - 22 + i, y + 1, z + 16, x - 22 + i, y + 3, z + 16,
               P.IRON_BARS)
        if i % 12 == 0:
            S.sb(x - 22 + i, y + 2, z + 16, P.LI_SIGN_QUAR)
    S.fill(x - 2, y + 1, z + 16, x + 2, y + 3, z + 16, P.AIR)
    # main building
    w, d, h = 33, 25, 8
    shell(x - 16, y, z - 12, w, d, h, P.LI_PANEL, P.WHITE_CONCRETE,
          P.LI_CONCRETE)
    doorway(x - 1, y, z + 12, "z", 3)
    window_row(x - 14, y + 3, z + 12, 5, 2)
    window_row(x + 5, y + 3, z + 12, 4, 2)
    # entry hall / offices / labs split by panel walls
    S.fill(x - 16, y + 1, z + 4, x + 16, y + h - 2, z + 4, P.LI_PANEL)
    S.fill(x - 1, y + 1, z + 4, x + 1, y + 2, z + 4, P.AIR)
    S.fill(x - 4, y + 1, z - 12, x - 4, y + h - 2, z + 4, P.LI_PANEL)
    S.fill(x - 4, y + 1, z - 2, x - 4, y + 2, z - 2, P.AIR)
    furnish(x - 16, y, z + 5, w, 8, "office")
    furnish(x - 3, y, z - 12, 19, 16, "lab")
    # decontamination corridor
    S.fill(x + 6, y + 1, z - 12, x + 10, y + 4, z - 2, P.AIR)
    S.fill(x + 6, y + 1, z - 2, x + 10, y + 1, z - 2, P.LI_VENT)
    for i in range(0, 10, 3):
        light(x + 6, y + 4, z - 11 + i)
        S.sb(x + 10, y + 2, z - 11 + i, P.LI_VENT)
    # keycard-gated inner door to the lift shaft
    S.fill(x - 14, y + 1, z - 10, x - 6, y + 4, z - 4, P.AIR)
    S.fill(x - 6, y + 1, z - 10, x - 6, y + 4, z - 4, P.IRON_BLOCK)
    lock("lab_main_door", "li:keycard",
         (x - 6, y + 1, z - 8, x - 6, y + 2, z - 7),
         "A keycard reader blinks red beside the sealed door.")
    # lift shaft down to the bunker (anchor 25 is 36 blocks below)
    S.fill(x - 13, y - 34, z - 9, x - 9, y + 4, z - 5, P.AIR)
    S.fill(x - 14, y - 35, z - 10, x - 8, y - 35, z - 4, P.LI_PANEL)
    for i in range(38):
        S.sb(x - 13, y + 3 - i, z - 9, P.LADDER)
        if i % 6 == 0:
            light(x - 9, y + 3 - i, z - 5)
    S.loot(x + 8, y + 1, z + 8, "research")
    S.loot(x - 11, y + 1, z - 6, "research")
    S.loot(x + 12, y + 1, z - 8, "military")
    light(x, y + h - 2, z + 8)
    light(x + 8, y + h - 2, z - 6)
    light(x - 10, y + h - 2, z + 1)
    note(35, "lab_intake", x, y + 1, z + 8, 4)
    note(36, "lab_incident", x + 8, y + 1, z + 8, 4)
    note(37, "lab_quarantine_order", x - 11, y + 1, z - 6, 4)


def loc_bunker(x, y, z):
    S.label("Digging the bunker")
    zone(25, "Underground Bunker", x, y, z, 20)
    # main hall
    S.fill(x - 16, y, z - 12, x + 16, y + 6, z + 12, P.LI_CONCRETE)
    S.fill(x - 15, y + 1, z - 11, x + 15, y + 5, z + 11, P.AIR)
    S.fill(x - 15, y, z - 11, x + 15, y, z + 11, P.GRAY_CONCRETE)
    # blast door area (this is where the shaft from the lab lands)
    S.fill(x - 4, y + 1, z + 11, x + 4, y + 4, z + 14, P.AIR)
    S.fill(x - 1, y + 1, z + 12, x + 1, y + 3, z + 12, P.IRON_BLOCK)
    lock("bunker_blast_door", "li:bunker_key",
         (x - 1, y + 1, z + 12, x + 1, y + 3, z + 12),
         "A blast door. The manual release needs its key.",
         P.IRON_BLOCK)
    # rooms off a central corridor
    for i, (rx, rz, rw, rd, style) in enumerate([
            (-14, -10, 8, 7, "military"), (-14, 2, 8, 7, "medical"),
            (6, -10, 8, 7, "lab"), (6, 2, 8, 7, "office")]):
        S.fill(x + rx, y + 1, z + rz, x + rx + rw, y + 5, z + rz + rd,
               P.LI_PANEL)
        S.fill(x + rx + 1, y + 1, z + rz + 1, x + rx + rw - 1, y + 4,
               z + rz + rd - 1, P.AIR)
        doorway(x + rx + rw // 2, y + 1, z + rz + rd, "z", 2)
        furnish(x + rx, y + 1, z + rz, rw, rd, style)
        light(x + rx + rw // 2, y + 4, z + rz + rd // 2)
        if i in (0, 2):
            S.loot(x + rx + 2, y + 2, z + rz + 2, "research")
    # generator room
    S.fill(x - 6, y + 1, z - 11, x + 4, y + 5, z - 8, P.AIR)
    for g in range(3):
        S.fill(x - 5 + g * 4, y + 1, z - 10, x - 3 + g * 4, y + 3, z - 9,
               P.LI_RUSTED)
        S.sb(x - 4 + g * 4, y + 4, z - 9, P.LI_VENT)
    light(x, y + 5, z - 9)
    # hidden room behind a false wall
    S.fill(x + 14, y + 1, z - 3, x + 15, y + 4, z + 1, P.AIR)
    S.fill(x + 13, y + 1, z - 3, x + 13, y + 4, z + 1, P.LI_PANEL)
    S.fill(x + 13, y + 1, z - 1, x + 13, y + 2, z - 1, P.LI_VENT)
    S.loot(x + 15, y + 2, z - 1, "research")
    note(38, "bunker_log", x, y + 2, z + 2, 4)
    note(39, "bunker_hidden", x + 15, y + 2, z - 1, 3)
    # stair down to the deep complex
    S.fill(x - 3, y - 18, z - 14, x + 1, y + 4, z - 12, P.AIR)
    # stop at y+3-18 = the deep complex floor level; the complex itself carries
    # the ladder the rest of the way
    for i in range(19):
        S.sb(x - 2, y + 3 - i, z - 13, P.LADDER)
    # Re-open the laboratory lift shaft last of all: the room shells above are
    # poured after the hall, and they seal it otherwise.
    S.fill(x - 11, y + 5, z - 9, x - 7, y + 6, z - 5, P.AIR)
    S.fill(x - 11, y + 1, z - 9, x - 11, y + 6, z - 9, P.LADDER)


def loc_deep_complex(x, y, z):
    S.label("Unsealing the complex")
    zone(26, "Secret Research Complex", x, y, z, 22)
    # central chamber
    S.fill(x - 18, y, z - 14, x + 18, y + 10, z + 14, P.LI_CONCRETE)
    S.fill(x - 17, y + 1, z - 13, x + 17, y + 9, z + 13, P.AIR)
    S.fill(x - 17, y, z - 13, x + 17, y, z + 13, P.LI_PANEL)
    for i in range(-14, 15, 7):
        S.fill(x + i, y + 1, z - 13, x + i, y + 9, z - 13, P.LI_VENT)
        light(x + i, y + 8, z - 12)
        light(x + i, y + 8, z + 12)
    # containment cells along the west wall
    for c in range(4):
        cz = z - 12 + c * 7
        S.fill(x - 17, y + 1, cz, x - 11, y + 5, cz + 5, P.LI_PANEL)
        S.fill(x - 16, y + 1, cz + 1, x - 12, y + 4, cz + 4, P.AIR)
        S.fill(x - 11, y + 1, cz + 1, x - 11, y + 4, cz + 4, P.IRON_BARS)
        S.fill(x - 11, y + 1, cz + 2, x - 11, y + 2, cz + 3, P.AIR)
        S.sb(x - 14, y + 1, cz + 2, P.WHITE_WOOL)
        if c == 2:
            S.fill(x - 11, y + 1, cz + 1, x - 11, y + 4, cz + 4, P.AIR)
            rubble(x - 13, y + 1, cz + 1, 3, 4, 5,
                   [P.LI_PANEL, P.IRON_BARS])
    # records / server room
    S.fill(x + 8, y + 1, z - 12, x + 17, y + 5, z - 4, P.LI_PANEL)
    S.fill(x + 9, y + 1, z - 11, x + 16, y + 4, z - 5, P.AIR)
    doorway(x + 12, y + 1, z - 4, "z", 2)
    for r in range(4):
        S.fill(x + 10 + r * 2, y + 1, z - 10, x + 10 + r * 2, y + 3, z - 6,
               P.NOTEBLOCK)
    S.loot(x + 15, y + 2, z - 6, "research")
    light(x + 12, y + 4, z - 8)
    # specimen area
    S.fill(x + 6, y + 1, z + 2, x + 16, y + 6, z + 12, P.LI_PANEL)
    S.fill(x + 7, y + 1, z + 3, x + 15, y + 5, z + 11, P.AIR)
    doorway(x + 11, y + 1, z + 2, "z", 2)
    for i in range(3):
        S.fill(x + 8 + i * 3, y + 1, z + 5, x + 9 + i * 3, y + 4, z + 6,
               P.GLASS)
        S.fill(x + 8 + i * 3, y + 1, z + 5, x + 9 + i * 3, y + 3, z + 6,
               P.AIR)
        S.sb(x + 8 + i * 3, y + 1, z + 5, P.MOSS)
    light(x + 11, y + 5, z + 7)
    # the final revelation room, keycard-gated
    S.fill(x - 6, y + 1, z + 4, x + 2, y + 6, z + 13, P.LI_PANEL)
    S.fill(x - 5, y + 1, z + 5, x + 1, y + 5, z + 12, P.AIR)
    S.fill(x - 2, y + 1, z + 4, x, y + 3, z + 4, P.IRON_BLOCK)
    lock("complex_final_door", "li:keycard",
         (x - 2, y + 1, z + 4, x, y + 3, z + 4),
         "The last door. The reader wants a research keycard.",
         P.IRON_BLOCK)
    S.fill(x - 5, y + 1, z + 11, x + 1, y + 1, z + 12, P.LI_PANEL)
    S.sb(x - 2, y + 2, z + 12, P.NOTEBLOCK)
    S.sb(x - 4, y + 2, z + 12, P.LECTERN)
    S.sb(x, y + 2, z + 12, P.LECTERN)
    S.loot(x - 4, y + 2, z + 10, "research")
    S.loot(x, y + 2, z + 10, "research")
    light(x - 2, y + 5, z + 8)
    # The bunker's descent shaft lands here, but this chamber is built after
    # the bunker, so its roof and floor have to be re-opened for the ladder.
    S.fill(x - 1, y + 10, z - 6, x + 1, y + 10, z - 4, P.AIR)
    S.fill(x, y + 1, z - 5, x, y + 10, z - 5, P.LADDER)
    note(40, "complex_truth_1", x - 2, y + 2, z + 11, 4)
    note(41, "complex_truth_2", x - 4, y + 2, z + 10, 3)
    note(42, "complex_cells", x - 13, y + 2, z + 2, 4)


# ---------------------------------------------------------------------------
# secrets
# ---------------------------------------------------------------------------
def secrets():
    S.label("Hiding the secrets")
    spots = [
        # hidden caves with buried supplies
        (-134, 66, 74, "cave", "survivor_stash"),
        (118, 70, 96, "cave", "military"),
        (-96, 68, -60, "cave", "research"),
        # unexpected survivor camps
        (140, 68, 20, "camp", "survivor_stash"),
        (-150, 64, -30, "camp", "common_house"),
        # buried supplies
        (52, 66, 118, "buried", "military"),
        (-60, 68, -60, "buried", "supermarket"),
        (24, 68, -40, "buried", "mine"),
    ]
    for i, (x, y, z, kind, table) in enumerate(spots):
        if kind == "cave":
            S.fill(x - 3, y - 5, z - 3, x + 3, y - 1, z + 3, P.AIR)
            S.fill(x, y - 1, z, x, y + 1, z, P.AIR)
            S.sb(x, y + 1, z, P.MOSS_CARPET)
            S.loot(x + 1, y - 4, z, table)
            S.sb(x - 1, y - 4, z + 1, P.LI_SIGN_HAND)
            light(x - 2, y - 2, z - 2)
        elif kind == "camp":
            S.sb(x, y + 1, z, P.CAMPFIRE)
            for d in range(3):
                S.sb(x + 2, y + 1 + d, z, P.OAK_FENCE)
            S.fill(x - 2, y + 1, z - 2, x - 1, y + 2, z - 1, P.BROWN_WOOL)
            S.loot(x - 1, y + 1, z + 2, table)
        else:
            S.fill(x - 1, y - 3, z - 1, x + 1, y - 1, z + 1, P.AIR)
            S.loot(x, y - 2, z, table)
            S.sb(x, y, z, P.COARSE_DIRT)
        note(50 + i, "secret_%d" % (i + 1), x, y + 1, z, 4)
    # strange symbols carved into the ground
    for (sx, sz) in ((-40, -60), (70, -20), (-120, 90), (30, -140)):
        base = 64
        for (dx, dz) in ((0, 0), (1, 1), (-1, 1), (1, -1), (-1, -1), (0, 2),
                         (2, 0), (0, -2), (-2, 0)):
            S.sb(sx + dx, base, sz + dz, P.BLACKSTONE)
    # easter eggs
    S.sb(0, 64, 0, P.LI_NOTICE)
    note(59, "easter_centre", 0, 64, 0, 3)
    S.fill(-158, 63, 158, -156, 63, 160, P.LI_PANEL)
    S.loot(-157, 64, 159, "research")
    note(60, "easter_corner", -157, 64, 159, 3)


# ---------------------------------------------------------------------------
def main():
    os.makedirs(STEP_DIR, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(STEP_DIR):
        os.remove(os.path.join(STEP_DIR, f))

    loc_wreck_beach(6, 63, 138)
    loc_camp(-28, 64, 126, 2, "South Camp")
    loc_fishing_shacks(-86, 64, 118)
    loc_ranger_station(62, 66, 96)
    loc_village(-10, 66, 66)
    loc_supermarket(8, 66, 58)
    loc_gas_station(34, 66, 74)
    loc_motel(-40, 66, 46)
    loc_hospital(-18, 67, 26)
    loc_police(6, 67, 20)
    loc_fire_station(24, 67, 30)
    loc_radio_tower(78, 84, 40)
    loc_swamp_huts(-112, 63, 20)
    loc_camp(46, 68, 8, 14, "Forest Campsites", 4, "common_house")
    loc_lighthouse(132, 66, 112)
    loc_broken_bridge(-52, 64, -6)
    loc_dam(96, 78, -30)
    loc_mine(122, 92, -54)
    loc_harbour(108, 63, -124)
    loc_shipwreck(140, 62, -150)
    loc_checkpoint(52, 70, -92)
    loc_military_camp(84, 72, -108)
    loc_airstrip(-70, 70, -118)
    loc_lab(-20, 70, -132)
    loc_bunker(-22, 34, -132)
    loc_deep_complex(-24, 18, -140)
    secrets()

    groups = S.steps()
    step_of_cmd, n = {}, 0
    for si, g in enumerate(groups):
        for _ in g:
            step_of_cmd[n] = si
            n += 1
    labels = {}
    for ci, text in sorted(S.labels.items()):
        labels[str(step_of_cmd.get(ci, 0))] = text

    for si, g in enumerate(groups):
        with open(os.path.join(STEP_DIR, "s%03d.mcfunction" % si), "w") as f:
            f.write("\n".join(g) + "\n")

    with open(os.path.join(OUT, "loc_index.json"), "w") as f:
        json.dump({"count": len(groups), "prefix": "li_build/l/s",
                   "commands": len(S.cmds), "labels": labels}, f, indent=2)
    with open(os.path.join(OUT, "note_spots.json"), "w") as f:
        json.dump(NOTES, f, indent=2)
    with open(os.path.join(OUT, "locked_areas.json"), "w") as f:
        json.dump(LOCKED, f, indent=2)
    with open(os.path.join(OUT, "discover_zones.json"), "w") as f:
        json.dump(ZONES, f, indent=2)

    print("location steps : %d" % len(groups))
    print("location cmds  : %d" % len(S.cmds))
    print("note spots     : %d" % len(NOTES))
    print("locked areas   : %d" % len(LOCKED))
    print("discover zones : %d" % len(ZONES))
    print("max fill vol   : %d" % S.max_vol)


if __name__ == "__main__":
    main()

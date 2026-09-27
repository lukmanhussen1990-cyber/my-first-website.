"""Builds the three Ancient Ruins .mcstructure files.

Every palette entry uses block names/states that exist in Minecraft Bedrock
1.21.0 (checked by validate.py against the 1.21.0 block list). The palette
`version` is the 1.21.0 block data version, so newer game versions run their
own block upgraders on load.

Layout rules the scripts rely on (rotation independent):
  * Each ruin has a 3x3 "vault hatch" of ancient_ruins:vault_seal in the boss
    room floor. The hatch centre is an always-active command block that
    summons a ruin marker (the script registers the ruin and swaps it for a
    vault seal). The altar sits directly on top of the hatch centre.
  * Four glyph pillars surround the altar at distance 3. Levers (or pressure
    plates in the crypt) attached to them average out to the altar position.
  * Vault chests sit in a small room directly under the hatch.
"""
import os
import random

from nbt import Byte, Compound, Float, Int, List, Long, Short, String, TAG_COMPOUND, TAG_FLOAT, TAG_INT, TAG_STRING, dumps

BLOCK_VERSION = 18153475  # Bedrock 1.21.0 block data version (1.21.0.3)
NS = "ancient_ruins"

# Full default state sets for every vanilla block used (1.21.0 names).
DEFAULT_STATES = {
    "minecraft:air": {},
    "minecraft:stonebrick": {"stone_brick_type": "default"},
    "minecraft:mossy_cobblestone": {},
    "minecraft:cobblestone": {},
    "minecraft:sandstone": {"sand_stone_type": "default"},
    "minecraft:red_sandstone": {"sand_stone_type": "default"},
    "minecraft:sand": {"sand_type": "normal"},
    "minecraft:gravel": {},
    "minecraft:jungle_log": {"pillar_axis": "y"},
    "minecraft:dark_oak_log": {"pillar_axis": "y"},
    "minecraft:stripped_dark_oak_log": {"pillar_axis": "y"},
    "minecraft:jungle_leaves": {"persistent_bit": True, "update_bit": False},
    "minecraft:chest": {"minecraft:cardinal_direction": "south"},
    "minecraft:dispenser": {"facing_direction": 3, "triggered_bit": False},
    "minecraft:lever": {"lever_direction": "north", "open_bit": False},
    "minecraft:stone_pressure_plate": {"redstone_signal": 0},
    "minecraft:wooden_pressure_plate": {"redstone_signal": 0},
    "minecraft:vine": {"vine_direction_bits": 1},
    "minecraft:water": {"liquid_depth": 0},
    "minecraft:gold_block": {},
    "minecraft:prismarine": {"prismarine_block_type": "default"},
    "minecraft:sea_lantern": {},
    "minecraft:web": {},
    "minecraft:glowstone": {},
    "minecraft:lantern": {"hanging": False},
    "minecraft:soul_lantern": {"hanging": False},
    "minecraft:stone_brick_stairs": {"upside_down_bit": False, "weirdo_direction": 0},
    "minecraft:mossy_stone_brick_stairs": {"upside_down_bit": False, "weirdo_direction": 0},
    "minecraft:sandstone_stairs": {"upside_down_bit": False, "weirdo_direction": 0},
    "minecraft:dark_oak_stairs": {"upside_down_bit": False, "weirdo_direction": 0},
    "minecraft:bone_block": {"deprecated": 0, "pillar_axis": "y"},
    "minecraft:chain": {"pillar_axis": "y"},
    "minecraft:hardened_clay": {},
    "minecraft:orange_terracotta": {},
    "minecraft:blue_terracotta": {},
    "minecraft:ladder": {"facing_direction": 2},
    "minecraft:command_block": {"conditional_bit": False, "facing_direction": 1},
    "minecraft:dark_oak_planks": {},
    "minecraft:spruce_planks": {},
    "minecraft:dark_oak_fence": {},
    "minecraft:sea_pickle": {"cluster_count": 2, "dead_bit": False},
    "minecraft:moss_block": {},
    "minecraft:moss_carpet": {},
    "minecraft:emerald_block": {},
    "minecraft:tube_coral_block": {},
    "minecraft:brain_coral_block": {},
    "minecraft:dead_brain_coral_block": {},
    "minecraft:smooth_stone": {},
    "minecraft:hay_block": {"deprecated": 0, "pillar_axis": "y"},
}

# Blocks that may hold a second (water) layer when built inside flooded rooms.
WATERLOGGABLE = {
    "minecraft:chest", "minecraft:lever", "minecraft:wooden_pressure_plate",
    "minecraft:stone_pressure_plate", "minecraft:dark_oak_fence", "minecraft:dark_oak_stairs",
    "minecraft:lantern", "minecraft:soul_lantern", "minecraft:chain", "minecraft:sea_pickle",
    "minecraft:ladder", "minecraft:web",
}


class Blk:
    __slots__ = ("name", "states")

    def __init__(self, name, **states):
        if ":" not in name:
            name = "minecraft:" + name
        base = dict(DEFAULT_STATES.get(name, {})) if name.startswith("minecraft:") else {}
        if name.startswith("minecraft:") and name not in DEFAULT_STATES:
            raise KeyError(f"No default state set for {name}")
        for k, v in states.items():
            key = "minecraft:cardinal_direction" if k == "cardinal" else k
            if key not in base:
                raise KeyError(f"{name} has no state {key}")
            base[key] = v
        self.name = name
        self.states = tuple(sorted(base.items()))

    def key(self):
        return (self.name, self.states)


def C(name):
    """Custom block of this add-on (no states)."""
    return Blk(f"{NS}:{name}")


AIR = Blk("air")
WATER = Blk("water")


class Structure:
    def __init__(self, name, sx, sy, sz, seed):
        self.name = name
        self.size = (sx, sy, sz)
        self.blocks = {}
        self.water_layer = set()
        self.block_entities = {}
        self.entities = []
        self.rng = random.Random(seed)

    # --- primitive editing -------------------------------------------------
    def inside(self, x, y, z):
        sx, sy, sz = self.size
        return 0 <= x < sx and 0 <= y < sy and 0 <= z < sz

    def set(self, x, y, z, blk, waterlog=False):
        if not self.inside(x, y, z):
            raise IndexError(f"{self.name}: ({x},{y},{z}) outside {self.size}")
        self.blocks[(x, y, z)] = blk
        self.block_entities.pop((x, y, z), None)
        if waterlog:
            if blk.name not in WATERLOGGABLE:
                raise ValueError(f"{blk.name} cannot be waterlogged here")
            self.water_layer.add((x, y, z))
        else:
            self.water_layer.discard((x, y, z))

    def get(self, x, y, z):
        return self.blocks.get((x, y, z))

    def clear(self, x, y, z):
        """Back to structure void (keep whatever the world had)."""
        self.blocks.pop((x, y, z), None)
        self.water_layer.discard((x, y, z))
        self.block_entities.pop((x, y, z), None)

    def fill(self, x0, y0, z0, x1, y1, z1, blk):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.set(x, y, z, blk() if callable(blk) else blk)

    def walls(self, x0, y0, z0, x1, y1, z1, blk):
        """Hollow box: all six faces."""
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    if x in (x0, x1) or y in (y0, y1) or z in (z0, z1):
                        self.set(x, y, z, blk() if callable(blk) else blk)

    # --- special blocks -------------------------------------------------------
    def chest(self, x, y, z, facing, loot, waterlog=False):
        self.set(x, y, z, Blk("chest", cardinal=facing), waterlog=waterlog)
        self.block_entities[(x, y, z)] = Compound({
            "Findable": Byte(0),
            "Items": List(TAG_COMPOUND, []),
            "LootTable": String(f"loot_tables/chests/{NS}/{loot}.json"),
            "LootTableSeed": Int(0),
            "id": String("Chest"),
            "isMovable": Byte(1),
            "x": Int(x), "y": Int(y), "z": Int(z),
        })

    def dispenser(self, x, y, z, facing, arrows=24):
        self.set(x, y, z, Blk("dispenser", facing_direction=facing))
        items = []
        slot = 0
        while arrows > 0:
            n = min(arrows, 16)
            items.append(Compound({
                "Count": Byte(n),
                "Damage": Short(0),
                "Name": String("minecraft:arrow"),
                "Slot": Byte(slot),
                "WasPickedUp": Byte(0),
            }))
            arrows -= n
            slot += 1
        self.block_entities[(x, y, z)] = Compound({
            "Items": List(TAG_COMPOUND, items),
            "id": String("Dispenser"),
            "isMovable": Byte(1),
            "x": Int(x), "y": Int(y), "z": Int(z),
        })

    def ruin_core(self, x, y, z):
        """Always-active impulse command block that summons the ruin marker once."""
        self.set(x, y, z, Blk("command_block", facing_direction=1))
        self.block_entities[(x, y, z)] = Compound({
            "Command": String(f"summon {NS}:ruin_marker ~ ~1 ~"),
            "CustomName": String("Ancient Ruin Core"),
            "ExecuteOnFirstTick": Byte(0),
            "LPCommandMode": Int(0),
            "LPCondionalMode": Byte(0),
            "LPRedstoneMode": Byte(1),
            "LastExecution": Long(0),
            "LastOutput": String(""),
            "LastOutputParams": List(TAG_STRING, []),
            "SuccessCount": Int(0),
            "TickDelay": Int(20),
            "TrackOutput": Byte(0),
            "Version": Int(10),
            "auto": Byte(1),
            "conditionMet": Byte(0),
            "conditionalMode": Byte(0),
            "id": String("CommandBlock"),
            "isMovable": Byte(0),
            "powered": Byte(0),
            "x": Int(x), "y": Int(y), "z": Int(z),
        })

    def marker(self, x, y, z):
        """Invisible marker entity standing on the altar (backup registration)."""
        uid = -self.rng.randrange(1 << 40, 1 << 52)
        self.entities.append(Compound({
            "identifier": String(f"{NS}:ruin_marker"),
            "definitions": List(TAG_STRING, [String(f"+{NS}:ruin_marker")]),
            "Pos": List(TAG_FLOAT, [Float(x + 0.5), Float(y + 0.05), Float(z + 0.5)]),
            "Rotation": List(TAG_FLOAT, [Float(0.0), Float(0.0)]),
            "Motion": List(TAG_FLOAT, [Float(0.0), Float(0.0), Float(0.0)]),
            "UniqueID": Long(uid),
            "Persistent": Byte(1),
            "OnGround": Byte(1),
            "Invulnerable": Byte(1),
            "Tags": List(TAG_STRING, []),
        }))

    # --- serialisation --------------------------------------------------------
    def to_nbt(self):
        sx, sy, sz = self.size
        palette = []
        index_of = {}
        primary = []
        secondary = []
        water_idx = None
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    blk = self.blocks.get((x, y, z))
                    if blk is None:
                        primary.append(Int(-1))
                    else:
                        k = blk.key()
                        if k not in index_of:
                            index_of[k] = len(palette)
                            palette.append(blk)
                        primary.append(Int(index_of[k]))
                    if (x, y, z) in self.water_layer:
                        if water_idx is None:
                            k = WATER.key()
                            if k not in index_of:
                                index_of[k] = len(palette)
                                palette.append(WATER)
                            water_idx = index_of[k]
                        secondary.append(Int(water_idx))
                    else:
                        secondary.append(Int(-1))

        def state_tag(v):
            if isinstance(v, bool):
                return Byte(1 if v else 0)
            if isinstance(v, int):
                return Int(v)
            return String(v)

        block_palette = List(TAG_COMPOUND, [
            Compound({
                "name": String(b.name),
                "states": Compound({k: state_tag(v) for k, v in b.states}),
                "version": Int(BLOCK_VERSION),
            }) for b in palette
        ])
        position_data = Compound()
        for (x, y, z), data in sorted(self.block_entities.items()):
            idx = (x * sy + y) * sz + z
            position_data[str(idx)] = Compound({"block_entity_data": data})

        return Compound({
            "format_version": Int(1),
            "size": List(TAG_INT, [Int(sx), Int(sy), Int(sz)]),
            "structure": Compound({
                "block_indices": List(9, [List(TAG_INT, primary), List(TAG_INT, secondary)]),
                "entities": List(TAG_COMPOUND, list(self.entities)),
                "palette": Compound({
                    "default": Compound({
                        "block_palette": block_palette,
                        "block_position_data": position_data,
                    })
                }),
            }),
            "structure_world_origin": List(TAG_INT, [Int(0), Int(0), Int(0)]),
        })

    def save(self, path):
        with open(path, "wb") as f:
            f.write(dumps(self.to_nbt()))


# ---------------------------------------------------------------------------
# Jungle Temple  (21 x 16 x 23)
# ---------------------------------------------------------------------------
def build_jungle_temple():
    s = Structure("jungle_temple", 21, 16, 23, seed=1001)
    r = s.rng
    F = 5  # main floor level

    def masonry():
        roll = r.random()
        if roll < 0.40:
            return Blk("stonebrick", stone_brick_type="mossy")
        if roll < 0.55:
            return Blk("stonebrick", stone_brick_type="cracked")
        if roll < 0.75:
            return Blk("mossy_cobblestone")
        return Blk("stonebrick")

    def rubble():
        return Blk("mossy_cobblestone") if r.random() < 0.6 else Blk("cobblestone")

    floor = C("temple_floor")

    # Foundation and stepped platform tiers.
    s.fill(0, 0, 0, 20, 2, 22, rubble)
    s.fill(0, 3, 0, 20, 3, 22, masonry)
    s.fill(1, 4, 1, 19, 4, 21, masonry)
    s.fill(2, 5, 2, 18, 5, 20, masonry)

    # Lower wings (side rooms + corridor block) and the tall central hall.
    s.fill(2, 6, 2, 18, 9, 20, masonry)
    s.fill(5, 10, 3, 15, 13, 13, masonry)
    s.fill(6, 14, 4, 14, 14, 12, masonry)
    s.fill(8, 15, 6, 12, 15, 10, lambda: Blk("stonebrick", stone_brick_type="chiseled"))
    s.set(10, 15, 8, Blk("emerald_block"))

    # Floors of the walkable areas.
    s.fill(6, F, 4, 14, F, 12, floor)          # hall
    s.fill(9, F, 13, 11, F, 20, floor)         # corridor + doorway
    s.fill(3, F, 4, 4, F, 12, C("miasma_vent"))  # spore (gas) tunnel
    s.fill(16, F, 5, 17, F, 11, floor)         # shrine

    # Carve rooms.
    s.fill(6, F + 1, 4, 14, 12, 12, AIR)       # Hall of the Jade Idol (9x9x7)
    s.fill(9, F + 1, 13, 11, 8, 20, AIR)       # entrance corridor + south opening
    s.fill(3, F + 1, 4, 4, 8, 12, AIR)         # spore tunnel
    s.fill(5, F + 1, 8, 5, F + 2, 8, AIR)      # door hall -> spore tunnel
    s.fill(16, F + 1, 5, 17, 8, 11, AIR)       # shrine of offerings
    s.fill(15, F + 1, 8, 15, F + 2, 8, AIR)    # door hall -> shrine

    # Glyph pillars around the altar (altar at 10, F+1, 8).
    ax, az = 10, 8
    chiseled = Blk("stonebrick", stone_brick_type="chiseled")
    pillars = {  # position: (glyph number, lever position, lever facing)
        (7, 8): (3, (8, 8), "east"),
        (13, 8): (1, (12, 8), "west"),
        (10, 5): (4, (10, 6), "south"),
        (10, 11): (2, (10, 10), "north"),
    }
    for (px, pz), (num, (lx, lz), facing) in pillars.items():
        s.set(px, F + 1, pz, chiseled)
        s.set(px, F + 2, pz, C(f"temple_glyph_{num}"))
        s.set(px, F + 3, pz, chiseled)
        s.set(lx, F + 2, lz, Blk("lever", lever_direction=facing))

    # Vault under the altar: 5x5x2 room, 3x3 hatch in the hall floor.
    s.walls(7, 2, 5, 13, F - 1, 11, masonry)
    s.fill(8, 3, 6, 12, 4, 10, AIR)
    s.fill(8, 2, 6, 12, 2, 10, Blk("smooth_stone"))
    s.fill(9, F, 7, 11, F, 9, C("vault_seal"))
    s.ruin_core(ax, F, az)
    s.set(ax, F + 1, az, C("temple_altar"))
    s.marker(ax, F + 2, az)
    s.chest(8, 3, 6, "south", "temple_vault")
    s.chest(12, 3, 10, "north", "temple_vault")
    s.set(12, 3, 6, Blk("gold_block"))
    s.set(8, 3, 10, Blk("gold_block"))
    s.set(10, 4, 10, Blk("lantern", hanging=True))

    # Hint mural on the north wall: glyphs 1-4 left to right (seen from inside).
    s.fill(6, 9, 3, 14, 11, 3, chiseled)
    for i, x in enumerate((7, 9, 11, 13)):
        s.set(x, 10, 3, C(f"temple_glyph_{i + 1}"))
    s.set(10, 12, 3, Blk("emerald_block"))

    # Hall lighting and decoration.
    for (x, z) in ((6, 4), (14, 4), (6, 12), (14, 12)):
        s.set(x, 12, z, Blk("lantern", hanging=True))
        s.set(x, F + 1, z, Blk("mossy_cobblestone"))
        s.set(x, F + 2, z, Blk("moss_block"))
    for (x, z) in ((7, 5), (13, 11), (6, 9), (14, 7)):
        s.set(x, F + 1, z, Blk("moss_carpet"))

    # Entrance corridor traps -----------------------------------------------
    # Arrow trap: plate at z=15, dispensers in both walls.
    s.set(10, F, 15, C("trap_mechanism"))
    s.set(10, F + 1, 15, Blk("stone_pressure_plate"))
    s.dispenser(8, F + 2, 14, 5)
    s.dispenser(12, F + 2, 15, 4)
    s.dispenser(8, F + 2, 16, 5)
    for (x, z) in ((7, 14), (13, 15), (7, 16)):
        s.set(x, F + 2, z, Blk("stonebrick"))  # solid block behind each dispenser
    # Collapsing floor over a 2-deep pit (z 17-18).
    s.fill(9, F, 17, 11, F, 18, C("crumbling_temple_floor"))
    s.fill(9, 3, 17, 11, 4, 18, AIR)
    s.fill(9, 2, 17, 11, 2, 18, Blk("mossy_cobblestone"))
    s.set(9, 3, 17, Blk("ladder", facing_direction=5))
    s.set(9, 4, 17, Blk("ladder", facing_direction=5))
    s.set(11, 3, 18, Blk("ladder", facing_direction=4))
    s.set(11, 4, 18, Blk("ladder", facing_direction=4))
    s.set(10, 8, 19, Blk("lantern", hanging=True))

    # Spore tunnel (poison gas) with two chests at the ends.
    s.chest(3, F + 1, 4, "south", "temple_chest")
    s.chest(3, F + 1, 12, "north", "temple_chest")
    s.set(4, F + 1, 4, Blk("bone_block"))
    s.set(4, F + 1, 12, Blk("bone_block", pillar_axis="x"))
    s.set(4, 8, 8, Blk("soul_lantern", hanging=True))
    for z in (5, 7, 10):
        s.set(3, 8, z, Blk("web"))

    # Shrine of offerings: arrow trap inside the door, chest at the back.
    s.set(16, F, 8, C("trap_mechanism"))
    s.set(16, F + 1, 8, Blk("stone_pressure_plate"))
    s.dispenser(16, F + 2, 4, 3)
    s.dispenser(17, F + 2, 12, 2)
    s.set(16, F + 2, 3, Blk("stonebrick"))
    s.set(17, F + 2, 13, Blk("stonebrick"))
    s.chest(17, F + 1, 6, "west", "temple_chest")
    s.set(17, F + 1, 10, Blk("gold_block"))
    s.set(16, 8, 10, Blk("lantern", hanging=True))

    # South entrance: open doorway with lanterns on the platform steps.
    s.set(8, F + 1, 21, Blk("mossy_cobblestone"))
    s.set(12, F + 1, 21, Blk("mossy_cobblestone"))
    s.set(8, F + 2, 21, Blk("lantern"))
    s.set(12, F + 2, 21, Blk("lantern"))
    s.fill(9, F + 1, 21, 11, F + 3, 22, AIR)
    s.fill(9, F, 21, 11, F, 21, Blk("mossy_stone_brick_stairs", weirdo_direction=3))
    s.fill(9, 4, 22, 11, 4, 22, Blk("mossy_stone_brick_stairs", weirdo_direction=3))

    # Overgrowth: leaves on roof tiers and vines down the outer walls.
    for x in range(0, 21):
        for z in range(0, 23):
            top = max((y for (xx, y, zz) in s.blocks if xx == x and zz == z and s.blocks[(xx, y, zz)].name != "minecraft:air"), default=None)
            if top is not None and top >= 9 and top + 1 < 16 and r.random() < 0.35:
                if s.get(x, top + 1, z) is None:
                    s.set(x, top + 1, z, Blk("jungle_leaves"))
    vine_dirs = {(-1, 0): 8, (1, 0): 2, (0, -1): 1, (0, 1): 4}  # bit = side the vine clings to
    for (dx, dz), bit in vine_dirs.items():
        for _ in range(26):
            x, z = r.randrange(0, 21), r.randrange(0, 23)
            y = r.randrange(6, 13)
            if s.get(x, y, z) is not None:
                continue
            wall = s.get(x - dx, y, z - dz)
            if wall is not None and wall.name.startswith("minecraft:") and wall.name not in ("minecraft:air", "minecraft:lantern", "minecraft:jungle_leaves", "minecraft:vine"):
                for yy in range(y, max(y - r.randrange(2, 5), 5), -1):
                    if s.get(x, yy, z) is None and s.get(x - dx, yy, z - dz) is not None:
                        s.set(x, yy, z, Blk("vine", vine_direction_bits=bit))
    return s, {"altar": (ax, F + 1, az), "core": (ax, F, az)}


# ---------------------------------------------------------------------------
# Desert Crypt  (23 x 14 x 23) - mostly underground
# ---------------------------------------------------------------------------
def build_desert_crypt():
    s = Structure("desert_crypt", 23, 14, 23, seed=2002)
    r = s.rng
    F = 3  # hall floor level; ground level is structure y=10

    def sandstone():
        roll = r.random()
        if roll < 0.55:
            return Blk("sandstone")
        if roll < 0.80:
            return Blk("sandstone", sand_stone_type="smooth")
        return Blk("sandstone", sand_stone_type="cut")

    carved = Blk("sandstone", sand_stone_type="heiroglyphs")
    cut = Blk("sandstone", sand_stone_type="cut")
    floor = C("crypt_floor")

    # Hall of the Pharaoh: 11x11 interior, 5 high.
    s.walls(5, F, 0, 17, 9, 12, sandstone)
    s.fill(6, F, 1, 16, F, 11, floor)
    s.fill(6, F + 1, 1, 16, 8, 11, AIR)
    # Vault under the hall.
    s.walls(8, 0, 3, 14, F - 1, 9, sandstone)
    s.fill(9, 1, 4, 13, 2, 8, AIR)
    s.fill(10, F, 5, 12, F, 7, C("vault_seal"))
    ax, az = 11, 6
    s.ruin_core(ax, F, az)
    s.set(ax, F + 1, az, C("crypt_altar"))
    s.marker(ax, F + 2, az)
    s.chest(9, 1, 4, "south", "crypt_vault")
    s.chest(13, 1, 8, "north", "crypt_vault")
    s.set(13, 1, 4, Blk("gold_block"))
    s.set(9, 1, 8, Blk("gold_block"))
    s.set(11, 2, 8, Blk("lantern", hanging=True))

    # Glyph pedestals with pressure plates (step on them in mural order).
    plates = {(8, 6): 2, (14, 6): 4, (11, 3): 1, (11, 9): 3}
    for (px, pz), num in plates.items():
        s.set(px, F + 1, pz, C(f"crypt_glyph_{num}"))
        s.set(px, F + 2, pz, Blk("stone_pressure_plate"))

    # Mural (hint) on the north wall.
    s.fill(7, 5, 0, 15, 7, 0, carved)
    for i, x in enumerate((8, 10, 12, 14)):
        s.set(x, 6, 0, C(f"crypt_glyph_{i + 1}"))
    # Corner columns, gold trim and lanterns.
    for (x, z) in ((6, 1), (16, 1), (6, 11), (16, 11)):
        s.fill(x, F + 1, z, x, 8, z, cut)
        s.set(x, F + 1, z, carved)
    for (x, z) in ((7, 2), (15, 2), (7, 10), (15, 10)):
        s.set(x, 8, z, Blk("lantern", hanging=True))
    s.set(10, F + 1, 6, Blk("orange_terracotta"))
    s.set(12, F + 1, 6, Blk("orange_terracotta"))

    # Doors from the hall.
    s.fill(10, F + 1, 12, 12, F + 3, 12, AIR)  # south -> antechamber
    s.fill(5, F + 1, 6, 5, F + 2, 6, AIR)      # west -> gas tomb
    s.fill(17, F + 1, 6, 17, F + 2, 6, AIR)    # east -> canopic chamber

    # Antechamber with arrow trap and collapsing sand floor.
    s.walls(7, F, 12, 15, 8, 17, sandstone)
    s.fill(8, F, 13, 14, F, 16, floor)
    s.fill(8, F + 1, 13, 14, 7, 16, AIR)
    s.fill(10, F + 1, 12, 12, F + 3, 12, AIR)
    s.set(11, F, 16, C("trap_mechanism"))
    s.set(11, F + 1, 16, Blk("stone_pressure_plate"))
    s.dispenser(7, F + 2, 15, 5)
    s.dispenser(15, F + 2, 15, 4)
    s.dispenser(7, F + 2, 13, 5)
    s.dispenser(15, F + 2, 13, 4)
    for (x, z) in ((6, 15), (16, 15), (6, 13), (16, 13)):
        s.set(x, F + 2, z, Blk("sandstone"))
    s.fill(9, F, 14, 13, F, 15, C("crumbling_sandstone"))
    s.fill(9, 1, 14, 13, 2, 15, AIR)
    s.fill(9, 0, 14, 13, 0, 15, Blk("sandstone"))
    s.fill(8, 0, 13, 14, 2, 13, Blk("sandstone"))
    s.fill(8, 0, 16, 14, 2, 16, Blk("sandstone"))
    s.fill(8, 0, 14, 8, 2, 15, Blk("sandstone"))
    s.fill(14, 0, 14, 14, 2, 15, Blk("sandstone"))
    s.set(13, 1, 14, Blk("ladder", facing_direction=4))
    s.set(13, 2, 14, Blk("ladder", facing_direction=4))
    s.set(9, 1, 15, Blk("ladder", facing_direction=5))
    s.set(9, 2, 15, Blk("ladder", facing_direction=5))
    s.set(11, 7, 14, Blk("lantern", hanging=True))

    # Stairway up to the desert surface (ground at y=10).
    s.fill(10, F + 1, 17, 12, F + 3, 17, AIR)
    for step, z in enumerate(range(18, 23)):
        fy = F + 1 + step
        s.fill(9, F, z, 13, fy + 4, z, sandstone)
        s.fill(10, fy, z, 12, fy, z, Blk("sandstone_stairs", weirdo_direction=2))
        s.fill(10, fy + 1, z, 12, fy + 3, z, AIR)
        s.fill(10, F, z, 12, fy - 1, z, Blk("sandstone"))
    # Entrance gate at the surface.
    for x in (8, 14):
        s.fill(x, 9, 20, x, 12, 22, cut)
        s.set(x, 13, 22, Blk("gold_block"))
    s.fill(8, 12, 20, 14, 12, 22, carved)
    s.fill(9, 13, 21, 13, 13, 22, Blk("sandstone", sand_stone_type="smooth"))
    s.fill(10, 9, 20, 12, 11, 22, AIR)
    s.set(9, 11, 22, Blk("lantern", hanging=True))
    s.set(13, 11, 22, Blk("lantern", hanging=True))

    # Poison gas tomb (west) with sarcophagus chests.
    s.walls(0, F, 2, 5, 7, 10, sandstone)
    s.fill(1, F, 3, 4, F, 9, C("miasma_vent"))
    s.fill(1, F + 1, 3, 4, 6, 9, AIR)
    s.fill(5, F + 1, 6, 5, F + 2, 6, AIR)
    s.chest(1, F + 1, 3, "east", "crypt_chest")
    s.chest(1, F + 1, 9, "east", "crypt_chest")
    s.set(2, F + 1, 3, Blk("bone_block"))
    s.set(2, F + 1, 9, Blk("bone_block"))
    s.set(3, 6, 6, Blk("soul_lantern", hanging=True))
    s.set(1, 6, 5, Blk("web"))
    s.set(4, 6, 8, Blk("web"))

    # Canopic chamber (east) with arrow trap and treasure chest.
    s.walls(17, F, 2, 22, 7, 10, sandstone)
    s.fill(18, F, 3, 21, F, 9, floor)
    s.fill(18, F + 1, 3, 21, 6, 9, AIR)
    s.fill(17, F + 1, 6, 17, F + 2, 6, AIR)
    s.set(18, F, 6, C("trap_mechanism"))
    s.set(18, F + 1, 6, Blk("stone_pressure_plate"))
    s.dispenser(19, F + 2, 2, 3)
    s.dispenser(20, F + 2, 10, 2)
    s.set(19, F + 2, 1, Blk("sandstone"))
    s.set(20, F + 2, 11, Blk("sandstone"))
    s.chest(21, F + 1, 6, "west", "crypt_chest")
    s.set(21, F + 1, 4, Blk("gold_block"))
    s.set(21, F + 1, 8, Blk("orange_terracotta"))
    s.set(20, 6, 6, Blk("lantern", hanging=True))
    return s, {"altar": (ax, F + 1, az), "core": (ax, F, az)}


# ---------------------------------------------------------------------------
# Sunken Ship  (11 x 12 x 27) - rests on the sea floor
# ---------------------------------------------------------------------------
def build_sunken_ship():
    s = Structure("sunken_ship", 11, 12, 27, seed=3003)
    r = s.rng
    F = 6  # main deck level

    def plank():
        return Blk("dark_oak_planks") if r.random() < 0.7 else Blk("spruce_planks")

    def hull_width(z, y):
        """Half-open x range of the hull at (z, y) or None."""
        if z < 0 or z > 26:
            return None
        taper = 0
        if z <= 1:
            taper = 3
        elif z <= 3:
            taper = 2
        elif z <= 5:
            taper = 1
        if y == 0:
            lo, hi = 4, 6
        elif y == 1:
            lo, hi = 3, 7
        elif y == 2:
            lo, hi = 2, 8
        else:
            lo, hi = 1, 9
        lo, hi = max(lo, 1 + taper), min(hi, 9 - taper)
        if lo > hi:
            return None
        return lo, hi

    floor = C("ship_floor")
    # Hull shell: every hull cell is planks, interior of hold is water.
    for z in range(0, 27):
        for y in range(0, F + 1):
            w = hull_width(z, y)
            if not w:
                continue
            lo, hi = w
            for x in range(lo, hi + 1):
                edge = x in (lo, hi) or y <= 1 or z in (0, 26) or y == F
                if y == 2 and not edge:
                    s.set(x, y, z, floor)
                elif edge:
                    s.set(x, y, z, plank())
                else:
                    s.set(x, y, z, WATER)
        # keel
        s.set(5, 0, z, Blk("dark_oak_log", pillar_axis="z"))

    # Bulwark railings along the deck.
    for z in range(4, 18):
        for x in (1, 9):
            if r.random() < 0.8:
                s.set(x, F + 1, z, Blk("dark_oak_fence"), waterlog=True)
    for x in range(3, 8):
        s.set(x, F + 1, 2, Blk("dark_oak_fence"), waterlog=True)

    # Main hatch into the hold and a rotten (collapsing) deck patch.
    s.fill(4, F, 6, 6, F, 8, WATER)
    s.fill(3, F, 12, 7, F, 14, C("rotten_planks"))

    # Vault in the hold, directly below the cabin hatch (built first so the
    # cabin floor ends up on top of it).
    ax, az = 5, 22
    s.walls(3, 3, 20, 7, F, 24, plank)
    s.fill(4, 4, 21, 6, 5, 23, WATER)
    s.fill(4, 3, 21, 6, 3, 23, Blk("prismarine", prismarine_block_type="bricks"))
    s.chest(4, 4, 21, "south", "ship_vault", waterlog=True)
    s.chest(6, 4, 23, "north", "ship_vault", waterlog=True)
    s.set(6, 4, 21, Blk("gold_block"))
    s.set(4, 4, 23, Blk("sea_lantern"))

    # Captain's cabin at the stern (boss arena, 7x7x4, flooded).
    s.walls(1, F, 18, 9, 11, 26, plank)
    s.fill(2, F + 1, 19, 8, 10, 25, WATER)
    s.fill(2, F, 19, 8, F, 25, floor)
    s.fill(4, F, 21, 6, F, 23, C("vault_seal"))
    s.ruin_core(ax, F, az)
    s.set(ax, F + 1, az, C("ship_altar"))
    s.marker(ax, F + 2, az)
    s.set(5, F + 1, 18, WATER)   # cabin door
    s.set(5, F + 2, 18, WATER)
    for (x, z) in ((3, 18), (7, 18)):
        s.set(x, F + 2, z, Blk("prismarine", prismarine_block_type="dark"))
    # Glyph pillars and levers.
    pillars = {
        (2, 22): (2, (3, 22), "east"),
        (8, 22): (4, (7, 22), "west"),
        (5, 19): (3, (5, 20), "south"),
        (5, 25): (1, (5, 24), "north"),
    }
    for (px, pz), (num, (lx, lz), facing) in pillars.items():
        s.set(px, F + 1, pz, Blk("stripped_dark_oak_log"))
        s.set(px, F + 2, pz, C(f"ship_glyph_{num}"))
        s.set(px, F + 3, pz, Blk("stripped_dark_oak_log"))
        s.set(lx, F + 2, lz, Blk("lever", lever_direction=facing), waterlog=True)
    # Mural on the stern wall (glyphs 1-4 left to right when facing it).
    for i, x in enumerate((8, 6, 4, 2)):
        s.set(x, 10, 26, C(f"ship_glyph_{i + 1}"))
    for (x, z) in ((2, 19), (8, 19), (2, 25), (8, 25)):
        s.set(x, 10, z, Blk("sea_lantern"))

    # Arrow trap in front of the cabin door.
    s.set(5, F, 16, C("trap_mechanism"))
    s.set(5, F + 1, 16, Blk("wooden_pressure_plate"), waterlog=True)
    s.dispenser(1, F + 1, 16, 5)
    s.dispenser(9, F + 1, 16, 4)
    s.set(0, F + 1, 16, Blk("dark_oak_planks"))
    s.set(10, F + 1, 16, Blk("dark_oak_planks"))

    # Hold cargo, light and loot.
    s.chest(2, 3, 6, "east", "ship_chest", waterlog=True)
    s.chest(8, 3, 11, "west", "ship_chest", waterlog=True)
    s.chest(2, 3, 15, "east", "ship_chest", waterlog=True)
    s.set(8, 3, 6, Blk("hay_block"))
    s.set(8, 4, 6, Blk("hay_block", pillar_axis="x"))
    s.set(5, 3, 10, Blk("sea_lantern"))
    s.set(5, 3, 16, Blk("sea_lantern"))

    # Broken mast and fallen spar.
    s.fill(5, F + 1, 10, 5, 11, 10, Blk("dark_oak_log"))
    s.fill(2, F + 1, 11, 4, F + 1, 11, Blk("dark_oak_log", pillar_axis="x"))
    s.set(6, 11, 10, Blk("dark_oak_fence"), waterlog=True)

    # Ruin decay: holes in the hull (never around the vault/cabin), coral, pickles.
    for _ in range(14):
        z = r.randrange(4, 17)
        y = r.randrange(3, 6)
        x = r.choice((1, 9))
        if s.get(x, y, z) is not None and s.get(x, y, z).name.endswith("planks"):
            s.set(x, y, z, WATER)
    for _ in range(10):
        z = r.randrange(3, 18)
        x = r.randrange(2, 9)
        if 15 <= z <= 17:
            continue  # keep the arrow trap's line of fire clear
        if s.get(x, F, z) is not None and s.get(x, F, z).name.endswith("planks") and s.get(x, F + 1, z) is None:
            s.set(x, F + 1, z, Blk("sea_pickle", cluster_count=r.randrange(0, 4)), waterlog=True)
    for (x, y, z) in ((1, 2, 9), (9, 1, 13), (1, 1, 17), (9, 2, 5)):
        s.set(x, y, z, r.choice((Blk("tube_coral_block"), Blk("brain_coral_block"), Blk("dead_brain_coral_block"))))
    return s, {"altar": (ax, F + 1, az), "core": (ax, F, az)}


BUILDERS = {
    "jungle_temple": build_jungle_temple,
    "desert_crypt": build_desert_crypt,
    "sunken_ship": build_sunken_ship,
}


def build_all(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    info = {}
    for name, fn in BUILDERS.items():
        s, meta = fn()
        path = os.path.join(out_dir, f"{name}.mcstructure")
        s.save(path)
        info[name] = {"size": s.size, **meta, "path": path,
                      "blocks": len(s.blocks), "block_entities": len(s.block_entities)}
    return info


if __name__ == "__main__":
    import json
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "structures"
    print(json.dumps(build_all(out), indent=2))

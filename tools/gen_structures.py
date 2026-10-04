"""Builds the bunker layouts as voxel models, then writes .mcstructure files (for /structure load and
natural generation) and a compact RLE JS module used by the in-game fallback builder."""
import os, json, sys
sys.path.insert(0, os.path.dirname(__file__))
from nbt import build_mcstructure, Int, Byte

BP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_BP')
SCRATCH = os.environ.get('SCRATCH', '/tmp')

def V(name, **states):
    out = {}
    for k, v in states.items():
        out[k] = v
    return (name, out)
AIR = V('minecraft:air')
WALL, PANEL, FLOOR, HAZARD, GRATE, VENT = V('bunker:reinforced_wall'), V('bunker:reinforced_panel'), V('bunker:reinforced_floor'), V('bunker:hazard_block'), V('bunker:floor_grate'), V('bunker:vent')
LAMP = V('bunker:lamp', **{'bunker:mode': 'on'})
TABLE = V('bunker:steel_table')
SUPPLY, WEAPON = V('bunker:supply_crate', **{'bunker:opened': Byte(0)}), V('bunker:weapon_crate', **{'bunker:opened': Byte(0)})
def facing(name, d, **extra): return V(name, **{'minecraft:cardinal_direction': d, **extra})
def console(d): return facing('bunker:control_panel', d)
def rack(d): return facing('bunker:server_rack', d)
def monitor(d): return facing('bunker:monitor', d)
def locker(d): return facing('bunker:locker', d)
def door(d, half): return V('bunker:blast_door', **{'minecraft:cardinal_direction': d, 'bunker:half': half, 'bunker:open': Byte(0)})
def pipe(face): return V('bunker:pipe', **{'minecraft:block_face': face})
BARREL = V('minecraft:barrel', facing_direction=Int(1), open_bit=Byte(0))
LADDER_S = V('minecraft:ladder', facing_direction=Int(3))
HATCH = V('minecraft:iron_trapdoor', direction=Int(0), open_bit=Byte(0), upside_down_bit=Byte(1))
BULB = V('minecraft:waxed_copper_bulb', lit=Byte(1), powered_bit=Byte(0))
def bed(direction, head): return V('minecraft:bed', direction=Int(direction), head_piece_bit=Byte(1 if head else 0), occupied_bit=Byte(0))
SIMPLE = {k: V('minecraft:' + k) for k in ['iron_bars', 'waxed_copper_grate', 'tuff_bricks', 'polished_tuff', 'chiseled_tuff', 'waxed_oxidized_copper', 'waxed_copper',
          'iron_block', 'deepslate_tiles', 'crafting_table', 'anvil', 'smithing_table', 'stonecutter_block', 'grindstone', 'blast_furnace', 'furnace', 'smoker',
          'brewing_stand', 'cauldron', 'bookshelf', 'lectern', 'sea_lantern', 'lit_redstone_lamp', 'glass', 'polished_tuff_slab', 'lightning_rod', 'chain', 'smooth_stone', 'loom']}
LANTERN = V('minecraft:lantern', hanging=Byte(1))

class Model:
    def __init__(self, X, Y, Z):
        self.X, self.Y, self.Z = X, Y, Z; self.b = {}; self.be = {}; self.loot = []
    def set(self, x, y, z, blk):
        if 0 <= x < self.X and 0 <= y < self.Y and 0 <= z < self.Z: self.b[(x, y, z)] = blk
    def fill(self, x0, y0, z0, x1, y1, z1, blk):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1): self.set(x, y, z, blk)
    def get(self, x, y, z): return self.b.get((x, y, z), AIR)
    def room(self, x0, z0, x1, z1, h=3):
        """Carve an interior (inclusive bounds), lay floor + ceiling, teal panel band on walls."""
        self.fill(x0, 1, z0, x1, h, z1, AIR); self.fill(x0, 0, z0, x1, 0, z1, FLOOR); self.fill(x0, h + 1, z0, x1, h + 1, z1, WALL)
        for x in range(x0 - 1, x1 + 2):
            for z in range(z0 - 1, z1 + 2):
                if (x in (x0 - 1, x1 + 1)) != (z in (z0 - 1, z1 + 1)) and (x + z) % 3 == 0 and self.get(x, 2, z) == WALL: self.set(x, 2, z, PANEL)
    def lamps(self, x0, z0, x1, z1, y, step=4):
        for x in range(x0 + 1, x1, step):
            for z in range(z0 + 1, z1, step): self.set(x, y, z, LAMP)
    def doorway(self, x, z, d, hazard=True):
        self.set(x, 1, z, door(d, 'lower')); self.set(x, 2, z, door(d, 'upper')); self.set(x, 3, z, HAZARD)
        if hazard:
            dx, dz = (1, 0) if d in ('north', 'south') else (0, 1)
            for y in (1, 2, 3): self.set(x + dx, y, z + dz, HAZARD); self.set(x - dx, y, z - dz, HAZARD)
    def barrel(self, x, y, z, loot):
        self.set(x, y, z, BARREL); self.be[(x, y, z)] = {'id': 'Barrel', 'LootTable': 'loot_tables/bunker/%s_barrel.json' % loot, 'isMovable': Byte(1)}; self.loot.append([x, y, z, loot])
    def bed(self, x, z, color):
        self.set(x, 1, z, bed(2, False)); self.set(x, 1, z - 1, bed(2, True))
        for p in ((x, 1, z), (x, 1, z - 1)): self.be[p] = {'id': 'Bed', 'color': Byte(color), 'isMovable': Byte(1)}

# ============================================================== COMMAND COMPLEX (47 x 6 x 47) ===
def command_complex():
    m = Model(47, 6, 47)
    m.fill(0, 0, 0, 46, 5, 46, WALL)
    # four main corridors (3 wide), then the command room with its own thick walls
    m.room(22, 1, 24, 45); m.room(1, 22, 45, 24)
    m.fill(16, 1, 16, 30, 5, 30, WALL); m.room(17, 17, 29, 29, h=4)
    for z in range(1, 46):
        if z % 2 == 1 and not 16 <= z <= 30: m.set(23, 0, z, GRATE)
    for x in range(1, 46):
        if x % 2 == 1 and not 16 <= x <= 30: m.set(x, 0, 23, GRATE)
    m.lamps(21, 0, 25, 46, 4, 4); m.lamps(0, 21, 46, 25, 4, 4)
    for x in range(18, 29, 5):
        for z in range(18, 29, 5): m.set(x, 5, z, LAMP)
    for z in range(2, 45):
        if not 15 <= z <= 31: m.set(22, 3, z, pipe('north'))
    for x in range(2, 45):
        if not 15 <= x <= 31: m.set(x, 3, 22, pipe('east'))
    for z in range(5, 45, 8):
        if not 15 <= z <= 31: m.set(25, 3, z, VENT); m.set(21, 3, z, VENT)
    # eight rooms: a wide strip room beside each N/S corridor, a small room beside each E/W corridor
    rooms = {'armory': (1, 1, 20, 10), 'workshop': (1, 12, 10, 20), 'storage': (26, 1, 45, 10), 'mess': (36, 12, 45, 20),
             'medical': (1, 26, 10, 34), 'barracks': (1, 36, 20, 45), 'generator': (36, 26, 45, 34), 'server': (26, 36, 45, 45)}
    for r in rooms.values(): m.room(*r); m.lamps(r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1, 4, 5)
    m.doorway(21, 5, 'east'); m.doorway(5, 21, 'south'); m.doorway(25, 5, 'west'); m.doorway(41, 21, 'south')
    m.doorway(5, 25, 'north'); m.doorway(21, 41, 'east'); m.doorway(41, 25, 'north'); m.doorway(25, 41, 'west')
    m.doorway(23, 16, 'south'); m.doorway(23, 30, 'north'); m.doorway(16, 23, 'east'); m.doorway(30, 23, 'west')
    # airlock + ladder shaft at the north end of the north corridor
    m.doorway(23, 4, 'south'); m.fill(22, 1, 1, 24, 3, 3, AIR)
    for y in range(1, 6): m.set(23, y, 1, LADDER_S)
    for x in (22, 24): m.set(x, 1, 2, HAZARD); m.set(x, 2, 2, HAZARD)
    m.set(22, 2, 1, monitor('south')); m.set(24, 1, 1, SUPPLY)
    # ---- command room
    for x in range(21, 26):
        for z in range(21, 26): m.set(x, 1, z, TABLE)
    m.set(23, 2, 23, SIMPLE['lectern'])
    for x, z, d in ((20, 23, 'west'), (26, 23, 'east'), (23, 20, 'north'), (23, 26, 'south')): m.set(x, 1, z, console(d))
    for z in (19, 27): m.set(18, 1, z, rack('east')); m.set(28, 1, z, rack('west'))
    for i in range(19, 28, 2):
        m.set(i, 2, 17, monitor('south')); m.set(i, 2, 29, monitor('north')); m.set(17, 2, i, monitor('east')); m.set(29, 2, i, monitor('west'))
    for x in (18, 28):
        for z in (18, 28): m.set(x, 0, z, SIMPLE['waxed_oxidized_copper']); m.set(x, 4, z, BULB)
    m.fill(20, 0, 20, 26, 0, 26, GRATE); m.fill(21, 0, 21, 25, 0, 25, SIMPLE['polished_tuff'])
    # ---- armory (x1..20, z1..10)
    for x in range(2, 20, 2): m.set(x, 1, 1, locker('south'))
    for x in range(3, 19, 4): m.set(x, 1, 10, WEAPON); m.set(x + 1, 1, 10, WEAPON)
    for x in (6, 12): m.set(x, 1, 5, TABLE); m.set(x + 1, 1, 5, TABLE); m.set(x, 2, 5, WEAPON)
    m.set(18, 1, 6, console('west')); m.set(20, 2, 7, monitor('west')); m.set(2, 1, 8, SUPPLY); m.set(2, 2, 8, SUPPLY)
    m.barrel(3, 1, 9, 'armory'); m.barrel(19, 1, 2, 'armory')
    # ---- workshop (x1..10, z12..20)
    for x, b in zip(range(1, 11, 2), ['crafting_table', 'anvil', 'smithing_table', 'blast_furnace', 'grindstone']): m.set(x, 1, 12, SIMPLE[b])
    for z, b in zip(range(14, 20, 2), ['stonecutter_block', 'furnace', 'crafting_table']): m.set(1, 1, z, SIMPLE[b])
    m.set(5, 1, 16, TABLE); m.set(6, 1, 16, TABLE); m.set(10, 1, 15, SUPPLY); m.barrel(10, 1, 18, 'supply'); m.set(10, 2, 18, SIMPLE['bookshelf'])
    # ---- storage (x26..45, z1..10)
    for x in range(27, 45, 3):
        for z in (2, 3, 8, 9): m.barrel(x, 1, z, 'supply')
        m.barrel(x, 2, 2, 'supply'); m.barrel(x, 2, 9, 'food')
    for x in range(29, 44, 4): m.set(x, 1, 5, SUPPLY); m.set(x, 2, 5, SUPPLY); m.set(x + 1, 1, 5, SUPPLY)
    m.set(44, 1, 5, console('west')); m.barrel(27, 1, 5, 'armory')
    # ---- mess hall (x36..45, z12..20)
    for z in (14, 18): m.set(39, 1, z, TABLE); m.set(40, 1, z, TABLE); m.set(38, 1, z, SIMPLE['polished_tuff_slab']); m.set(41, 1, z, SIMPLE['polished_tuff_slab'])
    for z, b in zip(range(13, 20, 2), ['smoker', 'furnace', 'cauldron', 'smoker']): m.set(45, 1, z, SIMPLE[b])
    m.barrel(36, 1, 20, 'food'); m.barrel(36, 2, 20, 'food'); m.barrel(36, 1, 12, 'food'); m.set(36, 2, 16, monitor('east'))
    # ---- medical bay (x1..10, z26..34)
    for x in (2, 5, 8): m.bed(x, 28, 0); m.set(x + 1, 1, 26, locker('south'))
    m.set(2, 1, 34, SIMPLE['brewing_stand']); m.set(3, 1, 34, SIMPLE['cauldron']); m.set(5, 1, 34, TABLE); m.set(6, 1, 34, TABLE)
    m.barrel(10, 1, 30, 'medical'); m.barrel(10, 1, 34, 'medical'); m.set(10, 1, 26, SUPPLY); m.set(10, 2, 31, monitor('west'))
    # ---- barracks (x1..20, z36..45)
    for x in range(2, 20, 3): m.bed(x, 37, 7); m.bed(x, 45, 7)
    for x in range(3, 20, 3): m.set(x, 1, 36, locker('south'))
    for x in (6, 12): m.set(x, 1, 41, TABLE); m.set(x + 1, 1, 41, TABLE); m.set(x - 1, 1, 41, SIMPLE['polished_tuff_slab'])
    m.barrel(19, 1, 41, 'food'); m.barrel(1, 1, 41, 'supply'); m.set(20, 2, 41, monitor('west'))
    # ---- generator room (x36..45, z26..34)
    m.fill(38, 1, 28, 43, 1, 32, SIMPLE['waxed_copper']); m.fill(39, 1, 29, 42, 3, 31, SIMPLE['iron_bars']); m.fill(40, 1, 30, 41, 3, 30, SIMPLE['waxed_oxidized_copper'])
    m.set(40, 2, 30, SIMPLE['sea_lantern']); m.set(41, 2, 30, SIMPLE['sea_lantern']); m.fill(39, 4, 29, 42, 4, 31, SIMPLE['waxed_copper_grate'])
    for x in (38, 43): m.set(x, 4, 28, BULB); m.set(x, 4, 32, BULB)
    for z in range(27, 34, 3): m.set(36, 1, z, SIMPLE['lit_redstone_lamp']); m.set(36, 2, z, pipe('up')); m.set(36, 3, z, pipe('up'))
    m.set(37, 1, 26, console('south')); m.set(44, 1, 26, console('south')); m.set(45, 2, 30, monitor('west')); m.set(45, 1, 34, SUPPLY)
    # ---- server room (x26..45, z36..45)
    for x in range(27, 45, 2): m.set(x, 1, 36, rack('south')); m.set(x, 2, 36, rack('south')); m.set(x, 1, 45, rack('north')); m.set(x, 2, 45, rack('north'))
    for x in range(29, 43, 4): m.set(x, 1, 40, console('south')); m.set(x + 1, 1, 40, console('south'))
    for x in range(30, 42, 4): m.set(x, 2, 44, monitor('north'))
    m.set(44, 1, 40, console('west')); m.set(45, 2, 41, monitor('west')); m.fill(27, 0, 37, 44, 0, 44, GRATE); m.barrel(26, 1, 40, 'supply')
    return m

# ================================================================== OUTPOST (27 x 6 x 13) ===
def outpost():
    m = Model(27, 6, 13)
    m.fill(0, 0, 0, 26, 5, 12, WALL)
    m.room(1, 1, 7, 11); m.room(9, 1, 17, 11); m.room(19, 1, 25, 11)
    m.doorway(8, 6, 'east'); m.doorway(18, 6, 'west'); m.doorway(13, 12, 'north'); m.fill(12, 1, 12, 14, 3, 12, WALL); m.doorway(13, 12, 'north')
    m.lamps(0, 0, 8, 12, 4, 4); m.lamps(8, 0, 18, 12, 4, 4); m.lamps(18, 0, 26, 12, 4, 4)
    # storage
    for z in (2, 5, 8): m.barrel(1, 1, z, 'supply'); m.barrel(1, 2, z, 'food'); m.barrel(7, 1, z, 'supply')
    m.set(4, 1, 10, SUPPLY); m.set(4, 1, 2, WEAPON); m.barrel(7, 1, 10, 'armory'); m.set(1, 1, 10, SUPPLY); m.set(1, 2, 10, SUPPLY)
    # command
    m.set(13, 1, 2, console('north')); m.set(12, 1, 2, console('north')); m.set(14, 1, 2, console('north')); m.set(13, 2, 1, monitor('south')); m.set(11, 2, 1, monitor('south')); m.set(15, 2, 1, monitor('south'))
    m.set(10, 1, 4, rack('east')); m.set(10, 1, 5, rack('east')); m.set(16, 1, 4, rack('west')); m.set(16, 1, 5, rack('west'))
    m.fill(12, 1, 6, 14, 1, 7, TABLE); m.set(13, 2, 6, SIMPLE['lectern']); m.fill(11, 0, 5, 15, 0, 8, GRATE)
    m.set(10, 1, 10, SUPPLY); m.set(16, 1, 10, WEAPON); m.barrel(10, 1, 9, 'medical')
    # bunks
    for x in (20, 22, 24): m.bed(x, 3, 7)
    for x in (20, 22, 24): m.set(x, 1, 10, locker('north')) if False else m.set(x, 1, 11, locker('north'))
    m.set(21, 1, 7, TABLE); m.set(22, 1, 7, TABLE); m.barrel(25, 1, 7, 'food'); m.set(19, 1, 7, SUPPLY); m.set(25, 2, 9, monitor('west'))
    return m

def rle(m):
    pal, idx = [], {}
    def pi(blk):
        key = json.dumps([blk[0], {k: (int(v) if isinstance(v, int) and not isinstance(v, bool) else v) for k, v in blk[1].items()}], sort_keys=True)
        if key not in idx:
            idx[key] = len(pal); pal.append({'name': blk[0], 'states': {k: (bool(v) if isinstance(v, Byte) else (int(v) if isinstance(v, Int) else v)) for k, v in blk[1].items()}})
        return idx[key]
    runs, last, cnt = [], None, 0
    for x in range(m.X):
        for y in range(m.Y):
            for z in range(m.Z):
                p = pi(m.get(x, y, z))
                if p == last: cnt += 1
                else:
                    if last is not None: runs.append([last, cnt])
                    last, cnt = p, 1
    runs.append([last, cnt])
    return {'size': [m.X, m.Y, m.Z], 'palette': pal, 'runs': runs, 'loot': m.loot}

def ascii_map(m, y=1):
    sym = {'bunker:reinforced_wall': '#', 'minecraft:air': ' ', 'bunker:blast_door': 'D', 'bunker:hazard_block': '!', 'bunker:control_panel': 'C', 'bunker:server_rack': 'R',
           'bunker:steel_table': 'T', 'minecraft:barrel': 'b', 'bunker:supply_crate': 's', 'bunker:weapon_crate': 'w', 'bunker:locker': 'L', 'minecraft:bed': 'B', 'minecraft:ladder': 'H'}
    return '\n'.join(''.join(sym.get(m.get(x, y, z)[0], '.') for x in range(m.X)) for z in range(m.Z))

def run():
    out = {}
    for name, fn in (('command_complex', command_complex), ('outpost', outpost)):
        m = fn()
        data, np = build_mcstructure((m.X, m.Y, m.Z), m.b, m.be)
        os.makedirs(os.path.join(BP, 'structures', 'bunker'), exist_ok=True)
        with open(os.path.join(BP, 'structures', 'bunker', name + '.mcstructure'), 'wb') as f: f.write(data)
        out[name] = rle(m)
        with open(os.path.join(SCRATCH, 'map_%s.txt' % name), 'w') as f: f.write(ascii_map(m))
        print(name, 'size', (m.X, m.Y, m.Z), 'palette', np, 'runs', len(out[name]['runs']), 'bytes', len(data))
    with open(os.path.join(BP, 'scripts', 'data', 'structures.js'), 'w') as f:
        f.write('// AUTO-GENERATED by tools/gen_structures.py\nexport const STRUCTURES = ' + json.dumps(out, separators=(',', ':')) + ';\n')

if __name__ == '__main__':
    run()

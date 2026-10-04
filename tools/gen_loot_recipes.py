"""Loot tables (crates, barrels) and crafting recipes."""
import json, os
BP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_BP')

def e(name, weight=1, lo=1, hi=1):
    d = {'type': 'item', 'name': name if ':' in name else 'bunker:' + name, 'weight': weight}
    if hi > 1: d['functions'] = [{'function': 'set_count', 'count': {'min': lo, 'max': hi}}]
    return d
def pool(rolls, entries):
    return {'rolls': rolls if isinstance(rolls, int) else {'min': rolls[0], 'max': rolls[1]}, 'entries': entries}

MAGS = [e('light_magazine', 10, 1, 3), e('rifle_magazine', 10, 1, 2), e('shell_box', 6, 1, 2), e('energy_cell', 6, 1, 2), e('rail_slug', 3, 1, 2), e('rocket_ammo', 3, 1, 1)]
GUNS = [e('service_pistol', 12), e('wasp_smg', 9), e('ranger_rifle', 8), e('breacher_shotgun', 7), e('longshot_dmr', 5), e('bulwark_lmg', 4),
        e('pulse_rifle', 4), e('plasma_pistol', 5), e('railgun', 2), e('thumper_launcher', 2), e('combat_knife', 8), e('stun_baton', 6)]
ATTS = [e(a) for a in ('suppressor', 'heavy_barrel', 'extended_magazine', 'reflex_sight', 'foregrip', 'laser_sight')]
FOOD = [e('minecraft:cooked_beef', 8, 2, 4), e('minecraft:bread', 8, 2, 5), e('minecraft:baked_potato', 6, 2, 4), e('minecraft:apple', 5, 1, 3),
        e('minecraft:cooked_chicken', 6, 1, 3), e('minecraft:pumpkin_pie', 3, 1, 2), e('minecraft:golden_carrot', 2, 1, 2), e('minecraft:water_bucket', 2)]
LOOT = {
    'supply_crate': [pool((2, 3), MAGS + [e('medkit', 6), e('ammo_box', 4), e('steel_plate', 8, 1, 3), e('weapon_parts', 6, 1, 2), e('frag_grenade', 4, 1, 2)]), pool((0, 1), FOOD)],
    'weapon_crate': [pool(1, GUNS), pool((1, 2), MAGS), pool((0, 1), ATTS)],
    'supply_barrel': [pool((3, 5), MAGS + [e('steel_plate', 8, 1, 4), e('weapon_parts', 6, 1, 3), e('minecraft:torch', 6, 2, 6), e('minecraft:coal', 5, 2, 6),
                      e('minecraft:iron_ingot', 4, 1, 3), e('minecraft:copper_ingot', 4, 2, 5), e('medkit', 4), e('bunker_key', 1), e('minecraft:string', 3, 1, 4)])],
    'food_barrel': [pool((3, 6), FOOD + [e('minecraft:sugar', 3, 1, 3), e('minecraft:cake', 1)])],
    'medical_barrel': [pool((2, 4), [e('medkit', 10, 1, 2), e('minecraft:golden_apple', 2), e('minecraft:honey_bottle', 4, 1, 2), e('minecraft:milk_bucket', 3),
                       e('minecraft:glass_bottle', 4, 1, 3), e('minecraft:paper', 4, 1, 4), e('minecraft:string', 3, 1, 3), e('stun_grenade', 2, 1, 2)])],
    'armory_barrel': [pool(1, GUNS), pool((2, 4), MAGS), pool((0, 2), ATTS + [e('frag_grenade', 3, 1, 3), e('stun_grenade', 2, 1, 2), e('ammo_box', 2)])],
}

KEYS = {'P': 'bunker:steel_plate', 'W': 'bunker:weapon_parts', 'S': 'minecraft:stick', 'I': 'minecraft:iron_ingot', 'K': 'minecraft:gunpowder', 'C': 'minecraft:copper_ingot',
        'R': 'minecraft:redstone', 'D': 'minecraft:diamond', 'A': 'minecraft:amethyst_shard', 'B': 'minecraft:iron_block', 'G': 'minecraft:glass', 'Q': 'minecraft:paper',
        'L': 'minecraft:glowstone', 'T': 'minecraft:tuff', 'X': 'bunker:reinforced_wall', 'E': 'minecraft:deepslate_tiles', 'Y': 'minecraft:glowstone_dust', 'M': 'bunker:ammo_box'}
def shaped(ident, pattern, result, count=1):
    key = {}
    for row in pattern:
        for ch in row:
            if ch != ' ':
                key[ch] = {'tag': 'minecraft:planks'} if ch == 'p' else {'item': KEYS[ch]}
    return {'format_version': '1.20.10', 'minecraft:recipe_shaped': {'description': {'identifier': 'bunker:' + ident}, 'tags': ['crafting_table'],
            'pattern': pattern, 'key': key, 'unlock': {'context': 'AlwaysUnlocked'}, 'result': {'item': 'bunker:' + result, 'count': count}}}
def shapeless(ident, items, result, count=1):
    return {'format_version': '1.20.10', 'minecraft:recipe_shapeless': {'description': {'identifier': 'bunker:' + ident}, 'tags': ['crafting_table'],
            'ingredients': [{'item': i} for i in items], 'unlock': {'context': 'AlwaysUnlocked'}, 'result': {'item': 'bunker:' + result, 'count': count}}}

RECIPES = [
    shaped('steel_plate', ['III', 'III'], 'steel_plate', 4),
    shapeless('weapon_parts', ['minecraft:iron_ingot', 'minecraft:iron_ingot', 'minecraft:redstone', 'minecraft:copper_ingot'], 'weapon_parts', 2),
    shaped('service_pistol', ['PW', ' S'], 'service_pistol'), shaped('wasp_smg', ['PPW', ' SW'], 'wasp_smg'), shaped('ranger_rifle', ['WPP', 'SPW'], 'ranger_rifle'),
    shaped('breacher_shotgun', ['PPP', 'SWW'], 'breacher_shotgun'), shaped('longshot_dmr', ['GPP', 'SWW'], 'longshot_dmr'), shaped('bulwark_lmg', ['PPP', 'WWW', ' B '], 'bulwark_lmg'),
    shaped('pulse_rifle', ['APP', 'SWR'], 'pulse_rifle'), shaped('plasma_pistol', ['AW', 'RS'], 'plasma_pistol'), shaped('railgun', ['BPP', 'WWD', ' S '], 'railgun'),
    shaped('thumper_launcher', ['PPP', 'WKW', ' S '], 'thumper_launcher'), shaped('combat_knife', ['P', 'W'], 'combat_knife'), shaped('stun_baton', ['R', 'P', 'S'], 'stun_baton'),
    shaped('frag_grenade', [' K ', 'KPK', ' K '], 'frag_grenade', 3), shaped('stun_grenade', [' K ', 'KYK', ' K '], 'stun_grenade', 3),
    shaped('light_magazine', ['I', 'K'], 'light_magazine', 2), shaped('rifle_magazine', ['I', 'I', 'K'], 'rifle_magazine', 2), shaped('shell_box', ['IK', 'KI'], 'shell_box', 2),
    shaped('energy_cell', ['A', 'R', 'C'], 'energy_cell', 2), shaped('rail_slug', ['I', 'I', 'C'], 'rail_slug', 2), shaped('rocket_ammo', ['K', 'P', 'K'], 'rocket_ammo'),
    shaped('ammo_box', ['IKI', 'KKK', 'IKI'], 'ammo_box'),
    shaped('suppressor', ['PPP'], 'suppressor'), shaped('extended_magazine', ['I', 'I', 'I'], 'extended_magazine'), shaped('reflex_sight', ['G', 'R', 'P'], 'reflex_sight'),
    shaped('foregrip', ['P', 'S'], 'foregrip'), shaped('laser_sight', ['RG', 'PP'], 'laser_sight'), shaped('heavy_barrel', ['PP', 'WP'], 'heavy_barrel'),
    shaped('bunker_blueprint', ['PPP', 'PQP', 'PPP'], 'bunker_blueprint'), shaped('field_terminal', ['GG', 'RW', 'PP'], 'field_terminal'),
    shapeless('medkit', ['minecraft:paper', 'minecraft:paper', 'minecraft:string', 'minecraft:red_dye'], 'medkit'),
    shapeless('bunker_key', ['minecraft:iron_ingot', 'minecraft:redstone', 'minecraft:copper_ingot'], 'bunker_key'),
    shaped('reinforced_wall', ['PT', 'TP'], 'reinforced_wall', 4), shaped('reinforced_panel', ['XC', 'CX'], 'reinforced_panel', 4), shaped('reinforced_floor', ['XEX'], 'reinforced_floor', 3),
    shapeless('hazard_block', ['bunker:reinforced_wall', 'minecraft:yellow_dye', 'minecraft:black_dye'], 'hazard_block', 2),
    shaped('floor_grate', ['I I', 'III', 'I I'], 'floor_grate', 4), shaped('vent', ['I I', 'IXI', 'I I'], 'vent', 2), shaped('blast_door', ['PP', 'WP', 'PP'], 'blast_door'),
    shaped('lamp', [' P ', 'PLP', ' P '], 'lamp', 4), shaped('control_panel', ['GGG', 'RWR', 'PPP'], 'control_panel'), shaped('server_rack', ['IRI', 'IRI', 'IRI'], 'server_rack'),
    shaped('monitor', ['GGG', 'RRR', 'PPP'], 'monitor', 2), shaped('supply_crate', ['pPp', 'PMP', 'pPp'], 'supply_crate'), shaped('locker', ['PP', 'PP', 'PP'], 'locker', 2),
    shaped('steel_table', ['PPP', 'I I'], 'steel_table'), shaped('pipe', ['I', 'I'], 'pipe', 4),
]

def build():
    ld = os.path.join(BP, 'loot_tables', 'bunker'); os.makedirs(ld, exist_ok=True)
    for k, pools in LOOT.items():
        json.dump({'pools': pools}, open(os.path.join(ld, k + '.json'), 'w'), indent=2)
    rd = os.path.join(BP, 'recipes'); os.makedirs(rd, exist_ok=True)
    for r in RECIPES:
        ident = list(r.values())[1]['description']['identifier'].split(':')[1]
        json.dump(r, open(os.path.join(rd, ident + '.json'), 'w'), indent=2)
    print('wrote', len(LOOT), 'loot tables,', len(RECIPES), 'recipes')

if __name__ == '__main__':
    build()

"""Generates BP block definitions, RP block geometry, terrain_texture.json, blocks.json and flipbook_textures.json."""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'addon')
BP, RP = os.path.join(ROOT, 'BunkerArsenal_BP'), os.path.join(ROOT, 'BunkerArsenal_RP')
FMT = '1.20.80'
CARDINAL = {'north': [0, 0, 0], 'south': [0, 180, 0], 'east': [0, 270, 0], 'west': [0, 90, 0]}

BLOCK_NAMES = {
    'reinforced_wall': 'Reinforced Bunker Wall', 'reinforced_panel': 'Reinforced Bunker Panel', 'reinforced_floor': 'Reinforced Bunker Floor',
    'hazard_block': 'Hazard Plating', 'floor_grate': 'Steel Floor Grate', 'vent': 'Bunker Vent', 'blast_door': 'Blast Door', 'lamp': 'Bunker Lamp',
    'control_panel': 'Control Panel', 'server_rack': 'Server Rack', 'monitor': 'Wall Monitor', 'supply_crate': 'Supply Crate',
    'weapon_crate': 'Weapon Crate', 'locker': 'Steel Locker', 'steel_table': 'Steel Table', 'pipe': 'Steel Pipe',
}
# terrain texture atlas entries: short name -> texture file (relative to textures/blocks/bunker)
TERRAIN = ['reinforced_wall', 'reinforced_panel', 'reinforced_floor', 'hazard_block', 'floor_grate', 'vent', 'blast_door', 'lamp_on', 'lamp_off',
           'lamp_alarm', 'control_panel_top', 'control_panel_side', 'control_panel_front', 'server_rack_front', 'server_rack_side', 'server_rack_top',
           'monitor', 'supply_crate_side', 'supply_crate_top', 'supply_crate_open', 'weapon_crate_side', 'weapon_crate_top', 'weapon_crate_open',
           'locker_front', 'locker_side', 'steel_top', 'pipe']

def mat(tex, method='opaque', **kw):
    d = {'texture': 'bunker_' + tex, 'render_method': method}; d.update(kw); return d

def base(ident, components, states=None, traits=None, permutations=None, category='construction'):
    desc = {'identifier': 'bunker:' + ident, 'menu_category': {'category': category}}
    if states: desc['states'] = states
    if traits: desc['traits'] = traits
    b = {'format_version': FMT, 'minecraft:block': {'description': desc, 'components': components}}
    if permutations: b['minecraft:block']['permutations'] = permutations
    return b

def solid(tex_map, seconds=5.0, resistance=1200.0, color='#565b60', light=0, extra=None):
    comps = {
        'minecraft:geometry': 'minecraft:geometry.full_block',
        'minecraft:material_instances': tex_map,
        'minecraft:destructible_by_mining': {'seconds_to_destroy': seconds},
        'minecraft:destructible_by_explosion': {'explosion_resistance': resistance},
        'minecraft:map_color': color,
        'minecraft:friction': 0.6,
    }
    if light: comps['minecraft:light_emission'] = light
    if extra: comps.update(extra)
    return comps

def cardinal_perms():
    return [{'condition': "q.block_state('minecraft:cardinal_direction') == '%s'" % d, 'components': {'minecraft:transformation': {'rotation': r}}} for d, r in CARDINAL.items()]
CARDINAL_TRAIT = {'minecraft:placement_direction': {'enabled_states': ['minecraft:cardinal_direction'], 'y_rotation_offset': 180}}

BLOCKS = {}
BLOCKS['reinforced_wall'] = base('reinforced_wall', solid({'*': mat('reinforced_wall')}))
BLOCKS['reinforced_panel'] = base('reinforced_panel', solid({'*': mat('reinforced_panel')}, color='#3f8068'))
BLOCKS['reinforced_floor'] = base('reinforced_floor', solid({'*': mat('reinforced_floor')}, color='#3f4347'))
BLOCKS['hazard_block'] = base('hazard_block', solid({'*': mat('hazard_block')}, color='#e8c04a'))
BLOCKS['floor_grate'] = base('floor_grate', solid({'*': mat('floor_grate')}, seconds=3.0, resistance=30.0, color='#2e3236'))
BLOCKS['vent'] = base('vent', solid({'*': mat('vent')}, seconds=3.0, resistance=30.0))
BLOCKS['pipe'] = base('pipe', {
    'minecraft:geometry': 'geometry.bunker_pipe', 'minecraft:material_instances': {'*': mat('pipe')},
    'minecraft:collision_box': {'origin': [-3, 0, -3], 'size': [6, 16, 6]}, 'minecraft:selection_box': {'origin': [-3, 0, -3], 'size': [6, 16, 6]},
    'minecraft:destructible_by_mining': {'seconds_to_destroy': 2.0}, 'minecraft:destructible_by_explosion': {'explosion_resistance': 30.0},
    'minecraft:map_color': '#6e747a', 'minecraft:light_dampening': 0},
    traits={'minecraft:placement_position': {'enabled_states': ['minecraft:block_face']}},
    permutations=[
        {'condition': "q.block_state('minecraft:block_face') == 'north' || q.block_state('minecraft:block_face') == 'south'",
         'components': {'minecraft:transformation': {'rotation': [90, 0, 0]}, 'minecraft:collision_box': {'origin': [-3, 5, -8], 'size': [6, 6, 16]}, 'minecraft:selection_box': {'origin': [-3, 5, -8], 'size': [6, 6, 16]}}},
        {'condition': "q.block_state('minecraft:block_face') == 'east' || q.block_state('minecraft:block_face') == 'west'",
         'components': {'minecraft:transformation': {'rotation': [0, 0, 90]}, 'minecraft:collision_box': {'origin': [-8, 5, -3], 'size': [16, 6, 6]}, 'minecraft:selection_box': {'origin': [-8, 5, -3], 'size': [16, 6, 6]}}},
    ])
BLOCKS['lamp'] = base('lamp', solid({'*': mat('lamp_on')}, seconds=1.0, resistance=30.0, color='#f5e9b8', light=15),
    states={'bunker:mode': ['on', 'off', 'alarm']},
    permutations=[
        {'condition': "q.block_state('bunker:mode') == 'off'", 'components': {'minecraft:material_instances': {'*': mat('lamp_off')}, 'minecraft:light_emission': 0}},
        {'condition': "q.block_state('bunker:mode') == 'alarm'", 'components': {'minecraft:material_instances': {'*': mat('lamp_alarm')}, 'minecraft:light_emission': 9}},
    ])
BLOCKS['control_panel'] = base('control_panel', {
    'minecraft:geometry': 'geometry.bunker_console',
    'minecraft:material_instances': {'*': mat('control_panel_side'), 'up': mat('control_panel_top'), 'north': mat('control_panel_front')},
    'minecraft:collision_box': {'origin': [-8, 0, -8], 'size': [16, 12, 16]}, 'minecraft:selection_box': {'origin': [-8, 0, -8], 'size': [16, 12, 16]},
    'minecraft:destructible_by_mining': {'seconds_to_destroy': 3.0}, 'minecraft:destructible_by_explosion': {'explosion_resistance': 30.0},
    'minecraft:map_color': '#3f8068', 'minecraft:light_emission': 4, 'minecraft:light_dampening': 0},
    traits=CARDINAL_TRAIT, permutations=cardinal_perms(), category='items')
BLOCKS['server_rack'] = base('server_rack', solid({'*': mat('server_rack_side'), 'north': mat('server_rack_front'), 'up': mat('server_rack_top'), 'down': mat('server_rack_top')},
    seconds=3.0, resistance=30.0, color='#23262a', light=2), traits=CARDINAL_TRAIT, permutations=cardinal_perms(), category='items')
BLOCKS['monitor'] = base('monitor', {
    'minecraft:geometry': 'geometry.bunker_panel',
    'minecraft:material_instances': {'*': mat('server_rack_side'), 'north': mat('monitor')},
    'minecraft:collision_box': {'origin': [-8, 0, 5], 'size': [16, 16, 3]}, 'minecraft:selection_box': {'origin': [-8, 0, 5], 'size': [16, 16, 3]},
    'minecraft:destructible_by_mining': {'seconds_to_destroy': 1.5}, 'minecraft:destructible_by_explosion': {'explosion_resistance': 10.0},
    'minecraft:map_color': '#0b4c66', 'minecraft:light_emission': 5, 'minecraft:light_dampening': 0},
    traits=CARDINAL_TRAIT, permutations=cardinal_perms(), category='items')
for crate, color, secs in (('supply_crate', '#555c2e', 1.5), ('weapon_crate', '#383c41', 3.0)):
    BLOCKS[crate] = base(crate, solid({'*': mat(crate + '_side'), 'up': mat(crate + '_top'), 'down': mat(crate + '_top')}, seconds=secs, resistance=20.0, color=color,
        extra={'minecraft:loot': 'loot_tables/bunker/%s.json' % crate}),
        states={'bunker:opened': [False, True]},
        permutations=[{'condition': "q.block_state('bunker:opened')", 'components': {
            'minecraft:material_instances': {'*': mat(crate + '_side'), 'up': mat(crate + '_open'), 'down': mat(crate + '_top')},
            'minecraft:loot': 'loot_tables/empty.json'}}], category='items')
BLOCKS['locker'] = base('locker', solid({'*': mat('locker_side'), 'north': mat('locker_front')}, seconds=3.0, resistance=30.0),
    traits=CARDINAL_TRAIT, permutations=cardinal_perms(), category='items')
BLOCKS['steel_table'] = base('steel_table', {
    'minecraft:geometry': 'geometry.bunker_table', 'minecraft:material_instances': {'*': mat('steel_top')},
    'minecraft:collision_box': {'origin': [-8, 0, -8], 'size': [16, 16, 16]}, 'minecraft:selection_box': {'origin': [-8, 0, -8], 'size': [16, 16, 16]},
    'minecraft:destructible_by_mining': {'seconds_to_destroy': 2.0}, 'minecraft:destructible_by_explosion': {'explosion_resistance': 20.0},
    'minecraft:map_color': '#6e747a', 'minecraft:light_dampening': 0}, category='items')

# ---- Blast door: two-block tall, sliding, rotatable -------------------------------------------
door_closed = {'minecraft:collision_box': {'origin': [-8, 0, -2], 'size': [16, 16, 4]}, 'minecraft:selection_box': {'origin': [-8, 0, -2], 'size': [16, 16, 4]}}
door_open = {'minecraft:collision_box': False, 'minecraft:selection_box': {'origin': [5, 0, -2], 'size': [3, 16, 4]}}
perms = []
for half in ('lower', 'upper'):
    for opened in (False, True):
        comps = {'minecraft:geometry': 'geometry.bunker_door_%s%s' % (half, '_open' if opened else '')}
        comps.update(door_open if opened else door_closed)
        if half == 'upper': comps['minecraft:loot'] = 'loot_tables/empty.json'
        perms.append({'condition': "q.block_state('bunker:half') == '%s' && %sq.block_state('bunker:open')" % (half, '' if opened else '!'), 'components': comps})
for d, r in CARDINAL.items():
    perms.append({'condition': "q.block_state('minecraft:cardinal_direction') == '%s'" % d, 'components': {'minecraft:transformation': {'rotation': r}}})
BLOCKS['blast_door'] = base('blast_door', {
    'minecraft:geometry': 'geometry.bunker_door_lower', 'minecraft:material_instances': {'*': mat('blast_door')},
    'minecraft:destructible_by_mining': {'seconds_to_destroy': 6.0}, 'minecraft:destructible_by_explosion': {'explosion_resistance': 1200.0},
    'minecraft:map_color': '#6e747a', 'minecraft:light_dampening': 0, **door_closed},
    states={'bunker:half': ['lower', 'upper'], 'bunker:open': [False, True]}, traits=CARDINAL_TRAIT, permutations=perms)

# ---- Geometry ------------------------------------------------------------------------------------
def geo(ident, cubes, tw=16, th=16):
    return {'format_version': '1.12.0', 'minecraft:geometry': [{'description': {'identifier': ident, 'texture_width': tw, 'texture_height': th,
            'visible_bounds_width': 2, 'visible_bounds_height': 2, 'visible_bounds_offset': [0, 0.5, 0]}, 'bones': [{'name': 'root', 'pivot': [0, 0, 0], 'cubes': cubes}]}]}
def cube(origin, size, uv=None, rotation=None, pivot=None):
    c = {'origin': origin, 'size': size, 'uv': uv if uv is not None else [0, 0]}
    if rotation: c['rotation'] = rotation; c['pivot'] = pivot
    return c
def faces(sz, u=0, v=0):
    w, h, d = sz
    return {'north': {'uv': [u, v], 'uv_size': [w, h]}, 'south': {'uv': [u, v], 'uv_size': [w, h]}, 'east': {'uv': [u, v], 'uv_size': [d, h]},
            'west': {'uv': [u, v], 'uv_size': [d, h]}, 'up': {'uv': [u, v], 'uv_size': [w, d]}, 'down': {'uv': [u, v], 'uv_size': [w, d]}}
GEOS = {
    'bunker_pipe': geo('geometry.bunker_pipe', [cube([-3, 0, -3], [6, 16, 6], faces((6, 16, 6), 5, 0))]),
    'bunker_console': geo('geometry.bunker_console', [cube([-8, 0, -8], [16, 6, 16], faces((16, 6, 16), 0, 10)),
                          cube([-8, 6, -6], [16, 5, 12], faces((16, 5, 16), 0, 0), rotation=[-20, 0, 0], pivot=[0, 6, 6])]),
    'bunker_panel': geo('geometry.bunker_panel', [cube([-8, 0, 5], [16, 16, 3], faces((16, 16, 3)))]),
    'bunker_table': geo('geometry.bunker_table', [cube([-8, 14, -8], [16, 2, 16], faces((16, 2, 16))), cube([-7, 0, -7], [2, 14, 2], faces((2, 14, 2))),
                        cube([5, 0, -7], [2, 14, 2], faces((2, 14, 2))), cube([-7, 0, 5], [2, 14, 2], faces((2, 14, 2))), cube([5, 0, 5], [2, 14, 2], faces((2, 14, 2)))]),
}
for half, v in (('lower', 16), ('upper', 0)):
    GEOS['bunker_door_' + half] = geo('geometry.bunker_door_' + half, [cube([-8, 0, -2], [16, 16, 4], faces((16, 16, 4), 0, v))], 16, 32)
    GEOS['bunker_door_%s_open' % half] = geo('geometry.bunker_door_%s_open' % half, [cube([5, 0, -2], [3, 16, 4], faces((3, 16, 4), 13, v))], 16, 32)

def build():
    bdir = os.path.join(BP, 'blocks'); os.makedirs(bdir, exist_ok=True)
    for k, b in BLOCKS.items():
        json.dump(b, open(os.path.join(bdir, k + '.json'), 'w'), indent=2)
    gdir = os.path.join(RP, 'models', 'blocks'); os.makedirs(gdir, exist_ok=True)
    for k, g in GEOS.items():
        json.dump(g, open(os.path.join(gdir, k + '.geo.json'), 'w'), indent=2)
    tt = {'resource_pack_name': 'bunker_arsenal', 'texture_name': 'atlas.terrain', 'padding': 8, 'num_mip_levels': 4,
          'texture_data': {'bunker_' + t: {'textures': 'textures/blocks/bunker/' + t} for t in TERRAIN}}
    json.dump(tt, open(os.path.join(RP, 'textures', 'terrain_texture.json'), 'w'), indent=2)
    sounds = {'reinforced_wall': 'metal', 'reinforced_panel': 'copper', 'reinforced_floor': 'metal', 'hazard_block': 'metal', 'floor_grate': 'copper_grate',
              'vent': 'metal', 'blast_door': 'metal', 'lamp': 'glass', 'control_panel': 'metal', 'server_rack': 'metal', 'monitor': 'glass',
              'supply_crate': 'wood', 'weapon_crate': 'metal', 'locker': 'metal', 'steel_table': 'metal', 'pipe': 'metal'}
    bj = {'format_version': [1, 1, 0]}
    for k, s in sounds.items(): bj['bunker:' + k] = {'sound': s}
    json.dump(bj, open(os.path.join(RP, 'blocks.json'), 'w'), indent=2)
    fb = [{'flipbook_texture': 'textures/blocks/bunker/server_rack_front', 'atlas_tile': 'bunker_server_rack_front', 'ticks_per_frame': 12, 'blend_frames': False},
          {'flipbook_texture': 'textures/blocks/bunker/monitor', 'atlas_tile': 'bunker_monitor', 'ticks_per_frame': 16, 'blend_frames': False}]
    json.dump(fb, open(os.path.join(RP, 'textures', 'flipbook_textures.json'), 'w'), indent=2)
    print('wrote', len(BLOCKS), 'blocks,', len(GEOS), 'geometries')

if __name__ == '__main__':
    build()

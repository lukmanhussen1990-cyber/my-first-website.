"""Projectile entities (frag grenade, stun charge, rocket): BP behavior + RP client entity, geometry, render controller."""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'addon')
BP, RP = os.path.join(ROOT, 'BunkerArsenal_BP'), os.path.join(ROOT, 'BunkerArsenal_RP')

def explode(power):
    return {'minecraft:explode': {'fuse_length': 0, 'fuse_lit': True, 'power': power, 'causes_fire': False, 'breaks_blocks': False,
                                  'destroy_affected_by_griefing': False, 'allow_underwater': True}}

def projectile(ident, on_hit, power, gravity, uncertainty, timer, timer_event, groups, events, extra=None):
    comps = {
        'minecraft:collision_box': {'width': 0.25, 'height': 0.25},
        'minecraft:physics': {'has_gravity': True, 'has_collision': True},
        'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
        'minecraft:type_family': {'family': ['bunker_projectile', 'inanimate']},
        'minecraft:damage_sensor': {'triggers': {'deals_damage': False}},
        'minecraft:projectile': {'on_hit': on_hit, 'power': power, 'gravity': gravity, 'anchor': 1, 'offset': [0, -0.1, 0], 'uncertainty_base': uncertainty,
                                 'uncertainty_multiplier': 0, 'inertia': 0.99, 'liquid_inertia': 0.6, 'should_bounce': False, 'stop_on_hurt': True, 'hit_sound': ''},
        'minecraft:timer': {'time': timer, 'looping': False, 'time_down_event': {'event': timer_event}},
    }
    if extra: comps.update(extra)
    return {'format_version': '1.16.0', 'minecraft:entity': {
        'description': {'identifier': ident, 'is_spawnable': False, 'is_summonable': True, 'is_experimental': False},
        'component_groups': groups, 'components': comps, 'events': events}}

ENTS = {
    'grenade': projectile('bunker:grenade', {'stick_in_ground': {'shake_time': 0.0}}, 1.4, 0.06, 1.0, 2.5, 'bunker:detonate',
        {'bunker:exploding': explode(2.5)}, {'bunker:detonate': {'add': {'component_groups': ['bunker:exploding']}}}),
    'stun_charge': projectile('bunker:stun_charge', {'stick_in_ground': {'shake_time': 0.0}}, 1.4, 0.06, 1.0, 2.0, 'bunker:stun',
        {'bunker:fading': {'minecraft:timer': {'time': 0.3, 'looping': False, 'time_down_event': {'event': 'bunker:despawn'}}},
         'bunker:gone': {'minecraft:instant_despawn': {}}},
        {'bunker:stun': {'add': {'component_groups': ['bunker:fading']}}, 'bunker:despawn': {'add': {'component_groups': ['bunker:gone']}}}),
    'rocket': projectile('bunker:rocket',
        {'impact_damage': {'damage': 6, 'knockback': True, 'semi_random_diff_damage': False, 'destroy_on_hit': False},
         'definition_event': {'affect_projectile': True, 'event_trigger': {'event': 'bunker:detonate', 'target': 'self'}}},
        2.8, 0.012, 0.0, 5.0, 'bunker:detonate', {'bunker:exploding': explode(3.5)}, {'bunker:detonate': {'add': {'component_groups': ['bunker:exploding']}}}),
}

def client(ident, tex, geo):
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': ident, 'materials': {'default': 'entity_alphatest'}, 'textures': {'default': 'textures/entity/bunker/' + tex},
        'geometry': {'default': geo}, 'render_controllers': ['controller.render.bunker_simple']}}}

def geo(ident, origin, size):
    faces = {f: {'uv': [0, 0], 'uv_size': [8, 8]} for f in ('north', 'south', 'east', 'west', 'up', 'down')}
    return {'format_version': '1.12.0', 'minecraft:geometry': [{'description': {'identifier': ident, 'texture_width': 8, 'texture_height': 8,
            'visible_bounds_width': 1, 'visible_bounds_height': 1, 'visible_bounds_offset': [0, 0.25, 0]},
            'bones': [{'name': 'body', 'pivot': [0, 0, 0], 'cubes': [{'origin': origin, 'size': size, 'uv': faces}]}]}]}

def build():
    for k, e in ENTS.items():
        json.dump(e, open(os.path.join(BP, 'entities', k + '.json'), 'w'), indent=2)
    for k, tex, g in (('grenade', 'grenade', 'geometry.bunker_grenade'), ('stun_charge', 'stun_charge', 'geometry.bunker_grenade'), ('rocket', 'rocket', 'geometry.bunker_rocket')):
        json.dump(client('bunker:' + k, tex, g), open(os.path.join(RP, 'entity', k + '.entity.json'), 'w'), indent=2)
    json.dump(geo('geometry.bunker_grenade', [-2, 0, -2], [4, 4, 4]), open(os.path.join(RP, 'models', 'entity', 'grenade.geo.json'), 'w'), indent=2)
    json.dump(geo('geometry.bunker_rocket', [-1.5, 0, -5], [3, 3, 10]), open(os.path.join(RP, 'models', 'entity', 'rocket.geo.json'), 'w'), indent=2)
    json.dump({'format_version': '1.10.0', 'render_controllers': {'controller.render.bunker_simple': {
        'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.default']}}},
        open(os.path.join(RP, 'render_controllers', 'bunker.render_controllers.json'), 'w'), indent=2)
    print('wrote', len(ENTS), 'entities')

if __name__ == '__main__':
    build()

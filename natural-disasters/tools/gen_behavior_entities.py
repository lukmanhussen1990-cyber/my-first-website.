#!/usr/bin/env python3
"""Write the three behaviour-pack entity definitions (temporary physics props used by the disasters)."""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'NaturalDisasters_BP', 'entities')
os.makedirs(ROOT, exist_ok=True)

# name -> (family tag, gravity, collision, box size, lifetime seconds)
ENTITIES = {
    'debris': ('nd_debris', True, True, 0.5, 14),
    'lava_bomb': ('nd_lava_bomb', True, True, 0.7, 12),
    'meteor': ('nd_meteor', False, False, 2.4, 40),
}

for name, (family, gravity, collision, box, life) in ENTITIES.items():
    ent = {
        'format_version': '1.20.50',
        'minecraft:entity': {
            'description': {'identifier': 'nd:%s' % name, 'is_spawnable': False, 'is_summonable': True, 'is_experimental': False},
            'component_groups': {'nd:despawn': {'minecraft:instant_despawn': {}}},
            'components': {
                'minecraft:type_family': {'family': ['nd_temp', family]},
                'minecraft:collision_box': {'width': box, 'height': box},
                'minecraft:physics': {'has_gravity': gravity, 'has_collision': collision},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:knockback_resistance': {'value': 1.0},
                'minecraft:health': {'value': 1, 'max': 1},
                'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': False}]},
                'minecraft:fire_immune': {},
                'minecraft:timer': {'looping': False, 'time': life, 'time_down_event': {'event': 'nd:despawn', 'target': 'self'}},
            },
            'events': {'nd:despawn': {'add': {'component_groups': ['nd:despawn']}}},
        },
    }
    with open(os.path.join(ROOT, '%s.json' % name), 'w') as fh:
        json.dump(ent, fh, indent=2)
print('behaviour entities written')

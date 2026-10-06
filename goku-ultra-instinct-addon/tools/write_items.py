#!/usr/bin/env python3
"""Writes the behavior-pack item definitions (format 1.20.80) and recipes."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelkit import write_json  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, 'GokuUltraInstinct_BP')

# id: (display name with a hint line, interact button text, cooldown seconds, glint)
POWERS = {
    'ultra_instinct': ('§7§lUltra Instinct§r\n§8Use: transform / turn off', 'Transform', 2.0, True),
    'kamehameha': ('§b§lKamehameha§r\n§8Use: charge and fire the wave', 'Kamehameha!', 5.0, True),
    'ki_blast': ('§e§lKi Blast§r\n§8Use: rapid energy blasts', 'Ki Blast', 0.25, False),
    'spirit_bomb': ('§9§lSpirit Bomb§r\n§8Use: gather energy, throw it', 'Spirit Bomb!', 12.0, True),
    'instant_transmission': ('§d§lInstant Transmission§r\n§8Use: teleport where you look\n§8Sneak + use: appear behind an enemy', 'Teleport', 1.5, False),
    'dragon_fist': ('§6§lDragon Fist§r\n§8Use: dash punch through enemies', 'Dragon Fist!', 4.0, False),
    'flying_nimbus': ('§e§lFlying Nimbus§r\n§8Use: ride the cloud / land', 'Fly', 1.0, False),
    'dragon_radar': ('§a§lDragon Radar§r\n§8Use: Goku menu, items and settings', 'Open Radar', 0.5, False),
}

ARMOR = {
    'goku_hair': ('§fGoku\'s Hair', 'slot.armor.head', 'armor_head', 3),
    'ui_hair': ('§7§lUltra Instinct Hair', 'slot.armor.head', 'armor_head', 3),
    'gi_top': ('§6Goku\'s Gi', 'slot.armor.chest', 'armor_torso', 8),
    'gi_pants': ('§6Goku\'s Gi Pants', 'slot.armor.legs', 'armor_legs', 6),
    'gi_boots': ('§9Goku\'s Boots', 'slot.armor.feet', 'armor_feet', 3),
}


def item(identifier, components, category='equipment'):
    return {
        'format_version': '1.20.80',
        'minecraft:item': {
            'description': {
                'identifier': 'goku:' + identifier,
                'menu_category': {'category': category},
            },
            'components': components,
        },
    }


def main():
    for ident, (name, button, cooldown, glint) in POWERS.items():
        comps = {
            'minecraft:icon': 'goku_' + ident,
            'minecraft:display_name': {'value': name},
            'minecraft:max_stack_size': 1,
            'minecraft:interact_button': button,
            'minecraft:can_destroy_in_creative': False,
            'minecraft:cooldown': {'category': 'goku_' + ident, 'duration': cooldown},
            'minecraft:tags': {'tags': ['goku:power']},
        }
        if glint:
            comps['minecraft:glint'] = True
        write_json(os.path.join(BP, 'items', ident + '.json'), item(ident, comps))

    write_json(os.path.join(BP, 'items', 'power_pole.json'), item('power_pole', {
        'minecraft:icon': 'goku_power_pole',
        'minecraft:display_name': {'value': '§c§lPower Pole§r\n§8Hit: strong staff\n§8Use: EXTEND! hits far away'},
        'minecraft:max_stack_size': 1,
        'minecraft:hand_equipped': True,
        'minecraft:damage': 9,
        'minecraft:enchantable': {'slot': 'sword', 'value': 15},
        'minecraft:interact_button': 'Extend!',
        'minecraft:can_destroy_in_creative': False,
        'minecraft:cooldown': {'category': 'goku_power_pole', 'duration': 1.5},
        'minecraft:tags': {'tags': ['goku:power']},
    }))

    write_json(os.path.join(BP, 'items', 'senzu_bean.json'), item('senzu_bean', {
        'minecraft:icon': 'goku_senzu_bean',
        'minecraft:display_name': {'value': '§a§lSenzu Bean§r\n§8Eat: full health, hunger and ki'},
        'minecraft:max_stack_size': 16,
        'minecraft:use_animation': 'eat',
        'minecraft:use_modifiers': {'use_duration': 0.8, 'movement_modifier': 0.6},
        'minecraft:food': {'nutrition': 20, 'saturation_modifier': 1.2, 'can_always_eat': True},
        'minecraft:tags': {'tags': ['minecraft:is_food', 'goku:power']},
    }))

    for ident, (name, slot, ench, protection) in ARMOR.items():
        write_json(os.path.join(BP, 'items', ident + '.json'), item(ident, {
            'minecraft:icon': 'goku_' + ident,
            'minecraft:display_name': {'value': name},
            'minecraft:max_stack_size': 1,
            'minecraft:wearable': {'slot': slot, 'protection': protection},
            'minecraft:enchantable': {'slot': ench, 'value': 15},
            'minecraft:tags': {'tags': ['goku:outfit']},
        }))

    # survival: the Dragon Radar is the shop for everything else
    write_json(os.path.join(BP, 'recipes', 'dragon_radar.json'), {
        'format_version': '1.20.10',
        'minecraft:recipe_shaped': {
            'description': {'identifier': 'goku:dragon_radar'},
            'tags': ['crafting_table'],
            'pattern': [' R ', 'IGI', ' I '],
            'key': {
                'R': {'item': 'minecraft:redstone'},
                'I': {'item': 'minecraft:iron_ingot'},
                'G': {'item': 'minecraft:glass'},
            },
            'unlock': [{'item': 'minecraft:iron_ingot'}],
            'result': {'item': 'goku:dragon_radar'},
        },
    })
    write_json(os.path.join(BP, 'recipes', 'senzu_bean.json'), {
        'format_version': '1.20.10',
        'minecraft:recipe_shapeless': {
            'description': {'identifier': 'goku:senzu_bean'},
            'tags': ['crafting_table'],
            'ingredients': [
                {'item': 'minecraft:wheat_seeds'},
                {'item': 'minecraft:golden_apple'},
            ],
            'unlock': [{'item': 'minecraft:golden_apple'}],
            'result': {'item': 'goku:senzu_bean', 'count': 3},
        },
    })
    print('items written')


if __name__ == '__main__':
    main()

"""Single source of truth for weapons / ammo / attachments. Writes BP item JSON files and the
JS data module used by the gameplay scripts, so stats never drift apart."""
import json, os
BP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_BP')
ITEM_FORMAT = '1.20.80'

def W(name, ammo, damage, mag, fire, auto, rng, reload, spread, dur, knock, sound, desc, **kw):
    d = dict(name=name, kind='gun', ammo=ammo, damage=damage, mag=mag, fire=fire, auto=auto, range=rng, reload=reload,
             spread=spread, durability=dur, knock=knock, sound=sound, desc=desc, pellets=1, pierce=0, tracer='bullet',
             move=1.0, melee=2, fireSeconds=0, charge=0, projectile=None, volume=1.0)
    d.update(kw); return d

WEAPONS = {
    'service_pistol': W('Service Pistol', 'light_magazine', 4, 12, 5, False, 32, 24, 1.0, 600, 0.15, 'shot_pistol', 'Standard-issue sidearm. Dependable and quick to reload.'),
    'wasp_smg': W('Wasp SMG', 'light_magazine', 3, 30, 2, True, 24, 36, 3.5, 800, 0.1, 'shot_smg', 'Compact automatic weapon. Shreds at close range.', move=0.95, volume=0.8),
    'ranger_rifle': W('Ranger Assault Rifle', 'rifle_magazine', 5, 30, 3, True, 48, 40, 2.0, 900, 0.2, 'shot_rifle', 'Versatile automatic rifle for mid-range firefights.', move=0.85),
    'breacher_shotgun': W('Breacher Shotgun', 'shell_box', 3, 6, 16, False, 14, 50, 9.0, 500, 1.0, 'shot_shotgun', 'Seven-pellet spread. Devastating up close.', pellets=7, move=0.9),
    'longshot_dmr': W('Longshot DMR', 'rifle_magazine', 11, 8, 12, False, 96, 44, 0.3, 700, 0.4, 'shot_dmr', 'Precision marksman rifle. Reach out and touch something.', move=0.8),
    'bulwark_lmg': W('Bulwark LMG', 'rifle_magazine', 4, 100, 2, True, 44, 100, 4.5, 1500, 0.2, 'shot_lmg', 'Belt-fed suppression. Slow to reload, endless to fire.', move=0.7),
    'pulse_rifle': W('Pulse Rifle', 'energy_cell', 5, 40, 3, True, 64, 36, 1.5, 1200, 0.1, 'shot_pulse', 'Experimental energy rifle. Fast, accurate pulses of light.', tracer='energy', move=0.9),
    'plasma_pistol': W('Plasma Pistol', 'energy_cell', 7, 14, 8, False, 28, 30, 1.0, 700, 0.3, 'shot_plasma', 'Superheated plasma bolts that ignite the target.', tracer='plasma', fireSeconds=2),
    'railgun': W('Railgun', 'rail_slug', 22, 1, 30, False, 128, 50, 0.0, 300, 1.5, 'shot_rail', 'Magnetic accelerator. One slug, straight through everything.', tracer='rail', pierce=5, charge=12, move=0.75),
    'thumper_launcher': W('Thumper Launcher', 'rocket_ammo', 0, 1, 30, False, 0, 70, 0.0, 200, 0.0, 'rocket_launch', 'Shoulder-fired rocket. Big boom, no block damage.', projectile='bunker:rocket', move=0.7),
    'combat_knife': dict(name='Combat Knife', kind='melee', damage=7, durability=600, desc='Fast, silent, and always loaded.'),
    'stun_baton': dict(name='Stun Baton', kind='melee', damage=5, durability=400, desc='Electrified baton. Slows and weakens on hit.', effect=True),
    'frag_grenade': dict(name='Frag Grenade', kind='throwable', entity='bunker:grenade', stack=16, desc='Pull pin, throw, take cover. 2.5 second fuse.'),
    'stun_grenade': dict(name='Stun Grenade', kind='throwable', entity='bunker:stun_charge', stack=16, desc='Blinds and slows everything near the flash.'),
}
AMMO = {
    'light_magazine': dict(name='Light Magazine', stack=16, desc='Reloads the Service Pistol and Wasp SMG.'),
    'rifle_magazine': dict(name='Rifle Magazine', stack=16, desc='Reloads the Ranger, Longshot and Bulwark.'),
    'shell_box': dict(name='Shell Box', stack=16, desc='Reloads the Breacher Shotgun.'),
    'energy_cell': dict(name='Energy Cell', stack=16, desc='Powers the Pulse Rifle and Plasma Pistol.'),
    'rail_slug': dict(name='Rail Slug', stack=16, desc='Tungsten slug for the Railgun.'),
    'rocket_ammo': dict(name='Thumper Rocket', stack=8, desc='Rocket for the Thumper Launcher.'),
}
ATTACHMENTS = {
    'suppressor': dict(name='Suppressor', slot='muzzle', desc='Quieter shots, slightly tighter spread, -10% range.', mods=dict(volume=0.3, spread=0.9, range=0.9)),
    'heavy_barrel': dict(name='Heavy Barrel', slot='muzzle', desc='+15% damage, +25% range, slower fire.', mods=dict(damage=1.15, range=1.25, fire=1.15)),
    'extended_magazine': dict(name='Extended Magazine', slot='magazine', desc='+50% magazine size, +15% reload time.', mods=dict(mag=1.5, reload=1.15)),
    'reflex_sight': dict(name='Reflex Sight', slot='optic', desc='-40% spread.', mods=dict(spread=0.6)),
    'foregrip': dict(name='Foregrip', slot='underbarrel', desc='-25% spread, +20% knockback.', mods=dict(spread=0.75, knock=1.2)),
    'laser_sight': dict(name='Laser Sight', slot='underbarrel', desc='-50% spread. Shows a laser dot where you aim.', mods=dict(spread=0.5), laser=True),
}
MISC = {
    'steel_plate': dict(name='Steel Plate', stack=64, desc='Reinforced plating. Repairs weapons.'),
    'weapon_parts': dict(name='Weapon Parts', stack=64, desc='Springs, bolts and barrels for crafting weapons.'),
    'ammo_box': dict(name='Ammo Box', stack=16, desc='Use to unpack magazines of any type.'),
    'bunker_blueprint': dict(name='Bunker Blueprint', stack=1, desc='Use to construct an underground bunker below you.'),
    'field_terminal': dict(name='Field Terminal', stack=1, desc='Opens the Armory interface anywhere.'),
    'medkit': dict(name='Medkit', stack=8, desc='Hold to use. Restores health and cures poison.'),
    'bunker_key': dict(name='Bunker Keycard', stack=1, desc='Opens blast doors during a lockdown.'),
}
ALL_NAMES = {}
for group in (WEAPONS, AMMO, ATTACHMENTS, MISC):
    for k, v in group.items():
        ALL_NAMES[k] = v['name']

def item_json(ident, stack, components, category, group=None):
    desc = {'identifier': 'bunker:' + ident, 'menu_category': {'category': category}}
    if group: desc['menu_category']['group'] = group
    comps = {
        'minecraft:icon': {'textures': {'default': 'bunker_' + ident}},
        'minecraft:display_name': {'value': 'item.bunker:%s.name' % ident},
        'minecraft:max_stack_size': stack,
    }
    comps.update(components)
    return {'format_version': ITEM_FORMAT, 'minecraft:item': {'description': desc, 'components': comps}}

def build():
    out = os.path.join(BP, 'items'); os.makedirs(out, exist_ok=True)
    files = {}
    for k, w in WEAPONS.items():
        if w['kind'] == 'gun':
            cd = max(0.05, w['fire'] / 20.0) if not w['auto'] else 0.05
            comps = {
                'minecraft:hand_equipped': True,
                'minecraft:durability': {'max_durability': w['durability']},
                'minecraft:damage': w['melee'],
                'minecraft:cooldown': {'category': 'bunker_' + k, 'duration': round(cd, 3)},
                'minecraft:use_modifiers': {'use_duration': 3600, 'movement_modifier': w['move']},
                'minecraft:repairable': {'repair_items': [{'items': ['bunker:steel_plate'], 'repair_amount': max(50, w['durability'] // 4)}]},
            }
            files[k] = item_json(k, 1, comps, 'equipment', 'itemGroup.name.sword')
        elif w['kind'] == 'melee':
            comps = {
                'minecraft:hand_equipped': True,
                'minecraft:durability': {'max_durability': w['durability']},
                'minecraft:damage': w['damage'],
                'minecraft:enchantable': {'slot': 'sword', 'value': 10},
                'minecraft:repairable': {'repair_items': [{'items': ['bunker:steel_plate'], 'repair_amount': 150}]},
            }
            files[k] = item_json(k, 1, comps, 'equipment', 'itemGroup.name.sword')
        else:  # throwable
            comps = {
                'minecraft:projectile': {'projectile_entity': w['entity'], 'minimum_critical_power': 1.0},
                'minecraft:throwable': {'do_swing_animation': True, 'launch_power_scale': 1.0, 'max_draw_duration': 0.0, 'min_draw_duration': 0.0, 'scale_power_by_draw_duration': False},
                'minecraft:cooldown': {'category': 'bunker_grenade', 'duration': 0.8},
            }
            files[k] = item_json(k, w['stack'], comps, 'equipment', 'itemGroup.name.sword')
    for k, a in AMMO.items():
        files[k] = item_json(k, a['stack'], {}, 'items')
    for k, a in ATTACHMENTS.items():
        files[k] = item_json(k, 1, {}, 'equipment')
    for k, m in MISC.items():
        comps = {}
        if k == 'medkit':
            comps = {'minecraft:food': {'nutrition': 0, 'saturation_modifier': 'poor', 'can_always_eat': True},
                     'minecraft:use_modifiers': {'use_duration': 1.6, 'movement_modifier': 0.5},
                     'minecraft:use_animation': 'drink'}
        files[k] = item_json(k, m['stack'], comps, 'items')
    for k, j in files.items():
        with open(os.path.join(out, k + '.json'), 'w') as f:
            json.dump(j, f, indent=2)
    # JS data module
    js = '// AUTO-GENERATED by tools/gen_bp_items.py - edit the Python tables, not this file.\n'
    js += 'export const WEAPONS = %s;\n' % json.dumps(WEAPONS, indent=1)
    js += 'export const AMMO = %s;\n' % json.dumps(AMMO, indent=1)
    js += 'export const ATTACHMENTS = %s;\n' % json.dumps(ATTACHMENTS, indent=1)
    js += 'export const MISC = %s;\n' % json.dumps(MISC, indent=1)
    os.makedirs(os.path.join(BP, 'scripts', 'data'), exist_ok=True)
    with open(os.path.join(BP, 'scripts', 'data', 'weapons_data.js'), 'w') as f:
        f.write(js)
    print('wrote', len(files), 'item definitions + weapons_data.js')

if __name__ == '__main__':
    build()

#!/usr/bin/env python3
"""Generates every texture, model, particle and pose of the Goku Ultra Instinct add-on.

Run from anywhere:  python3 tools/generate_assets.py
Output goes straight into GokuUltraInstinct_RP/ (and the BP pack icon).
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from entities import build_nimbus, nimbus_files  # noqa: E402
from icons import ICONS  # noqa: E402
from outfit import build_hair, build_outfit  # noqa: E402
from pixelkit import rgba, save_png, write_json  # noqa: E402
from preview import collect_quads, preview_player_skin, render  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, 'GokuUltraInstinct_RP')
BP = os.path.join(ROOT, 'GokuUltraInstinct_BP')


def rp(*parts):
    return os.path.join(RP, *parts)


# ---------------------------------------------------------------------------
# Items: icons + item_texture.json
# ---------------------------------------------------------------------------
def write_item_textures():
    data = {}
    for name, make in ICONS.items():
        save_png(make(), rp('textures', 'items', 'goku', name + '.png'))
        data['goku_' + name] = {'textures': 'textures/items/goku/' + name}
    write_json(rp('textures', 'item_texture.json'), {
        'resource_pack_name': 'goku_ultra_instinct',
        'texture_name': 'atlas.items',
        'texture_data': data,
    })


# ---------------------------------------------------------------------------
# Outfit: geometry, textures and attachables
# ---------------------------------------------------------------------------
ARMOR = {
    # item id: (geometry, texture, layer variable to hide, vanilla armor offset animation)
    'goku_hair': ('geometry.goku.hair', 'textures/models/armor/goku_hair_black', 'helmet', 'helmet'),
    'ui_hair': ('geometry.goku.hair', 'textures/models/armor/goku_hair_ui', 'helmet', 'helmet'),
    'gi_top': ('geometry.goku.gi_top', 'textures/models/armor/goku_gi', 'chest', 'chestplate'),
    'gi_pants': ('geometry.goku.gi_pants', 'textures/models/armor/goku_gi', 'leg', 'leggings'),
    'gi_boots': ('geometry.goku.gi_boots', 'textures/models/armor/goku_gi', 'boot', 'boots'),
}


def write_outfit():
    atlas, top, pants, boots = build_outfit()
    save_png(atlas.img, rp('textures', 'models', 'armor', 'goku_gi.png'))
    write_json(rp('models', 'entity', 'goku_gi_top.geo.json'), top.to_json())
    write_json(rp('models', 'entity', 'goku_gi_pants.geo.json'), pants.to_json())
    write_json(rp('models', 'entity', 'goku_gi_boots.geo.json'), boots.to_json())

    ui_atlas, ui_hair = build_hair('ui')
    black_atlas, black_hair = build_hair('black')
    assert ui_hair.to_json() == black_hair.to_json(), 'hair UVs must match between styles'
    save_png(ui_atlas.img, rp('textures', 'models', 'armor', 'goku_hair_ui.png'))
    save_png(black_atlas.img, rp('textures', 'models', 'armor', 'goku_hair_black.png'))
    write_json(rp('models', 'entity', 'goku_hair.geo.json'), ui_hair.to_json())

    for item, (geo, tex, layer, offset) in ARMOR.items():
        description = {
            'identifier': 'goku:' + item,
            'materials': {'default': 'armor', 'enchanted': 'armor_enchanted'},
            'textures': {
                'default': tex,
                'enchanted': 'textures/misc/enchanted_actor_glint',
            },
            'geometry': {'default': geo},
            'scripts': {'parent_setup': 'variable.%s_layer_visible = 0.0;' % layer},
            'render_controllers': ['controller.render.armor'],
        }
        write_json(rp('attachables', item + '.json'),
                   {'format_version': '1.10.0', 'minecraft:attachable': {'description': description}})
        # like vanilla armor: on players, follow the body-shape offsets of character-creator skins
        player = dict(description)
        player['identifier'] = 'goku:%s.player' % item
        player['item'] = {'goku:' + item: "query.owner_identifier == 'minecraft:player'"}
        player['scripts'] = dict(description['scripts'], animate=['offset'])
        player['animations'] = {'offset': 'animation.armor.%s.offset' % offset}
        write_json(rp('attachables', item + '.player.json'),
                   {'format_version': '1.10.0', 'minecraft:attachable': {'description': player}})
    return (atlas, top, pants, boots), (ui_atlas, ui_hair), (black_atlas, black_hair)


# ---------------------------------------------------------------------------
# Particles
# ---------------------------------------------------------------------------
PARTICLE_COLORS = {
    'blue': (0.35, 0.78, 1.0),
    'silver': (0.86, 0.91, 1.0),
    'gold': (1.0, 0.78, 0.22),
    'violet': (0.78, 0.6, 1.0),
    'red': (1.0, 0.32, 0.25),
}
UV = {'orb': (0, 0), 'ring': (16, 0), 'star': (32, 0), 'flame': (48, 0)}


def particle_texture():
    size = 64
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    def put(ox, oy, fn):
        for y in range(16):
            for x in range(16):
                dx, dy = (x + 0.5 - 8) / 8, (y + 0.5 - 8) / 8
                a = max(0.0, min(1.0, fn(dx, dy)))
                v = int(255 * a)
                img.putpixel((ox + x, oy + y), (v, v, v, v))

    put(0, 0, lambda dx, dy: (1 - min(1, dx * dx + dy * dy)) ** 1.6)
    put(16, 0, lambda dx, dy: math.exp(-((math.hypot(dx, dy) - 0.72) / 0.14) ** 2))
    put(32, 0, lambda dx, dy: max(math.exp(-abs(dx) * 9) * (1 - abs(dy)) ** 2,
                                  math.exp(-abs(dy) * 9) * (1 - abs(dx)) ** 2) * 1.4
        + 0.6 * max(0, 1 - math.hypot(dx, dy) * 3))
    put(48, 0, lambda dx, dy: (1 - min(1, (dx * 1.6) ** 2 + ((dy + 0.25) * 1.1) ** 2)) ** 1.3
        * (1 if dy > -0.95 else 0))
    return img


def _base(identifier):
    return {
        'format_version': '1.10.0',
        'particle_effect': {
            'description': {
                'identifier': identifier,
                'basic_render_parameters': {
                    'material': 'particles_add',
                    'texture': 'textures/particle/goku_particles',
                },
            },
            'components': {
                'minecraft:emitter_initialization': {
                    'creation_expression': 'variable.size = variable.size > 0 ? variable.size : 1.0;'
                },
            },
        },
    }


def _billboard(size_expr, uv, facing='lookat_xyz'):
    return {
        'size': [size_expr, size_expr],
        'facing_camera_mode': facing,
        'uv': {'texture_width': 64, 'texture_height': 64, 'uv': list(UV[uv]), 'uv_size': [16, 16]},
    }


def make_particle(kind, color):
    r, g, b = PARTICLE_COLORS[color]
    p = _base('goku:%s_%s' % (kind, color))
    c = p['particle_effect']['components']
    fade = '1 - variable.particle_age / variable.particle_lifetime'
    c['minecraft:emitter_lifetime_once'] = {}
    c['minecraft:particle_appearance_tinting'] = {'color': [r, g, b, 1.0]}
    if kind == 'orb':
        # one glowing ball that lives two ticks; re-spawn it every tick to keep it visible
        c['minecraft:emitter_rate_instant'] = {'num_particles': 1}
        c['minecraft:emitter_shape_point'] = {}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 0.1}
        c['minecraft:particle_appearance_billboard'] = _billboard('variable.size * 0.5', 'orb')
    elif kind == 'trail':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 1}
        c['minecraft:emitter_shape_point'] = {}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 0.35}
        c['minecraft:particle_appearance_billboard'] = _billboard('variable.size * 0.5 * (%s)' % fade, 'orb')
        c['minecraft:particle_appearance_tinting'] = {'color': [r, g, b, fade]}
    elif kind == 'burst':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 36}
        c['minecraft:emitter_shape_sphere'] = {'radius': '0.2 * variable.size', 'direction': 'outwards'}
        c['minecraft:particle_initial_speed'] = 'Math.random(3, 10) * variable.size'
        c['minecraft:particle_motion_dynamic'] = {'linear_drag_coefficient': 3.0}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 'Math.random(0.35, 0.8)'}
        c['minecraft:particle_appearance_billboard'] = _billboard('0.05 + 0.2 * (%s)' % fade, 'orb')
    elif kind == 'ring':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 1}
        c['minecraft:emitter_shape_point'] = {}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 0.45}
        c['minecraft:particle_appearance_billboard'] = _billboard(
            'variable.size * 0.5 * (0.15 + 0.85 * variable.particle_age / variable.particle_lifetime)',
            'ring', facing='emitter_transform_xz')
        c['minecraft:particle_appearance_tinting'] = {'color': [r, g, b, fade]}
    elif kind == 'aura':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 7}
        c['minecraft:emitter_shape_disc'] = {
            'radius': '0.45 * variable.size', 'surface_only': True,
            'plane_normal': [0, 1, 0], 'direction': [0, 1, 0],
        }
        c['minecraft:particle_initial_speed'] = 'Math.random(1.2, 2.6)'
        c['minecraft:particle_motion_dynamic'] = {'linear_acceleration': [0, 2.0, 0], 'linear_drag_coefficient': 1.2}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 'Math.random(0.4, 0.75)'}
        c['minecraft:particle_appearance_billboard'] = _billboard('0.22 * (%s) + 0.04' % fade, 'flame', facing='lookat_y')
        c['minecraft:particle_appearance_tinting'] = {'color': [r, g, b, fade]}
    elif kind == 'spark':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 5}
        c['minecraft:emitter_shape_sphere'] = {'radius': 'variable.size', 'direction': 'outwards'}
        c['minecraft:particle_initial_speed'] = 0.6
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 'Math.random(0.25, 0.55)'}
        c['minecraft:particle_appearance_billboard'] = _billboard('0.16 * (%s) + 0.03' % fade, 'star')
    elif kind == 'beam':
        # a whole beam segment from one emitter: particles scattered along
        # variable.direction * variable.length (both sent by the script)
        c['minecraft:emitter_initialization'] = {
            'creation_expression': 'variable.size = variable.size > 0 ? variable.size : 1.0;'
                                   'variable.length = variable.length > 0 ? variable.length : 1.0;'
        }
        c['minecraft:emitter_rate_instant'] = {'num_particles': 'math.ceil(variable.length * 1.4)'}
        c['minecraft:emitter_shape_point'] = {'offset': [
            'variable.direction.x * variable.length * variable.particle_random_1',
            'variable.direction.y * variable.length * variable.particle_random_1',
            'variable.direction.z * variable.length * variable.particle_random_1',
        ]}
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 0.1}
        c['minecraft:particle_appearance_billboard'] = _billboard('variable.size * 0.5', 'orb')
    elif kind == 'gather':
        c['minecraft:emitter_rate_instant'] = {'num_particles': 10}
        c['minecraft:emitter_shape_sphere'] = {
            'radius': '2.5 * variable.size', 'surface_only': True, 'direction': 'inwards'}
        c['minecraft:particle_initial_speed'] = '5.0 * variable.size'
        c['minecraft:particle_lifetime_expression'] = {'max_lifetime': 0.45}
        c['minecraft:particle_appearance_billboard'] = _billboard('0.12', 'orb')
    else:
        raise ValueError(kind)
    return p


def write_particles():
    save_png(particle_texture(), rp('textures', 'particle', 'goku_particles.png'))
    count = 0
    for kind in ('orb', 'trail', 'burst', 'ring', 'aura', 'spark', 'gather', 'beam'):
        for color in PARTICLE_COLORS:
            write_json(rp('particles', 'goku_%s_%s.json' % (kind, color)), make_particle(kind, color))
            count += 1
    return count


# ---------------------------------------------------------------------------
# Player poses (played from scripts with Entity.playAnimation)
# ---------------------------------------------------------------------------
POSES = {
    # Kamehameha: cup both hands at the right hip, then thrust forward.
    'kamehameha_charge': {'length': 1.6, 'hold': True, 'bones': {
        'rightArm': [(0.0, (0, 0, 0)), (0.3, (35, 0, 12))],
        'leftArm': [(0.0, (0, 0, 0)), (0.3, (35, 0, 42))],
    }},
    'kamehameha_fire': {'length': 1.6, 'hold': True, 'bones': {
        'rightArm': [(0.0, (35, 0, 12)), (0.12, (-88, 14, 0))],
        'leftArm': [(0.0, (35, 0, 42)), (0.12, (-88, -14, 0))],
    }},
    # Spirit Bomb: both arms straight up.
    'spirit_bomb': {'length': 3.0, 'hold': True, 'bones': {
        'rightArm': [(0.0, (0, 0, 0)), (0.35, (180, 0, -14))],
        'leftArm': [(0.0, (0, 0, 0)), (0.35, (180, 0, 14))],
    }},
    'spirit_bomb_throw': {'length': 0.6, 'hold': False, 'bones': {
        'rightArm': [(0.0, (180, 0, -14)), (0.25, (-80, 10, 0)), (0.6, (-40, 0, 0))],
        'leftArm': [(0.0, (180, 0, 14)), (0.25, (-80, -10, 0)), (0.6, (-40, 0, 0))],
    }},
    # Instant Transmission: two fingers to the forehead.
    'instant_transmission': {'length': 0.7, 'hold': False, 'bones': {
        'rightArm': [(0.0, (0, 0, 0)), (0.15, (-150, 32, 0)), (0.55, (-150, 32, 0)), (0.7, (0, 0, 0))],
    }},
    # Punches and blasts.
    'punch': {'length': 0.6, 'hold': False, 'bones': {
        'rightArm': [(0.0, (0, 0, 0)), (0.08, (-92, 8, 0)), (0.45, (-92, 8, 0)), (0.6, (0, 0, 0))],
    }},
    'blast_right': {'length': 0.35, 'hold': False, 'bones': {
        'rightArm': [(0.0, (-20, 0, 0)), (0.06, (-90, 6, 0)), (0.35, (-20, 0, 0))],
    }},
    'blast_left': {'length': 0.35, 'hold': False, 'bones': {
        'leftArm': [(0.0, (-20, 0, 0)), (0.06, (-90, -6, 0)), (0.35, (-20, 0, 0))],
    }},
    # Transformation: fists clenched, arms pushed out to the sides.
    'power_up': {'length': 1.5, 'hold': False, 'bones': {
        'rightArm': [(0.0, (0, 0, 0)), (0.2, (12, 0, 28)), (1.2, (12, 0, 28)), (1.5, (0, 0, 0))],
        'leftArm': [(0.0, (0, 0, 0)), (0.2, (12, 0, -28)), (1.2, (12, 0, -28)), (1.5, (0, 0, 0))],
        'head': [(0.0, (0, 0, 0)), (0.2, (-12, 0, 0)), (1.2, (-12, 0, 0)), (1.5, (0, 0, 0))],
    }},
}


def write_animations():
    anims = {}
    for name, pose in POSES.items():
        bones = {}
        for bone, keys in pose['bones'].items():
            bones[bone] = {'rotation': {('%.2f' % t): list(rot) for t, rot in keys}}
        anim = {'animation_length': pose['length'], 'bones': bones}
        if pose['hold']:
            anim['loop'] = 'hold_on_last_frame'
        anims['animation.goku.' + name] = anim
    write_json(rp('animations', 'goku_poses.animation.json'), {'format_version': '1.8.0', 'animations': anims})


# ---------------------------------------------------------------------------
# Pack icons and README pictures
# ---------------------------------------------------------------------------
def aura_background(size, inner, outer):
    img = Image.new('RGBA', (size, size), outer)
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - size / 2, y - size * 0.55) / (size * 0.62)
            t = max(0.0, min(1.0, d))
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(4))
    return img


def write_pack_icons(outfit, ui_hair_pack):
    atlas, top, pants, boots = outfit
    hair_atlas, hair = ui_hair_pack
    pgeo, pskin = preview_player_skin()
    quads = collect_quads(pgeo, pskin)
    for m in (top, pants, boots):
        quads += collect_quads(m.to_json(), atlas.img)
    quads += collect_quads(hair.to_json(), hair_atlas.img)

    # pack icon: Ultra Instinct Goku's head on a silver aura
    head = render(quads, yaw=28, pitch=12, scale=14, size=(512, 512), center=(0, 29, 0))
    icon = aura_background(512, rgba('#FFFFFF'), rgba('#1B2A5E'))
    glow = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    mask = head.split()[3].filter(ImageFilter.GaussianBlur(14))
    glow.paste((190, 215, 255, 255), (0, 0), mask)
    icon.alpha_composite(glow)
    icon.alpha_composite(head)
    icon = icon.resize((256, 256), Image.LANCZOS)
    save_png(icon, rp('pack_icon.png'))
    save_png(icon, os.path.join(BP, 'pack_icon.png'))

    # full-body preview for the README
    views = [render(quads, yaw=y, pitch=p, scale=9, size=(270, 390), center=(0, 19, 0))
             for (y, p) in ((0, 0), (35, 8), (180, 0))]
    sheet = aura_background(810, rgba('#DCE6FF'), rgba('#22305F')).resize((810, 390))
    for i, v in enumerate(views):
        sheet.alpha_composite(v, (i * 270, 0))
    save_png(sheet, os.path.join(ROOT, 'docs', 'outfit_preview.png'))

    cell = 72
    names = list(ICONS)
    strip = Image.new('RGBA', (cell * len(names), cell), (139, 139, 139, 255))
    for i, n in enumerate(names):
        strip.alpha_composite(ICONS[n]().resize((64, 64), Image.NEAREST), (i * cell + 4, 4))
    save_png(strip, os.path.join(ROOT, 'docs', 'items_preview.png'))


def write_nimbus():
    atlas, model = build_nimbus()
    save_png(atlas.img, rp('textures', 'entity', 'goku', 'nimbus.png'))
    write_json(rp('models', 'entity', 'goku_nimbus.geo.json'), model.to_json())
    client, controller, animation, behavior = nimbus_files()
    write_json(rp('entity', 'goku_nimbus.entity.json'), client)
    write_json(rp('render_controllers', 'goku_nimbus.render_controllers.json'), controller)
    write_json(rp('animations', 'goku_nimbus.animation.json'), animation)
    write_json(os.path.join(BP, 'entities', 'goku_nimbus.json'), behavior)
    return atlas, model


LANG = [
    ('entity.goku:nimbus.name', 'Flying Nimbus'),
    ('item.goku:ultra_instinct.name', 'Ultra Instinct'),
    ('item.goku:kamehameha.name', 'Kamehameha'),
    ('item.goku:ki_blast.name', 'Ki Blast'),
    ('item.goku:spirit_bomb.name', 'Spirit Bomb'),
    ('item.goku:instant_transmission.name', 'Instant Transmission'),
    ('item.goku:dragon_fist.name', 'Dragon Fist'),
    ('item.goku:power_pole.name', 'Power Pole'),
    ('item.goku:flying_nimbus.name', 'Flying Nimbus'),
    ('item.goku:senzu_bean.name', 'Senzu Bean'),
    ('item.goku:dragon_radar.name', 'Dragon Radar'),
    ('item.goku:goku_hair.name', "Goku's Hair"),
    ('item.goku:ui_hair.name', 'Ultra Instinct Hair'),
    ('item.goku:gi_top.name', "Goku's Gi"),
    ('item.goku:gi_pants.name', "Goku's Gi Pants"),
    ('item.goku:gi_boots.name', "Goku's Boots"),
]


def write_texts():
    os.makedirs(rp('texts'), exist_ok=True)
    with open(rp('texts', 'en_US.lang'), 'w', encoding='utf-8') as f:
        for key, value in LANG:
            f.write('%s=%s\n' % (key, value))
    write_json(rp('texts', 'languages.json'), ['en_US'])


def main():
    write_texts()
    write_item_textures()
    write_nimbus()
    outfit, ui_pack, _ = write_outfit()
    n = write_particles()
    write_animations()
    write_pack_icons(outfit, ui_pack)
    print('generated %d icons, %d particles, %d poses' % (len(ICONS), n, len(POSES)))


if __name__ == '__main__':
    main()

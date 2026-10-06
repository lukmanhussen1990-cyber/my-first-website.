"""Flying Nimbus: a rideable golden cloud steered by scripts."""
import random

from pixelkit import Atlas, Model, rgba

CLOUD = [rgba('#B98A10'), rgba('#E5B420'), rgba('#FFD43B'), rgba('#FFE680'), rgba('#FFF6CC')]


def _cloud_painter(seed, top_bias=0):
    def paint(img, rects, size):
        rnd = random.Random(seed)
        for face, (x, y, w, h) in rects.items():
            for j in range(h):
                for i in range(w):
                    if face == 'up':
                        t = 3 + (1 if rnd.random() < 0.25 else 0)
                    elif face == 'down':
                        t = 1 if rnd.random() < 0.7 else 0
                    else:
                        # lighter at the top of each puff, darker underneath
                        t = 3 - int(3 * j / max(1, h - 1)) + top_bias
                        if rnd.random() < 0.15:
                            t += 1
                    img.putpixel((x + i, y + j), CLOUD[max(0, min(4, t))])
    return paint


def build_nimbus():
    atlas = Atlas(128, 64)
    m = Model('geometry.goku.nimbus', atlas, bounds=(3, 2, (0, 0.5, 0)))
    m.bone('root', (0, 0, 0))
    m.bone('cloud', (0, 4, 0), parent='root')
    puffs = [
        ((-9, 0, -7), (18, 5, 14)),
        ((-11, 1, -5), (4, 4, 10)),
        ((7, 1, -5), (4, 4, 10)),
        ((-6, 4, -5), (7, 3, 8)),
        ((0, 4, -4), (6, 4, 8)),
        ((-4, 5, 1), (6, 3, 6)),
        ((-7, 0, 6), (8, 4, 4)),
        ((1, 0, 6), (6, 3, 3)),
        ((8, 2, 3), (3, 3, 4)),
        ((-6, 0, -10), (10, 4, 3)),
    ]
    for n, (origin, size) in enumerate(puffs):
        m.cube('cloud', origin, size, _cloud_painter(100 + n))
    return atlas, m


def nimbus_files():
    """Returns {relative path: json} for the RP and BP side of the nimbus."""
    client = {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': 'goku:nimbus',
                'materials': {'default': 'entity_alphatest'},
                'textures': {'default': 'textures/entity/goku/nimbus'},
                'geometry': {'default': 'geometry.goku.nimbus'},
                'render_controllers': ['controller.render.goku_nimbus'],
                'animations': {'bob': 'animation.goku.nimbus.bob'},
                'scripts': {'animate': ['bob']},
            }
        }
    }
    render_controller = {
        'format_version': '1.8.0',
        'render_controllers': {
            'controller.render.goku_nimbus': {
                'geometry': 'Geometry.default',
                'materials': [{'*': 'Material.default'}],
                'textures': ['Texture.default'],
            }
        }
    }
    animation = {
        'format_version': '1.8.0',
        'animations': {
            'animation.goku.nimbus.bob': {
                'loop': True,
                'bones': {
                    'cloud': {
                        'position': [0, 'math.sin(query.life_time * 120) * 0.6', 0],
                        'rotation': [0, 0, 'math.sin(query.life_time * 90) * 2'],
                    }
                }
            }
        }
    }
    behavior = {
        'format_version': '1.20.80',
        'minecraft:entity': {
            'description': {
                'identifier': 'goku:nimbus',
                'is_spawnable': False,
                'is_summonable': True,
                'is_experimental': False,
            },
            'components': {
                'minecraft:type_family': {'family': ['goku_nimbus', 'inanimate']},
                'minecraft:collision_box': {'width': 1.4, 'height': 0.6},
                'minecraft:physics': {'has_gravity': False, 'has_collision': True},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:knockback_resistance': {'value': 1.0},
                'minecraft:health': {'value': 20, 'max': 20},
                'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': False}]},
                'minecraft:fire_immune': True,
                'minecraft:breathable': {'total_supply': 15, 'suffocate_time': 0, 'breathes_water': True},
                'minecraft:rideable': {
                    'seat_count': 1,
                    'family_types': ['player'],
                    'interact_text': 'action.interact.ride.horse',
                    'crouching_skip_interact': True,
                    'seats': [{'position': [0.0, 0.4, 0.0]}],
                },
            },
        }
    }
    return client, render_controller, animation, behavior

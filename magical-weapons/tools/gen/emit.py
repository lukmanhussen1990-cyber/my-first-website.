"""Emit Bedrock JSON (attachable, animations, item, recipe, manifests...) from weapon specs."""
import json
import os

from .anim import timeline_animation, _fmt, _num
from . import kinematics as K

NS = 'mw'

# Fixed UUIDs so rebuilds produce stable packs (Minecraft updates packs by UUID+version).
UUID = {
    'bp_header': '5b8c1d0e-7a34-4c6f-9d21-3e6b0a9f4c11',
    'bp_data':   '9f2a7c54-1b8e-4d03-a6c9-72d5e8b13f20',
    'bp_script': 'c3e19a6d-48f7-4b52-8e0a-1d9c6f27b834',
    'rp_header': 'a47d3e92-6c1b-4f85-b3d8-0e5a29c7f146',
    'rp_res':    'e0b85f13-9d27-4a6c-8f41-b7c3a1d9052e',
}
SERVER_MODULE_VERSION = '1.11.0'   # stable @minecraft/server for 1.21.0.x


def dump(obj, path, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False)
        f.write('\n')


# ------------------------------------------------------------------ manifests
def behavior_manifest(version):
    return {
        'format_version': 2,
        'header': {
            'name': 'Magical Weapons [Behavior]',
            'description': 'Seven magical weapons with spells, cooldowns and realistic animations.',
            'uuid': UUID['bp_header'],
            'version': version,
            'min_engine_version': [1, 21, 0],
        },
        'modules': [
            {'type': 'data', 'uuid': UUID['bp_data'], 'version': version, 'description': 'Magical Weapons data'},
            {'type': 'script', 'language': 'javascript', 'uuid': UUID['bp_script'], 'version': version,
             'entry': 'scripts/main.js', 'description': 'Magical Weapons spells'},
        ],
        'dependencies': [
            {'uuid': UUID['rp_header'], 'version': version},
            {'module_name': '@minecraft/server', 'version': SERVER_MODULE_VERSION},
        ],
    }


def resource_manifest(version):
    return {
        'format_version': 2,
        'header': {
            'name': 'Magical Weapons [Resources]',
            'description': '3D weapon models, animations and effects for Magical Weapons.',
            'uuid': UUID['rp_header'],
            'version': version,
            'min_engine_version': [1, 21, 0],
        },
        'modules': [
            {'type': 'resources', 'uuid': UUID['rp_res'], 'version': version, 'description': 'Magical Weapons resources'},
        ],
    }


# ------------------------------------------------------------------ render controllers
def render_controllers():
    return {
        'format_version': '1.10',
        'render_controllers': {
            'controller.render.mw_solid': {
                'geometry': 'geometry.default',
                'materials': [{'*': 'variable.is_enchanted ? material.enchanted : material.default'}],
                'textures': ['texture.default', 'texture.enchanted'],
                'part_visibility': [{'*': True}, {'glow*': False}],
            },
            'controller.render.mw_glow': {
                'geometry': 'geometry.default',
                'materials': [{'*': 'material.default'}],
                'textures': ['texture.default'],
                'part_visibility': [{'*': False}, {'glow*': True}],
                'ignore_lighting': True,
            },
        },
    }


# ------------------------------------------------------------------ attachable
def cat(spec):
    return '%s_%s' % (NS, spec['id'])


def attachable(spec):
    wid = spec['id']
    c = cat(spec)
    total = spec['cooldown']
    clen = spec['cast_len']
    pre = [
        'v.mw_swing = c.owning_entity->v.attack_time;',
        "v.mw_cd = math.max(q.cooldown_time_remaining('%s'), q.cooldown_time_remaining('slot.weapon.mainhand'));" % c,
        'v.mw_cast_t = %s - v.mw_cd;' % _n(total),
        'v.mw_casting = v.mw_cd > 0.0 && v.mw_cast_t < %s;' % _n(clen),
        'v.mw_move = math.clamp(q.modified_move_speed, 0.0, 1.5);',
    ]
    anims = {
        'hold_first_person': 'animation.mw_%s.hold_first_person' % wid,
        'hold_third_person': 'animation.mw_%s.hold_third_person' % wid,
        'flicker': 'animation.mw_%s.flicker' % wid,
        'swing_first_person': 'animation.mw_%s.swing_first_person' % wid,
        'swing_third_person': 'animation.mw_%s.swing_third_person' % wid,
        'cast_first_person': 'animation.mw_%s.cast_first_person' % wid,
        'cast_third_person': 'animation.mw_%s.cast_third_person' % wid,
    }
    has_flicker = bool(spec.get('flicker') or spec.get('spin'))
    if not has_flicker:
        del anims['flicker']
    animate = ([] if not has_flicker else ['flicker']) + [
        {'hold_first_person': 'c.is_first_person'},
        {'hold_third_person': '!c.is_first_person'},
        {'swing_first_person': 'v.mw_swing > 0.0 && !v.mw_casting && c.is_first_person'},
        {'swing_third_person': 'v.mw_swing > 0.0 && !v.mw_casting && !c.is_first_person'},
        {'cast_first_person': 'v.mw_casting && c.is_first_person'},
        {'cast_third_person': 'v.mw_casting && !c.is_first_person'},
    ]
    return {
        'format_version': '1.10.0',
        'minecraft:attachable': {
            'description': {
                'identifier': '%s:%s' % (NS, wid),
                'materials': {'default': 'entity_alphatest', 'enchanted': 'entity_alphatest_glint'},
                'textures': {'default': 'textures/models/mw_%s' % wid, 'enchanted': 'textures/misc/enchanted_item_glint'},
                'geometry': {'default': 'geometry.mw_%s' % wid},
                'animations': anims,
                'scripts': {'pre_animation': pre, 'animate': animate},
                'render_controllers': ['controller.render.mw_solid', 'controller.render.mw_glow'],
            }
        },
    }


def _n(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return s if '.' in s else s + '.0'


# ------------------------------------------------------------------ animations
def _solved_hold(spec, view):
    """Solve the idle hold pose (view-space pose params) into root-bone position/rotation."""
    rest = K.hand_first_person(0.0) if view == 'first' else K.hand_third_person_idle()
    h = spec['hold'][view]
    pos, cands = K.solve_root(view, [h[0], h[1], h[2], h[3][0], h[3][1], h[3][2]], rest, rest)
    return [_num(c) for c in pos], [_num(c) for c in cands[0]]


def _hold(spec, view):
    pos, rot = _solved_hold(spec, view)
    amp = 1.0 if view == 'first' else 0.8
    sway_rot = [
        '%s * math.sin(q.life_time * 110.0) + 1.4 * v.mw_move * math.sin(q.life_time * 420.0)' % _n(0.9 * amp),
        '%s * math.sin(q.life_time * 83.0 + 30.0)' % _n(0.7 * amp),
        '%s * math.sin(q.life_time * 97.0)' % _n(0.8 * amp),
    ]
    sway_pos = [
        0,
        '%s * math.sin(q.life_time * 140.0) + 0.35 * v.mw_move * math.abs(math.sin(q.life_time * 420.0))' % _n(0.18 * amp),
        0,
    ]
    return {
        'loop': True,
        'bones': {
            'root': {'position': pos, 'rotation': rot},
            'weapon': {'rotation': sway_rot, 'position': sway_pos},
        },
    }


def _flicker(spec):
    bones = {}
    for i, (name, hz, amp, phase) in enumerate(spec.get('flicker', [])):
        w = hz * 360.0
        # vertical flicker; flames swell while a spell is being cast
        sy = '(1.0 + %s * math.sin(q.life_time * %s + %s)) * (v.mw_casting ? 1.0 + 0.3 * math.sin(math.clamp(v.mw_cast_t / %s, 0.0, 1.0) * 180.0) : 1.0)' % (
            _n(amp), _n(w), _n(phase), _n(spec['cast_len']))
        sxz = '1.0 + %s * 0.5 * math.sin(q.life_time * %s + %s + 90.0)' % (_n(amp), _n(w * 0.8), _n(phase))
        bones[name] = {'scale': [sxz, sy, sxz]}
    for (name, axis, dps, phase) in spec.get('spin', []):
        ch = [0, 0, 0]
        ch['xyz'.index(axis)] = 'q.life_time * %s + %s' % (_n(dps), _n(phase))
        bones.setdefault(name, {})['rotation'] = ch
    return {'loop': True, 'bones': bones}


def _root_track_animation(frames, length, clock):
    """Absolute root-bone track (view-space choreography already solved)."""
    pos, rot = {}, {}
    for t, p, r in frames:
        pos[_fmt(t)] = [_num(c) for c in p]
        rot[_fmt(t)] = [_num(c) for c in r]
    return {
        'loop': 'hold_on_last_frame',
        'animation_length': round(length, 4),
        'anim_time_update': clock,
        'override_previous_animation': True,
        'bones': {'root': {'position': pos, 'rotation': rot}},
    }


def animations(spec):
    wid = spec['id']
    A = {}
    A['animation.mw_%s.hold_first_person' % wid] = _hold(spec, 'first')
    A['animation.mw_%s.hold_third_person' % wid] = _hold(spec, 'third')
    if spec.get('flicker') or spec.get('spin'):
        A['animation.mw_%s.flicker' % wid] = _flicker(spec)
    # first person: choreographed in camera space (arm motion compensated for the swing)
    A['animation.mw_%s.swing_first_person' % wid] = _root_track_animation(
        K.solve_track('first', spec['fp_swing'], 1.0, arm_fn=K.hand_first_person), 1.0, 'v.mw_swing')
    A['animation.mw_%s.cast_first_person' % wid] = _root_track_animation(
        K.solve_track('first', spec['fp_cast'], spec['cast_len']), spec['cast_len'], 'v.mw_cast_t')
    # third person: wrist/forearm deltas relative to the (vanilla) arm so the grip stays in the hand
    A['animation.mw_%s.swing_third_person' % wid] = timeline_animation(spec['tp_swing'], 1.0, 'v.mw_swing')
    A['animation.mw_%s.cast_third_person' % wid] = timeline_animation(spec['tp_cast'], spec['cast_len'], 'v.mw_cast_t')
    return {'format_version': '1.8.0', 'animations': A}


# ------------------------------------------------------------------ item / recipe
def item_json(spec):
    wid = spec['id']
    comps = {
        'minecraft:icon': 'mw_%s' % wid,
        'minecraft:display_name': {'value': spec['title']},
        'minecraft:max_stack_size': 1,
        'minecraft:hand_equipped': True,
        'minecraft:allow_off_hand': False,
        'minecraft:can_destroy_in_creative': False,
        'minecraft:damage': spec['damage'],
        'minecraft:durability': {'max_durability': spec['durability']},
        'minecraft:enchantable': {'slot': spec.get('enchant_slot', 'sword'), 'value': spec['enchant']},
        'minecraft:repairable': {'repair_items': [{
            'items': spec['repair'],
            'repair_amount': 'q.max_durability * 0.25',     # each unit of repair material restores a quarter
        }]},
        'minecraft:cooldown': {'category': cat(spec), 'duration': spec['cooldown']},
    }
    return {
        'format_version': '1.20.80',
        'minecraft:item': {
            'description': {
                'identifier': '%s:%s' % (NS, wid),
                'menu_category': {'category': 'equipment', 'group': 'itemGroup.name.sword'},
            },
            'components': comps,
        },
    }


def recipe_json(spec):
    r = spec['recipe']
    return {
        'format_version': '1.20.10',
        'minecraft:recipe_shaped': {
            'description': {'identifier': '%s:%s' % (NS, spec['id'])},
            'tags': ['crafting_table'],
            'pattern': r['pattern'],
            'key': {k: {'item': v} for k, v in r['key'].items()},
            'unlock': [{'item': r['unlock']}],
            'result': {'item': '%s:%s' % (NS, spec['id'])},
        },
    }


def item_texture(specs):
    return {
        'resource_pack_name': 'magical_weapons',
        'texture_name': 'atlas.items',
        'texture_data': {'mw_%s' % s['id']: {'textures': 'textures/items/mw_%s' % s['id']} for s in specs},
    }

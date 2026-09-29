#!/usr/bin/env python3
"""Generate the resource-pack visuals: particle definitions + textures, fog settings, entity textures and client entities."""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'NaturalDisasters_RP')
rng = np.random.default_rng(7)


def wjson(rel, obj):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as fh:
        json.dump(obj, fh, indent=2)


def save_png(rel, arr):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save(p)


# ---- particle textures -------------------------------------------------------------------------------------------
def grid(w, h):
    y, x = np.mgrid[0:h, 0:w]
    return (x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1


def soft(n=32):
    x, y = grid(n, n)
    r = np.sqrt(x * x + y * y)
    a = np.clip(1 - r, 0, 1) ** 1.6
    out = np.zeros((n, n, 4)); out[..., :3] = 255; out[..., 3] = a * 255
    return out


def puff(n=32):
    x, y = grid(n, n)
    r = np.sqrt(x * x + y * y)
    small = rng.random((6, 6))
    noise = np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)) / 255.0
    a = np.clip(1 - r, 0, 1) ** 1.1 * (0.55 + 0.6 * noise)
    a = np.clip(a, 0, 1)
    shade = 0.78 + 0.22 * noise * (1 - 0.4 * (y + 1) / 2)
    out = np.zeros((n, n, 4)); out[..., :3] = shade[..., None] * 255; out[..., 3] = a * 255
    return out


def chip(n=8):
    out = np.zeros((n, n, 4))
    x, y = grid(n, n)
    mask = (np.abs(x) < 0.8) & (np.abs(y) < 0.8) & (rng.random((n, n)) > 0.12)
    v = 0.72 + 0.28 * rng.random((n, n))
    out[..., :3] = v[..., None] * 255; out[..., 3] = mask * 255
    return out


def streak(w=32, h=8):
    x, y = grid(w, h)
    a = np.exp(-(y * 3.2) ** 2) * np.clip((x + 1) / 2, 0, 1) ** 1.3
    out = np.zeros((h, w, 4)); out[..., :3] = 255; out[..., 3] = a * 255
    return out


def rain(w=4, h=16):
    x, y = grid(w, h)
    a = np.exp(-(x * 1.6) ** 2) * (0.25 + 0.75 * (y + 1) / 2)
    out = np.zeros((h, w, 4)); out[..., :3] = 255; out[..., 3] = a * 255
    return out


def ring(n=32):
    x, y = grid(n, n)
    r = np.sqrt(x * x + y * y)
    a = np.exp(-((r - 0.82) / 0.09) ** 2)
    out = np.zeros((n, n, 4)); out[..., :3] = 255; out[..., 3] = a * 255
    return out


def bolt(w=16, h=64):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d, g = ImageDraw.Draw(img), ImageDraw.Draw(glow)
    xc = w / 2
    pts = []
    for yy in range(h):
        xc += rng.uniform(-1.3, 1.3)
        xc = min(max(xc, 4), w - 4)
        pts.append((xc, yy))
    g.line(pts, fill=(200, 210, 255, 90), width=7)
    d.line(pts, fill=(255, 255, 255, 255), width=2)
    out = Image.alpha_composite(glow, img)
    return np.array(out).astype(float)


TEX = {
    'soft': (soft(), 32, 32), 'puff': (puff(), 32, 32), 'chip': (chip(), 8, 8),
    'streak': (streak(), 32, 8), 'rain': (rain(), 4, 16), 'ring': (ring(), 32, 32), 'bolt': (bolt(), 16, 64),
}
for k, (arr, w, h) in TEX.items():
    save_png('textures/particle/nd_%s.png' % k, arr)


# ---- particle definitions ----------------------------------------------------------------------------------------
AGE = 'variable.particle_age / variable.particle_lifetime'
SPEED = '20 * math.sqrt(variable.vel.x * variable.vel.x + variable.vel.y * variable.vel.y + variable.vel.z * variable.vel.z)'
DIRV = ['variable.vel.x', 'variable.vel.y + 0.00001', 'variable.vel.z']


def S(d):
    return '(variable.size > 0 ? variable.size : %s)' % d


def L(d):
    return '(variable.life > 0 ? variable.life : %s)' % d


def particle(pid, tex, mat, life, size, accel=(0, 0, 0), drag=0.0, grad=None, facing='rotate_xyz', spin=False,
             grow=0.0, shrink=0.0, collide=None, aspect=(1.0, 1.0), sx=None, sy=None):
    """size = ('diam', d) -> S(d) blocks across; ('mult', base) -> base * S(1)."""
    tw, th = TEX[tex][1], TEX[tex][2]
    kind, val = size
    base = S(val) if kind == 'diam' else '%s * %s' % (val, S(1))
    curve = '(1 + %s * (%s))' % (grow, AGE) if grow else ('(1 - %s * (%s))' % (shrink, AGE) if shrink else '1')
    sx = sx or '0.5 * %s * %s * %s' % (base, aspect[0], curve)
    sy = sy or '0.5 * %s * %s * %s' % (base, aspect[1], curve)
    comps = {
        'minecraft:emitter_rate_instant': {'num_particles': 1},
        'minecraft:emitter_lifetime_once': {'active_time': 1},
        'minecraft:emitter_shape_point': {'direction': DIRV},
        'minecraft:particle_lifetime_expression': {'max_lifetime': L(life)},
        'minecraft:particle_initial_speed': SPEED,
        'minecraft:particle_motion_dynamic': {'linear_acceleration': list(accel), 'linear_drag_coefficient': drag},
        'minecraft:particle_appearance_billboard': {
            'size': [sx, sy],
            'facing_camera_mode': facing,
            'uv': {'texture_width': tw, 'texture_height': th, 'uv': [0, 0], 'uv_size': [tw, th]},
        },
    }
    if spin:
        comps['minecraft:particle_initial_spin'] = {'rotation': 'math.random(0, 360)', 'rotation_rate': 'math.random(-25, 25)'}
    if grad:
        comps['minecraft:particle_appearance_tinting'] = {'color': {'interpolant': AGE, 'gradient': {str(k): v for k, v in grad.items()}}}
    if collide:
        comps['minecraft:particle_motion_collision'] = {
            'enabled': True, 'collision_drag': collide.get('drag', 4), 'coefficient_of_restitution': collide.get('bounce', 0.2),
            'collision_radius': collide.get('radius', 0.05), 'expire_on_contact': collide.get('expire', False),
        }
    wjson('particles/nd_%s.json' % pid, {
        'format_version': '1.10.0',
        'particle_effect': {
            'description': {'identifier': 'nd:%s' % pid, 'basic_render_parameters': {'material': 'particles_' + mat, 'texture': 'textures/particle/nd_%s' % tex}},
            'components': comps,
        },
    })


particle('smoke_puff', 'puff', 'alpha', 2.0, ('diam', 2.0), (0, 0.3, 0), 0.35, {0: '#00343434', 0.15: '#A03C3C3C', 0.7: '#70505050', 1: '#00707070'}, spin=True, grow=0.8)
particle('ash_flake', 'chip', 'alpha', 4.0, ('mult', 0.14), (0, -0.6, 0), 0.8, {0: '#00A0A0A0', 0.1: '#FFB4B4B4', 0.9: '#FF8C8C8C', 1: '#00808080'}, spin=True)
particle('dust_puff', 'puff', 'alpha', 1.6, ('diam', 1.5), (0, 0.25, 0), 1.2, {0: '#00A08A64', 0.2: '#A0A89070', 0.7: '#70A89070', 1: '#00A89070'}, spin=True, grow=0.6)
particle('debris_chip', 'chip', 'alpha', 1.6, ('mult', 0.28), (0, -14, 0), 0.4, {0: '#FF6E5B45', 0.8: '#FF6E5B45', 1: '#006E5B45'}, spin=True,
         collide={'drag': 6, 'bounce': 0.25, 'radius': 0.06})
particle('ember', 'soft', 'add', 1.6, ('mult', 0.14), (0, 0.6, 0), 0.6, {0: '#00FFB030', 0.1: '#FFFFC040', 0.6: '#FFFF6010', 1: '#00801000'})
particle('flame', 'soft', 'add', 0.8, ('diam', 1.5), (0, 1.0, 0), 0.5, {0: '#00FFB030', 0.15: '#FFFFD050', 0.55: '#C0FF6A10', 1: '#00301000'}, shrink=0.5, spin=True)
particle('lava_glob', 'soft', 'add', 3.0, ('diam', 1.0), (0, -22, 0), 0.05, {0: '#FFFFE060', 0.5: '#FFFF7A10', 0.9: '#FFC03000', 1: '#00600800'},
         collide={'drag': 8, 'bounce': 0.1, 'radius': 0.1, 'expire': True})
particle('spark', 'soft', 'add', 0.6, ('mult', 0.16), (0, -10, 0), 0.2, {0: '#FFFFFFC0', 0.5: '#FFFFC040', 1: '#00FF6010'})
particle('wind_streak', 'streak', 'alpha', 0.7, ('mult', 1.0), (0, 0, 0), 0.6, {0: '#00FFFFFF', 0.25: '#60FFFFFF', 0.7: '#40FFFFFF', 1: '#00FFFFFF'}, aspect=(2.4, 0.05))
particle('cloud_puff', 'puff', 'alpha', 3.0, ('diam', 8.0), (0, 0, 0), 0.2, {0: '#00565C62', 0.2: '#B0666C72', 0.75: '#A0585E64', 1: '#00565C62'}, spin=True, grow=0.25)
particle('snowflake', 'chip', 'alpha', 4.0, ('mult', 0.11), (0, -0.4, 0), 0.25, {0: '#00FFFFFF', 0.08: '#FFFFFFFF', 0.9: '#FFF0F6FF', 1: '#00FFFFFF'}, spin=True)
particle('rain_streak', 'rain', 'alpha', 1.2, ('mult', 1.0), (0, 0, 0), 0.0, {0: '#00B0C0E8', 0.1: '#A0B0C0E8', 0.9: '#80A0B0D8', 1: '#00A0B0D8'}, facing='lookat_y', aspect=(0.05, 1.1))
particle('water_spray', 'puff', 'alpha', 1.4, ('diam', 3.0), (0, -5, 0), 0.5, {0: '#00C8E8FF', 0.2: '#B0D8F0FF', 0.7: '#80D8F0FF', 1: '#00E8F8FF'}, spin=True, grow=0.3)
particle('foam', 'puff', 'alpha', 1.2, ('diam', 2.0), (0, -1, 0), 0.6, {0: '#00FFFFFF', 0.2: '#E0FFFFFF', 0.8: '#B0F0F8FF', 1: '#00F0F8FF'}, spin=True, grow=0.3)
particle('shock_ring', 'ring', 'add', 0.8, ('diam', 6.0), (0, 0, 0), 0.0, {0: '#C0FFFFFF', 0.6: '#70FFE8C0', 1: '#00FFD090'}, facing='emitter_transform_xz',
         sx='0.5 * %s * (0.2 + 0.8 * (%s))' % (S(6), AGE), sy='0.5 * %s * (0.2 + 0.8 * (%s))' % (S(6), AGE))
particle('flash', 'soft', 'add', 0.35, ('diam', 8.0), (0, 0, 0), 0.0, {0: '#FFFFFFF0', 0.4: '#B0FFF0C0', 1: '#00FFD080'}, shrink=0.3)
particle('lightning_bolt', 'bolt', 'add', 0.35, ('diam', 30.0), (0, 0, 0), 0.0, {0: '#FFFFFFFF', 0.25: '#60C8D8FF', 0.4: '#FFFFFFFF', 0.7: '#80C8D8FF', 1: '#00B0C0FF'}, facing='lookat_y',
         sx='0.7 + 0.025 * %s' % S(30), sy='0.5 * %s' % S(30))
particle('crack_dust', 'puff', 'alpha', 1.4, ('diam', 1.5), (0, 0.15, 0), 1.0, {0: '#00483C30', 0.2: '#A0584A3C', 0.7: '#70584A3C', 1: '#00584A3C'}, spin=True, grow=0.5)


# ---- fog settings ------------------------------------------------------------------------------------------------
FOGS = {
    'tornado': (8, 60, '#6E6A63'), 'tsunami': (6, 70, '#7C9AAE'), 'volcano': (6, 55, '#3A3532'),
    'earthquake': (10, 70, '#8A8272'), 'meteor': (8, 60, '#4A4642'), 'supercell': (4, 48, '#4A5058'),
    'hurricane': (3, 38, '#5A6068'), 'wildfire': (6, 50, '#7A5A3C'), 'blizzard': (2, 22, '#E4ECF2'),
    'sinkhole': (8, 65, '#7A6E5E'),
}
for name, (start, end, color) in FOGS.items():
    wjson('fogs/nd_%s.json' % name, {
        'format_version': '1.16.100',
        'minecraft:fog_settings': {
            'description': {'identifier': 'nd:%s' % name},
            'distance': {
                'air': {'fog_start': start, 'fog_end': end, 'fog_color': color, 'render_distance_type': 'fixed'},
                'weather': {'fog_start': start, 'fog_end': end, 'fog_color': color, 'render_distance_type': 'fixed'},
            },
        },
    })


# ---- entity textures + client entities ---------------------------------------------------------------------------
def entity_tex(name, base, accent=None, glow=None):
    w, h = 32, 16
    a = np.zeros((h, w, 4)); a[..., 3] = 255
    n = rng.random((h, w))
    for c in range(3):
        a[..., c] = np.clip(base[c] * (0.72 + 0.5 * n), 0, 255)
    if accent is not None:
        m = rng.random((h, w)) > 0.86
        for c in range(3):
            a[..., c] = np.where(m, accent[c], a[..., c])
    if glow is not None:
        m = rng.random((h, w)) > 0.7
        for c in range(3):
            a[..., c] = np.where(m, glow[c], a[..., c])
    save_png('textures/entity/nd_%s.png' % name, a)


entity_tex('debris', (112, 90, 66), accent=(78, 78, 82))
entity_tex('lava_bomb', (60, 34, 24), glow=(255, 120, 20))
entity_tex('meteor', (52, 42, 40), accent=(30, 28, 30), glow=(255, 90, 10))

wjson('models/entity/nd_cube.geo.json', {
    'format_version': '1.12.0',
    'minecraft:geometry': [{
        'description': {'identifier': 'geometry.nd_cube', 'texture_width': 32, 'texture_height': 16, 'visible_bounds_width': 4, 'visible_bounds_height': 4, 'visible_bounds_offset': [0, 0.5, 0]},
        'bones': [{'name': 'body', 'pivot': [0, 4, 0], 'cubes': [{'origin': [-4, 0, -4], 'size': [8, 8, 8], 'uv': [0, 0]}]}],
    }],
})
wjson('animations/nd_spin.animation.json', {
    'format_version': '1.8.0',
    'animations': {'animation.nd.spin': {'loop': True, 'bones': {'body': {'rotation': ['q.life_time * 240', 'q.life_time * 170', 'q.life_time * 310']}}}},
})
wjson('render_controllers/nd_entity.render_controllers.json', {
    'format_version': '1.10.0',
    'render_controllers': {'controller.render.nd_entity': {'arrays': {}, 'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.default']}},
})
for name, scale in (('debris', '1.0'), ('lava_bomb', '1.6'), ('meteor', '5.0')):
    wjson('entity/nd_%s.entity.json' % name, {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': 'nd:%s' % name,
                'materials': {'default': 'entity_alphatest'},
                'textures': {'default': 'textures/entity/nd_%s' % name},
                'geometry': {'default': 'geometry.nd_cube'},
                'animations': {'spin': 'animation.nd.spin'},
                'scripts': {'animate': ['spin'], 'scale': scale},
                'render_controllers': ['controller.render.nd_entity'],
            },
        },
    })
print('visuals written')

#!/usr/bin/env python3
"""Render software previews of the weapons straight from the pack files.

    python3 tools/preview/make_previews.py [--out DIR] [weapon_id ...]

For every weapon this writes (default DIR: docs/previews):
    <id>_fp.png     first-person strips: 8 frames of the melee swing + 8 frames of the cast animation
    <id>_tp.png     the same two strips in third person
    <id>_model.png  four turn-around views of the bare model
    idle_all_fp.png / idle_all_tp.png   every weapon's hold pose, side by side
    icons.png       the seven inventory icons, enlarged

The renderer (viewer.js) is a small three.js re-implementation of the Bedrock player skeleton, attachable
binding and Molang animation evaluation, calibrated against vanilla items. It is a preview aid, not the game:
check the real thing on a device. Setup is described in tools/preview/README.md.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(TOOLS, '..'))
RP = os.path.join(ROOT, 'resource_pack')
sys.path.insert(0, TOOLS)

from gen.weapons import load, ORDER      # noqa: E402
from gen.icons import preview_sheet      # noqa: E402

SWING_U = [0.0, 0.08, 0.16, 0.26, 0.38, 0.52, 0.70, 0.88]          # vanilla attack_time samples
CAST_F = [0.0, 0.14, 0.30, 0.42, 0.52, 0.62, 0.78, 0.94]           # fractions of the cast animation
THIRD_CAM = {'az': 62, 'el': 10, 'dist': 80, 'target': [0, 20, 0], 'fov': 38}
IDLE_CAM = {'az': 58, 'el': 10, 'dist': 78, 'target': [0, 20, 0], 'fov': 38}
# (target height, camera distance) that frames each model in its turn-around
MODEL_CAM = {
    'flamebrand': (36, 105), 'frostbite': (36, 100), 'storm_staff': (30, 105), 'arcane_wand': (28, 60),
    'shadow_dagger': (30, 60), 'earth_hammer': (28, 90), 'soul_scythe': (30, 105),
}
TURNAROUND = [('broad face az90', 90, 4), ('front edge az0', 0, 4), ('3/4 az40 el15', 40, 15), ('back 3/4 az-140 el10', -140, 10)]


def setup(wid):
    return {
        'geoFiles': ['/vanilla/models/mobs.json', '/pack/models/entity/mw_%s.geo.json' % wid],
        'animFiles': ['/vanilla/animations/player.animation.json', '/vanilla/animations/player_firstperson.animation.json',
                      '/vanilla/animations/humanoid.animation.json', '/pack/animations/mw_%s.animation.json' % wid],
        'controllerFiles': [],
        'attachables': [{'name': wid, 'url': '/pack/attachables/mw_%s.json' % wid, 'root': '/pack/'}],
    }


def animation_scenario(spec):
    wid, total, clen = spec['id'], float(spec['cooldown']), float(spec['cast_len'])
    swing = [dict(label='swing u=%s' % u, ownerVars={'attack_time': u}, queries={'life_time': 0.4}, quiet=True) for u in SWING_U]
    cast = []
    for f in CAST_F:
        t = f * clen
        # the attachable derives its cast clock from the remaining cooldown: total - remaining
        cast.append(dict(label='cast t=%.2fs' % t, queries={'cooldown_remaining': (total - t) if t > 0 else total - 0.001, 'life_time': 0.4}, quiet=True))
    sheets = [
        {'out': '%s_fp.png' % wid, 'spec': {'attachable': wid, 'view': 'first', 'cols': 4, 'tileW': 320, 'tileH': 180,
                                             'tiles': swing + cast}},
        {'out': '%s_tp.png' % wid, 'spec': {'attachable': wid, 'view': 'third', 'cols': 4, 'tileW': 250, 'tileH': 280,
                                             'cam': THIRD_CAM, 'tiles': swing + cast}},
    ]
    return {'packRP': RP, 'setup': setup(wid), 'sheets': sheets}


def model_scenario(spec):
    wid = spec['id']
    cy, dist = MODEL_CAM[wid]
    tiles = [{'label': label, 'cam': {'az': az, 'el': el, 'dist': dist, 'target': [0, cy, 0], 'fov': 38},
              'quiet': True, 'queries': {'life_time': 0.25}} for label, az, el in TURNAROUND]
    sheet = {'out': '%s_model.png' % wid, 'spec': {'attachable': wid, 'standalone': True, 'noAnim': True, 'view': 'third',
                                                    'cols': 4, 'tileW': 340, 'tileH': 520, 'bg': 3420234, 'tiles': tiles}}
    return {'packRP': RP, 'setup': setup(wid), 'sheets': [sheet]}


def idle_scenario(spec):
    wid = spec['id']
    tile = lambda view: [{'label': '%s %s idle' % (wid, view), 'queries': {'life_time': 0.4}, 'quiet': True}]
    sheets = [
        {'out': 'idle_%s_fp.png' % wid, 'spec': {'attachable': wid, 'view': 'first', 'cols': 1, 'tileW': 480, 'tileH': 270,
                                                  'tiles': tile('FP')}},
        {'out': 'idle_%s_tp.png' % wid, 'spec': {'attachable': wid, 'view': 'third', 'cols': 1, 'tileW': 270, 'tileH': 270,
                                                  'cam': IDLE_CAM, 'tiles': tile('TP')}},
    ]
    return {'packRP': RP, 'setup': setup(wid), 'sheets': sheets}


def render(scenario, out_dir, work):
    path = os.path.join(work, 'scn_%d.json' % render.n)
    render.n += 1
    with open(path, 'w') as f:
        json.dump(scenario, f)
    subprocess.run(['node', os.path.join(HERE, 'render.mjs'), path, out_dir], check=True)


render.n = 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs', 'previews'))
    ap.add_argument('weapons', nargs='*', help='weapon ids (default: all)')
    args = ap.parse_args()

    if not os.path.isdir(os.path.join(TOOLS, 'node_modules', 'playwright-core')):
        sys.exit('Run `npm install` in %s first (see tools/preview/README.md).' % TOOLS)
    specs = [m.SPEC for m in load()]
    wanted = args.weapons or ORDER
    unknown = [w for w in wanted if w not in ORDER]
    if unknown:
        sys.exit('unknown weapon id(s): %s (known: %s)' % (', '.join(unknown), ', '.join(ORDER)))
    os.makedirs(args.out, exist_ok=True)

    with tempfile.TemporaryDirectory() as work:
        for spec in specs:
            if spec['id'] not in wanted:
                continue
            print('== %s' % spec['id'])
            for make in (animation_scenario, model_scenario, idle_scenario):
                render(make(spec), args.out, work)

    # one overview image per view from the per-weapon idle sheets
    if wanted == ORDER:
        for view in ('fp', 'tp'):
            parts = [os.path.join(args.out, 'idle_%s_%s.png' % (w, view)) for w in ORDER]
            subprocess.run([sys.executable, os.path.join(HERE, 'stitch.py'), os.path.join(args.out, 'idle_all_%s.png' % view), '4'] + parts, check=True)
            for p in parts:
                os.remove(p)
        preview_sheet([s['icon']() for s in specs], scale=10, cols=4).save(os.path.join(args.out, 'icons.png'))
    print('done ->', args.out)


if __name__ == '__main__':
    main()

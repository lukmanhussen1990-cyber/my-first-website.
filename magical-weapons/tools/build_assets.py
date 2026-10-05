#!/usr/bin/env python3
"""Generate all pack assets (models, textures, animations, items, recipes, manifests).

    python3 tools/build_assets.py [--out DIR]

Hand-written files (scripts/main.js, README) are not touched.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gen import emit                       # noqa: E402
from gen.weapons import load               # noqa: E402
from gen.pngkit import Canvas              # noqa: E402
from gen import packicon                   # noqa: E402

VERSION = [1, 0, 0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=os.path.abspath(os.path.join(HERE, '..')))
    args = ap.parse_args()
    root = args.root
    bp, rp = os.path.join(root, 'behavior_pack'), os.path.join(root, 'resource_pack')

    mods = load()
    specs = [m.SPEC for m in mods]
    for m in mods:
        spec = m.SPEC
        wid = spec['id']
        model = m.build()
        geo = model.geo_json()
        emit.dump(geo, os.path.join(rp, 'models', 'entity', 'mw_%s.geo.json' % wid), indent=1)
        os.makedirs(os.path.join(rp, 'textures', 'models'), exist_ok=True)
        model.texture().save(os.path.join(rp, 'textures', 'models', 'mw_%s.png' % wid))
        emit.dump(emit.attachable(spec), os.path.join(rp, 'attachables', 'mw_%s.json' % wid))
        emit.dump(emit.animations(spec), os.path.join(rp, 'animations', 'mw_%s.animation.json' % wid), indent=1)
        icon = spec['icon']()
        os.makedirs(os.path.join(rp, 'textures', 'items'), exist_ok=True)
        icon.save(os.path.join(rp, 'textures', 'items', 'mw_%s.png' % wid))
        emit.dump(emit.item_json(spec), os.path.join(bp, 'items', 'mw_%s.json' % wid))
        emit.dump(emit.recipe_json(spec), os.path.join(bp, 'recipes', 'mw_%s.json' % wid))
        print('built %-12s  texture %dx%d  cubes %d' % (wid, model.texture().w, model.texture().h,
                                                     sum(len(b.cubes) for b in model.bones.values())))

    pack_icon = packicon.build({m.SPEC['id']: m.SPEC['icon']() for m in mods})
    for d in (bp, rp):
        pack_icon.save(os.path.join(d, 'pack_icon.png'))
    emit.dump(emit.item_texture(specs), os.path.join(rp, 'textures', 'item_texture.json'))
    emit.dump(emit.render_controllers(), os.path.join(rp, 'render_controllers', 'mw.render_controllers.json'))
    emit.dump(emit.behavior_manifest(VERSION), os.path.join(bp, 'manifest.json'))
    emit.dump(emit.resource_manifest(VERSION), os.path.join(rp, 'manifest.json'))
    for d in (bp, rp):
        emit.dump(['en_US'], os.path.join(d, 'texts', 'languages.json'))
    lang = '\n'.join('item.%s:%s=%s' % (emit.NS, s['id'], s['title']) for s in specs) + '\n'
    lang += '\n'.join('item.%s:%s.name=%s' % (emit.NS, s['id'], s['title']) for s in specs) + '\n'
    for d in (rp, bp):
        with open(os.path.join(d, 'texts', 'en_US.lang'), 'w') as f:
            f.write(lang)
    print('done ->', root)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Dependency-free sanity checks for the add-on (run automatically by build_addon.py).

    python3 tools/validate.py

Checks JSON syntax, manifests, item/recipe/attachable/geometry/animation cross references, texture
sizes, UV bounds, Molang bracket balance and an allow-list of queries/math functions, and that the
scripts only import files that exist. Whether the scripts stay within the stable script API is checked
by the optional tools: tools/typecheck (type-check against the 1.11.0 typings) and tools/deep_validate.mjs.
"""
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# Molang names used by this pack (all exist in the 1.21.0.26 engine docs). Extend when adding more.
QUERIES_OK = {'life_time', 'modified_move_speed', 'cooldown_time_remaining', 'anim_time'}
MATH_OK = {'sin', 'cos', 'abs', 'clamp', 'max', 'min', 'lerp', 'pow', 'sqrt', 'floor', 'hermite_blend'}
CONTEXT_OK = {'is_first_person', 'item_slot', 'owning_entity'}
FACES = {'north', 'south', 'east', 'west', 'up', 'down'}


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a PNG')
    return struct.unpack('>II', head[16:24])


def walk(base, ext):
    for dp, _, files in os.walk(base):
        for f in sorted(files):
            if f.endswith(ext):
                yield os.path.join(dp, f)


def run(root, quiet=False):
    errors, warns = [], []
    bp, rp = os.path.join(root, 'behavior_pack'), os.path.join(root, 'resource_pack')
    rel = lambda p: os.path.relpath(p, root)
    err = lambda m: errors.append(m)

    # 1. JSON syntax
    docs = {}
    for f in list(walk(bp, '.json')) + list(walk(rp, '.json')):
        try:
            with open(f, encoding='utf-8') as fh:
                docs[f] = json.load(fh)
        except Exception as e:
            err('%s: invalid JSON (%s)' % (rel(f), e))

    # 2. manifests
    try:
        bpm, rpm = docs[os.path.join(bp, 'manifest.json')], docs[os.path.join(rp, 'manifest.json')]
        uuids = [bpm['header']['uuid']] + [m['uuid'] for m in bpm['modules']] + [rpm['header']['uuid']] + [m['uuid'] for m in rpm['modules']]
        if len(set(uuids)) != len(uuids):
            err('manifests: duplicate UUIDs')
        if not any(d.get('uuid') == rpm['header']['uuid'] for d in bpm['dependencies']):
            err('behavior pack does not depend on the resource pack')
        mod = [d for d in bpm['dependencies'] if d.get('module_name') == '@minecraft/server']
        if not mod or mod[0]['version'] != '1.11.0':
            err('behavior manifest: @minecraft/server must be the stable 1.11.0 for 1.21.0.x')
        scripts = [m for m in bpm['modules'] if m['type'] == 'script']
        if not scripts or not os.path.exists(os.path.join(bp, scripts[0]['entry'])):
            err('script entry file is missing')
    except KeyError as e:
        err('manifest problem: missing %s' % e)

    # 3. items + icons
    item_tex = docs.get(os.path.join(rp, 'textures', 'item_texture.json'), {}).get('texture_data', {})
    items = {}
    for f in walk(os.path.join(bp, 'items'), '.json'):
        it = docs[f]['minecraft:item']
        ident = it['description']['identifier']
        items[ident] = f
        comps = it['components']
        for need in ('minecraft:icon', 'minecraft:cooldown', 'minecraft:durability', 'minecraft:damage'):
            if need not in comps:
                err('%s: missing %s' % (rel(f), need))
        key = comps.get('minecraft:icon')
        if isinstance(key, dict):
            key = key.get('texture') or key.get('textures', {}).get('default')
        if key not in item_tex:
            err('%s: icon key %r not in item_texture.json' % (rel(f), key))
        else:
            p = os.path.join(rp, item_tex[key]['textures'] + '.png')
            if not os.path.exists(p):
                err('%s: icon file missing' % rel(f))
            elif png_size(p) != (16, 16):
                warns.append('%s: icon is %dx%d' % (rel(p), *png_size(p)))
        # Repair materials (blaze rod, blue ice...) have no durability of their own, so an expression built
        # from `context.other` would evaluate to 0 and the anvil would restore nothing.
        for entry in comps.get('minecraft:repairable', {}).get('repair_items', []):
            amount = entry.get('repair_amount')
            if 'context.other' in str(amount):
                err('%s: repair_amount %r reads context.other, which is a repair material without durability (restores 0)'
                    % (rel(f), amount))
            elif not isinstance(amount, (int, float)) and 'q.max_durability' not in str(amount):
                err('%s: repair_amount %r never reads the weapon\'s own q.max_durability' % (rel(f), amount))

    # 4. recipes
    for f in walk(os.path.join(bp, 'recipes'), '.json'):
        r = docs[f]['minecraft:recipe_shaped']
        rows = r['pattern']
        if len({len(x) for x in rows}) != 1 or len(rows) > 3 or len(rows[0]) > 3:
            err('%s: pattern must be a rectangle within 3x3' % rel(f))
        used = set(''.join(rows).replace(' ', ''))
        if used - set(r['key']):
            err('%s: pattern uses undefined keys %s' % (rel(f), sorted(used - set(r['key']))))
        if r['result']['item'] not in items:
            err('%s: result %s is not one of the add-on items' % (rel(f), r['result']['item']))

    # 5. resource pack cross references
    anims, geos = {}, {}
    for f in walk(os.path.join(rp, 'animations'), '.json'):
        anims.update(docs[f]['animations'])
    for f in walk(os.path.join(rp, 'models'), '.json'):
        for g in docs[f]['minecraft:geometry']:
            geos[g['description']['identifier']] = g
    rcs = docs.get(os.path.join(rp, 'render_controllers', 'mw.render_controllers.json'), {}).get('render_controllers', {})
    for f in walk(os.path.join(rp, 'attachables'), '.json'):
        d = docs[f]['minecraft:attachable']['description']
        if d['identifier'] not in items:
            err('%s: %s has no matching item' % (rel(f), d['identifier']))
        g = geos.get(d['geometry']['default'])
        if not g:
            err('%s: geometry %s not found' % (rel(f), d['geometry']['default']))
            continue
        tp = os.path.join(rp, d['textures']['default'] + '.png')
        if not os.path.exists(tp):
            err('%s: texture missing' % rel(f))
            continue
        tw, th = png_size(tp)
        gd = g['description']
        if (tw, th) != (gd['texture_width'], gd['texture_height']):
            err('%s: texture %dx%d != geometry %sx%s' % (rel(f), tw, th, gd['texture_width'], gd['texture_height']))
        names = {b['name'].lower() for b in g['bones']}
        if sum(1 for b in g['bones'] if b.get('binding')) != 1:
            err('%s: geometry needs exactly one bound bone' % rel(f))
        for b in g['bones']:
            if b.get('parent') and b['parent'].lower() not in names:
                err('%s: bone %s has unknown parent' % (rel(f), b['name']))
            for c in b.get('cubes', []):
                for face, uv in c['uv'].items():
                    (u, v), (w, h) = uv['uv'], uv['uv_size']
                    if face not in FACES or u < 0 or v < 0 or u + w > tw or v + h > th:
                        err('%s: bad UV on %s/%s' % (rel(f), b['name'], face))
        for short, aid in d['animations'].items():
            if aid not in anims:
                err('%s: animation %s missing' % (rel(f), aid))
                continue
            for bone in anims[aid].get('bones', {}):
                if bone.lower() not in names:
                    err('%s: %s animates unknown bone %s' % (rel(f), aid, bone))
        for e in d['scripts']['animate']:
            n = e if isinstance(e, str) else next(iter(e))
            if n not in d['animations']:
                err('%s: animate refers to undeclared %s' % (rel(f), n))
        for rc in d['render_controllers']:
            if rc not in rcs:
                err('%s: render controller %s missing' % (rel(f), rc))

    # 6. Molang hygiene
    def molang(expr, where):
        s = expr.replace("'", "'")
        if s.count('(') != s.count(')') or s.count("'") % 2:
            err('%s: unbalanced brackets/quotes in %r' % (where, expr[:70]))
        for m in re.finditer(r'\b(?:q|query)\.([a-z_0-9]+)', s):
            if m.group(1) not in QUERIES_OK:
                err('%s: query.%s is not on the verified list (see tools/validate.py)' % (where, m.group(1)))
        for m in re.finditer(r'\bmath\.([a-z_0-9]+)', s):
            if m.group(1) not in MATH_OK:
                err('%s: math.%s is not on the verified list' % (where, m.group(1)))
        for m in re.finditer(r'\b(?:c|context)\.([a-z_]+)', s):
            if m.group(1) not in CONTEXT_OK:
                err('%s: context.%s is not supported' % (where, m.group(1)))

    def strings(o, where):
        if isinstance(o, str):
            if re.search(r'[a-z]\.[a-z]|[<>?*+/-]', o) and not o.startswith(('geometry.', 'texture.', 'material.')):
                molang(o, where)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                strings(v, '%s[%d]' % (where, i))
        elif isinstance(o, dict):
            for k, v in o.items():
                strings(v, '%s.%s' % (where, k))

    for f in walk(os.path.join(rp, 'animations'), '.json'):
        for aid, a in docs[f]['animations'].items():
            if a.get('anim_time_update'):
                molang(a['anim_time_update'], rel(f) + ' ' + aid)
            strings(a.get('bones', {}), rel(f) + ' ' + aid)
    for f in walk(os.path.join(rp, 'attachables'), '.json'):
        sc = docs[f]['minecraft:attachable']['description']['scripts']
        for line in sc.get('pre_animation', []):
            molang(line, rel(f))
        for e in sc['animate']:
            if isinstance(e, dict):
                molang(next(iter(e.values())), rel(f))

    # 7. scripts
    for f in walk(os.path.join(bp, 'scripts'), '.js'):
        src = open(f, encoding='utf-8').read()
        for m in re.finditer(r"from '(\./[A-Za-z_]+\.js)'", src):
            if not os.path.exists(os.path.join(os.path.dirname(f), m.group(1))):
                err('%s: import %s not found' % (rel(f), m.group(1)))

    if not quiet or errors:
        for w in warns:
            print('  warn  ', w)
        for e in errors:
            print('  ERROR ', e)
    print('validate: %d JSON files, %d items, %d attachables - %d error(s), %d warning(s)' % (
        len(docs), len(items), len(list(walk(os.path.join(rp, 'attachables'), '.json'))), len(errors), len(warns)))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(run(os.path.abspath(os.path.join(HERE, '..'))))

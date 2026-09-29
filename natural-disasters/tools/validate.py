#!/usr/bin/env python3
"""Static validation of the add-on: JSON, manifests/UUIDs/dependencies, items, icons, lang keys, entities, particles,
sounds, fogs, script imports and forbidden runtime globals. Exit code 1 on any error."""
import json
import os
import re
import sys
import uuid

import soundfile as sf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(HERE, '..', 'NaturalDisasters_BP')
RP = os.path.join(HERE, '..', 'NaturalDisasters_RP')
errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(path):
    try:
        with open(path) as fh:
            return json.load(fh)
    except Exception as e:  # noqa
        err('invalid JSON %s: %s' % (os.path.relpath(path, HERE), e))
        return None


def walk(root):
    for d, _, files in os.walk(root):
        for f in files:
            yield os.path.join(d, f)


# ---- 1. every JSON file parses -----------------------------------------------------------------------------------
n_json = 0
for root in (BP, RP):
    for p in walk(root):
        if p.endswith('.json'):
            n_json += 1
            load(p)

# ---- 2. manifests -----------------------------------------------------------------------------------------------
bpm, rpm = load(os.path.join(BP, 'manifest.json')), load(os.path.join(RP, 'manifest.json'))
uuids = []
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
for name, m in (('BP', bpm), ('RP', rpm)):
    if not m:
        continue
    uuids.append(m['header']['uuid'])
    for mod in m['modules']:
        uuids.append(mod['uuid'])
    if m.get('format_version') != 2:
        err('%s manifest format_version must be 2' % name)
    if not m['header'].get('min_engine_version'):
        err('%s manifest missing min_engine_version' % name)
for u in uuids:
    if not UUID_RE.match(u):
        err('not a valid v4 UUID: ' + u)
    try:
        uuid.UUID(u)
    except Exception:  # noqa
        err('unparsable UUID ' + u)
if len(set(uuids)) != len(uuids):
    err('duplicate UUIDs across manifests')
if bpm and rpm:
    deps = {d.get('uuid') or d.get('module_name'): d for d in bpm.get('dependencies', [])}
    if rpm['header']['uuid'] not in deps:
        err('BP does not depend on the RP header uuid')
    elif deps[rpm['header']['uuid']]['version'] != rpm['header']['version']:
        err('BP->RP dependency version differs from RP header version')
    for d in bpm.get('dependencies', []):
        if 'module_name' in d and d['module_name'] not in ('@minecraft/server', '@minecraft/server-ui'):
            err('unexpected script dependency ' + d['module_name'])
    versions = {d['module_name']: d['version'] for d in bpm['dependencies'] if 'module_name' in d}
    if versions.get('@minecraft/server') != '1.10.0':
        err('@minecraft/server must be 1.10.0 for Beta 1.21.0.26')
    for mod in bpm['modules']:
        if mod['type'] == 'script':
            entry = os.path.join(BP, mod['entry'])
            if not os.path.isfile(entry):
                err('script entry missing: ' + mod['entry'])
    if not any(m['type'] == 'script' for m in bpm['modules']):
        err('BP has no script module')
for name, root in (('BP', BP), ('RP', RP)):
    if not os.path.isfile(os.path.join(root, 'pack_icon.png')):
        err(name + ' pack_icon.png missing')

# ---- 3. config.js facts -----------------------------------------------------------------------------------------
cfg = open(os.path.join(BP, 'scripts', 'config.js')).read()
disasters = re.findall(r"'([a-z]+)'", re.search(r'DISASTER_IDS = Object\.freeze\(\[(.*?)\]\)', cfg, re.S).group(1))
items = re.findall(r"'(nd:[a-z0-9_]+)': \{ kind:", cfg)
entity_ids = re.findall(r"'(nd:[a-z_]+)'", re.search(r'ENTITY_IDS = Object\.freeze\(\{(.*?)\}\)', cfg, re.S).group(1))
if len(disasters) != 10:
    err('expected 10 disasters, found %d' % len(disasters))
if len(items) != 15:
    err('expected 15 items in ITEM_MAP, found %d' % len(items))

# ---- 4. items, icons, lang --------------------------------------------------------------------------------------
lang = open(os.path.join(RP, 'texts', 'en_US.lang')).read()
item_tex = load(os.path.join(RP, 'textures', 'item_texture.json'))['texture_data']
bp_items = {}
for p in walk(os.path.join(BP, 'items')):
    j = load(p)
    if j:
        ident = j['minecraft:item']['description']['identifier']
        bp_items[ident] = j['minecraft:item']
for it in items:
    if it not in bp_items:
        err('ITEM_MAP item has no BP item file: ' + it)
        continue
    comp = bp_items[it]['components']
    tex = comp['minecraft:icon']['texture']
    if tex not in item_tex:
        err('%s icon "%s" not in item_texture.json' % (it, tex))
    else:
        path = os.path.join(RP, item_tex[tex]['textures'] + '.png')
        if not os.path.isfile(path):
            err('icon file missing: ' + path)
        else:
            w, h = Image.open(path).size
            if (w, h) != (16, 16) and (w, h) != (32, 32):
                warn('icon %s is %dx%d' % (tex, w, h))
    key = comp['minecraft:display_name']['value']
    if ('\n' + key + '=') not in ('\n' + lang):
        err('lang key missing: ' + key)
for ident in bp_items:
    if ident not in items:
        err('BP item not in ITEM_MAP: ' + ident)

# ---- 5. entities ------------------------------------------------------------------------------------------------
bp_ent, rp_ent = {}, {}
for p in walk(os.path.join(BP, 'entities')):
    j = load(p)
    if j:
        bp_ent[j['minecraft:entity']['description']['identifier']] = j
for p in walk(os.path.join(RP, 'entity')):
    j = load(p)
    if j:
        d = j['minecraft:client_entity']['description']
        rp_ent[d['identifier']] = d
rcs = load(os.path.join(RP, 'render_controllers', 'nd_entity.render_controllers.json'))['render_controllers']
geos = [g['description']['identifier'] for g in load(os.path.join(RP, 'models', 'entity', 'nd_cube.geo.json'))['minecraft:geometry']]
anims = load(os.path.join(RP, 'animations', 'nd_spin.animation.json'))['animations']
for e in entity_ids:
    if e not in bp_ent:
        err('BP entity missing: ' + e)
    if e not in rp_ent:
        err('RP client entity missing: ' + e)
        continue
    d = rp_ent[e]
    for k, v in d['textures'].items():
        if not os.path.isfile(os.path.join(RP, v + '.png')):
            err('%s texture missing: %s' % (e, v))
    for g in d['geometry'].values():
        if g not in geos:
            err('%s geometry missing: %s' % (e, g))
    for rc in d['render_controllers']:
        if rc not in rcs:
            err('%s render controller missing: %s' % (e, rc))
    for a in d.get('animations', {}).values():
        if a not in anims:
            err('%s animation missing: %s' % (e, a))
    if ('entity.%s.name=' % e) not in lang:
        err('lang missing entity name for ' + e)

# ---- 6. scripts: collect every id used -------------------------------------------------------------------------
scripts = {}
for p in walk(os.path.join(BP, 'scripts')):
    if p.endswith('.js'):
        scripts[p] = open(p).read()
all_src = '\n'.join(scripts.values())
particle_ids = set(re.findall(r"'(nd:[a-z_]+)'", all_src)) - set(items) - set(entity_ids)
particle_ids = {p for p in particle_ids if p not in ('nd:temp',)}
part_files = {}
for p in walk(os.path.join(RP, 'particles')):
    j = load(p)
    if j:
        d = j['particle_effect']['description']
        part_files[d['identifier']] = d
        t = d['basic_render_parameters']['texture']
        if not os.path.isfile(os.path.join(RP, t + '.png')):
            err('particle texture missing: ' + t)
        comps = j['particle_effect']['components']
        for req in ('minecraft:emitter_rate_instant', 'minecraft:emitter_lifetime_once', 'minecraft:particle_lifetime_expression', 'minecraft:particle_appearance_billboard'):
            if req not in comps:
                err('%s missing component %s' % (d['identifier'], req))
used_particles = {i for i in particle_ids if i in part_files or re.search(r"spawnParticle\([^)]*'%s'" % re.escape(i), all_src)}
for i in sorted(used_particles):
    if i not in part_files:
        err('particle used in scripts but not defined: ' + i)
for i in sorted(part_files):
    if i not in used_particles:
        warn('particle defined but not used in scripts: ' + i)
# only ids passed to spawnParticle count as particles; catch typos in those calls
for m in re.finditer(r"spawnParticle\(\s*(?:ctx\.dim|dim|[a-z.]+),\s*'([^']+)'", all_src):
    if m.group(1) not in part_files:
        err('spawnParticle uses undefined particle ' + m.group(1))

# sounds
sdefs = load(os.path.join(RP, 'sounds', 'sound_definitions.json'))
sdefs = sdefs['sound_definitions'] if sdefs else {}
used_sounds = set(re.findall(r"'(nd\.[a-z_]+)'", all_src))
for s in sorted(used_sounds):
    if s not in sdefs:
        err('sound used in scripts but not defined: ' + s)
for s, d in sdefs.items():
    for snd in d['sounds']:
        f = os.path.join(RP, snd['name'] + '.ogg')
        if not os.path.isfile(f):
            err('sound file missing: ' + f)
            continue
        try:
            info = sf.info(f)
            if info.duration < 0.2 or info.duration > 10:
                warn('%s duration %.2fs' % (s, info.duration))
            if info.format != 'OGG':
                err('%s is not OGG' % f)
        except Exception as ex:  # noqa
            err('cannot decode %s: %s' % (f, ex))
    if s not in used_sounds:
        warn('sound defined but not used: ' + s)

# fogs
for d in disasters:
    f = os.path.join(RP, 'fogs', 'nd_%s.json' % d)
    j = load(f) if os.path.isfile(f) else None
    if not j:
        err('fog missing for ' + d)
    elif j['minecraft:fog_settings']['description']['identifier'] != 'nd:' + d:
        err('fog identifier mismatch for ' + d)

# ---- 7. script hygiene ------------------------------------------------------------------------------------------
FORBIDDEN = [
    (r'\bsetTimeout\s*\(', 'setTimeout'), (r'\bsetInterval\s*\(', 'setInterval'), (r'\bfetch\s*\(', 'fetch'),
    (r'\brequire\s*\(', 'require'), (r'\bprocess\.', 'process'), (r'\bstructuredClone\s*\(', 'structuredClone'),
    (r'\bTextEncoder\b', 'TextEncoder'), (r'\bIntl\.', 'Intl'), (r'\bimport\s*\(', 'dynamic import'),
    (r'\.toSorted\s*\(|\.toReversed\s*\(|\.findLast\s*\(|Object\.groupBy', 'ES2023 method'),
    (r'\bdim\.fillBlocks|\.runJob\s*\(|\.getTopmostBlock\s*\(|\.getWeather\s*\(', 'API missing in 1.10.0'),
    (r'\bdimension\.playSound|\bdim\.playSound|ctx\.dim\.playSound', 'Dimension.playSound (not in 1.10.0)'),
    (r'\bconsole\.log\b', 'console.log (use util.info)'),
]
IMPORT_RE = re.compile(r"""^\s*import\s+(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]""", re.M)
for p, src in scripts.items():
    rel = os.path.relpath(p, BP)
    stripped = re.sub(r'//.*', '', src)
    stripped = re.sub(r'/\*.*?\*/', '', stripped, flags=re.S)
    for pat, name in FORBIDDEN:
        if name.startswith('console.log') and rel.endswith('util.js'):
            continue
        if re.search(pat, stripped):
            err('%s uses forbidden %s' % (rel, name))
    if re.search(r'^\s*await\s', stripped, re.M) and 'async' not in stripped:
        err('%s top-level await' % rel)
    for imp in IMPORT_RE.findall(src):
        if imp.startswith('.'):
            if not imp.endswith('.js'):
                err('%s import without .js extension: %s' % (rel, imp))
            target = os.path.normpath(os.path.join(os.path.dirname(p), imp))
            if not os.path.isfile(target):
                err('%s imports missing file %s' % (rel, imp))
        elif imp not in ('@minecraft/server', '@minecraft/server-ui'):
            err('%s imports unsupported module %s' % (rel, imp))

# settings safety defaults
if not re.search(r'blockDestruction: \{ type: \'bool\', def: false \}', cfg):
    err('blockDestruction default must be false')
if not re.search(r'autoDisasters: \{ type: \'bool\', def: false \}', cfg):
    err('autoDisasters default must be false')

print('JSON files parsed: %d | disasters: %d | items: %d | particles: %d | sounds: %d | scripts: %d' % (n_json, len(disasters), len(items), len(part_files), len(sdefs), len(scripts)))
for w in warnings:
    print('WARN  ' + w)
for e in errors:
    print('ERROR ' + e)
print('validation %s (%d errors, %d warnings)' % ('FAILED' if errors else 'PASSED', len(errors), len(warnings)))
sys.exit(1 if errors else 0)

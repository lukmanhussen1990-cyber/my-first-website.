"""One-shot build: regenerates every asset, validates all JSON, runs the script logic tests and packages
the add-on as .mcpack / .mcaddon files in dist/."""
import json, os, subprocess, sys, zipfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ADDON = os.path.join(ROOT, 'addon'); DIST = os.path.join(ROOT, 'dist'); TOOLS = os.path.join(ROOT, 'tools')
os.environ.setdefault('SCRATCH', os.path.join(ROOT, 'dist', 'previews'))
os.makedirs(os.environ['SCRATCH'], exist_ok=True)

def run(script):
    print('==>', script); subprocess.run([sys.executable, os.path.join(TOOLS, script)], check=True, cwd=ROOT)

def validate_json():
    n = 0
    for base, _, files in os.walk(ADDON):
        for f in files:
            if f.endswith('.json'):
                p = os.path.join(base, f)
                with open(p) as fh:
                    try: json.load(fh)
                    except Exception as e: raise SystemExit('INVALID JSON %s: %s' % (p, e))
                n += 1
    print('validated', n, 'JSON files')

def check_references():
    """Every texture referenced by item_texture/terrain_texture must exist; every item/block must have a lang entry."""
    rp = os.path.join(ADDON, 'BunkerArsenal_RP'); bp = os.path.join(ADDON, 'BunkerArsenal_BP')
    lang = open(os.path.join(rp, 'texts', 'en_US.lang')).read()
    for atlas in ('item_texture.json', 'terrain_texture.json'):
        data = json.load(open(os.path.join(rp, 'textures', atlas)))['texture_data']
        for k, v in data.items():
            assert os.path.exists(os.path.join(rp, v['textures'] + '.png')), 'missing texture %s for %s' % (v['textures'], k)
    items = json.load(open(os.path.join(rp, 'textures', 'item_texture.json')))['texture_data']
    for f in os.listdir(os.path.join(bp, 'items')):
        j = json.load(open(os.path.join(bp, 'items', f)))['minecraft:item']
        ident = j['description']['identifier']; icon = j['components']['minecraft:icon']['textures']['default']
        assert icon in items, 'item %s icon %s not in item_texture.json' % (ident, icon)
        assert ('item.%s.name=' % ident) in lang, 'no lang entry for ' + ident
    terrain = json.load(open(os.path.join(rp, 'textures', 'terrain_texture.json')))['texture_data']
    for f in os.listdir(os.path.join(bp, 'blocks')):
        j = json.load(open(os.path.join(bp, 'blocks', f)))['minecraft:block']; ident = j['description']['identifier']
        assert ('tile.%s.name=' % ident) in lang, 'no lang entry for ' + ident
        def mats(c):
            for m in c.get('minecraft:material_instances', {}).values():
                assert m['texture'] in terrain, '%s uses unknown texture %s' % (ident, m['texture'])
        mats(j['components'])
        for p in j.get('permutations', []): mats(p['components'])
    print('cross-references ok')

def zipdir(folder, out, prefix=''):
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(folder):
            for f in sorted(files):
                full = os.path.join(base, f); z.write(full, os.path.join(prefix, os.path.relpath(full, folder)))

def package():
    os.makedirs(DIST, exist_ok=True)
    bp = os.path.join(ADDON, 'BunkerArsenal_BP'); rp = os.path.join(ADDON, 'BunkerArsenal_RP')
    zipdir(bp, os.path.join(DIST, 'BunkerArsenal_BP.mcpack')); zipdir(rp, os.path.join(DIST, 'BunkerArsenal_RP.mcpack'))
    addon = os.path.join(DIST, 'BunkerArsenal.mcaddon')
    with zipfile.ZipFile(addon, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder, name in ((bp, 'BunkerArsenal_BP'), (rp, 'BunkerArsenal_RP')):
            for base, _, files in os.walk(folder):
                for f in sorted(files):
                    full = os.path.join(base, f); z.write(full, os.path.join(name, os.path.relpath(full, folder)))
    for f in ('BunkerArsenal_BP.mcpack', 'BunkerArsenal_RP.mcpack', 'BunkerArsenal.mcaddon'):
        print('%-28s %6d KB' % (f, os.path.getsize(os.path.join(DIST, f)) // 1024))

if __name__ == '__main__':
    for s in ('gen_items_guns.py', 'gen_items_misc.py', 'gen_blocks.py', 'gen_sounds.py', 'gen_bp_items.py', 'gen_bp_blocks.py', 'gen_entities.py',
              'gen_loot_recipes.py', 'gen_structures.py', 'gen_rp_json.py'):
        run(s)
    validate_json(); check_references()
    print('==> script logic tests'); subprocess.run(['node', os.path.join(TOOLS, 'harness', 'run.mjs')], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    for s in ('main.js', 'weapons.js', 'bunker.js', 'builder.js', 'ui.js', 'util.js', 'loot.js'):
        subprocess.run(['node', '--check', os.path.join(ADDON, 'BunkerArsenal_BP', 'scripts', s)], check=True)
    package()
    print('BUILD OK')

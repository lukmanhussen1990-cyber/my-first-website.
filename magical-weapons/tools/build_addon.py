#!/usr/bin/env python3
"""Package behavior_pack/ and resource_pack/ into MagicalWeapons.mcaddon.

    python3 tools/build_addon.py [--skip-validate]

A .mcaddon is just a zip holding the pack folders; Minecraft imports every folder that contains a
manifest.json. The zip is written deterministically (sorted entries, fixed timestamps).

Before packing, the dependency-free validator always runs. If Node.js and the optional dev tools are
installed (see tools/README.md) the script tests, the type-check and the deep validator run too;
whatever is missing is reported as skipped, never as a failure.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
OUT = os.path.join(ROOT, 'MagicalWeapons.mcaddon')
PACKS = [('behavior_pack', 'MagicalWeapons_BP'), ('resource_pack', 'MagicalWeapons_RP')]
SKIP = ('.DS_Store', 'Thumbs.db')
STAMP = (2024, 6, 1, 0, 0, 0)


def optional_check(label, cmd, available, hint):
    """Run an optional external check. Returns False only if it ran and failed."""
    if not available:
        print('  %-14s skipped (%s)' % (label, hint))
        return True
    r = subprocess.run(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    if r.returncode != 0:
        print('  %-14s FAILED\n%s' % (label, r.stdout))
        return False
    print('  %-14s ok' % label)
    return True


def optional_checks():
    node = shutil.which('node')
    tsc = os.path.join(HERE, 'typecheck', 'node_modules', '.bin', 'tsc')
    have_tools = os.path.isdir(os.path.join(HERE, 'node_modules', 'ajv'))
    samples = os.environ.get('BEDROCK_SAMPLES')
    ok = optional_check('script tests', [node, os.path.join('tools', 'test', 'run.mjs')], bool(node), 'node not found')
    ok &= optional_check('type-check', [tsc, '-p', os.path.join('tools', 'typecheck', 'tsconfig.json')],
                         bool(node) and os.path.exists(tsc), 'run npm install in tools/typecheck')
    ok &= optional_check('deep validate', [node, os.path.join('tools', 'deep_validate.mjs')],
                         bool(node) and have_tools and bool(samples), 'needs npm install in tools/ and BEDROCK_SAMPLES')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skip-validate', action='store_true', help='skip all checks')
    args = ap.parse_args()
    if not args.skip_validate:
        sys.path.insert(0, HERE)
        import validate
        if validate.run(ROOT, quiet=True) != 0 or not optional_checks():
            print('checks failed - fix the errors above (or pass --skip-validate)')
            return 1
    entries = []
    for src, dst in PACKS:
        base = os.path.join(ROOT, src)
        for dirpath, dirs, files in os.walk(base):
            dirs.sort()
            for f in sorted(files):
                if f in SKIP or f.endswith(('.md', '.pyc')):
                    continue
                full = os.path.join(dirpath, f)
                entries.append((full, dst + '/' + os.path.relpath(full, base).replace(os.sep, '/')))
    entries.sort(key=lambda e: e[1])
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, arc in entries:
            info = zipfile.ZipInfo(arc, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, 'rb') as fh:
                z.writestr(info, fh.read())
    # verify what we just wrote
    with zipfile.ZipFile(OUT) as z:
        assert z.testzip() is None
        names = z.namelist()
        for _, dst in PACKS:
            m = json.loads(z.read(dst + '/manifest.json'))
            print('  %-20s %-28s v%s  uuid %s' % (dst, m['header']['name'], '.'.join(map(str, m['header']['version'])), m['header']['uuid']))
        for n in names:
            if n.endswith('.json'):
                json.loads(z.read(n))
    size = os.path.getsize(OUT)
    print('wrote %s (%d files, %.1f KB)' % (os.path.relpath(OUT, ROOT), len(names), size / 1024.0))
    return 0


if __name__ == '__main__':
    sys.exit(main())

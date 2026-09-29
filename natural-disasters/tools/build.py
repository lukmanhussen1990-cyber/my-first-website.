#!/usr/bin/env python3
"""Build Natural_Disasters_1.21.0.26.mcaddon: runs the checks (tsc, validate.py, headless simulation), zips both packs and
re-opens the archive to verify it. Usage: python3 build.py [--skip-checks]"""
import hashlib
import json
import os
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(ROOT, '..'))
OUT = os.path.join(REPO, 'Natural_Disasters_1.21.0.26.mcaddon')
PACKS = ['NaturalDisasters_BP', 'NaturalDisasters_RP']


def run(cmd, cwd=HERE):
    print('$ ' + ' '.join(cmd))
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    tail = (r.stdout + r.stderr).strip().splitlines()[-6:]
    print('\n'.join('    ' + l for l in tail))
    if r.returncode != 0:
        print('FAILED: ' + ' '.join(cmd))
        sys.exit(1)


def main():
    if '--skip-checks' not in sys.argv:
        run([os.path.join(HERE, 'node_modules', '.bin', 'tsc'), '-p', 'tsconfig.json'])
        run([sys.executable, 'validate.py'])
        run(['node', '--import', './sim/register.mjs', './sim/run.mjs'])

    files = []
    for pack in PACKS:
        base = os.path.join(ROOT, pack)
        for d, dirs, names in os.walk(base):
            dirs.sort()
            for n in sorted(names):
                if n.startswith('.') or n.endswith('~'):
                    continue
                full = os.path.join(d, n)
                files.append((pack + '/' + os.path.relpath(full, base).replace(os.sep, '/'), full))
    files.sort()

    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for arc, full in files:
            info = zipfile.ZipInfo(arc, date_time=(2024, 6, 20, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, 'rb') as fh:
                z.writestr(info, fh.read())

    # ---- verify the archive by re-opening it ----------------------------------------------------------------------
    with zipfile.ZipFile(OUT) as z:
        assert z.testzip() is None, 'corrupt zip'
        names = z.namelist()
        assert len(names) == len(files), 'file count mismatch'
        assert all('\\' not in n and not n.startswith('/') for n in names), 'bad entry names'
        uuids = []
        for pack in PACKS:
            m = json.loads(z.read(pack + '/manifest.json'))
            uuids.append(m['header']['uuid'])
            assert pack + '/pack_icon.png' in names, pack + ' pack_icon missing'
        bp = json.loads(z.read('NaturalDisasters_BP/manifest.json'))
        rp = json.loads(z.read('NaturalDisasters_RP/manifest.json'))
        assert any(d.get('uuid') == rp['header']['uuid'] for d in bp['dependencies']), 'BP does not depend on RP'
        entry = [m for m in bp['modules'] if m['type'] == 'script'][0]['entry']
        assert 'NaturalDisasters_BP/' + entry in names, 'script entry missing in archive'
        for n in names:
            if n.endswith('.json'):
                json.loads(z.read(n))
        total = sum(i.file_size for i in z.infolist())
    sha = hashlib.sha256(open(OUT, 'rb').read()).hexdigest()
    print('built %s: %d files, %.0f KB packed (%.0f KB unpacked), sha256 %s' % (os.path.relpath(OUT, REPO), len(files), os.path.getsize(OUT) / 1024, total / 1024, sha[:16]))


if __name__ == '__main__':
    main()

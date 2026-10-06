#!/usr/bin/env python3
"""Packs the add-on for Minecraft Bedrock.

  python3 build.py            -> dist/GokuUltraInstinct.mcaddon (+ the two .mcpack files)
  python3 build.py --assets   -> regenerate textures/models/items first
"""
import os
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
PACKS = ['GokuUltraInstinct_BP', 'GokuUltraInstinct_RP']
DIST = os.path.join(ROOT, 'dist')


def add_folder(zf, folder, prefix):
    base = os.path.join(ROOT, folder)
    for dirpath, _, files in sorted(os.walk(base)):
        for name in sorted(files):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, base).replace(os.sep, '/')
            info = zipfile.ZipInfo(prefix + rel, date_time=(2024, 6, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(full, 'rb') as f:
                zf.writestr(info, f.read())


def main():
    if '--assets' in sys.argv:
        subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'generate_assets.py')])
        subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'write_items.py')])
    os.makedirs(DIST, exist_ok=True)
    addon = os.path.join(DIST, 'GokuUltraInstinct.mcaddon')
    with zipfile.ZipFile(addon, 'w') as zf:
        for pack in PACKS:
            add_folder(zf, pack, pack + '/')
    for pack in PACKS:
        with zipfile.ZipFile(os.path.join(DIST, pack + '.mcpack'), 'w') as zf:
            add_folder(zf, pack, '')
    print('built', os.path.relpath(addon, ROOT), '(%d KB)' % (os.path.getsize(addon) // 1024))


if __name__ == '__main__':
    main()

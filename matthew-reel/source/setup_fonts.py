"""Fetch the OFL fonts from npm (Fontsource) and install them under unique family names into ~/.fonts.
usage: python3 setup_fonts.py WORKDIR"""
import os, sys, subprocess, tarfile, glob
from fontTools.ttLib import TTFont

work = sys.argv[1] if len(sys.argv) > 1 else 'fonts_work'
os.makedirs(work, exist_ok=True)
pkgs = ['plus-jakarta-sans', 'cinzel', 'playfair-display']
for p in pkgs:
    subprocess.run(['npm', 'pack', f'@fontsource/{p}', '--silent'], cwd=work, check=True)
for tgz in glob.glob(os.path.join(work, '*.tgz')):
    with tarfile.open(tgz) as tf:
        tf.extractall(os.path.join(work, os.path.basename(tgz)[:-4]), filter='data')
def find(name):
    return glob.glob(os.path.join(work, '*', 'package', 'files', name))[0]
jobs = [
    ('plus-jakarta-sans-latin-800-normal.woff2', 'GIM Jakarta XB'),
    ('plus-jakarta-sans-latin-700-normal.woff2', 'GIM Jakarta B'),
    ('cinzel-latin-700-normal.woff2', 'GIM Cinzel B'),
    ('cinzel-latin-900-normal.woff2', 'GIM Cinzel K'),
    ('playfair-display-latin-700-normal.woff2', 'GIM Playfair B'),
    ('playfair-display-latin-800-normal.woff2', 'GIM Playfair XB'),
    ('playfair-display-latin-900-normal.woff2', 'GIM Playfair K'),
]
out = os.path.expanduser('~/.fonts')
os.makedirs(out, exist_ok=True)
for fn, fam in jobs:
    f = TTFont(find(fn))
    f.flavor = None
    for rec in f['name'].names:
        if rec.nameID in (1, 16):
            rec.string = fam
        elif rec.nameID in (2, 17):
            rec.string = 'Regular'
        elif rec.nameID == 4:
            rec.string = fam
        elif rec.nameID == 6:
            rec.string = fam.replace(' ', '')
    f['OS/2'].usWeightClass = 400
    f['OS/2'].fsSelection = (f['OS/2'].fsSelection & ~0b100001) | 0b1000000
    f['head'].macStyle = 0
    f.save(os.path.join(out, fam.replace(' ', '') + '.ttf'))
    print('installed', fam)
subprocess.run(['fc-cache', '-f', out], check=True)

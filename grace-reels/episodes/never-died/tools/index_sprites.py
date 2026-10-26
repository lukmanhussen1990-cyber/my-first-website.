"""Index every PNG under public/sprites into public/sprites/index.json (name -> file, size).

Run after process_gpt_images.py, rig_prep.py and derive_characters.py; the Remotion texture loader reads it.
"""
import json
from pathlib import Path

from PIL import Image

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'

index = {}
for png in sorted(SP.rglob('*.png')):
    name = png.relative_to(SP).with_suffix('').as_posix()
    with Image.open(png) as im:
        index[name] = {'file': f'sprites/{name}.png', 'w': im.width, 'h': im.height}
(SP / 'index.json').write_text(json.dumps(index, indent=1) + '\n')
print(len(index), 'sprites indexed')

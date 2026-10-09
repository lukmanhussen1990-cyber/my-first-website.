#!/usr/bin/env python3
"""Writes the Loe logo drawables. Run from loe-android/: python3 tools/logo/build_icons.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mascot import *

RES = 'app/src/main/res/drawable'
def write(name, text):
    with open(os.path.join(RES, name), 'w') as fh: fh.write(text)

# Adaptive launcher icon layers (108 x 108 dp).
write('ic_launcher_background.xml', vd(bg_violet(), 108))
write('ic_launcher_foreground.xml', vd(on_icon(mascot_white()), 108))
write('ic_launcher_monochrome.xml', vd(on_icon(mascot_mono()), 108))

# The finished icon (the 72 dp a launcher shows), for in-app use. Callers clip the corners.
icon = [bg_violet(), on_icon(mascot_white())]
write('loe_icon.xml', vd(G(icon, tx=-18, ty=-18), 72))

# Android 12+ splash: the icon as a rounded square inside the 192 dp circle of a 288 dp canvas.
k = 152 / 72
write('splash_icon.xml', vd(G([G(icon, clip=rrect(18, 18, 72, 72, 40 / k))], tx=68 - 18 * k, ty=68 - 18 * k, sx=k), 288))

# Header mark: the gradient mascot, cropped to its bounds.
write('loe_mark.xml', vd(G(mascot_color(), tx=-13, ty=-4), 84, wdp=24, hdp=24))

# Status bar icon.
s = 22 / 84
write('ic_notification.xml', vd(G(mascot_mono(), tx=1 - 13 * s, ty=1 - 4 * s, sx=s), 24))

# Full icon as SVG for the README.
os.makedirs('docs', exist_ok=True)
with open('docs/loe-icon.svg', 'w') as fh:
    fh.write(svg([G([G(icon, clip=rrect(18, 18, 72, 72, 17))])], (18, 18, 72, 72), 160))
print('ok')

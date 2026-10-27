"""Render a few still frames to check the map look.

Usage: python3 look_test.py <base-dir> <geo.pkl> <font-dir> <out-dir>
"""
import os
import sys

import cv2

import core
from core import Cam, merc_y, COL

BASE, GEO, FONTS, OUT = sys.argv[1:5]
core.FONT_DIR = FONTS
os.makedirs(OUT, exist_ok=True)

bm = core.BaseMap(BASE)
geo = core.Geo(GEO)


def save(surf, name):
    img = core.snapshot(surf)
    cv2.imwrite(os.path.join(OUT, name), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    print('wrote', name)


# 1. Today: India and Pakistan, J&K grey.
cam = Cam(74.5, merc_y(26.5), 40)
surf, c = core.new_canvas(bm.render(cam))
core.vignette(c, 0.25)
core.fill_region(c, geo.screen_path('KASHMIR', cam), COL['kashmir'])
core.fill_region(c, geo.screen_path('PAK_TODAY', cam), COL['pakistan'])
core.fill_region(c, geo.screen_path('IND_TODAY', cam), COL['india'])
x, y = cam.lonlat(79.0, 22.5)
core.map_pin(c, x, y, 1.0)
core.shadow_text(c, 'India', x, y - 120, core.font('ExtraBold', 64), shadow=0.8, sigma=6)
x, y = cam.lonlat(69.3, 29.0)
core.map_pin(c, x, y, 0.85)
core.shadow_text(c, 'Pakistan', x, y - 105, core.font('ExtraBold', 58), shadow=0.8, sigma=6)
core.caption(c, 'yeh hai Pakistan')
core.watermark(c)
save(surf, 'look_1_today.png')

# 2. Before 1947: one land (British India).
cam = Cam(79.5, merc_y(23.0), 28)
surf, c = core.new_canvas(bm.render(cam))
core.vignette(c, 0.25)
core.fill_region(c, geo.screen_path('BRITISH_INDIA', cam), COL['gold'])
x, y = cam.lonlat(77.21, 28.61)
core.flag_on_pole(c, 'uk', x, y, h=190, wave=1.2)
x, y = cam.lonlat(79.5, 20.5)
core.tag_label(c, 'British India', x, y, size=48)
core.title_3d(c, '1947', core.W / 2, 330, 190, face=(255, 255, 255), side=(150, 150, 160), depth=16)
core.caption(c, 'yeh ek hi desh tha')
core.watermark(c)
save(surf, 'look_2_one_land.png')

# 3. Punjab close-up: the line being drawn.
cam = Cam(74.6, merc_y(31.2), 115, rot=0.0)
surf, c = core.new_canvas(bm.render(cam))
core.vignette(c, 0.25)
core.fill_region(c, geo.screen_path('KASHMIR', cam), COL['kashmir'])
core.fill_region(c, geo.screen_path('BRITISH_INDIA', cam), COL['gold'])
lp, tip = geo.line_path('RADCLIFFE_PUNJAB', cam, 0.72)
core.draw_line(c, lp, width=8)
if tip:
    c.drawCircle(tip[0], tip[1], 16, core.skia.Paint(AntiAlias=True, Color=core.rgba((255, 255, 255), 0.9),
                                                    MaskFilter=core.blur(8)))
x, y = cam.lonlat(74.34, 31.55)
core.tag_label(c, 'Punjab', x - 60, y + 150, size=50)
core.caption(c, 'pashchim mein Punjab')
core.watermark(c)
save(surf, 'look_3_punjab.png')

# 4. 17 August 1947: the border is revealed.
cam = Cam(79.5, merc_y(23.5), 28)
surf, c = core.new_canvas(bm.render(cam))
core.vignette(c, 0.25)
core.fill_region(c, geo.screen_path('IND_1947', cam), COL['india'])
core.fill_region(c, geo.screen_path('PAK_W_1947', cam), COL['pakistan'])
core.fill_region(c, geo.screen_path('PAK_E_1947', cam), COL['pakistan'])
core.fill_region(c, geo.screen_path('KASHMIR', cam), COL['kashmir'])
for key in ('RADCLIFFE_PUNJAB', 'RADCLIFFE_BENGAL'):
    lp, _ = geo.line_path(key, cam, 1.0)
    core.draw_line(c, lp, width=6)
x, y = cam.lonlat(68.5, 27.0)
core.flag_badge(c, 'pakistan', x, y, 52)
x, y = cam.lonlat(90.3, 23.9)
core.flag_badge(c, 'pakistan', x, y, 40)
x, y = cam.lonlat(78.5, 22.0)
core.flag_badge(c, 'india', x, y, 62)
x, y = cam.lonlat(76.5, 34.6)
core.tag_label(c, 'J&K: not decided yet', x, y - 70, size=34, bg=(70, 74, 80))
core.title_3d(c, '17 AUG 1947', core.W / 2, 300, 120, face=(255, 255, 255), side=(150, 150, 160), depth=12)
core.caption(c, 'border ka elaan')
core.watermark(c)
save(surf, 'look_4_17aug.png')

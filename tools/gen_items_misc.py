"""Generates ammunition, attachment, grenade, tool and material icons (16x16)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pix import Canvas, C, shade, preview_sheet, hashn

OUT = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_RP', 'textures', 'items', 'bunker')
SCRATCH = os.environ.get('SCRATCH', '/tmp')
ICONS = {}

def finish(c, dark=0.5, light=1.3):
    c.outline_inner(dark=dark, light=light)
    return c

def new():
    return Canvas()

# ---------------------------------------------------------------- ammo -------
c = new()
c.rect(6, 4, 9, 13, C['gm2']); c.rect(5, 13, 10, 14, C['gm1'])
c.rect(7, 1, 8, 3, C['brass2']); c.set(7, 1, C['cop2']); c.set(8, 1, C['cop2'])
for y in (6, 9, 12): c.hline(7, 8, y, C['gm3'])
ICONS['light_magazine'] = finish(c)

c = new()
for y in range(2, 14):
    off = (y - 2) // 4
    c.hline(5 + off, 8 + off, y, C['gm1'])
c.rect(5, 13, 9, 14, C['gm0'])
c.rect(6, 0, 7, 2, C['brass2']); c.set(6, 0, C['cop2']); c.set(7, 0, C['cop2'])
for y in (5, 8, 11):
    off = (y - 2) // 4
    c.hline(6 + off, 7 + off, y, C['olive2'])
ICONS['rifle_magazine'] = finish(c)

c = new()
c.fill_noise(2, 5, 13, 14, C['red1'], 0.06, 3); c.rect(2, 4, 13, 5, C['red0'])
c.rect(4, 8, 11, 11, C['white']); c.rect(5, 9, 6, 10, C['red1']); c.rect(8, 9, 10, 10, C['red1'])
c.rect(5, 1, 6, 4, C['red2']); c.rect(8, 1, 9, 4, C['red2']); c.hline(5, 6, 4, C['brass2']); c.hline(8, 9, 4, C['brass2'])
ICONS['shell_box'] = finish(c)

c = new()
c.rect(5, 2, 10, 13, C['gm2']); c.rect(6, 4, 9, 11, C['cy1'])
for y in (5, 7, 9): c.hline(6, 9, y, C['cy2'])
c.hline(7, 8, 7, C['cy3']); c.rect(6, 2, 9, 3, C['gm3']); c.rect(6, 12, 9, 13, C['gm3'])
c.set(6, 6, C['cy3']); c.set(7, 8, C['cy3'])
ICONS['energy_cell'] = finish(c)

c = new()
c.rect(7, 2, 8, 12, C['gm6']); c.set(7, 1, C['gm5']); c.set(8, 1, C['gm5'])
c.rect(7, 1, 8, 2, C['white']); c.rect(5, 10, 10, 13, C['blue2']); c.rect(7, 10, 8, 13, C['gm6'])
c.set(7, 6, C['cy2']); c.set(8, 6, C['cy2'])
ICONS['rail_slug'] = finish(c)

c = new()
c.rect(6, 3, 9, 11, C['olive2']); c.rect(7, 1, 8, 2, C['red2']); c.rect(6, 3, 9, 3, C['red2'])
c.rect(4, 10, 5, 13, C['gm1']); c.rect(10, 10, 11, 13, C['gm1']); c.rect(7, 12, 8, 14, C['gm2'])
c.hline(6, 9, 7, C['yel2']); c.set(7, 13, C['or2']); c.set(8, 13, C['or2'])
ICONS['rocket_ammo'] = finish(c)

c = new()
c.fill_noise(1, 5, 14, 13, C['olive1'], 0.06, 5); c.rect(1, 3, 14, 5, C['olive0'])
c.rect(6, 2, 9, 2, C['gm2']); c.set(6, 3, C['gm2']); c.set(9, 3, C['gm2'])
for x in (3, 5, 7, 10, 12): c.vline(x, 8, 10, C['yel2'])
c.hline(3, 4, 8, C['yel2']); c.hline(10, 12, 8, C['yel2']); c.set(5, 7, C['yel2'])
c.rect(2, 11, 3, 12, C['gm3']); c.rect(12, 11, 13, 12, C['gm3'])
ICONS['ammo_box'] = finish(c)

# ------------------------------------------------------------ attachments ----
c = new()
c.rect(1, 6, 14, 9, C['blk2'])
for x in (4, 7, 10): c.vline(x, 6, 9, C['gm2'])
c.rect(1, 7, 2, 8, C['gm3']); c.hline(3, 13, 6, C['gm2'])
ICONS['suppressor'] = finish(c)

c = new()
for y in range(1, 14):
    off = (y - 1) // 5
    c.hline(5 + off, 8 + off, y, C['gm1'])
c.rect(5, 13, 10, 14, C['gm0']); c.rect(6, 0, 7, 1, C['brass2'])
c.rect(11, 3, 13, 5, C['yel2']); c.set(12, 2, C['yel2']); c.set(12, 6, C['yel2']); c.set(10, 4, C['yel2']); c.set(14, 4, C['yel2'])
c.rect(11, 3, 13, 5, C['yel2']); c.set(12, 4, C['yel3'])
ICONS['extended_magazine'] = finish(c)

c = new()
c.rect(3, 10, 12, 12, C['gm1']); c.rect(5, 3, 10, 9, C['gm2']); c.rect(6, 4, 9, 8, C['cy1'])
c.set(7, 5, C['red2']); c.set(8, 5, C['red2']); c.set(7, 6, C['red2']); c.set(8, 6, C['red3'])
c.rect(6, 4, 6, 8, C['cy2']); c.hline(6, 9, 4, C['cy2']); c.rect(7, 9, 8, 10, C['gm3'])
ICONS['reflex_sight'] = finish(c)

c = new()
c.rect(3, 2, 12, 4, C['gm1']); c.rect(6, 4, 9, 13, C['gm2'])
for y in (7, 9, 11): c.hline(7, 8, y, C['gm3'])
c.rect(5, 13, 10, 14, C['gm1'])
ICONS['foregrip'] = finish(c)

c = new()
c.rect(2, 6, 11, 10, C['gm1']); c.rect(12, 7, 13, 9, C['gm2']); c.set(13, 8, C['red2'])
c.hline(14, 15, 8, C['red3']); c.rect(3, 7, 4, 8, C['gm3']); c.set(6, 7, C['red1']); c.rect(4, 10, 9, 12, C['gm2'])
ICONS['laser_sight'] = finish(c)

c = new()
c.rect(1, 5, 14, 10, C['gm3'])
for x in range(3, 12, 2): c.vline(x, 5, 10, C['gm1'])
c.rect(12, 4, 14, 11, C['gm2']); c.set(13, 6, C['gm0']); c.set(13, 9, C['gm0']); c.rect(1, 7, 2, 8, C['gm0'])
ICONS['heavy_barrel'] = finish(c)

# --------------------------------------------------------------- grenades ----
c = new()
for y in range(5, 15):
    half = 3 if y in (5, 14) else 4
    c.hline(8 - half, 7 + half, y, C['olive2'])
for y in (7, 10, 13): c.hline(4, 11, y, C['olive0'])
for x in (6, 9): c.vline(x, 5, 14, C['olive0'])
c.rect(6, 3, 9, 4, C['gm2']); c.rect(9, 1, 10, 2, C['gm5']); c.vline(10, 2, 7, C['gm5'])
c.rect(3, 2, 5, 4, C['brass2']); c.set(4, 3, (0, 0, 0, 0))
ICONS['frag_grenade'] = finish(c)

c = new()
c.rect(5, 3, 10, 14, C['gm4']); c.rect(5, 2, 10, 3, C['gm2']); c.rect(6, 1, 9, 1, C['gm5'])
c.rect(5, 6, 10, 7, C['white']); c.rect(5, 10, 10, 10, C['yel2']); c.rect(5, 12, 10, 12, C['yel2'])
c.vline(11, 1, 5, C['gm5']); c.rect(3, 1, 4, 3, C['brass2']); c.set(7, 6, C['red2']); c.set(8, 6, C['red2'])
ICONS['stun_grenade'] = finish(c)

# --------------------------------------------------------- tools / misc ------
c = new()
c.fill_noise(2, 3, 13, 12, C['steel3'], 0.05, 7)
for x, y in ((3, 4), (12, 4), (3, 11), (12, 11)): c.set(x, y, C['steel0']); c.set(x + (1 if x < 8 else -1), y, C['steel4'])
c.hline(2, 13, 7, C['steel1']); c.hline(2, 13, 8, C['steel4'])
ICONS['steel_plate'] = finish(c)

c = new()
# spring
for y in range(3, 14):
    c.set(2 + (y % 2), y, C['gm5']); c.set(3 + (y % 2), y, C['gm4'])
# bolt
c.rect(7, 4, 13, 6, C['gm3']); c.rect(6, 3, 7, 7, C['gm4'])
for x in (9, 11, 13): c.vline(x, 4, 6, C['gm1'])
# small barrel part
c.rect(7, 9, 14, 11, C['gm2']); c.set(8, 10, C['gm4']); c.rect(12, 8, 14, 12, C['gm3'])
ICONS['weapon_parts'] = finish(c)

c = new()
c.rect(1, 2, 14, 13, C['blue1'])
for x in range(1, 15, 3): c.vline(x, 2, 13, C['blue2'])
for y in range(2, 14, 3): c.hline(1, 14, y, C['blue2'])
c.box(3, 4, 12, 11, C['white']); c.vline(7, 4, 11, C['white']); c.hline(3, 12, 8, C['white'])
c.set(5, 6, C['cy3']); c.set(10, 10, C['cy3']); c.rect(1, 2, 1, 13, C['blue0']); c.rect(14, 2, 14, 13, C['blue3'])
ICONS['bunker_blueprint'] = finish(c, dark=0.6, light=1.15)

c = new()
c.rect(2, 1, 13, 14, C['gm1']); c.rect(3, 2, 12, 11, C['teal1'])
c.hline(4, 11, 3, C['teal3']); c.hline(4, 8, 5, C['teal3']); c.hline(4, 10, 7, C['teal2']); c.hline(4, 6, 9, C['teal3'])
c.rect(9, 8, 11, 10, C['teal4']); c.set(10, 9, C['teal1']); c.rect(7, 12, 8, 13, C['gm3']); c.set(4, 12, C['gr2'])
ICONS['field_terminal'] = finish(c)

c = new()
c.fill_noise(1, 4, 14, 13, C['white'], 0.04, 11); c.rect(1, 3, 14, 4, C['grey']); c.rect(6, 2, 9, 3, C['gm3'])
c.rect(6, 6, 9, 12, C['red2']); c.rect(3, 8, 12, 10, C['red2']); c.rect(7, 7, 8, 11, C['red3']); c.hline(4, 11, 9, C['red3'])
ICONS['medkit'] = finish(c, dark=0.6, light=1.08)

c = new()
c.rect(2, 2, 13, 13, C['teal2']); c.rect(3, 3, 12, 12, C['teal3']); c.rect(5, 5, 10, 10, C['teal1'])
c.rect(6, 6, 9, 9, C['brass2']); c.rect(7, 7, 8, 8, C['brass3']); c.set(13, 2, C['cop3']); c.set(2, 13, C['cop3'])
ICONS['bunker_key'] = finish(c)

def run():
    paths = []
    for name, c in ICONS.items():
        p = os.path.join(OUT, name + '.png'); c.save(p); paths.append(p)
    print('wrote', len(paths), 'icons; preview', preview_sheet(paths, os.path.join(SCRATCH, 'preview_misc.png'), scale=8, cols=7))

if __name__ == '__main__':
    run()

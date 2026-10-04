"""Generates the 16x16 diagonal weapon icons (vanilla tool style)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pix import Canvas, Diag, C, shade, preview_sheet

OUT = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_RP', 'textures', 'items', 'bunker')
SCRATCH = os.environ.get('SCRATCH', '/tmp')

def gun(parts, dots=(), x0=1, y0=13, post=None):
    """parts: (u0,u1,v0,v1,col[,thin]) - each part is shaded on its own so parts stay readable.
    thin=True draws a 1-wide line as a solid 2px staircase (grips, magazines, barrels)."""
    c = Canvas()
    d = Diag(c, x0, y0)
    for part in parts:
        u0, u1, v0, v1, col = part[:5]
        thin = len(part) > 5 and part[5]
        layer = Canvas()
        dl = Diag(layer, x0, y0)
        dl.rect(u0, u1, v0, v1, C[col] if isinstance(col, str) else col)
        dl.commit(min_neighbors=2 if thin else 3)
        layer.outline_inner(dark=0.72 if thin else 0.55, light=1.25)
        c.blit(layer, 0, 0)
    c.silhouette_outline_soft = None
    # darken the outer silhouette a little more for the classic vanilla edge
    src = [row[:] for row in c.px]
    for y in range(c.h):
        for x in range(c.w):
            if src[y][x][3] and any(not (0 <= x+dx < c.w and 0 <= y+dy < c.h and src[y+dy][x+dx][3]) for dx, dy in ((1,0),(0,1))):
                c.px[y][x] = shade(src[y][x], 0.7)
    for (u, v, col) in dots:
        x, y = d.map(u, v)
        c.set(x, y, C[col] if isinstance(col, str) else col)
    if post:
        post(c, d)
    return c

ICONS = {}

# ---- Service Pistol -------------------------------------------------------
ICONS['service_pistol'] = gun([
    (2, 8, -1, 0, 'gm4'),      # slide
    (2, 7, 1, 1, 'gm3'),       # frame
    (9, 9, -1, 0, 'gm2'),      # muzzle
    (1, 0, 1, 4, 'gm2', True),  # grip
    (3, 4, 2, 2, 'gm1', True),  # trigger guard
], dots=[(8, -2, 'gm5'), (3, -2, 'gm5'), (1, 3, 'gm1'), (2, 4, 'brass1')], x0=4, y0=11)

# ---- Wasp SMG -------------------------------------------------------------
ICONS['wasp_smg'] = gun([
    (0, 1, -1, -1, 'gm2', True),  # folding stock
    (2, 8, -1, 0, 'gm3'),      # receiver
    (9, 11, -1, 0, 'gm2'),     # shroud
    (3, 3, 0, 3, 'gm2', True),  # grip
    (6, 6, 0, 4, 'gm1', True),  # long magazine
    (5, 5, 1, 1, 'gm1', True),  # trigger guard
], dots=[(8, -2, 'gm5'), (10, -1, 'gm1'), (9, -1, 'gm1'), (7, 4, 'brass1')], x0=2, y0=12)

# ---- Ranger Assault Rifle ---------------------------------------------------
ICONS['ranger_rifle'] = gun([
    (0, 2, -1, 1, 'olive1'),   # stock
    (3, 8, -1, 0, 'gm3'),      # receiver
    (3, 8, -2, -2, 'gm1', True),  # top rail
    (8, 10, -1, 0, 'olive2'),  # handguard
    (11, 12, -1, -1, 'gm1', True),  # barrel
    (4, 4, 0, 3, 'gm2', True),  # grip
    (6, 6, 0, 3, 'gm1', True),  # magazine
], dots=[(8, -3, 'gm5'), (3, -3, 'gm5'), (9, 0, 'gm1'), (7, 3, 'brass1')], x0=1, y0=13)

# ---- Breacher Shotgun -------------------------------------------------------
ICONS['breacher_shotgun'] = gun([
    (0, 2, -1, 1, 'wd2'),      # stock
    (3, 3, 0, 2, 'wd1', True),  # pistol grip
    (3, 6, -1, 0, 'gm3'),      # receiver
    (7, 12, -1, 0, 'gm2'),     # barrel + tube
    (7, 9, 1, 1, 'wd3', True),  # pump
], dots=[(12, -2, 'brass2'), (5, 0, 'gm1'), (6, 1, 'gm1'), (1, 0, 'wd3')], x0=1, y0=13)

# ---- Longshot DMR -----------------------------------------------------------
ICONS['longshot_dmr'] = gun([
    (0, 2, -1, 1, 'gm2'),      # stock
    (3, 8, -1, 0, 'gm3'),      # receiver
    (9, 13, -1, -1, 'gm2', True),  # long barrel
    (5, 8, -3, -2, 'gm1'),     # scope
    (4, 4, 0, 3, 'gm2', True),  # grip
    (6, 6, 0, 3, 'gm1', True),  # magazine
    (10, 10, 0, 2, 'gm1', True),  # bipod
], dots=[(8, -3, 'cy2'), (5, -3, 'gm5'), (12, -1, 'gm1'), (1, 1, 'gm1')], x0=1, y0=14)

# ---- Bulwark LMG ------------------------------------------------------------
ICONS['bulwark_lmg'] = gun([
    (0, 2, -1, 1, 'gm2'),      # stock
    (3, 8, -2, 0, 'gm3'),      # bulky receiver
    (5, 7, -3, -3, 'gm1', True),  # carry handle
    (9, 12, -1, 0, 'gm2'),     # barrel
    (4, 4, 0, 3, 'gm2', True),  # grip
    (6, 7, 1, 3, 'olive1'),    # box magazine
    (10, 10, 0, 2, 'gm1', True),  # bipod
], dots=[(10, -1, 'gm1'), (11, 0, 'gm1'), (7, 3, 'olive3'), (8, -1, 'gm5')], x0=1, y0=13)

# ---- Pulse Rifle (energy) ---------------------------------------------------
ICONS['pulse_rifle'] = gun([
    (0, 1, -1, 0, 'gm2'),      # stock
    (1, 9, -2, 0, 'gm2'),      # body
    (2, 8, -1, -1, 'cy2', True),  # energy channel
    (10, 12, -1, 0, 'cy1'),    # emitter
    (10, 10, -2, -2, 'gm3', True),  # fin
    (3, 3, 0, 3, 'gm1', True),  # grip
    (6, 6, 0, 3, 'cy1', True),  # cell
], dots=[(12, -1, 'cy3'), (6, 2, 'cy3'), (9, -2, 'cy2'), (3, -2, 'gm4')], x0=1, y0=13)

# ---- Plasma Pistol ----------------------------------------------------------
ICONS['plasma_pistol'] = gun([
    (1, 7, -2, 0, 'gm2'),      # body
    (8, 9, -1, 0, 'gr1'),      # emitter
    (3, 6, -1, -1, 'gr2', True),  # core
    (1, 0, 1, 3, 'gm1', True),  # grip
    (3, 4, 1, 1, 'gm1', True),  # trigger guard
], dots=[(9, -1, 'gr3'), (4, -2, 'gr2'), (6, -2, 'gr2'), (2, 2, 'gr1')], x0=4, y0=11)

# ---- Railgun ----------------------------------------------------------------
ICONS['railgun'] = gun([
    (0, 0, -1, 1, 'gm2'),      # butt
    (1, 6, -2, 0, 'gm2'),      # body
    (6, 13, -2, -2, 'gm5', True),  # top rail
    (6, 13, 0, 0, 'gm5', True),  # bottom rail
    (7, 12, -1, -1, 'cy2', True),  # magnetic field
    (3, 5, 1, 3, 'blue1'),     # capacitor
    (1, 0, 1, 3, 'gm1', True),  # grip
], dots=[(13, -1, 'cy4'), (9, -1, 'cy4'), (4, 2, 'blue3'), (2, -2, 'cy2')], x0=1, y0=14)

# ---- Thumper Rocket Launcher ------------------------------------------------
ICONS['thumper_launcher'] = gun([
    (0, 1, -2, 0, 'olive1'),   # rear cap
    (1, 12, -2, 0, 'olive2'),  # tube
    (12, 12, -3, 1, 'olive1'), # muzzle ring
    (13, 13, -2, 0, 'olive1'),
    (5, 6, -3, -3, 'gm1', True),  # sight
    (4, 4, 0, 3, 'gm1', True),  # grip
    (8, 9, 1, 1, 'gm2', True),  # fore grip
], dots=[(13, -1, 'red2'), (3, -1, 'olive3'), (7, -1, 'olive3'), (10, -1, 'yel2'), (6, -3, 'gm5')], x0=1, y0=15)

# ---- Combat Knife -----------------------------------------------------------
def knife_post(c, d):
    for u in range(6, 14):
        x, y = d.map(u, -1)
        c.set(x, y, C['white'])
ICONS['combat_knife'] = gun([
    (0, 0, -1, 0, 'gm1'),      # pommel
    (1, 4, -1, 0, 'olive0'),   # handle
    (5, 5, -2, 1, 'gm1', True),  # guard
    (6, 13, -1, 0, 'gm6'),     # blade
    (14, 14, -1, -1, 'gm6', True),  # tip
], dots=[(2, -1, 'olive1'), (3, 0, 'olive1')], x0=1, y0=14, post=knife_post)

# ---- Stun Baton -------------------------------------------------------------
ICONS['stun_baton'] = gun([
    (0, 4, -1, 0, 'blk2'),     # handle
    (5, 5, -2, 1, 'gm2', True),  # guard
    (6, 10, -1, 0, 'gm4'),     # shaft
    (11, 13, -1, 0, 'cy2'),    # electrode
], dots=[(1, 0, 'gm2'), (3, 0, 'gm2'), (13, -2, 'cy3'), (12, 1, 'cy3'), (13, -1, 'cy4')], x0=1, y0=14)

def run():
    paths = []
    for name, c in ICONS.items():
        p = os.path.join(OUT, name + '.png')
        c.save(p)
        paths.append(p)
    prev = preview_sheet(paths, os.path.join(SCRATCH, 'preview_guns.png'), scale=10, cols=6)
    print('wrote', len(paths), 'icons; preview', prev)

if __name__ == '__main__':
    run()

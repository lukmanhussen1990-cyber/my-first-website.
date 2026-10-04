"""Generates block textures, entity textures and pack icons for the Bunker Arsenal add-on."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pix import Canvas, C, shade, preview_sheet, hashn
from PIL import Image

RP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_RP')
BP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_BP')
OUT = os.path.join(RP, 'textures', 'blocks', 'bunker')
ENT = os.path.join(RP, 'textures', 'entity', 'bunker')
SCRATCH = os.environ.get('SCRATCH', '/tmp')
TEX = {}

def steel_base(c, x0, y0, x1, y1, base='steel2', seed=1, amount=0.05):
    c.fill_noise(x0, y0, x1, y1, C[base], amount, seed)

def rivet(c, x, y, dark='steel0', light='steel4'):
    c.set(x, y, C[dark]); c.set(x + 1, y, C[light]); c.set(x, y + 1, C[light]); c.set(x + 1, y + 1, C[dark])

# ---- Reinforced wall ---------------------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 1)
c.hline(0, 15, 0, C['steel0']); c.vline(0, 0, 15, C['steel0']); c.hline(1, 15, 1, C['steel4']); c.vline(1, 1, 15, C['steel4'])
c.hline(0, 15, 15, C['steel1']); c.vline(15, 0, 15, C['steel1'])
for x, y in ((3, 3), (11, 3), (3, 11), (11, 11)): rivet(c, x, y)
c.hline(6, 9, 7, C['steel1']); c.hline(6, 9, 8, C['steel3'])
TEX['reinforced_wall'] = c

# ---- Reinforced panel (oxidized teal, copper rivets) --------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'teal2', 2, 0.06)
c.box(0, 0, 15, 15, C['teal0']); c.box(1, 1, 14, 14, C['teal1']); c.hline(1, 14, 1, C['teal4']); c.vline(1, 1, 14, C['teal4'])
c.fill_noise(3, 3, 12, 12, C['teal3'], 0.05, 3)
for x, y in ((2, 2), (12, 2), (2, 12), (12, 12)): rivet(c, x, y, 'cop1', 'cop3')
c.hline(5, 10, 7, C['teal1']); c.hline(5, 10, 8, C['teal4'])
TEX['reinforced_panel'] = c

# ---- Reinforced floor -------------------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel1', 4, 0.06)
for y in (0, 8): c.hline(0, 15, y, C['steel0'])
for x in (0, 8): c.vline(x, 0, 15, C['steel0'])
for y in (1, 9): c.hline(1, 15, y, C['steel3'])
for x in (1, 9): c.vline(x, 1, 15, C['steel3'])
for tx in (1, 9):
    for ty in (1, 9):
        for i in range(3):
            c.set(tx + 2 + i * 2, ty + 2 + i * 2, C['steel2'])
TEX['reinforced_floor'] = c

# ---- Hazard block ------------------------------------------------------------
c = Canvas()
for y in range(16):
    for x in range(16):
        c.set(x, y, C['yel2'] if ((x + y) // 4) % 2 == 0 else C['blk2'])
for y in range(16):
    for x in range(16):
        if ((x + y) // 4) % 2 == 0 and (x + y) % 4 == 0: c.set(x, y, C['yel1'])
c.box(0, 0, 15, 15, C['steel1'])
TEX['hazard_block'] = c

# ---- Floor grate --------------------------------------------------------------
c = Canvas(); c.rect(0, 0, 15, 15, C['blk'])
for y in range(0, 16, 4):
    c.hline(0, 15, y, C['steel3']); c.hline(0, 15, y + 1, C['steel2'])
for x in range(0, 16, 4):
    c.vline(x, 0, 15, C['steel3']); c.vline(x + 1, 0, 15, C['steel1'])
TEX['floor_grate'] = c

# ---- Vent -----------------------------------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 5)
c.box(0, 0, 15, 15, C['steel1']); c.hline(1, 14, 1, C['steel4']); c.vline(1, 1, 14, C['steel4'])
for y in range(3, 13, 2):
    c.hline(3, 12, y, C['steel0']); c.hline(3, 12, y + 1, C['steel3'])
for x, y in ((1, 1), (13, 1), (1, 13), (13, 13)): rivet(c, x, y)
TEX['vent'] = c

# ---- Blast door (16 wide x 32 tall: upper half rows 0-15, lower half rows 16-31) -----
c = Canvas(16, 32); steel_base(c, 0, 0, 15, 31, 'steel3', 6, 0.04)
c.box(0, 0, 15, 31, C['steel0']); c.vline(1, 1, 30, C['steel4']); c.hline(1, 14, 1, C['steel4'])
c.vline(14, 1, 30, C['steel1']); c.hline(1, 14, 30, C['steel1'])
# window
c.rect(5, 4, 10, 9, C['steel0']); c.rect(6, 5, 9, 8, C['cy0']); c.set(6, 5, C['teal4']); c.set(7, 5, C['teal3']); c.set(6, 6, C['teal3'])
# hazard band across the seam
for y in range(13, 19):
    for x in range(2, 14):
        c.set(x, y, C['yel2'] if ((x + y) // 3) % 2 == 0 else C['blk2'])
c.hline(2, 13, 15, C['steel0']); c.hline(2, 13, 16, C['steel0'])
# lower teal plate + copper handle
c.rect(3, 21, 12, 27, C['teal2']); c.box(3, 21, 12, 27, C['teal1']); c.hline(4, 11, 22, C['teal4'])
c.rect(11, 12, 12, 19, C['cop2']); c.vline(11, 12, 19, C['cop3'])
for x, y in ((2, 2), (12, 2), (2, 28), (12, 28)): rivet(c, x, y)
TEX['blast_door'] = c

# ---- Lamp variants -------------------------------------------------------------
def lamp(center_cols, outer):
    c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 7)
    c.box(0, 0, 15, 15, C['steel0']); c.box(1, 1, 14, 14, C['steel3']); c.box(2, 2, 13, 13, C['steel1'])
    c.rect(3, 3, 12, 12, center_cols[0]); c.rect(4, 4, 11, 11, center_cols[1]); c.rect(6, 6, 9, 9, center_cols[2])
    c.box(3, 3, 12, 12, outer)
    for x, y in ((1, 1), (13, 1), (1, 13), (13, 13)): rivet(c, x, y)
    return c
TEX['lamp_on'] = lamp((C['lamp1'], C['lamp2'], C['lamp3']), C['lamp0'])
TEX['lamp_off'] = lamp((C['steel1'], C['steel2'], C['steel3']), C['steel0'])
TEX['lamp_alarm'] = lamp((C['red1'], C['red2'], C['red3']), C['red0'])

# ---- Control panel ---------------------------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 8)
c.box(0, 0, 15, 15, C['steel0']); c.rect(2, 2, 13, 9, C['cy0'])
for x in range(3, 13, 3): c.vline(x, 2, 9, C['teal1'])
for y in range(3, 9, 3): c.hline(2, 13, y, C['teal1'])
c.line(3, 8, 11, 3, C['teal3']); c.set(7, 5, C['cy3']); c.set(10, 4, C['red2']); c.set(5, 7, C['gr2'])
for i, col in enumerate(('red2', 'yel2', 'gr2', 'cy2', 'white')):
    c.rect(2 + i * 2 + (i // 2), 11, 3 + i * 2 + (i // 2), 12, C[col])
c.rect(2, 13, 13, 14, C['steel1']); c.hline(2, 13, 14, C['steel3'])
TEX['control_panel_top'] = c
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 9)
c.box(0, 0, 15, 15, C['steel0']); c.hline(1, 14, 1, C['steel4'])
for y in range(10, 15, 2): c.hline(3, 12, y, C['steel0'])
c.rect(2, 3, 13, 5, C['teal2']); c.hline(2, 13, 3, C['teal4'])
TEX['control_panel_side'] = c
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 10)
c.box(0, 0, 15, 15, C['steel0']); c.hline(1, 14, 1, C['steel4'])
for y in range(12, 15):
    for x in range(1, 15): c.set(x, y, C['yel2'] if ((x + y) // 2) % 2 == 0 else C['blk2'])
c.rect(5, 4, 10, 8, C['steel1']); c.set(6, 5, C['gr2']); c.set(9, 5, C['red2']); c.hline(6, 9, 7, C['steel3'])
TEX['control_panel_front'] = c

# ---- Server rack (front is a 4 frame flipbook 16x64) ---------------------------
c = Canvas(16, 64)
for f in range(4):
    oy = f * 16
    c.fill_noise(0, oy, 15, oy + 15, C['gm1'], 0.04, 11 + f)
    c.box(0, oy, 15, oy + 15, C['gm0']); c.vline(1, oy + 1, oy + 14, C['gm3'])
    for unit in range(4):
        uy = oy + 1 + unit * 4
        c.rect(2, uy, 13, uy + 2, C['gm2']); c.hline(2, 13, uy, C['gm3'])
        c.rect(2, uy + 1, 3, uy + 1, C['gm4']); c.rect(12, uy + 1, 13, uy + 1, C['gm4'])
        for i in range(5):
            on = hashn(i, unit, f + 20) > 0.45
            col = ('gr2' if (i + unit) % 3 else 'cy2') if on else 'gm0'
            if unit == 2 and i == 1 and f % 2: col = 'red2'
            c.set(5 + i, uy + 1, C[col])
TEX['server_rack_front'] = c
c = Canvas(); c.fill_noise(0, 0, 15, 15, C['gm2'], 0.04, 12); c.box(0, 0, 15, 15, C['gm0'])
for y in range(3, 13, 2): c.hline(3, 12, y, C['gm1'])
TEX['server_rack_side'] = c
c = Canvas(); c.fill_noise(0, 0, 15, 15, C['gm2'], 0.04, 13); c.box(0, 0, 15, 15, C['gm0']); c.rect(6, 6, 9, 9, C['gm1'])
TEX['server_rack_top'] = c

# ---- Monitor (4 frame flipbook) --------------------------------------------------
c = Canvas(16, 64)
for f in range(4):
    oy = f * 16
    c.rect(0, oy, 15, oy + 15, C['gm1']); c.box(0, oy, 15, oy + 15, C['gm0'])
    c.rect(2, oy + 2, 13, oy + 11, C['cy0'])
    for x in range(3, 13, 4): c.vline(x, oy + 2, oy + 11, C['teal1'])
    c.hline(2, 13, oy + 6, C['teal1'])
    # moving blip + bars
    bx, by = 4 + f * 2, oy + 4 + (f % 2) * 3
    c.set(bx, by, C['teal5']); c.set(bx + 1, by, C['teal3'])
    for i in range(4):
        h = 1 + int(hashn(i, f, 31) * 4)
        c.vline(3 + i * 3, oy + 11 - h, oy + 10, C['gr2'] if i != 2 else C['yel2'])
    c.hline(2, 13, oy + 12, C['gm3']); c.rect(6, oy + 13, 9, oy + 14, C['gm2']); c.set(13, oy + 13, C['gr2'] if f % 2 else C['red2'])
TEX['monitor'] = c

# ---- Crates -----------------------------------------------------------------------
def crate(base, dark, stripe, label, seed):
    s = Canvas(); s.fill_noise(0, 0, 15, 15, C[base], 0.06, seed)
    for y in (0, 5, 10, 15): s.hline(0, 15, y, C[dark])
    s.rect(0, 0, 2, 2, C['gm3']); s.rect(13, 0, 15, 2, C['gm3']); s.rect(0, 13, 2, 15, C['gm3']); s.rect(13, 13, 15, 15, C['gm3'])
    s.rect(3, 7, 12, 8, C[stripe]); 
    for i, x in enumerate(label): s.set(x, 7, C['blk2']); s.set(x, 8, C['blk2'])
    t = Canvas(); t.fill_noise(0, 0, 15, 15, C[base], 0.06, seed + 1)
    t.box(0, 0, 15, 15, C[dark]); t.box(3, 3, 12, 12, C[dark]); t.hline(4, 11, 4, C[stripe])
    for x, y in ((1, 1), (13, 1), (1, 13), (13, 13)): rivet(t, x, y, 'gm1', 'gm4')
    o = Canvas(); o.fill_noise(0, 0, 15, 15, C[base], 0.06, seed + 2); o.box(0, 0, 15, 15, C[dark])
    o.rect(2, 2, 13, 13, C['blk']); o.rect(3, 3, 12, 12, C['gm0'])
    return s, t, o
s, t, o = crate('olive1', 'olive0', 'yel2', (4, 6, 8, 10), 40)
o.rect(4, 8, 6, 11, C['brass2']); o.rect(8, 5, 10, 8, C['olive2']); o.set(9, 9, C['red2']); o.set(11, 10, C['cy2'])
TEX['supply_crate_side'], TEX['supply_crate_top'], TEX['supply_crate_open'] = s, t, o
s, t, o = crate('gm2', 'gm0', 'teal3', (4, 7, 10), 50)
s.rect(3, 7, 12, 8, C['teal3']); s.set(7, 7, C['cop3']); s.set(8, 8, C['cop3'])
o.line(4, 11, 11, 4, C['gm5']); o.line(5, 11, 11, 5, C['gm5']); o.rect(5, 8, 6, 10, C['gm4']); o.set(10, 4, C['cy2'])
TEX['weapon_crate_side'], TEX['weapon_crate_top'], TEX['weapon_crate_open'] = s, t, o

# ---- Locker ------------------------------------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 60)
c.box(0, 0, 15, 15, C['steel0']); c.vline(1, 1, 14, C['steel4']); c.hline(1, 14, 1, C['steel4'])
for y in (3, 5, 7): c.hline(4, 11, y, C['steel0'])
c.rect(11, 10, 12, 12, C['cop3']); c.set(12, 11, C['cop1']); c.rect(5, 11, 8, 12, C['steel1']); c.hline(5, 8, 11, C['white'])
TEX['locker_front'] = c
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel2', 61); c.box(0, 0, 15, 15, C['steel0']); c.hline(1, 14, 1, C['steel4'])
TEX['locker_side'] = c

# ---- Bunker Table (steel table top) -----------------------------------------------
c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel3', 70); c.box(0, 0, 15, 15, C['steel1']); c.hline(1, 14, 1, C['steel5'])
TEX['steel_top'] = c

# ---- Entity textures (8x8, used with per-face UVs) ---------------------------------
ENTS = {}
e = Canvas(8, 8); e.rect(0, 0, 7, 7, C['olive2'])
for i in (0, 3, 6): e.hline(0, 7, i, C['olive0']); e.vline(i, 0, 7, C['olive0'])
ENTS['grenade'] = e
e = Canvas(8, 8); e.rect(0, 0, 7, 7, C['gm4']); e.hline(0, 7, 3, C['white']); e.hline(0, 7, 4, C['white']); e.hline(0, 7, 6, C['yel2'])
ENTS['stun_charge'] = e
e = Canvas(8, 8); e.rect(0, 0, 7, 7, C['olive2']); e.rect(0, 0, 7, 1, C['red2']); e.hline(0, 7, 5, C['yel2']); e.rect(0, 7, 7, 7, C['gm1'])
ENTS['rocket'] = e

def pack_icon():
    base = TEX['reinforced_panel'].to_image().copy()
    gun = Image.open(os.path.join(RP, 'textures', 'items', 'bunker', 'pulse_rifle.png')).convert('RGBA')
    base.alpha_composite(gun)
    return base.resize((128, 128), Image.NEAREST)

def run():
    paths = []
    for name, c in TEX.items():
        p = os.path.join(OUT, name + '.png'); c.save(p); paths.append(p)
    for name, c in ENTS.items():
        p = os.path.join(ENT, name + '.png'); c.save(p); paths.append(p)
    icon = pack_icon()
    icon.save(os.path.join(RP, 'pack_icon.png')); icon.save(os.path.join(BP, 'pack_icon.png'))
    print('wrote', len(paths), 'textures; preview', preview_sheet(paths, os.path.join(SCRATCH, 'preview_blocks.png'), scale=6, cols=10))


# ---- Pipe (appended) ---------------------------------------------------------------------
def _pipe():
    c = Canvas(); steel_base(c, 0, 0, 15, 15, 'steel3', 80)
    c.vline(0, 0, 15, C['steel1']); c.vline(15, 0, 15, C['steel1']); c.vline(1, 0, 15, C['steel5']); c.vline(14, 0, 15, C['steel2'])
    for y in (2, 3, 12, 13): c.hline(0, 15, y, C['teal2'])
    c.hline(0, 15, 2, C['teal3']); c.hline(0, 15, 12, C['teal3'])
    for x, y in ((3, 5), (11, 5), (3, 9), (11, 9)): rivet(c, x, y, 'steel1', 'steel4')
    return c
TEX['pipe'] = _pipe()
if __name__ == '__main__':
    run()

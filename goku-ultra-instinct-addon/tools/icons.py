"""16x16 item icons.  Energy attacks are drawn procedurally, objects by hand."""
import math
import random

from PIL import Image

from pixelkit import ascii_icon, mix, rgba

T = (0, 0, 0, 0)


def _orb(img, cx, cy, radius, ramp, rim=None):
    """Quantised radial gradient: ramp[0] is the hot core, ramp[-1] the edge."""
    n = len(ramp)
    for y in range(img.height):
        for x in range(img.width):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > radius:
                continue
            idx = min(n - 1, int(d / radius * n))
            img.putpixel((x, y), ramp[idx])
    if rim:
        _outline(img, rim)


def _outline(img, color):
    src = img.copy()
    for y in range(img.height):
        for x in range(img.width):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < img.width and 0 <= ny < img.height and src.getpixel((nx, ny))[3] > 200:
                    img.putpixel((x, y), color)
                    break


def _sparkles(img, points, color):
    for (x, y) in points:
        img.putpixel((x, y), color)


def _star(img, x, y, color, glow):
    img.putpixel((x, y), color)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if 0 <= x + dx < 16 and 0 <= y + dy < 16 and img.getpixel((x + dx, y + dy))[3] == 0:
            img.putpixel((x + dx, y + dy), glow)


def icon_kamehameha():
    img = Image.new('RGBA', (16, 16), T)
    ramp = [rgba('#FFFFFF'), rgba('#E6FBFF'), rgba('#9DEBFF'), rgba('#4FC3FF'), rgba('#2A83F0'), rgba('#1B4FC0')]
    # beam leaving the ball towards the top right
    for t in range(0, 60):
        f = t / 60
        cx = 6.0 + f * 9.5
        cy = 9.5 - f * 9.0
        r = 2.6 - f * 1.0
        for y in range(16):
            for x in range(16):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if d <= r:
                    k = min(len(ramp) - 1, 2 + int(d / r * 4))
                    cur = img.getpixel((x, y))
                    if cur[3] == 0:
                        img.putpixel((x, y), ramp[k])
    ball = Image.new('RGBA', (16, 16), T)
    _orb(ball, 6.0, 9.5, 5.6, ramp)
    img.alpha_composite(ball)
    _outline(img, rgba('#123A8C'))
    _star(img, 13, 12, rgba('#FFFFFF'), rgba('#9DEBFF'))
    _star(img, 2, 2, rgba('#FFFFFF'), rgba('#9DEBFF'))
    return img


def icon_ki_blast():
    img = Image.new('RGBA', (16, 16), T)
    ramp = [rgba('#FFFFFF'), rgba('#FFFBD6'), rgba('#FFF07A'), rgba('#FFC93C'), rgba('#FF9A1F')]
    # four short rays
    ray = rgba('#FFE066')
    for i in range(2, 14):
        if abs(i - 7.5) > 3.6:
            img.putpixel((i, 7), ray)
            img.putpixel((i, 8), ray)
            img.putpixel((7, i), ray)
            img.putpixel((8, i), ray)
    ball = Image.new('RGBA', (16, 16), T)
    _orb(ball, 8, 8, 4.6, ramp)
    img.alpha_composite(ball)
    _outline(img, rgba('#B35A00'))
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)):
        img.putpixel((x, y), rgba('#FFF4A8'))
    return img


def icon_spirit_bomb():
    img = Image.new('RGBA', (16, 16), T)
    ramp = [rgba('#FFFFFF'), rgba('#EAF6FF'), rgba('#C6E8FF'), rgba('#94D1FF'), rgba('#5FAEF7'), rgba('#3E86E6')]
    _orb(img, 8, 8, 7.4, ramp, rim=None)
    rnd = random.Random(5)
    # swirling energy specks
    for _ in range(14):
        a = rnd.random() * math.tau
        r = 3.5 + rnd.random() * 3
        x, y = int(8 + math.cos(a) * r), int(8 + math.sin(a) * r)
        if 0 <= x < 16 and 0 <= y < 16 and img.getpixel((x, y))[3]:
            img.putpixel((x, y), rgba('#FFFFFF'))
    _outline(img, rgba('#2659B8'))
    return img


def icon_ultra_instinct():
    img = Image.new('RGBA', (16, 16), T)
    # silver aura flame
    edge = rgba('#3D5BB0')
    ramp = [rgba('#FFFFFF'), rgba('#EEF2FA'), rgba('#CBD5EA'), rgba('#9FB0D6'), rgba('#7088C8')]
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            # body of the flame: circle at the bottom, tapering towards a tip
            d_circle = math.hypot(px - 8, py - 10.5) / 5.0
            if py < 10.5:
                half = 5.0 * ((py - 1.0) / 9.5) ** 0.8 if py > 1.0 else 0
                wobble = 0.9 * math.sin(py * 1.3)
                inside = abs(px - 8 - wobble * (1 - (py - 1) / 9.5)) <= half
                d = abs(px - 8) / max(half, 0.01) * 0.7 + (10.5 - py) / 9.5 * 0.3
            else:
                inside = d_circle <= 1.0
                d = d_circle
            if inside:
                img.putpixel((x, y), ramp[min(len(ramp) - 1, int(d * len(ramp)))])
    _outline(img, edge)
    _star(img, 2, 4, rgba('#FFFFFF'), rgba('#BFD4FF'))
    _star(img, 13, 2, rgba('#FFFFFF'), rgba('#BFD4FF'))
    _star(img, 13, 9, rgba('#FFFFFF'), rgba('#BFD4FF'))
    return img


SKIN = {'k': rgba('#5A3A22'), 'S': rgba('#F2C38E'), 's': rgba('#D9A06A'), 'h': rgba('#FFE0B8')}


def icon_instant_transmission():
    rows = [
        '.............w..',
        '......kk.kk.wWw.',
        '.....khSkhSk.w..',
        '.....kSSkSSk....',
        '.....kSskSsk..p.',
        '.....kSSkSSk.pWp',
        '.....kSskSsk..p.',
        '...kkkSSkSSkk...',
        '..kSSkSSSSSSSk..',
        '..kSssSSSSSSSk..',
        '..kSSSssSSSSsk..',
        '...kkSSSSSSSk...',
        '....kSSSSSSsk...',
        '....kBBBBBBBk...',
        '....kbbbbbbbk...',
        '.....kkkkkkk....',
    ]
    pal = dict(SKIN)
    pal.update({'B': rgba('#2A4FC0'), 'b': rgba('#1A3388'), 'w': rgba('#D9C8FF'),
                'W': rgba('#FFFFFF'), 'p': rgba('#B79CFF')})
    return ascii_icon(rows, pal)


def icon_dragon_fist():
    rows = [
        '..y.....y.....y.',
        '.yYy...yYy...yY.',
        '..yYy.yYYy..yYy.',
        '...ykkkkkkkkky..',
        '..ykSSkSSkSSkSky',
        '..ykShkShkShkSk.',
        '.yYkSSSSSSSSSSk.',
        '..ykSsSSsSSsSSky',
        '...kSSSSSSSSSsk.',
        '..ykkSSSSSSSskyY',
        '.yYykSSSSSSSskY.',
        '..yykBBBBBBBBky.',
        '...ykbbbbbbbbky.',
        '..yYykkkkkkkkyY.',
        '...yYy.yYy..yy..',
        '....y...y.......',
    ]
    pal = dict(SKIN)
    pal.update({'B': rgba('#2A4FC0'), 'b': rgba('#1A3388'),
                'Y': rgba('#FFD43B'), 'y': rgba('#F59F00')})
    return ascii_icon(rows, pal)


def icon_power_pole():
    rows = [
        '.............kkk',
        '............kYYk',
        '...........kYyYk',
        '..........kRRyk.',
        '.........kRrRk..',
        '........kRrRk...',
        '.......kRrRk....',
        '......kRrRk.....',
        '.....kRrRk......',
        '....kRrRk.......',
        '...kRrRk........',
        '..kRrRk.........',
        '.kYyRk..........',
        'kYyYk...........',
        'kYYk............',
        'kkk.............',
    ]
    pal = {'k': rgba('#3B0A0A'), 'R': rgba('#D7262E'), 'r': rgba('#FF5A5F'),
           'Y': rgba('#FFC83D'), 'y': rgba('#FFF0A0')}
    return ascii_icon(rows, pal)


def icon_senzu_bean():
    rows = [
        '................',
        '................',
        '................',
        '.........kkk....',
        '.......kkGGGk...',
        '......kGgGGGGk..',
        '.....kGGGGGGGk..',
        '.....kGGGGGGdk..',
        '..kkkkGGGGGddk..',
        '.kGGgGkkddddk...',
        'kGgGGGGGk.kk....',
        'kGGGGGGGdk......',
        'kdGGGGGddk......',
        '.kddGdddk.......',
        '..kkkkkk........',
        '................',
    ]
    pal = {'k': rgba('#2E4A12'), 'G': rgba('#8BD64B'), 'g': rgba('#D4F7A8'), 'd': rgba('#5E9E2C')}
    return ascii_icon(rows, pal)


def icon_dragon_radar():
    rows = [
        '.......kk.......',
        '......kwwk......',
        '.....kkkkkk.....',
        '...kkwwwwwwkk...',
        '..kwwkkkkkkwwk..',
        '..kwkGgGGgGkwk..',
        '.kwkGGgGGgGGkwk.',
        '.kwkggggggggkwk.',
        '.kwkGGgGOgGGkwk.',
        '.kwkGGgGGgGGkwk.',
        '..kwkggggggkwk..',
        '..kwwkkkkkkwwk..',
        '...kkwwwwwwkk...',
        '.....kkkkkk.....',
        '................',
        '................',
    ]
    pal = {'k': rgba('#2B2B33'), 'w': rgba('#E8E8EE'), 'G': rgba('#3FB34F'),
           'g': rgba('#2B7F37'), 'O': rgba('#FF9F1C')}
    return ascii_icon(rows, pal)


def icon_flying_nimbus():
    rows = [
        '................',
        '................',
        '................',
        '.....kkk........',
        '....kYwYk.kkk...',
        '..kkYwYYYkYwYk..',
        '.kYwYYYYYYYYYYk.',
        '.kYYYYYYYYYYYYk.',
        'kYwYYYYYYYYYYYyk',
        'kYYYYYYYYYYYYyyk',
        '.kYYYYYYYYYYyyk.',
        '..kyyYYYYyyyyk..',
        '...kkyyyyyykk...',
        '.....kkkkkk.....',
        '................',
        '................',
    ]
    pal = {'k': rgba('#9A6A00'), 'Y': rgba('#FFD84D'), 'y': rgba('#E8A814'), 'w': rgba('#FFF6C9')}
    return ascii_icon(rows, pal)


HAIR_ROWS = [
    '.......k........',
    '...k..kwk...k...',
    '..kwk.kwk..kwk..',
    '..kwmkkmmkkmwk..',
    'k.kmmmkmmkmmmk.k',
    'kmkmmmmmmmmmmkmk',
    '.kmmmmmmmmmmmmk.',
    'kmmdmmmmmmmmdmmk',
    '.kmmdmmmmmmdmmk.',
    'kmdkmdmmmmdkdmmk',
    '.kk.kd.mdk..kdk.',
    '..k..k.dk....k..',
    '................',
    '................',
    '................',
    '................',
]


def icon_hair(style):
    if style == 'ui':
        pal = {'k': rgba('#4A5677'), 'd': rgba('#8E9BBB'), 'm': rgba('#C8D1E6'), 'w': rgba('#FFFFFF')}
    else:
        pal = {'k': rgba('#000000'), 'd': rgba('#14151C'), 'm': rgba('#262838'), 'w': rgba('#4A5070')}
    img = ascii_icon(HAIR_ROWS, pal)
    # shift down so the hair is centered
    out = Image.new('RGBA', (16, 16), T)
    out.alpha_composite(img, (0, 2))
    return out


def icon_gi_top():
    rows = [
        '................',
        '..kkkk....kkkk..',
        '.kbBhOk..kOhBbk.',
        'kbBOOOkLLkOOOBbk',
        'kbBOOOOkLkOOOBbk',
        'kbbOOOOOkOOWWbbk',
        '.kkOOOOOOOOWSkk.',
        '...kOOOOOOOOk...',
        '...kOOOOOOOOk...',
        '...kOOOOOOOOk...',
        '...koOOOOOOok...',
        '...kBBBBBBBBk...',
        '...kbbbbbbbbk...',
        '...kooOOOOook...',
        '...kkkkkkkkkk...',
        '................',
    ]
    pal = {'k': rgba('#4A2208'), 'O': rgba('#F27A1A'), 'o': rgba('#C95A12'), 'h': rgba('#FF9C42'),
           'B': rgba('#2244AA'), 'b': rgba('#17307D'), 'L': rgba('#3A63D2'),
           'W': rgba('#F4F4F4'), 'S': rgba('#161616')}
    return ascii_icon(rows, pal)


def icon_gi_pants():
    rows = [
        '................',
        '..kkkkkkkkkkkk..',
        '..kLBBBBBBBBLk..',
        '..kbBBBkBBBBbk..',
        '..kOOOkBkOOOOk..',
        '..kOhOOkkOOOOk..',
        '..kOhOOOkOOOOk..',
        '..kOOOOkkOOOOk..',
        '..kOOOok.kOOOk..',
        '..kOOOok.kOOOk..',
        '..kOOOok.kOOOk..',
        '..koOOok.koOok..',
        '..kooook.koook..',
        '..kkkkkk.kkkkk..',
        '................',
        '................',
    ]
    pal = {'k': rgba('#4A2208'), 'O': rgba('#F27A1A'), 'o': rgba('#C95A12'), 'h': rgba('#FF9C42'),
           'B': rgba('#2244AA'), 'b': rgba('#17307D'), 'L': rgba('#3A63D2')}
    return ascii_icon(rows, pal)


def icon_gi_boots():
    rows = [
        '................',
        '................',
        '................',
        '................',
        '..kkkkk..kkkkk..',
        '..kTTTk..kTTTk..',
        '..kNtNk..kNtNk..',
        '..kNTNk..kNTNk..',
        '..kNtNk..kNtNk..',
        '..kNNNk..kNNNk..',
        '.kMNNNk..kNNNMk.',
        'kMNNNNk..kNNNNMk',
        'kNNNNNk..kNNNNNk',
        'kXXXXXk..kXXXXXk',
        '.kkkkk....kkkkk.',
        '................',
    ]
    pal = {'k': rgba('#070B22'), 'N': rgba('#1E3388'), 'M': rgba('#2D4AB0'),
           'T': rgba('#E5C06C'), 't': rgba('#B88E43'), 'X': rgba('#0C1438')}
    return ascii_icon(rows, pal)


ICONS = {
    'ultra_instinct': icon_ultra_instinct,
    'kamehameha': icon_kamehameha,
    'ki_blast': icon_ki_blast,
    'spirit_bomb': icon_spirit_bomb,
    'instant_transmission': icon_instant_transmission,
    'dragon_fist': icon_dragon_fist,
    'power_pole': icon_power_pole,
    'senzu_bean': icon_senzu_bean,
    'dragon_radar': icon_dragon_radar,
    'flying_nimbus': icon_flying_nimbus,
    'goku_hair': lambda: icon_hair('black'),
    'ui_hair': lambda: icon_hair('ui'),
    'gi_top': icon_gi_top,
    'gi_pants': icon_gi_pants,
    'gi_boots': icon_gi_boots,
}

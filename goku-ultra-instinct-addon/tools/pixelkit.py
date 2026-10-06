"""Small helpers shared by the asset generator and the preview renderer."""
import json
import os

from PIL import Image


def rgba(hex_color, alpha=255):
    h = hex_color.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def shade(color, factor):
    """Multiply the RGB part of a color (factor > 1 lightens)."""
    r, g, b, a = color
    if factor >= 1:
        f = factor - 1
        return (int(r + (255 - r) * f), int(g + (255 - g) * f), int(b + (255 - b) * f), a)
    return (int(r * factor), int(g * factor), int(b * factor), a)


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(4))


def draw_ascii(img, x0, y0, rows, palette):
    """Paint a block of characters; '.' and ' ' are left untouched."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in '. ':
                continue
            img.putpixel((x0 + i, y0 + j), palette[ch])


def ascii_icon(rows, palette, size=16):
    assert len(rows) == size, 'icon needs %d rows, got %d' % (size, len(rows))
    for r in rows:
        assert len(r) == size, 'bad row width %d: %r' % (len(r), r)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_ascii(img, 0, 0, rows, palette)
    return img


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


class Atlas:
    """Shelf packer for box-UV cube layouts."""

    def __init__(self, width, height):
        self.img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        self.width = width
        self.height = height
        self.x = 0
        self.y = 0
        self.row_h = 0

    def alloc(self, w, h):
        if self.x + w > self.width:
            self.x = 0
            self.y += self.row_h
            self.row_h = 0
        if self.y + h > self.height:
            raise ValueError('texture atlas is full (%dx%d)' % (self.width, self.height))
        u, v = self.x, self.y
        self.x += w
        self.row_h = max(self.row_h, h)
        return u, v


def face_rects(u, v, size):
    """Box-UV regions, named from the wearer's point of view.

    'right' is the side of the model's right arm (-X in geometry space),
    'front' is the face side (-Z).  Columns of the side faces wrap around the
    cube continuously: right -> front -> left -> back.
    """
    w, h, d = size
    return {
        'up': (u + d, v, w, d),
        'down': (u + d + w, v, w, d),
        'right': (u, v + d, d, h),
        'front': (u + d, v + d, w, h),
        'left': (u + d + w, v + d, d, h),
        'back': (u + 2 * d + w, v + d, w, h),
    }


class Model:
    """Builds a Bedrock geometry (format 1.12.0) while painting its texture."""

    def __init__(self, identifier, atlas, bounds=(3, 3.5, (0, 1.5, 0))):
        self.identifier = identifier
        self.atlas = atlas
        self.bones = []
        self._by_name = {}
        self.bounds = bounds

    def bone(self, name, pivot, parent=None):
        b = {'name': name, 'pivot': list(pivot), 'cubes': []}
        if parent:
            b['parent'] = parent
        self.bones.append(b)
        self._by_name[name] = b
        return b

    def cube(self, bone, origin, size, paint, inflate=0.0, pivot=None, rotation=None, mirror=False):
        size = [int(s) for s in size]
        w, h, d = size
        u, v = self.atlas.alloc(2 * d + 2 * w, d + h)
        rects = face_rects(u, v, size)
        paint(self.atlas.img, rects, size)
        c = {'origin': [round(o, 4) for o in origin], 'size': size, 'uv': [u, v]}
        if inflate:
            c['inflate'] = inflate
        if rotation:
            c['pivot'] = [round(p, 4) for p in pivot]
            c['rotation'] = [round(r, 3) for r in rotation]
        if mirror:
            c['mirror'] = True
        self._by_name[bone]['cubes'].append(c)
        return c

    def to_json(self):
        bw, bh, off = self.bounds
        bones = []
        for b in self.bones:
            bb = dict(b)
            if not bb['cubes']:
                bb.pop('cubes')
            bones.append(bb)
        return {
            'format_version': '1.12.0',
            'minecraft:geometry': [{
                'description': {
                    'identifier': self.identifier,
                    'texture_width': self.atlas.width,
                    'texture_height': self.atlas.height,
                    'visible_bounds_width': bw,
                    'visible_bounds_height': bh,
                    'visible_bounds_offset': list(off),
                },
                'bones': bones,
            }],
        }

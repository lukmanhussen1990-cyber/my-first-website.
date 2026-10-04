"""Minimal little-endian NBT writer + .mcstructure builder (Bedrock Edition)."""
import struct

class Byte(int): pass
class Short(int): pass
class Int(int): pass
class Long(int): pass
class Float(float): pass
class Double(float): pass

TAG_END, TAG_BYTE, TAG_SHORT, TAG_INT, TAG_LONG, TAG_FLOAT, TAG_DOUBLE, TAG_STRING, TAG_LIST, TAG_COMPOUND = 0, 1, 2, 3, 4, 5, 6, 8, 9, 10

def tag_type(v):
    if isinstance(v, bool): return TAG_BYTE
    if isinstance(v, Byte): return TAG_BYTE
    if isinstance(v, Short): return TAG_SHORT
    if isinstance(v, Long): return TAG_LONG
    if isinstance(v, (Int, int)): return TAG_INT
    if isinstance(v, Double): return TAG_DOUBLE
    if isinstance(v, float): return TAG_FLOAT
    if isinstance(v, str): return TAG_STRING
    if isinstance(v, (list, tuple)): return TAG_LIST
    if isinstance(v, dict): return TAG_COMPOUND
    raise TypeError('unsupported NBT value %r' % (v,))

def _string(s):
    b = s.encode('utf-8'); return struct.pack('<H', len(b)) + b

def payload(v, t):
    if t == TAG_BYTE: return struct.pack('<b', int(v))
    if t == TAG_SHORT: return struct.pack('<h', int(v))
    if t == TAG_INT: return struct.pack('<i', int(v))
    if t == TAG_LONG: return struct.pack('<q', int(v))
    if t == TAG_FLOAT: return struct.pack('<f', float(v))
    if t == TAG_DOUBLE: return struct.pack('<d', float(v))
    if t == TAG_STRING: return _string(v)
    if t == TAG_LIST:
        items = list(v)
        et = tag_type(items[0]) if items else TAG_END
        # an explicit element type can be given as (type, items)
        if len(v) == 2 and isinstance(v, tuple) and isinstance(v[0], int) and isinstance(v[1], list):
            et, items = v
        return struct.pack('<b', et) + struct.pack('<i', len(items)) + b''.join(payload(i, et) for i in items)
    if t == TAG_COMPOUND:
        out = b''
        for k, val in v.items():
            vt = tag_type(val)
            out += struct.pack('<b', vt) + _string(k) + payload(val, vt)
        return out + b'\x00'
    raise TypeError(t)

def dumps(root, name=''):
    return struct.pack('<b', TAG_COMPOUND) + _string(name) + payload(root, TAG_COMPOUND)

# ------------------------------------------------------------------ reader (self-test) ---
def loads(data):
    pos = [0]
    def rd(fmt):
        v = struct.unpack_from(fmt, data, pos[0]); pos[0] += struct.calcsize(fmt); return v[0]
    def rstr():
        l = rd('<H'); s = data[pos[0]:pos[0] + l].decode('utf-8'); pos[0] += l; return s
    def rpay(t):
        if t == TAG_BYTE: return rd('<b')
        if t == TAG_SHORT: return rd('<h')
        if t == TAG_INT: return rd('<i')
        if t == TAG_LONG: return rd('<q')
        if t == TAG_FLOAT: return rd('<f')
        if t == TAG_DOUBLE: return rd('<d')
        if t == TAG_STRING: return rstr()
        if t == TAG_LIST:
            et = rd('<b'); cnt = rd('<i'); return [rpay(et) for _ in range(cnt)]
        if t == TAG_COMPOUND:
            d = {}
            while True:
                vt = rd('<b')
                if vt == TAG_END: return d
                k = rstr(); d[k] = rpay(vt)
        raise TypeError(t)
    t = rd('<b'); rstr(); return rpay(t)

# ------------------------------------------------------------------ mcstructure ----------
BLOCK_VERSION = 18153472  # 1.21.0.0

def build_mcstructure(size, blocks, block_entities=None, origin=(0, 0, 0), default='minecraft:air'):
    """size: (X,Y,Z); blocks: dict (x,y,z) -> (name, states dict) ; block_entities: dict (x,y,z) -> compound dict.
    Unspecified positions receive `default` (None = leave existing world blocks, index -1)."""
    X, Y, Z = size
    palette, pindex = [], {}
    def pal(name, states):
        key = (name, tuple(sorted(states.items())))
        if key not in pindex:
            pindex[key] = len(palette)
            palette.append({'name': name, 'states': dict(states), 'version': Int(BLOCK_VERSION)})
        return pindex[key]
    default_index = -1 if default is None else pal(default, {})
    indices = [Int(default_index)] * (X * Y * Z)
    for (x, y, z), (name, states) in blocks.items():
        if 0 <= x < X and 0 <= y < Y and 0 <= z < Z:
            indices[(x * Y + y) * Z + z] = Int(pal(name, states))
    bpd = {}
    for (x, y, z), be in (block_entities or {}).items():
        idx = (x * Y + y) * Z + z
        be = dict(be); be.setdefault('x', Int(origin[0] + x)); be.setdefault('y', Int(origin[1] + y)); be.setdefault('z', Int(origin[2] + z))
        bpd[str(idx)] = {'block_entity_data': be}
    root = {
        'format_version': Int(1),
        'size': [Int(X), Int(Y), Int(Z)],
        'structure': {
            'block_indices': [indices, [Int(-1)] * (X * Y * Z)],
            'entities': (TAG_COMPOUND, []),
            'palette': {'default': {'block_palette': palette, 'block_position_data': bpd}},
        },
        'structure_world_origin': [Int(origin[0]), Int(origin[1]), Int(origin[2])],
    }
    return dumps(root), len(palette)

if __name__ == '__main__':
    blocks = {(0, 0, 0): ('minecraft:stone', {}), (1, 0, 0): ('minecraft:ladder', {'facing_direction': Int(2)}),
              (0, 1, 0): ('bunker:lamp', {'bunker:mode': 'on'}), (1, 1, 0): ('minecraft:barrel', {'facing_direction': Int(1), 'open_bit': Byte(0)})}
    bes = {(1, 1, 0): {'id': 'Barrel', 'LootTable': 'loot_tables/bunker/supply_barrel.json', 'isMovable': Byte(1)}}
    data, np = build_mcstructure((2, 2, 1), blocks, bes)
    back = loads(data)
    assert back['size'] == [2, 2, 1] and len(back['structure']['block_indices'][0]) == 4
    assert back['structure']['palette']['default']['block_palette'][3]['states']['bunker:mode'] == 'on'
    assert back['structure']['palette']['default']['block_position_data']['3']['block_entity_data']['id'] == 'Barrel'
    print('nbt self-test ok; bytes =', len(data), 'palette =', np)

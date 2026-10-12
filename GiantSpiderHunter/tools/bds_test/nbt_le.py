#!/usr/bin/env python3
"""Minimal little-endian NBT reader/writer (Minecraft Bedrock flavour).

Used by the BDS test harness to
  * patch ``level.dat`` (8-byte header: int32 storage version, int32 payload length,
    followed by one little-endian root compound), and
  * write ``.mcstructure`` files (headerless little-endian root compound).

Every value is a :class:`Tag` (``t`` = tag id, ``v`` = value) so types survive a
read/modify/write round trip unchanged.  Compounds are ``dict[str, Tag]`` (insertion
ordered); lists are ``(element_tag_id, [Tag, ...])``.
"""
import struct

END, BYTE, SHORT, INT, LONG, FLOAT, DOUBLE, BYTE_ARRAY, STRING, LIST, COMPOUND, INT_ARRAY, LONG_ARRAY = range(13)
_NAMES = {
    END: "End", BYTE: "Byte", SHORT: "Short", INT: "Int", LONG: "Long", FLOAT: "Float",
    DOUBLE: "Double", BYTE_ARRAY: "ByteArray", STRING: "String", LIST: "List",
    COMPOUND: "Compound", INT_ARRAY: "IntArray", LONG_ARRAY: "LongArray",
}
_SCALAR = {BYTE: "<b", SHORT: "<h", INT: "<i", LONG: "<q", FLOAT: "<f", DOUBLE: "<d"}


class Tag:
    __slots__ = ("t", "v")

    def __init__(self, t, v):
        self.t = t
        self.v = v

    def __repr__(self):
        return f"{_NAMES.get(self.t, self.t)}({self.v!r})"

    def __eq__(self, other):
        return isinstance(other, Tag) and self.t == other.t and self.v == other.v

    # convenience for compounds
    def __getitem__(self, key):
        return self.v[key]

    def __setitem__(self, key, value):
        self.v[key] = value

    def __contains__(self, key):
        return key in self.v

    def get(self, key, default=None):
        return self.v.get(key, default)

    def to_py(self):
        """Plain Python view (for printing / JSON)."""
        if self.t == COMPOUND:
            return {k: x.to_py() for k, x in self.v.items()}
        if self.t == LIST:
            return [x.to_py() for x in self.v[1]]
        return self.v


def Byte(v): return Tag(BYTE, int(v))
def Short(v): return Tag(SHORT, int(v))
def Int(v): return Tag(INT, int(v))
def Long(v): return Tag(LONG, int(v))
def Float(v): return Tag(FLOAT, float(v))
def Double(v): return Tag(DOUBLE, float(v))
def String(v): return Tag(STRING, str(v))
def Compound(d=None): return Tag(COMPOUND, dict(d or {}))
def List(elem_t, items): return Tag(LIST, (elem_t, list(items)))


class _Reader:
    def __init__(self, data, pos=0):
        self.d = data
        self.p = pos

    def take(self, n):
        if self.p + n > len(self.d):
            raise ValueError("truncated NBT")
        b = self.d[self.p:self.p + n]
        self.p += n
        return b

    def unpack(self, fmt):
        size = struct.calcsize(fmt)
        return struct.unpack(fmt, self.take(size))[0]

    def string(self):
        n = self.unpack("<H")
        return self.take(n).decode("utf-8", errors="surrogateescape")

    def payload(self, t):
        if t in _SCALAR:
            return Tag(t, self.unpack(_SCALAR[t]))
        if t == BYTE_ARRAY:
            n = self.unpack("<i")
            return Tag(t, list(struct.unpack(f"<{n}b", self.take(n))))
        if t == STRING:
            return Tag(t, self.string())
        if t == LIST:
            et = self.unpack("<b")
            n = self.unpack("<i")
            return Tag(t, (et, [self.payload(et) for _ in range(n)]))
        if t == COMPOUND:
            out = {}
            while True:
                ct = self.unpack("<b")
                if ct == END:
                    break
                name = self.string()
                out[name] = self.payload(ct)
            return Tag(t, out)
        if t == INT_ARRAY:
            n = self.unpack("<i")
            return Tag(t, list(struct.unpack(f"<{n}i", self.take(4 * n))))
        if t == LONG_ARRAY:
            n = self.unpack("<i")
            return Tag(t, list(struct.unpack(f"<{n}q", self.take(8 * n))))
        raise ValueError(f"bad NBT tag id {t} at {self.p}")


def _w_string(out, s):
    b = s.encode("utf-8", errors="surrogateescape")
    out += struct.pack("<H", len(b))
    out += b


def _w_payload(out, tag):
    t, v = tag.t, tag.v
    if t in _SCALAR:
        out += struct.pack(_SCALAR[t], v)
    elif t == BYTE_ARRAY:
        out += struct.pack("<i", len(v)) + struct.pack(f"<{len(v)}b", *v)
    elif t == STRING:
        _w_string(out, v)
    elif t == LIST:
        et, items = v
        if not items and et == END:
            et = END
        out += struct.pack("<bi", et, len(items))
        for it in items:
            if it.t != et:
                raise ValueError(f"list element type {it.t} != {et}")
            _w_payload(out, it)
    elif t == COMPOUND:
        for name, child in v.items():
            out += struct.pack("<b", child.t)
            _w_string(out, name)
            _w_payload(out, child)
        out += struct.pack("<b", END)
    elif t == INT_ARRAY:
        out += struct.pack("<i", len(v)) + struct.pack(f"<{len(v)}i", *v)
    elif t == LONG_ARRAY:
        out += struct.pack("<i", len(v)) + struct.pack(f"<{len(v)}q", *v)
    else:
        raise ValueError(f"bad NBT tag id {t}")


def loads(data, pos=0):
    """Parse one named root tag. Returns (name, Tag, end_position)."""
    r = _Reader(data, pos)
    t = r.unpack("<b")
    name = r.string()
    tag = r.payload(t)
    return name, tag, r.p


def dumps(tag, name=""):
    out = bytearray()
    out += struct.pack("<b", tag.t)
    _w_string(out, name)
    _w_payload(out, tag)
    return bytes(out)


def read_level_dat(path):
    """Returns (storage_version, root_name, root Compound Tag)."""
    with open(path, "rb") as fh:
        data = fh.read()
    version, length = struct.unpack("<ii", data[:8])
    name, root, end = loads(data, 8)
    if end - 8 != length:
        raise ValueError(f"level.dat length mismatch: header {length}, parsed {end - 8}")
    return version, name, root


def write_level_dat(path, version, root, name=""):
    body = dumps(root, name)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<ii", version, len(body)))
        fh.write(body)


def enable_experiments(path, flags=("gametest",)):
    """Turn on experiment toggles (e.g. 'gametest' = Beta APIs) in a Bedrock level.dat."""
    version, name, root = read_level_dat(path)
    exp = root.get("experiments")
    if exp is None or exp.t != COMPOUND:
        exp = Compound()
        root["experiments"] = exp
    for f in flags:
        exp[f] = Byte(1)
    exp["experiments_ever_used"] = Byte(1)
    exp["saved_with_toggled_experiments"] = Byte(1)
    write_level_dat(path, version, root, name)
    return {k: v.to_py() for k, v in exp.v.items()}


def set_level_values(path, values):
    """Overwrite existing scalar entries (keeps their tag type), e.g. {'commandsEnabled': 1}."""
    version, name, root = read_level_dat(path)
    for k, val in values.items():
        cur = root.get(k)
        if cur is None:
            raise KeyError(f"level.dat has no key {k!r}")
        cur.v = type(cur.v)(val)
    write_level_dat(path, version, root, name)


def write_air_structure(path, size=(1, 1, 1)):
    """Write a minimal .mcstructure filled with air (used as the GameTest structure)."""
    sx, sy, sz = size
    n = sx * sy * sz
    root = Compound({
        "format_version": Int(1),
        "size": List(INT, [Int(sx), Int(sy), Int(sz)]),
        "structure": Compound({
            "block_indices": List(LIST, [List(INT, [Int(0)] * n), List(INT, [Int(-1)] * n)]),
            "entities": List(COMPOUND, []),
            "palette": Compound({
                "default": Compound({
                    "block_palette": List(COMPOUND, [Compound({
                        "name": String("minecraft:air"),
                        "states": Compound(),
                        "version": Int(18100737),
                    })]),
                    "block_position_data": Compound(),
                }),
            }),
        }),
        "structure_world_origin": List(INT, [Int(0), Int(0), Int(0)]),
    })
    with open(path, "wb") as fh:
        fh.write(dumps(root))


if __name__ == "__main__":
    import json
    import sys
    if len(sys.argv) != 2:
        sys.exit("usage: nbt_le.py <level.dat|file.mcstructure>  (prints as JSON)")
    raw = open(sys.argv[1], "rb").read()
    if sys.argv[1].endswith(".dat"):
        v, n, r = read_level_dat(sys.argv[1])
        print(json.dumps({"storage_version": v, "root": r.to_py()}, indent=1, default=str))
    else:
        n, r, _ = loads(raw)
        print(json.dumps(r.to_py(), indent=1, default=str))

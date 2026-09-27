"""Minimal little-endian NBT writer/reader used for Bedrock .mcstructure files.

Bedrock stores structure files as *uncompressed, little-endian* NBT with an
unnamed root compound. Only the tag types we need are implemented.
"""
import struct

TAG_END = 0
TAG_BYTE = 1
TAG_SHORT = 2
TAG_INT = 3
TAG_LONG = 4
TAG_FLOAT = 5
TAG_DOUBLE = 6
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10


class Byte(int):
    tag = TAG_BYTE


class Short(int):
    tag = TAG_SHORT


class Int(int):
    tag = TAG_INT


class Long(int):
    tag = TAG_LONG


class Float(float):
    tag = TAG_FLOAT


class Double(float):
    tag = TAG_DOUBLE


class String(str):
    tag = TAG_STRING


class List(list):
    tag = TAG_LIST

    def __init__(self, elem_tag, items=()):
        super().__init__(items)
        self.elem_tag = elem_tag


class Compound(dict):
    tag = TAG_COMPOUND


def _tag_of(value):
    if hasattr(value, "tag"):
        return value.tag
    if isinstance(value, bool):
        return TAG_BYTE
    if isinstance(value, int):
        return TAG_INT
    if isinstance(value, float):
        return TAG_FLOAT
    if isinstance(value, str):
        return TAG_STRING
    if isinstance(value, dict):
        return TAG_COMPOUND
    raise TypeError(f"Cannot infer NBT tag for {value!r}")


def _write_string(out, s):
    raw = s.encode("utf-8")
    out += struct.pack("<H", len(raw))
    out += raw


def _write_payload(out, tag, value):
    if tag == TAG_BYTE:
        out += struct.pack("<b", int(value))
    elif tag == TAG_SHORT:
        out += struct.pack("<h", int(value))
    elif tag == TAG_INT:
        out += struct.pack("<i", int(value))
    elif tag == TAG_LONG:
        out += struct.pack("<q", int(value))
    elif tag == TAG_FLOAT:
        out += struct.pack("<f", float(value))
    elif tag == TAG_DOUBLE:
        out += struct.pack("<d", float(value))
    elif tag == TAG_STRING:
        _write_string(out, value)
    elif tag == TAG_LIST:
        elem = value.elem_tag if isinstance(value, List) else (_tag_of(value[0]) if value else TAG_END)
        out += struct.pack("<b", elem)
        out += struct.pack("<i", len(value))
        for item in value:
            _write_payload(out, elem, item)
    elif tag == TAG_COMPOUND:
        for key, item in value.items():
            t = _tag_of(item)
            out += struct.pack("<b", t)
            _write_string(out, key)
            _write_payload(out, t, item)
        out += struct.pack("<b", TAG_END)
    else:
        raise ValueError(f"Unsupported tag {tag}")


def dumps(root):
    """Serialize a root compound (unnamed) to bytes."""
    out = bytearray()
    out += struct.pack("<b", TAG_COMPOUND)
    _write_string(out, "")
    _write_payload(out, TAG_COMPOUND, root)
    return bytes(out)


class _Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def take(self, fmt):
        size = struct.calcsize(fmt)
        val = struct.unpack_from(fmt, self.data, self.pos)[0]
        self.pos += size
        return val

    def string(self):
        n = self.take("<H")
        s = self.data[self.pos:self.pos + n].decode("utf-8")
        self.pos += n
        return s

    def payload(self, tag):
        if tag == TAG_BYTE:
            return Byte(self.take("<b"))
        if tag == TAG_SHORT:
            return Short(self.take("<h"))
        if tag == TAG_INT:
            return Int(self.take("<i"))
        if tag == TAG_LONG:
            return Long(self.take("<q"))
        if tag == TAG_FLOAT:
            return Float(self.take("<f"))
        if tag == TAG_DOUBLE:
            return Double(self.take("<d"))
        if tag == TAG_STRING:
            return String(self.string())
        if tag == TAG_LIST:
            elem = self.take("<b")
            n = self.take("<i")
            return List(elem, [self.payload(elem) for _ in range(n)])
        if tag == TAG_COMPOUND:
            result = Compound()
            while True:
                t = self.take("<b")
                if t == TAG_END:
                    return result
                key = self.string()
                result[key] = self.payload(t)
        raise ValueError(f"Unsupported tag {tag} at {self.pos}")


def loads(data):
    """Parse bytes produced by dumps() (or by Minecraft) back into Python objects."""
    r = _Reader(data)
    tag = r.take("<b")
    if tag != TAG_COMPOUND:
        raise ValueError("Root tag must be a compound")
    r.string()
    root = r.payload(TAG_COMPOUND)
    if r.pos != len(data):
        raise ValueError(f"Trailing bytes after root compound: {len(data) - r.pos}")
    return root

"""Little-endian (Bedrock disk format) NBT reader and writer for the engine harness.

Every value is wrapped in an explicit tag class, so a read -> write round trip
keeps every tag type exactly (level.dat must keep Byte vs Int vs Long etc.).

    root_name, root = read(data)          # root is a Compound
    data = write(root, root_name)
    hdr_version, root = read_level_dat(path)
    write_level_dat(path, root, hdr_version)

level.dat = 8-byte header (Int32 LE storage version, Int32 LE payload length)
followed by the NBT payload.
"""
from __future__ import annotations

import struct
from pathlib import Path

TAG_END, TAG_BYTE, TAG_SHORT, TAG_INT, TAG_LONG, TAG_FLOAT, TAG_DOUBLE = 0, 1, 2, 3, 4, 5, 6
TAG_BYTE_ARRAY, TAG_STRING, TAG_LIST, TAG_COMPOUND, TAG_INT_ARRAY, TAG_LONG_ARRAY = 7, 8, 9, 10, 11, 12


class _Scalar:
    tag = -1
    fmt = ""
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        return type(other) is type(self) and other.value == self.value

    def __hash__(self):
        return hash((self.tag, self.value))

    def __repr__(self):
        return f"{type(self).__name__}({self.value!r})"


class Byte(_Scalar):
    tag, fmt = TAG_BYTE, "<b"


class Short(_Scalar):
    tag, fmt = TAG_SHORT, "<h"


class Int(_Scalar):
    tag, fmt = TAG_INT, "<i"


class Long(_Scalar):
    tag, fmt = TAG_LONG, "<q"


class Float(_Scalar):
    tag, fmt = TAG_FLOAT, "<f"


class Double(_Scalar):
    tag, fmt = TAG_DOUBLE, "<d"


class String(_Scalar):
    tag = TAG_STRING


class ByteArray(_Scalar):
    tag = TAG_BYTE_ARRAY


class IntArray(_Scalar):
    tag = TAG_INT_ARRAY


class LongArray(_Scalar):
    tag = TAG_LONG_ARRAY


class List:
    tag = TAG_LIST

    def __init__(self, elem_tag: int, items=()):
        self.elem_tag = elem_tag
        self.items = list(items)
        for it in self.items:
            if it.tag != elem_tag:
                raise TypeError(f"list of tag {elem_tag} got element tag {it.tag}")

    def __eq__(self, other):
        return isinstance(other, List) and other.elem_tag == self.elem_tag and other.items == self.items

    def __repr__(self):
        return f"List({self.elem_tag}, {self.items!r})"


class Compound:
    tag = TAG_COMPOUND

    def __init__(self, entries: dict | None = None):
        self.entries = dict(entries or {})

    def __getitem__(self, k):
        return self.entries[k]

    def __setitem__(self, k, v):
        if not hasattr(v, "tag"):
            raise TypeError(f"{k}: untyped value {v!r}")
        self.entries[k] = v

    def __contains__(self, k):
        return k in self.entries

    def get(self, k, default=None):
        return self.entries.get(k, default)

    def __eq__(self, other):
        return isinstance(other, Compound) and other.entries == self.entries

    def __repr__(self):
        return f"Compound({self.entries!r})"


_SCALARS = {c.tag: c for c in (Byte, Short, Int, Long, Float, Double)}


# ---------------------------------------------------------------- writing
def _wstr(out: bytearray, s: str) -> None:
    raw = s.encode("utf-8")
    out += struct.pack("<H", len(raw))
    out += raw


def _wpayload(out: bytearray, v) -> None:
    t = v.tag
    if t in _SCALARS:
        out += struct.pack(_SCALARS[t].fmt, v.value)
    elif t == TAG_STRING:
        _wstr(out, v.value)
    elif t == TAG_BYTE_ARRAY:
        out += struct.pack("<i", len(v.value))
        out += bytes(v.value)
    elif t == TAG_INT_ARRAY:
        out += struct.pack("<i", len(v.value))
        for x in v.value:
            out += struct.pack("<i", x)
    elif t == TAG_LONG_ARRAY:
        out += struct.pack("<i", len(v.value))
        for x in v.value:
            out += struct.pack("<q", x)
    elif t == TAG_LIST:
        out += struct.pack("<bi", v.elem_tag if v.items or v.elem_tag else TAG_END, len(v.items))
        for it in v.items:
            _wpayload(out, it)
    elif t == TAG_COMPOUND:
        for k, x in v.entries.items():
            out += struct.pack("<b", x.tag)
            _wstr(out, k)
            _wpayload(out, x)
        out += struct.pack("<b", TAG_END)
    else:
        raise TypeError(f"unknown tag {t}")


def write(root: Compound, name: str = "") -> bytes:
    out = bytearray()
    out += struct.pack("<b", TAG_COMPOUND)
    _wstr(out, name)
    _wpayload(out, root)
    return bytes(out)


# ---------------------------------------------------------------- reading
class _Reader:
    def __init__(self, data: bytes):
        self.d = data
        self.p = 0

    def take(self, n: int) -> bytes:
        if self.p + n > len(self.d):
            raise ValueError("truncated NBT")
        b = self.d[self.p:self.p + n]
        self.p += n
        return b

    def unpack(self, fmt: str):
        return struct.unpack(fmt, self.take(struct.calcsize(fmt)))[0]

    def string(self) -> str:
        n = self.unpack("<H")
        return self.take(n).decode("utf-8")

    def payload(self, t: int):
        if t in _SCALARS:
            return _SCALARS[t](self.unpack(_SCALARS[t].fmt))
        if t == TAG_STRING:
            return String(self.string())
        if t == TAG_BYTE_ARRAY:
            n = self.unpack("<i")
            return ByteArray(self.take(n))
        if t == TAG_INT_ARRAY:
            n = self.unpack("<i")
            return IntArray([self.unpack("<i") for _ in range(n)])
        if t == TAG_LONG_ARRAY:
            n = self.unpack("<i")
            return LongArray([self.unpack("<q") for _ in range(n)])
        if t == TAG_LIST:
            et = self.unpack("<b")
            n = self.unpack("<i")
            return List(et, [self.payload(et) for _ in range(n)])
        if t == TAG_COMPOUND:
            c = Compound()
            while True:
                ct = self.unpack("<b")
                if ct == TAG_END:
                    return c
                k = self.string()
                c.entries[k] = self.payload(ct)
        raise ValueError(f"unknown tag {t} at {self.p}")


def read(data: bytes) -> tuple[str, Compound]:
    r = _Reader(data)
    t = r.unpack("<b")
    if t != TAG_COMPOUND:
        raise ValueError(f"root tag is {t}, expected compound")
    name = r.string()
    root = r.payload(TAG_COMPOUND)
    return name, root


def read_level_dat(path: Path) -> tuple[int, Compound]:
    data = Path(path).read_bytes()
    version, length = struct.unpack("<ii", data[:8])
    if length != len(data) - 8:
        raise ValueError(f"level.dat length field {length} != payload {len(data) - 8}")
    _, root = read(data[8:])
    return version, root


def write_level_dat(path: Path, root: Compound, version: int) -> None:
    payload = write(root, "")
    Path(path).write_bytes(struct.pack("<ii", version, len(payload)) + payload)


def to_py(v):
    """Plain Python view (for printing / JSON)."""
    if isinstance(v, Compound):
        return {k: to_py(x) for k, x in v.entries.items()}
    if isinstance(v, List):
        return [to_py(x) for x in v.items]
    if isinstance(v, (ByteArray,)):
        return list(v.value)
    return v.value

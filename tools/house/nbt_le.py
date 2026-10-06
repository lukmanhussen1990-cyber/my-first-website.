"""Minimal little-endian (Bedrock disk format) NBT writer.

Only what the .mcstructure writer needs.  Values are wrapped in explicit tag
classes so the tag type of every value is decided by the caller, never guessed.
The validator deliberately does NOT import this module (it uses nbtlib or its own
reader) so that a writer bug cannot hide itself.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

TAG_END, TAG_BYTE, TAG_SHORT, TAG_INT, TAG_LONG = 0, 1, 2, 3, 4
TAG_FLOAT, TAG_DOUBLE, TAG_BYTE_ARRAY, TAG_STRING, TAG_LIST, TAG_COMPOUND = 5, 6, 7, 8, 9, 10


@dataclass(frozen=True)
class Byte:
    value: int
    tag = TAG_BYTE


@dataclass(frozen=True)
class Short:
    value: int
    tag = TAG_SHORT


@dataclass(frozen=True)
class Int:
    value: int
    tag = TAG_INT


@dataclass(frozen=True)
class String:
    value: str
    tag = TAG_STRING


class List:
    tag = TAG_LIST

    def __init__(self, elem_tag: int, items):
        self.elem_tag = elem_tag
        self.items = list(items)
        for it in self.items:
            if it.tag != elem_tag:
                raise TypeError(f"list of tag {elem_tag} got element tag {it.tag}")


class Compound:
    tag = TAG_COMPOUND

    def __init__(self, entries: dict | None = None):
        self.entries = dict(entries or {})


def from_state_value(value) -> Byte | Int | String:
    """Block-state value -> tag (bool -> Byte, int -> Int, str -> String)."""
    if isinstance(value, bool):
        return Byte(1 if value else 0)
    if isinstance(value, int):
        return Int(value)
    if isinstance(value, str):
        return String(value)
    raise TypeError(value)


def _write_string(out: bytearray, s: str) -> None:
    raw = s.encode("utf-8")
    out += struct.pack("<H", len(raw))
    out += raw


def _write_payload(out: bytearray, tag) -> None:
    t = tag.tag
    if t == TAG_BYTE:
        out += struct.pack("<b", tag.value)
    elif t == TAG_SHORT:
        out += struct.pack("<h", tag.value)
    elif t == TAG_INT:
        out += struct.pack("<i", tag.value)
    elif t == TAG_STRING:
        _write_string(out, tag.value)
    elif t == TAG_LIST:
        out += struct.pack("<bi", tag.elem_tag if tag.items else (tag.elem_tag or TAG_END), len(tag.items))
        for item in tag.items:
            _write_payload(out, item)
    elif t == TAG_COMPOUND:
        for name, child in tag.entries.items():
            out += struct.pack("<b", child.tag)
            _write_string(out, name)
            _write_payload(out, child)
        out += struct.pack("<b", TAG_END)
    else:
        raise TypeError(f"unsupported tag {t}")


def dumps(root: Compound, root_name: str = "") -> bytes:
    out = bytearray()
    out += struct.pack("<b", TAG_COMPOUND)
    _write_string(out, root_name)
    _write_payload(out, root)
    return bytes(out)

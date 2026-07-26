#!/usr/bin/env python3
"""Generate pack_icon.png for both packs. No third-party deps."""
import struct, zlib, sys, math

S = 128

def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

def write_png(path, px):
    raw = b"".join(b"\x00" + bytes(v for p in row for v in p) for row in px)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(png)

def build(accent):
    base   = (38, 40, 46)
    base2  = (48, 51, 58)
    dark   = (24, 25, 30)
    steel  = (150, 156, 166)
    grid = []
    for y in range(S):
        row = []
        for x in range(S):
            # deepslate-ish noise background
            c = base if ((x // 8) + (y // 8)) % 2 else base2
            # hazard stripes top and bottom
            if y < 12 or y >= S - 12:
                c = accent if ((x + y) // 7) % 2 else dark
            else:
                cx, cy = x - S / 2, y - S / 2
                r = math.hypot(cx, cy)
                if r < 40:
                    c = steel                       # hatch door
                if 34 < r < 38:
                    c = dark                        # inner ring
                if 40 <= r < 44:
                    c = accent                      # rim
                if r < 40:
                    # spoke handle
                    a = math.atan2(cy, cx)
                    if abs(math.sin(a * 2)) < 0.09 and r > 8:
                        c = dark
                    if r < 9:
                        c = accent
                # bolts
                for bx, by in ((-46, -46), (46, -46), (-46, 46), (46, 46)):
                    if math.hypot(cx - bx, cy - by) < 5:
                        c = steel
            row.append(c)
        grid.append(row)
    return grid

write_png(sys.argv[1], build((222, 176, 42)))   # BP: amber
write_png(sys.argv[2], build((74, 168, 120)))   # RP: green
print("icons written")

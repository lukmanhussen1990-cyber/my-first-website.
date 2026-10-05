#!/usr/bin/env python3
"""stitch.py out.png cols in1.png in2.png ...  (grid of equally sized PNGs, stdlib only)"""
import struct, sys, zlib
def read_png(path):
    d = open(path, 'rb').read(); pos = 8; idat = b''; w = h = 0
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]; tag = d[pos+4:pos+8]; body = d[pos+8:pos+8+ln]; pos += 12 + ln
        if tag == b'IHDR': w, h = struct.unpack('>II', body[:8])
        elif tag == b'IDAT': idat += body
    raw = zlib.decompress(idat); bpp = 4; stride = w * bpp; rows = []; prev = bytearray(stride); i = 0
    for y in range(h):
        f = raw[i]; line = bytearray(raw[i+1:i+1+stride]); i += 1 + stride
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0; b = prev[x]; c = prev[x-bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c; pa = abs(p-a); pb = abs(p-b); pc = abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c); line[x] = (line[x] + pr) & 255
        rows.append(line); prev = line
    return w, h, rows
def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    def ch(t, dt): b = t + dt; return struct.pack('>I', len(dt)) + b + struct.pack('>I', zlib.crc32(b) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))
out, cols = sys.argv[1], int(sys.argv[2]); files = sys.argv[3:]
imgs = [read_png(f) for f in files]
W = max(i[0] for i in imgs); H = max(i[1] for i in imgs)
nrows = (len(imgs) + cols - 1) // cols
canvas = [bytearray(W * cols * 4) for _ in range(H * nrows)]
for n, (w, h, rows) in enumerate(imgs):
    ox, oy = (n % cols) * W, (n // cols) * H
    for y in range(h):
        canvas[oy + y][ox*4:ox*4 + w*4] = rows[y]
write_png(out, W * cols, H * nrows, canvas)
print('stitched', len(imgs), '->', out, W * cols, 'x', H * nrows)

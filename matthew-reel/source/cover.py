"""cover.png: the 'ME?' moment with the title 'Does God only want good people?'"""
import sys
import cairo
from gfx import *
import captions as CAP
import room
import render

OUT = sys.argv[1] if len(sys.argv) > 1 else 'cover.png'
t = room.T_ME + 0.6
s = render.compose(t, captions=False)
ctx = cairo.Context(s)
# title in the caption panel, caption style (all words "spoken"), a little bigger
f = font('cap')
size = 86
lines = [[('Does', None), ('God', 'g'), ('only', None), ('want', None)], [('good', 'n'), ('people?', None)]]
col = {None: C['cap_dark'], 'g': C['gold'], 'n': C['green']}
sp = f.width(' ', size) * CAP.WORD_SP
for li, ln in enumerate(lines):
    ws = [f.width(w, size) for w, _ in ln]
    x = W / 2 - (sum(ws) + sp * (len(ln) - 1)) / 2
    y = 1418 + li * 112
    for (w, c), wd in zip(ln, ws):
        draw_text(ctx, f, w, size, x, y, col[c], anchor='left')
        x += wd + sp
s.write_to_png(OUT)
print('cover ->', OUT)

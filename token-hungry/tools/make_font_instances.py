import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
src, out, *axes = sys.argv[1:]
loc = {}
for a in axes:
    k, v = a.split('=')
    loc[k] = float(v)
f = TTFont(src)
inst = instantiateVariableFont(f, loc, updateFontNames=False)
inst.save(out)
print('saved', out, loc)

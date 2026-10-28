"""Bake Cormorant Garamond's lining figures (lnum) into the default digits, so the
counter reads 100 / 99 rather than old-style figures (canvas can't toggle lnum)."""
from fontTools.ttLib import TTFont
f = TTFont('fonts/CormorantGaramond[wght].ttf')
gsub = f['GSUB'].table
mapping = {}
for fr in gsub.FeatureList.FeatureRecord:
    if fr.FeatureTag == 'lnum':
        for li in fr.Feature.LookupListIndex:
            lk = gsub.LookupList.Lookup[li]
            for st in lk.SubTable:
                st = getattr(st, 'ExtSubTable', st)
                if hasattr(st, 'mapping'):
                    mapping.update(st.mapping)
print({k: v for k, v in mapping.items() if k in ('zero', 'one', 'nine')})
for table in f['cmap'].tables:
    for cp, g in list(table.cmap.items()):
        if g in mapping and 0x30 <= cp <= 0x39:
            table.cmap[cp] = mapping[g]
f.save('fonts/CormorantGaramond-LNUM.ttf')

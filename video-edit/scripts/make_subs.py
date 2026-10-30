"""Build word-highlight subtitles (.ass, burned in) and a matching .srt from aligned word times.
2-4 words per line, one line, bottom centre, Inter Bold 60 px, white + soft shadow, active word green."""
import json, math, sys

W = json.load(open(sys.argv[1]))
OUT_ASS, OUT_SRT = sys.argv[2], sys.argv[3]
TITLE_END = 5.60                     # name title on screen until ~5.5 s -> keep subs bottom-right until then
NO_BREAK_AFTER = {"Fable"}

HEAVY = {"a", "an", "the", "of", "to", "and", "our", "with", "for", "by", "at", "in", "from", "or", "your", "this", "Fable"}
LIGHT = {"it": 0.6, "can": 1.0, "so": 1.2, "that": 1.2, "we": 1.2, "is": 1.0, "it's": 1.2, "we've": 1.2}
def best_split(p):
    """split a phrase into 2-4 word chunks, avoiding chunk ends on function words; balanced sizes"""
    n = len(p)
    if n <= 4: return [p]
    best = {0: (0.0, [])}
    for i in range(1, n + 1):
        cands = []
        for s in (2, 3, 4):
            j = i - s
            if j < 0 or j not in best: continue
            last = p[i - 1]["w"].strip(",.").lower() if p[i - 1]["w"] != "Fable" else "Fable"
            pen = 0.0
            if i < n:
                pen += 4.0 if (last in HEAVY or p[i - 1]["w"] == "Fable") else LIGHT.get(last, 0.0)
            if j > 0 and p[j]["w"].lower() in ("and", "or", "so"): pen -= 0.6
            pen += 0.35 * (s - 3) ** 2
            cands.append((best[j][0] + pen, best[j][1] + [p[j:i]]))
        if cands: best[i] = min(cands, key=lambda x: x[0])
    return best[n][1]

def chunks_of(words):
    """split a sentence into phrases at punctuation, then each phrase into balanced 2-4 word chunks"""
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if w["w"][-1] in ",.?!":
            phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    merged = []
    for p in phrases:                # a lone word joins its neighbour
        if merged and (len(p) == 1 or len(merged[-1]) == 1) and len(merged[-1]) + len(p) <= 4:
            merged[-1] = merged[-1] + p
        else:
            merged.append(p)
    out = []
    for p in merged:
        out += best_split(p)
    return [c for c in out if c]

chunks = []
for line in W:
    chunks += chunks_of(line["words"])
# timing
ev = []
for i, c in enumerate(chunks):
    st, en = c[0]["s"], c[-1]["e"]
    nxt = chunks[i + 1][0]["s"] if i + 1 < len(chunks) else 1e9
    en = nxt if nxt - en < 0.6 else en + 0.25
    ev.append((st, min(en, nxt), c))

def ts_ass(t):
    cs = int(round(t * 100)); return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"
def ts_srt(t):
    ms = int(round(t * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

GREEN = r"{\c&H52DC3D&}"; WHITE = r"{\c&HFFFFFF&}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter,60,&H00FFFFFF,&H00FFFFFF,&H5A000000,&H64000000,-1,0,0,0,100,100,0.6,0,1,3.2,2.2,2,80,80,66,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines = []
srt = []
for n, (st, en, c) in enumerate(ev):
    words = [w["w"] for w in c]
    pos = r"{\an2\pos(1360,1014)}" if st < TITLE_END else ""
    for i, w in enumerate(c):
        a = st if i == 0 else w["s"]
        b = c[i + 1]["s"] if i + 1 < len(c) else en
        txt = " ".join((GREEN + x + WHITE) if j == i else x for j, x in enumerate(words))
        lines.append(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Sub,,0,0,0,,{pos}{{\\blur5}}{txt}")
    srt.append(f"{n + 1}\n{ts_srt(st)} --> {ts_srt(en)}\n{' '.join(words)}\n")
open(OUT_ASS, "w").write(hdr + "\n".join(lines) + "\n")
open(OUT_SRT, "w").write("\n".join(srt))
for st, en, c in ev: print(f"{st:6.2f}-{en:6.2f}  {' '.join(w['w'] for w in c)}")

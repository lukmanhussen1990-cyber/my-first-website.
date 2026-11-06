"""Step 1b: align the narration script (script.txt, one shot-line per line) to the Whisper word
timestamps and write
  build/timing.json  - per-line start/end (seconds) used by build_scene.py to place shots
  captions/captions.ass - 1-3 word captions, hard cut on/off, Poppins ExtraBold
Usage: python scripts/make_timing.py build/words.json script.txt <audio_duration_s>
"""
import difflib, json, re, sys

words = json.load(open(sys.argv[1]))
lines = [l.strip() for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
duration = float(sys.argv[3])

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))
NUM = {"10": "ten", "5": "five"}
# script tokens keep their punctuation for the captions
tokens = [(li, t) for li, l in enumerate(lines) for t in l.split()]
a = [norm(t) for _, t in tokens]
b = [NUM.get(norm(w["word"]), norm(w["word"])) for w in words]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
times = [None] * len(tokens)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
        for k in range(i2 - i1):
            times[i1 + k] = (words[j1 + k]["start"], words[j1 + k]["end"])
# fill any unmatched token by interpolation
for i, t in enumerate(times):
    if t is None:
        prev = next((times[k][1] for k in range(i - 1, -1, -1) if times[k]), 0.0)
        nxt = next((times[k][0] for k in range(i + 1, len(times)) if times[k]), duration)
        times[i] = (prev, max(prev + 0.05, (prev + nxt) / 2))
missing = sum(1 for i in range(len(tokens)) if a[i] and times[i] is None)

# per-line timing: a line starts at its first word and runs until the next line starts
line_start = {}
for (li, _), t in zip(tokens, times):
    line_start.setdefault(li, t[0])
out_lines = []
for li, text in enumerate(lines):
    s = 0.0 if li == 0 else line_start[li]
    e = line_start[li + 1] if li + 1 < len(lines) else duration
    word_t = [{"w": tok, "s": round(t[0], 3), "e": round(t[1], 3)} for (l2, tok), t in zip(tokens, times) if l2 == li]
    out_lines.append({"i": li + 1, "text": text, "start": round(s, 3), "end": round(e, 3), "words": word_t})
json.dump({"duration": duration, "fps": 30, "lines": out_lines}, open("build/timing.json", "w"), indent=1)

# captions: chunks of 1-3 words, break after punctuation, "Genius!" alone
MAXC = 15                      # max characters per caption (reference style: 1-3 short words)
chunks, cur = [], []
for (li, tok), t in zip(tokens, times):
    if cur and (len(cur) == 3 or len(" ".join([x for x, _ in cur] + [tok])) > MAXC):
        chunks.append(cur); cur = []
    cur.append((tok, t))
    if re.search(r"[,.!?]$", tok):
        chunks.append(cur); cur = []
if cur:
    chunks.append(cur)
def ts(x):
    x = max(0.0, x); h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m:02d}:{s:05.2f}"
events = []
for i, ch in enumerate(chunks):
    s = ch[0][1][0]
    nxt = chunks[i + 1][0][1][0] if i + 1 < len(chunks) else duration
    e = min(nxt, ch[-1][1][1] + 0.6)          # stay up until next chunk (gap > 0.6 s -> clear)
    events.append((s, e, " ".join(x for x, _ in ch)))
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Poppins ExtraBold,104,&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,0,0,0,0,100,100,0,0,1,3.2,0,5,30,30,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
with open("captions/captions.ass", "w", encoding="utf-8") as f:
    f.write(hdr)
    for s, e, txt in events:
        # shadow layer (soft, blurred) under the crisp text layer
        f.write(f"Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{{\\an5\\pos(540,1152)\\bord4\\shad5\\blur4\\1a&HFF&\\3a&H40&}}{txt}\n")
        f.write(f"Dialogue: 1,{ts(s)},{ts(e)},Cap,,0,0,0,,{{\\an5\\pos(540,1152)\\shad0}}{txt}\n")
print(len(lines), "lines,", len(chunks), "caption chunks, unmatched tokens:", sum(1 for t in times if t is None))
for l in out_lines:
    print(f'{l["i"]:2d} {l["start"]:6.2f}-{l["end"]:6.2f}  {l["text"]}')
print(" | ".join(t for _, _, t in events))

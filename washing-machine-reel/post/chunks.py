import json, re
d = json.load(open("/opt/work/audio/transcript.json"))
words = d["words"]
chunks = []
cur = []
def flush():
    global cur
    if cur:
        chunks.append(cur); cur = []
for i, w in enumerate(words):
    t = w["word"]
    if cur:
        prev = cur[-1]
        gap = w["start"] - prev["end"]
        nchar = sum(len(x["word"]) for x in cur) + len(t)
        if len(cur) >= 3 or re.search(r"[,.!?]$", prev["word"]) or gap > 0.25 or (len(cur) == 2 and nchar > 15):
            flush()
    cur.append(w)
flush()
# split specific chunks for rhythm
out = []
for c in chunks:
    txt = " ".join(x["word"] for x in c)
    out.append({"text": txt, "start": c[0]["start"], "end": c[-1]["end"]})
for i, c in enumerate(out):
    print(f"{i:2d} {c['start']:6.2f}-{c['end']:6.2f} {c['text']}")
json.dump(out, open("/opt/work/post/chunks_raw.json", "w"), indent=1)

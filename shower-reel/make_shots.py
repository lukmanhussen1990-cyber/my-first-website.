"""Word timings (faster-whisper + free local forced alignment) -> shots.json with cut times and captions.
Captions show every word exactly as spoken (no censoring), 2-4 words per group, each word pops in on its own start time."""
import json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
W = [dict(w=o["w"], s=o["s"], e=o["e"]) for o in json.load(open(os.path.join(HERE, "audio", "words_aligned.json")))]
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            os.path.join(HERE, "audio", "my_voiceover.mp3")], capture_output=True, text=True).stdout)
LEAD = 0.1
# shot id -> first word index (each cut lands ~0.1 s before that word)
START = [0, 4, 7, 10, 15, 20, 23, 25, 29, 32, 35, 36, 40, 44, 46, 52, 57, 62, 65, 67, 73, 79, 84, 90, 95, 100, 105, 111,
         117, 118, 121, 127, 131, 132, 133, 137, 139, 145, 150, 151, 152, 154, 157, 160, 165, 167, 172, 176, 180, 184, 185,
         186, 187, 191, 195, 201, 204, 208, 214, 216, 221, 227, 230, 233, 239, 243, 248, 251, 255, 258, 259]
shots = []
for k, i in enumerate(START):
    shots.append(dict(id=f"{k + 1:02d}", t0=0.0 if k == 0 else round(W[i]["s"] - LEAD, 3), w0=i))
for k, sh in enumerate(shots):
    sh["t1"] = shots[k + 1]["t0"] if k + 1 < len(shots) else round(DUR, 3)
    sh["dur"] = round(sh["t1"] - sh["t0"], 3)

# ---- captions: tokens (mid + -chew -> MID-CHEW.), then a small DP that picks 2-4 word groups
toks, i = [], 0
while i < len(W):
    if i + 1 < len(W) and W[i + 1]["w"].startswith("-"):
        toks.append(dict(text=(W[i]["w"] + W[i + 1]["w"]).upper(), s=W[i]["s"], e=W[i + 1]["e"], idx=[i, i + 1])); i += 2
    else:
        toks.append(dict(text=W[i]["w"].upper(), s=W[i]["s"], e=W[i]["e"], idx=[i])); i += 1
WEAK = {"THE", "A", "HER", "YOUR", "TO", "OF", "IN", "ITS", "LIKE", "INTO", "ON", "FROM", "SOME", "THAT", "AND", "FOR", "YOU'RE", "IT"}
end_sent = lambda t: t["text"][-1] in ".!?"
NOBREAK = {("LIVING", "ROOM"), ("FIRING", "SQUAD"), ("SHOWER", "CURTAIN"), ("METAL", "BAR"), ("POOL", "PARTY"), ("HUMAN", "FUCKING"), ("PARTY", "BITCHES")}
def gcost(a, b):  # tokens a..b-1 as one group
    n = b - a; g = toks[a:b]
    c = {1: 5.0, 2: 0.0, 3: 0.0, 4: 0.4}[n]
    if n > 1 and any(x["text"].endswith("!") for x in g): c += 9
    for k in range(n - 1):
        gap = g[k + 1]["s"] - g[k]["e"]

        if end_sent(g[k]): c += 1.5 + (6 if gap > 0.6 else 0)
        elif gap > 0.45: c += 3
    if g[-1]["e"] - g[0]["s"] > 2.3: c += 3
    last = g[-1]
    if b < len(toks) and (re.sub(r"[^A-Z]", "", last["text"]), re.sub(r"[^A-Z]", "", toks[b]["text"])) in NOBREAK: c += 4
    nxt_s = toks[b]["s"] if b < len(toks) else DUR
    if min(nxt_s, last["e"] + 0.7) - g[0]["s"] < 0.45: c += 2
    if b < len(toks) and not end_sent(last):
        c += 0.5 if last["text"].endswith(",") else 2.0
        if re.sub(r"[^A-Z']", "", last["text"]) in WEAK: c += 2.5
    return c
INF = 1e9; best = [0.0] + [INF] * len(toks); prev = [0] * (len(toks) + 1)
for b in range(1, len(toks) + 1):
    for n in range(1, 5):
        a = b - n
        if a >= 0 and best[a] + gcost(a, b) < best[b]: best[b] = best[a] + gcost(a, b); prev[b] = a
cuts, b = [], len(toks)
while b > 0: cuts.append((prev[b], b)); b = prev[b]
cuts.reverse()
caps = []
for k, (a, b) in enumerate(cuts):
    g = toks[a:b]; t0 = round(g[0]["s"] - 0.05, 3)
    nxt = toks[cuts[k + 1][0]]["s"] - 0.05 if k + 1 < len(cuts) else DUR
    t1 = round(min(nxt, g[-1]["e"] + 0.7), 3)
    caps.append(dict(t0=t0, t1=t1, words=[dict(text=x["text"], s=x["s"], e=x["e"]) for x in g], idx=[i for x in g for i in x["idx"]]))

# ---- word-for-word check: caption words == transcript words, in order, uncensored
flat = [i for c in caps for i in c["idx"]]
assert flat == list(range(len(W))), "caption word order/coverage mismatch"
cap_text = " ".join(x["text"] for c in caps for x in c["words"]).replace("MID -CHEW", "MID-CHEW")
src_text = " ".join(w["w"] for w in W).upper().replace("MID -CHEW", "MID-CHEW")
assert cap_text == src_text, "caption text differs from transcript"

json.dump(dict(duration=round(DUR, 3), words=W, shots=shots, captions=caps), open(os.path.join(HERE, "shots.json"), "w"), indent=0)
if __name__ == "__main__":
    for sh in shots:
        print(f"{sh['id']} {sh['t0']:6.2f}-{sh['t1']:6.2f} ({sh['dur']:.2f}s)  {' '.join(w['w'] for w in W if sh['t0'] <= w['s'] < sh['t1'])}")
    print("duration", DUR, "shots", len(shots))
    for c in caps: print(f"  {c['t0']:6.2f}-{c['t1']:6.2f}  {' '.join(x['text'] for x in c['words'])}")
    print("captions", len(caps), "| words", len(flat), "== transcript", len(W), "| check OK")

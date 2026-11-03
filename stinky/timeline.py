#!/usr/bin/env python3
"""Lay the 20 voice-line files out on a ~55 s timeline -> build/timeline.json.

Each line keeps its own audio file intact. Pauses go between lines; if the total
is short, extra hold time goes to the "stretch" beats (slow zooms / action),
if long, pauses shrink first. Captions (2-3 words) come from the word timings.
Shared anchors (record scratch, door bell, spray...) are written here so the
picture and the sound use the same instants.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET, LO, HI = 55.0, 53.2, 56.8
PREROLL = 1.4
FPS = 30


def layout(script, man, gaps):
    t = PREROLL
    lines = []
    for ln, m, gap in zip(script["lines"], man, gaps):
        at = t
        words = [{"w": w["word"], "s": round(at + w["start"], 3), "e": round(at + w["end"], 3)} for w in m["words"]]
        lines.append({"id": ln["id"], "speaker": ln["speaker"], "text": ln["text"], "file": m["file"],
                      "at": round(at, 3), "dur": m["duration"], "s": words[0]["s"], "e": words[-1]["e"], "words": words})
        t = at + m["duration"] + gap
    return lines, t


def main():
    script = json.load(open(os.path.join(HERE, "script.json")))
    man = {m["id"]: m for m in json.load(open(os.path.join(HERE, "audio", "lines.json")))}
    man = [man[l["id"]] for l in script["lines"]]
    base = [float(l.get("gap", 0.6)) for l in script["lines"]]
    stretch = [float(l.get("stretch", 0)) for l in script["lines"]]
    mins = [float(l.get("min_gap", l.get("min_tail", 0.3))) for l in script["lines"]]
    gaps = list(base)
    lines, total = layout(script, man, gaps)
    if total < TARGET:
        d = TARGET - total
        gaps = [g + d * s / sum(stretch) for g, s in zip(base, stretch)]
    elif total > TARGET:
        d = total - TARGET
        avail = sum(max(0, g - m) for g, m in zip(base, mins))
        gaps = [g - d * max(0, g - m) / avail for g, m in zip(base, mins)]
    lines, total = layout(script, man, gaps)
    total = round(round(total * FPS) / FPS, 4)
    L = {l["id"]: l for l in lines}
    w = lambda i, k: L[i]["words"][k]["s"]

    caps = []
    for i, (ln, l) in enumerate(zip(script["lines"], lines)):
        k = 0; chunks = []
        for ch in ln["chunks"]:
            n = len(ch.split())
            ws = l["words"][k:k + n]
            assert [x["w"] for x in ws] == ch.split(), (ln["id"], ch)
            chunks.append({"text": ch, "s": ws[0]["s"], "line": ln["id"], "speaker": ln["speaker"]}); k += n
        nxt = lines[i + 1]["s"] if i + 1 < len(lines) else total
        for j, c in enumerate(chunks):
            c["e"] = round(chunks[j + 1]["s"] - 0.03, 3) if j + 1 < len(chunks) else round(min(l["e"] + 0.4, nxt - 0.08), 3)
            c["s"] = round(max(0.0, c["s"] - 0.03), 3)
            caps.append(c)

    A = {
        "alarmEnd": round(L["01"]["s"] + 0.25, 3),
        "crack": round(w("04", 2) - 0.04, 3),
        "brushStart": round(L["06"]["s"] + 0.05, 3), "brushEnd": round(L["06"]["e"] + 0.35, 3),
        "gargleStart": round(w("09", 1) + 0.25, 3), "gargleEnd": round(L["10"]["at"] - 0.05, 3),
        "fresh": round(L["11"]["s"] - 0.04, 3),
        "runStart": round(w("12", 2) - 0.15, 3),
        "bell": round(L["13"]["at"] - 0.85, 3),
        "scratch": round(L["17"]["at"] - 0.62, 3),
        "musicBack": round(L["20"]["s"] + 0.6, 3),
        "spray": round(L["20"]["e"] + 1.25, 3),
    }
    A["runEnd"] = round(A["bell"] - 0.05, 3)
    sfx = [
        {"name": "alarm", "t": 0.05, "dur": round(A["alarmEnd"] - 0.05, 3), "gain_db": -15},
        {"name": "mirror_crack", "t": A["crack"], "gain_db": -12},
        {"name": "brush", "t": A["brushStart"], "dur": round(A["brushEnd"] - A["brushStart"], 3), "gain_db": -20},
        {"name": "gargle", "t": A["gargleStart"], "dur": round(A["gargleEnd"] - A["gargleStart"], 3), "gain_db": -17},
        {"name": "ding", "t": A["fresh"], "gain_db": -19},
        {"name": "footsteps", "t": A["runStart"], "dur": round(A["runEnd"] - A["runStart"], 3), "gain_db": -16},
        {"name": "door_bell", "t": A["bell"], "gain_db": -15},
        {"name": "record_scratch", "t": A["scratch"], "gain_db": -13},
        {"name": "spray", "t": A["spray"], "gain_db": -18},
    ]
    music = [{"from": 0.0, "to": A["scratch"] + 0.05}, {"from": A["musicBack"], "to": total}]
    tl = {"fps": FPS, "duration": total, "frames": int(round(total * FPS)), "lines": lines,
          "gaps": [round(g, 3) for g in gaps], "captions": caps, "anchors": A, "sfx": sfx, "music": music}
    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    json.dump(tl, open(os.path.join(HERE, "build", "timeline.json"), "w"), indent=1)
    print(f"timeline: {total:.2f}s, voice {sum(m['duration'] for m in man):.2f}s, {len(caps)} captions")
    if not LO <= total <= HI:
        print("WARNING: outside 53-57 s", file=sys.stderr); sys.exit(2)


if __name__ == "__main__":
    main()

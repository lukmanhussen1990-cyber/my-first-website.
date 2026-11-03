#!/usr/bin/env python3
"""build/timeline.json: lines, captions and sound cues, all taken straight from the
voiceover timing. The video is exactly as long as the voiceover (no pauses added)."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30


def main():
    script = json.load(open(os.path.join(HERE, "script.json")))
    W = json.load(open(os.path.join(HERE, "audio", "words.json")))
    dur = W["duration"]
    words = W["words"]
    lines, caps = [], []
    k = 0
    for ln in script["lines"]:
        n = len(ln["text"].split())
        ws = words[k:k + n]; k += n
        assert all(w["line"] == ln["id"] for w in ws)
        lines.append({"id": ln["id"], "text": ln["text"], "s": ws[0]["s"], "e": ws[-1]["e"], "words": [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in ws]})
        j = 0
        for ci, ch in enumerate(ln["chunks"]):
            m = len(ch.split())
            loud = bool(ln.get("loud")) or ("loud_from" in ln and ci >= ln["loud_from"])
            caps.append({"text": ch, "s": ws[j]["s"], "line": ln["id"], "loud": loud})
            j += m
        assert j == n, ln["id"]
    for i, c in enumerate(caps):
        line = next(l for l in lines if l["id"] == c["line"])
        nxt = caps[i + 1]["s"] if i + 1 < len(caps) else dur
        same_line_next = i + 1 < len(caps) and caps[i + 1]["line"] == c["line"]
        c["e"] = round(nxt - 0.02, 3) if same_line_next else round(min(line["e"] + 0.3, nxt - 0.05), 3)
        c["s"] = round(max(0.0, c["s"] - 0.04), 3)
    L = {l["id"]: l for l in lines}
    w = lambda i, q: L[i]["words"][q]["s"]
    A = {
        "gate": round(L["03"]["s"] + 0.1, 3),
        "ring": round(L["08"]["s"] - 0.1, 3),
        "mansionDoor": round(L["11"]["s"] - 0.05, 3),
        "bathDoor": round(L["18"]["s"] - 0.12, 3),
        "whistle": round(L["19"]["s"] + 0.2, 3),
        "party": round(L["23"]["s"] - 0.45, 3),
        "scratch": round(L["27"]["s"] - 0.55, 3),
        "flash": round(w("30", 4) + 0.15, 3),
    }
    sfx = [
        {"name": "gate_creak", "t": A["gate"], "gain_db": -24},
        {"name": "phone_ring", "t": A["ring"], "gain_db": -24},
        {"name": "door_creak", "t": A["mansionDoor"], "gain_db": -23},
        {"name": "door_creak", "t": A["bathDoor"], "gain_db": -23},
        {"name": "whistle", "t": A["whistle"], "gain_db": -24},
        {"name": "party", "t": A["party"], "dur": round(L["26"]["s"] - A["party"], 3), "gain_db": -28},
        {"name": "record_scratch", "t": A["scratch"], "gain_db": -20},
        {"name": "shutter", "t": A["flash"], "gain_db": -18},
    ]
    frames = int(math.floor(dur * FPS))
    tl = {"fps": FPS, "duration": round(frames / FPS, 4), "audio_duration": dur, "frames": frames,
          "lines": lines, "captions": caps, "anchors": A, "sfx": sfx}
    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    json.dump(tl, open(os.path.join(HERE, "build", "timeline.json"), "w"), indent=1)
    print(f"timeline: {frames} frames = {frames / FPS:.3f}s (voiceover {dur:.3f}s), {len(caps)} captions")


if __name__ == "__main__":
    main()

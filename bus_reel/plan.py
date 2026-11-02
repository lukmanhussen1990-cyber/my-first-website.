"""Shot plan for the bus crush reel -> shots.json (times from the voice: audio/word_onsets.json + captions.ass).

A shot starts SHOT_LEAD before the onset of the word that opens it (first shot at 0) and ends where the next starts;
the last one ends with the voiceover. `events` = word onsets the 3D shots sync to. Run after make_captions.py:
    python3 plan.py && python3 gen_plan_js.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
FPS, SHOT_LEAD = 30, 0.12
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())


def word(line, w, nth=0):
    hits = [x for x in WORDS if x["line"] == line and norm(x["w"]) == norm(w)]
    return hits[nth]["s"]


def end(line):
    return [x for x in WORDS if x["line"] == line][-1]["e"]


def start(line):
    return [x for x in WORDS if x["line"] == line][0]["s"]


# (start line, start word | None = line start | ("end", dt) = line end + dt, loc, size, label, events, scene)
SHOTS = [
    (1, None, "bus", "medium", None, {"pooped": (1, "pooped")},
     "ME sits on the crowded morning bus (aisle seat, backpack on), a small green stink line rises."),
    (1, "college", "bus", "close-up", None, {"bus": (1, "bus.")},
     "Close on ME: nervous little look around, the stink line curls up past his face."),
    (2, None, "bus", "medium close-up", None, {"thought": (2, "thought"), "fart": (2, "fart.")},
     "ME relaxed and smiling, looking out the window: trees and sunlight slide past."),
    (3, None, "bus", "wide", None, {"full": (3, "full.")},
     "Wide: the crowded bus, people standing holding poles, every seat taken."),
    (4, None, "bus", "medium", None, {"crush": (4, "crush"), "gets": (4, "gets")},
     "Slow motion: CRUSH steps in through the front door, soft light, sparkles, hair floating."),
    (5, None, "bus", "medium", None, {"empty": (5, "empty"), "seat": (5, "seat...")},
     "Slow zoom on the only empty seat: the window seat right next to ME."),
    (5, "is", "bus", "close-up", None, {"next": (5, "next"), "you": (5, "you.")},
     "ME sweats: drops pop from his head."),
    (6, None, "bus", "medium", None, {"sits": (6, "sits"), "down": (6, "down.")},
     "She sits down in the window seat next to him."),
    (7, None, "bus", "close-up", None, {"smiles": (7, "smiles")},
     "Close-up: CRUSH smiles at him, big shiny eyes, blush, pink sparkles pop."),
    (8, None, "bus", "close-up", None, {"smile": (8, "smile")},
     "ME gives a nervous, shaky smile. Sweat."),
    (9, None, "bus", "medium", None, {"smell": (9, "smell")},
     "Two-shot: a green smell cloud slowly grows from ME's seat and drifts toward her."),
    (9, "reaches", "bus", "close-up", None, {"reaches": (9, "reaches"), "her": (9, "her.")},
     "The green cloud reaches her face."),
    (10, None, "bus", "close-up", None, {"stops": (10, "stops.")},
     "Close-up: her smile freezes, eyes wide, a twitch."),
    (11, None, "bus", "medium", None, {"opens": (11, "opens"), "window": (11, "window.")},
     "She quickly slides the window open."),
    (12, None, "bus", "medium", None, {"puts": (12, "puts")},
     "From inside: she stands and pushes her whole head out of the window."),
    (12, "head", "bus", "medium", None, {"outside": (12, "outside.")},
     "Outside the moving bus: her head out of the window like a dog, hair blowing in the wind."),
    (13, None, "bus", "extreme close-up", None, {"looks": (13, "looks"), "mirror": (13, "mirror")},
     "The driver's eyes in the big mirror, looking back."),
    (14, "stops", "bus", "wide", None, {"stops": (14, "stops"), "bus": (14, "bus.")},
     "The bus brakes hard: everyone jerks forward."),
    (15, None, "bus", "wide", None, {"off": (15, "off.")},
     "Everyone runs off holding their noses, CRUSH too."),
    (16, None, "bus", "medium", None, {"except": (16, "except"), "you": (16, "you.")},
     "ME sits alone in the empty bus, inside a big green cloud."),
    (16, ("end", 0.12), "bus", "wide", None, {"have": (17, "have"), "ride": (17, "ride!")},
     "Outside: the bus drives away with only ME inside, green cloud puffing out of the windows. Fade out."),
]


def captions():
    out = []
    for l in open(os.path.join(HERE, "audio", "captions.ass")):
        if l.startswith("Dialogue:") and ",Caption," in l:
            f = l.split(",", 9)
            h, m, s = f[1].split(":")
            out.append((int(h) * 3600 + int(m) * 60 + float(s), re.sub(r"\{[^}]*\}", "", f[9]).strip().replace("\\h", "")))
    return out


def main():
    dur = round(round(VO["duration"] * FPS) / FPS, 3)
    t0s = []
    for i, (line, w, *_rest) in enumerate(SHOTS):
        on = start(line) if w is None else (end(line) + w[1] + SHOT_LEAD if isinstance(w, tuple) else word(line, w))
        t0s.append(0.0 if i == 0 else round(round((on - SHOT_LEAD) * FPS) / FPS, 3))
    caps = captions()
    shots = []
    for i, (line, w, loc, size, label, ev, scene) in enumerate(SHOTS):
        t0, t1 = t0s[i], (t0s[i + 1] if i + 1 < len(SHOTS) else dur)
        events = {k: round(start(l) if ww is None else word(l, ww), 3) for k, (l, ww) in ev.items()}
        text = VO["lines"][line - 1]["text"]
        shots.append({"id": i + 1, "t0": t0, "t1": t1, "dur": round(t1 - t0, 3), "loc": loc, "size": size, "label": label,
                      "voice": text, "events": events, "scene": scene,
                      "captions": [{"text": c, "t": round(t, 3)} for t, c in caps if t0 - 0.06 <= t < t1 - 0.06]})
    json.dump({"fps": FPS, "duration": dur, "shots": shots}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for s in shots:
        print(f"{s['id']:2d} {s['t0']:6.2f}-{s['t1']:6.2f} ({s['dur']:.2f}) {s['loc']:6s} {s['label'] or '':16s} {s['events']}  {[c['text'] for c in s['captions']]}")


if __name__ == "__main__":
    main()

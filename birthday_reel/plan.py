"""Shot plan for the birthday reel -> shots.json (times from the voice: audio/word_onsets.json + captions.ass).

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


def start(line):
    return [x for x in WORDS if x["line"] == line][0]["s"]


# (start line, start word | None = line start, loc, size, label, events {name: (line, word|None)}, scene)
SHOTS = [
    (1, None, "house", "medium", "AGE 30", {"old": (1, "old")},
     "YOU (30, beard, blue polo, striped party hat) at the kids' birthday table, sipping from a tiny juice cup, deadpan."),
    (2, None, "void", "medium close-up", None, {"wipe": (2, "wipe"), "ass": (2, "ass")},
     "Starry void: YOU holds up a toilet paper roll and stares at it, totally lost. Question marks pop over his head."),
    (3, None, "void", "medium", None, {"mom": (3, "mom"), "does": (3, "does")},
     "Starry void: MOM appears in a warm golden glow, proudly holding up a fresh roll like a trophy. Sparkles."),
    (4, None, "house", "wide", None, {"nephew": (4, "nephew's"), "birthday": (4, "birthday")},
     "Wide: the party. Balloons, HAPPY BIRTHDAY banner, cake with 6 candles; the birthday boy in his crown, Dad, Uncle, Grandma."),
    (5, None, "house", "medium close-up", None, {"pooped": (5, "pooped")},
     "Bathroom, chest-up only: YOU sits, eyes closed, relieved little smile. Green stink lines rise. Then his eyes open: no paper."),
    (6, None, "house", "close-up", None, {"mom": (6, None)},
     "Bathroom close-up: YOU yells MOM! Camera shake, speed lines, echo."),
    (7, None, "house", "medium", None, {"isnt": (7, "isn't")},
     "The party table: Mom's chair is empty, her MOM name card. A tumbleweed rolls past. Crickets."),
    (8, None, "house", "medium", None, {"dad": (8, None)},
     "The bathroom door opens a crack: only YOU's head pokes out, yelling DAD!"),
    (9, None, "house", "medium", None, {"no": (9, None)},
     "Dad on the couch behind his newspaper. He doesn't even look up: No."),
    (10, None, "house", "close-up", None, {"uncle": (10, None)},
     "Closer: YOU's head out of the door crack, yelling UNCLE!"),
    (11, None, "house", "medium", None, {"no": (11, None)},
     "Uncle with a plate of cake, mouth full, shakes his head: No."),
    (12, None, "house", "medium", None, {"grandma": (12, "grandma"), "sleep": (12, "sleep")},
     "Grandma in her armchair squeezes her eyes shut and fake-snores (Zzz). One eye peeks open, then shuts again."),
    (13, None, "house", "medium", None, {"birthday": (13, "birthday"), "knocks": (13, "knocks")},
     "Low angle behind the birthday boy: he walks up to the bathroom door and knocks."),
    (14, None, "house", "close-up", None, {"teach": (14, "teach")},
     "Low hero angle on the birthday boy, serious face: I'll teach you."),
    (15, None, "void", "close-up", None, {"know": (15, "know:")},
     "Starry void: a toilet paper roll spins slowly in a spotlight."),
    (16, None, "void", "medium", None, {"kids": (16, "kids"), "wipe": (16, "wipe"), "five": (16, "five.")},
     "Void: the roll + the birthday boy proudly holding one up; badge AGE 5 pops on 'five'."),
    (17, None, "house", "medium close-up", None, {"one": (17, "one"), "experience": (17, "experience.")},
     "The birthday boy at the door puts on tiny sunglasses: a pro. Badge 1 YEAR."),
    (18, None, "house", "medium close-up", None, {"four": (18, "\"four")},
     "The kid coaches through the door, holding up a roll: Four squares!"),
    (18, "Fold.", "house", "medium", None, {"fold": (18, "fold.")},
     "The family watches, frozen: Dad lowers the newspaper, Uncle stops chewing, Grandma's eyes wide open."),
    (18, "Wipe.\"", "house", "medium", None, {"wipe": (18, "wipe.\"")},
     "The bathroom door shakes. The kid nods like a coach."),
    (19, None, "house", "wide", "10 MINUTES LATER", {"later": (19, "later...")},
     "Everyone stands in front of the bathroom door, waiting. The clock on the wall."),
    (20, None, "house", "medium", None, {"did": (20, "did")},
     "The door swings open: YOU steps out like a hero, golden light behind him, sparkles. Everyone cheers."),
    (21, None, "house", "medium close-up", None, {"six": (21, "six.")},
     "The birthday boy holds out his hand, palm up, looking up at YOU."),
    (22, None, "house", "medium", None, {"charges": (22, "charges"), "dollars": (22, "dollars.")},
     "YOU hands him a $5 bill. The kid snaps it, puts on his sunglasses. Ka-ching."),
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
        on = start(line) if w is None else word(line, w)
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

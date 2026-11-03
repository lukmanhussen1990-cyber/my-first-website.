"""Shot plan for the oscar reel -> shots.json (times from the voice: audio/word_onsets.json + captions.ass).

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
    (1, None, "theatre", "wide", None, {"won": (1, "won")}, "Opening: huge golden theatre, red curtains, spotlights, crowd in tuxedos and gowns cheering."),
    (1, "Oscar.", "theatre", "close-up", None, {"oscar": (1, "Oscar.")}, "Close-up: his hand raises the shiny golden award statue, sparkles."),
    (2, None, "theatre", "medium", None, {"walk": (2, "walk")}, "He walks up the stage stairs holding the statue, huge proud smile (low angle)."),
    (2, "mic.", "theatre", "medium", None, {"mic": (2, "mic.")}, "LUMP A: at the mic from behind-side, holding the statue up, proud. Normal trousers."),
    (3, None, "theatre", "close-up", None, {"just": (3, "just")}, "Close-up: his proud smile... freezes."),
    (3, "pooped", "theatre", "medium", None, {"pooped": (3, "pooped")}, "LUMP B: same angle as A: small round lump in the back of his trousers, green stink lines, eyes wide."),
    (4, None, "home", "medium", None, {"billion": (4, "billion")}, "A family on a sofa watching him on TV."),
    (4, "are", "home", "medium", None, {"watching": (4, "watching.")}, "A grandma with a bowl of popcorn staring at her TV."),
    (5, None, "theatre", "close-up", None, {"thank": (5, "\"Thank")}, "He leans into the mic: 'Thank you.' (mic feedback)."),
    (6, None, "theatre", "extreme close-up", None, {"cracks": (6, "cracks.")}, "Extreme close-up: his face, sweat drops, voice cracking."),
    (7, None, "theatre", "wide", None, {"front": (7, "front")}, "The whole front row of celebrities sniffing at the same time."),
    (7, "sniffs.", "theatre", "medium", None, {"sniffs": (7, "sniffs.")}, "Two celebrities in the front row look at each other."),
    (8, None, "theatre", "close-up", None, {"nervous": (8, "nervous.")}, "His eyes dart left and right, sweat."),
    (9, None, "theatre", "medium", None, {"again": (9, "again.")}, "LUMP C: same angle: bigger lump, like a balloon, more stink lines (SQUISH)."),
    (10, None, "theatre", "close-up", None, {"want": (10, "want")}, "He points into the audience: 'I want to thank my mom...'"),
    (10, "mom...\"", "theatre", "medium", None, {"mom": (10, "mom...\"")}, "His mom in the audience, proud tears... she sniffs, her smile freezes."),
    (11, None, "theatre", "medium", None, {"again": (11, "again.")}, "LUMP D: same angle: even bigger, the tuxedo tails lifting up."),
    (12, None, "theatre", "medium", None, {"nose": (12, "nose.")}, "Co-star in a sparkly silver gown, smiling for the cameras, pinching her nose."),
    (13, None, "theatre", "wide", None, {"camera": (13, "camera"), "zooms": (13, "zooms")}, "A big TV camera on a crane swings toward him, red LIVE light."),
    (13, "face.", "theatre", "wide", None, {"face": (13, "face.")}, "His giant face on the theatre screen, eye twitching."),
    (14, None, "theatre", "medium", None, {"more": (14, "more.")}, "LUMP E: HUGE lump, trousers stretched like a beach ball, buttons popping off (SQUOOOSH)."),
    (15, None, "theatre", "wide", None, {"nerves": (15, "nerves.")}, "Wide stage: thick green fog around him, frozen smile."),
    (16, None, "theatre", "medium", None, {"director": (16, "director")}, "The director in row one: white beard, glasses, velvet jacket."),
    (17, None, "theatre", "close-up", None, {"crying": (17, "crying.")}, "A single tear rolls down the director's cheek."),
    (18, None, "theatre", "close-up", None, {"joy": (18, "joy.")}, "Handkerchief pressed over his nose: not from joy."),
    (19, None, "theatre", "wide", None, {"know": (19, "know:")}, "What you don't know: the orchestra pit below the stage, a stopwatch in the corner."),
    (20, None, "theatre", "medium", None, {"winners": (20, "winners")}, "The conductor slowly raises his baton, staring at a stopwatch."),
    (20, "forty-five", "theatre", "close-up", None, {"seconds": (20, "seconds")}, "Close-up of the stopwatch in the conductor's hand."),
    (22, None, "theatre", "wide", None, {"orchestra": (22, "orchestra")}, "The orchestra ready: violins, trumpets, cellos, all looking up at the stage."),
    (23, None, "theatre", "medium", None, {"push": (23, "push")}, "Over the conductor's shoulder: him at the mic, far away."),
    (24, None, "theatre", "extreme close-up", None, {"forty": (24, "Forty")}, "COUNTDOWN 0:40 - his sweating face."),
    (25, None, "theatre", "close-up", None, {"fortyfour": (25, "Forty-four.")}, "COUNTDOWN 0:44 - the conductor's raised baton, trembling."),
    (26, None, "theatre", "extreme close-up", None, {"fortyfive": (26, "Forty-five.")}, "COUNTDOWN 0:45 - his eyes go wide."),
    (27, None, "theatre", "wide", None, {"music": (27, "music")}, "The conductor swings the baton: loud play-off music, the spotlight shifts away."),
    (28, None, "theatre", "wide", None, {"walk": (28, "walk")}, "Wide from behind: he walks off stiff-legged like a penguin, the huge lump, green fog trailing."),
    (29, None, "theatre", "wide", None, {"slowly": (29, "slowly.")}, "Side view: very... slowly... the whole crowd watching him cross the stage."),
    (30, None, "theatre", "wide", None, {"keeps": (30, "keeps")}, "The orchestra keeps playing (wide)."),
    (31, None, "theatre", "medium", None, {"hand": (31, "hand.")}, "Violin, trumpet and cello players playing with ONE hand, pinching their noses with the other."),
    (32, None, "theatre", "medium", None, {"other": (32, "other")}, "The conductor conducting with his nose pinched."),
    (32, "holding", "outside", "wide", None, {"nose": (32, "nose.")}, "Last shot: the glowing theatre at night, searchlights, green stink lines rising from the roof, slow zoom out."),
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
                      "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4",
                      "voice": text, "events": events, "scene": scene,
                      "captions": [{"text": c, "t": round(t, 3)} for t, c in caps if t0 - 0.06 <= t < t1 - 0.06]})
    json.dump({"fps": FPS, "duration": dur, "shots": shots}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for s in shots:
        print(f"{s['id']:2d} {s['t0']:6.2f}-{s['t1']:6.2f} ({s['dur']:.2f}) {s['loc']:6s} {s['label'] or '':16s} {s['events']}  {[c['text'] for c in s['captions']]}")


if __name__ == "__main__":
    main()

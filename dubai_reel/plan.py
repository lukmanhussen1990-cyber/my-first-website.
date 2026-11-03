"""Shot plan for the dubai aunty reel -> shots.json (times from the voice: audio/word_onsets.json + captions.ass).

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
    (1, None, "house", "wide", None, {"thirty": (1, "thirty")}, "The closed bathroom door from the living room; green stink lines rise above it."),
    (1, "years", "house", "medium", None, {"old": (1, "old.")}, "Closer on the door: the stink lines curl out of the gap at the top."),
    (2, None, "house", "medium close-up", None, {"just": (2, "just")}, "YOU (30, beard) on the toilet, chest-up, totally relaxed, eyes closed."),
    (2, "pooped.", "house", "close-up", None, {"pooped": (2, "pooped.")}, "Close: a happy little sigh; a small green stink line."),
    (3, None, "house", "close-up", None, {"usual": (3, "usual,")}, "YOU takes a deep breath: chest up, cheeks puffed."),
    (3, "you", "house", "extreme close-up", None, {"yell": (3, "yell...")}, "Even closer: he fills up with air, eyes squeezed."),
    (4, None, "house", "close-up", None, {"mom": (4, "MOM!")}, "MOM! Big yell, motion arcs around his head, screen shake."),
    (4, "I'M", "house", "extreme close-up", None, {"done": (4, "DONE!")}, "I'M DOOONE! Another angle, arcs, shake."),
    (5, None, "house", "medium", None, {"mug": (5, "mug.")}, "MOM walks in, tired, holding her coffee mug and a tissue box."),
    (6, None, "house", "extreme close-up", None, {"doorbell": (6, "doorbell"), "rings": (6, "rings.")}, "Close-up of the doorbell: a gold-ringed finger presses it."),
    (7, None, "house", "medium", None, {"rich": (7, "rich")}, "Slow motion: the front door opens; light, gold sparkles, AUNTY with shopping bags."),
    (8, None, "house", "close-up", None, {"dubai": (8, "Dubai.")}, "Close-up AUNTY: huge sunglasses, gold jewellery, gold sparkles."),
    (9, None, "house", "close-up", None, {"drops": (9, "drops"), "mug": (9, "mug.")}, "The mug falls in slow motion and splashes on the floor."),
    (10, None, "house", "medium", None, {"runs": (10, "runs.")}, "MOM runs to the front door (speed lines)."),
    (11, None, "house", "wide", None, {"forgot": (11, "forgot")}, "Living room: MOM hugs AUNTY, takes her bags, both laughing."),
    (11, "thing.", "house", "medium", None, {"thing": (11, "thing.")}, "The bathroom door far in the back of the room, closed. Silence."),
    (12, None, "house", "close-up", None, {"you": (12, "You.")}, "YOU alone on the toilet, slow zoom on his face, a tear."),
    (13, None, "house", "close-up", "10 MINUTES LATER", {"ten": (13, "Ten")}, "The wall clock: the minute hand jumps."),
    (14, None, "house", "close-up", None, {"mom": (14, "MOM!")}, "MOM! again: yell, arcs, shake."),
    (15, None, "house", "medium", None, {"pressure": (15, "pressure")}, "MOM laughing with AUNTY on the sofa: she doesn't hear."),
    (15, "is", "house", "close-up", None, {"louder": (15, "louder.")}, "The pressure cooker whistles, steam shooting up."),
    (16, None, "house", "close-up", "1 HOUR LATER", {"hour": (16, "hour.")}, "YOU, tired, sweating, still on the toilet."),
    (17, None, "house", "close-up", None, {"numb": (17, "numb.")}, "His feet shake, pins-and-needles stars around his legs."),
    (18, None, "house", "medium", None, {"walks": (18, "walks"), "door": (18, "door.")}, "GRANDPA with his cane walks past the bathroom door, whistling."),
    (19, None, "house", "close-up", None, {"pretends": (19, "pretends"), "hear": (19, "hear.")}, "GRANDPA looks away... then fake-sleeps: Zzz."),
    (20, None, "house", "close-up", "2 HOURS LATER", {"two": (20, "Two")}, "The clock spins fast."),
    (21, None, "house", "wide", None, {"asks": (21, "asks")}, "AUNTY on the sofa holding her tea, MOM next to her."),
    (21, "question.", "house", "close-up", None, {"question": (21, "question.")}, "AUNTY puts her teacup down."),
    (22, None, "house", "close-up", None, {"where": (22, "Where"), "toilet": (22, "toilet?")}, "Close-up AUNTY: Where is the toilet?"),
    (23, None, "house", "extreme close-up", None, {"lock": (23, "lock.")}, "The bathroom door handle: no lock, just an empty hole."),
    (23, "lock.", "house", "close-up", None, {}, "YOU sweats: one big sweat drop."),
    (24, None, "house", "extreme close-up", None, {"turns": (24, "turns.")}, "Inside: the handle turns."),
    (25, None, "house", "medium", None, {"slowly": (25, "Slowly.")}, "Dramatic slow zoom: the door opens a crack, light comes in."),
    (26, None, "house", "close-up", None, {"looks": (26, "looks")}, "AUNTY in the doorway, frozen; her sunglasses slide down."),
    (27, None, "house", "close-up", None, {"look": (27, "look")}, "YOU, frozen, eyes wide."),
    (28, None, "house", "medium close-up", None, {"aunty": (28, "Aunty...")}, "YOU holds out his hand with a shy little smile."),
    (28, "pass", "house", "close-up", None, {"tissue": (28, "tissue?")}, "AUNTY's jaw drops; sweat."),
    (29, None, "house", "wide", None, {"know": (29, "know...")}, "The hallway, slow zoom in."),
    (30, None, "house", "medium", None, {"writing": (30, "writing")}, "AUNTY at the dining table writing on a paper."),
    (30, "will", "house", "close-up", None, {"today": (30, "today.")}, "Close-up of the paper: MY WILL."),
    (31, None, "house", "extreme close-up", None, {"name": (31, "name")}, "The pen points at the last line: YOU."),
    (32, None, "house", "extreme close-up", None, {"was": (32, "Was.")}, "She crosses out his name with the red pen. Fade out."),
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

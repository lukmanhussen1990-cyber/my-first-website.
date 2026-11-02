"""Turn audio/timeline.json into shots.json (shot cut times, captions, image names)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "audio", "timeline.json")))
W = TL["words"]
TAIL = 3.2  # seconds after the last word (zoom out + birds)
END = round(W[-1]["e"] + TAIL, 3)

# (shot id, first word index, image file)  - calendar image is reused 3 times
SHOTS = [
    ("01", 0, "shot01"), ("02", 6, "shot02"), ("03a", 10, "shot03a"), ("03b", 13, "shot03b"),
    ("04", 16, "shot04"), ("05", 20, "shot05"), ("06", 25, "shot06"), ("07", 28, "shot07"),
    ("08", 30, "shot08"), ("09", 34, "shot09"), ("10", 38, "shot10"), ("11", 40, "shot11"),
    ("12", 42, "shot12"), ("13", 47, "shot13"), ("14", 51, "shot14"), ("15", 55, "shot15"),
    ("16", 59, "shot16"), ("17", 63, "shot17"), ("18", 66, "shot18"), ("19", 73, "shot19"),
    ("20", 78, "shot20"), ("21", 83, "shot21"), ("22", 85, "shot22"), ("23", None, "shot23"),
    ("24", 96, "shot24"), ("25", 100, "shot25"), ("26", 106, "shot26"), ("27", 110, "shot27"),
    ("28", 118, "shot28_calendar"), ("29", 120, "shot29"), ("30", 126, "shot28_calendar"),
    ("31", 128, "shot31"), ("32", 134, "shot28_calendar"), ("33", 136, "shot33"), ("34", 139, "shot34"),
    ("35", 141, "shot35"), ("36", 147, "shot36_page"), ("37", 153, "shot37"), ("38", 157, "shot38"),
    ("39", 160, "shot39"),
]
LEAD = 0.1

CAPS = [
    (0, "You came to visit"), (3, "your friend."), (6, "At a psychiatric hospital."),
    (10, "And you just"), (13, "pooped your pants."), (16, "In the waiting room."),
    (20, "You try to act normal."), (25, "You walk sideways."), (28, "Very slowly."),
    (30, "You whisper to yourself:"), (34, '"It\'s fine.'), (36, 'It\'s fine."'),
    (38, "You sweat."), (40, "A lot."), (42, "A doctor"), (44, "is watching you."),
    (47, "He writes something down."), (51, "Then he underlines it."), (55, "You smile at him."),
    (59, "That makes it worse."), (63, "He walks over."), (66, '"How are you'), (69, 'feeling today?"'),
    (71, "You say:"), (73, '"I just need'), (76, 'a bathroom."'), (78, "He nods."), (80, "And hands you"),
    (83, "a wristband."), (85, "It already has"), (88, "your name on it."),
    (92, "What you don't know:"), (96, "in 1973,"), (98, "a scientist sent"), (101, "healthy people"),
    (103, "into psychiatric hospitals."), (106, "They all got admitted."), (110, "Some couldn't get out"),
    (114, "for almost two months."), (118, "Week one."), (120, "You keep telling them"), (124, "you're fine."),
    (126, "Week two."), (128, "You still haven't"), (131, "changed your pants."), (134, "Week three."),
    (136, "Your file"), (138, "is very thick."), (141, "Every page says"), (144, "the same thing:"),
    (147, '"Patient talks'), (149, 'about poop a lot."'), (153, "Your friend"), (155, "gets discharged."),
    (157, "He waves goodbye."), (160, "Enjoy your stay."),
]

shots = []
for k, (sid, wi, img) in enumerate(SHOTS):
    if wi is None:  # projector shot starts in the pause before "What you don't know"
        t0 = round(W[91]["e"] + 0.45, 3); wi = 92
        shots.append(dict(id=sid, t0=t0, first_word=wi, image=img)); continue
    t0 = 0.0 if k == 0 else round(W[wi]["s"] - LEAD, 3)
    if sid == "03b":
        t0 = round(W[wi]["s"] - 0.03, 3)  # cut exactly on "pooped"
    shots.append(dict(id=sid, t0=t0, first_word=wi, image=img))
for k, s in enumerate(shots):
    s["t1"] = shots[k + 1]["t0"] if k + 1 < len(shots) else END
    s["dur"] = round(s["t1"] - s["t0"], 3)

caps = []
for k, (wi, text) in enumerate(CAPS):
    t0 = round(W[wi]["s"] - 0.04, 3)
    t1 = round(W[CAPS[k + 1][0]]["s"] - 0.04, 3) if k + 1 < len(CAPS) else END - 0.4
    caps.append(dict(t0=t0, t1=t1, text=text))

out = dict(duration=END, vo_duration=TL["duration"], words=W, shots=shots, captions=caps)
json.dump(out, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
if __name__ == "__main__":
    for s in shots:
        print(f"{s['id']:>4} {s['t0']:6.2f}-{s['t1']:6.2f} ({s['dur']:.2f}s) {s['image']:<16} {' '.join(w['w'] for w in W if s['t0'] <= w['s'] < s['t1'])}")
    print("total", END, "shots", len(shots), "unique images", len(set(s['image'] for s in shots)))

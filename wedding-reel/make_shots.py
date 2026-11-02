"""Turn audio/timeline.json into shots.json (shot cut times + captions)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "audio", "timeline.json")))
W = TL["words"]
# whisper got these wrong; exact times measured from the audio energy
OVERRIDES = {46: (20.99, 21.16), 47: (21.70, 21.84), 48: (22.35, 22.48), 49: (23.11, 23.3)}
for i, (s_, e_) in OVERRIDES.items():
    W[i]["s"], W[i]["e"] = s_, e_
TAIL = 2.9  # seconds after the last word (bells + confetti)
END = round(W[-1]["e"] + TAIL, 3)

# (shot id, index of the first word in the shot)
SHOTS = [
    ("01", 0), ("02", 3), ("03", 8), ("04a", 12), ("04b", 15), ("05", 18), ("06", 21), ("07", 26),
    ("08", 30), ("09", 31), ("10", 35), ("11", 37), ("12", 40), ("13", 44), ("14", 46), ("15", 49),
    ("16", 53), ("17", 56), ("18", 58), ("19", 61), ("20", 64), ("21", 70), ("21b", None), ("22", 76), ("23", 80),
    ("24", 88), ("25", 93), ("26", 102), ("27", 108), ("28", 112), ("29", 117), ("30", 122),
    ("31", 124), ("32", 128),
]
LEAD = 0.1  # cut a little before the first word

# captions: (first word index, text). Each stays until the next one starts.
CAPS = [
    (0, "You're getting married."), (3, "Three hundred guests"), (6, "are watching."),
    (8, "You're saying your vows."), (12, "And you just"), (15, "pooped your pants."),
    (18, "You keep talking."), (21, '"I promise'), (23, 'to love you..."'), (26, "Your voice"),
    (28, "is shaking."), (30, '"...forever."'), (31, "The priest leans in."), (35, "He sniffs."),
    (37, "He leans back."), (40, "The photographer"), (42, "moves closer."), (44, "Close-up."),
    (46, "Click."), (47, "Click. Click."), (48, "Click. Click. Click."), (49, "She holds your hands."),
    (53, "She starts crying."), (56, "Happy tears."), (58, "Then she sniffs."), (61, "The tears stop."),
    (64, "The flower girl"), (67, "stops throwing flowers."), (70, "The ring bearer"), (73, "covers his nose."),
    (76, "What you don't know:"), (80, "we wear the ring"), (84, "on the fourth finger"),
    (88, "because the ancient"), (91, "Romans believed"), (93, "a vein ran straight"),
    (97, "from it to the heart."), (102, "Right now,"), (104, "her heart is fine."), (108, "Her nose is not."),
    (112, '"Do you take this man?"'), (117, "Long pause."), (119, "Very long pause."), (122, '"I do."'),
    (124, "From five metres away."), (128, "Congratulations."),
]

shots = []
for k, (sid, wi) in enumerate(SHOTS):
    if wi is None:  # ring close-up in the pause after "nose."
        t0 = round(W[75]["e"] + 0.45, 3); wi = 76
        shots.append(dict(id=sid, t0=t0, first_word=wi)); continue
    t0 = 0.0 if k == 0 else round(W[wi]["s"] - LEAD, 3)
    if sid == "04b":
        t0 = round(W[wi]["s"] - 0.03, 3)  # cut exactly on "pooped"
    shots.append(dict(id=sid, t0=t0, first_word=wi))
for k, s in enumerate(shots):
    s["t1"] = shots[k + 1]["t0"] if k + 1 < len(shots) else END
    s["dur"] = round(s["t1"] - s["t0"], 3)

caps = []
for k, (wi, text) in enumerate(CAPS):
    t0 = round(W[wi]["s"] - 0.04, 3)
    if k + 1 < len(CAPS):
        t1 = round(W[CAPS[k + 1][0]]["s"] - 0.04, 3)
    else:
        t1 = END - 0.4
    caps.append(dict(t0=t0, t1=t1, text=text))

out = dict(duration=END, vo_duration=TL["duration"], words=W, shots=shots, captions=caps)
json.dump(out, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
for s in shots:
    print(f"{s['id']:>4} {s['t0']:6.2f}-{s['t1']:6.2f}  ({s['dur']:.2f}s)  {W[s['first_word']]['w']}")
print("total", END, "shots", len(shots))

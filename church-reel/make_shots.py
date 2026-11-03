"""Word timings (faster-whisper + fixes from the audio energy) -> shots.json with cut times and captions."""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
W = json.load(open(os.path.join(HERE, "audio", "words.json")))
# whisper was unsure about these; times measured from the voice energy
FIX = {59: (22.12, 23.12), 67: (26.0, 26.35), 68: (26.67, 26.75), 69: (26.75, 26.9)}
for i, (s, e) in FIX.items():
    W[i]["s"], W[i]["e"] = s, e
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            os.path.join(HERE, "audio", "my_voiceover.mp3")], capture_output=True, text=True).stdout)
s = lambda i, lead=0.1: round(W[i]["s"] - lead, 3)

# (shot id, start time)
SHOTS = [
    ("01", 0.0), ("02", s(3, 0.03)), ("03", s(6, 0.08)), ("04", s(8)), ("05", s(10)), ("06", s(15)),
    ("07", s(18)), ("08", s(21)), ("09", s(28)), ("10", s(29, 0.08)), ("11", s(31, 0.08)), ("12", s(32)),
    ("13", s(34)), ("14", s(37)), ("15", s(41)), ("16", s(44)), ("17", s(49)), ("18", s(54)),
    ("19", s(56)), ("20", s(59)), ("21", s(60)), ("22", s(62)), ("23", s(64)), ("24", s(68)),
    ("25", s(73, 0.25)), ("26", s(76)), ("27", s(80)), ("28", s(81, -0.25)), ("29", s(83, 0.08)), ("30", s(85)),
    ("31", s(91)), ("32", s(98)), ("33", s(102)), ("34", s(105)), ("35", s(108)), ("36", s(109)),
    ("37", s(114)), ("38", s(116, -0.2)),
]
# captions: (first word index, text, loud)
CAPS = [
    (1, "You just", 0), (3, "pooped your pants", 0), (6, "in church.", 0), (8, "Front row.", 0),
    (10, "Right in the", 0), (13, "middle of", 0), (15, "the silent prayer.", 0), (18, "And of course,", 0),
    (21, "your mom's sitting", 0), (24, "right next to you.", 0), (28, "Everyone's eyes", 0), (30, "are closed.", 0),
    (32, "For now.", 0), (34, "You don't move.", 0), (37, "You don't", 0), (39, "even breathe.", 0),
    (41, "But the smell", 0), (44, "is already", 0), (46, "on its way.", 0), (49, "The old lady", 0),
    (52, "behind you", 0), (54, "starts coughing.", 0), (56, "Some kid goes,", 0), (59, "EWWW.", 1),
    (60, "The priest", 0), (62, "stops praying.", 0), (64, "He opens", 0), (66, "one eye", 0),
    (68, "and looks", 0), (70, "straight at you.", 0), (73, "Let us pray...", 0), (76, "...for whoever", 0),
    (78, "did that.", 0), (80, "Now everyone's", 0), (82, "eyes are open", 0), (85, "and they're all", 0),
    (88, "looking at you.", 0), (91, "You look", 0), (93, "at your mom", 0), (96, "for help.", 0),
    (98, "She looks at you.", 0), (102, "Then she says", 0), (105, "it out loud.", 0), (108, "SWEETIE,", 1),
    (109, "I TOLD YOU", 1), (112, "NOT TO EAT", 1), (115, "THOSE BURRITOS.", 1),
]
shots = [dict(id=i, t0=t) for i, t in SHOTS]
for k, sh in enumerate(shots):
    sh["t1"] = shots[k + 1]["t0"] if k + 1 < len(shots) else round(DUR, 3)
    sh["dur"] = round(sh["t1"] - sh["t0"], 3)
caps = []
for k, (i, text, loud) in enumerate(CAPS):
    t0 = round(W[i]["s"] - 0.03, 3)
    if k + 1 < len(CAPS):
        nxt = CAPS[k + 1][0]
        t1 = round(min(W[nxt]["s"] - 0.03, W[nxt - 1]["e"] + 0.6), 3)
    else:
        t1 = round(DUR, 3)
    caps.append(dict(t0=t0, t1=t1, text=text, loud=loud))
json.dump(dict(duration=round(DUR, 3), words=W, shots=shots, captions=caps), open(os.path.join(HERE, "shots.json"), "w"), indent=1)
if __name__ == "__main__":
    for sh in shots:
        print(f"{sh['id']} {sh['t0']:6.2f}-{sh['t1']:6.2f} ({sh['dur']:.2f}s)  {' '.join(w['w'] for w in W if sh['t0'] <= w['s'] < sh['t1'])}")
    print("duration", DUR, "shots", len(shots))

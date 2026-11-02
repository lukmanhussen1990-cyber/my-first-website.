"""Shot plan for the mansion reel -> shots.json (times, caption chunks, what each shot shows).

Every shot starts 0.12 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps. Caption chunks are 2-4 words (1 word only for 1-word lines) and start on the first word.
Run:  python3 plan.py      (needs audio/voiceover.words.json + audio/vo_lines.json from make_voiceover.py)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
_ON = os.path.join(HERE, "audio", "word_onsets.json")   # acoustic word onsets from make_captions.py (best)
WORDS = json.load(open(_ON if os.path.exists(_ON) else os.path.join(HERE, "audio", "voiceover.words.json")))
FPS = 30
END = round(VO["duration"] * FPS) / FPS
LEAD = 0.12

# Caption chunks per voice line (exact script words)
CHUNKS = {
    1: ["You're homeless."], 2: ["You really", "need to poop."], 3: ["Every shop says", "\"customers only.\""],
    4: ["So you knock", "on the only", "door left."], 5: ["A mansion."], 6: ["The door opens."], 7: ["A rich guy."],
    8: ["In a gold bathrobe."], 9: ["You say:", "\"Toilet.", "Please.\""], 10: ["He points", "down a hallway."],
    11: ["A very long hallway."], 12: ["Made of gold."], 13: ["You run."], 14: ["The toilet has", "thirty buttons."],
    15: ["You don't know", "which one flushes."], 16: ["So you press", "them all."], 17: ["Water sprays", "the ceiling."],
    18: ["Music starts playing."], 19: ["The seat spins."], 20: ["He walks in."], 21: ["You're soaking wet."],
    22: ["He stares at you."], 23: ["Then he laughs."], 24: ["So hard", "he cries."], 25: ["And you feel", "something."],
    26: ["In your heart."], 27: ["Not your stomach", "this time."], 28: ["You've been straight", "your whole life."],
    29: ["You think."], 30: ["What you don't know:"],
    31: ["in a New York zoo,", "two male penguins", "named Roy", "and Silo"], 32: ["fell in love"],
    33: ["and raised", "a baby penguin", "together."], 34: ["He hands you", "a towel."], 35: ["Then a coffee."],
    36: ["Then a key."], 37: ["You never leave."], 38: ["He gives you", "your own bathroom."],
    39: ["With your name", "on the door."], 40: ["Welcome home."],
}

# (line, word index) where each shot's voice starts; the last shot cuts inside the pause before "Welcome home."
SHOTS = [
    ("street_sit", (1, 0)), ("tummy", (2, 0)), ("shop_door", (3, 0)), ("shop_row", (3, 3)),
    ("knock", (4, 0)), ("big_door", (4, 3)), ("mansion", (5, 0)), ("door_opens", (6, 0)), ("rich_reveal", (7, 0)),
    ("robe_tilt", (8, 0)), ("you_say", (9, 0)), ("please", (9, 3)), ("points", (10, 0)), ("long_hall", (11, 0)),
    ("gold", (12, 0)), ("run", (13, 0)), ("toilet", (14, 0)), ("which", (15, 0)), ("press", (16, 0)),
    ("spray", (17, 0)), ("music", (18, 0)), ("spin", (19, 0)), ("walks_in", (20, 0)), ("wet", (21, 0)),
    ("stare", (22, 0)), ("laugh", (23, 0)), ("cries", (24, 0)), ("feel", (25, 0)), ("heart", (26, 0)),
    ("stomach", (27, 0)), ("straight", (28, 0)), ("think", (29, 0)), ("dyk", (30, 0)), ("zoo", (31, 0)),
    ("penguins", (31, 5)), ("love", (32, 0)), ("baby", (33, 0)), ("towel", (34, 0)), ("coffee", (35, 0)),
    ("key", (36, 0)), ("never", (37, 0)), ("own_bath", (38, 0)), ("name", (39, 0)), ("welcome", (40, None)),
]
PAUSE_CUT = 0.45      # last shot starts this long after "With your name on the door." ends

norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), lines[li]["text"].split()
        assert " ".join(parts).split() == text, (li, parts, text)
        assert len(ws) == len(text), (li, len(ws), len(text))
        k = 0
        for p in parts:
            n = len(p.split())
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": p, "line": li, "t": t, "end": ws[k + n - 1]["e"]})
            k += n
    starts = []
    for name, (li, wi) in SHOTS:
        if wi is None:
            starts.append(round(lines[li - 1]["end"] + PAUSE_CUT, 2))
        else:
            t = lines[li]["start"] if wi == 0 else line_words(li)[wi]["s"]
            starts.append(max(0.0, round(t - LEAD, 2)))
    starts[0] = 0.0
    out = []
    for i, (name, _) in enumerate(SHOTS):
        t0, t1 = starts[i], (starts[i + 1] if i + 1 < len(SHOTS) else END)
        t0f, t1f = round(t0 * FPS) / FPS, round(t1 * FPS) / FPS      # cuts on frame boundaries
        caps = [c for c in chunks if t0 <= c["t"] < t1]
        out.append({"id": i + 1, "name": name, "t0": round(t0f, 4), "t1": round(t1f, 4), "dur": round(t1f - t0f, 3),
                    "voice": " ".join(c["text"] for c in caps), "captions": caps})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for o in out:
        print(f"{o['id']:2d} {o['name']:11s} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) | " + " / ".join(c["text"] for c in o["captions"]))
    durs = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, min {min(durs):.2f}, max {max(durs):.2f}")


if __name__ == "__main__":
    main()

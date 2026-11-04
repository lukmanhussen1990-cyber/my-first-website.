"""Shot plan for the salt reel -> shots.json (times, captions, what each shot shows).

Every shot starts 0.10 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps; "at" = an absolute start time for a cut inside a line. Caption chunks are 1-4 words and
start on the first word they show. Everything is made in code (scene/ = three.js), no images.
The voiceover is the user's own recording, unchanged: the video is exactly as long as it.
Run:  python3 plan.py      (needs audio/voiceover.words.json + audio/vo_lines.json from import_voiceover.py)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
WORDS = json.load(open(os.path.join(HERE, "audio", "voiceover.words.json")))
FPS = 30
END = round(VO["duration"] * FPS) / FPS
LEAD = 0.10

# Caption chunks per voice line (2-4 words, exactly the words that are said; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You've been jerking", "off the salt", "for two minutes."], 2: ["And nothing's", "coming out."], 3: ["So you", "slap its ass."],
    4: ["Nothing."], 5: ["Then all of it", "at once."], 6: ["Fuck."], 7: ["So next time,", "you poke", "every hole", "with a needle."],
    8: ["One hole", "at a time."], 9: ["Forty minutes."], 10: ["Your fries are", "fucking cold!"], 11: ["So you hook", "the shaker up", "to a leaf blower."],
    12: ["You turn it", "all the way up."], 13: ["VRRRRR!"], 14: ["BOOM!"], 15: ["All over you."], 16: ["You're a", "fucking genius!"],
}

# One entry per shot. "start" = (line, word index) where the shot's voice starts; "at" = absolute start (s).
# On screen he is ONLY shaking a salt shaker over his fries (the "jerking off" line is just a joke in the words).
SHOTS = [
    dict(start=(1, 0), size="close-up", scene="YOU furiously shakes the salt shaker over his fries, sweat drop, SHAKE SHAKE!"),
    dict(start=(1, 6), size="wide", scene="The kitchen: YOU at the wooden table shaking the shaker, the cat watching from the counter."),
    dict(start=(2, 0), size="extreme close-up", scene="The shaker holes: nothing comes out."),
    dict(start=(3, 0), size="close-up", scene="YOU turns the shaker over, raises his hand: SLAP! on the bottom of the shaker."),
    dict(start=(4, 0), size="close-up", scene="The fries: no salt."),
    dict(start=(5, 0), size="close-up", scene="The lid falls off."),
    dict(start=(5, 4), size="medium", scene="A mountain of salt dumps onto the fries."),
    dict(start=(6, 0), size="close-up", scene="YOU's angry face."),
    dict(start=(7, 0), size="medium", scene="YOU pokes the shaker holes with a needle, label HOLES."),
    dict(start=(7, 5), size="close-up", scene="The needle goes into one hole."),
    dict(start=(8, 0), size="extreme close-up (slow)", scene="Super slow: one hole at a time."),
    dict(start=(9, 0), size="close-up", scene="The wall clock spins, label 40 MIN."),
    dict(start=(10, 0), size="close-up", scene="The fries: cold, an ice cube icon."),
    dict(start=(10, 3), size="medium", scene="YOU, sad, holding a cold fry."),
    dict(start=(11, 0), size="medium", scene="YOU tapes the shaker to the leaf blower on the counter."),
    dict(start=(11, 6), size="wide", scene="The big leaf blower with the shaker taped on, YOU proud."),
    dict(start=(12, 0), size="extreme close-up", scene="The dial goes to MAX."),
    dict(start=(13, 0), size="medium", scene="The leaf blower shakes violently: VRRRRR!"),
    dict(start=(14, 0), size="wide", scene="BOOM! salt explodes everywhere, the whole kitchen turns white."),
    dict(start=(15, 0), size="medium", scene="YOU completely white like a snowman, the cat white too."),
    dict(start=(16, 0), size="close-up", scene="YOU's white face, blinking; a single fry falls. Fade out."),
]


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), lines[li]["text"].split()
        assert " ".join(parts).split() == text, (li, parts, text)
        k = 0
        for p in parts:
            n = len(p.split())
            shown = re.sub(r"[,.:;]+(?=\"?$)", "", p)
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": shown, "line": li, "who": "N", "t": t, "end": ws[k + n - 1]["e"]})
            k += n
    starts = []
    for s in SHOTS:
        if "at" in s:
            starts.append(round(s["at"], 2))
        else:
            li, wi = s["start"]
            t = lines[li]["start"] if wi == 0 else line_words(li)[wi]["s"]
            starts.append(max(0.0, round(t - LEAD, 2)))
    starts[0] = 0.0
    out = []
    for i, s in enumerate(SHOTS):
        t0, t1 = starts[i], (starts[i + 1] if i + 1 < len(SHOTS) else END)
        caps = [c for c in chunks if t0 <= c["t"] < t1]
        out.append({"id": i + 1, "t0": t0, "t1": round(t1, 2), "dur": round(t1 - t0, 2), "size": s["size"],
                    "key": False, "voice": " ".join(c["text"] for c in caps), "captions": caps, "scene": s["scene"],
                    "black": False, "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {o['size']:22s} | "
              + " / ".join(c["text"] for c in o["captions"]))
    durs = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, min {min(durs):.2f}, max {max(durs):.2f}")


if __name__ == "__main__":
    main()

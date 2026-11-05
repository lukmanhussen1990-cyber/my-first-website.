"""Shot plan for the balloon (semi genius) reel -> shots.json (times, captions, what each shot shows).

Every shot starts 0.10 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps. Caption chunks are 2-4 words, exactly the words that are said (nothing censored), and start on
the first word they show. A new shot every ~1-1.5 s. The voiceover is the user's own recording, unchanged: the video is
exactly as long as it.
Run:  python3 plan.py      (needs audio/voiceover.words.json + audio/vo_lines.json from import_voiceover.py)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))
WORDS = json.load(open(os.path.join(HERE, "audio", "voiceover.words.json")))
FPS = 30
END = round(VO["duration"] * FPS) / FPS
LEAD = 0.10

CHUNKS = {
    1: ["You've been blowing", "it for ten minutes", "and it's still soft."],
    2: ["So, you", "being a semi genius,", "give it a blow dry."],
    3: ["It gets hot."],
    4: ["It gets hard", "as fuck,", "then it melts", "a hole", "and farts in", "your fucking face."],
    5: ["So, you", "tape it up", "and keep going."],
    6: ["By the end,", "your arm is bigger", "than your fucking leg,", "and it's still", "soft as baby shit."],
    7: ["So, you grab", "a leaf blower."],
    8: ["Rock hard", "in one second."],
    9: ["Then the dumb cat", "jumps on and", "rides it around", "like he's Aladdin."],
    10: ["Fucking genius."],
}

# One entry per shot: "start" = (line, word index) where the shot's voice starts; "cut" = a camera cut inside it.
SHOTS = [
    dict(start=(1, 0), cut=(1, 0), size="medium", scene="(the user's start sound) from behind, wider; cut on the first word: closer. The cowboy stands legs wide, the kneeling guy's head at his waist, bobbing. No balloon visible."),
    dict(start=(1, 3), size="close-up", scene="The cowboy's bored face from below, the timer: 10:00."),
    dict(start=(1, 7), cut=(1, 10), size="medium", scene="Still from behind; cut on 'soft': the side view reveals a pink balloon, still soft."),
    dict(start=(2, 0), cut=(2, 2), size="medium", scene="The cowboy, annoyed, hands him a pink hairdryer."),
    dict(start=(2, 6), size="medium", scene="He blow-dries the balloon: VRRRR."),
    dict(start=(3, 0), size="close-up", scene="It gets hot: the balloon glows red, steam."),
    dict(start=(4, 0), cut=(4, 3), size="medium", scene="It gets hard: the balloon swells big and tight. BOING!"),
    dict(start=(4, 5), size="close-up", scene="It melts a hole, smoke."),
    dict(start=(4, 10), cut=(4, 13), size="close-up", scene="PFFFFFT! The air blasts in his face, the beanie flies off."),
    dict(start=(5, 0), size="close-up", scene="Taping the hole: RIIIP."),
    dict(start=(5, 5), size="medium", scene="He keeps going, exhausted; the timer: 3:47:00."),
    dict(start=(6, 0), size="medium", scene="He pumps with one arm, fast, sweating."),
    dict(start=(6, 3), cut=(6, 7), size="medium", scene="His pumping arm is huge: labels ARM and LEG."),
    dict(start=(6, 11), cut=(6, 14), size="medium", scene="The balloon is still limp and droopy. SQUISH."),
    dict(start=(7, 0), cut=(7, 3), size="medium", scene="He grabs a big orange leaf blower and revs it."),
    dict(start=(8, 0), cut=(8, 2), size="wide", scene="Rock hard in one second: the balloon fills the room. BOOM. 0:01."),
    dict(start=(9, 0), cut=(9, 4), size="wide", scene="The dumb cat jumps on top of the giant balloon."),
    dict(start=(9, 7), size="wide", scene="The cat rides the balloon around the room, things fly."),
    dict(start=(9, 10), size="wide", scene="Like Aladdin: the cat rides the balloon over the night city, sparkles."),
    dict(start=(10, 0), size="medium", scene="Fucking genius: both proud, the cat flies past the window."),
]


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), [w["w"] for w in line_words(li)]
        assert " ".join(parts).split() == text, (li, parts, text)
        k = 0
        for p in parts:
            n = len(p.split())
            t = lines[li]["start"] if k == 0 else ws[k]["s"]
            chunks.append({"text": p, "line": li, "who": "N", "t": t, "end": ws[k + n - 1]["e"]})
            k += n
    starts = []
    for s in SHOTS:
        li, wi = s["start"]
        t = lines[li]["start"] if wi == 0 else line_words(li)[wi]["s"]
        starts.append(max(0.0, round(t - LEAD, 2)))
    starts[0] = 0.0
    out = []
    for i, s in enumerate(SHOTS):
        t0, t1 = starts[i], (starts[i + 1] if i + 1 < len(SHOTS) else END)
        caps = [c for c in chunks if t0 <= c["t"] < t1]
        cuts = []
        if "cut" in s:
            cl, cw = s["cut"]
            cuts.append(round(line_words(cl)[cw]["s"] - LEAD - t0, 3))
        out.append({"id": i + 1, "t0": t0, "t1": round(t1, 2), "dur": round(t1 - t0, 2), "size": s["size"], "cuts": cuts,
                    "key": False, "voice": " ".join(c["text"] for c in caps), "captions": caps, "scene": s["scene"],
                    "black": False, "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {o['size']:12s} | "
              + " / ".join(c["text"] for c in o["captions"]))
    durs = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, min {min(durs):.2f}, max {max(durs):.2f}")


if __name__ == "__main__":
    main()

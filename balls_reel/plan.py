"""Shot plan for the "what if your balls doubled" reel -> shots.json (times, captions, what each shot shows).

Every shot starts 0.10 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps. Caption chunks are 2-4 words, lowercase like the reference, exactly the words that are said,
and start on the first word they show. A new shot every ~1-1.5 s, the camera further back as things get bigger.
The voiceover is the user's own recording, unchanged: the video is exactly as long as it.
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
    1: ["what if", "your balls", "doubled in size", "every minute?"],
    2: ["right now,", "the pair weighs", "about forty grams."],
    3: ["five minutes in:", "they're the size", "of melons."],
    4: ["ten minutes:", "forty kilos.", "like a bag", "of cement."],
    5: ["you try to", "stand up.", "you can't."],
    6: ["fifteen minutes:", "as heavy as", "a small car."],
    7: ["twenty minutes:", "the army arrives."],
    8: ["they try to", "move them."],
    9: ["damage: zero percent."],
    10: ["thirty minutes:", "taller than an", "eleven-story building."],
    11: ["the world panics."],
    12: ["your mom is", "stuck in traffic", "because of you."],
    13: ["one hour:", "heavier than", "every mountain", "on earth."],
    14: ["eighty-seven minutes:", "heavier than", "the earth itself."],
    15: ["now the earth", "orbits you."],
    16: ["two hours:", "gravity wins."],
    17: ["you become", "a black hole."],
    18: ["which is why…"],
    19: ["…you should", "never ask", "'what if'."],
}

# One entry per shot: "start" = (line, word index) where the shot's voice starts.
SHOTS = [
    dict(start=(1, 0), size="close-up", scene="HIM on the street, calm, holding his phone."),
    dict(start=(1, 4), size="wide", scene="HIM standing on the street next to FRIEND; she looks down."),
    dict(start=(2, 0), size="close-up", scene="Two small round shapes drop onto a kitchen scale: BEEP, the screen counts up."),
    dict(start=(2, 5), size="extreme close-up", scene="The scale screen: 40 g (green numbers)."),
    dict(start=(3, 0), size="close-up", scene="FRIEND, shocked, looking down."),
    dict(start=(3, 3), size="medium", scene="HIM walking funny, two round bulges in his jeans. Label: MELON SIZE."),
    dict(start=(4, 0), size="medium", scene="HIM steps onto a big platform scale, the sign counts up to 41 kg."),
    dict(start=(4, 4), size="wide", scene="HIM on the big scale next to a cement bag, the sign shows 41 kg."),
    dict(start=(5, 0), size="medium", scene="He tries to stand up straight, straining, worried."),
    dict(start=(5, 5), size="medium", scene="He falls forward onto them: the floor cracks."),
    dict(start=(6, 0), size="medium", scene="HIM sitting on top of two giant tan spheres."),
    dict(start=(6, 2), size="wide", scene="Next to a small car. Label: 1.3 TONS."),
    dict(start=(7, 0), size="wide", scene="Tanks roll in around the giant spheres."),
    dict(start=(7, 2), size="wide", scene="Soldiers run in and surround the spheres."),
    dict(start=(8, 0), size="wide", scene="Tanks pull with chains, treads spinning, dust: nothing moves."),
    dict(start=(9, 0), size="close-up", scene="The sphere, not a scratch. Label: DAMAGE: 0%."),
    dict(start=(10, 0), size="wide", scene="The spheres next to a tall building."),
    dict(start=(10, 2), size="extreme wide", scene="Further back: HIM a tiny dot on top. Label: HIM."),
    dict(start=(11, 0), size="news", scene="NEWS ANCHOR on TV: BALL-POCALYPSE headline, red LIVE tag, ticker EVACUATE NOW."),
    dict(start=(12, 0), size="extreme wide", scene="A huge traffic jam on a highway leading to the two giant spheres."),
    dict(start=(12, 5), size="wide", scene="Closer: one car honking in the jam. Label: MOM."),
    dict(start=(13, 0), size="extreme wide", scene="The spheres sitting on a crushed mountain range."),
    dict(start=(13, 2), size="extreme wide", scene="Further back: mountains crushed under them."),
    dict(start=(14, 0), size="wide", scene="A giant balance scale: 8 BILLION PEOPLE on one side, the spheres on the other."),
    dict(start=(14, 2), size="wide", scene="The spheres' side slams down: they win."),
    dict(start=(15, 0), size="space", scene="Space: the Earth circling the spheres. Labels: EARTH, HIM (SOMEWHERE)."),
    dict(start=(16, 0), size="space", scene="Gravity wins: the spheres pull everything in."),
    dict(start=(17, 0), size="space", scene="They collapse: a bright white flash."),
    dict(start=(17, 2), size="space", scene="A black hole swirling in space."),
    dict(start=(18, 0), size="wide", scene="A quiet empty street."),
    dict(start=(19, 0), size="close-up", scene="HIM back on the street, normal size, holding his phone, staring at the camera. End."),
]


def line_words(li):
    return [w for w in WORDS if w["line"] == li]


def main():
    lines = {l["i"]: l for l in VO["lines"]}
    chunks = []
    for li, parts in CHUNKS.items():
        ws, text = line_words(li), [w["w"] for w in line_words(li)]
        assert " ".join(parts).lower().split() == [t.lower() for t in text], (li, parts, text)
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
        out.append({"id": i + 1, "t0": t0, "t1": round(t1, 2), "dur": round(t1 - t0, 2), "size": s["size"],
                    "key": False, "voice": " ".join(c["text"] for c in caps), "captions": caps, "scene": s["scene"],
                    "black": False, "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
    assert sum(len(o["captions"]) for o in out) == len(chunks)
    json.dump({"fps": FPS, "duration": END, "shots": out}, open(os.path.join(HERE, "shots.json"), "w"), indent=1)
    for o in out:
        print(f"{o['id']:2d} {o['t0']:6.2f}-{o['t1']:6.2f} ({o['dur']:.2f}s) {o['size']:16s} | "
              + " / ".join(c["text"] for c in o["captions"]))
    durs = [o["dur"] for o in out]
    print(f"{len(out)} shots, {END:.2f}s, mean {END / len(out):.2f}s, min {min(durs):.2f}, max {max(durs):.2f}")


if __name__ == "__main__":
    main()

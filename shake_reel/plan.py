"""Shot plan for the bed-shake (semi genius) reel -> shots.json (times, captions, what each shot shows).

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
    1: ["Your bed shakes", "so fucking loud,", "the neighbors", "run outside", "in their pajamas."],
    2: ["Every single time."],
    3: ["So you,", "being a semi genius,", "nail the bed", "to the floor."],
    4: ["Now the whole", "floor shakes."],
    5: ["The chandelier", "downstairs", "does the macarena."],
    6: ["So you bolt", "the floor", "to the building."],
    7: ["Now the whole", "fucking building", "shakes."],
    8: ["The news calls it", "an earthquake."],
    9: ["So you move", "the bed", "to the basement."],
    10: ["Now the subway", "stops running."],
    11: ["Wait."],
    12: ["Your bed", "is just a drum."],
    13: ["So you", "find the beat."],
    14: ["Now the neighbors", "don't run outside."],
    15: ["And they dance."],
    16: ["Every single time."],
    17: ["Fucking genius."],
}

# One entry per shot: "start" = (line, word index) where the shot's voice starts; "cut" = a camera cut inside it.
SHOTS = [
    dict(start=(1, 0), cut=(1, 0), size="close-up", scene="(intro clip) the bedroom, the bed rocking; cut on the first word: the couple in bed, close, like the reference. SHAKE."),
    dict(start=(1, 3), size="cutaway", scene="The cutaway: the bedroom upstairs, the neighbors' room downstairs, the lamp shaking."),
    dict(start=(1, 6), size="medium", scene="The old neighbors jump off the sofa and run out the door."),
    dict(start=(1, 9), size="wide", scene="Outside at night: the old couple on the sidewalk in their pajamas."),
    dict(start=(2, 0), size="medium", scene="Their annoyed faces, a tally: x 247."),
    dict(start=(3, 0), cut=(3, 2), size="medium", scene="HIM next to the bed with a hammer; cut closer: chin up, proud."),
    dict(start=(3, 6), size="close-up", scene="BANG BANG: nails through the bed legs into the floor."),
    dict(start=(4, 0), size="cutaway", scene="The whole bedroom floor shakes with the bed, dust falls downstairs."),
    dict(start=(5, 0), size="medium", scene="The chandelier downstairs starts swinging."),
    dict(start=(5, 3), size="medium", scene="It does the macarena; the neighbors stare. Music notes."),
    dict(start=(6, 0), size="close-up", scene="A giant wrench turns huge bolts into the floor: CLANK."),
    dict(start=(6, 3), size="cutaway", scene="Giant bolts through the whole building."),
    dict(start=(7, 0), cut=(7, 3), size="wide", scene="Outside: the whole building shakes; cut closer: windows rattle, bricks fall."),
    dict(start=(8, 0), size="news", scene="The news: EARTHQUAKE, LIVE, a seismograph going wild."),
    dict(start=(9, 0), size="medium", scene="He drags the bed down the stairs."),
    dict(start=(9, 4), size="medium", scene="The bed in the dark basement, the couple back in it."),
    dict(start=(10, 0), size="wide", scene="The subway train in the tunnel next door."),
    dict(start=(10, 3), size="wide", scene="It screeches to a stop, everyone falls over: SERVICE SUSPENDED."),
    dict(start=(11, 0), size="close-up", scene="Wait: he freezes, a light bulb pops on over his head."),
    dict(start=(12, 0), size="medium", scene="The bed is just a drum: he taps it, BOOM."),
    dict(start=(13, 0), size="medium", scene="He drums on the bed, finding the beat (BPM meter)."),
    dict(start=(14, 0), size="medium", scene="The neighbors in pajamas stay home on the sofa."),
    dict(start=(15, 0), size="medium", scene="They dance! Disco lights, music notes."),
    dict(start=(16, 0), size="cutaway", scene="Every floor of the building dancing."),
    dict(start=(17, 0), size="medium", scene="Fucking genius: him in bed, arms behind his head, proud."),
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

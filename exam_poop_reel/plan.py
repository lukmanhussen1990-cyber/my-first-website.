"""Shot plan for the exam reel -> shots.json (times, captions, what each shot shows).

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
    1: ["It's your", "final exam."], 2: ["You can't", "hold it anymore."], 3: ["And the teacher said", "no toilet breaks."],
    4: ["So you poop."], 5: ["Right there."], 6: ["At your desk."], 7: ["Into toilet paper."], 8: ["Nobody saw."], 9: ["You think."],
    10: ["You wrap it up."], 11: ["Tight."], 12: ["Like a little present."], 13: ["You hide it", "in your pencil box."], 14: ["Perfect."],
    15: ["Then the teacher", "stands up."], 16: ["Everyone,", "open your", "pencil boxes."], 17: ["I'm checking", "for cheat chits."],
    18: ["She walks", "down the row."], 19: ["Box by box."], 20: ["Getting closer."], 21: ["What you don't know:"],
    22: ["The first pencils", "were made", "in England", "in the 1500s,", "after people found", "a giant lump", "of graphite", "in the ground."],
    23: ["Your pencil box", "has a giant", "lump too."], 24: ["She reaches", "your desk."], 25: ["She opens it."], 26: ["She stares."],
    27: ["She closes it."], 28: ["She walks away."], 29: ["She never checks", "pencil boxes again."],
}

# One entry per shot. "start" = (line, word index) where the shot's voice starts; "at" = absolute start (s).
SHOTS = [
    dict(start=(1, 0), size="wide", scene="A quiet exam hall: rows of wooden desks, ceiling fans, a big wall clock, students writing."),
    dict(start=(2, 0), size="close-up", scene="YOU's face, sweating."),
    dict(start=(2, 2), size="close-up (under the desk)", scene="His leg shaking under the desk: RRRUMBLE."),
    dict(start=(3, 0), size="medium (flashback)", scene="Flashback: the strict teacher at the front points at the sign."),
    dict(start=(3, 4), size="close-up (flashback)", scene="The sign: a toilet icon with a red cross."),
    dict(start=(4, 0), size="medium (from behind)", scene="He half-stands behind his desk, trousers down: a BIG pixel mosaic over his butt; he looks left and right."),
    dict(start=(5, 0), size="medium (side)", scene="From the side (mosaic): he looks left and right nervously."),
    dict(start=(6, 0), size="wide (from behind)", scene="The class keeps writing, nobody looks up; him half-squatting at his desk (mosaic)."),
    dict(start=(7, 0), size="close-up (low, side)", scene="The toilet paper on his chair; a small brown blob drops from under the mosaic (its own mosaic): PLOP."),
    dict(start=(8, 0), size="wide (slow pan)", scene="Slow pan across the class: everyone writing. He sits, fully dressed again."),
    dict(start=(9, 0), size="medium", scene="One guy in the back row slowly turns his head."),
    dict(start=(10, 0), size="close-up", scene="His hands wrap the bundle in toilet paper, layer after layer: CRINKLE."),
    dict(start=(11, 0), size="close-up", scene="Tight."),
    dict(start=(12, 0), size="close-up", scene="He ties it like a tiny gift, a little bow."),
    dict(start=(13, 0), size="close-up", scene="He opens his pencil box and pushes the pencils aside."),
    dict(start=(13, 4), size="close-up", scene="He stuffs the bundle in: CLICK, shut."),
    dict(start=(14, 0), size="close-up", scene="Perfect: a tiny proud nod."),
    dict(start=(15, 0), size="low angle", scene="The teacher rises slowly from her chair."),
    dict(start=(15, 3), size="close-up", scene="Her glasses glint: dramatic sting."),
    dict(start=(16, 0), size="medium", scene="\"Everyone,\""),
    dict(start=(16, 1), size="wide", scene="Every student opens their pencil box at once."),
    dict(start=(17, 0), size="medium", scene="\"I'm checking for cheat chits.\" Clipboard, glasses."),
    dict(start=(18, 0), size="low angle", scene="Her heels STOMP down the row."),
    dict(start=(19, 0), size="medium", scene="She checks a box."),
    dict(start=(19, 2), size="close-up", scene="His face sweating more."),
    dict(start=(20, 0), size="medium", scene="His pencil box, faint stink lines; she comes closer behind."),
    dict(start=(21, 0), size="close-up (slow push)", scene="What you don't know: a slow push on his pencil box."),
    dict(start=(22, 0), size="wide (old film)", scene="Old England, sepia: miners walk up a green hill."),
    dict(start=(22, 5), size="medium (old film)", scene="They dig with pickaxes."),
    dict(start=(22, 7), size="close-up (old film)", scene="A miner swings his pickaxe, sweat flying."),
    dict(start=(22, 10), size="close-up (old film)", scene="A pickaxe hits something hard: light bursts out."),
    dict(start=(22, 13), size="medium (old film)", scene="A giant glowing lump of graphite; the miners gasp."),
    dict(start=(22, 18), size="wide (old film)", scene="The hill with the glowing pit."),
    dict(start=(23, 0), size="close-up", scene="Back in the hall: a small green glow comes out of his pencil box."),
    dict(start=(23, 3), size="close-up", scene="His deadpan face, lit green."),
    dict(start=(24, 0), size="low angle", scene="She stops right next to him: a huge shadow over his desk."),
    dict(start=(25, 0), size="close-up", scene="CREAK: her face as she lifts the lid, green glow on her face (mosaic over the inside of the box)."),
    dict(start=(26, 0), size="extreme close-up", scene="Her eyes: one eye twitches."),
    dict(start=(27, 0), size="close-up", scene="SNAP: she closes it."),
    dict(start=(28, 0), size="wide", scene="She turns and walks back to the front, very calm and stiff, not looking back."),
    dict(start=(29, 0), size="wide (days later)", scene="Days later: she walks past students' pencil boxes, avoiding them."),
    dict(start=(29, 3), size="top", scene="She takes the long way round his desk."),
    dict(at=53.62, size="wide (ending)", scene="Outside: the school at sunset, green stink lines rising out of one window, slow zoom out."),
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

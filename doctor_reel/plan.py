"""Shot plan for the doctor reel -> shots.json (times, captions, what each shot shows).

Every shot starts 0.10 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps; "at" = an absolute start time for a cut inside a line. Caption chunks are 1-3 words and
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

# Caption chunks per voice line (2-3 words, exact words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["You're staying", "at your", "friend's house."], 2: ["And you", "haven't pooped", "in five days."],
    3: ["Your stomach", "is a balloon."], 4: ["Your friend's mom", "thinks you're", "pregnant."], 5: ["You go", "to the doctor."],
    6: ["He presses", "your stomach."], 7: ["Hmm."], 8: ["Very serious."], 9: ["He gives you", "the strongest", "medicine."],
    10: ["Take one."], 11: ["ONLY ONE."], 12: ["You take three."], 13: ["You sit", "in the", "waiting room."],
    14: ["Nothing."], 15: ["One minute."], 16: ["Nothing."], 17: ["Then…"], 18: ["Your stomach", "starts talking."],
    19: ["LOUD."], 20: ["Everyone in", "the waiting room", "looks at you."], 21: ["You run", "to the toilet."],
    22: ["There's a line."], 23: ["Ten people."], 24: ["You can't wait!"], 25: ["PLEASE!", "IT'S AN", "EMERGENCY!"],
    26: ["The door opens."], 27: ["It's the doctor."], 28: ["Then…"], 29: ["It happens."], 30: ["Right there."],
    31: ["On the", "doctor's new shoes."], 32: ["Silence."], 33: ["The waiting room", "is empty", "in three seconds."],
    34: ["Well…"], 35: ["The medicine works!"], 36: ["Then he writes", "your bill."], 37: ["Treatment:"], 38: ["$50."],
    39: ["New shoes:"], 40: ["$500."],
}

# One entry per shot. "start" = (line, word index) where the shot's voice starts; "at" = absolute start (s).
SHOTS = [
    dict(start=(1, 0), size="wide", scene="The friend's cosy living room: YOU sits on the sofa, huge belly, sweaty."),
    dict(start=(2, 0), size="medium", scene="The wall calendar: red X marks appear on the days, one after another."),
    dict(start=(2, 4), size="extreme close-up", scene="The calendar: the fifth big red X."),
    dict(start=(3, 0), size="medium (side)", scene="YOU stands up: a HUGE round belly like a balloon, the t-shirt too small."),
    dict(start=(3, 3), size="extreme close-up", scene="Slow zoom on the belly; it wobbles."),
    dict(start=(4, 0), size="medium", scene="The friend's mom walks in from the kitchen, apron, oven mitt."),
    dict(start=(4, 4), size="close-up", scene="The mom gasps, hand on her cheek, and touches the belly."),
    dict(start=(5, 0), size="wide", scene="YOU waddles into the clinic (red cross, sliding glass doors)."),
    dict(start=(6, 0), size="medium close-up", scene="The doctor presses the belly; it dents and bounces back like a balloon."),
    dict(start=(7, 0), size="close-up", scene="The doctor: \"Hmm.\" Hand on his chin."),
    dict(start=(8, 0), size="extreme close-up", scene="The doctor's serious face, his glasses shine."),
    dict(start=(9, 0), size="medium", scene="The doctor takes a bottle from the medicine shelf."),
    dict(start=(9, 4), size="close-up", scene="The glowing medicine bottle with a skull sticker, sparkles."),
    dict(start=(10, 0), size="close-up", scene="The doctor holds up one finger."),
    dict(start=(11, 0), size="extreme close-up", scene="ONLY ONE: the finger, his stern face."),
    dict(start=(12, 0), size="medium", scene="YOU throws three pills in his mouth while the doctor writes and doesn't see."),
    dict(start=(13, 0), size="wide", scene="The waiting room: YOU between an old man with a stick, a lady with a magazine and a kid "
         "with his arm in a cast; the receptionist, a TV, a plant, the toilet door with a red OCCUPIED sign."),
    dict(start=(14, 0), size="close-up", scene="Nothing. YOU smiles."),
    dict(start=(15, 0), size="close-up", scene="The wall clock ticks."),
    dict(start=(16, 0), size="close-up", scene="Nothing. YOU smiles, thumbs up."),
    dict(start=(17, 0), size="extreme close-up", scene="Then... his smile freezes."),
    dict(start=(18, 0), size="extreme close-up", scene="The belly shakes and rumbles, motion lines."),
    dict(start=(18, 2), size="medium", scene="YOU holds his belly, sweating."),
    dict(start=(19, 0), size="medium", scene="LOUD: the belly rumbles, screen shake."),
    dict(start=(20, 0), size="close-up", scene="Reaction: the old man."),
    dict(start=(20, 2), size="close-up", scene="Reaction: the lady lowers her magazine."),
    dict(start=(20, 5), size="close-up", scene="Reaction: the kid with the cast."),
    dict(start=(20, 7), size="close-up", scene="Reaction: the receptionist."),
    dict(start=(21, 0), size="medium", scene="YOU runs to the toilet with tiny steps, holding his belly."),
    dict(start=(22, 0), size="wide", scene="A long line in front of the OCCUPIED toilet door."),
    dict(start=(23, 0), size="medium (pan)", scene="Ten people in the line."),
    dict(start=(24, 0), size="close-up", scene="YOU can't wait: giant sweat drops."),
    dict(start=(25, 0), size="medium", scene="PLEASE! YOU bangs on the toilet door."),
    dict(start=(25, 1), size="close-up", scene="The fists bang, the OCCUPIED sign shakes."),
    dict(start=(26, 0), size="medium", scene="The door opens slowly."),
    dict(start=(27, 0), size="low angle", scene="It's the doctor, standing in the doorway."),
    dict(start=(28, 0), size="extreme close-up", scene="Then... YOU's eyes."),
    dict(start=(29, 0), size="medium", scene="It happens: freeze frame, a giant green stink cloud, screen shake."),
    dict(start=(30, 0), size="wide", scene="Right there: the cloud spreads over the line, everyone's faces."),
    dict(start=(31, 0), size="tilt down", scene="Slow tilt down the doctor to his new shoes: they are not shiny any more."),
    dict(start=(32, 0), size="wide", scene="Silence. Everyone frozen, green stink lines."),
    dict(start=(33, 0), size="wide", scene="Everyone runs out super fast: chairs spinning, the magazine flying."),
    dict(start=(33, 4), size="wide", scene="The empty waiting room, a chair still spinning, the magazine floating down."),
    dict(start=(34, 0), size="close-up", scene="Well... the doctor stands still, blank face."),
    dict(start=(35, 0), size="medium", scene="The medicine works: the doctor, blank, stink lines from his shoes."),
    dict(start=(36, 0), size="close-up", scene="The doctor writes the bill."),
    dict(start=(37, 0), size="extreme close-up", scene="The bill: Treatment $50."),
    dict(start=(39, 0), size="medium", scene="New shoes $500 in big red numbers; YOU, belly now small and flat, smiling. Fade out."),
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

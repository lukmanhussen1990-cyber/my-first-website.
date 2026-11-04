"""Shot plan for the ghost-girlfriend reel -> shots.json (times, captions, what each shot shows).

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
    1: ["You and your friends", "are driving home", "at 2 AM."], 2: ["Music loud as fuck."], 3: ["Everyone's singing."],
    4: ["Then the car", "just fucking dies."], 5: ["The headlights flicker."], 6: ["And there's a ghost."],
    7: ["Right in front", "of the fucking car."], 8: ["Your friends scream", "like little bitches."],
    9: ["Everyone gets the fuck", "out of the car."], 10: ["You grab", "a tire iron."], 11: ["You're gonna", "hit this bitch."],
    12: ["You swing…"], 13: ["And then you", "see her face."], 14: ["Oh fuck."], 15: ["Your heart goes", "BA-DUM."],
    16: ["Your friends just stare."], 17: ["Week one."], 18: ["First date", "in a graveyard."], 19: ["She floats."],
    20: ["You don't", "give a fuck."], 21: ["Month one."], 22: ["Candlelight dinner."], 23: ["She can't eat."],
    24: ["You eat", "for both of you."], 25: ["Your friends", "are still", "fucking staring."], 26: ["Month six."],
    27: ["You try to", "hold her hand."], 28: ["It goes", "right through."], 29: ["One year."], 30: ["She proposes."],
    31: ["The ring keeps", "falling through", "your finger."], 32: ["You say yes", "anyway."], 33: ["Wedding day."],
    34: ["At 3 AM."], 35: ["In a haunted", "ass castle."], 36: ["The priest faints."], 37: ["And your friends?"],
    38: ["Still standing", "on that same", "fucking road."], 39: ["Staring."],
}

# One entry per shot: "start" = (line, word index) where the shot's voice starts; "cut" = a camera cut inside it.
SHOTS = [
    dict(start=(1, 0), size="wide", scene="2 AM: a convertible drives down a dark country road, headlights on, a big moon."),
    dict(start=(1, 4), size="medium", scene="Front view of the car: YOU driving, three friends."),
    dict(start=(2, 0), size="close-up", scene="Music loud: the car bounces, music notes fly out, the friends bob their heads."),
    dict(start=(3, 0), size="medium", scene="Everyone singing, eyes closed, mouths wide open."),
    dict(start=(4, 0), size="medium", scene="The engine sputters: smoke from the hood, the car jerks."),
    dict(start=(4, 3), size="wide", scene="The car rolls to a stop in the dark. Silence."),
    dict(start=(5, 0), size="close-up", scene="The headlights flicker."),
    dict(start=(6, 0), size="pov", scene="Through the windshield: a ghost floating in the headlight beams, hair over her face."),
    dict(start=(7, 0), cut=(7, 3), size="wide (low)", scene="The ghost right in front of the car's hood; cut closer on her."),
    dict(start=(8, 0), cut=(8, 3), size="medium", scene="The friends scream, hands on their faces; cut closer."),
    dict(start=(9, 0), size="wide", scene="Everyone jumps out of the car and runs behind it."),
    dict(start=(10, 0), size="close-up", scene="His hand grabs a tire iron from the trunk."),
    dict(start=(11, 0), size="medium", scene="He walks at the ghost, tire iron raised, angry."),
    dict(start=(12, 0), size="low angle", scene="He swings (slow motion)."),
    dict(start=(13, 0), size="close-up", scene="Her hair parts: a beautiful glowing face, long lashes, sparkles."),
    dict(start=(14, 0), size="close-up", scene="His face: eyes wide; the tire iron drops (clank)."),
    dict(start=(15, 0), size="close-up", scene="His eyes turn into hearts."),
    dict(start=(15, 3), size="close-up", scene="BA-DUM: a big heart pulses on his chest."),
    dict(start=(16, 0), size="medium", scene="The friends behind the car, just staring."),
    dict(start=(17, 0), size="wide", scene="WEEK 1: a graveyard at night, tombstones, fog, the moon."),
    dict(start=(18, 0), size="medium", scene="First date: they walk between the tombstones, he holds a flower."),
    dict(start=(19, 0), size="medium", scene="She floats up and twirls."),
    dict(start=(20, 0), size="medium", scene="He smiles and shrugs, heart eyes."),
    dict(start=(21, 0), size="close-up", scene="MONTH 1: candles on a table."),
    dict(start=(22, 0), size="medium", scene="Candlelight dinner: the two of them at a table."),
    dict(start=(23, 0), size="medium", scene="She can't eat: the spaghetti falls right through her."),
    dict(start=(24, 0), size="medium", scene="He eats from both plates, cheeks full."),
    dict(start=(25, 0), cut=(25, 2), size="medium", scene="The friends, still on the road, still staring; cut closer."),
    dict(start=(26, 0), size="wide", scene="MONTH 6: a park bench under a street lamp at night."),
    dict(start=(27, 0), size="close-up", scene="His hand reaches for hers."),
    dict(start=(28, 0), size="close-up", scene="It goes right through her hand."),
    dict(start=(29, 0), size="wide", scene="1 YEAR: a hill over the city lights with fairy lights."),
    dict(start=(30, 0), size="medium", scene="She proposes: floats down on one knee, a glowing ring."),
    dict(start=(31, 0), size="close-up", scene="The ring falls through his finger."),
    dict(start=(31, 3), size="close-up", scene="Again: the ring keeps falling, clink."),
    dict(start=(32, 0), size="medium", scene="He says yes anyway: happy, sparkles."),
    dict(start=(33, 0), size="wide", scene="WEDDING DAY: a haunted castle, bats, the moon."),
    dict(start=(34, 0), size="close-up", scene="The castle clock: 3 AM."),
    dict(start=(35, 0), size="wide", scene="Inside the haunted castle: candles, cobwebs, the altar, the priest."),
    dict(start=(36, 0), size="medium", scene="The priest sees the bride and faints."),
    dict(start=(37, 0), size="medium", scene="Three empty chairs with cobwebs."),
    dict(start=(38, 0), cut=(38, 2), size="wide", scene="The same road: the friends still standing, covered in cobwebs, the car rusty; cut wider."),
    dict(start=(39, 0), size="close-up", scene="Their faces, still staring. End."),
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

"""Shot plan for the mansion reel -> shots.json (times, captions, what each shot shows).

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
    1: ["You're homeless."], 2: ["And you need", "to poop."], 3: ["Bad."], 4: ["The park toilet", "is closed."],
    5: ["The café says", "customers only."], 6: ["Then you see", "a mansion."], 7: ["You knock."], 8: ["The butler opens."],
    9: ["He looks at you."], 10: ["He closes", "the door."], 11: ["You knock again."], 12: ["This time,", "the owner opens."],
    13: ["Please.", "I need to poop."], 14: ["He looks at you."], 15: ["Then he smiles."], 16: ["Bathroom's upstairs."],
    17: ["You're so happy,", "you kiss him."], 18: ["Then you run."], 19: ["Golden toilet."], 20: ["You poop."],
    21: ["The chandelier", "shakes."], 22: ["You come", "downstairs."], 23: ["He's still smiling."], 24: ["Day two."],
    25: ["He invites you", "for dinner."], 26: ["Day thirty."], 27: ["You use", "his bathroom", "every day."], 28: ["Day sixty."],
    29: ["You fall asleep", "on his couch."], 30: ["You wake up", "cuddling him."], 31: ["Neither of you", "moves."],
    32: ["Day one hundred."], 33: ["You move in."], 34: ["Day two hundred."], 35: ["A trip to Paris."], 36: ["You:"],
    37: ["I love you."], 38: ["I love you more."], 39: ["Day three hundred", "sixty-five."], 40: ["He gets down", "on one knee."],
    41: ["The ring is made", "of toilet paper."], 42: ["With a diamond", "on top."], 43: ["You say yes."], 44: ["The wedding."],
    45: ["Five years later."], 46: ["Two kids."], 47: ["One golden toilet."], 48: ["And every night,", "you cuddle", "on the same couch."],
    49: ["You still love him."], 50: ["He still loves you."], 51: ["And it all started…"], 52: ["With one poop."],
}

# One entry per shot. "start" = (line, word index) where the shot's voice starts; "at" = absolute start (s).
SHOTS = [
    dict(start=(1, 0), size="wide (night)", scene="Night city park: YOU (beard, old beanie, torn jacket) alone on a park bench under a street lamp."),
    dict(start=(2, 0), size="medium", scene="YOU grabs his stomach: it rumbles (RUMBLE!), screen shake, sweat."),
    dict(start=(3, 0), size="extreme close-up", scene="\"Bad.\" YOU's sweaty face, label EMERGENCY, shake."),
    dict(start=(4, 0), size="wide", scene="YOU runs to the little park toilet building."),
    dict(start=(4, 3), size="close-up", scene="The door: a red CLOSED sign and a chain; YOU pulls the handle."),
    dict(start=(5, 0), size="medium", scene="The café at night (striped awning, warm window): the café owner stands in the door."),
    dict(start=(5, 3), size="close-up", scene="The café owner shakes his head, finger wag; CUSTOMERS ONLY sign."),
    dict(start=(6, 0), size="close-up", scene="YOU turns and looks up, eyes wide."),
    dict(start=(6, 3), size="wide (low angle)", scene="Slow pan up the giant mansion: golden gate, fountain, sparkles."),
    dict(start=(7, 0), size="medium", scene="YOU knocks on the huge front door: KNOCK KNOCK!"),
    dict(start=(8, 0), size="medium", scene="The door opens: the BUTLER (tuxedo, very serious)."),
    dict(start=(9, 0), size="close-up", scene="The butler looks down at YOU, one eyebrow."),
    dict(start=(10, 0), size="medium", scene="The butler closes the door in YOU's face: SLAM!"),
    dict(start=(11, 0), size="close-up", scene="YOU knocks again, harder: big KNOCK KNOCK!, shake."),
    dict(start=(12, 0), size="medium", scene="The door opens again, warm light pours out."),
    dict(start=(12, 2), size="low angle", scene="The OWNER in his silk robe, light glowing behind him."),
    dict(start=(13, 0), size="medium", scene="\"Please.\" YOU drops to his knees."),
    dict(start=(13, 2), size="close-up", scene="YOU on his knees, hands together, sweating."),
    dict(start=(14, 0), size="close-up (high)", scene="The OWNER looks down at him."),
    dict(start=(15, 0), size="close-up (slow zoom)", scene="Slow zoom on the OWNER's face: he smiles."),
    dict(start=(16, 0), size="medium", scene="Inside the marble hall: the OWNER points up."),
    dict(at=25.65, size="wide", scene="The golden stairs, glowing."),
    dict(start=(17, 0), size="close-up", scene="YOU is so happy: huge grin, arms up."),
    dict(start=(17, 4), size="medium two-shot", scene="MWAH! YOU kisses the OWNER on the cheek."),
    dict(start=(18, 0), size="close-up", scene="The OWNER's eyes POP into big red pixel hearts, BA-DUM!, pink hearts float."),
    dict(start=(18, 2), size="wide", scene="YOU sprints up the golden stairs, motion lines."),
    dict(start=(19, 0), size="medium", scene="The shiny GOLDEN toilet glowing, sparkles, a big chandelier."),
    dict(start=(20, 0), size="medium", scene="The camera cuts away to the closed bathroom door: PLOP!"),
    dict(start=(21, 0), size="close-up", scene="The big chandelier in the hall shakes."),
    dict(start=(21, 2), size="wide", scene="The hall: the chandelier swinging; the butler looks up."),
    dict(start=(22, 0), size="wide", scene="YOU comes down the golden stairs, relieved."),
    dict(start=(23, 0), size="medium", scene="The OWNER at the bottom of the stairs, still smiling, heart eyes."),
    dict(start=(24, 0), size="wide", scene="DAY 2: candlelight dinner table."),
    dict(start=(25, 0), size="medium", scene="The OWNER pulls out a chair for YOU."),
    dict(start=(25, 3), size="medium two-shot", scene="Dinner: YOU eats fast, the OWNER watches, smiling."),
    dict(start=(26, 0), size="wide", scene="DAY 30: YOU walks in the front door, a towel on his shoulder."),
    dict(start=(27, 0), size="medium", scene="YOU strolls past the BUTLER with his towel."),
    dict(start=(27, 4), size="close-up", scene="The BUTLER rolls his eyes."),
    dict(start=(28, 0), size="wide", scene="DAY 60: the big cozy couch in the evening."),
    dict(start=(29, 0), size="medium", scene="YOU yawns on the couch, eyes closing."),
    dict(start=(29, 3), size="wide", scene="YOU asleep on the big couch: Zzz."),
    dict(start=(30, 0), size="extreme close-up", scene="YOU opens his eyes."),
    dict(start=(30, 3), size="wide (top)", scene="Both cuddled up on the couch under a blanket."),
    dict(start=(31, 0), size="close-up", scene="YOU's eyes become hearts."),
    dict(start=(31, 3), size="two-shot", scene="Both with heart eyes, not moving, hearts floating, BA-DUM!"),
    dict(start=(32, 0), size="wide", scene="DAY 100: YOU, clean and shaved, at the door with one tiny bag."),
    dict(start=(33, 0), size="medium", scene="YOU unpacks the tiny bag: one sock, one toothbrush."),
    dict(start=(34, 0), size="wide", scene="DAY 200: the Eiffel Tower at sunset."),
    dict(start=(35, 0), size="medium", scene="Both in front of the Eiffel Tower, arm in arm."),
    dict(start=(36, 0), size="close-up", scene="YOU turns to him."),
    dict(start=(37, 0), size="close-up", scene="\"I love you.\" YOU, a big pulsing heart."),
    dict(start=(38, 0), size="two-shot close-up", scene="\"I love you more.\" Both faces, giant pulsing hearts."),
    dict(start=(39, 0), size="wide", scene="DAY 365: the hall at night, candles and rose petals."),
    dict(start=(39, 3), size="medium", scene="The OWNER walks up to YOU, a hand behind his back."),
    dict(start=(40, 0), size="wide", scene="He gets down on one knee."),
    dict(start=(40, 3), size="close-up", scene="YOU gasps, hands on his cheeks."),
    dict(start=(41, 0), size="medium", scene="The OWNER opens a little box."),
    dict(start=(41, 4), size="extreme close-up", scene="The ring is made of toilet paper."),
    dict(start=(42, 0), size="extreme close-up", scene="A sparkling diamond on top."),
    dict(start=(43, 0), size="close-up", scene="YOU cries happy tears, nods yes, hearts everywhere."),
    dict(start=(44, 0), size="wide", scene="The garden wedding: both in suits under the flower arch, string lights, guests clapping, the BUTLER crying in front."),
    dict(start=(45, 0), size="wide", scene="5 YEARS LATER: the mansion on a sunny day."),
    dict(start=(46, 0), size="wide", scene="Two KIDS run around the marble hall."),
    dict(start=(47, 0), size="medium", scene="The golden toilet, still sparkling."),
    dict(start=(48, 0), size="wide (night)", scene="Night: the mansion with warm windows."),
    dict(start=(48, 3), size="medium (pull back)", scene="The whole family cuddled on the same couch, watching TV."),
    dict(start=(49, 0), size="close-up", scene="YOU with heart eyes, looking at him."),
    dict(start=(50, 0), size="two-shot", scene="Both with heart eyes, smiling at each other."),
    dict(start=(51, 0), size="close-up", scene="The golden toilet, sparkles."),
    dict(start=(52, 0), size="wide (zoom out)", scene="Slow zoom out from the golden toilet, sparkles. Fade out."),
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

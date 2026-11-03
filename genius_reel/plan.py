"""Shot plan for the "genius content creator" reel -> shots.json (times, captions, what each shot shows).

Every shot starts 0.10 s before its first voice word (a cut just ahead of the word), so the shots fill the whole
voiceover with no gaps; "at" = an absolute start time for a cut inside a line. Caption chunks are 1-3 words and
start on the first word they show. Everything is made in code (scene/ = three.js), no images.
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

# Caption chunks per voice line (1-3 words, exact script words; trailing , . : are dropped on screen)
CHUNKS = {
    1: ["Being a genius", "content creator,"], 2: ["you run out", "of ideas."], 3: ["So you", "go live…"],
    4: ["and just poop."], 5: ["A thousand views."], 6: ["Not bad."], 7: ["But not enough."],
    8: ["So you", "poop live"], 9: ["on a", "TV show."], 10: ["A million views."],
    11: ["Then on", "the stadium", "big screen."], 12: ["Fifty million."], 13: ["Still not enough."],
    14: ["So you rent", "a helicopter."], 15: ["Fly over", "the whole city."], 16: ["And do", "the world's first"],
    17: ["poop drop."], 18: ["People open", "umbrellas."], 19: ["Cars turn on", "their wipers."],
    20: ["A news anchor", "gets hit"], 21: ["live on air."], 22: ["She doesn't stop", "reading the news."],
    23: ["Professional."], 24: ["One billion views."], 25: ["You're a", "fucking genius."],
}

# One entry per shot. "start" = (line, word index) where the shot's voice starts; "at" = absolute start (s).
SHOTS = [
    dict(start=(1, 0), size="wide", scene="Creator bedroom: YOU at his desk with a ring light and a phone on a tripod, "
         "staring at a blank notebook. A tumbleweed rolls across the floor."),
    dict(start=(2, 0), size="close-up", scene="YOU scratches his head; a cartoon light bulb above his head flickers and goes out."),
    dict(start=(3, 0), size="extreme close-up", scene="The phone on the tripod: the screen turns to a red LIVE badge."),
    dict(start=(4, 0), size="medium (from behind)", scene="YOU turns his back to the phone and squats (pixel mosaic on his "
         "butt). PLOP."),
    dict(start=(5, 0), size="close-up", scene="The phone screen: the view counter ticks up to 1,000. DING!"),
    dict(start=(6, 0), size="medium", scene="YOU looks at the phone, nods, then shrugs: not enough."),
    dict(start=(8, 0), size="wide", scene="Bright TV studio: the presenter smiles on the sofa; YOU squats behind the sofa (side "
         "view, mosaic)."),
    dict(start=(9, 2), size="close-up", scene="The presenter's smile drops."),
    dict(start=(10, 0), size="wide", scene="The studio audience gasps, hands on cheeks. Counter -> 1,000,000."),
    dict(start=(11, 0), size="wide (night)", scene="A giant stadium at night: his blurred squat on the huge big screen."),
    dict(start=(11, 4), size="medium", scene="A football player stops mid-kick and stares up at the screen."),
    dict(start=(12, 0), size="wide", scene="The stands: thousands of fans turn their heads to the screen. Counter -> 50,000,000."),
    dict(start=(13, 0), size="low angle", scene="YOU stands on the stadium field, arms crossed, determined."),
    dict(start=(14, 0), size="medium", scene="On a rooftop helipad YOU climbs into a helicopter; the pilot looks at him with dread."),
    dict(start=(14, 4), size="close-up", scene="The pilot (headset, sunglasses) swallows, worried."),
    dict(start=(15, 0), size="wide", scene="FWOOSH! The helicopter flies over a low-poly city skyline at sunset."),
    dict(start=(16, 0), size="medium (from behind)", scene="YOU leans out of the helicopter door (from behind, mosaic)."),
    dict(start=(17, 0), size="wide (slow motion)", scene="A small brown blob (mosaic) falls through the sky in slow motion."),
    dict(start=(18, 0), size="wide", scene="A busy street: everyone opens an umbrella at once; blobs bounce off. SPLAT!"),
    dict(start=(19, 0), size="wide", scene="A traffic jam: every car's wipers swish at once. THWAP! THWAP!"),
    dict(start=(20, 0), size="medium", scene="TV news studio with a big window, a calm news anchor reading, LIVE on screen; a blob "
         "flies in through the window."),
    dict(start=(21, 0), size="medium close-up", scene="SPLAT! right on her shoulder (mosaic)."),
    dict(start=(22, 0), size="medium close-up", scene="She keeps reading the news, totally calm, the mosaic splat on her shoulder."),
    dict(start=(23, 0), size="extreme close-up", scene="\"Professional.\" One slow blink."),
    dict(start=(24, 0), size="close-up", scene="YOU in the helicopter staring at his phone: the counter explodes to 1,000,000,000, "
         "confetti, KA-CHING, notifications flood the screen."),
    dict(start=(25, 0), size="wide (ending)", scene="YOU in the open helicopter door over the city at sunset, arms up like a hero; "
         "below him the whole city covered in little mosaic splats. Trumpet fanfare."),
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

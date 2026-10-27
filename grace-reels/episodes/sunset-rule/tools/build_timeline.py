"""Build src/timeline.json for The Sunset Rule from the owner's ElevenLabs voice.

Script words are aligned to the faster-whisper word timings in audio/voice_words.json
(made with tools/transcribe_words.py), then shifted by the silence we insert into the
voice. Captions, cards, scene cuts and sunTime keys all come from this one file.

usage (from grace-reels/): python3 -I episodes/sunset-rule/tools/build_timeline.py
"""
import difflib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
FPS = 30

# Silence added to the voice, in ORIGINAL seconds (placed mid-gap, never inside a word).
# Natural ElevenLabs gaps (0.5-0.9 s) are kept; we only lengthen where the brief asks for a
# longer pause or a picture needs room.
LEAD = 0.20                      # first frame is pure action, first word right after
INSERTS = [
    (24.99, 0.06),               # 0.6 s after "at the same time"
    (26.84, 0.90),               # room for the hand to open (S5)
    (34.46, 0.16),               # 0.8 s before "But notice"
    (63.76, 0.20),               # 1.0 s before "Did you notice?" (the reveal)
]
CTA_HOLD = 1.25                  # comment box keeps typing after "Just type today."
END_CARD = 3.0                   # end card (last 3 s of the story)
LOOP = 0.6                       # sunrise that flows back into S1

# page kinds: hook (big title that flies into the caption), caption, card (scripture card)
# *word* = keyword (gold, uppercase). `say` = words as spoken, when the card text differs.
SCRIPT = [
    ("S1", [("hook", "Jesus got *angry*."), ("caption", "So… is anger a *sin*?")]),
    ("S2", [("caption", "In a synagogue, a man stood there with a withered hand."),
            ("caption", "And some people watched Jesus, hoping to catch Him breaking the rules.")]),
    ("S3", [("caption", "The Bible says Jesus “looked round about on them with *anger*…”")]),
    ("S4", [("caption", "But read the rest of that verse: “…being *grieved* for the hardness of their hearts.”"),
            ("caption", "He was angry and heartbroken… at the same *time*.")]),
    ("S5", [("caption", "Then He healed the man *anyway*.")]),
    ("S6", [("caption", "Another time, He made a whip of cords and *flipped* the tables in the temple.")]),
    ("S7", [("card", {"say": "Make not my Father's house an house of merchandise.",
                      "text": "“…make not my Father’s house an house of *merchandise*.”",
                      "ref": "JOHN 2:16 · KJV"})]),
    ("S8", [("caption", "But notice who He got angry *for*:"),
            ("caption", "God’s house, and hurting people. Never for *Himself*.")]),
    ("S9", [("caption", "When they mocked Him and hurt Him,"),
            ("card", {"say": "when he was reviled, reviled not again.",
                      "text": "“…when he was reviled, *reviled not again*…”",
                      "ref": "1 PETER 2:23 · KJV"})]),
    ("S10", [("caption", "Instead He said:"),
             ("card", {"say": "Father, forgive them; for they know not what they do.",
                       "text": "“Father, *forgive* them; for they know not what they do.”",
                       "ref": "LUKE 23:34 · KJV"})]),
    ("S11", [("caption", "Angry about what hurt others."), ("caption", "*Forgiving* about what hurt Him.")]),
    ("S12", [("caption", "And the Bible gives anger a *deadline*:"),
             ("card", {"say": "Be ye angry, and sin not: let not the sun go down upon your wrath.",
                       "text": "“Be ye angry, and *sin not*: let not the *sun* go down upon your wrath.”",
                       "ref": "EPHESIANS 4:26 · KJV", "full": True})]),
    ("S13", [("caption", "Did you notice?"), ("caption", "The sun has been *setting* this whole time.")]),
    ("S14", [("caption", "Is there someone you need to forgive before it goes down?")]),
    ("S15", [("caption", "Just type *TODAY*.")]),
]

# sunTime at the START of each scene (0 = noon, 1 = dusk); the end of the story is 1.
SUN_KEYS = {"S1": 0.0, "S2": 0.035, "S3": 0.09, "S4": 0.12, "S5": 0.20, "S6": 0.25, "S7": 0.34,
            "S8": 0.38, "S9": 0.46, "S10": 0.57, "S11": 0.66, "S12": 0.70, "S13": 0.865,
            "S14": 0.90, "S15": 0.995, "S16": 1.0}


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def tokens(text):
    return [t for t in text.split() if norm(t)]


def shift(t):
    """Original voice time -> reel time."""
    return LEAD + t + sum(d for at, d in INSERTS if at <= t)


def main():
    voice = json.load(open(os.path.join(EP, "audio", "voice_words.json")))
    heard = voice["words"]

    # flatten script into spoken tokens, remembering page ownership
    pages, spoken = [], []
    for scene, plist in SCRIPT:
        for kind, body in plist:
            say = body["say"] if kind == "card" else body
            ids = []
            for tok in tokens(say):
                ids.append(len(spoken))
                spoken.append({"tok": tok, "page": len(pages), "scene": scene})
            pages.append({"scene": scene, "kind": kind, "body": body, "tokens": ids})

    a, b = [norm(s["tok"]) for s in spoken], [norm(h["w"]) for h in heard]
    times = [None] * len(spoken)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"])
        elif op in ("replace", "delete"):  # "delete" = spoken token whisper did not hear
            if op == "replace":
                t0, t1 = heard[j1]["start"], heard[j2 - 1]["end"]
            else:  # squeeze it between its neighbours
                t0 = heard[j1 - 1]["end"] if j1 > 0 else 0.0
                t1 = heard[j1]["start"] if j1 < len(heard) else t0 + 0.3
            weights = [max(len(a[i]), 1) for i in range(i1, i2)]
            acc, tot = 0.0, sum(weights)
            for k, wgt in enumerate(weights):
                s = t0 + (t1 - t0) * acc / tot
                acc += wgt
                times[i1 + k] = (s, t0 + (t1 - t0) * acc / tot)
            print(f"  aligned by interpolation: {[spoken[i]['tok'] for i in range(i1, i2)]} ~ {[heard[j]['w'] for j in range(j1, j2)]}")

    # a token squeezed into a zero-length gap shares its left neighbour's time ("Be ye")
    for i in range(1, len(times)):
        if times[i][1] - times[i][0] < 0.05:
            (p0, p1), w0, w1 = times[i - 1], len(a[i - 1]), len(a[i])
            mid = p0 + (p1 - p0) * w0 / (w0 + w1)
            times[i - 1], times[i] = (p0, mid), (mid, p1)

    words = []
    for i, (s, t) in enumerate(zip(spoken, times)):
        words.append({"i": i, "tok": s["tok"], "page": s["page"], "scene": s["scene"],
                      "start": round(shift(t[0]), 3), "end": round(shift(t[1]), 3)})

    # scenes: cut 0.3 s before each scene's first word
    order = [sc for sc, _ in SCRIPT]
    first = {sc: min(w["start"] for w in words if w["scene"] == sc) for sc in order}
    voice_end = shift(voice["stats"]["duration"])
    story_end = words[-1]["end"] + CTA_HOLD
    total = story_end + END_CARD + LOOP
    starts = [0.0] + [round(first[sc] - 0.3, 3) for sc in order[1:]] + [round(story_end, 3)]
    scenes = []
    for k, sc in enumerate(order + ["S16"]):
        end = starts[k + 1] if k + 1 < len(starts) else round(total, 3)
        scenes.append({"id": sc, "start": starts[k], "end": end, "sun": SUN_KEYS[sc]})

    # caption page display windows
    out_pages = []
    for p_i, p in enumerate(pages):
        ws = [words[i] for i in p["tokens"]]
        nxt = pages[p_i + 1] if p_i + 1 < len(pages) else None
        scene_end = next(s["end"] for s in scenes if s["id"] == p["scene"])
        hide = min(words[nxt["tokens"][0]]["start"] - 0.15, scene_end) if nxt and nxt["scene"] == p["scene"] else scene_end
        if p["kind"] == "card" and nxt and nxt["scene"] == p["scene"]:
            hide = scene_end
        entry = {"id": p_i, "scene": p["scene"], "kind": p["kind"], "words": p["tokens"],
                 "start": round(ws[0]["start"] - 0.15, 3), "end": round(hide, 3)}
        if p["kind"] == "card":
            entry["card"] = p["body"]
        else:
            entry["text"] = p["body"]
        out_pages.append(entry)

    tl = {"fps": FPS, "duration": round(total, 3), "durationInFrames": int(round(total * FPS)),
          "voice": {"file": "voice_elevenlabs.mp3", "lead": LEAD, "inserts": INSERTS,
                    "originalDuration": voice["stats"]["duration"], "end": round(voice_end, 3)},
          "storyEnd": round(story_end, 3), "endCard": END_CARD, "loop": LOOP,
          "scenes": scenes, "pages": out_pages, "words": words}
    out = os.path.join(EP, "src", "timeline.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(tl, open(out, "w"), indent=1, ensure_ascii=False)
    print(f"total {total:.2f} s = {tl['durationInFrames']} frames; voice ends {voice_end:.2f} s")
    for s in scenes:
        print(f"  {s['id']:4s} {s['start']:6.2f} - {s['end']:6.2f}  ({s['end'] - s['start']:4.1f} s)  sun {s['sun']:.3f}")


if __name__ == "__main__":
    main()

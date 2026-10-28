"""Build src/timeline.json and audio/voice.wav for 3 Times a Day from the owner's ElevenLabs voice.

The recording is cut into sentences (script words aligned to the faster-whisper word timings in
audio/voice_words.json, cut points moved out into real silence) and re-joined with the pauses the
brief asks for. Words, keywords, sentences, caption pages and scene cuts all come from this file.

usage (from grace-reels/): python3 -I episodes/3-times-a-day/tools/build_timeline.py
"""
import difflib, json, os, re, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
FPS = 30
SR = 48000

LEAD = 0.0                       # the voice starts on frame 1
CTA_HOLD = 1.6                   # the comment box keeps typing after "Just the number."
END_CARD = 3.0
LOOP = 0.6                       # Daniel's beam flowing back into S1

# scene -> pages; a page is (kind, sentences); a sentence is (pause before it in s, text).
# pause None = the same breath as the sentence before (natural gap kept).
# kinds: open (the opening number beats, no caption), title (S2's big title), caption, card.
# *word* = keyword (gold, uppercase). Cards: {"say": spoken words, "text": shown words, "ref"}.
SCRIPT = [
    ("S1", [("open", [(0, "Daniel prayed *3* times a day.")])]),
    ("S2", [("open", [(1.05, "Studies say many of us check our phones over *100* times a day.")]),
            ("title", [(0.3, "So why is prayer so *hard*?")])]),
    ("S3", [("caption", [(0.3, "Most people say: “I’m too *busy*.”")])]),
    ("S4", [("caption", [(0.8, "But notice who Daniel was.")]),
            ("caption", [(0.3, "One of three leaders over a hundred and twenty princes.")]),
            ("caption", [(0.3, "The *busiest* man in the kingdom.")])]),
    ("S5", [("caption", [(0.3, "Then his enemies got a law signed:")]),
            ("caption", [(0.3, "pray to anyone but the king… and you go to the *lions*.")])]),
    ("S6", [("caption", [(0.3, "And Daniel?")]),
            ("card", [(None, {"say": "He kneeled upon his knees three times a day, and prayed, and gave thanks before his God, as he did aforetime.",
                              "text": "“…he kneeled upon his knees three times a day, and prayed, and gave *thanks* before his God, as he did *aforetime*.”",
                              "ref": "DANIEL 6:10 · KJV"})])]),
    ("S7", [("caption", [(0.6, "As he did aforetime.")]),
            ("caption", [(0.6, "He didn’t start praying because of trouble."), (0.3, "He was *already* praying.")])]),
    ("S8", [("caption", [(0.3, "Prayer isn’t hard because we’re busy.")]),
            ("caption", [(0.3, "It’s hard because something else got our *attention* first.")])]),
    ("S9", [("caption", [(0.3, "Jesus made it simple:")]),
            ("card", [(0.3, {"say": "Enter into thy closet, and when thou hast shut thy door, pray to thy Father which is in secret.",
                             "text": "“…enter into thy closet, and when thou hast shut thy *door*, pray to thy Father which is in secret…”",
                             "ref": "MATTHEW 6:6 · KJV"})])]),
    ("S10", [("caption", [(0.3, "Shut the door. Put the phone *down*.")])]),
    ("S11", [("caption", [(1.2, "David said:")]),  # room for the phone-down match cut (S10)
             ("card", [(None, {"say": "Evening, and morning, and at noon, will I pray, and he shall hear my voice.",
                               "text": "“Evening, and morning, and at noon, will I pray… and he shall *hear* my voice.”",
                               "ref": "PSALM 55:17 · KJV"})])]),
    ("S12", [("caption", [(0.3, "He shall hear. Every single *time*.")])]),
    ("S13", [("caption", [(0.6, "So be honest: how many times did you pray today?")]),
             ("caption", [(0.3, "Just the *number*.")])]),
]


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def tokens(text):
    return [t for t in text.split() if norm(t)]


def load_voice(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


def main():
    voice = json.load(open(os.path.join(EP, "audio", "voice_words.json")))
    heard = voice["words"]
    audio = load_voice(os.path.join(EP, "audio", "voice_elevenlabs.mp3"))

    # flatten the script into spoken tokens, remembering page, sentence and scene
    pages, sentences, spoken = [], [], []
    for scene, plist in SCRIPT:
        for kind, sents in plist:
            ids = []
            for pause, body in sents:
                say = body["say"] if isinstance(body, dict) else body
                if pause is not None or not sentences:
                    sentences.append({"pause": pause or 0.0, "tokens": [], "scene": scene})
                for tok in tokens(say):
                    ids.append(len(spoken))
                    sentences[-1]["tokens"].append(len(spoken))
                    spoken.append({"tok": tok, "page": len(pages), "sentence": len(sentences) - 1, "scene": scene,
                                   "key": tok.startswith("*") or "*" in tok})
            body0 = sents[0][1]
            pages.append({"scene": scene, "kind": kind, "body": body0 if kind == "card" else " ".join(s[1] for s in sents), "tokens": ids})

    # align script tokens to whisper's words
    a, b = [norm(s["tok"]) for s in spoken], [norm(h["w"]) for h in heard]
    times = [None] * len(spoken)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"])
        elif op in ("replace", "delete"):
            if op == "replace":
                t0, t1 = heard[j1]["start"], heard[j2 - 1]["end"]
            else:
                t0 = heard[j1 - 1]["end"] if j1 > 0 else 0.0
                t1 = heard[j1]["start"] if j1 < len(heard) else t0 + 0.3
            weights = [max(len(a[i]), 1) for i in range(i1, i2)]
            acc, tot = 0.0, sum(weights)
            for k, wgt in enumerate(weights):
                s = t0 + (t1 - t0) * acc / tot
                acc += wgt
                times[i1 + k] = (s, t0 + (t1 - t0) * acc / tot)
            print(f"  aligned by interpolation: {[spoken[i]['tok'] for i in range(i1, i2)]} ~ {[heard[j]['w'] for j in range(j1, j2)]}")

    # speech on/offsets per sentence, pushed out to where the audio really goes quiet
    hop = SR // 100
    rms = np.sqrt(np.convolve(audio ** 2, np.ones(hop) / hop, mode="same"))[::hop]
    thr = max(np.percentile(rms, 10) * 4, np.percentile(rms, 99.5) * 0.015)
    quiet = lambda t: rms[min(max(int(t * 100), 0), len(rms) - 1)] < thr
    for s in sentences:
        on, off = times[s["tokens"][0]][0], times[s["tokens"][-1]][1]
        k = 0
        while k < 40 and not quiet(on - 0.01):
            on -= 0.01
            k += 1
        k = 0
        while k < 40 and not quiet(off + 0.01):
            off += 0.01
            k += 1
        s["on"], s["off"] = on, off
        # whisper sometimes gives a sentence's first word no length ("Studies"): start it at the onset
        t0, t1 = times[s["tokens"][0]]
        if t1 - t0 < 0.08:
            times[s["tokens"][0]] = (on, max(t1, on + 0.08))
    for p, n in zip(sentences, sentences[1:]):  # never overlap a neighbour
        if p["off"] > n["on"]:
            p["off"] = n["on"] = (p["off"] + n["on"]) / 2

    # place sentences on the reel clock with the brief's pauses
    t = LEAD
    for k, s in enumerate(sentences):
        if k == 0:
            s["reel"] = LEAD
        elif s["pause"] is None:
            s["reel"] = sentences[k - 1]["reel"] + (s["on"] - sentences[k - 1]["on"])
        else:
            prev = sentences[k - 1]
            s["reel"] = prev["reel"] + (prev["off"] - prev["on"]) + s["pause"]
    reel = lambda k, t: sentences[k]["reel"] + (t - sentences[k]["on"])

    # the edited voice: each sentence clip with 8 ms fades, plus a little air either side
    voice_end = sentences[-1]["reel"] + sentences[-1]["off"] - sentences[-1]["on"]
    out = np.zeros(int((voice_end + 1.0) * SR), dtype=np.float32)
    for k, s in enumerate(sentences):
        pre = 0.03 if k else 0.0
        a0, a1 = s["on"] - pre, s["off"] + 0.05
        if k + 1 < len(sentences) and sentences[k + 1]["pause"] is None:
            continue  # same breath as the next sentence: written together with it below
        k0 = k
        while k0 > 0 and sentences[k0]["pause"] is None:
            k0 -= 1
        a0 = sentences[k0]["on"] - (0.03 if k0 else 0.0)
        clip = audio[int(max(a0, 0) * SR):int(a1 * SR)].copy()
        f = int(0.008 * SR)
        clip[:f] *= np.linspace(0, 1, f)
        clip[-f:] *= np.linspace(1, 0, f)
        at = int(max(reel(k0, a0), 0) * SR)
        out[at:at + len(clip)] += clip
    with wave.open(os.path.join(EP, "audio", "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())

    words = []
    for i, (s, tt) in enumerate(zip(spoken, times)):
        k = s["sentence"]
        words.append({"i": i, "tok": s["tok"], "key": s["key"], "page": s["page"], "sentence": k, "scene": s["scene"],
                      "start": round(reel(k, tt[0]), 3), "end": round(reel(k, tt[1]), 3)})

    # scenes: cut 0.3 s before each scene's first word (S2 is a hard cut right on the voice)
    order = [sc for sc, _ in SCRIPT]
    first = {sc: min(w["start"] for w in words if w["scene"] == sc) for sc in order}
    story_end = words[-1]["end"] + CTA_HOLD
    total = story_end + END_CARD + LOOP
    lead_in = {"S2": 0.06}
    starts = [0.0] + [round(first[sc] - lead_in.get(sc, 0.3), 3) for sc in order[1:]] + [round(story_end, 3)]
    scenes = []
    for k, sc in enumerate(order + ["S14"]):
        end = starts[k + 1] if k + 1 < len(starts) else round(total, 3)
        scenes.append({"id": sc, "start": starts[k], "end": end})

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
        entry["card" if p["kind"] == "card" else "text"] = p["body"]
        out_pages.append(entry)

    tl = {"fps": FPS, "duration": round(total, 3), "durationInFrames": int(round(total * FPS)),
          "voice": {"file": "voice.wav", "source": "voice_elevenlabs.mp3", "end": round(voice_end, 3),
                    "sentences": [{"id": k, "on": round(s["on"], 3), "off": round(s["off"], 3), "reel": round(s["reel"], 3)} for k, s in enumerate(sentences)]},
          "storyEnd": round(story_end, 3), "endCard": END_CARD, "loop": LOOP,
          "scenes": scenes, "pages": out_pages, "words": words}
    os.makedirs(os.path.join(EP, "src"), exist_ok=True)
    json.dump(tl, open(os.path.join(EP, "src", "timeline.json"), "w"), indent=1, ensure_ascii=False)
    print(f"voice {voice['stats']['duration']:.2f} s -> {voice_end:.2f} s; reel {total:.2f} s = {tl['durationInFrames']} frames")
    for s in scenes:
        print(f"  {s['id']:4s} {s['start']:6.2f} - {s['end']:6.2f}  ({s['end'] - s['start']:4.1f} s)")


if __name__ == "__main__":
    main()

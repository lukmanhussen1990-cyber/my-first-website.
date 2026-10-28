"""Build the master timeline for the reel.

- Cuts voiceover.mp3 into sentence segments (cut points sit inside measured
  silences) and re-places each one on the final timeline, adding breathing
  room between lines so the scenes can play out (~68 s total).
- Maps every SCRIPT word (exact script spelling) to its spoken time, using the
  faster-whisper word timestamps (whisper_words.json) corrected against the
  measured silence boundaries.
- Writes timeline.json (used by the renderer and the sound designer) and
  vo_edit.wav (the re-timed voiceover).
"""
import json
import subprocess
import numpy as np

SR = 48000
DURATION = 68.0

# (id, cut_in, cut_out, place_at)  -- times in seconds of the ORIGINAL voiceover
SEGMENTS = [
    ("A",  0.00,  2.30,  1.00),   # How big is Allah's mercy?
    ("B",  2.50,  7.95,  4.60),   # The Prophet (pbuh) said: Allah made mercy in one hundred parts.
    ("C",  8.08, 10.85, 11.00),   # He sent down only one part to the earth.
    ("D", 10.95, 15.00, 15.90),   # And from that one part... comes all the love in the world.
    ("E1", 15.13, 17.05, 21.00),  # A mother hugging her child.
    ("E2", 17.14, 19.07, 23.90),  # A bird feeding her chicks.
    ("E3", 19.14, 21.08, 26.80),  # A cat carrying her kitten.
    ("F1", 21.13, 23.15, 30.60),  # Even a horse lifts her hoof...
    ("F2", 23.15, 24.85, 33.20),  # so she doesn't hurt her baby.
    ("G1", 24.94, 25.96, 37.40),  # All of that...
    ("G2", 25.96, 27.60, 38.70),  # is just one part.
    ("H1", 27.74, 29.13, 42.40),  # The other ninety-nine...
    ("H2", 29.17, 30.77, 44.20),  # Allah kept with Him.
    ("I",  30.80, 33.48, 48.40),  # For His servants... on the Day of Judgement.
    ("J1", 33.54, 35.30, 54.30),  # So never lose hope.
    ("J2", 35.38, 39.40, 56.60),  # Allah says: do not despair of the mercy of Allah.
    ("K",  39.54, 42.10, 62.60),  # Share this with someone who needs hope today.
]

# Script words: (segment, text, gold?, original start time).  Text is the exact
# script wording (gold words shown in normal case).  Times come from whisper,
# corrected where whisper disagreed with the silence map.
W = [
    ("A", "How", 0, 0.02), ("A", "big", 0, 0.30), ("A", "is", 0, 0.70), ("A", "Allah's", 0, 1.12), ("A", "mercy?", 1, 1.58),
    ("B", "The", 0, 2.62), ("B", "Prophet", 0, 2.74), ("B", "ﷺ", 0, 3.08), ("B", "said:", 0, 4.12),
    ("B", "Allah", 0, 4.94), ("B", "made", 0, 5.15), ("B", "mercy", 0, 5.58), ("B", "in", 0, 6.06),
    ("B", "one", 1, 6.36), ("B", "hundred", 1, 6.66), ("B", "parts.", 0, 7.14),
    ("C", "He", 0, 8.20), ("C", "sent", 0, 8.32), ("C", "down", 0, 8.54), ("C", "only", 0, 8.82),
    ("C", "one", 1, 9.20), ("C", "part", 0, 9.56), ("C", "to", 0, 9.86), ("C", "the", 0, 10.06), ("C", "earth.", 0, 10.22),
    ("D", "And", 0, 11.07), ("D", "from", 0, 11.18), ("D", "that", 0, 11.38), ("D", "one", 1, 11.60), ("D", "part…", 0, 11.92),
    ("D", "comes", 0, 12.68), ("D", "all", 0, 12.86), ("D", "the", 0, 13.32), ("D", "love", 0, 13.52),
    ("D", "in", 0, 13.84), ("D", "the", 0, 14.16), ("D", "world.", 0, 14.26),
    ("E1", "A", 0, 15.25), ("E1", "mother", 0, 15.36), ("E1", "hugging", 0, 15.64), ("E1", "her", 0, 16.08), ("E1", "child.", 0, 16.32),
    ("E2", "A", 0, 17.26), ("E2", "bird", 0, 17.40), ("E2", "feeding", 0, 17.72), ("E2", "her", 0, 18.10), ("E2", "chicks.", 0, 18.34),
    ("E3", "A", 0, 19.26), ("E3", "cat", 0, 19.36), ("E3", "carrying", 0, 19.70), ("E3", "her", 0, 20.16), ("E3", "kitten.", 0, 20.44),
    ("F1", "Even", 0, 21.25), ("F1", "a", 0, 21.46), ("F1", "horse", 0, 21.68),
    ("F1", "lifts", 1, 22.02), ("F1", "her", 1, 22.32), ("F1", "hoof…", 1, 22.56),
    ("F2", "so", 0, 23.22), ("F2", "she", 0, 23.38), ("F2", "doesn't", 0, 23.54), ("F2", "hurt", 0, 23.82),
    ("F2", "her", 0, 24.02), ("F2", "baby.", 0, 24.20),
    ("G1", "All", 0, 25.06), ("G1", "of", 0, 25.26), ("G1", "that…", 0, 25.42),
    ("G2", "is", 0, 26.07), ("G2", "just", 0, 26.22), ("G2", "one", 1, 26.48), ("G2", "part.", 1, 26.88),
    ("H1", "The", 0, 27.86), ("H1", "other", 0, 27.98), ("H1", "ninety-nine…", 1, 28.20),
    ("H2", "Allah", 0, 29.28), ("H2", "kept", 0, 29.54), ("H2", "with", 0, 29.90), ("H2", "Him.", 0, 30.16),
    ("I", "For", 0, 30.91), ("I", "His", 0, 31.06), ("I", "servants…", 0, 31.22),
    ("I", "on", 0, 32.09), ("I", "the", 0, 32.22), ("I", "Day", 1, 32.34), ("I", "of", 1, 32.50), ("I", "Judgement.", 1, 32.68),
    ("J1", "So", 0, 33.66), ("J1", "never", 0, 33.88), ("J1", "lose", 0, 34.30), ("J1", "hope.", 0, 34.64),
    ("J2", "Allah", 0, 35.50), ("J2", "says:", 0, 35.70),
    ("J2", "Do", 0, 36.55), ("J2", "not", 0, 36.68), ("J2", "despair", 0, 36.96), ("J2", "of", 0, 37.50),
    ("J2", "the", 0, 37.88), ("J2", "mercy", 1, 38.02), ("J2", "of", 0, 38.30), ("J2", "Allah", 0, 38.66),
    ("K", "Share", 0, 39.66), ("K", "this", 0, 39.88), ("K", "with", 0, 40.14), ("K", "someone", 0, 40.36),
    ("K", "who", 0, 40.66), ("K", "needs", 0, 40.86), ("K", "hope", 1, 41.12), ("K", "today.", 0, 41.38),
]

# Caption chunks: (number of words, style, y-centre, hold-after-last-word or None)
# style: "hook" = big centre question, "cap" = normal caption, "quote" = the
# Quran line under the calligraphy (scene 10).
CHUNKS = [
    (5, "hook", 900, 0.85),
    (4, "cap", 330, None), (3, "cap", 330, None), (4, "cap", 330, 0.9),
    (4, "cap", 1500, None), (5, "cap", 1500, 1.0),
    (5, "cap", 400, None), (4, "cap", 400, None), (3, "cap", 400, 1.1),
    (5, "cap", 400, 1.3), (5, "cap", 400, 1.3), (5, "cap", 400, 1.3),
    (3, "cap", 400, None), (3, "cap", 400, None), (6, "cap", 400, 2.0),
    (3, "cap", 400, None), (4, "cap", 400, 1.0),
    (3, "cap", 330, None), (4, "cap", 330, 1.6),
    (3, "cap", 330, None), (5, "cap", 330, 2.2),
    (4, "cap", 390, None), (2, "cap", 390, 1.2),
    (8, "quote", 1150, 99),
    (4, "cap", 880, None), (4, "cap", 880, 99),
]


def main():
    whisper = json.load(open("whisper_words.json"))
    seg = {s[0]: s for s in SEGMENTS}

    # ---- re-time the voiceover -------------------------------------------
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "voiceover.mp3", "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    vo = np.frombuffer(raw, dtype=np.float32)
    out = np.zeros(int(DURATION * SR), dtype=np.float32)
    fade = int(0.012 * SR)
    for sid, a, b, at in SEGMENTS:
        piece = vo[int(a * SR):int(b * SR)].copy()
        piece[:fade] *= np.linspace(0, 1, fade)
        piece[-fade:] *= np.linspace(1, 0, fade)
        i = int(at * SR)
        out[i:i + len(piece)] += piece
    pcm = (np.clip(out, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "vo_edit.wav"], input=pcm, check=True)

    # ---- words on the final timeline --------------------------------------
    def shift(sid, t):
        _, a, b, at = seg[sid]
        return round(t - a + at, 3)

    words = []
    for i, (sid, text, gold, t0) in enumerate(W):
        # end = next word start in same segment, else the segment's speech end
        nxt = W[i + 1] if i + 1 < len(W) and W[i + 1][0] == sid else None
        if nxt:
            t1 = nxt[3]
        else:
            ends = [w["e"] for w in whisper if seg[sid][1] <= w["s"] < seg[sid][2]]
            t1 = max(ends) if ends else t0 + 0.4
        words.append({"text": text, "gold": bool(gold), "seg": sid,
                      "start": shift(sid, t0), "end": shift(sid, min(t1, seg[sid][2]))})

    chunks, k = [], 0
    for n, style, y, hold in CHUNKS:
        ws = words[k:k + n]
        k += n
        chunks.append({"words": ws, "style": style, "y": y, "hold": hold})
    assert k == len(words), (k, len(words))
    for i, c in enumerate(chunks):
        start = c["words"][0]["start"] - 0.08
        if c["hold"] is None:
            end = chunks[i + 1]["words"][0]["start"] - 0.12
        else:
            end = c["words"][-1]["end"] + c["hold"]
            if i + 1 < len(chunks):
                end = min(end, chunks[i + 1]["words"][0]["start"] - 0.12)
        c["start"], c["end"] = round(start, 3), round(min(end, DURATION), 3)
        del c["hold"]

    def wt(sid, text, nth=0):
        hits = [w for w in words if w["seg"] == sid and w["text"].strip(".,:?…").lower() == text]
        return hits[nth]["start"]

    # ---- key moments (scenes) -------------------------------------------
    T = {
        "patternIn": 0.2, "hookOut": 4.0,
        "vesselRise": 3.9, "vesselSettled": 7.2,
        "countStart": 7.15, "countEnd": wt("B", "hundred") + 0.35,
        "dropOpen": 10.25, "dropExit": 10.75, "dropLand": 15.0,
        "splash": 15.0,
        "mother": wt("E1", "mother") - 0.55, "bird": wt("E2", "bird") - 0.55, "cat": wt("E3", "cat") - 0.55,
        "horse": 29.6, "hoofUp": wt("F1", "lifts") - 0.05, "hoofHeld": wt("F1", "hoof") + 0.9,
        "pullBack": 36.6, "gather": 37.6, "oneDrop": 40.1,
        "rise": 40.9, "vesselBack": 42.3,
        "count99": wt("H1", "ninety-nine") + 0.05,
        "brighten": 43.6, "swirl": 44.6, "fill": 47.6, "bright": 50.2, "settle": 52.6,
        "rahma": 54.9, "quoteRef": wt("J2", "allah", 1) + 0.6,
        "end": 61.9, "fadeOut": 66.1, "duration": DURATION,
    }
    timeline = {"fps": 30, "width": 1080, "height": 1920, "duration": DURATION,
                "T": T, "chunks": chunks, "words": words,
                "vo": [{"id": s[0], "start": s[3], "end": s[3] + s[2] - s[1]} for s in SEGMENTS]}
    json.dump(timeline, open("timeline.json", "w"), indent=1, ensure_ascii=False)
    with open("js/timeline.js", "w") as f:
        f.write("window.TIMELINE = " + json.dumps(timeline, ensure_ascii=False) + ";\n")
    for c in chunks:
        print(f'{c["start"]:6.2f}-{c["end"]:6.2f} {c["style"]:5s} ' + " ".join(
            ("*" if w["gold"] else "") + w["text"] for w in c["words"]))
    for k_, v in T.items():
        print(f"  {k_:14s} {v:6.2f}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build timeline.json: word timings, scene cuts and caption chunks.

With a voiceover:   python3 tools/align.py --voice my_voiceover.mp3
Without (preview):  python3 tools/align.py --estimate

Word timings come from faster-whisper (free, runs locally on the CPU).
The recognised words are aligned to the known script, so caption text is
always spelled exactly like the script while the timing comes from the voice.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 16000

NUMBERS = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
           "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"}


def norm(word):
    w = word.lower().replace("’", "'")
    w = re.sub(r"[^a-z0-9']", "", w)
    w = NUMBERS.get(w, w)
    w = w.replace("'", "")
    # "Sooo" / "Nooo" / "officer" -> collapse repeated letters
    w = re.sub(r"(.)\1+", r"\1", w)
    return w


def load_script(path=None):
    with open(path or os.path.join(ROOT, "script.json")) as f:
        data = json.load(f)
    words = []
    for li, line in enumerate(data["lines"]):
        toks = line["text"].split()
        loud_words = set(line.get("loud_words", []))
        for wi, tok in enumerate(toks):
            words.append({
                "text": tok,
                "line": li,
                "idx": wi,
                "loud": bool(line.get("loud")) or tok in loud_words,
            })
    return data, words


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def transcribe(audio, model_name):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    script_prompt = ("You walk into the police station. And you poop. Immediately. "
                     "Sir... did you just... Three days, officer! Sooo handsome. "
                     "My sugar muffin! My cuddle bear! My little honey bunny!")
    segs, _ = model.transcribe(audio, word_timestamps=True, beam_size=5,
                               language="en", initial_prompt=script_prompt,
                               vad_filter=False)
    out = []
    for s in segs:
        for w in s.words:
            out.append({"w": w.word.strip(), "s": float(w.start), "e": float(w.end),
                        "p": float(w.probability)})
    return out


def align(script_words, heard):
    """Copy timings from recognised words onto script words."""
    a = [norm(w["text"]) for w in script_words]
    b = [norm(w["w"]) for w in heard]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    matched = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for k in range(i2 - i1):
                script_words[i1 + k]["s"] = heard[j1 + k]["s"]
                script_words[i1 + k]["e"] = heard[j1 + k]["e"]
                script_words[i1 + k]["heard"] = heard[j1 + k]["w"]
                matched += 1 if tag == "equal" else 0
        elif tag == "replace":
            # spread the recognised span over the script span
            s0, e0 = heard[j1]["s"], heard[j2 - 1]["e"]
            spread(script_words[i1:i2], s0, e0)
    # fill words that whisper skipped
    n = len(script_words)
    for i, w in enumerate(script_words):
        if "s" in w:
            continue
        j = i
        while j < n and "s" not in script_words[j]:
            j += 1
        prev_e = script_words[i - 1]["e"] if i > 0 else 0.0
        next_s = script_words[j]["s"] if j < n else prev_e + 0.4 * (j - i)
        spread(script_words[i:j], prev_e, max(next_s, prev_e + 0.1 * (j - i)))
    return matched


def spread(words, s0, e0):
    lens = [max(2, len(norm(w["text"]))) for w in words]
    tot = float(sum(lens))
    t = s0
    for w, L in zip(words, lens):
        d = (e0 - s0) * L / tot
        w["s"], w["e"] = t, t + d
        t += d


def estimate(script_words):
    """Rough narration pace used only when no voiceover is available."""
    t = 0.35
    for i, w in enumerate(script_words):
        letters = len(norm(w["text"]))
        dur = 0.10 + 0.047 * letters
        if re.match(r"(?i)s?o{3}|no{3}", w["text"].strip(",.!?…")):
            dur += 0.35
        w["s"], w["e"] = t, t + dur
        t += dur
        tail = w["text"][-1]
        nxt_line = i + 1 < len(script_words) and script_words[i + 1]["line"] != w["line"]
        if w["text"].endswith("…"):
            t += 0.38
        elif tail in ".!?":
            t += 0.26
        elif tail == ",":
            t += 0.10
        else:
            t += 0.03
        if nxt_line:
            t += 0.12
    return t + 0.9


def word_loudness(audio, words):
    for w in words:
        a = audio[int(w["s"] * SR):max(int(w["e"] * SR), int(w["s"] * SR) + 1)]
        rms = float(np.sqrt(np.mean(a * a))) if len(a) else 0.0
        w["db"] = round(20 * np.log10(rms + 1e-6), 2)


FUNCTION_WORDS = {"the", "a", "an", "in", "into", "to", "with", "my", "your", "his", "of",
                  "and", "he", "you", "dont", "is"}
MODIFIERS = {"big", "little", "sugar", "cuddle", "honey", "police", "toilet", "ceiling",
             "tall", "bald", "three", "no"}


def chunk_line(words):
    """Split one line into caption chunks of 2-3 words.

    Small dynamic programme: prefers 2-3 word chunks, breaking at punctuation,
    never after "the/a/my...", never splitting a sentence in the middle of a
    chunk, and only joining one-word sentences ("Tall. Bald.") when the voice
    runs them together.
    """
    n = len(words)
    INF = 1e9

    def chunk_cost(i, j):  # words[i:j]
        size = j - i
        c = {1: 2.5, 2: 0.0, 3: 0.1}[size] + 0.3
        for k in range(i, j - 1):
            t = words[k]["text"]
            if t.endswith("…"):
                return INF
            if re.search(r"[.!?]$", t):
                # a chunk may hold several *whole* short sentences only
                starts_sentence = i == 0 or re.search(r"[.!?…]$", words[i - 1]["text"])
                if not starts_sentence:
                    return INF
                gap = words[k + 1]["s"] - words[k]["e"]
                c += 1.5 + (10 if gap > 0.30 else 0)
            elif t.endswith(","):
                c += 0.6
            if words[k]["loud"] != words[k + 1]["loud"]:
                c += 3
        if j < n:
            last = words[j - 1]["text"]
            w = norm(last)
            if re.search(r"[,.!?…]$", last):
                pass
            elif w in FUNCTION_WORDS:
                c += 1.6
            elif w in MODIFIERS:
                c += 2.0
            else:
                c += 0.4
        return c

    best = [INF] * (n + 1)
    back = [0] * (n + 1)
    best[0] = 0.0
    for j in range(1, n + 1):
        for size in (1, 2, 3):
            i = j - size
            if i < 0:
                continue
            c = best[i] + chunk_cost(i, j)
            if c < best[j]:
                best[j], back[j] = c, i
    chunks = []
    j = n
    while j > 0:
        i = back[j]
        chunks.append(words[i:j])
        j = i
    return chunks[::-1]


def build(script, words, duration, audio=None):
    lines = script["lines"]
    if audio is not None:
        word_loudness(audio, words)
        dbs = sorted(w["db"] for w in words)
        med = dbs[len(dbs) // 2]
    # scenes
    scenes = []
    for li, line in enumerate(lines):
        lw = [w for w in words if w["line"] == li]
        scenes.append({"id": line["id"], "text": line["text"],
                       "ws": lw[0]["s"], "we": lw[-1]["e"]})
    for k, sc in enumerate(scenes):
        if k == 0:
            sc["start"] = 0.0
        else:
            prev_end = scenes[k - 1]["we"]
            sc["start"] = max(prev_end + 0.02, sc["ws"] - 0.10)
            sc["start"] = min(sc["start"], sc["ws"])
    for k, sc in enumerate(scenes):
        sc["end"] = scenes[k + 1]["start"] if k + 1 < len(scenes) else duration
        sc["dur"] = sc["end"] - sc["start"]

    # captions
    captions = []
    for li in range(len(lines)):
        lw = [w for w in words if w["line"] == li]
        for ch in chunk_line(lw):
            loud = any(w["loud"] for w in ch)
            if audio is not None:
                cdb = float(np.mean([w["db"] for w in ch]))
                if cdb > med + 6.0:
                    loud = True
            captions.append({
                "text": " ".join(w["text"] for w in ch),
                "words": [{"t": w["text"], "s": round(w["s"], 3), "e": round(w["e"], 3)} for w in ch],
                "s": round(max(0.0, ch[0]["s"] - 0.03), 3),
                "e": round(ch[-1]["e"], 3),
                "line": li,
                "loud": loud,
            })
    for k, c in enumerate(captions):
        nxt = captions[k + 1]["s"] if k + 1 < len(captions) else duration
        c["hide"] = round(min(nxt, c["e"] + 0.7), 3)

    for sc in scenes:
        for key in ("start", "end", "dur", "ws", "we"):
            sc[key] = round(sc[key], 3)
    return {
        "duration": round(duration, 3),
        "fps": 30,
        "scenes": scenes,
        "captions": captions,
        "words": [{"t": w["text"], "s": round(w["s"], 3), "e": round(w["e"], 3),
                   "line": w["line"], "heard": w.get("heard")} for w in words],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", help="voiceover audio file")
    ap.add_argument("--estimate", action="store_true", help="no voiceover: estimate pacing")
    ap.add_argument("--model", default="small.en")
    ap.add_argument("--script", help="script json (default: script.json)")
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "timeline.json"))
    args = ap.parse_args()

    script, words = load_script(args.script)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    if args.voice:
        audio = decode(args.voice)
        duration = probe_duration(args.voice)
        heard = transcribe(audio, args.model)
        with open(os.path.join(os.path.dirname(args.out), "whisper_words.json"), "w") as f:
            json.dump(heard, f, indent=1)
        matched = align(words, heard)
        print(f"whisper heard {len(heard)} words; {matched}/{len(words)} script words matched exactly")
        tl = build(script, words, duration, audio)
        tl["source"] = os.path.basename(args.voice)
    elif args.estimate:
        duration = estimate(words)
        tl = build(script, words, duration)
        tl["source"] = "ESTIMATED (no voiceover)"
    else:
        sys.exit("pass --voice FILE or --estimate")
    with open(args.out, "w") as f:
        json.dump(tl, f, indent=1)
    print(f"duration {tl['duration']:.2f}s, {len(tl['scenes'])} scenes, {len(tl['captions'])} captions -> {args.out}")
    for sc in tl["scenes"]:
        print(f"  {sc['id']:2d} {sc['start']:6.2f}-{sc['end']:6.2f} ({sc['dur']:.2f}s) {sc['text']}")


if __name__ == "__main__":
    main()

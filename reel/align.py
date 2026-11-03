#!/usr/bin/env python3
"""Word timings for the captions, computed LOCALLY (no extra ElevenLabs calls).

The voice lines were generated once through the ElevenLabs connector, which has
no "with timestamps" option, so we time every word with faster-whisper running
on the CPU and snap the recognised words onto the known script text.

Writes audio/lines.json (the manifest timeline.py reads). Re-running is safe:
it never touches the mp3 files.

Run with a Python that has faster-whisper installed, e.g.
  python -m venv fw && fw/bin/pip install faster-whisper && fw/bin/python align.py
"""
import difflib, json, os, re, subprocess
import numpy as np
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").copy()


def speech_bounds(x):
    """first/last sample above a gentle energy threshold"""
    win = int(0.01 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    thr = max(0.008, 0.06 * e.max())
    idx = np.where(e > thr)[0]
    return (idx[0] / SR, idx[-1] / SR) if len(idx) else (0.0, len(x) / SR)


def main():
    script = json.load(open(os.path.join(HERE, "script.json")))
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    out = []
    for ln in script["lines"]:
        fn = f"audio/{ln['id']}_{ln['speaker'].lower()}.mp3"
        path = os.path.join(HERE, fn)
        x = load_audio(path)
        dur = len(x) / SR
        on, off = speech_bounds(x)
        segs, _ = model.transcribe(x, language="en", word_timestamps=True, initial_prompt=ln["text"], beam_size=5, vad_filter=False, condition_on_previous_text=False)
        rec = [w for s in segs for w in s.words]
        # whisper sometimes "hears" repeats after the real speech: keep only the first pass
        rec = [w for w in rec if w.start < off + 0.05][: len(ln["text"].split()) + 2]
        target = ln["text"].split()
        a = [norm(w) for w in target]
        b = [norm(w.word) for w in rec]
        times = [None] * len(target)
        sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                r = rec[blk.b + k]
                times[blk.a + k] = [float(r.start), float(r.end)]
        # fill unmatched words by spreading them (by letter count) between known neighbours
        i = 0
        while i < len(target):
            if times[i] is not None:
                i += 1; continue
            j = i
            while j < len(target) and times[j] is None:
                j += 1
            t0 = times[i - 1][1] if i > 0 else on
            t1 = times[j][0] if j < len(target) else off
            lens = [max(1, len(norm(w))) for w in target[i:j]]
            tot = sum(lens); acc = t0
            for k, L in enumerate(lens):
                d = (t1 - t0) * L / tot
                times[i + k] = [acc, acc + d]; acc += d
            i = j
        # clamp to the real speech region and keep monotonic
        times[0][0] = max(0.0, min(times[0][0], on - 0.01))                 # never start after the real onset
        times[-1][1] = min(max(times[-1][1], off, times[-1][0] + 0.12), dur)  # never end before the real offset
        for k in range(1, len(times)):
            times[k][0] = max(times[k][0], times[k - 1][0] + 0.02)
            times[k - 1][1] = min(times[k - 1][1], times[k][0]) if times[k - 1][1] > times[k][0] else times[k - 1][1]
        words = [{"word": w, "start": round(s, 3), "end": round(max(e, s + 0.05), 3)} for w, (s, e) in zip(target, times)]
        matched = sum(1 for blk in sm.get_matching_blocks() for _ in range(blk.size))
        print(f"{ln['id']} {ln['speaker']:8s} {dur:5.2f}s speech {on:4.2f}-{off:4.2f}  matched {matched}/{len(target)}  heard: {' '.join(w.word.strip() for w in rec)}")
        out.append({"id": ln["id"], "speaker": ln["speaker"], "text": ln["text"], "file": fn,
                    "duration": round(dur, 3), "align": "faster-whisper base.en (local)", "words": words})
    with open(os.path.join(HERE, "audio", "lines.json"), "w") as f:
        json.dump(out, f, indent=1)
    print("wrote audio/lines.json")


if __name__ == "__main__":
    main()

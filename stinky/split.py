#!/usr/bin/env python3
"""Split the provided voiceover (audio/voiceover.mp3) into one WAV per script line.

* Speech segments are found from the audio energy (cuts always land in silence).
* script.json lists, per line, which sentences/segments it contains, so the 30
  detected segments are assigned to the 20 lines in order (checked, not guessed).
* Word timings inside a segment come from a local faster-whisper transcript
  (audio/whisper_words.json), re-fitted to the segment's real start/end because
  whisper's absolute times drift by up to ~0.4 s on this file.

Writes audio/lines/NN_speaker.wav and audio/lines.json (times relative to each file).
"""
import json, os, re, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
HOP = 0.02
MIN_SIL = 0.12


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def segments(x):
    hop = int(HOP * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    thr = 0.02 * e.max()
    on = e >= thr
    segs, i, n = [], 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            segs.append([i * HOP, j * HOP])
            i = j
        else:
            i += 1
    # merge segments separated by less than MIN_SIL, drop blips
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < MIN_SIL:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] >= 0.06], e


def norm(w):
    w = w.lower().replace("10", "ten")
    return re.sub(r"[^a-z]", "", w)


def main():
    script = json.load(open(os.path.join(HERE, "script.json")))
    x = load(os.path.join(HERE, script["voiceover"]))
    dur = len(x) / SR
    segs, _ = segments(x)
    want = [seg for ln in script["lines"] for seg in ln["segments"]]
    print(f"voiceover {dur:.2f}s: found {len(segs)} speech segments, script expects {len(want)}")
    assert len(segs) == len(want), "segment count mismatch - adjust threshold"
    script_words = [w for seg in want for w in seg[0].split()]
    wpath = os.path.join(HERE, "audio", "whisper_words.json")
    if os.path.exists(wpath):    # optional: local faster-whisper word times (only used for spacing inside a segment)
        whisper = json.load(open(wpath))
        wq = [(norm(w), s, e) for (w, s, e) in whisper]
        assert [norm(w) for w in script_words] == [w for w, _, _ in wq], "whisper words differ from the script"
    else:                        # no transcript: spread words by letter count inside each segment
        wq = [(norm(w), 0.0, 0.0) for w in script_words]
    os.makedirs(os.path.join(HERE, "audio", "lines"), exist_ok=True)
    k = 0      # index into segments
    wi = 0     # index into whisper words
    out = []
    for ln in script["lines"]:
        first, last = k, k + len(ln["segments"]) - 1
        prev_end = segs[first - 1][1] if first > 0 else 0.0
        next_start = segs[last + 1][0] if last + 1 < len(segs) else dur
        a = max(0.0, segs[first][0] - min(0.08, (segs[first][0] - prev_end) / 2))
        b = min(dur, segs[last][1] + min(0.16, (next_start - segs[last][1]) / 2))
        words = []
        for si in range(first, last + 1):
            s0, s1 = segs[si]
            toks = want[si][0].split()
            ws = wq[wi:wi + len(toks)]; wi += len(toks)
            w0, w1 = ws[0][1], ws[-1][2]
            letters = [max(1, len(norm(t))) for t in toks]
            for j, t in enumerate(toks):
                if w1 - w0 > 0.05:
                    ts = s0 + (ws[j][1] - w0) / (w1 - w0) * (s1 - s0)
                    te = s0 + (ws[j][2] - w0) / (w1 - w0) * (s1 - s0)
                else:   # whisper gave no usable span: spread by letter count
                    ts = s0 + sum(letters[:j]) / sum(letters) * (s1 - s0)
                    te = s0 + sum(letters[: j + 1]) / sum(letters) * (s1 - s0)
                words.append({"word": t, "start": round(ts - a, 3), "end": round(max(te, ts + 0.06) - a, 3)})
        k = last + 1
        seg = x[int(a * SR): int(b * SR)].copy()
        nf = int(0.008 * SR)
        seg[:nf] *= np.linspace(0, 1, nf); seg[-nf:] *= np.linspace(1, 0, nf)
        fn = f"audio/lines/{ln['id']}_{ln['speaker'].lower()}.wav"
        with wave.open(os.path.join(HERE, fn), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(seg, -1, 1) * 32767).astype("<i2").tobytes())
        out.append({"id": ln["id"], "speaker": ln["speaker"], "text": ln["text"], "file": fn,
                    "src": [round(a, 3), round(b, 3)], "duration": round(b - a, 3), "words": words})
        print(f"{ln['id']} {ln['speaker']:8s} {a:6.2f}-{b:6.2f} ({b - a:4.2f}s)  {ln['text']}")
    json.dump(out, open(os.path.join(HERE, "audio", "lines.json"), "w"), indent=1)
    print("wrote audio/lines.json")


if __name__ == "__main__":
    main()

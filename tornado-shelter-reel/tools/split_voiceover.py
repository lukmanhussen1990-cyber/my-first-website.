#!/usr/bin/env python3
"""Cut one recording of the whole script (every line read in order, with a pause
between lines) into one file per line, with word timings, like tools/voices.py does
for generated voices.

  python3 tools/split_voiceover.py [recording.mp3|wav]   (default: voices.narrator.recording.file)

The whole recording is transcribed once to find where each line starts and ends;
each cut goes in the middle of the silence between two lines. Every line is then
transcribed on its own (prompted with its text) and its words are matched onto the
script's words, so the subtitles spell the script exactly ("ten", not "10").
One gain is used for every line, so their loudness stays as recorded.

Writes assets/vo/<id>.wav (48 kHz mono), assets/vo/<id>.words.json and
assets/vo/manifest.json.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import voices as V  # noqa: E402

FADE = 0.008  # seconds of fade at each cut


def main():
    script = json.load(open(os.path.join(V.ROOT, "script.json")))
    lines = script["lines"]
    cfg = script["voices"]["narrator"]["recording"]
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(V.ROOT, cfg["file"])
    x = V.decode(src)
    print(f"{os.path.relpath(src, V.ROOT)}: {len(x) / V.SR:.2f} s")

    # 1. the whole recording, matched onto the whole script
    words, owner = [], []
    for i, l in enumerate(lines):
        for w in l["text"].split():
            words.append(w)
            owner.append(i)
    heard = V.whisper_words(x, " ".join(l["text"] for l in lines))
    timed = V.match_script(words, heard)

    # 2. a cut in the middle of the silence between consecutive lines
    db, hop = V.envelope_db(x)
    sil = db < np.percentile(db, 90) - 30
    runs = V.silence_runs(sil, hop, 0.12)
    cuts = [0.0]
    for i in range(len(lines) - 1):
        last = max(k for k in range(len(words)) if owner[k] == i)
        e, s = timed[last]["e"], timed[last + 1]["s"]
        best = None
        for a, b in runs:
            # the silence must sit between the two lines' words (whisper's edges are loose)
            if b < e - 0.25 or a > s + 0.25:
                continue
            d = abs((a + b) / 2 - (e + s) / 2)
            if best is None or d < best[0]:
                best = (d, (a + b) / 2)
        cut = best[1] if best else (e + s) / 2
        if not best:
            print(f"  warning: no clear pause between {lines[i]['id']} and {lines[i + 1]['id']}, cutting at {cut:.2f}s")
        cuts.append(cut)
    cuts.append(len(x) / V.SR)

    # 3. each line on its own: trim, fades, word timings
    out = []
    for i, line in enumerate(lines):
        seg = x[int(cuts[i] * V.SR):int(cuts[i + 1] * V.SR)].copy()
        seg, _ = V.trim(seg, None)
        n = int(FADE * V.SR)
        ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
        seg[:n] *= ramp
        seg[-n:] *= ramp[::-1]
        ws = V.anchor_to_pauses(seg, V.match_script(line["text"].split(), V.whisper_words(seg, line["text"])))
        out.append((line, seg, ws))
    peak = max(np.abs(seg).max() for _, seg, _ in out)
    gain = 0.89 / peak if peak > 0 else 1.0

    os.makedirs(V.VO, exist_ok=True)
    mpath = os.path.join(V.VO, "manifest.json")
    manifest = {"lines": {}}
    for (line, seg, ws), a, b in zip(out, cuts[:-1], cuts[1:]):
        sf.write(os.path.join(V.VO, line["id"] + ".wav"), seg * gain, V.SR, subtype="PCM_16")
        json.dump(ws, open(os.path.join(V.VO, line["id"] + ".words.json"), "w"), indent=1)
        manifest["lines"][line["id"]] = {"engine": "recording", "voice": cfg.get("name", ""), "source": os.path.relpath(src, V.ROOT),
                                         "cut": [round(a, 3), round(b, 3)], "duration": round(len(seg) / V.SR, 3),
                                         "speech": [ws[0]["s"], ws[-1]["e"]]}
        print(f"{line['id']:4s} {a:6.2f}-{b:6.2f}  {len(seg) / V.SR:5.2f}s  " + " ".join(f"{w['w']}@{w['s']:.2f}" for w in ws))
    json.dump(manifest, open(mpath, "w"), indent=1)


if __name__ == "__main__":
    main()

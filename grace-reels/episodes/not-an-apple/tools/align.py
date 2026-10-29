"""Forced alignment of the known script against the original narration, one phrase at a
time, mapped onto the re-timed voice track. Writes src/data/words_aligned.json.

Run with a Python that has pocketsphinx installed:  python tools/align.py
"""
import json
import pathlib
import subprocess

from pocketsphinx import Decoder

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "audio" / "appleee_upload.mp3"
POST = 0.07

segments = json.loads((ROOT / "src/data/segments.json").read_text())
layout = json.loads((ROOT / "src/data/voice_layout.json").read_text())
tempo = layout["tempo"]
by_id = {s["id"]: s for s in layout["segments"]}

decoder = Decoder(samprate=16000, bestpath=False, loglevel="FATAL")
EXTRA = {"malum": "M AA L AH M", "thereof": "DH EH R AH V", "hath": "HH AE TH", "shalt": "SH AE L T", "yea": "Y EY"}
for word, phones in EXTRA.items():
    if decoder.lookup_word(word) is None:
        decoder.add_word(word, phones, True)


def vowels(w):
    groups, prev = 0, False
    for ch in w:
        v = ch in "aeiouy"
        groups += v and not prev
        prev = v
    return max(1, groups)


def proportional(words, start, end):
    weights = [vowels(w) + 0.5 for w in words]
    total, t, out = sum(weights), start, []
    for w, k in zip(words, weights):
        d = (end - start) * k / total
        out.append((w, t, t + d))
        t += d
    return out


results, fallbacks = [], []
for seg in segments:
    lay = by_id[seg["id"]]
    words = seg["spoken"].split()
    cut_end = seg["rawEnd"] + POST
    pcm = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{lay['cutStart']:.3f}", "-to", f"{cut_end:.3f}",
         "-i", str(SRC), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    aligned = None
    try:
        decoder.set_align_text(" ".join(words))
        decoder.start_utt()
        decoder.process_raw(pcm, full_utt=True)
        decoder.end_utt()
        got = [(s.word, s.start_frame / 100.0, (s.end_frame + 1) / 100.0) for s in decoder.seg() if s.word not in ("<s>", "</s>", "<sil>", "[NOISE]")]
        got = [(w.split("(")[0], a, b) for w, a, b in got]
        if [g[0] for g in got] == words:
            aligned = got
    except Exception as exc:  # noqa: BLE001 - any decoder failure falls back to proportional timing
        print("align error", seg["id"], exc)
    if aligned is None:
        fallbacks.append(seg["id"])
        rel0 = seg["rawStart"] - lay["cutStart"]
        aligned = proportional(words, rel0, rel0 + seg["rawEnd"] - seg["rawStart"])
    for w, a, b in aligned:
        results.append({"seg": seg["id"], "word": w,
                        "start": round(lay["clipStart"] + a / tempo, 4),
                        "end": round(lay["clipStart"] + b / tempo, 4)})

(ROOT / "src/data/words_aligned.json").write_text(json.dumps(results, indent=1))
print(f"{len(results)} words, proportional fallback for segments: {fallbacks}")

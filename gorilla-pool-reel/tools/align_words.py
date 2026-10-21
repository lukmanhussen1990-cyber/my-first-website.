#!/usr/bin/env python3
"""Word timings for each voice line, taken from the audio (faster-whisper),
then mapped onto the exact script words so subtitles always match the script.

Writes voice/timings.json: {lineId: {"duration": s, "words": [{"text","start","end"}]}}
(times relative to the start of that line's own audio file).
If voice/timings_elevenlabs.json exists for a line (exact timestamps from the
ElevenLabs API), that is used instead and whisper is skipped.
"""
import difflib, json, re, sys
from pathlib import Path
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent


def script_words(text):
    return text.split()


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def align(script_tokens, rec):
    """rec: list of (word, start, end) from ASR. Returns list of (start, end) per script token."""
    a = [norm(w) for w in script_tokens]
    b = [norm(w) for w, _, _ in rec]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    times = [None] * len(a)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (rec[j1 + k][1], rec[j1 + k][2])
        elif op == "replace" and j2 > j1:
            # spread the recognised span over the script span by character length
            s, e = rec[j1][1], rec[j2 - 1][2]
            lens = [max(1, len(a[i])) for i in range(i1, i2)]
            tot, acc = sum(lens), 0
            for k, i in enumerate(range(i1, i2)):
                ws = s + (e - s) * acc / tot
                acc += lens[k]
                times[i] = (ws, s + (e - s) * acc / tot)
    # fill anything still missing by interpolation
    for i in range(len(times)):
        if times[i] is None:
            prev_end = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev_end + 0.3)
            times[i] = (prev_end, max(prev_end + 0.05, nxt))
    return times


def main():
    script = json.loads((ROOT / "script" / "voiceover.json").read_text())
    exact = {}
    p11 = ROOT / "voice" / "timings_elevenlabs.json"
    if p11.exists():
        exact = json.loads(p11.read_text())
    model = None
    out = {}
    for line in script["lines"]:
        wav = ROOT / "voice" / f"{line['id']}.wav"
        dur = sf.info(str(wav)).duration
        toks = script_words(line["text"])
        if line["id"] in exact:
            rec = [(w["text"], w["start"], w["end"]) for w in exact[line["id"]]["words"]]
        else:
            if model is None:
                from faster_whisper import WhisperModel
                model = WhisperModel("small.en", device="cpu", compute_type="int8")
            audio, sr = sf.read(str(wav), dtype="float32", always_2d=True)
            from scipy.signal import resample_poly
            audio = resample_poly(audio.mean(axis=1), 16000, sr).astype("float32")
            segs, _ = model.transcribe(audio, language="en", word_timestamps=True,
                                       initial_prompt=line["text"], beam_size=5)
            rec = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
        times = align(toks, rec)
        out[line["id"]] = {"duration": dur, "words": [
            {"text": t, "start": round(s, 3), "end": round(e, 3)} for t, (s, e) in zip(toks, times)]}
        print(line["id"], " ".join(f"{t}@{s:.2f}" for t, (s, e) in zip(toks, times)))
        if [norm(w) for w, _, _ in rec] != [norm(t) for t in toks]:
            print("   (asr heard:", " ".join(w for w, _, _ in rec), ")")
    (ROOT / "voice" / "timings.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()

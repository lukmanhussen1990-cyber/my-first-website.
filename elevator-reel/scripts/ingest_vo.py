"""Ingest the user's voice-over: Whisper word timestamps, aligned to the script's word indices.

usage: /opt/venv_tools/bin/python ingest_vo.py <vo_audio_file>

writes
  /opt/work/elev/words.json     script-indexed timings (shot cuts in elev_shots.py are keyed to script word indices)
  /opt/work/elev/words_vo.json  the words actually spoken (captions are built from these)
  /opt/work/elev/vo.wav         the VO decoded unchanged (48 kHz) for the mix
"""
import sys, json, re, subprocess, difflib, time
import numpy as np

src = sys.argv[1]
t0 = time.time()
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "/opt/work/elev/vo16k.f32"], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ar", "48000", "/opt/work/elev/vo.wav"], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                           capture_output=True, text=True, check=True).stdout.strip())
script = open("/opt/work/elev/vo_script.txt").read().split()

from faster_whisper import WhisperModel
model = WhisperModel("medium.en", device="cpu", compute_type="int8", download_root="/opt/work/hf", cpu_threads=4)
audio = np.fromfile("/opt/work/elev/vo16k.f32", dtype=np.float32)
# no script prompt: Whisper treats a prompt as already-spoken text and skips it
segments, info = model.transcribe(audio, language="en", word_timestamps=True, beam_size=5, vad_filter=False,
                                  condition_on_previous_text=False)
vo = []
for s in segments:
    for w in s.words:
        vo.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
json.dump({"words": vo, "duration": dur}, open("/opt/work/elev/words_vo.json", "w"), indent=1)


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


a = [norm(w) for w in script]
b = [norm(w["word"]) for w in vo]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
m = {}
for blk in sm.get_matching_blocks():
    for k in range(blk.size):
        m[blk.a + k] = blk.b + k
# script-indexed timings; unmatched script words are interpolated between matched neighbours
out = []
for i, w in enumerate(script):
    if i in m:
        v = vo[m[i]]
        out.append({"word": w, "start": v["start"], "end": v["end"], "matched": True})
    else:
        out.append({"word": w, "start": None, "end": None, "matched": False})
known = [i for i, o in enumerate(out) if o["matched"]]
for i, o in enumerate(out):
    if o["matched"]:
        continue
    lo = max([k for k in known if k < i], default=None)
    hi = min([k for k in known if k > i], default=None)
    if lo is None and hi is None:
        t_a, t_b, n_a, n_b = 0.0, dur, -1, len(out)
    elif lo is None:
        t_a, t_b, n_a, n_b = 0.0, out[hi]["start"], -1, hi
    elif hi is None:
        t_a, t_b, n_a, n_b = out[lo]["end"], dur, lo, len(out)
    else:
        t_a, t_b, n_a, n_b = out[lo]["end"], out[hi]["start"], lo, hi
    frac = (i - n_a) / (n_b - n_a)
    o["start"] = round(t_a + (t_b - t_a) * frac, 3)
    o["end"] = round(o["start"] + 0.2, 3)
json.dump({"words": out, "duration": dur, "estimated": False}, open("/opt/work/elev/words.json", "w"), indent=1)
print("VO", src, "dur", round(dur, 2), "vo words", len(vo), "script words", len(script), "matched", len(known),
      "ratio", round(sm.ratio(), 3), "took", round(time.time() - t0, 1))
print("TRANSCRIPT:", " ".join(w["word"] for w in vo))

"""Measure the final mix since nobody here can listen: speech intelligibility (ASR on mix vs dry voice),
spectrum sanity (subsonic/DC, harsh narrow peaks) and the loop seam. Adds a "verify" block to mix_report.json.

  python3 tools/audio/verify_mix.py --episode the-mountain
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("--episode", default="the-mountain")
args = ap.parse_args()
root = Path(__file__).resolve().parents[2]
ep = root / "episodes" / args.episode
audio = ep / "audio"
timeline = json.loads((ep / "timeline.json").read_text())


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


NUM = {"2000": ["two", "thousand"], "3": ["three"], "2": ["two"]}


def words_of(text):
    out = []
    for w in text.split():
        n = norm(w)
        out.extend(NUM.get(n, [n] if n else []))
    return out


def accuracy(ref, hyp):
    d = np.zeros((len(ref) + 1, len(hyp) + 1), dtype=np.int32)
    d[:, 0] = np.arange(len(ref) + 1)
    d[0, :] = np.arange(len(hyp) + 1)
    for i in range(1, len(ref) + 1):
        for j in range(1, len(hyp) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]))
    return 1 - d[-1, -1] / max(1, len(ref))


def mono16k(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    m = torch.from_numpy(x.mean(1))
    return torchaudio.functional.resample(m, sr, 16000).numpy(), x, sr


asr = WhisperModel("small.en", device="cpu", compute_type="int8")
ref = words_of(" ".join(w["text"] for w in timeline["words"]))
result = {}
for name in ["voice.wav", "final_mix.wav"]:
    a16, _, _ = mono16k(audio / name)
    segs, _ = asr.transcribe(a16, beam_size=5, language="en", condition_on_previous_text=False)
    hyp = words_of(" ".join(s.text for s in segs))
    result[name] = {"wordAccuracy": round(float(accuracy(ref, hyp)), 4), "heardWords": len(hyp)}

# spectrum: Welch average of the mix
_, x, sr = mono16k(audio / "final_mix.wav")
m = x.mean(1)
seg = 8192
win = np.hanning(seg)
spec = np.zeros(seg // 2 + 1)
for s in range(0, len(m) - seg, seg // 2):
    spec += np.abs(np.fft.rfft(m[s:s + seg] * win)) ** 2
spec_db = 10 * np.log10(spec / spec.max() + 1e-20)
freqs = np.fft.rfftfreq(seg, 1 / sr)
band = lambda a, b: float(10 * np.log10(spec[(freqs >= a) & (freqs < b)].sum() / spec.sum() + 1e-20))
peaks = []
for k in np.where((freqs > 1000) & (freqs < 16000))[0]:
    lo, hi = max(0, k - 40), min(len(spec_db), k + 40)
    local = np.median(spec_db[lo:hi])
    if spec_db[k] - local > 12 and spec_db[k] == spec_db[max(0, k - 3):k + 4].max():
        peaks.append((round(float(freqs[k])), round(float(spec_db[k] - local), 1)))
peaks.sort(key=lambda p: -p[1])

# loop seam: level and sample continuity across the wrap
n = int(0.5 * sr)
seam = {
    "lastHalfSecondDbfs": round(float(20 * np.log10(np.sqrt((x[-n:] ** 2).mean()) + 1e-12)), 1),
    "firstHalfSecondDbfs": round(float(20 * np.log10(np.sqrt((x[:n] ** 2).mean()) + 1e-12)), 1),
    "jumpAtWrap": round(float(np.abs(x[0] - x[-1]).max()), 4),
    "typicalStep": round(float(np.percentile(np.abs(np.diff(x[:, 0])), 99)), 4),
}

verify = {
    "asr": result,
    "intelligibilityDrop": round(result["voice.wav"]["wordAccuracy"] - result["final_mix.wav"]["wordAccuracy"], 4),
    "spectrum": {
        "below20HzShareDb": band(0, 20), "20to60HzShareDb": band(20, 60), "2to6kHzShareDb": band(2000, 6000),
        "above12kHzShareDb": band(12000, sr / 2), "narrowPeaks1to16kHz": peaks[:8],
    },
    "loopSeam": seam,
}
report_path = audio / "mix_report.json"
report = json.loads(report_path.read_text()) if report_path.exists() else {}
report["verify"] = verify
report_path.write_text(json.dumps(report, indent=2))
print(json.dumps(verify, indent=1))

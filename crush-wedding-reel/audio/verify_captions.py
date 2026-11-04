# Re-transcribe the FINAL video's audio with faster-whisper (local) and compare every caption
# word's on-screen time with the spoken word time.
import json, re, subprocess, sys, difflib
import numpy as np
from faster_whisper import WhisperModel

video, story = sys.argv[1], sys.argv[2]
FPS = 30
src = open(story).read()
block = src[src.index('export const CAPTIONS'):src.index('];', src.index('export const CAPTIONS'))]
cap = [(w1 or w2, float(s), float(e)) for w1, w2, s, e in re.findall(r"\[\s*(?:\"([^\"]+)\"|'([^']+)')\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\]", block)]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32).copy()
m = WhisperModel("medium.en", device="cpu", compute_type="int8", cpu_threads=4)
segs, _ = m.transcribe(audio, word_timestamps=True, language="en", beam_size=5, condition_on_previous_text=False)
heard = []
for s in segs:
    for w in s.words:
        # split tokens like "looks...fine." into separate words
        parts = [p for p in re.split(r'(?<=\.\.\.)(?=\w)', w.word.strip()) if p]
        for k, p in enumerate(parts):
            st = w.start
            if k > 0:
                seg_ = audio[int(w.start * 16000):int(w.end * 16000)]
                fr = np.sqrt(np.convolve(seg_ ** 2, np.ones(160) / 160, 'valid'))[::160]
                thr = fr.max() * 0.08; quiet = np.where(fr < thr)[0]
                gap_end = [i for i in range(1, len(fr)) if fr[i] >= thr and fr[i - 1] < thr]
                if gap_end: st = w.start + gap_end[-1] * 0.01
            heard.append((p, st, w.end))
norm = lambda x: re.sub(r"[^a-z']", "", x.lower())
a = [norm(w) for w, _, _ in cap]; b = [norm(w) for w, _, _ in heard]
sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
rows, diffs = [], []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1):
            cw, cs, ce = cap[i1 + k]; hw, hs, he = heard[j1 + k]
            shown = np.ceil(cs * FPS - 1e-6) / FPS  # first frame where the word is on screen
            d = shown - hs; diffs.append(d)
            rows.append(f"{cw:>12s}  caption {shown:6.2f}s  voice {hs:6.2f}s  diff {d*1000:+5.0f} ms")
    else:
        rows.append(f"MISMATCH {tag}: caption {[c[0] for c in cap[i1:i2]]} vs heard {[h[0] for h in heard[j1:j2]]}")
print("\n".join(rows))
d = np.abs(np.array(diffs))
print(f"\nwords matched: {len(diffs)}/{len(cap)} caption words, {len(heard)} heard words")
print(f"timing |diff|: mean {d.mean()*1000:.0f} ms, median {np.median(d)*1000:.0f} ms, max {d.max()*1000:.0f} ms, within 150 ms: {(d<=0.15).mean()*100:.0f}%")
print("caption text == spoken text (ignoring punctuation/case):", a == b)

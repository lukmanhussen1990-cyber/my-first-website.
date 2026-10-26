#!/usr/bin/env python3
"""QC for the THE OLDEST MAN soundtrack (run after `npm run audio`, from the project root).

  python3 audio/qc.py            levels per shot, ducking, near silence, loop seam, spectrogram PNGs
  python3 audio/qc.py --words    + faster-whisper word check on audio/final_mix.wav: the same model,
                                 prompt and matching window as voice/verify.py, but numbers are compared
                                 as numbers ("187" == "one hundred eighty-seven"), and the raw voice is
                                 scored the same way for reference

Writes audio/qc/spectrogram.png (final mix, log frequency, event markers) and audio/qc/stems.png
(voice / music / sfx). Needs numpy, scipy, PIL (no matplotlib)."""
import json, re, subprocess, sys, os
import numpy as np
from scipy import signal
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SR = 48000


def load(path, ch=None):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-"], capture_output=True, check=True).stdout
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=channels,sample_rate", "-of", "json", path], capture_output=True, check=True).stdout)["streams"][0]
    x = np.frombuffer(pcm, dtype=np.float32).reshape(-1, int(info["channels"]))
    return x


cs = json.load(open(P("audio", "cuesheet.json")))
ev = cs["events"]
T = json.load(open(P("timeline.json")))
dur, N = cs["duration"], cs["samples"]

mix = load(P("audio", "final_mix.wav"))
music = load(P("audio", "stems", "music.wav"))
sfx = load(P("audio", "stems", "sfx.wav"))
voice = load(P("voice", "voice.wav"))[:, 0]
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
duck = load(P("audio", "stems", "duck_music_gain.wav"))[:, 0]

# ---------------------------------------------------------------- K-weighted loudness helpers (BS.1770)
b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
def kms(x):  # per-sample K-weighted power (sum over channels)
    x = x if x.ndim == 2 else x[:, None]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    return (y.astype(np.float64) ** 2).sum(axis=1)
def lufs(pw, a, b):
    i0, i1 = int(a * SR), int(b * SR)
    return -0.691 + 10 * np.log10(pw[i0:i1].mean() + 1e-20)

pv, pm, ps, px = kms(np.stack([voice, voice], 1)), kms(music), kms(sfx), kms(mix)

print(f"final_mix: {len(mix)} samples = {len(mix)/SR:.4f} s (plan {dur} s, diff {abs(len(mix)/SR-dur)*1000:.2f} ms)  cuesheet: I {cs['lufs']} LUFS, TP {cs['truePeak']} dBTP")
eb = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", P("audio", "final_mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
s = eb[eb.rfind("Summary:"):]
print("ebur128:", " | ".join(l.strip() for l in s.splitlines() if re.search(r"I:|Peak:|LRA:", l)))

# ---------------------------------------------------------------- levels per shot (K-weighted mean power, pre-master scale)
words = T["words"]
speech = np.zeros(N, bool)
for w in words: speech[int(w["start"] * SR):int(w["end"] * SR)] = True
print("\nlevels per shot (LUFS-ish, pre-master): voice-in-words | music under words / in gaps | sfx under words / in gaps | music-vs-voice")
print(f"{'shot':6} {'t0':>6} {'t1':>6} {'voice':>6} {'mus/w':>6} {'mus/g':>6} {'sfx/w':>6} {'sfx/g':>6} {'M-V':>6}")
SH = [(x["id"], x["t0"], x["t1"]) for x in cs["shots"]]
def mlufs(pw, a, b, mask):
    i0, i1 = int(a * SR), int(b * SR); m = mask[i0:i1]
    if m.sum() < SR * 0.2: return float("nan")
    return -0.691 + 10 * np.log10(pw[i0:i1][m].mean() + 1e-20)
for sid, a, b in SH:
    v = mlufs(pv, a, b, speech); mw = mlufs(pm, a, b, speech); mg = mlufs(pm, a, b, ~speech); sw = mlufs(ps, a, b, speech); sg = mlufs(ps, a, b, ~speech)
    print(f"{sid:6} {a:6.2f} {b:6.2f} {v:6.1f} {mw:6.1f} {mg:6.1f} {sw:6.1f} {sg:6.1f} {mw - v:6.1f}")

# ---------------------------------------------------------------- ducking
gdb = 20 * np.log10(np.maximum(duck, 1e-6))
inw = gdb[speech]
print(f"\nducking: music gain inside words: median {np.median(inw):.1f} dB, p10 {np.percentile(inw, 10):.1f} dB; in long gaps (>0.6 s from speech): ", end="")
far = np.convolve(speech.astype(float), np.ones(int(0.6 * SR)), 'same') == 0
print(f"median {np.median(gdb[far]):.2f} dB")
# word onsets after a pause of >= 0.35 s: duck gain 120 ms before, at the onset, 100 ms after
pre = []
for k, w in enumerate(words):
    if k and w["start"] - words[k - 1]["end"] < 0.35: continue
    i = int(w["start"] * SR)
    pre.append((w["start"], gdb[max(0, i - int(0.12 * SR))], gdb[i], gdb[min(N - 1, i + int(0.1 * SR))]))
pre = np.array(pre)
print(f"  {len(pre)} phrase onsets: gain 120 ms before = {np.median(pre[:,1]):.1f} dB (median), at the word = {np.median(pre[:,2]):.1f} dB, +100 ms = {np.median(pre[:,3]):.1f} dB")
# where does the dip start? for phrases after a gap >= 0.8 s: last moment before the onset at which the
# music gain was still within 0.5 dB of its level in the gap
leads = []
for k, w in enumerate(words):
    if not k or w["start"] - words[k - 1]["end"] < 0.8: continue
    i = int(w["start"] * SR); g0 = gdb[int(words[k - 1]["end"] * SR) + int(0.6 * SR):i].max(); j = i
    while j > 0 and gdb[j] < g0 - 0.5: j -= 1
    leads.append((i - j) / SR)
print(f"  {len(leads)} phrases after gaps >= 0.8 s: the dip starts {np.median(leads)*1000:.0f} ms before the word (median; min {min(leads)*1000:.0f}, max {max(leads)*1000:.0f}) and reaches "
      f"{np.median([gdb[int(w['start']*SR)] for k, w in enumerate(words) if k and w['start'] - words[k-1]['end'] >= 0.8]):.1f} dB at the word onset")

# ---------------------------------------------------------------- near silence + loop seam
def rms_db(x, a, b): i0, i1 = int(a * SR), int(b * SR); return 10 * np.log10((x[i0:i1].astype(np.float64) ** 2).mean() + 1e-30)
ref = rms_db(music, ev["lampOut"] - 3, ev["lampOut"])
print(f"\nnear silence {ev['silence']:.2f}-{ev['dropSplash']:.2f}: music {rms_db(music, ev['silence'], ev['dropSplash']) - ref:.1f} dB re the 3 s before lampOut; "
      f"music {rms_db(music, ev['silence'], ev['dropSplash']) - rms_db(music, 0, dur):.1f} dB re its whole-reel RMS; "
      f"sfx {rms_db(sfx, ev['silence'], ev['dropFall']):.1f} dBFS in {ev['silence']:.2f}-{ev['dropFall']:.2f}; mix {rms_db(mix, ev['silence'], ev['dropFall']):.1f} dBFS")
seamA, seamB = rms_db(mix, dur - 0.3, dur - 0.03), rms_db(mix, 0.008, 0.11)
print(f"loop seam: mix RMS last 0.27 s = {seamA:.1f} dBFS, first 0.1 s = {seamB:.1f} dBFS (diff {seamB - seamA:+.1f} dB)")
for nm_, st in (("music", music), ("sfx", sfx)):
    print(f"  {nm_}: end {rms_db(st, dur - 0.3, dur - 0.03):.1f} / start {rms_db(st, 0.008, 0.11):.1f} dBFS")

# ---------------------------------------------------------------- spectrograms
def spec_img(x, w=2400, h=420, fmin=30, fmax=16000, floor=-100, top=None):
    x = x.mean(axis=1) if x.ndim == 2 else x
    f, t, Z = signal.stft(x, SR, nperseg=4096, noverlap=4096 - 1024)
    S = 20 * np.log10(np.abs(Z) + 1e-9)
    top = S.max() if top is None else top
    ly = np.linspace(np.log10(fmin), np.log10(fmax), h)[::-1]
    fi = np.clip(np.searchsorted(f, 10 ** ly), 1, len(f) - 1)
    ti = np.clip((np.linspace(0, len(x) / SR, w) / (t[1] - t[0])).astype(int), 0, len(t) - 1)
    A = S[fi][:, ti]
    u = np.clip((A - floor) / (top - floor), 0, 1)
    stops = np.array([[0, 0, 4], [40, 12, 90], [120, 28, 120], [200, 60, 80], [250, 140, 40], [252, 230, 150]], float)
    pos = np.linspace(0, 1, len(stops))
    rgb = np.stack([np.interp(u, pos, stops[:, c]) for c in range(3)], -1).astype(np.uint8)
    return Image.fromarray(rgb), (fmin, fmax)

def axis(img, label, fmin, fmax, marks=True):
    w, h = img.size
    canvas = Image.new("RGB", (w + 60, h + (40 if marks else 18)), (16, 16, 18))
    canvas.paste(img, (60, 18)); d = ImageDraw.Draw(canvas)
    d.text((64, 2), label, fill=(230, 230, 230))
    for fhz in (50, 100, 200, 500, 1000, 2000, 5000, 10000):
        y = 18 + int((1 - (np.log10(fhz) - np.log10(fmin)) / (np.log10(fmax) - np.log10(fmin))) * h)
        d.line([(55, y), (60, y)], fill=(200, 200, 200)); d.text((2, y - 6), f"{fhz/1000:g}k" if fhz >= 1000 else str(fhz), fill=(200, 200, 200))
    for s in range(0, int(dur) + 1, 5):
        x = 60 + int(s / dur * w); d.line([(x, 18 + h), (x, 18 + h + 5)], fill=(200, 200, 200)); d.text((x + 2, 18 + h + 4), f"{s}s", fill=(200, 200, 200))
    return canvas

os.makedirs(P("audio", "qc"), exist_ok=True)
img, (fmin, fmax) = spec_img(mix)
can = axis(img, "final_mix.wav (log f) with plan events", fmin, fmax)
d = ImageDraw.Draw(can)
W_ = img.size[0]
mk = ["hookHit", "ribbon", "enochGone", "timeline", "n187", "n182", "n600", "slam", "lampOut", "silence", "dropSplash", "thunderFar", "card320", "floodCrack", "city", "warmLight", "cta", "hourglass", "endCard", "loopBack"]
for k, name in enumerate(mk):
    x = 60 + int(ev[name] / dur * W_)
    d.line([(x, 18), (x, 18 + img.size[1])], fill=(120, 220, 255), width=1)
    d.text((x + 2, 20 + (k % 4) * 11), name, fill=(150, 235, 255))
can.save(P("audio", "qc", "spectrogram.png"))
rows = []
for nm_, x in (("voice", voice), ("music stem (post-duck)", music), ("sfx stem (post-duck)", sfx)):
    im, _ = spec_img(x, w=2400, h=200, top=-10)
    rows.append(axis(im, nm_, fmin, fmax))
H = sum(r.size[1] for r in rows); out = Image.new("RGB", (rows[0].size[0], H), (16, 16, 18)); y = 0
for r in rows: out.paste(r, (0, y)); y += r.size[1]
out.save(P("audio", "qc", "stems.png"))
print("\nwrote audio/qc/spectrogram.png, audio/qc/stems.png")

# ---------------------------------------------------------------- words (faster-whisper, numbers compared as numbers)
if "--words" in sys.argv:
    from faster_whisper import WhisperModel
    ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
    TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
    def spell(n):
        n = int(n)
        if n < 20: return ONES[n]
        if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else ONES[n % 10])
        return ONES[n // 100] + "hundred" + ("" if n % 100 == 0 else spell(n % 100))
    norm = lambda s: re.sub(r"\d+", lambda m: spell(m.group()), re.sub(r"[^a-z0-9']", "", s.lower()))
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    def score(path):
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        segs, _ = m.transcribe(np.frombuffer(pcm, dtype=np.float32), word_timestamps=True, initial_prompt="doth deviseth speaketh soweth brethren commendeth unrighteousness")
        heard = [(w.start, norm(w.word)) for s_ in segs for w in s_.words]
        exp = [(w["start"], norm(w["spoken"])) for w in T["words"]]
        diffs, miss, hi = [], [], 0
        for es, ew in exp:
            hit = None
            for j in range(max(0, hi - 3), min(len(heard), hi + 6)):
                hw = heard[j][1]
                if hw == ew or (len(ew) > 3 and hw[:4] == ew[:4]): hit = j; break
            if hit is None: miss.append((round(es, 2), ew)); continue
            diffs.append(heard[hit][0] - es); hi = hit + 1
        d_ = np.array(diffs)
        print(f"{os.path.relpath(path, ROOT)}: matched {len(d_)}/{len(exp)} words (numbers normalised); onset diff median {np.median(d_)*1000:.0f} ms, p90 |diff| {np.percentile(np.abs(d_),90)*1000:.0f} ms; not matched: {miss}")
        return len(d_)
    print()
    score(P("voice", "voice.wav")); score(P("audio", "final_mix.wav"))

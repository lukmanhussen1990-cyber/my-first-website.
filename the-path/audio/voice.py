"""Voice-over analysis and editing helpers (NumPy only).

  decode(path)              any audio file -> float64 mono at 48 kHz (FFmpeg, SoX resampler)
  envelope(x)               10 ms RMS level on a 2.5 ms hop, with the take's noise floor
  align(x, words)           Scribe word times snapped to the waveform (onset, nucleus, end)
  pauses(env, words)        silences between words and what is inside them (breaths, clicks)
  f0_track(x)               YIN pitch track
  stft_db(x)                log-magnitude STFT for review images and the glitch scan
  discontinuities(x, env)   spectral jumps inside steady speech (possible TTS glitches)
  clicks(x, env)            AR-residual click detector
  room_tone(x, ranges)      the quietest steady stretch of the take, for gap fills
  splice_point(x, t, ...)   nearest low-level zero crossing for a cut

Times are seconds in the take's own clock; levels are dBFS (RMS).
"""

from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

SR = 48000
HOP = 120   # 2.5 ms
WIN = 480   # 10 ms
SPEECH_DB = 10.0   # a frame is speech when it is this far above the noise floor


def decode(path: str | Path, sr: int = SR) -> np.ndarray:
    """Decode with FFmpeg (gapless MP3 trimming honoured) and resample with SoX at 28-bit precision."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1",
           "-af", f"aresample={sr}:resampler=soxr:precision=28", "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").astype(np.float64)


# ----------------------------------------------------------------- envelope

@dataclass
class Envelope:
    db: np.ndarray      # RMS level per frame (frame k is centred on sample k * hop)
    floor: float        # noise floor: 10th percentile of all frames
    hop: int = HOP
    sr: int = SR

    def t(self, k):
        return np.asarray(k) * self.hop / self.sr

    def k(self, t: float) -> int:
        return int(np.clip(round(t * self.sr / self.hop), 0, len(self.db) - 1))

    @property
    def speech(self) -> np.ndarray:
        return self.db > self.floor + SPEECH_DB


def _windowed_power(x: np.ndarray, hop: int, win: int) -> np.ndarray:
    c = np.concatenate([[0.0], np.cumsum(x * x)])
    centres = np.arange(0, len(x), hop)
    a = np.clip(centres - win // 2, 0, len(x))
    b = np.clip(centres + win // 2, 0, len(x))
    return (c[b] - c[a]) / np.maximum(b - a, 1)


def envelope(x: np.ndarray, sr: int = SR, hop: int = HOP, win: int = WIN) -> Envelope:
    db = 10 * np.log10(_windowed_power(x, hop, win) + 1e-14)
    return Envelope(db, float(np.percentile(db, 10)), hop, sr)


def band(x: np.ndarray, lo: float, hi: float, sr: int = SR) -> np.ndarray:
    """Zero-phase brick-ish band-pass (raised-cosine edges) in the frequency domain."""
    n = len(x)
    m = 1 << (n - 1).bit_length()
    f = np.fft.rfftfreq(m, 1 / sr)
    w = np.clip((f - lo * 0.8) / (lo * 0.2 + 1e-9), 0, 1) * np.clip((hi * 1.2 - f) / (hi * 0.2), 0, 1)
    w = 0.5 - 0.5 * np.cos(np.pi * w)
    return np.fft.irfft(np.fft.rfft(x, m) * w, m)[:n]


def runs(mask: np.ndarray):
    """(start, stop) index pairs of the True runs of a boolean array."""
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


# ---------------------------------------------------------------- alignment

@dataclass
class Word:
    text: str
    scribe_start: float
    scribe_end: float
    onset: float = 0.0      # acoustic start (first frame SPEECH_DB above the floor)
    nucleus: float = 0.0    # first vowel onset: voiced-band energy within 10 dB of the word's peak
    end: float = 0.0        # acoustic end
    peak_db: float = -math.inf
    pause_before: float = 0.0   # measured silence between the previous word and this one

    def as_dict(self):
        return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in self.__dict__.items()}


def silence_runs(env: Envelope, blip: float = 0.03):
    """Silence runs in seconds, merged across blips shorter than `blip` (lip contacts,
    plosive releases).  Each item: [t0, t1, [(blip_t0, blip_t1), ...]]."""
    out = []
    for a, b in runs(~env.speech):
        t0, t1 = float(env.t(a)), float(env.t(b))
        if out and t0 - out[-1][1] < blip:
            out[-1][2].append((out[-1][1], t0))
            out[-1][1] = t1
        else:
            out.append([t0, t1, []])
    return out


def align(x: np.ndarray, scribe_words: list[dict], env: Envelope | None = None,
          min_gap: float = 0.02, release: float = 0.15, pre_onset: float = 0.03) -> list[Word]:
    """Snap Scribe's word times (40 ms grid) to the waveform.

    Between two words the boundary is the longest silence (>= min_gap, blips merged)
    that overlaps Scribe's own gap +/- 40 ms; the earlier word keeps any release burst
    in the first `release` s of that silence, and a burst ending within `pre_onset` s
    of the next word belongs to that word (the release of a voiced stop such as the d
    of 'Duolingo').  With no such silence the words are
    joined at the level minimum inside Scribe's gap.  Using only Scribe's gap keeps
    stop closures inside a word (the t in 'streak', the k in 'skill') from being
    mistaken for a pause.  The nucleus uses the 250-2500 Hz band so that fricative
    and plosive onsets (f, s, ch, t) do not count as the vowel."""
    env = env or envelope(x)
    voiced = envelope(band(x, 250, 2500))
    sil = [r for r in silence_runs(env) if r[1] - r[0] >= min_gap]
    words = [Word(w["text"], float(w["start"]), float(w["end"])) for w in scribe_words if w.get("type", "word") == "word"]
    n = len(words)
    starts, ends = [0.0] * n, [0.0] * n

    long_speech = [(float(env.t(a)), float(env.t(b))) for a, b in runs(env.speech) if (b - a) * env.hop / env.sr >= 0.03]
    starts[0] = next(t0 for t0, t1 in long_speech if t1 > words[0].scribe_start - 0.3)
    ends[-1] = [t1 for t0, t1 in long_speech if t0 < words[-1].scribe_end + 0.3][-1]

    smooth = np.convolve(env.db, np.ones(5) / 5, "same")
    for i in range(n - 1):
        a, b = words[i].scribe_end, words[i + 1].scribe_start
        lo, hi = max(min(a, b) - 0.04, starts[i] + 0.03), max(a, b) + 0.04
        # only silences that begin after this word has started (never reuse the previous boundary)
        cands = [r for r in sil if r[1] >= lo and r[0] <= hi and r[0] >= starts[i] + 0.02]
        if cands:
            t0, t1, blips = max(cands, key=lambda r: r[1] - r[0])
            rel = [b1 for b0, b1 in blips if b0 - t0 <= release]
            pre = [b0 for b0, b1 in blips if t1 - b1 <= pre_onset and b0 > (max(rel) if rel else t0)]
            ends[i], starts[i + 1] = (max(rel) if rel else t0), (min(pre) if pre else t1)
        else:
            j0, j1 = env.k(lo), max(env.k(hi), env.k(lo) + 1)
            kmin = j0 + int(np.argmin(smooth[j0:j1 + 1]))
            ends[i] = starts[i + 1] = float(env.t(kmin))

    for i, w in enumerate(words):
        w.onset, w.end = starts[i], ends[i]
        w.pause_before = 0.0 if i == 0 else max(0.0, starts[i] - ends[i - 1])
        k0, k1 = env.k(w.onset), max(env.k(w.end), env.k(w.onset) + 1)
        w.peak_db = float(env.db[k0:k1 + 1].max())
        v = voiced.db[k0:k1 + 1]
        hit = np.where(v >= v.max() - 10.0)[0]
        w.nucleus = float(env.t(k0 + hit[0])) if len(hit) else w.onset
    return words


# ------------------------------------------------------------------- pauses

@dataclass
class Pause:
    after: str              # word before the pause
    before: str             # word after the pause
    index: int              # index of the word after the pause
    t0: float               # end of the previous word
    t1: float               # onset of the next word
    safe0: float = 0.0      # replaceable region: after the previous word's tail ...
    safe1: float = 0.0      # ... and before the next word's lead-in (inhale, lip noise)
    events: list = field(default_factory=list)   # (kind, t0, t1, peak_db) inside the pause

    @property
    def length(self):
        return self.t1 - self.t0


def pauses(x: np.ndarray, words: list[Word], env: Envelope | None = None, min_len: float = 0.08,
           margin: float = 0.01) -> list[Pause]:
    """Silences >= min_len between words.  Sounds inside that rise 6 dB above the floor
    are reported: 'tail' (starting within 80 ms of the previous word: decay, release
    burst), 'lead-in' (ending within 80 ms of the next word: inhale, lip noise),
    'click' (< 30 ms) or 'breath/noise'.  The safe region runs from the end of the last
    tail to the start of the first lead-in (10 ms margins): an edit may replace it with
    room tone, which also removes any stray click or noise inside it."""
    env = env or envelope(x)
    out = []
    for i in range(1, len(words)):
        t0, t1 = words[i - 1].end, words[i].onset
        if t1 - t0 < min_len:
            continue
        p = Pause(words[i - 1].text, words[i].text, i, t0, t1)
        k0, k1 = env.k(t0), env.k(t1)
        seg = env.db[k0 + 2:k1 - 1]
        for r0, r1 in runs(seg > env.floor + 6.0):
            a, b = float(env.t(k0 + 2 + r0)), float(env.t(k0 + 2 + r1))
            if b - a < 0.005:
                continue
            kind = ("tail" if a - t0 < 0.08 else "lead-in" if t1 - b < 0.08
                    else "click" if b - a < 0.03 else "breath/noise")
            p.events.append((kind, round(a, 4), round(b, 4), round(float(seg[r0:r1].max()), 1)))
        tails = [e[2] for e in p.events if e[0] == "tail"]
        leads = [e[1] for e in p.events if e[0] == "lead-in"]
        p.safe0 = (max(tails) if tails else t0) + margin
        p.safe1 = (min(leads) if leads else t1) - margin
        if p.safe1 < p.safe0:
            p.safe0 = p.safe1 = (p.safe0 + p.safe1) / 2
        out.append(p)
    return out


# -------------------------------------------------------------------- pitch

def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    n_out = int(round(len(x) * sr_out / sr_in))
    X = np.fft.rfft(x)
    m = n_out // 2 + 1
    Y = np.zeros(m, complex)
    k = min(m, len(X))
    Y[:k] = X[:k]
    return np.fft.irfft(Y, n_out) * (n_out / len(x))


def f0_track(x: np.ndarray, sr: int = SR, fmin: float = 110.0, fmax: float = 600.0,
             hop_s: float = 0.005, win_s: float = 0.03, threshold: float = 0.15):
    """YIN (cumulative-mean-normalised difference) at 16 kHz.  Returns (times, f0_hz)
    with NaN where unvoiced."""
    fs = 16000
    y = resample(x, sr, fs)
    W = int(win_s * fs)
    tmin, tmax = int(fs / fmax), int(fs / fmin) + 1
    hop = int(hop_s * fs)
    nfr = max(0, (len(y) - W - tmax) // hop)
    idx = np.arange(nfr)[:, None] * hop + np.arange(W + tmax)[None, :]
    F = y[idx]
    d = np.zeros((nfr, tmax + 1))
    base = F[:, :W]
    for tau in range(1, tmax + 1):
        diff = base - F[:, tau:tau + W]
        d[:, tau] = np.einsum("ij,ij->i", diff, diff)
    cm = np.cumsum(d[:, 1:], axis=1) / np.arange(1, tmax + 1)
    dn = np.ones_like(d)
    dn[:, 1:] = d[:, 1:] / np.maximum(cm, 1e-12)
    f0 = np.full(nfr, np.nan)
    energy = np.einsum("ij,ij->i", base, base) / W
    edb = 10 * np.log10(energy + 1e-14)
    gate = np.percentile(edb, 10) + 15
    for i in range(nfr):
        if edb[i] < gate:
            continue
        row = dn[i]
        cand = np.where(row[tmin:tmax] < threshold)[0]
        if not len(cand):
            continue
        t = tmin + cand[0]
        while t + 1 < tmax and row[t + 1] < row[t]:
            t += 1
        a, b, c = row[t - 1], row[t], row[t + 1] if t + 1 <= tmax else row[t]
        den = a - 2 * b + c
        shift = 0.5 * (a - c) / den if abs(den) > 1e-12 else 0.0
        f0[i] = fs / (t + shift)
    times = (np.arange(nfr) * hop + W / 2) / fs
    return times, f0


def semitones(f, ref: float = 440.0):
    return 12 * np.log2(np.asarray(f) / ref)


# --------------------------------------------------------------- spectrum

def stft_db(x: np.ndarray, n: int = 1024, hop: int = 240) -> np.ndarray:
    """Frames x bins log magnitude (Hann); frame j is centred on sample j * hop."""
    w = np.hanning(n)
    pad = np.concatenate([np.zeros(n // 2), x, np.zeros(n)])
    k = (len(pad) - n) // hop
    idx = np.arange(k)[:, None] * hop + np.arange(n)[None, :]
    return 20 * np.log10(np.abs(np.fft.rfft(pad[idx] * w, axis=1)) + 1e-9)


def discontinuities(x: np.ndarray, env: Envelope, sr: int = SR, z: float = 6.0):
    """Spectral flux in log-spaced bands (100 Hz - 14 kHz, about 35) on a 5 ms hop.  A jump is
    flagged when the spectral shape changes abnormally while the overall level stays
    within 4 dB: onsets and offsets change the level, a vocoder glitch or bad splice
    changes the shape without it.  Returns [(t, score)]."""
    hop = 240
    S = stft_db(x, 1024, hop)
    df = sr / 1024
    edges = np.unique(np.round(np.geomspace(100, 14000, 41) / df).astype(int))
    B = np.stack([S[:, a:b].mean(axis=1) for a, b in zip(edges[:-1], edges[1:])], axis=1)
    lvl = B.mean(axis=1, keepdims=True)
    shape = B - lvl
    flux = np.sqrt(np.mean(np.diff(shape, axis=0) ** 2, axis=1))
    dl = np.abs(np.diff(lvl[:, 0]))
    t = (np.arange(1, len(B)) * hop) / sr
    speech = np.array([env.speech[env.k(tt)] for tt in t])
    ref = flux[speech]
    med = np.median(ref)
    mad = np.median(np.abs(ref - med)) * 1.4826 + 1e-9
    score = (flux - med) / mad
    flags = np.where(speech & (score > z) & (dl < 4.0))[0]
    out = []
    for r0, r1 in runs(np.isin(np.arange(len(t)), flags)):
        j = r0 + int(np.argmax(score[r0:r1]))
        out.append((round(float(t[j]), 4), round(float(score[j]), 1)))
    return out


def clicks(x: np.ndarray, env: Envelope, sr: int = SR, order: int = 16, frame: float = 0.02, k: float = 9.0):
    """Short-term linear prediction (Levinson-Durbin per 20 ms frame); a click is a
    residual sample k times the frame's robust residual level.  Returns [(t, ratio_db)]."""
    n = int(frame * sr)
    out = []
    for s0 in range(order, len(x) - n, n):
        seg = x[s0 - order:s0 + n]
        if 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12) < env.floor + 3:
            continue
        r = np.correlate(seg, seg, "full")[len(seg) - 1:len(seg) + order]
        a = np.zeros(order + 1)
        a[0], e = 1.0, r[0] * (1 + 1e-9)
        for i in range(1, order + 1):
            acc = r[i] + np.dot(a[1:i], r[i - 1:0:-1])
            g = -acc / e
            a[1:i] = a[1:i] + g * a[i - 1:0:-1]
            a[i] = g
            e *= 1 - g * g
        res = np.convolve(seg, a, "valid")[: n]
        mad = np.median(np.abs(res)) * 1.4826 + 1e-12
        j = int(np.argmax(np.abs(res)))
        ratio = abs(res[j]) / mad
        if ratio > k:
            out.append((round((s0 + j) / sr, 4), round(20 * math.log10(ratio), 1)))
    return out


# --------------------------------------------------------- room tone, cuts

def room_tone(x: np.ndarray, ranges, sr: int = SR, length: float = 0.25):
    """Quietest, steadiest `length` window inside the given (t0, t1) ranges.  Returns
    (t0, t1, rms_db, flatness_db)."""
    n = int(length * sr)
    best = None
    for a, b in ranges:
        s0, s1 = int(a * sr) + 480, int(b * sr) - 480
        for s in range(s0, s1 - n, 240):
            seg = x[s:s + n]
            p = _windowed_power(seg, 480, 960)
            lvl = 10 * np.log10(np.mean(p) + 1e-14)
            spread = 10 * np.log10(p.max() + 1e-14) - 10 * np.log10(p.min() + 1e-14)
            cost = lvl + 0.5 * spread
            if best is None or cost < best[0]:
                best = (cost, s / sr, (s + n) / sr, lvl, spread)
    return best[1:] if best else None


def splice_point(x: np.ndarray, t: float, sr: int = SR, search: float = 0.001) -> int:
    """Sample index of the zero crossing closest to t (within +/- search s) where the
    local slope is smallest, so the 10 ms crossfade starts from silence-level material."""
    c = int(round(t * sr))
    r = int(search * sr)
    a, b = max(c - r, 1), min(c + r, len(x) - 1)
    seg = x[a - 1:b + 1]
    zc = np.where(np.signbit(seg[:-1]) != np.signbit(seg[1:]))[0]
    if not len(zc):
        return c
    cand = zc + a - 1
    slope = np.abs(x[cand + 1] - x[cand])
    dist = np.abs(cand - c) / r
    return int(cand[np.argmin(slope / (np.abs(x[a:b]).max() + 1e-12) + 0.25 * dist)])

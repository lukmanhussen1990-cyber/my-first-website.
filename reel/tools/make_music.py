"""Soft plucky background music, synthesized and arranged against the timeline sections.
Usage: python make_music.py <timeline.json> <out.wav>"""
import sys, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, lfilter

SR = 48000
BPM = 100.0
BEAT = 60.0 / BPM
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):  # "A4", "C#5"
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[p] + 12 * (o + 1) - 69) / 12)


def pluck(f, dur, vel=1.0, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
         + 0.35 * bright * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.06)
         + 0.12 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.2))
    return vel * s * np.minimum(1, t / 0.003)


def musicbox(f, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in [(1, 1, 0.9), (3.0, 0.25, 0.3), (5.2, 0.12, 0.15)])
    return vel * s * np.minimum(1, t / 0.002)


def pad(freqs, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * t
            s += np.sin(ph) + 0.2 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.5).clip(0)
    return vel * s * env / (len(freqs) * 2)


def bass(f, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return vel * s * np.minimum(1, t / 0.01) * np.exp(-t / 1.2)


def add(buf, x, at, pan=0.0):
    i = int(at * SR)
    if i < 0:
        x, i = x[-i:], 0
    if i >= buf.shape[0]:
        return
    x = x[: buf.shape[0] - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * l
    buf[i:i + len(x), 1] += x * r


def reverb(x, wet=0.22):
    out = np.zeros_like(x)
    for ch in range(2):
        y = np.zeros(x.shape[0])
        for d, g in [(1557, 0.82), (1617, 0.81), (1491, 0.8), (1422, 0.79)]:
            d = int(d * SR / 44100) + ch * 23
            a = np.zeros(d + 1); a[0] = 1; a[d] = -g
            y += lfilter([1], a, x[:, ch])
        for d, g in [(225, 0.5), (556, 0.5)]:
            d = int(d * SR / 44100)
            b = np.zeros(d + 1); b[0] = -g; b[d] = 1
            a = np.zeros(d + 1); a[0] = 1; a[d] = -g
            y = lfilter(b, a, y)
        out[:, ch] = y / 4
    return x * (1 - wet) + out * wet


CHORDS = {
    "F": ["F3", "A3", "C4"], "Dm": ["D3", "F3", "A3"], "Bb": ["A#2", "D3", "F3"], "C": ["C3", "E3", "G3"],
    "Gm": ["G2", "A#2", "D3"], "A": ["A2", "C#3", "E3"],
}
ARP = {  # 8 eighth-notes per bar (None = rest)
    "F": ["A4", None, "C5", "F5", None, "C5", "A4", None],
    "Dm": ["D5", None, "A4", "F4", None, "A4", "D5", None],
    "Bb": ["D5", None, "F5", "D5", None, "A#4", "F4", None],
    "C": ["E5", None, "G5", "C5", None, "E5", "G4", None],
    "Gm": ["D5", None, None, "A#4", None, None, "G4", None],
    "A": ["E5", None, None, "C#5", None, None, "A4", None],
}


def main():
    tl = json.load(open(sys.argv[1]))
    total = tl["total"] + 0.5
    P = {p["id"]: p for p in tl["parts"]}
    flash = (P[2]["start"] - 0.2, P[3]["start"] - 0.1)
    sad = (P[6]["start"] - 0.25, P[7]["start"] - 0.15)
    buf = np.zeros((int(total * SR), 2))
    sad_buf = np.zeros_like(buf)
    bar = 4 * BEAT
    prog, sad_prog = ["F", "Dm", "Bb", "C"], ["Dm", "Bb", "Gm", "A"]
    nbars = int(np.ceil(total / bar))
    r = np.random.default_rng(3)
    for b in range(nbars):
        t0 = b * bar
        mid = t0 + bar / 2
        in_sad = sad[0] <= mid < sad[1]
        in_flash = flash[0] <= mid < flash[1]
        ch = (sad_prog if in_sad else prog)[b % 4]
        target = sad_buf if in_sad else buf
        add(target, pad([hz(n) for n in CHORDS[ch]], bar + 0.4, 0.16), t0)
        root = hz(CHORDS[ch][0]) / 2
        add(target, bass(root, bar / 2, 0.32), t0)
        add(target, bass(root, bar / 2, 0.26), t0 + bar / 2)
        for k, nname in enumerate(ARP[ch]):
            if nname is None:
                continue
            at = t0 + k * BEAT / 2 + r.uniform(-0.006, 0.006)
            vel = (0.5 if k % 2 else 0.62) * r.uniform(0.85, 1.0)
            pan = -0.3 if k % 2 else 0.3
            if in_flash:
                add(target, musicbox(hz(nname) * 2, 1.4, vel * 0.5), at, pan)
            elif in_sad:
                add(target, pluck(hz(nname), 1.2, vel * 0.7, bright=0.3), at, pan)
            else:
                add(target, pluck(hz(nname), 0.9, vel), at, pan)
    # muffle the sad (red sky) section, then cross-fade it in
    sos = butter(2, 1100, "low", fs=SR, output="sos")
    sad_buf = sosfilt(sos, sad_buf, axis=0) * 1.3
    t = np.arange(buf.shape[0]) / SR
    w = np.clip((t - sad[0]) / 0.4, 0, 1) * np.clip((sad[1] - t) / 0.4, 0, 1)
    mix = buf * (1 - w[:, None]) + sad_buf
    # final chord ring-out
    end = P[10]["start"] + P[10]["dur"] - 0.6
    for i, n in enumerate(["F4", "A4", "C5", "F5"]):
        add(mix, musicbox(hz(n) * 2, 2.5, 0.35), end + i * 0.12, -0.3 + i * 0.2)
    mix = reverb(mix, 0.25)
    fade = np.clip((total - 0.4 - t) / 2.0, 0, 1)
    mix *= fade[:, None]
    mix *= 0.6 / max(1e-9, np.abs(mix).max())
    sf.write(sys.argv[2], mix.astype(np.float32), SR, subtype="PCM_16")
    print(f"music {total:.1f}s, flashback {flash}, sad {sad}")


if __name__ == "__main__":
    main()

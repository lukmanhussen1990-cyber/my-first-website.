"""Mix voice + music + sound effects into one stereo track, timed by timeline.json and the exported cue list.
Usage: python mix.py <timeline.json> <voice_dir> <sfx_dir> <music.wav> <sfx.json> <out.wav>"""
import sys, json
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

SR = 48000


def load(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0).astype(np.float32)
    return x


def put(buf, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    if n <= 0:
        return
    if x.shape[1] == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        buf[i:i + n, 0] += x[:n, 0] * gain * l
        buf[i:i + n, 1] += x[:n, 0] * gain * r
    else:
        buf[i:i + n] += x[:n] * gain


def envelope(x, attack=0.03, release=0.3):
    """Smoothed voice-activity envelope (0..1) from a mono signal."""
    win = int(0.02 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    act = np.clip((20 * np.log10(rms + 1e-6) + 45) / 15, 0, 1)  # -45 dBFS -> 0, -30 dBFS -> 1
    out = np.zeros_like(act)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    y = 0.0
    for i in range(0, len(act), 64):  # block-wise one-pole follower (fast enough at 64-sample hops)
        v = act[i]
        y = a * y + (1 - a) * v if v > y else r * y + (1 - r) * v
        out[i:i + 64] = y
    return out


def active_rms_db(x):
    """RMS (dBFS) over the parts of a signal that are actually sounding (20 ms frames above -50 dBFS)."""
    m = x.mean(axis=1) if x.ndim > 1 else x
    win = int(0.02 * SR)
    k = len(m) // win
    if k == 0:
        return 20 * np.log10(np.sqrt(np.mean(m ** 2)) + 1e-9)
    fr = np.sqrt(np.mean(m[: k * win].reshape(k, win) ** 2, axis=1))
    act = fr[fr > 10 ** (-50 / 20)]
    return 20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-9) if len(act) else -90.0


# target loudness of each element while it is sounding (dBFS); voice speech is -20
VOICE_DB = -20.0
TARGET_DB = {"meow_hook": -21, "meow_long": -21, "meow_chirp": -23, "meow_soft": -23, "kitten_mew": -24,
             "hiss": -26, "purr": -28, "kibble": -27, "door": -29, "pop": -29, "pop_hi": -30, "pop_lo": -29,
             "whoosh": -31, "whoosh_down": -31, "ding": -30, "sparkle": -31, "hit": -27}
MUSIC_GAP_DB, MUSIC_DUCK_DB = -30.0, -35.0


def main():
    tl_path, vdir, sdir, music_path, cues_path, out_path = sys.argv[1:7]
    tl = json.load(open(tl_path))
    n = int((tl["total"] + 0.3) * SR)
    voice = np.zeros((n, 2), np.float32)
    for p in tl["parts"]:
        put(voice, load(f"{vdir}/{p['file']}"), p["start"], 1.0)
    voice *= 10 ** ((VOICE_DB - active_rms_db(voice)) / 20)

    music = np.zeros((n, 2), np.float32)
    put(music, load(music_path), 0.0, 1.0)
    music *= 10 ** ((MUSIC_GAP_DB - active_rms_db(music)) / 20)
    duck = envelope(voice[:, 0])
    music *= (10 ** ((MUSIC_DUCK_DB - MUSIC_GAP_DB) / 20 * duck))[:, None]

    fx = np.zeros((n, 2), np.float32)
    cache = {}
    for c in json.load(open(cues_path)):
        name = c["name"]
        if name not in cache:
            x = load(f"{sdir}/{name}.wav")
            cache[name] = x * 10 ** ((TARGET_DB.get(name, -28) - active_rms_db(x)) / 20)
        put(fx, cache[name], c["t"], c.get("gain", 1.0), c.get("pan", 0.0))

    mix = voice + music + fx
    peak = np.abs(mix).max()
    if peak > 0.98:
        mix *= 0.98 / peak
    t = np.arange(n) / SR
    mix *= np.clip((tl["total"] + 0.25 - t) / 0.35, 0, 1)[:, None]  # tiny tail fade
    sf.write(out_path, mix, SR, subtype="PCM_24")
    print(f"mixed {n / SR:.2f}s, peak {peak:.2f}")


if __name__ == "__main__":
    main()

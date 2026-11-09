"""Mix voiceover + sound effects + background music -> audio/mix.wav

Sound effects are Kenney CC0 packs (assets/kenney). Gasp, police siren, fart and the music bed
can be replaced with your own files: drop them in audio/sfx/ with these names and re-run
make_reel.py finish:
    audio/sfx/gasp.(mp3|wav|ogg)   audio/sfx/siren.(...)   audio/sfx/fart.(...)   audio/sfx/music.(...)
Until then, simple stand-ins are synthesized here so the reel is complete.
"""
import glob
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from timeline import EVENTS  # noqa: E402

SR = 48000
TOTAL = 55.5
K = os.path.join(ROOT, "assets", "kenney")
USER = os.path.join(ROOT, "audio", "sfx")


def load(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.float32).copy()


def user_file(name):
    for ext in ("wav", "mp3", "ogg", "m4a", "flac"):
        p = os.path.join(USER, f"{name}.{ext}")
        if os.path.exists(p):
            return p
    return None


def db(x):
    return 10 ** (x / 20)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


# ---- stand-ins (only used when the user hasn't supplied a real CC0 file) -------
def synth_gasp():
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(3).standard_normal(n)
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= np.exp(-((f - 1800) / 1400) ** 2) + 0.4 * np.exp(-((f - 3200) / 900) ** 2)
    x = np.fft.irfft(spec, n)
    env = np.clip(t / 0.06, 0, 1) * np.exp(-np.clip(t - 0.18, 0, None) / 0.12)
    return norm(x * env, 0.6)


def synth_siren(dur=10.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 950 + 380 * np.sin(2 * np.pi * 0.42 * t)  # classic wail
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    k = np.ones(25) / 25  # distance: soften
    x = np.convolve(x, k, mode="same")
    env = np.clip(t / 1.5, 0, 1) * np.clip((dur - t) / 1.2, 0, 1)
    return norm(x * env, 0.5)


def synth_fart():
    n = int(0.62 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    f = 105 - 35 * (t / t[-1]) + 6 * np.sin(2 * np.pi * 11 * t)
    ph = np.cumsum(f) / SR
    pulse = (np.mod(ph, 1.0) < 0.22).astype(float) - 0.22
    flutter = 0.75 + 0.25 * np.sin(2 * np.pi * 23 * t + rng.uniform(0, 6))
    x = pulse * flutter + 0.08 * rng.standard_normal(n)
    for _ in range(3):  # low-pass
        x = np.convolve(x, np.ones(9) / 9, mode="same")
    env = np.clip(t / 0.02, 0, 1) * np.clip((t[-1] - t) / 0.12, 0, 1)
    return norm(x * env, 0.85)


def music_bed():
    p = user_file("music")
    if p:
        m = load(p)
        reps = int(np.ceil(TOTAL * SR / len(m)))
        return np.tile(m, reps)[: int(TOTAL * SR)], 1.0
    # light, bouncy pizzicato bed stitched from Kenney's CC0 "Pizzicato jingles"
    files = sorted(glob.glob(os.path.join(K, "music-jingles", "Audio", "Pizzicato jingles", "*.ogg")))
    order = [1, 2, 12, 3, 13, 14, 10, 11, 1, 7, 2, 15, 12, 3]
    out = np.zeros(int((TOTAL + 2) * SR), np.float32)
    pos = 0.0
    beat = 0.5
    i = 0
    while pos < TOTAL:
        clip = load(files[order[i % len(order)]])
        s = int(pos * SR)
        e = min(len(out), s + len(clip))
        out[s:e] += clip[: e - s]
        pos += max(beat * round(len(clip) / SR / beat), beat * 2)
        i += 1
    return out[: int(TOTAL * SR)], 1.0


def place(mix, clip, t, gain_db=0.0):
    s = int(t * SR)
    if s >= len(mix):
        return
    e = min(len(mix), s + len(clip))
    mix[s:e] += clip[: e - s] * db(gain_db)


def main(out_path):
    n = int(TOTAL * SR)
    mix = np.zeros(n, np.float32)

    vo = load(os.path.join(ROOT, "audio", "voiceover.mp3"))
    vo = norm(vo, 0.89)
    place(mix, vo, 0.0)

    music, _ = music_bed()
    fade = np.ones(n)
    fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
    music = norm(music, 1.0) * fade[: len(music)]
    place(mix, music, 0.0, -25)  # low under the voice

    a = lambda *p: load(os.path.join(K, *p))  # noqa: E731
    E = EVENTS
    gasp = load(user_file("gasp")) if user_file("gasp") else synth_gasp()
    place(mix, norm(gasp, 0.9), E["gasp"], -8)
    place(mix, a("rpg-audio", "Audio", "bookFlip2.ogg"), E["sign_flip"] - 0.05, -4)
    for k in range(5):
        place(mix, a("interface-sounds", "Audio", "pluck_00%d.ogg" % (1 + k % 2)), E["pop_hearts"] + k * 0.07, -12)
    place(mix, a("interface-sounds", "Audio", "bong_001.ogg"), E["ding"], -2)
    place(mix, a("interface-sounds", "Audio", "glass_002.ogg"), E["ding"] + 0.04, -9)
    place(mix, a("interface-sounds", "Audio", "maximize_006.ogg"), E["ding"] + 0.08, -14)
    siren = load(user_file("siren")) if user_file("siren") else synth_siren(9.5)
    sl = int(9.5 * SR)
    siren = np.resize(siren, sl) * np.clip(np.minimum(np.arange(sl) / (1.2 * SR), (sl - np.arange(sl)) / (1.5 * SR)), 0, 1)
    place(mix, norm(siren, 0.8), E["siren_start"], -17)
    place(mix, a("rpg-audio", "Audio", "doorOpen_2.ogg"), E["door_slam"] - 0.08, -6)
    place(mix, a("impact-sounds", "Audio", "impactWood_heavy_002.ogg"), E["door_slam"], 0)
    place(mix, a("rpg-audio", "Audio", "doorClose_4.ogg"), E["door_slam"] + 0.02, -3)
    for k in range(5):
        place(mix, a("impact-sounds", "Audio", "footstep_wood_00%d.ogg" % (k % 5)), E["door_slam"] + 0.12 + k * 0.14, -10)
    place(mix, a("rpg-audio", "Audio", "metalLatch.ogg"), E["cuffs"], -3)
    place(mix, a("rpg-audio", "Audio", "metalClick.ogg"), E["cuffs"] + 0.18, -3)
    place(mix, a("interface-sounds", "Audio", "glass_005.ogg"), E["wink"] + 0.08, -10)
    fart = load(user_file("fart")) if user_file("fart") else synth_fart()
    place(mix, norm(fart, 0.9), E["fart"], -5)

    peak = np.max(np.abs(mix))
    if peak > 0.98:
        mix *= 0.98 / peak
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    import wave
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("audio ->", out_path, f"{TOTAL:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "audio", "mix.wav"))

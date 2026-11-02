"""Build the soundtrack: voiceover + romantic music (synth) + ElevenLabs SFX.
Writes audio/mix.wav (48 kHz stereo). Run with the scratch venv python.
"""
import json, os
import numpy as np
import soundfile as sf
import librosa

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = json.load(open(os.path.join(HERE, "..", "shots.json")))
W = D["words"]
N = int(D["duration"] * SR) + SR // 10
L = np.zeros(N); R = np.zeros(N)

def db(x): return 10 ** (x / 20)
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def place(sig, t, gain_db=0.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    s = sig[: N - i] * db(gain_db)
    L[i:i + len(s)] += s * (1 - max(0, pan)); R[i:i + len(s)] += s * (1 + min(0, pan))
def load(name):
    y, _ = librosa.load(os.path.join(HERE, "sfx", name + ".mp3"), sr=SR, mono=True)
    return y

# ---------------- voiceover ----------------
vo, _ = sf.read(os.path.join(HERE, "vo_final.wav"))
VO_RMS = rms(vo[np.abs(vo) > 0.01])
def level(sig, rel_db):  # scale a sound so its loud part sits rel_db under the voice
    loud = sig[np.abs(sig) > np.abs(sig).max() * 0.1]
    return sig * (VO_RMS / rms(loud)) * db(rel_db)
place(vo, 0.0)

# ---------------- romantic music (Wagner "Bridal Chorus", public domain) ----------------
def tone(freq, dur, kind="piano", amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    if kind == "piano":
        env = np.exp(-t * 2.2) * (1 - np.exp(-t * 300))
        sig = sum((0.6 ** k) * np.sin(2 * np.pi * freq * (k + 1) * t * (1 + 0.0004 * k)) for k in range(6))
    elif kind == "harp":
        env = np.exp(-t * 3.5) * (1 - np.exp(-t * 500))
        sig = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)
    else:  # pad (soft strings)
        a = np.minimum(1, t / 0.35); r = np.minimum(1, (dur - t) / 0.4)
        env = np.clip(a * r, 0, 1)
        sig = sum(np.sin(2 * np.pi * freq * (1 + d) * t + p) for d, p in [(-0.003, 0), (0.0, 1.3), (0.004, 2.1)])
        sig += 0.25 * sum(np.sin(4 * np.pi * freq * (1 + d) * t) for d in (-0.002, 0.003))
    return sig * env * amp
NOTE = {"D2": 73.42, "G2": 98.0, "D3": 146.83, "F#3": 185.0, "G3": 196.0, "A3": 220.0, "B3": 246.94,
        "D4": 293.66, "F#4": 369.99, "G4": 392.0, "A4": 440.0, "B4": 493.88, "D5": 587.33}
q = 0.85
mel = [("D4", 1), ("G4", 0.75), ("G4", 0.25), ("G4", 2), ("D4", 1), ("A4", 0.75), ("F#4", 0.25), ("G4", 2)]
mlen = 8.6
music = np.zeros(int(mlen * SR) + SR)
def mput(sig, t):
    i = int(t * SR); music[i:i + len(sig)] += sig[: len(music) - i]
t = 0.25
for n, beats in mel:
    mput(tone(NOTE[n], beats * q + 1.2, "piano", 0.5), t); t += beats * q
chords = [(0.0, 3.65, ["G2", "G3", "B3", "D4"]), (3.65, 5.35, ["D2", "D3", "F#3", "A3"]), (5.35, 8.5, ["G2", "G3", "B3", "D4"])]
for a, b, ns in chords:
    for n in ns: mput(tone(NOTE[n], b - a + 0.3, "pad", 0.13), a)
    arp = [ns[1], ns[2], ns[3], ns[2]]
    k = 0; tt = a + 0.02
    while tt < b - 0.05:
        mput(tone(NOTE[arp[k % 4]] * 2, 1.2, "harp", 0.18), tt); tt += q / 2; k += 1
music /= np.abs(music).max()
# tape-stop exactly when he poops
t_poop = W[15]["s"]
stop_i = int((t_poop - 0.02) * SR)
spd = np.linspace(1, 0, int(0.45 * SR)) ** 1.5
pos = stop_i + np.cumsum(spd)
tail = np.interp(pos, np.arange(len(music)), music) * np.linspace(1, 0, len(spd))
music_out = np.concatenate([music[:stop_i], tail])
music_out[: int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))
music_out = level(music_out, -11)
place(music_out, 0.0, 0, -0.05); place(music_out, 0.012, -6, 0.3)  # tiny stereo width

# ---------------- SFX ----------------
place(level(load("scratch2"), -7), t_poop - 0.06)
place(level(load("squish1"), -6), t_poop + 0.02)
# priest sniff
place(level(load("sniff1"), -6), W[36]["e"] + 0.05)
# camera clicks
cam = level(load("camera2"), -6)
for i in (46, 47, 48): place(cam, W[i]["s"] - 0.03)
# bride sniff
place(level(load("sniff2"), -6), W[60]["e"] + 0.05)
# gasp when her tears stop
place(level(load("gasp1"), -14), W[63]["e"] + 0.05)
# hand pop-in "boing" (synth) for "What you don't know"
s22 = next(s for s in D["shots"] if s["id"] == "22")["t0"]
tt = np.arange(int(0.35 * SR)) / SR
boing = np.sin(2 * np.pi * np.cumsum(180 + 420 * np.exp(-tt * 9) * (1 + 0.15 * np.sin(tt * 60))) / SR) * np.exp(-tt * 9)
place(level(boing, -12), s22 + 0.02)
# heartbeat for "her heart is fine" (synth, follows the 3D heart)
s26 = next(s for s in D["shots"] if s["id"] == "26")
hb_t = np.arange(int(0.18 * SR)) / SR
thump = np.sin(2 * np.pi * 58 * hb_t) * np.exp(-hb_t * 28) + 0.4 * np.sin(2 * np.pi * 110 * hb_t) * np.exp(-hb_t * 40)
k = 0
while (k + 0.1) / 1.3 < s26["dur"]:
    place(level(thump, -9), s26["t0"] + (k + 0.1) / 1.3)
    if (k + 0.3) / 1.3 < s26["dur"]: place(level(thump, -13), s26["t0"] + (k + 0.3) / 1.3)
    k += 1
# small twitchy sniffs for "Her nose is not"
s27 = next(s for s in D["shots"] if s["id"] == "27")
sn = librosa.effects.pitch_shift(load("sniff2"), sr=SR, n_steps=4)
place(level(sn, -14), s27["t0"] + 0.55); place(level(sn, -16), s27["t0"] + 0.95)
# crickets in the long pause
c0, c1 = W[117]["s"] - 0.25, W[122]["s"] - 0.05
cr = load("crickets1")
while len(cr) < (c1 - c0 + 1) * SR: cr = np.concatenate([cr, load("crickets1")])
cr = cr[: int((c1 - c0) * SR)]
fade = int(0.35 * SR); cr[:fade] *= np.linspace(0, 1, fade); cr[-fade:] *= np.linspace(1, 0, fade)
place(level(cr, -4), c0)
# reveal: small gasp
s31 = next(s for s in D["shots"] if s["id"] == "31")
place(level(load("gasp2"), -17), s31["t0"] + 0.35)
# congratulations: confetti pop + church bells to the end
tc = W[128]["s"]
place(level(load("confetti1"), -8), tc - 0.18)
bells = load("bells2")
endlen = int((D["duration"] - tc + 0.1) * SR)
bells = bells[:endlen]
bells[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))
place(level(bells, -5), tc - 0.05)

mix = np.stack([L, R], 1)
mix /= max(1.0, np.abs(mix).max() / 0.95)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix written", mix.shape[0] / SR, "s")

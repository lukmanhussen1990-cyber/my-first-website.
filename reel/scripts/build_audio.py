"""Cut the supplied voiceover into line chunks, re-space them with pauses to hit
~45s, write timeline.json (word + caption timings) and synthesize all SFX with
numpy. Nothing here calls ElevenLabs."""
import json, sys, wave
import numpy as np

W = sys.argv[1]  # work dir
SR = 44100
TARGET = 45.0
LEAD = 0.45
TAIL = 1.75
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- chunks
CHUNKS = [  # text, speaker, caption groups (word counts) ; money group marker
    ("You walk up to a stranger.", "N", [3, 3]),
    ("You ask one question.", "N", [2, 2]),
    ("Would you poop your pants for ten dollars?", "Y", [3, 3, ("$10?", 2)]),
    ("No way.", "M", [2]),
    ("A hundred dollars?", "Y", [("$100?", 3)]),
    ("He stops.", "N", [2]),
    ("He thinks.", "N", [2]),
    ("He looks at his new white pants.", "N", [3, 2, 2]),
    ("No.", "M", [1]),
    ("A crowd starts to gather.", "N", [2, 3]),
    ("One thousand dollars.", "Y", [("$1,000", 3)]),
    ("Silence.", "N", [1]),
    ("He doesn't say yes.", "N", [2, 2]),
    ("He doesn't say no.", "N", [2, 2]),
    ("He just closes his eyes.", "N", [2, 3]),
    ("And...", "N", [1]),
    ("it happens.", "N", [2]),
    ("The crowd steps back.", "N", [2, 2]),
    ("The dog runs away.", "N", [2, 2]),
    ("Done.", "M", [1]),
    ("Pay me.", "M", [2]),
    ("You open your wallet.", "N", [2, 2]),
    ("Five dollars.", "N", [("$5", 2)]),
    ("He looks at you.", "N", [2, 2]),
    ("You look at him.", "N", [2, 2]),
    ("You run.", "N", [2]),
    ("He can't run fast.", "N", [2, 2]),
    ("But he never stops.", "N", [2, 2]),
]
# extra pause (relative weights) after each chunk; Silence gets a fixed 1.05s gap
EXTRA = [0.1, 0.2, 0.45, 0.15, 0.45, 0.15, 0.35, 0.45, 0.25, 0.35, 0.55, None,
         0.1, 0.25, 0.3, 0.35, 0.7, 0.1, 0.35, 0.15, 0.3, 0.2, 0.55, 0.15, 0.5, 0.3, 0.15]
SILENCE_IDX = 11
SILENCE_GAP = 1.05

voice = np.fromfile(f"{W}/voice44k.f32", dtype=np.float32).astype(np.float64)
hop = 441
n = len(voice) // hop
db = 20 * np.log10(np.array([np.sqrt(np.mean(voice[i*hop:(i+1)*hop]**2)) for i in range(n)]) + 1e-9)
sp = db > -48
regs, i = [], 0
while i < n:
    if sp[i]:
        j = i
        while j < n and sp[j]:
            j += 1
        regs.append([i*0.01, j*0.01]); i = j
    else:
        i += 1
merged = []
for r in regs:
    if merged and r[0] - merged[-1][1] < 0.2:
        merged[-1][1] = r[1]
    else:
        merged.append(r)
merged = [r for r in merged if r[1] - r[0] > 0.08]
assert len(merged) == len(CHUNKS), len(merged)

# whisper words -> sequential mapping onto chunks
wwords = json.load(open(f"{W}/words.json"))
script_words = [c[0].split() for c in CHUNKS]
assert sum(map(len, script_words)) == len(wwords), (sum(map(len, script_words)), len(wwords))

orig_gaps = [merged[k+1][0] - merged[k][1] for k in range(len(merged)-1)]
speech = sum(e - s for s, e in merged)
fixed = LEAD + TAIL + speech + SILENCE_GAP
flex_orig = sum(g for k, g in enumerate(orig_gaps) if k != SILENCE_IDX)
need_extra = TARGET - fixed - flex_orig
wsum = sum(x for x in EXTRA if x is not None)
scale = need_extra / wsum
gaps = []
for k, g in enumerate(orig_gaps):
    gaps.append(SILENCE_GAP if k == SILENCE_IDX else g + EXTRA[k] * scale)
print(f"speech={speech:.2f}s orig_gaps={sum(orig_gaps):.2f} extra_scale={scale:.3f}")

PAD_IN, PAD_OUT = 0.03, 0.06
total = TARGET
out = np.zeros(int(total * SR) + SR)
chunks_out = []
cursor = LEAD
wi = 0
for k, ((text, spk, groups), (s, e)) in enumerate(zip(CHUNKS, merged)):
    a0, a1 = int((s - PAD_IN) * SR), int((e + PAD_OUT) * SR)
    seg = voice[a0:a1].copy()
    f = int(0.01 * SR)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    o0 = int((cursor - PAD_IN) * SR)
    out[o0:o0 + len(seg)] += seg
    ns, ne = cursor, cursor + (e - s)
    # words: rescale whisper relative timings into the measured chunk span
    cw = wwords[wi:wi + len(script_words[k])]; wi += len(script_words[k])
    w0, w1 = cw[0]["s"], cw[-1]["e"]
    span = max(w1 - w0, 1e-3)
    words = []
    for sw, w in zip(script_words[k], cw):
        words.append({"w": sw, "s": round(ns + (w["s"] - w0) / span * (ne - ns), 3),
                      "e": round(ns + (w["e"] - w0) / span * (ne - ns), 3)})
    chunks_out.append({"i": k, "text": text, "spk": spk, "s": round(ns, 3), "e": round(ne, 3),
                       "words": words, "groups": groups})
    cursor = ne + (gaps[k] if k < len(gaps) else 0)
print(f"last word ends {chunks_out[-1]['e']:.2f}, total {total:.2f}")

# caption groups
caps = []
for c in chunks_out:
    wi = 0
    for g in c["groups"]:
        if isinstance(g, (list, tuple)):
            label, cnt = g; money = True
        else:
            cnt = g; money = False
            label = " ".join(x["w"] for x in c["words"][wi:wi+cnt]).upper()
        ws = c["words"][wi:wi+cnt]; wi += cnt
        caps.append({"text": label, "money": money, "s": ws[0]["s"], "e": ws[-1]["e"], "chunk": c["i"]})
    assert wi == len(c["words"])
for j, cp in enumerate(caps):
    nxt = caps[j+1]["s"] if j + 1 < len(caps) else total
    hold = 0.55 if cp["money"] else 0.3
    cp["show"] = round(cp["s"] - 0.06, 3)
    cp["hide"] = round(min(cp["e"] + hold, nxt - 0.07), 3)

C = {c["i"]: c for c in chunks_out}
def w_of(ci, idx): return C[ci]["words"][idx]

# ---------------------------------------------------------------- SFX
def t2i(t): return int(t * SR)
def add(buf, t, x, g=1.0):
    i0 = t2i(t)
    if i0 < 0: x = x[-i0:]; i0 = 0
    i1 = min(len(buf), i0 + len(x))
    buf[i0:i1] += g * x[:i1 - i0]
def fftfilt(x, lo=None, hi=None):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(fr)
    if lo: m *= 1 / (1 + (lo / np.maximum(fr, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (fr / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def tt(d): return np.arange(int(d * SR)) / SR
def norm(x, p=1.0): return x / (np.max(np.abs(x)) + 1e-9) * p

def bell(f0=2093, d=0.9, tau=0.25, pitch=1.0):
    t = tt(d); x = np.zeros_like(t)
    for ratio, amp, tm in [(1, 1, 1), (2.76, .5, .6), (5.4, .3, .35), (8.93, .15, .2), (1.5, .25, .8)]:
        x += amp * np.sin(2 * np.pi * f0 * pitch * ratio * t) * np.exp(-t / (tau * tm))
    return x * np.minimum(1, t / 0.002)
def chaching(pitch=1.0, big=False):
    out = np.zeros(int(1.4 * SR))
    clank = fftfilt(rng.standard_normal(int(0.07 * SR)), 1500, 7000) * np.exp(-tt(0.07) / 0.015)
    add(out, 0.0, norm(clank, 0.7))
    add(out, 0.02, bell(1568, 0.25, 0.04, pitch), 0.35)          # "cha"
    add(out, 0.12, norm(fftfilt(rng.standard_normal(int(0.05*SR)), 3000, 9000) * np.exp(-tt(0.05)/0.01), .4))
    add(out, 0.14, bell(2093, 1.2, 0.35 if big else 0.25, pitch), 0.8)  # "ching"
    if big:
        add(out, 0.26, bell(2637, 1.0, 0.3, pitch), 0.5)
    return norm(out)
def record_scratch():
    d = 0.55; t = tt(d)
    srcn = int(SR * 3)
    st = np.arange(srcn) / SR
    src = (np.sign(np.sin(2*np.pi*196*st)) * .3 + np.sin(2*np.pi*392*st) * .4 +
           fftfilt(rng.standard_normal(srcn), 300, 5000) * .6)
    speed = np.concatenate([np.full(int(.05*SR), 1.0),
                            -2.2 * np.sin(np.linspace(0, np.pi, int(.12*SR))),
                            2.8 * np.sin(np.linspace(0, np.pi, int(.10*SR))),
                            -2.5 * np.sin(np.linspace(0, np.pi, int(.12*SR))),
                            np.linspace(1.6, 0.0, len(t) - int(.39*SR))])
    pos = 1.0 * SR + np.cumsum(speed)
    x = np.interp(pos, np.arange(srcn), src)
    x *= np.minimum(1, np.abs(speed) * 1.5 + 0.05)
    env = np.minimum(1, t / 0.005) * np.minimum(1, (d - t) / 0.05)
    return norm(fftfilt(x * env, 150, 6000))
def thump(pitch=1.0, squish=False):
    t = tt(0.16)
    f = (95 - 45 * t / 0.16) * pitch
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    c = fftfilt(rng.standard_normal(len(t)), 900, 4000) * np.exp(-t / 0.008) * 0.35
    x = x + c
    if squish:
        sq = fftfilt(rng.standard_normal(len(t)), 200, 900) * np.exp(-t / 0.05) * 0.5
        x = x + sq * np.sin(np.pi * t / 0.16)
    return norm(x)
def rumble(d=0.9):
    t = tt(d)
    saw = 2 * ((52 * t) % 1) - 1
    am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 21 * t + 3 * np.sin(2 * np.pi * 3 * t)))
    x = fftfilt(saw * am + 0.3 * rng.standard_normal(len(t)), 30, 260)
    env = np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.2)
    return norm(x * env)
def sparkle():
    out = np.zeros(int(0.9 * SR))
    for k, f in enumerate([2637, 3136, 3951, 5274]):
        t = tt(0.5); add(out, k * 0.07, np.sin(2*np.pi*f*t) * np.exp(-t/0.09), 0.5)
    return norm(out)
def whoosh(d=0.45):
    t = tt(d); x = rng.standard_normal(len(t))
    lo = fftfilt(x, 200, 900); hi = fftfilt(x, 900, 4000)
    mix = t / d
    env = np.sin(np.pi * t / d) ** 2
    return norm((lo * (1 - mix) + hi * mix) * env)
def flaps(d=0.9, rate=13):
    t = tt(d); x = fftfilt(rng.standard_normal(len(t)), 400, 3000)
    am = np.maximum(0, np.sin(2 * np.pi * rate * t)) ** 3
    return norm(x * am * np.exp(-t / 0.5))
def yip():
    out = np.zeros(int(0.5 * SR))
    for k in range(2):
        t = tt(0.12); f = 1100 - 500 * t / 0.12
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = (np.sin(ph) + .4 * np.sin(2 * ph) + .2 * np.sin(3 * ph)) * np.sin(np.pi * t / .12)
        add(out, k * 0.17, x)
    return norm(out)
def flutter(d=1.0):
    t = tt(d); x = fftfilt(rng.standard_normal(len(t)), 200, 1500)
    return norm(x * (np.maximum(0, np.sin(2*np.pi*24*t)) ** 2) * np.sin(np.pi * t / d))
def horn():
    t = tt(0.32)
    x = np.sign(np.sin(2*np.pi*415*t)) + np.sign(np.sin(2*np.pi*523*t))
    return norm(fftfilt(x, 200, 2500) * np.minimum(1, t / .01) * np.minimum(1, (.32 - t) / .03))
def coo():
    t = tt(0.7); f = 330 + 40 * np.sin(2*np.pi*1.4*t)
    x = np.sin(2*np.pi*np.cumsum(f)/SR) * (0.5 + 0.5*np.sin(2*np.pi*9*t)) * np.sin(np.pi*t/.7)
    return norm(x)

N = len(out)
sfx = np.zeros(N)
amb = np.zeros(N)
# ambience: traffic rumble + passing cars + city hiss + coos + horns
base = fftfilt(np.cumsum(rng.standard_normal(N)) * 0.02 + rng.standard_normal(N) * 0.2, 40, 500)
base = norm(base - np.mean(base))
hiss = norm(fftfilt(rng.standard_normal(N), 600, 5000))
cars = np.zeros(N)
for tc in np.arange(1.0, total, 3.7) + rng.uniform(-0.8, 0.8, len(np.arange(1.0, total, 3.7))):
    d = 2.2; t = tt(d)
    c = fftfilt(rng.standard_normal(len(t)), 150, 1800) * np.exp(-((t - d/2) / 0.5) ** 2)
    add(cars, tc, norm(c), rng.uniform(.5, 1))
amb = base * 0.5 + hiss * 0.12 + cars * 0.35
for tc in [2.2, 9.8, 27.4]:
    add(amb, tc, coo(), 0.25)
add(amb, 0.15, horn(), 0.22)
add(amb, 13.9, horn(), 0.14)

# ---- cues
cue = {}
cue["ten"] = w_of(2, 6)["s"]
cue["hundred"] = C[4]["s"]
cue["thousand"] = C[10]["s"]
cue["scratch"] = C[11]["s"] - 0.62
cue["silence_word"] = C[11]["s"]
cue["silence_pause"] = C[11]["e"]
cue["happens"] = C[16]["s"]
cue["five"] = C[22]["s"]
cue["run"] = C[25]["s"]
cue["waddle"] = C[26]["s"]
add(sfx, cue["ten"] - 0.02, chaching(), 0.30)
add(sfx, cue["hundred"] - 0.02, chaching(1.06), 0.32)
add(sfx, cue["thousand"] - 0.02, chaching(1.12, big=True), 0.36)
add(sfx, cue["thousand"] + 0.35, chaching(1.25), 0.18)
add(sfx, cue["scratch"], record_scratch(), 0.30)
add(sfx, C[7]["words"][5]["s"], sparkle(), 0.13)                 # white pants
add(sfx, C[16]["e"] + 0.05, rumble(0.85), 0.30)                  # it happens
add(sfx, C[17]["s"] + 0.05, whoosh(), 0.20)                      # crowd steps back
add(sfx, C[18]["words"][2]["s"] - 0.1, yip(), 0.10)              # dog
add(sfx, C[18]["words"][2]["s"] + 0.15, flaps(1.1), 0.16)        # pigeons
add(sfx, C[21]["words"][3]["s"], fftfilt(rng.standard_normal(int(.25*SR)), 300, 2500) * np.exp(-tt(.25)/.06) * .15)  # wallet
add(sfx, cue["five"] - 0.02, chaching(0.62), 0.16)               # sad mini cha-ching
add(sfx, cue["five"] + 0.4, flutter(1.1), 0.09)                  # moth
# running footsteps (you) then waddle squish (him)
t = cue["run"] + 0.15; k = 0
while t < total - 0.6:
    fade = max(0.25, 1 - (t - cue["run"]) / 8)
    add(sfx, t, thump(1.0 + 0.08 * (k % 2)), 0.20 * fade)
    t += 0.155; k += 1
t = cue["waddle"] - 0.1; k = 0
while t < total - 0.5:
    add(sfx, t, thump(0.8 + 0.1 * (k % 2), squish=True), 0.17)
    t += 0.36; k += 1

# ambience gain curve: duck under voice, cut out from scratch to end of silence
g = np.full(N, 1.0)
def ramp(t0, t1, v0, v1):
    i0, i1 = t2i(t0), t2i(t1); g[i0:i1] = np.linspace(v0, v1, i1 - i0)
cut0 = cue["scratch"] + 0.50; back = cue["silence_pause"] + SILENCE_GAP - 0.1
g[t2i(cut0):t2i(back)] = 0.0
ramp(cue["scratch"] + 0.40, cut0, 1.0, 0.0)
ramp(back, back + 1.2, 0.0, 1.0)
amb = norm(amb) * g

vpk = np.max(np.abs(out))
voice_n = out / vpk * 0.89
mix = voice_n + amb * 0.055 + sfx * 0.9
fo = t2i(total - 1.3)
mix[fo:t2i(total)] *= np.linspace(1, 0, t2i(total) - fo)
mix = mix[:t2i(total)]
voice_n = voice_n[:t2i(total)]

def wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((x * 32767).astype(np.int16).tobytes())
wav(f"{W}/voice_timeline.wav", voice_n)
wav(f"{W}/mix_raw.wav", mix / max(1, np.max(np.abs(mix))))

json.dump({"duration": total, "fps": 30, "chunks": chunks_out, "captions": caps, "cue": cue},
          open(f"{W}/timeline.json", "w"), indent=1)
for c in chunks_out:
    print(f"{c['i']:2d} {c['spk']} {c['s']:6.2f}-{c['e']:6.2f}  {c['text']}")

"""Sound design + master for the redrawn film. Synthesised (one sample, below): soft whooshes on transitions, a warm low
thump + mallet-bell chord on the two "Claude" reveals, quiet key/UI ticks synced to on-screen typing and clicks,
faint digital ticks under the decode effects, and a warm pad + chime under the end credit (the film is in G minor).
One sample: the solo sung "ahh" that opens the "Introducing Claude Opus 5.5" film (audio/ahh_opus55_src.wav, cut from
0.070-1.235 s of that film's soundtrack, where it plays alone), tuned F#4 -> G4 to sit in this film's key. It opens the
film as the spark blooms, and its reverse-reverb swell closes it, so when the film loops the swell runs into the "ahh".
The effects bus is ducked under the narration, mixed with the soundtrack, then mastered (gentle compression,
loudness to -14 LUFS, true peak -1 dBTP) by ffmpeg.  usage: sound_design.py OUT.wav"""
import sys, os, subprocess, json
import numpy as np, soundfile as sf
from scipy.signal import stft, istft, fftconvolve, butter, sosfilt
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
base, sr = sf.read(f'{S}/audio/soundtrack_redraw.wav'); assert sr == SR
N = base.shape[0]
fx = np.zeros((N, 2))
rng = np.random.default_rng(7)
T = lambda f: (f - 1) / 30.0
def db(x): return 10 ** (x / 20)
def put(sig, t, gain_db=0, pan=0.0):
    i = int(round(t * SR)); sig = np.asarray(sig)
    if sig.ndim == 1: sig = np.stack([sig * np.sqrt(0.5 * (1 - pan)) * 1.414, sig * np.sqrt(0.5 * (1 + pan)) * 1.414], 1)
    j0, j1 = max(0, i), min(N, i + len(sig))
    if j1 > j0: fx[j0:j1] += sig[j0 - i:j1 - i] * db(gain_db)
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, fc, order=2): return sosfilt(butter(order, fc, btype='low', fs=SR, output='sos'), x)
# ---- reverb: synthetic stereo IR (pre-delay 18 ms, RT60 ~1.9 s, darker tail)
def make_ir(rt=1.9, n=None):
    n = n or int(rt * SR * 1.1); t = np.arange(n) / SR
    env = np.exp(-6.91 * t / rt); env[:int(0.018 * SR)] = 0
    ir = np.stack([lp(rng.standard_normal(n), 5200) * env, lp(rng.standard_normal(n), 5200) * env], 1)
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True)) * 0.5
IR = make_ir()
def verb(sig, wet=0.35):
    sig = np.asarray(sig); st = np.stack([sig, sig], 1) if sig.ndim == 1 else sig
    out = np.zeros((len(st) + len(IR) - 1, 2))
    for c in range(2): out[:, c] = fftconvolve(st[:, c], IR[:, c])
    dry = np.zeros_like(out); dry[:len(st)] = st
    return dry * (1 - wet) + out * wet * 2.2
# ---- sound atoms
def whoosh(dur, f0, f1, attack=0.62, width_oct=0.9):
    n = int(dur * SR); x = rng.standard_normal(n + 4096)
    fr, tt, Z = stft(x, SR, nperseg=2048, noverlap=1792)
    u = np.clip(tt / dur, 0, 1); fc = np.exp(np.log(f0) + (np.log(f1) - np.log(f0)) * u)
    lf = np.log2(np.maximum(fr, 20))[:, None]; band = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (width_oct / 2)) ** 2)
    _, y = istft(Z * band, SR, nperseg=2048, noverlap=1792); y = y[:n]
    t = np.arange(n) / n; env = np.where(t < attack, (t / attack) ** 2.2, np.exp(-(t - attack) / (1 - attack) * 4.0))
    y = y * env; return y / (np.abs(y).max() + 1e-9)
def thump(f_hi=74, f_lo=46, dur=0.9):
    n = int(dur * SR); t = np.arange(n) / SR
    fq = f_lo + (f_hi - f_lo) * np.exp(-t / 0.08); ph = 2 * np.pi * np.cumsum(fq) / SR
    y = np.sin(ph) * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.004))
    click = bp(rng.standard_normal(n), 900, 4000) * np.exp(-t / 0.004) * 0.25
    y = y + click; return y / np.abs(y).max()
def bell(freqs, dur=3.2, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for k, f in enumerate(freqs):
        for p, a, tau in ((1.0, 1.0, 1.7), (2.0, 0.32, 0.9), (3.01, 0.16 * bright, 0.45), (4.18, 0.07 * bright, 0.28)):
            y += a / (1 + 0.3 * k) * np.sin(2 * np.pi * f * p * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    y *= (1 - np.exp(-t / 0.004)); return y / np.abs(y).max()
def tick(hi=1.0):
    n = int(0.035 * SR); t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1800 * hi, 6500) * np.exp(-t / 0.0035) + 0.35 * np.sin(2 * np.pi * (1500 + 400 * rng.random()) * hi * t) * np.exp(-t / 0.006)
    return y / np.abs(y).max()
def blip(f, dur=0.03):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.sin(2 * np.pi * f * t) * np.exp(-t / (dur / 4)) * (1 - np.exp(-t / 0.0015)); return y
def pad(notes, dur, att=2.2, rel=2.5):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f in notes:
        for d in (-0.07, 0.0, 0.07):
            fr = f * 2 ** (d / 12)
            y += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) + 0.18 * np.sin(2 * np.pi * 2 * fr * t) + 0.06 * np.sin(2 * np.pi * 3 * fr * t)
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel)) ** 1.5
    y = lp(y * env, 2400); return y / np.abs(y).max()
def ahh_note():
    """The Opus 5.5 film's opening "ahh" (stereo, its own room), tape-tuned F#4 (368.93 Hz measured) -> G4 (392 Hz)."""
    import soxr
    x, xsr = sf.read(f'{S}/audio/ahh_opus55_src.wav'); assert xsr == SR
    r = 392.0 / 368.93
    y = soxr.resample(x, SR, SR / r, quality='VHQ')
    on = int(np.argmax(np.abs(y).max(1) > np.abs(y).max() * 0.05))
    return y, on
def reverse_swell(x, on, rt=1.4):
    """Reverse reverb of the note: the reversed note through a room, reversed back, kept up to the note's onset."""
    ir = make_ir(rt); m = x.mean(1)[::-1]
    w = np.stack([fftconvolve(m, ir[:, c]) for c in range(2)], 1)[::-1]
    w = w[:len(ir) - 1 + on]
    k = int(0.008 * SR); w[-k:] *= np.linspace(1, 0, k)[:, None]
    return w / np.abs(w).max()
G = {'G3': 196.0, 'Bb3': 233.08, 'D4': 293.66, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0, 'Bb4': 466.16, 'D5': 587.33, 'G5': 783.99, 'Bb5': 932.33, 'D6': 1174.66}
# =============================================================== events (frame numbers from the scenes)
# opening: the starburst blooms on navy, then the triangle opens onto the clouds
AHH, AHH_ON = ahh_note()
put(AHH, T(2) - AHH_ON / SR, 1.5)                                     # the "ahh" (onset on frame 2, as the spark blooms)
put(verb(whoosh(1.1, 300, 2600)), T(14), -22, pan=-0.2)
# "right one": faint decode ticks, a soft lock, the readout typing; de-res; "Meet" rises
for k in range(16): put(blip(2200 + 2600 * rng.random(), 0.018), T(251 + k * 0.55) + 0.01 * rng.random(), -31, pan=rng.uniform(-0.5, 0.5))
put(verb(tick(0.8), 0.3), T(260.6), -22); put(verb(blip(1567.98 * 1.0, 0.25), 0.4), T(260.8), -27)
for k in range(9): put(tick(1.3), T(260.5 + k * 0.5), -32)
for k in range(6): put(blip(2400 + 1800 * rng.random(), 0.016), T(279.5 + k * 0.6), -33)
put(verb(whoosh(0.55, 500, 3000, 0.7), 0.3), T(281.5), -27, pan=0.15)
# "Meet Claude": a short rise into a warm thump + bell chord as the mark turns in; air under the wordmark wipe
put(whoosh(0.5, 400, 4000, 0.92), T(306) - 0.46, -31)
put(thump(), T(306), -19)
put(verb(bell([G['G4'], G['Bb4'], G['D5'], G['G5']], 3.5, 0.8), 0.5), T(306), -26)
put(verb(whoosh(0.6, 1200, 6000, 0.35, 0.7), 0.3), T(313), -31, pan=0.35)
put(verb(whoosh(1.0, 2500, 300, 0.4)), T(339), -28)
# dashboard -> lavender flash, the kinetic title
put(verb(whoosh(0.9, 250, 3500, 0.8)), T(437), -22)
put(thump(64, 44, 0.7), T(446), -26)
put(verb(whoosh(0.35, 800, 5000, 0.5), 0.2), T(459), -31, pan=-0.3)          # "move" sweeps in
put(verb(whoosh(0.28, 1500, 9000, 0.85), 0.25), T(467.5), -30, pan=0.4)     # underline shoots past "beyond"
put(verb(bell([G['D6']], 1.2, 0.3), 0.4), T(471.5), -40, pan=0.45)
put(verb(whoosh(0.5, 3000, 8000, 0.5, 1.4), 0.3), T(478), -35)              # skeleton shimmer
put(verb(whoosh(0.8, 2200, 500, 0.3)), T(489), -28)
# search: the field opens, "search" is typed, the search runs, the magnifier settles
put(verb(tick(0.7), 0.25), T(500), -25)
for k in range(6): put(tick(1.0 + 0.05 * k), T(504.2 + k * 1.05), -26, pan=0.2)
put(verb(whoosh(0.2 + 0.0, 2000, 7000, 0.85), 0.3), T(510), -33)
put(verb(blip(G['D6'], 0.35), 0.45), T(512.5), -28)
# typing the symptom (S06), the Done click (S07)
for f in range(563, 587): put(tick(0.9 + 0.2 * rng.random()), T(f) + 0.008 * rng.random(), -27 + 2 * rng.random(), pan=rng.uniform(-0.15, 0.15))
put(verb(tick(0.75), 0.2), T(698), -21); put(verb(blip(1046.5, 0.12), 0.3), T(698.2), -29)
# into the processing scene; the ticker change
put(verb(whoosh(1.0, 400, 4200, 0.65)), T(712), -23)
put(tick(1.1), T(726), -33)
put(verb(whoosh(0.4, 900, 4000, 0.5), 0.25), T(779), -33)
# processing (anatomy shot): the scan sweeps down the body, the affected spot is found, each connection lands
put(verb(whoosh(1.05, 3800, 900, 0.5, 1.2), 0.3), T(730), -31, pan=0.25)
put(thump(60, 44, 0.6), T(750), -29)
put(verb(bell([G['G4'], G['D5']], 2.4, 0.6), 0.5), T(750), -31, pan=0.3)
put(verb(whoosh(0.35, 1800, 5200, 0.6, 1.0), 0.25), T(802), -33, pan=-0.3)                 # underline under "connections"
put(verb(whoosh(0.4, 900, 3600, 0.7, 1.0), 0.3), T(806.5), -32, pan=0.2)                   # the line flows into the spot
put(verb(bell([G['D5']], 1.6, 0.4), 0.45), T(814), -32, pan=0.3)                           # arrival
for k, (fr, nt) in enumerate([(821, G['G5']), (824, G['Bb5']), (827, 1046.5), (829, G['D6'])]): put(verb(blip(nt, 0.22), 0.45), T(fr), -33, pan=0.2 + 0.1 * k)
# doctor cards: decode, lock, scan, chip; window outro
for k in range(14): put(blip(2300 + 2400 * rng.random(), 0.016), T(1056 + k * 0.55) + 0.01 * rng.random(), -33, pan=rng.uniform(-0.4, 0.4))
put(verb(tick(0.8), 0.3), T(1062.8), -23); put(verb(blip(1567.98, 0.25), 0.4), T(1063), -28)
put(verb(whoosh(0.3, 1500, 6500, 0.6), 0.3), T(1058.5), -35)
put(verb(bell([G['G5'], G['D6']], 1.6, 0.5), 0.45), T(1064), -34)
put(verb(whoosh(1.2, 3000, 250, 0.35)), T(1074), -25)
# profile scroll
put(verb(whoosh(0.5, 600, 3500, 0.6), 0.25), T(1118), -27, pan=-0.1)
# the hero statement: a soft swell as the first line glides up, air as the arrow draws, a small chime as it lands
put(verb(whoosh(0.55, 500, 2600, 0.6), 0.3), T(1202), -29)
put(verb(whoosh(0.5, 1400, 6000, 0.7), 0.3), T(1243), -29, pan=0.3)
put(verb(bell([G['D5'], G['A4'] * 2], 1.6, 0.3), 0.45), T(1254), -33, pan=0.4)
# finale: rise, thump and a fuller bell chord on the last "Claude"; air under the wipe; pad + chime under the credit
put(whoosh(1.2, 250, 5200, 0.95), T(1268) - 1.12, -29)
put(thump(70, 42, 1.2), T(1268), -17)
put(verb(bell([G['G3'], G['D4'], G['G4'], G['Bb4'], G['D5']], 4.5, 0.9), 0.55), T(1268), -24)
put(verb(whoosh(0.6, 1200, 6000, 0.35, 0.7), 0.3), T(1276), -31, pan=0.35)
put(verb(whoosh(0.7, 300, 1500, 0.6), 0.3), T(1316), -36)                                 # the lockup lifts
put(verb(pad([G['G3'], G['Bb3'], G['D4'], G['A4']], T(1440) - T(1326), 2.2, 2.6), 0.4), T(1326), -33)
# Claude writes the credit: a faint breath of air rises with the stream (no typing clicks), and a soft chord rings
# as the last letter settles and the mark comes to rest
put(verb(whoosh(0.95, 1800, 5200, 0.8, 1.1), 0.35), T(1334), -41, pan=-0.15)
put(verb(bell([G['D5'], G['G5'], G['Bb5']], 3.0, 0.45), 0.55), T(1361), -33)
# the loop: the credit un-writes, the wordmark folds back into the mark, night falls, the mark winds down into the
# opening's point of light while the "ahh" swells in reverse into the last frame; the film's first frames carry the "ahh"
put(verb(whoosh(0.35, 7000, 2500, 0.5, 1.2), 0.25), T(1398), -38, pan=0.2)
put(verb(whoosh(0.5, 6000, 1200, 0.25, 0.8), 0.3), T(1402), -33, pan=0.25)
SW = reverse_swell(AHH, AHH_ON)
put(SW, N / SR - len(SW) / SR, -21)
# =============================================================== duck under the narration, mix, master
voc, vsr = sf.read(f'{S}/audio/vocals_htdemucs_ft.wav'); voc = voc.mean(1) if voc.ndim > 1 else voc
env = np.sqrt(lp(voc ** 2, 8.0, 1).clip(0)); env = np.pad(env, (0, max(0, N - len(env))))[:N]
env = env / (np.percentile(env[env > 1e-4], 95) + 1e-9)
duck = 1 - 0.55 * np.clip(env, 0, 1)
mix = base + fx * duck[:, None]
k = int(0.003 * SR); mix[:k] *= np.linspace(0, 1, k)[:, None]; mix[-k:] *= np.linspace(1, 0, k)[:, None]   # no click at the loop point
tmp = f'{S}/audio/work/sd_mix.wav'; os.makedirs(os.path.dirname(tmp), exist_ok=True)
sf.write(tmp, mix.astype(np.float32), SR, subtype='FLOAT')
out = sys.argv[1]
chain = 'highpass=f=28,acompressor=threshold=-20dB:ratio=2.2:attack=15:release=180:knee=6,equalizer=f=3200:t=q:w=1.0:g=1.2,highshelf=f=11000:g=1.0'
m = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', tmp, '-af', chain + ',loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
ln = f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', chain + ',' + ln, '-ar', str(SR), '-c:a', 'pcm_s16le', out], check=True)
print('fx peak dBFS', round(20 * np.log10(np.abs(fx).max() + 1e-9), 1), 'pre-master', js['input_i'], 'LUFS')

"""Voice processing + stem mix: narration up front, SFX under it, music bed
quiet and ducked under the voice. Writes audio/mix.wav (48 kHz stereo)."""
import sys, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
S = sys.argv[1]
SR = 48000
vo, _ = sf.read(f'{S}/audio/vo_track.wav', dtype='float64')
sfx, _ = sf.read(f'{S}/audio/sfx.wav', dtype='float64')
mus, _ = sf.read(f'{S}/audio/music.wav', dtype='float64')
N = len(vo)
meter = pyln.Meter(SR)


def shelf(x, f, gain_db, kind):
    # RBJ biquad shelving filter
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; c, s = np.cos(w), np.sin(w)
    al = s / 2 * np.sqrt(2)
    if kind == 'low':
        b = [A * ((A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al)]
        a = [(A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al]
    else:
        b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
        a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    from scipy.signal import lfilter
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x)


def peak_eq(x, f, gain_db, q=1.0):
    from scipy.signal import lfilter
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
    b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x)


def compress(x, thr_db=-20, ratio=3.0, att=0.005, rel=0.12):
    from scipy.ndimage import maximum_filter1d
    from scipy.signal import lfilter
    env = maximum_filter1d(np.abs(x), int(att * SR) * 2 + 1)
    a = np.exp(-1 / (rel * SR))
    env = lfilter([1 - a], [1, -a], env)
    db = 20 * np.log10(env + 1e-9)
    gr = np.minimum(0, (thr_db - db) * (1 - 1 / ratio))
    return x * 10 ** (gr / 20)


# --- voice chain: rumble cut, warmth, presence, gentle compression, small room
v = sosfilt(butter(2, 75, 'highpass', fs=SR, output='sos'), vo)
v = shelf(v, 160, 2.5, 'low')
v = peak_eq(v, 3200, 2.0, 0.9)
v = shelf(v, 9000, -1.5, 'high')
v = compress(v / (np.abs(v).max() + 1e-9), -16, 2.5)
rng = np.random.default_rng(3)
n_ir = int(0.5 * SR)
ir = rng.standard_normal(n_ir) * np.exp(-np.arange(n_ir) / SR / 0.12)
ir = sosfilt(butter(2, 5000, 'lowpass', fs=SR, output='sos'), ir); ir /= np.sqrt(np.sum(ir ** 2))
v_wet = fftconvolve(v, ir)[:N]
v = v + 0.07 * v_wet
v_st = np.stack([v, v], 1)


def to_lufs(x, target):
    l = meter.integrated_loudness(x)
    return x * 10 ** ((target - l) / 20)


v_st = to_lufs(v_st, -16.0)
import os
SFX_L = float(os.environ.get('SFX_LUFS', -25)); MUS_L = float(os.environ.get('MUS_LUFS', -29))
USE = os.environ.get('USE', 'vsm')
sfx = to_lufs(sfx, SFX_L) * ('s' in USE)
mus = to_lufs(mus, MUS_L) * ('m' in USE)
# duck the music ~6 dB while the narrator speaks
env = np.abs(v)
k = int(0.05 * SR)
env = np.convolve(env, np.ones(k) / k, 'same')
active = (env > env.max() * 0.04).astype(float)
k2 = int(0.35 * SR)
active = np.convolve(active, np.ones(k2) / k2, 'same')
duck = 10 ** (-6.0 * np.clip(active * 1.5, 0, 1) / 20)
SFX_DUCK = float(os.environ.get('SFX_DUCK', 5.0))
MID_DUCK = float(os.environ.get('MID_DUCK', 14.0))
act = np.clip(active * 1.5, 0, 1)[:, None]
# dynamic EQ: clear the speech band harder than the lows/highs
lo_b = sosfilt(butter(4, 300, 'lowpass', fs=SR, output='sos'), sfx, axis=0)
hi_b = sosfilt(butter(4, 3500, 'highpass', fs=SR, output='sos'), sfx, axis=0)
mid_b = sfx - lo_b - hi_b
sfx_d = (lo_b + hi_b) * 10 ** (-SFX_DUCK * act / 20) + mid_b * 10 ** (-MID_DUCK * act / 20)
mix = v_st + sfx_d + mus * duck[:, None]
mix = to_lufs(mix, -14.5)
pk = np.abs(mix).max()
if pk > 0.89:     # soft safety limiter for the few transient peaks
    mix = np.tanh(mix / 0.89) * 0.89
print('mix', round(meter.integrated_loudness(mix), 1), 'peak', round(float(np.abs(mix).max()), 3))
sf.write(f'{S}/audio/' + os.environ.get('OUT', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')

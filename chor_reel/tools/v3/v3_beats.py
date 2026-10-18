"""Song timing for v3 (from the Whisper word timestamps of the original audio) + voice envelope."""
import os, json
import numpy as np

S = os.environ.get('CHOR_S', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FPS = 30


def f(t):
    return int(round(t * FPS))


# each line of the song: (name, line start, key word sung, "ले जा" sung)  -- frames
LINES = [
    ('jeet', f(21.40), f(22.30), f(23.28)),     # मेरी जीत भी ले जा      victory
    ('haar', f(23.76), f(24.22), f(25.30)),     # मेरी हार भी ले जा      defeat
    ('dar', f(25.78), f(26.24), f(27.30)),      # मेरा डर भी ले जा       fear
    ('ghar', f(27.78), f(28.26), f(29.30)),     # मेरा घर भी ले जा       home
    ('khwab', f(29.80), f(30.20), f(31.28)),    # मेरे ख़्वाब भी ले जा    dreams
    ('raaz', f(31.78), f(32.26), f(33.30)),     # मेरे राज़ भी ले जा      secrets
    ('gham', f(33.78), f(34.28), f(35.32)),     # मेरा ग़म भी ले जा       sorrow
    ('zakhm', f(35.76), f(36.02), f(37.30)),    # हर ज़ख़्म भी ले जा       wounds
    ('zaat', f(37.78), f(38.30), f(39.28)),     # मेरी ज़ात भी ले जा      identity
    ('auqaat', f(39.80), f(39.95), f(41.26)),   # औक़ात भी ले जा          standing
    ('baat', f(41.76), f(42.28), f(43.28)),     # मेरी बात भी ले जा       words
    ('haalaat', f(43.74), f(43.90), f(45.26)),  # हालात भी ले जा          circumstances
]
LINE = {nm: (a, k, l) for nm, a, k, l in LINES}

# story words before the list
W_CHOR = f(6.12)        # "इक चोर"  -> lantern flare reveals him
W_AAKE = f(8.42)        # "आके"     -> the boat touches the steps
W_DEDE = f(11.12)       # "दे दे"
W_MUJHE = f(12.96)      # "मुझे"    -> hand held out
W_MAINE = f(15.52)      # "मैंने बोला"

_ENV = None


def voice(n):
    """0..1 voice loudness at frame n (300-3400 Hz band, smoothed)."""
    global _ENV
    if _ENV is None:
        e = np.array(json.load(open(S + '/v3/audio_env.json'))['env'], np.float32)
        k = np.array([0.25, 0.5, 0.25], np.float32)
        _ENV = np.convolve(e, k, mode='same')
    n = int(np.clip(n, 0, len(_ENV) - 1))
    return float(np.clip(_ENV[n], 0, 1.5))


def current_line(n):
    """(name, start, key, leja) of the line playing at frame n, or None."""
    cur = None
    for ln in LINES:
        if n >= ln[1]:
            cur = ln
    return cur


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def ramp(n, a, b):
    return float(np.clip((n - a) / max(1e-6, b - a), 0, 1))

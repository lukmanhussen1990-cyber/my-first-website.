"""Synthesizes short, mobile-friendly OGG sound effects (22 kHz mono) with pure Python + ffmpeg."""
import math, random, wave, struct, subprocess, os, json, tempfile
SR = 22050
RP = os.path.join(os.path.dirname(__file__), '..', 'addon', 'BunkerArsenal_RP')
OUT = os.path.join(RP, 'sounds', 'bunker')

def n(dur): return int(SR * dur)
def zeros(k): return [0.0] * k
def noise(k, seed=1):
    r = random.Random(seed); return [r.uniform(-1, 1) for _ in range(k)]
def lowpass(x, fc):
    dt = 1 / SR; rc = 1 / (2 * math.pi * fc); a = dt / (rc + dt); y = []; p = 0.0
    for v in x:
        p += a * (v - p); y.append(p)
    return y
def highpass(x, fc):
    dt = 1 / SR; rc = 1 / (2 * math.pi * fc); a = rc / (rc + dt); y = []; p = 0.0; px = 0.0
    for v in x:
        p = a * (p + v - px); px = v; y.append(p)
    return y
def env_exp(k, tau, start=0.0):
    s = int(start * SR)
    return [0.0 if i < s else math.exp(-(i - s) / (tau * SR)) for i in range(k)]
def env_lin(k, attack, release):
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    return [min(1.0, i / a, (k - i) / r) for i in range(k)]
def mul(x, e): return [a * b for a, b in zip(x, e)]
def gain(x, g): return [a * g for a in x]
def tone(k, f0, f1=None, harm=0.0, fm=0.0, fmrate=0.0):
    f1 = f0 if f1 is None else f1; ph = 0.0; y = []
    for i in range(k):
        t = i / k
        f = f0 * (f1 / f0) ** t if f0 > 0 and f1 > 0 else f0 + (f1 - f0) * t
        f += fm * math.sin(2 * math.pi * fmrate * i / SR)
        ph += 2 * math.pi * f / SR
        y.append(math.sin(ph) + harm * math.sin(3 * ph) / 3)
    return y
def mix(*parts):
    L = max(len(p) for p in parts); out = zeros(L)
    for p in parts:
        for i, v in enumerate(p): out[i] += v
    return out
def at(x, start):
    return zeros(int(start * SR)) + x
def normalize(x, peak=0.85):
    m = max(1e-6, max(abs(v) for v in x)); return [v / m * peak for v in x]
def click(dur=0.006, fc=1500, seed=5):
    return highpass(mul(noise(n(dur), seed), env_exp(n(dur), dur / 2)), fc)
def shot(dur, lp, tau, thump_f0, thump_f1, thump_tau, thump_amp, seed, crack=0.0):
    k = n(dur)
    body = mul(lowpass(noise(k, seed), lp), env_exp(k, tau))
    th = gain(mul(tone(k, thump_f0, thump_f1), env_exp(k, thump_tau)), thump_amp)
    parts = [body, th]
    if crack:
        parts.append(gain(mul(highpass(noise(n(0.015), seed + 1), 2500), env_exp(n(0.015), 0.004)), crack))
    return normalize(mix(*parts))

SOUNDS = {}
SOUNDS['shot_pistol'] = shot(0.2, 3500, 0.03, 160, 60, 0.05, 0.6, 11, crack=0.8)
SOUNDS['shot_smg'] = shot(0.13, 4500, 0.02, 130, 55, 0.03, 0.5, 12, crack=0.6)
SOUNDS['shot_rifle'] = shot(0.27, 3000, 0.045, 115, 45, 0.07, 0.8, 13, crack=0.9)
SOUNDS['shot_shotgun'] = shot(0.42, 1800, 0.09, 95, 35, 0.12, 1.0, 14, crack=0.5)
SOUNDS['shot_dmr'] = shot(0.36, 2500, 0.06, 85, 40, 0.1, 0.9, 15, crack=1.0)
SOUNDS['shot_lmg'] = shot(0.22, 2600, 0.04, 105, 45, 0.06, 0.8, 16, crack=0.7)
k = n(0.16)
SOUNDS['shot_pulse'] = normalize(mix(mul(tone(k, 1400, 350, harm=0.6), env_exp(k, 0.05)), gain(mul(lowpass(noise(k, 17), 6000), env_exp(k, 0.02)), 0.3)))
k = n(0.22)
SOUNDS['shot_plasma'] = normalize(mix(mul(tone(k, 700, 180, harm=0.4, fm=30, fmrate=40), env_exp(k, 0.08)), gain(mul(lowpass(noise(k, 18), 2000), env_exp(k, 0.05)), 0.4)))
k = n(0.55)
SOUNDS['rail_charge'] = normalize(mul(tone(k, 180, 1900, harm=0.3), [min(1.0, (i / k) ** 1.5 * 1.1) * (1.0 if i < k - n(0.02) else (k - i) / n(0.02)) for i in range(k)]))
k = n(0.5)
SOUNDS['shot_rail'] = normalize(mix(mul(lowpass(noise(k, 19), 1500), env_exp(k, 0.1)), gain(mul(tone(k, 70, 30), env_exp(k, 0.15)), 0.9), gain(mul(tone(k, 2400, 2000), env_exp(k, 0.12)), 0.3)))
k = n(0.6)
SOUNDS['rocket_launch'] = normalize(mix(mul(lowpass(noise(k, 20), 900), [min(1.0, i / n(0.05)) * math.exp(-max(0, i - n(0.05)) / (0.25 * SR)) for i in range(k)]), gain(mul(tone(k, 60, 40), env_exp(k, 0.1)), 0.7)))
SOUNDS['reload'] = normalize(mix(click(0.008, 1200, 21), at(gain(mul(lowpass(noise(n(0.12), 22), 2500), env_exp(n(0.12), 0.05)), 0.5), 0.06), at(click(0.01, 900, 23), 0.3), at(gain(mul(tone(n(0.05), 300, 200), env_exp(n(0.05), 0.02)), 0.5), 0.3)))
SOUNDS['empty_click'] = normalize(mix(click(0.008, 1800, 24), gain(mul(tone(n(0.03), 1200, 900), env_exp(n(0.03), 0.01)), 0.4)))
k = n(0.75)
slide = mul(lowpass(noise(k, 25), 900), env_lin(k, 0.1, 0.15))
clunk = at(mix(mul(tone(n(0.12), 90, 60), env_exp(n(0.12), 0.06)), gain(click(0.01, 600, 26), 0.6)), 0.62)
SOUNDS['door_open'] = normalize(mix(gain(slide, 0.6), clunk))
SOUNDS['door_close'] = normalize(mix(gain(slide, 0.6), at(mix(mul(tone(n(0.16), 80, 50), env_exp(n(0.16), 0.08)), gain(click(0.012, 500, 27), 0.8)), 0.6)))
SOUNDS['console_beep'] = normalize(mix(mul(tone(n(0.07), 880), env_exp(n(0.07), 0.03)), at(mul(tone(n(0.07), 1320), env_exp(n(0.07), 0.03)), 0.1)))
SOUNDS['ui_open'] = normalize(mix(mul(tone(n(0.05), 660), env_exp(n(0.05), 0.02)), at(mul(tone(n(0.05), 990), env_exp(n(0.05), 0.02)), 0.06)))
k = n(1.0)
SOUNDS['alarm'] = normalize([v * (1 if i < k - n(0.05) else (k - i) / n(0.05)) for i, v in enumerate(tone(k, 620, 620, harm=0.5, fm=260, fmrate=2))])
SOUNDS['crate_open'] = normalize(mix(gain(mul(lowpass(noise(n(0.25), 28), 1200), env_lin(n(0.25), 0.05, 0.1)), 0.5), at(mul(tone(n(0.1), 70, 50), env_exp(n(0.1), 0.08)), 0.25)))
SOUNDS['hit_marker'] = normalize(mix(mul(tone(n(0.04), 1800), env_exp(n(0.04), 0.012)), gain(mul(tone(n(0.04), 2400), env_exp(n(0.04), 0.01)), 0.5)))
SOUNDS['grenade_pin'] = normalize(mix(mul(tone(n(0.15), 3100), env_exp(n(0.15), 0.06)), gain(mul(tone(n(0.15), 4600), env_exp(n(0.15), 0.03)), 0.5)))
SOUNDS['stun_pop'] = normalize(mix(mul(lowpass(noise(n(0.15), 29), 8000), env_exp(n(0.15), 0.03)), gain(mul(tone(n(0.15), 2500), env_exp(n(0.15), 0.1)), 0.4)))
SOUNDS['weapon_jam'] = normalize(mix(gain(mul(lowpass(noise(n(0.02), 30), 3000), env_exp(n(0.02), 0.008)), 1.0), at(mul(tone(n(0.06), 400, 250), env_exp(n(0.06), 0.02)), 0.02)))

DEFS = {
    'shot_pistol': ('player', 1.0, 72), 'shot_smg': ('player', 0.9, 64), 'shot_rifle': ('player', 1.0, 80), 'shot_shotgun': ('player', 1.0, 80),
    'shot_dmr': ('player', 1.0, 96), 'shot_lmg': ('player', 1.0, 80), 'shot_pulse': ('player', 0.9, 64), 'shot_plasma': ('player', 0.9, 64),
    'rail_charge': ('player', 0.8, 48), 'shot_rail': ('player', 1.0, 110), 'rocket_launch': ('player', 1.0, 80), 'reload': ('player', 0.7, 16),
    'empty_click': ('player', 0.6, 12), 'door_open': ('block', 0.9, 24), 'door_close': ('block', 0.9, 24), 'console_beep': ('block', 0.6, 16),
    'ui_open': ('ui', 0.5, 8), 'alarm': ('block', 1.0, 48), 'crate_open': ('block', 0.8, 16), 'hit_marker': ('ui', 0.6, 8),
    'grenade_pin': ('player', 0.6, 16), 'stun_pop': ('neutral', 1.0, 48), 'weapon_jam': ('player', 0.7, 12),
}

def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in x))

def run():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    defs = {}
    for name, x in SOUNDS.items():
        wav = os.path.join(tmp, name + '.wav'); write_wav(wav, x)
        ogg = os.path.join(OUT, name + '.ogg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '2', ogg], check=True)
        cat, vol, dist = DEFS[name]
        defs['bunker.' + name] = {'category': cat, 'max_distance': dist, 'sounds': [{'name': 'sounds/bunker/' + name, 'volume': vol, 'load_on_low_memory': True}]}
    with open(os.path.join(RP, 'sounds', 'sound_definitions.json'), 'w') as f:
        json.dump({'format_version': '1.14.0', 'sound_definitions': defs}, f, indent=2)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('wrote', len(defs), 'sounds,', total // 1024, 'KB total')

if __name__ == '__main__':
    run()

#!/usr/bin/env python3
"""Lay out the voice and sound-effect stems on the timeline (build/timeline.json).

Writes audio/mix/vo.wav (mono), audio/mix/sfx.wav and audio/mix/stingers.wav (stereo; stingers are not ducked). Door-Mom's line is muffled
with an ffmpeg low-pass before it is placed. Ducking + loudness happen afterwards in ffmpeg.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_util import SR, decode, write_wav  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)  # noqa: E731

VO_LEVEL = 10 ** (-20 / 20)   # every line: active-speech RMS at -20 dBFS (peaks kept under -1 dBFS)
SFX_MASTER = 0.24             # sound-design bus sits ~8-9 dB under the voice (before ducking)


def speech_rms(sig):
    """RMS over the voiced 10 ms windows only (ignores pauses), so every take lands at the same level."""
    n = int(0.01 * SR)
    m = len(sig) // n
    r = np.sqrt((sig[: m * n].reshape(m, n) ** 2).mean(axis=1) + 1e-12)
    act = r[r > r.max() * 10 ** (-30 / 20)]
    return float(np.sqrt((act ** 2).mean()))


DOOR_FILTER = 'highpass=f=240,lowpass=f=1100:p=2,lowpass=f=1600,aecho=0.8:0.55:28|61:0.22|0.12,volume=0.9'


def load(name):
    """ElevenLabs-generated effect if cached (audio/sfx/eleven), else the numpy synth version."""
    el = P('audio', 'sfx', 'eleven', name)
    return decode(el if os.path.exists(el) else P('audio', 'sfx', name)).astype(np.float64)


class Bus:
    def __init__(self, dur, ch=2):
        self.n = int(dur * SR) + SR
        self.x = np.zeros((self.n, ch))

    def place(self, sig, t, gain=1.0, pan=0.0):
        a = int(round(t * SR))
        if a >= self.n:
            return
        if a < 0:
            sig, a = sig[-a:], 0
        sig = sig[: self.n - a] * gain
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        if self.x.shape[1] == 1:
            self.x[a: a + len(sig), 0] += sig
        else:
            self.x[a: a + len(sig), 0] += sig * lg * np.sqrt(2)
            self.x[a: a + len(sig), 1] += sig * rg * np.sqrt(2)

    def bed(self, sig, gain_curve, pan=0.0, start=0.0):
        """Loop `sig` from `start` to the end, multiplied by a per-sample gain curve."""
        a = int(start * SR)
        reps = int(np.ceil((self.n - a) / len(sig))) + 1
        loop = np.tile(sig, reps)[: self.n - a] * gain_curve[a:]
        self.place(loop, start, 1.0, pan)


def curve(n, keys):
    """Piecewise-linear automation: keys = [(t, value), ...] (times in seconds)."""
    t = np.arange(n) / SR
    ks = sorted(keys)
    return np.interp(t, [k[0] for k in ks], [k[1] for k in ks])


def main():
    tl = json.load(open(P('build', 'timeline.json')))
    ev = tl['events']
    S = {s['key']: s for s in tl['scenes']}
    dur = tl['duration']
    os.makedirs(P('audio', 'mix'), exist_ok=True)

    # ------------------------------------------------------------------ VO stem
    vo = Bus(dur, 1)
    for s in tl['scenes']:
        for L in s['lines']:
            if L.get('missing'):
                continue
            src = P('audio', 'vo', f"{L['id']}.wav")
            if L.get('fx') == 'door':
                out = P('audio', 'mix', f"{L['id']}_door.wav")
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', DOOR_FILTER, out], check=True)
                src = out
            sig = decode(src).astype(np.float64)
            gain = VO_LEVEL / speech_rms(sig) * (1.25 if L.get('fx') == 'door' else 1.0)
            gain = min(gain, 10 ** (-1 / 20) / (np.max(np.abs(sig)) + 1e-9))
            vo.place(sig, L['start'], gain)
    write_wav(P('audio', 'mix', 'vo.wav'), vo.x[: int(dur * SR) + int(0.5 * SR)])

    # ------------------------------------------------------------------ SFX stem
    fx = Bus(dur, 2)
    n = fx.n
    sil0, sil1 = ev['silence']
    texting = S['texting']
    after_mom = texting['lines'][0]['end']
    # scenes where the camera is in the kitchen (kitchen sounds louder, TV further away)
    kitchen = {'dinner', 'who', 'shadow', 'texting', 'turn'}
    cam_keys = []
    for s in tl['scenes']:
        k = 1.0 if s['key'] in kitchen else 0.0
        if s['key'] == 'humming':  # kitchen first, then the clock insert in the living room
            cam_keys += [(s['start'], 1.0), (ev['clockInsert'][0] - 0.01, 1.0), (ev['clockInsert'][0] + 0.05, 0.0), (s['end'] - 0.01, 0.0)]
            continue
        cam_keys += [(s['start'] + 0.02, k), (s['end'] - 0.02, k)]
    kit = curve(n, cam_keys)  # 1 = kitchen camera, 0 = living room camera

    # sudden silence before scene 7: everything drops out, comes back after Mom's line
    silence = curve(n, [(0, 1), (sil0 - 0.03, 1), (sil0, 0), (after_mom + 0.1, 0), (after_mom + 1.6, 1), (dur + 1, 1)])

    # TV cartoon + canned laughter: keeps playing under everything (until the very end)
    tv_gain = (0.26 - 0.08 * kit) * silence
    fx.bed(load('tv_cartoon.wav'), tv_gain, pan=-0.1)
    for i, L in enumerate(ev['laughs']):
        g = (0.62 if L['gag'] < S['phone']['start'] else 0.5) * L['intensity']
        tt = L['start']
        if sil0 - 3 < tt < after_mom + 1.6:
            continue
        g *= 1 - 0.3 * np.interp(tt, np.arange(n) / SR, kit)
        fx.place(load(f'laugh_{i % 6}.wav'), tt, g, pan=-0.05)
        fx.place(load(f'gag_{i % 3}.wav'), L['gag'], 0.32 * (1 - 0.3 * np.interp(tt, np.arange(n) / SR, kit)), pan=-0.1)

    # Mom's humming (kitchen) - stops dead at "The humming stops"
    hum = load('hum.wav')
    hs, he = ev['humStart'], ev['humStop']
    hum_gain = curve(len(hum), [(0, 0), (0.6, 1), (he - hs - 0.03, 1), (he - hs, 0), (99, 0)])
    hum_gain *= np.interp(np.arange(len(hum)) / SR + hs, np.arange(n) / SR, 0.45 + 0.55 * kit)
    fx.place(hum * hum_gain, hs, 0.42, pan=0.15)

    # spoon stirring, synced to the 1.2 s stir cycle; stops with "the stirring stops"
    stir = load('stir_cycle.wav')
    period = ev['stirPeriod']
    stop = ev['stirStop']
    k = 0
    while k * period < stop + 0.6:
        t0 = k * period
        g = 0.32 * (0.35 + 0.65 * np.interp(t0, np.arange(n) / SR, kit))
        sig = stir.copy()
        if t0 + period > stop:  # last circle fades out over the deceleration
            m = np.clip((stop + 0.6 - (t0 + np.arange(len(sig)) / SR)) / 0.6, 0, 1)
            sig *= m
        fx.place(sig, t0, g, pan=0.2)
        k += 1

    # kitchen ambience: pan sizzle + fridge hum
    sz = load('sizzle.wav')
    fx.bed(sz, (0.05 + 0.1 * kit) * silence, pan=0.25)
    fx.bed(load('fridge.wav'), (0.035 + 0.03 * kit) * silence, pan=-0.3)

    # ticking clock: barely audible early, exposed once the humming stops
    tick, tock = load('tick.wav'), load('tock.wav')
    ci0 = ev['clockInsert'][0]
    clock_gain = curve(n, [(0, 0.05), (he, 0.05), (he + 0.3, 0.2), (ci0, 0.22), (ci0 + 0.1, 0.42), (S['humming']['end'], 0.42), (S['humming']['end'] + 0.1, 0.2), (dur + 1, 0.18)]) * silence
    for sec in range(int(dur) + 1):
        g = clock_gain[min(n - 1, int(sec * SR))]
        if g > 0.001:
            fx.place(tick if sec % 2 == 0 else tock, float(sec), g, pan=0.1)

    # phone buzz
    for b in ev['phoneBuzz']:
        fx.place(load('phone_buzz.wav'), b, 0.75, pan=-0.2)
    # popcorn crunches
    for p in ev['popcorn']:
        fx.place(load('popcorn.wav'), p + 0.05, 0.42)

    # low horror drone: fades in from scene 4 and grows with the fear
    dr = load('drone.wav')
    d0 = ev['droneStart']
    door = S['doorbell']
    dr_gain = curve(n, [(0, 0), (d0, 0), (d0 + 3, 0.22), (S['shadow']['start'], 0.32), (sil0 - 0.03, 0.36), (sil0, 0),
                        (texting['lines'][0]['start'], 0), (texting['lines'][0]['start'] + 0.4, 0.3),
                        (door['start'], 0.42), (door['lines'][0]['start'] - 0.2, 0.42), (door['lines'][0]['start'], 0.26),
                        (door['end'] - 0.3, 0.3), (door['end'], 0.42), (S['turn']['end'], 0.45), (dur, 0.42), (dur + 1, 0.42)])
    fx.place(dr[: n] * dr_gain[: len(dr)], 0, 1.0)

    # stingers bypass the voice ducking so they always hit on the frame (doorbell, hits, risers, knocks)
    st = Bus(dur, 2)
    for k in ev.get('knocks', []):
        st.place(load('knock.wav'), k, 0.8, pan=0.35)
    st.place(load('doorbell.wav'), ev['doorbell'], 0.95, pan=0.35)
    hit = load('bass_hit.wav')
    riser = load('riser.wav')
    line_starts = [L['start'] for sc in tl['scenes'] for L in sc['lines']]
    for s in ev['scares']:
        s = np.ceil(s * tl['fps'] - 1e-6) / tl['fps']  # first frame that shows the scare
        h = hit.copy()
        nxt = [ls for ls in line_starts if s < ls < s + 1.5]
        if nxt:  # let the boom get out of the way of the next spoken word
            tt = np.arange(len(h)) / SR
            h *= np.interp(tt, [0, nxt[0] - s - 0.08, nxt[0] - s + 0.06, 99], [1, 1, 0.3, 0.3])
        st.place(h, s, 0.95)
        if abs(s - ev['doorbell']) > 0.5:
            st.place(riser, s - len(riser) / SR, 0.35)

    end = int(dur * SR) + int(0.5 * SR)
    write_wav(P('audio', 'mix', 'sfx.wav'), np.clip(fx.x[:end] * SFX_MASTER, -1, 1))
    write_wav(P('audio', 'mix', 'stingers.wav'), np.clip(st.x[:end] * SFX_MASTER, -1, 1))
    print(f'  stems: vo.wav + sfx.wav + stingers.wav ({dur:.2f}s)')


if __name__ == '__main__':
    main()

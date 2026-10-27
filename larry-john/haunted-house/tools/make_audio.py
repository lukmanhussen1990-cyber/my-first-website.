#!/usr/bin/env python3
"""Build the reel's audio from the cues the 3D shots placed:

  - a code-made sound effect on every cue (build/cues.json "sfx") and a soft pop under every label
  - the music track (its own stem): stops dead at midnight, funny sting when the ghost screams, back for the ending
  - the voice (file named in build/timing.json) and the "JOHN!" shouts (beat 13 with a long echo)
  - mixed with the voice on top (music and effects duck under it), normalized to about -14 LUFS, peaks under -1 dBTP

  python3 tools/make_audio.py          (after tools/align_voice.py and the cues pass)

Writes build/audio/{voice,shouts,sfx,music,mix}.wav and build/audio/report.json.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))     # larry-john/ (engine package)
from common import REEL, BUILD, read_mono                      # noqa: E402
from engine.audio import sfxlib                                # noqa: E402
from engine.audio.dsp import SR, n_of, mix_at, db, loudness_lufs, true_peak_db, limiter, echo, reverb, to_stereo, lowpass  # noqa: E402
from engine.audio.music import spooky_groove                   # noqa: E402

OUT = os.path.join(BUILD, 'audio')
SFX_CACHE = os.path.join(OUT, 'sfx_lib')

VOICE_LUFS = -16.0        # voice stem before the final loudness pass
MUSIC_LUFS = -21.0        # music bed, before ducking
SFX_LEVEL = -19.0         # loudest 100 ms of every effect (dBFS RMS), before its cue gain
TARGET_LUFS = -14.0
CEILING = -1.0


def short_rms_max(x, win=0.1):
    m = x.mean(axis=1) if x.ndim == 2 else x
    k = n_of(win)
    p = np.convolve(m ** 2, np.ones(k) / k, mode='valid') if len(m) > k else np.array([np.mean(m ** 2)])
    return 10 * np.log10(np.max(p) + 1e-12)


def sfx_sound(name):
    os.makedirs(SFX_CACHE, exist_ok=True)
    path = os.path.join(SFX_CACHE, name + '.wav')
    if os.path.exists(path):
        x, _ = sf.read(path, dtype='float32', always_2d=True)
        return x.astype(float)
    x = sfxlib.make(name, seed=sum(map(ord, name)))
    x = x * db(SFX_LEVEL - short_rms_max(x))
    peak = np.max(np.abs(x))
    if peak > 0.98:
        x *= 0.98 / peak
    sf.write(path, x.astype(np.float32), SR, subtype='FLOAT')
    return x


def envelope(x, attack=0.03, release=0.35):
    """Smoothed level of a mono signal (for ducking)."""
    k = n_of(0.02)
    lvl = np.sqrt(np.convolve(x ** 2, np.ones(k) / k, mode='same'))
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    out = np.empty_like(lvl)
    cur = 0.0
    # decimate the follower to keep it fast, then interpolate back
    step = 48
    idx = np.arange(0, len(lvl), step)
    vals = np.empty(len(idx))
    a, r = a ** step, r ** step
    for i, j in enumerate(idx):
        v = lvl[j]
        cur = v + (cur - v) * (a if v > cur else r)
        vals[i] = cur
    out = np.interp(np.arange(len(lvl)), idx, vals)
    return out


def duck_gain(voice_env, depth_db, thresh_db=-40.0):
    """Gain curve: full ducking when the voice is clearly on, none in the gaps."""
    lv = 20 * np.log10(voice_env + 1e-9)
    k = np.clip((lv - thresh_db) / 12.0, 0, 1)
    return db(-depth_db * k)


def main():
    timing = json.load(open(os.path.join(BUILD, 'timing.json')))
    cues = json.load(open(os.path.join(BUILD, 'cues.json')))
    dur = float(timing['duration'])
    N = n_of(dur)
    os.makedirs(OUT, exist_ok=True)

    # ---- voice
    vpath = timing['voice'] if os.path.isabs(timing['voice']) else os.path.join(REEL, timing['voice'])
    v = read_mono(vpath)
    v = np.pad(v, (0, max(0, N - len(v))))[:N].astype(float)
    v *= db(VOICE_LUFS - loudness_lufs(v))
    voice = to_stereo(v)

    # ---- shouts ("JOHN!"), beat 13 echoes down the pit
    shouts = np.zeros((N, 2))
    for s in timing.get('shouts', []):
        if s.get('over_narration'):
            continue        # the shout is already inside the narration file
        sp = s['file'] if os.path.isabs(s['file']) else os.path.join(REEL, s['file'])
        x = read_mono(sp).astype(float)
        x *= db(VOICE_LUFS + 2.0 - loudness_lufs(x))
        if s.get('echo'):
            x = echo(x, delay=0.3, feedback=0.55, taps=7, lp=2600)
            x = reverb(x, 0.25, 1.6, 3500)
        mix_at(shouts, to_stereo(x), s['start'])

    # ---- sound effects (+ a soft pop under every label)
    sfx = np.zeros((N + n_of(6), 2))
    events = [(c['name'], c['at'], c.get('gain', 1.0)) for c in cues['sfx']]
    events += [('pop', l['at'] + 0.02, 0.32) for l in cues['labels']]
    for name, at, g in events:
        mix_at(sfx, sfx_sound(name), at, g)
    sfx = sfx[:N]

    # ---- music: stop at midnight, sting on the ghost's scream; hits on the growth pops
    m = cues.get('music', {})
    hits = [(c['at'], 2 if c['name'] == 'pop_huge' else 1) for c in cues['sfx'] if c['name'] in ('pop', 'pop_big', 'pop_huge') and c.get('shot', '').startswith('11')]
    music, info = spooky_groove(dur, m.get('stopAt'), m.get('stingAt'), hits=hits)
    music = music[:N]
    music *= db(MUSIC_LUFS - loudness_lufs(music))

    # ---- duck music and effects under the voice
    venv = envelope(v + 0.7 * shouts[:, 0])
    music_d = music * duck_gain(venv, 6.0)[:, None]
    sfx_d = sfx * duck_gain(venv, 3.0)[:, None]

    mix = voice + shouts + sfx_d + music_d
    gain = TARGET_LUFS - loudness_lufs(mix)
    mix *= db(gain)
    mix = limiter(mix, CEILING - 0.6)
    stems = {'voice': voice * db(gain), 'shouts': shouts * db(gain), 'sfx': sfx_d * db(gain), 'music': music_d * db(gain), 'mix': mix}
    for k, x in stems.items():
        sf.write(os.path.join(OUT, k + '.wav'), x.astype(np.float32), SR, subtype='PCM_24')
    # the music on its own track, un-ducked, at a normal listening level (deliverable)
    sf.write(os.path.join(OUT, 'music_only.wav'), (music * db(-16 - loudness_lufs(music))).astype(np.float32), SR, subtype='PCM_24')
    rep = {
        'duration': dur, 'mix_lufs': round(loudness_lufs(mix), 2), 'mix_true_peak_db': round(true_peak_db(mix), 2),
        'voice_lufs_in_mix': round(loudness_lufs(stems['voice']), 2), 'music_lufs_in_mix': round(loudness_lufs(stems['music']), 2),
        'sfx_lufs_in_mix': round(loudness_lufs(stems['sfx']), 2), 'music_resume': info['resume'], 'sfx_cues': len(events),
        'unknown_sfx': sorted({n for n, _, _ in events if n not in sfxlib.RECIPES}),
    }
    json.dump(rep, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()

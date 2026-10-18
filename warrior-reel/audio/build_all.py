#!/usr/bin/env python3
"""One-command audio build for "The Warrior Who Couldn't Forgive".

    python3 audio/build_all.py

Reads timeline/timeline.json, audio/dialogue/*.mp3 and audio/sfx/*.mp3 and writes
(deterministically) to out/audio/:
    mix.wav                      final mix, 48 kHz / 24-bit stereo, -14 LUFS-I, <= -1 dBTP
    music.wav                    the score alone (un-ducked), same scale as the mix
    stems/dialogue_JESUS.wav     per-character dialogue (labelled), post-processing
    stems/dialogue_KNIGHT.wav
    stems/music.wav              score as heard in the mix (ducked under speech)
    stems/ambience.wav           river + birds
    stems/foley.wav              grip, footsteps, robe, armour, sword
    mouth.json                   {fps, JESUS:[...], KNIGHT:[...]} per-frame mouth openness 0..1
    report.txt / report.json     loudness / true-peak / per-line S/B numbers
    build/score_*.mid|wav        the composed MIDI (per layer + full) and raw FluidSynth renders
Requires: numpy, scipy, soundfile, pyloudnorm, pretty_midi, ffmpeg, fluidsynth + FluidR3_GM.sf2.
"""
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def check():
    missing = [b for b in ("ffmpeg", "fluidsynth") if shutil.which(b) is None]
    from common import SF2
    if not os.path.exists(SF2):
        missing.append(SF2)
    for mod in ("numpy", "scipy", "soundfile", "pyloudnorm", "pretty_midi"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(f"python:{mod}")
    if missing:
        sys.exit("missing dependencies: " + ", ".join(missing))


def main():
    check()
    t0 = time.time()
    import mix
    mix.main()
    print(f"[audio] done in {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()

"""Clawd dances: pixel-art looping animation + chiptune soundtrack -> MP4.

Sprite geometry was measured from the reference artwork: a 12 x 8 grid of
square "pixels" (body #F25C45, eyes #0D0D0D) laid out as

    cols 2-9  rows 0-5  torso
    cols 0-1  rows 2-3  left arm      cols 10-11 rows 2-3  right arm
    cols 2,4,7,9 rows 6-7  legs
    col 3 row 1, col 8 row 1  eyes
"""

import math
import os
import struct
import subprocess
import sys
import wave

from PIL import Image, ImageDraw

# ---------------------------------------------------------------- constants

FPS = 30
BPM = 150.0
SPB = 60.0 / BPM              # 0.4 s per beat
BEATS = 32                    # 8 bars -> 12.8 s seamless loop
DURATION = BEATS * SPB
NFRAMES = int(round(DURATION * FPS))

LOWRES = 108                  # logical pixel canvas
SCALE = 10                    # -> 1080 x 1080 output
U = 6                         # logical pixels per sprite unit

ORANGE = (242, 92, 69)
EYE = (13, 13, 13)
BG = (0, 0, 0)

SPRITE_W, SPRITE_H = 12 * U, 8 * U          # 72 x 48
CX = LOWRES / 2.0                            # horizontal centre
GROUND = 84                                  # y of the bottom of the feet

SR = 44100

# ---------------------------------------------------------------- easing

def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def hop(p):
    """0..1 -> parabolic arc height 0..1..0"""
    p = clamp(p, 0.0, 1.0)
    return 4.0 * p * (1.0 - p)


def ease_io(p):
    p = clamp(p, 0.0, 1.0)
    return p * p * (3.0 - 2.0 * p)


# ---------------------------------------------------------------- pose

class Pose:
    def __init__(self):
        self.x = 0.0          # body offset (logical px)
        self.y = 0.0          # negative = airborne
        self.sx = 1.0         # squash / stretch
        self.sy = 1.0
        self.turn = 0.0       # 0..1 full revolution
        self.lean = 0.0       # head/torso lean in px
        self.arm_l = 0.0      # arm vertical offset, negative = raised
        self.arm_r = 0.0
        self.legs = [0.0, 0.0, 0.0, 0.0]   # per-leg lift


def choreograph(b):
    """b = beat position in [0, 32) -> Pose. Ends exactly where it starts."""
    p = Pose()
    bar = int(b // 4)
    t = b - bar * 4                     # position within the bar
    beat_frac = b - math.floor(b)

    if bar == 0:
        # happy bob in place, arms pumping on alternate beats
        h = hop(beat_frac)
        p.y = -4.0 * h
        p.sy = 1.0 + 0.10 * h - 0.14 * (1.0 - h) * (1.0 - beat_frac)
        p.sx = 2.0 - p.sy
        p.lean = 1.5 * math.sin(math.pi * b)
        up = int(b) % 2 == 0
        p.arm_l = -5.0 * h if up else 3.0 * h
        p.arm_r = 3.0 * h if up else -5.0 * h
        p.legs = [2.0 * h if up else 0, 0, 0, 2.0 * h if not up else 0]

    elif bar == 1:
        # side-to-side stepping, one step per beat
        p.x = 7.0 * math.sin(math.pi * t / 2.0)
        h = hop(beat_frac)
        p.y = -3.0 * h
        p.lean = 2.5 * math.sin(math.pi * t / 2.0)
        p.arm_l = -4.0 if p.x < 0 else 2.0
        p.arm_r = -4.0 if p.x > 0 else 2.0
        lift = 3.0 * h
        if p.x >= 0:
            p.legs = [lift, lift * 0.5, 0, 0]
        else:
            p.legs = [0, 0, lift * 0.5, lift]
        p.sy = 1.0 + 0.06 * h
        p.sx = 2.0 - p.sy

    elif bar == 2:
        # arm wiggles: fast flapping, tiny head bob
        w = math.sin(2.0 * math.pi * (b * 2.0))
        p.arm_l = -5.0 * w
        p.arm_r = 5.0 * w
        h = hop(beat_frac)
        p.y = -2.0 * h
        p.lean = 2.0 * math.sin(math.pi * b)
        p.legs = [0, 1.5 * max(0.0, w), 1.5 * max(0.0, -w), 0]

    elif bar == 3:
        # two tiny hops, then one big boing
        if t < 2.0:
            h = hop(t % 1.0)
            p.y = -5.0 * h
            p.sy = 1.0 + 0.12 * h
            p.sx = 2.0 - p.sy
            p.arm_l = p.arm_r = -4.0 * h
            p.legs = [2.0 * h] * 4
        else:
            q = (t - 2.0) / 2.0                 # big hop over 2 beats
            if q < 0.15:                        # crouch
                c = ease_io(q / 0.15)
                p.sy = 1.0 - 0.22 * c
                p.sx = 1.0 + 0.22 * c
                p.y = 2.0 * c
            else:
                a = (q - 0.15) / 0.85
                h = hop(a)
                p.y = -20.0 * h
                st = math.sin(math.pi * a)
                p.sy = 1.0 + 0.18 * st
                p.sx = 2.0 - p.sy
                p.arm_l = p.arm_r = -7.0 * st
                p.legs = [4.0 * st, 3.0 * st, 3.0 * st, 4.0 * st]
                p.lean = 2.0 * math.sin(2.0 * math.pi * a)

    elif bar == 4:
        # gentle spin: one full turn over the first two beats
        if t < 2.0:
            q = t / 2.0
            p.turn = ease_io(q)
            p.y = -6.0 * math.sin(math.pi * q)
            p.arm_l = p.arm_r = -4.0 * math.sin(math.pi * q)
            p.legs = [2.0 * math.sin(math.pi * q)] * 4
        else:
            h = hop(beat_frac)
            p.y = -4.0 * h
            p.lean = 2.0 * math.sin(math.pi * b)
            up = int(b) % 2 == 0
            p.arm_l = -5.0 * h if up else 2.0 * h
            p.arm_r = 2.0 * h if up else -5.0 * h
            p.sy = 1.0 + 0.08 * h
            p.sx = 2.0 - p.sy

    elif bar == 5:
        # mirrored side-stepping with wiggling arms
        p.x = -7.0 * math.sin(math.pi * t / 2.0)
        h = hop(beat_frac)
        p.y = -3.0 * h
        p.lean = -2.5 * math.sin(math.pi * t / 2.0)
        w = math.sin(2.0 * math.pi * b)
        p.arm_l = -4.0 * w
        p.arm_r = 4.0 * w
        lift = 3.0 * h
        if p.x >= 0:
            p.legs = [lift, lift * 0.5, 0, 0]
        else:
            p.legs = [0, 0, lift * 0.5, lift]

    elif bar == 6:
        # fast shuffle on the eighths, arms up, happy rhythm
        e = (b * 2.0) % 1.0
        h = hop(e)
        p.y = -4.0 * h
        p.x = 4.0 * math.sin(math.pi * b)
        p.lean = 2.0 * math.sin(math.pi * b * 2.0)
        p.arm_l = -6.0 + 2.0 * math.sin(math.pi * b * 4.0)
        p.arm_r = -6.0 - 2.0 * math.sin(math.pi * b * 4.0)
        left = int(b * 2.0) % 2 == 0
        lift = 3.5 * h
        p.legs = [lift, lift * 0.4, 0, 0] if left else [0, 0, lift * 0.4, lift]
        p.sy = 1.0 + 0.08 * h
        p.sx = 2.0 - p.sy

    else:  # bar 7 -- big finish: boing hop, then a spin that lands neutral
        if t < 2.0:
            q = t / 2.0
            if q < 0.15:
                c = ease_io(q / 0.15)
                p.sy = 1.0 - 0.22 * c
                p.sx = 1.0 + 0.22 * c
                p.y = 2.0 * c
            else:
                a = (q - 0.15) / 0.85
                h = hop(a)
                p.y = -22.0 * h
                st = math.sin(math.pi * a)
                p.sy = 1.0 + 0.18 * st
                p.sx = 2.0 - p.sy
                p.arm_l = p.arm_r = -8.0 * st
                p.legs = [4.0 * st] * 4
        else:
            q = (t - 2.0) / 2.0
            p.turn = ease_io(q)
            s = math.sin(math.pi * q)
            p.y = -5.0 * s
            p.arm_l = p.arm_r = -4.0 * s
            p.legs = [2.0 * s] * 4
            p.lean = 0.0

    return p


# ---------------------------------------------------------------- drawing

def draw_frame(pose):
    img = Image.new("RGB", (LOWRES, LOWRES), BG)
    d = ImageDraw.Draw(img)

    # spin: horizontal foreshortening, eyes hidden while facing away
    ang = 2.0 * math.pi * pose.turn
    face = math.cos(ang)
    hs = max(abs(face), 0.14)
    front = face >= 0.0

    top = GROUND - SPRITE_H * pose.sy + pose.y
    cx = CX + pose.x

    def rect(u0, v0, u1, v1, colour, dx=0.0, dy=0.0, lean_rows=False):
        """sprite-unit rect -> logical pixels, snapped to the pixel grid"""
        lean = pose.lean if lean_rows else 0.0
        x0 = cx + ((u0 - 6.0) * U * pose.sx) * hs + dx * hs + lean
        x1 = cx + ((u1 - 6.0) * U * pose.sx) * hs + dx * hs + lean
        y0 = top + v0 * U * pose.sy + dy
        y1 = top + v1 * U * pose.sy + dy
        x0, x1 = int(round(x0)), int(round(x1))
        y0, y1 = int(round(y0)), int(round(y1))
        if x1 > x0 and y1 > y0:
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=colour)

    # legs (drawn first so the torso overlaps cleanly)
    for i, col in enumerate((2, 4, 7, 9)):
        lift = pose.legs[i]
        rect(col, 6, col + 1, 8, ORANGE, dy=-lift)

    # arms
    rect(0, 2, 2, 4, ORANGE, dy=pose.arm_l, lean_rows=True)
    rect(10, 2, 12, 4, ORANGE, dy=pose.arm_r, lean_rows=True)

    # torso
    rect(2, 0, 10, 6, ORANGE, lean_rows=True)

    # eyes -- only while facing the camera, and they slide with the turn
    if front and hs > 0.35:
        rect(3, 1, 4, 2, EYE, lean_rows=True)
        rect(8, 1, 9, 2, EYE, lean_rows=True)

    return img.resize((LOWRES * SCALE, LOWRES * SCALE), Image.NEAREST)


# ---------------------------------------------------------------- audio

def env(n, attack, decay, sustain, release):
    out = []
    a = max(1, int(attack * SR))
    dcy = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    s = max(0, n - a - dcy - r)
    for i in range(n):
        if i < a:
            out.append(i / a)
        elif i < a + dcy:
            out.append(1.0 - (1.0 - sustain) * (i - a) / dcy)
        elif i < a + dcy + s:
            out.append(sustain)
        else:
            k = (i - a - dcy - s) / r
            out.append(sustain * max(0.0, 1.0 - k))
    return out


def add(buf, start, samples, gain=1.0):
    i = int(start * SR)
    n = len(buf)
    for k, v in enumerate(samples):
        j = i + k
        if 0 <= j < n:
            buf[j] += v * gain


def square(freq, dur, duty=0.5, gain=0.25, adsr=(0.005, 0.03, 0.7, 0.06), vib=0.0):
    n = int(dur * SR)
    e = env(n, *adsr)
    out = []
    ph = 0.0
    for i in range(n):
        f = freq * (1.0 + vib * math.sin(2.0 * math.pi * 5.5 * i / SR))
        ph += f / SR
        v = 1.0 if (ph % 1.0) < duty else -1.0
        out.append(v * e[i] * gain)
    return out


def triangle(freq, dur, gain=0.3, adsr=(0.004, 0.05, 0.6, 0.05)):
    n = int(dur * SR)
    e = env(n, *adsr)
    out = []
    ph = 0.0
    for i in range(n):
        ph += freq / SR
        x = ph % 1.0
        v = 4.0 * abs(x - 0.5) - 1.0
        out.append(v * e[i] * gain)
    return out


_seed = [12345]


def rnd():
    _seed[0] = (1103515245 * _seed[0] + 12345) % (1 << 31)
    return (_seed[0] / (1 << 30)) - 1.0


def noise(dur, gain=0.2, decay=18.0, lp=0.0):
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        v = rnd()
        if lp > 0.0:
            prev = prev + (v - prev) * lp
            v = prev
        out.append(v * math.exp(-decay * i / SR) * gain)
    return out


def sweep(f0, f1, dur, gain=0.3, duty=0.5, curve=1.0):
    n = int(dur * SR)
    out = []
    ph = 0.0
    for i in range(n):
        k = (i / n) ** curve
        f = f0 + (f1 - f0) * k
        ph += f / SR
        v = 1.0 if (ph % 1.0) < duty else -1.0
        out.append(v * math.exp(-3.0 * i / n) * gain)
    return out


def whoosh(dur, gain=0.22):
    n = int(dur * SR)
    out = []
    prev = 0.0
    for i in range(n):
        k = i / n
        cutoff = 0.02 + 0.5 * math.sin(math.pi * k)      # band-ish sweep
        prev = prev + (rnd() - prev) * cutoff
        amp = math.sin(math.pi * k) ** 1.5
        out.append(prev * amp * gain)
    return out


NOTE = {}
for _i, _nm in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]):
    NOTE[_nm] = _i


def hz(name, octave):
    return 440.0 * (2.0 ** ((NOTE[name] + (octave - 4) * 12 - NOTE["A"]) / 12.0))


def build_audio():
    total = int(DURATION * SR) + SR // 2
    buf = [0.0] * total

    # --- chords, one per bar: C  G  Am  F  C  G  F  G
    chords = [("C", 3), ("G", 2), ("A", 2), ("F", 2), ("C", 3), ("G", 2), ("F", 2), ("G", 2)]
    roots = ["C", "G", "A", "F", "C", "G", "F", "G"]

    for bar in range(8):
        base = bar * 4 * SPB
        rname, roct = chords[bar]
        f = hz(rname, roct)
        # bass: root - root - fifth - root, on the beat
        for beat, mult in enumerate([1.0, 1.0, 1.5, 1.0]):
            add(buf, base + beat * SPB, triangle(f * mult, SPB * 0.85, gain=0.34))
        # arpeggio sparkle on the offbeats
        for eighth in range(8):
            if eighth % 2 == 1:
                step = [0, 4, 7, 12][(eighth // 2) % 4]
                add(buf, base + eighth * SPB / 2.0,
                    square(f * 2.0 * (2 ** (step / 12.0)), SPB * 0.22,
                           duty=0.25, gain=0.085))

    # --- lead melody (bar, beat, note, octave, beats long)
    mel = [
        (0, 0.0, "G", 4, 0.5), (0, 0.5, "E", 4, 0.5), (0, 1.0, "G", 4, 1.0),
        (0, 2.0, "C", 5, 0.5), (0, 2.5, "B", 4, 0.5), (0, 3.0, "G", 4, 1.0),
        (1, 0.0, "D", 5, 0.5), (1, 0.5, "B", 4, 0.5), (1, 1.0, "D", 5, 1.0),
        (1, 2.0, "G", 5, 0.5), (1, 2.5, "D", 5, 0.5), (1, 3.0, "B", 4, 1.0),
        (2, 0.0, "E", 5, 0.5), (2, 0.5, "C", 5, 0.5), (2, 1.0, "A", 4, 1.0),
        (2, 2.0, "C", 5, 0.5), (2, 2.5, "E", 5, 0.5), (2, 3.0, "A", 5, 1.0),
        (3, 0.0, "F", 5, 0.5), (3, 0.5, "E", 5, 0.5), (3, 1.0, "C", 5, 1.0),
        (3, 2.0, "A", 4, 0.5), (3, 2.5, "C", 5, 0.5), (3, 3.0, "F", 5, 1.0),
        (4, 0.0, "G", 5, 0.5), (4, 0.5, "E", 5, 0.5), (4, 1.0, "C", 5, 1.0),
        (4, 2.0, "E", 5, 0.5), (4, 2.5, "G", 5, 0.5), (4, 3.0, "C", 6, 1.0),
        (5, 0.0, "B", 5, 0.5), (5, 0.5, "G", 5, 0.5), (5, 1.0, "D", 5, 1.0),
        (5, 2.0, "G", 5, 0.5), (5, 2.5, "B", 5, 0.5), (5, 3.0, "D", 6, 1.0),
        (6, 0.0, "C", 6, 0.5), (6, 0.5, "A", 5, 0.5), (6, 1.0, "F", 5, 0.5),
        (6, 1.5, "A", 5, 0.5), (6, 2.0, "C", 6, 0.5), (6, 2.5, "A", 5, 0.5),
        (6, 3.0, "F", 5, 1.0),
        (7, 0.0, "D", 5, 0.5), (7, 0.5, "G", 5, 0.5), (7, 1.0, "B", 5, 1.0),
        (7, 2.0, "D", 6, 1.0), (7, 3.0, "G", 5, 1.0),
    ]
    for bar, beat, name, octv, length in mel:
        t = (bar * 4 + beat) * SPB
        add(buf, t, square(hz(name, octv), length * SPB * 0.92,
                           duty=0.5, gain=0.16, vib=0.006))

    # --- drums
    for beat in range(BEATS):
        t = beat * SPB
        # kick on 1 and 3
        if beat % 4 in (0, 2):
            add(buf, t, sweep(150.0, 45.0, 0.12, gain=0.3, duty=0.5, curve=0.45))
        # snare on 2 and 4
        if beat % 4 in (1, 3):
            add(buf, t, noise(0.13, gain=0.17, decay=32.0))
        # hats on the eighths
        for e in (0.0, 0.5):
            add(buf, t + e * SPB, noise(0.045, gain=0.055 if e else 0.075, decay=90.0))

    # --- sound effects, matched to the choreography
    def at(beat):
        return beat * SPB

    # tiny hops (bar 3, beats 12 & 13)
    for beat in (12, 13):
        add(buf, at(beat), sweep(420.0, 900.0, 0.10, gain=0.16, duty=0.25))
    # big boings
    for beat in (14.3, 28.3):
        add(buf, at(beat), sweep(260.0, 1150.0, 0.22, gain=0.24, duty=0.3, curve=0.6))
        add(buf, at(beat) + 0.22, sweep(1150.0, 300.0, 0.16, gain=0.13, duty=0.3))
    # spin whooshes
    for beat in (16.0, 30.0):
        add(buf, at(beat), whoosh(0.8 * SPB, gain=0.26))
        add(buf, at(beat), sweep(300.0, 760.0, 0.7 * SPB, gain=0.09, duty=0.12, curve=0.8))
    # step blips
    for beat in [4, 5, 6, 7, 20, 21, 22, 23]:
        add(buf, at(beat), square(hz("E", 6), 0.05, duty=0.25, gain=0.09))
    # shuffle blips on the eighths of bar 6
    for k in range(8):
        add(buf, at(24 + k * 0.5), square(hz("A" if k % 2 else "C", 6 if k % 2 else 7),
                                          0.04, duty=0.15, gain=0.07))
    # landing thumps
    for beat in (15.7, 29.7):
        add(buf, at(beat), sweep(200.0, 60.0, 0.1, gain=0.22, curve=0.5))

    # --- wrap the tail back into the head so the loop is seamless
    loop_n = int(DURATION * SR)
    for i in range(loop_n, min(total, loop_n + SR // 2)):
        buf[i - loop_n] += buf[i]
    buf = buf[:loop_n]

    peak = max(1e-6, max(abs(v) for v in buf))
    norm = 0.89 / peak
    return [v * norm for v in buf]


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for v in samples:
            s = int(clamp(v, -1.0, 1.0) * 32767)
            frames += struct.pack("<hh", s, s)
        w.writeframes(bytes(frames))


# ---------------------------------------------------------------- main

def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "build"
    frames_dir = os.path.join(out_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    print(f"rendering {NFRAMES} frames ({DURATION:.1f}s @ {FPS}fps)")
    for f in range(NFRAMES):
        b = (f / FPS) / SPB
        draw_frame(choreograph(b)).save(os.path.join(frames_dir, f"{f:04d}.png"))
    print("frames done")

    wav_path = os.path.join(out_dir, "clawd-dance.wav")
    print("synthesising chiptune")
    write_wav(wav_path, build_audio())

    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        ffmpeg = "ffmpeg"

    mp4 = os.path.join(out_dir, "clawd-dance.mp4")
    subprocess.run([
        ffmpeg, "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-i", os.path.join(frames_dir, "%04d.png"),
        "-i", wav_path,
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "192k", "-shortest", mp4,
    ], check=True)

    gif = os.path.join(out_dir, "clawd-dance.gif")
    subprocess.run([
        ffmpeg, "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-i", os.path.join(frames_dir, "%04d.png"),
        "-vf", "fps=25,scale=360:360:flags=neighbor,split[a][b];"
               "[a]palettegen=max_colors=8[p];[b][p]paletteuse=dither=none",
        "-loop", "0", gif,
    ], check=True)

    for path in (mp4, gif):
        print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()

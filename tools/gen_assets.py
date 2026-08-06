#!/usr/bin/env python3
"""Generate every pixel-art resource used by Alarm Handler.

Both source images live in tools/source/. The mascot is decoded back to its
native 12x8 pixel grid so that every derived asset is produced with pure
nearest-neighbour scaling -- no blurring, no stretching, no re-drawn character.

Run from the repository root:  python3 tools/gen_assets.py
"""

import math
import os
import struct
import wave

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "source")
RES = os.path.join(ROOT, "app", "src", "main", "res")

MASCOT_SRC = os.path.join(SRC, "mascot_original.webp")
CITY_SRC = os.path.join(SRC, "city_original.jpg")

# Colours sampled directly from the two provided images.
CORAL = (242, 92, 69, 255)        # mascot body
INK = (17, 17, 17, 255)           # mascot eyes / text
CLEAR = (0, 0, 0, 0)
OFF_WHITE = (240, 239, 235, 255)  # background of the wide city image

# ---------------------------------------------------------------------------
# 1. Decode the mascot back to its native pixel grid
# ---------------------------------------------------------------------------

GRID_W, GRID_H = 12, 8


def decode_mascot_grid():
    """Sample the provided mascot at its native 12x8 grid.

    The supplied file is a 400x400 render of a 12x8 pixel sprite. Sampling the
    centre of every logical cell recovers the artwork exactly and discards the
    anti-aliased cell edges introduced by the render.
    """
    im = Image.open(MASCOT_SRC).convert("RGBA")
    px = im.load()

    # Opaque bounding box of the sprite inside the 400x400 canvas.
    x0, y0, x1, y1 = 12, 91, 389, 344
    cw = (x1 - x0) / GRID_W
    ch = (y1 - y0) / GRID_H

    rows = []
    for r in range(GRID_H):
        row = ""
        for c in range(GRID_W):
            cx = int(x0 + cw * (c + 0.5))
            cy = int(y0 + ch * (r + 0.5))
            pr, pg, pb, pa = px[cx, cy]
            if pa < 128:
                row += "."
            elif pr < 90 and pg < 90:
                row += "K"
            else:
                row += "R"
        rows.append(row)
    return rows


PALETTE = {".": CLEAR, "R": CORAL, "K": INK}


def render_grid(rows, scale, pad=0, bg=CLEAR):
    """Nearest-neighbour render of a character grid at an integer scale."""
    h = len(rows)
    w = len(rows[0])
    img = Image.new("RGBA", (w * scale + pad * 2, h * scale + pad * 2), bg)
    px = img.load()
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            col = PALETTE[ch]
            if col[3] == 0:
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[pad + c * scale + dx, pad + r * scale + dy] = col
    return img


def silhouette(rows, scale, colour=(255, 255, 255, 255)):
    """Solid single-colour silhouette, used for the notification small icon."""
    h = len(rows)
    w = len(rows[0])
    img = Image.new("RGBA", (w * scale, h * scale), CLEAR)
    px = img.load()
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            if ch == ".":
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[c * scale + dx, r * scale + dy] = colour
    return img


def save(img, rel_path):
    path = os.path.join(RES, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("  wrote", os.path.relpath(path, ROOT), img.size)


# ---------------------------------------------------------------------------
# 2. Clean the wide city image
# ---------------------------------------------------------------------------

def snap_to_palette(im, colours):
    """Snap every pixel to the nearest reference colour.

    The provided wide image is a JPEG, so flat pixel areas carry ringing
    artefacts. Snapping restores hard pixel-art edges without redrawing it.
    """
    im = im.convert("RGB")
    px = im.load()
    w, h = im.size
    cache = {}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            hit = cache.get(p)
            if hit is None:
                best = None
                bestd = None
                for c in colours:
                    d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
                    if bestd is None or d < bestd:
                        bestd = d
                        best = c
                hit = best
                cache[p] = hit
            px[x, y] = hit
    return im


CITY_PALETTE = [
    (240, 239, 235),  # sky / background
    (231, 230, 225),  # ground band
    (218, 119, 87),   # mascot body
    (190, 104, 77),   # mascot shading
    (17, 17, 17),     # eyes
    (140, 140, 136),  # city mid tone
    (196, 196, 192),  # city light tone
    (86, 86, 84),     # city dark tone
]


def build_city():
    im = Image.open(CITY_SRC)
    im = im.convert("RGB")
    cleaned = snap_to_palette(im, CITY_PALETTE)
    save(cleaned.convert("RGBA"), "drawable-nodpi/pixel_city_header.png")

    # Tall variant used behind the ringing screen: the same scenery with the
    # sky extended upward so it can fill a portrait screen without stretching.
    w, h = cleaned.size
    tall = Image.new("RGB", (w, h * 3), CITY_PALETTE[0])
    tall.paste(cleaned, (0, h * 2))
    save(tall.convert("RGBA"), "drawable-nodpi/pixel_city_tall.png")


# ---------------------------------------------------------------------------
# 3. Launcher icons
# ---------------------------------------------------------------------------

LEGACY_DENSITIES = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]

# Adaptive icon foreground is 108dp with a 72dp safe zone (two thirds).
ADAPTIVE_DENSITIES = [
    ("mipmap-mdpi", 108),
    ("mipmap-hdpi", 162),
    ("mipmap-xhdpi", 216),
    ("mipmap-xxhdpi", 324),
    ("mipmap-xxxhdpi", 432),
]


def paste_centered(canvas, sprite):
    x = (canvas.size[0] - sprite.size[0]) // 2
    y = (canvas.size[1] - sprite.size[1]) // 2
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def build_launcher_icons(rows):
    for folder, size in ADAPTIVE_DENSITIES:
        # Sprite must sit inside the 66% safe zone; use the largest integer
        # scale that fits so the artwork stays pixel exact.
        safe = size * 0.60
        scale = max(1, int(safe // GRID_W))
        sprite = render_grid(rows, scale)
        canvas = Image.new("RGBA", (size, size), CLEAR)
        save(paste_centered(canvas, sprite), f"{folder}/ic_launcher_foreground.png")

    for folder, size in LEGACY_DENSITIES:
        scale = max(1, int((size * 0.78) // GRID_W))
        sprite = render_grid(rows, scale)
        canvas = Image.new("RGBA", (size, size), OFF_WHITE)
        paste_centered(canvas, sprite)
        save(canvas, f"{folder}/ic_launcher.png")

        # Round variant: identical artwork masked into a circle.
        round_img = Image.new("RGBA", (size, size), CLEAR)
        disc = Image.new("RGBA", (size, size), OFF_WHITE)
        mask = Image.new("L", (size * 4, size * 4), 0)
        from PIL import ImageDraw

        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        disc.putalpha(mask)
        round_img.alpha_composite(disc)
        paste_centered(round_img, sprite)
        save(round_img, f"{folder}/ic_launcher_round.png")


def build_notification_icons(rows):
    # Small icons are drawn as a white-on-transparent silhouette by Android.
    for folder, dp in [
        ("drawable-mdpi", 24),
        ("drawable-hdpi", 36),
        ("drawable-xhdpi", 48),
        ("drawable-xxhdpi", 72),
        ("drawable-xxxhdpi", 96),
    ]:
        scale = max(1, dp // GRID_W)
        sprite = silhouette(rows, scale)
        canvas = Image.new("RGBA", (dp, dp), CLEAR)
        save(paste_centered(canvas, sprite), f"{folder}/ic_stat_alarm_handler.png")


def build_mascot_drawables(rows):
    # Full-colour mascot used for the splash icon and notification large icon.
    save(render_grid(rows, 32), "drawable-nodpi/mascot.png")

    # Splash icons are 288dp overall with the artwork inside the inner 192dp.
    for folder, size in [
        ("drawable-mdpi", 288),
        ("drawable-hdpi", 432),
        ("drawable-xhdpi", 576),
        ("drawable-xxhdpi", 864),
    ]:
        scale = max(1, int((size * 0.60) // GRID_W))
        sprite = render_grid(rows, scale)
        canvas = Image.new("RGBA", (size, size), CLEAR)
        save(paste_centered(canvas, sprite), f"{folder}/splash_mascot.png")


# ---------------------------------------------------------------------------
# 4. Built-in alarm tones
# ---------------------------------------------------------------------------

RATE = 22050


def _write_wav(name, samples):
    path = os.path.join(RES, "raw", name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    frames = bytearray()
    for s in samples:
        v = int(max(-1.0, min(1.0, s)) * 30000)
        frames += struct.pack("<h", v)
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(bytes(frames))
    print("  wrote", os.path.relpath(path, ROOT), f"{len(samples)/RATE:.2f}s")


def _square(freq, t):
    return 1.0 if math.sin(2 * math.pi * freq * t) >= 0 else -1.0


def _env(i, n, attack=0.01, release=0.05):
    t = i / RATE
    total = n / RATE
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (total - t) / release) if release > 0 else 1.0
    return max(0.0, a * r)


def _tone(freq, dur, wave_fn, volume=0.8):
    n = int(RATE * dur)
    return [wave_fn(freq, i / RATE) * _env(i, n) * volume for i in range(n)]


def _silence(dur):
    return [0.0] * int(RATE * dur)


def build_sounds():
    # Each tone is a seamless two-second loop so MediaPlayer can repeat it.
    def pad(samples, seconds=2.0):
        target = int(RATE * seconds)
        if len(samples) < target:
            samples = samples + [0.0] * (target - len(samples))
        return samples[:target]

    sine = lambda f, t: math.sin(2 * math.pi * f * t)

    # Pixel Chime -- bright arpeggio, the Alarm Handler default.
    chime = []
    for f in (880, 1108, 1318, 1760):
        chime += _tone(f, 0.16, _square, 0.55)
        chime += _silence(0.04)
    chime += _silence(0.4)
    for f in (1760, 1318):
        chime += _tone(f, 0.14, _square, 0.5)
        chime += _silence(0.05)
    _write_wav("tone_pixel_chime.wav", pad(chime))

    # Retro Alarm -- classic alternating two-tone.
    retro = []
    for _ in range(5):
        retro += _tone(1046, 0.11, _square, 0.75)
        retro += _silence(0.03)
        retro += _tone(784, 0.11, _square, 0.75)
        retro += _silence(0.03)
    _write_wav("tone_retro_alarm.wav", pad(retro))

    # Handler Beep -- urgent triple beep with a rest.
    beep = []
    for _ in range(3):
        beep += _tone(1400, 0.09, _square, 0.8)
        beep += _silence(0.07)
    beep += _silence(0.5)
    for _ in range(3):
        beep += _tone(1400, 0.09, _square, 0.8)
        beep += _silence(0.07)
    _write_wav("tone_handler_beep.wav", pad(beep))

    # Sunrise -- gentle rising sine, easiest on the ears.
    n = int(RATE * 2.0)
    sunrise = []
    for i in range(n):
        t = i / RATE
        f = 440 + 220 * (t / 2.0)
        amp = 0.5 * (0.35 + 0.65 * (0.5 - 0.5 * math.cos(2 * math.pi * t / 2.0)))
        sunrise.append((sine(f, t) * 0.7 + sine(f * 2, t) * 0.3) * amp)
    _write_wav("tone_sunrise.wav", sunrise)

    # City Siren -- sweeping tone that is hard to sleep through.
    siren = []
    for i in range(n):
        t = i / RATE
        f = 600 + 400 * (0.5 - 0.5 * math.cos(2 * math.pi * t))
        siren.append(_square(f, t) * 0.6 * _env(i, n, 0.05, 0.05))
    _write_wav("tone_city_siren.wav", siren)


# ---------------------------------------------------------------------------

def main():
    rows = decode_mascot_grid()
    print("Mascot grid recovered from the provided artwork:")
    for r in rows:
        print("   ", r)

    print("Launcher icons:")
    build_launcher_icons(rows)
    print("Notification icons:")
    build_notification_icons(rows)
    print("Mascot drawables:")
    build_mascot_drawables(rows)
    print("City artwork:")
    build_city()
    print("Alarm tones:")
    build_sounds()
    print("Done.")


if __name__ == "__main__":
    main()

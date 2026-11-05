#!/usr/bin/env python3
"""Render the debate video track (speaker cards + captions), timed to the ElevenLabs audio.

Usage:
    python3 build_video.py                      # -> debate_visuals.mp4 (silent)
    python3 build_video.py debate.mp3           # -> debate_video.mp4 (with the joined ElevenLabs MP3)
"""
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 720
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

SPEAKERS = {
    "siren": {"name": "SIREN", "role": "BELIEVER", "color": (232, 176, 75), "initial": "S"},
    "zhao": {"name": "ZHAO", "role": "ATHEIST", "color": (86, 156, 240), "initial": "Z"},
}

# (speaker, duration of the ElevenLabs clip in seconds, pause before it) — matches the composition timeline.
TIMELINE = [
    ("siren", 24.32, 0.5),
    ("zhao", 25.44, 0.8),
    ("siren", 28.56, 0.8),
    ("zhao", 36.48, 0.8),
    ("siren", 28.64, 0.8),
    ("zhao", 32.96, 0.8),
    ("siren", 27.04, 0.8),
    ("zhao", 40.48, 0.8),
    ("siren", 31.28, 0.8),
    ("zhao", 23.84, 0.8),
    ("siren", 3.44, 0.6),
]


def load_turns():
    text = open(os.path.join(HERE, "SCRIPT.md"), encoding="utf-8").read()
    turns = re.findall(r"\*\*\d+\. (?:SIREN|ZHAO)[^*]*\*\*\n(.+)", text)
    assert len(turns) == len(TIMELINE), f"expected {len(TIMELINE)} turns, found {len(turns)}"
    return [re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]\s*", "", t)).strip() for t in turns]


def caption_chunks(text, max_chars=150):
    """Split a turn into caption-sized chunks on sentence boundaries."""
    sentences = re.findall(r"[^.?!]+(?:\.\.\.|[.?!])?\"?\s*", text)
    chunks, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) > max_chars:
            chunks.append(cur.strip())
            cur = ""
        cur += s
    if cur.strip():
        chunks.append(cur.strip())
    return chunks


def wrap(draw, text, font, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if draw.textlength(trial, font=font) <= width:
            line = trial
        else:
            lines.append(line)
            line = w
    lines.append(line)
    return lines


def background():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(14 + 10 * t), int(16 + 8 * t), int(28 + 14 * t)))
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W // 2 - 380, -260, W // 2 + 380, 260], fill=(60, 50, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.5)


BG = None


def frame(active, caption, label):
    global BG
    if BG is None:
        BG = background()
    img = BG.copy()
    d = ImageDraw.Draw(img)

    title = ImageFont.truetype(FONT_B, 40)
    sub = ImageFont.truetype(FONT, 20)
    t = "ATHEIST  vs  BELIEVER"
    d.text(((W - d.textlength(t, font=title)) / 2, 34), t, font=title, fill=(240, 240, 248))
    s = "Does God exist?  ·  A five-minute debate"
    d.text(((W - d.textlength(s, font=sub)) / 2, 86), s, font=sub, fill=(160, 165, 190))

    card_w, card_h, top = 400, 300, 140
    for key, x in (("siren", 120), ("zhao", W - 120 - card_w)):
        sp = SPEAKERS[key]
        on = key == active
        col = sp["color"] if on else tuple(int(c * 0.35) for c in sp["color"])
        fill = (34, 36, 56) if on else (24, 25, 38)
        d.rounded_rectangle([x, top, x + card_w, top + card_h], 22, fill=fill, outline=col, width=4 if on else 2)
        cx, cy, r = x + card_w // 2, top + 115, 70
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        ini = ImageFont.truetype(FONT_B, 72)
        d.text((cx - d.textlength(sp["initial"], font=ini) / 2, cy - 44), sp["initial"], font=ini,
               fill=(20, 20, 30) if on else (60, 60, 75))
        nf = ImageFont.truetype(FONT_B, 34)
        rf = ImageFont.truetype(FONT, 20)
        name_col = (245, 245, 250) if on else (110, 112, 130)
        d.text((cx - d.textlength(sp["name"], font=nf) / 2, top + 200), sp["name"], font=nf, fill=name_col)
        d.text((cx - d.textlength(sp["role"], font=rf) / 2, top + 246), sp["role"], font=rf, fill=col)
        if on:
            sf = ImageFont.truetype(FONT_B, 15)
            tag = "SPEAKING"
            tw = d.textlength(tag, font=sf)
            d.rounded_rectangle([cx - tw / 2 - 12, top - 14, cx + tw / 2 + 12, top + 14], 14, fill=col)
            d.text((cx - tw / 2, top - 9), tag, font=sf, fill=(20, 20, 30))

    vs = ImageFont.truetype(FONT_B, 46)
    d.text(((W - d.textlength("VS", font=vs)) / 2, top + card_h / 2 - 28), "VS", font=vs, fill=(120, 110, 160))

    if label:
        lf = ImageFont.truetype(FONT, 16)
        d.text(((W - d.textlength(label, font=lf)) / 2, top + card_h + 18), label, font=lf, fill=(130, 135, 160))

    if caption:
        cf = ImageFont.truetype(FONT, 26)
        lines = wrap(d, caption, cf, W - 220)
        box_top = 500
        d.rounded_rectangle([80, box_top, W - 80, H - 30], 18, fill=(10, 11, 20))
        col = SPEAKERS[active]["color"]
        d.rectangle([80, box_top + 18, 86, H - 48], fill=col)
        y = box_top + (H - 30 - box_top - len(lines) * 36) / 2
        for ln in lines:
            d.text((110, y), ln, font=cf, fill=(235, 236, 244))
            y += 36
    return img


SECTIONS = ["Opening", "Opening", "The universe & fine-tuning", "God of the gaps", "Morality",
            "Goodness without God", "Experience & meaning", "Suffering & meaning", "Closing", "Closing", ""]


def main():
    audio = sys.argv[1] if len(sys.argv) > 1 else None
    out = os.path.join(HERE, "debate_video.mp4" if audio else "debate_visuals.mp4")
    turns = load_turns()
    segments = []  # (image, seconds)
    for (spk, dur, gap), text, section in zip(TIMELINE, turns, SECTIONS):
        segments.append((frame(None, None, None), gap))
        chunks = caption_chunks(text)
        total = sum(len(c) for c in chunks)
        for c in chunks:
            segments.append((frame(spk, c, section), dur * len(c) / total))
    segments.append((frame(None, None, None), 2.0))

    with tempfile.TemporaryDirectory() as tmp:
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            for i, (img, secs) in enumerate(segments):
                p = os.path.join(tmp, f"f{i:03d}.png")
                img.save(p)
                f.write(f"file '{p}'\nduration {secs:.3f}\n")
            f.write(f"file '{p}'\n")
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst]
        if audio:
            cmd += ["-i", audio, "-c:a", "aac", "-b:a", "192k", "-shortest"]
        cmd += ["-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                "-tune", "stillimage", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)
    print(f"wrote {out} ({sum(s for _, s in segments):.1f}s)")


if __name__ == "__main__":
    main()

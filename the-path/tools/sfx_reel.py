"""Render every SFX cue, an audition reel, an in-time SFX track and QA material.

outputs (git-ignored):
  out/sfx/NNN_name.wav             each cue, 48 kHz / 24-bit stereo
  out/review/sfx_reel.m4a          all cues in order with gaps (+ sfx_reel_index.txt)
  out/review/sfx_timeline.m4a      all cues at their film frames over 21.2 s (no music, no VO)
  out/review/sfx_spectrograms.png  per-cue spectrograms for visual QA
usage: .venv/bin/python -I tools/sfx_reel.py
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from audio import sfx  # noqa: E402
from audio.synth import SR, write_wav  # noqa: E402

OUT_SFX = ROOT / "out/sfx"
OUT_REV = ROOT / "out/review"
GAP = 0.35
FONT = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 13)


def spectrogram(x, n_fft=1024, hop=256):
    m = x.mean(axis=1)
    if len(m) < n_fft:
        m = np.pad(m, (0, n_fft - len(m)))
    frames = 1 + (len(m) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(frames)[:, None]
    S = np.abs(np.fft.rfft(m[idx] * np.hanning(n_fft), axis=1))
    return 20 * np.log10(S + 1e-7)


def encode(wav, m4a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", "256k", str(m4a)], check=True)


def main():
    tl = json.loads((ROOT / "brief/timeline.json").read_text(encoding="utf-8"))
    cues = tl["sfx"]
    OUT_SFX.mkdir(parents=True, exist_ok=True)
    OUT_REV.mkdir(parents=True, exist_ok=True)
    rendered, report = {}, []
    t0 = time.time()
    for c in cues:
        x = sfx.render_cue(c["name"], c["layer"])
        rendered[c["n"]] = x
        write_wav(OUT_SFX / f"{c['n']:03d}_{c['name']}.wav", x)
        pk = 20 * np.log10(np.max(np.abs(x)) + 1e-12)
        rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
        edge = max(np.max(np.abs(x[0])), np.max(np.abs(x[-1])))  # first/last sample must be silent
        report.append((c["n"], c["name"], c["layer"], len(x) / SR, pk, rms, edge, bool(np.isfinite(x).all())))
    print(f"rendered {len(cues)} cues in {time.time() - t0:.1f}s")

    # sequential audition reel
    total = sum(len(x) for x in rendered.values()) + int(GAP * SR) * len(cues)
    reel = np.zeros((total, 2))
    pos, index = 0, []
    for c in cues:
        x = rendered[c["n"]]
        reel[pos:pos + len(x)] += x
        index.append(f"{pos / SR:7.2f}s  #{c['n']:3d} f{c['f']:<5d} {c['scene']:<4s} {c['name']:<24s} {c['desc']}")
        pos += len(x) + int(GAP * SR)
    write_wav(OUT_REV / "sfx_reel.wav", reel)
    encode(OUT_REV / "sfx_reel.wav", OUT_REV / "sfx_reel.m4a")
    (OUT_REV / "sfx_reel_index.txt").write_text("\n".join(index) + "\n", encoding="utf-8")

    # all cues at their film frames (sample = frame * 800); simple layer balance
    bal = {"hero": 0.0, "impact": -2.0, "whoosh": -3.0, "path": -4.0, "ui": -4.0, "character": -4.0, "texture": -6.0, "text": -4.0}
    n = tl["total_frames"] * tl["samples_per_frame"]
    track = np.zeros((n, 2))
    for c in cues:
        x = rendered[c["n"]] * 10 ** (bal[c["layer"]] / 20)
        s0 = c["f"] * tl["samples_per_frame"]
        k = min(len(x), n - s0)
        track[s0:s0 + k] += x[:k]
    pk = np.max(np.abs(track))
    track *= 10 ** (-1.0 / 20) / pk
    write_wav(OUT_REV / "sfx_timeline.wav", track)
    encode(OUT_REV / "sfx_timeline.wav", OUT_REV / "sfx_timeline.m4a")

    # spectrogram sheet
    cols, cw, chh = 6, 320, 150
    rows = (len(cues) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (chh + 22)), (16, 20, 24))
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(cues):
        S = spectrogram(rendered[c["n"]])
        S = np.clip((S - S.max() + 80) / 80, 0, 1).T[::-1]  # 80 dB range, low freq at bottom
        img = Image.fromarray((np.stack([S ** 1.2 * 255, S ** 0.8 * 230, S ** 2.5 * 120], -1)).astype(np.uint8))
        img = img.resize((cw - 10, chh), Image.BILINEAR)
        x0, y0 = (i % cols) * cw + 5, (i // cols) * (chh + 22)
        sheet.paste(img, (x0, y0 + 18))
        d.text((x0, y0 + 2), f"#{c['n']} {c['name']} ({len(rendered[c['n']]) / SR:.2f}s)", font=FONT, fill=(220, 225, 228))
    sheet.save(OUT_REV / "sfx_spectrograms.png")

    bad = [r for r in report if not r[7] or r[6] > 1e-4 or r[4] > -0.5]
    print(f"reel {total / SR:.1f}s, timeline peak normalised to -1 dBFS (pre-norm peak {20 * np.log10(pk):.1f} dBFS)")
    print("cues failing checks (non-finite, non-silent first/last sample, or peak > -0.5 dBFS):", [(r[0], r[1]) for r in bad] or "none")
    for r in report[:5] + report[-5:]:
        print(f"  #{r[0]:3d} {r[1]:<24s} {r[2]:<9s} {r[3]:5.2f}s peak {r[4]:6.1f} dBFS rms {r[5]:6.1f} dBFS")


if __name__ == "__main__":
    main()

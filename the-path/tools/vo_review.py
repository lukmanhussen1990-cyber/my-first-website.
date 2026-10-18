"""Phase 3 review material for the locked VO (all written to git-ignored out/review/).

  vo_stem.png          the finished stem over the whole film: spectrogram, level, every word,
                       anchors, end limits, hero cues, room-tone fills and scenes
  vo_sfx_preview.m4a   the VO stem with all 114 SFX cues at their locked frames (no music yet)
  vo_animatic.mp4      60 fps timing animatic (not the film): scenes, karaoke captions from
                       the measured words, events as they fire, the S6 reply caption and its
                       syllable-envelope waveform, a scrolling VO waveform

usage: .venv/bin/python -I tools/vo_review.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from audio import dynamics, loudness, reply, sfx, synth, voice  # noqa: E402

OUT = ROOT / "out/review"
TL = json.loads((ROOT / "brief/timeline.json").read_text(encoding="utf-8"))
WORDS = json.loads((ROOT / "vo/words.json").read_text(encoding="utf-8"))["words"]
EDIT = json.loads((ROOT / "vo/edit.json").read_text(encoding="utf-8"))
FPS, SR, SPF = TL["fps"], TL["audio_rate"], TL["samples_per_frame"]
NF = TL["total_frames"]
STAGE = (6, 10, 12)
GREEN = (88, 204, 2)
GOLD = (255, 200, 0)
INK = (226, 232, 235)
DIM = (110, 124, 132)
SCENE_COLORS = {"S1": (88, 204, 2), "S2": (137, 226, 25), "S3": (28, 176, 246), "S4": (255, 150, 0), "S5": (255, 200, 0),
                "S6": (206, 130, 255), "S7": (88, 204, 2), "S8": (240, 240, 240), "S9": (137, 226, 25), "S10": (120, 140, 150)}
INTER = "/usr/share/fonts/opentype/inter/Inter-{}.otf"
NUNITO = ROOT / "assets/fonts/nunito/Nunito[wght].ttf"


def font(size, weight=800):
    f = ImageFont.truetype(str(NUNITO), size)
    f.set_variation_by_axes([weight])
    return f


def inter(size, style="Regular"):
    return ImageFont.truetype(INTER.format(style), size)


def read_wav(path):
    with wave.open(str(path)) as w:
        ch, n, b = w.getnchannels(), w.getnframes(), w.readframes(w.getnframes())
    a = np.frombuffer(b, np.uint8).reshape(-1, 3)
    v = a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)
    v = np.where(v >= 1 << 23, v - (1 << 24), v)
    return (v.reshape(-1, ch) / 2 ** 23)[:, 0] if ch == 1 else v.reshape(-1, ch) / 2 ** 23


def events():
    out = []
    for e in TL["events"]:
        f = e["f"] if "f" in e else int(round(e["t"] * FPS))
        out.append({**e, "f": f})
    return sorted(out, key=lambda e: e["f"])


def scenes():
    return [{**s, "f0": int(round(s["t0"] * FPS)), "f1": int(round(s["t1"] * FPS))} for s in TL["scenes"]]


# ------------------------------------------------------------------ stem plot

def stem_plot(stem):
    pxs = 90
    W = int(NF / FPS * pxs)
    S = voice.stft_db(stem, 1024, 240)[:, : int(9000 / (SR / 1024))].T[::-1]
    img = np.clip((S - (S.max() - 85)) / 85, 0, 1)
    spec = cv2.resize(cv2.applyColorMap((img * 255).astype(np.uint8), cv2.COLORMAP_MAGMA), (W, 200), interpolation=cv2.INTER_AREA)
    env = voice.envelope(stem)
    lvl = np.full((110, W, 3), 10, np.uint8)
    for d in (-60, -45, -30, -15):
        y = int(-d / 70 * 109)
        cv2.line(lvl, (0, y), (W, y), (40, 40, 40), 1)
    xs = (env.t(np.arange(len(env.db))) * pxs).astype(int)
    ys = (-env.db / 70 * 109).clip(0, 109).astype(int)
    cv2.polylines(lvl, [np.stack([xs, ys], 1).reshape(-1, 1, 2)], False, (90, 220, 120), 1)
    top = 70
    canvas = Image.new("RGB", (W + 40, top + 200 + 110 + 120), STAGE)
    canvas.paste(Image.fromarray(np.vstack([spec, lvl])[..., ::-1]), (20, top))
    d = ImageDraw.Draw(canvas)
    f13, f15, f18 = inter(13), inter(15), inter(18, "SemiBold")
    X = lambda t: 20 + t * pxs  # noqa: E731
    for s in scenes():
        d.rectangle([X(s["f0"] / FPS), 34, X(s["f1"] / FPS) - 2, 46], fill=SCENE_COLORS[s["id"]])
        d.text((X(s["f0"] / FPS) + 3, 48), f"{s['id']} {s['name']}", font=f13, fill=DIM)
    for r in EDIT["edl"]:
        if r["kind"] == "room tone":
            d.rectangle([X(r["dst_t0"]), top + 200, X(r["dst_t1"]), top + 310], outline=(60, 110, 170))
    for h in TL["hero_audio"]:
        d.line([(X(h["f"] / FPS), top), (X(h["f"] / FPS), top + 310)], fill=GOLD, width=2)
    for seg in TL["vo"]["segments"]:
        m = seg["measured"]
        d.line([(X(m["onset_f"] / FPS), top - 6), (X(m["onset_f"] / FPS), top + 316)], fill=GREEN, width=2)
        d.line([(X(m["end_limit_t"]), top + 200), (X(m["end_limit_t"]), top + 316)], fill=(255, 75, 75), width=2)
    for w in WORDS:
        d.text((X(w["onset_t"]) + 2, top + 314 + (w["index"] % 3) * 16), w["text"], font=f13, fill=INK)
        d.line([(X(w["onset_t"]), top + 200), (X(w["onset_t"]), top + 312)], fill=(0, 200, 255))
    for sec in range(0, int(NF / FPS) + 1):
        d.text((X(sec) + 2, top + 296), f"{sec}s", font=f13, fill=DIM)
    r = EDIT["result"]
    d.text((20, 6), f"VO stem (take {EDIT['take']}): {r['integrated_lufs']} LUFS, {r['true_peak_dbtp']} dBTP.  Green = segment onsets on their anchor frames; "
                    f"red = end limits; gold = hero cues; blue boxes = room-tone fills; cyan = word onsets", font=f18, fill=INK)
    canvas.save(OUT / "vo_stem.png")


# --------------------------------------------------------------- preview mix

def preview_mix(stem):
    n = NF * SPF
    track = np.zeros((n, 2))
    bal = {"hero": 0.0, "impact": -2.0, "whoosh": -3.0, "path": -4.0, "ui": -4.0, "character": -4.0, "texture": -6.0, "text": -4.0}
    for c in TL["sfx"]:
        x = sfx.render_cue(c["name"], c["layer"]) * 10 ** (bal[c["layer"]] / 20)
        s0 = c["f"] * SPF
        k = min(len(x), n - s0)
        track[s0:s0 + k] += x[:k]
    vo = np.stack([stem, stem], 1) * 10 ** (-3 / 20)          # centre, -3 dB pan law
    g = loudness.integrated(vo) - 10.0 - loudness.integrated(track)   # SFX bus 10 LU under the voice
    mix = vo + track * 10 ** (g / 20)
    mix *= 10 ** ((-16.0 - loudness.integrated(mix)) / 20)
    mix, _ = dynamics.tp_limiter(mix, ceiling_dbtp=-1.5)
    synth.write_wav(OUT / "vo_sfx_preview.wav", mix)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "vo_sfx_preview.wav"), "-c:a", "aac", "-b:a", "256k",
                    str(OUT / "vo_sfx_preview.m4a")], check=True)
    return mix


# ----------------------------------------------------------------- animatic

def animatic(stem):
    W, H = 1280, 720
    ev = events()
    sc = scenes()
    hero_ids = {e["id"] for e in ev if e.get("kind") == "hero"}
    cap = font(46, 800)
    small = inter(15)
    mid = inter(20, "SemiBold")
    big = font(30, 900)
    tc = inter(18, "SemiBold")
    rep_font = font(28, 700)
    segs = {}
    for w in WORDS:
        segs.setdefault(w["segment"], []).append(w)
    seg_span = {n: (ws[0]["onset_f"] - 12, ws[-1]["end_f"] + 24) for n, ws in segs.items()}
    label = {"slam": "SLAM", "start_press": "START", "excellent": "Excellent!", "ignite": "ignite", "counter_land": "365",
             "drop": "DROP", "rank_1": "#1", "pull_back": "pull-back", "languages": "Languages", "math": "Math", "music": "Music",
             "chess": "Chess", "one_path": "One path,", "every_skill": "every skill.", "breath": "breath", "landing": "Duo lands",
             "duolingo_shown": "duolingo", "fanfare": "fanfare", "end_card": "end card", "dive": "dive", "push_in": "push-in",
             "leap": "leap", "to_call": "call", "converge": "converge"}
    # waveform strip: peak per 1/240 s column
    col = SR // 240
    peaks = np.abs(stem[: len(stem) // col * col]).reshape(-1, col).max(axis=1)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                             "-i", "-", "-i", str(OUT / "vo_sfx_preview.wav"), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
                             str(OUT / "vo_animatic.mp4")], stdin=subprocess.PIPE)
    for f in range(NF):
        im = Image.new("RGB", (W, H), STAGE)
        d = ImageDraw.Draw(im)
        t = f / FPS
        d.text((24, 18), "THE PATH · Phase 3 timing animatic · VO + SFX, no music yet · not the film", font=small, fill=DIM)
        d.text((W - 24, 16), f"f{f:04d}   {t:6.3f} s", font=tc, fill=INK, anchor="ra")
        # scene bar
        x0, x1, y0 = 24, W - 24, 56
        for s in sc:
            a = x0 + (x1 - x0) * s["f0"] / NF
            b = x0 + (x1 - x0) * s["f1"] / NF
            on = s["f0"] <= f < s["f1"]
            colr = SCENE_COLORS[s["id"]] if on else tuple(int(c * 0.35) for c in SCENE_COLORS[s["id"]])
            d.rectangle([a, y0, b - 2, y0 + (14 if on else 8)], fill=colr)
            if on:
                d.text((24, 84), f"{s['id']} · {s['name']}", font=big, fill=SCENE_COLORS[s["id"]])
        px = x0 + (x1 - x0) * f / NF
        d.line([(px, y0 - 4), (px, y0 + 18)], fill=INK, width=2)
        # caption: the active segment, words lit as they are spoken
        active = [n for n, (a, b) in seg_span.items() if a <= f <= b]
        if active:
            ws = segs[active[-1]]
            parts, xw = [], 0
            for w in ws:
                txt = w["text"] + " "
                parts.append((txt, xw, w))
                xw += d.textlength(txt, font=cap)
            sx = (W - xw) / 2
            for txt, ox, w in parts:
                if f >= w["end_f"]:
                    colr = INK
                elif f >= w["onset_f"]:
                    colr = GREEN
                else:
                    colr = (70, 82, 88)
                d.text((sx + ox, 300), txt, font=cap, fill=colr, anchor="ls")
        # events: pills that fade over 40 frames
        y = 350
        for e in ev:
            age = f - e["f"]
            if 0 <= age < 40 and e["id"] in label:
                k = 1 - age / 40
                hero = e["id"] in hero_ids
                colr = tuple(int(c * k + s * (1 - k)) for c, s in zip(GOLD if hero else INK, STAGE))
                txt = label[e["id"]]
                tw = d.textlength(txt, font=mid)
                cx = W / 2 + (-160 if hero else 160)
                d.rounded_rectangle([cx - tw / 2 - 14, y, cx + tw / 2 + 14, y + 36], radius=18, outline=colr, width=2)
                d.text((cx, y + 18), txt, font=mid, fill=colr, anchor="mm")
                y += 44
        # S6: the captioned Spanish reply and its syllable-envelope waveform (audio/reply.py)
        if reply.WAVE_F[0] - 4 <= f <= reply.WAVE_F[1] + 20:
            shown = [u for (u, _), rf in zip(reply.WORDS, reply.REVEAL_F) if f >= rf]
            d.text((W / 2, 432), " ".join(shown), font=rep_font, fill=(206, 130, 255), anchor="mm")
            amp = float(reply.amplitude(f))
            xs_r = np.arange(380, 900, 3)
            ys_r = 478 + amp * 26 * np.sin(2 * np.pi * xs_r / 18.0 + f * 1.3) * np.hanning(len(xs_r))
            d.line(list(zip(xs_r.tolist(), ys_r.tolist())), fill=GREEN, width=3)
        # scrolling waveform +/- 3 s
        wy0, wy1 = 520, 690
        mid_y = (wy0 + wy1) / 2
        d.rectangle([24, wy0, W - 24, wy1], outline=(30, 40, 46))
        span = 6.0
        c0 = int((t - span / 2) * 240)
        cols = np.arange(c0, c0 + int(span * 240))
        xs = 24 + (cols - c0) * (W - 48) / (span * 240)
        vals = np.where((cols >= 0) & (cols < len(peaks)), peaks[np.clip(cols, 0, len(peaks) - 1)], 0.0)
        for xv, v in zip(xs[::2], vals[::2]):
            h = min(v, 1.0) * (wy1 - wy0) * 0.45
            d.line([(xv, mid_y - h), (xv, mid_y + h)], fill=(70, 160, 90))
        for w in WORDS:
            if abs(w["onset_t"] - t) < span / 2:
                xv = 24 + (w["onset_t"] - (t - span / 2)) / span * (W - 48)
                d.line([(xv, wy0), (xv, wy0 + 10)], fill=(0, 200, 255))
                d.text((xv + 2, wy0 + 12), w["text"], font=small, fill=(150, 200, 220))
        for e in ev:
            et = e["f"] / FPS
            if abs(et - t) < span / 2:
                xv = 24 + (et - (t - span / 2)) / span * (W - 48)
                colr = GOLD if e["id"] in hero_ids else DIM
                d.line([(xv, wy1 - 14), (xv, wy1)], fill=colr, width=2)
        d.line([(W / 2, wy0 - 6), (W / 2, wy1 + 6)], fill=INK, width=2)
        proc.stdin.write(np.asarray(im).tobytes())
    proc.stdin.close()
    proc.wait()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stem = read_wav(ROOT / "out/vo/vo_stem.wav")
    stem_plot(stem)
    mix = preview_mix(stem)
    print(f"preview mix {loudness.integrated(mix):.2f} LUFS, {loudness.true_peak(mix):.2f} dBTP")
    animatic(stem)
    print("wrote", ", ".join(p.name for p in sorted(OUT.glob("vo_*"))))


if __name__ == "__main__":
    main()

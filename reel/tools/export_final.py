#!/usr/bin/env python3
"""Final export: the clean 3D render + the mixed sound + burned-in subtitles.

  out/clean_video.mp4  (3D render, no text, no sound; made by tools/render_segments.mjs)
+ build/mix.wav        (tools/mix_audio.py)        -> loudness-normalised to -14 LUFS
+ build/subs.ass       (tools/subtitles.py)        -> burned in with libass
= out/roadster_through_the_earth.mp4   (H.264 High, yuv420p, 1080x1920, 30 fps, AAC 48 kHz)

Usage:  python3 tools/export_final.py
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.environ.get("CLEAN_VIDEO", os.path.join(ROOT, "out", "clean_video.mp4"))
OUT = os.environ.get("OUT_VIDEO", os.path.join(ROOT, "out", "roadster_through_the_earth.mp4"))
MIX = os.path.join(ROOT, "build", "mix.wav")
MASTER = os.path.join(ROOT, "build", "mix_master.wav")
SUBS = os.path.join(ROOT, "build", "subs.ass")
LOUD = "I=-14:TP=-1.5:LRA=11"   # only used to measure
TARGET_LUFS = -14.0


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def main():
    for p in (CLEAN, MIX, SUBS):
        if not os.path.exists(p):
            sys.exit(f"missing {os.path.relpath(p, ROOT)}")
    # 1. loudness: measure, lift to -14 LUFS, and catch the peaks with a limiter (-2.3 dBFS)
    def measure(path):
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", f"loudnorm={LOUD}:print_format=json",
                            "-f", "null", "-"], capture_output=True, text=True, check=True)
        return json.loads(re.findall(r"\{[^{}]*\}", r.stderr, re.S)[-1])
    m = measure(MIX)
    gain = TARGET_LUFS - float(m["input_i"]) + 0.4   # +0.4 dB: what the limiter takes back
    af = f"volume={gain:.2f}dB,alimiter=limit=0.77:attack=5:release=80:level=0,aresample=48000"
    run(["ffmpeg", "-v", "error", "-y", "-i", MIX, "-af", af, "-c:a", "pcm_s16le", MASTER])
    f = measure(MASTER)
    print(f"audio: {float(m['input_i']):.1f} LUFS -> {float(f['input_i']):.1f} LUFS, true peak {float(f['input_tp']):.1f} dBTP")
    # 2. picture + subtitles + sound
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fonts = os.path.join(ROOT, "assets", "fonts")
    vf = f"ass={SUBS}:fontsdir={fonts}"
    run(["ffmpeg", "-v", "error", "-y", "-i", CLEAN, "-i", MASTER, "-map", "0:v:0", "-map", "1:a:0", "-vf", vf,
         "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "9M", "-bufsize", "18M",
         "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", "30",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", OUT])
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,r_frame_rate",
                           "-of", "json", OUT], capture_output=True, text=True, check=True).stdout
    d = json.loads(info)
    v = [s for s in d["streams"] if s.get("width")][0]
    a = [s for s in d["streams"] if not s.get("width")][0]
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} fps + "
          f"{a['codec_name']}, {float(d['format']['duration']):.2f} s, {int(d['format']['size']) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

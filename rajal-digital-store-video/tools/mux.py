#!/usr/bin/env python3
"""Encode the final MP4: lossless frames (build/silent.mkv) + soundtrack (build/mix.wav).

Video: H.264 High, yuv420p, BT.709, 30 fps, faststart (plays everywhere: WhatsApp, Facebook, YouTube).
Audio: AAC-LC 192 kbps, two-pass loudness-normalised to -15 LUFS (true peak <= -1.5 dB).

    python tools/mux.py [output.mp4]
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("out", nargs="?", default=str(ROOT / "rajal-digital-store.mp4"))
ap.add_argument("--crf", default="23", help="x264 quality (lower = bigger/better)")
ap.add_argument("--maxrate", default="5000k", help="cap so the file stays easy to share")
ap.add_argument("--preset", default="medium")
args = ap.parse_args()
OUT = Path(args.out)
TARGET = "I=-15:TP=-1.5:LRA=9"

# pass 1: measure
p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(ROOT / "build/mix.wav"),
                    "-af", f"loudnorm={TARGET}:print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True)
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S).group(0))
print("measured:", {k: m[k] for k in ("input_i", "input_tp", "input_lra", "input_thresh")})
af = (f"loudnorm={TARGET}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")

# pass 2: encode
vf = "scale=in_range=tv:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p"
cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
       "-i", str(ROOT / "build/silent.mkv"), "-i", str(ROOT / "build/mix.wav"),
       "-vf", vf, "-af", af,
       "-c:v", "libx264", "-preset", args.preset, "-crf", args.crf, "-maxrate", args.maxrate, "-bufsize", "10000k",
       "-profile:v", "high", "-level", "4.1",
       "-x264-params", "aq-mode=3:bframes=3", "-r", "30",
       "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
       "-movflags", "+faststart", "-shortest", str(OUT)]
subprocess.run(cmd, check=True)
print("wrote", OUT, f"{OUT.stat().st_size / 1e6:.1f} MB")

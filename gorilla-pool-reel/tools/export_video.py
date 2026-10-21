#!/usr/bin/env python3
"""Burns the subtitles onto the clean 3D render and muxes the soundtrack.

  output/video_clean.mp4 (picture only, no subtitles) + output/audio/mix.wav
  + output/subtitles.ass  ->  output/gorilla_pool_reel.mp4  (H.264 / AAC, 1080x1920, 30 fps)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "video_clean.mp4"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "output" / "gorilla_pool_reel.mp4"
    ass = ROOT / "output" / "subtitles.ass"
    mix = ROOT / "output" / "audio" / "mix.wav"
    # libass filter paths: escape for the filtergraph parser
    esc = lambda p: str(p).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    vf = f"ass='{esc(ass)}':fontsdir='{esc(ROOT / 'fonts')}',scale=1080:1920:flags=lanczos,format=yuv420p"
    # two-pass loudness normalisation to -14 LUFS / -1.5 dBTP (Instagram-friendly)
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(mix), "-af",
                            "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(re.findall(r"\{[^{}]*\}", probe)[-1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(src), "-i", str(mix),
        "-map", "0:v:0", "-map", "1:a:0",
        "-vf", vf, "-r", "30",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-level", "4.2",
        "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-af", af,
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-t", "50", "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()

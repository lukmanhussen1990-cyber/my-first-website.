#!/usr/bin/env python3
"""Finish a rendered reel: audio mix, final MP4s, cover, loudness check.

Needs build/final_video.mp4 (from render.mjs --video build/final_video.mp4) and
build/timeline_<vo>.json. Writes to out/:
  reel_final.mp4      voice + SFX + music, 1080x1920, 30 fps, H.264 + AAC, -14 LUFS
  reel_no_music.mp4   voice + SFX only (add trending audio in Instagram)
  cover.jpg           1080x1920 frame at --cover-time

Usage: python3 finish.py PROJECT_DIR --vo vo_el --cover-time 5.2
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(cmd):
    subprocess.run(cmd, check=True)


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    vals = {}
    for line in tail.splitlines():
        line = line.strip()
        for key in ("I:", "LRA:", "Peak:"):
            if line.startswith(key):
                vals[key[:-1]] = line.split()[1]
    return vals


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--vo", default="vo_el")
    ap.add_argument("--cover-time", type=float, default=None)
    ap.add_argument("--skip-mix", action="store_true")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    build, out = os.path.join(P, "build"), os.path.join(P, "out")
    os.makedirs(out, exist_ok=True)
    video = os.path.join(build, "final_video.mp4")
    if not a.skip_mix:
        run([sys.executable, os.path.join(HERE, "mix.py"), P, "--vo", a.vo])
    for name, wav in (("reel_final.mp4", "mix_full.wav"), ("reel_no_music.mp4", "mix_nomusic.wav")):
        dst = os.path.join(out, name)
        run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", os.path.join(build, "audio", wav),
             "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
             "-shortest", "-movflags", "+faststart", dst])
        L = loudness(dst)
        info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate:format=duration,size",
                               "-of", "compact=p=0", dst], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
        print(f"{name}: {info} | loudness I={L.get('I')} LUFS, LRA={L.get('LRA')} LU, true peak={L.get('Peak')} dBFS")
    if a.cover_time is not None:
        root = os.path.dirname(os.path.dirname(HERE))
        proj = os.path.basename(P)
        run(["node", os.path.join(root, "engine", "render.mjs"), "--project", proj, "--vo", a.vo,
             "--stills", f"{a.cover_time:.2f}", "--outdir", "build/cover"])
        png = os.path.join(build, "cover", "t" + f"{a.cover_time:.2f}".rjust(7, "0") + ".png")
        run(["ffmpeg", "-v", "error", "-y", "-i", png, "-q:v", "1", os.path.join(out, "cover.jpg")])
        print("cover.jpg written")


if __name__ == "__main__":
    main()

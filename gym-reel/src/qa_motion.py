"""Scan a rendered video for pops (big frame-to-frame jumps away from cuts) and frozen frames.

usage: python qa_motion.py video.mp4
"""
import subprocess
import sys

import numpy as np

from cues import CUTS

W, H = 135, 240


def frames(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo",
                          "-"], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(W * H)
        if len(b) < W * H:
            break
        yield np.frombuffer(b, np.uint8).astype(np.float32)


def main():
    path = sys.argv[1]
    cut_frames = sorted(set(int(round(v * 60)) for v in CUTS.values()))
    prev = None
    diffs = []
    for f in frames(path):
        if prev is not None:
            diffs.append(np.abs(f - prev).mean())
        prev = f
    d = np.array(diffs)
    print(f"frames: {len(d) + 1}  median diff {np.median(d):.2f}  p95 {np.percentile(d, 95):.2f}")
    # pops: local spikes > 4x the local median, not at a cut
    flagged = []
    for i in range(len(d)):
        lo, hi = max(0, i - 8), min(len(d), i + 9)
        local = np.median(d[lo:hi])
        frame = i + 1
        near_cut = any(abs(frame - c) <= 1 for c in cut_frames)
        if d[i] > max(4 * local, 6.0) and not near_cut:
            flagged.append((frame, frame / 60, d[i], local))
    print(f"possible pops (not at cuts): {len(flagged)}")
    for fr, t, v, loc in flagged:
        print(f"  frame {fr:5d}  t={t:6.3f}  diff {v:6.2f}  (local {loc:.2f})")
    frozen = [i + 1 for i in range(len(d)) if d[i] < 0.02]
    print(f"frozen frames: {len(frozen)} {frozen[:20]}")


if __name__ == "__main__":
    main()

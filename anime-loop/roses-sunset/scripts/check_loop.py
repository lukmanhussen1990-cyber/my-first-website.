import numpy as np, subprocess, sys
path, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cmd = ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
fs = w * h * 3
first = prev = None; diffs = []; n = 0
while True:
    b = p.stdout.read(fs)
    if len(b) < fs: break
    f = np.frombuffer(b, np.uint8).reshape(h, w, 3).astype(np.int16)
    if first is None: first = f
    if prev is not None: diffs.append(np.abs(f - prev).mean())
    prev = f; n += 1
p.wait()
diffs = np.array(diffs)
seam = np.abs(first - prev).mean()
print(f"frames={n}  consecutive MAD: mean={diffs.mean():.4f} min={diffs.min():.4f} max={diffs.max():.4f} p99={np.percentile(diffs,99):.4f}")
print(f"seam (last->first) MAD={seam:.4f}  max abs pixel diff last vs first={np.abs(first-prev).max()}")
# smoothness: largest jump in the diff series (acceleration spikes => flicker/jerk)
dd = np.abs(np.diff(diffs)); print(f"max change between successive MADs={dd.max():.4f} (mean {dd.mean():.4f})")

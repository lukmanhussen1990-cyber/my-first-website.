"""Low-res preview clip: original frames n0..n1 (960x540) with rendered frames swapped in, plus matching audio.
usage: make_clip.py out.mp4 n0 n1 first_frame:dir [first_frame:dir ...]"""
import sys, os, subprocess, glob
import numpy as np, cv2
SRC = "/root/.claude/uploads/c69215b6-4697-53a1-bac1-6c6b85bcc43f/397f8b4b-Introducing_Claude_Fable_5.1_-_Anthropic_1080p_h264.mp4"
FPS = 24000 / 1001
out, n0, n1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
rep = {}
for arg in sys.argv[4:]:
    f0, d = arg.split(":", 1)
    for k, p in enumerate(sorted(glob.glob(os.path.join(d, "*.png")))):
        rep[int(f0) + k] = p
w, h = 960, 540
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-vf", f"select='between(n\\,{n0}\\,{n1})',scale={w}:{h}:flags=area", "-vsync", "0",
                      "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).copy()
for n in range(n0, n1 + 1):
    if n in rep:
        im = cv2.imread(rep[n])
        if im.shape[1] != w: im = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
        frames[n - n0] = im
t0 = (n0 + 1) / FPS                 # display time of frame n0 (stream starts at pts 1001)
dur = (n1 - n0 + 1) / FPS
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", "24000/1001", "-i", "-",
                        "-ss", f"{t0:.4f}", "-t", f"{dur:.4f}", "-i", SRC, "-map", "0:v", "-map", "1:a",
                        "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                        "-movflags", "+faststart", "-shortest", out], stdin=subprocess.PIPE)
enc.stdin.write(frames.tobytes()); enc.stdin.close(); enc.wait()
print(out, len(frames), "frames,", sum(1 for n in range(n0, n1 + 1) if n in rep), "replaced")

"""Turn a folder of (possibly gappy) rendered frames into a 30 fps clip in sync with the audio.
Missing frames repeat the previous rendered frame.
    python3 scripts/assemble_rough.py FRAMES_DIR OUT.mp4 [HEIGHT=256] [LAST_FRAME]"""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, out = sys.argv[1], sys.argv[2]
h = int(sys.argv[3]) if len(sys.argv) > 3 else 256
have = sorted(int(f[2:6]) for f in os.listdir(src) if f.endswith(".png") and os.path.getsize(os.path.join(src, f)) > 0)
last = int(sys.argv[4]) if len(sys.argv) > 4 else max(have)
seq = os.path.join(ROOT, "render", "rough_seq")
os.makedirs(seq, exist_ok=True)
for f in os.listdir(seq):
    os.remove(os.path.join(seq, f))
prev = None
for i in range(1, last + 1):
    if i in have:
        prev = i
    use = prev if prev is not None else have[0]
    os.symlink(os.path.abspath(os.path.join(src, f"f_{use:04d}.png")), os.path.join(seq, f"f_{i:04d}.png"))
dur = last / 30
total = 55.5 if last >= 1624 else dur
tail = max(0.0, total - dur)
mix = os.path.join(ROOT, "audio", "mix.wav")
w = h * 9 // 16
vf = (f"scale=1080:1920:flags=bicubic,tpad=stop_mode=clone:stop_duration={tail:.3f},"
      f"ass={ROOT}/audio/captions.ass:fontsdir={ROOT}/assets/fonts,scale={w}:{h}:flags=area,format=yuv420p")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-start_number", "1", "-i", os.path.join(seq, "f_%04d.png"),
                "-i", mix, "-vf", vf, "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-c:a", "aac", "-b:a", "64k",
                "-ac", "2", "-t", f"{total:.3f}", "-movflags", "+faststart", out], check=True)
print("rough ->", out, f"{total:.1f}s from {len(have)} rendered frames")

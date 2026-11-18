"""Low-quality preview: odd frames (15 fps) from /opt/work/quick, captions, mix -> preview.mp4"""
import sys, os, subprocess
sys.path.insert(0, "/opt/work/post")
from PIL import Image
import compose

W, H = 540, 960
out = sys.argv[1]
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "15", "-i", "-",
       "-i", "/opt/work/post/mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
       "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-shortest", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
last = None
for f in range(1, compose.TOTAL + 1, 2):
    path = f"/opt/work/quick/{f:04d}.jpg"
    if os.path.exists(path):
        last = Image.open(path).convert("RGBA").resize((W, H), Image.BILINEAR)
    img = last.copy()
    c = compose.caption_for(f)
    if c:
        s = compose.bounce_scale(f - c["f0"]) if c["bounce"] else 1.0
        L = compose.text_layer(c["text"], s * 0.5)
        img.alpha_composite(L, ((W - L.width) // 2, compose.CY // 2 - L.height // 2))
    p.stdin.write(img.convert("RGB").tobytes())
p.stdin.close(); p.wait()
print("PREVIEW ENCODED", out, p.returncode)

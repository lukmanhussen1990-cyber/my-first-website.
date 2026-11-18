import sys, subprocess
sys.path.insert(0, "/opt/work/post")
import compose
N = int(sys.argv[1]); out = sys.argv[2]
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1080x1920", "-r", "30", "-i", "-",
       "-i", "/opt/work/post/mix.wav", "-map", "0:v", "-map", "1:a", "-t", f"{N/30:.3f}",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "1", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(1, N + 1):
    p.stdin.write(compose.compose_frame(f).tobytes())
p.stdin.close(); p.wait()
print("PARTIAL", out, p.returncode)

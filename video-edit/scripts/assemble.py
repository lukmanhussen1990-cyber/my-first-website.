"""Final assembly: original video with the new segments swapped in at exact frames, subtitles burned in,
original audio stream-copied. Untouched frames pass through as raw YUV (no colour conversion); new frames
are converted RGB -> YUV 4:2:0 with BT.709 limited range (same matrix ffmpeg used to decode them)."""
import os, sys, subprocess
SCR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "/root/.claude/uploads/c69215b6-4697-53a1-bac1-6c6b85bcc43f/397f8b4b-Introducing_Claude_Fable_5.1_-_Anthropic_1080p_h264.mp4"
OUT = sys.argv[1]
ASS = sys.argv[2]
W, H = 1920, 1080
FS = W * H * 3 // 2
SEGMENTS = [  # (first original frame, rendered PNG dir)
    (21, "renders/A_full"), (326, "renders/B_full"), (762, "renders/C_full"),
    (1227, "renders/D_full"), (1796, "renders/E_full"), (1926, "renders/F_trans_full"),
]
rep = {}
for f0, d in SEGMENTS:
    d = os.path.join(SCR, d)
    n = len([x for x in os.listdir(d) if x.endswith(".png")])
    yuv = os.path.join(SCR, "work", os.path.basename(d) + ".yuv")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "24000/1001", "-i", os.path.join(d, "%04d.png"),
                    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
                    "-f", "rawvideo", yuv], check=True)
    assert os.path.getsize(yuv) == n * FS, (d, n)
    for k in range(n): rep[f0 + k] = (yuv, k)
    print(f"segment {os.path.basename(d)}: frames {f0}-{f0 + n - 1} ({n})", flush=True)

dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-map", "0:v", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y",
                        "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{W}x{H}", "-framerate", "24000/1001", "-i", "-",
                        "-i", SRC,
                        "-map", "0:v", "-map", "1:a",
                        # restore the original 1001/24000 s video start offset so A/V sync and subtitle times match
                        "-vf", f"setpts=PTS+1001/24000/TB,ass={ASS}",
                        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                        "-c:a", "copy", "-map_metadata", "1", "-video_track_timescale", "24000", "-movie_timescale", "24000", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
handles = {}
n = 0
while True:
    buf = dec.stdout.read(FS)
    if not buf: break
    assert len(buf) == FS
    if n in rep:
        path, k = rep[n]
        fh = handles.setdefault(path, open(path, "rb"))
        fh.seek(k * FS); buf = fh.read(FS)
    enc.stdin.write(buf)
    n += 1
enc.stdin.close(); enc.wait(); dec.wait()
print("frames written:", n, "replaced:", len(rep))

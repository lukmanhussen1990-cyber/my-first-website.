"""Finishing pass and encode for "Bulbul & Shabnaj": a soft bloom on the lights (gold, lanterns, moon), a gentle
vignette and a fine, moving film grain (it also keeps the night gradients free of banding), then H.264 + AAC.
usage: finish.py FRAMES_DIR AUDIO.wav OUT.mp4 [--crf 16 | --bitrate 5M] [--n 1300]"""
import sys, os, argparse, subprocess
import numpy as np, cv2
ap = argparse.ArgumentParser(); ap.add_argument('frames'); ap.add_argument('audio'); ap.add_argument('out')
ap.add_argument('--crf', type=float, default=16); ap.add_argument('--bitrate', default=''); ap.add_argument('--n', type=int, default=1300)
a = ap.parse_args()
W, H = 1920, 1080
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
vig = (1 - 0.2 * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None].astype(np.float32)
def finish(img, f):
    x = img.astype(np.float32) / 255.0
    lum = x @ np.array([0.114, 0.587, 0.299], np.float32)
    hi = x * np.clip((lum - 0.55) / 0.35, 0, 1)[..., None]
    small = cv2.resize(hi, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bloom = 0.55 * cv2.GaussianBlur(small, (0, 0), 3) + 0.35 * cv2.GaussianBlur(small, (0, 0), 9) + 0.25 * cv2.GaussianBlur(small, (0, 0), 22)
    bloom = cv2.resize(bloom, (W, H), interpolation=cv2.INTER_LINEAR) * np.array([0.9, 1.0, 1.08], np.float32)   # BGR: a warm glow
    x = x + 0.32 * bloom
    x = x * vig
    rng = np.random.default_rng(1000 + f)
    g = rng.normal(0, 1.0, (H // 2, W // 2)).astype(np.float32)
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    x = x + g * (1.5 / 255.0) * (0.6 + 0.8 * np.sqrt(np.clip(lum, 0, 1)))[..., None]
    return np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8)
enc = ['-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-x264-params', 'keyint=60:min-keyint=30:aq-mode=3']
enc += (['-b:v', a.bitrate, '-maxrate', a.bitrate, '-bufsize', a.bitrate] if a.bitrate else ['-crf', str(a.crf)])
# RGB -> YUV with the HD (BT.709) matrix, rounded rather than truncated (ffmpeg's default conversion here truncates,
# which darkens everything by about 2 levels and crushes the night shadows), and tagged so players decode it the same way
csc = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '30', '-i', '-',
       '-i', a.audio, '-map', '0:v', '-map', '1:a', *csc, *enc, '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-movflags', '+faststart', '-shortest', a.out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(1, a.n + 1):
    img = cv2.imread(f'{a.frames}/f{f:04d}.png')
    p.stdin.write(finish(img, f).tobytes())
p.stdin.close(); p.wait()
print('wrote', a.out, os.path.getsize(a.out) // 1024, 'KB')

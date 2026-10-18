"""Render frames [a, b) of the vertical recreation and pipe them losslessly (FFV1, RGB) to out.mkv."""
import os, sys, subprocess, time
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
import cv2
cv2.setNumThreads(1)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reel_render as R

a, b, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{R.OW}x{R.OH}',
                      '-r', '30', '-i', '-', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'gbrp', '-g', '1', out],
                     stdin=subprocess.PIPE)
rd = R.Reader(a)
t0 = time.time()
for n in range(a, b):
    img = R.render_frame(rd, n)
    p.stdin.write(img.tobytes())
    if (n - a) % 25 == 0:
        el = time.time() - t0
        print(f'[{a}-{b}) frame {n}  {n - a + 1}/{b - a}  {el:.0f}s  eta {el / (n - a + 1) * (b - n - 1):.0f}s', flush=True)
p.stdin.close()
p.wait()
print('DONE', a, b, 'rc', p.returncode, flush=True)

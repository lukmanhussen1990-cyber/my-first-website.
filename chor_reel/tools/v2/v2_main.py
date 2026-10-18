"""Master renderer for the all-new Kerala-style Chor film: frame n (0..1590) -> uint8 BGR 1920x1080.
usage: v2_main.py a b out.mkv      (renders [a, b) losslessly; FFV1)"""
import os, sys, time, subprocess
os.environ.setdefault('OMP_NUM_THREADS', '1')
import numpy as np, cv2
cv2.setNumThreads(1)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L
import v2_river, v2_door, v2_story, v2_final

N = 1591


def render_frame(n):
    if n <= 281:
        img = v2_river.render_frame(n)
    elif n <= 348:
        img = v2_door.render(min(n, 341))
        k = v2_door.flash_k(n)
        img = img * (1 - k) + v2_door.FLASH_COL * k
    elif n <= 355:
        img = v2_story.render_frame(n)
        k = v2_door.flash_k(n)
        img = img * (1 - k) + v2_door.FLASH_COL * k
    elif n <= 1469:
        img = v2_story.render_frame(n)
    else:
        img = v2_final.render(n)
    return L.u8(img)


if __name__ == '__main__':
    a, b, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1080x1920', '-r', '30',
                          '-i', '-', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'gbrp', '-g', '1', out], stdin=subprocess.PIPE)
    t0 = time.time()
    for n in range(a, b):
        p.stdin.write(render_frame(n).tobytes())
        if (n - a) % 25 == 0:
            el = time.time() - t0
            print(f'[{a}-{b}) frame {n} {n - a + 1}/{b - a} {el:.0f}s eta {el / (n - a + 1) * (b - n - 1):.0f}s', flush=True)
    p.stdin.close()
    p.wait()
    print('DONE', a, b, 'rc', p.returncode, flush=True)

"""Master renderer for v3 (the Buddha version): frame n (0..1590) -> uint8 BGR 1080x1920.
usage: v3_main.py a b out.mkv      (renders [a, b) losslessly; FFV1)"""
import os, sys, time, subprocess
os.environ.setdefault('OMP_NUM_THREADS', '1')
import numpy as np, cv2
cv2.setNumThreads(1)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v3_open, v3_door, v3_story, v3_final

N = 1591


def render_frame(n):
    if n <= 281:
        img = v3_open.render_frame(n)
    elif n <= 348:
        img = v3_door.render(min(n, 341))
        k = v3_door.flash_k(n)
        img = img * (1 - k) + v3_door.FLASH_COL * k
    elif n <= 355:
        img = v3_story.render_frame(n)
        k = v3_door.flash_k(n)
        img = img * (1 - k) + v3_door.FLASH_COL * k
    elif n <= 1469:
        img = v3_story.render_frame(n)
    else:
        img = v3_final.render(n)
    return L.u8(img)


if __name__ == '__main__':
    if sys.argv[1] == 'test':
        od = L.S + '/v3/look'
        for n in [int(v) for v in sys.argv[2].split(',')]:
            cv2.imwrite(f'{od}/m_{n:04d}.jpg', render_frame(n), [cv2.IMWRITE_JPEG_QUALITY, 90])
            print('ok', n, flush=True)
        sys.exit(0)
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

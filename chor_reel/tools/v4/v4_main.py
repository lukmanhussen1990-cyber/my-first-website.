"""Master renderer for v4 (16:9 like the original, cosmic thief, Buddha): frame n (0..1590) -> uint8 BGR 1920x1080,
with the original film's letterbox (91/720 bars until 45.2 s, then opening on its measured curve).
usage: v4_main.py a b out.mkv      (renders [a, b) losslessly; FFV1)   |   v4_main.py test n1,n2,..."""
import os, sys, time, json, subprocess
os.environ.setdefault('OMP_NUM_THREADS', '1')
import numpy as np, cv2
cv2.setNumThreads(1)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v4_open, v4_door, v4_story, v4_final

N = 1591
W, H = 1920, 1080
_LB = None


def bar(n):
    """black bar height (px, top and bottom) of the original at frame n, scaled to 1080p"""
    global _LB
    if n < 1355:
        return 137
    if n >= 1380:
        return 0
    if _LB is None:
        _LB = json.load(open(L.S + '/v4/letterbox.json'))
    return int(round((_LB['top'][n] + _LB['bot'][n]) / 2 * 1.5))


def render_frame(n):
    if n <= 281:
        img = v4_open.render_frame(n)
    elif n <= 348:
        img = v4_door.render(min(n, 341))
        k = v4_door.flash_k(n)
        img = img * (1 - k) + v4_door.FLASH_COL * k
    elif n <= 355:
        img = v4_story.render_frame(n)
        k = v4_door.flash_k(n)
        img = img * (1 - k) + v4_door.FLASH_COL * k
    elif n <= 1469:
        img = v4_story.render_frame(n)
    else:
        img = v4_final.render(n)
    out = L.u8(img)
    b = bar(n)
    if b > 0:
        out[:b] = 0
        out[H - b:] = 0
    return out


if __name__ == '__main__':
    if sys.argv[1] == 'test':
        od = L.S + '/v4/look'
        os.makedirs(od, exist_ok=True)
        for n in [int(v) for v in sys.argv[2].split(',')]:
            cv2.imwrite(f'{od}/m_{n:04d}.jpg', render_frame(n), [cv2.IMWRITE_JPEG_QUALITY, 90])
            print('ok', n, flush=True)
        sys.exit(0)
    a, b, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '30',
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

"""Frame compositor + renderer.
usage:  python3 render.py stills OUTDIR t1 t2 ...      (PNG stills + contact sheet)
        python3 render.py chunk K NCHUNKS OUT.mp4       (render one chunk of frames to H.264)
"""
import sys, os, math, subprocess
import cairo
from gfx import *
import captions as CAP
import room, scenes
from T import TL, TOTAL, s0, s1

FPS = 30
N = int(round(TOTAL * FPS))
FADE = 0.4

SC = [
    # name, draw, labels, start, end, panel warmth
    ('hook', scenes.draw_hook, None, 0.0, room.T_PAINT_IN + FADE, 0.55),
    ('painting', room.draw_scene_painting, room.labels_scene_painting, room.T_PAINT_IN, room.ROOM_END, 0.12),
    ('doctor', scenes.draw_doctor, scenes.labels_doctor, room.ROOM_END - FADE, scenes.Q_IN + FADE, 0.55),
    ('quote', scenes.draw_quote, scenes.labels_quote, scenes.Q_IN, scenes.B_IN + FADE, 0.0),
    ('bible', scenes.draw_bible, None, scenes.B_IN, room.E_IN + FADE, 0.0),
    ('end', room.draw_scene_end, room.labels_scene_end, room.E_IN, TOTAL + 1.0, 0.15),
]
LOOP0 = TOTAL - 0.5

_caps = CAP.Captions(TL)
_panel_n = CAP.make_panel()
_panel_w = CAP.make_panel(hexrgb('#F2E6CC'), 0.55)


def scene_alpha(i, t):
    name, fn, lab, a, b, warm = SC[i]
    if t < a or t > b:
        return 0.0
    if i == 0:
        return 1.0
    return ease_sine(prog(t, a, a + FADE))


def panel_warmth(t):
    w = 0.0
    for i in range(len(SC)):
        a = scene_alpha(i, t)
        if a > 0:
            w = w * (1 - a) + SC[i][5] * a
    # bible reveal + ending warm-up
    w = max(w, 0.45 * ease_sine(prog(t, scenes.B_NAME, scenes.B_NAME + 0.8)) * (1 if t < room.E_IN + FADE else 0))
    w = max(w, 0.9 * ease_sine(prog(t, room.BLOOM0 + 0.2, room.BLOOM1)))
    return w


def draw_scene_layer(ctx, t):
    ctx.save()
    ctx.rectangle(0, 0, W, GROUND)
    ctx.clip()
    for i, (name, fn, lab, a, b, warm) in enumerate(SC):
        al = scene_alpha(i, t)
        if al <= 0:
            continue
        if al < 0.999:
            ctx.push_group()
        ctx.save()
        fn(ctx, t)
        ctx.restore()
        if lab:
            ctx.save()
            lab(ctx, t)
            ctx.restore()
        if al < 0.999:
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(al)
    ctx.restore()


def compose(t, surf=None, captions=True):
    surf = surf or cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    draw_scene_layer(ctx, t)
    # caption panel
    w = panel_warmth(t)
    ctx.set_source_surface(_panel_n, 0, GROUND)
    ctx.rectangle(0, GROUND, W, H - GROUND)
    ctx.fill()
    if w > 0.002:
        ctx.set_source_surface(_panel_w, 0, GROUND)
        ctx.rectangle(0, GROUND, W, H - GROUND)
        ctx.clip()
        ctx.paint_with_alpha(min(1.0, w))
        ctx.reset_clip()
    CAP.draw_ground(ctx)
    if captions:
        _caps.draw(ctx, t)
    CAP.draw_watermark(ctx)
    return surf


_first = None
def frame(t):
    global _first
    s = compose(t)
    if t >= LOOP0:
        # seamless loop: fade into the very first frame
        if _first is None:
            _first = compose(0.0)
        a = ease_sine(prog(t, LOOP0, TOTAL - 1.0 / FPS))
        ctx = cairo.Context(s)
        ctx.set_source_surface(_first, 0, 0)
        ctx.paint_with_alpha(a)
        # watermark stays rock solid during the blend
        CAP.draw_watermark(ctx) if a < 0 else None
    return s


def stills(outdir, times):
    os.makedirs(outdir, exist_ok=True)
    paths = []
    for t in times:
        s = frame(t)
        p = os.path.join(outdir, f't_{t:06.2f}.png')
        s.write_to_png(p)
        paths.append(p)
    return paths


def chunk(k, n, out):
    a = N * k // n
    b = N * (k + 1) // n
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-profile:v', 'high', '-g', '60', '-x264-params', 'keyint=60:min-keyint=30', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    for i in range(a, b):
        t = i / FPS
        s = frame(t)
        s.flush()
        p.stdin.write(bytes(s.get_data()))
        if (i - a) % 150 == 0:
            print(f'chunk {k}: frame {i}/{b}', flush=True)
    p.stdin.close()
    p.wait()
    print(f'chunk {k} done: frames {a}-{b - 1}', flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'stills':
        stills(sys.argv[2], [float(x) for x in sys.argv[3:]])
    elif mode == 'chunk':
        chunk(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])

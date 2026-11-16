"""Timeline + frame compositor + renderer.

usage:
  python render.py stills OUTDIR t1 t2 ...        # PNG stills at global times
  python render.py shots OUTDIR                   # one still per shot (middle) + contact sheet
  python render.py video OUT.mp4 [--workers 4] [--audio mix.wav] [--from a --to b]
"""
import json
import math
import os
import subprocess
import sys
import time

import numpy as np
import skia

import engine as E
from engine import W, H, FPS, C, clamp, seg, eio, eout, ein, lerp, xf, torn_rect, paper, grade_filter, GRADES
import captions as CP

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORDS = json.load(open(os.path.join(ROOT, 'assets', 'words.json')))
WS = [w['s'] for w in WORDS]
WE = [w['e'] for w in WORDS]
VOICE_DUR = 91.6375
END = round(VOICE_DUR + 1.0, 3)  # voice + 1 s hold (last word ends 91.26 -> ~1.4 s hold)
NFRAMES = int(round(END * FPS))


def cut_at(i):
    gap = WS[i] - WE[i - 1]
    return WS[i] - clamp(gap * 0.5, 0.06, 0.28)


class Ctx:
    def __init__(self, t, T, g, t0):
        self.t, self.T, self.g, self.t0 = t, T, g, t0

    def w(self, i):
        return WS[i] - self.t0


def build_shots():
    import scenes_a as A
    import scenes_b as B
    import scenes_c as Cc
    # (fn, start word index (None = 0), grade, transition-in, trans dur, caption dy, vignette)
    D = [
        (A.s01a_phone, None, 'modern', None, 0, 0, 0.9),
        (A.s01b_heart, 6, 'modern', 'zoom_in', 0.35, 0, 0.9),
        (A.s01c_silhouette, 13, 'neutral', 'fade', 0.45, 60, 1.1),
        (A.s02a_boston, 20, 'warm', 'page', 0.5, 0, 0.9),
        (A.s02b_class, 25, 'warm', 'slide_left', 0.4, 0, 0.9),
        (A.s03_mother, 32, 'warm', 'zoom_in', 0.4, 120, 1.0),
        (A.s04a_door, 40, 'warm', 'slide_up', 0.4, 0, 0.9),
        (A.s04b_mabel, 48, 'warm', 'zoom_in', 0.3, 110, 0.9),
        (A.s05a_flash_happy, 51, 'sepia', 'flash', 0.4, 60, 1.2),
        (A.s05b_flash_sick, 57, 'sepia', 'fade', 0.35, 60, 1.3),
        (A.s06a_lips, 67, 'warm', 'flash', 0.4, 0, 0.9),
        (A.s06b_eyes, 73, 'warm', 'cut', 0, 120, 1.0),
        (A.s06c_love, 78, 'warm', 'slide_left', 0.4, 0, 0.9),
        (A.s07a_father, 85, 'neutral', 'page', 0.45, 110, 1.0),
        (A.s07b_nervous, 93, 'neutral', 'cut', 0, 0, 1.0),
        (B.s08a_workshop, 97, 'candle', 'iris', 0.5, 0, 1.2),
        (B.s08b_tools, 102, 'candle', 'cut', 0, 0, 1.2),
        (B.s08c_fork, 106, 'candle', 'cut', 0, 0, 1.2),
        (B.s09a_idea, 112, 'candle', 'fade', 0.3, 0, 1.15),
        (B.s09b_map, 118, 'warm', 'zoom_in', 0.4, 0, 1.0),
        (B.s10a_1876, 124, 'candle', 'flyby', 0.5, 120, 1.1),
        (B.s10b_wire, 128, 'warm', 'flyby', 0.45, -440, 1.0),
        (B.s10c_watson, 135, 'warm', 'slide_up', 0.35, 110, 1.0),
        (B.s11_world, 140, 'warm', 'page', 0.45, 0, 0.9),
        (B.s12a_wedding, 146, 'warm', 'flyby', 0.5, 0, 0.9),
        (B.s12b_gift, 154, 'warm', 'slide_left', 0.4, 120, 0.9),
        (B.s12c_shares, 162, 'warm', 'cut', 0, 0, 0.9),
        (Cc.s13a_window, 170, 'neutral', 'fade', 0.6, 0, 1.1),
        (Cc.s13b_ring, 180, 'sad', 'fade', 0.4, 0, 1.15),
        (Cc.s14a_funeral, 189, 'grey', 'flyby', 0.5, 0, 1.25),
        (Cc.s14b_switch, 195, 'grey', 'cut', 0, 0, 1.2),
        (Cc.s14c_map, 199, 'grey', 'cut', 0, 0, 1.2),
        (Cc.s14d_clock, 203, 'grey', 'fade', 0.3, 0, 1.3),
        (Cc.s15_empty, 211, 'sad', 'crack', 0.9, 0, 1.3),
        (Cc.s16a_stage, 220, 'neutral', 'iris', 0.5, 0, 1.0),
        (Cc.s16b_reveal, 225, 'warm', 'curtain', 0.01, 250, 0.8),
        (Cc.s17a_city, 228, 'modern', 'page', 0.45, 0, 0.9),
        (Cc.s17b_love, 234, 'warm', 'fade', 0.45, 0, 1.0),
        (Cc.s17c_portrait, 240, 'candle', 'fade', 0.5, 240, 1.1),
    ]
    shots = []
    for k, (fn, wi, grade, tr, td, cdy, vig) in enumerate(D):
        t0 = 0.0 if wi is None else cut_at(wi)
        shots.append(dict(fn=fn, name=fn.__name__, t0=t0, grade=grade, tr=tr, td=td, cdy=cdy, vig=vig))
    for k, s in enumerate(shots):
        s['t1'] = shots[k + 1]['t0'] if k + 1 < len(shots) else END
        s['T'] = s['t1'] - s['t0']
    return shots


SHOTS = None
CAPS = None
_GF = {}


def gfilter(name):
    f = _GF.get(name)
    if f is None:
        f = grade_filter(**GRADES[name])
        _GF[name] = f
    return f


def init():
    global SHOTS, CAPS
    if SHOTS is None:
        SHOTS = build_shots()
        CAPS = CP.Captions(os.path.join(ROOT, 'assets', 'words.json'), END)
        for s in SHOTS:
            if s['cdy']:
                CAPS.overrides.append((s['t0'] - 0.3, s['t1'] - 0.3, s['cdy'], 0))


class Renderer:
    def __init__(self):
        init()
        self.sa = E.new_surface()
        self.sb = E.new_surface()
        self.out = E.new_surface()
        self.buf = np.empty((H, W, 4), np.uint8)
        self.info = skia.ImageInfo.Make(W, H, skia.kRGBA_8888_ColorType, skia.kPremul_AlphaType)

    def shot_image(self, surf, s, g):
        c = surf.getCanvas()
        c.clear(0xFF000000)
        t = g - s['t0']
        c.save()
        s['fn'](c, Ctx(t, s['T'], g, s['t0']))
        c.restore()
        return surf.makeImageSnapshot()

    def frame(self, g):
        shots = SHOTS
        k = 0
        while k + 1 < len(shots) and g >= shots[k + 1]['t0']:
            k += 1
        cur = shots[k]
        # transition window around the next cut or the current cut
        trans = None
        if k + 1 < len(shots):
            nx = shots[k + 1]
            if nx['tr'] not in (None, 'cut') and g >= nx['t0'] - nx['td'] / 2:
                trans = (cur, nx, (g - (nx['t0'] - nx['td'] / 2)) / nx['td'])
        if trans is None and cur['tr'] not in (None, 'cut') and k > 0 and g < cur['t0'] + cur['td'] / 2:
            trans = (shots[k - 1], cur, (g - (cur['t0'] - cur['td'] / 2)) / cur['td'])
        oc = self.out.getCanvas()
        oc.clear(0xFF000000)
        samp = skia.SamplingOptions(skia.FilterMode.kLinear)
        if trans is None:
            img = self.shot_image(self.sa, cur, g)
            oc.drawImage(img, 0, 0, samp, skia.Paint(ColorFilter=gfilter(cur['grade'])))
            vig = cur['vig']
        else:
            A, B, u = trans
            u = clamp(u)
            ia = self.shot_image(self.sa, A, g) if self._need_a(B['tr'], u) else None
            ib = self.shot_image(self.sb, B, g) if self._need_b(B['tr'], u) else None
            self.composite(oc, ia, ib, A, B, u, g, samp)
            vig = lerp(A['vig'], B['vig'], u)
        CAPS.draw(oc, g)
        E.post_overlays(oc, vignette=clamp(vig * 0.85), grain=1.0, stain=0.9)
        # end fade (very subtle) after the hold
        return self.out

    @staticmethod
    def _need_a(tr, u):
        if tr in ('flyby', 'flash', 'iris', 'page') and u >= 0.5:
            return False
        if tr == 'curtain':
            return False
        return True

    @staticmethod
    def _need_b(tr, u):
        if tr in ('flyby', 'flash', 'iris', 'page') and u < 0.5:
            return False
        return True

    def composite(self, oc, ia, ib, A, B, u, g, samp):
        tr = B['tr']
        pa = skia.Paint(ColorFilter=gfilter(A['grade']))
        pb = skia.Paint(ColorFilter=gfilter(B['grade']))
        if tr == 'fade':
            oc.drawImage(ia, 0, 0, samp, pa)
            pb2 = skia.Paint(ColorFilter=gfilter(B['grade']), Alphaf=eio(u))
            oc.drawImage(ib, 0, 0, samp, pb2)
        elif tr in ('slide_left', 'slide_up'):
            e = eio(u)
            if tr == 'slide_left':
                ax, ay, bx, by = -e * W * 0.35, 0, (1 - e) * W, 0
            else:
                ax, ay, bx, by = 0, -e * H * 0.3, 0, (1 - e) * H
            oc.drawImage(ia, ax, ay, samp, pa)
            # paper edge shadow
            oc.save()
            oc.translate(bx, by)
            sh = skia.Path()
            sh.addRect(skia.Rect.MakeXYWH(0, 0, W, H))
            oc.drawPath(sh, skia.Paint(AntiAlias=True, Color=C(0, 0.45), MaskFilter=E._blur(18)))
            oc.restore()
            oc.drawImage(ib, bx, by, samp, pb)
        elif tr == 'zoom_in':
            e = eio(u)
            oc.save()
            s = 1 + 0.5 * e
            oc.translate(W / 2, H / 2)
            oc.scale(s, s)
            oc.translate(-W / 2, -H / 2)
            oc.drawImage(ia, 0, 0, samp, pa)
            oc.restore()
            oc.save()
            s = 0.88 + 0.12 * e
            oc.translate(W / 2, H / 2)
            oc.scale(s, s)
            oc.translate(-W / 2, -H / 2)
            oc.drawImage(ib, 0, 0, samp, skia.Paint(ColorFilter=gfilter(B['grade']), Alphaf=eio(seg(u, 0.25, 0.85))))
            oc.restore()
        elif tr == 'flash':
            oc.drawImage(ia if u < 0.5 else ib, 0, 0, samp, pa if u < 0.5 else pb)
            a = 1 - abs(u - 0.5) * 2
            oc.drawRect(skia.Rect.MakeWH(W, H), skia.Paint(Color=C(0xFFF8EC, a ** 1.5)))
        elif tr == 'iris':
            img, p_ = (ia, pa) if u < 0.5 else (ib, pb)
            oc.drawImage(img, 0, 0, samp, p_)
            r = (1 - eio(u * 2)) if u < 0.5 else eio((u - 0.5) * 2)
            R = 1250 * r
            p = skia.Path()
            p.setFillType(skia.PathFillType.kEvenOdd)
            p.addRect(skia.Rect.MakeWH(W, H))
            p.addCircle(W / 2, H * 0.45, max(1, R))
            oc.drawPath(p, skia.Paint(AntiAlias=True, Color=0xFF07060A))
            if R > 2:
                oc.drawCircle(W / 2, H * 0.45, R, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                                                             StrokeWidth=10, Color=C(0xF6EEDC, 0.8)))
        elif tr == 'page':
            # a torn cream paper sheet sweeps across, swapping the shots underneath
            img, p_ = (ia, pa) if u < 0.5 else (ib, pb)
            oc.drawImage(img, 0, 0, samp, p_)
            x = lerp(W * 1.05, -W * 1.45, eio(u))
            with xf(oc, x, 0, -4):
                sheet = torn_rect(0, -120, W * 1.4, H + 240, seed=int(B['t0'] * 10) % 97, rough=9, step=14)
                paper(oc, sheet, 0xF2E6CC, ol=0, sh=(-18, 0, 22, 0.45), seed=5)
        elif tr == 'flyby':
            img, p_ = (ia, pa) if u < 0.5 else (ib, pb)
            oc.drawImage(img, 0, 0, samp, p_)
            self.flyby_props(oc, u, int(B['t0'] * 7))
        elif tr == 'crack':
            self.crack(oc, ia, ib, pa, pb, u, samp)
        elif tr == 'curtain':
            oc.drawImage(ib, 0, 0, samp, pb)
        else:
            oc.drawImage(ib, 0, 0, samp, pb)

    def flyby_props(self, oc, u, seed):
        import props as PR
        n = 9
        for i in range(n):
            st = i * 0.045
            v = clamp((u - st) / 0.62)
            if v <= 0 or v >= 1:
                continue
            y0 = E.hash01(seed, i, 1) * H
            x = lerp(W + 420, -520, ein(v) * 0.5 + v * 0.5)
            y = y0 - 300 * v + math.sin(v * 4 + i) * 40
            s = 2.2 + 1.6 * E.hash01(seed, i, 2)
            rot = (E.hash01(seed, i, 3) - 0.5) * 80 + v * 120
            kind = i % 3
            with xf(oc, x, y, rot, s):
                if kind == 0:
                    PR.paper_sheet(oc, 0, 0, 1.0, 0, seed=i)
                elif kind == 1:
                    paper(oc, E.rect(-120, -150, 240, 280), 0xF6EEDC, ol=2.5, sh=(8, 14, 12, 0.35), seed=i)
                    paper(oc, E.rect(-120, -150, 240, 50), E.PAL['red'], ol=2, seed=i + 1)
                    E.flat(oc, E.text_path(str(1870 + i), E.font('Anton-Regular.ttf', 90), 0, 60, align='center'),
                           0x2A2420)
                else:
                    PR.paper_sheet(oc, 0, 0, 1.0, 0, seed=i + 9, lines=4, col=0xEFE3C6)

    def crack(self, oc, ia, ib, pa, pb, u, samp):
        # jagged crack line top->bottom, then the two halves pull apart revealing B
        pts = []
        n = 26
        for i in range(n + 1):
            yy = -40 + i * (H + 80) / n
            xx = W * 0.5 + (E.hash01(77, i) - 0.5) * 160 + math.sin(i * 1.3) * 40
            pts.append((xx, yy))
        grow = eout(seg(u, 0.0, 0.32))
        split = eio(seg(u, 0.32, 1.0))
        oc.drawImage(ib, 0, 0, samp, skia.Paint(ColorFilter=pb.getColorFilter(), Alphaf=clamp(split * 1.4)))
        if split < 1:
            for sd in (-1, 1):
                half = E.poly(([(-W, -40)] if sd < 0 else [(2 * W, -40)]) + pts +
                              ([(-W, H + 40)] if sd < 0 else [(2 * W, H + 40)]))
                oc.save()
                dx = sd * split * W * 0.62
                rot = sd * split * 7
                oc.translate(W / 2 + dx, H / 2)
                oc.rotate(rot)
                oc.translate(-W / 2, -H / 2)
                oc.save()
                oc.translate(-sd * 10, 12)
                oc.drawPath(half, skia.Paint(AntiAlias=True, Color=C(0, 0.55), MaskFilter=E._blur(16)))
                oc.restore()
                oc.save()
                oc.clipPath(half, skia.ClipOp.kIntersect, True)
                oc.drawImage(ia, 0, 0, samp, pa)
                oc.restore()
                # torn white fibrous edge
                p = skia.Path()
                p.moveTo(*pts[0])
                for q in pts[1:]:
                    p.lineTo(*q)
                if split > 0:
                    oc.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=9,
                                              Color=C(0xF6EEDC, 0.95), PathEffect=skia.DiscretePathEffect.Make(6, 3, 3)))
                oc.restore()
        if split <= 0.001 and grow > 0:
            # crack growing on the intact image
            m = int(grow * n) + 1
            p = skia.Path()
            p.moveTo(*pts[0])
            for q in pts[1:m + 1]:
                p.lineTo(*q)
            oc.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=14,
                                      Color=C(0x0B0A10, 0.95), StrokeJoin=skia.Paint.kMiter_Join))
            oc.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=4,
                                      Color=C(0xF6EEDC, 0.8), PathEffect=skia.DiscretePathEffect.Make(5, 2.5, 4)))

    def read(self, surf):
        surf.getCanvas().readPixels(self.info, self.buf, W * 4, 0, 0)
        return self.buf


# ---------------------------------------------------------------- CLI
def stills(outdir, times):
    os.makedirs(outdir, exist_ok=True)
    R = Renderer()
    for g in times:
        t0 = time.time()
        s = R.frame(g)
        s.makeImageSnapshot().save(os.path.join(outdir, f"still_{g:07.3f}.png"), skia.kPNG)
        print(f"{g:7.3f}  {time.time() - t0:5.2f}s", flush=True)


def shot_stills(outdir, frac=0.6):
    init()
    times = [s['t0'] + s['T'] * frac for s in SHOTS]
    stills(outdir, times)
    for s in SHOTS:
        print(f"{s['name']:<20} {s['t0']:7.2f} -> {s['t1']:7.2f} ({s['T']:.2f}s) {s['tr']}")


def encode_range(out, f0, f1, crf=16):
    R = Renderer()
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p',
           '-g', '60', '-bf', '2', '-x264-params', 'keyint=60:min-keyint=1', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for f in range(f0, f1):
        g = f / FPS
        s = R.frame(g)
        p.stdin.write(R.read(s).tobytes())
        if (f - f0) % 60 == 0:
            el = time.time() - t0
            print(f"[{os.path.basename(out)}] frame {f} ({f - f0 + 1}/{f1 - f0}) {el:.0f}s", flush=True)
    p.stdin.close()
    p.wait()


def video(out, workers=4, audio=None, fa=None, fb=None):
    init()
    f0 = 0 if fa is None else int(round(fa * FPS))
    f1 = NFRAMES if fb is None else int(round(fb * FPS))
    tmpdir = os.path.join(os.path.dirname(os.path.abspath(out)), 'segs')
    os.makedirs(tmpdir, exist_ok=True)
    n = f1 - f0
    bounds = [f0 + n * k // workers for k in range(workers + 1)]
    procs = []
    segs = []
    for k in range(workers):
        sp = os.path.join(tmpdir, f'seg_{k:02d}.mp4')
        segs.append(sp)
        procs.append(subprocess.Popen([sys.executable, __file__, 'range', sp, str(bounds[k]), str(bounds[k + 1])]))
    for p in procs:
        p.wait()
        if p.returncode != 0:
            raise SystemExit('worker failed')
    lst = os.path.join(tmpdir, 'list.txt')
    with open(lst, 'w') as fh:
        for sp in segs:
            fh.write(f"file '{sp}'\n")
    vid = os.path.join(tmpdir, 'video_only.mp4')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', vid])
    if audio:
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-i', audio, '-map', '0:v', '-map', '1:a',
                               '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '44100',
                               '-t', f'{(f1 - f0) / FPS:.3f}', '-movflags', '+faststart', out])
    else:
        os.replace(vid, out)
    print('wrote', out)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'stills':
        stills(sys.argv[2], [float(v) for v in sys.argv[3:]])
    elif cmd == 'shots':
        shot_stills(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.6)
    elif cmd == 'range':
        encode_range(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    elif cmd == 'video':
        args = sys.argv[2:]
        out = args[0]
        kw = {}
        i = 1
        while i < len(args):
            if args[i] == '--workers':
                kw['workers'] = int(args[i + 1])
            elif args[i] == '--audio':
                kw['audio'] = args[i + 1]
            elif args[i] == '--from':
                kw['fa'] = float(args[i + 1])
            elif args[i] == '--to':
                kw['fb'] = float(args[i + 1])
            i += 2
        video(out, **kw)

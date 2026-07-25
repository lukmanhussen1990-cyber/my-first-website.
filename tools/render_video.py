"""Render the animated SCP-3143 picture to an MP4, beat-synced to the track."""
import os, sys, math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio_ffmpeg
import motion as M

FF   = imageio_ffmpeg.get_ffmpeg_exe()
MP3  = '../assets/brooklyn-blood-pop-syko.mp3'
LAY  = '../assets/layers'
FPS  = float(os.environ.get('FPS', 30))
DUR  = float(os.environ.get('DUR', 0))        # 0 = whole track
START= float(os.environ.get('START', 0))
OUT  = os.environ.get('OUT', 'murphy_law.mp4')
W, H = M.W, M.H

# ---------------------------------------------------------------- audio analysis
def analyse():
    p = subprocess.run([FF, '-v', 'error', '-i', MP3, '-f', 's16le', '-ac', '1', '-ar', '22050', '-'],
                       capture_output=True)
    x = np.frombuffer(p.stdout, np.int16).astype(np.float32) / 32768
    sr, hop, win = 22050, 22050 // 100, 1024      # 100 Hz analysis rate
    n = (len(x) - win) // hop
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / sr)
    bass_bins, mid_bins = (f > 30) & (f < 160), (f > 160) & (f < 6000)
    bass = np.empty(n, np.float32); loud = np.empty(n, np.float32)
    for i in range(n):
        S = np.abs(np.fft.rfft(x[i*hop:i*hop+win] * w))
        bass[i] = S[bass_bins].mean(); loud[i] = S[mid_bins].mean()
    # onsets: bass energy jumping above its own local average
    k = 60                                        # 0.6 s running mean
    pad = np.pad(bass, (k, 0), mode='edge')
    avg = np.convolve(pad, np.ones(k) / k, 'valid')[:n]
    onset = (bass > avg * 1.28) & (bass > bass.max() * 0.10)
    onset &= np.r_[True, ~onset[:-1]]             # rising edge only
    times = np.flatnonzero(onset) / 100.0
    # refractory period so a single kick fires once
    keep, last = [], -9
    for t in times:
        if t - last > 0.14:
            keep.append(t); last = t
    loud = loud / (np.percentile(loud, 98) + 1e-9)
    print(f'  {len(keep)} beats over {n/100:.1f}s')
    return np.array(keep), np.clip(loud, 0, 1), len(x) / sr

BEATS, LOUD, TRACK_LEN = analyse()

def pulse_at(t):
    i = np.searchsorted(BEATS, t) - 1
    if i < 0:
        return 0.0
    dt = t - BEATS[i]
    return float(math.exp(-dt / 0.11)) if dt < 1.0 else 0.0

def level_at(t):
    i = int(t * 100)
    return float(LOUD[i]) if 0 <= i < len(LOUD) else 0.0

# ---------------------------------------------------------------- layers
def load(n):
    return Image.open(f'{LAY}/{n}.png').convert('RGBA')
plate  = load('plate').convert('RGB')
smoke  = load('smoke')
head   = load('head')
coat   = load('coat')
hand   = load('hand')
sleeve = load('sleeve')

def xform(img, pivot, rot, dx, dy):
    """rotate about pivot, then translate — matching the CSS transform order"""
    return img.rotate(-rot, resample=Image.BICUBIC, center=pivot,
                      translate=(dx, dy))

# eyelid, drawn in the head's own coordinate space so it moves with the face
EYE = (263, 319, 322, 350)                       # box around the eye
SKIN, INK = (233, 231, 219), (30, 30, 28)
def eyelid(a):
    if a <= 0.02:
        return None
    x0, y0, x1, y1 = EYE
    w, h = x1 - x0, y1 - y0
    lid = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lid)
    hh, tilt = h * a, 9 * a                      # the eye rides up towards the temple
    d.polygon([(0, 0), (w, 0), (w, hh - tilt), (0, hh)], fill=SKIN + (255,))
    d.line([(0, hh), (w, hh - tilt)], fill=INK + (255,), width=max(2, int(3 * a)))
    return lid

# soft smoke sprite
_S = 96
_yy, _xx = np.mgrid[0:_S, 0:_S]
_r = np.hypot(_xx - _S/2, _yy - _S/2) / (_S/2)
_puff = np.clip(1 - _r, 0, 1) ** 1.7
PUFF = Image.fromarray(np.dstack([
    np.full((_S, _S), 226, np.uint8), np.full((_S, _S), 226, np.uint8),
    np.full((_S, _S), 222, np.uint8), (_puff * 255).astype(np.uint8)]), 'RGBA')

class Puffs:
    def __init__(self):
        self.p = []
    def emit(self, x, y, n, spd=1.0, size=1.0):
        for _ in range(n):
            self.p.append([x + np.random.uniform(-4, 4), y + np.random.uniform(-4, 4),
                           np.random.uniform(-6, 4), -np.random.uniform(14, 30) * spd,
                           0.0, np.random.uniform(2.2, 3.6), np.random.uniform(10, 20) * size,
                           np.random.uniform(0.16, 0.34)])
    def step(self, dt, wind):
        for q in self.p:
            q[4] += dt
            q[0] += (q[2] + wind + math.sin(q[4] * 1.7 + q[6]) * 7) * dt
            q[1] += q[3] * dt
            q[3] *= (1 - 0.35 * dt)
        self.p = [q for q in self.p if q[4] < q[5]]
    def draw(self, canvas):
        for x, y, vx, vy, age, life, sz, op in self.p:
            k = age / life
            s = int(sz * (1 + 2.6 * k))
            if s < 3:
                continue
            a = op * math.sin(min(1, k * 3.2) * math.pi / 2) * (1 - k) ** 1.4
            spr = PUFF.resize((s, s), Image.BILINEAR)
            al = spr.getchannel('A').point(lambda v: int(v * a))
            spr.putalpha(al)
            canvas.alpha_composite(spr, (int(x - s / 2), int(y - s / 2)))

# static vignette + a whisper of the grey band's tone
vig = Image.new('L', (W, H), 0)
ImageDraw.Draw(vig).ellipse([-W * 0.42, -H * 0.22, W * 1.42, H * 1.22], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(90)).point(lambda v: 255 - v)
VIGN = Image.merge('RGBA', (Image.new('L', (W, H), 8),) * 3 +
                   (vig.point(lambda v: int(v * 0.26)),))

# ---------------------------------------------------------------- render
dur = DUR or (TRACK_LEN - START)
nframes = int(dur * FPS)
proc = subprocess.Popen(
    [FF, '-y', '-v', 'error',
     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
     '-ss', str(START), '-t', f'{dur:.3f}', '-i', MP3,
     '-vf', 'scale=684:1258:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium',
     '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
     '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT], stdin=subprocess.PIPE)

puffs = Puffs()
prev_drag = 0.0
for i in range(nframes):
    t = START + i / FPS
    pl, lv = pulse_at(t), level_at(t)
    ps = M.pose(t, pl, lv)
    hd, hn, st = ps['head'], ps['hand'], ps['stage']

    frame = plate.copy().convert('RGBA')
    frame.alpha_composite(xform(smoke, (180, 300), 0, ps['smoke_sway'], -ps['smoke_sway'] * 0.6))

    lid = eyelid(ps['blink'])
    hl = head
    if lid is not None:
        hl = head.copy(); hl.alpha_composite(lid, (EYE[0], EYE[1]))
    frame.alpha_composite(xform(hl, M.HEAD_PIVOT, hd['rot'], hd['dx'], hd['dy']))
    frame.alpha_composite(coat)
    frame.alpha_composite(xform(hand, M.HAND_PIVOT, hn['rot'], hn['dx'], hn['dy']))
    frame.alpha_composite(sleeve)

    tip = M.transform_point(*M.CIG_TIP, M.HAND_PIVOT, hn['rot'], hn['dx'], hn['dy'])
    puffs.emit(tip[0], tip[1], 1 if (i % 3 == 0) else 0)
    if prev_drag > 0.5 and ps['drag'] <= 0.5:            # the exhale after a drag
        puffs.emit(tip[0], tip[1] - 6, 16, spd=1.5, size=1.6)
    prev_drag = ps['drag']
    puffs.step(1 / FPS, 4 + 3 * math.sin(t * 0.5))
    puffs.draw(frame)

    frame.alpha_composite(VIGN)
    out = frame.convert('RGB')

    z = st['zoom']
    if z != 1.0 or abs(st['rot']) > 0.01:
        out = out.rotate(-st['rot'], resample=Image.BICUBIC, center=(W / 2, H * 0.45))
        cw, ch = W / z, H / z
        out = out.resize((W, H), Image.BICUBIC,
                         box=((W - cw) / 2, (H - ch) * 0.42, (W + cw) / 2, (H - ch) * 0.42 + ch))
    proc.stdin.write(out.tobytes())
    if i % 150 == 0:
        print(f'  frame {i}/{nframes}  ({100*i/nframes:.0f}%)', flush=True)

proc.stdin.close()
proc.wait()
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

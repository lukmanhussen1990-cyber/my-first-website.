"""Shared toolkit for the code-made animations: easing, paper, ink, shadows, camera, motion blur, runner."""
import math, os, sys, subprocess
import numpy as np, cv2, cairo
cv2.setNumThreads(1)

W, H = 1920, 1080
FPS = 24000 / 1001
SCR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def hexrgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)

PAPER = hexrgb("E9DCC4"); PAPER_EDGE = hexrgb("D8C6A6"); CARD = hexrgb("F4ECDD")
INK = hexrgb("2A2622"); GREEN = hexrgb("3DDC52"); GREEN_DK = hexrgb("23A83A"); WHITE = hexrgb("F7F2E8")

# ---------------------------------------------------------------- easing
def clamp01(x): return 0.0 if x < 0 else 1.0 if x > 1 else x
def lerp(a, b, t): return a + (b - a) * t
def smooth(t): t = clamp01(t); return t * t * (3 - 2 * t)
def smoother(t): t = clamp01(t); return t * t * t * (t * (6 * t - 15) + 10)
def io_cubic(t): t = clamp01(t); return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def io_sine(t): t = clamp01(t); return -(math.cos(math.pi * t) - 1) / 2
def io_quint(t): t = clamp01(t); return 16 * t ** 5 if t < .5 else 1 - (-2 * t + 2) ** 5 / 2
def out_cubic(t): t = clamp01(t); return 1 - (1 - t) ** 3
def out_quint(t): t = clamp01(t); return 1 - (1 - t) ** 5
def out_expo(t): t = clamp01(t); return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)
def in_cubic(t): t = clamp01(t); return t ** 3
def in_quad(t): t = clamp01(t); return t * t
def out_back(t, s=1.70158): t = clamp01(t); t -= 1; return 1 + (s + 1) * t ** 3 + s * t ** 2
def seg(t, t0, t1, ease=io_cubic): return ease((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t1)
def spring(t, f=2.2, z=0.32):
    """critically-underdamped settle 0->1 (small, soft overshoot)"""
    if t <= 0: return 0.0
    w = 2 * math.pi * f; wd = w * math.sqrt(1 - z * z)
    return 1 - math.exp(-z * w * t) * (math.cos(wd * t) + z * w / wd * math.sin(wd * t))

def drift(t, amp=1.0, seed=0):
    """smooth pseudo-random 2D drift (sum of incommensurate sines)"""
    r = np.random.RandomState(seed); ph = r.rand(6) * 6.283
    x = math.sin(.31 * t + ph[0]) * .6 + math.sin(.53 * t + ph[1]) * .3 + math.sin(.97 * t + ph[2]) * .1
    y = math.sin(.27 * t + ph[3]) * .6 + math.sin(.61 * t + ph[4]) * .3 + math.sin(1.13 * t + ph[5]) * .1
    return x * amp, y * amp

# ---------------------------------------------------------------- noise / textures
def value_noise(h, w, cell, seed):
    r = np.random.RandomState(seed)
    g = r.rand(int(h / cell) + 3, int(w / cell) + 3).astype(np.float32)
    big = cv2.resize(g, (int(w / cell + 3) * cell, int(h / cell + 3) * cell), interpolation=cv2.INTER_CUBIC)
    return big[cell:cell + h, cell:cell + w]

def fbm(h, w, cells=(512, 256, 128, 64, 32), seed=1):
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for i, c in enumerate(cells):
        acc += value_noise(h, w, c, seed + i) * amp; tot += amp; amp *= 0.55
    acc /= tot
    return (acc - acc.mean()) / (acc.std() + 1e-6)

class Paper:
    """Cream paper texture (RGB float) + grain channel, generated once, viewed through a gentle camera."""
    PAD = 220
    def __init__(self, seed=7, base=PAPER, cache=True):
        path = os.path.join(SCR, "work", f"paper_{seed}.npy")
        h, w = H + 2 * self.PAD, W + 2 * self.PAD
        if cache and os.path.exists(path):
            self.tex = np.load(path); return
        r = np.random.RandomState(seed)
        mott = fbm(h, w, (640, 320, 160, 80), seed) * 0.018           # low-frequency mottling
        tooth = cv2.GaussianBlur(r.randn(h, w).astype(np.float32), (0, 0), 0.7) * 0.022
        fib = np.zeros((h, w), np.float32)                             # paper fibres
        for _ in range(2600):
            x, y = r.rand() * w, r.rand() * h; a = r.rand() * math.pi; L = 6 + r.rand() * 26
            pts = []
            for k in range(6):
                s = k / 5 - .5; a2 = a + (r.rand() - .5) * .2
                pts.append((x + math.cos(a2) * L * s + r.randn() * .6, y + math.sin(a2) * L * s + r.randn() * .6))
            cv2.polylines(fib, [np.int32(np.array(pts) * 4)], False, float(r.choice([-1, 1]) * (.5 + r.rand())), 1, cv2.LINE_AA, 2)
        fib = cv2.GaussianBlur(fib, (0, 0), 0.6) * 0.035
        speck = np.zeros((h, w), np.float32)
        for _ in range(900):
            cv2.circle(speck, (int(r.rand() * w * 4), int(r.rand() * h * 4)), int(2 + r.rand() * 5), -(.3 + r.rand() * .7) if r.rand() < .7 else .5, -1, cv2.LINE_AA, 2)
        speck = cv2.GaussianBlur(speck, (0, 0), .5) * 0.10
        lum = 1 + mott + tooth + fib + speck
        tint = fbm(h, w, (900, 450), seed + 50) * 0.008                  # slight warm/cool variation
        rgb = np.stack([base[0] * (lum + tint), base[1] * lum, base[2] * (lum - tint)], -1)
        grain = np.clip(0.5 + (tooth + fib) * 8, 0, 1)                 # 0..1 'tooth' used to texture ink
        self.tex = np.concatenate([rgb, grain[..., None]], -1).astype(np.float32)
        if cache: np.save(path, self.tex)

    def view(self, scale=1.0, dx=0.0, dy=0.0, rot=0.0):
        c = (W / 2 + self.PAD, H / 2 + self.PAD)
        M = cv2.getRotationMatrix2D(c, rot, scale)
        M[0, 2] += dx - self.PAD; M[1, 2] += dy - self.PAD
        out = cv2.warpAffine(self.tex, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return out[..., :3].copy(), out[..., 3].copy()

_VIG = None
def vignette(strength=0.13):
    global _VIG
    if _VIG is None:
        y, x = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((x - W / 2) / (W * .62)) ** 2 + ((y - H / 2) / (H * .72)) ** 2)
        _VIG = np.clip(d, 0, 1.6) ** 2.2
    return (1 - strength * _VIG)[..., None]

def film_grain(img, frame_seed, amt=2.2):
    r = np.random.RandomState(frame_seed)
    g = cv2.GaussianBlur(r.randn(H // 2, W // 2).astype(np.float32), (0, 0), .6)
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
    return img + g[..., None] * amt

# ---------------------------------------------------------------- cairo layers
class Layer:
    """A8 (alpha only) cairo canvas in screen space; colour is applied at composite time."""
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.surf = cairo.ImageSurface(cairo.FORMAT_A8, w, h)
        self.ctx = cairo.Context(self.surf)
        self.ctx.set_antialias(cairo.ANTIALIAS_BEST)
    def alpha(self):
        self.surf.flush()
        st = self.surf.get_stride()
        a = np.ndarray((self.h, st), np.uint8, self.surf.get_data())[:, :self.w]
        return a.astype(np.float32) / 255.0

def set_cam(ctx, cam):
    """cam = (scale, cx, cy, rot_deg): world point (cx,cy) lands at screen centre."""
    s, cx, cy, rot = cam
    ctx.identity_matrix(); ctx.translate(W / 2, H / 2); ctx.rotate(math.radians(rot)); ctx.scale(s, s); ctx.translate(-cx, -cy)

def cam_point(cam, x, y):
    s, cx, cy, rot = cam; a = math.radians(rot)
    X, Y = (x - cx) * s, (y - cy) * s
    return W / 2 + X * math.cos(a) - Y * math.sin(a), H / 2 + X * math.sin(a) + Y * math.cos(a)

# ---------------------------------------------------------------- compositing
def ink_alpha(a, grain, dry=0.22, bleed=0.35, sigma=1.3):
    """turn a crisp vector alpha into ink on paper: feathered bleed halo + dry-brush tooth + edge pooling"""
    if a.max() <= 0: return a
    bl = cv2.GaussianBlur(a, (0, 0), sigma)
    out = np.maximum(a, bl * bleed * (0.6 + 0.8 * grain))
    out = out * (1 - dry * np.clip(grain - 0.45, 0, 1) * 2.0)
    return np.clip(out, 0, 1)

def over(img, a, color, mul=None):
    """alpha-over a flat colour; mul optionally modulates colour per pixel (H,W)"""
    a3 = a[..., None]
    col = color[None, None, :] if mul is None else color[None, None, :] * mul[..., None]
    return img * (1 - a3) + col * a3

def multiply(img, a, color, strength=1.0):
    """multiply-blend (for shadows / ink washes)"""
    f = 1 - (1 - color[None, None, :] / 255.0) * (a[..., None] * strength)
    return img * f

def shadow(a, sigma, dx=0, dy=0, strength=0.35):
    s = cv2.GaussianBlur(a, (0, 0), sigma) if sigma > 0 else a
    if dx or dy:
        M = np.float32([[1, 0, dx], [0, 1, dy]]); s = cv2.warpAffine(s, M, (a.shape[1], a.shape[0]))
    return np.clip(s * strength, 0, 1)

def to8(img): return np.clip(img + 0.5, 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- runner
def render_scene(scene, nframes, outdir, frames=None, sub=5, shutter=0.5, workers=4, scale=1.0):
    """scene(t, fi) -> float RGB HxWx3 for local time t (s). Motion blur = average of `sub` samples
    spread over `shutter` of a frame, centred on the frame time. Writes PNG frames outdir/%04d.png."""
    os.makedirs(outdir, exist_ok=True)
    idx = list(range(nframes)) if frames is None else frames
    def job(i):
        acc = None
        for k in range(sub):
            off = 0 if sub == 1 else (k / (sub - 1) - 0.5) * shutter
            img = scene((i + off) / FPS, i)
            acc = img if acc is None else acc + img
        img = to8(acc / sub)
        if scale != 1.0: img = cv2.resize(img, (int(W * scale), int(H * scale)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(outdir, f"{i:04d}.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_PNG_COMPRESSION, 1])
    if workers <= 1:
        for i in idx: job(i)
        return
    import multiprocessing as mp
    chunks = [idx[w::workers] for w in range(workers)]
    procs = []
    for ch in chunks:
        pid = os.fork()
        if pid == 0:
            try:
                for i in ch: job(i)
            finally:
                os._exit(0)
        procs.append(pid)
    for p in procs: os.waitpid(p, 0)

def main(scene, nframes, name):
    """CLI: python X.py preview|stills|full [frames...]"""
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    base = os.path.join(SCR, "renders", name)
    if mode == "preview":     # low-res, light motion blur, every frame
        render_scene(scene, nframes, base + "_preview", sub=2, scale=0.5)
    elif mode == "stills":
        fr = [int(x) for x in sys.argv[2:]]
        render_scene(scene, nframes, base + "_stills", frames=fr, sub=5)
    elif mode == "full":
        render_scene(scene, nframes, base + "_full", sub=int(os.environ.get("SUB", 6)))

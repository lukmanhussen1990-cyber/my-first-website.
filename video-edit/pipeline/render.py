"""Replace the baked-in text in the source video.

For every frame we know the camera transform (scale + translation) into
reference-frame-0144 scene space. Each replacement is then:

  1. estimate how bright and how blurred the original text is in this frame
     (the greeting fades in word by word and the whole shot smears during the
     whip transition, so both vary a lot),
  2. inpaint the original glyphs away using the smooth background around them,
  3. rasterise the new string at the frame's scale and composite it with the
     measured brightness and blur.
"""
import cv2, numpy as np, json, glob, os
from PIL import Image, ImageDraw, ImageFont

SERIF = '/usr/local/lib/python3.11/dist-packages/font_source_serif_pro/files/SourceSerifPro-Regular.ttf'
SANS  = '/usr/local/lib/python3.11/dist-packages/font_source_sans_pro/files/SourceSansPro-Regular.ttf'

files = sorted(glob.glob('all/*.png'))
REF = 144
refimg = cv2.imread(files[REF - 1])
refgray = cv2.cvtColor(refimg, cv2.COLOR_BGR2GRAY)

# ---- scene-space geometry, measured on frame 0144 -----------------------
# 'parts' are laid out left-to-right separated by 'gap' scene-px, then the whole
# block is anchored by 'align' onto the old string's ink box.
# size / condense / sigma_k / peak were fitted by rendering the *original*
# strings and least-squares matching them against the real pixels (calib2, calib3).
# Softness tracks the camera zoom, hence sigma = sigma_k * s.
JOBS = [
    dict(key='greet', font=SERIF, size=66.2, condense=0.95,
         parts=['Imran'], gap=0,
         ink=(363, 185, 488, 234),          # ink box of "Elon"
         erase=(355, 176, 500, 244),
         align='left', color=(255, 252, 246), sigma_k=0.9, peak=320.0),
    # "Sonnet 4.6 Adapative" -> "Fable 5.1 Adaptive", right-anchored so the
    # chevron that follows it keeps its original position.
    dict(key='chip', font=SANS, size=35.3, condense=1.01,
         parts=['Fable 5.1', 'Adaptive'], gap=17,
         ink=(246, 436, 565, 467),          # ink box of the whole chip label
         erase=(240, 429, 572, 472),
         align='right', color=(174, 171, 175), sigma_k=0.7, peak=150.0),
]

def render_block(parts, fontpath, px, base_px, condense, gap_scene, sup=4):
    """Rasterise one or more runs on a shared baseline, separated by gap_scene.

    px is the font size for this frame, base_px the same font's size in scene
    space; their ratio is the camera scale, which the gap has to follow too.
    Returns float alpha in [0,1] cropped to its ink box, plus (w, h). Drawing
    every run from the same origin y is what keeps their baselines aligned.
    """
    size = max(4, int(round(px * sup)))
    f = ImageFont.truetype(fontpath, size)
    boxes = [f.getbbox(p) for p in parts]
    gap = gap_scene * (px / base_px) * sup
    total = sum(b[2] - b[0] for b in boxes) + gap * (len(parts) - 1)
    pad = size
    W = int(total + 2 * pad)
    H = int(size * 3)
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    x = pad
    for p, b in zip(parts, boxes):
        d.text((x - b[0], pad), p, font=f, fill=255)
        x += (b[2] - b[0]) + gap
    a = np.array(img).astype(np.float32) / 255.
    ys, xs = np.nonzero(a > 0.12)
    if len(xs) == 0:
        return None, None
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape
    tw = max(1, int(round(w * condense / sup)))
    th = max(1, int(round(h / sup)))
    return cv2.resize(a, (tw, th), interpolation=cv2.INTER_AREA), (tw, th)

def measure_original(frame_gray, box, s, tx, ty):
    """Peak brightness above background, and edge sharpness, of the old text."""
    x0, y0, x1, y1 = box
    fx0, fy0 = int(round(x0 * s + tx)), int(round(y0 * s + ty))
    fx1, fy1 = int(round(x1 * s + tx)), int(round(y1 * s + ty))
    H, W = frame_gray.shape
    cx0, cy0 = max(0, fx0), max(0, fy0)
    cx1, cy1 = min(W, fx1), min(H, fy1)
    if cx1 - cx0 < 6 or cy1 - cy0 < 6:
        return 0.0, 0.0
    g = frame_gray[cy0:cy1, cx0:cx1].astype(np.float32)
    peak = float(np.percentile(g, 99.5) - np.percentile(g, 12))
    return peak, _grads(g)

def _grads(a):
    """p99.5 of the horizontal and vertical edge response, separately.

    Kept separate because the whip transition smears the frame horizontally --
    an isotropic blur estimate cannot represent that.
    """
    gx = cv2.Sobel(a, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(a, cv2.CV_32F, 0, 1, ksize=3)
    return (float(np.percentile(np.abs(gx), 99.5)),
            float(np.percentile(np.abs(gy), 99.5)))

_SIG_MULT = (0.35, 0.5, 0.7, 1.0, 1.5, 2.2, 3.2, 4.6, 6.5, 9.0)
_MOTION = (1, 3, 5, 9, 15, 23, 33, 45, 61, 81)

def blur_layer(alpha, sx, sy, motion):
    """Baseline softness plus, when the shot is whip-panning, a horizontal
    box kernel -- a pan smears by averaging over the exposure, which is a box,
    not a Gaussian, and a Gaussian of matching width still reads too legible."""
    a = cv2.GaussianBlur(alpha, (0, 0), sigmaX=sx, sigmaY=sy)
    if motion > 1:
        k = np.ones((1, int(motion)), np.float32) / float(motion)
        a = cv2.filter2D(a, -1, k, borderType=cv2.BORDER_CONSTANT)
    return a

def fit_layer(alpha, peak_target, grad_target, sigma_hint):
    """Pick blur and gain so new glyphs match the old text's look.

    Rather than assuming how blurred a frame is, we match statistics measurable
    on the original: peak brightness, plus horizontal and vertical edge energy.
    That tracks the word-by-word fade-in and the whip smear without
    special-casing either.
    """
    gx_t, gy_t = grad_target
    cand = sorted({round(max(0.15, sigma_hint * m), 2) for m in _SIG_MULT})
    base = max(0.15, sigma_hint)

    def score(sx, sy, mo):
        a = blur_layer(alpha, sx, sy, mo)
        amax = float(a.max())
        if amax < 1e-3:
            return None
        gain = peak_target / amax
        gx, gy = _grads(a)
        err = (abs(gx * gain - gx_t) / max(gx_t, 1.0)
               + abs(gy * gain - gy_t) / max(gy_t, 1.0))
        return err, gain

    sx, sy, mo = base, base, 1
    best = (float('inf'), sx, sy, mo, 1.0)
    for _ in range(2):
        for m in _MOTION:                    # horizontal smear length
            r = score(sx, sy, m)
            if r and r[0] < best[0]:
                best = (r[0], sx, sy, m, r[1])
        mo = best[3]
        for v in cand:                       # residual horizontal softness
            r = score(v, sy, mo)
            if r and r[0] < best[0]:
                best = (r[0], v, sy, mo, r[1])
        sx = best[1]
        for v in cand:                       # vertical softness
            r = score(sx, v, mo)
            if r and r[0] < best[0]:
                best = (r[0], sx, v, mo, r[1])
        sy = best[2]
    return (best[1], best[2], best[3]), best[4]

def inpaint_region(frame, box, s, tx, ty, mx=0, my=0):
    """Erase the old glyphs. mx/my widen the box when the frame is smeared,
    so the tails of a motion-blurred word are not left behind."""
    x0, y0, x1, y1 = box
    fx0, fy0 = int(x0 * s + tx) - 3 - mx, int(y0 * s + ty) - 3 - my
    fx1, fy1 = int(np.ceil(x1 * s + tx)) + 3 + mx, int(np.ceil(y1 * s + ty)) + 3 + my
    H, W = frame.shape[:2]
    cx0, cy0, cx1, cy1 = max(0, fx0), max(0, fy0), min(W, fx1), min(H, fy1)
    if cx1 - cx0 < 3 or cy1 - cy0 < 3:
        return frame, None
    sub = frame[cy0:cy1, cx0:cx1]
    g = cv2.cvtColor(sub, cv2.COLOR_BGR2GRAY)
    lo = np.percentile(g, 20)
    m = (g > lo + max(6, 0.18 * (g.max() - lo))).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    fixed = cv2.inpaint(sub, m, 9, cv2.INPAINT_TELEA)
    fixed = cv2.GaussianBlur(fixed, (0, 0), 2.0)
    frame[cy0:cy1, cx0:cx1] = fixed
    return frame, (cx0, cy0, cx1, cy1)

def composite(frame, alpha, ox, oy, color, peak, sigma):
    """Add the glyphs as light over the (already inpainted) background.

    Bright text on a dark plate behaves additively, and compositing this way
    avoids having to know the exact background colour behind each glyph.
    """
    h, w = alpha.shape
    H, W = frame.shape[:2]
    if sigma > 0.05:
        pad = int(np.ceil(sigma * 3))
        alpha = cv2.GaussianBlur(cv2.copyMakeBorder(
            alpha, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0), (0, 0), sigma)
        ox, oy = ox - pad, oy - pad
        h, w = alpha.shape
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(W, ox + w), min(H, oy + h)
    if x1 <= x0 or y1 <= y0:
        return frame
    a = alpha[y0 - oy:y1 - oy, x0 - ox:x1 - ox][..., None]
    col = np.array(color, dtype=np.float32)[::-1]      # RGB -> BGR
    tint = col / col.max()
    reg = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = np.clip(reg + a * peak * tint, 0, 255).astype(np.uint8)
    return frame

# minimum peak (grey levels above background) worth replacing at all
MIN_PEAK = 10.0
_raster_cache = {}

def apply_frame(frame, s, tx, ty):
    """Run every replacement on one frame. Shared by preview and final render."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    H, W = frame.shape[:2]
    for job in JOBS:
        ix0, iy0, ix1, iy1 = job['ink']
        if ix1 * s + tx < -20 or ix0 * s + tx > W + 20:
            continue                                   # entirely off screen
        if iy1 * s + ty < -20 or iy0 * s + ty > H + 20:
            continue
        peak_o, grad_o = measure_original(gray, job['ink'], s, tx, ty)
        if peak_o < MIN_PEAK:
            continue                                   # nothing visible to replace
        key = (job['key'], round(job['size'] * s, 1))
        if key not in _raster_cache:
            _raster_cache[key] = render_block(
                job['parts'], job['font'], job['size'] * s, job['size'],
                job['condense'], job['gap'])
        alpha, wh = _raster_cache[key]
        if alpha is None:
            continue
        (sx, sy, mo), gain = fit_layer(alpha, peak_o, grad_o, job['sigma_k'] * s)
        px = int(np.ceil(sx * 3)) + mo // 2 + 1
        py = int(np.ceil(sy * 3)) + 1
        a = blur_layer(cv2.copyMakeBorder(
            alpha, py, py, px, px, cv2.BORDER_CONSTANT, value=0), sx, sy, mo)
        w, h = wh
        ox = (int(round(ix0 * s + tx)) if job['align'] == 'left'
              else int(round(ix1 * s + tx)) - w)
        oy = int(round(iy1 * s + ty)) - h
        base = job['sigma_k'] * s
        mx = int(min(60, max(0, 2.2 * (sx - base) + 0.6 * mo)))
        my = int(min(20, max(0, 2.2 * (sy - base))))
        frame, _ = inpaint_region(frame, job['erase'], s, tx, ty, mx, my)
        frame = composite(frame, a, ox - px, oy - py, job['color'], gain, 0.0)
    return frame

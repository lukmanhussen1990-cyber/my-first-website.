"""Image post-processing: depth of field, zoom blur, bloom, grade, vignette, film grain."""
import cv2
import numpy as np

cv2.setNumThreads(4)


def gblur(img, sigma):
    if sigma <= 0.05:
        return img
    # big blurs are done at reduced size (much faster, looks the same)
    if sigma > 6.0:
        f = 4 if sigma > 14 else 2
        h, w = img.shape[:2]
        small = cv2.resize(img, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma / f)
        return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    return cv2.GaussianBlur(img, (0, 0), sigma)


def depth_of_field(img, depth, focus, strength, max_px, bg):
    """Blur each pixel by how far it is from the focus distance.

    The subject is blurred as a separate layer (colour x coverage) and laid back over the clean
    background, so out-of-focus edges go soft while in-focus edges stay clean, with no halos.
    """
    hit = depth < 1e5
    d = np.maximum(depth, 1e-3)
    coc = np.where(hit, np.minimum(strength * np.abs(1.0 - focus / d), max_px), 0.0).astype(np.float32)
    # let the blur of soft objects spill past their own outline
    h, w = coc.shape
    f = 4
    small = cv2.resize(coc, (w // f, h // f), interpolation=cv2.INTER_AREA)
    k = int(max(1, round(max_px * 1.6 / f))) * 2 + 1
    small = cv2.dilate(small, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    spread = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    coc = np.where(hit, coc, spread)
    coc = cv2.GaussianBlur(coc, (0, 0), 1.5 + max_px * 0.06)

    alpha = hit.astype(np.float32)
    pre = np.dstack([img * alpha[..., None], alpha])
    levels = [0.0, max_px * 0.1, max_px * 0.25, max_px * 0.5, max_px]
    out = pre.copy()
    prev = pre
    for i in range(1, len(levels)):
        cur = gblur(pre, levels[i])
        wgt = np.clip((coc - levels[i - 1]) / (levels[i] - levels[i - 1]), 0.0, 1.0)[..., None]
        out = np.where(coc[..., None] > levels[i - 1], prev + (cur - prev) * wgt, out)
        prev = cur
    a = np.clip(out[..., 3:4], 0.0, 1.0)
    return out[..., :3] + bg * (1.0 - a)


def zoom_blur(img, amount, cx, cy, n=10):
    """Radial (zoom) motion blur. amount = fraction of extra scale covered by the streak."""
    if amount < 0.003:
        return img
    h, w = img.shape[:2]
    acc = np.zeros_like(img)
    for i in range(n):
        s = 1.0 + amount * (i / (n - 1) - 0.5)
        M = np.array([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)]], np.float32)
        acc += cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return acc / n


def scale_about(img, s, cx, cy):
    h, w = img.shape[:2]
    M = np.array([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)]], np.float32)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def tonemap(lin, exposure=1.0):
    """Filmic curve (linear light -> display 0..1)."""
    x = np.maximum(lin * exposure, 0.0)
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    y = (x * (a * x + b)) / (x * (c * x + d) + e)
    return np.clip(y, 0.0, 1.0) ** (1.0 / 2.2)


class Finisher:
    """Final look shared by every frame: bloom, soft edges, vignette, grain."""

    def __init__(self, W, H, seed=7):
        self.W, self.H = W, H
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nx = (xx - W / 2) / (W / 2)
        ny = (yy - H * 0.48) / (H / 2)
        r = np.sqrt((nx * 0.95) ** 2 + (ny * 0.8) ** 2)
        self.vig = (1.0 - 0.62 * np.clip((r - 0.35) / 0.95, 0, 1) ** 1.6)[..., None].astype(np.float32)
        self.edge = np.clip((r - 0.62) / 0.55, 0, 1)[..., None].astype(np.float32) ** 1.3
        self.rng = np.random.default_rng(seed)

    def __call__(self, img, bloom=0.22, grain=0.045, warmth=0.0, edge_blur=7.0):
        """img: display-referred float32 RGB 0..1."""
        W, H = self.W, self.H
        # bloom
        if bloom > 0:
            small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            bright = np.clip(small - 0.55, 0, 1)
            glow = cv2.GaussianBlur(bright, (0, 0), 9) + 0.6 * cv2.GaussianBlur(bright, (0, 0), 24)
            glow = cv2.resize(glow, (W, H), interpolation=cv2.INTER_LINEAR)
            img = img + bloom * glow * 1.6
        # soft edges (lens look)
        if edge_blur > 0:
            soft = gblur(img, edge_blur)
            img = img + (soft - img) * self.edge
        # gentle split-tone grade: cool shadows, warm highlights
        lum = (img[..., 0:1] * 0.3 + img[..., 1:2] * 0.59 + img[..., 2:3] * 0.11)
        tint_lo = np.array([0.985, 0.995, 1.03], np.float32)
        tint_hi = np.array([1.03 + 0.05 * warmth, 1.0 + 0.012 * warmth, 0.97 - 0.05 * warmth], np.float32)
        img = img * (tint_lo + (tint_hi - tint_lo) * np.clip(lum * 1.4, 0, 1))
        img = img * self.vig
        # film grain: luminance noise, slightly soft, stronger in mid-tones
        if grain > 0:
            g = self.rng.standard_normal((H, W), dtype=np.float32)
            g = cv2.GaussianBlur(g, (0, 0), 0.65)
            g2 = cv2.resize(
                self.rng.standard_normal((H // 2, W // 2), dtype=np.float32), (W, H), interpolation=cv2.INTER_LINEAR
            )
            g = g * 1.5 + g2 * 0.55
            amp = grain * (0.35 + 0.65 * np.clip(1.0 - np.abs(lum - 0.42) * 1.6, 0, 1))
            img = img + g[..., None] * amp
        return np.clip(img, 0.0, 1.0)

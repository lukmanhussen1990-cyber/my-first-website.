"""v3 frames 1470-1590: star pictures of everything taken over the starfield (the Buddha sits on, made of stars),
the original title (चोर / JUSTH) where the thief stood, and the original's fade to black."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v2_final as F2
import v3_story as ST


def render(n):
    cam = ST.cam_at(n)
    img = ST.render_frame(n)
    F2.constellations(img, n, cam)
    k = F2.title_k(n)
    if k > 0:
        a = F2.title_alpha()
        th, tw = a.shape
        cx, cy = 760, 1420
        x0, y0 = int(cx - tw / 2), int(cy - th / 2)
        glow = L.blur(a, 10) * 0.75
        reg = img[y0:y0 + th, x0:x0 + tw]
        col = np.array([0.74, 0.92, 0.99], np.float32)
        reg[:] = reg * (1 - a[..., None] * k) + col * a[..., None] * k + glow[..., None] * np.array([0.30, 0.55, 0.75], np.float32) * k
    return img * F2.end_fade(n)

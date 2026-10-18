"""Build the replacement-Chor sprite sequences from Asset B (natural colours kept).

For every source frame: crop -> APISR 2x super-resolution -> BiRefNet alpha (upscaled, edge-refined)
-> edge-colour decontamination -> mirror (face left like the original Chor) -> anchors.
Output: assets/char/<seq>.npz with rgba (N,H,W,4 uint8) and anchors per frame (in sprite pixels):
  top = (x, y) highest opaque point (head / bun), bot = (x, y) lowest point, hand = (x, y) leftmost point
  of the reaching arm (searched within the arm band), bbox.
"""
import sys, os, json, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sr import sr2x

S = sys.argv[1]
OUT = S + '/assets/char'
os.makedirs(OUT, exist_ok=True)

# sequence: (name, frames, crop box in the 656x480 frame matching the matting list, alpha path pattern)
SEQS = {
    'reach': (list(range(2756, 2819, 2)), (205, 30, 575, 480)),
    'idle': (list(range(2175, 2245, 2)), (190, 90, 450, 480)),
    'hand': (list(range(1722, 1757, 2)), (0, 0, 656, 480)),
    'handcu': (list(range(1852, 1858)), (0, 160, 656, 480)),
}


def decontaminate(rgb, a):
    """Replace colours of semi-transparent edge pixels with nearby solid foreground colours."""
    solid = (a > 0.92).astype(np.uint8)
    if solid.sum() < 50:
        return rgb
    # push-pull fill: average of solid neighbours, coarse-to-fine
    acc = rgb.astype(np.float32) * solid[..., None]
    w = solid.astype(np.float32)
    levels = []
    c, ww = acc, w
    for _ in range(6):
        levels.append((c, ww))
        c = cv2.pyrDown(c); ww = cv2.pyrDown(ww)
    fill = c / np.maximum(ww[..., None], 1e-6)
    for c, ww in reversed(levels):
        up = cv2.resize(fill, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
        own = c / np.maximum(ww[..., None], 1e-6)
        k = np.clip(ww * 4, 0, 1)[..., None]
        fill = own * k + up * (1 - k)
    out = rgb.astype(np.float32)
    edge = (a <= 0.92)[..., None]
    out = np.where(edge, fill, out)
    return np.clip(out, 0, 255).astype(np.uint8)


def refine_alpha(a_small, size):
    a = cv2.resize(a_small, size, interpolation=cv2.INTER_CUBIC)
    a = np.clip((a - 0.5) * 1.35 + 0.5, 0, 1)
    return cv2.GaussianBlur(a, (0, 0), 0.6)


def anchors(a, hand_band=None):
    m = a > 0.5
    ys, xs = np.where(m)
    top_y = ys.min(); top_x = int(np.median(xs[ys <= top_y + 3]))
    bot_y = ys.max(); bot_x = int(np.median(xs[ys >= bot_y - 3]))
    hand = None
    if hand_band is not None:
        y0, y1 = int(hand_band[0] * a.shape[0]), int(hand_band[1] * a.shape[0])
        sub = m[y0:y1]
        cols = np.where(sub.any(axis=0))[0]
        if len(cols):
            hx = cols.min()
            hy = y0 + int(np.median(np.where(sub[:, hx:hx + 3].any(axis=1))[0]))
            hand = (int(hx), int(hy))
    return dict(top=(int(top_x), int(top_y)), bot=(int(bot_x), int(bot_y)), hand=hand,
                bbox=(int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))


def largest_component(a):
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8), 8)
    if n <= 1:
        return a
    k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    keep = cv2.dilate((lab == k).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    return a * keep


def build_seq(name, frames, box, keep_fn=None, hand_band=None, extra=None):
    x0, y0, x1, y1 = box
    rgbas, anc = [], []
    for n in frames:
        src = cv2.imread(f'{S}/assets/bsrc/f_{n:05d}.png')
        ap = f'{S}/assets/balpha/a_{n:05d}.png'
        if not os.path.exists(ap):
            print('missing alpha', n); continue
        a = cv2.imread(ap, 0).astype(np.float32) / 255
        crop = src[y0:y1, x0:x1]
        if keep_fn is not None:
            a = keep_fn(a)
        a = largest_component(a)
        up = sr2x(crop)
        a2 = refine_alpha(a, (up.shape[1], up.shape[0]))
        rgb = decontaminate(up, a2)
        rgba = np.dstack([rgb, (a2 * 255).astype(np.uint8)])
        rgba = cv2.flip(rgba, 1)                      # face left
        ys, xs = np.where(rgba[..., 3] > 8)
        pad = 6
        bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
        bx1, by1 = min(rgba.shape[1], xs.max() + pad + 1), min(rgba.shape[0], ys.max() + pad + 1)
        rgbas.append((rgba, (bx0, by0, bx1, by1)))
        print(name, n, 'ok', flush=True)
    # common canvas over the sequence so anchors stay comparable frame to frame
    bx0 = min(b[0] for _, b in rgbas); by0 = min(b[1] for _, b in rgbas)
    bx1 = max(b[2] for _, b in rgbas); by1 = max(b[3] for _, b in rgbas)
    arr = np.stack([r[by0:by1, bx0:bx1] for r, _ in rgbas])
    for r in arr:
        anc.append(anchors(r[..., 3].astype(np.float32) / 255, hand_band))
    np.savez_compressed(f'{OUT}/{name}.npz', rgba=arr, frames=np.array(frames[:len(arr)]))
    json.dump(dict(anchors=anc, frames=frames[:len(arr)], crop=box, canvas=(int(bx0), int(by0), int(bx1), int(by1))),
              open(f'{OUT}/{name}.json', 'w'))
    sheet = [cv2.resize(r, None, fx=0.5, fy=0.5) for r in arr[::max(1, len(arr) // 8)]]
    vis = np.hstack([np.where(s[..., 3:4] > 0, s[..., :3], 40) for s in sheet])
    cv2.imwrite(f'{OUT}/{name}_sheet.png', vis)
    return arr, anc


if __name__ == '__main__':
    which = sys.argv[2:] or list(SEQS)
    for name in which:
        if name == 'kneel':
            k = cv2.imread(S + '/assets/kneel/kneel_rgba.png', cv2.IMREAD_UNCHANGED)
            a = k[..., 3].astype(np.float32) / 255
            up = sr2x(k[..., :3])
            a2 = refine_alpha(a, (up.shape[1], up.shape[0]))
            rgb = decontaminate(up, a2)
            rgba = cv2.flip(np.dstack([rgb, (a2 * 255).astype(np.uint8)]), 1)
            ys, xs = np.where(rgba[..., 3] > 8)
            rgba = rgba[max(0, ys.min() - 6):ys.max() + 7, max(0, xs.min() - 6):xs.max() + 7]
            anc = anchors(rgba[..., 3].astype(np.float32) / 255)
            np.savez_compressed(f'{OUT}/kneel.npz', rgba=rgba[None], frames=np.array([1877]))
            json.dump(dict(anchors=[anc], frames=[1877]), open(f'{OUT}/kneel.json', 'w'))
            cv2.imwrite(f'{OUT}/kneel_sheet.png', np.where(rgba[..., 3:4] > 0, rgba[..., :3], 40))
            print('kneel ok', anc)
            continue
        frames, box = SEQS[name]
        hb = (0.30, 0.62) if name == 'reach' else ((0.25, 0.80) if name == 'hand' else None)
        build_seq(name, frames, box, hand_band=hb)

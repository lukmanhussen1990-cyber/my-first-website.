"""Character cut-outs for the Kerala-style film, upscaled 4x with the same painterly filter as the plates.
usage: v2_sprites.py <name> [...]   names: reach idle kneel thin_st thin_cu
Output: assets/v2char/<name>.npz  rgba uint8 (N,H,W,4) on a common canvas, natural colours."""
import os, sys, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L
from sr import sr2x

S = L.S
OUT = S + '/assets/v2char'
os.makedirs(OUT, exist_ok=True)
F = 4

SEQ = {
    # name: (list of (frame png, alpha png), crop box in the 656x480 frame, mirror)
    'reach': ([(f'{S}/assets/bsrc/f_{n:05d}.png', f'{S}/assets/balpha/a_{n:05d}.png') for n in range(2756, 2819, 2)], (205, 30, 575, 480), True),
    'idle': ([(f'{S}/assets/bsrc/f_{n:05d}.png', f'{S}/assets/balpha/a_{n:05d}.png') for n in range(2185, 2245, 2)], (190, 90, 450, 480), True),
    'thin_st': ([(f'{S}/v2/thin/st_{k:02d}.png', f'{S}/v2/thin/a_st_{k:02d}.png') for k in range(1, 15)], (0, 0, 330, 480), False),
    'thin_cu': ([(f'{S}/v2/thin/cu_{k:02d}.png', f'{S}/v2/thin/a_cu_{k:02d}.png') for k in range(1, 21)], (0, 0, 656, 480), False),
    'hand': ([(f'{S}/assets/bsrc/f_{n:05d}.png', f'{S}/assets/balpha/a_{n:05d}.png') for n in (1854,)], (0, 160, 656, 480), True),
    'walk': ([(f'{S}/v3/wsrc/f_{n:05d}.png', f'{S}/v3/wsrc/a_{n:05d}.png') for n in range(3038, 3061, 2)], (240, 110, 470, 480), True),
}


def largest(a, thr=0.5, dil=5):
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > thr).astype(np.uint8), 8)
    if n <= 1:
        return a
    k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    return a * cv2.dilate((lab == k).astype(np.uint8), np.ones((dil, dil), np.uint8)).astype(np.float32)


def decontam(rgb, a):
    solid = (a > 0.93).astype(np.float32)
    inner = cv2.erode(solid, np.ones((3, 3), np.uint8))
    num = cv2.GaussianBlur(rgb * inner[..., None], (0, 0), 2.5)
    den = cv2.GaussianBlur(inner, (0, 0), 2.5)[..., None]
    fill = num / np.maximum(den, 1e-4)
    edge = ((a > 0.01) & (inner < 0.5))[..., None]
    return np.where(edge & (den > 0.02), fill, rgb)


def build(name):
    if name == 'kneel':
        k = cv2.imread(S + '/assets/kneel/kneel_rgba.png', cv2.IMREAD_UNCHANGED)
        items = [(k[..., :3], k[..., 3].astype(np.float32) / 255)]
        mirror = True
    else:
        lst, (x0, y0, x1, y1), mirror = SEQ[name]
        items = []
        for fp, ap in lst:
            if not os.path.exists(ap):
                print('missing', ap)
                continue
            fr = cv2.imread(fp)[y0:y1, x0:x1]
            a = cv2.imread(ap, 0).astype(np.float32) / 255
            if a.shape != fr.shape[:2]:
                a = cv2.resize(a, (fr.shape[1], fr.shape[0]))
            if name == 'thin_st':
                # keep only the left figure (the thin man); the frames also contain the fat man on the right
                a[:, 230:] = 0
            items.append((fr, a))
    out = []
    for fr, a in items:
        a = largest(a)
        u2 = sr2x(fr)                                             # anime SR 2x (clean outlines)
        rgb = cv2.resize(u2, None, fx=F / 2, fy=F / 2, interpolation=cv2.INTER_LANCZOS4)
        bl = cv2.GaussianBlur(rgb, (0, 0), 1.0)
        rgb = cv2.addWeighted(rgb, 1.35, bl, -0.35, 0).astype(np.float32)
        A = cv2.resize(a, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
        A = np.clip((A - 0.5) * 1.25 + 0.5, 0, 1)
        A = cv2.GaussianBlur(A, (0, 0), 0.9)
        rgb = decontam(rgb, A)
        rgba = np.dstack([np.clip(rgb, 0, 255), A * 255]).astype(np.uint8)
        if mirror:
            rgba = cv2.flip(rgba, 1)
        out.append(rgba)
    al = np.stack([o[..., 3] for o in out]).max(axis=0)
    ys, xs = np.where(al > 8)
    bx0, by0, bx1, by1 = max(0, xs.min() - 8), max(0, ys.min() - 8), xs.max() + 9, ys.max() + 9
    arr = np.stack([o[by0:by1, bx0:bx1] for o in out])
    np.savez_compressed(f'{OUT}/{name}.npz', rgba=arr)
    sheet = [cv2.resize(r, None, fx=0.15, fy=0.15, interpolation=cv2.INTER_AREA) for r in arr[::max(1, len(arr) // 8)]]
    vis = np.hstack([np.where(s[..., 3:4] > 20, s[..., :3], 40) for s in sheet])
    cv2.imwrite(f'{OUT}/{name}_sheet.jpg', vis)
    print(name, arr.shape, flush=True)


if __name__ == '__main__':
    for nm in sys.argv[1:]:
        build(nm)

"""Replace the small 'Jensei' interface label by a typeset 'Claude' on a tracked UI plane.
Per frame: inpaint the label from the surrounding glass (harmonic fill), estimate the blur kernel
and ink colour from the original label (alpha model), and draw 'Claude' through the same
homography, kernel and colour."""
import sys, json, os
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *
from textrender import text_alpha, logo_alpha, place_scaled
from scipy.optimize import minimize

FONT = f'{S}/fonts/NotoSans-VF.ttf'
BOOST = 1.0
# brand logo construction (see wm_layer.py): enlarged initial capital, 60 units lighter
CAP_SCALE, CAP_DW = 1.34, -60

def ink_color(K, box, light):
    x0, y0, x1, y1 = box
    reg = K[y0:y1, x0:x1].reshape(-1, 3); l = reg.mean(1)
    sel = reg[l >= np.percentile(l, 97)] if light else reg[l <= np.percentile(l, 3)]
    return sel.mean(0)

def key_alpha(K, box, light, thr=25):
    """Alpha matte of the original label in the key frame + clean background."""
    x0, y0, x1, y1 = box
    L = K.mean(2)
    m = np.zeros(L.shape, bool)
    sub = L[y0:y1, x0:x1]
    med = np.median(sub)
    m[y0:y1, x0:x1] = (sub - med > thr) if light else (med - sub > thr)
    m = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    B = harmonic_fill(K, m)
    c = ink_color(K, box, light)
    v = c[None, None, :] - B
    a = ((K - B) * v).sum(2) / ((v * v).sum(2) + 1e-6)
    a = np.clip(a, 0, 1); a[~m] = 0
    return a.astype(np.float32), B, c, m

def fit_font(aK, box, wghts=(620, 660, 700, 740)):
    ys, xs = np.nonzero(aK > 0.5)
    best = None
    sl = (slice(box[1] - 15, box[3] + 15), slice(box[0] - 15, box[2] + 15))
    Ab = gblur(aK, 0.8)[sl]
    for w in wghts:
        px0 = 40.0
        a, ox, by = logo_alpha('Jensei', FONT, px0, w, CAP_SCALE, w + CAP_DW, 0.0, ss=8)
        ay, ax = np.nonzero(a > 0.5)
        sc0 = (xs.max() - xs.min()) / (ax.max() - ax.min())
        x0 = xs.min() - (ax.min() - ox) * sc0; y0 = ys.min() - (ay.min() - by) * sc0
        def err(p):
            A = place_scaled(a, ox, by, p[0], p[1], p[2])
            return float(((gblur(A, 0.8)[sl] - Ab) ** 2).mean())
        st = min(([x0, y0 + dy, sc0 * ds] for ds in np.linspace(0.92, 1.08, 9) for dy in np.linspace(-3, 3, 7)), key=err)
        r = minimize(err, st, method='Powell', options={'xtol': 1e-3, 'maxfev': 1500})
        if best is None or r.fun < best[0]:
            best = (r.fun, w, px0 * r.x[2], r.x[0], r.x[1], a, ox, by, r.x[2])
    return best

def build_key(K_idx, box, light, out_prefix):
    K = load(K_idx)
    aK, BK, cK, mK = key_alpha(K, box, light)
    e, w, px, ox_pos, base, a, ox, by, sc = fit_font(aK, box)
    # edge softness of the original label
    AJ = place_scaled(a, ox, by, ox_pos, base, sc)
    sl = (slice(box[1] - 15, box[3] + 15), slice(box[0] - 15, box[2] + 15))
    s_best = min([0, 0.3, 0.5, 0.7, 0.9, 1.1, 1.4], key=lambda s: float(((gblur(AJ, s)[sl] - aK[sl]) ** 2).mean()))
    # 'Claude' at the same pen origin and baseline
    a2, ox2, by2 = logo_alpha('Claude', FONT, 40.0 * BOOST, w, CAP_SCALE, w + CAP_DW, 0.0, ss=8)
    AC = gblur(place_scaled(a2, ox2, by2, ox_pos, base, sc), s_best)
    np.save(out_prefix + '_aK.npy', aK); np.save(out_prefix + '_AC.npy', AC.astype(np.float32))
    np.save(out_prefix + '_mK.npy', mK)
    info = dict(K=K_idx, box=box, light=light, ink=cK.tolist(), wght=w, px=px, pen_x=ox_pos, baseline=base, edge_sigma=s_best, fit_err=e)
    json.dump(info, open(out_prefix + '_key.json', 'w'), indent=1)
    # preview: original / re-typeset Jensei / Claude on the clean background
    prev = np.vstack([K[sl], (BK * (1 - gblur(AJ, s_best)[..., None]) + cK * gblur(AJ, s_best)[..., None])[sl],
                      (BK * (1 - AC[..., None]) + cK * AC[..., None])[sl]])
    save(out_prefix + '_key_preview.png', cv2.resize(prev, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC))
    print(info)
    return info

def kernels():
    ks = []
    for s in [0, 0.4, 0.8, 1.2, 1.7, 2.3, 3.0, 4.0, 5.5, 7.0, 9.0]:
        ks.append(('g', s))
    for L in [3, 5, 8, 12, 17, 24, 32]:
        ks.append(('h', L)); ks.append(('v', L))
    for ang in [20, 35, 50, 65, 80, 100, 115, 130, 145, 160]:
        for L in [4, 7, 11, 16, 22]:
            ks.append(('d', (ang, L)))
    return ks

_KCACHE = {}
def apply_k(img, k):
    t, p = k
    if t == 'g':
        return gblur(img, p)
    if t == 'd':
        key = (t, p)
        if key not in _KCACHE:
            ang, L = p; n = L + 4
            ker = np.zeros((n, n), np.float32); c = (n - 1) / 2
            dx, dy = np.cos(np.radians(ang)) * L / 2, -np.sin(np.radians(ang)) * L / 2
            cv2.line(ker, (int(round(c - dx)), int(round(c - dy))), (int(round(c + dx)), int(round(c + dy))), 1.0, 1, cv2.LINE_AA)
            ker = cv2.GaussianBlur(ker, (0, 0), 0.6); _KCACHE[key] = ker / ker.sum()
        return cv2.filter2D(img, -1, _KCACHE[key], borderType=cv2.BORDER_CONSTANT)
    ker = np.zeros((p, p), np.float32)
    if t == 'h': ker[p // 2, :] = 1
    else: ker[:, p // 2] = 1
    ker = cv2.GaussianBlur(ker, (0, 0), 0.6); ker /= ker.sum()
    return cv2.filter2D(img, -1, ker, borderType=cv2.BORDER_CONSTANT)

def kext(k):
    t, p = k
    if t == 'g': return int(np.ceil(3 * p)) + 1
    if t == 'd': return p[1] // 2 + 3
    return p // 2 + 2

def local_scale(H, pt):
    x, y = pt
    def m(px, py):
        v = H @ np.array([px, py, 1.0]); return v[:2] / v[2]
    J = np.stack([m(x + 1, y) - m(x, y), m(x, y + 1) - m(x, y)], 1)
    return float(np.sqrt(abs(np.linalg.det(J))))

def warp_to(img, H, pre_sigma=0.0):
    if pre_sigma > 0.05:
        img = gblur(img, pre_sigma)
    return cv2.warpPerspective(img, H, (1920, 1080), flags=cv2.INTER_LINEAR, borderValue=0)

RADII = [3, 5, 8, 12, 18, 26, 36]
NO_SHEAR = set()

def process(prefix, trackfile, outdir, safe_rect, frames=None):
    """safe_rect: key-frame rectangle the edit may touch (keeps neighbouring UI intact)."""
    os.makedirs(outdir, exist_ok=True)
    info = json.load(open(prefix + '_key.json')); aK = np.load(prefix + '_aK.npy'); AC = np.load(prefix + '_AC.npy')
    tr = json.load(open(trackfile))
    box = info['box']; ctr = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
    supK = cv2.dilate(((aK > 0.02) | (AC > 0.02)).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    safeK = np.zeros((1080, 1920), np.float32); x0, y0, x1, y1 = safe_rect; safeK[y0:y1, x0:x1] = 1
    log = []
    for key in sorted(tr, key=int):
        i = int(key)
        if frames and i not in frames: continue
        H = np.array(tr[key]['H'])
        im = load(i)
        s = local_scale(H, ctr)
        pre = 0.5 * np.sqrt(max(0.0, 1.0 / (s * s) - 1.0))
        aJ = warp_to(aK, H, pre); aC = warp_to(AC, H, pre)
        sup = warp_to(supK, H) > 0.3; safe = warp_to(safeK, H) > 0.5
        if sup.sum() < 10:
            save(f'{outdir}/f{i:04d}.png', im); continue
        ys, xs = np.nonzero(sup)
        pad = 60
        sl = (slice(max(ys.min() - pad, 0), min(ys.max() + pad, 1080)), slice(max(xs.min() - pad, 0), min(xs.max() + pad, 1920)))
        imr, aJr, aCr, supr, safer = im[sl], aJ[sl], aC[sl], sup[sl], safe[sl]
        fms, bgs = {}, {}
        for r in RADII:
            fm = cv2.dilate(supr.astype(np.uint8), np.ones((2 * r + 1, 2 * r + 1), np.uint8)).astype(bool) & safer
            fms[r] = fm; bgs[r] = harmonic_fill(imr, fm)
        ev = fms[RADII[-1]]
        cyx = np.array(np.nonzero(supr)).mean(1)  # label centre (y, x) in region coords
        def corr(a, q):
            dx, dy, sh, ds = q
            cy, cx = cyx
            M = np.float32([[1 + ds, sh, cx - (1 + ds) * cx - sh * cy + dx], [0, 1 + ds, cy - (1 + ds) * cy + dy]])
            return cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)
        def score(k, q):
            r = next((rr for rr in RADII if rr >= kext(k) + 1), RADII[-1])
            bg = bgs[r]
            w = np.clip(apply_k(corr(aJr, q) if q is not None else aJr, k), 0, 1)[..., None]
            c = (w * (imr - bg + w * bg)).sum((0, 1)) / ((w * w).sum() + 1e-6)
            res = imr - (bg * (1 - w) + c * w)
            return float((res[ev] ** 2).mean()), c, r
        grid = sorted(((score(k, None)[0], k) for k in kernels()), key=lambda t: t[0])
        best = (grid[0][0], grid[0][1], None)
        for e0, k in grid[:4]:
            shb = 0.0 if i in NO_SHEAR else 0.35
            rr = minimize(lambda q: score(k, q)[0], [0.0, 0.0, 0.0, 0.0], method='Powell',
                          bounds=[(-6, 6), (-6, 6), (-shb - 1e-6, shb + 1e-6), (-0.08, 0.08)], options={'xtol': 1e-2, 'ftol': 1e-4, 'maxfev': 400})
            if rr.fun < best[0]:
                best = (float(rr.fun), k, rr.x)
        e, k, q = best
        _, c, r = score(k, q)
        c = np.clip(c, 0, 255)
        if float(np.abs(c - bgs[r][fms[r]].mean(0)).mean()) < 4.0:   # label not visible in this frame
            save(f'{outdir}/f{i:04d}.png', im)
            log.append(dict(frame=i, skipped='invisible')); print(log[-1], flush=True); continue
        ac = np.clip(apply_k(corr(aCr, q) if q is not None else aCr, k), 0, 1)
        r2 = next((rr for rr in RADII if rr >= kext(k) + 1), RADII[-1])
        fm2 = (fms[r2] | (cv2.dilate((ac > 0.004).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & safer))
        bg2 = harmonic_fill(imr, fm2)
        comp = bg2 * (1 - ac[..., None]) + c * ac[..., None]
        out_r = imr.copy(); out_r[fm2] = comp[fm2]
        out = im.copy(); out[sl] = out_r
        save(f'{outdir}/f{i:04d}.png', out)
        contrast = float(np.abs(c - bg2[fm2].mean(0)).mean())
        clipped = float((ac[~safer] > 0.02).sum())
        log.append(dict(frame=i, kernel=[k[0], k[1] if not isinstance(k[1], tuple) else list(k[1])], refine=None if q is None else np.round(q, 3).tolist(), color=np.round(c, 1).tolist(), err=round(e, 2), scale=round(s, 3),
                        contrast=round(contrast, 1), cc=tr[key].get('cc'), claude_outside_safe_px=clipped))
        print(log[-1], flush=True)
    json.dump(log, open(f'{outdir}/log.json', 'w'), indent=1)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'key':
        build_key(int(sys.argv[2]), [int(v) for v in sys.argv[3].split(',')], sys.argv[4] == 'light', sys.argv[5])
    else:
        process(sys.argv[2], sys.argv[3], sys.argv[4], [int(v) for v in sys.argv[5].split(',')])

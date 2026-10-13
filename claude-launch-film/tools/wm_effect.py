"""Per-band (horizontal position along the word) blur + per-channel gain fit of the
wordmark animation, on top of the fitted geometry. Also renders a 'Jensei'
reconstruction to validate the effect model."""
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *
from wm_geom import template_crisp as template, warp, harmonic_fill

K = 12
SIGMAS = [0, 0.6, 1.0, 1.5, 2.0, 2.6, 3.3, 4.0, 5.0, 6.0, 7.5, 9.0, 11.0, 13.5, 16.0, 20.0]
U_CENTERS = np.linspace(-0.04, 1.04, K)

def band_weights(u):
    """Hat-function partition of unity over U_CENTERS, evaluated at u (any shape)."""
    d = U_CENTERS[1] - U_CENTERS[0]
    uc = np.clip(u, U_CENTERS[0], U_CENTERS[-1])
    w = np.maximum(0, 1 - np.abs(uc[..., None] - U_CENTERS) / d)
    return w / w.sum(-1, keepdims=True)

def u_map(geom, anchor, x0t, x1t, shape=(1080, 1920)):
    s, tx, ty = geom['s'], geom['tx'], geom['ty']
    xs = np.arange(shape[1], dtype=np.float32)
    xt = anchor[0] + (xs - anchor[0] - tx) / s
    return (xt - x0t) / (x1t - x0t)

def roi_of(W, pad=60):
    ys, xs = np.nonzero(W.mean(2) > 0.5)
    return (slice(max(ys.min() - pad, 0), min(ys.max() + pad, 1080)), slice(max(xs.min() - pad, 0), min(xs.max() + pad, 1920)))

def support_mask(W, grow=26):
    m = (W.mean(2) > 0.8).astype(np.uint8)
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))).astype(bool)

def fit(geomfile, out):
    G = json.load(open(geomfile))
    T, anchor, tbox = template()
    x0t, x1t = tbox[0], tbox[1]
    res = []
    for g in G['fits']:
        i = g['frame']
        if g['gain'] < 0.01:
            res.append(dict(frame=i, sigma=[0.0] * K, gain=[[0.0] * 3] * K)); continue
        im = load(i)
        W = warp(T, g['s'], g['tx'], g['ty'], anchor)
        sup = support_mask(W, 30)
        bg = harmonic_fill(im, sup)
        D = im - bg
        sl = roi_of(W)
        Wr, Dr = W[sl], D[sl]
        u = u_map(g, anchor, x0t, x1t)[sl[1]]
        bw = band_weights(u)  # (w, K)
        best_e = np.full(K, np.inf); best_s = np.zeros(K); best_g = np.zeros((K, 3))
        for sg in SIGMAS:
            B = gblur(Wr, sg)
            # per-band weighted least squares per channel; weights depend only on column
            num = np.einsum('hwc,wk->kc', B * Dr, bw)
            den = np.einsum('hwc,wk->kc', B * B, bw) + 1e-6
            gk = np.clip(num / den, 0, 4)
            # error per band: sum_w bw * sum_h,c (D - g B)^2
            e = np.einsum('hwc,wk->kc', Dr * Dr, bw) - 2 * gk * num + gk * gk * (den - 1e-6)
            e = e.sum(1)
            better = e < best_e
            best_e[better] = e[better]; best_s[better] = sg; best_g[better] = gk[better]
        res.append(dict(frame=i, sigma=best_s.tolist(), gain=best_g.tolist(), err=(best_e / max(Dr.size, 1)).tolist()))
        print(i, 'sig', np.round(best_s, 1).tolist(), 'gR', np.round(best_g[:, 0], 2).tolist(), flush=True)
    json.dump(dict(anchor=anchor, tbox=[int(v) for v in tbox], u_centers=U_CENTERS.tolist(), frames=res), open(out, 'w'), indent=1)

def smooth_params(E, cut_frames=()):
    """Light temporal smoothing of the per-band parameters (never across hard cuts)."""
    fr = E['frames']
    sig = np.array([f['sigma'] for f in fr]); gn = np.array([f['gain'] for f in fr])
    idx = [f['frame'] for f in fr]
    sig2, gn2 = sig.copy(), gn.copy()
    for j in range(1, len(fr) - 1):
        if idx[j] in cut_frames or idx[j + 1] in cut_frames:
            continue
        sig2[j] = 0.25 * sig[j - 1] + 0.5 * sig[j] + 0.25 * sig[j + 1]
        gn2[j] = 0.25 * gn[j - 1] + 0.5 * gn[j] + 0.25 * gn[j + 1]
    return {f: (sig2[j], gn2[j]) for j, f in enumerate(idx)}

def render_layer(L, g, anchor, x0l, x1l, sig, gn):
    """Apply geometry + per-band blur/gain to a template-space RGB layer L whose own horizontal
    extent is [x0l, x1l] (template coordinates)."""
    Wl = warp(L, g['s'], g['tx'], g['ty'], anchor)
    if Wl.max() <= 0:
        return Wl
    sl = roi_of(Wl, pad=80)
    u = u_map(g, anchor, x0l, x1l)[sl[1]]
    bw = band_weights(u)
    out = np.zeros_like(Wl)
    acc = np.zeros(Wl[sl].shape, np.float32)
    cache = {}
    for k in range(len(sig)):
        if bw[:, k].max() <= 0:
            continue
        sgq = round(float(sig[k]), 2)
        if sgq not in cache:
            cache[sgq] = gblur(Wl[sl], sgq)
        acc += cache[sgq] * gn[k][None, None, :] * bw[None, :, k, None]
    out[sl] = acc
    return out

if __name__ == '__main__':
    fit(sys.argv[1], sys.argv[2])

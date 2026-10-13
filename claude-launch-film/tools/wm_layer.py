"""Build the 'Claude' wordmark layer in template space, styled to match the settled
'Jensei' wordmark (font size/baseline fit, core softness, glow, colour ramp)."""
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *
from wm_geom import template_crisp as template
from textrender import text_alpha, logo_alpha, place_scaled

# brand logo construction measured on the reference: Noto Sans body (wght 660) with the
# initial capital enlarged 1.34x (wght 600), all on one baseline
LOGO_CAP_SCALE, LOGO_CAP_WGHT = 1.34, 600
def word_alpha(word, font, px, wght, tracking):
    return logo_alpha(word, font, px, wght, LOGO_CAP_SCALE, LOGO_CAP_WGHT, tracking)
from scipy.optimize import minimize

NB = 16
# measured on straight stems of the settled wordmark: ~1.5 px edge, no halo
STYLE_S0, STYLE_SG, STYLE_K = [0.6], [4.0], [0.0]

def fit_alignment(Tl, font, wght, tracking, px0):
    a, ox, by = word_alpha('Jensei', font, px0, wght, tracking)
    ys, xs = np.nonzero(Tl > 0.35 * Tl.max())
    ay, ax_ = np.nonzero(a > 0.5)
    sc0 = (xs.max() - xs.min()) / (ax_.max() - ax_.min())
    x0 = xs.min() - (ax_.min() - ox) * sc0; y0 = ys.min() - (ay.min() - by) * sc0
    Tb = gblur(Tl / Tl.max(), 1.5)
    def err(p):
        A = place_scaled(a, ox, by, p[0], p[1], p[2])
        A = gblur(A, 1.5)
        return float(((A - Tb)[380:680, 700:1250] ** 2).mean())
    best = None
    for ds in np.linspace(0.9, 1.1, 9):
        for dy in np.linspace(-12, 12, 7):
            e = err([x0, y0 + dy, sc0 * ds])
            if best is None or e < best[0]:
                best = (e, [x0, y0 + dy, sc0 * ds])
    r = minimize(err, best[1], method='Powell', options={'xtol': 1e-3, 'maxfev': 800})
    return r.x, a, ox, by, r.fun

def style_fit(T, A, u):
    best = None
    for s0 in STYLE_S0:
        for sg in STYLE_SG:
            for k in STYLE_K:
                B = gblur(A, s0) + k * gblur(A, sg)
                bins = np.clip((u * NB).astype(int), 0, NB - 1)
                col = np.zeros((NB, 3)); err = 0
                for b in range(NB):
                    m = (bins == b)[None, :].repeat(A.shape[0], 0) & (B > 0.002)
                    if m.sum() < 10: continue
                    bb = B[m]
                    for c in range(3):
                        t = T[..., c][m]
                        col[b, c] = (bb @ t) / (bb @ bb + 1e-9)
                # smooth colour ramp: quadratic in u per channel
                uc = (np.arange(NB) + 0.5) / NB
                w = np.array([((bins == b).sum()) for b in range(NB)], float)
                coef = [np.polyfit(uc[w > 0], col[w > 0, c], 2, w=np.sqrt(w[w > 0])) for c in range(3)]
                C = np.stack([np.polyval(coef[c], np.clip(u, 0, 1)) for c in range(3)], -1)  # (W,3)
                R = B[..., None] * C[None]
                e = float(((R - T) ** 2).mean())
                if best is None or e < best[0]:
                    best = (e, s0, sg, k, [cf.tolist() for cf in coef])
    return best

def build(font, wght, tracking, px0, word, out_prefix, boost=1.0):
    T, anchor, tbox = template()
    Tl = T.mean(2)
    (x0, y0, sc), a, ox, by, aerr = fit_alignment(Tl, font, wght, tracking, px0)
    px = px0 * sc
    print('align', dict(x=x0, y=y0, scale=sc, px=px, err=aerr))
    AJ = place_scaled(a, ox, by, x0, y0, sc)
    ys, xs = np.nonzero(AJ > 0.5); jx0, jx1 = xs.min(), xs.max()
    sl = (slice(380, 680), slice(650, 1300))
    uJ = (np.arange(1920)[sl[1]] - jx0) / (jx1 - jx0)
    best = style_fit(T[sl], AJ[sl], uJ)
    e, s0, sg, k, coef = best
    print('style', dict(err=e, core_sigma=s0, glow_sigma=sg, glow_k=k))
    # render the replacement word at the same size and baseline, ink-centred where Jensei's ink is centred
    a2, ox2, by2 = word_alpha(word, font, px0 * boost, wght, tracking)
    tmp = place_scaled(a2, ox2, by2, 0, y0, sc)
    ys2, xs2 = np.nonzero(tmp > 0.5)
    shift = (jx0 + jx1) / 2 - (xs2.min() + xs2.max()) / 2
    AC = place_scaled(a2, ox2, by2, shift, y0, sc)
    ys2, xs2 = np.nonzero(AC > 0.5); cx0, cx1 = xs2.min(), xs2.max()
    # fill colour: measured core colour of the reference letters along the word (robust
    # high-percentile per position bin); least squares under a font mismatch reads too dark
    nb = 8; uc = (np.arange(nb) + 0.5) / nb; meas = []
    for b in range(nb):
        xa = int(jx0 + (jx1 - jx0) * b / nb); xb = int(jx0 + (jx1 - jx0) * (b + 1) / nb)
        reg = T[440:610, xa:xb].reshape(-1, 3); l = reg.mean(1)
        meas.append(reg[l > 0.85 * l.max()].mean(0))
    meas = np.array(meas)
    def styled(A, lx0, lx1):
        u = np.clip((np.arange(1920) - lx0) / (lx1 - lx0), 0, 1)
        C = np.stack([np.interp(u, uc, meas[:, c]) for c in range(3)], -1)
        B = gblur(A, s0) + k * gblur(A, sg)
        return (B[..., None] * C[None]).astype(np.float32)
    LJ = styled(AJ, jx0, jx1); LC = styled(AC, cx0, cx1)
    np.save(out_prefix + '_layer.npy', LC); np.save(out_prefix + '_jensei_layer.npy', LJ)
    json.dump(dict(boost=boost, x0=float(cx0), x1=float(cx1), jx0=float(jx0), jx1=float(jx1), px=float(px), baseline=float(y0),
                   core_sigma=s0, glow_sigma=sg, glow_k=k, coef=coef, colors=meas.tolist(), font=font, wght=wght, tracking=tracking,
                   align_err=aerr, style_err=e), open(out_prefix + '_ext.json', 'w'), indent=1)
    # comparison image: template / re-rendered Jensei / Claude
    cmp_ = np.vstack([T[400:640, 700:1230], LJ[400:640, 700:1230], LC[400:640, 700:1230]])
    save(out_prefix + '_cmp.png', cmp_)
    print('claude ink x', cx0, cx1, 'jensei ink x', jx0, jx1)

if __name__ == '__main__':
    font, wght, tracking, px0, word, outp = sys.argv[1], (None if sys.argv[2] == 'none' else float(sys.argv[2])), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5], sys.argv[6]
    build(font, wght, tracking, px0, word, outp, float(sys.argv[7]) if len(sys.argv) > 7 else 1.0)

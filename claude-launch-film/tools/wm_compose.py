"""Compose the replacement wordmark into the reference frames.
mode 'recon': re-render the original 'Jensei' through the fitted model (validation).
mode 'claude': remove 'Jensei' and render the 'Claude' layer with the identical animation."""
import sys, json, os
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *
from wm_geom import template_crisp as template, warp
from wm_effect import smooth_params, render_layer, support_mask

def compose(geomfile, efffile, layer, lext, outdir, cuts=(), frames=None):
    os.makedirs(outdir, exist_ok=True)
    G = json.load(open(geomfile)); E = json.load(open(efffile))
    T, anchor, tbox = template()
    P = smooth_params(E, cuts)
    gmap = {g['frame']: g for g in G['fits']}
    stats = []
    for i in (frames or sorted(P)):
        g = gmap[i]; sig, gn = P[i]
        im = load(i)
        if g['gain'] < 0.01 and max(np.max(gn), 0) < 0.01:
            save(f'{outdir}/f{i:04d}.png', im); continue
        WT = warp(T, g['s'], g['tx'], g['ty'], anchor)
        R = render_layer(layer, g, anchor, lext[0], lext[1], sig, np.array(gn))
        grow = int(26 + 2.5 * float(np.max(sig)))
        m = support_mask(WT, grow) | support_mask(R, grow)
        bg = harmonic_fill(im, m)
        out = im.copy()
        out[m] = bg[m] + R[m]
        save(f'{outdir}/f{i:04d}.png', out)
        stats.append((i, float(np.abs(out - im)[m].mean())))
    return stats

if __name__ == '__main__':
    mode, geomfile, efffile, outdir = sys.argv[1:5]
    cuts = (306, 1268)
    if mode == 'recon':
        T, anchor, tbox = template()
        st = compose(geomfile, efffile, T, (tbox[0], tbox[1]), outdir, cuts)
    else:
        layer = np.load(sys.argv[5]); ext = json.load(open(sys.argv[6]))
        st = compose(geomfile, efffile, layer, (ext['x0'], ext['x1']), outdir, cuts)
    for i, e in st:
        print(i, round(e, 2))

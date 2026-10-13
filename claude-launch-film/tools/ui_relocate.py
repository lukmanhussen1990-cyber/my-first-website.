"""Re-localise the label homography in low-confidence frames: search a similarity correction
(scale about the label centre + translation) maximising normalised cross-correlation between the
key-frame label alpha (warped) and the frame's local text contrast."""
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *

def relocate(prefix, trackfile, frames, light, R=36):
    info = json.load(open(prefix + '_key.json')); aK = np.load(prefix + '_aK.npy')
    tr = json.load(open(trackfile))
    box = info['box']; ctrK = np.array([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 1.0])
    for i in frames:
        H = np.array(tr[str(i)]['H'])
        g = load(i).mean(2)
        c = H @ ctrK; c = c[:2] / c[2]
        best = None
        for s in np.linspace(0.82, 1.18, 19):
            S = np.array([[s, 0, c[0] - s * c[0]], [0, s, c[1] - s * c[1]], [0, 0, 1.0]])
            Hs = S @ H
            a = cv2.warpPerspective(aK, Hs, (1920, 1080), flags=cv2.INTER_LINEAR)
            ys, xs = np.nonzero(a > 0.05)
            if len(ys) < 20: continue
            y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
            tmpl = gblur(a[y0:y1, x0:x1], 1.5).astype(np.float32)
            Y0, Y1, X0, X1 = max(y0 - R, 0), min(y1 + R, 1080), max(x0 - R, 0), min(x1 + R, 1920)
            reg = g[Y0:Y1, X0:X1]
            hp = reg - cv2.GaussianBlur(reg, (0, 0), 12)
            hp = gblur(hp if light else -hp, 1.5).astype(np.float32)
            if hp.shape[0] < tmpl.shape[0] or hp.shape[1] < tmpl.shape[1]: continue
            m = cv2.matchTemplate(hp, tmpl, cv2.TM_CCOEFF_NORMED)
            _, mv, _, ml = cv2.minMaxLoc(m)
            if best is None or mv > best[0]:
                dx, dy = X0 + ml[0] - x0, Y0 + ml[1] - y0
                best = (mv, s, dx, dy, np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1.0]]) @ Hs)
        mv, s, dx, dy, Hn = best
        print(i, 'ncc', round(float(mv), 3), 'scale_corr', round(float(s), 3), 'shift', dx, dy, 'old cc', round(tr[str(i)]['cc'], 3), flush=True)
        tr[str(i)] = dict(H=Hn.tolist(), cc=tr[str(i)]['cc'], relocated=dict(ncc=float(mv), s=float(s), dx=int(dx), dy=int(dy)))
    json.dump(tr, open(trackfile, 'w'))

if __name__ == '__main__':
    relocate(sys.argv[1], sys.argv[2], [int(a) for a in sys.argv[4:]], sys.argv[3] == 'light')

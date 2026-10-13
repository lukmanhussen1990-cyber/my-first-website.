"""S11: build the edited canonical content (frame-1110 coordinates, K x resolution).
O = original (upsampled), E = edited, plus masks of what changed. Swaps Dr Abhishek Shukla -> Dr. Imran Hussain
in the breadcrumb, the card name (credentials slide to follow), the e-mail, the About line, and the photo."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from textr import render
K = 2
X0, Y0, X1, Y1 = 690, 270, 1410, 700            # canonical ROI (frame-1110 px)
C = json.load(open(f'{S}/rd/data/s11_calib.json'))
src = cv2.imread(f'{S}/png/f1110.png').astype(np.float32)
O = cv2.resize(src[Y0:Y1, X0:X1], None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
H, W = O.shape[:2]
def P(x, y): return (x - X0) * K, (y - Y0) * K          # canonical px -> ROI array px
SOFT = 0.5                                               # O's own text softness (calibration)
def text_alpha(runs):
    """runs: list of (text, weight, size, x, base[, letter-spacing]). returns alpha maps (ROI size) and advances."""
    items = [dict(text=r[0], weight=r[1], size=r[2], W=X1 - X0, H=Y1 - Y0, x=r[3] - X0, base=r[4] - Y0, ls=(r[5] if len(r) > 5 else 0)) for r in runs]
    out = render(items, K)
    return [(cv2.GaussianBlur(a, (0, 0), SOFT * K), adv) for a, adv in out]
def adv(t, w, s): return render([dict(text=t, weight=w, size=s, W=50, H=20, x=0, base=15)], 1)[0][1]
NEW = 'Dr. Imran Hussain'; OLD = 'Dr Abhishek Shukla'; MAIL = 'dr.imranhussain@example.com'
cr, nm, ml, ab = C['crumb'], C['name'], C['mail'], C['about']
crumb_w, crumb_s = cr[1], cr[2]; cx0 = cr[4] + adv('Home > Doctors > ', crumb_w, crumb_s)
d_name = adv(NEW, nm[1], nm[2]) - adv(OLD, nm[1], nm[2])
d_about = adv(NEW, ab[1], ab[2]) - adv(OLD, ab[1], ab[2])
old_end_name = nm[4] + adv(OLD, nm[1], nm[2]); old_end_about = ab[4] + adv(OLD, ab[1], ab[2])
print('crumb seg x', round(cx0, 1), 'd_name', round(d_name, 2), 'd_about', round(d_about, 2))
olds = text_alpha([(OLD, crumb_w, crumb_s, cx0, cr[5]), (OLD, nm[1], nm[2], nm[4], nm[5]),
                   ('abhishekshukla4@gmail.com', ml[1], ml[2], ml[4], ml[5]), (OLD, ab[1], ab[2], ab[4], ab[5])])
# About line: "Dr. Imran Hussain" fills the old name's exact advance (light tracking + slightly wider word gaps),
# so the rest of the sentence stays where it is
LS_AB = 0.4
_w = [adv(t, ab[1], ab[2]) + len(t) * LS_AB for t in ('Dr.', 'Imran', 'Hussain')]
_gap = (adv(OLD, ab[1], ab[2]) - sum(_w)) / 2
about_runs = [(NEW, ab[1], ab[2], ab[4], ab[5])]   # natural spacing; the rest of the line slides to follow
print('about word gap', round(_gap, 2), 'normal space', round(adv('a b', ab[1], ab[2]) - adv('ab', ab[1], ab[2]), 2))
news = text_alpha([(NEW, crumb_w, crumb_s, cx0, cr[5]),
                   ('Dr.', nm[1], nm[2], nm[4], nm[5]), ('Imran Hussain', nm[1], nm[2], nm[4] + adv('Dr. ', nm[1], nm[2]), nm[5]),
                   (MAIL, ml[1], ml[2], ml[4], ml[5])] + about_runs)
def dil(m, r): return cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0
# regions holding moved original text (credentials after the name, rest of About line 1)
def rect(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); a, b = P(x0, y0); c, d = P(x1, y1); m[int(b):int(d), int(a):int(c)] = True; return m
cred = rect(old_end_name + 1, 457, 1343, 476)
rest = rect(old_end_about + 0.5, 674, X1, 690)
gray = O.mean(2)
# ink of the moved strips = pixels darker/different than the local card background
kill = np.zeros((H, W), bool)
for a, _ in olds: kill |= dil(a > 0.03, 2 * K)
kill |= cred | rest
kill |= rect(721.5, 391.5, 868.5, 606.5)                 # photo slot -> plain card under it
F = harmonic_fill(O.copy(), kill)       # clean background under all edited text
E = F.copy()
def shifted(region, dx):
    M = np.float32([[1, 0, dx * K], [0, 1, 0]])
    D = (O - F) * region[..., None]
    return cv2.warpAffine(D, M, (W, H), flags=cv2.INTER_CUBIC)
E += shifted(cred, d_name) + shifted(rest, d_about)
# ink colours: regress O against old alpha on each element (O = F + a*(ink - F))
def ink(a):
    # least squares for O = F + a * (ink - F) over the element's pixels
    m = a > 0.01; aa = a[m][:, None]
    return (F[m] + ((aa * (O[m] - F[m])).sum(0) / (aa * aa).sum())).mean(0) if False else \
           np.median(F[m], axis=0) + (aa * (O[m] - F[m])).sum(0) / (aa * aa).sum()
old_ink = [ink(a) for a, _ in olds]
# the name's "Dr" is lighter than the surname: sample both parts
ny = P(0, nm[5])[1]
dr_m = olds[1][0].copy(); dr_m[:, int(P(nm[4] + adv('Dr ', nm[1], nm[2]), 0)[0]):] = 0
sur_m = olds[1][0].copy(); sur_m[:, :int(P(nm[4] + adv('Dr ', nm[1], nm[2]), 0)[0])] = 0
dr_ink, sur_ink = ink(dr_m), ink(sur_m)
print('inks', [np.round(c).tolist() for c in old_ink], 'Dr', np.round(dr_ink).tolist(), 'surname', np.round(sur_ink).tolist())
cols = [old_ink[0], dr_ink, sur_ink, old_ink[2], old_ink[3]]
for (a, _), c in zip(news, cols):
    E = E * (1 - a[..., None]) + c[None, None, :] * a[..., None]
# ---- photo
PX0, PY0, PX1, PY1, PR = 725.5, 395.5, 864.5, 602.5, 8.0
u = cv2.imread(f'{S}/rd/assets_user/imran_src.png').astype(np.float32)
s = 0.150 * K; ex, ey = 517, 600                          # eye midpoint in the source photo
tx, ty = P(PX0 + 63.5, PY0 + 63.0)                        # where the eyes sit in the original slot
A = np.float32([[s, 0, tx - s * ex], [0, s, ty - s * ey]])
pu = cv2.warpAffine(cv2.GaussianBlur(u, (0, 0), 0.5 / s), A, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
# grade toward the original photo: neutral light-grey backdrop, slightly softer contrast
bg_src = np.array([206., 206., 204.])
lum = pu.mean(2, keepdims=True)
wbg = np.clip((lum - 225) / 25, 0, 1)                    # near-white studio backdrop and shirt highlights
pu = pu * (1 - 0.85 * wbg) + (bg_src * 1.07) * 0.85 * wbg
mu = pu.mean(2, keepdims=True); pu = mu + (pu - mu) * 0.88
pu = (pu - 128) * 0.92 + 128 + 4
pu = cv2.GaussianBlur(pu, (0, 0), 0.9 * K)
pm = np.zeros((H, W), np.float32)
a0, b0 = P(PX0, PY0); a1, b1 = P(PX1, PY1)
cv2.rectangle(pm, (int(a0 + PR * K), int(b0)), (int(a1 - PR * K), int(b1)), 1, -1)
cv2.rectangle(pm, (int(a0), int(b0 + PR * K)), (int(a1), int(b1 - PR * K)), 1, -1)
for cx, cy in ((a0 + PR * K, b0 + PR * K), (a1 - PR * K, b0 + PR * K), (a0 + PR * K, b1 - PR * K), (a1 - PR * K, b1 - PR * K)):
    cv2.circle(pm, (int(cx), int(cy)), int(PR * K), 1, -1, cv2.LINE_AA)
pm = cv2.GaussianBlur(pm, (0, 0), 1.6 * K)
pm = np.clip((pm - 0.5) * 1.0 + 0.5, 0, 1)
E = E * (1 - pm[..., None]) + pu * pm[..., None]
# the photo in the original is soft-edged: the cover must reach a bit past its edge
changed = (np.abs(E - O).max(2) > 3)
RECTS = {'crumb': (838, 281, 1000, 304), 'name': (894, 454.5, 1344, 478), 'mail': (921.5, 557, 1112, 580),
         'about': (703, 673.5, 1366, 691), 'photo': (721.5, 391.5, 868.5, 606.5)}
np.savez_compressed(f'{S}/rd/data/s11_edit.npz', O=O.astype(np.float32), E=E.astype(np.float32), F=F.astype(np.float32), changed=changed, rects=json.dumps(RECTS),
                    roi=np.array([X0, Y0, X1, Y1, K]))
cv2.imwrite(f'{S}/rd/review/s11/edit_O.png', np.clip(O, 0, 255).astype(np.uint8))
cv2.imwrite(f'{S}/rd/review/s11/edit_E.png', np.clip(E, 0, 255).astype(np.uint8))

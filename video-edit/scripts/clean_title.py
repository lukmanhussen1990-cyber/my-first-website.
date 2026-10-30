"""Remove the baked-in name title from shot 1 frames 0-251 region by motion-compensated patching.
For each frame k that shows title pixels, warp clean frame s=k+OFF into frame k's geometry,
match colour (per-channel gain+offset fitted on a ring just outside the patch), feather-blend.
Writes work/shot1_clean.rgb (frames FIRST..LAST only) and prints seam/flicker metrics."""
import numpy as np, cv2, sys
W, H = 1920, 1080
v = np.fromfile("work/shot1.rgb", dtype=np.uint8).reshape(-1, H, W, 3)
A = np.load("work/shot1_A.npy")
FIRST, LAST, OFF = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
X0, X1, Y0, Y1 = 60, 840, 818, 1012          # patch box (title is x97-764, y850-983)
FE = 22                                        # feather width
box = np.zeros((H, W), np.float32); box[Y0:Y1, X0:X1] = 1
alpha = cv2.GaussianBlur(box, (0, 0), FE / 2.5)
alpha = np.clip((alpha - 0.02) / 0.96, 0, 1)
inner = cv2.GaussianBlur(box, (0, 0), FE / 2.5) > 0.98
ring = (cv2.dilate(box, np.ones((61, 61))) > 0) & ~(box > 0)
ring[:, 880:] = False                          # keep the speaker's leg out of the colour fit
out = []
for k in range(FIRST, LAST + 1):
    s = k + OFF
    M = A[k] @ np.linalg.inv(A[s])
    w = cv2.warpPerspective(v[s], M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT).astype(np.float32)
    f = v[k].astype(np.float32)
    for c in range(3):                         # least-squares gain/offset on the ring
        x = w[..., c][ring]; y = f[..., c][ring]
        g, o = np.polyfit(x, y, 1)
        w[..., c] = w[..., c] * g + o
    tw = min(1.0, max(0.0, (k - 20) / 7)) * min(1.0, max(0.0, (137 - k) / 7))   # temporal ramp in/out (title on frames 27-130)
    a = alpha[..., None] * tw
    res = f * (1 - a) + w * a
    out.append(np.clip(res + 0.5, 0, 255).astype(np.uint8))
out = np.array(out)
out.tofile("work/shot1_clean.rgb")
# metrics: seam = mean |grad| across the feather band vs elsewhere; flicker = temporal diff in patch vs outside
band = (alpha > 0.05) & (alpha < 0.95)
L = out.astype(np.float32).mean(-1)
tdiff_in = np.abs(np.diff(L, axis=0))[:, inner].mean()
outside = np.zeros((H, W), bool); outside[Y0-80:Y0-30, X0:X1] = True
tdiff_out = np.abs(np.diff(L, axis=0))[:, outside].mean()
print("frames", FIRST, LAST, "temporal |dL| inside patch %.2f  outside %.2f" % (tdiff_in, tdiff_out))
# residual title pixels: brightness > 150 inside title zone
print("max bright px in title zone after clean:", max(int((L[i][850:984, 97:765] > 150).sum()) for i in range(len(L))))

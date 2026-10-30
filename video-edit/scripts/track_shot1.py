"""Track the slow camera push-in in shot 1 (frames 0-251) using background features only.
Saves work/shot1_A.npy: A[n] = 3x3 matrix mapping frame-0 pixel coords -> frame-n pixel coords."""
import numpy as np, cv2
W, H = 1920, 1080
v = np.fromfile("work/shot1.rgb", dtype=np.uint8).reshape(-1, H, W, 3)
N = len(v)
mask = np.full((H, W), 255, np.uint8)
mask[:, 680:1320] = 0          # speaker (head, hands, legs, chair)
mask[800:1010, 40:860] = 0     # title zone (never track the overlay)
gray = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in v]
A = [np.eye(3)]
for n in range(1, N):
    p0 = cv2.goodFeaturesToTrack(gray[n-1], 1500, 0.005, 12, mask=mask, blockSize=9)
    p1, st, err = cv2.calcOpticalFlowPyrLK(gray[n-1], gray[n], p0, None, winSize=(31, 31), maxLevel=4)
    ok = st.ravel() == 1
    M, inl = cv2.estimateAffinePartial2D(p0[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=1.0, maxIters=5000)
    A.append(np.vstack([M, [0, 0, 1]]) @ A[-1])
A = np.array(A)
np.save("work/shot1_A.npy", A)
for n in [25, 50, 100, 131, 167, 251]:
    s = np.sqrt(abs(np.linalg.det(A[n][:2, :2])))
    print(n, "scale %.4f  tx %.2f ty %.2f" % (s, A[n][0, 2], A[n][1, 2]))
# validate: warp frame 0 into frame n geometry and compare background
for n in [100, 251]:
    w = cv2.warpPerspective(v[0], A[n], (W, H), flags=cv2.INTER_CUBIC)
    d = np.abs(w.astype(float) - v[n]).mean(-1)
    sel = (mask > 0); sel[:40] = False; sel[-40:] = False; sel[:, :40] = False; sel[:, -40:] = False
    d0 = np.abs(v[0].astype(float) - v[n]).mean(-1)
    print(n, "bg mean abs diff: unwarped %.2f  warped %.2f" % (d0[sel].mean(), d[sel].mean()))

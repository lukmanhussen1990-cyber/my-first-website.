import cv2, numpy as np

def pushpull_fill(patch, unknown, gs_iters=120):
    """Smoothly interpolate `patch` across `unknown` pixels.

    Outside `unknown` the result equals `patch` exactly, so a region composited
    with this background has no visible seam. Inside, it is a harmonic-ish fill
    built from a Gaussian pyramid (push-pull) and refined with Gauss-Seidel.
    """
    p = patch.astype(np.float32)
    if p.ndim == 2:
        p = p[:, :, None]
    k = (~unknown).astype(np.float32)

    pyr = [(p * k[:, :, None], k)]
    while min(pyr[-1][1].shape[:2]) > 4:
        a, b = pyr[-1]
        pyr.append((cv2.pyrDown(a), cv2.pyrDown(b)))

    est = None
    for a, b in reversed(pyr):
        if a.ndim == 2:
            a = a[:, :, None]
        den = b[:, :, None] + 1e-6
        cur = a / den
        valid = (b > 1e-4)[:, :, None]
        if est is not None:
            up = cv2.resize(est, (cur.shape[1], cur.shape[0]), interpolation=cv2.INTER_LINEAR)
            if up.ndim == 2:
                up = up[:, :, None]
            cur = np.where(valid, cur, up)
        est = cur

    u = np.where(unknown[:, :, None], est, p).astype(np.float32)
    # Gauss-Seidel/Jacobi smoothing so the fill is harmonic and boundary-exact
    m3 = unknown[:, :, None]
    for _ in range(gs_iters):
        lap = cv2.GaussianBlur(u, (0, 0), 1.0)
        u = np.where(m3, lap, p)
    return u if patch.ndim == 3 else u[:, :, 0]

import cv2, numpy as np, scipy.sparse as sp, scipy.sparse.linalg as spla
S = '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad'

def load(i):
    """Lossless reference frame i (1-based) as float32 RGB 0..255."""
    return cv2.cvtColor(cv2.imread(f'{S}/png/f{i:04d}.png'), cv2.COLOR_BGR2RGB).astype(np.float32)

def save(path, img):
    cv2.imwrite(path, cv2.cvtColor(np.clip(img + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))

def harmonic_fill(img, mask):
    """Fill mask==True pixels of img (H,W,C) with the solution of Laplace's equation
    whose boundary values come from the surrounding unmasked pixels."""
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return img.copy()
    y0, y1 = max(ys.min() - 1, 0), min(ys.max() + 2, H)
    x0, x1 = max(xs.min() - 1, 0), min(xs.max() + 2, W)
    m = mask[y0:y1, x0:x1]
    sub = img[y0:y1, x0:x1].reshape(m.shape + (-1,))
    h, w = m.shape
    idx = -np.ones((h, w), np.int64)
    n = int(m.sum())
    idx[m] = np.arange(n)
    rows, cols, vals = [], [], []
    b = np.zeros((n, sub.shape[2]), np.float64)
    my, mx = np.nonzero(m)
    k = idx[my, mx]
    diag = np.zeros(n)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny, nx = my + dy, mx + dx
        inside = (ny >= 0) & (ny < h) & (nx >= 0) & (nx < w)
        diag[inside] += 1
        nyi, nxi, ki = ny[inside], nx[inside], k[inside]
        nb_masked = m[nyi, nxi]
        rows.append(ki[nb_masked]); cols.append(idx[nyi[nb_masked], nxi[nb_masked]]); vals.append(-np.ones(nb_masked.sum()))
        np.add.at(b, ki[~nb_masked], sub[nyi[~nb_masked], nxi[~nb_masked]])
    rows.append(np.arange(n)); cols.append(np.arange(n)); vals.append(diag)
    A = sp.csc_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n))
    sol = spla.splu(A).solve(b)
    out = img.copy()
    o = out[y0:y1, x0:x1].reshape(m.shape + (-1,))
    o[m] = sol
    out[y0:y1, x0:x1] = o.reshape(out[y0:y1, x0:x1].shape)
    return out

def gblur(img, sigma):
    if sigma <= 0.05:
        return img
    k = int(np.ceil(sigma * 3.5)) * 2 + 1
    return cv2.GaussianBlur(img, (k, k), sigma, borderType=cv2.BORDER_CONSTANT)

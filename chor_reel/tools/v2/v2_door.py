"""Shot 3 + flash (frames 282-355): push-in on the house door (the Kerala video's own push-in and
door-opening animation, re-lit for night), the thief walks up, the doors open onto warm lamplight."""
import os, sys, math, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L

S = L.S
W, H = 1080, 1920
TRK = {int(k): v for k, v in json.load(open(S + '/v2/door/door_tm.json')).items()}
DW, DH = 134.0, 163.0                    # door template size at s = 1 (frame 86)
_cap = None
_IDLE = None


def src_frame(sf):
    global _cap
    if _cap is None:
        _cap = cv2.VideoCapture(L.BSRC)
    _cap.set(cv2.CAP_PROP_POS_FRAMES, int(sf))
    return _cap.read()[1]


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def src_index(n):
    """our frame -> Kerala-video frame (float): the painted push-in 30..99 over n 282..326, then held."""
    return 30 + ease((n - 282) / 44.0) * (99 - 30)


def door_box(sf):
    """(x, y, w, h) of the door in source pixels; extrapolated past frame 99 (camera keeps pushing)."""
    k = int(np.floor(sf))
    if k <= 99:
        a, b = TRK[min(k, 99)], TRK[min(k + 1, 99)]
        t = sf - k
        s = a['s'] * (1 - t) + b['s'] * t
        x = a['x'] * (1 - t) + b['x'] * t
        y = a['y'] * (1 - t) + b['y'] * t
    else:
        a, b = TRK[98], TRK[99]
        g = b['s'] / a['s']
        s = b['s'] * g ** (sf - 99)
        cxb, cyb = b['x'] + DW * b['s'] / 2, b['y'] + DH * b['s'] / 2
        x, y = cxb - DW * s / 2, cyb - DH * s / 2
    return x, y, DW * s, DH * s


def idle():
    global _IDLE
    if _IDLE is None:
        arr = np.load(S + '/assets/v2char/idle.npz')['rgba']
        al = arr[..., 3].max(axis=0) > 60
        ys, xs = np.where(al)
        _IDLE = (arr, dict(top=ys.min(), bot=ys.max(), h=ys.max() - ys.min(), cx=float(np.median(xs[ys > ys.max() - 40]))))
    return _IDLE


def man_u(n):
    """man position in door widths from the door's left edge (0.5 = centre of the doorway)"""
    if n < 314:
        return 2.7 + (1.12 - 2.7) * (1 - (1 - (n - 282) / 32.0) ** 1.6)
    if n < 327:
        return 1.12
    return 1.12 + (0.5 - 1.12) * ease((n - 327) / 11.0)


def render(n):
    sf = src_index(n)
    f0 = src_frame(int(round(sf)))
    dx, dy, dw, dh = door_box(sf)
    step_k = ease((n - 327) / 11.0)
    cx = dx + dw / 2 + 0.33 * dw * (1 - step_k)
    x0 = float(np.clip(cx - 135, 0, 656 - 270))
    crop = f0[:, int(round(x0)):int(round(x0)) + 270]
    U = L.f32(L.up(crop, 4.0))[:H, :W]
    N = L.night(U, exposure=1.08, sat=0.55)
    lum = U.mean(axis=2, keepdims=True)
    img = N + np.clip((lum - 0.62) / 0.25, 0, 1) * np.array([0.10, 0.07, 0.06], np.float32)[None, None]
    X, Y, DWs, DHs = (dx - x0) * 4, dy * 4, dw * 4, dh * 4
    ix0, iy0, ix1, iy1 = int(round(X)), int(round(Y)), int(round(X + DWs)), int(round(Y + DHs))
    k = ease((n - 315) / 12.0)                                    # doors swing open
    if k > 0:
        cx0, cy0, cx1, cy1 = max(0, ix0), max(0, iy0), min(W, ix1), min(H, iy1)
        leafL = img[cy0:cy1, cx0:(cx0 + cx1) // 2].copy()
        leafR = img[cy0:cy1, (cx0 + cx1) // 2:cx1].copy()
        bw, bh = cx1 - cx0, cy1 - cy0
        yy, xx = np.mgrid[0:bh, 0:bw].astype(np.float32)
        core = np.exp(-(((xx - bw / 2) / (bw * 0.45)) ** 2 + ((yy - bh * 0.55) / (bh * 0.75)) ** 2))
        light = (np.array([0.42, 0.66, 0.92], np.float32)[None, None] * (0.72 + 0.55 * core[..., None])
                 + np.array([0.35, 0.30, 0.10], np.float32)[None, None] * core[..., None] ** 3)
        img[cy0:cy1, cx0:cx1] = light
        sq = 1 - 0.86 * k                                         # leaves foreshorten toward their hinges
        lw = max(2, int(leafL.shape[1] * sq))
        rw = max(2, int(leafR.shape[1] * sq))
        shadeL = 0.85 - 0.3 * k
        img[cy0:cy1, cx0:cx0 + lw] = cv2.resize(leafL, (lw, bh), interpolation=cv2.INTER_AREA) * shadeL
        img[cy0:cy1, cx1 - rw:cx1] = cv2.resize(leafR, (rw, bh), interpolation=cv2.INTER_AREA) * shadeL
        door_m = np.zeros((H, W), np.float32)
        door_m[cy0:cy1, cx0 + lw:cx1 - rw] = 1.0
        L.add_glow(img, door_m, (0.10, 0.40, 0.85), max(20, DWs * 0.22), 0.9 * k)
        L.add_glow(img, door_m, (0.05, 0.20, 0.50), max(40, DWs * 0.7), 0.8 * k)
        pool = L.radial(H, W, X + DWs / 2, Y + DHs * 1.05, DWs * 0.9, DHs * 0.13)
        img = L.warm_light(img, pool, strength=0.9 * k)
    seam_k = 1 - k
    if seam_k > 0:
        seam = np.zeros((H, W), np.float32)
        cv2.line(seam, (int(X + DWs / 2), int(Y + DHs * 0.04)), (int(X + DWs / 2), int(Y + DHs * 0.98)), 1.0, max(2, int(DWs * 0.02)))
        cv2.line(seam, (int(X + DWs * 0.05), int(Y + DHs)), (int(X + DWs * 0.95), int(Y + DHs)), 0.8, max(2, int(DWs * 0.02)))
        img += seam[..., None] * np.array([0.25, 0.62, 1.0], np.float32) * seam_k
        L.add_glow(img, seam, (0.06, 0.25, 0.65), max(8, DWs * 0.05), 1.2 * seam_k)
    tl_x, tl_y = X + DWs * 0.5, Y + DHs * 1.30
    if tl_y < H - 10:
        L.flame(img, tl_x, tl_y, max(12, DWs * 0.07), n, seed=3, gain=1.0)
    img *= L.paper(H, W)
    # the thief
    arr, g = idle()
    walking = n < 314 or 327 <= n < 338
    i = (n // 3) % (2 * len(arr) - 2)
    i = i if i < len(arr) else 2 * len(arr) - 2 - i
    man_h = DHs * 0.82
    sc = man_h / g['h']
    mx = X + DWs * man_u(n)
    bob = abs(math.sin(n / 7.5 * math.pi)) * 0.018 * man_h if walking else 0.0
    my = Y + DHs * 1.03 - bob
    M = np.array([[sc, 0, mx - sc * g['cx']], [0, sc, my - sc * g['bot']]])
    back = step_k                                                  # backlit when standing in the doorway
    pm = L.lit_sprite(arr[i], exposure=1.30 + 0.35 * k - 0.45 * back, sat=1.0,
                      warm=((0.02, 0.10, 0.22), 0.6 + 1.0 * k * (1 - back)),
                      rims=[(-5, -2, (0.25, 0.65, 1.0), 0.4 + 1.2 * k), (4, -3, (0.55, 0.45, 0.42), 0.5 * (1 - back)),
                            (5, 0, (0.25, 0.65, 1.0), 1.4 * back), (0, -5, (0.25, 0.65, 1.0), 1.2 * back)])
    wpm, box = L.place_roi(img, pm, M)
    if wpm is not None:
        bx0, by0, bx1, by1 = box
        a = np.clip(wpm[..., 3:4], 0, 1)
        img[by0:by1, bx0:bx1] = img[by0:by1, bx0:bx1] * (1 - a) + wpm[..., :3]
    # digital push-in continues after the painted push-in ends
    z = 1.0 + 0.40 * ease((n - 326) / 16.0) ** 1.2
    if z > 1.0001:
        zc = (X + DWs / 2, Y + DHs * 0.62)
        Mz = np.array([[z, 0, zc[0] - z * zc[0]], [0, z, zc[1] - z * zc[1]]], np.float32)
        img = cv2.warpAffine(img, Mz, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return img


_FLASH = {341: 61.4, 342: 79.0, 343: 104.7, 344: 129.4, 345: 153.9, 346: 177.0, 347: 193.0, 348: 202.0,
          349: 201.3, 350: 191.9, 351: 172.2, 352: 146.2, 353: 116.5, 354: 85.9, 355: 62.0}


def flash_k(n):
    """0..1 whiteness of the transition flash (original film's measured curve)."""
    if n not in _FLASH:
        return 0.0
    return float(np.clip((_FLASH[n] - 56.8) / (202.0 - 56.8), 0, 1))


FLASH_COL = np.array([0.80, 0.93, 1.0], np.float32)


if __name__ == '__main__':
    od = S + '/v2/look'
    for n in [int(v) for v in sys.argv[1].split(',')]:
        img = render(min(n, 341))
        k = flash_k(n)
        img = img * (1 - k) + FLASH_COL * k
        cv2.imwrite(f'{od}/door_{n:04d}.jpg', L.u8(img), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('ok', n, flush=True)

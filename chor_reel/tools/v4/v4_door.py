"""v4 shot 3 (frames 282-355), 16:9: the painted push-in on the front door (Kerala video), the lawn replaced by the
river, ghat steps and the moored boat. The cosmic thief glides up the steps, the doors swing open into lamplight
and he stands in the doorway, then the white flash."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v2_door as D2
import v3_beats as B
import v4_open as O
import v4_thief as TH

S = L.S
W, H = 1920, 1080
FLASH_COL = D2.FLASH_COL
flash_k = D2.flash_k
UPS = W / 656.0                                    # source -> output scale (2.93)


def src_index(n):
    return 30 + B.ease((n - 282) / 44.0) * (99 - 30)


def river_below(img, n, X, Y, DWs, DHs):
    k = DHs / 300.0
    bank = int(Y + DHs * 1.16)
    if bank >= H:
        return img, bank
    cx = X + DWs / 2
    wat = O.water_rows(H - bank, W, 0.0, n, max(0.7, 1.4 * k))
    img[bank:] = wat
    stone = np.array([0.27, 0.22, 0.22], np.float32)
    edge = (0.09, 0.06, 0.06)
    sh = 30 * k
    for j in range(6):
        y0 = bank + j * sh
        if y0 > H:
            break
        hw = DWs * (0.95 + 0.16 * j)
        a = np.array([(cx - hw, y0), (cx + hw, y0), (cx + hw, y0 + sh), (cx - hw, y0 + sh)], np.float32)
        cv2.fillPoly(img, [a.astype(np.int32)], tuple(float(v) for v in stone * (0.98 - 0.07 * j)), cv2.LINE_AA)
        cv2.line(img, (int(cx - hw), int(y0)), (int(cx + hw), int(y0)), (0.42, 0.37, 0.36), max(1, int(2 * k)), cv2.LINE_AA)
        cv2.polylines(img, [a.astype(np.int32)], True, edge, max(1, int(2 * k)), cv2.LINE_AA)
    cv2.rectangle(img, (0, bank - int(4 * k)), (W, bank + int(10 * k)), tuple(float(v) for v in stone * 0.8), -1)
    cv2.line(img, (0, bank - int(4 * k)), (W, bank - int(4 * k)), (0.40, 0.35, 0.34), max(1, int(2 * k)), cv2.LINE_AA)
    b, deck, wl, lan, _ = L.boat_sprite(Lb=430) if not hasattr(river_below, 'boat') else river_below.boat
    river_below.boat = (b, deck, wl, lan, None)
    bs = 1.3 * k
    bx = cx + DWs * 2.3
    by = bank + 4.0 * sh + 4 * math.sin(n * 0.11)
    M = cv2.getRotationMatrix2D((b.shape[1] / 2, wl), 0.6 * math.sin(n * 0.09), bs)
    M[0, 2] += bx - b.shape[1] / 2
    M[1, 2] += by - wl
    wpm, box = L.place_roi(img, np.dstack([b[..., :3] * b[..., 3:4], b[..., 3:4]]), M)
    if wpm is not None:
        x0, y0, x1, y1 = box
        a = np.clip(wpm[..., 3:4], 0, 1)
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + wpm[..., :3]
    lan_s = M @ np.array([lan[0], lan[1] + 10, 1.0])
    L.flame(img, lan_s[0], lan_s[1] + 6 * bs, 15 * bs, n, seed=9, gain=1.0)
    return img, bank


def man_path(n, X, Y, DWs, DHs, bank):
    """hem position and height factor: up the steps, beside the door, then into the doorway"""
    cx = X + DWs / 2
    if n < 314:
        t = B.ease((n - 282) / 32.0)
        x = cx + DWs * (1.30 - 0.12 * t)
        y = (bank + 3.6 * 30 * DHs / 300.0) * (1 - t) + (Y + DHs * 1.03) * t
        return x, y, 1.10 - 0.10 * t, True
    if n < 327:
        return cx + DWs * 1.18, Y + DHs * 1.03, 1.0, False
    t = B.ease((n - 327) / 11.0)
    return cx + DWs * 1.18 * (1 - t), Y + DHs * 1.03, 1.0, n < 338


def render(n):
    sf = src_index(n)
    f0 = D2.src_frame(int(round(sf)))
    dx, dy, dw, dh = D2.door_box(sf)
    y0s = float(np.clip(dy + dh * 0.55 - 369 * 0.48, 0, 480 - 369))
    crop = f0[int(round(y0s)):int(round(y0s)) + 369, :]
    U = L.f32(L.up(crop, UPS))[:H, :W]
    if U.shape[0] < H or U.shape[1] < W:
        U = cv2.resize(U, (W, H), interpolation=cv2.INTER_LINEAR)
    N = L.night(U, exposure=1.08, sat=0.55)
    lum = U.mean(axis=2, keepdims=True)
    img = N + np.clip((lum - 0.62) / 0.25, 0, 1) * np.array([0.10, 0.07, 0.06], np.float32)[None, None]
    X, Y, DWs, DHs = dx * UPS, (dy - y0s) * UPS, dw * UPS, dh * UPS
    img, bank = river_below(img, n, X, Y, DWs, DHs)
    ix0, iy0, ix1, iy1 = int(round(X)), int(round(Y)), int(round(X + DWs)), int(round(Y + DHs))
    k = B.ease((n - 315) / 12.0)
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
        sq = 1 - 0.86 * k
        lw, rw = max(2, int(leafL.shape[1] * sq)), max(2, int(leafR.shape[1] * sq))
        img[cy0:cy1, cx0:cx0 + lw] = cv2.resize(leafL, (lw, bh), interpolation=cv2.INTER_AREA) * (0.85 - 0.3 * k)
        img[cy0:cy1, cx1 - rw:cx1] = cv2.resize(leafR, (rw, bh), interpolation=cv2.INTER_AREA) * (0.85 - 0.3 * k)
        door_m = np.zeros((H, W), np.float32)
        door_m[cy0:cy1, cx0 + lw:cx1 - rw] = 1.0
        L.add_glow(img, door_m, (0.10, 0.40, 0.85), max(20, DWs * 0.22), 0.9 * k)
        L.add_glow(img, door_m, (0.05, 0.20, 0.50), max(40, DWs * 0.7), 0.8 * k)
        img = L.warm_light(img, L.radial(H, W, X + DWs / 2, Y + DHs * 1.08, DWs * 1.2, DHs * 0.25), strength=0.9 * k)
    if k < 1:
        seam = np.zeros((H, W), np.float32)
        cv2.line(seam, (int(X + DWs / 2), int(Y + DHs * 0.04)), (int(X + DWs / 2), int(Y + DHs * 0.98)), 1.0, max(2, int(DWs * 0.02)))
        cv2.line(seam, (int(X + DWs * 0.05), int(Y + DHs)), (int(X + DWs * 0.95), int(Y + DHs)), 0.8, max(2, int(DWs * 0.02)))
        img += seam[..., None] * np.array([0.25, 0.62, 1.0], np.float32) * (1 - k)
        L.add_glow(img, seam, (0.06, 0.25, 0.65), max(8, DWs * 0.05), 1.2 * (1 - k))
    img *= L.paper(H, W)
    # the cosmic thief
    mx, my, size, moving = man_path(n, X, Y, DWs, DHs, bank)
    th = DHs * 0.88 * size
    sc = th / 1000.0
    ppu = round(sc, 3)
    st = dict(arm=TH.POSES['down'], sway=(-12 if moving else 0) + 4 * math.sin(n * 0.05), ripple=1.8 if moving else 0.8,
              flare=0.6 * k)
    pm, glow, A, an = TH.render(n, st, ppu)
    U2S = np.array([[sc, 0, mx], [0, sc, my + 3 * math.sin(n * 0.12)], [0, 0, 1]], np.float64)
    M = (U2S @ np.vstack([A, [0, 0, 1]]))[:2]
    TH.place(img, pm, glow, M)
    z = 1.0 + 0.40 * B.ease((n - 326) / 16.0) ** 1.2
    if z > 1.0001:
        zc = (X + DWs / 2, Y + DHs * 0.62)
        Mz = np.array([[z, 0, zc[0] - z * zc[0]], [0, z, zc[1] - z * zc[1]]], np.float32)
        img = cv2.warpAffine(img, Mz, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return img


if __name__ == '__main__':
    od = S + '/v4/look'
    os.makedirs(od, exist_ok=True)
    for n in [int(v) for v in sys.argv[1].split(',')]:
        img = render(min(n, 341))
        kf = flash_k(n)
        img = img * (1 - kf) + FLASH_COL * kf
        cv2.imwrite(f'{od}/door_{n:04d}.jpg', L.u8(img), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('ok', n, flush=True)

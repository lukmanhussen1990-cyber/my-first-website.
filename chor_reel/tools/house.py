"""Upgraded lakeside house, drawn as flat night-time layers in the frame-200 reference coordinates
of the original film (window bbox 68..168 x 220..335, door 298..376 x 257..422, facade -8..429 x 152..423).

Layers (BGR float32 0..1 at SC x reference scale, origin X0,Y0):
  base_rgb/base_a  : facade, roof, chimney, awning, surrounds, plants, lantern body, platform texture
  door_rgb/door_a  : wooden door leaves (faded out when the original door opens)
  glow_static      : additive warm light (lantern, window spill on the facade)
  glow_door        : additive warm spill around the door when it is open
Holes are left for the window glass and the door opening so the original animation shows through.
"""
import numpy as np, cv2

SC = 3
X0, Y0, X1, Y1 = -80, 20, 720, 490
W, H = (X1 - X0) * SC, (Y1 - Y0) * SC
SHIFT = 4  # sub-pixel bits for cv2 drawing


def P(x, y):
    return [int(round((x - X0) * SC * (1 << SHIFT))), int(round((y - Y0) * SC * (1 << SHIFT)))]


def poly(img, pts, col, a_img=None, a=1.0):
    p = np.array([P(x, y) for x, y in pts], np.int32)
    cv2.fillPoly(img, [p], col, cv2.LINE_AA, SHIFT)
    if a_img is not None:
        cv2.fillPoly(a_img, [p], a, cv2.LINE_AA, SHIFT)


def line(img, p0, p1, col, w=1.0, a_img=None, a=1.0):
    t = max(1, int(round(w * SC)))
    cv2.line(img, tuple(P(*p0)), tuple(P(*p1)), col, t, cv2.LINE_AA, SHIFT)
    if a_img is not None:
        cv2.line(a_img, tuple(P(*p0)), tuple(P(*p1)), a, t, cv2.LINE_AA, SHIFT)


def circle(img, c, r, col, a_img=None, a=1.0, thick=-1):
    cc = tuple(P(*c)); rr = int(round(r * SC * (1 << SHIFT)))
    t = -1 if thick < 0 else max(1, int(round(thick * SC)))
    cv2.circle(img, cc, rr, col, t, cv2.LINE_AA, SHIFT)
    if a_img is not None:
        cv2.circle(a_img, cc, rr, a, t, cv2.LINE_AA, SHIFT)


def arch_pts(x0, x1, y_spring, y_bot, n=40, grow=0.0):
    """Arched opening: semicircle on top of a rectangle."""
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2 + grow
    pts = [(x0 - grow, y_bot + grow)]
    for k in range(n + 1):
        th = np.pi - np.pi * k / n
        pts.append((cx + r * np.cos(th), y_spring - r * np.sin(th)))
    pts.append((x1 + grow, y_bot + grow))
    return pts


def mask_of(pts):
    m = np.zeros((H, W), np.float32)
    poly(m, pts, 1.0)
    return m


def rgb(b, g, r):
    return (b / 255.0, g / 255.0, r / 255.0)


def noise(shape, scale, seed):
    rng = np.random.default_rng(seed)
    h, w = shape
    small = rng.standard_normal((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)


def build():
    base = np.zeros((H, W, 3), np.float32)
    a = np.zeros((H, W), np.float32)
    LINE = rgb(120, 92, 96)          # thin light outline (original's line-art style), used at low alpha

    # ---- chimney (behind the roof slope) ----
    poly(base, [(292, 60), (318, 60), (318, 112), (292, 112)], rgb(30, 22, 26), a)
    for yy in range(66, 108, 7):
        line(base, (292, yy), (318, yy), rgb(22, 16, 19), 0.6)
    poly(base, [(287, 53), (323, 53), (323, 60), (287, 60)], rgb(40, 30, 34), a)
    line(base, (287, 53), (323, 53), rgb(70, 58, 66), 0.7)

    # ---- facade ----
    fac = [(-8, 152), (429, 152), (429, 423), (-8, 423)]
    poly(base, fac, rgb(34, 19, 19), a)
    fm = mask_of(fac)
    # vertical value gradient (lighter under the eaves, darker at the plinth) + plaster mottling
    yy = (np.arange(H, dtype=np.float32) / SC + Y0)[:, None]
    grad = np.clip((yy - 160) / 260.0, 0, 1)
    shade = (1.08 - 0.30 * grad) * (1 + 0.035 * noise((H, W), 26 * SC, 3) + 0.02 * noise((H, W), 6 * SC, 4))
    base = np.where(fm[..., None] > 0, base * shade[..., None], base)
    # stone plinth band
    poly(base, [(-8, 404), (429, 404), (429, 423), (-8, 423)], rgb(26, 15, 16), a)
    for k, xx in enumerate(range(-8, 430, 22)):
        line(base, (xx + (11 if k % 2 else 0), 404), (xx + (11 if k % 2 else 0), 423), rgb(17, 10, 11), 0.5)
    line(base, (-8, 404), (429, 404), rgb(48, 34, 36), 0.6)
    line(base, (-8, 413.5), (429, 413.5), rgb(18, 11, 12), 0.5)
    # facade outline in the original's thin-line style
    for p0, p1 in (((-8, 152), (-8, 423)), ((429, 152), (429, 423))):
        line(base, p0, p1, LINE, 0.55)

    # ---- window surround, frame and sill (glass stays a hole) ----
    wx0, wx1, wsp, wby = 68, 168, 270, 335
    poly(base, arch_pts(wx0, wx1, wsp, wby + 1, grow=7), rgb(44, 30, 31), a)        # stone surround
    for k in range(9):                                                                # voussoir joints
        th = np.pi - np.pi * (k + 0.5) / 9
        r0, r1 = 50, 57
        line(base, (118 + r0 * np.cos(th), wsp - r0 * np.sin(th)), (118 + r1 * np.cos(th), wsp - r1 * np.sin(th)), rgb(28, 19, 20), 0.5)
    poly(base, arch_pts(wx0, wx1, wsp, wby, grow=2.4), rgb(22, 28, 44), a)          # dark wood frame
    poly(base, [(58, 335), (178, 335), (180, 343), (56, 343)], rgb(46, 36, 40), a)   # sill
    line(base, (58, 335), (178, 335), rgb(95, 150, 190), 0.8)                        # sill lit by window
    # flower box with trailing plants under the sill
    poly(base, [(64, 343), (172, 343), (169, 357), (67, 357)], rgb(20, 26, 40), a)
    line(base, (64, 343), (172, 343), rgb(40, 60, 85), 0.6)

    # ---- door surround (opening stays a hole) ----
    dx0, dx1, dsp, dby = 298, 376, 296, 422
    poly(base, arch_pts(dx0, dx1, dsp, dby, grow=7), rgb(42, 29, 30), a)
    for k in range(9):
        th = np.pi - np.pi * (k + 0.5) / 9
        line(base, (337 + 39 * np.cos(th), dsp - 39 * np.sin(th)), (337 + 46 * np.cos(th), dsp - 46 * np.sin(th)), rgb(27, 18, 19), 0.5)
    poly(base, [(290, 422), (384, 422), (386, 427), (288, 427)], rgb(40, 30, 32), a)  # threshold step

    # ---- small wooden awning over the door ----
    poly(base, [(281, 236), (393, 236), (397, 249), (277, 249)], rgb(26, 30, 44), a)
    for xx in np.arange(281, 394, 7):
        line(base, (xx, 237), (xx - 2, 248), rgb(18, 21, 31), 0.5)
    line(base, (277, 249), (397, 249), rgb(55, 72, 98), 0.8)
    line(base, (281, 236), (393, 236), rgb(45, 50, 66), 0.6)
    for bx in (287, 387):                                                            # brackets
        poly(base, [(bx - 2, 249), (bx + 2, 249), (bx + 2, 262), (bx - 2, 255)], rgb(22, 26, 38), a)

    # ---- hip roof with clay tiles ----
    ye, yr = 152, 94
    roof = [(-26, ye), (445, ye), (330, yr), (90, yr)]
    poly(base, roof, rgb(24, 25, 44), a)
    rm = mask_of(roof)
    xs = (np.arange(W, dtype=np.float32) / SC + X0)[None, :]
    moon = np.clip((xs - 60) / 380.0, 0, 1) * 0.18                                  # moonlight from upper right
    tex = (1 + moon + 0.05 * noise((H, W), 14 * SC, 9))
    base = np.where(rm[..., None] > 0, base * tex[..., None], base)
    row_h = 6.4
    nrow = int((ye - yr) / row_h)
    for k in range(1, nrow + 1):
        y = yr + k * row_h
        f = (y - yr) / (ye - yr)
        xl, xr = 90 + (-26 - 90) * f, 330 + (445 - 330) * f
        line(base, (xl, y), (xr, y), rgb(15, 15, 27), 0.7)                          # tile course shadow
        line(base, (xl, y - 1.3), (xr, y - 1.3), rgb(40, 44, 70), 0.45)             # lit tile lip
        off = 4.5 if k % 2 else 0
        for xx in np.arange(xl + off, xr - 2, 9):
            line(base, (xx, y - row_h + 1), (xx, y - 0.6), rgb(17, 17, 30), 0.45)
    line(base, (90, yr), (330, yr), rgb(56, 58, 86), 1.4)                            # ridge cap
    line(base, (90, yr), (-26, ye), rgb(46, 48, 74), 1.1)                            # hips
    line(base, (330, yr), (445, ye), rgb(62, 64, 94), 1.1)
    poly(base, [(-30, ye - 1), (449, ye - 1), (449, ye + 5), (-30, ye + 5)], rgb(18, 18, 30), a)  # fascia
    line(base, (-30, ye + 5), (449, ye + 5), LINE, 0.5)

    # ---- climbing vine on the left corner ----
    rng = np.random.default_rng(11)
    vine = [(-2 + 6 * np.sin(t * 0.09) + t * 0.05, 423 - t) for t in np.arange(0, 250, 2)]
    for i in range(len(vine) - 1):
        line(base, vine[i], vine[i + 1], rgb(18, 30, 22), 0.9, a)
    for (vx, vy) in vine[::3]:
        for _ in range(2):
            lx, ly = vx + rng.uniform(-9, 11), vy + rng.uniform(-5, 5)
            ang = rng.uniform(0, 180)
            e = np.array([P(lx, ly)], np.int32)[0]
            cv2.ellipse(base, (int(e[0]), int(e[1])), (int(4.2 * SC * 16), int(2.2 * SC * 16)), ang, 0, 360, rgb(20, 40 + rng.uniform(0, 12), 24), -1, cv2.LINE_AA, SHIFT)
            cv2.ellipse(a, (int(e[0]), int(e[1])), (int(4.2 * SC * 16), int(2.2 * SC * 16)), ang, 0, 360, 1.0, -1, cv2.LINE_AA, SHIFT)
        if rng.random() < 0.25:
            circle(base, (vx + rng.uniform(-6, 8), vy + rng.uniform(-4, 4)), 1.3, rgb(150, 120, 190), a)

    # ---- plants: flower box, potted plants beside the door ----
    def bush(cx, cy, rx, ry, n, seed, warm=0.0):
        r = np.random.default_rng(seed)
        for _ in range(n):
            px, py = cx + r.normal(0, rx * 0.5), cy + r.normal(0, ry * 0.45)
            e = P(px, py)
            g = 34 + r.uniform(0, 20)
            col = rgb(20 + warm * 10, g + warm * 22, 22 + warm * 40)
            ax = int(r.uniform(3.2, 5.6) * SC * 16); ay = int(r.uniform(1.6, 2.8) * SC * 16)
            ang = r.uniform(0, 180)
            cv2.ellipse(base, (e[0], e[1]), (ax, ay), ang, 0, 360, col, -1, cv2.LINE_AA, SHIFT)
            cv2.ellipse(a, (e[0], e[1]), (ax, ay), ang, 0, 360, 1.0, -1, cv2.LINE_AA, SHIFT)
        for _ in range(max(2, n // 9)):
            circle(base, (cx + r.normal(0, rx * 0.45), cy + r.normal(0, ry * 0.4) - ry * 0.2), 1.4,
                   rgb(160, 140, 205) if r.random() < 0.6 else rgb(190, 205, 230), a)
    bush(118, 352, 52, 12, 70, 21, warm=0.9)                                          # flower box (window-lit)
    for (cx, w_) in ((276, 13), (402, 12)):                                           # pots by the door
        poly(base, [(cx - w_, 404), (cx + w_, 404), (cx + w_ - 3, 423), (cx - w_ + 3, 423)], rgb(22, 30, 52), a)
        line(base, (cx - w_, 404), (cx + w_, 404), rgb(40, 55, 85), 0.7)
    bush(276, 386, 26, 34, 55, 31, warm=0.35)
    bush(402, 384, 24, 34, 50, 41, warm=0.8)
    poly(base, [(14, 404), (40, 404), (37, 423), (17, 423)], rgb(22, 30, 52), a)     # pot under the vine
    bush(27, 388, 26, 28, 40, 51, warm=0.25)

    # ---- wall lantern right of the door ----
    poly(base, [(392, 266), (404, 266), (404, 268), (392, 268)], rgb(20, 22, 30), a)  # bracket
    poly(base, [(397, 268), (411, 268), (413, 272), (395, 272)], rgb(22, 24, 34), a)  # cap
    poly(base, [(396, 272), (412, 272), (410, 289), (398, 289)], rgb(140, 205, 250), a)  # glass
    line(base, (404, 272), (404, 289), rgb(40, 60, 90), 0.6)
    poly(base, [(397, 289), (411, 289), (409, 292), (399, 292)], rgb(22, 24, 34), a)

    # ---- platform stone texture (subtle overlay, original platform kept underneath) ----
    plat = np.zeros((H, W, 3), np.float32); plat_a = np.zeros((H, W), np.float32)
    for row, (ya, yb) in enumerate(((438, 452), (452, 466), (466, 479))):
        line(plat, (-40, yb), (600, yb), rgb(10, 4, 4), 0.6, plat_a, 0.55)
        off = 13 if row % 2 else 0
        for xx in range(-40 + off, 600, 26):
            line(plat, (xx, ya), (xx, yb), rgb(10, 4, 4), 0.55, plat_a, 0.5)
    line(plat, (-40, 437), (600, 437), rgb(60, 44, 48), 0.6, plat_a, 0.5)

    # ---- door leaves (separate, faded as the door opens) ----
    door = np.zeros((H, W, 3), np.float32); door_a = np.zeros((H, W), np.float32)
    dpts = arch_pts(dx0, dx1, dsp, dby)
    poly(door, dpts, rgb(12, 17, 30), door_a)
    dm = mask_of(dpts)
    door = door * (1 + 0.08 * noise((H, W), 3 * SC, 7))[..., None]
    for xx in np.arange(dx0 + 9.75, dx1, 9.75):
        line(door, (xx, 250), (xx, dby), rgb(7, 10, 18), 0.6)
    line(door, (337, 255), (337, dby), rgb(5, 7, 12), 1.0)
    for yb in (318, 388):
        line(door, (dx0, yb), (dx1, yb), rgb(10, 12, 18), 2.2)
        for xx in (dx0 + 6, 331, 343, dx1 - 6):
            circle(door, (xx, yb), 0.9, rgb(40, 52, 70))
    for xx in (330, 344):
        circle(door, (xx, 356), 3.2, rgb(40, 70, 110), thick=0.8)
    door = door * dm[..., None]
    door_a = door_a * dm

    # ---- additive glow maps ----
    def radial(cx, cy, r, gain, col):
        yy_, xx_ = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx_ / SC + X0) - cx) ** 2 + ((yy_ / SC + Y0) - cy) ** 2)
        g = gain * np.exp(-(d / r) ** 2)
        return g[..., None] * np.array(col, np.float32)[None, None]
    glow = radial(404, 280, 9, 0.9, rgb(150, 215, 255)) + radial(404, 282, 34, 0.32, rgb(90, 150, 230))
    glow += radial(404, 300, 70, 0.10, rgb(60, 110, 200))
    win_m = mask_of(arch_pts(wx0, wx1, wsp, wby))
    wg = cv2.GaussianBlur(win_m, (0, 0), 14 * SC) * 0.55 + cv2.GaussianBlur(win_m, (0, 0), 5 * SC) * 0.35
    glow += wg[..., None] * np.array(rgb(70, 130, 210), np.float32)[None, None]
    door_m = mask_of(dpts)
    dg = cv2.GaussianBlur(door_m, (0, 0), 16 * SC) * 0.75 + cv2.GaussianBlur(door_m, (0, 0), 5 * SC) * 0.4
    glow_door = dg[..., None] * np.array(rgb(110, 180, 245), np.float32)[None, None]
    # window and door openings must stay holes in the base layer
    for hole in (win_m, door_m):
        a = a * (1 - hole)
        base = base * (1 - hole[..., None])
    return dict(base_rgb=base, base_a=np.clip(a, 0, 1), plat_rgb=plat, plat_a=np.clip(plat_a, 0, 1),
                door_rgb=door, door_a=np.clip(door_a, 0, 1), glow=glow, glow_door=glow_door,
                door_mask=door_m, win_mask=win_m)


if __name__ == '__main__':
    import sys
    L = build()
    out = sys.argv[1]
    np.savez_compressed(out, **{k: (v * 255).clip(0, 255).astype(np.uint8) if v.dtype == np.float32 else v for k, v in L.items()},
                        meta=np.array([SC, X0, Y0, X1, Y1], np.float32))
    prev = np.zeros((H, W, 3), np.float32) + np.array(rgb(81, 26, 21))
    prev = prev * (1 - L['base_a'][..., None]) + L['base_rgb'] * L['base_a'][..., None]
    prev = prev * (1 - L['door_a'][..., None]) + L['door_rgb']
    prev += L['glow']
    cv2.imwrite(out.replace('.npz', '_preview.png'), (np.clip(prev, 0, 1) * 255).astype(np.uint8))
    print('built', W, H)

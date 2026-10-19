"""The eight scenes of the reel. frame(t) -> float32 RGB (1920,1080,3) in [0,1]."""
import json
import math
import os

import numpy as np

import draw
import geometry as geo
import ground
import overlay as ov
import planet
import science as sc
from planet import hexrgb

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DURATION = 45.0
CUTS = [0.0, 4.0, 9.0, 16.0, 22.0, 29.0, 36.0, 41.0, 45.0]
WORDS = json.load(open(os.path.join(HERE, "..", "..", "audio", "align_edit.json")))
PAGES = ov.build_pages(WORDS)
SCI = sc.compute()

WHITE, ORANGE, AMBER, BLUE = ov.WHITE, ov.ORANGE, ov.AMBER, ov.SUB_BLUE
SPACE_BG = hexrgb("#05060C")
OUT_C = planet.OUTLINE


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def sstep(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_io(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def lerp(a, b, k):
    return a + (b - a) * k


def wobble(t, amp, seed):
    r = np.random.default_rng(seed).uniform(0, 2 * math.pi, 3)
    return amp * (0.6 * math.sin(1.3 * t + r[0]) + 0.3 * math.sin(2.7 * t + r[1]) + 0.1 * math.sin(6.3 * t + r[2]))


def word_t(word, occurrence=1):
    n = 0
    for w in WORDS:
        if w["word"].strip(",.:?!").lower() == word.lower():
            n += 1
            if n == occurrence:
                return w["start"]
    raise KeyError(word)


# ------------------------------------------------------------------ text helpers
def label(canvas, runs_lines, cy, t, t_in, size=64, t_out=None, path=ov.F_XB, cx=540, name="label",
          align="center", anchor="center", line_gap=1.1):
    s, a = ov.pop(t, t_in, t_out=t_out)
    if a <= 0:
        return None
    im = ov.text_img(runs_lines, size, path=path, line_gap=line_gap, align=align)
    if anchor == "center":
        pad = im.info.get("pad", 0)
        half_w = (im.width - 2 * pad) * max(s, 1.0) / 2
        half_h = (im.height - 2 * pad) / 2
        right = ov.SAFE["right_lower"] if cy + half_h > 960 else ov.SAFE["right"]
        cx = min(max(cx, ov.SAFE["left"] + half_w + 3), right - half_w - 3)
    return ov.place(canvas, im, cx, cy, s, a, name=name, anchor=anchor)


def tag(canvas, text, cx, cy, t, t_in, t_out=None, size=30, anchor="center"):
    s, a = ov.pop(t, t_in, t_out=t_out)
    if a <= 0:
        return None
    return ov.place(canvas, ov.tag_img(text, size), cx, cy, s, a, name="tag:" + text, anchor=anchor)


def W_(txt):
    return [(txt, WHITE)]


# ------------------------------------------------------------------ space stars
_rng = np.random.default_rng(21)
_SD = _rng.normal(size=(2500, 3))
STAR_DIRS = _SD / np.linalg.norm(_SD, axis=1, keepdims=True)
STAR_B = _rng.power(3.0, 2500) * 0.38
STAR_PH = _rng.uniform(0, 6.28, 2500)


def space_stars(canvas, cam, t, gain=1.0):
    P = cam.pos + STAR_DIRS * 1e9
    sp = cam.project_many(P)
    ok = np.isfinite(sp[:, 0]) & (sp[:, 0] >= 1) & (sp[:, 0] < W - 1) & (sp[:, 1] >= 1) & (sp[:, 1] < H - 1)
    for (x, y, _), b, ph in zip(sp[ok], STAR_B[ok], STAR_PH[ok]):
        v = b * gain * (0.8 + 0.2 * math.sin(ph + 2 * t))
        xi, yi = int(x), int(y)
        canvas[yi, xi] += (1 - canvas[yi, xi]) * v
        if b > 0.3:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                canvas[yi + dy, xi + dx] += (1 - canvas[yi + dy, xi + dx]) * v * 0.35


def space_canvas():
    return np.zeros((H, W, 3), np.float32) + SPACE_BG


# ================================================================== SCENE 1
S1_LAPSE = 30.0


def s1_view(t):
    k = ease_io(t / 4.0)
    fov = lerp(9.6, 8.6, k)
    ppd = (H / 2) / math.tan(math.radians(fov / 2)) * math.radians(1)
    ts = geo.T_HOOK + (t - 2.0) * S1_LAPSE
    # aim so Mars starts near (300, 1000) and drifts gently toward centre during the push-in
    tx, ty = lerp(300, 335, k), lerp(1000, 985, k)
    m = geo.mars_km(ts)
    v0 = ground.GroundView(ts, 0.0, 0.0, fov)
    dvec = geo.unit(m - v0.obs)
    a_m = math.degrees(math.atan2(dvec @ v0.right, dvec @ v0.ref))
    h_m = math.degrees(math.asin(dvec @ v0.up))
    a_c = a_m + (540 - tx) / ppd + wobble(t, 0.010, 1)
    h_c = h_m + (ty - 960) / ppd + wobble(t, 0.010, 2)
    return ground.GroundView(ts, a_c, h_c, fov, roll=wobble(t, 0.10, 3))


def s1(t):
    v = s1_view(t)
    img, info, _ = ground.render(v, t, glitter_gain=1.0)
    # atmosphere "thins" at the end: hint of the cut to space
    sk = sstep((t - 3.45) / 0.55) * 0.55
    if sk > 0:
        a, h = v.ah_maps()
        sky = (h > 0.25)[..., None]
        img = np.where(sky, img * (1 - sk) + SPACE_BG * sk, img)
        for kind in ("mars", "moon"):
            if kind in info:
                pass
    # text
    label(img, [[("WHAT IF MARS APPEARED IN EARTH'S SKY?", BLUE)]], 372, t, 0.05, size=34, name="kicker")
    label(img, [[("MARS.", ORANGE)]], 462, t, 0.15, size=108, name="hook1")
    label(img, [[("TWICE THE ", WHITE), ("MOON'S", WHITE), (" SIZE.", WHITE)]], 566, t, 0.32, size=62,
          name="hook2")
    # angle callouts with brackets
    k = sstep((t - 1.55) / 0.35)
    if k > 0:
        for kind, txt, col_name in (("mars", "1.0°", "MARS"), ("moon", "0.52°", "MOON")):
            if kind not in info:
                continue
            i = info[kind]
            y = i["y"] + i["r_px"] + 16
            x0, x1 = i["x"] - i["r_px"], i["x"] + i["r_px"]
            segs = [((x0, y), (x1, y)), ((x0, y - 8), (x0, y + 8)), ((x1, y - 8), (x1, y + 8))]
            draw.lines(img, segs, (1, 1, 1), 3, k, outline=OUT_C, outline_w=2)
            label(img, [[(col_name + " ", BLUE), (txt, AMBER)]], y + 34, t, 1.55, size=38, cx=i["x"],
                  name="callout:" + kind)
    return img, info


# ================================================================== SCENE 2
def _quat_from_R(R):
    m = np.stack([-R[0], R[1], R[2]], 1)  # camera basis is left-handed: flip 'right' -> proper rotation
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = 0.5 / math.sqrt(tr + 1.0)
        return np.array([0.25 / s, (m[2, 1] - m[1, 2]) * s, (m[0, 2] - m[2, 0]) * s, (m[1, 0] - m[0, 1]) * s])
    i = int(np.argmax([m[0, 0], m[1, 1], m[2, 2]]))
    if i == 0:
        s = 2.0 * math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2])
        return np.array([(m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s])
    if i == 1:
        s = 2.0 * math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2])
        return np.array([(m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s])
    s = 2.0 * math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1])
    return np.array([(m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s])


def _R_from_quat(q):
    w, x, y, z = q / np.linalg.norm(q)
    m = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    return np.stack([-m[:, 0], m[:, 1], m[:, 2]])


def slerp(q0, q1, k):
    d = float(q0 @ q1)
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        q = q0 + k * (q1 - q0)
        return q / np.linalg.norm(q)
    th = math.acos(d)
    return (math.sin((1 - k) * th) * q0 + math.sin(k * th) * q1) / math.sin(th)


def cam_with_target_on_screen(pos, target, up_hint, fov, sx, sy):
    """Camera at pos with `target` appearing at screen (sx, sy)."""
    base = geo.Camera.look(pos, target, up_hint, fov)
    dx, dy = (sx - W / 2) / base.f, (H / 2 - sy) / base.f
    r, u, f = base.R
    fwd = geo.unit(f - dx * r - dy * u)
    return geo.Camera.look(pos, pos + fwd, up_hint, fov)


M_HOOK = geo.mars_km(geo.T_HOOK)
M_HAT = geo.unit(M_HOOK)
_n = geo.unit(np.cross(M_HAT, sc.Q_HAT))
_q = geo.unit(sc.Q_HAT - (sc.Q_HAT @ M_HAT) * M_HAT)
S2_W = geo.unit(math.cos(math.radians(62)) * _n + math.sin(math.radians(62)) * _q)


def _s2_end_cam():
    D, beta = 62000.0, math.radians(15.0)
    C = -D * math.cos(beta) * M_HAT + D * math.sin(beta) * S2_W
    cam = cam_with_target_on_screen(C, M_HOOK, S2_W, 40.0, 600, 840)
    # nudge so Earth sits low-centre: rotate about the camera's up to centre Earth+Mars horizontally
    return cam


S2_END = _s2_end_cam()


def s2_camera(tl):
    """tl: 0..5 s within scene 2."""
    c1 = s1_view(4.0)
    m1 = c1.cam.project(geo.mars_km(c1.ts))
    r1 = c1.cam.f * math.tan(math.asin(geo.R_M / np.linalg.norm(geo.mars_km(c1.ts) - c1.obs)))
    fov0 = 24.0
    f0 = (H / 2) / math.tan(math.radians(fov0 / 2))
    D0 = f0 * geo.R_M / r1
    dir_obs = geo.unit(c1.obs - M_HOOK)
    C0 = M_HOOK + D0 * dir_obs
    cam0 = cam_with_target_on_screen(C0, M_HOOK, c1.up, fov0, m1[0], m1[1])
    k = ease_io(tl / 3.6)
    # camera path: cubic Bezier lifted away from Earth along S2_W
    P0, P3 = C0, S2_END.pos
    P1 = P0 + (P3 - P0) * 0.33 + S2_W * 26000
    P2 = P0 + (P3 - P0) * 0.75 + S2_W * 26000
    pos = ((1 - k) ** 3) * P0 + 3 * ((1 - k) ** 2) * k * P1 + 3 * (1 - k) * k * k * P2 + (k ** 3) * P3
    q = slerp(_quat_from_R(cam0.R), _quat_from_R(S2_END.R), sstep(tl / 3.6))
    R = _R_from_quat(q)
    fov = lerp(fov0, 40.0, ease_io(tl / 3.2))
    cam = geo.Camera(pos, R[0], R[1], R[2], fov)
    # end of scene: push toward Earth's night side (hint of the cut back to the ground)
    pk = sstep((tl - 4.45) / 0.55)
    if pk > 0:
        cam = geo.Camera(pos + (np.zeros(3) - pos) * 0.35 * pk, R[0], R[1], R[2], fov - 6 * pk)
    return cam


def s2(t):
    tl = t - 4.0
    cam = s2_camera(tl)
    img = space_canvas()
    space_stars(img, cam, t)
    mars_ax = planet.body_axes_facing(M_HOOK - geo.OBS_HOOK, 12, -75, geo.ZENITH_HOOK)
    kp = sstep((tl - 1.6) / 1.0)
    if kp > 0:
        ts_ = np.linspace(-40 * 3600, 40 * 3600, 161)
        P = np.array([geo.mars_km(x) for x in ts_])
        sp = cam.project_many(P)[:, :2]
        n_show = int(len(sp) * kp)
        past = [p for p, x in zip(sp[:n_show], ts_[:n_show]) if x <= geo.T_HOOK]
        fut = [p for p, x in zip(sp[:n_show], ts_[:n_show]) if x >= geo.T_HOOK]
        draw.polyline(img, past, (1.0, 0.72, 0.45), 3, 0.95)
        if len(fut) > 1:
            draw.dashed_poly(img, fut, (1.0, 0.72, 0.45), 3, dash=16, gap=11, alpha=0.95)
    order = sorted([("earth", np.zeros(3)), ("moon", geo.MOON_POS), ("mars", M_HOOK)],
                   key=lambda kv: -np.linalg.norm(kv[1] - cam.pos))
    info = {}
    for kind, pos in order:
        ax = {"earth": planet.earth_axes(geo.T_HOOK), "moon": planet.moon_axes(geo.MOON_POS), "mars": mars_ax}[kind]
        i = planet.render(img, cam, kind, pos, ax)
        if i:
            info[kind] = i
    if kp > 0.6 and "mars" in info:
        mp = np.array([info["mars"]["x"], info["mars"]["y"]])
        ahead = cam.project(geo.mars_km(geo.T_HOOK + 3 * 3600))
        u = geo.unit(np.array([ahead[0], ahead[1]]) - mp)
        tip = mp + u * (info["mars"]["r_px"] + 80)
        draw.arrow(img, mp + u * (info["mars"]["r_px"] + 12), tip, (1.0, 0.72, 0.45), 5, 20,
                   sstep((kp - 0.6) / 0.4), outline=OUT_C)
        label(img, [[("≈10 KM/S", (199, 184, 255))]], tip[1] + 6, t, 6.4, size=34, cx=tip[0] + 105, name="speed")
    # dimension line Earth -> Mars
    kd = sstep((tl - 2.4) / 0.8)
    if kd > 0 and "earth" in info and "mars" in info:
        e = np.array([info["earth"]["x"], info["earth"]["y"]])
        m = np.array([info["mars"]["x"], info["mars"]["y"]])
        u = geo.unit(m - e)
        nrm = np.array([-u[1], u[0]])
        side = nrm if nrm[0] < 0 else -nrm
        a0 = e + u * (info["earth"]["r_px"] + 14) + side * 175
        a1 = e + (m - e) * kd - u * (info["mars"]["r_px"] + 10) * kd + side * 175
        draw.lines(img, [(a0, a1), (a0 - nrm * 10, a0 + nrm * 10), (a1 - nrm * 10, a1 + nrm * 10)],
                   (0.80, 0.88, 1.0), 3, 0.95, outline=OUT_C, outline_w=2)
        mid = (a0 + a1) / 2 + side * 20
        label(img, [[("384,000 KM", AMBER)]], mid[1], t, 6.9, size=36, cx=max(mid[0] - 110, 175), name="dimension")
    # body labels
    for kind, txt in (("moon", "MOON"), ("mars", "MARS")):
        if kind in info and tl > 2.6:
            i = info[kind]
            dx = (i["r_px"] + 62) if kind == "mars" else -(i["r_px"] + 58)
            label(img, [[(txt, BLUE)]], i["y"], t, 6.7 + (0.1 if kind == "moon" else 0),
                  size=32, cx=i["x"] + dx, name="bodylabel:" + kind)
    # rule card
    k = sstep((tl - 0.9) / 0.3)
    if k > 0:
        draw.rounded_rect(img, 80, 318, 1000, 720, 34, OUT_C, 0.72 * k)
        draw.rounded_rect(img, 80, 318, 1000, 720, 34, (0.64, 0.55, 1.0), 0.9 * k, fill=False, width=4)
    tag(img, "ASSUMPTION", 540, 372, t, 5.0)
    label(img, [[("HYPOTHETICAL: ", (199, 184, 255)), ("FAST FLYBY.", WHITE)]], 446, t, 5.1, size=54, name="rule1")
    label(img, [[("384,000 KM", AMBER), (". NO CRASH.", WHITE)]], 520, t, 5.25, size=54, name="rule2")
    label(img, [[("Mars just appears — we don't explain how.", BLUE)]], 600, t, 5.6, size=34, path=ov.F_B,
          name="rule3")
    label(img, [[("After that, only real physics.", BLUE)]], 652, t, 5.75, size=34, path=ov.F_B, name="rule4")
    return img, info


# ================================================================== SCENE 3
import cv2
from PIL import Image, ImageDraw

S3_PPD = 480.0 / SCI["moon_deg"]                     # Moon outline = 480 px wide
S3_FOV = H / S3_PPD
S3_C = (540.0, 985.0)
_ROOF = None


def _rooftops():
    global _ROOF
    if _ROOF is None:
        rng = np.random.default_rng(9)
        im = Image.new("RGBA", (W, 300), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = -20
        while x < W:
            w = int(rng.uniform(90, 200))
            top = int(rng.uniform(60, 200))
            d.rectangle([x, top, x + w, 300], fill=(16, 21, 52, 255))
            for yy in range(top + 18, 300, 26):
                for xx in range(x + 12, x + w - 14, 24):
                    if rng.random() < 0.35:
                        c = (255, 211, 122) if rng.random() < 0.75 else (207, 232, 255)
                        d.rectangle([xx, yy, xx + 11, yy + 14], fill=c + (255,))
            x += w + int(rng.uniform(-10, 6))
        _ROOF = np.asarray(im).astype(np.float32) / 255.0
    return _ROOF


_S3STARS = None


def s3_sky(t):
    global _S3STARS
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    top, bot = hexrgb("#0A0F2C"), hexrgb("#1E2456")
    img = (top * (1 - yy) + bot * yy)[:, None, :].repeat(W, 1)
    img = np.ascontiguousarray(img.reshape(H, W, 3))
    if _S3STARS is None:
        rng = np.random.default_rng(31)
        _S3STARS = (rng.uniform(0, W, 140), rng.uniform(0, H - 260, 140), rng.power(2.5, 140), rng.uniform(0, 6, 140))
    for x, y, b, ph in zip(*_S3STARS):
        v = (0.25 + 0.6 * b) * (0.75 + 0.25 * math.sin(ph + 2.2 * t))
        xi, yi = int(x), int(y)
        img[yi, xi] += (1 - img[yi, xi]) * v
        if b > 0.8:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                img[yi + dy, xi + dx] += (1 - img[yi + dy, xi + dx]) * v * 0.4
    roof = _rooftops()
    a = roof[..., 3:4]
    img[H - 300:] = img[H - 300:] * (1 - a) + roof[..., :3] * a
    return img


def s3_mars(dist_km, t_s=None, full=False):
    """Mars position for the distance ladder: on the real approach path, or (today) at opposition."""
    if full:
        d = geo.unit(geo.MOON_POS - geo.OBS_HOOK) * 0 + geo.unit(np.array([1.0, 0.02, 0.06]))
        return geo.OBS_HOOK + d * dist_km
    return geo.mars_km(-sc.hyp_t_of_r(dist_km * 1e3))


def s3(t):
    img = s3_sky(t)
    if t < 10.95:
        shot, dist, full = "A", 55e6, True
    elif t < 11.95:
        shot, dist, full = "B", 10e6, False
    else:
        shot, dist, full = "C", 1e6, False
    if shot == "C":
        dist = lerp(1e6, 0.86e6, ease_io((t - 15.25) / 0.75))
    m = s3_mars(dist, full=full)
    up = geo.ZENITH_HOOK
    cam = cam_with_target_on_screen(geo.OBS_HOOK, m, up, S3_FOV, *S3_C)
    # soft glow so the tiny dot reads on a phone
    rpx = cam.f * math.tan(math.asin(geo.R_M / np.linalg.norm(m - geo.OBS_HOOK)))
    gr = max(16.0, rpx * 1.8)
    yy, xx = np.mgrid[int(S3_C[1] - gr):int(S3_C[1] + gr), int(S3_C[0] - gr):int(S3_C[0] + gr)]
    rr = np.sqrt((xx + 0.5 - S3_C[0]) ** 2 + (yy + 0.5 - S3_C[1]) ** 2)
    g = np.clip(1 - rr / gr, 0, 1) ** 2 * (0.55 if rpx < 6 else 0.25)
    sub = img[int(S3_C[1] - gr):int(S3_C[1] + gr), int(S3_C[0] - gr):int(S3_C[0] + gr)]
    sub += (hexrgb("#FF9A5A") - sub) * g[..., None]
    if full:  # opposition: Sun directly behind the observer
        sun = -geo.unit(m - geo.OBS_HOOK)
    else:
        sun = geo.SUN
    ax = planet.body_axes_facing(m - geo.OBS_HOOK, 12, -75, up)
    info = planet.render(img, cam, "mars", m, ax, sun=sun)
    # Moon outline for scale
    R = 240.0
    draw.dashed_circle(img, S3_C, R, (0.86, 0.91, 1.0), 3, n=90, duty=0.6, rot=t * 0.05)
    label(img, [[("MOON SIZE ", BLUE), ("0.52°", AMBER)]], S3_C[1] - R - 34, t, 9.05, size=32, name="moonsize")
    if shot != "C":
        draw.arrow(img, (S3_C[0] + 130, S3_C[1] - 95), (S3_C[0] + 18 + rpx, S3_C[1] - 14 - rpx * 0.5),
                   (1, 0.85, 0.6), 4, 16, 1.0, outline=OUT_C)
        label(img, [[("MARS", ORANGE)]], S3_C[1] - 118, t, 9.05 if shot == "A" else 10.95, size=36,
              cx=S3_C[0] + 175, name="marsptr")
    tag(img, "ESTABLISHED", 540, 372, t, 9.05)
    if shot == "A":
        label(img, [[("TODAY, AT ITS CLOSEST:", BLUE)]], 438, t, 9.1, size=36, name="s3a0")
        label(img, [[("55 MILLION KM", AMBER)]], 508, t, 9.2, size=66, name="s3a1")
        label(img, [[("25 ARCSECONDS ", WHITE), ("(0.007°)", BLUE)]], 590, t, 9.35, size=40, name="s3a2")
    elif shot == "B":
        label(img, [[("10 MILLION KM", AMBER)]], 470, t, 10.95, size=66, name="s3b1")
        label(img, [[("0.039° ", WHITE), ("— STILL A DOT", BLUE)]], 560, t, 11.0, size=42, name="s3b2")
    else:
        to = 15.55
        label(img, [[("1 MILLION KM", AMBER)]], 470, t, 11.95, size=66, t_out=to, name="s3c1")
        label(img, [[("0.39° ", WHITE), ("≈ ¾ OF THE MOON", ORANGE)]], 560, t, 12.1, size=46, t_out=to,
              name="s3c2")
        k = sstep((t - 13.6) / 0.4) * (1 - sstep((t - 15.4) / 0.3))
        if k > 0 and info:
            r = info["r_px"]
            y = S3_C[1] + R + 20
            draw.lines(img, [((S3_C[0] - r, y), (S3_C[0] + r, y)), ((S3_C[0] - r, y - 8), (S3_C[0] - r, y + 8)),
                             ((S3_C[0] + r, y - 8), (S3_C[0] + r, y + 8))], (1, 0.62, 0.26), 4, k,
                       outline=OUT_C, outline_w=2)
            draw.lines(img, [((S3_C[0] - R, y + 18), (S3_C[0] + R, y + 18)),
                             ((S3_C[0] - R, y + 10), (S3_C[0] - R, y + 26)),
                             ((S3_C[0] + R, y + 10), (S3_C[0] + R, y + 26))], (0.86, 0.91, 1.0), 3, k,
                       outline=OUT_C, outline_w=2)
    return img, {"mars": info} if info else {}


# ================================================================== SCENE 4
S4_T0 = geo.T_HOOK + 240.0


def s4_view(t):
    tl = t - 16.0
    ts = S4_T0 + tl * 10.0
    fov = lerp(4.4, 4.0, ease_io((tl - 3.6) / 2.4))
    ppd = (H / 2) / math.tan(math.radians(fov / 2)) * math.radians(1)
    v0 = ground.GroundView(ts, 0.0, 0.0, fov)
    dvec = geo.unit(geo.mars_km(ts) - v0.obs)
    a_m = math.degrees(math.atan2(dvec @ v0.right, dvec @ v0.ref))
    h_m = math.degrees(math.asin(dvec @ v0.up))
    h_end = h_m - (975 - 960) / ppd
    h_c = lerp(h_m - 6.4, h_end, ease_io((tl - 0.1) / 2.1))
    return ground.GroundView(ts, a_m + wobble(t, 0.004, 5), h_c + wobble(t, 0.004, 6), fov,
                             roll=wobble(t, 0.05, 7))


def s4(t):
    v = s4_view(t)
    img, info, _ = ground.render(v, t, bright=0.75, glitter_gain=2.3, rim_light=1.0, stars_on=0.5)
    tag(img, "ESTABLISHED", 540, 372, t, 18.15)
    label(img, [[("SEVERAL TIMES BRIGHTER", WHITE)], [("THAN A FULL MOON", ORANGE)]], 492, t, 18.2, size=60,
          name="s4a")
    label(img, [[("≈5× a full Moon when fully lit", BLUE)]], 612, t, 18.7, size=34, path=ov.F_B, name="s4b")
    if "mars" in info and t > 19.8:
        i = info["mars"]
        k = sstep((t - 19.8) / 0.35)
        x = i["x"] + i["r_px"] + 22
        y0, y1 = i["y"] - i["r_px"], i["y"] + i["r_px"]
        draw.lines(img, [((x, y0), (x, y1)), ((x - 8, y0), (x + 8, y0)), ((x - 8, y1), (x + 8, y1))],
                   (1, 1, 1), 3, k, outline=OUT_C, outline_w=2)
        label(img, [[("1.0°", AMBER)]], i["y"], t, 19.8, size=40, cx=x + 58, name="s4deg")
    return img, info


# ================================================================== SCENE 5
def s5_earth_cam(r_target, cx, cy, w=W, h=H, fov=30.0):
    m_hat = M_HAT
    side = geo.unit(np.cross(m_hat, np.array([0, 0, 1.0])))
    view_dir = geo.unit(side * 0.94 + np.array([0, 0, 1.0]) * 0.34)
    f = (h / 2) / math.tan(math.radians(fov / 2))
    D = geo.R_E / math.sin(math.atan(r_target / f))
    pos = -view_dir * D
    # roll so the Earth->Mars axis points to the upper right on screen
    fwd = view_dir
    up0 = geo.unit(m_hat - (m_hat @ fwd) * fwd)
    ang = math.radians(-40)
    up = geo.rot_axis(fwd, ang) @ up0
    cam = geo.Camera.look(pos, np.zeros(3), up, fov, w=w, h=h)
    dx, dy = (cx - w / 2) / cam.f, (h / 2 - cy) / cam.f
    r, u, f_ = cam.R
    fw = geo.unit(f_ - dx * r - dy * u)
    return geo.Camera.look(pos, pos + fw, up, fov, w=w, h=h)


def earth_bulge(canvas, cam, eps, tl_alpha=1.0):
    """Exaggerated tidal bulge (translucent water shell) + Earth. Returns screen info + axis."""
    E = np.zeros(3)
    pc = cam.project(E)
    r = cam.f * math.tan(math.asin(geo.R_E / np.linalg.norm(cam.pos)))
    pm = cam.project(E + M_HAT * 20000)
    axis = geo.unit(np.array([pm[0] - pc[0], pm[1] - pc[1]]))
    ang = math.degrees(math.atan2(axis[1], axis[0]))
    a, b = r * (1 + eps), r * (1 - eps * 0.5)
    if eps > 0.002:
        draw.ellipse(canvas, (pc[0], pc[1]), (a + 3, b + 3), ang, OUT_C, 0.9 * tl_alpha)
        draw.ellipse(canvas, (pc[0], pc[1]), (a, b), ang, hexrgb("#62C6F2"), 0.78 * tl_alpha)
    info = planet.render(canvas, cam, "earth", E, planet.earth_axes(geo.T_HOOK))
    if eps > 0.002:
        draw.ellipse(canvas, (pc[0], pc[1]), (a, b), ang, (0.85, 0.96, 1.0), 0.9 * tl_alpha, fill=False, width=3)
    return info, axis, (pc[0], pc[1], r)


_S4END = None


def s5_match():
    global _S4END
    if _S4END is None:
        img, info = s4(21.999)
        _S4END = info.get("mars", dict(x=540, y=975, r_px=230))
    return _S4END


def harbor_card(tl, w=490, h=490):
    """Cartoon harbour at night, water rising along a tide gauge. tl: seconds since card shown."""
    ss = 2
    im = Image.new("RGB", (w * ss, h * ss))
    d = ImageDraw.Draw(im, "RGBA")
    for yy in range(0, h * ss, 4):
        k = yy / (h * ss)
        c = tuple(int(lerp(a_, b_, k)) for a_, b_ in zip((20, 26, 70), (92, 64, 104)))
        d.rectangle([0, yy, w * ss, yy + 4], fill=c)
    # Mars in the sky at its true angular size for this ~32 deg wide view (~15 px/deg)
    mx, my, mr = 360 * ss, 70 * ss, 7.6 * ss
    d.ellipse([mx - mr * 4, my - mr * 4, mx + mr * 4, my + mr * 4], fill=(255, 170, 110, 40))
    d.ellipse([mx - mr - 2, my - mr - 2, mx + mr + 2, my + mr + 2], fill=(11, 15, 36, 255))
    d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(226, 128, 70, 255))
    # far shore skyline
    rng = np.random.default_rng(4)
    x = 0
    while x < w * ss:
        bw, bh = int(rng.uniform(30, 70)) * ss // 2, int(rng.uniform(30, 120)) * ss // 2
        d.rectangle([x, 250 * ss - bh, x + bw, 250 * ss], fill=(32, 39, 84, 255))
        for yy in range(250 * ss - bh + 8, 250 * ss - 6, 14):
            for xx in range(x + 6, x + bw - 8, 12):
                if rng.random() < 0.3:
                    d.rectangle([xx, yy, xx + 5, yy + 6], fill=(255, 211, 122, 255))
        x += bw + 4
    level = 3.0 * ease_io((tl - 0.3) / 3.0)          # metres above normal high water
    PXM = 52 * ss                                       # pixels per metre at the gauge
    base_y = 400 * ss                                   # normal water line
    wl = base_y - level * PXM
    # quay wall (left) and dock on pilings
    d.rectangle([0, 300 * ss, 150 * ss, h * ss], fill=(72, 70, 98, 255), outline=(11, 15, 36, 255), width=3 * ss)
    for yy in range(300 * ss, h * ss, 22 * ss):
        d.line([(0, yy), (150 * ss, yy)], fill=(56, 54, 82, 255), width=2 * ss)
    dock_y = base_y - 1.4 * PXM
    d.rectangle([150 * ss, dock_y, 420 * ss, dock_y + 14 * ss], fill=(150, 98, 60, 255),
                outline=(11, 15, 36, 255), width=3 * ss)
    for px_ in (190, 270, 350, 410):
        d.rectangle([px_ * ss, dock_y + 14 * ss, (px_ + 10) * ss, h * ss], fill=(110, 72, 45, 255),
                    outline=(11, 15, 36, 255), width=2 * ss)
    # lamp posts on the quay
    for lx in (40, 112):
        d.rectangle([lx * ss, 220 * ss, (lx + 6) * ss, 300 * ss], fill=(30, 34, 64, 255))
        d.ellipse([(lx - 10) * ss, 206 * ss, (lx + 16) * ss, 232 * ss], fill=(255, 210, 120, 255))
        d.ellipse([(lx - 30) * ss, 186 * ss, (lx + 36) * ss, 252 * ss], fill=(255, 210, 120, 50))
    # tide gauge staff
    gx = 245 * ss
    d.rectangle([gx, base_y - 4.2 * PXM, gx + 26 * ss, h * ss], fill=(245, 245, 240, 255),
                outline=(11, 15, 36, 255), width=3 * ss)
    for mtr in range(0, 5):
        yy = base_y - mtr * PXM
        d.rectangle([gx, yy - 3 * ss, gx + 26 * ss, yy + 3 * ss], fill=(220, 60, 60, 255))
        for q in (0.25, 0.5, 0.75):
            d.line([(gx, yy - q * PXM), (gx + 12 * ss, yy - q * PXM)], fill=(20, 20, 30, 255), width=2 * ss)
    # small boat that floats up with the water
    bx, by = 330 * ss, wl - 6 * ss
    d.polygon([(bx - 60 * ss, by - 18 * ss), (bx + 60 * ss, by - 18 * ss), (bx + 44 * ss, by + 10 * ss),
               (bx - 44 * ss, by + 10 * ss)], fill=(232, 96, 80, 255), outline=(11, 15, 36, 255))
    d.rectangle([bx - 22 * ss, by - 44 * ss, bx + 18 * ss, by - 18 * ss], fill=(240, 236, 226, 255),
                outline=(11, 15, 36, 255), width=2 * ss)
    # water (translucent over submerged parts) with a wavy surface
    pts = [(0, h * ss)]
    for xx in range(0, w * ss + 8, 8):
        pts.append((xx, wl + 5 * ss * math.sin(xx / (26.0 * ss) + tl * 3.0)))
    pts.append((w * ss, h * ss))
    d.polygon(pts, fill=(38, 92, 170, 205))
    d.line(pts[1:-1], fill=(150, 210, 255, 255), width=4 * ss)
    for k in range(5):
        yy = wl + (30 + 34 * k) * ss
        d.line([(30 * ss + k * 40 * ss, yy), (110 * ss + k * 40 * ss, yy)], fill=(120, 180, 240, 160), width=3 * ss)
    im = im.resize((w, h), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0, level, (245 + 13, 400, 52)


def card(canvas, x0, y0, content, alpha=1.0, border=(0.86, 0.91, 1.0)):
    h, w = content.shape[:2]
    m = np.zeros((h, w), np.float32)
    cv2.rectangle(m, (0, 0), (w - 1, h - 1), 1.0, -1)
    rr = 28
    mk = np.zeros((h, w), np.uint8)
    cv2.rectangle(mk, (rr, 0), (w - rr, h), 255, -1)
    cv2.rectangle(mk, (0, rr), (w, h - rr), 255, -1)
    for cx_, cy_ in ((rr, rr), (w - rr, rr), (rr, h - rr), (w - rr, h - rr)):
        cv2.circle(mk, (cx_, cy_), rr, 255, -1, cv2.LINE_AA)
    a = (mk.astype(np.float32) / 255.0)[..., None] * alpha
    sub = canvas[y0:y0 + h, x0:x0 + w]
    sub[:] = sub * (1 - a) + content * a
    draw.rounded_rect(canvas, x0, y0, x0 + w, y0 + h, rr, OUT_C, alpha, fill=False, width=8)
    draw.rounded_rect(canvas, x0 + 3, y0 + 3, x0 + w - 3, y0 + h - 3, rr - 3, border, alpha, fill=False, width=3)


def s5(t):
    tl = t - 22.0
    m = s5_match()
    split = sstep((tl - 3.3) / 0.45)
    img = space_canvas()
    if split < 1:
        r_t = lerp(m["r_px"], 250.0, ease_io(tl / 1.2))
        cam = s5_earth_cam(r_t, m["x"], lerp(m["y"], 1000, ease_io(tl / 1.2)))
        space_stars(img, cam, t)
        eps = 0.16 * ease_out((tl - 0.35) / 1.0)
        info, axis, (ex, ey, er) = earth_bulge(img, cam, eps)
        if tl > 0.9:
            k = sstep((tl - 0.9) / 0.4)
            p0 = np.array([ex, ey]) + axis * (er * 1.2 + 10)
            p1 = np.array([ex, ey]) + axis * (er * 1.2 + 120)
            draw.arrow(img, p0, p1, (1.0, 0.72, 0.45), 6, 22, k, outline=OUT_C)
            label(img, [[("TO MARS", ORANGE)], [("384,000 km", BLUE)]], p1[1] + 64, t, 22.95, size=34,
                  cx=min(p1[0], 900), name="tomars")
            tag(img, "EXAGGERATED", ex - er * 0.55, ey - er * 1.22 - 10, t, 23.35, size=28)
        if split > 0:  # shrink toward the left card
            small = cv2.resize(img, (int(W * (1 - 0.55 * split)), int(H * (1 - 0.55 * split))))
            img2 = space_canvas()
            y0 = int(lerp(0, 735 - 300 * 0.45, split))
            x0 = int(lerp(0, 40, split))
            hh, ww = small.shape[:2]
            img2[y0:y0 + min(hh, H - y0), x0:x0 + min(ww, W - x0)] = small[:H - y0, :W - x0]
            img = img2
    if split > 0:
        # left card: Earth + bulge
        cw, chh = 490, 490
        cc = np.zeros((chh, cw, 3), np.float32) + SPACE_BG
        camc = s5_earth_cam(150.0, cw / 2 - 10, chh / 2 + 15, w=cw, h=chh)
        info, axis, (ex, ey, er) = earth_bulge(cc, camc, 0.16)
        p0 = np.array([ex, ey]) + axis * (er * 1.2 + 6)
        p1 = np.array([ex, ey]) + axis * (er * 1.2 + 64)
        draw.arrow(cc, p0, p1, (1.0, 0.72, 0.45), 5, 16, 1.0, outline=OUT_C)
        card(img, 40, 735, cc, split)
        hc, level, gauge = harbor_card(tl - 3.3)
        xo = int(lerp(W + 10, 550, split))
        if xo < W - 20:
            card(img, xo, 735, hc[:, :max(0, min(490, W - xo))], split, border=(1.0, 0.75, 0.3))
        if split >= 1:
            tag(img, "EXAGGERATED", 40 + 245, 735 + 455, t, 25.75, size=26)
            tag(img, "POSSIBLE", 550 + 245, 735 + 32, t, 25.75, size=26)
            gx, gy0, pxm = gauge
            for mtr in (1, 2, 3):
                label(img, [[(f"{mtr} m", WHITE)]], 735 + gy0 - mtr * pxm, t, 25.9, size=26,
                      cx=550 + gx + 52, name=f"gauge{mtr}")
            label(img, [[("+%.1f m" % level, AMBER)]], 735 + 440, t, 26.0, size=30, cx=550 + 300, name="level")
    # labels
    t_switch = 27.15
    tag(img, "ESTABLISHED", 540, 372, t, 22.75, t_out=t_switch)
    label(img, [[("TIDAL PULL ", WHITE), ("~9×", AMBER), (" THE MOON'S", WHITE)]], 452, t, 22.8, size=60,
          t_out=t_switch, name="s5a")
    label(img, [[("(8.7× at the same distance)", BLUE)]], 530, t, 23.2, size=34, path=ov.F_B, t_out=t_switch,
          name="s5a2")
    tag(img, "UNCERTAIN", 540, 372, t, t_switch + 0.15)
    label(img, [[("UP TO ", WHITE), ("SEVERAL METERS,", AMBER)], [("FOR A FEW HOURS", WHITE)]], 482, t,
          t_switch + 0.25, size=58, name="s5b")
    label(img, [[("Oceans can't fully respond in hours: heights uncertain", BLUE)]], 606, t, t_switch + 0.6,
          size=28, path=ov.F_B, name="s5b2")
    return img, {}


# ================================================================== SCENE 6
S6_SCALE = 926.0            # km per pixel
S6_E = np.array([330.0, 1085.0])


def s6_xy(X):
    X = np.atleast_2d(X)
    p = X @ sc.P_HAT
    q = X @ sc.Q_HAT
    return np.stack([S6_E[0] + p / S6_SCALE, S6_E[1] - q / S6_SCALE], 1)


def s6_grid(img):
    for k in range(-12, 13):
        x = S6_E[0] + k * 100000 / S6_SCALE
        y = S6_E[1] + k * 100000 / S6_SCALE
        c = 0.09 if k % 5 else 0.16
        if 0 <= x < W:
            img[:, int(x)] += (hexrgb("#5A73C8") - img[:, int(x)]) * c
        if 0 <= y < H:
            img[int(y), :] += (hexrgb("#5A73C8") - img[int(y), :]) * c


def tiny_body(img, xy, r, kind, ring=True, name=None, t=0, t_in=0, label_dx=0, label_dy=-1):
    col = {"earth": hexrgb("#3C86C6"), "mars": hexrgb("#E07A3F"), "moon": hexrgb("#E8E3D6")}[kind]
    draw.circle(img, xy, r + 1.5, OUT_C, fill=True)
    draw.circle(img, xy, r, col, fill=True)
    # night half (Sun is to the left in this view)
    if r > 3:
        draw.polygon(img, [(xy[0], xy[1] - r), (xy[0] + r, xy[1] - r), (xy[0] + r, xy[1] + r), (xy[0], xy[1] + r)],
                     (0.08, 0.1, 0.25), 0.55)
    if ring:
        draw.circle(img, xy, r + 16, (0.85, 0.9, 1.0), 2, 0.55)
    if name:
        label(img, [[(name, BLUE)]], xy[1] + label_dy * (r + 40), t, t_in, size=30, cx=xy[0] + label_dx,
              name="s6:" + name)


def s6(t):
    tl = t - 29.0
    img = np.zeros((H, W, 3), np.float32) + hexrgb("#0A1030")
    s6_grid(img)
    # Moon's orbit for scale
    draw.dashed_circle(img, S6_E, 384400 / S6_SCALE, (0.55, 0.65, 0.95), 2, n=120, duty=0.5, alpha=0.7)
    # straight 'no gravity' line (incoming asymptote)
    a0, a1 = geo.mars_km(-90 * 3600), geo.mars_km(-70 * 3600)
    p0, p1 = s6_xy(a0)[0], s6_xy(a1)[0]
    u = geo.unit(p1 - p0)
    L0 = p0 - u * 3000
    L1 = p0 + u * 6000
    draw.dashed(img, L0, L1, (0.9, 0.93, 1.0), 3, dash=18, gap=12, alpha=0.75)
    # real path up to the current Mars position
    td = lerp(-3.5, 13.0, ease_io((tl - 0.3) / 4.3)) * 3600
    ahead = s6_xy(np.array([geo.mars_km(x) for x in np.linspace(td, 80 * 3600, 160)]))
    draw.polyline(img, list(ahead), (1.0, 0.62, 0.30), 3, 0.45)
    ts_ = np.linspace(-80 * 3600, td, 240)
    path = s6_xy(np.array([geo.mars_km(x) for x in ts_]))
    draw.polyline(img, list(path), (1.0, 0.62, 0.30), 5, 1.0, outline=OUT_C, outline_w=2)
    # Earth nudge (exaggerated): Earth shifts toward periapsis as Mars passes
    nudge = 9.0 * sstep((td / 3600 + 4) / 10)
    e_xy = S6_E + np.array([nudge, 0])
    tiny_body(img, e_xy, 6.9, "earth", name="EARTH", t=t, t_in=29.2, label_dy=1)
    mpos = geo.MOON_POS
    tiny_body(img, s6_xy(mpos)[0], 2.2, "moon", ring=True, name="MOON", t=t, t_in=29.3, label_dx=-70, label_dy=0)
    mxy = s6_xy(geo.mars_km(td))[0]
    tiny_body(img, mxy, 3.7, "mars", ring=True)
    label(img, [[("MARS", ORANGE)]], mxy[1], t, 29.3, size=32, cx=mxy[0] + 92, name="s6:mars")
    # deflection arc + label
    k = sstep((tl - 2.6) / 0.5)
    if k > 0:
        peri = s6_xy(geo.mars_km(0.0))[0]
        far = s6_xy(geo.mars_km(60 * 3600))[0]
        v_out = geo.unit(far - peri)
        ang_out = math.atan2(v_out[1], v_out[0])
        ang_in = math.atan2(u[1], u[0])
        Rr = 680.0
        draw.arc(img, peri, Rr, ang_in, ang_out, (1.0, 0.8, 0.4), 4, k)
        tip = peri + Rr * np.array([math.cos((ang_in + ang_out) / 2), math.sin((ang_in + ang_out) / 2)])
        label(img, [[("1.3°", AMBER)]], tip[1] + 4, t, 31.6, size=40, cx=tip[0] + 70, name="s6:deg")
    tag(img, "ESTABLISHED", 72, 372, t, 31.55, anchor="left")
    label(img, [[("MARS DEFLECTS ", WHITE), ("~1.3°", AMBER)]], 446, t, 31.6, size=54, cx=72, align="left",
          anchor="left", name="s6a")
    label(img, [[("dashed line = path with no gravity", BLUE)]], 500, t, 30.0, size=27, cx=72, path=ov.F_B,
          align="left", anchor="left", name="s6legend")
    if tl > 3.5:
        k2 = sstep((tl - 3.5) / 0.4)
        draw.arrow(img, e_xy + np.array([12, 0]), e_xy + np.array([12 + 90 * k2, 0]), (0.5, 1.0, 0.85), 5, 16, k2,
                   outline=OUT_C)
        label(img, [[("Δv ≈ 22 m/s", (128, 255, 216))]], e_xy[1] - 46, t, 32.6, size=32, cx=e_xy[0] + 70,
              name="s6:dv")
        tag(img, "EXAGGERATED", e_xy[0] + 80, e_xy[1] - 94, t, 32.7, size=26)
    label(img, [[("EARTH'S YEAR", WHITE)], [("BARELY CHANGES", WHITE)]], 568, t, 33.8, size=50, cx=72,
          align="left", anchor="left", name="s6b")
    label(img, [[("at most ~0.2% (a few hours here)", BLUE)]], 672, t, 34.1, size=30, cx=72, path=ov.F_B,
          align="left", anchor="left", name="s6b2")
    return img, {}


# ================================================================== SCENE 8 (needed by 7)
def s8_cam(tl):
    m = geo.mars_km(s8_time(tl))
    mh = geo.unit(m)
    n = geo.unit(np.cross(sc.P_HAT, sc.Q_HAT))            # normal of Mars's track plane
    pos = -mh * 26000.0 + n * 8000.0
    return cam_with_target_on_screen(pos, m, n, 36.0, 545, 790)


def s8_time(tl):
    return math.exp(lerp(math.log(2.0), math.log(260.0), ease_io(tl / 2.8))) * 3600


def s8_scene(t):
    tl = min(t, 44.0) - 41.0
    cam = s8_cam(tl)
    img = space_canvas()
    space_stars(img, cam, min(t, 44.0))
    ts = s8_time(tl)
    m = geo.mars_km(ts)
    ax = planet.body_axes_facing(m - geo.OBS_HOOK, 12, -75, geo.ZENITH_HOOK)
    mi = planet.render(img, cam, "mars", m, ax)
    if mi is not None and mi["r_px"] < 8:   # keep the receding dot visible: soft red glow
        x, y = int(mi["x"]), int(mi["y"])
        g = 30
        yy, xx = np.mgrid[y - g:y + g, x - g:x + g]
        rr = np.sqrt((xx - mi["x"]) ** 2 + (yy - mi["y"]) ** 2)
        a = np.clip(1 - rr / g, 0, 1) ** 2 * 0.75
        img[y - g:y + g, x - g:x + g] += (hexrgb("#FF7A45") - img[y - g:y + g, x - g:x + g]) * a[..., None]
    ei = planet.render(img, cam, "earth", np.zeros(3), planet.earth_axes(geo.T_HOOK + tl * 900))
    return img, {"mars": mi, "earth": ei}


def s8(t):
    img, info = s8_scene(t)
    tt = min(t, 44.0)
    label(img, [[("WOULD YOU ", WHITE), ("STAY AND WATCH,", ORANGE)], [("OR ", WHITE), ("MOVE INLAND?", ORANGE)]],
          470, tt, 42.3, size=54, name="cta1")
    s_, a_ = ov.pop(tt, 43.0)
    if a_ > 0:
        im = ov.tag_img("COMMENT BELOW ↓", 40) if "COMMENT BELOW ↓" in ov.TAG else None
        if im is None:
            ov.TAG["COMMENT BELOW ↓"] = ((255, 159, 67), ov.DARK)
            im = ov.tag_img("COMMENT BELOW ↓", 40)
        ov.place(img, im, 540, 610, s_, a_, name="cta2")
    if info.get("mars") and 41.4 < tt:
        mi = info["mars"]
        label(img, [[("MARS, LEAVING", BLUE)]], mi["y"] + max(mi["r_px"], 6) + 40, tt, 41.5, size=30,
              cx=mi["x"], t_out=42.2, name="leaving")
    return img, info


# ================================================================== SCENE 7
_S7BG = None


def s7_bg():
    global _S7BG
    if _S7BG is None:
        img, _ = s8_scene(41.0)
        small = cv2.resize(img, (W // 6, H // 6), interpolation=cv2.INTER_AREA)
        _S7BG = cv2.resize(cv2.GaussianBlur(small, (0, 0), 2.0), (W, H), interpolation=cv2.INTER_CUBIC)
    return _S7BG


def icon(img, kind, c, k):
    x, y = c
    if k <= 0:
        return
    teal, amber, white = (0.18, 0.77, 0.71), (1.0, 0.72, 0.19), (1, 1, 1)
    if kind == "gravity":
        draw.circle(img, (x - 34, y), 20, OUT_C, fill=True, alpha=k); draw.circle(img, (x - 34, y), 17, (0.24, 0.53, 0.78), fill=True, alpha=k)
        draw.circle(img, (x + 38, y), 13, OUT_C, fill=True, alpha=k); draw.circle(img, (x + 38, y), 10, (0.88, 0.48, 0.25), fill=True, alpha=k)
        draw.arrow(img, (x - 6, y), (x + 18, y), teal, 4, 10, k); draw.arrow(img, (x + 14, y + 0.1), (x - 10, y + 0.1), teal, 4, 10, k)
    elif kind == "size":
        draw.circle(img, (x - 24, y), 24, OUT_C, fill=True, alpha=k); draw.circle(img, (x - 24, y), 21, (0.88, 0.48, 0.25), fill=True, alpha=k)
        draw.circle(img, (x + 30, y + 10), 13, OUT_C, fill=True, alpha=k); draw.circle(img, (x + 30, y + 10), 10.5, (0.92, 0.9, 0.85), fill=True, alpha=k)
    elif kind == "orbit":
        pts = [(x - 46 + 92 * s_, y + 22 - 50 * s_ + 18 * s_ * s_) for s_ in np.linspace(0, 1, 30)]
        draw.polyline(img, pts, teal, 5, k, outline=OUT_C, outline_w=2)
        draw.arrow(img, pts[-4], pts[-1], teal, 5, 14, k)
    elif kind == "flood":
        for j in range(2):
            pts = [(x - 46 + s_, y - 8 + 14 * j + 7 * math.sin(s_ / 9.0)) for s_ in range(0, 93, 3)]
            draw.polyline(img, pts, (0.4, 0.75, 1.0), 5, k, outline=OUT_C, outline_w=2)
        draw.lines(img, [((x + 30, y - 34), (x + 30, y + 26))], white, 3, k)
    elif kind == "quake":
        pts = [(x - 48, y), (x - 30, y), (x - 22, y - 22), (x - 10, y + 24), (x + 2, y - 30), (x + 14, y + 18),
               (x + 24, y - 10), (x + 32, y), (x + 48, y)]
        draw.polyline(img, pts, amber, 5, k, outline=OUT_C, outline_w=2)
    elif kind == "moon":
        draw.circle(img, (x - 10, y), 24, OUT_C, fill=True, alpha=k); draw.circle(img, (x - 10, y), 21, (0.93, 0.91, 0.85), fill=True, alpha=k)
    elif kind == "climate":
        draw.rounded_rect(img, x - 8, y - 32, x + 8, y + 16, 8, OUT_C, k)
        draw.circle(img, (x, y + 20), 14, OUT_C, fill=True, alpha=k)
        draw.circle(img, (x, y + 20), 11, (1.0, 0.45, 0.35), fill=True, alpha=k)
        draw.rounded_rect(img, x - 4, y - 26, x + 4, y + 16, 4, (1.0, 0.45, 0.35), k)


def s7(t):
    img = s7_bg() * 0.42 + hexrgb("#0A1030") * 0.25
    img = img.astype(np.float32).copy()
    out = sstep((t - 40.72) / 0.28)
    if out > 0:
        bg, _ = s8_scene(41.0)
        img = img * (1 - out) + bg * out
    colw = [(64, 492), (512, 940)]
    a = 1 - out
    for (x0, x1), col in zip(colw, ((0.18, 0.77, 0.71), (1.0, 0.72, 0.19))):
        k = sstep((t - (35.96 if x0 == 64 else 37.68)) / 0.3) * a
        if k > 0:
            draw.rounded_rect(img, x0, 330, x1, 1232, 30, (0.04, 0.06, 0.15), 0.78 * k)
            draw.rounded_rect(img, x0, 330, x1, 1232, 30, col, k, fill=False, width=4)
    if a > 0.02:
        tag(img, "CERTAIN", 278, 392, t, 35.96, t_out=40.72, size=40)
        tag(img, "UNCERTAIN", 726, 392, t, 37.72, t_out=40.72, size=40)
        items_l = [("gravity", "GRAVITY", 36.70), ("size", "SIZE", 36.92), ("orbit", "ORBIT BENDING", 37.14)]
        items_r = [("flood", "FLOOD HEIGHTS", 38.58), ("quake", "QUAKES", 39.40), ("moon", "THE MOON", 40.28),
                   ("climate", "LONG-TERM CLIMATE", 40.42)]
        for j, (ic, txt, t0) in enumerate(items_l):
            y = 520 + j * 190
            icon(img, ic, (278, y), sstep((t - t0) / 0.25) * a)
            label(img, [[(txt, WHITE)]], y + 62, t, t0, size=38, cx=278, t_out=40.72, name="s7l" + str(j))
        for j, (ic, txt, t0) in enumerate(items_r):
            y = 520 + j * 182
            icon(img, ic, (726, y), sstep((t - t0) / 0.25) * a)
            if ic == "moon":
                label(img, [[("?", AMBER)]], y, t, t0, size=48, cx=760, t_out=40.72, name="s7moonq")
            label(img, [[(txt, WHITE)]], y + 60, t, t0, size=34 if len(txt) > 14 else 38, cx=726, t_out=40.72,
                  name="s7r" + str(j))
    return img, {}


# ================================================================== assembly
SCENE_FUNCS = [s1, s2, s3, s4, s5, s6, s7, s8]


def whip(img, amount, direction):
    """Vertical whip-pan: motion blur + shift. amount 0..1."""
    if amount <= 0:
        return img
    L = int(6 + 150 * amount)
    k = np.zeros((L, 1), np.float32)
    k[:, 0] = 1.0 / L
    b = cv2.filter2D(img, -1, k)
    shift = int(direction * 520 * amount ** 2)
    return np.roll(b, shift, axis=0)


_rng_g = np.random.default_rng(77)
GRAIN = _rng_g.normal(0, 1, (8, H, W)).astype(np.float32)
_yy, _xx = np.mgrid[0:H, 0:W]
VIGNETTE = (1 - 0.16 * (((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2) ** 1.4).astype(np.float32)
del _yy, _xx


def grade(img, fi):
    img = img * VIGNETTE[..., None]
    lum = img.mean(-1, keepdims=True)
    img = img + (hexrgb("#101640") - img) * (0.06 * (1 - lum))          # cool lift in shadows
    img = img * (1 + 0.03 * lum * np.array([1.0, 0.4, -0.6], np.float32))  # touch of warmth in highlights
    img = img + GRAIN[fi % 8][..., None] * 0.010
    return np.clip(img, 0, 1)


def frame(t, fi=None):
    if fi is None:
        fi = int(round(t * FPS))
    ov.CURRENT_FRAME[0] = fi
    tq = min(t, 44.0)                     # final second is a static hold of the 44.0 s frame
    i = max(j for j in range(len(CUTS) - 1) if CUTS[j] <= tq)
    img, info = SCENE_FUNCS[i](tq)
    if 28.72 <= tq < 29.0:
        img = whip(img, sstep((tq - 28.72) / 0.28), -1)
    elif 29.0 <= tq < 29.22:
        img = whip(img, 1 - sstep((tq - 29.0) / 0.22), 1)
    img = grade(img, int(round(tq * FPS)))
    ov.draw_subtitles(img, PAGES, tq)
    return img, info

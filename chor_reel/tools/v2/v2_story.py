"""Frames 356-1471: the room and the starfield - characters, camera, transitions (FX in v2_fx)."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L
import v2_room as RM
from v2_room import W, H, NARR, THIEF

# ---------------------------------------------------------------- shots and cameras (z, cx, cy)
SHOTS = [
    ('S4', 349, 407, [(349, (1.00, 540, 985)), (407, (1.05, 540, 985))]),
    ('S5', 408, 464, None),                                        # hand close-up (separate composition)
    ('S6', 465, 547, [(465, (1.90, 330, 1185)), (547, (2.02, 330, 1175))]),
    ('S7', 548, 690, [(548, (1.00, 540, 995)), (690, (1.08, 525, 990))]),
    ('S8', 691, 790, [(691, (1.42, 430, 905)), (790, (1.50, 430, 900))]),
    ('S9', 781, 899, [(781, (1.00, 540, 985)), (899, (1.04, 540, 985))]),
    ('S10', 890, 971, [(890, (1.00, 540, 985)), (971, (1.05, 540, 985))]),
    ('S11', 962, 1028, [(962, (1.32, 360, 1150)), (1028, (1.38, 360, 1145))]),
    ('S12', 1021, 1090, [(1021, (1.12, 430, 1050)), (1090, (1.20, 430, 1040))]),
    ('S13', 1082, 1149, [(1082, (1.00, 540, 985)), (1149, (1.04, 540, 985))]),
    ('S14', 1141, 1209, [(1141, (1.32, 380, 1080)), (1209, (1.40, 380, 1070))]),
    ('S15', 1200, 1430, [(1200, (1.08, 540, 1000)), (1430, (0.93, 540, 1000))]),
    ('S16', 1431, 1469, [(1431, (0.93, 540, 1000)), (1469, (0.93, 540, 985))]),
    ('S17', 1470, 1590, [(1470, (0.93, 540, 985)), (1590, (0.90, 540, 950))]),
]
# cross-dissolves (a, b, from-shot, to-shot), as in the original film
DISSOLVES = [(781, 790, 'S8', 'S9'), (962, 971, 'S10', 'S11'), (1021, 1028, 'S11', 'S12'), (1082, 1090, 'S12', 'S13'),
             (1141, 1149, 'S13', 'S14'), (1200, 1209, 'S14', 'S15')]
HARD = {408: 'S5', 465: 'S6', 548: 'S7', 691: 'S8', 890: 'S10'}


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def cam_of(sid, n):
    for s_, a, b, keys in SHOTS:
        if s_ == sid:
            (n0, c0), (n1, c1) = keys[0], keys[-1]
            t = ease((n - n0) / max(1, n1 - n0))
            return tuple(c0[i] * (1 - t) + c1[i] * t for i in range(3))
    raise KeyError(sid)


def shots_at(n):
    """[(sid, weight)] for frame n (two entries inside a dissolve)."""
    for a, b, s0, s1 in DISSOLVES:
        if a <= n <= b:
            t = (n - a + 0.5) / (b - a + 1)
            return [(s0, 1 - t), (s1, t)]
    cur = None
    for s_, a, b, keys in SHOTS:
        if a <= n <= b:
            cur = s_
    # prefer the shot that starts latest (hard cuts)
    best = None
    for s_, a, b, keys in SHOTS:
        if a <= n <= b and (best is None or a > best[1]):
            best = (s_, a)
    return [(best[0], 1.0)]


# ---------------------------------------------------------------- character timelines
TALK = [(466, 488), (642, 668), (713, 735), (773, 793), (833, 853), (894, 914), (953, 973), (1013, 1033), (1073, 1093),
        (1133, 1153), (1194, 1214), (1253, 1273), (1312, 1336)]


def pingpong(i, m):
    p = 2 * (m - 1)
    i = i % p
    return i if i < m else p - i


def narrator_index(n):
    for a, b in TALK:
        if a <= n <= b:
            return pingpong((n - a) // 2, 6)
    return pingpong(n // 7, 2)


def star_k(n):
    """room -> starfield dissolve"""
    return ease((n - 880) / 20.0)


def thief_state(n):
    """[(sprite, index, weight)], x (feet), y (feet), bob"""
    nr = len(RM.spr('reach')[0])
    ni = len(RM.spr('idle')[0])
    x, y = THIEF['x'], THIEF['y']
    bob = 0.0
    if n < 368:
        t = (n - 356) / 12.0
        x = 1260 + (THIEF['x'] - 1260) * (1 - (1 - t) ** 1.7)
        bob = abs(math.sin(n / 6.0 * math.pi)) * 10
        return [('idle', pingpong(n // 2, ni), 1.0)], x, y, bob
    if n < 375:
        return [('idle', pingpong(n // 3, ni), 1.0)], x, y, bob
    if n < 383:
        return [('reach', int(round(ease((n - 374) / 8.0) * 27)), 1.0)], x, y, bob
    if n < 1404:
        return [('reach', 24 + pingpong(n // 4, nr - 24), 1.0)], x, y, bob
    if n < 1410:
        return [('reach', int(round(27 * (1 - ease((n - 1403) / 6.0)))), 1.0)], x, y, bob
    return [('idle', pingpong(n // 3, ni), 1.0)], x, y, bob


def thief_height(name):
    return THIEF['h'] * (1.0 if name == 'reach' else 0.985)


# ---------------------------------------------------------------- frame
def base_layers(n, cam):
    st = RM.build_sets()
    k = star_k(n)
    flick = 1 + 0.035 * math.sin(n * 0.9) + 0.02 * math.sin(n * 2.3 + 1)
    img = None
    if k < 1:
        room = RM.view(st['room'], cam)
        lm = RM.view(st['lamp'], cam)
        room = room * (1 + (flick - 1) * 0.8 * lm[..., None])
        img = room
    if k > 0:
        star = RM.view(st['star'], cam)
        fa = RM.view(st['frame_a'], cam)[..., None]
        fr = RM.view(st['frame'], cam)
        star = star * (1 - fa) + fr * fa
        img = star if img is None else img * (1 - k) + star * k
    return img, k


def render_shot(n, sid, fx=None):
    """Full composite of shot `sid` at frame n."""
    if sid == 'S5':
        import v2_fx
        return v2_fx.hand_closeup(n)
    cam = cam_of(sid, n)
    img, k = base_layers(n, cam)
    # --- narrator
    ni = narrator_index(n)
    arr, g = RM.spr('thin_st')
    Mn = RM.feet_matrix('thin_st', NARR['x'], NARR['y'], NARR['h'] * (1 + 0.004 * math.sin(n * 0.12)))
    nstar = ease((n - 1215) / 40.0)                                  # 'take my standing' - he turns to stars
    pm_n = RM.room_lit(arr[ni], (6, 2), (2, -6), star=nstar, n=n, seed=3)
    # --- thief
    parts, tx, ty, bob = thief_state(n)
    pm_t = None
    Mt = None
    for nm, idx, wt in parts:
        a_, g_ = RM.spr(nm)
        Mt_ = RM.feet_matrix(nm, tx, ty - bob, thief_height(nm))
        p_ = RM.room_lit(a_[idx], (-6, 2), (-2, -6))
        pm_t, Mt = p_, Mt_
    # wall shadows (room phase only)
    import v2_fx
    if k < 1:
        sx_M, sx_k = v2_fx.shadow_extra(n)
        if sx_k > 0:
            RM.shadow_on_wall(img, cam, pm_n[..., 3], Mn, strength=0.50 * (1 - k) * sx_k, extra=sx_M)
        RM.shadow_on_wall(img, cam, pm_t[..., 3], Mt, strength=0.42 * (1 - k))
    RM.contact_shadow(img, cam, NARR['x'] + 10, NARR['y'] - 4, 120)
    RM.contact_shadow(img, cam, tx, ty - 4, 150, k=1 - ease((n - 1426) / 20.0))
    import v2_fx
    v2_fx.behind_characters(img, n, sid, cam)
    Mc = RM.cam_matrix(cam)
    RM.place(img, pm_n, RM.compose(Mc, Mn))
    if not v2_fx.thief_dissolving(n):
        RM.place(img, pm_t, RM.compose(Mc, Mt))
    else:
        v2_fx.dissolve_thief(img, n, pm_t, RM.compose(Mc, Mt))
    v2_fx.front_of_characters(img, n, sid, cam)
    RM.draw_lamp(img, cam, n, flame_k=v2_fx.lamp_flame(n))
    v2_fx.lamp_smoke(img, n, cam)
    return img


def render_frame(n):
    out = None
    for sid, wt in shots_at(n):
        im = render_shot(n, sid, fx={})
        out = im * wt if out is None else out + im * wt
    return out


if __name__ == '__main__':
    od = RM.S + '/v2/look'
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/story_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('ok', n, flush=True)

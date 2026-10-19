"""Render the picture of "WHAT IF YOU FELL INTO JUPITER?".

Everything is procedural: GLSL shaders (shaders/) draw Jupiter, the
atmosphere and the astronaut; this script drives cameras, animation and the
post-processing chain, and pipes finished frames to ffmpeg.

Run under a virtual display (llvmpipe software OpenGL):
  xvfb-run -a python3 render.py --shot 1A            # one shot -> frames/1A.mkv
  xvfb-run -a python3 render.py --preview 0,2.5,4.9  # PNG stills
"""
import argparse
import math
import os
import subprocess
import time as _time

import moderngl
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import astro
import timeline as TL

HERE = os.path.dirname(os.path.abspath(__file__))
SHADERS = os.path.join(HERE, "shaders")
R_JUP_KM = 71492.0


# ----------------------------------------------------------------------------
# small math helpers
# ----------------------------------------------------------------------------
def norm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * x * (x * (x * 6 - 15) + 10)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, a, b):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x, 0, 1)
    return 1 - (1 - x) ** 3


def ease_in(x):
    x = clamp(x, 0, 1)
    return x ** 3


def look_at(eye, target, up=(0, 1, 0), roll=0.0):
    f = norm(np.asarray(target, float) - np.asarray(eye, float))
    r = np.cross(f, np.asarray(up, float))
    if np.linalg.norm(r) < 1e-8:
        r = np.cross(f, np.array([0, 0, 1.0]))
    r = norm(r)
    u = np.cross(r, f)
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        r, u = r * c + u * s, -r * s + u * c
    return np.stack([r, u, f], axis=1)


def latlon(lat_deg, lon_deg):
    la, lo = math.radians(lat_deg), math.radians(lon_deg)
    return np.array([math.cos(la) * math.cos(lo), math.sin(la), math.cos(la) * math.sin(lo)])


def noise1(t, seed=0.0, octaves=3):
    """Smooth deterministic 1D noise in about [-1, 1]."""
    s, a, n = 0.0, 1.0, 0.0
    for i in range(octaves):
        f = 1.7 ** i
        s += a * math.sin(t * f * 1.31 + seed * 12.9898 + i * 4.1) * math.cos(t * f * 0.71 + seed * 78.233 + i * 1.7)
        n += a
        a *= 0.55
    return s / n * 1.6


def srgb_to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hexc(h):
    h = h.lstrip("#")
    return srgb_to_lin(np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0)


# ----------------------------------------------------------------------------
# Jupiter's look: latitude bands and storms
# ----------------------------------------------------------------------------
# (north edge, south edge, colour, turbulence)
BANDS = [
    (90, 68, "#7c8089", 0.85),
    (68, 57, "#918a82", 0.7),
    (57, 50, "#a88c70", 0.6),
    (50, 44, "#cbbba3", 0.45),
    (44, 38, "#b38d68", 0.6),
    (38, 31, "#efe0c4", 0.3),
    (31, 24, "#bd7a49", 0.75),
    (24, 17, "#f6e7cb", 0.3),
    (17, 13, "#c06c38", 0.95),
    (13, 7.5, "#a3552d", 1.0),
    (7.5, 2, "#f3dbb0", 0.55),
    (2, -2, "#e9c58f", 0.5),
    (-2, -7.5, "#f2d9ad", 0.55),
    (-7.5, -12, "#a85a30", 1.0),
    (-12, -19, "#c4743f", 0.95),
    (-19, -27, "#f5e6ca", 0.35),
    (-27, -34, "#b8865c", 0.7),
    (-34, -40, "#ece0c6", 0.3),
    (-40, -46, "#b49372", 0.55),
    (-46, -52, "#cdbfa9", 0.45),
    (-52, -60, "#a58e78", 0.6),
    (-60, -68, "#8f8a84", 0.7),
    (-68, -90, "#7d8189", 0.85),
]


def band_texture(n=2048):
    lat = np.linspace(-90, 90, n)
    col = np.zeros((n, 3))
    turb = np.zeros(n)
    for (top, bot, hx, tb) in BANDS:
        m = (lat <= top) & (lat >= bot)
        col[m] = hexc(hx)
        turb[m] = tb
    # soften the edges a little (about 0.7 degrees)
    k = np.exp(-0.5 * (np.arange(-24, 25) * (180.0 / n) / 0.7) ** 2)
    k /= k.sum()
    pad = 24
    for c in range(3):
        col[:, c] = np.convolve(np.pad(col[:, c], pad, mode="edge"), k, mode="same")[pad:-pad]
    turb = np.convolve(np.pad(turb, pad, mode="edge"), k, mode="same")[pad:-pad]
    data = np.concatenate([col, turb[:, None]], axis=1).astype("f4")
    return data


GRS_LAT, GRS_LON = -22.5, 0.0


def storm_list():
    rng = np.random.RandomState(7)
    v = []

    def add(lat, lon, rad_deg, twist, aspect, tint=0.0, kind=0.0):
        v.append((latlon(lat, lon), math.radians(rad_deg), twist, aspect, tint, kind))

    # white ovals in the south temperate belt (anticyclones: counter-clockwise in the south)
    for lon in (-40, -26, 32, 55):
        add(-36 + rng.uniform(-1, 1), lon, 2.4, 3.0, 1.45, 0.85, 0)
    add(-33.5, 14, 3.0, 3.2, 1.35, 0.7, 2)          # a reddish oval (like Oval BA)
    # brown barges (cyclones) in the north equatorial belt
    for lon in (-30, -8, 20):
        add(15.5, lon, 1.6, 2.5, 2.2, 0.75, 1)
    # small white ovals in the north tropical zone (anticyclones: clockwise in the north)
    for lon in (-18, 12, 40):
        add(20.0, lon, 1.3, -2.8, 1.5, 0.6, 0)
    # turbulent eddies in the belts
    for _ in range(9):
        lat = rng.choice([-15, -10, 10, 14, -29, 27])
        add(lat + rng.uniform(-2, 2), rng.uniform(-50, 50), rng.uniform(1.0, 2.2),
            rng.uniform(1.5, 3.5) * rng.choice([-1, 1]), rng.uniform(1.2, 2.0))
    # polar cyclones
    for _ in range(8):
        lat = rng.choice([1, -1]) * rng.uniform(58, 74)
        add(lat, rng.uniform(-60, 60), rng.uniform(2.5, 4.5), 3.2 * np.sign(lat), 1.2)
    return v[:40]


# ----------------------------------------------------------------------------
# GL plumbing
# ----------------------------------------------------------------------------
def load_src(name):
    src = open(os.path.join(SHADERS, name)).read()
    out = []
    for line in src.splitlines():
        s = line.strip()
        if s.startswith("#include"):
            inc = s.split('"')[1]
            out.append(load_src(inc))
        else:
            out.append(line)
    return "\n".join(out)


class Prog:
    def __init__(self, ctx, frag, vbo):
        self.p = ctx.program(vertex_shader=load_src("fullscreen.vert"), fragment_shader=load_src(frag))
        self.vao = ctx.vertex_array(self.p, [(vbo, "2f", "aPos")])

    def set(self, name, value):
        if name not in self.p:
            return
        u = self.p[name]
        if isinstance(value, np.ndarray):
            if value.ndim == 2 and value.shape == (3, 3):
                u.write(value.astype("f4").flatten(order="F").tobytes())
            else:
                u.write(value.astype("f4").tobytes())
        elif isinstance(value, (list, tuple)) and value and isinstance(value[0], np.ndarray) and value[0].shape == (3, 3):
            u.write(np.concatenate([m.astype("f4").flatten(order="F") for m in value]).tobytes())
        elif isinstance(value, bool):
            u.value = int(value)
        else:
            u.value = value

    def setmany(self, d):
        for k, v in d.items():
            self.set(k, v)

    def run(self):
        self.vao.render(moderngl.TRIANGLES)


class Renderer:
    def __init__(self, scale=2.0, out_w=TL.OUT_W, out_h=TL.OUT_H):
        self.ctx = moderngl.create_standalone_context(require=430)
        ctx = self.ctx
        self.out_w, self.out_h = out_w, out_h
        self.scale = scale
        self.iw, self.ih = int(round(out_w * scale)), int(round(out_h * scale))
        self.vbo = ctx.buffer(np.array([-1, -1, 3, -1, -1, 3], dtype="f4"))
        self.space = Prog(ctx, "space.frag", self.vbo)
        self.atmo = None
        if os.path.exists(os.path.join(SHADERS, "atmo.frag")):
            self.atmo = Prog(ctx, "atmo.frag", self.vbo)
            self.atmo_comp = Prog(ctx, "atmo_comp.frag", self.vbo)
        self.bright = Prog(ctx, "bright.frag", self.vbo)
        self.blur = Prog(ctx, "blur.frag", self.vbo)
        self.post = Prog(ctx, "post.frag", self.vbo)

        def tex(w, h, comps=4, dtype="f2"):
            t = ctx.texture((w, h), comps, dtype=dtype)
            t.filter = (moderngl.LINEAR, moderngl.LINEAR)
            t.repeat_x = t.repeat_y = False
            return t

        self.tex = tex
        self.scene = tex(self.iw, self.ih)
        self.scene_fbo = ctx.framebuffer([self.scene])
        # atmosphere volume at output resolution (composited at internal res)
        self.vol = tex(out_w, out_h)
        self.vol_fbo = ctx.framebuffer([self.vol])
        self.bloom = []
        w, h = out_w // 2, out_h // 2
        for _ in range(3):
            a, b = tex(w, h), tex(w, h)
            self.bloom.append((a, ctx.framebuffer([a]), b, ctx.framebuffer([b]), (w, h)))
            w, h = w // 2, h // 2
        self.out = ctx.texture((out_w, out_h), 4)
        self.out_fbo = ctx.framebuffer([self.out])

        bands = band_texture()
        self.bands = ctx.texture((bands.shape[0], 1), 4, bands.tobytes(), dtype="f4")
        self.bands.filter = (moderngl.LINEAR, moderngl.LINEAR)
        self.bands.repeat_x = self.bands.repeat_y = False

        storms = storm_list()
        A = np.zeros((40, 4), "f4")
        B = np.zeros((40, 4), "f4")
        for i, (c, r, tw, asp, tint, kind) in enumerate(storms):
            A[i] = (*c, r)
            B[i] = (tw, asp, tint, kind)
        self.storm_A, self.storm_B, self.n_storms = A, B, len(storms)

        crack = make_crack_texture(out_w, out_h)
        self.crack = ctx.texture((out_w, out_h), 4, crack.tobytes())
        self.crack.filter = (moderngl.LINEAR, moderngl.LINEAR)

    # ------------------------------------------------------------------
    def bind_common(self, prog):
        self.bands.use(1)
        prog.set("uBands", 1)

    def render(self, fr):
        """fr: FrameSpec from a shot function. Returns HxWx3 uint8."""
        ctx = self.ctx
        if fr.kind in ("space", "cutaway"):
            prog = self.space
            self.scene_fbo.use()
            ctx.viewport = (0, 0, self.iw, self.ih)
            self.bind_common(prog)
            prog.setmany(fr.common_uniforms(self.iw, self.ih))
            prog.set("uVortA", self.storm_A)
            prog.set("uVortB", self.storm_B)
            prog.set("uNumVort", self.n_storms)
            prog.setmany(fr.u)
            prog.run()
        else:
            # pass 1: volume at output resolution
            prog = self.atmo
            self.vol_fbo.use()
            ctx.viewport = (0, 0, self.out_w, self.out_h)
            prog.setmany(fr.common_uniforms(self.out_w, self.out_h))
            prog.setmany(fr.u)
            prog.run()
            # pass 2: astronaut, near volume and particles at internal resolution
            comp = self.atmo_comp
            self.scene_fbo.use()
            ctx.viewport = (0, 0, self.iw, self.ih)
            self.vol.use(2)
            comp.set("uVol", 2)
            comp.setmany(fr.common_uniforms(self.iw, self.ih))
            comp.setmany(fr.u)
            comp.run()

        # bloom chain
        src = self.scene
        for i, (a, fa, b, fb, (w, h)) in enumerate(self.bloom):
            fa.use()
            ctx.viewport = (0, 0, w, h)
            src.use(0)
            if i == 0:
                self.bright.set("uSrc", 0)
                self.bright.set("uDstRes", (float(w), float(h)))
                self.bright.set("uThreshold", fr.post.get("uBloomThreshold", 1.0))
                self.bright.run()
            else:
                self.blur.set("uSrc", 0)
                self.blur.set("uDstRes", (float(w), float(h)))
                self.blur.set("uDir", (0.0, 0.0))
                self.blur.run()
            for d in ((1.0, 0.0), (0.0, 1.0)):
                (fb if d[0] else fa).use()
                ctx.viewport = (0, 0, w, h)
                (a if d[0] else b).use(0)
                self.blur.set("uSrc", 0)
                self.blur.set("uDstRes", (float(w), float(h)))
                self.blur.set("uDir", d)
                self.blur.run()
            src = a

        self.out_fbo.use()
        ctx.viewport = (0, 0, self.out_w, self.out_h)
        self.scene.use(0)
        self.bloom[0][0].use(3)
        self.bloom[1][0].use(4)
        self.bloom[2][0].use(5)
        self.crack.use(6)
        p = self.post
        p.set("uScene", 0)
        p.set("uBloom1", 3)
        p.set("uBloom2", 4)
        p.set("uBloom3", 5)
        p.set("uCrack", 6)
        p.set("uOutRes", (float(self.out_w), float(self.out_h)))
        p.set("uTime", fr.t)
        post = dict(POST_DEFAULTS)
        post.update(fr.post)
        p.setmany({k: v for k, v in post.items() if k != "uBloomThreshold"})
        p.run()
        data = self.out_fbo.read(components=3, alignment=1)
        img = np.frombuffer(data, np.uint8).reshape(self.out_h, self.out_w, 3)[::-1]
        return img


POST_DEFAULTS = dict(
    uExposure=1.0, uBloomAmt=0.35, uZoomC=(0.5, 0.5), uZoomBlur=0.0, uShimmer=0.0, uSqueeze=0.0,
    uCA=0.15, uVignette=0.35, uGrain=0.018, uFade=1.0, uFlash=0.0, uFlashCol=(1.0, 0.97, 0.92),
    uPOV=0.0, uCrackAmt=0.0, uRedAlarm=0.0, uLift=(0.0, 0.0, 0.0), uGamma=(1.0, 1.0, 1.0),
    uGain=(1.0, 1.0, 1.0), uSat=1.0, uContrast=1.0, uTint=(1.0, 1.0, 1.0),
)


# ----------------------------------------------------------------------------
# visor crack map (shot 5B)
# ----------------------------------------------------------------------------
def make_crack_texture(w, h, seed=3):
    """RGBA8: r = crack line, g = reveal time (0..1), b = glint, a = 255."""
    rng = np.random.RandomState(seed)
    S = 2
    W, H = w * S, h * S
    line = Image.new("L", (W, H), 0)
    reveal = Image.new("L", (W, H), 255)
    glint = Image.new("L", (W, H), 0)
    dl, dr, dg = ImageDraw.Draw(line), ImageDraw.Draw(reveal), ImageDraw.Draw(glint)
    impacts = [((0.64, 0.38), 0.0), ((0.3, 0.58), 0.33), ((0.56, 0.74), 0.62)]
    step = 10.0 * S

    def crack(x, y, ang, length, width, t0, dt, depth):
        n = max(int(length / step), 2)
        for i in range(n):
            ang += rng.normal(0, 0.16)
            nx, ny = x + math.cos(ang) * step, y + math.sin(ang) * step
            tt = min(t0 + dt * i / n, 1.0)
            wd = max(1, int(round(width * (1.0 - 0.75 * i / n))))
            dl.line([(x, y), (nx, ny)], fill=255, width=wd)
            dr.line([(x, y), (nx, ny)], fill=int(tt * 255), width=wd + 3)
            dg.line([(x + wd, y - wd), (nx + wd, ny - wd)], fill=210, width=max(1, wd // 2))
            x, y = nx, ny
            if depth < 1 and rng.rand() < 0.035:
                crack(x, y, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 0.9), length * rng.uniform(0.25, 0.45),
                      width * 0.55, tt, dt * 0.5, depth + 1)
            if not (-50 <= x < W + 50 and -50 <= y < H + 50):
                break

    for (cx, cy), t0 in impacts:
        x0, y0 = cx * W, cy * H
        n = rng.randint(5, 8)
        for k in range(n):
            ang = 2 * math.pi * k / n + rng.uniform(-0.3, 0.3)
            crack(x0, y0, ang, rng.uniform(0.18, 0.5) * H, 4.2 * S, t0, 0.28, 0)
        # small shattered star at the impact point
        for k in range(14):
            ang = rng.uniform(0, 2 * math.pi)
            r1 = rng.uniform(10, 34) * S
            dl.line([(x0, y0), (x0 + math.cos(ang) * r1, y0 + math.sin(ang) * r1)], fill=255, width=2 * S)
            dr.line([(x0, y0), (x0 + math.cos(ang) * r1, y0 + math.sin(ang) * r1)], fill=int(t0 * 255), width=3 * S)
        pts = [(x0 + math.cos(a) * 30 * S * rng.uniform(0.8, 1.2), y0 + math.sin(a) * 30 * S * rng.uniform(0.8, 1.2))
               for a in np.linspace(0, 2 * math.pi, 18)]
        for i in range(len(pts) - 1):
            if rng.rand() < 0.7:
                dl.line([pts[i], pts[i + 1]], fill=230, width=2 * S)
                dr.line([pts[i], pts[i + 1]], fill=int(min(t0 + 0.05, 1) * 255), width=3 * S)
        dg.ellipse([x0 - 9 * S, y0 - 9 * S, x0 + 9 * S, y0 + 9 * S], fill=255)
    line = line.filter(ImageFilter.GaussianBlur(0.8 * S)).resize((w, h), Image.LANCZOS)
    reveal = reveal.resize((w, h), Image.NEAREST)
    glint = glint.filter(ImageFilter.GaussianBlur(0.7 * S)).resize((w, h), Image.LANCZOS)
    a = np.full((h, w), 255, np.uint8)
    rgba = np.stack([np.array(line), np.array(reveal), np.array(glint), a], axis=-1)
    return rgba[::-1].copy()


# ----------------------------------------------------------------------------
# frame description
# ----------------------------------------------------------------------------
class FrameSpec:
    def __init__(self, t, kind):
        self.t = t
        self.kind = kind
        self.u = {}
        self.post = {}
        self.cam_rot = np.eye(3)
        self.tan_half_fov = math.tan(math.radians(30))
        self.jitter = (0.0, 0.0)

    def common_uniforms(self, w, h):
        pix_ang = 2 * self.tan_half_fov / h
        return dict(uRes=(float(w), float(h)), uTime=self.t, uCamRot=self.cam_rot,
                    uTanHalfFov=self.tan_half_fov, uPixAng=pix_ang, uJitter=self.jitter)

    def set_astro(self, pos, rot_body_to_world, pose, scale=1.0, **extra):
        k = astro.solve(pose)
        self.u.update(dict(
            uAstroOn=1.0, uAstroPos=np.asarray(pos, "f4"), uAstroRot=rot_body_to_world.T, uAstroScale=scale,
            uJ=k["J"], uHandC=k["hand_c"], uHandR=k["hand_r"], uFootC=k["foot_c"], uFootR=k["foot_r"],
            uHeadC=k["head_c"], uHeadR=k["head_r"],
        ))
        defaults = dict(uNoHelmet=0.0, uWarn=0.0, uLampOn=0.0, uElec=1.0, uOutline=0.85,
                        uOutlineCol=(0.03, 0.02, 0.02), uOutlinePx=2.2 * 1.0, uSilhouette=0.0,
                        uSilCol=(0.02, 0.02, 0.03), uAstroFog=0.0, uAstroFogCol=(0, 0, 0))
        for kk, vv in defaults.items():
            self.u.setdefault(kk, vv)
        self.u.update(extra)
        self._head = k
        return k


# ----------------------------------------------------------------------------
# SPACE SHOTS
# ----------------------------------------------------------------------------
PLANET_SPIN = 0.0035   # rad/s, exaggerated rotation in the correct (prograde) direction


def planet_rot(theta):
    """world -> planet-fixed for a planet turned by theta about +y (prograde)."""
    return astro.ry(-theta)


def space_lighting(fr, sun_dir, sun_col=(1.0, 0.97, 0.92)):
    fr.u.update(dict(uSunDir=norm(sun_dir).astype("f4"), uSunCol=sun_col))


def astro_space_lights(fr, sun_dir, planet_dir, strength=1.0):
    """Key light from the Sun, orange fill bounced from Jupiter, electric-blue rim."""
    fr.u.update(dict(
        uKeyDir=norm(sun_dir), uKeyCol=tuple(np.array([1.0, 0.95, 0.88]) * 2.4 * strength),
        uAmbDir=norm(planet_dir), uAmbA=tuple(np.array([0.95, 0.55, 0.28]) * 0.55 * strength),
        uAmbB=tuple(np.array([0.05, 0.06, 0.1]) * strength),
        uRimDir=norm(-np.asarray(sun_dir) + np.asarray(planet_dir) * 0.3),
        uRimCol=tuple(np.array([0.35, 0.65, 1.0]) * 0.9 * strength),
    ))


def shot_1A(t):
    """0-5 s: tumbling toward Jupiter, rapid exponential push-in, haze whiteout."""
    fr = FrameSpec(t, "space")
    lt = t - 0.0
    theta0 = 0.32
    theta = theta0 + PLANET_SPIN * t
    R = astro.ry(theta)
    grs_f = latlon(GRS_LAT, GRS_LON)
    target_f = latlon(-16.5, GRS_LON + 5.0)
    dir_c = norm(R @ target_f)
    # altitude falls exponentially: 1.4 R -> ~0.004 R
    h0, k = 1.45, 1.27
    h = h0 * math.exp(-k * lt) * (1.0 - 0.15 * smooth(lt / 5.0))
    dist = 1.0 + h
    eye = dir_c * dist
    north = np.array([0, 1.0, 0])
    # composition: early on, aim above the planet centre so the limb sits high in frame
    tilt = 0.24 * (1.0 - smooth(lt / 2.6))
    up0 = norm(north - dir_c * np.dot(north, dir_c))
    target = np.zeros(3) + up0 * tilt * dist
    roll = 0.05 * math.sin(lt * 0.7)
    fr.cam_rot = look_at(eye, target, up0, roll)
    fr.tan_half_fov = math.tan(math.radians(31))
    sun = norm(R @ latlon(8, GRS_LON + 48) + up0 * 0.35)
    space_lighting(fr, sun)
    haze = smooth((lt - 4.45) / 0.55)
    fr.u.update(dict(
        uCamPos=eye.astype("f4"), uPlanetRot=planet_rot(theta), uGrsC=grs_f.astype("f4"),
        uGrsSpin=0.05 * t, uHaze=haze, uHazeCol=tuple(hexc("#f4e3c4") * 1.25),
        uCut=0.0, uCutC=(0, 0, 1.0), uIoPos=(50.0, 50.0, 50.0), uIoR=0.0255, uStars=1.0,
        uBump=1.0 * smooth((lt - 1.2) / 2.0), uAurora=0.0, uNightFlash=1.0,
    ))
    # astronaut in metre space, camera at the origin looking along the same axes
    cam = fr.cam_rot
    fwd, upv, right = cam[:, 2], cam[:, 1], cam[:, 0]
    dist_a = 3.6 - 0.5 * smooth(lt / 5.0)
    drift = right * (0.25 * noise1(lt * 0.6, 1.0)) + upv * (-0.55 + 0.15 * noise1(lt * 0.5, 2.0))
    pos = fwd * dist_a + drift
    body = astro.tumble(lt, [((0.3, 1.0, 0.2), 0.55, -0.35), ((1.0, 0.0, 0.3), 0.35, 0.25)], wobble=0.25, seed=1)
    # orient so the visor faces the camera at the start
    base = astro.look_rot(-fwd + upv * 0.35, upv)
    rot = base @ body
    w = smooth(lt / 2.5)
    pose = astro.jitter(astro.blend({"flail": 1.0 - w * 0.5, "reach_up": 0.15 + w * 0.6, "spread": 0.3}), lt,
                        amp=0.9, speed=1.25, seed=1)
    fr.set_astro(pos, rot, pose, 1.0)
    astro_space_lights(fr, sun, -dir_c)
    fr.u.update(dict(uAstroCam=(0.0, 0.0, 0.0), uAstroFog=0.85 * haze, uAstroFogCol=tuple(hexc("#f4e3c4") * 1.1)))
    zoom = 0.05 + 0.6 * smooth((lt - 0.6) / 3.8)
    fr.post.update(dict(uZoomBlur=zoom, uZoomC=(0.5, 0.5), uExposure=1.05, uBloomAmt=0.3,
                        uVignette=0.45))
    return fr



# ----------------------------------------------------------------------------
# ATMOSPHERE SHOTS (scenes 2-5): one continuous descent through the decks
# ----------------------------------------------------------------------------
# descent speed (m/s): fast through the thin upper layers, slower as the gas thickens
_VEL_KEYS = [(5.0, 125), (6.5, 150), (8.2, 165), (10.8, 160), (12.0, 118), (17.5, 108), (19.0, 92),
             (25.5, 86), (27.0, 55), (30.6, 38), (33.0, 22), (35.0, 15)]
_TT = np.arange(4.9, 35.2, 0.002)
_V = np.interp(_TT, [k[0] for k in _VEL_KEYS], [k[1] for k in _VEL_KEYS])
_Y = 190.0 - np.concatenate([[0.0], np.cumsum((_V[1:] + _V[:-1]) * 0.5 * np.diff(_TT))])
_Y -= np.interp(5.0, _TT, _Y) - 190.0
WIND = np.array([22.0, 0.0, 9.0])


def descent_y(t):
    return float(np.interp(t, _TT, _Y))


def V3(*a):
    return np.array(a, float)


ENV_KEYS = [
    (5.0, dict(sun=V3(1.0, 0.9, 0.74) * 2.4, ambTop=V3(0.45, 0.5, 0.64) * 0.85, ambBot=V3(0.5, 0.32, 0.18) * 0.55,
               fog=V3(0.86, 0.74, 0.6) * 0.9, fogDen=0.00012, cloudDen=0.07,
               skyTop=V3(0.32, 0.55, 1.0) * 1.4, skyHor=V3(1.0, 0.8, 0.58) * 1.15, abyss=V3(0.5, 0.3, 0.16) * 0.6,
               heat=0.0, fluid=0.0, maxDist=6500.0, part=V3(1.0, 0.97, 0.92) * 1.6)),
    (8.2, dict(sun=V3(1.0, 0.84, 0.62) * 1.7, ambTop=V3(0.6, 0.48, 0.38) * 0.8, ambBot=V3(0.4, 0.23, 0.11) * 0.6,
               fog=V3(0.74, 0.54, 0.36), fogDen=0.0002, cloudDen=0.07,
               skyTop=V3(0.95, 0.88, 0.78) * 1.3, skyHor=V3(0.85, 0.62, 0.4), abyss=V3(0.36, 0.2, 0.1) * 0.7,
               heat=0.0, fluid=0.0, maxDist=6000.0, part=V3(1.0, 0.92, 0.82) * 1.2)),
    (11.0, dict(sun=V3(0.95, 0.62, 0.36) * 0.95, ambTop=V3(0.5, 0.36, 0.25), ambBot=V3(0.22, 0.12, 0.06),
                fog=V3(0.44, 0.28, 0.16), fogDen=0.00055, cloudDen=0.075,
                skyTop=V3(0.55, 0.4, 0.28), skyHor=V3(0.44, 0.28, 0.16), abyss=V3(0.12, 0.06, 0.03),
                heat=0.0, fluid=0.0, maxDist=4000.0, part=V3(0.8, 0.62, 0.45))),
    (17.5, dict(sun=V3(0.6, 0.32, 0.14) * 0.55, ambTop=V3(0.26, 0.13, 0.06), ambBot=V3(0.11, 0.045, 0.02),
                fog=V3(0.22, 0.1, 0.04), fogDen=0.0008, cloudDen=0.08,
                skyTop=V3(0.24, 0.12, 0.05), skyHor=V3(0.17, 0.075, 0.03), abyss=V3(0.2, 0.05, 0.015),
                heat=0.15, fluid=0.0, maxDist=3500.0, part=V3(0.55, 0.36, 0.22))),
    (21.0, dict(sun=V3(0.4, 0.2, 0.08) * 0.3, ambTop=V3(0.1, 0.045, 0.02), ambBot=V3(0.16, 0.04, 0.01),
                fog=V3(0.15, 0.055, 0.02), fogDen=0.00035, cloudDen=0.08,
                skyTop=V3(0.12, 0.05, 0.02), skyHor=V3(0.2, 0.06, 0.02), abyss=V3(1.0, 0.24, 0.035),
                heat=0.5, fluid=0.0, maxDist=3200.0, part=V3(0.5, 0.32, 0.22))),
    (26.0, dict(sun=V3(0.2, 0.08, 0.03) * 0.15, ambTop=V3(0.04, 0.016, 0.008), ambBot=V3(0.16, 0.035, 0.008),
                fog=V3(0.09, 0.028, 0.01), fogDen=0.0005, cloudDen=0.05,
                skyTop=V3(0.04, 0.015, 0.007), skyHor=V3(0.12, 0.035, 0.01), abyss=V3(1.25, 0.27, 0.035),
                heat=0.3, fluid=0.45, maxDist=1800.0, part=V3(0.45, 0.26, 0.18))),
    (35.0, dict(sun=V3(0.0, 0.0, 0.0), ambTop=V3(0.02, 0.008, 0.004), ambBot=V3(0.14, 0.03, 0.006),
                fog=V3(0.06, 0.016, 0.005), fogDen=0.0011, cloudDen=0.05,
                skyTop=V3(0.02, 0.008, 0.004), skyHor=V3(0.07, 0.02, 0.006), abyss=V3(1.1, 0.22, 0.03),
                heat=0.2, fluid=1.0, maxDist=1200.0, part=V3(0.4, 0.22, 0.15))),
]
ALB = dict(uAlbA=(0.98, 0.84, 0.62), uAlbB=(0.88, 0.5, 0.26), uAlbC=(0.55, 0.3, 0.16), uAlbD=(0.3, 0.1, 0.045))


def env_at(t):
    ks = ENV_KEYS
    if t <= ks[0][0]:
        return dict(ks[0][1])
    for (t0, a), (t1, b) in zip(ks, ks[1:]):
        if t <= t1:
            k = smooth((t - t0) / (t1 - t0))
            return {n: a[n] + (b[n] - a[n]) * k for n in a}
    return dict(ks[-1][1])


def cam_dir(rot, az, el):
    az, el = math.radians(az), math.radians(el)
    return norm(rot[:, 2] * math.cos(el) * math.cos(az) + rot[:, 0] * math.cos(el) * math.sin(az)
                + rot[:, 1] * math.sin(el))


def lightning_uniforms(t, cam_fn):
    """Pack up to four active flashes. Positions are fixed in the world at the strike time."""
    act = []
    for ev in TL.LIGHTNING:
        if ev["t"] - 0.05 <= t <= ev["t"] + ev["dur"] + 0.3:
            I = TL.lightning_intensity(ev, t)
            if I > 0.003:
                cpos, crot = cam_fn(ev["t"])
                pos = cpos + cam_dir(crot, ev["az"], ev["el"]) * ev["dist"]
                pos[1] = storm_altitude(ev["t"], cpos[1], pos[1])
                act.append((pos, I, ev))
    act.sort(key=lambda a: -a[1])
    lt = np.zeros((4, 4), "f4")
    amb = 0.0
    for i, (pos, I, ev) in enumerate(act[:4]):
        lt[i, :3] = pos
        far = (1.0 + ev["dist"] / 1500.0) if ev["t"] < 11.0 else 1.0   # distant scene-2 flickers must read
        lt[i, 3] = I * 32.0 * far
        amb += I * 0.12 / (1.0 + ev["dist"] / 1500.0)
    return lt, amb, act


def storm_altitude(t, cam_y, y):
    """Lightning lives inside the deep storm decks (water clouds), below the camera."""
    if t < 11.0:
        lo, hi = -1150.0, -700.0
    elif t < 18.0:
        lo, hi = -1900.0, -1250.0
    elif t < 26.0:
        lo, hi = -2400.0, -1500.0
    else:
        lo, hi = -2700.0, -2350.0
    return float(min(max(y, lo), hi))


def turb_offset(t, amp, seed, speed=1.0):
    return np.array([noise1(t * 1.3 * speed, seed), noise1(t * 1.1 * speed, seed + 3.3) * 0.6,
                     noise1(t * 1.5 * speed, seed + 7.1)]) * amp


def path_seg(t0, t1):
    a, b = astro_world(t0), astro_world(t1)
    return (float(a[0]), float(a[2]), float(b[0]), float(b[2]))


def astro_world(t):
    """The astronaut's centre: falls with the descent profile and drifts with the wind."""
    dt = t - 5.0
    return np.array([WIND[0] * dt, descent_y(t), WIND[2] * dt])


class AtmoShot:
    """Builds a FrameSpec for an atmosphere shot from camera/astronaut callbacks."""

    def __init__(self, cam_fn, astro_fn, post_fn=None, fov=62.0, pov=False):
        self.cam_fn, self.astro_fn, self.post_fn, self.fov, self.pov = cam_fn, astro_fn, post_fn, fov, pov

    def __call__(self, t):
        fr = FrameSpec(t, "atmo")
        env = env_at(t)
        cpos, crot = self.cam_fn(t)
        cpos2, _ = self.cam_fn(t + 0.01)
        cvel = (cpos2 - cpos) / 0.01
        fr.cam_rot = crot
        fr.tan_half_fov = math.tan(math.radians(self.fov * 0.5))
        sun_dir = norm(V3(0.75, 0.62, 0.3))
        lt, flash_amb, act = lightning_uniforms(t, self.cam_fn)
        heat_col = V3(1.0, 0.22, 0.035)
        lt_col = (0.75, 0.85, 1.0) if t < 26.0 else (1.0, 0.6, 0.4)
        fr.u.update(dict(
            uCamPos=cpos.astype("f4"), uMaxDist=float(env["maxDist"]), uSunDir=sun_dir, uSunCol=tuple(env["sun"]),
            uAmbTop=tuple(env["ambTop"]), uAmbBot=tuple(env["ambBot"]), uFogCol=tuple(env["fog"]),
            uFogDen=float(env["fogDen"]), uCloudDen=float(env["cloudDen"]), uHeatCol=tuple(heat_col),
            uHeat=float(env["heat"]), uFluid=float(env["fluid"]), uWind=WIND.astype("f4"),
            uSkyTop=tuple(env["skyTop"]), uSkyHor=tuple(env["skyHor"]), uAbyss=tuple(env["abyss"]),
            uLt=lt, uLtCol=lt_col, uLtRange=260.0, uFlashAmb=float(flash_amb),
            uLamp=0.0, uLampPos=(0.0, 0.0, 0.0), uLampDir=(0.0, -1.0, 0.0),
            uCamVel=cvel.astype("f4"), uPartAmt=1.0 if t < 11.0 else 2.6, uPartCol=tuple(env["part"]),
            uPartSize=0.012 if t < 11.0 else 0.016,
            uPathB=path_seg(9.8, 15.2), uPathC=path_seg(15.5, 26.5), uPathD=path_seg(24.0, 36.0),
        ))
        fr.u.update(ALB)
        a = self.astro_fn(t)
        pose = a["pose"]
        k = fr.set_astro(a["pos"], a["rot"], pose, 1.0, uNoHelmet=1.0 if self.pov else 0.0)
        # astronaut lighting from the environment
        key = env["sun"] * 0.75 + V3(0.0, 0.0, 0.0)
        rim = V3(0.35, 0.6, 1.0) * 0.5 if t < 11 else heat_col * (0.25 + 0.9 * env["heat"])
        fr.u.update(dict(
            uKeyDir=sun_dir, uKeyCol=tuple(key), uAmbDir=(0.0, 1.0, 0.0),
            uAmbA=tuple(env["ambTop"] * 0.9 + env["fog"] * 0.2), uAmbB=tuple(env["ambBot"] * 0.9 + heat_col * env["heat"] * 0.25),
            uRimDir=(0.0, -1.0, 0.0) if t >= 11 else (0.0, 1.0, 0.0), uRimCol=tuple(rim),
            uWarn=float(TL.warning_light(t)), uOutlineCol=(0.02, 0.012, 0.01),
        ))
        lamp = a.get("lamp", 0.0)
        if lamp > 0.0:
            R = a["rot"]
            head_world = a["pos"] + R @ k["head_c"]
            hdir = norm(R @ k["head_rot"] @ V3(0, 0, 1))
            fr.u.update(dict(uLamp=float(lamp), uLampPos=(head_world + hdir * 0.3).astype("f4"),
                             uLampDir=hdir.astype("f4"), uLampOn=float(lamp)))
        fr.u["uElec"] = elec_5(t)
        if t >= 33.4:
            fr.u["uWarn"] = 0.0
        for kk, vv in a.items():
            if kk.startswith("u"):
                fr.u[kk] = vv
        fr.post.update(dict(uBloomThreshold=1.1, uBloomAmt=0.4, uVignette=0.5, uGrain=0.022))
        if self.post_fn:
            self.post_fn(t, fr, env)
        return fr


def head_cam(t, astro_fn, ahead=0.12, look=None):
    """First-person camera inside the helmet."""
    a = astro_fn(t)
    k = astro.solve(a["pose"])
    R = a["rot"]
    head = a["pos"] + R @ k["head_c"]
    hrot = R @ k["head_rot"]
    fwd = hrot @ V3(0, 0, 1)
    up = hrot @ V3(0, 1, 0)
    if look is not None:
        fwd = norm(look)
    eye = head + fwd * ahead
    rot = look_at(eye, eye + fwd, up)
    return eye, rot


def shake(t, amp, seed, speed=1.0):
    return astro.rx(math.radians(amp * noise1(t * 6.3 * speed, seed))) @ astro.ry(
        math.radians(amp * noise1(t * 5.1 * speed, seed + 2.0))) @ astro.rz(math.radians(amp * 0.7 * noise1(t * 4.4 * speed, seed + 5.0)))


# ---- shot 2A: punch through the haze, tossed by turbulence -------------------
def astro_2A(t):
    lt = t - 5.0
    pos = astro_world(t) + turb_offset(t, 1.6, 11.0, 1.6)
    spin = astro.tumble(lt, [((0.2, 1.0, 0.3), 0.9, 0.4), ((1.0, 0.1, 0.0), 0.55, 1.1)], wobble=0.55, seed=4)
    base = astro.look_rot(V3(0.3, 0.75, 0.6), V3(0, 0, 1))
    w = smooth((lt - 0.8) / 1.0) * (1 - smooth((lt - 2.3) / 0.6))
    pose = astro.jitter(astro.blend({"flail": 1.0, "brace": 0.2 + 1.2 * w, "spread": 0.4}), lt, amp=1.1, speed=1.6, seed=2)
    return dict(pos=pos, rot=base @ spin, pose=pose)


def cam_2A(t):
    lt = t - 5.0
    a = astro_world(t) + turb_offset(t - 0.12, 1.0, 11.0, 1.6)
    yaw = math.radians(-25 + 18 * smooth(lt / 3.2))
    off = astro.ry(yaw) @ V3(0.0, 2.6, -3.4)
    eye = a + off
    target = a + astro.ry(yaw) @ V3(0.0, -3.0, 9.0)
    rot = look_at(eye, target, V3(0, 1, 0), roll=0.12 * noise1(lt * 0.8, 3.0))
    rot = rot @ shake(t, 1.2 + 1.6 * math.exp(-((t - 6.7) / 0.35) ** 2), 21.0)
    return eye, rot


def post_2A(t, fr, env):
    lt = t - 5.0
    fr.post.update(dict(uExposure=0.62, uFlash=2.4 * (1 - smooth(lt / 0.75)), uFlashCol=tuple(hexc("#f4e3c4")),
                        uZoomBlur=0.35, uZoomC=(0.5, 0.42), uCA=0.2, uVignette=0.4))


# ---- shot 2B: first-person POV, plunging toward the next deck -------------------
def astro_2B(t):
    lt = t - 8.2
    pos = astro_world(t) + turb_offset(t, 1.2, 12.0, 1.4)
    down = norm(V3(0.12 * math.sin(lt * 0.9), -1.0, 0.25 + 0.1 * math.cos(lt * 0.7)))
    base = astro.look_rot(down, V3(math.sin(lt * 0.45), 0.0, math.cos(lt * 0.45)))
    spin = astro.tumble(lt, [], wobble=0.22, seed=9)
    pose = astro.jitter(astro.blend({"spread": 1.0}), lt, amp=0.5, speed=1.5, seed=5)
    for k in ("armL", "armR"):
        pose[k][0] = min(pose[k][0], -25.0)   # arms stay out of the first-person view
    return dict(pos=pos, rot=base @ spin, pose=pose)


def cam_2B(t):
    eye, rot = head_cam(t, astro_2B, ahead=0.16)
    return eye, rot @ shake(t, 0.9, 31.0, 1.3)


def post_2B(t, fr, env):
    lt = t - 8.2
    fr.post.update(dict(uExposure=0.7, uPOV=1.0, uCA=0.2, uVignette=0.25, uZoomBlur=0.08, uZoomC=(0.5, 0.5), uContrast=1.12,
                        uFlash=0.9 * math.exp(-lt * 10.0), uFlashCol=(0.3, 0.25, 0.2)))


SHOT_2A = AtmoShot(cam_2A, astro_2A, post_2A, fov=64.0)
SHOT_2B = AtmoShot(cam_2B, astro_2B, post_2B, fov=78.0, pov=True)





# ---- shot 3A: close-up, visor reflecting the storm, warning lights ----------
def astro_3A(t):
    lt = t - 11.0
    pos = astro_world(t) + turb_offset(t, 0.45, 13.0, 1.2)
    yaw = 0.85 * lt + 0.45 * math.sin(lt * 1.3)
    rot = astro.ry(yaw) @ astro.rx(0.22 * math.sin(lt * 1.7)) @ astro.rz(0.28 * math.sin(lt * 1.1 + 0.5))
    pose = astro.jitter(astro.blend({"flail": 0.6, "look": 0.7, "spread": 0.3}), lt, amp=1.0, speed=1.4, seed=6)
    return dict(pos=pos, rot=rot, pose=pose)


def cam_3A(t):
    lt = t - 11.0
    a = astro_3A(t)
    k = astro.solve(a["pose"])
    head = a["pos"] + a["rot"] @ k["head_c"]
    lag = lt - 0.3
    yaw_c = 0.85 * lag + 0.45 * math.sin(lag * 1.3) + 0.25
    fwd = astro.ry(yaw_c) @ V3(0, 0, 1)
    eye = head + fwd * (2.3 - 0.25 * smooth(lt / 3.4)) + V3(0, -0.2, 0)
    rot = look_at(eye, head + V3(0, 0.28, 0), V3(0, 1, 0), roll=0.12 * noise1(lt * 0.7, 4.0))
    return eye, rot @ shake(t, 0.7, 41.0)


def post_3A(t, fr, env):
    lt = t - 11.0
    w = TL.warning_light(t)
    pulse = math.exp(-((lt % 1.6) - 0.15) ** 2 / 0.02)
    fr.post.update(dict(uExposure=0.95, uSqueeze=0.7 * pulse, uCA=0.25 + 0.3 * pulse, uRedAlarm=0.18 * w,
                        uVignette=0.65, uFlash=0.7 * math.exp(-lt * 8.0), uFlashCol=(0.35, 0.22, 0.12)))


# ---- shot 3B: low angle, tumbling down through oppressive layers ------------
def astro_3B(t):
    lt = t - 14.4
    pos = astro_world(t) + turb_offset(t, 0.9, 14.0, 1.0)
    rot = astro.tumble(lt, [((0.4, 0.2, 1.0), 0.8, 0.3), ((1.0, 0.0, 0.2), 0.5, 1.0)], wobble=0.4, seed=7)
    pose = astro.jitter(astro.blend({"flail": 0.7, "reach_up": 0.6}), lt, amp=1.0, speed=1.2, seed=8)
    return dict(pos=pos, rot=rot, pose=pose)


def cam_3B(t):
    lt = t - 14.4
    a = astro_world(t) + turb_offset(t - 0.2, 0.6, 14.0, 1.0)
    ang = math.radians(30 + 22 * lt / 3.6)
    eye = a + V3(math.cos(ang) * 4.6, -3.4, math.sin(ang) * 4.6)
    rot = look_at(eye, a + V3(0, 1.2, 0), V3(0, 1, 0))
    return eye, rot @ shake(t, 0.5, 51.0)


def post_3B(t, fr, env):
    lt = t - 14.4
    w = TL.warning_light(t)
    pulse = math.exp(-((lt % 1.3) - 0.2) ** 2 / 0.025)
    fr.post.update(dict(uExposure=1.2, uSqueeze=0.55 * pulse, uCA=0.3, uRedAlarm=0.12 * w, uVignette=0.7))


# ---- shot 4A: gigantic formations revealed by lightning ---------------------
def astro_4A(t):
    lt = t - 18.0
    pos = astro_world(t) + turb_offset(t, 0.7, 15.0, 0.8)
    rot = astro.tumble(lt, [((0.1, 1.0, 0.3), 0.45, 2.0), ((1.0, 0.0, 0.0), 0.3, 0.2)], wobble=0.35, seed=10)
    pose = astro.jitter(astro.blend({"spread": 0.8, "flail": 0.5}), lt, amp=0.8, speed=1.0, seed=9)
    return dict(pos=pos, rot=rot, pose=pose, lamp=0.6)


def cam_4A(t):
    lt = t - 18.0
    a = astro_world(t)
    ang = math.radians(205 + 10 * lt)
    eye = a + V3(math.cos(ang) * 11.0, 2.0, math.sin(ang) * 11.0)
    rot = look_at(eye, a + V3(0, -1.0, 0), V3(0, 1, 0)) @ astro.ry(math.radians(-14))
    return eye, rot @ shake(t, 0.35, 61.0)


def post_4A(t, fr, env):
    fr.post.update(dict(uExposure=1.15, uShimmer=0.35, uCA=0.25, uRedAlarm=0.1 * TL.warning_light(t), uVignette=0.6,
                        uBloomAmt=0.55))


# ---- shot 4B: above the astronaut, looking down into the glowing depths ------
def astro_4B(t):
    lt = t - 21.8
    pos = astro_world(t) + turb_offset(t, 0.5, 16.0, 0.8)
    base = astro.look_rot(V3(0.25, -1.0, 0.1), V3(math.cos(lt * 0.35), 0.0, math.sin(lt * 0.35)))
    wob = astro.tumble(lt, [], wobble=0.25, seed=12)
    pose = astro.jitter(astro.blend({"cower": 0.55, "spread": 0.5}), lt, amp=0.7, speed=1.0, seed=11)
    return dict(pos=pos, rot=base @ wob, pose=pose, lamp=1.0)


def cam_4B(t):
    lt = t - 21.8
    a = astro_world(t) + turb_offset(t - 0.15, 0.3, 16.0, 0.8)
    eye = a + V3(1.4, 4.6, 1.1)
    rot = look_at(eye, a + V3(-0.6, -10.0, -0.5), V3(1, 0, 0), roll=0.08 * math.sin(lt * 0.6))
    return eye, rot @ shake(t, 0.35, 71.0)


def post_4B(t, fr, env):
    lt = t - 21.8
    fr.post.update(dict(uExposure=1.25, uShimmer=0.6 + 0.4 * lt / 4.2, uCA=0.3, uRedAlarm=0.16 * TL.warning_light(t),
                        uVignette=0.65, uBloomAmt=0.6))


# ---- shot 5A: dramatic pull-back, a tiny silhouette being swallowed ---------
def astro_5A(t):
    lt = t - 26.0
    pos = astro_world(t) + turb_offset(t, 0.4, 17.0, 0.6)
    base = astro.look_rot(V3(0.15, 1.0, 0.25), V3(0, 0, 1))
    wob = astro.tumble(lt, [((0.0, 1.0, 0.0), 0.2, 0.0)], wobble=0.2, seed=13)
    pose = astro.jitter(astro.blend({"reach_up": 0.8, "limp": 0.6}), lt, amp=0.45, speed=0.8, seed=12)
    rot = base @ wob
    # continue from where shot 4B left off, then turn to face the receding light
    k = smooth(lt / 1.5)
    if k < 1.0:
        prev = astro_4B(t)
        rot = astro.slerp(prev["rot"], rot, k)
        pose = {key: prev["pose"][key] * (1.0 - k) + pose[key] * k for key in pose}
    flick = 1.0 if (int(t * 13) % 7) else 0.25
    return dict(pos=pos, rot=rot, pose=pose, lamp=lerp(1.0, 0.8 * flick, k))


def cam_5A(t):
    lt = t - 26.0
    a = astro_world(t)
    d = 4.9 * math.exp(0.78 * lt)
    eye = a + norm(V3(0.3, 1.0, 0.22)) * d
    # start on shot 4B's view down past the astronaut, then settle onto it as we pull away
    target = a + V3(-0.6, -10.0, -0.5) * (1.0 - smooth(lt / 1.2))
    rot = look_at(eye, target, V3(1, 0, 0), roll=0.05 * math.sin(lt * 0.5))
    return eye, rot @ shake(t, 0.25, 81.0)


def post_5A(t, fr, env):
    lt = t - 26.0
    fr.post.update(dict(uExposure=0.85, uShimmer=0.7, uCA=0.3, uVignette=0.75, uBloomAmt=0.7,
                        uRedAlarm=0.12 * TL.warning_light(t), uFlash=0.8 * math.exp(-lt * 6.0), uFlashCol=(0.4, 0.06, 0.02)))


# ---- shot 5B: first-person, the suit fails, visor cracks, darkness ----------
def astro_5B(t):
    lt = t - 30.6
    pos = astro_world(t) + turb_offset(t, 0.35, 18.0, 0.7)
    down = norm(V3(0.1 * math.sin(lt * 0.7), -1.0, 0.2))
    base = astro.look_rot(down, V3(math.sin(lt * 0.25), 0.0, math.cos(lt * 0.25)))
    wob = astro.tumble(lt, [], wobble=0.15, seed=19)
    pose = astro.jitter(astro.blend({"spread": 1.0}), lt, amp=0.4, speed=0.9, seed=14)
    for k in ("armL", "armR"):
        pose[k][0] = min(pose[k][0], -25.0)
    return dict(pos=pos, rot=base @ wob, pose=pose)


def cam_5B(t):
    eye, rot = head_cam(t, astro_5B, ahead=0.16)
    hit = sum(math.exp(-((t - c) / 0.07) ** 2) for c in TL.VISOR_CRACKS)
    return eye, rot @ shake(t, 0.5 + 2.5 * hit, 91.0)


def crack_amount(t):
    amt = 0.0
    for i, c in enumerate(TL.VISOR_CRACKS):
        if t >= c:
            amt = [0.0, 0.33, 0.62][i] + 0.33 * ease_out((t - c) / 0.18)
    return min(amt, 1.0)


def post_5B(t, fr, env):
    fade = 1.0
    if t >= 33.45:
        fade = 0.16 * (1.0 - smooth((t - 33.6) / 1.1)) if t >= 33.6 else lerp(1.0, 0.16, smooth((t - 33.45) / 0.15))
    hit = sum(math.exp(-((t - c) / 0.05) ** 2) for c in TL.VISOR_CRACKS)
    fr.post.update(dict(uExposure=0.8, uPOV=1.0, uCrackAmt=crack_amount(t), uShimmer=0.8 if t < 33.6 else 0.0,
                        uCA=0.4 + 1.2 * hit, uVignette=0.7, uRedAlarm=0.3 * TL.warning_light(t), uFade=fade,
                        uFlash=0.12 * hit, uFlashCol=(1.0, 0.5, 0.3), uBloomAmt=0.7))


def elec_5(t):
    """Suit electronics power: flickers, then dies."""
    if t < 30.6:
        return 1.0
    if t >= 33.4:
        return 0.0
    f = 1.0 if (int(t * 17) % 5) else 0.15
    return f * (1.0 - 0.5 * smooth((t - 31.8) / 1.5))


SHOT_3A = AtmoShot(cam_3A, astro_3A, post_3A, fov=50.0)
SHOT_3B = AtmoShot(cam_3B, astro_3B, post_3B, fov=58.0)
SHOT_4A = AtmoShot(cam_4A, astro_4A, post_4A, fov=56.0)
SHOT_4B = AtmoShot(cam_4B, astro_4B, post_4B, fov=60.0)
SHOT_5A = AtmoShot(cam_5A, astro_5A, post_5A, fov=52.0)
SHOT_5B = AtmoShot(cam_5B, astro_5B, post_5B, fov=78.0, pov=True)


# ----------------------------------------------------------------------------
# SCENE 6: external reveal, cutaway, final silhouette
# ----------------------------------------------------------------------------
GRS_FIXED = latlon(GRS_LAT, GRS_LON)


def cam_6(t):
    """Shared exterior camera for 6A and 6B: slow pull-back, rising a little."""
    lt = t - 35.0
    u = ease_out(lt / 4.2)
    dist = lerp(2.15, 4.15, u)
    el = math.radians(lerp(14.0, 22.0, smooth((t - 35.0) / 6.0)))
    az = math.radians(-8.0)
    dirc = V3(math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el))
    eye = dirc * dist
    # keep the planet centre a little below frame centre (room for the caption)
    upv = V3(0, 1, 0)
    target = V3(0, 0, 0) + norm(upv - dirc * np.dot(upv, dirc)) * (0.16 * dist / 4.15)
    rot = look_at(eye, target, upv)
    return eye, rot


def theta_6(t):
    """Planet rotation in scene 6 (prograde, sped up for a majestic turn)."""
    return 1.2 + 0.03 * (t - 35.0)


def shot_6AB(t):
    fr = FrameSpec(t, "space")
    eye, rot = cam_6(t)
    fr.cam_rot = rot
    fr.tan_half_fov = math.tan(math.radians(30))
    theta = theta_6(t)
    sun = norm(V3(-1.0, 0.2, 0.28))
    space_lighting(fr, sun)
    # Io is far off-frame toward the Sun; only its shadow shows on the clouds
    R = astro.ry(theta)
    shadow_on = norm(R @ latlon(-6.0, 32.0))
    io_pos = shadow_on + sun * 5.9
    cut = 0.0
    if t >= 39.2:
        cut = math.radians(46.0) * ease_out((t - 39.3) / 0.65)
    fr.u.update(dict(
        uCamPos=eye.astype("f4"), uPlanetRot=planet_rot(theta), uGrsC=GRS_FIXED.astype("f4"), uGrsSpin=0.04 * t,
        uHaze=0.0, uHazeCol=(0.0, 0.0, 0.0), uCut=cut, uCutC=norm(V3(eye[0], 0.0, eye[2]) + V3(0.35, 0, 0)).astype("f4"),
        uIoPos=io_pos.astype("f4"), uIoR=0.0255, uStars=1.0, uBump=0.0, uAurora=1.0, uNightFlash=1.0,
        uAstroOn=0.0,
    ))
    lt = t - 35.0
    flash = 0.7 * math.exp(-lt * 20.0)
    fade_in = smooth(lt / 0.12)
    fr.post.update(dict(uExposure=1.0, uBloomAmt=0.4, uVignette=0.45, uFlash=flash, uFade=0.75 + 0.25 * fade_in,
                        uCA=0.12, uGrain=0.016))
    if t >= 39.2:
        k = smooth((t - 39.3) / 0.6)
        fr.post.update(dict(uBloomAmt=0.4 + 0.25 * k, uFlash=0.0))
    return fr


def cutaway_label_geometry():
    """Screen positions for the cutaway labels (used by overlays.py)."""
    t = 40.5
    eye, rot = cam_6(t)
    thf = math.tan(math.radians(30))
    aspect = TL.OUT_W / TL.OUT_H

    def proj(p):
        d = np.asarray(p, float) - eye
        x, y, z = np.dot(d, rot[:, 0]), np.dot(d, rot[:, 1]), np.dot(d, rot[:, 2])
        return ((x / (z * thf * aspect) + 1) * 0.5 * TL.OUT_W, (1 - (y / (z * thf) + 1) * 0.5) * TL.OUT_H)

    cutc = norm(V3(eye[0], 0.0, eye[2]) + V3(0.35, 0, 0))
    start = proj(cutc * 0.97 + V3(0, 0.02, 0))
    end = proj(cutc * 0.18 + V3(0, 0.02, 0))
    centre = proj(V3(0, 0, 0))
    top = proj(V3(0, 1.0, 0))
    return dict(arrow=(start, end), label=(TL.OUT_W / 2, start[1] + 70), tag_y=max(300, top[1] - 140), centre=centre)


def shot_6C(t):
    """Final: low over the cloud tops near the limb; a tiny silhouette drops away into the haze."""
    fr = FrameSpec(t, "space")
    lt = t - 42.0
    theta = theta_6(t)
    R = astro.ry(theta)
    base_f = latlon(-14.0, GRS_LON - 16.0)
    up = norm(R @ base_f)
    east = norm(np.cross(V3(0, 1, 0), up))
    north = np.cross(up, east)
    alt = 0.05 - 0.008 * lt
    eye = up * (1.0 + alt)
    look_dir = norm(east * 0.92 - up * 0.28 + north * 0.1)
    rot = look_at(eye, eye + look_dir, up)
    fr.cam_rot = rot
    fr.tan_half_fov = math.tan(math.radians(31))
    sun = norm(east * 0.95 + up * 0.18 - north * 0.1)
    space_lighting(fr, sun, (1.0, 0.9, 0.78))
    fr.u.update(dict(
        uCamPos=eye.astype("f4"), uPlanetRot=planet_rot(theta), uGrsC=GRS_FIXED.astype("f4"), uGrsSpin=0.04 * t,
        uHaze=0.0, uHazeCol=(0.0, 0.0, 0.0), uCut=0.0, uCutC=(0.0, 0.0, 1.0), uIoPos=(50.0, 50.0, 50.0), uIoR=0.0255,
        uStars=1.0, uBump=0.8, uAurora=0.0, uNightFlash=0.0,
    ))
    # astronaut in metre space: falls away from the camera and down into the clouds
    fwd, upc, right = rot[:, 2], rot[:, 1], rot[:, 0]
    k = smooth(lt / 1.7)
    pos = fwd * lerp(14.0, 34.0, k) + upc * lerp(-1.2, -9.0, k * k) + right * lerp(0.6, 1.2, k)
    body = astro.tumble(lt, [((0.3, 1.0, 0.1), 1.1, 0.5), ((1.0, 0.0, 0.3), 0.7, 0.2)], wobble=0.3, seed=21)
    pose = astro.jitter(astro.blend({"reach_up": 0.7, "flail": 0.5}), lt, amp=0.9, speed=1.3, seed=15)
    fr.set_astro(pos, body, pose, 1.0)
    fr.u.update(dict(
        uAstroCam=(0.0, 0.0, 0.0), uSilhouette=0.92, uSilCol=(0.015, 0.012, 0.012),
        uKeyDir=sun, uKeyCol=(1.5, 1.35, 1.2), uAmbDir=tuple(up), uAmbA=(0.3, 0.2, 0.12), uAmbB=(0.02, 0.02, 0.03),
        uRimDir=tuple(sun), uRimCol=(1.4, 1.1, 0.8), uAstroFog=smooth((lt - 0.9) / 0.9) * 0.97,
        uAstroFogCol=(0.95, 0.78, 0.55), uOutline=0.0,
    ))
    fade = 1.0 - smooth((t - 44.2) / 0.75)
    fr.post.update(dict(uExposure=1.05, uBloomAmt=0.45, uVignette=0.55, uFade=fade, uCA=0.12, uGrain=0.016,
                        ))
    return fr


SHOT_FUNCS = {"1A": shot_1A, "2A": SHOT_2A, "2B": SHOT_2B, "3A": SHOT_3A, "3B": SHOT_3B,
              "4A": SHOT_4A, "4B": SHOT_4B, "5A": SHOT_5A, "5B": SHOT_5B, "6A": shot_6AB, "6B": shot_6AB,
              "6C": shot_6C}


def frame_spec(t):
    sid = TL.shot_at(t)[0]
    fr = SHOT_FUNCS[sid](t)
    ov = os.environ.get("JR_POST")
    if ov:
        import json
        fr.post.update(json.loads(ov))
    return fr


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=2.0, help="internal supersampling factor")
    ap.add_argument("--preview", type=str, default="", help="comma-separated times -> PNG stills")
    ap.add_argument("--outdir", type=str, default=os.path.join(HERE, "build"))
    ap.add_argument("--shot", type=str, default="", help="render one shot to <outdir>/<shot>.mkv")
    ap.add_argument("--range", type=str, default="", help="frame range a:b")
    ap.add_argument("--small", action="store_true", help="half-size output for quick tests")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    ow, oh = (TL.OUT_W, TL.OUT_H) if not args.small else (TL.OUT_W // 2, TL.OUT_H // 2)
    r = Renderer(scale=args.scale, out_w=ow, out_h=oh)

    if args.preview:
        for ts in args.preview.split(","):
            t = float(ts)
            t0 = _time.time()
            img = r.render(frame_spec(t))
            fn = os.path.join(args.outdir, "still_%06.2f.png" % t)
            Image.fromarray(img).save(fn)
            print("t=%.2f -> %s (%.2fs)" % (t, fn, _time.time() - t0), flush=True)
        return

    if args.shot:
        s = [x for x in TL.SHOTS if x[0] == args.shot][0]
        f0, f1 = int(round(s[1] * TL.FPS)), int(round(s[2] * TL.FPS))
        name = args.shot
    else:
        a, b = args.range.split(":")
        f0, f1 = int(a), int(b)
        name = "range_%04d_%04d" % (f0, f1)
    out = os.path.join(args.outdir, name + ".mkv")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (ow, oh),
           "-r", str(TL.FPS), "-i", "-", "-c:v", "libx264rgb", "-qp", "0", "-preset", "ultrafast", out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t_start = _time.time()
    for f in range(f0, f1):
        t = f / TL.FPS
        img = r.render(frame_spec(t))
        ff.stdin.write(img.tobytes())
        if (f - f0) % 10 == 0:
            el = _time.time() - t_start
            done = f - f0 + 1
            print("%s frame %d/%d  %.2fs/frame" % (name, done, f1 - f0, el / done), flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", out, "in %.1fs" % (_time.time() - t_start))


if __name__ == "__main__":
    main()

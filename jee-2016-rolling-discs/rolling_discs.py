"""
Motion-graphics solution of JEE Advanced 2016 — "Two thin discs rolling like a cone".

Render (1080p, 30 fps), then concatenate the scenes in order:
    manim -qh --fps 30 rolling_discs.py S1Title S2Problem S3Motion S4Geometry \
        S5Omega S6CentreOfMass S7AboutCM S8Lz S9Summary
"""
import textwrap

import numpy as np
from manim import *

# ----------------------------------------------------------------------------
# Look & feel
# ----------------------------------------------------------------------------
BG = "#0B1020"
config.background_color = BG

FONT = "Inter"
TXT = "#E9EDF5"
MUTED = "#8B95A8"
DIM = "#3A4560"
ACC = "#FFD166"
PANEL = "#121A2E"

C_SMALL = "#5AB8FF"   # disc m, radius a
C_BIG = "#FF9F59"     # disc 4m, radius 2a
C_ROD = "#C9D2DE"
C_W = "#FFE45C"       # spin omega
C_OM = "#FF5FA2"      # precession Omega
C_TOT = "#4CE0A0"     # total angular velocity / contact line
C_PAR = "#B794F6"     # components along the rod
C_PERP = "#4DD9E8"    # components perpendicular to the rod
GOOD = "#4CE0A0"
BAD = "#FF5C5C"

# ----------------------------------------------------------------------------
# Geometry (lengths in units of a; X along the contact line, Z vertical)
# ----------------------------------------------------------------------------
SN = 0.2                      # sin(theta)
CS = np.sqrt(24) / 5          # cos(theta)
TH = np.arcsin(SN)
LL = np.sqrt(24)              # l / a
NV = np.array([CS, SN])       # rod direction in the side view
PV = np.array([-SN, CS])      # perpendicular to the rod, pointing "up"
C1 = LL * NV
C2 = 2 * LL * NV
P1 = C1 - PV                  # = (5, 0)
P2 = C2 - 2 * PV              # = (10, 0)
RCM = 9 * LL / 5 * NV         # centre of mass


def T(s, size=26, color=TXT, weight=NORMAL, **kw):
    return Text(s, font=FONT, font_size=size, color=color, weight=weight, **kw)


def M(*s, size=36, color=TXT, **kw):
    return MathTex(*s, font_size=size, color=color, **kw)


def X(*s, size=32, color=TXT, **kw):
    return Tex(*s, font_size=size, color=color, **kw)


def para(s, width=30, size=24, color=TXT, **kw):
    return T("\n".join(textwrap.wrap(s, width)), size=size, color=color,
             line_spacing=0.9, **kw)


def heading(tag, title):
    t1 = T(tag, size=17, color=ACC, weight=BOLD)
    t2 = T(title, size=34, weight="SEMIBOLD")
    t1.to_corner(UL, buff=0.45)
    t2.next_to(t1, DOWN, aligned_edge=LEFT, buff=0.13)
    return VGroup(t1, t2)


# ----------------------------------------------------------------------------
# Scorecard (a)(b)(c)(d) along the bottom
# ----------------------------------------------------------------------------
def icon(state):
    if state == "T":
        m = VMobject()
        m.set_points_as_corners([[-0.11, 0.0, 0], [-0.035, -0.085, 0], [0.12, 0.1, 0]])
        return m.set_stroke(GOOD, width=5)
    if state == "F":
        g = VGroup(Line([-0.085, -0.085, 0], [0.085, 0.085, 0]),
                   Line([-0.085, 0.085, 0], [0.085, -0.085, 0]))
        return g.set_stroke(BAD, width=5)
    return T("?", size=22, color=MUTED, weight=BOLD)


def chip(letter, state):
    col = {"?": DIM, "T": GOOD, "F": BAD}[state]
    box = RoundedRectangle(corner_radius=0.14, width=1.3, height=0.5)
    box.set_stroke(col, width=2).set_fill(PANEL, opacity=1)
    lab = T(f"({letter})", size=22, weight="MEDIUM").move_to(box.get_center() + LEFT * 0.24)
    ic = icon(state).move_to(box.get_center() + RIGHT * 0.34)
    return VGroup(box, lab, ic)


def scorecard(states="????"):
    g = VGroup(*[chip(l, s) for l, s in zip("abcd", states)]).arrange(RIGHT, buff=0.22)
    return g.move_to(DOWN * 3.58)


def mark_chip(scene, sc, i, state):
    new = chip("abcd"[i], state).move_to(sc[i].get_center())
    scene.play(Transform(sc[i], new), run_time=0.5)
    scene.play(sc[i].animate(rate_func=there_and_back).scale(1.18), run_time=0.5)


def badge(letter, ok, extra=""):
    col = GOOD if ok else BAD
    txt = T(f"({letter})  {'TRUE' if ok else 'FALSE'}{extra}", size=26, color=col, weight=BOLD)
    g = VGroup(icon("T" if ok else "F").scale(1.3), txt).arrange(RIGHT, buff=0.2)
    box = SurroundingRectangle(g, buff=0.17, corner_radius=0.12, color=col, stroke_width=2.5)
    box.set_fill(col, opacity=0.08)
    return VGroup(box, g)


def result_box(m, color=ACC):
    return SurroundingRectangle(m, buff=0.12, corner_radius=0.08, color=color, stroke_width=2.5)


# ----------------------------------------------------------------------------
# Right-hand panel: lines stacked from the top, left-aligned
# ----------------------------------------------------------------------------
class Panel:
    def __init__(self, scene, x0=0.75, top=2.45, buff=0.26, width=6.0):
        self.scene, self.x0, self.top, self.buff, self.width = scene, x0, top, buff, width
        self.items, self.y = [], top

    def place(self, m, buff=None, indent=0.0):
        if m.width > self.width - indent:
            m.scale_to_fit_width(self.width - indent)
        b = self.buff if buff is None else buff
        y = self.y - (b if self.items else 0)
        m.move_to([self.x0 + indent + m.width / 2, y - m.height / 2, 0])
        self.y = y - m.height
        self.items.append(m)
        return m

    def clear(self, keep=(), run_time=0.7):
        keep = list(keep)
        fam = set()
        for k in keep:
            fam.update(k.get_family())
        anims = [FadeOut(m) for m in self.items if m not in fam]
        self.items, self.y = [], self.top
        for k in keep:
            ghost = k.copy()
            self.place(ghost)
            self.items[-1] = k
            anims.append(k.animate.move_to(ghost.get_center()))
        self.scene.play(*anims, run_time=run_time)


# ----------------------------------------------------------------------------
# 2-D side view (vertical plane through the rod and the contact line)
# ----------------------------------------------------------------------------
O_SV = np.array([-6.2, -1.8, 0.0])


def sv_map(k=0.62, O=O_SV):
    return lambda v: O + k * np.array([v[0], v[1], 0.0])


def side_view(k=0.62, O=O_SV, big=True, labels=True, xmax=10.9, zmax=4.5):
    f = sv_map(k, O)
    P = {}
    P["ground"] = Line(f((-0.35, 0)), f((xmax, 0))).set_stroke(MUTED, 2.5)
    x0, x1 = f((-0.35, 0))[0], f((xmax, 0))[0]
    P["hatch"] = VGroup(*[Line([x, O[1], 0], [x - 0.15, O[1] - 0.15, 0])
                          for x in np.arange(x0 + 0.15, x1, 0.24)]).set_stroke(DIM, 1.5)
    P["axis"] = DashedLine(f((0, 0)), f((2.2 if big else 1.25) * LL * NV),
                           dash_length=0.09, dashed_ratio=0.55).set_stroke(MUTED, 2, 0.85)
    P["zax"] = Arrow(f((0, -0.05)), f((0, zmax)), buff=0, stroke_width=2.5,
                     tip_length=0.16, color=MUTED)
    P["O"] = Dot(f((0, 0)), radius=0.06, color=TXT)
    P["d1"] = Line(f(C1 - PV), f(C1 + PV)).set_stroke(C_SMALL, 9)
    P["c1"] = Dot(f(C1), radius=0.045, color=TXT)
    if big:
        P["rod"] = Line(f(C1), f(C2)).set_stroke(C_ROD, 5)
        P["d2"] = Line(f(C2 - 2 * PV), f(C2 + 2 * PV)).set_stroke(C_BIG, 11)
        P["c2"] = Dot(f(C2), radius=0.055, color=TXT)
    if labels:
        P["lO"] = T("O", 24).next_to(P["O"], UL, buff=0.06)
        P["lz"] = T("z", 24, color=MUTED).next_to(P["zax"].get_end(), RIGHT, buff=0.1)
        P["lm"] = T("m", 24, color=C_SMALL, weight="SEMIBOLD").next_to(f(C1 + PV), UP, buff=0.1)
        if big:
            P["l4m"] = T("4m", 24, color=C_BIG, weight="SEMIBOLD").next_to(f(C2 + 2 * PV), UP, buff=0.1)
    return P


def sv_group(P, keys=None):
    order = ["ground", "hatch", "axis", "zax", "rod", "d1", "d2", "c1", "c2", "O",
             "lO", "lz", "lm", "l4m"]
    return VGroup(*[P[k] for k in order if k in P and (keys is None or k in keys)])


# ----------------------------------------------------------------------------
# 3-D view: a small perspective camera + painter's ordering
# ----------------------------------------------------------------------------
LIGHT = np.array([-0.35, -0.55, 0.76])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


class Cam:
    def __init__(self, elev=26, azim=-100, k=0.34, dist=60.0, c2=(-2.3, -0.75),
                 target=(0, 0, 1.0)):
        self.elev, self.azim = np.radians(elev), np.radians(azim)
        self.k, self.dist = k, dist
        self.c2 = np.array(c2, float)
        self.target = np.array(target, float)
        ce, se = np.cos(self.elev), np.sin(self.elev)
        ca, sa = np.cos(self.azim), np.sin(self.azim)
        self.back = np.array([ce * ca, ce * sa, se])
        self.right = np.array([-sa, ca, 0.0])
        self.up = np.cross(self.back, self.right)

    def proj(self, P):
        P = np.atleast_2d(np.asarray(P, float))
        q = P - self.target
        x, y, z = q @ self.right, q @ self.up, q @ self.back
        s = self.dist / (self.dist - z)
        out = np.zeros((len(P), 3))
        out[:, 0] = self.c2[0] + self.k * s * x
        out[:, 1] = self.c2[1] + self.k * s * y
        return out

    def depth(self, P):
        return (np.atleast_2d(np.asarray(P, float)) - self.target) @ self.back

    def pos(self):
        return self.target + self.dist * self.back


def frame3(phi):
    u = np.array([np.cos(phi), np.sin(phi), 0.0])
    z = np.array([0.0, 0.0, 1.0])
    n = CS * u + SN * z          # rod axis
    e1 = -SN * u + CS * z        # in the disc plane, "up"
    e2 = np.cross(n, e1)         # in the disc plane, horizontal
    return u, n, e1, e2


def ring(R, num=120, z=0.0):
    t = np.linspace(0, 2 * np.pi, num)
    return np.stack([R * np.cos(t), R * np.sin(t), np.full_like(t, z)], 1)


def pline(pts, color, width=2.0, opacity=1.0):
    m = VMobject()
    m.set_points_as_corners(list(pts))
    return m.set_stroke(color, width=width, opacity=opacity).set_fill(opacity=0)


def ppoly(pts, fill, opacity=1.0, stroke=None, width=0.0):
    m = VMobject()
    pts = list(pts)
    m.set_points_as_corners(pts + [pts[0]])
    m.set_fill(fill, opacity=opacity)
    if stroke is None:
        m.set_stroke(width=0)
    else:
        m.set_stroke(stroke, width=width)
    return m


def pdashed(pts, color, width=2.0, opacity=1.0, on=3, off=3):
    m = VMobject()
    i, N = 0, len(pts)
    while i < N - 1:
        seg = pts[i:min(i + on + 1, N)]
        if len(seg) >= 2:
            m.start_new_path(seg[0])
            m.add_points_as_corners(seg[1:])
        i += on + off
    return m.set_stroke(color, width=width, opacity=opacity).set_fill(opacity=0)


def ground3d(cam, R=11.6):
    g = VGroup(ppoly(cam.proj(ring(R, 160)), "#111A2E", 1.0))
    for r in (2.5, 7.5):
        g.add(pline(cam.proj(ring(r, 140)), "#26314D", 1.5))
    for j in range(12):
        a = j * np.pi / 6
        g.add(pline(cam.proj([[0, 0, 0], [R * np.cos(a), R * np.sin(a), 0]]), "#202A43", 1.2))
    g.add(pline(cam.proj(ring(R, 160)), "#2A3656", 2))
    g.add(pdashed(cam.proj(ring(5.0, 240)), C_SMALL, 2, 0.6))
    g.add(pdashed(cam.proj(ring(10.0, 360)), C_BIG, 2, 0.6))
    return g


def disc3d(cam, c, R, n, e1, e2, psi, col, nseg=96):
    t = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    rim = c + R * (np.outer(np.cos(t), e1) + np.outer(np.sin(t), e2))
    shade = 0.35 + 0.65 * abs(float(n @ LIGHT))
    base = ManimColor(col)
    face = ManimColor(BG).interpolate(base, 0.22 + 0.5 * shade)
    g = VGroup(ppoly(cam.proj(rim), face, 0.97, stroke=col, width=3))
    ts = np.linspace(psi, psi + np.radians(55), 14)
    wedge = np.vstack([c, c + R * 0.96 * (np.outer(np.cos(ts), e1) + np.outer(np.sin(ts), e2))])
    g.add(ppoly(cam.proj(wedge), base.interpolate(ManimColor(WHITE), 0.2), 0.6))
    for j in range(6):
        a = psi + j * np.pi / 3
        g.add(pline(cam.proj([c, c + R * 0.96 * (np.cos(a) * e1 + np.sin(a) * e2)]),
                    WHITE, 1.6, 0.45))
    g.add(Dot(cam.proj(c)[0], radius=0.035, color=WHITE))
    return g


def shadow3d(cam, c, R, e1, e2, nseg=72):
    t = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    rim = c + R * (np.outer(np.cos(t), e1) + np.outer(np.sin(t), e2))
    rim[:, 2] = 0.0
    return ppoly(cam.proj(rim), "#000000", 0.38)


def omega_arc3d(cam, R=1.0, h=4.7, a0=np.radians(70)):
    ts = np.linspace(a0, a0 - 1.55 * np.pi, 60)      # clockwise seen from above
    pp = cam.proj(np.stack([R * np.cos(ts), R * np.sin(ts), np.full_like(ts, h)], 1))
    d = pp[-1] - pp[-2]
    d /= np.linalg.norm(d)
    nrm = np.array([-d[1], d[0], 0.0])
    tip = ppoly([pp[-1] + d * 0.17, pp[-1] + nrm * 0.085, pp[-1] - nrm * 0.085], C_OM, 1.0)
    return VGroup(pline(pp, C_OM, 3.5), tip)


def fade_family(mob, f):
    for m in mob.family_members_with_points():
        m.set_fill(opacity=m.get_fill_opacity() * f)
        m.set_stroke(opacity=m.get_stroke_opacity() * f)
    return mob


def psi_of(phi):
    # rolling without slipping: d(psi)/dt = -d(phi)/dt / sin(theta)
    return -phi / SN + 0.4


def scene3d(phi, cam):
    u, n, e1, e2 = frame3(phi)
    psi = psi_of(phi)
    c1, c2 = LL * n, 2 * LL * n
    grp = VGroup(ground3d(cam), shadow3d(cam, c1, 1, e1, e2), shadow3d(cam, c2, 2, e1, e2))
    cl = cam.proj([[0, 0, 0], 11.3 * u])
    grp.add(Line(cl[0], cl[1]).set_stroke(C_TOT, 10, 0.16))
    grp.add(Line(cl[0], cl[1]).set_stroke(C_TOT, 3.5))
    for p in (5 * u, 10 * u):
        grp.add(Dot(cam.proj(p)[0], radius=0.055, color=C_TOT))
    pO, pc1, pc2 = cam.proj([np.zeros(3), c1, c2])
    axis = DashedLine(pO, pc1, dash_length=0.08).set_stroke(C_ROD, 2.5, 0.8)
    rod = Line(pc1, pc2).set_stroke(C_ROD, 6)
    d1 = disc3d(cam, c1, 1.0, n, e1, e2, psi, C_SMALL)
    d2 = disc3d(cam, c2, 2.0, n, e1, e2, psi, C_BIG)
    cp = cam.pos()
    if (cp - c1) @ n < 0:
        order = [d2, rod, d1, axis]
    elif (cp - c2) @ n > 0:
        order = [axis, d1, rod, d2]
    else:
        order = [axis, d1, d2, rod]
    zt = cam.proj([[0, 0, 0], [0, 0, 5.6]])
    zax = VGroup(Arrow(zt[0], zt[1], buff=0, stroke_width=3, tip_length=0.16, color=MUTED),
                 Dot(zt[0], radius=0.06, color=TXT), omega_arc3d(cam))
    dz = cam.depth([[0, 0, 2.5]])[0]
    if dz < cam.depth([c1, c2]).mean():
        order = [zax] + order
    else:
        order = order + [zax]
    grp.add(*order)
    return grp


# ============================================================================
# Scenes
# ============================================================================
class S1Title(Scene):
    def construct(self):
        tag = T("JEE ADVANCED 2016  ·  ROTATIONAL MECHANICS", size=20, color=ACC, weight=BOLD)
        title = T("Two Discs Rolling Like a Cone", size=60, weight=BOLD)
        sub = T("Which statements about its angular momentum are true?", size=28, color=MUTED)
        grp = VGroup(tag, title, sub).arrange(DOWN, buff=0.38).shift(UP * 1.45)
        line = Line(LEFT * 1.4, RIGHT * 1.4).set_stroke(ACC, 3).next_to(sub, DOWN, buff=0.4)
        phi = ValueTracker(0.9)
        phi.add_updater(lambda m, dt: m.increment_value(-2 * PI / 9.0 * dt))
        vis = ValueTracker(0.0)
        mini = always_redraw(lambda: fade_family(
            scene3d(phi.get_value(), Cam(elev=22, azim=-100, k=0.21, dist=60, c2=(0, -2.25))),
            vis.get_value()))
        self.add(phi, mini)
        self.play(FadeIn(tag, shift=DOWN * 0.2), vis.animate.set_value(1.0), run_time=0.9)
        self.play(Write(title), run_time=1.8)
        self.play(FadeIn(sub, shift=UP * 0.2), Create(line), run_time=1.0)
        self.wait(3.2)
        self.play(FadeOut(VGroup(tag, title, sub, line)), vis.animate.set_value(0.0), run_time=0.9)
        phi.clear_updaters()


class S2Problem(Scene):
    def construct(self):
        head = heading("JEE ADVANCED 2016 · PAPER 2", "The problem")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        P = side_view(O=np.array([-6.35, -1.7, 0]))
        f = sv_map(O=np.array([-6.35, -1.7, 0]))
        base = sv_group(P, ["ground", "hatch", "axis", "zax", "O"])
        assembly = sv_group(P, ["rod", "d1", "d2", "c1", "c2"])
        P["lm"].next_to(f(C1 + PV), LEFT, buff=0.14).shift(DOWN * 0.05)
        labels = sv_group(P, ["lO", "lz", "lm", "l4m"])

        # dimension arrows "l" along the rod and radius labels
        off = 0.62 * 1.25 * PV
        def dim(a, b, txt):
            ar = DoubleArrow(f(a) + np.append(off, 0) * 1, f(b) + np.append(off, 0) * 1,
                             buff=0, stroke_width=2, tip_length=0.12, color=MUTED)
            lab = M(txt, size=30, color=TXT).move_to(ar.get_center() + np.append(PV, 0) * 0.28)
            return VGroup(ar, lab)
        dims = VGroup(dim((0, 0), C1, "l"), dim(C1, C2, "l"))
        ra = M("a", size=28, color=C_SMALL).move_to(f(C1 - 0.5 * PV) + np.append(NV, 0) * 0.22)
        r2a = M("2a", size=28, color=C_BIG).move_to(f(C2 - 1.0 * PV) + np.append(NV, 0) * 0.32)
        # spin symbol beyond the big disc
        spin = Arc(radius=0.36, start_angle=PI * 0.75, angle=-1.6 * PI).stretch(0.38, 0)
        spin.rotate(TH).move_to(f(2.16 * LL * NV)).set_stroke(C_W, 3)
        spin.add_tip(tip_length=0.12, tip_width=0.12)
        spin.get_tip().set_color(C_W)
        wl = M(r"\omega", size=34, color=C_W).next_to(spin, UP, buff=0.06)

        self.play(Create(base), run_time=1.2)
        self.play(Create(assembly), run_time=1.4)
        self.play(FadeIn(labels), FadeIn(dims), FadeIn(ra), FadeIn(r2a),
                  Create(spin), FadeIn(wl), run_time=1.2)

        pan = Panel(self, x0=1.0, top=2.35, buff=0.3, width=5.9)
        givens = [
            X(r"Thin discs: \ $m$, radius $a$ \ and \ $4m$, radius $2a$"),
            X(r"Joined by a massless rod through their centres"),
            X(r"$OC_1 = C_1C_2 = l = \sqrt{24}\,a$"),
            X(r"Rolls without slipping; spin about the rod $=\omega$"),
            X(r"$\vec L$ = angular momentum about $O$"),
        ]
        for g in givens:
            pan.place(g)
        self.play(LaggedStart(*[FadeIn(g, shift=LEFT * 0.2) for g in givens], lag_ratio=0.35),
                  run_time=3.0)
        self.wait(5.0)

        q = T("Which statements are true?", size=28, color=ACC, weight="SEMIBOLD")
        opts = [
            X(r"(a)", r"\ \ CM rotates about the $z$-axis at $\omega/5$"),
            X(r"(b)", r"\ \ $L$ of the CM about $O$ $=81\,ma^2\omega$"),
            X(r"(c)", r"\ \ $L$ about the CM $=\tfrac{17}{2}\,ma^2\omega$"),
            X(r"(d)", r"\ \ $|L_z| = 55\,ma^2\omega$"),
        ]
        pan.clear()
        pan.place(q)
        for o in opts:
            pan.place(o, buff=0.34)
        self.play(FadeIn(q, shift=DOWN * 0.15), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(o, shift=LEFT * 0.2) for o in opts], lag_ratio=0.3),
                  run_time=2.4)
        self.wait(6.5)

        sc = scorecard("????")
        self.play(
            *[ReplacementTransform(o[0], sc[i]) for i, o in enumerate(opts)],
            *[FadeOut(o[1]) for o in opts], FadeOut(q), run_time=1.3)
        self.wait(0.4)
        rest = [m for m in self.mobjects if m not in sc.submobjects and m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S3Motion(Scene):
    def construct(self):
        sc = scorecard("????")
        self.add(sc)
        head = heading("THE SET-UP IN 3D", "What the motion looks like")

        phi = ValueTracker(0.35)
        el = ValueTracker(13.0)
        az = ValueTracker(-112.0)
        rate = 2 * PI / 9.0                       # one precession turn every 9 s
        phi.add_updater(lambda m, dt: m.increment_value(-rate * dt))

        def cam():
            return Cam(elev=el.get_value(), azim=az.get_value())

        vis = ValueTracker(0.0)
        world = always_redraw(lambda: fade_family(scene3d(phi.get_value(), cam()), vis.get_value()))

        def tracker_label(mob, point_fn, offset):
            mob.add_updater(lambda m: m.move_to(cam().proj(point_fn())[0] + offset))
            return mob

        def top_of(R, d):
            def fn():
                u, n, e1, e2 = frame3(phi.get_value())
                return d * n + R * e1
            return fn

        lm = tracker_label(T("m", 26, color=C_SMALL, weight=BOLD), top_of(1.0, LL), UP * 0.27)
        l4m = tracker_label(T("4m", 26, color=C_BIG, weight=BOLD), top_of(2.0, 2 * LL), UP * 0.27)
        lO = tracker_label(T("O", 24), lambda: np.zeros(3), LEFT * 0.28 + DOWN * 0.08)
        lz = tracker_label(T("z", 24, color=MUTED), lambda: np.array([0, 0, 5.6]), RIGHT * 0.22)
        lOm = tracker_label(M(r"\Omega", size=34, color=C_OM), lambda: np.array([1.15, -0.9, 4.7]),
                            RIGHT * 0.1)

        self.add(phi)
        self.add(world)
        self.bring_to_front(sc)
        self.play(FadeIn(head, shift=RIGHT * 0.2), vis.animate.set_value(1.0), run_time=1.2)
        self.play(FadeIn(VGroup(lm, l4m, lO, lz, lOm)), el.animate.set_value(26),
                  az.animate.set_value(-100), run_time=2.0)
        az.add_updater(lambda m, dt: m.increment_value(1.6 * dt))
        self.add(az)

        caps = [
            ("Each disc is perpendicular to the rod; the rod's line passes through O.", {}),
            ("Both rims touch the ground on one line through O: a cone with its tip at O.",
             {"one line": C_TOT}),
            ("It circles O (precession Ω) while spinning about the rod (spin ω).",
             {"Ω": C_OM, "ω": C_W}),
            ("No slipping: the contact line is momentarily at rest (instantaneous axis).",
             {"contact line": C_TOT}),
        ]
        x0, y = 2.85, 2.25
        shown = []
        for i, (s, t2c) in enumerate(caps):
            num = T(f"{i + 1}", size=20, color=ACC, weight=BOLD)
            body = T("\n".join(textwrap.wrap(s, 28)), size=23, line_spacing=0.9, t2c=t2c)
            if body.width > 3.75:
                body.scale_to_fit_width(3.75)
            num.move_to([x0 + 0.1, y - 0.12, 0])
            body.move_to([x0 + 0.38 + body.width / 2, y - body.height / 2, 0])
            y -= body.height + 0.38
            grp = VGroup(num, body)
            anims = [FadeIn(grp, shift=UP * 0.15)]
            anims += [g.animate.set_opacity(0.45) for g in shown]
            self.play(*anims, run_time=0.8)
            shown.append(grp)
            self.wait(4.6)
        self.play(*[g.animate.set_opacity(1) for g in shown], run_time=0.6)
        self.wait(3.0)
        self.play(FadeOut(VGroup(head, *shown, lm, l4m, lO, lz, lOm)), vis.animate.set_value(0.0),
                  run_time=1.0)
        phi.clear_updaters()
        az.clear_updaters()


class S4Geometry(Scene):
    def construct(self):
        sc = scorecard("????")
        self.add(sc)
        head = heading("STEP 1 OF 5 · GEOMETRY", "Where do the rims touch the ground?")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        kB = 1.24
        PB = side_view(k=kB, big=False, labels=False, xmax=5.6, zmax=3.25)
        fB = sv_map(k=kB)
        base = sv_group(PB, ["ground", "hatch", "axis", "zax", "O"])
        disc = sv_group(PB, ["d1", "c1"])
        lO = T("O", 26).next_to(PB["O"], UL, buff=0.06)
        lC1 = M("C_1", size=30).move_to(fB(C1) + np.array([-0.38, 0.34, 0]))
        p1dot = Dot(fB(P1), radius=0.06, color=C_TOT)
        lP1 = M("P_1", size=30).next_to(fB(P1), DOWN, buff=0.2).shift(RIGHT * 0.18)
        lm = T("m", 26, color=C_SMALL, weight="SEMIBOLD").next_to(fB(C1 + PV), UP, buff=0.1)

        self.play(Create(base), run_time=1.0)
        self.play(Create(disc), FadeIn(lO), FadeIn(lm), run_time=1.0)
        self.play(FadeIn(lC1), FadeIn(p1dot, scale=1.6), FadeIn(lP1), run_time=0.8)

        tri = Polygon(fB((0, 0)), fB(C1), fB(P1)).set_stroke(width=0).set_fill(C_SMALL, 0.16)
        leg1 = Line(fB((0, 0)), fB(C1)).set_stroke(TXT, 3)
        leg2 = Line(fB(C1), fB(P1)).set_stroke(C_SMALL, 4)
        hyp = Line(fB((0, 0)), fB(P1)).set_stroke(C_TOT, 4)
        ra = RightAngle(Line(fB(C1), fB((0, 0))), Line(fB(C1), fB(P1)), length=0.2,
                        stroke_width=2, color=TXT)
        l_leg1 = M(r"l=\sqrt{24}\,a", size=30).rotate(TH)
        l_leg1.move_to((fB((0, 0)) + fB(C1)) / 2 + np.append(PV, 0) * 0.32)
        l_leg2 = M("a", size=32, color=C_SMALL).move_to((fB(C1) + fB(P1)) / 2 + np.append(NV, 0) * 0.25)
        self.play(FadeIn(tri), Create(leg1), Create(leg2), Create(ra), run_time=1.0)
        self.play(Write(l_leg1), Write(l_leg2), run_time=1.0)

        pan = Panel(self, x0=0.75)
        e0 = pan.place(X(r"Radius $\perp$ rod $\Rightarrow$ right angle at $C_1$"))
        e1 = pan.place(M(r"OP_1=\sqrt{l^2+a^2}=\sqrt{24a^2+a^2}=5a"))
        self.play(FadeIn(e0, shift=LEFT * 0.2), run_time=0.8)
        self.wait(1.0)
        self.play(Create(hyp), Write(e1), run_time=1.6)
        l_hyp = M("5a", size=32, color=C_TOT).move_to((fB((0, 0)) + fB(P1)) / 2 + DOWN * 0.42)
        self.play(FadeIn(l_hyp, shift=UP * 0.1), run_time=0.6)
        self.wait(1.5)

        ang = Angle(Line(fB((0, 0)), fB(P1)), Line(fB((0, 0)), fB(C1)), radius=1.5,
                    stroke_width=3, color=ACC)
        l_th = M(r"\theta", size=32, color=ACC).move_to(
            fB((0, 0)) + 1.82 * np.array([np.cos(TH / 2), np.sin(TH / 2), 0]))
        e2 = pan.place(M(r"\sin\theta=\frac{C_1P_1}{OP_1}=\frac{a}{5a}=\frac{1}{5}"), buff=0.4)
        e3 = pan.place(M(r"\cos\theta=\frac{\sqrt{24}}{5}"), buff=0.3)
        self.play(Create(ang), FadeIn(l_th), run_time=0.8)
        self.play(Write(e2), run_time=1.4)
        self.play(Write(e3), run_time=0.9)
        box = result_box(VGroup(e2[0][-3:]))
        self.play(Create(box), run_time=0.6)
        self.wait(2.5)

        # ---- zoom out: the big disc is the small one scaled x2 about O ----
        PS = side_view(k=0.62, big=True, labels=False)
        fS = sv_map(k=0.62)
        small_base = sv_group(PS, ["ground", "hatch", "axis", "zax", "O"])
        small_disc = sv_group(PS, ["d1", "c1"])
        big_disc = sv_group(PS, ["rod", "d2", "c2"])
        self.play(
            FadeOut(VGroup(tri, leg1, leg2, ra, l_leg1, l_leg2, hyp, l_hyp, ang, l_th, lC1, lP1)),
            run_time=0.6)
        p1s = Dot(fS(P1), radius=0.05, color=C_TOT)
        p2s = Dot(fS(P2), radius=0.06, color=C_TOT)
        lm2 = T("m", 24, color=C_SMALL, weight="SEMIBOLD").next_to(fS(C1 + PV), UP, buff=0.1)
        self.play(ReplacementTransform(base, small_base), ReplacementTransform(disc, small_disc),
                  ReplacementTransform(p1dot, p1s), ReplacementTransform(lm, lm2),
                  lO.animate.next_to(PS["O"], UL, buff=0.06), run_time=1.6)
        l4m = T("4m", 24, color=C_BIG, weight="SEMIBOLD").next_to(fS(C2 + 2 * PV), UP, buff=0.1)
        self.play(Create(big_disc), FadeIn(l4m), FadeIn(p2s, scale=1.6), run_time=1.2)

        tri2 = Polygon(fS((0, 0)), fS(C2), fS(P2)).set_stroke(width=0).set_fill(C_BIG, 0.12)
        lC2 = M("C_2", size=28).move_to(fS(C2) + np.array([-0.36, 0.3, 0]))
        lP1s = M("P_1", size=28).next_to(fS(P1), DOWN, buff=0.22)
        lP2 = M("P_2", size=28).next_to(fS(P2), DOWN, buff=0.22)
        self.play(FadeIn(tri2), FadeIn(lC2), FadeIn(lP1s), FadeIn(lP2), run_time=0.8)

        pan.clear(keep=[VGroup(e2, box)])
        e4 = pan.place(X(r"Big disc: the same triangle, twice the size"), buff=0.45)
        e5 = pan.place(M(r"OP_2=\sqrt{(2l)^2+(2a)^2}=10a"))
        e6 = pan.place(X(r"So $O$, $P_1$, $P_2$ lie on one line: the"), buff=0.4)
        e7 = pan.place(X(r"\textbf{contact line} --- the instantaneous axis", color=C_TOT), buff=0.12)
        self.play(FadeIn(e4, shift=LEFT * 0.2), run_time=0.8)
        self.play(Write(e5), run_time=1.3)
        cl = Line(fS((0, 0)), fS((10.8, 0))).set_stroke(C_TOT, 5)
        self.play(Create(cl), FadeIn(e6, shift=LEFT * 0.2), FadeIn(e7, shift=LEFT * 0.2), run_time=1.2)
        self.wait(4.0)
        rest = [m for m in self.mobjects if m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S5Omega(Scene):
    def construct(self):
        sc = scorecard("????")
        self.add(sc)
        head = heading("STEP 2 OF 5 · ANGULAR VELOCITY", "Rolling fixes the precession rate")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        P = side_view()
        f = sv_map()
        diag = sv_group(P)
        cl = Line(f((0, 0)), f((10.8, 0))).set_stroke(C_TOT, 4)
        self.play(FadeIn(diag), Create(cl), run_time=1.2)

        pan = Panel(self, x0=0.75)
        a1 = pan.place(X(r"No slipping $\Rightarrow$ the contact line is at rest"))
        a2 = pan.place(X(r"$\Rightarrow$ $\vec\omega_{\rm total}$ points along the contact line"), buff=0.14)
        self.play(FadeIn(a1, shift=LEFT * 0.2), run_time=0.8)
        self.play(FadeIn(a2, shift=LEFT * 0.2), run_time=0.8)
        self.wait(1.2)

        a3 = pan.place(M(r"\vec\omega_{\rm total}", r"=", r"\omega\,\hat n", r"+", r"\vec\Omega"), buff=0.4)
        a3[2].set_color(C_W)
        a3[4].set_color(C_OM)
        a3b = pan.place(X(r"($\omega$ = spin about the rod, relative to the turning rod)",
                          size=26, color=MUTED), buff=0.12)
        self.play(Write(a3), run_time=1.2)
        self.play(FadeIn(a3b), run_time=0.6)

        # vector construction on the diagram
        self.play(VGroup(P["d1"], P["d2"], P["rod"], P["c1"], P["c2"]).animate.set_opacity(0.3),
                  run_time=0.6)
        Lw = 4.4
        Ow = f((0, 0))
        tipw = Ow + Lw * np.array([CS, SN, 0])
        foot = Ow + Lw * CS * RIGHT
        w_arr = Arrow(Ow, tipw, buff=0, stroke_width=6, tip_length=0.22, color=C_W)
        w_lab = M(r"\omega", size=34, color=C_W).move_to((Ow + tipw) / 2 + np.append(PV, 0) * 0.32)
        self.play(GrowArrow(w_arr), FadeIn(w_lab), run_time=1.0)
        om_z = Arrow(Ow + UP * 1.75, Ow + UP * 0.87, buff=0, stroke_width=6, tip_length=0.2, color=C_OM)
        om_lab = M(r"\Omega", size=32, color=C_OM).next_to(om_z, LEFT, buff=0.1)
        self.play(GrowArrow(om_z), FadeIn(om_lab), run_time=0.9)
        self.wait(0.6)
        om_moved = Arrow(tipw, foot, buff=0, stroke_width=6, tip_length=0.2, color=C_OM)
        self.play(ReplacementTransform(om_z, om_moved), om_lab.animate.next_to(om_moved, RIGHT, buff=0.1),
                  run_time=1.2)
        tot = Arrow(Ow, foot, buff=0, stroke_width=7, tip_length=0.24, color=C_TOT)
        tot_lab = M(r"\omega_{\rm total}", size=30, color=C_TOT).next_to(tot, DOWN, buff=0.32)
        ra = RightAngle(Line(foot, Ow), Line(foot, tipw), length=0.16, stroke_width=2, color=TXT)
        ang = Angle(Line(Ow, foot), Line(Ow, tipw), radius=1.1, stroke_width=3, color=ACC)
        th = M(r"\theta", size=30, color=ACC).move_to(Ow + 1.38 * np.array([np.cos(TH / 2), np.sin(TH / 2), 0]))
        self.play(GrowArrow(tot), FadeIn(tot_lab), Create(ra), Create(ang), FadeIn(th), run_time=1.2)
        self.wait(1.0)

        a4 = pan.place(X(r"Vertical parts must cancel:"), buff=0.4)
        a5 = pan.place(M(r"\Omega", r"=", r"\omega", r"\sin\theta", r"=", r"\frac{\omega}{5}"), buff=0.2)
        a5[0].set_color(C_OM)
        a5[2].set_color(C_W)
        a6 = pan.place(M(r"\omega_{\rm total}", r"=", r"\omega\cos\theta", r"=", r"\frac{\sqrt{24}}{5}\,\omega"), buff=0.3)
        a6[0].set_color(C_TOT)
        self.play(FadeIn(a4, shift=LEFT * 0.2), run_time=0.7)
        self.play(Write(a5), run_time=1.4)
        b5 = result_box(a5)
        self.play(Create(b5), run_time=0.6)
        self.play(Write(a6), run_time=1.3)
        self.wait(3.0)

        pan.clear(keep=[VGroup(a5, b5)])
        c1 = pan.place(X(r"Check at the contact point $P_1$ (distance $5a$ from $O$):"), buff=0.45)
        c2 = pan.place(X(r"carried round $O$ at $\Omega\cdot 5a$, spun backwards at $\omega a$"), buff=0.14)
        c3 = pan.place(M(r"\Omega\,(5a)=\omega\,a\;\Rightarrow\;\Omega=\frac{\omega}{5}\ \checkmark"), buff=0.25)
        self.play(FadeIn(c1, shift=LEFT * 0.2), run_time=0.7)
        self.play(FadeIn(c2, shift=LEFT * 0.2), run_time=0.7)
        self.play(Write(c3), run_time=1.3)
        self.wait(2.0)
        c4 = pan.place(X(r"The CM is on the rod, so it circles the"), buff=0.42)
        c5 = pan.place(X(r"$z$-axis at $\Omega=\omega/5$"), buff=0.12)
        self.play(FadeIn(c4, shift=LEFT * 0.2), FadeIn(c5, shift=LEFT * 0.2), run_time=0.9)
        bd = badge("a", True)
        pan.place(bd, buff=0.35)
        self.play(FadeIn(bd, scale=1.15), run_time=0.7)
        mark_chip(self, sc, 0, "T")
        self.wait(3.0)
        rest = [m for m in self.mobjects if m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S6CentreOfMass(Scene):
    def construct(self):
        sc = scorecard("T???")
        self.add(sc)
        head = heading("STEP 3 OF 5 · CENTRE OF MASS", "Checking statement (b)")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)
        P = side_view()
        f = sv_map()
        diag = sv_group(P)
        self.play(FadeIn(diag), run_time=1.0)

        cm = f(RCM)
        cm_dot = VGroup(Dot(cm, radius=0.09, color=WHITE), Circle(radius=0.16, color=WHITE, stroke_width=2).move_to(cm))
        cm_lab = T("CM", 22, weight=BOLD).next_to(cm, UP, buff=0.22)
        r_line = Line(f((0, 0)), cm).set_stroke(WHITE, 4)
        r_lab = M(r"r_{\rm cm}", size=30).move_to((f((0, 0)) + cm) / 2 + np.append(PV, 0) * 0.32 + LEFT * 0.4)

        pan = Panel(self, x0=0.75)
        b1 = pan.place(M(r"r_{\rm cm}=\frac{m\,l+4m\,(2l)}{5m}=\frac{9l}{5}\approx 8.82\,a"))
        self.play(FadeIn(cm_dot, scale=1.5), FadeIn(cm_lab), run_time=0.8)
        self.play(Create(r_line), FadeIn(r_lab), Write(b1), run_time=1.6)
        self.wait(1.5)

        Rl = DashedLine(f((0, RCM[1])), cm, dash_length=0.08).set_stroke(ACC, 3)
        R_lab = M(r"R", size=30, color=ACC).next_to(Rl, UP, buff=0.08).shift(LEFT * 1.2)
        b2 = pan.place(M(r"R=r_{\rm cm}\cos\theta=\frac{216}{25}\,a=8.64\,a"), buff=0.3)
        b2n = pan.place(X(r"(radius of the CM's circle)", size=24, color=MUTED), buff=0.1)
        self.play(Create(Rl), FadeIn(R_lab), Write(b2), FadeIn(b2n), run_time=1.5)
        self.wait(1.2)
        b3 = pan.place(M(r"v_{\rm cm}=\Omega R=\frac{\omega}{5}\cdot 8.64\,a=1.728\,a\omega"), buff=0.3)
        self.play(Write(b3), run_time=1.4)
        self.wait(1.0)
        b4 = pan.place(M(r"L_{\rm cm}=M\,r_{\rm cm}\,v_{\rm cm}\qquad(\vec r_{\rm cm}\perp\vec v_{\rm cm})"), buff=0.3)
        b5 = pan.place(M(r"=5m\times 8.82a\times 1.728\,a\omega\approx 76.2\,ma^2\omega"), buff=0.2, indent=0.6)
        self.play(Write(b4), run_time=1.3)
        self.play(Write(b5), run_time=1.5)
        bx = result_box(b5[0][-8:])
        self.play(Create(bx), run_time=0.5)
        self.wait(1.5)
        pan.clear(keep=[VGroup(b4, b5, bx)])
        claim = pan.place(M(r"\text{claimed: } 81\,ma^2\omega\quad\Rightarrow\quad 76.2\neq 81", color=TXT), buff=0.35)
        self.play(FadeIn(claim, shift=LEFT * 0.2), run_time=0.8)
        bd = badge("b", False)
        pan.place(bd, buff=0.3)
        self.play(FadeIn(bd, scale=1.15), run_time=0.7)
        mark_chip(self, sc, 1, "F")
        self.wait(2.5)

        # where 81 comes from
        pan.clear(keep=[])
        g = f((9, 0))
        ghost = VGroup(Dot(g, radius=0.08, color=BAD), Circle(radius=0.15, color=BAD, stroke_width=2).move_to(g))
        ghost_l = M(r"9a?", size=28, color=BAD).next_to(g, DOWN, buff=0.28)
        w1 = pan.place(T("Where does 81 come from?", size=28, color=ACC, weight="SEMIBOLD"))
        w2 = pan.place(X(r"Putting the CM on the ground, at"), buff=0.3)
        w3 = pan.place(M(r"\frac{m(5a)+4m(10a)}{5m}=9a"), buff=0.15)
        w4 = pan.place(M(r"5m\cdot 9a\cdot\frac{\omega}{5}\,(9a)=81\,ma^2\omega"), buff=0.25)
        w5 = pan.place(X(r"But the CM is on the rod: $8.82a$ from $O$,"), buff=0.4)
        w6 = pan.place(X(r"on a circle of radius $8.64a$ $\Rightarrow$ $76.2\,ma^2\omega$"), buff=0.12)
        self.play(FadeIn(w1, shift=LEFT * 0.2), run_time=0.7)
        self.play(FadeIn(w2, shift=LEFT * 0.2), Write(w3), FadeIn(ghost, scale=1.4), FadeIn(ghost_l), run_time=1.4)
        self.play(Write(w4), run_time=1.3)
        self.wait(2.0)
        self.play(FadeIn(w5, shift=LEFT * 0.2), FadeIn(w6, shift=LEFT * 0.2),
                  Indicate(cm_dot, color=WHITE, scale_factor=1.4), run_time=1.2)
        self.wait(3.5)
        rest = [m for m in self.mobjects if m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S7AboutCM(Scene):
    def construct(self):
        sc = scorecard("TF??")
        self.add(sc)
        head = heading("STEP 4 OF 5 · ANGULAR MOMENTUM ABOUT THE CM", "Checking statement (c)")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        pan = Panel(self, x0=0.75)
        s1 = pan.place(X(r"Spin only would give $I_{\rm axis}\,\omega$:"))
        s2 = pan.place(M(r"I_{\rm axis}=\frac{ma^2}{2}+\frac{4m(2a)^2}{2}=\frac{17}{2}\,ma^2"), buff=0.2)
        s3 = pan.place(X(r"$\Rightarrow\ \tfrac{17}{2}\,ma^2\omega$ \ \ --- exactly option (c)"), buff=0.2)
        self.play(FadeIn(s1, shift=LEFT * 0.2), run_time=0.7)
        self.play(Write(s2), run_time=1.4)
        self.play(FadeIn(s3, shift=LEFT * 0.2), run_time=0.8)
        self.wait(1.2)
        s4 = pan.place(X(r"But the body turns about the \textbf{contact line},"), buff=0.4)
        s5 = pan.place(X(r"not about the rod: $\vec\omega_{\rm total}$ is horizontal."), buff=0.12)
        self.play(FadeIn(s4, shift=LEFT * 0.2), FadeIn(s5, shift=LEFT * 0.2), run_time=0.9)

        # vector inset around the CM
        Q = np.array([-5.75, 0.2, 0])
        nv = np.array([CS, SN, 0])
        rodline = DashedLine(Q - 1.0 * nv, Q + 4.3 * nv, dash_length=0.1).set_stroke(C_ROD, 2.5, 0.8)
        rod_lab = T("rod axis", 20, color=MUTED).next_to(Q + 4.3 * nv, UP, buff=0.12)
        qd = VGroup(Dot(Q, radius=0.08, color=WHITE), Circle(radius=0.15, color=WHITE, stroke_width=2).move_to(Q))
        q_lab = T("CM", 20, weight=BOLD).next_to(Q, UL, buff=0.12)
        Lt = 3.5
        tot_end = Q + Lt * RIGHT
        par_end = Q + Lt * CS * nv
        tot = Arrow(Q, tot_end, buff=0, stroke_width=7, tip_length=0.24, color=C_TOT)
        tot_l = M(r"\omega_{\rm total}=\omega\cos\theta", size=30, color=C_TOT).next_to(tot, DOWN, buff=0.3)
        par = Arrow(Q, par_end, buff=0, stroke_width=6, tip_length=0.22, color=C_PAR)
        perp = Arrow(par_end, tot_end, buff=0, stroke_width=6, tip_length=0.18, color=C_PERP)
        par_l = M(r"\omega_\parallel=\omega\cos^2\theta", size=28, color=C_PAR).move_to(
            Q + 0.45 * Lt * CS * nv + UP * 0.5)
        perp_l = M(r"\omega_\perp=\omega\sin\theta\cos\theta", size=28, color=C_PERP).next_to(
            (par_end + tot_end) / 2, RIGHT, buff=0.18)
        ra = RightAngle(Line(par_end, Q), Line(par_end, tot_end), length=0.14, stroke_width=2, color=TXT)
        ang = Angle(Line(Q, tot_end), Line(Q, par_end), radius=1.15, stroke_width=3, color=ACC)
        th = M(r"\theta", size=28, color=ACC).move_to(Q + 1.42 * np.array([np.cos(TH / 2), np.sin(TH / 2), 0]))
        self.play(Create(rodline), FadeIn(rod_lab), FadeIn(qd), FadeIn(q_lab), run_time=1.0)
        self.play(GrowArrow(tot), FadeIn(tot_l), run_time=1.0)
        self.play(GrowArrow(par), FadeIn(par_l), Create(ang), FadeIn(th), run_time=0.9)
        self.play(GrowArrow(perp), FadeIn(perp_l), Create(ra), run_time=0.9)
        self.wait(2.5)

        pan.clear(keep=[])
        t1 = pan.place(M(r"I_\perp=\frac{ma^2}{4}+m\Big(\frac{4l}{5}\Big)^2+\frac{4m(2a)^2}{4}+4m\Big(\frac{l}{5}\Big)^2", size=34))
        t1b = pan.place(M(r"=\frac{469}{20}\,ma^2\approx 23.45\,ma^2", size=34), buff=0.15, indent=0.6)
        t1n = pan.place(X(r"(about the CM, perpendicular to the rod)", size=26, color=MUTED), buff=0.12)
        self.play(Write(t1), run_time=1.8)
        self.play(Write(t1b), FadeIn(t1n), run_time=1.1)
        self.wait(1.5)
        t2 = pan.place(M(r"L_\parallel=I_{\rm axis}\,\omega_\parallel=\tfrac{17}{2}\cdot\tfrac{24}{25}\,ma^2\omega=8.16\,ma^2\omega", size=32), buff=0.36)
        t2[0][0:2].set_color(C_PAR)
        t3 = pan.place(M(r"L_\perp=I_\perp\,\omega_\perp=23.45\cdot\tfrac{\sqrt{24}}{25}\,ma^2\omega\approx 4.60\,ma^2\omega", size=32), buff=0.26)
        t3[0][0:2].set_color(C_PERP)
        self.play(Write(t2), run_time=1.5)
        self.play(Write(t3), run_time=1.5)
        self.wait(2.0)
        pan.clear(keep=[VGroup(t2, t3)])
        t4 = pan.place(M(r"|\vec L_{\rm about\ CM}|=\sqrt{L_\parallel^2+L_\perp^2}", size=34), buff=0.4)
        t4b = pan.place(M(r"=\sqrt{8.16^2+4.60^2}\approx 9.37\,ma^2\omega", size=34), buff=0.18, indent=0.6)
        self.play(Write(t4), run_time=1.2)
        self.play(Write(t4b), run_time=1.3)
        bx = result_box(t4b[0][-8:])
        self.play(Create(bx), run_time=0.5)
        self.wait(1.0)
        t5 = pan.place(M(r"\text{claimed: } \tfrac{17}{2}=8.5\quad\Rightarrow\quad 9.37\neq 8.5"), buff=0.35)
        self.play(FadeIn(t5, shift=LEFT * 0.2), run_time=0.8)
        bd = badge("c", False)
        pan.place(bd, buff=0.3)
        self.play(FadeIn(bd, scale=1.15), run_time=0.7)
        mark_chip(self, sc, 2, "F")
        self.wait(3.5)
        rest = [m for m in self.mobjects if m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S8Lz(Scene):
    def construct(self):
        sc = scorecard("TFF?")
        self.add(sc)
        head = heading("STEP 5 OF 5 · z-COMPONENT OF L", "Checking statement (d)")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        pan = Panel(self, x0=0.75)
        u1 = pan.place(X(r"$O$ never moves, so \ $\vec L = I_O\,\vec\omega_{\rm total}$"))
        u2 = pan.place(M(r"I_\parallel=\tfrac{17}{2}\,ma^2"), buff=0.3)
        u3 = pan.place(M(r"I_\perp^{(O)}=\frac{ma^2}{4}+ml^2+\frac{4m(2a)^2}{4}+4m(2l)^2"), buff=0.25)
        u3b = pan.place(M(r"=\frac{1649}{4}\,ma^2\approx 412\,ma^2"), buff=0.15, indent=0.6)
        self.play(FadeIn(u1, shift=LEFT * 0.2), run_time=0.8)
        self.wait(0.8)
        self.play(Write(u2), run_time=0.9)
        self.play(Write(u3), run_time=1.7)
        self.play(Write(u3b), run_time=1.0)
        self.wait(1.0)
        u4 = pan.place(M(r"L_\parallel=I_\parallel\,\omega\cos^2\theta\approx 8.16\,ma^2\omega"), buff=0.32)
        u4[0][0:2].set_color(C_PAR)
        u5 = pan.place(M(r"L_\perp=I_\perp^{(O)}\,\omega\sin\theta\cos\theta\approx 80.8\,ma^2\omega"), buff=0.2)
        u5[0][0:2].set_color(C_PERP)
        self.play(Write(u4), run_time=1.2)
        self.play(Write(u5), run_time=1.2)

        # vector diagram: L_perp dominates; project it on z
        Q = np.array([-4.3, 1.65, 0])
        nv = np.array([CS, SN, 0])
        pv = np.array([SN, -CS, 0])
        s = 0.034
        rodline = DashedLine(Q - 1.8 * nv, Q + 2.4 * nv, dash_length=0.1).set_stroke(C_ROD, 2.5, 0.75)
        rod_lab = T("rod axis", 20, color=MUTED).next_to(Q + 2.4 * nv, DOWN, buff=0.12)
        zline = DashedLine(Q + UP * 0.6, Q + DOWN * 3.2, dash_length=0.1).set_stroke(MUTED, 2.5, 0.75)
        z_lab = T("z", 22, color=MUTED).next_to(Q + UP * 0.6, LEFT, buff=0.1)
        dot = Dot(Q, radius=0.06, color=TXT)
        Lpar = 8.16 * s * nv
        Lperp = 80.784 * s * pv
        tip = Q + Lperp
        a_par = Arrow(Q, Q + Lpar, buff=0, stroke_width=6, tip_length=0.12,
                      max_tip_length_to_length_ratio=0.5, color=C_PAR)
        a_perp = Arrow(Q, tip, buff=0, stroke_width=7, tip_length=0.24, color=C_PERP)
        l_par = M(r"L_\parallel\ (\text{tiny})", size=28, color=C_PAR).next_to(Q + Lpar, UP, buff=0.32).shift(RIGHT * 0.8)
        l_perp = M(r"L_\perp", size=32, color=C_PERP).move_to(Q + 0.55 * Lperp + RIGHT * 0.42)
        ang = Angle(Line(Q, Q + DOWN), Line(Q, Q + pv), radius=1.0, stroke_width=3, color=ACC)
        th = M(r"\theta", size=28, color=ACC).move_to(Q + 1.25 * np.array([np.cos(-1.2), np.sin(-1.2), 0]))
        foot = np.array([Q[0], tip[1], 0])
        proj = DashedLine(tip, foot, dash_length=0.06).set_stroke(ACC, 2.5)
        lz_br = BraceBetweenPoints(Q, foot, direction=LEFT, color=ACC)
        lz_lab = M(r"L_\perp\cos\theta", size=30, color=ACC).next_to(lz_br, LEFT, buff=0.1)
        self.play(Create(rodline), FadeIn(rod_lab), Create(zline), FadeIn(z_lab), FadeIn(dot), run_time=1.0)
        self.play(GrowArrow(a_par), FadeIn(l_par), run_time=0.8)
        self.play(GrowArrow(a_perp), FadeIn(l_perp), run_time=1.0)
        self.play(Create(ang), FadeIn(th), run_time=0.7)
        self.play(Create(proj), GrowFromCenter(lz_br), FadeIn(lz_lab), run_time=1.0)
        self.wait(2.0)

        pan.clear(keep=[])
        v1 = pan.place(M(r"|L_z|=L_\perp\cos\theta-L_\parallel\sin\theta"))
        v1b = pan.place(M(r"\approx 79.15-1.63", size=34), buff=0.18, indent=0.6)
        v2 = pan.place(M(r"=\omega\sin\theta\cos^2\theta\,\big(I_\perp^{(O)}-I_\parallel\big)", size=34), buff=0.32, indent=0.6)
        v3 = pan.place(M(r"=\frac{1}{5}\cdot\frac{24}{25}\Big(\frac{1649}{4}-\frac{17}{2}\Big)ma^2\omega", size=34), buff=0.2, indent=0.6)
        v4 = pan.place(M(r"=\frac{1938}{25}\,ma^2\omega=77.52\,ma^2\omega", size=34), buff=0.2, indent=0.6)
        self.play(Write(v1), run_time=1.3)
        self.play(Write(v1b), run_time=1.0)
        self.wait(1.0)
        self.play(Write(v2), run_time=1.3)
        self.play(Write(v3), run_time=1.5)
        self.play(Write(v4), run_time=1.2)
        bx = result_box(v4[0][-9:])
        self.play(Create(bx), run_time=0.5)
        self.wait(2.0)

        others = [v1, v1b, v2, v3]
        pan.items, pan.y = [], pan.top
        res = pan.place(M(r"|L_z|=77.52\,ma^2\omega"))
        resbox = result_box(res)
        self.play(*[FadeOut(m) for m in others],
                  ReplacementTransform(VGroup(v4, bx), VGroup(res, resbox)), run_time=0.9)
        v5 = pan.place(X(r"Cross-check: \ $74.65$ (CM's orbit)", size=28, color=MUTED), buff=0.4)
        v5b = pan.place(X(r"$+\ 2.87$ (about the CM) $=77.52\ \checkmark$", size=28, color=MUTED), buff=0.12, indent=1.55)
        self.play(FadeIn(v5, shift=LEFT * 0.2), FadeIn(v5b, shift=LEFT * 0.2), run_time=0.8)
        self.wait(1.0)
        v6 = pan.place(M(r"\text{claimed: } 55\,ma^2\omega\quad\Rightarrow\quad 77.5\neq 55"), buff=0.4)
        self.play(FadeIn(v6, shift=LEFT * 0.2), run_time=0.8)
        bd = badge("d", False)
        pan.place(bd, buff=0.3)
        self.play(FadeIn(bd, scale=1.15), run_time=0.7)
        mark_chip(self, sc, 3, "F")
        self.wait(3.5)
        rest = [m for m in self.mobjects if m is not sc]
        self.play(*[FadeOut(m) for m in rest], run_time=0.8)


class S9Summary(Scene):
    def construct(self):
        sc = scorecard("TFFF")
        self.add(sc)
        head = heading("SUMMARY", "What the exact calculation gives")
        self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=0.8)

        cols = [-4.7, -1.2, 1.7, 4.6]
        left = -6.3
        hdr = VGroup(
            T("Statement", 24, color=MUTED, weight=BOLD), T("Claimed", 24, color=MUTED, weight=BOLD),
            T("Exact", 24, color=MUTED, weight=BOLD), T("Verdict", 24, color=MUTED, weight=BOLD))
        y0 = 2.3
        for h, x in zip(hdr, cols):
            h.move_to([x, y0, 0])
        hdr[0].move_to([left + hdr[0].width / 2, y0, 0])
        rows_data = [
            (r"(a)\ \ $\Omega_{\rm cm}$", r"$\omega/5$", r"$\omega/5$", True),
            (r"(b)\ \ $L_{\rm cm}$ about $O$", r"$81\,ma^2\omega$", r"$76.2\,ma^2\omega$", False),
            (r"(c)\ \ $L$ about CM", r"$8.5\,ma^2\omega$", r"$9.37\,ma^2\omega$", False),
            (r"(d)\ \ $|L_z|$", r"$55\,ma^2\omega$", r"$77.5\,ma^2\omega$", False),
        ]
        rule = Line([-6.6, y0 - 0.34, 0], [6.6, y0 - 0.34, 0]).set_stroke(DIM, 2)
        rows = VGroup()
        for i, (a, b, c, ok) in enumerate(rows_data):
            y = y0 - 0.88 - i * 0.7
            ma = X(a, size=38)
            ma.move_to([left + ma.width / 2, y, 0])
            mb = X(b, size=38, color=MUTED).move_to([cols[1], y, 0])
            mc = X(c, size=38, color=GOOD if ok else TXT).move_to([cols[2], y, 0])
            md = VGroup(icon("T" if ok else "F").scale(1.6),
                        T("TRUE" if ok else "FALSE", 26, color=GOOD if ok else BAD, weight=BOLD)).arrange(RIGHT, buff=0.18)
            md.move_to([cols[3], y, 0])
            rows.add(VGroup(ma, mb, mc, md))
        self.play(FadeIn(hdr), Create(rule), run_time=0.8)
        for r in rows:
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.1) for m in r], lag_ratio=0.2), run_time=0.9)
        self.wait(1.0)
        ans = T("Answer:  only (a) is correct", size=36, color=GOOD, weight=BOLD).move_to([0, -1.62, 0])
        ansbox = SurroundingRectangle(ans, buff=0.2, corner_radius=0.12, color=GOOD, stroke_width=2.5).set_fill(GOOD, 0.08)
        self.play(FadeIn(ansbox), Write(ans), run_time=1.2)
        self.wait(1.5)
        note = X(r"If your answer key says (a) and (d): no consistent calculation gives "
                 r"$55\,ma^2\omega$ for (d); the exact value is $|L_z|=77.5\,ma^2\omega$.",
                 size=26, color=MUTED).move_to([0, -2.62, 0])
        if note.width > 12.6:
            note.scale_to_fit_width(12.6)
        self.play(FadeIn(note, shift=UP * 0.1), run_time=0.8)
        self.wait(6.0)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=1.2)
